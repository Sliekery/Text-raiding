/* World: tile maps for the Blood Moor (with the Rogue Encampment) and the Den of Evil.
   Generation, collision, line of sight, pathfinding and ground-chunk rendering. */
'use strict';

/* Ground types: base colour + texture style */
const G_GRASS = 0, G_DGRASS = 1, G_DIRT = 2, G_PATH = 3, G_MUD = 4, G_TOWN = 5, G_COBBLE = 6, G_CAVE = 7, G_WATER = 8, G_ROCK = 9, G_DEAD = 10;
const GROUND = [
  { c: [64, 72, 40], tex: 'grass' },
  { c: [44, 52, 30], tex: 'grass' },
  { c: [78, 66, 46], tex: 'dirt' },
  { c: [96, 82, 60], tex: 'dirt' },
  { c: [46, 40, 30], tex: 'dirt' },
  { c: [84, 72, 54], tex: 'dirt' },
  { c: [92, 88, 80], tex: 'cobble' },
  { c: [60, 54, 46], tex: 'cave' },
  { c: [22, 30, 30], tex: 'water' },
  { c: [70, 66, 60], tex: 'cave' },
  { c: [84, 80, 48], tex: 'grass' },
];
const B_FREE = 0, B_SOLID = 1, B_LOW = 2;
const CHUNK = 8;

class Area {
  constructor(id, w, h) {
    this.id = id; this.w = w; this.h = h;
    this.ground = new Uint8Array(w * h);
    this.block = new Uint8Array(w * h);
    this.wall = new Uint8Array(w * h);      // wall sprite style index (0 none)
    this.explored = new Uint8Array(w * h);
    this.objs = []; this.objGrid = new Map();
    this.chunks = new Map(); this.chunkOrder = [];
    this.monsters = []; this.items = []; this.npcs = []; this.lights = []; this.triggers = [];
    this.dark = .5; this.mlvl = [1, 3]; this.seed = 1;
    this.mapCanvas = null;
  }
  idx(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  g(x, y) { return this.inb(x, y) ? this.ground[y * this.w + x] : G_ROCK; }
  b(x, y) { return this.inb(x, y) ? this.block[y * this.w + x] : B_SOLID; }
  walkable(x, y) { return this.b(x | 0, y | 0) === B_FREE; }
  addObj(o) {
    this.objs.push(o);
    const k = ((o.x / CHUNK) | 0) + ',' + ((o.y / CHUNK) | 0);
    let a = this.objGrid.get(k); if (!a) this.objGrid.set(k, a = []); a.push(o);
    return o;
  }
}

/* ---------- Collision ---------- */
// Push a circle out of solid tiles, sliding along walls.
function moveCircle(area, e, dx, dy) {
  const r = e.r;
  const tryAxis = (nx, ny) => {
    const x0 = Math.floor(nx - r), x1 = Math.floor(nx + r), y0 = Math.floor(ny - r), y1 = Math.floor(ny + r);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (area.b(tx, ty) === B_FREE) continue;
      const cx = clamp(nx, tx, tx + 1), cy = clamp(ny, ty, ty + 1);
      if ((nx - cx) * (nx - cx) + (ny - cy) * (ny - cy) < r * r) return false;
    }
    return true;
  };
  let moved = false;
  if (tryAxis(e.x + dx, e.y + dy)) { e.x += dx; e.y += dy; return true; }
  if (dx && tryAxis(e.x + dx, e.y)) { e.x += dx; moved = true; }
  if (dy && tryAxis(e.x, e.y + dy)) { e.y += dy; moved = true; }
  return moved;
}
function circleFree(area, x, y, r) {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (area.b(tx, ty) === B_FREE) continue;
    const cx = clamp(x, tx, tx + 1), cy = clamp(y, ty, ty + 1);
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return false;
  }
  return true;
}
// Line of sight through tiles. Low blockers (water) do not block sight or missiles.
function los(area, x0, y0, x1, y1, walk) {
  const d = dist(x0, y0, x1, y1), n = Math.ceil(d * 3);
  for (let i = 1; i < n; i++) {
    const t = i / n, b = area.b(Math.floor(lerp(x0, x1, t)), Math.floor(lerp(y0, y1, t)));
    if (b === B_SOLID || (walk && b !== B_FREE)) return false;
  }
  return true;
}

/* ---------- A* pathfinding on the tile grid ---------- */
function findPath(area, sx, sy, gx, gy, maxNodes = 2500) {
  sx |= 0; sy |= 0; gx |= 0; gy |= 0;
  if (!area.inb(gx, gy)) return null;
  if (area.b(gx, gy) !== B_FREE) {
    // retarget to the nearest open tile around the goal
    let best = null, bd = 1e9;
    for (let r = 1; r <= 3 && !best; r++) for (let y = gy - r; y <= gy + r; y++) for (let x = gx - r; x <= gx + r; x++) {
      if (area.b(x, y) !== B_FREE) continue; const d = Math.abs(x - gx) + Math.abs(y - gy); if (d < bd) { bd = d; best = [x, y]; }
    }
    if (!best) return null; gx = best[0]; gy = best[1];
  }
  const W = area.w, start = sy * W + sx, goal = gy * W + gx;
  if (start === goal) return [];
  const gS = new Map(), came = new Map(), heap = [];
  const h = i => { const x = i % W, y = (i / W) | 0, dx = Math.abs(x - gx), dy = Math.abs(y - gy); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
  const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  gS.set(start, 0); push(start, h(start));
  let n = 0, bestI = start, bestH = h(start);
  while (heap.length && n++ < maxNodes) {
    const [, cur] = pop(); if (cur === goal) { bestI = goal; break; }
    const cx = cur % W, cy = (cur / W) | 0, cg = gS.get(cur);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy;
      if (area.b(nx, ny) !== B_FREE) continue;
      if (dx && dy && (area.b(cx + dx, cy) !== B_FREE || area.b(cx, cy + dy) !== B_FREE)) continue;
      const ni = ny * W + nx, ng = cg + (dx && dy ? 1.414 : 1);
      if (ng < (gS.has(ni) ? gS.get(ni) : 1e9)) { gS.set(ni, ng); came.set(ni, cur); const hh = h(ni); if (hh < bestH) { bestH = hh; bestI = ni; } push(ni, ng + hh); }
    }
  }
  const path = []; let c = bestI;
  while (c !== start && came.has(c)) { path.push([c % W + .5, ((c / W) | 0) + .5]); c = came.get(c); }
  path.reverse();
  // string-pull: skip waypoints we can walk to directly
  const out = []; let ax = sx + .5, ay = sy + .5, i = 0;
  while (i < path.length) {
    let j = path.length - 1;
    while (j > i && !walkLine(area, ax, ay, path[j][0], path[j][1])) j--;
    out.push(path[j]); ax = path[j][0]; ay = path[j][1]; i = j + 1;
  }
  return out;
}
function walkLine(area, x0, y0, x1, y1) {
  const d = dist(x0, y0, x1, y1), n = Math.ceil(d * 4);
  for (let i = 1; i <= n; i++) { const t = i / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t); if (!circleFree(area, x, y, .3)) return false; }
  return true;
}

/* ---------- Generation helpers ---------- */
function carveDisc(area, cx, cy, r, ground, clearBlock = true) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if (!area.inb(x, y) || dist(x + .5, y + .5, cx, cy) > r) continue;
    const i = area.idx(x, y); if (ground !== undefined) area.ground[i] = ground; if (clearBlock) { area.block[i] = B_FREE; area.wall[i] = 0; }
  }
}
function setWall(area, x, y, style) { if (!area.inb(x, y)) return; const i = area.idx(x, y); area.block[i] = B_SOLID; area.wall[i] = style; }
function occupied(area, x, y) { const i = area.idx(x, y); return area.block[i] !== B_FREE || area.reserved && area.reserved[i]; }
function reserve(area, x, y) { if (!area.reserved) area.reserved = new Uint8Array(area.w * area.h); if (area.inb(x, y)) area.reserved[area.idx(x, y)] = 1; }

/* Blood Moor: open moorland with the Rogue Encampment in its northern corner */
const TOWN = { x0: 7, y0: 7, x1: 37, y1: 37, fire: [22, 22] };
function genMoor(seed) {
  const W = 150, H = 150, A = new Area('moor', W, H), R = mulberry(seed);
  A.seed = seed; A.dark = .5; A.mlvl = [1, 4]; A.name = 'Blood Moor';
  // base ground
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = fbm(x * .07, y * .07, seed, 3), m = fbm(x * .11 + 50, y * .11, seed + 9, 2), d = fbm(x * .05, y * .05 + 80, seed + 3, 2);
    let g = G_GRASS; if (n > .6) g = G_DGRASS; if (m > .61) g = G_DIRT; if (d > .66) g = G_DEAD; if (m > .74 && n > .55) g = G_MUD;
    A.ground[A.idx(x, y)] = g;
  }
  // border cliffs with a ragged inner edge
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e = Math.min(x, y, W - 1 - x, H - 1 - y), t = 3 + Math.floor(vnoise(x * .15, y * .15, seed + 5) * 4);
    if (e < t) { setWall(A, x, y, 2); A.ground[A.idx(x, y)] = G_ROCK; }
  }
  // the camp
  const T = TOWN;
  for (let y = T.y0; y <= T.y1; y++) for (let x = T.x0; x <= T.x1; x++) { const i = A.idx(x, y); A.block[i] = 0; A.wall[i] = 0; A.ground[i] = G_TOWN; reserve(A, x, y); }
  carveDisc(A, T.fire[0] + .5, T.fire[1] + .5, 5.5, G_COBBLE);
  for (let x = T.x0; x <= T.x1; x++) { setWall(A, x, T.y0, 3); setWall(A, x, T.y1, 3); }
  for (let y = T.y0; y <= T.y1; y++) { setWall(A, T.x0, y, 3); setWall(A, T.x1, y, 3); }
  // gates on the east and south walls
  for (let k = -2; k <= 1; k++) { const g1 = A.idx(T.x1, 22 + k), g2 = A.idx(22 + k, T.y1); A.block[g1] = A.block[g2] = 0; A.wall[g1] = A.wall[g2] = 0; A.ground[g1] = A.ground[g2] = G_PATH; }
  A.townGate = [[T.x1 + .5, 21.5], [21.5, T.y1 + .5]];
  // paths out of the gates
  const carvePath = (x, y, tx, ty, wob) => {
    let dir = Math.atan2(ty - y, tx - x);
    for (let s = 0; s < 600; s++) {
      const want = Math.atan2(ty - y, tx - x); dir += clamp(want - dir, -.25, .25) + (R() - .5) * wob;
      x += Math.cos(dir) * .7; y += Math.sin(dir) * .7;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const px = Math.floor(x + ox * .7), py = Math.floor(y + oy * .7); if (!A.inb(px, py)) continue; const i = A.idx(px, py);
        if (A.wall[i] === 3) continue; if (A.wall[i] === 2 && Math.min(px, py, W - 1 - px, H - 1 - py) < 3) continue;
        A.ground[i] = G_PATH; A.block[i] = 0; A.wall[i] = 0; reserve(A, px, py);
      }
      if (dist(x, y, tx, ty) < 1.5) break;
    }
  };
  const den = [112 + Math.floor(R() * 14), 104 + Math.floor(R() * 14)];
  carvePath(T.x1 + 1, 21.5, 62, 40, .5);
  carvePath(62, 40, den[0], den[1] + 3.5, .6);
  carvePath(21.5, T.y1 + 1, 46, 78, .5);
  carvePath(46, 78, 78, 120, .6);
  carvePath(62, 40, 136, 60, .5);   // toward the Cold Plains road
  A.denEntry = den;
  // ponds
  for (let p = 0; p < 4; p++) {
    const cx = 50 + R() * 85, cy = 50 + R() * 85, r = 2.5 + R() * 2.5;
    if (dist(cx, cy, den[0], den[1]) < 12) continue;
    for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r * 1.4 - 2); x <= cx + r * 1.4 + 2; x++) {
      if (!A.inb(x, y)) continue; const i = A.idx(x, y); if (A.reserved && A.reserved[i]) continue;
      const d = Math.hypot((x - cx) / 1.4, y - cy) + (vnoise(x * .4, y * .4, seed + p) - .5) * 1.6;
      if (d < r) { A.ground[i] = G_WATER; A.block[i] = B_LOW; } else if (d < r + 1.4) A.ground[i] = G_MUD;
    }
    for (let k = 0; k < 10; k++) { const a = R() * TAU, rr = r + .4 + R(); const x = cx + Math.cos(a) * rr * 1.4, y = cy + Math.sin(a) * rr; if (A.walkable(x, y)) A.addObj({ t: 'reeds', v: Math.floor(R() * 3), x, y }); }
  }
  // den of evil entrance: a rocky mound with a cave mouth facing the path
  for (let y = den[1] - 4; y <= den[1] + 1; y++) for (let x = den[0] - 4; x <= den[0] + 3; x++) {
    const d = Math.hypot((x + .5 - den[0]) / 1.2, y + .5 - den[1] + 1.2);
    if (d < 3.6 && !(y >= den[1] && Math.abs(x + .5 - den[0]) < 1.2)) { setWall(A, x, y, 4); A.ground[A.idx(x, y)] = G_ROCK; }
  }
  for (let y = den[1]; y <= den[1] + 3; y++) for (let x = den[0] - 1; x <= den[0] + 1; x++) { const i = A.idx(x, y); A.block[i] = 0; A.wall[i] = 0; reserve(A, x, y); }
  A.addObj({ t: 'cavemouth', v: 0, x: den[0] + .5, y: den[1] + .3, solid: true });
  A.triggers.push({ x: den[0] + .5, y: den[1] + .7, r: .8, to: 'den', label: 'Den of Evil' });
  // rockslide at the Cold Plains road
  for (let k = 0; k < 9; k++) { const x = 136 + Math.floor(R() * 4), y = 57 + Math.floor(R() * 6); if (A.inb(x, y)) { A.reserved[A.idx(x, y)] = 0; A.addObj({ t: 'rock', v: Math.floor(R() * 4), x: x + .5, y: y + .5, solid: true, s: 1.3 }); A.block[A.idx(x, y)] = B_SOLID; } }
  A.addObj({ t: 'sign', v: 0, x: 132.5, y: 58.5, solid: true, text: 'The road to the Cold Plains lies buried under a rockslide.' });
  A.block[A.idx(132, 58)] = B_SOLID;
  // ruins: broken stone walls with pillars
  for (let k = 0; k < 7; k++) {
    let x = 45 + Math.floor(R() * 90), y = 45 + Math.floor(R() * 90); const horiz = R() < .5, len = 3 + Math.floor(R() * 6);
    if (dist(x, y, den[0], den[1]) < 10) continue;
    for (let s = 0; s < len; s++) { const px = x + (horiz ? s : 0), py = y + (horiz ? 0 : s); if (!A.inb(px, py) || occupied(A, px, py)) continue; if (R() < .82) setWall(A, px, py, 1); }
    if (R() < .7) { const px = x + (horiz ? 0 : 3), py = y + (horiz ? 3 : 0); for (let s = 0; s < len - 1; s++) { const qx = px + (horiz ? s : 0), qy = py + (horiz ? 0 : s); if (A.inb(qx, qy) && !occupied(A, qx, qy) && R() < .6) setWall(A, qx, qy, 1); } }
  }
  // scatter props
  const scatter = (t, n, opts = {}) => {
    for (let k = 0; k < n; k++) {
      let x, y, tries = 0;
      do { x = 4 + R() * (W - 8); y = 4 + R() * (H - 8); tries++; }
      while (tries < 20 && (occupied(A, x | 0, y | 0) || (opts.ground && !opts.ground.includes(A.g(x | 0, y | 0)))));
      if (tries >= 20) continue;
      const o = A.addObj({ t, v: Math.floor(R() * (opts.vars || 1)), x: (x | 0) + .5 + (opts.solid ? 0 : (R() - .5) * .6), y: (y | 0) + .5 + (opts.solid ? 0 : (R() - .5) * .6), solid: !!opts.solid, s: .85 + R() * .35, flip: R() < .5 });
      if (opts.solid) A.block[A.idx(x | 0, y | 0)] = B_SOLID;
      if (opts.cluster) for (let c = 0; c < opts.cluster; c++) { const cx = (x + (R() - .5) * 5) | 0, cy = (y + (R() - .5) * 5) | 0; if (A.inb(cx, cy) && !occupied(A, cx, cy)) { A.addObj({ t, v: Math.floor(R() * (opts.vars || 1)), x: cx + .5, y: cy + .5, solid: !!opts.solid, s: .8 + R() * .4, flip: R() < .5 }); if (opts.solid) A.block[A.idx(cx, cy)] = B_SOLID; } }
      void o;
    }
  };
  scatter('deadtree', 170, { solid: true, vars: 6 });
  scatter('tree', 16, { solid: true, vars: 4, cluster: 2, ground: [G_GRASS, G_DGRASS] });
  scatter('rock', 110, { solid: true, vars: 4 });
  scatter('stump', 40, { solid: true, vars: 2 });
  scatter('bush', 260, { vars: 4 });
  scatter('tallgrass', 420, { vars: 3, ground: [G_GRASS, G_DGRASS, G_DEAD] });
  scatter('bones', 40, { vars: 3 });
  // impaled corpses along the paths: the moor's grim welcome
  for (let k = 0, placed = 0; k < 400 && placed < 18; k++) {
    const x = 40 + Math.floor(R() * 100), y = 40 + Math.floor(R() * 100);
    if (A.g(x, y) !== G_PATH) continue; const ox = x + (R() < .5 ? 2 : -2), oy = y + (R() < .5 ? 1 : -1);
    if (!A.inb(ox, oy) || occupied(A, ox, oy)) continue;
    A.addObj({ t: 'impaled', v: Math.floor(R() * 2), x: ox + .5, y: oy + .5, solid: true, flip: R() < .5 }); A.block[A.idx(ox, oy)] = B_SOLID; placed++;
  }
  // a graveyard
  { const gx = 70 + Math.floor(R() * 40), gy = 85 + Math.floor(R() * 30);
    for (let k = 0; k < 14; k++) { const x = gx + (k % 5) * 2, y = gy + Math.floor(k / 5) * 2; if (A.inb(x, y) && !occupied(A, x, y)) { A.addObj({ t: 'grave', v: Math.floor(R() * 3), x: x + .5, y: y + .5, solid: true }); A.block[A.idx(x, y)] = B_SOLID; } }
    A.graveyard = [gx + 4, gy + 3]; }
  buildTown(A, R);
  scatterSpawns(A, R, 'moor');
  return A;
}

function buildTown(A, R) {
  const T = TOWN, f = T.fire;
  const solidRect = (x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) A.block[A.idx(x + i, y + j)] = B_SOLID; };
  A.addObj({ t: 'campfire', v: 0, x: f[0] + .5, y: f[1] + .5, solid: true }); A.block[A.idx(f[0], f[1])] = B_SOLID;
  A.lights.push({ x: f[0] + .5, y: f[1] + .5, r: 7.5, flicker: 1, warm: 1 });
  const tents = [[10, 10, 0], [26, 9, 1], [9, 25, 2], [29, 28, 0]];
  for (const [x, y, v] of tents) { A.addObj({ t: 'tent', v, x: x + 2, y: y + 2, solid: true }); solidRect(x + 1, y + 1, 3, 3); }
  A.addObj({ t: 'cart', v: 0, x: 18.5, y: 31, solid: true }); solidRect(17, 30, 3, 2);
  A.addObj({ t: 'stash', v: 0, x: 26.5, y: 23.5, solid: true, interact: 'stash', label: 'Stash' }); A.block[A.idx(26, 23)] = B_SOLID;
  A.addObj({ t: 'anvil', v: 0, x: 29.5, y: 16.5, solid: true }); A.block[A.idx(29, 16)] = B_SOLID;
  for (const [x, y] of [[16, 16], [28, 20], [16, 28], [34, 19], [34, 25], [19, 34], [25, 34]]) {
    A.addObj({ t: 'torch', v: 0, x: x + .5, y: y + .5, solid: true }); A.block[A.idx(x, y)] = B_SOLID; A.lights.push({ x: x + .5, y: y + .5, r: 4, flicker: 1, warm: 1 });
  }
  for (const [x, y, v] of [[12, 19, 0], [13, 20, 1], [31, 12, 0], [12, 31, 1], [30, 13, 1]]) { A.addObj({ t: 'crate', v, x: x + .5, y: y + .5, solid: true }); A.block[A.idx(x, y)] = B_SOLID; }
  A.npcs.push({ id: 'akara', x: 14.5, y: 16.2 }, { id: 'charsi', x: 30.5, y: 17.8 }, { id: 'kashya', x: 33.2, y: 23.4 });
  A.townSpawn = [f[0] + .5, f[1] + 2.5];
  A.portalSpot = [f[0] + 3.5, f[1] + 3.5];
}

/* Den of Evil: a cellular-automata cave */
function genDen(seed) {
  const W = 66, H = 66, A = new Area('den', W, H), R = mulberry(seed * 7 + 3);
  A.seed = seed; A.dark = .9; A.mlvl = [3, 5]; A.name = 'Den of Evil';
  let cells = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) cells[i] = R() < .47 ? 1 : 0;
  for (let it = 0; it < 5; it++) {
    const nx = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H || cells[Y * W + X]) n++; }
      nx[y * W + x] = n >= 5 || x < 2 || y < 2 || x > W - 3 || y > H - 3 ? 1 : 0;
    }
    cells = nx;
  }
  const entry = [8, 8], boss = [52 + Math.floor(R() * 6), 50 + Math.floor(R() * 8)];
  const disc = (cx, cy, r) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) { const X = cx + x, Y = cy + y; if (X > 1 && Y > 1 && X < W - 2 && Y < H - 2) cells[Y * W + X] = 0; } };
  disc(entry[0], entry[1], 3); disc(boss[0], boss[1], 6);
  // guaranteed winding tunnels between key points
  const tunnel = (a, b) => { let x = a[0], y = a[1]; for (let s = 0; s < 800 && (Math.abs(x - b[0]) > 1 || Math.abs(y - b[1]) > 1); s++) { if (R() < .6) x += Math.sign(b[0] - x); else y += Math.sign(b[1] - y); if (R() < .25) x += R() < .5 ? 1 : -1; if (R() < .25) y += R() < .5 ? 1 : -1; x = clamp(x, 3, W - 4); y = clamp(y, 3, H - 4); disc(x, y, 1 + (R() < .3 ? 1 : 0)); } };
  const mid1 = [12 + Math.floor(R() * 40), 30 + Math.floor(R() * 25)], mid2 = [30 + Math.floor(R() * 25), 10 + Math.floor(R() * 20)];
  tunnel(entry, mid1); tunnel(mid1, boss); tunnel(entry, mid2); tunnel(mid2, boss);
  // keep only the region connected to the entry
  const seen = new Uint8Array(W * H), st = [entry[1] * W + entry[0]]; seen[st[0]] = 1;
  while (st.length) { const c = st.pop(), x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (y + dy) * W + x + dx; if (!cells[n] && !seen[n]) { seen[n] = 1; st.push(n); } } }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, open = !cells[i] && seen[i];
    const nn = fbm(x * .12, y * .12, seed + 11, 2);
    A.ground[i] = nn > .62 ? G_MUD : G_CAVE;
    if (!open) { A.block[i] = B_SOLID; A.wall[i] = 5; A.ground[i] = G_ROCK; }
  }
  A.entry = [entry[0] + .5, entry[1] + .5]; A.boss = boss;
  A.addObj({ t: 'exitlight', v: 0, x: entry[0] - .3, y: entry[1] - .3 });
  A.triggers.push({ x: entry[0] - .2, y: entry[1] - .2, r: .8, to: 'moor', label: 'Exit to the Blood Moor' });
  A.lights.push({ x: entry[0], y: entry[1], r: 5, warm: 0 });
  for (let k = 0; k < 4; k++) reserve(A, entry[0] + k, entry[1] + k);
  const open = []; for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (A.block[A.idx(x, y)] === B_FREE) open.push([x, y]);
  for (let k = 0; k < 70; k++) { const [x, y] = open[Math.floor(R() * open.length)]; if (dist(x, y, entry[0], entry[1]) < 5 || dist(x, y, boss[0], boss[1]) < 4) continue; if (A.block[A.idx(x, y)] !== B_FREE) continue; const nWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => A.b(x + dx, y + dy)).length; if (nWall === 0 && R() < .6) continue; A.addObj({ t: 'stalag', v: Math.floor(R() * 3), x: x + .5, y: y + .5, solid: true, s: .8 + R() * .5 }); A.block[A.idx(x, y)] = B_SOLID; }
  for (let k = 0; k < 60; k++) { const [x, y] = open[Math.floor(R() * open.length)]; if (A.block[A.idx(x, y)] === B_FREE) A.addObj({ t: 'bones', v: Math.floor(R() * 3), x: x + R(), y: y + R() }); }
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; const x = Math.floor(boss[0] + Math.cos(a) * 4.5), y = Math.floor(boss[1] + Math.sin(a) * 4.5); if (A.b(x, y) === B_FREE) { A.addObj({ t: 'brazier', v: 0, x: x + .5, y: y + .5, solid: true }); A.block[A.idx(x, y)] = B_SOLID; A.lights.push({ x: x + .5, y: y + .5, r: 3.5, flicker: 1, warm: 1 }); } }
  scatterSpawns(A, R, 'den', open);
  return A;
}

/* Monster packs: which kinds live where */
function scatterSpawns(A, R, kind, open) {
  A.spawns = [];
  if (kind === 'moor') {
    for (let y = 14; y < A.h - 10; y += 8) for (let x = 14; x < A.w - 10; x += 8) {
      const px = x + Math.floor(R() * 6) - 3, py = y + Math.floor(R() * 6) - 3;
      if (!A.walkable(px, py) || (A.reserved && A.reserved[A.idx(px, py)] && A.g(px, py) !== G_PATH)) continue;
      const dTown = dist(px, py, 22, 22); if (dTown < 26) continue;
      if (R() > .5) continue;
      const far = clamp((dTown - 26) / 110, 0, 1);
      const roll = R(); let type, n;
      if (roll < .3) { type = 'zombie'; n = 2 + Math.floor(R() * 3); }
      else if (roll < .5) { type = 'quillrat'; n = 3 + Math.floor(R() * 3); }
      else if (roll < .5 + .2 + far * .1) { type = 'fallen'; n = 3 + Math.floor(R() * 3); }
      else { type = 'fallen'; n = 3 + Math.floor(R() * 3); A.spawns.push({ x: px + .5, y: py + .5, type: 'shaman', n: 1 + Math.floor(R() * 2), lvl: far }); }
      let rank = 'normal'; const rr = R(); if (dTown > 40 && rr < .07) rank = 'unique'; else if (dTown > 34 && rr < .16) rank = 'champion';
      A.spawns.push({ x: px + .5, y: py + .5, type, n, lvl: far, rank });
    }
    if (A.graveyard) A.spawns.push({ x: A.graveyard[0] + .5, y: A.graveyard[1] + 2.5, type: 'zombie', n: 5, lvl: 1, rank: 'unique', name: 'Gravewhisper the Rotten' });
  } else {
    for (let k = 0; k < 15; k++) {
      const [x, y] = open[Math.floor(R() * open.length)];
      if (dist(x, y, A.entry[0], A.entry[1]) < 9 || dist(x, y, A.boss[0], A.boss[1]) < 7 || A.b(x, y)) continue;
      const roll = R(); let type = 'fallen', n = 4 + Math.floor(R() * 3);
      if (roll < .22) { type = 'quillrat'; n = 3 + Math.floor(R() * 3); } else if (roll < .42) { type = 'zombie'; n = 3; } else if (roll < .62) { type = 'brute'; n = 2 + Math.floor(R() * 2); }
      else A.spawns.push({ x: x + .5, y: y + .5, type: 'shaman', n: 2, lvl: .5 });
      A.spawns.push({ x: x + .5, y: y + .5, type, n, lvl: R(), rank: R() < .12 ? 'champion' : 'normal' });
    }
    A.spawns.push({ x: A.boss[0] + .5, y: A.boss[1] + .5, type: 'zombie', n: 6, lvl: 1, rank: 'boss', name: 'Corpsefire' });
  }
}

/* ---------- Ground rendering: per-pixel textured chunks, cached ---------- */
function chunkBox(cx, cy) {
  const X0 = cx * CHUNK, Y0 = cy * CHUNK;
  return { X0, Y0, left: isoX(X0, Y0) - CHUNK * TW / 2, top: isoY(X0, Y0), w: CHUNK * TW, h: CHUNK * TH };
}
function renderChunk(A, cx, cy) {
  const B = chunkBox(cx, cy), c = makeCanvas(B.w, B.h), ctx = c.getContext('2d');
  const img = ctx.createImageData(B.w, B.h), d = img.data, s = A.seed, X1 = B.X0 + CHUNK, Y1 = B.Y0 + CHUNK;
  const colAt = (x, y) => GROUND[A.g(x, y)].c;
  for (let py = 0; py < B.h; py++) {
    const sy = B.top + py + .5;
    for (let px = 0; px < B.w; px++) {
      const sx = B.left + px + .5, wx = unIsoX(sx, sy), wy = unIsoY(sx, sy);
      if (wx < B.X0 || wy < B.Y0 || wx >= X1 || wy >= Y1) continue;
      // domain-warped tile lookup gives ragged, organic borders between ground types
      const n1 = vnoise(wx * 1.1, wy * 1.1, s + 1) - .5, n2 = vnoise(wx * 1.1 + 40, wy * 1.1, s + 2) - .5;
      const qx = wx + n1 * 1.1, qy = wy + n2 * 1.1, tx = Math.floor(qx), ty = Math.floor(qy);
      const gi = A.g(tx, ty), G = GROUND[gi];
      // soft blend with neighbours
      const bx = qx - .5, by = qy - .5, ix = Math.floor(bx), iy = Math.floor(by), fx = bx - ix, fy = by - iy;
      const c00 = colAt(ix, iy), c10 = colAt(ix + 1, iy), c01 = colAt(ix, iy + 1), c11 = colAt(ix + 1, iy + 1);
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < 3; k++) {
        const v = (c00[k] * (1 - fx) + c10[k] * fx) * (1 - fy) + (c01[k] * (1 - fx) + c11[k] * fx) * fy;
        const m = (G.c[k] + v) * .5; if (k === 0) r = m; else if (k === 1) g = m; else b = m;
      }
      const big = .82 + .36 * vnoise(wx * .18, wy * .18, s + 3);
      const grit = hash2(px + B.left, py + B.top, s) - .5;
      let m = big, rr = 1, gg = 1, bb = 1;
      switch (G.tex) {
        case 'grass': {
          const f = vnoise(wx * 3.2, wy * 3.2, s + 4), blade = hash2(Math.floor(sx / 2), Math.floor(sy * 1.6), s + 5);
          m *= .78 + f * .34 + grit * .2 + (blade > .9 ? .22 : blade < .08 ? -.2 : 0);
          gg = 1 + (f - .5) * .12; rr = 1 + (vnoise(wx * .6, wy * .6, s + 6) - .5) * .25; break;
        }
        case 'dirt': {
          const f = vnoise(wx * 2.6, wy * 2.6, s + 7), peb = hash2(Math.floor(wx * 9), Math.floor(wy * 9), s + 8);
          m *= .8 + f * .3 + grit * .16 + (peb > .965 ? .28 : 0) - (peb < .02 ? .15 : 0); break;
        }
        case 'cobble': {
          const u = wx * 2.2 + (Math.floor(wy * 2.2) % 2) * .5, v = wy * 2.2, fu = u - Math.floor(u), fv = v - Math.floor(v);
          const edge = Math.min(fu, 1 - fu, fv, 1 - fv), cell = hash2(Math.floor(u), Math.floor(v), s + 9);
          m *= (edge < .08 ? .45 : .82 + cell * .3) + grit * .14 + (edge > .08 && fu < .35 && fv < .35 ? .08 : 0); break;
        }
        case 'cave': {
          const f = vnoise(wx * 2, wy * 2, s + 10), cr = Math.abs(vnoise(wx * 1.4, wy * 1.4, s + 12) - .5);
          m *= .78 + f * .3 + grit * .18 - (cr < .025 ? .3 : 0); break;
        }
        case 'water': {
          const w1 = Math.sin(wx * 5 + wy * 2 + vnoise(wx, wy, s) * 6);
          m = .85 + grit * .08 + (w1 > .93 ? .5 : 0); bb = 1.1; break;
        }
      }
      const o = (py * B.w + px) * 4;
      d[o] = clamp(r * m * rr, 0, 255); d[o + 1] = clamp(g * m * gg, 0, 255); d[o + 2] = clamp(b * m * bb, 0, 255); d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // decals clipped to this chunk's diamond
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(B.w / 2, 0); ctx.lineTo(B.w, B.h / 2); ctx.lineTo(B.w / 2, B.h); ctx.lineTo(0, B.h / 2); ctx.closePath(); ctx.clip();
  for (let ty = B.Y0; ty < Y1; ty++) for (let tx = B.X0; tx < X1; tx++) {
    const gi = A.g(tx, ty), Rr = mulberry(tx * 7919 + ty * 104729 + s);
    const ox = isoX(tx + .5, ty + .5) - B.left, oy = isoY(tx + .5, ty + .5) - B.top;
    if (gi === G_GRASS || gi === G_DGRASS || gi === G_DEAD) {
      const n = 2 + Math.floor(Rr() * 4), base = GROUND[gi].c;
      for (let k = 0; k < n; k++) {
        const gx = ox + (Rr() - .5) * 44, gy = oy + (Rr() - .5) * 20, blades = 3 + Math.floor(Rr() * 4), lt = Rr() < .5;
        ctx.strokeStyle = lt ? rgb(base[0] * 1.35, base[1] * 1.3, base[2] * 1.1, .7) : rgb(base[0] * .55, base[1] * .6, base[2] * .5, .75); ctx.lineWidth = 1;
        ctx.beginPath(); for (let bl = 0; bl < blades; bl++) { const bx = gx + (Rr() - .5) * 6, hgt = 3 + Rr() * 5; ctx.moveTo(bx, gy); ctx.lineTo(bx + (Rr() - .5) * 4, gy - hgt); } ctx.stroke();
      }
      if (Rr() < .06) { ctx.fillStyle = rgb(150, 140, 120, .7); ctx.beginPath(); ctx.ellipse(ox + (Rr() - .5) * 30, oy + (Rr() - .5) * 12, 2 + Rr() * 2, 1 + Rr(), 0, 0, TAU); ctx.fill(); }
    } else if (gi === G_DIRT || gi === G_PATH || gi === G_TOWN || gi === G_MUD) {
      const n = Math.floor(Rr() * 3);
      for (let k = 0; k < n; k++) {
        const px = ox + (Rr() - .5) * 40, py = oy + (Rr() - .5) * 16, rr = 1.2 + Rr() * 2.2;
        ctx.fillStyle = rgb(30, 25, 18, .5); ctx.beginPath(); ctx.ellipse(px + 1, py + 1, rr, rr * .6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = rgb(120 + Rr() * 30, 108 + Rr() * 25, 88, .9); ctx.beginPath(); ctx.ellipse(px, py, rr, rr * .6, 0, 0, TAU); ctx.fill();
      }
      if (gi === G_PATH && Rr() < .5) { ctx.strokeStyle = rgb(50, 40, 28, .35); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox - 20, oy + (Rr() - .5) * 8); ctx.quadraticCurveTo(ox, oy + (Rr() - .5) * 10, ox + 20, oy + (Rr() - .5) * 8); ctx.stroke(); }
      if (gi === G_TOWN && Rr() < .25) { ctx.strokeStyle = rgb(150, 130, 70, .5); ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 4; k++) { const sx = ox + (Rr() - .5) * 40, sy = oy + (Rr() - .5) * 14; ctx.moveTo(sx, sy); ctx.lineTo(sx + (Rr() - .5) * 10, sy + (Rr() - .5) * 3); } ctx.stroke(); }
    } else if (gi === G_CAVE) {
      if (Rr() < .35) { ctx.fillStyle = rgb(90, 82, 70, .8); const px = ox + (Rr() - .5) * 40, py = oy + (Rr() - .5) * 16; ctx.beginPath(); ctx.ellipse(px, py, 1.5 + Rr() * 2, 1 + Rr(), 0, 0, TAU); ctx.fill(); }
    } else if (gi === G_WATER) {
      ctx.strokeStyle = rgb(120, 140, 140, .12); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(ox + (Rr() - .5) * 20, oy, 10 + Rr() * 8, 3, 0, 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
  return c;
}
function getChunk(A, cx, cy, budget) {
  const k = cx + ',' + cy; let c = A.chunks.get(k);
  if (c) return c;
  if (budget && budget.n <= 0) return null;
  if (budget) budget.n--;
  c = renderChunk(A, cx, cy); A.chunks.set(k, c); A.chunkOrder.push(k);
  if (A.chunkOrder.length > 90) { const old = A.chunkOrder.shift(); A.chunks.delete(old); }
  return c;
}

/* Automap: one diamond per explored tile, drawn into a small iso canvas */
const MAP_TW = 6, MAP_TH = 3;
function revealAround(A, x, y, r) {
  if (!A.mapCanvas) { A.mapCanvas = makeCanvas((A.w + A.h) * MAP_TW / 2 + 8, (A.w + A.h) * MAP_TH / 2 + 8); A.mapCtx = A.mapCanvas.getContext('2d'); }
  const ctx = A.mapCtx, ox = A.h * MAP_TW / 2 + 4;
  for (let ty = Math.floor(y - r); ty <= y + r; ty++) for (let tx = Math.floor(x - r); tx <= x + r; tx++) {
    if (!A.inb(tx, ty)) continue; const i = A.idx(tx, ty); if (A.explored[i]) continue;
    if ((tx + .5 - x) ** 2 + (ty + .5 - y) ** 2 > r * r) continue;
    A.explored[i] = 1;
    const b = A.block[i], g = A.ground[i];
    let col = null;
    if (b === B_SOLID) {
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => A.b(tx + dx, ty + dy) !== B_SOLID);
      if (edge) col = A.wall[i] === 3 ? '#b8935a' : '#c9c2b0';
    } else if (g === G_WATER) col = '#3b5d78';
    else if (g === G_PATH || g === G_COBBLE) col = 'rgba(190,170,130,.5)';
    else col = 'rgba(140,130,100,.16)';
    if (!col) continue;
    const sx = ox + (tx - ty) * MAP_TW / 2, sy = 4 + (tx + ty) * MAP_TH / 2;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + MAP_TW / 2, sy + MAP_TH / 2); ctx.lineTo(sx, sy + MAP_TH); ctx.lineTo(sx - MAP_TW / 2, sy + MAP_TH / 2); ctx.fill();
  }
}
