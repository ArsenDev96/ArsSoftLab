/**
 * M1.3E: the Playground cabinet's miniature arcade game, drawn into a small
 * 2D canvas. Original content: a little ship weaving between purple crystal
 * formations over an amber-lit mountain range, collecting stars.
 *
 * Everything is a pure function of game time `g` (seconds since the screen
 * switched on): no state, no per-frame allocation beyond canvas paths, so a
 * paused or seeked clock always shows the same frame, and the world loops
 * naturally (the obstacle pattern repeats every 8 gates, about 10.7 s).
 *
 * Logical canvas: GAME_W x GAME_H units; the caller scales the context.
 * It is warped onto the cabinet's screen quad in ArcadeScreen.tsx (one unit
 * is about 0.56 reference px there, so shapes are kept bold and simple).
 */

export const GAME_W = 120;
export const GAME_H = 80;

/** The screen switches on over this long (s): a wipe from the top. */
export const BOOT_S = 0.2;
/** Game time shown as the reduced-motion still: ship between two gates, a star ahead. */
export const STILL_G = 1.25;

const SPEED = 30; // world units / s
const GATE = 40; // gate spacing (world units)
const CENTERS = [30, 42, 24, 38, 45, 27, 36, 23] as const; // gap centres, looped
const GAP = 31;
const HORIZON = 62;
const SHIP_X = 30;
/** World scroll at g = 0: a gate and a star are already in view at boot. */
const W0 = 18;

type Ctx = CanvasRenderingContext2D;

const frac = (x: number) => x - Math.floor(x);
const tri = (x: number) => 1 - 2 * Math.abs(frac(x) - 0.5);
const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const center = (i: number) => CENTERS[((i % CENTERS.length) + CENTERS.length) % CENTERS.length];

/** The ship's flight line: flat through each gap, eased between gaps. */
function pathY(wx: number) {
  const i = Math.floor(wx / GATE);
  return center(i) + (center(i + 1) - center(i)) * smooth(wx / GATE - i);
}
const bob = (g: number) => 0.9 * Math.sin(g * 4.2);

/** 3 x 5 pixel digits, rows top to bottom, bit 2 = left column. */
const DIGITS = [
  [7, 5, 5, 5, 7],
  [2, 6, 2, 2, 7],
  [7, 1, 7, 4, 7],
  [7, 1, 3, 1, 7],
  [5, 5, 7, 1, 1],
  [7, 4, 7, 1, 7],
  [7, 4, 7, 5, 7],
  [7, 1, 2, 2, 2],
  [7, 5, 7, 5, 7],
  [7, 5, 7, 1, 7],
];

/** Background stars: fixed pseudo-random positions over a 240-unit loop. */
const SKY_STARS = Array.from({ length: 24 }, (_, i) => {
  const h = (n: number) => frac(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453);
  return { x: h(1) * 240, y: 2 + h(2) * 40, r: 0.5 + h(3) * 0.6, p: h(4) * 6.28 };
});

const gradients = new WeakMap<Ctx, Record<string, CanvasGradient>>();
function grad(ctx: Ctx) {
  let g = gradients.get(ctx);
  if (g) return g;
  const lin = (y0: number, y1: number, stops: [number, string][]) => {
    const l = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [o, c] of stops) l.addColorStop(o, c);
    return l;
  };
  const sun = ctx.createRadialGradient(86, 37, 0, 86, 37, 19);
  sun.addColorStop(0, "rgb(255 226 160)");
  sun.addColorStop(0.42, "rgb(255 182 112)");
  sun.addColorStop(0.5, "rgb(255 150 120 / 0.55)");
  sun.addColorStop(1, "rgb(255 120 140 / 0)");
  const vignette = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, 26, GAME_W / 2, GAME_H / 2, 76);
  vignette.addColorStop(0, "rgb(8 4 24 / 0)");
  vignette.addColorStop(1, "rgb(8 4 24 / 0.42)");
  const glare = ctx.createLinearGradient(0, 0, 50, 46);
  glare.addColorStop(0, "rgb(255 255 255 / 0.09)");
  glare.addColorStop(1, "rgb(255 255 255 / 0)");
  // The display's last few units dim into the bezel (about 2 reference px).
  const edge = (horizontal: boolean) => {
    const len = horizontal ? GAME_W : GAME_H;
    const l = horizontal ? ctx.createLinearGradient(0, 0, len, 0) : ctx.createLinearGradient(0, 0, 0, len);
    const w = 4.5 / len;
    l.addColorStop(0, "rgb(6 3 18 / 0.85)");
    l.addColorStop(w, "rgb(6 3 18 / 0)");
    l.addColorStop(1 - w, "rgb(6 3 18 / 0)");
    l.addColorStop(1, "rgb(6 3 18 / 0.85)");
    return l;
  };
  g = {
    edgeX: edge(true),
    edgeY: edge(false),
    sky: lin(0, HORIZON, [
      [0, "rgb(50 50 142)"],
      [0.45, "rgb(106 88 214)"],
      [0.8, "rgb(186 118 206)"],
      [1, "rgb(250 164 146)"],
    ]),
    far: lin(26, 58, [
      [0, "rgb(255 178 96)"],
      [0.35, "rgb(196 104 112)"],
      [1, "rgb(70 36 104)"],
    ]),
    near: lin(48, HORIZON, [
      [0, "rgb(58 30 100)"],
      [1, "rgb(30 16 62)"],
    ]),
    ground: lin(HORIZON, GAME_H, [
      [0, "rgb(36 18 72)"],
      [1, "rgb(12 6 30)"],
    ]),
    sun,
    vignette,
    glare,
  };
  gradients.set(ctx, g);
  return g;
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number) {
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, "rgb(0 0 0 / 0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gr;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

function ridge(ctx: Ctx, base: number, height: (x: number) => number, fill: CanvasGradient, rim?: string) {
  ctx.beginPath();
  ctx.moveTo(-1, base + 20);
  for (let x = -1; x <= GAME_W + 1; x += 1.5) ctx.lineTo(x, base - height(x));
  ctx.lineTo(GAME_W + 1, base + 20);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (rim) {
    ctx.beginPath();
    for (let x = -1; x <= GAME_W + 1; x += 1.5) ctx[x < 0 ? "moveTo" : "lineTo"](x, base - height(x));
    ctx.strokeStyle = rim;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

/** One crystal formation: a main shard and two side shards, tip toward the gap. */
function crystal(ctx: Ctx, x: number, baseY: number, tipY: number) {
  const dir = Math.sign(tipY - baseY); // +1 hangs down, -1 grows up
  const shard = (cx: number, w: number, len: number, lean: number) => {
    const tip = baseY + dir * len;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, baseY - dir);
    ctx.lineTo(cx - w / 2 + lean * 0.4, tip - dir * w * 0.7);
    ctx.lineTo(cx + lean, tip);
    ctx.lineTo(cx + w / 2 + lean * 0.4, tip - dir * w * 0.7);
    ctx.lineTo(cx + w / 2, baseY - dir);
    ctx.closePath();
    const gr = ctx.createLinearGradient(0, tip, 0, baseY);
    gr.addColorStop(0, "rgb(206 150 255)");
    gr.addColorStop(0.25, "rgb(132 70 220)");
    gr.addColorStop(1, "rgb(40 18 92)");
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.strokeStyle = "rgb(226 190 255 / 0.85)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
    // Facet highlight.
    ctx.beginPath();
    ctx.moveTo(cx + lean, tip);
    ctx.lineTo(cx - w * 0.1, baseY);
    ctx.strokeStyle = "rgb(236 214 255 / 0.4)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
  };
  const len = Math.abs(tipY - baseY);
  shard(x - 5, 6, len * 0.55, -1.5);
  shard(x + 5, 5.5, len * 0.42, 1.2);
  shard(x, 9, len, 0);
  glow(ctx, x, tipY, 7, "rgb(200 140 255)", 0.55);
}

function star(ctx: Ctx, x: number, y: number, r: number, rot: number) {
  glow(ctx, x, y, r * 3, "rgb(255 190 90)", 0.6);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const rr = i % 2 ? r * 0.38 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = "rgb(255 222 140)";
  ctx.fill();
}

const SHIP_SCALE = 1.45;

function ship(ctx: Ctx, x: number, y: number, angle: number, g: number, scale = SHIP_SCALE) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  if (scale === SHIP_SCALE) {
    // Engine flame (amber), a gentle flicker, never a flash.
    const flame = 4.2 + 0.9 * Math.sin(g * 31) + 0.5 * Math.sin(g * 53);
    glow(ctx, -6, 0, 6, "rgb(255 170 80)", 0.7);
    ctx.beginPath();
    ctx.moveTo(-5.5, -1.6);
    ctx.lineTo(-5.5 - flame, 0);
    ctx.lineTo(-5.5, 1.6);
    ctx.fillStyle = "rgb(255 200 110)";
    ctx.fill();
    glow(ctx, 0, 0, 11, "rgb(130 236 255)", 0.5);
  }
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -4.4);
  ctx.lineTo(-3.6, 0);
  ctx.lineTo(-6, 4.4);
  ctx.closePath();
  const body = ctx.createLinearGradient(0, -4.4, 0, 4.4);
  body.addColorStop(0, "rgb(236 252 255)");
  body.addColorStop(1, "rgb(70 196 250)");
  ctx.fillStyle = body;
  ctx.fill();
  // Canopy.
  ctx.beginPath();
  ctx.ellipse(1.6, -0.3, 2.2, 1.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgb(150 70 220)";
  ctx.fill();
  ctx.restore();
}

function digits(ctx: Ctx, text: string, x: number, y: number, dot: number, color: string) {
  ctx.fillStyle = color;
  for (let c = 0; c < text.length; c++) {
    const rows = DIGITS[+text[c]];
    for (let r = 0; r < 5; r++)
      for (let b = 0; b < 3; b++) if (rows[r] & (4 >> b)) ctx.fillRect(x + (c * 4 + b) * dot, y + r * dot, dot, dot);
  }
}

/**
 * Draw the game at time `g` (s). While `g < BOOT_S` the screen is switching
 * on: only the part above a wipe line is shown (the original artwork stays
 * visible below it, through the transparent canvas), led by a soft bright edge.
 */
export function drawGame(ctx: Ctx, g: number) {
  const G = grad(ctx);
  const S = W0 + SPEED * g; // world scroll
  const shipW = S + SHIP_X; // ship's world x
  ctx.clearRect(0, 0, GAME_W, GAME_H);

  // Sky, sun, background stars.
  ctx.fillStyle = G.sky;
  ctx.fillRect(0, 0, GAME_W, HORIZON);
  ctx.fillStyle = G.sun;
  ctx.fillRect(66, 18, 40, 40);
  for (const s of SKY_STARS) {
    const x = ((((s.x - g * 3) % 240) + 240) % 240) - 60;
    if (x < -1 || x > GAME_W + 1) continue;
    ctx.globalAlpha = 0.35 + 0.3 * Math.sin(g * 2.2 + s.p);
    ctx.fillStyle = "rgb(236 228 255)";
    ctx.fillRect(x, s.y, s.r * 1.6, s.r * 1.6);
  }
  ctx.globalAlpha = 1;

  // Mountains (parallax): amber-lit far peaks, dark violet near hills.
  const far = g * 5;
  ridge(ctx, 56, (x) => 20 * tri((x + far) / 74) ** 1.6 + 7 * tri((x + far) / 29 + 0.35) + 2, G.far, "rgb(255 196 120 / 0.75)");
  const near = g * 12;
  ridge(ctx, HORIZON, (x) => 4 + 4 * Math.sin((x + near) / 9) + 3 * tri((x + near) / 23), G.near);

  // Ground: a cyan grid running toward the viewer.
  ctx.fillStyle = G.ground;
  ctx.fillRect(0, HORIZON, GAME_W, GAME_H - HORIZON);
  ctx.strokeStyle = "rgb(110 232 255)";
  for (let j = 0; j < 5; j++) {
    const p = frac((j + g * 1.4) / 5);
    const y = HORIZON + (GAME_H - HORIZON) * p * p;
    ctx.globalAlpha = 0.18 + 0.4 * p;
    ctx.lineWidth = 0.5 + 0.5 * p;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(GAME_W, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 0.7;
  const off = (SPEED * g) % 16;
  for (let m = -6; m <= 14; m++) {
    const xb = m * 16 - off;
    ctx.beginPath();
    ctx.moveTo(GAME_W / 2 + (xb - GAME_W / 2) * 0.4, HORIZON);
    ctx.lineTo(xb, GAME_H);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, HORIZON);
  ctx.lineTo(GAME_W, HORIZON);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Crystal gates.
  for (let i = Math.floor((S - 12) / GATE); i * GATE - S < GAME_W + 12; i++) {
    const x = i * GATE - S;
    const c = center(i);
    crystal(ctx, x, -1, c - GAP / 2);
    crystal(ctx, x, HORIZON + 1, c + GAP / 2);
  }

  // Stars between the gates, on the flight line; collected as the ship passes.
  let lastCollect = -1;
  for (let i = Math.floor((S - 12) / GATE); i * GATE - S < GAME_W + 12; i++) {
    const wx = i * GATE + GATE / 2;
    const x = wx - S;
    const y = pathY(wx) + bob((wx - W0 - SHIP_X) / SPEED);
    const age = (shipW - (wx - 2)) / SPEED; // s since collected
    if (age < 0) {
      star(ctx, x, y, 4.4 * (1 + 0.12 * Math.sin(g * 7 + i)), g * 1.6 + i);
    } else if (age < 0.45) {
      // Collected: a soft amber ring opens and fades.
      const k = age / 0.45;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = "rgb(255 214 130)";
      ctx.lineWidth = 1.2 * (1 - k) + 0.3;
      ctx.beginPath();
      ctx.arc(x, y, 3 + 10 * smooth(k), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      glow(ctx, x, y, 9, "rgb(255 220 150)", 0.7 * (1 - k));
    }
    if (age >= 0) lastCollect = i;
  }

  // The ship and its trail.
  const shipY = pathY(shipW) + bob(g);
  for (let k = 8; k >= 1; k--) {
    const tx = SHIP_X - 9 - k * 2.8;
    const ty = pathY(shipW - 9 - k * 2.8) + bob(g - (k * 2.8) / SPEED);
    ctx.globalAlpha = 0.5 * (1 - k / 9);
    ctx.fillStyle = k < 4 ? "rgb(150 236 255)" : "rgb(176 130 255)";
    ctx.beginPath();
    ctx.arc(tx, ty, 1.9 * (1 - k / 10), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const slope = (pathY(shipW + 2) - pathY(shipW - 2)) / 4;
  ship(ctx, SHIP_X, shipY, Math.atan(slope) * 0.9, g);

  // HUD: lives (top left), score (top right; +50 per star, brightens briefly).
  for (let l = 0; l < 3; l++) ship(ctx, 6.5 + l * 7.5, 5.5, 0, g, 0.48);
  // First star still ahead of the ship at boot.
  const firstStar = Math.floor((W0 + SHIP_X - GATE / 2 - 2) / GATE) + 1;
  const collected = Math.max(0, lastCollect - firstStar + 1);
  const score = String(2350 + collected * 50).padStart(5, "0");
  const sinceCollect = lastCollect >= 0 ? (shipW - (lastCollect * GATE + GATE / 2 - 2)) / SPEED : 9;
  const dot = 1.35;
  digits(ctx, score, GAME_W - 4 - (score.length * 4 - 1) * dot, 3, dot, sinceCollect < 0.3 ? "rgb(255 246 214)" : "rgb(255 200 110)");

  // Glass: edge falloff into the bezel and a faint reflection.
  ctx.fillStyle = G.vignette;
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.fillStyle = G.edgeX;
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.fillStyle = G.edgeY;
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.fillStyle = G.glare;
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  // Switching on: reveal from the top, led by a soft bright edge.
  if (g < BOOT_S) {
    const p = clamp01(g / BOOT_S);
    const y = GAME_H * (1 - (1 - p) ** 3) + 2;
    ctx.clearRect(0, y, GAME_W, GAME_H - y);
    const edge = ctx.createLinearGradient(0, y - 7, 0, y);
    edge.addColorStop(0, "rgb(210 246 255 / 0)");
    edge.addColorStop(1, `rgb(226 250 255 / ${0.75 * (1 - p * 0.6)})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, y - 7, GAME_W, 7);
  }
}
