/* Boot, main loop, saving, title screen. */
'use strict';
const SAVE_KEY = 'bloodmoor.save.v1', SET_KEY = 'bloodmoor.settings';
const PERSIST = ['name', 'level', 'xp', 'st', 'statPts', 'skillPts', 'skills', 'inv', 'stash', 'equip', 'belt', 'gold', 'stashGold', 'slots', 'diffMax', 'quests', 'tp', 'deaths'];

function serialize() { const o = {}; for (const k of PERSIST) o[k] = P[k]; return { v: 1, P: o, diff: G.diff }; }
function saveGame() { if (!G.running || G.backdrop) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); } catch (e) { /* storage unavailable */ } }
function readSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify({ sound: AU.on, labels: RD.showLabels, mini: RD.miniMap, pal: PAL.on })); } catch (e) { /* ignore */ } }
function loadSettings() { try { const s = JSON.parse(localStorage.getItem(SET_KEY) || 'null'); if (s) { AU.on = s.sound !== false; RD.showLabels = s.labels !== false; RD.miniMap = s.mini !== false; PAL.on = s.pal !== false; } } catch (e) { /* ignore */ } }

function applySave(data) {
  newCharacter(data.P.name);
  for (const k of PERSIST) if (data.P[k] !== undefined) P[k] = data.P[k];
  if (!P.quests) P.quests = {};
  let maxId = 0; const scan = it => { if (it && it.id > maxId) maxId = it.id; };
  P.inv.forEach(e => scan(e.item)); P.stash.forEach(e => scan(e.item)); Object.values(P.equip).forEach(scan); P.belt.forEach(c => c.forEach(scan));
  ITEM_ID = maxId + 1;
  resetRuntime();
  return data.diff || 0;
}
function newGame(diff) {
  G.diff = diff;
  if (!P.quests) P.quests = {};
  P.quest = P.quests[diff] = P.quests[diff] || { den: 0 };
  buildWorld((Math.random() * 1e9) | 0);
  for (const k in VENDOR) VENDOR[k].dirty = true;
  P.buffs = {}; P.heals = []; recalc(); P.life = P.maxLife; P.mana = P.maxMana; P.dead = false; G.dead = false;
  const M = G.areas.moor; enterArea('moor', M.townSpawn[0], M.townSpawn[1]);
  G.firstFrame = true;
  if (!G.backdrop) { showBanner(DIFFS[diff].name, 'Rogue Encampment'); saveGame(); }
}
function begin() {
  G.backdrop = false; G.running = true; $('#title').hidden = true; $('#hud').hidden = false;
  buildHUD(); closePanels(); drawMsgs();
  showBanner('Rogue Encampment', DIFFS[G.diff].name);
  if (UI.touch) msg('Drag anywhere to move. Tap enemies to attack. Hold a skill button to cast, or drag off it to aim.', '#e8e2d2');
  else msg('Left click to move and attack. Right click casts your RMB skill. Q W E R cast the others.', '#e8e2d2');
  if (!P.quest.den) setTimeout(() => G.running && msg('Akara, the priestess by the tents, has a task for you.', '#c9a24a'), 2500);
}
function startNew() {
  const name = ($('#heroName').value || '').trim().slice(0, 16) || 'Sorceress';
  G.backdrop = false; newCharacter(name); P.quests = {}; newGame(0); begin(); saveGame();
}
function continueGame(data) { G.backdrop = false; const d = applySave(data); newGame(Math.min(d, P.diffMax)); begin(); }
function showTitle() {
  G.running = false; G.backdrop = true; $('#hud').hidden = true; $('#title').hidden = false; $('#death').hidden = true;
  const s = readSave();
  $('#btnContinue').hidden = !s;
  if (s) $('#saveInfo').textContent = `${s.P.name} · Level ${s.P.level} Sorceress · ${DIFFS[s.diff || 0].name}`;
  $('#saveInfo').hidden = !s;
}

let last = performance.now(), saveT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  const paused = UI.left === 'menu';
  if (G.running && !paused) {
    G.time += dt;
    updatePlayer(dt); updateMonsters(dt); updateProjs(dt); updateGrounds(dt);
    if ((saveT += dt) > 15) { saveT = 0; saveGame(); }
  } else if (G.backdrop) {
    G.time += dt; P.ang += dt * .2; P.anim = 'idle';
  }
  render(dt);
  if (G.running) { updateHover(); updateHUD(dt); }
}

function boot(hot) {
  buildPalette(); loadSettings(); renderInit(); bindInput();
  const stone = stoneTexture(); document.documentElement.style.setProperty('--stoneTex', `url(${stone})`);
  // the title screen shows the camp at night behind it
  G.backdrop = true; newCharacter('Sorceress'); P.quests = {}; newGame(0);
  showTitle();
  $('#btnNew').onclick = () => { audioInit(); $('#overwrite').hidden = !readSave(); $('#newForm').hidden = false; $('#btnNew').hidden = true; $('#btnContinue').hidden = true; $('#heroName').focus(); };
  $('#newForm').onsubmit = e => { e.preventDefault(); audioInit(); startNew(); };
  $('#btnBack').onclick = () => { $('#newForm').hidden = true; $('#btnNew').hidden = false; showTitle(); };
  $('#btnContinue').onclick = () => { audioInit(); const s = readSave(); if (s) continueGame(s); };
  $('#btnRespawn').onclick = () => { $('#death').hidden = true; respawn(); saveGame(); };
  window.claude?.hot?.snapshot?.(() => (G.running ? { save: serialize() } : {}));
  addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  addEventListener('pagehide', saveGame);
  if (hot && hot.save) continueGame(hot.save);
  requestAnimationFrame(frame);
}
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
