import Phaser from 'phaser';
import {
  CropType,
  CROPS,
  FarmZone,
  Plot,
  PHASE1_LOCATIONS,
  PHASE1_ZONES,
  PHASE1_PLOT_CONFIGS,
} from '../constants';

/**
 * ============================================================================
 * ФАЗА 1: ОСНОВНАЯ ФЕРМА (0..960 px)
 * ============================================================================
 * Отвечает за:
 * - Природный ландшафт, дорожки, деревья, полянки ромашек
 * - Колодец (набор воды)
 * - Пруд с золотой рыбой
 * - Амбар со Складом и интерактивной доской цен
 * - Лавку улучшений и мастерскую
 * - Зоны 1-4: Морковь, Пшеница, Клубника (ключ к Фазе 2), Тыква
 */
export class Phase1 {
  private scene: Phaser.Scene;

  // Интерактивные объекты
  public barn!: Phaser.GameObjects.Rectangle;
  public shop!: Phaser.GameObjects.Rectangle;
  public fishContainer!: Phaser.GameObjects.Container;
  public marketBoardTexts: Record<CropType, Phaser.GameObjects.Text> = {} as any;
  public marketBoardTimerText?: Phaser.GameObjects.Text;

  // Зоны и грядки
  private zones: FarmZone[] = [];
  private plots: Plot[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public getZones(): FarmZone[] {
    return this.zones;
  }

  public getPlots(): Plot[] {
    return this.plots;
  }

  public createLandscape(worldWidth: number, height: number): void {
    // Фон: тайлированная текстура травы из Sprout Lands (176x112)
    // Покрываем весь мир повторяющимся тайлом
    const grassTile = this.scene.add.tileSprite(
      worldWidth / 2, height / 2, worldWidth, height, 'sprout_grass'
    ).setDepth(0);

    // Тёмное пахотное поле (тайловый грунт) для зоны грядок Фазы 1
    const dirtField = this.scene.add.tileSprite(
      480, 360, 680, 520, 'sprout_tilled_dirt'
    ).setDepth(1).setAlpha(0.85);

    // Дорожки из тайла paths
    const path1 = this.scene.add.tileSprite(190, 270, 180, 32, 'sprout_paths').setDepth(2);
    const path2 = this.scene.add.tileSprite(190, 490, 180, 32, 'sprout_paths').setDepth(2);
    const path3 = this.scene.add.tileSprite(800, 220, 160, 32, 'sprout_paths').setDepth(2);
    const path4 = this.scene.add.tileSprite(800, 460, 160, 32, 'sprout_paths').setDepth(2);

    // Верхний забор из спрайтов fences (16x16 кадры)
    for (let x = 40; x < worldWidth - 20; x += 32) {
      this.scene.add.sprite(x, 92, 'sprout_fences', 0).setScale(2).setDepth(2);
    }

    // Деревья (декоративные)
    this.createTree(80, 160);
    this.createTree(890, 100);
    this.createTree(920, 570);
  }

  public createTree(x: number, y: number): void {
    this.scene.add.ellipse(x, y + 24, 46, 18, 0x000000, 0.3).setDepth(2);
    this.scene.add.rectangle(x, y + 8, 14, 34, 0x5c3317).setDepth(2);
    this.scene.add.circle(x - 10, y - 16, 26, 0x166534).setDepth(3);
    this.scene.add.circle(x + 10, y - 20, 28, 0x15803d).setDepth(3);
    this.scene.add.circle(x, y - 36, 24, 0x22c55e).setDepth(4);
  }

  public createWell(onRefill: () => void): void {
    const { wellX, wellY } = PHASE1_LOCATIONS;
    this.scene.add.ellipse(wellX, wellY + 28, 64, 18, 0x000000, 0.35).setDepth(2);

    const base = this.scene.add.rectangle(wellX, wellY, 78, 68, 0x475569);
    base.setStrokeStyle(4, 0x1e293b);
    base.setDepth(3);

    const waterSurface = this.scene.add.circle(wellX, wellY, 24, 0x0284c7);
    waterSurface.setDepth(4);

    const roof = this.scene.add.rectangle(wellX, wellY - 42, 92, 22, 0x854d0e);
    roof.setDepth(5);

    this.scene.add.text(wellX, wellY + 44, '💧 КОЛОДЕЦ\n[ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#7dd3fc',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);
  }

  public createPond(onFish: () => void): void {
    const { pondX, pondY } = PHASE1_LOCATIONS;

    // Чистый водоём — эллиптический пруд
    const pondBg = this.scene.add.ellipse(pondX, pondY, 110, 80, 0x0369a1).setDepth(2);
    pondBg.setStrokeStyle(4, 0x0ea5e9);

    // Анимированная поверхность воды (тайловые брызги)
    const waterTile = this.scene.add.tileSprite(pondX, pondY, 64, 48, 'sprout_water').setDepth(3).setAlpha(0.7);

    // Кувшинки
    this.scene.add.circle(pondX - 25, pondY - 15, 8, 0x15803d).setDepth(4);
    this.scene.add.circle(pondX + 22, pondY + 12, 10, 0x166534).setDepth(4);
    this.scene.add.circle(pondX + 26, pondY + 10, 3, 0xf472b6).setDepth(5);

    this.scene.add.text(pondX, pondY + 50, '🎣 ПРУД\n[ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#67e8f9',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    // Контейнер золотой рыбы
    this.fishContainer = this.scene.add.container(pondX, pondY).setDepth(6);
    const fishGlow = this.scene.add.circle(0, 0, 22, 0xfacc15, 0.4);
    const fishIcon = this.scene.add.text(0, 0, '✨🐟✨', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
    }).setOrigin(0.5);

    const alertPill = this.scene.add.text(0, -32, 'КЛЮЁТ! (300🪙)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#ffffff',
      backgroundColor: '#f59e0b',
      padding: { x: 4, y: 2 },
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.fishContainer.add([fishGlow, fishIcon, alertPill]);
    this.fishContainer.setVisible(false);
  }

  public createBarnAndMarketBoard(onOpenMarket: () => void): void {
    const { barnX, barnY } = PHASE1_LOCATIONS;

    // Тень под зданием
    this.scene.add.ellipse(barnX, barnY + 52, 140, 24, 0x000000, 0.3).setDepth(2);

    // Здание Склада (деревянный дом Sprout Lands — 112x80 цельная текстура)
    this.scene.add.image(barnX, barnY, 'sprout_house').setScale(1.5).setDepth(4);

    // Вывеска склада
    this.scene.add.text(barnX, barnY - 70, '🏪 СКЛАД\n[ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#fef08a',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(6);
  }

  public createWorkshopShop(onOpenShop: () => void): void {
    const { shopX, shopY } = PHASE1_LOCATIONS;

    // Тень под зданием
    this.scene.add.ellipse(shopX, shopY + 44, 110, 20, 0x000000, 0.3).setDepth(2);

    // Мастерская (Shed — 48x48 цельная текстура курятника/сарая)
    this.scene.add.image(shopX, shopY, 'sprout_shed').setScale(2.2).setDepth(4);

    // Вывеска лавки
    this.scene.add.text(shopX, shopY - 60, '🛠️ ЛАВКА УЛУЧШЕНИЙ\n[ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#bfdbfe',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(6);
  }

  public createZonesAndPlots(
    onPlotClick: (plot: Plot) => void,
    onBuyZone: (zone: FarmZone) => void,
  ): { zones: FarmZone[]; plots: Plot[] } {
    this.zones = PHASE1_ZONES.map((z) => ({ ...z, fences: [] }));
    this.plots = [];

    let plotId = 0;
    for (const p of PHASE1_PLOT_CONFIGS) {
      plotId++;
      const zone = this.zones.find((z) => z.id === p.zoneId)!;

      const border = this.scene.add.rectangle(p.x, p.y, p.w, p.h, 0x5a3416);
      border.setStrokeStyle(2, 0x3d200b);
      border.setDepth(3);

      const soil = this.scene.add.rectangle(p.x, p.y, p.w - 10, p.h - 10, 0x623d1e);
      soil.setDepth(4);

      const plantIcon = this.scene.add.text(p.x, p.y - 8, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
      }).setOrigin(0.5).setDepth(6);

      let cropSprite: Phaser.GameObjects.Sprite | undefined;
      try {
        cropSprite = this.scene.add.sprite(p.x, p.y - 6, 'sprout_plants', 0)
          .setScale(2.5)
          .setDepth(6)
          .setVisible(false);
      } catch {
        // fallback
      }

      const pestContainer = this.scene.add.container(p.x, p.y - 32).setDepth(8).setVisible(false);
      const pestText = this.scene.add.text(0, 0, '🦅', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
      }).setOrigin(0.5);
      const pestBadge = this.scene.add.text(0, -22, '⚠️ КЛЮЁТ!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#ef4444',
        padding: { x: 4, y: 2 },
        fontStyle: 'bold',
      }).setOrigin(0.5);
      pestContainer.add([pestText, pestBadge]);

      const statusText = this.scene.add.text(p.x, p.y + 26, 'Пусто', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#cbd5e1',
        backgroundColor: '#0f172ab0',
        padding: { x: 3, y: 2 },
      }).setOrigin(0.5).setDepth(7);

      const barBg = this.scene.add.rectangle(p.x, p.y + 12, 90, 6, 0x1e293b);
      barBg.setDepth(6).setVisible(false);

      const barFill = this.scene.add.rectangle(p.x - 45, p.y + 12, 0, 6, 0x22c55e);
      barFill.setOrigin(0, 0.5).setDepth(7).setVisible(false);

      const plot: Plot = {
        id: plotId,
        x: p.x,
        y: p.y,
        width: p.w,
        height: p.h,
        cropType: p.cropType,
        zoneId: p.zoneId,
        unlocked: zone.unlocked,
        state: 'empty',
        isWatered: false,
        growthProgress: 0,
        pestTimer: 0,
        maxPestTimer: 8.0,
        border,
        soil,
        cropSprite,
        plantIcon,
        statusText,
        barBg,
        barFill,
        pestContainer,
        pestText,
      };

      this.plots.push(plot);
    }

    // Ограждения и таблички покупки для зон 2, 3, 4
    for (const zone of this.zones) {
      if (zone.unlocked) continue;

      // Аккуратный деревянный заборчик без черных затемнений
      const railTop = this.scene.add.rectangle(490, zone.signY - 38, 460, 4, 0x78350f).setDepth(4);
      const railBottom = this.scene.add.rectangle(490, zone.signY + 38, 460, 4, 0x78350f).setDepth(4);
      zone.fences.push(railTop, railBottom);
      for (let fx = 280; fx <= 700; fx += 60) {
        const post = this.scene.add.rectangle(fx, zone.signY, 6, 80, 0x5c3317).setDepth(5);
        zone.fences.push(post);
      }

      const signBox = this.scene.add.container(zone.signX, zone.signY).setDepth(11);
      const signBg = this.scene.add.rectangle(0, 0, 110, 48, 0x78350f);
      signBg.setStrokeStyle(2, 0xfacc15);

      const cropInfo = CROPS[zone.cropType];
      const isStrawberry = zone.cropType === 'strawberry';
      const signLabel = isStrawberry
        ? `🔒 ${cropInfo.name}\n${zone.cost} 🪙 (Ключ к Фазе 2)`
        : `🔒 ${cropInfo.name}\n${zone.cost} 🪙`;

      const signText = this.scene.add.text(0, 0, signLabel, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#fef08a',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5);

      signBox.add([signBg, signText]);
      signBox.setSize(110, 48);

      zone.signContainer = signBox;
    }

    return { zones: this.zones, plots: this.plots };
  }
}
