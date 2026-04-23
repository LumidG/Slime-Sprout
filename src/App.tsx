import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Ghost,
  Gavel,
  TrendingUp, 
  Package, 
  ChevronRight,
  ChevronLeft,
  Zap,
  Timer,
  Coins,
  Egg,
  Heart,
  Sword,
  Wind,
  Bug,
  Trash2,
  Sparkles,
  Trophy,
  PartyPopper,
  Plus,
  CircleDollarSign,
  MessageCircle,
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
} from 'lucide-react';
import { GameState, INITIAL_STATE, Slime, SlimeMarketAuction, SlimeTrait, SlimeStats } from './types';
import { GameWorld } from './components/GameWorld';
import { SlimeMarketPanel } from './components/SlimeMarketPanel';
import { SlimeArenaPanel } from './components/SlimeArenaPanel';
import { 
  COLORS, 
  TRAITS, 
  UPGRADE_COSTS, 
  EGG_COST,
  EGG_BULK_10_COST,
  eggPurchaseCost,
  SLIME_UPGRADE_COST,
  SLIME_STAT_UPGRADE_DELTA,
  computeOfflineIdleGain,
  OFFLINE_IDLE_CAP_MS,
  SLIME_NAMES,
  TRAIT_EFFECTS,
  MAX_EQUIPPED_SLIMES,
  PLAY_STORE_LISTING_URL,
  SUPPORT_MAILTO,
  GAME_WORLDS,
  GAME_WORLD_INDEX_MIGRATE_SAND_THIRD,
  migrateMaxUnlockedToSandThirdOrder,
  GAME_WORLD_INDEX_MIGRATE_SAND_FLOWER_SWAP,
  migrateMaxUnlockedToSandFlowerOrder,
  MAX_GAME_UPGRADE_LEVEL,
  areAllGameUpgradesMaxed,
  isGameUpgradeMaxed,
  onScreenCoinCap,
  BASE_MOVEMENT_SPEED,
  gamePlayerBaseSpeedAtLevel,
  gameRespawnIntervalMs,
  gameCoinValuePerCollect,
  processSlimeMarketTick,
  getPlayerSellNowPrice,
  getPlayerAuctionOpeningMinBid,
  getNextMarketBid,
  getInstantNpcBuyPrice,
  SLIME_MARKET_MIN_BID_STEP,
  SLIME_MARKET_AUCTION_MS,
  ARENA_ABILITY_META,
  isArenaAbilityOnCooldown,
  rollRandomArenaAbility,
  type ArenaEncounter,
} from './constants';
import { SlimeStackSprite } from './components/SlimeStackSprite';
import { rollNewSlimeVisuals, withSlimeVisualDefaults } from './slimeSprites';
import { Capacitor } from '@capacitor/core';
import { SystemUi } from './systemUi';
import { useAppForeground } from './hooks/useAppForeground';
import { useBlossomMusic, BLOSSOM_MUSIC_URL, BOSS_BATTLE_MUSIC_URL } from './hooks/useBlossomMusic';
import { useCoinCollectSfx } from './hooks/useCoinCollectSfx';
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
  const upgradesScrollRef = useRef<HTMLDivElement>(null);
  const [upgradesScrollFadeBottom, setUpgradesScrollFadeBottom] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [selectedSlimeDetail, setSelectedSlimeDetail] = useState<Slime | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  /** Short GPU translate when changing world; avoids remounting GameWorld (was causing heavy lag). */
  const [worldNavShiftPx, setWorldNavShiftPx] = useState(0);
  const [worldNavTransition, setWorldNavTransition] = useState(true);
  /** True while an arena fight is running (team picked battle, canvas phase). Drives boss battle music. */
  const [arenaBattleActive, setArenaBattleActive] = useState(false);
  const gameUpgradeMaxedUnlockRef = useRef(false);
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

  /** Re-render once per second so arena/collection cooldown timers stay accurate. */
  const [, setCooldownClock] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setCooldownClock((c) => c + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const nowMs = Date.now();

  const appForeground = useAppForeground();

  const onboardingMessages = [
    "Welcome! Collect golden coins to buy eggs and hatch cute slimes.",
    "Upgrade your slimes and build a strong team for the arena!",
    "Let's start collecting. Have fun!"
  ];

  const musicTrackUrl =
    state.activeTab === 'arena' && arenaBattleActive ? BOSS_BATTLE_MUSIC_URL : BLOSSOM_MUSIC_URL;
  useBlossomMusic(hasStarted, state.settings.musicEnabled && appForeground, 1, musicTrackUrl);

  useEffect(() => {
    if (state.activeTab !== 'arena') setArenaBattleActive(false);
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

  const completeOnboarding = () => {
    setState(prev => ({ ...prev, hasCompletedOnboarding: true }));
  };

  const nextOnboarding = () => {
    if (onboardingStep < onboardingMessages.length - 1) {
      setOnboardingStep(prev => prev + 1);
    } else {
      completeOnboarding();
    }
  };

  // Notification Logic
  const canAffordAnyGameUpgrade =
    (!isGameUpgradeMaxed(state.upgrades, 'automation') &&
      state.upgrades.automation === 0 &&
      state.coins >= UPGRADE_COSTS.automation) ||
    (!isGameUpgradeMaxed(state.upgrades, 'movementSpeed') &&
      state.coins >= UPGRADE_COSTS.movementSpeed(state.upgrades.movementSpeed)) ||
    (!isGameUpgradeMaxed(state.upgrades, 'respawnTime') &&
      state.coins >= UPGRADE_COSTS.respawnTime(state.upgrades.respawnTime)) ||
    (!isGameUpgradeMaxed(state.upgrades, 'coinValue') &&
      state.coins >= UPGRADE_COSTS.coinValue(state.upgrades.coinValue));
  
  const now = Date.now();
  const hasSlimeMarketTabNotification = state.slimeMarketAuctions.some((a) => {
    if (a.endsAt <= now) return false;
    if (a.seller === 'npc' && a.highBidder === 'player') return true;
    if (a.seller === 'player' && a.highBidder === 'npc' && a.currentBid > 0) return true;
    return false;
  });
  const hasSlimesNotification = state.eggs > 0 || state.hatchingEgg?.progress === 100; // Not strictly purchase, but important action

  const isGameTab = state.activeTab === 'game';
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
        parsed.upgrades.automation = parsed.upgrades.automation > 0 ? 1 : 0;
        parsed.upgrades.movementSpeed = Math.min(
          MAX_GAME_UPGRADE_LEVEL.movementSpeed,
          Math.max(1, Math.floor(Number(parsed.upgrades.movementSpeed)) || 1)
        );
        parsed.upgrades.respawnTime = Math.min(
          MAX_GAME_UPGRADE_LEVEL.respawnTime,
          Math.max(1, Math.floor(Number(parsed.upgrades.respawnTime)) || 1)
        );
        parsed.upgrades.coinValue = Math.min(
          MAX_GAME_UPGRADE_LEVEL.coinValue,
          Math.max(1, Math.floor(Number(parsed.upgrades.coinValue)) || 1)
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

      if (!Array.isArray(parsed.slimeMarketAuctions)) {
        parsed.slimeMarketAuctions = [];
      }
      const validTabs = new Set(['game', 'slimes', 'slimeMarket', 'arena']);
      if (!validTabs.has(parsed.activeTab)) {
        parsed.activeTab = 'game';
      }
      delete parsed.slimeCooldownUntil;
      if (!parsed.slimeArenaAbilityCooldownUntil || typeof parsed.slimeArenaAbilityCooldownUntil !== 'object') {
        parsed.slimeArenaAbilityCooldownUntil = {};
      }
      if (typeof parsed.arenaWins !== 'number' || !Number.isFinite(parsed.arenaWins) || parsed.arenaWins < 0) {
        parsed.arenaWins = 0;
      } else {
        parsed.arenaWins = Math.floor(parsed.arenaWins);
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

      setOfflineWelcome({
        currencyEarned: idleGain.currencyEarned,
        awayMs: diff,
        idleCoins: idleGain.idleCoins,
      });
      setState((s) => ({
        ...s,
        coins: s.coins + idleGain.currencyEarned,
        totalCoinsCollected: s.totalCoinsCollected + idleGain.idleCoins,
        lastSavedTime: now,
      }));
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [hasStarted, isLoading]);

  // Maxing all game-tab upgrades unlocks the next world (and resets upgrades for the next tier).
  useEffect(() => {
    if (isLoading) return;
    if (!areAllGameUpgradesMaxed(state.upgrades)) {
      gameUpgradeMaxedUnlockRef.current = false;
      return;
    }
    if (state.maxUnlockedGameWorld >= 5) return;
    if (gameUpgradeMaxedUnlockRef.current) return;
    gameUpgradeMaxedUnlockRef.current = true;

    const nextWorldIndex = state.maxUnlockedGameWorld + 1;
    setWorldUnlockCelebration({
      worldIndex: nextWorldIndex,
      worldName: GAME_WORLDS[nextWorldIndex].name,
    });

    setState((prev) => {
      if (!areAllGameUpgradesMaxed(prev.upgrades)) return prev;
      if (prev.maxUnlockedGameWorld >= 5) return prev;
      return {
        ...prev,
        maxUnlockedGameWorld: prev.maxUnlockedGameWorld + 1,
        gameWorldIndex: prev.maxUnlockedGameWorld + 1,
        upgrades: { ...INITIAL_STATE.upgrades },
      };
    });
  }, [
    isLoading,
    state.upgrades.automation,
    state.upgrades.movementSpeed,
    state.upgrades.respawnTime,
    state.upgrades.coinValue,
    state.maxUnlockedGameWorld,
  ]);

  // Save state
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('slime_sprout_state', JSON.stringify({
        ...state,
        lastSavedTime: Date.now()
      }));
    }
  }, [state, isLoading]);

  // Slime market: resolve auctions, NPC bids on your listings, refill NPC listings.
  useEffect(() => {
    if (isLoading) return;
    const run = () => setState((prev) => processSlimeMarketTick(prev));
    run();
    const id = window.setInterval(run, 2800);
    return () => window.clearInterval(id);
  }, [isLoading]);

  const addCoins = useCallback((count: number) => {
    setState(prev => {
      const upgradeValue = gameCoinValuePerCollect(prev.upgrades.coinValue);

      // Calculate trait bonus
      let traitBonus = 0;
      prev.equippedSlimeIds.forEach(id => {
        const slime = prev.slimes.find(s => s.id === id);
        if (slime && slime.trait) {
          traitBonus += TRAIT_EFFECTS[slime.trait].coinValue || 0;
        }
      });

      const totalValuePerCoin = upgradeValue + traitBonus;
      return {
        ...prev,
        coins: prev.coins + count * totalValuePerCoin,
        totalCoinsCollected: prev.totalCoinsCollected + count
      };
    });
  }, []);

  const playCoinCollect = useCoinCollectSfx(
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
    if (!offlineWelcome || !hasStarted) return;
    playCoinCollect(Math.min(5, Math.max(1, Math.ceil(offlineWelcome.idleCoins / 20))));
  }, [offlineWelcome, hasStarted, playCoinCollect]);

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

  const toggleEquipSlime = (id: string) => {
    setState(prev => {
      const isEquipped = prev.equippedSlimeIds.includes(id);
      if (isEquipped) {
        return {
          ...prev,
          equippedSlimeIds: prev.equippedSlimeIds.filter(i => i !== id)
        };
      } else {
        if (prev.equippedSlimeIds.length >= MAX_EQUIPPED_SLIMES) {
          // Maybe show a toast or just swap? Let's swap the first one for simplicity or just block
          return {
            ...prev,
            equippedSlimeIds: [...prev.equippedSlimeIds.slice(1), id]
          };
        }
        return {
          ...prev,
          equippedSlimeIds: [...prev.equippedSlimeIds, id]
        };
      }
    });
  };

  const buyUpgrade = (key: keyof GameState['upgrades']) => {
    if (isGameUpgradeMaxed(state.upgrades, key)) return;
    const currentLevel = state.upgrades[key];
    const cost = key === 'automation' ? UPGRADE_COSTS.automation : (UPGRADE_COSTS as any)[key](currentLevel);
    
    if (state.coins >= cost) {
      setState(prev => ({
        ...prev,
        coins: prev.coins - cost,
        upgrades: {
          ...prev.upgrades,
          [key]: prev.upgrades[key] + 1
        }
      }));
    }
  };

  const buyEgg = (amount: number = 1) => {
    const totalCost = eggPurchaseCost(amount);
    if (state.coins >= totalCost) {
      setState(prev => ({
        ...prev,
        coins: prev.coins - totalCost,
        eggs: prev.eggs + amount
      }));
    }
  };

  const startHatching = () => {
    if (state.eggs > 0 && !state.hatchingEgg) {
      setState(prev => ({
        ...prev,
        eggs: prev.eggs - 1,
        hatchingEgg: {
          progress: 0,
          startTime: Date.now()
        }
      }));
    }
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

  const pokeEgg = () => {
    if (state.hatchingEgg) {
      setState(prev => {
        if (!prev.hatchingEgg) return prev;
        const newProgress = prev.hatchingEgg.progress + 10;
        if (newProgress >= 100) {
          const newSlime: Slime = {
            id: Math.random().toString(36).substr(2, 9),
            name: getUniqueName(prev.slimes),
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            ...rollNewSlimeVisuals(),
            stats: {
              health: 10 + Math.floor(Math.random() * 10),
              strength: 5 + Math.floor(Math.random() * 5),
              agility: 5 + Math.floor(Math.random() * 5),
            },
            statLevels: { health: 1, strength: 1, agility: 1 },
            trait: TRAITS[Math.floor(Math.random() * TRAITS.length)] as SlimeTrait,
            arenaAbility: rollRandomArenaAbility(),
            level: 1,
            value: 50,
            hatchedAt: Date.now()
          };
          return {
            ...prev,
            hatchingEgg: null,
            slimes: [...prev.slimes, newSlime],
            newlyHatchedSlime: newSlime
          };
        }
        return {
          ...prev,
          hatchingEgg: {
            ...prev.hatchingEgg,
            progress: newProgress
          }
        };
      });
    }
  };

  const upgradeSlimeStat = (id: string, stat: keyof SlimeStats) => {
    const slime = state.slimes.find(s => s.id === id);
    if (!slime) return;
    const currentStatLevel = slime.statLevels[stat];
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

  const sellSlimeNow = (slimeId: string) => {
    setState((prev) => {
      const slime = prev.slimes.find((s) => s.id === slimeId);
      if (!slime) return prev;
      const price = getPlayerSellNowPrice(slime);
      return {
        ...prev,
        coins: prev.coins + price,
        totalCoinsCollected: prev.totalCoinsCollected + price,
        slimes: prev.slimes.filter((s) => s.id !== slimeId),
        equippedSlimeIds: prev.equippedSlimeIds.filter((id) => id !== slimeId),
        slimeDetailSeenIds: prev.slimeDetailSeenIds.filter((x) => x !== slimeId),
      };
    });
  };

  const listSlimeForAuction = (slimeId: string) => {
    setState((prev) => {
      const slime = prev.slimes.find((s) => s.id === slimeId);
      if (!slime) return prev;
      const playerSellNowSnapshot = getPlayerSellNowPrice(slime);
      const minBid = getPlayerAuctionOpeningMinBid(slime, playerSellNowSnapshot);
      const auction: SlimeMarketAuction = {
        id: `pl-${Math.random().toString(36).slice(2, 11)}`,
        slime: { ...slime },
        seller: 'player',
        endsAt: Date.now() + SLIME_MARKET_AUCTION_MS,
        currentBid: 0,
        minBid,
        highBidder: null,
        playerBidAmount: 0,
        playerSellNowSnapshot,
      };
      return {
        ...prev,
        slimes: prev.slimes.filter((s) => s.id !== slimeId),
        equippedSlimeIds: prev.equippedSlimeIds.filter((id) => id !== slimeId),
        slimeDetailSeenIds: prev.slimeDetailSeenIds.filter((x) => x !== slimeId),
        slimeMarketAuctions: [...prev.slimeMarketAuctions, auction],
      };
    });
  };

  const placeMarketBid = (auctionId: string) => {
    setState((prev) => {
      const a = prev.slimeMarketAuctions.find((x) => x.id === auctionId);
      if (!a || a.seller !== 'npc' || a.endsAt <= Date.now()) return prev;
      if (a.highBidder === 'player') return prev;
      const next = getNextMarketBid(a);
      if (prev.coins < next) return prev;
      let coins = prev.coins;
      coins -= next;
      let currentBid = next;
      let highBidder: 'player' | 'npc' = 'player';
      let playerBidAmount = next;
      const cap = Math.floor(a.slime.value * 2.4);
      if (Math.random() < 0.4 && currentBid + SLIME_MARKET_MIN_BID_STEP <= cap) {
        const npcBid =
          currentBid +
          SLIME_MARKET_MIN_BID_STEP +
          Math.floor(Math.random() * 4) * SLIME_MARKET_MIN_BID_STEP;
        if (npcBid <= cap) {
          coins += playerBidAmount;
          highBidder = 'npc';
          currentBid = npcBid;
          playerBidAmount = 0;
        }
      }
      const slimeMarketAuctions = prev.slimeMarketAuctions.map((x) =>
        x.id === auctionId
          ? { ...a, currentBid, highBidder, playerBidAmount, npcInstantBuyLocked: true }
          : x
      );
      return { ...prev, coins, slimeMarketAuctions };
    });
  };

  const placeMarketInstantBuy = (auctionId: string) => {
    setState((prev) => {
      const a = prev.slimeMarketAuctions.find((x) => x.id === auctionId);
      if (!a || a.seller !== 'npc' || a.endsAt <= Date.now()) return prev;
      if (a.npcInstantBuyLocked) return prev;
      const instant = getInstantNpcBuyPrice(a);
      const next = getNextMarketBid(a);
      if (instant <= next) return prev;
      let coins = prev.coins;
      if (a.highBidder === 'player') coins += a.playerBidAmount;
      if (coins < instant) return prev;
      coins -= instant;
      const slimeMarketAuctions = prev.slimeMarketAuctions.filter((x) => x.id !== auctionId);
      return {
        ...prev,
        coins,
        slimes: [...prev.slimes, a.slime],
        slimeMarketAuctions,
      };
    });
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
        return { ...prev, coins, slimeArenaAbilityCooldownUntil, arenaWins };
      });
    },
    []
  );

  // Debug Actions
  const debugAddCoins = (amount: number) => {
    setState(prev => ({ ...prev, coins: prev.coins + amount }));
  };

  const debugAddEggs = (amount: number) => {
    setState(prev => ({ ...prev, eggs: prev.eggs + amount }));
  };

  const debugReset = () => {
    if (confirm('Reset all progress?')) {
      setState(INITIAL_STATE);
      localStorage.removeItem('slime_sprout_state');
      window.location.reload();
    }
  };

  const debugUnlockAll = () => {
    setState(prev => ({
      ...prev,
      upgrades: {
        automation: 1,
        movementSpeed: MAX_GAME_UPGRADE_LEVEL.movementSpeed,
        respawnTime: MAX_GAME_UPGRADE_LEVEL.respawnTime,
        coinValue: MAX_GAME_UPGRADE_LEVEL.coinValue,
      }
    }));
  };

  /** Same outcome as maxing all game-tab upgrades: unlock next world, go there, reset upgrades. */
  const debugCompleteLevel = () => {
    setState((prev) => {
      if (prev.maxUnlockedGameWorld >= 5) return prev;
      const nextIndex = prev.maxUnlockedGameWorld + 1;
      gameUpgradeMaxedUnlockRef.current = false;
      queueMicrotask(() =>
        setWorldUnlockCelebration({
          worldIndex: nextIndex,
          worldName: GAME_WORLDS[nextIndex].name,
        })
      );
      return {
        ...prev,
        maxUnlockedGameWorld: nextIndex,
        gameWorldIndex: nextIndex,
        upgrades: { ...INITIAL_STATE.upgrades },
      };
    });
  };

  const goGameWorld = (delta: 1 | -1) => {
    const next = state.gameWorldIndex + delta;
    if (next < 0 || next > state.maxUnlockedGameWorld) return;
    setWorldNavTransition(false);
    setWorldNavShiftPx(delta * 28);
    setState((s) => ({ ...s, gameWorldIndex: next }));
  };

  useLayoutEffect(() => {
    if (worldNavShiftPx === 0) return;
    setWorldNavTransition(true);
    setWorldNavShiftPx(0);
  }, [state.gameWorldIndex, worldNavShiftPx]);

  const debugAddSlime = () => {
    setState(prev => {
      const newSlime: Slime = {
        id: Math.random().toString(36).substr(2, 9),
        name: getUniqueName(prev.slimes),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        ...rollNewSlimeVisuals(),
        stats: {
          health: 10 + Math.floor(Math.random() * 10),
          strength: 5 + Math.floor(Math.random() * 5),
          agility: 5 + Math.floor(Math.random() * 5),
        },
        statLevels: { health: 1, strength: 1, agility: 1 },
        trait: TRAITS[Math.floor(Math.random() * TRAITS.length)] as SlimeTrait,
        arenaAbility: rollRandomArenaAbility(),
        level: 1,
        value: 50,
        hatchedAt: Date.now()
      };
      return {
        ...prev,
        slimes: [...prev.slimes, newSlime]
      };
    });
  };

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

  return (
    <div
      className={`relative flex h-full min-h-[100dvh] w-full flex-col overflow-hidden select-none ${isGameTab ? 'bg-app-game' : 'bg-app-page'}`}
    >
      {/* Onboarding Overlay */}
      <AnimatePresence>
        {!state.hasCompletedOnboarding && hasStarted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] flex items-end justify-center bg-black/50 p-6 pb-24 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative w-full overflow-hidden rounded-3xl border border-emerald-100/90 bg-white p-6 pt-7 shadow-2xl shadow-emerald-900/15 ring-1 ring-orange-100/90"
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 via-lime-400 to-orange-400" />
              <div className="absolute -top-16 left-6 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-emerald-400 to-lime-300 shadow-lg shadow-emerald-600/20">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-white rounded-full relative">
                    <div className="absolute top-0.5 right-0.5 w-0.5 h-0.5 bg-black rounded-full" />
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full relative">
                    <div className="absolute top-0.5 right-0.5 w-0.5 h-0.5 bg-black rounded-full" />
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <h3 className="text-lg font-black text-gray-800 mb-2 flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-orange-500" />
                  Glim
                </h3>
                <p className="text-gray-600 font-medium leading-relaxed mb-6">
                  {onboardingMessages[onboardingStep]}
                </p>
                
                <div className="flex justify-between items-center">
                  <div className="flex gap-1">
                    {onboardingMessages.map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-1.5 rounded-full transition-all ${i === onboardingStep ? 'w-6 bg-gradient-to-r from-emerald-500 to-orange-400' : 'w-2 bg-gray-200'}`} 
                      />
                    ))}
                  </div>
                  <button 
                    onClick={nextOnboarding}
                    className="btn-primary-glow rounded-xl px-6 py-3 text-base font-black hover:scale-105 active:scale-95"
                  >
                    {onboardingStep === onboardingMessages.length - 1 ? "Got it!" : "Next"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Stats — overlays full-screen game; normal flow on other tabs */}
      <div
        className={
          isGameTab
            ? 'glass-header-game pointer-events-none absolute top-0 right-0 left-0 z-30 grid grid-cols-[minmax(2.5rem,1fr)_auto_minmax(2.5rem,1fr)] items-center px-2 pt-header-safe pb-3'
            : shellOverArenaFight
              ? 'glass-header-page relative z-[125] grid grid-cols-[minmax(2.5rem,1fr)_auto_minmax(2.5rem,1fr)] items-center px-2 pt-header-safe pb-3'
              : 'glass-header-page relative z-10 grid grid-cols-[minmax(2.5rem,1fr)_auto_minmax(2.5rem,1fr)] items-center px-2 pt-header-safe pb-3'
        }
      >
        <button
          type="button"
          onClick={() => setIsDebugOpen(true)}
          className={
            isGameTab
              ? 'ui-emerald-outline-soft pointer-events-auto justify-self-start rounded-xl bg-white/25 p-2 text-emerald-900/45 backdrop-blur-sm transition-colors hover:text-orange-600'
              : 'pointer-events-auto justify-self-start p-2 text-emerald-900/45 transition-colors hover:text-orange-600'
          }
          aria-label="Debug menu"
        >
          <Bug className="h-4 w-4" />
        </button>
        <div className="flex items-center justify-center gap-2">
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
      </div>

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
                  className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
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
                Stage {worldUnlockCelebration.worldIndex + 1} of {GAME_WORLDS.length}
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

      {/* Hatching Celebration Overlay */}
      <AnimatePresence>
        {state.newlyHatchedSlime && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-center justify-center bg-gradient-to-br from-emerald-600/95 via-green-600/90 to-orange-400/90 p-6 text-center backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="flex flex-col items-center"
            >
              <motion.div 
                animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="mb-8"
              >
                <PartyPopper className="mb-4 h-16 w-16 text-amber-100 drop-shadow-md" />
              </motion.div>
              
              <h2 className="mb-2 text-4xl font-black text-white drop-shadow-sm">New slime!</h2>
              <p className="mb-8 font-bold text-emerald-50">A beautiful new friend has joined your collection!</p>

              <div className="relative mb-8">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute inset-0 bg-white rounded-full blur-3xl"
                />
                <div className="relative flex w-40 items-center justify-center">
                  <SlimeStackSprite slime={state.newlyHatchedSlime} size="2xl" className="shadow-2xl ring-4 ring-white/30" />
                </div>
              </div>

              <div className="mb-8 w-full max-w-sm rounded-2xl bg-white/20 p-4 text-left backdrop-blur-sm">
                <h3 className="mb-1 text-center text-xl font-black text-white">
                  {state.newlyHatchedSlime.name}
                </h3>
                <div className="mb-3 flex justify-center">
                  <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-[10px] font-black text-white">
                    Level {state.newlyHatchedSlime.level}
                  </span>
                </div>

                <div className="mb-3 flex items-center justify-center gap-4 rounded-xl bg-black/10 px-3 py-2.5">
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

                <div className="border-t border-white/20 py-3 text-center">
                  <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-emerald-100/90">
                    Coin field trait
                  </p>
                  <p className="mb-0.5 text-sm font-black text-white">{state.newlyHatchedSlime.trait}</p>
                  <p className="text-xs font-bold italic leading-snug text-emerald-50/95">"{TRAIT_EFFECTS[state.newlyHatchedSlime.trait].description}"</p>
                </div>

                <div className="border-t border-white/20 pt-3 text-center">
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
                className="rounded-2xl bg-white px-12 py-4 text-lg font-black text-orange-600 shadow-xl ring-2 ring-orange-200/80 transition-transform hover:scale-105"
              >
                Awesome!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debug Menu Overlay */}
      <AnimatePresence>
        {isDebugOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="relative w-full max-w-xs overflow-hidden rounded-3xl border border-emerald-100/90 bg-gradient-to-b from-white to-orange-50/40 p-6 pt-7 shadow-2xl shadow-emerald-900/15 ring-1 ring-orange-100/70"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-orange-400" />
              <div className="mb-6 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-black text-gray-800">
                  <Bug className="text-orange-500" /> Debug Menu
                </h2>
                <button onClick={() => setIsDebugOpen(false)} className="text-gray-400">
                  <ChevronRight className="rotate-90" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-100/80 bg-emerald-50/50 p-3">
                  <p className="mb-2 text-[10px] font-black text-emerald-600/80 uppercase">Currency</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => debugAddCoins(1000)} className="rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 py-2 text-xs font-bold text-orange-800">+1k 💰</button>
                    <button onClick={() => debugAddCoins(10000)} className="rounded-xl bg-gradient-to-br from-amber-200 to-orange-200 py-2 text-xs font-bold text-orange-900">+10k 💰</button>
                  </div>
                </div>

                <div className="rounded-2xl border border-orange-100/80 bg-orange-50/40 p-3">
                  <p className="mb-2 text-[10px] font-black text-orange-700/90 uppercase">Items</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => debugAddEggs(1)} className="rounded-xl bg-emerald-100 py-2 text-xs font-bold text-emerald-800">+1 Egg 🥚</button>
                    <button onClick={() => debugAddEggs(10)} className="rounded-xl bg-teal-100 py-2 text-xs font-bold text-teal-800">+10 Eggs 🥚</button>
                    <button 
                      onClick={debugAddSlime} 
                      className="col-span-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-200 to-lime-100 py-2.5 text-sm font-bold text-emerald-900"
                    >
                      <Sparkles className="h-4 w-4 shrink-0" /> Add Random Slime
                    </button>
                  </div>
                </div>

                <button 
                  onClick={debugUnlockAll}
                  className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-100 py-3 text-base font-bold text-emerald-800"
                >
                  <Zap className="h-5 w-5 shrink-0" /> Max Upgrades
                </button>

                <button
                  type="button"
                  onClick={debugCompleteLevel}
                  disabled={state.maxUnlockedGameWorld >= 5}
                  title={
                    state.maxUnlockedGameWorld >= 5
                      ? 'All worlds already unlocked'
                      : 'Unlock the next area and reset shop upgrades (normal level completion)'
                  }
                  className="ui-afford-disabled flex w-full items-center justify-center gap-2.5 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 py-3 text-base font-bold text-amber-900 disabled:border-zinc-200 disabled:from-zinc-100 disabled:to-zinc-100 disabled:text-zinc-500"
                >
                  <Trophy className="h-5 w-5 shrink-0" /> Complete level
                </button>

                <button 
                  onClick={debugReset}
                  className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 py-3 text-base font-bold text-red-700"
                >
                  <Trash2 className="h-5 w-5 shrink-0" /> Reset Game
                </button>
              </div>

              <button 
                onClick={() => setIsDebugOpen(false)}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-800 py-4 text-base font-bold text-white shadow-lg shadow-emerald-900/20"
              >
                Close
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
                className="absolute top-4 right-4 rounded-full bg-gradient-to-br from-emerald-50 to-orange-50 p-2 text-emerald-400 transition-colors hover:text-orange-500"
              >
                <Plus className="w-5 h-5 rotate-45" />
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
                  <span className="rounded-full bg-gradient-to-r from-emerald-100 to-teal-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">
                    {selectedSlimeDetail.trait}
                  </span>
                </div>

                <div className="mb-4 w-full space-y-4 rounded-[2rem] border border-emerald-100/60 bg-gradient-to-b from-emerald-50/80 to-orange-50/30 p-4">
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

                  <div className="text-center pt-1">
                    <p className="text-[8px] font-black text-gray-400 tracking-[0.15em] border-t border-gray-100 pt-2 mb-2">Tap a row to upgrade</p>
                  </div>
                      {/* Stat upgrades: horizontal rows, upgrade on the right */}
                      <div className="flex flex-col gap-2">
                        <button 
                          type="button"
                          onClick={() => upgradeSlimeStat(selectedSlimeDetail.id, 'health')}
                          disabled={state.coins < SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.health)}
                          className="ui-afford-disabled group flex w-full min-h-[3.25rem] items-center justify-between gap-3 rounded-2xl border-2 border-red-100 bg-red-50 px-3 py-2.5 text-left shadow-sm transition-all hover:border-red-300 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:shadow-none"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="shrink-0 text-red-500 transition-transform group-active:scale-110 group-disabled:text-zinc-500"><Heart className="h-6 w-6" /></div>
                            <div className="min-w-0">
                              <div className="text-xs font-black leading-none text-red-400 group-disabled:text-zinc-500">Health up</div>
                              <div className="mt-0.5 flex items-baseline gap-0.5 font-black tabular-nums leading-none">
                                <span className="text-lg text-zinc-800 group-disabled:text-zinc-700">{selectedSlimeDetail.stats.health}</span>
                                <ChevronRight className="mx-px h-4 w-4 shrink-0 self-center text-zinc-400" aria-hidden />
                                <span className="text-lg text-emerald-600 group-disabled:text-emerald-600/70">
                                  {selectedSlimeDetail.stats.health + SLIME_STAT_UPGRADE_DELTA.health}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 rounded-xl border-2 border-orange-500 bg-gradient-to-br from-amber-400 to-orange-500 px-3 py-2 text-center shadow-sm group-disabled:border-zinc-300 group-disabled:from-zinc-200 group-disabled:to-zinc-300">
                            <div className="text-xs font-black tracking-wide text-white/95 group-disabled:text-zinc-600">Upgrade</div>
                            <div className="text-sm font-black tabular-nums text-white group-disabled:text-red-600">
                              {SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.health)}💰
                            </div>
                          </div>
                        </button>
                        <button 
                          type="button"
                          onClick={() => upgradeSlimeStat(selectedSlimeDetail.id, 'strength')}
                          disabled={state.coins < SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.strength)}
                          className="ui-afford-disabled group flex w-full min-h-[3.25rem] items-center justify-between gap-3 rounded-2xl border-2 border-orange-100 bg-orange-50 px-3 py-2.5 text-left shadow-sm transition-all hover:border-orange-300 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:shadow-none"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="shrink-0 text-orange-500 transition-transform group-active:scale-110 group-disabled:text-zinc-500"><Sword className="h-6 w-6" /></div>
                            <div className="min-w-0">
                              <div className="text-xs font-black leading-none text-orange-400 group-disabled:text-zinc-500">Strength up</div>
                              <div className="mt-0.5 flex items-baseline gap-0.5 font-black tabular-nums leading-none">
                                <span className="text-lg text-zinc-800 group-disabled:text-zinc-700">{selectedSlimeDetail.stats.strength}</span>
                                <ChevronRight className="mx-px h-4 w-4 shrink-0 self-center text-zinc-400" aria-hidden />
                                <span className="text-lg text-emerald-600 group-disabled:text-emerald-600/70">
                                  {selectedSlimeDetail.stats.strength + SLIME_STAT_UPGRADE_DELTA.strength}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 rounded-xl border-2 border-orange-500 bg-gradient-to-br from-amber-400 to-orange-500 px-3 py-2 text-center shadow-sm group-disabled:border-zinc-300 group-disabled:from-zinc-200 group-disabled:to-zinc-300">
                            <div className="text-xs font-black tracking-wide text-white/95 group-disabled:text-zinc-600">Upgrade</div>
                            <div className="text-sm font-black tabular-nums text-white group-disabled:text-red-600">
                              {SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.strength)}💰
                            </div>
                          </div>
                        </button>
                        <button 
                          type="button"
                          onClick={() => upgradeSlimeStat(selectedSlimeDetail.id, 'agility')}
                          disabled={state.coins < SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.agility)}
                          className="ui-afford-disabled group flex w-full min-h-[3.25rem] items-center justify-between gap-3 rounded-2xl border-2 border-blue-100 bg-blue-50 px-3 py-2.5 text-left shadow-sm transition-all hover:border-blue-300 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:shadow-none"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="shrink-0 text-blue-500 transition-transform group-active:scale-110 group-disabled:text-zinc-500"><Wind className="h-6 w-6" /></div>
                            <div className="min-w-0">
                              <div className="text-xs font-black leading-none text-blue-400 group-disabled:text-zinc-500">Agility up</div>
                              <div className="mt-0.5 flex items-baseline gap-0.5 font-black tabular-nums leading-none">
                                <span className="text-lg text-zinc-800 group-disabled:text-zinc-700">{selectedSlimeDetail.stats.agility}</span>
                                <ChevronRight className="mx-px h-4 w-4 shrink-0 self-center text-zinc-400" aria-hidden />
                                <span className="text-lg text-emerald-600 group-disabled:text-emerald-600/70">
                                  {selectedSlimeDetail.stats.agility + SLIME_STAT_UPGRADE_DELTA.agility}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 rounded-xl border-2 border-orange-500 bg-gradient-to-br from-amber-400 to-orange-500 px-3 py-2 text-center shadow-sm group-disabled:border-zinc-300 group-disabled:from-zinc-200 group-disabled:to-zinc-300">
                            <div className="text-xs font-black tracking-wide text-white/95 group-disabled:text-zinc-600">Upgrade</div>
                            <div className="text-sm font-black tabular-nums text-white group-disabled:text-red-600">
                              {SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.agility)}💰
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="w-full mt-2">
                      <button 
                        onClick={() => {
                          toggleEquipSlime(selectedSlimeDetail.id);
                        }}
                        className={`w-full rounded-xl py-3 text-sm font-black tracking-widest transition-all ${
                          state.equippedSlimeIds.includes(selectedSlimeDetail.id)
                          ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md hover:brightness-105'
                          : 'btn-primary-glow shadow-md'
                        }`}
                      >
                        {state.equippedSlimeIds.includes(selectedSlimeDetail.id) ? 'Unequip' : 'Equip'}
                      </button>
                    </div>
              </div>
            </motion.div>
          </motion.div>
        )}
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
                    automationLevel={state.upgrades.automation}
                    movementSpeedLevel={state.upgrades.movementSpeed}
                    respawnTimeLevel={state.upgrades.respawnTime}
                    equippedSlimes={state.slimes.filter((s) =>
                      state.equippedSlimeIds.includes(s.id)
                    )}
                    insetLeftForWorldNav={state.gameWorldIndex > 0}
                    insetRightForWorldNav={
                      state.maxUnlockedGameWorld > state.gameWorldIndex ||
                      (state.gameWorldIndex === state.maxUnlockedGameWorld &&
                        state.maxUnlockedGameWorld < GAME_WORLDS.length - 1)
                    }
                  />
                </div>

                <div className="pointer-events-none absolute left-1/2 top-game-world-label z-[35] -translate-x-1/2">
                  <div className="ui-emerald-outline-soft rounded-full bg-emerald-950/25 px-3 py-1 shadow-sm backdrop-blur-md">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                      {GAME_WORLDS[state.gameWorldIndex]?.name ?? GAME_WORLDS[0].name}
                    </span>
                  </div>
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
                    <div
                      className="pointer-events-none absolute right-2 top-1/2 z-[38] -translate-y-1/2"
                      role="img"
                      aria-label="Next area locked. Max all game upgrades in this world to unlock."
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
              {/* Upper Half: Eggs and Hatching */}
              <div className="flex min-h-[160px] flex-none flex-col justify-center border-b border-emerald-100/80 bg-gradient-to-b from-emerald-100/90 via-orange-50/50 to-white p-3">
                <div className="flex flex-col items-center justify-center gap-3">
                  {/* Middle: Hatching Area */}
                  <div className="flex flex-col items-center justify-center relative h-36">
                    {!state.hatchingEgg ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300 relative group transition-all">
                          <Egg className="w-8 h-8 text-gray-300 group-hover:scale-110 transition-transform" />
                          <div className="absolute -top-1 -right-1 bg-yellow-400 text-white text-[8px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                            {state.eggs}
                          </div>
                        </div>
                        <div className="h-6 flex items-center justify-center">
                          {state.eggs > 0 ? (
                            <button 
                              onClick={startHatching}
                              className="btn-primary-glow animate-pulse rounded-full px-4 py-1.5 text-[9px] font-black"
                            >
                              Hatch now
                            </button>
                          ) : (
                            <span className="text-[9px] font-black text-gray-400 tracking-widest">No eggs to hatch</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full">
                        <motion.div 
                          animate={{ 
                            scale: [1, 1.02, 1],
                            rotate: [0, -1, 1, 0]
                          }}
                          transition={{ repeat: Infinity, duration: 2.5 }}
                          whileTap={{ scale: 0.95, rotate: [-1, 1, 0] }}
                          onClick={pokeEgg}
                          className="relative cursor-pointer group flex items-center justify-center"
                        >
                          {/* Custom Filled Egg */}
                          <div className="relative w-24 h-28 flex items-center justify-center scale-75 origin-center">
                            {/* Solid Shell with Gradient/Detail */}
                            <div 
                              className="absolute w-20 h-28 bg-gradient-to-br from-yellow-50 to-yellow-200 border-4 border-yellow-600 rounded-[50%_50%_50%_50%/_60%_60%_40%_40%] shadow-2xl overflow-hidden"
                            >
                              {/* Shell Highlight */}
                              <div className="absolute top-4 left-4 w-5 h-8 bg-white/40 rounded-full blur-[2px] -rotate-12" />
                            </div>
                            
                            {/* Refined Cracks (SVG for Jagged Lines) */}
                            <svg 
                              className="absolute inset-0 w-full h-full z-10 pointer-events-none" 
                              viewBox="0 0 128 160"
                            >
                              <g fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="#713F12">
                                {/* Crack 1: Top Left */}
                                <motion.path 
                                  initial={{ pathLength: 0, opacity: 0 }}
                                  animate={{ 
                                    pathLength: state.hatchingEgg.progress > 20 ? 1 : 0,
                                    opacity: state.hatchingEgg.progress > 20 ? 1 : 0 
                                  }}
                                  d="M45,45 L50,55 L42,65 L55,75"
                                />
                                {/* Crack 2: Bottom Right */}
                                <motion.path 
                                  initial={{ pathLength: 0, opacity: 0 }}
                                  animate={{ 
                                    pathLength: state.hatchingEgg.progress > 45 ? 1 : 0,
                                    opacity: state.hatchingEgg.progress > 45 ? 1 : 0 
                                  }}
                                  d="M85,110 L75,100 L82,90 L70,80"
                                />
                                {/* Crack 3: Middle Left */}
                                <motion.path 
                                  initial={{ pathLength: 0, opacity: 0 }}
                                  animate={{ 
                                    pathLength: state.hatchingEgg.progress > 70 ? 1 : 0,
                                    opacity: state.hatchingEgg.progress > 70 ? 1 : 0 
                                  }}
                                  d="M30,85 L40,95 L32,105 L45,115"
                                />
                                {/* Crack 4: Top Center Split */}
                                <motion.path 
                                  initial={{ pathLength: 0, opacity: 0 }}
                                  animate={{ 
                                    pathLength: state.hatchingEgg.progress > 90 ? 1 : 0,
                                    opacity: state.hatchingEgg.progress > 90 ? 1 : 0 
                                  }}
                                  d="M64,32 L60,50 L68,70 L64,90 L70,110"
                                  strokeWidth="3"
                                />
                              </g>
                            </svg>

                            {/* POKE! Text */}
                            <div className="z-20 flex items-center justify-center">
                               <motion.span 
                                  animate={{ 
                                    scale: [1, 1.05 + (state.hatchingEgg.progress / 400), 1],
                                    color: state.hatchingEgg.progress > 80 ? ['#713F12', '#92400E', '#713F12'] : '#713F12'
                                  }} 
                                  transition={{ repeat: Infinity, duration: 0.8 }}
                                  className="text-yellow-900 font-extrabold text-sm drop-shadow-md select-none tracking-widest"
                               >
                                  Poke!
                               </motion.span>
                            </div>
                          </div>
                        </motion.div>
                        <div className="flex flex-col items-center">
                          <div className="mt-0 h-1 w-32 overflow-hidden rounded-full border border-orange-100 bg-white/80 shadow-inner">
                            <motion.div 
                              className="h-full bg-gradient-to-r from-emerald-500 to-orange-400"
                              animate={{ width: `${state.hatchingEgg.progress}%` }}
                            />
                          </div>
                          <p className="mt-0.5 text-[8px] font-black text-emerald-700 tracking-tighter">{state.hatchingEgg.progress}% hatched</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Buy Section: Below hatching area */}
                  <div className="flex gap-3 w-full max-w-sm">
                    <button 
                      type="button"
                      onClick={() => buyEgg(1)}
                      disabled={state.coins < EGG_COST}
                      className="ui-afford-disabled group flex min-h-14 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border-2 border-orange-500 bg-gradient-to-br from-amber-400 to-orange-500 px-2 py-2.5 font-black text-white shadow-md transition-all hover:brightness-105 disabled:border-zinc-300 disabled:from-zinc-200 disabled:via-zinc-200 disabled:to-zinc-300 disabled:text-zinc-900 disabled:shadow-none"
                    >
                      <span className="inline-flex items-baseline justify-center gap-4 whitespace-nowrap text-sm font-black leading-tight tracking-wide text-white/95 group-disabled:text-zinc-700">
                        <span>Buy x1</span>
                        <span className="text-base tabular-nums text-white/95 group-disabled:text-red-600">{EGG_COST} 💰</span>
                      </span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => buyEgg(10)}
                      disabled={state.coins < EGG_BULK_10_COST}
                      className="ui-afford-disabled group flex min-h-14 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border-2 border-orange-500 bg-gradient-to-br from-amber-400 to-orange-500 px-2 py-2.5 font-black text-white shadow-md transition-all hover:brightness-105 disabled:border-zinc-300 disabled:from-zinc-200 disabled:via-zinc-200 disabled:to-zinc-300 disabled:text-zinc-900 disabled:shadow-none"
                    >
                      <span className="inline-flex items-baseline justify-center gap-4 whitespace-nowrap text-sm font-black leading-tight tracking-wide text-white/95 group-disabled:text-zinc-700">
                        <span>Buy x10</span>
                        <span className="text-base tabular-nums text-white/95 group-disabled:text-red-600">
                          {EGG_BULK_10_COST} 💰
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Lower Half: Collection Overview */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                <div className="flex justify-between items-center px-1">
                  <h3 className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-gray-800">
                    <Ghost className="h-4 w-4 text-emerald-600" /> My collection ({state.slimes.length})
                  </h3>
                  <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-100 to-orange-100 px-2 py-0.5 ring-1 ring-orange-200/60">
                    <span className="text-[8px] font-black text-emerald-800">Equipped</span>
                    <p className="text-[9px] font-black text-orange-800">
                      {state.equippedSlimeIds.length}/{MAX_EQUIPPED_SLIMES}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pb-8">
                  {state.slimes.map((slime: Slime) => (
                    <SlimeCard 
                      key={slime.id} 
                      slime={slime} 
                      coins={state.coins}
                      isEquipped={state.equippedSlimeIds.includes(slime.id)}
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
                        <p className="text-[10px] text-gray-400 mt-1 font-black">Buy and hatch your first egg!</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {state.activeTab === 'slimeMarket' && (
            <motion.div
              key="slimeMarket"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              className="flex h-full min-h-0 w-full flex-col overflow-hidden"
            >
              <SlimeMarketPanel
                coins={state.coins}
                slimes={state.slimes}
                auctions={state.slimeMarketAuctions}
                onSellSlimeNow={sellSlimeNow}
                onListSlimeAuction={listSlimeForAuction}
                onBid={placeMarketBid}
                onInstantBuy={placeMarketInstantBuy}
              />
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
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation — floats over game; in-flow on Slimes / Slime Market / Arena */}
      <div
        className={
          isGameTab
            ? 'glass-nav-game pointer-events-none absolute right-0 bottom-0 left-0 z-40 flex items-center justify-around gap-0.5 p-1.5 pb-nav-safe'
            : 'glass-nav-page relative z-50 flex items-center justify-around gap-0.5 p-1.5 pb-nav-safe'
        }
      >
        <NavButton 
          active={state.activeTab === 'slimes'} 
          onClick={() => setState(s => ({ ...s, activeTab: 'slimes' }))}
          icon={<Ghost />}
          hasNotification={hasSlimesNotification}
        />
        <NavButton 
          active={state.activeTab === 'game'} 
          onClick={() => setState(s => ({ ...s, activeTab: 'game' }))}
          icon={<CircleDollarSign />}
        />
        <NavButton 
          active={state.activeTab === 'slimeMarket'} 
          onClick={() => setState(s => ({ ...s, activeTab: 'slimeMarket' }))}
          icon={<Gavel />}
          hasNotification={hasSlimeMarketTabNotification}
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
              className="game-hud-upgrade ui-emerald-outline pointer-events-auto absolute right-4 z-50 rounded-2xl bg-gradient-to-br from-white/95 to-emerald-50/90 p-3 text-emerald-700 shadow-lg shadow-emerald-900/10 backdrop-blur-md transition-transform hover:scale-110"
            >
              <TrendingUp className="h-6 w-6" />
              {canAffordAnyGameUpgrade && (
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
                  className="game-upgrades-sheet ui-emerald-outline pointer-events-auto absolute right-4 left-4 z-50 flex min-h-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-white/95 via-emerald-50/40 to-orange-50/50 p-3 shadow-xl shadow-emerald-900/10 backdrop-blur-md"
                >
                <div className="mb-2 flex shrink-0 items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-emerald-900">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0 text-orange-500" /> Upgrades
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsUpgradesOpen(false)}
                    className="text-emerald-400 transition-colors hover:text-orange-500"
                  >
                    <ChevronRight className="h-5 w-5 rotate-90" />
                  </button>
                </div>
                <div className="relative min-h-0 flex-1">
                  <div
                    ref={upgradesScrollRef}
                    className="no-scrollbar flex max-h-full min-h-0 flex-col gap-1.5 overflow-y-auto overscroll-contain pr-0.5 pb-0.5"
                  >
                  <GameUpgradeRow
                    title="Move speed"
                    description="Run faster and reach coins sooner."
                    level={state.upgrades.movementSpeed}
                    maxLevel={MAX_GAME_UPGRADE_LEVEL.movementSpeed}
                    currentStat={`${Math.round((gamePlayerBaseSpeedAtLevel(state.upgrades.movementSpeed) / BASE_MOVEMENT_SPEED) * 100)}% speed`}
                    nextStat={
                      isGameUpgradeMaxed(state.upgrades, 'movementSpeed')
                        ? 'MAX'
                        : `${Math.round((gamePlayerBaseSpeedAtLevel(state.upgrades.movementSpeed + 1) / BASE_MOVEMENT_SPEED) * 100)}% speed`
                    }
                    cost={UPGRADE_COSTS.movementSpeed(state.upgrades.movementSpeed)}
                    canAfford={state.coins >= UPGRADE_COSTS.movementSpeed(state.upgrades.movementSpeed)}
                    onPurchase={() => buyUpgrade('movementSpeed')}
                    maxed={isGameUpgradeMaxed(state.upgrades, 'movementSpeed')}
                  />
                  <GameUpgradeRow
                    title="Faster spawns"
                    description="Shorten time between coin spawns."
                    level={state.upgrades.respawnTime}
                    maxLevel={MAX_GAME_UPGRADE_LEVEL.respawnTime}
                    currentStat={`${(gameRespawnIntervalMs(state.upgrades.respawnTime) / 1000).toFixed(1)}s`}
                    nextStat={
                      isGameUpgradeMaxed(state.upgrades, 'respawnTime')
                        ? 'MAX'
                        : `${(gameRespawnIntervalMs(state.upgrades.respawnTime + 1) / 1000).toFixed(1)}s`
                    }
                    cost={UPGRADE_COSTS.respawnTime(state.upgrades.respawnTime)}
                    canAfford={state.coins >= UPGRADE_COSTS.respawnTime(state.upgrades.respawnTime)}
                    onPurchase={() => buyUpgrade('respawnTime')}
                    maxed={isGameUpgradeMaxed(state.upgrades, 'respawnTime')}
                    statSubtitle={`+${onScreenCoinCap(state.upgrades.respawnTime)} max on field → +${isGameUpgradeMaxed(state.upgrades, 'respawnTime') ? onScreenCoinCap(state.upgrades.respawnTime) : onScreenCoinCap(state.upgrades.respawnTime + 1)}`}
                  />
                  <GameUpgradeRow
                    title="Coin value"
                    description="More coins each time you collect."
                    level={state.upgrades.coinValue}
                    maxLevel={MAX_GAME_UPGRADE_LEVEL.coinValue}
                    currentStat={`${gameCoinValuePerCollect(state.upgrades.coinValue)} base 💰`}
                    nextStat={
                      isGameUpgradeMaxed(state.upgrades, 'coinValue')
                        ? 'MAX'
                        : `${gameCoinValuePerCollect(state.upgrades.coinValue + 1)} base 💰`
                    }
                    cost={UPGRADE_COSTS.coinValue(state.upgrades.coinValue)}
                    canAfford={state.coins >= UPGRADE_COSTS.coinValue(state.upgrades.coinValue)}
                    onPurchase={() => buyUpgrade('coinValue')}
                    maxed={isGameUpgradeMaxed(state.upgrades, 'coinValue')}
                  />
                  <GameUpgradeRow
                    title="Automation"
                    description="Earn coins while away or in the background."
                    level={state.upgrades.automation}
                    maxLevel={1}
                    currentStat={
                      state.upgrades.automation > 0
                        ? 'On'
                        : 'Off'
                    }
                    nextStat={
                      state.upgrades.automation > 0
                        ? 'MAX'
                        : `~${computeOfflineIdleGain(
                            { automation: 1, respawnTime: state.upgrades.respawnTime, coinValue: state.upgrades.coinValue },
                            60 * 60 * 1000
                          ).currencyEarned.toLocaleString()} 💰/hr`
                    }
                    cost={state.upgrades.automation > 0 ? 0 : UPGRADE_COSTS.automation}
                    canAfford={state.upgrades.automation === 0 && state.coins >= UPGRADE_COSTS.automation}
                    onPurchase={() => buyUpgrade('automation')}
                    maxed={state.upgrades.automation > 0}
                  />
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
    </div>
  );
}

function NavButton({ active, onClick, icon, hasNotification }: { active: boolean, onClick: () => void, icon: React.ReactNode, hasNotification?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto relative flex flex-col items-center gap-1 rounded-2xl p-2 transition-all active:scale-[0.97]"
    >
      <div
        className={
          active
            ? 'rounded-xl p-2.5 transition-all border-2 border-emerald-400/90 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-700/25 ring-2 ring-emerald-500/45'
            : 'ui-emerald-outline rounded-xl p-2.5 transition-all bg-gradient-to-br from-emerald-100 to-orange-100 text-emerald-800/90 shadow-sm hover:from-emerald-50 hover:to-amber-50/90'
        }
      >
        {React.cloneElement(icon as React.ReactElement, { className: 'w-8 h-8' })}
      </div>
      {hasNotification && (
        <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm" />
      )}
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
  maxed,
  statSubtitle,
}: GameUpgradeRowProps) {
  const lockedOut = !canAfford || maxed;
  const showRedCost = !maxed && !canAfford;
  return (
    <div className="rounded-lg border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/50 p-1.5 shadow-sm">
      <div className="flex items-start justify-between gap-1.5">
        <h4 className="text-[10px] font-bold uppercase leading-tight tracking-wide text-emerald-900">{title}</h4>
        <div className="shrink-0 rounded border border-orange-200/70 bg-orange-50/90 px-1.5 py-px text-[8px] font-black tabular-nums leading-none text-orange-700 shadow-sm">
          LEVEL {level}/{maxLevel}
        </div>
      </div>
      <p className="mt-0.5 text-[9px] font-medium leading-tight text-zinc-600">{description}</p>
      {statSubtitle != null && statSubtitle !== '' && (
        <p className="mt-px text-[8px] font-semibold leading-tight text-zinc-500">{statSubtitle}</p>
      )}
      <div className="mt-1 flex items-center justify-between gap-1.5 rounded-md border border-emerald-100/90 bg-zinc-50/90 px-2 py-1 text-[10px] font-bold tabular-nums leading-tight">
        <span className="min-w-0 truncate text-zinc-800">{currentStat}</span>
        <span className="shrink-0 text-zinc-400" aria-hidden>
          &gt;
        </span>
        <span className="min-w-0 truncate text-right text-orange-600">{nextStat}</span>
      </div>
      <div className="mt-1 flex gap-1.5">
        <button
          type="button"
          onClick={onPurchase}
          disabled={lockedOut}
          className={`min-w-0 flex-[4] rounded-md py-1.5 text-center text-[10px] font-black leading-tight tracking-wide transition-all ${
            maxed
              ? 'cursor-default border border-zinc-200 bg-zinc-100 text-zinc-500'
              : lockedOut
                ? 'ui-afford-disabled cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-500'
                : 'border border-orange-200 bg-gradient-to-b from-orange-50 to-amber-50 text-orange-800 shadow-sm active:scale-95'
          }`}
        >
          {maxed ? (
            'Owned'
          ) : showRedCost ? (
            <span>
              <span className="text-red-600 tabular-nums">{cost.toLocaleString()}</span>
              <span> 💰</span>
            </span>
          ) : (
            `${cost.toLocaleString()} 💰`
          )}
        </button>
        <button
          type="button"
          disabled
          className={`flex w-11 shrink-0 flex-col items-center justify-center rounded-md border px-0.5 py-1.5 text-[8px] font-black uppercase leading-none shadow-sm ${
            maxed
              ? 'border-orange-300/80 bg-gradient-to-b from-orange-100 to-amber-100 text-orange-900'
              : 'cursor-default border-zinc-200 bg-zinc-100/90 text-zinc-500'
          }`}
          title={maxed ? 'At maximum level' : `Max level: ${maxLevel}`}
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
    (stat) => coins >= SLIME_UPGRADE_COST(slime.statLevels[stat])
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
