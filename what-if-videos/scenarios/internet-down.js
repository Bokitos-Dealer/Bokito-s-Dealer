// What if the entire internet went down for a whole week?
//
// The city block from "What if AI took every job?" (office tower, avenue, supermarket, flats), one week with no
// internet: a phone that won't load, cards declined, offices sent home, departures cancelled, shelves emptying,
// then what still works (GPS from satellites, radio, phone calls), neighbours outside, the cost, why it is
// almost impossible (a globe of undersea cables that reroutes round a cut), and day seven when everything comes
// back at once. Real numbers: ITU 2024 (5.5 billion people online), Fed 2025 Diary of Consumer Payment Choice
// (cash 14% of US payments), the July 2024 CrowdStrike outage (8.5 million Windows PCs, 10,000+ flights
// cancelled), NetBlocks/Atlas VPN (~$43 billion per day), TeleGeography (~600 undersea cable systems, ~99% of
// intercontinental traffic), GPS satellites at 20,200 km.
import * as THREE from 'three';
import { Rng, clamp, lerp, smooth, fbm1 } from '../engine/lib/rng.js';
import { buildPeople, pathAt, pathLen } from '../engine/lib/people.js';
import { buildVehicles } from '../engine/lib/vehicles.js';
import {
  FH, COLS, ROWS, NFL, deskDelay, seatPos, APT, ROOMS,
  makeIU, patchInterior, buildTower, buildStore, buildFlats, buildStreet, buildCity, buildSky, ctex, textTexture, softDot,
} from './ai-jobs-set.js';
import VO from './internet-down.vo.js';

const W = 1080, H = 1920;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DEG = Math.PI / 180;
const DBG = (() => { try { const q = typeof location !== 'undefined' && new URLSearchParams(location.search).get('dbg'); return q ? JSON.parse(q) : null; } catch (e) { return null; } })();

// ------------------------------------------------------------------ the story, timed by the narration
const ORDER = ['hook', 'goal', 'day1', 'cash', 'day2', 'day3', 'twist', 'day5', 'cost', 'real', 'day7', 'cta'];
const GAP = { hook: 0.12, goal: 0.3, cost: 0.3, real: 0.4, day7: 0.4, cta: 0.35 };   // the hook starts at once
const SAY = {};
{ let t = 0; for (const k of ORDER) { SAY[k] = t + (GAP[k] ?? 0.28); t = SAY[k] + VO[k].dur; } }
const wordT = (key, word, nth = 0) => { let n = 0; for (const [w, s] of VO[key].words) if (w.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(word.replace(/'/g, '')) && n++ === nth) return SAY[key] + s; throw new Error(`no "${word}" in ${key}`); };
const endOf = (k) => SAY[k] + VO[k].dur;
const T_END_TALK = endOf('cta');
const FADE = [T_END_TALK + 0.35, T_END_TALK + 0.9], DURATION = FADE[1] + 0.3;

const T_DOWN = wordT('hook', 'died');
const T_OFFLINE = wordT('hook', 'everywhere');
const T_DECLINE = wordT('cash', 'declined');
const T_CASHONLY = wordT('cash', 'cash');
const T_HOME = wordT('day2', 'offices');
const T_FLIGHTS = wordT('day2', 'flights');
const T_2024 = wordT('day2', 'in');
const T_SHELVES = wordT('day3', 'shelves');
const T_GPS = wordT('twist', 'your');
const T_SKY = wordT('twist', 'thats');
const T_RADIO = wordT('twist', 'radio');
const T_CALL = wordT('twist', 'normal');
const T_CUT = wordT('real', 'cut');
const T_BACK = wordT('day7', 'it');
const T_NOTIF = wordT('day7', 'every');

// the week: elapsed days since the internet went down
const DAYS = [[T_DOWN, 0], [SAY.day2, 1], [SAY.day3, 2], [SAY.twist, 3.2], [SAY.day5, 4], [SAY.cost, 5], [SAY.day7, 6], [T_BACK + 0.4, 7]];
function daysAt(t) {
  if (t <= DAYS[0][0]) return 0;
  for (let i = 0; i < DAYS.length - 1; i++) { const [t0, a] = DAYS[i], [t1, b] = DAYS[i + 1]; if (t <= t1) return lerp(a, b, (t - t0) / (t1 - t0)); }
  return 7;
}

// ------------------------------------------------------------------ captions
const NUMS = [['forty-three billion dollars', '$43B (€40B)'], ['2024', '2024']];
const KEYWORDS = /^(died|everywhere|week|wildest|nothing|spinning|declined|cash|home|grounded|thousands|apps|emptying|crazy|gps|satellites|radio|works|call|wild|neighbors|talk|impossible|cables|ocean|cut|around|back|notification|once|last)$/i;
function buildCaptions() {
  const out = [];
  for (const key of ORDER) {
    const at = SAY[key];
    let ws = [];
    for (const [w, s, e] of VO[key].words) { if (ws.length && /^[-']/.test(w)) { const p = ws[ws.length - 1]; p[0] += w; p[2] = e; } else ws.push([w, s, e, false]); }
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
    for (const c of clauses) { if (!c.length) continue; const n = Math.ceil(c.length / 3), per = Math.ceil(c.length / n); for (let i = 0; i < c.length; i += per) chunks.push(c.slice(i, i + per)); }
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

// ------------------------------------------------------------------ where things stand
const HERO = { x: 15.2, z: 32.6, y: APT.fh, h: 0 };                    // in a flat on the first floor, facing the back wall
const TERM = V(-0.95, 1.2, 31.12);                                      // the card terminal on the first till
const BILL = { x: -10, y: 11.6, z: 27.85, w: 12.5, h: 5.2 };            // the billboard on the supermarket roof
const LAWN_C = V(-4, 0, 10.6);                                          // the radio circle on the lawn
const GPS_P = { x: 5.5, z: 11.2, h: Math.PI };                          // someone on the lawn checking a map
const CALLER = { x: 9.5, z: 10.6, h: -2.4 };

// ------------------------------------------------------------------ camera: shots of Catmull-Rom keys; a new shot is a cut
const k = (t, p, l, fov) => ({ t, p, l, fov });
const SHOTS = [
  { t0: -1, keys: [                                                      // over his shoulder at the phone, then out of the flat and up over the city
    k(0.0, [15.394, 4.731, 32.867], [15.344, 4.451, 33.277], 40),       // straight down the screen (hand at 15.34, 4.33, 33.2), low in frame under the title
    k(T_DOWN + 0.4, [15.39, 4.652, 32.885], [15.344, 4.404, 33.244], 35),
    k(SAY.goal - 0.05, [15.388, 4.64, 32.91], [15.344, 4.402, 33.243], 33),
  ] },
  { t0: SAY.goal - 0.05, keys: [                                         // cut wide: over the avenue, the tower's dead screens
    k(SAY.goal - 0.05, [30, 30, 20], [2, 10, 22], 48),
    k(SAY.day1, [34, 46, 10], [0, 14, 16], 44),
  ] },
  { t0: SAY.day1, keys: [                                                // along the flats: everyone staring at a phone that won't load
    k(SAY.day1, [9, 4.6, 21], [9, 4.2, 34], 40),
    k(SAY.cash, [19, 5.2, 21.5], [19, 4.4, 34], 40),
  ] },
  { t0: SAY.cash, keys: [                                                // the card terminal
    k(SAY.cash, [-0.42, 1.74, 30.58], [-0.95, 1.24, 31.12], 38),       // past the customer's shoulder (she stands at -0.95, 30.35)
    k(T_CASHONLY - 0.05, [-0.5, 1.6, 30.68], [-0.95, 1.23, 31.12], 30),
  ] },
  { t0: T_CASHONLY - 0.05, keys: [                                       // outside: CASH ONLY goes up, the queue gives up
    k(T_CASHONLY - 0.05, [-11.5, 1.65, 22.6], [-10.5, 1.9, 29], 42),
    k(SAY.day2, [-12.5, 1.7, 23.4], [-10.5, 1.8, 29], 40),
  ] },
  { t0: SAY.day2, keys: [                                                // day two: the offices empty out
    k(SAY.day2, [6, 13, 26], [0, 12, 0], 40),
    k(T_FLIGHTS - 0.1, [4, 15, 28], [0, 13.5, 0], 40),
  ] },
  { t0: T_FLIGHTS - 0.05, keys: [                                        // the departures board on the billboard
    k(T_FLIGHTS - 0.05, [-12, 1.7, 15.5], [-10, 9.5, 28], 46),
    k(T_2024 + 0.3, [-11, 2.6, 17.5], [-10, 10.4, 28], 40),
    k(SAY.day3, [-10.5, 4.0, 19.5], [-10, 11.0, 28], 36),
  ] },
  { t0: SAY.day3, keys: [                                                // day three: down an aisle as the shelves empty
    k(SAY.day3, [-6.5, 2.75, 30.4], [-6.5, 0.9, 39], 44),              // high, over the shoppers' heads
    k(SAY.twist, [-6.5, 2.6, 33.2], [-6.5, 0.8, 42], 40),
  ] },
  { t0: SAY.twist, keys: [                                               // dusk: everyone outside
    k(SAY.twist, [-17, 1.2, 15.5], [0, 1.0, 10.5], 40),
    k(T_GPS - 0.1, [-14, 1.4, 15.0], [2, 1.0, 10.5], 38),
  ] },
  { t0: T_GPS - 0.05, keys: [                                            // a map that still knows where you are, then up to the satellite
    k(T_GPS - 0.05, [5.40, 1.474, 10.97], [5.356, 1.194, 10.56], 40),   // the map on her screen (hand at 5.36, 1.12, 10.61)
    k(T_SKY - 0.25, [5.39, 1.44, 10.92], [5.356, 1.193, 10.562], 35),
  ] },
  { t0: T_SKY - 0.25, keys: [                                            // low in front of her, up to the open sky over the avenue (the tower is behind the camera)
    k(T_SKY - 0.25, [4.0, 0.9, 9.0], [4.4, 24, 60], 48),                // she's just out of frame: only the open sky and the satellite
    k(T_SKY + 0.9, [3.95, 0.85, 8.9], [4.6, 34, 60], 50),
    k(T_RADIO - 0.05, [3.9, 0.8, 8.8], [4.8, 40, 60], 52),
  ] },
  { t0: T_RADIO - 0.05, keys: [                                          // the radio circle
    k(T_RADIO - 0.05, [-4, 2.2, 15.6], [-4, 0.5, 10.6], 40),
    k(T_CALL - 0.05, [-2.5, 2.0, 15.2], [-4, 0.5, 10.6], 36),
  ] },
  { t0: T_CALL - 0.05, keys: [                                           // a phone call goes through
    k(T_CALL - 0.05, [11.6, 1.72, 11.6], [9.5, 1.62, 10.6], 40),
    k(SAY.day5, [11.3, 1.7, 11.4], [9.5, 1.62, 10.6], 36),
  ] },
  { t0: SAY.day5, keys: [                                                // day five: the street belongs to the kids
    k(SAY.day5, [-18, 1.1, 19.0], [0, 1.0, 19.5], 40),
    k(SAY.cost, [-15, 1.5, 17.0], [4, 1.0, 20.5], 40),
  ] },
  { t0: SAY.cost, keys: [                                                // the cost: the whole city at dusk
    k(SAY.cost, [70, 70, 120], [0, 22, 0], 36),
    k(SAY.real, [60, 60, 105], [0, 24, 0], 36),
  ] },
  { t0: SAY.real, stage: true, keys: [                                   // the globe of cables
    k(SAY.real, [0, 4, 21], [0, 0.5, 0], 36),
    k(T_CUT - 1.4, [-6, 9, 15], [0, 1.0, 0], 34),
    k(T_CUT + 0.4, [-7.5, 8.2, 8.5], [-3.2, 4.0, 1.4], 30),
    k(SAY.day7, [-8, 8, 9], [-3.1, 3.9, 1.3], 30),
  ] },
  { t0: SAY.day7, keys: [                                                // day seven, night: it all comes back
    k(SAY.day7, [16, 9, 12], [12, 5, 32], 44),
    k(T_NOTIF, [14, 7, 14], [12, 4.5, 32], 46),
    k(SAY.cta, [6, 7, 16], [8, 4, 30], 46),
  ] },
  { t0: SAY.cta, keys: [                                                 // away over the city
    k(SAY.cta, [6, 7, 16], [8, 4, 30], 46),
    k(DURATION, [30, 60, -40], [5, 10, 30], 44),
  ] },
];
const shotOf = (t) => { let i = 0; while (i < SHOTS.length - 1 && t >= SHOTS[i + 1].t0) i++; return i; };
const W_ = (k, w, n = 0) => wordT(k, w, n);
const PUNCH = [                                                         // jump zooms on the words that land
  [W_('hook', 'everywhere'), 0.8], [W_('hook', 'for'), 0.66],
  [W_('day1', 'nothing'), 0.78], [W_('day1', 'your'), 1], [W_('day1', 'just'), 0.72],
  [T_DECLINE, 0.62], [W_('cash', 'and'), 0.82],
  [W_('day2', 'offices'), 0.8], [W_('day2', 'grounded'), 0.72], [W_('day2', 'thousands'), 0.86],
  [W_('day3', 'because'), 0.8], [W_('twist', 'crazy'), 0.78],
  [W_('twist', 'works', 1), 0.74], [W_('twist', 'might'), 0.8],
  [W_('day5', 'they'), 0.8], [W_('day5', 'and'), 0.66],
  [W_('cost', 'forty'), 0.78], [W_('real', 'honestly'), 0.86], [W_('real', 'almost'), 0.76], [W_('real', 'hundreds'), 1],
  [W_('day7', 'every'), 0.82], [W_('day7', 'single'), 0.7], [W_('day7', 'notification'), 0.58], [W_('day7', 'at'), 1],
  [W_('cta', 'how'), 0.8],
].sort((a, b) => a[0] - b[0]);
const CUTS = [...SHOTS.map((s) => s.t0), ...PUNCH.map((p) => p[0])].sort((a, b) => a - b);
const shotIdx = (t) => { let i = 0; while (i < CUTS.length - 1 && t >= CUTS[i + 1]) i++; return i; };
const punchAt = (t) => { const s0 = SHOTS[shotOf(t)].t0; let f = 1; for (const [t0, k] of PUNCH) if (t >= t0 && t0 >= s0) f = k; return f; };
// a white flash on the big cuts (each new day, the twist, the globe, the comeback)
const FLASHES = [SAY.day1, SAY.day2, SAY.day3, SAY.twist, SAY.day5, SAY.real, T_BACK];
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
const SHAKES = [[T_DOWN, 0.55], [T_DECLINE, 0.4], [W_('day2', 'grounded'), 0.3], [W_('cost', 'forty'), 0.3], [T_CUT, 0.55], [T_NOTIF, 0.5], [W_('day7', 'single'), 0.35], [W_('day7', 'notification'), 0.45]];
const trauma = (t) => SHAKES.reduce((s, [t0, a]) => s + (t >= t0 ? a * Math.max(0, 1 - (t - t0) / 0.8) : 0), 0);
function camAt(t) {
  const S = SHOTS[shotOf(t)];
  const v = crAt(S.keys, t, (q) => [...q.p, ...q.l, q.fov]);
  const pos = V(v[0], v[1], v[2]), look = V(v[3], v[4], v[5]);
  const tr = Math.min(1, trauma(t)), sh = tr * tr;
  const amp = Math.min(0.08, pos.distanceTo(look) * 0.002 + 0.004);
  pos.add(V(fbm1(t * 0.35 + 3.1) * amp, fbm1(t * 0.3 + 7.7) * amp * 0.8, fbm1(t * 0.33 + 1.9) * amp));
  const rot = { x: fbm1(t * 0.4 + 5.5) * 0.003 + fbm1(t * 18 + 1.1) * 0.03 * sh, y: fbm1(t * 0.37 + 4.4) * 0.003 + fbm1(t * 17 + 2.2) * 0.03 * sh, z: fbm1(t * 0.3 + 2.2) * 0.004 + fbm1(t * 16 + 3.3) * 0.025 * sh };
  const fov = 2 * Math.atan(Math.tan((v[6] - 3 * sh) * DEG / 2) * punchAt(t)) / DEG;
  return { pos, look, fov, rot, shot: shotIdx(t), stage: !!S.stage };
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

// ------------------------------------------------------------------ time of day
const C = (h) => new THREE.Color(h);
const TOD = {
  morning: { zen: C('#5a8ccc'), hor: C('#f3c9a2'), glow: C('#ffd2a0').multiplyScalar(0.8), sun: V(0.55, 0.32, -0.77), stars: 0, disc: 1, sunCol: C('#ffe0bc'), sunI: 2.2, sky: C('#a6c0e0'), gnd: C('#5d554a'), hemiI: 0.95, fog: C('#c8cfd8'), fogD: 0.0018, expo: 0.85, street: 0, day: 1, amb: [0.36, 0.38, 0.44], sunG: [0.8, 0.7, 0.58] },
  day: { zen: C('#3d7bd0'), hor: C('#bcd8ee'), glow: C('#fff2d0').multiplyScalar(0.6), sun: V(0.55, 0.6, 0.58), stars: 0, disc: 1, sunCol: C('#fff1dc'), sunI: 2.8, sky: C('#a8c8ec'), gnd: C('#6b6250'), hemiI: 1.05, fog: C('#b9cde0'), fogD: 0.0017, expo: 0.82, street: 0, day: 1, amb: [0.42, 0.46, 0.52], sunG: [0.9, 0.85, 0.75] },
  dusk: { zen: C('#1f2d5c'), hor: C('#f08a5a'), glow: C('#ff9a5a').multiplyScalar(1.0), sun: V(-0.2, 0.05, 0.98), stars: 0.15, disc: 1, sunCol: C('#ffab70'), sunI: 1.4, sky: C('#7a7fb0'), gnd: C('#3a3030'), hemiI: 0.75, fog: C('#9a7f8a'), fogD: 0.0022, expo: 0.95, street: 0.7, day: 0.4, amb: [0.18, 0.16, 0.2], sunG: [0.6, 0.38, 0.25] },
  night: { zen: C('#040917'), hor: C('#1c2747'), glow: C('#ff7a3a').multiplyScalar(0.12), sun: V(-0.4, -0.06, -1), stars: 0.8, disc: 0, sunCol: C('#8fa8ff'), sunI: 0.35, sky: C('#3a4c78'), gnd: C('#1a1612'), hemiI: 0.5, fog: C('#141c33'), fogD: 0.0038, expo: 1.0, street: 1, day: 0, amb: [0.035, 0.042, 0.07], sunG: [0, 0, 0] },
};
TOD.dawn = Object.assign({}, TOD.morning, { sun: V(0.35, 0.12, -0.93).normalize(), sunI: 1.6, expo: 0.92, zen: C('#4a6fa8'), hor: C('#f7b585') });
TOD.dusk2 = Object.assign({}, TOD.dusk, { sun: V(-0.55, 0.04, 0.83).normalize() });
function mixTod(a, b, u) {
  const o = {};
  for (const key of Object.keys(a)) {
    const x = a[key], y = b[key];
    o[key] = x.isColor ? x.clone().lerp(y, u) : x.isVector3 ? x.clone().lerp(y, u).normalize() : Array.isArray(x) ? x.map((q, i) => lerp(q, y[i], u)) : lerp(x, y, u);
  }
  return o;
}
function todAt(t) {
  if (t < SAY.day1) return TOD.dawn;
  if (t < SAY.twist) return TOD.day;
  if (t < T_RADIO - 0.05) return TOD.dusk;
  if (t < SAY.day5) return mixTod(TOD.dusk, TOD.night, 0.75);
  if (t < SAY.cost) return TOD.day;
  if (t < SAY.day7) return TOD.dusk2;
  return TOD.night;
}

// ------------------------------------------------------------------ people
const r = new Rng(31);
const hash = (a, b, c = 0) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };
const angLerp = (a, b, u) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * u; };
function walker(path, tw, v, h0) {
  const L = pathLen(path);
  return {
    L, end: tw + L / v,
    at(t) {
      if (t < tw) return { x: path[0][0], z: path[0][1], h: h0, moving: 0, dist: 0 };
      const d = (t - tw) * v, q = pathAt(path, Math.min(d, L));
      return { x: q.x, z: q.z, h: angLerp(h0, q.h, smooth(0, 0.45, t - tw)), moving: d < L ? 1 : 0, dist: d };
    },
  };
}
// office workers: at their desks with dead screens until day two sends them home
const WORKERS = [];
for (let f = 1; f <= 12; f++) for (let ri = 0; ri < 3; ri++) for (let ci = 0; ci < 5; ci++) {
  if (hash(f, ri, ci) < 0.35) continue;                                  // early morning: not everyone is in
  const s = seatPos(f, ci, ri), ts = T_HOME + 0.2 + 0.9 * hash(ci, f, ri) + 0.04 * f, tw = ts + 0.45, za = ROWS[ri] + 1.75;
  WORKERS.push({ f, s, ts, tw, w: walker([[s.x, s.z], [s.x, za], [10, za], [10, -1.8], [12.6, -1.8]], tw, 1.5 + 0.2 * hash(f, ci), Math.PI) });
}
const QUEUE = Array.from({ length: 8 }, (_, i) => ({ x: -3.2 - i * 1.05, z: 26.4 + (i % 2) * 0.25, tShrug: T_CASHONLY + 0.6 + i * 0.12, tGo: T_CASHONLY + 1.3 + i * 0.16 }));
const SHOPPERS = [[-11.5, 0], [-6.5, 9.0], [-16.5, 4.3], [-1.5, 1.2], [-11.5, 5.6]];   // one in the camera's aisle, far end at day three
const RADIO_RING = Array.from({ length: 9 }, (_, i) => { const a = i / 9 * Math.PI * 2 + 0.3; return { x: LAWN_C.x + Math.cos(a) * 1.55, z: LAWN_C.z + Math.sin(a) * 1.0, h: Math.atan2(LAWN_C.x - (LAWN_C.x + Math.cos(a)), LAWN_C.z - (LAWN_C.z + Math.sin(a))) }; });
const KIDS = Array.from({ length: 6 }, (_, i) => ({ cx: -4 + i * 3.4, cz: 18.6 + (i % 2) * 2.2, r: 1.2 + 0.4 * (i % 3), w: 1.4 + 0.2 * i, ph: i * 1.3 }));
const kidAt = (q, t) => { const a = t * q.w / q.r + q.ph; return { x: q.cx + Math.cos(a) * q.r, z: q.cz + Math.sin(a) * q.r * 0.7, h: Math.atan2(-Math.sin(a), Math.cos(a) * 0.7), moving: 1, dist: t * q.w }; };
// in the flats: phones up on day one; on day seven everyone is home with their phone buzzing
const FLAT_PPL = [[0, -0.6, 33.4, 0.4], [1, 0.4, 33.0, -0.3], [2, -0.8, 33.6, 0.2], [3, 1.0, 34.9, Math.PI], [5, 0.2, 33.2, 0.1], [6, -0.5, 33.6, 0.3],
  [7, 0.4, 33.2, -0.2], [8, -0.4, 33.5, 0.3], [9, 0.6, 34.8, Math.PI], [10, -0.6, 33.3, 0.1], [11, 0.3, 33.4, -0.4]];
const LAWN_NIGHT = [[-10, 10.4], [-7.6, 11.6], [-5.2, 10.2], [-2.6, 11.4], [0.2, 10.4], [2.8, 11.6], [5.2, 10.3], [7.8, 11.4], [10.4, 10.5], [-12.2, 11.8]];

// ------------------------------------------------------------------ the globe of undersea cables (lat, lon in degrees)
const CITIES = { ny: [40.7, -74], lon: [51.5, -0.1], lis: [38.7, -9.1], mia: [25.8, -80.2], for: [-3.7, -38.5], lag: [6.5, 3.4], cpt: [-33.9, 18.4], mar: [43.3, 5.4],
  egy: [31.2, 29.9], mum: [19.1, 72.9], sin: [1.3, 103.8], hk: [22.3, 114.2], tok: [35.7, 139.7], syd: [-33.9, 151.2], la: [34.0, -118.2], sea: [47.6, -122.3],
  hon: [21.3, -157.9], gua: [13.4, 144.8], chi: [-33.0, -71.6], pan: [9.0, -79.5], bos: [42.4, -71.0], cor: [51.9, -8.5], ice: [64.1, -21.9], nor: [58.9, 5.7], dji: [11.6, 43.1], per: [-31.9, 115.9] };
const CABLES = [['ny', 'lon'], ['bos', 'cor'], ['ny', 'lis'], ['mia', 'for'], ['for', 'lag'], ['lis', 'lag'], ['lag', 'cpt'], ['lis', 'mar'], ['mar', 'egy'], ['egy', 'dji'], ['dji', 'mum'], ['mum', 'sin'],
  ['sin', 'hk'], ['hk', 'tok'], ['tok', 'sea'], ['tok', 'la'], ['la', 'hon'], ['hon', 'syd'], ['gua', 'tok'], ['gua', 'syd'], ['sin', 'per'], ['per', 'syd'], ['la', 'pan'], ['pan', 'chi'], ['mia', 'pan'],
  ['ny', 'mia'], ['ice', 'nor'], ['bos', 'ice'], ['cpt', 'mum'], ['lon', 'nor'], ['sea', 'hon'], ['hk', 'gua']];
const CUT_I = 0;                                    // New York–London is cut
const REROUTE = [2, 7, 0];                          // the data goes New York → Lisbon → (Marseille) … and around
const GR = 5;
const ll2v = (lat, lon, r = GR) => V(r * Math.cos(lat * DEG) * Math.sin(lon * DEG), r * Math.sin(lat * DEG), r * Math.cos(lat * DEG) * Math.cos(lon * DEG));
function arcPoints(a, b, n = 48, lift = 0.06) {
  const A = ll2v(...a, 1), B = ll2v(...b, 1), ang = A.angleTo(B), pts = [];
  for (let i = 0; i <= n; i++) { const u = i / n, s = Math.sin(ang); const p = A.clone().multiplyScalar(Math.sin((1 - u) * ang) / s).addScaledVector(B, Math.sin(u * ang) / s); pts.push(p.normalize().multiplyScalar(GR + lift + 0.12 * Math.sin(Math.PI * u) * ang)); }
  return pts;
}

// ------------------------------------------------------------------ textures: phone screens, the terminal, the billboard
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function wifiOff(c, x, y, s, col = '#9aa3ad') {
  c.strokeStyle = col; c.lineWidth = s * 0.09; c.lineCap = 'round';
  for (const rr of [0.95, 0.65, 0.35]) { c.beginPath(); c.arc(x, y, s * rr, Math.PI * 1.25, Math.PI * 1.75); c.stroke(); }
  c.fillStyle = col; c.beginPath(); c.arc(x, y - s * 0.02, s * 0.08, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#ff4b4b'; c.lineWidth = s * 0.1; c.beginPath(); c.moveTo(x - s * 0.8, y - s * 1.0); c.lineTo(x + s * 0.8, y + s * 0.2); c.stroke();
}
function phoneTex(kind) {
  const cv = canvas(360, 720), c = cv.getContext('2d');
  c.fillStyle = kind === 'map' ? '#e9efe6' : '#0f1217'; c.fillRect(0, 0, 360, 720);
  c.fillStyle = kind === 'map' ? '#2b2f36' : '#ffffff'; c.font = '700 22px InterW, Arial'; c.fillText('7:42', 26, 40);
  c.textAlign = 'center';
  if (kind === 'loading') {
    c.fillStyle = '#1f6feb'; c.fillRect(0, 60, 360, 70); c.fillStyle = '#fff'; c.font = '800 30px InterW, Arial'; c.fillText('Messages', 180, 106);
    for (let i = 0; i < 5; i++) { c.fillStyle = '#1b2029'; c.fillRect(20, 160 + i * 92, 320, 74); c.fillStyle = '#39414f'; c.fillRect(36, 178 + i * 92, 180, 14); c.fillRect(36, 204 + i * 92, 120, 12); }
  } else if (kind === 'off') {
    wifiOff(c, 180, 150, 110, '#ff6b6b');                                // high on the screen: the hand covers the bottom half
    c.fillStyle = '#ffffff'; c.font = '900 44px InterW, Arial'; c.fillText('No internet', 180, 250);
    c.fillStyle = '#9aa3ad'; c.font = '600 24px InterW, Arial'; c.fillText('Check your connection', 180, 292);
    c.fillStyle = '#1f6feb'; c.fillRect(110, 320, 140, 56); c.fillStyle = '#fff'; c.font = '800 24px InterW, Arial'; c.fillText('RETRY', 180, 357);
  } else if (kind === 'map') {
    c.strokeStyle = '#ffffff'; c.lineWidth = 26; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-20, 120 + i * 120); c.lineTo(380, 60 + i * 130); c.stroke(); }
    c.lineWidth = 18; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(40 + i * 100, 60); c.lineTo(80 + i * 90, 720); c.stroke(); }
    c.fillStyle = '#b9dfb0'; c.fillRect(200, 420, 120, 120); c.fillStyle = '#a7c8e8'; c.fillRect(30, 560, 150, 100);
    const g = c.createRadialGradient(180, 360, 0, 180, 360, 70); g.addColorStop(0, 'rgba(30,120,255,0.45)'); g.addColorStop(1, 'rgba(30,120,255,0)'); c.fillStyle = g; c.fillRect(100, 280, 160, 160);
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(180, 360, 20, 0, Math.PI * 2); c.fill(); c.fillStyle = '#1e78ff'; c.beginPath(); c.arc(180, 360, 14, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(15,18,23,0.86)'; c.fillRect(0, 60, 360, 64); c.fillStyle = '#7dff9a'; c.font = '800 24px InterW, Arial'; c.fillText('GPS  ✓   YOU ARE HERE', 180, 101);
    c.fillStyle = 'rgba(15,18,23,0.86)'; c.fillRect(0, 640, 360, 80); wifiOff(c, 70, 692, 24, '#c7ced8'); c.fillStyle = '#ffffff'; c.textAlign = 'left'; c.font = '700 20px InterW, Arial'; c.fillText('Offline map', 110, 690);
  }
  return ctex(cv);
}
function spinnerTex() {
  const cv = canvas(128, 128), c = cv.getContext('2d');
  for (let i = 0; i < 12; i++) { c.strokeStyle = `rgba(255,255,255,${(0.15 + 0.85 * i / 11).toFixed(2)})`; c.lineWidth = 9; c.lineCap = 'round'; const a = i / 12 * Math.PI * 2; c.beginPath(); c.moveTo(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30); c.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); c.stroke(); }
  return ctex(cv);
}
function offlineScreen() {
  const cv = canvas(512, 320), c = cv.getContext('2d');
  c.fillStyle = '#16191f'; c.fillRect(0, 0, 512, 320);
  wifiOff(c, 256, 150, 70, '#aab2bc');
  c.fillStyle = '#ff6b6b'; c.textAlign = 'center'; c.font = '800 30px InterW, Arial'; c.fillText('NO INTERNET CONNECTION', 256, 236);
  c.fillStyle = '#7d8590'; c.font = '600 17px InterW, Arial'; c.fillText('ERR_INTERNET_DISCONNECTED', 256, 268);
  return ctex(cv);
}
function terminalTex(kind) {
  const cv = canvas(240, 324), c = cv.getContext('2d');
  c.fillStyle = kind === 'no' ? '#2a0a0e' : '#0d1a12'; c.fillRect(0, 0, 240, 324);
  c.textAlign = 'center';
  if (kind === 'no') { c.fillStyle = '#ff3b3b'; c.font = '900 92px InterW, Arial'; c.fillText('✕', 120, 130); c.font = '900 38px InterW, Arial'; c.fillText('DECLINED', 120, 200); c.fillStyle = '#ff9a9a'; c.font = '700 20px InterW, Arial'; c.fillText('NO CONNECTION', 120, 246); }
  else { c.fillStyle = '#9fffb8'; c.font = '800 44px InterW, Arial'; c.fillText('$24.90', 120, 92); c.font = '700 22px InterW, Arial'; c.fillText('(€22.90)', 120, 124); c.fillStyle = '#ffffff'; c.font = '800 30px InterW, Arial'; c.fillText('TAP OR', 120, 206); c.fillText('INSERT CARD', 120, 244); }
  return ctex(cv);
}
function billboardTex(kind) {
  const cv = canvas(1280, 532), c = cv.getContext('2d');
  c.fillStyle = '#0b0e14'; c.fillRect(0, 0, 1280, 532);
  c.textAlign = 'center';
  if (kind === 'ad') {
    const g = c.createLinearGradient(0, 0, 1280, 532); g.addColorStop(0, '#ff3d6e'); g.addColorStop(1, '#ffb347'); c.fillStyle = g; c.fillRect(0, 0, 1280, 532);
    c.fillStyle = '#fff'; c.font = '900 110px InterW, Arial'; c.fillText('PAY WITH', 640, 210); c.fillText('YOUR PHONE', 640, 330); c.font = '800 46px InterW, Arial'; c.fillText('MEGAMART APP · ONE TAP', 640, 430);
  } else if (kind === 'offline') {
    c.fillStyle = '#1a1d24'; c.fillRect(0, 0, 1280, 532); wifiOff(c, 640, 230, 120, '#c7ced8');
    c.fillStyle = '#ff5a5a'; c.font = '900 76px InterW, Arial'; c.fillText('SYSTEM OFFLINE', 640, 400); c.fillStyle = '#9aa3ad'; c.font = '700 34px InterW, Arial'; c.fillText('PLEASE STAND BY', 640, 460);
  } else if (kind === 'flights') {
    c.fillStyle = '#ffcc33'; c.textAlign = 'left'; c.font = '900 54px InterW, Arial'; c.fillText('✈ DEPARTURES', 50, 80);
    const rows = [['08:10', 'LONDON', 'BA 178'], ['08:25', 'TOKYO', 'JL 005'], ['08:40', 'DUBAI', 'EK 202'], ['09:05', 'PARIS', 'AF 023'], ['09:20', 'SYDNEY', 'QF 012'], ['09:45', 'TORONTO', 'AC 761']];
    rows.forEach(([tm, city, fl], i) => {
      const y = 160 + i * 62; c.fillStyle = '#e8e8e8'; c.font = '800 40px InterW, Arial'; c.textAlign = 'left'; c.fillText(tm, 50, y); c.fillText(city, 230, y); c.fillStyle = '#9aa3ad'; c.fillText(fl, 620, y);
      c.fillStyle = '#ff3b3b'; c.textAlign = 'right'; c.fillText('CANCELLED', 1230, y);
    });
  } else if (kind === 'back') {
    const g = c.createLinearGradient(0, 0, 1280, 532); g.addColorStop(0, '#16c47f'); g.addColorStop(1, '#1f8fff'); c.fillStyle = g; c.fillRect(0, 0, 1280, 532);
    c.fillStyle = '#fff'; c.font = '900 120px InterW, Arial'; c.fillText('WE’RE BACK', 640, 240); c.font = '800 54px InterW, Arial'; c.fillText('ONLINE ✓  WELCOME BACK', 640, 360);
  }
  return ctex(cv);
}
function badgeTex(n) {
  const cv = canvas(128, 128), c = cv.getContext('2d');
  c.fillStyle = '#ff2d3d'; c.beginPath(); c.arc(64, 64, 58, 0, Math.PI * 2); c.fill(); c.lineWidth = 6; c.strokeStyle = '#ffffff'; c.stroke();
  c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${n.length > 2 ? 44 : 60}px InterW, Arial`; c.fillText(n, 64, 68);
  return ctex(cv);
}

// ------------------------------------------------------------------ sound
const S_ = (file, t, o = {}) => Object.assign({ type: 'sample', file, t }, o);
function buildAudio() {
  const A = [];
  const fx = (type, o) => A.push(Object.assign({ type, fx: true }, o));
  const keysEvery = (f, step = 0.05) => { const ks = []; for (let t = 0; t <= DURATION; t += step) ks.push([+t.toFixed(2), +f(t).toFixed(3)]); return ks; };
  for (const key of ORDER) A.push(S_(VO[key].file, SAY[key], { level: 1.35, free: true, verb: 0.025, fin: 0.005, fout: 0.03 }));
  // a whoosh into every new shot, a soft click on every jump zoom
  SHOTS.slice(1).forEach((sh, i) => { if (!sh.stage && Math.abs(sh.t0 - SAY.cta) > 0.3) fx('sample', { file: 'sfx/2604.wav', t: sh.t0 - 0.14, level: 0.15 + 0.05 * hash(i, 11), pan: -0.3 + 0.6 * hash(i, 12) }); });
  PUNCH.forEach(([t0], i) => fx('sample', { file: 'sfx/1490.wav', t: t0 - 0.01, level: 0.07, pan: -0.2 + 0.4 * hash(i, 13) }));
  const talking = (t) => { let q = 0; for (const key of ORDER) { const at = SAY[key]; q = Math.max(q, smooth(at - 0.3, at - 0.05, t) * (1 - smooth(at + VO[key].dur, at + VO[key].dur + 0.35, t))); } return q; };
  A.push({ type: 'fxduck', keys: keysEvery((t) => 1 - 0.5 * talking(t), 0.04) });
  // music: tension for the first three days, then something warmer once people find each other
  A.push(S_('music/464.mp3', 0, { offset: 4, level: 0.48, fin: 0.3, fout: 1.2, dur: SAY.twist + 0.6, keys: keysEvery((t) => 1 - 0.7 * talking(t)) }));
  A.push(S_('music/606.mp3', SAY.twist - 0.3, { offset: 14, level: 0.48, fin: 1.0, fout: 1.6, dur: DURATION - SAY.twist + 0.3, keys: keysEvery((t) => (Math.abs(t - T_NOTIF) < 0.05 ? 0.3 : 1) * (1 - 0.68 * talking(t))) }));
  // the morning: birds, then the phone failing
  A.push(S_('sfx/367.wav', 0, { offset: 2, dur: SAY.day1 + 0.5, level: 0.28, fin: 0.4, fout: 0.8 }));
  fx('sample', { file: 'sfx/1022.wav', t: T_DOWN, level: 0.5 });
  fx('chirp', { t: T_DOWN + 0.2, level: 0.14, seed: 5, f: [900, 420] });
  fx('sample', { file: 'sfx/2604.wav', t: SAY.goal + 1.0, level: 0.35 });
  fx('count', { t0: T_OFFLINE, t1: T_OFFLINE + 1.0, from: 18, to: 30, level: 0.1, seed: 6 });
  // card declined: two low beeps; CASH ONLY slaps on the glass; the queue sighs
  for (const dt of [0, 0.18]) fx('chirp', { t: T_DECLINE + dt, level: 0.2, seed: 7, f: [520, 380] });
  fx('sample', { file: 'sfx/2380.wav', t: T_CASHONLY + 0.05, level: 0.45 });
  fx('crowd', { t0: T_CASHONLY, t1: SAY.day2, level: 0.12, swell: [[T_CASHONLY, 0.3], [T_CASHONLY + 1.2, 0.8], [SAY.day2, 0.2]] });
  // day two: switches, the departures board flipping
  fx('sample', { file: 'sfx/1490.wav', t: SAY.day2 - 0.15, level: 0.32 });
  for (let i = 0; i < 6; i++) fx('sample', { file: 'sfx/1117.wav', t: T_FLIGHTS + 0.1 + i * 0.09, level: 0.22, pan: -0.3 + i * 0.12 });
  // day three: things being grabbed off shelves
  fx('sample', { file: 'sfx/1492.wav', t: SAY.day3 - 0.1, level: 0.3 });
  for (let i = 0; i < 12; i++) fx('sample', { file: 'sfx/2364.wav', t: T_SHELVES + i * 0.17, level: 0.08 + 0.04 * hash(i, 2), pan: -0.5 + hash(i, 3) });
  // the twist: evening, a satellite, radio static and a voice, a phone ringing through
  A.push(S_('sfx/1789.wav', SAY.twist, { dur: SAY.day5 - SAY.twist, level: 0.22, fin: 1.0, fout: 0.8 }));
  fx('sparkle', { t: T_SKY, dur: 1.6, count: 9, f: [1600, 4200], level: 0.14, seed: 8 });
  A.push(S_('sfx/2563.wav', T_RADIO - 0.05, { dur: T_CALL - T_RADIO + 0.4, level: 0.35, fin: 0.05, fout: 0.3 }));
  for (let i = 0; i < 2; i++) fx('chime', { t: T_CALL + 0.2 + i * 0.55, level: 0.06, freq: 880 });
  // day five: kids playing
  A.push(S_('sfx/1193.wav', SAY.day5, { offset: 3, dur: SAY.cost - SAY.day5 + 0.2, level: 0.3, fin: 0.3, fout: 0.3 }));
  fx('sample', { file: 'sfx/2605.wav', t: SAY.cost - 0.1, level: 0.3 });
  fx('count', { t0: SAY.cost + 0.3, t1: SAY.real - 0.4, from: 22, to: 36, level: 0.08, seed: 9 });
  // the cable cut
  fx('sample', { file: 'sfx/2604.wav', t: SAY.real - 0.1, level: 0.3 });
  const T_CUTHIT = W_('real', 'one') + 0.22;                             // after "cut one," so the hit never masks the words
  A.push(S_('sfx/1022.wav', T_CUTHIT, { level: 0.4, free: true }));
  A.push({ type: 'subdrop', t: T_CUTHIT, dur: 1.2, level: 0.4, free: true });
  fx('sparkle', { t: T_CUT + 0.5, dur: 1.4, count: 12, f: [1800, 5200], level: 0.14, seed: 10 });
  // day seven: a riser, then every notification at once
  fx('riser', { t0: T_BACK - 0.6, t1: T_NOTIF, level: 0.18, curve: 2.4 });
  for (let i = 0; i < 34; i++) { const t = T_NOTIF + Math.pow(i / 34, 1.4) * 1.9; if (t > SAY.cta - 0.7) continue; fx('chirp', { t, level: 0.09 + 0.05 * hash(i, 4), seed: 100 + i, f: [1700 + 600 * hash(i, 5), 2300 + 600 * hash(i, 6)], pan: -0.8 + 1.6 * hash(i, 7) }); }
  for (let i = 0; i < 14; i++) { const t = T_NOTIF + i * 0.11; if (t < SAY.cta - 0.7) fx('sample', { file: 'sfx/1124.wav', t, level: 0.12, dur: 0.35, fout: 0.12, pan: -0.6 + hash(i, 8) * 1.2 }); }   // short, and clear of the last line
  A.push(S_('sfx/2896.wav', T_NOTIF, { level: 0.4, free: true, dur: SAY.cta - T_NOTIF - 0.25, fout: 0.6 }));   // the boom rings out before the last line
  return A;
}

// ------------------------------------------------------------------ the hook's icon: wi-fi with a slash
const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#f4f1ea" stroke-width="9" stroke-linecap="round">
<path d="M14 50 a66 66 0 0 1 92 0"/><path d="M30 68 a42 42 0 0 1 60 0"/><path d="M46 85 a18 18 0 0 1 28 0"/></g><circle cx="60" cy="100" r="7" fill="#f4f1ea"/>
<line x1="20" y1="20" x2="100" y2="104" stroke="#ff4b4b" stroke-width="10" stroke-linecap="round"/></svg>`;

// ------------------------------------------------------------------ HUD sub-lines
const subAt = (t, list) => { let s = list[0][1], at = -9; for (const [t0, txt] of list) if (t >= t0) { s = txt; at = t0; } return { sub: s, age: t - at }; };
const fmtB = (n) => (n >= 100 ? `${Math.round(n)}` : n.toFixed(0));

// ------------------------------------------------------------------ bold short-form captions (two or three words, heavy outline, keywords in yellow)
const OUTLINE = [[6, 0], [-6, 0], [0, 6], [0, -6], [4.5, 4.5], [-4.5, 4.5], [4.5, -4.5], [-4.5, -4.5]].map(([x, y]) => `${x}px ${y}px 0 #000`).join(', ');
const CAPTION_CSS = `#title { display: none !important; }
@font-face { font-family: 'MontB'; font-weight: 900; src: url(/node_modules/@fontsource/montserrat/files/montserrat-latin-900-normal.woff2) format('woff2'); }
#caption { top: 1150px; left: 30px; right: 30px; }
#caption::before { display: none; }
#caption span { font-family: 'MontB', sans-serif; font-style: normal; font-weight: 900; font-size: 98px; line-height: 1.04; letter-spacing: -1px; text-transform: uppercase; color: #fff; text-shadow: ${OUTLINE}, 0 12px 26px rgba(0,0,0,0.55); }
#caption .cw { color: #ffffff; }
#caption .cw.hl { color: #ffd84a; font-style: normal; }
`;

// ------------------------------------------------------------------ the scenario
export default {
  id: 'internet-down',
  title: 'What if the internet went down for a week?',
  css: CAPTION_CSS + '#goal .fill { background: linear-gradient(90deg, #ff6b6b, #ffb347); } #goal .dot { box-shadow: 0 0 16px rgba(255,120,90,0.95), 0 0 0 4px #ff6b6b; } #goal .tick.on { background: #ff8a6b; box-shadow: 0 0 10px rgba(255,120,90,0.9), 0 0 0 2px rgba(0,0,0,0.25); }',
  endFact: '',
  duration: DURATION,
  fadeOut: FADE, endAt: 1e9,
  captions: CAPTIONS,
  captionFade: 0.08,
  goal(t) {
    const a = smooth(SAY.goal + 0.3, SAY.goal + 0.8, t) * (1 - smooth(SAY.real - 0.4, SAY.real, t)) + smooth(SAY.day7 - 0.2, SAY.day7 + 0.3, t) * (1 - smooth(FADE[0], FADE[1], t));
    if (a <= 0) return null;
    const d = daysAt(t), day = Math.min(7, Math.floor(d) + 1);
    const ticks = [1, 2, 3, 4, 5, 6].map((n) => ({ k: n / 7, on: d >= n, pop: Math.exp(-Math.pow((d - n) * 3, 2)) }));
    if (d >= 6.99) return { label: 'BACK ONLINE ✓', pct: 'DAY 7', k: 1, from: 'DAY 1', to: 'DAY 7', alpha: a, ticks };
    return { label: 'OFFLINE · WORLDWIDE', pct: `DAY ${day}`, k: d / 7, from: 'DAY 1', to: 'DAY 7', alpha: a, ticks };
  },
  hud(t) {
    if (t >= FADE[1]) return null;
    if (t < SAY.day2) {
      const a = smooth(T_OFFLINE - 0.2, T_OFFLINE + 0.3, t) * (1 - smooth(SAY.day2 - 0.3, SAY.day2, t));
      const n = 5.5e9 * smooth(T_OFFLINE, T_OFFLINE + 1.0, t);
      const s = subAt(t, [[T_OFFLINE, '5.5 BILLION INTERNET USERS (ITU 2024)'], [SAY.day1, 'MESSAGES · BANKING · MAPS · STREAMING: DOWN'], [SAY.cash, 'ONLY 14% OF US PAYMENTS ARE CASH (FED 2025)']]);
      return { label: 'PEOPLE OFFLINE', value: Math.round(n).toLocaleString('en-US'), value2: '', sub: s.sub, subAge: s.age, pop: Math.exp(-Math.pow((t - T_OFFLINE - 1.0) / 0.2, 2)) + Math.exp(-Math.pow((t - T_DECLINE - 0.2) / 0.2, 2)), alpha: a };
    }
    if (t < SAY.real) {
      const a = smooth(SAY.day2, SAY.day2 + 0.4, t) * (1 - smooth(SAY.real - 0.3, SAY.real, t));
      const lost = 43 * daysAt(t);
      const s = subAt(t, [[SAY.day2, 'OFFICES CLOSED · AIRPORTS GROUNDED'], [T_2024, 'JULY 2024: ONE BAD UPDATE · 8.5M PCs · 10,000+ FLIGHTS'], [SAY.day3, 'FRESH FOOD RUNS OUT FIRST'],
        [SAY.twist, 'STILL WORKING: GPS · RADIO · PHONE CALLS'], [T_SKY, 'GPS SATELLITES: 20,200 KM (12,550 MI) UP'], [SAY.day5, 'NEIGHBOURS OUTSIDE · KIDS IN THE STREET'], [SAY.cost, '≈ $43 BILLION A DAY (NETBLOCKS)']]);
      return { label: 'COST TO THE WORLD SO FAR', value: `$${fmtB(lost)} billion`, value2: `≈ €${fmtB(lost * 0.92)} billion`, sub: s.sub, subAge: s.age, pop: Math.exp(-Math.pow((t - SAY.cost - 0.4) / 0.25, 2)), alpha: a };
    }
    if (t >= SAY.day7) {
      const a = smooth(T_BACK, T_BACK + 0.4, t) * (1 - smooth(FADE[0], FADE[1], t));
      const s = subAt(t, [[T_BACK, 'EVERYTHING FROM THE WEEK · AT ONCE']]);
      return { label: 'NOTIFICATIONS', value: Math.round(1e9 * Math.pow(smooth(T_NOTIF - 0.1, T_NOTIF + 2.5, t), 2) * 37).toLocaleString('en-US'), value2: '', sub: s.sub, subAge: s.age, pop: Math.exp(-Math.pow((t - T_NOTIF) / 0.25, 2)), alpha: a };
    }
    return null;
  },
  labels(t) {
    const out = [], c = camAt(t);
    const call = (t0, t1, p, text, side, big = false) => {
      const a = smooth(t0, t0 + 0.3, t) * (1 - smooth(t1 - 0.3, t1, t)); if (a <= 0.001) return;
      const s = toScreen(c, p); if (!s.ok || (!big && s.y < 470)) return;
      out.push({ x: s.x, y: s.y, text, alpha: a, big, side: big ? side : s.x < W * 0.45 ? 'right' : s.x > W * 0.6 ? 'left' : side });
    };
    call(wordT('day1', 'messages') - 0.1, SAY.cash - 0.1, V(ROOMS[1].x + 0.4, ROOMS[1].y + 2.0, 33.0), 'MESSAGES: NOT SENT', 'right');
    call(wordT('day1', 'your') - 0.1, SAY.cash - 0.1, V(ROOMS[2].x - 0.8, ROOMS[2].y + 2.0, 33.6), 'BANK APP: LOADING…', 'left');
    call(T_FLIGHTS + 0.2, SAY.day3 - 0.1, V(BILL.x - 4, BILL.y - BILL.h / 2 - 0.2, BILL.z - 0.05), 'EVERY FLIGHT GROUNDED', 'right');
    call(T_SKY + 0.6, T_RADIO - 0.1, satPos(t), 'GPS SATELLITE · 20,200 KM', 'right');
    call(T_RADIO + 0.2, T_CALL - 0.1, V(LAWN_C.x, 0.9, LAWN_C.z), 'BATTERY RADIO', 'right');
    call(T_CALL + 0.4, SAY.day5 - 0.1, V(CALLER.x, 2.05, CALLER.z), 'CALL CONNECTED ✓', 'left');
    call(SAY.real + 1.2, T_CUT - 0.3, V(0, GR + 0.6, 0).applyAxisAngle(V(1, 0, 0), -0.5), '≈ 600 UNDERSEA CABLES', 'right', false);
    call(wordT('real', 'hundreds') + 0.1, T_CUT - 0.2, ll2v(30, -45, GR + 0.3).applyAxisAngle(V(0, 1, 0), globeRot(t)), '99% OF DATA BETWEEN CONTINENTS', 'left');
    call(T_CUT + 0.15, SAY.day7, cutMid(t), 'CUT', 'right', true);
    return out;
  },
  audio: buildAudio(),

  async setup(ctx) {
    const { renderer } = ctx;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.0;
    ctx.grain = 0; ctx.vignette = 0; ctx.handheld = 0;
    ctx.grade = { brightness: 1.0, contrast: 1.0, saturate: 1.0, sepia: 0 };
    ctx.post = { layered: true, bloom: { strength: 0.62, radius: 0.55, threshold: 1.1 }, dof: { focus: 10, aperture: 0.004, maxBlur: 0.012, farBlur: 0.25 },
      grade: { contrast: 1.17, saturation: 1.16, lift: [0.0, 0.008, 0.024], gain: [1.05, 1.0, 0.95], split: 0.16, vignette: 0.34, grain: 0.03, ca: 0.0014 } };
    if (this.css && typeof document !== 'undefined') { const s = document.createElement('style'); s.textContent = this.css; document.head.appendChild(s); }
    const st = this.st = {}; window.__st = st;
    const IU = st.IU = makeIU();
    IU.uFlipCol.value.setRGB(0.9, 0.35, 0.35);                            // a dead screen glows a dull red
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0.0 ? mix(vec3(0.55,0.55,0.6), vec3(0.3,0.38,0.55), pow(h, 0.5)) : mix(vec3(0.3,0.28,0.27), vec3(0.08,0.08,0.09), pow(-h, 0.4)); c += vec3(1.0, 0.75, 0.45) * pow(max(dot(vD, normalize(vec3(0.5, 0.2, 0.8))), 0.0), 12.0); gl_FragColor = vec4(c, 1.0); }',
    })));
    const env = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0).texture;
    // ---- the main set: the city kit
    const scene = st.scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#c8cfd8', 0.002);
    scene.environment = env; scene.environmentIntensity = 0.3;
    st.hemi = new THREE.HemisphereLight('#a6c0e0', '#5d554a', 0.9);
    st.sun = new THREE.DirectionalLight('#ffe0bc', 2.0);
    st.sun.castShadow = true; st.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(st.sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 260 });
    st.sun.shadow.bias = -0.0004; st.sun.shadow.normalBias = 0.04;
    scene.add(st.hemi, st.sun, st.sun.target);
    scene.add(buildSky(st));
    const depts = [null, 'CUSTOMER SERVICE', 'SALES', 'MARKETING', 'DESIGN', 'SOFTWARE', 'FINANCE', 'LEGAL', 'OPERATIONS', 'PRODUCT', 'HUMAN RESOURCES', 'MANAGEMENT', 'RESEARCH'];
    scene.add(buildTower(st, IU, env, { depts, screenA: offlineScreen }));
    scene.add(buildStore(st, IU, env, { dynamicProducts: true, posters: [[['CASH', 170], ['ONLY', 210]], [['SORRY', 120], ['NO CARDS', 150], '#ffd23c', '#141414'], [['SOLD', 170], ['OUT', 210], '#151a22', '#ff5050']] }));
    scene.add(buildFlats(st, IU, env), buildStreet(st, IU), buildCity(st, env));
    st.cartons.im.count = 0;
    st.cityU.uSpread.value.set(1e4, 1e4);                                  // the city's windows stay warm (it's the internet that's down, not the power)
    // fresh produce: the shelf nearest the tills goes green and red, and empties first
    { const P = st.products, c = new THREE.Color(), pr = new Rng(4);
      P.order = P.list.map((b, i) => ({ i, k: (b[3] > -5 ? 0 : 0.35) + pr.next() * 0.65 })).sort((a, b) => a.k - b.k).map((o) => o.i);
      P.list.forEach((b, i) => { if (b[3] > -5) P.im.setColorAt(i, c.set(pr.pick(['#3f9a3a', '#7cc04a', '#d63b2f', '#f2a33a', '#e8d44d']))); });
      P.colors = P.list.map((b, i) => { const k = new THREE.Color(); P.im.getColorAt(i, k); return k; });
      P.im.instanceColor.needsUpdate = true; }
    // ---- the card terminal on the till
    { const g = new THREE.Group(); g.position.copy(TERM); scene.add(g); st.term = g;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.19), patchInterior(new THREE.MeshStandardMaterial({ color: '#202327', roughness: 0.4 }), IU, 'term'));
      body.position.y = 0.06; body.rotation.x = -0.64; g.add(body);                  // top face toward the customer (-z)
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.05, 16), body.material); stand.position.y = 0.025; g.add(stand);
      st.termTex = { tap: terminalTex('tap'), no: terminalTex('no') };
      st.termScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.115), new THREE.MeshBasicMaterial({ map: st.termTex.tap, toneMapped: false, color: new THREE.Color(1.2, 1.2, 1.2) }));
      st.termScreen.position.set(0, 0.0181, 0.02); st.termScreen.rotation.set(-Math.PI / 2, 0, Math.PI); body.add(st.termScreen); }
    // ---- the billboard on the supermarket roof
    { st.billTex = { ad: billboardTex('ad'), offline: billboardTex('offline'), flights: billboardTex('flights'), back: billboardTex('back') };
      const frame = new THREE.Mesh(new THREE.BoxGeometry(BILL.w + 0.5, BILL.h + 0.5, 0.4), patchInterior(new THREE.MeshStandardMaterial({ color: '#25282e', roughness: 0.5, metalness: 0.5 }), IU, 'billframe'));
      frame.position.set(BILL.x, BILL.y, BILL.z + 0.3); scene.add(frame);
      for (const dx of [-4, 4]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 0.3), frame.material); leg.position.set(BILL.x + dx, 8.6 + 0.8, BILL.z + 0.6); scene.add(leg); }
      st.bill = new THREE.Mesh(new THREE.PlaneGeometry(BILL.w, BILL.h), new THREE.MeshBasicMaterial({ map: st.billTex.ad, toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1) }));
      st.bill.position.set(BILL.x, BILL.y, BILL.z); st.bill.rotation.y = Math.PI; scene.add(st.bill); }
    // ---- the hero's phone (a real screen, close up), the radio, the satellite, notification badges
    { const g = new THREE.Group(); scene.add(g); st.hphone = g; g.matrixAutoUpdate = false;
      const body = new THREE.Mesh(new RoundedPhone(), new THREE.MeshStandardMaterial({ color: '#15171b', roughness: 0.35, metalness: 0.4 })); g.add(body);
      st.phoneTex = { loading: phoneTex('loading'), off: phoneTex('off'), map: phoneTex('map') };
      st.hscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.074, 0.15), new THREE.MeshBasicMaterial({ map: st.phoneTex.loading, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.15) }));
      st.hscreen.rotation.y = Math.PI; st.hscreen.position.z = -0.0081; g.add(st.hscreen);
      st.spin = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), new THREE.MeshBasicMaterial({ map: spinnerTex(), transparent: true, toneMapped: false, depthWrite: false }));
      st.spin.rotation.y = Math.PI; st.spin.position.set(0, -0.01, -0.0086); g.add(st.spin); }
    { const radio = new THREE.Group(); radio.position.copy(LAWN_C).setY(0.15); scene.add(radio); st.radio = radio;
      const m = patchInterior(new THREE.MeshStandardMaterial({ color: '#7a2f22', roughness: 0.6 }), IU, 'radio');
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.16), m); b.position.y = 0.13; b.castShadow = true; radio.add(b);
      const grille = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), patchInterior(new THREE.MeshStandardMaterial({ color: '#c9b48a', roughness: 0.8 }), IU, 'grille')); grille.position.set(-0.08, 0.13, 0.081); radio.add(grille);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.55), new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 0.8, roughness: 0.3 })); ant.position.set(0.15, 0.5, 0); ant.rotation.z = -0.35; radio.add(ant);
      st.rings = Array.from({ length: 4 }, () => { const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 0.8), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); ring.rotation.x = Math.PI / 2; radio.add(ring); return ring; });
      const lamp = new THREE.PointLight('#ffb070', 0, 9, 1.6); lamp.position.set(0, 0.6, 0); radio.add(lamp); st.radioLamp = lamp; }
    st.sat = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot('rgba(255,255,255,1)', 'rgba(200,230,255,0.6)'), color: new THREE.Color(4, 4, 4), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    st.sat.scale.setScalar(5); scene.add(st.sat);
    st.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 3.0, 1, 24, 1, true).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.6, 1.0), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    scene.add(st.beam);
    st.badgeTex = ['3', '12', '47', '99+', '128', '999+'].map(badgeTex);
    st.badges = Array.from({ length: 64 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: st.badgeTex[i % st.badgeTex.length], transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) })); s.visible = false; scene.add(s); return s; });
    // ---- people
    const ppl = st.ppl = buildPeople({ max: 260, seed: 21 });
    patchInterior(ppl.group.children[0].material, IU, 'people');
    scene.add(ppl.group);
    st.phoneMesh = ppl.group.children.find((m) => m.isInstancedMesh && m.material === ppl.screenMat);
    const P = ppl.POSES;
    P.holdPhone = (ph, t, s) => ({ armR: 1.12 + 0.02 * Math.sin(t * 1.7), armRr: 0.32, armL: 0.95, armLr: -0.3, head: 0.48, torso: 0.03 });
    P.sitPhone = (ph, t, s) => ({ legL: 1.5, legR: 1.5, drop: 0.38, armR: 1.12, armRr: 0.32, armL: 0.9, armLr: -0.3, head: 0.5, torso: 0.02 });
    P.desk = (ph, t, s) => ({ legL: 1.5, legR: 1.5, drop: 0.38, torso: -0.05, armL: 0.6, armR: 0.6, armLr: -0.1, armRr: 0.1, head: 0.05 + 0.05 * Math.sin(t * 0.8 + s) });
    P.carry = (ph) => { const sn = Math.sin(ph); return { legL: 0.5 * sn, legR: -0.5 * sn, armL: 1.25, armR: 1.25, armLr: -0.18, armRr: 0.18, bob: 0.035 * Math.abs(Math.cos(ph)), torso: 0.05 }; };
    P.sitGround = () => ({ legL: 1.45, legR: 1.45, drop: 0.78, torso: 0.1, armL: 0.5, armR: 0.5, armLr: 0.25, armRr: -0.25, head: 0.15 });
    P.phoneCall = (ph, t, s) => ({ armR: 2.55, armRr: 0.95, armRy: 0.2, head: 0.05 + 0.05 * Math.sin(t * 1.3), torso: 0.02, armL: 0.15 });
    P.lookUp2 = (ph, t, s) => ({ head: -0.6, torso: -0.1, armR: 1.1, armRr: 0.32 });
    P.cheer = (ph, t, s) => ({ armR: 2.3 + 0.25 * Math.sin(t * 8 + s), armRr: -0.2, armL: 1.1, armLr: -0.3, head: 0.2, drop: -0.04 * Math.abs(Math.sin(t * 8 + s)) });
    // the hero first, so his phone is phone instance 0 during the hook
    ppl.add({ x: HERO.x, z: HERO.z, y: HERO.y, h: HERO.h, poses: [[0, 'holdPhone']], phone: (t) => t < SAY.day1, phoneTilt: 0.6, visible: (t) => t < SAY.day1, shirt: '#34495e', pants: '#2c3e50', hair: 'short', skin: '#c68a62', hairC: '#1d1612', longSleeve: true });
    // the person on the lawn with the map is phone instance 0 during the twist
    ppl.add({ x: GPS_P.x, z: GPS_P.z, h: GPS_P.h, poses: [[0, 'holdPhone'], [T_SKY + 0.2, 'lookUp2', 0.5]], phone: (t) => t > T_GPS - 0.2 && t < T_RADIO, phoneTilt: 0.6, visible: (t) => t > SAY.twist - 0.3 && t < SAY.day5, shirt: '#e67e22', pants: '#3b4a6b', hair: 'bun' });
    ppl.add({ x: CALLER.x, z: CALLER.z, h: CALLER.h, poses: [[0, 'idle'], [T_CALL - 0.4, 'phoneCall', 0.4]], phone: (t) => t > T_CALL - 0.3 && t < SAY.day5, phoneTilt: 0.2, noGlow: true, visible: (t) => t > SAY.twist - 0.3 && t < SAY.day5, shirt: '#2a9d8f', pants: '#2c3e50', hair: 'short' });
    for (const [room, dx, z, h] of FLAT_PPL) {
      const R = ROOMS[room], sit = room === 3 || room === 9;
      ppl.add({ x: R.x + dx, z, y: R.y, h, poses: [[0, sit ? 'sitPhone' : 'holdPhone'], [T_NOTIF + 0.1, sit ? 'sitPhone' : 'cheer', 0.3]], phone: (t) => (t > SAY.day1 - 0.2 && t < SAY.cash) || t > T_BACK, phoneTilt: -0.5, visible: (t) => (t > SAY.day1 - 0.3 && t < SAY.cash) || t > SAY.day7 - 0.3 });
    }
    st.workers = [];
    for (const w of WORKERS) { const spec = ppl.add({ y: w.f * FH, poses: [[0, 'desk'], [w.ts, 'idle', 0.35], [w.tw, 'carry', 0.3]], at: w.w.at, visible: (t) => t < w.w.end && t > SAY.goal - 1 && t < SAY.day3 }); st.workers.push(w); }
    QUEUE.forEach((q, i) => ppl.add({ at: walker([[q.x, q.z], [q.x - 1, q.z - 0.6], [-60, q.z - 0.8]], q.tGo, 1.2 + 0.1 * (i % 3), Math.PI / 2).at, poses: [[0, 'idle'], [q.tShrug, 'shrug', 0.3], [q.tGo, 'walk', 0.3]], visible: (t) => t > SAY.cash - 0.5 && t < SAY.day2 }));
    ppl.add({ x: -0.95, z: 30.35, h: 0, poses: [[0, 'pointFwd'], [T_DECLINE + 0.3, 'shrug', 0.3]], visible: (t) => t > SAY.cash - 0.5 && t < SAY.day2, shirt: '#8e44ad', hair: 'long' });
    ppl.add({ x: -0.95, z: 32.2, h: Math.PI, poses: [[0, 'idle'], [T_DECLINE + 0.2, 'shrug', 0.3]], visible: (t) => t > SAY.cash - 0.5 && t < SAY.day2, shirt: '#c8102e', pants: '#2c3e50' });
    SHOPPERS.forEach(([x, ph], i) => ppl.add({ at: (t) => { const L = 22, s = ((t + ph) * 1.25) % L, z = s < 11 ? 31 + s : 42 - (s - 11); return { x: x + 0.3 * (i % 2 ? 1 : -1), z, h: s < 11 ? 0 : Math.PI, moving: 1, dist: (t + ph) * 1.25 }; }, poses: [[0, 'carry']], visible: (t) => t > SAY.day3 - 0.5 && t < SAY.twist }));
    for (const q of RADIO_RING) ppl.add({ x: q.x, z: q.z, h: q.h, y: 0.0, poses: [[0, 'sitGround']], visible: (t) => t > SAY.twist - 0.3 && t < SAY.day5 });
    for (const q of KIDS) ppl.add({ at: (t) => kidAt(q, t), kid: true, poses: [[0, 'run']], v: 3, visible: (t) => t > SAY.day5 - 0.3 && t < SAY.cost });
    for (const [x, z] of [[-9, 26.2], [-7.8, 26.6], [3, 26.0], [4.1, 26.4], [-14, 12.6], [-12.9, 12.2]]) ppl.add({ x, z, h: (x % 2 ? 1 : -1) * Math.PI / 2, poses: [[0, 'idle'], [SAY.day5, 'wave', 0.5]], visible: (t) => t > SAY.day5 - 0.3 && t < SAY.cost });
    for (const [x, z] of LAWN_NIGHT) ppl.add({ x, z, h: Math.PI + 0.3 * Math.sin(x), poses: [[0, 'holdPhone'], [T_NOTIF + 0.15, 'cheer', 0.3]], phone: (t) => t > T_BACK, phoneTilt: -0.5, visible: (t) => t > SAY.day7 - 0.3 });
    // ---- a few parked cars; the avenue stays quiet all week
    const veh = st.veh = buildVehicles({ seed: 5, max: 8 });
    patchInterior(veh.group.children[0].material, IU, 'veh');
    scene.add(veh.group);
    for (const [x, z, h] of [[-16, 15.4, 1], [-8, 15.4, 1], [6, 22.8, -1], [14, 22.8, -1]]) veh.add({ at: () => ({ x, z, h: h * Math.PI / 2, dist: 0 }), loop: false, path: [[0, 0], [1, 0]] });
    // ---- the globe of undersea cables
    await this.buildGlobe(st);
    ctx.poseAt = (t) => this.pose(ctx, t);
  },

  async buildGlobe(st) {
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#03060d');
    const tex = await new THREE.TextureLoader().loadAsync('/assets/earth/world.topo.bathy.200410.3x5400x2700.jpg'); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const NLAT = 96, NLON = 192, pos = [], uv = [], idx = [];
    for (let i = 0; i <= NLAT; i++) for (let j = 0; j <= NLON; j++) { const lat = -90 + 180 * i / NLAT, lon = -180 + 360 * j / NLON; pos.push(...ll2v(lat, lon).toArray()); uv.push(j / NLON, i / NLAT); }
    for (let i = 0; i < NLAT; i++) for (let j = 0; j < NLON; j++) { const a = i * (NLON + 1) + j, b = a + 1, c = a + NLON + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const earth = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, color: new THREE.Color(0.75, 0.8, 0.95) })); scene.add(earth);
    const atm = new THREE.Mesh(new THREE.SphereGeometry(GR * 1.04, 64, 32), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN, vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN, vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(vec3(0.3, 0.6, 1.4) * f * 1.4, f); }' }));
    scene.add(atm);
    scene.add(new THREE.HemisphereLight('#8aa8ff', '#0a0c14', 0.9));
    const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(-6, 8, 10); scene.add(key);
    // stars
    { const N = 1500, a = new Float32Array(N * 3), rr = new Rng(3); for (let i = 0; i < N; i++) { const u = rr.float(-1, 1), th = rr.float(0, Math.PI * 2), s = Math.sqrt(1 - u * u); a.set([Math.cos(th) * s * 120, u * 120, Math.sin(th) * s * 120], i * 3); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(a, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#c8d4ff', size: 1.6, sizeAttenuation: false }))); }
    // cables: glowing tubes along great circles; the cut one turns red and breaks
    st.cables = CABLES.map(([a, b], i) => {
      const pts = arcPoints(CITIES[a], CITIES[b]);
      const curve = new THREE.CatmullRomCurve3(pts);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.022, 6, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.6, 2.2), toneMapped: false, transparent: true }));
      scene.add(m); return { m, curve, pts };
    });
    const cut = st.cables[CUT_I];
    st.cutHalves = [0, 1].map((h) => { const pts = cut.pts.filter((_, i) => (h ? i > 27 : i < 21)); const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.026, 6, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.3, 0.25), toneMapped: false })); m.visible = false; scene.add(m); return m; });
    // data packets: bright dots running along every cable
    const N = st.cables.length * 4;
    st.packets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.2, 3.0), toneMapped: false }), N + 24);
    st.packetCap = N + 24; st.packets.instanceMatrix.setUsage(THREE.DynamicDrawUsage); st.packets.frustumCulled = false; st.packets.count = 0; scene.add(st.packets);
    const cam = new THREE.PerspectiveCamera(36, W / H, 0.1, 500);
    st.globe = { scene, cam, earth };
  },

  update(ctx, t) {
    this.pose(ctx, t);
    const c = camAt(t), c2 = camAt(t + 1 / 30);
    const v = c.pos.distanceTo(c2.pos) * 30, turn = c.look.clone().sub(c.pos).normalize().angleTo(c2.look.clone().sub(c2.pos).normalize()) * 30;
    const fast = c.shot === c2.shot && (v > 6 || turn > 0.5);
    ctx.motionBlur = { samples: fast || trauma(t) > 0.2 ? 4 : 2, shutter: 0.5, reuseDepth: true };
    if (DBG?.mb) ctx.motionBlur.samples = DBG.mb;
    ctx.renderer.shadowMap.autoUpdate = false; ctx.renderer.shadowMap.needsUpdate = true;
    ctx.flashColor = '#ffffff'; ctx.flash = FLASHES.reduce((m, t0) => Math.max(m, t >= t0 ? 0.75 * Math.exp(-(t - t0) / 0.06) : 0), 0);
  },

  pose(ctx, t) {
    if (shotIdx(t) !== shotIdx(ctx.t)) t = ctx.t;                      // sub-frames never reach across a cut
    const st = this.st, IU = st.IU;
    const c = camAt(t);
    const OV = (typeof window !== 'undefined' && window.__cam) || DBG;
    if (OV?.pos) { c.pos = V(...OV.pos); c.look = V(...OV.look); c.fov = OV.fov ?? c.fov; c.rot = { x: 0, y: 0, z: 0 }; }
    if (c.stage) {
      poseCamera(st.globe.cam, c);
      ctx.view = { scene: st.globe.scene, camera: st.globe.cam };
      ctx.dof = { focus: c.pos.distanceTo(c.look), aperture: 0.0015, farBlur: 0 };
      ctx.renderer.toneMappingExposure = 1.0;
      this.poseGlobe(t); return;
    }
    const cam = (st.cam ??= new THREE.PerspectiveCamera(40, W / H, 0.05, 4200));
    cam.near = c.pos.distanceTo(c.look) < 3 ? 0.02 : 0.25;
    poseCamera(cam, c);
    ctx.view = { scene: st.scene, camera: cam };
    const look = c.look;
    ctx.dof = OV?.pos ? { focus: 10, aperture: 0, farBlur: 0 } : { focus: c.pos.distanceTo(look), aperture: 0.003, farBlur: 0.18 };

    // ---- light
    const L = todAt(t);
    ctx.renderer.toneMappingExposure = L.expo;
    st.skyU.uZen.value.copy(L.zen); st.skyU.uHor.value.copy(L.hor); st.skyU.uGlow.value.copy(L.glow); st.skyU.uSun.value.copy(L.sun); st.skyU.uStars.value = L.stars; st.skyU.uDisc.value = L.disc;
    st.hemi.color.copy(L.sky); st.hemi.groundColor.copy(L.gnd); st.hemi.intensity = L.hemiI;
    st.sun.color.copy(L.sunCol); st.sun.intensity = L.sunI;
    const sunDir = L.sun.y > 0.03 ? L.sun : V(0.3, 0.8, -0.5).normalize();
    st.sun.position.copy(look).addScaledVector(sunDir, 120); st.sun.target.position.copy(look); st.sun.target.updateMatrixWorld();
    st.scene.fog.color.copy(L.fog); st.scene.fog.density = L.fogD;
    st.groundU.uAmb.value.setRGB(...L.amb); st.groundU.uSun.value.setRGB(...L.sunG); st.groundU.uFogC.value.copy(L.fog); st.groundU.uFogD.value = L.fogD;
    IU.uStreet.value = L.street; st.lampHeadM.color.setRGB(3 * L.street + 0.4, 2.2 * L.street + 0.4, 1.3 * L.street + 0.4);
    st.lampGlow.im.visible = L.street > 0.1;
    if (st.lampGlow.im.visible) { const M = new THREE.Matrix4(), s = 1.5; st.lampGlow.pts.forEach((p, i) => { M.compose(p, cam.quaternion, V(s, s, s)); st.lampGlow.im.setMatrixAt(i, M); }); st.lampGlow.im.instanceMatrix.needsUpdate = true; st.lampGlow.im.material.opacity = L.street; }
    st.cityU.uTime.value = t; st.cityU.uDay.value = L.day; st.cityU.uAll.value = 0;
    st.beacon.material.opacity = Math.sin(t * 3.1) > 0.2 ? 1 : 0.15;

    // ---- the tower: every screen dies at once and comes back on day seven
    IU.uTime.value = t; IU.uHeroT.value = 1e4;
    const back = t > T_BACK;
    for (let f = 0; f < NFL; f++) {
      IU.uFlipT.value[f] = back ? 1e4 : T_DOWN + 0.03 * f;
      const night = L.street > 0.5, out = t > T_HOME + 2.5 && !back;      // offices dark once everyone has gone home
      const w = f === 13 ? 1 : out ? 0.06 : night && !back ? 0.3 : 1;
      IU.uWarm.value[f] = w; st.ceil[f].color.setRGB(1.6 * w, 1.45 * w, 1.2 * w);
    }
    IU.uLobby.value = t > T_HOME + 2.5 && !back ? 0.2 : 1; IU.uPent.value = 1;
    const sa = st.screens.aT0; st.screens.list.forEach((s, i) => { sa[i] = back ? 1e4 : T_DOWN + 0.03 * s.f + deskDelay(s.ci, s.ri) * 0.6; }); st.screens.im.geometry.attributes.aT0.needsUpdate = true;
    // ---- the supermarket: lit by day; posters; shelves selling out on day three
    IU.uStore.value[0] = IU.uStore.value[1] = IU.uStore.value[2] = 0.9;
    IU.uDayIn.value = L.day * 0.4;
    const posterAt = [T_CASHONLY, SAY.day2, T_SHELVES + 1.6];
    st.sale.forEach((p, i) => { const on = t >= posterAt[i] && (i === 2 || t < posterAt[i + 1]) && t < SAY.day7; p.visible = on; const u = clamp((t - posterAt[i]) / 0.18); p.scale.setScalar(u <= 0 ? 0.01 : 1 + 0.25 * Math.sin(Math.PI * u) * (1 - u)); });
    { const P = st.products, n = P.list.length, sold = t < T_SHELVES - 0.3 ? 0 : t < SAY.twist ? Math.floor(0.86 * n * smooth(T_SHELVES - 0.3, SAY.twist - 0.4, t)) : t < SAY.day7 ? Math.floor(0.86 * n) : 0;
      const M = new THREE.Matrix4(); let k = 0;
      for (let j = sold; j < n; j++) { const b = P.list[P.order[j]]; M.compose(V(b[3], b[4], b[5]), new THREE.Quaternion(), V(b[0], b[1], b[2])); P.im.setMatrixAt(k, M); P.im.setColorAt(k, P.colors[P.order[j]]); k++; }
      P.im.count = k; P.im.instanceMatrix.needsUpdate = true; P.im.instanceColor.needsUpdate = true; }
    // the card terminal, the billboard
    st.termScreen.material.map = t > T_DECLINE ? st.termTex.no : st.termTex.tap;
    st.bill.material.map = back ? st.billTex.back : t > SAY.day2 ? st.billTex.flights : t > T_DOWN + 0.3 ? st.billTex.offline : st.billTex.ad;
    // ---- the flats: morning sun, evening lamps
    for (let i = 0; i < 12; i++) IU.uApt.value[i] = L.street > 0.5 ? 0.85 : 0.35;
    // ---- people, phones (their screens dull while offline, bright when the week's messages land)
    st.ppl.screenMat.color.set(t > T_DOWN && !back ? '#8a9099' : '#dfeaff');
    st.ppl.update(t);
    st.veh.update(t);
    st.veh.lampU.k = 0.5 + 2.5 * L.street;
    // the close-up phone rides on phone instance 0 (the hero in the hook, the woman with the map at dusk)
    {
      const show = (t < SAY.day1 && t > -1) || (t > T_GPS - 0.2 && t < T_RADIO);
      st.hphone.visible = show && st.phoneMesh.count > 0;
      if (st.hphone.visible) {
        st.phoneMesh.getMatrixAt(0, st.hphone.matrix);
        st.hphone.matrix.multiply(new THREE.Matrix4().makeTranslation(0, 0.05, 0)).multiply(new THREE.Matrix4().makeScale(1.5, 1.5, 1.5));   // big enough to clear the blocky hand st.hphone.matrixWorldNeedsUpdate = true;
        const map = t > T_GPS - 0.2 ? st.phoneTex.map : t > T_DOWN ? st.phoneTex.off : st.phoneTex.loading;
        st.hscreen.material.map = map; st.spin.visible = map === st.phoneTex.loading; st.spin.rotation.z = -Math.floor(t * 12) * Math.PI / 6;
      }
    }
    // the radio: rings of sound, a warm little lamp
    { const on = t > SAY.twist - 0.3 && t < SAY.day5; st.radio.visible = on; st.radioLamp.intensity = on ? 2.5 : 0;
      st.rings.forEach((rg, i) => { const u = ((t - T_RADIO) * 0.8 + i / st.rings.length) % 1; const s = 0.3 + u * 2.6; rg.scale.set(s, s, s); rg.position.y = 0.3; rg.material.opacity = t > T_RADIO - 0.2 ? (1 - u) * 0.8 : 0; }); }
    // the satellite: a bright point crossing the evening sky, a cone of signal down to the lawn
    { const sp = satPos(t); st.sat.position.copy(sp); st.sat.visible = t > T_GPS && t < T_RADIO; st.sat.scale.setScalar(5 + 1.5 * Math.sin(t * 9));
      const on = smooth(T_SKY + 0.3, T_SKY + 0.9, t) * (1 - smooth(T_RADIO - 0.4, T_RADIO, t));
      st.beam.visible = on > 0.01; if (st.beam.visible) { const top = sp, bot = V(GPS_P.x, 1.1, GPS_P.z), d = top.clone().sub(bot); st.beam.position.copy(top); st.beam.scale.set(1, d.length(), 1); st.beam.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); st.beam.material.opacity = 0.16 * on; } }
    // notification badges: above every person and in every window, popping in a wave
    { const on = t > T_NOTIF; let n = 0;
      if (on) {
        const spots = [];
        for (const [room, dx, z] of FLAT_PPL) { const R = ROOMS[room]; spots.push(V(R.x + dx, R.y + 2.25, z)); }
        for (const [x, z] of LAWN_NIGHT) spots.push(V(x, 2.25, z));
        for (let i = 0; i < 12; i++) { const R = ROOMS[i]; spots.push(V(R.x + 1.8, R.y + 2.6, 29.5)); spots.push(V(R.x - 1.6, R.y + 1.4, 30)); }
        for (let f = 1; f <= 12; f += 1) spots.push(V(-12 + (f % 5) * 6, f * FH + 2.4, 8.4));
        spots.forEach((p, i) => { if (n >= st.badges.length) return; const t0 = T_NOTIF + 0.05 + hash(i, 1) * 1.6, u = clamp((t - t0) / 0.22); const b = st.badges[n++]; b.visible = u > 0 && b.position.distanceTo(c.pos) > 7; const s = (u < 1 ? 0.9 * Math.sin(u * Math.PI * 0.6) / 0.81 : 0.9 + 0.05 * Math.sin((t - t0) * 6 + i)) * (p.y > 10 ? 2.2 : 0.55); b.position.copy(p).add(V(0, 0.15 * Math.sin((t - t0) * 3 + i), 0)); b.scale.set(s, s, 1); });
      }
      for (let i = n; i < st.badges.length; i++) st.badges[i].visible = false; }
  },

  poseGlobe(t) {
    const st = this.st;
    st.globe.earth.rotation.y = globeRot(t);
    const rot = st.globe.earth.rotation.y, R = new THREE.Matrix4().makeRotationY(rot);
    const cutOn = t > T_CUT;
    st.cables.forEach((cb, i) => { cb.m.matrixAutoUpdate = false; cb.m.matrix.copy(R); cb.m.matrixWorldNeedsUpdate = true; cb.m.visible = !(i === CUT_I && cutOn);
      const hot = cutOn && REROUTE.includes(i) && i !== CUT_I; cb.m.material.color.setRGB(hot ? 1.8 : 0.35, hot ? 2.4 : 1.6, hot ? 1.2 : 2.2); });
    st.cutHalves.forEach((m, h) => { m.visible = cutOn; m.matrixAutoUpdate = false; m.matrix.copy(R); if (cutOn) { const u = smooth(T_CUT, T_CUT + 0.6, t); m.matrix.multiply(new THREE.Matrix4().makeTranslation(...cutMidLocal().multiplyScalar(0.03 * u * (h ? 1 : -1)).toArray())); } m.matrixWorldNeedsUpdate = true; });
    // packets: four per cable, flowing; after the cut, extra traffic runs round the detour
    const M = new THREE.Matrix4(), P = st.packets; let n = 0;
    st.cables.forEach((cb, i) => { if (i === CUT_I && cutOn) return; for (let q = 0; q < 4; q++) { const u = (((t - SAY.real) * 0.22 + q / 4 + hash(i, q) * 0.25) % 1 + 1) % 1; const p = cb.curve.getPointAt(u).applyMatrix4(R); M.makeTranslation(p.x, p.y, p.z); P.setMatrixAt(n++, M); } });
    if (cutOn) for (const i of REROUTE) { if (i === CUT_I) continue; for (let q = 0; q < 12 && n < st.packetCap; q++) { const u = (((t - T_CUT) * 0.45 + q / 12) % 1 + 1) % 1; const p = st.cables[i].curve.getPointAt(u).applyMatrix4(R); M.makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeScale(1.4, 1.4, 1.4)); P.setMatrixAt(n++, M); } }
    P.count = n; P.instanceMatrix.needsUpdate = true;
  },
};

// helpers used by labels (pure functions of t)
function satPos(t) { const u = (t - T_GPS) / (T_RADIO - T_GPS); return V(lerp(-25, 25, u), 150 + 10 * Math.sin(u * 3), lerp(150, 165, u)); }   // over the avenue, where the sky is open
function cutMidLocal() { const pts = CABLES[CUT_I] && arcPoints(CITIES[CABLES[CUT_I][0]], CITIES[CABLES[CUT_I][1]]); return pts[24].clone(); }
function globeRot(t) { return 0.35 + (t - SAY.real) * 0.03; }
function cutMid(t) { return cutMidLocal().applyAxisAngle(V(0, 1, 0), globeRot(t)); }
class RoundedPhone extends THREE.BoxGeometry { constructor() { super(0.08, 0.162, 0.015); } }

export const _debug = { SAY, T_DOWN, T_CUT, T_BACK, T_NOTIF, DURATION, CAPTIONS, SHOTS, camAt, daysAt };
