/* 3D character models, pre-rendered to sprites like the original game did.
   Each character is a signed-distance model (rounded limbs, torso, skirt or robe, head, hair, horns,
   weapons, helms, shields) posed by the skeleton in sprites.js. A WebGL shader ray-marches it with
   a fixed key light, 2x supersampled, for 8 facings and every animation frame. Frames are rendered
   lazily in small batches and cached; the old vector drawing fills in until a frame is ready. */
'use strict';

const MD = { gl: null, prog: null, cv: null, ok: false, cache: new Map(), queue: [], queued: new Set(), batch: 4, U: {}, scratch: null };
const DIRS = 8;
const RAT_RIG = { H: 26, build: 1 };
const ANIM_N = { idle: 4, walk: 8, run: 8, attack: 6, cast: 6, hit: 1, die: 6 };
// type id, sprite cell (1x) and colours per model
const MODEL = {
  sorc: { T: 0, w: 88, h: 108 }, zombie: { T: 1, w: 84, h: 96 }, fallen: { T: 2, w: 64, h: 72 }, shaman: { T: 3, w: 64, h: 80 },
  brute: { T: 4, w: 112, h: 108 }, quillrat: { T: 5, w: 72, h: 56 }, akara: { T: 6, w: 80, h: 104 }, charsi: { T: 7, w: 80, h: 104 }, kashya: { T: 8, w: 84, h: 106 },
};
const WEAPON_ID = { staff: 1, gstaff: 1, bstaff: 1, wand: 2, bwand: 2, orb: 3, sword: 4, club: 5, axe: 6, dagger: 7, skullstaff: 8, bow: 9, hammer: 10 };
const HELM_ID = { cap: 1, skullcap: 2, helm: 2, fullhelm: 3, crown: 4, mask: 5 };

const MD_VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }';
const MD_FS = `
precision highp float;
uniform vec3 J[18];
uniform vec3 C[14];
uniform vec4 uP;      // type, build, head scale, height
uniform vec4 uG;      // weapon, shield, helm, armour
uniform vec2 uRot;    // facing cos, sin
uniform vec3 uL;      // light (local space)
uniform vec4 uCell;   // cell origin x,y and size w,h in framebuffer pixels (2x)
uniform vec2 uAnchor; // ground point inside the cell (2x pixels from top-left)
uniform float uGlow;
bool is(float t, float k) { return abs(t - k) < .5; }
float sdSph(vec3 p, float r) { return length(p) - r; }
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.) / max(k1, 1e-4); }
float sdCap(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0., 1.); return length(pa - ba * h) - r; }
float sdRC(vec3 p, vec3 a, vec3 b, float r1, float r2) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0., 1.); return length(pa - ba * h) - mix(r1, r2, h); }
float smin(float a, float b, float k) { float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
float hash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
vec2 U(vec2 r, float d, float m) { return d < r.x ? vec2(d, m) : r; }
vec2 S(vec2 r, float d, float m, float k) { float h = clamp(.5 + .5 * (d - r.x) / k, 0., 1.); return vec2(mix(d, r.x, h) - k * h * (1. - h), d < r.x ? m : r.y); }

vec2 mapRat(vec3 p) {
  vec2 r = vec2(1e5, 0.);
  float body = smin(sdEll(p - J[0], vec3(7.5, 9., 7.)), sdEll(p - J[1], vec3(6., 7., 6.)), 4.);
  r = U(r, body + (noise(p * .9) - .5) * .8, 2.);
  r = S(r, sdEll(p - J[2], vec3(4.2, 5.5, 4.)), 1., 2.);
  r = S(r, sdRC(p, J[2], J[3], 3.2, 1.2), 1., 1.5);
  r = U(r, sdSph(p - (J[2] + vec3(2., 2.6, 1.6)), .9), 10.);
  r = U(r, sdSph(p - (J[2] + vec3(-2., 2.6, 1.6)), .9), 10.);
  for (int i = 0; i < 4; i++) {
    vec3 root = i == 0 ? J[8] : i == 1 ? J[9] : i == 2 ? J[10] : J[11];
    vec3 foot = i == 0 ? J[4] : i == 1 ? J[5] : i == 2 ? J[6] : J[7];
    r = U(r, sdRC(p, root, foot, 1.8, 1.1), 4.);
  }
  r = U(r, sdRC(p, J[0] + vec3(0., -6., 0.), J[12], 1.5, .5), 1.);
  for (int i = 0; i < 14; i++) {
    float fi = float(i), t = fi / 13., sd = mod(fi, 3.) - 1.;
    vec3 b = mix(J[0] + vec3(0., -3., 3.), J[1] + vec3(0., 0., 3.), t) + vec3(sd * 3., 0., 0.);
    vec3 tip = b + vec3(sd * 4., -9., 9. + mod(fi * 7., 4.));
    r = U(r, sdRC(p, b, tip, .9, .15), 11.);
  }
  return r;
}

vec2 map(vec3 p) {
  float T = uP.x, g = uP.y, hs = uP.z, H = uP.w;
  if (is(T, 5.)) return mapRat(p);
  vec2 r = vec2(1e5, 0.);
  float lr = H * .05 * g, ar = H * .038 * g, hr = H * .085 * hs;
  bool fur = is(T, 4.), zom = is(T, 1.), imp = is(T, 2.) || is(T, 3.);
  bool female = is(T, 0.) || is(T, 6.) || is(T, 7.) || is(T, 8.);
  // legs and feet
  float legs = min(sdRC(p, J[4], J[5], lr * 1.12, lr * .86), sdRC(p, J[5], J[6], lr * .86, lr * .6));
  legs = min(legs, min(sdRC(p, J[7], J[8], lr * 1.12, lr * .86), sdRC(p, J[8], J[9], lr * .86, lr * .6)));
  r = vec2(legs, p.z < H * .16 ? 4. : 3.);
  r = U(r, sdEll(p - (J[6] + vec3(0., lr * .6, -.3)), vec3(lr * .75, lr * 1.35, lr * .6)), 4.);
  r = U(r, sdEll(p - (J[9] + vec3(0., lr * .6, -.3)), vec3(lr * .75, lr * 1.35, lr * .6)), 4.);
  // torso: pelvis, ribcage and spine blended
  vec3 mid = mix(J[0], J[1], .62);
  float tor = smin(sdEll(p - J[0], vec3(H * .085, H * .062, H * .072) * g), sdEll(p - mid, vec3(H * .1, H * .068, H * .1) * g), H * .05);
  tor = smin(tor, sdCap(p, J[0], J[1], H * .058 * g), H * .04);
  if (fur) tor = smin(tor, sdEll(p - (mid + vec3(0., -1., 2.)), vec3(H * .16, H * .12, H * .12)), H * .08);
  if (imp) tor = smin(tor, sdEll(p - (J[0] + vec3(0., H * .05, H * .06)), vec3(H * .07, H * .07, H * .07)), H * .04);
  r = S(r, tor, 2., 1.5);
  if (female && !is(T, 7.)) {
    r = S(r, sdSph(p - (J[1] + vec3(H * .036, H * .052, -H * .045)), H * .036), 2., 1.);
    r = S(r, sdSph(p - (J[1] + vec3(-H * .036, H * .052, -H * .045)), H * .036), 2., 1.);
  }
  // skirt, loincloth or robe
  vec3 feet = mix(J[6], J[9], .5);
  if (is(T, 0.)) r = S(r, sdRC(p, J[0] + vec3(0., 0., 2.), vec3(feet.xy, max(feet.z, 1.) + H * .1), H * .095 * g, H * .15 * g), 5., 2.);
  else if (is(T, 6.)) r = S(r, sdRC(p, J[0] + vec3(0., 0., 3.), vec3(feet.xy, 2.), H * .1, H * .17), 5., 2.);
  else if (is(T, 8.)) r = S(r, sdRC(p, J[0] + vec3(0., 0., 2.), J[0] + vec3(0., 0., -H * .2), H * .095, H * .12), 5., 1.5);
  else if (!fur) r = S(r, sdRC(p, J[0] + vec3(0., 0., 1.), J[0] + vec3(0., H * .01, -H * .14), H * .08 * g, H * .085 * g), 5., 1.);
  if (is(T, 7.)) r = U(r, sdEll(p - (J[0] + vec3(0., H * .07, -H * .04)), vec3(H * .08, H * .018, H * .17)), 5.);
  // arms
  float armMat = (is(T, 6.) || is(T, 8.)) ? 2. : 1.;
  float arms = min(sdRC(p, J[10], J[11], ar * 1.08, ar * .9), sdRC(p, J[11], J[12], ar * .9, ar * .72));
  arms = min(arms, min(sdRC(p, J[13], J[14], ar * 1.08, ar * .9), sdRC(p, J[14], J[15], ar * .9, ar * .72)));
  r = S(r, arms, armMat, 1.2);
  r = S(r, min(sdSph(p - J[12], ar * .95), sdSph(p - J[15], ar * .95)), 1., .8);
  r = S(r, min(sdSph(p - J[10], ar * 1.35), sdSph(p - J[13], ar * 1.35)), 2., 1.5);
  if (uG.w > 1.5) r = U(r, min(sdEll(p - (J[10] + vec3(-.6, 0., .8)), vec3(ar * 1.9, ar * 1.8, ar * 1.2)), sdEll(p - (J[13] + vec3(.6, 0., .8)), vec3(ar * 1.9, ar * 1.8, ar * 1.2))), 12.);
  // neck and head
  r = S(r, sdCap(p, J[1], J[2], ar * .95), 1., 1.);
  vec3 hp = J[3];
  r = S(r, sdEll(p - hp, vec3(.9, 1., 1.1) * hr), 1., 1.);
  if (zom) r = S(r, sdEll(p - (hp + vec3(0., .35, -.55) * hr), vec3(.7, .6, .45) * hr), 1., .8);
  // eyes (dark sockets on people, glowing on monsters)
  float eyes = min(sdSph(p - (hp + vec3(.36, .86, .1) * hr), .2 * hr), sdSph(p - (hp + vec3(-.36, .86, .1) * hr), .2 * hr));
  r = U(r, eyes, 10.);
  // hair
  if (is(T, 0.) || is(T, 7.) || is(T, 8.)) {
    float cap = sdEll(p - (hp + vec3(0., -.12, .16) * hr), vec3(1.04, 1.06, 1.04) * hr);
    float face = max(hp.y + .2 * hr - p.y, p.z - (hp.z + .52 * hr));
    r = U(r, max(cap, -face), 6.);
    if (is(T, 0.)) r = U(r, sdRC(p, hp + vec3(0., -.9, .1) * hr, hp + vec3(0., -1.25, -1.5) * hr, .42 * hr, .18 * hr), 6.);
    if (is(T, 8.)) r = U(r, sdRC(p, hp + vec3(0., -.8, -.2) * hr, hp + vec3(0., -.95, -1.7) * hr, .7 * hr, .3 * hr), 6.);
  }
  if (is(T, 6.)) { // Akara's hood, open at the face
    float hood = sdEll(p - (hp + vec3(0., -.25, .2) * hr), vec3(1.3, 1.35, 1.4) * hr);
    hood = max(hood, -sdSph(p - (hp + vec3(0., 1.15, -.15) * hr), .95 * hr));
    r = U(r, smin(hood, sdRC(p, hp + vec3(0., -.5, 0.) * hr, J[1] + vec3(0., -2., 0.), hr * 1.1, hr * 1.4), 2.), 2.);
  }
  if (imp) { // horns and ears
    for (int i = 0; i < 2; i++) {
      float s = i == 0 ? 1. : -1.;
      vec3 a = hp + vec3(s * .5, .05, .7) * hr, b = hp + vec3(s * 1.2, -.35, 1.55) * hr, c = hp + vec3(s * .95, -.95, 2.2) * hr;
      r = U(r, min(sdRC(p, a, b, .28 * hr, .18 * hr), sdRC(p, b, c, .18 * hr, .05 * hr)), 11.);
      r = S(r, sdRC(p, hp + vec3(s * .8, 0., .1) * hr, hp + vec3(s * 1.55, -.35, .45) * hr, .22 * hr, .05 * hr), 1., .4);
    }
    if (is(T, 3.)) for (int i = 0; i < 5; i++) {
      float f = float(i) - 2.;
      vec3 b = hp + vec3(f * .35, -.55, .75) * hr;
      r = U(r, sdRC(p, b, b + vec3(f * .3, -.5, 1.9) * hr, .16 * hr, .08 * hr), 5.);
    }
  }
  // helm
  if (uG.z > .5) {
    float hm;
    if (uG.z < 1.5) hm = max(sdEll(p - (hp + vec3(0., -.05, .2) * hr), vec3(1.12, 1.14, 1.) * hr), hp.z + .05 * hr - p.z);
    else if (uG.z < 2.5) hm = min(max(sdEll(p - (hp + vec3(0., -.05, .1) * hr), vec3(1.13, 1.15, 1.12) * hr), hp.z - .35 * hr - p.z), sdCap(p, hp + vec3(0., 1.05, .3) * hr, hp + vec3(0., 1.05, -.45) * hr, .14 * hr));
    else if (uG.z < 3.5) hm = sdEll(p - (hp + vec3(0., 0., .05) * hr), vec3(1.16, 1.18, 1.18) * hr);
    else if (uG.z < 4.5) hm = max(abs(length((p - hp).xy) - 1.02 * hr) - .14 * hr, abs(p.z - hp.z - .7 * hr) - .3 * hr);
    else hm = sdEll(p - (hp + vec3(0., .42, 0.) * hr), vec3(.98, .7, 1.08) * hr);
    r = U(r, hm, 12.);
  }
  // shield on the left arm
  if (uG.y > .5) {
    vec3 c = J[12] + vec3(-2.4, 1.2, uG.y > 1.5 ? -2. : 0.);
    vec3 rad = uG.y > 2.5 ? vec3(1.3, 5., 5.) : uG.y > 1.5 ? vec3(1.3, 6.4, 9.5) : vec3(1.3, 6.5, 7.5);
    r = U(r, sdEll(p - c, rad), 13.);
  }
  // weapons (right hand J15, shaft base J17 to tip J16)
  float W = uG.x;
  vec3 wd = normalize(J[16] - J[17] + vec3(1e-4));
  vec3 side = normalize(cross(wd, vec3(0., 0., 1.)) + vec3(1e-4));
  if (is(W, 1.) || is(W, 8.)) {
    r = U(r, sdCap(p, J[17], J[16], 1.05), 7.);
    if (is(W, 1.)) r = U(r, sdSph(p - J[16], 2.), 9.);
    else r = U(r, sdEll(p - (J[16] + wd * 1.5), vec3(2.3, 2.6, 2.6)), 11.);
  } else if (is(W, 2.)) { r = U(r, sdCap(p, J[15], J[16], .75), 7.); r = U(r, sdSph(p - J[16], 1.), 9.); }
  else if (is(W, 3.)) r = U(r, sdSph(p - (J[15] + vec3(0., 1.2, 2.8)), 2.7), 9.);
  else if (is(W, 4.) || is(W, 7.)) { r = U(r, sdCap(p, J[15] + wd * 2., J[16], .7), 8.); r = U(r, sdCap(p, J[15] + wd * 1.5 + side * 2.4, J[15] + wd * 1.5 - side * 2.4, .55), 7.); }
  else if (is(W, 5.)) r = U(r, sdRC(p, J[17], J[16], .9, 2.3), 7.);
  else if (is(W, 6.) || is(W, 10.)) {
    r = U(r, sdCap(p, J[17], J[16], .8), 7.);
    if (is(W, 6.)) r = U(r, sdEll(p - (J[16] - wd * 1.6 + side * 2.2), vec3(2.6, 2.6, 2.6) * vec3(1., .5, 1.)), 8.);
    else r = U(r, sdCap(p, J[16] + side * 2.8, J[16] - side * 2.8, 1.7), 8.);
  } else if (is(W, 9.)) {
    vec3 c = J[12], up = vec3(0., 0., 1.), fw = vec3(0., 1., 0.);
    vec3 t0 = c + up * 10. + fw * 1., m = c + fw * 3.5, b0 = c - up * 10. + fw * 1.;
    r = U(r, min(sdCap(p, t0, m, .6), sdCap(p, m, b0, .6)), 7.);
    r = U(r, sdCap(p, t0, b0, .15), 11.);
  }
  // grime, fur and rot roughen the surface
  if (fur && r.y < 3.5) r.x += (noise(p * .45) - .5) * 1.1 + (noise(p * 1.6) - .5) * .35;
  if (zom && r.y < 5.5) r.x += (noise(p * .9) - .5) * .7;
  return r;
}
vec3 matCol(float m) {
  if (m < 1.5) return C[0]; if (m < 2.5) return C[1]; if (m < 3.5) return C[2]; if (m < 4.5) return C[3]; if (m < 5.5) return C[4];
  if (m < 6.5) return C[5]; if (m < 7.5) return C[6]; if (m < 8.5) return C[7]; if (m < 9.5) return C[8]; if (m < 10.5) return C[9];
  if (m < 11.5) return C[10]; if (m < 12.5) return C[11]; return C[12];
}
vec3 toLocal(vec3 v) { return vec3(dot(v.xy, vec2(-uRot.y, uRot.x)), dot(v.xy, uRot), v.z); }
void main() {
  vec2 fc = gl_FragCoord.xy - uCell.xy;
  float sx = (fc.x - uAnchor.x) * .5, sy = ((uCell.w - fc.y) - uAnchor.y) * .5;
  // the game's 2:1 projection: sx = (X - Y) * 32/36, sy = (X + Y) * 16/36 - Z
  float a = sx * 1.125, b = sy * 2.25;
  vec3 base = vec3((a + b) * .5, (b - a) * .5, 0.);
  vec3 cd = normalize(vec3(1., 1., .8889));
  vec3 ro = toLocal(base + cd * 150.), rd = toLocal(-cd);
  float t = 0., m = 0.; bool hit = false;
  for (int i = 0; i < 90; i++) {
    vec2 h = map(ro + rd * t);
    if (h.x < .04) { hit = true; m = h.y; break; }
    t += h.x * .85;
    if (t > 320.) break;
  }
  if (!hit) { gl_FragColor = vec4(0.); return; }
  vec3 p = ro + rd * t;
  vec2 e = vec2(.06, -.06);
  vec3 n = normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
  vec3 alb = matCol(m), V = -rd;
  float dif = max(dot(n, uL), 0.);
  float amb = .34 + .14 * n.z;
  float ao = clamp(map(p + n * 2.5).x / 2.5, 0., 1.) * .45 + .55;
  bool metal = m > 7.5 && m < 8.5 || m > 11.5 && m < 13.5;
  float sp = pow(max(dot(reflect(-uL, n), V), 0.), metal ? 14. : 6.) * (metal ? .75 : .07);
  float rim = pow(1. - max(dot(n, V), 0.), 3.) * .22;
  vec3 c = alb * (amb + dif * .9) * ao + alb * rim + vec3(sp);
  if (m < 5.5 || (m > 5.5 && m < 6.5)) c *= .82 + .32 * noise(p * .55);
  if (m > 8.5 && m < 9.5) c = alb * (1.25 + uGlow) + vec3(.15);
  if (m > 9.5 && m < 10.5) c = alb;
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}`;

function mdInit() {
  try {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 1024;
    const gl = cv.getContext('webgl', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, MD_VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, MD_FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['J', 'C', 'uP', 'uG', 'uRot', 'uL', 'uCell', 'uAnchor', 'uGlow']) MD.U[n] = gl.getUniformLocation(pr, n);
    gl.enable(gl.SCISSOR_TEST);
    Object.assign(MD, { gl, prog: pr, cv, ok: true });
    MD.scratch = makeCanvas(160, 140);
  } catch (err) { console.warn('3D models unavailable, using flat drawing:', err.message); MD.ok = false; }
}

/* ---------- Skeleton (same maths as the vector drawing) ---------- */
function rigJoints(rig, e) {
  const pose = poseFor(e, e.t || 0), H = rig.H, B = rig.build, lean = pose.lean;
  const hipZ = H * .48 + pose.bob, thigh = H * .25, shin = H * .245, torso = H * .29 * (rig.hunch ? .95 : 1), hipW = H * .075 * B, shW = H * .13 * B;
  const hipC = [0, 0, hipZ], chest = [0, Math.sin(lean) * torso, hipZ + Math.cos(lean) * torso];
  const leg = (side, a, kn) => { const hip = [side * hipW, 0, hipZ - 2], knee = [hip[0], hip[1] + Math.sin(a) * thigh, hip[2] - Math.cos(a) * thigh], b = a - kn; return [hip, knee, [hip[0], knee[1] + Math.sin(b) * shin, Math.max(2, knee[2] - Math.cos(b) * shin)]]; };
  const armLen = H * .19 * (rig.longArms || 1), fore = H * .18 * (rig.longArms || 1);
  const arm = (side, a, sp, el) => { const sh = [side * shW, chest[1] - Math.sin(lean) * 3, chest[2] - 3], elb = [sh[0] + side * Math.sin(sp) * armLen * .6, sh[1] + Math.sin(a) * armLen, sh[2] - Math.cos(a) * armLen], b = a + el; return [sh, elb, [elb[0] + side * Math.sin(sp) * fore * .3, elb[1] + Math.sin(b) * fore, elb[2] - Math.cos(b) * fore]]; };
  const headR = H * .085 * (rig.head || 1);
  const neck = [0, chest[1] + Math.sin(lean) * 4, chest[2] + 3], head = [0, chest[1] + Math.sin(lean) * (headR + 4), chest[2] + headR + 4];
  const LL = leg(-1, pose.legL, pose.kneeL), LR = leg(1, pose.legR, pose.kneeR), AL = arm(-1, pose.armL, pose.spreadL, pose.elbL), AR = arm(1, pose.armR, pose.spreadR, pose.elbR);
  // weapon shaft through the right hand
  const hand = AR[2], elb = AR[1];
  let d = [hand[0] - elb[0], hand[1] - elb[1], hand[2] - elb[2]]; const dl = Math.hypot(...d) || 1; d = d.map(v => v / dl);
  const long = e.weapon === 'staff' || e.weapon === 'gstaff' || e.weapon === 'bstaff' || e.weapon === 'skullstaff';
  let up = long && e.anim !== 'attack' ? [0, .12, 1] : d, upL = Math.hypot(...up); up = up.map(v => v / upL);
  const lenUp = long ? H * (e.anim === 'attack' ? .62 : .55) : e.weapon === 'dagger' ? 9 : e.weapon === 'wand' || e.weapon === 'bwand' ? 11 : 16;
  const lenDn = long ? H * (e.anim === 'attack' ? .22 : .3) : 2;
  const tip = hand.map((v, i) => v + up[i] * lenUp), wbase = hand.map((v, i) => v - up[i] * lenDn);
  const J = [hipC, chest, neck, head, ...LL, ...LR, ...AL, ...AR, tip, wbase];
  if (pose.fall) { const fa = pose.fall * 1.45, cf = Math.cos(fa), sf = Math.sin(fa); for (const j of J) { const y = j[1] * cf - j[2] * sf, z = j[1] * sf + j[2] * cf; j[1] = y; j[2] = Math.max(z, 2); } }
  return J;
}
function ratJoints(e) {
  const ph = e.walkPh || 0, step = e.anim === 'walk' || e.anim === 'run' ? 1 : 0, bz = 9 + (step ? Math.abs(Math.sin(ph)) * 1.5 : 0);
  const fall = e.dead ? Math.min(1, e.deadT * 2.5) : 0, lift = e.anim === 'attack' ? Math.sin(e.animT * Math.PI) * 3 : 0;
  const J = [[0, -6, bz], [0, 3, bz + 1 + lift], [0, 10, bz + lift], [0, 15.5, bz - 2 + lift]];
  const legs = [[-5, 6, 0], [5, 6, Math.PI], [-5, -6, Math.PI], [5, -6, 0]];
  for (const [lx, ly, p2] of legs) J.push([lx, ly + (step ? Math.sin(ph + p2) * 4 : 0), 1.5]);
  for (const [lx, ly] of legs) J.push([lx * .8, ly, bz - 2]);
  J.push([Math.sin((e.t || 0) * 6) * 3, -17, 4]);
  while (J.length < 18) J.push([0, 0, 0]);
  if (fall) for (const j of J) { const x = j[0] * Math.cos(fall * 1.5) - j[2] * Math.sin(fall * 1.5), z = j[0] * Math.sin(fall * 1.5) + j[2] * Math.cos(fall * 1.5); j[0] = x; j[2] = Math.max(z, 2); }
  return J;
}

/* ---------- Which frame an entity is showing ---------- */
function animKey(e, t) {
  if (e.dead) return ['die', Math.min(5, Math.floor(e.deadT * 2.2 * 5))];
  const a = e.anim || 'idle', n = ANIM_N[a] || 4;
  if (a === 'walk' || a === 'run') return [a, ((Math.floor((e.walkPh || 0) / TAU * 8) % 8) + 8) % 8];
  if (a === 'attack' || a === 'cast') return [a, Math.min(n - 1, Math.floor((e.animT || 0) * n))];
  if (a === 'hit') return ['hit', 0];
  return ['idle', Math.floor(t * 2.2 / TAU * 4 + (e.seed || 0)) % 4];
}
function modelId(e) { return e === P ? 'sorc' : e.type || e.id; }
function gearSig(e) {
  if (e === P) { const s = P.equip.lhand, h = P.equip.head, b = P.equip.body; return [P.weapon, s ? BASES[s.base].icon + BASES[s.base].tint : '', h ? BASES[h.base].icon + BASES[h.base].tint : '', b ? BASES[b.base].icon + BASES[b.base].tint : ''].join('|'); }
  return e.weapon || '';
}
function hexF(h) { return hexRgb(h).map(v => v / 255); }
function modelColors(id, e) {
  const R = RIGS[id] || RIGS.zombie, W = id === 'brute' ? R.skin : R.skin;
  const metal = '#9aa0a8', wood = '#5a3a20';
  let top = R.top, skirt = R.skirt, leg = R.leg;
  if (e === P && P.armorTint) { top = P.armorTint; }
  const shield = e === P && P.shield ? P.shield.tint : '#6e5638', helm = e === P && P.helm ? P.helm.tint : metal;
  const eyes = id === 'zombie' ? '#e0e870' : id === 'fallen' || id === 'shaman' ? '#ffd040' : id === 'quillrat' ? '#ff5030' : '#1a1010';
  const skirtC = id === 'shaman' ? '#e8d8b0' : id === 'charsi' ? '#8a7a5a' : skirt;
  const horn = id === 'quillrat' ? '#d8ccb0' : '#d8ccb0';
  const glow = e === P ? (P.castCol ? '#' + P.castCol.split(',').map(v => (+v).toString(16).padStart(2, '0')).join('') : '#a0c0ff') : '#a0c0ff';
  return [W, top, leg, R.boot, skirtC, R.hair, wood, metal, glow, eyes, horn, helm, shield].map(hexF);
}
function gearVec(id, e) {
  if (e === P) {
    const wp = WEAPON_ID[P.weapon] || 0, s = P.shield ? (P.shield.icon === 'kite' ? 2 : P.shield.icon === 'buckler' ? 3 : 1) : 0;
    const h = P.helm ? HELM_ID[P.helm.icon] || 2 : 0, b = P.equip.body ? (['mail', 'plate'].includes(BASES[P.equip.body.base].icon) ? 2 : 1) : 0;
    return [wp, s, h, b];
  }
  if (id === 'kashya') return [9, 0, 0, 1];
  if (id === 'charsi') return [10, 0, 0, 0];
  if (id === 'akara') return [1, 0, 0, 0];
  return [WEAPON_ID[e.weapon] || 0, 0, 0, 0];
}

/* ---------- Baking ---------- */
function spriteFor(e, t) {
  if (!MD.ok) return null;
  const id = modelId(e), M = MODEL[id]; if (!M) return null;
  const [anim, f] = animKey(e, t);
  const dir = ((Math.round(e.ang / (TAU / DIRS)) % DIRS) + DIRS) % DIRS;
  const sig = gearSig(e), key = id + '|' + sig + '|' + anim + '|' + f + '|' + dir;
  const s = MD.cache.get(key);
  if (s) return s;
  if (!MD.queued.has(key)) {
    // queue the whole animation for this facing so it plays without gaps
    for (let k = 0; k < (ANIM_N[anim] || 1); k++) {
      const kk = id + '|' + sig + '|' + anim + '|' + k + '|' + dir;
      if (MD.cache.has(kk) || MD.queued.has(kk)) continue;
      MD.queued.add(kk); MD.queue.push({ key: kk, id, e, anim, f: k, dir, sig, pri: k === f ? 0 : 1 });
    }
    MD.queue.sort((a, b) => a.pri - b.pri);
  }
  // fall back to the nearest frame of the same animation that is ready
  for (let k = 1; k < 8; k++) { const alt = MD.cache.get(id + '|' + sig + '|' + anim + '|' + ((f + k) % (ANIM_N[anim] || 1)) + '|' + dir); if (alt) return alt; }
  return null;
}
function bakeEntity(job) {
  const { id, e, anim, f, dir } = job, M = MODEL[id], n = ANIM_N[anim] || 1;
  const fake = { rig: id === 'quillrat' ? RAT_RIG : RIGS[id], anim, animT: (f + .5) / n, walkPh: f / 8 * TAU, dead: anim === 'die', deadT: anim === 'die' ? (f / 5) / 2.2 : 0, seed: 0, t: anim === 'idle' ? f / 4 * TAU / 2.2 : 0, weapon: e === P ? P.weapon : e.weapon, type: e.type };
  if (anim === 'die') fake.anim = 'die';
  if (e === P) fake.weapon = P.weapon;
  if (id === 'akara') fake.weapon = 'staff'; if (id === 'charsi') fake.weapon = 'hammer';
  const J = id === 'quillrat' ? ratJoints(fake) : rigJoints(fake.rig, fake);
  const ang = dir * TAU / DIRS;
  const w = M.w + (anim === 'die' ? 48 : anim === 'attack' ? 20 : 0), h = M.h;
  return { J, ang, w, h, ax: w / 2, ay: h - 12, colors: modelColors(id, e), gear: gearVec(id, e), rig: fake.rig, glow: anim === 'cast' ? (f >= 2 && f <= 4 ? 1 : .4) : 0 };
}
function mdBake() {
  if (!MD.ok || !MD.queue.length) return;
  const gl = MD.gl, t0 = performance.now(), jobs = [];
  // pack this batch into the framebuffer, left to right in rows
  let x = 0, y = 0, rowH = 0;
  while (MD.queue.length && jobs.length < MD.batch) {
    const job = MD.queue[0], b = bakeEntity(job), w2 = b.w * 2, h2 = b.h * 2;
    if (x + w2 > MD.cv.width) { x = 0; y += rowH; rowH = 0; }
    if (y + h2 > MD.cv.height) break;
    MD.queue.shift(); MD.queued.delete(job.key);
    jobs.push({ job, b, x, y }); x += w2; rowH = Math.max(rowH, h2);
  }
  if (!jobs.length) return;
  const U = MD.U, Lw = [-.62, -.18, .76], Ln = Math.hypot(...Lw);
  gl.viewport(0, 0, MD.cv.width, MD.cv.height);
  for (const { job, b, x: cx, y: cy } of jobs) {
    const R = b.rig, gy = MD.cv.height - cy - b.h * 2;   // GL origin is bottom-left
    gl.scissor(cx, gy, b.w * 2, b.h * 2); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
    gl.uniform3fv(U.J, new Float32Array(b.J.flat()));
    gl.uniform3fv(U.C, new Float32Array(b.colors.flat().concat([0, 0, 0])));
    gl.uniform4f(U.uP, MODEL[job.id].T, R.build || 1, R.head || 1, R.H || 26);
    gl.uniform4f(U.uG, ...b.gear);
    gl.uniform2f(U.uRot, ca, sa);
    const l = [Lw[0] / Ln, Lw[1] / Ln, Lw[2] / Ln];
    gl.uniform3f(U.uL, l[0] * -sa + l[1] * ca, l[0] * ca + l[1] * sa, l[2]);
    gl.uniform4f(U.uCell, cx, gy, b.w * 2, b.h * 2);
    gl.uniform2f(U.uAnchor, b.ax * 2, b.ay * 2);
    gl.uniform1f(U.uGlow, b.glow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // one readback for the whole batch, then 2x2 downsample with hard alpha
  const H = y + rowH, px = new Uint8Array(MD.cv.width * H * 4);
  gl.readPixels(0, MD.cv.height - H, MD.cv.width, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const FW = MD.cv.width;
  for (const { job, b, x: cx, y: cy } of jobs) {
    const c = makeCanvas(b.w, b.h), ctx = c.getContext('2d'), img = ctx.createImageData(b.w, b.h), d = img.data;
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) {
      let r = 0, g = 0, bl = 0, n = 0;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const X = cx + i * 2 + sx, Yt = cy + j * 2 + sy, row = H - 1 - Yt, o = (row * FW + X) * 4;
        if (px[o + 3] > 0) { r += px[o]; g += px[o + 1]; bl += px[o + 2]; n++; }
      }
      if (n >= 2) { const o = (j * b.w + i) * 4; d[o] = r / n; d[o + 1] = g / n; d[o + 2] = bl / n; d[o + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0);
    c.ax = b.ax; c.ay = b.ay; c.top = b.ay - (b.rig.H || 26) - 6;
    MD.cache.set(job.key, c);
  }
  const ms = performance.now() - t0;
  MD.batch = clamp(MD.batch + (ms < 7 ? 1 : ms > 14 ? -1 : 0), 1, 24);
}
// Forget the player's frames for gear they no longer wear
let MD_LASTSIG = '';
function mdGearChanged() {
  const sig = gearSig(P); if (sig === MD_LASTSIG) return; const old = MD_LASTSIG; MD_LASTSIG = sig;
  if (!old) return;
  const pre = 'sorc|' + old + '|';
  for (const k of [...MD.cache.keys()]) if (k.startsWith(pre)) MD.cache.delete(k);
  MD.queue = MD.queue.filter(j => !j.key.startsWith(pre)); MD.queued = new Set(MD.queue.map(j => j.key));
}

/* ---------- Drawing a baked frame ---------- */
function drawModel(ctx, e, sx, sy, t, tint) {
  const s = spriteFor(e, t); if (!s) return null;
  const sc = e.scale || 1, w = s.width * sc, h = s.height * sc, x = Math.round(sx - s.ax * sc), y = Math.round(sy - s.ay * sc);
  if (tint) {
    const S = MD.scratch; if (S.width < s.width || S.height < s.height) { S.width = Math.max(S.width, s.width); S.height = Math.max(S.height, s.height); }
    const c = S.getContext('2d'); c.globalCompositeOperation = 'copy'; c.drawImage(s, 0, 0);
    c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${tint[3]})`; c.fillRect(0, 0, s.width, s.height);
    ctx.drawImage(S, 0, 0, s.width, s.height, x, y, w, h);
  } else ctx.drawImage(s, x, y, w, h);
  return [sx, sy - (s.ay - s.top) * sc];
}
