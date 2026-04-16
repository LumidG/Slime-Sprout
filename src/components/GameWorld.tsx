import React, { useRef, useEffect } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';
import { GAME_WIDTH, GAME_HEIGHT, COIN_CAP, BASE_RESPAWN_TIME, BASE_MOVEMENT_SPEED } from '../constants';

interface Coin {
  id: number;
  x: number;
  y: number;
  scale: number;
}

interface GameWorldProps {
  onCollect: (count: number) => void;
  automationLevel: number;
  movementSpeedLevel: number;
  respawnTimeLevel: number;
}

export const GameWorld: React.FC<GameWorldProps> = ({
  onCollect,
  automationLevel,
  movementSpeedLevel,
  respawnTimeLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef({ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, radius: 15 });
  const coinsRef = useRef<Coin[]>([]);
  const lastRespawnRef = useRef<number>(0);
  const nextCoinId = useRef(0);
  const joystickRef = useRef<{ 
    active: boolean; 
    baseX: number; 
    baseY: number; 
    curX: number; 
    curY: number; 
    maxRadius: number;
  }>({
    active: false,
    baseX: 0,
    baseY: 0,
    curX: 0,
    curY: 0,
    maxRadius: 40,
  });

  const getCanvasCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * GAME_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * GAME_HEIGHT;
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const { x, y } = getCanvasCoords(e);
    joystickRef.current = {
      ...joystickRef.current,
      active: true,
      baseX: x,
      baseY: y,
      curX: x,
      curY: y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!joystickRef.current.active) return;
    const { x, y } = getCanvasCoords(e);
    joystickRef.current.curX = x;
    joystickRef.current.curY = y;
  };

  const handlePointerUp = () => {
    joystickRef.current.active = false;
  };

  // Initialize coins
  useEffect(() => {
    const initialCoins: Coin[] = [];
    for (let i = 0; i < COIN_CAP; i++) {
      initialCoins.push({
        id: nextCoinId.current++,
        x: Math.random() * (GAME_WIDTH - 40) + 20,
        y: Math.random() * (GAME_HEIGHT - 40) + 20,
        scale: 1,
      });
    }
    coinsRef.current = initialCoins;
  }, []);

  const respawnInterval = BASE_RESPAWN_TIME / (1 + respawnTimeLevel * 0.2);
  const movementSpeed = BASE_MOVEMENT_SPEED * (1 + movementSpeedLevel * 0.1);

  useGameLoop((deltaTime) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Update Player
    const frameScale = deltaTime / 16.67; // Normalize to 60fps
    
    let moveDir = { x: 0, y: 0 };
    let joystickSpeedMult = 1;

    if (joystickRef.current.active) {
      const dx = joystickRef.current.curX - joystickRef.current.baseX;
      const dy = joystickRef.current.curY - joystickRef.current.baseY;
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

    if (moveDir.x !== 0 || moveDir.y !== 0) {
      playerRef.current.x += moveDir.x * movementSpeed * frameScale * joystickSpeedMult;
      playerRef.current.y += moveDir.y * movementSpeed * frameScale * joystickSpeedMult;
    }

    // Bounds check
    playerRef.current.x = Math.max(playerRef.current.radius, Math.min(GAME_WIDTH - playerRef.current.radius, playerRef.current.x));
    playerRef.current.y = Math.max(playerRef.current.radius, Math.min(GAME_HEIGHT - playerRef.current.radius, playerRef.current.y));

    // Collection check
    const collectedIds: number[] = [];
    coinsRef.current.forEach((coin) => {
      const dist = Math.hypot(coin.x - playerRef.current.x, coin.y - playerRef.current.y);
      if (dist < playerRef.current.radius + 10) {
        collectedIds.push(coin.id);
      }
    });

    if (collectedIds.length > 0) {
      coinsRef.current = coinsRef.current.filter((f) => !collectedIds.includes(f.id));
      onCollect(collectedIds.length);
    }

    // Respawn logic
    const now = Date.now();
    if (coinsRef.current.length < COIN_CAP && now - lastRespawnRef.current > respawnInterval) {
      coinsRef.current.push({
        id: nextCoinId.current++,
        x: Math.random() * (GAME_WIDTH - 40) + 20,
        y: Math.random() * (GAME_HEIGHT - 40) + 20,
        scale: 0,
      });
      lastRespawnRef.current = now;
    }

    // Draw
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw Grass (simple pattern)
    ctx.fillStyle = '#86EFAC'; // Lighter Green (Tailwind green-300)
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Draw subtle grass tufts
    ctx.strokeStyle = '#4ADE80'; // Medium Green (Tailwind green-400)
    ctx.lineWidth = 1;
    for(let i=0; i<GAME_WIDTH; i+=40) {
      for(let j=0; j<GAME_HEIGHT; j+=40) {
        ctx.beginPath();
        ctx.moveTo(i + 10, j + 10);
        ctx.lineTo(i + 12, j + 5);
        ctx.moveTo(i + 10, j + 10);
        ctx.lineTo(i + 8, j + 6);
        ctx.stroke();
      }
    }

    // Draw Coins
    coinsRef.current.forEach((coin) => {
      if (coin.scale < 1) coin.scale += 0.05;
      ctx.save();
      ctx.translate(coin.x, coin.y);
      ctx.scale(coin.scale, coin.scale);
      
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

    // Draw Joystick Overlay
    if (joystickRef.current.active) {
      const { baseX, baseY, curX, curY, maxRadius } = joystickRef.current;
      
      const dx = curX - baseX;
      const dy = curY - baseY;
      const dist = Math.hypot(dx, dy);
      
      // Limit thumb distance
      const thumbDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);
      const thumbX = baseX + Math.cos(angle) * thumbDist;
      const thumbY = baseY + Math.sin(angle) * thumbDist;

      // Draw Base
      ctx.beginPath();
      ctx.arc(baseX, baseY, maxRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Thumb
      ctx.beginPath();
      ctx.arc(thumbX, thumbY, maxRadius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.stroke();
    }
  });

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#86EFAC' }}>
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="shadow-2xl rounded-lg bg-green-400 touch-none"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  );
};
