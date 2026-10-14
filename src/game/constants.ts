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

// --- КУЛЬТУРЫ И ИХ ХАРАКТЕРИСТИКИ ---
export type CropType = 'carrot' | 'wheat' | 'strawberry' | 'pumpkin' | 'corn' | 'watermelon';

export interface CropInfo {
  name: string;
  icon: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  growthWatered: number; // Время роста с поливом (сек)
  growthDry: number;     // Время роста без полива (сек)
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
  corn: {
    name: 'Кукуруза',
    icon: '🌽',
    basePrice: 240,
    minPrice: 170,
    maxPrice: 400,
    growthWatered: 7.5,
    growthDry: 20.0,
  },
  watermelon: {
    name: 'Арбуз',
    icon: '🍉',
    basePrice: 450,
    minPrice: 300,
    maxPrice: 750,
    growthWatered: 11.5,
    growthDry: 32.0,
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
  // Графические объекты
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
export const INITIAL_WATER = 3;

// --- ПРОКАЧКА: ЛЕЙКА ---
export const WATER_CAPACITIES = [3, 5, 8, 12];
export const WATER_UPGRADE_COSTS = [50, 130, 300];

// --- ПРОКАЧКА: САПОГИ СКОРОСТИ ---
export const SPEED_VALUES = [240, 300, 370];
export const SPEED_UPGRADE_COSTS = [70, 180];

// --- ПРОКАЧКА: ПУГАЛО ОТ ВОРОН ---
export const SCARECROW_COST = 140;

// --- АВТОМАТИЗАЦИЯ: СПРИНКЛЕРЫ (ОРОСИТЕЛИ) ---
export const SPRINKLER_COSTS = [80, 150, 240, 350, 480, 650];
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
export const WORKER_COST = 160;

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

// --- КОНФИГУРАЦИЯ ФАЗЫ 2 (ВОСТОЧНЫЙ УЧАСТОК) ---
export const PHASE2_CONFIG = {
  gateX: 960,
  gateY: 340,
  wellX: 1810,
  wellY: 260,
  wellRadius: 45,
  millX: 1820,
  millY: 470,
  burrow1X: 1080,
  burrow1Y: 520,
  burrow2X: 1720,
  burrow2Y: 520,
  unlockCost: 1, // 1 монета для быстрого тестирования
  triggerCrop: 'strawberry' as CropType, // Открытие клубники запускает Фазу 2!
};

export const PHASE2_ZONES: FarmZone[] = [
  {
    id: 5,
    name: 'Кукурузное поле',
    cropType: 'corn',
    cost: 1,
    unlocked: false,
    signX: 1120,
    signY: 230,
    fences: [],
  },
  {
    id: 6,
    name: 'Бахча арбузов',
    cropType: 'watermelon',
    cost: 1,
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
