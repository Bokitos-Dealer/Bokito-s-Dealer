// What if you built a ladder all the way to space, and climbed it?
//
// One continuous camera rides up a ladder from a city plaza at dawn (Dubai, beside the tallest building on
// Earth) to the Kármán line, 100 km up. Two layers are drawn and composited in the post chain:
//   far:  the real planet at true scale: a physically scattered sky (Rayleigh + Mie through a 100 km shell),
//         NASA Blue Marble / Black Marble imagery on a spherical cap round the ladder, aerial perspective,
//         stars, meteors, the space station;
//   near: the set in metres: the ladder, the climber, the city, the tower, clouds, a jet, a balloon, specks
//         of dust and ice for parallax. Above the tower its height is drawn on a compressed scale so every
//         landmark gets the same screen time; every number on screen is real.
// The light is the physics too: the street is still in blue twilight, the sun rises for him above the clouds,
// turns from red to gold to white as the air thins, and the sky goes black at midday.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Rng, clamp, lerp, smooth, fbm1 } from '../engine/lib/rng.js';
import { makeCloudTexture, buildPlane } from '../engine/lib/town.js';
import { buildPeople } from '../engine/lib/people.js';
import { ATMO_GLSL, sunlightAt, skyAt } from '../engine/lib/atmosphere.js';
import VO from './space-ladder.vo.js';

const W = 1080, H = 1920;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const R_E = 6371e3, FT = 3.28084, MI = 1609.34;
const DEG = Math.PI / 180;
// the place and the moment: Dubai, the sun half a degree below the horizon, rising in the east (x = east, z = south)
const LAT0 = 25.197 * DEG, LON0 = 55.274 * DEG;
const SUN_EL = -0.5 * DEG, SUN_AZ = 100 * DEG;                       // azimuth from north, clockwise
const SUN = V(Math.cos(SUN_EL) * Math.sin(SUN_AZ), Math.sin(SUN_EL), -Math.cos(SUN_EL) * Math.cos(SUN_AZ)).normalize();
const SUN_AZC = Math.atan2(SUN.x, SUN.z) / DEG;                       // the same, in the camera's angle convention

// ------------------------------------------------------------------ the story, timed by the narration
const ORDER = ['hook', 'goal', 'tower', 'sunrise', 'halfair', 'everest', 'plane', 'armstrong', 'skydive', 'black', 'meteors', 'space', 'tail', 'outro'];
const GAP = { hook: 0.35, space: 0.8, tail: 0.5, outro: 0.35 };
const SAY = {};
{ let t = 0; for (const k of ORDER) { SAY[k] = t + (GAP[k] ?? 0.2); t = SAY[k] + VO[k].dur; } }
const wordT = (key, word, nth = 0) => { let n = 0; for (const [w, s] of VO[key].words) if (w.toLowerCase().replace(/[^a-z0-9']/g, '').startsWith(word) && n++ === nth) return SAY[key] + s; throw new Error(`no "${word}" in ${key}`); };
const endOf = (k) => SAY[k] + VO[k].dur;

const LM = [
  { key: 'tower', alt: 828, y: 828, t: wordT('tower', 'pass') + 0.35, sub: 'TALLEST BUILDING ON EARTH · 2,717 FT · 828 M', tick: true },
  { key: 'clouds', alt: 2000, y: 1000, t: wordT('sunrise', 'clouds') + 0.1, sub: 'ABOVE THE CLOUDS · SUNRISE COMES EARLY', tick: false },
  { key: 'halfair', alt: 5500, y: 1150, t: wordT('halfair', 'half') + 0.1, sub: 'HALF OF EARTH’S AIR IS BELOW · 18,000 FT · 5.5 KM', tick: true },
  { key: 'everest', alt: 8849, y: 1300, t: wordT('everest', 'everest') + 0.1, sub: 'MOUNT EVEREST · 29,032 FT · 8,849 M', tick: true },
  { key: 'plane', alt: 11278, y: 1450, t: wordT('plane', 'eye') + 0.1, sub: 'JET CRUISING ALTITUDE · 37,000 FT · 11.3 KM', tick: true },
  { key: 'armstrong', alt: 18900, y: 1600, t: wordT('armstrong', 'thousand') + 0.2, sub: 'ARMSTRONG LIMIT · WATER BOILS AT 98°F · 37°C', tick: true },
  { key: 'skydive', alt: 41422, y: 1750, t: wordT('skydive', 'highest') + 0.1, sub: 'RECORD SKYDIVE, 2014 · 135,890 FT · 41.4 KM', tick: true },
  { key: 'black', alt: 55000, y: 1840, t: wordT('black', 'black') + 0.1, sub: 'THE SKY TURNS BLACK · 34 MI · 55 KM', tick: false },
  { key: 'meteors', alt: 85300, y: 1960, t: SAY.meteors + 0.5, sub: 'COLDEST AIR ON EARTH · −130°F · −90°C · METEORS', tick: true },
  { key: 'space', alt: 100000, y: 2100, t: wordT('space', 'space') + 0.05, sub: 'KÁRMÁN LINE · SPACE · 62 MI · 100 KM', tick: true },
];
const L = Object.fromEntries(LM.map((l) => [l.key, l]));
const T_TL = SAY.goal + 0.4;                  // the time-lapse starts
const T_SPACE = L.space.t;
const T_END_TALK = endOf('outro');
const FADE = [T_END_TALK + 0.3, T_END_TALK + 1.0], END = FADE[1] + 0.15, DURATION = END + 3.6;

// ------------------------------------------------------------------ the climb (his own pace never changes)
const RUNG = 0.3, CYCLE = 1.2, T_CLIMB = 0.9;
const PHI_STOP = Math.ceil((T_SPACE + 0.7 - T_CLIMB) / CYCLE);
const phiAt = (t) => Math.min(Math.max(0, t - T_CLIMB) / CYCLE, PHI_STOP);
const yLocal = (t) => 2 * RUNG * phiAt(t);
const SET = (() => {
  const keys = [[T_TL, yLocal(T_TL)], ...LM.map((l) => [l.t, l.y])];
  return (t) => {
    if (t <= T_TL) return yLocal(t);
    if (t >= T_SPACE) return L.space.y + yLocal(t) - yLocal(T_SPACE);
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, y0] = keys[i], [t1, y1] = keys[i + 1];
      if (t > t1) continue;
      const v = (t - t0) / (t1 - t0), u = lerp(v, v * v * (3 - 2 * v), 0.85);
      if (i === 0) { const b = 8; return (y0 + b) * Math.pow((y1 + b) / (y0 + b), u) - b; }
      return lerp(y0, y1, u);
    }
    return L.space.y;
  };
})();
const ALT_OF_Y = (y) => {
  if (y <= L.tower.y) return Math.max(0, y);
  for (let i = 0; i < LM.length - 1; i++) { const a = LM[i], b = LM[i + 1]; if (y <= b.y) return a.alt * Math.pow(b.alt / a.alt, (y - a.y) / (b.y - a.y)); }
  return L.space.alt + (y - L.space.y);
};
const altAt = (t) => ALT_OF_Y(SET(t));
const hipY = (t) => 1.05 + SET(t);
function tempC(h) {
  const k = h / 1000;
  if (k < 11) return 15 - 6.5 * k; if (k < 20) return -56.5; if (k < 32) return -56.5 + (k - 20); if (k < 47) return -44.5 + 2.8 * (k - 32);
  if (k < 51) return -2.5; if (k < 71) return -2.5 - 2.8 * (k - 51); if (k < 85) return -58.5 - 2.0 * (k - 71); return -86.5 + 0.4 * Math.max(0, k - 90);
}

// ------------------------------------------------------------------ captions: word by word, numbers in both systems, keywords in gold
const NUMS = [['sixty-two miles', '62 miles (100 km)'], ['seventy below', '−70°F (−57°C)'],
  ['sixty-two thousand feet', '62,000 feet (19 km)'], ['seventeen thousand miles an hour', '17,000 mph (28,000 km/h)']];
const KEYWORDS = /^(space|rungs|tallest|clouds|sun|asleep|pop|everest|jet|pretzels|boil|skydive|halfway|shooting|stars|coldest|catch|sideways|drive|straight)$/i;
function buildCaptions() {
  const out = [];
  for (const key of ORDER) {
    if (key === 'hook') continue;                                   // the title card says it
    const at = SAY[key];
    const ws = [];
    for (const [w, s, e] of VO[key].words) { if (ws.length && /^[-']/.test(w)) { const p = ws[ws.length - 1]; p[0] += w; p[2] = e; } else ws.push([w, s, e, false]); }
    for (const [sayd, show] of NUMS) {
      const k = sayd.split(' ');
      for (let i = 0; i + k.length <= ws.length; i++) {
        if (k.every((x, j) => ws[i + j][0].toLowerCase().replace(/[^a-z-]/g, '') === x)) {
          const p = ws[i + k.length - 1][0].match(/[,.?!…]+$/)?.[0] ?? '';
          ws.splice(i, k.length, [show + p, ws[i][1], ws[i + k.length - 1][2], true]);
        }
      }
    }
    for (const w of ws) if (!w[3] && KEYWORDS.test(w[0].replace(/[^A-Za-z]/g, ''))) w[3] = true;
    const clauses = [[]];
    ws.forEach((w, i) => { clauses[clauses.length - 1].push(w); if (/[,.?!…:]$/.test(w[0]) && i < ws.length - 1) clauses.push([]); });
    const chunks = [];
    for (const c of clauses) { const n = Math.ceil(c.length / 4), per = Math.ceil(c.length / n); for (let i = 0; i < c.length; i += per) chunks.push(c.slice(i, i + per)); }
    chunks.forEach((c, i) => {
      const next = chunks[i + 1];
      out.push([at + c[0][1] - 0.04, at + (next ? Math.min(next[0][1], c[c.length - 1][2] + 0.45) : c[c.length - 1][2] + 0.35), c.map((x) => x[0]).join(' '), c.map((x) => [x[0].replace(/\.\.\.$/, '…'), at + x[1], x[3]])]);
    });
  }
  out.sort((x, y) => x[0] - y[0]);
  for (let i = 0; i < out.length - 1; i++) out[i][1] = Math.min(out[i][1], out[i + 1][0] - 0.01);
  return out;
}
const CAPTIONS = buildCaptions();
const fmtImp = (m) => (m < 30000 ? `${Math.round(m * FT).toLocaleString('en-US')} ft` : `${(m / MI).toFixed(1)} mi`);
const fmtMet = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

// ------------------------------------------------------------------ helpers
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function ctex(cv, repeat) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function signTexture(lines, o = {}) {
  const hh = o.h ?? 512, cv = canvas(1024, hh), c = cv.getContext('2d');
  c.fillStyle = o.bg ?? '#1d3b6e'; c.fillRect(0, 0, 1024, hh);
  c.strokeStyle = o.fg ?? '#ffffff'; c.lineWidth = 12; c.strokeRect(18, 18, 988, hh - 36);
  c.fillStyle = o.fg ?? '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  lines.forEach(([txt, size], i) => { c.font = `800 ${size}px Inter, Helvetica, Arial, sans-serif`; c.fillText(txt, 512, hh / 2 + (i - (lines.length - 1) / 2) * size * 1.18); });
  return ctex(cv);
}
const softDot = (inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)') => { const cv = canvas(64, 64), c = cv.getContext('2d'); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(0.25, mid); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return ctex(cv); };
const GLSL_NOISE = `
  float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h1(i), h1(i+vec2(1,0)), f.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }`;
const METEOR_AZ = 345;
// a debug camera from the page URL (?dbg={"pos":[x,y,z],"look":[x,y,z]})
const DBG = (() => { try { const q = typeof location !== 'undefined' && new URLSearchParams(location.search).get('dbg'); return q ? JSON.parse(q) : null; } catch (e) { return null; } })();

// ------------------------------------------------------------------ the far layer: planet and sky at true scale (metres, origin at the foot of the ladder)
async function buildFar() {
  const scene = new THREE.Scene();
  const U = { uSun: { value: SUN.clone() }, uTime: { value: 0 }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uExpo: { value: 1 }, uDeck: { value: 1 } };
  // ---- the sky, scattered at low resolution each frame (it is smooth), then drawn behind everything with a sharp sun
  const skyRT = new THREE.WebGLRenderTarget(216, 384, { type: THREE.HalfFloatType });
  const skyU = { uSun: U.uSun, uInvPV: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() } };
  const skyScene = new THREE.Scene(), skyCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const skyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: skyU, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform vec3 uSun, uCam; uniform mat4 uInvPV; varying vec2 vP;
      ${ATMO_GLSL}
      void main(){
        vec4 w = uInvPV * vec4(vP, 1.0, 1.0); vec3 d = normalize(w.xyz / w.w - uCam);
        vec3 o = uCam + vec3(0.0, A_RE, 0.0), tr;
        vec3 c = aScatter(o, d, 1e9, uSun, tr);
        float hc = length(o) - A_RE;
        c += vec3(0.004, 0.011, 0.034) * exp(-hc / 9000.0) * clamp(d.y * 0.6 + 0.55, 0.0, 1.0);
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  skyQuad.frustumCulled = false; skyScene.add(skyQuad);
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { tSky: { value: skyRT.texture }, uSun: U.uSun, uSunCol: U.uSunCol, uInvPV: skyU.uInvPV, uCam: skyU.uCam, uExpo: U.uExpo },
    depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vP, vUv; void main(){ vP = position.xy; vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: `uniform sampler2D tSky; uniform vec3 uSun, uSunCol, uCam; uniform mat4 uInvPV; uniform float uExpo; varying vec2 vP, vUv;
      void main(){
        vec4 w = uInvPV * vec4(vP, 1.0, 1.0); vec3 d = normalize(w.xyz / w.w - uCam);
        vec3 c = texture2D(tSky, vUv).rgb;
        float s = dot(d, uSun);
        c *= uExpo;
        c += uSunCol * (smoothstep(0.999955, 0.999985, s) * 60.0 + pow(max(s, 0.0), 1500.0) * 6.0 + pow(max(s, 0.0), 80.0) * 0.4);   // the disc and its glare
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  bg.frustumCulled = false; bg.renderOrder = -10; scene.add(bg);
  // ---- stars
  const r = new Rng(5), N = 3200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = r.float(-1, 1), a = r.float(0, Math.PI * 2), s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * 9e6, u * 9e6, Math.sin(a) * s * 9e6], i * 3);
    const b = Math.pow(r.next(), 4) * 1.6 + 0.12, tint = r.next();
    col.set([b * (tint < 0.15 ? 1.0 : 0.85), b * 0.9, b * (tint > 0.85 ? 0.75 : 1.05)], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const starM = new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const stars = new THREE.Points(sg, starM); stars.frustumCulled = false; stars.renderOrder = -9; scene.add(stars);
  // ---- the Earth: a cap round Dubai, fine in the middle, out past the horizon from 100 km; NASA day, night and cloud maps
  const ld = new THREE.TextureLoader();
  const [tDay, tNight, tCloud] = await Promise.all(['/assets/earth/world.topo.bathy.200410.3x5400x2700.jpg', '/assets/earth/BlackMarble_2016_01deg.jpg', '/assets/earth/cloud_combined_2048.jpg'].map((u) => ld.loadAsync(u)));
  for (const t of [tDay, tNight]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; }
  tCloud.anisotropy = 8;
  const NR = 230, NA = 300, th1 = 0.36, verts = [], uvs = [], idx = [];
  for (let i = 0; i <= NR; i++) {
    const th = i === 0 ? 0 : (60 / R_E) * Math.pow(th1 / (60 / R_E), (i - 1) / (NR - 1));
    for (let j = 0; j < NA; j++) {
      const a = j / NA * Math.PI * 2, east = Math.cos(a), south = Math.sin(a);
      verts.push(R_E * Math.sin(th) * east, R_E * Math.cos(th) - R_E, R_E * Math.sin(th) * south);
      const b = Math.atan2(east, -south);                              // bearing from north
      const lat = Math.asin(Math.sin(LAT0) * Math.cos(th) + Math.cos(LAT0) * Math.sin(th) * Math.cos(b));
      const lon = LON0 + Math.atan2(Math.sin(b) * Math.sin(th) * Math.cos(LAT0), Math.cos(th) - Math.sin(LAT0) * Math.sin(lat));
      uvs.push((lon / DEG + 180) / 360, (lat / DEG + 90) / 180);
    }
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a = i * NA + j, b = i * NA + (j + 1) % NA, c = (i + 1) * NA + j, d = (i + 1) * NA + (j + 1) % NA; idx.push(a, b, c, b, d, c); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); eg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); eg.setIndex(idx);
  const earth = new THREE.Mesh(eg, new THREE.ShaderMaterial({
    uniforms: { uSun: U.uSun, uTime: U.uTime, uExpo: U.uExpo, tDay: { value: tDay }, tNight: { value: tNight }, tCloud: { value: tCloud } },
    vertexShader: `uniform vec3 uSun; varying vec2 vUv; varying vec3 vIn, vTr, vSunL, vW, vN;
      ${ATMO_GLSL}
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vec3 P = w.xyz + vec3(0.0, A_RE, 0.0), O = cameraPosition + vec3(0.0, A_RE, 0.0);
        vec3 d = P - O; float Ld = length(d); d /= Ld;
        vec3 tr; vIn = aScatter(O, d, Ld * 0.999, uSun, tr); vTr = tr;
        vN = normalize(P); vSunL = aSunlight(P + vN * 2.0, uSun);
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `uniform sampler2D tDay, tNight, tCloud; uniform vec3 uSun; uniform float uTime, uExpo; varying vec2 vUv; varying vec3 vIn, vTr, vSunL, vW, vN;
      ${GLSL_NOISE}
      void main(){
        vec3 albedo = texture2D(tDay, vUv).rgb;
        float water = smoothstep(0.02, 0.06, albedo.b - albedo.r);
        // up close the satellite map is soft: add city blocks, roads and dunes near the eye
        float near = exp(-length(vW - cameraPosition) / 25000.0);
        vec2 p = vW.xz; float r = length(p);
        float town = smoothstep(16000.0, 3000.0, r) * (1.0 - water);
        vec2 bq = p / (85.0 + 40.0 * h1(floor(p / 600.0))); vec2 bf = fract(bq);
        float street = clamp(step(bf.x, 0.12) + step(bf.y, 0.12), 0.0, 1.0);
        vec3 tc = mix(vec3(0.62, 0.58, 0.52) * (0.7 + 0.5 * h1(floor(p / 24.0))), vec3(0.22, 0.22, 0.24), street);
        vec3 dune = albedo * (0.85 + 0.3 * fbm(p / 900.0));
        albedo = mix(albedo, mix(albedo, mix(dune, tc, town), 0.8), near * (1.0 - water));
        float cl = texture2D(tCloud, vUv + vec2(uTime * 0.000004, 0.0)).r;
        cl = smoothstep(0.25, 0.85, cl) * smoothstep(2500.0, 9000.0, cameraPosition.y);
        float ndl = dot(vN, uSun);
        vec3 sun = vSunL * max(ndl, 0.0) * 7.0;
        vec3 amb = vec3(0.10, 0.13, 0.20) * smoothstep(-0.12, 0.05, ndl) * 0.6;
        vec3 col = albedo * (sun + amb);
        vec3 V = normalize(cameraPosition - vW);
        col += water * vSunL * pow(max(dot(reflect(-uSun, vN), V), 0.0), 120.0) * 6.0;          // sun glint on the sea
        col = mix(col, vec3(1.0) * (sun * 0.95 + amb * 1.2), cl * 0.9);
        float night = smoothstep(0.035, -0.06, ndl);                                          // city lights on the night side
        vec3 lights = texture2D(tNight, vUv).rgb; lights = pow(lights, vec3(1.8)) * vec3(1.0, 0.78, 0.48) * 2.2;
        lights += town * near * step(0.86, h1(floor(p / 18.0))) * vec3(1.0, 0.8, 0.55) * 0.6;
        col += lights * night * (1.0 - cl * 0.8);
        col = (col * vTr + vIn) * uExpo;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  earth.frustumCulled = false; scene.add(earth);
  // ---- the cloud deck at 2 km: a sea of cloud tops, lit by the low sun, fading out into the distance
  const DECK = 2000, dg = new THREE.BufferGeometry(), dv = [], di = [];
  { const NR2 = 120, NA2 = 200, t1 = 0.06;
    for (let i = 0; i <= NR2; i++) { const th = i === 0 ? 0 : (200 / R_E) * Math.pow(t1 / (200 / R_E), (i - 1) / (NR2 - 1));
      for (let j = 0; j < NA2; j++) { const a = j / NA2 * Math.PI * 2; dv.push((R_E + DECK) * Math.sin(th) * Math.cos(a), (R_E + DECK) * Math.cos(th) - R_E, (R_E + DECK) * Math.sin(th) * Math.sin(a)); } }
    for (let i = 0; i < NR2; i++) for (let j = 0; j < NA2; j++) { const a = i * NA2 + j, b = i * NA2 + (j + 1) % NA2, c = (i + 1) * NA2 + j, d = (i + 1) * NA2 + (j + 1) % NA2; di.push(a, b, c, b, d, c); } }
  dg.setAttribute('position', new THREE.Float32BufferAttribute(dv, 3)); dg.setIndex(di);
  const deck = new THREE.Mesh(dg, new THREE.ShaderMaterial({
    uniforms: { uSun: U.uSun, uTime: U.uTime, uExpo: U.uExpo, uDeck: U.uDeck }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `uniform vec3 uSun; varying vec3 vIn, vTr, vSunL, vW, vN;
      ${ATMO_GLSL}
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vec3 P = w.xyz + vec3(0.0, A_RE, 0.0), O = cameraPosition + vec3(0.0, A_RE, 0.0);
        vec3 d = P - O; float Ld = length(d); d /= Ld;
        vec3 tr; vIn = aScatter(O, d, Ld * 0.999, uSun, tr); vTr = tr;
        vN = normalize(P); vSunL = aSunlight(P + vN * 50.0, uSun);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `uniform vec3 uSun; uniform float uTime, uExpo, uDeck; varying vec3 vIn, vTr, vSunL, vW, vN;
      ${GLSL_NOISE}
      void main(){
        vec2 p = vW.xz + vec2(uTime * 6.0, 0.0);
        float big = fbm(p / 9000.0), mid = fbm(p / 1800.0 + 3.0), fine = fbm(p / 300.0 + 7.0);
        float dens = big * 0.55 + mid * 0.35 + fine * 0.18;
        float cov = smoothstep(0.42, 0.62, dens);
        if (cov < 0.01) discard;
        float puff = smoothstep(0.42, 0.85, dens);                       // thicker cores bulge up and catch more light
        vec3 V = normalize(cameraPosition - vW);
        float above = step(0.0, dot(V, vN));                             // seen from above: the lit tops; from below: grey bellies
        float lit = mix(0.35, 1.0, puff) * (0.65 + 0.35 * fine);
        vec3 tops = vSunL * 7.0 * (0.25 + 0.75 * lit) + vec3(0.05, 0.06, 0.09) * (0.6 + 0.4 * lit);
        vec3 belly = vec3(0.08, 0.09, 0.12) * (0.6 + 0.4 * fine) + vSunL * 0.6;
        vec3 col = mix(belly, tops, above);
        // a bright rim where the sun shines through thin edges (looking toward the sun)
        col += vSunL * pow(max(dot(-V, uSun), 0.0), 8.0) * (1.0 - cov) * 6.0 * above;
        col = (col * vTr + vIn) * uExpo;
        float fade = exp(-length(vW.xz) / 160000.0);
        gl_FragColor = vec4(col, cov * 0.97 * fade * uDeck);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  deck.frustumCulled = false; deck.renderOrder = 1; scene.add(deck);
  // ---- shooting stars round the mesosphere, in the cone the camera looks into at that moment
  const meteors = [], mr = new Rng(77);
  const mTex = (() => { const cv = canvas(64, 256), c = cv.getContext('2d'); const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(150,220,255,0.5)'); g.addColorStop(0.96, 'rgba(255,255,235,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 256); const e = c.createLinearGradient(0, 0, 64, 0); e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(0.5, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = e; c.fillRect(0, 0, 64, 256); return ctex(cv); })();
  for (let i = 0; i < 34; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: mTex, color: new THREE.Color(3, 3, 3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
    m.visible = false; m.frustumCulled = false; scene.add(m);
    const a = (METEOR_AZ + mr.float(-11, 11)) * DEG, d = mr.float(14e3, 40e3), el = mr.float(12, 50) * DEG;
    const dur = mr.float(0.45, 0.85), v = mr.float(18e3, 30e3);
    const side = V(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(mr.float(-0.9, 0.9));
    const dir = V(0, -1, 0).add(side).normalize();
    const mid = V(Math.sin(a) * d, 86e3 + d * Math.tan(el), Math.cos(a) * d);
    meteors.push({ m, t0: L.meteors.t - 2.4 + i * 0.2 + mr.float(-0.08, 0.08), dur, p0: mid.clone().addScaledVector(dir, -v * dur * 0.5), dir, v, len: mr.float(4e3, 8e3) });
  }
  // ---- the space station: a bright point crossing the sky 300 km higher still
  const iss = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot('rgba(255,255,255,1)', 'rgba(255,240,210,0.8)'), color: new THREE.Color(4, 4, 4), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  iss.visible = false; scene.add(iss);
  const cam = new THREE.PerspectiveCamera(50, W / H, 20, 2e7);
  return { scene, U, skyU, skyRT, skyScene, skyCam, starM, earth, meteors, iss, cam };
}

// ------------------------------------------------------------------ the climber: a suited figure on two-bone arms and legs, rounded parts
function buildClimber(env) {
  const g = new THREE.Group();
  const suit = new THREE.MeshPhysicalMaterial({ color: '#efece6', roughness: 0.72, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color('#ffffff') });
  const dark = new THREE.MeshStandardMaterial({ color: '#3d424b', roughness: 0.5, metalness: 0.3 });
  const orange = new THREE.MeshStandardMaterial({ color: '#f07a24', roughness: 0.55 });
  const glove = new THREE.MeshStandardMaterial({ color: '#33363d', roughness: 0.65 });
  const visor = new THREE.MeshPhysicalMaterial({ color: '#d9a640', metalness: 1, roughness: 0.08, clearcoat: 1, envMap: env, envMapIntensity: 1.6 });
  const metal = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.9, roughness: 0.25, envMap: env });
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.3), toneMapped: false });
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const rb = (w, h, d, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.1, h / 2.1, d / 2.1));
  const unitRB = (w, d) => new RoundedBoxGeometry(w, 1, d, 3, Math.min(w, d) * 0.45);
  const P = {
    pelvis: add(rb(0.36, 0.22, 0.27, 0.07), suit),
    torso: add(rb(0.47, 0.54, 0.31, 0.1), suit),
    chest: add(rb(0.3, 0.15, 0.07, 0.025), dark),
    pack: add(rb(0.42, 0.52, 0.2, 0.05), dark),
    packTop: add(rb(0.3, 0.06, 0.12, 0.02), metal),
    led: add(new THREE.SphereGeometry(0.018, 10, 8), led),
    stripe: add(rb(0.48, 0.05, 0.32, 0.02), orange),
    helmet: add(new THREE.SphereGeometry(0.2, 32, 24), suit),
    visor: add(new THREE.SphereGeometry(0.183, 32, 24, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.26, Math.PI * 0.44), visor),
    ring: add(new THREE.CylinderGeometry(0.165, 0.175, 0.07, 24), metal),
  };
  for (const s of ['L', 'R']) {
    P['upArm' + s] = add(unitRB(0.15, 0.15), suit); P['loArm' + s] = add(unitRB(0.135, 0.135), suit); P['hand' + s] = add(rb(0.11, 0.13, 0.09, 0.03), glove);
    P['thigh' + s] = add(unitRB(0.185, 0.185), suit); P['shin' + s] = add(unitRB(0.165, 0.165), suit); P['boot' + s] = add(rb(0.16, 0.13, 0.28, 0.04), dark);
    P['cuff' + s] = add(unitRB(0.15, 0.15), orange);
  }
  return { g, P, led };
}
const Y_AX = V(0, 1, 0);
function seg(m, a, b, extra = 0) { const d = b.clone().sub(a), len = d.length(); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y_AX, d.normalize()); m.scale.y = len + extra; }
function ik(A, T, l1, l2, pole) {
  const d = T.clone().sub(A); let len = d.length(); const dir = d.clone().divideScalar(len);
  len = Math.min(len, (l1 + l2) * 0.999);
  const a = (l1 * l1 - l2 * l2 + len * len) / (2 * len), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  return { mid: A.clone().addScaledVector(dir, a).addScaledVector(pp, h), end: A.clone().addScaledVector(dir, len) };
}

// ------------------------------------------------------------------ the near layer: the set
const TOWER_POS = V(-150, 0, -220);
const PLANE_Z = 70, PLANE_V = 95;
const planeX = (t) => (t - L.plane.t) * PLANE_V - 10;
const BALLOON_POS = V(-364, L.skydive.y + 5, -264);
function buildNear(st, env) {
  const scene = new THREE.Scene();
  scene.environment = env; scene.environmentIntensity = 0.35;
  scene.fog = new THREE.FogExp2('#6a5a58', 0.0004);
  const hemi = new THREE.HemisphereLight('#9fb4dd', '#4a4038', 0.8);
  const sun = new THREE.DirectionalLight('#ffd2a0', 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 0.5, far: 40 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  const rim = new THREE.DirectionalLight('#9ec4ff', 0);           // a cool kicker from behind
  scene.add(hemi, sun, sun.target, rim, rim.target);
  Object.assign(st, { hemi, sun, rim });
  const r = new Rng(12);
  const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75 }, o));
  const add = (geo, mat, x, y, z, rot, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rot) m.rotation.set(...rot); parent.add(m); return m; };

  // ---- the city at dawn: glass towers with lit windows (worked out from world position, so every building differs)
  const city = new THREE.Group(); scene.add(city); st.city = city;
  const winU = { uNight: { value: 1 } };
  const glass = (base) => {
    const m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.22, metalness: 0.55, envMap: env, envMapIntensity: 0.6 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = winU.uNight;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec4 wpp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nwpp = instanceMatrix * wpp;\n#endif\nvWP = (modelMatrix * wpp).xyz;\nvec3 wnn = objectNormal;\n#ifdef USE_INSTANCING\nwnn = mat3(instanceMatrix) * wnn;\n#endif\nvWN = normalize(mat3(modelMatrix) * wnn);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight; varying vec3 vWP; varying vec3 vWN;\nfloat wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          { vec2 q = abs(vWN.x) > 0.5 ? vWP.zy : vWP.xy; vec2 cell = floor(q / vec2(2.6, 3.4)); vec2 f = fract(q / vec2(2.6, 3.4));
            float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.22, f.y) * step(f.y, 0.78) * (1.0 - step(0.9, abs(vWN.y)));
            float on = step(0.8, wh(cell + floor(vWP.xz / 40.0) * 3.1));
            totalEmissiveRadiance += vec3(1.0, 0.72, 0.42) * win * on * 1.5 * uNight; }`);
    };
    return m;
  };
  {
    const geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.04).translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(geo, glass('#566577'), 950);
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), cc = new THREE.Color(); let n = 0;
    for (let i = 0; i < 6000 && n < 950; i++) {
      const a = r.float(0, Math.PI * 2), d = 75 + Math.pow(r.next(), 1.5) * 2600, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.hypot(x - TOWER_POS.x, z - TOWER_POS.z) < 80) continue;
      if (d < 70 && Math.abs(Math.atan2(x, z) - 2.4) < 0.5) continue;
      const big = Math.exp(-d / 900);
      const w = r.float(18, 38), dd = r.float(18, 38), h = (r.float(20, 60) + big * r.float(0, 260) * (r.chance(0.35) ? 1 : 0.3)) * lerp(0.35, 1, smooth(90, 260, d));
      q.setFromAxisAngle(Y_AX, r.pick([0, Math.PI / 4, 0.3, 0]));
      M4.compose(V(x, 0, z), q, V(w, h, dd)); im.setMatrixAt(n, M4); im.setColorAt(n, cc.set(r.pick(['#5a6a7d', '#6e7f90', '#8a8f96', '#4c5866', '#9aa3ab', '#b9b2a3']))); n++;
    }
    im.count = n; im.receiveShadow = true; city.add(im);
  }
  // the ground: a plaza, then roads and lots, edging into the satellite map
  {
    const g = new THREE.CircleGeometry(3000, 128).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { uAmb: { value: new THREE.Color(0.1, 0.1, 0.12) }, uNight: winU.uNight, uFogC: { value: new THREE.Color() }, uFogD: { value: 0 } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec3 uAmb, uFogC; uniform float uNight, uFogD; varying vec3 vW;
        ${GLSL_NOISE}
        void main(){
          vec2 p = vW.xz; float r = length(p);
          vec2 bf = fract(p / 110.0);
          float road = clamp(step(bf.x, 0.14) + step(bf.y, 0.14), 0.0, 1.0);
          vec3 lot = mix(vec3(0.58, 0.52, 0.44), vec3(0.42, 0.42, 0.42), step(0.5, h1(floor(p / 110.0))));
          vec3 c = mix(lot, vec3(0.16, 0.16, 0.17), road);
          c = mix(c, vec3(0.62, 0.6, 0.57) * (0.9 + 0.1 * h1(floor(p / 1.2))), smoothstep(48.0, 44.0, r));        // the plaza
          vec2 lp = fract(p / 36.0) - 0.5; float pool = road * exp(-dot(lp, lp) * 14.0);                          // pools of streetlight
          vec3 col = c * uAmb + c * vec3(1.0, 0.62, 0.3) * pool * 0.9 * uNight + c * vec3(1.0, 0.85, 0.65) * 1.2 * exp(-r / 6.0);
          float fd = length(vW - cameraPosition) * uFogD; col = mix(col, uFogC, 1.0 - exp(-fd * fd));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    city.add(m); st.groundU = m.material.uniforms;
  }
  // streetlights: a field of warm points along the roads; car lights moving on the avenues
  {
    const pts = [];
    for (let x = -2600; x <= 2600; x += 36) for (const zz of [-1, 1]) for (let k = -24; k <= 24; k++) { const z = k * 110 + zz * 7; if (Math.hypot(x, z) < 2700 && Math.hypot(x, z) > 50 && r.chance(0.55)) pts.push(x, 6, z); }
    for (let z = -2600; z <= 2600; z += 36) for (const xx of [-1, 1]) for (let k = -24; k <= 24; k++) { const x = k * 110 + xx * 7; if (Math.hypot(x, z) < 2700 && Math.hypot(x, z) > 50 && r.chance(0.55)) pts.push(x, 6, z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lm = new THREE.PointsMaterial({ map: softDot('rgba(255,230,190,1)', 'rgba(255,170,90,0.5)'), color: new THREE.Color(2.6, 1.7, 0.9), size: 2.2, sizeAttenuation: false, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    const p = new THREE.Points(g, lm); p.frustumCulled = false; city.add(p); st.streetM = lm;
    const cars = new THREE.BufferGeometry(), NC = 900;
    cars.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NC * 3), 3)); cars.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(NC * 3), 3));
    const cm = new THREE.PointsMaterial({ map: softDot(), size: 2.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    const cp = new THREE.Points(cars, cm); cp.frustumCulled = false; city.add(cp);
    st.cars = { g: cars, list: Array.from({ length: NC }, () => ({ axis: r.chance(0.5), lane: r.int(-23, 23) * 110 + r.pick([-3, 3]), s0: r.float(-2600, 2600), v: r.float(10, 18) * r.pick([-1, 1]) })) };
  }
  // the tallest building: three wings stepping back round a core, a spire, aircraft beacons
  const tower = new THREE.Group(); tower.position.copy(TOWER_POS); city.add(tower); st.tower = tower;
  {
    const gm = glass('#a9b9c9');
    const tiers = [[0, 160, 40], [160, 300, 34], [300, 420, 27], [420, 520, 21], [520, 590, 15], [590, 640, 10]];
    for (const [y0, y1, w] of tiers) for (let k = 0; k < 3; k++) {
      const len = w * (1 - 0.12 * k) * 1.2;
      const wing = new THREE.Mesh(new RoundedBoxGeometry(len, y1 - y0, w * 0.5, 2, 1.5).translate(len / 2, (y1 - y0) / 2 + y0, 0), gm);
      wing.rotation.y = k * Math.PI * 2 / 3; tower.add(wing);
    }
    const core = new THREE.Mesh(new THREE.CylinderGeometry(9, 16, 640, 12), gm); core.position.y = 320; tower.add(core);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 6, 188, 10), std('#d8dee6', { metalness: 0.85, roughness: 0.25, envMap: env })); spire.position.y = 734; tower.add(spire);
    st.beacons = [640, 700, 828].map((y) => { const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: new THREE.Color(5, 0.4, 0.3), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); b.position.y = y; b.scale.setScalar(y === 828 ? 6 : 4.5); tower.add(b); return b; });
  }
  // ---- the plaza: crowd with phones up, a launch platform, uplights on the ladder
  const ppl = buildPeople({ max: 220, seed: 4 }); city.add(ppl.group); st.ppl = ppl;
  for (let i = 0; i < 160; i++) {
    const a = r.float(0, Math.PI * 2), d = r.float(4.4, 30), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(Math.atan2(x, z) - 2.4) < 0.45 && d < 22) continue;              // a lane for the camera
    ppl.add({ x, z, h: Math.atan2(-x, -z), poses: [[0, r.pick(['phone', 'lookUp', 'phone', 'point', 'phone', 'lookUp'])]], phone: () => true });
  }
  add(new THREE.CylinderGeometry(3.2, 3.6, 0.5, 40), std('#2c3036', { metalness: 0.6, roughness: 0.4 }), 0, 0.25, 0, null, city);
  add(new THREE.TorusGeometry(3.25, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2.6), toneMapped: false }), 0, 0.52, 0, [Math.PI / 2, 0, 0], city);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), new THREE.MeshStandardMaterial({ map: signTexture([['LADDER TO SPACE', 108], ['62 MI · 100 KM · STRAIGHT UP', 62]], { bg: '#f4c400', fg: '#1a1a1a' }), emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.6 }));
  sign.material.emissiveMap = sign.material.map;
  sign.position.set(-5.4, 2.4, 3.2); sign.rotation.y = 2.2; city.add(sign);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, x = Math.cos(a) * 2.6, z = Math.sin(a) * 2.6;
    const sp = new THREE.SpotLight('#ffe2b8', 900, 260, 0.16, 0.6, 1.6); sp.position.set(x, 0.6, z); sp.target.position.set(0, 120, 0); city.add(sp, sp.target);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 160, 24, 1, true).translate(0, -80, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.42, 0.32), transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    beam.position.set(x, 0.6, z); beam.lookAt(0, 120, 0); beam.rotateX(-Math.PI / 2); city.add(beam);
  }

  // ---- the ladder: rounded rails to past the Kármán line, rungs near him, a blinking marker every 30 m
  const railM = std('#aeb5bd', { metalness: 0.55, roughness: 0.5, envMap: env, envMapIntensity: 0.5 });
  for (const x of [-0.28, 0.28]) { const m = add(new RoundedBoxGeometry(0.06, 2400, 0.09, 2, 0.02), railM, x, 1200, 0); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
  const rungs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.021, 0.021, 0.56, 12).rotateZ(Math.PI / 2), railM, 96);
  rungs.castShadow = true; rungs.receiveShadow = true; rungs.frustumCulled = false; scene.add(rungs); st.rungs = rungs;
  {
    const pts = []; for (let y = 30; y < 2400; y += 30) pts.push(0.32, y, 0.02);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.PointsMaterial({ map: softDot(), color: new THREE.Color(4, 0.5, 0.3), size: 0.35, sizeAttenuation: true, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); st.markerM = m;
  }
  const PLQ = { tower: ['828 M · 2,717 FT', 'TALLEST BUILDING'], halfair: ['5.5 KM · 18,000 FT', 'HALF THE AIR BELOW'], everest: ['8,849 M · 29,032 FT', 'MT EVEREST'], plane: ['11.3 KM · 37,000 FT', 'JET CRUISE'], armstrong: ['18.9 KM · 62,000 FT', 'ARMSTRONG LIMIT'], skydive: ['41.4 KM · 135,890 FT', 'RECORD SKYDIVE'], meteors: ['85 KM · 53 MI', 'COLDEST AIR'] };
  for (const [k, [a, b]] of Object.entries(PLQ)) {
    const tx = signTexture([[a, 84], [b, 92]], { bg: '#1f2a36', fg: '#f6efe0' });
    add(new THREE.PlaneGeometry(0.64, 0.32), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.18, emissiveMap: tx }), 0.66, L[k].y + 1.45, 0.02, [0, -0.5, 0]);
    add(new THREE.BoxGeometry(0.34, 0.04, 0.04), railM, 0.46, L[k].y + 1.45, 0.0);
  }
  const hoopY = L.space.y + 1.3;
  st.hoop = add(new THREE.TorusGeometry(1.25, 0.045, 10, 72), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 2.2, 3.2), toneMapped: false }), 0, hoopY, -0.2, [Math.PI / 2, 0, 0]);
  add(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: signTexture([['SPACE', 170], ['KÁRMÁN LINE · 100 KM · 62 MI', 58]], { bg: '#0b1626', fg: '#bfe9ff' }), color: new THREE.Color(1.4, 1.4, 1.4), toneMapped: false }), 0.98, hoopY + 0.45, 0.04, [0, -0.35, 0]);

  // ---- the climber
  st.cl = buildClimber(env); scene.add(st.cl.g);

  // ---- the cloud layer he climbs through
  const ctx3 = [0, 1, 2, 3].map((k) => makeCloudTexture(40 + k));
  st.clouds = [];
  for (let i = 0; i < 120; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx3[i % 4], transparent: true, depthWrite: false, opacity: 0.95, fog: false }));
    const a = r.float(0, Math.PI * 2), d = i < 60 ? r.float(6, 70) : r.float(70, 260);
    s.position.set(Math.cos(a) * d, L.clouds.y + r.float(-22, 8), Math.sin(a) * d);
    const sc = i < 60 ? r.float(20, 60) : r.float(60, 140); s.scale.set(sc, sc * 0.4, 1);
    s.userData.k = r.float(0.75, 1.1);
    scene.add(s); st.clouds.push(s);
  }
  // ---- the jet: lit cabin, nav lights, strobe, contrails
  const plane = buildPlane(); scene.add(plane); st.plane = plane;
  {
    const win = new THREE.Mesh(new THREE.BoxGeometry(24, 0.32, 4.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 1.1), toneMapped: false }));
    win.position.set(1, 0.55, 0); plane.add(win);
    const mk = (c, x, z) => { const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: c, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); b.position.set(x, -0.4, z); b.scale.setScalar(5); plane.add(b); return b; };
    st.nav = [mk(new THREE.Color(6, 0.3, 0.2), -4, -17.5), mk(new THREE.Color(0.3, 6, 0.6), -4, 17.5), mk(new THREE.Color(8, 8, 8), -20, 0)];
  }
  const puff = softDot('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.5)');
  st.trail = [];
  for (let i = 0; i < 170; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false })); scene.add(s); st.trail.push(s); }
  // ---- the record balloon at 41 km, a tiny jumper under it
  const bal = new THREE.Group(); bal.position.copy(BALLOON_POS); scene.add(bal); st.balloon = bal;
  {
    const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push(new THREE.Vector2(Math.sin(Math.PI * Math.pow(u, 0.8)) * 26 * (0.35 + 0.65 * u), u * 70)); }
    bal.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 40), new THREE.MeshPhysicalMaterial({ color: '#f4f4f0', roughness: 0.3, sheen: 0.5, transparent: true, opacity: 0.9, side: THREE.DoubleSide })));
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 34), std('#999')); line.position.y = -17; bal.add(line);
    const tiny = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.5), std('#f0f0ea')); tiny.position.y = -35; bal.add(tiny);
  }
  // ---- specks round the camera: dust low down, droplets in the cloud, ice crystals higher (they sell the speed)
  {
    const NS = 700, a = new Float32Array(NS * 3), sp2 = new Rng(9);
    for (let i = 0; i < NS; i++) a.set([sp2.float(-12, 12), sp2.float(0, 40), sp2.float(-12, 12)], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const m = new THREE.PointsMaterial({ map: softDot(), color: new THREE.Color(1.6, 1.5, 1.4), size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p);
    st.specks = { p, m, base: a.slice(), arr: a };
  }
  const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 30000);
  return { scene, cam };
}

// ------------------------------------------------------------------ the camera
// keys: angle round the ladder (deg; x = sin, z = cos), height above his hips, distance, the height the camera
// aims at, vertical fov, and a lean of the aim toward a landmark
const KEYS = (() => {
  const k = (t, az, y, d, look, fov, aim = 0) => ({ t, az, y, d, look, fov, aim });
  const sunBack = SUN_AZC + 180;                         // the camera opposite the sun: he's backlit by it
  return [
    k(T_TL - 0.6, 205, -2.0, 4.2, 1.5, 54),
    k(SAY.tower, 200, -1.4, 3.6, 1.2, 50),
    k(L.tower.t - 0.7, 46, 0.5, 26, -4.5, 46, 0.22),     // pulled right back: him, small, level with the tip of the tower
    k(L.tower.t + 0.6, 48, 0.8, 24, -4, 46, 0),
    k(L.clouds.t - 0.3, sunBack - 18, 1.2, 11, 0.4, 28),
    k(L.clouds.t + 2.0, sunBack - 4, 1.2, 11, 0.5, 26),     // silhouette: the rising sun beside his helmet
    k(L.halfair.t - 0.4, sunBack + 40, 3.0, 2.8, -2.6, 66), // looking down past his boots
    k(L.halfair.t + 1.4, sunBack + 50, 3.4, 2.6, -3.0, 70),
    k(L.everest.t + 0.4, 120, 0.4, 5.2, 0.1, 40),          // profile, the horizon behind
    k(SAY.plane + 0.2, 175, 0.5, 5.4, 0.2, 40),
    k(L.plane.t + 0.6, 182, 0.4, 5.8, 0.0, 38, 0.35),      // the jet crosses behind him
    k(endOf('plane'), 196, 0.6, 5.2, 0.2, 40, 0),
    k(L.armstrong.t - 0.6, 52, 0.9, 3.1, 0.75, 38),         // close on the helmet, three-quarter front, past the rail
    k(L.armstrong.t + 1.4, 58, 0.9, 2.8, 0.8, 36),
    k(L.skydive.t - 0.6, 52, 0.4, 5.4, 0.3, 36, 0),
    k(L.skydive.t + 0.5, 46, 0.4, 5.6, 0.3, 34, 0.35),      // the balloon off his shoulder
    k(endOf('skydive') + 0.1, 60, 0.2, 5.0, 0.6, 40, 0),
    k(L.black.t + 0.2, 150, -2.6, 4.2, 2.4, 60),            // looking up into a black sky
    k(L.meteors.t + 1.0, 162, -1.9, 4.8, 1.6, 56),
    k(L.meteors.t + 3.6, 170, -1.4, 5.0, 1.0, 52),
    k(T_SPACE - 0.4, 120, 1.6, 4.8, -0.6, 46),
    k(T_SPACE + 0.4, 90, 2.4, 4.6, -1.0, 46),
    k(SAY.tail + 1.2, SUN_AZC + 150, 1.4, 8.5, -0.2, 42),   // toward the sunlit limb, the sunrise just off the frame
    k(SAY.outro, SUN_AZC + 162, 2.0, 16, 0.2, 40),
    k(DURATION, SUN_AZC + 172, 3.0, 30, 0.6, 38),
  ];
})();
function camKeys(t) {
  const n = KEYS.length;
  if (t <= KEYS[0].t) return { ...KEYS[0] };
  if (t >= KEYS[n - 1].t) return { ...KEYS[n - 1] };
  let i = 0; while (t > KEYS[i + 1].t) i++;
  const a = KEYS[Math.max(0, i - 1)], b = KEYS[i], c = KEYS[i + 1], d = KEYS[Math.min(n - 1, i + 2)];
  const u = (t - b.t) / (c.t - b.t), u2 = u * u, u3 = u2 * u, out = {};
  out.aim = lerp(b.aim, c.aim, u2 * (3 - 2 * u));
  for (const f of ['az', 'y', 'd', 'look', 'fov']) {
    const m1 = (c[f] - a[f]) / Math.max(0.01, c.t - a.t) * (c.t - b.t) * 0.5, m2 = (d[f] - b[f]) / Math.max(0.01, d.t - b.t) * (c.t - b.t) * 0.5;
    out[f] = (2 * u3 - 3 * u2 + 1) * b[f] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * c[f] + (u3 - u2) * m2;
  }
  return out;
}
// impacts: a trauma value that decays, shaking rotation at ~18 Hz
const SHAKES = [[L.plane.t + 0.05, 0.75], [T_SPACE, 0.6]];
const trauma = (t) => SHAKES.reduce((s, [t0, a]) => s + (t >= t0 ? a * Math.max(0, 1 - (t - t0) / 0.9) : 0), 0);
function camAt(t) {
  const hy = hipY(t), k = camKeys(t), az = k.az * DEG;
  // the dolly zoom as he arrives: the lens goes long while the camera backs off, so he holds size and space swells behind him
  const dz = smooth(T_SPACE + 0.15, T_SPACE + 2.4, t) * (1 - smooth(SAY.tail + 0.6, SAY.tail + 2.0, t));
  const fov = lerp(k.fov, 24, dz), dist = k.d * Math.tan(k.fov * DEG / 2) / Math.tan(fov * DEG / 2);
  let pos = V(Math.sin(az) * dist, hy + k.y, -0.38 + Math.cos(az) * dist), look = V(0, hy + k.look, -0.38);
  if (k.aim > 0) {
    const targets = [[L.tower.t, TOWER_POS.clone().setY(800)], [L.plane.t, V(planeX(t), L.plane.y + 0.5, PLANE_Z)], [L.skydive.t, BALLOON_POS.clone().add(V(0, 20, 0))]];
    let best = targets[0]; for (const tg of targets) if (Math.abs(t - tg[0]) < Math.abs(t - best[0])) best = tg;
    const d0 = look.clone().sub(pos).normalize(), d1 = best[1].clone().sub(pos).normalize();
    look = pos.clone().addScaledVector(d0.lerp(d1, clamp(k.aim)).normalize(), 10);
  }
  // the opening: down in the plaza among the crowd, looking up the ladder; then the crane up to him
  const street = { pos: V(-6.0 + 0.35 * t, 2.3 + 0.3 * t, 10.5 - 0.45 * t), look: V(0, 3.6 + 1.3 * t, 0) };
  const w = smooth(1.8, T_TL + 0.3, t);
  pos = street.pos.lerp(pos, w); look = street.look.lerp(look, w);
  const fovF = lerp(60, fov, w);
  // handheld: slow coherent drift (a few cm, a fraction of a degree); impacts on top
  const tr = Math.min(1, trauma(t)), sh = tr * tr;
  pos.add(V(fbm1(t * 0.35 + 3.1) * 0.03, fbm1(t * 0.3 + 7.7) * 0.025, fbm1(t * 0.33 + 1.9) * 0.03));
  const rot = { x: fbm1(t * 0.4 + 5.5) * 0.003 + fbm1(t * 18 + 1.1) * 0.03 * sh, y: fbm1(t * 0.37 + 4.4) * 0.003 + fbm1(t * 17 + 2.2) * 0.03 * sh, z: fbm1(t * 0.3 + 2.2) * 0.004 + fbm1(t * 16 + 3.3) * 0.025 * sh };
  return { pos, look, fov: fovF - 3 * sh, rot };
}
function poseCamera(cam, c) {
  cam.fov = c.fov; cam.aspect = W / H; cam.position.copy(c.pos); cam.lookAt(c.look);
  cam.rotateX(c.rot.x); cam.rotateY(c.rot.y); cam.rotateZ(c.rot.z);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
}
// screen position of a world point (callouts are drawn in the text layer: camAt is a pure function of time)
const projCam = new THREE.PerspectiveCamera(50, W / H, 0.05, 1e8);
function toScreen(c, p) {
  poseCamera(projCam, c);
  const v = p.clone().project(projCam);
  return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, ok: v.z < 1 && Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.9 };
}

// ------------------------------------------------------------------ light and exposure from the atmosphere
const SUNA = [SUN.x, SUN.y, SUN.z];
function lightAt(alt) {
  const sl = sunlightAt(alt, SUNA);
  const m = Math.max(...sl, 1e-9), k = Math.pow(Math.min(1, m), 0.35) * (m > 1e-4 ? 1 : m / 1e-4);
  return { sunCol: sl.map((x) => x / m), sunK: k, zen: skyAt(alt, [0, 1, 0], SUNA, 8) };
}
// exposure: opened up for the twilight street, down as the sun comes up, steady above
const exposureAt = (alt) => lerp(6.0, 1.0, smooth(300, 4000, alt)) * lerp(1, 0.85, smooth(20000, 60000, alt));
const ISS_AZ0 = SUN_AZC + 150;
const issPos = (t, camAlt) => { const a = (ISS_AZ0 + (t - SAY.tail - 1.0) * 3.0) * DEG; return V(Math.sin(a) * 1.0e6, camAlt + 1.0e6 * Math.tan(0.2), Math.cos(a) * 1.0e6); };

// ------------------------------------------------------------------ sound
const S_ = (file, t, o = {}) => Object.assign({ type: 'sample', file, t }, o);
function buildAudio() {
  const A = [];
  const fx = (type, o) => A.push(Object.assign({ type, fx: true }, o));
  const keysEvery = (f, step = 0.05) => { const ks = []; for (let t = 0; t <= DURATION; t += step) ks.push([+t.toFixed(2), +f(t).toFixed(3)]); return ks; };
  for (const k of ORDER) A.push(S_(VO[k].file, SAY[k], { level: 1.35, free: true, verb: 0.025, fin: 0.005, fout: 0.03 }));
  const talking = (t) => { let k = 0; for (const key of ORDER) { const at = SAY[key]; k = Math.max(k, smooth(at - 0.12, at, t) * (1 - smooth(at + VO[key].dur, at + VO[key].dur + 0.35, t))); } return k; };
  A.push({ type: 'fxduck', keys: keysEvery((t) => 1 - 0.5 * talking(t), 0.04) });
  // music: the long build lands its peak (48 s into the track) on space; about −11 dB under the voice
  const peak = 48, off = Math.max(0, peak - T_SPACE), st0 = Math.max(0, T_SPACE - peak);
  A.push(S_('music/871.mp3', st0, { offset: off, level: 0.55, fin: 0.4, fout: 2.4, dur: DURATION - st0,
    keys: keysEvery((t) => (t < T_SPACE - 0.75 ? 1 : t < T_SPACE + 0.02 ? 0.05 : 1.05) * (1 - 0.72 * talking(t))) }));
  // the plaza at dawn: city air, a crowd
  A.push(S_('sfx/367.wav', 0, { offset: 12, dur: T_TL + 4, level: 0.4, fout: 2.5, keys: keysEvery((t) => 1 - 0.55 * talking(t)) }));
  fx('crowd', { t0: 0, t1: T_TL + 3, level: 0.2, swell: [[0, 0.5], [1.2, 0.75], [T_TL, 0.45], [T_TL + 3, 0.05]] });
  // wind: loud in thick air, thinning to nothing; his breathing in the helmet takes over
  fx('rush', { t0: 0.5, t1: T_SPACE + 1, level: 0.34, seed: 3, speed: keysEvery((t) => clamp(0.12 + 0.85 * Math.exp(-altAt(t) / 10000)) * (t < T_TL ? 0.45 : 1), 0.05) });
  const breaths = []; for (let t = 1.0; t < DURATION - 4; t += 2.4) breaths.push([+t.toFixed(2), +clamp(0.35 + 0.6 * smooth(4000, 40000, altAt(t))).toFixed(2)]);
  fx('breath', { times: breaths, level: 0.16, seed: 4 });
  // every grip on a rung: a gloved clank, alternating sides
  for (let n = 0; n < PHI_STOP * 2; n++) { const t = T_CLIMB + (n + 0.5) * CYCLE / 2; if (t > DURATION - 2) break; fx('clank', { t, level: 0.13, f: n % 2 ? 560 : 480, pan: n % 2 ? 0.25 : -0.25, seed: 200 + n }); }
  // radio chirps as each landmark lands; whooshes as the world streams between them
  LM.forEach((l, i) => { if (l.tick) fx('chirp', { t: l.t + 0.05, level: 0.16, seed: 60 + i, f: i % 2 ? [1400, 1870] : [1600, 2100] }); });
  LM.forEach((l, i) => { if (i < LM.length - 1) fx('sweep', { t: l.t, pre: 0.8, post: 0.3, f: i % 2 ? [5200, 380] : [380, 5200], q: 1.6, level: 0.3, pan: i % 2 ? [0.5, -0.5] : [-0.5, 0.5], seed: 10 + i }); });
  // the sun breaking over the clouds; the jet; the meteors
  fx('sparkle', { t: L.clouds.t + 0.2, dur: 1.4, count: 9, f: [700, 2600], level: 0.16, seed: 30 });
  fx('jet', { t: L.plane.t - 1.8, dur: 4.6, peak: 0.42, level: 0.45, seed: 31 });
  fx('subdrop', { t: L.plane.t + 0.05, dur: 0.9, level: 0.35 });
  fx('sparkle', { t: L.meteors.t - 1.6, dur: 4.6, count: 16, f: [1500, 4800], level: 0.16, seed: 32 });
  for (let m = 0; m < 4; m++) fx('sweep', { t: L.meteors.t - 1.2 + m * 1.05, pre: 0.25, post: 0.4, f: [6000, 900], q: 2.4, level: 0.15, pan: m % 2 ? [0.6, -0.4] : [-0.6, 0.4], seed: 40 + m });
  // space: a riser, then nothing for half a second, then the hit
  A.push({ type: 'duck', keys: [[0, 1], [T_SPACE - 0.6, 1], [T_SPACE - 0.5, 0.06], [T_SPACE - 0.01, 0.06], [T_SPACE + 0.02, 1], [DURATION, 1]] });
  fx('sweep', { t: T_SPACE - 0.55, pre: 2.4, post: 0.02, f: [220, 9500], q: 1.2, curve: 2.8, tone: 0.5, level: 0.55, pan: [-0.3, 0.3], seed: 50 });
  A.push({ type: 'impact', t: T_SPACE, level: 0.85, free: true, seed: 51 });
  A.push({ type: 'subdrop', t: T_SPACE, dur: 1.6, level: 0.55, free: true });
  fx('sparkle', { t: T_SPACE + 0.15, dur: 1.6, count: 10, f: [2000, 6000], level: 0.18, seed: 52 });
  fx('glide', { t0: SAY.tail + 2.0, t1: SAY.tail + 7.0, level: 0.06, seed: 53, keys2: [[SAY.tail + 2.0, 0.2], [SAY.tail + 7.0, 0.6]] });
  A.push({ type: 'chime', t: END, level: 0.2, free: true });
  return A;
}

// ------------------------------------------------------------------ the hook's icon: a ladder climbing to a star
const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6d8"/><stop offset="0.4" stop-color="#ffcf4a"/><stop offset="1" stop-color="#ffcf4a" stop-opacity="0"/></radialGradient></defs>
<circle cx="78" cy="22" r="20" fill="url(#g)"/><path d="M78 10 L81 19 L90 22 L81 25 L78 34 L75 25 L66 22 L75 19 Z" fill="#fffbe8"/>
<g stroke="#f4f1ea" stroke-width="5" stroke-linecap="round"><line x1="30" y1="112" x2="62" y2="40"/><line x1="52" y1="112" x2="78" y2="48"/>
<line x1="35" y1="101" x2="56" y2="101"/><line x1="40" y1="89" x2="61" y2="89"/><line x1="45.5" y1="77" x2="66" y2="77"/><line x1="51" y1="65" x2="71" y2="65"/><line x1="56" y1="53" x2="75.5" y2="53"/></g></svg>`;

// ------------------------------------------------------------------ the scenario
const subAt = (t) => { let sub = 'LADDER TO SPACE · 62 MI · 100 KM', at = -9; for (const l of LM) if (t >= l.t - 0.9) { sub = l.sub; at = l.t - 0.9; } return { sub, age: t - at }; };
export default {
  id: 'space-ladder',
  title: 'What if you climbed a ladder to space?',
  titleWords: [['What', 0], ['if', 0], ['you', 0], ['climbed', 0], ['a', 0], ['ladder', 1], ['to', 0], ['space?', 1]],
  titleIcon: ICON, titleAnimAt: 0.05,
  endFact: 'Space starts <b>100 km</b> (62 mi) up. Staying there means moving sideways at about <b>28,000 km/h</b> (17,000 mph).',
  duration: DURATION,
  titleIn: [-1, -0.5], titleOut: [endOf('hook') + 0.1, endOf('hook') + 0.45],
  fadeOut: FADE, endAt: END, endSpeed: 1.3,
  captions: CAPTIONS,
  captionFade: 0.08,
  goal(t) {
    const a = smooth(0.4, 0.9, t) * (1 - smooth(FADE[0], FADE[1], t));
    if (a <= 0) return null;
    const alt = altAt(t);
    const ticks = LM.filter((l) => l.tick && l.key !== 'space').map((l) => ({ k: l.alt / L.space.alt, on: alt >= l.alt * 0.999, pop: Math.exp(-Math.pow((t - l.t - 0.15) / 0.12, 2)) }));
    if (t >= T_SPACE) return { label: 'GOAL REACHED ✓', pct: '100%', k: 1, from: 'GROUND', to: 'SPACE', alpha: a, ticks };
    const p = Math.min(99.9, alt / L.space.alt * 100);
    return { label: 'GOAL: SPACE', pct: p < 0.05 ? '0%' : p < 1 ? `${p.toFixed(2)}%` : p < 10 ? `${p.toFixed(1)}%` : `${Math.floor(p)}%`, k: p / 100, from: 'GROUND', to: '62 MI · 100 KM', alpha: a, ticks };
  },
  hud(t) {
    if (t >= FADE[1]) return null;
    const a = smooth(endOf('hook') - 0.2, endOf('hook') + 0.3, t) * (1 - smooth(FADE[0], FADE[1], t));
    const h = altAt(t), c = tempC(h), f = c * 9 / 5 + 32;
    const s = subAt(t);
    let pop = 0; for (const l of LM) pop = Math.max(pop, Math.exp(-Math.pow((t - l.t - 0.1) / 0.18, 2)));
    const label = `ALTITUDE · OUTSIDE ${Math.round(f)}°F / ${Math.round(c)}°C`;
    if (t >= T_SPACE) return { label, value: 'SPACE', value2: '62 mi · 100 km', sub: s.sub, subAge: s.age, pop, alpha: a };
    return { label, value: fmtImp(h), value2: fmtMet(h), sub: s.sub, subAge: s.age, pop, alpha: a };
  },
  labels(t) {
    const out = [], c = camAt(t);
    const call = (t0, t1, p, text, side) => {
      const a = smooth(t0, t0 + 0.35, t) * (1 - smooth(t1 - 0.3, t1, t)); if (a <= 0.001) return;
      const s = toScreen(c, p); if (!s.ok || s.y < 470) return;           // never over the goal bar
      out.push({ x: s.x, y: s.y, text, alpha: a, side: s.x < W * 0.45 ? 'right' : s.x > W * 0.55 ? 'left' : side });
    };
    call(L.tower.t - 1.6, L.tower.t + 0.9, TOWER_POS.clone().setY(828), 'TALLEST BUILDING · 828 M', 'left');
    call(L.plane.t - 0.6, L.plane.t + 1.6, V(planeX(t), L.plane.y + 3, PLANE_Z), 'JET · 900 KM/H · 560 MPH', 'right');
    call(L.skydive.t - 0.2, L.skydive.t + 2.0, BALLOON_POS.clone().add(V(0, 35, 0)), 'RECORD JUMP · 41.4 KM', 'left');
    const ti = SAY.tail + 1.0;
    if (t > ti + 0.5) {
      const hy = hipY(t), camAlt = altAt(t) + (c.pos.y - hy) + 1.05;
      const s = toScreen({ ...c, pos: V(c.pos.x, camAlt, c.pos.z), look: c.look.clone().add(V(0, camAlt - c.pos.y, 0)) }, issPos(t, camAlt));
      if (s.ok) out.push({ x: s.x, y: s.y, text: 'SPACE STATION · 28,000 KM/H', alpha: smooth(ti + 0.5, ti + 1.0, t) * (1 - smooth(FADE[0] - 0.5, FADE[0], t)), side: 'right' });
    }
    return out;
  },
  audio: buildAudio(),

  async setup(ctx) {
    const { renderer } = ctx;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.0;
    ctx.grain = 0; ctx.vignette = 0; ctx.handheld = 0;
    ctx.grade = { brightness: 1.0, contrast: 1.0, saturate: 1.0, sepia: 0 };
    ctx.post = { layered: true, bloom: { strength: 0.42, radius: 0.55, threshold: 0.82 }, dof: { focus: 5, aperture: 0.0045, maxBlur: 0.011, farBlur: 0.35 },
      grade: { contrast: 1.12, saturation: 1.1, lift: [0.0, 0.006, 0.02], gain: [1.03, 1.0, 0.97], split: 0.1, vignette: 0.32, grain: 0.04, ca: 0.0016 } };
    const st = this.st = {};
    window.__st = st;
    // a soft environment for reflections (visor, glass, metal): a dawn gradient, warm toward the sun
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide, uniforms: { uSun: { value: SUN } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uSun; varying vec3 vD; void main(){ float h = vD.y, s = max(dot(normalize(vD), normalize(vec3(uSun.x, 0.05, uSun.z))), 0.0); vec3 c = h > 0.0 ? mix(vec3(0.55,0.45,0.42), vec3(0.12,0.2,0.42), pow(h, 0.5)) : mix(vec3(0.35,0.3,0.28), vec3(0.06,0.06,0.07), pow(-h, 0.4)); c += vec3(1.2, 0.6, 0.25) * pow(s, 8.0) * (1.0 - abs(h)); gl_FragColor = vec4(c, 1.0); }',
    })));
    const env = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0).texture;
    st.far = await buildFar();
    st.near = buildNear(st, env);
    ctx.poseAt = (t) => this.pose(ctx, t);
  },

  update(ctx, t) {
    this.pose(ctx, t);
    // motion blur: more sub-frames while the world streams past or the camera shakes, fewer when it's calm
    const v = Math.abs(SET(t + 0.02) - SET(t - 0.02)) / 0.04;
    ctx.motionBlur = { samples: v > 25 || trauma(t) > 0.2 ? 5 : 3, shutter: 0.5, farOnce: true };
  },

  pose(ctx, t) {
    const st = this.st, F = st.far, N = st.near;
    const c = camAt(t);
    if (DBG) { c.pos = V(...DBG.pos); c.look = V(...DBG.look); c.fov = DBG.fov ?? c.fov; c.rot = { x: 0, y: 0, z: 0 }; }
    const yS = SET(t), alt = altAt(t), hy = hipY(t);
    poseCamera(N.cam, c);
    const camAlt = Math.max(1, alt + (c.pos.y - hy) + 1.05);
    F.cam.fov = c.fov; F.cam.aspect = W / H; F.cam.position.set(c.pos.x, camAlt, c.pos.z); F.cam.quaternion.copy(N.cam.quaternion);
    F.cam.near = Math.max(2, Math.min(200, camAlt * 0.02)); F.cam.updateProjectionMatrix(); F.cam.updateMatrixWorld();
    // the sky: scattered at low resolution just before the layers are drawn
    F.skyU.uInvPV.value.copy(F.cam.projectionMatrixInverse).premultiply(F.cam.matrixWorld);
    F.skyU.uCam.value.copy(F.cam.position);
    ctx.view = { layers: [{ scene: F.scene, camera: F.cam }, { scene: N.scene, camera: N.cam }], beforeDraw: (r) => { const prev = r.getRenderTarget(); r.setRenderTarget(F.skyRT); r.render(F.skyScene, F.skyCam); r.setRenderTarget(prev); } };
    // light from the atmosphere at his height
    const Lt = lightAt(camAlt);
    ctx.renderer.toneMappingExposure = 1.05;
    F.U.uExpo.value = exposureAt(camAlt);
    F.U.uTime.value = t;
    F.U.uSunCol.value.setRGB(Lt.sunCol[0], 0.12 + 0.88 * Lt.sunCol[1], 0.05 + 0.95 * Lt.sunCol[2]).multiplyScalar(Math.max(Lt.sunK, 0.45) * (Lt.sunK > 0.002 ? 1 : Lt.sunK / 0.002));
    st.sun.color.setRGB(...Lt.sunCol); st.sun.intensity = 3.4 * Lt.sunK;
    st.sun.position.set(0, hy, -0.38).addScaledVector(SUN, 20); st.sun.target.position.set(0, hy, -0.38); st.sun.target.updateMatrixWorld();
    const zk = 26;
    st.hemi.color.setRGB(Lt.zen[0] * zk + 0.02, Lt.zen[1] * zk + 0.025, Lt.zen[2] * zk + 0.04);
    const es = Lt.sunK * smooth(8000, 30000, camAlt);                 // earthshine from the sunlit planet below
    st.hemi.groundColor.setRGB(0.05 + 0.25 * es, 0.05 + 0.27 * es, 0.06 + 0.32 * es);
    st.rim.intensity = 0.5 + 1.0 * Lt.sunK; st.rim.color.setRGB(0.6, 0.75, 1.0);
    st.rim.position.set(-SUN.x * 10, hy + 3, -0.38 - SUN.z * 10); st.rim.target.position.set(0, hy, -0.38); st.rim.target.updateMatrixWorld();
    // the city stays on below; it hands over to the satellite map above the cloud layer
    st.city.visible = yS < L.clouds.y + 15;
    st.groundU.uAmb.value.setRGB(Lt.zen[0] * 11 + 0.02, Lt.zen[1] * 11 + 0.024, Lt.zen[2] * 11 + 0.035);
    // haze over the city: dawn-coloured, thinning with height
    const fogD = 1 / 2600 * lerp(1, 0.35, smooth(200, 1200, camAlt));
    N.scene.fog.color.setRGB(0.42 + 0.3 * Lt.sunK, 0.36 + 0.14 * Lt.sunK, 0.36); N.scene.fog.density = fogD;
    st.groundU.uFogC.value.copy(N.scene.fog.color); st.groundU.uFogD.value = fogD;
    st.beacons.forEach((b, i) => { b.material.opacity = Math.sin(t * 3.1 + i) > 0.2 ? 1 : 0.15; });
    // clouds: lit by the low sun from above over a blue-grey belly; thin out near the lens
    const cs = new THREE.Color(1, 1, 1).lerp(new THREE.Color(...Lt.sunCol), 0.4).multiplyScalar(0.55 + 0.75 * Lt.sunK), cb = new THREE.Color(0.36, 0.4, 0.52);
    for (const s of st.clouds) {
      s.material.color.copy(cb).lerp(cs, clamp(0.25 + 0.75 * smooth(800, 2200, camAlt)) * s.userData.k);
      s.material.opacity = 0.95 * (1 - smooth(L.clouds.y + 25, L.clouds.y + 60, yS)) * (1 - smooth(L.clouds.y - 70, L.clouds.y - 30, -yS + 2 * L.clouds.y - 40 > 0 ? yS : yS)) * smooth(4, 30, s.position.distanceTo(c.pos)) * smooth(L.clouds.y - 160, L.clouds.y - 60, yS);
    }
    const veil = Math.exp(-(((yS - L.clouds.y) / 12) ** 2)) * 0.32;
    ctx.tint = veil > 0.01 ? { color: '#f2e9e2', opacity: veil, blend: 'normal' } : null;
    // specks: fixed in the set, wrapped round the camera, so they stream past at the climb's speed
    {
      const S = st.specks, a = S.arr, b = S.base, cy = c.pos.y;
      for (let i = 0; i < a.length; i += 3) { a[i] = c.pos.x + ((b[i] - c.pos.x) % 24 + 36) % 24 - 12; a[i + 1] = cy - 20 + ((b[i + 1] - cy) % 40 + 60) % 40; a[i + 2] = c.pos.z + ((b[i + 2] - c.pos.z) % 24 + 36) % 24 - 12; }
      S.p.geometry.attributes.position.needsUpdate = true;
      S.m.opacity = (0.35 + 0.65 * Lt.sunK) * (1 - smooth(30000, 50000, camAlt)) * smooth(T_TL - 0.5, T_TL + 1, t);
      S.m.color.setRGB(...Lt.sunCol.map((x) => 0.6 + 1.4 * x));
    }

    // ---- the climber: hips rise two rungs a cycle; diagonal pairs of limbs move in turn and always land on rungs
    const phi = phiAt(t), base = Math.floor(phi), fr = phi - base;
    const mA = smooth(0, 0.5, fr), mB = smooth(0.5, 1, fr);
    const dLadder = yS - yLocal(t);
    const rungY = (n) => n * RUNG + dLadder;
    const breathe = Math.sin(t * Math.PI * 2 / 2.4);
    const hip = V(0.03 * Math.sin(phi * Math.PI * 2), hy, -0.4 + 0.02 * Math.cos(phi * Math.PI * 4));
    const lean = 0.12 + 0.015 * breathe;
    const sh = hip.clone().add(V(0, 0.56 * Math.cos(lean), 0.56 * Math.sin(lean)));
    const limb = (lvl0, m, x, z0, dz) => V(x, rungY(lvl0 + 2 * m), z0 - dz * Math.sin(Math.PI * m));
    let hR = limb(2 * base + 6, mA, 0.2, -0.04, 0.16), hL = limb(2 * base + 7, mB, -0.2, -0.04, 0.16);
    const fL = limb(2 * base + 1, mA, -0.14, -0.1, 0.12).add(V(0, 0.07, 0)), fR = limb(2 * base + 2, mB, 0.14, -0.1, 0.12).add(V(0, 0.07, 0));
    const wave = smooth(T_SPACE + 1.0, T_SPACE + 1.6, t) * (1 - smooth(SAY.tail + 0.2, SAY.tail + 0.8, t));
    if (wave > 0) hR = hR.lerp(sh.clone().add(V(0.55, 0.45 + 0.08 * Math.sin(t * 9), -0.25 + 0.12 * Math.sin(t * 9))), wave);
    const P = st.cl.P;
    P.pelvis.position.copy(hip); P.pelvis.rotation.set(lean, 0, 0);
    const tcn = hip.clone().lerp(sh, 0.5);
    for (const k of ['torso', 'stripe']) { P[k].position.copy(tcn); P[k].rotation.set(lean, 0.04 * Math.sin(phi * Math.PI * 2), 0); }
    P.stripe.position.y -= 0.12;
    P.chest.position.copy(tcn).add(V(0, 0.06, 0.16)); P.chest.rotation.copy(P.torso.rotation);
    P.pack.position.copy(tcn).add(V(0, 0.04, -0.25)); P.pack.rotation.copy(P.torso.rotation);
    P.packTop.position.copy(tcn).add(V(0, 0.31, -0.25)); P.packTop.rotation.copy(P.torso.rotation);
    P.led.position.copy(tcn).add(V(0.15, 0.2, -0.36)); st.cl.led.color.setRGB(Math.sin(t * 5) > 0.6 ? 4 : 0.3, 0.4, 0.3);
    const neck = sh.clone().add(V(0, 0.06, 0.03));
    // he looks up the ladder; at the jet and the balloon he glances over; in space, down at the Earth
    let look = -0.5 + 0.2 * Math.sin(t * 0.7);
    const turn = 0.8 * Math.exp(-Math.pow((t - L.plane.t - 0.3) / 0.9, 2)) - 0.7 * Math.exp(-Math.pow((t - L.skydive.t - 0.6) / 1.0, 2));
    if (t > T_SPACE + 0.5) look = lerp(look, 0.55, smooth(T_SPACE + 0.5, T_SPACE + 1.5, t));
    P.ring.position.copy(neck); P.ring.rotation.set(lean, 0, 0);
    const hc = neck.clone().add(V(0, 0.2 * Math.cos(look * 0.4), 0.06 + 0.06 * Math.sin(-look)));
    P.helmet.position.copy(hc); P.visor.position.copy(hc); P.visor.rotation.set(look, turn, 0, 'YXZ');
    for (const [s, sx, hand, foot] of [['L', -1, hL, fL], ['R', 1, hR, fR]]) {
      const S = sh.clone().add(V(0.25 * sx, -0.04, 0));
      const a = ik(S, hand, 0.3, 0.3, V(sx * 1.0, -0.6, -1.0));
      seg(P['upArm' + s], S, a.mid, 0.06); seg(P['loArm' + s], a.mid, a.end, 0.03);
      P['hand' + s].position.copy(a.end); P['hand' + s].quaternion.copy(P['loArm' + s].quaternion);
      seg(P['cuff' + s], a.mid.clone().lerp(a.end, 0.86), a.end, 0); P['cuff' + s].scale.y = 0.05;
      const Hj = hip.clone().add(V(0.1 * sx, -0.06, 0));
      const l = ik(Hj, foot, 0.43, 0.43, V(sx * 0.25, 0.1, 1.0));
      seg(P['thigh' + s], Hj, l.mid, 0.05); seg(P['shin' + s], l.mid, l.end, 0.03);
      P['boot' + s].position.copy(l.end).add(V(0, -0.03, 0.05));
    }
    const n0 = Math.floor(yLocal(t) / RUNG) - 44, M4 = new THREE.Matrix4();
    for (let i = 0; i < 96; i++) { const n = n0 + i; M4.makeTranslation(0, n < 1 && dLadder < 0.01 ? -100 : rungY(n), 0); st.rungs.setMatrixAt(i, M4); }
    st.rungs.instanceMatrix.needsUpdate = true;
    st.markerM.opacity = 0.5 + 0.5 * Math.sin(t * 4);
    st.hoop.material.color.setRGB(0.8 + 2.4 * smooth(T_SPACE - 0.2, T_SPACE + 0.3, t), 2.2, 3.2);

    // ---- the jet: level flight, passing behind him, cabin lit, nav lights and strobe, contrails spreading
    const px = planeX(t), yP = L.plane.y + 0.5;
    st.plane.position.set(px, yP, PLANE_Z); st.plane.rotation.set(0, 0, 0);
    st.plane.visible = Math.abs(t - L.plane.t) < 6;
    st.nav[2].material.opacity = (t * 1.3) % 1 < 0.08 ? 1 : 0;
    st.trail.forEach((s, i) => { const back = i * 5 + 22, x = px - back, age = back / PLANE_V; s.visible = st.plane.visible && x > -1000; s.position.set(x, yP - 1.6 + age * 0.3, PLANE_Z + (i % 2 ? 6.5 : -6.5)); const sc = 2.4 + age * 1.6; s.scale.set(sc, sc, 1); s.material.opacity = 0.8 * Math.exp(-age * 0.12); s.material.color.setRGB(...Lt.sunCol.map((x) => 0.55 + 0.6 * x)); });
    st.balloon.position.y = BALLOON_POS.y + (t - L.skydive.t) * 0.6;
    st.balloon.visible = Math.abs(t - L.skydive.t) < 5;

    // ---- the far layer: stars, meteors, the station
    F.starM.opacity = smooth(25000, 60000, camAlt) * 0.95;
    for (const m of F.meteors) {
      const u = (t - m.t0) / m.dur;
      m.m.visible = u > 0 && u < 1; if (!m.m.visible) continue;
      const head = m.p0.clone().addScaledVector(m.dir, m.v * (t - m.t0)), len = m.len * Math.min(1, u * 3);
      m.m.position.copy(head).addScaledVector(m.dir, -len / 2);
      const toCam = F.cam.position.clone().sub(m.m.position).normalize();
      const xAx = new THREE.Vector3().crossVectors(m.dir, toCam).normalize(), zAx = new THREE.Vector3().crossVectors(xAx, m.dir);
      m.m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, m.dir, zAx));
      m.m.scale.set(len * 0.07, len, 1); m.m.material.opacity = Math.sin(Math.PI * u);
    }
    const ti = SAY.tail + 1.0;
    F.iss.visible = t > ti && t < FADE[1];
    if (F.iss.visible) { F.iss.position.copy(issPos(t, camAlt)); const s = 15000 * (0.9 + 0.1 * Math.sin(t * 13)); F.iss.scale.set(s, s, 1); }
    // depth of field: focus on him; the sky and planet a touch soft (less so once he's in space)
    const kk = camKeys(t);
    if (DBG) { ctx.dof = { focus: 10, aperture: 0, farBlur: 0 }; } else ctx.dof = { focus: c.pos.distanceTo(V(0, hy + 0.7, -0.38)), aperture: 0.0032 * (1 - clamp(kk.aim * 1.8)), farBlur: lerp(0.18, 0.05, smooth(30000, 80000, camAlt)) * (1 - clamp(kk.aim * 1.8)) };
    // cars on the avenues, people
    {
      const C = st.cars, pa = C.g.attributes.position.array, ca = C.g.attributes.color.array;
      C.list.forEach((q, i) => { const s = ((q.s0 + q.v * t) % 5200 + 7800) % 5200 - 2600; pa.set(q.axis ? [s, 1, q.lane] : [q.lane, 1, s], i * 3); ca.set(i % 2 ? [2.6, 2.4, 2.0] : [2.6, 0.25, 0.15], i * 3); });
      C.g.attributes.position.needsUpdate = true; C.g.attributes.color.needsUpdate = true;
    }
    st.ppl.update(t);
  },
};

export const _debug = { SAY, LM, SET, altAt, yLocal, phiAt, camAt, T_TL, T_SPACE, PHI_STOP, END, DURATION, CAPTIONS, lightAt, exposureAt, SUN_AZC };
