/* Boot, main loop, rendering. */
'use strict';
function startGame(cls) {
  setClass(cls);
  const b = AREA.firelink; G.lastBonfire = b;
  P.pos.set(b.pos.x + 1.2, 0, b.pos.z - 2.2); P.yaw = Math.PI; P.onGround = true; copyPose(P.pose, POSE.sit);
  G.running = true; $('#hud').hidden = false; if (G.touchUI) $('#pad').hidden = false;
  C.yaw = 0; C.pitch = .3; updatePromptKey(); resize();
  toast(pickMode('Tap Light bonfire to rest. Glowing runes are messages.', 'Press E at the bonfire to light it. Glowing runes are messages.', 'Press A at the bonfire to light it. Glowing runes are messages.'));
}
function update(dt) {
  G.time += dt; if (!G.ended) G.playTime += dt;
  updatePlayer(dt);
  for (const e of enemies) updateEnemy(e, dt);
  updateBossTriggers(dt);
  separate(); pushOut(P);
  for (const e of enemies) enemyPhysics(e, dt);
  updateWaves(dt); updateProjs(dt); updateDrake(dt); updateBarrel(dt); updateInteract(dt);
  if (btn.lock.pressed && !P.dead) toggleLock();
  if (btn.cycle.pressed && P.belt.length) { P.beltI = (P.beltI + 1) % P.belt.length; sfx('click'); }
  if (btn.twohand.pressed && P.state === 'free') toggleTwoHand();
}
function syncModels(time) {
  if (P.model) { const pm = P.model; pm.root.position.copy(P.pos); pm.root.rotation.y = P.yaw; applyPose(pm, P.pose, time); P.shadow.position.set(P.pos.x, P.pos.y + .03, P.pos.z); P.shadow.visible = P.onGround; }
  for (const e of enemies) {
    if (!e.model.root.visible) continue;
    const m = e.model; m.root.position.set(e.pos.x, e.pos.y + e.lift - (e.sink || 0), e.pos.z); m.root.rotation.y = e.yaw;
    if (!e.T.quad) applyPose(m, e.pose, time);
    const gy = e.lift > .1 ? groundAt(e.pos.x, e.pos.z, e.pos.y + .5) : e.pos.y; e.shadow.position.set(e.pos.x, gy + .03, e.pos.z); e.shadow.scale.setScalar(e.r * 1.25 * (1 - Math.min(.6, e.lift / 10)));
    const f = e.flash > 0 ? .65 : 0; for (const mm of e.mats) mm.uniforms.uFlash.value = f;
  }
}
const sunDir = new V3(-.62, .17, .6).normalize();
function updateWorld(dt, time) {
  for (const f of flames) { if (f.i === 0) { f.g.getWorldPosition(tmpV); f.g.visible = tmpV.distanceToSquared(camera.position) < 3600; } if (!f.g.visible) continue; const s = f.base * (.75 + .35 * Math.sin(time * (9 + f.i * 3) + f.ph) + rand(-.08, .08)); f.m.scale.set(s, s * 1.3, s); f.m.rotation.y += dt * 3; }
  updateLights(time, P.model ? P.pos : camera.position);
  for (const f of fogs) f.meshes.forEach((m, k) => { m.material.uniforms.uScroll.value.set(time * (.05 + k * .03), time * (k ? -.12 : .09)); m.material.uniforms.uAlpha.value = .6 + .15 * Math.sin(time * 2 + k); });
  RUNE_MAT.uniforms.uEmissive.value.setRGB(1, .62, .25).multiplyScalar(.8 + .2 * Math.sin(time * 2));
  for (const it of items) if (!it.taken) { it.mesh.rotation.y += dt * 2; it.mesh.position.y = it.pos.y + .35 + Math.sin(time * 2 + it.pos.x) * .06; if (Math.random() < dt * 3 && it.pos.distanceTo(P.pos) < 40) emit(it.pos.x, it.pos.y + .4, it.pos.z, 1, { color: 0xfff0d0, speed: .3, up: .8, grav: 0, life: 1, size: .04 }); }
  for (const b of bonfires) if (b.lit && Math.random() < dt * 10 && b.pos.distanceTo(camera.position) < 40) emit(b.pos.x + rand(-.2, .2), b.pos.y + .6, b.pos.z + rand(-.2, .2), 1, { color: [0xff8a30, 0xffc070], speed: .3, up: 1.4, grav: -.3, life: 1.6, size: .045 });
  if (G.stain && stainMesh) { const s = 1 + .15 * Math.sin(time * 4); stainMesh.scale.set(s, s, 1); }
}
function placeSky() { AREA.sky.position.copy(camera.position); AREA.sun.position.copy(camera.position).addScaledVector(sunDir, 120); AREA.sun.lookAt(camera.position); }
let last = performance.now(), wallT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(.05, (now - last) / 1000); last = now; wallT += rdt;
  pollPad();
  if (btn.pause.pressed && G.running) { if (G.menu === 'bonfire') closeBonfire(); else if (G.menu === 'shop') closeShop(); else setPause(!G.paused); }
  if (G.running && !G.paused) { let dt = rdt; if (G.hitstop > 0) { G.hitstop -= rdt; dt *= .06; } update(dt); updateParts(dt); }
  else if (!G.running) updateParts(rdt);
  updateWorld(rdt, wallT); syncModels(wallT); updateCamera(rdt); placeSky(); updateHUD(rdt);
  renderer.render(scene, camera); drawOverlay();
  for (const n of BTN) { const b = btn[n]; b.pressed = false; b.released = false; if (b.down) b.t += rdt; }
}
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h; const lh = Math.round(Math.sqrt(84000 / a)), lw = Math.round(lh * a);
  renderer.setSize(lw, lh, false); camera.aspect = a;
  camera.fov = a < 1 ? clamp(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(34)) / a) * 180 / Math.PI, 62, 92) : 62; camera.updateProjectionMatrix();
  U.uSnap.value.set(lw * .32, lh * .32);
  ovDpr = Math.min(2, window.devicePixelRatio || 1); ov.width = w * ovDpr; ov.height = h * ovDpr;
  placeJoy(); $('#rotateHint').hidden = !(G.touchUI && h > w);
}
addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden && G.running && !G.paused && !G.menu) setPause(true); });

/* ---------------- boot ---------------- */
try {
  buildLevel(); populate();
  addInteract({ pos: AREA.liftHigh, r: 2.2, label: () => 'Ride the lift down', on: () => true, act: () => useLift(true) });
  addInteract({ pos: AREA.liftLow, r: 2.2, label: () => G.liftUnlocked ? 'Ride the lift up' : 'Call the lift', on: () => true, act: () => useLift(false) });
  for (const f of fogs) f.canEnter = () => !f.exit && (!f.dir || fogSide(f) === -f.dir) && !G.bossFight;
  mergeStatics();
  if (matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window)) { enableTouchUI(); G.inputMode = 'touch'; }
  renderCtrls(G.inputMode); resize();
  requestAnimationFrame(frame);
} catch (err) { const e = $('#err'); e.hidden = false; e.textContent = 'Something went wrong while building the keep: ' + err.message; console.error(err); }
window.__ck = { P, G, enemies, AREA, startGame, press, release, keys, C, BOSSES, drake, solids };
