/* Cinder Keep / Undead Burg PoC — core: renderer, PS1 shader, textures, geometry, 3D collision world, particles, audio.
   Classic scripts share one global scope; files load in order: core, rig, level, actors, ui, main. */
'use strict';
const $ = s => document.querySelector(s);
const TAU = Math.PI * 2, V3 = THREE.Vector3;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const dampAng = (a, b, k, dt) => a + angDiff(a, b) * (1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const ease = t => t * t * (3 - 2 * t);
const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const store = { get(k, d) { try { const v = localStorage.getItem('ck2_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('ck2_' + k, JSON.stringify(v)); } catch (e) {} } };
const tmpV = new V3(), tmpV2 = new V3();

/* ---------------- renderer ---------------- */
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
const FOG = new THREE.Color(0x6e5644);
scene.background = FOG;
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 170);

const U = {
  uSnap: { value: new THREE.Vector2(160, 120) },
  uAmbient: { value: new THREE.Color(0.33, 0.3, 0.31) },
  uSunDir: { value: new V3(0.62, -0.5, -0.6).normalize() },
  uSunCol: { value: new THREE.Color(0.86, 0.64, 0.42) },
  uPL: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, -999, 0, 0.001)) },
  uPLC: { value: Array.from({ length: 8 }, () => new THREE.Color(0, 0, 0)) },
  uFogNear: { value: 12 }, uFogFar: { value: 62 }, uFogColor: { value: FOG },
};
const VS = `
uniform vec2 uSnap; uniform vec3 uAmbient; uniform vec3 uSunDir; uniform vec3 uSunCol;
uniform vec4 uPL[8]; uniform vec3 uPLC[8]; uniform float uFogNear; uniform float uFogFar; uniform float uNoFog; uniform float uShade;
varying vec3 vLight; varying vec3 vAff; varying float vFog;
void main(){
  vec4 wp = modelMatrix*vec4(position,1.0);
  vec3 n = normalize(mat3(modelMatrix)*normal);
  vec3 l = uAmbient*uShade + uSunCol*max(dot(n,-uSunDir),0.0)*uShade;
  for(int i=0;i<8;i++){
    vec3 d = uPL[i].xyz - wp.xyz; float dist = length(d);
    float att = clamp(1.0 - dist/uPL[i].w, 0.0, 1.0); att *= att;
    float ndl = max(dot(n, d/max(dist,0.0001)), 0.0);
    l += uPLC[i]*att*(0.35+0.65*ndl);
  }
  vLight = min(l, vec3(1.8));
  vec4 mv = viewMatrix*wp;
  vec4 p = projectionMatrix*mv;
  if(p.w>0.0){ p.xy = floor(p.xy/p.w*uSnap+0.5)/uSnap*p.w; }
  gl_Position = p;
  vAff = vec3(uv*p.w, p.w);
  vFog = uNoFog>0.5 ? 0.0 : smoothstep(uFogNear,uFogFar,-mv.z);
}`;
const FS = `
uniform sampler2D map; uniform vec3 uColor; uniform vec3 uEmissive; uniform vec3 uFogColor;
uniform float uFlash; uniform float uAlpha; uniform float uAlphaTest; uniform vec2 uScroll;
varying vec3 vLight; varying vec3 vAff; varying float vFog;
float bayer(vec2 p){ vec2 q=mod(floor(p),4.0); vec2 a=mod(q,2.0); vec2 c=floor(q/2.0);
  float m1=mod(a.x+a.y,2.0)*2.0+a.y; float m2=mod(c.x+c.y,2.0)*2.0+c.y; return (m1*4.0+m2)/16.0; }
void main(){
  vec4 t = texture2D(map, vAff.xy/vAff.z + uScroll);
  float a = t.a*uAlpha;
  if(a < uAlphaTest) discard;
  vec3 c = t.rgb*uColor*vLight + t.rgb*uEmissive;
  c = mix(c, vec3(1.0,0.93,0.86), uFlash);
  c = mix(c, uFogColor, vFog);
  c = floor(c*31.0 + bayer(gl_FragCoord.xy)) / 31.0;
  gl_FragColor = vec4(c, a);
}`;
const DS = THREE.DoubleSide;
function mat(tex, color = 0xffffff, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, map: { value: tex || TX.white }, uColor: { value: new THREE.Color(color) }, uEmissive: { value: new THREE.Color(o.emissive || 0) },
      uFlash: { value: 0 }, uAlpha: { value: o.alpha ?? 1 }, uAlphaTest: { value: o.alphaTest ?? 0.5 }, uScroll: { value: new THREE.Vector2() }, uNoFog: { value: o.noFog ? 1 : 0 }, uShade: { value: o.shade ?? 1 } },
    vertexShader: VS, fragmentShader: FS, transparent: !!o.transparent, depthWrite: o.depthWrite ?? !o.transparent,
    side: o.side ?? THREE.FrontSide, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending
  });
}

/* ---------------- textures (procedural, tiny, nearest-filtered) ---------------- */
function makeTex(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function grain(g, s, amt) { const d = g.getImageData(0, 0, s, s), a = d.data; for (let i = 0; i < a.length; i += 4) { if (a[i + 3] === 0) continue; const n = (Math.random() - .5) * amt; a[i] += n; a[i + 1] += n; a[i + 2] += n; } g.putImageData(d, 0, 0); }
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;
const TX = {};
TX.white = makeTex(4, (g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); });
TX.cobble = makeTex(64, (g, s) => { g.fillStyle = '#2a241e'; g.fillRect(0, 0, s, s); const n = 4, c = s / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const px = x * c + (y % 2) * c / 2; g.fillStyle = hsl(34 + rand(-8, 8), rand(8, 16), rand(30, 44)); g.fillRect(px + 1, y * c + 1, c - 3, c - 3); if (px + c > s) g.fillRect(px + 1 - s, y * c + 1, c - 3, c - 3); g.fillStyle = 'rgba(255,240,210,.1)'; g.fillRect(px + 1, y * c + 1, c - 3, 1); } for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(70,90,45,${rand(.15, .4)})`; g.fillRect(rand(0, s), rand(0, s), rand(1, 3), rand(1, 3)); } grain(g, s, 24); });
TX.slab = makeTex(64, (g, s) => { g.fillStyle = '#1c1a1e'; g.fillRect(0, 0, s, s); for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = hsl(30 + rand(-10, 10), rand(4, 10), rand(26, 34)); g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); } for (let i = 0; i < 8; i++) { g.strokeStyle = 'rgba(0,0,0,.45)'; g.beginPath(); let x = rand(0, s), y = rand(0, s); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += rand(-8, 8); y += rand(-8, 8); g.lineTo(x, y); } g.stroke(); } grain(g, s, 20); });
TX.wall = makeTex(64, (g, s) => { g.fillStyle = '#2e2822'; g.fillRect(0, 0, s, s); const rows = [0, 12, 25, 38, 51, 64];
  for (let r = 0; r < rows.length - 1; r++) { const y0 = rows[r], h = rows[r + 1] - y0; let x = -(r % 2) * 9; while (x < s) { const w = rand(14, 24) | 0; g.fillStyle = hsl(36 + rand(-6, 6), rand(7, 15), rand(34, 47));
    for (const ox of [0, -s, s]) g.fillRect(x + 1 + ox, y0 + 1, w - 2, h - 2); g.fillStyle = 'rgba(255,240,220,.13)'; g.fillRect(x + 1, y0 + 1, w - 2, 1); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x + 1, y0 + h - 2, w - 2, 1); x += w; } }
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${rand(30, 50) | 0},${rand(45, 60) | 0},25,${rand(.1, .35)})`; g.fillRect(rand(0, s), rand(0, s), rand(1, 3), rand(1, 4)); } grain(g, s, 22); });
TX.plaster = makeTex(32, (g, s) => { g.fillStyle = '#8a7a64'; g.fillRect(0, 0, s, s); for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${rand(40, 70) | 0},${rand(35, 55) | 0},30,${rand(.1, .3)})`; g.fillRect(rand(0, s), rand(0, s), rand(2, 6), rand(2, 6)); } g.fillStyle = 'rgba(40,30,20,.5)'; for (let i = 0; i < 3; i++) g.fillRect(rand(0, s), rand(0, s), rand(4, 9), rand(3, 6)); grain(g, s, 20); });
TX.timber = makeTex(32, (g, s) => { g.fillStyle = '#8a7a64'; g.fillRect(0, 0, s, s); grain(g, s, 18); g.fillStyle = '#3a2618'; g.fillRect(0, 0, 3, s); g.fillRect(0, 0, s, 3); g.fillRect(0, 16, s, 2); g.save(); g.translate(3, 18); g.rotate(-.75); g.fillRect(0, 0, 20, 2); g.restore(); grain(g, s, 14); });
TX.dirt = makeTex(32, (g, s) => { g.fillStyle = '#2e281f'; g.fillRect(0, 0, s, s); for (let i = 0; i < 40; i++) { g.fillStyle = hsl(rand(20, 90), rand(10, 25), rand(12, 24)); g.fillRect(rand(0, s), rand(0, s), rand(1, 4), rand(1, 3)); } grain(g, s, 20); });
TX.plate = makeTex(32, (g, s) => { const gr = g.createLinearGradient(0, 0, s, 0); gr.addColorStop(0, '#55555a'); gr.addColorStop(.42, '#c4c4c8'); gr.addColorStop(.58, '#96969c'); gr.addColorStop(1, '#46464c'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 10, s, 1); g.fillRect(0, 21, s, 1); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 11, s, 1); g.fillRect(0, 22, s, 1); for (let x = 3; x < s; x += 8) { g.fillStyle = '#222'; g.fillRect(x, 5, 1, 1); g.fillRect(x, 16, 1, 1); g.fillRect(x, 27, 1, 1); } grain(g, s, 18); });
TX.chain = makeTex(16, (g, s) => { g.fillStyle = '#242426'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 2) for (let x = (y / 2) % 2; x < s; x += 2) { const v = rand(100, 160) | 0; g.fillStyle = `rgb(${v},${v},${v + 6})`; g.fillRect(x, y, 1, 1); } });
TX.leather = makeTex(16, (g, s) => { g.fillStyle = '#6a4a30'; g.fillRect(0, 0, s, s); for (let y = 2; y < s; y += 5) { g.fillStyle = 'rgba(20,10,4,.5)'; g.fillRect(0, y, s, 1); } grain(g, s, 26); });
TX.skin = makeTex(16, (g, s) => { g.fillStyle = '#6a5a48'; g.fillRect(0, 0, s, s); for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(30,20,12,.45)'; g.fillRect(rand(0, s) | 0, rand(0, s) | 0, 1, rand(2, 5) | 0); } for (let y = 3; y < 12; y += 3) { g.fillStyle = 'rgba(20,12,8,.35)'; g.fillRect(0, y, s, 1); } grain(g, s, 26); });
TX.face = makeTex(16, (g, s) => { g.fillStyle = '#6e5e4c'; g.fillRect(0, 0, s, s); grain(g, s, 20); g.fillStyle = '#0e0906'; g.fillRect(2, 6, 2, 2); g.fillRect(5, 6, 2, 2); g.fillStyle = '#24180f'; g.fillRect(3, 10, 3, 1); g.fillStyle = 'rgba(30,20,10,.5)'; g.fillRect(4, 8, 1, 2); g.fillRect(1, 4, 7, 1); });
TX.cloth = makeTex(16, (g, s) => { g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 2) { g.fillStyle = `rgba(0,0,0,${rand(.05, .2)})`; g.fillRect(x, 0, 1, s); } grain(g, s, 30); });
TX.tatter = makeTex(32, (g, s) => { g.fillStyle = '#a0a0a0'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 2) { g.fillStyle = `rgba(0,0,0,${rand(.05, .25)})`; g.fillRect(x, 0, 1, s); } for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(40,20,10,.3)'; g.fillRect(rand(0, s), rand(0, s), rand(2, 6), rand(2, 6)); } grain(g, s, 30);
  for (let x = 0; x < s; x++) { const h = rand(1, 10) | 0; g.clearRect(x, s - h, 1, h); } for (let i = 0; i < 6; i++) g.clearRect(rand(0, s - 3) | 0, rand(3, s - 12) | 0, rand(1, 3) | 0, rand(1, 3) | 0); });
TX.wood = makeTex(32, (g, s) => { g.fillStyle = '#7a5a3c'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 3) { g.fillStyle = `rgba(40,22,10,${rand(.15, .4)})`; g.fillRect(0, y, s, 1); } grain(g, s, 22); });
TX.plank = makeTex(32, (g, s) => { g.fillStyle = '#4a3424'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 8) { g.fillStyle = hsl(26, rand(25, 35), rand(22, 32)); g.fillRect(x + 1, 0, 6, s); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 3, rand(0, s), 1, rand(4, 10)); g.fillStyle = '#1a120c'; g.fillRect(x + 3, 5, 1, 1); g.fillRect(x + 3, 26, 1, 1); } grain(g, s, 20); });
TX.door = makeTex(32, (g, s) => { g.fillStyle = '#3a2618'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 6) { g.fillStyle = hsl(24, 30, rand(18, 26)); g.fillRect(x + 1, 0, 5, s); } g.fillStyle = '#2a2a2c'; g.fillRect(0, 6, s, 3); g.fillRect(0, 23, s, 3); g.fillStyle = '#6a6a6a'; g.fillRect(24, 15, 3, 3); grain(g, s, 16); });
TX.slate = makeTex(32, (g, s) => { g.fillStyle = '#1c1e24'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 4) { const ox = (y / 4 % 2) * 3; for (let x = -ox; x < s; x += 6) { g.fillStyle = hsl(220 + rand(-10, 10), rand(6, 14), rand(18, 28)); g.fillRect(x + 1, y + 1, 5, 3); } } grain(g, s, 16); });
TX.grate = makeTex(16, (g, s) => { g.clearRect(0, 0, s, s); g.fillStyle = '#3a3634'; for (let x = 1; x < s; x += 4) g.fillRect(x, 0, 2, s); g.fillRect(0, 2, s, 2); g.fillRect(0, 12, s, 2); });
TX.hide = makeTex(32, (g, s) => { g.fillStyle = '#3e322a'; g.fillRect(0, 0, s, s); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${rand(70, 100) | 0},${rand(55, 70) | 0},45,.4)`; g.fillRect(rand(0, s), rand(0, s), rand(1, 3), rand(1, 3)); }
  for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(8,4,2,.75)'; g.beginPath(); let x = rand(0, s), y = rand(0, s); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rand(-6, 6); y += rand(-6, 6); g.lineTo(x, y); } g.stroke(); } grain(g, s, 28); });
TX.scale = makeTex(32, (g, s) => { g.fillStyle = '#5a1a12'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 4) for (let x = (y / 4 % 2) * 2; x < s; x += 4) { g.fillStyle = hsl(8 + rand(-4, 4), rand(45, 65), rand(18, 32)); g.fillRect(x, y, 3, 3); } grain(g, s, 18); });
TX.stoneSkin = makeTex(32, (g, s) => { g.fillStyle = '#6a6a6c'; g.fillRect(0, 0, s, s); for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(${rand(40, 120) | 0},${rand(40, 120) | 0},${rand(45, 125) | 0},.35)`; g.fillRect(rand(0, s), rand(0, s), rand(1, 4), rand(1, 4)); } for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(20,20,20,.6)'; g.beginPath(); let x = rand(0, s), y = rand(0, s); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += rand(-6, 6); y += rand(-6, 6); g.lineTo(x, y); } g.stroke(); } grain(g, s, 24); });
TX.crest = makeTex(32, (g, s) => { g.fillStyle = '#3a4a52'; g.fillRect(0, 0, s, s); g.fillStyle = '#b89a58'; g.fillRect(14, 5, 4, 22); g.fillRect(8, 11, 16, 4); g.strokeStyle = '#8a8a90'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2); grain(g, s, 20); });
TX.glass = makeTex(32, (g, s) => { const cols = ['#5a2a3a', '#2a3a6a', '#7a6a2a', '#2a5a3a', '#6a2a2a']; for (let y = 0; y < s; y += 6) for (let x = 0; x < s; x += 6) { g.fillStyle = pick(cols); g.fillRect(x, y, 6, 6); } g.strokeStyle = '#111'; g.lineWidth = 1; for (let i = 0; i <= s; i += 6) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); } grain(g, s, 20); });
TX.fog = makeTex(32, (g, s) => { const d = g.createImageData(s, s); for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const i = (y * s + x) * 4; const v = .5 + .25 * Math.sin(x * .4 + Math.sin(y * .3) * 2) + .25 * Math.sin(y * .5 + x * .1); d.data[i] = 235; d.data[i + 1] = 232; d.data[i + 2] = 225; d.data[i + 3] = clamp(v * 200 + rand(-30, 30), 20, 235); } g.putImageData(d, 0, 0); });
TX.rune = makeTex(32, (g, s) => { g.clearRect(0, 0, s, s); g.strokeStyle = '#ffb060'; g.lineWidth = 2; g.beginPath(); g.moveTo(5, 10); g.quadraticCurveTo(16, 3, 27, 10); g.moveTo(8, 20); g.lineTo(24, 14); g.moveTo(9, 26); g.quadraticCurveTo(18, 22, 25, 27); g.moveTo(16, 8); g.lineTo(15, 24); g.stroke(); });
TX.glow = makeTex(32, (g, s) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
TX.sky = makeTex(64, (g, s) => { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#262a36'); gr.addColorStop(.3, '#4a4250'); gr.addColorStop(.44, '#946c56'); gr.addColorStop(.5, '#c08a5c'); gr.addColorStop(.54, '#7a5c46'); gr.addColorStop(1, '#2a221c'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${rand(150, 200) | 0},${rand(110, 140) | 0},${rand(90, 110) | 0},${rand(.15, .35)})`; g.fillRect(rand(0, s), rand(16, 30), rand(8, 22), rand(1, 2)); } });

/* ---------------- geometry helpers ---------------- */
function boxGeo(w, h, d, ts = 2, off = [0, 0, 0]) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.ceil(w / 3)), Math.max(1, Math.ceil(h / 3)), Math.max(1, Math.ceil(d / 3)));
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + off[0], y = p.getY(i) + off[1], z = p.getZ(i) + off[2]; const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)); let u, v; if (ny > .5) { u = x; v = z; } else if (nx > .5) { u = z; v = y; } else { u = x; v = y; } uv.setXY(i, u / ts, v / ts); }
  return g;
}
const gcache = new Map();
const cached = (k, fn) => { let g = gcache.get(k); if (!g) { g = fn(); gcache.set(k, g); } return g; };
const f3 = v => v.toFixed(3);
const bgeo = (w, h, d) => cached(`b${f3(w)}|${f3(h)}|${f3(d)}`, () => new THREE.BoxGeometry(w, h, d));
const cylG = (rt, rb, h, n = 5, open = false) => cached(`c${f3(rt)}|${f3(rb)}|${f3(h)}|${n}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, n, 1, open));
const sphG = (r, w = 6, h = 4, tl = Math.PI) => cached(`s${f3(r)}|${w}|${h}|${f3(tl)}`, () => new THREE.SphereGeometry(r, w, h, 0, TAU, 0, tl));
const coneG = (r, h, n = 5) => cached(`k${f3(r)}|${f3(h)}|${n}`, () => new THREE.ConeGeometry(r, h, n));

/* ---------------- 3D collision world ----------------
   solids: axis-aligned boxes {x0,x1,y0,y1,z0,z1}. Walkable tops; sides block anything whose body overlaps them vertically.
   ramps: walk-only slopes (stairs render as steps, walk as a ramp). Everything lives in a 4 m spatial hash. */
const solids = [];
const CELL = 4, grid = new Map(); let stamp = 1;
function gridAdd(s) { for (let cx = Math.floor(s.x0 / CELL); cx <= Math.floor(s.x1 / CELL); cx++) for (let cz = Math.floor(s.z0 / CELL); cz <= Math.floor(s.z1 / CELL); cz++) { const k = cx * 100003 + cz; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(s); } }
const qbuf = [];
function gridQuery(x0, x1, z0, z1) {
  qbuf.length = 0; stamp++;
  for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
    const a = grid.get(cx * 100003 + cz); if (!a) continue; for (const s of a) { if (s.stamp === stamp) continue; s.stamp = stamp; qbuf.push(s); } }
  return qbuf;
}
function addSolid(s) { s.on = s.on ?? true; s.cam = s.cam ?? true; s.walk = s.walk ?? true; solids.push(s); gridAdd(s); return s; }
function rampH(s, x, z) { const t = s.axis === 'x' ? (x - s.x0) / (s.x1 - s.x0) : (z - s.z0) / (s.z1 - s.z0); return lerp(s.h0, s.h1, clamp(t, 0, 1)); }
const STEP = .5;
function groundAt(x, z, y) {
  let best = -1e9;
  for (const s of gridQuery(x, x, z, z)) {
    if (!s.on || !s.walk || x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    const top = s.ramp ? rampH(s, x, z) : s.y1;
    if (top <= y + STEP && top > best) best = top;
  }
  return best;
}
function pushOut(ent) {
  const p = ent.pos, r = ent.r, yb = p.y + STEP * .9, yt = p.y + (ent.h || 1.8);
  for (const s of gridQuery(p.x - r, p.x + r, p.z - r, p.z + r)) {
    if (!s.on || s.ramp || s.y1 <= yb || s.y0 >= yt) continue;
    const nx = clamp(p.x, s.x0, s.x1), nz = clamp(p.z, s.z0, s.z1); const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x += dx / d * (r - d); p.z += dz / d * (r - d); }
    else { const l = p.x - s.x0, rr = s.x1 - p.x, b = p.z - s.z0, f = s.z1 - p.z, m = Math.min(l, rr, b, f); if (m === l) p.x = s.x0 - r; else if (m === rr) p.x = s.x1 + r; else if (m === b) p.z = s.z0 - r; else p.z = s.z1 + r; }
  }
}
/* point inside any camera-blocking solid (used for camera and line of sight) */
function solidAt(x, y, z, pad = 0) {
  for (const s of gridQuery(x - pad, x + pad, z - pad, z + pad)) {
    if (!s.on || !s.cam || s.ramp) continue;
    if (x > s.x0 - pad && x < s.x1 + pad && z > s.z0 - pad && z < s.z1 + pad && y > s.y0 - pad && y < s.y1 + pad) return true;
  }
  return false;
}
function lineOfSight(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz), n = Math.ceil(L / .5);
  for (let i = 1; i < n; i++) { const t = i / n; if (solidAt(a.x + dx * t, a.y + dy * t, a.z + dz * t)) return false; }
  return true;
}
/* gravity + ground snapping + falling. Returns fall height on landing (0 otherwise). */
const GRAV = 24;
function physStep(ent, dt) {
  const p = ent.pos;
  pushOut(ent);
  const g = groundAt(p.x, p.z, p.y);
  let fell = 0;
  if (ent.onGround) {
    if (g < p.y - STEP) { ent.onGround = false; ent.vy = 0; ent.fallTop = p.y; }
    else p.y = g;
  } else {
    ent.vy -= GRAV * dt; p.y += ent.vy * dt; if (p.y > ent.fallTop) ent.fallTop = p.y;
    if (p.y <= g) { p.y = g; ent.onGround = true; fell = ent.fallTop - g; ent.vy = 0; }
  }
  return fell;
}

/* ---------------- static mesh batching (per material, per 32 m chunk) ---------------- */
const statics = [];
function addStatic(mesh) { mesh.updateMatrixWorld(true); statics.push(mesh); return mesh; }
function mergeStatics() {
  scene.updateMatrixWorld(true);
  const groups = new Map();
  for (const m of statics) {
    const c = new THREE.Box3().setFromObject(m).getCenter(tmpV);
    const key = m.material.uuid + '|' + Math.floor(c.x / 48) + '|' + Math.floor(c.z / 48);
    let gq = groups.get(key); if (!gq) groups.set(key, gq = { mat: m.material, list: [] }); gq.list.push(m);
  }
  const nm = new THREE.Matrix3();
  for (const { mat: mt, list } of groups.values()) {
    let count = 0; const gs = list.map(m => { const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry; count += g.attributes.position.count; return g; });
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2); let o = 0;
    list.forEach((m, i) => {
      const g = gs[i], P = g.attributes.position, N = g.attributes.normal, T = g.attributes.uv; nm.getNormalMatrix(m.matrixWorld);
      for (let k = 0; k < P.count; k++) {
        tmpV.set(P.getX(k), P.getY(k), P.getZ(k)).applyMatrix4(m.matrixWorld); pos.set([tmpV.x, tmpV.y, tmpV.z], (o + k) * 3);
        tmpV.set(N.getX(k), N.getY(k), N.getZ(k)).applyMatrix3(nm).normalize(); nor.set([tmpV.x, tmpV.y, tmpV.z], (o + k) * 3);
        uv.set([T ? T.getX(k) : 0, T ? T.getY(k) : 0], (o + k) * 2);
      }
      o += P.count; if (m.parent) m.parent.remove(m);
    });
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); bg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    bg.computeBoundingSphere(); scene.add(new THREE.Mesh(bg, mt));
  }
  statics.length = 0;
}

/* merge every same-material mesh directly under each group of a rig (keeps bones animatable, cuts draw calls) */
function mergeGeos(list) {
  let count = 0; const gs = list.map(([geo, m]) => { const g = (geo.index ? geo.toNonIndexed() : geo.clone()); g.applyMatrix4(m); count += g.attributes.position.count; return g; });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2); let o = 0;
  for (const g of gs) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); bg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); bg.computeBoundingSphere(); return bg;
}
function compactRig(g) {
  const buckets = new Map();
  for (const c of [...g.children]) if (c.isMesh && !c.userData.keep) { const k = c.material.uuid; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(c); }
  for (const list of buckets.values()) { if (list.length < 2) continue; const geo = mergeGeos(list.map(c => { c.updateMatrix(); return [c.geometry, c.matrix]; })); list.forEach(c => g.remove(c)); g.add(new THREE.Mesh(geo, list[0].material)); }
  for (const c of g.children) if (!c.isMesh) compactRig(c);
}
function staticRig(root) { root.updateMatrixWorld(true); root.traverse(o => { if (o.isMesh) addStatic(o); }); }
/* ---------------- lights: the 8 nearest active lights feed the vertex shader ---------------- */
const lights = [];
function addLight(x, y, z, col, range, flick = .18) { const L = { p: new V3(x, y, z), c: new THREE.Color(col), range, flick, i: 1, on: true, ph: rand(0, 9) }; lights.push(L); return L; }
function updateLights(time, focus) {
  const act = lights.filter(L => L.on).sort((a, b) => a.p.distanceToSquared(focus) - b.p.distanceToSquared(focus));
  for (let i = 0; i < 8; i++) {
    const L = act[i];
    if (!L) { U.uPL.value[i].set(0, -999, 0, .001); U.uPLC.value[i].setRGB(0, 0, 0); continue; }
    const fl = L.flick ? (1 + Math.sin(time * 11 + L.ph) * L.flick * .5 + (Math.random() - .5) * L.flick) : 1;
    U.uPL.value[i].set(L.p.x, L.p.y, L.p.z, L.range); U.uPLC.value[i].copy(L.c).multiplyScalar(fl * L.i * 1.25);
  }
}

/* ---------------- particles ---------------- */
const PGEO = new THREE.BoxGeometry(1, 1, 1), parts = [], poolA = [], poolN = [];
function emit(x, y, z, n, o) {
  for (let i = 0; i < n; i++) {
    const add = o.add !== false, pool = add ? poolA : poolN; let p = pool.pop();
    if (!p) p = { m: new THREE.Mesh(PGEO, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })), v: new V3(), add };
    const c = o.color; p.m.material.color.setHex(Array.isArray(c) ? c[(Math.random() * c.length) | 0] : c);
    const j = o.jit || 0; p.m.position.set(x + rand(-j, j), y + rand(-j, j) * .5, z + rand(-j, j));
    p.v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar((o.speed ?? 2) * rand(.4, 1)); p.v.y += o.up || 0;
    if (o.vel) p.v.add(o.vel);
    p.life = p.max = (o.life || .5) * rand(.6, 1.2); p.size = o.size || .06; p.g = o.grav ?? 6; p.home = o.home || null; p.m.scale.setScalar(p.size); p.m.rotation.set(rand(0, 3), rand(0, 3), 0);
    scene.add(p.m); parts.push(p);
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.home) { tmpV.set(p.home.x, p.home.y + 1.1, p.home.z).sub(p.m.position); if (tmpV.length() < .35) p.life = 0; tmpV.normalize().multiplyScalar(13); p.v.lerp(tmpV, 1 - Math.exp(-2.5 * dt)); }
    else p.v.y -= p.g * dt;
    if (p.life <= 0) { scene.remove(p.m); parts.splice(i, 1); (p.add ? poolA : poolN).push(p); continue; }
    p.m.position.addScaledVector(p.v, dt); const k = p.life / p.max; p.m.scale.setScalar(p.size * (.3 + .7 * k)); p.m.material.opacity = Math.min(1, k * 1.6);
  }
}
const blobGeo = new THREE.CircleGeometry(1, 8).rotateX(-Math.PI / 2);
const blobMat = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .45, depthWrite: false });
function blob(r) { const m = new THREE.Mesh(blobGeo, blobMat); m.scale.setScalar(r); scene.add(m); return m; }

/* ---------------- audio (synthesized) ---------------- */
const A = { ctx: null, master: null, noise: null, drone: null, mute: store.get('mute', false) };
function audioInit() {
  if (A.ctx) { A.ctx.resume && A.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; A.ctx = new C(); A.master = A.ctx.createGain(); A.master.gain.value = A.mute ? 0 : .6; A.master.connect(A.ctx.destination);
    const len = A.ctx.sampleRate; const b = A.ctx.createBuffer(1, len, len); const d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; A.noise = b;
    const src = A.ctx.createBufferSource(); src.buffer = b; src.loop = true; const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; const g = A.ctx.createGain(); g.gain.value = .05; src.connect(f); f.connect(g); g.connect(A.master); src.start();
    const lfo = A.ctx.createOscillator(); lfo.frequency.value = .08; const lg = A.ctx.createGain(); lg.gain.value = 160; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
  } catch (e) { A.ctx = null; }
}
function nz(o) { if (!A.ctx) return; const c = A.ctx, t = c.currentTime + (o.delay || 0); const s = c.createBufferSource(); s.buffer = A.noise; s.loop = true; const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.d); f.Q.value = o.q || 1;
  const g = c.createGain(); const v = (o.v || .3) * (o.vol ?? 1); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, v), t + (o.a || .01)); g.gain.exponentialRampToValueAtTime(.0001, t + o.d); s.connect(f); f.connect(g); g.connect(A.master); s.start(t, Math.random() * .5); s.stop(t + o.d + .05); }
function tone(o) { if (!A.ctx) return; const c = A.ctx, t = c.currentTime + (o.delay || 0); const s = c.createOscillator(); s.type = o.type || 'sine'; s.frequency.setValueAtTime(o.f, t); if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2, t + o.d);
  const g = c.createGain(); const v = (o.v || .2) * (o.vol ?? 1); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, v), t + (o.a || .005)); g.gain.exponentialRampToValueAtTime(.0001, t + o.d); s.connect(g); g.connect(A.master); s.start(t); s.stop(t + o.d + .05); }
const SFX = {
  swing: v => nz({ f: 600, f2: 2400, q: 1.2, d: .18, v: .22, a: .03, vol: v }),
  heavy: v => nz({ f: 280, f2: 1400, q: 1, d: .32, v: .3, a: .06, vol: v }),
  eswing: v => nz({ f: 400, f2: 1600, q: 1, d: .25, v: .18, a: .05, vol: v }),
  hit: v => { nz({ type: 'lowpass', f: 1800, f2: 300, d: .14, v: .5, vol: v }); tone({ f: 150, f2: 50, d: .16, v: .5, vol: v }); },
  stab: v => { nz({ type: 'lowpass', f: 900, f2: 200, d: .3, v: .6, vol: v }); tone({ f: 90, f2: 40, d: .35, v: .6, vol: v }); },
  clang: v => { tone({ type: 'square', f: 880, f2: 840, d: .25, v: .1, vol: v }); tone({ type: 'square', f: 1310, f2: 1290, d: .2, v: .07, vol: v }); nz({ type: 'highpass', f: 3000, d: .08, v: .3, vol: v }); },
  parry: v => { tone({ type: 'square', f: 1500, f2: 1400, d: .35, v: .12, vol: v }); tone({ type: 'triangle', f: 2100, d: .4, v: .08, vol: v }); },
  roll: v => nz({ type: 'lowpass', f: 500, f2: 180, d: .3, v: .25, a: .04, vol: v }),
  step: v => nz({ type: 'lowpass', f: 300, f2: 120, d: .08, v: .08, vol: v }),
  land: v => nz({ type: 'lowpass', f: 400, f2: 80, d: .25, v: .5, vol: v }),
  hurt: v => { tone({ type: 'sawtooth', f: 180, f2: 70, d: .25, v: .16, vol: v }); nz({ type: 'lowpass', f: 900, f2: 200, d: .2, v: .4, vol: v }); },
  boom: v => { tone({ f: 70, f2: 30, d: .8, v: .7, vol: v }); nz({ type: 'lowpass', f: 400, f2: 60, d: .7, v: .5, vol: v }); },
  fire: v => nz({ type: 'lowpass', f: 900, f2: 300, d: 1.2, v: .45, a: .1, vol: v }),
  died: () => { tone({ type: 'sawtooth', f: 110, f2: 55, d: 2.5, v: .12, a: .2 }); tone({ f: 55, f2: 40, d: 3, v: .4, a: .1 }); },
  souls: () => { [0, .07, .14].forEach((dl, i) => tone({ f: 880 * [1, 1.25, 1.5][i], d: .4, v: .07, delay: dl })); },
  item: () => { tone({ f: 660, d: .15, v: .08 }); tone({ f: 990, d: .3, v: .06, delay: .08 }); },
  heal: () => { tone({ f: 440, f2: 660, d: .5, v: .12 }); tone({ type: 'triangle', f: 660, f2: 990, d: .6, v: .06, delay: .1 }); },
  rest: () => { nz({ type: 'lowpass', f: 300, f2: 1600, d: 1.2, v: .3, a: .4 }); [0, .2, .4].forEach((dl, i) => tone({ type: 'triangle', f: [220, 277, 330][i], d: 2, v: .08, delay: dl, a: .2 })); },
  roar: v => { tone({ type: 'sawtooth', f: 80, f2: 45, d: 1.8, v: .24, a: .15, vol: v }); nz({ f: 380, f2: 150, q: .8, d: 1.8, v: .55, a: .2, vol: v }); },
  screech: v => { tone({ type: 'sawtooth', f: 900, f2: 400, d: .9, v: .1, a: .05, vol: v }); nz({ f: 2000, f2: 900, q: 2, d: .8, v: .3, vol: v }); },
  bow: v => { tone({ type: 'triangle', f: 220, f2: 110, d: .15, v: .15, vol: v }); nz({ type: 'highpass', f: 2000, d: .1, v: .15, vol: v }); },
  door: v => { nz({ type: 'lowpass', f: 300, f2: 100, d: .9, v: .4, a: .1, vol: v }); tone({ type: 'square', f: 70, d: .6, v: .05, vol: v }); },
  fog: () => nz({ f: 200, f2: 900, d: 1.2, v: .3, a: .4 }),
  nope: () => tone({ type: 'square', f: 160, d: .12, v: .05 }),
  click: () => tone({ type: 'triangle', f: 660, d: .06, v: .05 }),
  bell: () => { [0, .02].forEach(dl => tone({ type: 'sine', f: 196, d: 5, v: .3, delay: dl, a: .01 })); tone({ type: 'sine', f: 392.5, d: 3.5, v: .12, a: .01 }); tone({ type: 'sine', f: 588, d: 2.5, v: .06, a: .01 }); },
  felled: () => { [0, .25, .5, .9].forEach((dl, i) => tone({ type: 'triangle', f: [196, 247, 294, 392][i], d: 2.6, v: .1, delay: dl, a: .1 })); },
};
/* positional volume: quieter with distance from the player */
function sfx(n, at) { try { let v = 1; if (at && typeof P !== 'undefined') { const d = at.distanceTo(P.pos); v = clamp(1.2 - d / 28, 0, 1); if (v <= .02) return; } SFX[n] && SFX[n](v); } catch (e) {} }
function music(on, kind = 'boss') {
  if (!A.ctx) return; const c = A.ctx;
  if (on && !A.drone) { const g = c.createGain(); g.gain.setValueAtTime(.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(.09, c.currentTime + 2); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; f.connect(g); g.connect(A.master);
    const base = kind === 'gargoyle' ? [49, 73.4, 98, 58.3] : [55, 82.4, 110.5, 65.4];
    const os = base.map((fr, i) => { const o = c.createOscillator(); o.type = i === 3 ? 'triangle' : 'sawtooth'; o.frequency.value = fr; o.detune.value = rand(-8, 8); o.connect(f); o.start(); return o; });
    const lfo = c.createOscillator(); lfo.frequency.value = 1.1; const lg = c.createGain(); lg.gain.value = 220; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); A.drone = { g, os: [...os, lfo] }; }
  else if (!on && A.drone) { const d = A.drone; A.drone = null; d.g.gain.cancelScheduledValues(c.currentTime); d.g.gain.setValueAtTime(d.g.gain.value, c.currentTime); d.g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + 1.5); setTimeout(() => d.os.forEach(o => { try { o.stop(); } catch (e) {} }), 1700); }
}
function shake(a) { G.shake = Math.max(G.shake, a); }
function vibrate(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
