import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Ghost,
  Dna, 
  TrendingUp, 
  Package, 
  ChevronRight,
  ChevronLeft,
  Zap,
  Timer,
  Coins,
  Heart,
  Sword,
  Wind,
  Trash2,
  Sparkles,
  Trophy,
  PartyPopper,
  Plus,
  CircleDollarSign,
  MoreVertical,
  Volume2,
  Star,
  Mail,
  X,
  Music,
  ArrowUp,
  Swords,
  Vibrate,
  Lock,
  Ticket,
  CheckCircle2,
  Gift,
  ArrowRight,
} from 'lucide-react';
import { GameState, INITIAL_STATE, Slime, SlimeTrait, SlimeStats } from './types';
import { GameWorld } from './components/GameWorld';
import { SlimeArenaPanel } from './components/SlimeArenaPanel';
import { LevelCompletionBar } from './components/LevelCompletionBar';
import { 
  COLORS, 
  TRAITS, 
  UPGRADE_COSTS,
  scaleUpgradeCostForWorld, 
  LEVEL_GOALS,
  getLevelGoal,
  getLevelGoalThreshold,
  EGG_COST,
  EGG_BULK_10_COST,
  eggPurchaseCost, // eslint-disable-line @typescript-eslint/no-unused-vars -- kept for reference
  SLIME_COST_TICKETS,
  SLIME_BULK_10_COST_TICKETS,
  slimePurchaseCostTickets,
  BREEDING_COST,
  BREEDING_COST_TICKETS,
  SLIME_UPGRADE_COST,
  MAX_SLIME_STAT_LEVEL,
  SLIME_STAT_UPGRADE_DELTA,
  computeOfflineIdleGain,
  OFFLINE_IDLE_CAP_MS,
  SLIME_NAMES,
  TRAIT_EFFECTS,
  MAX_EQUIPPED_SLIMES,
  equippedSlimeCapAtLevel,
  PLAY_STORE_LISTING_URL,
  SUPPORT_MAILTO,
  GAME_WORLDS,
  GAME_WORLD_INDEX_MIGRATE_SAND_THIRD,
  migrateMaxUnlockedToSandThirdOrder,
  GAME_WORLD_INDEX_MIGRATE_SAND_FLOWER_SWAP,
  migrateMaxUnlockedToSandFlowerOrder,
  getMaxGameUpgradeLevelForWorld,
  areAllGameUpgradesMaxed,
  isGameUpgradeMaxed,
  getGameUpgradesMaxedProgress,
  onScreenCoinCap,
  BASE_MOVEMENT_SPEED,
  BASE_SLIME_SPEED,
  gamePlayerBaseSpeedAtLevel,
  gameSlimeBaseSpeedAtLevel,
  gameRespawnIntervalMs,
  gameCoinValuePerCollect,
  ARENA_ABILITY_META,
  isArenaAbilityOnCooldown,
  rollRandomArenaAbility,
  type ArenaEncounter,
} from './constants';
import { SlimeStackSprite } from './components/SlimeStackSprite';
import { rollNewSlimeVisuals, breedSlimeVisuals, withSlimeVisualDefaults } from './slimeSprites';
import { Capacitor } from '@capacitor/core';
import { SystemUi } from './systemUi';
import { useAppForeground } from './hooks/useAppForeground';
import { useBlossomMusic, BLOSSOM_MUSIC_URL, BOSS_BATTLE_MUSIC_URL } from './hooks/useBlossomMusic';
import { useCoinCollectSfx } from './hooks/useCoinCollectSfx';
import { useSlimeTapSfx } from './hooks/useSlimeTapSfx';
import { useGlobalButtonTapFeedback, triggerPreviewHaptic } from './hooks/useTapFeedback';

function OptionsOnOffRow(props: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onToggle: () => void;
  switchId: string;
  className?: string;
}) {
  const { icon, label, checked, onToggle, switchId, className } = props;
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border border-emerald-100/80 bg-emerald-50/60 px-3 py-2.5 ${className ?? ''}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 text-emerald-800 shadow-sm" aria-hidden>
          {icon}
        </div>
        <span className="text-base font-bold text-emerald-900">{label}</span>
      </div>
      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={checked}
        aria-label={`${label}: ${checked ? 'on' : 'off'}`}
        onClick={onToggle}
        className={`relative h-7 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
          checked ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 block h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isUpgradesOpen, setIsUpgradesOpen] = useState(false);
  const [showLockedNextWorldHint, setShowLockedNextWorldHint] = useState(false);
  const lockedHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upgradesScrollRef = useRef<HTMLDivElement>(null);
  const slimeCapUpgradeRef = useRef<HTMLDivElement>(null);
  const [upgradesScrollFadeBottom, setUpgradesScrollFadeBottom] = useState(false);
  const collectionScrollRef = useRef<HTMLDivElement>(null);
  const [collectionScrollFadeBottom, setCollectionScrollFadeBottom] = useState(false);
  const [selectedSlimeDetail, setSelectedSlimeDetail] = useState<Slime | null>(null);
  /** ID of a slime waiting to be equipped — set when the team is full and the player needs to choose who to swap out. */
  const [pendingEquipSlimeId, setPendingEquipSlimeId] = useState<string | null>(null);
  const [breedingSelection, setBreedingSelection] = useState<[string | null, string | null]>([null, null]);
  const [activeBreedingSlot, setActiveBreedingSlot] = useState<0 | 1>(0);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  /** Short GPU translate when changing world; avoids remounting GameWorld (was causing heavy lag). */
  const [worldNavShiftPx, setWorldNavShiftPx] = useState(0);
  const [worldNavTransition, setWorldNavTransition] = useState(true);
  /** True while an arena fight is running (team picked battle, canvas phase). Drives boss battle music. */
  const [arenaBattleActive, setArenaBattleActive] = useState(false);
  /** Shown after load or resume when automation earned coins while away. */
  const [offlineWelcome, setOfflineWelcome] = useState<{
    currencyEarned: number;
    awayMs: number;
    idleCoins: number;
  } | null>(null);
  /** Shown when maxing all game-tab upgrades unlocks the next playfield (not persisted). */
  const [worldUnlockCelebration, setWorldUnlockCelebration] = useState<{
    worldIndex: number;
    worldName: string;
  } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Timestamp when the player navigated away from the game tab (within-session idle tracking). */
  const lastGameTabExitTimeRef = useRef<number | null>(null);

  /** Re-render once per second so arena/collection cooldown timers stay accurate. */
  const [, setCooldownClock] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setCooldownClock((c) => c + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const nowMs = Date.now();

  const appForeground = useAppForeground();

  const musicTrackUrl =
    state.activeTab === 'arena' && arenaBattleActive ? BOSS_BATTLE_MUSIC_URL : BLOSSOM_MUSIC_URL;
  useBlossomMusic(hasStarted, state.settings.musicEnabled && appForeground, 1, musicTrackUrl);

  useEffect(() => {
    if (state.activeTab !== 'arena') setArenaBattleActive(false);
  }, [state.activeTab]);

  // Reset breeding slot to 0 whenever the player opens the breeding tab.
  useEffect(() => {
    if (state.activeTab === 'market') setActiveBreedingSlot(0);
  }, [state.activeTab]);

  // Fake loading hides when progress hits 100%, but we must clear this flag so world-unlock logic and saves run.
  useEffect(() => {
    if (loadingProgress >= 100) {
      setIsLoading(false);
    }
  }, [loadingProgress]);

  /** Bottom fade on upgrades list when content scrolls (hint that more is below). */
  useEffect(() => {
    if (!isUpgradesOpen) {
      setUpgradesScrollFadeBottom(false);
      return;
    }
    const updateFade = () => {
      const el = upgradesScrollRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const canScroll = scrollHeight > clientHeight + 2;
      const atBottom = scrollHeight - scrollTop - clientHeight <= 14;
      setUpgradesScrollFadeBottom(canScroll && !atBottom);
    };
    let raf = 0;
    const ro = new ResizeObserver(updateFade);
    const bind = () => {
      const el = upgradesScrollRef.current;
      if (!el) {
        raf = requestAnimationFrame(bind);
        return;
      }
      updateFade();
      el.addEventListener('scroll', updateFade, { passive: true });
      ro.observe(el);
      window.addEventListener('resize', updateFade);
    };
    bind();
    return () => {
      cancelAnimationFrame(raf);
      const el = upgradesScrollRef.current;
      if (el) {
        el.removeEventListener('scroll', updateFade);
        ro.disconnect();
      }
      window.removeEventListener('resize', updateFade);
    };
  }, [isUpgradesOpen]);

  /** Bottom fade on slime collection when content scrolls (hint that more is below). */
  useEffect(() => {
    const updateFade = () => {
      const el = collectionScrollRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const canScroll = scrollHeight > clientHeight + 2;
      const atBottom = scrollHeight - scrollTop - clientHeight <= 14;
      setCollectionScrollFadeBottom(canScroll && !atBottom);
    };
    let raf = 0;
    const ro = new ResizeObserver(updateFade);
    const bind = () => {
      const el = collectionScrollRef.current;
      if (!el) {
        raf = requestAnimationFrame(bind);
        return;
      }
      updateFade();
      el.addEventListener('scroll', updateFade, { passive: true });
      ro.observe(el);
      window.addEventListener('resize', updateFade);
    };
    bind();
    return () => {
      cancelAnimationFrame(raf);
      const el = collectionScrollRef.current;
      if (el) {
        el.removeEventListener('scroll', updateFade);
        ro.disconnect();
      }
      window.removeEventListener('resize', updateFade);
    };
  }, []);

  // Notification Logic
  const canAffordAnyGameUpgrade =
    (!isGameUpgradeMaxed(state.upgrades, 'movementSpeed') &&
      state.coins >= scaleUpgradeCostForWorld(UPGRADE_COSTS.movementSpeed(state.upgrades.movementSpeed), state.gameWorldIndex)) ||
    (!isGameUpgradeMaxed(state.upgrades, 'slimeMovementSpeed') &&
      state.coins >= scaleUpgradeCostForWorld(UPGRADE_COSTS.slimeMovementSpeed(state.upgrades.slimeMovementSpeed), state.gameWorldIndex)) ||
    (!isGameUpgradeMaxed(state.upgrades, 'respawnTime') &&
      state.coins >= scaleUpgradeCostForWorld(UPGRADE_COSTS.respawnTime(state.upgrades.respawnTime), state.gameWorldIndex)) ||
    (!isGameUpgradeMaxed(state.upgrades, 'coinValue') &&
      state.coins >= scaleUpgradeCostForWorld(UPGRADE_COSTS.coinValue(state.upgrades.coinValue), state.gameWorldIndex)) ||
    (!isGameUpgradeMaxed(state.upgrades, 'coinCap') &&
      state.coins >= scaleUpgradeCostForWorld(UPGRADE_COSTS.coinCap(state.upgrades.coinCap), state.gameWorldIndex)) ||
    (!isGameUpgradeMaxed(state.upgrades, 'slimeCap') &&
      state.coins >= scaleUpgradeCostForWorld(UPGRADE_COSTS.slimeCap(state.upgrades.slimeCap), state.gameWorldIndex));
  
  const hasSlimesNotification = false;

  const isGameTab = state.activeTab === 'game';
  /** True when the player is viewing a world they've already beaten (index < max unlocked). */
  const isCompletedLevel = state.gameWorldIndex < state.maxUnlockedGameWorld;
  /** Arena fight overlay is z-[115]; raise header/options above it so the menu stays reachable mid-fight. */
  const shellOverArenaFight =
    state.activeTab === 'arena' && arenaBattleActive;

  const openSlimeDetail = useCallback((slime: Slime) => {
    setState((prev) =>
      prev.slimeDetailSeenIds.includes(slime.id)
        ? prev
        : { ...prev, slimeDetailSeenIds: [...prev.slimeDetailSeenIds, slime.id] }
    );
    setSelectedSlimeDetail(slime);
  }, []);

  // Android: keep status + navigation bars hidden on every tab; re-apply on tab change in case the OS restores them.
  useLayoutEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    void SystemUi.setImmersive({ hide: true }).catch(() => {});
  }, [state.activeTab]);

  // Load state
  useEffect(() => {
    const saved = localStorage.getItem('slime_sprout_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      const now = Date.now();
      const diff = Math.min(now - parsed.lastSavedTime, OFFLINE_IDLE_CAP_MS);
      const idleGain = computeOfflineIdleGain(parsed.upgrades, diff);
      if (idleGain.currencyEarned > 0) {
        parsed.coins += idleGain.currencyEarned;
        parsed.totalCoinsCollected += idleGain.idleCoins;
        if ((parsed.gameWorldIndex ?? 0) >= (parsed.maxUnlockedGameWorld ?? 0)) {
          parsed.worldCoinsCollected = (parsed.worldCoinsCollected ?? 0) + idleGain.currencyEarned;
        }
        setOfflineWelcome({
          currencyEarned: idleGain.currencyEarned,
          awayMs: diff,
          idleCoins: idleGain.idleCoins,
        });
      }

      if (typeof parsed.gameWorldIndex !== 'number') parsed.gameWorldIndex = INITIAL_STATE.gameWorldIndex;
      if (typeof parsed.maxUnlockedGameWorld !== 'number') {
        parsed.maxUnlockedGameWorld = INITIAL_STATE.maxUnlockedGameWorld;
      }
      if (!parsed.worldOrderSandThird) {
        const gwi = Math.min(5, Math.max(0, Math.floor(parsed.gameWorldIndex)));
        const mu = Math.min(5, Math.max(0, Math.floor(parsed.maxUnlockedGameWorld)));
        parsed.gameWorldIndex = GAME_WORLD_INDEX_MIGRATE_SAND_THIRD[gwi] ?? gwi;
        parsed.maxUnlockedGameWorld = migrateMaxUnlockedToSandThirdOrder(mu);
        parsed.worldOrderSandThird = true;
      }
      if (!parsed.worldOrderSandFlowerSwap) {
        const gwi = Math.min(5, Math.max(0, Math.floor(parsed.gameWorldIndex)));
        const mu = Math.min(5, Math.max(0, Math.floor(parsed.maxUnlockedGameWorld)));
        parsed.gameWorldIndex = GAME_WORLD_INDEX_MIGRATE_SAND_FLOWER_SWAP[gwi] ?? gwi;
        parsed.maxUnlockedGameWorld = migrateMaxUnlockedToSandFlowerOrder(mu);
        parsed.worldOrderSandFlowerSwap = true;
      }
      parsed.gameWorldIndex = Math.min(5, Math.max(0, Math.floor(parsed.gameWorldIndex)));
      parsed.maxUnlockedGameWorld = Math.min(5, Math.max(0, Math.floor(parsed.maxUnlockedGameWorld)));
      if (parsed.gameWorldIndex > parsed.maxUnlockedGameWorld) {
        parsed.gameWorldIndex = parsed.maxUnlockedGameWorld;
      }
      if (parsed.upgrades) {
        const loadCaps = getMaxGameUpgradeLevelForWorld(parsed.gameWorldIndex ?? 0);
        parsed.upgrades.automation = parsed.upgrades.automation > 0 ? 1 : 0;
        parsed.upgrades.movementSpeed = Math.min(
          loadCaps.movementSpeed,
          Math.max(1, Math.floor(Number(parsed.upgrades.movementSpeed)) || 1)
        );
        parsed.upgrades.slimeMovementSpeed = Math.min(
          loadCaps.slimeMovementSpeed,
          Math.max(1, Math.floor(Number(parsed.upgrades.slimeMovementSpeed)) || 1)
        );
        parsed.upgrades.respawnTime = Math.min(
          loadCaps.respawnTime,
          Math.max(1, Math.floor(Number(parsed.upgrades.respawnTime)) || 1)
        );
        parsed.upgrades.coinValue = Math.min(
          loadCaps.coinValue,
          Math.max(1, Math.floor(Number(parsed.upgrades.coinValue)) || 1)
        );
        parsed.upgrades.coinCap = Math.min(
          loadCaps.coinCap,
          Math.max(1, Math.floor(Number(parsed.upgrades.coinCap)) || 1)
        );
        parsed.upgrades.slimeCap = Math.min(
          loadCaps.slimeCap,
          Math.max(0, Math.floor(Number(parsed.upgrades.slimeCap)) || 0)
        );
      }

      const s = parsed.settings;
      if (s && 'soundVolume' in s && !('musicVolume' in s)) {
        const legacyOn = Boolean((s as { soundEnabled?: boolean }).soundEnabled ?? true);
        parsed.settings = {
          musicEnabled: legacyOn,
          sfxEnabled: legacyOn,
          hapticsEnabled: Boolean(s?.hapticsEnabled ?? false),
        };
      } else {
        parsed.settings = {
          musicEnabled: Boolean(s?.musicEnabled ?? true),
          sfxEnabled: Boolean(s?.sfxEnabled ?? true),
          hapticsEnabled: Boolean(s?.hapticsEnabled ?? false),
        };
      }

      const validTabs = new Set(['game', 'slimes', 'market', 'arena']);
      if (!validTabs.has(parsed.activeTab)) {
        parsed.activeTab = 'game';
      }
      if (typeof parsed.tickets !== 'number' || !Number.isFinite(parsed.tickets) || parsed.tickets < 0) {
        parsed.tickets = 0;
      } else {
        parsed.tickets = Math.floor(parsed.tickets);
      }
      if (parsed.breedingEgg === undefined) parsed.breedingEgg = null;

      delete parsed.slimeCooldownUntil;
      if (!parsed.slimeArenaAbilityCooldownUntil || typeof parsed.slimeArenaAbilityCooldownUntil !== 'object') {
        parsed.slimeArenaAbilityCooldownUntil = {};
      }
      if (typeof parsed.arenaWins !== 'number' || !Number.isFinite(parsed.arenaWins) || parsed.arenaWins < 0) {
        parsed.arenaWins = 0;
      } else {
        parsed.arenaWins = Math.floor(parsed.arenaWins);
      }
      if (typeof parsed.worldCoinsCollected !== 'number' || !Number.isFinite(parsed.worldCoinsCollected) || parsed.worldCoinsCollected < 0) {
        parsed.worldCoinsCollected = 0;
      } else {
        parsed.worldCoinsCollected = Math.floor(parsed.worldCoinsCollected);
      }
      if (!Array.isArray(parsed.worldGoalsClaimed) || parsed.worldGoalsClaimed.length !== 8) {
        parsed.worldGoalsClaimed = [false, false, false, false, false, false, false, false];
      } else {
        parsed.worldGoalsClaimed = parsed.worldGoalsClaimed.map(Boolean) as [boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean];
      }

      // Migrate legacy flat equippedSlimeIds → per-world map
      if (Array.isArray(parsed.equippedSlimeIds)) {
        const worldIdx: number = parsed.gameWorldIndex ?? 0;
        parsed.equippedSlimeIdsByWorld = { [worldIdx]: parsed.equippedSlimeIds };
        delete parsed.equippedSlimeIds;
      }
      if (!parsed.equippedSlimeIdsByWorld || typeof parsed.equippedSlimeIdsByWorld !== 'object' || Array.isArray(parsed.equippedSlimeIdsByWorld)) {
        parsed.equippedSlimeIdsByWorld = {};
      }

      if (!Array.isArray(parsed.slimeDetailSeenIds)) {
        parsed.slimeDetailSeenIds = Array.isArray(parsed.slimes)
          ? parsed.slimes.map((s: Slime) => s.id)
          : [];
      }
      if (Array.isArray(parsed.slimes)) {
        parsed.slimes = parsed.slimes.map((s: Slime) =>
          withSlimeVisualDefaults({
            ...s,
            arenaAbility: s.arenaAbility ?? rollRandomArenaAbility(),
          })
        );
      }
      delete parsed.marketSection;

      // Cold start: always open the main coin playfield after load (not the last tab from the previous session).
      parsed.activeTab = 'game';

      setState({ ...parsed, lastSavedTime: now });
    }

    // Fake loading
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  /** Apply automation idle gains when returning from background (same formula as initial load). */
  useEffect(() => {
    if (!hasStarted || isLoading) return;
    const minAwayMs = 5000;

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const prev = stateRef.current;
      const now = Date.now();
      const rawDiff = now - prev.lastSavedTime;
      if (rawDiff < minAwayMs) return;
      const diff = Math.min(rawDiff, OFFLINE_IDLE_CAP_MS);
      const idleGain = computeOfflineIdleGain(prev.upgrades, diff);
      if (idleGain.currencyEarned <= 0) return;

      // Reset tab-exit timer so the tab-switch handler doesn't double-count
      // the same period that this visibility handler just credited.
      lastGameTabExitTimeRef.current = now;

      setOfflineWelcome({
        currencyEarned: idleGain.currencyEarned,
        awayMs: diff,
        idleCoins: idleGain.idleCoins,
      });
      setState((s) => ({
        ...s,
        coins: s.coins + idleGain.currencyEarned,
        totalCoinsCollected: s.totalCoinsCollected + idleGain.idleCoins,
        worldCoinsCollected: s.gameWorldIndex >= s.maxUnlockedGameWorld
          ? (s.worldCoinsCollected ?? 0) + idleGain.currencyEarned
          : (s.worldCoinsCollected ?? 0),
        lastSavedTime: now,
      }));
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [hasStarted, isLoading]);

  /**
   * Background idle while navigating between in-app tabs.
   * The GameWorld canvas only runs on the 'game' tab, so when the player switches
   * away we record the departure time and silently credit idle coins on return.
   */
  useEffect(() => {
    if (isLoading || !hasStarted) return;

    if (state.activeTab !== 'game') {
      // Record when we first left the game tab (don't overwrite if already set).
      if (lastGameTabExitTimeRef.current === null) {
        lastGameTabExitTimeRef.current = Date.now();
      }
    } else {
      // Returned to the game tab — credit any remaining idle time since the last
      // background tick (at most one tick interval worth of time).
      if (lastGameTabExitTimeRef.current !== null) {
        const now = Date.now();
        const awayMs = now - lastGameTabExitTimeRef.current;
        lastGameTabExitTimeRef.current = null;

        if (awayMs >= 1000) {
          const prev = stateRef.current;
          const idleGain = computeOfflineIdleGain(prev.upgrades, awayMs);
          if (idleGain.currencyEarned > 0) {
            setState((s) => ({
              ...s,
              coins: s.coins + idleGain.currencyEarned,
              totalCoinsCollected: s.totalCoinsCollected + idleGain.idleCoins,
              worldCoinsCollected: s.gameWorldIndex >= s.maxUnlockedGameWorld
                ? (s.worldCoinsCollected ?? 0) + idleGain.idleCoins
                : (s.worldCoinsCollected ?? 0),
              lastSavedTime: now,
            }));
          }
        }
      }
    }
  }, [state.activeTab, isLoading, hasStarted]);

  /**
   * Real-time silent idle accumulation while the player is on a non-game tab.
   * Ticks every second, credits idle coins without playing any sound, and
   * advances lastGameTabExitTimeRef so the return-to-game handler only needs
   * to cover the remaining partial interval.
   */
  useEffect(() => {
    if (isLoading || !hasStarted || state.activeTab === 'game') return;

    const TICK_MS = 1000;

    const interval = setInterval(() => {
      const now = Date.now();
      const since = lastGameTabExitTimeRef.current;
      if (since === null) return;

      const elapsed = now - since;
      if (elapsed < 1000) return;

      const prev = stateRef.current;
      const idleGain = computeOfflineIdleGain(prev.upgrades, elapsed);
      // Only advance the timestamp when we actually credit coins, so fractional
      // elapsed time keeps accumulating until a full coin can be awarded.
      if (idleGain.currencyEarned <= 0) return;

      lastGameTabExitTimeRef.current = now;

      setState((s) => ({
        ...s,
        coins: s.coins + idleGain.currencyEarned,
        totalCoinsCollected: s.totalCoinsCollected + idleGain.idleCoins,
        worldCoinsCollected: s.gameWorldIndex >= s.maxUnlockedGameWorld
          ? (s.worldCoinsCollected ?? 0) + idleGain.currencyEarned
          : (s.worldCoinsCollected ?? 0),
        lastSavedTime: now,
      }));
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [isLoading, hasStarted, state.activeTab]);

  // Auto-grant automation as soon as the player owns their first slime.
  useEffect(() => {
    if (isLoading) return;
    if (state.slimes.length > 0 && state.upgrades.automation === 0) {
      setState(prev => ({
        ...prev,
        upgrades: { ...prev.upgrades, automation: 1 },
      }));
    }
  }, [isLoading, state.slimes.length, state.upgrades.automation]);

  // Save state
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('slime_sprout_state', JSON.stringify({
        ...state,
        lastSavedTime: Date.now()
      }));
    }
  }, [state, isLoading]);

  const addCoins = useCallback((count: number) => {
    setState(prev => {
      const upgradeValue = gameCoinValuePerCollect(prev.upgrades.coinValue);

      // Calculate trait bonus
      let traitBonus = 0;
      (prev.equippedSlimeIdsByWorld[prev.gameWorldIndex] ?? []).forEach(id => {
        const slime = prev.slimes.find(s => s.id === id);
        if (slime && slime.trait) {
          traitBonus += TRAIT_EFFECTS[slime.trait].coinValue || 0;
        }
      });

      const totalValuePerCoin = upgradeValue + traitBonus;
      const isActiveWorld = prev.gameWorldIndex >= prev.maxUnlockedGameWorld;
      return {
        ...prev,
        coins: prev.coins + count * totalValuePerCoin,
        totalCoinsCollected: prev.totalCoinsCollected + count,
        worldCoinsCollected: isActiveWorld
          ? (prev.worldCoinsCollected ?? 0) + count * totalValuePerCoin
          : (prev.worldCoinsCollected ?? 0),
      };
    });
  }, []);

  const playCoinCollect = useCoinCollectSfx(
    hasStarted && appForeground,
    state.settings.sfxEnabled,
    1
  );

  const playSlimeTap = useSlimeTapSfx(
    hasStarted && appForeground,
    state.settings.sfxEnabled,
    1
  );

  useGlobalButtonTapFeedback(
    hasStarted && appForeground,
    state.settings.sfxEnabled,
    state.settings.hapticsEnabled
  );

  useEffect(() => {
    if (!worldUnlockCelebration || !hasStarted) return;
    playCoinCollect(6);
  }, [worldUnlockCelebration, hasStarted, playCoinCollect]);

  const handleGameCollect = useCallback(
    (count: number) => {
      playCoinCollect(count);
      addCoins(count);
    },
    [addCoins, playCoinCollect]
  );

  const handleClaimGoal = useCallback((goalIndex: number) => {
    const goal = LEVEL_GOALS[goalIndex];
    if (!goal) return;
    playCoinCollect(goal.rewardTickets + (goal.rewardEggs ? 2 : 0) + (goal.rewardSlime ? 4 : 0));
    setState((prev) => {
      let newSlimes = prev.slimes;
      let newlyHatched: Slime | null = prev.newlyHatchedSlime;
      if (goal.rewardSlime) {
        const usedNames = new Set(prev.slimes.map((s) => s.name));
        const availableNames = SLIME_NAMES.filter((n) => !usedNames.has(n));
        const slimeName =
          availableNames.length > 0
            ? availableNames[Math.floor(Math.random() * availableNames.length)]
            : SLIME_NAMES[Math.floor(Math.random() * SLIME_NAMES.length)];
        const highQuality = !!goal.isFinal;
        const rareTRAITS = TRAITS.filter((t) => t !== 'None') as SlimeTrait[];
        const rewardSlime: Slime = {
          id: Math.random().toString(36).substr(2, 9),
          name: slimeName,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          ...rollNewSlimeVisuals(),
          stats: highQuality
            ? {
                health: 10 + Math.floor(Math.random() * 6),
                strength: 10 + Math.floor(Math.random() * 6),
                agility: 10 + Math.floor(Math.random() * 6),
              }
            : {
                health: 5 + Math.floor(Math.random() * 5),
                strength: 5 + Math.floor(Math.random() * 5),
                agility: 5 + Math.floor(Math.random() * 5),
              },
          statLevels: { health: 1, strength: 1, agility: 1 },
          trait: highQuality
            ? rareTRAITS[Math.floor(Math.random() * rareTRAITS.length)]
            : (TRAITS[Math.floor(Math.random() * TRAITS.length)] as SlimeTrait),
          arenaAbility: rollRandomArenaAbility(),
          level: 1,
          value: highQuality ? 150 : 50,
          hatchedAt: Date.now(),
        };
        newSlimes = [...prev.slimes, rewardSlime];
        newlyHatched = rewardSlime;
      }

      const newGoalsClaimed = [...prev.worldGoalsClaimed] as [boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean];
      newGoalsClaimed[goalIndex] = true;

      return {
        ...prev,
        eggs: prev.eggs + (goal.rewardEggs ?? 0),
        coins: prev.coins + (goal.rewardCoins ?? 0),
        tickets: (prev.tickets ?? 0) + (goal.rewardTickets ?? 0),
        slimes: newSlimes,
        newlyHatchedSlime: newlyHatched,
        worldGoalsClaimed: newGoalsClaimed,
      };
    });
  }, [playCoinCollect]);

  const toggleEquipSlime = (id: string) => {
    setState(prev => {
      const worldIdx = prev.gameWorldIndex;
      const current = prev.equippedSlimeIdsByWorld[worldIdx] ?? [];
      const isEquipped = current.includes(id);
      if (isEquipped) {
        return {
          ...prev,
          equippedSlimeIdsByWorld: { ...prev.equippedSlimeIdsByWorld, [worldIdx]: current.filter(i => i !== id) },
        };
      } else {
        const slotCap = equippedSlimeCapAtLevel(prev.upgrades.slimeCap);
        if (current.length >= slotCap) {
          // Team is full — let the player pick who to swap out
          setPendingEquipSlimeId(id);
          return prev;
        }
        return {
          ...prev,
          equippedSlimeIdsByWorld: { ...prev.equippedSlimeIdsByWorld, [worldIdx]: [...current, id] },
        };
      }
    });
  };

  /** Called from the swap popup — removes `removeId` from the team and adds `pendingEquipSlimeId`. */
  const confirmSwapSlime = (removeId: string) => {
    if (!pendingEquipSlimeId) return;
    const incoming = pendingEquipSlimeId;
    setPendingEquipSlimeId(null);
    setState(prev => {
      const worldIdx = prev.gameWorldIndex;
      const current = prev.equippedSlimeIdsByWorld[worldIdx] ?? [];
      return {
        ...prev,
        equippedSlimeIdsByWorld: {
          ...prev.equippedSlimeIdsByWorld,
          [worldIdx]: current.filter(i => i !== removeId).concat(incoming),
        },
      };
    });
  };

  const tryUnlockNextWorld = (prev: GameState, newUpgrades: GameState['upgrades']): GameState => {
    if (prev.maxUnlockedGameWorld >= GAME_WORLDS.length - 1) return { ...prev, upgrades: newUpgrades };
    if (!areAllGameUpgradesMaxed(newUpgrades, prev.gameWorldIndex)) return { ...prev, upgrades: newUpgrades };
    const nextIndex = prev.maxUnlockedGameWorld + 1;
    queueMicrotask(() =>
      setWorldUnlockCelebration({
        worldIndex: nextIndex,
        worldName: GAME_WORLDS[nextIndex].name,
      })
    );
    return {
      ...prev,
      upgrades: { ...INITIAL_STATE.upgrades },
      coins: 0,
      maxUnlockedGameWorld: nextIndex,
      gameWorldIndex: nextIndex,
      worldCoinsCollected: 0,
      worldGoalsClaimed: [false, false, false, false, false, false, false, false],
    };
  };

  const buyUpgrade = (key: keyof GameState['upgrades']) => {
    if (isGameUpgradeMaxed(state.upgrades, key, state.gameWorldIndex)) return;
    const currentLevel = state.upgrades[key];
    const baseCost = key === 'automation' ? UPGRADE_COSTS.automation : (UPGRADE_COSTS as any)[key](currentLevel);
    const cost = scaleUpgradeCostForWorld(baseCost, state.gameWorldIndex);

    if (state.coins >= cost) {
      setState(prev => {
        const newUpgrades = { ...prev.upgrades, [key]: prev.upgrades[key] + 1 };
        return tryUnlockNextWorld({ ...prev, coins: prev.coins - cost }, newUpgrades);
      });
    }
  };

  const buyUpgradeMax = (key: keyof GameState['upgrades']) => {
    setState(prev => {
      if (isGameUpgradeMaxed(prev.upgrades, key, prev.gameWorldIndex)) return prev;
      if (key === 'automation') {
        const automationCost = scaleUpgradeCostForWorld(UPGRADE_COSTS.automation, prev.gameWorldIndex);
        if (prev.coins < automationCost) return prev;
        const newUpgrades = { ...prev.upgrades, automation: 1 };
        return tryUnlockNextWorld({ ...prev, coins: prev.coins - automationCost }, newUpgrades);
      }
      const caps = getMaxGameUpgradeLevelForWorld(prev.gameWorldIndex);
      const cap = caps[key as keyof typeof caps];
      let level = prev.upgrades[key];
      let coins = prev.coins;
      while (level < cap) {
        const cost = scaleUpgradeCostForWorld((UPGRADE_COSTS as any)[key](level), prev.gameWorldIndex);
        if (coins < cost) break;
        coins -= cost;
        level++;
      }
      if (level === prev.upgrades[key]) return prev;
      const newUpgrades = { ...prev.upgrades, [key]: level };
      return tryUnlockNextWorld({ ...prev, coins }, newUpgrades);
    });
  };

  const getUniqueName = (existingSlimes: Slime[]) => {
    const usedNames = new Set(existingSlimes.map(s => s.name));
    const availableNames = SLIME_NAMES.filter(name => !usedNames.has(name));
    
    if (availableNames.length > 0) {
      return availableNames[Math.floor(Math.random() * availableNames.length)];
    }
    
    // Fallback if all names are used: Name + Random number
    let fallbackName = '';
    do {
      const baseName = SLIME_NAMES[Math.floor(Math.random() * SLIME_NAMES.length)];
      fallbackName = `${baseName} ${Math.floor(Math.random() * 1000)}`;
    } while (usedNames.has(fallbackName));
    
    return fallbackName;
  };

  const makeSlime = (existingSlimes: Slime[]): Slime => ({
    id: Math.random().toString(36).substr(2, 9),
    name: getUniqueName(existingSlimes),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    ...rollNewSlimeVisuals(),
    stats: {
      health: 5 + Math.floor(Math.random() * 5),
      strength: 5 + Math.floor(Math.random() * 5),
      agility: 5 + Math.floor(Math.random() * 5),
    },
    statLevels: { health: 1, strength: 1, agility: 1 },
    trait: TRAITS[Math.floor(Math.random() * TRAITS.length)] as SlimeTrait,
    arenaAbility: rollRandomArenaAbility(),
    level: 1,
    value: 50,
    hatchedAt: Date.now(),
  });

  const buySlimes = (amount: number = 1) => {
    const totalCost = slimePurchaseCostTickets(amount);
    if ((state.tickets ?? 0) >= totalCost) {
      setState(prev => {
        const newSlimes: Slime[] = [];
        for (let i = 0; i < amount; i++) {
          newSlimes.push(makeSlime([...prev.slimes, ...newSlimes]));
        }
        if (amount === 1) {
          return {
            ...prev,
            tickets: (prev.tickets ?? 0) - totalCost,
            slimes: [...prev.slimes, ...newSlimes],
            newlyHatchedSlime: newSlimes[0],
          };
        }
        return {
          ...prev,
          tickets: (prev.tickets ?? 0) - totalCost,
          slimes: [...prev.slimes, ...newSlimes],
          newlyHatchedSlimes: newSlimes,
        };
      });
    }
  };

  const upgradeSlimeStat = (id: string, stat: keyof SlimeStats) => {
    const slime = state.slimes.find(s => s.id === id);
    if (!slime) return;
    const currentStatLevel = slime.statLevels[stat];
    if (currentStatLevel >= MAX_SLIME_STAT_LEVEL) return;
    const cost = SLIME_UPGRADE_COST(currentStatLevel);
    
    if (state.coins >= cost) {
      setState(prev => {
        const updatedSlimes = prev.slimes.map(s => s.id === id ? {
          ...s,
          level: s.level + 1,
          value: Math.floor(s.value * 1.2),
          stats: {
            ...s.stats,
            [stat]: s.stats[stat] + SLIME_STAT_UPGRADE_DELTA[stat],
          },
          statLevels: {
            ...s.statLevels,
            [stat]: s.statLevels[stat] + 1
          }
        } : s);
        
        // Update detail popup if open
        if (selectedSlimeDetail && selectedSlimeDetail.id === id) {
          const newSlime = updatedSlimes.find(s => s.id === id);
          if (newSlime) setSelectedSlimeDetail(newSlime);
        }
        
        return {
          ...prev,
          coins: prev.coins - cost,
          slimes: updatedSlimes
        };
      });
    }
  };

  const sellSlime = (id: string) => {
    const slime = state.slimes.find(s => s.id === id);
    if (!slime) return;
    setState(prev => ({
      ...prev,
      coins: prev.coins + slime.value,
      slimes: prev.slimes.filter(s => s.id !== id),
      slimeDetailSeenIds: prev.slimeDetailSeenIds.filter((x) => x !== id),
    }));
  };

  const breedSlimes = () => {
    const id1 = breedingSelection[0];
    const id2 = breedingSelection[1];
    if (!id1 || !id2) return;
    const s1 = state.slimes.find(s => s.id === id1);
    const s2 = state.slimes.find(s => s.id === id2);
    if (!s1 || !s2 || (state.tickets ?? 0) < BREEDING_COST_TICKETS) return;

    const pendingSlime: Slime = {
      id: Math.random().toString(36).substr(2, 9),
      name: getUniqueName(state.slimes),
      color: s1.color,
      ...breedSlimeVisuals(withSlimeVisualDefaults(s1), withSlimeVisualDefaults(s2)),
      stats: {
        health: Math.floor((s1.stats.health + s2.stats.health) / 2) + 2,
        strength: Math.floor((s1.stats.strength + s2.stats.strength) / 2) + 2,
        agility: Math.floor((s1.stats.agility + s2.stats.agility) / 2) + 2,
      },
      statLevels: { health: 1, strength: 1, agility: 1 },
      trait: Math.random() > 0.5 ? s1.trait : s2.trait,
      arenaAbility: Math.random() > 0.5 ? s1.arenaAbility : s2.arenaAbility,
      level: 1,
      value: 100,
      hatchedAt: Date.now()
    };

    setState(prev => ({
      ...prev,
      tickets: (prev.tickets ?? 0) - BREEDING_COST_TICKETS,
      breedingEgg: { progress: 0, pendingSlime },
    }));
    setBreedingSelection([null, null]);
    setActiveBreedingSlot(0);
  };

  const pokeBreedingEgg = () => {
    setState(prev => {
      if (!prev.breedingEgg) return prev;
      const newProgress = prev.breedingEgg.progress + 10;
      if (newProgress >= 100) {
        const newSlime = prev.breedingEgg.pendingSlime;
        return {
          ...prev,
          breedingEgg: null,
          slimes: [...prev.slimes, newSlime],
          newlyHatchedSlime: newSlime,
        };
      }
      return {
        ...prev,
        breedingEgg: { ...prev.breedingEgg, progress: newProgress },
      };
    });
  };

  const handleBreedingSlotClick = (index: 0 | 1) => {
    setActiveBreedingSlot(index);
  };

  const selectBreedingParent = (slimeId: string) => {
    const slot = activeBreedingSlot;
    const isAlreadySelected = breedingSelection[0] === slimeId || breedingSelection[1] === slimeId;

    setBreedingSelection(prev => {
      const next: [string | null, string | null] = [prev[0], prev[1]];
      // Tapping an already-equipped slime unequips it from whichever slot it's in.
      if (next[0] === slimeId) { next[0] = null; return next; }
      if (next[1] === slimeId) { next[1] = null; return next; }
      // Otherwise assign to the active slot.
      next[slot] = slimeId;
      return next;
    });

    // After a fresh assignment, auto-advance to the other slot.
    if (!isAlreadySelected) {
      setActiveBreedingSlot(slot === 0 ? 1 : 0);
    }
  };

  const handleArenaBattleEnd = useCallback(
    (payload: {
      won: boolean;
      encounter: ArenaEncounter;
      teamIds: [string, string, string, string];
      arenaAbilityUserIds: string[];
    }) => {
      const { won, encounter, arenaAbilityUserIds } = payload;
      setState((prev) => {
        let coins = prev.coins;
        let slimeArenaAbilityCooldownUntil = prev.slimeArenaAbilityCooldownUntil;
        if (won) {
          coins += encounter.rewardCoins;
        }
        const arenaWins = won ? (prev.arenaWins ?? 0) + 1 : (prev.arenaWins ?? 0);
        const ticketsEarned = won ? (encounter.rewardTickets ?? 1) : 0;
        const tickets = (prev.tickets ?? 0) + ticketsEarned;
        if (arenaAbilityUserIds.length > 0) {
          const t = Date.now();
          slimeArenaAbilityCooldownUntil = { ...prev.slimeArenaAbilityCooldownUntil };
          for (const id of arenaAbilityUserIds) {
            const slime = prev.slimes.find((x) => x.id === id);
            if (!slime) continue;
            const ms = ARENA_ABILITY_META[slime.arenaAbility].cooldownMs;
            if (ms > 0) {
              slimeArenaAbilityCooldownUntil[id] = t + ms;
            }
          }
        }
        return { ...prev, coins, tickets, slimeArenaAbilityCooldownUntil, arenaWins };
      });
    },
    []
  );

  // Debug Actions
  const goGameWorld = (delta: 1 | -1) => {
    const next = state.gameWorldIndex + delta;
    if (next < 0 || next > state.maxUnlockedGameWorld) return;
    setWorldNavTransition(false);
    setWorldNavShiftPx(delta * 28);
    setState((s) => ({ ...s, gameWorldIndex: next }));
    if (next < state.maxUnlockedGameWorld) setIsUpgradesOpen(false);
  };

  useLayoutEffect(() => {
    if (worldNavShiftPx === 0) return;
    setWorldNavTransition(true);
    setWorldNavShiftPx(0);
  }, [state.gameWorldIndex, worldNavShiftPx]);


  if (isLoading && loadingProgress < 100) {
    return (
      <div className="bg-app-splash flex h-full min-h-[100dvh] w-full flex-col items-center justify-center p-8 select-none">
        <motion.h1
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="mb-4 bg-gradient-to-br from-emerald-900 via-teal-800 to-orange-800 bg-clip-text text-center text-5xl font-bold text-transparent"
        >
          Slime School Tycoon
        </motion.h1>
        <div className="h-4 w-full max-w-xs overflow-hidden rounded-full border-2 border-white/40 bg-white/25 shadow-inner backdrop-blur-sm">
          <motion.div 
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-400"
            initial={{ width: 0 }}
            animate={{ width: `${loadingProgress}%` }}
          />
        </div>
        <p className="mt-4 font-medium text-emerald-900/80">Loading {loadingProgress}%</p>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div 
        className="bg-app-splash flex h-full min-h-[100dvh] w-full cursor-pointer flex-col items-center justify-center p-8 select-none"
        onClick={() => setHasStarted(true)}
      >
        <motion.h1 
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="mb-4 bg-gradient-to-br from-emerald-900 via-teal-800 to-orange-800 bg-clip-text text-center text-5xl font-bold text-transparent"
        >
          Slime School Tycoon
        </motion.h1>
        <motion.p 
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="mt-12 text-xl font-bold text-emerald-900/85"
        >
          Tap to continue
        </motion.p>
      </div>
    );
  }

  const currentEquippedIds = state.equippedSlimeIdsByWorld[state.gameWorldIndex] ?? [];

  return (
    <>
      {/* Header Stats — overlays full-screen game; normal flow on other tabs; hidden during arena battle */}
      {!shellOverArenaFight && <div
        className={
          isGameTab
            ? `glass-header-game pointer-events-none absolute top-0 right-0 left-0 ${isUpgradesOpen ? 'z-[55]' : 'z-30'} grid grid-cols-[minmax(2.5rem,1fr)_auto_minmax(2.5rem,1fr)] items-center px-2 pt-header-safe pb-3`
            : 'glass-header-page relative z-10 grid grid-cols-[minmax(2.5rem,1fr)_auto_minmax(2.5rem,1fr)] items-center px-2 pt-header-safe pb-3'
        }
      >
        <div />
        <div className="flex items-center justify-center gap-5">
          <div className="flex items-center gap-2">
            <div
              className={
                isGameTab
                  ? 'ui-emerald-outline rounded-full bg-gradient-to-br from-amber-100 to-orange-200 p-2 shadow-inner'
                  : 'rounded-full bg-gradient-to-br from-amber-100 to-orange-200 p-2 shadow-inner ring-2 ring-orange-200/60'
              }
            >
              <CircleDollarSign className="h-5 w-5 text-orange-700" />
            </div>
            <span className="text-xl font-bold tabular-nums text-emerald-950">{state.coins.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-gradient-to-br from-violet-100 to-purple-200 p-2 shadow-inner ring-2 ring-purple-200/50">
              <Ticket className="h-5 w-5 text-purple-700" />
            </div>
            <span className="text-xl font-bold tabular-nums text-emerald-950">{(state.tickets ?? 0)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOptionsOpen(true)}
          className={
            isGameTab
              ? 'ui-emerald-outline-soft pointer-events-auto justify-self-end rounded-xl bg-white/25 p-2 text-emerald-900/70 backdrop-blur-sm transition-colors hover:bg-white/40 hover:text-orange-600'
              : 'pointer-events-auto justify-self-end rounded-xl p-2 text-emerald-900/70 transition-colors hover:bg-white/40 hover:text-orange-600'
          }
          aria-label="Options"
          aria-haspopup="dialog"
          aria-expanded={isOptionsOpen}
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>}

      {/* Options — centered modal */}
      <AnimatePresence>
        {isOptionsOpen && (
          <motion.div
            key="options-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={
              shellOverArenaFight
                ? 'absolute inset-0 z-[125] flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm'
                : 'absolute inset-0 z-[101] flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm'
            }
            onClick={() => setIsOptionsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="options-title"
              className="relative w-full max-w-xs overflow-hidden rounded-3xl border border-emerald-100/90 bg-gradient-to-b from-white to-orange-50/40 p-6 pt-7 shadow-2xl shadow-emerald-900/15 ring-1 ring-orange-100/70"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-orange-400" />
              <div className="relative mb-5 min-h-[2.25rem]">
                <h2
                  id="options-title"
                  className="flex items-center justify-center gap-2 pr-10 text-center text-xl font-black text-gray-800"
                >
                  <Settings className="h-5 w-5 shrink-0 text-orange-500" aria-hidden />
                  Options
                </h2>
                <button
                  type="button"
                  onClick={() => setIsOptionsOpen(false)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-gray-50/60 p-1 text-gray-400 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500"
                  aria-label="Close options"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <OptionsOnOffRow
                className="mb-3"
                icon={<Music className="h-5 w-5" />}
                label="Music"
                switchId="opt-music"
                checked={state.settings.musicEnabled}
                onToggle={() =>
                  setState((s) => ({
                    ...s,
                    settings: { ...s.settings, musicEnabled: !s.settings.musicEnabled },
                  }))
                }
              />
              <OptionsOnOffRow
                className="mb-3"
                icon={<Volume2 className="h-5 w-5" />}
                label="Sound effects"
                switchId="opt-sfx"
                checked={state.settings.sfxEnabled}
                onToggle={() =>
                  setState((s) => ({
                    ...s,
                    settings: { ...s.settings, sfxEnabled: !s.settings.sfxEnabled },
                  }))
                }
              />
              <OptionsOnOffRow
                className="mb-4"
                icon={<Vibrate className="h-5 w-5" />}
                label="Vibration"
                switchId="opt-haptics"
                checked={state.settings.hapticsEnabled}
                onToggle={() =>
                  setState((s) => {
                    const next = !s.settings.hapticsEnabled;
                    if (next) {
                      triggerPreviewHaptic();
                    }
                    return {
                      ...s,
                      settings: { ...s.settings, hapticsEnabled: next },
                    };
                  })
                }
              />

              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsOpen(false);
                    window.open(PLAY_STORE_LISTING_URL, '_blank', 'noopener,noreferrer');
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-center text-base font-bold text-emerald-900 transition-colors hover:bg-orange-50"
                >
                  <Star
                    className="h-5 w-5 shrink-0 fill-amber-400 text-amber-500"
                    fill="currentColor"
                    strokeWidth={0}
                    aria-hidden
                  />
                  Rate the game
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsOpen(false);
                    window.location.href = SUPPORT_MAILTO;
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-center text-base font-bold text-emerald-900 transition-colors hover:bg-orange-50"
                >
                  <Mail
                    className="h-5 w-5 shrink-0 text-emerald-700"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  Contact support
                </button>
              </div>

              <p className="mt-4 text-center text-[10px] leading-tight text-gray-500/90">
                Music by chajamakesmusic
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline earnings — welcome back (load or resume with automation) */}
      <AnimatePresence>
        {offlineWelcome && hasStarted && (
          <motion.div
            key="offline-welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[205] flex items-center justify-center bg-gradient-to-br from-amber-500/95 via-orange-500/90 to-emerald-700/95 p-6 text-center backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.88, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-amber-100/90 bg-gradient-to-b from-white to-orange-50/50 p-6 pt-8 shadow-2xl shadow-emerald-900/25 ring-2 ring-amber-200/60"
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 via-lime-400 to-emerald-500" />
              <motion.div
                animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
                className="mb-4 flex justify-center"
              >
                <Sparkles className="h-14 w-14 text-amber-500 drop-shadow-md" />
              </motion.div>
              <h2 className="mb-5 text-2xl font-black text-emerald-950 drop-shadow-sm">
                Welcome back!
              </h2>
              <div className="mb-6 flex flex-col items-center gap-2 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 py-5 shadow-inner">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-800/90">
                  <Timer className="h-3.5 w-3.5" aria-hidden />
                  Coins collected offline
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-gradient-to-br from-amber-100 to-orange-200 p-2.5 shadow-inner ring-2 ring-orange-200/70">
                    <Coins className="h-7 w-7 text-orange-700" aria-hidden />
                  </div>
                  <span className="text-4xl font-black tabular-nums text-emerald-950">
                    +{offlineWelcome.currencyEarned.toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-emerald-700/80">
                  {offlineWelcome.idleCoins.toLocaleString()} coin
                  {offlineWelcome.idleCoins === 1 ? '' : 's'} × value upgrades
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOfflineWelcome(null)}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-4 text-lg font-black text-white shadow-lg shadow-emerald-900/25 ring-2 ring-white/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Collect
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Max upgrades: next playfield unlocked */}
      <AnimatePresence>
        {worldUnlockCelebration && hasStarted && (
          <motion.div
            key="world-unlock"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[206] flex items-center justify-center bg-gradient-to-br from-violet-600/95 via-fuchsia-500/90 to-emerald-600/95 p-6 text-center backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.88, y: 28 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-b from-white to-fuchsia-50/60 p-6 pt-8 shadow-2xl shadow-emerald-900/30 ring-2 ring-fuchsia-200/70"
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-violet-500 via-fuchsia-400 to-emerald-500" />
              <motion.div
                animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 2.4 }}
                className="mb-3 flex justify-center gap-2"
              >
                <PartyPopper className="h-11 w-11 text-fuchsia-500 drop-shadow-md" aria-hidden />
                <Trophy className="h-12 w-12 text-amber-500 drop-shadow-md" aria-hidden />
              </motion.div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.35em] text-fuchsia-700/90">
                Level complete
              </p>
              <h2 className="mb-2 text-2xl font-black text-emerald-950 drop-shadow-sm">
                New area unlocked!
              </h2>
              <p className="mb-2 text-[11px] font-bold tabular-nums text-emerald-600/95">
                Stage {worldUnlockCelebration.worldIndex + 1}
              </p>
              <p className="mb-1 text-sm font-bold text-emerald-800/90">
                Welcome to{' '}
                <span className="text-fuchsia-800">{worldUnlockCelebration.worldName}</span>
              </p>
              <p className="mb-6 text-xs font-semibold leading-snug text-emerald-700/85">
                Shop upgrades were reset for this tier—keep collecting and power up again as you
                explore the next stage of your journey.
              </p>
              <button
                type="button"
                onClick={() => setWorldUnlockCelebration(null)}
                className="w-full rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-emerald-600 py-4 text-lg font-black text-white shadow-lg shadow-emerald-900/25 ring-2 ring-white/35 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Enter new level
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breeding Egg Overlay — full-screen tap-to-hatch after breeding */}
      <AnimatePresence>
        {state.breedingEgg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[112] flex cursor-pointer flex-col items-center justify-center gap-8 bg-black/85 p-6 text-center backdrop-blur-md"
            onClick={pokeBreedingEgg}
          >
            <motion.div
              initial={{ scale: 0.8, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="flex flex-col items-center gap-1">
                <Dna className="mb-1 h-8 w-8 text-orange-400 drop-shadow-md" aria-hidden />
                <h2 className="text-3xl font-black text-white drop-shadow-sm">Breeding!</h2>
                <p className="text-sm font-bold text-white/60">Tap the egg to hatch your new slime</p>
              </div>

              {/* Egg */}
              <motion.div
                animate={{ scale: [1, 1.03, 1], rotate: [0, -1.5, 1.5, 0] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
                whileTap={{ scale: 0.93, rotate: [-3, 3, 0] }}
                className="relative flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); pokeBreedingEgg(); }}
              >
                <div className="relative h-44 w-36 flex items-center justify-center">
                  {/* Egg shell */}
                  <div className="absolute w-32 h-44 bg-gradient-to-br from-yellow-50 to-yellow-200 border-4 border-yellow-500 rounded-[50%_50%_50%_50%/_60%_60%_40%_40%] shadow-[0_0_60px_rgba(250,204,21,0.4)] overflow-hidden">
                    <div className="absolute top-6 left-6 w-7 h-12 bg-white/40 rounded-full blur-[3px] -rotate-12" />
                  </div>

                  {/* Crack SVG — same as hatching tab */}
                  <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none" viewBox="0 0 144 176">
                    <g fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" stroke="#713F12">
                      <motion.path
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{
                          pathLength: state.breedingEgg.progress > 20 ? 1 : 0,
                          opacity: state.breedingEgg.progress > 20 ? 1 : 0,
                        }}
                        d="M50,50 L56,62 L47,73 L61,84"
                      />
                      <motion.path
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{
                          pathLength: state.breedingEgg.progress > 45 ? 1 : 0,
                          opacity: state.breedingEgg.progress > 45 ? 1 : 0,
                        }}
                        d="M96,124 L85,113 L93,102 L79,91"
                      />
                      <motion.path
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{
                          pathLength: state.breedingEgg.progress > 70 ? 1 : 0,
                          opacity: state.breedingEgg.progress > 70 ? 1 : 0,
                        }}
                        d="M34,96 L45,107 L36,119 L51,130"
                      />
                      <motion.path
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{
                          pathLength: state.breedingEgg.progress > 90 ? 1 : 0,
                          opacity: state.breedingEgg.progress > 90 ? 1 : 0,
                        }}
                        d="M72,36 L68,57 L76,79 L72,102 L79,124"
                        strokeWidth="3.5"
                      />
                    </g>
                  </svg>

                  {/* "Tap!" label */}
                  <div className="relative z-20 flex items-center justify-center">
                    <motion.span
                      animate={{
                        scale: [1, 1.06 + state.breedingEgg.progress / 500, 1],
                        color: state.breedingEgg.progress > 80 ? ['#713F12', '#92400E', '#713F12'] : '#713F12',
                      }}
                      transition={{ repeat: Infinity, duration: 0.75 }}
                      className="select-none text-base font-extrabold tracking-widest text-yellow-900 drop-shadow-md"
                    >
                      Tap!
                    </motion.span>
                  </div>
                </div>
              </motion.div>

              {/* Progress bar */}
              <div className="flex w-56 flex-col items-center gap-2">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/15 shadow-inner">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-orange-400"
                    animate={{ width: `${state.breedingEgg.progress}%` }}
                    transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                  />
                </div>
                <p className="text-xs font-black text-white/70">{state.breedingEgg.progress}% hatched</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hatching Celebration Overlay */}
      <AnimatePresence>
        {state.newlyHatchedSlime && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-center justify-center bg-black/50 px-5 py-6 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="flex w-full max-w-sm flex-col items-center overflow-y-auto rounded-3xl bg-gradient-to-br from-emerald-600 via-green-600 to-orange-400 px-5 py-6 text-center shadow-2xl"
            >
              <motion.div 
                animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="mb-3"
              >
                <PartyPopper className="h-10 w-10 text-amber-100 drop-shadow-md" />
              </motion.div>
              
              <h2 className="mb-1 text-3xl font-black text-white drop-shadow-sm">New slime!</h2>
              <p className="mb-4 text-sm font-bold text-emerald-50">A beautiful new friend has joined your collection!</p>

              <div className="relative mb-4">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute inset-0 bg-white rounded-full blur-3xl"
                />
                <div className="relative flex w-32 items-center justify-center">
                  <SlimeStackSprite slime={state.newlyHatchedSlime} size="2xl" className="shadow-2xl ring-4 ring-white/30" />
                </div>
              </div>

              <div className="mb-4 w-full rounded-2xl bg-white/20 p-3.5 text-left backdrop-blur-sm">
                <h3 className="mb-1 text-center text-lg font-black text-white">
                  {state.newlyHatchedSlime.name}
                </h3>
                <div className="mb-2.5 flex justify-center">
                  <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-[10px] font-black text-white">
                    Level {state.newlyHatchedSlime.level}
                  </span>
                </div>

                <div className="mb-2.5 flex items-center justify-center gap-4 rounded-xl bg-black/10 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Heart className="h-4 w-4 shrink-0 text-red-200" aria-hidden />
                    <span className="text-sm font-black tabular-nums text-white">
                      {state.newlyHatchedSlime.stats.health}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sword className="h-4 w-4 shrink-0 text-amber-200" aria-hidden />
                    <span className="text-sm font-black tabular-nums text-white">
                      {state.newlyHatchedSlime.stats.strength}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Wind className="h-4 w-4 shrink-0 text-sky-200" aria-hidden />
                    <span className="text-sm font-black tabular-nums text-white">
                      {state.newlyHatchedSlime.stats.agility}
                    </span>
                  </div>
                </div>

                <div className="border-t border-white/20 py-2.5 text-center">
                  <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-emerald-100/90">
                    Coin field trait
                  </p>
                  <p className="mb-0.5 text-sm font-black text-white">{state.newlyHatchedSlime.trait}</p>
                  <p className="text-xs font-bold italic leading-snug text-emerald-50/95">"{TRAIT_EFFECTS[state.newlyHatchedSlime.trait].description}"</p>
                </div>

                <div className="border-t border-white/20 pt-2.5 text-center">
                  <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-emerald-100/90">
                    Arena ability
                  </p>
                  <p className="mb-0.5 text-sm font-black text-violet-100">
                    {ARENA_ABILITY_META[state.newlyHatchedSlime.arenaAbility].name}
                  </p>
                  <p className="text-xs font-bold italic leading-snug text-emerald-50/95">"{ARENA_ABILITY_META[state.newlyHatchedSlime.arenaAbility].description}"</p>
                </div>
              </div>

              <button 
                onClick={() => setState(s => ({ ...s, newlyHatchedSlime: null }))}
                className="rounded-2xl bg-white px-10 py-3 text-base font-black text-orange-600 shadow-xl ring-2 ring-orange-200/80 transition-transform hover:scale-105"
              >
                Awesome!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Multi-Slime Celebration Overlay (Buy x10) */}
      <AnimatePresence>
        {state.newlyHatchedSlimes && state.newlyHatchedSlimes.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-center justify-center bg-black/50 px-5 py-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="flex w-full max-w-sm flex-col items-center overflow-y-auto rounded-3xl bg-gradient-to-br from-emerald-600 via-green-600 to-orange-400 px-5 py-6 text-center shadow-2xl"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="mb-3"
              >
                <PartyPopper className="h-10 w-10 text-amber-100 drop-shadow-md" />
              </motion.div>

              <h2 className="mb-1 text-3xl font-black text-white drop-shadow-sm">10 new slimes!</h2>
              <p className="mb-4 text-sm font-bold text-emerald-50">A whole squad has joined your collection!</p>

              <div className="mb-4 w-full rounded-2xl bg-white/20 p-3 backdrop-blur-sm">
                <div className="grid grid-cols-5 gap-2">
                  {state.newlyHatchedSlimes.map((slime) => (
                    <motion.div
                      key={slime.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: state.newlyHatchedSlimes!.indexOf(slime) * 0.05 }}
                      className="flex flex-col items-center gap-1"
                    >
                      <SlimeStackSprite slime={slime} size="lg" className="shadow-lg ring-2 ring-white/30" />
                      <span className="text-[8px] font-black leading-tight text-white/90 text-center line-clamp-1 w-full">{slime.name}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setState(s => ({ ...s, newlyHatchedSlimes: null }))}
                className="rounded-2xl bg-white px-10 py-3 text-base font-black text-orange-600 shadow-xl ring-2 ring-orange-200/80 transition-transform hover:scale-105"
              >
                Awesome!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slime Detail Popup */}
      <AnimatePresence>
        {selectedSlimeDetail && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[150] flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
            onClick={() => setSelectedSlimeDetail(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-emerald-100/90 bg-white p-6 pt-8 shadow-2xl shadow-emerald-900/15 ring-1 ring-orange-100/80"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 via-lime-400 to-orange-400" />
              <button 
                onClick={() => setSelectedSlimeDetail(null)}
                className="absolute top-4 right-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-1.5 text-emerald-400 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center pt-2">
                <motion.div 
                  initial={{ rotate: -5, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  className="mb-4"
                >
                  <SlimeStackSprite slime={selectedSlimeDetail} size="xl" className="shadow-xl ring-2 ring-emerald-100/80" />
                </motion.div>

                <h3 className="text-xl font-black text-gray-800 mb-1">{selectedSlimeDetail.name}</h3>
                <div className="flex gap-2 mb-4">
                  <span className="rounded-full bg-gradient-to-r from-violet-100 to-purple-100 px-2 py-0.5 text-[9px] font-black text-purple-700">
                    Level {selectedSlimeDetail.level}
                  </span>
                </div>

                <div className="mb-3 w-full space-y-3 rounded-[2rem] border border-emerald-100/60 bg-gradient-to-b from-emerald-50/80 to-orange-50/30 p-3">
                  <div className="text-center mb-1">
                    <p className="text-[9px] font-black text-gray-400 tracking-widest leading-none mb-1">Coin field trait</p>
                    <p className="text-xs font-bold text-gray-600 italic">"{TRAIT_EFFECTS[selectedSlimeDetail.trait].description}"</p>
                  </div>

                  <div className="text-center border-t border-emerald-100/80 pt-3">
                    <p className="text-[9px] font-black text-gray-400 tracking-widest leading-none mb-1">Arena ability</p>
                    <p className="text-xs font-black text-violet-800">
                      {ARENA_ABILITY_META[selectedSlimeDetail.arenaAbility].name}
                    </p>
                    <p className="text-xs font-bold text-gray-600 italic">
                      "{ARENA_ABILITY_META[selectedSlimeDetail.arenaAbility].description}"
                    </p>
                    {isArenaAbilityOnCooldown(
                      state.slimeArenaAbilityCooldownUntil,
                      selectedSlimeDetail.id,
                      nowMs
                    ) && (
                      <p className="mt-1.5 text-[10px] font-bold text-violet-600">
                        Recharging:{' '}
                        {formatSlimeCooldownShort(
                          Math.max(
                            0,
                            (state.slimeArenaAbilityCooldownUntil[selectedSlimeDetail.id] ?? 0) - nowMs
                          )
                        )}{' '}
                        left
                      </p>
                    )}
                  </div>

                  <div className="text-center pt-0.5">
                    <p className="text-[8px] font-black text-gray-400 tracking-[0.15em] border-t border-gray-100 pt-1.5 mb-1.5">Tap to upgrade</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {/* Health */}
                    <button
                      type="button"
                      onClick={() => upgradeSlimeStat(selectedSlimeDetail.id, 'health')}
                      disabled={selectedSlimeDetail.statLevels.health >= MAX_SLIME_STAT_LEVEL || state.coins < SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.health)}
                      className="ui-afford-disabled group flex flex-col items-center gap-1 rounded-2xl border-2 border-red-100 bg-red-50 px-2 py-2 shadow-sm transition-all hover:border-red-300 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:shadow-none"
                    >
                      <div className="text-red-500 transition-transform group-active:scale-110 group-disabled:text-zinc-500"><Heart className="h-5 w-5" /></div>
                      <div className="text-[9px] font-black leading-none text-red-400 group-disabled:text-zinc-500">Health</div>
                      <div className="flex items-baseline gap-0.5 font-black tabular-nums leading-none">
                        <span className="text-sm text-zinc-800 group-disabled:text-zinc-700">{selectedSlimeDetail.stats.health}</span>
                        <ChevronRight className="h-3 w-3 shrink-0 self-center text-zinc-400" aria-hidden />
                        <span className="text-sm text-emerald-600 group-disabled:text-emerald-600/70">{selectedSlimeDetail.stats.health + SLIME_STAT_UPGRADE_DELTA.health}</span>
                      </div>
                      <div className="w-full rounded-lg border-2 border-orange-500 bg-gradient-to-br from-amber-400 to-orange-500 py-0.5 text-center shadow-sm group-disabled:border-zinc-300 group-disabled:from-zinc-200 group-disabled:to-zinc-300">
                        <div className="text-[9px] font-black text-white/95 group-disabled:text-zinc-600">
                          {selectedSlimeDetail.statLevels.health >= MAX_SLIME_STAT_LEVEL ? 'MAX' : `${SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.health)}💰`}
                        </div>
                      </div>
                    </button>
                    {/* Strength */}
                    <button
                      type="button"
                      onClick={() => upgradeSlimeStat(selectedSlimeDetail.id, 'strength')}
                      disabled={selectedSlimeDetail.statLevels.strength >= MAX_SLIME_STAT_LEVEL || state.coins < SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.strength)}
                      className="ui-afford-disabled group flex flex-col items-center gap-1 rounded-2xl border-2 border-orange-100 bg-orange-50 px-2 py-2 shadow-sm transition-all hover:border-orange-300 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:shadow-none"
                    >
                      <div className="text-orange-500 transition-transform group-active:scale-110 group-disabled:text-zinc-500"><Sword className="h-5 w-5" /></div>
                      <div className="text-[9px] font-black leading-none text-orange-400 group-disabled:text-zinc-500">Strength</div>
                      <div className="flex items-baseline gap-0.5 font-black tabular-nums leading-none">
                        <span className="text-sm text-zinc-800 group-disabled:text-zinc-700">{selectedSlimeDetail.stats.strength}</span>
                        <ChevronRight className="h-3 w-3 shrink-0 self-center text-zinc-400" aria-hidden />
                        <span className="text-sm text-emerald-600 group-disabled:text-emerald-600/70">{selectedSlimeDetail.stats.strength + SLIME_STAT_UPGRADE_DELTA.strength}</span>
                      </div>
                      <div className="w-full rounded-lg border-2 border-orange-500 bg-gradient-to-br from-amber-400 to-orange-500 py-0.5 text-center shadow-sm group-disabled:border-zinc-300 group-disabled:from-zinc-200 group-disabled:to-zinc-300">
                        <div className="text-[9px] font-black text-white/95 group-disabled:text-zinc-600">
                          {selectedSlimeDetail.statLevels.strength >= MAX_SLIME_STAT_LEVEL ? 'MAX' : `${SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.strength)}💰`}
                        </div>
                      </div>
                    </button>
                    {/* Agility */}
                    <button
                      type="button"
                      onClick={() => upgradeSlimeStat(selectedSlimeDetail.id, 'agility')}
                      disabled={selectedSlimeDetail.statLevels.agility >= MAX_SLIME_STAT_LEVEL || state.coins < SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.agility)}
                      className="ui-afford-disabled group flex flex-col items-center gap-1 rounded-2xl border-2 border-blue-100 bg-blue-50 px-2 py-2 shadow-sm transition-all hover:border-blue-300 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:shadow-none"
                    >
                      <div className="text-blue-500 transition-transform group-active:scale-110 group-disabled:text-zinc-500"><Wind className="h-5 w-5" /></div>
                      <div className="text-[9px] font-black leading-none text-blue-400 group-disabled:text-zinc-500">Agility</div>
                      <div className="flex items-baseline gap-0.5 font-black tabular-nums leading-none">
                        <span className="text-sm text-zinc-800 group-disabled:text-zinc-700">{selectedSlimeDetail.stats.agility}</span>
                        <ChevronRight className="h-3 w-3 shrink-0 self-center text-zinc-400" aria-hidden />
                        <span className="text-sm text-emerald-600 group-disabled:text-emerald-600/70">{selectedSlimeDetail.stats.agility + SLIME_STAT_UPGRADE_DELTA.agility}</span>
                      </div>
                      <div className="w-full rounded-lg border-2 border-orange-500 bg-gradient-to-br from-amber-400 to-orange-500 py-0.5 text-center shadow-sm group-disabled:border-zinc-300 group-disabled:from-zinc-200 group-disabled:to-zinc-300">
                        <div className="text-[9px] font-black text-white/95 group-disabled:text-zinc-600">
                          {selectedSlimeDetail.statLevels.agility >= MAX_SLIME_STAT_LEVEL ? 'MAX' : `${SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.agility)}💰`}
                        </div>
                      </div>
                    </button>
                  </div>

                    <div className="w-full mt-2">
                      <button 
                        onClick={() => {
                          toggleEquipSlime(selectedSlimeDetail.id);
                        }}
                        className={`w-full rounded-xl py-3 text-sm font-black tracking-widest transition-all ${
                          currentEquippedIds.includes(selectedSlimeDetail.id)
                          ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md hover:brightness-105'
                          : 'btn-primary-glow shadow-md'
                        }`}
                      >
                        {currentEquippedIds.includes(selectedSlimeDetail.id) ? 'Unequip' : 'Equip'}
                      </button>
                    </div>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swap Slime Popup — shown when team is full and player wants to equip a new slime */}
      <AnimatePresence>
        {pendingEquipSlimeId && (() => {
          const incoming = state.slimes.find(s => s.id === pendingEquipSlimeId);
          const equippedSlimes = state.slimes.filter(s => currentEquippedIds.includes(s.id));
          if (!incoming) return null;
          return (
            <motion.div
              key="swap-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[160] flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
              onClick={() => setPendingEquipSlimeId(null)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-emerald-100/90 bg-white p-6 pt-8 shadow-2xl shadow-emerald-900/15 ring-1 ring-orange-100/80"
                onClick={e => e.stopPropagation()}
              >
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 via-lime-400 to-orange-400" />
                <button
                  onClick={() => setPendingEquipSlimeId(null)}
                  className="absolute top-4 right-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-1.5 text-emerald-400 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Incoming slime preview */}
                <div className="flex flex-col items-center mb-5">
                  <SlimeStackSprite slime={incoming} size="xl" className="shadow-xl ring-2 ring-orange-200/80 mb-3" />
                  <h3 className="text-base font-black text-gray-800">{incoming.name}</h3>
                  <p className="mt-1 text-[10px] font-black tracking-widest text-gray-400">JOINING YOUR TEAM</p>
                </div>

                <p className="mb-4 text-center text-xs font-bold text-gray-500">
                  Your team is full. Choose a slime to swap out:
                </p>

                {/* Currently equipped slimes — tap one to replace it */}
                <div className="grid grid-cols-3 gap-3">
                  {equippedSlimes.map(slime => (
                    <button
                      key={slime.id}
                      type="button"
                      onClick={() => confirmSwapSlime(slime.id)}
                      className="flex flex-col items-center gap-1 rounded-2xl border border-rose-200 bg-gradient-to-b from-rose-50 to-orange-50 p-2 shadow-sm transition-all active:scale-95 hover:border-rose-400 hover:brightness-95"
                    >
                      <SlimeStackSprite slime={slime} size="lg" />
                      <span className="text-[9px] font-black text-gray-700 truncate w-full text-center px-0.5">
                        {slime.name}
                      </span>
                      <span className="flex items-center gap-1 text-[8px] font-black text-rose-600">
                        <X className="w-2.5 h-2.5" /> Remove
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-lime-50/60 px-4 py-3 text-center">
                  <p className="text-[10px] font-bold text-emerald-700 mb-2.5">
                    Want to equip more slimes at once?{' '}
                    <span className="text-emerald-900">Upgrade your Slime Slots</span> to expand your team!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingEquipSlimeId(null);
                      setState(s => ({ ...s, activeTab: 'game' }));
                      setIsUpgradesOpen(true);
                      setTimeout(() => {
                        slimeCapUpgradeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 200);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 px-4 py-1.5 text-[11px] font-black tracking-wide text-white shadow-md transition-all active:scale-95 hover:brightness-105"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Go to Upgrades
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Main Content Area — game fills viewport under floating chrome */}
      <div className={`relative min-h-0 flex-1 overflow-hidden ${isGameTab ? 'bg-transparent' : ''}`}>
        <AnimatePresence mode="wait">
          {state.activeTab === 'game' && (
            <motion.div 
              key="game"
              initial={{ y: 12, opacity: 1 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 h-full min-h-0 w-full"
            >
              <div className="relative h-full min-h-0 w-full">
                <div
                  className="absolute inset-0 h-full min-h-0 w-full will-change-transform"
                  style={{
                    transform: `translate3d(${worldNavShiftPx}px,0,0)`,
                    transition: worldNavTransition
                      ? 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)'
                      : 'none',
                  }}
                >
                  <GameWorld
                    worldIndex={state.gameWorldIndex}
                    onCollect={handleGameCollect}
                    onSlimeTap={playSlimeTap}
                    movementSpeedLevel={state.upgrades.movementSpeed}
                    slimeMovementSpeedLevel={state.upgrades.slimeMovementSpeed}
                    respawnTimeLevel={state.upgrades.respawnTime}
                    coinCapLevel={state.upgrades.coinCap}
                    equippedSlimes={state.slimes.filter((s) =>
                      currentEquippedIds.includes(s.id)
                    )}
                    insetLeftForWorldNav={state.gameWorldIndex > 0}
                    insetRightForWorldNav={
                      state.maxUnlockedGameWorld > state.gameWorldIndex ||
                      (state.gameWorldIndex === state.maxUnlockedGameWorld &&
                        state.maxUnlockedGameWorld < GAME_WORLDS.length - 1)
                    }
                    disableCoins={isCompletedLevel}
                  />
                </div>

                <div className="pointer-events-none absolute left-0 right-0 top-game-world-label z-[35] flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="ui-emerald-outline-soft rounded-full bg-emerald-950/25 px-3 py-1 shadow-sm backdrop-blur-md">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                        {GAME_WORLDS[state.gameWorldIndex]?.name ?? GAME_WORLDS[0].name}
                      </span>
                    </div>
                    {isCompletedLevel && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" strokeWidth={2.5} />
                    )}
                  </div>
                  {!isCompletedLevel && (
                    <LevelCompletionBar
                      worldCoinsCollected={state.worldCoinsCollected ?? 0}
                      goalsClaimed={state.worldGoalsClaimed ?? [false, false, false, false, false, false, false, false]}
                      onClaim={handleClaimGoal}
                      worldIndex={state.maxUnlockedGameWorld}
                      allUpgradesMaxed={areAllGameUpgradesMaxed(state.upgrades, state.gameWorldIndex)}
                      upgradesProgress={getGameUpgradesMaxedProgress(state.upgrades, state.gameWorldIndex)}
                    />
                  )}
                </div>

                {state.gameWorldIndex > 0 && (
                  <button
                    type="button"
                    aria-label="Previous area"
                    onClick={() => goGameWorld(-1)}
                    className="pointer-events-auto absolute left-2 top-1/2 z-[38] -translate-y-1/2 rounded-full border-2 border-emerald-300/85 bg-gradient-to-br from-emerald-500 to-teal-600 p-2 text-white shadow-lg shadow-emerald-900/30 ring-2 ring-emerald-200/55 backdrop-blur-md transition hover:brightness-110 active:scale-95"
                  >
                    <ChevronLeft className="h-7 w-7 text-white" strokeWidth={2.25} />
                  </button>
                )}

                {state.maxUnlockedGameWorld > state.gameWorldIndex && (
                  <button
                    type="button"
                    aria-label="Next area"
                    onClick={() => goGameWorld(1)}
                    className="pointer-events-auto absolute right-2 top-1/2 z-[38] -translate-y-1/2 rounded-full border-2 border-emerald-300/85 bg-gradient-to-br from-emerald-500 to-teal-600 p-2 text-white shadow-lg shadow-emerald-900/30 ring-2 ring-emerald-200/55 backdrop-blur-md transition hover:brightness-110 active:scale-95"
                  >
                    <ChevronRight className="h-7 w-7 text-white" strokeWidth={2.25} />
                  </button>
                )}

                {state.gameWorldIndex === state.maxUnlockedGameWorld &&
                  state.maxUnlockedGameWorld < GAME_WORLDS.length - 1 && (
                    <>
                      <AnimatePresence>
                        {showLockedNextWorldHint && (
                          <motion.div
                            key="locked-next-world-hint"
                            initial={{ opacity: 0, x: 8, scale: 0.88 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 8, scale: 0.88 }}
                            transition={{ duration: 0.18 }}
                            className="pointer-events-none absolute right-14 top-1/2 z-[39] -translate-y-1/2 max-w-[160px] rounded-xl border border-gray-400/40 bg-gray-800/80 px-2.5 py-1.5 text-center text-[10px] font-bold leading-tight tracking-wide text-gray-100 shadow-lg backdrop-blur-sm"
                          >
                            Max all upgrades to unlock the next area
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <button
                        type="button"
                        aria-label="Next area locked. Max all game upgrades in this world to unlock."
                        onClick={() => {
                          if (lockedHintTimerRef.current) clearTimeout(lockedHintTimerRef.current);
                          setShowLockedNextWorldHint(true);
                          lockedHintTimerRef.current = setTimeout(() => setShowLockedNextWorldHint(false), 2500);
                        }}
                        className="pointer-events-auto absolute right-2 top-1/2 z-[38] -translate-y-1/2 active:scale-95"
                      >
                        <div className="relative rounded-full border-2 border-gray-400/50 bg-gray-500/15 p-2 shadow-inner ring-1 ring-gray-400/30 backdrop-blur-sm">
                          <ChevronRight
                            className="h-7 w-7 text-gray-400/90"
                            strokeWidth={2.25}
                            aria-hidden
                          />
                          <div className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-gray-500/40 bg-gray-600 shadow-sm">
                            <Lock className="h-2.5 w-2.5 text-gray-100" strokeWidth={2.5} aria-hidden />
                          </div>
                        </div>
                      </button>
                    </>
                  )}

                {state.gameWorldIndex === GAME_WORLDS.length - 1 && (
                  <div
                    className="pointer-events-none absolute right-2 top-1/2 z-[38] -translate-y-1/2 flex flex-col items-center gap-1"
                    role="img"
                    aria-label="Coming soon"
                  >
                    <div className="relative rounded-full border-2 border-gray-400/30 bg-gray-500/10 p-2 shadow-inner ring-1 ring-gray-400/20 backdrop-blur-sm">
                      <ChevronRight
                        className="h-7 w-7 text-gray-400/50"
                        strokeWidth={2.25}
                        aria-hidden
                      />
                      <div className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-gray-500/30 bg-gray-600/80 shadow-sm">
                        <Lock className="h-2.5 w-2.5 text-gray-300/70" strokeWidth={2.5} aria-hidden />
                      </div>
                    </div>
                    <span className="rounded-full bg-gray-800/50 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-gray-400/70 backdrop-blur-sm">
                      COMING SOON
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {state.activeTab === 'slimes' && (
            <motion.div 
              key="slimes"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              className="flex h-full min-h-0 w-full flex-col overflow-hidden"
            >
              {/* Shop: Buy Slimes */}
              <div className="flex flex-none flex-col justify-center border-b border-emerald-100/80 bg-gradient-to-b from-emerald-100/90 via-orange-50/50 to-white px-3 py-4">
                <div className="flex flex-col items-center gap-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Get New Slimes</p>
                  {/* Buy Buttons */}
                  <div className="flex gap-3 w-full max-w-sm">
                    <button 
                      type="button"
                      onClick={() => buySlimes(1)}
                      disabled={(state.tickets ?? 0) < SLIME_COST_TICKETS}
                      className="ui-afford-disabled group flex min-h-14 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border-2 border-orange-500 bg-gradient-to-br from-amber-400 to-orange-500 px-2 py-2.5 font-black text-white shadow-md transition-all hover:brightness-105 disabled:border-zinc-300 disabled:from-zinc-200 disabled:via-zinc-200 disabled:to-zinc-300 disabled:text-zinc-900 disabled:shadow-none"
                    >
                      <span className="inline-flex items-baseline justify-center gap-4 whitespace-nowrap text-sm font-black leading-tight tracking-wide text-white/95 group-disabled:text-zinc-700">
                        <span>Buy x1</span>
                        <span className="text-base tabular-nums text-white/95 group-disabled:text-red-600">{SLIME_COST_TICKETS} 🎟️</span>
                      </span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => buySlimes(10)}
                      disabled={(state.tickets ?? 0) < SLIME_BULK_10_COST_TICKETS}
                      className="ui-afford-disabled group flex min-h-14 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border-2 border-orange-500 bg-gradient-to-br from-amber-400 to-orange-500 px-2 py-2.5 font-black text-white shadow-md transition-all hover:brightness-105 disabled:border-zinc-300 disabled:from-zinc-200 disabled:via-zinc-200 disabled:to-zinc-300 disabled:text-zinc-900 disabled:shadow-none"
                    >
                      <span className="inline-flex items-baseline justify-center gap-4 whitespace-nowrap text-sm font-black leading-tight tracking-wide text-white/95 group-disabled:text-zinc-700">
                        <span>Buy x10</span>
                        <span className="text-base tabular-nums text-white/95 group-disabled:text-red-600">
                          {SLIME_BULK_10_COST_TICKETS} 🎟️
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Lower Half: Collection Overview */}
              <div className="relative min-h-0 flex-1">
              <div ref={collectionScrollRef} className="h-full overflow-y-auto p-4 space-y-4 no-scrollbar">
                <div className="flex justify-between items-center px-1">
                  <h3 className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-gray-800">
                    <Ghost className="h-4 w-4 text-emerald-600" /> My collection ({state.slimes.length})
                  </h3>
                  <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-100 to-orange-100 px-2 py-0.5 ring-1 ring-orange-200/60">
                    <span className="text-[8px] font-black text-emerald-800">Equipped</span>
                    <p className="text-[9px] font-black text-orange-800">
                      {currentEquippedIds.length}/{equippedSlimeCapAtLevel(state.upgrades.slimeCap)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pb-8">
                  {state.slimes.map((slime: Slime) => (
                    <SlimeCard 
                      key={slime.id} 
                      slime={slime} 
                      coins={state.coins}
                      isEquipped={currentEquippedIds.includes(slime.id)}
                      onEquip={toggleEquipSlime}
                      onClick={openSlimeDetail}
                      detailSeen={state.slimeDetailSeenIds.includes(slime.id)}
                    />
                  ))}
                  {state.slimes.length === 0 && (
                    <div className="col-span-3 flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-emerald-200/80 bg-gradient-to-b from-emerald-50/50 to-orange-50/30 py-16 text-center">
                      <Ghost className="h-12 w-12 text-emerald-200" />
                      <div>
                        <p className="text-gray-400 font-medium">No slimes yet.</p>
                        <p className="text-[10px] text-gray-400 mt-1 font-black">Buy your first slime!</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div
                className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-14 bg-gradient-to-t from-white/80 via-white/40 to-transparent transition-opacity duration-300 ease-out ${
                  collectionScrollFadeBottom ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden
              />
              </div>
            </motion.div>
          )}

          {state.activeTab === 'market' && (
            <motion.div 
              key="market"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              className="flex h-full min-h-0 w-full flex-col overflow-hidden"
            >
                  {/* Header with Parent Slots */}
                  <div className="space-y-4 border-b border-emerald-100/80 bg-gradient-to-b from-white via-emerald-50/40 to-orange-50/30 p-4 pt-5 text-center">
                    <div className="flex flex-col items-center">
                      <Dna className="mb-1 h-10 w-10 text-orange-500 drop-shadow-sm" />
                      <h3 className="text-lg font-black tracking-widest text-emerald-900 uppercase">Breeding</h3>
                    </div>

                    <div className="flex items-center justify-center gap-4 py-2">
                      {([0, 1] as const).map((index) => {
                        const selectedId = breedingSelection[index];
                        const slime = state.slimes.find((s) => s.id === selectedId);
                        const isActive = activeBreedingSlot === index;

                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleBreedingSlotClick(index)}
                            className="flex flex-col items-center gap-2"
                          >
                            <div
                              className={`relative flex h-16 w-16 items-center justify-center rounded-3xl border-2 transition-all ${
                                isActive
                                  ? 'border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 shadow-lg shadow-orange-200/60 ring-2 ring-orange-300/60'
                                  : slime
                                  ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-lime-50 shadow-md shadow-emerald-900/5'
                                  : 'border-emerald-200 bg-white/80 shadow-sm'
                              }`}
                            >
                              {slime ? (
                                <SlimeStackSprite slime={slime} size="lg" className="shadow-inner" />
                              ) : (
                                <Plus className={`h-6 w-6 ${isActive ? 'text-orange-400' : 'text-gray-300'}`} />
                              )}
                              {/* Slot number badge */}
                              <div className={`absolute -top-1.5 -left-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-white text-[8px] font-black shadow ${isActive ? 'bg-orange-500 text-white' : 'bg-gray-300 text-white'}`}>
                                {index + 1}
                              </div>
                            </div>
                            <div className={`text-[9px] font-black uppercase tracking-tight transition-colors ${isActive ? 'text-orange-500' : 'text-gray-400'}`}>
                              {slime ? slime.name : `Parent ${index + 1}`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <motion.p
                      key={activeBreedingSlot}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                      className="text-[10px] font-bold uppercase tracking-wider text-orange-500/90"
                    >
                      selecting parent {activeBreedingSlot + 1}
                    </motion.p>
                  </div>

                  {/* Scrollable Selection List */}
                  <div className="min-h-0 flex-1 overflow-y-auto p-3 no-scrollbar">
                    <div className="grid grid-cols-3 gap-2">
                      {state.slimes.map((slime) => {
                        const slotIndex = breedingSelection[0] === slime.id ? 0 : breedingSelection[1] === slime.id ? 1 : -1;
                        const isSelected = slotIndex !== -1;
                        return (
                          <button
                            key={slime.id}
                            type="button"
                            onClick={() => selectBreedingParent(slime.id)}
                            className={`relative flex flex-col items-center gap-1.5 overflow-hidden rounded-2xl border-2 p-2 py-3 transition-all active:scale-95 ${
                              isSelected
                                ? 'border-orange-400 bg-gradient-to-b from-orange-100 to-amber-50 shadow-md ring-2 ring-orange-300/50'
                                : 'border-emerald-50 bg-white shadow-sm hover:border-orange-200 hover:shadow-md'
                            }`}
                          >
                            <SlimeStackSprite slime={slime} size="md" className="shadow-inner" />

                            <div className="w-full text-center">
                              <div className="mb-1 truncate text-[9px] font-black leading-none text-gray-800">
                                {slime.name}
                              </div>

                              <div className="mt-0.5 flex w-full items-center justify-center gap-1.5 px-0.5">
                                <div className="inline-flex items-center gap-0.5">
                                  <Heart className="h-2.5 w-2.5 shrink-0 text-red-500" />
                                  <span className="text-[8px] font-black tabular-nums leading-none text-gray-600">
                                    {slime.stats.health}
                                  </span>
                                </div>
                                <div className="inline-flex items-center gap-0.5">
                                  <Sword className="h-2.5 w-2.5 shrink-0 text-orange-500" />
                                  <span className="text-[8px] font-black tabular-nums leading-none text-gray-600">
                                    {slime.stats.strength}
                                  </span>
                                </div>
                                <div className="inline-flex items-center gap-0.5">
                                  <Wind className="h-2.5 w-2.5 shrink-0 text-blue-500" />
                                  <span className="text-[8px] font-black tabular-nums leading-none text-gray-600">
                                    {slime.stats.agility}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Parent number badge — 1 or 2 in the top-right corner */}
                            {isSelected && (
                              <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-orange-500 text-[8px] font-black text-white shadow-md">
                                {slotIndex + 1}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {state.slimes.length < 2 && (
                      <div className="flex flex-col items-center gap-3 rounded-[1.5rem] border-2 border-dashed border-orange-200/80 bg-gradient-to-b from-emerald-50/40 to-orange-50/40 px-4 py-12">
                        <Ghost className="h-8 w-8 text-emerald-300" />
                        <p className="text-center text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                          Need more slimes!
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 border-t border-emerald-100/80 bg-gradient-to-r from-white via-emerald-50/30 to-orange-50/40 px-4 py-3 backdrop-blur-md">
                    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={breedSlimes}
                        disabled={!breedingSelection[0] || !breedingSelection[1] || (state.tickets ?? 0) < BREEDING_COST_TICKETS}
                        className="ui-afford-disabled group flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-purple-500 bg-gradient-to-br from-violet-500 to-purple-600 py-2.5 font-black text-white shadow-md transition-all hover:brightness-105 disabled:border-zinc-300 disabled:from-zinc-200 disabled:via-zinc-200 disabled:to-zinc-300 disabled:text-zinc-900 disabled:shadow-none"
                      >
                        <span className="text-sm uppercase leading-tight text-white/95 group-disabled:text-zinc-700">
                          Breed Slimes
                        </span>
                        <span
                          className={`flex items-center gap-1 text-base font-black tabular-nums leading-tight ${
                            breedingSelection[0] && breedingSelection[1] && (state.tickets ?? 0) < BREEDING_COST_TICKETS
                              ? 'text-red-300'
                              : 'text-white/95 group-disabled:text-zinc-800'
                          }`}
                        >
                          <Ticket className="h-4 w-4" aria-hidden />
                          {BREEDING_COST_TICKETS} ticket
                        </span>
                      </button>
                    </div>
                  </div>
            </motion.div>
          )}

          {state.activeTab === 'arena' && (
            <motion.div
              key="arena"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              className="flex h-full min-h-0 w-full flex-col overflow-hidden"
            >
              <SlimeArenaPanel
                slimes={state.slimes}
                arenaWins={state.arenaWins}
                slimeArenaAbilityCooldownUntil={state.slimeArenaAbilityCooldownUntil}
                now={nowMs}
                optionsMenuOpen={isOptionsOpen}
                onBattleActiveChange={setArenaBattleActive}
                onReturnToArenaTab={() => setState((s) => ({ ...s, activeTab: 'arena' }))}
                onBattleEnd={handleArenaBattleEnd}
                sfxEnabled={state.settings.sfxEnabled}
                canPlaySfx={hasStarted && appForeground}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation — floats over game; in-flow on Slimes / Market / Arena; hidden during arena battle */}
      <div
        className={
          arenaBattleActive
            ? 'hidden'
            : isGameTab
              ? 'glass-nav-game pointer-events-none absolute right-0 bottom-0 left-0 z-40 flex items-center justify-evenly p-1.5 pb-nav-safe'
              : 'glass-nav-page relative z-50 flex items-center justify-evenly p-1.5 pb-nav-safe'
        }
      >
        <NavButton 
          active={state.activeTab === 'slimes'} 
          onClick={() => setState(s => ({ ...s, activeTab: 'slimes' }))}
          icon={<Ghost />}
          hasNotification={hasSlimesNotification}
        />
        <NavButton 
          active={state.activeTab === 'market'} 
          onClick={() => setState(s => ({ ...s, activeTab: 'market', activeSubTab: 'market' }))}
          icon={<Dna />}
        />
        <NavButton 
          active={state.activeTab === 'game'} 
          onClick={() => setState(s => ({ ...s, activeTab: 'game' }))}
          icon={<CircleDollarSign />}
        />
        <NavButton 
          active={state.activeTab === 'arena'} 
          onClick={() => setState(s => ({ ...s, activeTab: 'arena' }))}
          icon={<Swords />}
        />
      </div>

      {/* Game tab: upgrades HUD above bottom nav — z-50 so it paints over glass-nav (z-40) */}
      {state.activeTab === 'game' && (
        <>
          {!isUpgradesOpen && (
            <button
              type="button"
              onClick={() => setIsUpgradesOpen(true)}
              className="game-hud-upgrade ui-emerald-outline pointer-events-auto absolute right-3.5 z-50 rounded-2xl bg-gradient-to-br from-white/95 to-emerald-50/90 p-3 text-emerald-700 shadow-lg shadow-emerald-900/10 backdrop-blur-md transition-transform hover:scale-110"
            >
              <TrendingUp className="h-6 w-6" />
              {canAffordAnyGameUpgrade && !isCompletedLevel && (
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
              )}
            </button>
          )}
          <AnimatePresence>
            {isUpgradesOpen && (
              <>
                <motion.div
                  key="upgrades-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[45] bg-black/40 backdrop-blur-sm"
                  onClick={() => setIsUpgradesOpen(false)}
                  aria-hidden
                />
                <motion.div
                  key="upgrades-sheet"
                  initial={{ y: 300, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 300, opacity: 0 }}
                  className="game-upgrades-sheet ui-emerald-outline pointer-events-auto absolute right-6 left-6 z-50 flex min-h-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-white/97 via-emerald-50/50 to-orange-50/60 p-3 shadow-xl shadow-emerald-900/10 backdrop-blur-md"
                >
                <div className="mb-2 flex shrink-0 items-center justify-between">
                  <h3 className="flex items-center gap-2 text-base font-black tracking-tight text-emerald-900">
                    <TrendingUp className="h-4 w-4 shrink-0 text-orange-500" /> Upgrades
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsUpgradesOpen(false)}
                    className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-1 text-emerald-400 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="relative min-h-0 flex-1">
                  <div
                    ref={upgradesScrollRef}
                    className="flex max-h-full min-h-0 flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1.5 pb-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-emerald-100/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-400 [&::-webkit-scrollbar-thumb:hover]:bg-emerald-500"
                  >
                  {(() => {
                    const worldCaps = getMaxGameUpgradeLevelForWorld(state.gameWorldIndex);
                    // On completed levels show all upgrades at their max values for that world
                    const dispLevel = <K extends keyof typeof worldCaps>(key: K) =>
                      isCompletedLevel ? worldCaps[key] : (state.upgrades[key as keyof typeof state.upgrades] as number);
                    const isMaxed = (key: keyof typeof state.upgrades) =>
                      isCompletedLevel || isGameUpgradeMaxed(state.upgrades, key, state.gameWorldIndex);
                    return (
                      <>
                  <GameUpgradeRow
                    title="Character speed"
                    description="Run faster and reach coins sooner."
                    level={dispLevel('movementSpeed')}
                    maxLevel={worldCaps.movementSpeed}
                    currentStat={`${Math.round((gamePlayerBaseSpeedAtLevel(dispLevel('movementSpeed')) / BASE_MOVEMENT_SPEED) * 100)}% speed`}
                    nextStat={
                      isMaxed('movementSpeed')
                        ? 'MAX'
                        : `${Math.round((gamePlayerBaseSpeedAtLevel(state.upgrades.movementSpeed + 1) / BASE_MOVEMENT_SPEED) * 100)}% speed`
                    }
                    cost={scaleUpgradeCostForWorld(UPGRADE_COSTS.movementSpeed(state.upgrades.movementSpeed), state.gameWorldIndex)}
                    canAfford={!isCompletedLevel && state.coins >= scaleUpgradeCostForWorld(UPGRADE_COSTS.movementSpeed(state.upgrades.movementSpeed), state.gameWorldIndex)}
                    onPurchase={() => buyUpgrade('movementSpeed')}
                    onPurchaseMax={() => buyUpgradeMax('movementSpeed')}
                    maxed={isMaxed('movementSpeed')}
                  />
                  {state.slimes.length > 0 && (
                  <GameUpgradeRow
                    title="Slime speed"
                    description="Slimes move faster and collect coins sooner."
                    level={dispLevel('slimeMovementSpeed')}
                    maxLevel={worldCaps.slimeMovementSpeed}
                    currentStat={`${Math.round((gameSlimeBaseSpeedAtLevel(dispLevel('slimeMovementSpeed')) / BASE_SLIME_SPEED) * 100)}% speed`}
                    nextStat={
                      isMaxed('slimeMovementSpeed')
                        ? 'MAX'
                        : `${Math.round((gameSlimeBaseSpeedAtLevel(state.upgrades.slimeMovementSpeed + 1) / BASE_SLIME_SPEED) * 100)}% speed`
                    }
                    cost={scaleUpgradeCostForWorld(UPGRADE_COSTS.slimeMovementSpeed(state.upgrades.slimeMovementSpeed), state.gameWorldIndex)}
                    canAfford={!isCompletedLevel && state.coins >= scaleUpgradeCostForWorld(UPGRADE_COSTS.slimeMovementSpeed(state.upgrades.slimeMovementSpeed), state.gameWorldIndex)}
                    onPurchase={() => buyUpgrade('slimeMovementSpeed')}
                    onPurchaseMax={() => buyUpgradeMax('slimeMovementSpeed')}
                    maxed={isMaxed('slimeMovementSpeed')}
                  />
                  )}
                  <GameUpgradeRow
                    title="Coin respawn"
                    description="Shorten time between coin spawns."
                    level={dispLevel('respawnTime')}
                    maxLevel={worldCaps.respawnTime}
                    currentStat={`${(gameRespawnIntervalMs(dispLevel('respawnTime')) / 1000).toFixed(1)}s`}
                    nextStat={
                      isMaxed('respawnTime')
                        ? 'MAX'
                        : `${(gameRespawnIntervalMs(state.upgrades.respawnTime + 1) / 1000).toFixed(1)}s`
                    }
                    cost={scaleUpgradeCostForWorld(UPGRADE_COSTS.respawnTime(state.upgrades.respawnTime), state.gameWorldIndex)}
                    canAfford={!isCompletedLevel && state.coins >= scaleUpgradeCostForWorld(UPGRADE_COSTS.respawnTime(state.upgrades.respawnTime), state.gameWorldIndex)}
                    onPurchase={() => buyUpgrade('respawnTime')}
                    onPurchaseMax={() => buyUpgradeMax('respawnTime')}
                    maxed={isMaxed('respawnTime')}
                  />
                  <GameUpgradeRow
                    title="Coin cap"
                    description="Increase the number of coins that can be on screen."
                    level={dispLevel('coinCap')}
                    maxLevel={worldCaps.coinCap}
                    currentStat={`${onScreenCoinCap(dispLevel('coinCap'))} coins`}
                    nextStat={
                      isMaxed('coinCap')
                        ? 'MAX'
                        : `${onScreenCoinCap(state.upgrades.coinCap + 1)} coins`
                    }
                    cost={scaleUpgradeCostForWorld(UPGRADE_COSTS.coinCap(state.upgrades.coinCap), state.gameWorldIndex)}
                    canAfford={!isCompletedLevel && state.coins >= scaleUpgradeCostForWorld(UPGRADE_COSTS.coinCap(state.upgrades.coinCap), state.gameWorldIndex)}
                    onPurchase={() => buyUpgrade('coinCap')}
                    onPurchaseMax={() => buyUpgradeMax('coinCap')}
                    maxed={isMaxed('coinCap')}
                  />
                  <GameUpgradeRow
                    title="Coin value"
                    description="More coins each time you collect."
                    level={dispLevel('coinValue')}
                    maxLevel={worldCaps.coinValue}
                    currentStat={`${gameCoinValuePerCollect(dispLevel('coinValue'))} base 💰`}
                    nextStat={
                      isMaxed('coinValue')
                        ? 'MAX'
                        : `${gameCoinValuePerCollect(state.upgrades.coinValue + 1)} base 💰`
                    }
                    cost={scaleUpgradeCostForWorld(UPGRADE_COSTS.coinValue(state.upgrades.coinValue), state.gameWorldIndex)}
                    canAfford={!isCompletedLevel && state.coins >= scaleUpgradeCostForWorld(UPGRADE_COSTS.coinValue(state.upgrades.coinValue), state.gameWorldIndex)}
                    onPurchase={() => buyUpgrade('coinValue')}
                    onPurchaseMax={() => buyUpgradeMax('coinValue')}
                    maxed={isMaxed('coinValue')}
                  />
                  {state.slimes.length > 0 && (
                  <div ref={slimeCapUpgradeRef}>
                  <GameUpgradeRow
                    title="Slime cap"
                    description="Equip more slimes to collect coins at once."
                    level={dispLevel('slimeCap')}
                    maxLevel={worldCaps.slimeCap}
                    currentStat={`${equippedSlimeCapAtLevel(dispLevel('slimeCap'))} slimes`}
                    nextStat={
                      isMaxed('slimeCap')
                        ? 'MAX'
                        : `${equippedSlimeCapAtLevel(state.upgrades.slimeCap + 1)} slimes`
                    }
                    cost={scaleUpgradeCostForWorld(UPGRADE_COSTS.slimeCap(state.upgrades.slimeCap), state.gameWorldIndex)}
                    canAfford={!isCompletedLevel && state.coins >= scaleUpgradeCostForWorld(UPGRADE_COSTS.slimeCap(state.upgrades.slimeCap), state.gameWorldIndex)}
                    onPurchase={() => buyUpgrade('slimeCap')}
                    onPurchaseMax={() => buyUpgradeMax('slimeCap')}
                    maxed={isMaxed('slimeCap')}
                  />
                  </div>
                  )}
                      {!isCompletedLevel && state.maxUnlockedGameWorld < GAME_WORLDS.length - 1 && (
                        <div className="mt-0.5 rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-orange-50/80 px-3 py-2.5">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
                            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={2.5} />
                            Max all upgrades to unlock the next area
                          </p>
                          <p className="mt-0.5 text-[10px] leading-snug text-amber-600/80">
                            Once every upgrade reaches its cap for this world, you'll be able to move on.
                          </p>
                        </div>
                      )}
                      </>
                    );
                  })()}
                  </div>
                  <div
                    className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-orange-50 via-orange-50/75 to-transparent transition-opacity duration-300 ease-out ${
                      upgradesScrollFadeBottom ? 'opacity-100' : 'opacity-0'
                    }`}
                    aria-hidden
                  />
                </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
  </>
  );
}

function NavButton({ active, onClick, icon, hasNotification }: { active: boolean, onClick: () => void, icon: React.ReactNode, hasNotification?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto relative flex flex-1 flex-col items-center gap-1 rounded-2xl p-2 transition-all active:scale-[0.97]"
    >
      <div
        className={
          active
            ? 'relative rounded-xl p-2.5 transition-all border-2 border-emerald-400/90 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-700/25 ring-2 ring-emerald-500/45'
            : 'relative ui-emerald-outline rounded-xl p-2.5 transition-all bg-gradient-to-br from-emerald-100 to-orange-100 text-emerald-800/90 shadow-sm hover:from-emerald-50 hover:to-amber-50/90'
        }
      >
        {React.cloneElement(icon as React.ReactElement, { className: 'w-8 h-8' })}
        {hasNotification && (
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm" />
        )}
      </div>
    </button>
  );
}

interface GameUpgradeRowProps {
  title: string;
  description: string;
  level: number;
  maxLevel: number;
  currentStat: string;
  nextStat: string;
  cost: number;
  canAfford: boolean;
  onPurchase: () => void;
  onPurchaseMax: () => void;
  maxed?: boolean;
  /** Extra line (e.g. on-field cap) shown under the description */
  statSubtitle?: string;
}

function GameUpgradeRow({
  title,
  description,
  level,
  maxLevel,
  currentStat,
  nextStat,
  cost,
  canAfford,
  onPurchase,
  onPurchaseMax,
  maxed,
  statSubtitle,
}: GameUpgradeRowProps) {
  const lockedOut = !canAfford || maxed;
  const showRedCost = !maxed && !canAfford;
  return (
    <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/60 p-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-black uppercase leading-tight tracking-wide text-emerald-900">{title}</h4>
        <div className="shrink-0 rounded-md border border-orange-200/70 bg-orange-50/90 px-2 py-0.5 text-[10px] font-black tabular-nums leading-none text-orange-700 shadow-sm">
          {level} / {maxLevel}
        </div>
      </div>
      <p className="mt-0.5 text-[10px] font-medium leading-snug text-zinc-500">{description}</p>
      {statSubtitle != null && statSubtitle !== '' && (
        <p className="mt-0.5 text-[9px] font-semibold leading-tight text-zinc-400">{statSubtitle}</p>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-emerald-100/90 bg-white/80 px-2 py-1 text-xs font-bold tabular-nums leading-tight">
        <span className="min-w-0 truncate text-zinc-700">{currentStat}</span>
        <span className="shrink-0 text-base font-black text-emerald-500" aria-hidden>→</span>
        <span className="min-w-0 truncate text-right font-black text-orange-600">{nextStat}</span>
      </div>
      <div className="mt-1.5 flex gap-2">
        <button
          type="button"
          onClick={onPurchase}
          disabled={lockedOut}
          className={`min-w-0 flex-1 rounded-lg py-1.5 text-center text-xs font-black leading-tight tracking-wide transition-all active:scale-[0.98] ${
            maxed
              ? 'cursor-default border border-zinc-200 bg-zinc-100 text-zinc-400'
              : lockedOut
                ? 'ui-afford-disabled cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-400'
                : 'btn-primary-glow'
          }`}
        >
          {maxed ? (
            'Owned'
          ) : showRedCost ? (
            <span>
              <span className="text-red-400 tabular-nums">{cost.toLocaleString()}</span>
              <span className="text-zinc-400"> 💰</span>
            </span>
          ) : (
            `${cost.toLocaleString()} 💰`
          )}
        </button>
        <button
          type="button"
          onClick={onPurchaseMax}
          disabled={maxed || !canAfford}
          className={`flex flex-1 flex-col items-center justify-center rounded-lg border py-1.5 text-[9px] font-black uppercase leading-none shadow-sm transition-all active:scale-[0.98] ${
            maxed
              ? 'cursor-default border-zinc-200 bg-zinc-100 text-zinc-400'
              : canAfford
                ? 'border-orange-400/60 bg-gradient-to-r from-orange-500 to-amber-500 text-white ring-1 ring-orange-300/50 hover:brightness-105'
                : 'cursor-default border-zinc-200 bg-zinc-100/90 text-zinc-400'
          }`}
          title={maxed ? 'At maximum level' : canAfford ? 'Buy as many levels as you can afford' : `Max level: ${maxLevel}`}
        >
          MAX
        </button>
      </div>
    </div>
  );
}

function formatSlimeCooldownShort(ms: number): string {
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SlimeCard: React.FC<{ 
  slime: Slime; 
  coins: number;
  isEquipped: boolean; 
  onEquip: (id: string) => void;
  onClick: (slime: Slime) => void;
  detailSeen: boolean;
}> = ({ slime, coins, isEquipped, onEquip, onClick, detailSeen }) => {
  const hasAffordableStatUpgrade = (['health', 'strength', 'agility'] as const).some(
    (stat) => slime.statLevels[stat] < MAX_SLIME_STAT_LEVEL && coins >= SLIME_UPGRADE_COST(slime.statLevels[stat])
  );
  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      onClick={() => onClick(slime)}
      className={`relative flex cursor-pointer flex-col items-center rounded-2xl border p-2 shadow-sm transition-all active:scale-95 ${
        isEquipped ? 'border-orange-200 bg-gradient-to-b from-amber-50 to-orange-50 ring-1 ring-orange-200/60' : 'border-emerald-100/80 bg-white hover:border-orange-200/60'
      }`}
    >
      {detailSeen && hasAffordableStatUpgrade && (
        <div
          className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md ring-2 ring-white"
          aria-hidden
        >
          <ArrowUp className="h-3 w-3" strokeWidth={2.75} />
        </div>
      )}
      {!detailSeen && (
        <span
          className="pointer-events-none absolute -right-0.5 -top-0.5 z-20 h-2.5 w-2.5 rounded-full bg-red-500 shadow-md ring-2 ring-white"
          aria-hidden
        />
      )}
      <div className="relative mb-1">
        <SlimeStackSprite slime={slime} size="lg" className="shadow-inner" />
      </div>
      <h4 className="font-bold text-gray-800 text-[10px] mb-0.5 text-center truncate w-full px-1">
        {slime.name}
      </h4>
      <div className="mb-1.5 mt-0.5 flex w-full items-center justify-center gap-1.5 px-0.5">
        <div className="inline-flex items-center gap-0.5">
          <Heart className="h-2.5 w-2.5 shrink-0 text-red-500" />
          <span className="text-[8px] font-black tabular-nums leading-none">{slime.stats.health}</span>
        </div>
        <div className="inline-flex items-center gap-0.5">
          <Sword className="h-2.5 w-2.5 shrink-0 text-orange-500" />
          <span className="text-[8px] font-black tabular-nums leading-none">{slime.stats.strength}</span>
        </div>
        <div className="inline-flex items-center gap-0.5">
          <Wind className="h-2.5 w-2.5 shrink-0 text-blue-500" />
          <span className="text-[8px] font-black tabular-nums leading-none">{slime.stats.agility}</span>
        </div>
      </div>
      <button 
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEquip(slime.id);
        }}
        className={`w-full min-h-7 rounded-lg py-1 text-[10px] font-black tracking-wide transition-all ${
          isEquipped 
          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm ring-1 ring-orange-300/50 hover:brightness-105' 
          : 'btn-primary-glow shadow-sm ring-1 ring-emerald-400/30'
        }`}
      >
        {isEquipped ? 'Equipped' : 'Equip'}
      </button>
    </motion.div>
  );
}

interface StatBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

function StatBar({ label, value, max, color }: StatBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] font-black text-gray-400 w-6">{label}</span>
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

interface StatBadgeProps {
  icon: React.ReactNode;
  value: number;
  label: string;
}

function StatBadge({ icon, value, label }: StatBadgeProps) {
  return (
    <div className="bg-gray-50 p-2 rounded-xl flex flex-col items-center">
      <div className="text-gray-400 mb-1">{icon}</div>
      <div className="text-xs font-bold text-gray-800">{value}</div>
      <div className="text-[8px] font-black text-gray-400">{label}</div>
    </div>
  );
}
