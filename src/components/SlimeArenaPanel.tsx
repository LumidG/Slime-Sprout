import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, HeartCrack, Sword, Wind, Swords, Trophy, FastForward, LogOut } from 'lucide-react';
import type { Slime, SlimeArenaAbility } from '../types';
import {
  ARENA_TEAM_SIZE,
  ARENA_PRE_BATTLE_COUNTDOWN_STEP_MS,
  generateArenaEncounter,
  generateArenaEnemyTeam,
  getArenaStatLabel,
  isArenaAbilityOnCooldown,
  resolveArenaBattle,
  type ArenaEncounter,
} from '../constants';
import { ArenaBattleCanvas, type ArenaBattleStats } from './ArenaBattleCanvas';
import { SlimeStackSprite } from './SlimeStackSprite';
import { useArenaSfx } from '../hooks/useArenaSfx';
import { useCoinCollectSfx } from '../hooks/useCoinCollectSfx';

type ClaimParticle = {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  type: 'coin' | 'ticket';
  delay: number;
};

type Props = {
  slimes: Slime[];
  /** Lifetime arena wins — first encounters scale easier until the player has a few victories. */
  arenaWins: number;
  slimeArenaAbilityCooldownUntil: Record<string, number>;
  now: number;
  /** When true, freezes arena countdown, canvas sim, and battle timer (e.g. app options menu open). */
  optionsMenuOpen?: boolean;
  /** Fires when the timed battle canvas starts / ends (not lineup / results screens). */
  onBattleActiveChange?: (active: boolean) => void;
  /** Ensures the shell shows the Arena tab after a result (claim rewards, try again, or quit). */
  onReturnToArenaTab?: () => void;
  onBattleEnd: (payload: {
    won: boolean;
    encounter: ArenaEncounter;
    teamIds: [string, string, string, string];
    arenaAbilityUserIds: string[];
  }) => void;
  sfxEnabled?: boolean;
  canPlaySfx?: boolean;
};

const emptyTeam = (): (string | null)[] => Array.from({ length: ARENA_TEAM_SIZE }, () => null);

const INITIAL_LIVE_STATS: ArenaBattleStats = {
  hp: Array.from({ length: ARENA_TEAM_SIZE }, () => 1),
  abilityNextProc: {},
  chargeStart: {},
};

export function SlimeArenaPanel({
  slimes,
  arenaWins,
  slimeArenaAbilityCooldownUntil,
  now,
  optionsMenuOpen = false,
  onBattleActiveChange,
  onReturnToArenaTab,
  onBattleEnd,
  sfxEnabled = true,
  canPlaySfx = true,
}: Props) {
  const [encounterSeed, setEncounterSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const encounter = useMemo(
    () => generateArenaEncounter(encounterSeed, arenaWins),
    [encounterSeed, arenaWins]
  );

  const [team, setTeam] = useState<(string | null)[]>(() => emptyTeam());

  const [result, setResult] = useState<{ won: boolean; encounter: ArenaEncounter } | null>(null);

  const sfx = useArenaSfx(canPlaySfx, sfxEnabled, 1);
  const playCoinCollect = useCoinCollectSfx(canPlaySfx, sfxEnabled, 1);

  type BattleSession = {
    encounter: ArenaEncounter;
    playerSlimes: Slime[];
    enemies: ReturnType<typeof generateArenaEnemyTeam>;
    teamIds: [string, string, string, string];
  };

  type ResolveContext = {
    encounter: ArenaEncounter;
    s0: Slime;
    s1: Slime;
    s2: Slime;
    s3: Slime;
    teamIds: [string, string, string, string];
    /** Lifetime wins before this fight — early fights get a small power bonus in {@link resolveArenaBattle}. */
    arenaWinsBeforeBattle: number;
  };

  const [battleSession, setBattleSession] = useState<BattleSession | null>(null);
  /** 3 → 2 → 1 during pre-battle countdown; 0 = fight running; null = not in arena fight. */
  const [preBattleCountdown, setPreBattleCountdown] = useState<number | null>(null);
  const [liveAbilityFired, setLiveAbilityFired] = useState<Record<string, boolean>>({});
  const [battleSpeed, setBattleSpeed] = useState<1 | 2>(1);
  const [liveStats, setLiveStats] = useState<ArenaBattleStats>(INITIAL_LIVE_STATS);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  useEffect(() => {
    if (!battleSession) {
      setLiveStats(INITIAL_LIVE_STATS);
      setShowExitConfirm(false);
    }
  }, [battleSession]);

  useEffect(() => {
    onBattleActiveChange?.(battleSession != null);
  }, [battleSession, onBattleActiveChange]);

  useEffect(() => {
    return () => {
      onBattleActiveChange?.(false);
    };
  }, [onBattleActiveChange]);

  useEffect(() => {
    if (!battleSession) {
      setPreBattleCountdown(null);
      setBattleSpeed(1);
    }
  }, [battleSession]);

  useEffect(() => {
    if (preBattleCountdown === 0 && battleSession) {
      sfx.onBattleStart();
    }
  }, [preBattleCountdown, battleSession, sfx]);

  const resultSfxPlayedRef = useRef(false);
  useEffect(() => {
    if (!result) {
      resultSfxPlayedRef.current = false;
      return;
    }
    if (resultSfxPlayedRef.current) return;
    resultSfxPlayedRef.current = true;
    if (result.won) {
      sfx.onVictory();
    } else {
      sfx.onDefeat();
    }
    // sfx callbacks are stable (useCallback with [] deps) — omitting from deps is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  useEffect(() => {
    if (preBattleCountdown == null || preBattleCountdown <= 0) return;
    if (optionsMenuOpen) return;
    const t = window.setTimeout(() => {
      setPreBattleCountdown((c) => (c != null && c > 0 ? c - 1 : c));
    }, ARENA_PRE_BATTLE_COUNTDOWN_STEP_MS);
    return () => window.clearTimeout(t);
  }, [preBattleCountdown, optionsMenuOpen]);
  const resolveContextRef = useRef<ResolveContext | null>(null);
  const playerAbilityFiredRef = useRef<Record<string, boolean>>({});
  /** Set by onSideDefeated to end the fight; null = still running. */
  const battleEarlyEndRef = useRef<{ won: boolean } | null>(null);

  const lineupIds = useMemo(
    () => team.filter((x): x is string => x != null),
    [team]
  );

  const toggleSlimeInLineup = useCallback(
    (id: string) => {
      if (lineupIds.includes(id)) {
        setTeam((t) => t.map((x) => (x === id ? null : x)));
        return;
      }
      const idx = team.findIndex((x) => x == null);
      if (idx >= 0) {
        setTeam((t) => {
          const n = [...t];
          n[idx] = id;
          return n;
        });
      }
    },
    [lineupIds, team]
  );

  const clearLineup = useCallback(() => {
    setTeam(emptyTeam());
  }, []);

  const canFight =
    team[0] != null &&
    team[1] != null &&
    team[2] != null &&
    team[3] != null &&
    slimes.length >= ARENA_TEAM_SIZE;

  useEffect(() => {
    if (!battleSession || preBattleCountdown !== 0) return;
    let rafId = 0;
    let cancelled = false;
    const step = (_t: number) => {
      if (cancelled) return;
      const earlyEnd = battleEarlyEndRef.current;
      // Battle ends ONLY when one team is fully eliminated (earlyEnd set by onSideDefeated).
      if (!earlyEnd) {
        rafId = requestAnimationFrame(step);
      } else {
        const ctx = resolveContextRef.current;
        setBattleSession(null);
        setLiveAbilityFired({});
        resolveContextRef.current = null;
        if (!ctx) return;
        const abilityUsed: Record<string, boolean> = { ...playerAbilityFiredRef.current };
        playerAbilityFiredRef.current = {};
        const won = earlyEnd.won;
        const arenaAbilityUserIds = Object.keys(abilityUsed).filter((id) => abilityUsed[id]);
        setResult({ won, encounter: ctx.encounter });
        onBattleEnd({
          won,
          encounter: ctx.encounter,
          teamIds: ctx.teamIds,
          arenaAbilityUserIds,
        });
      }
    };
    rafId = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [battleSession, preBattleCountdown, onBattleEnd]);

  const runBattle = () => {
    if (!canFight || !team[0] || !team[1] || !team[2] || !team[3]) return;
    const s0 = slimes.find((x) => x.id === team[0]);
    const s1 = slimes.find((x) => x.id === team[1]);
    const s2 = slimes.find((x) => x.id === team[2]);
    const s3 = slimes.find((x) => x.id === team[3]);
    if (!s0 || !s1 || !s2 || !s3) return;

    const playerSlimes = [s0, s1, s2, s3];
    const enemies = generateArenaEnemyTeam(encounter);
    const teamIds: [string, string, string, string] = [team[0], team[1], team[2], team[3]];

    playerAbilityFiredRef.current = {};
    setLiveAbilityFired({});
    battleEarlyEndRef.current = null;
    resolveContextRef.current = {
      encounter,
      s0,
      s1,
      s2,
      s3,
      teamIds,
      arenaWinsBeforeBattle: arenaWins,
    };

    setBattleSession({
      encounter,
      playerSlimes,
      enemies,
      teamIds,
    });
    setPreBattleCountdown(3);
  };

  const toggleSpeed = useCallback(() => {
    setBattleSpeed((s) => (s === 1 ? 2 : 1));
  }, []);

  const exitBattle = useCallback(() => {
    playerAbilityFiredRef.current = {};
    battleEarlyEndRef.current = null;
    resolveContextRef.current = null;
    setBattleSession(null);
    setLiveAbilityFired({});
    setShowExitConfirm(false);
    setBattleSpeed(1);
    clearLineup();
    onReturnToArenaTab?.();
  }, [clearLineup, onReturnToArenaTab]);

  const closeVictory = useCallback(() => {
    setResult(null);
    setEncounterSeed((s) => s + 1);
    clearLineup();
    onReturnToArenaTab?.();
  }, [clearLineup, onReturnToArenaTab]);

  const closeDefeatTryDifferentTeam = useCallback(() => {
    setResult(null);
    clearLineup();
    onReturnToArenaTab?.();
  }, [clearLineup, onReturnToArenaTab]);

  const closeDefeatQuit = useCallback(() => {
    setResult(null);
    clearLineup();
    onReturnToArenaTab?.();
  }, [clearLineup, onReturnToArenaTab]);

  const [claimParticles, setClaimParticles] = useState<ClaimParticle[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const coinTileRef = useRef<HTMLDivElement>(null);
  const ticketTileRef = useRef<HTMLDivElement>(null);
  const particleIdRef = useRef(0);

  // Reset collecting state whenever the result disappears.
  useEffect(() => {
    if (!result) {
      setIsCollecting(false);
      setClaimParticles([]);
    }
  }, [result]);

  const handleClaimRewards = useCallback(() => {
    if (isCollecting) return;
    setIsCollecting(true);

    const backdrop = backdropRef.current;
    const coinTile = coinTileRef.current;
    const ticketTile = ticketTileRef.current;
    const newParticles: ClaimParticle[] = [];

    const backdropH = backdrop ? backdrop.getBoundingClientRect().height : 600;

    const spawnFromTile = (
      tileEl: HTMLDivElement | null,
      type: 'coin' | 'ticket',
      count: number
    ) => {
      if (!backdrop || !tileEl) return;
      const br = backdrop.getBoundingClientRect();
      const tr = tileEl.getBoundingClientRect();
      const cx = tr.left + tr.width / 2 - br.left;
      const cy = tr.top + tr.height / 2 - br.top;
      for (let i = 0; i < count; i++) {
        const startX = cx + (Math.random() - 0.5) * tr.width * 0.55;
        const startY = cy + (Math.random() - 0.5) * tr.height * 0.55;
        // Fly all the way to (or past) the top of the backdrop — like coins racing to the counter
        const endY = -Math.max(backdropH * 0.15, startY + 40) - Math.random() * 80;
        newParticles.push({
          id: particleIdRef.current++,
          startX,
          startY,
          endX: startX + (Math.random() - 0.5) * 160,
          endY,
          type,
          delay: Math.random() * 0.22,
        });
      }
    };

    spawnFromTile(coinTile, 'coin', 12);
    spawnFromTile(ticketTile, 'ticket', 7);
    setClaimParticles(newParticles);

    // Staggered chimes matching the particle burst — mirrors the main-screen coin collect SFX
    playCoinCollect(1);
    [110, 230, 360, 500].forEach((ms) => setTimeout(() => playCoinCollect(1), ms));

    setTimeout(() => {
      setClaimParticles([]);
      closeVictory();
    }, 980);
  }, [isCollecting, closeVictory, playCoinCollect]);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden uppercase">
      <div className="shrink-0 space-y-2 border-b border-violet-200/80 bg-gradient-to-b from-violet-50 via-white to-orange-50/40 px-3 pb-2 pt-3">
        <div className="flex flex-col items-center gap-0.5">
          <Swords className="h-7 w-7 text-violet-600 drop-shadow-sm" aria-hidden />
          <h2 className="text-base font-black uppercase tracking-widest text-emerald-950">Slime Arena</h2>
          <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-100 to-purple-100 px-2.5 py-0.5 ring-1 ring-violet-200/80">
            <Trophy className="h-2.5 w-2.5 shrink-0 text-violet-500" aria-hidden />
            <span className="text-[9px] font-black uppercase tracking-wide text-violet-700">
              Arena Lvl {arenaWins + 1}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-violet-200/90 bg-white/90 p-2 shadow-sm">
          <motion.p
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
            className="mb-1 text-center text-[9px] font-bold uppercase tracking-wider text-emerald-600/90"
          >
            recommended focus
          </motion.p>
          <div className="flex flex-wrap justify-center gap-1.5">
            <span className="rounded-full bg-gradient-to-r from-orange-100 to-amber-100 px-2 py-1 text-[9px] font-black text-orange-900 ring-1 ring-orange-200/80">
              Best — {getArenaStatLabel(encounter.primaryStat)}
            </span>
            <span className="rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 px-2 py-1 text-[9px] font-black text-emerald-900 ring-1 ring-emerald-200/70">
              Next — {getArenaStatLabel(encounter.secondaryStat)}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-violet-100/80 pt-2">
          <p className="text-[8px] font-black uppercase tracking-wider text-emerald-800">
            Your team ({ARENA_TEAM_SIZE})
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {team.map((id, i) => {
              const lineSlime = id ? slimes.find((s) => s.id === id) : null;
              return (
              <button
                key={`tm-${i}`}
                type="button"
                onClick={() => id && toggleSlimeInLineup(id)}
                className="flex min-h-[4.5rem] w-[4rem] flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-200 bg-white/90 py-1.5 shadow-sm transition-all"
              >
                {id ? (
                  <>
                    {lineSlime && (
                      <SlimeStackSprite slime={lineSlime} size="sm" className="mb-1 ring-2 ring-white" />
                    )}
                    <span className="max-w-full truncate px-0.5 text-[7px] font-black leading-tight text-zinc-700">
                      {lineSlime?.name ?? '?'}
                    </span>
                  </>
                ) : (
                  <span className="text-[9px] font-black text-violet-300">{i + 1}</span>
                )}
              </button>
            );
            })}
          </div>
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-2">
        <p className="mb-1.5 text-[8px] font-black uppercase tracking-wider text-emerald-800">Your slimes</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[...slimes].sort((a, b) =>
            (b.stats.health + b.stats.strength + b.stats.agility) -
            (a.stats.health + a.stats.strength + a.stats.agility)
          ).map((slime) => {
            const inLineup = lineupIds.includes(slime.id);
            return (
              <button
                key={slime.id}
                type="button"
                onClick={() => toggleSlimeInLineup(slime.id)}
                className={`relative flex flex-col items-center gap-0.5 overflow-hidden rounded-xl border-2 p-1.5 py-2 transition-all ${
                  inLineup
                    ? 'border-violet-400 bg-gradient-to-b from-violet-100 to-white shadow-md ring-2 ring-violet-300/40'
                    : 'border-emerald-50 bg-white shadow-sm hover:border-violet-200'
                }`}
              >
                {inLineup && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[8px] font-black leading-none text-white shadow">
                    {lineupIds.indexOf(slime.id) + 1}
                  </span>
                )}
                <SlimeStackSprite slime={slime} size="md" className="shadow-inner" />
                <div className="w-full truncate text-center text-[8px] font-black leading-none text-gray-800">{slime.name}</div>
                <div className="flex w-full items-center justify-center gap-1.5 px-0.5">
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
              </button>
            );
          })}
        </div>

        {slimes.length < ARENA_TEAM_SIZE && (
          <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 px-3 py-8 text-center">
            <p className="text-[10px] font-bold text-violet-700">
              Need at least {ARENA_TEAM_SIZE} slimes to enter the arena.
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-violet-100/90 bg-gradient-to-r from-white via-violet-50/30 to-orange-50/40 px-3 py-2 backdrop-blur-md">
        <div className="mx-auto flex justify-center">
          <button
            type="button"
            onClick={runBattle}
            disabled={!canFight || !!battleSession}
            className="ui-afford-disabled min-h-12 rounded-xl border-2 border-violet-500 bg-gradient-to-br from-violet-500 to-purple-700 px-6 py-2.5 text-base font-black text-white shadow-md shadow-violet-900/20 transition-all hover:brightness-105 disabled:border-zinc-300 disabled:from-zinc-200 disabled:to-zinc-300 disabled:text-zinc-600 disabled:shadow-none"
          >
            Start battle
          </button>
        </div>
      </div>

      <AnimatePresence>
        {battleSession && (
          <motion.div
            key="arena-fight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[115] flex min-h-0 flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-violet-950 to-slate-900"
          >
            <div className="shrink-0 border-b border-violet-500/30 bg-black/20 px-3 py-2 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200/90">Arena</p>
            </div>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <AnimatePresence>
                {preBattleCountdown != null && preBattleCountdown > 0 && (
                  <motion.div
                    key={preBattleCountdown}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.2, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-slate-950/35"
                  >
                    <span className="select-none text-7xl font-black tabular-nums text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]">
                      {preBattleCountdown}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              <ArenaBattleCanvas
                key={`${battleSession.teamIds.join('-')}-${battleSession.encounter.seed}`}
                playerSlimes={battleSession.playerSlimes}
                enemies={battleSession.enemies}
                playerAbilityFiredRef={playerAbilityFiredRef}
                onAbilityFired={(id) => setLiveAbilityFired((p) => ({ ...p, [id]: true }))}
                onSideDefeated={(side) => {
                  if (battleEarlyEndRef.current === null) {
                    battleEarlyEndRef.current = { won: side === 'enemy' };
                  }
                }}
                paused={
                  (preBattleCountdown != null && preBattleCountdown > 0) || optionsMenuOpen || showExitConfirm
                }
                speedMultiplier={battleSpeed}
                onHit={sfx.onHit}
                onDodge={sfx.onDodge}
                onAbility={sfx.onAbility}
                onStatsUpdate={setLiveStats}
              />
            </div>
            {preBattleCountdown === 0 && (
              <div className="shrink-0 flex items-center justify-center gap-3 px-4 py-2.5">
                <button
                  type="button"
                  onClick={toggleSpeed}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-black uppercase tracking-wide transition-all ${
                    battleSpeed === 2
                      ? 'bg-amber-400 text-amber-950 shadow-lg shadow-amber-900/30'
                      : 'bg-white/15 text-violet-100 hover:bg-white/25'
                  }`}
                >
                  <FastForward className="h-4 w-4" aria-hidden />
                  {battleSpeed === 2 ? '2× On' : '2× Speed'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowExitConfirm(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-white/15 px-4 py-3 text-sm font-black uppercase tracking-wide text-rose-300 transition-all hover:bg-rose-500/25"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}
            {/* Exit battle confirmation overlay */}
            <AnimatePresence>
              {showExitConfirm && (
                <motion.div
                  key="exit-confirm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.85, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    className="mx-6 rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl"
                  >
                    <div className="mb-1 flex items-center justify-center">
                      <div className="rounded-full bg-rose-500/20 p-3">
                        <LogOut className="h-6 w-6 text-rose-400" aria-hidden />
                      </div>
                    </div>
                    <h3 className="mt-3 text-center text-lg font-black text-white">Exit Battle?</h3>
                    <p className="mt-1.5 text-center text-sm text-violet-200/70">
                      You'll forfeit this fight with no rewards.
                    </p>
                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowExitConfirm(false)}
                        className="flex flex-1 items-center justify-center rounded-xl bg-white/10 py-3 text-sm font-black uppercase tracking-wide text-violet-100 transition-all hover:bg-white/20"
                      >
                        Keep Fighting
                      </button>
                      <button
                        type="button"
                        onClick={exitBattle}
                        className="flex flex-1 items-center justify-center rounded-xl bg-rose-500 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-rose-900/40 transition-all hover:bg-rose-400"
                      >
                        Exit
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="shrink-0 border-t border-violet-500/20 bg-black/30 px-2 pb-2 pt-1.5">
              <div className="grid grid-cols-4 gap-x-1.5">
                {battleSession.playerSlimes.map((slime, i) => {
                  const hpRatio = Math.max(0, Math.min(1, liveStats.hp[i] ?? 1));
                  const maxHp = slime.stats.health;
                  const curHp = Math.max(0, Math.round(hpRatio * maxHp));
                  const isDead = hpRatio <= 0;

                  const hasAbility = slime.arenaAbility !== 'None';
                  const nextProc = liveStats.abilityNextProc[slime.id];
                  const chargeStart = liveStats.chargeStart[slime.id];
                  const nowMs = Date.now();

                  let chargeProgress = 0;
                  let countdownSec = 0;
                  let isUltReady = false;
                  if (hasAbility && nextProc !== undefined && chargeStart !== undefined) {
                    const totalChargeTime = Math.max(1, nextProc - chargeStart);
                    chargeProgress = Math.min(1, Math.max(0, nowMs - chargeStart) / totalChargeTime);
                    const remaining = Math.max(0, nextProc - nowMs);
                    countdownSec = remaining / 1000;
                    isUltReady = remaining <= 0;
                  }

                  const hpBarColor =
                    hpRatio > 0.5 ? '#34d399' : hpRatio > 0.25 ? '#fbbf24' : '#fb7185';

                  return (
                    <div
                      key={slime.id}
                      className={`flex min-w-0 flex-col gap-[3px] ${isDead ? 'opacity-35' : ''}`}
                    >
                      {/* Name */}
                      <p className="truncate text-center text-[6.5px] font-black uppercase tracking-tight text-violet-100/80">
                        {slime.name}
                      </p>

                      {/* HP bar with number inside */}
                      <div className="relative h-[14px] w-full overflow-hidden rounded bg-black/60 ring-1 ring-white/10">
                        <div
                          className="absolute inset-y-0 left-0 rounded"
                          style={{ width: `${Math.round(hpRatio * 100)}%`, background: hpBarColor, transition: 'width 0.1s linear' }}
                        />
                        <span className="relative flex h-full items-center justify-center text-[6.5px] font-black tabular-nums leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">
                          {isDead ? 'KO' : `${curHp}/${maxHp}`}
                        </span>
                      </div>

                      {hasAbility ? (
                        <>
                          {/* Energy bar */}
                          <div className="h-[4px] w-full overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
                            <div
                              className={`h-full rounded-full ${isUltReady ? 'bg-amber-400' : 'bg-violet-400'}`}
                              style={{ width: `${Math.round(chargeProgress * 100)}%`, transition: 'width 0.1s linear' }}
                            />
                          </div>
                          {/* Countdown */}
                          <p
                            className={`text-center text-[6.5px] font-black tabular-nums leading-none ${
                              isUltReady ? 'text-amber-300' : 'text-violet-300/70'
                            }`}
                          >
                            {isUltReady ? 'ULT!' : countdownSec < 100 ? `${countdownSec.toFixed(1)}s` : '—'}
                          </p>
                        </>
                      ) : (
                        <p className="text-center text-[6.5px] leading-none text-zinc-600">—</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div
            ref={backdropRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[120] flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm"
            onClick={() => {
              if (result.won) {
                if (!isCollecting) closeVictory();
              } else {
                closeDefeatTryDifferentTeam();
              }
            }}
          >
            {/* Claim particles — absolute within the backdrop */}
            {claimParticles.map((p) => (
              <motion.div
                key={p.id}
                className="pointer-events-none absolute z-10"
                style={{ left: p.startX, top: p.startY }}
                initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                animate={{ x: p.endX - p.startX, y: p.endY - p.startY, scale: 0.1, opacity: 0 }}
                transition={{ duration: 0.85, ease: 'easeOut', delay: p.delay }}
              >
                {p.type === 'coin' ? (
                  <div className="relative flex h-7 w-7 items-center justify-center">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg ring-2 ring-amber-200" />
                    <div className="absolute h-3.5 w-3.5 rounded-full border-2 border-amber-600/60" />
                    <div className="absolute -left-0.5 -top-0.5 h-2 w-2 rounded-full bg-white/60" />
                  </div>
                ) : (
                  <span className="text-2xl drop-shadow-md">🎟️</span>
                )}
              </motion.div>
            ))}

            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              role="dialog"
              aria-modal="true"
              className="w-full max-w-xs overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-b from-white to-orange-50/50 p-6 shadow-2xl ring-2 ring-violet-200/60"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-400" />
              {result.won ? (
                <>
                  <div className="mb-3 flex justify-center">
                    <motion.div
                      animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.12, 1] }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className="rounded-full bg-gradient-to-br from-amber-100 to-orange-200 p-3.5 ring-2 ring-amber-300/70"
                    >
                      <Trophy className="h-9 w-9 text-orange-600" aria-hidden />
                    </motion.div>
                  </div>
                  <h3 className="mb-3 text-center text-xl font-black text-emerald-950">Victory!</h3>

                  {/* Reward tiles */}
                  <div className="mb-4 flex gap-3">
                    {/* Coins tile */}
                    <div
                      ref={coinTileRef}
                      className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border-2 border-amber-300/80 bg-gradient-to-b from-amber-50 to-orange-100 px-2 py-3 shadow-sm"
                    >
                      <div className="relative flex h-14 w-14 items-center justify-center">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg ring-4 ring-amber-200" />
                        <div className="absolute h-7 w-7 rounded-full border-4 border-amber-600/50" />
                        <div className="absolute left-2.5 top-2 h-3.5 w-3.5 rounded-full bg-white/55" />
                      </div>
                      <span className="text-2xl font-black tabular-nums leading-none text-amber-900">
                        {result.encounter.rewardCoins.toLocaleString()}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">
                        Coins
                      </span>
                    </div>

                    {/* Tickets tile */}
                    <div
                      ref={ticketTileRef}
                      className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border-2 border-violet-300/80 bg-gradient-to-b from-violet-50 to-purple-100 px-2 py-3 shadow-sm"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-300 to-purple-500 shadow-lg ring-4 ring-violet-200 text-4xl leading-none">
                        🎟️
                      </div>
                      <span className="text-2xl font-black tabular-nums leading-none text-violet-900">
                        {result.encounter.rewardTickets}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-violet-700">
                        {result.encounter.rewardTickets === 1 ? 'Ticket' : 'Tickets'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3 flex justify-center">
                    <div className="rounded-full bg-zinc-200 p-4 ring-2 ring-zinc-400/50">
                      <HeartCrack className="h-10 w-10 text-zinc-700" aria-hidden />
                    </div>
                  </div>
                  <h3 className="mb-1 text-center text-xl font-black text-zinc-800">Defeat</h3>
                  <p className="mb-4 text-center text-sm font-semibold text-zinc-600">
                    Pick another team and try again, or leave the arena.
                  </p>
                </>
              )}
              {result.won ? (
                <button
                  type="button"
                  onClick={handleClaimRewards}
                  disabled={isCollecting}
                  className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-purple-800 py-3.5 text-base font-black text-white shadow-lg disabled:opacity-60"
                >
                  {isCollecting ? 'Collecting…' : 'Claim rewards'}
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={closeDefeatTryDifferentTeam}
                    className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-purple-800 py-3.5 text-base font-black text-white shadow-lg"
                  >
                    Try a different team
                  </button>
                  <button
                    type="button"
                    onClick={closeDefeatQuit}
                    className="w-full rounded-2xl border-2 border-zinc-300 bg-white/90 py-3 text-base font-black text-zinc-700 shadow-sm"
                  >
                    Quit
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
