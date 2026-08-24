/* ── Sfx ──────────────────────────────────────────────────────────────────
   Every sound is synthesised on the fly: no assets, no network.           */
'use strict';

var Sfx = (function () {
  var ac = null, master = null, noise = null, muted = false;

  function ensure() {
    if (ac) return ac;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);

    var len = Math.floor(ac.sampleRate * 1.2);
    noise = ac.createBuffer(1, len, ac.sampleRate);
    var d = noise.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }

  function now() { return ac.currentTime; }

  // Distance attenuation so far-off orcs are not deafening.
  function gainFor(dist) {
    if (dist == null) return 1;
    return Math.max(0, Math.min(1, 1 / (1 + dist * dist * 0.06)));
  }

  function env(node, t0, peak, attack, decay) {
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    node.connect(g);
    return g;
  }

  function tone(type, f0, f1, t0, dur, peak, dest) {
    var o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    var g = env(o, t0, peak, 0.005, dur);
    g.connect(dest || master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  function noiseBurst(t0, dur, peak, filterType, f0, f1, dest) {
    var s = ac.createBufferSource();
    s.buffer = noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    var bp = ac.createBiquadFilter();
    bp.type = filterType;
    bp.frequency.setValueAtTime(f0, t0);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    bp.Q.value = 1.2;
    s.connect(bp);
    var g = env(bp, t0, peak, 0.004, dur);
    g.connect(dest || master);
    s.start(t0);
    s.stop(t0 + dur + 0.05);
  }

  var API = {
    resume: function () {
      var c = ensure();
      if (c && c.state === 'suspended') c.resume();
    },
    setMuted: function (m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted: function () { return muted; },

    /* Arcane bolt leaving the fingertip. */
    zap: function (charge) {
      if (!ensure() || muted) return;
      var t = now(), c = charge || 0;
      tone('sawtooth', 900 + c * 500, 120 - c * 40, t, 0.18 + c * 0.12, 0.16);
      tone('square', 1800, 400, t, 0.06, 0.05);
      noiseBurst(t, 0.12 + c * 0.1, 0.1, 'bandpass', 3000, 500);
    },

    /* Aperture opening — the signature warble. */
    portal: function (hue) {
      if (!ensure() || muted) return;
      var t = now(), base = hue === 'blue' ? 320 : 260;
      tone('sine', base, base * 3.2, t, 0.35, 0.2);
      tone('sine', base * 1.5, base * 4.6, t + 0.03, 0.3, 0.12);
      tone('triangle', base * 0.5, base * 1.2, t, 0.5, 0.09);
      noiseBurst(t, 0.4, 0.06, 'bandpass', 700, 2400);
    },

    /* Refused surface. */
    fizzle: function () {
      if (!ensure() || muted) return;
      var t = now();
      tone('square', 240, 90, t, 0.14, 0.07);
      noiseBurst(t, 0.16, 0.06, 'lowpass', 900, 200);
    },

    /* Something goes through an aperture. */
    whoosh: function (dist) {
      if (!ensure() || muted) return;
      var t = now(), g = gainFor(dist);
      noiseBurst(t, 0.34, 0.14 * g, 'bandpass', 300, 2600);
      tone('sine', 180, 900, t, 0.24, 0.07 * g);
    },

    /* Orc meets architecture at speed. */
    splat: function (dist, force) {
      if (!ensure() || muted) return;
      var t = now(), g = gainFor(dist), f = Math.min(1.6, force || 1);
      noiseBurst(t, 0.22 * f, 0.34 * g, 'lowpass', 1600, 120);
      tone('triangle', 150, 44, t, 0.22, 0.22 * g);
      noiseBurst(t + 0.05, 0.3, 0.12 * g, 'bandpass', 500, 160);
    },

    /* Non-lethal bonk. */
    thud: function (dist) {
      if (!ensure() || muted) return;
      var t = now(), g = gainFor(dist);
      tone('sine', 180, 60, t, 0.14, 0.16 * g);
      noiseBurst(t, 0.09, 0.08 * g, 'lowpass', 800, 200);
    },

    /* Orc vocals: a short indignant bark, pitched by size. */
    grunt: function (dist, pitch, angry) {
      if (!ensure() || muted) return;
      var t = now(), g = gainFor(dist), p = pitch || 1;
      var o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(150 * p, t);
      o.frequency.linearRampToValueAtTime(95 * p, t + 0.18);
      var bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(angry ? 900 : 520, t);
      bp.frequency.linearRampToValueAtTime(300, t + 0.2);
      bp.Q.value = 3.5;
      o.connect(bp);
      var gn = env(bp, t, 0.2 * g, 0.01, 0.2);
      gn.connect(master);
      o.start(t); o.stop(t + 0.3);
      noiseBurst(t, 0.08, 0.05 * g, 'bandpass', 1200 * p, 400);
    },

    /* The mage takes a club to the shin. */
    hurt: function () {
      if (!ensure() || muted) return;
      var t = now();
      tone('sawtooth', 320, 70, t, 0.22, 0.16);
      noiseBurst(t, 0.18, 0.12, 'lowpass', 1200, 200);
    },

    /* Wave horn. */
    horn: function () {
      if (!ensure() || muted) return;
      var t = now();
      tone('sawtooth', 110, 108, t, 1.1, 0.1);
      tone('sawtooth', 165, 162, t + 0.02, 1.0, 0.07);
      tone('sine', 55, 54, t, 1.2, 0.09);
    },

    /* Score chime for a good splat. */
    chime: function (n) {
      if (!ensure() || muted) return;
      var t = now(), f = 660 * Math.pow(1.122, Math.min(8, n || 0));
      tone('triangle', f, f, t, 0.18, 0.08);
      tone('sine', f * 2, f * 2, t + 0.02, 0.14, 0.04);
    },

    death: function () {
      if (!ensure() || muted) return;
      var t = now();
      tone('sawtooth', 220, 40, t, 1.4, 0.18);
      tone('sine', 110, 30, t, 1.6, 0.14);
    }
  };

  return API;
})();
