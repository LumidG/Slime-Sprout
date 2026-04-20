import {
  GameState,
  Slime,
  SlimeArenaAbility,
  SlimeMarketAuction,
  SlimeStats,
  SlimeTrait,
} from './types';

/** Google Play listing (same id as `capacitor.config.ts` appId). */
export const PLAY_STORE_LISTING_URL =
  'https://play.google.com/store/apps/details?id=com.nightskygames.slimesprout';

/** Update to your real support address. */
export const SUPPORT_MAILTO =
  'mailto:support@nightskygames.com?subject=' + encodeURIComponent('Slime Sprout support');

export const GAME_WIDTH = 400;
export const GAME_HEIGHT = 600;

/** Max coins on screen: 2 per respawn-time upgrade level (2, 4, 6, …). */
export function onScreenCoinCap(respawnTimeLevel: number): number {
  return 2 * Math.max(1, Math.floor(respawnTimeLevel));
}

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

/** Max simulated offline time when applying automation idle gains (matches load/save logic). */
export const OFFLINE_IDLE_CAP_MS = 12 * 60 * 60 * 1000;

/**
 * Idle coins from automation while the app was closed or in background (respawn-rate based).
 * Does not include equipped-slime trait bonuses (same as load path in App).
 */
export function computeOfflineIdleGain(
  upgrades: Pick<GameState['upgrades'], 'automation' | 'respawnTime' | 'coinValue'>,
  elapsedMs: number
): { idleCoins: number; currencyEarned: number } {
  if (upgrades.automation <= 0 || elapsedMs <= 0) {
    return { idleCoins: 0, currencyEarned: 0 };
  }
  const capped = Math.min(elapsedMs, OFFLINE_IDLE_CAP_MS);
  const respawnInterval = BASE_RESPAWN_TIME / (1 + upgrades.respawnTime * 0.2);
  const coinsPerSecond = 1 / (respawnInterval / 1000);
  const idleCoins = Math.floor((capped / 1000) * coinsPerSecond);
  const currencyEarned = idleCoins * upgrades.coinValue;
  return { idleCoins, currencyEarned };
}

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

/** Arena: losing a fight puts all participating slimes on cooldown everywhere. */
export const ARENA_COOLDOWN_MS = 5 * 60 * 1000;

/** Arena squad: 3 starters + up to 2 reserves. */
export const ARENA_STARTERS = 3;
export const ARENA_RESERVES = 2;

/** Arena battle: energy orbs fill the ability bar; one use when it reaches full. */
export const ARENA_ENERGY_PER_ORB = 0.26;
export const ARENA_ENERGY_ORBS_PER_SIDE = 5;
export const ARENA_ENERGY_RESPAWN_MS = 1100;
/** Fade duration for ability-use VFX after the bar fires. */
export const ARENA_ABILITY_PROC_MS = 700;

export const ARENA_ABILITIES: SlimeArenaAbility[] = [
  'None',
  'Rally',
  'Fortify',
  'Smash',
  'Rush',
  'Harmony',
];

/** Arena-only skills (separate from coin-field `trait`). Cooldown applies after use in a fight. */
export const ARENA_ABILITY_META: Record<
  SlimeArenaAbility,
  { name: string; description: string; cooldownMs: number }
> = {
  None: { name: 'None', description: 'No arena skill.', cooldownMs: 0 },
  Rally: {
    name: 'Rally',
    description: 'Arena: +15 effective power when used this fight.',
    cooldownMs: 3 * 60 * 1000,
  },
  Fortify: {
    name: 'Fortify',
    description: 'Arena: adds 40% of Health as bonus power.',
    cooldownMs: 3 * 60 * 1000,
  },
  Smash: {
    name: 'Smash',
    description: 'Arena: adds 50% of Strength as bonus power.',
    cooldownMs: 3 * 60 * 1000,
  },
  Rush: {
    name: 'Rush',
    description: 'Arena: adds 50% of Agility as bonus power.',
    cooldownMs: 3 * 60 * 1000,
  },
  Harmony: {
    name: 'Harmony',
    description: 'Arena: adds 12% of this slime’s matchup score as bonus power.',
    cooldownMs: 4 * 60 * 1000,
  },
};

const ARENA_ABILITY_ROLL_POOL: Exclude<SlimeArenaAbility, 'None'>[] = [
  'Rally',
  'Fortify',
  'Smash',
  'Rush',
  'Harmony',
];

/** Random ability for new slimes (~15% None). */
export function rollRandomArenaAbility(): SlimeArenaAbility {
  if (Math.random() < 0.15) return 'None';
  return ARENA_ABILITY_ROLL_POOL[Math.floor(Math.random() * ARENA_ABILITY_ROLL_POOL.length)]!;
}

export type ArenaStatWeights = {
  health: number;
  strength: number;
  agility: number;
};

export type ArenaEncounter = {
  /** Seed used to regenerate the same encounter after load (optional UX). */
  seed: number;
  weights: ArenaStatWeights;
  primaryStat: keyof SlimeStats;
  secondaryStat: keyof SlimeStats;
  /** Hidden — used only for resolution. */
  enemyPower: number;
  rewardCoins: number;
};

/** Seeded PRNG (same family as slime market). */
function arenaRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const STAT_LABEL_SHORT: Record<keyof SlimeStats, string> = {
  health: 'Health',
  strength: 'Strength',
  agility: 'Agility',
};

export function getArenaStatLabel(stat: keyof SlimeStats): string {
  return STAT_LABEL_SHORT[stat];
}

/** Procedural opponent: weights show what matters; power and reward stay hidden until after the fight. */
export function generateArenaEncounter(seed: number): ArenaEncounter {
  const r = arenaRand(seed + 42_001);
  const stats: (keyof SlimeStats)[] = ['health', 'strength', 'agility'];
  const primaryStat = stats[Math.floor(r() * 3)]!;
  const rest = stats.filter((x) => x !== primaryStat);
  const secondaryStat = rest[Math.floor(r() * 2)]!;
  const tertiary = stats.find((x) => x !== primaryStat && x !== secondaryStat)!;
  const wp = 0.44 + r() * 0.12;
  const ws = 0.26 + r() * 0.1;
  const wt = Math.max(0.08, 1 - wp - ws);
  const weights: ArenaStatWeights = { health: 0, strength: 0, agility: 0 };
  weights[primaryStat] = wp;
  weights[secondaryStat] = ws;
  weights[tertiary] = wt;
  const sum = weights.health + weights.strength + weights.agility;
  weights.health /= sum;
  weights.strength /= sum;
  weights.agility /= sum;

  const enemyPower = 95 + Math.floor(r() * 145);
  const rewardCoins = 32 + Math.floor(enemyPower * 0.38);

  return {
    seed,
    weights,
    primaryStat,
    secondaryStat,
    enemyPower,
    rewardCoins,
  };
}

/** Visual-only rivals for the arena battle screen (not persisted). */
export type ArenaEnemyDisplay = {
  id: string;
  name: string;
  color: string;
  ability: SlimeArenaAbility;
  /** Used for arena canvas movement speed (same formula as main field). */
  agility: number;
};

export function generateArenaEnemyTeam(encounter: ArenaEncounter): ArenaEnemyDisplay[] {
  const r = arenaRand(encounter.seed + 99_001);
  const first = ['Gloom', 'Vex', 'Rune', 'Mire', 'Frost', 'Ember', 'Shard', 'Dusk'];
  const second = ['claw', 'fang', 'mire', 'veil', 'puff', 'wisp', 'gloom', 'shade'];
  const colors = ['#6d28d9', '#b91c1c', '#0d9488', '#c026d3', '#2563eb', '#ca8a04', '#4b5563'];
  const abilities: SlimeArenaAbility[] = ['Rally', 'Fortify', 'Smash', 'Rush', 'Harmony'];
  return [0, 1, 2].map((i) => {
    const a = r() > 0.15 ? abilities[Math.floor(r() * abilities.length)]! : 'None';
    return {
      id: `arena-enemy-${encounter.seed}-${i}`,
      name: `${first[Math.floor(r() * first.length)]!} ${second[Math.floor(r() * second.length)]!}`,
      color: colors[Math.floor(r() * colors.length)]!,
      ability: a,
      agility: 5 + Math.floor(r() * 16),
    };
  });
}

export function arenaWeightedScore(slime: Slime, weights: ArenaStatWeights): number {
  return (
    weights.health * slime.stats.health +
    weights.strength * slime.stats.strength +
    weights.agility * slime.stats.agility
  );
}

export function arenaAbilityBonus(
  ability: SlimeArenaAbility,
  slime: Slime,
  weights: ArenaStatWeights
): number {
  if (ability === 'None') return 0;
  const base = arenaWeightedScore(slime, weights);
  switch (ability) {
    case 'Rally':
      return 15;
    case 'Fortify':
      return slime.stats.health * 0.4;
    case 'Smash':
      return slime.stats.strength * 0.5;
    case 'Rush':
      return slime.stats.agility * 0.5;
    case 'Harmony':
      return base * 0.12;
    default:
      return 0;
  }
}

function slimeLinePower(
  slime: Slime,
  weights: ArenaStatWeights,
  abilityUsed: boolean
): number {
  const base = arenaWeightedScore(slime, weights);
  if (!abilityUsed || slime.arenaAbility === 'None') return base;
  return base + arenaAbilityBonus(slime.arenaAbility, slime, weights);
}

export function resolveArenaBattle(
  encounter: ArenaEncounter,
  starters: [Slime, Slime, Slime],
  reserves: [Slime | undefined, Slime | undefined],
  /** Slime ids that activate their arena ability this fight (must be off ability cooldown). */
  arenaAbilityUsedIds: Record<string, boolean> = {}
): { won: boolean } {
  const enemy = encounter.enemyPower;
  const w = encounter.weights;
  const use = (s: Slime) => Boolean(arenaAbilityUsedIds[s.id]);
  let p =
    slimeLinePower(starters[0], w, use(starters[0])) +
    slimeLinePower(starters[1], w, use(starters[1])) +
    slimeLinePower(starters[2], w, use(starters[2]));
  if (p >= enemy) return { won: true };
  if (reserves[0]) {
    p += slimeLinePower(reserves[0], w, use(reserves[0]));
    if (p >= enemy) return { won: true };
  }
  if (reserves[1]) {
    p += slimeLinePower(reserves[1], w, use(reserves[1]));
    if (p >= enemy) return { won: true };
  }
  return { won: false };
}

export function isSlimeOnCooldown(
  slimeCooldownUntil: Record<string, number>,
  slimeId: string,
  now: number = Date.now()
): boolean {
  return (slimeCooldownUntil[slimeId] ?? 0) > now;
}

export function isArenaAbilityOnCooldown(
  slimeArenaAbilityCooldownUntil: Record<string, number>,
  slimeId: string,
  now: number = Date.now()
): boolean {
  return (slimeArenaAbilityCooldownUntil[slimeId] ?? 0) > now;
}

export const UPGRADE_COSTS = {
  automation: 25,
  movementSpeed: (level: number) => Math.floor(10 * Math.pow(1.5, level)),
  respawnTime: (level: number) => Math.floor(15 * Math.pow(1.6, level)),
  /** Cost to buy the next level: 1, 2, 3, … (current level = price). */
  coinValue: (level: number) => level,
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
    gradient: ['#ccfbf1', '#99f6e4', '#5eead4'],
    accentStroke: '#0d9488',
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

/** How long slime market auctions run (ms). */
export const SLIME_MARKET_AUCTION_MS = 4 * 60 * 1000;

/** Minimum step between bids. */
export const SLIME_MARKET_MIN_BID_STEP = 40;

/** How many NPC-run auctions to keep in rotation. */
export const SLIME_MARKET_NPC_TARGET_LISTINGS = 4;

/** Seeded PRNG for daily market copy (deterministic per day index). */
function marketRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const STAT_LABEL: Record<keyof SlimeStats, string> = {
  health: 'Health',
  strength: 'Strength',
  agility: 'Agility',
};

export type SlimeMarketTrend = {
  mood: string;
  hotTraitA: SlimeTrait;
  hotTraitB: SlimeTrait;
  hotStat: keyof SlimeStats;
  hotStatLabel: string;
  avgSaleBand: string;
  footnote: string;
};

/** Daily rotating “market report” for the Slime Market header. */
export function getSlimeMarketTrend(dayIndex: number): SlimeMarketTrend {
  const r = marketRand(dayIndex + 1337);
  const traitPool = TRAITS.filter((t) => t !== 'None');
  const hotTraitA = traitPool[Math.floor(r() * traitPool.length)]!;
  let hotTraitB = traitPool[Math.floor(r() * traitPool.length)]!;
  if (hotTraitB === hotTraitA && traitPool.length > 1) {
    hotTraitB = traitPool.filter((t) => t !== hotTraitA)[Math.floor(r() * (traitPool.length - 1))]!;
  }
  const stats: (keyof SlimeStats)[] = ['health', 'strength', 'agility'];
  const hotStat = stats[Math.floor(r() * stats.length)]!;
  const moods = ['Bullish', 'Active', 'Heated', 'Calm', 'Frenzied', 'Soft'];
  const mood = moods[Math.floor(r() * moods.length)]!;
  const low = 80 + Math.floor(r() * 120);
  const high = low + 40 + Math.floor(r() * 80);
  const footnotes = [
    'Collectors are paying more for matching trait pairs.',
    'Rare colors are moving faster than yesterday.',
    'Low-level slimes still sell — trainers want blanks to upgrade.',
    'High agility slimes are popular in the Grass Fields meta.',
  ];
  return {
    mood,
    hotTraitA,
    hotTraitB,
    hotStat,
    hotStatLabel: STAT_LABEL[hotStat],
    avgSaleBand: `${low}–${high}`,
    footnote: footnotes[Math.floor(r() * footnotes.length)]!,
  };
}

/** Procedural slime for NPC market listings (not from player collection). */
export function createNpcMarketSlime(): Slime {
  return {
    id: `npc-${Math.random().toString(36).slice(2, 11)}`,
    name: SLIME_NAMES[Math.floor(Math.random() * SLIME_NAMES.length)]!,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    stats: {
      health: 12 + Math.floor(Math.random() * 18),
      strength: 6 + Math.floor(Math.random() * 14),
      agility: 6 + Math.floor(Math.random() * 14),
    },
    statLevels: { health: 1, strength: 1, agility: 1 },
    trait: TRAITS[Math.floor(Math.random() * TRAITS.length)]!,
    arenaAbility: rollRandomArenaAbility(),
    level: 1 + Math.floor(Math.random() * 8),
    value: 60 + Math.floor(Math.random() * 160),
    hatchedAt: Date.now(),
  };
}

export function getNextMarketBid(a: SlimeMarketAuction): number {
  if (a.currentBid === 0 && a.highBidder === null) return a.minBid;
  return a.currentBid + SLIME_MARKET_MIN_BID_STEP;
}

/**
 * NPC listing: pay this now (always strictly less than {@link getNextMarketBid}) to take the slime
 * immediately without waiting for the auction to end.
 */
export function getInstantNpcBuyPrice(a: SlimeMarketAuction): number {
  const next = getNextMarketBid(a);
  if (next <= 1) return 1;
  const raw = Math.floor(next * 0.72);
  return Math.max(1, Math.min(next - 1, raw));
}

/**
 * Resolves expired auctions, simulates NPC bids on player listings, and tops up NPC listings.
 * Call on an interval from the game shell.
 */
export function processSlimeMarketTick(prev: GameState): GameState {
  const now = Date.now();
  let coins = prev.coins;
  let slimes = prev.slimes;
  const equippedSlimeIds = prev.equippedSlimeIds;

  const stillActive: SlimeMarketAuction[] = [];

  for (const a of prev.slimeMarketAuctions) {
    if (a.endsAt > now) {
      stillActive.push(a);
      continue;
    }

    if (a.seller === 'npc') {
      if (a.highBidder === 'player') {
        slimes = [...slimes, a.slime];
      }
      continue;
    }

    if (a.seller === 'player') {
      if (a.highBidder === 'npc' && a.currentBid > 0) {
        coins += a.currentBid;
      } else if (a.highBidder === null) {
        slimes = [...slimes, a.slime];
      } else if (a.highBidder === 'player') {
        slimes = [...slimes, a.slime];
        coins += a.playerBidAmount;
      }
    }
  }

  const ticked = stillActive.map((a) => {
    if (a.seller !== 'player' || a.endsAt <= now) return a;
    if (a.highBidder === 'player') return a;
    if (Math.random() >= 0.14) return a;
    const step = a.currentBid === 0 ? a.minBid : a.currentBid + SLIME_MARKET_MIN_BID_STEP;
    const cap = Math.floor(a.slime.value * 1.85);
    if (step > cap) return a;
    return { ...a, currentBid: step, highBidder: 'npc' as const };
  });

  let result = [...ticked];
  let npcCount = result.filter((x) => x.seller === 'npc').length;
  while (npcCount < SLIME_MARKET_NPC_TARGET_LISTINGS) {
    const slime = createNpcMarketSlime();
    const minBid = Math.max(45, Math.floor(slime.value * 0.55));
    result.push({
      id: `npc-auc-${Math.random().toString(36).slice(2, 11)}`,
      slime,
      seller: 'npc',
      endsAt: now + SLIME_MARKET_AUCTION_MS,
      currentBid: 0,
      minBid,
      highBidder: null,
      playerBidAmount: 0,
    });
    npcCount++;
  }

  return { ...prev, coins, slimes, equippedSlimeIds, slimeMarketAuctions: result };
}
