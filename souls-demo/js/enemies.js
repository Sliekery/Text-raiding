/* Enemies, AI, bosses (Taurus Demon, Bell Gargoyles), the bridge drake and scripted traps. */
'use strict';
/* attack definitions: wind/act/rec in seconds, dmg in DS1-ish numbers, pd = poise damage, kd = knockdown */
const EATK = {
  slash: { wind: .55, act: .16, rec: .6, dmg: 120, range: 1.9, arc: 1.0, lunge: 1.1, w: 'l1w', s: 'l1s', pd: 30, parry: true },
  slash2: { wind: .34, act: .16, rec: .7, dmg: 110, range: 1.9, arc: 1.0, lunge: 1.0, w: 'l2w', s: 'l2s', pd: 30, parry: true },
  chop: { wind: .7, act: .16, rec: .7, dmg: 150, range: 2.0, arc: .7, lunge: 1.0, w: 'hw', s: 'hs', pd: 40, parry: true },
  flurry: { wind: .22, act: .12, rec: .3, dmg: 70, range: 1.8, arc: 1.0, lunge: .6, w: 'l1w', s: 'l2s', pd: 15, parry: true },
  poke: { wind: .55, act: .2, rec: .55, dmg: 140, range: 2.7, arc: .45, lunge: 1.2, w: 'tw', s: 'ts', pd: 30, parry: true },
  poke2: { wind: .3, act: .2, rec: .65, dmg: 120, range: 2.7, arc: .45, lunge: .9, w: 'tw', s: 'ts', pd: 25, parry: true },
  pokeLunge: { wind: .6, act: .3, rec: .8, dmg: 170, range: 2.8, arc: .45, lunge: 4.5, w: 'tw', s: 'ts', pd: 40, parry: true },
  bkSlash: { wind: .5, act: .18, rec: .55, dmg: 400, range: 2.5, arc: 1.2, lunge: 1.5, w: 'l1w', s: 'l1s', pd: 60, parry: true },
  bkSlash2: { wind: .32, act: .18, rec: .8, dmg: 380, range: 2.5, arc: 1.2, lunge: 1.3, w: 'l2w', s: 'l2s', pd: 60, parry: true },
  bkStab: { wind: .7, act: .25, rec: .9, dmg: 450, range: 2.7, arc: .4, lunge: 5.0, w: 'tw', s: 'ts', pd: 70, parry: true },
  bkSlam: { wind: .95, act: .18, rec: 1.0, dmg: 500, range: 2.5, arc: .6, lunge: 1.2, w: 'hw', s: 'hs', pd: 90, kd: true, parry: false },
  bash: { wind: .35, act: .14, rec: .6, dmg: 80, range: 1.6, arc: .8, lunge: .8, w: 'parry', s: 'parry', pd: 60, unblock: true, parry: false },
  rapier: { wind: .35, act: .14, rec: .45, dmg: 200, range: 2.4, arc: .4, lunge: 1.4, w: 'tw', s: 'ts', pd: 30, parry: true },
  rapier2: { wind: .2, act: .14, rec: .55, dmg: 180, range: 2.4, arc: .4, lunge: 1.1, w: 'tw', s: 'ts', pd: 30, parry: true },
  mace: { wind: .8, act: .2, rec: .8, dmg: 320, range: 2.4, arc: .7, lunge: 1.0, w: 'hw', s: 'hs', pd: 80, kd: true, parry: true },
  maceSw: { wind: .6, act: .2, rec: .7, dmg: 280, range: 2.4, arc: 1.3, lunge: .8, w: 'l1w', s: 'l1s', pd: 60, parry: true },
  trident: { wind: .5, act: .2, rec: .6, dmg: 160, range: 2.6, arc: .5, lunge: 1.0, w: 'tw', s: 'ts', pd: 30, parry: true },
  tusk: { wind: .45, act: .2, rec: .6, dmg: 200, range: 2.2, arc: .9, lunge: .8, w: 'l1w', s: 'l1s', pd: 60, parry: false },
  charge: { wind: .9, act: 1.3, rec: 1.0, dmg: 260, range: 1.9, arc: .8, charge: 11, w: 'l1w', s: 'l1s', pd: 99, kd: true, parry: false },
  /* Taurus Demon */
  tSwing: { wind: .95, act: .2, rec: 1.3, dmg: 315, range: 4.3, arc: .55, lunge: 1.5, w: 'hw', s: 'hs', pd: 99, kd: true, delay: .35 },
  tSweep: { wind: .75, act: .25, rec: 1.0, dmg: 260, range: 4.5, arc: 1.5, lunge: 1.0, w: 'l1w', s: 'l1s', pd: 80 },
  tSweepR: { wind: .5, act: .25, rec: 1.1, dmg: 240, range: 4.5, arc: 1.5, lunge: .8, w: 'l2w', s: 'l2s', pd: 80 },
  tStab: { wind: .55, act: .3, rec: .9, dmg: 250, range: 4.2, arc: .35, lunge: 5.5, w: 'tw', s: 'ts', pd: 80 },
  tPound: { wind: .6, act: .15, rec: 1.0, dmg: 220, range: 3.0, arc: 3.2, lunge: 0, w: 'roar', s: 'hs', pd: 99, kd: true, wave: 4.5 },
  tLeap: { wind: 1.1, act: .18, rec: 1.3, dmg: 300, range: 3.5, arc: 3.2, leap: true, w: 'hw', s: 'hs', pd: 99, kd: true, wave: 5.5 },
  /* Bell Gargoyles */
  gSlash: { wind: .5, act: .2, rec: .5, dmg: 230, range: 3.4, arc: 1.3, lunge: 1.0, w: 'l1w', s: 'l1s', pd: 60 },
  gSlash2: { wind: .3, act: .2, rec: .5, dmg: 220, range: 3.4, arc: 1.3, lunge: .8, w: 'l2w', s: 'l2s', pd: 60 },
  gOver: { wind: .6, act: .18, rec: .9, dmg: 300, range: 3.4, arc: .5, lunge: 1.2, w: 'hw', s: 'hs', pd: 90, kd: true },
  gTail: { wind: .45, act: .35, rec: .7, dmg: 210, range: 3.2, arc: 3.2, tail: true, w: 'hurt', s: 'hurt', pd: 70 },
  gFire: { wind: .7, act: 1.6, rec: .8, dmg: 90, range: 7.5, arc: .45, breath: true, w: 'roar', s: 'roar', pd: 10, unblock: true, fire: true },
  gDive: { wind: 1.0, act: .25, rec: 1.0, dmg: 280, range: 2.4, arc: 3.2, dive: true, w: 'hw', s: 'ts', pd: 90, kd: true },
};
const ET = {
  hollow: { name: 'Hollow', hp: 53, souls: 20, r: .42, s: 1, def: .05, poise: 0, speed: 2.6, turn: 7, aggro: 11, hear: 4, leash: 24, keep: 1.3, strafe: .3, cd: [.5, 1.6], respawn: true, hum: 2 },
  hwarrior: { name: 'Hollow Warrior', hp: 150, souls: 30, r: .45, s: 1, def: .18, poise: 10, speed: 2.7, turn: 6.5, aggro: 12, hear: 4.5, leash: 24, keep: 1.4, strafe: .5, cd: [.6, 1.5], respawn: true, hum: 3, bounce: true },
  soldier: { name: 'Undead Soldier', hp: 85, souls: 50, r: .45, s: 1, def: .22, poise: 20, speed: 2.3, turn: 5, aggro: 12, hear: 4.5, leash: 22, keep: 2.2, strafe: .7, cd: [.8, 1.8], respawn: true, hum: 6, guarded: true, bounce: true, heals: true },
  crossbow: { name: 'Undead Crossbowman', hp: 85, souls: 50, r: .42, s: 1, def: .15, poise: 5, speed: 2.2, turn: 5, aggro: 22, hear: 5, leash: 14, keep: 9, strafe: 0, cd: [2.6, 3.4], respawn: true, hum: 6, ranged: 'bolt' },
  archer: { name: 'Hollow Archer', hp: 53, souls: 20, r: .42, s: 1, def: .05, poise: 0, speed: 2.3, turn: 6, aggro: 24, hear: 5, leash: 10, keep: 10, strafe: 0, cd: [2.0, 2.8], respawn: true, hum: 2, ranged: 'arrow' },
  bomber: { name: 'Firebomb Hollow', hp: 150, souls: 30, r: .45, s: 1, def: .15, poise: 5, speed: 2.4, turn: 6, aggro: 18, hear: 5, leash: 10, keep: 7, strafe: 0, cd: [2.0, 3.0], respawn: true, hum: 3, ranged: 'eFirebomb' },
  blackKnight: { name: 'Black Knight', hp: 497, souls: 800, r: .55, s: 1.15, def: .35, poise: 80, speed: 3.2, turn: 6, aggro: 13, hear: 5, leash: 26, keep: 2.6, strafe: .8, cd: [.4, 1.2], respawn: false, guarded: true, bounce: true, drop: ['titaniteShard', 2] },
  balder: { name: 'Balder Knight', hp: 151, souls: 200, r: .45, s: 1.05, def: .28, poise: 30, speed: 3.0, turn: 7, aggro: 12, hear: 5, leash: 22, keep: 2.2, strafe: .8, cd: [.5, 1.3], respawn: true, hum: 5, guarded: true, heals: true, stance: true, drop: ['titaniteShard', 1] },
  berenike: { name: 'Berenike Knight', hp: 420, souls: 500, r: .6, s: 1.25, def: .4, poise: 90, speed: 1.9, turn: 4, aggro: 12, hear: 5, leash: 18, keep: 2.2, strafe: .5, cd: [.8, 1.6], respawn: false, guarded: true, bounce: true, drop: ['titaniteShard', 1] },
  channeler: { name: 'Channeler', hp: 186, souls: 1000, r: .45, s: 1.05, def: .1, poise: 45, speed: 2.4, turn: 5, aggro: 18, hear: 6, leash: 14, keep: 7, strafe: 0, cd: [1.6, 2.6], respawn: false, ranged: 'eSoulArrow', buffer: true },
  boar: { name: 'Armored Tusk', hp: 600, souls: 750, r: .95, s: 1.6, def: .25, poise: 999, speed: 3.2, turn: 2.4, aggro: 16, hear: 7, leash: 30, keep: 2.5, strafe: 0, cd: [1.0, 2.0], respawn: false, armorFront: true, noCrit: true, quad: true },
  taurus: { name: 'Taurus Demon', hp: 1215, souls: 3000, r: 1.3, s: 2.5, def: .22, poise: 120, speed: 3.0, turn: 2.8, aggro: 0, hear: 0, leash: 999, keep: 3.4, strafe: .1, cd: [.3, 1.0], respawn: false, boss: true, noCrit: true, weakLightning: true, resFire: true, drop: ['humanity', 1] },
  gargoyle: { name: 'Bell Gargoyle', hp: 999, souls: 0, r: 1.0, s: 1.85, def: .25, poise: 80, speed: 3.0, turn: 3.6, aggro: 0, hear: 0, leash: 999, keep: 3.0, strafe: .25, cd: [.4, 1.1], respawn: false, boss: true, noCrit: true, weakLightning: true },
};
const enemies = [];
function enemyMats(list) { const ms = []; const mk = (tex, col, o) => { const m = mat(tex, col, o); ms.push(m); return m; }; return { mk, ms }; }
function makeEnemy(kind, x, y, z, yaw, o = {}) {
  const T = { ...ET[kind], ...(o.T || {}) }; const { mk, ms } = enemyMats(); let model, quadM = null;
  const hollowMats = (armored) => {
    const skin = mk(TX.skin, 0x7a6a56), wrap = mk(TX.cloth, 0x5a4c3c);
    return { pelvis: wrap, legs: armored ? mk(TX.chain, 0x7a7670) : skin, shins: wrap, feet: wrap, chest: armored ? mk(TX.leather, 0x6a5440) : skin, arms: armored ? mk(TX.chain, 0x7a7670) : skin, fore: skin, hands: skin, face: mk(TX.face, 0x9a8a76),
      skirt: mk(TX.tatter, 0x6a5640, { side: DS }), helm: mk(TX.plate, 0x8a7260), chain: mk(TX.chain, 0x8a8070), dark: mk(TX.white, 0x080604),
      grip: mk(TX.wood, 0x5a4030), guard: mk(TX.plate, 0x6a5a4a), blade: mk(TX.plate, 0xa08a76), shield: mk(TX.plank, 0x9a8068) };
  };
  if (kind === 'hollow' || kind === 'archer') model = rig({ s: 1, W: .82, head: 'hollow', helm: false, m: hollowMats(false), skirtH: .36, weapon: kind === 'archer' ? 'crossbow' : o.weapon || 'broken', bias: { tX: .3, hd: -.2 } });
  else if (kind === 'hwarrior' || kind === 'bomber') model = rig({ s: 1, W: .9, head: 'hollow', helm: true, m: hollowMats(true), skirtH: .4, weapon: kind === 'bomber' ? 'broken' : o.weapon || 'shortsword', shield: o.shield ? 'round' : null, bias: { tX: .22, hd: -.15 } });
  else if (kind === 'soldier' || kind === 'crossbow') { const m = hollowMats(true); m.shield = mk(TX.plate, 0x8a8478); model = rig({ s: 1, W: .95, head: 'hollow', helm: true, m, skirtH: .44, weapon: kind === 'crossbow' ? 'crossbow' : 'spear', shield: kind === 'crossbow' ? null : 'tower', bias: { tX: .15, hd: -.1 } }); }
  else if (kind === 'blackKnight') { const pl = mk(TX.plate, 0x2e2c30), ch = mk(TX.chain, 0x3a383c); model = rig({ s: 1.15, W: 1.1, head: 'great', horns: false, m: { pelvis: pl, legs: ch, shins: pl, feet: pl, chest: pl, arms: ch, fore: pl, hands: pl, pauldron: pl, helm: mk(TX.plate, 0x2a282e), dark: mk(TX.white, 0, { emissive: 0x8a2a08 }), skirt: mk(TX.tatter, 0x1a1816, { side: DS }), grip: mk(TX.wood, 0x1a1210), guard: pl, blade: mk(TX.plate, 0x6a686e), shield: mk(TX.plate, 0x3a383c) }, skirtH: .5, pauldron: 1.4, weapon: 'longsword', shield: 'heater', cape: mk(TX.tatter, 0x1a1816, { side: DS }) }); }
  else if (kind === 'balder') { const pl = mk(TX.plate, 0x9a9488), cl = mk(TX.cloth, 0x8a2a24); model = rig({ s: 1.05, W: 1, head: 'balder', m: { pelvis: cl, legs: cl, shins: pl, feet: pl, chest: pl, arms: cl, fore: pl, hands: pl, pauldron: pl, helm: mk(TX.plate, 0xa49e92), dark: mk(TX.white, 0x080604), skirt: mk(TX.tatter, 0x8a2a24, { side: DS }), grip: mk(TX.wood, 0x3a2418), guard: mk(TX.plate, 0xb09050), blade: mk(TX.plate, 0xd0d0d6), shield: mk(TX.crest, 0xc08070) }, skirtH: .42, pauldron: 1, weapon: 'rapier', shield: 'heater' }); }
  else if (kind === 'berenike') { const pl = mk(TX.plate, 0x6a6460); model = rig({ s: 1.25, W: 1.25, head: 'great', horns: false, m: { pelvis: pl, legs: pl, shins: pl, feet: pl, chest: pl, arms: pl, fore: pl, hands: pl, pauldron: pl, helm: pl, dark: mk(TX.white, 0x080604), skirt: mk(TX.chain, 0x5a5650, { side: DS }), grip: mk(TX.wood, 0x3a2418), guard: pl, blade: mk(TX.plate, 0x7a7670), shield: mk(TX.plate, 0x5a5650) }, skirtH: .45, pauldron: 1.6, weapon: 'club', shield: 'tower' }); }
  else if (kind === 'channeler') { const robe = mk(TX.tatter, 0x4a2a5a, { side: DS }); model = rig({ s: 1.05, W: .9, head: 'hood', m: { pelvis: robe, legs: robe, shins: robe, feet: robe, chest: mk(TX.cloth, 0x4a2a5a), arms: mk(TX.cloth, 0x3a2a4a), fore: mk(TX.skin, 0x8a7a66), hands: mk(TX.skin, 0x8a7a66), face: mk(TX.face, 0x7a6a56), helm: mk(TX.cloth, 0x3a1a4a), dark: mk(TX.white, 0x080604), grip: mk(TX.wood, 0x3a2418), blade: mk(TX.plate, 0x9a9aa0) }, robe, weapon: 'spear' }); }
  else if (kind === 'boar') { const hide = mk(TX.hide, 0x6a5a4a); quadM = quad({ s: T.s, mat: hide, len: 1.6, legH: .5, girth: .55, wide: 1.1, headW: .5, headL: .6, snout: true, tusks: mk(TX.cloth, 0xd8ccb0), armor: mk(TX.plate, 0x6a6460), headMat: mk(TX.plate, 0x7a746e), eyes: mk(TX.white, 0, { emissive: 0xff5020 }), legW: 1.6, tail: true }); model = quadM; }
  else if (kind === 'taurus') { const hide = mk(TX.hide, 0xb09480), hide2 = mk(TX.hide, 0x907866), hide3 = mk(TX.hide, 0xa08672); model = rig({ s: T.s, W: 1.35, torsoH: .62, up: .42, fore: .42, thigh: .36, shin: .36, depth: .85, head: 'demon', m: { pelvis: hide2, legs: hide3, shins: hide2, feet: mk(TX.hide, 0x4a3e36), chest: hide, arms: hide3, fore: hide, hands: hide2, head: hide, horn: mk(TX.cloth, 0xc0b090), eyes: mk(TX.white, 0, { emissive: 0xffa030 }), dark: mk(TX.white, 0x140c08), grip: mk(TX.wood, 0x3a2a20), blade: mk(TX.plate, 0x7a7068) }, belly: true, tail: true, weapon: 'greataxe', twoHand: true, bias: { tX: .25, hd: -.2 } }); }
  else if (kind === 'gargoyle') { const st = mk(TX.stoneSkin, 0xa8a8ae); model = rig({ s: T.s, W: 1.1, torsoH: .58, up: .36, fore: .36, thigh: .38, shin: .38, depth: .8, head: 'gargoyle', m: { pelvis: st, legs: st, shins: st, feet: st, chest: st, arms: st, fore: st, hands: st, head: mk(TX.stoneSkin, 0xb4b4ba), eyes: mk(TX.white, 0, { emissive: 0xff8030 }), dark: mk(TX.white, 0x101010), grip: mk(TX.plate, 0x5a5a5e), blade: mk(TX.plate, 0x8a8a90), shield: mk(TX.stoneSkin, 0x9a9aa0) }, wings: mk(TX.stoneSkin, 0x8a8a90, { side: DS }), tail: o.tail !== false, tailMat: st, tailBlade: o.tail !== false ? mk(TX.plate, 0x8a8a90) : null, weapon: 'halberd', shield: 'heater', bias: { tX: .2, hd: -.1 } }); }
  scene.add(model.root);
  const e = { kind, T, isBoss: !!T.boss, pos: new V3(x, y, z), yaw, home: { x, y, z, yaw }, r: T.r, h: 1.8 * T.s, hp: T.hp, alive: true, state: o.sit ? 'sit' : 'idle', st: 0, cd: 0, atk: null, seq: null, si: 0, model, mats: ms,
    pose: mkPose(), tgt: mkPose(), flash: 0, barT: 0, dmgAcc: 0, dmgT: 0, poiseDmg: 0, poiseT: 0, walkPh: rand(0, 6), lift: 0, phase2: false, sdir: 1, sdur: 1, stDur: .4, vy: 0, onGround: true, fallTop: y,
    shadow: blob(T.r * 1.25), guard: false, guardHp: 60, healed: false, aware: 0, seen: false, losT: 0, los: false, o, dropper: !!o.dropper, ambush: o.ambush || null, buffT: 0, active: true, gone: false };
  if (o.sit) copyPose(e.pose, POSE.sit);
  enemies.push(e); return e;
}
function resetEnemy(e) {
  if (!e.T.respawn && (!e.alive || e.gone)) return;
  if (e.isBoss) return;
  e.alive = true; e.gone = false; e.hp = e.T.hp; e.pos.set(e.home.x, e.home.y, e.home.z); e.yaw = e.home.yaw; e.state = e.o.sit ? 'sit' : 'idle'; e.st = 0; e.atk = null; e.cd = 0; e.lift = 0; e.poiseDmg = 0; e.barT = 0; e.dmgT = 0; e.sink = 0; e.healed = false; e.guard = false; e.seen = false; e.aware = 0; e.vy = 0; e.onGround = true;
  e.model.root.visible = true; e.shadow.visible = true; copyPose(e.pose, e.o.sit ? POSE.sit : IDLE);
}
function resetWorld() {
  enemies.forEach(resetEnemy);
  if (G.bossFight) endBossFight(false);
  barrel.used = false; projs.forEach(p => scene.remove(p.mesh)); projs.length = 0; waves.forEach(w => scene.remove(w.mesh)); waves.length = 0;
  breakables.forEach(b => { if (b.broken && b.respawn) { b.broken = false; b.sol.on = true; scene.add(b.mesh); } });
}

/* ---------------- damage ---------------- */
function damageEnemy(e, dmg, pd, heavy, kind) {
  if (!e.alive) return;
  dmg = Math.round(dmg * (1 - (kind === 'crit' || kind === 'plunge' ? e.T.def * .5 : e.T.def)));
  e.hp -= dmg; e.flash = .09; e.barT = 5; e.dmgAcc = (e.dmgT > 0 ? e.dmgAcc : 0) + dmg; e.dmgT = 1.6;
  if (kind === 'hit' || kind === 'magic') { const tp = new V3(); P.model.tip.getWorldPosition(tp); if (kind === 'magic') tp.copy(e.pos).add(new V3(0, 1.2, 0)); emit(tp.x, tp.y, tp.z, heavy ? 16 : 10, { color: [0xffd28a, 0xffffff, 0xff7a30], speed: 5, up: 1, life: .35, size: .05 }); emit(tp.x, tp.y, tp.z, 6, { color: [0x5a0a08, 0x8a1810], speed: 2.5, life: .5, size: .08, add: false }); G.hitstop = heavy ? .085 : .055; sfx('hit', e.pos); shake(heavy ? .16 : .08); }
  if (!e.seen) { e.seen = true; alertEnemy(e); }
  if (e.hp <= 0) { killEnemy(e); return; }
  if (e.isBoss && e.kind === 'gargoyle' && e === G.gargoyleA && !G.gargoyleB && e.hp < e.T.hp * .5) spawnSecondGargoyle();
  if (kind === 'crit') return;
  if (kind === 'plunge') { if (e.isBoss) { stagger(e, 1.6); return; } }
  if (e.state === 'stance') { e.state = 'chase'; }
  e.poiseDmg += pd; e.poiseT = 3;
  const inSuper = e.state === 'attack' && atkPhase(e.atk) >= 1 && e.T.poise > 0;
  if (e.T.poise === 0 || (e.poiseDmg >= e.T.poise && !inSuper)) { e.poiseDmg = 0; if (e.state !== 'critted') stagger(e, e.isBoss ? 1.4 : heavy ? .7 : .45); }
}
function stagger(e, dur) { if (e.state === 'charge') return; e.state = 'stagger'; e.st = 0; e.stDur = dur; e.atk = null; e.guard = false; if (e.lift > 0 && !e.flyer) e.lift = 0; }
function guardBreakEnemy(e) { e.guard = false; e.state = 'stagger'; e.st = 0; e.stDur = 1.3; e.atk = null; e.guardHp = 60; sfx('clang', e.pos); toast('Guard broken'); }
function killEnemy(e) {
  e.alive = false; e.hp = 0; e.state = 'dead'; e.st = 0; e.atk = null; e.guard = false; e.flash = 0; e.lift = 0; e.airborne = false;
  if (e.T.souls) { P.souls += e.T.souls; showGain(e.T.souls); }
  setTimeout(() => { emit(e.pos.x, e.pos.y + 1, e.pos.z, e.isBoss ? 60 : 12, { color: [0xcfe3ff, 0xffffff, 0x9ab8ff], speed: 2, up: 2, home: P.pos, life: 2.4, size: .06, jit: .5 }); sfx('souls'); }, 400);
  if (P.lock === e) P.lock = null;
  if (e.T.drop && !e.dropped) { e.dropped = true; setTimeout(() => dropItem(e.T.drop[0], e.T.drop[1], e.pos.x, e.pos.y, e.pos.z, 0xfff0d0), 900); }
  if (e.kind === 'taurus') bossDefeated('taurus');
  if (e.kind === 'gargoyle' && G.gargoyleA && !G.gargoyleA.alive && (!G.gargoyleB || !G.gargoyleB.alive) && G.gargoyleB) bossDefeated('gargoyles');
  if (e.kind === 'gargoyle' && e === G.gargoyleA && !G.gargoyleB) spawnSecondGargoyle();
}
function alertEnemy(e) {
  if (e.isBoss || !e.alive) return;
  if (['idle', 'sit', 'return'].includes(e.state)) { e.state = 'alert'; e.st = 0; }
  for (const o of enemies) if (o !== e && !o.isBoss && o.alive && ['idle', 'sit'].includes(o.state) && o.pos.distanceTo(e.pos) < 6 && Math.abs(o.pos.y - e.pos.y) < 3) { o.state = 'alert'; o.st = -rand(.2, .7); o.seen = true; }
}

/* ---------------- AI ---------------- */
function canStep(e, nx, nz) { if (e.dropper && e.state === 'chase' && P.pos.y < e.pos.y - 1) return true; const g = groundAt(nx, nz, e.pos.y); return g > e.pos.y - 1.1; }
function eMove(e, yaw, speed, dt) { const nx = e.pos.x + Math.sin(yaw) * speed * dt, nz = e.pos.z + Math.cos(yaw) * speed * dt; if (!canStep(e, nx, nz)) return false; e.pos.x = nx; e.pos.z = nz; return true; }
function newAtk(e, key) { const d = EATK[key]; let hold = 0; if (d.delay) hold = Math.random() * d.delay; return { key, def: d, t: 0, hold, hit: false, swung: false }; }
function startAttack(e, seq) { e.seq = seq; e.si = 0; e.atk = newAtk(e, seq[0]); e.state = 'attack'; e.st = 0; e.guard = false; }
function chooseAttack(e, dist) {
  const r = Math.random();
  switch (e.kind) {
    case 'hollow': return dist < 2.2 ? (r < .25 ? ['slash', 'slash2'] : ['slash']) : null;
    case 'hwarrior': if (dist > 2.3) return null; if (e.o.weapon === 'handaxe') return r < .3 ? ['flurry', 'flurry', 'flurry', 'flurry'] : ['chop']; return r < .35 ? ['slash', 'slash2'] : r < .55 ? ['chop'] : ['slash'];
    case 'bomber': return dist < 2 ? ['slash'] : null;
    case 'soldier': if (dist < 3.0) return r < .3 ? ['poke', 'poke2', 'poke2'] : ['poke']; if (dist < 5.5 && r < .25) return ['pokeLunge']; return null;
    case 'blackKnight': if (dist < 1.8 && r < .25) return ['bash', 'bkSlash']; if (dist < 2.8) return r < .4 ? ['bkSlash', 'bkSlash2'] : r < .7 ? ['bkSlash'] : ['bkSlam']; if (dist < 6 && r < .4) return ['bkStab']; return null;
    case 'balder': if (dist < 2.6) { if (r < .2 && e.T.stance) { e.state = 'stance'; e.st = 0; return 'stance'; } return r < .4 ? ['rapier', 'rapier2', 'rapier2'] : ['rapier']; } if (dist < 4 && r < .3) return ['rapier']; return null;
    case 'berenike': if (dist < 2.6) return r < .5 ? ['mace'] : ['maceSw', 'mace']; return null;
    case 'channeler': return dist < 2.6 ? ['trident'] : null;
    case 'boar': if (dist > 4 && dist < 16 && r < .6) return ['charge']; if (dist < 2.6) return ['tusk']; return null;
    case 'taurus': if (P.pos.y > e.pos.y + 3 && dist < 14) return ['tLeap']; if (dist > 8) return r < .6 ? ['tLeap'] : null; if (dist < 2.8 && r < .3) return ['tPound']; if (dist < 4.6) return r < .4 ? ['tSwing'] : r < .7 ? ['tSweep', 'tSweepR'] : ['tSweep']; if (dist < 7) return ['tStab']; return null;
    case 'gargoyle': { const behind = Math.abs(angDiff(e.yaw, yawTo(e.pos, P.pos))) > 1.9; const fire = e.breather || (G.gargoyleB && G.gargoyleB.alive);
      if (behind && dist < 3.5 && !e.tailCut) return ['gTail']; if (dist > 9) return r < .5 ? ['gDive'] : fire && r < .8 ? ['gFire'] : null; if (fire && dist < 7 && r < (e.breather ? .45 : .2)) return ['gFire'];
      if (dist < 3.6) return r < .45 ? ['gSlash', 'gSlash2', 'gOver'] : r < .75 ? ['gSlash'] : ['gOver']; if (dist < 7 && r < .25) return ['gDive']; return null; }
  }
  return null;
}
function senses(e, dist) {
  if (Math.abs(P.pos.y - e.pos.y) > 9 || dist > e.T.aggro) return false;
  e.losT -= .016 * 4; if (e.losT <= 0) { e.losT = .3; e.los = lineOfSight(tmpV2.set(e.pos.x, e.pos.y + 1.5 * e.T.s, e.pos.z), tmpV.set(P.pos.x, P.pos.y + 1.4, P.pos.z)); }
  if (!e.los) return false;
  const facing = Math.abs(angDiff(e.yaw, yawTo(e.pos, P.pos))) < 1.15;
  return facing || dist < e.T.hear * (P.sprinting ? 1.6 : 1);
}
const ACT_R = 58;
function updateEnemy(e, dt) {
  const T = e.T, tg = e.tgt;
  const pd = P.pos.distanceTo(e.pos);
  e.active = pd < ACT_R || e.isBoss && G.bossFight;
  e.model.root.visible = e.alive ? pd < 56 : e.model.root.visible && pd < 56; e.shadow.visible = e.model.root.visible && e.alive;
  if (!e.active) return;
  if (!e.alive) {
    if (e.gone) return;
    e.st += dt; if (T.quad) { e.model.body.rotation.z = Math.min(1.5, e.st * 2); } else { copyPose(tg, POSE.dead); for (const k of PK) e.pose[k] = damp(e.pose[k], tg[k], 10, dt); }
    if (e.st > 2.4) e.sink = (e.sink || 0) + dt * .5; if (e.st > 4.2) { e.gone = true; e.model.root.visible = false; e.shadow.visible = false; }
    return;
  }
  e.st += dt; e.cd -= dt; e.flash = Math.max(0, e.flash - dt); e.barT -= dt; e.dmgT -= dt; e.poiseT -= dt; e.buffT -= dt; if (e.poiseT <= 0) e.poiseDmg = 0;
  const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, dist = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
  const spd = T.speed * (e.phase2 ? 1.2 : 1);
  const pAlive = !P.dead && P.state !== 'rest' && P.state !== 'lift';
  let rate = 16, ms = 0;
  if (e.guard && T.guarded) e.guardHp = Math.min(60, e.guardHp + dt * 8);
  switch (e.state) {
    case 'sit': copyPose(tg, POSE.sit); if (pAlive && dist < 3.2) { e.state = 'alert'; e.st = 0; } break;
    case 'idle':
      copyPose(tg, IDLE); if (e.ambush) { tg.hY = -.25; tg.kL = .8; tg.kR = .8; tg.lL = -.4; tg.lR = -.4; }
      if (!e.isBoss && pAlive && senses(e, dist)) { e.seen = true; alertEnemy(e); }
      break;
    case 'alert':
      copyPose(tg, IDLE); e.yaw = dampAng(e.yaw, toP, T.turn, dt);
      if (e.st > .55) { e.state = 'chase'; e.st = 0; e.cd = rand(.1, .5); }
      break;
    case 'chase': {
      if (!pAlive) { e.state = e.isBoss ? 'idle' : 'return'; break; }
      if (!e.isBoss && Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z) > T.leash) { e.state = 'return'; e.guard = false; break; }
      if (T.heals && !e.healed && e.hp < T.hp * .4 && dist > 3) { e.healed = true; e.state = 'heal'; e.st = 0; break; }
      e.yaw = dampAng(e.yaw, toP, T.turn, dt);
      if (T.buffer && e.buffT <= 0 && Math.random() < dt * .25) { e.state = 'dance'; e.st = 0; break; }
      if (T.ranged && dist > 2.4 && e.cd <= 0 && e.los !== false) { if (dist < T.aggro + 2) { e.state = 'aim'; e.st = 0; break; } }
      if (e.cd <= 0) { const seq = chooseAttack(e, dist); if (seq === 'stance') break; if (seq) { startAttack(e, seq); break; } }
      e.guard = T.guarded && dist < 7;
      if (T.ranged) { if (dist < 3) ms = eMove(e, toP + Math.PI, spd * .6, dt) ? spd * .6 : 0; }
      else if (dist > T.keep) { ms = spd * (e.guard ? .55 : 1); if (!eMove(e, e.yaw, ms, dt)) ms = 0; }
      else { const a = toP + Math.PI / 2 * e.sdir; ms = e.guard ? 1.1 : .9; if (!eMove(e, a, ms, dt)) { e.sdir *= -1; ms = 0; } if (Math.random() < dt * .4) e.sdir *= -1; }
      e.walkPh += dt * ms * 2.1 / T.s; poseFree(tg, ms / 3, e.walkPh, e.guard, false);
      break; }
    case 'aim': {
      e.yaw = dampAng(e.yaw, toP, 8, dt); const r = T.ranged;
      if (r === 'eFirebomb') blendPose(tg, IDLE, POSE.throw0, Math.min(1, e.st / .5)); else if (r === 'eSoulArrow') copyPose(tg, POSE.cast); else copyPose(tg, POSE.aim);
      const fireAt = r === 'eFirebomb' ? .7 : r === 'eSoulArrow' ? .8 : .9;
      if (e.st > fireAt && !e.fired) {
        e.fired = true; const hand = new V3(); e.model.handR.getWorldPosition(hand);
        const tgtP = P.pos.clone().add(new V3(0, 1.1, 0)).addScaledVector(P.lastVel || new V3(), r === 'eFirebomb' ? .6 : .2);
        const d = PROJ[r]; const dir = d.grav > 5 ? lobDir(hand, tgtP, d.speed, d.grav) : tgtP.sub(hand).normalize();
        spawnProj(r, hand, dir, e, P); sfx(r === 'eFirebomb' ? 'swing' : 'bow', e.pos);
      }
      if (r === 'eFirebomb' && e.st > fireAt) blendPose(tg, POSE.throw0, POSE.throw1, Math.min(1, (e.st - fireAt) / .15));
      if (e.st > fireAt + .6) { e.fired = false; e.state = 'chase'; e.cd = rand(T.cd[0], T.cd[1]); e.st = 0; }
      break; }
    case 'dance': copyPose(tg, POSE.roar); tg.tY = Math.sin(e.st * 6) * .6; tg.aRx = -2 + Math.sin(e.st * 8) * .5;
      if (Math.random() < .4) emit(e.pos.x + rand(-1, 1), e.pos.y + rand(.5, 2), e.pos.z + rand(-1, 1), 1, { color: 0x6a9aff, speed: .6, up: .6, grav: 0, life: .8, size: .06 });
      if (e.st > 2.2) { for (const o of enemies) if (o.alive && o !== e && o.pos.distanceTo(e.pos) < 12) { o.buffT = 30; } e.buffT = 25; e.state = 'chase'; e.st = 0; toast('The Channeler empowers nearby foes'); }
      break;
    case 'stance': copyPose(tg, POSE.parry); tg.aRx = -1.2; tg.eR = -.5; tg.wx = -.2; e.yaw = dampAng(e.yaw, toP, 6, dt); e.guard = false; if (e.st > 1.6) { e.state = 'chase'; e.st = 0; e.cd = .3; } break;
    case 'riposteWait': copyPose(tg, POSE.tw); e.yaw = dampAng(e.yaw, toP, 8, dt); if (e.st > .5) { if (P.state === 'parried' && dist < 2.8) { hurtPlayer(330, e.yaw, { pd: 99, kd: true }); sfx('stab'); } e.state = 'chase'; e.st = 0; e.cd = 1; } break;
    case 'heal': copyPose(tg, POSE.heal); if (e.st > 1.2 && !e.healDone) { e.healDone = true; e.hp = Math.min(T.hp, e.hp + T.hp * .5); emit(e.pos.x, e.pos.y + 1.1, e.pos.z, 14, { color: [0xffb050, 0xffe0a0], speed: 1.2, up: 1.4, grav: -1, life: .9, size: .07 }); } if (e.st > 1.8) { e.healDone = false; e.state = 'chase'; e.st = 0; } break;
    case 'attack': ms = enemyAttack(e, dt, dist, toP); rate = 26; break;
    case 'stagger': copyPose(tg, POSE.hurt); rate = 20; if (e.st > e.stDur) { e.state = 'chase'; e.st = 0; e.cd = rand(.15, .5); } break;
    case 'parried': copyPose(tg, POSE.parried); rate = 20; if (e.st > 1.6) { e.state = 'chase'; e.st = 0; e.cd = .3; } break;
    case 'critted': copyPose(tg, e.st < .55 ? POSE.hurt : POSE.down); rate = 14; if (e.st > 2.2) { if (e.alive) { e.state = 'chase'; e.st = 0; e.cd = .6; } } break;
    case 'return': {
      const hy = Math.atan2(e.home.x - e.pos.x, e.home.z - e.pos.z), hd = Math.hypot(e.home.x - e.pos.x, e.home.z - e.pos.z);
      e.yaw = dampAng(e.yaw, hy, 6, dt); if (!eMove(e, e.yaw, spd * .8, dt) || hd < .5) { e.state = 'idle'; e.yaw = e.home.yaw; e.seen = false; } ms = spd * .8; e.walkPh += dt * ms * 2.1; poseFree(tg, .8, e.walkPh, false, false);
      if (pAlive && senses(e, dist) && dist < T.aggro * .6) e.state = 'chase';
      break; }
    case 'flyIn': updateFlyIn(e, dt); break;
    case 'charge': break;
  }
  if (e.kb) { eMove(e, toP + Math.PI, e.kb * 2, dt); e.kb = Math.max(0, e.kb - dt * 6); }
  if (T.quad) poseQuad(e.model, e.walkPh, Math.min(1, ms / 3), G.time, { head: e.state === 'attack' && e.atk && atkPhase(e.atk) === 0 ? .3 : 0 });
  else for (const k of PK) e.pose[k] = damp(e.pose[k], tg[k], rate, dt);
}
function enemyAttack(e, dt, dist, toP) {
  const a = e.atk, d = a.def, T = e.T, tg = e.tgt; a.t += dt * (e.phase2 ? 1.15 : 1) * (e.buffT > 0 ? 1.1 : 1); const ph = atkPhase(a), w = d.wind + a.hold; let ms = 0;
  if (d.leap || d.dive) {
    if (!a.from) { a.from = e.pos.clone(); const back = Math.min(dist, d.dive ? 1.2 : 2.2); a.to = new V3(P.pos.x - Math.sin(toP) * back, P.pos.y, P.pos.z - Math.cos(toP) * back); if (G.bossFight && G.bossFight.clamp) G.bossFight.clamp(a.to); e.yaw = toP; sfx('heavy', e.pos); }
    if (ph === 0) { const k = clamp(a.t / d.wind, 0, 1); e.pos.x = lerp(a.from.x, a.to.x, ease(k)); e.pos.z = lerp(a.from.z, a.to.z, ease(k)); e.pos.y = lerp(a.from.y, a.to.y, k); e.lift = Math.sin(Math.PI * k) * (d.dive ? 5 : 6); e.airborne = true; }
    else { e.lift = 0; e.airborne = false; }
    if (e.model.wings) e.model.flap = ph === 0 ? 1 : 0;
  } else if (d.charge) {
    if (ph === 0) e.yaw = dampAng(e.yaw, toP, 4, dt);
    else if (ph === 1) { ms = d.charge; if (!eMove(e, e.yaw, d.charge, dt)) a.t = w + d.act; e.walkPh += dt * 14; }
  } else if (d.breath) {
    if (ph === 0) e.yaw = dampAng(e.yaw, toP, 5, dt); else if (ph === 1) e.yaw = dampAng(e.yaw, toP, 1.2, dt);
  } else {
    if (ph === 0) e.yaw = dampAng(e.yaw, toP, T.turn * (a.t < d.wind * .7 ? 1 : .35), dt);
    const ls = d.wind * .75 + a.hold, le = w + d.act;
    if (d.lunge && a.t > ls && a.t < le && dist > e.r + P.r + .4) { eMove(e, e.yaw, d.lunge / (le - ls), dt); }
  }
  if (ph >= 1 && !a.swung) { a.swung = true; sfx(e.isBoss ? 'heavy' : 'eswing', e.pos);
    if (d.wave) { const tp = new V3(); e.model.tip ? e.model.tip.getWorldPosition(tp) : tp.copy(e.pos); spawnWave(d.leap ? e.pos.x : tp.x, d.leap ? e.pos.z : tp.z, d.wave, Math.round(d.dmg * .6)); sfx('boom', e.pos); shake(.5); emit(e.pos.x, e.pos.y + .3, e.pos.z, 20, { color: [0x8a7a6a, 0x5a5048], speed: 4, up: 2, life: .7, size: .14, add: false }); }
    if (d.tail) e.model.tailSwing = 0;
    if (d.breath) sfx('fire', e.pos); }
  if (d.tail && ph >= 1) { e.model.tailSwing = Math.min(TAU, (a.t - w) / d.act * TAU); }
  if (d.breath && ph === 1) {
    const hd = new V3(); e.model.head.getWorldPosition(hd);
    const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
    for (let i = 0; i < 3; i++) emit(hd.x + fx * 1.2, hd.y - .3, hd.z + fz * 1.2, 1, { color: [0xff6a20, 0xffb040, 0xffe080], speed: 1, vel: new V3(fx * 11 + rand(-1.5, 1.5), rand(-2.5, .5), fz * 11 + rand(-1.5, 1.5)), grav: 0, life: .65, size: .28 });
    a.tick = (a.tick || 0) - dt;
    if (a.tick <= 0 && dist < d.range && Math.abs(angDiff(e.yaw, toP)) < d.arc && !P.iframe) { a.tick = .3; hurtPlayer(d.dmg, e.yaw, { fire: true, pd: 15, unblock: true }); }
  }
  else if (ph === 1 && !a.hit) enemyHitCheck(e, a, dist, toP);
  if (e.si + 1 < e.seq.length && a.t > w + d.act + d.rec * .35) { e.si++; e.atk = newAtk(e, e.seq[e.si]); return ms; }
  if (ph === 3) { e.atk = null; e.cd = rand(T.cd[0], T.cd[1]) * (e.phase2 ? .7 : 1); e.st = 0; e.model.tailSwing = 0; if (Math.random() < T.strafe) { e.state = 'strafe'; e.sdir = Math.random() < .5 ? 1 : -1; e.sdur = rand(.6, 1.6); } else e.state = 'chase'; if (e.state === 'strafe') e.state = 'chase'; return ms; }
  if (T.quad) return ms;
  atkPose(tg, a);
  if ((d.leap || d.dive) && ph === 0) copyPose(tg, POSE.hw);
  if (d.breath) { copyPose(tg, POSE.roar); tg.tX = .3; tg.hd = .4; }
  if (d.tail) { copyPose(tg, IDLE); tg.tY = Math.sin((a.t - w) * 8) * .3; }
  return ms;
}
function enemyHitCheck(e, a, dist, toP) {
  const d = a.def; if (P.dead || P.state === 'fog') return;
  if (dist - P.r > d.range || Math.abs(P.pos.y - (e.pos.y + e.lift)) > 2.2 + e.T.s) return;
  if (Math.abs(angDiff(e.yaw, toP)) > d.arc && dist > e.r + .6) return;
  if (P.iframe) return;
  a.hit = true;
  const mult = e.buffT > 0 ? 1.6 : 1;
  hurtPlayer(d.dmg * mult, e.yaw, { pd: d.pd, kd: d.kd, unblock: d.unblock, parryable: d.parry, src: e, fire: d.fire });
}
function separate() {
  const all = [P]; for (const e of enemies) if (e.alive && e.active && e.lift < 1 && e.state !== 'flyIn') all.push(e);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j]; if (Math.abs(a.pos.y - b.pos.y) > 1.6) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), min = a.r + b.r;
    if (d < min && d > 1e-4) { const push = min - d, wa = a.isBoss ? .05 : b.isBoss ? .95 : .5; a.pos.x -= dx / d * push * wa; a.pos.z -= dz / d * push * wa; b.pos.x += dx / d * push * (1 - wa); b.pos.z += dz / d * push * (1 - wa); }
  }
}
function enemyPhysics(e, dt) {
  if (!e.alive || !e.active || e.state === 'flyIn' || e.airborne || e.state === 'critted' && false) return;
  const fell = physStep(e, dt);
  if (fell > 8 && e.alive) { damageEnemy(e, e.T.hp * (fell > 14 ? 2 : (fell - 8) / 6), 99, true, 'fall'); }
  if (e.pos.y < -20 && e.alive) killEnemy(e);
}

/* ---------------- shockwaves ---------------- */
const waves = []; const ringGeo = new THREE.RingGeometry(.86, 1, 20, 1).rotateX(-Math.PI / 2);
function spawnWave(x, z, max, dmg) { const y = groundAt(x, z, P.pos.y + 3); const m = new THREE.Mesh(ringGeo, mat(TX.white, 0, { emissive: 0xffaa60, transparent: true, alphaTest: .01, side: DS })); m.position.set(x, y + .08, z); scene.add(m); waves.push({ x, y, z, r: .5, max, dmg, mesh: m, hit: false }); }
function updateWaves(dt) {
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i]; w.r += 9 * dt; w.mesh.scale.setScalar(w.r); w.mesh.material.uniforms.uAlpha.value = Math.max(0, 1 - w.r / w.max);
    if (!w.hit && !P.dead && P.onGround && Math.abs(P.pos.y - w.y) < 1) { const d = Math.hypot(P.pos.x - w.x, P.pos.z - w.z); if (Math.abs(d - w.r) < .55 && !P.iframe) { w.hit = true; hurtPlayer(w.dmg, Math.atan2(P.pos.x - w.x, P.pos.z - w.z), { pd: 99, kd: true }); } }
    if (w.r >= w.max) { scene.remove(w.mesh); waves.splice(i, 1); }
  }
}

/* ---------------- bosses ---------------- */
const BOSSES = {};
function setupBosses() {
  /* Taurus Demon waits atop the far tower and leaps down when you are a third of the way along the wall */
  const t = makeEnemy('taurus', -34, 42.4, -177, Math.PI / 2); t.state = 'perch'; BOSSES.taurus = t;
  /* gargoyle A arrives when you reach a third of the roof */
  G.gargoyleA = null; G.gargoyleB = null;
}
function startBossFight(id) {
  if (id === 'taurus' && !G.taurusDead) { G.bossFight = { id, fog: AREA.taurusFog, bars: [BOSSES.taurus], clamp: v => { v.x = clamp(v.x, -28.5, 1.5); v.z = clamp(v.z, -177.6, -174.8); v.y = 36; } }; showBossBars(); music(true, 'boss'); }
  if (id === 'gargoyles' && !G.gargoylesDead) { G.bossFight = { id, fog: AREA.roofFog, bars: [], clamp: v => { v.x = clamp(v.x, -122, -96); v.z = clamp(v.z, -107, -103); v.y = 48; }, armed: true }; showBossBars(); }
}
function endBossFight(won) {
  const f = G.bossFight; if (!f) return; G.bossFight = null; music(false); hideBossBars();
  if (!won) {
    if (f.id === 'taurus') { const t = BOSSES.taurus; Object.assign(t, { alive: true, hp: t.T.hp, state: 'perch', st: 0, atk: null, lift: 0, gone: false, sink: 0, airborne: false }); t.pos.set(-34, 42.4, -177); t.yaw = Math.PI / 2; t.model.root.visible = true; copyPose(t.pose, IDLE); }
    if (f.id === 'gargoyles') { for (const g of [G.gargoyleA, G.gargoyleB]) if (g) { g.alive = false; g.gone = true; g.model.root.visible = false; g.shadow.visible = false; const i = enemies.indexOf(g); if (i >= 0) enemies.splice(i, 1); scene.remove(g.model.root); } G.gargoyleA = G.gargoyleB = null; }
  }
}
function updateBossTriggers(dt) {
  const t = BOSSES.taurus;
  if (t && t.state === 'perch' && t.alive) {
    copyPose(t.tgt, POSE.roar); for (const k of PK) t.pose[k] = damp(t.pose[k], t.tgt[k], 6, dt); t.active = true; t.model.root.visible = P.pos.distanceTo(t.pos) < 80;
    if (G.bossFight && G.bossFight.id === 'taurus' && P.pos.x < -7 && P.pos.y > 35) { t.state = 'jumpIn'; t.st = 0; t.from = t.pos.clone(); sfx('roar', t.pos); }
  }
  if (t && t.state === 'jumpIn') { t.airborne = true; t.st += dt; const k = Math.min(1, t.st / 1.3); t.pos.set(lerp(t.from.x, -18, k), lerp(t.from.y, 36, k), lerp(t.from.z, -176.2, k)); t.lift = Math.sin(Math.PI * k) * 5; copyPose(t.tgt, POSE.hw); for (const k2 of PK) t.pose[k2] = damp(t.pose[k2], t.tgt[k2], 10, dt);
    if (k >= 1) { t.lift = 0; t.airborne = false; t.state = 'chase'; t.st = 0; t.cd = .8; t.onGround = true; spawnWave(t.pos.x, t.pos.z, 5, 150); sfx('boom', t.pos); shake(.7); } }
  const f = G.bossFight;
  if (f && f.id === 'gargoyles' && f.armed && P.pos.x < -101 && P.pos.y > 47) { f.armed = false; G.gargoyleA = spawnGargoyle(-112, -104, true); f.bars.push(G.gargoyleA); showBossBars(); music(true, 'gargoyle'); f.t0 = G.time; }
  if (f && f.id === 'gargoyles' && G.gargoyleA && !G.gargoyleB && G.time - f.t0 > 75) spawnSecondGargoyle();
}
function spawnGargoyle(x, z, tail) {
  const g = makeEnemy('gargoyle', x, 48, z, Math.PI / 2, { tail }); g.state = 'flyIn'; g.st = 0; g.flyer = true; g.from = new V3(x + rand(-10, 10), 64, z - 22); g.to = new V3(x, 48, z); g.pos.copy(g.from); g.tailHp = 78; g.tailCut = !tail; return g;
}
function spawnSecondGargoyle() {
  if (G.gargoyleB || !G.bossFight) return;
  const g = spawnGargoyle(-118, -104, false); g.hp = 480; g.T = { ...g.T, hp: 480 }; g.breather = true; g.from.set(-128, 64, -105); G.gargoyleB = g; G.bossFight.bars.push(g); showBossBars(); sfx('screech', g.pos); toast('A second gargoyle descends');
}
function updateFlyIn(e, dt) {
  const k = Math.min(1, e.st / 2.2); e.pos.lerpVectors(e.from, e.to, ease(k)); e.lift = 0; e.model.flap = 1; e.yaw = dampAng(e.yaw, yawTo(e.pos, P.pos), 4, dt);
  copyPose(e.tgt, POSE.jump); for (const kk of PK) e.pose[kk] = damp(e.pose[kk], e.tgt[kk], 10, dt);
  if (k >= 1) { e.state = 'chase'; e.st = 0; e.cd = .6; e.model.flap = 0; e.onGround = true; sfx('screech', e.pos); spawnWave(e.pos.x, e.pos.z, 3.5, 80); }
}
function cutTail(e) { e.tailCut = true; if (e.model.tail) e.model.tail.visible = false; toast('You cut off its tail'); dropItem('tailAxe', 1, e.pos.x - Math.sin(e.yaw) * 2, 48, e.pos.z - Math.cos(e.yaw) * 2); sfx('stab', e.pos); }
function bossDefeated(id) {
  if (id === 'taurus') { G.taurusDead = true; AREA.taurusFog.set(false); AREA.taurusExit.set(false); }
  if (id === 'gargoyles') { G.gargoylesDead = true; AREA.roofFog.set(false); P.souls += 10000; showGain(10000); giveItem('humanity', 2); }
  G.bossFight && endBossFight(true);
  sfx('felled'); setTimeout(() => banner('VICTORY ACHIEVED', 'gold', 5), 900);
}
function showBossBars() { const f = G.bossFight; const wrap = $('#bossBars'); wrap.hidden = !f || !f.bars.length; wrap.innerHTML = ''; if (!f) return; for (const b of f.bars) { const el = document.createElement('div'); el.className = 'bossBar'; el.innerHTML = `<div class="bossName"><span>${b.T.name}</span><span class="bossDmg"></span></div><div class="bar"><span class="trail"></span><span class="fill"></span></div>`; wrap.appendChild(el); b.barEl = el; b.trailV = 1; } }
function hideBossBars() { $('#bossBars').hidden = true; }

/* ---------------- the red drake on the bridge ---------------- */
const drake = { state: 'gone', st: 0, cd: 0, rig: null, front: 0, tick: 0 };
function setupDrake() {
  drake.rig = drakeRig(mat(TX.scale, 0xc06050), mat(TX.scale, 0x8a3a2a, { side: DS }), mat(TX.white, 0, { emissive: 0xffd040 }));
  scene.add(drake.rig.root); drake.rig.root.visible = false;
}
function drakeFlyBy() { if (G.flybyDone) return; G.flybyDone = true; drake.state = 'flyby'; drake.st = 0; drake.rig.root.visible = true; sfx('roar', new V3(-10, 30, -110)); }
function onBridge() { const b = AREA.bridge; return P.pos.x > b.x0 - .5 && P.pos.x < b.x1 && P.pos.z > b.z0 && P.pos.z < b.z1 + 2 && Math.abs(P.pos.y - b.y) < 2; }
function updateDrake(dt) {
  const d = drake, R = d.rig; if (!R) return; d.st += dt; d.cd -= dt;
  const perch = AREA.drakePerch, flap = s => R.wings.forEach(w => { w.rotation.z = Math.sin(G.time * 5) * .7 * s * w.userData.sx; });
  switch (d.state) {
    case 'flyby': { const k = d.st / 4; R.root.position.set(lerp(40, -60, k), 34 + Math.sin(k * Math.PI) * 6, lerp(-90, -140, k)); R.root.rotation.set(0, -Math.PI / 2 - .4, 0); flap(1); if (k >= 1) { d.state = 'gone'; R.root.visible = false; } break; }
    case 'gone': if (onBridge() && d.cd <= 0 && !P.dead) { d.state = 'landing'; d.st = 0; R.root.visible = true; d.from = new V3(-80, 60, -60); sfx('roar', perch); } break;
    case 'landing': { const k = Math.min(1, d.st / 2.6); R.root.position.lerpVectors(d.from, perch, ease(k)); R.root.position.y += (1 - k) * 4; R.root.rotation.set(0, Math.PI, 0); flap(1 - k * .6);
      if (k >= 1) { d.state = 'breathe'; d.st = 0; d.front = perch.z - 2; sfx('fire', perch); shake(.3); } break; }
    case 'breathe': {
      flap(.15); R.neck.rotation.x = -.15 + Math.sin(d.st * 2) * .08; R.root.position.copy(perch);
      d.front -= 16 * dt; const b = AREA.bridge;
      for (let i = 0; i < 5; i++) emit(rand(b.x0, b.x1), b.y + rand(.2, 1.8), d.front + rand(-2.5, 2.5), 1, { color: [0xff6a20, 0xffb040, 0xffe080, 0xff3a10], speed: 1.2, up: 1.5, grav: -1, life: .7, size: rand(.2, .45) });
      d.tick -= dt;
      if (d.tick <= 0 && onBridge() && P.pos.z > d.front - 3 && P.pos.z < d.front + 6 && !P.iframe) { d.tick = .35; hurtPlayer(140, 0, { fire: true, pd: 20, unblock: true }); }
      if (d.front < b.z0 - 4) { d.state = 'perched'; d.st = 0; }
      break; }
    case 'perched': flap(.1); if (d.st > 2.2) { d.state = 'leaving'; d.st = 0; } break;
    case 'leaving': { const k = Math.min(1, d.st / 2.5); R.root.position.lerpVectors(perch, new V3(-90, 70, -60), ease(k)); flap(1); if (k >= 1) { d.state = 'gone'; R.root.visible = false; d.cd = 5; } break; }
  }
}

/* ---------------- barrel trap on the stairs ---------------- */
const barrel = { used: false, obj: null };
function updateBarrel(dt) {
  const roller = enemies.find(e => e.o.barrel);
  if (!barrel.used && roller && roller.alive && P.pos.x > 5 && P.pos.x < 11 && P.pos.z < -147 && P.pos.z > -157 && P.pos.y > 23 && P.pos.y < 29) {
    barrel.used = true; roller.state = 'attack'; roller.atk = newAtk(roller, 'chop'); roller.seq = ['chop']; roller.si = 0;
    const m = new THREE.Mesh(cylG(.42, .42, .9, 8), ML.plank); m.rotation.z = Math.PI / 2; scene.add(m);
    barrel.obj = { mesh: m, pos: new V3(8, 28.4, -158.5), t: 0, hit: false }; sfx('door', roller.pos);
  }
  const b = barrel.obj; if (!b) return;
  b.t += dt; b.pos.z += 7.5 * dt; b.pos.y = groundAt(b.pos.x, b.pos.z, b.pos.y + .6) + .42; b.mesh.position.copy(b.pos); b.mesh.rotation.x += dt * 12;
  if (Math.random() < .6) emit(b.pos.x, b.pos.y + .3, b.pos.z, 1, { color: [0xff6a20, 0xffb040], speed: .6, up: 1, grav: -1, life: .5, size: .12 });
  if (!b.hit && P.pos.distanceTo(b.pos) < 1.1 && !P.iframe) { b.hit = true; hurtPlayer(160, 0, { pd: 99, kd: true, fire: true }); }
  if (b.pos.z > -145.5 || b.t > 4) { emit(b.pos.x, b.pos.y, b.pos.z, 30, { color: [0xff7a24, 0xffc060, 0x5a3020], speed: 5, up: 2, life: .6, size: .12 }); sfx('boom', b.pos); scene.remove(b.mesh); barrel.obj = null; }
}

/* ---------------- enemy placement (route order) ---------------- */
function populate() {
  makeEnemy('hollow', -5.5, .4, -15, .2, { sit: true }); makeEnemy('hollow', 1.5, .4, -16.5, -.4, { sit: true });
  /* Burg entrance */
  makeEnemy('hwarrior', 9.5, 14, -69, 0, { shield: true }); makeEnemy('hwarrior', 12, 14, -70.5, -.3);
  makeEnemy('hwarrior', 17, 18, -66.5, -1.2, { weapon: 'handaxe', dropper: true });
  makeEnemy('bomber', -8, 17.2, -75.5, 1.3);
  makeEnemy('hwarrior', -13.5, 14, -68, Math.PI / 2, { ambush: true, shield: true });
  /* street yard and the archer platform */
  makeEnemy('hwarrior', -3, 14, -83, 0, { shield: true }); makeEnemy('hwarrior', .5, 14, -85, -.3); makeEnemy('hollow', -1.5, 14, -88, .3, { weapon: 'shortsword' });
  makeEnemy('crossbow', 5, 18, -98.5, 0);
  /* corridor to the bonfire */
  makeEnemy('soldier', -23, 18, -118, 0); makeEnemy('soldier', -22.5, 18, -127, 0);
  /* climbing house, upper street */
  makeEnemy('hollow', 10, 24, -127, Math.PI, { weapon: 'shortsword' });
  makeEnemy('hwarrior', -1, 24, -137, Math.PI / 2, { ambush: true });
  makeEnemy('hwarrior', 8, 24, -139, .2, { shield: true }); makeEnemy('hwarrior', 11.5, 24, -141.5, -.3, { weapon: 'handaxe' }); makeEnemy('hollow', 13.5, 24, -138, -.6);
  makeEnemy('hwarrior', 8, 28, -160.5, 0, { barrel: true });
  /* watchtower plaza */
  makeEnemy('soldier', 5, 28, -166, 0); makeEnemy('soldier', 9, 28, -168, 0); makeEnemy('soldier', 13, 28, -165, -.2);
  makeEnemy('bomber', -4, 31.5, -162, Math.PI / 2); makeEnemy('bomber', -3.5, 31.5, -167, Math.PI / 2);
  makeEnemy('blackKnight', 22.5, 24, -165, Math.PI / 2 * 0);
  /* Taurus tower archers */
  makeEnemy('archer', -4.2, 42, -181.6, Math.PI / 2); makeEnemy('archer', -1.8, 42, -182.4, Math.PI / 2);
  /* bridge */
  makeEnemy('soldier', -34, 30, -150, 0); makeEnemy('soldier', -33, 30, -128, 0);
  /* parish gate and forecourt */
  makeEnemy('blackKnight', -50, 34, -117.5, Math.PI / 2);
  makeEnemy('boar', -80, 33, -104, Math.PI / 2);
  /* church */
  makeEnemy('berenike', -116, 33, -105, Math.PI / 2);
  makeEnemy('balder', -100, 33, -100, -Math.PI / 2); makeEnemy('balder', -112, 33, -110, Math.PI / 2);
  makeEnemy('channeler', -94.5, 39, -104, -Math.PI / 2);
  makeEnemy('hollow', -95.5, 39, -110, -Math.PI / 2, { weapon: 'broken' }); makeEnemy('hollow', -95.5, 39, -99.5, -Math.PI / 2); makeEnemy('hollow', -104, 36, -97.2, -Math.PI / 2);
  setupBosses(); setupDrake();
}
