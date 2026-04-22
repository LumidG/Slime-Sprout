import React, { useEffect, useRef } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';
import type { Slime } from '../types';
import type { SlimeArenaAbility } from '../types';
import {
  BASE_SLIME_SPEED,
  BASE_SLIME_COLLECT_RADIUS,
  TRAIT_EFFECTS,
  ARENA_ENERGY_PER_ORB,
  ARENA_ENERGY_ORBS_PER_SIDE,
  ARENA_ENERGY_RESPAWN_MS,
  ARENA_ABILITY_PROC_MS,
  ARENA_MELEE_MIN_SEPARATION_PX,
  ARENA_MELEE_MIN_ATTACK_DIST_PX,
  ARENA_MELEE_MAX_ATTACK_DIST_PX,
  ARENA_MELEE_HIT_DAMAGE,
  ARENA_MELEE_PAIR_ATTACK_INTERVAL_MS,
  ARENA_MELEE_POST_SWING_MS,
  ARENA_MELEE_ATTACK_ANIM_MS,
  ARENA_TEAM_SIZE,
  type ArenaEnemyDisplay,
} from '../constants';
import { drawSlimeSpriteStack, loadSlimeSpriteImageCache } from '../slimeSprites';

type EnergyOrb = { id: number; x: number; y: number; scale: number };

type SlimePos = { x: number; y: number; targetId?: number };

/** Vertical lineup on the left or right edge of the arena (paired slots face each other across X). */
function arenaVerticalSideAnchor(
  width: number,
  height: number,
  index: number,
  teamSize: number,
  side: 'left' | 'right'
): { x: number; y: number } {
  const marginX = Math.max(14, width * 0.07);
  const x = side === 'left' ? marginX : width - marginX;
  const marginY = 28;
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
    stats: { health: 12, strength: 12, agility: e.agility },
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

function drawArenaEnergyBar(ctx: CanvasRenderingContext2D, energy01: number, barY: number) {
  const barW = 30;
  const barH = 4;
  const fill = Math.max(0, Math.min(1, energy01));
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(-barW / 2, barY, barW, barH, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.6)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  const g = ctx.createLinearGradient(-barW / 2, barY, barW / 2, barY);
  g.addColorStop(0, '#a78bfa');
  g.addColorStop(0.5, '#38bdf8');
  g.addColorStop(1, '#f472b6');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-barW / 2, barY, barW * fill, barH, 2);
  ctx.fill();
  ctx.restore();
}

type Props = {
  playerSlimes: Slime[];
  enemies: ArenaEnemyDisplay[];
  playerAbilityFiredRef: React.MutableRefObject<Record<string, boolean>>;
  onAbilityFired?: (id: string) => void;
  /** When true, the canvas still renders but slime movement, orbs, and melee do not advance. */
  paused?: boolean;
};

export function ArenaBattleCanvas({
  playerSlimes,
  enemies,
  playerAbilityFiredRef,
  onAbilityFired,
  paused = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dims = useRef({ width: 400, height: 320 });
  const slimesRef = useRef<Record<string, SlimePos>>({});
  const energyLeftRef = useRef<EnergyOrb[]>([]);
  const energyRightRef = useRef<EnergyOrb[]>([]);
  const energyLevelRef = useRef<Record<string, number>>({});
  const lastAbilityProcRef = useRef<Record<string, number>>({});
  const nextOrbId = useRef(0);
  const lastRespawnRef = useRef(0);
  /** Decorative 0–1 HP (outcome still uses stat resolution in App). */
  const hpPlayerRef = useRef<number[]>(Array.from({ length: ARENA_TEAM_SIZE }, () => 1));
  const hpEnemyRef = useRef<number[]>(Array.from({ length: ARENA_TEAM_SIZE }, () => 1));
  const hitFlashUntilRef = useRef<Record<string, number>>({});
  /** Active melee special-attack animation toward opponent. */
  const meleeAttackAnimRef = useRef<Record<string, { startMs: number; tx: number; ty: number }>>({});
  /** Per pair index: 0 = player’s turn to strike, 1 = enemy’s turn. */
  const pairAttackPhaseRef = useRef<number[]>([0, 0, 0, 0]);
  /** Next allowed strike time (ms); null until first scheduled. */
  const pairNextAttackRef = useRef<(number | null)[]>([null, null, null, null]);
  const propsRef = useRef({
    playerSlimes,
    enemies,
  });
  propsRef.current = { playerSlimes, enemies };

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

  const initIfNeeded = (width: number, height: number) => {
    const midX = width / 2;
    const seedOrbs = (list: EnergyOrb[], minX: number, maxX: number) => {
      while (list.length < ARENA_ENERGY_ORBS_PER_SIDE) {
        list.push({
          id: nextOrbId.current++,
          x: minX + Math.random() * Math.max(8, maxX - minX - 16),
          y: 16 + Math.random() * (height - 32),
          scale: 1,
        });
      }
    };
    if (energyLeftRef.current.length === 0) seedOrbs(energyLeftRef.current, 8, midX - 8);
    if (energyRightRef.current.length === 0) seedOrbs(energyRightRef.current, midX + 8, width - 8);

    const { playerSlimes: ps, enemies: en } = propsRef.current;
    ps.forEach((s, i) => {
      if (!slimesRef.current[s.id]) {
        const a = arenaVerticalSideAnchor(width, height, i, ps.length, 'left');
        slimesRef.current[s.id] = { x: a.x, y: a.y };
      }
    });
    en.forEach((e, i) => {
      if (!slimesRef.current[e.id]) {
        const a = arenaVerticalSideAnchor(width, height, i, en.length, 'right');
        slimesRef.current[e.id] = { x: a.x, y: a.y };
      }
    });
  };

  useGameLoop((deltaTime) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { width, height } = dims.current;
    if (width < 20 || height < 20) return;

    initIfNeeded(width, height);

    const frameScale = deltaTime / 16.67;
    const timeNow = Date.now();
    const midX = width / 2;

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
      orbList: EnergyOrb[],
      anchor: { x: number; y: number },
      side: 'left' | 'right',
      opponentPos: { x: number; y: number } | null
    ) => {
      if (!slimesRef.current[slime.id]) {
        slimesRef.current[slime.id] = { x: anchor.x, y: anchor.y };
      }
      const sPos = slimesRef.current[slime.id]!;
      const effect = TRAIT_EFFECTS[slime.trait];
      const selfSpeedBuff = isTraitCycleActive && effect.selfSpeed ? effect.selfSpeed : 0;
      const finalSlimeSpeed =
        BASE_SLIME_SPEED * (1 + slime.stats.agility / 20) * (1 + selfSpeedBuff) * (1 + globalSlimeSpeedBuff);

      const inSide = (o: EnergyOrb) => (side === 'left' ? o.x < midX - 4 : o.x > midX + 4);
      const pool = orbList.filter(inSide);

      let orbDir = { x: 0, y: 0 };
      if (pool.length > 0) {
        let target = pool.find((o) => o.id === sPos.targetId);
        if (!target) {
          const orbsWithDist = pool
            .map((o) => ({
              orb: o,
              distSq: (o.x - sPos.x) ** 2 + (o.y - sPos.y) ** 2,
            }))
            .sort((a, b) => a.distSq - b.distSq);
          const poolSize = Math.min(3, orbsWithDist.length);
          target = orbsWithDist[Math.floor(Math.random() * poolSize)]!.orb;
          sPos.targetId = target.id;
        }
        const dx = target.x - sPos.x;
        const dy = target.y - sPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          orbDir = { x: dx / dist, y: dy / dist };
        }
      } else {
        const dx = anchor.x - sPos.x;
        const dy = anchor.y - sPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 40) {
          orbDir = { x: dx / dist, y: dy / dist };
        }
      }

      let chaseDir = { x: 0, y: 0 };
      if (opponentPos) {
        const dx = opponentPos.x - sPos.x;
        const dy = opponentPos.y - sPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          const nx = dx / dist;
          const ny = dy / dist;
          if (dist > ARENA_MELEE_MAX_ATTACK_DIST_PX) {
            chaseDir = { x: nx, y: ny };
          } else if (dist < ARENA_MELEE_MIN_SEPARATION_PX + 6) {
            chaseDir = { x: -nx * 0.32, y: -ny * 0.32 };
          } else {
            const px = -ny;
            const py = nx;
            chaseDir = { x: px * 0.38, y: py * 0.38 };
          }
        }
      }

      const orbLen = Math.hypot(orbDir.x, orbDir.y);
      let sMoveDir = { x: 0, y: 0 };
      if (opponentPos && (chaseDir.x !== 0 || chaseDir.y !== 0)) {
        const cw = 0.58;
        const ow = 0.42;
        if (orbLen > 0.01) {
          sMoveDir = {
            x: chaseDir.x * cw + orbDir.x * ow,
            y: chaseDir.y * cw + orbDir.y * ow,
          };
        } else {
          sMoveDir = chaseDir;
        }
        const m = Math.hypot(sMoveDir.x, sMoveDir.y);
        if (m > 0.01) {
          sMoveDir = { x: sMoveDir.x / m, y: sMoveDir.y / m };
        }
      } else if (orbLen > 0.01) {
        sMoveDir = orbDir;
      } else {
        sMoveDir = chaseDir;
      }

      const time = Date.now() / 1000;
      const wanderAngle = (time + index * 123.45) * 1.4;
      const wanderAmp = opponentPos ? 0.1 : 0.18;
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
        if (dist < 25 && dist > 0) {
          const push = (25 - dist) * 0.05;
          sPos.x += (dx / dist) * push;
          sPos.y += (dy / dist) * push;
        }
      });

      const pDx = sPos.x - anchor.x;
      const pDy = sPos.y - anchor.y;
      const pDist = Math.hypot(pDx, pDy);
      if (pDist < 22 && pDist > 0) {
        const push = (22 - pDist) * 0.1;
        sPos.x += (pDx / pDist) * push;
        sPos.y += (pDy / pDist) * push;
      }

      /** Let both teams meet in the center for melee (was hard-split at midline). */
      if (side === 'left') {
        sPos.x = Math.min(sPos.x, midX + 44);
      } else {
        sPos.x = Math.max(sPos.x, midX - 44);
      }
      sPos.x = Math.max(10, Math.min(width - 10, sPos.x));
      sPos.y = Math.max(10, Math.min(height - 10, sPos.y));

    };

    pl.forEach((s, i) => {
      const foe = en[i];
      const fp = foe ? slimesRef.current[foe.id] : undefined;
      const opp = fp ? { x: fp.x, y: fp.y } : null;
      const anchorLeft = arenaVerticalSideAnchor(width, height, i, pl.length, 'left');
      updateSlime(s, i, pl, energyLeftRef.current, anchorLeft, 'left', opp);
    });
    enemyTeam.forEach((slime, i) => {
      const pal = pl[i];
      const pp = pal ? slimesRef.current[pal.id] : undefined;
      const opp = pp ? { x: pp.x, y: pp.y } : null;
      const anchorRight = arenaVerticalSideAnchor(width, height, i, enemyTeam.length, 'right');
      updateSlime(slime, i + 10, enemyTeam, energyRightRef.current, anchorRight, 'right', opp);
    });

    const separateOpposing = () => {
      for (let a = 0; a < pl.length; a++) {
        for (let b = 0; b < en.length; b++) {
          const pa = slimesRef.current[pl[a]!.id];
          const pb = slimesRef.current[en[b]!.id];
          if (!pa || !pb) continue;
          const dx = pb.x - pa.x;
          const dy = pb.y - pa.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          if (dist >= ARENA_MELEE_MIN_SEPARATION_PX) continue;
          const push = ((ARENA_MELEE_MIN_SEPARATION_PX - dist) / 2) * 0.75;
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
        p.x = Math.max(10, Math.min(width - 10, p.x));
        p.y = Math.max(10, Math.min(height - 10, p.y));
      }
      for (const e of en) {
        const p = slimesRef.current[e.id];
        if (!p) continue;
        p.x = Math.max(10, Math.min(width - 10, p.x));
        p.y = Math.max(10, Math.min(height - 10, p.y));
      }
    };
    clampAll();

    const meleeSwingReady = (id: string) => {
      const a = meleeAttackAnimRef.current[id];
      if (!a) return true;
      return timeNow - a.startMs >= ARENA_MELEE_ATTACK_ANIM_MS;
    };

    for (let i = 0; i < Math.min(pl.length, en.length); i++) {
      if (pairNextAttackRef.current[i] == null) {
        pairNextAttackRef.current[i] =
          timeNow + 240 + i * Math.floor(ARENA_MELEE_PAIR_ATTACK_INTERVAL_MS / 5);
      }
    }

    for (let i = 0; i < Math.min(pl.length, en.length); i++) {
      const pSlime = pl[i]!;
      const eDisp = en[i]!;
      const pPos = slimesRef.current[pSlime.id];
      const ePos = slimesRef.current[eDisp.id];
      if (!pPos || !ePos) continue;
      const dist = Math.hypot(pPos.x - ePos.x, pPos.y - ePos.y);
      if (dist < ARENA_MELEE_MIN_ATTACK_DIST_PX || dist > ARENA_MELEE_MAX_ATTACK_DIST_PX) continue;
      const nextT = pairNextAttackRef.current[i];
      if (nextT == null || timeNow < nextT) continue;

      const eSlime = enemyTeam[i]!;
      const pStr = Math.max(2, pSlime.stats.strength);
      const eStr = Math.max(2, eSlime.stats.strength);
      const flashUntil = timeNow + 160;
      const phase = pairAttackPhaseRef.current[i] ?? 0;

      if (phase === 0) {
        if (!meleeSwingReady(pSlime.id)) continue;
        const dmg = ARENA_MELEE_HIT_DAMAGE * (pStr / 10);
        hpEnemyRef.current[i] = Math.max(0, (hpEnemyRef.current[i] ?? 1) - dmg);
        hitFlashUntilRef.current[eDisp.id] = flashUntil;
        const mx = ePos.x - pPos.x;
        const my = ePos.y - pPos.y;
        const ml = Math.hypot(mx, my) || 1;
        meleeAttackAnimRef.current[pSlime.id] = { startMs: timeNow, tx: mx / ml, ty: my / ml };
        pairAttackPhaseRef.current[i] = 1;
      } else {
        if (!meleeSwingReady(eDisp.id)) continue;
        const dmg = ARENA_MELEE_HIT_DAMAGE * (eStr / 12);
        hpPlayerRef.current[i] = Math.max(0, (hpPlayerRef.current[i] ?? 1) - dmg);
        hitFlashUntilRef.current[pSlime.id] = flashUntil;
        const mx = pPos.x - ePos.x;
        const my = pPos.y - ePos.y;
        const ml = Math.hypot(mx, my) || 1;
        meleeAttackAnimRef.current[eDisp.id] = { startMs: timeNow, tx: mx / ml, ty: my / ml };
        pairAttackPhaseRef.current[i] = 0;
      }
      pairNextAttackRef.current[i] =
        timeNow + ARENA_MELEE_ATTACK_ANIM_MS + ARENA_MELEE_POST_SWING_MS;
    }

    const slimeRadius = BASE_SLIME_COLLECT_RADIUS * (1 + globalRadiusBuff);

    const collectOrbs = (orbs: EnergyOrb[], teamSlimes: Slime[], playerTeam: boolean): EnergyOrb[] => {
      const remaining: EnergyOrb[] = [];
      for (const orb of orbs) {
        let best: { slime: Slime; d: number } | null = null;
        for (const slime of teamSlimes) {
          const pos = slimesRef.current[slime.id];
          if (!pos) continue;
          const d = Math.hypot(orb.x - pos.x, orb.y - pos.y);
          if (d >= slimeRadius) continue;
          if (!best || d < best.d) best = { slime, d };
        }
        if (!best) {
          remaining.push(orb);
          continue;
        }
        const slime = best.slime;
        if (slime.arenaAbility !== 'None') {
          let e = energyLevelRef.current[slime.id] ?? 0;
          e += ARENA_ENERGY_PER_ORB;
          if (e >= 1) {
            e = 0;
            lastAbilityProcRef.current[slime.id] = timeNow;
            if (playerTeam) {
              playerAbilityFiredRef.current[slime.id] = true;
            }
            onAbilityFired?.(slime.id);
          }
          energyLevelRef.current[slime.id] = e;
        }
      }
      return remaining;
    };

    energyLeftRef.current = collectOrbs(energyLeftRef.current, pl, true);
    energyRightRef.current = collectOrbs(energyRightRef.current, enemyTeam, false);

    const now = Date.now();
    if (now - lastRespawnRef.current > ARENA_ENERGY_RESPAWN_MS) {
      lastRespawnRef.current = now;
      const spawn = (list: EnergyOrb[], minX: number, maxX: number) => {
        if (list.length < ARENA_ENERGY_ORBS_PER_SIDE) {
          list.push({
            id: nextOrbId.current++,
            x: minX + Math.random() * Math.max(8, maxX - minX - 16),
            y: 16 + Math.random() * (height - 32),
            scale: 1,
          });
        }
      };
      spawn(energyLeftRef.current, 8, midX - 8);
      spawn(energyRightRef.current, midX + 8, width - 8);
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

    const drawEnergyOrb = (orb: EnergyOrb) => {
      if (orb.scale < 1) orb.scale += 0.05;
      ctx.save();
      ctx.translate(orb.x, orb.y);
      ctx.scale(orb.scale, orb.scale);
      const pulse = 0.85 + Math.sin(timeNow / 180) * 0.12;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(1, 9, 6, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 10);
      g.addColorStop(0, `rgba(196, 181, 253, ${pulse})`);
      g.addColorStop(0.45, 'rgba(56, 189, 248, 0.95)');
      g.addColorStop(1, 'rgba(167, 139, 250, 0.35)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.arc(-2.5, -2.5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    energyLeftRef.current.forEach(drawEnergyOrb);
    energyRightRef.current.forEach(drawEnergyOrb);

    const drawSlimeBody = (slime: Slime, pos: SlimePos, hpRatio: number, side: 'player' | 'enemy') => {
      const meleeHitFlash =
        (hitFlashUntilRef.current[slime.id] ?? 0) > timeNow;
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
      const burstPulse = isBursting ? Math.sin(time / 100) * 0.05 + 1.05 : 1.0;
      const baseRadius = 10;
      const drawRadius = baseRadius * burstPulse;

      const tProc = lastAbilityProcRef.current[slime.id];
      const procRaw = tProc
        ? Math.max(0, 1 - (timeNow - tProc) / ARENA_ABILITY_PROC_MS)
        : 0;

      let lungeX = 0;
      let lungeY = 0;
      let meleeProg: number | null = null;
      let meleeTx = 0;
      let meleeTy = 0;
      const atkAnim = meleeAttackAnimRef.current[slime.id];
      if (atkAnim) {
        const age = timeNow - atkAnim.startMs;
        if (age >= ARENA_MELEE_ATTACK_ANIM_MS) {
          delete meleeAttackAnimRef.current[slime.id];
        } else {
          meleeProg = age / ARENA_MELEE_ATTACK_ANIM_MS;
          meleeTx = atkAnim.tx;
          meleeTy = atkAnim.ty;
          const ease = Math.sin(meleeProg * Math.PI);
          lungeX = atkAnim.tx * ease * 6;
          lungeY = atkAnim.ty * ease * 6;
        }
      }

      ctx.save();
      ctx.translate(pos.x, pos.y + jumpY);
      ctx.translate(lungeX, lungeY);

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
        ctx.scale(1 / squashStretch, squashStretch);
        drewSprites = drawSlimeSpriteStack(ctx, cache, slime, stackSize);
        ctx.restore();
      }
      if (!drewSprites) {
        ctx.fillStyle = slime.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, drawRadius / squashStretch, drawRadius * squashStretch, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(-drawRadius * 0.3, -drawRadius * 0.3, drawRadius * 0.2, drawRadius * 0.4, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
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

      if (meleeProg !== null) {
        drawArenaMeleeSpecialAttackVfx(ctx, slime.arenaAbility, meleeProg, meleeTx, meleeTy, drawRadius);
      }

      if (meleeHitFlash) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.ellipse(0, 0, (drawRadius * 1.08) / squashStretch, drawRadius * 1.08 * squashStretch, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const hasArena = slime.arenaAbility !== 'None';
      const energyY = -drawRadius - 8;
      const hpY = hasArena ? -drawRadius - 17 : -drawRadius - 8;

      if (hasArena) {
        const e = energyLevelRef.current[slime.id] ?? 0;
        drawArenaEnergyBar(ctx, e, energyY);
      }

      drawHpBarArena(ctx, hpRatio, hpY, side);

      ctx.restore();
    };

    pl.forEach((s, i) => {
      const pos = slimesRef.current[s.id];
      if (pos) drawSlimeBody(s, pos, hpPlayerRef.current[i] ?? 1, 'player');
    });
    en.forEach((e, i) => {
      const pos = slimesRef.current[e.id];
      if (pos) drawSlimeBody(enemyAsSlime(e), pos, hpEnemyRef.current[i] ?? 1, 'enemy');
    });
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
