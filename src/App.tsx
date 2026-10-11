import { useState, useEffect, useRef, useCallback } from 'react';

// Image URLs
const IMAGES = {
  watermelon: 'https://image.qwenlm.ai/generated-images/0bb508e6-de25-46b5-8173-516dab277127/_result.png',
  apple: 'https://image.qwenlm.ai/generated-images/99aed7de-56aa-404a-8e81-03c6ba0884a0/_result.png',
  orange: 'https://image.qwenlm.ai/generated-images/ffebab20-2307-4542-bfd3-bf3e7ab655cd/_result.png',
  kiwi: 'https://image.qwenlm.ai/generated-images/251b0c72-afa3-4ecb-8792-98fb1b5975a7/_result.png',
  pineapple: 'https://image.qwenlm.ai/generated-images/12794922-afb4-4a2a-83c6-660376c68ca3/_result.png',
  bomb: 'https://image.qwenlm.ai/generated-images/325dab35-70f3-4251-9581-e523bca86db8/_result.png',
  wood: 'https://image.qwenlm.ai/generated-images/bfe3e02b-bc34-4bdd-a887-45afe73a0d92/_result.png',
};

type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'menu' | 'playing' | 'gameover';

interface Fruit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  type: string;
  size: number;
  sliced: boolean;
  isBomb: boolean;
  opacity: number;
  scale: number;
}

interface SlicedHalf {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  type: string;
  size: number;
  opacity: number;
  side: 'left' | 'right';
  clipAngle: number;
}

interface BladeTrail {
  x: number;
  y: number;
  time: number;
}

interface ComboText {
  x: number;
  y: number;
  count: number;
  time: number;
  opacity: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface Splatter {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  angle: number;
}

const DIFFICULTY_SETTINGS = {
  easy: { spawnRate: 1800, maxFruits: 3, bombChance: 0.05, speedMult: 0.8, fruitSize: 80 },
  medium: { spawnRate: 1200, maxFruits: 5, bombChance: 0.12, speedMult: 1.0, fruitSize: 70 },
  hard: { spawnRate: 800, maxFruits: 7, bombChance: 0.2, speedMult: 1.3, fruitSize: 65 },
};

const FRUIT_TYPES = ['watermelon', 'apple', 'orange', 'kiwi', 'pineapple'];
const FRUIT_COLORS: Record<string, string> = {
  watermelon: '#ff4757',
  apple: '#ff6b6b',
  orange: '#ffa502',
  kiwi: '#7bed9f',
  pineapple: '#ffd93d',
};

// Sound system using Web Audio API
class SoundSystem {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  playSlice() {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (_e) { /* ignore */ }
  }

  playSwoosh() {
    try {
      const ctx = this.getCtx();
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch (_e) { /* ignore */ }
  }

  playBomb() {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);

      // Noise burst
      const bufferSize = ctx.sampleRate * 0.3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.5;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      source.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      source.start();
    } catch (_e) { /* ignore */ }
  }

  playCombo() {
    try {
      const ctx = this.getCtx();
      const notes = [523, 659, 784];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.15);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.15);
      });
    } catch (_e) { /* ignore */ }
  }
}

const soundSystem = new SoundSystem();

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('fruitNinjaHighScore');
    return saved ? parseInt(saved) : 0;
  });
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [showCombo, setShowCombo] = useState(false);

  const gameRef = useRef<{
    fruits: Fruit[];
    slicedHalves: SlicedHalf[];
    bladeTrail: BladeTrail[];
    comboTexts: ComboText[];
    particles: Particle[];
    splatters: Splatter[];
    score: number;
    lives: number;
    combo: number;
    comboTimer: number;
    lastSpawn: number;
    isMouseDown: boolean;
    mouseX: number;
    mouseY: number;
    prevMouseX: number;
    prevMouseY: number;
    animFrame: number;
    lastTime: number;
    images: Record<string, HTMLImageElement>;
    bgImage: HTMLImageElement | null;
    imagesLoaded: boolean;
    running: boolean;
    lastSwooshTime: number;
  }>({
    fruits: [],
    slicedHalves: [],
    bladeTrail: [],
    comboTexts: [],
    particles: [],
    splatters: [],
    score: 0,
    lives: 3,
    combo: 0,
    comboTimer: 0,
    lastSpawn: 0,
    isMouseDown: false,
    mouseX: 0,
    mouseY: 0,
    prevMouseX: 0,
    prevMouseY: 0,
    animFrame: 0,
    lastTime: 0,
    images: {},
    bgImage: null,
    imagesLoaded: false,
    running: false,
    lastSwooshTime: 0,
  });

  const loadImages = useCallback(() => {
    const game = gameRef.current;
    let loaded = 0;
    const total = Object.keys(IMAGES).length;

    Object.entries(IMAGES).forEach(([key, url]) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loaded++;
        if (loaded >= total) {
          game.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        loaded++;
        if (loaded >= total) {
          game.imagesLoaded = true;
        }
      };
      img.src = url;
      if (key === 'wood') {
        game.bgImage = img;
      } else {
        game.images[key] = img;
      }
    });
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const startGame = useCallback(() => {
    const game = gameRef.current;
    game.fruits = [];
    game.slicedHalves = [];
    game.bladeTrail = [];
    game.comboTexts = [];
    game.particles = [];
    game.splatters = [];
    game.score = 0;
    game.lives = 3;
    game.combo = 0;
    game.comboTimer = 0;
    game.lastSpawn = 0;
    game.running = true;
    game.lastSwooshTime = 0;
    setScore(0);
    setLives(3);
    setCombo(0);
    setGameState('playing');
  }, []);

  const spawnFruit = useCallback((canvasWidth: number, canvasHeight: number) => {
    const game = gameRef.current;
    const settings = DIFFICULTY_SETTINGS[difficulty];
    const isBomb = Math.random() < settings.bombChance;
    const type = isBomb ? 'bomb' : FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];

    const side = Math.random();
    let x: number, vx: number;

    if (side < 0.3) {
      x = Math.random() * canvasWidth * 0.3 + 50;
      vx = (Math.random() * 3 + 2) * settings.speedMult;
    } else if (side > 0.7) {
      x = canvasWidth - Math.random() * canvasWidth * 0.3 - 50;
      vx = -(Math.random() * 3 + 2) * settings.speedMult;
    } else {
      x = canvasWidth * 0.2 + Math.random() * canvasWidth * 0.6;
      vx = (Math.random() - 0.5) * 4 * settings.speedMult;
    }

    const fruit: Fruit = {
      id: Date.now() + Math.random(),
      x,
      y: canvasHeight + 50,
      vx,
      vy: -(Math.random() * 6 + 13) * settings.speedMult,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      type,
      size: settings.fruitSize + Math.random() * 15,
      sliced: false,
      isBomb,
      opacity: 1,
      scale: 1,
    };

    game.fruits.push(fruit);
  }, [difficulty]);

  const sliceFruit = useCallback((fruit: Fruit, sliceX: number, sliceY: number) => {
    const game = gameRef.current;
    fruit.sliced = true;

    if (fruit.isBomb) {
      game.lives = 0;
      setLives(0);
      soundSystem.playBomb();
      // Explosion particles
      for (let i = 0; i < 40; i++) {
        const angle = (Math.PI * 2 * i) / 40;
        const speed = Math.random() * 10 + 4;
        game.particles.push({
          x: fruit.x,
          y: fruit.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 8 + 4,
          color: Math.random() > 0.5 ? '#ff4757' : '#ffa502',
          life: 60,
          maxLife: 60,
        });
      }
      // Dark splatter
      for (let i = 0; i < 5; i++) {
        game.splatters.push({
          x: fruit.x + (Math.random() - 0.5) * 100,
          y: fruit.y + (Math.random() - 0.5) * 100,
          size: Math.random() * 30 + 20,
          color: 'rgba(30, 30, 30, 0.6)',
          opacity: 0.6,
          angle: Math.random() * Math.PI * 2,
        });
      }
      return;
    }

    soundSystem.playSlice();

    // Score and combo
    game.combo++;
    game.comboTimer = 90;
    const comboMultiplier = Math.min(game.combo, 8);
    const points = 10 * comboMultiplier;
    game.score += points;
    setScore(game.score);
    setCombo(game.combo);

    if (game.combo >= 3) {
      setShowCombo(true);
      soundSystem.playCombo();
      setTimeout(() => setShowCombo(false), 1200);
    }

    // Add combo text
    game.comboTexts.push({
      x: sliceX,
      y: sliceY - 40,
      count: game.combo,
      time: 80,
      opacity: 1,
    });

    // Create sliced halves
    const angle = Math.atan2(
      game.mouseY - game.prevMouseY,
      game.mouseX - game.prevMouseX
    );

    for (const side of ['left', 'right'] as const) {
      game.slicedHalves.push({
        id: Date.now() + Math.random(),
        x: fruit.x,
        y: fruit.y,
        vx: side === 'left' ? -3 - Math.random() * 3 : 3 + Math.random() * 3,
        vy: -3 + Math.random() * 2,
        rotation: fruit.rotation,
        rotationSpeed: (side === 'left' ? -1 : 1) * (Math.random() * 0.12 + 0.05),
        type: fruit.type,
        size: fruit.size,
        opacity: 1,
        side,
        clipAngle: angle,
      });
    }

    // Juice particles
    const color = FRUIT_COLORS[fruit.type] || '#ff6b6b';
    for (let i = 0; i < 20; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      game.particles.push({
        x: fruit.x,
        y: fruit.y,
        vx: Math.cos(pAngle) * speed,
        vy: Math.sin(pAngle) * speed - 3,
        size: Math.random() * 10 + 3,
        color,
        life: 50 + Math.random() * 30,
        maxLife: 80,
      });
    }

    // Add splatter marks on background
    for (let i = 0; i < 3; i++) {
      game.splatters.push({
        x: fruit.x + (Math.random() - 0.5) * 80,
        y: fruit.y + (Math.random() - 0.5) * 80,
        size: Math.random() * 25 + 10,
        color: color,
        opacity: 0.4 + Math.random() * 0.2,
        angle: Math.random() * Math.PI * 2,
      });
    }
  }, []);

  const checkSlice = useCallback((x: number, y: number, prevX: number, prevY: number) => {
    const game = gameRef.current;
    const dx = x - prevX;
    const dy = y - prevY;
    const speed = Math.sqrt(dx * dx + dy * dy);

    if (speed < 5) return;

    // Swoosh sound
    const now = Date.now();
    if (now - game.lastSwooshTime > 150) {
      soundSystem.playSwoosh();
      game.lastSwooshTime = now;
    }

    game.fruits.forEach((fruit) => {
      if (fruit.sliced) return;
      const dist = Math.sqrt((x - fruit.x) ** 2 + (y - fruit.y) ** 2);
      if (dist < fruit.size * 0.65) {
        sliceFruit(fruit, x, y);
      }
    });
  }, [sliceFruit]);

  const gameLoop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const game = gameRef.current;
    if (!game.running) return;
    if (!game.imagesLoaded) {
      game.animFrame = requestAnimationFrame(gameLoop);
      return;
    }

    game.lastTime = timestamp;

    const w = canvas.width;
    const h = canvas.height;

    // Clear and draw background
    ctx.clearRect(0, 0, w, h);

    if (game.bgImage) {
      ctx.drawImage(game.bgImage, 0, 0, w, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(0, 0, w, h);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#1a0f0a');
      gradient.addColorStop(1, '#2d1b0e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }

    // Draw splatters (juice marks on background)
    game.splatters.forEach((splatter) => {
      ctx.save();
      ctx.globalAlpha = splatter.opacity;
      ctx.translate(splatter.x, splatter.y);
      ctx.rotate(splatter.angle);
      ctx.fillStyle = splatter.color;
      ctx.beginPath();
      // Irregular splatter shape
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        const r = splatter.size * (0.6 + Math.random() * 0.4);
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Fade splatters slowly
    game.splatters = game.splatters.filter(s => {
      s.opacity -= 0.0005;
      return s.opacity > 0;
    });

    // Spawn fruits
    const settings = DIFFICULTY_SETTINGS[difficulty];
    if (timestamp - game.lastSpawn > settings.spawnRate && game.fruits.filter(f => !f.sliced).length < settings.maxFruits) {
      spawnFruit(w, h);
      game.lastSpawn = timestamp;
    }

    // Update and draw fruits
    const gravity = 0.38;

    game.fruits = game.fruits.filter((fruit) => {
      fruit.x += fruit.vx;
      fruit.y += fruit.vy;
      fruit.vy += gravity;
      fruit.rotation += fruit.rotationSpeed;

      if (fruit.sliced) {
        fruit.opacity -= 0.05;
        return fruit.opacity > 0;
      }

      // Check if fruit fell off screen
      if (fruit.y > h + 100) {
        if (!fruit.isBomb) {
          game.lives--;
          setLives(game.lives);
        }
        return false;
      }

      // Draw fruit with shadow
      ctx.save();
      ctx.translate(fruit.x, fruit.y);
      ctx.rotate(fruit.rotation);
      ctx.globalAlpha = fruit.opacity;

      // Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 5;

      const img = game.images[fruit.type];
      if (img) {
        ctx.drawImage(img, -fruit.size / 2, -fruit.size / 2, fruit.size, fruit.size);
      }

      ctx.restore();
      return true;
    });

    // Update and draw sliced halves
    game.slicedHalves = game.slicedHalves.filter((half) => {
      half.x += half.vx;
      half.y += half.vy;
      half.vy += gravity;
      half.rotation += half.rotationSpeed;
      half.opacity -= 0.008;

      if (half.y > h + 100 || half.opacity <= 0) return false;

      ctx.save();
      ctx.translate(half.x, half.y);
      ctx.rotate(half.rotation);
      ctx.globalAlpha = half.opacity;

      const img = game.images[half.type];
      if (img) {
        ctx.beginPath();
        if (half.side === 'left') {
          ctx.rect(-half.size, -half.size, half.size, half.size * 2);
        } else {
          ctx.rect(0, -half.size, half.size, half.size * 2);
        }
        ctx.clip();
        ctx.drawImage(img, -half.size / 2, -half.size / 2, half.size, half.size);

        // Draw inner flesh color on cut side
        const innerColor = FRUIT_COLORS[half.type] || '#ff6b6b';
        ctx.fillStyle = innerColor;
        ctx.globalAlpha = half.opacity * 0.3;
        if (half.side === 'left') {
          ctx.fillRect(0, -half.size / 2, 3, half.size);
        } else {
          ctx.fillRect(-3, -half.size / 2, 3, half.size);
        }
      }

      ctx.restore();
      return true;
    });

    // Update and draw particles
    game.particles = game.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.vx *= 0.98;
      p.life--;

      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      return p.life > 0;
    });

    // Draw blade trail
    if (game.isMouseDown && game.bladeTrail.length > 1) {
      const now = Date.now();
      game.bladeTrail = game.bladeTrail.filter((p) => now - p.time < 250);

      if (game.bladeTrail.length > 1) {
        ctx.save();
        // Outer glow
        for (let i = 1; i < game.bladeTrail.length; i++) {
          const p1 = game.bladeTrail[i - 1];
          const p2 = game.bladeTrail[i];
          const age = (now - p1.time) / 250;
          const alpha = (1 - age) * 0.3;
          const width = (1 - age) * 16 + 4;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`;
          ctx.lineWidth = width;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // Inner bright line
        for (let i = 1; i < game.bladeTrail.length; i++) {
          const p1 = game.bladeTrail[i - 1];
          const p2 = game.bladeTrail[i];
          const age = (now - p1.time) / 250;
          const alpha = (1 - age) * 0.9;
          const width = (1 - age) * 4 + 1;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = width;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Draw combo texts
    game.comboTexts = game.comboTexts.filter((ct) => {
      ct.time--;
      ct.y -= 1.2;
      ct.opacity = ct.time / 80;

      if (ct.time <= 0) return false;

      ctx.save();
      ctx.globalAlpha = ct.opacity;
      
      const scale = 1 + (1 - ct.time / 80) * 0.3;
      ctx.translate(ct.x, ct.y);
      ctx.scale(scale, scale);
      
      ctx.font = 'bold 32px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Text shadow
      ctx.shadowColor = '#ffa502';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ffd93d';
      ctx.fillText(`${ct.count}x`, 0, 0);
      
      ctx.shadowBlur = 0;
      ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#f5e6d3';
      ctx.fillText(`COMBO +${ct.count * 10}`, 0, 28);
      
      ctx.restore();

      return true;
    });

    // Combo timer
    if (game.comboTimer > 0) {
      game.comboTimer--;
      if (game.comboTimer === 0) {
        game.combo = 0;
        setCombo(0);
      }
    }

    // Check game over
    if (game.lives <= 0) {
      game.running = false;
      const finalScore = game.score;
      if (finalScore > highScore) {
        setHighScore(finalScore);
        localStorage.setItem('fruitNinjaHighScore', finalScore.toString());
      }
      setGameState('gameover');
      return;
    }

    game.animFrame = requestAnimationFrame(gameLoop);
  }, [difficulty, spawnFruit, highScore]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const game = gameRef.current;
    game.lastTime = performance.now();
    game.running = true;
    game.animFrame = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('resize', resize);
      game.running = false;
      cancelAnimationFrame(game.animFrame);
    };
  }, [gameState, gameLoop]);

  // Mouse/Touch handlers
  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = gameRef.current;

    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      if ('touches' in e && e.touches.length > 0) {
        return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      }
      if ('clientX' in e) {
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
      return { x: 0, y: 0 };
    };

    const handleStart = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const pos = getPos(e);
      game.isMouseDown = true;
      game.mouseX = pos.x;
      game.mouseY = pos.y;
      game.prevMouseX = pos.x;
      game.prevMouseY = pos.y;
      game.bladeTrail = [{ x: pos.x, y: pos.y, time: Date.now() }];
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (!game.isMouseDown) return;
      const pos = getPos(e);
      game.prevMouseX = game.mouseX;
      game.prevMouseY = game.mouseY;
      game.mouseX = pos.x;
      game.mouseY = pos.y;
      game.bladeTrail.push({ x: pos.x, y: pos.y, time: Date.now() });
      checkSlice(pos.x, pos.y, game.prevMouseX, game.prevMouseY);
    };

    const handleEnd = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      game.isMouseDown = false;
    };

    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('mouseleave', handleEnd);
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', handleStart);
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mouseup', handleEnd);
      canvas.removeEventListener('mouseleave', handleEnd);
      canvas.removeEventListener('touchstart', handleStart);
      canvas.removeEventListener('touchmove', handleMove);
      canvas.removeEventListener('touchend', handleEnd);
    };
  }, [gameState, checkSlice]);

  // Menu Screen
  if (gameState === 'menu') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1a0f0a 0%, #2d1b0e 50%, #1a0f0a 100%)' }}>
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-amber-800 blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-56 h-56 rounded-full bg-orange-900 blur-3xl"></div>
          <div className="absolute top-1/2 left-1/4 w-32 h-32 rounded-full bg-red-900 blur-3xl"></div>
        </div>

        {/* Wood texture overlay */}
        <div className="absolute inset-0 opacity-5" 
          style={{ backgroundImage: `url(${IMAGES.wood})`, backgroundSize: 'cover' }}></div>

        <div className="animate-fadeIn flex flex-col items-center z-10">
          {/* Logo */}
          <div className="mb-12 text-center">
            <h1 className="text-7xl md:text-9xl font-black mb-1 tracking-tighter"
              style={{ color: '#d4a574', textShadow: '0 4px 30px rgba(212, 165, 116, 0.4), 0 0 60px rgba(212, 165, 116, 0.1)' }}>
              FRUIT
            </h1>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight"
              style={{ color: '#f5e6d3', textShadow: '0 4px 20px rgba(245, 230, 211, 0.3)' }}>
              NINJA
            </h1>
            <div className="mt-3 h-0.5 w-48 mx-auto rounded-full" 
              style={{ background: 'linear-gradient(90deg, transparent, #d4a574, transparent)' }}></div>
          </div>

          {/* Difficulty buttons */}
          <div className="flex flex-col gap-3 w-72">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff, idx) => (
              <button
                key={diff}
                onClick={() => { setDifficulty(diff); startGame(); }}
                className="px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, rgba(212, 165, 116, 0.15), rgba(212, 165, 116, 0.05))',
                  color: '#d4a574',
                  border: '1px solid rgba(212, 165, 116, 0.25)',
                  backdropFilter: 'blur(10px)',
                  animationDelay: `${idx * 100}ms`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #d4a574, #b8845a)';
                  e.currentTarget.style.color = '#1a0f0a';
                  e.currentTarget.style.borderColor = '#d4a574';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(212, 165, 116, 0.15), rgba(212, 165, 116, 0.05))';
                  e.currentTarget.style.color = '#d4a574';
                  e.currentTarget.style.borderColor = 'rgba(212, 165, 116, 0.25)';
                }}
              >
                {diff === 'easy' ? 'Легко' : diff === 'medium' ? 'Средне' : 'Сложно'}
              </button>
            ))}
          </div>

          {/* High score */}
          {highScore > 0 && (
            <div className="mt-10 animate-fadeIn" style={{ animationDelay: '300ms' }}>
              <p className="text-base" style={{ color: '#d4a574', opacity: 0.6 }}>
                Лучший результат
              </p>
              <p className="text-2xl font-bold mt-1" style={{ color: '#d4a574' }}>
                {highScore}
              </p>
            </div>
          )}

          {/* Instructions */}
          <p className="mt-10 text-sm max-w-xs text-center" style={{ color: '#d4a574', opacity: 0.4 }}>
            Проведите пальцем или мышкой, чтобы разрезать фрукты. Избегайте бомб!
          </p>
        </div>
      </div>
    );
  }

  // Game Over Screen
  if (gameState === 'gameover') {
    const isNewRecord = score >= highScore && score > 0;
    return (
      <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1a0f0a 0%, #2d1b0e 50%, #1a0f0a 100%)' }}>
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-red-900 blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-56 h-56 rounded-full bg-red-800 blur-3xl"></div>
        </div>

        <div className="animate-fadeIn flex flex-col items-center z-10">
          <h2 className="text-5xl md:text-7xl font-black mb-6"
            style={{ color: '#ff6b6b', textShadow: '0 4px 30px rgba(255, 107, 107, 0.4)' }}>
            КОНЕЦ
          </h2>

          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="px-8 py-5 rounded-2xl"
              style={{ background: 'rgba(212, 165, 116, 0.08)', border: '1px solid rgba(212, 165, 116, 0.2)' }}>
              <p className="text-sm mb-1" style={{ color: '#d4a574', opacity: 0.6 }}>Ваш счёт</p>
              <p className="text-5xl font-bold" style={{ color: '#d4a574' }}>
                {score}
              </p>
            </div>

            {isNewRecord && (
              <p className="text-lg font-semibold animate-pulse-slow mt-2" style={{ color: '#ffd93d' }}>
                ★ Новый рекорд! ★
              </p>
            )}
            
            <p className="text-sm mt-2" style={{ color: '#d4a574', opacity: 0.5 }}>
              Лучший: {Math.max(score, highScore)}
            </p>
          </div>

          <div className="flex gap-4 mt-10">
            <button
              onClick={startGame}
              className="px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #d4a574, #b8845a)',
                color: '#1a0f0a',
                border: '1px solid #d4a574',
              }}
            >
              Ещё раз
            </button>
            <button
              onClick={() => setGameState('menu')}
              className="px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
              style={{
                background: 'rgba(212, 165, 116, 0.08)',
                color: '#d4a574',
                border: '1px solid rgba(212, 165, 116, 0.25)',
              }}
            >
              Меню
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Playing Screen
  return (
    <div className="w-full h-full relative overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-none" />

      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 pointer-events-none">
        {/* Score */}
        <div className="animate-slideDown">
          <div className="px-5 py-3 rounded-xl"
            style={{ background: 'rgba(26, 15, 10, 0.85)', border: '1px solid rgba(212, 165, 116, 0.15)', backdropFilter: 'blur(10px)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#d4a574', opacity: 0.6 }}>Очки</p>
            <p className="text-3xl font-bold mt-0.5" style={{ color: '#f5e6d3' }}>{score}</p>
          </div>
        </div>

        {/* Combo indicator */}
        {combo >= 2 && (
          <div className="animate-slideDown">
            <div className="px-4 py-2 rounded-lg"
              style={{ background: 'rgba(255, 217, 61, 0.15)', border: '1px solid rgba(255, 217, 61, 0.3)' }}>
              <p className="text-lg font-bold" style={{ color: '#ffd93d' }}>{combo}x</p>
            </div>
          </div>
        )}

        {/* Lives */}
        <div className="animate-slideDown flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-500"
              style={{
                background: i < lives ? 'rgba(255, 107, 107, 0.15)' : 'rgba(100, 100, 100, 0.1)',
                border: `1px solid ${i < lives ? 'rgba(255, 107, 107, 0.4)' : 'rgba(100, 100, 100, 0.2)'}`,
                transform: i < lives ? 'scale(1)' : 'scale(0.8)',
                opacity: i < lives ? 1 : 0.4,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={i < lives ? '#ff6b6b' : '#555'}>
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* Combo popup */}
      {showCombo && combo >= 3 && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none animate-comboFlash">
          <div className="px-10 py-5 rounded-2xl"
            style={{ background: 'rgba(255, 217, 61, 0.15)', border: '1px solid rgba(255, 217, 61, 0.4)', backdropFilter: 'blur(10px)' }}>
            <p className="text-5xl font-black text-center" style={{ color: '#ffd93d', textShadow: '0 0 30px rgba(255, 217, 61, 0.5)' }}>
              {combo}x
            </p>
            <p className="text-lg font-semibold text-center mt-1" style={{ color: '#f5e6d3' }}>
              COMBO!
            </p>
          </div>
        </div>
      )}

      {/* Pause/Menu button */}
      <div className="absolute bottom-4 right-4 z-10">
        <button
          onClick={() => {
            gameRef.current.running = false;
            cancelAnimationFrame(gameRef.current.animFrame);
            setGameState('menu');
          }}
          className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 pointer-events-auto"
          style={{
            background: 'rgba(26, 15, 10, 0.85)',
            border: '1px solid rgba(212, 165, 116, 0.2)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#d4a574">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default App;
