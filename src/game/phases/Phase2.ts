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

  // Новые объекты производства Фазы 2
  public chickenCoopText: Phaser.GameObjects.Text | null = null;
  public millText: Phaser.GameObjects.Text | null = null;
  public millBladesTween: Phaser.Tweens.Tween | null = null;
  public dairyText: Phaser.GameObjects.Text | null = null;

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
    // Зона обработанной земли под грядки Фазы 2
    const dirtFieldP2 = this.scene.add.tileSprite(
      1440, 340, 580, 360, 'sprout_dirt_tile'
    ).setDepth(1).setAlpha(0.65);

    // Дорожка от ворот в центр восточных земель
    const pathP2 = this.scene.add.tileSprite(1200, 340, 480, 24, 'sprout_paths').setDepth(2);

    // Дополнительный источник воды в Фазе 2 (Бочка с дождевой водой)
    const { wellX, wellY } = PHASE2_CONFIG;
    this.scene.add.ellipse(wellX, wellY + 28, 55, 16, 0x000000, 0.35).setDepth(2);

    const barrel = this.scene.add.rectangle(wellX, wellY, 68, 62, 0x78350f);
    barrel.setStrokeStyle(3, 0x451a03);
    barrel.setDepth(3);

    const barrelWater = this.scene.add.circle(wellX, wellY, 20, 0x0284c7).setDepth(4);

    const barrelRim = this.scene.add.circle(wellX, wellY, 22);
    barrelRim.setStrokeStyle(2, 0x94a3b8).setDepth(4);

    this.scene.add.text(wellX, wellY + 42, '🪣 БОЧКА С ВОДОЙ\n[ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#7dd3fc',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    // Ветряная мельница на востоке с вращающимися лопастями
    const millX = PHASE2_CONFIG.millX;
    const millY = PHASE2_CONFIG.millY;
    this.scene.add.ellipse(millX, millY + 44, 76, 20, 0x000000, 0.3).setDepth(2);
    const millBody = this.scene.add.rectangle(millX, millY + 5, 72, 85, 0x475569).setDepth(3);
    millBody.setStrokeStyle(3, 0x1e293b);
    this.scene.add.triangle(millX, millY - 55, millX - 45, millY - 25, millX + 45, millY - 25, millX, millY - 65, 0x854d0e).setDepth(4);

    // Лопасти мельницы (вращающийся крест)
    const bladeContainer = this.scene.add.container(millX, millY - 25).setDepth(5);
    const b1 = this.scene.add.rectangle(0, 0, 10, 80, 0xd97706);
    b1.setStrokeStyle(1, 0x78350f);
    const b2 = this.scene.add.rectangle(0, 0, 80, 10, 0xd97706);
    b2.setStrokeStyle(1, 0x78350f);
    const bHub = this.scene.add.circle(0, 0, 7, 0x451a03);
    bladeContainer.add([b1, b2, bHub]);
    this.millBladesTween = this.scene.tweens.add({
      targets: bladeContainer,
      angle: 360,
      duration: 3500,
      repeat: -1,
      ease: 'Linear',
    });

    this.millText = this.scene.add.text(millX, millY + 52, '💨 ВЕТРЯНАЯ МЕЛЬНИЦА\n[ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '10px',
      color: '#cbd5e1',
      align: 'center',
      fontStyle: 'bold',
      backgroundColor: '#0f172ab0',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(6);

    // Курятник на лужайке Фазы 2
    const coopX = PHASE2_CONFIG.chickenCoopX;
    const coopY = PHASE2_CONFIG.chickenCoopY;
    this.scene.add.ellipse(coopX, coopY + 28, 78, 20, 0x000000, 0.25).setDepth(2);
    this.scene.add.image(coopX, coopY, 'sprout_chicken_house').setScale(1.75).setDepth(3);
    this.chickenCoopText = this.scene.add.text(coopX, coopY + 44, '🐔 КУРЯТНИК\n[ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '10px',
      color: '#fef08a',
      align: 'center',
      fontStyle: 'bold',
      backgroundColor: '#0f172ab0',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(6);

    // Загон и вывеска молочной фермы коровы на северо-востоке
    const cowX = PHASE2_CONFIG.dairyCowX;
    const cowY = PHASE2_CONFIG.dairyCowY;
    this.scene.add.rectangle(cowX - 35, cowY + 10, 6, 20, 0x78350f).setDepth(2);
    this.scene.add.rectangle(cowX + 35, cowY + 10, 6, 20, 0x78350f).setDepth(2);
    this.scene.add.rectangle(cowX, cowY + 22, 76, 4, 0x92400e).setDepth(2);
    this.dairyText = this.scene.add.text(cowX, cowY + 36, '🐄 МОЛОЧНАЯ ФЕРМА\n[ПРОБЕЛ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '10px',
      color: '#7dd3fc',
      align: 'center',
      fontStyle: 'bold',
      backgroundColor: '#0f172ab0',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(6);

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

    // Деревья и редкие природные объекты на востоке
    this.createTree(1050, 160, 1);
    this.createTree(1740, 155, 2);
    this.createTree(1860, 580, 1);
    this.scene.add.image(1035, 575, 'sprout_bush1').setScale(1.8).setDepth(2);
    this.scene.add.image(1760, 585, 'sprout_stone1').setScale(1.6).setDepth(2);
  }

  private createTree(x: number, y: number, variant: 1 | 2 = 1): void {
    const shadowW = variant === 2 ? 38 : 26;
    const shadowH = variant === 2 ? 14 : 10;
    this.scene.add.ellipse(x, y + 2, shadowW, shadowH, 0x000000, 0.28).setDepth(2);
    const treeKey = variant === 2 ? 'sprout_tree2' : 'sprout_tree1';
    const originY = variant === 2 ? (28 / 32) : (25.5 / 32);
    this.scene.add.image(x, y, treeKey).setOrigin(0.5, originY).setScale(2.0).setDepth(3);
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
    const bg = this.scene.add.rectangle(0, 0, w, h, 0x78350f);
    bg.setStrokeStyle(2, 0xfacc15);
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

    // Ограждения над грядками Кукурузы и Арбузов строго на x = 1440
    for (const zone of this.zones) {
      // Аккуратный деревянный заборчик без черных затемнений
      const railTop = this.scene.add.rectangle(1440, zone.signY - 38, 490, 4, 0x78350f).setDepth(4);
      const railBottom = this.scene.add.rectangle(1440, zone.signY + 38, 490, 4, 0x78350f).setDepth(4);
      zone.fences.push(railTop, railBottom);
      for (let fx = 1205; fx <= 1675; fx += 60) {
        const post = this.scene.add.rectangle(fx, zone.signY, 6, 80, 0x5c3317).setDepth(5);
        zone.fences.push(post);
      }

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

    const sub = this.scene.add.text(0, 12, `Восточные земли открываются! Откройте ворота за ${PHASE2_CONFIG.unlockCost} 🪙! [ПРОБЕЛ / ESC: пропуск]`, {
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
          const playerContainer = (this.scene as any).playerContainer;
          const targetX = playerContainer ? playerContainer.x : 480;
          const targetY = playerContainer ? playerContainer.y : 320;
          this.scene.cameras.main.pan(targetX, targetY, 1800, 'Sine.easeInOut', false, (_c, backProgress) => {
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
      notify.call(this.scene, 960, 310, `🚪 Ворота: ${PHASE2_CONFIG.unlockCost} 🪙!`, '#4ade80');
    }
  }

  public endCinematic(onComplete?: () => void): void {
    if (this.cinematicContainer) {
      this.cinematicContainer.destroy();
      this.cinematicContainer = null;
    }
    this.isCinematic = false;

    // После открытия второй зоны (Клубники) камера больше НЕ фиксируется на зоне 1, а плавно следует за игроком по всему миру!
    this.scene.cameras.main.setBounds(0, 0, 1920, this.scene.scale.height);
    const playerContainer = (this.scene as any).playerContainer;
    if (playerContainer) {
      this.scene.cameras.main.startFollow(playerContainer, true, 0.08, 0.08);
    }

    if (onComplete) onComplete();
  }

  // --- ПОКУПКА / ОТКРЫТИЕ ВОРОТ ФАЗЫ 2 ---

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
  }
}
