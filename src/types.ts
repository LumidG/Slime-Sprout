export type SlimeTrait = 
  | 'Swift' | 'Fast' | 'Sonic' 
  | 'Inspiring' | 'Motivating' 
  | 'Magnetic' | 'Hypnotic' 
  | 'Lucky' | 'Golden' 
  | 'Haste' | 'Frenzy' 
  | 'None';

export interface SlimeStats {
  health: number;
  strength: number;
  agility: number;
}

export interface Slime {
  id: string;
  name: string;
  color: string;
  stats: SlimeStats;
  statLevels: SlimeStats; // Individual levels for pricing
  trait: SlimeTrait;
  level: number;
  value: number;
  hatchedAt: number;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  level: number;
  baseCost: number;
  costMultiplier: number;
}

export interface GameState {
  coins: number;
  totalCoinsCollected: number;
  lastSavedTime: number;
  
  // Upgrades
  upgrades: {
    automation: number; // 0 or 1
    movementSpeed: number;
    respawnTime: number;
    coinValue: number;
  };

  // Slimes
  slimes: Slime[];
  equippedSlimeIds: string[];
  eggs: number;
  hatchingEgg: {
    progress: number;
    startTime: number;
  } | null;
  newlyHatchedSlime: Slime | null;

  // UI State
  activeTab: 'game' | 'slimes' | 'market';
  activeSubTab: string;
  hasCompletedOnboarding: boolean;

  /** Selected playfield (0–5). Must be ≤ maxUnlockedGameWorld. */
  gameWorldIndex: number;
  /** Highest world index the player can open (0–5). Next unlocks when all game upgrades are maxed. */
  maxUnlockedGameWorld: number;

  /**
   * True once `gameWorldIndex` / `maxUnlockedGameWorld` use the order where Scorching Dunes is third.
   * Absent on older saves triggers a one-time remap on load.
   */
  worldOrderSandThird?: boolean;

  /**
   * True once indices use the order where Scorching Dunes (sand) is before Floral Slope.
   * Absent on older saves triggers a one-time remap on load.
   */
  worldOrderSandFlowerSwap?: boolean;

  /** App preferences (persisted). Used when game audio is wired up. */
  settings: {
    musicEnabled: boolean;
    /** Music volume 0–1 when music is enabled. */
    musicVolume: number;
    sfxEnabled: boolean;
    /** Sound effects volume 0–1 when SFX are enabled. */
    sfxVolume: number;
  };
}

export const INITIAL_STATE: GameState = {
  coins: 0,
  totalCoinsCollected: 0,
  lastSavedTime: Date.now(),
  upgrades: {
    automation: 0,
    movementSpeed: 1,
    respawnTime: 1,
    coinValue: 1,
  },
  slimes: [],
  equippedSlimeIds: [],
  eggs: 0,
  hatchingEgg: null,
  newlyHatchedSlime: null,
  activeTab: 'game',
  activeSubTab: 'collect',
  hasCompletedOnboarding: false,
  gameWorldIndex: 0,
  maxUnlockedGameWorld: 0,
  worldOrderSandThird: true,
  worldOrderSandFlowerSwap: true,
  settings: {
    musicEnabled: true,
    musicVolume: 1,
    sfxEnabled: true,
    sfxVolume: 1,
  },
};
