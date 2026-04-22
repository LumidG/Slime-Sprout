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
  /** Layer 2: eyes — always present; `s_Eyes1`–`s_Eyes4` (index 1–4). */
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

/** Single slime auction in the Slime Market (offline-simulated). */
export interface SlimeMarketAuction {
  id: string;
  slime: Slime;
  seller: 'player' | 'npc';
  endsAt: number;
  /** Highest bid so far (0 if none). */
  currentBid: number;
  /** Minimum coins for the first bid. */
  minBid: number;
  highBidder: 'player' | 'npc' | null;
  /** Coins the local player currently has committed as the high bid (only if highBidder === 'player'). */
  playerBidAmount: number;
  /**
   * NPC listing only: set after the player places any bid; instant buy stays disabled until this
   * auction ends (even if an NPC later outbids them).
   */
  npcInstantBuyLocked?: boolean;
  /**
   * Player listing only: guaranteed coins you would have had from “sell now” for this slime — used
   * for UI and for NPC bid simulation (auction starts below this, may later exceed it).
   */
  playerSellNowSnapshot?: number;
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
  /** Slime ids whose detail modal has been opened at least once (persists). */
  slimeDetailSeenIds: string[];
  equippedSlimeIds: string[];
  eggs: number;
  hatchingEgg: {
    progress: number;
    startTime: number;
  } | null;
  newlyHatchedSlime: Slime | null;

  /** Player slime auctions + NPC listings; persisted. */
  slimeMarketAuctions: SlimeMarketAuction[];

  /**
   * Slime id → timestamp (ms) when arena **ability** cooldown ends (after using an ability in battle).
   */
  slimeArenaAbilityCooldownUntil: Record<string, number>;

  /** Lifetime arena victories; used to ease the first couple of encounters for new teams. */
  arenaWins: number;

  // UI State
  activeTab: 'game' | 'slimes' | 'market' | 'slimeMarket' | 'arena';
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
  slimeDetailSeenIds: [],
  equippedSlimeIds: [],
  eggs: 0,
  hatchingEgg: null,
  newlyHatchedSlime: null,
  slimeMarketAuctions: [],
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
};
