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
  growthWatered: number; // секунд при поливе
  growthDry: number;     // секунд без полива
}

export const CROPS: Record<CropType, CropInfo> = {
  carrot: {
    name: 'Морковь',
    icon: '🥕',
    basePrice: 10,
    minPrice: 7,
    maxPrice: 18,
    growthWatered: 4.0,
    growthDry: 12.0,
  },
  wheat: {
    name: 'Пшеница',
    icon: '🌾',
    basePrice: 24,
    minPrice: 16,
    maxPrice: 42,
    growthWatered: 6.5,
    growthDry: 18.0,
  },
  strawberry: {
    name: 'Клубника',
    icon: '🍓',
    basePrice: 60,
    minPrice: 40,
    maxPrice: 105,
    growthWatered: 9.0,
    growthDry: 25.0,
  },
  pumpkin: {
    name: 'Тыква',
    icon: '🎃',
    basePrice: 150,
    minPrice: 110,
    maxPrice: 260,
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
  growthProgress: number; // 0..1
  pestTimer: number;
  maxPestTimer: number;
  // Графические элементы
  border: Phaser.GameObjects.Rectangle;
  soil: Phaser.GameObjects.Rectangle;
  plantIcon: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
  barBg: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
  pestIcon: Phaser.GameObjects.Text;
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

export const INTERACT_RADIUS = 68;
export const BASE_PLAYER_SPEED = 240;
export const MARKET_REFRESH_INTERVAL = 25; // секунд между сменой рыночных цен

export class GameScene extends Phaser.Scene {
  // Персонаж и движение
  private playerContainer!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private actionKeys!: Phaser.Input.Keyboard.Key[];
  private targetMovePoint: { x: number; y: number } | null = null;
  private pendingTargetObject: { type: 'well' | 'barn' | 'shop' | 'zoneSign' | 'plot'; obj?: any } | null = null;

  // Ресурсы игрока
  private coins = 20; // Стартовый капитал
  private water = 3;
  private inventory: Record<CropType, number> = {
    carrot: 0,
    wheat: 0,
    strawberry: 0,
    pumpkin: 0,
  };

  // Уровни прокачки
  private waterCanLevel = 1; // 1: 3, 2: 5, 3: 8, 4: 12
  private waterCapacities = [3, 5, 8, 12];
  private waterUpgradeCosts = [50, 130, 300];

  private speedLevel = 1; // 1: 240, 2: 300, 3: 370
  private speedValues = [240, 300, 370];
  private speedUpgradeCosts = [70, 180];

  private hasScarecrow = false;
  private scarecrowCost = 140;
  private scarecrowVisual: Phaser.GameObjects.Container | null = null;

  // Локации на карте
  private wellX = 90;
  private wellY = 320;
  private wellRadius = 50;

  private barnX = 875;
  private barnY = 220;

  private shopX = 875;
  private shopY = 460;

  // Зоны фермы и грядки
  private zones: FarmZone[] = [];
  private plots: Plot[] = [];

  // Рынок и цены
  private marketPrices: Record<CropType, number> = {
    carrot: 10,
    wheat: 24,
    strawberry: 60,
    pumpkin: 150,
  };
  private marketTrendText = 'Обычный спрос';
  private marketTimer = MARKET_REFRESH_INTERVAL;
  private hotCrop: CropType | null = null;

  // Вредители
  private pestCheckTimer = 0;

  // HUD элементы
  private hudBg!: Phaser.GameObjects.Rectangle;
  private coinsText!: Phaser.GameObjects.Text;
  private waterText!: Phaser.GameObjects.Text;
  private inventoryText!: Phaser.GameObjects.Text;
  private marketTrendHudText!: Phaser.GameObjects.Text;
  private promptBox!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;

  // Табличка цен у амбара
  private barnPriceBoardText!: Phaser.GameObjects.Text;

  // Модальное окно магазина улучшений
  private shopModal!: Phaser.GameObjects.Container;
  private isShopOpen = false;

  // Аудио
  private audioCtx: AudioContext | null = null;
  private isMuted = false;
  private soundButtonText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.resetAllData();

    this.createWorld(width, height);
    this.createWell();
    this.createBarnAndMarket();
    this.createWorkshopShop();
    this.createFarmZones();
    this.createPlayer();
    this.createHUD(width);
    this.createControls();
    this.createShopModal(width, height);

    this.refreshMarketPrices(true);

    // Управление мышью: клик-to-move или выбор объектов
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.initAudio();
      if (this.isShopOpen) return;
      this.handlePointerClick(pointer);
    });
  }

  private resetAllData(): void {
    this.coins = 20;
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
  }

  private getMaxWater(): number {
    return this.waterCapacities[this.waterCanLevel - 1] || 3;
  }

  private getPlayerSpeed(): number {
    return this.speedValues[this.speedLevel - 1] || 240;
  }

  // --- СОЗДАНИЕ МИРА И ЛОКАЦИЙ ---

  private createWorld(width: number, height: number): void {
    // Зелёный фон
    this.add.rectangle(width / 2, height / 2, width, height, 0x1c3818).setDepth(0);

    // Центральное поле фермы
    const farmGround = this.add.rectangle(480, 360, 680, 520, 0x274322, 0.95);
    farmGround.setStrokeStyle(3, 0x3d6634);
    farmGround.setDepth(1);

    // Тропинки из светлой земли к колодцу, амбару и мастерской
    const pathToWell = this.add.rectangle(190, 320, 180, 36, 0x5a4832, 0.5);
    pathToWell.setDepth(1);
    const pathToBarn = this.add.rectangle(800, 220, 160, 36, 0x5a4832, 0.5);
    pathToBarn.setDepth(1);
    const pathToShop = this.add.rectangle(800, 460, 160, 36, 0x5a4832, 0.5);
    pathToShop.setDepth(1);

    // Верхняя деревянная ограда
    for (let x = 40; x < width - 20; x += 40) {
      this.add.rectangle(x, 92, 8, 22, 0x7c4e2b).setDepth(2);
      this.add.rectangle(x + 20, 88, 40, 6, 0x643c1f).setDepth(2);
    }
  }

  private createWell(): void {
    // Каменный колодец
    const base = this.add.rectangle(this.wellX, this.wellY, 78, 78, 0x475569);
    base.setStrokeStyle(4, 0x1e293b);
    base.setDepth(3);

    const waterSurface = this.add.circle(this.wellX, this.wellY, 26, 0x0284c7);
    waterSurface.setDepth(4);

    const roof = this.add.rectangle(this.wellX, this.wellY - 44, 92, 20, 0x854d0e);
    roof.setDepth(5);

    this.add.text(this.wellX, this.wellY + 48, '💧 КОЛОДЕЦ\n(Набрать воду)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#7dd3fc',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);
  }

  private createBarnAndMarket(): void {
    // Амбар (Склад / Рынок)
    const barn = this.add.rectangle(this.barnX, this.barnY, 110, 110, 0x991b1b);
    barn.setStrokeStyle(3, 0x5f1111);
    barn.setDepth(3);

    const roof = this.add.rectangle(this.barnX, this.barnY - 58, 122, 24, 0xb91c1c);
    roof.setDepth(4);

    this.add.text(this.barnX, this.barnY - 26, '🏪 СКЛАД\n& РЫНОК', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#fef08a',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(5);

    // Доска текущих котировок цен под амбаром
    this.barnPriceBoardText = this.add.text(this.barnX, this.barnY + 34, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#ffffff',
      align: 'center',
      lineSpacing: 2,
    }).setOrigin(0.5).setDepth(5);
  }

  private createWorkshopShop(): void {
    // Мастерская улучшений
    const workshop = this.add.rectangle(this.shopX, this.shopY, 110, 96, 0x1e3a8a);
    workshop.setStrokeStyle(3, 0x172554);
    workshop.setDepth(3);

    const roof = this.add.rectangle(this.shopX, this.shopY - 52, 122, 22, 0x2563eb);
    roof.setDepth(4);

    this.add.text(this.shopX, this.shopY - 6, '🛠️ ЛАВКА\nУЛУЧШЕНИЙ\n[ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#bfdbfe',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(5);
  }

  private createFarmZones(): void {
    // 4 Зоны фермы:
    // Зона 1: Морковь 🥕 (Бесплатная, 3 грядки)
    // Зона 2: Пшеница 🌾 (100 🪙, 3 грядки)
    // Зона 3: Клубника 🍓 (250 🪙, 3 грядки)
    // Зона 4: Тыква 🎃 (600 🪙, 2 грядки)

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

    // Конфигурация расположения грядок по зонам
    const plotConfigs: Array<{ zoneId: number; cropType: CropType; x: number; y: number; w: number; h: number }> = [
      // Зона 1: Морковь (y = 175)
      { zoneId: 1, cropType: 'carrot', x: 330, y: 175, w: 125, h: 90 },
      { zoneId: 1, cropType: 'carrot', x: 490, y: 175, w: 125, h: 90 },
      { zoneId: 1, cropType: 'carrot', x: 650, y: 175, w: 125, h: 90 },

      // Зона 2: Пшеница (y = 305)
      { zoneId: 2, cropType: 'wheat', x: 330, y: 305, w: 125, h: 90 },
      { zoneId: 2, cropType: 'wheat', x: 490, y: 305, w: 125, h: 90 },
      { zoneId: 2, cropType: 'wheat', x: 650, y: 305, w: 125, h: 90 },

      // Зона 3: Клубника (y = 435)
      { zoneId: 3, cropType: 'strawberry', x: 330, y: 435, w: 125, h: 90 },
      { zoneId: 3, cropType: 'strawberry', x: 490, y: 435, w: 125, h: 90 },
      { zoneId: 3, cropType: 'strawberry', x: 650, y: 435, w: 125, h: 90 },

      // Зона 4: Тыква (y = 555)
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

      const pestIcon = this.add.text(p.x, p.y - 28, '🦅', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
      }).setOrigin(0.5).setDepth(8).setVisible(false);

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
        maxPestTimer: 7.0,
        border,
        soil,
        plantIcon,
        pestIcon,
        statusText,
        barBg,
        barFill,
      };

      this.plots.push(plot);
      this.updatePlotVisuals(plot);
    }

    // Создание ограждений и табличек покупки для заблокированных зон
    for (const zone of this.zones) {
      this.createZoneSignAndFence(zone);
    }
  }

  private createZoneSignAndFence(zone: FarmZone): void {
    if (zone.unlocked) return;

    // Ограда поперек зоны
    const zonePlots = this.plots.filter((p) => p.zoneId === zone.id);
    if (zonePlots.length === 0) return;

    const fenceY = zone.signY;
    const fence = this.add.rectangle(490, fenceY, 460, 80, 0x000000, 0.35);
    fence.setStrokeStyle(2, 0xf59e0b, 0.6);
    fence.setDepth(10);
    zone.fences.push(fence);

    // Табличка покупки
    const signBox = this.add.container(zone.signX, zone.signY);
    signBox.setDepth(11);

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
      this.showFloatingNotice(zone.signX, zone.signY - 30, `Не хватает ${zone.cost - this.coins} 🪙!`, '#f87171');
      return;
    }

    this.coins -= zone.cost;
    zone.unlocked = true;
    this.updateCoinsHud();

    // Разблокируем грядки зоны
    for (const plot of this.plots) {
      if (plot.zoneId === zone.id) {
        plot.unlocked = true;
        this.updatePlotVisuals(plot);
      }
    }

    // Удаляем ограды и табличку
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

    // Тень
    const shadow = this.add.ellipse(0, 18, 34, 12, 0x000000, 0.4);

    // Тело
    const body = this.add.rectangle(0, 4, 24, 28, 0x2563eb);
    body.setStrokeStyle(2, 0x1d4ed8);

    // Голова
    const head = this.add.circle(0, -14, 12, 0xfde047);

    // Шляпа
    const hatBrim = this.add.ellipse(0, -22, 40, 12, 0xd97706);
    const hatTop = this.add.rectangle(0, -28, 18, 10, 0xb45309);

    this.playerContainer.add([shadow, body, head, hatBrim, hatTop]);

    // Контекстная подсказка действия над персонажем
    this.promptBox = this.add.container(startX, startY - 56);
    this.promptBox.setDepth(30);
    this.promptBox.setVisible(false);

    const promptBg = this.add.rectangle(0, 0, 220, 26, 0x0f172a, 0.92);
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
    // Верхняя панель HUD
    this.hudBg = this.add.rectangle(width / 2, 44, width - 24, 76, 0x0f172a, 0.95);
    this.hudBg.setStrokeStyle(2, 0x334155);
    this.hudBg.setDepth(35);

    // Монеты
    this.coinsText = this.add.text(28, 22, `🪙 Монеты: ${this.coins}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#facc15',
      fontStyle: 'bold',
    }).setDepth(36);

    // Вода в лейке
    this.waterText = this.add.text(28, 48, `💧 Лейка: ${this.water}/${this.getMaxWater()}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#38bdf8',
    }).setDepth(36);

    // Рыночный тренд
    this.marketTrendHudText = this.add.text(210, 24, '📈 Рынок: Обновление...', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#4ade80',
      fontStyle: 'bold',
    }).setDepth(36);

    // Корзина / Инвентарь
    this.inventoryText = this.add.text(210, 48, '🧺 Корзина: 🥕:0  🌾:0  🍓:0  🎃:0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#e2e8f0',
    }).setDepth(36);

    // Кнопка звука
    this.soundButtonText = this.add.text(width - 240, 34, '🔊 Звук', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#94a3b8',
      backgroundColor: '#1e293b',
      padding: { x: 8, y: 5 },
    }).setDepth(36).setInteractive({ useHandCursor: true });

    this.soundButtonText.on('pointerdown', () => {
      this.initAudio();
      this.isMuted = !this.isMuted;
      this.soundButtonText.setText(this.isMuted ? '🔇 Выкл' : '🔊 Звук');
    });

    // Кнопка магазина
    const shopBtn = this.add.text(width - 150, 34, '🛠️ Лавка', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#38bdf8',
      backgroundColor: '#1e293b',
      padding: { x: 8, y: 5 },
    }).setDepth(36).setInteractive({ useHandCursor: true });
    shopBtn.on('pointerdown', () => this.openShopModal());

    // Нижняя полоса управления
    this.add.text(width / 2, this.scale.height - 18, 'WASD / Клик — Идти  |  ПРОБЕЛ / E / Клик рядом — Действие  |  Продажа — на Складе справа', {
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
  }

  private createShopModal(width: number, height: number): void {
    this.shopModal = this.add.container(width / 2, height / 2);
    this.shopModal.setDepth(100);
    this.shopModal.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.75);
    backdrop.setInteractive();

    const panel = this.add.rectangle(0, 0, 520, 380, 0x0f172a);
    panel.setStrokeStyle(3, 0x38bdf8);

    const title = this.add.text(0, -150, '🛠️ ЛАВКА УЛУЧШЕНИЙ ФЕРМЕРА', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Кнопка 1: Лейка
    const waterBtn = this.createShopItemRow(0, -80, 'waterCan');
    // Кнопка 2: Сапоги скорости
    const speedBtn = this.createShopItemRow(0, -10, 'boots');
    // Кнопка 3: Пугало
    const scarecrowBtn = this.createShopItemRow(0, 60, 'scarecrow');

    // Кнопка Закрыть
    const closeBtn = this.add.text(0, 140, 'ЗАКРЫТЬ [ESC]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#334155',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this.closeShopModal());

    this.shopModal.add([backdrop, panel, title, waterBtn, speedBtn, scarecrowBtn, closeBtn]);

    // Клавиша Escape закрывает магазин
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      if (this.isShopOpen) this.closeShopModal();
    });
  }

  private createShopItemRow(x: number, y: number, itemType: 'waterCan' | 'boots' | 'scarecrow'): Phaser.GameObjects.Container {
    const row = this.add.container(x, y);
    row.setName(`row_${itemType}`);

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
    // 1. Лейка
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

    // 2. Сапоги
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

    // 3. Пугало
    const scareRow = this.shopModal.getByName('row_scarecrow') as Phaser.GameObjects.Container;
    const scareLabel = scareRow.getByName('label') as Phaser.GameObjects.Text;
    const scareBtn = scareRow.getByName('buyBtn') as Phaser.GameObjects.Text;

    if (!this.hasScarecrow) {
      scareLabel.setText(`🌾 Пугало от ворон: Снижает набеги птиц на 75%`);
      scareBtn.setText(`Купить (${this.scarecrowCost} 🪙)`).setBackgroundColor(this.coins >= this.scarecrowCost ? '#2563eb' : '#475569');
    } else {
      scareLabel.setText('🌾 Пугало установлено в центре поля (Активно)');
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
    const scY = 480;

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

  // --- ИГРОВОЙ ЦИКЛ ---

  update(_time: number, delta: number): void {
    if (this.isShopOpen) return;
    const seconds = delta / 1000;

    this.updatePlayerMovement(seconds);
    this.updatePlotsGrowth(seconds);
    this.updatePests(seconds);
    this.updateMarket(seconds);
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
      // Игрок управляет клавиатурой — отменяем автоходьбу мыши
      this.targetMovePoint = null;
      this.pendingTargetObject = null;

      const len = Math.hypot(dx, dy);
      this.playerContainer.x += (dx / len) * currentSpeed * seconds;
      this.playerContainer.y += (dy / len) * currentSpeed * seconds;
      this.playerContainer.rotation = Math.sin(Date.now() / 90) * 0.08;
    } else if (this.targetMovePoint) {
      // Click-to-move движение
      const dist = Phaser.Math.Distance.Between(
        this.playerContainer.x,
        this.playerContainer.y,
        this.targetMovePoint.x,
        this.targetMovePoint.y,
      );

      // Проверяем, достигли ли цели или находимся ли уже в радиусе взаимодействия с объектом
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

    // Ограничение границами экрана
    this.playerContainer.x = Phaser.Math.Clamp(this.playerContainer.x, 40, this.scale.width - 40);
    this.playerContainer.y = Phaser.Math.Clamp(this.playerContainer.y, 120, this.scale.height - 40);

    // Подсказка над головой
    this.promptBox.setPosition(this.playerContainer.x, this.playerContainer.y - 54);
  }

  private checkIfNearPendingObject(): boolean {
    if (!this.pendingTargetObject) return false;
    const px = this.playerContainer.x;
    const py = this.playerContainer.y;

    if (this.pendingTargetObject.type === 'well') {
      return Phaser.Math.Distance.Between(px, py, this.wellX, this.wellY) <= this.wellRadius + 20;
    }
    if (this.pendingTargetObject.type === 'barn') {
      return Phaser.Math.Distance.Between(px, py, this.barnX, this.barnY) <= INTERACT_RADIUS + 15;
    }
    if (this.pendingTargetObject.type === 'shop') {
      return Phaser.Math.Distance.Between(px, py, this.shopX, this.shopY) <= INTERACT_RADIUS + 15;
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
    } else if (this.pendingTargetObject.type === 'barn') {
      this.sellAllHarvest();
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
    const interval = this.hasScarecrow ? 6.0 : 2.8;

    if (this.pestCheckTimer >= interval) {
      this.pestCheckTimer = 0;

      // Ищем созревшие грядки
      const ripePlots = this.plots.filter((p) => p.unlocked && p.state === 'ready');
      const spawnChance = this.hasScarecrow ? 0.25 : 0.65;

      if (ripePlots.length > 0 && Math.random() < spawnChance) {
        const victim = Phaser.Utils.Array.GetRandom(ripePlots) as Plot;
        if (victim) {
          victim.state = 'attacked';
          victim.maxPestTimer = 7.0;
          victim.pestTimer = victim.maxPestTimer;
          victim.soil.setFillStyle(0x7f1d1d);
          this.updatePlotVisuals(victim);
          this.playPestAlert();
          this.showFloatingNotice(victim.x, victim.y - 30, '⚠️ ВОРОНА КЛЮЁТ!', '#ef4444');
        }
      }
    }

    // Обработка вороньих атак
    for (const plot of this.plots) {
      if (!plot.unlocked || plot.state !== 'attacked') continue;

      plot.pestTimer -= seconds;
      // Анимация подпрыгивания вороны
      plot.pestIcon.y = plot.y - 28 + Math.sin(Date.now() / 80) * 4;

      // Обновление полоски времени до поедания
      plot.barBg.setVisible(true);
      plot.barFill.setVisible(true);
      const ratio = Phaser.Math.Clamp(plot.pestTimer / plot.maxPestTimer, 0, 1);
      plot.barFill.width = 90 * ratio;
      plot.barFill.setFillStyle(0xef4444);

      plot.statusText.setText(`⚠️ Клюёт: ${plot.pestTimer.toFixed(1)}с`);

      if (plot.pestTimer <= 0) {
        // Ворона съела урожай!
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
      plot.pestIcon.setVisible(false);
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
        plot.pestIcon.setVisible(false);
        plot.statusText.setText(`${info.name} (пусто)`);
        plot.statusText.setColor('#cbd5e1');
        plot.barBg.setVisible(false);
        plot.barFill.setVisible(false);
        break;

      case 'seeded':
        plot.soil.setFillStyle(0x623d1e);
        plot.plantIcon.setText('🌱');
        plot.pestIcon.setVisible(false);
        plot.statusText.setText('Сухо (полей)');
        plot.statusText.setColor('#fbbf24');
        break;

      case 'growing':
        plot.soil.setFillStyle(0x351f0f); // влажная земля
        plot.pestIcon.setVisible(false);
        plot.statusText.setText('Растёт 💧');
        plot.statusText.setColor('#4ade80');
        break;

      case 'ready':
        plot.soil.setFillStyle(0x432616);
        plot.plantIcon.setText(info.icon);
        plot.pestIcon.setVisible(false);
        plot.statusText.setText('Спелый! Собери');
        plot.statusText.setColor('#facc15');
        plot.barBg.setVisible(false);
        plot.barFill.setVisible(false);
        break;

      case 'attacked':
        plot.pestIcon.setVisible(true);
        plot.statusText.setColor('#ef4444');
        break;

      case 'withered':
        plot.soil.setFillStyle(0x27272a);
        plot.plantIcon.setText('🥀');
        plot.pestIcon.setVisible(false);
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
    if (this.marketTimer <= 0) {
      this.marketTimer = MARKET_REFRESH_INTERVAL;
      this.refreshMarketPrices(false);
    }
  }

  private refreshMarketPrices(silent = false): void {
    const cropKeys: CropType[] = ['carrot', 'wheat', 'strawberry', 'pumpkin'];
    // Выбираем горячий ресурс со сверх-спросом
    this.hotCrop = Phaser.Utils.Array.GetRandom(cropKeys) as CropType;

    for (const key of cropKeys) {
      const info = CROPS[key];
      // Случайная вариация цены от min до max
      let price = Phaser.Math.Between(info.minPrice, info.maxPrice);
      if (key === this.hotCrop) {
        price = Math.round(price * 1.5); // +50% к цене горячего ресурса
      }
      this.marketPrices[key] = price;
    }

    const hotInfo = CROPS[this.hotCrop];
    this.marketTrendText = `🔥 Бум на ${hotInfo.name}: ${this.marketPrices[this.hotCrop]} 🪙!`;
    this.marketTrendHudText.setText(`📈 ${this.marketTrendText} (${Math.round(this.marketTimer)}с)`);

    // Обновляем доску цен у амбара
    this.barnPriceBoardText.setText(
      `🥕: ${this.marketPrices.carrot}🪙  🌾: ${this.marketPrices.wheat}🪙\n🍓: ${this.marketPrices.strawberry}🪙  🎃: ${this.marketPrices.pumpkin}🪙`,
    );

    if (!silent) {
      this.showFloatingNotice(this.barnX, this.barnY - 40, `📈 Цены на рынке обновились!`, '#4ade80');
    }
  }

  private sellAllHarvest(): void {
    const totalCount =
      this.inventory.carrot +
      this.inventory.wheat +
      this.inventory.strawberry +
      this.inventory.pumpkin;

    if (totalCount === 0) {
      this.playErrorSound();
      this.showFloatingNotice(this.barnX, this.barnY - 40, 'Корзина пуста! Собери урожай', '#f87171');
      return;
    }

    let revenue = 0;
    revenue += this.inventory.carrot * this.marketPrices.carrot;
    revenue += this.inventory.wheat * this.marketPrices.wheat;
    revenue += this.inventory.strawberry * this.marketPrices.strawberry;
    revenue += this.inventory.pumpkin * this.marketPrices.pumpkin;

    this.coins += revenue;
    this.inventory = { carrot: 0, wheat: 0, strawberry: 0, pumpkin: 0 };

    this.updateCoinsHud();
    this.updateInventoryHud();
    this.playSaleSound();
    this.showFloatingNotice(this.barnX, this.barnY - 40, `💰 Продано на +${revenue} 🪙!`, '#facc15');
  }

  // --- ИНТЕРАКЦИЯ И КЛИКИ ---

  private handlePointerClick(pointer: Phaser.Input.Pointer): void {
    const clickedX = pointer.x;
    const clickedY = pointer.y;

    // Не обрабатываем клики по верхней панели HUD
    if (clickedY <= 85) return;

    const px = this.playerContainer.x;
    const py = this.playerContainer.y;

    // 1. Проверяем клик по колодцу
    if (Phaser.Math.Distance.Between(clickedX, clickedY, this.wellX, this.wellY) <= this.wellRadius + 15) {
      if (Phaser.Math.Distance.Between(px, py, this.wellX, this.wellY) <= this.wellRadius + 20) {
        this.fillWater();
      } else {
        // Игрок далеко — бежим к колодцу!
        this.targetMovePoint = { x: this.wellX + 45, y: this.wellY };
        this.pendingTargetObject = { type: 'well' };
      }
      return;
    }

    // 2. Проверяем клик по амбару (Складу)
    if (Phaser.Math.Distance.Between(clickedX, clickedY, this.barnX, this.barnY) <= 65) {
      if (Phaser.Math.Distance.Between(px, py, this.barnX, this.barnY) <= INTERACT_RADIUS + 15) {
        this.sellAllHarvest();
      } else {
        this.targetMovePoint = { x: this.barnX - 55, y: this.barnY };
        this.pendingTargetObject = { type: 'barn' };
      }
      return;
    }

    // 3. Проверяем клик по лавке улучшений
    if (Phaser.Math.Distance.Between(clickedX, clickedY, this.shopX, this.shopY) <= 65) {
      if (Phaser.Math.Distance.Between(px, py, this.shopX, this.shopY) <= INTERACT_RADIUS + 15) {
        this.openShopModal();
      } else {
        this.targetMovePoint = { x: this.shopX - 55, y: this.shopY };
        this.pendingTargetObject = { type: 'shop' };
      }
      return;
    }

    // 4. Проверяем клик по грядкам
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
          // Игрок уже рядом — взаимодействуем!
          this.interactWithPlot(plot);
        } else {
          // Игрок далеко — бежим к грядке!
          this.targetMovePoint = { x: plot.x, y: plot.y };
          this.pendingTargetObject = { type: 'plot', obj: plot };
        }
        return;
      }
    }

    // 5. Иначе обычный клик по земле — идём в эту точку!
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

    // Амбар (Рынок)
    if (Phaser.Math.Distance.Between(px, py, this.barnX, this.barnY) <= INTERACT_RADIUS + 15) {
      const count =
        this.inventory.carrot +
        this.inventory.wheat +
        this.inventory.strawberry +
        this.inventory.pumpkin;
      if (count > 0) {
        this.showPrompt(`[ПРОБЕЛ] Продать урожай (${count} шт.)`);
      } else {
        this.showPrompt('🏪 Склад: В корзине пусто');
      }
      return;
    }

    // Лавка улучшений
    if (Phaser.Math.Distance.Between(px, py, this.shopX, this.shopY) <= INTERACT_RADIUS + 15) {
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
        this.showPrompt('⚠️ [ПРОБЕЛ] СПУГНУТЬ ВОРОНУ!');
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

    // Колодец
    if (Phaser.Math.Distance.Between(px, py, this.wellX, this.wellY) <= this.wellRadius + 20) {
      this.fillWater();
      return;
    }

    // Амбар
    if (Phaser.Math.Distance.Between(px, py, this.barnX, this.barnY) <= INTERACT_RADIUS + 15) {
      this.sellAllHarvest();
      return;
    }

    // Лавка
    if (Phaser.Math.Distance.Between(px, py, this.shopX, this.shopY) <= INTERACT_RADIUS + 15) {
      this.openShopModal();
      return;
    }

    // Покупка зон
    for (const zone of this.zones) {
      if (!zone.unlocked && Phaser.Math.Distance.Between(px, py, zone.signX, zone.signY) <= INTERACT_RADIUS) {
        this.tryBuyZone(zone);
        return;
      }
    }

    // Грядка
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
        // Добавляем в инвентарь!
        this.inventory[plot.cropType] += 1;
        this.updateInventoryHud();
        plot.state = 'empty';
        plot.growthProgress = 0;
        this.updatePlotVisuals(plot);
        this.playHarvest();
        this.showFloatingNotice(plot.x, plot.y - 25, `+1 ${info.icon} в корзину!`, '#facc15');
        break;

      case 'attacked':
        // Спугиваем ворону
        plot.state = 'ready';
        plot.pestTimer = 0;
        this.updatePlotVisuals(plot);
        this.playScaredPest();
        this.showFloatingNotice(plot.x, plot.y - 25, '🦅 Спугнул ворону!', '#fbbf24');
        break;

      case 'withered':
        // Расчистка
        plot.state = 'empty';
        plot.growthProgress = 0;
        this.updatePlotVisuals(plot);
        this.playPlant();
        this.showFloatingNotice(plot.x, plot.y - 25, '🧹 Расчищено', '#cbd5e1');
        break;

      case 'growing':
        this.showFloatingNotice(plot.x, plot.y - 25, 'Ещё зреет...', '#94a3b8');
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
    }).setOrigin(0.5).setDepth(45);

    this.tweens.add({
      targets: notice,
      y: y - 35,
      alpha: 0,
      duration: 1000,
      ease: 'Power1',
      onComplete: () => notice.destroy(),
    });
  }

  // --- ЗВУКОВАЯ ПОДСИСТЕМА (Web Audio API) ---

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
      // Игнорируем блокировку
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
