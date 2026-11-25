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
    // Бесшовный аутентичный газон Sprout Lands (16x16 бесшовный тайл) на весь мир
    this.scene.add.tileSprite(
      worldWidth / 2, height / 2, worldWidth, height, 'sprout_grass_tile'
    ).setDepth(0);

    // Зона обработанной земли под грядки Фазы 1
    this.scene.add.tileSprite(
      490, 365, 520, 480, 'sprout_dirt_tile'
    ).setDepth(1).setAlpha(0.65);

    // Дорожки из гравия
    this.scene.add.tileSprite(190, 270, 180, 24, 'sprout_paths').setDepth(2);
    this.scene.add.tileSprite(190, 490, 180, 24, 'sprout_paths').setDepth(2);
    this.scene.add.tileSprite(800, 220, 140, 24, 'sprout_paths').setDepth(2);
    this.scene.add.tileSprite(800, 460, 140, 24, 'sprout_paths').setDepth(2);

    // Верхний забор из спрайтов fences (16x16 кадры)
    for (let x = 40; x < worldWidth - 20; x += 32) {
      this.scene.add.sprite(x, 92, 'sprout_fences', 0).setScale(2).setDepth(2);
    }

    // Декоративные пиксель-арт деревья (равномерно распределены, без скоплений)
    this.createTree(75, 145, 1);
    this.createTree(755, 130, 2);
    this.createTree(915, 575, 1);

    // Полянки цветов и единичные природные объекты (разнесены по разным частям карты)
    this.scene.add.image(155, 365, 'sprout_flower1').setScale(1.5).setDepth(2);
    this.scene.add.image(745, 360, 'sprout_flower1').setScale(1.5).setDepth(2);
    this.scene.add.image(240, 570, 'sprout_flower1').setScale(1.5).setDepth(2);
    this.scene.add.image(195, 130, 'sprout_bush1').setScale(1.8).setDepth(2);
    this.scene.add.image(775, 575, 'sprout_stump1').setScale(1.8).setDepth(2);
    this.scene.add.image(130, 585, 'sprout_stone1').setScale(1.6).setDepth(2);
  }

  public createTree(x: number, y: number, variant: 1 | 2 = 1): void {
    const shadowW = variant === 2 ? 40 : 28;
    this.scene.add.ellipse(x, y + 26, shadowW, 12, 0x000000, 0.25).setDepth(2);
    const treeKey = variant === 2 ? 'sprout_tree2' : 'sprout_tree1';
    this.scene.add.image(x, y, treeKey).setScale(2.0).setDepth(3);
  }

  public createWell(onRefill: () => void): void {
    const { wellX, wellY } = PHASE1_LOCATIONS;
    this.scene.add.ellipse(wellX, wellY + 28, 54, 16, 0x000000, 0.25).setDepth(2);

    const base = this.scene.add.rectangle(wellX, wellY, 64, 52, 0x475569);
    base.setStrokeStyle(3, 0x1e293b);
    base.setDepth(3);

    const waterSurface = this.scene.add.circle(wellX, wellY, 18, 0x5299a9);
    waterSurface.setDepth(4);

    const roof = this.scene.add.rectangle(wellX, wellY - 32, 74, 18, 0x854d0e);
    roof.setDepth(5);

    this.scene.add.text(wellX, wellY + 38, '💧 КОЛОДЕЦ\n[ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#7dd3fc',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6);
  }

  public createPond(onFish: () => void): void {
    const { pondX, pondY } = PHASE1_LOCATIONS;

    // Единая структура пруда: берег и 4x3 тайловая сетка анимированной воды
    const tileScale = 1.75;
    const tilePx = 16 * tileScale; // 28px
    const cols = 4;
    const rows = 3;
    const waterW = cols * tilePx; // 112px
    const waterH = rows * tilePx; // 84px

    this.scene.add.rectangle(pondX, pondY + 3, waterW + 14, waterH + 14, 0x000000, 0.2).setDepth(1);
    this.scene.add.rectangle(pondX, pondY, waterW + 8, waterH + 8, 0x3d7068).setDepth(2);

    const startX = pondX - waterW / 2 + tilePx / 2;
    const startY = pondY - waterH / 2 + tilePx / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wt = this.scene.add.sprite(
          startX + c * tilePx,
          startY + r * tilePx,
          'sprout_water',
          (c + r) % 4,
        ).setScale(tileScale).setDepth(3);
        wt.play('water_sparkle');
      }
    }

    // Один аккуратный деревянный мостик для рыбалки на правом берегу
    this.scene.add.image(pondX + waterW / 2 + 4, pondY, 'sprout_bridge_pier').setScale(1.3).setDepth(5);

    this.scene.add.text(pondX, pondY + waterH / 2 + 16, '🎣 ПРУД\n[ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#67e8f9',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6);

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
    this.scene.add.ellipse(barnX, barnY + 46, 120, 20, 0x000000, 0.3).setDepth(2);

    // Здание Склада (собрано из тайлов крыши, стен, окна и двери Wooden House)
    this.scene.add.image(barnX, barnY, 'sprout_barn').setScale(1.75).setDepth(4);

    // Вывеска склада
    this.scene.add.text(barnX, barnY - 62, '🏪 СКЛАД\n[ПРОБЕЛ]', {
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
    this.scene.add.ellipse(shopX, shopY + 42, 96, 18, 0x000000, 0.3).setDepth(2);

    // Лавка улучшений (собрана из тайлов крыши, стен и открытой двери)
    this.scene.add.image(shopX, shopY - 2, 'sprout_shop').setScale(1.65).setDepth(4);

    // Герб с инструментами над входом
    this.scene.add.sprite(shopX, shopY - 12, 'sprout_tools', 0).setScale(1.6).setDepth(5);

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
