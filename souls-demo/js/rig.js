/* Low-poly rigs: humanoids with elbows/knees, plus quadrupeds (dog, boar), the drake and the gargoyles. */
'use strict';
const PK = ['tY', 'tX', 'aRx', 'aRy', 'aRz', 'eR', 'wx', 'aLx', 'aLy', 'eL', 'lL', 'lR', 'kL', 'kR', 'spin', 'hY', 'hd'];
function mkPose(o = {}) { return Object.assign({ tY: 0, tX: .05, aRx: -.2, aRy: 0, aRz: -.12, eR: -.55, wx: -.55, aLx: -.25, aLy: .3, eL: -.9, lL: 0, lR: 0, kL: .06, kR: .06, spin: 0, hY: 0, hd: 0 }, o); }
const IDLE = mkPose();
function blendPose(out, a, b, k) { for (const key of PK) out[key] = a[key] + (b[key] - a[key]) * k; return out; }
function copyPose(out, a) { for (const key of PK) out[key] = a[key]; return out; }
const POSE = {
  l1w: mkPose({ tY: -.65, aRx: -1.4, aRy: -1.4, aRz: 0, eR: -1.1, wx: -.2, lL: .25, lR: -.2, kL: .3, kR: .3 }),
  l1s: mkPose({ tY: .75, tX: .15, aRx: -1.35, aRy: 1.0, aRz: 0, eR: -.1, wx: -.1, lL: -.4, lR: .3, kL: .5, kR: .2, hY: -.05 }),
  l2w: mkPose({ tY: .6, aRx: -1.45, aRy: .9, aRz: 0, eR: -1.2, wx: -.2, lL: -.2, lR: .2, kL: .3, kR: .3 }),
  l2s: mkPose({ tY: -.75, tX: .15, aRx: -1.35, aRy: -1.35, aRz: 0, eR: -.1, wx: -.1, lL: .35, lR: -.35, kL: .2, kR: .5, hY: -.05 }),
  hw: mkPose({ tY: -.25, tX: -.25, aRx: -2.9, aRy: -.15, aRz: 0, eR: -.9, wx: .2, lL: .3, lR: -.3, kL: .2, kR: .3, hd: -.15 }),
  hs: mkPose({ tY: .1, tX: .45, aRx: -1.0, aRy: 0, aRz: 0, eR: -.1, wx: -.2, lL: -.7, lR: .45, kL: .7, kR: .3, hY: -.15 }),
  tw: mkPose({ tY: -.55, tX: -.05, aRx: .3, aRy: -.2, aRz: 0, eR: -1.4, wx: -.3, lL: .4, lR: -.4, kL: .4, kR: .2 }),
  ts: mkPose({ tY: .25, tX: .3, aRx: -1.5, aRy: 0, aRz: 0, eR: 0, wx: -.05, lL: -.7, lR: .6, kL: .7, kR: .2, hY: -.1 }),
  hurt: mkPose({ tX: -.35, hd: -.35, aRx: .1, eR: -.3, aLx: .2, eL: -.3, aRz: -.4, lL: .2, lR: -.3, kL: .4, kR: .3 }),
  down: mkPose({ spin: -1.45, hY: -.6, aRx: -2.2, eR: -.4, aLx: -2.0, eL: -.5, lL: -.3, lR: .1, kL: .8, kR: .3, hd: .4 }),
  dead: mkPose({ spin: -1.5, hY: -.62, aRx: -2.6, eR: -.2, aLx: -2.6, eL: -.2, lL: .1, lR: -.1, kL: .3, kR: .1, hd: .2 }),
  sit: mkPose({ hY: -.72, lL: -2.0, lR: -1.9, kL: 1.9, kR: 1.85, tX: .35, aRx: -.7, eR: -.9, wx: -.4, aLx: -.8, eL: -.9, aLy: .1, hd: .3 }),
  roar: mkPose({ tX: -.4, aRx: -2.6, aRy: -.4, eR: -.3, wx: .3, aLx: -2.5, eL: -.3, hd: -.5, lL: .3, lR: -.3, kL: .3, kR: .3 }),
  heal: mkPose({ aLx: -1.9, aLy: -.7, eL: -1.4, hd: -.35, tX: -.05 }),
  kneel: mkPose({ hY: -.3, lL: -1.5, kL: 1.5, lR: .3, kR: 1.7, tX: .4, aRx: -.6, eR: -.3, wx: -.4, hd: .3 }),
  kick: mkPose({ lR: -1.5, kR: .15, lL: .2, kL: .3, tX: -.25, aRx: .2, aLx: -.6, hd: -.1 }),
  parry: mkPose({ aLx: -1.25, eL: -.35, aLy: .9, tY: .45, tX: .1, lL: -.3, lR: .3, kL: .3 }),
  parried: mkPose({ tX: -.5, hd: -.5, aRx: -2.4, eR: -.2, wx: .4, aLx: -.3, eL: -.2, lL: .5, lR: -.4, kL: .5, kR: .5, hY: -.15 }),
  throw0: mkPose({ aRx: -2.7, aRy: -.3, eR: -1.4, tY: -.5, tX: -.1, lL: .3, lR: -.3 }),
  throw1: mkPose({ aRx: -1.1, aRy: .2, eR: -.1, tY: .4, tX: .25, lL: -.4, lR: .3, kL: .4 }),
  aim: mkPose({ aRx: -1.45, eR: -.15, wx: 0, aLx: -1.5, aLy: -.5, eL: -.45, tY: .2, hd: .05, lL: -.25, lR: .25, kL: .2 }),
  climb: mkPose({ aRx: -2.6, eR: -.6, aLx: -2.6, eL: -.6, lL: -.9, kL: 1.2, lR: -.3, kR: .5, tX: .05 }),
  plunge: mkPose({ aRx: -.9, eR: -1.6, wx: 2.0, aLx: -1.1, eL: -1.4, tX: .4, lL: -.8, lR: -.5, kL: 1.2, kR: 1, hd: .5 }),
  jump: mkPose({ lL: -1.0, kL: 1.4, lR: .4, kR: .7, aRx: -.8, aLx: -1.0, tX: .25 }),
  cast: mkPose({ aLx: -1.6, eL: -.2, aLy: -.3, aRx: -.5, tX: -.1, hd: -.1 }),
};
/* attack timing: phase 0 wind-up (plus optional hold/delay), 1 active, 2 recovery, 3 done */
function atkPhase(a) { const d = a.def, w = d.wind + (a.hold || 0); if (a.t < w) return 0; if (a.t < w + d.act) return 1; if (a.t < w + d.act + d.rec) return 2; return 3; }
function atkPose(out, a) {
  const d = a.def, w = d.wind + (a.hold || 0), t = a.t, W = POSE[d.w] || IDLE, S = POSE[d.s] || IDLE;
  if (t < d.wind) blendPose(out, IDLE, W, ease(t / d.wind));
  else if (t < w) { blendPose(out, IDLE, W, 1); out.aRx += Math.sin(t * 38) * .025; }
  else if (t < w + d.act) blendPose(out, W, S, 1 - Math.pow(1 - (t - w) / d.act, 2));
  else blendPose(out, S, IDLE, ease(Math.min(1, (t - w - d.act) / d.rec)));
  return out;
}
function fill(o, m) { for (const k of ['pelvis', 'legs', 'shins', 'feet', 'chest', 'arms', 'fore', 'hands', 'helm', 'face', 'skirt', 'dark', 'pauldron', 'grip', 'guard', 'blade', 'shield', 'head', 'chain']) if (!o[k]) o[k] = m; return o; }
function rig(o) {
  const s = o.s || 1, W = o.W || 1, TH = o.torsoH || .55, UL = o.up || .32, FL = o.fore || .3, TL = o.thigh || .42, SL = o.shin || .42, M_ = o.m;
  const hipH = TL + SL + .08;
  const R = new THREE.Group(), spin = new THREE.Group(), hips = new THREE.Group();
  spin.position.y = (hipH - .2) * s; hips.position.y = .2 * s; R.add(spin); spin.add(hips);
  const mesh = (par, geo, mt, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const me = new THREE.Mesh(geo, mt); me.position.set(x * s, y * s, z * s); me.rotation.set(rx, ry, rz); par.add(me); return me; };
  const piv = (par, x, y, z) => { const g = new THREE.Group(); g.position.set(x * s, y * s, z * s); par.add(g); return g; };
  const cy = (rt, rb, h, n = 5, open = false) => cylG(rt * s, rb * s, h * s, n, open);
  const bx = (w, h, d) => bgeo(w * s, h * s, d * s);
  const sp = (r, w = 6, h = 4, tl = Math.PI) => sphG(r * s, w, h, tl);
  const co = (r, h, n = 5) => coneG(r * s, h * s, n);
  mesh(hips, cy(.19 * W, .16 * W, .22, 6), M_.pelvis);
  if (o.skirtH) mesh(hips, cy(.19 * W, .26 * W, o.skirtH, 7, true), M_.skirt, 0, -o.skirtH / 2 + .04, 0);
  if (o.robe) mesh(hips, cy(.2 * W, .36 * W, .85, 7, true), o.robe, 0, -.4, 0);
  const leg = sx => { const hp = piv(hips, sx * .1 * W, -.06, 0); mesh(hp, cy(.085 * W, .065 * W, TL, 5), M_.legs, 0, -TL / 2, 0); const kn = piv(hp, 0, -TL, 0); mesh(kn, cy(.068 * W, .05 * W, SL, 5), M_.shins, 0, -SL / 2, 0); mesh(kn, bx(.12 * W, .08, .25), M_.feet, 0, -SL - .01, .05); return [hp, kn]; };
  const [legL, kneeL] = leg(1), [legR, kneeR] = leg(-1);
  const torso = piv(hips, 0, .08, 0); torso.rotation.order = 'YXZ';
  const chest = mesh(torso, cy(.27 * W, .19 * W, TH, 6), M_.chest, 0, TH / 2, 0, 0, Math.PI / 6); chest.scale.z = o.depth || .7;
  const head = piv(torso, 0, TH + .02, 0);
  const arm = sx => { const sh = piv(torso, sx * (.27 * W + .03), TH - .07, 0); sh.rotation.order = 'YXZ'; mesh(sh, cy(.07 * W, .058 * W, UL, 5), M_.arms, 0, -UL / 2, 0);
    if (o.pauldron) mesh(sh, sp(.14 * W * o.pauldron, 5, 3, Math.PI / 2), M_.pauldron, sx * .02, -.02, 0);
    const el = piv(sh, 0, -UL, 0); mesh(el, cy(.062 * W, .05 * W, FL, 5), M_.fore, 0, -FL / 2, 0);
    const hand = piv(el, 0, -FL - .03, 0); mesh(hand, bx(.085 * W, .1, .1), M_.hands); return [sh, el, hand]; };
  const [armR, elbowR, handR] = arm(-1), [armL, elbowL, handL] = arm(1);
  if (o.head === 'knight') { mesh(head, cy(.14, .155, .27, 6), M_.helm, 0, .15, 0, 0, Math.PI / 6); mesh(head, sp(.142, 6, 3, Math.PI / 2), M_.helm, 0, .285, 0, 0, Math.PI / 6); mesh(head, bx(.19, .026, .03), M_.dark, 0, .17, .125); mesh(head, bx(.025, .09, .27), M_.helm, 0, .35, -.01); mesh(head, bx(.17, .05, .05), M_.helm, 0, .05, .11); }
  else if (o.head === 'hollow') { mesh(head, sp(.125, 5, 4), M_.face, 0, .14, .01); if (o.helm) { mesh(head, cy(.15, .155, .2, 6), M_.helm, 0, .24, 0, 0, Math.PI / 6); mesh(head, cy(.13, .17, .12, 6, true), M_.chain, 0, .05, 0); } }
  else if (o.head === 'hood') { mesh(head, sp(.125, 5, 4), M_.face, 0, .14, .01); mesh(head, co(.19, .42, 6), M_.helm, 0, .26, -.03); }
  else if (o.head === 'great') { mesh(head, cy(.16, .17, .34, 6), M_.helm, 0, .17, 0, 0, Math.PI / 6); mesh(head, bx(.04, .1, .32), M_.helm, 0, .38, 0); mesh(head, bx(.22, .03, .03), M_.dark, 0, .2, .142); mesh(head, bx(.03, .12, .03), M_.dark, 0, .12, .142);
    if (o.horns !== false) for (const sx of [-1, 1]) { const hn = mesh(head, co(.045, .24, 4), M_.helm, sx * .17, .3, 0); hn.rotation.z = -sx * .7; } }
  else if (o.head === 'balder') { mesh(head, cy(.13, .15, .3, 6), M_.helm, 0, .16, 0, 0, Math.PI / 6); mesh(head, co(.15, .14, 6), M_.helm, 0, .37, 0); mesh(head, bx(.18, .025, .03), M_.dark, 0, .19, .13); mesh(head, bx(.03, .25, .03), M_.helm, 0, .52, 0); }
  else if (o.head === 'demon') { mesh(head, bx(.3, .26, .32), M_.head, 0, .12, .04); mesh(head, bx(.2, .15, .22), M_.head, 0, .05, .25); mesh(head, bx(.24, .06, .18), M_.dark, 0, -.04, .2);
    mesh(head, bx(.05, .03, .02), M_.eyes, -.08, .16, .205); mesh(head, bx(.05, .03, .02), M_.eyes, .08, .16, .205);
    for (const sx of [-1, 1]) { const h1 = piv(head, sx * .14, .22, 0); h1.rotation.z = -sx * 1.1; mesh(h1, co(.07, .32, 4), M_.horn, 0, .16, 0); const h2 = piv(h1, 0, .3, 0); h2.rotation.set(-.4, 0, sx * 1.3); mesh(h2, co(.045, .28, 4), M_.horn, 0, .14, 0); } }
  else if (o.head === 'gargoyle') { mesh(head, bx(.24, .22, .26), M_.head, 0, .12, .02); mesh(head, co(.08, .26, 4), M_.head, 0, .08, .24, Math.PI / 2, 0, 0); mesh(head, bx(.04, .03, .02), M_.eyes, -.07, .16, .15); mesh(head, bx(.04, .03, .02), M_.eyes, .07, .16, .15);
    mesh(head, bx(.04, .32, .3), M_.head, 0, .32, -.04); for (const sx of [-1, 1]) { const hn = mesh(head, co(.05, .3, 4), M_.head, sx * .12, .28, -.1); hn.rotation.set(-.7, 0, -sx * .4); } }
  else if (o.head === 'npc') { mesh(head, sp(.125, 5, 4), M_.face, 0, .14, .01); if (o.hat) mesh(head, cy(.2, .2, .04, 7), o.hat, 0, .26, 0); }
  if (o.tabard) { mesh(torso, bx(.24 * W, .82, .02), o.tabard, 0, TH * .3 - .14, .17); mesh(torso, bx(.24 * W, .82, .02), o.tabard, 0, TH * .3 - .14, -.15); mesh(torso, cy(.2 * W, .2 * W, .06, 6), M_.dark, 0, .03, 0); }
  if (o.sun) { mesh(torso, bx(.3 * W, .3, .02), o.sun, 0, TH * .55, .19); }
  if (o.cape) { const cp = piv(torso, 0, TH - .02, -.15); cp.rotation.x = .12; mesh(cp, bx(.5 * W, 1.25, .02), o.cape, 0, -.62, 0); }
  if (o.belly) { const b = mesh(torso, sp(.3, 7, 5), M_.chest, 0, .18, .05); b.scale.set(W * 1.05, .9, .85); }
  let wings = null;
  if (o.wings) { wings = []; for (const sx of [-1, 1]) { const wg = piv(torso, sx * .18, TH - .12, -.18); wg.rotation.set(-.5, sx * .4, -sx * .95); const w = mesh(wg, co(.42, 1.15, 3), o.wings, 0, .55, 0); w.scale.z = .06; wg.userData.sx = sx; wings.push(wg); } }
  let tail = null;
  if (o.tail) { let p = piv(hips, 0, -.04, -.16); p.rotation.x = 2.3; tail = p; for (let i = 0; i < 3; i++) { mesh(p, cy(.08 - i * .022, .06 - i * .022, .45, 5), o.tailMat || M_.chest, 0, .22, 0); p = piv(p, 0, .43, 0); p.rotation.x = -.35; } if (o.tailBlade) mesh(p, co(.07, .3, 3), o.tailBlade, 0, .1, 0); }
  const weapon = new THREE.Group(); handR.add(weapon); let tipY = -.9;
  const wp = o.weapon;
  if (wp === 'sword' || wp === 'longsword' || wp === 'broadsword') { const L = wp === 'broadsword' ? .82 : .92, Wd = wp === 'broadsword' ? .085 : .065; mesh(weapon, cy(.022, .022, .18, 4), M_.grip, 0, .06, 0); mesh(weapon, sp(.035, 4, 3), M_.guard, 0, .17, 0); mesh(weapon, bx(.27, .035, .05), M_.guard, 0, -.04, 0); mesh(weapon, bx(Wd, L, .018), M_.blade, 0, -.06 - L / 2, 0); mesh(weapon, co(Wd * .7, .12, 4), M_.blade, 0, -.12 - L, 0, Math.PI, Math.PI / 4, 0).scale.z = .3; tipY = -.1 - L; }
  else if (wp === 'shortsword' || wp === 'dagger') { const L = wp === 'dagger' ? .3 : .6; mesh(weapon, cy(.02, .02, .14, 4), M_.grip, 0, .05, 0); mesh(weapon, bx(.18, .03, .04), M_.guard, 0, -.03, 0); mesh(weapon, bx(.055, L, .016), M_.blade, 0, -.04 - L / 2, 0); tipY = -.06 - L; }
  else if (wp === 'scimitar') { mesh(weapon, cy(.02, .02, .16, 4), M_.grip, 0, .05, 0); for (let i = 0; i < 4; i++) { const sg = mesh(weapon, bx(.07, .24, .016), M_.blade, .03 * i * i * .4, -.14 - i * .22, 0); sg.rotation.z = -.12 * i; } tipY = -.95; }
  else if (wp === 'broken') { mesh(weapon, cy(.022, .022, .18, 4), M_.grip, 0, .06, 0); mesh(weapon, bx(.2, .035, .05), M_.guard, 0, -.04, 0); mesh(weapon, bx(.06, .5, .018), M_.blade, 0, -.3, 0); mesh(weapon, bx(.04, .12, .018), M_.blade, .012, -.6, 0, 0, 0, .35); tipY = -.6; }
  else if (wp === 'spear') { mesh(weapon, cy(.02, .02, 1.9, 4), M_.grip, 0, -.45, 0); mesh(weapon, co(.05, .28, 4), M_.blade, 0, -1.52, 0, Math.PI, 0, 0); tipY = -1.55; }
  else if (wp === 'rapier') { mesh(weapon, cy(.02, .02, .16, 4), M_.grip, 0, .05, 0); mesh(weapon, sp(.06, 5, 3, Math.PI / 2), M_.guard, 0, -.02, 0, Math.PI, 0, 0); mesh(weapon, bx(.025, 1.0, .015), M_.blade, 0, -.55, 0); tipY = -1.05; }
  else if (wp === 'axe' || wp === 'handaxe' || wp === 'battleaxe') { const L = wp === 'axe' ? 1.55 : wp === 'battleaxe' ? .95 : .6; mesh(weapon, cy(.03, .03, L, 5), M_.grip, 0, .2 - L / 2, 0); const ax = mesh(weapon, bx(.04, L * .27, L * .3), M_.blade, 0, .3 - L * .75, L * .13); ax.rotation.x = .12; tipY = .3 - L * .75; }
  else if (wp === 'club') { mesh(weapon, cy(.045, .09, .8, 5), M_.grip, 0, -.38, 0); tipY = -.75; }
  else if (wp === 'hammer') { mesh(weapon, cy(.045, .05, 1.7, 5), M_.grip, 0, -.55, 0); mesh(weapon, bx(.44, .4, .66), M_.blade, 0, -1.42, 0); mesh(weapon, bx(.48, .08, .7), M_.dark, 0, -1.42, 0); tipY = -1.42; }
  else if (wp === 'greataxe') { mesh(weapon, cy(.05, .05, 2.0, 5), M_.grip, 0, -.7, 0); const ax = mesh(weapon, bx(.05, .7, .8), M_.blade, 0, -1.4, .35); ax.rotation.x = .1; mesh(weapon, bx(.05, .5, .4), M_.blade, 0, -1.4, -.2); tipY = -1.45; }
  else if (wp === 'halberd') { mesh(weapon, cy(.03, .03, 2.4, 5), M_.grip, 0, -.85, 0); mesh(weapon, bx(.04, .55, .45), M_.blade, 0, -1.75, .2); mesh(weapon, co(.05, .35, 4), M_.blade, 0, -2.2, 0, Math.PI, 0, 0); tipY = -1.9; }
  else if (wp === 'crossbow') { mesh(weapon, bx(.07, .7, .08), M_.grip, 0, -.2, 0); mesh(weapon, bx(.75, .05, .05), M_.blade, 0, -.5, 0); tipY = -.55; }
  else if (wp === 'firebomb') { mesh(weapon, sp(.09, 5, 4), M_.grip, 0, -.05, 0); tipY = -.05; }
  else if (wp === 'catalyst') { mesh(weapon, cy(.018, .022, .6, 4), M_.grip, 0, -.2, 0); mesh(weapon, sp(.05, 4, 3), M_.blade, 0, -.52, 0); tipY = -.55; }
  const tip = piv(weapon, 0, tipY, 0);
  let shield = null;
  if (o.shield) { shield = piv(elbowL, .075, -FL * .55, 0);
    if (o.shield === 'heater') { const sm = mesh(shield, cy(.27, .27, .05, 5), M_.shield, 0, 0, .08, Math.PI / 2, 0, 0); sm.scale.z = 1.3; }
    else if (o.shield === 'tower') { mesh(shield, bx(.55, .95, .06), M_.shield, 0, .05, .09); }
    else if (o.shield === 'small') { mesh(shield, cy(.17, .17, .04, 8), M_.shield, 0, 0, .07, Math.PI / 2, 0, 0); mesh(shield, sp(.05, 5, 3, Math.PI / 2), M_.guard || M_.dark, 0, 0, .09, Math.PI / 2, 0, 0); }
    else if (o.shield === 'talisman') { mesh(shield, bx(.12, .2, .03), M_.shield, 0, 0, .08); }
    else { mesh(shield, cy(.27, .27, .05, 8), M_.shield, 0, 0, .08, Math.PI / 2, 0, 0); mesh(shield, sp(.06, 5, 3, Math.PI / 2), M_.guard || M_.dark, 0, 0, .105, Math.PI / 2, 0, 0); } }
  /* a flask that appears in the off hand while drinking */
  const flask = new THREE.Mesh(sphG(.07 * s, 5, 4), M.flask || M_.dark); flask.position.set(0, -FL - .08 * s, .05 * s); elbowL.add(flask); flask.visible = false;
  flask.userData.keep = true; compactRig(R);
  return { root: R, spin, hips, torso, head, armR, armL, elbowR, elbowL, legR, legL, kneeR, kneeL, weapon, tip, shield, flask, wings, tail, s, twoHand: !!o.twoHand, baseSpin: (hipH - .2) * s, bias: o.bias || null, handR, handL };
}
function applyPose(m, p, t = 0) {
  const b = m.bias;
  m.torso.rotation.y = p.tY; m.torso.rotation.x = p.tX + (b ? b.tX : 0);
  m.armR.rotation.set(p.aRx, p.aRy, p.aRz); m.elbowR.rotation.x = p.eR; m.weapon.rotation.x = p.wx;
  if (m.twoHand) { m.armL.rotation.set(p.aRx + .1, p.aRy + .4, -p.aRz); m.elbowL.rotation.x = p.eR; }
  else { m.armL.rotation.set(p.aLx, p.aLy, .1); m.elbowL.rotation.x = p.eL; }
  if (m.shield) m.shield.rotation.x = -(p.aLx + p.eL);
  m.legL.rotation.x = p.lL; m.legR.rotation.x = p.lR; m.kneeL.rotation.x = p.kL; m.kneeR.rotation.x = p.kR;
  m.spin.rotation.x = p.spin; m.spin.position.y = m.baseSpin + p.hY * m.s; m.head.rotation.x = p.hd + (b ? b.hd : 0);
  if (m.wings) for (const w of m.wings) { const sx = w.userData.sx; const f = m.flap || 0; w.rotation.z = -sx * (.95 - Math.sin(t * 9) * .6 * f); w.rotation.x = -.5 + f * .3; }
  if (m.tail) m.tail.rotation.y = Math.sin(t * 2) * .2 + (m.tailSwing || 0);
}
function poseFree(p, amt, ph, blocking, sprint) {
  copyPose(p, IDLE); const s = Math.sin(ph), a = Math.min(1, amt);
  p.lL = s * .6 * a; p.lR = -s * .6 * a; p.kL = .08 + Math.max(0, Math.sin(ph - 1.57)) * .95 * a; p.kR = .08 + Math.max(0, Math.sin(ph + 1.57)) * .95 * a;
  p.aRx += -s * .25 * a; p.aLx += s * .2 * a; p.hY = -Math.abs(Math.cos(ph)) * .05 * a;
  if (sprint) { p.tX = .3; p.aRx = .5 - s * .6; p.eR = -.9; p.wx = -1.2; p.aLx = .3 + s * .6; p.eL = -1.2; p.lL = s * .95; p.lR = -s * .95; p.kL = .1 + Math.max(0, Math.sin(ph - 1.57)) * 1.4; p.kR = .1 + Math.max(0, Math.sin(ph + 1.57)) * 1.4; }
  if (blocking) { p.aLx = -1.0; p.eL = -.75; p.aLy = -.6; }
  return p;
}

/* ---------------- quadrupeds: dog and armored boar ---------------- */
function quad(o) {
  const s = o.s || 1, R = new THREE.Group(), body = new THREE.Group(); R.add(body);
  const L = o.len || 1, H = o.legH || .45;
  body.position.y = H * s;
  const mesh = (par, geo, mt, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const me = new THREE.Mesh(geo, mt); me.position.set(x * s, y * s, z * s); me.rotation.set(rx, ry, rz); par.add(me); return me; };
  const tor = mesh(body, cylG(o.girth * s, o.girth * .85 * s, L * s, 6), o.mat, 0, .05, 0, Math.PI / 2, 0, 0); tor.scale.x = o.wide || 1;
  if (o.armor) { mesh(body, cylG(o.girth * 1.12 * s, o.girth * 1.12 * s, L * .7 * s, 6, true), o.armor, 0, .1, -.05, Math.PI / 2, 0, 0); }
  const neck = new THREE.Group(); neck.position.set(0, .12 * s, L * .5 * s); body.add(neck);
  const head = mesh(neck, bgeo(o.headW * s, o.headW * .9 * s, o.headL * s), o.headMat || o.mat, 0, 0, o.headL * .45);
  if (o.snout) mesh(neck, coneG(o.headW * .4 * s, o.headL * .6 * s, 4), o.mat, 0, -.03, o.headL * 1.05, Math.PI / 2, 0, 0);
  if (o.tusks) for (const sx of [-1, 1]) mesh(neck, coneG(.03 * s, .25 * s, 3), o.tusks, sx * .1, -.08, o.headL * .9, -.4, 0, 0);
  if (o.ears) for (const sx of [-1, 1]) mesh(neck, coneG(.04 * s, .12 * s, 3), o.mat, sx * .07, .1, o.headL * .2);
  if (o.eyes) for (const sx of [-1, 1]) mesh(neck, bgeo(.03 * s, .02 * s, .02 * s), o.eyes, sx * .06, .05, o.headL * .9);
  const legs = [];
  for (const [lx, lz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const p = new THREE.Group(); p.position.set(lx * o.girth * .7 * s, 0, lz * L * .38 * s); body.add(p); mesh(p, cylG(.06 * s * (o.legW || 1), .045 * s * (o.legW || 1), H * s, 4), o.legMat || o.mat, 0, -H / 2, 0); legs.push(p); }
  if (o.tail) { const t = mesh(body, cylG(.03 * s, .015 * s, .4 * s, 3), o.mat, 0, .15, -L * .55); t.rotation.x = -.8; }
  return { root: R, body, neck, legs, s, H };
}
function poseQuad(q, ph, amt, t, extra = {}) {
  q.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * .7 * amt; });
  q.body.position.y = q.H * q.s + Math.abs(Math.sin(ph)) * .05 * amt * q.s + (extra.hop || 0);
  q.body.rotation.x = extra.pitch || 0;
  q.neck.rotation.x = (extra.head || 0) + Math.sin(t * 3) * .05;
}

/* ---------------- the red drake that guards the bridge ---------------- */
function drakeRig(mat1, mat2, eyes) {
  const R = new THREE.Group(), body = new THREE.Group(); R.add(body);
  const m = (par, geo, mt, x, y, z, rx = 0, ry = 0, rz = 0) => { const me = new THREE.Mesh(geo, mt); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); par.add(me); return me; };
  m(body, cylG(1.1, .8, 4.6, 7), mat1, 0, 0, 0, Math.PI / 2, 0, 0);
  const neck = new THREE.Group(); neck.position.set(0, .5, 2.2); body.add(neck); neck.rotation.x = -.5;
  m(neck, cylG(.45, .7, 2.6, 6), mat1, 0, 0, 1.2, Math.PI / 2, 0, 0);
  const head = new THREE.Group(); head.position.set(0, 0, 2.6); neck.add(head);
  m(head, bgeo(.8, .65, 1.3), mat1, 0, 0, .4); m(head, coneG(.35, 1.0, 4), mat1, 0, -.1, 1.4, Math.PI / 2, Math.PI / 4, 0);
  m(head, bgeo(.1, .06, .05), eyes, -.3, .15, .9); m(head, bgeo(.1, .06, .05), eyes, .3, .15, .9);
  for (const sx of [-1, 1]) m(head, coneG(.1, .9, 4), mat2, sx * .3, .4, -.2, -1.1, 0, 0);
  const tail = new THREE.Group(); tail.position.set(0, 0, -2.2); body.add(tail);
  m(tail, cylG(.75, .1, 5, 6), mat1, 0, 0, -2.4, -Math.PI / 2, 0, 0);
  const wings = [];
  for (const sx of [-1, 1]) { const w = new THREE.Group(); w.position.set(sx * .9, .6, .6); body.add(w); w.userData.sx = sx;
    const arm = m(w, cylG(.12, .08, 4.5, 4), mat2, sx * 2.2, 0, 0, 0, 0, Math.PI / 2);
    const memb = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.4, 2, 2), mat2); memb.rotation.x = -Math.PI / 2; memb.position.set(sx * 2.3, -.05, -1.6); w.add(memb);
    wings.push(w); }
  const legs = [];
  for (const sx of [-1, 1]) { const l = new THREE.Group(); l.position.set(sx * .8, -.4, -.6); body.add(l); m(l, cylG(.3, .18, 1.6, 5), mat1, 0, -.8, 0); legs.push(l); }
  R.scale.setScalar(1.2);
  return { root: R, body, neck, head, tail, wings, legs };
}
