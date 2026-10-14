import Phaser from 'phaser';
import {
  CropType,
  CROPS,
  FarmZone,
  Plot,
  PHASE2_CONFIG,
  PHASE2_ZONES,
  PHASE2_PLOT_CONFIGS,
} from '../constants';

/**
 * ============================================================================
 * ФАЗА 2: ВОСТОЧНЫЕ ЗЕМЛИ (960..1920 px)
 * ============================================================================
 * Отвечает за:
 * - Условие открытия: привязано к покупке грядки Клубники (Zone 3), а не по времени!
 * - Границу и интерактивные ворота на x = 960 (открытие за 1 🪙 для теста)
 * - Кинематографический пролёт камеры при открытии Клубники
 * - Новые культуры: Кукуруза (Zone 5) и Арбузы (Zone 6)
 * - Дополнительную бочку с водой на востоке
 * - Мельницу и норы полевых крыс
 * - Звуки вредителей-крыс
 */
export class Phase2 {
  private scene: Phaser.Scene;

  // Состояние Фазы 2
  private isStrawberryUnlocked = false;
  private unlocked = false;
  private isCinematic = false;

  // Графика и объекты
  private gateDoor: Phaser.GameObjects.Rectangle | null = null;
  private gateSignContainer: Phaser.GameObjects.Container | null = null;
  private gateSignText: Phaser.GameObjects.Text | null = null;
  private cinematicContainer: Phaser.GameObjects.Container | null = null;

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

  public isUnlocked(): boolean {
    return this.unlocked;
  }

  public isCinematicActive(): boolean {
    return this.isCinematic;
  }

  public isRequirementMet(): boolean {
    return this.isStrawberryUnlocked;
  }

  // --- ЛАНДШАФТ И ДЕКОРАЦИИ ФАЗЫ 2 ---

  public createLandscape(onRefillWater: () => void): void {
    // Центральное пахотное поле Фазы 2
    const gardenP2 = this.scene.add.rectangle(1440, 340, 680, 480, 0x223c1f, 0.95);
    gardenP2.setStrokeStyle(3, 0x3d6634);
    gardenP2.setDepth(1);

    // Дорожка от ворот в центр восточных земель
    this.scene.add.rectangle(1200, 340, 480, 36, 0x5a4832, 0.6).setDepth(1);

    // Дополнительный источник воды в Фазе 2 (Бочка с дождевой водой)
    const { wellX, wellY } = PHASE2_CONFIG;
    this.scene.add.ellipse(wellX, wellY + 28, 55, 16, 0x000000, 0.35).setDepth(2);

    const barrel = this.scene.add.rectangle(wellX, wellY, 68, 62, 0x78350f);
    barrel.setStrokeStyle(3, 0x451a03);
    barrel.setDepth(3);
    barrel.setInteractive({ useHandCursor: true });
    barrel.on('pointerdown', onRefillWater);

    const barrelWater = this.scene.add.circle(wellX, wellY, 20, 0x0284c7).setDepth(4);
    barrelWater.setInteractive({ useHandCursor: true });
    barrelWater.on('pointerdown', onRefillWater);

    const barrelRim = this.scene.add.circle(wellX, wellY, 22);
    barrelRim.setStrokeStyle(2, 0x94a3b8).setDepth(4);

    const barrelLabel = this.scene.add.text(wellX, wellY + 42, '🪣 БОЧКА С ВОДОЙ\n[ПРОБЕЛ / Клик]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#7dd3fc',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);
    barrelLabel.setInteractive({ useHandCursor: true });
    barrelLabel.on('pointerdown', onRefillWater);

    // Мельница декоративная на востоке
    const mill = this.scene.add.rectangle(PHASE2_CONFIG.millX, PHASE2_CONFIG.millY, 70, 90, 0x475569).setDepth(3);
    mill.setStrokeStyle(3, 0x1e293b);
    this.scene.add.triangle(PHASE2_CONFIG.millX, 400, 1780, 430, 1860, 430, PHASE2_CONFIG.millX, 385, 0x854d0e).setDepth(4);
    this.scene.add.text(PHASE2_CONFIG.millX, PHASE2_CONFIG.millY, '💨 МЕЛЬНИЦА\nФАЗЫ 2', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#cbd5e1',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    // Норы полевых крыс (угроза урожаю)
    const ratBurrow1 = this.scene.add.ellipse(PHASE2_CONFIG.burrow1X, PHASE2_CONFIG.burrow1Y, 46, 24, 0x18181b).setDepth(2);
    ratBurrow1.setStrokeStyle(2, 0x78350f);
    this.scene.add.text(PHASE2_CONFIG.burrow1X, PHASE2_CONFIG.burrow1Y, '🕳️🐀 Нора крыс', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '10px',
      color: '#ea580c',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);

    const ratBurrow2 = this.scene.add.ellipse(PHASE2_CONFIG.burrow2X, PHASE2_CONFIG.burrow2Y, 46, 24, 0x18181b).setDepth(2);
    ratBurrow2.setStrokeStyle(2, 0x78350f);
    this.scene.add.text(PHASE2_CONFIG.burrow2X, PHASE2_CONFIG.burrow2Y, '🕳️🐀 Нора крыс', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '10px',
      color: '#ea580c',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);

    // Деревья на востоке
    this.createTree(1050, 140);
    this.createTree(1740, 130);
    this.createTree(1860, 560);
  }

  private createTree(x: number, y: number): void {
    this.scene.add.ellipse(x, y + 24, 46, 18, 0x000000, 0.3).setDepth(2);
    this.scene.add.rectangle(x, y + 8, 14, 34, 0x5c3317).setDepth(2);
    this.scene.add.circle(x - 10, y - 16, 26, 0x166534).setDepth(3);
    this.scene.add.circle(x + 10, y - 20, 28, 0x15803d).setDepth(3);
    this.scene.add.circle(x, y - 36, 24, 0x22c55e).setDepth(4);
  }

  // --- ВОРОТА НА ГРАНИЦЕ (x = 960) ---

  public createGate(onTryUnlock: () => void): void {
    const { gateX, gateY } = PHASE2_CONFIG;

    // Ограждения границы на x = 960
    this.scene.add.rectangle(gateX, 191, 14, 198, 0x643c1f).setDepth(4);
    this.scene.add.rectangle(gateX, 505, 14, 230, 0x643c1f).setDepth(4);

    // Арка ворот
    this.scene.add.rectangle(gateX, 300, 18, 20, 0x78350f).setDepth(5);
    this.scene.add.rectangle(gateX, 380, 18, 20, 0x78350f).setDepth(5);
    this.scene.add.rectangle(gateX, 290, 50, 14, 0x92400e).setDepth(6);
    this.scene.add.text(gateX, 272, '🚪 ВОСТОЧНЫЕ УГОДЬЯ', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#fef08a',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(7);

    // Створка ворот (закрыта до покупки)
    this.gateDoor = this.scene.add.rectangle(gateX, gateY, 14, 70, 0x78350f).setDepth(5);
    this.gateDoor.setStrokeStyle(2, 0xf59e0b);

    // Табличка на воротах
    this.gateSignContainer = this.scene.add.container(gateX, gateY).setDepth(15);
    const signBg = this.addInteractiveSignBg(140, 52, onTryUnlock);

    this.gateSignText = this.scene.add.text(0, 0, '🔒 ВОСТОЧНЫЕ ЗЕМЛИ\n(Откройте Клубнику 🍓)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#fef08a',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    this.gateSignContainer.add([signBg, this.gateSignText]);
    this.gateSignContainer.setSize(140, 52);
  }

  private addInteractiveSignBg(w: number, h: number, onClick: () => void): Phaser.GameObjects.Rectangle {
    const bg = this.scene.add.rectangle(0, 0, w, h, 0x0f172a, 0.94);
    bg.setStrokeStyle(2, 0xfacc15);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', onClick);
    return bg;
  }

  // --- ЗОНЫ И ГРЯДКИ ФАЗЫ 2 ---

  public createZonesAndPlots(onPlotClick: (plot: Plot) => void): { zones: FarmZone[]; plots: Plot[] } {
    this.zones = PHASE2_ZONES.map((z) => ({ ...z, fences: [] }));
    this.plots = [];

    let plotId = 100;
    for (const p of PHASE2_PLOT_CONFIGS) {
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
      const pestText = this.scene.add.text(0, 0, '🐀', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
      }).setOrigin(0.5);
      const pestBadge = this.scene.add.text(0, -22, '⚠️ КРЫСА!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#ea580c',
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
        unlocked: false,
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

      border.setInteractive({ useHandCursor: true }).on('pointerdown', () => onPlotClick(plot));
      soil.setInteractive({ useHandCursor: true }).on('pointerdown', () => onPlotClick(plot));

      this.plots.push(plot);
    }

    // Ограждения над грядками Кукурузы и Арбузов строго на x = 1440
    for (const zone of this.zones) {
      const fence = this.scene.add.rectangle(1440, zone.signY, 490, 80, 0x000000, 0.35);
      fence.setStrokeStyle(2, 0xf59e0b, 0.6);
      fence.setDepth(10);
      zone.fences.push(fence);

      const signBox = this.scene.add.container(zone.signX, zone.signY).setDepth(11);
      const signBg = this.scene.add.rectangle(0, 0, 110, 48, 0x78350f);
      signBg.setStrokeStyle(2, 0xfacc15);

      const cropInfo = CROPS[zone.cropType];
      const signText = this.scene.add.text(0, 0, `🔒 ${cropInfo.name}\n(Фаза 2)`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#fef08a',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5);

      signBox.add([signBg, signText]);
      zone.signContainer = signBox;
    }

    return { zones: this.zones, plots: this.plots };
  }

  // --- ТРИГГЕР ОТКРЫТИЯ ФАЗЫ 2: ПРИВЯЗКА К КЛУБНИКЕ ---

  public onStrawberryUnlocked(onCompleteCinematic: () => void): void {
    if (this.isStrawberryUnlocked) return;
    this.isStrawberryUnlocked = true;

    // Обновляем табличку на воротах
    if (this.gateSignText) {
      this.gateSignText.setText(`✨ ФАЗА 2: ОТКРЫТЬ\n[ПРОБЕЛ] ${PHASE2_CONFIG.unlockCost} 🪙`);
    }

    // Запускаем кинематографический пролёт камеры к новым землям
    this.startCinematic(onCompleteCinematic);
  }

  public startCinematic(onComplete: () => void): void {
    this.isCinematic = true;

    const { width } = this.scene.scale;
    this.cinematicContainer = this.scene.add.container(width / 2, 75).setDepth(140).setScrollFactor(0);

    const bar = this.scene.add.rectangle(0, 0, width - 40, 56, 0x0f172a, 0.95);
    bar.setStrokeStyle(3, 0xfacc15);

    const title = this.scene.add.text(0, -12, '🌟 КЛУБНИКА ОТКРЫТА! СТАЛА ДОСТУПНА ФАЗА 2! 🌟', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#facc15',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const sub = this.scene.add.text(0, 12, 'Восточные земли открываются! Откройте ворота за 1 🪙! [ПРОБЕЛ / ESC: пропуск]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#e2e8f0',
    }).setOrigin(0.5);

    this.cinematicContainer.add([bar, title, sub]);

    // Временно расширяем границы камеры и плавно летим на восток (1440, 320)
    this.scene.cameras.main.setBounds(0, 0, 1920, this.scene.scale.height);
    this.scene.cameras.main.stopFollow();
    this.scene.cameras.main.pan(1440, 320, 2200, 'Sine.easeInOut', false, (_cam, progress) => {
      if (progress >= 1) {
        this.showPhase2Highlights();

        this.scene.time.delayedCall(2600, () => {
          if (!this.isCinematic) return;
          this.scene.cameras.main.pan(480, 320, 1800, 'Sine.easeInOut', false, (_c, backProgress) => {
            if (backProgress >= 1) {
              this.endCinematic(onComplete);
            }
          });
        });
      }
    });
  }

  public showPhase2Highlights(): void {
    const notify = (this.scene as any).showFloatingNotice;
    if (typeof notify === 'function') {
      notify.call(this.scene, 1440, 210, '🌽 Поля сладкой Кукурузы', '#facc15');
      notify.call(this.scene, 1440, 420, '🍉 Бахча сочных Арбузов', '#f43f5e');
      notify.call(this.scene, 1120, 500, '🐀 Норы полевых крыс (Берегите урожай!)', '#fb923c');
      notify.call(this.scene, 960, 310, '🚪 Ворота: всего 1 🪙!', '#4ade80');
    }
  }

  public endCinematic(onComplete?: () => void): void {
    if (this.cinematicContainer) {
      this.cinematicContainer.destroy();
      this.cinematicContainer = null;
    }
    this.isCinematic = false;

    if (!this.unlocked) {
      this.scene.cameras.main.stopFollow();
      this.scene.cameras.main.setBounds(0, 0, 960, this.scene.scale.height);
      this.scene.cameras.main.setScroll(0, 0);
    }

    if (onComplete) onComplete();
  }

  // --- ПОКУПКА / ОТКРЫТИЕ ВОРОТ ФАЗЫ 2 ЗА 1 МОНЕТУ ---

  public unlockGate(): void {
    this.unlocked = true;

    // Анимация распахивания створки ворот
    if (this.gateDoor) {
      this.scene.tweens.add({
        targets: this.gateDoor,
        alpha: 0,
        y: PHASE2_CONFIG.gateY + 60,
        duration: 800,
      });
    }

    if (this.gateSignText) {
      this.gateSignText.setText('🚪 ВОСТОЧНЫЕ УГОДЬЯ\n(Открыто)');
    }

    // Разблокируем зоны 5 и 6 и их грядки
    for (const z of this.zones) {
      z.unlocked = true;
      z.fences.forEach((f) => f.destroy());
      z.fences = [];
      if (z.signContainer) {
        z.signContainer.destroy();
        z.signContainer = undefined;
      }
    }

    for (const plot of this.plots) {
      plot.unlocked = true;
      (this.scene as any).updatePlotVisuals?.(plot);
    }
  }
}
