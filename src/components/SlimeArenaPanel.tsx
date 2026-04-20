import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Sword, Wind, Swords, HelpCircle, Coins, Timer, Zap } from 'lucide-react';
import type { Slime, SlimeArenaAbility } from '../types';
import {
  ARENA_RESERVES,
  ARENA_STARTERS,
  ARENA_ABILITY_META,
  generateArenaEncounter,
  generateArenaEnemyTeam,
  getArenaStatLabel,
  resolveArenaBattle,
  isSlimeOnCooldown,
  isArenaAbilityOnCooldown,
  type ArenaEncounter,
} from '../constants';
import { ArenaBattleCanvas } from './ArenaBattleCanvas';

const BATTLE_MS = 2800;

type Props = {
  slimes: Slime[];
  slimeCooldownUntil: Record<string, number>;
  slimeArenaAbilityCooldownUntil: Record<string, number>;
  now: number;
  onBattleEnd: (payload: {
    won: boolean;
    encounter: ArenaEncounter;
    starterIds: [string, string, string];
    reserveIds: [string | undefined, string | undefined];
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

export function SlimeArenaPanel({ slimes, slimeCooldownUntil, slimeArenaAbilityCooldownUntil, now, onBattleEnd }: Props) {
  const [encounterSeed, setEncounterSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const encounter = useMemo(() => generateArenaEncounter(encounterSeed), [encounterSeed]);

  const [starters, setStarters] = useState<(string | null)[]>(() => [null, null, null]);
  const [reserves, setReserves] = useState<(string | null)[]>(() => [null, null]);

  const [result, setResult] = useState<{ won: boolean; encounter: ArenaEncounter } | null>(null);

  type BattleSession = {
    encounter: ArenaEncounter;
    playerSlimes: Slime[];
    enemies: ReturnType<typeof generateArenaEnemyTeam>;
    starterIds: [string, string, string];
    reserveIds: [string | undefined, string | undefined];
  };

  type ResolveContext = {
    encounter: ArenaEncounter;
    s0: Slime;
    s1: Slime;
    s2: Slime;
    r0: Slime | undefined;
    r1: Slime | undefined;
    starterIds: [string, string, string];
    reserveIds: [string | undefined, string | undefined];
  };

  const [battleSession, setBattleSession] = useState<BattleSession | null>(null);
  const [liveAbilityFired, setLiveAbilityFired] = useState<Record<string, boolean>>({});
  const resolveContextRef = useRef<ResolveContext | null>(null);
  const playerAbilityFiredRef = useRef<Record<string, boolean>>({});

  const lineupIds = useMemo(
    () => [...starters, ...reserves].filter((x): x is string => x != null),
    [starters, reserves]
  );

  const toggleSlimeInLineup = useCallback(
    (id: string) => {
      if (lineupIds.includes(id)) {
        setStarters((s) => s.map((x) => (x === id ? null : x)));
        setReserves((r) => r.map((x) => (x === id ? null : x)));
        return;
      }
      const idx = starters.findIndex((x) => x == null);
      if (idx >= 0) {
        setStarters((s) => {
          const n = [...s];
          n[idx] = id;
          return n;
        });
        return;
      }
      const ridx = reserves.findIndex((x) => x == null);
      if (ridx >= 0) {
        setReserves((r) => {
          const n = [...r];
          n[ridx] = id;
          return n;
        });
      }
    },
    [lineupIds, starters, reserves]
  );

  const clearLineup = useCallback(() => {
    setStarters([null, null, null]);
    setReserves([null, null]);
  }, []);

  const canFight =
    starters[0] != null && starters[1] != null && starters[2] != null && slimes.length >= 3;

  useEffect(() => {
    if (!battleSession) return;
    let rafId = 0;
    let cancelled = false;
    const start = performance.now();
    const step = (t: number) => {
      if (cancelled) return;
      const p = Math.min(1, (t - start) / BATTLE_MS);
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
        const { won } = resolveArenaBattle(ctx.encounter, [ctx.s0, ctx.s1, ctx.s2], [ctx.r0, ctx.r1], abilityUsed);
        const arenaAbilityUserIds = Object.keys(abilityUsed).filter((id) => abilityUsed[id]);
        setResult({ won, encounter: ctx.encounter });
        onBattleEnd({
          won,
          encounter: ctx.encounter,
          starterIds: ctx.starterIds,
          reserveIds: ctx.reserveIds,
          arenaAbilityUserIds,
        });
      }
    };
    rafId = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [battleSession, onBattleEnd]);

  const runBattle = () => {
    if (!canFight || !starters[0] || !starters[1] || !starters[2]) return;
    const s0 = slimes.find((x) => x.id === starters[0]);
    const s1 = slimes.find((x) => x.id === starters[1]);
    const s2 = slimes.find((x) => x.id === starters[2]);
    if (!s0 || !s1 || !s2) return;
    const r0 = reserves[0] ? slimes.find((x) => x.id === reserves[0]) : undefined;
    const r1 = reserves[1] ? slimes.find((x) => x.id === reserves[1]) : undefined;

    const consider = [s0, s1, s2, r0, r1].filter((x): x is Slime => x != null);
    const playerSlimes = consider;
    const enemies = generateArenaEnemyTeam(encounter);

    playerAbilityFiredRef.current = {};
    setLiveAbilityFired({});
    resolveContextRef.current = {
      encounter,
      s0,
      s1,
      s2,
      r0,
      r1,
      starterIds: [starters[0], starters[1], starters[2]],
      reserveIds: [reserves[0] ?? undefined, reserves[1] ?? undefined],
    };

    setBattleSession({
      encounter,
      playerSlimes,
      enemies,
      starterIds: [starters[0], starters[1], starters[2]],
      reserveIds: [reserves[0] ?? undefined, reserves[1] ?? undefined],
    });
  };

  const dismissResult = () => {
    setResult(null);
    if (result?.won) {
      setEncounterSeed((s) => s + 1);
    }
    clearLineup();
  };

  const hpPlayerDisplay = battleSession ? battleSession.playerSlimes.map(() => 1) : [];
  const hpEnemyDisplay = battleSession ? battleSession.enemies.map(() => 1) : [];

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 border-b border-violet-200/80 bg-gradient-to-b from-violet-50 via-white to-orange-50/40 px-4 pb-4 pt-5">
        <div className="flex flex-col items-center gap-1">
          <Swords className="h-9 w-9 text-violet-600 drop-shadow-sm" aria-hidden />
          <h2 className="text-lg font-black uppercase tracking-widest text-emerald-950">Slime Arena</h2>
          <p className="text-center text-[10px] font-semibold leading-snug text-emerald-800/75">
            Mystery opponents — pick a squad. This fight favors certain stats.
          </p>
        </div>

        <div className="rounded-2xl border border-violet-200/90 bg-white/90 p-3 shadow-sm">
          <p className="mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-violet-700">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
            Recommended focus
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-gradient-to-r from-orange-100 to-amber-100 px-3 py-1.5 text-[10px] font-black text-orange-900 ring-1 ring-orange-200/80">
              Best — {getArenaStatLabel(encounter.primaryStat)}
            </span>
            <span className="rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-1.5 text-[10px] font-black text-emerald-900 ring-1 ring-emerald-200/70">
              Next — {getArenaStatLabel(encounter.secondaryStat)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-200/80 bg-violet-50/40 py-4">
          {[0, 1, 2].map((i) => (
            <div key={`myst-${i}`} className="flex flex-col items-center gap-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-300 to-zinc-500 shadow-inner ring-2 ring-white/50">
                <Swords className="h-7 w-7 text-white/90" aria-hidden />
              </div>
              <span className="text-[8px] font-black uppercase tracking-tight text-zinc-500">Rival {i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 no-scrollbar">
        <div className="mb-3 space-y-2">
          <p className="text-[9px] font-black uppercase tracking-wider text-emerald-800">Starters ({ARENA_STARTERS})</p>
          <div className="flex justify-center gap-2">
            {starters.map((id, i) => (
              <button
                key={`st-${i}`}
                type="button"
                onClick={() => id && toggleSlimeInLineup(id)}
                className="flex h-16 w-[4.5rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-white/90 shadow-sm transition-all"
              >
                {id ? (
                  <>
                    <div
                      className="mb-0.5 h-9 w-9 rounded-full shadow-inner ring-2 ring-white"
                      style={{ backgroundColor: slimes.find((s) => s.id === id)?.color ?? '#ccc' }}
                    />
                    <span className="max-w-full truncate px-0.5 text-[7px] font-black text-zinc-700">
                      {slimes.find((s) => s.id === id)?.name ?? '?'}
                    </span>
                  </>
                ) : (
                  <span className="text-[9px] font-black text-violet-300">{i + 1}</span>
                )}
              </button>
            ))}
          </div>
          <p className="text-[9px] font-black uppercase tracking-wider text-emerald-800">Reserves ({ARENA_RESERVES}, optional)</p>
          <div className="flex justify-center gap-2">
            {reserves.map((id, i) => (
              <button
                key={`rs-${i}`}
                type="button"
                onClick={() => id && toggleSlimeInLineup(id)}
                className="flex h-14 w-[4.5rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200/90 bg-amber-50/50 shadow-sm"
              >
                {id ? (
                  <>
                    <div
                      className="mb-0.5 h-8 w-8 rounded-full shadow-inner ring-2 ring-white"
                      style={{ backgroundColor: slimes.find((s) => s.id === id)?.color ?? '#ccc' }}
                    />
                    <span className="max-w-full truncate px-0.5 text-[7px] font-black text-zinc-700">
                      {slimes.find((s) => s.id === id)?.name ?? '?'}
                    </span>
                  </>
                ) : (
                  <span className="text-[8px] font-bold text-amber-300/90">Empty</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-2 text-[9px] font-black uppercase tracking-wider text-emerald-800">Your slimes</p>
        <div className="grid grid-cols-3 gap-2 pb-24">
          {slimes.map((slime) => {
            const inLineup = lineupIds.includes(slime.id);
            const cd = isSlimeOnCooldown(slimeCooldownUntil, slime.id, now);
            const cdLeft = cd ? Math.max(0, (slimeCooldownUntil[slime.id] ?? 0) - now) : 0;
            return (
              <button
                key={slime.id}
                type="button"
                onClick={() => toggleSlimeInLineup(slime.id)}
                className={`relative flex flex-col items-center gap-1 overflow-hidden rounded-2xl border-2 p-2 py-2.5 transition-all ${
                  inLineup
                    ? 'border-violet-400 bg-gradient-to-b from-violet-100 to-white shadow-md ring-2 ring-violet-300/40'
                    : 'border-emerald-50 bg-white shadow-sm hover:border-violet-200'
                }`}
              >
                {cd && (
                  <div className="absolute right-0.5 top-0.5 flex items-center gap-0.5 rounded-full bg-zinc-800/90 px-1 py-0.5 text-[7px] font-black text-amber-100">
                    <Timer className="h-2.5 w-2.5" aria-hidden />
                    {formatCooldown(cdLeft)}
                  </div>
                )}
                <div
                  className="relative flex h-9 w-9 items-center justify-center rounded-full shadow-inner"
                  style={{ backgroundColor: slime.color }}
                >
                  <div className="flex gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                </div>
                <div className="w-full truncate text-center text-[8px] font-black leading-none text-gray-800">{slime.name}</div>
                <div className="grid w-full grid-cols-3 gap-0">
                  <div className="flex flex-col items-center">
                    <Heart className="h-2 w-2 text-red-400" />
                    <span className="text-[6px] font-black text-gray-500">{slime.stats.health}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Sword className="h-2 w-2 text-orange-400" />
                    <span className="text-[6px] font-black text-gray-500">{slime.stats.strength}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Wind className="h-2 w-2 text-blue-400" />
                    <span className="text-[6px] font-black text-gray-500">{slime.stats.agility}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {slimes.length < 3 && (
          <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 px-3 py-8 text-center">
            <p className="text-[10px] font-bold text-violet-700">Need at least 3 slimes to enter the arena.</p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-violet-100/90 bg-gradient-to-r from-white via-violet-50/30 to-orange-50/40 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
          <button
            type="button"
            onClick={runBattle}
            disabled={!canFight || !!battleSession}
            className="ui-afford-disabled w-full rounded-2xl border-2 border-violet-500 bg-gradient-to-br from-violet-500 to-purple-700 py-3 text-sm font-black text-white shadow-lg shadow-violet-900/20 transition-all hover:brightness-105 disabled:border-zinc-300 disabled:from-zinc-200 disabled:to-zinc-300 disabled:text-zinc-600 disabled:shadow-none"
          >
            Start battle
          </button>
          <button
            type="button"
            onClick={clearLineup}
            disabled={!!battleSession}
            className="text-center text-[10px] font-bold text-violet-600/80 hover:text-violet-800 disabled:opacity-40"
          >
            Clear lineup
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
              <p className="text-[11px] font-bold text-violet-100/80">
                Collect energy orbs to fill each slime&apos;s arena bar — when it&apos;s full, they unleash their ability.
              </p>
            </div>
            <ArenaBattleCanvas
              key={`${battleSession.starterIds.join('-')}-${battleSession.encounter.seed}`}
              playerSlimes={battleSession.playerSlimes}
              enemies={battleSession.enemies}
              playerHpRatios={hpPlayerDisplay}
              enemyHpRatios={hpEnemyDisplay}
              playerAbilityFiredRef={playerAbilityFiredRef}
              onAbilityFired={(id) => setLiveAbilityFired((p) => ({ ...p, [id]: true }))}
            />
            <div className="shrink-0 border-t border-violet-500/20 bg-black/30 px-2 py-2">
              <p className="mb-1.5 text-center text-[8px] font-black uppercase tracking-wider text-violet-300/90">
                Arena skills (energy bar → Go! → meta cooldown after battle)
              </p>
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
                        <p className="mb-0.5 truncate text-[7px] font-black capitalize text-rose-100/90">{foe.name}</p>
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
            onClick={dismissResult}
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
                      <Timer className="h-10 w-10 text-zinc-700" aria-hidden />
                    </div>
                  </div>
                  <h3 className="mb-1 text-center text-xl font-black text-zinc-800">Defeat</h3>
                  <p className="mb-4 text-center text-sm font-semibold text-zinc-600">
                    Everyone in this lineup needs a breather —{' '}
                    <span className="font-black text-orange-700">5 minutes</span> before their bonuses work
                    again on the coin field. You can unequip them and equip other slimes.
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={dismissResult}
                className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-purple-800 py-3.5 text-sm font-black text-white shadow-lg"
              >
                OK
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
