import Phaser from 'phaser';
import {
  CropType,
  CropInfo,
  CROPS,
  PlotState,
  Plot,
  FarmZone,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  WORLD_WIDTH,
  PHASE1_MAX_X,
  INTERACT_RADIUS,
  INITIAL_COINS,
  INITIAL_WATER,
  WATER_CAPACITIES,
  WATER_UPGRADE_COSTS,
  SPEED_VALUES,
  SPEED_UPGRADE_COSTS,
  SCARECROW_COST,
  SPRINKLER_COSTS,
  SPRINKLER_INTERVAL,
  SPRINKLER_POSITIONS,
  WORKER_COST,
  MARKET_REFRESH_INTERVAL,
  FISH_SPAWN_INTERVAL,
  PEST_CHECK_INTERVAL_DEFAULT,
  PEST_CHECK_INTERVAL_SCARECROW,
  PEST_MAX_TIMER,
  PHASE1_LOCATIONS,
  PHASE2_CONFIG,
} from './constants';
import { Phase1 } from './phases/Phase1';
import { Phase2 } from './phases/Phase2';

export class GameScene extends Phaser.Scene {
  // Менеджеры фаз (Фаза 1 и Фаза 2)
  public phase1!: Phase1;
  public phase2!: Phase2;

  // Локации (геттеры из отдельного файла констант)
  get wellX() { return PHASE1_LOCATIONS.wellX; }
  get wellY() { return PHASE1_LOCATIONS.wellY; }
  get wellRadius() { return PHASE1_LOCATIONS.wellRadius; }
  get pondX() { return PHASE1_LOCATIONS.pondX; }
  get pondY() { return PHASE1_LOCATIONS.pondY; }
  get barnX() { return PHASE1_LOCATIONS.barnX; }
  get barnY() { return PHASE1_LOCATIONS.barnY; }
  get shopX() { return PHASE1_LOCATIONS.shopX; }
  get shopY() { return PHASE1_LOCATIONS.shopY; }
  get phase2GateX() { return PHASE2_CONFIG.gateX; }
  get phase2GateY() { return PHASE2_CONFIG.gateY; }
  get phase2WellX() { return PHASE2_CONFIG.wellX; }
  get phase2WellY() { return PHASE2_CONFIG.wellY; }
  get phase2WellRadius() { return PHASE2_CONFIG.wellRadius; }
  get fishContainer() { return this.phase1?.fishContainer; }
  get phase2Unlocked() { return this.phase2 ? this.phase2.isUnlocked() : false; }
  get isCinematicActive() { return this.phase2 ? this.phase2.isCinematicActive() : false; }

  // Персонаж
  private playerContainer!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private actionKeys!: Phaser.Input.Keyboard.Key[];
  private targetMovePoint: { x: number; y: number } | null = null;
  private pendingTargetObject: { type: 'well' | 'barn' | 'shop' | 'pond' | 'zoneSign' | 'plot' | 'phase2Gate' | 'phase2Well'; obj?: any } | null = null;

  // Ресурсы
  private coins = INITIAL_COINS;
  private water = INITIAL_WATER;
  private inventory: Record<CropType, number> = {
    carrot: 0,
    wheat: 0,
    strawberry: 0,
    pumpkin: 0,
    corn: 0,
    watermelon: 0,
  };

  // Прокачка
  private waterCanLevel = 1;
  private waterCapacities = WATER_CAPACITIES;
  private waterUpgradeCosts = WATER_UPGRADE_COSTS;

  private speedLevel = 1;
  private speedValues = SPEED_VALUES;
  private speedUpgradeCosts = SPEED_UPGRADE_COSTS;

  private hasScarecrow = false;
  private scarecrowCost = SCARECROW_COST;
  private scarecrowVisual: Phaser.GameObjects.Container | null = null;

  // Автоматизация: Орошение (Спринклеры)
  private sprinklerLevel = 0; // 0..6
  private sprinklerCosts = SPRINKLER_COSTS;
  private sprinklerTimer = 0;
  private sprinklerVisuals: Phaser.GameObjects.Container[] = [];

  // Автоматизация: Наёмный помощник (Фермер-подмастерье)
  private hasWorker = false;
  private workerCost = WORKER_COST;
  private workerContainer: Phaser.GameObjects.Container | null = null;
  private workerStamina = 100;
  private workerState: 'idle' | 'moving' | 'working' | 'tired' = 'idle';
  private workerTargetPlot: Plot | null = null;
  private workerActionTimer = 0;
  private workerBarFill: Phaser.GameObjects.Rectangle | null = null;
  private workerStatusText: Phaser.GameObjects.Text | null = null;

  // Событие золотой рыбы
  private isGoldenFishActive = false;
  private fishTimer = 35; // первый раз через 35 сек

  // Зоны фермы и грядки
  private zones: FarmZone[] = [];
  private plots: Plot[] = [];

  // Рыночные цены
  private marketPrices: Record<CropType, number> = {
    carrot: CROPS.carrot.basePrice,
    wheat: CROPS.wheat.basePrice,
    strawberry: CROPS.strawberry.basePrice,
    pumpkin: CROPS.pumpkin.basePrice,
    corn: CROPS.corn.basePrice,
    watermelon: CROPS.watermelon.basePrice,
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

  // Мини-игра отбивания крыс (Фаза 2)
  private ratMinigameModal!: Phaser.GameObjects.Container;
  private isRatMinigameActive = false;
  private ratTargetPlot: Plot | null = null;
  private ratSliderContainer!: Phaser.GameObjects.Container;
  private ratSliderPos = 0;
  private ratSliderSpeed = 4.6;

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

    this.phase1 = new Phase1(this);
    this.phase2 = new Phase2(this);

    // До открытия ворот Фазы 2 камера стабильно охватывает весь первый участок (960x640)
    this.cameras.main.setBounds(0, 0, SCREEN_WIDTH, height);
    this.cameras.main.setScroll(0, 0);

    this.phase1.createLandscape(WORLD_WIDTH, height);
    this.phase1.createWell(() => this.fillWater());
    this.phase1.createPond(() => this.startFishing());
    this.phase1.createBarnAndMarketBoard(() => this.openMarketModal());
    this.marketBoardTexts = this.phase1.marketBoardTexts;
    this.marketBoardTimerText = this.phase1.marketBoardTimerText;
    this.phase1.createWorkshopShop(() => this.openShopModal());

    this.phase2.createLandscape(() => this.fillWater());
    this.phase2.createGate(() => this.tryUnlockPhase2());

    const p1 = this.phase1.createZonesAndPlots(
      (plot) => this.handlePlotClick(plot),
      (zone) => this.tryBuyZone(zone),
    );
    const p2 = this.phase2.createZonesAndPlots(
      (plot) => this.handlePlotClick(plot),
    );

    this.zones = [...p1.zones, ...p2.zones];
    this.plots = [...p1.plots, ...p2.plots];

    this.createPlayer();

    this.createHUD(width);
    this.createControls();

    // Модальные окна
    this.createMarketModal(width, height);
    this.createShopModal(width, height);
    this.createFishingMinigameModal(width, height);
    this.createCrowMinigameModal(width, height);
    this.createRatMinigameModal(width, height);
    this.createPauseModal(width, height);

    this.refreshMarketPrices(true);

    // Клик мышью
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.initAudio();
      if (this.isPaused || this.isShopOpen || this.isMarketOpen || this.isFishingActive || this.isCrowMinigameActive || this.isRatMinigameActive || this.isCinematicActive) return;
      this.handlePointerClick(pointer);
    });
  }

  private resetState(): void {
    this.isPaused = false;
    this.coins = INITIAL_COINS;
    this.waterCanLevel = 1;
    this.water = this.getMaxWater();
    this.speedLevel = 1;
    this.hasScarecrow = false;
    this.inventory = { carrot: 0, wheat: 0, strawberry: 0, pumpkin: 0, corn: 0, watermelon: 0 };
    this.targetMovePoint = null;
    this.pendingTargetObject = null;
    this.plots = [];
    this.zones = [];
    this.isShopOpen = false;
    this.isMarketOpen = false;
    this.isFishingActive = false;
    this.isCrowMinigameActive = false;
    this.isRatMinigameActive = false;
    this.ratTargetPlot = null;
    this.isGoldenFishActive = false;
    this.fishTimer = 40;
    this.sprinklerLevel = 0;
    this.sprinklerTimer = 0;
    this.sprinklerVisuals.forEach((v) => v.destroy());
    this.sprinklerVisuals = [];
    this.hasWorker = false;
    this.workerStamina = 100;
    this.workerState = 'idle';
    this.workerTargetPlot = null;
    if (this.workerContainer) {
      this.workerContainer.destroy();
      this.workerContainer = null;
    }
  }

  private getMaxWater(): number {
    return this.waterCapacities[this.waterCanLevel - 1] || 3;
  }

  private getPlayerSpeed(): number {
    return this.speedValues[this.speedLevel - 1] || 240;
  }

  private handlePlotClick(plot: Plot): void {
    if (this.isPaused || this.isCinematicActive) return;
    const px = this.playerContainer.x;
    const py = this.playerContainer.y;
    const distToPlayer = Phaser.Math.Distance.Between(px, py, plot.x, plot.y);
    if (distToPlayer <= INTERACT_RADIUS) {
      this.interactWithPlot(plot);
    } else {
      this.targetMovePoint = { x: plot.x, y: plot.y };
      this.pendingTargetObject = { type: 'plot', obj: plot };
    }
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

    // Ключевое условие: покупка Клубники (Zone 3) открывает Фазу 2!
    if (zone.cropType === 'strawberry' || zone.id === 3) {
      this.playVictoryFanfare();
      this.phase2.onStrawberryUnlocked(() => {
        this.showFloatingNotice(this.playerContainer.x, this.playerContainer.y - 50, '🍓 Клубника открыта! Ворота восточных земель ждут (1 🪙)', '#facc15');
      });
    }
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
    hudBg.setDepth(35).setScrollFactor(0);

    this.coinsText = this.add.text(28, 22, `🪙 Монеты: ${this.coins}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#facc15',
      fontStyle: 'bold',
    }).setDepth(36).setScrollFactor(0);

    this.waterText = this.add.text(28, 48, `💧 Лейка: ${this.water}/${this.getMaxWater()}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#38bdf8',
    }).setDepth(36).setScrollFactor(0);

    this.marketTrendHudText = this.add.text(190, 22, '📈 Рынок: загрузка цен...', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#4ade80',
      fontStyle: 'bold',
    }).setDepth(36).setScrollFactor(0);

    this.inventoryText = this.add.text(190, 48, '🧺 Корзина: 🥕:0 🌾:0 🍓:0 🎃:0 🌽:0 🍉:0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#e2e8f0',
    }).setDepth(36).setScrollFactor(0);

    // Кнопка паузы
    this.pauseButtonText = this.add.text(width - 440, 34, '⏸️ Пауза [P]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#facc15',
      backgroundColor: '#1e293b',
      padding: { x: 8, y: 5 },
    }).setDepth(36).setInteractive({ useHandCursor: true }).setScrollFactor(0);

    this.pauseButtonText.on('pointerdown', () => this.togglePause());

    // Кнопка музыки в стиле Minecraft C418
    this.musicButtonText = this.add.text(width - 325, 34, '🎵 Музыка: Вкл', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#a7f3d0',
      backgroundColor: '#1e293b',
      padding: { x: 8, y: 5 },
    }).setDepth(36).setInteractive({ useHandCursor: true }).setScrollFactor(0);

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
    }).setDepth(36).setInteractive({ useHandCursor: true }).setScrollFactor(0);

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
    }).setDepth(36).setInteractive({ useHandCursor: true }).setScrollFactor(0);
    shopBtn.on('pointerdown', () => this.openShopModal());

    this.add.text(width / 2, this.scale.height - 18, 'WASD / Клик — Идти  |  ПРОБЕЛ — Действие  |  P — Пауза  |  Фаза 2: Ворота справа (1 🪙)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#94a3b8',
      backgroundColor: '#0f172acc',
      padding: { x: 10, y: 3 },
    }).setOrigin(0.5).setDepth(35).setScrollFactor(0);
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

    // Продажа в окне рынка по Пробелу / Enter
    const handleMarketSell = () => {
      if (this.isMarketOpen) {
        this.sellAllHarvest();
        this.closeMarketModal();
      }
    };
    spaceKey.on('down', handleMarketSell);
    enterKey.on('down', handleMarketSell);

    // Клавиши 1-5 для мгновенной покупки в Лавке улучшений
    const shopKeys = [
      { code: Phaser.Input.Keyboard.KeyCodes.ONE, type: 'waterCan' as const },
      { code: Phaser.Input.Keyboard.KeyCodes.TWO, type: 'boots' as const },
      { code: Phaser.Input.Keyboard.KeyCodes.THREE, type: 'scarecrow' as const },
      { code: Phaser.Input.Keyboard.KeyCodes.FOUR, type: 'sprinkler' as const },
      { code: Phaser.Input.Keyboard.KeyCodes.FIVE, type: 'worker' as const },
    ];
    for (const sk of shopKeys) {
      this.input.keyboard.addKey(sk.code).on('down', () => {
        if (this.isShopOpen) {
          this.buyShopItem(sk.type);
        }
      });
    }

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

    const backdrop = this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.75).setInteractive();
    const panel = this.add.rectangle(0, 0, 520, 460, 0x0f172a);
    panel.setStrokeStyle(3, 0xfacc15);

    const title = this.add.text(0, -195, '🏪 РЫНОЧНАЯ БИРЖА СКЛАДА', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const desc = this.add.text(0, -165, 'Котировки цен меняются каждые 25 сек. Продавайте на пике спроса!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    const listContainer = this.add.container(0, -130).setName('marketList');

    const sellAllBtnBg = this.add.rectangle(0, 140, 380, 44, 0x16a34a)
      .setInteractive({ useHandCursor: true })
      .setName('sellAllBtnBg');
    sellAllBtnBg.setStrokeStyle(2, 0x4ade80);

    const sellAllBtn = this.add.text(0, 140, 'ПРОДАТЬ ВЕСЬ УРОЖАЙ [ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setName('sellAllBtn').setInteractive({ useHandCursor: true });

    const handleSell = () => {
      this.sellAllHarvest();
      this.closeMarketModal();
    };

    sellAllBtnBg.on('pointerdown', handleSell);
    sellAllBtn.on('pointerdown', handleSell);

    const closeBtnBg = this.add.rectangle(0, 192, 180, 32, 0x334155).setInteractive({ useHandCursor: true });
    const closeBtn = this.add.text(0, 192, 'ЗАКРЫТЬ [ESC]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#e2e8f0',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtnBg.on('pointerdown', () => this.closeMarketModal());
    closeBtn.on('pointerdown', () => this.closeMarketModal());

    this.marketModal.add([backdrop, panel, title, desc, listContainer, sellAllBtnBg, sellAllBtn, closeBtnBg, closeBtn]);
  }

  private openMarketModal(): void {
    this.isMarketOpen = true;
    const cam = this.cameras.main;
    this.marketModal.setPosition(cam.worldView.centerX, cam.worldView.centerY);
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

    const crops: CropType[] = ['carrot', 'wheat', 'strawberry', 'pumpkin', 'corn', 'watermelon'];
    let totalValue = 0;

    crops.forEach((key, idx) => {
      const info = CROPS[key];
      const count = this.inventory[key];
      const price = this.marketPrices[key];
      const sum = count * price;
      totalValue += sum;

      const isHot = key === this.hotCrop;
      const y = idx * 40;

      const rowBg = this.add.rectangle(0, y, 450, 34, isHot ? 0x451a03 : 0x1e293b);
      rowBg.setStrokeStyle(1, isHot ? 0xf59e0b : 0x334155);

      const label = this.add.text(-210, y, `${info.icon} ${info.name}: ${price} 🪙/шт ${isHot ? '🔥 БУМ СПРОСА!' : ''}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: isHot ? '#fef08a' : '#f8fafc',
        fontStyle: isHot ? 'bold' : 'normal',
      }).setOrigin(0, 0.5);

      const rightInfo = this.add.text(210, y, `В корзине: ${count} шт = ${sum} 🪙`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: sum > 0 ? '#4ade80' : '#94a3b8',
        fontStyle: 'bold',
      }).setOrigin(1, 0.5);

      list.add([rowBg, label, rightInfo]);
    });

    const sellBtn = this.marketModal.getByName('sellAllBtn') as Phaser.GameObjects.Text;
    const sellBtnBg = this.marketModal.getByName('sellAllBtnBg') as Phaser.GameObjects.Rectangle;
    if (sellBtn) {
      sellBtn.setText(`ПРОДАТЬ ВЕСЬ УРОЖАЙ (+${totalValue} 🪙) [ПРОБЕЛ]`);
    }
    if (sellBtnBg) {
      sellBtnBg.setFillStyle(totalValue > 0 ? 0x16a34a : 0x334155);
    }
  }

  // --- МИНИ-ИГРА "ОТБИВАНИЕ ВОРОН" (ФАЗА 1) ---

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
    const cam = this.cameras.main;
    this.crowMinigameModal.setPosition(cam.worldView.centerX, cam.worldView.centerY);
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

  // --- МИНИ-ИГРА "ОТБИВАНИЕ КРЫС" (ФАЗА 2) ---

  private createRatMinigameModal(width: number, height: number): void {
    this.ratMinigameModal = this.add.container(width / 2, height / 2).setDepth(120).setVisible(false);

    const bg = this.add.rectangle(0, 0, 440, 250, 0x0f172a, 0.95);
    bg.setStrokeStyle(3, 0xf97316);

    const title = this.add.text(0, -90, '🐀 НАПАДЕНИЕ ПОЛЕВОЙ КРЫСЫ! 🐀', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '19px',
      color: '#f97316',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const instr = this.add.text(0, -58, 'Крыса грызёт урожай на новом участке! Поймайте бегунок в ЗЕЛЕНУЮ ЗОНУ,\nчтобы спугнуть её и отобрать украденные монеты!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#cbd5e1',
      align: 'center',
    }).setOrigin(0.5);

    // Шкала
    const track = this.add.rectangle(0, 8, 320, 24, 0x1e293b);
    track.setStrokeStyle(2, 0x475569);

    // Зеленая зона успеха
    const greenZone = this.add.rectangle(0, 8, 70, 24, 0x22c55e);

    // Бегунок крысы
    this.ratSliderContainer = this.add.container(0, 8);
    const ratSliderIcon = this.add.text(0, 0, '🐀💨', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
    }).setOrigin(0.5);
    this.ratSliderContainer.add(ratSliderIcon);

    const hitBtn = this.add.text(0, 68, '🪤 СХВАТИТЬ КРЫСУ! [ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#ea580c',
      padding: { x: 22, y: 8 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    hitBtn.on('pointerdown', () => this.resolveRatHit());

    this.ratMinigameModal.add([bg, title, instr, track, greenZone, this.ratSliderContainer, hitBtn]);
  }

  private startRatMinigame(plot: Plot): void {
    this.isRatMinigameActive = true;
    this.ratTargetPlot = plot;
    this.ratSliderPos = -140;
    const cam = this.cameras.main;
    this.ratMinigameModal.setPosition(cam.worldView.centerX, cam.worldView.centerY);
    this.ratMinigameModal.setVisible(true);
  }

  private resolveRatHit(): void {
    if (!this.isRatMinigameActive || !this.ratTargetPlot) return;

    const success = Math.abs(this.ratSliderPos) <= 38;
    this.isRatMinigameActive = false;
    this.ratMinigameModal.setVisible(false);

    if (success) {
      const bonusCoins = Phaser.Math.Between(35, 65);
      this.coins += bonusCoins;
      this.updateCoinsHud();

      this.ratTargetPlot.state = 'ready';
      this.ratTargetPlot.pestTimer = 0;
      this.updatePlotVisuals(this.ratTargetPlot);

      this.playScaredRat();
      this.showFloatingNotice(this.ratTargetPlot.x, this.ratTargetPlot.y - 35, `🐀 КРЫСА С ПИСКОМ СБЕЖАЛА!\n+${bonusCoins} 🪙 добычи!`, '#facc15');
    } else {
      this.playErrorSound();
      this.showFloatingNotice(this.ratTargetPlot.x, this.ratTargetPlot.y - 35, 'Мимо! Крыса увернулась и грызёт дальше!', '#ef4444');
      this.ratTargetPlot.pestTimer -= 1.8;
    }
    this.ratTargetPlot = null;
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
    const cam = this.cameras.main;
    this.fishingModal.setPosition(cam.worldView.centerX, cam.worldView.centerY);
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

    const backdrop = this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.75).setInteractive();
    const panel = this.add.rectangle(0, 0, 540, 500, 0x0f172a);
    panel.setStrokeStyle(3, 0x38bdf8);

    const title = this.add.text(0, -215, '🛠️ ЛАВКА УЛУЧШЕНИЙ И АВТОМАТИЗАЦИИ', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const sub = this.add.text(0, -188, 'Покупка: Кликните кнопку мыши или нажмите клавиши [1 - 5]:', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    const waterRow = this.createShopItemRow(0, -135, 'waterCan', '[1]');
    const speedRow = this.createShopItemRow(0, -75, 'boots', '[2]');
    const scarecrowRow = this.createShopItemRow(0, -15, 'scarecrow', '[3]');
    const sprinklerRow = this.createShopItemRow(0, 45, 'sprinkler', '[4]');
    const workerRow = this.createShopItemRow(0, 105, 'worker', '[5]');

    const closeBtnBg = this.add.rectangle(0, 185, 180, 36, 0x334155).setInteractive({ useHandCursor: true });
    const closeBtn = this.add.text(0, 185, 'ЗАКРЫТЬ [ESC]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtnBg.on('pointerdown', () => this.closeShopModal());
    closeBtn.on('pointerdown', () => this.closeShopModal());

    this.shopModal.add([backdrop, panel, title, sub, waterRow, speedRow, scarecrowRow, sprinklerRow, workerRow, closeBtnBg, closeBtn]);
  }

  private createShopItemRow(x: number, y: number, itemType: 'waterCan' | 'boots' | 'scarecrow' | 'sprinkler' | 'worker', keyHint: string): Phaser.GameObjects.Container {
    const row = this.add.container(x, y).setName(`row_${itemType}`);
    const bg = this.add.rectangle(0, 0, 490, 52, 0x1e293b);
    bg.setStrokeStyle(2, 0x475569);

    const text = this.add.text(-230, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#f8fafc',
    }).setOrigin(0, 0.5).setName('label');

    const btnBg = this.add.rectangle(170, 0, 130, 34, 0x2563eb)
      .setInteractive({ useHandCursor: true })
      .setName('buyBtnBg');
    btnBg.setStrokeStyle(1, 0x60a5fa);

    const btn = this.add.text(170, 0, `${keyHint} КУПИТЬ`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setName('buyBtn').setInteractive({ useHandCursor: true });

    const handleBuy = () => this.buyShopItem(itemType);
    btnBg.on('pointerdown', handleBuy);
    btn.on('pointerdown', handleBuy);

    row.add([bg, text, btnBg, btn]);
    return row;
  }

  private openShopModal(): void {
    this.isShopOpen = true;
    const cam = this.cameras.main;
    this.shopModal.setPosition(cam.worldView.centerX, cam.worldView.centerY);
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
    const waterBtnBg = waterRow.getByName('buyBtnBg') as Phaser.GameObjects.Rectangle;

    if (this.waterCanLevel < this.waterCapacities.length) {
      const nextCap = this.waterCapacities[this.waterCanLevel];
      const cost = this.waterUpgradeCosts[this.waterCanLevel - 1];
      waterLabel.setText(`💧 Лейка (Ур. ${this.waterCanLevel}➔${this.waterCanLevel + 1}): Вместимость ${nextCap}`);
      const canAfford = this.coins >= cost;
      waterBtn.setText(`[1] ${cost} 🪙`);
      waterBtnBg.setFillStyle(canAfford ? 0x2563eb : 0x475569);
    } else {
      waterLabel.setText(`💧 Лейка: МАКСИМУМ (${this.getMaxWater()} воды)`);
      waterBtn.setText('МАКС');
      waterBtnBg.setFillStyle(0x334155);
    }

    // 2. Сапоги
    const speedRow = this.shopModal.getByName('row_boots') as Phaser.GameObjects.Container;
    const speedLabel = speedRow.getByName('label') as Phaser.GameObjects.Text;
    const speedBtn = speedRow.getByName('buyBtn') as Phaser.GameObjects.Text;
    const speedBtnBg = speedRow.getByName('buyBtnBg') as Phaser.GameObjects.Rectangle;

    if (this.speedLevel < this.speedValues.length) {
      const cost = this.speedUpgradeCosts[this.speedLevel - 1];
      speedLabel.setText(`👟 Сапоги скорости (Ур. ${this.speedLevel}➔${this.speedLevel + 1}): +25% бега`);
      const canAfford = this.coins >= cost;
      speedBtn.setText(`[2] ${cost} 🪙`);
      speedBtnBg.setFillStyle(canAfford ? 0x2563eb : 0x475569);
    } else {
      speedLabel.setText('👟 Сапоги скорости: МАКСИМАЛЬНЫЙ УРОВЕНЬ');
      speedBtn.setText('МАКС');
      speedBtnBg.setFillStyle(0x334155);
    }

    // 3. Пугало
    const scareRow = this.shopModal.getByName('row_scarecrow') as Phaser.GameObjects.Container;
    const scareLabel = scareRow.getByName('label') as Phaser.GameObjects.Text;
    const scareBtn = scareRow.getByName('buyBtn') as Phaser.GameObjects.Text;
    const scareBtnBg = scareRow.getByName('buyBtnBg') as Phaser.GameObjects.Rectangle;

    if (!this.hasScarecrow) {
      scareLabel.setText(`🌾 Пугало: Снижает набеги ворон на 75%`);
      const canAfford = this.coins >= this.scarecrowCost;
      scareBtn.setText(`[3] ${this.scarecrowCost} 🪙`);
      scareBtnBg.setFillStyle(canAfford ? 0x2563eb : 0x475569);
    } else {
      scareLabel.setText('🌾 Пугало установлено на поле (Активно)');
      scareBtn.setText('КУПЛЕНО');
      scareBtnBg.setFillStyle(0x334155);
    }

    // 4. Орошение (Спринклеры)
    const sprinklerRow = this.shopModal.getByName('row_sprinkler') as Phaser.GameObjects.Container;
    const sprinklerLabel = sprinklerRow.getByName('label') as Phaser.GameObjects.Text;
    const sprinklerBtn = sprinklerRow.getByName('buyBtn') as Phaser.GameObjects.Text;
    const sprinklerBtnBg = sprinklerRow.getByName('buyBtnBg') as Phaser.GameObjects.Rectangle;

    if (this.sprinklerLevel < this.sprinklerCosts.length) {
      const cost = this.sprinklerCosts[this.sprinklerLevel];
      const zoneName = this.zones[this.sprinklerLevel]?.name || `Зона ${this.sprinklerLevel + 1}`;
      sprinklerLabel.setText(`💦 Спринклер (${zoneName}): Авто-полив`);
      const canAfford = this.coins >= cost;
      sprinklerBtn.setText(`[4] ${cost} 🪙`);
      sprinklerBtnBg.setFillStyle(canAfford ? 0x2563eb : 0x475569);
    } else {
      sprinklerLabel.setText('💦 Спринклеры установлены на всех полях');
      sprinklerBtn.setText('МАКС');
      sprinklerBtnBg.setFillStyle(0x334155);
    }

    // 5. Наёмный помощник
    const workerRow = this.shopModal.getByName('row_worker') as Phaser.GameObjects.Container;
    const workerLabel = workerRow.getByName('label') as Phaser.GameObjects.Text;
    const workerBtn = workerRow.getByName('buyBtn') as Phaser.GameObjects.Text;
    const workerBtnBg = workerRow.getByName('buyBtnBg') as Phaser.GameObjects.Rectangle;

    if (!this.hasWorker) {
      workerLabel.setText(`🧑‍🌾 Нанять помощника: Авто-сбор`);
      const canAfford = this.coins >= this.workerCost;
      workerBtn.setText(`[5] ${this.workerCost} 🪙`);
      workerBtnBg.setFillStyle(canAfford ? 0x2563eb : 0x475569);
    } else {
      workerLabel.setText(`🧑‍🌾 Помощник нанят (Бодрость: ${Math.round(this.workerStamina)}%)`);
      workerBtn.setText('НАНЯТ');
      workerBtnBg.setFillStyle(0x334155);
    }
  }

  private buyShopItem(itemType: 'waterCan' | 'boots' | 'scarecrow' | 'sprinkler' | 'worker'): void {
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
    } else if (itemType === 'sprinkler') {
      if (this.sprinklerLevel >= this.sprinklerCosts.length) return;
      const cost = this.sprinklerCosts[this.sprinklerLevel];
      if (this.coins < cost) {
        this.playErrorSound();
        return;
      }
      this.coins -= cost;
      this.sprinklerLevel++;
      this.spawnSprinklerVisual(this.sprinklerLevel);
      this.playPowerup();
      this.showFloatingNotice(this.playerContainer.x, this.playerContainer.y - 30, `💦 Спринклер установлен! Авто-полив активен!`, '#38bdf8');
    } else if (itemType === 'worker') {
      if (this.hasWorker) return;
      if (this.coins < this.workerCost) {
        this.playErrorSound();
        return;
      }
      this.coins -= this.workerCost;
      this.hasWorker = true;
      this.spawnWorkerVisual();
      this.playPowerup();
      this.showFloatingNotice(this.playerContainer.x, this.playerContainer.y - 30, `🧑‍🌾 Помощник нанят и готов к труду!`, '#4ade80');
    }

    this.updateCoinsHud();
    this.updateWaterHud();
    this.updateShopModalContents();
  }

  private spawnSprinklerVisual(level: number): void {
    const coords = [
      { x: 490, y: 125 }, // Zone 1 (Морковь)
      { x: 490, y: 255 }, // Zone 2 (Пшеница)
      { x: 490, y: 385 }, // Zone 3 (Клубника)
      { x: 485, y: 505 }, // Zone 4 (Тыква)
      { x: 1440, y: 175 }, // Zone 5 (Кукуруза - Фаза 2)
      { x: 1440, y: 395 }, // Zone 6 (Арбуз - Фаза 2)
    ];

    const pos = coords[level - 1];
    if (!pos) return;

    const cont = this.add.container(pos.x, pos.y).setDepth(12);
    const base = this.add.rectangle(0, 4, 18, 12, 0x475569);
    const pipe = this.add.rectangle(0, -4, 6, 12, 0x94a3b8);
    const nozzle = this.add.circle(0, -12, 6, 0x38bdf8);
    const label = this.add.text(0, -24, '💦 Спринклер', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '10px',
      color: '#93c5fd',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    cont.add([base, pipe, nozzle, label]);
    this.sprinklerVisuals.push(cont);
  }

  private updateSprinklers(seconds: number): void {
    if (this.sprinklerLevel <= 0) return;

    this.sprinklerTimer += seconds;
    if (this.sprinklerTimer >= 2.5) {
      this.sprinklerTimer = 0;

      let anyWatered = false;
      for (let z = 1; z <= this.sprinklerLevel; z++) {
        const zonePlots = this.plots.filter((p) => p.unlocked && p.zoneId === z && p.state === 'seeded');
        for (const plot of zonePlots) {
          plot.state = 'growing';
          plot.isWatered = true;
          this.updatePlotVisuals(plot);
          this.showFloatingNotice(plot.x, plot.y - 25, '💧 Спринклер полил!', '#38bdf8');
          anyWatered = true;
        }
      }

      if (anyWatered) {
        this.playWaterSplash();
      }
    }
  }

  private spawnWorkerVisual(): void {
    if (this.workerContainer) return;
    const startX = 760;
    const startY = 320;

    this.workerContainer = this.add.container(startX, startY).setDepth(20);

    const shadow = this.add.ellipse(0, 16, 30, 10, 0x000000, 0.35);
    const body = this.add.rectangle(0, 4, 22, 26, 0x15803d);
    body.setStrokeStyle(2, 0x166534);

    const head = this.add.circle(0, -14, 11, 0xfde047);
    const cap = this.add.rectangle(0, -22, 22, 8, 0x0284c7);

    const badge = this.add.text(0, -32, '🧑‍🌾 Помощник', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#86efac',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const barBg = this.add.rectangle(0, -42, 38, 5, 0x1e293b);
    this.workerBarFill = this.add.rectangle(-19, -42, 38, 5, 0x22c55e);
    this.workerBarFill.setOrigin(0, 0.5);

    this.workerStatusText = this.add.text(0, 26, 'Готов к работе', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '10px',
      color: '#cbd5e1',
      backgroundColor: '#0f172aa0',
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5);

    this.workerContainer.add([shadow, body, head, cap, badge, barBg, this.workerBarFill, this.workerStatusText]);
    this.workerContainer.setSize(38, 48);
    this.workerContainer.setInteractive({ useHandCursor: true });
    this.workerContainer.on('pointerdown', () => this.treatWorker());
  }

  private treatWorker(): void {
    if (!this.hasWorker || !this.workerContainer) return;
    if (this.workerStamina >= 100) {
      this.showFloatingNotice(this.workerContainer.x, this.workerContainer.y - 30, 'Помощник полон сил и усердно трудится!', '#86efac');
      return;
    }

    this.workerStamina = 100;
    this.workerState = 'idle';
    if (this.workerStatusText) this.workerStatusText.setText('Полон сил!');
    this.playPowerup();
    this.showFloatingNotice(this.workerContainer.x, this.workerContainer.y - 30, '😋 Помощник перекусил и полон сил (100%)!', '#4ade80');
  }

  private updateWorker(seconds: number): void {
    if (!this.hasWorker || !this.workerContainer) return;

    if (this.workerBarFill) {
      this.workerBarFill.width = 38 * (this.workerStamina / 100);
      this.workerBarFill.setFillStyle(this.workerStamina > 30 ? 0x22c55e : 0xef4444);
    }

    if (this.workerState === 'tired') {
      if (this.workerStatusText) this.workerStatusText.setText('💤 Отдыхает...');
      this.workerContainer.rotation = 0;

      this.workerStamina = Math.min(100, this.workerStamina + seconds * 5.5);
      if (this.workerStamina >= 100) {
        this.workerState = 'idle';
        if (this.workerStatusText) this.workerStatusText.setText('Готов');
        this.showFloatingNotice(this.workerContainer.x, this.workerContainer.y - 30, '🧑‍🌾 Помощник отдохнул и вернулся к работе!', '#4ade80');
      }
      return;
    }

    if (this.workerState === 'idle') {
      if (this.workerStatusText) this.workerStatusText.setText('Ищет грядку');
      this.workerContainer.rotation = 0;

      const ripePlots = this.plots.filter((p) => p.unlocked && p.state === 'ready');
      if (ripePlots.length > 0) {
        this.workerTargetPlot = Phaser.Utils.Array.GetRandom(ripePlots) as Plot;
        this.workerState = 'moving';
        return;
      }

      const emptyPlots = this.plots.filter((p) => p.unlocked && p.state === 'empty');
      if (emptyPlots.length > 0) {
        this.workerTargetPlot = Phaser.Utils.Array.GetRandom(emptyPlots) as Plot;
        this.workerState = 'moving';
        return;
      }
    }

    if (this.workerState === 'moving' && this.workerTargetPlot) {
      const target = this.workerTargetPlot;
      const dist = Phaser.Math.Distance.Between(this.workerContainer.x, this.workerContainer.y, target.x, target.y);

      if (dist <= 25) {
        this.workerState = 'working';
        this.workerActionTimer = 0.7;
        this.workerContainer.rotation = 0;
        if (this.workerStatusText) this.workerStatusText.setText('Работает 🌾');
      } else {
        const angle = Phaser.Math.Angle.Between(this.workerContainer.x, this.workerContainer.y, target.x, target.y);
        const speed = 160;
        this.workerContainer.x += Math.cos(angle) * speed * seconds;
        this.workerContainer.y += Math.sin(angle) * speed * seconds;
        this.workerContainer.rotation = Math.sin(Date.now() / 90) * 0.08;
      }
      return;
    }

    if (this.workerState === 'working' && this.workerTargetPlot) {
      this.workerActionTimer -= seconds;
      if (this.workerActionTimer <= 0) {
        const target = this.workerTargetPlot;
        const info = CROPS[target.cropType];

        if (target.state === 'ready') {
          this.inventory[target.cropType] += 1;
          this.updateInventoryHud();
          target.state = 'empty';
          target.growthProgress = 0;
          this.updatePlotVisuals(target);
          this.playHarvest();
          this.showFloatingNotice(target.x, target.y - 25, `+1 ${info.icon} (помощник)`, '#facc15');
        } else if (target.state === 'empty') {
          target.state = 'seeded';
          target.growthProgress = 0;
          target.isWatered = false;
          this.updatePlotVisuals(target);
          this.playPlant();
          this.showFloatingNotice(target.x, target.y - 25, '🌱 Посажено (помощник)', '#86efac');
        }

        this.workerStamina = Math.max(0, this.workerStamina - 7);
        if (this.workerStamina <= 0) {
          this.workerState = 'tired';
          this.showFloatingNotice(this.workerContainer.x, this.workerContainer.y - 30, '💤 Помощник устал! Нужен отдых или перекус', '#f87171');
        } else {
          this.workerState = 'idle';
        }

        this.workerTargetPlot = null;
      }
    }
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
      const cam = this.cameras.main;
      this.pauseModal.setPosition(cam.worldView.centerX, cam.worldView.centerY);
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
    const backdrop = this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.75).setInteractive();

    const panel = this.add.rectangle(0, 0, 500, 350, 0x0f172a);
    panel.setStrokeStyle(3, 0x38bdf8);

    const title = this.add.text(0, -130, '⏸️ ИГРА НА ПАУЗЕ', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const subtitle = this.add.text(0, -95, 'Все таймеры, грядки, вредители и рыбалка застыли', {
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
    const countHarvest = Object.values(this.inventory).reduce((a, b) => a + b, 0);
    const harvestDetails = (Object.keys(CROPS) as CropType[])
      .map((k) => `${CROPS[k].icon}:${this.inventory[k]}`)
      .join('  ');

    stats.setText(
      `🪙 Золото в казне: ${this.coins} монет\n` +
      `🧺 Урожай в корзине (${countHarvest} шт.): ${harvestDetails}\n` +
      `💧 Лейка: ${this.water}/${this.getMaxWater()} | Скорость: Ур. ${this.speedLevel}\n` +
      `🌾 Пугало: ${this.hasScarecrow ? 'Установлено' : 'Не куплено'} | 🗺️ Фаза 2: ${this.phase2Unlocked ? 'Открыта' : 'Закрыта'}\n` +
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
      if (this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) {
        this.resolveCrowHit();
      }
      return;
    }

    if (this.isRatMinigameActive) {
      this.ratSliderPos += this.ratSliderSpeed * seconds * 60;
      if (this.ratSliderPos > 140 || this.ratSliderPos < -140) {
        this.ratSliderSpeed = -this.ratSliderSpeed;
      }
      this.ratSliderContainer.x = this.ratSliderPos;
      if (this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) {
        this.resolveRatHit();
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

    // Кинематографический пролёт камеры (Фаза 2)
    if (this.isCinematicActive) {
      if (this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) {
        this.cameras.main.pan(this.playerContainer.x, this.playerContainer.y, 400, 'Power1', false, (_c, p) => {
          if (p >= 1) this.phase2.endCinematic();
        });
      }
      return;
    }

    if (this.isShopOpen || this.isMarketOpen) return;

    this.updatePlayerMovement(seconds);
    this.updatePlotsGrowth(seconds);
    this.updatePests(seconds);
    this.updateMarket(seconds);
    this.updateFishingEvent(seconds);
    this.updateSprinklers(seconds);
    this.updateWorker(seconds);
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

    // Ограничение перемещения (до открытия ворот Фазы 2 фермер не может пройти на восток)
    const maxX = this.phase2Unlocked ? 1920 - 40 : this.phase2GateX - 25;
    this.playerContainer.x = Phaser.Math.Clamp(this.playerContainer.x, 40, maxX);
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
    if (this.pendingTargetObject.type === 'phase2Well') {
      return Phaser.Math.Distance.Between(px, py, this.phase2WellX, this.phase2WellY) <= this.phase2WellRadius + 20;
    }
    if (this.pendingTargetObject.type === 'phase2Gate') {
      return Phaser.Math.Distance.Between(px, py, this.phase2GateX, this.phase2GateY) <= INTERACT_RADIUS + 20;
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
    if (this.pendingTargetObject.type === 'well' || this.pendingTargetObject.type === 'phase2Well') {
      this.fillWater();
    } else if (this.pendingTargetObject.type === 'phase2Gate') {
      this.tryUnlockPhase2();
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

          const isRat = victim.zoneId === 5 || victim.zoneId === 6;
          victim.pestText.setText(isRat ? '🐀' : '🦅');
          const badge = victim.pestContainer.getAt(1) as Phaser.GameObjects.Text;
          if (badge) {
            badge.setText(isRat ? '⚠️ КРЫСА!' : '⚠️ КЛЮЁТ!');
            badge.setBackgroundColor(isRat ? '#ea580c' : '#ef4444');
          }

          this.updatePlotVisuals(victim);
          if (isRat) {
            this.playRatAlert();
            this.showFloatingNotice(victim.x, victim.y - 30, '🐀 КРЫСА ГРЫЗЁТ УРОЖАЙ!', '#ea580c');
          } else {
            this.playPestAlert();
            this.showFloatingNotice(victim.x, victim.y - 30, '⚠️ ВОРОНА КЛЮЁТ!', '#ef4444');
          }
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

      const isRat = plot.zoneId === 5 || plot.zoneId === 6;
      plot.statusText.setText(isRat ? `🐀 Грызёт: ${plot.pestTimer.toFixed(1)}с` : `⚠️ Клюёт: ${plot.pestTimer.toFixed(1)}с`);

      if (plot.pestTimer <= 0) {
        plot.state = 'withered';
        plot.soil.setFillStyle(0x27272a);
        this.updatePlotVisuals(plot);
        this.playCropLost();
        this.showFloatingNotice(plot.x, plot.y - 30, isRat ? '🥀 Крыса сгрызла урожай!' : '🥀 Ворона склевала урожай!', '#f87171');
      }
    }
  }

  public updatePlotVisuals(plot: Plot): void {
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
        const isRatPlot = plot.zoneId === 5 || plot.zoneId === 6;
        plot.statusText.setText(isRatPlot ? 'Сгрызено (расчистить)' : 'Склёвано (расчистить)');
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
    const cropKeys: CropType[] = ['carrot', 'wheat', 'strawberry', 'pumpkin', 'corn', 'watermelon'];
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
    const cropKeys: CropType[] = ['carrot', 'wheat', 'strawberry', 'pumpkin', 'corn', 'watermelon'];
    for (const k of cropKeys) {
      revenue += this.inventory[k] * this.marketPrices[k];
      this.inventory[k] = 0;
    }

    if (revenue === 0) {
      this.playErrorSound();
      this.showFloatingNotice(this.barnX, this.barnY - 40, 'Корзина пуста! Соберите урожай', '#f87171');
      return;
    }

    this.coins += revenue;
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
    if (this.isPaused || this.isCinematicActive) return;

    if (pointer.y <= 85 || pointer.y >= this.scale.height - 35) return;

    const clickedX = pointer.worldX;
    const clickedY = pointer.worldY;

    const px = this.playerContainer.x;
    const py = this.playerContainer.y;

    // 1. Колодец Фазы 1
    if (Phaser.Math.Distance.Between(clickedX, clickedY, this.wellX, this.wellY) <= this.wellRadius + 15) {
      if (Phaser.Math.Distance.Between(px, py, this.wellX, this.wellY) <= this.wellRadius + 20) {
        this.fillWater();
      } else {
        this.targetMovePoint = { x: this.wellX + 45, y: this.wellY };
        this.pendingTargetObject = { type: 'well' };
      }
      return;
    }

    // 1.1 Бочка с водой Фазы 2
    if (Phaser.Math.Distance.Between(clickedX, clickedY, this.phase2WellX, this.phase2WellY) <= this.phase2WellRadius + 15) {
      if (Phaser.Math.Distance.Between(px, py, this.phase2WellX, this.phase2WellY) <= this.phase2WellRadius + 20) {
        this.fillWater();
      } else {
        this.targetMovePoint = { x: this.phase2WellX - 45, y: this.phase2WellY };
        this.pendingTargetObject = { type: 'phase2Well' };
      }
      return;
    }

    // 1.2 Ворота Фазы 2
    if (Phaser.Math.Distance.Between(clickedX, clickedY, this.phase2GateX, this.phase2GateY) <= 65) {
      if (Phaser.Math.Distance.Between(px, py, this.phase2GateX, this.phase2GateY) <= INTERACT_RADIUS + 20) {
        this.tryUnlockPhase2();
      } else {
        this.targetMovePoint = { x: this.phase2GateX - 45, y: this.phase2GateY };
        this.pendingTargetObject = { type: 'phase2Gate' };
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
    if (Math.abs(clickedX - this.barnX) <= 85 && Math.abs(clickedY - (this.barnY + 15)) <= 75) {
      if (Phaser.Math.Distance.Between(px, py, this.barnX, this.barnY) <= INTERACT_RADIUS + 30) {
        this.openMarketModal();
      } else {
        this.targetMovePoint = { x: this.barnX - 55, y: this.barnY };
        this.pendingTargetObject = { type: 'barn' };
      }
      return;
    }

    // 4. Лавка улучшений
    if (Math.abs(clickedX - this.shopX) <= 75 && Math.abs(clickedY - this.shopY) <= 65) {
      if (Phaser.Math.Distance.Between(px, py, this.shopX, this.shopY) <= INTERACT_RADIUS + 30) {
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

    // Ворота Фазы 2
    if (Phaser.Math.Distance.Between(px, py, this.phase2GateX, this.phase2GateY) <= INTERACT_RADIUS + 15) {
      if (!this.phase2.isUnlocked()) {
        if (this.phase2.isRequirementMet()) {
          this.showPrompt(`✨ [ПРОБЕЛ / Клик] Открыть Фазу 2 (${PHASE2_CONFIG.unlockCost} 🪙)`);
        } else {
          this.showPrompt('🔒 Фаза 2: Сначала откройте Клубнику 🍓');
        }
      } else {
        this.showPrompt('🚪 Проход в восточные угодья (Открыто)');
      }
      return;
    }

    // Бочка с водой Фазы 2
    if (Phaser.Math.Distance.Between(px, py, this.phase2WellX, this.phase2WellY) <= this.phase2WellRadius + 20) {
      if (this.water < this.getMaxWater()) {
        this.showPrompt('[ПРОБЕЛ / Клик] Набрать воду из бочки');
      } else {
        this.showPrompt(`Лейка полна (${this.water}/${this.getMaxWater()})`);
      }
      return;
    }

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

    // Помощник
    if (this.hasWorker && this.workerContainer) {
      const distToWorker = Phaser.Math.Distance.Between(px, py, this.workerContainer.x, this.workerContainer.y);
      if (distToWorker <= 55) {
        if (this.workerState === 'tired' || this.workerStamina < 100) {
          this.showPrompt('[ПРОБЕЛ / Клик] Угостить помощника (Восстановить силы)');
        } else {
          this.showPrompt(`🧑‍🌾 Помощник трудится (Бодрость: ${Math.round(this.workerStamina)}%)`);
        }
        return;
      }
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
        if (plot.zoneId === 5 || plot.zoneId === 6) {
          this.showPrompt('🐀 [ПРОБЕЛ] МИНИ-ИГРА: ПРОГНАТЬ КРЫСУ!');
        } else {
          this.showPrompt('⚠️ [ПРОБЕЛ] МИНИ-ИГРА: СПУГНУТЬ ВОРОНУ!');
        }
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

    // Ворота Фазы 2
    if (Phaser.Math.Distance.Between(px, py, this.phase2GateX, this.phase2GateY) <= INTERACT_RADIUS + 20) {
      this.tryUnlockPhase2();
      return;
    }

    // Бочка с водой Фазы 2
    if (Phaser.Math.Distance.Between(px, py, this.phase2WellX, this.phase2WellY) <= this.phase2WellRadius + 20) {
      this.fillWater();
      return;
    }

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

    if (this.hasWorker && this.workerContainer) {
      const distToWorker = Phaser.Math.Distance.Between(px, py, this.workerContainer.x, this.workerContainer.y);
      if (distToWorker <= 55) {
        this.treatWorker();
        return;
      }
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
        if (plot.zoneId === 5 || plot.zoneId === 6) {
          this.startRatMinigame(plot);
        } else {
          this.startCrowMinigame(plot);
        }
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
      `🧺 Корзина: 🥕:${this.inventory.carrot} 🌾:${this.inventory.wheat} 🍓:${this.inventory.strawberry} 🎃:${this.inventory.pumpkin} 🌽:${this.inventory.corn} 🍉:${this.inventory.watermelon}`
    );
  }

  public showFloatingNotice(x: number, y: number, text: string, color = '#fef08a'): void {
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

  public playVictoryFanfare(): void {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 'sine', 0.28, 0.1), idx * 90);
    });
  }

  public playPowerup(): void {
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

  public playErrorSound(): void {
    this.playTone(150, 'sawtooth', 0.15, 0.08);
  }

  // --- ОТКРЫТИЕ ФАЗЫ 2 (ВОСТОЧНЫЙ УЧАСТОК) ---

  private tryUnlockPhase2(): void {
    if (this.phase2.isUnlocked()) return;

    if (!this.phase2.isRequirementMet()) {
      this.playErrorSound();
      this.showFloatingNotice(this.phase2GateX, this.phase2GateY - 40, '🔒 Сначала откройте Клубнику 🍓!', '#f87171');
      return;
    }

    if (this.coins < PHASE2_CONFIG.unlockCost) {
      this.playErrorSound();
      this.showFloatingNotice(this.phase2GateX, this.phase2GateY - 40, `Нужна ${PHASE2_CONFIG.unlockCost} монета для открытия!`, '#f87171');
      return;
    }

    this.coins -= PHASE2_CONFIG.unlockCost;
    this.updateCoinsHud();

    this.phase2.unlockGate();

    // Теперь, когда Фаза 2 открыта, расширяем мир и включаем плавное следование камеры
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, this.scale.height);
    this.cameras.main.startFollow(this.playerContainer, true, 0.08, 0.08);

    this.playPowerup();
    this.showFloatingNotice(this.phase2GateX + 60, this.phase2GateY - 40, '🎉 Фаза 2 открыта! Доступны Кукуруза 🌽 и Арбузы 🍉!\nБерегитесь крыс 🐀!', '#4ade80');
  }

  private playRatAlert(): void {
    this.playTone(850, 'sawtooth', 0.08, 0.06);
    setTimeout(() => this.playTone(1100, 'sawtooth', 0.09, 0.06), 70);
    setTimeout(() => this.playTone(920, 'sawtooth', 0.08, 0.06), 140);
  }

  private playScaredRat(): void {
    this.playTone(1200, 'sawtooth', 0.1, 0.07);
    setTimeout(() => this.playTone(1550, 'sawtooth', 0.12, 0.06), 60);
    setTimeout(() => this.playTone(1800, 'sine', 0.14, 0.05), 130);
  }
}
