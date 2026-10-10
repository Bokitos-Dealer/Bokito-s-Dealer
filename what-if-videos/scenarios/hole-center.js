// What if you fell into a hole to the centre of the Earth?
//
// One continuous camera, no cuts (the format of the reference videos): a city plaza with a crowd
// round a hole, someone jumps, and the camera dives with them down a cutaway of the ground, past
// real landmarks at their real depths, to the centre: HERE.
//
// The cutaway is a diorama: the ground is sliced open along z = 0 and we look at the cut face. Depth is
// drawn on a log-like scale (every landmark gets the same screen time) but every number on screen is
// real, and the clock comes from a fall through a vacuum in a realistic-density Earth (PREM shells).
import * as THREE from 'three';
import { Rng, clamp, lerp, smooth, easeInOut } from '../engine/lib/rng.js';
import { buildDaySky, townKit } from '../engine/lib/town.js';
import { buildPeople } from '../engine/lib/people.js';
import VO from './hole-center.vo.js';

const W = 1080, H = 1920;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const G0 = 9.82, R_E = 6371e3;

// ------------------------------------------------------------------ the fall (for the clock and the speed)
const FALL = (() => {
  const shells = [[0, 1221, 13090, 12760], [1221, 3480, 12170, 9900], [3480, 5701, 5570, 4380], [5701, 5971, 3990, 3540], [5971, 6346, 3540, 3380], [6346, 6371, 2900, 2600]];
  const N = 4000, dr = R_E / N, g = new Float64Array(N + 1), Ms = [0];
  let M = 0;
  const rho = (r) => { for (const [a, b, ra, rb] of shells) if (r <= b * 1e3) return ra + (rb - ra) * (r - a * 1e3) / ((b - a) * 1e3); return 2600; };
  for (let i = 1; i <= N; i++) { const r = (i - 0.5) * dr; M += 4 * Math.PI * r * r * rho(r) * dr; Ms.push(M); }
  for (let i = 1; i <= N; i++) g[i] = 6.674e-11 * Ms[i] * (5.972e24 / M) / ((i * dr) ** 2);
  const gAt = (r) => { const f = clamp(r / dr, 0, N), i = Math.min(N - 1, Math.floor(f)); return lerp(g[i], g[i + 1], f - i); };
  const dt = 0.25, xs = [0], vs = [0];
  let x = 0, v = 0;
  while (x < R_E) { v += gAt(R_E - x) * dt; x += v * dt; xs.push(x); vs.push(v); }
  const tAt = (d) => { for (let i = 1; i < xs.length; i++) if (xs[i] >= d) return (i - 1 + (d - xs[i - 1]) / (xs[i] - xs[i - 1])) * dt; return (xs.length - 1) * dt; };
  const vAt = (d) => { for (let i = 1; i < xs.length; i++) if (xs[i] >= d) return lerp(vs[i - 1], vs[i], (d - xs[i - 1]) / (xs[i] - xs[i - 1])); return vs[vs.length - 1]; };
  return { tAt, vAt, T: tAt(R_E) };
})();

// ------------------------------------------------------------------ depth <-> scene height
// [real depth (m), scene y]: the landmarks sit evenly down the cutaway; between them depth grows geometrically
const DY = [[0, 0], [12, -12], [105.5, -46], [300, -82], [2212, -126], [4000, -170], [12262, -214], [35000, -256], [160000, -298], [2890e3, -352], [5150e3, -404], [6371e3, -450]];
function depthAtY(y) {
  if (y >= 0) return 0;
  for (let i = 0; i < DY.length - 1; i++) {
    const [d0, y0] = DY[i], [d1, y1] = DY[i + 1];
    if (y >= y1) { const u = (y - y0) / (y1 - y0); return i === 0 ? lerp(d0, d1, u) : d0 * Math.pow(d1 / d0, u); }
  }
  const yc = DY[DY.length - 1][1];
  return R_E - (depthAtY(2 * yc - y) - R_E) * -1;      // past the centre: mirror (distance from the centre grows again)
}
const yAtDepth = (d) => { if (d >= R_E) return DY[DY.length - 1][1]; let lo = -460, hi = 0; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (depthAtY(m) > d) lo = m; else hi = m; } return (lo + hi) / 2; };

// ------------------------------------------------------------------ the story
const FT = 3.28084;
const LM = [
  { key: 'pipes', d: 12, cap: 'Pipes. Cables. Sewers.', sub: 'CITY UTILITIES · 40 FT' },
  { key: 'subway', d: 105.5, cap: 'The deepest subway station on Earth.', sub: 'ARSENALNA STATION, KYIV · 346 FT' },
  { key: 'water', d: 300, cap: 'Rain from centuries ago, soaked into rock.', sub: 'GROUNDWATER' },
  { key: 'cave', d: 2212, cap: 'The deepest cave anyone has explored.', sub: 'VERYOVKINA CAVE · 7,257 FT' },
  { key: 'mine', d: 4000, cap: 'The deepest mine. The rock is 150°F.', sub: 'MPONENG GOLD MINE · 13,000 FT' },
  { key: 'kola', d: 12262, cap: 'No human hole has ever gone deeper.', sub: 'KOLA SUPERDEEP BOREHOLE · 40,230 FT' },
  { key: 'moho', d: 35000, cap: 'The crust ends. The rock starts to glow.', sub: 'THE MANTLE BEGINS · 22 MI' },
  { key: 'diamonds', d: 160000, cap: 'Diamonds are born down here.', sub: 'DIAMOND ZONE · ~100 MI' },
  { key: 'core', d: 2890e3, cap: 'An ocean of liquid iron.', sub: 'OUTER CORE · 1,800 MI' },
  { key: 'inner', d: 5150e3, cap: 'Solid iron, as hot as the Sun’s surface.', sub: 'INNER CORE · 9,800°F' },
  { key: 'center', d: 6371e3, cap: 'Weightless, at 22,000 mph.', sub: 'THE CENTER OF THE EARTH · 3,959 MI' },
];
LM.forEach((l) => { l.y = yAtDepth(l.d); });
// the narration drives the clock: each line starts as the last one ends, and the fall reaches each landmark
// as its depth is said
const SAY = {};
let T_JUMP;
{
  let t = 0.25;
  const say = (key, gap = 0.15) => { SAY[key] = t + gap; t = SAY[key] + VO[key].dur; };
  say('hook', 0); T_JUMP = t + 0.1;
  say('goal', 0.35);
  for (const k of ['subway', 'cave', 'mine', 'kola', 'moho', 'diamonds', 'core', 'inner']) say(k, k === 'cave' ? 0.3 : 0.15);
  say('center', 0.6); say('tail', 0.2);
}
const wordT = (key, word) => { for (const [w, s] of VO[key].words) if (w.toLowerCase().replace(/[^a-z0-9']/g, '').startsWith(word)) return SAY[key] + s; return SAY[key]; };
LM.forEach((l) => { if (SAY[l.key] !== undefined) l.t = SAY[l.key] + 0.45; });
LM[0].t = T_JUMP + 1.75;                                         // the pipes come up right after the jump
LM[10].t = wordT('center', 'made');                               // "And he made it."
for (const k of ['subway', 'cave', 'mine']) LM.find((l) => l.key === k).t = wordT(k, 'deepest') - 0.15;   // the rooms fill the frame as they're named
LM[5].t = wordT('kola', 'deepest') - 0.4;
LM[2].t = (LM[1].t + LM[3].t) / 2 + 0.1;                         // groundwater, between the station and the cave
const T_CENTER = LM[LM.length - 1].t;
const T_HERE = T_CENTER;
const T_TAIL_END = SAY.tail + VO.tail.dur;
const FADE = [T_TAIL_END + 0.2, T_TAIL_END + 0.9], END = FADE[1] + 0.15, DURATION = END + 3.6;

const NUMS = [['three hundred feet', '300 feet'], ['seven thousand feet', '7,000 feet'], ['two and a half miles', '2.5 miles'], ['a hundred and fifty degrees', '150°F'],
  ['seven and a half miles', '7.5 miles'], ['point two percent', '0.2%'], ['twenty-two miles', '22 miles'], ['a hundred miles', '100 miles'], ['eighteen hundred miles', '1,800 miles'],
  ['twenty-two thousand miles an hour', '22,000 mph'], ['four thousand miles', '4,000 miles']];
// captions: the narration a clause at a time (long clauses split evenly), timed to the voice
function buildCaptions() {
  const out = [];
  for (const [key, at] of Object.entries(SAY)) {
    const ws = [];
    for (const [w, s, e] of VO[key].words) {
      if (ws.length && /^[-']/.test(w)) { const p = ws[ws.length - 1]; p[0] += w; p[2] = e; } else ws.push([w, s, e]);
    }
    // numbers read as digits on screen
    for (const [say, show] of NUMS) {
      const k = say.split(' ');
      for (let i = 0; i + k.length <= ws.length; i++) {
        if (k.every((x, j) => ws[i + j][0].toLowerCase().replace(/[^a-z-]/g, '') === x)) {
          const p = ws[i + k.length - 1][0].match(/[,.?!]$/)?.[0] ?? '';
          ws.splice(i, k.length, [show + p, ws[i][1], ws[i + k.length - 1][2]]);
        }
      }
    }
    const clauses = [[]];
    ws.forEach((w, i) => { clauses[clauses.length - 1].push(w); if (/[,.?!…:]$/.test(w[0]) && i < ws.length - 1) clauses.push([]); });
    const chunks = [];
    for (const c of clauses) { const n = Math.ceil(c.length / 5), per = Math.ceil(c.length / n); for (let i = 0; i < c.length; i += per) chunks.push(c.slice(i, i + per)); }
    chunks.forEach((c, i) => { const next = chunks[i + 1]; out.push([at + c[0][1], at + (next ? Math.min(next[0][1], c[c.length - 1][2] + 0.5) : c[c.length - 1][2] + 0.3), c.map((x) => x[0]).join(' ')]); });
  }
  out.sort((x, y) => x[0] - y[0]);
  for (let i = 0; i < out.length - 1; i++) out[i][1] = Math.min(out[i][1], out[i + 1][0] - 0.01);
  return out;
}
const CAPTIONS = buildCaptions();

// the jumper's height in the scene over video time: real free fall for the first metres, then landmark to
// landmark with no stops (monotone cubic through the keys), still falling as the camera holds at the centre
const PATH = (() => {
  const k = [];
  const tFree = 1.1;                                           // 6 m of honest free fall
  for (let i = 0; i <= 8; i++) { const tau = tFree * i / 8; k.push([T_JUMP + tau, -0.5 * G0 * tau * tau]); }
  for (const l of LM) if (l.key !== 'pipes') k.push([l.t, l.y]);
  k.push([T_CENTER + 6, LM[LM.length - 1].y - 60]);
  const xs = k.map((p) => p[0]), ys = k.map((p) => p[1]), n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = -G0 * 0; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : 2 / (1 / d[i - 1] + 1 / d[i]);
  return (t) => {
    if (t <= xs[0]) return 0;
    if (t >= xs[n - 1]) return ys[n - 1] + d[n - 2] * (t - xs[n - 1]);
    let i = 0; while (t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = (t - xs[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
  };
})();
const jumperY = (t) => (t < T_JUMP ? 0 : PATH(t));
const depthNow = (t) => (t < T_JUMP ? 0 : depthAtY(Math.max(jumperY(t), LM[LM.length - 1].y)));

const fmtDepth = (m) => { const ft = m * FT; if (ft < 30000) return `−${Math.round(ft).toLocaleString('en-US')} ft`; const mi = m / 1609.34; return mi < 100 ? `−${mi.toFixed(1)} mi` : `−${Math.round(mi).toLocaleString('en-US')} mi`; };
const fmtClock = (s) => { s = Math.max(0, s); const mm = Math.floor(s / 60), ss = Math.floor(s % 60); return `${mm}:${String(ss).padStart(2, '0')}`; };

// ------------------------------------------------------------------ materials and textures
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function ctex(cv, repeat) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function pavingTexture() {
  const S = 256, cv = canvas(S, S), c = cv.getContext('2d'), r = new Rng(4);
  c.fillStyle = '#b7aea0'; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const l = r.float(-8, 8);
    c.fillStyle = `hsl(36, 12%, ${66 + l}%)`; c.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
  }
  return ctex(cv, true);
}
function signTexture(lines, o = {}) {
  const cv = canvas(1024, 512), c = cv.getContext('2d');
  c.fillStyle = o.bg ?? '#1d3b6e'; c.fillRect(0, 0, 1024, 512);
  c.strokeStyle = o.fg ?? '#ffffff'; c.lineWidth = 14; c.strokeRect(20, 20, 984, 472);
  c.fillStyle = o.fg ?? '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  lines.forEach(([txt, size], i) => { c.font = `700 ${size}px Inter, Helvetica, Arial, sans-serif`; c.fillText(txt, 512, 256 + (i - (lines.length - 1) / 2) * size * 1.15); });
  return ctex(cv);
}

// the rock: one shader for the cut face, the shaft and every cavity. Colour comes from the real depth of each
// point (so strata line up everywhere), lighting from a soft key, a fill and up to four nearby lamps.
const ROCK_U = {
  uTime: { value: 0 }, uLampP: { value: [V(), V(), V(), V()] }, uLampC: { value: [new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0)] }, uLampR: { value: [1, 1, 1, 1] },
  uHoles: { value: new Array(12).fill(0).map(() => new THREE.Vector4(1e5, 1e5, 1e5, 1e5)) },
};
// depth (m) -> colour bands and glow, as GLSL
const ROCK_GLSL = `
  uniform float uTime, uLampR[4]; uniform vec3 uLampP[4], uLampC[4]; uniform vec4 uHoles[12];
  varying vec3 vW; varying vec3 vN; varying float vDepth;
  float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h1(i), h1(i+vec2(1,0)), f.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ return 0.55*n2(p) + 0.3*n2(p*2.1+3.1) + 0.15*n2(p*4.3+7.7); }
  vec3 strata(float d, vec2 p, out float glow, out vec3 gcol){
    float lg = log(max(d, 0.1)) / log(10.0);          // 0 at 1 m .. 6.8 at the centre
    float band = fbm(vec2(p.x * 0.02, lg * 9.0)) ;
    vec3 c; glow = 0.0; gcol = vec3(1.0, 0.45, 0.15);
    if (d < 2.5) c = mix(vec3(0.32,0.24,0.17), vec3(0.4,0.3,0.2), band);                      // topsoil
    else if (d < 60.0) c = mix(vec3(0.60,0.44,0.28), vec3(0.76,0.60,0.40), smoothstep(0.3, 0.7, fract(lg * 5.0 + band * 0.6)));  // clay and sand beds
    else if (d < 2000.0) c = mix(vec3(0.78,0.66,0.50), vec3(0.62,0.55,0.46), smoothstep(0.25, 0.75, fract(lg * 7.0 + band * 0.8)));  // sandstone, limestone
    else if (d < 35000.0) { c = mix(vec3(0.52,0.48,0.47), vec3(0.62,0.52,0.50), band); c *= 0.85 + 0.3 * step(0.86, h1(floor(p * 3.0))); }  // granite
    else if (d < 2890e3) {                                                                     // the mantle: hotter and brighter down
      float k = clamp((lg - 4.54) / (6.46 - 4.54), 0.0, 1.0);
      c = mix(vec3(0.30,0.26,0.20), vec3(0.45,0.12,0.06), k);
      float cr = smoothstep(0.47, 0.5, fbm(p * 0.35 + vec2(0.0, uTime * 0.05))) * (1.0 - smoothstep(0.5, 0.53, fbm(p * 0.35 + vec2(0.0, uTime * 0.05))));
      glow = mix(0.15, 1.0, k) * (0.45 + 0.6 * band) + cr * 1.6; gcol = mix(vec3(1.0,0.32,0.10), vec3(1.0,0.48,0.12), k);
    } else if (d < 5150e3) {                                                                  // liquid iron
      float fl = fbm(vec2(p.x * 0.08 + uTime * 0.35, p.y * 0.06 - uTime * 0.2)) + 0.5 * fbm(vec2(p.x * 0.3 - uTime * 0.5, p.y * 0.2));
      c = vec3(0.9, 0.5, 0.12); glow = 0.9 + 1.0 * fl; gcol = mix(vec3(1.0,0.55,0.12), vec3(1.0,0.82,0.35), fl);
    } else {                                                                                   // the inner core: white hot
      c = vec3(1.0, 0.9, 0.7); glow = 1.9 + 0.3 * band; gcol = vec3(1.0, 0.93, 0.78);
    }
    return c * (0.8 + 0.4 * band);
  }
  vec3 shade(vec3 base, float glow, vec3 gcol){
    vec3 N = normalize(vN);
    float key = 0.62 + 0.38 * max(dot(N, normalize(vec3(-0.3, 0.5, 0.8))), 0.0);
    vec3 c = base * key * 0.95;
    for (int i = 0; i < 4; i++) {
      vec3 L = uLampP[i] - vW; float dl = length(L);
      float att = pow(clamp(1.0 - dl / uLampR[i], 0.0, 1.0), 2.0);
      c += base * uLampC[i] * att * (0.35 + 0.65 * max(dot(N, L / dl), 0.0));
    }
    return c + gcol * glow * 0.85;
  }`;
function rockMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: ROCK_U, side: o.side ?? THREE.FrontSide,
    vertexShader: `varying vec3 vW; varying vec3 vN; varying float vDepth; uniform float uTime;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${ROCK_GLSL}
      uniform float uDY[24];
      float depthOf(float y){
        if (y >= 0.0) return 0.0;
        for (int i = 0; i < 11; i++) {
          float d0 = uDY[i*2], y0 = uDY[i*2+1], d1 = uDY[i*2+2], y1 = uDY[i*2+3];
          if (y >= y1) { float u = (y - y0) / (y1 - y0); return i == 0 ? mix(d0, d1, u) : d0 * pow(d1 / d0, u); }
        }
        float ym = 2.0 * uDY[23] - y;                 // past the centre: the same layers again, mirrored
        return ym >= uDY[21] ? 5.8e6 : 4.0e6;
      }
      void main(){
        ${o.holes ? `for (int i = 0; i < 12; i++) { vec4 hb = uHoles[i]; if (vW.x > hb.x && vW.x < hb.z && vW.y > hb.y && vW.y < hb.w) discard; }` : ''}
        float d = depthOf(vW.y);
        float glow; vec3 gcol;
        vec2 p = vec2(vW.x + vW.z * 0.7, vW.y);
        vec3 base = strata(d, p, glow, gcol);
        ${o.wet ? 'base *= 0.75;' : ''}
        vec3 c = shade(base, glow, gcol);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
function addDY(mat) { mat.uniforms = Object.assign({}, mat.uniforms, { uDY: { value: DY.flat() } }); return mat; }

// ------------------------------------------------------------------ the world
function buildWorld(st) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fc4ea');
  const SUN = V(-0.45, 0.75, 0.48).normalize();
  const sky = buildDaySky({ sun: SUN, zenith: '#3f7fd1', horizon: '#cfe2f3' });
  scene.add(sky.mesh);
  st.sky = sky;
  const hemi = new THREE.HemisphereLight('#dce9ff', '#8a7a62', 1.1);
  const sun = new THREE.DirectionalLight('#fff2df', 2.6);
  sun.position.copy(SUN).multiplyScalar(80); sun.target.position.set(0, 0, -14);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 260 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);
  st.hemi = hemi; st.sun = sun;

  // ---- the shaft (radius 3 m) and the rooms it falls through; rock everywhere follows the real depth
  const RS = 3;
  const rockIn = addDY(rockMaterial({ side: THREE.BackSide }));
  const rockOut = addDY(rockMaterial({ side: THREE.DoubleSide }));
  const yS = LM[1].y, yC = LM[3].y, yM = LM[4].y;
  const ROOMS = [
    { key: 'subway', x0: -48, x1: 48, y0: yS - 5.5, y1: yS + 2.5, z0: -5.5, z1: 5.5 },
    { key: 'cave', x0: -30, x1: 30, y0: yC - 10, y1: yC + 9, z0: -26, z1: 22 },
    { key: 'mine', x0: -42, x1: 42, y0: yM - 4, y1: yM + 2.6, z0: -3.2, z1: 3.2 },
  ];
  // shaft walls between the rooms
  const spans = [[0.5, -1000]];
  for (const R of ROOMS) { const out = []; for (const [a, b] of spans) { if (R.y1 <= b || R.y0 >= a) out.push([a, b]); else { if (a > R.y1) out.push([a, R.y1]); if (R.y0 > b) out.push([R.y0, b]); } } spans.splice(0, spans.length, ...out); }
  for (const [a, b] of spans) { const m = new THREE.Mesh(new THREE.CylinderGeometry(RS, RS, a - b, 64, Math.max(1, Math.round((a - b) / 2)), true).translate(0, (a + b) / 2, 0), rockIn); m.frustumCulled = false; scene.add(m); }
  // each room: walls and ceiling (seen from inside), a floor with the shaft's hole in it
  const floorWithHole = (R) => { const s = new THREE.Shape(); s.moveTo(R.x0, R.z0); s.lineTo(R.x1, R.z0); s.lineTo(R.x1, R.z1); s.lineTo(R.x0, R.z1); s.lineTo(R.x0, R.z0); const h = new THREE.Path(); h.absarc(0, 0, RS, 0, Math.PI * 2, true); s.holes.push(h); return new THREE.ShapeGeometry(s, 48).rotateX(Math.PI / 2).translate(0, R.y0, 0); };
  for (const R of ROOMS) {
    const w = R.x1 - R.x0, hgt = R.y1 - R.y0, d = R.z1 - R.z0, cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, cz = (R.z0 + R.z1) / 2;
    const g = new THREE.BoxGeometry(w, hgt, d).translate(cx, cy, cz);
    g.groups = g.groups.filter((gr) => gr.materialIndex !== 3);       // no floor face: the floor below has the hole
    const box = new THREE.Mesh(g, [rockIn, rockIn, rockIn, rockIn, rockIn, rockIn]); box.frustumCulled = false; scene.add(box);
    const fl = new THREE.Mesh(floorWithHole(R), rockOut); fl.material = rockOut; fl.frustumCulled = false; scene.add(fl);
    // the floor's underside and the slab between the room and the shaft below: a short collar of shaft wall
  }
  st.ROOMS = ROOMS;

  // ---- the surface: paving round the hole, buildings, trees, barriers, a crowd
  const pave = pavingTexture();
  const groundMat = new THREE.MeshStandardMaterial({ map: pave, roughness: 0.92 });
  {
    const s = new THREE.Shape(); s.moveTo(-200, -200); s.lineTo(200, -200); s.lineTo(200, 200); s.lineTo(-200, 200); s.lineTo(-200, -200);
    const h = new THREE.Path(); h.absarc(0, 0, RS, 0, Math.PI * 2, true); s.holes.push(h);
    const g = new THREE.ShapeGeometry(s, 64).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 4, p.getZ(i) / 4);
    const m = new THREE.Mesh(g, groundMat); m.receiveShadow = true; scene.add(m);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(RS + 0.05, 0.14, 8, 64).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4a3b2c', roughness: 1 }));
    lip.position.y = 0.03; lip.receiveShadow = true; scene.add(lip);
  }
  const kit = townKit(), r = new Rng(21);
  const bl = [];
  for (let i = -5; i <= 5; i++) bl.push({ x: i * 15 + r.float(-2, 2), z: -58 - r.float(0, 10), w: r.float(11, 14), d: r.float(12, 18), h: r.float(16, 46), style: r.int(0, 5), box: r.chance(0.5) });
  for (const z of [-24, -40]) for (const s of [-1, 1]) bl.push({ x: s * r.float(36, 44), z, w: 13, d: 14, h: r.float(14, 30), style: r.int(0, 5), rot: 0 });
  for (const b of bl) scene.add(kit.building(b));
  const trees = [];
  for (let i = 0; i < 16; i++) trees.push({ x: lerp(-60, 60, i / 15) + r.float(-2, 2), z: -46 + r.float(-2, 2), s: r.float(0.9, 1.2), h: r.float(4, 6) });
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) trees.push({ x: s * r.float(22, 30), z: -6 - i * 9, s: r.float(0.8, 1.1), h: r.float(4, 5.5) });
  scene.add(kit.trees(trees));
  // barriers in a ring round the hole (red and white), open at the back where the jumper stands; cones
  const barM = [new THREE.MeshStandardMaterial({ color: '#d83a2e', roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.6 })];
  for (let i = 0; i < 18; i++) {
    const a = (i + 0.5) / 18 * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.3) continue;   // the gap at the back
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.9, 0.45).translate(0, 0.45, 0), barM[i % 2]);
    m.position.set(Math.cos(a) * 5.4, 0, Math.sin(a) * 5.4); m.rotation.y = -a + Math.PI / 2; m.castShadow = true; m.receiveShadow = true; scene.add(m);
  }
  const coneM = new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.5 });
  for (const [x, z] of [[-6.6, 1.4], [6.8, 0.6], [-6.2, -4.4], [6.4, -4.8], [-1.6, -6.6], [1.7, -6.5]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 12).translate(0, 0.375, 0), coneM); c.position.set(x, 0, z); c.castShadow = true; scene.add(c); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), new THREE.MeshStandardMaterial({ map: signTexture([['HOLE TO THE CENTER', 92], ['OF THE EARTH', 92], ['3,959 MILES · KEEP BACK', 58]], { bg: '#f4c400', fg: '#1a1a1a' }), roughness: 0.6 }));
  sign.position.set(-8.2, 2.5, -6.5); sign.rotation.y = 0.55; sign.castShadow = true; scene.add(sign);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5), new THREE.MeshStandardMaterial({ color: '#555' })); post.position.set(-8.2, 0.75, -6.55); scene.add(post);

  // ---- people: the crowd round the barriers, the jumper, and everyone underground
  const ppl = buildPeople({ max: 260, seed: 9 });
  scene.add(ppl.group);
  st.ppl = ppl;
  ppl.POSES.plunge = (ph, t, s) => ({ armL: 2.9 + 0.14 * Math.sin(t * 5 + s), armR: 2.9 + 0.14 * Math.sin(t * 5.5 + s + 2), armLr: 0.2, armRr: -0.2, head: 0.3, legL: 0.15 * Math.sin(t * 3), legR: -0.15 * Math.sin(t * 3) });
  ppl.POSES.float = (ph, t, s) => ({ armL: 1.6 + 0.12 * Math.sin(t * 1.3), armR: 1.6 + 0.12 * Math.sin(t * 1.1 + 1), armLr: 1.0, armRr: -1.0, legL: 0.3, legR: -0.2, legLr: 0.2, legRr: -0.2, head: 0.1 });
  ppl.POSES.lean = (ph, t, s) => ({ torso: 0.35, head: 0.5, armL: 0.5, armR: 0.5 });
  const crowdPoses = ['idle', 'phone', 'lookUp', 'point', 'pointFwd', 'handsHead', 'phone', 'shrug'];
  for (let i = 0; i < 170; i++) {
    const a = r.float(0, Math.PI * 2), dist = r.float(6.4, 24);
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    if (z > 3 && Math.abs(x) < 9) continue;                      // keep the camera's view of the hole clear
    if (Math.abs(x) < 2.5 && z < -5 && z > -9) continue;         // and the jumper's way in
    const h = Math.atan2(-x, -z);
    const pose = r.pick(crowdPoses);
    const react = r.float(T_JUMP - 0.1, T_JUMP + 0.5);
    ppl.add({ x, z, h, poses: [[0, pose === 'handsHead' ? 'idle' : pose], [react, r.pick(['handsHead', 'point', 'phone', 'lean']), 0.25]], phone: pose === 'phone' ? () => true : null, visible: (t) => t < T_JUMP + 4 });
  }
  // the jumper: at the back edge of the hole, facing the camera
  st.jumper = ppl.add({ x: 0, z: -3.6, h: 0, shirt: '#e8562a', pants: '#25344a', skin: '#d6a07c', hair: 'short', hairC: '#2e2018', scale: 1,
    poses: [[0, 'idle'], [T_JUMP - 0.7, 'crouch', 0.35], [T_JUMP, 'plunge', 0.15], [LM[6].t, 'float', 1.5]] });
  st.groupsUnderground = buildUnderground(scene, st, ppl);
  return scene;
}

// ------------------------------------------------------------------ landmarks
function buildUnderground(scene, st, ppl) {
  const r = new Rng(31), RS = 3;
  const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75 }, o));
  const add = (geo, mat, x, y, z, rot) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rot) m.rotation.set(...rot); m.frustumCulled = false; scene.add(m); return m; };
  const lamps = [];
  const lamp = (p, col, range) => lamps.push({ p, col: new THREE.Color(col), range });
  const glowM = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  // a flat thing on the shaft wall at angle a, facing the middle
  const onWall = (geo, mat, a, y, inset = 0.04) => add(geo, mat, Math.cos(a) * (RS - inset), y, Math.sin(a) * (RS - inset), [0, Math.atan2(-Math.cos(a), -Math.sin(a)), 0]);
  const CAM_A = Math.atan2(1.9, 1.8), FAR_A = CAM_A + Math.PI;   // the camera rides one side of the shaft; signs go on the far side

  // ---- pipes and cables cut where the shaft went through; the old sewer pours into it
  const yP = LM[0].y;
  const stubs = [[yP + 5, 0.32, '#3a74c8', 0.3], [yP + 3.2, 0.2, '#f0c020', 2.0], [yP + 1.6, 0.45, '#2b2b2b', 3.7], [yP - 0.6, 0.95, '#7b6a58', FAR_A], [yP - 3.4, 0.28, '#3a9a5c', 4.9], [yP + 6.5, 0.25, '#c23b2b', 5.6]];
  const nearCam = (a) => Math.abs(Math.atan2(Math.sin(a - CAM_A), Math.cos(a - CAM_A))) < 0.75;   // nothing sticks out where the camera rides
  for (const [y, rad, col, a] of stubs) for (const s of [0, Math.PI]) {
    const aa = a + s, len = 1.1;
    if (nearCam(aa)) continue;
    const m = add(new THREE.CylinderGeometry(rad, rad, len, 20).rotateZ(Math.PI / 2).translate(RS - len / 2 + 0.4, 0, 0), std(col, { roughness: 0.5 }), 0, y, 0, [0, -aa, 0]);
    add(new THREE.CircleGeometry(rad * 0.75, 20).rotateY(-Math.PI / 2).translate(RS - len + 0.41, 0, 0), glowM('#120e0b'), 0, y, 0, [0, -aa, 0]);
  }
  st.sewer = { a: FAR_A, y: yP - 0.6 };
  st.pour = [];
  const pourM = new THREE.MeshBasicMaterial({ color: '#8a7a5a', transparent: true, opacity: 0.85 });
  for (let i = 0; i < 70; i++) { const m = add(new THREE.SphereGeometry(r.float(0.05, 0.12), 6, 4), pourM, 0, 0, 0); st.pour.push({ m, ph: r.float(0, 1), dx: r.float(-0.3, 0.3), dz: r.float(-0.3, 0.3), v: r.float(0.9, 1.3) }); }
  lamp(V(0, yP + 2, 0), '#fff3dc', 14);

  // ---- the deepest subway station: tiled walls, platform, waiting people, a train that thunders over the hole
  const yS = LM[1].y, fl = yS - 5.5;
  const tile = (() => { const cv = canvas(256, 256), c = cv.getContext('2d'); c.fillStyle = '#e9e4d4'; c.fillRect(0, 0, 256, 256); c.strokeStyle = '#bab3a0'; c.lineWidth = 3; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32, 256); c.stroke(); c.beginPath(); c.moveTo(0, i * 32); c.lineTo(256, i * 32); c.stroke(); } c.fillStyle = '#c7962e'; c.fillRect(0, 150, 256, 20); const t = ctex(cv, true); t.repeat.set(30, 2.4); return t; })();
  for (const z of [-5.45, 5.45]) add(new THREE.PlaneGeometry(96, 8), std('#ffffff', { map: tile, roughness: 0.4 }), 0, yS - 1.5, z, [0, z < 0 ? 0 : Math.PI, 0]);
  add(new THREE.BoxGeometry(96, 1.0, 2.1).translate(0, 0.5, 0), std('#a49e92'), 0, fl, -4.45);                        // platform
  add(new THREE.BoxGeometry(96, 0.05, 0.3), std('#f2d33a'), 0, fl + 1.01, -3.45);
  for (const zr of [3.25, 4.75]) for (const s of [-1, 1]) add(new THREE.BoxGeometry(45, 0.16, 0.12).translate(s * 25.5, 0, 0), std('#8d8d8d', { metalness: 0.7, roughness: 0.4 }), 0, fl + 0.12, zr);
  for (const zr of [3.25, 4.75]) add(new THREE.BoxGeometry(6.2, 0.16, 0.12), std('#8d8d8d', { metalness: 0.7, roughness: 0.4 }), 0, fl + 0.12, zr);   // the rails carry on over the hole
  add(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: signTexture([['АРСЕНАЛЬНА', 120], ['ARSENALNA', 80]], { bg: '#1c4f9c' }), toneMapped: false }), -9, yS - 0.2, -5.4);
  add(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: signTexture([['АРСЕНАЛЬНА', 120], ['ARSENALNA', 80]], { bg: '#1c4f9c' }), toneMapped: false }), 14, yS - 0.2, -5.4);
  for (let x = -45; x <= 45; x += 6) add(new THREE.BoxGeometry(2.6, 0.12, 0.5), glowM('#fff6dc'), x, yS + 2.35, -2.6);
  lamp(V(-10, yS + 1.5, -2), '#fff1d6', 26); lamp(V(12, yS + 1.5, -2), '#fff1d6', 26);
  for (let i = 0; i < 22; i++) { let x; do { x = r.float(-40, 40); } while (Math.abs(x) < 3.5); ppl.add({ x, z: r.float(-5.0, -3.9), y: fl + 1, h: r.float(-0.3, 0.3) + (r.chance(0.5) ? 0 : Math.PI / 2), poses: [[0, r.pick(['idle', 'phoneLow', 'idle', 'lookUp', 'phoneLow'])], [LM[1].t - 0.6, r.pick(['handsHead', 'point', 'lookUp']), 0.3]], phone: () => true }); }
  const train = new THREE.Group();
  const carTex = (() => { const cv = canvas(512, 128), c = cv.getContext('2d'); c.fillStyle = '#d7dde2'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#2f7fd0'; c.fillRect(0, 86, 512, 12); for (let i = 0; i < 6; i++) { c.fillStyle = '#ffeec2'; c.fillRect(20 + i * 82, 26, 60, 44); c.fillStyle = 'rgba(40,40,50,0.55)'; c.fillRect(34 + i * 82, 44, 14, 26); } return ctex(cv); })();
  const side = new THREE.MeshStandardMaterial({ map: carTex, roughness: 0.4, emissive: '#ffe9b8', emissiveIntensity: 0.3, emissiveMap: carTex });
  for (let i = 0; i < 6; i++) { const car = new THREE.Mesh(new THREE.BoxGeometry(19.4, 3.4, 2.9).translate(0, 1.95, 0), [std('#cfd6dc'), std('#cfd6dc'), std('#aab3ba'), std('#2a2a2a'), side, side]); car.position.x = -i * 20; train.add(car); }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 2), glowM('#fffbe6')); head.position.set(9.75, 1.2, 0); train.add(head);
  train.position.set(-300, fl + 0.18, 4.0); scene.add(train);
  st.train = { g: train, tPass: LM[1].t + 0.45, speed: 26 };

  // ---- groundwater: the walls are wet, water runs down them and drips across the shaft
  st.drips = [];
  const dripM = new THREE.MeshBasicMaterial({ color: '#a9dbff', transparent: true, opacity: 0.8, toneMapped: false });
  for (let i = 0; i < 70; i++) { const a = r.float(0, Math.PI * 2), rr = RS - r.float(0.05, 0.4); const m = add(new THREE.SphereGeometry(0.05, 6, 4), dripM, 0, 0, 0); m.scale.y = 3.5; st.drips.push({ m, x: Math.cos(a) * rr, z: Math.sin(a) * rr, y0: LM[2].y + r.float(-4, 10), ph: r.float(0, 1), sp: r.float(0.8, 1.4) }); }
  const wet = add(new THREE.CylinderGeometry(RS - 0.02, RS - 0.02, 16, 64, 1, true), new THREE.MeshBasicMaterial({ color: '#2f78b8', transparent: true, opacity: 0.2, side: THREE.BackSide, depthWrite: false, toneMapped: false }), 0, LM[2].y + 2, 0);
  lamp(V(0, LM[2].y + 3, 0), '#cfe6ff', 14);

  // ---- the deepest cave: a cavern of stalactites and stalagmites, a still pool, cavers with headlamps
  const yC = LM[3].y, R3 = st.ROOMS.find((x) => x.key === 'cave');
  const caveM = std('#9a8c7c', { roughness: 0.95, flatShading: true });
  for (let i = 0; i < 90; i++) { const x = r.float(R3.x0 + 2, R3.x1 - 2), z = r.float(R3.z0 + 2, R3.z1 - 2); if (Math.hypot(x, z) < 4.5) continue; const h = r.float(1.2, 6.5); add(new THREE.ConeGeometry(r.float(0.3, 1.0), h, 7).rotateX(Math.PI), caveM, x, R3.y1 - h / 2, z); }
  for (let i = 0; i < 55; i++) { const x = r.float(R3.x0 + 2, R3.x1 - 2), z = r.float(R3.z0 + 2, R3.z1 - 2); if (Math.hypot(x, z) < 4.5) continue; const h = r.float(1, 4.5); add(new THREE.ConeGeometry(r.float(0.4, 1.1), h, 7), caveM, x, R3.y0 + h / 2, z); }
  add(new THREE.CircleGeometry(9, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1d6488', roughness: 0.06, metalness: 0.3 }), -14, R3.y0 + 0.05, -10);
  add(new THREE.BoxGeometry(9, 1, 6), caveM, 11, R3.y0 + 4, -9);
  for (const [x, z, h] of [[9.5, -8.5, -2.6], [12.5, -9.6, -2.2]]) ppl.add({ x, z, y: R3.y0 + 4.5, h, shirt: '#e0b030', hair: 'cap', hairC: '#d93a2a', poses: [[0, 'torch'], [LM[3].t - 0.5, 'point', 0.4]], torch: () => true });
  add(new THREE.CylinderGeometry(0.035, 0.035, R3.y1 - R3.y0 - 4), std('#d23b2e'), 8, (R3.y0 + R3.y1) / 2 + 2, -8);
  lamp(V(11, R3.y0 + 6, -8), '#ffe0a8', 22); lamp(V(-14, R3.y0 + 3, -10), '#7fb7ff', 18); lamp(V(0, yC + 4, 8), '#ffd9a0', 18);

  // ---- the deepest mine: a timbered drift across the shaft, rails, an ore cart, miners, string lights, gold
  const yM = LM[4].y, mf = yM - 4;
  const wood = std('#7a5636', { roughness: 0.9 });
  for (let x = -40; x <= 40; x += 4) { if (Math.abs(x) < 4) continue; for (const z of [-2.9, 2.9]) add(new THREE.BoxGeometry(0.35, 6.4, 0.35), wood, x, yM - 0.8, z); add(new THREE.BoxGeometry(0.4, 0.4, 6.2), wood, x, yM + 2.3, 0); }
  for (const zr of [-0.55, 0.55]) add(new THREE.BoxGeometry(84, 0.12, 0.1), std('#777', { metalness: 0.7 }), 0, mf + 0.07, zr);
  for (let x = -40; x <= 40; x += 2) if (Math.abs(x) > 3.2) add(new THREE.SphereGeometry(0.1, 8, 6), glowM('#ffd27a'), x, yM + 2.0, -2.4);
  const cart = new THREE.Group();
  cart.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1.1, 1.4).translate(0, 0.85, 0), std('#55606a', { metalness: 0.5 })));
  cart.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.2).translate(0, 1.35, 0), std('#6a5a4a', { flatShading: true })));
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) cart.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12).rotateX(Math.PI / 2).translate(x, 0.28, z), std('#333')));
  scene.add(cart);
  st.cart = { g: cart, y: mf };
  for (const [x, z, h, pose] of [[9, -1.6, -Math.PI / 2, 'point'], [14, 1.6, Math.PI / 2, 'idle'], [-9, -1.6, Math.PI / 2, 'torch'], [-15, 1.5, -Math.PI / 2, 'idle'], [22, 0, -Math.PI / 2, 'torch']]) ppl.add({ x, z, y: mf, h, shirt: '#e8742a', hair: 'cap', hairC: '#f2c200', poses: [[0, pose], [LM[4].t - 0.4, 'handsHead', 0.3]], torch: pose === 'torch' ? () => true : null });
  const goldM = new THREE.MeshStandardMaterial({ color: '#ffcf4a', metalness: 1, roughness: 0.25, emissive: '#7a5600', emissiveIntensity: 0.8 });
  for (let i = 0; i < 120; i++) { const x = r.float(-40, 40), z = r.pick([-3.15, 3.15]); add(new THREE.OctahedronGeometry(r.float(0.06, 0.16)), goldM, x, yM + r.float(-3.6, 2.2), z); }
  lamp(V(10, yM, 0), '#ffcf8a', 22); lamp(V(-12, yM, 0), '#ffcf8a', 20);

  // ---- Kola: a hazard ring painted round the shaft and a plaque
  const yK = LM[5].y;
  const hz = (() => { const cv = canvas(1024, 64), c = cv.getContext('2d'); for (let i = 0; i < 32; i++) { c.fillStyle = i % 2 ? '#f2c400' : '#141414'; c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32 + 32, 0); c.lineTo(i * 32 + 16, 64); c.lineTo(i * 32 - 16, 64); c.fill(); } return ctex(cv, true); })();
  hz.repeat.set(2, 1);
  add(new THREE.CylinderGeometry(RS - 0.03, RS - 0.03, 0.6, 64, 1, true), new THREE.MeshBasicMaterial({ map: hz, side: THREE.BackSide, toneMapped: false }), 0, yK, 0);
  onWall(new THREE.PlaneGeometry(3.6, 1.3), new THREE.MeshBasicMaterial({ map: signTexture([['KOLA SUPERDEEP BOREHOLE', 64], ['40,230 FT · DEEPEST HOLE EVER DUG', 46]], { bg: '#2a2a2e', fg: '#f4f0e6' }), toneMapped: false }), FAR_A, yK - 1.2);
  lamp(V(0, yK, 0), '#ffffff', 12);

  // ---- diamonds glint in the walls
  st.diamonds = [];
  for (let i = 0; i < 140; i++) { const a = r.float(0, Math.PI * 2); const m = add(new THREE.OctahedronGeometry(r.float(0.05, 0.14)), new THREE.MeshBasicMaterial({ color: '#eefcff', toneMapped: false, transparent: true }), Math.cos(a) * (RS - 0.03), LM[7].y + r.float(-14, 14), Math.sin(a) * (RS - 0.03)); st.diamonds.push({ m, ph: r.float(0, 6.28), f: r.float(1.5, 4) }); }

  // ---- embers in the hot layers, streaming up past you (they show the speed where the walls are plain)
  st.embers = [];
  const emTex = (() => { const cv = canvas(64, 64), c = cv.getContext('2d'); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,200,120,0.8)'); g.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return ctex(cv); })();
  for (let i = 0; i < 160; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); sp.scale.set(0.12, 0.6, 1); sp.visible = false; scene.add(sp); const a = r.float(0, Math.PI * 2), rr = Math.sqrt(r.next()) * (RS - 0.3); st.embers.push({ sp, x: Math.cos(a) * rr, z: Math.sin(a) * rr, ph: r.float(0, 40), off: Math.hypot(Math.cos(a) * rr - 1.9, Math.sin(a) * rr - 1.8) < 1.4 }); }

  // ---- the centre: a ring of light round the shaft
  st.centerRing = add(new THREE.TorusGeometry(RS - 0.1, 0.07, 8, 64), glowM('#ffffff'), 0, LM[10].y, 0, [Math.PI / 2, 0, 0]);
  return { lamps };
}

// ------------------------------------------------------------------ camera
const cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 3000);
function camAt(t) {
  const yj = jumperY(t);
  // surface: a slow push toward the hole over the crowd
  const e0 = easeInOut(clamp(t / T_JUMP));
  const surf = { pos: V(lerp(-6, -2.5, e0), lerp(13, 7.5, e0), lerp(30, 17, e0)), look: V(0, lerp(1.2, 0.2, e0), lerp(-6, -2, e0)) };
  // the dive: just above and behind the jumper inside the shaft, looking down past them. In the rooms the camera
  // swings out and looks across, so you see the platform, the cavern, the drift as you fall through
  const yHold = LM[LM.length - 1].y;
  const ycam = t < T_CENTER - 1.4 ? yj : Math.max(lerp(yj, yHold, smooth(T_CENTER - 1.4, T_CENTER, t)), yHold);
  const LOOK = { subway: [-1, 0, 0.2], cave: [-0.6, 0, -1], mine: [1, 0, 0.1] };
  const lk = V(0, 0, 0); let w = 0;
  for (const l of LM) if (LOOK[l.key]) { const g = Math.exp(-(((t - l.t) / 1.25) ** 2)); lk.add(V(...LOOK[l.key]).multiplyScalar(g)); w = Math.max(w, g); }
  const pos = V(1.9 - lk.x * 0.7, ycam + lerp(5.6, 2.6, w), 1.8 - lk.z * 0.9 - 0.6 * w);
  const look = V(lk.x * 9, ycam - lerp(0.6, 1.0, w), lk.z * 9);
  const dive = { pos, look };
  // into the hole without touching anything: first glide over the middle of the hole (staying above the
  // barriers), then drop down the shaft after the jumper
  const k1 = smooth(T_JUMP - 0.3, T_JUMP + 0.9, t), k2 = smooth(T_JUMP + 0.7, T_JUMP + 1.9, t);
  const cp = V(lerp(surf.pos.x, dive.pos.x, k1), lerp(lerp(surf.pos.y, 4.2, k1), dive.pos.y, k2), lerp(surf.pos.z, dive.pos.z, k1));
  return { pos: cp, look: surf.look.clone().lerp(dive.look, k1), fov: lerp(46, 72, k1) };
}

// ------------------------------------------------------------------ sound
const S_ = (file, t, o = {}) => Object.assign({ type: 'sample', file, t }, o);
function buildAudio() {
  const A = [];
  const fx = (type, o) => A.push(Object.assign({ type }, o));
  const keysEvery = (f, step = 0.05) => { const ks = []; for (let t = 0; t <= DURATION; t += step) ks.push([+t.toFixed(2), +f(t).toFixed(3)]); return ks; };
  for (const [key, at] of Object.entries(SAY)) A.push(S_(VO[key].file, at, { level: 1.35, free: true, verb: 0.03, fin: 0.005, fout: 0.03 }));
  const talking = (t) => { let k = 0; for (const [key, at] of Object.entries(SAY)) k = Math.max(k, smooth(at - 0.15, at, t) * (1 - smooth(at + VO[key].dur, at + VO[key].dur + 0.25, t))); return k; };
  A.push({ type: 'fxduck', keys: keysEvery((t) => 1 - 0.45 * talking(t), 0.04) });
  // "Silent Descent": entered so its big swell (70 s into the track) arrives with the liquid iron
  const off = Math.max(0, 70 - LM[8].t);
  A.push(S_('music/614.mp3', 0, { offset: off, level: 0.5, fin: 0.4, fout: 2.0, dur: DURATION,
    keys: keysEvery((t) => (t < T_HERE - 0.3 ? 0.85 : t < T_HERE + 0.05 ? 0.15 : 1) * (1 - 0.5 * talking(t))) }));
  // the plaza: city room tone and a crowd that gasps when they jump
  A.push(S_('sfx/367.wav', 0, { offset: 12, dur: T_JUMP + 3, level: 0.5, fout: 2.0, keys: keysEvery((t) => 1 - 0.5 * talking(t)) }));
  fx('crowd', { t0: 0, t1: T_JUMP + 2.5, level: 0.3, swell: [[0, 0.4], [T_JUMP - 0.2, 0.45], [T_JUMP + 0.4, 1], [T_JUMP + 2.5, 0.15]] });
  fx('gasp', { t: T_JUMP + 0.12, level: 0.5 });
  fx('snap', { t: T_JUMP, size: 0.25, level: 0.6, seed: 2 });
  // falling: air rushing faster with the real speed, a whoosh past each landmark, a boom into each hotter layer
  const speed = (t) => (t < T_JUMP ? 0 : clamp(Math.pow(FALL.vAt(depthNow(t)) / 9900, 0.45)));
  fx('rush', { t0: T_JUMP, t1: T_CENTER + 6, level: 0.42, seed: 3, speed: keysEvery((t) => (t > T_CENTER ? speed(T_CENTER) * (1 - smooth(T_CENTER + 3, T_CENTER + 6, t)) : speed(t)), 0.05) });
  LM.forEach((l, i) => fx('sweep', { t: l.t, pre: 0.6, post: 0.35, f: i % 2 ? [5200, 380] : [380, 5200], q: 1.6, level: 0.42, pan: i % 2 ? [0.5, -0.5] : [-0.5, 0.5], seed: 10 + i }));
  // the sewer pours, the train thunders past, water drips, the mine clanks, the rock roars
  fx('water', { t0: LM[0].t - 2.5, t1: LM[0].t + 2.5, level: 0.35, kind: 'pour' });
  fx('sweep', { t: st_trainPass(), pre: 1.4, post: 1.6, f: [180, 1800], q: 0.9, curve: 2.0, tone: 0.35, hit: 0.6, level: 0.6, pan: [-0.9, 0.9], seed: 21 });
  fx('pulse', { t0: st_trainPass() - 1.2, t1: st_trainPass() + 1.4, bpm: [380, 380], level: 0.25 });
  fx('sparkle', { t: LM[2].t - 0.8, dur: 2.2, count: 9, f: [900, 2600], level: 0.18, seed: 30 });
  fx('sparkle', { t: LM[3].t - 0.6, dur: 2.0, count: 7, f: [700, 2000], level: 0.16, seed: 31 });
  fx('creak', { t0: LM[4].t - 1.2, t1: LM[4].t + 1.0, level: 0.25, seed: 32 });
  fx('snap', { t: LM[4].t + 0.2, size: 0.6, level: 0.35, seed: 33 });
  for (const [i, lv] of [[6, 0.45], [8, 0.7], [9, 0.8]]) fx('impact', { t: LM[i].t - 0.05, level: lv * 0.55, seed: 40 + i, dur: 1.6 });
  fx('rumble', { t0: LM[6].t - 1, t1: T_CENTER + 2, level: 0.3, cut: 120, grit: 0.25, swell: [[LM[6].t - 1, 0], [LM[8].t, 0.8], [LM[9].t, 1], [T_CENTER, 0.6], [T_CENTER + 2, 0]] });
  fx('sparkle', { t: LM[7].t - 0.7, dur: 1.6, count: 12, f: [1800, 6000], level: 0.22, seed: 34 });
  // the centre: everything drops away for a moment, then the hit
  A.push({ type: 'duck', keys: [[0, 1], [T_HERE - 0.3, 1], [T_HERE - 0.22, 0.08], [T_HERE - 0.01, 0.08], [T_HERE + 0.02, 1], [DURATION, 1]] });
  fx('sweep', { t: T_HERE - 0.3, pre: 1.8, post: 0.02, f: [250, 9500], q: 1.2, curve: 2.8, tone: 0.5, level: 0.6, pan: [-0.3, 0.3], seed: 50 });
  A.push({ type: 'impact', t: T_HERE, level: 0.9, free: true, seed: 51 });
  A.push({ type: 'chime', t: END, level: 0.2, free: true });
  return A;
}
const st_trainPass = () => LM[1].t + 0.55;

// ------------------------------------------------------------------ the scenario
export default {
  id: 'hole-center',
  title: 'What if you fell into a hole to the center of the Earth?',
  endFact: 'Falling the whole way in a vacuum takes about <b>19 minutes</b>. The deepest hole ever dug covers <b>0.2%</b> of it.',
  duration: DURATION,
  titleIn: [-1, -0.5], titleOut: [-0.4, -0.3],              // no title card: the narration's first line is the hook
  fadeOut: FADE, endAt: END, endSpeed: 1.3,
  captions: CAPTIONS,
  captionFade: 0.06,
  // the goal, always on screen: how much of the 3,959 miles he has fallen
  goal(t) {
    const a = smooth(0.3, 0.8, t) * (1 - smooth(FADE[0], FADE[1], t));
    if (a <= 0) return null;
    if (t >= T_HERE) return { label: 'GOAL REACHED ✓', pct: '100%', k: 1, from: 'SURFACE', to: 'THE CENTER', alpha: a };
    const p = depthNow(t) / R_E * 100;
    return { label: 'GOAL: THE CENTER', pct: p < 0.005 ? '0%' : p < 1 ? `${p.toFixed(2)}%` : p < 10 ? `${p.toFixed(1)}%` : `${Math.floor(p)}%`, k: p / 100, from: 'SURFACE', to: '3,959 MI', alpha: a };
  },
  hud(t) {
    if (t >= FADE[1]) return null;
    const a = 1 - smooth(FADE[0], FADE[1], t);
    if (t >= T_HERE) return { label: 'THE CENTER', value: 'HERE', sub: '3,959 MI DOWN · WEIGHTLESS', alpha: a };
    const d = depthNow(t);
    const left = FALL.T - FALL.tAt(d);
    let sub = 'FALL TIME TO THE CENTER: 19 MIN';
    for (const l of LM) if (t >= l.t - 0.9) sub = l.sub;
    return { label: `DEPTH · CENTER IN ${fmtClock(left)}`, value: d < 0.5 ? '0 ft' : fmtDepth(d), sub, alpha: a };
  },
  labels(t) { return []; },
  audio: buildAudio(),

  async setup(ctx) {
    const { renderer } = ctx;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    ctx.grain = 0; ctx.vignette = 0.3;
    ctx.grade = { brightness: 1.0, contrast: 1.04, saturate: 1.08, sepia: 0 };
    const st = this.st = {};
    window.__st = st;
    st.scene = buildWorld(st);
    st.pool = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight('#ffffff', 0, 10, 2); st.scene.add(l); return l; });
  },

  update(ctx, t) {
    const st = this.st;
    const c = camAt(t);
    cam.fov = c.fov; cam.aspect = W / H; cam.near = 0.1; cam.far = 3000;
    cam.position.copy(c.pos); cam.lookAt(c.look); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    ctx.view = { scene: st.scene, camera: cam };
    ROCK_U.uTime.value = t;
    // the four lamps nearest the camera light the rock and the props
    const near = st.groupsUnderground.lamps.slice().sort((a, b) => a.p.distanceTo(c.pos) - b.p.distanceTo(c.pos)).slice(0, 4);
    near.forEach((L, i) => { ROCK_U.uLampP.value[i].copy(L.p); ROCK_U.uLampC.value[i].copy(L.col).multiplyScalar(1.4); ROCK_U.uLampR.value[i] = L.range; const P = st.pool[i]; P.position.copy(L.p); P.color.copy(L.col); P.distance = L.range * 1.4;
      // a lamp in the middle of the shaft would blow the jumper out white as they fall past it: cap the light on them
      const tj = t - T_JUMP, jy = tj <= 0 ? 0 : jumperY(t) + 2.2 * tj * (1 - smooth(0.6, 1.6, tj));
      const dj = Math.hypot(L.p.x, L.p.y - jy, L.p.z + (tj <= 0 ? 3.6 : 0.4)); P.intensity = Math.min(450, 3 * dj * dj); });
    // underground the sky and sun give way to the rock's own light
    const under = smooth(-2, -14, c.pos.y);
    st.hemi.intensity = lerp(1.1, 1.0, under); st.sun.intensity = lerp(2.6, 0.0, under);
    st.scene.background.set(under > 0.5 ? '#000000' : '#9fc4ea');
    st.sky.mesh.visible = under < 0.95;
    // the jumper: crouch, hop off the back edge toward the middle, then fall
    const J = st.jumper, tau = t - T_JUMP;
    if (tau <= 0) { J.x = 0; J.z = -3.6; J.y = 0; }
    else {
      const k = smooth(0, 0.45, tau);
      J.z = lerp(-3.6, -0.4, k);
      // a hop up at 2.2 m/s on top of the free fall, handed over to the landmark path once below the rim
      J.y = jumperY(t) + 2.2 * tau * (1 - smooth(0.6, 1.6, tau));
      J.x = Math.sin(t * 0.7) * 0.25;
      J.turn = () => 0.35 * Math.sin(t * 0.21);
    }
    // the train
    const T = st.train;
    T.g.position.x = T.speed * (t - T.tPass) - 3.5;             // the front reaches the shaft just after the jumper is through
    // the sewer pours: brown water arcs out of the pipe and falls down the shaft
    for (const p of st.pour) { const u = (t * 0.9 * p.v + p.ph) % 1, ff = u * 1.2; const a = st.sewer.a; p.m.position.set(Math.cos(a) * (2.0 - ff * 1.2) + p.dx, st.sewer.y - 0.5 * G0 * ff * ff * 1.4, Math.sin(a) * (2.0 - ff * 1.2) + p.dz); }
    // the ore cart rolls along its rails
    st.cart.g.position.set(30 - ((t * 1.4) % 26), st.cart.y, 0);
    // groundwater drips run down the shaft walls
    for (const d of st.drips) { const u = ((t * d.sp * 0.5 + d.ph) % 1); d.m.position.set(d.x, d.y0 - 0.5 * G0 * (u * 1.2) ** 2, d.z); }
    // diamonds glint
    for (const dd of st.diamonds) dd.m.material.opacity = 0.45 + 0.55 * Math.max(0, Math.sin(t * dd.f + dd.ph)) ** 6;
    // embers: fixed in the rock, so they rush up past the camera as fast as the walls do; only in the hot layers
    const hot = smooth(LM[6].t - 1.0, LM[6].t + 0.5, t) * (1 - smooth(T_CENTER + 3, T_CENTER + 4.5, t));
    const yc = c.pos.y;
    for (const e of st.embers) { const yy = yc - 30 + ((e.ph - yc) % 40 + 40) % 40; e.sp.visible = hot > 0.01 && !e.off; e.sp.position.set(e.x, yy, e.z); e.sp.material.opacity = hot * 0.9; e.sp.material.color.set(t > LM[9].t ? '#fff4d6' : t > LM[8].t ? '#ffd27a' : '#ff9a4a'); }
    st.centerRing.material.color.setScalar(0.6 + 0.4 * smooth(T_HERE - 0.1, T_HERE + 0.3, t));
    st.ppl.update(t);
  },
};

export const _debug = { SAY, LM, DY, depthAtY, yAtDepth, jumperY, depthNow, camAt, FALL, CAPTIONS, T_JUMP, T_CENTER, T_HERE, END, DURATION };
