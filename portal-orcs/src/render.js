/* ── Render ───────────────────────────────────────────────────────────────
   A column raycaster with true portal recursion: the view through an
   aperture is the same frustum rendered from the twin aperture's frame and
   clipped to the oval. Depth 0 is the world, 1 is what you see through an
   aperture, 2 is the aperture seen through that one.                     */
'use strict';

var Render = (function () {

  var MAX_DIST = 44;
  var FOV = 74 * Math.PI / 180;
  var tanHalf = Math.tan(FOV / 2);

  var W = 0, H = 0, horizon = 0, projDist = 0;
  var layers = [];      // { canvas, ctx, depth: Float32Array }
  var maxDepth = 2;

  var sprites = [], decals = [], glows = [];

  // Pre-baked fog strings: avoids building a colour string per column.
  var FOG = [];
  for (var i = 0; i <= 64; i++) FOG.push('rgba(11,10,18,' + (i / 64).toFixed(3) + ')');

  function setSize(w, h) {
    W = w | 0; H = h | 0;
    horizon = Math.round(H * 0.5);
    projDist = (W / 2) / tanHalf;
    layers = [];
    for (var d = 0; d <= maxDepth; d++) {
      var c = Art.make(W, H);
      var g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      layers.push({ canvas: c, ctx: g, depth: new Float32Array(W) });
    }
    planeImg = layers[0].ctx.createImageData(W, H);
    if (!floorPix) {
      floorPix = texPixels(Art.texFloor);
      ceilPix = texPixels(Art.texStone);
    }
  }

  function setMaxDepth(d) {
    d = Math.max(0, Math.min(2, d));
    if (d === maxDepth) return;
    maxDepth = d;
    if (W) setSize(W, H);
  }

  function clearFrame() {
    sprites.length = 0; decals.length = 0; glows.length = 0;
  }

  function addSprite(img, x, y, z, w, h, rot, alpha) {
    sprites.push({ img: img, x: x, y: y, z: z, w: w, h: h, rot: rot || 0, a: alpha == null ? 1 : alpha });
  }
  function addDecal(img, x, y, size, alpha) {
    decals.push({ img: img, x: x, y: y, s: size, a: alpha });
  }
  function addGlow(x, y, z, radius, color, alpha) {
    glows.push({ x: x, y: y, z: z, r: radius, c: color, a: alpha });
  }

  /* World point → screen. Used by the HUD for floating damage text. */
  function project(cam, x, y, z, out) {
    var dx = x - cam.x, dy = y - cam.y;
    var ca = Math.cos(cam.ang), sa = Math.sin(cam.ang);
    var tz = dx * ca + dy * sa;
    var tx = -dx * sa + dy * ca;
    out = out || {};
    out.tz = tz;
    if (tz <= 0.06) { out.vis = false; return out; }
    out.scale = projDist / tz;
    out.sx = W / 2 + tx * out.scale;
    out.sy = horizon + (cam.z - z) * out.scale;
    out.vis = out.sx > -W && out.sx < W * 2;
    return out;
  }

  /* ── Floor and ceiling ────────────────────────────────────────────────
     Horizontal scanline casting: every row below the horizon is a fixed
     distance from the eye, so one texture step walks the whole row. Two
     screen pixels per sample keeps it cheap enough to run inside portals. */
  var planeImg = null, floorPix = null, ceilPix = null;

  function texPixels(canvas) {
    var g = canvas.getContext('2d');
    return g.getImageData(0, 0, Art.TS, Art.TS).data;
  }

  var FOG_R = 11, FOG_G = 10, FOG_B = 18;

  function planes(L, cam) {
    if (!planeImg) return;
    var d = planeImg.data;
    var ca = Math.cos(cam.ang), sa = Math.sin(cam.ang);
    var r0x = ca + sa * tanHalf, r0y = sa - ca * tanHalf;   // camx = -1
    var r1x = ca - sa * tanHalf, r1y = sa + ca * tanHalf;   // camx = +1
    var eye = cam.z, head = 1 - cam.z;

    flat(d, horizon);
    for (var p = 1; p <= H; p++) {
      var yF = horizon + p, yC = horizon - p;
      var okF = yF < H, okC = yC >= 0;
      if (!okF && !okC) break;

      if (okF) {
        var dF = projDist * eye / p;
        var sF = Math.exp(-dF * 0.115);
        if (sF > 0.012) row(d, yF, dF, sF, 1, floorPix, r0x, r0y, r1x, r1y, cam);
        else flat(d, yF);
      }
      if (okC) {
        var dC = projDist * head / p;
        var sC = Math.exp(-dC * 0.115);
        if (sC > 0.012) row(d, yC, dC, sC, 0.5, ceilPix, r0x, r0y, r1x, r1y, cam);
        else flat(d, yC);
      }
    }
    L.ctx.putImageData(planeImg, 0, 0);
  }

  function flat(d, y) {
    var off = y * W * 4;
    for (var x = 0; x < W; x++) {
      d[off] = FOG_R; d[off + 1] = FOG_G; d[off + 2] = FOG_B; d[off + 3] = 255;
      off += 4;
    }
  }

  function row(d, y, dist, fogS, mul, pix, r0x, r0y, r1x, r1y, cam) {
    var TS = Art.TS, TSm = TS - 1;
    var stepX = dist * (r1x - r0x) / W * 2;
    var stepY = dist * (r1y - r0y) / W * 2;
    var fx = cam.x + dist * r0x, fy = cam.y + dist * r0y;
    var off = y * W * 4;
    var k = fogS * mul, inv = 1 - fogS;
    var ar = FOG_R * inv, ag = FOG_G * inv, ab = FOG_B * inv;
    for (var x = 0; x < W; x += 2) {
      var si = (((fy * TS) & TSm) * TS + ((fx * TS) & TSm)) << 2;
      var r = pix[si] * k + ar, g2 = pix[si + 1] * k + ag, b = pix[si + 2] * k + ab;
      d[off] = r; d[off + 1] = g2; d[off + 2] = b; d[off + 3] = 255;
      d[off + 4] = r; d[off + 5] = g2; d[off + 6] = b; d[off + 7] = 255;
      off += 8;
      fx += stepX; fy += stepY;
    }
  }

  /* ── Backdrop ─────────────────────────────────────────────────────────*/
  function backdrop(g) {
    var sky = g.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#07060c');
    sky.addColorStop(0.72, '#14121d');
    sky.addColorStop(1, '#221f2e');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, horizon + 1);

    var flr = g.createLinearGradient(0, horizon, 0, H);
    flr.addColorStop(0, '#1a1720');
    flr.addColorStop(0.35, '#2a2430');
    flr.addColorStop(1, '#413628');
    g.fillStyle = flr;
    g.fillRect(0, horizon, W, H - horizon);
  }

  /* ── Walls ────────────────────────────────────────────────────────────*/
  function walls(L, cam) {
    var g = L.ctx, dep = L.depth;
    var ca = Math.cos(cam.ang), sa = Math.sin(cam.ang);
    var dirX = ca, dirY = sa;
    var plX = -sa * tanHalf, plY = ca * tanHalf;
    var skipX = cam.skipX == null ? -1 : cam.skipX;
    var skipY = cam.skipY == null ? -1 : cam.skipY;

    for (var x = 0; x < W; x++) {
      var camx = 2 * x / W - 1;
      var rdx = dirX + plX * camx, rdy = dirY + plY * camx;
      var r = World.castRay(cam.x, cam.y, rdx, rdy, MAX_DIST, skipX, skipY);
      if (!r.hit) { dep[x] = MAX_DIST; continue; }

      var d = Math.max(0.05, r.dist);
      dep[x] = d;
      var scale = projDist / d;
      var top = horizon + (cam.z - 1) * scale;
      var tex = r.tileV === World.PANEL ? Art.texPanel : Art.texStone;
      var tx = (r.wallX * Art.TS) | 0;
      if (tx >= Art.TS) tx = Art.TS - 1;

      g.drawImage(tex, tx, 0, 1, Art.TS, x, top, 1, scale);

      var fog = 1 - Math.exp(-d * 0.115);
      if (r.side === 1) fog += 0.13;
      var fi = (fog * 64) | 0;
      if (fi > 62) fi = 62;
      if (fi > 0) {
        g.fillStyle = FOG[fi];
        g.fillRect(x, top, 1, scale);
      }
    }
  }

  /* ── Floor decals ─────────────────────────────────────────────────────*/
  function drawDecals(L, cam) {
    if (!decals.length) return;
    var g = L.ctx, dep = L.depth;
    var ca = Math.cos(cam.ang), sa = Math.sin(cam.ang);
    for (var i = 0; i < decals.length; i++) {
      var s = decals[i];
      var dx = s.x - cam.x, dy = s.y - cam.y;
      var tz = dx * ca + dy * sa;
      if (tz <= 0.2 || tz > MAX_DIST) continue;
      var tx = -dx * sa + dy * ca;
      var scale = projDist / tz;
      var sx = W / 2 + tx * scale;
      var sy = horizon + cam.z * scale;
      var wpx = s.s * scale, hpx = s.s * scale * 0.42;
      if (sx + wpx < 0 || sx - wpx > W || sy + hpx < 0 || sy - hpx > H) continue;
      var col = Math.max(0, Math.min(W - 1, sx | 0));
      if (dep[col] < tz) continue;
      g.globalAlpha = s.a * Math.max(0, 1 - tz / 26);
      g.drawImage(s.img, sx - wpx / 2, sy - hpx / 2, wpx, hpx);
      g.globalAlpha = 1;
    }
  }

  /* Sprites are fogged by re-drawing them into a transparent scratch and
     tinting with source-atop, which only touches the sprite's own pixels. */
  var scratch = null, sctx = null;
  function tinted(img, w, h, fog) {
    if (!scratch) {
      scratch = Art.make(560, 560);
      sctx = scratch.getContext('2d');
    }
    sctx.clearRect(0, 0, w, h);
    sctx.globalCompositeOperation = 'source-over';
    sctx.drawImage(img, 0, 0, w, h);
    sctx.globalCompositeOperation = 'source-atop';
    sctx.globalAlpha = fog;
    sctx.fillStyle = '#0b0a12';
    sctx.fillRect(0, 0, w, h);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = 'source-over';
    return scratch;
  }

  /* ── Billboards, clipped per column against the depth buffer ─────────*/
  function drawSprites(L, cam) {
    var g = L.ctx, dep = L.depth;
    var ca = Math.cos(cam.ang), sa = Math.sin(cam.ang);
    var list = [];
    for (var i = 0; i < sprites.length; i++) {
      var s = sprites[i];
      var dx = s.x - cam.x, dy = s.y - cam.y;
      var tz = dx * ca + dy * sa;
      // Anything at the lens fills the screen with one blown-up sprite, so
      // hold a near plane and fade the last half-metre into it.
      if (tz <= 0.42 || tz > MAX_DIST) continue;
      var near = tz < 0.95 ? (tz - 0.42) / 0.53 : 1;
      var tx = -dx * sa + dy * ca;
      var scale = projDist / tz;
      var sx = W / 2 + tx * scale;
      var sw = s.w * scale, sh = s.h * scale;
      var reach = Math.max(sw, sh) * 0.8;
      if (sx + reach < 0 || sx - reach > W) continue;
      list.push({ s: s, tz: tz, sx: sx, sw: sw, sh: sh, scale: scale, near: near });
    }
    list.sort(function (a, b) { return b.tz - a.tz; });

    for (var k = 0; k < list.length; k++) {
      var it = list[k], sp = it.s;
      var reach2 = Math.max(it.sw, it.sh) * (sp.rot ? 0.72 : 0.5);
      var x0 = Math.max(0, Math.floor(it.sx - reach2));
      var x1 = Math.min(W - 1, Math.ceil(it.sx + reach2));
      if (x1 < x0) continue;
      var top = horizon + (cam.z - (sp.z + sp.h / 2)) * it.scale;

      // fog the sprite into the chamber
      var fog = Math.min(0.7, 1 - Math.exp(-it.tz * 0.1));
      var img = sp.img, iw = sp.img.width, ih = sp.img.height;
      var pw = Math.max(1, Math.round(it.sw)), ph = Math.max(1, Math.round(it.sh));
      if (fog > 0.04 && pw <= 560 && ph <= 560) {
        img = tinted(sp.img, pw, ph, fog);
        iw = pw; ih = ph;
      }

      var runStart = -1;
      for (var x = x0; x <= x1 + 1; x++) {
        var vis = x <= x1 && dep[x] > it.tz;
        if (vis && runStart < 0) runStart = x;
        if (!vis && runStart >= 0) {
          paint(g, sp, it, runStart, x - runStart, top, img, iw, ih);
          runStart = -1;
        }
      }
    }
  }

  function paint(g, sp, it, rx, rw, top, img, iw, ih) {
    g.save();
    g.beginPath();
    g.rect(rx, 0, rw, H);
    g.clip();
    g.globalAlpha = sp.a * it.near;
    if (sp.rot) {
      g.translate(it.sx, top + it.sh / 2);
      g.rotate(sp.rot);
      g.drawImage(img, 0, 0, iw, ih, -it.sw / 2, -it.sh / 2, it.sw, it.sh);
    } else {
      g.drawImage(img, 0, 0, iw, ih, it.sx - it.sw / 2, top, it.sw, it.sh);
    }
    g.restore();
  }

  /* ── Glows: bolts, aperture light, sparks ────────────────────────────*/
  function drawGlows(L, cam) {
    if (!glows.length) return;
    var g = L.ctx, dep = L.depth;
    var ca = Math.cos(cam.ang), sa = Math.sin(cam.ang);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < glows.length; i++) {
      var s = glows[i];
      var dx = s.x - cam.x, dy = s.y - cam.y;
      var tz = dx * ca + dy * sa;
      if (tz <= 0.15 || tz > MAX_DIST) continue;
      var tx = -dx * sa + dy * ca;
      var scale = projDist / tz;
      var sx = W / 2 + tx * scale, sy = horizon + (cam.z - s.z) * scale;
      var rad = s.r * scale;
      if (sx + rad < 0 || sx - rad > W) continue;
      var col = Math.max(0, Math.min(W - 1, sx | 0));
      if (dep[col] < tz - 0.15) continue;
      var gr = g.createRadialGradient(sx, sy, 0, sx, sy, rad);
      gr.addColorStop(0, 'rgba(255,255,255,' + (0.85 * s.a).toFixed(3) + ')');
      gr.addColorStop(0.35, s.c);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = s.a;
      g.fillStyle = gr;
      g.beginPath();
      g.arc(sx, sy, rad, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    g.globalAlpha = 1;
  }

  /* ── Apertures ────────────────────────────────────────────────────────
     Each recursion depth owns its span buffers: rendering the view through
     an aperture runs the same code one level down, and a shared buffer
     would be overwritten before the outer level composited with it.      */
  var spanBufs = [];

  function spans(depth) {
    var b = spanBufs[depth];
    if (!b || b.top.length !== W) {
      b = spanBufs[depth] = {
        top: new Float32Array(W),
        bot: new Float32Array(W),
        cover: new Uint8Array(W)
      };
    }
    return b;
  }

  function portalSpans(L, cam, p, time, sb) {
    var topY = sb.top, botY = sb.bot, cover = sb.cover;
    var dep = L.depth;
    var ca = Math.cos(cam.ang), sa = Math.sin(cam.ang);
    var dirX = ca, dirY = sa;
    var plX = -sa * tanHalf, plY = ca * tanHalf;
    var open = Math.min(1, (time - p.born) / 0.22);
    open = 1 - Math.pow(1 - open, 3);
    var hw = p.halfW * open, hh = p.halfH * open;
    var any = false;

    for (var x = 0; x < W; x++) {
      cover[x] = 0;
      var camx = 2 * x / W - 1;
      var rdx = dirX + plX * camx, rdy = dirY + plY * camx;
      var den = rdx * p.nx + rdy * p.ny;
      if (den > -1e-6) continue;                    // facing the back of it
      var t = ((p.cx - cam.x) * p.nx + (p.cy - cam.y) * p.ny) / den;
      if (t <= 0.05 || t > MAX_DIST) continue;
      if (dep[x] < t - 0.06) continue;              // a wall is in the way
      var hx = cam.x + rdx * t, hy = cam.y + rdy * t;
      var s = (hx - p.cx) * p.tx + (hy - p.cy) * p.ty;
      var q = s / hw;
      if (q <= -1 || q >= 1) continue;
      var f = Math.sqrt(1 - q * q);
      var scale = projDist / t;
      topY[x] = horizon + (cam.z - (p.z + hh * f)) * scale;
      botY[x] = horizon + (cam.z - (p.z - hh * f)) * scale;
      cover[x] = 1;
      any = true;
    }
    return any;
  }

  function ovalPath(g, sb, x0, x1) {
    var topY = sb.top, botY = sb.bot;
    g.beginPath();
    g.moveTo(x0, topY[x0]);
    for (var x = x0; x <= x1; x++) g.lineTo(x + 0.5, topY[x]);
    g.lineTo(x1 + 1, topY[x1]);
    for (var b = x1; b >= x0; b--) g.lineTo(b + 0.5, botY[b]);
    g.lineTo(x0, botY[x0]);
    g.closePath();
  }

  function drawPortal(L, cam, p, depth, time) {
    var sb = spans(depth);
    if (!portalSpans(L, cam, p, time, sb)) return;
    var cover = sb.cover, topY = sb.top, botY = sb.bot;
    var g = L.ctx;
    var twin = World.other(p);
    var view = null;

    if (twin && depth < maxDepth) {
      var sub = { x: 0, y: 0, z: 0, ang: 0, skipX: twin.mapX, skipY: twin.mapY };
      World.throughCamera(p, cam, sub);
      renderView(depth + 1, sub, twin, time);
      view = layers[depth + 1].canvas;
    }

    var runStart = -1;
    for (var x = 0; x <= W; x++) {
      var on = x < W && cover[x];
      if (on && runStart < 0) runStart = x;
      if (!on && runStart >= 0) {
        var x0 = runStart, x1 = x - 1;
        g.save();
        ovalPath(g, sb, x0, x1);
        g.clip();
        if (view) {
          g.drawImage(view, 0, 0);
        } else {
          // unlinked: a closed, simmering pool of colour
          var mid = (x0 + x1) / 2;
          var gr = g.createLinearGradient(0, topY[x0 | 0], 0, botY[x0 | 0]);
          gr.addColorStop(0, p.color.deep);
          gr.addColorStop(0.5, 'rgba(0,0,0,0.85)');
          gr.addColorStop(1, p.color.deep);
          g.fillStyle = gr;
          g.fillRect(x0, 0, x1 - x0 + 2, H);
          g.globalCompositeOperation = 'lighter';
          for (var k = 0; k < 3; k++) {
            var ph = time * 1.7 + k * 2.1;
            g.fillStyle = p.color.glow;
            g.globalAlpha = 0.22;
            var yy = (topY[x0 | 0] + botY[x0 | 0]) / 2 + Math.sin(ph) * (botY[x0 | 0] - topY[x0 | 0]) * 0.22;
            g.fillRect(x0, yy - 2, x1 - x0 + 2, 4);
          }
          g.globalAlpha = 1;
          void mid;
        }
        g.restore();

        // rim: a hot inner edge and a soft bloom, dimmer the deeper we go
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = depth ? 0.4 : 1;
        ovalPath(g, sb, x0, x1);
        g.strokeStyle = p.color.glow;
        g.lineWidth = 3.2;
        g.stroke();
        g.strokeStyle = p.color.bright;
        g.lineWidth = 1;
        g.globalAlpha = depth ? 0.35 : 0.8;
        g.stroke();
        g.restore();

        runStart = -1;
      }
    }
  }

  /* ── One view ─────────────────────────────────────────────────────────*/
  function renderView(depth, cam, skipPortal, time) {
    var L = layers[depth];
    if (depth === 0 || (depth === 1 && maxDepth > 1)) planes(L, cam);
    else backdrop(L.ctx);
    walls(L, cam);
    drawDecals(L, cam);
    var ps = World.portals;
    if (ps.blue && ps.blue !== skipPortal) drawPortal(L, cam, ps.blue, depth, time);
    if (ps.orange && ps.orange !== skipPortal) drawPortal(L, cam, ps.orange, depth, time);
    drawSprites(L, cam);
    drawGlows(L, cam);
  }

  function frame(cam, time) {
    renderView(0, cam, null, time);
    return layers[0].canvas;
  }

  /* Depth of the main view at a screen column, for HUD occlusion. */
  function depthAt(col) {
    if (!layers.length) return 0;
    var d = layers[0].depth;
    var i = col | 0;
    if (i < 0) i = 0; else if (i >= W) i = W - 1;
    return d[i];
  }

  return {
    setSize: setSize, setMaxDepth: setMaxDepth,
    frame: frame, project: project, depthAt: depthAt,
    clearFrame: clearFrame, addSprite: addSprite, addDecal: addDecal, addGlow: addGlow,
    get width() { return W; },
    get height() { return H; },
    get horizon() { return horizon; },
    get projDist() { return projDist; },
    FOV: FOV
  };
})();
