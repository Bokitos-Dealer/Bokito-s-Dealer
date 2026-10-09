// What if you could fold paper 103 times?
// One sheet of paper on a picnic blanket in a city park. Every fold doubles its thickness: by hand
// it jams at 7, then it keeps going on its own — past a mug, a person, a building, a skyscraper,
// the tallest tower, the planes, into space, past the Moon, the Sun, across the galaxy and beyond
// the observable universe. The stack is always folded the way paper really folds: one half turns
// over its hinge onto the other half.
import * as THREE from 'three';
import { Rng, clamp, lerp, smooth, easeInOut, easeOut } from '../engine/lib/rng.js';
import { makePaperMaterial, buildStack, bendPoint } from '../engine/lib/paper.js';
import { buildHand, handQuat, blendPose } from '../engine/lib/hands.js';
import { buildDaySky, buildTown, TOWN, makeCloudTexture, regionTexture, buildPlane } from '../engine/lib/town.js';
import { buildPeople } from '../engine/lib/people.js';
import { buildVehicles } from '../engine/lib/vehicles.js';
import { buildCosmos } from '../engine/lib/cosmos.js';
import VO from './paper-fold.vo.js';

// ------------------------------------------------------------------ facts
const T0 = 1e-4;                       // one sheet: 0.1 mm
const SHEET = { a: 0.21, b: 0.297 };   // A4, long side pointing at the person
const BASE_Y = 0.004;                  // top of the blanket
const thick = (n) => T0 * Math.pow(2, n);
const LY = 9.4607e15;

// ------------------------------------------------------------------ timeline (built from the narration)
// Every shot lasts as long as its voice-over line (plus a breath). Folds are placed so the landmark
// fold lands on the line's key word ("...as TALL as a coffee mug"), the counter races finish on
// "...reaches PAST the Moon", and the hit comes a beat after "...one hundred and three folds".
const wordT = (key, word, nth = 0) => {
  const ws = VO[key].words; let n = 0;
  for (const [w, s] of ws) if (w.toLowerCase().replace(/[^a-z0-9']/g, '').startsWith(word)) { if (n++ === nth) return s; }
  throw new Error(`word "${word}" not in line ${key}`);
};
const SHOTS = [], SAY = {}, EV = [], GROW = [];
let FAIL, HERE, FADE, END, DURATION;
{
  let t = 0;
  const shot = (id) => SHOTS.push([t, id]);
  const say = (key, at) => { SAY[key] = at; return at + VO[key].dur; };
  const word = (key, w, nth) => SAY[key] + wordT(key, w, nth);
  // the last of a run of flips lands at `land`; the rest are spread evenly before it
  const flips = (k0, k1, from, land, d) => {
    const n = k1 - k0 + 1, first = from, last = land - d;
    for (let i = 0; i < n; i++) EV.push({ k: k0 + i, t0: n > 1 ? lerp(first, last, i / (n - 1)) : last, d, kind: 'flip' });
  };
  // P1: the hook, the first fold by hand
  shot('P1'); let e = say('hook', t + 0.35);
  EV.push({ k: 1, t0: t + 1.0, d: 1.35, kind: 'hand', press: true });
  t = e + 0.3;
  // P2: twice as thick, every time — then counting the layers fold by fold
  shot('P2'); e = say('double', t + 0.2);
  const quick = (k, land) => EV.push({ k, t0: land - 0.45 * 0.8, d: 0.45, kind: 'hand' });
  quick(2, word('double', 'fold')); quick(3, word('double', 'twice'));
  let land = e + 0.35;
  for (const [k, key] of [[4, 'c16'], [5, 'c32'], [6, 'c64']]) { quick(k, land); e = say(key, land - 0.04); land = e + 0.14; }
  t = e + 0.4;
  // P3: by hand you get stuck at about seven
  shot('P3'); e = say('stuck', t + 0.25);
  const sevenAt = word('stuck', 'seven'), f7 = t + 0.3;
  EV.push({ k: 7, t0: f7, d: (sevenAt - f7) / 0.8, kind: 'hand', strain: true, press: true });
  const f7end = f7 + (sevenAt - f7) / 0.8;
  FAIL = { k: 8, t0: Math.max(f7end + 0.35, e - 0.4), d: 0.85 };
  t = Math.max(e + 0.3, FAIL.t0 + FAIL.d + 0.15);
  // P4: ...but what if you could keep going? It folds by itself, as tall as a mug at ten
  shot('P4'); e = say('keep', t + 0.15);
  EV.push({ k: 8, t0: t + 0.65, d: 0.48, kind: 'flip' }, { k: 9, t0: t + 1.23, d: 0.48, kind: 'flip' });
  e = say('mug', e + 0.3);
  EV.push({ k: 10, t0: word('mug', 'tall') - 0.48, d: 0.48, kind: 'flip' });
  t = e + 0.4;
  // P5..P10: one landmark per line, the last flip lands on the key word
  const landmark = (id, key, k0, k1, w, d) => { shot(id); const e2 = say(key, t + 0.15); flips(k0, k1, t + 0.2, word(key, w), d); t = Math.max(e2 + 0.35, word(key, w) + 0.45); };
  landmark('P5', 'you', 11, 14, 'tall', 0.45);
  landmark('P6', 'bldg', 15, 17, 'tall', 0.52);
  landmark('P7', 'tower', 18, 20, 'taller', 0.55);
  landmark('P8', 'tallest', 21, 23, 'taller', 0.6);
  landmark('P9', 'planes', 24, 27, 'higher', 0.5);
  landmark('P10', 'space', 28, 30, 'reaches', 0.55);
  // P11..P13: the counter races; it arrives as the line names the landmark
  const race = (id, key, from, to, w) => { shot(id); const e2 = say(key, t + 0.2); GROW.push({ from, to, t0: t + 0.25, t1: word(key, w) }); t = e2 + 0.4; };
  race('P11', 'moon', 30, 42, 'past');
  race('P12', 'sun', 42, 51, 'past');
  race('P13', 'galaxy', 51, 83, 'long');
  // P14: ...and at one hundred and three folds — HERE — longer than the observable universe
  shot('P14'); e = say('final1', t + 0.3);
  HERE = e + 0.45;
  GROW.push({ from: 83, to: 103, t0: t + 0.25, t1: HERE });
  e = say('final2', HERE + 0.6);
  FADE = [e + 0.9, e + 1.7]; END = FADE[1] + 0.2;
  say('outro', END + 0.7);
  DURATION = END + 5.2;
}
const shotAt = (t) => { let s = SHOTS[0]; for (const x of SHOTS) if (t >= x[0]) s = x; return s; };
const shotStart = (id) => SHOTS.find((s) => s[1] === id)[0];
const shotEnd = (id) => { const i = SHOTS.findIndex((s) => s[1] === id); return i + 1 < SHOTS.length ? SHOTS[i + 1][0] : END; };
EV.sort((x, y) => x.t0 - y.t0);

// captions: the spoken words in short groups, on screen exactly while they are said
function buildCaptions() {
  const out = [];
  for (const [key, at] of Object.entries(SAY)) {
    if (key === 'hook' || key === 'outro') continue;           // the title / end card already say it
    const ws = [];
    for (const [w, s, e] of VO[key].words) {
      if (ws.length && /^[-']/.test(w)) { const p = ws[ws.length - 1]; p[0] += w; p[2] = e; } else ws.push([w, s, e]);
    }
    // break after punctuation or every few words, but never right after a little word ("the", "as", "on"...)
    const LITTLE = /^(a|an|the|as|of|on|in|to|than|and|it's|its|our|at|by|be|your|you'll|is)$/i;
    let chunk = [];
    const flush = (end) => { if (!chunk.length) return; out.push([at + chunk[0][1], at + end, chunk.map((c) => c[0]).join(' ')]); chunk = []; };
    ws.forEach(([w, s, e], i) => {
      chunk.push([w, s, e]);
      const next = ws[i + 1];
      const full = chunk.length >= 4 && !LITTLE.test(w.replace(/[^A-Za-z']/g, ''));
      if (!next || full || chunk.length >= 6 || /[,.?!…]$/.test(w)) flush(next ? Math.min(next[1], e + 0.6) : e + 0.35);
    });
  }
  out.sort((x, y) => x[0] - y[0]);
  for (let i = 0; i < out.length - 1; i++) out[i][1] = Math.min(out[i][1], out[i + 1][0] - 0.01);
  return out;
}

const LAND = (e) => e.t0 + e.d * (e.kind === 'hand' ? 0.8 : 1.0);   // when a fold lands (the counter ticks)

// folds completed at time t (integer), and the smooth value used for lengths when racing
function foldsDone(t) {
  let n = 0;
  for (const e of EV) if (t >= LAND(e)) n = Math.max(n, e.k);
  for (const g of GROW) if (t >= g.t0) n = Math.max(n, Math.floor(g.from + (g.to - g.from) * clamp((t - g.t0) / (g.t1 - g.t0)) + 1e-6));
  return n;
}
function foldsSmooth(t) {
  for (const g of GROW) if (t >= g.t0 && t < g.t1 + 0.4) {
    const x = g.from + (g.to - g.from) * clamp((t - g.t0) / (g.t1 - g.t0));
    const i = Math.floor(x), f = x - i;
    return i + smooth(0, 1, f);
  }
  return foldsDone(t);
}

// the stack's height including the fold in progress (smooth: cameras and eyes follow this, not the counter)
function stackTopSmooth(t) {
  const e = EV.find((x) => t >= x.t0 && t < x.t0 + x.d);
  if (e && e.kind === 'flip') return BASE_Y + thick(e.k - 1 + easeInOut((t - e.t0) / e.d));
  return BASE_Y + thick(foldsSmooth(t));
}

// ------------------------------------------------------------------ text
const fmt = (n) => Math.round(n).toLocaleString('en-US');
function fmtLen(m) {
  if (m < 0.02) return (m * 1000).toFixed(1).replace(/\.0$/, '') + ' mm';
  if (m < 1) return (m * 100).toFixed(1).replace(/\.0$/, '') + ' cm';
  if (m < 10) return m.toFixed(2) + ' m';
  if (m < 1000) return fmt(m) + ' m';
  const km = m / 1000;
  if (km < 100) return km.toFixed(1) + ' km';
  if (km < 1e6) return fmt(km) + ' km';
  if (m < LY) {
    const big = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']].find(([v]) => km >= v);
    const v = km / big[0];
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : fmt(v)) + ' ' + big[1] + ' km';
  }
  const ly = m / LY;
  if (ly < 10) return ly.toFixed(1) + ' light-years';
  if (ly < 1e6) return fmt(ly) + ' light-years';
  const big = ly >= 1e9 ? [1e9, 'billion'] : [1e6, 'million'];
  const v = ly / big[0];
  return (v < 10 ? v.toFixed(1) : fmt(v)) + ' ' + big[1] + ' light-years';
}
const layers = (n) => (1n << BigInt(n)).toLocaleString('en-US');

// ------------------------------------------------------------------ the desk folds (true sizes)
// block after n folds: a (x size), b (z size), centre, thickness. Odd folds turn the near half
// (+z, toward the person) over onto the far half; even folds turn the right half (+x) over to the left.
// (the 8th fold, tried by hand and then done by itself, goes the same way as the 7th)
const zSplit = (k) => (k <= 7 ? k % 2 === 1 : k % 2 === 0);
const BLOCK = [{ a: SHEET.a, b: SHEET.b, cx: 0, cz: 0, T: T0 }];
for (let k = 1; k <= 10; k++) {
  const p = BLOCK[k - 1];
  BLOCK.push(zSplit(k) ? { a: p.a, b: p.b / 2, cx: p.cx, cz: p.cz - p.b / 4, T: p.T * 2 } : { a: p.a / 2, b: p.b, cx: p.cx - p.a / 4, cz: p.cz, T: p.T * 2 });
}
const STACK_X = BLOCK[10].cx, STACK_Z = BLOCK[10].cz;   // where the tower stands

// the two halves of fold k on the desk: hinge origin, yaw of the moving half, sizes
function deskFold(k) {
  const p = BLOCK[k - 1];
  if (zSplit(k)) return { O: new THREE.Vector3(p.cx, BASE_Y + p.T, p.cz), yaw: Math.PI / 2, L: p.b / 2, W: p.a, T: p.T };
  return { O: new THREE.Vector3(p.cx, BASE_Y + p.T, p.cz), yaw: 0, L: p.a / 2, W: p.b, T: p.T };
}
// theta and bend radius through a hand fold
function handFoldShape(e, p) {
  const F = deskFold(e.k);
  const rMin = 0.04 * F.T + 2e-5;
  const r0 = Math.min(Math.max(0.16 * F.L, 1.5 * F.T), 0.15 * F.L);
  let th;
  if (e.strain) {
    // lifts, stalls and trembles, then goes over with a push
    if (p < 0.1) th = 0;
    else if (p < 0.34) th = 0.3 * easeOut((p - 0.1) / 0.24);
    else if (p < 0.6) th = 0.3 + 0.022 * Math.sin((p - 0.34) * 95) * (1 - (p - 0.34) / 0.26);
    else if (p < 0.8) th = 0.3 + 0.7 * easeInOut((p - 0.6) / 0.2);      // gives way and snaps over
    else th = 1;
  } else th = p < 0.12 ? 0 : p < 0.8 ? easeInOut((p - 0.12) / 0.68) : 1;
  const r = lerp(r0, rMin, smooth(0.5, 0.8, p));
  return { theta: th * Math.PI, r };
}
function failShape(t) {
  const p = clamp((t - FAIL.t0) / FAIL.d);
  let th = 0;
  if (p < 0.3) th = 0.14 * easeOut(p / 0.3);
  else if (p < 0.72) th = 0.14 + 0.015 * Math.sin((p - 0.3) * 70) * (1 - (p - 0.3) / 0.42) - 0.02 * (p - 0.3);
  else th = 0.132 * Math.pow(1 - (p - 0.72) / 0.28, 2) * Math.cos((p - 0.72) * 22);
  const F = deskFold(FAIL.k);
  return { theta: Math.max(0, th) * Math.PI, r: Math.min(0.9 * F.T, 0.28 * F.L), p };
}

// ------------------------------------------------------------------ sound
// Recorded effects and music (Mixkit, fetched by audio/fetch_assets.py). The music's breakdown sits
// under the race through space and its hit (96.5 s into the track) lands on HERE.
const S_ = (file, t, o = {}) => Object.assign({ type: 'sample', file, t }, o);
function buildAudio() {
  const A = [];
  // the voice: on top of everything, never ducked
  for (const [key, at] of Object.entries(SAY)) A.push(S_(VO[key].file, at, { level: 1.35, free: true, verb: 0.035, fin: 0.005, fout: 0.03 }));
  // music and ambience dip under every line and come back up in the gaps
  const talking = (t) => {
    let k = 0;
    for (const [key, at] of Object.entries(SAY)) k = Math.max(k, smooth(at - 0.18, at, t) * (1 - smooth(at + VO[key].dur, at + VO[key].dur + 0.3, t)));
    return k;
  };
  const env = (base) => { const ks = []; for (let t = 0; t <= DURATION; t += 0.05) ks.push([+t.toFixed(2), base(t) * (1 - 0.68 * talking(t))]); return ks; };
  const cosmos = shotStart('P11');
  // "The Journey", entered mid-track so the hit after its breakdown (96.96 s in, after ~0.7 s of
  // near-silence) lands on HERE
  A.push(S_('music/79.mp3', 0, { offset: 96.96 - HERE, level: 0.42, fin: 0.15, fout: 1.5, dur: DURATION,
    keys: env((t) => t < shotStart('P4') ? 0.62 : t < shotStart('P9') ? 0.68 : t < cosmos ? 0.74 : t < HERE ? 0.95 : 1.15) }));
  // places
  A.push(S_('sfx/367.wav', 0, { offset: 12, dur: shotStart('P9'), level: 0.42, fout: 0.25, keys: env(() => 1) }));
  A.push(S_('sfx/1267.wav', shotStart('P9'), { offset: 3, dur: shotEnd('P9') - shotStart('P9') + 0.05, level: 0.55, fin: 0.08, fout: 0.15, keys: env(() => 1) }));
  A.push(S_('sfx/1579.wav', shotStart('P9') + 0.75, { align: 1.2, offset: 0, dur: 2.6, level: 0.36, fin: 0.05, fout: 0.4, pan: -0.2, keys: env(() => 1) }));
  A.push(S_('sfx/1177.wav', shotStart('P10'), { offset: 6, dur: shotEnd('P10') - shotStart('P10') + 0.05, level: 0.55, fin: 0.06, fout: 0.15, keys: env(() => 1) }));
  A.push(S_('sfx/653.mp3', shotStart('P10'), { offset: 12, dur: HERE - shotStart('P10'), level: 0.45, fin: 0.1, fout: 0.05,
    keys: env((t) => t < cosmos ? 0.6 : 1) }));
  // hand folds: lift, turn over, snap down, a slide along the crease
  const hand = EV.filter((e) => e.kind === 'hand');
  hand.forEach((e, i) => {
    const land = e.t0 + e.d * 0.8, lift = e.t0 + e.d * 0.15;
    if (e.k === 1) {
      A.push(S_('sfx/1105.wav', lift + 0.35, { align: 0.32, level: 1.4 }));
      A.push(S_('sfx/2384.wav', land, { align: 0.1, level: 1.4 }));
      A.push(S_('sfx/1530.wav', land + 0.08, { align: 0.14, level: 1.1 }));
    } else if (e.strain) {
      A.push(S_('sfx/2379.wav', e.t0 + 0.1, { offset: 0.4, dur: e.d * 0.75, level: 1.2, fin: 0.05, fout: 0.1 }));
      A.push(S_('sfx/2385.wav', land, { align: 0.56, offset: 0.3, dur: 0.6, level: 1.3, fout: 0.1 }));
      A.push(S_('sfx/1530.wav', land + 0.1, { align: 0.14, level: 1.0 }));
    } else {
      A.push(S_(i % 2 ? 'sfx/2380.wav' : 'sfx/1104.wav', land, { align: i % 2 ? 0.32 : 0.14, level: 1.4, pan: i % 2 ? 0.15 : -0.1 }));
      A.push(S_('sfx/2384.wav', land + 0.02, { align: 0.1, level: 0.8 }));
    }
  });
  // the 8th fold refuses: crinkle, strain, spring back
  A.push(S_('sfx/2385.wav', FAIL.t0 + 0.1, { offset: 0.35, dur: FAIL.d * 0.7, level: 1.3, fin: 0.05, fout: 0.15 }));
  A.push(S_('sfx/2384.wav', FAIL.t0 + FAIL.d * 0.78, { align: 0.1, level: 0.8 }));
  // "what if you could keep going?"
  A.push(S_('sfx/2350.wav', shotStart('P4') + 0.05, { align: 0.14, level: 0.42 }));
  // flips by itself: a whoosh that deepens with the scale, a thump on landing
  const flips = EV.filter((e) => e.kind === 'flip');
  for (const e of flips) {
    const land = e.t0 + e.d, sh = shotAt(e.t0 + 0.01)[1];
    const W = { P4: ['sfx/2605.wav', 0.24, 0.3], P5: ['sfx/1461.wav', 0.16, 0.4], P6: ['sfx/1489.wav', 0.7, 0.45], P7: ['sfx/2604.wav', 0.48, 0.4], P8: ['sfx/2604.wav', 0.48, 0.42], P9: ['sfx/2604.wav', 0.48, 0.36], P10: ['sfx/2625.wav', 0.46, 0.5] }[sh];
    const under = (t) => 1 - 0.68 * talking(t);   // effects step back while the voice speaks
    if (W) A.push(S_(W[0], e.t0 + e.d * 0.55, { align: W[1], level: W[2] * under(e.t0 + e.d * 0.55) }));
    if (sh === 'P4' || sh === 'P5') A.push(S_('sfx/1104.wav', land, { align: 0.12, level: sh === 'P4' ? 0.75 : 0.6 }));
    if (sh !== 'P4') A.push(S_('sfx/563.wav', land, { align: 0.15, level: ({ P5: 0.22, P6: 0.4, P7: 0.5, P8: 0.6, P9: 0.5, P10: 0.55 }[sh] ?? 0.4) * under(land), dur: 1.6, fout: 0.6 }));
  }
  // jumps in scale
  for (const id of ['P11', 'P12', 'P13', 'P14']) A.push(S_('sfx/1492.wav', shotStart(id), { align: 0.9, level: 0.5 }));
  // the counter racing: one tick per fold
  for (const g of GROW) for (let k = g.from + 1; k <= g.to; k++) {
    const t = g.t0 + (k - g.from) / (g.to - g.from) * (g.t1 - g.t0);
    A.push(S_(g.to - g.from > 25 ? 'sfx/1117.wav' : 'sfx/1124.wav', t, { align: 0.1, dur: g.to - g.from > 25 ? 0.07 : 0.15, level: 0.3 * (1 - 0.4 * talking(t)), fout: 0.03, pan: ((k % 3) - 1) * 0.15 }));
  }
  // build to HERE, a fifth of a second of silence, then the hit
  A.push(S_('sfx/632.wav', HERE - 0.25, { align: 25.9, offset: 21, dur: 4.9, level: 0.45, fout: 0.03, keys: env(() => 1) }));
  A.push({ type: 'duck', keys: [[0, 1], [HERE - 0.27, 1], [HERE - 0.22, 0.06], [HERE - 0.01, 0.06], [HERE + 0.02, 1], [46.5, 1]] });
  A.push(S_('sfx/788.mp3', HERE, { align: 2.1, offset: 2.02, fin: 0.01, level: 1.0, free: true }));
  A.push(S_('sfx/2918.wav', HERE, { align: 3.04, offset: 2.95, fin: 0.01, level: 0.6, free: true }));
  A.push({ type: 'chime', t: END, level: 0.35, free: true });
  return A;
}

// ------------------------------------------------------------------ cameras (pure functions of time)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function camAt(t) {
  const [s0, shot] = shotAt(t), s1 = shotEnd(shot), u = clamp((t - s0) / (s1 - s0)), e = easeInOut(u);
  const c = { pos: V(0, 1, 2), look: V(0, 0, 0), fov: 45, near: 0.01, far: 4000, handheld: 0.4, camScale: 1, roll: 0 };
  switch (shot) {
    case 'P1': c.pos.set(lerp(0.13, 0.11, e), lerp(0.43, 0.4, e), lerp(0.44, 0.4, e)); c.look.set(0.0, 0.0, -0.04); c.fov = 48; c.near = 0.01; c.far = 3000; c.camScale = 0.012; break;
    case 'P2': {
      const k = smooth(0, 1, u);
      c.pos.set(lerp(0.05, -0.04, k), lerp(0.42, 0.2, k), lerp(0.22, 0.06, k)); c.look.set(lerp(-0.02, -0.085, k), 0.0, lerp(-0.06, -0.125, k));
      c.fov = 44; c.near = 0.005; c.far = 3000; c.camScale = 0.008; break;
    }
    case 'P3': c.pos.set(lerp(-0.3, -0.285, e), lerp(0.075, 0.068, e), lerp(-0.19, -0.18, e)); c.look.set(-0.093, 0.014, -0.128); c.fov = 38; c.near = 0.004; c.far = 3000; c.camScale = 0.004; break;
    case 'P4': {
      const top = Math.min(stackTopSmooth(t), BASE_Y + thick(10));
      c.pos.set(lerp(0.12, 0.1, e), lerp(0.05, 0.075, e), lerp(0.1, 0.09, e)); c.look.set(STACK_X - 0.02, lerp(0.03, Math.max(0.05, top * 0.6), e), STACK_Z - 0.02);
      c.fov = 40; c.near = 0.004; c.far = 3000; c.camScale = 0.006; break;
    }
    case 'P5': c.pos.set(lerp(-0.55, -0.45, e), lerp(0.95, 1.0, e), lerp(4.7, 4.4, e)); c.look.set(0.3, lerp(0.85, 0.92, e), -0.05); c.fov = 38; c.near = 0.05; c.far = 6000; c.camScale = 0.4; break;
    case 'P6': c.pos.set(lerp(3.6, 3.2, e), lerp(1.6, 2.3, e), lerp(32, 30, e)); c.look.set(4.4, lerp(5.6, 6.8, e), -2); c.fov = 50; c.near = 0.1; c.far = 8000; c.camScale = 1; break;
    case 'P7': c.pos.set(lerp(-330, -318, e), lerp(36, 44, e), lerp(128, 122, e)); c.look.set(-20, lerp(48, 56, e), -38); c.fov = 44; c.near = 0.5; c.far = 12000; c.camScale = 2; break;
    case 'P8': c.pos.set(lerp(-1830, -1760, e), lerp(260, 320, e), lerp(850, 810, e)); c.look.set(-130, lerp(380, 430, e), -210); c.fov = 46; c.near = 2; c.far = 40000; c.camScale = 6; break;
    default: break;
  }
  return c;
}
// which way each shot's stack folds over (the swing stays across the frame)
// the half swings across the frame, toward the side with room: +1 = to the camera's right, -1 = left
const FLIP_SIDE = { P5: -1, P6: -1, P7: 1, P8: 1, P9: 1, P10: 1 };
function flipYaw(shot) {
  const c = camAt(shotStart(shot) + 1.2);
  const f = c.look.clone().sub(c.pos); f.y = 0; f.normalize();
  const right = V(-f.z, 0, f.x);
  const s = FLIP_SIDE[shot] ?? 1;
  return Math.atan2(right.z * s, right.x * s);
}

// ------------------------------------------------------------------ the scenario
export default {
  id: 'paper-fold',
  title: 'What if you could fold paper 103 times?',
  endFact: 'To really fold paper 42 times, you’d need a strip about <b>100,000 light-years</b> long.',
  duration: DURATION,
  titleIn: [-1, -0.5], titleOut: [SAY.hook + VO.hook.dur + 0.1, SAY.hook + VO.hook.dur + 0.5],
  fadeOut: FADE, endAt: END,
  captions: buildCaptions(),
  captionFade: 0.06,
  hud(t) {
    if (t >= FADE[1]) return null;
    const n = foldsDone(t);
    return {
      label: n === 0 ? 'NO FOLDS YET' : `${n} FOLD${n === 1 ? '' : 'S'}`,
      value: fmtLen(thick(n)),
      sub: n === 0 ? 'ONE SHEET OF PAPER' : `${layers(n)} LAYERS`,
      alpha: 1 - smooth(FADE[0], FADE[1], t),
    };
  },
  labels(t) {
    return this.cosmos ? this.cosmos.labels(t, shotAt(t)[1]) : [];
  },
  audio: buildAudio(),

  async setup(ctx) {
    const { scene, renderer } = ctx;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    ctx.grain = 0; ctx.vignette = 0.35;
    ctx.grade = { brightness: 1, contrast: 1.03, saturate: 1.04, sepia: 0 };
    const st = this.st = {};
    window.__st = st;

    // ---- light: one sun (fixed shadow box per shot, so shadows never crawl) + sky fill
    st.SUN = new THREE.Vector3(-0.5, 0.72, 0.48).normalize();   // from behind-left of most shots: faces toward camera are lit
    st.hemi = new THREE.HemisphereLight('#d6e6ff', '#8a8068', 1.25);
    st.sun = new THREE.DirectionalLight('#fff3e0', 2.6);
    st.sun.castShadow = true;
    st.sun.shadow.mapSize.set(4096, 4096);
    st.sun.shadow.bias = -0.0002; st.sun.shadow.normalBias = 0.02; st.sun.shadow.radius = 3;
    scene.add(st.hemi, st.sun, st.sun.target);
    // soft image-based fill (sky above, warm ground below), for gentle reflections on glass and paper
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0.0 ? mix(vec3(0.75,0.84,0.95), vec3(0.42,0.6,0.86), pow(h, 0.7)) : mix(vec3(0.7,0.74,0.76), vec3(0.42,0.44,0.34), pow(-h, 0.6)); gl_FragColor = vec4(c, 1.0); }' })));
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0).texture;
    scene.environmentIntensity = 0.6;

    st.sky = buildDaySky({ sun: st.SUN, zenith: '#3d7cd0', horizon: '#c4dcf0', ground: '#aeb8bb' });
    scene.add(st.sky.mesh);
    scene.fog = new THREE.Fog('#c4dcf0', 400, 9000);
    // clouds: a few soft billboards high up
    st.clouds = new THREE.Group();
    const ctex = [0, 1, 2, 3].map((k) => makeCloudTexture(40 + k));
    const cr = new Rng(12);
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex[i % 4], transparent: true, depthWrite: false, fog: false, opacity: 0.92 }));
      const ang = cr.float(-2.6, -0.6), dist = cr.float(3500, 9000);
      s.position.set(Math.cos(ang) * dist, cr.float(1100, 2200), Math.sin(ang) * dist);
      const sc = cr.float(1500, 2600); s.scale.set(sc, sc * 0.45, 1); s.renderOrder = -5;
      st.clouds.add(s);
    }
    scene.add(st.clouds);

    // ---- the park, the city and the picnic
    // keep the camera lines of the wide shots clear of buildings
    const clear = ['P7', 'P8'].map((id) => { const c = camAt(shotStart(id) + 1.3); return [c.pos.clone(), c.look.clone()]; });
    st.town = buildTown({ seed: 5, clear });
    scene.add(st.town.group);

    // ---- the paper
    st.paperMat = makePaperMaterial();
    st.stack = buildStack(st.paperMat, 2);
    scene.add(st.stack.group);

    // ---- hands (folding close-ups)
    st.handR = buildHand({ side: 'R', skin: '#e0ac85', sleeve: '#d9a23a' });
    st.handL = buildHand({ side: 'L', skin: '#e0ac85', sleeve: '#d9a23a' });
    scene.add(st.handR.group, st.handL.group);
    st.ELBOW_R = V(0.3, 0.2, 0.42); st.ELBOW_L = V(-0.32, 0.18, 0.4);

    // ---- people: the folder (standing up from P5 on) and a few others in the park
    st.ppl = buildPeople({ max: 12, seed: 9 });
    scene.add(st.ppl.group);
    const top = (t) => Math.min(stackTopSmooth(t), 40);
    st.me = st.ppl.add({
      x: 0.7, z: 0.1, h: Math.atan2(STACK_X - 0.7, STACK_Z - 0.1), scale: 0.95, skin: '#e0ac85', shirt: '#d9a23a', pants: '#2c3e50', hair: 'short', hairC: '#2e2018', longSleeve: true,
      poses: [[0, 'idle']], visible: (t) => t >= shotStart('P5'),
      extra: (t, po) => {
        const eye = 1.62 * 0.95, d = Math.hypot(STACK_X - 0.7, STACK_Z - 0.1);
        const up = Math.atan2(Math.min(top(t), 40) - eye, d + 0.6);
        po.head = clamp(-up * 0.75, -0.65, 0.3); po.torso = clamp(-up * 0.12, -0.12, 0.04);
      },
    });
    const others = [[6, 9, 'lookUp'], [7.2, 10.5, 'lookUp'], [-4.5, 12, 'point'], [11, 4, 'lookUp'], [-8, 16, 'phone']];
    for (const [x, z, pose] of others) st.ppl.add({ x, z, h: Math.atan2(-x, -z), poses: [[0, 'idle'], [shotStart('P6') + 0.3, pose, 0.6]], phone: pose === 'phone' ? () => true : null, noGlow: true, visible: (t) => t >= shotStart('P6') });

    // ---- a little traffic on the street behind the park
    st.veh = buildVehicles({ max: 24 });
    scene.add(st.veh.group);
    const zr = -45;
    for (let i = 0; i < 16; i++) {
      const dir = i % 2 ? 1 : -1, z = zr + (dir > 0 ? 4 : -4);
      st.veh.add({ path: dir > 0 ? [[-900, z], [900, z]] : [[900, z], [-900, z]], v: 11 + (i % 3), s0: i * 110, loop: true });
    }

    // ---- space and beyond (their own scenes)
    this.cosmos = st.cosmos = buildCosmos({
      thick, foldsSmooth, shotStart, shotEnd, HERE, SCALE: ctx.SCALE,
      foldAt: (t) => { const e = EV.find((x) => t >= x.t0 && t < x.t0 + x.d); return { n: foldsDone(t), act: e ? { k: e.k, p: (t - e.t0) / e.d } : null }; },
      sinceLanding: (t) => { let best = 9; for (const e of EV) if (t >= e.t0 + e.d) best = Math.min(best, t - (e.t0 + e.d)); return best; },
      flipYawFor: (shot, cam) => { const f = cam.getWorldDirection(new THREE.Vector3()); f.y = 0; f.normalize(); const s = FLIP_SIDE[shot] ?? 1; return Math.atan2(f.x * s, -f.z * s); },
    });
  },

  update(ctx, t) {
    const st = this.st, [s0, shot] = shotAt(t);
    const c = camAt(t);
    Object.assign(ctx.cam, { pos: c.pos, look: c.look, fov: c.fov, near: c.near, far: c.far, roll: c.roll });
    ctx.handheld = c.handheld; ctx.camScale = c.camScale;
    ctx.view = null;

    // cosmic shots draw their own scenes
    if (st.cosmos.has(shot)) {
      ctx.view = st.cosmos.update(t, shot);
      return;
    }

    // ---- sun shadow box around what this shot looks at
    const SB = { P1: [0, 0, -0.03, 0.34], P2: [-0.04, 0, -0.07, 0.3], P3: [-0.09, 0, -0.13, 0.16], P4: [STACK_X, 0, STACK_Z, 0.3],
      P5: [0.2, 0, 0, 3], P6: [5, 0, -3, 26], P7: [-20, 0, -38, 150], P8: [-150, 0, -220, 1300] }[shot] || [0, 0, 0, 50];
    const ctr = V(SB[0], SB[1], SB[2]), half = SB[3];
    st.sun.target.position.copy(ctr);
    st.sun.position.copy(ctr).addScaledVector(st.SUN, half * 4 + 2);
    const sc = st.sun.shadow.camera;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 0.01 * half; sc.far = half * 10 + 10;
    sc.updateProjectionMatrix();
    st.sun.shadow.bias = -0.00012; st.sun.shadow.normalBias = half * 0.0006;

    // ---- the paper
    st.stack.set(this.paperSlabs(t, shot, ctx));

    // ---- hands: only in the hand-folding close-ups
    const handsOn = ['P1', 'P2', 'P3'].includes(shot);
    if (handsOn) this.handsAt(t); else { st.handR.set({ visible: false }); st.handL.set({ visible: false }); }

    st.ppl.update(t);
    st.veh.update(t);
  },

  // ---------------------------------------------------------------- paper geometry for time t
  paperSlabs(t, shot, ctx) {
    // a fold in progress?
    const act = EV.find((e) => t >= e.t0 && t < e.t0 + e.d);
    const n = foldsDone(t);
    if (FAIL && t >= FAIL.t0 && t < FAIL.t0 + FAIL.d) {
      const F = deskFold(FAIL.k), s = failShape(t);
      return this.halves(F, s.theta, s.r, Math.pow(2, FAIL.k - 1));
    }
    if (act && act.k <= 10 && ['P1', 'P2', 'P3', 'P4'].includes(shot)) {
      const F = deskFold(act.k), p = (t - act.t0) / act.d;
      // folding by itself: the half turns over its hinge as one stiff block
      const s = act.kind === 'hand' ? handFoldShape(act, p) : { theta: Math.PI * easeInOut(p), r: 0 };
      return this.halves(F, s.theta, s.r, Math.pow(2, act.k - 1));
    }
    if (n <= 10 && !act && ['P1', 'P2', 'P3', 'P4'].includes(shot)) {
      const B = BLOCK[n];
      return [{ origin: V(B.cx - B.a / 2, BASE_Y + B.T, B.cz), yaw: 0, L: B.a, W: B.b, T: B.T, theta: 0, layers: Math.pow(2, n) }];
    }
    // the tower: drawn at least a few pixels wide so it never vanishes
    // (use this shot's camera, not last frame's: after a cut the old camera would be far off)
    const camPos = camAt(t).pos, k = act ? act.k : n;
    const H = thick(k);
    const mid = V(STACK_X, BASE_Y + H / 2, STACK_Z);
    const dist = Math.max(0.05, camPos.distanceTo(mid) - H * 0.25);
    const pxWorld = 2 * dist * Math.tan(THREE.MathUtils.degToRad(ctx.cam.fov / 2)) / 1920;
    const trueW = Math.sqrt(SHEET.a * SHEET.b / Math.pow(2, k));
    const wv = Math.max(trueW, pxWorld * (shot === 'P5' ? 30 : 22));
    const yaw = flipYaw(shot);
    const U = V(Math.cos(yaw), 0, Math.sin(yaw));
    if (act) {
      const p = (t - act.t0) / act.d, T = thick(act.k - 1);
      const F = { O: V(STACK_X, BASE_Y + T, STACK_Z), yaw, L: wv / 2, W: wv, T };
      return this.halves(F, Math.PI * easeInOut(p), 0, 1);
    }
    // just landed: widen back from half to full width
    const last = EV.filter((e) => e.k === n)[0];
    const since = last ? t - (last.t0 + last.d) : 1;
    const L = wv * lerp(0.5, 1, smooth(0, 0.18, since));
    const far = V(STACK_X, 0, STACK_Z).addScaledVector(U, -wv / 2);
    return [{ origin: V(far.x, BASE_Y + H, far.z), yaw, L, W: wv, T: H, theta: 0, layers: 1 }];
  },
  halves(F, theta, r, lay) {
    return [
      { origin: F.O.clone(), yaw: F.yaw + Math.PI, L: F.L, W: F.W, T: F.T, theta: 0, layers: lay },
      { origin: F.O.clone(), yaw: F.yaw, L: F.L, W: F.W, T: F.T, theta, r, layers: lay },
    ];
  },

  // ---------------------------------------------------------------- hands
  // world point of the moving half of fold k at (S along it, D into it, w across it)
  foldPoint(k, theta, r, S, D, w) {
    const F = deskFold(k);
    const b = bendPoint(S, D, theta, r);
    const U = V(Math.cos(F.yaw), 0, Math.sin(F.yaw)), Wd = V(-Math.sin(F.yaw), 0, Math.cos(F.yaw));
    const P = F.O.clone().addScaledVector(U, b.x).addScaledVector(V(0, 1, 0), b.y).addScaledVector(Wd, w);
    const tW = U.clone().multiplyScalar(b.tx).add(V(0, b.ty, 0)), nW = U.clone().multiplyScalar(b.nx).add(V(0, b.ny, 0));
    return { P, t: tW, n: nW, F };
  },
  // right hand on fold k at angle theta: pinch the free edge (lifting), then push the outside face over
  carryR(k, theta, r, tremble = 0) {
    const st = this.st, F = deskFold(k);
    const wP = (zSplit(k) ? -0.22 : 0.2) * F.W;
    const A = this.foldPoint(k, theta, r, F.L, F.T / 2, wP);
    const fA = A.t.clone().negate().addScaledVector(A.n, 0.55).normalize();
    const qA = handQuat(fA, new THREE.Vector3().crossVectors(A.n, fA));
    const poseA = 'pinch';
    st.handR.set({ pose: poseA, quat: qA, anchor: ['pinch', A.P], elbow: st.ELBOW_R });
    const posA = st.handR.root.position.clone();
    const B = this.foldPoint(k, theta, r, F.L * 0.62, F.T, wP);
    const fB = B.t.clone().addScaledVector(B.n, -0.25).normalize();
    const qB = handQuat(fB, B.n);
    st.handR.set({ pose: 'press', quat: qB, anchor: ['middle', B.P.clone().addScaledVector(B.n, 0.0095)], elbow: st.ELBOW_R });
    const posB = st.handR.root.position.clone();
    // blend the grip, but keep the contact point on the paper the whole time (the hand never lets go)
    const s = smooth(0.3 * Math.PI, 0.75 * Math.PI, theta);
    const quat = qA.clone().slerp(qB, s), pose = blendPose('pinch', 'press', s);
    st.handR.set({ pose, quat, pos: V(0, 0, 0), elbow: st.ELBOW_R });
    const lp = st.handR.local('pinch').lerp(st.handR.local('middle'), s).applyQuaternion(quat);
    const target = A.P.clone().lerp(B.P.clone().addScaledVector(B.n, 0.0095), s);
    const pos = target.sub(lp);
    if (tremble) pos.add(V(Math.sin(tremble * 61) * 0.0012, Math.sin(tremble * 47) * 0.0009, Math.cos(tremble * 53) * 0.0012));
    return { pos, quat, pose };
  },
  // palm flat on the folded block, at fraction a along the crease
  pressR(k, a) {
    const st = this.st, B = BLOCK[k], top = BASE_Y + B.T;
    let P, f;
    if (zSplit(k)) { P = V(B.cx + lerp(-0.35, 0.35, a) * B.a, top + 0.0135, B.cz + B.b / 2 - Math.min(0.04, B.b * 0.35)); f = V(-0.25, -0.1, -1); }
    else { P = V(B.cx + B.a / 2 - Math.min(0.04, B.a * 0.35), top + 0.0135, B.cz + lerp(0.35, -0.35, a) * B.b); f = V(-1, -0.1, -0.25); }
    const q = handQuat(f.normalize(), V(0, 1, 0));
    st.handR.set({ pose: 'press', quat: q, anchor: ['middle', P.clone().add(V(0, -0.0135 + 0.009, 0))], elbow: st.ELBOW_R });
    return { pos: st.handR.root.position.clone(), quat: q, pose: blendPose('press', 'press', 0) };
  },
  restR(t) {
    const q = handQuat(V(-0.35, -0.5, -1).normalize(), V(0.3, 1, -0.2));
    return { pos: V(0.12 + 0.004 * Math.sin(t * 1.3), 0.09 + 0.003 * Math.sin(t * 1.7), 0.16), quat: q, pose: blendPose('relax', 'relax', 0) };
  },
  handsAt(t) {
    const st = this.st;
    // ---- right hand: a sequence of poses joined by short arcs
    const hand = this.rightHandAt(t);
    st.handR.set({ pose: hand.pose, quat: hand.quat, pos: hand.pos, elbow: st.ELBOW_R });
    // ---- left hand: steadies the blanket beside the paper; in the close-up its fingertips hold the block
    const B = BLOCK[Math.min(foldsDone(t), 7)];
    let L;
    if (t >= shotStart('P3')) { st.handL.set({ visible: false }); return; }   // the side close-up shows only the folding hand
    if (t < shotStart('P3')) {
      L = { pos: V(-0.2, 0.026, 0.02), quat: handQuat(V(0.55, -0.12, -0.8).normalize(), V(0.05, 1, 0)), pose: 'flat' };
    } else {
      // index fingertip on the far-left corner of the block, lifted away while the 7th fold lands
      const off = smooth(5.45 + 1.15 * 0.6, 5.45 + 1.15 * 0.72, t) * (1 - smooth(6.6, 6.85, t));
      const tip = V(B.cx - B.a * 0.3, BASE_Y + B.T + 0.0095 + 0.03 * off, B.cz - B.b * 0.25 - 0.012 * off);
      const q = handQuat(V(0.5, -0.55, -0.45).normalize(), V(0.2, 0.8, -0.4));
      st.handL.set({ pose: 'point', quat: q, anchor: ['index', tip], elbow: st.ELBOW_L });
      L = { pos: st.handL.root.position.clone(), quat: q, pose: 'point' };
    }
    st.handL.set({ pose: L.pose, quat: L.quat, pos: L.pos, elbow: st.ELBOW_L });
  },
  rightHandAt(t) {
    // build the list of (time, transform) anchors and blend between neighbours
    const segs = this._segs || (this._segs = this.buildRightSegments());
    for (const s of segs) if (t >= s.t0 && t < s.t1) return s.at(t);
    return this.restR(t);
  },
  buildRightSegments() {
    const segs = [];
    const blendSeg = (t0, t1, from, to, lift) => segs.push({ t0, t1, at: (t) => {
      const s = smooth(t0, t1, t), A = from(t), B = to(t);
      const pos = A.pos.clone().lerp(B.pos, s); pos.y += Math.sin(Math.PI * s) * lift;
      return { pos, quat: A.quat.clone().slerp(B.quat, s), pose: blendPose(A.pose, B.pose, s) };
    } });
    const handEvents = EV.filter((e) => e.kind === 'hand');
    let prevEnd = (t) => this.restR(t), prevT = 0;
    for (const e of handEvents) {
      const reach0 = e.t0, reach1 = e.t0 + e.d * 0.12, carry1 = e.t0 + e.d * 0.8;
      const start = (t) => this.carryR(e.k, 0, handFoldShape(e, 0).r);
      // approach from wherever the hand was
      blendSeg(Math.min(prevT, reach0 - 0.15), reach1, prevEnd, start, 0.025);
      segs.push({ t0: reach1, t1: carry1, at: (t) => { const p = (t - e.t0) / e.d, s = handFoldShape(e, p); return this.carryR(e.k, s.theta, s.r, e.strain ? t : 0); } });
      const landed = (t) => this.carryR(e.k, Math.PI, handFoldShape(e, 1).r);
      if (e.press) {
        const p0 = carry1 + 0.2, p1 = e.t0 + e.d + 0.3;
        blendSeg(carry1, p0, landed, (t) => this.pressR(e.k, 0), 0.012);
        segs.push({ t0: p0, t1: p1, at: (t) => this.pressR(e.k, smooth(p0, p1, t)) });
        prevEnd = (t) => this.pressR(e.k, 1); prevT = p1;
      } else { prevEnd = landed; prevT = carry1; }
    }
    // the failed 8th fold: pinch, lift a little, tremble, let go
    const F0 = FAIL.t0, F1 = FAIL.t0 + FAIL.d;
    const failAt = (t) => { const s = failShape(t); return this.carryR(FAIL.k, s.theta, s.r, t); };
    blendSeg(Math.min(prevT, F0 - 0.15), F0 + 0.08, prevEnd, (t) => failAt(F0), 0.02);
    segs.push({ t0: F0 + 0.05, t1: F0 + FAIL.d * 0.8, at: failAt });
    blendSeg(F0 + FAIL.d * 0.8, F1 + 0.9, (t) => failAt(F0 + FAIL.d * 0.8), (t) => this.restR(t), 0.03);
    segs.sort((a, b) => a.t0 - b.t0);
    // make sure segments do not overlap: later ones win from their start
    for (let i = 0; i < segs.length - 1; i++) segs[i].t1 = Math.min(segs[i].t1, segs[i + 1].t0);
    return segs;
  },
};
