/* Art: every picture in the game is drawn here in code.
   Props and wall blocks are pre-rendered (per-pixel shaded) once; characters use a small 3D rig
   projected into the isometric view and are drawn live so they can face any direction. */
'use strict';

const COLC = new Map();
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
// shade a hex colour: k multiplies brightness, t = [r,g,b,amount] blends toward a tint
function col(h, k = 1, t) {
  const key = h + k + (t ? t.join() : ''); let c = COLC.get(key); if (c) return c;
  let [r, g, b] = hexRgb(h); r *= k; g *= k; b *= k;
  if (t) { r = lerp(r, t[0], t[3]); g = lerp(g, t[1], t[3]); b = lerp(b, t[2], t[3]); }
  c = rgb(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)); if (COLC.size > 6000) COLC.clear(); COLC.set(key, c); return c;
}

/* ---------- Wall blocks (per-pixel) ---------- */
const WALL_STYLE = {
  1: { h: 34, c: [112, 108, 98], jag: .35, tex: 'brick' },   // ruined stone
  2: { h: 70, c: [96, 86, 70], jag: .3, tex: 'rock' },       // moor cliffs
  4: { h: 46, c: [92, 84, 72], jag: .4, tex: 'rock' },       // den mound
  5: { h: 64, c: [70, 62, 54], jag: .25, tex: 'rock' },      // cave
};
const WALL_SPR = {};
function makeBlock(style, v) {
  const S = WALL_STYLE[style], R = mulberry(style * 100 + v), H = S.h + Math.floor(R() * 10), pad = 6;
  const W = 66, Hc = H + 34 + pad, c = makeCanvas(W, Hc), ctx = c.getContext('2d'), img = ctx.createImageData(W, Hc), d = img.data;
  const gy0 = H + 16 + pad, seed = style * 31 + v * 7;
  const colH = x => H * (1 - S.jag * vnoise((x + 33) * .09, v * 3.1, seed) * (style === 1 ? (vnoise(x * .05, v, seed + 3) > .5 ? 1.4 : .2) : 1));
  for (let py = 0; py < Hc; py++) for (let px = 0; px < W; px++) {
    const X = px - 32.5, Y = py - gy0 + .5, ax = Math.abs(X); if (ax > 32) continue;
    const hh = colH(X), half = 16 * (1 - ax / 32);
    // top face diamond at height hh
    const topY = Y + hh; let face = -1, z = 0, u = 0;
    if (Math.abs(topY) <= half) { face = 0; }
    else {
      const yg = X < 0 ? (X + 32) / 32 * 16 : 16 - X / 32 * 16; z = yg - Y;
      if (z >= 0 && z <= hh && Y > -hh - half) { face = X < 0 ? 1 : 2; u = X < 0 ? (X + 32) / 32 : X / 32; }
    }
    if (face < 0) continue;
    let m = face === 0 ? 1.12 : face === 1 ? .86 : .6;
    const nx = face === 0 ? X : u * 32 + (face === 2 ? 40 : 0), ny = face === 0 ? topY * 2 : z;
    const f = fbm(nx * .12, ny * .12, seed, 3), g = hash2(px, py, seed) - .5;
    if (S.tex === 'rock') {
      m *= .72 + f * .5 + g * .14;
      if (face) { const strata = Math.sin(z * .45 + f * 5); if (strata > .85) m *= .7; if (Math.abs(vnoise(nx * .2, ny * .07, seed + 5) - .5) < .03) m *= .55; }
      else if (vnoise(X * .3, topY * .6, seed + 9) > .72) m *= .82;
    } else {
      const row = Math.floor(z / 7), off = row % 2 ? 6 : 0, bu = (u * 32 + off) % 12, bz = z % 7;
      const mortar = face && (bz < 1 || bu < 1);
      m *= (mortar ? .55 : .78 + hash2(row, Math.floor((u * 32 + off) / 12) + face * 9, seed) * .3) + g * .12 + f * .15;
    }
    if (z > hh - 3 && face) m *= 1.12;            // lit lip under the top face
    if (face && z < 4) m *= .7 + z * .075;         // contact shadow
    const o = (py * W + px) * 4;
    let r = S.c[0], gg = S.c[1], b = S.c[2];
    if (face === 0 && style === 2 && f > .55) { r = 70; gg = 78; b = 48; }   // moss on the plateau
    d[o] = clamp(r * m, 0, 255); d[o + 1] = clamp(gg * m, 0, 255); d[o + 2] = clamp(b * m, 0, 255); d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  c.ax = 32; c.ay = gy0;
  return c;
}
function makePalisade(orient, v) {
  const c = makeCanvas(70, 110), ctx = c.getContext('2d'), R = mulberry(500 + orient * 10 + v), cx = 35, cy = 92;
  const logs = [];
  for (let k = -1.5; k <= 1.5; k += 1) {
    const lx = orient === 0 ? k * .25 : 0, ly = orient === 1 ? k * .25 : 0;
    logs.push([isoX(lx, ly), isoY(lx, ly)]);
  }
  logs.sort((a, b) => a[1] - b[1]);
  for (const [ox, oy] of logs) {
    const h = 56 + R() * 14, x = cx + ox, y = cy + oy, w = 6.5;
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, '#7a5a3a'); g.addColorStop(.35, '#8f6c46'); g.addColorStop(1, '#3a2a1a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w, y - h); ctx.lineTo(x, y - h - 9); ctx.lineTo(x + w, y - h); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,10,.55)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let k = 0; k < 4; k++) { const yy = y - R() * h; ctx.moveTo(x - w + 2, yy); ctx.lineTo(x - w + 2 + R() * 3, yy - 6 - R() * 8); } ctx.stroke();
    ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - w, y - h * .3); ctx.lineTo(x + w, y - h * .3 + 1); ctx.moveTo(x - w, y - h * .72); ctx.lineTo(x + w, y - h * .72 + 1); ctx.stroke();
  }
  c.ax = cx; c.ay = cy; return c;
}
function wallSprite(A, tx, ty) {
  const s = A.wall[A.idx(tx, ty)];
  if (s === 3) {
    const ex = A.inb(tx + 1, ty) && A.wall[A.idx(tx + 1, ty)] === 3, wx = A.inb(tx - 1, ty) && A.wall[A.idx(tx - 1, ty)] === 3;
    const o = ex || wx ? 0 : 1, v = (tx * 7 + ty * 3) % 3, k = 'p' + o + v;
    return WALL_SPR[k] || (WALL_SPR[k] = makePalisade(o, v));
  }
  const v = Math.floor(hash2(tx, ty, 77) * 4), k = s + '_' + v;
  return WALL_SPR[k] || (WALL_SPR[k] = makeBlock(s, v));
}

/* ---------- Props ---------- */
function shadowBlob(ctx, x, y, rx, ry, a = .35) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.fillStyle = g; ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y); ctx.beginPath(); ctx.arc(x, y, rx, 0, TAU); ctx.fill(); ctx.restore();
}
function drawBranch(ctx, R, x, y, ang, len, w, depth, dark, light) {
  const segs = 3; let cx = x, cy = y, a = ang;
  for (let s = 0; s < segs; s++) {
    a += (R() - .5) * .5; const nx = cx + Math.cos(a) * len / segs, ny = cy + Math.sin(a) * len / segs, nw = w * (1 - .22 * (s + 1) / segs);
    ctx.strokeStyle = dark; ctx.lineWidth = nw + 1.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke();
    ctx.strokeStyle = light; ctx.lineWidth = Math.max(.6, nw * .35); ctx.beginPath(); ctx.moveTo(cx - nw * .25, cy); ctx.lineTo(nx - nw * .25, ny); ctx.stroke();
    cx = nx; cy = ny;
  }
  if (depth <= 0 || w < 1.1) return;
  const n = depth > 2 ? 2 + (R() < .4 ? 1 : 0) : 2;
  for (let k = 0; k < n; k++) drawBranch(ctx, R, cx, cy, a + (k - (n - 1) / 2) * (.55 + R() * .4), len * (.62 + R() * .18), w * .62, depth - 1, dark, light);
}
const PROP_MAKERS = {
  deadtree(v) {
    const c = makeCanvas(170, 200), ctx = c.getContext('2d'), R = mulberry(900 + v), x = 85, y = 186;
    shadowBlob(ctx, x + 22, y + 2, 46, 14, .4);
    ctx.strokeStyle = '#2b241d'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const a = Math.PI * (k / 3) + R() * .4; ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.quadraticCurveTo(x + Math.cos(a) * 10, y + 2, x + Math.cos(a) * 18, y + 4 + R() * 3); ctx.stroke(); }
    const dark = v % 2 ? '#2e2620' : '#352c22', light = v % 2 ? '#62574a' : '#6d5d48';
    drawBranch(ctx, R, x, y, -Math.PI / 2 + (R() - .5) * .3, 60 + R() * 30, 12 + R() * 4, 4, dark, light);
    c.ax = x; c.ay = y; return c;
  },
  tree(v) {
    const c = makeCanvas(170, 210), ctx = c.getContext('2d'), R = mulberry(1200 + v), x = 85, y = 196;
    shadowBlob(ctx, x + 26, y, 56, 18, .45);
    ctx.fillStyle = '#2c2218'; ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x - 5, y - 70); ctx.lineTo(x + 5, y - 70); ctx.lineTo(x + 9, y); ctx.fill();
    ctx.fillStyle = '#4a3a28'; ctx.fillRect(x - 5, y - 68, 3, 64);
    const pal = [[[16, 22, 10], [70, 82, 38]], [[22, 22, 10], [86, 80, 40]], [[14, 20, 12], [60, 78, 44]], [[26, 18, 10], [98, 72, 38]]][v % 4];
    const cy = y - 112, rx = 52, ry = 44;
    ctx.strokeStyle = '#2c2218'; ctx.lineWidth = 3;
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x, y - 66); ctx.quadraticCurveTo(x + (R() - .5) * 30, y - 90, x + (R() - .5) * 70, cy - R() * 30); ctx.stroke(); }
    // leaf clumps shaded by a light from the upper left; back clumps first
    const clumps = [];
    for (let k = 0; k < 230; k++) {
      const a = R() * TAU, rr = Math.sqrt(R()), edge = .82 + vnoise(Math.cos(a) * 2 + 5, Math.sin(a) * 2, v) * .35;
      const dx = Math.cos(a) * rr * rx * edge, dy = Math.sin(a) * rr * ry * edge;
      clumps.push([dx, dy, 4 + R() * 7]);
    }
    clumps.sort((a, b) => a[1] - b[1]);
    for (const [dx, dy, r] of clumps) {
      const lit = clamp(.5 - (dx / rx) * .35 - (dy / ry) * .45 + (R() - .5) * .3, 0, 1);
      const c0 = pal[0], c1 = pal[1];
      ctx.fillStyle = rgb(lerp(c0[0], c1[0], lit), lerp(c0[1], c1[1], lit), lerp(c0[2], c1[2], lit));
      ctx.beginPath(); ctx.ellipse(x + dx, cy + dy, r * 1.15, r * .85, R() * 3, 0, TAU); ctx.fill();
      if (lit > .6 && R() < .5) { ctx.fillStyle = rgb(c1[0] * 1.25, c1[1] * 1.2, c1[2] * 1.1, .55); ctx.beginPath(); ctx.arc(x + dx - r * .3, cy + dy - r * .3, r * .4, 0, TAU); ctx.fill(); }
    }
    for (let k = 0; k < 220; k++) { const a = R() * TAU, rr = Math.sqrt(R()); ctx.fillStyle = R() < .6 ? 'rgba(6,8,4,.4)' : 'rgba(150,150,90,.16)'; ctx.fillRect(x + Math.cos(a) * rr * rx, cy + Math.sin(a) * rr * ry, 1.5, 1.5); }
    c.ax = x; c.ay = y; return c;
  },
  rock(v) {
    const c = makeCanvas(80, 64), ctx = c.getContext('2d'), R = mulberry(1500 + v), x = 40, y = 50;
    shadowBlob(ctx, x + 8, y, 30, 10, .4);
    const n = 9, pts = []; const rx = 22 + R() * 8, ry = 18 + R() * 10;
    for (let k = 0; k < n; k++) { const a = Math.PI + k / (n - 1) * Math.PI; pts.push([x + Math.cos(a) * rx * (.8 + R() * .3), y - 2 + Math.sin(a) * ry * (.8 + R() * .35)]); }
    const tint = [[104, 98, 88], [92, 88, 82], [110, 100, 82], [84, 80, 76]][v % 4];
    const g = ctx.createLinearGradient(x - rx, y - ry, x + rx, y); g.addColorStop(0, rgb(tint[0] * 1.25, tint[1] * 1.25, tint[2] * 1.2)); g.addColorStop(.5, rgb(...tint)); g.addColorStop(1, rgb(tint[0] * .45, tint[1] * .45, tint[2] * .45));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - rx, y); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(x + rx, y); ctx.quadraticCurveTo(x, y + 8, x - rx, y); ctx.fill();
    ctx.strokeStyle = 'rgba(20,16,12,.55)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let k = 0; k < 4; k++) { const sx = x - rx * .6 + R() * rx * 1.2, sy = y - ry * .7 + R() * ry * .6; ctx.moveTo(sx, sy); ctx.lineTo(sx + (R() - .5) * 12, sy + 4 + R() * 8); } ctx.stroke();
    for (let k = 0; k < 60; k++) { ctx.fillStyle = R() < .5 ? 'rgba(0,0,0,.18)' : 'rgba(255,240,210,.1)'; ctx.fillRect(x - rx + R() * rx * 2, y - ry + R() * ry, 1.5, 1.5); }
    if (R() < .6) { ctx.fillStyle = 'rgba(70,90,40,.55)'; for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(x - rx * .4 + R() * rx * .8, y - ry * .9 + R() * 6, 2 + R() * 3, 0, TAU); ctx.fill(); } }
    c.ax = x; c.ay = y; return c;
  },
  stump(v) {
    const c = makeCanvas(50, 46), ctx = c.getContext('2d'), x = 25, y = 36;
    shadowBlob(ctx, x + 6, y, 18, 6);
    ctx.fillStyle = '#3a2c1e'; ctx.fillRect(x - 10, y - 16, 20, 16); ctx.beginPath(); ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#5a4630'; ctx.fillRect(x - 10, y - 16, 5, 16);
    ctx.fillStyle = '#8a7250'; ctx.beginPath(); ctx.ellipse(x, y - 16, 10, 4.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5a4630'; ctx.beginPath(); ctx.ellipse(x, y - 16, 6, 2.6, 0, 0, TAU); ctx.stroke();
    if (v) { ctx.strokeStyle = '#3a2c1e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 4, y - 16); ctx.lineTo(x + 8, y - 34); ctx.stroke(); }
    c.ax = x; c.ay = y; return c;
  },
  bush(v) {
    const c = makeCanvas(70, 50), ctx = c.getContext('2d'), R = mulberry(1700 + v), x = 35, y = 40;
    shadowBlob(ctx, x + 6, y, 24, 7, .35);
    const pal = [['#24301a', '#3a4a26', '#56663a'], ['#30301a', '#4a4626', '#6a643a'], ['#2a2a1e', '#40402c', '#5c5a40'], ['#3a2c1a', '#56422a', '#74603e']][v % 4];
    for (let l = 0; l < 3; l++) for (let k = 0; k < 14; k++) { ctx.fillStyle = pal[l]; ctx.beginPath(); ctx.arc(x + (R() - .5) * 36, y - 8 - R() * 14 - l * 3, 4 + R() * 5 - l, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 5; k++) { ctx.moveTo(x + (R() - .5) * 20, y - 2); ctx.lineTo(x + (R() - .5) * 40, y - 20 - R() * 8); } ctx.stroke();
    c.ax = x; c.ay = y; return c;
  },
  tallgrass(v) {
    const c = makeCanvas(44, 34), ctx = c.getContext('2d'), R = mulberry(1900 + v), x = 22, y = 28;
    const pal = ['#5a6234', '#6c6a3a', '#4a5428'][v % 3];
    ctx.lineCap = 'round';
    for (let k = 0; k < 16; k++) { const bx = x + (R() - .5) * 22, h = 10 + R() * 14; ctx.strokeStyle = R() < .3 ? '#8a8450' : pal; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + (R() - .5) * 6, y - h * .6, bx + (R() - .5) * 10, y - h); ctx.stroke(); }
    c.ax = x; c.ay = y; return c;
  },
  reeds(v) {
    const c = makeCanvas(40, 50), ctx = c.getContext('2d'), R = mulberry(2000 + v), x = 20, y = 44;
    for (let k = 0; k < 9; k++) { const bx = x + (R() - .5) * 18, h = 20 + R() * 18; ctx.strokeStyle = '#5a6236'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + (R() - .5) * 4, y - h); ctx.stroke(); if (R() < .5) { ctx.fillStyle = '#4a3220'; ctx.fillRect(bx - 1.5, y - h - 2, 3, 7); } }
    c.ax = x; c.ay = y; return c;
  },
  bones(v) {
    const c = makeCanvas(44, 26), ctx = c.getContext('2d'), R = mulberry(2100 + v), x = 22, y = 18;
    ctx.strokeStyle = '#cfc6ae'; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const bx = x + (R() - .5) * 26, by = y + (R() - .5) * 8, a = R() * Math.PI; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx - Math.cos(a) * 6, by - Math.sin(a) * 3); ctx.lineTo(bx + Math.cos(a) * 6, by + Math.sin(a) * 3); ctx.stroke(); }
    if (v !== 1) { ctx.fillStyle = '#ddd5bc'; ctx.beginPath(); ctx.arc(x + 4, y - 3, 4.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a1612'; ctx.fillRect(x + 1.5, y - 4, 2, 2); ctx.fillRect(x + 4.8, y - 4, 2, 2); }
    c.ax = x; c.ay = y; return c;
  },
  impaled(v) {
    const c = makeCanvas(70, 130), ctx = c.getContext('2d'), x = 35, y = 120;
    shadowBlob(ctx, x + 12, y, 22, 6, .4);
    ctx.fillStyle = '#4a1810'; ctx.beginPath(); ctx.ellipse(x + 3, y, 12, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5c4228'; ctx.fillRect(x - 2.5, y - 104, 5, 104); ctx.fillStyle = '#7a5a38'; ctx.fillRect(x - 2.5, y - 104, 2, 104);
    ctx.fillStyle = '#6b5a44'; ctx.beginPath(); ctx.moveTo(x - 2.5, y - 104); ctx.lineTo(x, y - 116); ctx.lineTo(x + 2.5, y - 104); ctx.fill();
    // slumped body
    const sk = v ? '#8a6e5a' : '#7a6a58';
    ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.ellipse(x, y - 70, 10, 16, .1, 0, TAU); ctx.fill();
    ctx.fillStyle = sk; ctx.beginPath(); ctx.ellipse(x - 2, y - 72, 7, 13, .1, 0, TAU); ctx.fill();
    ctx.strokeStyle = sk; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 6, y - 80); ctx.lineTo(x - 13, y - 60); ctx.lineTo(x - 12, y - 46); ctx.moveTo(x + 6, y - 80); ctx.lineTo(x + 12, y - 62); ctx.lineTo(x + 14, y - 48); ctx.moveTo(x - 3, y - 58); ctx.lineTo(x - 7, y - 36); ctx.moveTo(x + 3, y - 58); ctx.lineTo(x + 5, y - 34); ctx.stroke();
    ctx.fillStyle = '#c9bfa6'; ctx.beginPath(); ctx.arc(x + 3, y - 88, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1210'; ctx.fillRect(x + 1, y - 89, 2, 2); ctx.fillRect(x + 5, y - 89, 2, 2);
    ctx.fillStyle = 'rgba(110,16,10,.8)'; ctx.fillRect(x - 1, y - 66, 3, 30); ctx.fillRect(x - 1.5, y - 40, 4, 38);
    c.ax = x; c.ay = y; return c;
  },
  grave(v) {
    const c = makeCanvas(56, 70), ctx = c.getContext('2d'), x = 28, y = 56;
    ctx.fillStyle = '#3a3024'; ctx.beginPath(); ctx.ellipse(x + 2, y + 2, 18, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4e4232'; ctx.beginPath(); ctx.ellipse(x + 2, y, 15, 5, 0, 0, TAU); ctx.fill();
    if (v === 2) {
      ctx.fillStyle = '#5c4a34'; ctx.fillRect(x - 3, y - 46, 6, 46); ctx.fillRect(x - 13, y - 36, 26, 6); ctx.fillStyle = '#7a6448'; ctx.fillRect(x - 3, y - 46, 2, 46);
    } else {
      const g = ctx.createLinearGradient(x - 12, 0, x + 12, 0); g.addColorStop(0, '#8e887c'); g.addColorStop(1, '#4a463e');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 11, y - 2); ctx.lineTo(x - 11, y - 34); ctx.arc(x, y - 34, 11, Math.PI, 0); ctx.lineTo(x + 11, y - 2); ctx.fill();
      ctx.fillStyle = '#3a362e'; ctx.fillRect(x + 7, y - 34, 4, 32);
      ctx.strokeStyle = 'rgba(30,26,20,.7)'; ctx.beginPath(); ctx.moveTo(x - 5, y - 32); ctx.lineTo(x + 5, y - 32); ctx.moveTo(x, y - 38); ctx.lineTo(x, y - 24); ctx.stroke();
      if (v === 1) { ctx.strokeStyle = 'rgba(20,16,12,.8)'; ctx.beginPath(); ctx.moveTo(x - 9, y - 40); ctx.lineTo(x - 2, y - 26); ctx.lineTo(x - 6, y - 14); ctx.stroke(); }
    }
    c.ax = x; c.ay = y; return c;
  },
  tent(v) {
    const c = makeCanvas(240, 210), ctx = c.getContext('2d'), x = 120, y = 150, R = mulberry(2300 + v);
    const P = (lx, ly, z = 0) => [x + isoX(lx, ly), y + isoY(lx, ly) - z];
    const s = 1.55, N = P(-s, -s), E = P(s, -s), S = P(s, s), Wc = P(-s, s), apex = P(0, 0, 118);
    shadowBlob(ctx, x + 30, y + 8, 120, 42, .45);
    const pal = [['#7a3a28', '#5a2a1c', '#a8845a'], ['#6e5a3c', '#4e3e28', '#a69064'], ['#5e3a3a', '#432828', '#9c7c5c']][v % 3];
    const face = (a, b, cA, cB) => { const g = ctx.createLinearGradient(apex[0], apex[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); g.addColorStop(0, cA); g.addColorStop(1, cB); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(apex[0], apex[1]); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill(); };
    face(Wc, S, col(pal[2], .95), col(pal[0], 1));
    face(S, E, col(pal[2], .62), col(pal[1], .8));
    // stripes
    ctx.save(); ctx.beginPath(); ctx.moveTo(apex[0], apex[1]); ctx.lineTo(Wc[0], Wc[1]); ctx.lineTo(S[0], S[1]); ctx.lineTo(E[0], E[1]); ctx.closePath(); ctx.clip();
    for (let k = 0; k < 8; k++) { const t = k / 8 + .03, a = [lerp(Wc[0], S[0], t), lerp(Wc[1], S[1], t)], b = [lerp(S[0], E[0], t), lerp(S[1], E[1], t)];
      ctx.strokeStyle = k % 2 ? 'rgba(20,10,6,.25)' : 'rgba(255,230,190,.08)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(apex[0], apex[1]); ctx.lineTo(a[0], a[1]); ctx.moveTo(apex[0], apex[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    for (let k = 0; k < 400; k++) { ctx.fillStyle = R() < .5 ? 'rgba(0,0,0,.12)' : 'rgba(255,220,180,.06)'; ctx.fillRect(x - 110 + R() * 220, y - 120 + R() * 170, 2, 2); }
    // patches
    ctx.fillStyle = 'rgba(40,24,14,.5)'; ctx.fillRect(x - 60, y - 20, 14, 10); ctx.fillRect(x + 40, y - 34, 12, 12);
    ctx.restore();
    ctx.strokeStyle = 'rgba(20,10,6,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(apex[0], apex[1]); ctx.lineTo(S[0], S[1]); ctx.stroke();
    // entrance flap
    const m = [lerp(Wc[0], S[0], .55), lerp(Wc[1], S[1], .55)], t1 = [lerp(apex[0], m[0], .45), lerp(apex[1], m[1], .45)];
    ctx.fillStyle = '#120a06'; ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.lineTo(m[0] - 26, m[1] - 13); ctx.lineTo(m[0] + 22, m[1] + 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col(pal[0], .8); ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.lineTo(m[0] + 22, m[1] + 11); ctx.lineTo(m[0] + 34, m[1] + 6); ctx.closePath(); ctx.fill();
    // poles and ropes
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(apex[0], apex[1]); ctx.lineTo(apex[0] - 6, apex[1] - 22); ctx.moveTo(apex[0], apex[1]); ctx.lineTo(apex[0] + 7, apex[1] - 18); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,180,140,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(apex[0], apex[1] + 4); ctx.lineTo(Wc[0] - 18, Wc[1] + 8); ctx.moveTo(apex[0], apex[1] + 4); ctx.lineTo(E[0] + 18, E[1] + 8); ctx.stroke();
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(Wc[0] - 20, Wc[1] + 4, 3, 7); ctx.fillRect(E[0] + 17, E[1] + 4, 3, 7);
    void N; c.ax = x; c.ay = y; return c;
  },
  cart() {
    const c = makeCanvas(170, 130), ctx = c.getContext('2d'), x = 85, y = 92;
    shadowBlob(ctx, x + 12, y + 6, 70, 24, .45);
    box(ctx, x, y, -1.2, -.7, 1.2, .7, 18, 44, '#6b4a2c');
    ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 1; for (let k = -1; k <= 1; k += .5) { const a = [x + isoX(k, .7), y + isoY(k, .7) - 18], b = [a[0], a[1] - 26]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    for (const [lx, ly] of [[-.8, .75], [.8, .75]]) { const p = [x + isoX(lx, ly), y + isoY(lx, ly) - 14]; ctx.strokeStyle = '#2e2014'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(p[0], p[1], 14, 15, -.45, 0, TAU); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; ctx.moveTo(p[0] - Math.cos(a) * 13, p[1] - Math.sin(a) * 14); ctx.lineTo(p[0] + Math.cos(a) * 13, p[1] + Math.sin(a) * 14); } ctx.stroke(); }
    // canvas cover
    const a = [x + isoX(-1.2, -.7), y + isoY(-1.2, -.7) - 44], b = [x + isoX(1.2, -.7), y + isoY(1.2, -.7) - 44], cc = [x + isoX(1.2, .7), y + isoY(1.2, .7) - 44], d = [x + isoX(-1.2, .7), y + isoY(-1.2, .7) - 44];
    const g = ctx.createLinearGradient(0, a[1] - 30, 0, cc[1]); g.addColorStop(0, '#cbbb98'); g.addColorStop(1, '#8a7a5c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(d[0], d[1]); ctx.bezierCurveTo(d[0], d[1] - 40, a[0], a[1] - 40, a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.bezierCurveTo(b[0], b[1] - 40, cc[0], cc[1] - 40, cc[0], cc[1]); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6e604a'; ctx.beginPath(); ctx.moveTo(cc[0], cc[1]); ctx.bezierCurveTo(cc[0], cc[1] - 40, b[0], b[1] - 40, b[0], b[1]); ctx.lineTo(b[0] + 2, b[1] + 2); ctx.lineTo(cc[0] + 2, cc[1] + 2); ctx.fill();
    ctx.strokeStyle = 'rgba(60,50,36,.6)'; ctx.beginPath(); for (let k = 0; k <= 4; k++) { const t = k / 4, p = [lerp(d[0], cc[0], t), lerp(d[1], cc[1], t)], q = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; ctx.moveTo(p[0], p[1]); ctx.bezierCurveTo(p[0], p[1] - 40, q[0], q[1] - 40, q[0], q[1]); } ctx.stroke();
    c.ax = x; c.ay = y; return c;
  },
  stash() {
    const c = makeCanvas(80, 70), ctx = c.getContext('2d'), x = 40, y = 52;
    shadowBlob(ctx, x + 6, y + 3, 30, 10, .45);
    box(ctx, x, y, -.4, -.3, .4, .3, 0, 20, '#5e3e22');
    const a = [x + isoX(-.4, .3), y + isoY(-.4, .3) - 20], b = [x + isoX(.4, .3), y + isoY(.4, .3) - 20], cTop = [x + isoX(.4, -.3), y + isoY(.4, -.3) - 20], d = [x + isoX(-.4, -.3), y + isoY(-.4, -.3) - 20];
    ctx.fillStyle = '#7a5430'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + d[0]) / 2, a[1] - 14, d[0], d[1]); ctx.lineTo(cTop[0], cTop[1]); ctx.quadraticCurveTo((b[0] + cTop[0]) / 2, b[1] - 14, b[0], b[1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lerp(a[0], b[0], .2), lerp(a[1], b[1], .2)); ctx.lineTo(lerp(a[0], b[0], .2), lerp(a[1], b[1], .2) + 20); ctx.moveTo(lerp(a[0], b[0], .8), lerp(a[1], b[1], .8)); ctx.lineTo(lerp(a[0], b[0], .8), lerp(a[1], b[1], .8) + 20); ctx.stroke();
    ctx.fillStyle = '#e0c060'; const m = [lerp(a[0], b[0], .5), lerp(a[1], b[1], .5)]; ctx.fillRect(m[0] - 3, m[1] + 2, 6, 7);
    c.ax = x; c.ay = y; return c;
  },
  anvil() {
    const c = makeCanvas(70, 60), ctx = c.getContext('2d'), x = 35, y = 46;
    shadowBlob(ctx, x + 5, y + 2, 24, 8, .45);
    box(ctx, x, y, -.25, -.25, .25, .25, 0, 14, '#4a3a2a');
    ctx.fillStyle = '#3c3e42'; ctx.beginPath(); ctx.moveTo(x - 26, y - 22); ctx.lineTo(x + 18, y - 24); ctx.lineTo(x + 26, y - 18); ctx.lineTo(x + 8, y - 14); ctx.lineTo(x - 10, y - 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a6e74'; ctx.fillRect(x - 18, y - 25, 34, 3);
    c.ax = x; c.ay = y; return c;
  },
  crate(v) {
    const c = makeCanvas(60, 64), ctx = c.getContext('2d'), x = 30, y = 50;
    shadowBlob(ctx, x + 5, y + 2, 24, 8, .45);
    if (v) { ctx.fillStyle = '#5a3e24'; ctx.beginPath(); ctx.ellipse(x, y - 2, 13, 6, 0, 0, Math.PI); ctx.lineTo(x - 13, y - 30); ctx.ellipse(x, y - 30, 13, 6, 0, Math.PI, 0, true); ctx.fill(); const g = ctx.createLinearGradient(x - 13, 0, x + 13, 0); g.addColorStop(0, 'rgba(255,220,170,.18)'); g.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = g; ctx.fillRect(x - 13, y - 30, 26, 28); ctx.fillStyle = '#7a5632'; ctx.beginPath(); ctx.ellipse(x, y - 30, 13, 6, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - 8, 13, 6, 0, 0, Math.PI); ctx.moveTo(x + 13, y - 24); ctx.ellipse(x, y - 24, 13, 6, 0, 0, Math.PI); ctx.stroke(); }
    else { box(ctx, x, y, -.3, -.3, .3, .3, 0, 26, '#6b4c2c'); ctx.strokeStyle = 'rgba(30,20,10,.6)'; ctx.lineWidth = 1.5; const p = (lx, ly, z) => [x + isoX(lx, ly), y + isoY(lx, ly) - z]; const a = p(-.3, .3, 0), b = p(.3, .3, 26), c2 = p(.3, .3, 0), d = p(-.3, .3, 26); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c2[0], c2[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); }
    c.ax = x; c.ay = y; return c;
  },
  torch() {
    const c = makeCanvas(30, 80), ctx = c.getContext('2d'), x = 15, y = 72;
    shadowBlob(ctx, x + 3, y, 9, 3);
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 2.5, y - 52, 5, 52); ctx.fillStyle = '#5a4430'; ctx.fillRect(x - 2.5, y - 52, 2, 52);
    ctx.fillStyle = '#2c2c2e'; ctx.beginPath(); ctx.moveTo(x - 8, y - 56); ctx.lineTo(x + 8, y - 56); ctx.lineTo(x + 4, y - 50); ctx.lineTo(x - 4, y - 50); ctx.fill();
    c.ax = x; c.ay = y; c.flame = [0, -58]; return c;
  },
  brazier() {
    const c = makeCanvas(40, 60), ctx = c.getContext('2d'), x = 20, y = 52;
    shadowBlob(ctx, x + 3, y, 14, 4);
    ctx.strokeStyle = '#2a2a2c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x - 3, y - 24); ctx.moveTo(x + 9, y); ctx.lineTo(x + 3, y - 24); ctx.moveTo(x, y + 2); ctx.lineTo(x, y - 24); ctx.stroke();
    ctx.fillStyle = '#3a3a3e'; ctx.beginPath(); ctx.ellipse(x, y - 26, 11, 4, 0, 0, Math.PI); ctx.lineTo(x - 11, y - 30); ctx.lineTo(x + 11, y - 30); ctx.fill();
    ctx.fillStyle = '#ff9a40'; ctx.beginPath(); ctx.ellipse(x, y - 30, 10, 3.5, 0, 0, TAU); ctx.fill();
    c.ax = x; c.ay = y; c.flame = [0, -32]; return c;
  },
  campfire() {
    const c = makeCanvas(90, 60), ctx = c.getContext('2d'), x = 45, y = 36, R = mulberry(77);
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, sx = x + Math.cos(a) * 24, sy = y + Math.sin(a) * 11; ctx.fillStyle = '#2a2622'; ctx.beginPath(); ctx.ellipse(sx + 1, sy + 2, 7, 4.5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = rgb(110 + R() * 30, 104 + R() * 20, 92); ctx.beginPath(); ctx.ellipse(sx, sy, 6.5, 4.2, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(x, y, 18, 8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 16, y + 4); ctx.lineTo(x + 10, y - 4); ctx.moveTo(x + 14, y + 4); ctx.lineTo(x - 8, y - 5); ctx.moveTo(x - 2, y + 7); ctx.lineTo(x + 2, y - 7); ctx.stroke();
    ctx.fillStyle = '#ff7a2a'; for (let k = 0; k < 20; k++) ctx.fillRect(x - 12 + R() * 24, y - 4 + R() * 8, 2, 2);
    c.ax = x; c.ay = y; c.flame = [0, -4]; c.big = true; return c;
  },
  cavemouth() {
    const c = makeCanvas(150, 120), ctx = c.getContext('2d'), x = 75, y = 96;
    const g = ctx.createRadialGradient(x, y - 24, 4, x, y - 20, 46); g.addColorStop(0, '#000'); g.addColorStop(.7, '#0a0806'); g.addColorStop(1, 'rgba(20,16,12,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 36, y + 4); ctx.quadraticCurveTo(x - 40, y - 62, x, y - 64); ctx.quadraticCurveTo(x + 40, y - 62, x + 36, y + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(x - 26, y + 2); ctx.quadraticCurveTo(x - 28, y - 50, x, y - 52); ctx.quadraticCurveTo(x + 28, y - 50, x + 26, y + 2); ctx.closePath(); ctx.fill();
    // timber frame
    ctx.fillStyle = '#4a3420'; ctx.fillRect(x - 30, y - 50, 7, 54); ctx.fillRect(x + 23, y - 50, 7, 54); ctx.fillRect(x - 34, y - 56, 68, 8);
    ctx.fillStyle = '#6a4c30'; ctx.fillRect(x - 30, y - 50, 2.5, 54); ctx.fillRect(x - 34, y - 56, 68, 2.5);
    ctx.fillStyle = '#ddd5bc'; ctx.beginPath(); ctx.arc(x, y - 52, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#100c08'; ctx.fillRect(x - 3, y - 54, 2, 3); ctx.fillRect(x + 1, y - 54, 2, 3);
    c.ax = x; c.ay = y; return c;
  },
  exitlight() {
    const c = makeCanvas(100, 170), ctx = c.getContext('2d'), x = 50, y = 150;
    const g = ctx.createLinearGradient(0, 0, 0, y); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(1, 'rgba(255,236,190,.22)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 12, 0); ctx.lineTo(x + 12, 0); ctx.lineTo(x + 34, y); ctx.lineTo(x - 34, y); ctx.fill();
    ctx.strokeStyle = '#5a4026'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x - 4, y - 90); ctx.moveTo(x + 8, y); ctx.lineTo(x + 4, y - 90); for (let k = 1; k < 9; k++) { ctx.moveTo(x - 8 + k * .45, y - k * 10); ctx.lineTo(x + 8 - k * .45, y - k * 10); } ctx.stroke();
    c.ax = x; c.ay = y; return c;
  },
  stalag(v) {
    const c = makeCanvas(60, 80), ctx = c.getContext('2d'), R = mulberry(2600 + v), x = 30, y = 68;
    shadowBlob(ctx, x + 6, y, 20, 6, .5);
    const h = 40 + R() * 22, g = ctx.createLinearGradient(x - 14, 0, x + 14, 0); g.addColorStop(0, '#7a6e60'); g.addColorStop(.4, '#5a5046'); g.addColorStop(1, '#241e1a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 15, y); ctx.quadraticCurveTo(x - 8, y - h * .5, x - 1, y - h); ctx.lineTo(x + 2, y - h + 3); ctx.quadraticCurveTo(x + 9, y - h * .45, x + 15, y); ctx.quadraticCurveTo(x, y + 5, x - 15, y); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); for (let k = 0; k < 4; k++) { const yy = y - R() * h * .8; ctx.moveTo(x - 10 + R() * 6, yy); ctx.lineTo(x + R() * 8, yy - 6); } ctx.stroke();
    c.ax = x; c.ay = y; return c;
  },
  sign() {
    const c = makeCanvas(60, 70), ctx = c.getContext('2d'), x = 30, y = 60;
    shadowBlob(ctx, x + 4, y, 12, 4);
    ctx.fillStyle = '#4a3420'; ctx.fillRect(x - 2, y - 44, 4, 44);
    ctx.fillStyle = '#6e5232'; ctx.beginPath(); ctx.moveTo(x - 22, y - 46); ctx.lineTo(x + 18, y - 52); ctx.lineTo(x + 24, y - 44); ctx.lineTo(x + 18, y - 36); ctx.lineTo(x - 22, y - 32); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,10,.7)'; ctx.beginPath(); ctx.moveTo(x - 16, y - 42); ctx.lineTo(x + 12, y - 46); ctx.moveTo(x - 16, y - 38); ctx.lineTo(x + 8, y - 41); ctx.stroke();
    c.ax = x; c.ay = y; return c;
  },
};
// iso box helper for props: local tile coords, z in px
function box(ctx, x, y, x0, y0, x1, y1, z0, z1, hex) {
  const p = (lx, ly, z) => [x + isoX(lx, ly), y + isoY(lx, ly) - z];
  const q = (pts, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) ctx.lineTo(...pts[i]); ctx.closePath(); ctx.fill(); };
  q([p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)], col(hex, .95));
  q([p(x1, y1, z0), p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1)], col(hex, .62));
  q([p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)], col(hex, 1.25));
}
const PROP_SPR = {};
function propSprite(t, v) { const k = t + v; return PROP_SPR[k] || (PROP_SPR[k] = PROP_MAKERS[t](v)); }

/* ---------- Flames (animated, additive) ---------- */
function drawFlame(ctx, x, y, size, t, seed = 0) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 7; k++) {
    const ph = t * (7 + k) + seed * 3.1 + k * 1.7, h = size * (1.1 + .35 * Math.sin(ph)), ox = Math.sin(ph * .7 + k) * size * .18 + (k - 3) * size * .09;
    const g = ctx.createRadialGradient(x + ox, y - h * .35, 0, x + ox, y - h * .35, h * .55);
    g.addColorStop(0, k < 2 ? 'rgba(255,240,180,.55)' : 'rgba(255,160,60,.4)'); g.addColorStop(.5, 'rgba(230,80,20,.22)'); g.addColorStop(1, 'rgba(120,20,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x + ox, y - h * .35, h * .28, h * .55, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* ---------- Character rig ---------- */
// Local rig space: x = right, y = forward, z = up (pixels). Project after rotating to face `ang`.
const RIGS = {
  sorc: { H: 66, skin: '#d9b08c', hair: '#2a1a12', top: '#7b2e3e', leg: '#6b5440', skirt: '#5a2a36', boot: '#3a2a1e', build: 1.08, female: true },
  zombie: { H: 62, skin: '#7f8a66', hair: '#3a3a2a', top: '#5a5a44', leg: '#6f7a5a', skirt: '#4a3a2a', boot: '#5a6248', build: 1.15, hunch: .35, armsOut: 1 },
  fallen: { H: 40, skin: '#b0402c', hair: '#2a1410', top: '#a0382a', leg: '#8c3022', skirt: '#4a2a1a', boot: '#5a1e14', build: 1.05, hunch: .25, horns: 1, head: 1.25 },
  shaman: { H: 42, skin: '#c0583a', hair: '#e0d8c0', top: '#b0482e', leg: '#9a3c26', skirt: '#6a3a1e', boot: '#5a1e14', build: 1.05, hunch: .3, horns: 1, head: 1.25, mask: 1 },
  brute: { H: 74, skin: '#8f8574', hair: '#6a6050', top: '#8f8574', leg: '#7a7060', skirt: '#7a7060', boot: '#4a4236', build: 1.7, hunch: .45, armsOut: .3, longArms: 1.35, fur: 1 },
  akara: { H: 64, skin: '#c9a084', hair: '#d8d0c0', top: '#5a2f78', leg: '#4a2766', skirt: '#4a2766', boot: '#2a1a2a', build: 1, female: true, hood: 1, robe: 1 },
  charsi: { H: 64, skin: '#d4a684', hair: '#3a2214', top: '#6a4a30', leg: '#4a3626', skirt: '#4a3626', boot: '#2a1e14', build: 1.25, female: true, apron: 1 },
  kashya: { H: 66, skin: '#d4a684', hair: '#7a2a1a', top: '#7a2a24', leg: '#4a3020', skirt: '#5a2420', boot: '#2a1a12', build: 1.05, female: true, bow: 1 },
};
const SHADE_LIGHT = [-.55, -.45];
function capsule(ctx, a, b, w1, w2, base, k, tint) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || .001, nx = -dy / L, ny = dx / L;
  ctx.fillStyle = col(base, .55 * k, tint);
  ctx.beginPath(); ctx.moveTo(a[0] + nx * w1, a[1] + ny * w1); ctx.lineTo(b[0] + nx * w2, b[1] + ny * w2); ctx.arc(b[0], b[1], w2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true); ctx.lineTo(a[0] - nx * w1, a[1] - ny * w1); ctx.arc(a[0], a[1], w1, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true); ctx.fill();
  const ox = SHADE_LIGHT[0] * w1 * .45, oy = SHADE_LIGHT[1] * w1 * .45;
  ctx.fillStyle = col(base, 1.05 * k, tint);
  ctx.beginPath(); ctx.moveTo(a[0] + ox, a[1] + oy); ctx.lineTo(b[0] + ox, b[1] + oy); ctx.lineWidth = Math.max(1, (w1 + w2) * .9); ctx.strokeStyle = ctx.fillStyle; ctx.lineCap = 'round'; ctx.stroke();
}
function ball(ctx, p, r, base, k, tint) {
  ctx.fillStyle = col(base, .5 * k, tint); ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
  ctx.fillStyle = col(base, 1.05 * k, tint); ctx.beginPath(); ctx.arc(p[0] - r * .22, p[1] - r * .25, r * .74, 0, TAU); ctx.fill();
  ctx.fillStyle = col(base, 1.35 * k, tint); ctx.beginPath(); ctx.arc(p[0] - r * .38, p[1] - r * .42, r * .3, 0, TAU); ctx.fill();
}
function poly(ctx, pts, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fill(); }

// Pose from entity state. Returns joint angles.
function poseFor(e, t) {
  const p = { bob: 0, lean: 0, legL: 0, legR: 0, kneeL: .1, kneeR: .1, armL: .1, armR: .15, spreadL: .25, spreadR: .25, elbL: .3, elbR: .3, fall: 0, weapon: 0 };
  const rig = e.rig, hunch = rig.hunch || 0;
  p.lean = hunch;
  if (e.dead) { p.fall = Math.min(1, e.deadT * 2.2); p.armL = p.armR = -.25; p.elbL = p.elbR = .1; p.spreadL = p.spreadR = .9; p.legL = .12; p.legR = -.12; p.kneeL = p.kneeR = 0; p.lean = 0; return p; }
  const st = e.anim || 'idle';
  if (st === 'walk' || st === 'run') {
    const ph = e.walkPh, s = Math.sin(ph), amp = st === 'run' ? .6 : .48;
    p.legL = s * amp; p.legR = -s * amp; p.kneeL = .12 + Math.max(0, -Math.cos(ph)) * .65; p.kneeR = .12 + Math.max(0, Math.cos(ph)) * .65;
    p.armL = -s * .5; p.armR = s * .5; p.bob = Math.abs(Math.cos(ph)) * 2.2; p.lean += st === 'run' ? .18 : .06;
  } else {
    p.bob = Math.sin(t * 2.2 + (e.seed || 0)) * .6;
  }
  if (rig.armsOut) { p.armL = 1.25 + p.armL * .2; p.armR = 1.25 + p.armR * .2; p.elbL = p.elbR = .15; p.spreadL = p.spreadR = .1; }
  if (st === 'cast') {
    const c = e.animT, raise = c < .5 ? c / .5 : 1 - (c - .5) * .6;
    p.armR = lerp(p.armR, 1.45, raise); p.armL = lerp(p.armL, 1.25, raise); p.elbR = p.elbL = .1; p.spreadL = .35; p.spreadR = .15; p.lean += .08 * raise;
  } else if (st === 'attack') {
    const c = e.animT;
    if (c < .45) { const k = c / .45; p.armR = lerp(.2, 2.8, k); p.elbR = lerp(.3, .9, k); p.lean -= .1 * k; }
    else { const k = Math.min(1, (c - .45) / .3); p.armR = lerp(2.8, -.1, k); p.elbR = lerp(.9, .1, k); p.lean += .25 * k; }
    if (rig.armsOut) { p.armL = p.armR; p.elbL = p.elbR; }
    p.weapon = 1;
  } else if (st === 'hit') { p.lean -= .35; p.armL = p.armR = -.2; p.spreadL = p.spreadR = .6; }
  return p;
}

function drawHumanoid(ctx, e, sx, sy, ang, t, tint) {
  const R = e.rig, H = R.H * (e.scale || 1), B = R.build, pose = poseFor(e, t);
  const fx = Math.cos(ang), fy = Math.sin(ang), rx = -Math.sin(ang), ry = Math.cos(ang);
  const fall = pose.fall, fa = fall * 1.45, cf = Math.cos(fa), sf = Math.sin(fa);
  const pts = [];
  // local -> screen; `fall` rotates the body backwards about the feet
  const P = (x, y, z) => {
    if (fall) { const y2 = y * cf - z * sf, z2 = y * sf + z * cf; y = y2; z = Math.max(z2, 1.5); }
    const wx = (y * fx + x * rx) / 36, wy = (y * fy + x * ry) / 36;
    return [sx + (wx - wy) * 32, sy + (wx + wy) * 16 - z, wx + wy];
  };
  const hipZ = H * .48 + pose.bob, thigh = H * .25, shin = H * .245, torso = H * .29 * (R.hunch ? .95 : 1), hipW = H * .075 * B, shW = H * .13 * B;
  const lean = pose.lean;
  const hipC = [0, 0, hipZ], chest = [0, Math.sin(lean) * torso, hipZ + Math.cos(lean) * torso];
  const leg = (side, a, kn) => { const hip = [side * hipW, 0, hipZ - 2], knee = [hip[0], hip[1] + Math.sin(a) * thigh, hip[2] - Math.cos(a) * thigh], b = a - kn, foot = [hip[0], knee[1] + Math.sin(b) * shin, Math.max(1, knee[2] - Math.cos(b) * shin)]; return [hip, knee, foot]; };
  const LL = leg(-1, pose.legL, pose.kneeL), LR = leg(1, pose.legR, pose.kneeR);
  const armLen = H * .19 * (R.longArms || 1), fore = H * .18 * (R.longArms || 1);
  const arm = (side, a, sp, el) => { const sh = [side * shW, chest[1] - Math.sin(lean) * 3, chest[2] - 3], elb = [sh[0] + side * Math.sin(sp) * armLen * .6, sh[1] + Math.sin(a) * armLen, sh[2] - Math.cos(a) * armLen], b = a + el, hand = [elb[0] + side * Math.sin(sp) * fore * .3, elb[1] + Math.sin(b) * fore, elb[2] - Math.cos(b) * fore]; return [sh, elb, hand]; };
  const AL = arm(-1, pose.armL, pose.spreadL, pose.elbL), AR = arm(1, pose.armR, pose.spreadR, pose.elbR);
  const headR = H * .085 * (R.head || 1), neck = [0, chest[1] + Math.sin(lean) * 4, chest[2] + 3], head = [0, chest[1] + Math.sin(lean) * (headR + 4), chest[2] + headR + 4];
  const k = 1, add = (d, fn) => pts.push([d, fn]);
  const proj = j => P(j[0], j[1], j[2]);
  const [lh, lk, lf] = LL.map(proj), [rh, rk, rf] = LR.map(proj), [ls, le, lw] = AL.map(proj), [rs, re, rw] = AR.map(proj);
  const hp = proj(hipC), cp = proj(chest), hd = proj(head), nk = proj(neck);
  const lw2 = H * .05 * B, aw = H * .038 * B;
  // legs
  add((lh[2] + lf[2]) / 2, () => { capsule(ctx, lh, lk, lw2, lw2 * .85, R.leg, k, tint); capsule(ctx, lk, lf, lw2 * .85, lw2 * .7, R.boot, k, tint); });
  add((rh[2] + rf[2]) / 2, () => { capsule(ctx, rh, rk, lw2, lw2 * .85, R.leg, k, tint); capsule(ctx, rk, rf, lw2 * .85, lw2 * .7, R.boot, k, tint); });
  // torso + skirt/robe
  add(hp[2] + .001, () => {
    if (R.female || R.robe || R.skirt) {
      const len = R.robe ? .95 : R.female ? .7 : .35, sw = H * (R.robe ? .17 : .13) * B;
      const a = P(-hipW * 1.2, 0, hipZ + 2), b = P(hipW * 1.2, 0, hipZ + 2), sway = Math.sin(e.walkPh || 0) * 3;
      const c = P(sw, sway, Math.max(2, hipZ * (1 - len))), d = P(-sw, -sway, Math.max(2, hipZ * (1 - len)));
      poly(ctx, [a, b, c, d], col(R.skirt, .62, tint));
      poly(ctx, [a, [lerp(a[0], b[0], .5), a[1]], [lerp(d[0], c[0], .45), lerp(d[1], c[1], .45)], d], col(R.skirt, .95, tint));
    }
    capsule(ctx, hp, cp, H * .085 * B, H * .1 * B, R.top, k, tint);
    if (R.fur) { ctx.strokeStyle = col(R.hair, .8, tint); ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 9; i++) { const q = [lerp(hp[0], cp[0], i / 8), lerp(hp[1], cp[1], i / 8)]; ctx.moveTo(q[0] - 6, q[1]); ctx.lineTo(q[0] - 9, q[1] + 3); ctx.moveTo(q[0] + 6, q[1]); ctx.lineTo(q[0] + 9, q[1] + 3); } ctx.stroke(); }
    if (R.apron) { ctx.fillStyle = col('#8a7a5a', .8, tint); ctx.fillRect(cp[0] - 5, cp[1] + 2, 10, hp[1] - cp[1] + 6); }
    if (e.armorTint && !R.robe) { ctx.globalAlpha = .7; capsule(ctx, [lerp(hp[0], cp[0], .2), lerp(hp[1], cp[1], .2)], cp, H * .08 * B, H * .095 * B, e.armorTint, k, tint); ctx.globalAlpha = 1; }
  });
  // arms
  const armDraw = (s, el, w, isR) => () => {
    capsule(ctx, s, el, aw, aw * .85, R.female && !R.robe ? R.skin : R.top, k, tint); capsule(ctx, el, w, aw * .85, aw * .7, R.skin, k, tint);
    if (isR) drawHeld(ctx, e, w, el, P, AR[2], t, tint, H);
    else if (e.shield) drawShield(ctx, e, w, tint);
    else if (R.bow) { ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w[0] - 2, w[1], 16, -1.3, 1.3); ctx.stroke(); }
  };
  add((ls[2] + lw[2]) / 2 + .002, armDraw(ls, le, lw, false));
  add((rs[2] + rw[2]) / 2 + .002, armDraw(rs, re, rw, true));
  // head
  add(cp[2] + .003, () => {
    capsule(ctx, nk, hd, aw * .9, aw * .9, R.skin, k, tint);
    ball(ctx, hd, headR, R.skin, k, tint);
    const facing = Math.cos(ang) + Math.sin(ang); // >0 toward camera
    const side = Math.cos(ang) - Math.sin(ang);    // screen-x direction
    if (R.hood) { ctx.fillStyle = col(R.top, .7, tint); ctx.beginPath(); ctx.arc(hd[0], hd[1] - 1, headR * 1.25, Math.PI * .9, Math.PI * 2.1); ctx.lineTo(hd[0] + headR * 1.2, hd[1] + headR * 1.4); ctx.lineTo(hd[0] - headR * 1.2, hd[1] + headR * 1.4); ctx.fill(); }
    else if (e.helm) drawHelm(ctx, e.helm, hd, headR, tint);
    else if (!R.horns) {
      ctx.fillStyle = col(R.hair, 1, tint); ctx.beginPath(); ctx.arc(hd[0], hd[1] - headR * .25, headR * 1.02, Math.PI * (facing > 0 ? 1.05 : .8), Math.PI * (facing > 0 ? 1.95 : 2.2)); ctx.fill();
      if (R.female) { ctx.beginPath(); ctx.ellipse(hd[0] - side * headR * .6, hd[1] + headR * .6, headR * .45, headR * 1.1, 0, 0, TAU); ctx.fill(); }
    }
    if (R.horns) {
      ctx.strokeStyle = col('#d8ccb0', .9, tint); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hd[0] - headR * .6, hd[1] - headR * .6); ctx.quadraticCurveTo(hd[0] - headR * 1.4, hd[1] - headR * 1.4, hd[0] - headR * .9, hd[1] - headR * 2); ctx.moveTo(hd[0] + headR * .6, hd[1] - headR * .6); ctx.quadraticCurveTo(hd[0] + headR * 1.4, hd[1] - headR * 1.4, hd[0] + headR * .9, hd[1] - headR * 2); ctx.stroke();
      if (R.mask) { ctx.fillStyle = col('#e8dcc0', 1, tint); ctx.beginPath(); ctx.ellipse(hd[0] + side * 2, hd[1] + 1, headR * .7, headR * .85, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a0a06'; ctx.fillRect(hd[0] + side * 2 - 3, hd[1] - 1, 2, 2); ctx.fillRect(hd[0] + side * 2 + 1, hd[1] - 1, 2, 2); for (let i = -2; i <= 2; i++) { ctx.strokeStyle = i % 2 ? '#c8a040' : '#3a6a8a'; ctx.beginPath(); ctx.moveTo(hd[0] + i * 2.5, hd[1] - headR * .9); ctx.lineTo(hd[0] + i * 3.5, hd[1] - headR * 2.1); ctx.stroke(); } }
    }
    if (facing > -.3 && !R.mask && !(e.helm && e.helm.full)) {
      const ex = hd[0] + side * headR * .35, ey = hd[1] - headR * .05;
      ctx.fillStyle = R.horns || e.type === 'zombie' ? (e.type === 'zombie' ? '#d8e070' : '#ffd040') : '#1a1010';
      ctx.fillRect(ex - headR * .38, ey, Math.max(1, headR * .22), Math.max(1, headR * .2)); ctx.fillRect(ex + headR * .16, ey, Math.max(1, headR * .22), Math.max(1, headR * .2));
    }
  });
  pts.sort((a, b) => a[0] - b[0]);
  for (const p of pts) p[1]();
  return [hd[0], hd[1] - headR - 6];
}
function drawHeld(ctx, e, w, el, P, handLocal, t, tint, H) {
  const wp = e.weapon; if (!wp) return;
  const dx = w[0] - el[0], dy = w[1] - el[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  if (wp === 'claw') return;
  if (wp === 'staff' || wp === 'gstaff' || wp === 'bstaff' || wp === 'skullstaff') {
    const atk = e.anim === 'attack', topX = atk ? w[0] + ux * H * .6 : w[0] + ux * 3, topY = atk ? w[1] + uy * H * .6 : w[1] - H * .55, botX = atk ? w[0] - ux * H * .25 : w[0] - ux * 1, botY = atk ? w[1] - uy * H * .25 : w[1] + H * .28;
    ctx.strokeStyle = col(wp === 'bstaff' ? '#4a4a4e' : '#5a3a20', .9, tint); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(botX, botY); ctx.lineTo(topX, topY); ctx.stroke();
    ctx.strokeStyle = col('#8a6a44', 1, tint); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(botX - .8, botY); ctx.lineTo(topX - .8, topY); ctx.stroke();
    if (wp === 'skullstaff') { ctx.fillStyle = '#ddd2b4'; ctx.beginPath(); ctx.arc(topX, topY - 2, 3.5, 0, TAU); ctx.fill(); }
    else if (wp === 'gstaff') { ctx.strokeStyle = col('#5a3a20', 1, tint); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(topX, topY - 3, 4, 0, TAU); ctx.stroke(); }
    else { const glow = e.anim === 'cast' ? 1 : .35; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(topX, topY - 2, 0, topX, topY - 2, 9); g.addColorStop(0, `rgba(${e.castCol || '180,200,255'},${.7 * glow})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(topX - 10, topY - 12, 20, 20); ctx.restore(); ctx.fillStyle = '#7a8aa8'; ctx.beginPath(); ctx.arc(topX, topY - 2, 2.2, 0, TAU); ctx.fill(); }
  } else if (wp === 'wand' || wp === 'bwand' || wp === 'orb' || wp === 'dagger') {
    const len = wp === 'dagger' ? 11 : 13, ex = w[0] + ux * len, ey = w[1] + uy * len;
    if (wp === 'orb') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(w[0], w[1] - 5, 0, w[0], w[1] - 5, 10); g.addColorStop(0, 'rgba(140,180,255,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(w[0] - 10, w[1] - 15, 20, 20); ctx.restore(); ctx.fillStyle = '#9ab8e8'; ctx.beginPath(); ctx.arc(w[0], w[1] - 5, 3.6, 0, TAU); ctx.fill(); return; }
    ctx.strokeStyle = wp === 'dagger' ? '#c0c4c8' : wp === 'bwand' ? '#ddd2b4' : '#6a4a2a'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(w[0], w[1]); ctx.lineTo(ex, ey); ctx.stroke();
  } else {
    // blades, clubs, axes
    const len = wp === 'club' ? 15 : 17, ex = w[0] + ux * len, ey = w[1] + uy * len;
    ctx.strokeStyle = col(wp === 'club' ? '#5a3a20' : '#b8bcc0', 1, tint); ctx.lineWidth = wp === 'club' ? 3.5 : 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(w[0] - ux * 3, w[1] - uy * 3); ctx.lineTo(ex, ey); ctx.stroke();
    if (wp === 'axe') { ctx.fillStyle = '#a0a4a8'; ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, TAU); ctx.fill(); }
    if (wp === 'sword') { ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w[0] - uy * 4, w[1] + ux * 4); ctx.lineTo(w[0] + uy * 4, w[1] - ux * 4); ctx.stroke(); }
  }
}
function drawShield(ctx, e, w, tint) {
  const s = e.shield; ctx.fillStyle = col(s.tint, .7, tint); ctx.strokeStyle = col('#2a2018', 1, tint); ctx.lineWidth = 1.2;
  ctx.beginPath(); if (s.icon === 'kite') { ctx.moveTo(w[0] - 7, w[1] - 9); ctx.lineTo(w[0] + 7, w[1] - 9); ctx.lineTo(w[0] + 6, w[1] + 3); ctx.lineTo(w[0], w[1] + 12); ctx.lineTo(w[0] - 6, w[1] + 3); ctx.closePath(); } else ctx.ellipse(w[0], w[1], s.icon === 'buckler' ? 6 : 8, s.icon === 'buckler' ? 7 : 10, 0, 0, TAU);
  ctx.fill(); ctx.stroke(); ctx.fillStyle = col(s.tint, 1.2, tint); ctx.beginPath(); ctx.arc(w[0] - 1, w[1] - 1, 2, 0, TAU); ctx.fill();
}
function drawHelm(ctx, h, hd, r, tint) {
  ctx.fillStyle = col(h.tint, .9, tint);
  if (h.icon === 'cap') { ctx.beginPath(); ctx.arc(hd[0], hd[1] - r * .2, r * 1.05, Math.PI, 0); ctx.fill(); }
  else if (h.icon === 'crown') { ctx.beginPath(); ctx.moveTo(hd[0] - r, hd[1] - r * .4); for (let i = 0; i <= 4; i++) { ctx.lineTo(hd[0] - r + i * r * .5, hd[1] - r * (i % 2 ? 1 : 1.6)); } ctx.lineTo(hd[0] + r, hd[1] - r * .4); ctx.fill(); }
  else if (h.icon === 'mask') { ctx.beginPath(); ctx.ellipse(hd[0], hd[1], r * .9, r * 1.05, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#100808'; ctx.fillRect(hd[0] - r * .5, hd[1] - r * .2, r * .3, r * .25); ctx.fillRect(hd[0] + r * .2, hd[1] - r * .2, r * .3, r * .25); }
  else { ctx.beginPath(); ctx.arc(hd[0], hd[1] - r * .1, r * 1.12, Math.PI * .95, Math.PI * 2.05); ctx.lineTo(hd[0] + r * 1.1, hd[1] + r * (h.icon === 'fullhelm' ? .9 : .3)); ctx.lineTo(hd[0] - r * 1.1, hd[1] + r * (h.icon === 'fullhelm' ? .9 : .3)); ctx.fill(); ctx.fillStyle = col(h.tint, 1.35, tint); ctx.fillRect(hd[0] - r * .15, hd[1] - r * 1.1, r * .3, r * 1.3); }
}

function drawRat(ctx, e, sx, sy, ang, t, tint) {
  const fx = Math.cos(ang), fy = Math.sin(ang), rx = -fy, ry = fx, S = e.scale || 1;
  const fall = e.dead ? Math.min(1, e.deadT * 2.5) : 0;
  const P = (x, y, z) => { const wx = (y * fx + x * rx) / 36, wy = (y * fy + x * ry) / 36; return [sx + (wx - wy) * 32, sy + (wx + wy) * 16 - z * (1 - fall * .7), wx + wy]; };
  const ph = e.walkPh || 0, step = (e.anim === 'walk' || e.anim === 'run') ? 1 : 0;
  const bz = 9 * S + (step ? Math.abs(Math.sin(ph)) * 1.5 : 0);
  const tail = P(0, -16 * S, 5 * S), rump = P(0, -8 * S, bz), mid = P(0, 0, bz + 1), headP = P(0, 10 * S, bz - 1), nose = P(0, 16 * S, bz - 3);
  for (const [lx, ly, ph2] of [[-5, 6, 0], [5, 6, Math.PI], [-5, -6, Math.PI], [5, -6, 0]]) { const a = P(lx * S, ly * S, bz - 3), f = P(lx * S, (ly + (step ? Math.sin(ph + ph2) * 4 : 0)) * S, 0); capsule(ctx, a, f, 1.6 * S, 1.2 * S, '#4a3a2a', 1, tint); }
  ctx.strokeStyle = col('#8a6a5a', 1, tint); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(rump[0], rump[1]); ctx.quadraticCurveTo(tail[0], tail[1] - 4, tail[0] + Math.sin(t * 6) * 3, tail[1] + 2); ctx.stroke();
  capsule(ctx, rump, headP, 8 * S, 6 * S, MONSTERS.quillrat.color, 1, tint);
  capsule(ctx, headP, nose, 4.5 * S, 2 * S, '#7a6250', 1, tint);
  // quills
  ctx.strokeStyle = col('#d8ccb0', .95, tint); ctx.lineWidth = 1.2; ctx.beginPath();
  for (let i = 0; i < 14; i++) { const q = i / 13, b = P((((i * 7) % 5) - 2) * 2 * S, lerp(-7, 7, q) * S, bz + 6 * S), tip = P((((i * 7) % 5) - 2) * 3.4 * S, (lerp(-7, 7, q) - 9) * S, bz + 15 * S); ctx.moveTo(b[0], b[1]); ctx.lineTo(tip[0], tip[1]); }
  ctx.stroke();
  const eyeP = P(0, 13 * S, bz); ctx.fillStyle = '#ff5030'; ctx.fillRect(eyeP[0] - 2, eyeP[1] - 2, 1.6, 1.6); ctx.fillRect(eyeP[0] + 1, eyeP[1] - 2, 1.6, 1.6);
  void mid;
  return [sx, sy - 34 * S];
}

/* ---------- Item icons (inventory art) ---------- */
const ICON_S = 40; // art units per inventory cell (drawn at 2x, then shrunk to ICON_PX real pixels)
const ICON_PX = 28;
const ICON_CACHE = {};
function itemIcon(it) {
  const b = BASES[it.base], key = it.base + (it.rarity === 'unique' ? 'u' : '');
  if (ICON_CACHE[key]) return ICON_CACHE[key];
  const S = ICON_S * 2, w = b.w * S, h = b.h * S, c = makeCanvas(b.w * ICON_PX, b.h * ICON_PX), ctx = c.getContext('2d'), tn = b.tint, cx = w / 2, cy = h / 2;
  ctx.scale(ICON_PX / S, ICON_PX / S);
  const R = mulberry(key.length * 97 + w + h);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const metal = (x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, col(tn, 1.5)); g.addColorStop(.45, col(tn, 1)); g.addColorStop(1, col(tn, .45)); return g; };
  const outline = () => { ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 3; ctx.stroke(); };
  switch (b.icon) {
    case 'staff': case 'gstaff': case 'bstaff': {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(.18);
      ctx.beginPath(); ctx.moveTo(-5, h * .45); ctx.quadraticCurveTo(3, 0, -2, -h * .42); ctx.lineTo(6, -h * .42); ctx.quadraticCurveTo(10, 0, 5, h * .45); ctx.closePath(); ctx.fillStyle = metal(-8, 0, 8, 0); ctx.fill(); outline();
      if (b.icon === 'gstaff') { ctx.beginPath(); ctx.arc(2, -h * .42, 15, 0, TAU); ctx.lineWidth = 7; ctx.strokeStyle = col(tn, .9); ctx.stroke(); }
      if (b.icon === 'bstaff') { ctx.fillStyle = '#9aa0a8'; ctx.fillRect(-8, -h * .44, 18, 14); ctx.fillRect(-8, h * .1, 18, 8); }
      ctx.fillStyle = col(tn, .6); for (let k = 0; k < 4; k++) ctx.fillRect(-4, -h * .3 + k * h * .18, 12, 3);
      ctx.restore(); break;
    }
    case 'wand': case 'bwand': {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(.5);
      ctx.beginPath(); ctx.moveTo(-4, h * .42); ctx.lineTo(-6, -h * .3); ctx.lineTo(0, -h * .44); ctx.lineTo(6, -h * .3); ctx.lineTo(4, h * .42); ctx.closePath(); ctx.fillStyle = metal(-6, 0, 6, 0); ctx.fill(); outline();
      if (b.icon === 'bwand') { ctx.fillStyle = '#efe6cc'; ctx.beginPath(); ctx.arc(0, -h * .38, 10, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a1410'; ctx.fillRect(-5, -h * .4, 3, 3); ctx.fillRect(2, -h * .4, 3, 3); }
      else { ctx.fillStyle = '#5ac8ff'; ctx.beginPath(); ctx.arc(0, -h * .4, 5, 0, TAU); ctx.fill(); }
      ctx.restore(); break;
    }
    case 'orb': {
      ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.moveTo(cx - 8, h * .92); ctx.lineTo(cx - 12, h * .5); ctx.lineTo(cx + 12, h * .5); ctx.lineTo(cx + 8, h * .92); ctx.fill(); outline();
      const g = ctx.createRadialGradient(cx - 10, h * .3, 2, cx, h * .36, w * .42); g.addColorStop(0, '#ffffff'); g.addColorStop(.25, col(tn, 1.6)); g.addColorStop(1, col(tn, .4));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, h * .34, w * .38, 0, TAU); ctx.fill(); outline();
      ctx.strokeStyle = '#c9a44a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, h * .34, w * .38, .3, Math.PI - .3); ctx.stroke(); break;
    }
    case 'sword': case 'dagger': {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(.15);
      const L = h * .42;
      ctx.beginPath(); ctx.moveTo(-6, L * .5); ctx.lineTo(-6, -L * .85); ctx.lineTo(0, -L); ctx.lineTo(6, -L * .85); ctx.lineTo(6, L * .5); ctx.closePath(); ctx.fillStyle = metal(-6, 0, 6, 0); ctx.fill(); outline();
      ctx.fillStyle = '#7a5a2a'; ctx.fillRect(-16, L * .5, 32, 6); ctx.fillStyle = '#4a3020'; ctx.fillRect(-4, L * .55, 8, L * .42); ctx.fillStyle = '#c9a44a'; ctx.beginPath(); ctx.arc(0, L * .98, 5, 0, TAU); ctx.fill();
      ctx.restore(); break;
    }
    case 'club': case 'axe': {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(.2);
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(-4, -h * .3, 8, h * .75); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 2; ctx.strokeRect(-4, -h * .3, 8, h * .75);
      if (b.icon === 'axe') { ctx.beginPath(); ctx.moveTo(2, -h * .36); ctx.quadraticCurveTo(30, -h * .3, 26, -h * .12); ctx.lineTo(2, -h * .18); ctx.closePath(); ctx.fillStyle = metal(0, -h * .3, 26, -h * .1); ctx.fill(); outline(); }
      else { ctx.beginPath(); ctx.ellipse(0, -h * .32, 13, 22, 0, 0, TAU); ctx.fillStyle = metal(-13, -h * .4, 13, -h * .2); ctx.fill(); outline(); ctx.fillStyle = '#9a9ea2'; for (let k = 0; k < 5; k++) ctx.fillRect(-12 + R() * 22, -h * .45 + R() * 30, 4, 4); }
      ctx.restore(); break;
    }
    case 'buckler': case 'shield': case 'kite': {
      ctx.beginPath();
      if (b.icon === 'kite') { ctx.moveTo(w * .12, h * .1); ctx.lineTo(w * .88, h * .1); ctx.lineTo(w * .84, h * .55); ctx.lineTo(cx, h * .94); ctx.lineTo(w * .16, h * .55); ctx.closePath(); }
      else ctx.ellipse(cx, cy, w * .42, h * .44, 0, 0, TAU);
      ctx.fillStyle = metal(0, 0, w, h); ctx.fill(); outline();
      ctx.strokeStyle = 'rgba(255,240,210,.3)'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#b8a060'; ctx.beginPath(); ctx.arc(cx, cy * (b.icon === 'kite' ? .8 : 1), w * .1, 0, TAU); ctx.fill(); outline();
      if (b.icon === 'shield') { ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, h * .1); ctx.lineTo(cx, h * .9); ctx.moveTo(w * .1, cy); ctx.lineTo(w * .9, cy); ctx.stroke(); }
      break;
    }
    case 'cap': case 'skullcap': case 'helm': case 'fullhelm': {
      ctx.beginPath(); ctx.moveTo(w * .14, h * .72); ctx.quadraticCurveTo(w * .1, h * .12, cx, h * .12); ctx.quadraticCurveTo(w * .9, h * .12, w * .86, h * .72);
      if (b.icon === 'fullhelm') { ctx.lineTo(w * .78, h * .92); ctx.lineTo(w * .22, h * .92); }
      ctx.closePath(); ctx.fillStyle = metal(0, 0, w, h); ctx.fill(); outline();
      if (b.icon === 'cap') { ctx.fillStyle = col(tn, .6); ctx.fillRect(w * .12, h * .64, w * .76, h * .1); }
      else { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(w * .26, h * .46, w * .48, h * .08); ctx.fillStyle = col(tn, 1.4); ctx.fillRect(cx - 4, h * .12, 8, h * .38); }
      if (b.icon === 'fullhelm') { ctx.fillStyle = '#000'; ctx.fillRect(cx - 3, h * .55, 6, h * .3); }
      break;
    }
    case 'mask': {
      ctx.beginPath(); ctx.ellipse(cx, cy, w * .34, h * .42, 0, 0, TAU); ctx.fillStyle = metal(0, 0, w, h); ctx.fill(); outline();
      ctx.fillStyle = '#100a06'; ctx.beginPath(); ctx.ellipse(cx - w * .13, cy - 6, 8, 6, 0, 0, TAU); ctx.ellipse(cx + w * .13, cy - 6, 8, 6, 0, 0, TAU); ctx.fill(); ctx.fillRect(cx - 10, cy + 18, 20, 5); break;
    }
    case 'crown': {
      ctx.beginPath(); ctx.moveTo(w * .12, h * .76); ctx.lineTo(w * .12, h * .3); ctx.lineTo(w * .3, h * .5); ctx.lineTo(cx, h * .18); ctx.lineTo(w * .7, h * .5); ctx.lineTo(w * .88, h * .3); ctx.lineTo(w * .88, h * .76); ctx.closePath();
      ctx.fillStyle = metal(0, 0, w, h); ctx.fill(); outline(); ctx.fillStyle = '#d02020'; ctx.beginPath(); ctx.arc(cx, h * .6, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#2050d0'; ctx.beginPath(); ctx.arc(w * .28, h * .64, 5, 0, TAU); ctx.arc(w * .72, h * .64, 5, 0, TAU); ctx.fill(); break;
    }
    case 'robe': case 'armor': case 'mail': case 'plate': {
      ctx.beginPath(); ctx.moveTo(w * .3, h * .06); ctx.lineTo(w * .1, h * .14); ctx.lineTo(w * .04, h * .42); ctx.lineTo(w * .2, h * .44); ctx.lineTo(w * .22, h * .94); ctx.lineTo(w * .78, h * .94); ctx.lineTo(w * .8, h * .44); ctx.lineTo(w * .96, h * .42); ctx.lineTo(w * .9, h * .14); ctx.lineTo(w * .7, h * .06); ctx.quadraticCurveTo(cx, h * .16, w * .3, h * .06); ctx.closePath();
      ctx.fillStyle = metal(0, 0, w, h * .6); ctx.fill(); outline();
      ctx.save(); ctx.clip();
      if (b.icon === 'mail') { ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5; for (let y = 0; y < h; y += 6) for (let x = (y / 6) % 2 * 3; x < w; x += 6) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.stroke(); } }
      else if (b.icon === 'plate') { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(w * .3, h * .15, w * .12, h * .7); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 3; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(w * .2, h * (.4 + k * .13)); ctx.lineTo(w * .8, h * (.4 + k * .13)); ctx.stroke(); } }
      else if (b.icon === 'robe') { ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3; for (let k = 0; k < 10; k++) { ctx.beginPath(); ctx.moveTo(0, k * h * .1); ctx.lineTo(w, k * h * .1 + 10); ctx.stroke(); } }
      else { ctx.fillStyle = 'rgba(200,180,120,.6)'; for (let k = 0; k < 18; k++) { ctx.beginPath(); ctx.arc(w * .26 + (k % 3) * w * .24, h * .22 + Math.floor(k / 3) * h * .12, 3, 0, TAU); ctx.fill(); } }
      ctx.restore(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, h * .16); ctx.lineTo(cx, h * .94); ctx.stroke();
      break;
    }
    case 'gloves': case 'gaunt': {
      for (const s of [-1, 1]) {
        ctx.save(); ctx.translate(cx + s * w * .2, cy); ctx.scale(s, 1);
        ctx.beginPath(); ctx.moveTo(-14, h * .4); ctx.lineTo(-16, -h * .04); ctx.lineTo(-12, -h * .34); ctx.lineTo(-6, -h * .38); ctx.lineTo(-2, -h * .1); ctx.lineTo(2, -h * .4); ctx.lineTo(8, -h * .38); ctx.lineTo(10, -h * .08); ctx.lineTo(18, -h * .16); ctx.lineTo(16, h * .06); ctx.lineTo(14, h * .4); ctx.closePath();
        ctx.fillStyle = metal(-16, -h * .4, 16, h * .4); ctx.fill(); outline(); ctx.fillStyle = col(tn, .6); ctx.fillRect(-15, h * .28, 30, 8); ctx.restore();
      } break;
    }
    case 'boots': case 'greaves': {
      for (const s of [-1, 1]) {
        ctx.save(); ctx.translate(cx + s * w * .2, cy);
        ctx.beginPath(); ctx.moveTo(-10, -h * .4); ctx.lineTo(10, -h * .4); ctx.lineTo(10, h * .14); ctx.lineTo(s > 0 ? 22 : 18, h * .26); ctx.lineTo(s > 0 ? 22 : 18, h * .4); ctx.lineTo(-12, h * .4); ctx.closePath();
        ctx.fillStyle = metal(-12, -h * .4, 20, h * .4); ctx.fill(); outline(); ctx.fillStyle = col(tn, .55); ctx.fillRect(-12, h * .34, 34, 6); ctx.fillRect(-11, -h * .4, 22, 6); ctx.restore();
      } break;
    }
    case 'belt': case 'pbelt': {
      ctx.fillStyle = metal(0, 0, 0, h); ctx.beginPath(); ctx.moveTo(4, cy - 12); ctx.quadraticCurveTo(cx, cy - 2, w - 4, cy - 12); ctx.lineTo(w - 4, cy + 10); ctx.quadraticCurveTo(cx, cy + 20, 4, cy + 10); ctx.closePath(); ctx.fill(); outline();
      ctx.fillStyle = '#c9a44a'; ctx.fillRect(cx - 10, cy - 10, 20, 20); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(cx - 5, cy - 5, 10, 10);
      if (b.icon === 'pbelt') { ctx.fillStyle = '#a8acb0'; for (let k = 0; k < 6; k++) ctx.fillRect(10 + k * (w - 20) / 6 + (k > 2 ? 24 : 0) - (k > 2 ? 0 : 0), cy - 6, 10, 12); }
      break;
    }
    case 'ring': {
      ctx.lineWidth = 9; ctx.strokeStyle = metal(0, 0, w, h); ctx.beginPath(); ctx.arc(cx, cy + 6, w * .26, 0, TAU); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke();
      const gem = ['#d03030', '#3070e0', '#30b050', '#e0c030', '#a040d0'][Math.floor(R() * 5)];
      ctx.fillStyle = gem; ctx.beginPath(); ctx.arc(cx, cy - w * .2, 9, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(cx - 4, cy - w * .2 - 5, 3, 3); break;
    }
    case 'amulet': {
      ctx.strokeStyle = '#b8963a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * .15, h * .1); ctx.quadraticCurveTo(cx, h * .7, w * .85, h * .1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, h * .4); ctx.lineTo(cx + 16, h * .62); ctx.lineTo(cx, h * .92); ctx.lineTo(cx - 16, h * .62); ctx.closePath(); ctx.fillStyle = metal(0, h * .4, 0, h); ctx.fill(); outline();
      ctx.fillStyle = ['#d03030', '#3070e0', '#30b050'][Math.floor(R() * 3)]; ctx.beginPath(); ctx.arc(cx, h * .64, 7, 0, TAU); ctx.fill(); break;
    }
    case 'pot': {
      const sz = b.sz || 0, bw = w * (.26 + sz * .04), by = cy + 8;
      ctx.fillStyle = 'rgba(200,220,230,.25)'; ctx.beginPath(); ctx.arc(cx, by, bw, 0, TAU); ctx.fill();
      ctx.fillRect(cx - 7, h * .14, 14, h * .25); outline();
      const g = ctx.createRadialGradient(cx - 6, by - 6, 2, cx, by, bw); g.addColorStop(0, col(tn, 1.8)); g.addColorStop(1, col(tn, .55));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, by + 2, bw - 4, Math.PI * (b.pot === 'rv' ? .05 : .15), Math.PI * (b.pot === 'rv' ? .95 : .85), true); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(cx - 8, h * .1, 16, 8);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(cx - bw * .5, by - bw * .5, 4, 8); break;
    }
    case 'scroll': {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.6);
      ctx.fillStyle = '#d8c8a0'; ctx.fillRect(-w * .3, -h * .18, w * .6, h * .36); ctx.fillStyle = '#b8a678'; ctx.beginPath(); ctx.arc(-w * .3, 0, h * .2, 0, TAU); ctx.arc(w * .3, 0, h * .2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3d6ad8'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.restore(); break;
    }
    case 'gold': {
      for (let k = 0; k < 9; k++) { const x = cx + (R() - .5) * w * .5, y = cy + 10 - k * 2 + (R() - .5) * 10; ctx.fillStyle = '#7a5a10'; ctx.beginPath(); ctx.ellipse(x, y + 2, 10, 5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#e0bc4a'; ctx.beginPath(); ctx.ellipse(x, y, 10, 5, 0, 0, TAU); ctx.fill(); } break;
    }
  }
  if (it.rarity === 'unique') { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(200,160,60,.18)'; ctx.fillRect(0, 0, w, h); }
  quantize(ctx, c.width, c.height, true);
  const url = c.toDataURL(); ICON_CACHE[key] = { c, url };
  return ICON_CACHE[key];
}
