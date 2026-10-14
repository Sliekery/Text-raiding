/* Input (keyboard, mouse, touch, gamepad), camera, HUD, menus, NPC dialog, bonfires, fog gates, lift and the bell. */
'use strict';
/* ---------------- input ---------------- */
const BTN = ['light', 'heavy', 'roll', 'block', 'parry', 'item', 'cycle', 'lock', 'interact', 'cast', 'twohand', 'pause'];
const btn = {}; BTN.forEach(n => btn[n] = { down: false, pressed: false, released: false, t: 0 });
function press(n) { const b = btn[n]; if (!b.down) { b.down = true; b.pressed = true; b.t = 0; } }
function release(n) { const b = btn[n]; if (b.down) { b.down = false; b.released = true; } }
const keys = {}; const camIn = { dx: 0, dy: 0, swipe: 0, swCd: 0 };
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }; const camT = { id: null, lx: 0, ly: 0 };
const gp = { mx: 0, my: 0, cx: 0, cy: 0, prev: [] };
function clearInputs() { BTN.forEach(n => { btn[n].down = false; btn[n].pressed = false; btn[n].released = false; }); joy.id = null; joy.x = joy.y = 0; camT.id = null; Object.keys(keys).forEach(k => keys[k] = false); $('#joyBase').classList.remove('on'); document.querySelectorAll('.pb.on').forEach(b => b.classList.remove('on')); }
const KEYMAP = { KeyJ: 'light', KeyK: 'heavy', KeyL: 'block', KeyG: 'parry', Space: 'roll', KeyR: 'item', KeyV: 'cycle', KeyQ: 'lock', Tab: 'lock', KeyE: 'interact', KeyF: 'interact', KeyC: 'cast', KeyT: 'twohand', Escape: 'pause', KeyP: 'pause' };
function setMode(m) { if (G.inputMode === m) return; G.inputMode = m; updatePromptKey(); }
const pickMode = (t, k, p) => G.inputMode === 'touch' ? t : G.inputMode === 'pad' ? p : k;
addEventListener('keydown', e => { if (e.code === 'Tab' || e.code === 'Space') e.preventDefault(); if (e.repeat) return; keys[e.code] = true; setMode('kb'); const n = KEYMAP[e.code]; if (n) { press(n); e.preventDefault(); } });
addEventListener('keyup', e => { keys[e.code] = false; const n = KEYMAP[e.code]; if (n) release(n); });
addEventListener('blur', () => clearInputs());
const touchEl = $('#touch'); let md = null;
function locked() { return document.pointerLockElement === touchEl; }
touchEl.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') {
    if (!G.running || G.paused) return; setMode('kb');
    if (!locked()) { try { const r = touchEl.requestPointerLock && touchEl.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) {} }
    if (e.button === 0) { if (locked()) press(e.shiftKey ? 'heavy' : 'light'); else md = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), shift: e.shiftKey, moved: 0 }; }
    if (e.button === 2) press(e.shiftKey ? 'parry' : 'block');
    if (e.button === 1) press('parry');
    return;
  }
  e.preventDefault(); enableTouchUI(); setMode('touch');
  if (e.clientX < innerWidth * .42 && joy.id === null) { joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0; placeJoy(); }
  else if (camT.id === null) { camT.id = e.pointerId; camT.lx = e.clientX; camT.ly = e.clientY; }
  try { touchEl.setPointerCapture(e.pointerId); } catch (err) {}
});
touchEl.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { if (md && !locked()) { camIn.dx += e.clientX - md.lx; camIn.dy += e.clientY - md.ly; md.moved += Math.abs(e.clientX - md.lx) + Math.abs(e.clientY - md.ly); md.lx = e.clientX; md.ly = e.clientY; } return; }
  if (e.pointerId === joy.id) { let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const R = 52, l = Math.hypot(dx, dy); if (l > R) { joy.ox += dx / l * (l - R); joy.oy += dy / l * (l - R); dx = dx / l * R; dy = dy / l * R; } joy.x = dx / R; joy.y = -dy / R; placeJoy(); }
  else if (e.pointerId === camT.id) { camIn.dx += (e.clientX - camT.lx) * 1.6; camIn.dy += (e.clientY - camT.ly) * 1.6; camT.lx = e.clientX; camT.ly = e.clientY; }
});
function tUp(e) {
  if (e.pointerType === 'mouse') {
    if (e.button === 0) { if (locked()) { release('light'); release('heavy'); } else if (md) { if (md.moved < 8 && performance.now() - md.t < 350) { const n = md.shift ? 'heavy' : 'light'; press(n); release(n); } md = null; } }
    if (e.button === 2) { release('block'); release('parry'); } if (e.button === 1) release('parry'); return;
  }
  if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; placeJoy(); }
  if (e.pointerId === camT.id) camT.id = null;
}
touchEl.addEventListener('pointerup', tUp); touchEl.addEventListener('pointercancel', tUp);
document.addEventListener('mousemove', e => { if (locked() && !G.paused) { camIn.dx += e.movementX; camIn.dy += e.movementY; } });
touchEl.addEventListener('contextmenu', e => e.preventDefault());
['gesturestart', 'dblclick'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
document.addEventListener('touchmove', e => { if (!e.target.closest('.screen,.panel')) e.preventDefault(); }, { passive: false });
const joyBase = $('#joyBase'), joyKnob = $('#joyKnob');
function placeJoy() {
  if (joy.id === null) { joyBase.classList.remove('on'); joyBase.style.left = '86px'; joyBase.style.top = (innerHeight - 110) + 'px'; joyKnob.style.transform = ''; return; }
  joyBase.classList.add('on'); joyBase.style.left = joy.ox + 'px'; joyBase.style.top = joy.oy + 'px'; joyKnob.style.transform = `translate(${joy.x * 52}px,${-joy.y * 52}px)`;
}
document.querySelectorAll('.pb').forEach(el => { const n = el.dataset.b;
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch (err) {} el.classList.add('on'); press(n); setMode('touch'); });
  const up = () => { el.classList.remove('on'); release(n); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up); el.addEventListener('contextmenu', e => e.preventDefault());
});
function enableTouchUI() { if (G.touchUI) return; G.touchUI = true; document.body.classList.add('touch'); $('#pad').hidden = !G.running; placeJoy(); }
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; let g = null; for (const p of pads) if (p && p.connected) { g = p; break; }
  if (!g) { gp.mx = gp.my = gp.cx = gp.cy = 0; return; }
  const dz = v => Math.abs(v) < .18 ? 0 : (v - Math.sign(v) * .18) / .82;
  const map = { 0: 'interact', 1: 'roll', 2: 'item', 3: 'twohand', 4: 'block', 5: 'light', 6: 'parry', 7: 'heavy', 9: 'pause', 11: 'lock', 12: 'cast', 13: 'cycle', 15: 'cycle' };
  let any = false;
  for (const k in map) { const b = g.buttons[k]; const v = !!(b && (b.pressed || b.value > .5)); if (v && !gp.prev[k]) { press(map[k]); any = true; } if (!v && gp.prev[k]) release(map[k]); gp.prev[k] = v; }
  gp.mx = dz(g.axes[0] || 0); gp.my = -dz(g.axes[1] || 0); gp.cx = dz(g.axes[2] || 0); gp.cy = dz(g.axes[3] || 0);
  if (any || Math.abs(gp.mx) + Math.abs(gp.my) + Math.abs(gp.cx) > .3) setMode('pad');
}
function moveVec() {
  let x = 0, y = 0;
  const kx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), ky = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  if (kx || ky) { const l = Math.hypot(kx, ky); x = kx / l; y = ky / l; }
  const jl = Math.hypot(joy.x, joy.y); if (jl > .12) { const m = clamp((jl - .12) / .7, 0, 1); x = joy.x / jl * m; y = joy.y / jl * m; }
  if (Math.hypot(gp.mx, gp.my) > Math.hypot(x, y)) { x = gp.mx; y = gp.my; }
  return { x, y };
}

/* ---------------- camera ---------------- */
const C = { yaw: 0, pitch: .32, dist: 4.4, cd: 4.4, idle: 0 };
const camLook = new V3(), camPos = new V3();
function camCollide(from, dir, maxD) {
  for (let s = .35; s <= maxD; s += .15) {
    const x = from.x + dir.x * s, y = from.y + dir.y * s, z = from.z + dir.z * s;
    if (y < groundAt(x, z, y + .3) + .25) return Math.max(.6, s - .15);
    if (solidAt(x, y, z, .22)) return Math.max(.6, s - .2);
  }
  return maxD;
}
function toggleLock() {
  if (P.lock) { P.lock = null; return; }
  const t = findTarget(0); if (t) { P.lock = t; sfx('click'); }
  else { C.yaw = P.yaw + Math.PI; C.pitch = .3; }
}
function findTarget(dir) {
  let best = null, bs = 1e9; const fwd = Math.atan2(-Math.sin(C.yaw), -Math.cos(C.yaw));
  let cur = null; if (dir && P.lock) { tmpV.set(P.lock.pos.x, P.lock.pos.y + 1, P.lock.pos.z).project(camera); cur = tmpV.x; }
  for (const e of enemies) { if (!e.alive || !e.active || e.state === 'perch' || e === P.lock && dir) continue; const d = e.pos.distanceTo(P.pos); if (d > 20) continue;
    if (dir) { tmpV.set(e.pos.x, e.pos.y + 1, e.pos.z).project(camera); if (tmpV.z > 1) continue; const dx = tmpV.x - cur; if (dx * dir <= 0) continue; if (Math.abs(dx) < bs) { bs = Math.abs(dx); best = e; } }
    else { const a = Math.abs(angDiff(fwd, yawTo(P.pos, e.pos))); if (a > 1.2) continue; const sc = a * 6 + d; if (sc < bs) { bs = sc; best = e; } } }
  return best;
}
function updateCamera(dt) {
  if (!G.running) { const t = performance.now() / 1000 * .1, b = AREA.firelink.pos; camPos.set(b.x + Math.sin(t) * 7, 3.2, b.z + Math.cos(t) * 7); camera.position.copy(camPos); camera.lookAt(b.x, 1.4, b.z - 4); return; }
  const sens = .0042 * G.sens;
  let cdx = camIn.dx, cdy = camIn.dy; camIn.dx = camIn.dy = 0;
  cdx += gp.cx * 900 * dt; cdy += gp.cy * 600 * dt;
  if (keys.ArrowLeft) cdx -= 700 * dt; if (keys.ArrowRight) cdx += 700 * dt; if (keys.ArrowUp) cdy -= 500 * dt; if (keys.ArrowDown) cdy += 500 * dt;
  if (G.invY) cdy = -cdy;
  const lockT = lockTarget();
  if (P.lock && (!P.lock.alive || P.lock.pos.distanceTo(P.pos) > 26)) P.lock = null;
  camIn.swCd -= dt;
  const head = new V3(P.pos.x, P.pos.y + 1.5, P.pos.z);
  if (lockT) {
    camIn.swipe += cdx; camIn.swipe *= Math.exp(-6 * dt);
    if (Math.abs(camIn.swipe) > 55 && camIn.swCd <= 0) { const n = findTarget(Math.sign(camIn.swipe)); if (n) P.lock = n; camIn.swipe = 0; camIn.swCd = .35; }
    const desired = Math.atan2(P.pos.x - lockT.pos.x, P.pos.z - lockT.pos.z);
    if (distXZ(P.pos, lockT.pos) > .8) C.yaw = dampAng(C.yaw, desired, 6, dt);
    const dy = (lockT.pos.y + lockT.lift) - P.pos.y; C.pitch = damp(C.pitch, clamp((lockT.isBoss ? .34 : .24) - dy * .04, -.2, .9), 4, dt);
    camLook.copy(head).lerp(tmpV.set(lockT.pos.x, lockT.pos.y + 1.1 * lockT.T.s + lockT.lift * .5, lockT.pos.z), .35);
  } else {
    C.yaw -= cdx * sens; C.pitch = clamp(C.pitch + cdy * sens, -.45, 1.2);
    if (Math.abs(cdx) + Math.abs(cdy) > .5) C.idle = 0; else C.idle += dt;
    const mv = moveVec();
    if (C.idle > 1.2 && Math.hypot(mv.x, mv.y) > .3 && P.state === 'free') { const behind = P.yaw + Math.PI; if (Math.abs(angDiff(C.yaw, behind)) < 1.8) C.yaw = dampAng(C.yaw, behind, .9 * Math.abs(mv.x), dt); }
    camLook.copy(head);
  }
  if (P.state === 'climb') { C.yaw = dampAng(C.yaw, P.yaw + Math.PI, 3, dt); C.pitch = damp(C.pitch, .15, 3, dt); }
  const portrait = innerHeight > innerWidth;
  const D = C.dist * (lockT && lockT.isBoss ? 1.35 : 1) * (portrait ? 1.25 : 1);
  const off = new V3(Math.sin(C.yaw) * Math.cos(C.pitch), Math.sin(C.pitch), Math.cos(C.yaw) * Math.cos(C.pitch));
  const allowed = camCollide(head, off, D);
  C.cd = allowed < C.cd ? allowed : damp(C.cd, allowed, 4, dt);
  camPos.copy(head).addScaledVector(off, C.cd);
  if (G.shake > 0) { camPos.x += rand(-1, 1) * G.shake * .25; camPos.y += rand(-1, 1) * G.shake * .25; G.shake = Math.max(0, G.shake - dt * 1.8); }
  camera.position.copy(camPos); camera.lookAt(camLook);
}

/* ---------------- interactions ---------------- */
function updateInteract(dt) {
  let best = null, bd = 1e9;
  if (P.state === 'free' && P.onGround && !G.ended && !G.menu) for (const it of interacts) { if (!it.on()) continue; const d = Math.hypot(P.pos.x - it.pos.x, P.pos.z - it.pos.z); if (d < it.r && Math.abs(P.pos.y - it.pos.y) < 1.6 && d < bd) { bd = d; best = it; } }
  if (best !== G.inter) { G.inter = best; const b = $('#interactBtn'); b.hidden = !best; }
  if (best) $('#interactLbl').textContent = best.label();
  if (btn.interact.pressed) {
    if (!$('#talk').hidden) advanceTalk();
    else if (!$('#note').hidden) hideNote();
    else if (G.inter) { const it = G.inter; G.inter = null; $('#interactBtn').hidden = true; it.act(); }
  }
  if (!$('#note').hidden) { G.noteT -= dt; if (G.noteT <= 0 || distXZ(P.pos, G.notePos) > 3.5) hideNote(); }
  if (!$('#talk').hidden && G.talkNpc && distXZ(P.pos, G.talkNpc.pos) > 4) hideTalk();
  for (const t of triggers) { if (t.done) continue; if (P.pos.x > t.x0 && P.pos.x < t.x1 && P.pos.z > t.z0 && P.pos.z < t.z1 && P.pos.y > t.y0 && P.pos.y < t.y1) { t.fn(); if (t.once) t.done = true; } }
}
$('#interactBtn').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); press('interact'); setTimeout(() => release('interact'), 60); });
$('#talk').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); advanceTalk(); });
function updatePromptKey() { const k = $('#interactKey'); k.hidden = G.inputMode === 'touch'; k.textContent = G.inputMode === 'pad' ? 'A' : 'E'; }
function fogSide(f) { const n = f.alongX ? [0, 1] : [1, 0]; return Math.sign((P.pos.x - f.center.x) * n[0] + (P.pos.z - f.center.z) * n[1]) || 1; }
function enterFog(f) {
  const n = f.alongX ? new V3(0, 0, 1) : new V3(1, 0, 0), side = fogSide(f);
  P.fogFrom = P.pos.clone(); P.fogTo = f.center.clone().addScaledVector(n, -side * 1.7); P.fogTo.y = f.center.y; P.fogGate = f; f.set(false); P.lock = null; startState('fog'); sfx('fog');
}
function restAt(b, silent) {
  if (!b.lit) { b.setLit(true); banner('BONFIRE LIT', 'ember', 2.6); }
  G.lastBonfire = b; P.state = 'rest'; P.st = 0; P.lock = null; P.yaw = yawTo(P.pos, b.pos);
  P.hp = hpMax(); P.hpTrail = P.hp; P.stam = stMax(); refillAtBonfire(b); resetWorld(); sfx('rest');
  emit(b.pos.x, b.pos.y + .8, b.pos.z, 30, { color: [0xff9a40, 0xffd090], speed: 1.5, up: 2, grav: -1, life: 1.2, size: .07, jit: .4 });
  if (!silent) openBonfire(b); else P.state = 'free';
}
function useLift(down) {
  if (!down && !G.liftUnlocked) { toast('The lift is somewhere above. It will not come.'); sfx('nope'); return; }
  P.state = 'lift'; P.lock = null; $('#fade').style.opacity = 1; sfx('door');
  setTimeout(() => { const to = down ? AREA.liftLow : AREA.liftHigh; P.pos.copy(to); P.onGround = true; P.vy = 0; G.liftUnlocked = true; P.state = 'free'; $('#fade').style.opacity = 0; if (down) toast('A lift between Firelink and the Parish'); }, 1400);
}
function ringBell() {
  G.bellRung = true; sfx('bell'); shake(.4); setTimeout(() => sfx('bell'), 1800);
  banner('THE FIRST BELL TOLLS', 'gold', 6); setTimeout(showEnd, 6500);
}

/* ---------------- dialog / notes / toasts / banners ---------------- */
let toastT = null;
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
let bannerT = null;
function banner(text, cls, dur) { const b = $('#banner'); $('#bannerText').textContent = text; b.className = 'show ' + (cls || ''); clearTimeout(bannerT); if (dur < 90) bannerT = setTimeout(hideBanner, dur * 1000); }
function hideBanner() { $('#banner').className = ''; }
function showNote(t) { $('#noteText').textContent = t; $('#note').hidden = false; G.noteT = 9; G.notePos = P.pos.clone(); sfx('click'); }
function hideNote() { $('#note').hidden = true; }
let popT = null;
function itemPopup(id, qty) { const el = $('#itemPop'); el.textContent = `${ITEMS[id].name}${qty > 1 ? ' ×' + qty : ''}`; el.hidden = false; clearTimeout(popT); popT = setTimeout(() => el.hidden = true, 2600); }
function talk(n) { G.talkNpc = n; n.li = 0; showTalkLine(); }
function showTalkLine() { const n = G.talkNpc; $('#talkName').textContent = n.name.toUpperCase(); $('#talkText').textContent = n.lines[n.li]; $('#talkMore').textContent = pickMode('Tap to continue', 'Press E to continue', 'Press A to continue'); $('#talk').hidden = false; sfx('click'); }
function advanceTalk() { const n = G.talkNpc; if (!n) return hideTalk(); n.li++; if (n.li < n.lines.length) showTalkLine(); else { hideTalk(); if (n.kind === 'merchant') openShop('merchant'); if (n.kind === 'andre') openShop('andre'); } }
function hideTalk() { $('#talk').hidden = true; G.talkNpc = null; }
let gainT = null, gainAcc = 0;
function showGain(n) { gainAcc += n; $('#soulGain').textContent = '+' + gainAcc; clearTimeout(gainT); gainT = setTimeout(() => { gainAcc = 0; $('#soulGain').textContent = ''; }, 2200); }

/* ---------------- icons ---------------- */
const ICON = {
  sword: '<path d="M19 4l-9.5 9.5M19 4h-3.2M19 4v3.2M7.5 11.5l5 5M9.5 14.5L5 19"/>',
  axe: '<path d="M6 20L17 7"/><path d="M14 4c3 0 6 3 6 6l-4 1-3-3z"/>',
  spear: '<path d="M5 19L18 6M18 6l1-3-3 1z"/>',
  hammer: '<path d="M7 19l8-8M12 8l4-4 4 4-4 4z"/>',
  shield: '<path d="M12 3l7 2.6v5.2c0 4.8-3 8-7 10.2-4-2.2-7-5.4-7-10.2V5.6z"/>',
  flask: '<path d="M10 3h4M10.5 3v5l-4 7a4 4 0 0 0 3.5 6h4a4 4 0 0 0 3.5-6l-4-7V3" fill="#b8601e" stroke="#f0c08a"/>',
  bomb: '<circle cx="12" cy="14" r="6"/><path d="M14 8l2-3M16 5l2 1"/>',
  knife: '<path d="M5 19l9-9M14 10l5-5-1 4z"/>',
  soul: '<circle cx="12" cy="12" r="4" fill="#cfe3ff"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/>',
  humanity: '<circle cx="12" cy="12" r="6" fill="#111" stroke="#ddd3bd"/>',
  herb: '<path d="M12 20v-8M12 12c-4 0-6-3-6-6 4 0 6 3 6 6zM12 12c4 0 6-3 6-6-4 0-6 3-6 6z"/>',
  resin: '<path d="M9 4h6v4l2 3v8H7v-8l2-3z" fill="#c8a040"/>',
  bone: '<path d="M7 17l10-10M5 15a2 2 0 1 0 2 4M17 9a2 2 0 1 0 2-4M9 19a2 2 0 1 0-4-2M15 5a2 2 0 1 0 4 2"/>',
  spell: '<path d="M12 3l2 6 6 .5-4.6 4 1.5 6.5L12 16.5 7.1 20l1.5-6.5L4 9.5l6-.5z"/>',
  none: '',
};
function weaponIcon(id) { const t = WEAPONS[id].type; return t === 'axe' ? ICON.axe : t === 'spear' || t === 'halberd' || t === 'thrust' ? ICON.spear : t === 'hammer' ? ICON.hammer : ICON.sword; }

/* ---------------- HUD ---------------- */
const hpBar = $('#hpBar'), stBar = $('#stBar'), hpFill = hpBar.querySelector('.fill'), hpTrail = hpBar.querySelector('.trail'), stFill = stBar.querySelector('.fill');
let hudCache = {};
function setHTML(id, html) { if (hudCache[id] !== html) { hudCache[id] = html; $(id).innerHTML = html; } }
function setText(id, t) { if (hudCache[id] !== t) { hudCache[id] = t; $(id).textContent = t; } }
function updateHUD(dt) {
  if (!G.running) return;
  const hm = hpMax(), sm = stMax();
  hpBar.style.width = Math.min(hm * .42, innerWidth * .5) + 'px'; stBar.style.width = Math.min(sm * 1.9, innerWidth * .45) + 'px';
  hpFill.style.width = (Math.max(0, P.hp) / hm * 100) + '%'; hpTrail.style.width = (Math.max(0, P.hpTrail) / hm * 100) + '%';
  stFill.style.width = (Math.max(0, P.stam) / sm * 100) + '%';
  setText('#hum', String(P.humanity)); $('#hum').classList.toggle('human', P.human);
  const buffs = []; if (P.resinT > 0) buffs.push('Lightning ' + Math.ceil(P.resinT) + 's'); if (P.blossomT > 0) buffs.push('Green Blossom ' + Math.ceil(P.blossomT) + 's'); if (P.twoHand) buffs.push('Two-handing');
  setText('#buffs', buffs.join(' · '));
  const id = P.belt[P.beltI]; const cnt = id ? beltCount(id) : 0;
  setHTML('#icRight', weaponIcon(P.wpn)); setHTML('#icLeft', P.twoHand ? '' : ICON.shield); setHTML('#icSpell', P.spell ? ICON.spell : ''); setHTML('#icItem', id ? ICON[ITEMS[id].icon] || '' : '');
  setText('#eqItemN', id ? String(cnt) : ''); setText('#eqSpellN', P.spell ? String(P.spellUses) : '');
  setText('#eqLabel', id ? ITEMS[id].name : '');
  setHTML('#padItemIc', id ? ICON[ITEMS[id].icon] || '' : ''); setText('#itemBadge', String(cnt));
  if (P.spell) { $('#bCast').hidden = false; setText('#castBadge', String(P.spellUses)); }
  P.soulsShown = Math.abs(P.soulsShown - P.souls) < 1 ? P.souls : damp(P.soulsShown, P.souls, 6, dt); setText('#soulsN', String(Math.round(P.soulsShown)));
  const f = G.bossFight; if (f) for (const b of f.bars) { if (!b.barEl) continue; const k = Math.max(0, b.hp) / b.T.hp; b.barEl.querySelector('.fill').style.width = k * 100 + '%'; b.trailV = b.trailV < k ? k : (b.dmgT > 0 ? b.trailV : damp(b.trailV, k, 3, dt)); b.barEl.querySelector('.trail').style.width = b.trailV * 100 + '%'; b.barEl.querySelector('.bossDmg').textContent = b.dmgT > 0 ? b.dmgAcc : ''; }
}
const ov = $('#ov'), octx = ov.getContext('2d'); let ovDpr = 1;
function drawOverlay() {
  octx.clearRect(0, 0, ov.width, ov.height); if (!G.running) return;
  const W = innerWidth, H = innerHeight; octx.save(); octx.scale(ovDpr, ovDpr);
  for (const e of enemies) {
    if (!e.alive || e.isBoss || e.barT <= 0 || !e.active) continue;
    tmpV.set(e.pos.x, e.pos.y + 2.05 * e.T.s + e.lift, e.pos.z).project(camera); if (tmpV.z > 1) continue;
    const x = (tmpV.x + 1) / 2 * W, y = (1 - tmpV.y) / 2 * H, w = 52;
    octx.fillStyle = 'rgba(0,0,0,.7)'; octx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6); octx.fillStyle = '#9b2a22'; octx.fillRect(x - w / 2, y, w * Math.max(0, e.hp) / e.T.hp, 4);
    if (e.dmgT > 0) { octx.font = '14px "IM Fell English",Georgia,serif'; octx.fillStyle = '#ddd3bd'; octx.textAlign = 'left'; octx.fillText(e.dmgAcc, x + w / 2 + 4, y + 6); }
  }
  const t = P.lock;
  if (t && t.alive) { tmpV.set(t.pos.x, t.pos.y + 1.15 * t.T.s + t.lift, t.pos.z).project(camera); if (tmpV.z < 1) { const x = (tmpV.x + 1) / 2 * W, y = (1 - tmpV.y) / 2 * H;
    octx.strokeStyle = 'rgba(0,0,0,.8)'; octx.lineWidth = 4; octx.beginPath(); octx.arc(x, y, 6, 0, TAU); octx.stroke(); octx.strokeStyle = '#f4ead6'; octx.lineWidth = 2; octx.beginPath(); octx.arc(x, y, 6, 0, TAU); octx.stroke(); } }
  octx.restore();
}

/* ---------------- bonfire menu ---------------- */
function openBonfire(b) { G.menu = 'bonfire'; G.bf = b; document.exitPointerLock && document.exitPointerLock(); clearInputs(); $('#levelUp').hidden = true; renderBonfire(); $('#bonfireMenu').hidden = false; }
function closeBonfire() { $('#bonfireMenu').hidden = true; G.menu = null; if (P.state === 'rest') { P.state = 'free'; P.st = 0; } }
function renderBonfire() {
  const b = G.bf; $('#bfName').textContent = b.name; $('#bfLevel').textContent = playerLevel(); $('#bfSouls').textContent = P.souls; $('#bfHum').textContent = P.humanity;
  const acts = [];
  acts.push(['Level up', () => { $('#levelUp').hidden = !$('#levelUp').hidden; renderLevel(); }, true]);
  if (!P.human) acts.push(['Reverse hollowing (1 humanity)', () => { P.humanity--; P.human = true; sfx('heal'); toast('You are human again'); renderBonfire(); }, P.humanity >= 1]);
  else if (!b.kindled) acts.push(['Kindle (1 humanity) – 10 Estus here', () => { P.humanity--; b.kindled = true; refillAtBonfire(b); b.light.i = 1.5; sfx('rest'); toast('The bonfire flares. Estus 10'); renderBonfire(); }, P.humanity >= 1]);
  const el = $('#bfActions'); el.innerHTML = '';
  for (const [label, fn, ok] of acts) { const bt = document.createElement('button'); bt.className = 'cta ghost'; bt.textContent = label; bt.disabled = !ok; bt.onclick = () => { sfx('click'); fn(); }; el.appendChild(bt); }
  renderLevel();
}
function renderLevel() {
  const cost = levelCost(playerLevel()); $('#luCost').textContent = cost; $('#bfSouls').textContent = P.souls; $('#bfLevel').textContent = playerLevel();
  const derived = { vit: hpMax() + ' HP', att: (P.spell ? 'Spells ' + SPELLS[P.spell].uses + ' uses' : 'Spell slots'), end: stMax() + ' stamina, load ' + loadMax(), str: 'Attack ' + AR(), dex: 'Attack ' + AR(), res: 'Defense', int: 'Sorcery', fth: 'Miracles' };
  $('#luStats').innerHTML = STATS.map(k => `<div class="stat"><div class="nm">${STAT_NAMES[k]}<small>${derived[k]}</small></div><span class="v">${P.stats[k]}</span><button data-st="${k}" ${P.souls < cost || P.stats[k] >= 99 ? 'disabled' : ''} aria-label="Raise ${STAT_NAMES[k]}">+</button></div>`).join('');
  $('#luStats').querySelectorAll('button').forEach(b => b.onclick = () => { const c = levelCost(playerLevel()); if (P.souls < c) return; P.souls -= c; P.soulsShown = P.souls; P.stats[b.dataset.st]++; P.hp = hpMax(); P.hpTrail = P.hp; P.stam = stMax(); sfx('souls'); renderBonfire(); $('#levelUp').hidden = false; });
}
$('#bfLeave').onclick = () => { sfx('click'); closeBonfire(); };

/* ---------------- shop (merchant) and Andre ---------------- */
function openShop(kind) { G.menu = 'shop'; G.shopKind = kind; document.exitPointerLock && document.exitPointerLock(); clearInputs(); renderShop(); $('#shop').hidden = false; }
function closeShop() { $('#shop').hidden = true; G.menu = null; }
function renderShop() {
  $('#shopSouls').textContent = P.souls; const list = $('#shopList'); list.innerHTML = '';
  if (G.shopKind === 'merchant') {
    $('#shopName').textContent = 'Undead Merchant';
    for (const [id, price] of SHOP) {
      const it = ITEMS[id]; const owned = it.key ? hasItem(id) : it.weapon ? P.weapons.includes(it.weapon) : it.shield ? P.shields.includes(it.shield) : false;
      const row = document.createElement('div'); row.className = 'row2'; row.innerHTML = `<div>${it.name}<small>${it.desc}</small></div>`;
      const b = document.createElement('button'); b.textContent = owned ? 'Owned' : price; b.disabled = owned || P.souls < price;
      b.onclick = () => { if (P.souls < price) return; P.souls -= price; P.soulsShown = P.souls; giveItem(id, 1, true); renderShop(); };
      row.appendChild(b); list.appendChild(row);
    }
  } else {
    $('#shopName').textContent = 'Andre of Astora';
    const up = P.wpnUp, shards = P.inv.titaniteShard || 0, cost = 200 * (up + 1), need = up + 1;
    const row = document.createElement('div'); row.className = 'row2';
    row.innerHTML = `<div>Reinforce ${WEAPONS[P.wpn].name} +${up} → +${up + 1}<small>${need} Titanite Shard${need > 1 ? 's' : ''} and ${cost} souls. You have ${shards}. Attack ${AR()}.</small></div>`;
    const b = document.createElement('button'); b.textContent = up >= 5 ? 'Max' : 'Reinforce'; b.disabled = up >= 5 || shards < need || P.souls < cost;
    b.onclick = () => { P.souls -= cost; takeItem('titaniteShard', need); P.wpnUp++; sfx('clang'); toast(`${WEAPONS[P.wpn].name} +${P.wpnUp}`); renderShop(); };
    row.appendChild(b); list.appendChild(row);
    const r2 = document.createElement('div'); r2.className = 'row2'; r2.innerHTML = '<div>Repair equipment<small>Your gear is in good shape.</small></div>'; list.appendChild(r2);
  }
}
$('#shopLeave').onclick = () => { sfx('click'); closeShop(); };

/* ---------------- pause menu ---------------- */
let menuTab = 'status';
function setPause(v) { G.paused = v; $('#menu').hidden = !v; G.menu = v ? 'pause' : null; if (v) { document.exitPointerLock && document.exitPointerLock(); clearInputs(); renderMenu(); } }
function renderMenu() {
  document.querySelectorAll('#menuTabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === menuTab));
  const el = $('#menuBody'); let h = '';
  if (menuTab === 'status') {
    const rt = rollType(); const R = { fast: 'Fast roll', mid: 'Medium roll', fat: 'Fat roll', none: 'Overloaded' }[rt];
    h += `<div class="row2"><div>${P.cls.name}<small>${P.human ? 'Human' : 'Hollow'} · Level ${playerLevel()} · Deaths ${G.deaths}</small></div><div>${P.souls} souls</div></div>`;
    h += STATS.map(k => `<div class="row2"><div>${STAT_NAMES[k]}</div><div>${P.stats[k]}</div></div>`).join('');
    h += `<div class="row2"><div>HP</div><div>${Math.max(0, Math.round(P.hp))} / ${hpMax()}</div></div><div class="row2"><div>Stamina</div><div>${stMax()}</div></div>`;
    h += `<div class="row2"><div>Equip load<small>${R}</small></div><div>${load().toFixed(1)} / ${loadMax()}</div></div><div class="row2"><div>Attack (R1)</div><div>${AR()}</div></div><div class="row2"><div>Poise</div><div>${P.armor.poise}</div></div>`;
  } else if (menuTab === 'equip') {
    h += `<div class="row2"><div>Two-handed<small>Strength ×1.5. Block with the weapon instead of the shield.</small></div><button data-act="2h">${P.twoHand ? 'On' : 'Off'}</button></div>`;
    h += `<div class="row2"><div><b>Weapons</b></div></div>`;
    for (const w of P.weapons) { const W = WEAPONS[w]; const ok = P.stats.str * (P.twoHand ? 1.5 : 1) >= W.req[0] && P.stats.dex >= W.req[1]; h += `<div class="row2"><div>${W.name}${w === P.wpn && P.wpnUp ? ' +' + P.wpnUp : ''}<small>${W.phys} phys · ${W.sc[0]}/${W.sc[1]} · ${W.w} wt · needs ${W.req[0]} Str ${W.req[1]} Dex${ok ? '' : ' (too weak)'}</small></div><button data-w="${w}" ${w === P.wpn ? 'disabled' : ''}>${w === P.wpn ? 'Equipped' : 'Equip'}</button></div>`; }
    h += `<div class="row2"><div><b>Shields</b></div></div>`;
    for (const s of P.shields) { const S = SHIELDS[s]; h += `<div class="row2"><div>${S.name}<small>${S.block}% block · stability ${S.stab} · ${S.w} wt</small></div><button data-s="${s}" ${s === P.sh ? 'disabled' : ''}>${s === P.sh ? 'Equipped' : 'Equip'}</button></div>`; }
    if (P.ring) h += `<div class="row2"><div>${ITEMS[P.ring].name}<small>${ITEMS[P.ring].desc}</small></div><div>Worn</div></div>`;
  } else if (menuTab === 'items') {
    h += `<div class="row2"><div>Estus Flask<small>${ITEMS.estus.desc}</small></div><div>${P.estus} / ${P.estusMax}</div></div>`;
    for (const [id, n] of Object.entries(P.inv)) { if (!n) continue; const it = ITEMS[id]; const inBelt = P.belt.includes(id); const usable = it.use && !it.key;
      h += `<div class="row2"><div>${it.name} ×${n}<small>${it.desc}</small></div>${usable ? `<button data-belt="${id}">${inBelt ? 'Remove' : 'Equip'}</button>` : ''}</div>`; }
    h += `<p class="hint">Equipped items show in the bottom slot. Cycle them with ${pickMode('the small arrow button', 'V', 'down on the d-pad')}.</p>`;
  } else if (menuTab === 'settings') {
    h += `<div class="opts"><label for="sens">Camera speed <input type="range" id="sens" min="0.4" max="2" step="0.1" value="${G.sens}"></label><label for="invY">Invert camera Y <input type="checkbox" id="invY" ${G.invY ? 'checked' : ''}></label><label for="mute">Mute sound <input type="checkbox" id="mute" ${A.mute ? 'checked' : ''}></label></div>`;
    h += `<div class="row2"><div>Quit to title<small>Your progress in this run is lost.</small></div><button data-act="quit">Quit</button></div>`;
  } else {
    h += `<div class="tabs" id="ctrlTabs"><button data-tab="touch">Touch</button><button data-tab="kb">Keyboard</button><button data-tab="pad">Gamepad</button></div><dl class="controls" id="ctrlList2"></dl>`;
  }
  el.innerHTML = h;
  el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { P.wpn = b.dataset.w; P.wpnUp = 0; rebuildPlayerModel(); sfx('click'); renderMenu(); });
  el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { P.sh = b.dataset.s; rebuildPlayerModel(); sfx('click'); renderMenu(); });
  el.querySelectorAll('[data-belt]').forEach(b => b.onclick = () => { const id = b.dataset.belt; if (P.belt.includes(id)) P.belt = P.belt.filter(x => x !== id); else if (P.belt.length < 5) P.belt.push(id); P.beltI = 0; sfx('click'); renderMenu(); });
  const a2 = el.querySelector('[data-act="2h"]'); if (a2) a2.onclick = () => { toggleTwoHand(); renderMenu(); };
  const q = el.querySelector('[data-act="quit"]'); if (q) q.onclick = () => location.reload();
  const sens = el.querySelector('#sens'); if (sens) { sens.oninput = () => { G.sens = +sens.value; store.set('sens', G.sens); }; el.querySelector('#invY').onchange = e => { G.invY = e.target.checked; store.set('invY', G.invY); }; el.querySelector('#mute').onchange = e => { A.mute = e.target.checked; store.set('mute', A.mute); if (A.master) A.master.gain.value = A.mute ? 0 : .6; }; }
  if (menuTab === 'controls') { el.querySelectorAll('#ctrlTabs button').forEach(b => b.onclick = () => renderCtrls(b.dataset.tab)); renderCtrls(G.inputMode); }
}
document.querySelectorAll('#menuTabs button').forEach(b => b.onclick = () => { menuTab = b.dataset.m; sfx('click'); renderMenu(); });
function toggleTwoHand() { P.twoHand = !P.twoHand; P.model.twoHand = P.twoHand; if (P.model.shield) P.model.shield.visible = !P.twoHand; toast(P.twoHand ? 'Two-handing ' + WEAPONS[P.wpn].name : 'One-handed'); sfx('click'); }
const CTRL = {
  touch: [['Left thumb', 'Move (anywhere on the left side)'], ['Right drag', 'Turn the camera'], ['Attack', 'Light attack, tap again to combo. While sprinting: running attack'], ['Heavy', 'Heavy attack'], ['Roll', 'Tap to roll, hold to sprint, tap again while sprinting to jump'], ['Block', 'Hold to raise your shield'], ['Block + Heavy', 'Kick, breaks a raised shield'], ['Parry', 'Deflect a blow just before it lands, then Attack to riposte'], ['Item', 'Use the quick item. The arrow cycles items'], ['Target', 'Lock on, swipe to switch'], ['Behind a foe', 'Attack to backstab'], ['Falling', 'Attack to plunge'], ['Menu', 'Equipment, two-handing, items, settings']],
  kb: [['WASD', 'Move'], ['Mouse', 'Look (click to capture)'], ['Click / J', 'Attack (sprinting: running attack)'], ['Shift+Click / K', 'Heavy attack'], ['Space', 'Tap to roll, hold to sprint, tap again while sprinting to jump'], ['Right-click / L', 'Block'], ['Block + K', 'Kick'], ['G / Shift+Right-click', 'Parry, then attack to riposte'], ['R', 'Use quick item (Estus first)'], ['V', 'Cycle quick item'], ['C', 'Cast spell'], ['T', 'Toggle two-handing'], ['Q', 'Lock on'], ['E', 'Interact, talk, climb'], ['Esc', 'Menu']],
  pad: [['Left stick', 'Move'], ['Right stick', 'Look'], ['RB / RT', 'Light / heavy attack'], ['B', 'Tap roll, hold sprint, tap again to jump'], ['LB', 'Block'], ['LB + RT', 'Kick'], ['LT', 'Parry'], ['X', 'Use quick item'], ['D-pad down', 'Cycle item'], ['D-pad up', 'Cast spell'], ['Y', 'Two-hand'], ['R3', 'Lock on'], ['A', 'Interact'], ['Start', 'Menu']],
};
function renderCtrls(tab) {
  for (const id of ['#ctrlList', '#ctrlList2']) { const dl = $(id); if (!dl) continue; dl.innerHTML = ''; CTRL[tab].forEach(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }); }
  document.querySelectorAll('.tabs button[data-tab]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === tab));
}
document.querySelectorAll('#title .tabs button').forEach(b => b.addEventListener('click', () => renderCtrls(b.dataset.tab)));
$('#pauseBtn').addEventListener('click', () => { sfx('click'); setPause(true); });
$('#pauseBtn').addEventListener('pointerdown', e => e.stopPropagation());
$('#resumeBtn').addEventListener('click', () => { sfx('click'); setPause(false); });

/* ---------------- class select and end screen ---------------- */
let selCls = 'knight';
function renderClasses() {
  const el = $('#classList'); el.innerHTML = '';
  for (const [id, c] of Object.entries(CLASSES)) { const b = document.createElement('button'); b.setAttribute('aria-pressed', id === selCls); b.innerHTML = `<b>${c.name}</b><small>Level ${c.sl}. ${c.blurb}</small>`; b.onclick = () => { selCls = id; sfx('click'); renderClasses(); }; el.appendChild(b); }
  const c = CLASSES[selCls]; $('#clsInfo').innerHTML = STATS.map((k, i) => `<span>${STAT_NAMES[k]}</span><span>${c.st[i]}</span>`).join('') + `<span>Weapon</span><span>${WEAPONS[c.wpn].name}</span><span>Shield</span><span>${SHIELDS[c.sh].name}</span>` + (c.spell ? `<span>Spell</span><span>${SPELLS[c.spell].name}</span>` : '');
}
$('#newBtn').onclick = () => { audioInit(); sfx('click'); $('#title').hidden = true; $('#classSel').hidden = false; renderClasses(); };
$('#clsBack').onclick = () => { $('#classSel').hidden = true; $('#title').hidden = false; };
$('#clsGo').onclick = () => { $('#classSel').hidden = true; startGame(selCls); };
function showEnd() { const m = Math.floor(G.playTime / 60), s = Math.floor(G.playTime % 60); G.ended = true; $('#endStats').textContent = `${P.cls.name} · Level ${playerLevel()} · Deaths ${G.deaths} · Time ${m}:${String(s).padStart(2, '0')}`; document.exitPointerLock && document.exitPointerLock(); clearInputs(); $('#end').hidden = false; }
$('#keepBtn').onclick = () => { $('#end').hidden = true; G.ended = false; };
$('#againBtn').onclick = () => location.reload();
