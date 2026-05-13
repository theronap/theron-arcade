// src/scene.js — Isometric low-poly scene (Crossy Road style, Canvas 2D)

const TW = 56, TH = 28, SH = 24; // tile width, tile height, height step

// [top, left-face, right-face] color triples
const GRASS  = ['#72c948','#52941a','#3a7010'];
const DESK   = ['#d4a870','#9a6830','#7a5020'];
const TYPEW  = ['#555','#333','#1e1e1e'];
const PAPER  = ['#f5f0e0','#dcd4b8','#c8c0a0'];
const TRUNK  = ['#6b4226','#4a2e18','#3a2010'];
const LEAF0  = ['#5cb85c','#3d9a3d','#2d7020'];
const LEAF1  = ['#4caa4c','#318a31','#216021'];
const LEAF2  = ['#3c9a3c','#267a26','#185018'];
const PBODY  = ['#4a8ac8','#2a5880','#1a3860'];
const MBODY  = ['#8b5a2b','#5a3a18','#3a2810'];
const PHEAD  = '#f0c878';
const MHEAD  = '#c8824a';

let canvas, ctx, originX = 0, originY = 0, animT = 0;
let _gs = null;

// Player wander state
const pl = { x: 3.1, y: 3.2, tx: 3.1, ty: 3.2, wait: 0 };

export function initScene(getState) {
  _gs = getState;
  canvas = document.getElementById('game-scene');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  doResize();
  window.addEventListener('resize', doResize);
  requestAnimationFrame(mainLoop);
}

function doResize() {
  canvas.width = canvas.parentElement?.clientWidth || 600;
  canvas.height = 290;
  originX = canvas.width / 2;
  originY = 88;
}

function mainLoop(ms) {
  animT = ms / 1000;
  updateScene();
  drawScene();
  requestAnimationFrame(mainLoop);
}

// ── Isometric projection ──────────────────────────────────

function iso(x, y, z = 0) {
  return {
    x: originX + (x - y) * (TW / 2),
    y: originY + (x + y) * (TH / 2) - z * SH,
  };
}

// ── Primitives ────────────────────────────────────────────

function fillPoly(pts, color) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// Isometric box: position (x,y,z), size (w,d,h), color triple [top,left,right]
function ibox(x, y, z, w, d, h, c) {
  fillPoly([iso(x+w,y,z),   iso(x+w,y+d,z), iso(x+w,y+d,z+h), iso(x+w,y,z+h)], c[2]); // right
  fillPoly([iso(x,y+d,z),   iso(x+w,y+d,z), iso(x+w,y+d,z+h), iso(x,y+d,z+h)], c[1]); // left
  fillPoly([iso(x,y,z+h),   iso(x+w,y,z+h), iso(x+w,y+d,z+h), iso(x,y+d,z+h)], c[0]); // top
}

function groundTile(x, y) {
  fillPoly([iso(x,y), iso(x+1,y), iso(x+1,y+1), iso(x,y+1)], GRASS[0]);
}

function drawDesk(x, y) {
  ibox(x,      y,      0,    1,    1.1,  .48, DESK);
  ibox(x+.12,  y+.18,  .48,  .76,  .74,  .28, TYPEW);
  ibox(x+.28,  y+.12,  .76,  .44,  .04,  .28, PAPER);
  ibox(x+.14,  y+.55,  .76,  .72,  .12,  .06, ['#666','#444','#333']); // key strip
}

function drawTree(x, y) {
  ibox(x+.3, y+.3, 0, .4, .4, .55, TRUNK);
  const layers = [[.72, 0, LEAF0], [.58, .32, LEAF1], [.46, .60, LEAF2]];
  layers.forEach(([s, z, c]) => {
    const o = (1 - s) / 2;
    ibox(x + o, y + o, .55 + z, s, s, .3, c);
  });
}

function drawCharacter(x, y, bodyC, headC, typing = false) {
  const bob = typing
    ? Math.abs(Math.sin(animT * 6)) * .05
    : Math.sin(animT * 2.2 + x + y) * .04;

  // Shadow
  const sh = iso(x + .5, y + .5, 0);
  ctx.beginPath();
  ctx.ellipse(sh.x, sh.y + 3, 12, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fill();

  // Body cube
  ibox(x + .26, y + .26, bob, .48, .48, .7, bodyC);

  // Head circle
  const hp = iso(x + .5, y + .5, .7 + .22 + bob);
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, 9.5, 0, Math.PI * 2);
  ctx.fillStyle = headC;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.28)';
  ctx.lineWidth = .9;
  ctx.stroke();

  // Eyes
  const ep = iso(x + .5, y + .3, .7 + .26 + bob);
  ctx.fillStyle = '#222';
  [-3.5, 3.5].forEach(dx => {
    ctx.beginPath();
    ctx.arc(ep.x + dx, ep.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ── Scene logic ───────────────────────────────────────────

function updateScene() {
  const st = _gs?.();
  if (!st || st.monkeys === 0) {
    // Player at typewriter
    pl.x += (3.1 - pl.x) * .08;
    pl.y += (3.2 - pl.y) * .08;
    return;
  }
  // Player wanders when monkeys are working
  pl.wait -= .016;
  if (pl.wait <= 0) {
    pl.wait = 2.5 + Math.random() * 3.5;
    pl.tx = .4 + Math.random() * 2.2;
    pl.ty = 4.2 + Math.random() * 2.4;
  }
  pl.x += (pl.tx - pl.x) * .022;
  pl.y += (pl.ty - pl.y) * .022;
}

// ── Render ────────────────────────────────────────────────

// Extra desk positions in painter's order (back = low x+y first)
const EXTRA_DESKS = [
  { dx: 5,   dy: 1,   minMonkeys: 2  },
  { dx: 5,   dy: 2.5, minMonkeys: 6  },
  { dx: 1.5, dy: 4,   minMonkeys: 3  },
  { dx: 5,   dy: 4,   minMonkeys: 11 },
  { dx: 1.5, dy: 5.5, minMonkeys: 16 },
  { dx: 3.2, dy: 5.8, minMonkeys: 26 },
];

function drawScene() {
  const st = _gs?.();
  const mc = st?.monkeys || 0;
  const stalled = st?.monkeysStalled || false;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height * .6);
  sky.addColorStop(0, '#7ec8f0');
  sky.addColorStop(1, '#cce8f8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Ground tiles — painter's order: low (x+y) sum first
  for (let sum = 0; sum <= 14; sum++) {
    for (let tx = 0; tx < 8; tx++) {
      const ty = sum - tx;
      if (ty >= 0 && ty < 8) groundTile(tx, ty);
    }
  }

  // Back corner trees
  drawTree(0, 0);
  drawTree(5, 0);
  drawTree(6, 0);
  drawTree(0, 5);
  drawTree(0, 6);

  // Extra desks + their monkeys (back to front)
  EXTRA_DESKS.forEach(({ dx, dy, minMonkeys }) => {
    if (mc < minMonkeys) return;
    drawDesk(dx, dy);
    drawCharacter(dx + .1, dy + .1, MBODY, MHEAD, !stalled);
  });

  // Main desk (x+y = 6, drawn after sum=5 extras)
  drawDesk(3, 3);

  // Character at main desk
  if (mc > 0) {
    drawCharacter(3.1, 3.2, MBODY, MHEAD, !stalled);
  }

  // Player — always drawn last (frontmost)
  drawCharacter(pl.x, pl.y, PBODY, PHEAD, mc === 0);

  // Stall warning glyph
  if (stalled) {
    const p = iso(4.5, 1.5, 1.4);
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🍌❌', p.x, p.y);
  }
}
