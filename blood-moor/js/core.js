/* Core helpers: math, seeded RNG, value noise, isometric projection, audio. */
'use strict';
const TW = 64, TH = 32;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const chance = p => Math.random() < p;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + (s | 0) * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 3) {
  let v = 0, amp = .5, f = 1;
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f, s + i * 17) * amp; f *= 2; amp *= .5; }
  return v / (1 - Math.pow(.5, oct));
}

// world (tile units) <-> screen (pixels, before camera)
const isoX = (x, y) => (x - y) * (TW / 2);
const isoY = (x, y) => (x + y) * (TH / 2);
const unIsoX = (sx, sy) => sx / TW + sy / TH;
const unIsoY = (sx, sy) => sy / TH - sx / TW;

function rgb(r, g, b, a) { return a === undefined ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

function fmt(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1000) + 'k' : String(Math.round(n)); }

/* ---------- Audio: tiny synthesized effects ---------- */
const AU = { ctx: null, master: null, on: true, noise: null, amb: null };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
    AU.master = AU.ctx.createGain(); AU.master.gain.value = AU.on ? .5 : 0; AU.master.connect(AU.ctx.destination);
    const len = AU.ctx.sampleRate * 1.5, buf = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = buf;
    ambience();
  } catch (e) { AU.ctx = null; }
}
function setSound(on) { AU.on = on; if (AU.master) AU.master.gain.value = on ? .5 : 0; }
function ambience() {
  // low wind over the moor: filtered noise with a slow swell, plus a dull drone
  const c = AU.ctx, src = c.createBufferSource(); src.buffer = AU.noise; src.loop = true;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = .6;
  const g = c.createGain(); g.gain.value = .045;
  const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .07; lg.gain.value = .03; lfo.connect(lg); lg.connect(g.gain); lfo.start();
  src.connect(f); f.connect(g); g.connect(AU.master); src.start();
  const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 55;
  const of = c.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 160; og.gain.value = .018;
  o.connect(of); of.connect(og); og.connect(AU.master); o.start();
  AU.amb = { f, g };
}
function tone(type, f0, f1, dur, vol, delay = 0) {
  const c = AU.ctx; if (!c) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + dur + .02);
}
function hiss(f0, f1, dur, vol, q = 1, type = 'bandpass', delay = 0) {
  const c = AU.ctx; if (!c) return;
  const t = c.currentTime + delay, s = c.createBufferSource(); s.buffer = AU.noise;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t, Math.random()); s.stop(t + dur + .02);
}
const SFX_LAST = {};
function sfx(name) {
  if (!AU.ctx || !AU.on) return;
  const now = performance.now(); if (SFX_LAST[name] && now - SFX_LAST[name] < 45) return; SFX_LAST[name] = now;
  switch (name) {
    case 'fire': hiss(1800, 300, .35, .35, .8); tone('sawtooth', 160, 60, .25, .06); break;
    case 'fireball': hiss(900, 200, .5, .4, .7); tone('triangle', 120, 50, .4, .12); break;
    case 'boom': hiss(600, 60, .7, .6, .5, 'lowpass'); tone('sine', 90, 30, .6, .35); break;
    case 'ice': tone('sine', 1800, 900, .18, .08); hiss(5000, 2000, .2, .15, 3); break;
    case 'shatter': for (let i = 0; i < 4; i++) tone('triangle', rand(1800, 3600), rand(900, 1500), .12, .05, i * .03); hiss(7000, 3000, .25, .2, 2); break;
    case 'nova': hiss(3000, 600, .5, .35, 1.5); tone('sine', 900, 200, .4, .08); break;
    case 'zap': tone('square', rand(700, 1100), 120, .16, .05); hiss(6000, 1500, .18, .22, 1.2); break;
    case 'thunder': hiss(400, 40, 1.2, .7, .4, 'lowpass'); tone('square', 80, 30, .3, .12); break;
    case 'tele': tone('sine', 300, 1600, .25, .1); hiss(2000, 6000, .25, .12, 2); break;
    case 'buff': tone('sine', 440, 880, .5, .08); tone('sine', 660, 1320, .5, .05, .05); break;
    case 'swing': hiss(1200, 400, .15, .2, 1.2); break;
    case 'hit': hiss(900, 200, .12, .35, .8, 'lowpass'); tone('square', 140, 60, .08, .08); break;
    case 'phit': hiss(500, 120, .18, .45, .6, 'lowpass'); tone('sawtooth', 110, 50, .15, .1); break;
    case 'die': tone('sawtooth', 220, 50, .5, .08); hiss(700, 100, .4, .25, .6, 'lowpass'); break;
    case 'gold': for (let i = 0; i < 3; i++) tone('triangle', 2200 + i * 300, 1800, .09, .06, i * .05); break;
    case 'drop': tone('triangle', 900, 500, .1, .08); tone('triangle', 650, 400, .12, .06, .06); break;
    case 'rare': tone('sine', 660, 660, .4, .08); tone('sine', 990, 990, .5, .06, .1); break;
    case 'potion': for (let i = 0; i < 3; i++) tone('sine', 300 + i * 40, 160, .12, .08, i * .09); break;
    case 'level': [0, 4, 7, 12].forEach((s, i) => tone('triangle', 330 * Math.pow(2, s / 12), 330 * Math.pow(2, s / 12), .5, .09, i * .12)); break;
    case 'click': tone('triangle', 900, 700, .04, .05); break;
    case 'nomana': tone('square', 200, 180, .12, .04); break;
    case 'portal': tone('sine', 200, 800, .8, .07); hiss(800, 3000, .8, .12, 2); break;
    case 'quest': [0, 3, 7, 10, 15].forEach((s, i) => tone('triangle', 262 * Math.pow(2, s / 12), 262 * Math.pow(2, s / 12), .7, .08, i * .14)); break;
    case 'quill': hiss(4000, 1500, .1, .15, 2); break;
    case 'rez': tone('sine', 120, 480, .7, .1); hiss(400, 1600, .7, .1, 1); break;
  }
}
