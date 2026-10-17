/* HUD, panels (character, inventory, skill tree, vendor, stash), dialogs, and mouse / keyboard / touch input. */
'use strict';
const UI = { left: null, right: null, tree: 0, sel: null, vendor: null, touch: false, cell: 36, pop: null };
const SLOT_KEYS = ['LMB', 'RMB', 'Q', 'W', 'E', 'R'];

/* ---------- Skill icons ---------- */
const SK_ICON = {};
function skillIcon(id) {
  if (!id) return '';
  if (SK_ICON[id]) return SK_ICON[id];
  const S = 64, c = makeCanvas(32, 32), x = c.getContext('2d'), s = SKILLS[id], tr = s.tree;
  x.scale(.5, .5);
  const bg = [['#3a1408', '#7a2a10'], ['#0c1a34', '#24467a'], ['#1a1434', '#3e3a7a'], ['#2a2420', '#5a4a38']][tr < 0 ? 3 : tr];
  const g = x.createRadialGradient(24, 20, 4, 32, 32, 46); g.addColorStop(0, bg[1]); g.addColorStop(1, bg[0]); x.fillStyle = g; x.fillRect(0, 0, S, S);
  const hot = ['255,190,90', '170,215,255', '210,210,255', '230,210,170'][tr < 0 ? 3 : tr];
  const gl = (cx, cy, r, a = .9) => { const q = x.createRadialGradient(cx, cy, 0, cx, cy, r); q.addColorStop(0, `rgba(255,255,240,${a})`); q.addColorStop(.35, `rgba(${hot},${a * .8})`); q.addColorStop(1, `rgba(${hot},0)`); x.fillStyle = q; x.fillRect(cx - r, cy - r, r * 2, r * 2); };
  x.lineCap = 'round'; x.lineJoin = 'round'; x.globalCompositeOperation = 'lighter';
  const bolt = (pts, w) => { x.strokeStyle = `rgba(${hot},.6)`; x.lineWidth = w * 3; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.stroke(); x.strokeStyle = '#fff'; x.lineWidth = w; x.stroke(); };
  switch (id) {
    case 'attack': x.globalCompositeOperation = 'source-over'; x.strokeStyle = '#c8ccd0'; x.lineWidth = 6; x.beginPath(); x.moveTo(14, 50); x.lineTo(48, 16); x.stroke(); x.strokeStyle = '#7a5a30'; x.lineWidth = 5; x.beginPath(); x.moveTo(10, 40); x.lineTo(24, 54); x.stroke(); break;
    case 'firebolt': for (let k = 0; k < 6; k++) gl(44 - k * 5, 20 + k * 5, 14 - k * 1.6); break;
    case 'warmth': gl(32, 40, 22, .7); for (let k = 0; k < 3; k++) { x.strokeStyle = `rgba(${hot},.8)`; x.lineWidth = 3; x.beginPath(); x.moveTo(20 + k * 12, 50); x.quadraticCurveTo(14 + k * 12, 34, 22 + k * 12, 18); x.stroke(); } break;
    case 'inferno': for (let k = 0; k < 9; k++) gl(12 + k * 5.5, 44 - k * 3, 6 + k * 1.6, .6); break;
    case 'blaze': for (let k = 0; k < 4; k++) gl(14 + k * 12, 50 - k * 9, 9, .8); break;
    case 'fireball': gl(36, 28, 24); gl(36, 28, 10, 1); for (let k = 1; k < 5; k++) gl(36 - k * 6, 28 + k * 6, 10 - k, .5); break;
    case 'firewall': for (let k = 0; k < 6; k++) gl(8 + k * 10, 40 - (k % 2) * 6, 12, .7); break;
    case 'meteor': for (let k = 0; k < 7; k++) gl(42 - k * 4, 26 - k * 3.5, 14 - k * 1.5, .8 - k * .08); x.globalCompositeOperation = 'source-over'; x.fillStyle = '#3a2214'; x.beginPath(); x.arc(42, 28, 7, 0, TAU); x.fill(); break;
    case 'firemastery': case 'coldmastery': case 'lightmastery': gl(32, 32, 26, .55); x.strokeStyle = `rgba(${hot},1)`; x.lineWidth = 3; x.beginPath(); x.moveTo(32, 10); x.lineTo(52, 32); x.lineTo(32, 54); x.lineTo(12, 32); x.closePath(); x.moveTo(32, 18); x.lineTo(32, 46); x.moveTo(20, 32); x.lineTo(44, 32); x.stroke(); break;
    case 'icebolt': bolt([[14, 50], [50, 14]], 3); gl(48, 16, 10); break;
    case 'frozenarmor': gl(32, 32, 26, .5); x.strokeStyle = '#eaf6ff'; x.lineWidth = 3; x.beginPath(); x.moveTo(32, 10); x.lineTo(50, 18); x.lineTo(46, 42); x.lineTo(32, 54); x.lineTo(18, 42); x.lineTo(14, 18); x.closePath(); x.stroke(); break;
    case 'frostnova': case 'nova': x.strokeStyle = `rgba(${hot},.9)`; x.lineWidth = 4; x.beginPath(); x.ellipse(32, 34, 24, 14, 0, 0, TAU); x.stroke(); gl(32, 34, 10); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.stroke(); break;
    case 'iceblast': gl(36, 30, 20, .6); x.fillStyle = '#eaf6ff'; x.beginPath(); x.moveTo(36, 12); x.lineTo(48, 30); x.lineTo(36, 48); x.lineTo(24, 30); x.closePath(); x.fill(); break;
    case 'glacialspike': x.fillStyle = '#eaf6ff'; x.beginPath(); x.moveTo(52, 12); x.lineTo(24, 36); x.lineTo(16, 52); x.lineTo(30, 42); x.closePath(); x.fill(); gl(22, 44, 14); break;
    case 'blizzard': for (let k = 0; k < 9; k++) { const px = 10 + (k * 23) % 46, py = 10 + (k * 17) % 40; bolt([[px + 6, py], [px, py + 12]], 2); } break;
    case 'frozenorb': gl(32, 32, 16, 1); for (let k = 0; k < 8; k++) { const a = k * TAU / 8; bolt([[32 + Math.cos(a) * 12, 32 + Math.sin(a) * 12], [32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26]], 1.5); } break;
    case 'chargedbolt': for (let k = 0; k < 4; k++) { const y = 18 + k * 9; bolt([[12, y], [24, y - 5], [34, y + 4], [50, y - 2]], 1.5); } break;
    case 'staticfield': x.strokeStyle = `rgba(${hot},.9)`; x.lineWidth = 2; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; x.beginPath(); x.moveTo(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18); x.lineTo(32 + Math.cos(a + .2) * 26, 32 + Math.sin(a + .2) * 26); x.stroke(); } gl(32, 32, 10, .6); break;
    case 'lightning': bolt([[10, 52], [26, 36], [22, 30], [40, 20], [36, 16], [54, 8]], 2.5); break;
    case 'chainlightning': bolt([[8, 50], [22, 30], [34, 44], [46, 22], [56, 32]], 2); gl(22, 30, 6); gl(34, 44, 6); gl(46, 22, 6); break;
    case 'teleport': gl(32, 32, 24, .6); x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(10,10,30,.8)'; x.beginPath(); x.arc(32, 22, 6, 0, TAU); x.fill(); x.fillRect(27, 28, 10, 20); break;
    case 'thunderstorm': x.globalCompositeOperation = 'source-over'; x.fillStyle = '#5a5a7a'; for (const [cx, cy, r] of [[22, 18, 10], [34, 14, 12], [46, 18, 10]]) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); } x.globalCompositeOperation = 'lighter'; bolt([[34, 26], [28, 40], [36, 40], [30, 56]], 2.5); break;
    case 'energyshield': gl(32, 32, 26, .4); x.strokeStyle = '#cfe0ff'; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 20, 0, TAU); x.stroke(); x.lineWidth = 1.5; x.beginPath(); x.arc(32, 32, 14, -1, 2); x.stroke(); break;
  }
  x.globalCompositeOperation = 'source-over'; x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, S - 3, S - 3);
  x.setTransform(1, 0, 0, 1, 0, 0); quantize(x, 32, 32, true);
  return SK_ICON[id] = c.toDataURL();
}

/* ---------- Globes ---------- */
function drawGlobe(cv, frac, kind, t) {
  const ctx = cv.getContext('2d', { willReadFrequently: true }), px = cv.width, S = 120, r = S / 2 - 3, cx = S / 2, cy = S / 2;
  ctx.setTransform(px / S, 0, 0, px / S, 0, 0); ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#060404'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  const lvl = cy + r - frac * r * 2;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, TAU); ctx.clip();
  const base = kind === 'life' ? (P.buffs && P.dead ? '#3a0a0a' : '#a01010') : '#1c2ea8';
  const g = ctx.createRadialGradient(cx - r * .35, cy - r * .3, r * .1, cx, cy, r * 1.05);
  g.addColorStop(0, kind === 'life' ? '#ff6a4a' : '#6a8aff'); g.addColorStop(.5, base); g.addColorStop(1, kind === 'life' ? '#2a0404' : '#060a2a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, S);
  for (let x = 0; x <= S; x += 5) ctx.lineTo(x, lvl + Math.sin(x * .12 + t * 2.4) * 2.5);
  ctx.lineTo(S, S); ctx.closePath(); ctx.fill();
  ctx.restore();
  const hl = ctx.createRadialGradient(cx - r * .35, cy - r * .45, 1, cx - r * .3, cy - r * .4, r * .7);
  hl.addColorStop(0, 'rgba(255,255,255,.35)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = '#3a3226'; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#8a7a5a'; ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, TAU); ctx.stroke();
  ctx.setTransform(1, 0, 0, 1, 0, 0); quantize(ctx, px, px, true);
}

/* ---------- HUD ---------- */
function buildHUD() {
  const sb = $('#skillbar'); sb.innerHTML = '';
  P.slots.forEach((id, i) => {
    const b = document.createElement('button'); b.className = 'sk' + (i === 0 ? ' main' : ''); b.dataset.i = i; b.setAttribute('aria-label', `Skill slot ${SLOT_KEYS[i]}`);
    b.innerHTML = `<img alt=""><span class="key">${SLOT_KEYS[i]}</span><span class="cd"></span>`;
    sb.appendChild(b);
  });
  const belt = $('#belt'); belt.innerHTML = '';
  for (let i = 0; i < 4; i++) { const b = document.createElement('button'); b.className = 'bslot'; b.dataset.i = i; b.setAttribute('aria-label', `Belt slot ${i + 1}`); b.innerHTML = `<img alt=""><span class="n"></span><span class="key">${i + 1}</span>`; belt.appendChild(b); }
  bindHudButtons(); refreshHUD(); layoutHUD();
}
function layoutHUD() {
  const r = $('#menubar').getBoundingClientRect(), side = UI.touch && innerHeight < 560;
  // short touch screens: the skill wheel owns the right edge, so the minimap sits left of the menu buttons
  RD.miniTop = side ? r.top : r.bottom + 8; RD.miniRight = side ? innerWidth - r.left + 8 : innerWidth - r.right;
  RD.miniW = side ? 120 : 150; RD.miniH = side ? 90 : 110;
  const an = $('#areaName'); an.style.top = (RD.miniTop + RD.miniH + 4) + 'px'; an.style.right = RD.miniRight + 'px';
}
function refreshHUD() {
  if (!$('#skillbar').children.length) return;
  $$('#skillbar .sk').forEach((b, i) => {
    const id = P.slots[i], img = b.querySelector('img');
    if (id) { img.src = skillIcon(id); img.hidden = false; } else img.hidden = true;
    b.classList.toggle('empty', !id);
  });
  $$('#belt .bslot').forEach((b, i) => {
    const col = P.belt[i], img = b.querySelector('img');
    if (col.length) { img.src = itemIcon(col[0]).url; img.hidden = false; } else img.hidden = true;
    b.querySelector('.n').textContent = col.length > 1 ? col.length : '';
  });
  $('#lvlBadge').textContent = P.level;
  $('#tpN').textContent = P.tp;
  $('#ptsDot').hidden = !(P.statPts || P.skillPts);
  $('#btnChar').classList.toggle('glow', P.statPts > 0);
  $('#btnSkills').classList.toggle('glow', P.skillPts > 0);
}
function updateHUD(dt) {
  const t = G.time;
  drawGlobe($('#globeL canvas'), clamp(P.life / P.maxLife, 0, 1), 'life', t);
  drawGlobe($('#globeR canvas'), clamp(P.mana / P.maxMana, 0, 1), 'mana', t);
  $('#globeL span').textContent = `${Math.ceil(Math.max(0, P.life))} / ${P.maxLife}`;
  $('#globeR span').textContent = `${Math.floor(P.mana)} / ${P.maxMana}`;
  const lo = XP_TABLE[P.level], hi = XP_TABLE[P.level + 1] || lo + 1;
  $('#xpbar i').style.width = (P.level >= MAX_LVL ? 100 : clamp((P.xp - lo) / (hi - lo) * 100, 0, 100)) + '%';
  $$('#skillbar .sk').forEach((b, i) => {
    const id = P.slots[i]; if (!id) return;
    const cost = id === 'attack' ? 0 : skMana(id), cd = P.cds[id] > 0;
    b.classList.toggle('nomana', P.mana < cost); b.classList.toggle('oncd', !!cd);
  });
  // monster target bar
  const f = (RD.hoverM && !RD.hoverM.dead) ? RD.hoverM : G.focusT > 0 && G.focus && !G.focus.dead ? G.focus : null;
  G.focusT -= dt;
  const tb = $('#target');
  if (f) {
    tb.hidden = false;
    const nm = $('#target .tname'); nm.textContent = f.name; nm.style.color = f.rank === 'champion' ? '#8a9aff' : f.rank === 'unique' || f.rank === 'boss' ? '#c7b377' : '#e8e2d2';
    $('#target .tbar i').style.width = clamp(f.hp / f.maxHp * 100, 0, 100) + '%';
    $('#target .tmods').textContent = f.mods.map(k => UNIQUE_MODS[k].name).join(', ');
  } else tb.hidden = true;
  // buffs
  const bf = Object.keys(P.buffs).map(k => `<span title="${SKILLS[k].name}"><img src="${skillIcon(k)}" alt="${SKILLS[k].name}"><i>${Math.ceil(P.buffs[k].t)}</i></span>`).join('');
  if (bf !== UI.lastBuffs) { $('#buffs').innerHTML = bf; UI.lastBuffs = bf; }
  // area name
  const an = inTown() ? 'Rogue Encampment' : G.area.name; if ($('#areaName').textContent !== an) $('#areaName').textContent = an;
  // interact hint for touch
  for (const m of G.msgs) m.t -= dt;
  if (G.msgs.length && G.msgs[0].t <= 0) { G.msgs.shift(); drawMsgs(); }
}
function drawMsgs() { $('#msgs').innerHTML = G.msgs.map(m => `<div style="color:${m.color}">${m.text}</div>`).join(''); }
function showBanner(title, sub) {
  const b = $('#banner'); b.innerHTML = `<b>${title}</b>${sub ? `<small>${sub}</small>` : ''}`; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(UI.bannerT); UI.bannerT = setTimeout(() => b.classList.remove('show'), 3600);
}
function onAreaEnter(A) { showBanner(A.id === 'moor' && inTown() ? 'Rogue Encampment' : A.name); if (A.id === 'moor' && inTown()) for (const k in VENDOR) VENDOR[k].dirty = true; saveGame(); }
function showDeath(lost) {
  closePanels(); const d = $('#death'); d.hidden = false;
  $('#deathSub').textContent = lost ? `You dropped ${lost} gold.` : 'Your journey is not over.';
}

/* ---------- Panels ---------- */
function closePanels() { UI.left = UI.right = null; $('#panelL').hidden = true; $('#panelR').hidden = true; hidePop(); RD.panelOpen = false; document.body.classList.remove('panels'); }
function openPanel(side, kind) {
  if (side === 'L') { UI.left = UI.left === kind ? null : kind; } else { UI.right = UI.right === kind ? null : kind; }
  if (UI.left !== 'vendor' && UI.left !== 'stash' && UI.left !== 'npc') UI.vendor = UI.left === 'vendor' ? UI.vendor : null;
  hidePop(); refreshPanels(); sfx('click');
}
function refreshPanels() {
  const L = $('#panelL'), Rp = $('#panelR');
  L.hidden = !UI.left; Rp.hidden = !UI.right;
  L.classList.toggle('solo', !UI.right); Rp.classList.toggle('solo', !UI.left);
  document.body.classList.toggle('panels', !!(UI.left || UI.right));
  RD.panelOpen = !!(UI.left || UI.right);
  computeCell();
  if (UI.left === 'char') L.innerHTML = charHTML(), bindChar();
  else if (UI.left === 'vendor') renderVendor(L);
  else if (UI.left === 'stash') renderStash(L);
  else if (UI.left === 'npc') renderNpc(L);
  else if (UI.left === 'menu') renderMenu(L);
  if (UI.right === 'inv') renderInv(Rp);
  else if (UI.right === 'skills') renderSkills(Rp);
  refreshHUD();
}
function computeCell() {
  const narrow = innerWidth < 720;
  const pw = narrow ? innerWidth - 24 : Math.min(innerWidth / 2 - 18, 440);
  const ph = narrow && UI.left && UI.right ? innerHeight / 2 : innerHeight;
  UI.cell = Math.floor(clamp(Math.min((pw - 30) / 10, (ph - 110) / 9.9), 22, 40));
  document.documentElement.style.setProperty('--cell', UI.cell + 'px');
}
function closeBtn() { return '<button class="x" data-close aria-label="Close panel">×</button>'; }
function bindClose(el) { el.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { if (el.id === 'panelL') { UI.left = null; UI.vendor = null; } else UI.right = null; refreshPanels(); }); }

function charHTML() {
  const s = P.st, b = P.bonus, w = P.wdmg, str = (1 + P.str / 100);
  const lo = XP_TABLE[P.level + 1] || 0;
  const row = (k, n, v, base) => `<div class="srow"><span class="sn">${n}</span><b class="${v !== base ? 'boost' : ''}">${v}</b>${P.statPts ? `<button class="plus" data-st="${k}" aria-label="Add a point to ${n}">+</button>` : '<span></span>'}</div>`;
  const res = (n, v, cls) => `<div class="rrow"><span>${n}</span><b class="${cls} ${v < 0 ? 'neg' : ''}">${v}%</b></div>`;
  return `${closeBtn()}<h2>${P.name}</h2>
  <div class="cmeta"><div><small>Level</small><b>${P.level}</b></div><div><small>Class</small><b>Sorceress</b></div><div><small>Experience</small><b>${fmt(P.xp)}</b></div><div><small>Next Level</small><b>${P.level >= MAX_LVL ? '—' : fmt(lo)}</b></div></div>
  <div class="stats">
    ${row('str', 'Strength', P.str, s.str)}${row('dex', 'Dexterity', P.dex, s.dex)}${row('vit', 'Vitality', P.vit, s.vit)}${row('ene', 'Energy', P.ene, s.ene)}
    <div class="pts ${P.statPts ? 'on' : ''}">Stat Points Remaining <b>${P.statPts}</b></div>
  </div>
  <div class="derived">
    <div class="rrow"><span>Damage</span><b>${Math.floor(w[0] * str)}–${Math.floor(w[1] * str)}</b></div>
    <div class="rrow"><span>Attack Rating</span><b>${P.ar}</b></div>
    <div class="rrow"><span>Defense</span><b>${P.def}</b></div>
    <div class="rrow"><span>Life</span><b>${Math.ceil(P.life)} / ${P.maxLife}</b></div>
    <div class="rrow"><span>Mana</span><b>${Math.floor(P.mana)} / ${P.maxMana}</b></div>
    ${res('Fire Resist', P.res.fire, 'fire')}${res('Cold Resist', P.res.cold, 'cold')}${res('Lightning Resist', P.res.light, 'light')}
    <div class="rrow"><span>Faster Cast Rate</span><b>${b.fcr}%</b></div>
    <div class="rrow"><span>Faster Hit Recovery</span><b>${b.fhr}%</b></div>
    <div class="rrow"><span>Faster Run/Walk</span><b>${b.frw}%</b></div>
    <div class="rrow"><span>Magic Find</span><b>${b.mf}%</b></div>
    <div class="rrow"><span>Difficulty</span><b>${DIFFS[G.diff].name}</b></div>
  </div>`;
}
function bindChar() {
  const L = $('#panelL'); bindClose(L);
  L.querySelectorAll('[data-st]').forEach(b => b.onclick = e => { const k = b.dataset.st, n = e.shiftKey ? P.statPts : 1; for (let i = 0; i < n && P.statPts > 0; i++) { P.st[k]++; P.statPts--; } recalc(); refreshPanels(); sfx('click'); saveGame(); });
}

/* Inventory: paper doll + 10x4 grid */
const DOLL = { head: [3, 0, 2, 2], amulet: [5, 0.5, 1, 1], rhand: [0, 1, 2, 4], body: [3, 2, 2, 3], lhand: [6, 1, 2, 4], gloves: [0, 5.2, 2, 2], ring1: [2, 5.2, 1, 1], belt: [3, 5.2, 2, 1], ring2: [5, 5.2, 1, 1], feet: [6, 5.2, 2, 2] };
function renderInv(el) {
  const c = UI.cell, dc = Math.round(c * .82);
  let doll = `<div class="doll" style="width:${dc * 8}px;height:${dc * 7.2}px">`;
  for (const s in DOLL) {
    const [x, y, w, h] = DOLL[s], it = P.equip[s];
    const two = s === 'lhand' && !it && isTwoHand(P.equip.rhand);
    doll += `<button class="eq ${it ? 'r-' + it.rarity : ''} ${it && !canUse(it) ? 'bad' : ''}" data-slot="${s}" style="left:${x * dc}px;top:${y * dc}px;width:${w * dc}px;height:${h * dc}px" aria-label="${SLOT_NAME[s]}${it ? ': ' + it.name : ' (empty)'}">${it ? `<img src="${itemIcon(it).url}" alt="">` : two ? `<img class="ghost" src="${itemIcon(P.equip.rhand).url}" alt="">` : `<span>${s === 'amulet' ? 'Amu' : SLOT_NAME[s]}</span>`}</button>`;
  }
  doll += '</div>';
  el.innerHTML = `${closeBtn()}<h2>Inventory</h2>${doll}<div class="grid inv" style="width:${c * INV_W}px;height:${c * INV_H}px">${gridItems(P.inv, c, 'inv')}</div>
  <div class="goldrow"><span class="coin"></span><b>${P.gold}</b> Gold<span class="sp"></span><span class="tpc">Town Portal ×${P.tp}</span></div>`;
  bindClose(el);
  el.querySelectorAll('.eq').forEach(b => b.onclick = e => { const it = P.equip[b.dataset.slot]; if (it) itemPop(it, 'equip', b, e); });
  el.querySelectorAll('.grid.inv .gi').forEach(b => b.onclick = e => { const ent = P.inv[+b.dataset.i]; if (ent) itemPop(ent.item, 'inv', b, e); });
  bindTips(el);
}
function gridItems(list, c, kind) {
  return list.map((e, i) => { const b = BASES[e.item.base]; return `<button class="gi r-${e.item.rarity} ${canUse(e.item) || !KIND_SLOT[b.kind] ? '' : 'bad'}" data-i="${i}" data-kind="${kind}" style="left:${e.x * c}px;top:${e.y * c}px;width:${b.w * c}px;height:${b.h * c}px" aria-label="${e.item.name}"><img src="${itemIcon(e.item).url}" alt=""></button>`; }).join('');
}
function bindTips(el) {
  if (UI.touch) return;
  el.querySelectorAll('.gi,.eq').forEach(b => {
    b.onmouseenter = () => { const it = itemFromEl(b); if (it) showTip(it, b); };
    b.onmouseleave = () => { $('#tip').hidden = true; };
  });
}
function itemFromEl(b) {
  if (b.dataset.slot) return P.equip[b.dataset.slot];
  const k = b.dataset.kind, i = +b.dataset.i;
  if (k === 'inv') return P.inv[i] && P.inv[i].item;
  if (k === 'stash') return P.stash[i] && P.stash[i].item;
  if (k === 'shop') return UI.vendor && VENDOR[UI.vendor].stock[i] && VENDOR[UI.vendor].stock[i].item;
}
function priceHint(it, kind) {
  if (kind === 'shop') return `Cost: ${buyPrice(it)} gold`;
  if (UI.left === 'vendor' && (kind === 'inv')) return `Sell value: ${sellPrice(it)} gold`;
  return '';
}
function showTip(it, anchor) {
  const t = $('#tip'), kind = anchor.dataset.kind || 'equip';
  t.innerHTML = tooltipHTML(it, { price: priceHint(it, kind) }); t.hidden = false;
  const r = anchor.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 6; if (y < 6) y = r.bottom + 6;
  t.style.left = clamp(x, 6, innerWidth - tw - 6) + 'px'; t.style.top = clamp(y, 6, innerHeight - th - 6) + 'px';
}
function hidePop() { $('#pop').hidden = true; UI.pop = null; }
function itemPop(it, kind, anchor) {
  $('#tip').hidden = true;
  const b = BASES[it.base], acts = [];
  const equipable = !!KIND_SLOT[b.kind];
  if (kind === 'inv') {
    if (equipable) acts.push(['Equip', () => equipItem(it)]);
    if (b.kind === 'potion') { acts.push(['Drink', () => { invRemove(it); usePotionItem(it); }]); acts.push(['To belt', () => { if (beltAdd(it)) invRemove(it); else msg('Your belt is full.', '#d05050'); }]); }
    if (b.kind === 'scroll') acts.push(['Add to tome', () => { if (P.tp < 20) { P.tp++; invRemove(it); } else msg('Your tome is full.', '#d05050'); }]);
    if (UI.left === 'vendor') acts.push([`Sell · ${sellPrice(it)}g`, () => { invRemove(it); P.gold += sellPrice(it); VENDOR[UI.vendor].bought.push(it); sfx('gold'); }]);
    if (UI.left === 'stash') acts.push(['To stash', () => { if (gridAdd(P.stash, STASH_W, STASH_H, it)) invRemove(it); else msg('Your stash is full.', '#d05050'); }]);
    acts.push(['Drop', () => { invRemove(it); dropToGround(it, P.x + rand(-.5, .5), P.y + rand(-.5, .5)); }]);
  } else if (kind === 'equip') {
    acts.push(['Unequip', () => unequip(it)]);
  } else if (kind === 'stash') {
    acts.push(['To inventory', () => { if (invAdd(it)) { const i = P.stash.findIndex(e => e.item === it); P.stash.splice(i, 1); } else msg('Not enough room.', '#d05050'); }]);
  } else if (kind === 'shop') {
    acts.push([`Buy · ${buyPrice(it)}g`, () => buy(it)]);
  }
  const p = $('#pop');
  p.innerHTML = `<div class="tt">${tooltipHTML(it, { price: priceHint(it, kind) })}</div><div class="acts">${acts.map((a, i) => `<button data-a="${i}">${a[0]}</button>`).join('')}<button data-a="x">Close</button></div>`;
  p.hidden = false; UI.pop = it;
  p.querySelectorAll('[data-a]').forEach(btn => btn.onclick = () => { const a = btn.dataset.a; hidePop(); if (a !== 'x') { acts[+a][1](); recalc(); refreshPanels(); saveGame(); } });
  const r = anchor.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight;
  let x = r.left + r.width / 2 - pw / 2, y = r.top - ph - 8; if (y < 8) y = Math.min(innerHeight - ph - 8, r.bottom + 8);
  p.style.left = clamp(x, 8, innerWidth - pw - 8) + 'px'; p.style.top = clamp(y, 8, innerHeight - ph - 8) + 'px';
}
function equipItem(it) {
  if (!canUse(it)) { msg('You do not meet the requirements.', '#d05050'); sfx('nomana'); return; }
  const slot = slotFor(it); invRemove(it);
  const back = [];
  if (P.equip[slot]) back.push(P.equip[slot]);
  if (slot === 'rhand' && isTwoHand(it) && P.equip.lhand) { back.push(P.equip.lhand); P.equip.lhand = null; }
  if (slot === 'lhand' && isTwoHand(P.equip.rhand)) { back.push(P.equip.rhand); P.equip.rhand = null; }
  P.equip[slot] = it;
  for (const b of back) if (!invAdd(b)) dropToGround(b, P.x, P.y);
  if (slot === 'belt') beltTrim();
  sfx('click'); recalc();
}
function unequip(it) {
  const slot = Object.keys(P.equip).find(s => P.equip[s] === it); if (!slot) return;
  if (!invAdd(it)) { msg('Not enough room.', '#d05050'); return; }
  P.equip[slot] = null; if (slot === 'belt') beltTrim(); sfx('click'); recalc();
}

/* Skill tree */
function renderSkills(el) {
  const tr = UI.tree, list = SKILL_LIST.filter(k => SKILLS[k].tree === tr), c = Math.min(64, Math.floor(UI.cell * 1.45));
  const gx = c * 1.55, gy = c * 1.28;
  let lines = '';
  for (const k of list) for (const r of SKILLS[k].req) { const a = SKILLS[r], b = SKILLS[k]; lines += `<line x1="${a.col * gx + c / 2}" y1="${a.row * gy + c / 2}" x2="${b.col * gx + c / 2}" y2="${b.row * gy + c / 2}"/>`; }
  const cells = list.map(k => {
    const s = SKILLS[k], lv = P.skills[k] || 0, can = canLearn(k), bonus = skLvl(k) - lv;
    return `<button class="skc ${lv ? 'has' : ''} ${can ? 'can' : ''} ${UI.sel === k ? 'sel' : ''}" data-k="${k}" style="left:${s.col * gx}px;top:${s.row * gy}px;width:${c}px;height:${c}px" aria-label="${s.name}, level ${lv}"><img src="${skillIcon(k)}" alt=""><b>${lv}${bonus > 0 && lv ? `<i>+${bonus}</i>` : ''}</b></button>`;
  }).join('');
  const tabs = TREES.map((t, i) => `<button data-tree="${i}" aria-pressed="${i === tr}">${t.name}</button>`).join('');
  el.innerHTML = `${closeBtn()}<h2>Skill Tree</h2><div class="tabs">${tabs}</div>
  <div class="spts ${P.skillPts ? 'on' : ''}">Skill Points Remaining <b>${P.skillPts}</b></div>
  <div class="tree" style="width:${gx * 2 + c}px;height:${gy * 5 + c}px"><svg width="${gx * 2 + c}" height="${gy * 5 + c}">${lines}</svg>${cells}
  ${TIER_LVL.map((l, i) => `<span class="tier" style="top:${i * gy + c / 2 - 7}px">${l}</span>`).join('')}</div>
  <div class="skinfo">${UI.sel && SKILLS[UI.sel].tree === tr ? skillInfo(UI.sel) : '<p class="hintp">Tap a skill to see what it does, learn it, or put it on a button.</p>'}</div>`;
  bindClose(el);
  el.querySelectorAll('[data-tree]').forEach(b => b.onclick = () => { UI.tree = +b.dataset.tree; UI.sel = null; renderSkills(el); sfx('click'); });
  el.querySelectorAll('.skc').forEach(b => b.onclick = () => { UI.sel = b.dataset.k; renderSkills(el); sfx('click'); });
  const lb = el.querySelector('[data-learn]'); if (lb) lb.onclick = () => { learn(UI.sel); renderSkills(el); saveGame(); };
  el.querySelectorAll('[data-assign]').forEach(b => b.onclick = () => { const i = +b.dataset.assign, prev = P.slots.indexOf(UI.sel); if (prev >= 0) P.slots[prev] = P.slots[i]; P.slots[i] = UI.sel; if (i === 0 && !P.slots.includes('attack')) { const e = P.slots.indexOf(null); if (e > 0) P.slots[e] = 'attack'; } refreshHUD(); renderSkills(el); sfx('click'); saveGame(); });
}
function skillInfo(k) {
  const s = SKILLS[k], base = P.skills[k] || 0, L = skLvl(k), nextL = Math.max(1, L) + (base ? 1 : 0);
  const line = (lvl) => {
    const out = [];
    if (s.dmg) { const save = P.skills[k]; P.skills[k] = save || 1; const sv = skLvlOverride(k, lvl); out.push(`${s.el === 'fire' ? 'Fire' : s.el === 'cold' ? 'Cold' : 'Lightning'} Damage: ${sv[0]}–${sv[1]}${s.channel || k === 'blaze' || k === 'firewall' ? ' per second' : ''}`); P.skills[k] = save; if (!save) delete P.skills[k]; }
    if (s.val) out.push(k === 'warmth' ? `Mana Recovery +${s.val(lvl)}%` : k === 'frozenarmor' ? `Defense +${s.val(lvl)}%` : k === 'energyshield' ? `Absorbs ${s.val(lvl)}% of damage` : k === 'coldmastery' ? `-${s.val(lvl)}% enemy cold resistance` : `+${s.val(lvl)}% damage`);
    if (s.dur) out.push(`Duration: ${Math.round(s.dur(lvl))} seconds`);
    if (s.n) out.push(`${k === 'chainlightning' ? 'Hits' : 'Bolts'}: ${s.n(lvl)}`);
    if (s.rad) out.push(`Radius: ${s.rad(lvl).toFixed(1)} yards`);
    if (s.aim !== 'passive') out.push(`Mana Cost: ${s.mana(lvl).toFixed(1).replace(/\.0$/, '')}`);
    return out.join('<br>');
  };
  const reqs = s.req.map(r => `<span class="${P.skills[r] ? 'ok' : 'no'}">${SKILLS[r].name}</span>`).join(', ');
  const syn = (s.syn || []).map(([id, p]) => `${SKILLS[id].name}: +${Math.round(p * 100)}% per level`).join('<br>');
  return `<h3>${s.name}</h3><p>${s.desc}</p>
  <p class="reqs">Required Level: <span class="${P.level >= s.lvl ? 'ok' : 'no'}">${s.lvl}</span>${reqs ? ` · Requires ${reqs}` : ''}</p>
  ${base ? `<div class="lvl"><small>Current level ${L}</small>${line(L)}</div>` : ''}
  <div class="lvl"><small>${base ? 'Next level' : 'First level'}</small>${line(nextL)}</div>
  ${syn ? `<div class="lvl syn"><small>Synergies</small>${syn}</div>` : ''}
  <div class="skact"><button data-learn ${canLearn(k) ? '' : 'disabled'}>Learn ${base ? 'next level' : 'skill'}</button></div>
  ${base && s.aim !== 'passive' ? `<div class="assign"><small>Put on button</small>${SLOT_KEYS.map((n, i) => `<button data-assign="${i}" aria-pressed="${P.slots[i] === k}">${n}</button>`).join('')}</div>` : ''}`;
}
function skLvlOverride(k, lvl) { const s = SKILLS[k]; let [a, b] = s.dmg(lvl); const ref = skDmg(k), cur = s.dmg(skLvl(k) || 1); const mul = ref[0] / Math.max(1, Math.round(cur[0])); return [Math.round(a * mul), Math.round(b * mul)]; }

/* ---------- Town: NPCs, vendors, stash ---------- */
const VENDOR = { akara: { stock: [], bought: [], dirty: true }, charsi: { stock: [], bought: [], dirty: true } };
function restock(id) {
  const V = VENDOR[id], N = NPCS[id], ilvl = Math.max(3, P.level + 2) + DIFFS[G.diff].mlvl;
  V.stock = []; V.dirty = false;
  for (const b of N.shop) { const it = makeItem(b, ilvl); if (BASES[b].q <= ilvl) V.stock.push(it); }
  const kinds = N.gear, pool = EQUIP_BASES.filter(k => kinds.includes(BASES[k].kind) && BASES[k].q <= ilvl);
  for (let i = 0; i < (id === 'akara' ? 9 : 16); i++) { const r = Math.random(); V.stock.push(makeItem(pick(pool), ilvl, r < .45 ? 'magic' : 'normal')); }
  const grid = []; for (const it of V.stock) gridAdd(grid, 10, 10, it);
  V.stock = grid;
}
function buyPrice(it) { const b = BASES[it.base]; return b.kind === 'potion' || b.kind === 'scroll' ? b.cost : itemValue(it); }
function sellPrice(it) { const b = BASES[it.base]; return Math.max(1, Math.floor((b.kind === 'potion' || b.kind === 'scroll' ? b.cost : itemValue(it)) / 4)); }
function buy(it) {
  const price = buyPrice(it), b = BASES[it.base];
  if (P.gold < price) { msg('You do not have enough gold.', '#d05050'); sfx('nomana'); return; }
  const copy = b.kind === 'potion' || b.kind === 'scroll';
  const item = copy ? makeItem(it.base, it.ilvl) : it;
  let ok = false;
  if (b.kind === 'scroll') { if (P.tp < 20) { P.tp++; ok = true; } else msg('Your tome is full.', '#d05050'); }
  else if (b.kind === 'potion') ok = beltAdd(item) || invAdd(item);
  else ok = invAdd(item);
  if (!ok) { if (b.kind !== 'scroll') msg('Not enough room.', '#d05050'); return; }
  P.gold -= price; sfx('gold');
  if (!copy) { const V = VENDOR[UI.vendor]; V.stock.splice(V.stock.findIndex(e => e.item === it), 1); }
}
function renderVendor(el) {
  const V = VENDOR[UI.vendor], N = NPCS[UI.vendor], c = UI.cell;
  if (V.dirty) restock(UI.vendor);
  el.innerHTML = `${closeBtn()}<h2>${N.name}</h2><p class="sub">Tap an item to buy it. Tap your own items to sell them.</p>
  <div class="grid shop" style="width:${c * 10}px;height:${c * 10}px">${gridItems(V.stock, c, 'shop')}</div>
  <div class="goldrow"><span class="coin"></span><b>${P.gold}</b> Gold</div>`;
  bindClose(el);
  el.querySelectorAll('.gi').forEach(b => b.onclick = () => { const e = V.stock[+b.dataset.i]; if (e) itemPop(e.item, 'shop', b); });
  bindTips(el);
}
function renderStash(el) {
  const c = UI.cell;
  el.innerHTML = `${closeBtn()}<h2>Stash</h2><p class="sub">Items here are safe. Tap to move them.</p>
  <div class="grid stash" style="width:${c * STASH_W}px;height:${c * STASH_H}px">${gridItems(P.stash, c, 'stash')}</div>
  <div class="goldrow"><span class="coin"></span><b>${P.stashGold}</b> Gold in stash <span class="sp"></span><button data-g="in">Deposit</button><button data-g="out">Withdraw</button></div>`;
  bindClose(el);
  el.querySelectorAll('.gi').forEach(b => b.onclick = () => { const e = P.stash[+b.dataset.i]; if (e) itemPop(e.item, 'stash', b); });
  el.querySelector('[data-g=in]').onclick = () => { P.stashGold += P.gold; P.gold = 0; sfx('gold'); refreshPanels(); saveGame(); };
  el.querySelector('[data-g=out]').onclick = () => { P.gold += P.stashGold; P.stashGold = 0; sfx('gold'); refreshPanels(); saveGame(); };
  bindTips(el);
}
function openStash() { UI.left = 'stash'; UI.right = 'inv'; refreshPanels(); sfx('click'); }
function openNpc(n) { UI.npc = n.id; UI.left = 'npc'; UI.right = null; UI.talk = null; if (NPCS[n.id].heals) { P.life = P.maxLife; P.mana = P.maxMana; P.chillT = 0; msg('Akara restores your life and mana.', '#e8e2d2'); } refreshPanels(); sfx('click'); }
const LORE = {
  akara: [
    "Welcome, Sorceress. The Sisters of the Sightless Eye have little left to offer, but what we have is yours.",
    "There is a place of great evil in the wilderness. Kashya's Rogue scouts have informed me that a cave nearby is filled with shadowy creatures. Cleanse the Den of Evil and I will teach you what I can.",
  ],
  charsi: ["Hi there. I'm Charsi, the Blacksmith here in camp. If you need weapons or armor, you've come to the right place."],
  kashya: ["Our camp sits at the edge of the Blood Moor. The dead walk out there, and the Fallen hunt in packs. Watch for their shamans: they will raise the fallen as fast as you cut them down.", "The road north to the Cold Plains is blocked by a rockslide. For now, the moor is your battlefield."],
};
function renderNpc(el) {
  const id = UI.npc, N = NPCS[id];
  let text = LORE[id][0], acts = [];
  if (id === 'akara') {
    if (P.quest.den === 0) { text = LORE.akara[1]; acts.push(['Accept quest', () => { P.quest.den = 1; sfx('quest'); msg('Quest: Den of Evil. Find the cave on the Blood Moor and slay every creature inside.', '#c9a24a'); }]); }
    else if (P.quest.den === 1) text = `The Den of Evil still festers. ${G.areas.den.monsters.filter(m => !m.dead).length} foul creatures remain inside. Its mouth lies far across the moor.`;
    else if (P.quest.den === 2) { text = 'You have cleansed the Den of Evil. As promised, take this gift: a lesson in the arcane.'; acts.push(['Claim reward', () => { P.quest.den = 3; P.skillPts++; if (P.diffMax <= G.diff && G.diff < 2) { P.diffMax = G.diff + 1; msg(`${DIFFS[P.diffMax].name} difficulty unlocked. Start it from the menu.`, '#c7b377'); } sfx('level'); showBanner('Quest complete', '+1 skill point'); }]); }
  }
  if (id === 'kashya') text = LORE.kashya[(UI.talkN = ((UI.talkN || 0) + 1)) % 2];
  if (N.gear) acts.unshift(['Trade', () => { UI.vendor = id; UI.left = 'vendor'; UI.right = 'inv'; }]);
  acts.push(['Leave', () => { UI.left = null; }]);
  el.innerHTML = `${closeBtn()}<h2>${N.name}</h2><p class="sub">${N.title}</p><p class="talk">${text}</p><div class="acts">${acts.map((a, i) => `<button data-a="${i}">${a[0]}</button>`).join('')}</div>`;
  bindClose(el);
  el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { acts[+b.dataset.a][1](); refreshPanels(); saveGame(); sfx('click'); });
}

/* Menu */
function renderMenu(el) {
  const diffs = DIFFS.map((d, i) => `<button data-diff="${i}" ${i > P.diffMax ? 'disabled' : ''} aria-pressed="${i === G.diff}">${d.name}${i > P.diffMax ? ' 🔒' : ''}</button>`).join('');
  el.innerHTML = `${closeBtn()}<h2>Game Menu</h2>
  <div class="opts">
    <label><span>Sound</span><input type="checkbox" id="optSound" ${AU.on ? 'checked' : ''}></label>
    <label><span>Always show item names</span><input type="checkbox" id="optLabels" ${RD.showLabels ? 'checked' : ''}></label>
    <label><span>Minimap</span><input type="checkbox" id="optMini" ${RD.miniMap ? 'checked' : ''}></label>
    <label><span>Classic 256-colour palette</span><input type="checkbox" id="optPal" ${PAL.on ? 'checked' : ''}></label>
  </div>
  <h3>New game</h3><p class="sub">Starts a fresh world: the moor is rebuilt and monsters return. Your hero, items and stash carry over.</p>
  <div class="acts diffs">${diffs}</div>
  <h3>Controls</h3>
  <dl class="keys">${UI.touch ? `
    <dt>Drag anywhere</dt><dd>Move</dd><dt>Tap</dt><dd>Walk, attack, talk, pick up</dd>
    <dt>Skill buttons</dt><dd>Hold to cast at the nearest enemy. Drag off a button to aim, release to cast.</dd>
    <dt>Potions</dt><dd>Tap a belt slot to drink</dd>` : `
    <dt>Left click</dt><dd>Move, attack, talk, pick up (hold to keep going)</dd><dt>Right click</dt><dd>Cast the RMB skill</dd>
    <dt>Q W E R</dt><dd>Cast slot skills at the cursor</dd><dt>1–4</dt><dd>Drink from the belt</dd>
    <dt>C / I / T</dt><dd>Character, inventory, skill tree</dd><dt>Tab</dt><dd>Automap</dd><dt>Alt</dt><dd>Show item names</dd><dt>F</dt><dd>Town Portal</dd><dt>Esc</dt><dd>Close panels / menu</dd>`}
  </dl>
  <div class="acts"><button id="mTitle">Save and exit to title</button></div>`;
  bindClose(el);
  $('#optSound').onchange = e => { setSound(e.target.checked); saveSettings(); };
  $('#optLabels').onchange = e => { RD.showLabels = e.target.checked; saveSettings(); };
  $('#optMini').onchange = e => { RD.miniMap = e.target.checked; saveSettings(); };
  $('#optPal').onchange = e => { PAL.on = e.target.checked; saveSettings(); };
  el.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { const d = +b.dataset.diff; if (d > P.diffMax) return; newGame(d); closePanels(); });
  $('#mTitle').onclick = () => { saveGame(); closePanels(); showTitle(); };
}

/* ---------- Input ---------- */
const IN = { mx: 0, my: 0, lmb: false, rmb: false, keys: {}, leftMode: null, joy: null, skillPtr: {} };
function pickAt(cx, cy, touch) {
  for (const r of RD.labelRects || []) if (cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1) return { k: 'label', gi: r.gi };
  let best = null, bd = 1e9;
  for (const h of RD.hoverables) {
    const x = ((h.sx - RD.camX) * RD.Z + RD.W / 2) / RD.dpr, y = ((h.sy - RD.camY) * RD.Z + RD.H / 2) / RD.dpr;
    const r = h.r * RD.cssZ * (touch ? 1.7 : 1.05), d = Math.hypot(cx - x, cy - y) - (h.k === 'mon' ? 4 : 0);
    if (d < r && d < bd) { bd = d; best = h; }
  }
  return best || { k: 'ground' };
}
function clickAt(cx, cy, touch) {
  if (G.dead || !G.running) return;
  const h = pickAt(cx, cy, touch), [wx, wy] = screenToWorld(cx, cy);
  P.held = null;
  if (h.k === 'label') { P.order = { type: 'pickup', gi: h.gi }; P.path = null; return 'item'; }
  if (h.k === 'npc') { P.order = { type: 'npc', n: h.e }; P.path = null; return 'npc'; }
  if (h.k === 'obj') { P.order = { type: 'obj', o: h.o }; P.path = null; return 'obj'; }
  if (h.k === 'portal') { P.order = { type: 'portal', x: h.pe.x, y: h.pe.y, side: h.pe.side }; P.path = null; return 'portal'; }
  if (h.k === 'mon') {
    const sk = P.slots[0] || 'attack';
    if (sk === 'attack') P.order = { type: 'attack', m: h.e, skill: 'attack', repeat: !touch };
    else if (SKILLS[sk].aim === 'self') { tryUseSkill(sk, h.e.x, h.e.y, h.e); }
    else P.order = { type: 'attack', m: h.e, skill: sk, repeat: !touch };
    P.path = null; return 'mon';
  }
  // trigger (cave mouths)
  for (const t of G.area.triggers) if (dist(wx, wy, t.x, t.y) < 1.4) { P.order = { type: 'trigger', t }; P.path = null; return 'trigger'; }
  P.order = { type: 'move', x: wx, y: wy }; P.path = null;
  G.fx.push({ k: 'ring', x: wx, y: wy, c: '220,200,150', r: .5, life: .3, t: 0 });
  return 'ground';
}
function cursorTarget() {
  const h = pickAt(IN.mx, IN.my, false);
  if (h.k === 'mon') return { x: h.e.x, y: h.e.y, m: h.e };
  const [x, y] = screenToWorld(IN.mx, IN.my); return { x, y, m: null };
}
function autoTarget(skill) {
  const s = SKILLS[skill];
  if (s.aim === 'self') return { x: P.x, y: P.y, m: null };
  const range = skill === 'attack' ? 6 : 13;
  let dirA = P.joy ? Math.atan2(P.joy.y, P.joy.x) : null;
  let m = null;
  if (G.focus && !G.focus.dead && G.focusT > 1 && dist(P.x, P.y, G.focus.x, G.focus.y) < range && los(G.area, P.x, P.y, G.focus.x, G.focus.y)) m = G.focus;
  if (!m) {
    let best = 1e9;
    for (const o of G.area.monsters) {
      if (o.dead) continue; const d = dist(P.x, P.y, o.x, o.y); if (d > range) continue;
      if (!los(G.area, P.x, P.y, o.x, o.y)) continue;
      let score = d; if (dirA !== null) score += Math.abs(angDiff(Math.atan2(o.y - P.y, o.x - P.x), dirA)) * 3;
      if (score < best) { best = score; m = o; }
    }
  }
  if (m) return { x: m.x, y: m.y, m };
  if (skill === 'attack') return null;
  const a = dirA !== null ? dirA : P.ang, d = skill === 'teleport' ? 8 : 5;
  return { x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d, m: null };
}
function holdSkill(i, resolve) {
  const id = P.slots[i]; if (!id) return;
  if (SKILLS[id].aim === 'passive') return;
  P.held = { skill: id, resolve, i };
}
function bindInput() {
  const cv = $('#game');
  UI.touch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
  document.body.classList.toggle('touch', UI.touch);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  // Mouse
  cv.addEventListener('mousedown', e => {
    if (UI.touch && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    audioInit(); hidePop(); IN.mx = e.clientX; IN.my = e.clientY;
    if (e.button === 0) {
      IN.lmb = true;
      if (e.shiftKey && P.slots[0] && P.slots[0] !== 'attack') { holdSkill(0, cursorTarget); IN.leftMode = 'cast'; return; }
      IN.leftMode = clickAt(e.clientX, e.clientY, false);
    } else if (e.button === 2) { IN.rmb = true; holdSkill(1, cursorTarget); }
  });
  addEventListener('mouseup', e => {
    if (e.button === 0) { IN.lmb = false; if (P.order && P.order.type === 'attack') P.order.repeat = false; if (IN.leftMode === 'cast') P.held = null; IN.leftMode = null; }
    if (e.button === 2) { IN.rmb = false; if (P.held && P.held.i === 1) P.held = null; }
  });
  cv.addEventListener('mousemove', e => {
    IN.mx = e.clientX; IN.my = e.clientY;
    if (IN.lmb && IN.leftMode === 'ground' && G.running && !G.dead) { const [x, y] = screenToWorld(e.clientX, e.clientY); P.order = { type: 'move', x, y }; }
  });
  // Keyboard
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase(); if (IN.keys[k]) { if (k === 'alt' || k === 'tab') e.preventDefault(); return; }
    IN.keys[k] = true; audioInit();
    if (!G.running) return;
    if (k === 'escape') { if (!$('#pop').hidden) hidePop(); else if (UI.left || UI.right) closePanels(); else { UI.left = 'menu'; refreshPanels(); } return; }
    if (G.dead) return;
    const si = { q: 2, w: 3, e: 4, r: 5 }[k]; if (si !== undefined) { holdSkill(si, cursorTarget); return; }
    if (k >= '1' && k <= '4') { drink(+k - 1); return; }
    if (k === 'c' || k === 'a') openPanel('L', 'char');
    else if (k === 'i' || k === 'b') openPanel('R', 'inv');
    else if (k === 't' || k === 's') openPanel('R', 'skills');
    else if (k === 'tab') { e.preventDefault(); RD.showMap = !RD.showMap; }
    else if (k === 'alt') { e.preventDefault(); RD.altHeld = true; }
    else if (k === 'f') castTownPortal();
    else if (k === 'm') { setSound(!AU.on); saveSettings(); }
  });
  addEventListener('keyup', e => {
    const k = e.key.toLowerCase(); IN.keys[k] = false;
    const si = { q: 2, w: 3, e: 4, r: 5 }[k]; if (si !== undefined && P.held && P.held.i === si) P.held = null;
    if (k === 'alt') RD.altHeld = false;
  });
  addEventListener('blur', () => { IN.keys = {}; P.held = null; IN.lmb = false; RD.altHeld = false; });
  // Touch on the world: drag = joystick, tap = click
  const joy = $('#joy'), knob = $('#knob');
  cv.addEventListener('touchstart', e => {
    audioInit(); hidePop();
    for (const t of e.changedTouches) {
      if (IN.joy) continue;
      IN.joy = { id: t.identifier, x0: t.clientX, y0: t.clientY, moved: false, t0: performance.now() };
    }
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      const J = IN.joy; if (!J || t.identifier !== J.id) continue;
      const dx = t.clientX - J.x0, dy = t.clientY - J.y0, L = Math.hypot(dx, dy);
      if (!J.moved && L > 14) { J.moved = true; joy.hidden = false; joy.style.left = J.x0 + 'px'; joy.style.top = J.y0 + 'px'; P.order = null; }
      if (J.moved) {
        const R = 56, k = Math.min(1, L / R), nx = dx / (L || 1), ny = dy / (L || 1);
        knob.style.transform = `translate(${nx * k * R}px,${ny * k * R}px)`;
        // screen direction -> world direction
        const wx = unIsoX(nx * 64, ny * 64), wy = unIsoY(nx * 64, ny * 64), wl = Math.hypot(wx, wy) || 1;
        P.joy = { x: wx / wl * Math.max(.35, k), y: wy / wl * Math.max(.35, k) };
      }
    }
    e.preventDefault();
  }, { passive: false });
  const endTouch = e => {
    for (const t of e.changedTouches) {
      const J = IN.joy; if (!J || t.identifier !== J.id) continue;
      if (!J.moved && performance.now() - J.t0 < 600) clickAt(t.clientX, t.clientY, true);
      IN.joy = null; P.joy = null; joy.hidden = true; knob.style.transform = '';
    }
  };
  cv.addEventListener('touchend', endTouch); cv.addEventListener('touchcancel', endTouch);
  addEventListener('resize', () => { if (UI.left || UI.right) refreshPanels(); if (G.running) layoutHUD(); });
  // close popups when tapping outside
  addEventListener('pointerdown', e => { const p = $('#pop'); if (!p.hidden && !p.contains(e.target) && !e.target.closest('.gi,.eq')) hidePop(); }, true);
}
function bindHudButtons() {
  // skill buttons: pointer events so mouse and touch both work; drag to aim
  $$('#skillbar .sk').forEach(b => {
    const i = +b.dataset.i;
    b.onpointerdown = e => {
      e.preventDefault(); audioInit(); b.setPointerCapture(e.pointerId);
      const id = P.slots[i]; if (!id) { UI.right = 'skills'; refreshPanels(); return; }
      const r = b.getBoundingClientRect();
      IN.skillPtr[e.pointerId] = { i, x0: r.left + r.width / 2, y0: r.top + r.height / 2, aiming: false };
      b.classList.add('on');
      holdSkill(i, () => autoTarget(P.slots[i]));
    };
    b.onpointermove = e => {
      const S = IN.skillPtr[e.pointerId]; if (!S) return;
      const id = P.slots[S.i]; if (!id || SKILLS[id].aim === 'self') return;
      const dx = e.clientX - S.x0, dy = e.clientY - S.y0, L = Math.hypot(dx, dy);
      if (!S.aiming && L > 34) { S.aiming = true; P.held = null; }
      if (S.aiming) {
        const wx = unIsoX(dx, dy), wy = unIsoY(dx, dy), wl = Math.hypot(wx, wy) || 1, reach = clamp(L / 18, 2, id === 'teleport' ? 12 : 10);
        RD.aim = { x: P.x + wx / wl * reach, y: P.y + wy / wl * reach };
      }
    };
    const up = e => {
      const S = IN.skillPtr[e.pointerId]; if (!S) return; delete IN.skillPtr[e.pointerId];
      b.classList.remove('on');
      if (S.aiming && RD.aim) { const id = P.slots[S.i], a = RD.aim; const m = nearestMonster(a.x, a.y, 1.6); tryUseSkill(id, m ? m.x : a.x, m ? m.y : a.y, m); RD.aim = null; }
      if (P.held && P.held.i === S.i) P.held = null;
    };
    b.onpointerup = up; b.onpointercancel = up;
    b.oncontextmenu = e => e.preventDefault();
  });
  $$('#belt .bslot').forEach(b => b.onclick = () => { audioInit(); drink(+b.dataset.i); });
  $('#btnChar').onclick = () => openPanel('L', 'char');
  $('#btnInv').onclick = () => openPanel('R', 'inv');
  $('#btnSkills').onclick = () => openPanel('R', 'skills');
  $('#btnMap').onclick = () => { RD.showMap = !RD.showMap; sfx('click'); };
  $('#btnTP').onclick = () => castTownPortal();
  $('#btnMenu').onclick = () => openPanel('L', 'menu');
  $('#globeL').onclick = () => openPanel('L', 'char');
}
function updateHover() {
  RD.hoverM = RD.hoverN = RD.hoverLabel = RD.hoverAny = null;
  if (UI.touch || !G.running) return;
  const h = pickAt(IN.mx, IN.my, false);
  if (h.k === 'label') RD.hoverLabel = h.gi;
  else if (h.k === 'mon') RD.hoverM = h.e;
  else if (h.k === 'npc') RD.hoverN = h.e;
  if (h.k !== 'ground') RD.hoverAny = h;
  $('#game').style.cursor = h.k === 'ground' ? 'default' : 'pointer';
}
