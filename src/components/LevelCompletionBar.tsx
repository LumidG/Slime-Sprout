import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift } from 'lucide-react';
import { LEVEL_GOALS } from '../constants';

interface Particle {
  id: number;
  angle: number;
  distance: number;
  color: string;
  size: number;
}

interface LevelCompletionBarProps {
  worldCoinsCollected: number;
  goalsClaimed: [boolean, boolean, boolean, boolean, boolean];
  onClaim: (goalIndex: number) => void;
}

const PARTICLE_COLORS_NORMAL = ['#6ee7b7', '#34d399', '#fbbf24', '#ffffff', '#86efac'];
const PARTICLE_COLORS_FINAL = ['#fbbf24', '#f59e0b', '#ec4899', '#8b5cf6', '#6366f1', '#ffffff', '#34d399'];
const PARTICLE_COUNT_NORMAL = 14;
const PARTICLE_COUNT_FINAL = 22;

export function LevelCompletionBar({ worldCoinsCollected, goalsClaimed, onClaim }: LevelCompletionBarProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isClaiming, setIsClaiming] = useState(false);
  const particleIdRef = useRef(0);

  const activeGoalIndex = goalsClaimed.findIndex((claimed) => !claimed);
  const allDone = activeGoalIndex === -1;

  const activeGoal = allDone ? null : LEVEL_GOALS[activeGoalIndex];
  const prevThreshold = (!allDone && activeGoalIndex > 0) ? LEVEL_GOALS[activeGoalIndex - 1].threshold : 0;
  const rangeSize = activeGoal ? activeGoal.threshold - prevThreshold : 1;

  // Progress within the current goal's range (coin-based for all goals).
  const progressInRange = allDone
    ? 1
    : Math.min(1, Math.max(0, (worldCoinsCollected - prevThreshold) / rangeSize));

  const claimedCount = goalsClaimed.filter(Boolean).length;
  const fillPct = allDone
    ? 100
    : ((claimedCount + progressInRange) / LEVEL_GOALS.length) * 100;

  // A goal is ready when the coin threshold is met.
  const isReady = !allDone && worldCoinsCollected >= (activeGoal?.threshold ?? Infinity);

  const handleClaim = useCallback(() => {
    if (!isReady || isClaiming || activeGoalIndex === -1) return;
    const goal = LEVEL_GOALS[activeGoalIndex];
    const isFinal = goal.isFinal ?? false;

    setIsClaiming(true);

    const count = isFinal ? PARTICLE_COUNT_FINAL : PARTICLE_COUNT_NORMAL;
    const colors = isFinal ? PARTICLE_COLORS_FINAL : PARTICLE_COLORS_NORMAL;
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: particleIdRef.current++,
      angle: (360 / count) * i + (Math.random() * 24 - 12),
      distance: (isFinal ? 55 : 36) + Math.random() * (isFinal ? 50 : 30),
      color: colors[Math.floor(Math.random() * colors.length)],
      size: (isFinal ? 5 : 4) + Math.random() * (isFinal ? 6 : 4),
    }));

    setParticles(newParticles);

    setTimeout(() => {
      setParticles([]);
      setIsClaiming(false);
      onClaim(activeGoalIndex);
    }, 650);
  }, [isReady, isClaiming, activeGoalIndex, onClaim]);

  return (
    <div className="pointer-events-none w-full px-6 pb-1">
      {/* Bar wrapper — overflow-visible so marker circles protrude above/below the track */}
      <div className="relative flex items-center" style={{ height: 26 }}>
        {/* Track (overflow-hidden keeps fill rounded) */}
        <div className="absolute inset-x-0 top-1/2 h-3.5 -translate-y-1/2 overflow-hidden rounded-full bg-black/25 ring-1 ring-white/15 backdrop-blur-sm">
          {/* Fill */}
          <motion.div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{
              background: allDone
                ? 'linear-gradient(90deg,#34d399,#10b981,#6ee7b7)'
                : (activeGoal?.isFinal
                  ? 'linear-gradient(90deg,#f59e0b,#ec4899,#8b5cf6)'
                  : 'linear-gradient(90deg,#34d399,#10b981)'),
            }}
            animate={{ width: `${fillPct}%` }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {/* Goal markers — circles for goals 1–4, gift icon for goal 5 */}
        {LEVEL_GOALS.map((goal, i) => {
          const pct = ((i + 1) / LEVEL_GOALS.length) * 100;
          const isClaimed = goalsClaimed[i];
          const isActive = !allDone && i === activeGoalIndex;
          const isFinalGoal = goal.isFinal ?? false;

          return (
            <div
              key={`marker-${i}`}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pct}%` }}
            >
              {isFinalGoal ? (
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-all ${
                    isClaimed
                      ? 'bg-amber-400 ring-2 ring-white/70 shadow-amber-400/50'
                      : isActive
                        ? 'bg-amber-900/60 ring-2 ring-amber-300/60'
                        : 'bg-black/40 ring-1 ring-white/20'
                  }`}
                >
                  <Gift
                    className={`h-4 w-4 ${isClaimed ? 'text-white' : isActive ? 'text-amber-200/80' : 'text-white/30'}`}
                    strokeWidth={2.5}
                  />
                </div>
              ) : (
                <div
                  className={`h-5 w-5 rounded-full shadow-sm transition-all ${
                    isClaimed
                      ? 'bg-white ring-2 ring-emerald-400/80'
                      : isActive
                        ? 'bg-white/25 ring-2 ring-white/55'
                        : 'bg-black/35 ring-1 ring-white/20'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Label row */}
      <div className="mt-1 flex flex-col items-center gap-px">
        {allDone ? (
          <span className="text-[8px] font-black uppercase tracking-wide text-white/75 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
            ★ All goals complete!
          </span>
        ) : (
          <>
            <span className="text-[7px] font-black uppercase tracking-widest text-white/40 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
              Current Goal
            </span>
            <span className="text-[8px] font-black uppercase tracking-wide text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
              {activeGoal?.label ?? ''}
            </span>
          </>
        )}
      </div>

      {/* Collect button — shown only when a goal is ready to claim */}
      <AnimatePresence>
        {isReady && (
          <motion.div
            key={`collect-${activeGoalIndex}`}
            initial={{ opacity: 0, scale: 0.82, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.82, y: -4 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="pointer-events-auto relative mt-1.5 flex justify-center"
          >
            <div className="relative">
              {/* Glow ring pulse */}
              <motion.div
                className={`absolute -inset-1 rounded-2xl opacity-60 blur-sm ${
                  activeGoal?.isFinal
                    ? 'bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500'
                    : 'bg-gradient-to-r from-emerald-400 to-teal-400'
                }`}
                animate={{ opacity: [0.4, 0.75, 0.4] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />

              <button
                type="button"
                onClick={handleClaim}
                disabled={isClaiming}
                className={`relative overflow-hidden rounded-xl px-5 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-95 disabled:opacity-60 ${
                  activeGoal?.isFinal
                    ? 'bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500 ring-1 ring-white/30'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 ring-1 ring-white/25'
                }`}
              >
                {/* Shimmer sweep */}
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-xl bg-white/20"
                  animate={{ x: ['-110%', '210%'] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.9 }}
                />
                <span className="relative z-10">
                  {activeGoal?.rewardLabel ?? ''} — Tap!
                </span>
              </button>

              {/* Burst particles */}
              {particles.map((p) => (
                <motion.div
                  key={p.id}
                  className="pointer-events-none absolute rounded-full"
                  style={{
                    width: p.size,
                    height: p.size,
                    background: p.color,
                    left: '50%',
                    top: '50%',
                    marginLeft: -p.size / 2,
                    marginTop: -p.size / 2,
                    zIndex: 60,
                  }}
                  initial={{ x: 0, y: 0, scale: 1.2, opacity: 1 }}
                  animate={{
                    x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
                    y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
                    scale: 0,
                    opacity: 0,
                  }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
