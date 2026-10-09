// What if you dug a hole straight through the Earth and jumped in?
//
// Everything that moves follows one simulation: a fall through a vacuum tunnel from Spain to New Zealand
// in a realistic-density Earth (PREM-like shells), integrated below. It gives the real numbers the
// narrator says (1 km at 14 s and ~500 km/h, the Kola depth at 50 s, the crust gone at 84 s, the core at
// 12.7 min, the centre at 19.1 min and ~35,600 km/h, the far side at 38.2 min) and drives the person,
// the HUD, the tunnel walls and the dot on the cut-away Earth. Video time maps onto simulated time
// through a smooth monotone curve keyed to the narration, so the dot and the counter never jump.
// Since nothing turns the body, the jumper reaches New Zealand feet first: upside down.
import * as THREE from 'three';
import { Rng, clamp, lerp, smooth, easeInOut } from '../engine/lib/rng.js';
import { buildDaySky, radialGround } from '../engine/lib/town.js';
import { buildPeople } from '../engine/lib/people.js';
import { buildEarth } from '../engine/lib/cosmos.js';
import VO from './earth-tunnel.vo.js';

const W = 1080, H = 1920;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ the physics
const R_E = 6371e3, G_SURF = 9.82;
const FALL = (() => {
  // density shells [r0, r1 (km), rho at r0, rho at r1] (PREM, simplified), scaled to Earth's mass
  const shells = [[0, 1221, 13090, 12760], [1221, 3480, 12170, 9900], [3480, 5701, 5570, 4380], [5701, 5971, 3990, 3540], [5971, 6346, 3540, 3380], [6346, 6371, 2900, 2600]];
  const N = 4000, dr = R_E / N, g = new Float64Array(N + 1);
  let M = 0;
  const rho = (r) => { for (const [a, b, ra, rb] of shells) if (r <= b * 1e3) return ra + (rb - ra) * (r - a * 1e3) / ((b - a) * 1e3); return 2600; };
  const Ms = [0];
  for (let i = 1; i <= N; i++) { const r = (i - 0.5) * dr; M += 4 * Math.PI * r * r * rho(r) * dr; Ms.push(M); }
  for (let i = 1; i <= N; i++) g[i] = 6.674e-11 * Ms[i] * (5.972e24 / M) / ((i * dr) ** 2);
  const gAt = (r) => { const f = clamp(r / dr, 0, N); const i = Math.min(N - 1, Math.floor(f)); return lerp(g[i], g[i + 1], f - i); };
  // integrate one way, Spain (x = 0) to New Zealand (x = 2R), from rest
  const dt = 0.25, xs = [0], vs = [0];
  let x = 0, v = 0;
  while (true) {
    const a = x < R_E ? gAt(R_E - x) : -gAt(x - R_E);
    v += a * dt; x += v * dt;
    if (v <= 0) break;
    xs.push(x); vs.push(v);
  }
  const T = (xs.length - 1) * dt;
  // one way, then mirrored back, forever (period 2T)
  const at = (s) => {
    const P = 2 * T; let u = ((s % P) + P) % P, back = false;
    if (u > T) { u -= T; back = true; }
    const f = u / dt, i = Math.min(xs.length - 2, Math.floor(f)), k = f - i;
    const xx = lerp(xs[i], xs[i + 1], k), vv = lerp(vs[i], vs[i + 1], k);
    return back ? { x: 2 * R_E - xx, v: -vv } : { x: xx, v: vv };
  };
  const timeAtDepth = (d) => { for (let i = 1; i < xs.length; i++) if (xs[i] >= d) return (i - 1 + (d - xs[i - 1]) / (xs[i] - xs[i - 1])) * dt; return T; };
  return { at, T, timeAtDepth, vmax: Math.max(...vs) };
})();
const T_HALF = FALL.T;                      // ~38.2 min
const DEPTH = { kola: 12262, crust: 35e3, core: 2890e3, inner: 5150e3, center: R_E };
const S_AT = Object.fromEntries(Object.entries(DEPTH).map(([k, d]) => [k, FALL.timeAtDepth(d)]));

// layers the tunnel passes through: [distance from Spain where it starts (m), wall colour, glow colour, glow]
const LAYERS = [
  [0, '#6d5c4c', '#000000', 0], [DEPTH.crust, '#5a2a1c', '#ff4a1a', 0.55], [DEPTH.core, '#7a3a10', '#ff8a1e', 1.25],
  [DEPTH.inner, '#c9a25a', '#fff1c0', 1.6], [2 * R_E - DEPTH.inner, '#7a3a10', '#ff8a1e', 1.25], [2 * R_E - DEPTH.core, '#5a2a1c', '#ff4a1a', 0.55],
  [2 * R_E - DEPTH.crust, '#6d5c4c', '#000000', 0],
];

// ------------------------------------------------------------------ timeline (built from the narration)
const wordT = (key, word, nth = 0) => {
  let n = 0;
  for (const [w, s] of VO[key].words) if (w.toLowerCase().replace(/[^a-z0-9']/g, '').startsWith(word)) { if (n++ === nth) return s; }
  throw new Error(`word "${word}" not in line ${key}`);
};
const SHOTS = [], SAY = {}, SKEYS = [];
let JUMP, APEX, FADE, END, DURATION;
{
  let t = 0;
  const shot = (id) => SHOTS.push([t, id]);
  const say = (key, at) => { SAY[key] = at; return at + VO[key].dur; };
  const word = (key, w, nth) => SAY[key] + wordT(key, w, nth);
  const key = (tv, s) => SKEYS.push([tv, s]);
  let e;
  shot('SPAIN'); e = say('hook', t + 0.2); t = e + 0.1;
  shot('GLOBE1'); e = say('start', t + 0.1); t = e + 0.1;
  shot('JUMP'); e = say('air', t + 0.1);
  JUMP = word('air', 'jump') + 0.05;
  key(0, 0); key(JUMP, 0); key(JUMP + 1.1, 1.1);                        // the first second of the fall in real time
  t = Math.max(e + 0.1, JUMP + 1.3);
  shot('TUN1'); e = say('km1', t + 0.08); key(word('km1', 'one'), 14.3);
  e = say('kola', e + 0.12); key(word('kola', 'deepest'), S_AT.kola); t = e + 0.1;
  shot('TUN2'); e = say('crust', t + 0.08); key(word('crust', 'crust'), S_AT.crust); t = e + 0.1;
  shot('GLOBE2'); e = say('mantle', t + 0.08); key(e, 600); t = e + 0.1;
  shot('TUN3'); e = say('core', t + 0.08); key(word('core', 'liquid'), S_AT.core); t = e + 0.1;
  shot('TUN4'); e = say('inner', t + 0.08); key(SAY.inner + 0.35, S_AT.inner + 6); t = e + 0.1;
  shot('GLOBE3'); e = say('center', t + 0.08); key(word('center', 'center'), S_AT.center); t = e + 0.1;
  shot('TUN5'); e = say('weight', t + 0.08); key(e, S_AT.center + 110); t = e + 0.1;
  shot('GLOBE4'); e = say('slow', t + 0.08); key(e, T_HALF - 60); t = e + 0.1;
  // New Zealand: the last seconds in real time, slowed down round the top
  shot('NZ'); e = say('pop', t + 0.08);
  key(t + 0.02, T_HALF - 4.0);
  key(word('pop', 'ground'), T_HALF - 0.75);
  key(word('pop', 'feet'), T_HALF - 0.4);
  e = say('still', e + 0.1);
  APEX = word('still', 'hang');
  key(APEX, T_HALF); key(word('still', 'still'), T_HALF + 0.14);
  e = say('back', e + 0.1);
  key(word('back', 'fall'), T_HALF + 0.42); key(e + 0.25, T_HALF + 1.7);
  t = e + 0.35;
  shot('GLOBE5'); e = say('outro', t + 0.1);
  key(t + 0.01, T_HALF + 30);
  FADE = [e + 1.0, e + 1.6]; END = FADE[1] + 0.15;
  key(END, T_HALF + 30 + 4 * T_HALF * 1.0);                         // two round trips, sped up
  DURATION = END + 3.4;
}
const shotAt = (t) => { let s = SHOTS[0]; for (const x of SHOTS) if (t >= x[0]) s = x; return s; };
const shotStart = (id) => SHOTS.find((s) => s[1] === id)[0];
const shotEnd = (id) => { const i = SHOTS.findIndex((s) => s[1] === id); return i + 1 < SHOTS.length ? SHOTS[i + 1][0] : END; };
const shotU = (t, id) => clamp((t - shotStart(id)) / (shotEnd(id) - shotStart(id)));

// video time -> simulated time: monotone cubic through the keys (no overshoot, no jumps)
const simOf = (() => {
  const k = SKEYS.slice().sort((a, b) => a[0] - b[0]);
  const xs = k.map((p) => p[0]), ys = k.map((p) => p[1]), n = xs.length;
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(xs[i + 1] - xs[i], 1e-6));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (d[i - 1] + d[i])) / (2 * d[i] / d[i - 1] + 2 + d[i - 1] / d[i] + (d[i] / d[i - 1]) * 0 + 1 - 1) ;
  // Fritsch-Carlson limiter
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const tt = 3 / Math.sqrt(s); m[i] = tt * a * d[i]; m[i + 1] = tt * b * d[i]; }
  }
  return (t) => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1] + d[n - 2] * (t - xs[n - 1]);
    let i = 0; while (t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = (t - xs[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
  };
})();
const fallAt = (t) => FALL.at(Math.max(0, simOf(t)));

// how fast the tunnel walls stream past (scene units/s): grows with the real speed, but compressed so
// 35,000 km/h still reads as motion, not strobing. The wall offset is its running integral.
const VIS = (() => {
  const dt = 1 / 120, n = Math.ceil(80 / dt), off = new Float64Array(n + 1);
  const vis = (t) => { const v = Math.abs(fallAt(t).v); return 2.5 + 46 * Math.pow(v / FALL.vmax, 0.55); };
  for (let i = 1; i <= n; i++) off[i] = off[i - 1] + vis((i - 0.5) * dt) * dt;
  return { speed: vis, offset: (t) => { const f = clamp(t / dt, 0, n), i = Math.min(n - 1, Math.floor(f)); return lerp(off[i], off[i + 1], f - i); }, timeOf: (s) => { let lo = 0, hi = 80; for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (simOf(mid) < s) lo = mid; else hi = mid; } return (lo + hi) / 2; } };
})();

// ------------------------------------------------------------------ captions, HUD
function buildCaptions() {
  const out = [];
  for (const [key, at] of Object.entries(SAY)) {
    if (key === 'hook') continue;                               // the title already says it
    const ws = [];
    for (const [w, s, e] of VO[key].words) {
      if (ws.length && /^[-']/.test(w)) { const p = ws[ws.length - 1]; p[0] += w; p[2] = e; } else ws.push([w, s, e]);
    }
    const LITTLE = /^(a|an|the|as|of|on|in|to|than|and|it's|its|our|at|by|be|your|you'll|is|you|you've|you're|through|into|out|up)$/i;
    let chunk = [];
    const flush = (end) => { if (!chunk.length) return; out.push([at + chunk[0][1], at + end, chunk.map((c) => c[0]).join(' ')]); chunk = []; };
    ws.forEach(([w, s, e], i) => {
      chunk.push([w, s, e]);
      const next = ws[i + 1];
      const full = chunk.length >= 4 && !LITTLE.test(w.replace(/[^A-Za-z']/g, ''));
      if (!next || full || chunk.length >= 6 || /[,.?!…:]$/.test(w)) flush(next ? Math.min(next[1], e + 0.6) : e + 0.35);
    });
  }
  out.sort((x, y) => x[0] - y[0]);
  for (let i = 0; i < out.length - 1; i++) out[i][1] = Math.min(out[i][1], out[i + 1][0] - 0.01);
  return out;
}
const fmtKm = (m) => m < 1000 ? `${Math.round(m)} m` : m < 100e3 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 1000).toLocaleString('en-US')} km`;
const fmtClock = (s) => { const mm = Math.floor(s / 60), ss = Math.floor(s % 60); return `${mm}:${String(ss).padStart(2, '0')}`; };

// ------------------------------------------------------------------ textures
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function ctex(cv, repeat) {
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function grassTexture(base, seed) {
  const r = new Rng(seed), S = 256, cv = canvas(S, S), c = cv.getContext('2d');
  c.fillStyle = base; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const l = r.float(-14, 14);
    c.fillStyle = `hsla(${r.float(70, 105)}, ${r.float(28, 48)}%, ${50 + l}%, ${r.float(0.08, 0.22)})`;
    const x = r.float(0, S), y = r.float(0, S), w = r.float(1, 3.5), h = r.float(2, 7);
    c.fillRect(x, y, w, h); c.fillRect(x - S, y, w, h); c.fillRect(x, y - S, w, h);
  }
  return ctex(cv, true);
}
// the Earth cut in half: inner core, outer core, mantle, crust (radii in km)
function crossSectionTexture() {
  const S = 2048, cv = canvas(S, S), c = cv.getContext('2d'), C = S / 2, k = (S / 2) / 6371;
  const ring = (r0, r1, cols) => { const g = c.createRadialGradient(C, C, r0 * k, C, C, r1 * k); cols.forEach(([p, col]) => g.addColorStop(p, col)); c.fillStyle = g; c.beginPath(); c.arc(C, C, r1 * k, 0, Math.PI * 2); c.arc(C, C, r0 * k, 0, Math.PI * 2, true); c.fill(); };
  ring(5100, 6371, [[0, '#c4401c'], [0.6, '#8f2a17'], [0.97, '#6b2414'], [1, '#6b2414']]);
  ring(3480, 5100, [[0, '#e8601e'], [1, '#c4401c']]);
  ring(1221, 3480, [[0, '#ffc44a'], [1, '#ff8a1e']]);
  ring(0, 1221, [[0, '#fffbe8'], [1, '#ffe7a0']]);
  c.strokeStyle = '#4a3a2e'; c.lineWidth = 5; c.beginPath(); c.arc(C, C, 6371 * k - 2.5, 0, Math.PI * 2); c.stroke();      // crust
  c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 2;
  for (const r of [1221, 3480]) { c.beginPath(); c.arc(C, C, r * k, 0, Math.PI * 2); c.stroke(); }
  return ctex(cv);
}

// ------------------------------------------------------------------ sets
function stars(n, radius, seed) {
  const r = new Rng(seed), p = [];
  for (let i = 0; i < n; i++) { const v = V(r.gauss(), r.gauss(), r.gauss()).normalize().multiplyScalar(radius); p.push(v.x, v.y, v.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, color: '#c9d6ff', transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false }));
  pts.frustumCulled = false;
  return pts;
}

// a field with a hole in it (radius 0.75 m), a shaft that goes dark with depth, a person, and scenery
function buildField(o) {
  const scene = new THREE.Scene();
  const SUN = o.sun.clone().normalize();
  const sky = buildDaySky({ sun: SUN, zenith: o.zenith, horizon: o.horizon });
  scene.add(sky.mesh);
  scene.add(new THREE.HemisphereLight(o.hemiSky ?? '#d6e6ff', o.hemiGround ?? '#7a7058', 1.15));
  const sun = new THREE.DirectionalLight('#fff3e0', 2.7);
  sun.position.copy(SUN).multiplyScalar(30); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 80 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const HOLE = 0.75;
  const gtex = grassTexture(o.grass, o.seed); gtex.repeat.set(220, 220);
  const gg = radialGround(HOLE, 3000, 70, 128);
  gg.setIndex(Array.from(gg.index.array).slice(128 * 3));            // drop the centre fan: leave the hole open
  const ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.95 }));
  ground.receiveShadow = true; scene.add(ground);
  // rim of packed earth and a few stones
  const rim = new THREE.Mesh(new THREE.TorusGeometry(HOLE + 0.02, 0.07, 10, 64).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6b5440', roughness: 1 }));
  rim.position.y = 0.01; rim.castShadow = true; rim.receiveShadow = true; scene.add(rim);
  // the shaft: lit from the top, black a few metres down
  const shaftMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uCol: { value: new THREE.Color('#7a6048') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uCol; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){ float a = atan(vP.x, vP.z); float d = -vP.y;
        float tex = 0.75 + 0.25 * n(vec2(a * 6.0, d * 5.0)) + 0.1 * n(vec2(a * 20.0, d * 18.0));
        vec3 c = uCol * tex * exp(-d / 0.55) * 0.9;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(HOLE, HOLE, 80, 64, 1, true).translate(0, -40, 0), shaftMat);
  scene.add(shaft);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(HOLE, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000000' }));
  bottom.position.y = -79; scene.add(bottom);
  o.decor?.(scene);
  const ppl = buildPeople({ max: 8, seed: o.seed });
  scene.add(ppl.group);
  return { scene, ppl, sun };
}

function olive(scene, x, z, s, r) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.14 * s, 1.2 * s, 6), new THREE.MeshStandardMaterial({ color: '#6b5844', roughness: 1 }));
  trunk.position.set(x, 0.6 * s, z); trunk.castShadow = true; scene.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * s, 0), new THREE.MeshStandardMaterial({ color: r.pick(['#7d8f4e', '#6f8446', '#8a9a5a']), roughness: 0.9, flatShading: true }));
  crown.position.set(x, 1.55 * s, z); crown.scale.set(1.2, 0.8, 1.1); crown.castShadow = true; scene.add(crown);
}
function house(scene, x, z, w, d, h, rot) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: '#f1ebe0', roughness: 0.9 }));
  wall.position.y = h / 2; wall.castShadow = true; wall.receiveShadow = true;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.001, w * 0.62, h * 0.35, 4, 1).rotateY(Math.PI / 4), new THREE.MeshStandardMaterial({ color: '#b85a32', roughness: 0.8, flatShading: true }));
  roof.scale.set(1, 1, d / w); roof.position.y = h + h * 0.175; roof.castShadow = true;
  g.add(wall, roof); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
}
function hill(scene, x, z, rx, h, col) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, roughness: 1, flatShading: true }));
  m.scale.set(rx, h, rx * 0.8); m.position.set(x, -0.5, z); m.receiveShadow = true; scene.add(m);
}
function sheep(scene, x, z, rot) {
  const g = new THREE.Group();
  const wool = new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 1 }), dark = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.42), wool); body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.2), dark); head.position.set(0.45, 0.7, 0);
  g.add(body, head);
  for (const [lx, lz] of [[-0.25, -0.13], [-0.25, 0.13], [0.25, -0.13], [0.25, 0.13]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.08), dark); l.position.set(lx, 0.17, lz); g.add(l); }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
}

// the tunnel seen from inside, falling with the jumper: walls stream past, layer boundaries arrive as rings
function buildTunnel() {
  const scene = new THREE.Scene();
  const RAD = 2.2;
  const U = {
    uScroll: { value: 0 }, uSpeed: { value: 0 }, uTime: { value: 0 }, uCam: { value: V() },
    uRings: { value: new Array(6).fill(-1e5) }, uCols: { value: LAYERS.map((l) => new THREE.Color(l[1])) },
    uGlowC: { value: LAYERS.map((l) => new THREE.Color(l[2])) }, uGlow: { value: LAYERS.map((l) => l[3]) },
    uLayer0: { value: 0 }, uMark: { value: -1e5 },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: U,
    vertexShader: 'varying vec3 vP; varying vec3 vW; void main(){ vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform float uScroll, uSpeed, uTime, uRings[6], uGlow[7], uMark; uniform vec3 uCols[7], uGlowC[7], uCam; uniform int uLayer0;
      varying vec3 vP; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){
        float a = atan(vP.x, vP.z) * 2.2;            // around the wall, in scene units
        float y = vP.y;
        // which layer this part of the wall belongs to: one more for every boundary ring above it
        int k = uLayer0;
        for (int i = 0; i < 6; i++) if (y < uRings[i]) k++;
        k = min(k, 6);
        vec3 col = uCols[0], gc = uGlowC[0]; float gl = uGlow[0];
        for (int i = 0; i < 7; i++) if (i == k) { col = uCols[i]; gc = uGlowC[i]; gl = uGlow[i]; }
        // rock, stretched along the fall the faster we go (it reads as speed and never strobes)
        float st = 1.0 + uSpeed * 9.0;
        float v = (y - uScroll) / st;
        float dist = length(vW - uCam);
        float fine = 1.0 - smoothstep(6.0, 22.0, dist);  // fine detail fades with distance (no shimmer)
        float r = 0.55 * n(vec2(a * 1.3, v * 1.3)) + 0.3 * n(vec2(a * 3.1, v * 3.1)) + 0.15 * fine * n(vec2(a * 7.0, v * 7.0));
        float flow = 0.0;
        if (gl > 1.0) flow = n(vec2(a * 1.6 + uTime * 0.4, v * 0.9 - uTime * 0.6)) * 0.5;   // molten
        vec3 c = col * (0.45 + 0.75 * r);
        float lamp = 1.6 * exp(-dist / 7.0) + 0.06;    // the jumper's light, falling off down the tunnel
        c *= lamp;
        c += gc * gl * (0.35 + 0.65 * r + flow) * (0.55 + 0.45 * exp(-dist / 18.0));
        // the ring where one layer meets the next glows a little
        for (int i = 0; i < 6; i++) c += gc * 0.0 + vec3(1.0, 0.85, 0.6) * exp(-abs(y - uRings[i]) * 6.0) * 0.25 * step(-9e4, uRings[i]);
        // the Kola marker: a band of hazard paint
        float m = abs(y - uMark);
        if (m < 0.18) { float s = step(0.5, fract((a + y) * 1.2)); c = mix(c, mix(vec3(0.05), vec3(1.0, 0.78, 0.1), s) * (lamp + 0.4), smoothstep(0.18, 0.12, m)); }
        // haze down the tunnel
        float fog = 1.0 - exp(-dist / 34.0);
        c = mix(c, gc * gl * 0.5 + vec3(0.004), fog);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, 400, 96, 160, true).translate(0, -180, 0), mat);
  tube.frustumCulled = false;
  scene.add(tube);
  const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 0.6);
  const lamp = new THREE.PointLight('#fff1dc', 6, 12, 1.6);
  const glow = new THREE.PointLight('#ff7a2a', 0, 30, 1.2);
  scene.add(hemi, lamp, glow);
  const ppl = buildPeople({ max: 2, seed: 4, castShadow: false });
  scene.add(ppl.group);
  return { scene, U, ppl, hemi, lamp, glow, RAD };
}

// the Earth cut in half, face on: layers, the tunnel, the jumper as a point of light with a trail
function buildGlobe() {
  const scene = new THREE.Scene();
  scene.add(stars(2500, 900, 3));
  const SUN = V(-0.6, 0.5, -0.6).normalize();
  scene.add(new THREE.AmbientLight('#8fa4c8', 0.6));
  const sun = new THREE.DirectionalLight('#fff4e4', 2.6); sun.position.copy(SUN).multiplyScalar(100); scene.add(sun);
  const R = 6.371;
  const E = buildEarth(R, 0.12, SUN);
  const clip = [new THREE.Plane(V(0, 0, -1), 0)];          // keep the half away from the camera
  for (const m of [E.earth, E.clouds]) { m.material.clippingPlanes = clip; m.material.clipShadows = true; m.material.side = THREE.DoubleSide; }
  E.atm.visible = true;
  scene.add(E.group);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(R * 0.999, 256), new THREE.MeshBasicMaterial({ map: crossSectionTexture(), toneMapped: false }));
  scene.add(cap);
  // Spain up-left, New Zealand down-right: on opposite sides, the tunnel straight through the centre
  const ang = THREE.MathUtils.degToRad(122);
  const SP = V(Math.cos(ang), Math.sin(ang), 0).multiplyScalar(R), NZ = SP.clone().negate();
  const tun = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0), new THREE.MeshBasicMaterial({ color: '#16110e', toneMapped: false }));
  tun.position.copy(SP).setZ(0.01); tun.rotation.z = ang + Math.PI; scene.add(tun);
  const dotTex = (() => { const cv = canvas(128, 128), c = cv.getContext('2d'); const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(190,230,255,0.9)'); g.addColorStop(1, 'rgba(120,190,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); return ctex(cv); })();
  const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  dot.renderOrder = 10; scene.add(dot);
  const trail = [];
  for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(dot.material.clone()); s.renderOrder = 9; scene.add(s); trail.push(s); }
  const pins = [SP, NZ].map((p) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: '#ffd28a', transparent: true, depthWrite: false, depthTest: false, toneMapped: false })); s.position.copy(p).setZ(0.02); s.renderOrder = 8; scene.add(s); return s; });
  return { scene, E, cap, tun, dot, trail, pins, SP, NZ, R, ang };
}

// ------------------------------------------------------------------ cameras
const cam = new THREE.PerspectiveCamera(40, W / H, 0.05, 5000);
function setCam(c) {
  cam.fov = c.fov ?? 40; cam.near = c.near ?? 0.05; cam.far = c.far ?? 5000; cam.aspect = W / H;
  cam.position.copy(c.pos); cam.up.set(0, 1, 0); cam.lookAt(c.look);
  if (c.roll) cam.rotateZ(c.roll);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
}
// slow, smooth drift so held shots breathe (no per-frame noise)
const drift = (t, a) => V(Math.sin(t * 0.37) * a, Math.sin(t * 0.29 + 1) * a * 0.6, Math.cos(t * 0.31) * a * 0.5);

// the globe camera per shot: how far out, and where it looks
function globeCam(t, shot) {
  const u = shotU(t, shot), e = easeInOut(u);
  const dz = { GLOBE1: lerp(40, 34, e), GLOBE2: lerp(30, 26, e), GLOBE3: lerp(22, 13, e), GLOBE4: lerp(28, 33, e), GLOBE5: lerp(34, 40, e) }[shot];
  const lookOff = shot === 'GLOBE3' ? lerp(0, 0, e) : 0;
  const pos = V(lerp(-1.5, 1.5, e) * (shot === 'GLOBE1' ? 1 : 0.5), lerp(0.8, -0.3, e), dz).add(drift(t, 0.15));
  return { pos, look: V(lookOff, 0, 0), fov: 40, near: 0.5, far: 3000 };
}

// ------------------------------------------------------------------ sound
const S_ = (file, t, o = {}) => Object.assign({ type: 'sample', file, t }, o);
function buildAudio() {
  const A = [];
  const fx = (type, o) => A.push(Object.assign({ type, fx: true }, o));
  for (const [key, at] of Object.entries(SAY)) A.push(S_(VO[key].file, at, { level: 1.35, free: true, verb: 0.035, fin: 0.005, fout: 0.03 }));
  const talking = (t) => { let k = 0; for (const [key, at] of Object.entries(SAY)) k = Math.max(k, smooth(at - 0.18, at, t) * (1 - smooth(at + VO[key].dur, at + VO[key].dur + 0.3, t))); return k; };
  const keysEvery = (f, step = 0.05) => { const ks = []; for (let t = 0; t <= DURATION; t += step) ks.push([+t.toFixed(2), +f(t).toFixed(3)]); return ks; };
  const env = (base) => keysEvery((t) => base(t) * (1 - 0.75 * talking(t)));
  A.push({ type: 'fxduck', keys: keysEvery((t) => 1 - 0.5 * talking(t), 0.04) });
  // "Epical Drums 01": its big lift (31.5 s into the track) lands as we pass the centre
  const tc = SAY.center + wordT('center', 'center'), lift = 31.5;
  A.push(S_('music/676.mp3', Math.max(0, tc - lift), { offset: Math.max(0, lift - tc), level: 0.34, fin: 0.3, fout: 1.6, dur: DURATION - Math.max(0, tc - lift),
    keys: env((t) => t < JUMP ? 0.55 : t < tc ? 0.8 : t < shotStart('NZ') ? 0.95 : 0.85) }));
  // places
  A.push(S_('sfx/367.wav', 0, { offset: 12, dur: shotStart('TUN1') + 0.05, level: 0.4, fout: 0.2, keys: env(() => 1) }));
  A.push(S_('sfx/367.wav', shotStart('NZ'), { offset: 40, dur: shotEnd('NZ') - shotStart('NZ') + 0.05, level: 0.4, fin: 0.05, fout: 0.15, keys: env(() => 1) }));
  // inside the tunnel: a rush that follows how fast the walls stream past
  const tunnel = (t) => ['TUN1', 'TUN2', 'TUN3', 'TUN4', 'TUN5'].includes(shotAt(t)[1]);
  fx('rush', { t0: shotStart('TUN1'), t1: shotEnd('TUN5'), level: 0.2, seed: 1,
    speed: keysEvery((t) => tunnel(t) ? clamp((VIS.speed(t) - 2) / 46) : 0, 0.05) });
  // every cut: a swell that peaks on it
  SHOTS.forEach(([t, id], i) => {
    if (!i) return;
    const up = i % 2 === 0;
    fx('sweep', { t, pre: 0.45, post: 0.2, f: up ? [350, 6200] : [6200, 350], hit: 0.5, level: 0.5, pan: up ? [-0.6, 0.6] : [0.6, -0.6], seed: 100 + i });
  });
  // the jump: a scuff, then the air whistling up out of the shaft as they drop away
  fx('snap', { t: JUMP, size: 0.3, level: 0.7, seed: 5 });
  fx('sweep', { t: JUMP + 0.9, pre: 0.8, post: 0.5, f: [3200, 260], q: 2.0, level: 0.55, pan: [0, 0], seed: 6 });
  // crossing into each layer: a deep boom that grows as the layers get hotter
  const crossings = [['crust', 0.5], ['core', 0.75], ['inner', 0.9]];
  for (const [k, lv] of crossings) fx('flip', { t: VIS.timeOf(S_AT[k]) - 0.3, d: 0.3, size: 0.6 + 0.3 * lv, accent: 1, level: 0.3 * lv, seed: 20 + lv * 10 });
  fx('sweep', { t: VIS.timeOf(S_AT.kola), pre: 0.35, post: 0.3, f: [900, 4800], q: 2.2, level: 0.4, pan: [0.5, -0.5], seed: 30 });
  // the dot on the cut-away Earth: a tone that rises with its speed
  for (const id of ['GLOBE2', 'GLOBE3', 'GLOBE4']) {
    const t0 = shotStart(id), t1 = shotEnd(id);
    fx('glide', { t0, t1, level: 0.1, seed: 40, keys2: keysEvery((t) => (t >= t0 && t <= t1) ? Math.abs(fallAt(t).v) / FALL.vmax : 0, 0.05).filter((k) => k[0] >= t0 - 0.1 && k[0] <= t1 + 0.1) });
  }
  // through the centre
  fx('sweep', { t: tc, pre: 0.9, post: 0.9, f: [220, 9000], q: 1.2, curve: 2.6, tone: 0.5, hit: 1.0, level: 0.55, pan: [-0.5, 0.5], seed: 50 });
  // New Zealand: rising out of the shaft, the hang, the drop
  fx('sweep', { t: VIS.timeOf(T_HALF - 0.75), pre: 1.2, post: 0.25, f: [260, 3600], q: 2.0, level: 0.5, pan: [0, 0], seed: 60 });
  fx('sparkle', { t: APEX - 0.1, dur: 0.6, count: 7, f: [1200, 3200], level: 0.22, seed: 61 });
  fx('sweep', { t: VIS.timeOf(T_HALF + 1.2), pre: 0.4, post: 0.6, f: [3200, 240], q: 2.0, level: 0.55, pan: [0, 0], seed: 62 });
  A.push({ type: 'chime', t: END, level: 0.17, free: true });
  return A;
}

// ------------------------------------------------------------------ the scenario
export default {
  id: 'earth-tunnel',
  title: 'What if you jumped into a hole through the Earth?',
  endFact: 'The deepest hole ever dug, Kola in Russia, reaches <b>12.3 km</b>: about 0.1% of the way.',
  duration: DURATION,
  titleIn: [-1, -0.5], titleOut: [SAY.hook + VO.hook.dur + 0.05, SAY.hook + VO.hook.dur + 0.4],
  fadeOut: FADE, endAt: END, endSpeed: 1.45,
  captions: buildCaptions(),
  captionFade: 0.06,
  hud(t) {
    if (t < JUMP || t >= FADE[1]) return null;
    const s = simOf(t), f = fallAt(t);
    const depth = Math.min(f.x, 2 * R_E - f.x), toNZ = f.v > 0 && f.x > R_E;
    return {
      label: `FALLING FOR ${fmtClock(s)}`,
      value: fmtKm(depth) + (f.x > R_E + 1000 && depth > 1 ? ' to go' : ' deep').replace(' to go', toNZ ? ' TO GO' : ' DEEP').replace(' deep', ' DEEP'),
      sub: `${Math.round(Math.abs(f.v) * 3.6).toLocaleString('en-US')} KM/H`,
      alpha: smooth(JUMP, JUMP + 0.3, t) * (1 - smooth(FADE[0], FADE[1], t)),
    };
  },
  labels(t) {
    const st = this.st; if (!st) return [];
    const shot = shotAt(t)[1], out = [];
    const put = (p, text, a, extra = {}) => { const v = p.clone().project(cam); if (v.z < 1 && v.z > -1 && a > 0.001) out.push(Object.assign({ x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, text, alpha: a }, extra)); };
    setCam(this.camFor(t));
    const u = shotU(t, shot), G = st.globe;
    if (shot === 'GLOBE1') { put(G.SP.clone().setZ(0.02), 'SPAIN', smooth(0.05, 0.2, u), { side: 'left' }); put(G.NZ.clone().setZ(0.02), 'NEW ZEALAND', smooth(0.45, 0.6, u), { side: 'left' }); }
    if (shot === 'GLOBE2') {
      const at = (r, a) => V(Math.cos(a) * r, Math.sin(a) * r, 0.02);
      put(at(6.25, 3.55), 'CRUST', smooth(0.05, 0.2, u));
      put(at(4.6, 3.75), 'MANTLE', smooth(0.15, 0.3, u));
      put(at(2.4, 4.0), 'OUTER CORE · LIQUID IRON', smooth(0.3, 0.45, u));
      put(at(0.75, 4.3), 'INNER CORE', smooth(0.45, 0.6, u));
    }
    if (shot === 'GLOBE3') put(V(0, 0, 0.02), 'THE CENTRE', smooth(0.15, 0.3, u) * (1 - smooth(0.85, 1, u)), { side: 'left' });
    if (shot === 'GLOBE4' || shot === 'GLOBE5') put(G.NZ.clone().setZ(0.02), 'NEW ZEALAND', smooth(0.05, 0.2, u), { side: 'left' });
    if (shot === 'SPAIN') put(V(0, 0.05, -0.8), 'SPAIN', smooth(0.45, 0.55, u), { side: 'left' });
    if (shot.startsWith('TUN')) {
      const T = st.tun;
      if (T.U.uMark.value > -50) put(V(0, T.U.uMark.value, -T.RAD + 0.05), 'KOLA BOREHOLE · 12 KM · DEEPEST HOLE EVER DUG', smooth(-14, -6, T.U.uMark.value) * (1 - smooth(4, 10, T.U.uMark.value)), { side: 'left' });
      const ring = this.ringInfo(t);
      if (ring) put(V(0, ring.y, -T.RAD + 0.05), ring.label, smooth(-14, -6, ring.y) * (1 - smooth(5, 11, ring.y)), { side: 'left' });
    }
    return out;
  },
  audio: buildAudio(),

  async setup(ctx) {
    const { renderer } = ctx;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    ctx.grain = 0; ctx.vignette = 0.35;
    ctx.grade = { brightness: 1, contrast: 1.03, saturate: 1.06, sepia: 0 };
    const st = this.st = {};
    window.__st = st;
    const r = new Rng(11);
    st.spain = buildField({
      seed: 3, grass: '#a59a5a', sun: V(-0.55, 0.62, 0.55), zenith: '#3a78d0', horizon: '#cfe0ef', hemiGround: '#8a7a50',
      decor: (sc) => {
        for (let i = 0; i < 26; i++) { const a = r.float(0, Math.PI * 2), d = r.float(9, 60); olive(sc, Math.cos(a) * d, Math.sin(a) * d, r.float(0.8, 1.3), r); }
        for (let i = 0; i < 9; i++) { const a = r.float(-2.6, -0.6), d = r.float(70, 140); house(sc, Math.cos(a) * d, Math.sin(a) * d, r.float(6, 10), r.float(5, 8), r.float(4, 7), r.float(0, 3)); }
        hill(sc, -150, -420, 260, 60, '#a8955e'); hill(sc, 220, -520, 300, 85, '#9f8d58');
      },
    });
    st.nz = buildField({
      seed: 8, grass: '#5d8f3a', sun: V(0.5, 0.6, 0.6), zenith: '#3f86d8', horizon: '#d2e6f4', hemiGround: '#5a7040',
      decor: (sc) => {
        hill(sc, -120, -260, 180, 70, '#5f9440'); hill(sc, 140, -330, 230, 95, '#6aa047'); hill(sc, 30, -560, 340, 150, '#4f8538');
        for (let i = 0; i < 14; i++) { const a = r.float(-2.9, -0.2), d = r.float(7, 40); sheep(sc, Math.cos(a) * d, Math.sin(a) * d, r.float(0, 6.3)); }
      },
    });
    st.tun = buildTunnel();
    st.globe = buildGlobe();
    // people: one in each field, one in the tunnel
    st.ppl0 = st.spain.ppl; st.ppl1 = st.nz.ppl;
    const look = { shirt: '#e8562a', pants: '#2c3e50', skin: '#d9a07a', hairC: '#3b2a20', hair: 'short', longSleeve: false, scale: 1 };
    for (const P of [st.spain.ppl, st.nz.ppl, st.tun.ppl]) {
      P.POSES.float = (ph, t, s) => ({ armL: 1.9 + 0.15 * Math.sin(t * 1.3), armR: 1.9 + 0.15 * Math.sin(t * 1.1 + 1), armLr: 0.9, armRr: -0.9, legL: 0.25, legR: -0.15, legLr: 0.18, legRr: -0.18, head: 0.15 });
      P.POSES.plunge = (ph, t, s) => ({ armL: 2.9 + 0.12 * Math.sin(t * 5 + s), armR: 2.9 + 0.12 * Math.sin(t * 5.5 + s + 2), armLr: 0.2, armRr: -0.2, head: 0.25, legL: 0.12, legR: -0.08 });
    }
    // Spain: stands at the rim facing the hole, crouches, jumps
    st.p0 = st.spain.ppl.add(Object.assign({ x: 1.12, z: 0, h: -Math.PI / 2, poses: [[0, 'idle'], [JUMP - 0.55, 'crouch', 0.3], [JUMP, 'plunge', 0.2]] }, look));
    st.p1 = st.nz.ppl.add(Object.assign({ x: 0, z: 0, h: 0.4, poses: [[0, 'plunge'], [APEX - 0.6, 'float', 0.5], [APEX + 0.5, 'plunge', 0.4]] }, look));
    st.p2 = st.tun.ppl.add(Object.assign({ x: 0, z: 0, h: 0.3, poses: [[0, 'plunge'], [shotStart('TUN3'), 'float', 1.2]] }, look));
    for (const P of [st.p0, st.p1, st.p2]) if (!P) throw new Error('people.add did not return the person');
  },

  camFor(t) {
    const [s0, shot] = shotAt(t), u = shotU(t, shot), e = easeInOut(u);
    if (shot === 'SPAIN') return { pos: V(lerp(-3.6, -3.0, e), lerp(1.7, 1.5, e), lerp(5.4, 4.6, e)).add(drift(t, 0.03)), look: V(0.35, 0.55, 0), fov: 40 };
    if (shot === 'JUMP') return { pos: V(lerp(-1.9, -1.7, e), lerp(4.3, 4.6, e), 2.1).add(drift(t, 0.02)), look: V(0.35, -1.4, 0), fov: 46 };
    if (shot === 'NZ') return { pos: V(lerp(3.4, 3.0, e), lerp(1.0, 1.15, e), lerp(5.6, 5.0, e)).add(drift(t, 0.03)), look: V(0, 1.1, 0), fov: 40 };
    if (shot.startsWith('TUN')) {
      // just above and beside the jumper, looking down the tunnel past them; a slow orbit when weightless
      const yaw = shot === 'TUN5' ? lerp(0.2, 2.2, e) : { TUN1: 0.2, TUN2: 0.7, TUN3: 1.4, TUN4: 2.0 }[shot] + 0.25 * e;
      const rr = shot === 'TUN5' ? 1.5 : 1.25;
      const pos = V(Math.sin(yaw) * rr, 2.6 + (shot === 'TUN5' ? -1.2 * e : 0), Math.cos(yaw) * rr).add(drift(t, 0.04));
      return { pos, look: V(0, shot === 'TUN5' ? -1.6 : -6, 0), fov: 62 };
    }
    return globeCam(t, shot);
  },

  // the next boundary ring in the tunnel: where it is on screen (scene y) and what it is
  ringInfo(t) {
    const s = simOf(t), list = [['crust', 'END OF THE CRUST · 35 KM'], ['core', 'OUTER CORE · 2,890 KM'], ['inner', 'INNER CORE · 5,150 KM']];
    for (const [k, label] of list) {
      const tb = VIS.timeOf(S_AT[k]);
      const y = -1.6 + (VIS.offset(t) - VIS.offset(tb));
      if (y > -40 && y < 14) return { y, label };
    }
    return null;
  },

  update(ctx, t) {
    const st = this.st, [s0, shot] = shotAt(t), f = fallAt(t);
    const c = this.camFor(t);
    setCam(c);
    ctx.view = { scene: null, camera: cam };
    if (shot === 'SPAIN' || shot === 'JUMP') {
      ctx.view.scene = st.spain.scene;
      const p = st.p0, tau = t - JUMP;
      if (tau <= 0) { p.x = 1.12; p.y = 0; }
      else {
        // hop off the rim (2.6 m/s up), drift over the middle, then fall straight down the shaft
        p.x = 1.12 * (1 - smooth(0, 0.5, tau));
        p.y = 2.6 * tau - 0.5 * G_SURF * tau * tau;
      }
      st.spain.ppl.update(t);
    } else if (shot === 'NZ') {
      ctx.view.scene = st.nz.scene;
      // the centre of mass reaches the height it was jumped from; feet first, upside down
      const s = simOf(t), tau = s - T_HALF;                          // seconds from the top
      const comTop = 1.0 + 0.34;
      const com = comTop - 0.5 * G_SURF * tau * tau;
      const p = st.p1;
      p.tilt = () => Math.PI; p.x = 0; p.z = 0;
      p.y = com + 1.0;                                             // feet are 1 m above the centre of mass when upside down
      st.nz.ppl.update(t);
    } else if (shot.startsWith('TUN')) {
      const T = st.tun; ctx.view.scene = T.scene;
      T.U.uScroll.value = VIS.offset(t);
      T.U.uSpeed.value = clamp((VIS.speed(t) - 2.5) / 46);
      T.U.uTime.value = t;
      T.U.uCam.value.copy(cam.position);
      // boundary rings: each moves up with the walls and reaches the jumper (y = -1.6) as the depth is crossed
      const yP = -1.6, off = VIS.offset(t);
      const bounds = [DEPTH.crust, DEPTH.core, DEPTH.inner, 2 * R_E - DEPTH.inner];
      let layer0 = 0; const rings = [];
      for (const d of bounds) {
        const tb = VIS.timeOf(FALL.timeAtDepth(Math.min(d, R_E)) + (d > R_E ? 2 * (S_AT.center - FALL.timeAtDepth(2 * R_E - d)) : 0));
        const y = yP + (off - VIS.offset(tb));
        if (y > 60) layer0++; else rings.push(y);
      }
      while (rings.length < 6) rings.push(-1e5);
      T.U.uLayer0.value = layer0; T.U.uRings.value = rings;
      const tk = VIS.timeOf(S_AT.kola);
      T.U.uMark.value = yP + (off - VIS.offset(tk));
      // light: the jumper's lamp, plus the glow of whatever layer we are in
      const L = LAYERS[Math.min(6, layer0 + rings.filter((y) => y > yP && y > -9e4).length)];
      T.glow.color.set(L[2]); T.glow.intensity = L[3] * 40; T.glow.position.set(0, -6, 0);
      T.hemi.color.set(L[3] > 0 ? L[2] : '#ffffff'); T.hemi.intensity = 0.25 + L[3] * 0.6;
      // far down the tunnel the haze is the colour of the layer ahead (no black hole at the end)
      T.scene.background = new THREE.Color(L[2]).multiplyScalar(L[3] * 0.5).addScalar(0.004);
      T.lamp.position.copy(cam.position);
      // the jumper, weightless, centred in the tunnel; turning slowly when we orbit them
      const p = st.p2;
      p.x = 0; p.z = 0; p.y = yP - 0.9;
      st.tun.ppl.update(t);
    } else {
      const G = st.globe; ctx.view.scene = G.scene;
      const dir = G.NZ.clone().sub(G.SP);
      const along = (x) => G.SP.clone().addScaledVector(dir, x / (2 * R_E)).setZ(0.03);
      // the tunnel draws itself from Spain to New Zealand in the first globe shot
      const drawn = shot === 'GLOBE1' ? smooth(0.15, 0.75, shotU(t, 'GLOBE1')) : 1;
      G.tun.scale.set(2 * G.R * drawn, 0.045, 0.01);
      G.tun.visible = drawn > 0.001;
      const show = t >= JUMP;
      G.dot.visible = show;
      const px = 26 * 2 * cam.position.length() * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / H;
      if (show) { G.dot.position.copy(along(f.x)); G.dot.scale.setScalar(px * 2.2); }
      // a trail of where it was over the last moments of video
      G.trail.forEach((s, i) => {
        const tt = t - (i + 1) * 0.045;
        s.visible = show && tt > JUMP;
        if (!s.visible) return;
        s.position.copy(along(fallAt(tt).x));
        s.scale.setScalar(px * 1.6 * (1 - i / G.trail.length));
        s.material.opacity = 0.55 * (1 - i / G.trail.length);
      });
      G.pins.forEach((s) => s.scale.setScalar(px * 1.1));
      G.E.group.rotation.y = 0;
    }
  },
};

// for offline checks (timeline, physics, motion); not used by the renderer
export const _debug = { SHOTS, SAY, SKEYS, JUMP, APEX, END, DURATION, FALL, S_AT, simOf, fallAt, VIS, shotAt };
