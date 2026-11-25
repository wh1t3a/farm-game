import Phaser from 'phaser';

/**
 * ============================================================================
 * ФАРМ-ИГРА: ГЛАВНЫЕ КОНСТАНТЫ И КОНФИГУРАЦИЯ
 * ============================================================================
 * Все параметры культур, цен, таймингов, прокачки и локаций
 * вынесены сюда для быстрого и удобного редактирования.
 */

// --- РАЗМЕРЫ ЭКРАНА И МИРА ---
export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 640;
export const WORLD_WIDTH = 1920;
export const PHASE1_MAX_X = 935; // Граница передвижения до открытия Фазы 2
export const INTERACT_RADIUS = 72; // Радиус взаимодействия игрока

// --- КУЛЬТУРЫ, ПРОДУКТЫ И ИХ ХАРАКТЕРИСТИКИ ---
export type CropType = 'carrot' | 'wheat' | 'strawberry' | 'pumpkin' | 'corn' | 'watermelon';
export type FarmProductType = CropType | 'egg' | 'flour' | 'milk';

export interface CropInfo {
  name: string;
  icon: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  growthWatered: number; // Время роста с поливом (сек)
  growthDry: number;     // Время роста без полива (сек)
}

export interface ProductInfo {
  name: string;
  icon: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  isCrop?: boolean;
  growthWatered?: number;
  growthDry?: number;
}

export const CROPS: Record<CropType, CropInfo> = {
  carrot: {
    name: 'Морковь',
    icon: '🥕',
    basePrice: 14,
    minPrice: 10,
    maxPrice: 22,
    growthWatered: 4.0,
    growthDry: 12.0,
  },
  wheat: {
    name: 'Пшеница',
    icon: '🌾',
    basePrice: 32,
    minPrice: 22,
    maxPrice: 50,
    growthWatered: 6.5,
    growthDry: 18.0,
  },
  strawberry: {
    name: 'Клубника',
    icon: '🍓',
    basePrice: 85,
    minPrice: 60,
    maxPrice: 130,
    growthWatered: 9.0,
    growthDry: 25.0,
  },
  pumpkin: {
    name: 'Тыква',
    icon: '🎃',
    basePrice: 190,
    minPrice: 130,
    maxPrice: 300,
    growthWatered: 13.0,
    growthDry: 36.0,
  },
  corn: {
    name: 'Кукуруза',
    icon: '🌽',
    basePrice: 320,
    minPrice: 220,
    maxPrice: 500,
    growthWatered: 7.5,
    growthDry: 20.0,
  },
  watermelon: {
    name: 'Арбуз',
    icon: '🍉',
    basePrice: 600,
    minPrice: 420,
    maxPrice: 950,
    growthWatered: 11.5,
    growthDry: 32.0,
  },
};

export const ALL_PRODUCTS: Record<FarmProductType, ProductInfo> = {
  ...CROPS,
  egg: {
    name: 'Свежее Яйцо',
    icon: '🥚',
    basePrice: 220,
    minPrice: 160,
    maxPrice: 350,
    isCrop: false,
  },
  flour: {
    name: 'Отборная Мука',
    icon: '🥖',
    basePrice: 280,
    minPrice: 200,
    maxPrice: 440,
    isCrop: false,
  },
  milk: {
    name: 'Парное Молоко',
    icon: '🥛',
    basePrice: 550,
    minPrice: 390,
    maxPrice: 850,
    isCrop: false,
  },
};

// --- СОСТОЯНИЯ ГРЯДКИ ---
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
  incidentId?: number;
  // Графические объекты
  border: Phaser.GameObjects.Rectangle;
  soil: Phaser.GameObjects.Rectangle;
  dirtTile?: Phaser.GameObjects.TileSprite;
  cropSprite?: Phaser.GameObjects.Sprite;
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

export interface PlotConfig {
  zoneId: number;
  cropType: CropType;
  x: number;
  y: number;
  w: number;
  h: number;
}

// --- СТАРТОВЫЕ РЕСУРСЫ ---
export const INITIAL_COINS = 25;
export const INITIAL_WATER = 0; // На старте лейка пустая (0/3), чтобы обучение набору воды в колодце было осмысленным

// --- ПРОКАЧКА: ЛЕЙКА ---
export const WATER_CAPACITIES = [3, 5, 8, 12];
export const WATER_UPGRADE_COSTS = [50, 130, 300];

// --- ПРОКАЧКА: САПОГИ СКОРОСТИ ---
export const SPEED_VALUES = [240, 300, 370];
export const SPEED_UPGRADE_COSTS = [70, 180];

// --- ПРОКАЧКА: ПУГАЛО ОТ ВОРОН ---
export const SCARECROW_COST = 140;

// --- АВТОМАТИЗАЦИЯ: СПРИНКЛЕРЫ (ОРОСИТЕЛИ) ---
export const SPRINKLER_COSTS = [120, 240, 400, 600, 900, 1400];
export const SPRINKLER_INTERVAL = 2.5; // секунд между поливами
export const SPRINKLER_POSITIONS = [
  { x: 490, y: 125 },  // Зона 1: Морковь
  { x: 490, y: 255 },  // Зона 2: Пшеница
  { x: 490, y: 385 },  // Зона 3: Клубника
  { x: 485, y: 505 },  // Зона 4: Тыква
  { x: 1440, y: 175 }, // Зона 5: Кукуруза (Фаза 2)
  { x: 1440, y: 395 }, // Зона 6: Арбузы (Фаза 2)
];

// --- АВТОМАТИЗАЦИЯ: НАЁМНЫЙ ПОМОЩНИК ---
export const WORKER_COST = 1200;

// --- ТАЙМИНГИ И ИНТЕРВАЛЫ ---
export const MARKET_REFRESH_INTERVAL = 25; // секунд между сменой цен
export const FISH_SPAWN_INTERVAL = 65;      // секунд между всплесками золотой рыбы
export const PEST_CHECK_INTERVAL_DEFAULT = 3.0; // секунд между проверками вредителей
export const PEST_CHECK_INTERVAL_SCARECROW = 6.5; // с пугалом
export const PEST_MAX_TIMER = 8.0;          // секунд до того, как урожай склюют/сгрызут

// --- ЛОКАЦИИ ФАЗЫ 1 ---
export const PHASE1_LOCATIONS = {
  wellX: 90,
  wellY: 270,
  wellRadius: 50,
  pondX: 95,
  pondY: 490,
  barnX: 875,
  barnY: 220,
  shopX: 875,
  shopY: 460,
  scarecrowX: 140,
  scarecrowY: 380,
  workerStartX: 760,
  workerStartY: 320,
};

// --- ЗОНЫ И ГРЯДКИ ФАЗЫ 1 ---
export const PHASE1_ZONES: FarmZone[] = [
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
    cost: 80,
    unlocked: false,
    signX: 200,
    signY: 305,
    fences: [],
  },
  {
    id: 3,
    name: 'Клубничная ферма',
    cropType: 'strawberry',
    cost: 220,
    unlocked: false,
    signX: 200,
    signY: 435,
    fences: [],
  },
  {
    id: 4,
    name: 'Тыквенная плантация',
    cropType: 'pumpkin',
    cost: 480,
    unlocked: false,
    signX: 200,
    signY: 555,
    fences: [],
  },
];

export const PHASE1_PLOT_CONFIGS: PlotConfig[] = [
  // Зона 1: Морковь
  { zoneId: 1, cropType: 'carrot', x: 330, y: 175, w: 125, h: 90 },
  { zoneId: 1, cropType: 'carrot', x: 490, y: 175, w: 125, h: 90 },
  { zoneId: 1, cropType: 'carrot', x: 650, y: 175, w: 125, h: 90 },
  // Зона 2: Пшеница
  { zoneId: 2, cropType: 'wheat', x: 330, y: 305, w: 125, h: 90 },
  { zoneId: 2, cropType: 'wheat', x: 490, y: 305, w: 125, h: 90 },
  { zoneId: 2, cropType: 'wheat', x: 650, y: 305, w: 125, h: 90 },
  // Зона 3: Клубника (Ключ к Фазе 2)
  { zoneId: 3, cropType: 'strawberry', x: 330, y: 435, w: 125, h: 90 },
  { zoneId: 3, cropType: 'strawberry', x: 490, y: 435, w: 125, h: 90 },
  { zoneId: 3, cropType: 'strawberry', x: 650, y: 435, w: 125, h: 90 },
  // Зона 4: Тыква
  { zoneId: 4, cropType: 'pumpkin', x: 390, y: 555, w: 155, h: 90 },
  { zoneId: 4, cropType: 'pumpkin', x: 580, y: 555, w: 155, h: 90 },
];

// --- КОНФИГУРАЦИЯ ФАЗЫ 2 (ВОСТОЧНЫЙ УЧАСТОК И ПРОИЗВОДСТВО) ---
export const PHASE2_CONFIG = {
  gateX: 960,
  gateY: 340,
  wellX: 1810,
  wellY: 260,
  wellRadius: 45,
  millX: 1820,
  millY: 470,
  millCost: 1350,
  chickenCoopX: 1060,
  chickenCoopY: 480,
  chickenCoopCost: 950,
  dairyCowX: 1865,
  dairyCowY: 160,
  dairyCost: 2400,
  burrow1X: 1080,
  burrow1Y: 570,
  burrow2X: 1720,
  burrow2Y: 570,
  unlockCost: 350, // 350 монет для открытия ворот на восток
  triggerCrop: 'strawberry' as CropType, // Открытие клубники готовит Фазу 2
};

export const PHASE2_ZONES: FarmZone[] = [
  {
    id: 5,
    name: 'Кукурузное поле',
    cropType: 'corn',
    cost: 750,
    unlocked: false,
    signX: 1120,
    signY: 230,
    fences: [],
  },
  {
    id: 6,
    name: 'Бахча арбузов',
    cropType: 'watermelon',
    cost: 1800,
    unlocked: false,
    signX: 1120,
    signY: 450,
    fences: [],
  },
];

export const PHASE2_PLOT_CONFIGS: PlotConfig[] = [
  // Зона 5: Кукуруза (Фаза 2)
  { zoneId: 5, cropType: 'corn', x: 1260, y: 230, w: 135, h: 90 },
  { zoneId: 5, cropType: 'corn', x: 1440, y: 230, w: 135, h: 90 },
  { zoneId: 5, cropType: 'corn', x: 1620, y: 230, w: 135, h: 90 },
  // Зона 6: Арбузы (Фаза 2)
  { zoneId: 6, cropType: 'watermelon', x: 1260, y: 450, w: 135, h: 90 },
  { zoneId: 6, cropType: 'watermelon', x: 1440, y: 450, w: 135, h: 90 },
  { zoneId: 6, cropType: 'watermelon', x: 1620, y: 450, w: 135, h: 90 },
];

// --- КОНТРАКТЫ И ЗАКАЗЫ ГОРОДА (ДОСКА ЗАКАЗОВ СКЛАДА) ---
export interface FarmContract {
  id: string;
  title: string;
  customer: string;
  desc: string;
  required: Partial<Record<FarmProductType, number>>;
  rewardCoins: number;
  bonusText: string;
}

export const FARM_CONTRACTS: FarmContract[] = [
  {
    id: 'c1',
    title: 'Завтрак таверны',
    customer: 'Хозяин Таверны',
    desc: 'Гости требуют свежих хрустящих овощей к утренней трапезе!',
    required: { carrot: 5 },
    rewardCoins: 120,
    bonusText: '+30 🪙 чаевые',
  },
  {
    id: 'c2',
    title: 'Зерно для пекарни',
    customer: 'Старый Пекарь',
    desc: 'Запасы зерна истощились, нужна отборная пшеница прямо с поля.',
    required: { wheat: 6 },
    rewardCoins: 280,
    bonusText: '+60 🪙 бонус',
  },
  {
    id: 'c3',
    title: 'Ягодный пирог',
    customer: 'Мэр Долины',
    desc: 'Готовим угощение к визиту гостей из столицы: клубника и морковь.',
    required: { strawberry: 4, carrot: 3 },
    rewardCoins: 580,
    bonusText: '+120 🪙 премия',
  },
  {
    id: 'c4',
    title: 'Праздничный кулич',
    customer: 'Кондитерская Долины',
    desc: 'Свежие яйца и пшеница для воздушного праздничного теста!',
    required: { wheat: 4, egg: 3 },
    rewardCoins: 1100,
    bonusText: '+250 🪙 знак признания',
  },
  {
    id: 'c5',
    title: 'Осенняя ярмарка',
    customer: 'Купеческая гильдия',
    desc: 'Крупная тыква и золотая кукуруза для главного стенда ярмарки!',
    required: { pumpkin: 3, corn: 4 },
    rewardCoins: 2200,
    bonusText: '+500 🪙 гильдейская премия',
  },
  {
    id: 'c6',
    title: 'Королевский банкет',
    customer: 'Королевский шеф-повар',
    desc: 'Сахарные арбузы, парное молоко и тончайшая мука для короны!',
    required: { watermelon: 2, milk: 2, flour: 2 },
    rewardCoins: 3600,
    bonusText: '+1000 🪙 королевская награда',
  },
];

// --- 10 ЭТАПОВ РАЗВИТИЯ ФЕРМЫ (ЖУРНАЛ / ДНЕВНИК ЭВОЛЮЦИИ) ---
export interface FarmMilestone {
  id: number;
  title: string;
  hint: string;
  rewardCoins: number;
}

export const FARM_MILESTONES: FarmMilestone[] = [
  { id: 1, title: 'Первые всходы', hint: 'Соберите 3 урожая сочной моркови 🥕', rewardCoins: 40 },
  { id: 2, title: 'Водный баланс', hint: 'Улучшите лейку до Ур. 2 в магазине мастерской 💧', rewardCoins: 60 },
  { id: 3, title: 'Золотой колос', hint: 'Разблокируйте Пшеничное поле (Зона 2) 🌾', rewardCoins: 90 },
  { id: 4, title: 'Сладкие ягоды', hint: 'Разблокируйте ферму Клубники (Зона 3) 🍓', rewardCoins: 140 },
  { id: 5, title: 'Путь на Восток', hint: 'Откройте ворота в Восточные земли (Фаза 2) 🚪✨', rewardCoins: 200 },
  { id: 6, title: 'Птичий двор', hint: 'Постройте Курятник и соберите свежие яйца 🐔🥚', rewardCoins: 250 },
  { id: 7, title: 'Осенний урожай', hint: 'Разблокируйте Тыквенную плантацию 🎃 и Кукурузное поле 🌽', rewardCoins: 350 },
  { id: 8, title: 'Мельник Долины', hint: 'Запустите Ветряную Мельницу и перемелите зерно в муку 💨🥖', rewardCoins: 450 },
  { id: 9, title: 'Сахарная бахча', hint: 'Разблокируйте Бахчу Арбузов (Зона 6) 🍉', rewardCoins: 600 },
  { id: 10, title: 'Легенда Долины', hint: 'Обустройте ферму коровы 🐄, надоите молока 🥛 и накопите 5,000 🪙!', rewardCoins: 1200 },
];
