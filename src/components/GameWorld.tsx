import React, { useRef, useEffect } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';
import { Slime } from '../types';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  COIN_CAP, 
  COIN_SPAWN_INSETS,
  COIN_SPAWN_INSET_X_WITH_WORLD_NAV,
  BASE_RESPAWN_TIME, 
  BASE_MOVEMENT_SPEED, 
  BASE_SLIME_SPEED,
  BASE_COLLECT_RADIUS,
  BASE_SLIME_COLLECT_RADIUS,
  TRAIT_EFFECTS,
  GAME_WORLDS,
  type GameWorldDecoration
} from '../constants';

interface Coin {
  id: number;
  x: number;
  y: number;
  scale: number;
}

interface Effect {
  id: number;
  type: 'collect' | 'trait_speed' | 'trait_magnetic' | 'trait_luck' | 'trait_power';
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
  vx?: number;
  vy?: number;
  size?: number;
}

interface GroundTrailParticle {
  id: number;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  kind: GameWorldDecoration;
  color: string;
  size: number;
}

const MAX_GROUND_TRAIL_PARTICLES = 140;

const GRASS_TRAIL_COLORS = [
  'rgba(34, 197, 94, 0.52)',
  'rgba(74, 222, 128, 0.48)',
  'rgba(163, 230, 53, 0.44)',
  'rgba(21, 128, 61, 0.4)',
];

const FLOWER_TRAIL_COLORS = [
  'rgba(244, 114, 182, 0.52)',
  'rgba(192, 132, 252, 0.48)',
  'rgba(251, 191, 36, 0.44)',
  'rgba(236, 72, 153, 0.42)',
];

const REED_TRAIL_COLORS = [
  'rgba(13, 148, 136, 0.48)',
  'rgba(45, 212, 191, 0.44)',
  'rgba(19, 78, 74, 0.46)',
  'rgba(94, 234, 212, 0.4)',
];

const SAND_TRAIL_COLORS = [
  'rgba(217, 119, 6, 0.55)',
  'rgba(251, 191, 36, 0.5)',
  'rgba(252, 211, 77, 0.45)',
  'rgba(180, 83, 9, 0.4)',
];

const SNOW_TRAIL_COLORS = [
  'rgba(255, 255, 255, 0.82)',
  'rgba(224, 242, 254, 0.7)',
  'rgba(186, 230, 253, 0.6)',
  'rgba(248, 250, 252, 0.75)',
];

const MIST_TRAIL_COLORS = [
  'rgba(228, 228, 231, 0.42)',
  'rgba(244, 244, 245, 0.38)',
  'rgba(212, 212, 216, 0.36)',
  'rgba(250, 250, 250, 0.34)',
];

function trailColorsFor(kind: GameWorldDecoration): readonly string[] {
  switch (kind) {
    case 'grass':
      return GRASS_TRAIL_COLORS;
    case 'flowers':
      return FLOWER_TRAIL_COLORS;
    case 'reeds':
      return REED_TRAIL_COLORS;
    case 'sand':
      return SAND_TRAIL_COLORS;
    case 'snow':
      return SNOW_TRAIL_COLORS;
    case 'mist':
      return MIST_TRAIL_COLORS;
  }
}

function spawnGroundTrailParticles(
  list: GroundTrailParticle[],
  nextId: React.MutableRefObject<number>,
  anchorX: number,
  anchorY: number,
  dx: number,
  dy: number,
  kind: GameWorldDecoration,
  count: number
) {
  const dist = Math.hypot(dx, dy);
  if (dist < 0.06) return;

  const backAng = Math.atan2(dy, dx) + Math.PI;
  const colors = trailColorsFor(kind);
  const capped = Math.min(5, Math.max(1, count));

  for (let i = 0; i < capped; i++) {
    const spread = (Math.random() - 0.5) * 1.1;
    const r = 2 + Math.random() * 6;
    const px = anchorX + Math.cos(backAng + spread) * r + (Math.random() - 0.5) * 7;
    const py = anchorY + Math.sin(backAng + spread) * r + (Math.random() - 0.5) * 5;

    let size: number;
    let life: number;
    let vx: number;
    let vy: number;

    switch (kind) {
      case 'mist':
        size = 2.2 + Math.random() * 3.2;
        life = 38 + Math.random() * 22;
        vx = (Math.random() - 0.5) * 0.55;
        vy = -0.32 - Math.random() * 0.42;
        break;
      case 'snow':
        size = 0.9 + Math.random() * 2.2;
        life = 20 + Math.random() * 16;
        vx = (Math.random() - 0.5) * 0.45;
        vy = (Math.random() - 0.5) * 0.35;
        break;
      case 'flowers':
        size = 0.85 + Math.random() * 2;
        life = 24 + Math.random() * 18;
        vx = (Math.random() - 0.5) * 0.62;
        vy = Math.random() * 0.26 - 0.06;
        break;
      case 'grass':
      case 'reeds':
        size = 1 + Math.random() * 2.2;
        life = 22 + Math.random() * 16;
        vx = (Math.random() - 0.5) * 0.62;
        vy = Math.random() * 0.3 + 0.06;
        break;
      case 'sand':
        size = 1.1 + Math.random() * 2.4;
        life = 26 + Math.random() * 18;
        vx = (Math.random() - 0.5) * 0.7;
        vy = Math.random() * 0.35;
        break;
    }

    list.push({
      id: nextId.current++,
      x: px,
      y: py,
      life,
      maxLife: life,
      vx,
      vy,
      kind,
      color: colors[Math.floor(Math.random() * colors.length)],
      size,
    });
  }

  while (list.length > MAX_GROUND_TRAIL_PARTICLES) {
    list.shift();
  }
}

function drawGroundTrailParticles(ctx: CanvasRenderingContext2D, particles: GroundTrailParticle[]) {
  for (const p of particles) {
    const t = p.life / p.maxLife;
    let alphaMul = 0.88;
    if (p.kind === 'mist') alphaMul = 0.4;
    else if (p.kind === 'snow') alphaMul = 0.85;
    else if (p.kind === 'flowers') alphaMul = 0.82;
    else if (p.kind === 'grass' || p.kind === 'reeds') alphaMul = 0.86;

    ctx.globalAlpha = Math.max(0, t) * alphaMul;
    ctx.fillStyle = p.color;
    const radius = p.size * (0.65 + 0.35 * t);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.kind === 'mist' ? radius * 1.2 : radius, 0, Math.PI * 2);
    ctx.fill();
    if (p.kind === 'snow') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

interface GameWorldProps {
  onCollect: (count: number) => void;
  automationLevel: number;
  movementSpeedLevel: number;
  respawnTimeLevel: number;
  equippedSlimes: Slime[];
  /** Visual theme index 0–5 */
  worldIndex: number;
  /** Wider horizontal inset when the previous-world chevron is shown */
  insetLeftForWorldNav?: boolean;
  /** Wider horizontal inset when the next-world chevron is shown */
  insetRightForWorldNav?: boolean;
}

function getCoinSpawnBounds(
  width: number,
  height: number,
  insetLeftWide: boolean,
  insetRightWide: boolean
) {
  const left = insetLeftWide ? COIN_SPAWN_INSET_X_WITH_WORLD_NAV : COIN_SPAWN_INSETS.left;
  const right = insetRightWide ? COIN_SPAWN_INSET_X_WITH_WORLD_NAV : COIN_SPAWN_INSETS.right;
  const minX = left;
  const maxX = width - right;
  const minY = COIN_SPAWN_INSETS.top;
  const maxY = height - COIN_SPAWN_INSETS.bottom;
  return { minX, maxX, minY, maxY };
}

function randomCoinPositionInBounds(
  width: number,
  height: number,
  insetLeftWide: boolean,
  insetRightWide: boolean
): { x: number; y: number } {
  const { minX, maxX, minY, maxY } = getCoinSpawnBounds(width, height, insetLeftWide, insetRightWide);
  if (maxX <= minX || maxY <= minY) {
    const r = 12;
    return {
      x: Math.max(r, Math.min(width - r, width / 2)),
      y: Math.max(r, Math.min(height - r, height / 2)),
    };
  }
  return {
    x: Math.random() * (maxX - minX) + minX,
    y: Math.random() * (maxY - minY) + minY,
  };
}

function isCoinInSpawnBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  insetLeftWide: boolean,
  insetRightWide: boolean
): boolean {
  const { minX, maxX, minY, maxY } = getCoinSpawnBounds(width, height, insetLeftWide, insetRightWide);
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function drawWorldDecoration(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  decoration: GameWorldDecoration,
  accent: string
) {
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = 1;

  switch (decoration) {
    case 'grass':
      for (let i = 0; i < width; i += 40) {
        for (let j = 0; j < height; j += 40) {
          ctx.beginPath();
          ctx.moveTo(i + 10, j + 10);
          ctx.lineTo(i + 12, j + 5);
          ctx.moveTo(i + 10, j + 10);
          ctx.lineTo(i + 8, j + 6);
          ctx.stroke();
        }
      }
      break;
    case 'flowers':
      // 40px grid; visibility between the old bold blobs and the ultra-subtle pass
      for (let i = 0; i < width; i += 40) {
        for (let j = 0; j < height; j += 40) {
          ctx.globalAlpha = 0.26;
          ctx.beginPath();
          ctx.arc(i + 10, j + 10, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.arc(i + 17, j + 15, 1.65, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      break;
    case 'reeds':
      ctx.lineWidth = 1.25;
      for (let i = 0; i < width; i += 14) {
        for (let j = 0; j < height; j += 28) {
          ctx.beginPath();
          ctx.moveTo(i, j + 20);
          ctx.quadraticCurveTo(i + 3, j + 8, i + 2, j);
          ctx.stroke();
        }
      }
      break;
    case 'sand':
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < width; i += 18) {
        for (let j = 0; j < height; j += 18) {
          if ((i + j) % 36 === 0) {
            ctx.beginPath();
            ctx.arc(i + (j % 7), j + (i % 5), 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      break;
    case 'snow':
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < width; i += 44) {
        for (let j = 0; j < height; j += 44) {
          ctx.beginPath();
          ctx.arc(i + 10, j + 10, 1.5, 0, Math.PI * 2);
          ctx.arc(i + 28, j + 24, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      break;
    case 'mist':
      ctx.globalAlpha = 0.12;
      ctx.lineWidth = 2;
      for (let j = 0; j < height; j += 24) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        for (let x = 0; x <= width; x += 40) {
          ctx.lineTo(x, j + Math.sin(x / 50) * 4);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    default:
      break;
  }
}

export const GameWorld: React.FC<GameWorldProps> = ({
  onCollect,
  automationLevel,
  movementSpeedLevel,
  respawnTimeLevel,
  equippedSlimes,
  worldIndex,
  insetLeftForWorldNav = false,
  insetRightForWorldNav = false,
}) => {
  const theme = GAME_WORLDS[Math.min(GAME_WORLDS.length - 1, Math.max(0, worldIndex))];
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dimensionsRef = useRef({ width: GAME_WIDTH, height: GAME_HEIGHT });
  const playerRef = useRef({ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, radius: 15 });
  const slimesRef = useRef<Record<string, { x: number, y: number, targetId?: number }>>({});
  const coinsRef = useRef<Coin[]>([]);
  const lastRespawnRef = useRef<number>(0);
  const nextCoinId = useRef(0);
  const nextEffectId = useRef(0);
  const nextGroundTrailId = useRef(0);
  const effectsRef = useRef<Effect[]>([]);
  const groundTrailRef = useRef<GroundTrailParticle[]>([]);
  const joystickRef = useRef<{
    active: boolean;
    curX: number;
    curY: number;
    maxRadius: number;
  }>({
    active: false,
    curX: 0,
    curY: 0,
    maxRadius: 40,
  });

  // Resize handler
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        dimensionsRef.current = { width, height };
        if (canvasRef.current) {
          canvasRef.current.width = width;
          canvasRef.current.height = height;
        }

        const r = playerRef.current.radius;
        if (width > r * 2 && height > r * 2) {
          playerRef.current.x = Math.max(r, Math.min(width - r, playerRef.current.x));
          playerRef.current.y = Math.max(r, Math.min(height - r, playerRef.current.y));
        }
        
        coinsRef.current = coinsRef.current.filter((c) =>
          isCoinInSpawnBounds(c.x, c.y, width, height, insetLeftForWorldNav, insetRightForWorldNav)
        );
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [insetLeftForWorldNav, insetRightForWorldNav]);

  const getCanvasCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // We update canvas.width directly so we don't need scaling math anymore
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const { x, y } = getCanvasCoords(e);
    joystickRef.current = {
      ...joystickRef.current,
      active: true,
      curX: x,
      curY: y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!joystickRef.current.active) return;
    const { x, y } = getCanvasCoords(e);
    joystickRef.current.curX = x;
    joystickRef.current.curY = y;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    joystickRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Initialize coins once (insets match first paint from App)
  useEffect(() => {
    const { width, height } = dimensionsRef.current;
    const w = width > 0 ? width : GAME_WIDTH;
    const h = height > 0 ? height : GAME_HEIGHT;

    const initialCoins: Coin[] = [];
    for (let i = 0; i < COIN_CAP; i++) {
      const { x, y } = randomCoinPositionInBounds(w, h, insetLeftForWorldNav, insetRightForWorldNav);
      initialCoins.push({
        id: nextCoinId.current++,
        x,
        y,
        scale: 1,
      });
    }
    coinsRef.current = initialCoins;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time spawn; inset props match first paint
  }, []);

  // Keep coins inside the playfield when world chevron overlays appear or disappear
  useEffect(() => {
    const { width, height } = dimensionsRef.current;
    const w = width > 0 ? width : GAME_WIDTH;
    const h = height > 0 ? height : GAME_HEIGHT;
    const { minX, maxX, minY, maxY } = getCoinSpawnBounds(w, h, insetLeftForWorldNav, insetRightForWorldNav);
    if (maxX <= minX || maxY <= minY) return;
    coinsRef.current = coinsRef.current.map((c) => ({
      ...c,
      x: Math.max(minX, Math.min(maxX, c.x)),
      y: Math.max(minY, Math.min(maxY, c.y)),
    }));
  }, [insetLeftForWorldNav, insetRightForWorldNav]);

  const respawnInterval = BASE_RESPAWN_TIME / (1 + respawnTimeLevel * 0.2);

  useGameLoop((deltaTime) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Calculate Buffs from traits
    let playerSpeedBuff = 0;
    let globalSlimeSpeedBuff = 0;
    let globalRadiusBuff = 0;
    
    const timeNow = Date.now();
    const cycleTime = 30000; // 30 seconds
    const activeDuration = 5000; // 5 seconds
    const isTraitCycleActive = (timeNow % cycleTime) < activeDuration;

    equippedSlimes.forEach(s => {
      const effect = TRAIT_EFFECTS[s.trait];
      if (isTraitCycleActive) {
        if (effect.playerSpeed) playerSpeedBuff += effect.playerSpeed;
        if (effect.slimeSpeed) globalSlimeSpeedBuff += effect.slimeSpeed;
        if (effect.radius) globalRadiusBuff += effect.radius;
      }
    });

    const movementSpeed = BASE_MOVEMENT_SPEED * (1 + movementSpeedLevel * 0.1) * (1 + playerSpeedBuff);
    const collectionRadius = BASE_COLLECT_RADIUS * (1 + globalRadiusBuff);

    const { width, height } = dimensionsRef.current;

    const trailDecoration = theme.decoration;

    // Update Player
    const frameScale = deltaTime / 16.67; // Normalize to 60fps
    
    let moveDir = { x: 0, y: 0 };
    let joystickSpeedMult = 1;

    if (joystickRef.current.active) {
      const baseX = playerRef.current.x;
      const baseY = playerRef.current.y;
      const dx = joystickRef.current.curX - baseX;
      const dy = joystickRef.current.curY - baseY;
      const dist = Math.hypot(dx, dy);
      
      if (dist > 2) {
        moveDir = { x: dx / dist, y: dy / dist };
        joystickSpeedMult = Math.min(dist / joystickRef.current.maxRadius, 1);
      }
    } else if (automationLevel > 0 && coinsRef.current.length > 0) {
      // Simple AI: move to nearest coin
      const nearest = coinsRef.current.reduce((prev, curr) => {
        const distPrev = Math.hypot(prev.x - playerRef.current.x, prev.y - playerRef.current.y);
        const distCurr = Math.hypot(curr.x - playerRef.current.x, curr.y - playerRef.current.y);
        return distCurr < distPrev ? curr : prev;
      });

      const dx = nearest.x - playerRef.current.x;
      const dy = nearest.y - playerRef.current.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 2) {
        moveDir = { x: dx / dist, y: dy / dist };
      }
    }

    const playerBeforeMove = { x: playerRef.current.x, y: playerRef.current.y };

    if (moveDir.x !== 0 || moveDir.y !== 0) {
      playerRef.current.x += moveDir.x * movementSpeed * frameScale * joystickSpeedMult;
      playerRef.current.y += moveDir.y * movementSpeed * frameScale * joystickSpeedMult;
    }

    // Bounds check
    playerRef.current.x = Math.max(playerRef.current.radius, Math.min(width - playerRef.current.radius, playerRef.current.x));
    playerRef.current.y = Math.max(playerRef.current.radius, Math.min(height - playerRef.current.radius, playerRef.current.y));

    {
      const pdx = playerRef.current.x - playerBeforeMove.x;
      const pdy = playerRef.current.y - playerBeforeMove.y;
      const pd = Math.hypot(pdx, pdy);
      if (pd > 0.08) {
        const footY = playerRef.current.y + 14;
        const intensity = Math.min(1, pd / 6);
        const n = 1 + Math.floor(intensity * 4);
        spawnGroundTrailParticles(
          groundTrailRef.current,
          nextGroundTrailId,
          playerRef.current.x,
          footY,
          pdx,
          pdy,
          trailDecoration,
          n
        );
      }
    }

    // Update Equipped Slimes
    equippedSlimes.forEach((slime, index) => {
      if (!slimesRef.current[slime.id]) {
        slimesRef.current[slime.id] = { 
          x: playerRef.current.x + (Math.random() - 0.5) * 60,
          y: playerRef.current.y + (Math.random() - 0.5) * 60 
        };
      }

      const sPos = slimesRef.current[slime.id];
      const slimeBeforeMove = { x: sPos.x, y: sPos.y };
      const effect = TRAIT_EFFECTS[slime.trait];
      const selfSpeedBuff = (isTraitCycleActive && effect.selfSpeed) ? effect.selfSpeed : 0;
      const finalSlimeSpeed = BASE_SLIME_SPEED * (1 + (slime.stats.agility / 20)) * (1 + selfSpeedBuff) * (1 + globalSlimeSpeedBuff);

      let sMoveDir = { x: 0, y: 0 };
      
      // Target finding with random persistence
      if (coinsRef.current.length > 0) {
        let target = coinsRef.current.find(c => c.id === sPos.targetId);
        
        if (!target) {
          // Pick a new target: top 3 nearest with some randomness
          const coinsWithDist = coinsRef.current.map(c => ({
            coin: c,
            distSq: Math.pow(c.x - sPos.x, 2) + Math.pow(c.y - sPos.y, 2)
          })).sort((a, b) => a.distSq - b.distSq);
          
          const poolSize = Math.min(3, coinsWithDist.length);
          target = coinsWithDist[Math.floor(Math.random() * poolSize)].coin;
          sPos.targetId = target.id;
        }

        const dx = target.x - sPos.x;
        const dy = target.y - sPos.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 2) {
          sMoveDir = { x: dx / dist, y: dy / dist };
        }
      } else {
        // Idle: follow player if no coins
        const dx = playerRef.current.x - sPos.x;
        const dy = playerRef.current.y - sPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 50) {
          sMoveDir = { x: dx / dist, y: dy / dist };
        }
      }

      // Add "Wander" - periodic random shift
      const time = Date.now() / 1000;
      const wanderAngle = (time + (index * 123.45)) * 2; // Offset for each slime
      const wanderX = Math.cos(wanderAngle) * 0.4;
      const wanderY = Math.sin(wanderAngle) * 0.4;
      
      const finalMoveX = (sMoveDir.x + wanderX);
      const finalMoveY = (sMoveDir.y + wanderY);
      const finalDist = Math.hypot(finalMoveX, finalMoveY);

      if (finalDist > 0.1) {
        sPos.x += (finalMoveX / finalDist) * finalSlimeSpeed * frameScale;
        sPos.y += (finalMoveY / finalDist) * finalSlimeSpeed * frameScale;
      }

      // Add Separation - push away from other slimes
      equippedSlimes.forEach(other => {
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

      // Separation from player
      const pDx = sPos.x - playerRef.current.x;
      const pDy = sPos.y - playerRef.current.y;
      const pDist = Math.hypot(pDx, pDy);
      if (pDist < 20 && pDist > 0) {
        const push = (20 - pDist) * 0.1;
        sPos.x += (pDx / pDist) * push;
        sPos.y += (pDy / pDist) * push;
      }

      // Bounds check for slime
      sPos.x = Math.max(10, Math.min(width - 10, sPos.x));
      sPos.y = Math.max(10, Math.min(height - 10, sPos.y));

      {
        const sdx = sPos.x - slimeBeforeMove.x;
        const sdy = sPos.y - slimeBeforeMove.y;
        const sd = Math.hypot(sdx, sdy);
        if (sd > 0.06) {
          const anchorY = sPos.y + 5;
          const intensity = Math.min(1, sd / 4);
          const n = 1 + Math.floor(intensity * 3);
          spawnGroundTrailParticles(
            groundTrailRef.current,
            nextGroundTrailId,
            sPos.x,
            anchorY,
            sdx,
            sdy,
            trailDecoration,
            n
          );
        }
      }
    });

    // Collection check
    const collectedIds: number[] = [];
    coinsRef.current.forEach((coin) => {
      // Check player collection
      const distToPlayer = Math.hypot(coin.x - playerRef.current.x, coin.y - playerRef.current.y);
      if (distToPlayer < collectionRadius) {
        collectedIds.push(coin.id);
        effectsRef.current.push({
          id: nextEffectId.current++,
          type: 'collect',
          x: coin.x,
          y: coin.y,
          color: '#FACC15',
          life: 30,
          maxLife: 30
        });
        return;
      }

      // Check equipped slimes collection
      for (const slime of equippedSlimes) {
        const sPos = slimesRef.current[slime.id];
        if (sPos) {
          const distToSlime = Math.hypot(coin.x - sPos.x, coin.y - sPos.y);
          const slimeRadius = BASE_SLIME_COLLECT_RADIUS * (1 + globalRadiusBuff);
          if (distToSlime < slimeRadius) {
            collectedIds.push(coin.id);
            effectsRef.current.push({
              id: nextEffectId.current++,
              type: 'collect',
              x: coin.x,
              y: coin.y,
              color: '#FACC15',
              life: 30,
              maxLife: 30
            });
            break;
          }
        }
      }
    });

    if (collectedIds.length > 0) {
      coinsRef.current = coinsRef.current.filter((f) => !collectedIds.includes(f.id));
      onCollect(collectedIds.length);
    }

    // Respawn logic
    const now = Date.now();
    const { minX, maxX, minY, maxY } = getCoinSpawnBounds(
      width,
      height,
      insetLeftForWorldNav,
      insetRightForWorldNav
    );
    if (coinsRef.current.length < COIN_CAP && now - lastRespawnRef.current > respawnInterval) {
      if (maxX > minX && maxY > minY) {
        coinsRef.current.push({
          id: nextCoinId.current++,
          x: Math.random() * (maxX - minX) + minX,
          y: Math.random() * (maxY - minY) + minY,
          scale: 0,
        });
        lastRespawnRef.current = now;
      }
    }

    // Update Effects
    effectsRef.current = effectsRef.current.filter(e => {
      e.life -= 1;
      if (e.type === 'collect') e.y -= 1;
      if (e.vx !== undefined) e.x += e.vx;
      if (e.vy !== undefined) e.y += e.vy;
      return e.life > 0;
    });

    groundTrailRef.current = groundTrailRef.current.filter((p) => {
      p.life -= 1;
      switch (p.kind) {
        case 'sand':
        case 'grass':
        case 'reeds':
          p.x += p.vx;
          p.y += p.vy + 0.14;
          p.vx *= 0.93;
          p.vy *= 0.88;
          break;
        case 'flowers':
          p.x += p.vx;
          p.y += p.vy + 0.1;
          p.vx *= 0.93;
          p.vy *= 0.88;
          break;
        case 'snow':
          p.x += p.vx * 0.85;
          p.y += p.vy - 0.07;
          p.vx *= 0.95;
          p.vy *= 0.92;
          break;
        case 'mist':
          p.x += p.vx * 0.92;
          p.y += p.vy - 0.04;
          p.vx *= 0.97;
          p.vy *= 0.98;
          break;
      }
      return p.life > 0;
    });

    // Draw
    ctx.clearRect(0, 0, width, height);

    const [g0, g1, g2] = theme.gradient;
    const fieldGrad = ctx.createLinearGradient(0, 0, width, height);
    fieldGrad.addColorStop(0, g0);
    fieldGrad.addColorStop(0.48, g1);
    fieldGrad.addColorStop(1, g2);
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, 0, width, height);

    drawWorldDecoration(ctx, width, height, theme.decoration, theme.accentStroke);

    drawGroundTrailParticles(ctx, groundTrailRef.current);

    // Draw Coins
    coinsRef.current.forEach((coin) => {
      if (coin.scale < 1) coin.scale += 0.05;
      ctx.save();
      ctx.translate(coin.x, coin.y);
      ctx.scale(coin.scale, coin.scale);

      // Drop shadow (same language as player ground shadow)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath();
      ctx.ellipse(1, 10, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Golden Coin Shape
      ctx.fillStyle = '#FACC15'; // Gold Yellow
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      // Inner Circle
      ctx.strokeStyle = '#CA8A04'; // Darker Gold
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();

      // Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(-2, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });

    // Draw Player (Human)
    ctx.save();
    ctx.translate(playerRef.current.x, playerRef.current.y);
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Simple human figure
    // Body
    ctx.fillStyle = '#3B82F6'; // Blue shirt
    ctx.fillRect(-8, 0, 16, 12);
    
    // Head
    ctx.fillStyle = '#FFDBAC'; // Skin tone
    ctx.beginPath();
    ctx.arc(0, -8, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(-3, -9, 1.5, 0, Math.PI * 2);
    ctx.arc(3, -9, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#4B2C20';
    ctx.beginPath();
    ctx.arc(0, -10, 8, Math.PI, 0);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#1E3A8A'; // Dark blue pants
    ctx.fillRect(-7, 12, 6, 8);
    ctx.fillRect(1, 12, 6, 8);
    
    // Arms (swinging effect if moving)
    const isMoving = moveDir.x !== 0 || moveDir.y !== 0;
    const swing = isMoving ? Math.sin(Date.now() / 100) * 5 : 0;
    ctx.fillStyle = '#FFDBAC';
    ctx.fillRect(-12, 2 + swing, 4, 8);
    ctx.fillRect(8, 2 - swing, 4, 8);

    ctx.restore();

    // Draw Burst Aura for player if active
    if (isTraitCycleActive && equippedSlimes.some(s => TRAIT_EFFECTS[s.trait].playerSpeed || TRAIT_EFFECTS[s.trait].radius)) {
      ctx.save();
      ctx.translate(playerRef.current.x, playerRef.current.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, collectionRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(0, 0, collectionRadius * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Equipped Slimes
    equippedSlimes.forEach(slime => {
      const pos = slimesRef.current[slime.id];
      if (!pos) return;

      const isBursting = isTraitCycleActive && slime.trait !== 'None';
      const isSpeedType = ['Swift', 'Fast', 'Sonic'].includes(slime.trait);
      
      // Jump Logic for Speed Types
      let jumpY = 0;
      let squashStretch = 1;
      if (isBursting && isSpeedType) {
        const jumpCycle = (timeNow % 600) / 600; // 600ms per jump
        jumpY = Math.sin(jumpCycle * Math.PI) * -25;
        // Squash at bottom, stretch at top
        squashStretch = 1 + Math.sin(jumpCycle * Math.PI - Math.PI/2) * 0.15;
      }

      const burstPulse = isBursting ? (Math.sin(timeNow / 100) * 0.05 + 1.05) : 1.0;
      const baseRadius = 10;
      const drawRadius = baseRadius * burstPulse;

      ctx.save();
      ctx.translate(pos.x, pos.y + jumpY);
      
      // Shadow (stays on ground)
      ctx.save();
      ctx.translate(0, -jumpY); // Reverse translation for shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      const shadowScale = isBursting && isSpeedType ? (1 - Math.abs(jumpY) / 60) : 1;
      ctx.beginPath();
      ctx.ellipse(0, 8 * burstPulse, 10 * burstPulse * shadowScale, 5 * burstPulse * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw specialized burst fields
      if (isBursting) {
        if (['Magnetic', 'Hypnotic'].includes(slime.trait)) {
          // Magnetic Field Waves
          const radius = BASE_SLIME_COLLECT_RADIUS * (1 + globalRadiusBuff);
          const rippleCount = 3;
          for (let i = 0; i < rippleCount; i++) {
            const rippleOffset = (timeNow / 1000 + i / rippleCount) % 1;
            ctx.strokeStyle = slime.color;
            ctx.globalAlpha = (1 - rippleOffset) * 0.3;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, radius * rippleOffset, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        
        if (['Swift', 'Fast', 'Sonic'].includes(slime.trait)) {
          // Speed Wind/Dash streaks
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1;
          for (let i = 0; i < 4; i++) {
            const angle = (timeNow / 50 + i * Math.PI / 2) % (Math.PI * 2);
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * 15, Math.sin(angle) * 15);
            ctx.lineTo(Math.cos(angle) * 25, Math.sin(angle) * 25);
            ctx.globalAlpha = 0.4;
            ctx.stroke();
          }
        }

        if (['Lucky', 'Golden'].includes(slime.trait)) {
          // Sparkle Aura
          ctx.fillStyle = '#FACC15';
          for (let i = 0; i < 5; i++) {
            const angle = (timeNow / 200 + i * 72) * Math.PI / 180;
            const dist = 18 + Math.sin(timeNow / 150 + i) * 3;
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Add drifting particles for extra "juice"
        if (Math.random() > 0.8) {
          const pAngle = Math.random() * Math.PI * 2;
          const pType = ['Swift', 'Fast', 'Sonic'].includes(slime.trait) ? 'trait_speed' :
                       (['Magnetic', 'Hypnotic'].includes(slime.trait) ? 'trait_magnetic' : 
                       (['Lucky', 'Golden'].includes(slime.trait) ? 'trait_luck' : 'trait_power'));
          
          effectsRef.current.push({
            id: nextEffectId.current++,
            type: pType as any,
            x: pos.x + Math.cos(pAngle) * 15,
            y: pos.y + Math.sin(pAngle) * 15,
            vx: (Math.random() - 0.5) * 1,
            vy: (Math.random() - 0.5) * 1,
            color: pType === 'trait_luck' ? '#FACC15' : slime.color,
            life: 20,
            maxLife: 20,
            size: 2
          });
        }
      }

      // Slime Body
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = slime.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, drawRadius / squashStretch, drawRadius * squashStretch, 0, 0, Math.PI * 2);
      ctx.fill();

      // Slime Highlight (Glossy look)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.ellipse(-drawRadius * 0.3, -drawRadius * 0.3, drawRadius * 0.2, drawRadius * 0.4, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // Simple Slime Eyes
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

      // Trait Meter Bar
      if (slime.trait !== 'None') {
        const barWidth = 24;
        const barHeight = 3;
        const barY = -drawRadius - 8;
        
        // Background & Outline
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.roundRect(-barWidth/2, barY, barWidth, barHeight, 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        
        // Progress
        const t = timeNow % cycleTime;
        let progress = 0;
        let color = '#f97316'; // Orange accent (complements green field)
        
        if (isTraitCycleActive) {
          // Fill up during active burst (0 to 1 in 5s)
          progress = t / activeDuration;
        } else {
          // Fill up during cooldown (0 to 1 in 25s)
          progress = (t - activeDuration) / (cycleTime - activeDuration);
          color = '#FFFFFF'; // White for cooldown per request
        }
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-barWidth/2, barY, barWidth * Math.max(0, Math.min(1, progress)), barHeight, 2);
        ctx.fill();
      }

      ctx.restore();
    });

    // Draw Visual Effects
    effectsRef.current.forEach(e => {
      ctx.save();
      const alpha = e.life / e.maxLife;
      ctx.globalAlpha = alpha;
      
      if (e.type === 'collect') {
        ctx.strokeStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, (1 - alpha) * 20, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.type === 'trait_speed') {
        // Motion trails
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2 * alpha;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x - (e.vx || 0) * 10, e.y - (e.vy || 0) * 10);
        ctx.stroke();
      } else if (e.type === 'trait_magnetic') {
        // Inward rings
        ctx.strokeStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 2 * alpha, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 5;
        ctx.shadowColor = e.color;
        ctx.stroke();
      } else if (e.type === 'trait_luck') {
        // Stars/Sparkles
        ctx.fillStyle = e.color;
        const size = (e.size || 2) * alpha;
        ctx.beginPath();
        for(let i=0; i<4; i++) {
          const a = (i * Math.PI) / 2;
          ctx.lineTo(e.x + Math.cos(a) * size * 2, e.y + Math.sin(a) * size * 2);
          ctx.lineTo(e.x + Math.cos(a + 0.4) * size, e.y + Math.sin(a + 0.4) * size);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 8;
        ctx.shadowColor = e.color;
        ctx.fill();
      } else if (e.type === 'trait_power') {
        // Rising energy
        ctx.fillStyle = e.color;
        const s = (e.size || 2) * alpha;
        ctx.beginPath();
        ctx.arc(e.x, e.y, s, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'white';
        ctx.fill();
      }
      ctx.restore();
    });

    // Draw Joystick Overlay (base locked to player each frame)
    if (joystickRef.current.active) {
      const baseX = playerRef.current.x;
      const baseY = playerRef.current.y;
      const { curX, curY, maxRadius } = joystickRef.current;
      
      const dx = curX - baseX;
      const dy = curY - baseY;
      const dist = Math.hypot(dx, dy);
      
      // Limit thumb distance
      const thumbDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);
      const thumbX = baseX + Math.cos(angle) * thumbDist;
      const thumbY = baseY + Math.sin(angle) * thumbDist;

      // Stick only (no base ring)
      ctx.beginPath();
      ctx.arc(thumbX, thumbY, maxRadius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.stroke();
    }
  });

  return (
    <div ref={containerRef} className="relative h-full min-h-0 w-full overflow-hidden bg-zinc-950/5">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="touch-none"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};
