import Phaser from 'phaser';

/**
 * Типы культур и их характеристики
 */
export type CropType = 'carrot' | 'wheat' | 'strawberry' | 'pumpkin';

export interface CropInfo {
  name: string;
  icon: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  growthWatered: number;
  growthDry: number;
}

export const CROPS: Record<CropType, CropInfo> = {
  carrot: {
    name: 'Морковь',
    icon: '🥕',
    basePrice: 12,
    minPrice: 8,
    maxPrice: 20,
    growthWatered: 4.0,
    growthDry: 12.0,
  },
  wheat: {
    name: 'Пшеница',
    icon: '🌾',
    basePrice: 26,
    minPrice: 18,
    maxPrice: 45,
    growthWatered: 6.5,
    growthDry: 18.0,
  },
  strawberry: {
    name: 'Клубника',
    icon: '🍓',
    basePrice: 65,
    minPrice: 45,
    maxPrice: 110,
    growthWatered: 9.0,
    growthDry: 25.0,
  },
  pumpkin: {
    name: 'Тыква',
    icon: '🎃',
    basePrice: 160,
    minPrice: 110,
    maxPrice: 280,
    growthWatered: 13.0,
    growthDry: 36.0,
  },
};

export type PlotState = 'empty' | 'seeded' | 'growing' | 'ready' | 'attacked' | 'withered';

export interface Plot {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  cropType: CropType;
  zoneId: number;
  unlocked: boolean;
  state: PlotState;
  isWatered: boolean;
  growthProgress: number;
  pestTimer: number;
  maxPestTimer: number;
  // Графика
  border: Phaser.GameObjects.Rectangle;
  soil: Phaser.GameObjects.Rectangle;
  plantIcon: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
  barBg: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
  pestContainer: Phaser.GameObjects.Container;
  pestText: Phaser.GameObjects.Text;
}

export interface FarmZone {
  id: number;
  name: string;
  cropType: CropType;
  cost: number;
  unlocked: boolean;
  signX: number;
  signY: number;
  signContainer?: Phaser.GameObjects.Container;
  fences: Phaser.GameObjects.Rectangle[];
}

export const INTERACT_RADIUS = 72;
export const MARKET_REFRESH_INTERVAL = 25; // секунд
export const FISH_SPAWN_INTERVAL = 65; // секунд до появления золотой рыбы

export class GameScene extends Phaser.Scene {
  // Персонаж
  private playerContainer!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private actionKeys!: Phaser.Input.Keyboard.Key[];
  private targetMovePoint: { x: number; y: number } | null = null;
  private pendingTargetObject: { type: 'well' | 'barn' | 'shop' | 'pond' | 'zoneSign' | 'plot'; obj?: any } | null = null;

  // Ресурсы
  private coins = 25;
  private water = 3;
  private inventory: Record<CropType, number> = {
    carrot: 0,
    wheat: 0,
    strawberry: 0,
    pumpkin: 0,
  };

  // Прокачка
  private waterCanLevel = 1;
  private waterCapacities = [3, 5, 8, 12];
  private waterUpgradeCosts = [50, 130, 300];

  private speedLevel = 1;
  private speedValues = [240, 300, 370];
  private speedUpgradeCosts = [70, 180];

  private hasScarecrow = false;
  private scarecrowCost = 140;
  private scarecrowVisual: Phaser.GameObjects.Container | null = null;

  // Локации
  private wellX = 90;
  private wellY = 270;
  private wellRadius = 50;

  private pondX = 95;
  private pondY = 490;
  private isGoldenFishActive = false;
  private fishTimer = 35; // первый раз через 35 сек
  private fishContainer!: Phaser.GameObjects.Container;

  private barnX = 875;
  private barnY = 220;

  private shopX = 875;
  private shopY = 460;

  // Зоны фермы и грядки
  private zones: FarmZone[] = [];
  private plots: Plot[] = [];

  // Рыночные цены
  private marketPrices: Record<CropType, number> = {
    carrot: 12,
    wheat: 26,
    strawberry: 65,
    pumpkin: 160,
  };
  private hotCrop: CropType | null = null;
  private marketTimer = MARKET_REFRESH_INTERVAL;

  // Вредители
  private pestCheckTimer = 0;

  // HUD
  private coinsText!: Phaser.GameObjects.Text;
  private waterText!: Phaser.GameObjects.Text;
  private inventoryText!: Phaser.GameObjects.Text;
  private marketTrendHudText!: Phaser.GameObjects.Text;
  private promptBox!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;

  // Большая наглядная доска цен у Амбара
  private marketBoardContainer!: Phaser.GameObjects.Container;
  private marketBoardTexts: Record<CropType, Phaser.GameObjects.Text> = {} as any;
  private marketBoardTimerText!: Phaser.GameObjects.Text;

  // Модальное окно торговли у Склада
  private marketModal!: Phaser.GameObjects.Container;
  private isMarketOpen = false;

  // Модальное окно Лавки
  private shopModal!: Phaser.GameObjects.Container;
  private isShopOpen = false;

  // Мини-игра рыбалки
  private fishingModal!: Phaser.GameObjects.Container;
  private isFishingActive = false;
  private fishingSlider!: Phaser.GameObjects.Rectangle;
  private fishingSliderPos = 0;
  private fishingSliderSpeed = 3.2;

  // Мини-игра отбивания ворон (QTE)
  private crowMinigameModal!: Phaser.GameObjects.Container;
  private isCrowMinigameActive = false;
  private crowTargetPlot: Plot | null = null;
  private crowSlider!: Phaser.GameObjects.Rectangle;
  private crowSliderPos = 0;
  private crowSliderSpeed = 4.0;

  // Звук и Музыка (Minecraft-стиль эмбиент)
  private audioCtx: AudioContext | null = null;
  private isMuted = false;
  private isMusicMuted = false;
  private musicIntervalTimer = 0;
  private nextMusicTime = 2.0;
  private soundButtonText!: Phaser.GameObjects.Text;
  private musicButtonText!: Phaser.GameObjects.Text;

  // Пауза
  private isPaused = false;
  private pauseModal!: Phaser.GameObjects.Container;
  private pauseButtonText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.resetState();

    this.createNaturalLandscape(width, height);
    this.createWell();
    this.createPond();
    this.createBarnAndMarketBoard();
    this.createWorkshopShop();
    this.createFarmZones();
    this.createPlayer();
    this.createHUD(width);
    this.createControls();

    // Модальные окна
    this.createMarketModal(width, height);
    this.createShopModal(width, height);
    this.createFishingMinigameModal(width, height);
    this.createCrowMinigameModal(width, height);
    this.createPauseModal(width, height);

    this.refreshMarketPrices(true);

    // Клик мышью
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.initAudio();
      if (this.isPaused || this.isShopOpen || this.isMarketOpen || this.isFishingActive || this.isCrowMinigameActive) return;
      this.handlePointerClick(pointer);
    });
  }

  private resetState(): void {
    this.isPaused = false;
    this.coins = 25;
    this.waterCanLevel = 1;
    this.water = this.getMaxWater();
    this.speedLevel = 1;
    this.hasScarecrow = false;
    this.inventory = { carrot: 0, wheat: 0, strawberry: 0, pumpkin: 0 };
    this.targetMovePoint = null;
    this.pendingTargetObject = null;
    this.plots = [];
    this.zones = [];
    this.isShopOpen = false;
    this.isMarketOpen = false;
    this.isFishingActive = false;
    this.isCrowMinigameActive = false;
    this.isGoldenFishActive = false;
    this.fishTimer = 40;
  }

  private getMaxWater(): number {
    return this.waterCapacities[this.waterCanLevel - 1] || 3;
  }

  private getPlayerSpeed(): number {
    return this.speedValues[this.speedLevel - 1] || 240;
  }

  // --- ЛАНДШАФТ И ДЕКОРАЦИИ ---

  private createNaturalLandscape(width: number, height: number): void {
    // Сочный градиентный газон
    this.add.rectangle(width / 2, height / 2, width, height, 0x1d3c19).setDepth(0);

    // Полянки клевера и ромашек
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
        this.add.circle(d.x, d.y, 4, 0xfef08a).setDepth(1);
        this.add.circle(d.x + 3, d.y + 2, 3, 0xffffff).setDepth(1);
      } else if (d.type === 'grass') {
        this.add.rectangle(d.x, d.y, 8, 12, 0x2e5e26).setDepth(1);
        this.add.rectangle(d.x + 4, d.y + 2, 7, 10, 0x3b7731).setDepth(1);
      } else if (d.type === 'stone') {
        this.add.ellipse(d.x, d.y, 14, 8, 0x64748b).setDepth(1);
      } else if (d.type === 'tree') {
        this.createTree(d.x, d.y);
      }
    }

    // Центральное пахотное поле
    const garden = this.add.rectangle(480, 360, 680, 520, 0x274322, 0.95);
    garden.setStrokeStyle(3, 0x3d6634);
    garden.setDepth(1);

    // Дорожки из гравия и утрамбованной земли
    const pathWell = this.add.rectangle(190, 270, 180, 32, 0x5a4832, 0.6).setDepth(1);
    const pathPond = this.add.rectangle(190, 490, 180, 32, 0x5a4832, 0.6).setDepth(1);
    const pathBarn = this.add.rectangle(800, 220, 160, 32, 0x5a4832, 0.6).setDepth(1);
    const pathShop = this.add.rectangle(800, 460, 160, 32, 0x5a4832, 0.6).setDepth(1);

    // Деревянный заборчик сверху
    for (let x = 40; x < width - 20; x += 38) {
      this.add.rectangle(x, 92, 7, 24, 0x7c4e2b).setDepth(2);
      this.add.rectangle(x + 19, 88, 38, 5, 0x643c1f).setDepth(2);
    }
  }

  private createTree(x: number, y: number): void {
    const shadow = this.add.ellipse(x, y + 24, 46, 18, 0x000000, 0.3).setDepth(2);
    const trunk = this.add.rectangle(x, y + 8, 14, 34, 0x5c3317).setDepth(2);
    const foliage1 = this.add.circle(x - 10, y - 16, 26, 0x166534).setDepth(3);
    const foliage2 = this.add.circle(x + 10, y - 20, 28, 0x15803d).setDepth(3);
    const foliage3 = this.add.circle(x, y - 36, 24, 0x22c55e).setDepth(4);
  }

  private createWell(): void {
    const shadow = this.add.ellipse(this.wellX, this.wellY + 28, 64, 18, 0x000000, 0.35).setDepth(2);

    const base = this.add.rectangle(this.wellX, this.wellY, 78, 68, 0x475569);
    base.setStrokeStyle(4, 0x1e293b);
    base.setDepth(3);

    const waterSurface = this.add.circle(this.wellX, this.wellY, 24, 0x0284c7);
    waterSurface.setDepth(4);

    const roof = this.add.rectangle(this.wellX, this.wellY - 42, 92, 22, 0x854d0e);
    roof.setDepth(5);

    this.add.text(this.wellX, this.wellY + 44, '💧 КОЛОДЕЦ\n(Набрать воду)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#7dd3fc',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);
  }

  private createPond(): void {
    // Живописный пруд с золотой рыбой
    const pondBg = this.add.ellipse(this.pondX, this.pondY, 110, 80, 0x0369a1).setDepth(2);
    pondBg.setStrokeStyle(4, 0x38bdf8);

    // Кувшинки
    this.add.circle(this.pondX - 25, this.pondY - 15, 8, 0x15803d).setDepth(3);
    this.add.circle(this.pondX + 22, this.pondY + 12, 10, 0x166534).setDepth(3);
    this.add.circle(this.pondX + 26, this.pondY + 10, 3, 0xf472b6).setDepth(4); // цветок

    this.add.text(this.pondX, this.pondY + 50, '🎣 ПРУД\n(Рыбалка)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#67e8f9',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    // Контейнер эффекта золотой рыбы
    this.fishContainer = this.add.container(this.pondX, this.pondY).setDepth(6);
    const fishGlow = this.add.circle(0, 0, 22, 0xfacc15, 0.4);
    const fishIcon = this.add.text(0, 0, '✨🐟✨', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
    }).setOrigin(0.5);

    const alertPill = this.add.text(0, -32, 'КЛЮЁТ! (300🪙)', {
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

  private createBarnAndMarketBoard(): void {
    // Амбар (Склад)
    const shadow = this.add.ellipse(this.barnX, this.barnY + 52, 116, 24, 0x000000, 0.35).setDepth(2);

    const barn = this.add.rectangle(this.barnX, this.barnY, 115, 95, 0x991b1b);
    barn.setStrokeStyle(3, 0x5f1111);
    barn.setDepth(3);

    const roof = this.add.rectangle(this.barnX, this.barnY - 52, 128, 26, 0xb91c1c);
    roof.setDepth(4);

    this.add.text(this.barnX, this.barnY - 24, '🏪 СКЛАД\n[ПРОБЕЛ / Клик]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#fef08a',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(5);

    // БОЛЬШАЯ, ЧЁТКАЯ ДОСКА ЦЕН НАД/ПОД СКЛАДОМ
    this.marketBoardContainer = this.add.container(this.barnX, this.barnY + 44).setDepth(6);
    const boardBg = this.add.rectangle(0, 0, 118, 62, 0x0f172a, 0.95);
    boardBg.setStrokeStyle(2, 0xfacc15);

    const keys: CropType[] = ['carrot', 'wheat', 'strawberry', 'pumpkin'];
    const coords = [
      { x: -52, y: -16 },
      { x: 8, y: -16 },
      { x: -52, y: 6 },
      { x: 8, y: 6 },
    ];

    keys.forEach((k, idx) => {
      const pos = coords[idx];
      const crop = CROPS[k];
      const t = this.add.text(pos.x, pos.y, `${crop.icon} 10🪙`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold',
      });
      this.marketBoardTexts[k] = t;
      this.marketBoardContainer.add(t);
    });

    this.marketBoardTimerText = this.add.text(0, 22, 'Смена: 25с', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '9px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    this.marketBoardContainer.add([boardBg, this.marketBoardTimerText]);
  }

  private createWorkshopShop(): void {
    const shadow = this.add.ellipse(this.shopX, this.shopY + 44, 110, 20, 0x000000, 0.35).setDepth(2);

    const workshop = this.add.rectangle(this.shopX, this.shopY, 110, 85, 0x1e3a8a);
    workshop.setStrokeStyle(3, 0x172554);
    workshop.setDepth(3);

    const roof = this.add.rectangle(this.shopX, this.shopY - 46, 122, 22, 0x2563eb);
    roof.setDepth(4);

    this.add.text(this.shopX, this.shopY, '🛠️ ЛАВКА\nУЛУЧШЕНИЙ\n[ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#bfdbfe',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(5);
  }

  private createFarmZones(): void {
    this.zones = [
      {
        id: 1,
        name: 'Морковная ферма',
        cropType: 'carrot',
        cost: 0,
        unlocked: true,
        signX: 200,
        signY: 175,
        fences: [],
      },
      {
        id: 2,
        name: 'Пшеничное поле',
        cropType: 'wheat',
        cost: 100,
        unlocked: false,
        signX: 200,
        signY: 305,
        fences: [],
      },
      {
        id: 3,
        name: 'Клубничная ферма',
        cropType: 'strawberry',
        cost: 250,
        unlocked: false,
        signX: 200,
        signY: 435,
        fences: [],
      },
      {
        id: 4,
        name: 'Тыквенная плантация',
        cropType: 'pumpkin',
        cost: 600,
        unlocked: false,
        signX: 200,
        signY: 555,
        fences: [],
      },
    ];

    const plotConfigs: Array<{ zoneId: number; cropType: CropType; x: number; y: number; w: number; h: number }> = [
      // Зона 1: Морковь
      { zoneId: 1, cropType: 'carrot', x: 330, y: 175, w: 125, h: 90 },
      { zoneId: 1, cropType: 'carrot', x: 490, y: 175, w: 125, h: 90 },
      { zoneId: 1, cropType: 'carrot', x: 650, y: 175, w: 125, h: 90 },
      // Зона 2: Пшеница
      { zoneId: 2, cropType: 'wheat', x: 330, y: 305, w: 125, h: 90 },
      { zoneId: 2, cropType: 'wheat', x: 490, y: 305, w: 125, h: 90 },
      { zoneId: 2, cropType: 'wheat', x: 650, y: 305, w: 125, h: 90 },
      // Зона 3: Клубника
      { zoneId: 3, cropType: 'strawberry', x: 330, y: 435, w: 125, h: 90 },
      { zoneId: 3, cropType: 'strawberry', x: 490, y: 435, w: 125, h: 90 },
      { zoneId: 3, cropType: 'strawberry', x: 650, y: 435, w: 125, h: 90 },
      // Зона 4: Тыква
      { zoneId: 4, cropType: 'pumpkin', x: 390, y: 555, w: 155, h: 90 },
      { zoneId: 4, cropType: 'pumpkin', x: 580, y: 555, w: 155, h: 90 },
    ];

    let plotId = 0;
    for (const p of plotConfigs) {
      plotId++;
      const zone = this.zones.find((z) => z.id === p.zoneId)!;

      const border = this.add.rectangle(p.x, p.y, p.w, p.h, 0x5a3416);
      border.setStrokeStyle(2, 0x3d200b);
      border.setDepth(3);

      const soil = this.add.rectangle(p.x, p.y, p.w - 10, p.h - 10, 0x623d1e);
      soil.setDepth(4);

      const plantIcon = this.add.text(p.x, p.y - 8, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
      }).setOrigin(0.5).setDepth(6);

      // Контейнер вороны с плашкой QTE
      const pestContainer = this.add.container(p.x, p.y - 32).setDepth(8).setVisible(false);
      const pestText = this.add.text(0, 0, '🦅', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
      }).setOrigin(0.5);
      const pestBadge = this.add.text(0, -22, '⚠️ КЛЮЁТ!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#ef4444',
        padding: { x: 4, y: 2 },
        fontStyle: 'bold',
      }).setOrigin(0.5);
      pestContainer.add([pestText, pestBadge]);

      const statusText = this.add.text(p.x, p.y + 26, 'Пусто', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#cbd5e1',
        backgroundColor: '#0f172ab0',
        padding: { x: 3, y: 2 },
      }).setOrigin(0.5).setDepth(7);

      const barBg = this.add.rectangle(p.x, p.y + 12, 90, 6, 0x1e293b);
      barBg.setDepth(6).setVisible(false);

      const barFill = this.add.rectangle(p.x - 45, p.y + 12, 0, 6, 0x22c55e);
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

      this.plots.push(plot);
      this.updatePlotVisuals(plot);
    }

    for (const zone of this.zones) {
      this.createZoneSignAndFence(zone);
    }
  }

  private createZoneSignAndFence(zone: FarmZone): void {
    if (zone.unlocked) return;

    const fence = this.add.rectangle(490, zone.signY, 460, 80, 0x000000, 0.35);
    fence.setStrokeStyle(2, 0xf59e0b, 0.6);
    fence.setDepth(10);
    zone.fences.push(fence);

    const signBox = this.add.container(zone.signX, zone.signY).setDepth(11);
    const signBg = this.add.rectangle(0, 0, 110, 48, 0x78350f);
    signBg.setStrokeStyle(2, 0xfacc15);

    const cropInfo = CROPS[zone.cropType];
    const signText = this.add.text(0, 0, `🔒 ${cropInfo.name}\n${zone.cost} 🪙`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#fef08a',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    signBox.add([signBg, signText]);
    signBox.setSize(110, 48);
    signBox.setInteractive({ useHandCursor: true });
    signBox.on('pointerdown', () => this.tryBuyZone(zone));

    zone.signContainer = signBox;
  }

  private tryBuyZone(zone: FarmZone): void {
    if (zone.unlocked) return;

    if (this.coins < zone.cost) {
      this.playErrorSound();
      this.showFloatingNotice(zone.signX, zone.signY - 30, `Нужно ещё ${zone.cost - this.coins} 🪙!`, '#f87171');
      return;
    }

    this.coins -= zone.cost;
    zone.unlocked = true;
    this.updateCoinsHud();

    for (const plot of this.plots) {
      if (plot.zoneId === zone.id) {
        plot.unlocked = true;
        this.updatePlotVisuals(plot);
      }
    }

    zone.fences.forEach((f) => f.destroy());
    zone.fences = [];
    if (zone.signContainer) {
      zone.signContainer.destroy();
      zone.signContainer = undefined;
    }

    this.playPowerup();
    this.showFloatingNotice(zone.signX, zone.signY - 30, `🎉 ${zone.name} открыта!`, '#4ade80');
  }

  private createPlayer(): void {
    const startX = 260;
    const startY = 230;

    this.playerContainer = this.add.container(startX, startY);
    this.playerContainer.setDepth(20);

    const shadow = this.add.ellipse(0, 18, 34, 12, 0x000000, 0.4);
    const body = this.add.rectangle(0, 4, 24, 28, 0x2563eb);
    body.setStrokeStyle(2, 0x1d4ed8);

    const head = this.add.circle(0, -14, 12, 0xfde047);
    const hatBrim = this.add.ellipse(0, -22, 40, 12, 0xd97706);
    const hatTop = this.add.rectangle(0, -28, 18, 10, 0xb45309);

    this.playerContainer.add([shadow, body, head, hatBrim, hatTop]);

    // Контекстная подсказка над головой
    this.promptBox = this.add.container(startX, startY - 56);
    this.promptBox.setDepth(30);
    this.promptBox.setVisible(false);

    const promptBg = this.add.rectangle(0, 0, 240, 26, 0x0f172a, 0.94);
    promptBg.setStrokeStyle(2, 0x38bdf8);

    this.promptText = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.promptBox.add([promptBg, this.promptText]);
  }

  private createHUD(width: number): void {
    const hudBg = this.add.rectangle(width / 2, 44, width - 24, 76, 0x0f172a, 0.95);
    hudBg.setStrokeStyle(2, 0x334155);
    hudBg.setDepth(35);

    this.coinsText = this.add.text(28, 22, `🪙 Монеты: ${this.coins}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#facc15',
      fontStyle: 'bold',
    }).setDepth(36);

    this.waterText = this.add.text(28, 48, `💧 Лейка: ${this.water}/${this.getMaxWater()}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#38bdf8',
    }).setDepth(36);

    this.marketTrendHudText = this.add.text(210, 22, '📈 Рынок: загрузка цен...', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#4ade80',
      fontStyle: 'bold',
    }).setDepth(36);

    this.inventoryText = this.add.text(210, 48, '🧺 Корзина: 🥕:0  🌾:0  🍓:0  🎃:0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#e2e8f0',
    }).setDepth(36);

    // Кнопка паузы
    this.pauseButtonText = this.add.text(width - 440, 34, '⏸️ Пауза [P]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#facc15',
      backgroundColor: '#1e293b',
      padding: { x: 8, y: 5 },
    }).setDepth(36).setInteractive({ useHandCursor: true });

    this.pauseButtonText.on('pointerdown', () => this.togglePause());

    // Кнопка музыки в стиле Minecraft C418
    this.musicButtonText = this.add.text(width - 325, 34, '🎵 Музыка: Вкл', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#a7f3d0',
      backgroundColor: '#1e293b',
      padding: { x: 8, y: 5 },
    }).setDepth(36).setInteractive({ useHandCursor: true });

    this.musicButtonText.on('pointerdown', () => {
      this.initAudio();
      this.isMusicMuted = !this.isMusicMuted;
      this.musicButtonText.setText(this.isMusicMuted ? '🎵 Музыка: Выкл' : '🎵 Музыка: Вкл');
    });

    // Кнопка звуков
    this.soundButtonText = this.add.text(width - 215, 34, '🔊 Звуки', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#94a3b8',
      backgroundColor: '#1e293b',
      padding: { x: 8, y: 5 },
    }).setDepth(36).setInteractive({ useHandCursor: true });

    this.soundButtonText.on('pointerdown', () => {
      this.initAudio();
      this.isMuted = !this.isMuted;
      this.soundButtonText.setText(this.isMuted ? '🔇 Выкл' : '🔊 Звуки');
    });

    // Кнопка Лавки
    const shopBtn = this.add.text(width - 120, 34, '🛠️ Лавка', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#38bdf8',
      backgroundColor: '#1e293b',
      padding: { x: 8, y: 5 },
    }).setDepth(36).setInteractive({ useHandCursor: true });
    shopBtn.on('pointerdown', () => this.openShopModal());

    this.add.text(width / 2, this.scale.height - 18, 'WASD / Клик — Идти  |  ПРОБЕЛ — Действие  |  P / Кнопка — Пауза  |  Склад: Рынок  |  Пруд: Рыбалка', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#94a3b8',
      backgroundColor: '#0f172acc',
      padding: { x: 10, y: 3 },
    }).setOrigin(0.5).setDepth(35);
  }

  private createControls(): void {
    if (!this.input.keyboard) throw new Error('Keyboard input is unavailable.');

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

    const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    const eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    const enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.actionKeys = [spaceKey, eKey, enterKey];

    // Клавиша P для паузы
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P).on('down', () => {
      this.togglePause();
    });

    // Клавиша ESC
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      if (this.isMarketOpen) {
        this.closeMarketModal();
      } else if (this.isShopOpen) {
        this.closeShopModal();
      } else {
        this.togglePause();
      }
    });
  }

  // --- МОДАЛЬНОЕ ОКНО РЫНКА (ЧЁТКИЙ СПИСОК ЦЕН И ПРОДАЖА) ---

  private createMarketModal(width: number, height: number): void {
    this.marketModal = this.add.container(width / 2, height / 2).setDepth(110).setVisible(false);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setInteractive();
    const panel = this.add.rectangle(0, 0, 500, 360, 0x0f172a);
    panel.setStrokeStyle(3, 0xfacc15);

    const title = this.add.text(0, -145, '🏪 РЫНОЧНАЯ БИРЖА СКЛАДА', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const desc = this.add.text(0, -118, 'Котировки цен меняются каждые 25 сек. Продавайте на пике спроса!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    const listContainer = this.add.container(0, -90).setName('marketList');

    const sellAllBtn = this.add.text(0, 95, 'ПРОДАТЬ ВСЁ (0 🪙)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '17px',
      color: '#ffffff',
      backgroundColor: '#16a34a',
      padding: { x: 24, y: 10 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setName('sellAllBtn').setInteractive({ useHandCursor: true });

    sellAllBtn.on('pointerdown', () => {
      this.sellAllHarvest();
      this.closeMarketModal();
    });

    const closeBtn = this.add.text(0, 145, 'ЗАКРЫТЬ [ESC]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#94a3b8',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this.closeMarketModal());

    this.marketModal.add([backdrop, panel, title, desc, listContainer, sellAllBtn, closeBtn]);

    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      if (this.isMarketOpen) this.closeMarketModal();
      if (this.isShopOpen) this.closeShopModal();
    });
  }

  private openMarketModal(): void {
    this.isMarketOpen = true;
    this.updateMarketModalContent();
    this.marketModal.setVisible(true);
  }

  private closeMarketModal(): void {
    this.isMarketOpen = false;
    this.marketModal.setVisible(false);
  }

  private updateMarketModalContent(): void {
    const list = this.marketModal.getByName('marketList') as Phaser.GameObjects.Container;
    list.removeAll(true);

    const crops: CropType[] = ['carrot', 'wheat', 'strawberry', 'pumpkin'];
    let totalValue = 0;

    crops.forEach((key, idx) => {
      const info = CROPS[key];
      const count = this.inventory[key];
      const price = this.marketPrices[key];
      const sum = count * price;
      totalValue += sum;

      const isHot = key === this.hotCrop;
      const y = idx * 42;

      const rowBg = this.add.rectangle(0, y, 440, 36, isHot ? 0x451a03 : 0x1e293b);
      rowBg.setStrokeStyle(1, isHot ? 0xf59e0b : 0x334155);

      const label = this.add.text(-205, y, `${info.icon} ${info.name}: ${price} 🪙/шт ${isHot ? '🔥 БУМ СПРОСА!' : ''}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: isHot ? '#fef08a' : '#f8fafc',
        fontStyle: isHot ? 'bold' : 'normal',
      }).setOrigin(0, 0.5);

      const rightInfo = this.add.text(205, y, `В корзине: ${count} шт = ${sum} 🪙`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: sum > 0 ? '#4ade80' : '#94a3b8',
        fontStyle: 'bold',
      }).setOrigin(1, 0.5);

      list.add([rowBg, label, rightInfo]);
    });

    const sellBtn = this.marketModal.getByName('sellAllBtn') as Phaser.GameObjects.Text;
    sellBtn.setText(`ПРОДАТЬ ВЕСЬ УРОЖАЙ (+${totalValue} 🪙)`);
    sellBtn.setBackgroundColor(totalValue > 0 ? '#16a34a' : '#334155');
  }

  // --- МИНИ-ИГРА "ОТБИВАНИЕ ВОРОН" ---

  private createCrowMinigameModal(width: number, height: number): void {
    this.crowMinigameModal = this.add.container(width / 2, height / 2).setDepth(120).setVisible(false);

    const bg = this.add.rectangle(0, 0, 420, 240, 0x0f172a, 0.95);
    bg.setStrokeStyle(3, 0xef4444);

    const title = this.add.text(0, -85, '🦅 НАПАДЕНИЕ ВОРОНЫ!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#ef4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const instr = this.add.text(0, -55, 'Нажмите ПРОБЕЛ или КЛИКНИТЕ, когда бегунок в ЗЕЛЕНОЙ ЗОНЕ,\nчтобы спугнуть птицу и выбить награду!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#cbd5e1',
      align: 'center',
    }).setOrigin(0.5);

    // Шкала
    const track = this.add.rectangle(0, 10, 320, 24, 0x1e293b);
    track.setStrokeStyle(2, 0x475569);

    // Зеленая зона успеха
    const greenZone = this.add.rectangle(0, 10, 75, 24, 0x22c55e);

    // Бегунок
    this.crowSlider = this.add.rectangle(0, 10, 14, 30, 0xfacc15);

    const hitBtn = this.add.text(0, 68, 'УДАРИТЬ ПУГАЧОМ! [ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#dc2626',
      padding: { x: 20, y: 8 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    hitBtn.on('pointerdown', () => this.resolveCrowHit());

    this.crowMinigameModal.add([bg, title, instr, track, greenZone, this.crowSlider, hitBtn]);
  }

  private startCrowMinigame(plot: Plot): void {
    this.isCrowMinigameActive = true;
    this.crowTargetPlot = plot;
    this.crowSliderPos = -140;
    this.crowMinigameModal.setVisible(true);
  }

  private resolveCrowHit(): void {
    if (!this.isCrowMinigameActive || !this.crowTargetPlot) return;

    // Проверяем попадание (зеленая зона от -37 до +37)
    const success = Math.abs(this.crowSliderPos) <= 40;
    this.isCrowMinigameActive = false;
    this.crowMinigameModal.setVisible(false);

    if (success) {
      // Идеальный удар! Спугнул + выбил бонусные монеты
      const bonusCoins = Phaser.Math.Between(25, 50);
      this.coins += bonusCoins;
      this.updateCoinsHud();

      this.crowTargetPlot.state = 'ready';
      this.crowTargetPlot.pestTimer = 0;
      this.updatePlotVisuals(this.crowTargetPlot);

      this.playScaredPest();
      this.showFloatingNotice(this.crowTargetPlot.x, this.crowTargetPlot.y - 35, `🦅 ВОРОНА СПУГНУТА!\n+${bonusCoins} 🪙 добычи!`, '#facc15');
    } else {
      // Промах
      this.playErrorSound();
      this.showFloatingNotice(this.crowTargetPlot.x, this.crowTargetPlot.y - 35, 'Мимо! Ворона ещё клюёт!', '#ef4444');
    }
    this.crowTargetPlot = null;
  }

  // --- МИНИ-ИГРА "ЗОЛОТАЯ РЫБАЛКА" (РЕДКАЯ ВЫСОКАЯ ПРИБЫЛЬ) ---

  private createFishingMinigameModal(width: number, height: number): void {
    this.fishingModal = this.add.container(width / 2, height / 2).setDepth(120).setVisible(false);

    const bg = this.add.rectangle(0, 0, 440, 260, 0x0f172a, 0.95);
    bg.setStrokeStyle(3, 0x38bdf8);

    const title = this.add.text(0, -95, '✨ ЛЕГЕНДАРНАЯ ЗОЛОТАЯ РЫБАЛКА! ✨', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#facc15',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const instr = this.add.text(0, -62, 'Поймайте бегунок в ЗОЛОТУЮ ЗОНУ, чтобы вытянуть рыбу!\nПрибыль: от 250 до 400 🪙!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#e2e8f0',
      align: 'center',
    }).setOrigin(0.5);

    const track = this.add.rectangle(0, 0, 320, 26, 0x1e293b);
    track.setStrokeStyle(2, 0x475569);

    // Золотая зона
    const targetZone = this.add.rectangle(0, 0, 60, 26, 0xf59e0b);

    this.fishingSlider = this.add.rectangle(0, 0, 14, 32, 0x38bdf8);

    const catchBtn = this.add.text(0, 65, 'ПОДДСЕЧЬ РЫБУ! [ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#0284c7',
      padding: { x: 22, y: 9 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    catchBtn.on('pointerdown', () => this.resolveFishing());

    this.fishingModal.add([bg, title, instr, track, targetZone, this.fishingSlider, catchBtn]);
  }

  private startFishing(): void {
    if (!this.isGoldenFishActive) {
      this.showFloatingNotice(this.pondX, this.pondY - 30, 'Рыба пока не клюёт... Ждите всплеска!', '#94a3b8');
      return;
    }
    this.isFishingActive = true;
    this.fishingSliderPos = -140;
    this.fishingModal.setVisible(true);
  }

  private resolveFishing(): void {
    if (!this.isFishingActive) return;

    const success = Math.abs(this.fishingSliderPos) <= 32;
    this.isFishingActive = false;
    this.fishingModal.setVisible(false);

    if (success) {
      const reward = Phaser.Math.Between(250, 420);
      this.coins += reward;
      this.updateCoinsHud();
      this.isGoldenFishActive = false;
      this.fishContainer.setVisible(false);
      this.fishTimer = FISH_SPAWN_INTERVAL;

      this.playVictoryFanfare();
      this.showFloatingNotice(this.pondX, this.pondY - 40, `🎉 ЗОЛОТАЯ РЫБА ПОЙМАНА!\n+${reward} 🪙 В КАЗНУ!`, '#4ade80');
    } else {
      this.playWaterSplash();
      this.showFloatingNotice(this.pondX, this.pondY - 40, 'Рыба сорвалась с крючка! Попробуйте ещё', '#f87171');
    }
  }

  // --- ЛАВКА УЛУЧШЕНИЙ ---

  private createShopModal(width: number, height: number): void {
    this.shopModal = this.add.container(width / 2, height / 2).setDepth(110).setVisible(false);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setInteractive();
    const panel = this.add.rectangle(0, 0, 520, 380, 0x0f172a);
    panel.setStrokeStyle(3, 0x38bdf8);

    const title = this.add.text(0, -150, '🛠️ ЛАВКА УЛУЧШЕНИЙ ФЕРМЕРА', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const waterBtn = this.createShopItemRow(0, -80, 'waterCan');
    const speedBtn = this.createShopItemRow(0, -10, 'boots');
    const scarecrowBtn = this.createShopItemRow(0, 60, 'scarecrow');

    const closeBtn = this.add.text(0, 140, 'ЗАКРЫТЬ [ESC]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#334155',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this.closeShopModal());

    this.shopModal.add([backdrop, panel, title, waterBtn, speedBtn, scarecrowBtn, closeBtn]);
  }

  private createShopItemRow(x: number, y: number, itemType: 'waterCan' | 'boots' | 'scarecrow'): Phaser.GameObjects.Container {
    const row = this.add.container(x, y).setName(`row_${itemType}`);
    const bg = this.add.rectangle(0, 0, 460, 52, 0x1e293b);
    bg.setStrokeStyle(2, 0x475569);

    const text = this.add.text(-210, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#f8fafc',
    }).setOrigin(0, 0.5).setName('label');

    const btn = this.add.text(140, 0, 'КУПИТЬ', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#2563eb',
      padding: { x: 12, y: 6 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setName('buyBtn').setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => this.buyShopItem(itemType));

    row.add([bg, text, btn]);
    return row;
  }

  private openShopModal(): void {
    this.isShopOpen = true;
    this.updateShopModalContents();
    this.shopModal.setVisible(true);
  }

  private closeShopModal(): void {
    this.isShopOpen = false;
    this.shopModal.setVisible(false);
  }

  private updateShopModalContents(): void {
    const waterRow = this.shopModal.getByName('row_waterCan') as Phaser.GameObjects.Container;
    const waterLabel = waterRow.getByName('label') as Phaser.GameObjects.Text;
    const waterBtn = waterRow.getByName('buyBtn') as Phaser.GameObjects.Text;

    if (this.waterCanLevel < this.waterCapacities.length) {
      const nextCap = this.waterCapacities[this.waterCanLevel];
      const cost = this.waterUpgradeCosts[this.waterCanLevel - 1];
      waterLabel.setText(`💧 Лейка (Ур. ${this.waterCanLevel} ➔ ${this.waterCanLevel + 1}): Вместимость ${nextCap} воды`);
      waterBtn.setText(`Купить (${cost} 🪙)`).setBackgroundColor(this.coins >= cost ? '#2563eb' : '#475569');
    } else {
      waterLabel.setText(`💧 Лейка: МАКСИМАЛЬНЫЙ УРОВЕНЬ (${this.getMaxWater()} воды)`);
      waterBtn.setText('МАКС').setBackgroundColor('#334155');
    }

    const speedRow = this.shopModal.getByName('row_boots') as Phaser.GameObjects.Container;
    const speedLabel = speedRow.getByName('label') as Phaser.GameObjects.Text;
    const speedBtn = speedRow.getByName('buyBtn') as Phaser.GameObjects.Text;

    if (this.speedLevel < this.speedValues.length) {
      const cost = this.speedUpgradeCosts[this.speedLevel - 1];
      speedLabel.setText(`👟 Скорость фермера (Ур. ${this.speedLevel} ➔ ${this.speedLevel + 1}): +25% скорости`);
      speedBtn.setText(`Купить (${cost} 🪙)`).setBackgroundColor(this.coins >= cost ? '#2563eb' : '#475569');
    } else {
      speedLabel.setText('👟 Скорость фермера: МАКСИМАЛЬНЫЙ УРОВЕНЬ');
      speedBtn.setText('МАКС').setBackgroundColor('#334155');
    }

    const scareRow = this.shopModal.getByName('row_scarecrow') as Phaser.GameObjects.Container;
    const scareLabel = scareRow.getByName('label') as Phaser.GameObjects.Text;
    const scareBtn = scareRow.getByName('buyBtn') as Phaser.GameObjects.Text;

    if (!this.hasScarecrow) {
      scareLabel.setText(`🌾 Пугало от ворон: Снижает набеги птиц на 75%`);
      scareBtn.setText(`Купить (${this.scarecrowCost} 🪙)`).setBackgroundColor(this.coins >= this.scarecrowCost ? '#2563eb' : '#475569');
    } else {
      scareLabel.setText('🌾 Пугало установлено на поле (Активно)');
      scareBtn.setText('КУПЛЕНО').setBackgroundColor('#334155');
    }
  }

  private buyShopItem(itemType: 'waterCan' | 'boots' | 'scarecrow'): void {
    if (itemType === 'waterCan') {
      if (this.waterCanLevel >= this.waterCapacities.length) return;
      const cost = this.waterUpgradeCosts[this.waterCanLevel - 1];
      if (this.coins < cost) {
        this.playErrorSound();
        return;
      }
      this.coins -= cost;
      this.waterCanLevel++;
      this.water = this.getMaxWater();
      this.playPowerup();
      this.showFloatingNotice(this.playerContainer.x, this.playerContainer.y - 30, `💧 Лейка улучшена до ${this.getMaxWater()}!`, '#38bdf8');
    } else if (itemType === 'boots') {
      if (this.speedLevel >= this.speedValues.length) return;
      const cost = this.speedUpgradeCosts[this.speedLevel - 1];
      if (this.coins < cost) {
        this.playErrorSound();
        return;
      }
      this.coins -= cost;
      this.speedLevel++;
      this.playPowerup();
      this.showFloatingNotice(this.playerContainer.x, this.playerContainer.y - 30, `👟 Скорость увеличена!`, '#facc15');
    } else if (itemType === 'scarecrow') {
      if (this.hasScarecrow) return;
      if (this.coins < this.scarecrowCost) {
        this.playErrorSound();
        return;
      }
      this.coins -= this.scarecrowCost;
      this.hasScarecrow = true;
      this.spawnScarecrowVisual();
      this.playPowerup();
      this.showFloatingNotice(this.playerContainer.x, this.playerContainer.y - 30, `🌾 Пугало установлено!`, '#4ade80');
    }

    this.updateCoinsHud();
    this.updateWaterHud();
    this.updateShopModalContents();
  }

  private spawnScarecrowVisual(): void {
    if (this.scarecrowVisual) return;
    const scX = 140;
    const scY = 380;

    this.scarecrowVisual = this.add.container(scX, scY).setDepth(15);
    const post = this.add.rectangle(0, 0, 8, 48, 0x78350f);
    const arms = this.add.rectangle(0, -12, 38, 6, 0x78350f);
    const head = this.add.circle(0, -22, 10, 0xfde047);
    const hat = this.add.ellipse(0, -28, 28, 8, 0xd97706);
    const text = this.add.text(0, 30, '🌾 Пугало', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#fef08a',
    }).setOrigin(0.5);

    this.scarecrowVisual.add([post, arms, head, hat, text]);
  }

  // --- ПАУЗА ИГРЫ (ЗАСТЫВАНИЕ ВСЕХ ОБЪЕКТОВ И ТАЙМЕРОВ) ---

  private togglePause(): void {
    if (this.isShopOpen) this.closeShopModal();
    if (this.isMarketOpen) this.closeMarketModal();

    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.tweens.pauseAll();
      this.pauseButtonText.setText('▶️ Играть');
      this.updatePauseModalContent();
      this.pauseModal.setVisible(true);
    } else {
      this.tweens.resumeAll();
      this.pauseButtonText.setText('⏸️ Пауза [P]');
      this.pauseModal.setVisible(false);
    }
  }

  private createPauseModal(width: number, height: number): void {
    this.pauseModal = this.add.container(width / 2, height / 2).setDepth(150).setVisible(false);

    // Полупрозрачный фон, блокирующий клики
    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setInteractive();

    const panel = this.add.rectangle(0, 0, 500, 350, 0x0f172a);
    panel.setStrokeStyle(3, 0x38bdf8);

    const title = this.add.text(0, -130, '⏸️ ИГРА НА ПАУЗЕ', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const subtitle = this.add.text(0, -95, 'Все таймеры, грядки, вороны и рыбалка застыли', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    const statsText = this.add.text(0, -15, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#f8fafc',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5).setName('pauseStatsText');

    const resumeBtn = this.add.text(0, 80, '▶️ ПРОДОЛЖИТЬ ИГРУ [P / ESC]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#2563eb',
      padding: { x: 24, y: 10 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    resumeBtn.on('pointerdown', () => this.togglePause());

    const tip = this.add.text(0, 135, 'Нажмите P или ESC на клавиатуре, чтобы вернуться к игре', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#64748b',
    }).setOrigin(0.5);

    this.pauseModal.add([backdrop, panel, title, subtitle, statsText, resumeBtn, tip]);
  }

  private updatePauseModalContent(): void {
    const stats = this.pauseModal.getByName('pauseStatsText') as Phaser.GameObjects.Text;
    const unlockedZones = this.zones
      .filter((z) => z.unlocked)
      .map((z) => CROPS[z.cropType].name)
      .join(', ');
    const countHarvest =
      this.inventory.carrot +
      this.inventory.wheat +
      this.inventory.strawberry +
      this.inventory.pumpkin;

    stats.setText(
      `🪙 Золото в казне: ${this.coins} монет\n` +
      `🧺 Урожай в корзине (${countHarvest} шт.): 🥕:${this.inventory.carrot}  🌾:${this.inventory.wheat}  🍓:${this.inventory.strawberry}  🎃:${this.inventory.pumpkin}\n` +
      `💧 Лейка: ${this.water}/${this.getMaxWater()} | Скорость фермера: Ур. ${this.speedLevel}\n` +
      `🌾 Пугало: ${this.hasScarecrow ? 'Установлено (защита активна)' : 'Не куплено'}\n` +
      `🗺️ Открытые территории: ${unlockedZones}`
    );
  }

  // --- ИГРОВОЙ ЦИКЛ ОБНОВЛЕНИЯ ---

  update(_time: number, delta: number): void {
    // Если включена пауза — застывают абсолютно все объекты и таймеры!
    if (this.isPaused) return;

    const seconds = delta / 1000;

    // Фоновая эмбиент музыка в стиле Minecraft
    this.updateAmbientMusic(seconds);

    // Бегунки в мини-играх
    if (this.isCrowMinigameActive) {
      this.crowSliderPos += this.crowSliderSpeed * seconds * 60;
      if (this.crowSliderPos > 140 || this.crowSliderPos < -140) {
        this.crowSliderSpeed = -this.crowSliderSpeed;
      }
      this.crowSlider.x = this.crowSliderPos;
      // Обработка клавиши пробел в миниигре
      if (this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) {
        this.resolveCrowHit();
      }
      return;
    }

    if (this.isFishingActive) {
      this.fishingSliderPos += this.fishingSliderSpeed * seconds * 60;
      if (this.fishingSliderPos > 140 || this.fishingSliderPos < -140) {
        this.fishingSliderSpeed = -this.fishingSliderSpeed;
      }
      this.fishingSlider.x = this.fishingSliderPos;
      if (this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) {
        this.resolveFishing();
      }
      return;
    }

    if (this.isShopOpen || this.isMarketOpen) return;

    this.updatePlayerMovement(seconds);
    this.updatePlotsGrowth(seconds);
    this.updatePests(seconds);
    this.updateMarket(seconds);
    this.updateFishingEvent(seconds);
    this.detectInteractionTarget();
    this.checkActionKeys();
  }

  private updatePlayerMovement(seconds: number): void {
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;

    const currentSpeed = this.getPlayerSpeed();

    if (dx !== 0 || dy !== 0) {
      this.targetMovePoint = null;
      this.pendingTargetObject = null;

      const len = Math.hypot(dx, dy);
      this.playerContainer.x += (dx / len) * currentSpeed * seconds;
      this.playerContainer.y += (dy / len) * currentSpeed * seconds;
      this.playerContainer.rotation = Math.sin(Date.now() / 90) * 0.08;
    } else if (this.targetMovePoint) {
      const dist = Phaser.Math.Distance.Between(
        this.playerContainer.x,
        this.playerContainer.y,
        this.targetMovePoint.x,
        this.targetMovePoint.y,
      );

      const canInteractNow = this.pendingTargetObject && this.checkIfNearPendingObject();

      if (dist <= 8 || canInteractNow) {
        this.targetMovePoint = null;
        this.playerContainer.rotation = 0;

        if (this.pendingTargetObject) {
          this.executePendingAction();
          this.pendingTargetObject = null;
        }
      } else {
        const angle = Phaser.Math.Angle.Between(
          this.playerContainer.x,
          this.playerContainer.y,
          this.targetMovePoint.x,
          this.targetMovePoint.y,
        );
        this.playerContainer.x += Math.cos(angle) * currentSpeed * seconds;
        this.playerContainer.y += Math.sin(angle) * currentSpeed * seconds;
        this.playerContainer.rotation = Math.sin(Date.now() / 90) * 0.08;
      }
    } else {
      this.playerContainer.rotation = 0;
    }

    this.playerContainer.x = Phaser.Math.Clamp(this.playerContainer.x, 40, this.scale.width - 40);
    this.playerContainer.y = Phaser.Math.Clamp(this.playerContainer.y, 120, this.scale.height - 40);

    this.promptBox.setPosition(this.playerContainer.x, this.playerContainer.y - 54);
  }

  private checkIfNearPendingObject(): boolean {
    if (!this.pendingTargetObject) return false;
    const px = this.playerContainer.x;
    const py = this.playerContainer.y;

    if (this.pendingTargetObject.type === 'well') {
      return Phaser.Math.Distance.Between(px, py, this.wellX, this.wellY) <= this.wellRadius + 20;
    }
    if (this.pendingTargetObject.type === 'pond') {
      return Phaser.Math.Distance.Between(px, py, this.pondX, this.pondY) <= 70;
    }
    if (this.pendingTargetObject.type === 'barn') {
      return Phaser.Math.Distance.Between(px, py, this.barnX, this.barnY) <= INTERACT_RADIUS + 20;
    }
    if (this.pendingTargetObject.type === 'shop') {
      return Phaser.Math.Distance.Between(px, py, this.shopX, this.shopY) <= INTERACT_RADIUS + 20;
    }
    if (this.pendingTargetObject.type === 'zoneSign') {
      const z = this.pendingTargetObject.obj as FarmZone;
      return Phaser.Math.Distance.Between(px, py, z.signX, z.signY) <= INTERACT_RADIUS;
    }
    if (this.pendingTargetObject.type === 'plot') {
      const plot = this.pendingTargetObject.obj as Plot;
      return Phaser.Math.Distance.Between(px, py, plot.x, plot.y) <= INTERACT_RADIUS;
    }
    return false;
  }

  private executePendingAction(): void {
    if (!this.pendingTargetObject) return;
    if (this.pendingTargetObject.type === 'well') {
      this.fillWater();
    } else if (this.pendingTargetObject.type === 'pond') {
      this.startFishing();
    } else if (this.pendingTargetObject.type === 'barn') {
      this.openMarketModal();
    } else if (this.pendingTargetObject.type === 'shop') {
      this.openShopModal();
    } else if (this.pendingTargetObject.type === 'zoneSign') {
      this.tryBuyZone(this.pendingTargetObject.obj);
    } else if (this.pendingTargetObject.type === 'plot') {
      this.interactWithPlot(this.pendingTargetObject.obj);
    }
  }

  private updatePlotsGrowth(seconds: number): void {
    for (const plot of this.plots) {
      if (!plot.unlocked) continue;

      if (plot.state === 'seeded' || plot.state === 'growing') {
        const info = CROPS[plot.cropType];
        const growthSec = plot.isWatered ? info.growthWatered : info.growthDry;
        plot.growthProgress += (1 / growthSec) * seconds;

        if (plot.growthProgress >= 1) {
          plot.growthProgress = 1;
          plot.state = 'ready';
          plot.isWatered = false;
          plot.soil.setFillStyle(0x432616);
          this.updatePlotVisuals(plot);
          this.playReadySound();
        } else {
          plot.barBg.setVisible(true);
          plot.barFill.setVisible(true);
          plot.barFill.width = 90 * plot.growthProgress;
          plot.barFill.setFillStyle(plot.isWatered ? 0x22c55e : 0xeab308);

          if (plot.growthProgress < 0.5) {
            plot.plantIcon.setText('🌱');
          } else {
            plot.plantIcon.setText('🌿');
          }
        }
      }
    }
  }

  private updatePests(seconds: number): void {
    this.pestCheckTimer += seconds;
    const interval = this.hasScarecrow ? 6.5 : 3.0;

    if (this.pestCheckTimer >= interval) {
      this.pestCheckTimer = 0;

      const ripePlots = this.plots.filter((p) => p.unlocked && p.state === 'ready');
      const spawnChance = this.hasScarecrow ? 0.25 : 0.65;

      if (ripePlots.length > 0 && Math.random() < spawnChance) {
        const victim = Phaser.Utils.Array.GetRandom(ripePlots) as Plot;
        if (victim) {
          victim.state = 'attacked';
          victim.maxPestTimer = 8.0;
          victim.pestTimer = victim.maxPestTimer;
          victim.soil.setFillStyle(0x7f1d1d);
          this.updatePlotVisuals(victim);
          this.playPestAlert();
          this.showFloatingNotice(victim.x, victim.y - 30, '⚠️ ВОРОНА КЛЮЁТ!', '#ef4444');
        }
      }
    }

    for (const plot of this.plots) {
      if (!plot.unlocked || plot.state !== 'attacked') continue;

      plot.pestTimer -= seconds;
      plot.pestContainer.y = plot.y - 32 + Math.sin(Date.now() / 80) * 4;

      plot.barBg.setVisible(true);
      plot.barFill.setVisible(true);
      const ratio = Phaser.Math.Clamp(plot.pestTimer / plot.maxPestTimer, 0, 1);
      plot.barFill.width = 90 * ratio;
      plot.barFill.setFillStyle(0xef4444);

      plot.statusText.setText(`⚠️ Клюёт: ${plot.pestTimer.toFixed(1)}с`);

      if (plot.pestTimer <= 0) {
        plot.state = 'withered';
        plot.soil.setFillStyle(0x27272a);
        this.updatePlotVisuals(plot);
        this.playCropLost();
        this.showFloatingNotice(plot.x, plot.y - 30, '🥀 Ворона склевала урожай!', '#f87171');
      }
    }
  }

  private updatePlotVisuals(plot: Plot): void {
    if (!plot.unlocked) {
      plot.border.setVisible(false);
      plot.soil.setVisible(false);
      plot.plantIcon.setVisible(false);
      plot.pestContainer.setVisible(false);
      plot.statusText.setVisible(false);
      plot.barBg.setVisible(false);
      plot.barFill.setVisible(false);
      return;
    }

    plot.border.setVisible(true);
    plot.soil.setVisible(true);
    plot.plantIcon.setVisible(true);
    plot.statusText.setVisible(true);

    const info = CROPS[plot.cropType];

    switch (plot.state) {
      case 'empty':
        plot.soil.setFillStyle(0x623d1e);
        plot.plantIcon.setText('');
        plot.pestContainer.setVisible(false);
        plot.statusText.setText(`${info.name} (пусто)`);
        plot.statusText.setColor('#cbd5e1');
        plot.barBg.setVisible(false);
        plot.barFill.setVisible(false);
        break;

      case 'seeded':
        plot.soil.setFillStyle(0x623d1e);
        plot.plantIcon.setText('🌱');
        plot.pestContainer.setVisible(false);
        plot.statusText.setText('Сухо (полей)');
        plot.statusText.setColor('#fbbf24');
        break;

      case 'growing':
        plot.soil.setFillStyle(0x351f0f);
        plot.pestContainer.setVisible(false);
        plot.statusText.setText('Растёт 💧');
        plot.statusText.setColor('#4ade80');
        break;

      case 'ready':
        plot.soil.setFillStyle(0x432616);
        plot.plantIcon.setText(info.icon);
        plot.pestContainer.setVisible(false);
        plot.statusText.setText('Спелый! Собери');
        plot.statusText.setColor('#facc15');
        plot.barBg.setVisible(false);
        plot.barFill.setVisible(false);
        break;

      case 'attacked':
        plot.pestContainer.setVisible(true);
        plot.statusText.setColor('#ef4444');
        break;

      case 'withered':
        plot.soil.setFillStyle(0x27272a);
        plot.plantIcon.setText('🥀');
        plot.pestContainer.setVisible(false);
        plot.statusText.setText('Склёвано (расчистить)');
        plot.statusText.setColor('#94a3b8');
        plot.barBg.setVisible(false);
        plot.barFill.setVisible(false);
        break;
    }
  }

  // --- РЫНОК И ПРОДАЖА ---

  private updateMarket(seconds: number): void {
    this.marketTimer -= seconds;
    this.marketBoardTimerText.setText(`Смена: ${Math.ceil(this.marketTimer)}с`);

    if (this.marketTimer <= 0) {
      this.marketTimer = MARKET_REFRESH_INTERVAL;
      this.refreshMarketPrices(false);
    }
  }

  private refreshMarketPrices(silent = false): void {
    const cropKeys: CropType[] = ['carrot', 'wheat', 'strawberry', 'pumpkin'];
    this.hotCrop = Phaser.Utils.Array.GetRandom(cropKeys) as CropType;

    for (const key of cropKeys) {
      const info = CROPS[key];
      let price = Phaser.Math.Between(info.minPrice, info.maxPrice);
      if (key === this.hotCrop) {
        price = Math.round(price * 1.5);
      }
      this.marketPrices[key] = price;

      // Обновляем текст на большой наглядной доске у Амбара
      if (this.marketBoardTexts[key]) {
        const isHot = key === this.hotCrop;
        this.marketBoardTexts[key].setText(`${info.icon} ${price}🪙${isHot ? '🔥' : ''}`);
        this.marketBoardTexts[key].setColor(isHot ? '#fef08a' : '#ffffff');
      }
    }

    const hotInfo = CROPS[this.hotCrop];
    const trendText = `🔥 БУМ на ${hotInfo.name}: ${this.marketPrices[this.hotCrop]} 🪙!`;
    this.marketTrendHudText.setText(`📈 ${trendText}`);

    if (this.isMarketOpen) {
      this.updateMarketModalContent();
    }

    if (!silent) {
      this.showFloatingNotice(this.barnX, this.barnY - 45, '📈 Цены на бирже обновились!', '#4ade80');
    }
  }

  private sellAllHarvest(): void {
    let revenue = 0;
    revenue += this.inventory.carrot * this.marketPrices.carrot;
    revenue += this.inventory.wheat * this.marketPrices.wheat;
    revenue += this.inventory.strawberry * this.marketPrices.strawberry;
    revenue += this.inventory.pumpkin * this.marketPrices.pumpkin;

    if (revenue === 0) {
      this.playErrorSound();
      this.showFloatingNotice(this.barnX, this.barnY - 40, 'Корзина пуста! Соберите урожай', '#f87171');
      return;
    }

    this.coins += revenue;
    this.inventory = { carrot: 0, wheat: 0, strawberry: 0, pumpkin: 0 };

    this.updateCoinsHud();
    this.updateInventoryHud();
    this.playSaleSound();
    this.showFloatingNotice(this.barnX, this.barnY - 40, `💰 Продано на +${revenue} 🪙!`, '#facc15');
  }

  // --- СОБЫТИЕ ЗОЛОТОЙ РЫБЫ ---

  private updateFishingEvent(seconds: number): void {
    if (this.isGoldenFishActive) return;

    this.fishTimer -= seconds;
    if (this.fishTimer <= 0) {
      this.isGoldenFishActive = true;
      this.fishContainer.setVisible(true);
      this.playReadySound();
      this.showFloatingNotice(this.pondX, this.pondY - 50, '🎣 ВСПЛЕСК В ПРУДУ!\nКлюёт Золотая рыба!', '#facc15');
    }
  }

  // --- ИНТЕРАКЦИЯ И КЛИКИ ---

  private handlePointerClick(pointer: Phaser.Input.Pointer): void {
    if (this.isPaused) return;

    const clickedX = pointer.x;
    const clickedY = pointer.y;

    if (clickedY <= 85) return;

    const px = this.playerContainer.x;
    const py = this.playerContainer.y;

    // 1. Колодец
    if (Phaser.Math.Distance.Between(clickedX, clickedY, this.wellX, this.wellY) <= this.wellRadius + 15) {
      if (Phaser.Math.Distance.Between(px, py, this.wellX, this.wellY) <= this.wellRadius + 20) {
        this.fillWater();
      } else {
        this.targetMovePoint = { x: this.wellX + 45, y: this.wellY };
        this.pendingTargetObject = { type: 'well' };
      }
      return;
    }

    // 2. Пруд (Рыбалка)
    if (Phaser.Math.Distance.Between(clickedX, clickedY, this.pondX, this.pondY) <= 65) {
      if (Phaser.Math.Distance.Between(px, py, this.pondX, this.pondY) <= 70) {
        this.startFishing();
      } else {
        this.targetMovePoint = { x: this.pondX + 50, y: this.pondY };
        this.pendingTargetObject = { type: 'pond' };
      }
      return;
    }

    // 3. Амбар (Рынок)
    if (Phaser.Math.Distance.Between(clickedX, clickedY, this.barnX, this.barnY) <= 65) {
      if (Phaser.Math.Distance.Between(px, py, this.barnX, this.barnY) <= INTERACT_RADIUS + 20) {
        this.openMarketModal();
      } else {
        this.targetMovePoint = { x: this.barnX - 55, y: this.barnY };
        this.pendingTargetObject = { type: 'barn' };
      }
      return;
    }

    // 4. Лавка улучшений
    if (Phaser.Math.Distance.Between(clickedX, clickedY, this.shopX, this.shopY) <= 65) {
      if (Phaser.Math.Distance.Between(px, py, this.shopX, this.shopY) <= INTERACT_RADIUS + 20) {
        this.openShopModal();
      } else {
        this.targetMovePoint = { x: this.shopX - 55, y: this.shopY };
        this.pendingTargetObject = { type: 'shop' };
      }
      return;
    }

    // 5. Грядки
    for (const plot of this.plots) {
      if (!plot.unlocked) continue;
      if (
        clickedX >= plot.x - plot.width / 2 &&
        clickedX <= plot.x + plot.width / 2 &&
        clickedY >= plot.y - plot.height / 2 &&
        clickedY <= plot.y + plot.height / 2
      ) {
        const distToPlayer = Phaser.Math.Distance.Between(px, py, plot.x, plot.y);
        if (distToPlayer <= INTERACT_RADIUS) {
          this.interactWithPlot(plot);
        } else {
          this.targetMovePoint = { x: plot.x, y: plot.y };
          this.pendingTargetObject = { type: 'plot', obj: plot };
        }
        return;
      }
    }

    // 6. Свободный клик для ходьбы
    this.targetMovePoint = { x: clickedX, y: clickedY };
    this.pendingTargetObject = null;
  }

  private detectInteractionTarget(): void {
    const px = this.playerContainer.x;
    const py = this.playerContainer.y;

    // Колодец
    if (Phaser.Math.Distance.Between(px, py, this.wellX, this.wellY) <= this.wellRadius + 20) {
      if (this.water < this.getMaxWater()) {
        this.showPrompt('[ПРОБЕЛ] Набрать воду');
      } else {
        this.showPrompt(`Лейка полна (${this.water}/${this.getMaxWater()})`);
      }
      return;
    }

    // Пруд
    if (Phaser.Math.Distance.Between(px, py, this.pondX, this.pondY) <= 70) {
      if (this.isGoldenFishActive) {
        this.showPrompt('✨ [ПРОБЕЛ / Клик] ЛОВИТЬ ЗОЛОТУЮ РЫБУ!');
      } else {
        this.showPrompt('🎣 Пруд: Ждите всплеска рыбы');
      }
      return;
    }

    // Амбар (Рынок)
    if (Phaser.Math.Distance.Between(px, py, this.barnX, this.barnY) <= INTERACT_RADIUS + 20) {
      this.showPrompt('[ПРОБЕЛ / Клик] Открыть биржу Склада');
      return;
    }

    // Лавка
    if (Phaser.Math.Distance.Between(px, py, this.shopX, this.shopY) <= INTERACT_RADIUS + 20) {
      this.showPrompt('[ПРОБЕЛ] Открыть лавку улучшений');
      return;
    }

    // Таблички закрытых зон
    for (const zone of this.zones) {
      if (!zone.unlocked && Phaser.Math.Distance.Between(px, py, zone.signX, zone.signY) <= INTERACT_RADIUS) {
        this.showPrompt(`[ПРОБЕЛ] Купить ${zone.name} (${zone.cost} 🪙)`);
        return;
      }
    }

    // Ближайшая разблокированная грядка
    let nearestPlot: Plot | null = null;
    let minDist = Number.MAX_VALUE;

    for (const plot of this.plots) {
      if (!plot.unlocked) continue;
      const d = Phaser.Math.Distance.Between(px, py, plot.x, plot.y);
      if (d < minDist) {
        minDist = d;
        nearestPlot = plot;
      }
    }

    if (nearestPlot && minDist <= INTERACT_RADIUS) {
      this.updatePromptForPlot(nearestPlot);
      return;
    }

    this.promptBox.setVisible(false);
  }

  private updatePromptForPlot(plot: Plot): void {
    const info = CROPS[plot.cropType];
    switch (plot.state) {
      case 'empty':
        this.showPrompt(`[ПРОБЕЛ] Посадить: ${info.name}`);
        break;
      case 'seeded':
        if (this.water > 0) {
          this.showPrompt('[ПРОБЕЛ] Полить грядку (-1 💧)');
        } else {
          this.showPrompt('Нет воды! Беги к колодцу');
        }
        break;
      case 'growing':
        this.showPrompt(`🌱 ${info.name} созревает...`);
        break;
      case 'ready':
        this.showPrompt(`[ПРОБЕЛ] Собрать: ${info.name} ${info.icon}`);
        break;
      case 'attacked':
        this.showPrompt('⚠️ [ПРОБЕЛ] МИНИ-ИГРА: СПУГНУТЬ ВОРОНУ!');
        break;
      case 'withered':
        this.showPrompt('[ПРОБЕЛ] Расчистить грядку');
        break;
    }
  }

  private showPrompt(text: string): void {
    this.promptText.setText(text);
    this.promptBox.setVisible(true);
  }

  private checkActionKeys(): void {
    const justPressed = this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k));
    if (!justPressed) return;

    this.initAudio();
    const px = this.playerContainer.x;
    const py = this.playerContainer.y;

    if (Phaser.Math.Distance.Between(px, py, this.wellX, this.wellY) <= this.wellRadius + 20) {
      this.fillWater();
      return;
    }

    if (Phaser.Math.Distance.Between(px, py, this.pondX, this.pondY) <= 70) {
      this.startFishing();
      return;
    }

    if (Phaser.Math.Distance.Between(px, py, this.barnX, this.barnY) <= INTERACT_RADIUS + 20) {
      this.openMarketModal();
      return;
    }

    if (Phaser.Math.Distance.Between(px, py, this.shopX, this.shopY) <= INTERACT_RADIUS + 20) {
      this.openShopModal();
      return;
    }

    for (const zone of this.zones) {
      if (!zone.unlocked && Phaser.Math.Distance.Between(px, py, zone.signX, zone.signY) <= INTERACT_RADIUS) {
        this.tryBuyZone(zone);
        return;
      }
    }

    let nearestPlot: Plot | null = null;
    let minDist = Number.MAX_VALUE;
    for (const plot of this.plots) {
      if (!plot.unlocked) continue;
      const d = Phaser.Math.Distance.Between(px, py, plot.x, plot.y);
      if (d < minDist) {
        minDist = d;
        nearestPlot = plot;
      }
    }

    if (nearestPlot && minDist <= INTERACT_RADIUS) {
      this.interactWithPlot(nearestPlot);
    }
  }

  private fillWater(): void {
    const max = this.getMaxWater();
    if (this.water >= max) {
      this.showFloatingNotice(this.wellX, this.wellY - 30, 'Лейка уже полная!', '#38bdf8');
      return;
    }

    this.water = max;
    this.updateWaterHud();
    this.playWaterFill();
    this.showFloatingNotice(this.wellX, this.wellY - 30, `💧 +${max} Воды!`, '#38bdf8');
  }

  private interactWithPlot(plot: Plot): void {
    const info = CROPS[plot.cropType];

    switch (plot.state) {
      case 'empty':
        plot.state = 'seeded';
        plot.growthProgress = 0;
        plot.isWatered = false;
        this.updatePlotVisuals(plot);
        this.playPlant();
        this.showFloatingNotice(plot.x, plot.y - 25, `🌱 Посажено!`, '#86efac');
        break;

      case 'seeded':
        if (this.water <= 0) {
          this.playErrorSound();
          this.showFloatingNotice(plot.x, plot.y - 25, 'Нет воды! Беги к колодцу!', '#f87171');
          return;
        }
        this.water -= 1;
        this.updateWaterHud();
        plot.state = 'growing';
        plot.isWatered = true;
        this.updatePlotVisuals(plot);
        this.playWaterSplash();
        this.showFloatingNotice(plot.x, plot.y - 25, '💧 Полито!', '#38bdf8');
        break;

      case 'ready':
        this.inventory[plot.cropType] += 1;
        this.updateInventoryHud();
        plot.state = 'empty';
        plot.growthProgress = 0;
        this.updatePlotVisuals(plot);
        this.playHarvest();
        this.showFloatingNotice(plot.x, plot.y - 25, `+1 ${info.icon} в корзину!`, '#facc15');
        break;

      case 'attacked':
        // Запуск QTE мини-игры отбивания вороны
        this.startCrowMinigame(plot);
        break;

      case 'withered':
        plot.state = 'empty';
        plot.growthProgress = 0;
        this.updatePlotVisuals(plot);
        this.playPlant();
        this.showFloatingNotice(plot.x, plot.y - 25, '🧹 Расчищено', '#cbd5e1');
        break;

      case 'growing':
        this.showFloatingNotice(plot.x, plot.y - 25, 'Ещё созревает...', '#94a3b8');
        break;
    }

    this.detectInteractionTarget();
  }

  // --- ОБНОВЛЕНИЕ HUD И ЭФФЕКТЫ ---

  private updateCoinsHud(): void {
    this.coinsText.setText(`🪙 Монеты: ${this.coins}`);
  }

  private updateWaterHud(): void {
    this.waterText.setText(`💧 Лейка: ${this.water}/${this.getMaxWater()}`);
  }

  private updateInventoryHud(): void {
    this.inventoryText.setText(
      `🧺 Корзина: 🥕:${this.inventory.carrot}  🌾:${this.inventory.wheat}  🍓:${this.inventory.strawberry}  🎃:${this.inventory.pumpkin}`,
    );
  }

  private showFloatingNotice(x: number, y: number, text: string, color: string): void {
    const notice = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color,
      fontStyle: 'bold',
      backgroundColor: '#0f172acc',
      padding: { x: 6, y: 3 },
      align: 'center',
    }).setOrigin(0.5).setDepth(45);

    this.tweens.add({
      targets: notice,
      y: y - 35,
      alpha: 0,
      duration: 1100,
      ease: 'Power1',
      onComplete: () => notice.destroy(),
    });
  }

  // --- МУЗЫКАЛЬНЫЙ ЭМБИЕНТ В СТИЛЕ MINECRAFT (C418) ---

  private updateAmbientMusic(seconds: number): void {
    if (this.isMusicMuted || !this.audioCtx) return;

    this.musicIntervalTimer += seconds;
    if (this.musicIntervalTimer >= this.nextMusicTime) {
      this.musicIntervalTimer = 0;
      // Уютная пауза между фортепианными аккордами в стиле C418 (4-8 секунд)
      this.nextMusicTime = Phaser.Math.Between(45, 80) / 10;
      this.playPianoAmbientPhrase();
    }
  }

  private playPianoAmbientPhrase(): void {
    if (this.isMusicMuted || !this.audioCtx) return;

    // Пентатонические мягкие ноты пианино (C4, E4, G4, A4, B4, C5, D5, E5)
    const chords = [
      [261.63, 329.63, 392.0],        // C-maj
      [220.0, 261.63, 329.63],        // A-min
      [349.23, 440.0, 523.25],        // F-maj
      [196.0, 246.94, 293.66, 392.0], // G-maj
    ];

    const chosenChord = Phaser.Utils.Array.GetRandom(chords) as number[];

    chosenChord.forEach((freq, idx) => {
      // Каждая нота играет с лёгким арпеджио-смещением
      setTimeout(() => {
        this.playPianoNote(freq);
      }, idx * 160);
    });
  }

  private playPianoNote(freq: number): void {
    if (this.isMusicMuted || !this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const oscHarmonic = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const filter = this.audioCtx.createBiquadFilter();

      // Теплый Lowpass фильтр как в аналоговом пианино
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, this.audioCtx.currentTime);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      // Вторая гармоника для богатства тембра
      oscHarmonic.type = 'triangle';
      oscHarmonic.frequency.setValueAtTime(freq * 2, this.audioCtx.currentTime);

      const now = this.audioCtx.currentTime;
      // Мягкая атака и долгий затухающий сустейн (как у C418)
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.045, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

      osc.connect(filter);
      oscHarmonic.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      oscHarmonic.start(now);
      osc.stop(now + 3.3);
      oscHarmonic.stop(now + 3.3);
    } catch {
      // Игнорируем блокировки
    }
  }

  // --- ЗВУКОВЫЕ ЭФФЕКТЫ ---

  private initAudio(): void {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();
      return;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) this.audioCtx = new AudioCtx();
  }

  private playTone(freq: number, type: OscillatorType, duration: number, gainVal = 0.08): void {
    if (this.isMuted || !this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch {
      // Игнорируем
    }
  }

  private playPlant(): void {
    this.playTone(240, 'sine', 0.1, 0.07);
  }

  private playWaterFill(): void {
    this.playTone(460, 'sine', 0.15, 0.08);
    setTimeout(() => this.playTone(600, 'sine', 0.2, 0.08), 80);
  }

  private playWaterSplash(): void {
    this.playTone(320, 'triangle', 0.14, 0.08);
  }

  private playReadySound(): void {
    this.playTone(587.33, 'triangle', 0.12, 0.04);
  }

  private playHarvest(): void {
    this.playTone(523.25, 'sine', 0.1, 0.09);
    setTimeout(() => this.playTone(659.25, 'sine', 0.15, 0.09), 70);
  }

  private playSaleSound(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.18, 0.08), idx * 70);
    });
  }

  private playVictoryFanfare(): void {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 'sine', 0.28, 0.1), idx * 90);
    });
  }

  private playPowerup(): void {
    const notes = [392, 523.25, 659.25, 783.99];
    notes.forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 'sine', 0.2, 0.09), idx * 80);
    });
  }

  private playPestAlert(): void {
    this.playTone(180, 'sawtooth', 0.22, 0.08);
  }

  private playScaredPest(): void {
    this.playTone(700, 'sawtooth', 0.12, 0.07);
    setTimeout(() => this.playTone(950, 'sawtooth', 0.14, 0.06), 70);
  }

  private playCropLost(): void {
    this.playTone(190, 'sawtooth', 0.35, 0.1);
  }

  private playErrorSound(): void {
    this.playTone(150, 'sawtooth', 0.15, 0.08);
  }
}
