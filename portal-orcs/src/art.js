/* ── Art ──────────────────────────────────────────────────────────────────
   Every pixel in this demo is drawn by hand with canvas paths at boot:
   wall textures, orc actors, the bits orcs come apart into, and the two
   gloved hands of the mage.                                               */
'use strict';

var Art = (function () {

  function make(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function ctxOf(c) { return c.getContext('2d'); }

  /* Deterministic noise so textures look the same every run. */
  var seed = 1337;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  function hex(c) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }
  function mix(a, b, t) {
    var A = hex(a), B = hex(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' +
      Math.round(A[1] + (B[1] - A[1]) * t) + ',' +
      Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function ellipse(g, x, y, rx, ry, rot) {
    g.beginPath();
    g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, Math.PI * 2);
  }

  /* A tapered capsule: the workhorse for limbs and fingers.
     Walk the back of the near cap, ride the tangent, round the far cap. */
  function capsule(g, x1, y1, x2, y2, r1, r2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.hypot(dx, dy) || 0.001;
    var a = Math.atan2(dy, dx);
    var th = Math.asin(Math.max(-1, Math.min(1, (r1 - r2) / len)));
    var HP = Math.PI / 2;
    g.beginPath();
    g.arc(x1, y1, Math.max(0.01, r1), a + HP + th, a + Math.PI + HP - th, false);
    g.arc(x2, y2, Math.max(0.01, r2), a - HP - th, a + HP + th, false);
    g.closePath();
  }

  /* ── Wall textures ─────────────────────────────────────────────────────
     TS = texture size. Two surfaces: mossy stone (rejects enchantment) and
     the pale rune-panel (accepts an aperture).                            */
  var TS = 64;

  function mossStone() {
    var c = make(TS, TS), g = ctxOf(c);
    g.fillStyle = '#3b3648';
    g.fillRect(0, 0, TS, TS);

    var rows = 4, rh = TS / rows;
    for (var r = 0; r < rows; r++) {
      var off = (r % 2) ? rh : 0;
      for (var bx = -rh; bx < TS; bx += rh * 2) {
        var x = bx + off, y = r * rh;
        var v = 0.82 + rnd() * 0.36;
        var base = [92, 86, 104];
        g.fillStyle = 'rgb(' + Math.round(base[0] * v) + ',' + Math.round(base[1] * v) + ',' + Math.round(base[2] * v) + ')';
        g.fillRect(x + 1, y + 1, rh * 2 - 2, rh - 2);
        // top bevel
        g.fillStyle = 'rgba(232,223,200,0.10)';
        g.fillRect(x + 1, y + 1, rh * 2 - 2, 1);
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.fillRect(x + 1, y + rh - 2, rh * 2 - 2, 1);
      }
    }
    // grain + damp patches
    for (var i = 0; i < 900; i++) {
      var px = Math.floor(rnd() * TS), py = Math.floor(rnd() * TS);
      g.fillStyle = 'rgba(0,0,0,' + (rnd() * 0.18).toFixed(3) + ')';
      g.fillRect(px, py, 1, 1);
    }
    for (var m = 0; m < 26; m++) {
      var mx = rnd() * TS, my = rnd() * TS;
      g.fillStyle = 'rgba(96,132,58,' + (0.05 + rnd() * 0.18).toFixed(3) + ')';
      ellipse(g, mx, my, 2 + rnd() * 6, 1.5 + rnd() * 4, rnd() * 3);
      g.fill();
    }
    return c;
  }

  function runePanel() {
    var c = make(TS, TS), g = ctxOf(c);
    var grd = g.createLinearGradient(0, 0, 0, TS);
    grd.addColorStop(0, '#cfd2dd');
    grd.addColorStop(1, '#a7abba');
    g.fillStyle = grd;
    g.fillRect(0, 0, TS, TS);

    // recessed frame
    g.strokeStyle = 'rgba(30,28,38,0.55)';
    g.lineWidth = 2;
    g.strokeRect(3, 3, TS - 6, TS - 6);
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 1;
    g.strokeRect(5, 5, TS - 10, TS - 10);

    // rune sigil in the middle: the enchantment anchor
    g.strokeStyle = 'rgba(227,178,60,0.55)';
    g.lineWidth = 1.4;
    ellipse(g, TS / 2, TS / 2, 15, 15); g.stroke();
    ellipse(g, TS / 2, TS / 2, 10.5, 10.5); g.stroke();
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2;
      g.beginPath();
      g.moveTo(TS / 2 + Math.cos(a) * 10.5, TS / 2 + Math.sin(a) * 10.5);
      g.lineTo(TS / 2 + Math.cos(a) * 15, TS / 2 + Math.sin(a) * 15);
      g.stroke();
    }
    g.fillStyle = 'rgba(227,178,60,0.30)';
    ellipse(g, TS / 2, TS / 2, 4, 4); g.fill();

    // corner bolts
    [[9, 9], [TS - 9, 9], [9, TS - 9], [TS - 9, TS - 9]].forEach(function (p) {
      g.fillStyle = '#6d6f7d';
      ellipse(g, p[0], p[1], 2.6, 2.6); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      ellipse(g, p[0] - 0.7, p[1] - 0.7, 1.1, 1.1); g.fill();
    });

    // grime so it is not sterile
    for (var n = 0; n < 500; n++) {
      g.fillStyle = 'rgba(40,36,50,' + (rnd() * 0.12).toFixed(3) + ')';
      g.fillRect(Math.floor(rnd() * TS), Math.floor(rnd() * TS), 1, 1);
    }
    return c;
  }

  function flagstone() {
    var c = make(TS, TS), g = ctxOf(c);
    g.fillStyle = '#2f2a26';
    g.fillRect(0, 0, TS, TS);
    // irregular flagstones, four to a tile
    var cells = [[0, 0, 34, 30], [34, 0, 30, 30], [0, 30, 26, 34], [26, 30, 38, 34]];
    cells.forEach(function (q) {
      var v = 0.85 + rnd() * 0.4;
      g.fillStyle = 'rgb(' + Math.round(88 * v) + ',' + Math.round(80 * v) + ',' + Math.round(70 * v) + ')';
      g.fillRect(q[0] + 1, q[1] + 1, q[2] - 2, q[3] - 2);
      g.fillStyle = 'rgba(255,240,210,0.06)';
      g.fillRect(q[0] + 1, q[1] + 1, q[2] - 2, 1);
      g.fillStyle = 'rgba(0,0,0,0.30)';
      g.fillRect(q[0] + 1, q[1] + q[3] - 2, q[2] - 2, 1);
    });
    for (var i = 0; i < 1400; i++) {
      g.fillStyle = 'rgba(0,0,0,' + (rnd() * 0.16).toFixed(3) + ')';
      g.fillRect(Math.floor(rnd() * TS), Math.floor(rnd() * TS), 1, 1);
    }
    for (var m = 0; m < 12; m++) {
      g.fillStyle = 'rgba(96,132,58,' + (0.04 + rnd() * 0.10).toFixed(3) + ')';
      ellipse(g, rnd() * TS, rnd() * TS, 2 + rnd() * 5, 1 + rnd() * 4, rnd() * 3);
      g.fill();
    }
    return c;
  }

  /* ── Orc species ───────────────────────────────────────────────────────*/
  var SPECIES = {
    grunt:  { skin: '#8fcb43', dark: '#5c8a26', cloth: '#7a4a2a', helm: '#8a8272', scale: 1.00, tusk: 1.0 },
    goblin: { skin: '#b9d84e', dark: '#7f9a2c', cloth: '#4a5a7a', helm: null,      scale: 0.74, tusk: 0.7 },
    brute:  { skin: '#5f9a3a', dark: '#3d6a22', cloth: '#5a2430', helm: '#7d7466', scale: 1.42, tusk: 1.5 },
    shaman: { skin: '#9a7fc8', dark: '#5f4a86', cloth: '#3a2a5c', helm: null,      scale: 0.98, tusk: 0.9, hat: true }
  };

  /* One orc, drawn into a canvas of size w×h with feet on the bottom edge. */
  function drawOrc(g, w, h, sp, pose, ph) {
    var cx = w * 0.5;
    var ink = 'rgba(18,14,24,0.92)';
    var lw = h * 0.021;

    var swing = Math.sin(ph * Math.PI * 2);
    var bob = Math.cos(ph * Math.PI * 4) * h * 0.012;
    var lean = 0;

    var legT = swing, armT = -swing;
    var armSpread = 0, armLift = 0, legSpread = 0;
    var mouth = 0.5, eye = 1, browAngry = 1;

    if (pose === 'attack') { legT = 0.2; armT = 0; armLift = 1; mouth = 1; lean = 0.1; }
    if (pose === 'flail') { armSpread = 1; armLift = 0.55; legSpread = 1; mouth = 1; eye = 1.35; browAngry = -0.4; }
    if (pose === 'stun') { armSpread = 0.35; armLift = -0.2; legSpread = 0.4; mouth = 0.75; eye = 1.1; browAngry = -0.8; }

    var footY = h * 0.985;
    var hipY = h * (0.72) + bob;
    var chestY = h * 0.50 + bob;
    var headY = h * 0.29 + bob;
    var headR = h * 0.20;
    var bodyR = h * 0.175;

    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = ink;
    g.lineWidth = lw;

    function limb(x1, y1, x2, y2, r1, r2, fill) {
      capsule(g, x1, y1, x2, y2, r1, r2);
      g.fillStyle = fill;
      g.fill();
      g.stroke();
    }

    // ── back leg + back arm (darker, behind the body)
    var legR = h * 0.055;
    limb(cx - w * 0.02, hipY, cx - w * 0.07 - legSpread * w * 0.16 - legT * w * 0.06, footY - legSpread * h * 0.10, legR, legR * 0.86, sp.dark);
    var backArmX = cx - bodyR * 0.95 - armSpread * w * 0.10;
    var backArmY = chestY - h * 0.02;
    limb(backArmX, backArmY,
         backArmX - w * 0.11 - armSpread * w * 0.14, backArmY + h * 0.13 - armLift * h * 0.24 - armT * h * 0.05,
         h * 0.045, h * 0.038, sp.dark);

    // ── front leg
    limb(cx + w * 0.02, hipY, cx + w * 0.07 + legSpread * w * 0.16 + legT * w * 0.06, footY - legSpread * h * 0.06, legR, legR * 0.86, sp.skin);

    // ── boots
    [[-1, -legT], [1, legT]].forEach(function (s, i) {
      var bx = cx + s[0] * (w * 0.07 + legSpread * w * (i ? 0.16 : 0.16)) + s[1] * w * 0.06;
      var by = footY - (i ? legSpread * h * 0.06 : legSpread * h * 0.10);
      ellipse(g, bx + s[0] * w * 0.012, by - h * 0.012, w * 0.062, h * 0.030, 0);
      g.fillStyle = '#4a3524'; g.fill(); g.stroke();
    });

    // ── torso: heavy belly, narrow shoulders
    g.beginPath();
    g.moveTo(cx - bodyR * 0.72, chestY - bodyR * 0.55);
    g.quadraticCurveTo(cx - bodyR * 1.30, chestY + bodyR * 0.55, cx - bodyR * 0.80, hipY + h * 0.01);
    g.quadraticCurveTo(cx, hipY + h * 0.05, cx + bodyR * 0.80, hipY + h * 0.01);
    g.quadraticCurveTo(cx + bodyR * 1.30, chestY + bodyR * 0.55, cx + bodyR * 0.72, chestY - bodyR * 0.55);
    g.quadraticCurveTo(cx, chestY - bodyR * 0.95, cx - bodyR * 0.72, chestY - bodyR * 0.55);
    g.closePath();
    g.fillStyle = sp.skin; g.fill(); g.stroke();

    // belly highlight
    ellipse(g, cx + bodyR * 0.10, hipY - h * 0.055, bodyR * 0.62, bodyR * 0.50, 0);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fill();

    // ── loincloth + belt
    g.fillStyle = sp.cloth;
    roundRect(g, cx - bodyR * 0.95, hipY - h * 0.045, bodyR * 1.9, h * 0.085, h * 0.014);
    g.fill(); g.stroke();
    g.fillStyle = '#c8a24a';
    ellipse(g, cx, hipY - h * 0.005, w * 0.030, h * 0.020, 0); g.fill(); g.stroke();

    // ── front arm (+ club)
    var armX = cx + bodyR * 0.95 + armSpread * w * 0.10;
    var armY = chestY - h * 0.02;
    var handX = armX + w * 0.11 + armSpread * w * 0.16;
    var handY = armY + h * 0.13 - armLift * h * 0.30 + armT * h * 0.05;
    limb(armX, armY, handX, handY, h * 0.047, h * 0.040, sp.skin);

    if (pose !== 'flail' && pose !== 'stun') {
      // rusty club, gripped
      g.save();
      g.translate(handX, handY);
      g.rotate(pose === 'attack' ? -2.2 : -0.9 + armT * 0.25);
      capsule(g, 0, 0, h * 0.26, 0, h * 0.022, h * 0.055);
      g.fillStyle = '#7a5a34'; g.fill(); g.stroke();
      g.fillStyle = '#cfd2dd';
      [[h * 0.18, -h * 0.03], [h * 0.23, h * 0.02], [h * 0.14, h * 0.035]].forEach(function (p) {
        g.beginPath();
        g.moveTo(p[0], p[1]);
        g.lineTo(p[0] + h * 0.05, p[1] - h * 0.012);
        g.lineTo(p[0] + h * 0.012, p[1] + h * 0.028);
        g.closePath(); g.fill(); g.stroke();
      });
      g.restore();
    }
    ellipse(g, handX, handY, h * 0.042, h * 0.042, 0);
    g.fillStyle = sp.skin; g.fill(); g.stroke();

    // ── ears
    [-1, 1].forEach(function (s) {
      g.beginPath();
      g.moveTo(cx + s * headR * 0.85, headY - headR * 0.10);
      g.lineTo(cx + s * headR * 1.62, headY - headR * 0.72);
      g.lineTo(cx + s * headR * 0.90, headY + headR * 0.34);
      g.closePath();
      g.fillStyle = sp.dark; g.fill(); g.stroke();
    });

    // ── head
    ellipse(g, cx, headY, headR * 1.06, headR * 0.94, 0);
    g.fillStyle = sp.skin; g.fill(); g.stroke();

    // brow ridge
    g.beginPath();
    g.moveTo(cx - headR * 0.92, headY - headR * 0.18);
    g.quadraticCurveTo(cx, headY - headR * 0.62, cx + headR * 0.92, headY - headR * 0.18);
    g.quadraticCurveTo(cx, headY - headR * 0.30, cx - headR * 0.92, headY - headR * 0.18);
    g.closePath();
    g.fillStyle = sp.dark; g.fill();

    // eyes
    [-1, 1].forEach(function (s) {
      var ex = cx + s * headR * 0.40, ey = headY - headR * 0.06;
      ellipse(g, ex, ey, headR * 0.24 * eye, headR * 0.21 * eye, 0);
      g.fillStyle = '#fdf6e3'; g.fill();
      g.strokeStyle = ink; g.lineWidth = lw * 0.8; g.stroke();
      if (pose === 'stun') {
        // dizzy spiral
        g.beginPath();
        for (var t = 0; t < 12; t++) {
          var a = t * 0.9, rr2 = headR * 0.035 * t;
          var px = ex + Math.cos(a) * rr2, py = ey + Math.sin(a) * rr2;
          if (t === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.strokeStyle = '#241a12'; g.lineWidth = lw * 0.8; g.stroke();
      } else {
        ellipse(g, ex + s * headR * 0.05, ey + headR * 0.02, headR * 0.10 * eye, headR * 0.12 * eye, 0);
        g.fillStyle = '#241a12'; g.fill();
      }
      g.lineWidth = lw; g.strokeStyle = ink;
    });

    // eyebrows
    [-1, 1].forEach(function (s) {
      g.beginPath();
      g.moveTo(cx + s * headR * 0.16, headY - headR * 0.30 - browAngry * headR * 0.06);
      g.lineTo(cx + s * headR * 0.68, headY - headR * 0.36 + browAngry * headR * 0.14);
      g.lineWidth = lw * 1.5;
      g.strokeStyle = '#2b2016';
      g.stroke();
      g.lineWidth = lw; g.strokeStyle = ink;
    });

    // snout + mouth
    ellipse(g, cx, headY + headR * 0.36, headR * 0.50, headR * 0.34, 0);
    g.fillStyle = sp.dark; g.fill();
    g.fillStyle = '#2b1a12';
    ellipse(g, cx - headR * 0.16, headY + headR * 0.22, headR * 0.07, headR * 0.05, 0); g.fill();
    ellipse(g, cx + headR * 0.16, headY + headR * 0.22, headR * 0.07, headR * 0.05, 0); g.fill();

    g.beginPath();
    g.ellipse(cx, headY + headR * 0.52, headR * 0.46, headR * 0.10 + headR * 0.22 * mouth, 0, 0, Math.PI * 2);
    g.fillStyle = '#3a1420'; g.fill(); g.stroke();

    // tusks
    var tk = sp.tusk;
    [-1, 1].forEach(function (s) {
      g.beginPath();
      g.moveTo(cx + s * headR * 0.34, headY + headR * 0.62);
      g.lineTo(cx + s * headR * 0.50, headY + headR * 0.06 - tk * headR * 0.20);
      g.lineTo(cx + s * headR * 0.18, headY + headR * 0.58);
      g.closePath();
      g.fillStyle = '#f2ead6'; g.fill(); g.stroke();
    });

    // ── headgear
    if (sp.hat) {
      g.beginPath();
      g.moveTo(cx - headR * 1.05, headY - headR * 0.62);
      g.lineTo(cx + headR * 0.30, headY - headR * 1.95);
      g.lineTo(cx + headR * 1.05, headY - headR * 0.58);
      g.closePath();
      g.fillStyle = sp.cloth; g.fill(); g.stroke();
      g.fillStyle = '#e3b23c';
      ellipse(g, cx + headR * 0.28, headY - headR * 1.90, headR * 0.12, headR * 0.12, 0); g.fill(); g.stroke();
    } else if (sp.helm) {
      g.beginPath();
      g.ellipse(cx, headY - headR * 0.44, headR * 1.02, headR * 0.62, 0.06, Math.PI, Math.PI * 2);
      g.closePath();
      g.fillStyle = sp.helm; g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      ellipse(g, cx - headR * 0.34, headY - headR * 0.62, headR * 0.26, headR * 0.12, -0.4); g.fill();
      // horn
      g.beginPath();
      g.moveTo(cx + headR * 0.72, headY - headR * 0.62);
      g.quadraticCurveTo(cx + headR * 1.62, headY - headR * 1.20, cx + headR * 1.28, headY - headR * 0.10);
      g.quadraticCurveTo(cx + headR * 1.10, headY - headR * 0.62, cx + headR * 0.72, headY - headR * 0.62);
      g.closePath();
      g.fillStyle = '#e8e0c8'; g.fill(); g.stroke();
    }

    // rim light: the chamber is lit cold from above-left
    g.save();
    g.globalCompositeOperation = 'source-atop';
    var rim = g.createLinearGradient(0, 0, w * 0.6, h);
    rim.addColorStop(0, 'rgba(150,200,255,0.20)');
    rim.addColorStop(0.45, 'rgba(150,200,255,0)');
    g.fillStyle = rim;
    g.fillRect(0, 0, w, h);
    g.restore();
  }

  /* Pre-render every orc pose once. */
  var ORC_W = 108, ORC_H = 148;
  var orcCache = {};
  function orcSprite(type, pose, frame) {
    var key = type + '|' + pose + '|' + (frame || 0);
    if (orcCache[key]) return orcCache[key];
    var c = make(ORC_W, ORC_H), g = ctxOf(c);
    var ph = pose === 'walk' ? (frame || 0) / 4 : 0;
    drawOrc(g, ORC_W, ORC_H, SPECIES[type], pose, ph);
    orcCache[key] = c;
    return c;
  }

  /* ── Gibs: the parts an orc becomes ───────────────────────────────────*/
  var GIB_S = 34;
  var gibCache = {};
  function gibSprite(type, kind) {
    var key = type + '|' + kind;
    if (gibCache[key]) return gibCache[key];
    var sp = SPECIES[type];
    var c = make(GIB_S, GIB_S), g = ctxOf(c);
    var m = GIB_S / 2;
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = 'rgba(18,14,24,0.92)';
    g.lineWidth = 1.7;

    if (kind === 'head') {
      ellipse(g, m, m, 11, 10, 0); g.fillStyle = sp.skin; g.fill(); g.stroke();
      g.fillStyle = '#fdf6e3';
      ellipse(g, m - 4, m - 2, 3, 3, 0); g.fill();
      ellipse(g, m + 4, m - 2, 3, 3, 0); g.fill();
      g.fillStyle = '#241a12';
      ellipse(g, m - 4, m - 1, 1.4, 1.6, 0); g.fill();
      ellipse(g, m + 4, m - 1, 1.4, 1.6, 0); g.fill();
      g.fillStyle = '#3a1420';
      ellipse(g, m, m + 5, 5, 3.4, 0); g.fill(); g.stroke();
      g.fillStyle = '#f2ead6';
      [-1, 1].forEach(function (s) {
        g.beginPath();
        g.moveTo(m + s * 3.6, m + 7); g.lineTo(m + s * 4.6, m + 1); g.lineTo(m + s * 1.6, m + 6);
        g.closePath(); g.fill(); g.stroke();
      });
    } else if (kind === 'arm' || kind === 'leg') {
      var L = kind === 'arm' ? 9 : 11;
      capsule(g, m - L, m - 3, m + L, m + 4, 4.6, 3.4);
      g.fillStyle = kind === 'arm' ? sp.skin : sp.dark; g.fill(); g.stroke();
      ellipse(g, m + L, m + 4, 4.2, 3.6, 0);
      g.fillStyle = kind === 'arm' ? sp.skin : '#4a3524'; g.fill(); g.stroke();
    } else if (kind === 'tusk') {
      g.beginPath();
      g.moveTo(m - 4, m + 6); g.lineTo(m + 3, m - 7); g.lineTo(m + 5, m + 5);
      g.closePath();
      g.fillStyle = '#f2ead6'; g.fill(); g.stroke();
    } else if (kind === 'helm') {
      g.beginPath();
      g.ellipse(m, m + 2, 10, 7, 0, Math.PI, Math.PI * 2);
      g.closePath();
      g.fillStyle = sp.helm || '#8a8272'; g.fill(); g.stroke();
    } else { // chunk
      g.beginPath();
      var n = 7;
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2, rr2 = 5 + rnd() * 4;
        var px = m + Math.cos(a) * rr2, py = m + Math.sin(a) * rr2;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = sp.dark; g.fill(); g.stroke();
    }
    gibCache[key] = c;
    return c;
  }

  /* ── Floor splat decal ────────────────────────────────────────────────*/
  var splatCache = {};
  function splatSprite(type, variant) {
    var key = type + '|' + variant;
    if (splatCache[key]) return splatCache[key];
    var sp = SPECIES[type];
    var S = 64, c = make(S, S), g = ctxOf(c), m = S / 2;
    seed = 991 + variant * 77;
    // stains, not paint: pull the species colour well down toward the floor
    var stain = mix(sp.dark, '#241c14', 0.55);
    var fleck = mix(sp.skin, '#2a2016', 0.45);
    g.fillStyle = stain;
    g.beginPath();
    for (var i = 0; i < 20; i++) {
      var a = i / 20 * Math.PI * 2;
      var rr2 = m * (0.42 + rnd() * 0.42);
      var px = m + Math.cos(a) * rr2, py = m + Math.sin(a) * rr2 * 0.85;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath(); g.fill();
    for (var d = 0; d < 14; d++) {
      var a2 = rnd() * Math.PI * 2, rd = m * (0.5 + rnd() * 0.48);
      g.fillStyle = d % 3 ? stain : fleck;
      ellipse(g, m + Math.cos(a2) * rd, m + Math.sin(a2) * rd * 0.85, 1 + rnd() * 3.4, 1 + rnd() * 2.6, 0);
      g.fill();
    }
    g.globalCompositeOperation = 'source-atop';
    var gr = g.createRadialGradient(m, m, 2, m, m, m);
    gr.addColorStop(0, 'rgba(0,0,0,0.35)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    splatCache[key] = c;
    return c;
  }


  /* ── Rune font ────────────────────────────────────────────────────────
     The thing the horde is actually marching on: a stone plinth holding a
     bound flame. Three states, so its condition reads across the room.   */
  var fontCache = {};
  function fontSprite(state) {
    if (fontCache[state]) return fontCache[state];
    var W = 96, H = 148, c = make(W, H), g = ctxOf(c);
    var m = W / 2;
    var ink = 'rgba(14,11,20,0.92)';
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = ink;
    g.lineWidth = 2.6;

    // plinth
    g.beginPath();
    g.moveTo(m - 30, H - 4);
    g.lineTo(m - 20, H - 74);
    g.lineTo(m + 20, H - 74);
    g.lineTo(m + 30, H - 4);
    g.closePath();
    var pg = g.createLinearGradient(m - 30, 0, m + 30, 0);
    pg.addColorStop(0, '#3b3648');
    pg.addColorStop(0.45, '#6b6478');
    pg.addColorStop(1, '#2c2836');
    g.fillStyle = pg; g.fill(); g.stroke();

    // carved band
    g.fillStyle = state === 'dark' ? 'rgba(90,84,100,0.5)' : 'rgba(227,178,60,0.55)';
    g.fillRect(m - 23, H - 56, 46, 5);
    g.fillRect(m - 21, H - 40, 42, 4);

    // bowl
    g.beginPath();
    g.ellipse(m, H - 78, 30, 11, 0, 0, Math.PI * 2);
    g.fillStyle = '#7c7488'; g.fill(); g.stroke();
    g.beginPath();
    g.ellipse(m, H - 80, 22, 7, 0, 0, Math.PI * 2);
    g.fillStyle = state === 'dark' ? '#241f2c' : '#20161a'; g.fill();

    if (state !== 'dark') {
      // the bound flame: a floating orb inside a rune ring
      var hot = state === 'full' ? '#ffd98a' : '#ff8a3c';
      var core = state === 'full' ? '#fff6d8' : '#ffd0a0';
      g.beginPath();
      g.ellipse(m, H - 104, 17, 21, 0, 0, Math.PI * 2);
      var og = g.createRadialGradient(m - 4, H - 110, 2, m, H - 104, 22);
      og.addColorStop(0, core);
      og.addColorStop(0.5, hot);
      og.addColorStop(1, 'rgba(255,120,40,0.15)');
      g.fillStyle = og; g.fill();

      g.strokeStyle = state === 'full' ? '#e3b23c' : '#b3243a';
      g.lineWidth = 2.2;
      g.beginPath();
      g.ellipse(m, H - 104, 27, 10, 0, 0, Math.PI * 2);
      g.stroke();
      for (var i = 0; i < 6; i++) {
        var a = i / 6 * Math.PI * 2;
        g.fillStyle = state === 'full' ? '#e3b23c' : '#b3243a';
        g.fillRect(m + Math.cos(a) * 27 - 2, H - 104 + Math.sin(a) * 10 - 2, 4, 4);
      }
    } else {
      // snuffed: a cracked, cold stone
      g.strokeStyle = 'rgba(60,55,72,0.9)';
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(m - 14, H - 92); g.lineTo(m - 3, H - 76);
      g.lineTo(m + 6, H - 90); g.lineTo(m + 16, H - 72);
      g.stroke();
    }
    fontCache[state] = c;
    return c;
  }

  /* ── Flame ────────────────────────────────────────────────────────────
     Used for burning orcs, burning fonts, and fireball trails.          */
  var flameCache = {};
  function flameSprite(frame) {
    if (flameCache[frame]) return flameCache[frame];
    var S = 40, c = make(S, S), g = ctxOf(c);
    seed = 4400 + frame * 131;
    var m = S / 2;
    function tongue(h, wid, off, fill) {
      g.beginPath();
      g.moveTo(m + off, S - 2);
      g.bezierCurveTo(m + off - wid, S - h * 0.45, m + off - wid * 0.55, S - h * 0.8, m + off + wid * 0.1, S - h);
      g.bezierCurveTo(m + off + wid * 0.65, S - h * 0.78, m + off + wid, S - h * 0.4, m + off, S - 2);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
    }
    tongue(S * 0.94, 12 + rnd() * 4, (rnd() - 0.5) * 5, 'rgba(255,96,20,0.85)');
    tongue(S * 0.70, 8 + rnd() * 3, (rnd() - 0.5) * 6, 'rgba(255,168,40,0.9)');
    tongue(S * 0.44, 5 + rnd() * 2, (rnd() - 0.5) * 5, 'rgba(255,238,170,0.95)');
    flameCache[frame] = c;
    return c;
  }

  /* ── The mage's hands ─────────────────────────────────────────────────
     Drawn live at display resolution so they stay crisp over the chunky
     world. All geometry is expressed against h so any aspect works.      */

  var HAND_K = 0.7;   // hands pull back toward their corners on small screens
  var SKIN = '#d8a071', SKIN_D = '#a06a44', SKIN_L = '#f2c79c';
  var SLEEVE = '#2c2044', SLEEVE_D = '#1a1230', TRIM = '#e3b23c';
  var INK = 'rgba(16,12,22,0.9)';

  function shadedLimb(g, x1, y1, x2, y2, r1, r2) {
    capsule(g, x1, y1, x2, y2, r1, r2);
    var gr = g.createLinearGradient(x1 - r1, y1 - r1, x1 + r1 * 1.6, y1 + r1 * 1.6);
    gr.addColorStop(0, SKIN_L);
    gr.addColorStop(0.45, SKIN);
    gr.addColorStop(1, SKIN_D);
    g.fillStyle = gr;
    g.fill();
    g.stroke();
  }

  function sleeve(g, wx, wy, ex, ey, rw, re, s) {
    capsule(g, ex, ey, wx, wy, re, rw);
    var gr = g.createLinearGradient(wx - rw, wy - rw, wx + rw, wy + rw);
    gr.addColorStop(0, SLEEVE);
    gr.addColorStop(1, SLEEVE_D);
    g.fillStyle = gr; g.fill(); g.stroke();

    // gold cuff with rune stitching
    var a = Math.atan2(ey - wy, ex - wx);
    g.save();
    g.translate(wx, wy);
    g.rotate(a);
    g.fillStyle = TRIM;
    roundRect(g, -rw * 0.15, -rw * 1.06, rw * 0.55, rw * 2.12, rw * 0.12);
    g.fill(); g.stroke();
    g.fillStyle = 'rgba(60,40,10,0.55)';
    for (var i = -2; i <= 2; i++) {
      g.fillRect(rw * 0.02, i * rw * 0.36 - rw * 0.05, rw * 0.2, rw * 0.1);
    }
    g.restore();
    void s;
  }

  /* Right hand: fist with the index finger extended at the crosshair. */
  function drawCastHand(g, w, h, st) {
    var s = h / 600;
    var recoil = st.recoil || 0, charge = st.charge || 0;
    var breathe = Math.sin(st.time * 1.6) * 4 * s;
    var pulse = 1 + Math.sin(st.time * 9) * 0.06 * charge;

    g.save();
    g.translate(st.dx || 0, st.dy || 0);
    // pull the whole arm toward its screen corner so it frames the view
    g.translate(w, h); g.scale(HAND_K, HAND_K); g.translate(-w, -h);
    // recoil kicks the hand back down-right along the pointing axis
    g.translate(w * 0.5 + recoil * 44 * s, h * 0.5 + recoil * 46 * s + breathe + charge * -6 * s);
    g.rotate(recoil * 0.10);
    g.translate(-w * 0.5, -h * 0.5);

    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = INK; g.lineWidth = 3.1 * s;

    var wx = w * 0.5 + 190 * s, wy = h * 0.5 + 205 * s;   // wrist
    var ex = w * 0.5 + 380 * s, ey = h * 0.5 + 400 * s;   // elbow, off-screen
    var px = w * 0.5 + 118 * s, py = h * 0.5 + 128 * s;   // palm centre
    var tipx = w * 0.5 + 8 * s, tipy = h * 0.5 + 26 * s;  // fingertip, near the crosshair

    sleeve(g, wx, wy, ex, ey, 46 * s, 62 * s, s);

    // palm / fist mass
    g.save();
    g.translate(px, py);
    g.rotate(-0.62);
    capsule(g, -34 * s, 0, 34 * s, 0, 40 * s, 36 * s);
    var pg = g.createLinearGradient(-40 * s, -40 * s, 40 * s, 40 * s);
    pg.addColorStop(0, SKIN_L); pg.addColorStop(0.5, SKIN); pg.addColorStop(1, SKIN_D);
    g.fillStyle = pg; g.fill(); g.stroke();
    g.restore();

    // curled fingers along the top edge of the fist
    for (var i = 0; i < 3; i++) {
      var t = i / 2;
      var kx = px - 40 * s + t * 44 * s, ky = py - 24 * s + t * 34 * s;
      shadedLimb(g, kx, ky, kx + 30 * s, ky - 12 * s + t * 6 * s, 15 * s - i * 1.2 * s, 13 * s - i * 1.2 * s);
    }

    // thumb over the fist
    shadedLimb(g, px + 6 * s, py + 30 * s, px + 54 * s, py - 4 * s, 17 * s, 13 * s);

    // the pointing finger: three phalanges toward the crosshair
    var mx = px - 46 * s, my = py - 40 * s;
    shadedLimb(g, mx, my, tipx + 30 * s, tipy + 34 * s, 16 * s, 13 * s);
    shadedLimb(g, tipx + 30 * s, tipy + 34 * s, tipx, tipy, 13 * s, 10.5 * s);
    // nail
    g.save();
    g.translate(tipx, tipy);
    g.rotate(Math.atan2(tipy - py, tipx - px));
    ellipse(g, 2 * s, 0, 6 * s, 7.5 * s, 0);
    g.fillStyle = 'rgba(255,236,220,0.85)'; g.fill();
    g.restore();

    // runic tattoo band on the back of the hand
    g.save();
    g.globalAlpha = 0.55 + charge * 0.45;
    g.strokeStyle = 'rgba(120,210,255,' + (0.5 + charge * 0.5) + ')';
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.arc(px - 6 * s, py - 4 * s, 26 * s, -0.4, 2.4);
    g.stroke();
    for (var r = 0; r < 5; r++) {
      var a = -0.4 + r * 0.7;
      g.beginPath();
      g.moveTo(px - 6 * s + Math.cos(a) * 20 * s, py - 4 * s + Math.sin(a) * 20 * s);
      g.lineTo(px - 6 * s + Math.cos(a) * 31 * s, py - 4 * s + Math.sin(a) * 31 * s);
      g.stroke();
    }
    g.restore();

    // fingertip charge: a spinning rune ring and a hot core
    var glow = (0.28 + charge * 0.95) * pulse;
    var gr = g.createRadialGradient(tipx, tipy, 0, tipx, tipy, 78 * s * glow);
    gr.addColorStop(0, 'rgba(255,255,255,' + (0.95 * Math.min(1, glow)) + ')');
    gr.addColorStop(0.28, 'rgba(140,220,255,' + (0.75 * Math.min(1, glow)) + ')');
    gr.addColorStop(0.6, 'rgba(90,120,255,' + (0.30 * glow) + ')');
    gr.addColorStop(1, 'rgba(60,60,200,0)');
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = gr;
    g.beginPath();
    g.arc(tipx, tipy, 80 * s * glow, 0, Math.PI * 2);
    g.fill();

    if (charge > 0.02) {
      g.strokeStyle = 'rgba(190,235,255,' + (0.35 + charge * 0.6) + ')';
      g.lineWidth = 2 * s;
      for (var k = 0; k < 2; k++) {
        var rad = (22 + k * 13) * s * (1 + charge * 0.9);
        var rot = st.time * (k ? -2.4 : 3.1);
        g.beginPath();
        for (var j = 0; j <= 6; j++) {
          var aa = rot + j / 6 * Math.PI * 2;
          var xx = tipx + Math.cos(aa) * rad, yy = tipy + Math.sin(aa) * rad * 0.92;
          if (j === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
        }
        g.stroke();
      }
    }
    g.restore();
    g.restore();
  }

  /* Left hand: open palm cradling the aperture sigil. */
  function drawPortalHand(g, w, h, st) {
    var s = h / 600;
    var flare = st.flare || 0;
    var col = st.color;
    var breathe = Math.cos(st.time * 1.4) * 4 * s;

    g.save();
    g.translate(st.dx || 0, st.dy || 0);
    g.translate(0, h); g.scale(HAND_K, HAND_K); g.translate(0, -h);
    g.translate(-flare * 26 * s, -flare * 30 * s + breathe);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = INK; g.lineWidth = 3.1 * s;

    var wx = w * 0.5 - 196 * s, wy = h * 0.5 + 214 * s;
    var ex = w * 0.5 - 384 * s, ey = h * 0.5 + 404 * s;
    var px = w * 0.5 - 128 * s, py = h * 0.5 + 150 * s;

    sleeve(g, wx, wy, ex, ey, 46 * s, 62 * s, s);

    // open palm, fingers fanned upward cradling the sigil
    g.save();
    g.translate(px, py);
    g.rotate(0.42);
    capsule(g, -36 * s, 6 * s, 34 * s, -6 * s, 40 * s, 37 * s);
    var pg = g.createLinearGradient(-40 * s, 40 * s, 30 * s, -40 * s);
    pg.addColorStop(0, SKIN_D); pg.addColorStop(0.55, SKIN); pg.addColorStop(1, SKIN_L);
    g.fillStyle = pg; g.fill(); g.stroke();
    g.restore();

    for (var i = 0; i < 4; i++) {
      var t = i / 3;
      var bx = px - 30 * s + t * 66 * s;
      var by = py - 26 * s - Math.sin(t * Math.PI) * 8 * s;
      var len = (58 - Math.abs(t - 0.45) * 34) * s;
      var ang = -1.45 + (t - 0.5) * 0.85 + flare * 0.18;
      shadedLimb(g, bx, by, bx + Math.cos(ang) * len, by + Math.sin(ang) * len, 15 * s - i * 0.8 * s, 11 * s);
    }
    shadedLimb(g, px - 34 * s, py + 6 * s, px - 74 * s, py - 26 * s, 17 * s, 13 * s);

    // the sigil hovering over the palm
    var sx = px + 10 * s, sy = py - 124 * s;
    var R = (46 + flare * 22) * s;
    g.save();
    g.globalCompositeOperation = 'lighter';
    var gr = g.createRadialGradient(sx, sy, 2, sx, sy, R * 1.7);
    gr.addColorStop(0, 'rgba(255,255,255,' + (0.5 + flare * 0.5) + ')');
    gr.addColorStop(0.3, col.glow);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(sx, sy, R * 1.7, 0, Math.PI * 2); g.fill();

    // the miniature aperture
    ellipse(g, sx, sy, R * 0.52, R * 0.66, 0);
    g.fillStyle = col.deep; g.fill();
    g.strokeStyle = col.bright; g.lineWidth = 3 * s; g.stroke();

    // two counter-rotating rune rings
    for (var k = 0; k < 2; k++) {
      var rot = st.time * (k ? -0.9 : 1.3);
      var rad = R * (k ? 1.0 : 0.78);
      g.strokeStyle = k ? col.bright : TRIM;
      g.lineWidth = 2 * s;
      g.beginPath();
      g.ellipse(sx, sy, rad, rad * 0.42, k ? 0.5 : -0.5, 0, Math.PI * 2);
      g.stroke();
      for (var j = 0; j < 6; j++) {
        var a = rot + j / 6 * Math.PI * 2;
        var rx = sx + Math.cos(a) * rad, ry = sy + Math.sin(a) * rad * 0.42;
        g.fillStyle = k ? col.bright : TRIM;
        g.fillRect(rx - 1.6 * s, ry - 1.6 * s, 3.2 * s, 3.2 * s);
      }
    }
    g.restore();
    g.restore();
  }

  return {
    setHandScale: function (k) { HAND_K = k; },
    TS: TS,
    ORC_W: ORC_W, ORC_H: ORC_H,
    SPECIES: SPECIES,
    texStone: mossStone(),
    texPanel: runePanel(),
    texFloor: flagstone(),
    orc: orcSprite,
    font: fontSprite,
    flame: flameSprite,
    gib: gibSprite,
    splat: splatSprite,
    drawCastHand: drawCastHand,
    drawPortalHand: drawPortalHand,
    roundRect: roundRect,
    ellipse: ellipse,
    capsule: capsule,
    make: make
  };
})();
