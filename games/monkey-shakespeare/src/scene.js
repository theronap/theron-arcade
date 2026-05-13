// src/scene.js — Isometric low-poly scene with NPC selling mechanic

const GRID = 9;
let TW = 72, TH = 36, SH = 30; // adaptive, recalculated on resize

// Color palette [top, left-face, right-face]
const GRASS  = ['#6abf40','#4ea025','#387818'];
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

const NPC_PALETTES = [
  [['#c03030','#8a1a1a','#6a1010'], '#e87070'],
  [['#30a030','#1a6a1a','#0e4a0e'], '#70e870'],
  [['#9030c0','#5a1a8a','#3a106a'], '#c870e8'],
  [['#c08030','#8a5010','#6a3800'], '#e8b870'],
  [['#30a0b0','#1a6a78','#0e4a55'], '#70d8e8'],
  [['#b03080','#7a1a50','#5a0e38'], '#e870b8'],
];

let canvas, ctx, originX = 0, originY = 0, animT = 0, lastT = 0;
let _gs = null, _onSell = null;

// Player state
const pl = { x: 3.5, y: 4.0, tx: 3.5, ty: 4.0, wait: 0 };

// NPC pool
const npcs = [];
let npcSpawnTimer = 0;

// Floating text pool
const floats = []; // { x, y, z, text, life, maxLife, color }

export function initScene(getState, onSell) {
  _gs = getState;
  _onSell = onSell;
  canvas = document.getElementById('game-scene');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  doResize();
  window.addEventListener('resize', doResize);
  requestAnimationFrame(mainLoop);
}

function doResize() {
  const parent = canvas.parentElement;
  if (!parent) return;
  canvas.width  = parent.clientWidth  || 600;
  canvas.height = parent.clientHeight || 500;
  // Scale tiles so the grid fills ~90% of canvas width
  const scale = (canvas.width * 0.90) / (GRID * 36);
  TW = Math.round(36 * scale);
  TH = Math.round(18 * scale);
  SH = Math.round(15 * scale);
  originX = canvas.width  / 2;
  originY = canvas.height * 0.22;
}

function mainLoop(ms) {
  const dt = Math.min((ms - lastT) / 1000, 0.1);
  lastT = ms;
  animT = ms / 1000;
  updateScene(dt);
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

// ── Draw primitives ───────────────────────────────────────

function fillPoly(pts, color) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function ibox(x, y, z, w, d, h, c) {
  fillPoly([iso(x+w,y,z),   iso(x+w,y+d,z), iso(x+w,y+d,z+h), iso(x+w,y,z+h)], c[2]); // right
  fillPoly([iso(x,y+d,z),   iso(x+w,y+d,z), iso(x+w,y+d,z+h), iso(x,y+d,z+h)], c[1]); // left
  fillPoly([iso(x,y,z+h),   iso(x+w,y,z+h), iso(x+w,y+d,z+h), iso(x,y+d,z+h)], c[0]); // top
}

function groundTile(x, y) {
  // Subtle checkerboard feel
  const alt = (Math.floor(x) + Math.floor(y)) % 2 === 0;
  const col = alt ? GRASS[0] : '#68ba3c';
  fillPoly([iso(x,y), iso(x+1,y), iso(x+1,y+1), iso(x,y+1)], col);
}

function drawDesk(x, y) {
  ibox(x,      y,      0,    1,   1.1,  .48, DESK);
  ibox(x+.12,  y+.18,  .48,  .76, .74,  .28, TYPEW);
  ibox(x+.28,  y+.12,  .76,  .44, .04,  .28, PAPER);
  ibox(x+.14,  y+.55,  .76,  .72, .12,  .06, ['#666','#444','#333']);
}

function drawTree(x, y) {
  ibox(x+.30, y+.30, 0, .40, .40, .55, TRUNK);
  [[.72,0,LEAF0],[.58,.30,LEAF1],[.46,.58,LEAF2]].forEach(([s,z,c]) => {
    const o = (1-s)/2;
    ibox(x+o, y+o, .55+z, s, s, .30, c);
  });
}

function drawCharacter(x, y, bodyC, headC, typing = false, scale = 1) {
  const bob = typing
    ? Math.abs(Math.sin(animT * 7)) * .06
    : Math.sin(animT * 2.4 + x + y) * .04;

  const bw = .48 * scale, bd = .48 * scale, bh = .72 * scale;
  const off = (1 - bw) / 2;

  // Shadow
  const sh = iso(x + .5, y + .5, 0);
  ctx.beginPath();
  ctx.ellipse(sh.x, sh.y + 3, 13 * scale, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fill();

  // Body
  ibox(x + off, y + off, bob * scale, bw, bd, bh, bodyC);

  // Head
  const hp = iso(x + .5, y + .5, bh + .22 * scale + bob * scale);
  const hr = 9.5 * scale;
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2);
  ctx.fillStyle = headC;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.28)';
  ctx.lineWidth = .8;
  ctx.stroke();

  // Eyes
  const ep = iso(x + .5, y + .3, bh + .26 * scale + bob * scale);
  ctx.fillStyle = '#222';
  [-3.5 * scale, 3.5 * scale].forEach(dx => {
    ctx.beginPath();
    ctx.arc(ep.x + dx, ep.y, 1.8 * scale, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPaperStack(x, y, count) {
  const sheets = Math.min(count, 12);
  for (let i = 0; i < sheets; i++) {
    ibox(x, y, i * .055, .65, .45, .055, PAPER);
  }
}

// ── NPC helpers ───────────────────────────────────────────

function spawnNpc() {
  const fromLeft = Math.random() < 0.5;
  const pal = NPC_PALETTES[Math.floor(Math.random() * NPC_PALETTES.length)];
  const npc = {
    x:  fromLeft ? -1.2 : GRID + 0.2,
    y:  1.5 + Math.random() * (GRID - 3),
    tx: fromLeft ? GRID + 0.2 : -1.2,
    ty: 1.5 + Math.random() * (GRID - 3),
    spd: 1.0 + Math.random() * 0.5,
    bodyC: pal[0],
    headC: pal[1],
    state: 'walking',
    soldTimer: 0,
    saleAmount: 0,
  };
  npcs.push(npc);
}

// ── Scene update ──────────────────────────────────────────

function updateScene(dt) {
  const st = _gs?.();
  if (!st) return;

  updatePlayer(dt, st);
  updateNpcs(dt, st);
  updateFloats(dt);
}

function updatePlayer(dt, st) {
  const hasTarget = st.pendingPieces > 0 && npcs.some(n => n.state === 'walking');

  if (st.monkeys === 0) {
    // No monkeys: player at typewriter
    pl.tx = 3.1; pl.ty = 3.3;
  } else if (hasTarget) {
    // Chase nearest walking NPC
    let nearDist = Infinity, nearNpc = null;
    for (const n of npcs) {
      if (n.state !== 'walking') continue;
      const dx = n.x - pl.x, dy = n.y - pl.y;
      const d = dx*dx + dy*dy;
      if (d < nearDist) { nearDist = d; nearNpc = n; }
    }
    if (nearNpc) { pl.tx = nearNpc.x; pl.ty = nearNpc.y; }
  } else {
    // Wander idle
    pl.wait -= dt;
    if (pl.wait <= 0) {
      pl.wait = 2.0 + Math.random() * 3.5;
      pl.tx = 0.5 + Math.random() * 2.5;
      pl.ty = 5.0 + Math.random() * 2.5;
    }
  }

  // Move player toward target (faster when chasing)
  const spd = hasTarget ? 3.2 : 1.6;
  const dx = pl.tx - pl.x, dy = pl.ty - pl.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist > 0.05) {
    const step = Math.min(spd * dt, dist);
    pl.x += (dx / dist) * step;
    pl.y += (dy / dist) * step;
  }
}

function updateNpcs(dt, st) {
  // Spawn NPCs when there are pending pieces to sell
  if (st.pendingPieces > 0 && st.monkeys > 0) {
    npcSpawnTimer -= dt;
    const walkingCount = npcs.filter(n => n.state === 'walking').length;
    if (npcSpawnTimer <= 0 && walkingCount < Math.min(st.pendingPieces, 4)) {
      npcSpawnTimer = 2.5 + Math.random() * 2;
      spawnNpc();
    }
  }

  const SELL_DIST = 0.85;

  for (let i = npcs.length - 1; i >= 0; i--) {
    const n = npcs[i];

    if (n.state === 'sold') {
      n.soldTimer -= dt;
      if (n.soldTimer <= 0) { npcs.splice(i, 1); }
      continue;
    }

    // Move toward target
    const dx = n.tx - n.x, dy = n.ty - n.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const spd = n.state === 'leaving' ? n.spd * 2.5 : n.spd;
    if (dist > 0.05) {
      const step = Math.min(spd * dt, dist);
      n.x += (dx / dist) * step;
      n.y += (dy / dist) * step;
    }

    // Remove if off screen
    if (n.x < -2.5 || n.x > GRID + 2.5) {
      npcs.splice(i, 1);
      continue;
    }

    // Check sell collision with player
    if (n.state === 'walking' && st.pendingPieces > 0) {
      const pdx = n.x - pl.x, pdy = n.y - pl.y;
      if (Math.sqrt(pdx*pdx + pdy*pdy) < SELL_DIST) {
        const price = _onSell?.() ?? 0;
        if (price > 0) {
          n.state = 'sold';
          n.soldTimer = 1.0;
          n.saleAmount = price;
          // After sold, walk quickly away in original direction
          n.tx = n.tx > n.x ? GRID + 2 : -2;
          n.ty = n.y + (Math.random() - 0.5);
          floats.push({
            x: n.x + 0.5, y: n.y + 0.5,
            z: 1.4,
            text: '+$' + (price >= 1000 ? (price/1000).toFixed(1)+'K' : price.toFixed(2)),
            life: 1.8, maxLife: 1.8,
            color: '#5cd85c',
          });
        }
      }
    }
  }
}

function updateFloats(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    floats[i].life -= dt;
    floats[i].z += dt * 0.9;
    if (floats[i].life <= 0) floats.splice(i, 1);
  }
}

// ── Render ────────────────────────────────────────────────

const EXTRA_DESKS = [
  { x: 5.5, y: 1.0, min: 2  },
  { x: 5.5, y: 3.0, min: 6  },
  { x: 1.5, y: 4.5, min: 3  },
  { x: 5.5, y: 5.5, min: 11 },
  { x: 1.5, y: 6.5, min: 16 },
  { x: 3.5, y: 6.5, min: 26 },
];

function drawScene() {
  const st = _gs?.();
  const mc = st?.monkeys || 0;
  const stalled = st?.monkeysStalled || false;
  const pending = st?.pendingPieces || 0;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height * .55);
  sky.addColorStop(0, '#5ab8ec');
  sky.addColorStop(1, '#b8e4f8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Ground tiles — painter's order
  for (let sum = 0; sum <= (GRID - 1) * 2; sum++) {
    for (let tx = 0; tx < GRID; tx++) {
      const ty = sum - tx;
      if (ty >= 0 && ty < GRID) groundTile(tx, ty);
    }

    // Back trees
    if (sum === 5) drawTree(0, 5);
    if (sum === 6) { drawTree(0, 6); drawTree(6, 0); }
    if (sum === 7) { drawTree(7, 0); drawTree(0, 7); }

    // Extra desks + monkeys
    EXTRA_DESKS.forEach(({ x, y, min }) => {
      if (mc < min) return;
      const s = Math.round(x + y);
      if (s !== sum) return;
      drawDesk(x, y);
      drawCharacter(x + .1, y + .1, MBODY, MHEAD, !stalled);
    });

    // Paper stack (pending pieces) — next to main desk
    if (sum === 7 && pending > 0) {
      drawPaperStack(2.1, 4.2, pending);
    }

    // Main desk
    if (sum === 6) drawDesk(3, 3);

    // Character at main desk
    if (sum === 7) {
      if (mc > 0) drawCharacter(3.1, 3.2, MBODY, MHEAD, !stalled);
    }
  }

  // Walking NPCs (drawn after ground)
  // Sort NPCs by x+y for painter's order
  const sortedNpcs = [...npcs].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  for (const n of sortedNpcs) {
    const pal = n.bodyC;
    const bounce = n.state === 'sold' ? Math.abs(Math.sin(animT * 12)) * .12 : 0;
    drawCharacter(n.x, n.y, pal, n.headC, false, 0.85);
    if (n.state === 'sold' && bounce > 0) {
      // Extra bounce for sold NPCs
      const hp = iso(n.x + .5, n.y + .5, .72 * .85 + .22 * .85 + bounce);
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, 9.5 * .85, 0, Math.PI * 2);
      ctx.fillStyle = n.headC;
      ctx.fill();
    }
  }

  // Player — always frontmost
  drawCharacter(pl.x, pl.y, PBODY, PHEAD, mc === 0);

  // Floating sale text
  for (const f of floats) {
    const p = iso(f.x, f.y, f.z);
    const alpha = Math.min(1, f.life / f.maxLife * 2);
    ctx.font = `bold ${Math.round(TH * 0.45)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(92, 216, 92, ${alpha})`;
    ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.5})`;
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, p.x, p.y);
    ctx.fillText(f.text, p.x, p.y);
  }

  // Stall warning
  if (stalled && mc > 0) {
    const p = iso(4.5, 1.5, 1.6);
    ctx.font = `${Math.round(TH * 0.6)}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🍌❌', p.x, p.y);
  }
}
