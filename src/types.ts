export type SlimeTrait = 
  | 'Swift' | 'Fast' | 'Sonic' 
  | 'Inspiring' | 'Motivating' 
  | 'Magnetic' | 'Hypnotic' 
  | 'Lucky' | 'Golden' 
  | 'Haste' | 'Frenzy' 
  | 'None';

/** Combat skill for Slime Arena only — separate from coin-field traits. */
export type SlimeArenaAbility =
  | 'None'
  | 'Rally'
  | 'Fortify'
  | 'Smash'
  | 'Rush'
  | 'Harmony';

export interface SlimeStats {
  health: number;
  strength: number;
  agility: number;
}

export interface Slime {
  id: string;
  name: string;
  color: string;
  /** Layer 1: body sprite `s_Slime1`–`s_Slime8` (index 1–8). */
  slimeBody: number;
  /** Layer 2: eyes — `0` = none; otherwise `s_Eyes1`–`s_Eyes4` (index 1–4). */
  slimeEyes: number;
  /** Layer 3: accessory, or 0 for none; `s_Accessory1`–`s_Accessory6` (index 1–6). */
  slimeAccessory: number;
  stats: SlimeStats;
  statLevels: SlimeStats; // Individual levels for pricing
  trait: SlimeTrait;
  /** Used only in Slime Arena; has its own cooldown when activated. */
  arenaAbility: SlimeArenaAbility;
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
    slimeMovementSpeed: number;
    respawnTime: number;
    coinValue: number;
    coinCap: number;
    /** Slime Cap tier (0–17): each tier adds +1 equip slot above the base 3. */
    slimeCap: number;
  };

  // Slimes
  slimes: Slime[];
  /** Slime ids whose detail modal has been opened at least once (persists). */
  slimeDetailSeenIds: string[];
  equippedSlimeIds: string[];
  /** Rare currency used for breeding. Earned from arena wins. */
  tickets: number;

  eggs: number;
  hatchingEgg: {
    progress: number;
    startTime: number;
  } | null;
  newlyHatchedSlime: Slime | null;
  /** Set when the player buys x10 slimes; shown in the multi-slime celebration overlay. */
  newlyHatchedSlimes: Slime[] | null;

  /**
   * Active breeding egg that the player must tap to hatch.
   * Set when breeding is initiated; cleared once progress reaches 100.
   */
  breedingEgg: {
    progress: number;
    pendingSlime: Slime;
  } | null;

  /**
   * Slime id → timestamp (ms) when arena **ability** cooldown ends (after using an ability in battle).
   */
  slimeArenaAbilityCooldownUntil: Record<string, number>;

  /** Lifetime arena victories; used to ease the first couple of encounters for new teams. */
  arenaWins: number;

  // UI State
  activeTab: 'game' | 'slimes' | 'market' | 'arena';
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
    sfxEnabled: boolean;
    /** Subtle native haptics on button taps (Capacitor Android/iOS). */
    hapticsEnabled: boolean;
  };

  /** Raw coins collected in the current world session (resets on world unlock). */
  worldCoinsCollected: number;
  /** Which of the 5 per-world level goals have been claimed (resets on world unlock). */
  worldGoalsClaimed: [boolean, boolean, boolean, boolean, boolean];
}

export const INITIAL_STATE: GameState = {
  coins: 0,
  totalCoinsCollected: 0,
  lastSavedTime: Date.now(),
  upgrades: {
    automation: 0,
    movementSpeed: 1,
    slimeMovementSpeed: 1,
    respawnTime: 1,
    coinValue: 1,
    coinCap: 1,
    slimeCap: 0,
  },
  slimes: [],
  slimeDetailSeenIds: [],
  equippedSlimeIds: [],
  tickets: 0,
  eggs: 0,
  hatchingEgg: null,
  newlyHatchedSlime: null,
  newlyHatchedSlimes: null,
  breedingEgg: null,
  slimeArenaAbilityCooldownUntil: {},
  arenaWins: 0,
  activeTab: 'game',
  activeSubTab: 'collect',
  hasCompletedOnboarding: false,
  gameWorldIndex: 0,
  maxUnlockedGameWorld: 0,
  worldOrderSandThird: true,
  worldOrderSandFlowerSwap: true,
  settings: {
    musicEnabled: true,
    sfxEnabled: true,
    hapticsEnabled: false,
  },
  worldCoinsCollected: 0,
  worldGoalsClaimed: [false, false, false, false, false],
};
