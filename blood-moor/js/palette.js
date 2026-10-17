/* Classic look: a fixed 256-colour palette with ordered dithering, applied to the low-resolution
   frame buffer and to every icon, the way an 8-bit 640x480 game would have shown it. */
'use strict';
const PAL = { on: true, colors: [], lut: null, q: null, bayer: null };

function buildPalette() {
  // 16 hue ramps x 16 shades: earth, stone, moss, blood, fire, ice, skin, gold, arcane...
  const ramps = [
    [232, 226, 210], [176, 180, 186], [196, 150, 92], [134, 150, 78], [84, 122, 60], [222, 188, 92],
    [214, 44, 30], [255, 168, 70], [230, 180, 140], [76, 106, 220], [170, 220, 255], [142, 78, 190],
    [132, 56, 40], [86, 132, 130], [255, 240, 176], [100, 106, 132],
  ];
  const cols = [];
  for (const base of ramps) for (let t = 0; t < 16; t++) {
    const k = (t + 1) / 12;
    const c = k <= 1 ? base.map(v => v * Math.pow(k, 1.2)) : base.map(v => lerp(v, 255, (k - 1) * .75));
    cols.push(c.map(v => clamp(Math.round(v), 0, 255)));
  }
  cols[0] = [0, 0, 0];
  PAL.colors = cols;
  // 32x32x32 lookup: nearest palette entry for every 5-bit colour
  const lut = new Uint32Array(32768);
  for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
    const R = r * 8 + 4, Gc = g * 8 + 4, B = b * 8 + 4; let best = 0, bd = 1e9;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i], dr = R - c[0], dg = Gc - c[1], db = B - c[2], rm = (R + c[0]) / 2;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = i; }
    }
    const c = cols[best]; lut[(r << 10) | (g << 5) | b] = (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
  }
  PAL.lut = lut;
  // channel value (+dither, offset by 16) -> 5-bit index, clamped
  PAL.q = new Uint8Array(288); for (let i = 0; i < 288; i++) PAL.q[i] = clamp(i - 16, 0, 255) >> 3;
  const b4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  PAL.bayer = Int8Array.from(b4, v => Math.round((v - 7.5) * .75));
}

// Snap a canvas region to the palette. `alpha` keeps transparency (hard edged) for sprites and icons.
function quantize(ctx, w, h, alpha) {
  if (!PAL.lut) return;
  const img = ctx.getImageData(0, 0, w, h), u = new Uint32Array(img.data.buffer), lut = PAL.lut, q = PAL.q, by = PAL.bayer;
  for (let y = 0, i = 0; y < h; y++) {
    const row = (y & 3) << 2;
    for (let x = 0; x < w; x++, i++) {
      const v = u[i];
      if (alpha) { if ((v >>> 24) < 110) { u[i] = 0; continue; } }
      const d = by[row | (x & 3)] + 16;
      u[i] = lut[(q[(v & 255) + d] << 10) | (q[((v >>> 8) & 255) + d] << 5) | q[((v >>> 16) & 255) + d]];
    }
  }
  ctx.putImageData(img, 0, 0);
}
// Pixel-art stone texture used behind the HUD and panels
function stoneTexture(size = 96, tone = [44, 36, 28]) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // tiling noise: sample on a torus
    const a = x / size * TAU, b = y / size * TAU;
    const n = fbm(Math.cos(a) * 1.6 + 3, Math.sin(a) * 1.6 + Math.cos(b) * 1.6, 41, 3) * .7 + vnoise(Math.sin(b) * 2.4 + 9, Math.cos(b) * 2.4 + Math.sin(a), 7) * .3;
    const crack = Math.abs(vnoise(Math.cos(a) * 3 + Math.sin(b), Math.cos(b) * 3, 19) - .5) < .03 ? .55 : 1;
    const m = (.55 + n * .8) * crack, o = (y * size + x) * 4;
    d[o] = tone[0] * m; d[o + 1] = tone[1] * m; d[o + 2] = tone[2] * m; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); quantize(ctx, size, size);
  return c.toDataURL();
}
