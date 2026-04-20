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
  type ArenaEnemyDisplay,
} from '../constants';

type EnergyOrb = { id: number; x: number; y: number; scale: number };

type SlimePos = { x: number; y: number; targetId?: number };

function enemyAsSlime(e: ArenaEnemyDisplay): Slime {
  return {
    id: e.id,
    name: e.name,
    color: e.color,
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
  playerHpRatios: number[];
  enemyHpRatios: number[];
  playerAbilityFiredRef: React.MutableRefObject<Record<string, boolean>>;
  onAbilityFired?: (id: string) => void;
};

export function ArenaBattleCanvas({
  playerSlimes,
  enemies,
  playerHpRatios,
  enemyHpRatios,
  playerAbilityFiredRef,
  onAbilityFired,
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
  const propsRef = useRef({
    playerSlimes,
    enemies,
    playerHpRatios,
    enemyHpRatios,
  });
  propsRef.current = { playerSlimes, enemies, playerHpRatios, enemyHpRatios };

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
    for (const s of ps) {
      if (!slimesRef.current[s.id]) {
        slimesRef.current[s.id] = {
          x: 12 + Math.random() * (midX - 40),
          y: 20 + Math.random() * (height - 40),
        };
      }
    }
    for (const e of en) {
      if (!slimesRef.current[e.id]) {
        slimesRef.current[e.id] = {
          x: midX + 12 + Math.random() * (width / 2 - 36),
          y: 20 + Math.random() * (height - 40),
        };
      }
    }
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

    const updateSlime = (
      slime: Slime,
      index: number,
      team: Slime[],
      orbList: EnergyOrb[],
      anchor: { x: number; y: number },
      side: 'left' | 'right'
    ) => {
      if (!slimesRef.current[slime.id]) {
        slimesRef.current[slime.id] = { x: anchor.x, y: anchor.y };
      }
      const sPos = slimesRef.current[slime.id]!;
      const effect = TRAIT_EFFECTS[slime.trait];
      const selfSpeedBuff = isTraitCycleActive && effect.selfSpeed ? effect.selfSpeed : 0;
      const finalSlimeSpeed =
        BASE_SLIME_SPEED * (1 + slime.stats.agility / 20) * (1 + selfSpeedBuff) * (1 + globalSlimeSpeedBuff);

      let sMoveDir = { x: 0, y: 0 };
      const inSide = (o: EnergyOrb) => (side === 'left' ? o.x < midX - 4 : o.x > midX + 4);
      const pool = orbList.filter(inSide);

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
          sMoveDir = { x: dx / dist, y: dy / dist };
        }
      } else {
        const dx = anchor.x - sPos.x;
        const dy = anchor.y - sPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 40) {
          sMoveDir = { x: dx / dist, y: dy / dist };
        }
      }

      const time = Date.now() / 1000;
      const wanderAngle = (time + index * 123.45) * 2;
      const wanderX = Math.cos(wanderAngle) * 0.4;
      const wanderY = Math.sin(wanderAngle) * 0.4;
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

      if (side === 'left') {
        sPos.x = Math.min(sPos.x, midX - 14);
      } else {
        sPos.x = Math.max(sPos.x, midX + 14);
      }
      sPos.x = Math.max(10, Math.min(width - 10, sPos.x));
      sPos.y = Math.max(10, Math.min(height - 10, sPos.y));

    };

    const pl = propsRef.current.playerSlimes;
    const en = propsRef.current.enemies;
    const anchorLeft = { x: width * 0.26, y: height * 0.52 };
    const anchorRight = { x: width * 0.74, y: height * 0.48 };

    const enemyTeam = en.map(enemyAsSlime);
    pl.forEach((s, i) => updateSlime(s, i, pl, energyLeftRef.current, anchorLeft, 'left'));
    enemyTeam.forEach((slime, i) => {
      updateSlime(slime, i + 10, enemyTeam, energyRightRef.current, anchorRight, 'right');
    });

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

      ctx.save();
      ctx.translate(pos.x, pos.y + jumpY);

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

      const hasTrait = slime.trait !== 'None';
      const hasArena = slime.arenaAbility !== 'None';
      const traitY = -drawRadius - 8;
      const energyY = hasTrait ? -drawRadius - 17 : -drawRadius - 8;
      const hpY =
        hasTrait && hasArena ? -drawRadius - 26 : hasTrait || hasArena ? -drawRadius - 17 : -drawRadius - 8;

      if (hasTrait) {
        const barWidth = 24;
        const barHeight = 3;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.roundRect(-barWidth / 2, traitY, barWidth, barHeight, 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        const t = time % cycleTime;
        let progress = 0;
        let color = '#f97316';
        if (isTraitCycleActive) {
          progress = t / activeDuration;
        } else {
          progress = (t - activeDuration) / (cycleTime - activeDuration);
          color = '#FFFFFF';
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-barWidth / 2, traitY, barWidth * Math.max(0, Math.min(1, progress)), barHeight, 2);
        ctx.fill();
      }

      if (hasArena) {
        const e = energyLevelRef.current[slime.id] ?? 0;
        drawArenaEnergyBar(ctx, e, energyY);
      }

      drawHpBarArena(ctx, hpRatio, hpY, side);

      ctx.restore();
    };

    const { playerHpRatios: ph, enemyHpRatios: eh } = propsRef.current;
    pl.forEach((s, i) => {
      const pos = slimesRef.current[s.id];
      if (pos) drawSlimeBody(s, pos, ph[i] ?? 1, 'player');
    });
    en.forEach((e, i) => {
      const pos = slimesRef.current[e.id];
      if (pos) drawSlimeBody(enemyAsSlime(e), pos, eh[i] ?? 1, 'enemy');
    });
  });

  return (
    <div ref={containerRef} className="relative min-h-[200px] w-full flex-1 overflow-hidden rounded-xl border border-violet-500/20 bg-slate-950">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" style={{ minHeight: 200 }} />
    </div>
  );
}
