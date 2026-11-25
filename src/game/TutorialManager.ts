import Phaser from 'phaser';
import { PHASE1_LOCATIONS } from './constants';

export type TutorialStep =
  | 'welcome'
  | 'well'
  | 'plant'
  | 'harvest'
  | 'warehouse'
  | 'pond'
  | 'complete';

export class TutorialManager {
  private scene: Phaser.Scene;
  private currentStep: TutorialStep = 'welcome';
  private active = false;

  // Графика обучения (HUD баннер)
  private bannerContainer: Phaser.GameObjects.Container | null = null;
  private stepPillText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  // Маркер цели на игровом поле
  private targetMarker: Phaser.GameObjects.Container | null = null;
  private markerTween: Phaser.Tweens.Tween | null = null;

  // Отслеживание прогресса
  private moveDistance = 0;
  private lastPlayerPos = { x: 0, y: 0 };
  private isCameraPanning = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public isTutorialActive(): boolean {
    return this.active;
  }

  public getCurrentStep(): TutorialStep {
    return this.currentStep;
  }

  public start(): void {
    this.active = true;
    this.currentStep = 'welcome';
    this.moveDistance = 0;

    const player = (this.scene as any).playerContainer;
    if (player) {
      this.lastPlayerPos = { x: player.x, y: player.y };
    }

    this.createBannerUI();
    this.updateStepView();
  }

  public skip(): void {
    if (!this.active) return;
    this.active = false;
    this.cleanupUI();

    const notify = (this.scene as any).showFloatingNotice;
    const player = (this.scene as any).playerContainer;
    if (typeof notify === 'function' && player) {
      notify.call(this.scene, player.x, player.y - 40, 'Обучение завершено. Клавиша [T] — повторить', '#38bdf8');
    }

    // Восстанавливаем следование камеры за игроком
    this.restoreCameraFollow();
  }

  // --- ОБРАБОТЧИКИ ДЕЙСТВИЙ ИГРОКА ---

  public onPlayerMove(px: number, py: number): void {
    if (!this.active || this.currentStep !== 'welcome') return;

    const d = Phaser.Math.Distance.Between(px, py, this.lastPlayerPos.x, this.lastPlayerPos.y);
    this.moveDistance += d;
    this.lastPlayerPos = { x: px, y: py };

    if (this.moveDistance >= 70) {
      this.setStep('well');
    }
  }

  public onWaterFilled(): void {
    if (!this.active) return;
    if (this.currentStep === 'well') {
      this.setStep('plant');
    }
  }

  public onPlotPlanted(): void {
    if (!this.active) return;
    if (this.currentStep === 'plant') {
      this.setStep('harvest');
    }
  }

  public onPlotWatered(): void {
    if (!this.active) return;
    // Если на этапе сбора урожая, ускоряем созревание для комфортного прохождения обучения
    if (this.currentStep === 'harvest') {
      const plots = (this.scene as any).plots;
      if (plots && plots.length > 0) {
        for (const p of plots) {
          if (p.state === 'seeded' || p.state === 'growing') {
            p.growthProgress = Math.max(p.growthProgress, 0.85);
          }
        }
      }
    }
  }

  public onCropHarvested(): void {
    if (!this.active) return;
    if (this.currentStep === 'harvest') {
      this.setStep('warehouse');
    }
  }

  public onCropsSold(): void {
    if (!this.active) return;
    if (this.currentStep === 'warehouse') {
      this.setStep('pond');
    }
  }

  public onActionKeyPressed(): void {
    if (!this.active) return;
    if (this.currentStep === 'pond') {
      this.setStep('complete');
    } else if (this.currentStep === 'complete') {
      this.skip();
    }
  }

  // --- УПРАВЛЕНИЕ ШАГАМИ ---

  private setStep(step: TutorialStep): void {
    this.currentStep = step;
    this.updateStepView();

    // Звуковой сигнал перехода шага
    const playTone = (this.scene as any).playTone;
    if (typeof playTone === 'function') {
      playTone.call(this.scene, 580, 'sine', 0.12, 0.08);
    }
  }

  private updateStepView(): void {
    if (!this.bannerContainer) return;

    this.cleanupMarker();

    switch (this.currentStep) {
      case 'welcome':
        this.stepPillText.setText('🎓 ШАГ 1/5: ДВИЖЕНИЕ');
        this.titleText.setText('🚶 Управление только с клавиатуры!');
        this.descText.setText('Используйте клавиши [WASD] или [СТРЕЛКИ] для перемещения по ферме.');
        this.hintText.setText('👉 Сделайте несколько шагов в любую сторону');
        this.restoreCameraFollow();
        break;

      case 'well': {
        const { wellX, wellY } = PHASE1_LOCATIONS;
        this.stepPillText.setText('🎓 ШАГ 2/5: КОЛОДЕЦ И ВОДА');
        this.titleText.setText('💧 Для полива растений нужна вода!');
        this.descText.setText('Подойдите к Колодцу слева и нажмите [ПРОБЕЛ], чтобы наполнить лейку.');
        this.hintText.setText('👉 Идите к синему колодцу слева [ПРОБЕЛ]');
        this.createTargetMarker(wellX, wellY, '💧 КОЛОДЕЦ');
        this.panCameraToObject(wellX, wellY);
        break;
      }

      case 'plant': {
        const plotX = 330;
        const plotY = 175;
        this.stepPillText.setText('🎓 ШАГ 3/5: ПОСАДКА СЕМЯН');
        this.titleText.setText('🌱 Посадите первую морковь!');
        this.descText.setText('Подойдите к свободной грядке Зоны 1 и нажмите [ПРОБЕЛ] для посадки.');
        this.hintText.setText('👉 Подойдите к грядке с морковью [ПРОБЕЛ]');
        this.createTargetMarker(plotX, plotY, '🌱 ГРЯДКА');
        this.panCameraToObject(plotX, plotY);
        break;
      }

      case 'harvest': {
        const plotX = 330;
        const plotY = 175;
        this.stepPillText.setText('🎓 ШАГ 4/5: ПОЛИВ И СОЗРЕВАНИЕ');
        this.titleText.setText('🥕 Полейте грядку для быстрого роста!');
        this.descText.setText('Нажмите [ПРОБЕЛ], чтобы полить морковь. Когда она созреет — нажмите [ПРОБЕЛ] для сбора!');
        this.hintText.setText('👉 Полейте грядку [ПРОБЕЛ] и соберите урожай [ПРОБЕЛ]');
        this.createTargetMarker(plotX, plotY, '🥕 УРОЖАЙ');
        this.restoreCameraFollow();
        break;
      }

      case 'warehouse': {
        const { barnX, barnY } = PHASE1_LOCATIONS;
        this.stepPillText.setText('🎓 ШАГ 5/5: СКЛАД И ПРОДАЖА');
        this.titleText.setText('🏪 Продавайте урожай на Складе!');
        this.descText.setText('Подойдите к красному Складу справа. Нажмите [ПРОБЕЛ] для входа, затем [ПРОБЕЛ] для продажи.');
        this.hintText.setText('👉 Идите к Складу справа [ПРОБЕЛ]');
        this.createTargetMarker(barnX, barnY, '🏪 СКЛАД');
        this.panCameraToObject(barnX, barnY);
        break;
      }

      case 'pond': {
        const { pondX, pondY } = PHASE1_LOCATIONS;
        this.stepPillText.setText('🎣 ПРУД И РЫБАЛКА (БОНУС)');
        this.titleText.setText('✨ В пруду водится Золотая Рыбка (300 🪙)!');
        this.descText.setText('Когда рыба плещется — подойдите к пруду и нажмите [ПРОБЕЛ] для запуска мини-игры!');
        this.hintText.setText('👉 Нажмите [ПРОБЕЛ], чтобы продолжить');
        this.createTargetMarker(pondX, pondY, '🎣 ПРУД');
        this.panCameraToObject(pondX, pondY);
        break;
      }

      case 'complete':
        this.stepPillText.setText('🎉 ОБУЧЕНИЕ ЗАВЕРШЕНО!');
        this.titleText.setText('🌾 Вы готовы к настоящему фермерству!');
        this.descText.setText('В Лавке можно нанять помощника, а покупка Клубники 🍓 откроет Восточные угодья за 1 🪙!');
        this.hintText.setText('👉 Нажмите [ПРОБЕЛ] или [ESC], чтобы начать игру!');
        this.restoreCameraFollow();
        break;
    }
  }

  // --- КАМЕРА: АКЦЕНТИРОВАНИЕ ВНИМАНИЯ ---

  private panCameraToObject(targetX: number, targetY: number): void {
    const cam = this.scene.cameras.main;
    this.isCameraPanning = true;
    cam.stopFollow();

    // Плавно летим к объекту (1100 мс), задерживаемся, затем возвращаемся к игроку
    cam.pan(targetX, targetY, 1100, 'Sine.easeInOut', false, (_c, progress) => {
      if (progress >= 1) {
        this.scene.time.delayedCall(1600, () => {
          if (!this.active) return;
          this.restoreCameraFollow();
        });
      }
    });
  }

  private restoreCameraFollow(): void {
    const player = (this.scene as any).playerContainer;
    const cam = this.scene.cameras.main;
    if (player && cam) {
      cam.pan(player.x, player.y, 900, 'Sine.easeInOut', false, (_c, p) => {
        if (p >= 1) {
          cam.startFollow(player, true, 0.08, 0.08);
          this.isCameraPanning = false;
        }
      });
    }
  }

  // --- СОЗДАНИЕ МАРКЕРА ЦЕЛИ НА ПОЛЕ ---

  private createTargetMarker(x: number, y: number, label: string): void {
    this.targetMarker = this.scene.add.container(x, y).setDepth(25);

    const glow = this.scene.add.circle(0, 0, 36, 0x38bdf8, 0.28);
    const ring = this.scene.add.circle(0, 0, 32);
    ring.setStrokeStyle(3, 0xfacc15);

    const tagBg = this.scene.add.rectangle(0, -42, 110, 22, 0x0f172a, 0.95);
    tagBg.setStrokeStyle(1, 0x38bdf8);

    const tagText = this.scene.add.text(0, -42, label, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#facc15',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.targetMarker.add([glow, ring, tagBg, tagText]);

    this.markerTween = this.scene.tweens.add({
      targets: [glow, ring],
      scale: 1.25,
      alpha: 0.7,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private cleanupMarker(): void {
    if (this.markerTween) {
      this.markerTween.stop();
      this.markerTween = null;
    }
    if (this.targetMarker) {
      this.targetMarker.destroy();
      this.targetMarker = null;
    }
  }

  // --- СОЗДАНИЕ ВЕРХНЕГО БАННЕРА ОБУЧЕНИЯ ---

  private createBannerUI(): void {
    const { width } = this.scene.scale;
    this.bannerContainer = this.scene.add.container(width / 2, 60).setDepth(135).setScrollFactor(0);

    const bg = this.scene.add.rectangle(0, 0, 680, 82, 0x0f172a, 0.96);
    bg.setStrokeStyle(2, 0x38bdf8);

    const pillBg = this.scene.add.rectangle(-230, -26, 170, 20, 0x1e3a8a);
    pillBg.setStrokeStyle(1, 0x60a5fa);

    this.stepPillText = this.scene.add.text(-230, -26, '🎓 ШАГ 1/5', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#93c5fd',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const skipHint = this.scene.add.text(230, -26, '[ESC] Пропустить', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    this.titleText = this.scene.add.text(0, -8, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#facc15',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.descText = this.scene.add.text(0, 10, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#e2e8f0',
    }).setOrigin(0.5);

    this.hintText = this.scene.add.text(0, 28, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.bannerContainer.add([
      bg,
      pillBg,
      this.stepPillText,
      skipHint,
      this.titleText,
      this.descText,
      this.hintText,
    ]);
  }

  private cleanupUI(): void {
    this.cleanupMarker();
    if (this.bannerContainer) {
      this.bannerContainer.destroy();
      this.bannerContainer = null;
    }
  }
}
