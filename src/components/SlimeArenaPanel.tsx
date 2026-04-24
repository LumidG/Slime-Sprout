import React, { useMemo, useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, HeartCrack, Sword, Wind, Swords, Coins, Zap } from 'lucide-react';
import type { Slime, SlimeArenaAbility } from '../types';
import {
  ARENA_TEAM_SIZE,
  ARENA_ABILITY_META,
  ARENA_BATTLE_DURATION_MS,
  ARENA_PRE_BATTLE_COUNTDOWN_STEP_MS,
  generateArenaEncounter,
  generateArenaEnemyTeam,
  getArenaStatLabel,
  resolveArenaBattle,
  isArenaAbilityOnCooldown,
  type ArenaEncounter,
} from '../constants';
import { ArenaBattleCanvas } from './ArenaBattleCanvas';
import { SlimeStackSprite } from './SlimeStackSprite';

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
};

function formatCooldown(ms: number): string {
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function AbilityCooldownRow({
  ability,
  label,
  cooldownLeftMs,
  maxCooldownMs,
  battleMode,
  usedThisFight,
}: {
  ability: SlimeArenaAbility;
  label: string;
  cooldownLeftMs: number;
  maxCooldownMs: number;
  battleMode: boolean;
  usedThisFight: boolean;
}) {
  if (ability === 'None') {
    return (
      <div className="mb-1 flex h-5 w-full items-center justify-center rounded-md bg-zinc-800/40 px-1 text-[7px] font-bold text-zinc-500">
        No ability
      </div>
    );
  }
  const ready = cooldownLeftMs <= 0;
  const fill = ready ? 1 : maxCooldownMs > 0 ? Math.max(0, 1 - cooldownLeftMs / maxCooldownMs) : 0;
  return (
    <div className="mb-1 w-full space-y-0.5">
      <div className="flex items-center justify-between gap-1 px-0.5 text-[7px] font-black uppercase tracking-tight text-violet-100/90">
        <span className="flex min-w-0 items-center gap-0.5 truncate">
          <Zap className="h-2.5 w-2.5 shrink-0 text-amber-300" aria-hidden />
          <span className="truncate">{label}</span>
        </span>
        {battleMode && usedThisFight ? (
          <span className="shrink-0 text-amber-200">Go!</span>
        ) : ready ? (
          <span className="shrink-0 text-emerald-300">Ready</span>
        ) : (
          <span className="shrink-0 text-amber-100/90">{formatCooldown(cooldownLeftMs)}</span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/80 ring-1 ring-white/10">
        <div
          className={`h-full rounded-full transition-[width] ${ready ? 'bg-emerald-400' : 'bg-violet-400'}`}
          style={{ width: `${Math.round(fill * 100)}%` }}
        />
      </div>
    </div>
  );
}

const emptyTeam = (): (string | null)[] => Array.from({ length: ARENA_TEAM_SIZE }, () => null);

export function SlimeArenaPanel({
  slimes,
  arenaWins,
  slimeArenaAbilityCooldownUntil,
  now,
  optionsMenuOpen = false,
  onBattleActiveChange,
  onReturnToArenaTab,
  onBattleEnd,
}: Props) {
  const [encounterSeed, setEncounterSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const encounter = useMemo(
    () => generateArenaEncounter(encounterSeed, arenaWins),
    [encounterSeed, arenaWins]
  );

  const [team, setTeam] = useState<(string | null)[]>(() => emptyTeam());

  const [result, setResult] = useState<{ won: boolean; encounter: ArenaEncounter } | null>(null);

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

  useEffect(() => {
    onBattleActiveChange?.(battleSession != null);
  }, [battleSession, onBattleActiveChange]);

  useEffect(() => {
    return () => {
      onBattleActiveChange?.(false);
    };
  }, [onBattleActiveChange]);

  useEffect(() => {
    if (!battleSession) setPreBattleCountdown(null);
  }, [battleSession]);

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
  /** Wall-time spent in menu pause; subtracted from rAF elapsed so the fight does not end while paused. */
  const battlePausedMsAccumRef = useRef(0);
  const battlePauseStartedAtRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!battleSession) {
      battlePausedMsAccumRef.current = 0;
      battlePauseStartedAtRef.current = null;
      return;
    }
    if (preBattleCountdown !== 0) return;
    if (optionsMenuOpen) {
      if (battlePauseStartedAtRef.current === null) {
        battlePauseStartedAtRef.current = performance.now();
      }
    } else if (battlePauseStartedAtRef.current !== null) {
      battlePausedMsAccumRef.current += performance.now() - battlePauseStartedAtRef.current;
      battlePauseStartedAtRef.current = null;
    }
  }, [optionsMenuOpen, battleSession, preBattleCountdown]);

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
    const start = performance.now();
    const step = (t: number) => {
      if (cancelled) return;
      const wallElapsed = t - start;
      const currentMenuPause =
        battlePauseStartedAtRef.current !== null ? t - battlePauseStartedAtRef.current : 0;
      const fightElapsed = wallElapsed - battlePausedMsAccumRef.current - currentMenuPause;
      const p = Math.min(1, fightElapsed / ARENA_BATTLE_DURATION_MS);
      if (p < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        const ctx = resolveContextRef.current;
        setBattleSession(null);
        setLiveAbilityFired({});
        resolveContextRef.current = null;
        if (!ctx) return;
        const abilityUsed: Record<string, boolean> = { ...playerAbilityFiredRef.current };
        playerAbilityFiredRef.current = {};
        const { won } = resolveArenaBattle(
          ctx.encounter,
          [ctx.s0, ctx.s1, ctx.s2, ctx.s3],
          abilityUsed,
          ctx.arenaWinsBeforeBattle
        );
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

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden uppercase">
      <div className="shrink-0 space-y-2 border-b border-violet-200/80 bg-gradient-to-b from-violet-50 via-white to-orange-50/40 px-3 pb-2 pt-3">
        <div className="flex flex-col items-center gap-0.5">
          <Swords className="h-7 w-7 text-violet-600 drop-shadow-sm" aria-hidden />
          <h2 className="text-base font-black uppercase tracking-widest text-emerald-950">Slime Arena</h2>
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
        <p className="mb-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-800">Your slimes</p>
        <p className="mb-1.5 text-[8px] font-semibold text-emerald-800/70">
          Tap to fill your team in order (slot 1 → {ARENA_TEAM_SIZE}).
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {slimes.map((slime) => {
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
                paused={
                  (preBattleCountdown != null && preBattleCountdown > 0) || optionsMenuOpen
                }
              />
            </div>
            <div className="shrink-0 border-t border-violet-500/20 bg-black/30 px-2 py-2">
              <div className="grid max-h-[88px] grid-cols-2 gap-x-2 gap-y-1 overflow-y-auto no-scrollbar">
                <div className="space-y-1">
                  {battleSession.playerSlimes.map((slime) => {
                    const meta = ARENA_ABILITY_META[slime.arenaAbility];
                    const onCd = isArenaAbilityOnCooldown(slimeArenaAbilityCooldownUntil, slime.id, now);
                    const cdLeft = onCd ? Math.max(0, (slimeArenaAbilityCooldownUntil[slime.id] ?? 0) - now) : 0;
                    const used = Boolean(liveAbilityFired[slime.id]);
                    return (
                      <div key={slime.id} className="rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-1.5 py-1">
                        <p className="mb-0.5 truncate text-[7px] font-black text-emerald-100/90">{slime.name}</p>
                        <AbilityCooldownRow
                          ability={slime.arenaAbility}
                          label={meta.name}
                          cooldownLeftMs={used ? 0 : cdLeft}
                          maxCooldownMs={meta.cooldownMs}
                          battleMode
                          usedThisFight={used}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-1">
                  {battleSession.enemies.map((foe) => {
                    const meta = ARENA_ABILITY_META[foe.ability];
                    return (
                      <div key={foe.id} className="rounded-lg border border-rose-500/20 bg-rose-950/30 px-1.5 py-1">
                        <p className="mb-0.5 truncate text-[7px] font-black text-rose-100/90">{foe.name}</p>
                        <AbilityCooldownRow
                          ability={foe.ability}
                          label={meta.name}
                          cooldownLeftMs={0}
                          maxCooldownMs={meta.cooldownMs || 1}
                          battleMode
                          usedThisFight={Boolean(liveAbilityFired[foe.id])}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[120] flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm"
            onClick={result.won ? closeVictory : closeDefeatTryDifferentTeam}
          >
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
                    <div className="rounded-full bg-gradient-to-br from-amber-100 to-orange-200 p-4 ring-2 ring-amber-300/70">
                      <Coins className="h-10 w-10 text-orange-700" aria-hidden />
                    </div>
                  </div>
                  <h3 className="mb-1 text-center text-xl font-black text-emerald-950">Victory!</h3>
                  <p className="mb-4 text-center text-sm font-semibold text-emerald-800/85">
                    Your squad earned{' '}
                    <span className="font-black text-orange-700">{result.encounter.rewardCoins.toLocaleString()}</span>{' '}
                    coins.
                  </p>
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
                  onClick={closeVictory}
                  className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-purple-800 py-3.5 text-base font-black text-white shadow-lg"
                >
                  Claim rewards
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
