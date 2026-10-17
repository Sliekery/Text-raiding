/* Items: generation (normal / magic / rare / unique), requirements, inventory grids, belt. */
'use strict';
let ITEM_ID = 1;
const INV_W = 10, INV_H = 4, STASH_W = 6, STASH_H = 8;

function eligibleAffixes(list, kind, ilvl) { return list.filter(a => a[4] <= ilvl && a[5].includes(kind)); }
function rollAffix(a) { return Math.round(rand(a[2], a[3] + .999) - .4999); }

function makeItem(baseId, ilvl, rarity = 'normal') {
  const b = BASES[baseId];
  const it = { id: ITEM_ID++, base: baseId, rarity, ilvl, mods: {}, name: b.name, reqLvl: 0 };
  if (b.def) it.def = randi(b.def[0], b.def[1]);
  if (b.dmg) it.dmg = b.dmg.slice();
  if (rarity === 'magic' || rarity === 'rare') {
    const kind = b.kind, pres = eligibleAffixes(PREFIXES, kind, ilvl), sufs = eligibleAffixes(SUFFIXES, kind, ilvl);
    let nP, nS;
    if (rarity === 'magic') { const r = Math.random(); nP = r < .4 ? 1 : r < .7 ? 0 : 1; nS = r < .4 ? 0 : 1; if (r >= .7) nS = 1; }
    else { const n = randi(3, 6); nP = Math.min(3, randi(1, n - 1)); nS = Math.min(3, n - nP); }
    const used = new Set();
    const take = (pool, n) => {
      let first = null;
      for (let i = 0; i < n && pool.length; i++) {
        const opts = pool.filter(a => !used.has(a[1])); if (!opts.length) break;
        // favour higher tiers as item level rises
        opts.sort((a, b) => b[4] - a[4]); const a = opts[Math.min(opts.length - 1, Math.floor(Math.pow(Math.random(), 1.4) * opts.length))];
        used.add(a[1]); it.mods[a[1]] = (it.mods[a[1]] || 0) + rollAffix(a); it.reqLvl = Math.max(it.reqLvl, Math.floor(a[4] * .85)); first = first || a[0];
      }
      return first;
    };
    const pName = take(pres, nP), sName = take(sufs, nS);
    if (!Object.keys(it.mods).length) { it.rarity = 'normal'; }
    else if (rarity === 'magic') it.name = [pName, b.name, sName].filter(Boolean).join(' ');
    else { const kk = RARE_B[kind] || RARE_B.ring; it.name = pick(RARE_A) + ' ' + pick(kk); }
  }
  applyItemMods(it);
  return it;
}
function makeUnique(u, ilvl) {
  const it = makeItem(u.base, ilvl, 'normal');
  it.rarity = 'unique'; it.name = u.name; it.mods = JSON.parse(JSON.stringify(u.mods)); it.reqLvl = u.lvl;
  // a little roll variance on percentage stats, like the real thing
  for (const k of ['edef', 'mf', 'gf', 'resF', 'resC', 'resL', 'life', 'mana']) if (it.mods[k]) it.mods[k] = Math.round(it.mods[k] * rand(.85, 1.1));
  applyItemMods(it);
  return it;
}
function applyItemMods(it) {
  const b = BASES[it.base];
  if (b.def) { if (it.baseDef === undefined) it.baseDef = it.def; it.def = Math.floor(it.baseDef * (1 + (it.mods.edef || 0) / 100)) + (it.mods.def || 0); }
  if (b.dmg) { const e = 1 + (it.mods.edmg || 0) / 100; it.dmg = [Math.max(1, Math.floor(b.dmg[0] * e)), Math.max(2, Math.floor(b.dmg[1] * e) + (it.mods.mdmg || 0))]; }
  it.reqStr = b.str || 0; it.reqDex = b.dex || 0;
  if (it.reqStr && (it.mods.edef || it.mods.edmg)) it.reqStr = Math.floor(it.reqStr * .9);
}
function itemValue(it) {
  const b = BASES[it.base]; if (b.kind === 'gold') return 0;
  const m = { normal: 1, magic: 2.5, rare: 5, unique: 8 }[it.rarity] || 1;
  return Math.max(1, Math.round(b.cost * m * (1 + (it.ilvl || 1) / 25) + Object.keys(it.mods).length * 25));
}

/* ---------- Drops ---------- */
function rollRarity(mf, q) {
  const ef = (x, k) => x * k / (x + k);
  const mul = { normal: 1, champion: 1.8, unique: 3, boss: 6 }[q] || 1;
  if (Math.random() < mul * (1 + ef(mf, 250) / 100) / 110) return 'unique';
  if (Math.random() < mul * (1 + ef(mf, 600) / 100) / 20) return 'rare';
  if (Math.random() < mul * (1 + mf / 100) / 3.2) return 'magic';
  return 'normal';
}
function pickBase(ilvl) {
  const opts = EQUIP_BASES.filter(k => BASES[k].q <= ilvl);
  const w = opts.map(k => { const q = BASES[k].q; const gap = ilvl - q; return gap > 14 ? .25 : 1 + q / 20 + (['staff', 'wand', 'orb', 'ring', 'amulet'].includes(BASES[k].kind) ? .4 : 0); });
  let s = w.reduce((a, b) => a + b, 0) * Math.random();
  for (let i = 0; i < opts.length; i++) { s -= w[i]; if (s <= 0) return opts[i]; }
  return opts[opts.length - 1];
}
function potionFor(ilvl, kind) {
  const ids = Object.keys(BASES).filter(k => BASES[k].pot === kind && BASES[k].q <= ilvl);
  if (!ids.length) return kind === 'rv' ? null : kind + '1';
  return Math.random() < .7 ? ids[ids.length - 1] : pick(ids);
}
// Returns an array of {item} drops for a monster death
function rollDrops(ilvl, mf, q) {
  const out = [];
  const picks = { normal: 1, champion: 2, unique: 4, boss: 6 }[q] || 1;
  const noDrop = { normal: .55, champion: .2, unique: 0, boss: 0 }[q] || .55;
  for (let i = 0; i < picks; i++) {
    if (Math.random() < noDrop) continue;
    const r = Math.random();
    if (r < .3) { const g = makeItem('gold', ilvl); g.qty = Math.max(1, Math.round(randi(3, 12) * (1 + ilvl * .9) * (1 + P.bonus.gf / 100))); out.push(g); }
    else if (r < .58) { const kind = Math.random() < .5 ? 'hp' : Math.random() < .8 ? 'mp' : 'rv'; const id = potionFor(ilvl, kind); if (id) out.push(makeItem(id, ilvl)); }
    else if (r < .62) out.push(makeItem('tp', ilvl));
    else out.push(rollEquip(ilvl, mf, q));
  }
  if (q === 'boss' || q === 'unique') out.push(rollEquip(ilvl, mf, q));
  return out;
}
function rollEquip(ilvl, mf, q) {
  const rar = rollRarity(mf, q);
  if (rar === 'unique') {
    const u = UNIQUES.filter(u => BASES[u.base].q <= ilvl + 2 && u.lvl <= ilvl + 4);
    if (u.length) return makeUnique(pick(u), ilvl);
    return makeItem(pickBase(ilvl), ilvl, 'rare');
  }
  const base = pickBase(ilvl), k = BASES[base].kind;
  return makeItem(base, ilvl, rar === 'normal' && (k === 'ring' || k === 'amulet') ? 'magic' : rar);
}

/* ---------- Requirements and equipping ---------- */
function canUse(it) {
  return P.level >= (it.reqLvl || 0) && P.st.str >= (it.reqStr || 0) && P.st.dex >= (it.reqDex || 0);
}
function slotFor(it) { const k = BASES[it.base].kind; const s = KIND_SLOT[k]; if (s === 'ring') return P.equip.ring1 && !P.equip.ring2 ? 'ring2' : 'ring1'; return s; }
function isTwoHand(it) { return it && BASES[it.base].two; }

/* ---------- Grids ---------- */
function gridFits(list, gw, gh, w, h, x, y, ignore) {
  if (x < 0 || y < 0 || x + w > gw || y + h > gh) return false;
  for (const e of list) { if (e === ignore) continue; const b = BASES[e.item.base]; if (x < e.x + b.w && x + w > e.x && y < e.y + b.h && y + h > e.y) return false; }
  return true;
}
function gridFind(list, gw, gh, w, h) {
  for (let x = 0; x <= gw - w; x++) for (let y = 0; y <= gh - h; y++) if (gridFits(list, gw, gh, w, h, x, y)) return [x, y];
  return null;
}
function gridAdd(list, gw, gh, item) {
  const b = BASES[item.base], s = gridFind(list, gw, gh, b.w, b.h); if (!s) return false;
  list.push({ item, x: s[0], y: s[1] }); return true;
}
function invAdd(item) { return gridAdd(P.inv, INV_W, INV_H, item); }
function invRemove(item) { const i = P.inv.findIndex(e => e.item === item); if (i >= 0) P.inv.splice(i, 1); }

/* ---------- Belt: 4 columns, each a stack of potions (bottom first) ---------- */
function beltRows() { const b = P.equip.belt; return b ? BASES[b.base].rows : 1; }
function beltAdd(item) {
  const b = BASES[item.base]; if (b.kind !== 'potion') return false;
  const rows = beltRows();
  for (let c = 0; c < 4; c++) { const col = P.belt[c]; if (col.length && col.length < rows && BASES[col[0].base].pot === b.pot) { col.push(item); return true; } }
  for (let c = 0; c < 4; c++) if (!P.belt[c].length) { P.belt[c].push(item); return true; }
  return false;
}
function beltTrim() {
  const rows = beltRows();
  for (const col of P.belt) while (col.length > rows) { const it = col.pop(); if (!invAdd(it)) dropToGround(it, P.x, P.y); }
}

/* ---------- Tooltips ---------- */
const RARITY_COL = { normal: '#e8e2d2', magic: '#7f86ff', rare: '#ffff64', unique: '#c7b377' };
function itemColor(it) { if (BASES[it.base].kind === 'gold') return '#e8e2d2'; return RARITY_COL[it.rarity] || '#fff'; }
function tooltipHTML(it, opts = {}) {
  const b = BASES[it.base], L = [];
  const c = itemColor(it), bad = s => `<span class="req bad">${s}</span>`, ok = s => `<span class="req">${s}</span>`;
  L.push(`<div class="tn" style="color:${c}">${it.name}</div>`);
  if (it.rarity === 'rare' || it.rarity === 'unique') L.push(`<div class="tn" style="color:${c}">${b.name}</div>`);
  if (b.kind === 'gold') L.push(`<div>${it.qty} Gold</div>`);
  if (b.kind === 'potion') L.push(`<div>${b.pot === 'rv' ? `Restores ${b.heal}% of Life and Mana` : `${b.pot === 'hp' ? 'Heals' : 'Restores'} ${b.heal} ${b.pot === 'hp' ? 'Life' : 'Mana'}`}</div>`);
  if (b.kind === 'scroll') L.push('<div>Adds a charge to your Tome of Town Portal</div>');
  if (it.def) L.push(`<div>Defense: <span style="color:${it.mods.edef || it.mods.def ? '#7f86ff' : 'inherit'}">${it.def}</span></div>`);
  if (it.dmg) L.push(`<div>${b.two ? 'Two-Hand' : 'One-Hand'} Damage: <span style="color:${it.mods.edmg ? '#7f86ff' : 'inherit'}">${it.dmg[0]} to ${it.dmg[1]}</span></div>`);
  if (b.rows) L.push(`<div>Belt size: ${b.rows} rows</div>`);
  if (it.reqDex) L.push((P.st.dex >= it.reqDex ? ok : bad)(`Required Dexterity: ${it.reqDex}`));
  if (it.reqStr) L.push((P.st.str >= it.reqStr ? ok : bad)(`Required Strength: ${it.reqStr}`));
  if (it.reqLvl) L.push((P.level >= it.reqLvl ? ok : bad)(`Required Level: ${it.reqLvl}`));
  for (const k of STAT_ORDER) {
    const v = it.mods[k]; if (!v) continue;
    if (k === 'sk') { for (const s in v) L.push(`<div class="mod">+${v[s]} to ${SKILLS[s].name} (Sorceress Only)</div>`); continue; }
    if (k === 'edef' && !b.def) continue; if (k === 'def' && b.def) continue; if ((k === 'edmg' || k === 'mdmg') && !b.dmg) continue;
    L.push(`<div class="mod">${STAT_TEXT[k](v)}</div>`);
  }
  if (opts.price) L.push(`<div class="price">${opts.price}</div>`);
  if (opts.hint) L.push(`<div class="hintl">${opts.hint}</div>`);
  return L.join('');
}
