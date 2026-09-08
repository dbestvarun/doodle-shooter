import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Heart, Play, RotateCcw } from 'lucide-react';

// --- Constants ---
const PLAYER_SIZE = 20;
const PLAYER_SPEED = 4;
const PROJECTILE_SPEED = 7;
const ENEMY_SPEED_MIN = 1;
const ENEMY_SPEED_MAX = 2.5;
const SPAWN_RATE_INITIAL = 1500; // ms
const SPAWN_RATE_MIN = 500;
const PAPER_COLOR = '#fdfdfd';
const INK_COLOR = '#333';

// --- Utility Functions ---
const distance = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1);

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// --- Game Classes ---
class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * PROJECTILE_SPEED;
    this.vy = Math.sin(angle) * PROJECTILE_SPEED;
    this.radius = 3;
    this.active = true;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = INK_COLOR;
    ctx.fill();
    ctx.closePath();
  }
}

class Enemy {
  x: number;
  y: number;
  size: number;
  speed: number;
  health: number;
  active: boolean;
  offset: number;

  constructor(x: number, y: number, size: number) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.speed = randomRange(ENEMY_SPEED_MIN, ENEMY_SPEED_MAX);
    this.health = Math.ceil(size / 15);
    this.active = true;
    this.offset = Math.random() * Math.PI * 2; // For "wiggly" movement
  }

  update(playerX: number, playerY: number) {
    const angle = Math.atan2(playerY - this.y, playerX - this.x);
    
    // Add a bit of "doodle wiggle" to movement
    const wiggle = Math.sin(Date.now() * 0.005 + this.offset) * 0.2;
    this.x += Math.cos(angle + wiggle) * this.speed;
    this.y += Math.sin(angle + wiggle) * this.speed;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 2;
    
    // Draw a sketchy square/circle hybrid
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = this.size / 2 + (Math.random() - 0.5) * 3;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    
    // Eyes
    ctx.fillStyle = INK_COLOR;
    ctx.beginPath();
    ctx.arc(-this.size/4, -this.size/4, 2, 0, Math.PI*2);
    ctx.arc(this.size/4, -this.size/4, 2, 0, Math.PI*2);
    ctx.fill();
    
    ctx.restore();
  }
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1.0;
    this.decay = randomRange(0.02, 0.05);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.vx * 2, this.y + this.vy * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [highScore, setHighScore] = useState(0);

  // Game Refs (to avoid re-renders in loop)
  const playerPos = useRef({ x: 0, y: 0, angle: 0 });
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const projectiles = useRef<Projectile[]>([]);
  const enemies = useRef<Enemy[]>([]);
  const particles = useRef<Particle[]>([]);
  const lastSpawnTime = useRef(0);
  const spawnRate = useRef(SPAWN_RATE_INITIAL);

  useEffect(() => {
    const savedScore = localStorage.getItem('doodleShooterHighScore');
    if (savedScore) setHighScore(parseInt(savedScore));
  }, []);

  const startGame = () => {
    setGameState('PLAYING');
    setScore(0);
    setHealth(100);
    projectiles.current = [];
    enemies.current = [];
    particles.current = [];
    spawnRate.current = SPAWN_RATE_INITIAL;
    
    const canvas = canvasRef.current;
    if (canvas) {
      playerPos.current = { x: canvas.width / 2, y: canvas.height / 2, angle: 0 };
    }
  };

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.code] = false; };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      playerPos.current.angle = Math.atan2(mouseY - playerPos.current.y, mouseX - playerPos.current.x);
    };
    const handleMouseDown = () => {
      projectiles.current.push(new Projectile(playerPos.current.x, playerPos.current.y, playerPos.current.angle));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    let animationFrameId: number;

    const loop = (time: number) => {
      // 1. Update Player
      const { x, y } = playerPos.current;
      let nx = x;
      let ny = y;
      if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) ny -= PLAYER_SPEED;
      if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) ny += PLAYER_SPEED;
      if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) nx -= PLAYER_SPEED;
      if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) nx += PLAYER_SPEED;
      
      // Bounds
      playerPos.current.x = Math.max(PLAYER_SIZE, Math.min(canvas.width - PLAYER_SIZE, nx));
      playerPos.current.y = Math.max(PLAYER_SIZE, Math.min(canvas.height - PLAYER_SIZE, ny));

      // 2. Spawn Enemies
      if (time - lastSpawnTime.current > spawnRate.current) {
        const size = randomRange(15, 40);
        let ex, ey;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { ex = Math.random() * canvas.width; ey = -size; }
        else if (side === 1) { ex = canvas.width + size; ey = Math.random() * canvas.height; }
        else if (side === 2) { ex = Math.random() * canvas.width; ey = canvas.height + size; }
        else { ex = -size; ey = Math.random() * canvas.height; }
        
        enemies.current.push(new Enemy(ex, ey, size));
        lastSpawnTime.current = time;
        spawnRate.current = Math.max(SPAWN_RATE_MIN, spawnRate.current * 0.99);
      }

      // 3. Update Entities
      projectiles.current.forEach(p => p.update());
      enemies.current.forEach(e => e.update(playerPos.current.x, playerPos.current.y));
      particles.current.forEach(p => p.update());

      // Cleanup off-screen projectiles
      projectiles.current = projectiles.current.filter(p => 
        p.x > 0 && p.x < canvas.width && p.y > 0 && p.y < canvas.height
      );
      particles.current = particles.current.filter(p => p.life > 0);

      // 4. Collisions
      enemies.current.forEach(e => {
        // Enemy vs Player
        if (distance(e.x, e.y, playerPos.current.x, playerPos.current.y) < (e.size / 2 + PLAYER_SIZE / 2)) {
          setHealth(prev => {
            const next = prev - 0.5;
            if (next <= 0) {
              setGameState('GAMEOVER');
              return 0;
            }
            return next;
          });
        }

        // Enemy vs Projectile
        projectiles.current.forEach(p => {
          if (p.active && distance(e.x, e.y, p.x, p.y) < e.size / 2) {
            p.active = false;
            e.health--;
            if (e.health <= 0) {
              e.active = false;
              setScore(s => s + Math.floor(e.size));
              // Explosion particles
              for (let i = 0; i < 8; i++) particles.current.push(new Particle(e.x, e.y));
            }
          }
        });
      });

      enemies.current = enemies.current.filter(e => e.active);
      projectiles.current = projectiles.current.filter(p => p.active);

      // 5. Draw
      ctx.fillStyle = PAPER_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw subtle paper grid
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      // Player
      ctx.save();
      ctx.translate(playerPos.current.x, playerPos.current.y);
      ctx.rotate(playerPos.current.angle);
      ctx.strokeStyle = INK_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Sketchy triangle-ish shape for player
      ctx.moveTo(15, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      projectiles.current.forEach(p => p.draw(ctx));
      enemies.current.forEach(e => e.draw(ctx));
      particles.current.forEach(p => p.draw(ctx));

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'GAMEOVER') {
      setHighScore(prev => {
        const newHigh = Math.max(prev, score);
        localStorage.setItem('doodleShooterHighScore', newHigh.toString());
        return newHigh;
      });
    }
  }, [gameState, score]);

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col items-center justify-center font-mono p-4 select-none overflow-hidden">
      <div className="relative bg-white shadow-2xl rounded-lg overflow-hidden border-8 border-slate-800" 
           style={{ width: '800px', height: '600px' }}>
        
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={600} 
          className="block cursor-crosshair"
        />

        {/* HUD */}
        {gameState === 'PLAYING' && (
          <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none">
            <div className="flex items-center gap-2 bg-white/80 px-3 py-1 rounded-full border-2 border-slate-800">
              <Trophy className="w-5 h-5 text-yellow-600" />
              <span className="text-xl font-bold">{score}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 px-3 py-1 rounded-full border-2 border-slate-800">
              <Heart className="w-5 h-5 text-red-500" />
              <div className="w-32 h-4 bg-slate-200 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="h-full bg-red-500 transition-all duration-100" 
                  style={{ width: `${health}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Overlays */}
        {gameState === 'START' && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-6xl font-black mb-4 underline decoration-wavy decoration-slate-800">DOODLE SHOOTER</h1>
            <p className="text-lg mb-8 max-w-md">
              Use <span className="font-bold bg-slate-200 px-1">WASD</span> or <span className="font-bold bg-slate-200 px-1">ARROWS</span> to move.<br/>
              Move your <span className="font-bold bg-slate-200 px-1">MOUSE</span> to aim and <span className="font-bold bg-slate-200 px-1">CLICK</span> to shoot.
            </p>
            <button 
              onClick={startGame}
              className="group flex items-center gap-2 bg-slate-800 text-white px-8 py-4 rounded-full text-2xl font-bold hover:bg-slate-700 transition-all hover:scale-110 active:scale-95"
            >
              <Play className="fill-current" /> START GAME
            </button>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-slate-800/90 flex flex-col items-center justify-center p-6 text-center text-white">
            <h2 className="text-6xl font-black mb-2">GAME OVER</h2>
            <div className="text-2xl mb-8">
              <p className="mb-2">Score: <span className="text-yellow-400 font-bold">{score}</span></p>
              <p>Best: <span className="text-yellow-400 font-bold">{highScore}</span></p>
            </div>
            <button 
              onClick={startGame}
              className="group flex items-center gap-2 bg-white text-slate-800 px-8 py-4 rounded-full text-2xl font-bold hover:bg-slate-100 transition-all hover:scale-110 active:scale-95"
            >
              <RotateCcw /> TRY AGAIN
            </button>
          </div>
        )}
      </div>
      
      <div className="mt-6 text-slate-600 text-sm">
        Hand-drawn chaos. Don't let them touch you!
      </div>
    </div>
  );
}
