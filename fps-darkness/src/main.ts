const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const screenW = (canvas.width = window.innerWidth);
const screenH = (canvas.height = window.innerHeight);

// ---- Types ----
type Vec2 = { x: number; y: number };

interface Bullet {
  x: number;
  y: number;
  angle: number;
  speed: number;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Enemy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  type: "slime" | "ghost" | "demon" | "boss";
  angle: number;
  visible: boolean;
  visibleTimer: number;
  attackCooldown: number;
  flashTimer: number;
  radius: number;
}

interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Item {
  x: number;
  y: number;
  type: "battery" | "medkit" | "ammo";
  radius: number;
}

// ---- Game State ----
let gameState: "menu" | "playing" | "over" = "menu";
let score = 0;
let wave = 1;
let waveTimer = 0;
let enemiesRemaining = 0;
let spawnedThisWave = 0;
let spawnTimer = 0;

const player = {
  x: 400,
  y: 400,
  angle: 0,
  hp: 100,
  maxHp: 100,
  speed: 3,
  ammo: 30,
  maxAmmo: 30,
  reloading: false,
  reloadTimer: 0,
  flashlightOn: true,
  battery: 100,
  batteryDrain: 0.03,
  flashlightAngle: Math.PI / 3,
  flashlightRange: 380,
  shootCooldown: 0,
  damageFlash: 0,
};

const keys: Record<string, boolean> = {};
let mouseX = screenW / 2;
let mouseY = screenH / 2;
let shooting = false;

const bullets: Bullet[] = [];
const particles: Particle[] = [];
const enemies: Enemy[] = [];
const items: Item[] = [];

// ---- Map ----
const MAP_W = 1600;
const MAP_H = 1200;
const CELL = 80;
const COLS = MAP_W / CELL;
const ROWS = MAP_H / CELL;

const walls: Wall[] = [];
const map: number[][] = [];

function generateMap() {
  for (let r = 0; r < ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
        map[r][c] = 1;
      } else {
        map[r][c] = 0;
      }
    }
  }

  // random rooms & corridors
  for (let i = 0; i < 20; i++) {
    const rw = 2 + Math.floor(Math.random() * 3);
    const rh = 2 + Math.floor(Math.random() * 3);
    const rx = 2 + Math.floor(Math.random() * (COLS - rw - 4));
    const ry = 2 + Math.floor(Math.random() * (ROWS - rh - 4));
    for (let r = ry; r < ry + rh; r++) {
      for (let c = rx; c < rx + rw; c++) {
        map[r][c] = 0;
      }
    }
  }

  // corridors
  for (let i = 0; i < 15; i++) {
    const horizontal = Math.random() > 0.5;
    const r = 2 + Math.floor(Math.random() * (ROWS - 4));
    const c = 2 + Math.floor(Math.random() * (COLS - 4));
    const len = 3 + Math.floor(Math.random() * 6);
    for (let j = 0; j < len; j++) {
      const rr = horizontal ? r : r + j;
      const cc = horizontal ? c + j : c;
      if (rr > 0 && rr < ROWS - 1 && cc > 0 && cc < COLS - 1) {
        map[rr][cc] = 0;
      }
    }
  }

  walls.length = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (map[r][c] === 1) {
        walls.push({ x: c * CELL, y: r * CELL, w: CELL, h: CELL });
      }
    }
  }
}

function isWall(x: number, y: number): boolean {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
  return map[r][c] === 1;
}

function isWallRect(x: number, y: number, rad: number): boolean {
  return (
    isWall(x - rad, y - rad) ||
    isWall(x + rad, y - rad) ||
    isWall(x - rad, y + rad) ||
    isWall(x + rad, y + rad)
  );
}

// ---- Line of sight ----
function hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist / 10);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    if (isWall(x, y)) return false;
  }
  return true;
}

// ---- Spawning ----
function spawnEnemy(type?: Enemy["type"]): Enemy {
  const t = type || pickEnemyType();
  let ex: number, ey: number;
  let tries = 0;
  do {
    ex = CELL * 2 + Math.random() * (MAP_W - CELL * 4);
    ey = CELL * 2 + Math.random() * (MAP_H - CELL * 4);
    tries++;
  } while ((isWallRect(ex, ey, 15) || Math.hypot(ex - player.x, ey - player.y) < 300) && tries < 100);

  const stats = {
    slime: { hp: 30, speed: 1.0, damage: 8, radius: 14, color: "#0f0" },
    ghost: { hp: 20, speed: 2.0, damage: 12, radius: 16, color: "#a0f" },
    demon: { hp: 60, speed: 0.8, damage: 20, radius: 20, color: "#f00" },
    boss: { hp: 200, speed: 0.6, damage: 30, radius: 30, color: "#ff0" },
  }[t];

  return {
    x: ex,
    y: ey,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    damage: stats.damage,
    type: t,
    angle: 0,
    visible: false,
    visibleTimer: 0,
    attackCooldown: 0,
    flashTimer: 0,
    radius: stats.radius,
  };
}

function pickEnemyType(): Enemy["type"] {
  if (wave % 5 === 0 && spawnedThisWave === 0) return "boss";
  const r = Math.random();
  if (wave < 3) return "slime";
  if (r < 0.4) return "slime";
  if (r < 0.7) return "ghost";
  return "demon";
}

function startWave() {
  const count = 3 + wave * 2;
  enemiesRemaining = count;
  spawnedThisWave = 0;
  spawnTimer = 0;
}

// ---- Items ----
function spawnItem(x: number, y: number) {
  if (Math.random() < 0.3) {
    const types: Item["type"][] = ["battery", "medkit", "ammo"];
    items.push({
      x,
      y,
      type: types[Math.floor(Math.random() * types.length)],
      radius: 10,
    });
  }
}

// ---- Particles ----
function spawnParticles(x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 30,
      maxLife: 60,
      color,
      size: 2 + Math.random() * 4,
    });
  }
}

// ---- Input ----
document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === "r" && !player.reloading && player.ammo < player.maxAmmo) {
    player.reloading = true;
    player.reloadTimer = 60;
  }
});
document.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));
document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});
document.addEventListener("mousedown", () => (shooting = true));
document.addEventListener("mouseup", () => (shooting = false));

// ---- Collision ----
function circleRect(
  cx: number,
  cy: number,
  cr: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  return Math.hypot(cx - nearX, cy - nearY) < cr;
}

function moveWithCollision(x: number, y: number, nx: number, ny: number, rad: number): Vec2 {
  let fx = nx;
  let fy = ny;
  if (isWallRect(fx, y, rad)) fx = x;
  if (isWallRect(x, fy, rad)) fy = y;
  return { x: fx, y: fy };
}

// ---- Update ----
function update() {
  if (gameState !== "playing") return;

  // Player angle toward mouse (screen center)
  player.angle = Math.atan2(mouseY - screenH / 2, mouseX - screenW / 2);

  // Movement
  let dx = 0;
  let dy = 0;
  if (keys["w"]) dy -= 1;
  if (keys["s"]) dy += 1;
  if (keys["a"]) dx -= 1;
  if (keys["d"]) dx += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx = (dx / len) * player.speed;
    dy = (dy / len) * player.speed;
    const pos = moveWithCollision(player.x, player.y, player.x + dx, player.y + dy, 12);
    player.x = pos.x;
    player.y = pos.y;
  }

  // Battery
  if (player.flashlightOn) {
    player.battery -= player.batteryDrain;
    if (player.battery <= 0) {
      player.battery = 0;
      player.flashlightOn = false;
    }
  }

  // Reload
  if (player.reloading) {
    player.reloadTimer--;
    if (player.reloadTimer <= 0) {
      player.ammo = player.maxAmmo;
      player.reloading = false;
    }
  }

  // Shooting
  if (player.shootCooldown > 0) player.shootCooldown--;
  if (shooting && player.ammo > 0 && player.shootCooldown <= 0 && !player.reloading) {
    player.ammo--;
    player.shootCooldown = 8;
    bullets.push({
      x: player.x,
      y: player.y,
      angle: player.angle,
      speed: 12,
      life: 60,
    });
    spawnParticles(player.x, player.y, "#ff0", 3);
  }

  // Bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;
    b.life--;
    if (b.life <= 0 || isWall(b.x, b.y)) {
      spawnParticles(b.x, b.y, "#ff0", 5);
      bullets.splice(i, 1);
      continue;
    }
    // Hit enemies
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + 5) {
        e.hp -= 25;
        e.flashTimer = 6;
        spawnParticles(e.x, e.y, "#f00", 8);
        bullets.splice(i, 1);
        if (e.hp <= 0) {
          score += e.type === "boss" ? 500 : e.type === "demon" ? 100 : e.type === "ghost" ? 75 : 50;
          spawnParticles(e.x, e.y, "#f00", 20);
          spawnItem(e.x, e.y);
          enemies.splice(j, 1);
          enemiesRemaining--;
        }
        break;
      }
    }
  }

  // Enemies
  for (const e of enemies) {
    const distToPlayer = Math.hypot(e.x - player.x, e.y - player.y);
    e.angle = Math.atan2(player.y - e.y, player.x - e.x);

    // Visibility check
    const inFlashlight =
      player.flashlightOn &&
      distToPlayer < player.flashlightRange &&
      Math.abs(normalizeAngle(e.angle - player.angle)) < player.flashlightAngle / 2 &&
      hasLineOfSight(player.x, player.y, e.x, e.y);

    if (inFlashlight) {
      e.visible = true;
      e.visibleTimer = 30;
    } else if (e.visibleTimer > 0) {
      e.visibleTimer--;
      if (e.visibleTimer <= 0) e.visible = false;
    }

    // Movement toward player
    if (distToPlayer > 30) {
      const speed = e.speed * (e.type === "ghost" ? 1.2 : 1);
      const nx = e.x + Math.cos(e.angle) * speed;
      const ny = e.y + Math.sin(e.angle) * speed;
      const pos = moveWithCollision(e.x, e.y, nx, ny, e.radius);
      e.x = pos.x;
      e.y = pos.y;
    }

    // Attack player
    if (distToPlayer < e.radius + 15 && e.attackCooldown <= 0) {
      player.hp -= e.damage;
      player.damageFlash = 15;
      e.attackCooldown = 40;
      spawnParticles(player.x, player.y, "#f00", 10);
    }
    if (e.attackCooldown > 0) e.attackCooldown--;
    if (e.flashTimer > 0) e.flashTimer--;
  }

  // Items
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (Math.hypot(it.x - player.x, it.y - player.y) < 25) {
      if (it.type === "battery") player.battery = Math.min(100, player.battery + 30);
      if (it.type === "medkit") player.hp = Math.min(player.maxHp, player.hp + 30);
      if (it.type === "ammo") player.ammo = Math.min(player.maxAmmo, player.ammo + 10);
      spawnParticles(it.x, it.y, "#0ff", 10);
      items.splice(i, 1);
    }
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Wave management
  if (enemiesRemaining <= 0 && enemies.length === 0) {
    waveTimer++;
    if (waveTimer > 120) {
      wave++;
      waveTimer = 0;
      startWave();
    }
  }

  // Spawn
  if (spawnedThisWave < 3 + wave * 2) {
    spawnTimer--;
    if (spawnTimer <= 0) {
      enemies.push(spawnEnemy());
      spawnedThisWave++;
      spawnTimer = 30;
    }
  }

  // Player damage flash
  if (player.damageFlash > 0) player.damageFlash--;

  // Death
  if (player.hp <= 0) {
    gameState = "over";
    document.getElementById("game-over")!.style.display = "flex";
    document.getElementById("final-score")!.textContent = `SCORE: ${score} | WAVE: ${wave}`;
  }

  // Toggle flashlight (F key handled in keydown separately)
  updateUI();
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ---- Render ----
function render() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, screenW, screenH);
  if (gameState !== "playing") return;

  const cx = screenW / 2;
  const cy = screenH / 2;

  // Camera offset
  const camX = player.x - cx;
  const camY = player.y - cy;

  ctx.save();

  // Draw floor
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const sx = c * CELL - camX;
      const sy = r * CELL - camY;
      if (sx + CELL < 0 || sx > screenW || sy + CELL < 0 || sy > screenH) continue;
      if (map[r][c] === 1) {
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(sx, sy, CELL, CELL);
        ctx.strokeStyle = "#16213e";
        ctx.strokeRect(sx, sy, CELL, CELL);
      } else {
        ctx.fillStyle = "#0a0a0f";
        ctx.fillRect(sx, sy, CELL, CELL);
      }
    }
  }

  // Draw items
  for (const it of items) {
    const sx = it.x - camX;
    const sy = it.y - camY;
    const glow =
      it.type === "battery" ? "#0f0" : it.type === "medkit" ? "#f0f" : "#0ff";
    ctx.beginPath();
    ctx.arc(sx, sy, it.radius, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Draw enemies
  for (const e of enemies) {
    const sx = e.x - camX;
    const sy = e.y - camY;
    if (sx < -50 || sx > screenW + 50 || sy < -50 || sy > screenH + 50) continue;

    const colors = { slime: "#0f0", ghost: "#a0f", demon: "#f00", boss: "#ff0" };
    const color = colors[e.type];

    if (e.visible || e.flashTimer > 0) {
      // Body
      ctx.beginPath();
      ctx.arc(sx, sy, e.radius, 0, Math.PI * 2);
      ctx.fillStyle = e.flashTimer > 0 ? "#fff" : color;
      ctx.fill();
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Eyes
      const ex1 = sx + Math.cos(e.angle - 0.3) * e.radius * 0.5;
      const ey1 = sy + Math.sin(e.angle - 0.3) * e.radius * 0.5;
      const ex2 = sx + Math.cos(e.angle + 0.3) * e.radius * 0.5;
      const ey2 = sy + Math.sin(e.angle + 0.3) * e.radius * 0.5;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex1, ey1, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex2, ey2, 3, 0, Math.PI * 2);
      ctx.fill();

      // HP bar
      if (e.hp < e.maxHp) {
        const barW = e.radius * 2;
        const hpRatio = e.hp / e.maxHp;
        ctx.fillStyle = "#300";
        ctx.fillRect(sx - barW / 2, sy - e.radius - 10, barW, 4);
        ctx.fillStyle = "#f00";
        ctx.fillRect(sx - barW / 2, sy - e.radius - 10, barW * hpRatio, 4);
      }
    } else {
      // Shadow hint (subtle in dark)
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.arc(sx, sy, e.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Draw bullets
  for (const b of bullets) {
    const sx = b.x - camX;
    const sy = b.y - camY;
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ff0";
    ctx.shadowColor = "#ff0";
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Particles
  for (const p of particles) {
    const sx = p.x - camX;
    const sy = p.y - camY;
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.beginPath();
    ctx.arc(sx, sy, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // ---- Flashlight overlay ----
  renderFlashlight(cx, cy);

  // Damage overlay
  if (player.damageFlash > 0) {
    ctx.fillStyle = `rgba(255,0,0,${player.damageFlash / 15 * 0.4})`;
    ctx.fillRect(0, 0, screenW, screenH);
  }

  // Low battery warning
  if (player.flashlightOn && player.battery < 20) {
    const flicker = Math.random() > 0.5 ? 0.1 : 0;
    ctx.fillStyle = `rgba(0,0,0,${flicker})`;
    ctx.fillRect(0, 0, screenW, screenH);
  }
}

function renderFlashlight(cx: number, cy: number) {
  if (!player.flashlightOn) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, screenW, screenH);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80);
    grad.addColorStop(0, "rgba(255,255,200,0.25)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, screenH);
    return;
  }

  // Flashlight cone as a "hole" in darkness
  // We draw darkness everywhere, then punch out the flashlight cone
  const angle = player.angle;
  const range = player.flashlightRange;
  const spread = player.flashlightAngle / 2;

  // Create clipping path for the flashlight cone
  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  // Draw dark overlay
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, screenW, screenH);

  // Punch out flashlight with destination-out
  ctx.globalCompositeOperation = "destination-out";

  // Cone shape
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, range, angle - spread, angle + spread);
  ctx.closePath();

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, range);
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(0.7, "rgba(0,0,0,0.8)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";

  // Warm light tint inside cone
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, range, angle - spread, angle + spread);
  ctx.closePath();
  const warmGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, range * 0.8);
  warmGrad.addColorStop(0, "rgba(255,255,200,0.15)");
  warmGrad.addColorStop(1, "rgba(255,255,200,0)");
  ctx.fillStyle = warmGrad;
  ctx.fill();

  ctx.restore();
}

// ---- UI ----
function updateUI() {
  document.getElementById("score")!.textContent = String(score);
  document.getElementById("wave")!.textContent = String(wave);
  const hpEl = document.getElementById("hp")!;
  hpEl.textContent = String(Math.max(0, Math.ceil(player.hp)));
  hpEl.className = player.hp < 30 ? "warning" : "";
  document.getElementById("ammo")!.textContent = String(player.ammo);
  document.getElementById("max-ammo")!.textContent = String(player.maxAmmo);
  const fill = document.getElementById("battery-fill")!;
  fill.style.width = `${player.battery}%`;
  fill.style.background = player.battery < 20 ? "#f00" : "#0f0";
}

// ---- Game Loop ----
function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

// ---- Start / Restart ----
(window as any).startGame = function () {
  document.getElementById("start-screen")!.style.display = "none";
  document.getElementById("game-over")!.style.display = "none";
  initGame();
};

(window as any).restartGame = function () {
  document.getElementById("game-over")!.style.display = "none";
  initGame();
};

function initGame() {
  gameState = "playing";
  score = 0;
  wave = 1;
  waveTimer = 0;
  player.x = 400;
  player.y = 400;
  player.hp = 100;
  player.ammo = 30;
  player.battery = 100;
  player.flashlightOn = true;
  player.reloading = false;
  player.damageFlash = 0;
  bullets.length = 0;
  particles.length = 0;
  enemies.length = 0;
  items.length = 0;
  generateMap();
  // Make sure player starts on open ground
  player.x = CELL * 3;
  player.y = CELL * 3;
  map[3][3] = 0;
  map[3][4] = 0;
  map[4][3] = 0;
  startWave();
}

// Toggle flashlight
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "f" && player.battery > 0) {
    player.flashlightOn = !player.flashlightOn;
  }
});

// ---- Init ----
generateMap();
gameLoop();
