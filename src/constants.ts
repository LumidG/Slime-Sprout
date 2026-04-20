import { SlimeTrait } from './types';

/** Google Play listing (same id as `capacitor.config.ts` appId). */
export const PLAY_STORE_LISTING_URL =
  'https://play.google.com/store/apps/details?id=com.nightskygames.slimesprout';

/** Update to your real support address. */
export const SUPPORT_MAILTO =
  'mailto:support@nightskygames.com?subject=' + encodeURIComponent('Slime Sprout support');

export const GAME_WIDTH = 400;
export const GAME_HEIGHT = 600;

export const COIN_CAP = 15;

/**
 * Coin centers are kept inside this rectangle so they stay visible and tappable
 * under floating header / nav / world chrome. The canvas is full-viewport; UI overlays it.
 */
export const COIN_SPAWN_INSETS = {
  /** Header (safe area + stats row) + world name chip */
  top: 104,
  /** Bottom tab bar + home indicator / safe area */
  bottom: 120,
  /** Default horizontal pad; narrow when world chevrons are hidden (see GameWorld props) */
  left: 20,
  right: 20,
} as const;

export const COIN_SPAWN_INSET_X_WITH_WORLD_NAV = 52;

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

/** Caps for shop upgrades on the game tab (automation is 0/1). */
export const MAX_GAME_UPGRADE_LEVEL = {
  movementSpeed: 10,
  respawnTime: 10,
  coinValue: 10,
} as const;

export type GameUpgradeSnapshot = {
  automation: number;
  movementSpeed: number;
  respawnTime: number;
  coinValue: number;
};

export function isGameUpgradeMaxed(
  upgrades: GameUpgradeSnapshot,
  key: keyof GameUpgradeSnapshot
): boolean {
  if (key === 'automation') return upgrades.automation > 0;
  return upgrades[key] >= MAX_GAME_UPGRADE_LEVEL[key];
}

export function areAllGameUpgradesMaxed(upgrades: GameUpgradeSnapshot): boolean {
  return (
    upgrades.automation > 0 &&
    upgrades.movementSpeed >= MAX_GAME_UPGRADE_LEVEL.movementSpeed &&
    upgrades.respawnTime >= MAX_GAME_UPGRADE_LEVEL.respawnTime &&
    upgrades.coinValue >= MAX_GAME_UPGRADE_LEVEL.coinValue
  );
}

export type GameWorldDecoration = 'grass' | 'flowers' | 'reeds' | 'sand' | 'snow' | 'mist';

export type GameWorldTheme = {
  name: string;
  /** Three color stops for the playfield diagonal gradient */
  gradient: [string, string, string];
  accentStroke: string;
  decoration: GameWorldDecoration;
};

/** Playfield worlds (index 0–5). Unlock the next index by maxing all game upgrades. */
export const GAME_WORLDS: readonly GameWorldTheme[] = [
  {
    name: 'Grass Fields',
    gradient: ['#6ee7b7', '#86efac', '#fde68a'],
    accentStroke: '#34d399',
    decoration: 'grass',
  },
  {
    name: 'Scorching Dunes',
    gradient: ['#fdba74', '#f97316', '#fde68a'],
    accentStroke: '#ea580c',
    decoration: 'sand',
  },
  {
    name: 'Floral Slope',
    gradient: ['#fbcfe8', '#e9d5ff', '#fef3c7'],
    accentStroke: '#ec4899',
    decoration: 'flowers',
  },
  {
    name: 'Soggy Swamps',
    gradient: ['#115e59', '#0d9488', '#134e4a'],
    accentStroke: '#5eead4',
    decoration: 'reeds',
  },
  {
    name: 'Snowy Peak',
    gradient: ['#e0f2fe', '#bae6fd', '#f0f9ff'],
    accentStroke: '#7dd3fc',
    decoration: 'snow',
  },
  {
    name: 'Milky Fog',
    gradient: ['#e4e4e7', '#d4d4d8', '#fafafa'],
    accentStroke: '#a1a1aa',
    decoration: 'mist',
  },
] as const;

/**
 * Maps a saved world index from before Scorching Dunes was moved to slot 2 (third in line).
 * Old: …, Swamps, Dunes, … → New: …, Dunes, Swamps, …
 */
export const GAME_WORLD_INDEX_MIGRATE_SAND_THIRD: readonly number[] = [0, 1, 3, 2, 4, 5];

export function migrateMaxUnlockedToSandThirdOrder(oldMax: number): number {
  const cap = Math.min(5, Math.max(0, Math.floor(oldMax)));
  let maxNew = 0;
  for (let i = 0; i <= cap; i++) {
    maxNew = Math.max(maxNew, GAME_WORLD_INDEX_MIGRATE_SAND_THIRD[i] ?? i);
  }
  return Math.min(5, maxNew);
}

/** After sand-third order: swap indices 1 ↔ 2 so Dunes (sand) is before Floral. */
export const GAME_WORLD_INDEX_MIGRATE_SAND_FLOWER_SWAP: readonly number[] = [0, 2, 1, 3, 4, 5];

export function migrateMaxUnlockedToSandFlowerOrder(oldMax: number): number {
  const cap = Math.min(5, Math.max(0, Math.floor(oldMax)));
  let maxNew = 0;
  for (let i = 0; i <= cap; i++) {
    maxNew = Math.max(maxNew, GAME_WORLD_INDEX_MIGRATE_SAND_FLOWER_SWAP[i] ?? i);
  }
  return Math.min(5, maxNew);
}

export const EGG_COST = 100;

/** Coins required to breed two slimes (market tab). */
export const BREEDING_COST = 500;

export const SLIME_UPGRADE_COST = (level: number) => Math.floor(50 * Math.pow(1.8, level));

export const SLIME_NAMES = [
  'Bloop', 'Gloop', 'Squish', 'Pudding', 'Jelly', 'Mochi', 'Bubbles', 'Dewy',
  'Gummy', 'Splosh', 'Blobby', 'Slimy', 'Goopy', 'Sticky', 'Bounce', 'Plop',
  'Wobble', 'Glaze', 'Syrup', 'Honey', 'Berry', 'Minty', 'Coco', 'Sunny',
  'Cloudy', 'Sparky', 'Zippy', 'Chonky', 'Tiny', 'Peanut', 'Bean', 'Sprout',
  'Marshmallow', 'Taffy', 'Boba', 'Matcha', 'Yuzu'
];
