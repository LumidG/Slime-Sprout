import { SlimeTrait } from './types';

export const GAME_WIDTH = 400;
export const GAME_HEIGHT = 600;

export const COIN_CAP = 15;
export const BASE_RESPAWN_TIME = 3000; // ms
export const BASE_MOVEMENT_SPEED = 1.5;

export const COLORS = [
  '#FF5F5F', // Red
  '#5FFF5F', // Green
  '#5F5FFF', // Blue
  '#FFFF5F', // Yellow
  '#FF5FFF', // Magenta
  '#5FFFFF', // Cyan
  '#FFAF5F', // Orange
  '#AF5FFF', // Purple
];

export const TRAITS: SlimeTrait[] = [
  'None', 'Swift', 'Fast', 'Sonic',
  'Inspiring', 'Motivating', 'Magnetic', 'Hypnotic',
  'Lucky', 'Golden', 'Haste', 'Frenzy'
];

export const BASE_SLIME_SPEED = 0.8;
export const BASE_COLLECT_RADIUS = 25;
export const BASE_SLIME_COLLECT_RADIUS = 15;

export const TRAIT_EFFECTS: Record<SlimeTrait, {
  description: string;
  playerSpeed?: number;
  slimeSpeed?: number;
  selfSpeed?: number;
  radius?: number;
  coinValue?: number;
}> = {
  None: { description: 'No special traits.' },
  Swift: { description: 'Burst: Moves 50% faster for 5s.', selfSpeed: 0.5 },
  Fast: { description: 'Burst: Moves 100% faster for 5s.', selfSpeed: 1.0 },
  Sonic: { description: 'Burst: Moves 200% faster for 5s!', selfSpeed: 2.0 },
  Inspiring: { description: 'Burst: Boosts player speed by 25% for 5s.', playerSpeed: 0.25 },
  Motivating: { description: 'Burst: Boosts player speed by 50% for 5s.', playerSpeed: 0.5 },
  Magnetic: { description: 'Burst: x2 collection radius for 5s.', radius: 1.0 },
  Hypnotic: { description: 'Burst: x3 collection radius for 5s!', radius: 2.0 },
  Lucky: { description: 'Burst: Gives +2 coins per collection for 5s.', coinValue: 2 },
  Golden: { description: 'Burst: Gives +5 coins per collection for 5s!', coinValue: 5 },
  Haste: { description: 'Burst: Team moves 30% faster for 5s.', slimeSpeed: 0.3 },
  Frenzy: { description: 'Burst: Team moves 60% faster for 5s!', slimeSpeed: 0.6 },
};

export const MAX_EQUIPPED_SLIMES = 3;

export const UPGRADE_COSTS = {
  automation: 25,
  movementSpeed: (level: number) => Math.floor(10 * Math.pow(1.5, level)),
  respawnTime: (level: number) => Math.floor(15 * Math.pow(1.6, level)),
  coinValue: (level: number) => Math.floor(20 * Math.pow(2, level)),
};

export const EGG_COST = 100;

export const SLIME_UPGRADE_COST = (level: number) => Math.floor(50 * Math.pow(1.8, level));

export const SLIME_NAMES = [
  'Bloop', 'Gloop', 'Squish', 'Pudding', 'Jelly', 'Mochi', 'Bubbles', 'Dewy',
  'Gummy', 'Splosh', 'Blobby', 'Slimy', 'Goopy', 'Sticky', 'Bounce', 'Plop',
  'Wobble', 'Glaze', 'Syrup', 'Honey', 'Berry', 'Minty', 'Coco', 'Sunny',
  'Cloudy', 'Sparky', 'Zippy', 'Chonky', 'Tiny', 'Peanut', 'Bean', 'Sprout',
  'Marshmallow', 'Taffy', 'Boba', 'Matcha', 'Yuzu'
];
