// What if AI took every job?
//
// One block of a city, modelled like a railway diorama and filmed with a moving camera: an office tower cut open
// at the front, the avenue in front of it, a supermarket and a block of flats across the road, the city all round.
// Warm light is people at work; cyan is AI. The story runs as a countdown of jobs: the screens on one desk flip,
// then a floor, then the floors climb the tower, the robots arrive on the street, the shop goes dark, and the
// city wakes up with no job left. Then the turn: nobody has wages to spend, the robot tax and Finland's test,
// a hundred people on a stage for what history says, and who owns the machines.
// Real numbers on screen: SHRM 2026 (5.1% of US jobs at high risk), Stanford 2025 (−13% employment for 22–25
// year olds in AI-exposed jobs), Kela's basic-income experiment (2017–18, 2,000 people, €560 a month),
// USDA/census (about 40% of US workers farmed in 1900, about 1% now), Autor et al. (60% of 2018 jobs did not
// exist in 1940).
import * as THREE from 'three';
import { Rng, clamp, lerp, smooth, fbm1 } from '../engine/lib/rng.js';
import { buildPeople, pathAt, pathLen } from '../engine/lib/people.js';
import { buildVehicles } from '../engine/lib/vehicles.js';
import {
  FH, COLS, ROWS, DEPTS, NFL, deskDelay, seatPos, STORE, APT, ROOMS,
  makeIU, patchInterior, buildTower, buildStore, buildFlats, buildStreet, buildCity, buildSky, buildRobotBits, buildCoins, buildStage, softDot,
} from './ai-jobs-set.js';
import VO from './ai-jobs.vo.js';

const W = 1080, H = 1920;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DBG = (() => { try { const q = typeof location !== 'undefined' && new URLSearchParams(location.search).get('dbg'); return q ? JSON.parse(q) : null; } catch (e) { return null; } })();

// ------------------------------------------------------------------ the story, timed by the narration
const ORDER = ['hook', 'goal', 'screens', 'quiet', 'safe', 'robots', 'hundred', 'twist', 'fix', 'finland', 'history', 'outro', 'cta'];
const GAP = { hook: 0.35, quiet: 0.25, hundred: 0.5, twist: 0.7, history: 0.45, outro: 0.4, cta: 0.4 };
const SAY = {};
{ let t = 0; for (const k of ORDER) { SAY[k] = t + (GAP[k] ?? 0.2); t = SAY[k] + VO[k].dur; } }
const wordT = (key, word, nth = 0) => { let n = 0; for (const [w, s] of VO[key].words) if (w.toLowerCase().replace(/[^a-z0-9']/g, '').startsWith(word) && n++ === nth) return SAY[key] + s; throw new Error(`no "${word}" in ${key}`); };
const endOf = (k) => SAY[k] + VO[k].dur;
const T_END_TALK = endOf('cta');
const FADE = [T_END_TALK + 0.55, T_END_TALK + 1.2], END = FADE[1] + 0.15, DURATION = END + 3.6;

// when each floor's screens flip (the wave crosses the floor in about a second), and when its lights go out
const HERO = { f: 2, ci: 2, ri: 0 };
const HERO_T = wordT('hook', 'job') + 0.02;
const FLIP = new Array(NFL).fill(1e4);
FLIP[2] = wordT('hook', 'everyone') - 0.1;
FLIP[1] = wordT('screens', 'call') - 0.05; FLIP[3] = wordT('screens', 'translators') - 0.05;
FLIP[4] = wordT('quiet', 'companies');
FLIP[6] = wordT('safe', 'coders') - 0.05; FLIP[7] = wordT('safe', 'lawyers') - 0.05; FLIP[8] = wordT('safe', 'accountants') - 0.05;
FLIP[5] = wordT('safe', 'people') - 0.05; FLIP[9] = FLIP[5] + 0.22; FLIP[10] = FLIP[5] + 0.44; FLIP[11] = FLIP[5] + 0.66; FLIP[12] = FLIP[5] + 0.88;
const LOUT = FLIP.map((t, f) => (f === 2 ? t + 3.4 : t + 2.6));
const deskT = (f, ci, ri) => (f === HERO.f && ci === HERO.ci && ri === HERO.ri ? HERO_T : FLIP[f] + deskDelay(ci, ri));
const T_ROBOT = wordT('robots', 'until');
const T_TRUCK = wordT('robots', 'trucks');
const T_DARK = wordT('robots', 'warehouses');
const T_MORNING = SAY.hundred;
const T_ZERO = wordT('hundred', 'ever');
const T_PROBLEM = wordT('twist', 'here') - 0.08;
const T_TAX = wordT('fix', 'tax');
const T_HAPPY = wordT('finland', 'happier');
const T_1900 = wordT('history', 'in') - 0.05;
const T_TODAY = wordT('history', 'today');
const T_NEW = wordT('history', 'invented');
const T_OWNS = wordT('outro', 'owns');

// ------------------------------------------------------------------ the countdown: share of jobs done by AI
const JOBS = [[0, 0], [HERO_T, 0.001], [FLIP[2] + 1.2, 0.02], [FLIP[1] + 0.8, 0.07], [FLIP[3] + 0.8, 0.14], [FLIP[4] + 1.0, 0.2],
  [FLIP[6] + 0.6, 0.29], [FLIP[7] + 0.6, 0.36], [FLIP[8] + 0.6, 0.43], [FLIP[12] + 1.0, 0.6], [T_ROBOT + 0.8, 0.68], [T_TRUCK + 0.8, 0.78],
  [T_DARK + 1.2, 0.9], [wordT('robots', 'lights') + 0.4, 0.95], [wordT('hundred', 'nobody'), 0.975], [T_ZERO, 1.0]];
function jobsAt(t) {
  if (t <= JOBS[0][0]) return 0;
  for (let i = 0; i < JOBS.length - 1; i++) { const [t0, a] = JOBS[i], [t1, b] = JOBS[i + 1]; if (t <= t1) { const u = (t - t0) / (t1 - t0); return lerp(a, b, u * u * (3 - 2 * u)); } }
  return 1;
}
const US_JOBS = 163e6;

// ------------------------------------------------------------------ captions: word by word; numbers in figures and both currencies; keywords in gold
const NUMS = [['six hundred dollars', '$600 (€560)'], ['four in ten', '4 in 10'], ['one in a hundred', '1 in 100'], ['1900', '1900']];
const KEYWORDS = /^(ai|everyone|screen|hiring|young|safe|robots|cheap|dark|lights|ever|paradise|problem|paychecks|buying|wild|check|finland|free|lazy|happier|twist|farmed|invented|owns|last)$/i;
function buildCaptions() {
  const out = [];
  for (const key of ORDER) {
    const at = SAY[key];
    let ws = [];
    for (const [w, s, e] of VO[key].words) { if (ws.length && /^[-']/.test(w)) { const p = ws[ws.length - 1]; p[0] += w; p[2] = e; } else ws.push([w, s, e, false]); }
    if (key === 'hook') ws = ws.filter((w) => w[1] >= VO.hook.words.find((x) => x[0] === 'and')[1] - 0.01);   // the title card says the first half
    for (const [sayd, show] of NUMS) {
      const k = sayd.split(' ');
      for (let i = 0; i + k.length <= ws.length; i++) {
        if (k.every((x, j) => ws[i + j][0].toLowerCase().replace(/[^a-z0-9-]/g, '') === x)) {
          const p = ws[i + k.length - 1][0].match(/[,.?!…]+$/)?.[0] ?? '';
          ws.splice(i, k.length, [show + p, ws[i][1], ws[i + k.length - 1][2], true]);
        }
      }
    }
    for (const w of ws) if (!w[3] && KEYWORDS.test(w[0].replace(/[^A-Za-z]/g, ''))) w[3] = true;
    const clauses = [[]];
    ws.forEach((w, i) => { clauses[clauses.length - 1].push(w); if (/[,.?!…:]$/.test(w[0]) && i < ws.length - 1) clauses.push([]); });
    const chunks = [];
    for (const c of clauses) { if (!c.length) continue; const n = Math.ceil(c.length / 4), per = Math.ceil(c.length / n); for (let i = 0; i < c.length; i += per) chunks.push(c.slice(i, i + per)); }
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

// ------------------------------------------------------------------ camera: shots of Catmull-Rom keys; a new shot is a cut
const k = (t, p, l, fov) => ({ t, p, l, fov });
const SHOTS = [
  { t0: -1, keys: [                                                                   // over his shoulder at the screen, then out of the building
    k(0.0, [-0.95, 9.8, 4.78], [-1.5, 9.12, 2.78], 34),
    k(HERO_T + 0.5, [-1.05, 9.68, 4.42], [-1.5, 9.12, 2.78], 31),
    k(FLIP[2] + 0.05, [-0.95, 9.76, 4.72], [-1.5, 9.1, 2.6], 34),
    k(FLIP[2] + 0.7, [0.6, 10.4, 7.8], [-1.4, 9.0, 1.4], 46),
    k(SAY.goal + 0.3, [3, 12, 14], [-1, 9.5, 0], 50),
    k(SAY.goal + 2.6, [9, 24, 62], [0, 26, 0], 46),
    k(SAY.screens, [13, 32, 100], [0, 29, 0], 44),
  ] },
  { t0: SAY.screens, keys: [                                                          // the first three floors
    k(SAY.screens, [-7, 9.5, 31], [-3, 9.0, 0], 40),
    k(SAY.quiet, [1, 10, 28], [-1.5, 9.0, 0], 40),
  ] },
  { t0: SAY.quiet, keys: [                                                            // the sign on the door
    k(SAY.quiet, [-0.6, 1.3, 14.2], [-3.6, 1.05, 8.2], 38),
    k(wordT('quiet', 'stop'), [-1.0, 1.25, 13.2], [-3.5, 1.05, 8.2], 34),
    k(endOf('quiet') + 0.2, [0.9, 1.4, 12.4], [-1.0, 1.0, 9.6], 40),
  ] },
  { t0: SAY.safe, keys: [                                                             // craning up the floors
    k(SAY.safe, [10, 28, 30], [0, 24.5, 0], 40),
    k(FLIP[8] + 0.5, [9, 36, 30], [0, 32, 0], 40),
    k(endOf('safe') + 0.2, [7, 49, 30], [0, 44, 0], 40),
  ] },
  { t0: SAY.robots, keys: [                                                           // down the pavement; the truck; the shop goes dark
    k(SAY.robots, [-12.2, 1.55, 23.9], [2, 1.5, 25.6], 38),
    k(T_ROBOT + 0.6, [-12.4, 1.5, 23.9], [2, 1.4, 25.4], 38),
    k(T_TRUCK - 0.2, [-12.3, 1.5, 23.9], [2, 1.5, 23.2], 40),
    k(T_TRUCK + 0.9, [-12.0, 1.6, 23.9], [-6, 1.7, 30], 40),
    k(T_DARK - 0.2, [-11.6, 1.8, 23.9], [-11.4, 2.6, 34], 40),
    k(endOf('robots') + 0.4, [-11.5, 2.1, 25.4], [-11.3, 2.3, 36], 34),
  ] },
  { t0: SAY.hundred, keys: [                                                          // sunrise over a city with no work
    k(SAY.hundred, [95, 62, 150], [0, 30, 0], 32),
    k(SAY.twist, [80, 52, 128], [0, 32, 0], 32),
  ] },
  { t0: SAY.twist, keys: [                                                            // the lawn
    k(SAY.twist, [-17.5, 1.0, 12.7], [0, 0.5, 10.4], 38),
    k(T_PROBLEM, [-16.5, 1.05, 12.9], [1, 0.5, 10.4], 36),
  ] },
  { t0: T_PROBLEM, aperture: 0.0012, keys: [                                                            // the supermarket window
    k(T_PROBLEM, [-11.5, 1.6, 21.6], [-11.5, 2.1, 32], 40),
    k(SAY.fix, [-11.5, 1.7, 24.4], [-11.5, 2.0, 34], 36),
  ] },
  { t0: SAY.fix, keys: [                                                              // the crown, the coins, into the flats
    k(SAY.fix, [8, 64, 24], [-3, 59, 0], 42),
    k(T_TAX - 0.1, [14, 64, 30], [-3, 58, 0], 44),
    k(T_TAX + 1.1, [44, 40, 60], [6, 26, 14], 50),      // stays inside the open block: the city towers start at x ±52
    k(SAY.finland - 0.1, [38, 12, 6], [15, 7, 30], 44),
    k(SAY.finland + 2.8, [13, 8, 16], [13, 6.5, 32], 40),
    k(SAY.finland + 5.4, [9, 4.5, 18], [11, 3.5, 32], 40),
    k(endOf('finland') + 0.4, [16, 7, 12], [15, 6.4, 32], 46),
  ] },
  { t0: SAY.history, stage: true, keys: [                                             // a hundred people
    k(SAY.history, [0, 9, 13], [0, 0.6, -0.3], 42),
    k(T_TODAY, [2.5, 11, 13.5], [0, 0.5, -0.3], 42),
    k(endOf('history') + 0.4, [4, 12, 13.5], [0, 0.5, -0.3], 44),
  ] },
  { t0: SAY.outro, keys: [                                                            // up to the penthouse, then away over the city
    k(SAY.outro, [1.5, 36, 24], [1.5, 37, 0], 40),
    k(T_OWNS - 0.3, [1.5, 54.4, 22], [1.5, 53.4, 6.7], 30),
    k(endOf('outro') - 0.1, [1.5, 54.0, 15.5], [1.5, 53.5, 6.7], 28),
    k(SAY.cta + 1.2, [26, 72, 105], [0, 38, 0], 40),
    k(DURATION, [34, 78, 125], [0, 38, 0], 40),
  ] },
];
const shotIdx = (t) => { let i = 0; while (i < SHOTS.length - 1 && t >= SHOTS[i + 1].t0) i++; return i; };
function crAt(keys, t, f) {
  const n = keys.length;
  if (t <= keys[0].t) return f(keys[0]);
  if (t >= keys[n - 1].t) return f(keys[n - 1]);
  let i = 0; while (t > keys[i + 1].t) i++;
  const a = keys[Math.max(0, i - 1)], b = keys[i], c = keys[i + 1], d = keys[Math.min(n - 1, i + 2)];
  const u = (t - b.t) / (c.t - b.t), u2 = u * u, u3 = u2 * u;
  const A = f(a), B = f(b), C = f(c), D = f(d);
  return B.map((_, j) => {
    const m1 = (C[j] - A[j]) / Math.max(0.01, c.t - a.t) * (c.t - b.t) * 0.5, m2 = (D[j] - B[j]) / Math.max(0.01, d.t - b.t) * (c.t - b.t) * 0.5;
    return (2 * u3 - 3 * u2 + 1) * B[j] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * C[j] + (u3 - u2) * m2;
  });
}
const SHAKES = [[FLIP[2] + 0.02, 0.35], [T_TRUCK + 0.6, 0.5], [T_ZERO, 0.8], [T_PROBLEM, 0.45], [T_TODAY, 0.3]];
const trauma = (t) => SHAKES.reduce((s, [t0, a]) => s + (t >= t0 ? a * Math.max(0, 1 - (t - t0) / 0.8) : 0), 0);
function camAt(t) {
  const S = SHOTS[shotIdx(t)];
  const v = crAt(S.keys, t, (q) => [...q.p, ...q.l, q.fov]);
  const pos = V(v[0], v[1], v[2]), look = V(v[3], v[4], v[5]);
  const tr = Math.min(1, trauma(t)), sh = tr * tr;
  const amp = pos.distanceTo(look) * 0.002 + 0.01;
  pos.add(V(fbm1(t * 0.35 + 3.1) * amp, fbm1(t * 0.3 + 7.7) * amp * 0.8, fbm1(t * 0.33 + 1.9) * amp));
  const rot = { x: fbm1(t * 0.4 + 5.5) * 0.003 + fbm1(t * 18 + 1.1) * 0.03 * sh, y: fbm1(t * 0.37 + 4.4) * 0.003 + fbm1(t * 17 + 2.2) * 0.03 * sh, z: fbm1(t * 0.3 + 2.2) * 0.004 + fbm1(t * 16 + 3.3) * 0.025 * sh };
  return { pos, look, fov: v[6] - 3 * sh, rot, shot: shotIdx(t), stage: !!S.stage, aperture: S.aperture };
}
function poseCamera(cam, c) {
  cam.fov = c.fov; cam.aspect = W / H; cam.position.copy(c.pos); cam.lookAt(c.look);
  cam.rotateX(c.rot.x); cam.rotateY(c.rot.y); cam.rotateZ(c.rot.z);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
}
const projCam = new THREE.PerspectiveCamera(50, W / H, 0.05, 1e5);
function toScreen(c, p) {
  poseCamera(projCam, c);
  const v = p.clone().project(projCam);
  return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, ok: v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.92 };
}

// ------------------------------------------------------------------ time of day: dusk at the office, a sunrise with no one going to work, a clear morning, dusk again
const C = (h) => new THREE.Color(h);
const TOD = {
  dusk: { zen: C('#040917'), hor: C('#1c2747'), glow: C('#ff7a3a').multiplyScalar(0.22), sun: V(-0.4, -0.06, -1), stars: 0.7, disc: 0, sunCol: C('#8fa8ff'), sunI: 0.35, sky: C('#3a4c78'), gnd: C('#1a1612'), hemiI: 0.55, fog: C('#141c33'), fogD: 0.0042, expo: 1.0, street: 1, day: 0, amb: [0.035, 0.042, 0.07], sunG: [0, 0, 0] },
  dawn: { zen: C('#2a4a7c'), hor: C('#f2a072'), glow: C('#ffb27a').multiplyScalar(1.0), sun: V(-0.5, 0.06, -0.86), stars: 0, disc: 1, sunCol: C('#ffb27a'), sunI: 1.8, sky: C('#8aa0c8'), gnd: C('#4a3a32'), hemiI: 0.8, fog: C('#c4968a'), fogD: 0.0015, expo: 0.95, street: 0.25, day: 0.6, amb: [0.2, 0.2, 0.24], sunG: [0.5, 0.33, 0.22] },
  day: { zen: C('#3d7bd0'), hor: C('#bcd8ee'), glow: C('#fff2d0').multiplyScalar(0.6), sun: V(0.55, 0.6, 0.58), stars: 0, disc: 1, sunCol: C('#fff1dc'), sunI: 2.8, sky: C('#a8c8ec'), gnd: C('#6b6250'), hemiI: 1.05, fog: C('#b9cde0'), fogD: 0.0017, expo: 0.85, street: 0, day: 1, amb: [0.42, 0.46, 0.52], sunG: [0.9, 0.85, 0.75] },
  dayB: null,
  dusk2: { zen: C('#08122e'), hor: C('#6a3a5c'), glow: C('#ff8a4a').multiplyScalar(0.7), sun: V(-0.2, -0.02, -1), stars: 0.35, disc: 0, sunCol: C('#b0a0ff'), sunI: 0.4, sky: C('#4a4c80'), gnd: C('#1a1612'), hemiI: 0.6, fog: C('#2a2140'), fogD: 0.0035, expo: 1.0, street: 1, day: 0, amb: [0.05, 0.05, 0.08], sunG: [0, 0, 0] },
};
TOD.dayB = Object.assign({}, TOD.day, { sun: V(0.5, 0.6, -0.62).normalize(), expo: 0.72 });
function mixTod(a, b, u) {
  const o = {};
  for (const key of Object.keys(a)) {
    const x = a[key], y = b[key];
    o[key] = x.isColor ? x.clone().lerp(y, u) : x.isVector3 ? x.clone().lerp(y, u).normalize() : Array.isArray(x) ? x.map((q, i) => lerp(q, y[i], u)) : lerp(x, y, u);
  }
  return o;
}
function todAt(t) {
  if (t < T_MORNING + 0.3) return TOD.dusk;
  if (t < SAY.twist) return mixTod(TOD.dusk, TOD.dawn, smooth(T_MORNING + 0.3, T_ZERO + 0.4, t));
  if (t < SAY.fix) return TOD.day;
  if (t < SAY.outro) return TOD.dayB;
  return TOD.dusk2;
}

// ------------------------------------------------------------------ people: who is where, doing what, at every moment
const r = new Rng(77);
const hash = (a, b, c = 0) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };
const angLerp = (a, b, u) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * u; };
function walker(path, tw, v, h0, h1 = null) {
  const L = pathLen(path);
  return {
    L, end: tw + L / v,
    at(t) {
      if (t < tw) return { x: path[0][0], z: path[0][1], h: h0, moving: 0, dist: 0 };
      const d = (t - tw) * v, q = pathAt(path, Math.min(d, L));
      const h = d >= L && h1 != null ? angLerp(q.h, h1, smooth(0, 0.5, (d - L) / v)) : angLerp(h0, q.h, smooth(0, 0.45, t - tw));
      return { x: q.x, z: q.z, h, moving: d < L ? 1 : 0, dist: d };
    },
  };
}
const WORKERS = [];
for (let f = 1; f <= 12; f++) for (let ri = 0; ri < 3; ri++) for (let ci = 0; ci < 5; ci++) {
  const s = seatPos(f, ci, ri), tf = deskT(f, ci, ri), hero = f === HERO.f && ci === HERO.ci && ri === HERO.ri;
  const ts = hero ? FLIP[2] + 1.0 : tf + 0.55 + 0.5 * hash(f, ci, ri), tw = ts + 0.45;
  const za = ROWS[ri] + 1.75;
  const path = [[s.x, s.z], [s.x, za], [10, za], [10, -1.8], [12.6, -1.8]];
  WORKERS.push({ f, ci, ri, s, tf, ts, tw, hero, w: walker(path, tw, 1.55 + 0.2 * hash(ci, f, ri), Math.PI) });
}
// the street: someone reading the hiring sign; a plumber and a nurse; robots; a self-driving truck
const READER = { at: walker([[-1.4, 10.3], [-1.2, 10.9], [9, 11.2]], wordT('quiet', 'young') + 0.9, 1.0, -2.53) };
const T_STOP = wordT('robots', 'robots') + 0.3;
const PLUMBER = (() => { const w = walker([[9, 24.9], [-30, 24.9]], SAY.robots - 3.2, 1.3, -Math.PI / 2); const xStop = 9 - (T_STOP - (SAY.robots - 3.2)) * 1.3;
  return { at: (t) => (t < T_STOP ? w.at(t) : { x: xStop, z: 24.9, h: -Math.PI / 2 + 2.3 * smooth(T_STOP, T_STOP + 0.7, t), moving: 0, dist: (T_STOP - SAY.robots + 3.2) * 1.3 }) }; })();
const NURSE = walker([[-16, 25.9], [30, 25.9]], SAY.robots - 4.5, 1.35, Math.PI / 2);
const STREET_BOTS = [0, 1, 2].map((i) => walker([[13 + i * 1.3, 25.1 + i * 0.45], [-40 + i * 1.3, 25.1 + i * 0.45]], T_ROBOT - 2.6, 1.3, -Math.PI / 2));
const DELIVERY = [[-14, 26.7, T_ROBOT - 1.0, 1.7], [-19, 26.5, T_ROBOT, 1.8]].map(([x, z, t0, v]) => ({ x0: x, z, t0, v }));
// robots in the supermarket: up and down the aisles with cartons
const STORE_BOTS = [[-16.5, 0], [-11.5, 3.3], [-6.5, 1.7], [-16.5, 6.1], [-1.5, 4.4]].map(([x, ph]) => {
  const path = [[x, 31.2], [x, 41.5], [x + 0.01, 31.2]];
  return { x, ph, path, L: pathLen(path) };
});
const storeBotAt = (b, t) => { const v = 1.1, s = ((t + b.ph) * v) % b.L; const q = pathAt(b.path, s); return { x: q.x, z: q.z, h: q.h, moving: 1, dist: (t + b.ph) * v }; };
// people relaxing on the lawn on the first morning with no work
const LOUNGE = [[-11, 10.2, 1.2, 'lie'], [-8.5, 11.5, -0.4, 'sit'], [-6.2, 10.4, 2.5, 'armsUp'], [-3.5, 11.2, 0.3, 'lie'], [-1.2, 10.0, 3.0, 'sit'],
  [1.5, 11.4, -2.6, 'phoneLow'], [4.0, 10.3, 0.0, 'lie'], [6.5, 11.6, 2.0, 'sit'], [9.0, 10.5, -1.0, 'armsUp'], [11.4, 11.3, 1.8, 'sit']];
// the flats: what each person does with the free time (room, dx, z, heading, pose, extra)
const FLAT_PPL = [[0, -0.4, 32.8, 0.9, 'paint'], [1, -0.8, 33.4, 0.3, 'dance'], [1, 0.8, 33.2, -0.5, 'dance'], [2, 0.4, 33.4, 0, 'cook'],
  [3, 1.0, 34.9, Math.PI, 'sitRead'], [4, 0.0, 33.0, -Math.PI / 2 + 0.3, 'desk'], [5, -0.6, 35.2, Math.PI, 'kidJump'], [5, 0.4, 35.0, Math.PI, 'kidJump'],
  [6, 0.7, 33.6, 0, 'desk'], [7, -0.2, 34.4, 0, 'pointFwd'], [8, -0.6, 33.2, Math.PI / 2, 'desk'], [9, -0.4, 35.1, Math.PI, 'sitRead'], [9, 0.8, 35.1, Math.PI, 'sit'],
  [10, -1.6, 33.6, 1.0, 'paint'], [11, 0.0, 33.9, 0, 'cook']];
const OWNER = { x: 1.5, z: 6.7, y: 13 * FH };

// ------------------------------------------------------------------ the history stage: a hundred people
const GRID = [];
for (let row = 0; row < 10; row++) for (let col = 0; col < 10; col++) {
  const i = row * 10 + col, farmer = row >= 6;                          // the four rows nearest the camera farmed in 1900
  GRID.push({ i, row, col, x: (col - 4.5) * 0.92, z: (row - 4.5) * 0.92, farmer, stays: farmer && row === 9 && col === 4,
    tPop: SAY.history + 0.15 + (row * 10 + (row % 2 ? 9 - col : col)) * 0.011, tSwap: T_TODAY + 0.12 + hash(row, col, 9) * 0.9 });
}
const NEW_JOBS = [[63, 'APP DEVELOPER'], [27, 'DRONE PILOT'], [86, 'YOUTUBER']];

// ------------------------------------------------------------------ sound
const S_ = (file, t, o = {}) => Object.assign({ type: 'sample', file, t }, o);
function buildAudio() {
  const A = [];
  const fx = (type, o) => A.push(Object.assign({ type, fx: true }, o));
  const keysEvery = (f, step = 0.05) => { const ks = []; for (let t = 0; t <= DURATION; t += step) ks.push([+t.toFixed(2), +f(t).toFixed(3)]); return ks; };
  for (const key of ORDER) A.push(S_(VO[key].file, SAY[key], { level: 1.35, free: true, verb: 0.025, fin: 0.005, fout: 0.03 }));
  const talking = (t) => { let q = 0; for (const key of ORDER) { const at = SAY[key]; q = Math.max(q, smooth(at - 0.12, at, t) * (1 - smooth(at + VO[key].dur, at + VO[key].dur + 0.35, t))); } return q; };
  A.push({ type: 'fxduck', keys: keysEvery((t) => 1 - 0.5 * talking(t), 0.04) });
  // music: a tense sci-fi score until no job is left, a beat of silence, a pulse under the problem, then a hopeful one
  A.push(S_('music/464.mp3', 0, { offset: 6, level: 0.5, fin: 0.3, fout: 0.08, dur: T_ZERO + 0.05, keys: keysEvery((t) => (t < T_ZERO - 0.55 ? 1 : 0.15) * (1 - 0.7 * talking(t))) }));
  fx('pulse', { t0: T_PROBLEM, t1: SAY.fix - 0.1, bpm: [84, 132], level: 0.32 });
  A.push(S_('music/606.mp3', SAY.fix - 0.2, { offset: 14, level: 0.5, fin: 0.6, fout: 2.4, dur: DURATION - SAY.fix + 0.2, keys: keysEvery((t) => 1 - 0.68 * talking(t)) }));
  // the office: keyboards, a hum; the city at night; birds on the first free morning
  const clicks = []; { const cr = new Rng(5); for (let t = 0.05; t < HERO_T; t += cr.float(0.06, 0.16)) clicks.push(t); }
  clicks.forEach((t, i) => fx('sample', { file: 'sfx/1117.wav', t, level: 0.16 + 0.08 * hash(i, 1), pan: -0.2 + 0.4 * hash(i, 2) }));
  A.push(S_('sfx/2678.wav', 0, { dur: SAY.hundred + 1, level: 0.38, fin: 0.5, fout: 1.5, keys: keysEvery((t) => (t < SAY.quiet ? 0.35 : t < SAY.safe ? 1 : t < SAY.robots ? 0.5 : 1) * (1 - 0.5 * talking(t))) }));
  A.push(S_('sfx/367.wav', SAY.twist, { offset: 4, dur: T_PROBLEM - SAY.twist + 0.15, level: 0.7, fin: 0.05, fout: 0.1 }));
  // every flip: a glitch and a falling chirp; floors going dark: a heavy switch
  fx('sample', { file: 'sfx/1022.wav', t: HERO_T, level: 0.5 });
  for (let f = 1; f <= 12; f++) {
    if (FLIP[f] > 1e3) continue;
    fx('chirp', { t: FLIP[f] + 0.02, level: 0.14, seed: 60 + f, f: [2200 - f * 60, 900] });
    fx('sweep', { t: FLIP[f] + 0.1, pre: 0.05, post: 0.6, f: [3800, 600], q: 2.0, level: 0.12, pan: [-0.5, 0.5], seed: 80 + f });
    if (f !== 2 && f !== 4) fx('powerdown', { t: LOUT[f], level: 0.1 });
  }
  fx('sample', { file: 'sfx/1022.wav', t: FLIP[2], level: 0.35 });
  // camera moves
  fx('sample', { file: 'sfx/1492.wav', t: FLIP[2] + 0.1, level: 0.4 });
  fx('sample', { file: 'sfx/2604.wav', t: SAY.goal + 0.3, level: 0.35 });
  fx('sample', { file: 'sfx/2605.wav', t: SAY.screens + 0.5, level: 0.3 });
  fx('sample', { file: 'sfx/1490.wav', t: SAY.safe - 0.15, level: 0.32 });
  fx('riser', { t0: SAY.safe + 0.4, t1: endOf('safe') + 0.15, level: 0.16, curve: 2.4 });
  // the sign flips; footsteps of robots; the truck; the shop goes dark
  fx('sample', { file: 'sfx/1104.wav', t: wordT('quiet', 'stop') + 0.1, level: 0.55 });
  for (let n = 0; n < 14; n++) { const t = T_ROBOT - 1.6 + n * 0.46 + 0.23; if (t > SAY.hundred - 0.2) break; fx('clank', { t, level: 0.12, f: 420 + (n % 2) * 90, pan: -0.2 + (n % 3) * 0.2, seed: 300 + n }); }
  fx('jet', { t: T_TRUCK - 1.2, dur: 2.8, peak: 0.42, level: 0.35, seed: 31 });
  fx('sample', { file: 'sfx/2625.wav', t: T_TRUCK + 0.15, level: 0.4 });
  for (let s = 0; s < 3; s++) fx('powerdown', { t: T_DARK + s * 0.38, level: 0.22 });
  // one morning: a riser, silence, the hit
  A.push({ type: 'duck', keys: [[0, 1], [T_ZERO - 0.45, 1], [T_ZERO - 0.35, 0.08], [T_ZERO - 0.01, 0.08], [T_ZERO + 0.02, 1], [DURATION, 1]] });
  fx('sweep', { t: T_ZERO - 0.4, pre: 2.4, post: 0.02, f: [220, 9500], q: 1.2, curve: 2.8, tone: 0.5, level: 0.45, pan: [-0.3, 0.3], seed: 50 });
  A.push(S_('sfx/2896.wav', T_ZERO, { level: 0.75, free: true }));
  A.push({ type: 'subdrop', t: T_ZERO, dur: 1.6, level: 0.5, free: true });
  // here's the problem: a stop, a thud; the cartons; the tills
  A.push(S_('sfx/563.wav', T_PROBLEM - 0.2, { level: 0.32, free: true }));
  for (let n = 0; n < 10; n++) fx('sample', { file: 'sfx/2364.wav', t: T_PROBLEM + 0.6 + n * 0.42, level: 0.12, pan: -0.4 + 0.08 * n });
  fx('sample', { file: 'sfx/2380.wav', t: wordT('twist', 'paychecks') + 0.05, level: 0.4 });
  fx('sample', { file: 'sfx/2380.wav', t: wordT('twist', 'buying') + 0.05, level: 0.4 });
  // the robot tax: coins pouring out, a chime as each home lights up
  fx('sparkle', { t: T_TAX - 0.1, dur: 2.6, count: 30, f: [1800, 5200], level: 0.22, seed: 70 });
  fx('sample', { file: 'sfx/2350.wav', t: T_TAX - 0.2, level: 0.4 });
  for (let i = 0; i < 6; i++) fx('chime', { t: T_TAX + 1.3 + i * 0.18, level: 0.07, freq: [659.25, 783.99, 987.77, 1046.5, 1318.5, 1567.98][i] });
  fx('sparkle', { t: T_HAPPY, dur: 1.2, count: 10, f: [1500, 4200], level: 0.16, seed: 71 });
  // history: a pop for every person, a swoosh as they change
  for (const g of GRID) if (g.i % 3 === 0) fx('sample', { file: 'sfx/1124.wav', t: g.tPop + 0.15, level: 0.1, pan: (g.col - 4.5) / 6 });
  fx('sample', { file: 'sfx/2903.wav', t: T_1900 + 0.05, level: 0.35 });
  fx('sample', { file: 'sfx/2350.wav', t: T_TODAY + 0.05, level: 0.45 });
  fx('sparkle', { t: T_TODAY + 0.1, dur: 1.2, count: 22, f: [1500, 5000], level: 0.2, seed: 72 });
  fx('sparkle', { t: T_NEW, dur: 1.0, count: 8, f: [2000, 5200], level: 0.16, seed: 73 });
  // the owner
  fx('sample', { file: 'sfx/1490.wav', t: SAY.outro - 0.2, level: 0.3 });
  A.push({ type: 'braam', t: T_OWNS - 0.05, level: 0.42, free: true, dur: 4, root: 33 });
  fx('sample', { file: 'sfx/2604.wav', t: SAY.cta + 0.3, level: 0.35 });
  A.push({ type: 'chime', t: END, level: 0.2, free: true });
  return A;
}

// ------------------------------------------------------------------ the hook's icon: a robot head over a briefcase
const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
<rect x="22" y="58" width="76" height="50" rx="8" fill="#f4f1ea"/><rect x="46" y="49" width="28" height="12" rx="4" fill="none" stroke="#f4f1ea" stroke-width="5"/>
<rect x="22" y="76" width="76" height="5" fill="#2a2f38"/>
<rect x="34" y="10" width="52" height="40" rx="10" fill="#0c1a2a" stroke="#5ff3ff" stroke-width="4"/>
<circle cx="50" cy="30" r="6" fill="#5ff3ff"/><circle cx="70" cy="30" r="6" fill="#5ff3ff"/><line x1="60" y1="2" x2="60" y2="10" stroke="#5ff3ff" stroke-width="4"/><circle cx="60" cy="3" r="3.5" fill="#5ff3ff"/></svg>`;

// ------------------------------------------------------------------ HUD sub-lines
const SUBS = [
  [SAY.goal + 0.4, 'TODAY · ~5% OF US JOBS AT HIGH RISK (SHRM)'],
  [SAY.screens, 'STAGE 1 · ANY JOB DONE ON A SCREEN'],
  [wordT('quiet', 'companies'), 'AGES 22–25 IN AI-EXPOSED JOBS: −13% SINCE 2022'],
  [SAY.safe, "STAGE 2 · THE 'SAFE' OFFICE JOBS"],
  [T_ROBOT, 'STAGE 3 · ROBOTS GET CHEAP'],
  [T_ZERO, 'STAGE 4 · NO JOBS LEFT'],
];
const subAt = (t, list) => { let s = list[0][1], at = -9; for (const [t0, txt] of list) if (t >= t0) { s = txt; at = t0; } return { sub: s, age: t - at }; };
const fmtInt = (n) => Math.round(n).toLocaleString('en-US');

// ------------------------------------------------------------------ the scenario
export default {
  id: 'ai-jobs',
  title: 'What if AI took every job?',
  titleWords: [['What', 0], ['if', 0], ['AI', 1], ['took', 0], ['your', 0], ['job?', 1]],
  titleIcon: ICON, titleAnimAt: 0.05,
  css: '#goal .fill { background: linear-gradient(90deg, #5ff3ff, #2a8dff); } #goal .dot { box-shadow: 0 0 16px rgba(90,230,255,0.95), 0 0 0 4px #2a8dff; } #goal .tick.on { background: #5ff3ff; box-shadow: 0 0 10px rgba(90,230,255,0.9), 0 0 0 2px rgba(0,0,0,0.25); }',
  endFact: 'In 1900 about <b>4 in 10</b> American workers farmed. Today it’s about <b>1 in 100</b>, and most of today’s jobs didn’t exist in 1940.',
  duration: DURATION,
  titleIn: [-1, -0.5], titleOut: [wordT('hook', 'and') - 0.25, wordT('hook', 'and') + 0.05],
  fadeOut: FADE, endAt: END, endSpeed: 1.3,
  captions: CAPTIONS,
  captionFade: 0.08,
  goal(t) {
    const a = smooth(SAY.goal + 0.3, SAY.goal + 0.8, t) * (1 - smooth(SAY.twist - 0.4, SAY.twist, t));
    if (a <= 0) return null;
    const j = jobsAt(t);
    const ticks = [[FLIP[3] + 0.8, 0.14], [FLIP[12] + 1.0, 0.6], [wordT('robots', 'lights') + 0.4, 0.95]].map(([t0, kk]) => ({ k: kk, on: t >= t0, pop: Math.exp(-Math.pow((t - t0) / 0.12, 2)) }));
    const pct = j >= 0.9995 ? '100%' : j < 0.0005 ? '0%' : j < 0.1 ? `${(j * 100).toFixed(1)}%` : `${Math.floor(j * 100)}%`;
    return { label: j >= 0.9995 ? 'EVERY JOB · DONE BY AI' : 'JOBS DONE BY AI', pct, k: j, from: 'TODAY', to: 'EVERY JOB', alpha: a, ticks };
  },
  hud(t) {
    if (t >= FADE[1]) return null;
    // the countdown of people with a job
    if (t < SAY.twist) {
      const a = smooth(SAY.goal + 0.5, SAY.goal + 1.0, t) * (1 - smooth(SAY.twist - 0.3, SAY.twist, t));
      const j = jobsAt(t), s = subAt(t, SUBS);
      let pop = 0; for (let f = 1; f <= 12; f++) pop = Math.max(pop, Math.exp(-Math.pow((t - FLIP[f] - 0.5) / 0.2, 2)));
      pop = Math.max(pop, Math.exp(-Math.pow((t - T_ZERO) / 0.25, 2)));
      return { label: 'AMERICANS WITH A JOB', value: fmtInt(Math.round(US_JOBS * (1 - j) / 1000) * 1000), value2: '', sub: s.sub, subAge: s.age, pop, alpha: a };
    }
    if (t < SAY.fix) {
      const a = smooth(T_PROBLEM + 0.2, T_PROBLEM + 0.6, t) * (1 - smooth(SAY.fix - 0.3, SAY.fix, t));
      const s = subAt(t, [[T_PROBLEM, 'SHELVES FULL · NOBODY CAN PAY']]);
      return { label: 'PAYCHECKS THIS MONTH', value: '$0', value2: '€0', sub: s.sub, subAge: s.age, pop: Math.exp(-Math.pow((t - wordT('twist', 'paychecks') - 0.3) / 0.2, 2)), alpha: a };
    }
    if (t < SAY.history) {
      const a = smooth(SAY.finland + 0.2, SAY.finland + 0.7, t) * (1 - smooth(SAY.history - 0.3, SAY.history, t));
      const s = subAt(t, [[SAY.finland, 'FINLAND · 2017–18 · 2,000 PEOPLE · 2 YEARS'], [T_HAPPY - 0.3, 'RESULT: HAPPIER · LESS STRESSED']]);
      return { label: 'FREE MONEY, EVERY MONTH', value: '€560', value2: '≈ $630', sub: s.sub, subAge: s.age, pop: Math.exp(-Math.pow((t - wordT('finland', 'six') - 0.3) / 0.2, 2)), alpha: a };
    }
    if (t < SAY.outro) {
      const a = smooth(T_1900, T_1900 + 0.4, t) * (1 - smooth(SAY.outro - 0.3, SAY.outro, t));
      const n = t < T_TODAY + 0.1 ? Math.round(40 * smooth(T_1900, T_1900 + 0.6, t)) : Math.round(lerp(40, 1, smooth(T_TODAY + 0.1, T_TODAY + 1.1, t)));
      const s = subAt(t, [[T_1900, '1900 · US CENSUS / USDA'], [T_TODAY, 'TODAY · BLS'], [T_NEW - 0.2, "60% OF TODAY'S JOBS DIDN'T EXIST IN 1940 · MIT"]]);
      return { label: 'FARMERS PER 100 WORKERS', value: String(n), value2: '', sub: s.sub, subAge: s.age, pop: Math.exp(-Math.pow((t - T_TODAY - 1.15) / 0.2, 2)), alpha: a };
    }
    return null;
  },
  labels(t) {
    const out = [], c = camAt(t);
    const call = (t0, t1, p, text, side, big = false) => {
      const a = smooth(t0, t0 + 0.3, t) * (1 - smooth(t1 - 0.3, t1, t)); if (a <= 0.001) return;
      const s = toScreen(c, p); if (!s.ok || (!big && s.y < 470)) return;
      out.push({ x: s.x, y: s.y, text, alpha: a, big, side: big ? side : s.x < W * 0.4 ? 'right' : s.x > W * 0.6 ? 'left' : side });
    };
    call(FLIP[1] + 0.1, SAY.quiet, V(-7.5, 1 * FH + 0.3, 7.6), 'CALL CENTERS', 'right');
    call(wordT('screens', 'data') - 0.1, SAY.quiet, V(-7.5, 2 * FH + 0.3, 7.6), 'DATA ENTRY', 'right');
    call(FLIP[3] + 0.1, SAY.quiet, V(-7.5, 3 * FH + 0.3, 7.6), 'TRANSLATORS', 'right');
    call(FLIP[6] + 0.1, FLIP[6] + 2.2, V(6, 6 * FH + 0.3, 7.6), 'CODERS', 'left');
    call(FLIP[7] + 0.1, FLIP[7] + 2.2, V(6, 7 * FH + 0.3, 7.6), 'LAWYERS', 'left');
    call(FLIP[8] + 0.1, FLIP[8] + 2.2, V(6, 8 * FH + 0.3, 7.6), 'ACCOUNTANTS', 'left');
    { const q = STREET_BOTS[0].at(t); call(T_ROBOT + 0.3, T_TRUCK - 0.2, V(q.x, 2.0, q.z), 'HUMANOID ROBOT', 'right'); }
    call(T_TRUCK + 0.1, T_TRUCK + 1.2, V(truckX(t) + 2, 3.0, 22.0), 'NO DRIVER', 'right');
    call(T_ZERO + 0.05, SAY.twist - 0.05, V(15, 44, 8), '100%', 'right', true);
    call(T_TAX + 0.1, T_TAX + 1.6, V(-3, 62, 0), 'ROBOT TAX', 'right');
    call(T_TAX + 1.2, SAY.finland + 1.0, V(15, 13.6, 28), 'A CHECK FOR EVERY HOME', 'left');
    call(T_1900 + 0.1, T_TODAY - 0.05, V(0, 2.6, -5.2), '1900', 'right', true);
    call(T_TODAY + 0.05, endOf('history') + 0.3, V(0, 2.6, -5.2), 'Today', 'right', true);
    call(T_TODAY + 1.2, endOf('history') + 0.3, V(GRID[94].x, 2.1, GRID[94].z), 'STILL FARMING', 'right');
    NEW_JOBS.forEach(([i, txt], n) => call(T_NEW + n * 0.2, endOf('history') + 0.3, V(GRID[i].x, 2.0, GRID[i].z), txt, n % 2 ? 'left' : 'right'));
    call(T_OWNS + 0.1, SAY.cta + 0.3, V(OWNER.x, OWNER.y + 1.95, OWNER.z), 'THE OWNER', 'left');
    return out;
  },
  audio: buildAudio(),

  async setup(ctx) {
    const { renderer } = ctx;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.0;
    ctx.grain = 0; ctx.vignette = 0; ctx.handheld = 0;
    ctx.grade = { brightness: 1.0, contrast: 1.0, saturate: 1.0, sepia: 0 };
    ctx.post = { layered: true, bloom: { strength: 0.5, radius: 0.5, threshold: 1.15 }, dof: { focus: 10, aperture: 0.004, maxBlur: 0.012, farBlur: 0.25 },
      grade: { contrast: 1.1, saturation: 1.08, lift: [0.0, 0.006, 0.018], gain: [1.03, 1.0, 0.97], split: 0.12, vignette: 0.3, grain: 0.035, ca: 0.0014 } };
    if (this.css && typeof document !== 'undefined') { const s = document.createElement('style'); s.textContent = this.css; document.head.appendChild(s); }
    const st = this.st = {}; window.__st = st;
    const IU = st.IU = makeIU();
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0.0 ? mix(vec3(0.5,0.52,0.6), vec3(0.25,0.32,0.5), pow(h, 0.5)) : mix(vec3(0.3,0.28,0.27), vec3(0.08,0.08,0.09), pow(-h, 0.4)); c += vec3(1.0, 0.7, 0.4) * pow(max(dot(vD, normalize(vec3(-0.5, 0.15, 0.8))), 0.0), 12.0); gl_FragColor = vec4(c, 1.0); }',
    })));
    const env = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0).texture;
    // ---- the main set
    const scene = st.scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#141c33', 0.004);
    scene.environment = env; scene.environmentIntensity = 0.25;
    st.hemi = new THREE.HemisphereLight('#3a4c78', '#1a1612', 0.55);
    st.sun = new THREE.DirectionalLight('#8fa8ff', 0.35);
    st.sun.castShadow = true; st.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(st.sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 260 });
    st.sun.shadow.bias = -0.0004; st.sun.shadow.normalBias = 0.04;
    scene.add(st.hemi, st.sun, st.sun.target);
    scene.add(buildSky(st));
    scene.add(buildTower(st, IU, env), buildStore(st, IU, env), buildFlats(st, IU, env), buildStreet(st, IU), buildCity(st, env), buildRobotBits(st, IU), buildCoins(st));
    // ---- people
    const ppl = st.ppl = buildPeople({ max: 320, seed: 11 });
    patchInterior(ppl.group.children[0].material, IU, 'people');
    scene.add(ppl.group);
    const P = ppl.POSES;
    P.desk = (ph, t, s) => ({ legL: 1.5, legR: 1.5, drop: 0.38, torso: 0.06, armL: 1.05 + 0.07 * Math.sin(t * 14 + s), armR: 1.05 + 0.07 * Math.sin(t * 15.3 + s + 1), armLr: -0.2, armRr: 0.2, head: 0.14 });
    P.deskShock = (ph, t, s) => ({ legL: 1.5, legR: 1.5, drop: 0.38, torso: -0.12, armL: 2.3, armR: 2.3, armLr: -0.75, armRr: 0.75, head: -0.1 });
    P.carry = (ph) => { const sn = Math.sin(ph); return { legL: 0.5 * sn, legR: -0.5 * sn, armL: 1.25, armR: 1.25, armLr: -0.18, armRr: 0.18, bob: 0.035 * Math.abs(Math.cos(ph)), torso: 0.05, head: 0.05 }; };
    P.robotWalk = (ph) => { const sn = Math.sin(ph); return { legL: 0.42 * sn, legR: -0.42 * sn, armL: -0.15 * sn, armR: 0.15 * sn, armLr: 0.1, armRr: -0.1, bob: 0.02 * Math.abs(Math.cos(ph)) }; };
    P.robotCarry = (ph) => { const sn = Math.sin(ph); return { legL: 0.42 * sn, legR: -0.42 * sn, armL: 1.3, armR: 1.3, armLr: -0.16, armRr: 0.16, bob: 0.02 * Math.abs(Math.cos(ph)) }; };
    P.slump = (ph, t, s) => ({ armL: 0.1, armR: 0.1, head: 0.42, torso: 0.12 });
    P.lie = () => ({ armL: 2.9, armR: 2.9, armLr: 0.3, armRr: -0.3, head: 0 });
    P.paint = (ph, t, s) => ({ armR: 1.65 + 0.12 * Math.sin(t * 5 + s), armRr: -0.1 + 0.15 * Math.cos(t * 5 + s), armL: 0.5, armLr: 0.3, head: 0.05, torso: 0.04 });
    P.cook = (ph, t, s) => ({ armL: 0.95 + 0.1 * Math.sin(t * 7 + s), armR: 1.0 + 0.15 * Math.sin(t * 9 + s + 2), armLr: -0.15, armRr: 0.15, head: 0.35 });
    P.dance = (ph, t, s) => ({ armL: 2.6 + 0.4 * Math.sin(t * 7 + s), armR: 2.6 + 0.4 * Math.sin(t * 7 + s + 3), armLr: 0.35, armRr: -0.35, torso: 0.08 * Math.sin(t * 7 + s), torsoYaw: 0.25 * Math.sin(t * 3.5 + s), legL: 0.2 * Math.max(0, Math.sin(t * 7 + s)), legR: 0.2 * Math.max(0, -Math.sin(t * 7 + s)), drop: -0.05 * Math.abs(Math.sin(t * 7 + s)), head: -0.15 });
    P.sitRead = (ph, t, s) => ({ legL: 1.5, legR: 1.5, drop: 0.4, armL: 1.0, armR: 1.0, armLr: -0.25, armRr: 0.25, head: 0.45, torso: -0.1 });
    P.kidJump = (ph, t, s) => ({ armL: 2.4 + 0.3 * Math.sin(t * 9 + s), armR: 2.4 + 0.3 * Math.sin(t * 9 + s), armLr: 0.4, armRr: -0.4, drop: -0.25 * Math.abs(Math.sin(t * 4.5 + s)), legL: 0.3, legR: 0.3, head: -0.2 });
    P.boss = (ph, t, s) => ({ armL: -0.3, armR: -0.3, armLr: -0.2, armRr: 0.2, head: 0.12 + 0.03 * Math.sin(t * 0.6), torso: -0.03 });
    P.toast = (ph, t, s) => ({ armR: 1.95, armRr: -0.05, armL: -0.3, armLr: -0.2, head: -0.05, torso: -0.04 });
    // office workers
    st.workers = [];
    for (const w of WORKERS) {
      const poses = [[0, 'desk']];
      if (w.hero) poses.push([HERO_T + 0.25, 'deskShock', 0.22]);
      poses.push([w.ts, 'idle', 0.35], [w.tw, 'carry', 0.3]);
      const spec = ppl.add(Object.assign({ y: w.f * FH, poses, at: w.w.at, visible: (t) => t < w.w.end, longSleeve: r.chance(0.6) },
        w.hero ? { shirt: '#2e86c1', hair: 'short', skin: '#c68a62', hairC: '#1d1612', pants: '#2c3e50' } : {}));
      st.workers.push({ w, spec });
    }
    // the reader at the door, pedestrians, plumber, nurse, robots
    ppl.add({ at: READER.at.at, poses: [[0, 'idle'], [wordT('quiet', 'stop') + 0.25, 'idle'], [wordT('quiet', 'young') - 0.1, 'slump', 0.4], [wordT('quiet', 'young') + 0.9, 'walk', 0.3]], visible: (t) => t > SAY.quiet - 1 && t < SAY.safe, scale: 0.97, shirt: '#e67e22', hair: 'bun', pants: '#3b4a6b' });
    for (let i = 0; i < 5; i++) { const x0 = -30 + i * 9, dir = i % 2 ? 1 : -1; ppl.add({ path: [[x0, 12.6 + (i % 3) * 0.5], [x0 + dir * 60, 12.6 + (i % 3) * 0.5]], v: 1.3, t0: SAY.quiet - 2, poses: [[0, 'auto']], visible: (t) => t > SAY.quiet - 1 && t < SAY.safe }); }
    ppl.add({ at: PLUMBER.at, poses: [[0, 'carry'], [T_STOP, 'shrug', 0.4]], visible: (t) => t > SAY.robots - 1 && t < SAY.hundred, shirt: '#2e5fa8', pants: '#2e5fa8', hair: 'cap', hairC: '#2e5fa8', longSleeve: false });
    ppl.add({ at: NURSE.at, poses: [[0, 'auto']], visible: (t) => t > SAY.robots - 1 && t < SAY.hundred, shirt: '#3aa6a0', pants: '#3aa6a0', hair: 'bun', longSleeve: false });
    const ROBOT_LOOK = { skin: '#cfd5dc', shirt: '#eef1f4', pants: '#8d949c', hair: 'none', longSleeve: true, scale: 1.04 };
    STREET_BOTS.forEach((b, i) => ppl.add(Object.assign({ at: b.at, poses: [[0, 'robotWalk']], gait: 0, seed: 1, visible: (t) => t > SAY.robots && t < SAY.hundred }, ROBOT_LOOK)));
    STORE_BOTS.forEach((b) => ppl.add(Object.assign({ at: (t) => storeBotAt(b, t), poses: [[0, 'robotCarry']], seed: b.ph, visible: (t) => t < SAY.fix || t > SAY.outro }, ROBOT_LOOK)));
    for (const [x, z, h, pose] of LOUNGE) ppl.add({ x, z, h, poses: [[0, pose]], tilt: pose === 'lie' ? () => -Math.PI / 2 : null, y: pose === 'lie' ? 0.15 : 0, visible: (t) => t > SAY.twist - 0.3 && t < T_PROBLEM + 0.1 });
    for (const [room, dx, z, h, pose] of FLAT_PPL) {
      const R = ROOMS[room], kid = pose === 'kidJump';
      ppl.add({ x: R.x + dx, z, h, y: R.y, kid, poses: [[0, pose], [T_HAPPY + 0.1 + room * 0.03, 'dance', 0.35]], visible: (t) => t > SAY.fix - 0.5 && t < SAY.history });
    }
    ppl.add({ x: OWNER.x, z: OWNER.z, y: OWNER.y, h: 0, poses: [[0, 'boss'], [T_OWNS + 0.15, 'toast', 0.4]], shirt: '#1b1d24', pants: '#1b1d24', hair: 'short', hairC: '#9a958e', skin: '#e0ac85', longSleeve: true, scale: 1.02 });
    // ---- vehicles: human-driven cars until robots get cheap, self-driving ones after; the truck
    const veh = st.veh = buildVehicles({ seed: 5, max: 60 });
    patchInterior(veh.group.children[0].material, IU, 'veh');
    scene.add(veh.group);
    st.robocars = [];
    const lanes = [[15.6, 1], [17.8, 1], [20.4, -1], [22.6, -1]];
    const vr = new Rng(19);
    for (const [z, dir] of lanes) for (let n = 0; n < 9; n++) {
      const t0 = -30 + n * 7.5 + vr.float(0, 4), v = vr.float(10, 13), robo = t0 > T_ROBOT - 22;
      const path = dir > 0 ? [[-260, z], [260, z]] : [[260, z], [-260, z]];
      const xAt = (t) => (dir > 0 ? -260 : 260) + dir * (t - t0) * v;
      if (Math.abs(xAt(T_ROBOT) + 12) < 70) continue;                // nothing pops in or out near the camera at the swap
      const c = veh.add(Object.assign(robo ? { type: vr.pick(['sedan', 'suv']), paint: '#eef0f2' } : {}, { path, v, t0, loop: false, visible: (t) => t >= t0 && t <= t0 + 520 / v && (robo ? t >= T_ROBOT : t < T_ROBOT) && (t < SAY.hundred || t > SAY.twist) && !(t >= T_PROBLEM && t < SAY.fix) }));
      if (robo) st.robocars.push(c);
    }
    st.truck = veh.add({ type: 'van', path: [[260, 22.0], [-260, 22.0]], v: 11, t0: T_TRUCK + 0.6 - 272 / 11, loop: false, paint: '#f2f4f6', visible: (t) => t > T_TRUCK - 6 && t < SAY.hundred });
    st.robocars.push(st.truck);
    // ---- the history stage
    st.stage = buildStage(st);
    const sp = st.stagePpl = buildPeople({ max: 220, seed: 3 });
    st.stage.scene.add(sp.group);
    const OLD = ['#5d4037', '#4e5d6c', '#6b5a48', '#3b3f46', '#7b6d5a', '#8a7a68'], NEW = ['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#8e44ad', '#f1c40f', '#ecf0f1', '#1abc9c', '#e67e22', '#34495e', '#ff6b9d'];
    for (const g of GRID) {
      const hop = (t0) => (x, z, t) => { const u = t - t0; return u > 0 && u < 0.5 ? 0.9 * Math.sin(Math.PI * u / 0.5) : 0; };
      const pop = (x, z, t) => { const u = t - g.tPop; return u < 0 ? 40 : u < 0.28 ? 3.2 * (1 - u / 0.28) * (1 - u / 0.28) : u < 0.45 ? 0.15 * Math.sin(Math.PI * (u - 0.28) / 0.17) : 0; };
      const swapT = g.stays ? 1e4 : g.tSwap;
      const look1900 = g.farmer ? { shirt: '#4f7a3a', pants: '#6b4f36', hair: 'cap', hairC: '#d8b45a' } : { shirt: OLD[g.i % OLD.length], pants: '#2b2b2b', hair: g.i % 3 ? 'short' : 'cap', hairC: '#3a3a3a' };
      sp.add(Object.assign({ x: g.x, z: g.z, h: 0, poses: [[0, 'idle']], yAt: pop, visible: (t) => t < swapT + 0.25 }, look1900));
      if (!g.stays) sp.add({ x: g.x, z: g.z, h: 0, poses: [[0, 'idle'], [T_NEW, NEW_JOBS.some(([i]) => i === g.i) ? 'wave' : 'idle']], yAt: hop(swapT), visible: (t) => t >= swapT + 0.25, shirt: NEW[(g.i * 7) % NEW.length], pants: r.pick(['#2c3e50', '#1b2631', '#c2b280', '#4e5d6c']), hair: r.pick(['short', 'long', 'bun', 'short']) });
    }
    ctx.poseAt = (t) => this.pose(ctx, t);
  },

  update(ctx, t) {
    this.pose(ctx, t);
    const c = camAt(t), c2 = camAt(t + 1 / 30);
    const v = c.pos.distanceTo(c2.pos) * 30, turn = c.look.clone().sub(c.pos).normalize().angleTo(c2.look.clone().sub(c2.pos).normalize()) * 30;
    const fast = c.shot === c2.shot && (v > 6 || turn > 0.5);
    // the slow high shots (crown, flats, penthouse) go without sub-frames: in them, averaged sub-frames trip a software-rasterizer bug (stray giant triangles)
    const single = (t >= SAY.fix && t < SAY.history) || t >= SAY.outro;
    ctx.motionBlur = { samples: single ? 1 : fast || trauma(t) > 0.2 || Math.abs(t - T_TRUCK - 0.6) < 0.6 ? 4 : 2, shutter: 0.5, reuseDepth: true };
    // shadows: drawn once per frame, not for every motion-blur sub-frame
    ctx.renderer.shadowMap.autoUpdate = !!DBG?.shadowAll; ctx.renderer.shadowMap.needsUpdate = true;
    if (DBG?.depthAgain) ctx.motionBlur.reuseDepth = false;
    if (DBG?.mb) ctx.motionBlur.samples = DBG.mb;
    if (DBG?.only != null) ctx.motionBlur.only = DBG.only;
    if (DBG?.nojit) ctx.motionBlur.noJitter = true;
  },

  pose(ctx, t) {
    if (DBG?.dt) t += DBG.dt;
    // sub-frames never reach across a cut
    if (shotIdx(t) !== shotIdx(ctx.t)) t = ctx.t;
    const st = this.st, IU = st.IU;
    const c = camAt(t);
    if (DBG?.pos) { c.pos = V(...DBG.pos); c.look = V(...DBG.look); c.fov = DBG.fov ?? c.fov; c.rot = { x: 0, y: 0, z: 0 }; }
    const onStage = c.stage && !DBG?.city;
    const cam = onStage ? st.stage.cam : (st.cam ??= new THREE.PerspectiveCamera(40, W / H, 0.25, 4200));
    poseCamera(cam, c);
    ctx.view = { scene: onStage ? st.stage.scene : st.scene, camera: cam };
    const look = c.look;
    ctx.dof = DBG?.pos ? { focus: 10, aperture: 0, farBlur: 0 } : { focus: c.pos.distanceTo(look), aperture: c.aperture ?? (onStage ? 0.003 : 0.004), farBlur: onStage ? 0.0 : 0.22 };
    if (onStage) { this.poseStage(ctx, t); return; }

    // ---- light: the time of day
    const L = todAt(t);
    ctx.renderer.toneMappingExposure = L.expo;
    st.skyU.uZen.value.copy(L.zen); st.skyU.uHor.value.copy(L.hor); st.skyU.uGlow.value.copy(L.glow); st.skyU.uSun.value.copy(L.sun); st.skyU.uStars.value = L.stars; st.skyU.uDisc.value = L.disc;
    st.hemi.color.copy(L.sky); st.hemi.groundColor.copy(L.gnd); st.hemi.intensity = L.hemiI;
    st.sun.color.copy(L.sunCol); st.sun.intensity = L.sunI;
    const sunDir = L.sun.y > 0.05 ? L.sun : V(0.3, 0.8, -0.5).normalize();          // at night the moon, high behind the tower
    st.sun.position.copy(look).addScaledVector(sunDir, 120); st.sun.target.position.copy(look); st.sun.target.updateMatrixWorld();
    st.scene.fog.color.copy(L.fog); st.scene.fog.density = L.fogD;
    st.groundU.uAmb.value.setRGB(...L.amb); st.groundU.uSun.value.setRGB(...L.sunG); st.groundU.uFogC.value.copy(L.fog); st.groundU.uFogD.value = L.fogD;
    IU.uStreet.value = L.street; st.lampHeadM.color.setRGB(3 * L.street + 0.4, 2.2 * L.street + 0.4, 1.3 * L.street + 0.4);
    st.lampGlow.im.visible = L.street > 0.1;
    if (st.lampGlow.im.visible) {
      const M = new THREE.Matrix4(), q = cam.quaternion, s = 1.5;
      st.lampGlow.pts.forEach((p, i) => { M.compose(p, q, V(s, s, s)); st.lampGlow.im.setMatrixAt(i, M); });
      st.lampGlow.im.instanceMatrix.needsUpdate = true; st.lampGlow.im.material.opacity = L.street;
    }
    st.cityU.uTime.value = t; st.cityU.uDay.value = L.day; st.cityU.uAll.value = t > T_ZERO - 0.2 ? 1 : 0;
    st.beacon.material.opacity = Math.sin(t * 3.1) > 0.2 ? 1 : 0.15;

    // ---- the tower: screens, ceiling lights, lobby
    IU.uTime.value = t; IU.uHeroT.value = HERO_T;
    for (let f = 0; f < NFL; f++) {
      IU.uFlipT.value[f] = FLIP[f];
      const w = f === 0 ? 1 : f === 13 ? 1 : 1 - 0.94 * smooth(LOUT[f], LOUT[f] + 0.45, t);
      IU.uWarm.value[f] = w * (t > SAY.outro ? 0.0 : 1);
      st.ceil[f].color.setRGB(1.6 * w, 1.45 * w, 1.2 * w);
      if (f === 13) st.ceil[f].color.setRGB(3.0, 1.9, 0.8);
    }
    if (t > SAY.outro) for (let f = 1; f <= 12; f++) st.ceil[f].color.setRGB(0.1, 0.09, 0.08);
    IU.uLobby.value = t < T_MORNING ? 1 : 0.12;
    IU.uPent.value = 1.6;
    const sa = st.screens.aT0;
    st.screens.list.forEach((s, i) => { sa[i] = deskT(s.f, s.ci, s.ri); });
    st.screens.im.geometry.attributes.aT0.needsUpdate = true;
    // the hiring sign turns round
    const flipH = smooth(wordT('quiet', 'stop') + 0.1, wordT('quiet', 'stop') + 0.55, t);
    st.hire.rotation.y = Math.PI * flipH; st.hire.position.z = 8.12 + 0.25 * Math.sin(Math.PI * flipH);

    // ---- the supermarket: lit until the robots switch it off; cartons pile up; the sales get desperate
    const dark = (i) => smooth(T_DARK + i * 0.38, T_DARK + i * 0.38 + 0.12, t);
    IU.uStore.value[0] = (1 - dark(2)) * (t < SAY.twist ? 1 : 0); IU.uStore.value[1] = (1 - dark(1)) * (t < SAY.twist ? 1 : 0); IU.uStore.value[2] = (1 - dark(0)) * (t < SAY.twist ? 1 : 0);
    IU.uDayIn.value = t > SAY.twist && t < SAY.outro ? 0.6 : 0;
    {
      const C2 = st.cartons, M = new THREE.Matrix4(), q = new THREE.Quaternion();
      const nBase = 36, nMax = C2.slots.length;
      const grow = (i) => T_PROBLEM + 0.4 + (i - nBase) * ((SAY.fix - T_PROBLEM - 0.8) / (nMax - nBase));
      let n = 0;
      C2.slots.forEach((s, i) => {
        const t0 = i < nBase ? -1 : grow(i); if (t < t0 && t > SAY.twist - 1) return;
        if (t < SAY.twist - 1 && i >= nBase) return;
        const fall = clamp((t - t0) / 0.22), y = s.y + (1 - fall * fall) * 2.5;
        q.setFromAxisAngle(V(0, 1, 0), s.r); M.compose(V(s.x, y, s.z), q, V(1, 1, 1)); C2.im.setMatrixAt(n++, M);
      });
      C2.im.count = n; C2.im.instanceMatrix.needsUpdate = true;
      const showSale = [T_PROBLEM + 0.3, wordT('twist', 'paychecks'), wordT('twist', 'buying')];
      st.sale.forEach((p, i) => { p.visible = t >= showSale[i] && (i === 2 || t < showSale[i + 1]) && t < SAY.outro; const u = clamp((t - showSale[i]) / 0.18); p.scale.setScalar(u <= 0 ? 0.01 : 1 + 0.25 * Math.sin(Math.PI * u) * (1 - u)); });
    }
    // ---- the flats: evening lights, a grey morning, then each home lights up as the money lands
    for (let i = 0; i < 12; i++) {
      const eve = 0.35 + 0.65 * ((i * 7) % 5 > 1 ? 1 : 0);
      const land = T_TAX + 1.15 + ((i * 5) % 12) * 0.09;
      IU.uApt.value[i] = t < T_MORNING ? eve : t < SAY.fix ? 0.12 : lerp(0.12, 0.85, smooth(land, land + 0.25, t));
    }
    // ---- coins
    {
      const K = st.coins, M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); let n = 0;
      if (t > T_TAX - 0.2 && t < SAY.history) for (let i = 0; i < K.n; i++) {
        const t0 = T_TAX - 0.15 + (i / K.n) * 2.4, dur = 1.25 + 0.3 * hash(i, 1), u = (t - t0) / dur;
        if (u < 0 || u > 1) continue;
        const R = ROOMS[(i * 5) % 12];
        const p0 = V(-3 + (hash(i, 2) - 0.5) * 10, 58 + hash(i, 3) * 3, -3 + (hash(i, 4) - 0.5) * 5), p2 = V(R.x + (hash(i, 5) - 0.5) * 4, R.y + 1.2 + hash(i, 6) * 1.2, 29.5 + hash(i, 7) * 2);
        const p1 = p0.clone().lerp(p2, 0.5).add(V(0, 18 + 6 * hash(i, 8), 0));
        const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), cc = u * u;
        const p = p0.clone().multiplyScalar(a).addScaledVector(p1, b).addScaledVector(p2, cc);
        q.setFromEuler(e.set(t * 7 + i, t * 5 + i * 2, 0)); M.compose(p, q, V(1, 1, 1).multiplyScalar(1.2 * Math.min(1, u * 8) * Math.min(1, (1 - u) * 6 + 0.3)));
        K.im.setMatrixAt(n++, M);
      }
      K.im.count = n; K.im.instanceMatrix.needsUpdate = true;
    }

    // ---- people and their things
    st.ppl.update(t);
    st.veh.update(t);
    st.veh.lampU.k = 0.5 + 2.5 * L.street;
    const B = st.bots, M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const cnt = { body: 0, wheels: 0, strip: 0, flag: 0, lidar: 0, ring: 0, visor: 0, carry: 0, tool: 0 };
    const put = (name, x, y, z, h, sx = 1, extra = null) => { q.setFromEuler(e.set(0, h, 0)); M.compose(V(x, y, z), q, V(sx, sx, sx)); if (extra) M.multiply(extra); B[name].setMatrixAt(cnt[name]++, M); };
    const fwd = (h, d) => [Math.sin(h) * d, Math.cos(h) * d];
    // boxes carried out by the office workers
    for (const { w } of st.workers) {
      if (t < w.tw + 0.05 || t > w.w.end) continue;
      const p = w.w.at(t), [fx2, fz2] = fwd(p.h, 0.42);
      put('carry', p.x + fx2, w.f * FH + 1.02 + 0.02 * Math.sin(p.dist * 4), p.z + fz2, p.h);
    }
    // the reader's backpack, the plumber's toolbox
    if (t > SAY.quiet - 1 && t < SAY.safe) { const p = READER.at.at(t), [bx, bz] = fwd(p.h, -0.25); put('carry', p.x + bx, 1.15, p.z + bz, p.h, 0.85); }
    if (t > SAY.robots - 1 && t < SAY.hundred) { const p = PLUMBER.at(t), [bx, bz] = fwd(p.h, 0.4); put('tool', p.x + bx, t < T_STOP ? 1.0 : 0.62, p.z + bz, p.h); }
    // visors on every humanoid robot; cartons in the store robots' arms
    const visor = (p, s = 1.04) => { const [vx, vz] = fwd(p.h, 0.155 * s); put('visor', p.x + vx, 1.68 * s, p.z + vz, p.h, s); };
    if (t > SAY.robots && t < SAY.hundred) for (const b of STREET_BOTS) visor(b.at(t));
    if (t < SAY.fix || t > SAY.outro) for (const b of STORE_BOTS) { const p = storeBotAt(b, t); visor(p); const [cx2, cz2] = fwd(p.h, 0.42); put('carry', p.x + cx2, 1.08, p.z + cz2, p.h); }
    // delivery robots on the pavements
    if (t > SAY.robots - 1 && t < SAY.hundred) for (const d of DELIVERY) {
      const x = d.x0 + Math.max(0, t - d.t0) * d.v, h = Math.PI / 2;
      put('body', x, 0, d.z, h); put('strip', x, 0, d.z, h); put('flag', x, 0, d.z, h);
      for (const ax of [-0.28, 0, 0.28]) for (const sz of [-0.33, 0.33]) { const W2 = new THREE.Matrix4().makeTranslation(sz, 0.11, ax).multiply(new THREE.Matrix4().makeRotationX(-(x - d.x0) / 0.11)); put('wheels', x, 0, d.z, h, 1, W2); }
    }
    // lidar pucks on the self-driving cars, spinning
    for (const car of st.robocars) {
      if (car.visible && !car.visible(t)) continue;
      const p = st.veh.placeOf(car, t), top = car.type === 'van' ? 2.27 : car.type === 'suv' ? 2.02 : 1.6;
      const R2 = new THREE.Matrix4().makeRotationY(t * 9);
      put('lidar', p.x, top, p.z, p.h, 1, R2); put('ring', p.x, top, p.z, p.h, 1, R2);
    }
    for (const kk of Object.keys(cnt)) { B[kk].count = cnt[kk]; B[kk].instanceMatrix.needsUpdate = true; }
    if (DBG?.nobloom) ctx.bloom = { strength: 0 };
    if (DBG?.nodof) ctx.dof = { focus: 10, aperture: 0, farBlur: 0 };
    if (DBG?.hide) for (const h of DBG.hide) { const o = { flats0: st.flats.children[0], flats1: st.flats.children[1], veh: st.veh.group, ppl: st.ppl.group, city: st.city, coins: st.coins.im, tower: st.tower, store: st.store, flats: st.flats, street: st.street, bots: st.bots.body.parent }[h]; if (o) o.visible = false; }
  },

  poseStage(ctx, t) {
    const st = this.st;
    ctx.renderer.toneMappingExposure = 1.0;
    st.stagePpl.update(t);
  },
};

const truckX = (t) => 260 - (t - (T_TRUCK + 0.6 - 272 / 11)) * 11;
export const _debug = { SAY, FLIP, LOUT, HERO_T, T_ROBOT, T_TRUCK, T_DARK, T_ZERO, T_PROBLEM, T_TAX, T_HAPPY, T_1900, T_TODAY, T_NEW, T_OWNS, END, DURATION, CAPTIONS, SHOTS, jobsAt, camAt };
