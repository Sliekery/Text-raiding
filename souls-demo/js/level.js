/* Level: Firelink ruins → aqueduct → Undead Burg → Taurus Demon wall → drake bridge → Undead Parish → church roof (Bell Gargoyles).
   Units are meters. North is −z, the route climbs as it goes. Heights: Firelink 0, aqueduct 6, Burg 14/18/24/28, wall 36, bridge 30, Parish 33, roof 48. */
'use strict';
const ML = {
  cobble: mat(TX.cobble, 0xc0b6a6), slab: mat(TX.slab, 0xb8b0a8), wall: mat(TX.wall, 0xc8beb0), wallDark: mat(TX.wall, 0x8a8078), rock: mat(TX.wall, 0x7a7066, { shade: .9 }),
  stair: mat(TX.wall, 0xb0a69a), plaster: mat(TX.plaster, 0xc8b8a0), timber: mat(TX.timber, 0xc8b8a0), plank: mat(TX.plank, 0xb0a090), wood: mat(TX.wood, 0x8a7a6a),
  slate: mat(TX.slate, 0xc0c4cc), dirt: mat(TX.dirt, 0xffffff), iron: mat(TX.plate, 0x4a4642), void: mat(TX.white, 0x0c0a08), door: mat(TX.door, 0xc0b0a0),
  glass: mat(TX.glass, 0x000000, { emissive: 0x9a8a7a }), grate: mat(TX.grate, 0x8a8a8a, { side: DS, alphaTest: .5 }), church: mat(TX.wall, 0xd8d0c4), roof: mat(TX.slate, 0xb0b8c4),
  flame: mat(TX.white, 0x000000, { emissive: 0xff7a24 }), flameHot: mat(TX.white, 0x000000, { emissive: 0xffb050 }), bone: mat(TX.cloth, 0xc8bca0), ash: mat(TX.dirt, 0x8a847c),
  banner: mat(TX.tatter, 0x7a2a20, { side: DS }), bannerB: mat(TX.tatter, 0x3a4450, { side: DS }), stone: mat(TX.slab, 0xd8d0c4), bell: mat(TX.plate, 0xb08a4a), hay: mat(TX.dirt, 0xc0a060),
};
const M = { flask: mat(TX.white, 0x000000, { emissive: 0xe08a30 }) };

/* ---------- builders ---------- */
function vis(geo, m, x, y, z, rx = 0, ry = 0, rz = 0) { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); scene.add(me); return addStatic(me); }
/* solid box with world-aligned UVs */
function block(x0, x1, y0, y1, z0, z1, m, o = {}) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  const me = new THREE.Mesh(boxGeo(w, h, d, o.ts || 2, [cx, cy, cz]), m); me.position.set(cx, cy, cz); scene.add(me);
  if (o.dyn) { /* stays a separate mesh (doors, breakables) */ } else addStatic(me);
  let s = null; if (o.collide !== false) s = addSolid({ x0, x1, y0, y1, z0, z1, walk: o.walk, cam: o.cam, mesh: me });
  return s || { mesh: me };
}
const slab = (x0, x1, z0, z1, y, m = ML.cobble, th = .6, o) => block(x0, x1, y - th, y, z0, z1, m, o);
/* stairs: walk ramp + rendered steps. dir: 'n','s','e','w' = direction of climbing */
function stairs(x0, x1, z0, z1, yLow, yHigh, dir, m = ML.stair, under = 1.2) {
  const axis = (dir === 'n' || dir === 's') ? 'z' : 'x';
  const h0 = (dir === 'n' || dir === 'w') ? yHigh : yLow, h1 = (dir === 'n' || dir === 'w') ? yLow : yHigh;
  addSolid({ ramp: true, axis, x0, x1, z0, z1, h0, h1, y0: Math.min(h0, h1) - .5, y1: Math.max(h0, h1) });
  const L = axis === 'z' ? z1 - z0 : x1 - x0, n = Math.max(2, Math.round((yHigh - yLow) / .3)), sd = L / n;
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, top = lerp(h0, h1, (i + 1) / n * (h0 > h1 ? 0 : 1) + (h0 > h1 ? i / n : 0));
    const ht = h0 > h1 ? lerp(h0, h1, i / n) : lerp(h0, h1, (i + 1) / n);
    if (axis === 'z') block(x0, x1, ht - under, ht, z0 + i * sd, z0 + (i + 1) * sd, m, { collide: false });
    else block(x0 + i * sd, x0 + (i + 1) * sd, ht - under, ht, z0, z1, m, { collide: false });
  }
}
function pillarR(x, z, y0, h, r = .45, m = ML.wall, collide = true) { block(x - r, x + r, y0, y0 + h, z - r, z + r, m, { collide: false }); if (collide) addSolid({ x0: x - r * .9, x1: x + r * .9, y0, y1: y0 + h, z0: z - r * .9, z1: z + r * .9 }); }
function crenel(x0, x1, z0, z1, y, m = ML.wall, gap = false) {
  const alongX = (x1 - x0) > (z1 - z0), L = alongX ? x1 - x0 : z1 - z0, n = Math.max(1, Math.floor(L / 1.2));
  for (let i = 0; i < n; i++) { const t = (i + .5) / n; if (gap && i % 2) continue; if (alongX) block(x0 + t * L - .3, x0 + t * L + .3, y, y + .6, z0 - .04, z1 + .04, m, { collide: false }); else block(x0 - .04, x1 + .04, y, y + .6, z0 + t * L - .3, z0 + t * L + .3, m, { collide: false }); }
}
/* low wall / parapet with merlons */
function parapet(x0, x1, z0, z1, y, h = 1.1, m = ML.wall) { block(x0, x1, y - 2, y + h, z0, z1, m); crenel(x0, x1, z0, z1, y + h, m); }
/* house: thick walls, a gable roof, optional door gaps [{side,a,b,y?}] and an interior floor */
function house(x0, x1, z0, z1, y0, h, o = {}) {
  const t = .5, m = o.m || pick([ML.plaster, ML.timber, ML.wall]), top = y0 + h, doors = o.doors || [];
  const side = (sd, a0, a1) => {
    const ds = doors.filter(d => d.side === sd).sort((a, b) => a.a - b.a); let c = a0;
    const seg = (s0, s1, yb, yt) => { if (s1 - s0 < .01) return; if (sd === 'n') block(s0, s1, yb, yt, z0, z0 + t, m); else if (sd === 's') block(s0, s1, yb, yt, z1 - t, z1, m); else if (sd === 'w') block(x0, x0 + t, yb, yt, s0, s1, m); else block(x1 - t, x1, yb, yt, s0, s1, m); };
    for (const d of ds) { const dy = d.y ?? y0; seg(c, d.a, o.base ?? y0 - 6, top); seg(d.a, d.b, o.base ?? y0 - 6, dy); seg(d.a, d.b, dy + (d.h || 3), top); c = d.b; }
    seg(c, a1, o.base ?? y0 - 6, top);
  };
  side('n', x0, x1); side('s', x0, x1); side('w', z0 + t, z1 - t); side('e', z0 + t, z1 - t);
  if (o.floor !== false) slab(x0 + t, x1 - t, z0 + t, z1 - t, y0, ML.plank, .4);
  if (o.flat) { slab(x0, x1, z0, z1, top + .4, o.roofM || ML.cobble, .4); parapetLow(x0, x1, z0, z1, top + .4); }
  else roof(x0, x1, z0, z1, top, o.ridge || ((x1 - x0) > (z1 - z0) ? 'x' : 'z'), o.roofH || 2.4);
  if (o.windows !== false) for (const sd of ['n', 's', 'e', 'w']) { if (Math.random() < .5) continue; const along = sd === 'n' || sd === 's'; const a = along ? lerp(x0 + 1, x1 - 1, Math.random()) : lerp(z0 + 1, z1 - 1, Math.random()); const wy = top - 1.6;
    if (along) windowDark(a, wy, sd === 'n' ? z0 - .04 : z1 + .04, sd === 'n' ? Math.PI : 0); else windowDark(sd === 'w' ? x0 - .04 : x1 + .04, wy, a, sd === 'w' ? -Math.PI / 2 : Math.PI / 2); }
  return { top };
}
function parapetLow(x0, x1, z0, z1, y) { block(x0, x1, y, y + .5, z0, z0 + .3, ML.wall); block(x0, x1, y, y + .5, z1 - .3, z1, ML.wall); block(x0, x0 + .3, y, y + .5, z0, z1, ML.wall); block(x1 - .3, x1, y, y + .5, z0, z1, ML.wall); }
function roof(x0, x1, z0, z1, y, ridge, rh) {
  const g = new THREE.BufferGeometry(); const L = ridge === 'x';
  const ax = L ? [x0 - .3, x1 + .3] : [z0 - .3, z1 + .3], bx = L ? [z0 - .4, z1 + .4] : [x0 - .4, x1 + .4], mid = (bx[0] + bx[1]) / 2;
  const P = (a, b, h) => L ? [a, h, b] : [b, h, a];
  const v = [], uv = [];
  const quad = (p, q, r, s) => { v.push(...p, ...q, ...r, ...p, ...r, ...s); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); };
  const span = (ax[1] - ax[0]) / 2.5, sl = Math.hypot(rh, (bx[1] - bx[0]) / 2) / 2.5;
  quad(P(ax[0], bx[0], y), P(ax[1], bx[0], y), P(ax[1], mid, y + rh), P(ax[0], mid, y + rh));
  quad(P(ax[1], bx[1], y), P(ax[0], bx[1], y), P(ax[0], mid, y + rh), P(ax[1], mid, y + rh));
  for (const a of ax) { const sgn = a === ax[0] ? 1 : -1; const p1 = P(a, bx[0], y), p2 = P(a, bx[1], y), p3 = P(a, mid, y + rh); if ((L && sgn > 0) || (!L && sgn < 0)) v.push(...p1, ...p3, ...p2); else v.push(...p1, ...p2, ...p3); uv.push(0, 0, .5, 1, 1, 0); }
  for (let i = 0; i < uv.length; i += 2) { uv[i] *= i < 24 ? span : 2; uv[i + 1] *= i < 24 ? sl : 1; }
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const me = new THREE.Mesh(g, ML.slate); me.material.side = DS; scene.add(me); addStatic(me);
}
function windowDark(x, y, z, ry, w = .8, h = 1.3) { const m = new THREE.Mesh(bgeo(w, h, .06), ML.void); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); addStatic(m); const sill = new THREE.Mesh(bgeo(w + .2, .12, .18), ML.stone); sill.position.set(0, -h / 2 - .06, .06); m.add(sill); addStatic(sill); }
function lancet(x, y, z, ry, w = 1.2, h = 4) { const m = new THREE.Mesh(bgeo(w, h, .06), ML.glass); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); addStatic(m); const top = new THREE.Mesh(coneG(w * .72, 1, 4), ML.glass); top.rotation.y = Math.PI / 4; top.scale.z = .08; top.position.set(0, h / 2 + .45, 0); m.add(top); addStatic(top); }
function archDeco(x0, x1, z, y, d = 1, m = ML.wall) { const w = x1 - x0, xc = (x0 + x1) / 2, a = Math.atan2(1.2, w / 2), L = Math.hypot(w / 2, 1.2) + .2;
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(boxGeo(.36, L, d, 2), m); b.position.set(xc + sx * w / 4, y - .6, z); b.rotation.z = sx * (Math.PI / 2 - a); scene.add(b); addStatic(b); block(xc + sx * w * .37 - w * .13, xc + sx * w * .37 + w * .13, y - .5, y + .05, z - d / 2, z + d / 2, m, { collide: false }); } }
function flame(par, x, y, z, size) { const g = new THREE.Group(); g.position.set(x, y, z); par.add(g);
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(size * (1 - i * .25), 0), i === 2 ? ML.flameHot : ML.flame); m.position.set(rand(-.3, .3) * size, size * .6 * i, rand(-.3, .3) * size); g.add(m); flames.push({ m, base: 1, ph: rand(0, TAU), i, g }); }
  return g; }
const flames = []; /* {m, base, ph, i, g} */
function torch(x, y, z, face = 0) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = face; scene.add(g); const b = new THREE.Mesh(cylG(.05, .035, .5, 4), ML.iron); b.rotation.x = .45; g.add(b); g.updateMatrixWorld(true); addStatic(b); flame(g, 0, .3, .12, .13); tmpV.set(0, .2, .6).applyAxisAngle(new V3(0, 1, 0), face); addLight(x + tmpV.x, y + .2, z + tmpV.z, 0xff8a40, 8.5, .25); }
function brazier(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); const st = new THREE.Mesh(cylG(.1, .2, 1.1, 4), ML.iron); st.position.y = .55; g.add(st); const bowl = new THREE.Mesh(cylG(.55, .3, .35, 6), ML.iron); bowl.position.y = 1.2; g.add(bowl); g.updateMatrixWorld(true); addStatic(st); addStatic(bowl); flame(g, 0, 1.42, 0, .22); addSolid({ x0: x - .5, x1: x + .5, y0: y, y1: y + 1.4, z0: z - .5, z1: z + .5 }); addLight(x, y + 2, z, 0xff8030, 11, .2); }
function hangBanner(x, y, z, ry, m = ML.banner, w = 1.1, h = 2.6) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 2), m); p.position.set(x, y, z); p.rotation.y = ry; scene.add(p); addStatic(p); }
function tree(x, y, z, s = 1) { const tm = ML.wood; const t = vis(cylG(.12 * s, .26 * s, 3.2 * s, 5), tm, x, y + 1.6 * s, z);
  [[.9, 2.4, .7], [-.8, 2.0, -.9], [.3, 2.9, -.6], [-.4, 2.7, 1]].forEach(([a, yy, b]) => vis(cylG(.04 * s, .09 * s, 1.6 * s, 4), tm, x + a * .45 * s, y + yy * s, z + b * .3 * s, b * .6, 0, -a * .9)); addSolid({ x0: x - .3, x1: x + .3, y0: y, y1: y + 3, z0: z - .3, z1: z + .3 }); }
function towerDeco(x, z, base, r, h) { vis(cylG(r, r * 1.08, h, 8), ML.wall, x, base + h / 2, z); vis(coneG(r * 1.3, r * 2.6, 8), ML.slate, x, base + h + r * 1.3, z); }
function houseDeco(x, z, base) { const w = rand(3, 5), d = rand(3, 5), h = rand(4, 8); block(x - w / 2, x + w / 2, base, base + h, z - d / 2, z + d / 2, pick([ML.plaster, ML.timber, ML.wall]), { collide: false }); const r = vis(coneG(Math.max(w, d) * .78, rand(2, 3.4), 4), ML.slate, x, 0, z, 0, Math.PI / 4); r.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); r.position.y = base + h + r.geometry.parameters.height / 2; r.updateMatrixWorld(true); }
function bones(x, y, z, n = 4) { for (let i = 0; i < n; i++) vis(cylG(.025, .025, .5, 3), ML.bone, x + rand(-.6, .6), y + .05, z + rand(-.6, .6), Math.PI / 2, rand(0, 3), 0); }

/* ---------- interactive world objects ---------- */
const interacts = [];   // {x,y,z,r,label(),act(),on()}
const ladders = [];      // {x,z,y0,y1,face (yaw the climber faces), down: bool (usable from bottom)}
const breakables = [];   // crates / barrels: solid until hit
const doors = [];
const fogs = [];
const bonfires = [];
const items = [];        // world pickups
const npcs = [];
const triggers = [];     // {x0,x1,z0,z1,y0,y1,fn,once}
function addInteract(o) { interacts.push(o); return o; }
function ladder(x, z, y0, y1, face, o = {}) {
  const L = { x, z, y0, y1, face, lowered: o.lowered !== false, exitTop: o.exitTop, exitBot: o.exitBot, kick: !!o.kick };
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; scene.add(g);
  const len = y1 - y0; for (const sx of [-1, 1]) { const r = new THREE.Mesh(bgeo(.08, len, .08), ML.wood); r.position.set(sx * .3, len / 2, 0); g.add(r); }
  for (let y = .3; y < len; y += .4) { const r = new THREE.Mesh(bgeo(.6, .05, .05), ML.wood); r.position.set(0, y, 0); g.add(r); }
  L.mesh = g; g.position.y = L.lowered ? y0 : y1 - 1.5; ladders.push(L);
  if (!o.kick && L.lowered) { g.updateMatrixWorld(true); [...g.children].forEach(c => addStatic(c)); }
  const fx = Math.sin(face), fz = Math.cos(face);
  /* climb from bottom: stand in front of the ladder (on the side it faces from) */
  L.bot = new V3(x - fx * .55, y0, z - fz * .55);
  L.top = L.exitTop || new V3(x + fx * .7, y1, z + fz * .7);
  addInteract({ pos: L.bot, r: 1.1, label: () => L.lowered ? 'Climb ladder' : 'The ladder is drawn up', act: () => { if (L.lowered) startClimb(L, false); else sfx('nope'); }, on: () => P.onGround });
  addInteract({ pos: L.top, r: 1.1, label: () => L.lowered ? 'Climb down' : 'Kick down the ladder', act: () => { if (!L.lowered) { L.lowered = true; L.mesh.position.y = L.y0; sfx('door', L.top); toast('A shortcut opened'); } else startClimb(L, true); }, on: () => P.onGround });
  return L;
}
function breakable(x, y, z, kind = 'crate', o = {}) {
  const s = kind === 'barrel' ? .8 : (o.s || 1);
  const me = kind === 'barrel' ? new THREE.Mesh(cylG(.36, .32, .9, 7), ML.plank) : new THREE.Mesh(boxGeo(s, s, s, 1), ML.plank);
  me.position.set(x, y + (kind === 'barrel' ? .45 : s / 2), z); me.rotation.y = rand(-.3, .3); scene.add(me);
  const r = kind === 'barrel' ? .38 : s / 2;
  const sol = addSolid({ x0: x - r, x1: x + r, y0: y, y1: y + (kind === 'barrel' ? .9 : s), z0: z - r, z1: z + r, walk: true });
  const b = { pos: new V3(x, y, z), r: r + .2, mesh: me, sol, broken: false, item: o.item };
  breakables.push(b); return b;
}
function breakObj(b) {
  if (b.broken) return; b.broken = true; b.sol.on = false; scene.remove(b.mesh); sfx('door', b.pos);
  emit(b.pos.x, b.pos.y + .5, b.pos.z, 14, { color: [0x6a4a30, 0x4a3424], speed: 3, up: 2, life: .8, size: .1, add: false });
  if (b.item) dropItem(b.item[0], b.item[1], b.pos.x, b.pos.y, b.pos.z);
}
function door(x0, x1, z0, z1, y0, h, o = {}) {
  const d = { open: false, ...o };
  const s = block(x0, x1, y0, y0 + h, z0, z1, ML.door, { dyn: true });
  d.sol = s; d.mesh = s.mesh; d.pos = new V3((x0 + x1) / 2, y0, (z0 + z1) / 2);
  d.openIt = () => { if (d.open) return; d.open = true; d.sol.on = false; d.mesh.visible = false; sfx('door', d.pos); };
  for (const side of o.sides || [0]) addInteract({ pos: new V3(d.pos.x + (o.nx || 0) * side, y0, d.pos.z + (o.nz || 0) * side), r: 1.6,
    label: () => d.key && !hasItem(d.key) ? 'Locked' : 'Open door', on: () => !d.open,
    act: () => { if (d.oneWay && !d.oneWay()) { toast('It will not open from this side'); sfx('nope'); return; } if (d.key && !hasItem(d.key)) { toast('Locked. It needs the ' + ITEMS[d.key].name); sfx('nope'); return; } d.openIt(); if (d.onOpen) d.onOpen(); } });
  doors.push(d); return d;
}
function fogGate(x0, x1, z0, z1, y0, h, o = {}) {
  const f = { on: true, ...o }; const w = Math.max(x1 - x0, z1 - z0); const alongX = (x1 - x0) > (z1 - z0);
  f.meshes = [];
  for (let k = 0; k < 2; k++) { const gm = mat(TX.fog, 0xffffff, { transparent: true, alpha: .8, alphaTest: .02, emissive: 0x8a8478, side: DS }); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 4, 3), gm); p.position.set((x0 + x1) / 2 + (alongX ? 0 : k * .2), y0 + h / 2, (z0 + z1) / 2 + (alongX ? k * .2 : 0)); if (!alongX) p.rotation.y = Math.PI / 2; scene.add(p); f.meshes.push(p); }
  f.sol = addSolid({ x0, x1, y0, y1: y0 + h, z0, z1, cam: false });
  f.center = new V3((x0 + x1) / 2, y0, (z0 + z1) / 2); f.alongX = alongX;
  f.set = v => { f.on = v; f.sol.on = v; f.meshes.forEach(m => m.visible = v); };
  addInteract({ pos: f.center, r: 2.6, label: () => 'Traverse the white fog', on: () => f.on && (!f.canEnter || f.canEnter()), act: () => enterFog(f) });
  fogs.push(f); return f;
}
function bonfire(id, name, x, y, z, spawnYaw) {
  const sh = new THREE.Group(); sh.position.set(x, y, z); scene.add(sh);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; const s = new THREE.Mesh(bgeo(.3, .2, .26), ML.stone); s.position.set(Math.sin(a) * .82, .1, Math.cos(a) * .82); s.rotation.y = a + rand(-.3, .3); sh.add(s); }
  const mound = new THREE.Mesh(coneG(.62, .32, 6), ML.ash); mound.position.y = .16; sh.add(mound);
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(cylG(.025, .025, .5, 3), ML.bone); b.position.set(rand(-.45, .45), .12, rand(-.45, .45)); b.rotation.set(Math.PI / 2 + rand(-.3, .3), rand(0, 3), 0); sh.add(b); }
  const coil = new THREE.Group(); coil.position.y = .25; coil.rotation.set(.1, 0, .08); sh.add(coil);
  for (let i = 0; i < 7; i++) { const seg = new THREE.Mesh(bgeo(.07, .16, .02), ML.iron); const a = i * .9; seg.position.set(Math.sin(a) * .03, .08 + i * .14, Math.cos(a) * .03); seg.rotation.y = a; coil.add(seg); }
  const gd = new THREE.Mesh(bgeo(.28, .04, .06), ML.iron); gd.position.y = 1.08; coil.add(gd);
  const fl = flame(sh, 0, .38, 0, .15);
  const light = addLight(x, y + 1.2, z, 0xff8a38, 10, .22);
  addSolid({ x0: x - .7, x1: x + .7, y0: y, y1: y + .5, z0: z - .7, z1: z + .7 });
  sh.updateMatrixWorld(true); sh.traverse(o => { if (o.isMesh && !flames.some(f => f.m === o)) addStatic(o); });
  const b = { id, name, pos: new V3(x, y, z), lit: false, fl, light, spawnYaw: spawnYaw ?? 0 };
  b.setLit = v => { b.lit = v; fl.visible = v; light.on = v; };
  b.setLit(false); bonfires.push(b);
  addInteract({ pos: b.pos, r: 2.2, label: () => b.lit ? 'Rest at bonfire' : 'Light bonfire', act: () => restAt(b), on: () => true });
  return b;
}
function msg(x, y, z, text) { const r = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), RUNE_MAT); r.rotation.x = -Math.PI / 2; r.position.set(x, y + .03, z); scene.add(r); addStatic(r); addInteract({ pos: new V3(x, y, z), r: 1.3, label: () => 'Read message', act: () => showNote(typeof text === 'function' ? text() : text), on: () => true }); }
const RUNE_MAT = mat(TX.rune, 0x000000, { emissive: 0xff9a40, alphaTest: .3 });
function corpse(x, y, z, yaw, itemId, qty = 1, pose = 'sit') {
  const m = fill({}, CORPSE_M.skin); m.face = CORPSE_M.face; m.skirt = CORPSE_M.cloth;
  const c = rig({ s: 1, W: .85, head: 'hollow', m, skirtH: .34 }); c.root.position.set(x, y, z); c.root.rotation.y = yaw; scene.add(c.root);
  c.flask.parent.remove(c.flask);
  applyPose(c, pose === 'lie' ? mkPose({ spin: -1.5, hY: -.62, aRx: -2.2, aLx: -.4, eR: -.2, hd: .6, lL: .2, kL: .4 }) : mkPose({ ...POSE.sit, hd: .9, aRx: .1, eR: -.2, aLx: .1, eL: -.3, aRz: -.3, tX: .1 }));
  staticRig(c.root);
  if (itemId) dropItem(itemId, qty, x + Math.sin(yaw) * .5, y, z + Math.cos(yaw) * .5);
}
const CORPSE_M = { skin: mat(TX.skin, 0x4a4036), face: mat(TX.face, 0x5a4c3e), cloth: mat(TX.tatter, 0x3a3028, { side: DS }) };
function dropItem(id, qty, x, y, z, glow = 0xfff0d0) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(.09, 0), mat(TX.white, 0, { emissive: glow })); m.position.set(x, y + .35, z); scene.add(m);
  const it = { id, qty, pos: new V3(x, y, z), mesh: m, taken: false };
  items.push(it);
  addInteract({ pos: it.pos, r: 1.3, label: () => 'Pick up item', on: () => !it.taken, act: () => { it.taken = true; scene.remove(m); giveItem(id, qty, true); } });
  return it;
}
function trigger(x0, x1, z0, z1, y0, y1, fn, once = true) { triggers.push({ x0, x1, z0, z1, y0, y1, fn, once, done: false }); }
function npc(kind, x, y, z, yaw, lines, o = {}) {
  const m = fill({}, mat(TX.cloth, o.col || 0x6a5a4a)); m.face = mat(TX.face, 0xb09a80); m.helm = mat(TX.plate, o.helmCol || 0x9a9a9a); m.dark = mat(TX.white, 0x080604);
  if (o.plate) { m.chest = mat(TX.plate, o.plate); m.fore = m.chest; m.shins = m.chest; }
  const r = rig({ s: 1, head: o.head || 'npc', m, weapon: o.weapon, sun: o.sun ? mat(TX.cloth, 0xffffff, { emissive: 0x6a4a10 }) : null, tabard: o.tabard, skirtH: .3, hat: o.hat });
  r.root.position.set(x, y, z); r.root.rotation.y = yaw; scene.add(r.root); applyPose(r, o.pose || IDLE); r.flask.visible = false; r.flask.parent.remove(r.flask); staticRig(r.root);
  const n = { kind, pos: new V3(x, y, z), rig: r, lines, li: 0, name: o.name };
  addInteract({ pos: n.pos, r: 1.8, label: () => 'Talk', on: () => true, act: () => talk(n) });
  npcs.push(n); return n;
}

/* ---------- the map ---------- */
const AREA = {};
function buildLevel() {
  /* ===== Firelink Shrine ruins (y 0) ===== */
  slab(-14, 14, -12, 14, 0, ML.cobble, 1);
  block(-15, -14, -1, 4, -12, 14, ML.rock); block(14, 15, -1, 3.5, -12, 14, ML.rock); block(-15, 15, -1, 3, 14, 15, ML.rock);
  for (let i = 0; i < 9; i++) block(-14 + i * 3.2, -13.2 + i * 3.2, 3, 3 + rand(.3, 2), 14, 15, ML.rock, { collide: false });
  slab(-14, 8, -19, -12, .4, ML.slab, 1.4); block(-14, 8, -1, 6, -20, -19, ML.wall); crenel(-14, 8, -20, -19, 6, ML.wall, true);
  for (let x = -12; x <= 4; x += 4) { pillarR(x, -12.4, .4, 4.2, .4); if (x < 4) block(x, x + 4, 4.6, 5.4, -12.8, -12, ML.wall, { collide: false }); archDeco(x + .4, x + 3.6, -12.4, 4.6, .8); }
  tree(-8, 0, 6, 1.3); tree(9, 0, 9, 1);
  for (const [x, z] of [[-11, 10], [-12, 7], [10, 3]]) block(x - .3, x + .3, 0, rand(.8, 1.6), z - .1, z + .1, ML.stone, { collide: false });
  AREA.firelink = bonfire('firelink', 'Firelink Shrine', 0, 0, 3, Math.PI);
  corpse(-12.6, .4, -17.2, .6, 'firebomb', 6);
  msg(2.5, 0, -2, () => pickMode('Your left thumb moves, drag the right side to look. The sword button attacks, the flask button drinks Estus.', 'WASD moves, the mouse looks. Click attacks, Shift+Click is a heavy blow. R drinks from your Estus Flask.', 'Left stick moves, right stick looks. RB attacks, RT heavy, X uses your quick item.'));
  /* lift tower (arrival of the Parish elevator) */
  block(-14, -13.5, 0, 9, -2, 6, ML.wall); block(-14, -9.5, 0, 9, -2.5, -2, ML.wall); block(-14, -9.5, 0, 9, 6, 6.5, ML.wall); block(-10, -9.5, 3.4, 9, -2, 6, ML.wall);
  block(-13.5, -10, 0, .2, -2, 6, ML.iron, { collide: false });
  AREA.liftLow = new V3(-11.8, 0, 2);
  /* stairs up to the aqueduct */
  stairs(8, 12, -22, -12, 0, 6, 'n'); block(7.4, 8, -1, 7.5, -22, -12, ML.wall); block(12, 15, -1, 7.5, -22, -12, ML.wall);
  npc('crestfallen', 6.6, 0, -9.5, -.6, ['Well, what do we have here. You must be a new arrival.', 'There are two bells of awakening. One is up above, in the Undead Parish. Climb the stairs and go through the Burg.', 'Not that it matters. You will go hollow like the rest of them.'], { pose: mkPose({ ...POSE.sit, hd: .6 }), col: 0x5a4a3a, head: 'great', helmCol: 0x7a7470, name: 'Crestfallen Warrior' });
  /* ===== Aqueduct (y 6) ===== */
  slab(8, 12, -50, -22, 6, ML.slab, 1.2);
  block(7.4, 8, 4.8, 7.1, -50, -22, ML.wall); block(12, 12.6, 4.8, 7.1, -50, -22, ML.wall);
  for (let z = -24; z >= -48; z -= 6) { block(8.4, 11.6, -20, 4.8, z - .7, z + .7, ML.wall, { collide: false }); archDeco(8, 12, z - 3, 4.4, 1.2); }
  block(4, 8, -14, 22, -62, -50, ML.rock); block(12, 16, -14, 22, -62, -50, ML.rock);
  stairs(8, 12, -62, -50, 6, 14, 'n');
  msg(10, 6, -26, 'Up ahead is the Burg. The hollows there are many. Pull them one at a time.');
  /* ===== Undead Burg: entrance landing (y 14) ===== */
  slab(6, 14, -72, -62, 14);
  house(14, 20, -72, -62, 14, 3.5, { flat: true, m: ML.plaster });
  block(5.6, 6, 13, 15, -72, -69, ML.wall);
  AREA.barrels = [breakable(5.6, 14, -63, 'barrel'), breakable(5.6, 14, -64.2, 'barrel'), breakable(5.6, 14, -65.3, 'barrel')];
  slab(1, 5.6, -66, -60.5, 10.5, ML.cobble, 1); block(.4, 1, 6, 11.5, -66, -60.5, ML.wall); block(1, 5.6, 6, 11.5, -61, -60.4, ML.wall); block(5.6, 6, 6, 13.4, -66, -60.5, ML.wall); block(1, 5.6, 6, 11.5, -66.6, -66, ML.wall);
  corpse(2, 10.5, -62, 2.2, 'largeSoul', 1);
  ladder(3.5, -66.3, 10.5, 14, Math.PI, { exitTop: new V3(3.5, 14, -67.6) });
  /* small bridge west, wooden deck, firebomber perch, ambush house */
  slab(1, 6, -69, -66, 14, ML.plank, .3); block(1, 6, 13.7, 14.9, -69.25, -69, ML.wood); block(1, 3, 13.7, 14.9, -66, -65.8, ML.wood); block(4, 6, 13.7, 14.9, -66, -65.8, ML.wood);
  slab(-10, 1, -78, -60, 14, ML.plank, .5);
  for (const z of [-62, -66, -70]) for (const x of [-9.5, .5]) block(x - .15, x + .15, 4, 14, z - .15, z + .15, ML.wood, { collide: false });
  block(-10, 1, 13.6, 14.6, -60.3, -60, ML.wood); block(1, 1.3, 13.6, 14.9, -78, -69, ML.wood); block(1, 1.3, 13.6, 14.9, -66, -60, ML.wood); block(-10.3, -10, 13.6, 14.9, -78, -76, ML.wood); block(-10, -6, 13.6, 14.9, -78.3, -78, ML.wood);
  slab(-10, -6, -78, -73, 17.2, ML.plank, .3); for (const [x, z] of [[-6.2, -73.2], [-6.2, -77.8], [-9.8, -73.2]]) pillarR(x, z, 14, 3.2, .14, ML.wood);
  block(-6.2, -6, 17.2, 18, -78, -73, ML.wood); ladder(-5.6, -74.5, 14, 17.2, -Math.PI / 2, { exitTop: new V3(-7, 17.2, -74.5) });
  house(-17, -10, -76, -61, 14, 4.5, { doors: [{ side: 'e', a: -69, b: -67 }], m: ML.timber });
  torch(-10.3, 16.4, -66, Math.PI / 2);
  /* street north + the yard of three hollows (y 14) */
  slab(-6, 2, -92, -78, 14);
  house(-15, -6, -92, -78.5, 14, 6, { m: ML.plaster }); block(-6, -2.6, 10, 18.5, -92.6, -92, ML.wall); house(2, 14, -84, -72, 14, 6.5, { m: ML.timber }); house(7, 14, -98, -84, 14, 8, { m: ML.plaster });
  block(2, 2.5, 8, 18.5, -92, -84, ML.wall);
  stairs(-2, 2, -100, -92, 14, 18, 'n'); block(-2.6, -2, 8, 19, -100, -92, ML.wall);
  slab(2, 7, -100, -96.6, 18, ML.plank, .4); block(2, 7, 17.6, 18.9, -96.6, -96.2, ML.wood); block(4.6, 7, 17, 19.1, -100.4, -100, ML.wood);
  torch(-5.7, 16.6, -84, Math.PI / 2);
  msg(-1, 14, -79, 'Archer ahead. Use the walls.');
  /* ===== walkway (y 18), drake fly-by, corridor to the bonfire ===== */
  slab(-4, 4, -114, -100, 18);
  block(-4.6, -4, 12, 20, -104, -100, ML.wall); block(-4.6, -4, 12, 20, -112, -110, ML.wall); block(-4.6, -4, 18, 19.1, -114, -112, ML.wall);
  block(4, 4.6, 12, 19.1, -106, -100, ML.wall); block(-4, 4, 17, 19.1, -114.6, -114, ML.wall);
  trigger(-4, 4, -106, -101, 17, 21, () => drakeFlyBy());
  slab(-26, -4, -110, -104, 18); house(-26, -4, -104, -96, 18, 4.5, { m: ML.timber, floor: false }); house(-20, -4, -122, -110, 18, 5, { m: ML.plaster, floor: false });
  slab(-26, -20, -146, -110, 18); house(-34, -26, -146, -104, 18, 5.5, { m: ML.wall, floor: false }); block(-20, -19.4, 12, 23, -146, -122, ML.wall);
  torch(-25.7, 20.4, -116, Math.PI / 2); torch(-20.3, 20.4, -132, -Math.PI / 2);
  /* bonfire yard (y 18) under the bridge stair room */
  slab(-31, -18, -170, -146, 18);
  block(-31.6, -31, 12, 24, -170, -146, ML.wall); block(-18, -17.4, 12, 24, -170, -146, ML.wall); block(-31.6, -17.4, 12, 24, -170.6, -170, ML.wall); block(-34, -26, 12, 23.5, -146.6, -146, ML.wall);
  AREA.burg = bonfire('burg', 'Undead Burg', -24, 18, -164, Math.PI);
  /* the bonfire NPC: the undead merchant's neighbour, Solaire stands later on the bridge */
  /* stair room (y 24) above the yard; ladder down to the bonfire is drawn up until kicked from above */
  slab(-31, -21.4, -163, -150, 24, ML.plank, .4);
  block(-31, -30.4, 24, 28, -163, -150, ML.wall); block(-31, -21.4, 24, 28, -163.6, -163, ML.wall); block(-21.4, -20.8, 24, 28, -163, -153.4, ML.wall); block(-27, -21.4, 24, 28, -150.6, -150, ML.wall);
  AREA.shortcutLadder = ladder(-21.8, -152.4, 18, 24, -Math.PI / 2, { lowered: false, kick: true, exitTop: new V3(-23, 24, -152.4) });
  block(-21.4, -20.8, 24, 28, -153.4, -150, ML.wall, { collide: false });
  stairs(-30.5, -27, -150, -140, 24, 30, 's', ML.stair, .8);
  block(-27, -26.4, 23, 31.1, -150, -140, ML.wall);
  /* ===== merchant rooftop (y 18) ===== */
  slab(4, 15, -118, -106, 18); block(4, 15, 18, 19.1, -106.6, -106, ML.wall);
  AREA.crates = [breakable(15.4, 18, -111.5), breakable(15.4, 18, -112.6), breakable(15.5, 19, -112, 'crate', { s: .8 })];
  block(15, 15.4, 17, 19.1, -118, -113.8, ML.wall); block(15, 15.4, 17, 19.1, -110, -106, ML.wall);
  stairs(15, 19, -113.2, -110.6, 14, 18, 'w', ML.stair, .8); block(15, 19, 12, 19, -113.8, -113.2, ML.wall); block(15, 19, 12, 19, -110.6, -110, ML.wall);
  slab(19, 25, -118, -104, 14); block(25, 25.5, 13, 15, -118, -104, ML.wall); block(19, 25, 13, 15, -104.5, -104, ML.wall); block(19, 25, 13, 15, -118.5, -118, ML.wall);
  npc('merchant', 23.5, 14, -112, -Math.PI / 2, ['Hello there, are you a merchant too? Heh heh... take a look.'], { pose: mkPose({ ...POSE.sit, hd: .3 }), col: 0x4a3a2a, head: 'hood', helmCol: 0x3a2a1a, name: 'Undead Merchant', shop: true });
  towerDeco(40, -100, -20, 3, 30);
  /* ===== house with interior stairs (y 18 → 24) ===== */
  house(4, 16, -130, -118, 18, 9, { doors: [{ side: 's', a: 9, b: 11 }, { side: 'n', a: 11.5, b: 13.5, y: 24 }], m: ML.wall, floor: false });
  slab(4.5, 15.5, -129.5, -118.5, 18, ML.plank, .4);
  stairs(4.5, 7.4, -128.5, -119.6, 18, 24, 'n', ML.plank, .5);
  slab(7.4, 15.5, -129.5, -122, 24, ML.plank, .4); slab(4.5, 7.4, -129.5, -128.5, 24, ML.plank, .4);
  block(7.4, 7.6, 24, 25, -122, -119.6, ML.wood); block(7.6, 15.5, 24, 25, -122.2, -122, ML.wood);
  corpse(14.6, 24, -128.6, -2.4, 'soul', 1);
  torch(10, 21, -118.7, Math.PI);
  /* ===== upper street (y 24) ===== */
  slab(4, 18, -146, -130, 24); block(18, 18.6, 18, 25.1, -134, -130, ML.wall); block(3.4, 4, 22, 25.1, -146, -142, ML.wall); block(3.4, 4, 22, 25.1, -131, -130, ML.wall);
  house(-4, 4, -142, -131, 24, 4.5, { doors: [{ side: 'e', a: -138, b: -136 }], m: ML.plaster });
  AREA.chest1 = chest(-2.3, 24, -133, 'blackFirebomb', 3);
  house(18, 25, -146, -134, 24, 4.6, { doors: [{ side: 'w', a: -141, b: -139 }], m: ML.timber });
  door(17.9, 18.6, -141, -139, 24, 3, { key: 'residenceKey', nx: -1, sides: [1] });
  AREA.chest2 = chest(23.6, 24, -136, 'goldPineResin', 2);
  house(4, 6, -158, -146, 24, 6, { m: ML.wall, windows: false }); house(10, 18, -158, -146, 24, 6, { m: ML.plaster });
  torch(9.7, 26.4, -146.3, Math.PI);
  stairs(6, 10, -158, -146, 24, 28, 'n');
  /* ===== watchtower plaza (y 28) ===== */
  slab(0, 18, -173, -158, 28);
  parapet(-.6, 0, -173, -158, 28, 1.1); block(18, 18.6, 27, 29.1, -169.6, -158, ML.wall); block(0, 3, 26, 29.1, -173.6, -173, ML.wall); block(13, 18.6, 26, 29.1, -173.6, -173, ML.wall);
  AREA.barrelTop = new V3(8, 28, -160);
  slab(-7, -.6, -170, -159, 31.5, ML.cobble, 1); block(-7.6, -7, 26, 33, -170, -159, ML.wall);
  slab(18.6, 26, -173, -158, 24); block(26, 26.6, 23, 25.2, -173, -158, ML.wall); block(18.6, 26, 23, 25.2, -158, -157.4, ML.wall); block(18.6, 26, 23, 25.2, -173.6, -173, ML.wall);
  ladder(19.2, -171.6, 24, 28, -Math.PI / 2, { exitTop: new V3(17.4, 28, -171.6) });
  corpse(25, 24, -159, Math.PI, 'blueTearstone', 1);
  /* watchtower: spiral of two flights inside, door at the top to the wall */
  block(3, 13, 14, 44, -173.8, -173, ML.wall, { collide: false });
  block(3, 6.5, 14, 44, -173.8, -173, ML.wall); block(9.5, 13, 14, 44, -173.8, -173, ML.wall); block(6.5, 9.5, 31, 44, -173.8, -173, ML.wall);
  block(12.2, 13, 14, 44, -187, -173.8, ML.wall); block(3, 13, 14, 44, -187, -186.2, ML.wall);
  block(3, 3.8, 14, 44, -187, -178, ML.wall); block(3, 3.8, 14, 36, -178, -173.8, ML.wall); block(3, 3.8, 39.5, 44, -178, -173.8, ML.wall);
  slab(3.8, 12.2, -186.2, -173, 28, ML.slab, .5);
  stairs(3.8, 6.3, -184, -174.6, 28, 32, 'n', ML.stair, .6);
  slab(6.3, 12.2, -186.2, -183, 32, ML.plank, .4); slab(3.8, 6.3, -186.2, -184, 32, ML.plank, .4);
  stairs(9.7, 12.2, -183, -176, 32, 36, 's', ML.stair, .6);
  slab(3.8, 9.7, -178, -173.8, 36, ML.plank, .4); slab(9.7, 12.2, -176, -173.8, 36, ML.plank, .4);
  block(6.3, 9.7, 32, 33, -183.2, -183, ML.wood);
  roof(3, 13, -187, -173, 44, 'x', 3);
  torch(8, 30.5, -185.9, 0);
  /* ===== Taurus Demon wall (y 36) ===== */
  slab(-30, 3, -178.5, -174, 36, ML.slab, 16);
  for (let x = -29; x < 2.5; x += 1.3) { if (x < -16 || x > -20.5) block(x, x + .6, 36, 37, -174.4, -174, ML.wall); }
  for (let x = -29; x < 2.5; x += 1.3) { if (x < -6 || x > 0) block(x, x + .6, 36, 37, -178.9, -178.5, ML.wall); }
  AREA.taurusFog = fogGate(3, 3.8, -178, -174.3, 36, 3.5, { boss: 'taurus', dir: -1 });
  block(-6, 0, 20, 42, -184, -178.5, ML.wall); block(-6, 0, 42, 42.5, -184, -183.7, ML.wall); block(-6, -5.7, 42, 42.5, -184, -178.5, ML.wall); block(-.3, 0, 42, 42.5, -184, -178.5, ML.wall);
  ladder(-3, -178.2, 36, 42, Math.PI, { exitTop: new V3(-3, 42, -179.4) });
  block(-38, -30, 20, 36, -181.5, -172.5, ML.wall, { collide: false });
  block(-38, -37.2, 20, 42, -181.5, -172, ML.wall); block(-30.8, -30, 20, 42, -181.5, -178, ML.wall); block(-30.8, -30, 20, 42, -174.2, -172, ML.wall); block(-30.8, -30, 39.5, 42, -178, -174.2, ML.wall);
  block(-38, -30, 20, 42, -182, -181.2, ML.wall); block(-34.7, -30, 20, 42, -172.8, -172, ML.wall); block(-37.2, -34.7, 33, 42, -172.8, -172, ML.wall);
  slab(-38, -30, -182, -172, 42.4, ML.slab, .4); parapetLow(-38, -30, -182, -172, 42.4);
  slab(-34.7, -30.8, -181.2, -172.8, 36, ML.plank, .5);
  stairs(-37.2, -34.7, -180.6, -172.8, 30, 36, 'n', ML.stair, .6);
  slab(-37.2, -34.7, -181.2, -180.6, 36, ML.plank, .4);
  AREA.taurusExit = fogGate(-30.8, -30, -178, -174.3, 36, 3.5, { exit: true });
  AREA.taurusExit.set(true);
  AREA.lsCrates = [breakable(-31.6, 36, -180.4, 'crate', { item: ['largeSoul', 1] }), breakable(-32.6, 36, -180.5, 'crate', { s: .8 })];
  /* ===== drake bridge (y 30) ===== */
  slab(-37.5, -30.5, -172, -112, 30, ML.slab, 2);
  block(-38, -37.5, 29, 31.1, -168, -112, ML.wall); block(-38, -37.5, 29, 31.1, -172, -170, ML.wall);
  block(-30.5, -30, 29, 31.1, -172, -140, ML.wall); block(-30.5, -30, 29, 31.1, -136, -112, ML.wall);
  for (let z = -166; z <= -116; z += 10) { block(-37, -31, -20, 28, z - 1, z + 1, ML.wall, { collide: false }); archDeco(-37.5, -30.5, z + 5, 27.6, 1.6); }
  slab(-43, -37.5, -170, -162, 30, ML.slab, 1.2); block(-43.5, -43, 29, 31.1, -170, -162, ML.wall); block(-43, -37.5, 29, 31.1, -170.5, -170, ML.wall); block(-43, -37.5, 29, 31.1, -162, -161.5, ML.wall);
  npc('solaire', -41, 30, -166, Math.PI / 2 + .3, ['Ah, hello! You don\'t look hollow, far from it.', 'I am Solaire of Astora, an adherent of the Lord of Sunlight. Is that not a wonder of a sun?', 'The drake makes the bridge hard going. Run while it rests, and shelter in the alcove on the right.'], { plate: 0x9a9a9a, sun: true, head: 'great', helmCol: 0xa8a8a8, weapon: 'longsword', name: 'Solaire of Astora', tabard: mat(TX.cloth, 0xd8d0b0) });
  slab(-30.5, -26.4, -140, -136, 30, ML.slab, 1);
  block(-26.4, -26, 29, 34, -150, -136, ML.wall); block(-30.5, -26, 29, 34, -136, -135.6, ML.wall);
  AREA.bridge = { x0: -37.5, x1: -30.5, z0: -172, z1: -112, y: 30 };
  /* gatehouse where the drake perches */
  slab(-42, -26, -112, -98, 30, ML.slab, 2);
  block(-42, -40.6, 20, 40, -112, -98, ML.wall, { collide: false }); block(-42, -40.6, 20, 40, -112, -108, ML.wall); block(-42, -40.6, 20, 40, -104, -98, ML.wall); block(-42, -40.6, 33.5, 40, -108, -104, ML.wall);
  block(-27.4, -26, 20, 40, -112, -98, ML.wall); block(-42, -26, 20, 40, -98.6, -98, ML.wall);
  block(-42, -37.5, 20, 40, -112.6, -112, ML.wall); block(-30.5, -26, 20, 40, -112.6, -112, ML.wall); block(-37.5, -30.5, 34, 40, -112.6, -112, ML.wall);
  slab(-42, -26, -112.6, -98, 40.4, ML.slab, .4); crenel(-42, -26, -112.6, -112, 40.4); crenel(-42, -26, -98.6, -98, 40.4);
  AREA.drakePerch = new V3(-34, 40.4, -106);
  /* ===== Parish gate: passage west, portcullis, gate-tower route over it with a Black Knight ===== */
  slab(-64, -42, -108, -104, 30);
  block(-64, -42, 26, 36, -104, -103.4, ML.wall); block(-64, -56.6, 26, 36, -108.6, -108, ML.wall); block(-53, -46.6, 26, 36, -108.6, -108, ML.wall); block(-43, -42, 26, 36, -108.6, -108, ML.wall);
  AREA.portcullis = door(-47.6, -47.1, -108, -104, 30, 3.8, { nx: 1, sides: [-1], oneWay: () => false });
  AREA.portcullis.mesh.material = ML.grate;
  addInteract({ pos: new V3(-49.5, 30, -104.6), r: 1.4, label: () => 'Pull lever', on: () => !AREA.portcullis.open, act: () => { AREA.portcullis.openIt(); toast('The gate rises. A shortcut opened'); } });
  block(-49.8, -49.2, 30, 31.2, -104.1, -103.6, ML.iron, { collide: false });
  block(-46, -42, 26, 30, -118, -108.6, ML.wall, { collide: false });
  stairs(-46, -43.6, -116, -108.6, 30, 34, 'n'); block(-43.6, -43, 26, 35, -116, -108.6, ML.wall); block(-46.6, -46, 26, 35, -114, -108.6, ML.wall);
  slab(-56, -42, -119, -116, 34, ML.slab, 1); block(-56, -42, 33, 35.1, -119.6, -119, ML.wall); block(-53.6, -46, 33, 35.1, -116, -115.4, ML.wall); block(-43.6, -42, 33, 35.1, -116, -115.4, ML.wall);
  stairs(-56, -53.6, -116, -108.6, 30, 34, 'n'); block(-53.6, -53, 26, 35, -114, -108.6, ML.wall);
  block(-56.6, -56, 26, 35, -119, -108.6, ML.wall);
  corpse(-58, 30, -106.5, 1.2, 'basementKey', 1, 'lie');
  towerDeco(-50, -124, 26, 3, 16);
  /* stairs up to the Parish forecourt (y 33) */
  stairs(-68, -64, -108, -104, 30, 33, 'w');
  slab(-92, -68, -118, -92, 33, ML.cobble, 1.2);
  block(-92, -68, 31, 34.1, -118.6, -118, ML.wall); block(-92, -68, 31, 34.1, -92, -91.4, ML.wall);
  block(-68, -67.4, 31, 34.1, -118, -108, ML.wall); block(-68, -67.4, 31, 34.1, -104, -92, ML.wall); block(-92.6, -92, 31, 34.1, -118, -114.8, ML.wall); block(-92.6, -92, 31, 34.1, -95.2, -92, ML.wall);
  corpse(-69, 33, -105.6, -1.2, 'halberd', 1, 'lie');
  tree(-80, 33, -95, 1.1); brazier(-72, 33, -114); brazier(-72, 33, -96);
  /* ===== the church (nave y 33, gallery 39, loft 44, roof 48) ===== */
  const CX0 = -124, CX1 = -92, CZ0 = -114, CZ1 = -96;
  slab(CX0, CX1, CZ0, CZ1, 33, ML.slab, 1.2);
  block(CX0, -100, 20, 46, CZ0 - .8, CZ0, ML.church); block(-97, CX1, 20, 46, CZ0 - .8, CZ0, ML.church); block(-100, -97, 37, 46, CZ0 - .8, CZ0, ML.church);
  block(CX0, -112, 20, 46, CZ1, CZ1 + .8, ML.church); block(-108, CX1, 20, 46, CZ1, CZ1 + .8, ML.church); block(-112, -108, 36.5, 46, CZ1, CZ1 + .8, ML.church);
  block(CX0 - .8, CX0, 20, 46, CZ0, CZ1, ML.church);
  block(CX1, CX1 + .8, 20, 46, CZ0, -107, ML.church); block(CX1, CX1 + .8, 20, 46, -103, CZ1, ML.church); block(CX1, CX1 + .8, 37, 46, -107, -103, ML.church);
  for (let x = -120; x <= -96; x += 6) { lancet(x, 39, CZ0 + .45, 0, 1.2, 4); lancet(x, 39, CZ1 - .45, Math.PI, 1.2, 4); if (x < -98) { pillarR(x + 3, CZ0 + 3.5, 33, 13, .55, ML.church); pillarR(x + 3, CZ1 - 3.5, 33, 13, .55, ML.church); } }
  roof(CX0 - .8, CX1 + .8, CZ0 - .8, CZ1 + .8, 46, 'x', 3);
  /* altar */
  block(-123, -119, 33, 34, -108, -102, ML.stone); block(-122.6, -122, 34, 38, -106, -104, ML.stone, { collide: false });
  dropItem('humanity', 1, -121, 34, -105);
  /* gallery over the entrance + stairs along the south wall */
  slab(-97, CX1, CZ0, CZ1, 39, ML.plank, .5); block(-97.4, -97, 39, 40.1, CZ0, -98.2, ML.wood);
  stairs(-106, -97, -98.2, -96.2, 33, 39, 'e', ML.plank, .6); block(-106, -97, 33.5, 40, -98.6, -98.2, ML.wood);
  /* loft and ladders to the roof */
  AREA.ladderLoft = ladder(-92.6, -109.5, 39, 44, Math.PI / 2, { exitTop: new V3(-94, 44, -109.5) });
  slab(-97, CX1, CZ0, -106, 44, ML.plank, .4);
  ladder(-92.6, -112.6, 44, 48, Math.PI / 2, { exitTop: new V3(-93.8, 48, -111.5) });
  /* bonfire tower on the south side, Andre beside it */
  slab(-112, -102, -96, -86, 33, ML.slab, 1.2); block(-112, -111.4, 20, 44, -96, -86, ML.wall); block(-102.6, -102, 20, 44, -96, -86, ML.wall); block(-112, -102, 20, 44, -86.6, -86, ML.wall);
  roof(-112, -102, -96.4, -86, 44, 'z', 2.5);
  AREA.parish = bonfire('parish', 'Undead Parish', -107, 33, -90, Math.PI);
  npc('andre', -104, 33, -88, -2.3, ['Haven\'t seen your kind in a while. I am Andre of Astora. Need your weapon reinforced?', 'Bring me titanite and souls and I will make that blade sing.'], { plate: 0x6a5a4a, col: 0x4a3a2a, head: 'npc', weapon: 'hammer', name: 'Andre of Astora', smith: true });
  block(-103.4, -102.6, 33, 34, -88.4, -87.6, ML.iron, { collide: false });
  /* elevator room on the north side */
  slab(-100, -94, -122, -114, 33, ML.slab, 1.2); block(-100.6, -100, 20, 44, -122, -114, ML.wall); block(-94, -93.4, 20, 44, -122, -114, ML.wall); block(-100, -94, 20, 44, -122.6, -122, ML.wall);
  block(-99.4, -94.6, 33, 33.2, -121.4, -116.4, ML.iron, { collide: false });
  AREA.liftHigh = new V3(-97, 33, -119);
  /* ===== roof arena (y 48) and the bell tower ===== */
  slab(-124, -92, -108, -102, 48, ML.slab, .6);
  stairs(-124, -92, -113.6, -108, 46, 48, 's', ML.roof, .4); stairs(-124, -92, -102, -96.4, 46, 48, 'n', ML.roof, .4);
  stairs(-104, -98, -122, -113.6, 46, 46.01, 's', ML.roof, .5);
  AREA.roofFog = fogGate(-95.2, -94.6, -108, -102, 48, 3.5, { boss: 'gargoyles', dir: -1 });
  block(-132, -124, 30, 62, -110, -100, ML.church, { collide: false }); block(-132, -124, 30, 62, -110, -109, ML.church); block(-132, -124, 30, 62, -101, -100, ML.church); block(-132, -131, 30, 62, -109, -101, ML.church);
  block(-124.8, -124, 30, 62, -109, -106.2, ML.church); block(-124.8, -124, 30, 62, -103.8, -101, ML.church); block(-124.8, -124, 51.5, 62, -106.2, -103.8, ML.church);
  AREA.bellDoor = door(-124.8, -124, -106.2, -103.8, 48, 3.5, { nx: 1, sides: [1], oneWay: () => G.gargoylesDead });
  slab(-131, -124, -109, -101, 48, ML.slab, .5);
  ladder(-127.5, -108.4, 48, 56, Math.PI, { exitTop: new V3(-127.5, 56, -106) });
  slab(-131, -124.8, -109, -101, 56, ML.plank, .4);
  const bell = vis(cylG(1.1, 1.6, 2.2, 8, true), ML.bell, -127.8, 58.2, -105); bell.material.side = DS;
  addInteract({ pos: new V3(-127.8, 56, -105), r: 2.2, label: () => 'Ring the Bell of Awakening', on: () => G.gargoylesDead && !G.bellRung, act: ringBell });
  roof(-132, -124, -110, -100, 62, 'z', 5);
  for (const [x, z] of [[-128, -109.6], [-128, -100.4]]) lancet(x, 58, z, 0, 1.4, 3.5);
  /* far scenery */
  block(-160, 80, -60, -40, -300, 80, ML.dirt, { collide: false });
  for (let i = 0; i < 40; i++) { const x = rand(-140, 70), z = rand(-260, 40); if (x > -60 && x < 35 && z > -200 && z < 30) continue; houseDeco(x, z, rand(-40, -8)); }
  towerDeco(60, -60, -40, 4, 60); towerDeco(-150, -150, -40, 5, 80); towerDeco(30, -230, -40, 4, 75); towerDeco(-60, -230, -40, 6, 95); towerDeco(80, -170, -40, 3, 55);
  /* torches along the climb */
  torch(13.6, 16.4, -66, -Math.PI / 2); torch(1.7, 20.4, -110, -Math.PI / 2); torch(4.5, 26.4, -140, Math.PI / 2); torch(17.6, 30.4, -165, -Math.PI / 2);
  torch(-30.8, 32.6, -150, Math.PI / 2); torch(-41.2, 32.6, -101, Math.PI / 2); torch(-91, 36, -109, -Math.PI / 2); torch(-123.2, 37.6, -110, Math.PI / 2);
  torch(-1.4, 38.5, -176.3, 0); torch(-27, 38.5, -176.3, 0);
  /* sky */
  const skyM = mat(TX.sky, 0x000000, { emissive: 0xffffff, noFog: true, side: THREE.BackSide, depthWrite: false }); AREA.sky = new THREE.Mesh(new THREE.SphereGeometry(140, 12, 8), skyM); AREA.sky.renderOrder = -2; scene.add(AREA.sky);
  AREA.sun = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), mat(TX.glow, 0x000000, { emissive: 0xffd8a0, noFog: true, alphaTest: .3, depthWrite: false })); AREA.sun.renderOrder = -1; scene.add(AREA.sun);
  /* messages along the way */
  msg(9, 14, -64, () => pickMode('Barrels can be smashed. Attack them, or roll through.', 'Barrels and crates break when struck. Something lies below.', 'Barrels and crates break when struck. Something lies below.'));
  msg(-1.5, 18, -102, 'Beware of dragon.');
  msg(-24, 18, -158, () => pickMode('A ladder above can be kicked down to make a shortcut.', 'The ladder above can be kicked down from the stair room. A shortcut back to here.', 'The ladder above can be kicked down from the stair room. A shortcut back to here.'));
  msg(8, 24, -144, 'Rolling barrel ahead. Look up the stairs before you climb.');
  msg(1.5, 36, -176.2, () => pickMode('Climb the ladder, then drop on the demon with an attack while falling.', 'Climb the ladder. Press attack while falling onto the demon to plunge.', 'Climb the ladder. Press RB while falling onto the demon to plunge.'));
  msg(-34, 30, -170, 'The drake rests between flames. Run, then hide right.');
  msg(-66, 30, -106.4, () => pickMode('Shielded foes break when kicked. Hold block, then press heavy.', 'Kick a raised shield: hold block and press heavy (K). Then strike.', 'Kick a raised shield: hold LB and press RT. Then strike.'));
  msg(-98, 48, -104.5, 'Two demons ahead. Lightning would help.');
  msg(-93.5, 33, -100, () => pickMode('Behind a foe, attack to backstab. Parry with the small button, then attack.', 'Get behind a foe and attack to backstab. Parry (G or Shift+right-click) just before a hit lands, then attack to riposte.', 'Get behind a foe and attack to backstab. Parry with LT just before a hit lands, then RB to riposte.'));
}
/* chest: opens to give an item */
function chest(x, y, z, id, qty, yaw = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; scene.add(g);
  const base = new THREE.Mesh(bgeo(1.1, .6, .7), ML.plank); base.position.y = .3; g.add(base);
  const lid = new THREE.Group(); lid.position.set(0, .6, -.35); g.add(lid); const lm = new THREE.Mesh(bgeo(1.12, .25, .72), ML.door); lm.position.set(0, .12, .35); lid.add(lm);
  addSolid({ x0: x - .6, x1: x + .6, y0: y, y1: y + .7, z0: z - .4, z1: z + .4 });
  const c = { open: false };
  addInteract({ pos: new V3(x, y, z), r: 1.5, label: () => 'Open chest', on: () => !c.open, act: () => { c.open = true; lid.rotation.x = -1.4; sfx('door', g.position); giveItem(id, qty, true); } });
  return c;
}
