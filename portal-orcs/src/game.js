/* ── Game ─────────────────────────────────────────────────────────────────
   The mage, the horde, and the comedy of momentum.                       */
'use strict';

(function () {

  var view = document.getElementById('view');
  var vg = view.getContext('2d');
  var frameEl = document.getElementById('frame');
  var startSign = document.getElementById('startSign');
  var deathSign = document.getElementById('deathSign');

  var EYE = 0.55, PR = 0.22;
  var GRAV = 13.5;
  var SPLAT_V = 7.0, HURT_V = 3.6;
  var FIRE_G = 2.2;              // fireballs arc; arcane bolts fly flat

  var KIND = {
    grunt:  { h: 0.62, hp: 3, speed: 1.20, mass: 1.0,  dmg: 6,  voice: 1.0,  score: 100 },
    goblin: { h: 0.44, hp: 2, speed: 1.85, mass: 0.55, dmg: 4,  voice: 1.55, score: 120 },
    brute:  { h: 0.94, hp: 7, speed: 0.82, mass: 2.6,  dmg: 13, voice: 0.62, score: 220 },
    shaman: { h: 0.66, hp: 3, speed: 0.95, mass: 0.9,  dmg: 9,  voice: 1.2,  score: 180 }
  };

  /* ── The rune fonts ───────────────────────────────────────────────────
     The horde is not here for you. It is here for these, at opposite ends
     of a chamber too wide to cross on foot — which is what apertures are
     for. Lose both and the chamber goes dark.                            */
  var FONT_SITES = [
    { name: 'Dawn', x: 5.5, y: 4.5 },
    { name: 'Vesper', x: 26.5, y: 19.5 }
  ];
  var fonts = [];

  function resetFonts() {
    fonts.length = 0;
    for (var i = 0; i < FONT_SITES.length; i++) {
      var f = FONT_SITES[i];
      fonts.push({ name: f.name, x: f.x, y: f.y, hp: 240, max: 240, hit: 0, dead: false, t: Math.random() * 6 });
    }
  }

  function aliveFonts() {
    var n = 0;
    for (var i = 0; i < fonts.length; i++) if (!fonts[i].dead) n++;
    return n;
  }

  function nearestFont(x, y) {
    var best = null, bd = 1e9;
    for (var i = 0; i < fonts.length; i++) {
      var f = fonts[i];
      if (f.dead) continue;
      var d = Math.hypot(f.x - x, f.y - y);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  var SPLATS = ['SPLORCH!', 'KERSPLAT!', 'GRONK!', 'THWUMP!', 'SQUELCH!', 'YEET!', 'BONK!', 'OOF!'];
  var DARK = [
    'Both fonts are out. The chamber belongs to the orcs now.',
    'They were never coming for you. You just kept getting in the way.',
    'Two fonts, one mage, no apertures worth speaking of.'
  ];
  var DEATHS = [
    'A goblin hit you with a stick. Repeatedly.',
    'You were out-thought by something with two brain cells and a club.',
    'The horde would like to thank you for your participation.',
    'Turns out orcs also understand momentum.'
  ];

  var player = {
    x: 16.5, y: 19.5, z: EYE, vx: 0, vy: 0, vz: 0, ang: -Math.PI / 2,
    hp: 100, onGround: true, bob: 0, hurtT: 99, dead: false
  };

  var orcs = [], bolts = [], gibs = [], pops = [], decals = [], tracers = [], sparks = [], flames = [];
  var S = {
    running: false, over: false, time: 0, score: 0, wave: 0, splats: 0,
    combo: 0, comboT: 0, banner: '', bannerSub: '', bannerT: 0,
    nextWaveT: 0, spawnQueue: [], spawnT: 0, shake: 0, flash: 0, warp: 0,
    nextHue: 'blue', muted: false, paused: false, laggardT: 0
  };

  var hand = { recoil: 0, charge: 0, charging: false, cool: 0, flare: 0 };
  var keys = {};

  /* ── Shadows ──────────────────────────────────────────────────────────*/
  var shadowImg = (function () {
    var c = Art.make(64, 64), g = c.getContext('2d');
    var gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.62)');
    gr.addColorStop(0.6, 'rgba(0,0,0,0.28)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return c;
  })();

  /* ── Sizing ───────────────────────────────────────────────────────────
     On a pointer machine the chamber sits in a 16:10 frame. On a phone it
     fills the glass, insets its controls past the notch and the home
     indicator, and renders fewer columns to keep the frame rate up.      */
  var dispW = 960, dispH = 600, hudS = 1, K = 1;
  var touchMode = false, portrait = false, ignorePortrait = false;
  var renderH = 300;
  var safe = { t: 0, r: 0, b: 0, l: 0 };
  var probe = document.getElementById('safeProbe');

  /* Quality ladder: recursion depth first, then columns. */
  var QUALITY = [
    { depth: 0, res: 0.66 },
    { depth: 1, res: 0.80 },
    { depth: 1, res: 1.00 },
    { depth: 2, res: 1.00 }
  ];
  var quality = 3;

  function applyQuality() {
    var Q = QUALITY[quality < 0 ? 0 : quality > 3 ? 3 : quality];
    Render.setMaxDepth(Q.depth);
    var rh = Math.max(150, Math.round(renderH * Q.res));
    var rw = Math.round(rh * (view.width / view.height));
    if (rw % 2) rw++;              // the scanline caster writes pixel pairs
    Render.setSize(rw, rh);
  }

  function viewport() {
    var vv = window.visualViewport;
    return {
      w: Math.round(vv ? vv.width : window.innerWidth),
      h: Math.round(vv ? vv.height : window.innerHeight)
    };
  }

  function resize() {
    if (probe) {
      var cs = getComputedStyle(probe);
      safe.t = parseFloat(cs.paddingTop) || 0;
      safe.r = parseFloat(cs.paddingRight) || 0;
      safe.b = parseFloat(cs.paddingBottom) || 0;
      safe.l = parseFloat(cs.paddingLeft) || 0;
    }
    var vp = viewport(), dpr;
    portrait = vp.h > vp.w;

    if (touchMode) {
      dispW = vp.w; dispH = vp.h;
      dpr = Math.min(1.6, window.devicePixelRatio || 1);
      renderH = Math.min(vp.h, vp.w) < 500 ? 232 : 268;
    } else {
      var pad = vp.w < 700 ? 0 : 32;
      var w = Math.min(vp.w - pad, 1180), h = w / 1.6;
      if (h > vp.h - pad) { h = vp.h - pad; w = h * 1.6; }
      dispW = Math.round(w); dispH = Math.round(h);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      renderH = 300;
    }

    view.width = Math.round(dispW * dpr);
    view.height = Math.round(dispH * dpr);
    view.style.width = dispW + 'px';
    view.style.height = dispH + 'px';
    frameEl.style.width = dispW + 'px';
    frameEl.style.height = dispH + 'px';
    K = view.width / dispW;
    hudS = view.height / 600;
    vg.imageSmoothingEnabled = false;
    applyQuality();
    checkOrientation();
    if (S.running) draw();     // a rotation must not leave a blank chamber
  }

  function checkOrientation() {
    var wrong = touchMode && portrait && !ignorePortrait;
    S.paused = wrong && S.running;
    var sign = document.getElementById('rotateSign');
    if (sign) sign.hidden = !wrong || !S.running;
  }

  /* The first real touch decides the layout, whatever the media query said. */
  function goTouch() {
    if (touchMode) return;
    touchMode = true;
    document.body.classList.add('touch');
    Art.setHandScale(0.52);
    quality = 2;
    resize();
  }

  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches &&
      ('ontouchstart' in window)) {
    document.body.classList.add('touch');
    touchMode = true;
    quality = 2;
    Art.setHandScale(0.52);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  /* ── Helpers ──────────────────────────────────────────────────────────*/
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function blockedCircle(x, y, r, z) {
    return World.blocked(x, y, z) ||
      World.blocked(x + r, y, z) || World.blocked(x - r, y, z) ||
      World.blocked(x, y + r, z) || World.blocked(x, y - r, z);
  }

  function popup(x, y, z, text, color, size) {
    // one shout per patch of floor: overlapping labels read as noise
    for (var i = 0; i < pops.length; i++) {
      var q = pops[i];
      if (q.t < 0.5 && Math.hypot(q.x - x, q.y - y) < 1.1) {
        if ((q.size || 1) >= (size || 1)) return;
        pops.splice(i, 1);
        break;
      }
    }
    pops.push({
      x: x, y: y, z: z, text: text, color: color,
      t: 0, life: 1.4, size: size || 1
    });
    if (pops.length > 14) pops.shift();
  }

  function addSplatDecal(x, y, type) {
    decals.push({ x: x, y: y, img: Art.splat(type, (Math.random() * 4) | 0), s: rand(0.34, 0.6), a: 0.72 });
    if (decals.length > 54) decals.shift();
  }

  function spark(x, y, z, n, color, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, e = rand(-0.6, 1);
      sparks.push({
        x: x, y: y, z: z,
        vx: Math.cos(a) * rand(0.4, 1) * spd, vy: Math.sin(a) * rand(0.4, 1) * spd, vz: e * spd,
        t: 0, life: rand(0.25, 0.7), c: color, r: rand(0.03, 0.09)
      });
    }
  }

  /* ── Spawning the horde ───────────────────────────────────────────────*/
  function makeOrc(type, x, y) {
    var k = KIND[type];
    return {
      type: type, x: x, y: y, z: k.h / 2, vx: 0, vy: 0, vz: 0,
      r: k.h * 0.38, h: k.h, w: k.h * 0.73,
      hp: k.hp, maxhp: k.hp, mass: k.mass, speed: k.speed * rand(0.9, 1.12),
      state: 'walk', t: rand(0, 3), frame: 0, rot: 0, spin: 0,
      sideT: 0, side: 1, markX: null, markY: null, stuckT: 0,
      burn: 0, aggroT: 0, passes: 0, kick: 0, atkFont: null, atkCd: 0,
      settle: 0, stunT: 0, atkT: 0, castT: rand(1, 4),
      portalT: -99, curious: Math.random() < 0.32, voice: KIND[type].voice * rand(0.92, 1.08),
      gruntT: rand(1, 5), face: 0
    };
  }

  function waveComp(n) {
    var list = [];
    var count = Math.min(14, 3 + Math.round(n * 1.3));
    for (var i = 0; i < count; i++) {
      var r = Math.random();
      if (n >= 3 && r < 0.14) list.push('brute');
      else if (n >= 4 && r < 0.28) list.push('shaman');
      else if (n >= 2 && r < 0.55) list.push('goblin');
      else list.push('grunt');
    }
    return list;
  }

  function startWave() {
    S.wave++;
    S.spawnQueue = waveComp(S.wave);
    S.spawnT = 0;
    S.banner = S.wave === 1 ? 'Defend Both Fonts' : 'Wave ' + S.wave;
    S.bannerSub = S.wave === 1 ? 'You cannot walk it in time. Cut an aperture at each.' :
      S.wave === 2 ? 'They are marching on the fonts, not on you.' :
      S.wave === 3 ? 'Something heavier is coming.' :
      S.wave === 5 ? 'The shamans have opinions.' :
      pick(['The horde thickens.', 'More volunteers.', 'Shove one through. See what happens.',
            'Fresh test material.', 'Dawn and Vesper are counting.']);
    S.bannerT = 2.6;
    Sfx.horn();
  }

  function spawnNext() {
    var type = S.spawnQueue.shift();
    if (!type) return;
    // Never drop a wave on top of the mage: rank the gates by distance and
    // pick from the far half.
    var gates = World.SPAWNS.slice().sort(function (a, b) {
      return Math.hypot(b[0] - player.x, b[1] - player.y) -
             Math.hypot(a[0] - player.x, a[1] - player.y);
    });
    var pool = gates.slice(0, Math.max(3, Math.ceil(gates.length / 2)));
    var best = pool[(Math.random() * pool.length) | 0];
    var o = makeOrc(type, best[0] + rand(-0.3, 0.3), best[1] + rand(-0.3, 0.3));
    orcs.push(o);
    spark(o.x, o.y, 0.25, 12, 'rgba(143,203,67,0.8)', 1.6);
    Sfx.grunt(Math.hypot(o.x - player.x, o.y - player.y), o.voice, false);
  }

  /* ── Casting ──────────────────────────────────────────────────────────*/
  /* Aiming. There is no vertical aim in a raycaster, so a spell fired from
     the hand used to sail over every orc's head: they are waist-high. Now
     the cast finds a target and leads it in height, always — and on touch
     it also bends horizontally onto one already near the crosshair. */
  var aim = { hit: false, ang: 0, z: 0, dist: 0 };

  function findTarget() {
    aim.hit = false;
    aim.ang = player.ang;
    var cone = touchMode ? 0.22 : 0.16;
    var best = null, bestOff = cone;
    for (var i = 0; i < orcs.length; i++) {
      var o = orcs[i];
      if (o.dead) continue;
      var d = dist2p(o, player);
      if (d > 16 || d < 0.4) continue;
      var a = Math.atan2(o.y - player.y, o.x - player.x);
      var off = Math.abs(Math.atan2(Math.sin(a - player.ang), Math.cos(a - player.ang)));
      if (off < bestOff && World.clearPath(player.x, player.y, o.x, o.y)) {
        bestOff = off; best = o; aim.dist = d; aim.z = o.z;
      }
    }
    if (best) {
      aim.hit = true;
      // thumbs get the angle too; a mouse keeps its own aim
      aim.ang = touchMode ? Math.atan2(best.y - player.y, best.x - player.x) : player.ang;
    }
    return aim;
  }

  function launch(ang, power, isFire, spread) {
    var a = ang + (spread || 0);
    var dx = Math.cos(a), dy = Math.sin(a);
    var speed = isFire ? 19 : 26;
    var muzzle = player.z - 0.16;              // the hand, not the eye
    var vz;
    if (aim.hit && !spread) {
      var tt = Math.max(0.05, aim.dist / speed);
      vz = (aim.z - muzzle) / tt + (isFire ? 0.5 * FIRE_G * tt : 0);
      vz = clamp(vz, -2.4, 2.4);
    } else {
      vz = isFire ? 0.45 : -0.22;              // fireballs arc, bolts drift
    }
    bolts.push({
      x: player.x + dx * 0.35, y: player.y + dy * 0.35, z: muzzle,
      vx: dx * speed, vy: dy * speed, vz: vz,
      power: power, fire: isFire, banked: false, t: 0, trail: []
    });
  }

  function castBolt(power) {
    findTarget();
    var isFire = power >= 0.45;
    launch(aim.ang, power, isFire, 0);
    // a full charge splits into a three-fireball fan
    if (isFire && power > 0.92) {
      launch(aim.ang, power, true, -0.15);
      launch(aim.ang, power, true, 0.15);
    }
    hand.recoil = 1;
    S.shake = Math.max(S.shake, (isFire ? 0.35 : 0.22) + power * 0.4);
    if (isFire) Sfx.fire(power); else Sfx.zap(power);
  }

  function firePortal(hue) {
    var dx = Math.cos(player.ang), dy = Math.sin(player.ang);
    var r = World.castRay(player.x, player.y, dx, dy, 44, -1, -1);
    hand.flare = 1;
    var hx = r.x, hy = r.y;
    var hz = player.z;
    tracers.push({
      x0: player.x - dx * 0.1 + dy * 0.16, y0: player.y - dy * 0.1 - dx * 0.16, z0: player.z - 0.12,
      x1: hx, y1: hy, z1: hz, t: 0, c: World.COLORS[hue]
    });
    if (World.place(hue, r, S.time)) {
      Sfx.portal(hue);
      spark(hx - dx * 0.05, hy - dy * 0.05, hz, 10, World.COLORS[hue].glow, 1.2);
      S.nextHue = hue === 'blue' ? 'orange' : 'blue';
    } else {
      Sfx.fizzle();
      spark(hx - dx * 0.05, hy - dy * 0.05, hz, 6, 'rgba(160,160,170,0.7)', 0.8);
      popup(hx - dx * 0.2, hy - dy * 0.2, hz, 'the stone refuses', '#9d9484', 0.7);
    }
  }

  /* ── Impulses and gore ────────────────────────────────────────────────*/
  function shove(o, ix, iy, iz, dmg, credit) {
    o.state = 'ragdoll';
    o.settle = 0;
    o.stunT = 0;
    o.vx += ix / o.mass;
    o.vy += iy / o.mass;
    o.vz += iz / o.mass;
    o.spin = clamp((o.vx + o.vy) * 0.9 + rand(-4, 4), -13, 13);
    o.aggroT = 7;                      // whoever threw that is the problem now
    if (dmg) o.hp -= dmg;
    // a spell that came out of an aperture kills like a portal kill
    if (credit) o.portalT = S.time;
    if (Math.random() < 0.5) Sfx.grunt(dist2p(o, player), o.voice, true);
  }

  /* ── Fire ─────────────────────────────────────────────────────────────
     A burning orc panics, runs, and sets light to whatever it bumps into.
     Fire travels through apertures as happily as anything else.          */
  function ignite(o, secs) {
    if (o.dead) return;
    var fresh = !(o.burn > 0);
    o.burn = Math.max(o.burn || 0, secs);
    if (fresh) {
      Sfx.ignite(dist2p(o, player));
      if (Math.random() < 0.35) {
        popup(o.x, o.y, o.z + 0.42, pick(['AAAA!', 'HOT!', 'AIEEE', 'not again']), '#ff8a3c', 0.8);
      }
    }
  }

  function igniteArea(x, y, z, r, secs) {
    for (var i = 0; i < orcs.length; i++) {
      var o = orcs[i];
      if (o.dead) continue;
      if (Math.hypot(o.x - x, o.y - y, o.z - z) < r + o.r) ignite(o, secs);
    }
  }

  function dist2p(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function gib(o, speedy, cause) {
    var d = dist2p(o, player);
    if (cause === 'fire') Sfx.boom(d, 0.4); else Sfx.splat(d, speedy);
    S.splats++;
    var portalled = (S.time - o.portalT) < 3.2;

    var base = KIND[o.type].score;
    S.combo++;
    S.comboT = 3.0;
    var mult = cause === 'spun' ? 4 : portalled ? 2.5 : cause === 'fire' ? 1.4 : 1;
    var pts = Math.round(base * mult * (1 + (S.combo - 1) * 0.35));
    S.score += pts;
    Sfx.chime(S.combo);

    var label = cause === 'spun' ? 'SPUN OUT'
      : portalled ? 'PORTAL SPLAT'
      : cause === 'fire' ? pick(['EXTRA CRISPY', 'WELL DONE', 'ROASTED'])
      : pick(SPLATS);
    var labelCol = cause === 'spun' ? '#e3b23c' : portalled ? '#8fe3ff' : cause === 'fire' ? '#ff8a3c' : '#e3b23c';
    popup(o.x, o.y, o.z + 0.35, label + '  +' + pts, labelCol, portalled || cause ? 1.25 : 1);

    var parts = ['head', 'arm', 'arm', 'leg', 'leg', 'tusk', 'chunk', 'chunk'];
    if (Art.SPECIES[o.type].helm) parts.push('helm');
    for (var i = 0; i < parts.length; i++) {
      var a = Math.random() * Math.PI * 2;
      gibs.push({
        img: Art.gib(o.type, parts[i]),
        x: o.x, y: o.y, z: o.z + rand(-0.1, 0.2),
        vx: o.vx * 0.42 + Math.cos(a) * rand(1, 4.6),
        vy: o.vy * 0.42 + Math.sin(a) * rand(1, 4.6),
        vz: o.vz * 0.3 + rand(1.5, 5.5),
        rot: Math.random() * 6.28, spin: rand(-16, 16),
        s: parts[i] === 'head' ? 0.3 : 0.2, t: 0, life: 7, landed: false
      });
    }
    if (gibs.length > 130) gibs.splice(0, gibs.length - 130);
    spark(o.x, o.y, o.z, 14, cause === 'fire' ? 'rgba(255,150,50,0.85)' : 'rgba(143,203,67,0.75)', 2.4);
    addSplatDecal(o.x, o.y, o.type);
    S.shake = Math.max(S.shake, 0.4);
    // a burning orc bursting throws fire at whoever was standing too close
    if (cause === 'fire') igniteArea(o.x, o.y, o.z, 1.0, 3);
  }

  /* ── Physics for anything that flies ─────────────────────────────────*/
  function stepBody(b, dt, bounce, friction) {
    var px = b.x, py = b.y, pz = b.z;
    var impact = 0;

    b.vz -= GRAV * dt;
    var nx = b.x + b.vx * dt, ny = b.y + b.vy * dt, nz = b.z + b.vz * dt;

    if (!blockedCircle(nx, b.y, b.r, nz)) b.x = nx;
    else { impact = Math.max(impact, Math.abs(b.vx)); b.vx *= -bounce; b.vy *= 0.86; }

    if (!blockedCircle(b.x, ny, b.r, nz)) b.y = ny;
    else { impact = Math.max(impact, Math.abs(b.vy)); b.vy *= -bounce; b.vx *= 0.86; }

    b.z = nz;
    if (b.z < b.r) {
      b.z = b.r;
      impact = Math.max(impact, Math.abs(b.vz));
      if (b.vz < -0.7) { b.vz = -b.vz * bounce; b.vx *= friction; b.vy *= friction; }
      else { b.vz = 0; b.onGround = true; }
    } else if (b.z > 1 - b.r) {
      b.z = 1 - b.r;
      impact = Math.max(impact, Math.abs(b.vz));
      b.vz = -Math.abs(b.vz) * bounce;
    } else b.onGround = false;

    var went = World.transfer(b, px, py, pz);
    if (went) {
      b.portalT = S.time;
      b.justWent = went;
      // passes decay, so only a real loop counts as a loop
      if (S.time - (b.passT || -99) > 3.5) b.passes = 0;
      b.passes = (b.passes || 0) + 1;
      b.passT = S.time;
      // the aperture spits: a facing pair becomes a grinder
      if (b.kick) {
        var sp = Math.hypot(b.vx, b.vy);
        if (sp > 1.5 && sp < 24) {
          var k = Math.min(b.kick, 24 / sp);
          b.vx *= k; b.vy *= k;
        }
      }
      Sfx.whoosh(dist2p(b, player));
      spark(b.x, b.y, b.z, 6, went.color.glow, 1.2);
      impact = 0;
    }
    return impact;
  }

  /* ── Orc brains ───────────────────────────────────────────────────────*/
  function updateOrc(o, dt) {
    o.t += dt;
    o.aggroT = Math.max(0, (o.aggroT || 0) - dt);

    // ── burning: cooks, panics, and spreads
    if (o.burn > 0) {
      o.burn -= dt;
      o.hp -= 1.5 * dt;
      o.emberT = (o.emberT || 0) - dt;
      if (o.emberT <= 0) {
        o.emberT = 0.06;
        sparks.push({
          x: o.x + rand(-0.12, 0.12), y: o.y + rand(-0.12, 0.12), z: o.z + rand(-0.1, 0.3),
          vx: rand(-0.4, 0.4), vy: rand(-0.4, 0.4), vz: rand(0.6, 1.8),
          t: 0, life: rand(0.3, 0.7), c: 'rgba(255,150,40,0.9)', r: rand(0.04, 0.1)
        });
      }
      if (o.hp <= 0) { gib(o, 0.9, 'fire'); o.dead = true; return; }
    }

    if (o.state === 'walk' || o.state === 'attack') {
      // ── who is this orc marching on?
      var dPlayer = dist2p(o, player);
      var font = null, tgtX, tgtY;
      if (o.aggroT > 0 || dPlayer < 3.2 || !aliveFonts()) {
        tgtX = player.x; tgtY = player.y;
      } else {
        font = nearestFont(o.x, o.y);
        if (font) { tgtX = font.x; tgtY = font.y; }
        else { tgtX = player.x; tgtY = player.y; }
      }

      var dx = tgtX - o.x, dy = tgtY - o.y;
      var d = Math.hypot(dx, dy) || 1;
      var tx = dx / d, ty = dy / d;

      // Curious orcs make straight for an open aperture. It never ends well.
      if (o.curious && World.linked() && o.aggroT <= 0 && !(o.burn > 0)) {
        o.targetT = (o.targetT || 0) - dt;
        if (o.targetT <= 0) { o.targetKey = Math.random() < 0.5 ? 'blue' : 'orange'; o.targetT = rand(3, 6); }
        var target = World.portals[o.targetKey || 'blue'];
        if (target) {
          var ax = target.cx + target.nx * 0.45 - o.x;
          var ay = target.cy + target.ny * 0.45 - o.y;
          var ad = Math.hypot(ax, ay);
          if (ad < 7 && World.clearPath(o.x, o.y, target.cx + target.nx * 0.3, target.cy + target.ny * 0.3)) {
            tx = ax / (ad || 1); ty = ay / (ad || 1);
            font = null;
            if (ad < 0.7 && Math.random() < 0.1) popup(o.x, o.y, o.z + 0.4, 'ooooh', '#8fe3ff', 0.7);
          }
        }
      }

      o.face = Math.atan2(ty, tx);
      o.atkCd = Math.max(0, (o.atkCd || 0) - dt);
      var spd = o.speed;

      // ── on fire: no more marching orders, just running and screaming
      if (o.burn > 0) {
        spd *= 1.75;
        var weave = Math.sin(o.t * 9) * 0.7;
        var cw = Math.cos(weave), sw = Math.sin(weave);
        var wx = tx * cw - ty * sw, wy = tx * sw + ty * cw;
        tx = wx; ty = wy;
        if (o.state === 'attack') { o.state = 'walk'; o.atkT = 0; }
      } else if (o.state === 'attack') {
        o.atkT -= dt;
        spd *= 0.25;
        if (o.atkT <= 0) {
          if (o.atkFont && !o.atkFont.dead) {
            if (Math.hypot(o.atkFont.x - o.x, o.atkFont.y - o.y) < 1.7) damageFont(o.atkFont, KIND[o.type].dmg * 0.5);
          } else if (!o.atkFont && d < 1.3) {
            hurtPlayer(KIND[o.type].dmg, tx, ty);
          }
          o.state = 'walk';
          o.atkT = 0;
          o.atkFont = null;
        }
      } else if (d < (font ? 1.4 : 1.0) && o.atkCd <= 0 && (font || Math.abs(o.z - EYE) < 0.9)) {
        o.state = 'attack';
        o.atkT = 0.62;                   // a longer wind-up: you can answer it
        o.atkCd = font ? 1.15 : 0.75;    // and a beat between swings
        o.atkFont = font;
        Sfx.grunt(dist2p(o, player), o.voice, true);
      }

      // shamans lob goo from range
      if (o.type === 'shaman' && !(o.burn > 0)) {
        o.castT -= dt;
        if (o.castT <= 0 && dPlayer > 2 && dPlayer < 12 && World.clearPath(o.x, o.y, player.x, player.y)) {
          o.castT = rand(3.4, 5.4);
          var pdx = (player.x - o.x) / dPlayer, pdy = (player.y - o.y) / dPlayer;
          bolts.push({
            x: o.x + pdx * 0.3, y: o.y + pdy * 0.3, z: o.z + 0.25,
            vx: pdx * 7.4, vy: pdy * 7.4, vz: 1.6 + dPlayer * 0.16,
            enemy: true, power: 0, t: 0, trail: []
          });
          Sfx.grunt(dPlayer, o.voice * 0.85, true);
        }
      }

      // An orc wedged in a corner sidesteps rather than grinding the wall
      // forever — otherwise a wave never ends.
      o.stuckT = (o.stuckT || 0) + dt;
      if (o.stuckT > 1.4) {
        var moved = Math.hypot(o.x - (o.markX || 0), o.y - (o.markY || 0));
        if (o.markX != null && moved < 0.45) {
          o.sideT = 1.1;
          o.side = Math.random() < 0.5 ? 1 : -1;
        }
        o.markX = o.x; o.markY = o.y; o.stuckT = 0;
      }
      if (o.sideT > 0) {
        o.sideT -= dt;
        var sx2 = -ty * o.side, sy2 = tx * o.side;
        tx = tx * 0.35 + sx2 * 0.95;
        ty = ty * 0.35 + sy2 * 0.95;
        var nl = Math.hypot(tx, ty) || 1;
        tx /= nl; ty /= nl;
      }

      var mx = o.x + tx * spd * dt, my = o.y + ty * spd * dt;
      var pxo = o.x, pyo = o.y, pzo = o.z;
      if (!blockedCircle(mx, o.y, o.r, o.z)) o.x = mx;
      else if (!blockedCircle(o.x, o.y + ty * spd * dt * 1.4, o.r, o.z)) o.y += ty * spd * dt * 1.4;
      if (!blockedCircle(o.x, my, o.r, o.z)) o.y = my;
      else if (!blockedCircle(o.x + tx * spd * dt * 1.4, o.y, o.r, o.z)) o.x += tx * spd * dt * 1.4;

      o.vx = (o.x - pxo) / dt; o.vy = (o.y - pyo) / dt; o.vz = 0;
      var went = World.transfer(o, pxo, pyo, pzo);
      if (went) {
        o.portalT = S.time;
        Sfx.whoosh(dist2p(o, player));
        // walking into an aperture leaves an orc badly confused
        o.state = 'stun';
        o.stunT = rand(0.7, 1.1);
        o.atkFont = null;
        popup(o.x, o.y, o.z + 0.4, pick(['wheee', 'wot', '?!', 'nooo', 'where']), '#ffc48a', 0.75);
      }
      o.rot *= 0.8;
      o.frame = (Math.floor(o.t * (o.burn > 0 ? 2.6 : 1) * o.speed * 4.4) % 4);

      o.gruntT -= dt;
      if (o.gruntT <= 0) {
        o.gruntT = rand(3, 8);
        if (dPlayer < 14) Sfx.grunt(dPlayer, o.voice, o.burn > 0);
      }

    } else if (o.state === 'ragdoll') {
      o.kick = 1.16;                       // the aperture spits it out faster
      var imp = stepBody(o, dt, 0.46, 0.66);

      if (o.justWent) {
        o.justWent = null;
        popup(o.x, o.y, o.z + 0.4, 'PASS ×' + o.passes, '#8fe3ff', 0.8);
        Sfx.chime(o.passes);
        if (o.passes >= 3) {
          S.score += 400;
          gib(o, 1.6, 'spun');
          o.dead = true;
          return;
        }
      }

      o.rot += o.spin * dt;
      o.spin *= (1 - dt * 0.7);
      if (imp > SPLAT_V) {
        gib(o, imp / SPLAT_V, o.burn > 0 ? 'fire' : null);
        o.dead = true;
        return;
      } else if (imp > HURT_V) {
        o.hp -= (imp - HURT_V) * 0.9;
        Sfx.thud(dist2p(o, player));
        if (o.hp <= 0) { gib(o, 1, o.burn > 0 ? 'fire' : null); o.dead = true; return; }
      }
      var sp = Math.hypot(o.vx, o.vy, o.vz);
      if (o.onGround && sp < 1.0) {
        o.settle += dt;
        if (o.settle > 0.45) {
          if (o.hp <= 0) { gib(o, 0.8, o.burn > 0 ? 'fire' : null); o.dead = true; return; }
          o.state = 'stun';
          o.stunT = rand(0.9, 1.7);
          o.vx = o.vy = 0;
        }
      } else o.settle = 0;

    } else if (o.state === 'stun') {
      o.stunT -= dt;
      o.rot += (0 - o.rot) * Math.min(1, dt * 5);
      o.z += (o.h / 2 - o.z) * Math.min(1, dt * 6);
      if (o.stunT <= 0) { o.state = 'walk'; o.rot = 0; o.settle = 0; }
    }
  }

  /* Orc-on-orc bowling. */
  function orcCollisions(dt) {
    for (var i = 0; i < orcs.length; i++) {
      var a = orcs[i];
      if (a.dead) continue;
      for (var j = i + 1; j < orcs.length; j++) {
        var b = orcs[j];
        if (b.dead) continue;
        var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        var rr = a.r + b.r;
        var d2 = dx * dx + dy * dy;
        if (d2 > rr * rr || Math.abs(dz) > (a.h + b.h) * 0.5) continue;
        var d = Math.sqrt(d2) || 0.001;
        var nx = dx / d, ny = dy / d;
        var overlap = rr - d;

        var ma = a.mass, mb = b.mass, mt = ma + mb;
        a.x -= nx * overlap * (mb / mt); a.y -= ny * overlap * (mb / mt);
        b.x += nx * overlap * (ma / mt); b.y += ny * overlap * (ma / mt);

        if ((a.burn > 0) !== (b.burn > 0)) {
          var lit = a.burn > 0 ? a : b, cold = a.burn > 0 ? b : a;
          ignite(cold, Math.max(2.2, lit.burn * 0.7));
        }

        var rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel > 3.2 && (a.state === 'ragdoll' || b.state === 'ragdoll')) {
          var hitter = a.state === 'ragdoll' ? a : b;
          var victim = hitter === a ? b : a;
          var f = rel * hitter.mass * 0.62;
          shove(victim, nx * f * (hitter === a ? 1 : -1), ny * f * (hitter === a ? 1 : -1), rel * 0.5 + 1.4, rel * 0.35);
          hitter.vx *= 0.55; hitter.vy *= 0.55;
          Sfx.thud(dist2p(victim, player));
          if (rel > 6) popup(victim.x, victim.y, victim.z + 0.4, 'STRIKE!', '#e3b23c', 0.9);
        }
      }
    }
    void dt;
  }

  /* ── Bolts ────────────────────────────────────────────────────────────*/
  function updateBolts(dt) {
    for (var i = bolts.length - 1; i >= 0; i--) {
      var b = bolts[i];
      b.t += dt;
      var steps = 3;
      var hit = null, hitWall = false;

      for (var s = 0; s < steps && !hit && !hitWall; s++) {
        var sdt = dt / steps;
        var px = b.x, py = b.y, pz = b.z;
        if (b.enemy) b.vz -= GRAV * 0.42 * sdt;
        else if (b.fire) b.vz -= FIRE_G * sdt;
        b.x += b.vx * sdt; b.y += b.vy * sdt; b.z += b.vz * sdt;

        if (World.blocked(b.x, b.y, b.z) || b.z < 0.02 || b.z > 0.98) hitWall = true;

        if (b.enemy) {
          if (Math.hypot(b.x - player.x, b.y - player.y) < 0.42 && Math.abs(b.z - (player.z - 0.1)) < 0.5) {
            hurtPlayer(9, b.vx * 0.1, b.vy * 0.1);
            hitWall = true;
          }
        } else {
          for (var k = 0; k < orcs.length; k++) {
            var o = orcs[k];
            if (o.dead) continue;
            // generous vertically: orcs are waist-high and thumbs are coarse
            if (Math.hypot(b.x - o.x, b.y - o.y) < o.r + 0.16 &&
                Math.abs(b.z - o.z) < o.h * 0.6 + 0.16) { hit = o; break; }
          }
        }
        var t2 = World.transfer(b, px, py, pz);
        if (t2) {
          b.portalT = S.time;
          Sfx.whoosh(dist2p(b, player));
          // a spell that has been through an aperture comes out hotter
          if (!b.enemy && !b.banked) {
            b.banked = true;
            b.t = Math.min(b.t, 1.2);
            Sfx.bank();
          }
        }
      }

      b.trail.push(b.x, b.y, b.z);
      if (b.trail.length > 18) b.trail.splice(0, 3);

      if (hit || hitWall || b.t > 2.4) {
        if (b.enemy) {
          if (!(b.t > 2.4)) {
            spark(b.x, b.y, b.z, 8, 'rgba(150,120,200,0.8)', 1.6);
            Sfx.thud(dist2p(b, player));
          }
        } else {
          detonate(b, hit);
        }
        bolts.splice(i, 1);
      }
    }
  }

  function detonate(b, direct) {
    var banked = !!b.banked;
    var bk = banked ? 1.6 : 1;
    var R = (b.fire ? 1.85 : 1.25 + b.power * 0.9) * (banked ? 1.45 : 1);
    var force = (b.fire ? 5.5 : 10 + b.power * 12) * bk;
    var dmg = (b.fire ? 2.2 : 1 + b.power * 1.4) * (banked ? 2 : 1);

    if (b.fire) {
      Sfx.boom(dist2p(b, player), b.power);
      spark(b.x, b.y, b.z, 18 + (b.power * 12) | 0, banked ? 'rgba(150,220,255,0.9)' : 'rgba(255,150,45,0.9)', 2.4);
      for (var f = 0; f < 5; f++) {
        flames.push({
          x: b.x + rand(-R * 0.5, R * 0.5), y: b.y + rand(-R * 0.5, R * 0.5),
          z: 0.05, t: 0, life: rand(0.6, 1.5), s: rand(0.35, 0.7)
        });
      }
      igniteArea(b.x, b.y, b.z, R * 0.95, banked ? 6 : 4.2);
    } else {
      spark(b.x, b.y, b.z, 12 + (b.power * 14) | 0,
        banked ? 'rgba(200,180,255,0.9)' : 'rgba(140,220,255,0.85)', 2 + b.power * 2);
      Sfx.thud(dist2p(b, player));
    }
    S.shake = Math.max(S.shake, (b.fire ? 0.3 : 0.2) + b.power * 0.35);

    if (banked) {
      popup(b.x, b.y, b.z + 0.5, 'BANKED', '#8fe3ff', 1.1);
      S.score += 60;
    }

    for (var i = 0; i < orcs.length; i++) {
      var o = orcs[i];
      if (o.dead) continue;
      var dx = o.x - b.x, dy = o.y - b.y, dz = o.z - b.z;
      var d = Math.hypot(dx, dy, dz);
      if (d > R + o.r) continue;
      var fall = 1 - clamp((d - o.r) / R, 0, 1);
      var nx = (dx || rand(-1, 1)) / (d || 1), ny = (dy || rand(-1, 1)) / (d || 1);
      var fv = force * (0.45 + fall * 0.75) * (o === direct ? 1.35 : 1);
      shove(o, nx * fv, ny * fv, (b.fire ? 1.6 : 3.4) + fall * (b.fire ? 1.4 : 3.6) + b.power * (b.fire ? 1 : 3), dmg, banked);
      if (o === direct && !b.fire && Math.random() < 0.5) popup(o.x, o.y, o.z + 0.45, pick(['WHOMP', 'SHOVE', 'AWAY!']), '#8fe3ff', 0.8);
    }

    // the caster feels it too, at close range
    var pd = Math.hypot(player.x - b.x, player.y - b.y);
    if (pd < 1.5) {
      var pf = (1 - pd / 1.5) * (2.6 + b.power * 4);
      var ax = (player.x - b.x) / (pd || 1), ay = (player.y - b.y) / (pd || 1);
      player.vx += ax * pf; player.vy += ay * pf; player.vz += 1.6 + b.power * 1.4;
      if (b.fire && pd < 1.0) hurtPlayer(6, 0, 0);
    }
  }

  /* ── The fonts under the hammer ───────────────────────────────────────*/
  function damageFont(f, dmg) {
    if (f.dead || !S.running) return;
    f.hp -= dmg;
    f.hit = 1;
    S.fontFlash = 1;
    Sfx.fontHit(Math.hypot(f.x - player.x, f.y - player.y));
    S.shake = Math.max(S.shake, 0.18);
    if (f.hp > 0) return;

    f.hp = 0;
    f.dead = true;
    Sfx.fontBreak();
    S.shake = Math.max(S.shake, 0.7);
    spark(f.x, f.y, 0.5, 26, 'rgba(255,150,45,0.9)', 3);
    popup(f.x, f.y, 0.9, f.name.toUpperCase() + ' IS OUT', '#b3243a', 1.3);
    if (aliveFonts()) {
      S.banner = f.name + ' Has Fallen';
      S.bannerSub = 'One font left. They will all go for it now.';
      S.bannerT = 3;
    } else {
      endGame('fonts');
    }
  }

  /* ── Player ───────────────────────────────────────────────────────────*/
  function hurtPlayer(dmg, nx, ny) {
    if (player.dead) return;
    player.hp -= dmg;
    player.hurtT = 0;
    S.flash = Math.min(1, S.flash + dmg / 40);
    S.shake = Math.max(S.shake, 0.35);
    player.vx += nx * 2.4; player.vy += ny * 2.4;
    Sfx.hurt();
    if (player.hp <= 0) endGame();
  }

  function updatePlayer(dt) {
    var fx = 0, fy = 0;
    var ca = Math.cos(player.ang), sa = Math.sin(player.ang);
    if (keys['KeyW'] || keys['ArrowUp']) { fx += ca; fy += sa; }
    if (keys['KeyS'] || keys['ArrowDown']) { fx -= ca; fy -= sa; }
    if (keys['KeyA']) { fx += sa; fy -= ca; }
    if (keys['KeyD']) { fx -= sa; fy += ca; }
    if (keys['ArrowLeft']) player.ang -= 2.4 * dt;
    if (keys['ArrowRight']) player.ang += 2.4 * dt;
    if (move.x || move.y) {
      fx += ca * move.y - sa * move.x;
      fy += sa * move.y + ca * move.x;
    }

    var len = Math.hypot(fx, fy);
    var sprint = (keys['ShiftLeft'] || keys['ShiftRight']) ? 1.55 : 1;
    // the stick is analogue: a small push walks, a full push sprints
    if (touchMode && len > 0.01) sprint = 0.60 + Math.min(1, len) * 0.85;
    var target = 2.5 * sprint;
    if (len > 0.01) { fx /= len; fy /= len; }

    var grounded = player.onGround;
    var accel = grounded ? 26 : 6;
    var desiredX = fx * target, desiredY = fy * target;
    if (len > 0.01) {
      player.vx += (desiredX - player.vx) * Math.min(1, accel * dt);
      player.vy += (desiredY - player.vy) * Math.min(1, accel * dt);
    } else if (grounded) {
      var damp = Math.max(0, 1 - 12 * dt);
      player.vx *= damp; player.vy *= damp;
    }

    if ((keys['Space'] || move.jump) && grounded) {
      player.vz = 4.4;
      player.onGround = false;
      move.jump = false;
    }

    var px = player.x, py = player.y, pz = player.z;
    player.vz -= GRAV * dt;
    var nx = player.x + player.vx * dt, ny = player.y + player.vy * dt;
    var nz = player.z + player.vz * dt;

    if (!blockedCircle(nx, player.y, PR, nz)) player.x = nx; else player.vx *= -0.15;
    if (!blockedCircle(player.x, ny, PR, nz)) player.y = ny; else player.vy *= -0.15;

    player.z = nz;
    if (player.z <= EYE) {
      if (player.vz < -6) { S.shake = Math.max(S.shake, 0.25); Sfx.thud(0); }
      player.z = EYE; player.vz = 0; player.onGround = true;
    } else if (player.z > 0.94) { player.z = 0.94; player.vz = Math.min(0, player.vz); }
    else player.onGround = false;

    var went = World.transfer(player, px, py, pz);
    if (went) {
      S.warp = 1;
      Sfx.whoosh(0);
    }

    var speed = Math.hypot(player.vx, player.vy);
    player.bob += speed * dt * 2.6;
    player.hurtT += dt;
    if (player.hurtT > 4 && player.hp < 100) player.hp = Math.min(100, player.hp + 3.5 * dt);
  }

  /* ── Frame update ─────────────────────────────────────────────────────*/
  function update(dt) {
    S.time += dt;
    updatePlayer(dt);

    // casting
    hand.cool -= dt;
    hand.recoil *= Math.max(0, 1 - dt * 7);
    hand.flare *= Math.max(0, 1 - dt * 6);
    if (hand.charging) hand.charge = Math.min(1, hand.charge + dt / 0.55);

    for (var i = orcs.length - 1; i >= 0; i--) {
      updateOrc(orcs[i], dt);
      if (orcs[i].dead) orcs.splice(i, 1);
    }
    orcCollisions(dt);
    updateBolts(dt);

    // gibs
    for (var g = gibs.length - 1; g >= 0; g--) {
      var p = gibs[g];
      p.t += dt;
      p.r = 0.06;
      var imp = stepBody(p, dt, 0.42, 0.7);
      p.rot += p.spin * dt;
      p.spin *= (1 - dt * 0.9);
      if (imp > 1.6 && !p.landed && p.z <= 0.09) {
        p.landed = true;
        addSplatDecal(p.x, p.y, 'grunt');
      }
      if (p.t > p.life) gibs.splice(g, 1);
    }

    for (var fl = flames.length - 1; fl >= 0; fl--) {
      var fp = flames[fl];
      fp.t += dt;
      fp.lickT = (fp.lickT || 0) - dt;
      if (fp.lickT <= 0) {
        fp.lickT = 0.35;
        igniteArea(fp.x, fp.y, 0.2, 0.55, 2.4);
      }
      if (fp.t > fp.life) flames.splice(fl, 1);
    }
    if (flames.length > 40) flames.splice(0, flames.length - 40);

    for (var s = sparks.length - 1; s >= 0; s--) {
      var sp = sparks[s];
      sp.t += dt;
      sp.vz -= GRAV * 0.5 * dt;
      sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.z += sp.vz * dt;
      if (sp.t > sp.life) sparks.splice(s, 1);
    }

    for (var t = tracers.length - 1; t >= 0; t--) {
      tracers[t].t += dt;
      if (tracers[t].t > 0.16) tracers.splice(t, 1);
    }

    for (var q = pops.length - 1; q >= 0; q--) {
      pops[q].t += dt;
      if (pops[q].t > pops[q].life) pops.splice(q, 1);
    }

    for (var fi = 0; fi < fonts.length; fi++) {
      var ff = fonts[fi];
      ff.t += dt;
      ff.hit *= Math.max(0, 1 - dt * 3);
    }
    S.fontFlash *= Math.max(0, 1 - dt * 1.8);

    S.comboT -= dt;
    if (S.comboT <= 0 && S.combo) S.combo = 0;
    S.shake *= Math.max(0, 1 - dt * 4.5);
    S.flash *= Math.max(0, 1 - dt * 2.2);
    S.warp *= Math.max(0, 1 - dt * 3.4);
    S.bannerT -= dt;

    // A wave must not be able to stall on one lost orc in a far corner.
    if (!S.spawnQueue.length && orcs.length && orcs.length <= 3) {
      S.laggardT += dt;
      if (S.laggardT > 16) {
        S.laggardT = 0;
        for (var li = 0; li < orcs.length; li++) {
          var lo = orcs[li];
          lo.speed *= 1.35;
          lo.curious = false;
          if (dist2p(lo, player) > 13) {
            var sp2 = World.randomSpawn();
            lo.x = sp2[0]; lo.y = sp2[1];
            spark(lo.x, lo.y, 0.3, 8, 'rgba(143,203,67,0.8)', 1.4);
          }
        }
        S.banner = 'Impatience';
        S.bannerSub = 'The stragglers have picked up the pace.';
        S.bannerT = 1.8;
      }
    } else S.laggardT = 0;

    // wave flow
    if (S.spawnQueue.length) {
      S.spawnT -= dt;
      if (S.spawnT <= 0 && orcs.length < 15) {
        S.spawnT = rand(0.7, 1.5);
        spawnNext();
      }
    } else if (!orcs.length && !player.dead) {
      S.nextWaveT -= dt;
      if (!S.tallied) {
        S.tallied = true;
        // the fonts recover a little, and pay out for surviving
        var kept = 0;
        for (var ti = 0; ti < fonts.length; ti++) {
          if (fonts[ti].dead) continue;
          kept += Math.round(fonts[ti].hp * 0.5);
          fonts[ti].hp = Math.min(fonts[ti].max, fonts[ti].hp + 45);
        }
        if (kept && S.wave) {
          S.score += kept;
          popup(player.x + Math.cos(player.ang) * 2, player.y + Math.sin(player.ang) * 2,
            player.z, 'FONTS HELD  +' + kept, '#e3b23c', 1.1);
        }
      }
      if (S.nextWaveT <= 0) {
        S.nextWaveT = 6.5;
        S.tallied = false;
        startWave();
      }
    }
  }

  /* ── Drawing the world ────────────────────────────────────────────────*/
  function collect() {
    Render.clearFrame();

    for (var d = 0; d < decals.length; d++) {
      Render.addDecal(decals[d].img, decals[d].x, decals[d].y, decals[d].s, decals[d].a);
    }

    // ── the rune fonts, and the light they throw
    for (var fi = 0; fi < fonts.length; fi++) {
      var f = fonts[fi];
      var state = f.dead ? 'dark' : f.hp > 45 ? 'full' : 'hurt';
      Render.addDecal(shadowImg, f.x, f.y, 1.1, f.dead ? 0.35 : 0.5);
      Render.addSprite(Art.font(state), f.x, f.y, 0.5, 0.66, 1.0, 0, 1);
      if (!f.dead) {
        var pulse = 0.75 + Math.sin(f.t * 2.4) * 0.12 + f.hit * 0.5;
        var col = f.hp > 45 ? 'rgba(255,200,90,0.5)' : 'rgba(255,110,60,0.55)';
        Render.addGlow(f.x, f.y, 0.72, 1.5 * pulse, col, 0.8);
        // a column of light so it can be found across the chamber
        Render.addGlow(f.x, f.y, 1.6, 0.9, col, 0.22);
        Render.addGlow(f.x, f.y, 2.6, 0.7, col, 0.12);
        var fl = Art.flame((Math.floor(f.t * 12) % 4));
        Render.addSprite(fl, f.x, f.y, 0.66, 0.26, 0.30, 0, 0.9);
      } else {
        Render.addGlow(f.x, f.y, 0.7, 0.6, 'rgba(60,60,80,0.4)', 0.4);
      }
    }

    // ── ground fire left by fireballs
    for (var gf = 0; gf < flames.length; gf++) {
      var fp = flames[gf];
      var k = clamp(1 - fp.t / fp.life, 0, 1);
      var img = Art.flame((Math.floor(fp.t * 14 + gf) % 4));
      Render.addSprite(img, fp.x, fp.y, fp.s * 0.5 * k, fp.s * k, fp.s * k, 0, 0.9 * k);
      Render.addGlow(fp.x, fp.y, 0.25, fp.s * 2.2 * k, 'rgba(255,140,40,0.6)', 0.7 * k);
    }

    for (var i = 0; i < orcs.length; i++) {
      var o = orcs[i];
      var pose = o.state === 'ragdoll' ? 'flail' : o.state === 'stun' ? 'stun' : o.state === 'attack' ? 'attack' : 'walk';
      Render.addDecal(shadowImg, o.x, o.y, o.w * 1.5, clamp(0.55 - (o.z - o.h / 2) * 0.5, 0.08, 0.55));
      Render.addSprite(Art.orc(o.type, pose, pose === 'walk' ? o.frame : 0), o.x, o.y, o.z, o.w, o.h, o.rot, 1);
      if (S.time - o.portalT < 0.35) {
        Render.addGlow(o.x, o.y, o.z, o.h * 1.1, 'rgba(140,200,255,0.35)', 1 - (S.time - o.portalT) / 0.35);
      }
      if (o.burn > 0) {
        var ff2 = Art.flame((Math.floor(o.t * 15 + i) % 4));
        Render.addSprite(ff2, o.x, o.y, o.z + o.h * 0.45, o.w * 0.9, o.h * 0.95, 0, 0.92);
        Render.addGlow(o.x, o.y, o.z + 0.1, o.h * 1.5, 'rgba(255,140,40,0.55)', 0.75);
      }
    }

    for (var g = 0; g < gibs.length; g++) {
      var p = gibs[g];
      var fade = clamp((p.life - p.t) / 1.2, 0, 1);
      Render.addSprite(p.img, p.x, p.y, p.z, p.s, p.s, p.rot, fade);
    }

    for (var b = 0; b < bolts.length; b++) {
      var bo = bolts[b];
      var col = bo.enemy ? 'rgba(150,230,90,0.85)'
        : bo.banked ? 'rgba(210,180,255,0.95)'
        : bo.fire ? 'rgba(255,150,45,0.95)' : 'rgba(120,200,255,0.9)';
      Render.addGlow(bo.x, bo.y, bo.z, (bo.enemy ? 0.28 : 0.22 + bo.power * 0.16) * (bo.fire ? 1.6 : 1) * (bo.banked ? 1.3 : 1), col, 1);
      if (bo.fire) {
        Render.addSprite(Art.flame((Math.floor(S.time * 18 + b) % 4)), bo.x, bo.y, bo.z, 0.34, 0.38, 0, 0.9);
      }
      for (var tr = 0; tr < bo.trail.length; tr += 3) {
        var a = (tr / bo.trail.length) * 0.5;
        Render.addGlow(bo.trail[tr], bo.trail[tr + 1], bo.trail[tr + 2], 0.1 + a * 0.2, col, a);
      }
    }

    for (var s = 0; s < sparks.length; s++) {
      var sk = sparks[s];
      Render.addGlow(sk.x, sk.y, sk.z, sk.r * 1.5, sk.c, clamp(1 - sk.t / sk.life, 0, 1) * 0.65);
    }

    for (var t = 0; t < tracers.length; t++) {
      var tc = tracers[t], k = 1 - tc.t / 0.16;
      for (var u = 0; u <= 10; u++) {
        var f = u / 10;
        Render.addGlow(
          tc.x0 + (tc.x1 - tc.x0) * f, tc.y0 + (tc.y1 - tc.y0) * f, tc.z0 + (tc.z1 - tc.z0) * f,
          0.1 + f * 0.05, tc.c.glow, k * 0.55);
      }
    }

    // aperture light spilling into the room
    ['blue', 'orange'].forEach(function (key) {
      var p = World.portals[key];
      if (!p) return;
      Render.addGlow(p.cx + p.nx * 0.12, p.cy + p.ny * 0.12, p.z, 0.9, p.color.glow, World.linked() ? 0.5 : 0.3);
    });
  }

  /* ── HUD ──────────────────────────────────────────────────────────────*/
  var proj = {};

  /* A phone is physically small but pixel-dense: sizing the chrome in
     design units there makes it microscopic, so switch to CSS pixels. */
  function uiS() { return touchMode ? K : hudS; }

  function hudFont(size, weight) {
    return (weight || 400) + ' ' + Math.round(size * uiS()) + 'px "IBM Plex Mono", ui-monospace, monospace';
  }
  function dispFont(size, weight) {
    return (weight || 600) + ' ' + Math.round(size * uiS()) + 'px "Grenze Gotisch", Palatino, serif';
  }

  function drawPopups() {
    var kx = view.width / Render.width, ky = view.height / Render.height;
    for (var i = 0; i < pops.length; i++) {
      var p = pops[i];
      var k = p.t / p.life;
      Render.project(player, p.x, p.y, p.z + k * 0.55, proj);
      if (!proj.vis) continue;
      if (Render.depthAt(proj.sx) < proj.tz - 0.3) continue;   // behind a wall
      var a = clamp(1 - Math.pow(k, 2.2), 0, 1);
      var size = clamp(proj.scale * 0.055, 12, 28) * p.size;
      vg.save();
      vg.globalAlpha = a;
      vg.font = dispFont(size, 700);
      vg.textAlign = 'center';
      vg.lineWidth = 4 * uiS();
      vg.strokeStyle = 'rgba(7,6,12,0.85)';
      vg.strokeText(p.text, proj.sx * kx, proj.sy * ky);
      vg.fillStyle = p.color;
      vg.fillText(p.text, proj.sx * kx, proj.sy * ky);
      vg.restore();
    }
  }

  function bar(x, y, w, h, frac, fill, back) {
    vg.fillStyle = back;
    vg.fillRect(x, y, w, h);
    vg.fillStyle = fill;
    vg.fillRect(x, y, w * clamp(frac, 0, 1), h);
    vg.strokeStyle = 'rgba(232,223,200,0.35)';
    vg.lineWidth = Math.max(1, uiS());
    vg.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  /* Each font gets a marker: in view it sits over the font, out of view it
     pins to the edge it lies past, with an arrow. Health is the ring. */
  function drawFontMarkers(W, H, s, inT) {
    var kx = W / Render.width, ky = H / Render.height;
    var top = 104 * s + inT;
    for (var i = 0; i < fonts.length; i++) {
      var f = fonts[i];
      Render.project(player, f.x, f.y, 0.95, proj);
      var x, y = top, behind = !proj.vis || proj.tz <= 0.3;
      if (behind) {
        // which side is it on?
        var dx = f.x - player.x, dy = f.y - player.y;
        var rel = -dx * Math.sin(player.ang) + dy * Math.cos(player.ang);
        x = rel > 0 ? W - 34 * s : 34 * s;
      } else {
        x = clamp(proj.sx * kx, 34 * s, W - 34 * s);
        y = clamp(proj.sy * ky, top, H - 90 * s);
      }
      var r = 15 * s;
      var frac = f.hp / f.max;
      var col = f.dead ? '#6c6579' : frac > 0.45 ? '#e3b23c' : '#b3243a';

      vg.save();
      vg.globalAlpha = f.dead ? 0.5 : 0.92;
      vg.beginPath();
      vg.arc(x, y, r, 0, Math.PI * 2);
      vg.fillStyle = 'rgba(10,9,16,0.62)';
      vg.fill();
      vg.lineWidth = 2 * s;
      vg.strokeStyle = 'rgba(232,223,200,0.28)';
      vg.stroke();
      if (!f.dead) {
        vg.beginPath();
        vg.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        vg.strokeStyle = col;
        vg.lineWidth = 3 * s + f.hit * 3 * s;
        vg.stroke();
      }
      vg.fillStyle = col;
      vg.font = dispFont(15, 700);
      vg.textAlign = 'center';
      vg.textBaseline = 'middle';
      vg.fillText(f.dead ? '×' : f.name[0], x, y + 1 * s);
      vg.textBaseline = 'alphabetic';
      vg.font = hudFont(9);
      vg.fillStyle = f.dead ? '#6c6579' : f.hit > 0.25 ? '#ff8a3c' : '#9d9484';
      vg.fillText(f.dead ? 'OUT' : f.hit > 0.25 ? f.name.toUpperCase() + ' HIT' : Math.round(f.hp) + '',
        x, y + r + 12 * s);
      if (behind) {
        var dir = x < W / 2 ? -1 : 1;
        vg.beginPath();
        vg.moveTo(x + dir * (r + 5 * s), y);
        vg.lineTo(x + dir * (r + 1 * s), y - 5 * s);
        vg.lineTo(x + dir * (r + 1 * s), y + 5 * s);
        vg.closePath();
        vg.fillStyle = col;
        vg.fill();
      }
      vg.restore();
    }
  }

  function drawHUD() {
    var W = view.width, H = view.height, s = uiS();
    var inL = safe.l * K, inR = safe.r * K, inT = safe.t * K, lift = safe.b * K;

    // a scrim so the readouts stay legible against a lit wall
    var top = vg.createLinearGradient(0, 0, 0, 96 * s + inT);
    top.addColorStop(0, 'rgba(7,6,12,0.62)');
    top.addColorStop(1, 'rgba(7,6,12,0)');
    vg.fillStyle = top;
    vg.fillRect(0, 0, W, 96 * s + inT);

    // ── vitality
    vg.save();
    vg.font = hudFont(10);
    vg.fillStyle = '#9d9484';
    vg.textAlign = 'left';
    vg.fillText('V I T A L I T Y', 26 * s + inL, 34 * s + inT);
    var hpc = player.hp > 55 ? '#8fcb43' : player.hp > 25 ? '#e3b23c' : '#b3243a';
    bar(26 * s + inL, 42 * s + inT, 190 * s, 12 * s, player.hp / 100, hpc, 'rgba(20,18,28,0.75)');

    // ── wave + horde
    vg.textAlign = 'center';
    vg.font = dispFont(26, 700);
    vg.fillStyle = '#e8dfc8';
    vg.fillText('Wave ' + Math.max(1, S.wave), W / 2, 40 * s + inT);
    vg.font = hudFont(11);
    vg.fillStyle = '#9d9484';
    var left = orcs.length + S.spawnQueue.length;
    vg.fillText(left ? left + ' ORCS STANDING' : 'CHAMBER CLEAR', W / 2, 58 * s + inT);

    // ── score
    vg.textAlign = 'right';
    vg.font = hudFont(10);
    vg.fillStyle = '#9d9484';
    vg.fillText('S C O R E', W - 26 * s - inR, 34 * s + inT);
    vg.font = hudFont(24, 500);
    vg.fillStyle = '#e3b23c';
    vg.fillText(String(S.score), W - 26 * s - inR, 60 * s + inT);
    if (S.combo > 1) {
      vg.font = dispFont(19, 700);
      vg.fillStyle = '#ff8a3c';
      vg.globalAlpha = clamp(S.comboT / 1.4, 0, 1);
      vg.fillText('×' + S.combo + ' chain', W - 26 * s - inR, 82 * s + inT);
      vg.globalAlpha = 1;
    }
    vg.font = hudFont(10);
    vg.fillStyle = '#6c6579';
    if (!touchMode) vg.fillText(S.splats + ' SPLATS', W - 26 * s - inR, H - 22 * s);

    // ── aperture status (on a phone the thumb buttons already show it)
    var cxp = W / 2, cyp = H - 34 * s - lift;
    if (!touchMode) {
    ['blue', 'orange'].forEach(function (key, i) {
      var p = World.portals[key];
      var col = World.COLORS[key];
      var x = cxp + (i ? 22 : -22) * s;
      vg.save();
      vg.globalAlpha = p ? 1 : 0.3;
      vg.beginPath();
      vg.ellipse(x, cyp, 9 * s, 12 * s, 0, 0, Math.PI * 2);
      vg.fillStyle = p ? col.deep : 'rgba(20,18,28,0.7)';
      vg.fill();
      vg.lineWidth = 2 * s;
      vg.strokeStyle = col.bright;
      vg.stroke();
      vg.restore();
    });
    vg.textAlign = 'center';
    vg.font = hudFont(9);
    vg.fillStyle = World.linked() ? '#8fcb43' : '#6c6579';
    vg.fillText(World.linked() ? 'LINKED' : 'OPEN BOTH TO LINK', cxp, H - 12 * s - lift);
    }

    // ── font trackers: where they are, how they are holding up
    drawFontMarkers(W, H, s, inT);

    // ── crosshair rune
    var ch = 12 * s * (1 + hand.charge * 0.7);
    vg.save();
    vg.translate(W / 2, H / 2);
    vg.rotate(S.time * 0.6 + hand.charge * 3);
    vg.strokeStyle = 'rgba(227,178,60,' + (0.5 + hand.charge * 0.5) + ')';
    vg.lineWidth = 1.4 * s;
    vg.beginPath();
    vg.arc(0, 0, ch, 0, Math.PI * 2);
    vg.stroke();
    for (var i2 = 0; i2 < 4; i2++) {
      var a = i2 / 4 * Math.PI * 2;
      vg.beginPath();
      vg.moveTo(Math.cos(a) * ch * 1.35, Math.sin(a) * ch * 1.35);
      vg.lineTo(Math.cos(a) * ch * 1.9, Math.sin(a) * ch * 1.9);
      vg.stroke();
    }
    vg.restore();
    vg.fillStyle = 'rgba(232,223,200,0.9)';
    vg.fillRect(W / 2 - 1 * s, H / 2 - 1 * s, 2 * s, 2 * s);

    // ── wave banner
    if (S.bannerT > 0) {
      var a2 = clamp(S.bannerT / 0.8, 0, 1) * clamp((2.6 - S.bannerT) / 0.4, 0, 1);
      vg.save();
      vg.globalAlpha = a2;
      vg.textAlign = 'center';
      vg.font = dispFont(touchMode ? 40 : 58, 700);
      vg.fillStyle = '#e8dfc8';
      vg.shadowColor = 'rgba(255,138,60,0.55)';
      vg.shadowBlur = 24 * s;
      vg.fillText(S.banner, W / 2, H * 0.34);
      vg.shadowBlur = 0;
      vg.font = hudFont(12);
      vg.fillStyle = '#e3b23c';
      vg.fillText(S.bannerSub, W / 2, H * 0.34 + 26 * s);
      vg.restore();
    }
    vg.restore();
    if (touchMode) drawTouchUI();
  }

  /* ── Thumb controls, drawn ────────────────────────────────────────────*/
  function ctlRing(x, y, r, alpha, col) {
    vg.beginPath();
    vg.arc(x, y, r, 0, Math.PI * 2);
    vg.fillStyle = 'rgba(10,9,16,' + (0.24 + alpha * 0.30).toFixed(3) + ')';
    vg.fill();
    vg.lineWidth = Math.max(1.2, 2 * K);
    vg.strokeStyle = col;
    vg.globalAlpha = 0.38 + alpha * 0.6;
    vg.stroke();
    vg.globalAlpha = 1;
  }

  function drawTouchUI() {
    var u = layout();
    var g = vg;
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // ── movement stick
    var sx = (stick.on ? stick.cx : u.home.x) * K;
    var sy = (stick.on ? stick.cy : u.home.y) * K;
    var sr = u.sr * K;
    g.globalAlpha = stick.on ? 0.85 : 0.4;
    ctlRing(sx, sy, sr, stick.on ? 0.5 : 0, 'rgba(232,223,200,0.6)');
    var kx = sx, ky = sy;
    if (stick.on) {
      var dx = stick.kx * K - sx, dy = stick.ky * K - sy;
      var len = Math.hypot(dx, dy), reach = sr * 0.78;
      if (len > reach) { dx *= reach / len; dy *= reach / len; }
      kx += dx; ky += dy;
    }
    g.beginPath();
    g.arc(kx, ky, sr * 0.38, 0, Math.PI * 2);
    g.fillStyle = 'rgba(227,178,60,' + (stick.on ? 0.5 : 0.26) + ')';
    g.fill();
    g.lineWidth = Math.max(1.2, 2 * K);
    g.strokeStyle = 'rgba(232,223,200,' + (stick.on ? 0.85 : 0.45) + ')';
    g.stroke();
    g.globalAlpha = 1;

    // ── cast: a rune circle with the pointing finger, and a charge arc
    var c = u.cast, cr = c.r * K;
    ctlRing(c.x * K, c.y * K, cr, press.cast, 'rgba(140,220,255,0.75)');
    g.save();
    g.translate(c.x * K, c.y * K);
    var skin = 'rgba(216,160,113,' + (0.6 + press.cast * 0.35) + ')';
    var ink = 'rgba(16,12,22,0.55)';
    g.lineWidth = 1.6 * K;
    // a small pointing hand: fist, finger, lit tip
    g.beginPath();
    g.arc(cr * 0.14, cr * 0.30, cr * 0.30, 0, Math.PI * 2);
    g.fillStyle = skin; g.fill();
    g.strokeStyle = ink; g.stroke();
    Art.capsule(g, cr * 0.06, cr * 0.20, -cr * 0.22, -cr * 0.40, cr * 0.14, cr * 0.11);
    g.fillStyle = skin; g.fill();
    g.strokeStyle = ink; g.stroke();
    g.beginPath();
    g.arc(-cr * 0.24, -cr * 0.44, cr * 0.15 * (1 + hand.charge * 0.5), 0, Math.PI * 2);
    g.fillStyle = 'rgba(160,225,255,' + (0.6 + hand.charge * 0.4) + ')';
    g.fill();
    g.restore();

    if (hand.charge > 0.02) {
      g.beginPath();
      g.arc(c.x * K, c.y * K, cr * 1.16, -Math.PI / 2, -Math.PI / 2 + hand.charge * Math.PI * 2);
      g.strokeStyle = '#8fe3ff';
      g.lineWidth = 3.4 * K;
      g.stroke();
    }

    // ── aperture buttons
    [['blue', u.blue], ['orange', u.orange]].forEach(function (pair) {
      var key = pair[0], b = pair[1], col = World.COLORS[key];
      var bx = b.x * K, by = b.y * K, br = b.r * K;
      ctlRing(bx, by, br, press[key], col.bright);
      g.beginPath();
      g.ellipse(bx, by, br * 0.42, br * 0.56, 0, 0, Math.PI * 2);
      g.fillStyle = World.portals[key] ? col.deep : 'rgba(20,18,28,0.6)';
      g.fill();
      g.lineWidth = Math.max(1.4, 2.4 * K);
      g.strokeStyle = col.bright;
      g.globalAlpha = World.portals[key] ? 1 : 0.6;
      g.stroke();
      g.globalAlpha = 1;
      if (World.linked()) {
        g.beginPath();
        g.arc(bx, by, br * 1.2, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(227,178,60,0.7)';
        g.lineWidth = 1.6 * K;
        g.stroke();
      }
    });

    // ── jump
    var j = u.jump, jx = j.x * K, jy = j.y * K, jr = j.r * K;
    ctlRing(jx, jy, jr, press.jump, 'rgba(232,223,200,0.6)');
    g.beginPath();
    g.moveTo(jx - jr * 0.36, jy + jr * 0.18);
    g.lineTo(jx, jy - jr * 0.30);
    g.lineTo(jx + jr * 0.36, jy + jr * 0.18);
    g.strokeStyle = 'rgba(232,223,200,0.8)';
    g.lineWidth = 3 * K;
    g.stroke();

    g.restore();
  }

  function drawOverlays() {
    var W = view.width, H = view.height;
    if (S.flash > 0.01) {
      var g = vg.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(179,36,58,0)');
      g.addColorStop(1, 'rgba(179,36,58,' + (0.72 * S.flash).toFixed(3) + ')');
      vg.fillStyle = g;
      vg.fillRect(0, 0, W, H);
    }
    if (S.warp > 0.01) {
      vg.fillStyle = 'rgba(150,215,255,' + (0.3 * S.warp).toFixed(3) + ')';
      vg.fillRect(0, 0, W, H);
    }
    if (S.fontFlash > 0.01) {
      var fg = vg.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
      fg.addColorStop(0, 'rgba(227,178,60,0)');
      fg.addColorStop(1, 'rgba(227,110,40,' + (0.4 * S.fontFlash).toFixed(3) + ')');
      vg.fillStyle = fg;
      vg.fillRect(0, 0, W, H);
    }
    // chamber vignette
    var v = vg.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.92);
    v.addColorStop(0, 'rgba(7,6,12,0)');
    v.addColorStop(1, 'rgba(7,6,12,0.72)');
    vg.fillStyle = v;
    vg.fillRect(0, 0, W, H);
  }

  function cam() { return player; }

  var show = { scene: true, hands: true, hud: true, pops: true };

  function draw() {
    collect();
    var scene = Render.frame(player, S.time);
    if (!show.scene) {
      vg.setTransform(1, 0, 0, 1, 0, 0);
      vg.fillStyle = '#101018';
      vg.fillRect(0, 0, view.width, view.height);
    }
    var over = 6 + S.shake * 26 * hudS;
    var sx = (Math.random() - 0.5) * S.shake * 24 * hudS;
    var sy = (Math.random() - 0.5) * S.shake * 24 * hudS;
    if (show.scene) {
      vg.setTransform(1, 0, 0, 1, 0, 0);
      vg.clearRect(0, 0, view.width, view.height);
      vg.drawImage(scene, sx - over, sy - over, view.width + over * 2, view.height + over * 2);
    }

    if (show.pops) drawPopups();
    drawOverlays();

    if (show.hands) {
      var offX = touchMode ? view.width * 0.11 : 0;
      var offY = touchMode ? view.height * 0.05 : 0;
      Art.drawPortalHand(vg, view.width, view.height, {
        time: S.time, flare: hand.flare, color: World.COLORS[S.nextHue],
        dx: offX, dy: offY
      });
      Art.drawCastHand(vg, view.width, view.height, {
        time: S.time, recoil: hand.recoil, charge: hand.charge,
        dx: -offX, dy: offY
      });
    }

    if (show.hud) drawHUD();
  }

  /* ── Loop ─────────────────────────────────────────────────────────────*/
  var last = 0, acc = 0, frames = 0, quality = 2;

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!last) last = ts;
    var dt = Math.min(0.045, Math.max(0.0008, (ts - last) / 1000));
    last = ts;
    if (!S.running || S.paused) return;

    update(dt);
    draw();

    // keep the recursion budget honest on slower machines
    acc += dt; frames++;
    if (acc > 1.2) {
      var fps = frames / acc;
      acc = 0; frames = 0;
      if (fps < 32 && quality > 0) { quality--; applyQuality(); }
      else if (fps > 54 && quality < 3) { quality++; applyQuality(); }
    }
  }

  /* ── Input ────────────────────────────────────────────────────────────*/
  var move = { x: 0, y: 0, jump: false };
  var locked = false, dragging = false;

  function look(dx) { player.ang += dx * 0.0022; }

  document.addEventListener('keydown', function (e) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
    keys[e.code] = true;
    if (!S.running) return;
    if (e.code === 'KeyQ') firePortal('blue');
    if (e.code === 'KeyE') firePortal('orange');
    if (e.code === 'KeyR') { World.clear(); Sfx.fizzle(); }
    if (e.code === 'KeyM') { S.muted = !S.muted; Sfx.setMuted(S.muted); }
  });
  document.addEventListener('keyup', function (e) { keys[e.code] = false; });

  view.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  view.addEventListener('mousedown', function (e) {
    if (!S.running || touchMode) return;
    e.preventDefault();
    if (!locked && view.requestPointerLock) {
      try {
        var pl = view.requestPointerLock();
        if (pl && pl.catch) pl.catch(function () { /* sandboxed: drag to look instead */ });
      } catch (err) { /* ignore */ }
    }
    if (e.button === 0) { hand.charging = true; hand.charge = 0; }
    else if (e.button === 2) firePortal(S.nextHue);
    dragging = true;
  });

  window.addEventListener('mouseup', function (e) {
    if (touchMode) return;
    if (e.button === 0 && hand.charging) {
      hand.charging = false;
      if (S.running && hand.cool <= 0) {
        hand.cool = 0.16;
        castBolt(hand.charge);
      }
      hand.charge = 0;
    }
    dragging = false;
  });

  document.addEventListener('pointerlockchange', function () {
    locked = document.pointerLockElement === view;
  });

  window.addEventListener('mousemove', function (e) {
    if (!S.running || touchMode) return;
    if (locked || dragging) look(e.movementX || 0);
  });

  /* ── Thumb controls ───────────────────────────────────────────────────
     Laid out in CSS pixels inside the canvas box, inset past the notch and
     the home indicator, then drawn on the canvas at device scale.        */
  var ui = null;

  function layout() {
    var w = dispW, h = dispH, m = 16;
    var sr = clamp(h * 0.19, 52, 78);          // stick radius
    var br = clamp(h * 0.105, 32, 44);         // cast button radius
    var pr = br * 0.62;                        // secondary buttons
    var L = safe.l + m, R = w - safe.r - m, B = h - safe.b - m;
    var cx = R - br, cy = B - br;
    ui = {
      sr: sr, br: br, pr: pr,
      home: { x: L + sr, y: B - sr },
      cast: { x: cx, y: cy, r: br, key: 'cast' },
      blue: { x: cx - br * 2.30, y: cy - br * 0.15, r: pr, key: 'blue' },
      jump: { x: cx - br * 1.85, y: cy - br * 1.85, r: pr, key: 'jump' },
      orange: { x: cx - br * 0.20, y: cy - br * 2.35, r: pr, key: 'orange' }
    };
    return ui;
  }

  var stick = { on: false, cx: 0, cy: 0, kx: 0, ky: 0 };
  var press = { cast: 0, blue: 0, orange: 0, jump: 0 };
  var pointers = {};

  function localPos(t) {
    var r = view.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  function hitButton(p) {
    var u = layout();
    var list = [u.cast, u.blue, u.orange, u.jump];
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.35) return b;
    }
    return null;
  }

  function onTouchStart(e) {
    goTouch();
    Sfx.resume();
    if (!S.running || S.paused) return;
    e.preventDefault();
    var u = layout();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i], p = localPos(t);
      var b = hitButton(p);
      if (b) {
        pointers[t.identifier] = { role: b.key };
        press[b.key] = 1;
        if (b.key === 'cast') { hand.charging = true; hand.charge = 0; }
        else if (b.key === 'jump') move.jump = true;
        else firePortal(b.key);
        continue;
      }
      // left half, lower two thirds: the stick springs up under the thumb
      if (!stick.on && p.x < dispW * 0.46 && p.y > dispH * 0.26) {
        stick.on = true;
        stick.cx = clamp(p.x, u.sr * 0.7, dispW * 0.5);
        stick.cy = clamp(p.y, u.sr * 0.7, dispH - u.sr * 0.5);
        stick.kx = p.x; stick.ky = p.y;
        pointers[t.identifier] = { role: 'stick' };
        continue;
      }
      pointers[t.identifier] = { role: 'look', x: p.x, y: p.y, moved: 0, t: performance.now() };
    }
  }

  function onTouchMove(e) {
    if (!S.running || S.paused) return;
    e.preventDefault();
    var u = ui || layout();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i], q = pointers[t.identifier];
      if (!q) continue;
      var p = localPos(t);
      if (q.role === 'stick') {
        stick.kx = p.x; stick.ky = p.y;
        var dx = p.x - stick.cx, dy = p.y - stick.cy;
        var len = Math.hypot(dx, dy), reach = u.sr * 0.78;
        var f = len > reach ? reach / len : 1;
        move.x = clamp((dx * f) / reach, -1, 1);
        move.y = clamp((-dy * f) / reach, -1, 1);
      } else if (q.role === 'look') {
        look((p.x - q.x) * 1.25);
        q.moved += Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
        q.x = p.x; q.y = p.y;
      }
    }
  }

  function onTouchEnd(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i], q = pointers[t.identifier];
      if (!q) continue;
      delete pointers[t.identifier];

      if (q.role === 'stick') {
        stick.on = false; move.x = 0; move.y = 0;
      } else if (q.role === 'cast') {
        press.cast = 0;
        hand.charging = false;
        if (S.running && hand.cool <= 0) { hand.cool = 0.16; castBolt(hand.charge); }
        hand.charge = 0;
      } else if (q.role === 'look') {
        // a tap that did not turn the view is a quick bolt
        if (q.moved < 14 && performance.now() - q.t < 320 && S.running && hand.cool <= 0) {
          hand.cool = 0.16;
          castBolt(0.15);
        }
      } else if (q.role) {
        press[q.role] = 0;
      }
    }
  }

  view.addEventListener('touchstart', onTouchStart, { passive: false });
  view.addEventListener('touchmove', onTouchMove, { passive: false });
  view.addEventListener('touchend', onTouchEnd);
  view.addEventListener('touchcancel', onTouchEnd);

  /* ── Lifecycle ────────────────────────────────────────────────────────*/
  function reset() {
    orcs.length = 0; bolts.length = 0; gibs.length = 0;
    pops.length = 0; decals.length = 0; sparks.length = 0; tracers.length = 0;
    World.clear();
    resetFonts();
    flames.length = 0;
    player.x = 27.6; player.y = 21.6; player.z = EYE;
    player.vx = player.vy = player.vz = 0;
    player.ang = -1.95;
    player.hp = 100; player.dead = false; player.hurtT = 99;
    S.score = 0; S.wave = 0; S.splats = 0; S.combo = 0;
    S.time = 0; S.nextWaveT = 1.2; S.spawnQueue = [];
    S.flash = 0; S.shake = 0; S.warp = 0; S.over = false;
    S.laggardT = 0; S.nextHue = 'blue'; S.fontFlash = 0; S.tallied = true;
    hand.charge = 0; hand.charging = false;
    move.x = 0; move.y = 0; move.jump = false;
    stick.on = false;
    press.cast = press.blue = press.orange = press.jump = 0;
    pointers = {};

    // The chamber opens with the pair already cut where it matters: one in
    // the wall behind Dawn, one in the wall behind Vesper. Walk into either
    // and you are at the other font. That is the whole game in one step —
    // and the player is free to re-cut them anywhere better.
    World.place('blue', { hit: true, tileV: World.PANEL, mapX: 5, mapY: 6, nx: 0, ny: -1, x: 5.5, y: 6 }, 0);
    World.place('orange', { hit: true, tileV: World.PANEL, mapX: 26, mapY: 17, nx: 0, ny: 1, x: 26.5, y: 18 }, 0);
  }

  function begin() {
    reset();
    startSign.hidden = true;
    deathSign.hidden = true;
    S.running = true;
    last = 0;
    Sfx.resume();
    checkOrientation();
    startWave();
  }

  function endGame(reason) {
    if (!S.running) return;
    player.dead = reason !== 'fonts';
    if (reason === 'fonts') { S.paused = false; } else { player.hp = 0; }
    draw();                       // one last frame, with the bar at empty
    S.running = false;
    S.over = true;
    Sfx.death();
    if (document.exitPointerLock) document.exitPointerLock();
    S.paused = false;
    var rot = document.getElementById('rotateSign');
    if (rot) rot.hidden = true;
    document.getElementById('finalScore').textContent = String(S.score);
    document.getElementById('finalWave').textContent = String(S.wave);
    document.getElementById('finalSplats').textContent = String(S.splats);
    document.getElementById('deathLine').textContent =
      reason === 'fonts' ? pick(DARK) : pick(DEATHS);
    document.querySelector('#deathSign h1').textContent =
      reason === 'fonts' ? 'The Chamber Goes Dark' : 'The Horde Wins';
    deathSign.hidden = false;
  }

  var anyway = document.getElementById('anywayBtn');
  if (anyway) {
    anyway.addEventListener('click', function (e) {
      e.stopPropagation();
      ignorePortrait = true;
      checkOrientation();
    });
  }

  startSign.addEventListener('click', begin);
  deathSign.addEventListener('click', begin);
  document.getElementById('startBtn').addEventListener('click', begin);
  document.getElementById('againBtn').addEventListener('click', begin);

  // A small hatch into the chamber, for tuning and for testing.
  window.Demo = {
    player: player, orcs: orcs, state: S, hand: hand, show: show,
    fonts: fonts, bolts: bolts, flames: flames,
    cast: function (p) { castBolt(p); },
    ignite: function (o, t) { ignite(o, t || 4); },
    spawn: function (type, dx, dy) {
      var o = makeOrc(type || 'grunt', player.x + dx, player.y + dy);
      orcs.push(o);
      return o;
    },
    fling: function (o, f) {
      shove(o, rand(-1, 1) * f, rand(-1, 1) * f, f * 0.6, 0);
    },
    kill: function () { hurtPlayer(999, 0, 0); },
    quality: function () { return quality; },
    touch: function () { return touchMode; }
  };

  resize();
  reset();
  requestAnimationFrame(loop);

  // A slow pan around the chamber behind the start card.
  (function preview() {
    if (S.running) return;
    S.time += 0.016;
    player.ang += 0.0032;
    collect();
    var scene = Render.frame(player, S.time);
    vg.setTransform(1, 0, 0, 1, 0, 0);
    vg.drawImage(scene, 0, 0, view.width, view.height);
    drawOverlays();
    requestAnimationFrame(preview);
  })();

})();
