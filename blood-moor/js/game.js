/* Game rules: the Sorceress, monsters and their AI, skills, missiles, damage, loot, levels, quests. */
'use strict';
const G = {
  area: null, areas: {}, time: 0, diff: 0, seed: 1, running: false, paused: false, dead: false, deadT: 0,
  projs: [], grounds: [], fx: [], ground: [], focus: null, focusT: 0, msgs: [], shake: 0, portal: null, townPortal: null,
  killsDen: 0, hover: null,
};
const P = {};   // the player: persistent fields + runtime state

/* ---------- Character ---------- */
function newCharacter(name) {
  Object.assign(P, {
    name: name || 'Sorceress', level: 1, xp: 0, st: { str: 10, dex: 25, vit: 10, ene: 35 }, statPts: 0, skillPts: 1,
    skills: {}, inv: [], stash: [], equip: {}, belt: [[], [], [], []], gold: 0, stashGold: 0,
    slots: ['attack', 'firebolt', null, null, null, null], diffMax: 0, quest: { den: 0 }, tp: 3, deaths: 0,
  });
  P.equip.rhand = makeItem('shortstaff', 1);
  for (let i = 0; i < 2; i++) beltAdd(makeItem('hp1', 1));
  for (let i = 0; i < 2; i++) beltAdd(makeItem('mp1', 1));
  P.skills.firebolt = 1; P.skillPts = 0;
  resetRuntime();
}
function resetRuntime() {
  Object.assign(P, {
    x: 0, y: 0, r: .3, ang: Math.PI / 4, anim: 'idle', animT: 0, walkPh: 0, order: null, path: null, pathT: 0,
    castT: 0, castDur: 0, hitT: 0, buffs: {}, heals: [], cds: {}, joy: null, held: null, rig: RIGS.sorc, lastBlaze: null, freezeT: 0, chillT: 0, seed: 0,
  });
  recalc(); P.life = P.maxLife; P.mana = P.maxMana;
}
function recalc() {
  const m = { str: 0, dex: 0, vit: 0, ene: 0, life: 0, mana: 0, resF: 0, resC: 0, resL: 0, resAll: 0, fcr: 0, fhr: 0, frw: 0, skAll: 0, skFire: 0, skCold: 0, skLight: 0, mf: 0, gf: 0, regen: 0, light: 0, rep: 0, mak: 0, dr: 0, pfire: 0, pcold: 0, plight: 0, sk: {} };
  let def = 0;
  for (const s of SLOTS) {
    const it = P.equip[s]; if (!it) continue;
    // requirements are checked against base stats so items can't prop each other up forever
    if (it.def) def += it.def;
    for (const k in it.mods) { if (k === 'sk') { for (const id in it.mods.sk) m.sk[id] = (m.sk[id] || 0) + it.mods.sk[id]; } else if (k in m) m[k] += it.mods[k]; }
  }
  P.bonus = m;
  const st = P.st;
  P.str = st.str + m.str; P.dex = st.dex + m.dex; P.vit = st.vit + m.vit; P.ene = st.ene + m.ene;
  P.maxLife = Math.round(40 + (P.level - 1) + (P.vit - 10) * 2 + m.life);
  P.maxMana = Math.round(35 + (P.level - 1) * 2 + (P.ene - 35) * 2 + m.mana);
  const fa = P.buffs && P.buffs.frozenarmor ? SKILLS.frozenarmor.val(skLvl('frozenarmor')) : 0;
  P.def = Math.round((Math.floor(P.dex / 4) + def) * (1 + fa / 100));
  const pen = DIFFS[G.diff].res;
  P.res = { fire: Math.min(75, m.resF + m.resAll + pen), cold: Math.min(75, m.resC + m.resAll + pen), light: Math.min(75, m.resL + m.resAll + pen), phys: 0 };
  P.ar = P.dex * 5 - 35 + 20;
  const w = P.equip.rhand; P.wdmg = w ? w.dmg.slice() : [1, 2];
  const fcrBp = [[200, 7], [105, 8], [63, 9], [37, 10], [20, 11], [9, 12], [0, 13]];
  P.castFrames = fcrBp.find(b => m.fcr >= b[0])[1];
  const fhrBp = [[280, 5], [142, 6], [86, 7], [60, 8], [42, 9], [30, 10], [20, 11], [14, 12], [9, 13], [5, 14], [0, 15]];
  P.hitFrames = fhrBp.find(b => m.fhr >= b[0])[1];
  P.speed = 4.6 * (1 + (m.frw * 150 / (m.frw + 150)) / 100);
  P.lightR = 8 + m.light;
  P.mf = m.mf;
  if (P.life > P.maxLife) P.life = P.maxLife;
  if (P.mana > P.maxMana) P.mana = P.maxMana;
  if (typeof refreshHUD === 'function') refreshHUD();
}
function skLvl(id) {
  const base = P.skills[id] || 0; if (!base) return 0;
  const s = SKILLS[id], b = P.bonus; if (!b) return base;
  return base + b.skAll + (s.tree === 0 ? b.skFire : s.tree === 1 ? b.skCold : b.skLight) + (b.sk[id] || 0);
}
function skDmg(id) {
  const s = SKILLS[id], L = skLvl(id); let [a, b] = s.dmg(L);
  let mul = 1; for (const [sid, pct] of s.syn || []) mul += (P.skills[sid] || 0) * pct;
  if (s.el === 'fire') mul += (skLvl('firemastery') ? SKILLS.firemastery.val(skLvl('firemastery')) : 0) / 100 + P.bonus.pfire / 100;
  if (s.el === 'light') mul += (skLvl('lightmastery') ? SKILLS.lightmastery.val(skLvl('lightmastery')) : 0) / 100 + P.bonus.plight / 100;
  if (s.el === 'cold') mul += P.bonus.pcold / 100;
  return [Math.max(1, Math.round(a * mul)), Math.max(1, Math.round(b * mul))];
}
function skMana(id) { const L = Math.max(1, skLvl(id)); return SKILLS[id].mana(L); }
function canLearn(id) {
  const s = SKILLS[id]; if (!s || s.tree < 0) return false;
  if (P.skillPts <= 0 || P.level < s.lvl || (P.skills[id] || 0) >= 20) return false;
  return s.req.every(r => (P.skills[r] || 0) > 0);
}
function learn(id) {
  if (!canLearn(id)) return false;
  P.skills[id] = (P.skills[id] || 0) + 1; P.skillPts--;
  if (P.skills[id] === 1 && SKILLS[id].aim !== 'passive' && !P.slots.includes(id)) { const e = P.slots.indexOf(null); if (e >= 0) P.slots[e] = id; }
  recalc(); sfx('click'); return true;
}
function gainXp(n) {
  if (P.level >= MAX_LVL) return;
  P.xp += Math.round(n);
  while (P.level < MAX_LVL && P.xp >= XP_TABLE[P.level + 1]) {
    P.level++; P.statPts += 5; P.skillPts += 1; recalc(); P.life = P.maxLife; P.mana = P.maxMana;
    sfx('level'); banner(`Level ${P.level}`, 'You have new stat and skill points'); fxRing(P.x, P.y, '255,220,120', 2.2, .9);
  }
}

/* ---------- Messages ---------- */
function msg(text, color) { G.msgs.push({ text, color: color || '#e8e2d2', t: 4 + text.length / 30 }); if (G.msgs.length > 6) G.msgs.shift(); if (typeof drawMsgs === 'function') drawMsgs(); }

/* ---------- Areas ---------- */
function buildWorld(seed) {
  G.seed = seed; G.areas = {};
  G.areas.moor = genMoor(seed); G.areas.den = genDen(seed);
  for (const a of Object.values(G.areas)) populate(a);
  G.killsDen = 0; G.portal = null; G.projs = []; G.grounds = []; G.fx = [];
}
function populate(A) {
  A.monsters = []; A.items = [];
  const D = DIFFS[G.diff];
  for (const s of A.spawns) {
    const lvl = Math.round(lerp(A.mlvl[0], A.mlvl[1], s.lvl || 0)) + D.mlvl;
    let leader = null;
    if (s.rank === 'unique' || s.rank === 'boss') {
      leader = spawnMonster(A, s.type, s.x, s.y, lvl + (s.rank === 'boss' ? 2 : 1), s.rank, s.name);
      for (let i = 0; i < s.n - 1; i++) { const m = spawnNear(A, s.type, s.x, s.y, lvl, 'minion'); if (m) m.leader = leader; }
    } else for (let i = 0; i < s.n; i++) spawnNear(A, s.type, s.x, s.y, lvl, s.rank || 'normal');
  }
  A.total = A.monsters.length;
}
function spawnNear(A, type, x, y, lvl, rank) {
  for (let k = 0; k < 12; k++) { const a = Math.random() * TAU, r = Math.random() * 2.4; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (circleFree(A, px, py, .35)) return spawnMonster(A, type, px, py, lvl, rank); }
  return null;
}
let MON_ID = 1;
function spawnMonster(A, type, x, y, lvl, rank = 'normal', name) {
  const d = MONSTERS[type];
  const m = {
    id: MON_ID++, type, d, lvl, x, y, sx: x, sy: y, r: d.r, ang: Math.random() * TAU, anim: 'idle', animT: 0, walkPh: Math.random() * 6, seed: Math.random() * 9,
    rig: RIGS[type] || RIGS.zombie, scale: 1, rank, name: d.name, mods: [], res: Object.assign({}, d.res), speed: d.speed, atkCd: d.atkCd, dmgMul: 1, def: d.def * (1 + lvl * .25),
    ar: d.ar * (1 + lvl * .3), cd: Math.random(), state: 'idle', wanderT: Math.random() * 3, path: null, pathT: 0, chill: 0, freeze: 0, flash: 0, hitT: 0, dead: false, deadT: 0,
    weapon: type === 'fallen' ? pick(['sword', 'club', 'axe']) : type === 'shaman' ? 'skullstaff' : null, rezCd: 2, area: A,
  };
  let hpMul = 1, xpMul = 1;
  if (rank === 'champion') { hpMul = 3; m.dmgMul = 1.6; xpMul = 3; m.speed *= 1.25; m.name = 'Champion ' + d.name; m.tint = [90, 120, 255, .16]; }
  if (rank === 'unique' || rank === 'boss') {
    hpMul = rank === 'boss' ? 6 : 4; m.dmgMul = rank === 'boss' ? 2.2 : 1.8; xpMul = rank === 'boss' ? 10 : 5; m.scale = rank === 'boss' ? 1.35 : 1.15;
    m.name = name || pick(UNIQUE_NAMES.a) + pick(UNIQUE_NAMES.b) + ' ' + pick(UNIQUE_NAMES.c);
    const keys = Object.keys(UNIQUE_MODS); const nm = rank === 'boss' ? ['fireench', 'strong'] : [pick(keys)]; if (rank !== 'boss' && Math.random() < .5) nm.push(pick(keys.filter(k => k !== nm[0])));
    for (const k of nm) { UNIQUE_MODS[k].apply(m); m.mods.push(k); }
    m.tint = rank === 'boss' ? [140, 255, 120, .2] : [255, 200, 90, .14];
  }
  if (rank === 'minion') { hpMul = 1.3; m.name = d.name; }
  m.maxHp = Math.round(monHp(d.hp, lvl) * hpMul); m.hp = m.maxHp;
  m.dmg = [monDmg(d.dmg[0], lvl) * m.dmgMul, monDmg(d.dmg[1], lvl) * m.dmgMul];
  m.xp = monXp(d.xp, lvl) * xpMul * DIFFS[G.diff].xpMul;
  m.r *= m.scale;
  for (const e of ['fire', 'cold', 'light']) m.res[e] = m.res[e] || 0;
  A.monsters.push(m);
  return m;
}
function enterArea(id, x, y) {
  const A = G.areas[id]; G.area = A; P.x = x; P.y = y; P.order = null; P.path = null;
  G.projs = []; G.grounds = []; G.focus = null;
  revealAround(A, P.x, P.y, 14);
  if (typeof onAreaEnter === 'function') onAreaEnter(A);
}
function inTown() { const T = TOWN; return G.area && G.area.id === 'moor' && P.x > T.x0 && P.x < T.x1 + 1 && P.y > T.y0 && P.y < T.y1 + 1; }

/* ---------- Damage ---------- */
function resMul(r) { return (100 - clamp(r, -100, 95)) / 100; }
function hurtMonster(m, amt, el, o = {}) {
  if (m.dead || amt <= 0) return 0;
  let res = m.res[el] || 0;
  if (el === 'cold' && skLvl('coldmastery')) res -= SKILLS.coldmastery.val(skLvl('coldmastery'));
  if (el === 'phys') res = m.res.phys || 0;
  const dmg = amt * resMul(res);
  m.hp -= dmg; m.flash = .12; m.state = m.state === 'flee' ? 'flee' : 'chase'; m.aggro = 6;
  G.focus = m; G.focusT = 4;
  if (el === 'cold' && o.chill !== 0) m.chill = Math.max(m.chill, (o.chill || 2) * (m.rank === 'boss' ? .5 : 1));
  if (o.freeze) m.freeze = Math.max(m.freeze, o.freeze * (m.rank === 'boss' || m.rank === 'unique' ? .4 : 1));
  if (dmg > m.maxHp / 8 && !m.freeze && m.anim !== 'hit') { m.anim = 'hit'; m.animT = 0; m.hitT = .22; m.atkFired = true; }
  if (m.mods.includes('lightench') && Math.random() < .5) for (let i = 0; i < 3; i++) spawnProj({ x: m.x, y: m.y, ang: Math.random() * TAU, speed: 5, life: 1, kind: 'cbolt', team: 'm', el: 'light', dmg: [m.dmg[0] * .3, m.dmg[1] * .3], wander: 1 });
  if (m.hp <= 0) killMonster(m);
  return dmg;
}
function killMonster(m) {
  m.dead = true; m.deadT = 0; m.hp = 0; m.flash = 0; m.chill = 0; m.anim = 'die'; m.state = 'dead'; m.freeze = 0;
  sfx('die');
  const lvlDiff = P.level - m.lvl; let xm = 1; if (lvlDiff > 5) xm = Math.max(.05, 1 - (lvlDiff - 5) * .12);
  gainXp(m.xp * xm);
  if (P.bonus.mak) P.mana = Math.min(P.maxMana, P.mana + P.bonus.mak);
  // loot
  if (!m.rezzed) {
    const q = m.rank === 'boss' ? 'boss' : m.rank === 'unique' ? 'unique' : m.rank === 'champion' ? 'champion' : 'normal';
    const drops = rollDrops(m.lvl + (q === 'boss' ? 3 : 0), P.mf, q);
    drops.forEach((it, i) => dropToGround(it, m.x + Math.cos(i * 2.4) * .45 * Math.min(1, i), m.y + Math.sin(i * 2.4) * .45 * Math.min(1, i)));
  }
  if (m.mods.includes('fireench')) { fxBoom(m.x, m.y, 1.8, '255,140,40'); if (dist(m.x, m.y, P.x, P.y) < 1.8) hurtPlayer(rand(m.dmg[0], m.dmg[1]) * 1.2, 'fire'); }
  if (m.mods.includes('coldench')) { fxRing(m.x, m.y, '160,200,255', 2.2, .5); if (dist(m.x, m.y, P.x, P.y) < 2.2) { hurtPlayer(rand(m.dmg[0], m.dmg[1]) * .6, 'cold'); P.chillT = 3; } }
  // fallen panic when their kin die
  for (const o of m.area.monsters) if (!o.dead && o.d.coward && dist(o.x, o.y, m.x, m.y) < 6 && Math.random() < .55) { o.state = 'flee'; o.fleeT = rand(1.4, 2.6); }
  if (m.area.id === 'den') {
    G.killsDen++;
    const left = m.area.monsters.filter(o => !o.dead).length;
    if (m.rank === 'boss') msg(`${m.name} has been slain.`, '#c7b377');
    if (P.quest.den === 1 && left === 0) { P.quest.den = 2; sfx('quest'); banner('Den of Evil cleared', 'Return to Akara in the Rogue Encampment'); }
    else if (P.quest.den === 1 && left <= 5 && left > 0 && !m.area.warned) { m.area.warned = 1; msg(`${left} evil creatures remain in the Den.`, '#c9a24a'); }
  }
}
function hurtPlayer(amt, el, src) {
  if (G.dead || amt <= 0) return;
  let dmg = amt * resMul(P.res[el] || 0);
  if (el === 'phys') dmg = Math.max(1, dmg - P.bonus.dr);
  if (P.buffs.energyshield) {
    const pct = SKILLS.energyshield.val(skLvl('energyshield')) / 100, abs = dmg * pct, cost = abs * 1.5;
    if (P.mana >= cost) { P.mana -= cost; dmg -= abs; fxRing(P.x, P.y, '120,170,255', .9, .25); }
    else { const part = P.mana / 1.5; P.mana = 0; dmg -= part; }
  }
  if (src && src.melee && P.buffs.frozenarmor && !src.dead) { src.freeze = Math.max(src.freeze, SKILLS.frozenarmor.freeze(skLvl('frozenarmor')) * (src.rank === 'boss' ? .4 : 1)); fxRing(src.x, src.y, '170,210,255', .7, .3); sfx('ice'); }
  if (el === 'cold') P.chillT = Math.max(P.chillT, 2.5);
  P.life -= dmg; G.shake = Math.min(.3, G.shake + dmg / P.maxLife);
  sfx('phit');
  if (dmg > P.maxLife / 12 && P.life > 0) { P.hitT = P.hitFrames / 25; P.anim = 'hit'; P.animT = 0; P.castT = 0; }
  if (P.life <= 0) die();
}
function die() {
  P.life = 0; G.dead = true; G.deadT = 0; P.dead = true; P.deadT = 0; P.anim = 'die'; P.deaths++;
  const lost = Math.floor(P.gold * .2); P.gold -= lost; P.lostGold = lost;
  sfx('die'); if (typeof showDeath === 'function') showDeath(lost);
}
function respawn() {
  G.dead = false; P.dead = false; P.anim = 'idle'; P.buffs = {}; recalc(); P.life = P.maxLife; P.mana = P.maxMana * .5;
  enterArea('moor', G.areas.moor.townSpawn[0], G.areas.moor.townSpawn[1]);
}

/* ---------- Ground items ---------- */
function dropToGround(item, x, y) {
  const A = G.area;
  for (let k = 0; k < 10 && !circleFree(A, x, y, .2); k++) { x += rand(-.6, .6); y += rand(-.6, .6); }
  A.items.push({ item, x, y, t: 0 });
  const b = BASES[item.base];
  if (item.rarity === 'unique' || item.rarity === 'rare') sfx('rare'); else if (b.kind === 'gold') sfx('gold'); else sfx('drop');
}
function pickup(gi) {
  const A = G.area, it = gi.item, b = BASES[it.base];
  let ok = false;
  if (b.kind === 'gold') { P.gold += it.qty; ok = true; sfx('gold'); }
  else if (b.kind === 'scroll') { if (P.tp < 20) { P.tp++; ok = true; } else ok = invAdd(it); sfx('click'); }
  else if (b.kind === 'potion') { ok = beltAdd(it) || invAdd(it); if (ok) sfx('potion'); }
  else { ok = invAdd(it); if (ok) sfx('click'); }
  if (ok) { A.items.splice(A.items.indexOf(gi), 1); if (b.kind !== 'gold') msg(it.name, itemColor(it)); refreshHUD(); if (typeof refreshPanels === 'function') refreshPanels(); }
  else { msg('Not enough room.', '#d05050'); sfx('nomana'); }
  return ok;
}

/* ---------- Potions ---------- */
function drink(col) {
  const c = P.belt[col]; if (!c || !c.length || G.dead) return;
  const it = c.shift(), b = BASES[it.base];
  if (b.pot === 'hp') P.heals.push({ k: 'life', per: b.heal / 3, t: 3 });
  else if (b.pot === 'mp') P.heals.push({ k: 'mana', per: b.heal / 2, t: 2 });
  else { P.life = Math.min(P.maxLife, P.life + P.maxLife * b.heal / 100); P.mana = Math.min(P.maxMana, P.mana + P.maxMana * b.heal / 100); }
  sfx('potion'); refreshHUD();
}
function usePotionItem(it) {
  const b = BASES[it.base];
  if (b.pot === 'hp') P.heals.push({ k: 'life', per: b.heal / 3, t: 3 });
  else if (b.pot === 'mp') P.heals.push({ k: 'mana', per: b.heal / 2, t: 2 });
  else { P.life = Math.min(P.maxLife, P.life + P.maxLife * b.heal / 100); P.mana = Math.min(P.maxMana, P.mana + P.maxMana * b.heal / 100); }
  sfx('potion');
}

/* ---------- Effects (visual only) ---------- */
function fxRing(x, y, c, r, life) { G.fx.push({ k: 'ring', x, y, c, r, life, t: 0 }); }
function fxBoom(x, y, r, c) { G.fx.push({ k: 'boom', x, y, r, c, life: .45, t: 0 }); for (let i = 0; i < 14; i++) fxSpark(x, y, c, rand(1, 5), rand(.3, .7)); G.shake = Math.max(G.shake, .12); }
function fxSpark(x, y, c, spd, life, z = 20) { const a = Math.random() * TAU; G.fx.push({ k: 'spark', x, y, z, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, vz: rand(20, 90), c, life, t: 0 }); }
function fxBolt(pts, c, life = .22, w = 2) { G.fx.push({ k: 'bolt', pts, c, life, t: 0, w, seed: Math.random() * 99 }); }
function fxBlood(x, y, n = 6) { for (let i = 0; i < n; i++) fxSpark(x, y, '150,10,8', rand(.5, 2.5), rand(.3, .6), 24); }

/* ---------- Missiles ---------- */
function spawnProj(o) {
  const p = Object.assign({ r: .25, life: 1, t: 0, pierce: false, hit: new Set(), z: 22 }, o);
  p.vx = Math.cos(o.ang) * o.speed; p.vy = Math.sin(o.ang) * o.speed;
  G.projs.push(p); return p;
}
function updateProjs(dt) {
  const A = G.area;
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const p = G.projs[i]; p.t += dt;
    if (p.wander && (p.wt = (p.wt || 0) - dt) <= 0) { p.wt = .08; const a = Math.atan2(p.vy, p.vx) + rand(-.9, .9), s = Math.hypot(p.vx, p.vy); p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; }
    if (p.kind === 'orb') { p.emit = (p.emit || 0) - dt; while (p.emit <= 0) { p.emit += .035; p.spin = (p.spin || 0) + 2.4; spawnProj({ x: p.x, y: p.y, ang: p.spin, speed: 8, life: .5, kind: 'shard', team: 'p', el: 'cold', dmg: p.shardDmg, r: .22, chill: 4 }); } }
    let dead = false; const steps = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * dt / .2));
    for (let s = 0; s < steps && !dead; s++) {
      p.x += p.vx * dt / steps; p.y += p.vy * dt / steps;
      if (A.b(Math.floor(p.x), Math.floor(p.y)) === B_SOLID) { dead = true; break; }
      if (p.team === 'p') {
        if (!p.dmg) continue;
        for (const m of A.monsters) {
          if (m.dead || p.hit.has(m) || Math.abs(m.x - p.x) > 1.5 || Math.abs(m.y - p.y) > 1.5) continue;
          if (dist(m.x, m.y, p.x, p.y) < m.r + p.r) {
            p.hit.add(m); projHit(p, m);
            if (!p.pierce) { dead = true; break; }
          }
        }
      } else if (!G.dead && dist(P.x, P.y, p.x, p.y) < P.r + p.r) {
        hurtPlayer(rand(p.dmg[0], p.dmg[1]), p.el, p.src); if (p.kind === 'sfire') fxBoom(p.x, p.y, .6, '255,140,40'); dead = true;
      }
    }
    if (p.t >= p.life) dead = true;
    if (dead) { projEnd(p); G.projs.splice(i, 1); }
  }
}
function projHit(p, m) {
  if (p.explode) return;   // area missiles deal damage in projEnd
  hurtMonster(m, rand(p.dmg[0], p.dmg[1]), p.el, { chill: p.chill, freeze: p.freeze });
  if (p.el === 'fire') for (let k = 0; k < 4; k++) fxSpark(m.x, m.y, '255,150,50', rand(1, 3), .3);
  if (p.el === 'cold') for (let k = 0; k < 4; k++) fxSpark(m.x, m.y, '180,220,255', rand(1, 3), .3);
  if (p.el === 'light') fxRing(m.x, m.y, '200,220,255', .5, .15);
  if (p.el === 'phys') fxBlood(m.x, m.y);
}
function projEnd(p) {
  if (p.explode) {
    fxBoom(p.x, p.y, p.explode, p.el === 'cold' ? '170,210,255' : '255,140,40'); sfx(p.el === 'cold' ? 'shatter' : 'boom');
    for (const m of G.area.monsters) if (!m.dead && dist(m.x, m.y, p.x, p.y) < p.explode + m.r) hurtMonster(m, rand(p.dmg[0], p.dmg[1]), p.el, { freeze: p.freeze, chill: p.chill });
  }
  if (p.kind === 'orb') { for (let k = 0; k < 18; k++) spawnProj({ x: p.x, y: p.y, ang: k / 18 * TAU, speed: 9, life: .5, kind: 'shard', team: 'p', el: 'cold', dmg: p.shardDmg, r: .22, chill: 4 }); sfx('shatter'); }
}

/* ---------- Ground effects: fire wall, blaze, meteor, blizzard ---------- */
function updateGrounds(dt) {
  const A = G.area;
  for (let i = G.grounds.length - 1; i >= 0; i--) {
    const g = G.grounds[i]; g.t += dt;
    if (g.k === 'fire') {
      // a burning segment (x0,y0)-(x1,y1) or a patch (x0==x1)
      for (const m of A.monsters) {
        if (m.dead) continue; const d = segDist(m.x, m.y, g.x0, g.y0, g.x1, g.y1);
        if (d < g.w + m.r) hurtMonster(m, g.dps * dt, 'fire', {});
      }
    } else if (g.k === 'meteor' && !g.done && g.t >= g.delay) {
      g.done = true; fxBoom(g.x, g.y, 2.2, '255,120,30'); sfx('boom'); G.shake = .25;
      for (const m of A.monsters) if (!m.dead && dist(m.x, m.y, g.x, g.y) < 2 + m.r) hurtMonster(m, rand(g.dmg[0], g.dmg[1]), 'fire');
      G.grounds.push({ k: 'fire', x0: g.x, y0: g.y, x1: g.x, y1: g.y, w: 1.7, dps: g.burn, t: 0, life: 3, patch: 1 });
    } else if (g.k === 'blizzard') {
      g.emit = (g.emit || 0) - dt;
      while (g.emit <= 0 && g.t < g.life - .5) {
        g.emit += .07; const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * g.r;
        g.shards.push({ x: g.x + Math.cos(a) * r, y: g.y + Math.sin(a) * r, t: 0 });
      }
      for (let k = g.shards.length - 1; k >= 0; k--) {
        const s = g.shards[k]; s.t += dt;
        if (s.t >= .45) { g.shards.splice(k, 1); fxRing(s.x, s.y, '170,210,255', .5, .2); for (const m of A.monsters) if (!m.dead && dist(m.x, m.y, s.x, s.y) < .75 + m.r) hurtMonster(m, rand(g.dmg[0], g.dmg[1]) * .3, 'cold', { chill: 4 }); }
      }
      if (Math.random() < dt * 4) sfx('ice');
    }
    if (g.t >= g.life) G.grounds.splice(i, 1);
  }
}
function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy; let t = L2 ? ((px - x0) * dx + (py - y0) * dy) / L2 : 0; t = clamp(t, 0, 1);
  return dist(px, py, x0 + dx * t, y0 + dy * t);
}

/* ---------- Casting ---------- */
function nearestMonster(x, y, maxD, filter) {
  let best = null, bd = maxD;
  for (const m of G.area.monsters) { if (m.dead || (filter && !filter(m))) continue; const d = dist(x, y, m.x, m.y); if (d < bd) { bd = d; best = m; } }
  return best;
}
function castTime() { return P.castFrames / 25 + .02; }
// Try to cast `id` toward (tx,ty). Returns true if the cast happened.
function cast(id, tx, ty, target) {
  if (G.dead || P.castT > 0 || P.hitT > 0) return false;
  const s = SKILLS[id]; if (!s) return false;
  if (id !== 'attack' && !skLvl(id)) return false;
  if (inTown() && id !== 'teleport') { if (!P.townMsg) { msg('You cannot cast spells in town.', '#c9a24a'); P.townMsg = 2; } return false; }
  if (P.cds[id] > 0) return false;
  const cost = id === 'attack' ? 0 : skMana(id);
  if (P.mana < cost) { if (!P.noManaT) { sfx('nomana'); msg('Not enough mana.', '#7f86ff'); P.noManaT = 1.2; } return false; }
  P.mana -= cost;
  const L = skLvl(id), ang = Math.atan2(ty - P.y, tx - P.x);
  if (s.aim !== 'self') P.ang = ang;
  P.anim = id === 'attack' ? 'attack' : 'cast'; P.animT = 0;
  P.castDur = s.channel ? .14 : id === 'attack' ? .55 : castTime(); P.castT = P.castDur;
  P.castCol = s.el === 'fire' ? '255,150,60' : s.el === 'cold' ? '150,200,255' : s.el === 'light' ? '220,230,255' : '220,200,180';
  if (s.cd) P.cds[id] = s.cd;
  const hx = P.x + Math.cos(ang) * .5, hy = P.y + Math.sin(ang) * .5;
  switch (id) {
    case 'attack': P.swing = { target, t: .22 }; sfx('swing'); break;
    case 'firebolt': spawnProj({ x: hx, y: hy, ang, speed: 12, life: 1.2, kind: 'fbolt', team: 'p', el: 'fire', dmg: skDmg(id) }); sfx('fire'); break;
    case 'icebolt': spawnProj({ x: hx, y: hy, ang, speed: 11, life: 1.2, kind: 'ibolt', team: 'p', el: 'cold', dmg: skDmg(id), chill: s.chill(L) }); sfx('ice'); break;
    case 'chargedbolt': { const n = s.n(L); for (let i = 0; i < n; i++) spawnProj({ x: hx, y: hy, ang: ang + rand(-.6, .6), speed: rand(5.5, 8), life: 1.4, kind: 'cbolt', team: 'p', el: 'light', dmg: skDmg(id), wander: 1 }); sfx('zap'); break; }
    case 'inferno': { const rng = s.range(L); for (let i = 0; i < 2; i++) spawnProj({ x: hx, y: hy, ang: ang + rand(-.12, .12), speed: 9, life: rng / 9, kind: 'flame', team: 'p', el: 'fire', dmg: skDmg(id), pierce: true, r: .45 }); if (Math.random() < .3) sfx('fire'); break; }
    case 'fireball': spawnProj({ x: hx, y: hy, ang, speed: 10.5, life: 1.4, kind: 'fball', team: 'p', el: 'fire', dmg: skDmg(id), explode: 1.6, r: .3 }); sfx('fireball'); break;
    case 'iceblast': spawnProj({ x: hx, y: hy, ang, speed: 11, life: 1.3, kind: 'iblast', team: 'p', el: 'cold', dmg: skDmg(id), freeze: s.freeze(L), r: .3 }); sfx('ice'); break;
    case 'glacialspike': spawnProj({ x: hx, y: hy, ang, speed: 10, life: 1.4, kind: 'gspike', team: 'p', el: 'cold', dmg: skDmg(id), explode: 1.5, freeze: s.freeze(L), r: .3 }); sfx('ice'); break;
    case 'frozenorb': { const dm = skDmg(id); spawnProj({ x: hx, y: hy, ang, speed: 4.6, life: 1.7, kind: 'orb', team: 'p', el: 'cold', dmg: null, pierce: true, shardDmg: [dm[0] * .45, dm[1] * .45], r: .3 }); sfx('nova'); break; }
    case 'blaze': P.buffs.blaze = { t: s.dur(L) }; P.lastBlaze = [P.x, P.y]; sfx('fire'); break;
    case 'firewall': {
      const len = s.len(L) / 2, dx = -Math.sin(ang), dy = Math.cos(ang), d = skDmg(id);
      G.grounds.push({ k: 'fire', x0: tx - dx * len, y0: ty - dy * len, x1: tx + dx * len, y1: ty + dy * len, w: .45, dps: (d[0] + d[1]) / 2, t: 0, life: 3.6 }); sfx('fireball'); break;
    }
    case 'meteor': G.grounds.push({ k: 'meteor', x: tx, y: ty, t: 0, delay: 1, life: 1.05, dmg: skDmg(id), burn: s.burn(L) }); sfx('fire'); break;
    case 'blizzard': G.grounds.push({ k: 'blizzard', x: tx, y: ty, r: 2.6, t: 0, life: 4, dmg: skDmg(id), shards: [] }); sfx('nova'); break;
    case 'frozenarmor': P.buffs.frozenarmor = { t: s.dur(L) }; recalc(); sfx('buff'); fxRing(P.x, P.y, '170,210,255', 1.4, .5); break;
    case 'energyshield': P.buffs.energyshield = { t: s.dur(L) }; sfx('buff'); fxRing(P.x, P.y, '120,170,255', 1.4, .5); break;
    case 'thunderstorm': P.buffs.thunderstorm = { t: s.dur(L), next: 1 }; sfx('thunder'); break;
    case 'frostnova': case 'nova': {
      const el = s.el, d = skDmg(id), R = 4.5;
      G.fx.push({ k: 'nova', x: P.x, y: P.y, r: R, c: el === 'cold' ? '170,210,255' : '200,210,255', life: .4, t: 0, el });
      for (const m of G.area.monsters) if (!m.dead && dist(m.x, m.y, P.x, P.y) < R + m.r && los(G.area, P.x, P.y, m.x, m.y)) hurtMonster(m, rand(d[0], d[1]), el, { chill: el === 'cold' ? s.chill(L) : 0 });
      sfx(el === 'cold' ? 'nova' : 'zap'); break;
    }
    case 'staticfield': {
      const R = s.rad(L), floor = [0, .33, .5][G.diff];
      G.fx.push({ k: 'nova', x: P.x, y: P.y, r: R, c: '230,230,255', life: .35, t: 0, el: 'static' });
      for (const m of G.area.monsters) if (!m.dead && dist(m.x, m.y, P.x, P.y) < R + m.r) { const cut = Math.min(m.hp * .25, m.hp - m.maxHp * floor); if (cut > 0) hurtMonster(m, cut, 'static'); }
      sfx('zap'); break;
    }
    case 'lightning': {
      let ex = P.x, ey = P.y; const step = .25;
      for (let d = 0; d < 14; d += step) { const nx = P.x + Math.cos(ang) * d, ny = P.y + Math.sin(ang) * d; if (G.area.b(Math.floor(nx), Math.floor(ny)) === B_SOLID) break; ex = nx; ey = ny; }
      const dm = skDmg(id); for (const m of G.area.monsters) if (!m.dead && segDist(m.x, m.y, P.x, P.y, ex, ey) < .6 + m.r) hurtMonster(m, rand(dm[0], dm[1]), 'light');
      fxBolt([[hx, hy], [ex, ey]], '200,220,255', .25, 3); sfx('zap'); sfx('thunder'); break;
    }
    case 'chainlightning': {
      const dm = skDmg(id), hits = new Set(); let from = [hx, hy];
      let cur = target && !target.dead ? target : nearestMonster(tx, ty, 6) || nearestMonster(P.x, P.y, 12, m => Math.abs(angDiff(Math.atan2(m.y - P.y, m.x - P.x), ang)) < .7);
      if (!cur) { fxBolt([from, [P.x + Math.cos(ang) * 8, P.y + Math.sin(ang) * 8]], '200,220,255', .2, 2); sfx('zap'); break; }
      for (let j = 0; j < s.n(L) && cur; j++) {
        hits.add(cur); fxBolt([from, [cur.x, cur.y]], '200,220,255', .3, 2.5); hurtMonster(cur, rand(dm[0], dm[1]), 'light');
        from = [cur.x, cur.y]; cur = nearestMonster(cur.x, cur.y, 6, m => !hits.has(m));
      }
      sfx('zap'); break;
    }
    case 'teleport': {
      let d = Math.min(12, dist(P.x, P.y, tx, ty)), nx = P.x + Math.cos(ang) * d, ny = P.y + Math.sin(ang) * d, ok = false;
      for (let k = 0; k < 30 && !ok; k++) { if (circleFree(G.area, nx, ny, P.r) && G.area.walkable(nx, ny)) ok = true; else { d -= .5; nx = P.x + Math.cos(ang) * d; ny = P.y + Math.sin(ang) * d; if (d <= 0) break; } }
      if (ok) { for (let k = 0; k < 12; k++) fxSpark(P.x, P.y, '150,180,255', rand(1, 3), .5, 30); P.x = nx; P.y = ny; P.path = null; P.order = null; fxRing(P.x, P.y, '150,180,255', 1.2, .35); sfx('tele'); revealAround(G.area, P.x, P.y, 14); }
      else P.mana += cost;
      break;
    }
  }
  return true;
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
function meleeHit(m) {
  if (!m || m.dead) return;
  if (dist(P.x, P.y, m.x, m.y) > 1.3 + m.r) return;
  const chanceHit = clamp(2 * P.ar / (P.ar + m.def) * P.level / (P.level + m.lvl), .05, .95);
  if (Math.random() > chanceHit) { fxRing(m.x, m.y, '200,200,200', .4, .15); return; }
  const dmg = rand(P.wdmg[0], P.wdmg[1] + .999) * (1 + P.str / 100);
  hurtMonster(m, dmg, 'phys'); sfx('hit'); fxBlood(m.x, m.y);
}

/* ---------- Player update ---------- */
function updatePlayer(dt) {
  if (P.dead) { P.deadT += dt; return; }
  P.townMsg = Math.max(0, (P.townMsg || 0) - dt); P.noManaT = Math.max(0, (P.noManaT || 0) - dt);
  for (const k in P.cds) P.cds[k] -= dt;
  // regeneration
  const warm = skLvl('warmth') ? SKILLS.warmth.val(skLvl('warmth')) : 0;
  P.mana = Math.min(P.maxMana, P.mana + P.maxMana / 120 * (1 + (warm + P.bonus.regen) / 100) * dt);
  if (P.bonus.rep) P.life = Math.min(P.maxLife, P.life + P.bonus.rep * .5 * dt);
  for (let i = P.heals.length - 1; i >= 0; i--) { const h = P.heals[i], a = Math.min(dt, h.t); h.t -= dt; if (h.k === 'life') P.life = Math.min(P.maxLife, P.life + h.per * a); else P.mana = Math.min(P.maxMana, P.mana + h.per * a); if (h.t <= 0) P.heals.splice(i, 1); }
  // buffs
  for (const k in P.buffs) { const b = P.buffs[k]; b.t -= dt; if (b.t <= 0) { delete P.buffs[k]; if (k === 'frozenarmor') recalc(); } }
  if (P.buffs.thunderstorm && (P.buffs.thunderstorm.next -= dt) <= 0) {
    P.buffs.thunderstorm.next = 1.7; const m = nearestMonster(P.x, P.y, 8);
    if (m) { const d = skDmg('thunderstorm'); fxBolt([[m.x - 1.5, m.y - 1.5, 260], [m.x, m.y]], '230,235,255', .35, 4); hurtMonster(m, rand(d[0], d[1]), 'light'); sfx('thunder'); G.shake = .12; }
  }
  if (P.chillT > 0) P.chillT -= dt;
  // casting / recovery
  if (P.hitT > 0) { P.hitT -= dt; P.animT += dt / .25; if (P.hitT <= 0) P.anim = 'idle'; return; }
  if (P.castT > 0) {
    P.castT -= dt; P.animT = 1 - P.castT / P.castDur;
    if (P.swing && (P.swing.t -= dt) <= 0) { meleeHit(P.swing.target); P.swing = null; }
    if (P.castT <= 0) { P.anim = 'idle'; P.castT = 0; }
    return;
  }
  // held skill buttons repeat
  if (P.held) { const h = P.held; const tgt = h.resolve(); if (tgt) { if (tryUseSkill(h.skill, tgt.x, tgt.y, tgt.m, true)) return; } }
  let mvx = 0, mvy = 0;
  if (P.joy) { mvx = P.joy.x; mvy = P.joy.y; P.order = null; P.path = null; }
  else if (P.order) { const v = followOrder(dt); if (v) { mvx = v[0]; mvy = v[1]; } }
  const spd = P.speed * (P.chillT > 0 ? .6 : 1);
  if (mvx || mvy) {
    const L = Math.hypot(mvx, mvy), k = Math.min(1, L);
    const ox = P.x, oy = P.y;
    moveCircle(G.area, P, mvx / L * spd * k * dt, mvy / L * spd * k * dt);
    const moved = dist(ox, oy, P.x, P.y);
    P.ang = Math.atan2(mvy, mvx); P.anim = 'run'; P.walkPh += moved * 2.4;
    if (moved < .001 && P.order) { P.stuck = (P.stuck || 0) + dt; if (P.stuck > .4) { P.path = null; P.stuck = 0; } }
    if (P.buffs.blaze && P.lastBlaze && dist(P.x, P.y, P.lastBlaze[0], P.lastBlaze[1]) > .5) {
      const d = skDmg('blaze'); G.grounds.push({ k: 'fire', x0: P.x, y0: P.y, x1: P.x, y1: P.y, w: .5, dps: (d[0] + d[1]) / 2, t: 0, life: 2.2, patch: 1 }); P.lastBlaze = [P.x, P.y];
    }
    if ((P.revealT = (P.revealT || 0) - dt) <= 0) { P.revealT = .25; revealAround(G.area, P.x, P.y, 13); }
  } else if (P.anim === 'run') P.anim = 'idle';
  // auto-pickup gold and potions you walk over
  for (const gi of G.area.items) { const k = BASES[gi.item.base].kind; if ((k === 'gold') && dist(gi.x, gi.y, P.x, P.y) < .6) { pickup(gi); break; } }
  // triggers (cave entrances)
  for (const t of G.area.triggers) if (dist(P.x, P.y, t.x, t.y) < t.r && (!P.order || P.order.type !== 'npc')) { useTrigger(t); break; }
  if (G.portal && P.order && P.order.type === 'portal' && dist(P.x, P.y, P.order.x, P.order.y) < .6) { const side = P.order.side; P.order = null; usePortal(side); }
}
// Both ends of the open portal: the field end and the camp end
function portalEnds() {
  if (!G.portal) return [];
  const s = G.areas.moor.portalSpot;
  return [{ area: G.portal.area, x: G.portal.x, y: G.portal.y, side: 'field' }, { area: 'moor', x: s[0], y: s[1], side: 'town' }];
}
function followOrder(dt) {
  const o = P.order, A = G.area;
  let gx, gy, reach = .2;
  if (o.type === 'move') { gx = o.x; gy = o.y; }
  else if (o.type === 'attack') {
    const m = o.m; if (!m || m.dead) { P.order = null; return null; }
    gx = m.x; gy = m.y;
    const s = SKILLS[o.skill], ranged = o.skill !== 'attack';
    const d = dist(P.x, P.y, m.x, m.y);
    if (ranged ? (d < 13 && los(A, P.x, P.y, m.x, m.y)) : d < 1.1 + m.r) { tryUseSkill(o.skill, m.x, m.y, m); if (!o.repeat) P.order = null; return null; }
    void s;
  }
  else if (o.type === 'pickup') { gx = o.gi.x; gy = o.gi.y; if (dist(P.x, P.y, gx, gy) < .9) { if (A.items.includes(o.gi)) pickup(o.gi); P.order = null; return null; } }
  else if (o.type === 'npc') { gx = o.n.x; gy = o.n.y; if (dist(P.x, P.y, gx, gy) < 1.5) { P.order = null; openNpc(o.n); return null; } }
  else if (o.type === 'obj') { gx = o.o.x; gy = o.o.y; if (dist(P.x, P.y, gx, gy) < 1.5) { P.order = null; if (o.o.interact === 'stash') openStash(); else if (o.o.text) msg(o.o.text, '#c9a24a'); return null; } }
  else if (o.type === 'portal') { gx = o.x; gy = o.y; reach = .3; }
  else if (o.type === 'trigger') { gx = o.t.x; gy = o.t.y; reach = .1; }
  if (o.type === 'move' && dist(P.x, P.y, gx, gy) < reach) { P.order = null; return null; }
  // path following: straight if clear, A* otherwise
  P.pathT -= dt;
  if (!P.path || P.pathT <= 0 || (P.pathGoal && dist(P.pathGoal[0], P.pathGoal[1], gx, gy) > 1.2)) {
    P.pathGoal = [gx, gy]; P.pathT = .6;
    P.path = walkLine(A, P.x, P.y, gx, gy) ? [[gx, gy]] : findPath(A, P.x, P.y, gx, gy) || [[gx, gy]];
  }
  while (P.path.length && dist(P.x, P.y, P.path[0][0], P.path[0][1]) < .25) P.path.shift();
  if (!P.path.length) { if (o.type === 'move') P.order = null; return null; }
  const [wx, wy] = P.path[0]; return [wx - P.x, wy - P.y];
}
// Use a skill toward a point; walks into range for melee
function tryUseSkill(id, tx, ty, m, fromHeld) {
  const s = SKILLS[id]; if (!s) return false;
  if (s.aim === 'passive') return false;
  if (id === 'attack') {
    if (!m) { if (!fromHeld) P.order = { type: 'move', x: tx, y: ty }; return false; }
    if (dist(P.x, P.y, m.x, m.y) <= 1.1 + m.r) return cast('attack', m.x, m.y, m);
    P.order = { type: 'attack', m, skill: 'attack' }; return false;
  }
  return cast(id, tx, ty, m);
}
function useTrigger(t) {
  if (t.to === 'den') {
    if (!P.quest.den) { P.quest.den = 1; }
    const D = G.areas.den; enterArea('den', D.entry[0] + 1.5, D.entry[1] + 1.5); msg('Den of Evil', '#c9a24a');
  } else if (t.to === 'moor') { const A = G.areas.moor; enterArea('moor', A.denEntry[0] + .5, A.denEntry[1] + 2.4); msg('Blood Moor', '#c9a24a'); }
}
function castTownPortal() {
  if (G.dead || P.castT > 0) return;
  if (inTown()) { msg('You are already in town.', '#c9a24a'); return; }
  if (P.tp <= 0) { msg('Your Tome of Town Portal is empty. Akara sells scrolls.', '#d05050'); sfx('nomana'); return; }
  P.tp--; P.anim = 'cast'; P.animT = 0; P.castDur = P.castT = castTime(); P.castCol = '120,160,255';
  const a = P.ang, x = P.x + Math.cos(a) * 1.2, y = P.y + Math.sin(a) * 1.2;
  G.portal = { area: G.area.id, x: circleFree(G.area, x, y, .3) ? x : P.x, y: circleFree(G.area, x, y, .3) ? y : P.y + .01, t: 0 };
  sfx('portal'); refreshHUD();
}
function usePortal(side) {
  if (!G.portal) return;
  const M = G.areas.moor, pt = G.portal;
  if (side === 'town') enterArea(pt.area, pt.x + .7, pt.y + .7);
  else enterArea('moor', M.portalSpot[0] + .7, M.portalSpot[1] + .7);
  sfx('portal');
}

/* ---------- Monster AI ---------- */
function updateMonsters(dt) {
  const A = G.area;
  for (const m of A.monsters) {
    if (m.dead) { m.deadT += dt; continue; }
    const dP = dist(m.x, m.y, P.x, P.y);
    if (dP > 32 && m.state === 'idle') continue;
    if (m.flash > 0) m.flash -= dt;
    if (m.freeze > 0) { m.freeze -= dt; continue; }
    const slow = m.chill > 0 ? .5 : 1; if (m.chill > 0) m.chill -= dt;
    m.cd -= dt * slow; m.rezCd -= dt;
    if (m.hitT > 0) { m.hitT -= dt; m.animT += dt * 4; if (m.hitT <= 0) m.anim = 'idle'; continue; }
    if (m.anim === 'attack' || m.anim === 'cast') {
      m.animT += dt * slow / (m.d.melee ? .7 : .8);
      if (!m.atkFired && m.animT >= .55) { m.atkFired = true; monsterStrike(m); }
      if (m.animT >= 1) { m.anim = 'idle'; m.animT = 0; }
      continue;
    }
    if (G.dead) { m.state = 'idle'; }
    // awareness
    if (m.state === 'idle' && !G.dead && !inTown()) {
      if ((dP < 9 && los(A, m.x, m.y, P.x, P.y)) || (m.leader && m.leader.state === 'chase')) m.state = 'chase';
    }
    if (m.state === 'chase' && inTown()) m.state = 'idle';
    let mv = null;
    if (m.state === 'idle') {
      m.wanderT -= dt;
      if (m.wanderT <= 0) { m.wanderT = rand(2, 5); const a = Math.random() * TAU, r = Math.random() * 3; m.wander = [m.sx + Math.cos(a) * r, m.sy + Math.sin(a) * r]; }
      if (m.wander && dist(m.x, m.y, m.wander[0], m.wander[1]) > .3) mv = [m.wander[0] - m.x, m.wander[1] - m.y, .35];
    } else if (m.state === 'flee') {
      m.fleeT -= dt; if (m.fleeT <= 0) m.state = 'chase';
      mv = [m.x - P.x, m.y - P.y, 1];
    } else if (m.state === 'chase') {
      if (dP > 26) { m.state = 'idle'; continue; }
      // shamans raise fallen corpses
      if (m.d.rez && m.rezCd <= 0) {
        const c = A.monsters.find(o => o.dead && o.type === 'fallen' && o.deadT > 1 && dist(o.x, o.y, m.x, m.y) < 6);
        if (c) { m.rezCd = 4; m.anim = 'cast'; m.animT = 0; m.atkFired = true; m.ang = Math.atan2(c.y - m.y, c.x - m.x); setTimeout(() => reviveMonster(c), 450); sfx('rez'); continue; }
      }
      const see = dP < 14 && los(A, m.x, m.y, P.x, P.y);
      if (m.d.melee) {
        if (dP < m.d.range + P.r + m.r * .5) {
          m.ang = Math.atan2(P.y - m.y, P.x - m.x);
          if (m.cd <= 0) { m.anim = 'attack'; m.animT = 0; m.atkFired = false; m.cd = m.atkCd; }
          else m.anim = 'idle';
          continue;
        }
        mv = pathToward(m, dt, see);
      } else {
        if (see && dP < m.d.range) {
          if (dP < (m.d.keep || 0) - .5) mv = [m.x - P.x, m.y - P.y, .8];
          else if (m.cd <= 0) { m.ang = Math.atan2(P.y - m.y, P.x - m.x); m.anim = 'attack'; m.animT = 0; m.atkFired = false; m.cd = m.atkCd * rand(.8, 1.3); continue; }
          else { m.anim = 'idle'; m.ang = Math.atan2(P.y - m.y, P.x - m.x); }
        } else mv = pathToward(m, dt, see);
      }
    }
    if (mv) {
      const L = Math.hypot(mv[0], mv[1]) || 1, sp = m.speed * slow * (mv[2] || 1), ox = m.x, oy = m.y;
      moveCircle(A, m, mv[0] / L * sp * dt, mv[1] / L * sp * dt);
      const moved = dist(ox, oy, m.x, m.y); m.walkPh += moved * (m.type === 'quillrat' ? 4 : 2.4) / m.scale;
      m.anim = moved > .001 ? 'walk' : 'idle'; if (moved > .001) m.ang = Math.atan2(mv[1], mv[0]);
      if (moved < .001) m.path = null;
    } else if (m.anim === 'walk') m.anim = 'idle';
  }
  // keep monsters from stacking on each other and on the player
  const ms = A.monsters;
  for (let i = 0; i < ms.length; i++) {
    const a = ms[i]; if (a.dead || Math.abs(a.x - P.x) > 20 || Math.abs(a.y - P.y) > 20) continue;
    for (let j = i + 1; j < ms.length; j++) {
      const b = ms[j]; if (b.dead) continue; const dx = b.x - a.x, dy = b.y - a.y; if (Math.abs(dx) > 1.2 || Math.abs(dy) > 1.2) continue;
      const d = Math.hypot(dx, dy) || .01, min = a.r + b.r;
      if (d < min) { const push = (min - d) / 2; moveCircle(A, a, -dx / d * push, -dy / d * push); moveCircle(A, b, dx / d * push, dy / d * push); }
    }
    if (!G.dead) { const dx = P.x - a.x, dy = P.y - a.y, d = Math.hypot(dx, dy) || .01, min = a.r + P.r; if (d < min) moveCircle(A, a, -dx / d * (min - d), -dy / d * (min - d)); }
  }
}
function pathToward(m, dt, see) {
  const A = G.area;
  if (see && walkLine(A, m.x, m.y, P.x, P.y)) { m.path = null; return [P.x - m.x, P.y - m.y, 1]; }
  m.pathT -= dt;
  if (!m.path || m.pathT <= 0) { m.pathT = rand(.6, 1.1); m.path = findPath(A, m.x, m.y, P.x, P.y, 500); }
  if (!m.path) return [P.x - m.x, P.y - m.y, 1];
  while (m.path.length && dist(m.x, m.y, m.path[0][0], m.path[0][1]) < .3) m.path.shift();
  if (!m.path.length) { m.path = null; return [P.x - m.x, P.y - m.y, 1]; }
  return [m.path[0][0] - m.x, m.path[0][1] - m.y, 1];
}
function monsterStrike(m) {
  if (G.dead) return;
  if (m.d.melee) {
    if (dist(m.x, m.y, P.x, P.y) > m.d.range + P.r + m.r * .5 + .45) return;
    const hit = clamp(1.7 * m.ar / (m.ar + P.def) * m.lvl / (m.lvl + P.level), .05, .9);
    if (Math.random() > hit) return;
    hurtPlayer(rand(m.dmg[0], m.dmg[1]), 'phys', m); fxBlood(P.x, P.y, 4);
    if (m.addEl) hurtPlayer(rand(m.dmg[0], m.dmg[1]) * .5, m.addEl);
  } else {
    const a = Math.atan2(P.y - m.y, P.x - m.x);
    if (m.d.proj === 'quill') { spawnProj({ x: m.x, y: m.y, ang: a + rand(-.08, .08), speed: 8, life: 1, kind: 'quill', team: 'm', el: 'phys', dmg: m.dmg, src: m, r: .2 }); sfx('quill'); }
    else { spawnProj({ x: m.x, y: m.y, ang: a, speed: 6.5, life: 1.6, kind: 'sfire', team: 'm', el: 'fire', dmg: m.dmg, src: m, r: .25 }); sfx('fire'); }
  }
}
function reviveMonster(c) {
  if (!c.dead) return;
  c.dead = false; c.hp = c.maxHp; c.anim = 'idle'; c.state = 'chase'; c.rezzed = true; c.deadT = 0;
  fxRing(c.x, c.y, '255,120,60', 1, .5);
}

/* ---------- Banners ---------- */
function banner(title, sub) { if (typeof showBanner === 'function') showBanner(title, sub); }
