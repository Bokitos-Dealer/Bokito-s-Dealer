// What if you built a ladder all the way to space, and climbed it?
//
// One continuous camera that rides up the ladder with the climber, from a city plaza to the Kármán line.
// Two layers are drawn: behind, the real planet and sky at the climber's true altitude (a spherical cap of
// Earth, the sky darkening as the air thins, stars, meteors); in front, the set at metre scale: the ladder,
// the climber, the city and the things he passes. The set's height is drawn on a compressed scale above
// the clouds (every landmark gets the same screen time) but every number on screen is real.
//
// The climb is a time-lapse: his hands and feet always grip real rungs at a steady pace, while the world
// streams past faster between landmarks.
import * as THREE from 'three';
import { Rng, clamp, lerp, smooth } from '../engine/lib/rng.js';
import { townKit, makeCloudTexture, buildPlane } from '../engine/lib/town.js';
import { buildPeople } from '../engine/lib/people.js';
import VO from './space-ladder.vo.js';

const W = 1080, H = 1920;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const R_E = 6371e3, FT = 3.28084, MI = 1609.34;

// ------------------------------------------------------------------ the story, timed by the narration
const SAY = {};
{
  let t = 0.3;
  const say = (key, gap = 0.15) => { SAY[key] = t + gap; t = SAY[key] + VO[key].dur; };
  say('hook', 0); say('goal', 0.15);
  for (const k of ['tower', 'halfair', 'everest', 'plane', 'armstrong', 'skydive', 'meteors']) say(k, 0.2);
  say('space', 0.55); say('tail', 0.3); say('outro', 0.3);
}
const wordT = (key, word, nth = 0) => { let n = 0; for (const [w, s] of VO[key].words) if (w.toLowerCase().replace(/[^a-z0-9']/g, '').startsWith(word) && n++ === nth) return SAY[key] + s; return SAY[key]; };

// landmarks: real altitude (m), height on the set (m), when he gets there, the line under the counter
const LM = [
  { key: 'tower', alt: 828, y: 828, t: wordT('tower', 'passed') + 0.1, sub: 'TALLEST BUILDING ON EARTH · 2,717 FT · 828 M' },
  { key: 'clouds', alt: 2000, y: 1000, sub: 'CLOUDS · 6,600 FT · 2 KM' },
  { key: 'halfair', alt: 5500, y: 1150, t: SAY.halfair + 0.55, sub: 'HALF THE AIR IS BELOW · 18,000 FT · 5.5 KM' },
  { key: 'everest', alt: 8849, y: 1300, t: wordT('everest', 'higher'), sub: 'MOUNT EVEREST · 29,032 FT · 8,849 M' },
  { key: 'plane', alt: 11278, y: 1450, t: wordT('plane', 'planes'), sub: 'JETS AND THE HIGHEST BIRD · 37,000 FT · 11.3 KM' },
  { key: 'armstrong', alt: 18900, y: 1600, t: SAY.armstrong + 0.55, sub: 'ARMSTRONG LIMIT · 62,000 FT · 18.9 KM' },
  { key: 'skydive', alt: 41422, y: 1750, t: wordT('skydive', 'highest'), sub: 'RECORD SKYDIVE, 2014 · 135,890 FT · 41.4 KM' },
  { key: 'meteors', alt: 85300, y: 1900, t: SAY.meteors + 0.6, sub: 'COLDEST AIR · METEORS · 53 MI · 85 KM' },
  { key: 'space', alt: 100000, y: 2050, t: wordT('space', 'made'), sub: 'KÁRMÁN LINE · SPACE · 62 MI · 100 KM' },
];
const L = Object.fromEntries(LM.map((l) => [l.key, l]));
L.clouds.t = lerp(L.tower.t, L.halfair.t, 0.45);
const T_TL = SAY.goal + 0.6;                       // the time-lapse starts
const T_SPACE = L.space.t;
const T_END_TALK = SAY.outro + VO.outro.dur;
const FADE = [T_END_TALK + 0.25, T_END_TALK + 0.95], END = FADE[1] + 0.15, DURATION = END + 3.6;

// ------------------------------------------------------------------ the climb
// his own pace: one cycle (two rungs, both hands and both feet) every 1.2 s, 0.5 m/s, all the way
const RUNG = 0.3, CYCLE = 1.2, T_CLIMB = 0.6;
const PHI_STOP = (() => { const p = (T_SPACE + 0.7 - T_CLIMB) / CYCLE; return Math.ceil(p); })();   // he stops, both hands on, just past the line
const phiAt = (t) => Math.min(Math.max(0, t - T_CLIMB) / CYCLE, PHI_STOP);
const yLocal = (t) => 2 * RUNG * phiAt(t);           // how far he has climbed the ladder, by his own effort

// where he is on the set (m): his own climbing at first, then landmark to landmark; between the keys the
// height eases (in log space) so the world slows to almost his own pace as each landmark arrives
const SET = (() => {
  const keys = [[T_TL, yLocal(T_TL)], ...LM.map((l) => [l.t, l.y])];
  return (t) => {
    if (t <= T_TL) return yLocal(t);
    if (t >= T_SPACE) return L.space.y + yLocal(t) - yLocal(T_SPACE);     // in space: only his own last few rungs, then he holds on
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, y0] = keys[i], [t1, y1] = keys[i + 1];
      if (t > t1) continue;
      const v = (t - t0) / (t1 - t0);
      const u = lerp(v, v * v * (3 - 2 * v), 0.85);
      if (i === 0) { const b = 8; return (y0 + b) * Math.pow((y1 + b) / (y0 + b), u) - b; }   // off the ground: accelerating away
      return lerp(y0, y1, u);
    }
    return keys[keys.length - 1][1];
  };
})();
// the set height -> real altitude: identity up to the tower, then geometric between the landmarks
const ALT_OF_Y = (y) => {
  if (y <= L.tower.y) return Math.max(0, y);
  for (let i = 0; i < LM.length - 1; i++) { const a = LM[i], b = LM[i + 1]; if (y <= b.y) return a.alt * Math.pow(b.alt / a.alt, (y - a.y) / (b.y - a.y)); }
  return L.space.alt + (y - L.space.y);
};
const altAt = (t) => ALT_OF_Y(SET(t));

// the standard atmosphere's temperature (°C) at a height (m)
function tempC(h) {
  const k = h / 1000;
  if (k < 11) return 15 - 6.5 * k;
  if (k < 20) return -56.5;
  if (k < 32) return -56.5 + (k - 20);
  if (k < 47) return -44.5 + 2.8 * (k - 32);
  if (k < 51) return -2.5;
  if (k < 71) return -2.5 - 2.8 * (k - 51);
  if (k < 85) return -58.5 - 2.0 * (k - 71);
  return -86.5 + 0.4 * Math.max(0, k - 90);
}

// ------------------------------------------------------------------ captions: the narration, numbers in both systems
const NUMS = [['twenty-seven hundred feet', '2,700 feet (830 m)'], ['eighteen thousand feet', '18,000 feet (5.5 km)'], ['twenty-nine thousand feet', '29,000 feet (8.8 km)'],
  ['thirty-seven thousand feet', '37,000 feet (11 km)'], ['sixty-two thousand feet', '62,000 feet (19 km)'], ['twenty-five miles', '25 miles (41 km)'],
  ['fifty-three miles', '53 miles (85 km)'], ['minus a hundred and thirty degrees', '−130°F (−90°C)'], ['sixty-two miles', '62 miles (100 km)'],
  ['seventeen thousand miles an hour', '17,000 mph (28,000 km/h)']];
function buildCaptions() {
  const out = [];
  for (const [key, at] of Object.entries(SAY)) {
    if (key === 'hook') continue;                               // the title card says it
    const ws = [];
    for (const [w, s, e] of VO[key].words) { if (ws.length && /^[-']/.test(w)) { const p = ws[ws.length - 1]; p[0] += w; p[2] = e; } else ws.push([w, s, e]); }
    for (const [sayd, show] of NUMS) {
      const k = sayd.split(' ');
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

const fmtImp = (m) => (m < 25000 ? `${Math.round(m * FT).toLocaleString('en-US')} ft` : `${(m / MI).toFixed(1)} mi`);
const fmtMet = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

// ------------------------------------------------------------------ helpers
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function ctex(cv, repeat) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function signTexture(lines, o = {}) {
  const cv = canvas(1024, o.h ?? 512), c = cv.getContext('2d'), hh = o.h ?? 512;
  c.fillStyle = o.bg ?? '#1d3b6e'; c.fillRect(0, 0, 1024, hh);
  c.strokeStyle = o.fg ?? '#ffffff'; c.lineWidth = 12; c.strokeRect(18, 18, 988, hh - 36);
  c.fillStyle = o.fg ?? '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  lines.forEach(([txt, size], i) => { c.font = `800 ${size}px Inter, Helvetica, Arial, sans-serif`; c.fillText(txt, 512, hh / 2 + (i - (lines.length - 1) / 2) * size * 1.18); });
  return ctex(cv);
}
const GLSL_NOISE = `
  float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h1(i), h1(i+vec2(1,0)), f.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }`;

// ------------------------------------------------------------------ the far layer: the planet and the sky at true scale (metres)
const SUN = V(0.55, 0.62, 0.42).normalize();
function buildFar() {
  const scene = new THREE.Scene();
  const U = { uAlt: { value: 0 }, uSun: { value: SUN.clone() }, uTime: { value: 0 } };
  // sky: blue that thins to black with height; a bright band at the horizon that narrows to a rim from space
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform float uAlt; uniform vec3 uSun; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD);
        float rho = exp(-uAlt / 8000.0);
        float dip = acos(${R_E.toFixed(1)} / (${R_E.toFixed(1)} + uAlt));
        float e = asin(clamp(d.y, -1.0, 1.0)) + dip;                    // height above the true horizon
        vec3 zen = mix(vec3(0.0, 0.0, 0.004), vec3(0.16, 0.38, 0.82), pow(rho, 0.55));
        vec3 hor = mix(vec3(0.25, 0.45, 0.85), vec3(0.74, 0.84, 0.95), pow(rho, 0.25));
        float w = mix(0.012, 0.45, pow(rho, 0.35));
        float band = exp(-max(e, 0.0) / w);
        vec3 c = mix(zen, hor, band);
        if (e < 0.0) c = mix(hor, vec3(0.05, 0.09, 0.16), clamp(-e * 30.0, 0.0, 1.0));
        float s = max(dot(d, uSun), 0.0);
        c += vec3(1.0, 0.92, 0.8) * (pow(s, 10.0) * 0.28 * pow(rho, 0.3) + pow(s, 300.0) * 0.6);
        c = mix(c, vec3(1.0, 0.98, 0.94) * 4.0, smoothstep(0.99955, 0.9997, s));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -10; sky.scale.setScalar(1e6);
  scene.add(sky);
  // stars, showing as the sky goes black
  const r = new Rng(5), N = 2600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = r.float(-1, 1), a = r.float(0, Math.PI * 2), s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * 9e6, u * 9e6, Math.sin(a) * s * 9e6], i * 3);
    const b = Math.pow(r.next(), 3) * 0.9 + 0.1; col.set([b, b, b * (0.9 + 0.2 * r.next())], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const starM = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false });
  const stars = new THREE.Points(sg, starM); stars.frustumCulled = false; stars.renderOrder = -9;
  scene.add(stars);
  // the Earth: a spherical cap round the foot of the ladder, fine near the middle, out past the horizon
  const NR = 220, NA = 360, th1 = 0.32, verts = [], idx = [];
  for (let i = 0; i <= NR; i++) {
    const th = i === 0 ? 0 : (40 / R_E) * Math.pow(th1 / (40 / R_E), (i - 1) / (NR - 1));
    for (let j = 0; j < NA; j++) { const a = j / NA * Math.PI * 2; verts.push(R_E * Math.sin(th) * Math.cos(a), R_E * Math.cos(th) - R_E, R_E * Math.sin(th) * Math.sin(a)); }
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a = i * NA + j, b = i * NA + (j + 1) % NA, c = (i + 1) * NA + j, d = (i + 1) * NA + (j + 1) % NA; idx.push(a, b, c, b, d, c); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); eg.setIndex(idx);
  const earth = new THREE.Mesh(eg, new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uAlt, uTime; uniform vec3 uSun; varying vec3 vW;
      ${GLSL_NOISE}
      void main(){
        vec3 C = vec3(0.0, -${R_E.toFixed(1)}, 0.0);
        vec3 N = normalize(vW - C);
        vec2 p = vW.xz;
        float r = length(p);
        // continents and sea; the city sits on land
        float land = fbm(p / 1.4e6 + 3.7) + 0.35 * exp(-r * r / (6e5 * 6e5)) - 0.5;
        float mid = fbm(p / 6e4 + 9.1), fine = fbm(p / 2.2e3), tiny = fbm(p / 260.0);
        vec3 grass = vec3(0.30, 0.42, 0.20), dry = vec3(0.58, 0.52, 0.36), forest = vec3(0.16, 0.30, 0.14);
        vec3 lc = mix(mix(grass, forest, smoothstep(0.45, 0.65, mid)), dry, smoothstep(0.55, 0.75, fbm(p / 3e5 + 1.3)));
        // fields: a patchwork of crops and pasture, fading into the big picture with distance from the eye
        vec2 fc = floor(p / vec2(420.0, 300.0) + floor(p.yx / 2600.0) * 0.37);
        float fh = h1(fc), fh2 = h1(fc + 7.3);
        vec3 field = fh < 0.35 ? vec3(0.33, 0.47, 0.20) : fh < 0.55 ? vec3(0.62, 0.58, 0.32) : fh < 0.7 ? vec3(0.45, 0.36, 0.24) : fh < 0.85 ? vec3(0.24, 0.38, 0.17) : vec3(0.52, 0.55, 0.30);
        field *= 0.88 + 0.24 * fh2;
        float near = exp(-length(vW - cameraPosition) / 60000.0);
        lc = mix(lc, mix(lc, field, 0.75), near);
        lc *= 0.85 + 0.3 * fine;
        // the city round the ladder: blocks, streets, roofs; suburbs thinning out; other towns dotted about
        float town = smoothstep(5500.0, 1200.0, r) + 0.55 * smoothstep(9000.0, 3000.0, r) * step(0.45, fbm(p / 1500.0)) + 0.8 * smoothstep(0.80, 0.86, fbm(p / 9e3 + 5.0)) * exp(-r / 4e5);
        vec2 bq = p / (90.0 + 50.0 * h1(floor(p / 700.0))); vec2 bf = fract(bq);
        float street = step(bf.x, 0.12) + step(bf.y, 0.12);
        float roof = h1(floor(p / 26.0));
        vec3 tc = mix(vec3(0.55, 0.52, 0.48) * (0.75 + 0.45 * roof), vec3(0.32, 0.32, 0.33), clamp(street, 0.0, 1.0));
        tc = mix(tc, vec3(0.3, 0.42, 0.22), step(0.9, h1(floor(bq))) * (1.0 - clamp(street, 0.0, 1.0)));   // parks
        lc = mix(lc, tc, clamp(town, 0.0, 0.95) * mix(1.0, 0.6, 1.0 - near));
        vec3 sea = vec3(0.03, 0.12, 0.26);
        vec3 c = mix(sea, lc, smoothstep(-0.01, 0.02, land));
        float dif = max(dot(N, uSun), 0.0);
        vec3 V = normalize(cameraPosition - vW);
        c = c * (0.3 + 0.95 * dif);
        c += vec3(1.0, 0.9, 0.75) * pow(max(dot(reflect(-uSun, N), V), 0.0), 60.0) * 0.6 * (1.0 - smoothstep(-0.01, 0.02, land));
        // clouds painted on from above (the near ones are real billboards on the set)
        float cl = smoothstep(0.52, 0.72, fbm(p / 4.5e4 + vec2(uTime * 0.02, 0.0))) * smoothstep(2500.0, 9000.0, uAlt);
        c = mix(c, vec3(0.95) * (0.45 + 0.6 * dif), cl * 0.85);
        // air between the eye and the ground; a glowing rim where the view grazes the planet
        float dist = length(vW - cameraPosition);
        float od = dist / 45000.0 * exp(-uAlt / 9000.0) * 0.8 + dist / 400000.0;
        float graze = 1.0 - max(dot(N, V), 0.0);
        od += pow(graze, 6.0) * 2.2 * smoothstep(5000.0, 40000.0, uAlt);
        vec3 haze = vec3(0.6, 0.74, 0.92) * (0.35 + 0.8 * dif);
        c = mix(c, haze, 1.0 - exp(-od));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  earth.frustumCulled = false;
  scene.add(earth);
  // shooting stars round the mesosphere, burning across the black
  const meteors = [];
  const mTex = (() => { const cv = canvas(64, 256), c = cv.getContext('2d'); const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(150,220,255,0.5)'); g.addColorStop(0.96, 'rgba(255,255,235,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 256); const e = c.createLinearGradient(0, 0, 64, 0); e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(0.5, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = e; c.fillRect(0, 0, 64, 256); return ctex(cv); })();
  const mr = new Rng(77);
  // placed in the cone the camera looks into at that moment (round az 340°, 10-50° up), so they cross the frame
  for (let i = 0; i < 34; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: mTex, color: new THREE.Color(2.2, 2.2, 2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
    m.visible = false; m.frustumCulled = false; scene.add(m);
    const a = (340 + mr.float(-11, 11)) * Math.PI / 180, d = mr.float(14e3, 40e3), el = mr.float(12, 48) * Math.PI / 180;
    const dur = mr.float(0.45, 0.85), v = mr.float(18e3, 30e3);
    const side = V(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(mr.float(-0.9, 0.9));
    const dir = V(0, -1, 0).add(side).normalize();
    const mid = V(Math.sin(a) * d, 86e3 + d * Math.tan(el), Math.cos(a) * d);
    meteors.push({ m, t0: L.meteors.t - 2.2 + i * 0.2 + mr.float(-0.08, 0.08), dur, p0: mid.clone().addScaledVector(dir, -v * dur * 0.5), dir, v, len: mr.float(4e3, 8e3) });
  }
  // the space station, a bright moving star 300 km higher still
  const iss = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const cv = canvas(64, 64), c = cv.getContext('2d'); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,248,220,0.9)'); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return ctex(cv); })(), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  iss.visible = false; scene.add(iss);
  const cam = new THREE.PerspectiveCamera(50, W / H, 20, 2e7);
  return { scene, U, stars, starM, earth, meteors, iss, cam };
}

// ------------------------------------------------------------------ the climber: a suited figure on two-bone legs and arms
function buildClimber() {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: '#eceae4', roughness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: '#4a4f57', roughness: 0.6 });
  const orange = new THREE.MeshStandardMaterial({ color: '#f07a24', roughness: 0.6 });
  const glove = new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.7 });
  const visor = new THREE.MeshStandardMaterial({ color: '#c99a2c', metalness: 0.9, roughness: 0.18, emissive: '#3a2800', emissiveIntensity: 0.4 });
  const unit = (w, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), mat); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const part = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const P = {
    pelvis: part(new THREE.BoxGeometry(0.36, 0.2, 0.26), suit),
    torso: part(new THREE.BoxGeometry(0.46, 0.52, 0.3), suit),
    chest: part(new THREE.BoxGeometry(0.3, 0.16, 0.06), dark),
    pack: part(new THREE.BoxGeometry(0.4, 0.5, 0.18), dark),
    stripe: part(new THREE.BoxGeometry(0.47, 0.05, 0.31), orange),
    helmet: part(new THREE.SphereGeometry(0.19, 24, 18), suit),
    visor: part(new THREE.SphereGeometry(0.17, 24, 18, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.28, Math.PI * 0.42), visor),
    ring: part(new THREE.CylinderGeometry(0.16, 0.17, 0.06, 20), dark),
  };
  for (const s of ['L', 'R']) {
    P['upArm' + s] = unit(0.15, 0.15, suit); P['loArm' + s] = unit(0.13, 0.13, suit); P['hand' + s] = part(new THREE.BoxGeometry(0.11, 0.12, 0.08), glove);
    P['thigh' + s] = unit(0.18, 0.18, suit); P['shin' + s] = unit(0.16, 0.16, suit); P['boot' + s] = part(new THREE.BoxGeometry(0.15, 0.12, 0.27), dark);
    P['cuff' + s] = unit(0.15, 0.15, orange);
  }
  return { g, P };
}
const Y_AX = V(0, 1, 0);
function seg(m, a, b, extra = 0) { const d = b.clone().sub(a), len = d.length(); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y_AX, d.normalize()); m.scale.y = len + extra; }
function ik(A, T, l1, l2, pole) {
  const d = T.clone().sub(A); let len = d.length(); const dir = d.clone().divideScalar(len);
  len = Math.min(len, (l1 + l2) * 0.999);
  const a = (l1 * l1 - l2 * l2 + len * len) / (2 * len), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  const mid = A.clone().addScaledVector(dir, a).addScaledVector(pp, h);
  const end = A.clone().addScaledVector(dir, len);
  return { mid, end };
}

// ------------------------------------------------------------------ the near layer: the set (metres; heights compressed above the tower)
function buildNear(st) {
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight('#dfeaff', '#8d8270', 1.0);
  const sun = new THREE.DirectionalLight('#fff3e2', 2.7);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 60 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);
  st.hemi = hemi; st.sun = sun;
  const r = new Rng(12);
  const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75 }, o));
  const add = (geo, mat, x, y, z, rot) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rot) m.rotation.set(...rot); scene.add(m); return m; };

  // ---- the plaza, the city round it, the tallest tower on Earth a few blocks away
  const city = new THREE.Group(); scene.add(city); st.city = city;
  const pave = (() => { const S = 256, cv = canvas(S, S), c = cv.getContext('2d'); c.fillStyle = '#b9b2a6'; c.fillRect(0, 0, S, S); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = `hsl(36, 10%, ${64 + r.float(-6, 6)}%)`; c.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); } return ctex(c.canvas, true); })();
  {
    const g = new THREE.CircleGeometry(140, 64).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 4, p.getZ(i) / 4);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: pave, roughness: 0.92 }));
    m.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n float rr = length(vMapUv) * 4.0; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.41, 0.4), smoothstep(40.0, 60.0, rr));'); };
    m.receiveShadow = true; city.add(m);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.4, 24), std('#6a6e74', { metalness: 0.4 })); base.position.y = 0.2; base.receiveShadow = true; city.add(base);
  }
  const kit = townKit(), bl = [];
  for (let i = 0; i < 44; i++) { const a = i / 44 * Math.PI * 2 + r.float(-0.04, 0.04), d = r.float(46, 70); bl.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, w: r.float(10, 14), d: r.float(10, 14), h: r.float(14, 42), style: r.int(0, 5), box: r.chance(0.5), rot: -a }); }
  for (let i = 0; i < 70; i++) { const a = r.float(0, Math.PI * 2), d = r.float(85, 420); const x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.hypot(x + 150, z + 220) < 60) continue; bl.push({ x, z, w: r.float(14, 24), d: r.float(14, 24), h: r.float(20, 90), style: r.int(0, 5), box: true, rot: r.float(0, 3) }); }
  for (const b of bl) city.add(kit.building(b));
  {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), 900);
    const M4 = new THREE.Matrix4(), cc = new THREE.Color(); let n = 0;
    for (let i = 0; i < 2000 && n < 900; i++) {
      const x = r.float(-1500, 1500), z = r.float(-1500, 1500), d = Math.hypot(x, z);
      if (d < 430 || d > 1500 || Math.hypot(x + 150, z + 220) < 70) continue;
      const w = r.float(18, 40), dd = r.float(18, 40), h = r.float(12, 70) * (1.3 - d / 1500);
      M4.makeScale(w, h, dd).setPosition(Math.round(x / 55) * 55, 0, Math.round(z / 55) * 55);
      im.setMatrixAt(n, M4); im.setColorAt(n, cc.set(r.pick(['#b9ad98', '#a39a8d', '#c9b79c', '#8e8a86', '#b07a5a', '#d4cbbb', '#7f8b96']))); n++;
    }
    im.count = n; city.add(im);
  }
  const trees = []; for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, d = 36; trees.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, s: r.float(0.9, 1.2), h: r.float(4, 6) }); }
  city.add(kit.trees(trees));
  // the supertall: tapering glass tiers and a spire, 828 m to the tip
  const tower = new THREE.Group(); tower.position.set(-150, 0, -220); city.add(tower); st.tower = tower;
  const glassTex = (() => { const cv = canvas(128, 512), c = cv.getContext('2d'); c.fillStyle = '#6f8aa6'; c.fillRect(0, 0, 128, 512); for (let y = 0; y < 512; y += 8) { c.fillStyle = y % 16 ? 'rgba(220,235,250,0.35)' : 'rgba(40,60,80,0.4)'; c.fillRect(0, y, 128, 3); } for (let x = 0; x < 128; x += 16) { c.fillStyle = 'rgba(230,240,250,0.5)'; c.fillRect(x, 0, 2, 512); } return ctex(cv, true); })();
  let y0 = 0;
  const tiers = [[60, 120], [52, 110], [44, 100], [36, 90], [29, 80], [22, 70], [16, 60], [11, 50]];
  for (const [w, h] of tiers) {
    const t = glassTex.clone(); t.needsUpdate = true; t.repeat.set(w / 12, h / 24);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.55, w * 0.62, h, 6), new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.55, color: '#dfe8f2' }));
    m.position.y = y0 + h / 2; tower.add(m); y0 += h;
  }
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 3.5, 828 - y0, 10), std('#d8dee6', { metalness: 0.7, roughness: 0.3 })); spire.position.y = y0 + (828 - y0) / 2; tower.add(spire);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff4a3a', toneMapped: false })); tip.position.y = 828.5; tower.add(tip); st.towerTip = tip;
  // a crowd round the foot of the ladder, looking up
  const ppl = buildPeople({ max: 220, seed: 4 }); city.add(ppl.group); st.ppl = ppl;
  for (let i = 0; i < 150; i++) {
    const a = r.float(0, Math.PI * 2), d = r.float(4.2, 26), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(Math.atan2(x, z) - 2.6) < 0.35 && d < 20) continue;           // a gap for the camera
    ppl.add({ x, z, h: Math.atan2(-x, -z), poses: [[0, r.pick(['lookUp', 'phone', 'lookUp', 'point', 'phone', 'idle'])]], phone: () => true });
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), new THREE.MeshStandardMaterial({ map: signTexture([['LADDER TO SPACE', 108], ['62 MI · 100 KM · STRAIGHT UP', 62]], { bg: '#f4c400', fg: '#1a1a1a' }), roughness: 0.6 }));
  sign.position.set(-5.2, 2.3, 3.4); sign.rotation.y = 2.2; city.add(sign);
  add(new THREE.CylinderGeometry(0.06, 0.06, 1.3), std('#555'), -5.2, 0.65, 3.4).parent = city;

  // ---- the ladder: two rails from the plaza to past the Kármán line; rungs near him only (beyond, they're specks)
  const railM = std('#b9c0c8', { metalness: 0.75, roughness: 0.32 });
  for (const x of [-0.28, 0.28]) { const m = add(new THREE.BoxGeometry(0.055, 2300, 0.08), railM, x, 1150, 0); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
  const rungs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 10).rotateZ(Math.PI / 2), railM, 90);
  rungs.castShadow = true; rungs.receiveShadow = true; rungs.frustumCulled = false; scene.add(rungs); st.rungs = rungs;
  // altitude plaques on the right rail at every landmark, and a hoop at the line
  const PLQ = { tower: ['828 M · 2,717 FT', 'TALLEST BUILDING'], halfair: ['5,500 M · 18,000 FT', 'HALF THE AIR BELOW'], everest: ['8,849 M · 29,032 FT', 'MT EVEREST'], plane: ['11,300 M · 37,000 FT', 'JET CRUISE'], armstrong: ['18,900 M · 62,000 FT', 'ARMSTRONG LIMIT'], skydive: ['41,422 M · 135,890 FT', 'RECORD SKYDIVE'], meteors: ['85 KM · 53 MI', 'COLDEST AIR'] };
  for (const [k, [a, b]] of Object.entries(PLQ)) {
    const m = add(new THREE.PlaneGeometry(0.62, 0.31), new THREE.MeshStandardMaterial({ map: signTexture([[a, 84], [b, 92]], { bg: '#1f2a36', fg: '#f6efe0' }), roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.08 }), 0.64, L[k].y + 1.45, 0.02, [0, -0.5, 0]);
    add(new THREE.BoxGeometry(0.34, 0.04, 0.04), railM, 0.45, L[k].y + 1.45, 0.0);
    m.castShadow = true;
  }
  const hoopY = L.space.y + 1.3;               // at his chest the moment he arrives
  st.hoop = add(new THREE.TorusGeometry(1.25, 0.05, 10, 64), new THREE.MeshBasicMaterial({ color: '#9fe0ff', toneMapped: false }), 0, hoopY, -0.2, [Math.PI / 2, 0, 0]);
  const spaceSign = add(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: signTexture([['SPACE', 170], ['KÁRMÁN LINE · 100 KM · 62 MI', 58]], { bg: '#0b1626', fg: '#bfe9ff' }), toneMapped: false }), 0.95, hoopY + 0.45, 0.04, [0, -0.35, 0]);
  st.spaceSign = spaceSign;

  // ---- the climber
  st.cl = buildClimber(); scene.add(st.cl.g);

  // ---- clouds round the ladder: the layer he climbs through
  const ctx3 = [0, 1, 2, 3].map((k) => makeCloudTexture(40 + k));
  st.clouds = [];
  for (let i = 0; i < 140; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx3[i % 4], transparent: true, depthWrite: false, opacity: 0.95, fog: false }));
    const a = r.float(0, Math.PI * 2), d = i < 30 ? r.float(6, 60) : r.float(60, 900);
    s.position.set(Math.cos(a) * d, L.clouds.y + r.float(-28, 22) + (i < 30 ? 0 : r.float(-20, 20)), Math.sin(a) * d);
    const sc = i < 30 ? r.float(25, 60) : r.float(80, 260); s.scale.set(sc, sc * 0.45, 1);
    scene.add(s); st.clouds.push(s);
  }
  // ---- the airliner and its contrail, and the vulture
  const plane = buildPlane(); scene.add(plane); st.plane = plane;
  const puffTex = (() => { const cv = canvas(64, 64), c = cv.getContext('2d'); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return ctex(cv); })();
  st.trail = [];
  for (let i = 0; i < 160; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false })); scene.add(s); st.trail.push(s); }
  const bird = new THREE.Group(); scene.add(bird); st.bird = bird;
  const fea = std('#4b3a2c'), bel = std('#d8c8a8');
  bird.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.95), fea));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.2), bel); head.position.set(0, 0.06, 0.55); bird.add(head);
  st.wings = [-1, 1].map((s) => { const w = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 0.5).translate(s * 0.62, 0, 0), fea); w.add(m); w.position.set(s * 0.12, 0.05, 0); bird.add(w); return w; });
  // ---- the record balloon, floating at 41 km with a tiny jumper under it
  const bal = new THREE.Group(); scene.add(bal); st.balloon = bal;
  const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push(new THREE.Vector2(Math.sin(Math.PI * Math.pow(u, 0.8)) * 26 * (0.35 + 0.65 * u), u * 70)); }
  bal.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.88, side: THREE.DoubleSide })));
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 34), std('#999')); line.position.y = -17; bal.add(line);
  const tiny = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.5), std('#f0f0ea')); tiny.position.y = -35; bal.add(tiny);
  bal.position.set(-470, L.skydive.y - 20, -170);

  const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 30000);
  return { scene, cam };
}

// ------------------------------------------------------------------ the camera: keys of angle round the ladder, height, distance, aim
const KEYS = (() => {
  const k = (t, az, y, d, look, aim = 0) => ({ t, az, y, d, look, aim });
  return [
    k(T_TL - 0.9, 150, -1.6, 4.8, 0.9),
    k(L.tower.t - 1.4, 34, 0.2, 5.0, -0.1, 0.0),
    k(L.tower.t - 0.2, 30, 0.6, 5.0, -0.3, 0.5),
    k(L.tower.t + 0.3, 10, 0.9, 5.0, -0.5, 0.0),
    k(L.clouds.t, -40, 2.2, 4.4, -1.2),
    k(L.halfair.t + 0.6, -60, 3.4, 3.8, -2.4),
    k(L.everest.t + 0.4, 70, -0.6, 5.0, 0.4),
    k(L.plane.t - 0.7, 183, 0.3, 5.2, 0.1, 0.0),
    k(L.plane.t + 0.2, 185, 0.4, 5.2, 0.0, 0.3),
    k(L.plane.t + 1.2, 192, 0.5, 5.2, 0.0, 0.0),
    k(wordT('plane', 'bird') + 0.4, 220, 0.6, 5.0, 0.0),
    k(L.armstrong.t + 0.5, 100, 2.8, 4.2, -1.8),
    k(L.skydive.t - 0.6, 42, 0.3, 5.4, 0.2, 0.0),
    k(L.skydive.t + 0.3, 40, 0.3, 5.4, 0.2, 0.3),
    k(L.skydive.t + 1.2, 38, 0.3, 5.4, 0.2, 0.0),
    k(L.meteors.t + 1.2, 160, -1.8, 5.0, 1.2),
    k(L.meteors.t + 4.4, 168, -1.5, 5.0, 1.0),
    k(T_SPACE + 0.3, 70, 1.6, 4.6, -0.6),
    k(SAY.tail + 1.5, 55, 1.4, 7.5, 0.2),
    k(SAY.outro, 75, 2.5, 15, 0.8),
    k(DURATION, 90, 4, 26, 1.2),
  ];
})();
function camKeys(t) {
  const n = KEYS.length;
  if (t <= KEYS[0].t) return { ...KEYS[0] };
  if (t >= KEYS[n - 1].t) return { ...KEYS[n - 1] };
  let i = 0; while (t > KEYS[i + 1].t) i++;
  const a = KEYS[Math.max(0, i - 1)], b = KEYS[i], c = KEYS[i + 1], d = KEYS[Math.min(n - 1, i + 2)];
  const u = (t - b.t) / (c.t - b.t), u2 = u * u, u3 = u2 * u;
  const out = {};
  out.aim = lerp(b.aim, c.aim, u * u * (3 - 2 * u));          // no overshoot: zero between keys that are zero
  for (const f of ['az', 'y', 'd', 'look']) {
    const m1 = (c[f] - a[f]) / Math.max(0.01, c.t - a.t) * (c.t - b.t) * 0.5, m2 = (d[f] - b[f]) / Math.max(0.01, d.t - b.t) * (c.t - b.t) * 0.5;
    out[f] = (2 * u3 - 3 * u2 + 1) * b[f] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * c[f] + (u3 - u2) * m2;
  }
  return out;
}
const hipY = (t) => 1.05 + SET(t);
function camAt(t) {
  const hy = hipY(t);
  const k = camKeys(t), az = k.az * Math.PI / 180;
  const follow = { pos: V(Math.sin(az) * k.d, hy + k.y, -0.38 + Math.cos(az) * k.d), look: V(0, hy + k.look, -0.38) };
  // lean the aim toward whichever landmark is nearest in time
  if (k.aim > 0) {
    const targets = [[L.tower.t, V(-150, 828, -220)], [L.plane.t, V((t - L.plane.t) * 140 - 30, L.plane.y - 14, 120)], [L.skydive.t, V(-470, L.skydive.y + 20, -170)]];
    let best = targets[0]; for (const tg of targets) if (Math.abs(t - tg[0]) < Math.abs(t - best[0])) best = tg;
    const d0 = follow.look.clone().sub(follow.pos).normalize(), d1 = best[1].clone().sub(follow.pos).normalize();
    follow.look = follow.pos.clone().addScaledVector(d0.lerp(d1, clamp(k.aim)).normalize(), 10);
  }
  // the opening: down in the plaza among the crowd, looking up the ladder, then the crane up to him
  const street = { pos: V(-7.5 + 0.6 * t, 1.65 + 0.25 * t, 13.5 - 0.5 * t), look: V(0, 5.5 + 0.9 * t, 0) };
  const w = smooth(1.6, T_TL + 0.2, t);
  const pos = street.pos.clone().lerp(follow.pos, w), look = street.look.clone().lerp(follow.look, w);
  return { pos, look, fov: lerp(52, 46, w) };
}

// ------------------------------------------------------------------ sound
const S_ = (file, t, o = {}) => Object.assign({ type: 'sample', file, t }, o);
function buildAudio() {
  const A = [];
  const fx = (type, o) => A.push(Object.assign({ type, fx: true }, o));
  const keysEvery = (f, step = 0.05) => { const ks = []; for (let t = 0; t <= DURATION; t += step) ks.push([+t.toFixed(2), +f(t).toFixed(3)]); return ks; };
  for (const [key, at] of Object.entries(SAY)) A.push(S_(VO[key].file, at, { level: 1.35, free: true, verb: 0.03, fin: 0.005, fout: 0.03 }));
  const talking = (t) => { let k = 0; for (const [key, at] of Object.entries(SAY)) k = Math.max(k, smooth(at - 0.15, at, t) * (1 - smooth(at + VO[key].dur, at + VO[key].dur + 0.25, t))); return k; };
  A.push({ type: 'fxduck', keys: keysEvery((t) => 1 - 0.45 * talking(t), 0.04) });
  // music: its long build peaks (48 s into the track) as he reaches space
  const peak = 48, off = Math.max(0, peak - T_SPACE), st0 = Math.max(0, T_SPACE - peak);
  A.push(S_('music/871.mp3', st0, { offset: off, level: 0.5, fin: 0.3, fout: 2.2, dur: DURATION - st0,
    keys: keysEvery((t) => (t < T_SPACE - 0.35 ? 0.85 : t < T_SPACE + 0.02 ? 0.12 : 1) * (1 - 0.5 * talking(t))) }));
  // the plaza: city air and a crowd
  A.push(S_('sfx/367.wav', 0, { offset: 12, dur: T_TL + 3, level: 0.45, fout: 2.0, keys: keysEvery((t) => 1 - 0.5 * talking(t)) }));
  fx('crowd', { t0: 0, t1: T_TL + 2.5, level: 0.24, swell: [[0, 0.5], [1.0, 0.7], [T_TL, 0.5], [T_TL + 2.5, 0.1]] });
  // wind: strong in the thick air, thinning to nothing; then only his breathing in the suit
  fx('rush', { t0: 0.5, t1: T_SPACE + 1, level: 0.36, seed: 3, speed: keysEvery((t) => clamp(0.15 + 0.8 * Math.exp(-altAt(t) / 9000)) * (t < T_TL ? 0.5 : 1), 0.05) });
  // every grip on a rung: a soft metal tick
  for (let n = 0; n < PHI_STOP * 2; n++) { const t = T_CLIMB + (n + 0.5) * CYCLE / 2; if (t > DURATION - 2) break; fx('snap', { t, size: 0.12, level: 0.13, seed: 200 + n }); }
  // a whoosh as the world streams past between landmarks, landing on each one
  LM.forEach((l, i) => { if (i < LM.length - 1) fx('sweep', { t: l.t, pre: 0.7, post: 0.3, f: i % 2 ? [5200, 380] : [380, 5200], q: 1.6, level: 0.36, pan: i % 2 ? [0.5, -0.5] : [-0.5, 0.5], seed: 10 + i }); });
  fx('flyby', { t: L.plane.t - 0.2, dur: 3.2, level: 0.55, pan: [-0.8, 0.8], seed: 30 });
  fx('sparkle', { t: L.meteors.t - 2.4, dur: 4.6, count: 16, f: [1500, 4800], level: 0.2, seed: 31 });
  for (const m of [0, 1, 2, 3]) fx('sweep', { t: L.meteors.t - 2 + m * 1.1, pre: 0.25, post: 0.4, f: [6000, 900], q: 2.4, level: 0.18, pan: m % 2 ? [0.6, -0.4] : [-0.6, 0.4], seed: 40 + m });
  // space: everything drops away for a moment, then the hit; a high shimmer for the station going over
  A.push({ type: 'duck', keys: [[0, 1], [T_SPACE - 0.35, 1], [T_SPACE - 0.25, 0.08], [T_SPACE - 0.01, 0.08], [T_SPACE + 0.02, 1], [DURATION, 1]] });
  fx('sweep', { t: T_SPACE - 0.32, pre: 1.8, post: 0.02, f: [250, 9500], q: 1.2, curve: 2.8, tone: 0.5, level: 0.55, pan: [-0.3, 0.3], seed: 50 });
  A.push({ type: 'impact', t: T_SPACE, level: 0.85, free: true, seed: 51 });
  fx('sparkle', { t: T_SPACE + 0.1, dur: 1.6, count: 10, f: [2000, 6000], level: 0.2, seed: 52 });
  fx('glide', { t0: SAY.tail + 2.4, t1: SAY.tail + 6.5, level: 0.07, seed: 53, keys2: [[SAY.tail + 2.4, 0.2], [SAY.tail + 6.5, 0.6]] });
  A.push({ type: 'chime', t: END, level: 0.2, free: true });
  return A;
}

// ------------------------------------------------------------------ the scenario
export default {
  id: 'space-ladder',
  title: 'What if you built a ladder to space, and climbed it?',
  endFact: 'Space starts <b>100 km</b> (62 mi) up. Staying there means moving sideways at about <b>28,000 km/h</b> (17,000 mph).',
  duration: DURATION,
  titleIn: [-1, -0.5], titleOut: [SAY.hook + VO.hook.dur + 0.05, SAY.hook + VO.hook.dur + 0.35],   // the hook, big, while it's said
  fadeOut: FADE, endAt: END, endSpeed: 1.3,
  captions: CAPTIONS,
  captionFade: 0.06,
  goal(t) {
    const a = smooth(0.3, 0.8, t) * (1 - smooth(FADE[0], FADE[1], t));
    if (a <= 0) return null;
    if (t >= T_SPACE) return { label: 'GOAL REACHED ✓', pct: '100%', k: 1, from: 'GROUND', to: 'SPACE', alpha: a };
    const p = Math.min(99.9, altAt(t) / L.space.alt * 100);
    return { label: 'GOAL: SPACE', pct: p < 0.05 ? '0%' : p < 1 ? `${p.toFixed(2)}%` : p < 10 ? `${p.toFixed(1)}%` : `${Math.floor(p)}%`, k: p / 100, from: 'GROUND', to: '62 MI · 100 KM', alpha: a };
  },
  hud(t) {
    if (t >= FADE[1]) return null;
    const a = 1 - smooth(FADE[0], FADE[1], t);
    const h = altAt(t), c = tempC(h), f = c * 9 / 5 + 32;
    let sub = 'LADDER TO SPACE · 62 MI · 100 KM';
    for (const l of LM) if (t >= l.t - 1.0) sub = l.sub;
    if (t >= T_SPACE) return { label: `ALTITUDE · AIR ${Math.round(f)}°F / ${Math.round(c)}°C`, value: 'SPACE', value2: '62 mi · 100 km', sub, alpha: a };
    return { label: `ALTITUDE · AIR ${Math.round(f)}°F / ${Math.round(c)}°C`, value: fmtImp(h), value2: fmtMet(h), sub, alpha: a };
  },
  labels() { return []; },
  audio: buildAudio(),

  async setup(ctx) {
    const { renderer } = ctx;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    ctx.grain = 0; ctx.vignette = 0.28;
    ctx.grade = { brightness: 1.0, contrast: 1.04, saturate: 1.08, sepia: 0 };
    const st = this.st = {};
    window.__st = st;
    st.far = buildFar();
    st.near = buildNear(st);
  },

  update(ctx, t) {
    const st = this.st, F = st.far, N = st.near;
    const c = camAt(t);
    const yS = SET(t), alt = altAt(t), hy = hipY(t);
    // the near camera rides the set; the far one sits at his true altitude, looking the same way
    for (const cam of [N.cam, F.cam]) { cam.fov = c.fov; cam.aspect = W / H; }
    N.cam.position.copy(c.pos); N.cam.lookAt(c.look); N.cam.updateProjectionMatrix(); N.cam.updateMatrixWorld();
    F.cam.position.set(c.pos.x, alt + (c.pos.y - hy) + 1.05, c.pos.z); F.cam.quaternion.copy(N.cam.quaternion);
    F.cam.near = Math.max(2, Math.min(200, alt * 0.02)); F.cam.updateProjectionMatrix(); F.cam.updateMatrixWorld();
    ctx.view = { layers: [{ scene: F.scene, camera: F.cam }, { scene: N.scene, camera: N.cam }] };

    // the sky thins: stars come out, the light hardens, the set's fill goes dark
    F.U.uAlt.value = Math.max(0, alt + (c.pos.y - hy)); F.U.uTime.value = t;
    const rho = Math.exp(-alt / 8000);
    F.starM.opacity = smooth(22000, 55000, alt) * 0.95;
    st.hemi.intensity = lerp(0.18, 1.0, Math.pow(rho, 0.4)); st.hemi.color.setRGB(lerp(0.4, 0.87, rho), lerp(0.5, 0.92, rho), 1.0);
    st.sun.intensity = lerp(3.4, 2.7, rho);
    st.sun.position.copy(c.look).addScaledVector(SUN, 30); st.sun.target.position.copy(c.look); st.sun.target.updateMatrixWorld();
    // the city fades into the cloud layer once he's above it (from there the planet below is the far layer)
    st.city.visible = yS < L.clouds.y + 15;
    // clouds thin out as they near the lens (no single-frame whiteouts); a soft white veil as he climbs through the layer
    for (const s of st.clouds) s.material.opacity = 0.95 * (1 - smooth(L.clouds.y + 60, L.clouds.y + 120, yS)) * smooth(4, 30, s.position.distanceTo(c.pos));
    const veil = Math.exp(-(((yS - L.clouds.y) / 18) ** 2)) * 0.55;
    ctx.tint = veil > 0.01 ? { color: '#f2f5f8', opacity: veil, blend: 'normal' } : null;
    st.towerTip.material.color.setScalar(Math.sin(t * 6) > 0 ? 1 : 0.3).multiply(new THREE.Color('#ff4a3a'));

    // ---- the climber: hips rise two rungs a cycle; diagonal pairs of limbs move in turn and always land on rungs
    const phi = phiAt(t), base = Math.floor(phi), fr = phi - base;
    const mA = smooth(0, 0.5, fr), mB = smooth(0.5, 1, fr);
    const dLadder = yS - yLocal(t);                                  // the ladder's rungs ride with him in the time-lapse
    const rungY = (n) => n * RUNG + dLadder;
    const hip = V(0.03 * Math.sin(phi * Math.PI * 2), hy, -0.4 + 0.02 * Math.cos(phi * Math.PI * 4));
    const lean = 0.12;
    const sh = hip.clone().add(V(0, 0.56 * Math.cos(lean), 0.56 * Math.sin(lean)));
    const limb = (lvl0, m, x, z0, dz) => V(x, rungY(lvl0 + 2 * m), z0 - dz * Math.sin(Math.PI * m));
    let hR = limb(2 * base + 6, mA, 0.2, -0.04, 0.16), hL = limb(2 * base + 7, mB, -0.2, -0.04, 0.16);
    const fL = limb(2 * base + 1, mA, -0.14, -0.1, 0.12).add(V(0, 0.07, 0)), fR = limb(2 * base + 2, mB, 0.14, -0.1, 0.12).add(V(0, 0.07, 0));
    // in space he lets go with one hand and waves
    const wave = smooth(T_SPACE + 0.9, T_SPACE + 1.5, t) * (1 - smooth(SAY.tail + 0.2, SAY.tail + 0.8, t));
    if (wave > 0) hR = hR.lerp(sh.clone().add(V(0.55, 0.45 + 0.08 * Math.sin(t * 9), -0.25 + 0.12 * Math.sin(t * 9))), wave);
    const P = st.cl.P;
    P.pelvis.position.copy(hip); P.pelvis.rotation.set(lean, 0, 0);
    const tc = hip.clone().lerp(sh, 0.5);
    for (const k of ['torso', 'stripe']) { P[k].position.copy(tc); P[k].rotation.set(lean, 0, 0); }
    P.stripe.position.y -= 0.12;
    P.chest.position.copy(tc).add(V(0, 0.06, 0.16)); P.chest.rotation.set(lean, 0, 0);
    P.pack.position.copy(tc).add(V(0, 0.04, -0.24)); P.pack.rotation.set(lean, 0, 0);
    const neck = sh.clone().add(V(0, 0.06, 0.03));
    const look = t < T_SPACE + 0.5 ? -0.55 + 0.25 * Math.sin(t * 0.7) : 0.45;    // he looks up the ladder; in space, down at the Earth
    P.ring.position.copy(neck); P.ring.rotation.set(lean, 0, 0);
    const hc = neck.clone().add(V(0, 0.2 * Math.cos(look * 0.4), 0.06 + 0.06 * Math.sin(-look)));
    P.helmet.position.copy(hc); P.visor.position.copy(hc); P.visor.rotation.set(look, 0, 0);
    const legLen = 0.43, armLen = 0.3;
    for (const [s, sx, hand, foot] of [['L', -1, hL, fL], ['R', 1, hR, fR]]) {
      const S = sh.clone().add(V(0.25 * sx, -0.04, 0));
      const a = ik(S, hand, armLen, armLen, V(sx * 1.0, -0.6, -1.0));
      seg(P['upArm' + s], S, a.mid, 0.05); seg(P['loArm' + s], a.mid, a.end, 0.02);
      P['hand' + s].position.copy(a.end); P['hand' + s].quaternion.copy(P['loArm' + s].quaternion);
      seg(P['cuff' + s], a.mid.clone().lerp(a.end, 0.86), a.end, 0); P['cuff' + s].scale.y = 0.05;
      const Hj = hip.clone().add(V(0.1 * sx, -0.06, 0));
      const l = ik(Hj, foot, legLen, legLen, V(sx * 0.25, 0.1, 1.0));
      seg(P['thigh' + s], Hj, l.mid, 0.04); seg(P['shin' + s], l.mid, l.end, 0.02);
      P['boot' + s].position.copy(l.end).add(V(0, -0.03, 0.05)); P['boot' + s].rotation.set(0, 0, 0);
    }
    // rungs: the ones within reach of the camera
    const n0 = Math.floor(yLocal(t) / RUNG) - 40, M4 = new THREE.Matrix4();
    for (let i = 0; i < 90; i++) { const n = n0 + i; M4.makeTranslation(0, n < 1 && dLadder < 0.01 ? -100 : rungY(n), 0); st.rungs.setMatrixAt(i, M4); }
    st.rungs.instanceMatrix.needsUpdate = true;
    st.hoop.material.color.setRGB(0.55 + 0.45 * smooth(T_SPACE - 0.2, T_SPACE + 0.3, t), 0.85, 1.0);

    // ---- the jet: level, 250 m/s, passing in front of the ladder with a contrail that spreads behind it
    const tp = L.plane.t, yP = L.plane.y - 14;
    const px = (t - tp) * 140 - 30;
    st.plane.position.set(px, yP, 120); st.plane.rotation.set(0, 0, 0);
    st.plane.visible = Math.abs(t - tp) < 6;
    st.trail.forEach((s, i) => { const back = i * 6 + 16, x = px - back; const age = back / 140; s.visible = st.plane.visible && x > -900; s.position.set(x, yP - 1.5 + age * 0.4, 120 + (i % 2 ? 6.5 : -6.5)); const sc = 2.5 + age * 2.2; s.scale.set(sc, sc, 1); s.material.opacity = 0.75 * Math.exp(-age * 0.18); });
    // the vulture glides a slow circle round the ladder, flapping now and then
    const tb = wordT('plane', 'bird'), ab = (t - tb) * 0.55 + 2.4;
    st.bird.visible = Math.abs(t - tb) < 3.5;
    st.bird.position.set(Math.sin(ab) * 9, L.plane.y + 1.2 + 0.6 * Math.sin(t * 0.8), Math.cos(ab) * 9 - 0.4);
    st.bird.rotation.set(0, ab + Math.PI / 2, 0.35);
    const flap = Math.sin(t * 7) * Math.max(0, Math.sin(t * 0.9)) * 0.6;
    st.wings[0].rotation.z = flap + 0.08; st.wings[1].rotation.z = -flap - 0.08;
    // the balloon drifts up slowly
    st.balloon.position.y = L.skydive.y - 20 + (t - L.skydive.t) * 0.6;
    st.balloon.visible = Math.abs(t - L.skydive.t) < 5;

    // ---- the far layer: meteors and the station
    for (const m of F.meteors) {
      const u = (t - m.t0) / m.dur;
      m.m.visible = u > 0 && u < 1;
      if (!m.m.visible) continue;
      const head = m.p0.clone().addScaledVector(m.dir, m.v * (t - m.t0));
      const len = m.len * Math.min(1, u * 3);
      m.m.position.copy(head).addScaledVector(m.dir, -len / 2);
      // face the camera, long axis along the flight
      const toCam = F.cam.position.clone().sub(m.m.position).normalize();
      const xAx = new THREE.Vector3().crossVectors(m.dir, toCam).normalize(), zAx = new THREE.Vector3().crossVectors(xAx, m.dir);
      m.m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, m.dir, zAx));
      m.m.scale.set(len * 0.07, len, 1);
      m.m.material.opacity = Math.sin(Math.PI * u);
    }
    const ti = SAY.tail + 1.2;
    F.iss.visible = t > ti && t < FADE[1];
    if (F.iss.visible) { const a = (240 + (t - ti) * 3.0) * Math.PI / 180; F.iss.position.set(Math.sin(a) * 1.0e6, 100e3 + 1.0e6 * Math.tan(0.24), Math.cos(a) * 1.0e6); const s = 16000 * (0.9 + 0.1 * Math.sin(t * 13)); F.iss.scale.set(s, s, 1); }
    st.ppl.update(t);
  },
};

export const _debug = { SAY, LM, SET, altAt, yLocal, phiAt, camAt, T_TL, T_SPACE, PHI_STOP, END, DURATION, CAPTIONS };
