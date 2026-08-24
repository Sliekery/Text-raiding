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

  var KIND = {
    grunt:  { h: 0.62, hp: 3, speed: 1.75, mass: 1.0,  dmg: 7,  voice: 1.0,  score: 100 },
    goblin: { h: 0.44, hp: 2, speed: 2.75, mass: 0.55, dmg: 4,  voice: 1.55, score: 120 },
    brute:  { h: 0.94, hp: 7, speed: 1.15, mass: 2.6,  dmg: 15, voice: 0.62, score: 220 },
    shaman: { h: 0.66, hp: 3, speed: 1.35, mass: 0.9,  dmg: 9,  voice: 1.2,  score: 180 }
  };

  var SPLATS = ['SPLORCH!', 'KERSPLAT!', 'GRONK!', 'THWUMP!', 'SQUELCH!', 'YEET!', 'BONK!', 'OOF!'];
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

  var orcs = [], bolts = [], gibs = [], pops = [], decals = [], tracers = [], sparks = [];
  var S = {
    running: false, over: false, time: 0, score: 0, wave: 0, splats: 0,
    combo: 0, comboT: 0, banner: '', bannerSub: '', bannerT: 0,
    nextWaveT: 0, spawnQueue: [], spawnT: 0, shake: 0, flash: 0, warp: 0,
    nextHue: 'blue', muted: false
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

  /* ── Sizing ───────────────────────────────────────────────────────────*/
  var dispW = 960, dispH = 600, hudS = 1;

  function resize() {
    var pad = window.innerWidth < 700 ? 0 : 32;
    var availW = window.innerWidth - pad, availH = window.innerHeight - pad;
    var w = Math.min(availW, 1180), h = w / 1.6;
    if (h > availH) { h = availH; w = h * 1.6; }
    dispW = Math.round(w); dispH = Math.round(h);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    view.width = Math.round(dispW * dpr);
    view.height = Math.round(dispH * dpr);
    view.style.width = dispW + 'px';
    view.style.height = dispH + 'px';
    frameEl.style.width = dispW + 'px';
    frameEl.style.height = dispH + 'px';
    hudS = view.height / 600;
    vg.imageSmoothingEnabled = false;
    var rh = 300, rw = Math.round(rh * (view.width / view.height));
    Render.setSize(rw, rh);
  }
  window.addEventListener('resize', resize);

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
    pops.push({ x: x, y: y, z: z, text: text, color: color, t: 0, life: 1.5, size: size || 1 });
    if (pops.length > 24) pops.shift();
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
      settle: 0, stunT: 0, atkT: 0, castT: rand(1, 4),
      portalT: -99, curious: Math.random() < 0.32, voice: KIND[type].voice * rand(0.92, 1.08),
      gruntT: rand(1, 5), face: 0
    };
  }

  function waveComp(n) {
    var list = [];
    var count = Math.min(17, 3 + Math.round(n * 1.7));
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
    S.banner = 'Wave ' + S.wave;
    S.bannerSub = S.wave === 1 ? 'They are not here to test.' :
      S.wave === 3 ? 'Something heavier is coming.' :
      S.wave === 5 ? 'The shamans have opinions.' :
      pick(['The horde thickens.', 'More volunteers.', 'Subjects incoming.', 'Fresh test material.']);
    S.bannerT = 2.6;
    Sfx.horn();
  }

  function spawnNext() {
    var type = S.spawnQueue.shift();
    if (!type) return;
    var best = null, bestD = -1;
    for (var i = 0; i < 6; i++) {
      var p = World.randomSpawn();
      var d = Math.hypot(p[0] - player.x, p[1] - player.y);
      if (d > bestD) { bestD = d; best = p; }
    }
    var o = makeOrc(type, best[0] + rand(-0.3, 0.3), best[1] + rand(-0.3, 0.3));
    orcs.push(o);
    spark(o.x, o.y, 0.25, 12, 'rgba(143,203,67,0.8)', 1.6);
    Sfx.grunt(Math.hypot(o.x - player.x, o.y - player.y), o.voice, false);
  }

  /* ── Casting ──────────────────────────────────────────────────────────*/
  function castBolt(power) {
    var dx = Math.cos(player.ang), dy = Math.sin(player.ang);
    bolts.push({
      x: player.x + dx * 0.35, y: player.y + dy * 0.35, z: player.z - 0.03,
      vx: dx * 27, vy: dy * 27, vz: 0.4,
      power: power, t: 0, trail: []
    });
    hand.recoil = 1;
    S.shake = Math.max(S.shake, 0.25 + power * 0.5);
    Sfx.zap(power);
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
  function shove(o, ix, iy, iz, dmg) {
    o.state = 'ragdoll';
    o.settle = 0;
    o.stunT = 0;
    o.vx += ix / o.mass;
    o.vy += iy / o.mass;
    o.vz += iz / o.mass;
    o.spin = clamp((o.vx + o.vy) * 0.9 + rand(-4, 4), -13, 13);
    if (dmg) o.hp -= dmg;
    if (Math.random() < 0.5) Sfx.grunt(dist2p(o, player), o.voice, true);
  }

  function dist2p(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function gib(o, speedy) {
    var d = dist2p(o, player);
    Sfx.splat(d, speedy);
    S.splats++;
    var portalled = (S.time - o.portalT) < 3.2;

    var base = KIND[o.type].score;
    S.combo++;
    S.comboT = 3.0;
    var pts = Math.round(base * (portalled ? 2.5 : 1) * (1 + (S.combo - 1) * 0.35));
    S.score += pts;
    Sfx.chime(S.combo);

    var label = portalled ? 'PORTAL SPLAT' : pick(SPLATS);
    popup(o.x, o.y, o.z + 0.35, label + '  +' + pts, portalled ? '#8fe3ff' : '#e3b23c', portalled ? 1.25 : 1);
    if (S.combo > 1) popup(o.x, o.y, o.z + 0.62, '×' + S.combo + ' chain', '#ff8a3c', 0.85);

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
    spark(o.x, o.y, o.z, 14, 'rgba(143,203,67,0.75)', 2.4);
    addSplatDecal(o.x, o.y, o.type);
    S.shake = Math.max(S.shake, 0.4);
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
      Sfx.whoosh(dist2p(b, player));
      spark(b.x, b.y, b.z, 6, went.color.glow, 1.2);
      impact = 0;
    }
    return impact;
  }

  /* ── Orc brains ───────────────────────────────────────────────────────*/
  function updateOrc(o, dt) {
    o.t += dt;

    if (o.state === 'walk' || o.state === 'attack') {
      var dx = player.x - o.x, dy = player.y - o.y;
      var d = Math.hypot(dx, dy) || 1;
      var tx = dx / d, ty = dy / d;

      // Curious orcs make straight for an open aperture. It never ends well.
      if (o.curious && World.linked()) {
        o.targetT = (o.targetT || 0) - dt;
        if (o.targetT <= 0) { o.targetKey = Math.random() < 0.5 ? 'blue' : 'orange'; o.targetT = rand(3, 6); }
        var target = World.portals[o.targetKey || 'blue'];
        if (target) {
          var ax = target.cx + target.nx * 0.45 - o.x;
          var ay = target.cy + target.ny * 0.45 - o.y;
          var ad = Math.hypot(ax, ay);
          if (ad < 6.5 && World.clearPath(o.x, o.y, target.cx + target.nx * 0.3, target.cy + target.ny * 0.3)) {
            tx = ax / (ad || 1); ty = ay / (ad || 1);
            if (ad < 0.7 && Math.random() < 0.1) popup(o.x, o.y, o.z + 0.4, 'ooooh', '#8fe3ff', 0.7);
          }
        }
      }

      o.face = Math.atan2(ty, tx);
      var spd = o.speed;

      if (o.state === 'attack') {
        o.atkT -= dt;
        spd *= 0.25;
        if (o.atkT <= 0) {
          if (d < 1.15) hurtPlayer(KIND[o.type].dmg, tx, ty);
          o.state = 'walk';
          o.atkT = 0;
        }
      } else if (d < 0.95 && Math.abs(o.z - EYE) < 0.9) {
        o.state = 'attack';
        o.atkT = 0.42;
        Sfx.grunt(d, o.voice, true);
      }

      // shamans lob goo from range
      if (o.type === 'shaman') {
        o.castT -= dt;
        if (o.castT <= 0 && d > 2 && d < 12 && World.clearPath(o.x, o.y, player.x, player.y)) {
          o.castT = rand(2.6, 4.4);
          var vz = 1.6 + d * 0.16;
          bolts.push({
            x: o.x + tx * 0.3, y: o.y + ty * 0.3, z: o.z + 0.25,
            vx: tx * 7.4, vy: ty * 7.4, vz: vz, enemy: true, power: 0, t: 0, trail: []
          });
          Sfx.grunt(d, o.voice * 0.85, true);
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
        if (Math.random() < 0.4) popup(o.x, o.y, o.z + 0.4, pick(['wheee', 'wot', '?!', 'nooo']), '#ffc48a', 0.75);
      }
      o.rot *= 0.8;
      o.frame = (Math.floor(o.t * o.speed * 4.4) % 4);

      o.gruntT -= dt;
      if (o.gruntT <= 0) {
        o.gruntT = rand(3, 8);
        if (d < 14) Sfx.grunt(d, o.voice, false);
      }

    } else if (o.state === 'ragdoll') {
      var imp = stepBody(o, dt, 0.46, 0.66);
      o.rot += o.spin * dt;
      o.spin *= (1 - dt * 0.7);
      if (imp > SPLAT_V) {
        gib(o, imp / SPLAT_V);
        o.dead = true;
        return;
      } else if (imp > HURT_V) {
        o.hp -= (imp - HURT_V) * 0.9;
        Sfx.thud(dist2p(o, player));
        if (o.hp <= 0) { gib(o, 1); o.dead = true; return; }
      }
      var sp = Math.hypot(o.vx, o.vy, o.vz);
      if (o.onGround && sp < 1.0) {
        o.settle += dt;
        if (o.settle > 0.45) {
          if (o.hp <= 0) { gib(o, 0.8); o.dead = true; return; }
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
            if (Math.hypot(b.x - o.x, b.y - o.y) < o.r + 0.1 && Math.abs(b.z - o.z) < o.h * 0.55) { hit = o; break; }
          }
        }
        var t2 = World.transfer(b, px, py, pz);
        if (t2) { b.portalT = S.time; Sfx.whoosh(dist2p(b, player)); }
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
    var R = 1.25 + b.power * 1.15;
    var force = 11 + b.power * 15;
    spark(b.x, b.y, b.z, 12 + (b.power * 14) | 0, 'rgba(140,220,255,0.85)', 2 + b.power * 2);
    Sfx.thud(dist2p(b, player));
    S.shake = Math.max(S.shake, 0.2 + b.power * 0.35);

    for (var i = 0; i < orcs.length; i++) {
      var o = orcs[i];
      if (o.dead) continue;
      var dx = o.x - b.x, dy = o.y - b.y, dz = o.z - b.z;
      var d = Math.hypot(dx, dy, dz);
      if (d > R + o.r) continue;
      var fall = 1 - clamp((d - o.r) / R, 0, 1);
      var nx = (dx || rand(-1, 1)) / (d || 1), ny = (dy || rand(-1, 1)) / (d || 1);
      var f = force * (0.45 + fall * 0.75) * (o === direct ? 1.35 : 1);
      shove(o, nx * f, ny * f, 3.4 + fall * 3.6 + b.power * 3, 1 + b.power * 1.6);
      if (o === direct) popup(o.x, o.y, o.z + 0.45, pick(['WHOMP', 'SHOVE', 'AWAY!']), '#8fe3ff', 0.8);
    }

    // the caster feels it too, at close range
    var pd = Math.hypot(player.x - b.x, player.y - b.y);
    if (pd < 1.5) {
      var pf = (1 - pd / 1.5) * (2.6 + b.power * 4);
      var ax = (player.x - b.x) / (pd || 1), ay = (player.y - b.y) / (pd || 1);
      player.vx += ax * pf; player.vy += ay * pf; player.vz += 1.6 + b.power * 1.4;
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
    if (touch.mx || touch.my) {
      fx += ca * touch.my - sa * touch.mx;
      fy += sa * touch.my + ca * touch.mx;
    }

    var len = Math.hypot(fx, fy);
    var sprint = (keys['ShiftLeft'] || keys['ShiftRight']) ? 1.55 : 1;
    var target = 3.1 * sprint;
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

    if ((keys['Space'] || touch.jump) && grounded) {
      player.vz = 4.4;
      player.onGround = false;
      touch.jump = false;
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
    if (hand.charging) hand.charge = Math.min(1, hand.charge + dt / 0.9);

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
      if (S.spawnT <= 0 && orcs.length < 18) {
        S.spawnT = rand(0.35, 0.9);
        spawnNext();
      }
    } else if (!orcs.length && !player.dead) {
      S.nextWaveT -= dt;
      if (S.nextWaveT <= 0) {
        S.nextWaveT = 4.5;
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

    for (var i = 0; i < orcs.length; i++) {
      var o = orcs[i];
      var pose = o.state === 'ragdoll' ? 'flail' : o.state === 'stun' ? 'stun' : o.state === 'attack' ? 'attack' : 'walk';
      Render.addDecal(shadowImg, o.x, o.y, o.w * 1.5, clamp(0.55 - (o.z - o.h / 2) * 0.5, 0.08, 0.55));
      Render.addSprite(Art.orc(o.type, pose, pose === 'walk' ? o.frame : 0), o.x, o.y, o.z, o.w, o.h, o.rot, 1);
      if (S.time - o.portalT < 0.35) {
        Render.addGlow(o.x, o.y, o.z, o.h * 1.1, 'rgba(140,200,255,0.35)', 1 - (S.time - o.portalT) / 0.35);
      }
    }

    for (var g = 0; g < gibs.length; g++) {
      var p = gibs[g];
      var fade = clamp((p.life - p.t) / 1.2, 0, 1);
      Render.addSprite(p.img, p.x, p.y, p.z, p.s, p.s, p.rot, fade);
    }

    for (var b = 0; b < bolts.length; b++) {
      var bo = bolts[b];
      var col = bo.enemy ? 'rgba(150,230,90,0.85)' : 'rgba(120,200,255,0.9)';
      Render.addGlow(bo.x, bo.y, bo.z, bo.enemy ? 0.28 : 0.22 + bo.power * 0.16, col, 1);
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

  function hudFont(size, weight) {
    return (weight || 400) + ' ' + Math.round(size * hudS) + 'px "IBM Plex Mono", ui-monospace, monospace';
  }
  function dispFont(size, weight) {
    return (weight || 600) + ' ' + Math.round(size * hudS) + 'px "Grenze Gotisch", Palatino, serif';
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
      vg.lineWidth = 4 * hudS;
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
    vg.lineWidth = Math.max(1, hudS);
    vg.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  function drawHUD() {
    var W = view.width, H = view.height, s = hudS;

    // a scrim so the readouts stay legible against a lit wall
    var top = vg.createLinearGradient(0, 0, 0, 96 * s);
    top.addColorStop(0, 'rgba(7,6,12,0.62)');
    top.addColorStop(1, 'rgba(7,6,12,0)');
    vg.fillStyle = top;
    vg.fillRect(0, 0, W, 96 * s);

    // ── vitality
    vg.save();
    vg.font = hudFont(10);
    vg.fillStyle = '#9d9484';
    vg.textAlign = 'left';
    vg.fillText('V I T A L I T Y', 26 * s, 34 * s);
    var hpc = player.hp > 55 ? '#8fcb43' : player.hp > 25 ? '#e3b23c' : '#b3243a';
    bar(26 * s, 42 * s, 190 * s, 12 * s, player.hp / 100, hpc, 'rgba(20,18,28,0.75)');

    // ── wave + horde
    vg.textAlign = 'center';
    vg.font = dispFont(26, 700);
    vg.fillStyle = '#e8dfc8';
    vg.fillText('Wave ' + Math.max(1, S.wave), W / 2, 40 * s);
    vg.font = hudFont(11);
    vg.fillStyle = '#9d9484';
    var left = orcs.length + S.spawnQueue.length;
    vg.fillText(left ? left + ' ORCS STANDING' : 'CHAMBER CLEAR', W / 2, 58 * s);

    // ── score
    vg.textAlign = 'right';
    vg.font = hudFont(10);
    vg.fillStyle = '#9d9484';
    vg.fillText('S C O R E', W - 26 * s, 34 * s);
    vg.font = hudFont(24, 500);
    vg.fillStyle = '#e3b23c';
    vg.fillText(String(S.score), W - 26 * s, 60 * s);
    if (S.combo > 1) {
      vg.font = dispFont(19, 700);
      vg.fillStyle = '#ff8a3c';
      vg.globalAlpha = clamp(S.comboT / 1.4, 0, 1);
      vg.fillText('×' + S.combo + ' chain', W - 26 * s, 82 * s);
      vg.globalAlpha = 1;
    }
    vg.font = hudFont(10);
    vg.fillStyle = '#6c6579';
    vg.fillText(S.splats + ' SPLATS', W - 26 * s, H - 22 * s);

    // ── aperture status
    var cxp = W / 2, cyp = H - 34 * s;
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
    vg.fillText(World.linked() ? 'LINKED' : 'OPEN BOTH TO LINK', cxp, H - 12 * s);

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
      vg.font = dispFont(58, 700);
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
      Art.drawPortalHand(vg, view.width, view.height, {
        time: S.time, flare: hand.flare, color: World.COLORS[S.nextHue]
      });
      Art.drawCastHand(vg, view.width, view.height, {
        time: S.time, recoil: hand.recoil, charge: hand.charge
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
    if (!S.running) return;

    update(dt);
    draw();

    // keep the recursion budget honest on slower machines
    acc += dt; frames++;
    if (acc > 1.2) {
      var fps = frames / acc;
      acc = 0; frames = 0;
      if (fps < 34 && quality > 0) { quality--; Render.setMaxDepth(quality); }
      else if (fps > 56 && quality < 2) { quality++; Render.setMaxDepth(quality); }
    }
  }

  /* ── Input ────────────────────────────────────────────────────────────*/
  var touch = { mx: 0, my: 0, jump: false, id: -1, lookId: -1, lx: 0, ly: 0, ox: 0, oy: 0, moved: 0 };
  var locked = false, dragging = false;

  function look(dx, dy) {
    player.ang += dx * 0.0026;
    void dy;
  }

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

  view.addEventListener('mousedown', function (e) {
    if (!S.running) return;
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
    if (!S.running) return;
    if (locked) look(e.movementX || 0, e.movementY || 0);
    else if (dragging) look(e.movementX || 0, e.movementY || 0);
  });

  /* touch: left thumb walks, right thumb looks, tap casts */
  view.addEventListener('touchstart', function (e) {
    if (!S.running) return;
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      var rect = view.getBoundingClientRect();
      var x = t.clientX - rect.left;
      if (x < rect.width * 0.4 && touch.id < 0) {
        touch.id = t.identifier; touch.ox = t.clientX; touch.oy = t.clientY;
      } else if (touch.lookId < 0) {
        touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY;
        touch.moved = 0;
      }
    }
  }, { passive: false });

  view.addEventListener('touchmove', function (e) {
    if (!S.running) return;
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === touch.id) {
        touch.mx = clamp((t.clientX - touch.ox) / 60, -1, 1);
        touch.my = clamp(-(t.clientY - touch.oy) / 60, -1, 1);
      } else if (t.identifier === touch.lookId) {
        look((t.clientX - touch.lx) * 1.6, 0);
        touch.moved += Math.abs(t.clientX - touch.lx);
        touch.lx = t.clientX; touch.ly = t.clientY;
      }
    }
  }, { passive: false });

  function endTouch(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === touch.id) { touch.id = -1; touch.mx = 0; touch.my = 0; }
      else if (t.identifier === touch.lookId) {
        if (touch.moved < 12 && S.running) {
          var rect = view.getBoundingClientRect();
          if (t.clientY - rect.top > rect.height * 0.72) firePortal(S.nextHue);
          else { hand.charge = 0.2; castBolt(0.2); }
        }
        touch.lookId = -1;
      }
    }
  }
  view.addEventListener('touchend', endTouch);
  view.addEventListener('touchcancel', endTouch);

  /* ── Lifecycle ────────────────────────────────────────────────────────*/
  function reset() {
    orcs.length = 0; bolts.length = 0; gibs.length = 0;
    pops.length = 0; decals.length = 0; sparks.length = 0; tracers.length = 0;
    World.clear();
    player.x = 16.5; player.y = 19.5; player.z = EYE;
    player.vx = player.vy = player.vz = 0;
    player.ang = -Math.PI / 2;
    player.hp = 100; player.dead = false; player.hurtT = 99;
    S.score = 0; S.wave = 0; S.splats = 0; S.combo = 0;
    S.time = 0; S.nextWaveT = 1.2; S.spawnQueue = [];
    S.flash = 0; S.shake = 0; S.warp = 0; S.over = false;
    S.laggardT = 0; S.nextHue = 'blue';
    hand.charge = 0; hand.charging = false;

    // The chamber opens with a linked pair already cut into the panels:
    // one in the test cube ahead, one in the alcove behind. Stand between
    // them and the corridor goes on forever.
    World.place('blue', { hit: true, tileV: World.PANEL, mapX: 16, mapY: 13, nx: 0, ny: 1, x: 16.5, y: 14 }, 0);
    World.place('orange', { hit: true, tileV: World.PANEL, mapX: 16, mapY: 21, nx: 0, ny: -1, x: 16.5, y: 21 }, 0);
  }

  function begin() {
    reset();
    startSign.hidden = true;
    deathSign.hidden = true;
    S.running = true;
    last = 0;
    Sfx.resume();
    startWave();
  }

  function endGame() {
    player.dead = true;
    player.hp = 0;
    draw();                       // one last frame, with the bar at empty
    S.running = false;
    S.over = true;
    Sfx.death();
    if (document.exitPointerLock) document.exitPointerLock();
    document.getElementById('finalScore').textContent = String(S.score);
    document.getElementById('finalWave').textContent = String(S.wave);
    document.getElementById('finalSplats').textContent = String(S.splats);
    document.getElementById('deathLine').textContent = pick(DEATHS);
    deathSign.hidden = false;
  }

  startSign.addEventListener('click', begin);
  deathSign.addEventListener('click', begin);
  document.getElementById('startBtn').addEventListener('click', begin);
  document.getElementById('againBtn').addEventListener('click', begin);

  // A small hatch into the chamber, for tuning and for testing.
  window.Demo = {
    player: player, orcs: orcs, state: S, hand: hand, show: show,
    spawn: function (type, dx, dy) {
      var o = makeOrc(type || 'grunt', player.x + dx, player.y + dy);
      orcs.push(o);
      return o;
    },
    fling: function (o, f) {
      shove(o, rand(-1, 1) * f, rand(-1, 1) * f, f * 0.6, 0);
    },
    kill: function () { hurtPlayer(999, 0, 0); }
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
