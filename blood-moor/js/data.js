/* Game data: Sorceress skills, monsters, item bases, affixes, uniques, experience. Everything here is tunable. */
'use strict';

// D2-style damage brackets: +a per level for levels 2-8, +b for 9-16, +c from 17 on
function br(L, base, a, b, c) { return base + a * Math.min(Math.max(L - 1, 0), 7) + b * clamp(L - 8, 0, 8) + c * Math.max(L - 16, 0); }
const TIER_LVL = [1, 6, 12, 18, 24, 30];
const TREES = [
  { name: 'Fire Spells', el: 'fire' },
  { name: 'Cold Spells', el: 'cold' },
  { name: 'Lightning Spells', el: 'light' },
];

/* aim: 'unit' (needs a direction, prefers a target), 'ground' (lands at a point), 'self' (no target), 'passive' */
const SKILLS = {
  attack: { name: 'Attack', tree: -1, aim: 'unit', el: 'phys', mana: () => 0, desc: 'Strike with your weapon.' },

  firebolt: { name: 'Fire Bolt', tree: 0, row: 0, col: 1, req: [], el: 'fire', aim: 'unit', mana: () => 2.5,
    dmg: L => [br(L, 3, 1.5, 3, 5), br(L, 6, 2, 3.5, 6)], syn: [['fireball', .16], ['meteor', .16]],
    desc: 'Creates a magical flaming missile.' },
  warmth: { name: 'Warmth', tree: 0, row: 0, col: 2, req: [], el: 'fire', aim: 'passive', mana: () => 0,
    val: L => 30 + 12 * (L - 1), desc: 'Passive. Increases the rate at which you recover mana.' },
  inferno: { name: 'Inferno', tree: 0, row: 1, col: 0, req: ['firebolt'], el: 'fire', aim: 'unit', channel: true, mana: L => .9 + .12 * L,
    dmg: L => [br(L, 2, 1, 2, 3), br(L, 4, 1.5, 2.5, 4)], range: L => 3 + .35 * L, syn: [['warmth', .10]],
    desc: 'Hold to spray a jet of searing flame.' },
  blaze: { name: 'Blaze', tree: 0, row: 2, col: 0, req: ['inferno'], el: 'fire', aim: 'self', mana: () => 11,
    dmg: L => [br(L, 6, 3, 5, 7), br(L, 10, 3, 5, 7)], dur: L => 4.6 + L, syn: [['firewall', .04], ['warmth', .04]],
    desc: 'Leaves a trail of fire wherever you walk.' },
  fireball: { name: 'Fire Ball', tree: 0, row: 2, col: 1, req: ['firebolt'], el: 'fire', aim: 'unit', mana: L => 5 + .5 * L,
    dmg: L => [br(L, 6, 7, 9, 12), br(L, 14, 8, 10, 13)], syn: [['firebolt', .14], ['meteor', .14]],
    desc: 'An exploding ball of fire that damages everything near impact.' },
  firewall: { name: 'Fire Wall', tree: 0, row: 3, col: 0, req: ['blaze'], el: 'fire', aim: 'ground', mana: L => 22 + 2 * L,
    dmg: L => [br(L, 20, 8, 12, 16), br(L, 24, 8, 12, 16)], len: L => 4 + .7 * L, syn: [['warmth', .04], ['meteor', .04]],
    desc: 'A wall of flame that blocks and burns.' },
  meteor: { name: 'Meteor', tree: 0, row: 4, col: 1, req: ['fireball', 'firewall'], el: 'fire', aim: 'ground', mana: L => 17 + L, cd: .6,
    dmg: L => [br(L, 40, 12, 18, 24), br(L, 60, 14, 20, 26)], burn: L => 8 + 3 * L, syn: [['firebolt', .05], ['fireball', .05], ['firewall', .05]],
    desc: 'Calls down a meteor that crashes and leaves burning ground.' },
  firemastery: { name: 'Fire Mastery', tree: 0, row: 5, col: 2, req: [], el: 'fire', aim: 'passive', mana: () => 0,
    val: L => 25 + 8 * (L - 1), desc: 'Passive. Increases all fire damage.' },

  icebolt: { name: 'Ice Bolt', tree: 1, row: 0, col: 1, req: [], el: 'cold', aim: 'unit', mana: () => 3,
    dmg: L => [br(L, 3, 1, 2, 3), br(L, 5, 1.5, 2.5, 4)], chill: L => 3 + .4 * L, syn: [['iceblast', .15], ['glacialspike', .15], ['blizzard', .15], ['frozenorb', .15]],
    desc: 'A shard of ice that damages and slows.' },
  frozenarmor: { name: 'Frozen Armor', tree: 1, row: 0, col: 2, req: [], el: 'cold', aim: 'self', mana: () => 7,
    val: L => 45 + 5 * (L - 1), dur: L => 120 + 12 * L, freeze: L => 1.2 + .1 * L,
    desc: 'Raises defense. Freezes enemies that hit you in melee.' },
  frostnova: { name: 'Frost Nova', tree: 1, row: 1, col: 2, req: ['frozenarmor'], el: 'cold', aim: 'self', mana: L => 9 + L,
    dmg: L => [br(L, 2, 2, 3, 4), br(L, 4, 2, 3, 4)], chill: L => 8, syn: [['blizzard', .10]],
    desc: 'A ring of frost that damages and slows everything around you.' },
  iceblast: { name: 'Ice Blast', tree: 1, row: 1, col: 1, req: ['icebolt'], el: 'cold', aim: 'unit', mana: L => 6 + .5 * L,
    dmg: L => [br(L, 8, 6, 8, 11), br(L, 12, 6, 8, 11)], freeze: L => 2 + .2 * L, syn: [['icebolt', .08], ['glacialspike', .08]],
    desc: 'A bolt of ice that freezes its target solid.' },
  glacialspike: { name: 'Glacial Spike', tree: 1, row: 3, col: 1, req: ['iceblast'], el: 'cold', aim: 'unit', mana: L => 10 + .5 * L,
    dmg: L => [br(L, 16, 8, 10, 14), br(L, 24, 8, 10, 14)], freeze: L => 1.5 + .1 * L, syn: [['icebolt', .05], ['blizzard', .05]],
    desc: 'A spike of ice that explodes and freezes nearby enemies.' },
  blizzard: { name: 'Blizzard', tree: 1, row: 4, col: 1, req: ['glacialspike', 'frostnova'], el: 'cold', aim: 'ground', mana: L => 23 + L, cd: 1.8,
    dmg: L => [br(L, 16, 10, 12, 15), br(L, 24, 10, 12, 15)], syn: [['icebolt', .05], ['iceblast', .05], ['glacialspike', .05]],
    desc: 'Summons an ice storm that rains shards on an area.' },
  frozenorb: { name: 'Frozen Orb', tree: 1, row: 5, col: 1, req: ['blizzard'], el: 'cold', aim: 'unit', mana: L => 25 + L, cd: 1,
    dmg: L => [br(L, 16, 8, 10, 14), br(L, 24, 8, 10, 14)], syn: [['icebolt', .02]],
    desc: 'A pulsating orb that shreds an area with ice bolts.' },
  coldmastery: { name: 'Cold Mastery', tree: 1, row: 5, col: 2, req: [], el: 'cold', aim: 'passive', mana: () => 0,
    val: L => 20 + 5 * (L - 1), desc: 'Passive. Lowers the cold resistance of enemies.' },

  chargedbolt: { name: 'Charged Bolt', tree: 2, row: 0, col: 1, req: [], el: 'light', aim: 'unit', mana: L => 3 + .5 * L,
    dmg: L => [br(L, 1, .5, 1, 1.5), br(L, 8, 1, 2, 3)], n: L => 2 + L, syn: [['lightning', .06]],
    desc: 'Releases a spray of erratic bolts of lightning.' },
  staticfield: { name: 'Static Field', tree: 2, row: 1, col: 0, req: [], el: 'light', aim: 'self', mana: () => 9,
    rad: L => 3 + .6 * L, desc: 'Removes a quarter of the current life of every nearby enemy.' },
  nova: { name: 'Nova', tree: 2, row: 2, col: 0, req: ['staticfield'], el: 'light', aim: 'self', mana: L => 15 + L,
    dmg: L => [br(L, 1, 6, 8, 10), br(L, 20, 8, 10, 12)], desc: 'An expanding ring of lightning.' },
  lightning: { name: 'Lightning', tree: 2, row: 2, col: 1, req: ['chargedbolt'], el: 'light', aim: 'unit', mana: L => 8 + .5 * L,
    dmg: L => [br(L, 1, 8, 10, 13), br(L, 40, 10, 12, 15)], syn: [['chargedbolt', .08], ['nova', .08], ['chainlightning', .08]],
    desc: 'A bolt of lightning that pierces everything in its path.' },
  chainlightning: { name: 'Chain Lightning', tree: 2, row: 3, col: 1, req: ['lightning'], el: 'light', aim: 'unit', mana: L => 9 + .5 * L,
    dmg: L => [br(L, 1, 7, 9, 12), br(L, 40, 9, 11, 14)], n: L => 5 + Math.floor(L / 5), syn: [['chargedbolt', .04], ['lightning', .04], ['nova', .04]],
    desc: 'Lightning that leaps from enemy to enemy.' },
  teleport: { name: 'Teleport', tree: 2, row: 3, col: 2, req: [], el: 'light', aim: 'ground', mana: L => Math.max(4, 24 - L),
    desc: 'Instantly moves you to a nearby spot you can see.' },
  thunderstorm: { name: 'Thunder Storm', tree: 2, row: 4, col: 0, req: ['nova', 'chainlightning'], el: 'light', aim: 'self', mana: () => 19,
    dmg: L => [br(L, 1, 10, 12, 15), br(L, 100, 10, 12, 15)], dur: L => 32 + 8 * L,
    desc: 'A storm follows you, striking nearby enemies.' },
  energyshield: { name: 'Energy Shield', tree: 2, row: 4, col: 2, req: ['teleport', 'chainlightning'], el: 'light', aim: 'self', mana: () => 5,
    val: L => Math.min(95, 20 + 5 * L), dur: L => 144 + 48 * L, desc: 'Damage you take drains mana instead of life.' },
  lightmastery: { name: 'Lightning Mastery', tree: 2, row: 5, col: 1, req: [], el: 'light', aim: 'passive', mana: () => 0,
    val: L => 50 + 12 * (L - 1), desc: 'Passive. Increases all lightning damage.' },
};
for (const k in SKILLS) { SKILLS[k].id = k; if (SKILLS[k].tree >= 0) SKILLS[k].lvl = TIER_LVL[SKILLS[k].row]; }
const SKILL_LIST = Object.keys(SKILLS).filter(k => SKILLS[k].tree >= 0);

/* ---------- Experience ---------- */
const XP_TABLE = [0, 0, 500, 1500, 3750, 7875, 14175, 22680, 32886, 44396, 57715, 72144, 90180, 112725, 140906, 176132, 220165, 275207, 344008, 430010, 537513,
  671891, 839864, 1049830, 1312287, 1640359, 2050449, 2563061, 3203826, 3902260, 4663553, 5493363, 6397855, 7383752, 8458379, 9629723, 10906488, 12298162];
while (XP_TABLE.length <= 100) { const n = XP_TABLE.length; XP_TABLE.push(Math.round(XP_TABLE[n - 1] + (XP_TABLE[n - 1] - XP_TABLE[n - 2]) * 1.09)); }
const MAX_LVL = 99;

/* ---------- Monsters ---------- */
const MONSTERS = {
  zombie: { name: 'Zombie', hp: 18, dmg: [1, 4], speed: .95, r: .38, ar: 12, def: 4, xp: 12, atkCd: 1.7, range: .95, melee: true, res: {}, h: 50, color: '#6f7a5a' },
  quillrat: { name: 'Quill Rat', hp: 7, dmg: [1, 3], speed: 2.4, r: .3, ar: 10, def: 2, xp: 9, atkCd: 1.6, range: 5.5, keep: 3.5, proj: 'quill', res: {}, h: 26, color: '#6e5a44' },
  fallen: { name: 'Fallen', hp: 8, dmg: [1, 4], speed: 2.5, r: .3, ar: 14, def: 3, xp: 10, atkCd: 1.1, range: .8, melee: true, coward: true, res: {}, h: 32, color: '#a3402f' },
  shaman: { name: 'Fallen Shaman', hp: 9, dmg: [1, 5], speed: 2.1, r: .3, ar: 10, def: 2, xp: 18, atkCd: 2.6, range: 7, keep: 5, proj: 'sfire', res: { fire: 25 }, h: 34, color: '#b0563a', rez: true },
  brute: { name: 'Gargantuan Beast', hp: 34, dmg: [4, 9], speed: 1.6, r: .5, ar: 20, def: 8, xp: 26, atkCd: 1.8, range: 1.15, melee: true, res: { cold: 20 }, h: 62, color: '#8b8172' },
};
const UNIQUE_MODS = {
  strong: { name: 'Extra Strong', apply: m => { m.dmgMul *= 2; } },
  fast: { name: 'Extra Fast', apply: m => { m.speed *= 1.5; m.atkCd *= .7; } },
  fireench: { name: 'Fire Enchanted', apply: m => { m.addEl = 'fire'; m.res.fire = Math.max(m.res.fire || 0, 75); } },
  coldench: { name: 'Cold Enchanted', apply: m => { m.addEl = 'cold'; m.res.cold = Math.max(m.res.cold || 0, 75); } },
  lightench: { name: 'Lightning Enchanted', apply: m => { m.addEl = 'light'; m.res.light = Math.max(m.res.light || 0, 75); } },
  stoneskin: { name: 'Stone Skin', apply: m => { m.def *= 3; m.res.phys = 50; } },
  magicres: { name: 'Magic Resistant', apply: m => { for (const e of ['fire', 'cold', 'light']) m.res[e] = Math.max(m.res[e] || 0, 40); } },
};
const UNIQUE_NAMES = { a: ['Bone', 'Rot', 'Blood', 'Gloom', 'Pit', 'Ash', 'Fang', 'Grim', 'Snot', 'Death', 'Plague', 'Dire', 'Black', 'Foul', 'Rust'], b: ['gut', 'maw', 'skull', 'claw', 'rend', 'spine', 'eye', 'tooth', 'scalp', 'flesh', 'wing', 'heart'], c: ['the Hungry', 'the Wretched', 'the Mad', 'the Defiler', 'the Cold', 'the Unclean', 'the Tainted', 'the Gutter', 'the Hunter', 'the Feral'] };
const DIFFS = [
  { name: 'Normal', mlvl: 0, res: 0, xpMul: 1 },
  { name: 'Nightmare', mlvl: 20, res: -40, xpMul: 1.2 },
  { name: 'Hell', mlvl: 40, res: -100, xpMul: 1.4 },
];
function monHp(base, L) { const n = L - 1; return base * (1 + .28 * n + .012 * n * n); }
function monDmg(base, L) { const n = L - 1; return base * (1 + .2 * n + .006 * n * n); }
function monXp(base, L) { return base * Math.pow(L, 1.9); }

/* ---------- Items ---------- */
const SLOTS = ['head', 'amulet', 'body', 'rhand', 'lhand', 'gloves', 'belt', 'feet', 'ring1', 'ring2'];
const SLOT_NAME = { head: 'Helm', amulet: 'Amulet', body: 'Armor', rhand: 'Weapon', lhand: 'Shield', gloves: 'Gloves', belt: 'Belt', feet: 'Boots', ring1: 'Ring', ring2: 'Ring' };
/* kind decides slot and affix pool; icon decides the inventory picture */
const BASES = {
  shortstaff: { name: 'Short Staff', kind: 'staff', icon: 'staff', w: 1, h: 3, dmg: [1, 5], q: 1, two: true, cost: 60, tint: '#6b4a2c' },
  longstaff: { name: 'Long Staff', kind: 'staff', icon: 'staff', w: 1, h: 4, dmg: [2, 8], q: 8, two: true, str: 0, cost: 120, tint: '#5b3d24' },
  gnarledstaff: { name: 'Gnarled Staff', kind: 'staff', icon: 'gstaff', w: 1, h: 4, dmg: [4, 12], q: 12, two: true, cost: 220, tint: '#4c3a26' },
  battlestaff: { name: 'Battle Staff', kind: 'staff', icon: 'bstaff', w: 1, h: 4, dmg: [6, 13], q: 17, two: true, cost: 400, tint: '#3c3a36' },
  warstaff: { name: 'War Staff', kind: 'staff', icon: 'bstaff', w: 2, h: 4, dmg: [12, 28], q: 24, two: true, cost: 900, tint: '#2e2c2b' },
  wand: { name: 'Wand', kind: 'wand', icon: 'wand', w: 1, h: 2, dmg: [2, 4], q: 2, cost: 50, tint: '#7b5a39' },
  yewwand: { name: 'Yew Wand', kind: 'wand', icon: 'wand', w: 1, h: 2, dmg: [2, 8], q: 12, cost: 160, tint: '#6d4c2e' },
  bonewand: { name: 'Bone Wand', kind: 'wand', icon: 'bwand', w: 1, h: 2, dmg: [3, 7], q: 18, cost: 300, tint: '#d6ceb5' },
  grimwand: { name: 'Grim Wand', kind: 'wand', icon: 'bwand', w: 1, h: 2, dmg: [5, 11], q: 26, cost: 600, tint: '#b8ae93' },
  eagleorb: { name: 'Eagle Orb', kind: 'orb', icon: 'orb', w: 1, h: 2, dmg: [2, 5], q: 2, cost: 80, tint: '#4d7fa8' },
  sacredglobe: { name: 'Sacred Globe', kind: 'orb', icon: 'orb', w: 1, h: 2, dmg: [3, 8], q: 12, cost: 200, tint: '#8a5cb0' },
  smokedsphere: { name: 'Smoked Sphere', kind: 'orb', icon: 'orb', w: 1, h: 2, dmg: [4, 10], q: 20, cost: 420, tint: '#5c5f63' },
  claspedorb: { name: 'Clasped Orb', kind: 'orb', icon: 'orb', w: 1, h: 2, dmg: [5, 12], q: 28, cost: 800, tint: '#b04a3c' },
  shortsword: { name: 'Short Sword', kind: 'blade', icon: 'sword', w: 1, h: 3, dmg: [2, 7], q: 1, cost: 50, tint: '#9aa0a6' },
  scimitar: { name: 'Scimitar', kind: 'blade', icon: 'sword', w: 1, h: 3, dmg: [3, 8], q: 5, dex: 21, cost: 90, tint: '#a8acb0' },
  dagger: { name: 'Dagger', kind: 'blade', icon: 'dagger', w: 1, h: 2, dmg: [1, 4], q: 3, cost: 40, tint: '#a0a4a8' },
  club: { name: 'Club', kind: 'blunt', icon: 'club', w: 1, h: 3, dmg: [1, 6], q: 1, cost: 30, tint: '#6b4b2c' },
  handaxe: { name: 'Hand Axe', kind: 'blade', icon: 'axe', w: 1, h: 3, dmg: [3, 6], q: 3, cost: 60, tint: '#8f9398' },
  buckler: { name: 'Buckler', kind: 'shield', icon: 'buckler', w: 2, h: 2, def: [4, 6], q: 1, str: 12, cost: 50, tint: '#7d6a4a' },
  smallshield: { name: 'Small Shield', kind: 'shield', icon: 'shield', w: 2, h: 2, def: [8, 10], q: 5, str: 22, cost: 90, tint: '#6e5638' },
  largeshield: { name: 'Large Shield', kind: 'shield', icon: 'shield', w: 2, h: 3, def: [12, 14], q: 11, str: 34, cost: 180, tint: '#5b4a3a' },
  kiteshield: { name: 'Kite Shield', kind: 'shield', icon: 'kite', w: 2, h: 3, def: [16, 18], q: 15, str: 47, cost: 260, tint: '#7c8086' },
  towershield: { name: 'Tower Shield', kind: 'shield', icon: 'kite', w: 2, h: 3, def: [22, 25], q: 22, str: 75, cost: 420, tint: '#6b6f74' },
  cap: { name: 'Cap', kind: 'helm', icon: 'cap', w: 2, h: 2, def: [3, 5], q: 1, cost: 40, tint: '#6a5536' },
  skullcap: { name: 'Skull Cap', kind: 'helm', icon: 'skullcap', w: 2, h: 2, def: [8, 11], q: 5, str: 15, cost: 80, tint: '#8a8d90' },
  helm: { name: 'Helm', kind: 'helm', icon: 'helm', w: 2, h: 2, def: [15, 18], q: 11, str: 26, cost: 160, tint: '#7f8388' },
  fullhelm: { name: 'Full Helm', kind: 'helm', icon: 'fullhelm', w: 2, h: 2, def: [23, 26], q: 15, str: 41, cost: 260, tint: '#757a80' },
  mask: { name: 'Mask', kind: 'helm', icon: 'mask', w: 2, h: 2, def: [9, 27], q: 19, str: 23, cost: 300, tint: '#9c8c6a' },
  crown: { name: 'Crown', kind: 'helm', icon: 'crown', w: 2, h: 2, def: [25, 45], q: 29, str: 55, cost: 700, tint: '#c7a24a' },
  quilted: { name: 'Quilted Armor', kind: 'armor', icon: 'robe', w: 2, h: 3, def: [8, 11], q: 1, str: 12, cost: 60, tint: '#7b6a50' },
  leather: { name: 'Leather Armor', kind: 'armor', icon: 'armor', w: 2, h: 3, def: [14, 17], q: 3, str: 15, cost: 90, tint: '#6f4e2f' },
  hardleather: { name: 'Hard Leather Armor', kind: 'armor', icon: 'armor', w: 2, h: 3, def: [21, 24], q: 5, str: 20, cost: 130, tint: '#5e4127' },
  studded: { name: 'Studded Leather', kind: 'armor', icon: 'armor', w: 2, h: 3, def: [32, 35], q: 8, str: 27, cost: 200, tint: '#5a432d' },
  ringmail: { name: 'Ring Mail', kind: 'armor', icon: 'mail', w: 2, h: 3, def: [45, 48], q: 11, str: 36, cost: 300, tint: '#8a8e92' },
  scalemail: { name: 'Scale Mail', kind: 'armor', icon: 'mail', w: 2, h: 3, def: [57, 60], q: 13, str: 44, cost: 380, tint: '#7d8186' },
  chainmail: { name: 'Chain Mail', kind: 'armor', icon: 'mail', w: 2, h: 3, def: [72, 75], q: 15, str: 48, cost: 460, tint: '#8c9095' },
  breastplate: { name: 'Breast Plate', kind: 'armor', icon: 'plate', w: 2, h: 3, def: [65, 68], q: 18, str: 30, cost: 520, tint: '#9a9ea3' },
  platemail: { name: 'Plate Mail', kind: 'armor', icon: 'plate', w: 2, h: 3, def: [108, 116], q: 24, str: 65, cost: 800, tint: '#a3a7ab' },
  gothicplate: { name: 'Gothic Plate', kind: 'armor', icon: 'plate', w: 2, h: 3, def: [128, 135], q: 32, str: 70, cost: 1200, tint: '#8f9399' },
  lgloves: { name: 'Leather Gloves', kind: 'gloves', icon: 'gloves', w: 2, h: 2, def: [2, 3], q: 3, cost: 40, tint: '#6d4c30' },
  hgloves: { name: 'Heavy Gloves', kind: 'gloves', icon: 'gloves', w: 2, h: 2, def: [5, 6], q: 7, cost: 80, tint: '#5a3e27' },
  cgloves: { name: 'Chain Gloves', kind: 'gloves', icon: 'gaunt', w: 2, h: 2, def: [8, 9], q: 12, str: 25, cost: 140, tint: '#878b90' },
  lgaunt: { name: 'Light Gauntlets', kind: 'gloves', icon: 'gaunt', w: 2, h: 2, def: [9, 11], q: 20, str: 45, cost: 240, tint: '#9a9ea2' },
  gauntlets: { name: 'Gauntlets', kind: 'gloves', icon: 'gaunt', w: 2, h: 2, def: [12, 15], q: 27, str: 60, cost: 360, tint: '#a5a9ad' },
  boots: { name: 'Boots', kind: 'boots', icon: 'boots', w: 2, h: 2, def: [2, 3], q: 3, cost: 40, tint: '#6a4a2e' },
  hboots: { name: 'Heavy Boots', kind: 'boots', icon: 'boots', w: 2, h: 2, def: [5, 6], q: 7, str: 18, cost: 80, tint: '#573c25' },
  cboots: { name: 'Chain Boots', kind: 'boots', icon: 'greaves', w: 2, h: 2, def: [8, 9], q: 12, str: 30, cost: 140, tint: '#868a8f' },
  lpboots: { name: 'Light Plated Boots', kind: 'boots', icon: 'greaves', w: 2, h: 2, def: [9, 11], q: 20, str: 50, cost: 240, tint: '#999da1' },
  greaves: { name: 'Greaves', kind: 'boots', icon: 'greaves', w: 2, h: 2, def: [12, 15], q: 27, str: 70, cost: 360, tint: '#a2a6aa' },
  sash: { name: 'Sash', kind: 'belt', icon: 'belt', w: 2, h: 1, def: [2, 2], q: 3, rows: 2, cost: 40, tint: '#7b5b3a' },
  lightbelt: { name: 'Light Belt', kind: 'belt', icon: 'belt', w: 2, h: 1, def: [3, 3], q: 7, rows: 3, cost: 80, tint: '#6b4a2b' },
  belt: { name: 'Belt', kind: 'belt', icon: 'belt', w: 2, h: 1, def: [5, 5], q: 12, rows: 3, str: 25, cost: 140, tint: '#5a3d24' },
  heavybelt: { name: 'Heavy Belt', kind: 'belt', icon: 'pbelt', w: 2, h: 1, def: [6, 6], q: 20, rows: 4, str: 45, cost: 240, tint: '#4d3520' },
  platedbelt: { name: 'Plated Belt', kind: 'belt', icon: 'pbelt', w: 2, h: 1, def: [8, 11], q: 27, rows: 4, str: 60, cost: 360, tint: '#8a8e92' },
  ring: { name: 'Ring', kind: 'ring', icon: 'ring', w: 1, h: 1, q: 1, cost: 300, tint: '#c9a94c' },
  amulet: { name: 'Amulet', kind: 'amulet', icon: 'amulet', w: 1, h: 1, q: 1, cost: 400, tint: '#c9a94c' },
  hp1: { name: 'Minor Healing Potion', kind: 'potion', icon: 'pot', pot: 'hp', heal: 30, w: 1, h: 1, q: 1, cost: 25, tint: '#b8241c', sz: 0 },
  hp2: { name: 'Light Healing Potion', kind: 'potion', icon: 'pot', pot: 'hp', heal: 60, w: 1, h: 1, q: 4, cost: 50, tint: '#c4261d', sz: 1 },
  hp3: { name: 'Healing Potion', kind: 'potion', icon: 'pot', pot: 'hp', heal: 110, w: 1, h: 1, q: 11, cost: 110, tint: '#d22a20', sz: 2 },
  hp4: { name: 'Greater Healing Potion', kind: 'potion', icon: 'pot', pot: 'hp', heal: 190, w: 1, h: 1, q: 19, cost: 210, tint: '#e02e22', sz: 3 },
  hp5: { name: 'Super Healing Potion', kind: 'potion', icon: 'pot', pot: 'hp', heal: 340, w: 1, h: 1, q: 30, cost: 400, tint: '#ee3426', sz: 4 },
  mp1: { name: 'Minor Mana Potion', kind: 'potion', icon: 'pot', pot: 'mp', heal: 20, w: 1, h: 1, q: 1, cost: 25, tint: '#2440b8', sz: 0 },
  mp2: { name: 'Light Mana Potion', kind: 'potion', icon: 'pot', pot: 'mp', heal: 40, w: 1, h: 1, q: 4, cost: 50, tint: '#2747c4', sz: 1 },
  mp3: { name: 'Mana Potion', kind: 'potion', icon: 'pot', pot: 'mp', heal: 80, w: 1, h: 1, q: 11, cost: 110, tint: '#2b4ed2', sz: 2 },
  mp4: { name: 'Greater Mana Potion', kind: 'potion', icon: 'pot', pot: 'mp', heal: 150, w: 1, h: 1, q: 19, cost: 210, tint: '#3057e0', sz: 3 },
  mp5: { name: 'Super Mana Potion', kind: 'potion', icon: 'pot', pot: 'mp', heal: 250, w: 1, h: 1, q: 30, cost: 400, tint: '#3660ee', sz: 4 },
  rv1: { name: 'Rejuvenation Potion', kind: 'potion', icon: 'pot', pot: 'rv', heal: 35, w: 1, h: 1, q: 6, cost: 300, tint: '#8a2aa8', sz: 2 },
  rv2: { name: 'Full Rejuvenation Potion', kind: 'potion', icon: 'pot', pot: 'rv', heal: 100, w: 1, h: 1, q: 22, cost: 900, tint: '#a632c8', sz: 3 },
  tp: { name: 'Scroll of Town Portal', kind: 'scroll', icon: 'scroll', w: 1, h: 1, q: 1, cost: 100, tint: '#3d6ad8' },
  gold: { name: 'Gold', kind: 'gold', icon: 'gold', w: 1, h: 1, q: 1, cost: 0, tint: '#d6b143' },
};
for (const k in BASES) BASES[k].id = k;
const KIND_SLOT = { staff: 'rhand', wand: 'rhand', orb: 'rhand', blade: 'rhand', blunt: 'rhand', shield: 'lhand', helm: 'head', armor: 'body', gloves: 'gloves', boots: 'feet', belt: 'belt', ring: 'ring', amulet: 'amulet' };
const EQUIP_BASES = Object.keys(BASES).filter(k => KIND_SLOT[BASES[k].kind]);

/* Stat keys and how they read in a tooltip */
const STAT_TEXT = {
  edmg: v => `+${v}% Enhanced Damage`, edef: v => `+${v}% Enhanced Defense`, def: v => `+${v} Defense`,
  str: v => `+${v} to Strength`, dex: v => `+${v} to Dexterity`, vit: v => `+${v} to Vitality`, ene: v => `+${v} to Energy`,
  life: v => `+${v} to Life`, mana: v => `+${v} to Mana`,
  resF: v => `Fire Resist +${v}%`, resC: v => `Cold Resist +${v}%`, resL: v => `Lightning Resist +${v}%`, resAll: v => `All Resistances +${v}`,
  fcr: v => `+${v}% Faster Cast Rate`, fhr: v => `+${v}% Faster Hit Recovery`, frw: v => `+${v}% Faster Run/Walk`,
  skAll: v => `+${v} to Sorceress Skill Levels`, skFire: v => `+${v} to Fire Skills`, skCold: v => `+${v} to Cold Skills`, skLight: v => `+${v} to Lightning Skills`,
  mf: v => `${v}% Better Chance of Getting Magic Items`, gf: v => `${v}% Extra Gold from Monsters`,
  regen: v => `Regenerate Mana ${v}%`, light: v => `+${v} to Light Radius`, rep: v => `Replenish Life +${v}`,
  mak: v => `+${v} to Mana after each Kill`, dr: v => `Damage Reduced by ${v}`, mdmg: v => `+${v} to Maximum Damage`,
  pfire: v => `+${v}% to Fire Skill Damage`, pcold: v => `+${v}% to Cold Skill Damage`, plight: v => `+${v}% to Lightning Skill Damage`,
};
const STAT_ORDER = ['skAll', 'skFire', 'skCold', 'skLight', 'sk', 'fcr', 'pfire', 'pcold', 'plight', 'edmg', 'mdmg', 'edef', 'def', 'str', 'dex', 'vit', 'ene', 'life', 'mana', 'resAll', 'resF', 'resC', 'resL', 'fhr', 'frw', 'regen', 'rep', 'mak', 'dr', 'mf', 'gf', 'light'];

/* Affixes: [name, stat, min, max, item level, allowed kinds] */
const ARMORS = ['helm', 'armor', 'shield', 'gloves', 'boots', 'belt'];
const JEWEL = ['ring', 'amulet'];
const CASTER = ['staff', 'wand', 'orb'];
const MELEE = ['blade', 'blunt', 'staff'];
const ALL = [...ARMORS, ...JEWEL, ...CASTER, 'blade', 'blunt'];
const PREFIXES = [
  ['Sturdy', 'edef', 10, 20, 1, ARMORS], ['Strong', 'edef', 21, 30, 6, ARMORS], ['Glorious', 'edef', 31, 40, 14, ARMORS], ['Blessed', 'edef', 41, 55, 22, ARMORS],
  ['Jagged', 'edmg', 10, 20, 1, MELEE.concat(CASTER)], ['Deadly', 'edmg', 21, 30, 6, MELEE.concat(CASTER)], ['Vicious', 'edmg', 31, 40, 12, MELEE], ['Brutal', 'edmg', 41, 60, 20, MELEE],
  ['Crimson', 'resF', 5, 10, 1, ARMORS.concat(JEWEL)], ['Russet', 'resF', 11, 20, 8, ARMORS.concat(JEWEL)], ['Garnet', 'resF', 21, 30, 16, ARMORS.concat(JEWEL)],
  ['Azure', 'resC', 5, 10, 1, ARMORS.concat(JEWEL)], ['Lapis', 'resC', 11, 20, 8, ARMORS.concat(JEWEL)], ['Cobalt', 'resC', 21, 30, 16, ARMORS.concat(JEWEL)],
  ['Tangerine', 'resL', 5, 10, 1, ARMORS.concat(JEWEL)], ['Coral', 'resL', 11, 20, 8, ARMORS.concat(JEWEL)], ['Amber', 'resL', 21, 30, 16, ARMORS.concat(JEWEL)],
  ['Shimmering', 'resAll', 5, 10, 6, ['shield', 'amulet', 'ring', 'armor']], ['Rainbow', 'resAll', 11, 15, 15, ['shield', 'amulet', 'armor']], ['Prismatic', 'resAll', 16, 25, 26, ['shield', 'amulet']],
  ["Lizard's", 'mana', 1, 5, 1, ['helm', 'amulet', 'ring', 'staff', 'orb', 'wand', 'gloves']], ["Snake's", 'mana', 6, 10, 5, ['helm', 'amulet', 'ring', 'staff', 'orb', 'wand']],
  ["Serpent's", 'mana', 11, 20, 12, ['amulet', 'ring', 'staff', 'orb', 'helm']], ["Drake's", 'mana', 21, 30, 20, ['amulet', 'ring', 'orb']], ["Dragon's", 'mana', 31, 40, 28, ['amulet', 'orb']],
  ['Burning', 'skFire', 1, 1, 6, ['staff', 'orb', 'wand', 'amulet']], ['Blazing', 'skFire', 2, 2, 22, ['staff', 'orb', 'amulet']],
  ['Frosty', 'skCold', 1, 1, 6, ['staff', 'orb', 'wand', 'amulet']], ['Freezing', 'skCold', 2, 2, 22, ['staff', 'orb', 'amulet']],
  ['Charged', 'skLight', 1, 1, 6, ['staff', 'orb', 'wand', 'amulet']], ['Thundering', 'skLight', 2, 2, 22, ['staff', 'orb', 'amulet']],
  ["Magus'", 'skAll', 1, 1, 14, ['staff', 'orb', 'amulet', 'wand']], ["Archmage's", 'skAll', 2, 2, 28, ['orb', 'amulet', 'staff']],
  ['Bronze', 'def', 3, 8, 1, ['armor', 'shield', 'helm']], ['Iron', 'def', 9, 20, 9, ['armor', 'shield', 'helm']], ['Steel', 'def', 21, 40, 18, ['armor', 'shield']],
  ['Lucky', 'mf', 5, 15, 3, ['ring', 'amulet', 'boots', 'gloves', 'helm']], ['Fortuitous', 'mf', 16, 25, 14, ['ring', 'amulet', 'helm']],
  ['Pyromancer\'s', 'pfire', 5, 12, 10, ['orb', 'staff', 'amulet']], ['Cryomancer\'s', 'pcold', 5, 12, 10, ['orb', 'staff', 'amulet']], ['Stormcaller\'s', 'plight', 5, 12, 10, ['orb', 'staff', 'amulet']],
];
const SUFFIXES = [
  ['of the Jackal', 'life', 1, 5, 1, ALL], ['of the Fox', 'life', 6, 10, 4, ALL], ['of the Wolf', 'life', 11, 20, 10, ARMORS.concat(JEWEL)], ['of the Tiger', 'life', 21, 30, 18, ['armor', 'shield', 'belt', 'amulet']], ['of the Mammoth', 'life', 31, 40, 26, ['armor', 'shield', 'belt']],
  ['of Strength', 'str', 1, 2, 1, ALL], ['of Might', 'str', 3, 5, 5, ALL], ['of the Ox', 'str', 6, 9, 12, ALL], ['of the Giant', 'str', 10, 15, 20, ['ring', 'amulet', 'gloves', 'belt']],
  ['of Dexterity', 'dex', 1, 2, 1, ALL], ['of Skill', 'dex', 3, 5, 5, ALL], ['of Accuracy', 'dex', 6, 9, 12, ALL],
  ['of Vigor', 'vit', 1, 3, 2, ALL], ['of Life', 'vit', 4, 7, 8, ALL], ['of Vitality', 'vit', 8, 12, 16, ['ring', 'amulet', 'armor', 'belt']],
  ['of Energy', 'ene', 1, 3, 1, ALL], ['of the Mind', 'ene', 4, 7, 6, ALL], ['of Brilliance', 'ene', 8, 12, 14, ALL], ['of Sorcery', 'ene', 13, 20, 24, ['orb', 'staff', 'amulet', 'helm']],
  ['of the Apprentice', 'fcr', 10, 10, 3, ['ring', 'amulet', 'staff', 'orb', 'wand']], ['of the Magus', 'fcr', 20, 20, 18, ['amulet', 'staff', 'orb', 'wand']],
  ['of Balance', 'fhr', 10, 10, 5, ['armor', 'shield', 'belt', 'amulet', 'ring', 'helm']], ['of Stability', 'fhr', 17, 17, 16, ['armor', 'shield', 'belt', 'amulet']],
  ['of Pacing', 'frw', 10, 10, 2, ['boots']], ['of Haste', 'frw', 20, 20, 10, ['boots']], ['of Speed', 'frw', 30, 30, 20, ['boots']],
  ['of Focus', 'regen', 10, 20, 2, ['ring', 'amulet', 'staff', 'orb', 'wand', 'helm']], ['of Concentration', 'regen', 25, 40, 14, ['ring', 'amulet', 'orb', 'staff']],
  ['of Light', 'light', 1, 1, 1, ['helm', 'ring', 'amulet', 'armor']], ['of Radiance', 'light', 3, 3, 12, ['helm', 'ring', 'amulet']],
  ['of Regeneration', 'rep', 3, 5, 6, ['ring', 'amulet', 'armor', 'helm', 'shield']], ['of Revivification', 'rep', 6, 10, 18, ['ring', 'amulet', 'armor']],
  ['of the Wraith', 'mak', 1, 2, 3, ['ring', 'amulet', 'helm', 'gloves', 'staff', 'orb', 'wand']], ['of Absorption', 'mak', 3, 5, 14, ['ring', 'amulet', 'orb', 'staff']],
  ['of Warding', 'dr', 1, 3, 4, ['armor', 'shield', 'helm', 'belt']], ['of the Bulwark', 'dr', 4, 7, 18, ['armor', 'shield']],
  ['of Greed', 'gf', 20, 40, 1, ALL], ['of Fortune', 'mf', 10, 25, 6, ['ring', 'amulet', 'boots', 'gloves', 'helm']],
  ['of Maiming', 'mdmg', 1, 3, 1, MELEE], ['of Slaying', 'mdmg', 4, 8, 10, MELEE],
];
const RARE_A = ['Beast', 'Eagle', 'Raven', 'Viper', 'Ghoul', 'Bone', 'Blood', 'Doom', 'Grim', 'Rune', 'Storm', 'Wraith', 'Dread', 'Ghost', 'Shadow', 'Corpse', 'Death', 'Plague', 'Gale', 'Skull', 'Spirit', 'Soul', 'Pain', 'Hailstone', 'Havoc', 'Loath', 'Rift', 'Brimstone', 'Empyrean', 'Bramble', 'Cruel', 'Dusk', 'Gloom', 'Mind', 'Order', 'Stone', 'Vengeance', 'Wind', 'Golem', 'Armageddon'];
const RARE_B = {
  helm: ['Visage', 'Hood', 'Mask', 'Crest', 'Brow', 'Horn', 'Cowl', 'Circlet'], armor: ['Shell', 'Coat', 'Hide', 'Carapace', 'Pelt', 'Suit', 'Wrap', 'Jack'],
  shield: ['Ward', 'Guard', 'Wall', 'Mark', 'Aegis', 'Tower', 'Badge', 'Emblem'], gloves: ['Grip', 'Fist', 'Claw', 'Hand', 'Hold', 'Knuckle', 'Clutch'],
  boots: ['Stalker', 'Track', 'Spur', 'Blazer', 'Nails', 'Trample', 'Slippers'], belt: ['Cord', 'Lock', 'Wrap', 'Chain', 'Fringe', 'Buckle', 'Strap'],
  ring: ['Band', 'Coil', 'Loop', 'Eye', 'Spiral', 'Grasp', 'Turn', 'Knuckle'], amulet: ['Talisman', 'Collar', 'Heart', 'Noose', 'Beads', 'Gorget', 'Scarab', 'Necklace'],
  staff: ['Spire', 'Song', 'Branch', 'Call', 'Weaver', 'Pillar', 'Beam', 'Goad'], wand: ['Spike', 'Song', 'Branch', 'Call', 'Weaver', 'Needle', 'Quill'],
  orb: ['Eye', 'Heart', 'Star', 'Sphere', 'Ball', 'Song', 'Mind'], blade: ['Bite', 'Scratch', 'Gnash', 'Edge', 'Fang', 'Razor', 'Song'], blunt: ['Knell', 'Crack', 'Smasher', 'Bludgeon', 'Mallet'],
};
const UNIQUES = [
  { name: "Biggin's Bonnet", base: 'cap', lvl: 3, mods: { edef: 30, life: 15, mana: 15, def: 14 } },
  { name: 'Tarnhelm', base: 'skullcap', lvl: 15, mods: { skAll: 1, mf: 40, gf: 60, edef: 30 } },
  { name: 'Greyform', base: 'quilted', lvl: 7, mods: { def: 20, resF: 20, resC: 20, dex: 10, dr: 3 } },
  { name: "Blinkbat's Form", base: 'leather', lvl: 12, mods: { def: 25, frw: 10, fhr: 40, dr: 3 } },
  { name: 'Hotspur', base: 'boots', lvl: 5, mods: { edef: 50, resF: 45, life: 15 } },
  { name: 'The Hand of Broc', base: 'lgloves', lvl: 5, mods: { edef: 20, mana: 20, resC: 10, def: 10 } },
  { name: 'Lenymo', base: 'sash', lvl: 7, mods: { mana: 15, resAll: 5, regen: 30, light: 1 } },
  { name: 'Nagelring', base: 'ring', lvl: 7, mods: { mf: 30, dr: 3, rep: 3 } },
  { name: 'Manald Heal', base: 'ring', lvl: 15, mods: { regen: 20, rep: 8, life: 20, mak: 3 } },
  { name: 'Nokozan Relic', base: 'amulet', lvl: 10, mods: { resF: 50, fhr: 20, light: 3, life: 10 } },
  { name: 'The Eye of Etlich', base: 'amulet', lvl: 15, mods: { skAll: 1, resC: 20, light: 3, life: 25 } },
  { name: 'Pelta Lunata', base: 'buckler', lvl: 2, mods: { edef: 40, str: 2, vit: 10, ene: 10 } },
  { name: 'Torch of Iro', base: 'wand', lvl: 5, mods: { skAll: 1, regen: 10, rep: 5, light: 3, mana: 10 } },
  { name: 'Bane Ash', base: 'shortstaff', lvl: 5, mods: { skFire: 1, sk: { firebolt: 3, warmth: 2 }, fcr: 20, resF: 50 } },
  { name: 'Serpent Lord', base: 'longstaff', lvl: 9, mods: { skCold: 1, sk: { icebolt: 2 }, mana: 30, regen: 20, fcr: 10 } },
  { name: "Gull's Rattle", base: 'eagleorb', lvl: 6, mods: { skLight: 1, sk: { chargedbolt: 3, staticfield: 2 }, fcr: 10, ene: 10 } },
  { name: 'Spire of Lazarus', base: 'gnarledstaff', lvl: 18, mods: { skAll: 2, sk: { chainlightning: 3, lightning: 2 }, resL: 75, ene: 15, regen: 43, dr: 7 } },
  { name: 'Frostwind Orb', base: 'sacredglobe', lvl: 20, mods: { skCold: 2, sk: { frozenorb: 2, blizzard: 2 }, fcr: 20, pcold: 15, mana: 30 } },
  { name: 'Heart of Embers', base: 'smokedsphere', lvl: 24, mods: { skFire: 2, sk: { meteor: 2, fireball: 3 }, fcr: 20, pfire: 20, life: 25 } },
  { name: "Arachnid's Grasp", base: 'heavybelt', lvl: 24, mods: { skAll: 1, fcr: 10, edef: 100, rep: 5, life: 20 } },
  { name: 'Silkweave', base: 'cboots', lvl: 20, mods: { frw: 30, mak: 5, mana: 30, edef: 120 } },
  { name: 'Magefist', base: 'lgaunt', lvl: 23, mods: { skFire: 1, fcr: 20, regen: 25, edef: 30, def: 10 } },
  { name: "Harlequin Crest", base: 'mask', lvl: 26, mods: { skAll: 2, life: 40, mana: 40, mf: 50, dr: 10, str: 2, vit: 2 } },
  { name: "Skin of the Vipermagi", base: 'scalemail', lvl: 25, mods: { skAll: 1, fcr: 30, resAll: 30, edef: 100 } },
];

/* Town vendors */
const NPCS = {
  akara: { name: 'Akara', title: 'High Priestess', heals: true, shop: ['hp1', 'hp2', 'mp1', 'mp2', 'hp3', 'mp3', 'tp'], gear: ['staff', 'wand', 'orb'], color: '#6d3f8f' },
  charsi: { name: 'Charsi', title: 'Blacksmith', shop: [], gear: ['blade', 'blunt', 'shield', 'helm', 'armor', 'gloves', 'boots', 'belt'], color: '#7a3a24' },
  kashya: { name: 'Kashya', title: 'Captain of the Rogues', talk: true, color: '#4f2a2a' },
};
