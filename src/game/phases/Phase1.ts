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
  public marketBoardTimerText!: Phaser.GameObjects.Text;

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
    // Сочный газон
    this.scene.add.rectangle(worldWidth / 2, height / 2, worldWidth, height, 0x1d3c19).setDepth(0);

    // Декорации (полянки, ромашки, камушки, деревья)
    const decorPositions = [
      { x: 180, y: 140, type: 'flower' },
      { x: 230, y: 220, type: 'grass' },
      { x: 210, y: 380, type: 'flower' },
      { x: 740, y: 150, type: 'grass' },
      { x: 760, y: 280, type: 'flower' },
      { x: 780, y: 550, type: 'grass' },
      { x: 120, y: 390, type: 'stone' },
      { x: 80, y: 160, type: 'tree' },
      { x: 890, y: 100, type: 'tree' },
      { x: 920, y: 570, type: 'tree' },
    ];

    for (const d of decorPositions) {
      if (d.type === 'flower') {
        this.scene.add.circle(d.x, d.y, 4, 0xfef08a).setDepth(1);
        this.scene.add.circle(d.x + 3, d.y + 2, 3, 0xffffff).setDepth(1);
      } else if (d.type === 'grass') {
        this.scene.add.rectangle(d.x, d.y, 8, 12, 0x2e5e26).setDepth(1);
        this.scene.add.rectangle(d.x + 4, d.y + 2, 7, 10, 0x3b7731).setDepth(1);
      } else if (d.type === 'stone') {
        this.scene.add.ellipse(d.x, d.y, 14, 8, 0x64748b).setDepth(1);
      } else if (d.type === 'tree') {
        this.createTree(d.x, d.y);
      }
    }

    // Центральное пахотное поле Фазы 1
    const garden = this.scene.add.rectangle(480, 360, 680, 520, 0x274322, 0.95);
    garden.setStrokeStyle(3, 0x3d6634);
    garden.setDepth(1);

    // Дорожки из гравия
    this.scene.add.rectangle(190, 270, 180, 32, 0x5a4832, 0.6).setDepth(1);
    this.scene.add.rectangle(190, 490, 180, 32, 0x5a4832, 0.6).setDepth(1);
    this.scene.add.rectangle(800, 220, 160, 32, 0x5a4832, 0.6).setDepth(1);
    this.scene.add.rectangle(800, 460, 160, 32, 0x5a4832, 0.6).setDepth(1);

    // Верхний забор
    for (let x = 40; x < worldWidth - 20; x += 38) {
      this.scene.add.rectangle(x, 92, 7, 24, 0x7c4e2b).setDepth(2);
      this.scene.add.rectangle(x + 19, 88, 38, 5, 0x643c1f).setDepth(2);
    }
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
    base.setInteractive({ useHandCursor: true });
    base.on('pointerdown', onRefill);

    const waterSurface = this.scene.add.circle(wellX, wellY, 24, 0x0284c7);
    waterSurface.setDepth(4);

    const roof = this.scene.add.rectangle(wellX, wellY - 42, 92, 22, 0x854d0e);
    roof.setDepth(5);
    roof.setInteractive({ useHandCursor: true });
    roof.on('pointerdown', onRefill);

    const label = this.scene.add.text(wellX, wellY + 44, '💧 КОЛОДЕЦ\n(Набрать воду)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#7dd3fc',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);
    label.setInteractive({ useHandCursor: true });
    label.on('pointerdown', onRefill);
  }

  public createPond(onFish: () => void): void {
    const { pondX, pondY } = PHASE1_LOCATIONS;
    const pondBg = this.scene.add.ellipse(pondX, pondY, 110, 80, 0x0369a1).setDepth(2);
    pondBg.setStrokeStyle(4, 0x38bdf8);
    pondBg.setInteractive({ useHandCursor: true });
    pondBg.on('pointerdown', onFish);

    // Кувшинки
    this.scene.add.circle(pondX - 25, pondY - 15, 8, 0x15803d).setDepth(3);
    this.scene.add.circle(pondX + 22, pondY + 12, 10, 0x166534).setDepth(3);
    this.scene.add.circle(pondX + 26, pondY + 10, 3, 0xf472b6).setDepth(4);

    const label = this.scene.add.text(pondX, pondY + 50, '🎣 ПРУД\n(Рыбалка)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#67e8f9',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);
    label.setInteractive({ useHandCursor: true });
    label.on('pointerdown', onFish);

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
    this.scene.add.ellipse(barnX, barnY + 52, 116, 24, 0x000000, 0.35).setDepth(2);

    this.barn = this.scene.add.rectangle(barnX, barnY, 115, 95, 0x991b1b);
    this.barn.setStrokeStyle(3, 0x5f1111);
    this.barn.setDepth(3);
    this.barn.setInteractive({ useHandCursor: true });
    this.barn.on('pointerdown', onOpenMarket);

    const roof = this.scene.add.rectangle(barnX, barnY - 52, 128, 26, 0xb91c1c);
    roof.setDepth(4);
    roof.setInteractive({ useHandCursor: true });
    roof.on('pointerdown', onOpenMarket);

    const barnLabel = this.scene.add.text(barnX, barnY - 24, '🏪 СКЛАД\n[ПРОБЕЛ / Клик]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#fef08a',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(5);
    barnLabel.setInteractive({ useHandCursor: true });
    barnLabel.on('pointerdown', onOpenMarket);

    // Доска цен на бирже (6 культур)
    const marketBoardContainer = this.scene.add.container(barnX, barnY + 44).setDepth(6);
    const boardBg = this.scene.add.rectangle(0, 0, 154, 68, 0x0f172a, 0.95);
    boardBg.setStrokeStyle(2, 0xfacc15);
    boardBg.setInteractive({ useHandCursor: true });
    boardBg.on('pointerdown', onOpenMarket);

    const keys: CropType[] = ['carrot', 'wheat', 'strawberry', 'pumpkin', 'corn', 'watermelon'];
    const coords = [
      { x: -52, y: -20 },
      { x: -4, y: -20 },
      { x: 44, y: -20 },
      { x: -52, y: 2 },
      { x: -4, y: 2 },
      { x: 44, y: 2 },
    ];

    keys.forEach((k, idx) => {
      const pos = coords[idx];
      const crop = CROPS[k];
      const t = this.scene.add.text(pos.x, pos.y, `${crop.icon} 10🪙`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold',
      });
      this.marketBoardTexts[k] = t;
      marketBoardContainer.add(t);
    });

    this.marketBoardTimerText = this.scene.add.text(0, 24, 'Смена: 25с', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '9px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    marketBoardContainer.add([boardBg, this.marketBoardTimerText]);
  }

  public createWorkshopShop(onOpenShop: () => void): void {
    const { shopX, shopY } = PHASE1_LOCATIONS;
    this.scene.add.ellipse(shopX, shopY + 44, 110, 20, 0x000000, 0.35).setDepth(2);

    this.shop = this.scene.add.rectangle(shopX, shopY, 110, 85, 0x1e3a8a);
    this.shop.setStrokeStyle(3, 0x172554);
    this.shop.setDepth(3);
    this.shop.setInteractive({ useHandCursor: true });
    this.shop.on('pointerdown', onOpenShop);

    const roof = this.scene.add.rectangle(shopX, shopY - 46, 122, 22, 0x2563eb);
    roof.setDepth(4);
    roof.setInteractive({ useHandCursor: true });
    roof.on('pointerdown', onOpenShop);

    const shopLabel = this.scene.add.text(shopX, shopY, '🛠️ ЛАВКА\nУЛУЧШЕНИЙ\n[ПРОБЕЛ / Клик]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#bfdbfe',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(5);
    shopLabel.setInteractive({ useHandCursor: true });
    shopLabel.on('pointerdown', onOpenShop);
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
        plantIcon,
        statusText,
        barBg,
        barFill,
        pestContainer,
        pestText,
      };

      // Интерактивность грядки
      border.setInteractive({ useHandCursor: true }).on('pointerdown', () => onPlotClick(plot));
      soil.setInteractive({ useHandCursor: true }).on('pointerdown', () => onPlotClick(plot));

      this.plots.push(plot);
    }

    // Ограждения и таблички покупки для зон 2, 3, 4
    for (const zone of this.zones) {
      if (zone.unlocked) continue;

      const fence = this.scene.add.rectangle(490, zone.signY, 460, 80, 0x000000, 0.35);
      fence.setStrokeStyle(2, 0xf59e0b, 0.6);
      fence.setDepth(10);
      zone.fences.push(fence);

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
      signBox.setInteractive({ useHandCursor: true });
      signBox.on('pointerdown', () => onBuyZone(zone));

      zone.signContainer = signBox;
    }

    return { zones: this.zones, plots: this.plots };
  }
}
