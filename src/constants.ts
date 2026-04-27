import {
  GameState,
  Slime,
  SlimeArenaAbility,
  SlimeStats,
  SlimeTrait,
} from './types';
import { rollNewSlimeVisuals } from './slimeSprites';

/** Google Play listing (same id as `capacitor.config.ts` appId). */
export const PLAY_STORE_LISTING_URL =
  'https://play.google.com/store/apps/details?id=com.nightskygames.slimesprout';

/** Update to your real support address. */
export const SUPPORT_MAILTO =
  'mailto:support@nightskygames.com?subject=' + encodeURIComponent('Slime School Tycoon support');

export const GAME_WIDTH = 400;
export const GAME_HEIGHT = 600;

/** Total canvas world the camera can pan over — decorative area outside the play zone. */
export const GAME_WORLD_WIDTH = 1200;
export const GAME_WORLD_HEIGHT = 1800;

/**
 * The playable rectangle (coins + movement) is the same size as the original
 * viewport-sized field (GAME_WIDTH × GAME_HEIGHT), placed at the centre of the world.
 * Players and slimes cannot leave this area (invisible walls).
 */
export const WALKABLE_WIDTH = GAME_WIDTH;           // 400
export const WALKABLE_HEIGHT = GAME_HEIGHT;          // 600
export const WALKABLE_ORIGIN_X = (GAME_WORLD_WIDTH - WALKABLE_WIDTH) / 2;   // 400
export const WALKABLE_ORIGIN_Y = (GAME_WORLD_HEIGHT - WALKABLE_HEIGHT) / 2; // 600

/** Uniform inset from walkable-area edges used for coin spawn bounds. */
export const WORLD_EDGE_INSET = 20;

/**
 * Max coins on screen — scales with coin cap tier (1–10), capped at 50.
 * Each tier adds 5 coins to the field (5, 10, 15, … 50).
 */
export function onScreenCoinCap(coinCapLevel: number): number {
  const raw = 5 * Math.max(1, Math.floor(coinCapLevel));
  return Math.min(50, raw);
}

/**
 * Coin centers are kept inside this rectangle so they stay visible and tappable
 * under floating header / nav / world chrome. The canvas is full-viewport; UI overlays it.
 */
export const COIN_SPAWN_INSETS = {
  /** Header (safe area + stats row) + world name chip + level completion bar */
  top: 130,
  /** Bottom tab bar + home indicator / safe area */
  bottom: 120,
  /** Default horizontal pad; narrow when world chevrons are hidden (see GameWorld props) */
  left: 20,
  right: 20,
} as const;

export const COIN_SPAWN_INSET_X_WITH_WORLD_NAV = 52;

export const BASE_RESPAWN_TIME = 3000; // ms
export const BASE_MOVEMENT_SPEED = 1.5;

/** Player base move speed at a movement upgrade level (before buffs) — matches `GameWorld`. */
export function gamePlayerBaseSpeedAtLevel(movementSpeedLevel: number): number {
  /** 0.03/level × 20 tiers ≈ old 0.06/level × 10 (same end speed at area completion). */
  return BASE_MOVEMENT_SPEED * (1 + movementSpeedLevel * 0.03);
}

/** Flat speed gained from the next movement upgrade (constant every level). */
export function gameMovementSpeedFlatBonusPerLevel(): number {
  return BASE_MOVEMENT_SPEED * 0.03;
}

/** Slime base speed multiplier at a slime movement upgrade level (before agility/buffs) — matches `GameWorld`. */
export function gameSlimeBaseSpeedAtLevel(slimeMovementSpeedLevel: number): number {
  return BASE_SLIME_SPEED * (1 + slimeMovementSpeedLevel * 0.03);
}

/**
 * Time between coin spawns — matches `GameWorld` / automation idle math.
 * Exponential decay: 3000 ms at level 0, floored at 80 ms at level 10 (~instant).
 * Each tier is ~30% faster than the last (multiplier 0.7 per level).
 */
export function gameRespawnIntervalMs(respawnTimeLevel: number): number {
  return Math.max(80, Math.round(BASE_RESPAWN_TIME * Math.pow(0.7, respawnTimeLevel)));
}

/**
 * Base coins per collect from the coin-value upgrade **tier**.
 * Each tier adds exactly +1 💰 (tier 1 = 1 coin, tier 2 = 2 coins, …).
 */
export function gameCoinValuePerCollect(coinValueTier: number): number {
  const t = Math.max(1, Math.floor(coinValueTier));
  return t;
}

/** How much shorter the spawn interval gets after the next respawn upgrade. */
export function gameRespawnNextIntervalReductionMs(currentLevel: number, maxLevel = MAX_GAME_UPGRADE_LEVEL.respawnTime): number {
  if (currentLevel >= maxLevel) return 0;
  return gameRespawnIntervalMs(currentLevel) - gameRespawnIntervalMs(currentLevel + 1);
}

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
  const respawnInterval = gameRespawnIntervalMs(upgrades.respawnTime);
  const coinsPerSecond = 1 / (respawnInterval / 1000);
  const idleCoins = Math.floor((capped / 1000) * coinsPerSecond);
  const currencyEarned = idleCoins * gameCoinValuePerCollect(upgrades.coinValue);
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

/** Base equipped-slime slots before any Slime Cap upgrades. */
export const MAX_EQUIPPED_SLIMES = 3;

/** Equipped-slime slot count at a given Slime Cap upgrade level. Level 0 = 3, each level +1, max 20. */
export function equippedSlimeCapAtLevel(slimeCapLevel: number): number {
  return MAX_EQUIPPED_SLIMES + Math.max(0, Math.floor(slimeCapLevel));
}

/** Arena: both player and enemy teams field this many slimes. */
export const ARENA_TEAM_SIZE = 4;

/**
 * Arena fight length multiplier. Outcome is computed from slime stats / encounter only — not this value —
 * so tuning time here does not change who wins. Ability VFX duration scales with this.
 */
export const ARENA_BATTLE_TIME_SCALE = 2;

const ARENA_BATTLE_DURATION_BASE_MS = 5500;
const ARENA_ABILITY_PROC_BASE_MS = 700;
/** Fade duration for ability-use VFX after the bar fires. */
export const ARENA_ABILITY_PROC_MS = ARENA_ABILITY_PROC_BASE_MS * ARENA_BATTLE_TIME_SCALE;
/** How long the arena battle canvas runs before the outcome resolves (ms). */
export const ARENA_BATTLE_DURATION_MS = ARENA_BATTLE_DURATION_BASE_MS * ARENA_BATTLE_TIME_SCALE;

/** Display time for each 3 → 2 → 1 step before the arena sim runs (ms). */
export const ARENA_PRE_BATTLE_COUNTDOWN_STEP_MS = 900;

/** Center-to-center distance opposing slimes are pushed to (no stacking). */
export const ARENA_MELEE_MIN_SEPARATION_PX = 28;
/** Decorative melee hits only when distance is in this band (px). */
export const ARENA_MELEE_MIN_ATTACK_DIST_PX = 26;
export const ARENA_MELEE_MAX_ATTACK_DIST_PX = 50;
/** Decorative HP removed per single strike; win/loss is still stat-based elsewhere. */
export const ARENA_MELEE_HIT_DAMAGE = 0.048;
/**
 * Minimum time from the start of one pair strike to the start of the next (player ↔ enemy).
 * Keeps swings readable; should be ≥ attack anim + {@link ARENA_MELEE_POST_SWING_MS}.
 */
export const ARENA_MELEE_PAIR_ATTACK_INTERVAL_MS = 920;
/** Quiet beat after a swing’s VFX ends before the next strike can begin (ms). */
export const ARENA_MELEE_POST_SWING_MS = 480;
/** Length of one melee “special attack” animation cycle (ms). */
export const ARENA_MELEE_ATTACK_ANIM_MS = 380;
// Per-slime normal attack system

/** Base normal-attack cooldown for a freshly-hatched slime (ms). Variety shifts this +/-400 ms. */
export const ARENA_NORMAL_ATTACK_COOLDOWN_BASE_MS = 2000;
/** Each slime gets +/-this offset based on its id hash. Range: [1600 ms, 2400 ms]. */
export const ARENA_NORMAL_ATTACK_VARIETY_RANGE_MS = 400;
/** Hard floor for the cooldown after all strength reductions. */
export const ARENA_NORMAL_ATTACK_COOLDOWN_MIN_MS = 600;
/** Upgrading Strength subtracts this many ms per stat level above 1. */
export const ARENA_NORMAL_ATTACK_STR_COOLDOWN_REDUCTION_MS = 40;

/** Deterministic 0-1 variety value derived from the slime id string. */
export function slimeIdVariety(id: string): number {
  let hash = 0;
  for (let i = 0; i < Math.min(8, id.length); i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
  }
  return hash / 0xffff;
}

/**
 * Normal-attack cooldown (ms) for a slime.
 * Base 2000 ms +/- 400 ms id-derived variety; each strength stat level above 1
 * subtracts 40 ms, floored at 600 ms.
 */
export function slimeAttackCooldownMs(slime: Slime): number {
  const variety = slimeIdVariety(slime.id);
  const base =
    ARENA_NORMAL_ATTACK_COOLDOWN_BASE_MS +
    (variety * 2 - 1) * ARENA_NORMAL_ATTACK_VARIETY_RANGE_MS;
  const strReduction =
    Math.max(0, slime.statLevels.strength - 1) * ARENA_NORMAL_ATTACK_STR_COOLDOWN_REDUCTION_MS;
  return Math.max(ARENA_NORMAL_ATTACK_COOLDOWN_MIN_MS, base - strReduction);
}

/**
 * Full-dodge chance (0-1) when this slime is struck.
 * 2% at stat level 1, +2pp per agility level, capped at 50%.
 * Also grants a partial-damage-reduction tier at 2x the dodge chance.
 */
export function slimeAgilityDodgeChance(agilityStatLevel: number): number {
  return Math.min(0.5, 0.02 + Math.max(0, agilityStatLevel - 1) * 0.02);
}

export const ARENA_ABILITIES: SlimeArenaAbility[] = [
  'None',
  'Rally',
  'Fortify',
  'Smash',
  'Rush',
  'Harmony',
];

/**
 * In-battle ability firing cycle (ms) — how often the ability procs during a fight.
 * Weaker abilities have shorter cycles so they fire more frequently; stronger ones fire less often.
 */
export const ARENA_ABILITY_BATTLE_COOLDOWN_MS: Record<SlimeArenaAbility, number> = {
  None:    0,
  Rally:   8000,   // flat +20 — weakest, fires most often
  Rush:    9500,   // 55 % of Agility — moderate
  Smash:   10500,  // 55 % of Strength — moderate
  Fortify: 12000,  // 50 % of Health — strong scaling
  Harmony: 14000,  // 15 % of weighted score — strongest scaling, fires least often
};

/**
 * Initial delay before the first in-battle ability proc (ms).
 * Staggered so slimes with the same ability don't fire at identical times;
 * per-slime id variety adds up to +2 s of additional jitter on top.
 */
export const ARENA_ABILITY_BATTLE_INITIAL_DELAY_MS: Record<SlimeArenaAbility, number> = {
  None:    0,
  Rally:   3500,
  Rush:    5000,
  Smash:   6000,
  Fortify: 7000,
  Harmony: 8500,
};

/** Arena-only skills (separate from coin-field `trait`). Cooldown applies after use in a fight. */
export const ARENA_ABILITY_META: Record<
  SlimeArenaAbility,
  { name: string; description: string; cooldownMs: number }
> = {
  None: { name: 'None', description: 'No arena skill.', cooldownMs: 0 },
  Rally: {
    name: 'Rally',
    description: 'Arena: +20 effective power when used this fight.',
    cooldownMs: 3 * 60 * 1000,
  },
  Fortify: {
    name: 'Fortify',
    description: 'Arena: adds 50% of Health as bonus power.',
    cooldownMs: 3 * 60 * 1000,
  },
  Smash: {
    name: 'Smash',
    description: 'Arena: adds 55% of Strength as bonus power.',
    cooldownMs: 3 * 60 * 1000,
  },
  Rush: {
    name: 'Rush',
    description: 'Arena: adds 55% of Agility as bonus power.',
    cooldownMs: 3 * 60 * 1000,
  },
  Harmony: {
    name: 'Harmony',
    description: 'Arena: adds 15% of this slime’s matchup score as bonus power.',
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
  /** Tickets awarded on a win — always 1–3, seeded. */
  rewardTickets: number;
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
export function generateArenaEncounter(seed: number, arenaWins = 0): ArenaEncounter {
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

  /**
   * First three lifetime arena wins use a very soft curve (plus {@link arenaEarlyFightPlayerPowerBonus})
   * so fresh hatched slimes almost always win without upgrades.
   */
  let enemyPower: number;
  if (arenaWins <= 0) {
    enemyPower = 14 + Math.floor(r() * 11);
  } else if (arenaWins === 1) {
    enemyPower = 19 + Math.floor(r() * 11);
  } else if (arenaWins === 2) {
    enemyPower = 23 + Math.floor(r() * 10);
  } else {
    enemyPower = 95 + Math.floor(r() * 145);
  }
  const rewardCoins = 350 + Math.floor(enemyPower * 4.5);
  const rewardTickets = 1 + Math.floor(r() * 3);

  return {
    seed,
    weights,
    primaryStat,
    secondaryStat,
    enemyPower,
    rewardCoins,
    rewardTickets,
  };
}

/** Visual-only rivals for the arena battle screen (not persisted). */
export type ArenaEnemyDisplay = {
  id: string;
  name: string;
  color: string;
  slimeBody: number;
  slimeEyes: number;
  slimeAccessory: number;
  ability: SlimeArenaAbility;
  /** Used for arena canvas movement speed (same formula as main field). */
  agility: number;
};

/** `s_Slime5` — red/coral body; used for all arena enemies (vector fallback + sprite). */
export const ARENA_ENEMY_SLIME_BODY = 5;
/** Vector fallback and trait VFX tint when the sprite stack is not drawn. */
export const ARENA_ENEMY_SLIME_COLOR = '#b91c1c';

export function generateArenaEnemyTeam(encounter: ArenaEncounter): ArenaEnemyDisplay[] {
  const r = arenaRand(encounter.seed + 99_001);
  const first = ['Gloom', 'Vex', 'Rune', 'Mire', 'Frost', 'Ember', 'Shard', 'Dusk'];
  const second = ['claw', 'fang', 'mire', 'veil', 'puff', 'wisp', 'gloom', 'shade'];
  const abilities: SlimeArenaAbility[] = ['Rally', 'Fortify', 'Smash', 'Rush', 'Harmony'];
  return Array.from({ length: ARENA_TEAM_SIZE }, (_, i) => i).map((i) => {
    const a = r() > 0.15 ? abilities[Math.floor(r() * abilities.length)]! : 'None';
    const id = `arena-enemy-${encounter.seed}-${i}`;
    return {
      id,
      name: `${first[Math.floor(r() * first.length)]!} ${second[Math.floor(r() * second.length)]!}`,
      color: ARENA_ENEMY_SLIME_COLOR,
      slimeBody: ARENA_ENEMY_SLIME_BODY,
      slimeEyes: 0,
      slimeAccessory: 0,
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
      return 20;
    case 'Fortify':
      return slime.stats.health * 0.5;
    case 'Smash':
      return slime.stats.strength * 0.55;
    case 'Rush':
      return slime.stats.agility * 0.55;
    case 'Harmony':
      return base * 0.15;
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

/** Extra effective power for the first few lifetime fights (see {@link generateArenaEncounter}). */
export function arenaEarlyFightPlayerPowerBonus(arenaWinsBeforeBattle: number): number {
  if (arenaWinsBeforeBattle <= 0) return 20;
  if (arenaWinsBeforeBattle === 1) return 15;
  if (arenaWinsBeforeBattle === 2) return 12;
  return 0;
}

export function resolveArenaBattle(
  encounter: ArenaEncounter,
  team: [Slime, Slime, Slime, Slime],
  /** Slime ids that activate their arena ability this fight (must be off ability cooldown). */
  arenaAbilityUsedIds: Record<string, boolean> = {},
  /** Lifetime wins before this battle — used for early-fight player power bonus only. */
  arenaWinsBeforeBattle = 999
): { won: boolean } {
  const enemy = encounter.enemyPower;
  const w = encounter.weights;
  const use = (s: Slime) => Boolean(arenaAbilityUsedIds[s.id]);
  let p = arenaEarlyFightPlayerPowerBonus(arenaWinsBeforeBattle);
  for (const s of team) {
    p += slimeLinePower(s, w, use(s));
  }
  return { won: p >= enemy };
}

export function isArenaAbilityOnCooldown(
  slimeArenaAbilityCooldownUntil: Record<string, number>,
  slimeId: string,
  now: number = Date.now()
): boolean {
  return (slimeArenaAbilityCooldownUntil[slimeId] ?? 0) > now;
}

export const UPGRADE_COSTS = {
  /** One-time unlock; kept affordable early so automation comes online quickly. */
  automation: 18,
  /** Softer exponent so 20 tiers stay grindable (was tuned for 10 tiers). */
  movementSpeed: (level: number) => Math.floor(10 * Math.pow(1.19, level)),
  slimeMovementSpeed: (level: number) => Math.floor(10 * Math.pow(1.19, level)),
  respawnTime: (level: number) => Math.floor(12 * Math.pow(1.36, level)),
  /** Cost for the next coin-value tier (current tier = `level`). */
  coinValue: (level: number) => Math.max(1, Math.floor((level + 1) / 2)),
  /** Cost for the next coin cap tier (+2 coins on screen per tier). */
  coinCap: (level: number) => Math.floor(15 * Math.pow(1.4, level)),
  /**
   * Slime Cap: +1 equip slot per tier (base 3 → up to 20), 17 tiers total.
   * Intentionally the most expensive upgrade — roughly doubles each tier.
   */
  slimeCap: (level: number) => Math.floor(100 * Math.pow(1.5, level)),
};

/** Caps for shop upgrades on the game tab (automation is 0/1). World 0 (first level) baseline. */
export const MAX_GAME_UPGRADE_LEVEL = {
  movementSpeed: 20,
  slimeMovementSpeed: 20,
  respawnTime: 10,
  coinValue: 20,
  coinCap: 10,
  /** 17 tiers: base 3 slots + 17 = 20 max equipped slimes. */
  slimeCap: 17,
} as const;

export type GameUpgradeLevelCaps = {
  movementSpeed: number;
  slimeMovementSpeed: number;
  respawnTime: number;
  coinValue: number;
  coinCap: number;
  slimeCap: number;
};

/**
 * Per-world upgrade caps. Index matches `gameWorldIndex` (0–5).
 * Each world's caps are reached to unlock the next world.
 * Coin respawn and coin cap both max at 10 tiers so they progress together.
 */
export const MAX_GAME_UPGRADE_LEVEL_BY_WORLD: readonly GameUpgradeLevelCaps[] = [
  { movementSpeed: 20, slimeMovementSpeed: 20, respawnTime: 10, coinValue: 20, coinCap: 10, slimeCap: 2 },
  { movementSpeed: 25, slimeMovementSpeed: 25, respawnTime: 10, coinValue: 25, coinCap: 10, slimeCap: 17 },
  { movementSpeed: 30, slimeMovementSpeed: 30, respawnTime: 10, coinValue: 30, coinCap: 10, slimeCap: 17 },
  { movementSpeed: 35, slimeMovementSpeed: 35, respawnTime: 10, coinValue: 35, coinCap: 10, slimeCap: 17 },
  { movementSpeed: 40, slimeMovementSpeed: 40, respawnTime: 10, coinValue: 40, coinCap: 10, slimeCap: 17 },
  { movementSpeed: 45, slimeMovementSpeed: 45, respawnTime: 10, coinValue: 45, coinCap: 10, slimeCap: 17 },
];

/** Returns the upgrade caps for a given world index (falls back to world-0 caps if out of range). */
export function getMaxGameUpgradeLevelForWorld(worldIndex: number): GameUpgradeLevelCaps {
  return MAX_GAME_UPGRADE_LEVEL_BY_WORLD[worldIndex] ?? MAX_GAME_UPGRADE_LEVEL;
}

export type GameUpgradeSnapshot = {
  automation: number;
  movementSpeed: number;
  slimeMovementSpeed: number;
  respawnTime: number;
  coinValue: number;
  coinCap: number;
  slimeCap: number;
};

export function isGameUpgradeMaxed(
  upgrades: GameUpgradeSnapshot,
  key: keyof GameUpgradeSnapshot,
  worldIndex = 0
): boolean {
  if (key === 'automation') return upgrades.automation > 0;
  const caps = getMaxGameUpgradeLevelForWorld(worldIndex);
  return upgrades[key] >= caps[key as keyof typeof caps];
}

export function areAllGameUpgradesMaxed(upgrades: GameUpgradeSnapshot, worldIndex = 0): boolean {
  const caps = getMaxGameUpgradeLevelForWorld(worldIndex);
  return (
    upgrades.movementSpeed >= caps.movementSpeed &&
    upgrades.slimeMovementSpeed >= caps.slimeMovementSpeed &&
    upgrades.respawnTime >= caps.respawnTime &&
    upgrades.coinValue >= caps.coinValue &&
    upgrades.coinCap >= caps.coinCap &&
    upgrades.slimeCap >= caps.slimeCap
  );
}

/**
 * Returns a 0–1 fraction representing how close the player is to maxing every
 * game upgrade for the given world. Used to fill the final level-goal bar segment.
 */
export function getGameUpgradesMaxedProgress(upgrades: GameUpgradeSnapshot, worldIndex = 0): number {
  const caps = getMaxGameUpgradeLevelForWorld(worldIndex);
  const items = [
    Math.min(1, caps.movementSpeed > 0 ? upgrades.movementSpeed / caps.movementSpeed : 1),
    Math.min(1, caps.slimeMovementSpeed > 0 ? upgrades.slimeMovementSpeed / caps.slimeMovementSpeed : 1),
    Math.min(1, caps.respawnTime > 0 ? upgrades.respawnTime / caps.respawnTime : 1),
    Math.min(1, caps.coinValue > 0 ? upgrades.coinValue / caps.coinValue : 1),
    Math.min(1, caps.coinCap > 0 ? upgrades.coinCap / caps.coinCap : 1),
    Math.min(1, caps.slimeCap > 0 ? upgrades.slimeCap / caps.slimeCap : 1),
  ];
  return items.reduce((a, b) => a + b, 0) / items.length;
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

/** One of the five per-world milestone goals shown in the level completion bar. */
export interface LevelGoal {
  /** Raw coin count (from field collection) needed to reach this goal. */
  threshold: number;
  /** Short description shown below the bar. */
  label: string;
  rewardEggs: number;
  /** Coin-currency added directly to the player's balance. */
  rewardCoins: number;
  rewardTickets: number;
  /** If true, a random slime is added to the player's collection. */
  rewardSlime: boolean;
  /** Human-readable reward summary shown on the collect button. */
  rewardLabel: string;
  isFinal?: boolean;
}

/**
 * Five milestone goals per world. Progress tracks raw coins collected from the field
 * in the current world session (resets when the next world unlocks).
 */
export const LEVEL_GOALS: readonly LevelGoal[] = [
  {
    threshold: 5,
    label: 'Collect 5 coins',
    rewardEggs: 0,
    rewardCoins: 0,
    rewardTickets: 3,
    rewardSlime: false,
    rewardLabel: '+3 Tickets 🎟️',
  },
  {
    threshold: 117,
    label: 'Collect 117 coins',
    rewardEggs: 0,
    rewardCoins: 0,
    rewardTickets: 1,
    rewardSlime: false,
    rewardLabel: '+1 Ticket 🎟️',
  },
  {
    threshold: 387,
    label: 'Collect 387 coins',
    rewardEggs: 0,
    rewardCoins: 0,
    rewardTickets: 3,
    rewardSlime: false,
    rewardLabel: '+3 Tickets 🎟️',
  },
  {
    threshold: 870,
    label: 'Collect 870 coins',
    rewardEggs: 0,
    rewardCoins: 0,
    rewardTickets: 1,
    rewardSlime: false,
    rewardLabel: '+1 Ticket 🎟️',
  },
  {
    threshold: 1934,
    label: 'Collect 1934 coins',
    rewardEggs: 0,
    rewardCoins: 0,
    rewardTickets: 3,
    rewardSlime: false,
    rewardLabel: '+3 Tickets 🎟️',
  },
  {
    threshold: 3915,
    label: 'Collect 3915 coins',
    rewardEggs: 0,
    rewardCoins: 0,
    rewardTickets: 1,
    rewardSlime: false,
    rewardLabel: '+1 Ticket 🎟️',
  },
  {
    threshold: 7830,
    label: 'Collect 7830 coins',
    rewardEggs: 0,
    rewardCoins: 0,
    rewardTickets: 3,
    rewardSlime: false,
    rewardLabel: '+3 Tickets 🎟️',
  },
  {
    threshold: 15660,
    label: 'Collect 15660 coins',
    rewardEggs: 0,
    rewardCoins: 0,
    rewardTickets: 3,
    rewardSlime: true,
    rewardLabel: '+3 Tickets + ✨ Rare Slime',
    isFinal: true,
  },
] as const;
  {
    threshold: 5400,
    label: 'Collect 5400 coins',
    rewardEggs: 0,
    rewardCoins: 0,
    rewardTickets: 3,
    rewardSlime: false,
    rewardLabel: '+3 Tickets 🎟️',
  },
  {
    threshold: 10800,
    label: 'Collect 10800 coins',
    rewardEggs: 0,
    rewardCoins: 0,
    rewardTickets: 3,
    rewardSlime: true,
    rewardLabel: '+3 Tickets + ✨ Rare Slime',
    isFinal: true,
  },
] as const;

/** Price per single egg (legacy coins cost — kept for reference). */
export const EGG_COST = 50;
/** 10-egg bundle coins cost (legacy). */
export const EGG_BULK_10_COST = 450;

export function eggPurchaseCost(amount: number): number {
  if (amount === 10) return EGG_BULK_10_COST;
  return EGG_COST * amount;
}

/** Tickets required to buy 1 slime from the collection shop. */
export const SLIME_COST_TICKETS = 1;
/** Tickets required to buy 10 slimes (bulk discount: 9 tickets for 10). */
export const SLIME_BULK_10_COST_TICKETS = 9;

export function slimePurchaseCostTickets(amount: number): number {
  if (amount === 10) return SLIME_BULK_10_COST_TICKETS;
  return SLIME_COST_TICKETS * amount;
}

/** Coins required to breed two slimes (market tab). @deprecated Breeding now costs tickets. */
export const BREEDING_COST = 500;

/** Tickets required to breed two slimes. One ticket is awarded every 3 arena wins. */
export const BREEDING_COST_TICKETS = 3;

/** Maximum stat level for a single slime stat (health / strength / agility). */
export const MAX_SLIME_STAT_LEVEL = 90;

export const SLIME_UPGRADE_COST = (level: number) => Math.floor(50 * Math.pow(1.8, level));

/** Stat increase per upgrade; must match slime stat upgrade logic in App. */
export const SLIME_STAT_UPGRADE_DELTA: Record<keyof SlimeStats, number> = {
  health: 2,
  strength: 2,
  agility: 2,
};

export const SLIME_NAMES = [
  'Bloop', 'Gloop', 'Squish', 'Pudding', 'Jelly', 'Mochi', 'Bubbles', 'Dewy',
  'Gummy', 'Splosh', 'Blobby', 'Slimy', 'Goopy', 'Sticky', 'Bounce', 'Plop',
  'Wobble', 'Glaze', 'Syrup', 'Honey', 'Berry', 'Minty', 'Coco', 'Sunny',
  'Cloudy', 'Sparky', 'Zippy', 'Chonky', 'Tiny', 'Peanut', 'Bean', 'Sprout',
  'Marshmallow', 'Taffy', 'Boba', 'Matcha', 'Yuzu'
];

