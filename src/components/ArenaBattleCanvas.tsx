import React, { useEffect, useRef } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';
import type { Slime } from '../types';
import type { SlimeArenaAbility } from '../types';
import {
  BASE_SLIME_SPEED,
  TRAIT_EFFECTS,
  ARENA_ABILITY_PROC_MS,
  ARENA_MELEE_MIN_SEPARATION_PX,
  ARENA_MELEE_MIN_ATTACK_DIST_PX,
  ARENA_MELEE_MAX_ATTACK_DIST_PX,
  ARENA_MELEE_HIT_DAMAGE,
  ARENA_MELEE_ATTACK_ANIM_MS,
  ARENA_TEAM_SIZE,
  slimeAttackCooldownMs,
  slimeAgilityDodgeChance,
  slimeIdVariety,
  ARENA_ABILITY_BATTLE_COOLDOWN_MS,
  ARENA_ABILITY_BATTLE_INITIAL_DELAY_MS,
  type ArenaEnemyDisplay,
} from '../constants';
import { drawSlimeSpriteStack, loadSlimeSpriteImageCache } from '../slimeSprites';

type SlimePos = { x: number; y: number; moveDist: number; walkPhase: number };

/** Vertical lineup on the left or right edge of the arena (paired slots face each other across X). */
function arenaVerticalSideAnchor(
  width: number,
  height: number,
  index: number,
  teamSize: number,
  side: 'left' | 'right',
  topPad = 28
): { x: number; y: number } {
  const marginX = Math.max(14, width * 0.07);
  const x = side === 'left' ? marginX : width - marginX;
  const marginY = topPad;
  const span = Math.max(0, height - 2 * marginY);
  const y =
    teamSize <= 1 ? height * 0.5 : marginY + (index / Math.max(1, teamSize - 1)) * span;
  return { x, y };
}

function enemyAsSlime(e: ArenaEnemyDisplay): Slime {
  return {
    id: e.id,
    name: e.name,
    color: e.color,
    slimeBody: e.slimeBody,
    slimeEyes: e.slimeEyes,
    slimeAccessory: e.slimeAccessory,
    stats: { health: 6, strength: 12, agility: e.agility },
    statLevels: { health: 1, strength: 1, agility: 1 },
    trait: 'None',
    arenaAbility: e.ability,
    level: 1,
    value: 0,
    hatchedAt: 0,
  };
}

function drawArenaAbilityVfx(
  ctx: CanvasRenderingContext2D,
  ability: SlimeArenaAbility,
  timeNow: number,
  proc: number,
  drawRadius: number,
  team: 'player' | 'enemy'
) {
  if (ability === 'None') return;

  const pulse = 0.65 + Math.sin(timeNow / 220) * 0.08;
  const burst = proc;
  const towardCenter = team === 'player' ? 1 : -1;

  ctx.save();
  switch (ability) {
    case 'Rally': {
      const n = 10;
      ctx.globalAlpha = 0.35 + burst * 0.5;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + timeNow / 800;
        ctx.strokeStyle = `rgba(250, 204, 21, ${0.4 + burst * 0.45})`;
        ctx.lineWidth = 2 + burst * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * (drawRadius + 4), Math.sin(ang) * (drawRadius + 4));
        ctx.lineTo(Math.cos(ang) * (drawRadius + 14 + burst * 18), Math.sin(ang) * (drawRadius + 14 + burst * 18));
        ctx.stroke();
      }
      ctx.globalAlpha = 0.25 * pulse;
      ctx.strokeStyle = '#fbbf24';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case 'Fortify': {
      ctx.globalAlpha = 0.45 + burst * 0.35;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.95)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 2, drawRadius + 8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.fillStyle = `rgba(71, 85, 105, ${0.12 + burst * 0.2})`;
      ctx.beginPath();
      ctx.arc(0, 2, drawRadius + 5, Math.PI * 0.2, Math.PI * 0.8);
      ctx.lineTo(0, 6);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'Smash': {
      ctx.globalAlpha = 0.5 + burst * 0.45;
      for (let ring = 0; ring < 3; ring++) {
        const t = ((timeNow / 350 + ring * 0.33) % 1) * (1 + burst);
        const rad = drawRadius + 6 + t * (22 + burst * 30);
        ctx.strokeStyle = `rgba(234, 88, 12, ${0.55 * (1 - t * 0.7)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = 'rgba(248, 113, 113, 0.35)';
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * Math.PI * 2 + timeNow / 400;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 4, Math.sin(a) * 4, 2 + burst * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'Rush': {
      const o = towardCenter;
      ctx.globalAlpha = 0.4 + burst * 0.45;
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const y = -6 + i * 5 + Math.sin(timeNow / 90 + i) * 2;
        ctx.beginPath();
        ctx.moveTo(o * (drawRadius + 16 + burst * 12), y);
        ctx.lineTo(o * (drawRadius + 4), y);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = 'rgba(103, 232, 249, 0.45)';
      ctx.beginPath();
      ctx.ellipse(o * (drawRadius + 10), 0, 8 + burst * 10, 5 + burst * 4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'Harmony': {
      const rings = 3;
      for (let r = 0; r < rings; r++) {
        const hue = (timeNow / 40 + r * 40) % 360;
        ctx.globalAlpha = (0.2 + burst * 0.35) / (r + 1);
        ctx.strokeStyle = `hsla(${hue}, 85%, 62%, 0.85)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius + 5 + r * 7 + Math.sin(timeNow / 300 + r) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.15 + burst * 0.25;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, drawRadius + 18);
      g.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
      g.addColorStop(0.5, 'rgba(34, 211, 238, 0.2)');
      g.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius + 18, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

/** Directional melee swing VFX (orbiting arena abilities are separate). Faces toward (tx, ty) unit vector. */
function drawArenaMeleeSpecialAttackVfx(
  ctx: CanvasRenderingContext2D,
  ability: SlimeArenaAbility,
  progress: number,
  tx: number,
  ty: number,
  drawRadius: number
) {
  const fade = Math.sin(progress * Math.PI);
  if (fade < 0.02) return;

  const ang = Math.atan2(ty, tx);
  ctx.save();
  ctx.rotate(ang);

  switch (ability) {
    case 'None': {
      const sweep = progress * 0.95;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${0.45 + 0.45 * fade})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(drawRadius + 2 + i * 2, i * 3 - 3, 12 + i * 3, -0.55 - sweep * 0.4, 0.35 + sweep * 0.35);
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(248, 250, 252, ${0.5 * fade})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(drawRadius + 4, -8);
      ctx.lineTo(drawRadius + 22 + progress * 10, -2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(drawRadius + 6, 4);
      ctx.lineTo(drawRadius + 20 + progress * 8, 10);
      ctx.stroke();
      break;
    }
    case 'Rally': {
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + progress * 0.4;
        const len = drawRadius + 6 + progress * 24;
        ctx.strokeStyle = `rgba(250, 204, 21, ${0.55 * fade})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (drawRadius + 1), Math.sin(a) * (drawRadius + 1));
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(253, 224, 71, ${0.28 * fade})`;
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius + 5 + progress * 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(245, 158, 11, ${0.75 * fade})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius + 8 + progress * 6, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'Fortify': {
      ctx.fillStyle = `rgba(148, 163, 184, ${0.5 * fade})`;
      ctx.beginPath();
      ctx.moveTo(drawRadius * 0.15, -drawRadius * 1.15);
      ctx.lineTo(drawRadius * 1.75 + progress * 14, -drawRadius * 0.85);
      ctx.lineTo(drawRadius * 1.75 + progress * 14, drawRadius * 0.85);
      ctx.lineTo(drawRadius * 0.15, drawRadius * 1.15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(226, 232, 240, ${0.85 * fade})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = `rgba(71, 85, 105, ${0.35 * fade})`;
      ctx.beginPath();
      ctx.roundRect(drawRadius * 0.4, -drawRadius * 0.5, drawRadius * 1.1 + progress * 6, drawRadius, 3);
      ctx.fill();
      break;
    }
    case 'Smash': {
      const swing = progress * Math.PI * 0.9;
      ctx.strokeStyle = `rgba(234, 88, 12, ${0.9 * fade})`;
      ctx.lineWidth = 4 + progress * 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius + 20, -0.45 - swing * 0.45, -0.45 + swing);
      ctx.stroke();
      ctx.fillStyle = `rgba(251, 146, 60, ${0.45 * fade})`;
      ctx.beginPath();
      ctx.arc(drawRadius + 16, 0, 7 + progress * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35 * fade;
      ctx.fillStyle = 'rgba(185, 28, 28, 0.6)';
      ctx.beginPath();
      ctx.arc(drawRadius + 18, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'Rush': {
      for (let k = 0; k < 6; k++) {
        const off = k * 4 - 10;
        ctx.globalAlpha = (0.4 - k * 0.05) * fade;
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.95)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-10 - progress * 32, off);
        ctx.lineTo(drawRadius + 8 + progress * 10, off);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.5 * fade;
      ctx.fillStyle = 'rgba(103, 232, 249, 0.55)';
      ctx.beginPath();
      ctx.ellipse(drawRadius + 8, 0, 18 + progress * 14, 9 + progress * 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'Harmony': {
      for (let r = 0; r < 5; r++) {
        const hue = (r * 72 + progress * 100) % 360;
        ctx.strokeStyle = `hsla(${hue}, 82%, 62%, ${0.75 * fade})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          drawRadius + 8 + r * 6,
          progress * Math.PI + r * 0.4,
          progress * Math.PI + r * 0.4 + Math.PI * 0.55
        );
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(168, 85, 247, ${0.2 * fade})`;
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius + 14 + progress * 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function drawHpBarArena(
  ctx: CanvasRenderingContext2D,
  ratio: number,
  barY: number,
  side: 'player' | 'enemy'
) {
  const barW = 30;
  const barH = 4;
  const fill = Math.max(0, Math.min(1, ratio));
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(-barW / 2, barY, barW, barH, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.fillStyle = side === 'player' ? '#34d399' : '#fb7185';
  ctx.beginPath();
  ctx.roundRect(-barW / 2, barY, barW * fill, barH, 2);
  ctx.fill();
  ctx.restore();
}

/** Per-slime ability charge bar (fills white while charging, flashes orange when it fires). */
function drawArenaUltBar(
  ctx: CanvasRenderingContext2D,
  chargeProgress: number,
  isFiring: boolean,
  barY: number
) {
  const barWidth = 24;
  const barHeight = 3;
  const fill = Math.max(0, Math.min(1, isFiring ? 1 : chargeProgress));
  const color = isFiring ? '#f97316' : '#FFFFFF';
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.roundRect(-barWidth / 2, barY, barWidth, barHeight, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-barWidth / 2, barY, barWidth * fill, barHeight, 2);
  ctx.fill();
  ctx.restore();
}

/** Live battle stats for the player-team HUD (HP ratios, ability charge timing). */
export type ArenaBattleStats = {
  /** 0–1 HP ratio for each player-team slot (index matches playerSlimes order). */
  hp: number[];
  /** slimeId → wall-clock ms when the next in-battle ability proc fires. */
  abilityNextProc: Record<string, number>;
  /** slimeId → wall-clock ms when the current charge cycle started. */
  chargeStart: Record<string, number>;
};

type Props = {
  playerSlimes: Slime[];
  enemies: ArenaEnemyDisplay[];
  playerAbilityFiredRef: React.MutableRefObject<Record<string, boolean>>;
  onAbilityFired?: (id: string) => void;
  /** Fires once when all slimes on one side reach 0 HP. */
  onSideDefeated?: (side: 'player' | 'enemy') => void;
  /** When true, the canvas still renders but slime movement and melee do not advance. */
  paused?: boolean;
  /** Simulation speed multiplier — 1 = normal, 2 = double-speed fast-forward. */
  speedMultiplier?: number;
  /** SFX callbacks — called from the game loop whenever the corresponding event fires. */
  onHit?: () => void;
  onDodge?: () => void;
  onAbility?: () => void;
  /** Called at ~20 fps with current player-team battle stats for the HUD. */
  onStatsUpdate?: (stats: ArenaBattleStats) => void;
};

export function ArenaBattleCanvas({
  playerSlimes,
  enemies,
  playerAbilityFiredRef,
  onAbilityFired,
  onSideDefeated,
  paused = false,
  speedMultiplier = 1,
  onHit,
  onDodge,
  onAbility,
  onStatsUpdate,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dims = useRef({ width: 400, height: 320 });
  const slimesRef = useRef<Record<string, SlimePos>>({});
  const lastAbilityProcRef = useRef<Record<string, number>>({});
  /** Battle start time (ms); set on first sim tick for per-ability initial delay calculation. */
  const battleStartRef = useRef<number | null>(null);
  /** Per-slime wall-clock timestamp when the next in-battle ability proc fires. */
  const slimeAbilityNextProcRef = useRef<Record<string, number>>({});
  /** Per-slime wall-clock timestamp when the current charge cycle started (for 0-to-full bar). */
  const chargeStartRef = useRef<Record<string, number>>({});
  /** Guards so onSideDefeated fires at most once per team per battle. */
  const sideDefeatedFiredRef = useRef({ player: false, enemy: false });
  /** Decorative 0–1 HP (outcome still uses stat resolution in App). */
  const hpPlayerRef = useRef<number[]>(Array.from({ length: ARENA_TEAM_SIZE }, () => 1));
  const hpEnemyRef = useRef<number[]>(Array.from({ length: ARENA_TEAM_SIZE }, () => 1));
  const hitFlashUntilRef = useRef<Record<string, number>>({});
  /** Active melee special-attack animation toward opponent. */
  const meleeAttackAnimRef = useRef<Record<string, { startMs: number; tx: number; ty: number }>>({});
  /** Per pair index: 0 = player’s turn to strike, 1 = enemy’s turn. */
  /** Per-slime timestamp when that slime may next launch a normal attack. */
  const slimeNextAttackRef = useRef<Record<string, number>>({});
  /** Per-slime flash-until timestamp for a successful dodge (cyan tint). */
  const dodgeFlashUntilRef = useRef<Record<string, number>>({});
  const propsRef = useRef({
    playerSlimes,
    enemies,
  });
  propsRef.current = { playerSlimes, enemies };

  const sfxRef = useRef({ onHit, onDodge, onAbility });
  sfxRef.current = { onHit, onDodge, onAbility };

  const onStatsUpdateRef = useRef(onStatsUpdate);
  onStatsUpdateRef.current = onStatsUpdate;
  const lastStatsUpdateRef = useRef(0);

  const speedRef = useRef(speedMultiplier);
  speedRef.current = speedMultiplier;

  const slimeSpriteCacheRef = useRef<Map<string, HTMLImageElement> | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadSlimeSpriteImageCache().then((m) => {
      if (!cancelled) {
        slimeSpriteCacheRef.current = m;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      dims.current = { width, height };
      if (canvasRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const initIfNeeded = (width: number, height: number, topPad: number) => {
    const { playerSlimes: ps, enemies: en } = propsRef.current;
    ps.forEach((s, i) => {
      if (!slimesRef.current[s.id]) {
        const a = arenaVerticalSideAnchor(width, height, i, ps.length, 'left', topPad);
        slimesRef.current[s.id] = {
          x: a.x,
          y: a.y,
          moveDist: 0,
          walkPhase: Math.random() * Math.PI * 2,
        };
      }
    });
    en.forEach((e, i) => {
      if (!slimesRef.current[e.id]) {
        const a = arenaVerticalSideAnchor(width, height, i, en.length, 'right', topPad);
        slimesRef.current[e.id] = {
          x: a.x,
          y: a.y,
          moveDist: 0,
          walkPhase: Math.random() * Math.PI * 2,
        };
      }
    });
  };

  useGameLoop((deltaTime) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { width, height } = dims.current;
    if (width < 20 || height < 20) return;

    const frameScale = (deltaTime / 16.67) * speedRef.current;
    const timeNow = Date.now();
    const spd = speedRef.current;
    const midX = width / 2;

    // Scale all sizes/distances relative to canvas dimensions so slimes stay visible on any screen.
    const scale = Math.max(Math.min(width / 200, height / 160, 2.5), 0.7);
    const scaledTopPad = Math.round(34 * scale);
    const scaledSidePad = Math.round(22 * scale);
    const scaledMinSep = ARENA_MELEE_MIN_SEPARATION_PX * scale;
    const scaledMinAttack = ARENA_MELEE_MIN_ATTACK_DIST_PX * scale;
    const scaledMaxAttack = ARENA_MELEE_MAX_ATTACK_DIST_PX * scale;
    const crossMidAllowance = Math.round(44 * scale);

    initIfNeeded(width, height, scaledTopPad);

    const cycleTime = 30000;
    const activeDuration = 5000;
    const isTraitCycleActive = (timeNow % cycleTime) < activeDuration;

    let globalSlimeSpeedBuff = 0;
    let globalRadiusBuff = 0;
    propsRef.current.playerSlimes.forEach((s) => {
      const effect = TRAIT_EFFECTS[s.trait];
      if (isTraitCycleActive) {
        if (effect.slimeSpeed) globalSlimeSpeedBuff += effect.slimeSpeed;
        if (effect.radius) globalRadiusBuff += effect.radius;
      }
    });

    const pl = propsRef.current.playerSlimes;
    const en = propsRef.current.enemies;
    const enemyTeam = en.map(enemyAsSlime);

    if (!paused) {
    const updateSlime = (
      slime: Slime,
      index: number,
      team: Slime[],
      anchor: { x: number; y: number },
      side: 'left' | 'right',
      opponentPos: { x: number; y: number } | null
    ) => {
      if (!slimesRef.current[slime.id]) {
        slimesRef.current[slime.id] = {
          x: anchor.x,
          y: anchor.y,
          moveDist: 0,
          walkPhase: Math.random() * Math.PI * 2,
        };
      }
      const sPos = slimesRef.current[slime.id]!;
      const beforeMove = { x: sPos.x, y: sPos.y };
      const effect = TRAIT_EFFECTS[slime.trait];
      const selfSpeedBuff = isTraitCycleActive && effect.selfSpeed ? effect.selfSpeed : 0;
      const finalSlimeSpeed =
        BASE_SLIME_SPEED * (1 + slime.stats.agility / 20) * (1 + selfSpeedBuff) * (1 + globalSlimeSpeedBuff);

      const anchorDir = (() => {
        const dx = anchor.x - sPos.x;
        const dy = anchor.y - sPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          return { x: dx / dist, y: dy / dist };
        }
        return { x: 0, y: 0 };
      })();

      let chaseDir = { x: 0, y: 0 };
      let inMeleeRange = false;
      if (opponentPos) {
        const dx = opponentPos.x - sPos.x;
        const dy = opponentPos.y - sPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          const nx = dx / dist;
          const ny = dy / dist;
          if (dist > scaledMaxAttack) {
            chaseDir = { x: nx, y: ny };
          } else if (dist < scaledMinSep + 2 * scale) {
            chaseDir = { x: -nx * 0.25, y: -ny * 0.25 };
          } else {
            // In attack range — hold position and fight, no orbiting
            inMeleeRange = true;
            chaseDir = { x: 0, y: 0 };
          }
        }
      }

      const chaseLen = Math.hypot(chaseDir.x, chaseDir.y);
      const anchorLen = Math.hypot(anchorDir.x, anchorDir.y);
      let sMoveDir = { x: 0, y: 0 };
      if (chaseLen > 0.01) {
        sMoveDir = chaseDir;
      } else if (anchorLen > 0.01 && !inMeleeRange) {
        sMoveDir = anchorDir;
      }

      const time = Date.now() / 1000;
      const wanderAngle = (time + index * 123.45) * 1.4;
      // Nearly eliminate wander when actively fighting so slimes hold their ground
      const wanderAmp = inMeleeRange ? 0.015 : opponentPos ? 0.1 : 0.18;
      const wanderX = Math.cos(wanderAngle) * wanderAmp;
      const wanderY = Math.sin(wanderAngle) * wanderAmp;
      const finalMoveX = sMoveDir.x + wanderX;
      const finalMoveY = sMoveDir.y + wanderY;
      const finalDist = Math.hypot(finalMoveX, finalMoveY);

      if (finalDist > 0.1) {
        sPos.x += (finalMoveX / finalDist) * finalSlimeSpeed * frameScale;
        sPos.y += (finalMoveY / finalDist) * finalSlimeSpeed * frameScale;
      }

      team.forEach((other) => {
        if (other.id === slime.id) return;
        const otherPos = slimesRef.current[other.id];
        if (!otherPos) return;
        const dx = sPos.x - otherPos.x;
        const dy = sPos.y - otherPos.y;
        const dist = Math.hypot(dx, dy);
        const teamSep = 25 * scale;
        if (dist < teamSep && dist > 0) {
          const push = (teamSep - dist) * 0.05;
          sPos.x += (dx / dist) * push;
          sPos.y += (dy / dist) * push;
        }
      });

      const pDx = sPos.x - anchor.x;
      const pDy = sPos.y - anchor.y;
      const pDist = Math.hypot(pDx, pDy);
      const anchorSep = 22 * scale;
      if (pDist < anchorSep && pDist > 0) {
        const push = (anchorSep - pDist) * 0.1;
        sPos.x += (pDx / pDist) * push;
        sPos.y += (pDy / pDist) * push;
      }

      /** Let both teams meet in the center for melee (was hard-split at midline). */
      if (side === 'left') {
        sPos.x = Math.min(sPos.x, midX + crossMidAllowance);
      } else {
        sPos.x = Math.max(sPos.x, midX - crossMidAllowance);
      }
      sPos.x = Math.max(scaledSidePad, Math.min(width - scaledSidePad, sPos.x));
      sPos.y = Math.max(scaledTopPad, Math.min(height - scaledSidePad, sPos.y));

      {
        const sdx = sPos.x - beforeMove.x;
        const sdy = sPos.y - beforeMove.y;
        const sd = Math.hypot(sdx, sdy);
        if (sd > 0.05) {
          sPos.moveDist = sd;
          if (typeof sPos.walkPhase !== 'number') sPos.walkPhase = Math.random() * Math.PI * 2;
          sPos.walkPhase += sd * 0.42;
        } else {
          sPos.moveDist = 0;
        }
      }
    };

    pl.forEach((s, i) => {
      if ((hpPlayerRef.current[i] ?? 1) <= 0) return;
      const sPos = slimesRef.current[s.id];
      let nearestOpp: { x: number; y: number } | null = null;
      if (sPos) {
        let nearestDist = Infinity;
        en.forEach((foe, j) => {
          if ((hpEnemyRef.current[j] ?? 1) <= 0) return;
          const foePos = slimesRef.current[foe.id];
          if (!foePos) return;
          const d = Math.hypot(sPos.x - foePos.x, sPos.y - foePos.y);
          if (d < nearestDist) { nearestDist = d; nearestOpp = { x: foePos.x, y: foePos.y }; }
        });
      }
      const anchorLeft = arenaVerticalSideAnchor(width, height, i, pl.length, 'left', scaledTopPad);
      updateSlime(s, i, pl, anchorLeft, 'left', nearestOpp);
    });
    enemyTeam.forEach((slime, i) => {
      if ((hpEnemyRef.current[i] ?? 1) <= 0) return;
      const ePos = slimesRef.current[slime.id];
      let nearestOpp: { x: number; y: number } | null = null;
      if (ePos) {
        let nearestDist = Infinity;
        pl.forEach((pal, j) => {
          if ((hpPlayerRef.current[j] ?? 1) <= 0) return;
          const pPos = slimesRef.current[pal.id];
          if (!pPos) return;
          const d = Math.hypot(ePos.x - pPos.x, ePos.y - pPos.y);
          if (d < nearestDist) { nearestDist = d; nearestOpp = { x: pPos.x, y: pPos.y }; }
        });
      }
      const anchorRight = arenaVerticalSideAnchor(width, height, i, enemyTeam.length, 'right', scaledTopPad);
      updateSlime(slime, i + 10, enemyTeam, anchorRight, 'right', nearestOpp);
    });

    const separateOpposing = () => {
      for (let a = 0; a < pl.length; a++) {
        if ((hpPlayerRef.current[a] ?? 1) <= 0) continue;
        for (let b = 0; b < en.length; b++) {
          if ((hpEnemyRef.current[b] ?? 1) <= 0) continue;
          const pa = slimesRef.current[pl[a]!.id];
          const pb = slimesRef.current[en[b]!.id];
          if (!pa || !pb) continue;
          const dx = pb.x - pa.x;
          const dy = pb.y - pa.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          if (dist >= scaledMinSep) continue;
          const push = ((scaledMinSep - dist) / 2) * 0.75;
          const nx = dx / dist;
          const ny = dy / dist;
          pa.x -= nx * push;
          pa.y -= ny * push;
          pb.x += nx * push;
          pb.y += ny * push;
        }
      }
    };
    separateOpposing();

    const clampAll = () => {
      for (const s of pl) {
        const p = slimesRef.current[s.id];
        if (!p) continue;
        p.x = Math.max(scaledSidePad, Math.min(width - scaledSidePad, p.x));
        p.y = Math.max(scaledTopPad, Math.min(height - scaledSidePad, p.y));
      }
      for (const e of en) {
        const p = slimesRef.current[e.id];
        if (!p) continue;
        p.x = Math.max(scaledSidePad, Math.min(width - scaledSidePad, p.x));
        p.y = Math.max(scaledTopPad, Math.min(height - scaledSidePad, p.y));
      }
    };
    clampAll();

    const meleeSwingReady = (id: string) => {
      const a = meleeAttackAnimRef.current[id];
      if (!a) return true;
      return timeNow - a.startMs >= ARENA_MELEE_ATTACK_ANIM_MS / spd;
    };

    // Initialise per-slime attack timers on first appearance (staggered so slimes don't all swing at once)
    pl.forEach((s, i) => {
      if (!(s.id in slimeNextAttackRef.current)) {
        slimeNextAttackRef.current[s.id] = timeNow + Math.round((400 + i * 320) / spd);
      }
    });
    enemyTeam.forEach((s, i) => {
      if (!(s.id in slimeNextAttackRef.current)) {
        slimeNextAttackRef.current[s.id] = timeNow + Math.round((560 + i * 320) / spd);
      }
    });

    // Per-slime independent normal attacks — each slime targets the nearest living opponent in range

    // Player slimes attack
    for (let pi = 0; pi < pl.length; pi++) {
      if ((hpPlayerRef.current[pi] ?? 1) <= 0) continue;
      const pSlime = pl[pi]!;
      const pPos = slimesRef.current[pSlime.id];
      if (!pPos) continue;
      if (timeNow < (slimeNextAttackRef.current[pSlime.id] ?? 0) || !meleeSwingReady(pSlime.id)) continue;

      let targetEi = -1;
      let targetDist = Infinity;
      for (let ei = 0; ei < en.length; ei++) {
        if ((hpEnemyRef.current[ei] ?? 1) <= 0) continue;
        const ePos = slimesRef.current[en[ei]!.id];
        if (!ePos) continue;
        const d = Math.hypot(pPos.x - ePos.x, pPos.y - ePos.y);
        if (d >= scaledMinAttack && d <= scaledMaxAttack && d < targetDist) { targetEi = ei; targetDist = d; }
      }
      if (targetEi < 0) continue;

      const eDisp = en[targetEi]!;
      const eSlime = enemyTeam[targetEi]!;
      const ePos = slimesRef.current[eDisp.id]!;
      const dodgeRoll = Math.random();
      const eDodgeChance = slimeAgilityDodgeChance(eSlime.statLevels.agility);
      const fullyDodged = dodgeRoll < eDodgeChance;
      const partialDodge = !fullyDodged && dodgeRoll < eDodgeChance * 2.5;
      const dmgMult = fullyDodged ? 0 : partialDodge ? 0.5 : 1;
      const mx = ePos.x - pPos.x;
      const my = ePos.y - pPos.y;
      const ml = Math.hypot(mx, my) || 1;
      meleeAttackAnimRef.current[pSlime.id] = { startMs: timeNow, tx: mx / ml, ty: my / ml };
      if (fullyDodged) {
        dodgeFlashUntilRef.current[eDisp.id] = timeNow + Math.round(350 / spd);
        sfxRef.current.onDodge?.();
      } else {
        const pStr = Math.max(2, pSlime.stats.strength);
        const eHealth = Math.max(5, eSlime.stats.health);
        const dmg = ARENA_MELEE_HIT_DAMAGE * (pStr / 10) * (10 / eHealth) * dmgMult * spd;
        hpEnemyRef.current[targetEi] = Math.max(0, (hpEnemyRef.current[targetEi] ?? 1) - dmg);
        hitFlashUntilRef.current[eDisp.id] = timeNow + Math.round(160 / spd);
        sfxRef.current.onHit?.();
      }
      slimeNextAttackRef.current[pSlime.id] = timeNow + Math.round(slimeAttackCooldownMs(pSlime) / spd);
    }

    // Enemy slimes attack
    for (let ei = 0; ei < en.length; ei++) {
      if ((hpEnemyRef.current[ei] ?? 1) <= 0) continue;
      const eDisp = en[ei]!;
      const eSlime = enemyTeam[ei]!;
      const ePos = slimesRef.current[eDisp.id];
      if (!ePos) continue;
      if (timeNow < (slimeNextAttackRef.current[eDisp.id] ?? 0) || !meleeSwingReady(eDisp.id)) continue;

      let targetPi = -1;
      let targetDist = Infinity;
      for (let pi = 0; pi < pl.length; pi++) {
        if ((hpPlayerRef.current[pi] ?? 1) <= 0) continue;
        const pPos = slimesRef.current[pl[pi]!.id];
        if (!pPos) continue;
        const d = Math.hypot(ePos.x - pPos.x, ePos.y - pPos.y);
        if (d >= scaledMinAttack && d <= scaledMaxAttack && d < targetDist) { targetPi = pi; targetDist = d; }
      }
      if (targetPi < 0) continue;

      const pSlime = pl[targetPi]!;
      const pPos = slimesRef.current[pSlime.id]!;
      const dodgeRoll = Math.random();
      const pDodgeChance = slimeAgilityDodgeChance(pSlime.statLevels.agility);
      const fullyDodged = dodgeRoll < pDodgeChance;
      const partialDodge = !fullyDodged && dodgeRoll < pDodgeChance * 2.5;
      const dmgMult = fullyDodged ? 0 : partialDodge ? 0.5 : 1;
      const mx = pPos.x - ePos.x;
      const my = pPos.y - ePos.y;
      const ml = Math.hypot(mx, my) || 1;
      meleeAttackAnimRef.current[eDisp.id] = { startMs: timeNow, tx: mx / ml, ty: my / ml };
      if (fullyDodged) {
        dodgeFlashUntilRef.current[pSlime.id] = timeNow + Math.round(350 / spd);
        sfxRef.current.onDodge?.();
      } else {
        const eStr = Math.max(2, eSlime.stats.strength);
        const pHealth = Math.max(5, pSlime.stats.health);
        const dmg = ARENA_MELEE_HIT_DAMAGE * (eStr / 10) * (10 / pHealth) * dmgMult * spd;
        hpPlayerRef.current[targetPi] = Math.max(0, (hpPlayerRef.current[targetPi] ?? 1) - dmg);
        hitFlashUntilRef.current[pSlime.id] = timeNow + Math.round(160 / spd);
        sfxRef.current.onHit?.();
      }
      slimeNextAttackRef.current[eDisp.id] = timeNow + Math.round(slimeAttackCooldownMs(eSlime) / spd);
    }
    // Initialise per-ability battle proc timers on first tick (staggered per ability + id variety)
    if (battleStartRef.current === null) {
      battleStartRef.current = timeNow;
    }
    const bStart = battleStartRef.current;
    for (const s of [...pl, ...enemyTeam]) {
      if (s.arenaAbility === 'None') continue;
      if (!(s.id in slimeAbilityNextProcRef.current)) {
        const baseDelay = ARENA_ABILITY_BATTLE_INITIAL_DELAY_MS[s.arenaAbility];
        const variety = slimeIdVariety(s.id) * 2000;
        slimeAbilityNextProcRef.current[s.id] = bStart + Math.round((baseDelay + variety) / spd);
        chargeStartRef.current[s.id] = bStart;
      }
    }

    // Per-slime independent ability procs
    for (const s of [...pl, ...enemyTeam]) {
      if (s.arenaAbility === 'None') continue;
      const nextProc = slimeAbilityNextProcRef.current[s.id];
      if (nextProc === undefined || timeNow < nextProc) continue;
      lastAbilityProcRef.current[s.id] = timeNow;
      const cdMs = ARENA_ABILITY_BATTLE_COOLDOWN_MS[s.arenaAbility];
      slimeAbilityNextProcRef.current[s.id] = timeNow + Math.round(cdMs / spd);
      chargeStartRef.current[s.id] = timeNow;
      sfxRef.current.onAbility?.();
      if (pl.some((p) => p.id === s.id)) {
        playerAbilityFiredRef.current[s.id] = true;
        onAbilityFired?.(s.id);
      }
    }

    // Side-defeated check — fires at most once per side per battle
    {
      const allPlayerDead = hpPlayerRef.current.slice(0, pl.length).every((hp) => hp <= 0);
      const allEnemyDead = hpEnemyRef.current.slice(0, en.length).every((hp) => hp <= 0);
      if (allPlayerDead && !sideDefeatedFiredRef.current.player) {
        sideDefeatedFiredRef.current.player = true;
        onSideDefeated?.('player');
      }
      if (allEnemyDead && !sideDefeatedFiredRef.current.enemy) {
        sideDefeatedFiredRef.current.enemy = true;
        onSideDefeated?.('enemy');
      }
    }

    } // end !paused

    // —— Draw ——
    ctx.clearRect(0, 0, width, height);
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, '#0f172a');
    g.addColorStop(0.45, '#1e1b4b');
    g.addColorStop(1, '#172554');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    const drawSlimeBody = (slime: Slime, pos: SlimePos, hpRatio: number, side: 'player' | 'enemy') => {
      const meleeHitFlash =
        (hitFlashUntilRef.current[slime.id] ?? 0) > timeNow;
      const dodgeFlash =
        (dodgeFlashUntilRef.current[slime.id] ?? 0) > timeNow;
      const time = timeNow;
      const isBursting = isTraitCycleActive && slime.trait !== 'None';
      const isSpeedType = ['Swift', 'Fast', 'Sonic'].includes(slime.trait);
      let jumpY = 0;
      let squashStretch = 1;
      if (isBursting && isSpeedType) {
        const jumpCycle = (time % 600) / 600;
        jumpY = Math.sin(jumpCycle * Math.PI) * -25;
        squashStretch = 1 + Math.sin(jumpCycle * Math.PI - Math.PI / 2) * 0.15;
      }
      const moveDist = pos.moveDist ?? 0;
      const isWalking = moveDist > 0.05;
      const walkWobble =
        isWalking && !(isBursting && isSpeedType)
          ? Math.sin(pos.walkPhase ?? 0) * 0.038
          : 0;
      const burstPulse = isBursting ? Math.sin(time / 100) * 0.05 + 1.05 : 1.0;
      const baseRadius = 10;
      const drawRadius = baseRadius * burstPulse;

      const tProc = lastAbilityProcRef.current[slime.id];
      const procRaw = tProc
        ? Math.max(0, 1 - (timeNow - tProc) / (ARENA_ABILITY_PROC_MS / spd))
        : 0;

      let lungeX = 0;
      let lungeY = 0;
      let meleeProg: number | null = null;
      let meleeTx = 0;
      let meleeTy = 0;
      const atkAnim = meleeAttackAnimRef.current[slime.id];
      if (atkAnim) {
        const animDuration = ARENA_MELEE_ATTACK_ANIM_MS / spd;
        const age = timeNow - atkAnim.startMs;
        if (age >= animDuration) {
          delete meleeAttackAnimRef.current[slime.id];
        } else {
          meleeProg = age / animDuration;
          meleeTx = atkAnim.tx;
          meleeTy = atkAnim.ty;
          const ease = Math.sin(meleeProg * Math.PI);
          lungeX = atkAnim.tx * ease * 14;
          lungeY = atkAnim.ty * ease * 14;
        }
      }

      ctx.save();
      ctx.translate(pos.x, pos.y + jumpY * scale);
      ctx.translate(lungeX * scale, lungeY * scale);
      ctx.scale(scale, scale);

      ctx.save();
      ctx.translate(0, -jumpY);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      const shadowScale = isBursting && isSpeedType ? 1 - Math.abs(jumpY) / 60 : 1;
      ctx.beginPath();
      ctx.ellipse(0, 8 * burstPulse, 10 * burstPulse * shadowScale, 5 * burstPulse * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (isBursting) {
        if (['Magnetic', 'Hypnotic'].includes(slime.trait)) {
          const radius = 15 * (1 + globalRadiusBuff);
          const rippleCount = 3;
          for (let i = 0; i < rippleCount; i++) {
            const rippleOffset = (time / 1000 + i / rippleCount) % 1;
            ctx.strokeStyle = slime.color;
            ctx.globalAlpha = (1 - rippleOffset) * 0.3;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, radius * rippleOffset, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        if (['Swift', 'Fast', 'Sonic'].includes(slime.trait)) {
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1;
          for (let i = 0; i < 4; i++) {
            const angle = (time / 50 + (i * Math.PI) / 2) % (Math.PI * 2);
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * 15, Math.sin(angle) * 15);
            ctx.lineTo(Math.cos(angle) * 25, Math.sin(angle) * 25);
            ctx.stroke();
          }
        }
        if (['Lucky', 'Golden'].includes(slime.trait)) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#FACC15';
          for (let i = 0; i < 5; i++) {
            const angle = (time / 200 + i * 72) * (Math.PI / 180);
            const dist = 18 + Math.sin(time / 150 + i) * 3;
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.globalAlpha = 1;
      drawArenaAbilityVfx(ctx, slime.arenaAbility, timeNow, procRaw, drawRadius, side);

      ctx.globalAlpha = 1;
      const cache = slimeSpriteCacheRef.current;
      const stackSize = drawRadius * 2.25;
      let drewSprites = false;
      if (cache) {
        ctx.save();
        ctx.scale((1 + walkWobble) / squashStretch, (1 - walkWobble) * squashStretch);
        drewSprites = drawSlimeSpriteStack(ctx, cache, slime, stackSize);
        ctx.restore();
      }
      if (!drewSprites) {
        ctx.fillStyle = slime.color;
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          (drawRadius * (1 + walkWobble)) / squashStretch,
          drawRadius * (1 - walkWobble) * squashStretch,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(-drawRadius * 0.3, -drawRadius * 0.3, drawRadius * 0.2, drawRadius * 0.4, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        if (slime.slimeEyes > 0) {
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(-3 * burstPulse, -2 * burstPulse, 2 * burstPulse, 0, Math.PI * 2);
          ctx.arc(3 * burstPulse, -2 * burstPulse, 2 * burstPulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'black';
          ctx.beginPath();
          ctx.arc(-2.5 * burstPulse, -1.5 * burstPulse, 0.8 * burstPulse, 0, Math.PI * 2);
          ctx.arc(3.5 * burstPulse, -1.5 * burstPulse, 0.8 * burstPulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (meleeProg !== null) {
        drawArenaMeleeSpecialAttackVfx(ctx, slime.arenaAbility, meleeProg, meleeTx, meleeTy, drawRadius);
      }

      if (meleeHitFlash) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          (drawRadius * 1.08 * (1 + walkWobble)) / squashStretch,
          drawRadius * 1.08 * (1 - walkWobble) * squashStretch,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (dodgeFlash) {
        const dodgeProg = 1 - Math.max(0, (dodgeFlashUntilRef.current[slime.id]! - timeNow) / 350);
        ctx.globalAlpha = 0.55 * (1 - dodgeProg);
        ctx.fillStyle = 'rgba(56, 232, 255, 0.85)';
        ctx.beginPath();
        ctx.ellipse(0, 0, drawRadius * 1.35, drawRadius * 1.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const hasArena = slime.arenaAbility !== 'None';
      const energyY = -drawRadius - 8;
      const hpY = hasArena ? -drawRadius - 17 : -drawRadius - 8;

      if (hasArena) {
        const nextProc = slimeAbilityNextProcRef.current[slime.id];
        const chargeStart = chargeStartRef.current[slime.id];
        const totalChargeTime =
          nextProc !== undefined && chargeStart !== undefined
            ? Math.max(1, nextProc - chargeStart)
            : 1;
        const elapsed = chargeStart !== undefined ? Math.max(0, timeNow - chargeStart) : 0;
        const chargeProgress = Math.min(1, elapsed / totalChargeTime);
        drawArenaUltBar(ctx, chargeProgress, procRaw > 0, energyY);
      }

      drawHpBarArena(ctx, hpRatio, hpY, side);

      ctx.restore();
    };

    pl.forEach((s, i) => {
      const pos = slimesRef.current[s.id];
      const hp = hpPlayerRef.current[i] ?? 1;
      if (pos && hp > 0) drawSlimeBody(s, pos, hp, 'player');
    });
    en.forEach((e, i) => {
      const pos = slimesRef.current[e.id];
      const hp = hpEnemyRef.current[i] ?? 1;
      if (pos && hp > 0) drawSlimeBody(enemyAsSlime(e), pos, hp, 'enemy');
    });

    // — Throttled HUD stats update (player team only, ~20 fps) —
    if (onStatsUpdateRef.current && timeNow - lastStatsUpdateRef.current >= 50) {
      lastStatsUpdateRef.current = timeNow;
      onStatsUpdateRef.current({
        hp: [...hpPlayerRef.current],
        abilityNextProc: { ...slimeAbilityNextProcRef.current },
        chargeStart: { ...chargeStartRef.current },
      });
    }
  });

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden rounded-xl border border-violet-500/20 bg-slate-950"
    >
      <canvas ref={canvasRef} className="block h-full min-h-[200px] w-full touch-none" />
    </div>
  );
}
