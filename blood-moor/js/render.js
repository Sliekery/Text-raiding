/* Rendering: ground chunks, depth-sorted props/walls/actors, spell effects, light radius, labels, automap. */
'use strict';
const RD = { cv: null, ctx: null, W: 0, H: 0, Z: 1, dpr: 1, camX: 0, camY: 0, light: null, lctx: null, labels: [], hoverables: [], showLabels: true, showMap: false, miniMap: true };

function renderInit() {
  RD.cv = $('#game'); RD.ctx = RD.cv.getContext('2d');
  // the world is drawn 1:1 into a small frame buffer, snapped to the palette, then blown up with hard pixels
  RD.buf = makeCanvas(8, 8); RD.bctx = RD.buf.getContext('2d', { willReadFrequently: true });
  RD.light = makeCanvas(8, 8); RD.lctx = RD.light.getContext('2d');
  resizeRender(); addEventListener('resize', resizeRender);
}
function resizeRender() {
  const w = innerWidth, h = innerHeight;
  RD.dpr = Math.min(devicePixelRatio || 1, 2);
  if (w * h * RD.dpr * RD.dpr > 2.6e6) RD.dpr = Math.sqrt(2.6e6 / (w * h));
  RD.cv.width = Math.round(w * RD.dpr); RD.cv.height = Math.round(h * RD.dpr);
  RD.W = RD.cv.width; RD.H = RD.cv.height;
  // one game pixel = S screen pixels; aim for a view about 440 game pixels tall (420 wide in portrait)
  RD.S = Math.max(RD.H < 600 ? 1 : 2, Math.round(w < h ? RD.W / 420 : RD.H / 440));
  RD.bw = Math.ceil(RD.W / RD.S); RD.bh = Math.ceil(RD.H / RD.S);
  RD.buf.width = RD.bw; RD.buf.height = RD.bh;
  RD.Z = RD.S; RD.cssZ = RD.S / RD.dpr;
  RD.light.width = Math.ceil(RD.bw / 4); RD.light.height = Math.ceil(RD.bh / 4);
}
const toScreen = (x, y) => [isoX(x, y), isoY(x, y)];
function screenToWorld(px, py) {
  // px,py in CSS pixels
  const sx = (px * RD.dpr - RD.W / 2) / RD.Z + RD.camX, sy = (py * RD.dpr - RD.H / 2) / RD.Z + RD.camY;
  return [unIsoX(sx, sy), unIsoY(sx, sy)];
}
function worldToCss(x, y, z = 0) { return [((isoX(x, y) - RD.camX) * RD.Z + RD.W / 2) / RD.dpr, ((isoY(x, y) - z - RD.camY) * RD.Z + RD.H / 2) / RD.dpr]; }

function render(dt) {
  const ctx = RD.bctx, A = G.area, t = G.time, bw = RD.bw, bh = RD.bh;
  if (!A) return;
  RD.hoverables = [];
  // camera follows the player with a little shake
  const [px, py] = toScreen(P.x, P.y);
  RD.camX = px; RD.camY = py - 18;
  if (G.shake > 0) { RD.camX += rand(-1, 1) * G.shake * 18; RD.camY += rand(-1, 1) * G.shake * 12; G.shake = Math.max(0, G.shake - dt * 1.4); }
  RD.camX = Math.round(RD.camX); RD.camY = Math.round(RD.camY);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, bw, bh);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, Math.floor(bw / 2) - RD.camX, Math.floor(bh / 2) - RD.camY);
  const hw = bw / 2, hh = bh / 2, vx0 = RD.camX - hw, vx1 = RD.camX + hw, vy0 = RD.camY - hh, vy1 = RD.camY + hh;
  // tile range covered by the view
  const corners = [[vx0, vy0 - 40], [vx1, vy0 - 40], [vx0, vy1 + 120], [vx1, vy1 + 120]].map(([sx, sy]) => [unIsoX(sx, sy), unIsoY(sx, sy)]);
  const tx0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[0]))) - 1), tx1 = Math.min(A.w - 1, Math.ceil(Math.max(...corners.map(c => c[0]))) + 1);
  const ty0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[1]))) - 1), ty1 = Math.min(A.h - 1, Math.ceil(Math.max(...corners.map(c => c[1]))) + 1);
  // ground
  const budget = { n: G.firstFrame ? 99 : 2 }; G.firstFrame = false;
  for (let cy = Math.floor(ty0 / CHUNK); cy <= Math.floor(ty1 / CHUNK); cy++) for (let cx = Math.floor(tx0 / CHUNK); cx <= Math.floor(tx1 / CHUNK); cx++) {
    const B = chunkBox(cx, cy); if (B.left > vx1 || B.left + B.w < vx0 || B.top > vy1 || B.top + B.h < vy0) continue;
    const c = getChunk(A, cx, cy, budget);
    if (c) ctx.drawImage(c, B.left, B.top);
    else { ctx.fillStyle = '#3a3a26'; ctx.beginPath(); ctx.moveTo(B.left + B.w / 2, B.top); ctx.lineTo(B.left + B.w, B.top + B.h / 2); ctx.lineTo(B.left + B.w / 2, B.top + B.h); ctx.lineTo(B.left, B.top + B.h / 2); ctx.fill(); }
  }
  // build one chunk just outside the view so walking rarely waits on the ground painter
  if (budget.n > 0) {
    const cx0 = Math.floor(tx0 / CHUNK) - 1, cx1 = Math.floor(tx1 / CHUNK) + 1, cy0 = Math.floor(ty0 / CHUNK) - 1, cy1 = Math.floor(ty1 / CHUNK) + 1;
    outer: for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0 || cx * CHUNK >= A.w || cy * CHUNK >= A.h || A.chunks.has(cx + ',' + cy)) continue;
      getChunk(A, cx, cy, budget); break outer;
    }
  }
  // flat layer: scorch marks, targets, corpses, items, portal pads
  for (const g of G.grounds) drawGroundFx(ctx, g, t);
  for (const m of A.monsters) if (m.dead && inView(m.x, m.y, vx0, vx1, vy0, vy1)) drawActor(ctx, m, t);
  RD.labels = [];
  for (const gi of A.items) if (inView(gi.x, gi.y, vx0, vx1, vy0, vy1)) drawGroundItem(ctx, gi, dt);
  // depth-sorted layer
  const list = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = ty * A.w + tx; if (!A.wall[i]) continue;
    if (A.wall[i] === 5 && A.b(tx + 1, ty) && A.b(tx - 1, ty) && A.b(tx, ty + 1) && A.b(tx, ty - 1) && A.b(tx + 1, ty + 1) && A.b(tx - 1, ty - 1) && A.b(tx + 1, ty - 1) && A.b(tx - 1, ty + 1)) continue;
    list.push({ d: tx + ty + 1, k: 'wall', tx, ty });
  }
  for (let cy = Math.floor(ty0 / CHUNK) - 1; cy <= Math.floor(ty1 / CHUNK) + 1; cy++) for (let cx = Math.floor(tx0 / CHUNK) - 1; cx <= Math.floor(tx1 / CHUNK) + 1; cx++) {
    const arr = A.objGrid.get(cx + ',' + cy); if (!arr) continue;
    for (const o of arr) if (inView(o.x, o.y, vx0 - 100, vx1 + 100, vy0 - 20, vy1 + 220)) list.push({ d: o.x + o.y + (o.t === 'tallgrass' || o.t === 'bones' ? -.3 : 0), k: 'obj', o });
  }
  for (const m of A.monsters) if (!m.dead && inView(m.x, m.y, vx0, vx1, vy0, vy1 + 80)) list.push({ d: m.x + m.y, k: 'actor', e: m });
  for (const n of A.npcs) list.push({ d: n.x + n.y, k: 'npc', e: n });
  list.push({ d: P.x + P.y, k: 'actor', e: P });
  for (const p of G.projs) list.push({ d: p.x + p.y + .2, k: 'proj', p });
  for (const g of G.grounds) if (g.k === 'fire') list.push({ d: (g.x0 + g.x1 + g.y0 + g.y1) / 2, k: 'fire', g });
  for (const pe of portalEnds()) if (pe.area === A.id) list.push({ d: pe.x + pe.y, k: 'portal', pe });
  list.sort((a, b) => a.d - b.d);
  const pd = P.x + P.y, [psx, psy] = toScreen(P.x, P.y);
  for (const it of list) {
    switch (it.k) {
      case 'wall': {
        const s = wallSprite(A, it.tx, it.ty), [sx, sy] = toScreen(it.tx + .5, it.ty + .5);
        let fade = 1;
        if (it.d > pd + .6 && Math.abs(sx - psx) < 70 && sy - s.ay < psy && sy + 20 > psy - 30) fade = .38;
        if (fade < 1) ctx.globalAlpha = fade;
        ctx.drawImage(s, sx - s.ax, sy - s.ay);
        ctx.globalAlpha = 1; break;
      }
      case 'obj': drawObj(ctx, it.o, t, pd, psx, psy); break;
      case 'actor': drawActor(ctx, it.e, t); break;
      case 'npc': drawNpc(ctx, it.e, t); break;
      case 'proj': drawProj(ctx, it.p, t); break;
      case 'fire': drawFireGround(ctx, it.g, t); break;
      case 'portal': drawPortal(ctx, it.pe, t); break;
    }
  }
  // flying effects
  drawFx(ctx, dt);
  if (RD.aim) {
    const [ax, ay] = toScreen(RD.aim.x, RD.aim.y);
    ctx.strokeStyle = 'rgba(255,220,140,.85)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(psx, psy - 20); ctx.lineTo(ax, ay); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.ellipse(ax, ay, 26, 13, 0, 0, TAU); ctx.stroke();
  }
  // light radius / darkness
  drawLighting(ctx, A, t);
  if (PAL.on) quantize(ctx, bw, bh, false);
  // blow the frame up with hard pixels, centred so game pixel (bw/2) lands on screen centre
  const out = RD.ctx, S = RD.S;
  out.setTransform(1, 0, 0, 1, 0, 0); out.imageSmoothingEnabled = false;
  out.fillStyle = '#000'; out.fillRect(0, 0, RD.W, RD.H);
  out.drawImage(RD.buf, Math.round(RD.W / 2 - Math.floor(bw / 2) * S), Math.round(RD.H / 2 - Math.floor(bh / 2) * S), bw * S, bh * S);
  // labels, names and the automap in screen space
  drawLabels(out);
  drawOverheads(out);
  if (RD.showMap) drawAutomap(out, false); else if (RD.miniMap) drawAutomap(out, true);
}
function inView(x, y, x0, x1, y0, y1) { const sx = isoX(x, y), sy = isoY(x, y); return sx > x0 - 80 && sx < x1 + 80 && sy > y0 - 20 && sy < y1 + 140; }

function drawObj(ctx, o, t, pd, psx, psy) {
  const s = propSprite(o.t, o.v), [sx, sy] = toScreen(o.x, o.y), sc = o.s || 1;
  let fade = 1;
  if ((o.t === 'tree' || o.t === 'deadtree' || o.t === 'tent' || o.t === 'cart') && o.x + o.y > pd + .3 && Math.abs(sx - psx) < 60 * sc && psy < sy && psy > sy - s.ay * sc) fade = .4;
  ctx.globalAlpha = fade;
  if (o.flip) { ctx.save(); ctx.translate(sx, sy); ctx.scale(-sc, sc); ctx.drawImage(s, -s.ax, -s.ay); ctx.restore(); }
  else if (sc !== 1) ctx.drawImage(s, sx - s.ax * sc, sy - s.ay * sc, s.width * sc, s.height * sc);
  else ctx.drawImage(s, sx - s.ax, sy - s.ay);
  ctx.globalAlpha = 1;
  if (s.flame) drawFlame(ctx, sx + s.flame[0], sy + s.flame[1], s.big ? 20 : 9, t, o.x);
  if (o.t === 'exitlight') { /* drawn as-is */ }
  if (o.label || o.text) RD.hoverables.push({ k: 'obj', o, sx, sy: sy - 20, r: 26 });
}

/* ---------- Actors ---------- */
function actorTint(e) {
  if (e.dead) return [30, 22, 18, .3];
  if (e.flash > 0) return [255, 255, 255, .45];
  if (e.freeze > 0) return [120, 170, 255, .55];
  if (e.chill > 0 || (e === P && P.chillT > 0)) return [110, 150, 255, .32];
  if (e === RD.hoverM) return [255, 255, 255, .18];
  return e.tint || null;
}
function drawActor(ctx, e, t) {
  const [sx, sy] = toScreen(e.x, e.y);
  if (e.dead && e.deadT > 40) return;
  const fade = e.dead && e.deadT > 30 ? 1 - (e.deadT - 30) / 10 : 1;
  ctx.globalAlpha = fade;
  // contact shadow
  ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(sx, sy, 15 * (e.scale || 1) * (e.type === 'brute' ? 1.4 : 1), 7 * (e.scale || 1), 0, 0, TAU); ctx.fill();
  if (e === P) { e.castCol = P.castCol; equipLook(); if (P.buffs.frozenarmor) drawAura(ctx, sx, sy, '160,200,255', t); if (P.buffs.energyshield) drawAura(ctx, sx, sy, '90,140,255', t, 1); }
  const tint = actorTint(e);
  let top;
  if (e.type === 'quillrat') top = drawRat(ctx, e, sx, sy, e.ang, t, tint);
  else top = drawHumanoid(ctx, e, sx, sy, e.ang, t, tint);
  if (e.d && e.mods && e.mods.includes('fireench') && !e.dead) drawFlame(ctx, sx, sy - 10, 12, t, e.id);
  if (e.d && e.rank === 'boss' && !e.dead) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(sx, sy - 30, 0, sx, sy - 30, 40); g.addColorStop(0, 'rgba(120,255,90,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(sx - 40, sy - 70, 80, 80); ctx.restore(); }
  ctx.globalAlpha = 1;
  if (e !== P && !e.dead) RD.hoverables.push({ k: 'mon', e, sx, sy: sy - (e.type === 'quillrat' ? 12 : 26 * (e.scale || 1)), r: (e.type === 'brute' ? 26 : 19) * (e.scale || 1), top });
}
function drawAura(ctx, sx, sy, c, t, ring) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(sx, sy - 28, 4, sx, sy - 28, 34); g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(.75, `rgba(${c},${.1 + .05 * Math.sin(t * 4)})`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g; ctx.fillRect(sx - 36, sy - 64, 72, 72);
  if (ring) { ctx.strokeStyle = `rgba(${c},.35)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(sx, sy - 28, 22, 32, 0, t * 2, t * 2 + 4); ctx.stroke(); }
  ctx.restore();
}
function equipLook() {
  const w = P.equip.rhand, s = P.equip.lhand, h = P.equip.head, b = P.equip.body;
  P.weapon = w ? BASES[w.base].icon : null;
  P.shield = s ? { tint: BASES[s.base].tint, icon: BASES[s.base].icon } : null;
  P.helm = h ? { tint: BASES[h.base].tint, icon: BASES[h.base].icon, full: BASES[h.base].icon === 'fullhelm' || BASES[h.base].icon === 'mask' } : null;
  P.armorTint = b ? BASES[b.base].tint : null;
}
function drawNpc(ctx, n, t) {
  const d = NPCS[n.id];
  if (!n.rig) { n.rig = RIGS[n.id]; n.anim = 'idle'; n.seed = n.x; n.ang = Math.PI * .75; n.weapon = n.id === 'akara' ? 'staff' : n.id === 'charsi' ? 'club' : null; }
  const dP = dist(n.x, n.y, P.x, P.y); if (dP < 5) n.ang = Math.atan2(P.y - n.y, P.x - n.x);
  const [sx, sy] = toScreen(n.x, n.y);
  ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(sx, sy, 15, 7, 0, 0, TAU); ctx.fill();
  drawHumanoid(ctx, n, sx, sy, n.ang, t, RD.hoverN === n ? [255, 255, 255, .18] : null);
  RD.hoverables.push({ k: 'npc', e: n, sx, sy: sy - 28, r: 20, name: d.name });
  if (n.id === 'akara' && P.quest.den === 2) { ctx.fillStyle = '#e8c860'; ctx.font = 'bold 18px serif'; ctx.textAlign = 'center'; ctx.fillText('!', sx, sy - 74 + Math.sin(t * 4) * 2); }
}
function drawPortal(ctx, pe, t) {
  const [sx, sy] = toScreen(pe.x, pe.y);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const g = ctx.createRadialGradient(sx, sy - 34, 2, sx, sy - 34, 34 - k * 6);
    g.addColorStop(0, 'rgba(200,230,255,.6)'); g.addColorStop(.4, 'rgba(70,120,255,.45)'); g.addColorStop(1, 'rgba(20,40,160,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, sy - 34, 18 + Math.sin(t * 3 + k) * 2, 36 + Math.cos(t * 2 + k) * 2, 0, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(160,200,255,.5)'; ctx.lineWidth = 1.5;
  for (let k = 0; k < 6; k++) { const a = t * 2 + k; ctx.beginPath(); ctx.arc(sx, sy - 34, 10 + k * 3, a, a + 1.2); ctx.stroke(); }
  ctx.restore();
  RD.hoverables.push({ k: 'portal', pe, sx, sy: sy - 34, r: 24, name: pe.side === 'town' ? 'Portal to ' + G.areas[G.portal.area].name : 'Town Portal' });
}

/* ---------- Ground items ---------- */
function drawGroundItem(ctx, gi, dt) {
  gi.t += dt;
  const it = gi.item, b = BASES[it.base], [sx, sy] = toScreen(gi.x, gi.y), ic = itemIcon(it).c;
  const w = ic.width * .64, h = ic.height * .64, drop = Math.max(0, .35 - gi.t) / .35;
  const lift = Math.sin(drop * Math.PI) * 26;
  ctx.save(); ctx.translate(sx, sy - h * .3 - lift); ctx.rotate(b.h > 2 ? -1.05 : -.2); ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2; ctx.drawImage(ic, -w / 2, -h / 2, w, h); ctx.restore();
  if (it.rarity === 'unique' || it.rarity === 'rare') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(sx, sy - 6, 0, sx, sy - 6, 22); g.addColorStop(0, it.rarity === 'unique' ? 'rgba(220,180,90,.35)' : 'rgba(230,230,90,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(sx - 22, sy - 28, 44, 44); ctx.restore(); }
  RD.labels.push({ gi, x: sx, y: sy - 14 });
}
function labelText(it) { return BASES[it.base].kind === 'gold' ? `${it.qty} Gold` : it.name; }
function drawLabels(ctx) {
  const show = RD.showLabels || RD.altHeld;
  RD.labelRects = [];
  if (!show) return;
  const fs = Math.round(12 * RD.dpr * clamp(RD.cssZ, .9, 1.25));
  ctx.font = `${fs}px "Alegreya Sans SC", "Palatino Linotype", Georgia, serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  const placed = [];
  for (const L of RD.labels.slice().sort((a, b) => a.y - b.y)) {
    const it = L.gi.item; if (dist(L.gi.x, L.gi.y, P.x, P.y) > P.lightR + 4) continue;
    const text = labelText(it), w = ctx.measureText(text).width + 10 * RD.dpr, h = fs + 6 * RD.dpr;
    let x = (L.x - RD.camX) * RD.Z + RD.W / 2, y = (L.y - RD.camY) * RD.Z + RD.H / 2;
    // stack overlapping labels upward like the original
    for (let k = 0; k < 12; k++) { const hit = placed.find(r => Math.abs(r.x - x) < (r.w + w) / 2 && Math.abs(r.y - y) < h); if (!hit) break; y = hit.y - h - 1; }
    placed.push({ x, y, w });
    const hov = RD.hoverLabel === L.gi;
    ctx.fillStyle = hov ? 'rgba(40,40,70,.85)' : 'rgba(0,0,0,.72)'; ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = itemColor(it); ctx.fillText(text, x, y + 1);
    RD.labelRects.push({ gi: L.gi, x0: (x - w / 2) / RD.dpr, x1: (x + w / 2) / RD.dpr, y0: (y - h / 2) / RD.dpr, y1: (y + h / 2) / RD.dpr });
  }
}
function drawOverheads(ctx) {
  // names for hovered NPCs/objects (monster info lives in the top bar)
  const h = RD.hoverAny; if (!h || h.k === 'mon') return;
  const name = h.k === 'npc' ? NPCS[h.e.id].name : h.k === 'portal' ? h.name : h.k === 'obj' ? (h.o.label || 'Sign') : null; if (!name) return;
  const x = (h.sx - RD.camX) * RD.Z + RD.W / 2, y = (h.sy - 48 - RD.camY) * RD.Z + RD.H / 2, fs = Math.round(13 * RD.dpr);
  ctx.font = `${fs}px "Alegreya Sans SC", Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(name).width + 12 * RD.dpr; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - w / 2, y - fs * .75, w, fs * 1.5);
  ctx.fillStyle = h.k === 'portal' ? '#8fb0ff' : '#e8e2d2'; ctx.fillText(name, x, y + 1);
}

/* ---------- Spells ---------- */
function glow(ctx, x, y, r, c, a = .8) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function drawProj(ctx, p, t) {
  const [sx, sy0] = toScreen(p.x, p.y), sy = sy0 - p.z;
  const ang = Math.atan2(isoY(p.vx, p.vy), isoX(p.vx, p.vy));
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  switch (p.kind) {
    case 'fbolt': case 'sfire': {
      for (let k = 0; k < 5; k++) glow(ctx, sx - Math.cos(ang) * k * 5, sy - Math.sin(ang) * k * 5, 12 - k * 1.6, k ? '255,110,30' : '255,220,140', .6 - k * .08);
      if (Math.random() < .5) fxSpark(p.x, p.y, '255,140,40', .5, .25, p.z); break;
    }
    case 'fball': {
      glow(ctx, sx, sy, 26, '255,90,20', .5); glow(ctx, sx, sy, 13, '255,220,140', .9);
      for (let k = 1; k < 6; k++) glow(ctx, sx - Math.cos(ang) * k * 6, sy - Math.sin(ang) * k * 6, 12 - k, '255,120,30', .35);
      if (Math.random() < .8) fxSpark(p.x, p.y, '255,140,40', .8, .35, p.z); break;
    }
    case 'flame': { const k = p.t / p.life; glow(ctx, sx, sy, 10 + k * 18, '255,120,30', .5 * (1 - k * .6)); glow(ctx, sx, sy, 6 + k * 6, '255,230,150', .5 * (1 - k)); break; }
    case 'ibolt': case 'shard': case 'iblast': case 'gspike': {
      const L = p.kind === 'shard' ? 7 : p.kind === 'ibolt' ? 11 : 15;
      glow(ctx, sx, sy, L * 1.6, '120,170,255', .4);
      ctx.strokeStyle = 'rgba(230,245,255,.95)'; ctx.lineWidth = p.kind === 'shard' ? 2 : 3; ctx.beginPath(); ctx.moveTo(sx - Math.cos(ang) * L, sy - Math.sin(ang) * L); ctx.lineTo(sx + Math.cos(ang) * L * .4, sy + Math.sin(ang) * L * .4); ctx.stroke();
      if (p.kind === 'gspike' || p.kind === 'iblast') { ctx.fillStyle = 'rgba(190,220,255,.8)'; ctx.beginPath(); ctx.moveTo(sx + Math.cos(ang) * 12, sy + Math.sin(ang) * 12); ctx.lineTo(sx + Math.cos(ang + 2.5) * 7, sy + Math.sin(ang + 2.5) * 7); ctx.lineTo(sx + Math.cos(ang - 2.5) * 7, sy + Math.sin(ang - 2.5) * 7); ctx.fill(); }
      break;
    }
    case 'orb': {
      glow(ctx, sx, sy, 30, '110,160,255', .45); glow(ctx, sx, sy, 12, '230,245,255', .9);
      ctx.strokeStyle = 'rgba(200,230,255,.7)'; ctx.lineWidth = 1.5; for (let k = 0; k < 6; k++) { const a = t * 6 + k * 1.05; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * 6, sy + Math.sin(a) * 6); ctx.lineTo(sx + Math.cos(a) * 16, sy + Math.sin(a) * 16); ctx.stroke(); }
      break;
    }
    case 'cbolt': {
      glow(ctx, sx, sy, 14, '170,190,255', .55);
      ctx.strokeStyle = 'rgba(240,245,255,.95)'; ctx.lineWidth = 1.5; ctx.beginPath(); let x = sx - 6, y = sy; ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += 3; y += rand(-4, 4); ctx.lineTo(x, y); } ctx.stroke(); break;
    }
    case 'quill': {
      ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sx - Math.cos(ang) * 7, sy - Math.sin(ang) * 7); ctx.lineTo(sx + Math.cos(ang) * 4, sy + Math.sin(ang) * 4); ctx.stroke(); break;
    }
  }
  ctx.restore();
}
function drawGroundFx(ctx, g, t) {
  if (g.k === 'meteor') {
    const [sx, sy] = toScreen(g.x, g.y), k = g.t / g.delay;
    ctx.strokeStyle = `rgba(255,120,40,${.4 + .4 * Math.sin(t * 20)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, 64, 32, 0, 0, TAU); ctx.stroke();
    if (!g.done) {
      const hgt = (1 - k) * 420, mx = sx - (1 - k) * 160, my = sy - hgt;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i++) glow(ctx, mx - i * 9, my - i * 22, 26 - i * 2.4, '255,110,30', .55 - i * .05);
      glow(ctx, mx, my, 16, '255,230,160', 1); ctx.restore();
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(mx, my, 9, 0, TAU); ctx.fill();
    }
  } else if (g.k === 'blizzard') {
    const [sx, sy] = toScreen(g.x, g.y);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(120,160,255,.06)'; ctx.beginPath(); ctx.ellipse(sx, sy, g.r * 46, g.r * 23, 0, 0, TAU); ctx.fill();
    for (const s of g.shards) {
      const [x, y] = toScreen(s.x, s.y), k = s.t / .45, h = (1 - k) * 200;
      ctx.strokeStyle = 'rgba(210,235,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 18 * (1 - k), y - h - 14); ctx.lineTo(x + 18 * (1 - k) - 5, y - h); ctx.stroke();
      glow(ctx, x + 18 * (1 - k) - 5, y - h, 8, '140,190,255', .5);
    }
    ctx.restore();
  } else if (g.k === 'fire') {
    // scorched ground under flames
    const n = Math.max(1, Math.round(dist(g.x0, g.y0, g.x1, g.y1) / .6));
    ctx.fillStyle = 'rgba(20,10,4,.25)';
    for (let i = 0; i <= n; i++) { const [x, y] = toScreen(lerp(g.x0, g.x1, i / n), lerp(g.y0, g.y1, i / n)); ctx.beginPath(); ctx.ellipse(x, y, g.w * 40 + (g.patch ? g.w * 10 : 0), g.w * 20 + (g.patch ? g.w * 5 : 0), 0, 0, TAU); ctx.fill(); }
  }
}
function drawFireGround(ctx, g, t) {
  const n = Math.max(1, Math.round(dist(g.x0, g.y0, g.x1, g.y1) / .5)), life = Math.min(1, (g.life - g.t) / .6, g.t / .15);
  const sz = (g.patch ? (g.w > 1 ? 26 : 13) : 18) * life;
  if (g.patch && g.w > 1) { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const [x, y] = toScreen(g.x0 + Math.cos(a) * g.w * .6, g.y0 + Math.sin(a) * g.w * .6); drawFlame(ctx, x, y, sz * .8, t, i); } return; }
  for (let i = 0; i <= n; i++) { const [x, y] = toScreen(lerp(g.x0, g.x1, i / n), lerp(g.y0, g.y1, i / n)); drawFlame(ctx, x, y, sz, t, i * 1.7 + g.x0); }
}
function drawFx(ctx, dt) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i]; f.t += dt; const k = f.t / f.life;
    if (k >= 1) { G.fx.splice(i, 1); continue; }
    const [sx, sy] = toScreen(f.x, f.y);
    switch (f.k) {
      case 'spark': { f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vz -= 200 * dt; if (f.z < 0) { f.z = 0; f.vz *= -.3; } const [x, y] = toScreen(f.x, f.y); ctx.fillStyle = `rgba(${f.c},${1 - k})`; ctx.fillRect(x - 1.2, y - f.z - 1.2, 2.4, 2.4); break; }
      case 'ring': { ctx.strokeStyle = `rgba(${f.c},${(1 - k) * .8})`; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(sx, sy, f.r * 32 * (.3 + k * .7), f.r * 16 * (.3 + k * .7), 0, 0, TAU); ctx.stroke(); break; }
      case 'boom': { glow(ctx, sx, sy - 10, f.r * 48 * (.4 + k), `${f.c}`, .8 * (1 - k)); glow(ctx, sx, sy - 10, f.r * 20 * (1 - k * .5), '255,240,200', .9 * (1 - k)); break; }
      case 'nova': {
        const r = f.r * k;
        if (f.el === 'static') { ctx.strokeStyle = `rgba(230,230,255,${1 - k})`; ctx.lineWidth = 1.5; for (let j = 0; j < 24; j++) { const a = j / 24 * TAU + f.t * 3; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * r * 30, sy + Math.sin(a) * r * 15); ctx.lineTo(sx + Math.cos(a + .15) * r * 33, sy + Math.sin(a + .15) * r * 16.5); ctx.stroke(); } break; }
        for (let j = 0; j < 40; j++) { const a = j / 40 * TAU, x = sx + Math.cos(a) * r * 32, y = sy + Math.sin(a) * r * 16 - 8; glow(ctx, x, y, 9, f.c, .7 * (1 - k)); }
        if (f.el === 'light') { ctx.strokeStyle = `rgba(240,240,255,${1 - k})`; ctx.lineWidth = 1.5; ctx.beginPath(); for (let j = 0; j <= 40; j++) { const a = j / 40 * TAU, rr = r * (1 + rand(-.06, .06)); ctx.lineTo(sx + Math.cos(a) * rr * 32, sy + Math.sin(a) * rr * 16 - 8); } ctx.stroke(); }
        break;
      }
      case 'bolt': {
        const pts = f.pts.map(p => { const [x, y] = toScreen(p[0], p[1]); return [x, y - (p[2] !== undefined ? p[2] : 26)]; });
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(255,255,255,${1 - k})` : `rgba(${f.c},${.6 * (1 - k)})`; ctx.lineWidth = pass ? f.w * .6 : f.w * 3;
          ctx.beginPath();
          for (let s = 0; s < pts.length - 1; s++) {
            const [ax, ay] = pts[s], [bx, by] = pts[s + 1], segs = Math.max(3, Math.round(Math.hypot(bx - ax, by - ay) / 14)), R = mulberry((f.seed * 1000 + s + Math.floor(f.t * 30)) | 0);
            ctx.moveTo(ax, ay); for (let j = 1; j <= segs; j++) { const q = j / segs, jx = j === segs ? 0 : (R() - .5) * 16, jy = j === segs ? 0 : (R() - .5) * 16; ctx.lineTo(lerp(ax, bx, q) + jx, lerp(ay, by, q) + jy); }
          }
          ctx.stroke();
        }
        break;
      }
    }
  }
  ctx.restore();
}

/* ---------- Light radius ---------- */
function drawLighting(ctx, A, t) {
  const L = RD.lctx, lw = RD.light.width, lh = RD.light.height, sc = 1 / 4, bw = RD.bw, bh = RD.bh;
  const dark = A.id === 'moor' && inTown() ? .32 : A.dark;
  L.globalCompositeOperation = 'source-over'; L.clearRect(0, 0, lw, lh);
  L.fillStyle = `rgba(4,3,8,${dark})`; L.fillRect(0, 0, lw, lh);
  L.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a = 1) => {
    const sx = (isoX(x, y) - RD.camX) * sc + lw / 2, sy = (isoY(x, y) - 20 - RD.camY) * sc + lh / 2, rr = r * 36 * sc;
    if (sx < -rr || sx > lw + rr || sy < -rr || sy > lh + rr) return;
    const g = L.createRadialGradient(sx, sy, 0, sx, sy, rr); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(.55, `rgba(0,0,0,${a * .85})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    L.fillStyle = g; L.save(); L.translate(sx, sy); L.scale(1, .62); L.translate(-sx, -sy); L.beginPath(); L.arc(sx, sy, rr, 0, TAU); L.fill(); L.restore();
  };
  hole(P.x, P.y, P.lightR);
  for (const l of A.lights) hole(l.x, l.y, l.r * (l.flicker ? .92 + .08 * Math.sin(t * 13 + l.x) : 1), .9);
  for (const p of G.projs) if (p.team === 'p' || p.kind === 'sfire') hole(p.x, p.y, p.kind === 'fball' || p.kind === 'orb' ? 3 : 1.6, .7);
  for (const g of G.grounds) if (g.k === 'fire') hole((g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, 2 + dist(g.x0, g.y0, g.x1, g.y1) / 2, .8);
  for (const pe of portalEnds()) if (pe.area === A.id) hole(pe.x, pe.y, 3, .8);
  for (const m of A.monsters) if (!m.dead && m.mods.includes('fireench')) hole(m.x, m.y, 2.2, .6);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(RD.light, 0, 0, bw, bh); ctx.imageSmoothingEnabled = false;
  // warm glow from fires in camp and the den
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const l of A.lights) if (l.warm) {
    const sx = isoX(l.x, l.y) - RD.camX + bw / 2, sy = isoY(l.x, l.y) - 20 - RD.camY + bh / 2, r = l.r * 26;
    if (sx < -r || sx > bw + r || sy < -r || sy > bh + r) continue;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, `rgba(255,140,50,${.13 + .03 * Math.sin(t * 9 + l.x)})`); g.addColorStop(1, 'rgba(255,100,20,0)');
    ctx.fillStyle = g; ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  ctx.restore();
  // vignette
  const vg = ctx.createRadialGradient(bw / 2, bh / 2, Math.min(bw, bh) * .35, bw / 2, bh / 2, Math.max(bw, bh) * .75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, bw, bh);
}

/* ---------- Automap ---------- */
function drawAutomap(ctx, mini) {
  const A = G.area; if (!A.mapCanvas) return;
  const mc = A.mapCanvas, ox = A.h * MAP_TW / 2 + 4;
  const ppx = ox + (P.x - P.y) * MAP_TW / 2, ppy = 4 + (P.x + P.y) * MAP_TH / 2;
  const s = (mini ? 1.1 : 2.1) * RD.dpr;
  ctx.save();
  if (mini) {
    const w = (RD.miniW || 150) * RD.dpr, h = (RD.miniH || 110) * RD.dpr, x0 = RD.W - w - (RD.miniRight || 12) * RD.dpr, y0 = RD.miniTop * RD.dpr;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x0, y0, w, h); ctx.strokeStyle = 'rgba(200,170,110,.35)'; ctx.strokeRect(x0 + .5, y0 + .5, w - 1, h - 1);
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    ctx.translate(x0 + w / 2 - ppx * s, y0 + h / 2 - ppy * s);
  } else ctx.translate(RD.W / 2 - ppx * s, RD.H / 2 - ppy * s);
  ctx.globalAlpha = mini ? .9 : .75; ctx.imageSmoothingEnabled = false;
  ctx.scale(s, s); ctx.drawImage(mc, 0, 0); ctx.globalAlpha = 1;
  const dot = (x, y, c, r) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ox + (x - y) * MAP_TW / 2, 4 + (x + y) * MAP_TH / 2, r / s * RD.dpr, 0, TAU); ctx.fill(); };
  for (const m of A.monsters) if (!m.dead && A.explored[A.idx(m.x | 0, m.y | 0)] && dist(m.x, m.y, P.x, P.y) < 30) dot(m.x, m.y, m.rank === 'normal' || m.rank === 'minion' ? '#c03020' : '#e0b040', 2);
  for (const n of A.npcs) dot(n.x, n.y, '#e8e2d2', 2.5);
  for (const t of A.triggers) dot(t.x, t.y, '#c9a24a', 3.5);
  for (const pe of portalEnds()) if (pe.area === A.id) dot(pe.x, pe.y, '#6a9aff', 3.5);
  dot(P.x, P.y, '#ffffff', 3);
  ctx.restore();
}
