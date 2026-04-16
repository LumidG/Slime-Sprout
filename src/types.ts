export type SlimeTrait = 'Fast' | 'Strong' | 'Lucky' | 'Hardy' | 'Shiny';

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
  eggs: 0,
  hatchingEgg: null,
  newlyHatchedSlime: null,
  activeTab: 'game',
  activeSubTab: 'collect',
  hasCompletedOnboarding: false,
};
