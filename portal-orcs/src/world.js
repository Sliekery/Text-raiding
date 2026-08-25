/* ── World ────────────────────────────────────────────────────────────────
   The chamber grid, the ray marcher, and the aperture maths. One world
   unit is one grid cell and one wall is one unit tall.                    */
'use strict';

var World = (function () {

  var MW = 32, MH = 24;
  var EMPTY = 0, STONE = 1, PANEL = 2;
  var grid = new Uint8Array(MW * MH);

  function idx(x, y) { return y * MW + x; }
  function tile(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return STONE;
    return grid[idx(x, y)];
  }
  function setTile(x, y, v) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return;
    grid[idx(x, y)] = v;
  }
  function rect(x, y, w, h, v) {
    for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) setTile(i, j, v);
  }

  function build() {
    grid.fill(EMPTY);
    // Outer shell: bands of rune-panel set into mossy stone.
    for (var x = 0; x < MW; x++) {
      var pv = (x % 9 >= 2 && x % 9 <= 5) ? PANEL : STONE;
      setTile(x, 0, pv); setTile(x, MH - 1, pv);
    }
    for (var y = 0; y < MH; y++) {
      var pv2 = (y % 8 >= 2 && y % 8 <= 5) ? PANEL : STONE;
      setTile(0, y, pv2); setTile(MW - 1, y, pv2);
    }

    // The test cube at the heart of the chamber: panel on every face.
    rect(14, 10, 4, 4, PANEL);

    // Two free-standing panel walls to bank shots off. Each runs past a
    // rune font, so there is always a surface to open an aperture beside
    // the thing you are defending.
    rect(4, 6, 9, 1, PANEL);
    rect(19, 17, 9, 1, PANEL);

    // Stone buttresses that refuse the enchantment.
    rect(6, 15, 1, 4, STONE);
    rect(6, 18, 4, 1, STONE);
    rect(25, 5, 1, 4, STONE);
    rect(22, 5, 4, 1, STONE);

    // Lone pillars: bowling pins for flung orcs.
    [[10, 11], [21, 12], [12, 20], [20, 3], [4, 10], [27, 15]].forEach(function (p) {
      setTile(p[0], p[1], STONE);
    });

    // Alcove of panels behind the player: the classic infinite corridor.
    rect(15, 21, 2, 1, PANEL);
  }
  build();

  var SPAWNS = [
    [2.5, 2.5], [29.5, 2.5], [2.5, 21.5], [29.5, 21.5],
    [16.5, 2.5], [8.5, 21.5], [24.5, 12.5], [4.5, 12.5]
  ];

  function isSolid(x, y) { return tile(x, y) !== EMPTY; }

  /* ── Apertures ─────────────────────────────────────────────────────────
     An aperture is an oval hole punched in one face of one cell. It stores
     its own frame: n (out of the wall), t (along the wall), and up = +z.  */
  var HALF_W = 0.30, HALF_H = 0.42, MID_Z = 0.50;

  var portals = { blue: null, orange: null };

  var COLORS = {
    blue:   { key: 'blue',   bright: '#8fe3ff', deep: '#0a2f57', glow: 'rgba(78,195,255,0.55)', rgb: [78, 195, 255] },
    orange: { key: 'orange', bright: '#ffc48a', deep: '#5a2405', glow: 'rgba(255,138,60,0.55)', rgb: [255, 138, 60] }
  };

  function other(p) {
    if (!p) return null;
    var o = portals[p.key === 'blue' ? 'orange' : 'blue'];
    return o || null;
  }

  function linked() { return portals.blue && portals.orange; }

  /* Place an aperture on the face a ray struck. Returns false if refused. */
  function place(key, hit, time) {
    if (!hit.hit || hit.tileV !== PANEL) return false;

    var fcx = hit.mapX + 0.5 + hit.nx * 0.5;
    var fcy = hit.mapY + 0.5 + hit.ny * 0.5;
    var tx = -hit.ny, ty = hit.nx;
    var hx = hit.x, hy = hit.y;
    var s = (hx - fcx) * tx + (hy - fcy) * ty;
    s = Math.max(-0.2, Math.min(0.2, s));

    var zc = MID_Z;
    var twin = portals[key === 'blue' ? 'orange' : 'blue'];
    if (twin && twin.mapX === hit.mapX && twin.mapY === hit.mapY &&
        twin.nx === hit.nx && twin.ny === hit.ny && Math.abs(twin.s - s) < 0.58) {
      return false; // the two apertures would overlap on the same face
    }

    portals[key] = {
      key: key,
      color: COLORS[key],
      mapX: hit.mapX, mapY: hit.mapY,
      nx: hit.nx, ny: hit.ny,
      tx: tx, ty: ty,
      s: s,
      cx: fcx + tx * s + hit.nx * 0.001,
      cy: fcy + ty * s + hit.ny * 0.001,
      z: zc,
      halfW: HALF_W, halfH: HALF_H,
      born: time
    };
    return true;
  }

  function clear() { portals.blue = null; portals.orange = null; }

  /* Is this point inside an aperture's opening? Then it is not wall. */
  function openingAt(px, py, pz, margin) {
    var m = margin || 0;
    for (var k in portals) {
      var p = portals[k];
      if (!p) continue;
      if (Math.floor(px) !== p.mapX || Math.floor(py) !== p.mapY) continue;
      var s = (px - p.cx) * p.tx + (py - p.cy) * p.ty;
      var dz = pz - p.z;
      if (Math.abs(s) < p.halfW - m && Math.abs(dz) < p.halfH - m) return p;
    }
    return null;
  }

  function blocked(px, py, pz) {
    if (!isSolid(Math.floor(px), Math.floor(py))) return false;
    if (!linked()) return true;
    return !openingAt(px, py, pz, 0.03);
  }

  /* Move a body's centre through an aperture, preserving momentum.
     Portal's rule: what goes in fast comes out fast.                      */
  function transfer(body, prevX, prevY, prevZ) {
    if (!linked()) return null;
    for (var k in portals) {
      var p = portals[k];
      if (!p) continue;
      var o = other(p);
      if (!o) continue;
      var dPrev = (prevX - p.cx) * p.nx + (prevY - p.cy) * p.ny;
      var dNow = (body.x - p.cx) * p.nx + (body.y - p.cy) * p.ny;
      if (!(dPrev > 0 && dNow <= 0)) continue;

      var f = dPrev / (dPrev - dNow || 1e-6);
      var hx = prevX + (body.x - prevX) * f;
      var hy = prevY + (body.y - prevY) * f;
      var hz = prevZ + (body.z - prevZ) * f;
      var sHit = (hx - p.cx) * p.tx + (hy - p.cy) * p.ty;
      var dzHit = hz - p.z;
      var e = (sHit / p.halfW) * (sHit / p.halfW) + (dzHit / p.halfH) * (dzHit / p.halfH);
      if (e > 1) continue;

      var sBody = (body.x - p.cx) * p.tx + (body.y - p.cy) * p.ty;
      var nOut = -dNow, tOut = -sBody;
      body.x = o.cx + o.nx * nOut + o.tx * tOut;
      body.y = o.cy + o.ny * nOut + o.ty * tOut;
      body.z = o.z + (body.z - p.z);

      var vn = body.vx * p.nx + body.vy * p.ny;
      var vt = body.vx * p.tx + body.vy * p.ty;
      body.vx = o.nx * -vn + o.tx * -vt;
      body.vy = o.ny * -vn + o.ty * -vt;

      if (typeof body.ang === 'number') {
        var dx = Math.cos(body.ang), dy = Math.sin(body.ang);
        var dn = dx * p.nx + dy * p.ny, dt = dx * p.tx + dy * p.ty;
        body.ang = Math.atan2(o.ny * -dn + o.ty * -dt, o.nx * -dn + o.tx * -dt);
      }
      return o;
    }
    return null;
  }

  /* The same transform, applied to a camera for rendering through. */
  function throughCamera(p, cam, out) {
    var o = other(p);
    if (!o) return null;
    var dn = (cam.x - p.cx) * p.nx + (cam.y - p.cy) * p.ny;
    var dt = (cam.x - p.cx) * p.tx + (cam.y - p.cy) * p.ty;
    out.x = o.cx + o.nx * -dn + o.tx * -dt;
    out.y = o.cy + o.ny * -dn + o.ty * -dt;
    out.z = o.z + (cam.z - p.z);
    var dx = Math.cos(cam.ang), dy = Math.sin(cam.ang);
    var an = dx * p.nx + dy * p.ny, at = dx * p.tx + dy * p.ty;
    out.ang = Math.atan2(o.ny * -an + o.ty * -at, o.nx * -an + o.tx * -at);
    out.inCell = o;
    return o;
  }

  /* ── Ray marching ──────────────────────────────────────────────────────
     Classic grid DDA. Returns perpendicular distance so wall columns get
     no fisheye. `skipCell` lets a camera start inside a wall.            */
  var RAY = {
    hit: false, dist: 0, mapX: 0, mapY: 0, side: 0,
    nx: 0, ny: 0, wallX: 0, tileV: 0, x: 0, y: 0
  };

  function castRay(ox, oy, rdx, rdy, maxDist, skipX, skipY) {
    var mapX = Math.floor(ox), mapY = Math.floor(oy);
    var ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
    var ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
    var stepX, stepY, sdx, sdy;

    if (rdx < 0) { stepX = -1; sdx = (ox - mapX) * ddx; }
    else { stepX = 1; sdx = (mapX + 1 - ox) * ddx; }
    if (rdy < 0) { stepY = -1; sdy = (oy - mapY) * ddy; }
    else { stepY = 1; sdy = (mapY + 1 - oy) * ddy; }

    var side = 0, dist = 0;
    for (var g = 0; g < 128; g++) {
      if (sdx < sdy) { dist = sdx; sdx += ddx; mapX += stepX; side = 0; }
      else { dist = sdy; sdy += ddy; mapY += stepY; side = 1; }

      if (dist > maxDist) break;
      if (mapX < 0 || mapY < 0 || mapX >= MW || mapY >= MH) break;
      if (mapX === skipX && mapY === skipY) continue;

      var t = grid[idx(mapX, mapY)];
      if (t !== EMPTY) {
        RAY.hit = true;
        RAY.dist = dist;
        RAY.mapX = mapX; RAY.mapY = mapY;
        RAY.side = side;
        RAY.tileV = t;
        RAY.nx = side === 0 ? -stepX : 0;
        RAY.ny = side === 1 ? -stepY : 0;
        RAY.x = ox + rdx * dist;
        RAY.y = oy + rdy * dist;
        var w = side === 0 ? RAY.y : RAY.x;
        RAY.wallX = w - Math.floor(w);
        if (side === 0 && stepX > 0) RAY.wallX = 1 - RAY.wallX;
        if (side === 1 && stepY < 0) RAY.wallX = 1 - RAY.wallX;
        return RAY;
      }
    }
    RAY.hit = false;
    RAY.dist = maxDist;
    RAY.x = ox + rdx * maxDist;
    RAY.y = oy + rdy * maxDist;
    return RAY;
  }

  /* Line of sight for the orcs, and for aiming. Apertures do not block. */
  function clearPath(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var len = Math.hypot(dx, dy);
    if (len < 1e-4) return true;
    var r = castRay(ax, ay, dx / len, dy / len, len, -1, -1);
    return !r.hit || r.dist >= len - 0.02;
  }

  function randomSpawn() {
    return SPAWNS[(Math.random() * SPAWNS.length) | 0];
  }

  return {
    MW: MW, MH: MH, EMPTY: EMPTY, STONE: STONE, PANEL: PANEL,
    tile: tile, isSolid: isSolid, blocked: blocked, openingAt: openingAt,
    portals: portals, place: place, clear: clear, other: other, linked: linked,
    transfer: transfer, throughCamera: throughCamera,
    castRay: castRay, clearPath: clearPath,
    HALF_W: HALF_W, HALF_H: HALF_H,
    SPAWNS: SPAWNS, randomSpawn: randomSpawn,
    COLORS: COLORS
  };
})();
