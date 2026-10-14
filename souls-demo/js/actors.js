/* Player, stats, equipment, items, projectiles and combat resolution. Numbers follow Dark Souls 1 (see RESEARCH.md). */
'use strict';
/* ---------------- stat curves ---------------- */
const VIT_HP = [[1, 400], [8, 530], [9, 552], [10, 572], [11, 594], [12, 616], [13, 638], [14, 658], [15, 682], [20, 792], [25, 938], [30, 1100], [40, 1325], [50, 1500], [99, 1900]];
const END_ST = [[1, 81], [8, 88], [9, 90], [10, 91], [11, 93], [12, 95], [13, 97], [14, 98], [15, 100], [20, 110], [25, 121], [30, 133], [35, 146], [40, 160], [99, 160]];
function curve(t, x) { for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const [a, va] = t[i - 1], [b, vb] = t[i]; return Math.round(va + (vb - va) * (x - a) / (b - a)); } return t[t.length - 1][1]; }
function levelCost(L) { L += 1; return Math.round(L <= 12 ? .0068 * L ** 3 - .06 * L ** 2 + 17.1 * L + 639 : .02 * L ** 3 + 3.06 * L ** 2 + 105.6 * L - 895); }
const STATS = ['vit', 'att', 'end', 'str', 'dex', 'res', 'int', 'fth'];
const STAT_NAMES = { vit: 'Vitality', att: 'Attunement', end: 'Endurance', str: 'Strength', dex: 'Dexterity', res: 'Resistance', int: 'Intelligence', fth: 'Faith' };

/* ---------------- equipment ---------------- */
const WEAPONS = {
  longsword: { name: 'Longsword', type: 'straight', model: 'longsword', phys: 80, sc: ['C', 'C'], req: [10, 10], w: 3, crit: 100 },
  broadsword: { name: 'Broadsword', type: 'straight', model: 'broadsword', phys: 82, sc: ['C', 'C'], req: [10, 10], w: 3, crit: 100 },
  shortsword: { name: 'Shortsword', type: 'straight', model: 'shortsword', phys: 78, sc: ['C', 'C'], req: [8, 10], w: 2, crit: 100 },
  scimitar: { name: 'Scimitar', type: 'curved', model: 'scimitar', phys: 80, sc: ['E', 'B'], req: [7, 13], w: 1.5, crit: 100 },
  dagger: { name: 'Dagger', type: 'dagger', model: 'dagger', phys: 56, sc: ['E', 'B'], req: [5, 8], w: .5, crit: 130 },
  banditKnife: { name: "Bandit's Knife", type: 'dagger', model: 'dagger', phys: 56, sc: ['E', 'B'], req: [6, 12], w: 1, crit: 150 },
  battleAxe: { name: 'Battle Axe', type: 'axe', model: 'battleaxe', phys: 95, sc: ['C', 'D'], req: [12, 8], w: 4, crit: 100 },
  handAxe: { name: 'Hand Axe', type: 'axe', model: 'handaxe', phys: 80, sc: ['C', 'D'], req: [8, 8], w: 1, crit: 100 },
  mace: { name: 'Mace', type: 'hammer', model: 'club', phys: 91, sc: ['B', '-'], req: [12, 0], w: 4, crit: 100 },
  club: { name: 'Club', type: 'hammer', model: 'club', phys: 87, sc: ['A', '-'], req: [10, 0], w: 3, crit: 100 },
  spear: { name: 'Spear', type: 'spear', model: 'spear', phys: 80, sc: ['D', 'C'], req: [11, 10], w: 3.5, crit: 100 },
  rapier: { name: 'Rapier', type: 'thrust', model: 'rapier', phys: 73, sc: ['E', 'A'], req: [7, 12], w: 1.5, crit: 130 },
  halberd: { name: 'Halberd', type: 'halberd', model: 'halberd', phys: 138, sc: ['C', 'E'], req: [16, 12], w: 6, crit: 100 },
  tailAxe: { name: 'Gargoyle Tail Axe', type: 'axe', model: 'axe', phys: 93, sc: ['D', 'D'], req: [14, 14], w: 5, crit: 100 },
};
const SHIELDS = {
  heater: { name: 'Heater Shield', model: 'heater', block: 100, stab: 55, w: 2, parry: .2 },
  towerKite: { name: 'Tower Kite Shield', model: 'tower', block: 100, stab: 58, w: 3, parry: .2 },
  leather: { name: 'Leather Shield', model: 'round', block: 85, stab: 45, w: 1, parry: .2 },
  target: { name: 'Target Shield', model: 'small', block: 78, stab: 45, w: 2, parry: .27 },
  spider: { name: 'Spider Shield', model: 'round', block: 100, stab: 56, w: 3, parry: .2 },
  largeLeather: { name: 'Large Leather Shield', model: 'round', block: 91, stab: 52, w: 1.5, parry: .2 },
  smallLeather: { name: 'Small Leather Shield', model: 'small', block: 80, stab: 40, w: .5, parry: .2 },
  crackedRound: { name: 'Cracked Round Shield', model: 'round', block: 65, stab: 30, w: 1, parry: .2 },
  eastWest: { name: 'East-West Shield', model: 'round', block: 88, stab: 44, w: 1, parry: .2 },
  plank: { name: 'Plank Shield', model: 'tower', block: 75, stab: 45, w: 1.5, parry: .2 },
  buckler: { name: 'Buckler', model: 'small', block: 76, stab: 40, w: 1.5, parry: .27 },
  balder: { name: 'Balder Shield', model: 'heater', block: 100, stab: 63, w: 4, parry: .2 },
};
const SPELLS = {
  soulArrow: { name: 'Soul Arrow', uses: 30, kind: 'sorcery', stat: 'int', base: 110 },
  fireball: { name: 'Fireball', uses: 8, kind: 'pyromancy', stat: null, base: 150 },
  heal: { name: 'Heal', uses: 5, kind: 'miracle', stat: 'fth', base: 300 },
};
/* motion sets per weapon type (seconds). w/s are wind-up and strike poses. */
const MOVES = {
  straight: { l: [{ w: 'l1w', s: 'l1s', wind: .28, act: .14, rec: .42, mv: 1, range: 2.3, arc: 1.1, lunge: 1.2 }, { w: 'l2w', s: 'l2s', wind: .24, act: .14, rec: .44, mv: 1, range: 2.3, arc: 1.1, lunge: 1.2 }], h: { w: 'tw', s: 'ts', wind: .5, act: .18, rec: .52, mv: 1.45, range: 2.7, arc: .4, lunge: 2.2 }, st: [20, 30], pd: [20, 24] },
  curved: { l: [{ w: 'l1w', s: 'l1s', wind: .2, act: .12, rec: .32, mv: .9, range: 2.1, arc: 1.2, lunge: .9 }, { w: 'l2w', s: 'l2s', wind: .18, act: .12, rec: .34, mv: .9, range: 2.1, arc: 1.2, lunge: .9 }], h: { w: 'l1w', s: 'l2s', wind: .4, act: .3, rec: .45, mv: 1.35, range: 2.2, arc: 1.6, lunge: 1.2 }, st: [17, 26], pd: [20, 10] },
  dagger: { l: [{ w: 'l1w', s: 'l1s', wind: .16, act: .1, rec: .28, mv: .9, range: 1.7, arc: 1.0, lunge: .8 }, { w: 'l2w', s: 'l2s', wind: .15, act: .1, rec: .3, mv: .9, range: 1.7, arc: 1.0, lunge: .8 }], h: { w: 'tw', s: 'ts', wind: .32, act: .14, rec: .36, mv: 1.2, range: 1.9, arc: .4, lunge: 1.4 }, st: [12, 18], pd: [5, 6] },
  axe: { l: [{ w: 'hw', s: 'hs', wind: .38, act: .16, rec: .5, mv: 1.05, range: 2.2, arc: .7, lunge: 1 }, { w: 'l1w', s: 'l1s', wind: .32, act: .16, rec: .5, mv: 1.05, range: 2.2, arc: 1.1, lunge: 1 }], h: { w: 'hw', s: 'hs', wind: .62, act: .18, rec: .6, mv: 1.5, range: 2.3, arc: .6, lunge: 1.5 }, st: [24, 36], pd: [35, 42] },
  hammer: { l: [{ w: 'l1w', s: 'l1s', wind: .36, act: .16, rec: .5, mv: 1.05, range: 2.2, arc: 1.1, lunge: 1 }, { w: 'l2w', s: 'l2s', wind: .34, act: .16, rec: .5, mv: 1.05, range: 2.2, arc: 1.1, lunge: 1 }], h: { w: 'hw', s: 'hs', wind: .66, act: .18, rec: .62, mv: 1.55, range: 2.3, arc: .6, lunge: 1.5 }, st: [26, 38], pd: [35, 42] },
  spear: { l: [{ w: 'tw', s: 'ts', wind: .26, act: .14, rec: .38, mv: 1, range: 2.9, arc: .35, lunge: 1.2 }], h: { w: 'hw', s: 'hs', wind: .55, act: .16, rec: .55, mv: 1.4, range: 3.0, arc: .4, lunge: 1.4 }, st: [18, 28], pd: [20, 24], guardPoke: true },
  thrust: { l: [{ w: 'tw', s: 'ts', wind: .22, act: .12, rec: .32, mv: .95, range: 2.6, arc: .35, lunge: 1.1 }], h: { w: 'tw', s: 'ts', wind: .45, act: .16, rec: .45, mv: 1.35, range: 2.8, arc: .35, lunge: 2.2 }, st: [16, 24], pd: [10, 12] },
  halberd: { l: [{ w: 'l1w', s: 'l1s', wind: .4, act: .2, rec: .55, mv: 1.05, range: 3.3, arc: 1.4, lunge: 1 }, { w: 'l2w', s: 'l2s', wind: .38, act: .2, rec: .55, mv: 1.05, range: 3.3, arc: 1.4, lunge: 1 }], h: { w: 'tw', s: 'ts', wind: .55, act: .2, rec: .6, mv: 1.4, range: 3.4, arc: .4, lunge: 1.8 }, st: [28, 40], pd: [40, 48] },
};
const RUN_ATK = { w: 'tw', s: 'ts', wind: .16, act: .18, rec: .5, mv: 1.1, range: 2.5, arc: .6, lunge: 3.2 };
const KICK = { w: 'kick', s: 'kick', wind: .2, act: .14, rec: .38, mv: 0, range: 1.7, arc: .7, lunge: .6, kick: true };
const PLUNGE_MV = 4;
const SCOEF = { S: 1.0, A: .85, B: .65, C: .45, D: .3, E: .15, '-': 0 };
const statF = s => s <= 10 ? s / 10 * .25 : s <= 40 ? .25 + (s - 10) / 30 * .75 : 1 + (s - 40) / 59 * .2;

/* the ten starting classes (stats, gear and look) */
const CLASSES = {
  warrior: { name: 'Warrior', sl: 4, st: [11, 8, 12, 13, 13, 11, 9, 9], wpn: 'longsword', sh: 'heater', armor: { w: 12, abs: .2, poise: 14 }, look: { head: 'knight', chest: [TX.leather, 0x8a6a4a], arms: [TX.chain, 0x9a9a9a], legs: [TX.leather, 0x6a4a30], helm: [TX.plate, 0xb0aaa0] }, blurb: 'Strong and nimble. Longsword and Heater Shield.' },
  knight: { name: 'Knight', sl: 5, st: [14, 10, 10, 11, 11, 10, 9, 11], wpn: 'broadsword', sh: 'towerKite', armor: { w: 19, abs: .3, poise: 30 }, look: { head: 'knight', chest: [TX.plate, 0xbcbab6], arms: [TX.chain, 0xa4a4a8], legs: [TX.plate, 0xa8a6a4], helm: [TX.plate, 0xc0beba], tabard: 0x2a4a7a }, blurb: 'High HP and heavy armor. Broadsword and Tower Kite Shield.' },
  wanderer: { name: 'Wanderer', sl: 3, st: [10, 11, 10, 10, 14, 12, 11, 8], wpn: 'scimitar', sh: 'leather', armor: { w: 8, abs: .16, poise: 5 }, look: { head: 'hood', chest: [TX.cloth, 0x8a7a5a], arms: [TX.cloth, 0x7a6a4a], legs: [TX.leather, 0x5a4a30], helm: [TX.cloth, 0x6a5a3a] }, blurb: 'Quick blade. Scimitar and Leather Shield.' },
  thief: { name: 'Thief', sl: 5, st: [9, 11, 9, 9, 15, 10, 12, 11], wpn: 'banditKnife', sh: 'target', armor: { w: 6, abs: .13, poise: 2 }, look: { head: 'hood', chest: [TX.leather, 0x2a2a2a], arms: [TX.leather, 0x3a3a3a], legs: [TX.leather, 0x2a2a2a], helm: [TX.cloth, 0x2a2420] }, blurb: 'Critical hits. Knife, Target Shield for parries.' },
  bandit: { name: 'Bandit', sl: 4, st: [12, 8, 14, 14, 9, 11, 8, 10], wpn: 'battleAxe', sh: 'spider', armor: { w: 12, abs: .2, poise: 14 }, look: { head: 'hood', chest: [TX.leather, 0x5a3a24], arms: [TX.skin, 0x8a6a50], legs: [TX.leather, 0x4a2a1a], helm: [TX.leather, 0x3a2418] }, blurb: 'Strength and stamina. Battle Axe and Spider Shield.' },
  hunter: { name: 'Hunter', sl: 4, st: [11, 9, 11, 12, 14, 11, 9, 9], wpn: 'shortsword', sh: 'largeLeather', armor: { w: 8, abs: .16, poise: 6 }, look: { head: 'npc', chest: [TX.leather, 0x6a5030], arms: [TX.leather, 0x5a4028], legs: [TX.leather, 0x4a3020] }, blurb: 'Balanced. Shortsword and Large Leather Shield.' },
  sorcerer: { name: 'Sorcerer', sl: 3, st: [8, 15, 8, 9, 11, 8, 15, 8], wpn: 'dagger', sh: 'smallLeather', spell: 'soulArrow', armor: { w: 5, abs: .12, poise: 0 }, look: { head: 'hood', chest: [TX.cloth, 0x3a4a6a], arms: [TX.cloth, 0x2a3a5a], legs: [TX.cloth, 0x2a2a3a], helm: [TX.cloth, 0x3a4a6a], robe: 0x3a4a6a }, blurb: 'Casts Soul Arrow. Dagger, catalyst, light shield.' },
  pyromancer: { name: 'Pyromancer', sl: 1, st: [10, 12, 11, 12, 9, 12, 10, 8], wpn: 'handAxe', sh: 'crackedRound', spell: 'fireball', armor: { w: 7, abs: .14, poise: 4 }, look: { head: 'hood', chest: [TX.tatter, 0x6a5040], arms: [TX.skin, 0x8a6a50], legs: [TX.cloth, 0x4a3a2a], helm: [TX.tatter, 0x5a4030] }, blurb: 'Throws Fireballs. Hand Axe and Pyromancy Flame.' },
  cleric: { name: 'Cleric', sl: 2, st: [11, 11, 9, 12, 8, 11, 8, 14], wpn: 'mace', sh: 'eastWest', spell: 'heal', armor: { w: 9, abs: .17, poise: 8 }, look: { head: 'npc', chest: [TX.cloth, 0xc8c0a8], arms: [TX.cloth, 0xb8b098], legs: [TX.cloth, 0xa8a088], robe: 0xc8c0a8 }, blurb: 'Miracle of Heal. Mace and East-West Shield.' },
  deprived: { name: 'Deprived', sl: 6, st: [11, 11, 11, 11, 11, 11, 11, 11], wpn: 'club', sh: 'plank', armor: { w: 0, abs: .04, poise: 0 }, look: { head: 'hollow', chest: [TX.skin, 0x8a7a66], arms: [TX.skin, 0x8a7a66], legs: [TX.skin, 0x8a7a66], loin: true }, blurb: 'Nothing but a club and a plank. For the brave.' },
};

/* ---------------- items ---------------- */
const ITEMS = {
  estus: { name: 'Estus Flask', icon: 'flask', use: 'estus', desc: 'Restores 300 HP. Refilled at bonfires.' },
  firebomb: { name: 'Firebomb', icon: 'bomb', use: 'throw', proj: 'firebomb', desc: 'Throw to deal 180 fire damage in a small blast.' },
  blackFirebomb: { name: 'Black Firebomb', icon: 'bomb', use: 'throw', proj: 'blackFirebomb', desc: 'A stronger firebomb. 300 fire damage.' },
  throwingKnife: { name: 'Throwing Knife', icon: 'knife', use: 'throw', proj: 'knife', desc: 'Throw for 100 physical damage.' },
  soul: { name: 'Soul of a Lost Undead', icon: 'soul', use: 'souls', souls: 200, desc: 'Use to gain 200 souls.' },
  largeSoul: { name: 'Large Soul of a Lost Undead', icon: 'soul', use: 'souls', souls: 400, desc: 'Use to gain 400 souls.' },
  humanity: { name: 'Humanity', icon: 'humanity', use: 'humanity', desc: 'Restores HP fully and adds 1 humanity.' },
  greenBlossom: { name: 'Green Blossom', icon: 'herb', use: 'blossom', desc: 'Stamina recovers 40 per second faster for 60 seconds.' },
  goldPineResin: { name: 'Gold Pine Resin', icon: 'resin', use: 'resin', desc: 'Coats your weapon in lightning for 60 seconds.' },
  homewardBone: { name: 'Homeward Bone', icon: 'bone', use: 'bone', desc: 'Return to the last bonfire you rested at.' },
  titaniteShard: { name: 'Titanite Shard', icon: 'shard', key: true, desc: 'Andre can reinforce a weapon with it.' },
  residenceKey: { name: 'Residence Key', icon: 'key', key: true, desc: 'Opens a locked residence in the Undead Burg.' },
  basementKey: { name: 'Basement Key', icon: 'key', key: true, desc: 'Opens a door at the start of the drake bridge.' },
  blueTearstone: { name: 'Blue Tearstone Ring', icon: 'ring', ring: true, desc: 'Raises defense greatly while HP is low.' },
  halberd: { name: 'Halberd', icon: 'weapon', weapon: 'halberd', desc: 'A long pole weapon. Needs 16 Strength.' },
  tailAxe: { name: 'Gargoyle Tail Axe', icon: 'weapon', weapon: 'tailAxe', desc: 'Cut from a gargoyle. An axe of stone.' },
  spear: { name: 'Spear', icon: 'weapon', weapon: 'spear', desc: 'Thrusts over a raised shield.' },
  shortsword: { name: 'Shortsword', icon: 'weapon', weapon: 'shortsword', desc: 'A light straight sword.' },
  scimitar: { name: 'Scimitar', icon: 'weapon', weapon: 'scimitar', desc: 'Quick curved slashes.' },
  dagger: { name: 'Dagger', icon: 'weapon', weapon: 'dagger', desc: 'Huge critical hits.' },
  handAxe: { name: 'Hand Axe', icon: 'weapon', weapon: 'handAxe', desc: 'A light axe.' },
  rapier: { name: 'Rapier', icon: 'weapon', weapon: 'rapier', desc: 'Fast thrusts. High critical damage.' },
  heaterShield: { name: 'Heater Shield', icon: 'shield', shield: 'heater', desc: 'Blocks 100% physical damage.' },
  buckler: { name: 'Buckler', icon: 'shield', shield: 'buckler', desc: 'A small shield with a wide parry window.' },
  balderShield: { name: 'Balder Shield', icon: 'shield', shield: 'balder', desc: 'Sturdy knight\'s shield. Stability 63.' },
};
const SHOP = [['firebomb', 50], ['throwingKnife', 10], ['residenceKey', 1000], ['homewardBone', 500], ['greenBlossom', 300], ['dagger', 300], ['shortsword', 600], ['scimitar', 600], ['rapier', 600], ['handAxe', 450], ['spear', 600], ['heaterShield', 1000], ['buckler', 800]];

/* ---------------- game state ---------------- */
const G = { running: false, paused: false, menu: null, time: 0, playTime: 0, deaths: 0, inputMode: 'kb', inter: null, hitstop: 0, shake: 0, ended: false, touchUI: false,
  sens: store.get('sens', 1), invY: store.get('invY', false), stain: null, lastBonfire: null, bossFight: null, taurusDead: false, gargoylesDead: false, bellRung: false, liftUnlocked: false, flybyDone: false, drakeLanded: false };
const P = { pos: new V3(), yaw: Math.PI, r: .4, h: 1.75, vy: 0, onGround: true, fallTop: 0, state: 'free', st: 0, atk: null, combo: 0,
  hp: 572, hpTrail: 572, trailT: 0, stam: 91, stamDelay: 0, poiseCur: 0, poiseT: 0,
  stats: {}, cls: null, sl: 1, souls: 0, soulsShown: 0, humanity: 0, human: false,
  estus: 5, estusMax: 5, spellUses: 0, wpn: null, wpnUp: 0, sh: null, armor: null, twoHand: false, ring: null,
  inv: {}, belt: [], beltI: 0, weapons: [], shields: [],
  kb: new V3(), lock: null, buffer: null, bufT: 0, dead: false, iframe: false, blocking: false, sprinting: false, sprintGrace: 0,
  walkPh: 0, pose: mkPose(), tgt: mkPose(), rollDir: [0, 1], hurtDur: .45, used: false, model: null, isBoss: false, lastSafe: new V3(), safeT: 0,
  buffT: 0, resinT: 0, blossomT: 0, parryT: 0, critTarget: null, ladder: null, plunging: false, air: null };
const hpMax = () => curve(VIT_HP, P.stats.vit);
const stMax = () => curve(END_ST, P.stats.end);
const loadMax = () => 40 + P.stats.end;
const load = () => (WEAPONS[P.wpn]?.w || 0) + (P.twoHand ? 0 : (SHIELDS[P.sh]?.w || 0)) + (P.armor?.w || 0);
const loadPct = () => load() / loadMax();
const rollType = () => { const p = loadPct(); return p <= .25 ? 'fast' : p <= .5 ? 'mid' : p <= 1 ? 'fat' : 'none'; };
const ROLLS = { fast: { dur: .72, ifr: [.04, .41], dist: 3.8, unstable: [.47, .62] }, mid: { dur: 1.05, ifr: [.05, .42], dist: 3.0, unstable: [.55, .95] }, fat: { dur: 1.55, ifr: [.07, .43], dist: 1.9, unstable: [.6, 1.45] } };
function AR(wid = P.wpn) {
  const w = WEAPONS[wid]; if (!w) return 30;
  const str = P.stats.str * (P.twoHand ? 1.5 : 1), dex = P.stats.dex;
  const base = w.phys * (1 + P.wpnUp * .1);
  let ar = base + base * (SCOEF[w.sc[0]] * statF(str) + SCOEF[w.sc[1]] * statF(dex));
  if (str < w.req[0] || dex < w.req[1]) ar *= .5;
  return Math.round(ar);
}
function playerLevel() { return P.cls.sl + STATS.reduce((a, k, i) => a + P.stats[k] - P.cls.st[i], 0); }
function moves() { return MOVES[WEAPONS[P.wpn].type]; }

/* ---------------- inventory ---------------- */
function hasItem(id) { return (P.inv[id] || 0) > 0; }
function giveItem(id, qty = 1, show = false) {
  const it = ITEMS[id];
  if (it.weapon) { if (!P.weapons.includes(it.weapon)) P.weapons.push(it.weapon); }
  else if (it.shield) { if (!P.shields.includes(it.shield)) P.shields.push(it.shield); }
  else P.inv[id] = (P.inv[id] || 0) + qty;
  if (it.ring && !P.ring) P.ring = id;
  if (!it.key && !it.weapon && !it.shield && !it.ring && it.use && !P.belt.includes(id) && P.belt.length < 5) P.belt.push(id);
  sfx('item'); if (show) itemPopup(id, qty);
}
function takeItem(id, qty = 1) { P.inv[id] = Math.max(0, (P.inv[id] || 0) - qty); }
function beltCount(id) { return id === 'estus' ? P.estus : (P.inv[id] || 0); }

/* ---------------- player setup ---------------- */
function rebuildPlayerModel() {
  if (P.model) scene.remove(P.model.root);
  const c = P.cls, L = c.look, W = WEAPONS[P.wpn], S = SHIELDS[P.sh];
  const mk = a => a ? mat(a[0], a[1]) : null;
  const chest = mk(L.chest), arms = mk(L.arms), legs = mk(L.legs), helm = mk(L.helm || L.chest);
  const m = { pelvis: legs, legs, shins: legs, feet: mat(TX.leather, 0x3a2a1c), chest, arms, fore: arms, hands: mat(TX.leather, 0x4a3424), helm, face: mat(TX.face, 0xb09478), chain: arms,
    pauldron: helm, dark: mat(TX.white, 0x080604), skirt: L.loin ? mat(TX.tatter, 0x5a4a38, { side: DS }) : mat(TX.chain, 0x8e8e94, { side: DS }), grip: mat(TX.wood, 0x4a3020), guard: mat(TX.plate, 0xa89060), blade: mat(TX.plate, 0xdcdce0),
    shield: S.model === 'heater' || S.model === 'tower' ? mat(TX.crest, 0xd0ccc4) : mat(TX.plank, 0xb09070) };
  P.model = rig({ s: 1, head: L.head, m, skirtH: L.robe ? 0 : .3, robe: L.robe ? mat(TX.cloth, L.robe, { side: DS }) : null, pauldron: c === CLASSES.knight || c === CLASSES.warrior ? 1.1 : 0,
    tabard: L.tabard ? mat(TX.tatter, L.tabard) : null, weapon: W.model, shield: S.model, twoHand: false });
  scene.add(P.model.root); if (!P.shadow) P.shadow = blob(.5);
  P.model.twoHand = P.twoHand; if (P.model.shield) P.model.shield.visible = !P.twoHand;
}
function setClass(id) {
  const c = CLASSES[id]; P.cls = c; P.clsId = id;
  STATS.forEach((k, i) => P.stats[k] = c.st[i]);
  P.wpn = c.wpn; P.sh = c.sh; P.armor = c.armor; P.weapons = [c.wpn]; P.shields = [c.sh]; P.wpnUp = 0; P.twoHand = false;
  P.inv = {}; P.belt = ['estus']; P.beltI = 0; P.souls = 0; P.humanity = 0; P.human = false; P.spell = c.spell || null;
  P.spellUses = P.spell ? SPELLS[P.spell].uses : 0;
  if (id === 'thief') giveItem('homewardBone', 1); if (id === 'cleric' || id === 'warrior' || id === 'knight') {}
  P.hp = hpMax(); P.stam = stMax(); P.estusMax = 5; P.estus = 5;
  rebuildPlayerModel();
}

/* ---------------- input buffer & player update ---------------- */
function setBuf(a) { P.buffer = a; P.bufT = .38; }
function startState(s) { P.state = s; P.st = 0; }
const AIR = ['fall', 'jump', 'plunge'];
function lockTarget() { return P.lock && P.lock.alive ? P.lock : null; }
function faceInput(wx, wz, mag, lockT) { if (lockT) P.yaw = yawTo(P.pos, lockT.pos); else if (mag > .1) P.yaw = Math.atan2(wx, wz); }
function spendSt(n) { P.stam = Math.max(0, P.stam - n); P.stamDelay = .5; }

function tryAction(a, wx, wz, mag, lockT) {
  if (a === 'item') return useBeltItem();
  if (a === 'cast') return castSpell(wx, wz, mag, lockT);
  if (P.stam <= 0) return false;
  if (a === 'roll') {
    const rt = rollType(); if (rt === 'none') { toast('Too heavy to roll'); P.buffer = null; return false; }
    if (mag < .1 && !lockT) { spendSt(14); startState('backstep'); sfx('roll'); P.buffer = null; return true; }
    let dx = Math.sin(P.yaw), dz = Math.cos(P.yaw); if (mag > .1) { dx = wx; dz = wz; } else if (lockT) { dx = -Math.sin(P.yaw); dz = -Math.cos(P.yaw); }
    P.rollDir = [dx, dz]; P.rollT = ROLLS[rt]; P.yaw = Math.atan2(dx, dz); spendSt(18); startState('roll'); sfx('roll'); P.buffer = null; return true;
  }
  if (a === 'parry') {
    if (P.twoHand) { P.buffer = null; return false; }
    spendSt(10); startState('parry'); P.parryWin = SHIELDS[P.sh].parry; P.buffer = null; sfx('swing'); return true;
  }
  if (a === 'kick') { spendSt(15); P.atk = { def: KICK, t: 0, hit: new Set(), swung: false, kind: 'kick' }; startState('attack'); P.buffer = null; return true; }
  if (a === 'light' || a === 'heavy') {
    /* critical hits first: riposte a parried foe in front, or backstab one from behind */
    if (a === 'light' && tryCrit()) { P.buffer = null; return true; }
    const mv = moves(); let def, kind = a;
    if (a === 'light') {
      if (P.state === 'free' && P.sprinting) { def = RUN_ATK; kind = 'run'; }
      else if (P.state === 'roll' || (P.lastRollEnd && G.time - P.lastRollEnd < .25)) { def = { ...mv.l[0], wind: mv.l[0].wind * .7 }; kind = 'rollatk'; }
      else { const i = P.state === 'attack' && P.atk && P.atk.kind === 'light' ? (P.atk.ci + 1) % mv.l.length : 0; def = mv.l[i]; def = { ...def, ci: i }; }
    } else def = mv.h;
    const st = a === 'heavy' ? mv.st[1] : mv.st[0];
    faceInput(wx, wz, mag, lockT); spendSt(st); P.stamDelay = .6;
    P.atk = { def, t: 0, hit: new Set(), swung: false, kind, ci: def.ci || 0, pd: a === 'heavy' ? mv.pd[1] : mv.pd[0] }; startState('attack'); P.buffer = null; return true;
  }
  return false;
}
function tryCrit() {
  for (const e of enemies) {
    if (!e.alive || e.T.noCrit) continue;
    const d = distXZ(P.pos, e.pos); if (d > e.r + 1.3 || Math.abs(e.pos.y - P.pos.y) > .8) continue;
    const toE = yawTo(P.pos, e.pos);
    if (e.state === 'parried' && Math.abs(angDiff(P.yaw, toE)) < 1.0) { startCrit(e, 'riposte'); return true; }
    const behind = Math.abs(angDiff(e.yaw, toE)) < .9;
    if (behind && e.state !== 'attack' && e.state !== 'block' && !e.guard && e.lift < .2 && !e.isBoss) { startCrit(e, 'backstab'); return true; }
  }
  return false;
}
function startCrit(e, kind) {
  P.critTarget = e; P.critKind = kind; P.yaw = yawTo(P.pos, e.pos); startState('crit'); P.critDone = false;
  e.state = 'critted'; e.st = 0; e.atk = null; if (kind === 'backstab') e.yaw = P.yaw; else e.yaw = P.yaw + Math.PI;
  const back = kind === 'backstab' ? 1.0 : 1.1; P.pos.x = e.pos.x - Math.sin(P.yaw) * (e.r + back * .7); P.pos.z = e.pos.z - Math.cos(P.yaw) * (e.r + back * .7);
}
function updatePlayer(dt) {
  P.st += dt;
  const cy = C.yaw, fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
  const mv = moveVec(); let wx = fx * mv.y + rx * mv.x, wz = fz * mv.y + rz * mv.x; const mag = Math.min(1, Math.hypot(mv.x, mv.y));
  if (mag > .01) { const l = Math.hypot(wx, wz); wx /= l; wz /= l; }
  const busy = ['dead', 'rest', 'fog', 'climb', 'crit', 'menu', 'lift'].includes(P.state) || G.ended || G.menu;
  if (!busy) {
    if (btn.light.pressed) setBuf(btn.block.down && !P.twoHand ? 'light' : (keys.ShiftLeft || keys.ShiftRight ? 'heavy' : 'light'));
    if (btn.heavy.pressed) setBuf(btn.block.down && !P.twoHand ? 'kick' : 'heavy');
    if (btn.parry.pressed) setBuf('parry');
    if (btn.roll.released && btn.roll.t < .28) { if (P.sprintGrace > 0 && P.onGround && P.state === 'free') setBuf('jump'); else setBuf('roll'); }
    if (btn.item.pressed) setBuf('item');
    if (btn.cast.pressed && P.spell) setBuf('cast');
  }
  P.bufT -= dt; if (P.bufT <= 0) P.buffer = null;
  P.sprintGrace -= dt;
  const wasSprint = P.sprinting;
  P.sprinting = false; P.blocking = false; P.iframe = false; P.unstable = false;
  const lockT = lockTarget(), tg = P.tgt, m = P.model;
  m.flask.visible = false;
  /* air */
  if (!P.onGround && !AIR.includes(P.state) && !['climb', 'dead', 'crit', 'fog', 'lift'].includes(P.state)) { P.air = { vx: (P.lastVel?.x || 0) * .6, vz: (P.lastVel?.z || 0) * .6 }; startState('fall'); }
  const before = P.pos.clone();
  switch (P.state) {
    case 'free': {
      if (P.buffer === 'jump') { P.buffer = null; if (P.stam > 0) { spendSt(20); P.onGround = false; P.vy = 6.2; P.fallTop = P.pos.y; P.air = { vx: Math.sin(P.yaw) * 6.8, vz: Math.cos(P.yaw) * 6.8 }; startState('jump'); sfx('roll'); break; } }
      if (P.buffer && tryAction(P.buffer, wx, wz, mag, lockT)) break;
      const caster = false;
      const wantBlock = btn.block.down && P.stam > 0 && !caster;
      const rt = rollType();
      const sprint = btn.roll.down && btn.roll.t >= .28 && mag > .3 && P.stam > 0 && !wantBlock && rt !== 'none';
      let speed = 4.4 * mag * (rt === 'fat' ? .78 : rt === 'mid' ? .93 : rt === 'none' ? .45 : 1);
      if (sprint) { speed = 6.9 * (rt === 'fat' ? .8 : 1); P.sprinting = true; P.stam = Math.max(0, P.stam - 13 * dt); P.stamDelay = .4; P.sprintGrace = .3; }
      if (wantBlock) { P.blocking = true; speed = Math.min(speed, 2.4); } else if (lockT && !sprint) speed = Math.min(speed, 3.6);
      P.pos.x += wx * speed * dt; P.pos.z += wz * speed * dt;
      if (lockT && !sprint) P.yaw = dampAng(P.yaw, yawTo(P.pos, lockT.pos), 14, dt);
      else if (mag > .05) P.yaw = dampAng(P.yaw, Math.atan2(wx, wz), 12, dt);
      const prevPh = P.walkPh; P.walkPh += dt * speed * 2.1; if (Math.floor(prevPh / Math.PI) !== Math.floor(P.walkPh / Math.PI) && speed > 1) sfx('step');
      poseFree(tg, speed / 4.4, P.walkPh, P.blocking, sprint);
      if (P.blocking && P.twoHand) { tg.aRx = -1.3; tg.eR = -1.1; tg.wx = .9; }
      break; }
    case 'attack': {
      const a = P.atk, d = a.def; a.t += dt; const ph = atkPhase(a);
      if (ph === 0) { const ty = lockT ? yawTo(P.pos, lockT.pos) : (mag > .1 ? Math.atan2(wx, wz) : P.yaw); P.yaw = dampAng(P.yaw, ty, a.t < d.wind * .5 ? 10 : 3, dt); }
      const ls = d.wind * .55, le = d.wind + d.act;
      if (a.t > ls && a.t < le && d.lunge) { let sp = d.lunge / (le - ls); if (lockT && distXZ(P.pos, lockT.pos) < lockT.r + P.r + .5) sp = 0; P.pos.x += Math.sin(P.yaw) * sp * dt; P.pos.z += Math.cos(P.yaw) * sp * dt; }
      if (ph >= 1 && !a.swung) { a.swung = true; sfx(a.kind === 'heavy' ? 'heavy' : 'swing'); }
      if (ph === 1) playerHitCheck(a);
      if (a.t > d.wind + d.act + d.rec * .6 && P.buffer && P.buffer !== 'jump' && tryAction(P.buffer, wx, wz, mag, lockT)) break;
      if (ph === 3) { P.state = 'free'; P.atk = null; break; }
      atkPose(tg, a); if (d.kick) { blendPose(tg, IDLE, POSE.kick, ph === 0 ? ease(a.t / d.wind) : ph === 1 ? 1 : 1 - ease(Math.min(1, (a.t - d.wind - d.act) / d.rec))); }
      if (P.twoHand) { tg.aLx = tg.aRx; }
      break; }
    case 'roll': {
      const R = P.rollT, k = P.st / R.dur; P.iframe = P.st > R.ifr[0] && P.st < R.ifr[1]; P.unstable = P.st > R.unstable[0] && P.st < R.unstable[1];
      const moveDur = R.dur * .62; const sp = P.st < moveDur ? R.dist / moveDur * 1.35 * (1 - P.st / moveDur * .65) : 0;
      P.pos.x += P.rollDir[0] * sp * dt; P.pos.z += P.rollDir[1] * sp * dt;
      copyPose(tg, IDLE); tg.lL = -1.4; tg.lR = -1.2; tg.kL = 1.9; tg.kR = 1.8; tg.aRx = -1.1; tg.eR = -1.3; tg.aLx = -1.1; tg.eL = -1.3; tg.hY = -.35 * Math.sin(Math.min(1, k / .7) * Math.PI); tg.tX = .5; tg.hd = .5;
      P.pose.spin = Math.min(1, P.st / moveDur) * TAU;
      if (P.st >= R.dur * .78 && P.buffer && P.buffer !== 'roll') { P.pose.spin = 0; P.lastRollEnd = G.time; P.state = 'free'; tryAction(P.buffer, wx, wz, mag, lockT); break; }
      if (P.st >= R.dur) { P.pose.spin = 0; P.state = 'free'; P.lastRollEnd = G.time; if (P.buffer) tryAction(P.buffer, wx, wz, mag, lockT); }
      break; }
    case 'backstep': {
      const dur = .5; P.iframe = P.st > .03 && P.st < .22; const sp = P.st < .3 ? 5.2 * (1 - P.st / .3) : 0;
      P.pos.x -= Math.sin(P.yaw) * sp * dt; P.pos.z -= Math.cos(P.yaw) * sp * dt;
      copyPose(tg, IDLE); tg.tX = -.25; tg.lL = .5; tg.lR = .2; tg.kL = .5; tg.hY = -.05;
      if (P.st >= dur) { P.state = 'free'; if (P.buffer) tryAction(P.buffer, wx, wz, mag, lockT); }
      break; }
    case 'jump': case 'fall': {
      P.pos.x += P.air.vx * dt; P.pos.z += P.air.vz * dt; P.air.vx *= Math.exp(-.6 * dt); P.air.vz *= Math.exp(-.6 * dt);
      if (mag > .1) { P.pos.x += wx * 1.2 * dt; P.pos.z += wz * 1.2 * dt; }
      copyPose(tg, P.state === 'jump' ? POSE.jump : POSE.jump); tg.aRx = -1.3; tg.aLx = -1.6;
      if ((btn.light.pressed || P.buffer === 'light') && P.pos.y - groundAt(P.pos.x, P.pos.z, P.pos.y) > 1.8) { P.buffer = null; startState('plunge'); P.plunging = true; }
      break; }
    case 'plunge': copyPose(tg, POSE.plunge); P.pos.x += (P.air?.vx || 0) * dt * .3; P.pos.z += (P.air?.vz || 0) * dt * .3; break;
    case 'land': copyPose(tg, IDLE); tg.hY = -.25; tg.kL = 1; tg.kR = 1; tg.lL = -.5; tg.lR = -.5; tg.tX = .3; if (P.st > P.landDur) P.state = 'free'; break;
    case 'hurt': copyPose(tg, POSE.hurt); if (P.st >= P.hurtDur) { P.state = 'free'; if (P.buffer === 'roll') tryAction('roll', wx, wz, mag, lockT); } break;
    case 'down': copyPose(tg, P.st < 1.2 ? POSE.down : IDLE); P.iframe = P.st > .9; if (P.st >= 1.7) P.state = 'free'; break;
    case 'guardbreak': copyPose(tg, POSE.hurt); tg.aLx = .4; tg.eL = -.1; if (P.st >= 1.0) P.state = 'free'; break;
    case 'recoil': copyPose(tg, POSE.hurt); tg.aRx = -2.2; tg.eR = -.2; tg.tX = -.2; if (P.st >= .5) P.state = 'free'; break;
    case 'block': copyPose(tg, IDLE); tg.aLx = -1.0; tg.eL = -.75; tg.aLy = -.6; tg.tX = -.12; P.blocking = true; if (P.st >= .3) P.state = 'free'; break;
    case 'parry': {
      const k = P.st; P.parryActive = k > .08 && k < .08 + P.parryWin;
      blendPose(tg, IDLE, POSE.parry, k < .1 ? k / .1 : k < .35 ? 1 : 1 - (k - .35) / .45);
      if (k > .8) { P.state = 'free'; P.parryActive = false; }
      break; }
    case 'parried': copyPose(tg, POSE.parried); if (P.st > 1.4) P.state = 'free'; break;
    case 'crit': {
      const e = P.critTarget, dur = P.critKind === 'riposte' ? 1.6 : 1.9; P.iframe = true;
      if (P.st < .45) { copyPose(tg, POSE.tw); tg.eR = -1.6; } else if (P.st < .7) copyPose(tg, POSE.ts); else blendPose(tg, POSE.ts, IDLE, Math.min(1, (P.st - .7) / .9));
      if (!P.critDone && P.st > .5) { P.critDone = true; const crit = WEAPONS[P.wpn].crit / 100; const mult = P.critKind === 'riposte' ? 4.6 : 3.6; damageEnemy(e, AR() * mult * crit, 99, true, 'crit'); sfx('stab', e.pos); emit(e.pos.x, e.pos.y + 1.1, e.pos.z, 26, { color: [0x6a0a0a, 0x9a1a12], speed: 3, life: .7, size: .08, add: false }); G.hitstop = .12; }
      if (P.st > dur) { P.state = 'free'; P.critTarget = null; }
      break; }
    case 'heal': {
      copyPose(tg, POSE.heal); m.flask.visible = true; P.pos.x += wx * 1.3 * mag * dt; P.pos.z += wz * 1.3 * mag * dt; if (mag > .05) P.yaw = dampAng(P.yaw, Math.atan2(wx, wz), 5, dt);
      if (!P.used && P.st > 1.05) { P.used = true; P.healTo = Math.min(hpMax(), P.hp + 300); sfx('heal'); emit(P.pos.x, P.pos.y + 1.1, P.pos.z, 22, { color: [0xffb050, 0xffe0a0], speed: 1.2, up: 1.4, grav: -1, life: .9, size: .07, jit: .35 }); }
      if (P.used && P.hp < P.healTo) P.hp = Math.min(P.healTo, P.hp + 600 * dt);
      if (P.st >= 1.85) P.state = 'free'; break; }
    case 'useItem': {
      const it = P.useId, def = ITEMS[it];
      if (def.use === 'throw') { blendPose(tg, POSE.throw0, POSE.throw1, clamp((P.st - .25) / .15, 0, 1)); if (!P.used && P.st > .32) { P.used = true; throwProj(def.proj); } if (P.st > .8) P.state = 'free'; }
      else { copyPose(tg, POSE.heal); if (!P.used && P.st > .8) { P.used = true; applyConsumable(it); } if (P.st > 1.3) P.state = 'free'; }
      break; }
    case 'cast': {
      const sp = SPELLS[P.spell];
      if (sp.kind === 'miracle') { copyPose(tg, POSE.roar); tg.aRx = -1.4; tg.eR = -.2; tg.hY = -.2; tg.kL = .6; tg.kR = .6; if (!P.used && P.st > 1.4) { P.used = true; P.hp = Math.min(hpMax(), P.hp + 300 + P.stats.fth * 4); sfx('heal'); emit(P.pos.x, P.pos.y + .2, P.pos.z, 40, { color: [0xfff0a0, 0xffd060], speed: 2.5, up: 2, grav: -1, life: 1.1, size: .06, jit: 1.2 }); } if (P.st > 2.2) P.state = 'free'; }
      else { copyPose(tg, POSE.cast); if (!P.used && P.st > .45) { P.used = true; throwProj(P.spell); } if (P.st > 1.0) P.state = 'free'; }
      break; }
    case 'climb': updateClimb(dt, mv); break;
    case 'dead': copyPose(tg, POSE.dead); if (P.st > 1 && !P.diedShown) { P.diedShown = true; banner('YOU DIED', '', 99); } if (P.st > 4.4 && !P.fadeOut) { P.fadeOut = true; $('#fade').style.opacity = 1; } if (P.st > 5.4) respawn(); break;
    case 'rest': copyPose(tg, POSE.sit); break;
    case 'fog': { const k = Math.min(1, P.st / 1.3); P.pos.lerpVectors(P.fogFrom, P.fogTo, k); P.walkPh += dt * 6; poseFree(tg, .6, P.walkPh, false, false); if (k >= 1) { P.state = 'free'; P.fogGate.set(true); if (P.fogGate.boss) startBossFight(P.fogGate.boss); } break; }
    case 'lift': copyPose(tg, IDLE); break;
  }
  /* regen */
  if (!['attack', 'roll', 'backstep', 'jump'].includes(P.state) && !P.sprinting) {
    if (P.stamDelay > 0) P.stamDelay -= dt;
    else { let rg = 45 * (P.blocking || P.state === 'climb' ? .35 : 1) * (loadPct() > .5 ? .8 : 1) + (P.blossomT > 0 ? 40 : 0); P.stam = Math.min(stMax(), P.stam + rg * dt); }
  }
  P.blossomT -= dt; P.resinT -= dt; P.poiseT -= dt; if (P.poiseT <= 0) P.poiseCur = P.armor.poise;
  P.pos.x += P.kb.x * dt; P.pos.z += P.kb.z * dt; P.kb.multiplyScalar(Math.exp(-7 * dt));
  /* physics */
  if (P.state !== 'climb' && P.state !== 'fog' && P.state !== 'crit' && P.state !== 'lift') {
    const fell = physStep(P, dt);
    if (P.onGround && (AIR.includes(P.state) || fell > 0)) onLand(fell);
  }
  P.lastVel = P.pos.clone().sub(before).divideScalar(Math.max(dt, 1e-4));
  if (P.pos.y < -30 && !P.dead) { P.hp = 0; playerDie(); }
  if (P.onGround && P.state === 'free') { P.safeT += dt; if (P.safeT > .5) { P.lastSafe.copy(P.pos); P.safeT = 0; } }
  /* pose */
  for (const k of PK) { if (k === 'spin' && P.state === 'roll') continue; P.pose[k] = damp(P.pose[k], tg[k], P.state === 'attack' || P.state === 'crit' ? 30 : 16, dt); }
  if (P.hpTrail < P.hp) P.hpTrail = P.hp; P.trailT -= dt; if (P.trailT <= 0) P.hpTrail = damp(P.hpTrail, P.hp, 4, dt);
}
function onLand(h) {
  if (P.state === 'plunge') {
    let hit = false;
    for (const e of enemies) { if (!e.alive) continue; if (distXZ(P.pos, e.pos) < e.r + 1.4 && Math.abs(e.pos.y - P.pos.y) < 2.5) { hit = true; damageEnemy(e, AR() * PLUNGE_MV, 99, true, 'plunge'); sfx('stab', e.pos); shake(.6); emit(e.pos.x, e.pos.y + 1.5, e.pos.z, 30, { color: [0x6a0a0a, 0x9a1a12, 0xffd28a], speed: 4, life: .7, size: .08, add: false }); } }
    P.plunging = false;
    if (hit) { startState('land'); P.landDur = .7; return; }
  }
  sfx('land');
  if (h > 16) { P.hp = 0; playerDie(); return; }
  if (h > 6) { const dmg = Math.round(hpMax() * (h - 6) / 10); P.hp -= dmg; P.trailT = .6; vibrate(80); shake(.3); if (P.hp <= 0) { playerDie(); return; } startState('land'); P.landDur = .8; return; }
  if (h > 2.2) { startState('land'); P.landDur = .35; return; }
  if (AIR.includes(P.state)) P.state = 'free';
}
function startClimb(L, fromTop) {
  P.ladder = L; P.lock = null; startState('climb'); P.yaw = L.face; P.climbPh = 0;
  P.pos.set(L.x - Math.sin(L.face) * .45, fromTop ? L.y1 - 1.6 : L.y0 + .05, L.z - Math.cos(L.face) * .45);
}
function updateClimb(dt, mv) {
  const L = P.ladder; let dy = mv.y * 2.2; if (btn.roll.pressed) { P.state = 'fall'; P.onGround = false; P.vy = 0; P.fallTop = P.pos.y; P.air = { vx: -Math.sin(L.face) * 1.5, vz: -Math.cos(L.face) * 1.5 }; return; }
  P.pos.y += dy * dt; P.climbPh += dy * dt * 2.4;
  copyPose(P.tgt, POSE.climb); const s = Math.sin(P.climbPh); P.tgt.aRx = -2.5 + s * .4; P.tgt.aLx = -2.5 - s * .4; P.tgt.lL = -.6 + s * .4; P.tgt.lR = -.6 - s * .4; P.tgt.kL = .9 - s * .3; P.tgt.kR = .9 + s * .3;
  if (P.pos.y >= L.y1 - .3 && dy > 0) { P.pos.copy(L.top); P.state = 'free'; P.onGround = true; P.vy = 0; }
  else if (P.pos.y <= L.y0 && dy < 0) { P.pos.copy(L.bot); P.pos.y = L.y0; P.state = 'free'; P.onGround = true; }
}

/* ---------------- hits ---------------- */
function playerHitCheck(a) {
  const d = a.def, buff = P.resinT > 0;
  for (const e of enemies) {
    if (!e.alive || a.hit.has(e) || e.state === 'critted') continue;
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, dist = Math.hypot(dx, dz) - e.r;
    if (dist > d.range || Math.abs((e.pos.y + e.lift) - P.pos.y) > 1.6 + e.T.s) continue;
    if (Math.abs(angDiff(P.yaw, Math.atan2(dx, dz))) > d.arc && dist > .3) continue;
    a.hit.add(e);
    if (d.kick) { if (e.guard || e.state === 'block' || e.state === 'stance') guardBreakEnemy(e); else if (!e.isBoss) { e.kb = 2; } continue; }
    /* parry stance: balder knights turn your swing back on you */
    if (e.state === 'stance' && Math.abs(angDiff(e.yaw, Math.atan2(-dx, -dz))) < 1.0) { sfx('parry', e.pos); startState('parried'); P.atk = null; e.state = 'riposteWait'; e.st = 0; return; }
    const front = Math.abs(angDiff(e.yaw, Math.atan2(-dx, -dz))) < 1.2;
    if (e.guard && front && !e.isBoss) {
      sfx('clang', e.pos); emit(e.pos.x - dx * .3, e.pos.y + 1.2, e.pos.z - dz * .3, 10, { color: [0xffe2a0, 0xffffff], speed: 4, life: .3, size: .05 });
      e.guardHp -= a.pd || 20; if (e.guardHp <= 0) guardBreakEnemy(e);
      else if (a.kind !== 'heavy' && e.T.bounce) { startState('recoil'); P.atk = null; return; }
      continue;
    }
    let dmg = AR() * d.mv * rand(.94, 1.06);
    if (buff) dmg += 90 * (e.T.weakLightning ? 1.6 : 1);
    if (e.T.armorFront && front) dmg *= .35;
    if (e === G.gargoyleA && !front && !e.tailCut) { e.tailHp -= dmg * .5; if (e.tailHp <= 0) cutTail(e); }
    damageEnemy(e, dmg, a.pd || 20, a.kind === 'heavy', 'hit');
  }
  for (const b of breakables) if (!b.broken && distXZ(P.pos, b.pos) < d.range + .3 && Math.abs(b.pos.y - P.pos.y) < 1.5) breakObj(b);
}
/* the player gets hit. kind: {pd, kd (knockdown), unblock, fire, magic} */
function hurtPlayer(dmg, pushYaw, o = {}) {
  if (P.dead || P.iframe || P.state === 'rest' || P.state === 'fog' || P.state === 'crit' || P.state === 'lift') return false;
  if (P.state === 'parry' && P.parryActive && o.parryable && o.src) {
    const s = o.src; if (Math.abs(angDiff(P.yaw, yawTo(P.pos, s.pos))) < 1.2) { sfx('parry'); s.state = 'parried'; s.st = 0; s.atk = null; G.hitstop = .1; emit(P.pos.x + Math.sin(P.yaw) * .6, P.pos.y + 1.2, P.pos.z + Math.cos(P.yaw) * .6, 14, { color: [0xffffff, 0xffe0a0], speed: 5, life: .3, size: .05 }); return false; }
  }
  const front = Math.abs(angDiff(P.yaw, pushYaw + Math.PI)) < 1.3;
  const abs = o.fire ? .2 : o.magic ? .15 : P.armor.abs;
  const ring = P.ring === 'blueTearstone' && P.hp < hpMax() * .2 ? .5 : 1;
  if (P.blocking && front && !o.unblock) {
    const S = SHIELDS[P.sh], blockPct = P.twoHand ? 45 : (o.fire ? 70 : o.magic ? 30 : S.block), stab = P.twoHand ? 20 : S.stab;
    P.stam -= dmg * .55 * (1 - stab / 100) + 8; P.stamDelay = .8; sfx('clang'); shake(.1);
    emit(P.pos.x + Math.sin(P.yaw) * .5, P.pos.y + 1.2, P.pos.z + Math.cos(P.yaw) * .5, 12, { color: [0xffe2a0, 0xffffff], speed: 4, life: .3, size: .05 });
    P.kb.set(Math.sin(pushYaw) * 2.5, 0, Math.cos(pushYaw) * 2.5);
    P.hp -= Math.round(dmg * (1 - blockPct / 100) * (1 - abs) * ring);
    if (P.stam < 0) { P.stam = 0; startState('guardbreak'); toast('Guard broken'); } else startState('block');
    if (P.hp <= 0) playerDie(); return true;
  }
  let d = dmg * (1 - abs) * ring * (P.unstable ? 1.4 : 1);
  P.hp -= Math.round(d); P.trailT = .6; sfx('hurt'); shake(.22); vibrate(50);
  $('#vignette').style.opacity = 1; setTimeout(() => $('#vignette').style.opacity = 0, 180);
  emit(P.pos.x, P.pos.y + 1.2, P.pos.z, 10, { color: [0x6a0a0a, 0x9a1a12], speed: 3, life: .5, size: .07, add: false });
  if (P.hp <= 0) { playerDie(); return true; }
  if (P.state === 'climb') { P.state = 'fall'; P.onGround = false; P.vy = 0; P.fallTop = P.pos.y; P.air = { vx: 0, vz: 0 }; return true; }
  if (AIR.includes(P.state)) return true;
  P.poiseCur -= (o.pd ?? 30); P.poiseT = 5;
  if (o.kd) { P.atk = null; startState('down'); P.kb.set(Math.sin(pushYaw) * 7, 0, Math.cos(pushYaw) * 7); P.yaw = pushYaw + Math.PI; P.poiseCur = P.armor.poise; }
  else if (P.poiseCur <= 0) { P.atk = null; P.hurtDur = dmg > 200 ? .7 : .45; startState('hurt'); P.kb.set(Math.sin(pushYaw) * 4, 0, Math.cos(pushYaw) * 4); P.yaw = pushYaw + Math.PI; P.poiseCur = P.armor.poise; }
  return true;
}
function playerDie() {
  if (P.dead) return;
  P.hp = 0; P.dead = true; startState('dead'); P.lock = null; P.atk = null; P.diedShown = false; P.fadeOut = false; G.deaths++; sfx('died'); vibrate(200);
  if (G.stain) clearStain();
  if (P.souls > 0 || P.humanity > 0) placeStain(P.lastSafe, P.souls, P.humanity);
  P.souls = 0; P.humanity = 0; P.human = false; music(false);
}
function respawn() {
  const b = G.lastBonfire || AREA.firelink;
  P.dead = false; P.state = 'free'; P.st = 0; P.pos.copy(b.pos); P.pos.x += Math.sin(b.spawnYaw) * -1.6; P.pos.z += Math.cos(b.spawnYaw) * -1.6; P.yaw = b.spawnYaw; P.onGround = true; P.vy = 0;
  P.hp = hpMax(); P.hpTrail = P.hp; P.stam = stMax(); refillAtBonfire(b); P.kb.set(0, 0, 0);
  copyPose(P.pose, POSE.sit); resetWorld(); C.yaw = b.spawnYaw + Math.PI; C.pitch = .3; hideBanner(); $('#fade').style.opacity = 0;
}
function refillAtBonfire(b) { P.estusMax = b.kindled ? 10 : 5; P.estus = P.estusMax; if (P.spell) P.spellUses = SPELLS[P.spell].uses; }
/* bloodstain */
let stainMesh = null;
function placeStain(pos, souls, hum) {
  G.stain = { pos: pos.clone(), souls, hum };
  if (!stainMesh) { stainMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), mat(TX.glow, 0x000000, { emissive: 0x60ffb0, alphaTest: .25 })); stainMesh.rotation.x = -Math.PI / 2; scene.add(stainMesh); G.stainLight = addLight(0, -50, 0, 0x40ffa0, 4, .3); G.stainInter = addInteract({ pos: new V3(), r: 1.4, label: () => 'Retrieve souls', on: () => !!G.stain, act: takeStain }); }
  stainMesh.visible = true; stainMesh.position.set(pos.x, pos.y + .04, pos.z); G.stainLight.on = true; G.stainLight.p.set(pos.x, pos.y + .8, pos.z); G.stainInter.pos.copy(pos);
}
function clearStain() { G.stain = null; if (stainMesh) stainMesh.visible = false; if (G.stainLight) G.stainLight.on = false; }
function takeStain() { if (!G.stain) return; P.souls += G.stain.souls; P.humanity += G.stain.hum; showGain(G.stain.souls); sfx('souls'); emit(G.stain.pos.x, G.stain.pos.y + .5, G.stain.pos.z, 20, { color: [0x80ffc0, 0xffffff], speed: 2, up: 2, home: P.pos, life: 1.6, size: .06 }); clearStain(); }

/* ---------------- items in use ---------------- */
function useBeltItem() {
  const id = P.belt[P.beltI]; if (!id) return false;
  if (id === 'estus') { if (P.estus <= 0) { sfx('nope'); toast('The Estus Flask is empty'); P.buffer = null; return false; } P.estus--; P.used = false; startState('heal'); P.buffer = null; return true; }
  if (!hasItem(id)) { sfx('nope'); P.buffer = null; return false; }
  const def = ITEMS[id];
  if (def.use === 'bone') { takeItem(id); P.buffer = null; warpHome(); return true; }
  takeItem(id); P.useId = id; P.used = false; startState('useItem'); P.buffer = null;
  if (def.use === 'throw') { const lockT = lockTarget(); if (lockT) P.yaw = yawTo(P.pos, lockT.pos); }
  return true;
}
function applyConsumable(id) {
  const def = ITEMS[id];
  if (def.use === 'souls') { P.souls += def.souls; showGain(def.souls); sfx('souls'); emit(P.pos.x, P.pos.y + 1, P.pos.z, 12, { color: [0xcfe3ff, 0xffffff], speed: 1.5, up: 1, grav: -1, life: 1, size: .05 }); }
  else if (def.use === 'humanity') { P.hp = hpMax(); P.humanity++; sfx('heal'); emit(P.pos.x, P.pos.y + 1, P.pos.z, 20, { color: [0x222222, 0xffffff], speed: 1.5, up: 1, grav: -1, life: 1, size: .06, add: false }); }
  else if (def.use === 'blossom') { P.blossomT = 60; sfx('heal'); toast('Stamina recovers faster'); }
  else if (def.use === 'resin') { P.resinT = 60; sfx('item'); toast('Your weapon crackles with lightning'); }
}
function warpHome() { $('#fade').style.opacity = 1; P.state = 'lift'; setTimeout(() => { const b = G.lastBonfire || AREA.firelink; P.pos.copy(b.pos); P.pos.z += 1.6; P.state = 'free'; $('#fade').style.opacity = 0; restAt(b, true); }, 900); }
function castSpell(wx, wz, mag, lockT) {
  if (!P.spell) return false;
  if (P.spellUses <= 0) { sfx('nope'); toast('No uses left. Rest at a bonfire.'); P.buffer = null; return false; }
  faceInput(wx, wz, mag, lockT); P.spellUses--; P.used = false; startState('cast'); P.buffer = null; sfx('swing'); return true;
}

/* ---------------- projectiles ---------------- */
const projs = [];
const PROJ = {
  firebomb: { speed: 13, grav: 14, dmg: 180, fire: true, aoe: 1.7, col: 0xff8a30, size: .12 },
  blackFirebomb: { speed: 13, grav: 14, dmg: 300, fire: true, aoe: 1.9, col: 0x553322, size: .14 },
  knife: { speed: 26, grav: 2, dmg: 100, col: 0xd0d0d8, size: .07 },
  soulArrow: { speed: 20, grav: 0, dmg: 110, magic: true, col: 0x8ab8ff, size: .16, glow: true, home: .6 },
  fireball: { speed: 14, grav: 12, dmg: 150, fire: true, aoe: 1.8, col: 0xff6a20, size: .2, glow: true },
  bolt: { speed: 30, grav: 1.5, dmg: 120, col: 0x8a7a5a, size: .07 },
  arrow: { speed: 24, grav: 3, dmg: 80, col: 0x8a7a5a, size: .06 },
  eFirebomb: { speed: 11, grav: 14, dmg: 158, fire: true, aoe: 1.6, col: 0xff8a30, size: .12 },
  eSoulArrow: { speed: 15, grav: 0, dmg: 200, magic: true, col: 0x8ab8ff, size: .18, glow: true, home: 1.2 },
};
function spawnProj(kind, from, dir, owner, target) {
  const d = PROJ[kind], m = new THREE.Mesh(d.glow ? sphG(d.size, 5, 4) : bgeo(d.size, d.size, d.size * (kind === 'bolt' || kind === 'arrow' ? 8 : 1)), new THREE.MeshBasicMaterial({ color: d.col, transparent: !!d.glow, blending: d.glow ? THREE.AdditiveBlending : THREE.NormalBlending }));
  m.position.copy(from); scene.add(m);
  const p = { kind, d, mesh: m, pos: from.clone(), vel: dir.clone().multiplyScalar(d.speed), owner, target, life: 4 };
  projs.push(p); return p;
}
/* launch velocity that lands a lobbed projectile on a target */
function lobDir(from, to, speed, grav) {
  const dx = to.x - from.x, dz = to.z - from.z, dh = Math.hypot(dx, dz), dy = to.y - from.y;
  const t = Math.max(.35, dh / speed); const vy = (dy + .5 * grav * t * t) / t;
  return new V3(dx / t, vy, dz / t).divideScalar(speed);
}
function throwProj(kind) {
  const hand = new V3(); P.model.handR.getWorldPosition(hand);
  const lockT = lockTarget(); const d = PROJ[kind];
  let dir;
  if (d.grav > 5) { const to = lockT ? lockT.pos.clone().add(new V3(0, .8, 0)) : P.pos.clone().add(new V3(Math.sin(P.yaw) * 9, 0, Math.cos(P.yaw) * 9)); dir = lobDir(hand, to, d.speed, d.grav); }
  else { const aim = lockT ? lockT.pos.clone().add(new V3(0, 1.1 * lockT.T.s, 0)).sub(hand).normalize() : new V3(Math.sin(P.yaw), 0, Math.cos(P.yaw)); dir = aim; }
  spawnProj(kind, hand, dir, P, lockT); sfx(kind === 'soulArrow' ? 'parry' : 'swing');
}
function explode(p) {
  const d = p.d; emit(p.pos.x, p.pos.y + .2, p.pos.z, 30, { color: [0xff7a24, 0xffc060, 0x5a3020], speed: 5, up: 2, life: .6, size: .12 }); sfx('boom', p.pos); shake(.15);
  if (p.owner === P) { for (const e of enemies) if (e.alive && e.pos.distanceTo(p.pos) < d.aoe + e.r + .8) damageEnemy(e, d.dmg * (e.T.weakFire ? 1.4 : e.T.resFire ? .5 : 1), 25, false, 'fire'); }
  else if (P.pos.distanceTo(p.pos) < d.aoe + .5) hurtPlayer(d.dmg, Math.atan2(P.pos.x - p.pos.x, P.pos.z - p.pos.z), { fire: true, pd: 25 });
  for (const b of breakables) if (!b.broken && b.pos.distanceTo(p.pos) < d.aoe + .5) breakObj(b);
}
function updateProjs(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i], d = p.d; p.life -= dt;
    if (d.home && p.target && p.target.alive !== false) { const tp = (p.target === P ? P.pos : p.target.pos).clone(); tp.y += 1.1; const want = tp.sub(p.pos).normalize().multiplyScalar(d.speed); p.vel.lerp(want, 1 - Math.exp(-d.home * dt)); }
    p.vel.y -= d.grav * dt; p.pos.addScaledVector(p.vel, dt); p.mesh.position.copy(p.pos); p.mesh.lookAt(tmpV.copy(p.pos).add(p.vel));
    if (d.glow && Math.random() < .5) emit(p.pos.x, p.pos.y, p.pos.z, 1, { color: d.col, speed: .3, grav: 0, life: .3, size: d.size * .6 });
    let hit = false;
    if (p.owner === P) { for (const e of enemies) { if (!e.alive) continue; if (distXZ(p.pos, e.pos) < e.r + .2 && p.pos.y > e.pos.y + e.lift && p.pos.y < e.pos.y + e.lift + 2 * e.T.s) { hit = true; if (!d.aoe) { const front = Math.abs(angDiff(e.yaw, Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z))) < 1.2; if (e.guard && front && !d.magic) { sfx('clang', e.pos); } else damageEnemy(e, d.dmg * (d.magic ? (1 + statF(P.stats.int) * .8) : 1), 20, false, d.magic ? 'magic' : 'hit'); } break; } } }
    else if (!P.dead && distXZ(p.pos, P.pos) < P.r + .25 && p.pos.y > P.pos.y && p.pos.y < P.pos.y + 1.9) { hit = true; if (!d.aoe) hurtPlayer(d.dmg, Math.atan2(p.vel.x, p.vel.z), { magic: d.magic, pd: 20, parryable: false }); }
    if (!hit && (solidAt(p.pos.x, p.pos.y, p.pos.z) || p.pos.y < groundAt(p.pos.x, p.pos.z, p.pos.y + .3) + .05)) hit = true;
    if (hit || p.life <= 0) { if (d.aoe) explode(p); else emit(p.pos.x, p.pos.y, p.pos.z, 6, { color: d.col, speed: 2, life: .3, size: .05 }); scene.remove(p.mesh); projs.splice(i, 1); }
  }
}
