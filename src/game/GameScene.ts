import Phaser from 'phaser';

/**
 * Игровые константы (настройка баланса)
 */
export const PLAYER_SPEED = 240;
export const INTERACT_RADIUS = 64;
export const TARGET_COINS = 100;
export const COINS_PER_HARVEST = 10;
export const MAX_WATER = 3;
export const MAX_LOSSES = 3;
export const TOTAL_TIME_SECONDS = 90;

export const GROWTH_WATERED_SECONDS = 4.5;
export const GROWTH_DRY_SECONDS = 13.0;
export const PEST_WINDOW_SECONDS = 6.0;
export const PEST_CHECK_INTERVAL_SECONDS = 2.5;
export const PEST_SPAWN_CHANCE = 0.4;

export type PlotState = 'empty' | 'seeded' | 'growing' | 'ready' | 'attacked' | 'withered';

interface Plot {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  state: PlotState;
  isWatered: boolean;
  growthProgress: number; // 0..1
  pestTimer: number; // секунды до потери урожая
  // Визуальные объекты Phaser
  border: Phaser.GameObjects.Rectangle;
  soil: Phaser.GameObjects.Rectangle;
  plantIcon: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
  barBg: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
}

export class GameScene extends Phaser.Scene {
  // Игрок
  private playerContainer!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private actionKeys!: Phaser.Input.Keyboard.Key[];
  private restartKey!: Phaser.Input.Keyboard.Key;

  // Объекты фермы
  private plots: Plot[] = [];
  private wellX = 110;
  private wellY = 330;
  private wellRadius = 54;

  // Игровой прогресс
  private coins = 0;
  private water = MAX_WATER;
  private losses = 0;
  private timeLeft = TOTAL_TIME_SECONDS;
  private isGameOver = false;
  private isVictory = false;

  // Таймеры
  private pestCheckTimer = 0;

  // HUD
  private hudBg!: Phaser.GameObjects.Rectangle;
  private coinsText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private waterText!: Phaser.GameObjects.Text;
  private lossesText!: Phaser.GameObjects.Text;
  private promptBox!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private currentActionTarget: { type: 'well' | 'plot'; plot?: Plot } | null = null;

  // Модальное окно окончания игры
  private modalContainer!: Phaser.GameObjects.Container;

  // Синтез звука (Web Audio API)
  private audioCtx: AudioContext | null = null;
  private isMuted = false;
  private soundButtonText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.resetState();

    this.createBackground(width, height);
    this.createWell();
    this.createPlots();
    this.createPlayer();
    this.createHUD(width);
    this.createControls();
    this.createEndModal(width, height);

    // Клик мышью по экрану для взаимодействия
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.initAudio();
      this.handlePointerClick(pointer);
    });
  }

  private resetState(): void {
    this.coins = 0;
    this.water = MAX_WATER;
    this.losses = 0;
    this.timeLeft = TOTAL_TIME_SECONDS;
    this.isGameOver = false;
    this.isVictory = false;
    this.pestCheckTimer = 0;
    this.currentActionTarget = null;
    this.plots = [];
  }

  // --- СОЗДАНИЕ МИРА ---

  private createBackground(width: number, height: number): void {
    // Луг и тропинки
    const ground = this.add.rectangle(width / 2, height / 2, width, height, 0x1e3b20);
    ground.setDepth(0);

    // Участок огорода (вскопанная зона)
    const gardenArea = this.add.rectangle(510, 340, 600, 360, 0x2c4a27, 0.85);
    gardenArea.setStrokeStyle(3, 0x4a7337);
    gardenArea.setDepth(1);

    // Дорожка к колодцу
    const path = this.add.rectangle(200, 330, 200, 36, 0x544933, 0.45);
    path.setDepth(1);

    // Заборчик сверху
    for (let x = 60; x < width - 40; x += 40) {
      this.add.rectangle(x, 106, 8, 22, 0x855836).setDepth(2);
      this.add.rectangle(x + 20, 102, 40, 6, 0x6e472a).setDepth(2);
    }

    // Декоративный амбар справа
    const barn = this.add.rectangle(870, 330, 100, 150, 0x8b251e);
    barn.setStrokeStyle(3, 0x5a1813);
    barn.setDepth(2);
    this.add.rectangle(870, 240, 110, 36, 0xa3352d).setDepth(3);
    this.add.text(870, 320, '🌾\nСКЛАД', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#ffedd5',
      align: 'center',
    }).setOrigin(0.5).setDepth(4);
  }

  private createWell(): void {
    // Основание колодца
    const base = this.add.rectangle(this.wellX, this.wellY, 76, 76, 0x475569);
    base.setStrokeStyle(4, 0x1e293b);
    base.setDepth(3);

    // Вода в колодце
    const water = this.add.circle(this.wellX, this.wellY, 26, 0x38bdf8);
    water.setDepth(4);

    // Крыша колодца
    const roof = this.add.rectangle(this.wellX, this.wellY - 44, 90, 20, 0x78350f);
    roof.setDepth(5);

    // Подпись
    this.add.text(this.wellX, this.wellY + 48, '💧 КОЛОДЕЦ', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#93c5fd',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);
  }

  private createPlots(): void {
    // Сетка грядок 3x2 (6 участков)
    const startX = 310;
    const startY = 240;
    const gapX = 190;
    const gapY = 170;
    const plotWidth = 140;
    const plotHeight = 110;

    let id = 0;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        id++;
        const x = startX + col * gapX;
        const y = startY + row * gapY;

        // Деревянный бортик
        const border = this.add.rectangle(x, y, plotWidth, plotHeight, 0x5c3317);
        border.setStrokeStyle(3, 0x3e200c);
        border.setDepth(3);

        // Земля
        const soil = this.add.rectangle(x, y, plotWidth - 12, plotHeight - 12, 0x633e21);
        soil.setDepth(4);

        // Растение / плод
        const plantIcon = this.add.text(x, y - 6, '', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '36px',
        }).setOrigin(0.5).setDepth(6);

        // Текст статуса грядки
        const statusText = this.add.text(x, y + 36, 'Пусто', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: '#cbd5e1',
          backgroundColor: '#0f172a99',
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setDepth(6);

        // Полоса прогресса
        const barBg = this.add.rectangle(x, y + 20, 100, 8, 0x1e293b);
        barBg.setDepth(6);
        barBg.setVisible(false);

        const barFill = this.add.rectangle(x - 50, y + 20, 0, 8, 0x22c55e);
        barFill.setOrigin(0, 0.5);
        barFill.setDepth(7);
        barFill.setVisible(false);

        this.plots.push({
          id,
          x,
          y,
          width: plotWidth,
          height: plotHeight,
          state: 'empty',
          isWatered: false,
          growthProgress: 0,
          pestTimer: 0,
          border,
          soil,
          plantIcon,
          statusText,
          barBg,
          barFill,
        });
      }
    }
  }

  private createPlayer(): void {
    const { width, height } = this.scale;
    const startX = width / 2;
    const startY = height / 2 + 40;

    this.playerContainer = this.add.container(startX, startY);
    this.playerContainer.setDepth(15);

    // Тень под персонажем
    const shadow = this.add.ellipse(0, 20, 36, 14, 0x000000, 0.35);

    // Тело (синий фермерский комбинезон)
    const body = this.add.rectangle(0, 6, 26, 30, 0x2563eb);
    body.setStrokeStyle(2, 0x1d4ed8);

    // Голова
    const head = this.add.circle(0, -14, 13, 0xfde047);

    // Соломенная шляпа
    const hatBrim = this.add.ellipse(0, -22, 42, 14, 0xd97706);
    const hatTop = this.add.rectangle(0, -28, 20, 12, 0xb45309);

    this.playerContainer.add([shadow, body, head, hatBrim, hatTop]);

    // Всплывающая подсказка над игроком
    this.promptBox = this.add.container(startX, startY - 56);
    this.promptBox.setDepth(20);
    this.promptBox.setVisible(false);

    const promptBg = this.add.rectangle(0, 0, 190, 28, 0x0f172a, 0.9);
    promptBg.setStrokeStyle(2, 0x38bdf8);

    this.promptText = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.promptBox.add([promptBg, this.promptText]);
  }

  private createHUD(width: number): void {
    // Верхняя панель задач
    this.hudBg = this.add.rectangle(width / 2, 44, width - 32, 72, 0x0f172a, 0.95);
    this.hudBg.setStrokeStyle(2, 0x334155);
    this.hudBg.setDepth(25);

    // Монеты / Цель
    this.coinsText = this.add.text(40, 26, `🪙 Монеты: 0 / ${TARGET_COINS}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#facc15',
      fontStyle: 'bold',
    }).setDepth(26);

    // Вода
    this.waterText = this.add.text(40, 52, `💧 Лейка: ${this.water}/${MAX_WATER}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#38bdf8',
    }).setDepth(26);

    // Таймер смены
    this.timerText = this.add.text(width / 2, 34, `⏱️ Время: ${this.timeLeft}с`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(26);

    // Потери / Риск
    this.lossesText = this.add.text(width - 320, 36, `⚠️ Потери: 0 / ${MAX_LOSSES}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#f87171',
      fontStyle: 'bold',
    }).setDepth(26);

    // Кнопка звука
    this.soundButtonText = this.add.text(width - 160, 24, '🔊 Звук', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#94a3b8',
      backgroundColor: '#1e293b',
      padding: { x: 8, y: 4 },
    }).setDepth(26).setInteractive({ useHandCursor: true });

    this.soundButtonText.on('pointerdown', () => {
      this.initAudio();
      this.isMuted = !this.isMuted;
      this.soundButtonText.setText(this.isMuted ? '🔇 Выкл' : '🔊 Звук');
    });

    // Кнопка Заново в углу
    const restartBtn = this.add.text(width - 160, 50, '🔄 Заново (R)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#38bdf8',
      backgroundColor: '#1e293b',
      padding: { x: 8, y: 4 },
    }).setDepth(26).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerdown', () => this.restartGame());

    // Нижняя строка подсказки управления
    this.add.text(width / 2, this.scale.height - 24, 'WASD / Стрелки — Ходьба  |  ПРОБЕЛ / E / Клик — Действие  |  R — Заново', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#94a3b8',
      backgroundColor: '#0f172acc',
      padding: { x: 12, y: 4 },
    }).setOrigin(0.5).setDepth(25);
  }

  private createControls(): void {
    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

    // Клавиши действия (Пробел, E, Enter)
    const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    const eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    const enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.actionKeys = [spaceKey, eKey, enterKey];

    // Горячая клавиша перезапуска R
    this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.restartKey.on('down', () => this.restartGame());
  }

  private createEndModal(width: number, height: number): void {
    this.modalContainer = this.add.container(width / 2, height / 2);
    this.modalContainer.setDepth(100);
    this.modalContainer.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.75);
    backdrop.setInteractive(); // Блокирует клики сквозь окно

    const panel = this.add.rectangle(0, 0, 480, 300, 0x0f172a);
    panel.setStrokeStyle(3, 0x38bdf8);

    const title = this.add.text(0, -90, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setName('modalTitle');

    const desc = this.add.text(0, -20, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#cbd5e1',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5).setName('modalDesc');

    const btn = this.add.text(0, 75, 'ИГРАТЬ ЗАНОВО (R)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2563eb',
      padding: { x: 20, y: 10 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => this.restartGame());

    this.modalContainer.add([backdrop, panel, title, desc, btn]);
  }

  // --- ИГРОВОЙ ЦИКЛ ---

  update(_time: number, delta: number): void {
    if (this.isGameOver) return;

    const seconds = delta / 1000;

    this.updateTimer(seconds);
    this.updatePlayerMovement(seconds);
    this.updatePlotsGrowth(seconds);
    this.updatePests(seconds);
    this.detectInteractionTarget();
    this.checkActionKeys();
  }

  private updateTimer(seconds: number): void {
    this.timeLeft -= seconds;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.triggerGameOver(
        '⌛ ВРЕМЯ ВЫШЛО!',
        `Смена закончилась.\nВы собрали: ${this.coins} из ${TARGET_COINS} монет.\nПопробуйте успеть быстрее!`,
        false,
      );
    }
    const displaySec = Math.ceil(this.timeLeft);
    this.timerText.setText(`⏱️ Время: ${displaySec}с`);
    if (displaySec <= 15) {
      this.timerText.setColor('#ef4444');
    } else {
      this.timerText.setColor('#ffffff');
    }
  }

  private updatePlayerMovement(seconds: number): void {
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      this.initAudio();
      const length = Math.hypot(dx, dy);
      this.playerContainer.x += (dx / length) * PLAYER_SPEED * seconds;
      this.playerContainer.y += (dy / length) * PLAYER_SPEED * seconds;

      // Лёгкое покачивание персонажа при ходьбе
      this.playerContainer.rotation = Math.sin(Date.now() / 90) * 0.08;
    } else {
      this.playerContainer.rotation = 0;
    }

    // Удержание игрока в пределах видимой карты
    const minX = 40;
    const maxX = this.scale.width - 40;
    const minY = 130;
    const maxY = this.scale.height - 40;

    this.playerContainer.x = Phaser.Math.Clamp(this.playerContainer.x, minX, maxX);
    this.playerContainer.y = Phaser.Math.Clamp(this.playerContainer.y, minY, maxY);

    // Синхронизация подсказки
    this.promptBox.setPosition(this.playerContainer.x, this.playerContainer.y - 56);
  }

  private updatePlotsGrowth(seconds: number): void {
    for (const plot of this.plots) {
      if (plot.state === 'seeded' || plot.state === 'growing') {
        const speed = plot.isWatered ? (1 / GROWTH_WATERED_SECONDS) : (1 / GROWTH_DRY_SECONDS);
        plot.growthProgress += speed * seconds;

        if (plot.growthProgress >= 1) {
          plot.growthProgress = 1;
          plot.state = 'ready';
          plot.isWatered = false;
          plot.plantIcon.setText('🥕');
          plot.statusText.setText('Спелый! Собери');
          plot.statusText.setColor('#facc15');
          plot.barBg.setVisible(false);
          plot.barFill.setVisible(false);
          plot.soil.setFillStyle(0x432616);
          this.playReadySound();
        } else {
          // Обновление полосы прогресса
          plot.barBg.setVisible(true);
          plot.barFill.setVisible(true);
          plot.barFill.width = 100 * plot.growthProgress;
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
    // Проверка нападения вредителей по интервалу
    this.pestCheckTimer += seconds;
    if (this.pestCheckTimer >= PEST_CHECK_INTERVAL_SECONDS) {
      this.pestCheckTimer = 0;

      // Ищем созревшие грядки без ворон
      const readyPlots = this.plots.filter((p) => p.state === 'ready');
      if (readyPlots.length > 0 && Math.random() < PEST_SPAWN_CHANCE) {
        const targetPlot = Phaser.Utils.Array.GetRandom(readyPlots) as Plot;
        if (targetPlot) {
          targetPlot.state = 'attacked';
          targetPlot.pestTimer = PEST_WINDOW_SECONDS;
          targetPlot.plantIcon.setText('🦅');
          targetPlot.statusText.setText('⚠️ ВОРОНА КЛЮЁТ!');
          targetPlot.statusText.setColor('#ef4444');
          targetPlot.soil.setFillStyle(0x7f1d1d);
          this.playPestAlert();
          this.showFloatingNotice(targetPlot.x, targetPlot.y - 30, '⚠️ ВОРОНА!', '#ef4444');
        }
      }
    }

    // Обработка грядок, подвергшихся нападению
    for (const plot of this.plots) {
      if (plot.state === 'attacked') {
        plot.pestTimer -= seconds;
        // Мигание плашки
        const alpha = Math.sin(Date.now() / 120) > 0 ? 1 : 0.4;
        plot.plantIcon.setAlpha(alpha);

        if (plot.pestTimer <= 0) {
          // Урожай потерян!
          plot.state = 'withered';
          plot.plantIcon.setText('🥀');
          plot.plantIcon.setAlpha(1);
          plot.statusText.setText('Засохло (расчистить)');
          plot.statusText.setColor('#94a3b8');
          plot.soil.setFillStyle(0x27272a);
          this.losses += 1;
          this.lossesText.setText(`⚠️ Потери: ${this.losses} / ${MAX_LOSSES}`);
          this.playCropLost();
          this.showFloatingNotice(plot.x, plot.y - 30, '-1 УРОЖАЙ!', '#f87171');

          if (this.losses >= MAX_LOSSES) {
            this.triggerGameOver(
              '💀 ФЕРМА РАЗОРЕНА!',
              `Вредители уничтожили ${this.losses} урожая!\nНе оставляйте созревшие грядки без присмотра.`,
              false,
            );
            return;
          }
        }
      } else {
        plot.plantIcon.setAlpha(1);
      }
    }
  }

  // --- ИНТЕРАКЦИЯ И ВВОД ---

  private detectInteractionTarget(): void {
    const px = this.playerContainer.x;
    const py = this.playerContainer.y;

    // Проверяем колодец
    const distToWell = Phaser.Math.Distance.Between(px, py, this.wellX, this.wellY);
    if (distToWell <= this.wellRadius + 20) {
      this.currentActionTarget = { type: 'well' };
      if (this.water < MAX_WATER) {
        this.showPrompt('[ПРОБЕЛ] Набрать воду в лейку');
      } else {
        this.showPrompt('Лейка полна (3/3)');
      }
      return;
    }

    // Проверяем ближайшую грядку
    let nearestPlot: Plot | null = null;
    let minDist = Number.MAX_VALUE;

    for (const plot of this.plots) {
      const dist = Phaser.Math.Distance.Between(px, py, plot.x, plot.y);
      if (dist < minDist) {
        minDist = dist;
        nearestPlot = plot;
      }
    }

    if (nearestPlot && minDist <= INTERACT_RADIUS) {
      this.currentActionTarget = { type: 'plot', plot: nearestPlot };
      this.updatePromptForPlot(nearestPlot);
      return;
    }

    // Если рядом ничего нет
    this.currentActionTarget = null;
    this.promptBox.setVisible(false);
  }

  private updatePromptForPlot(plot: Plot): void {
    switch (plot.state) {
      case 'empty':
        this.showPrompt('[ПРОБЕЛ] Посадить семена');
        break;
      case 'seeded':
        if (this.water > 0) {
          this.showPrompt('[ПРОБЕЛ] Полить грядку (-1 💧)');
        } else {
          this.showPrompt('Нет воды! Иди к колодцу');
        }
        break;
      case 'growing':
        this.showPrompt('🌱 Растёт...');
        break;
      case 'ready':
        this.showPrompt(`[ПРОБЕЛ] Собрать урожай (+${COINS_PER_HARVEST} 🪙)`);
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
    if (justPressed) {
      this.initAudio();
      this.performCurrentAction();
    }
  }

  private handlePointerClick(pointer: Phaser.Input.Pointer): void {
    if (this.isGameOver) return;

    // Клик по колодцу
    const distToWell = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.wellX, this.wellY);
    if (distToWell <= this.wellRadius + 15) {
      this.fillWater();
      return;
    }

    // Клик по грядкам
    for (const plot of this.plots) {
      if (
        pointer.x >= plot.x - plot.width / 2 &&
        pointer.x <= plot.x + plot.width / 2 &&
        pointer.y >= plot.y - plot.height / 2 &&
        pointer.y <= plot.y + plot.height / 2
      ) {
        this.interactWithPlot(plot);
        return;
      }
    }

    // Иначе выполняем текущее контекстное действие
    this.performCurrentAction();
  }

  private performCurrentAction(): void {
    if (!this.currentActionTarget) return;

    if (this.currentActionTarget.type === 'well') {
      this.fillWater();
    } else if (this.currentActionTarget.type === 'plot' && this.currentActionTarget.plot) {
      this.interactWithPlot(this.currentActionTarget.plot);
    }
  }

  private fillWater(): void {
    if (this.water >= MAX_WATER) {
      this.showFloatingNotice(this.wellX, this.wellY - 30, 'Лейка уже полная!', '#38bdf8');
      return;
    }

    this.water = MAX_WATER;
    this.waterText.setText(`💧 Лейка: ${this.water}/${MAX_WATER}`);
    this.playWaterFill();
    this.showFloatingNotice(this.wellX, this.wellY - 30, '💧 +3 Воды!', '#38bdf8');
  }

  private interactWithPlot(plot: Plot): void {
    switch (plot.state) {
      case 'empty':
        // Посадка
        plot.state = 'seeded';
        plot.growthProgress = 0;
        plot.isWatered = false;
        plot.plantIcon.setText('🌱');
        plot.statusText.setText('Сухо (нужна вода)');
        plot.statusText.setColor('#fbbf24');
        plot.soil.setFillStyle(0x633e21);
        plot.barBg.setVisible(true);
        plot.barFill.setVisible(true);
        plot.barFill.width = 0;
        this.playPlant();
        this.showFloatingNotice(plot.x, plot.y - 25, '🌱 Посажено!', '#86efac');
        break;

      case 'seeded':
        // Полив
        if (this.water <= 0) {
          this.showFloatingNotice(plot.x, plot.y - 25, 'Нет воды! Беги к колодцу!', '#f87171');
          return;
        }
        this.water -= 1;
        this.waterText.setText(`💧 Лейка: ${this.water}/${MAX_WATER}`);
        plot.state = 'growing';
        plot.isWatered = true;
        plot.statusText.setText('Полито (растёт)');
        plot.statusText.setColor('#4ade80');
        plot.soil.setFillStyle(0x382013);
        this.playWaterSplash();
        this.showFloatingNotice(plot.x, plot.y - 25, '💧 Полито!', '#38bdf8');
        break;

      case 'ready':
        // Сбор урожая
        this.coins += COINS_PER_HARVEST;
        this.coinsText.setText(`🪙 Монеты: ${this.coins} / ${TARGET_COINS}`);
        this.playHarvest();
        this.showFloatingNotice(plot.x, plot.y - 25, `+${COINS_PER_HARVEST} 🪙`, '#facc15');

        // Сброс грядки
        plot.state = 'empty';
        plot.growthProgress = 0;
        plot.plantIcon.setText('');
        plot.statusText.setText('Пусто');
        plot.statusText.setColor('#cbd5e1');
        plot.soil.setFillStyle(0x633e21);
        plot.barBg.setVisible(false);
        plot.barFill.setVisible(false);

        // Проверка победы
        if (this.coins >= TARGET_COINS) {
          const usedTime = Math.round(TOTAL_TIME_SECONDS - this.timeLeft);
          this.triggerGameOver(
            '🎉 ПОБЕДА! ПЛАН ВЫПОЛНЕН!',
            `Вы собрали ${this.coins} монет за ${usedTime} секунд!\nФерма процветает!`,
            true,
          );
        }
        break;

      case 'attacked':
        // Отпугивание вороны
        plot.state = 'ready';
        plot.pestTimer = 0;
        plot.plantIcon.setText('🥕');
        plot.plantIcon.setAlpha(1);
        plot.statusText.setText('Спелый! Собери');
        plot.statusText.setColor('#facc15');
        plot.soil.setFillStyle(0x432616);
        this.playScaredPest();
        this.showFloatingNotice(plot.x, plot.y - 25, '🦅 Спугнул ворону!', '#fbbf24');
        break;

      case 'withered':
        // Расчистка увядшей грядки
        plot.state = 'empty';
        plot.growthProgress = 0;
        plot.plantIcon.setText('');
        plot.statusText.setText('Пусто');
        plot.statusText.setColor('#cbd5e1');
        plot.soil.setFillStyle(0x633e21);
        this.playPlant();
        this.showFloatingNotice(plot.x, plot.y - 25, '🧹 Расчищено', '#e2e8f0');
        break;

      case 'growing':
        this.showFloatingNotice(plot.x, plot.y - 25, 'Растение ещё зреет...', '#cbd5e1');
        break;
    }

    this.updatePromptForPlot(plot);
  }

  // --- ЭФФЕКТЫ И FEEDBACK ---

  private showFloatingNotice(x: number, y: number, text: string, color: string): void {
    const notice = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color,
      fontStyle: 'bold',
      backgroundColor: '#0f172acc',
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(40);

    this.tweens.add({
      targets: notice,
      y: y - 36,
      alpha: 0,
      duration: 1000,
      ease: 'Power1',
      onComplete: () => notice.destroy(),
    });
  }

  private triggerGameOver(title: string, desc: string, victory: boolean): void {
    this.isGameOver = true;
    this.isVictory = victory;
    this.promptBox.setVisible(false);

    if (victory) {
      this.playVictory();
    } else {
      this.playDefeat();
    }

    const titleObj = this.modalContainer.getByName('modalTitle') as Phaser.GameObjects.Text;
    const descObj = this.modalContainer.getByName('modalDesc') as Phaser.GameObjects.Text;

    titleObj.setText(title);
    titleObj.setColor(victory ? '#4ade80' : '#f87171');
    descObj.setText(desc);

    this.modalContainer.setVisible(true);
  }

  private restartGame(): void {
    this.modalContainer.setVisible(false);
    this.scene.restart();
  }

  // --- ЗВУКОВАЯ ПОДСИСТЕМА (Web Audio API) ---

  private initAudio(): void {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (AudioContextClass) {
      this.audioCtx = new AudioContextClass();
    }
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
      // Игнорируем блокировку браузера до жеста
    }
  }

  private playPlant(): void {
    this.playTone(220, 'sine', 0.12, 0.07);
  }

  private playWaterFill(): void {
    this.playTone(480, 'sine', 0.18, 0.08);
    setTimeout(() => this.playTone(600, 'sine', 0.22, 0.08), 100);
  }

  private playWaterSplash(): void {
    this.playTone(340, 'triangle', 0.15, 0.08);
  }

  private playReadySound(): void {
    this.playTone(523.25, 'triangle', 0.1, 0.04);
  }

  private playHarvest(): void {
    this.playTone(523.25, 'sine', 0.12, 0.09); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.12, 0.09), 80); // E5
    setTimeout(() => this.playTone(783.99, 'sine', 0.2, 0.1), 160); // G5
  }

  private playPestAlert(): void {
    this.playTone(180, 'sawtooth', 0.25, 0.08);
  }

  private playScaredPest(): void {
    this.playTone(700, 'sawtooth', 0.15, 0.07);
    setTimeout(() => this.playTone(950, 'sawtooth', 0.15, 0.06), 80);
  }

  private playCropLost(): void {
    this.playTone(190, 'sawtooth', 0.35, 0.1);
  }

  private playVictory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.25, 0.1), idx * 110);
    });
  }

  private playDefeat(): void {
    const notes = [440, 392, 349.23, 293.66];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sawtooth', 0.3, 0.09), idx * 140);
    });
  }
}
