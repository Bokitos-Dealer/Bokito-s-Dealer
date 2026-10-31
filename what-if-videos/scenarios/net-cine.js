// What if the internet went down for a week? — cinematic remake in the style of the reference the channel picked:
// dark navy worlds lit by warm gold, one continuous camera that never hard-cuts (it flies into the light and out the
// other side), fast present-tense narration, small sentence-case subtitles, a glowing headline, big glowing numbers,
// a running clock in the corner and small labels pinned to the scene.
// Facts: ITU 2024 (5.5 billion people online); 19 July 2024 CrowdStrike outage (~5,000 flights cancelled that day,
// Cirium); NetBlocks/COST estimate of a global shutdown (~$43 billion a day); GPS satellites orbit at ~20,200 km;
// TeleGeography (500+ submarine cable systems; traffic reroutes round a cut).
import * as THREE from 'three';
import VO from './net-cine.vo.js';
import * as K from './cine-kit.js';
import * as X from './explainer.js';
import { clamp, lerp, smooth, easeInOut, easeOut } from '../engine/lib/rng.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ORDER = ['hook', 'intro', 'h0', 'h2', 'h6', 'd2', 'd4', 'cost', 'twist', 'd7', 'cta'];
const GAP = { hook: 0.05 };
for (const k of ORDER) GAP[k] ??= 0.1;
const { SAY, W, FADE, DURATION } = X.timeline(VO, ORDER, GAP);

const NUMS = [['five and a half billion', '5.5 billion'], ['5.5 billion', '5.5 billion'], ['seven days', '7 days'], ['hour zero', 'Hour 0'], ['hour two', 'Hour 2'], ['hour six', 'Hour 6'],
  ['2024', '2024'], ['five thousand flights', '5,000 flights'], ['5,000 flights', '5,000 flights'], ['day two', 'Day 2'], ['day four', 'Day 4'], ['twenty thousand kilometers', '20,000 km'],
  ['20,000 kilometers', '20,000 km'], ['forty three billion dollars', '$43 billion'], ['$43 billion', '$43 billion'], ['five hundred cables', '500 cables'], ['500 cables', '500 cables'], ['day seven', 'Day 7']];
const KEYWORDS = /^(online|cut|wifi|internet|everywhere|bars|nothing|spin|declined|cash|king|airports|cancelled|flights|shelves|empty|gps|satellites|offline|impossible|cables|ocean|breaks|road|lights)$/i;

// ------------------------------------------------------------------ the shots, each its own little world
const T_CUT = W('hook', 'cut'), T_SEVEN = W('intro', 'seven'), T_LETS = W('intro', 'lets');
const SHOTS = [
  ['earth', 0], ['router', W('intro', 'not') - 0.05], ['earthDark', W('intro', 'the') - 0.05],
  ['phone', SAY.h0 - 0.1], ['terminal', SAY.h2 - 0.1], ['cash', W('h2', 'cash') - 0.05], ['airport', SAY.h6 - 0.1], ['aisle', SAY.d2 - 0.1],
  ['sat', SAY.d4 - 0.1], ['digits', SAY.cost - 0.1], ['sea', SAY.twist - 0.1], ['city', SAY.d7 - 0.1], ['earthBack', W('d7', 'every') - 0.05], ['phoneEnd', SAY.cta - 0.1],
];
const shotAt = (t) => { let i = 0; for (let j = 0; j < SHOTS.length; j++) if (t >= SHOTS[j][1]) i = j; return i; };

// ------------------------------------------------------------------ text on screen (reference look)
const HEAD = [[0, T_CUT + 0.9, 'THE INTERNET JUST DIED', 'for 5.5 billion people, for 7 days'], [SAY.cta, 1e9, 'COULD YOU LAST', '7 DAYS OFFLINE?']];
const CALL = [
  [W('hook', 'five'), T_CUT - 0.1, 5.5, (v) => v.toFixed(1), 'billion', 'people online right now'],
  [T_SEVEN, T_LETS - 0.05, 7, (v) => Math.round(v), 'days', 'no internet anywhere'],
  [W('h6', 'five'), SAY.d2 - 0.15, 5000, (v) => Math.round(v).toLocaleString('en-US'), 'flights', 'cancelled in one day · July 2024'],
  [W('cost', 'forty'), SAY.twist - 0.15, 43, (v) => '$' + Math.round(v), 'billion', '(€40B) lost every single day'],
  [W('twist', 'more'), W('twist', 'and', 1) - 0.1, 500, (v) => Math.round(v) + '+', 'cables', 'on the ocean floor'],
];
const LABELS = [
  [W('intro', 'not'), W('intro', 'the') - 0.1, 'Your router', 'status: offline'],
  [SAY.h0 + 0.2, SAY.h2 - 0.2, 'Your phone', 'signal: full · internet: none'],
  [SAY.h2 + 0.2, W('h2', 'cash') - 0.15, 'Card payment', 'can\'t reach the bank'],
  [SAY.d2 + 0.3, SAY.d4 - 0.2, 'Supermarket', 'orders placed online'],
  [W('d4', 'satellites') - 0.2, SAY.cost - 0.2, 'GPS satellite', 'altitude 20,200 km'],
  [SAY.twist + 0.3, W('twist', 'more') - 0.1, 'Atlantic Ocean', 'depth 4,000 m'],
  [W('twist', 'breaks'), SAY.d7 - 0.2, 'Cable cut', 'traffic rerouting…'],
];
// the clock in the corner: [t, hours since it died]
const CLOCK = [[T_LETS, 0], [SAY.h0, 0], [SAY.h2 - 0.1, 0], [SAY.h2 + 0.6, 2], [SAY.h6 - 0.1, 2], [SAY.h6 + 0.6, 6], [SAY.d2 - 0.1, 6], [SAY.d2 + 0.6, 24], [SAY.d4 - 0.1, 30], [SAY.d4 + 0.6, 72], [SAY.twist, 100], [SAY.d7 - 0.1, 140], [SAY.d7 + 0.6, 144]];
const clockAt = X.keyed(CLOCK);

const CSS = `
@font-face { font-family: 'BarlowC'; font-weight: 700; src: url(/node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2) format('woff2'); }
@font-face { font-family: 'BarlowC'; font-weight: 800; src: url(/node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-800-normal.woff2) format('woff2'); }
@font-face { font-family: 'BarlowC'; font-weight: 600; src: url(/node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2) format('woff2'); }
#title, #hud, #goal, #labels, #end { display: none !important; }
#caption { top: 1360px; left: 40px; right: 40px; }
#caption::before { display: none; }
#caption span { font-family: 'BarlowC', sans-serif; font-style: normal; font-weight: 700; font-size: 60px; line-height: 1.1; letter-spacing: 0.2px; color: #fff;
  text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 18px rgba(0,0,0,0.6); }
#caption .cw, #caption .cw.hl { font-style: normal; } #caption .cw { color: #fff; } #caption .cw.hl { color: #ffc23d; }
#cine { position: absolute; inset: 0; pointer-events: none; font-family: 'BarlowC', sans-serif; color: #fff; }
#cine .head { position: absolute; left: 60px; right: 60px; top: 300px; text-align: center; }
#cine .h1 { font-weight: 800; font-size: 132px; line-height: 0.98; color: #ffc23d; letter-spacing: 1px; text-shadow: 0 0 30px rgba(255,170,40,0.75), 0 0 80px rgba(255,140,20,0.35), 0 4px 6px rgba(0,0,0,0.6); }
#cine .h2 { font-weight: 700; font-size: 62px; margin-top: 22px; color: #f4f7ff; text-shadow: 0 0 22px rgba(160,200,255,0.65), 0 3px 5px rgba(0,0,0,0.7); }
#cine .call { position: absolute; left: 0; right: 0; top: 420px; text-align: center; }
#cine .num { font-weight: 800; font-size: 200px; line-height: 1; color: #ffc23d; text-shadow: 0 0 34px rgba(255,170,40,0.8), 0 0 90px rgba(255,140,20,0.4); font-variant-numeric: tabular-nums; }
#cine .unit { font-weight: 700; font-size: 72px; margin-left: 14px; color: #ffc23d; text-shadow: 0 0 24px rgba(255,170,40,0.6); }
#cine .csub { font-weight: 700; font-size: 52px; margin-top: 8px; color: #f4f7ff; text-shadow: 0 2px 4px rgba(0,0,0,0.8), 0 0 16px rgba(0,0,0,0.5); }
#cine .clock { position: absolute; right: 70px; top: 230px; text-align: right; }
#cine .cv { font-weight: 800; font-size: 120px; line-height: 1; color: #6fd0ff; text-shadow: 0 0 28px rgba(80,180,255,0.85), 0 0 70px rgba(60,140,255,0.4); font-variant-numeric: tabular-nums; }
#cine .cu { font-weight: 700; font-size: 44px; color: #6fd0ff; margin-left: 8px; }
#cine .lab { position: absolute; left: 80px; top: 1180px; }
#cine .l1 { font-weight: 700; font-size: 62px; color: #f4f7ff; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }
#cine .l2 { font-weight: 600; font-size: 44px; color: #7fb8ff; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }`;

// ------------------------------------------------------------------ build and drive the worlds
const S = {};
const ease = (a, b, t) => easeInOut(clamp((t - a) / (b - a)));
async function build(ctx) {
  const mk = (bg, fog) => { const s = new THREE.Scene(); s.background = new THREE.Color(bg); if (fog) s.fog = fog; return s; };
  // space with the Earth (shared by the hook, the dark planet and the comeback)
  S.space = mk('#01030a'); S.earth = await K.buildNightEarth({ R: 100 }); S.space.add(S.earth.group, K.stars(2500, 3000, 4, 1.8));
  S.earth.group.rotation.set(0.32, -1.25, 0);
  // the satellite gets its own copy of the planet far below
  S.satSc = mk('#01030a'); S.earth2 = await K.buildNightEarth({ R: 100, arcs: false }); S.satSc.add(S.earth2.group, K.stars(2000, 3000, 9, 1.6));
  S.earth2.group.position.set(0, -150, -40); S.earth2.group.rotation.set(0.5, -1.1, 0);
  S.sat = K.buildSatellite(); S.sat.group.scale.setScalar(1.3); S.satSc.add(S.sat.group);
  S.satSun = new THREE.DirectionalLight('#ffe2b0', 3); S.satSun.position.set(-30, 20, 30); S.satSc.add(S.satSun, new THREE.AmbientLight('#203060', 0.8));
  const beamM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(1.4), transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  S.beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 70, 32, 1, true), beamM); S.beam.position.set(0, -35.5, 0); S.beam.rotation.x = 0; S.satSc.add(S.beam);
  // the tabletop: router, phone, terminal, cash share one desk (cm)
  S.desk = mk('#04060e', new THREE.Fog('#04060e', 90, 260)); const d = K.buildDesk(5); S.deskKey = d.key; S.desk.add(d.group, K.bokeh(14, 3, { x: [-120, 120], y: [10, 90], z: [-260, -150], size: [30, 70], op: 0.28 }));
  S.router = K.buildRouter(); S.router.group.position.set(-70, 0, 0); S.desk.add(S.router.group);
  S.phone = K.buildPhone(); S.phone.group.position.set(0, 0.41, 0); S.phone.group.rotation.y = 0.18; S.desk.add(S.phone.group);
  S.term = K.buildTerminal(); S.term.group.position.set(70, 0, 0); S.desk.add(S.term.group);
  S.cash = K.buildCash(30); S.cash.group.position.set(140, 0, 0); S.desk.add(S.cash.group);
  // the airport (m)
  S.airSc = mk('#03050c', new THREE.Fog('#03050c', 16, 70)); S.air = K.buildAirport(); S.airSc.add(S.air.group);
  // the supermarket (m)
  S.aisleSc = mk('#0e1018', new THREE.Fog('#0e1018', 8, 34)); S.aisle = K.buildAisle(2); S.aisleSc.add(S.aisle.group);
  // the field of money digits (m)
  S.digSc = mk('#020101', new THREE.Fog('#020101', 30, 150)); S.dig = K.buildDigitField(4); S.digSc.add(S.dig.group);
  // the ocean floor (m)
  S.seaSc = mk('#020716', new THREE.FogExp2('#04102c', 0.016)); S.sea = K.buildSeafloor(11); S.seaSc.add(S.sea.group);
  S.seaLamp = new THREE.PointLight('#8fb0ff', 400, 60, 1.6); S.seaSc.add(S.seaLamp);
  for (let i = 0; i < 260; i++) { const p = K.glow('#8fb0ff', 0.25 + Math.random() * 0.3, 0.6); p.position.set(Math.random() * 60 - 30, Math.random() * 12, 40 - Math.random() * 120); S.seaSc.add(p); }
  // the city (m)
  S.citySc = mk('#03050e', new THREE.Fog('#050a1c', 200, 700)); S.city = K.buildCity(6); S.citySc.add(S.city.group, K.stars(1500, 2500, 12, 1.5));
}

// the camera for each shot as a function of local time u (seconds since the shot started) and absolute t
const CAM = {
  earth: (u) => ({ scene: S.space, pos: V(lerp(-20, 10, u / 6), lerp(40, 26, u / 6), lerp(360, 270, ease(0, 7, u))), look: V(0, 8, 0), fov: 38 }),
  earthDark: (u) => ({ scene: S.space, pos: V(lerp(140, 80, ease(0, 5, u)), lerp(60, 35, u / 5), lerp(250, 205, ease(0, 5, u))), look: V(0, 0, 0), fov: 40 }),
  earthBack: (u) => ({ scene: S.space, pos: V(lerp(-60, -20, u / 4), 30, lerp(300, 245, ease(0, 4, u))), look: V(0, 4, 0), fov: 40 }),
  router: (u) => ({ scene: S.desk, pos: V(-70 + lerp(-16, 8, u / 2.5), lerp(44, 36, u / 2.5), lerp(82, 66, ease(0, 2.5, u))), look: V(-70, 6, 0), fov: 32 }),
  phone: (u) => ({ scene: S.desk, pos: V(lerp(-6, 2, u / 5), lerp(40, 30, ease(0, 5, u)), lerp(22, 15, ease(0, 5, u))), look: V(0, 0, -0.8), fov: 30 }),
  phoneEnd: (u) => ({ scene: S.desk, pos: V(lerp(5, 0, u / 4), lerp(36, 30, ease(0, 4, u)), lerp(18, 13, ease(0, 4, u))), look: V(0, 0, -5), fov: 32 }),
  terminal: (u) => ({ scene: S.desk, pos: V(70 + lerp(22, 14, u / 3), lerp(26, 20, u / 3), lerp(30, 24, ease(0, 3, u))), look: V(70, 3, -3), fov: 32 }),
  cash: (u) => ({ scene: S.desk, pos: V(140 + lerp(-10, 6, u / 3), lerp(92, 82, u / 3), lerp(60, 52, u / 3)), look: V(140, 0, -8), fov: 40 }),
  airport: (u) => ({ scene: S.airSc, pos: V(lerp(-4, 3, ease(0, 6, u)), lerp(2.2, 2.8, u / 6), lerp(21, 17.5, u / 6)), look: V(lerp(-0.4, 0.4, u / 6), 4.8, 0), fov: 46 }),
  aisle: (u) => ({ scene: S.aisleSc, pos: V(0.15 * Math.sin(u * 0.6), 1.55, lerp(4.5, -6, ease(0, 6, u))), look: V(0, 1.25, -30), fov: 55 }),
  sat: (u) => ({ scene: S.satSc, pos: V(lerp(-26, -18, u / 5), lerp(8, 5, u / 5), lerp(40, 32, ease(0, 5, u))), look: V(0, -8, -6), fov: 46 }),
  digits: (u) => ({ scene: S.digSc, pos: V(0, lerp(9, 6, u / 4), lerp(60, 30, u / 4)), look: V(0, -2, -60), fov: 50 }),
  sea: (u) => ({ scene: S.seaSc, pos: V(lerp(7, 5, u / 10), lerp(3.4, 4.2, u / 10), 34 - u * 3.2), look: V(-1, 0.4, -60), fov: 46 }),
  city: (u) => ({ scene: S.citySc, pos: V(lerp(-20, 10, u / 5), lerp(90, 72, u / 5), lerp(70, 40, ease(0, 5, u))), look: V(0, 20, -180), fov: 50 }),
};

function update(ctx, t) {
  const i = shotAt(t), [key, t0] = SHOTS[i], u = t - t0, next = SHOTS[i + 1]?.[1] ?? 1e9;
  const c = CAM[key](u);
  // fly into the light at the end of a shot and out of it at the start of the next: never a hard cut
  const out = clamp((t - (next - 0.22)) / 0.22), inn = 1 - clamp(u / 0.26);
  const pos = c.pos.clone().lerp(c.look, 0.45 * Math.pow(out, 2.2));
  const back = c.pos.clone().sub(c.look).multiplyScalar(0.25 * inn * inn); pos.add(back);
  ctx.cam.pos.copy(pos); ctx.cam.look.copy(c.look); ctx.cam.fov = c.fov * (1 + 0.12 * out); ctx.cam.near = key.startsWith('earth') || key === 'sat' ? 1 : key === 'city' ? 1 : 0.05; ctx.cam.far = 8000;
  ctx.flash = Math.max(Math.pow(out, 3) * 0.45, Math.pow(inn, 3) * 0.45); ctx.flashColor = '#fff1d6';
  ctx.view = { scene: c.scene, camera: ctx.camera };
  ctx.bloom = { strength: key === 'aisle' ? 0.45 : 1.05, radius: 0.75, threshold: key === 'aisle' ? 0.9 : 0.62 };
  // ---- the worlds
  if (key.startsWith('earth')) {
    const sweep = key === 'earth' ? 1 - ease(T_CUT, T_CUT + 1.1, t) : key === 'earthDark' ? 0 : ease(t0, t0 + 1.4, t);
    S.earth.update(t, { on: 0, sweep, arcs: key === 'earth' ? 1 - smooth(T_CUT, T_CUT + 0.5, t) : key === 'earthDark' ? 0 : smooth(t0 + 0.3, t0 + 1.4, t) });
    S.earth.group.rotation.y = -1.25 + t * 0.012;
  }
  const PX = { router: -70, phone: 0, phoneEnd: 0, terminal: 70, cash: 140 }[key];
  if (PX !== undefined) { S.deskKey.position.set(PX - 30, 80, 30); S.deskKey.target.position.set(PX, 0, -4); S.deskKey.target.updateMatrixWorld(); }
  if (key === 'router') S.router.update(t, u > 0.35 ? 1 : 0);
  if (key === 'phone' || key === 'phoneEnd') {
    const tm = W('h0', 'nothing');
    S.phone.scr.redraw((cc, w, h) => {
      if (key === 'phoneEnd') K.drawLock(cc, w, h, { time: '9:41', notifs: Math.min(7, Math.floor(u * 4) + 3) });
      else if (t < tm) K.drawLock(cc, w, h, { time: '9:41' });
      else K.drawMessages(cc, w, h, t);
    });
    S.phone.screenGlow.intensity = 60;
  }
  if (key === 'terminal') S.term.update(t, { state: t > W('h2', 'declined') ? 'declined' : 'tap', cardK: ease(t0, W('h2', 'declined') - 0.1, t) });
  if (key === 'cash') S.cash.update(t, u);
  if (key === 'airport') S.air.update(t, clamp((t - W('h6', 'cancel') + 0.2) / 1.6));
  if (key === 'aisle') S.aisle.update(t, ease(W('d2', 'shelves') - 0.6, SAY.d4 - 0.3, t) * 0.95);
  if (key === 'sat') { S.sat.group.rotation.set(0.35, 0.5 + u * 0.06, 0.15); S.beam.material.opacity = 0.07 * smooth(W('d4', 'still'), W('d4', 'still') + 0.6, t) * (0.8 + 0.2 * Math.sin(t * 6)); S.earth2.update(t, { on: 0, sweep: 0.12, arcs: 0 }); S.sat.beacon.material.opacity = 0.5 + 0.5 * Math.sin(t * 8); }
  if (key === 'digits') { S.dig.tex.offset.y = -u * 0.05; }
  if (key === 'sea') S.seaLamp.position.set(ctx.cam.pos.x - 2, ctx.cam.pos.y + 4, ctx.cam.pos.z - 8);
  if (key === 'sea') S.sea.update(t, { cut: Math.max(0, t - W('twist', 'breaks')), reroute: smooth(W('twist', 'data'), W('twist', 'data') + 0.8, t) });
  if (key === 'city') S.city.update(t, ease(W('d7', 'connection'), W('d7', 'connection') + 1.6, t));
  overlay(t);
}

let OV = null;
function overlay(t) {
  const h = HEAD.find(([a, b]) => t >= a && t < b + 0.4), hd = OV.head;
  if (h) { hd.style.opacity = (smooth(h[0], h[0] + 0.25, t) * (1 - smooth(h[1], h[1] + 0.35, t))).toFixed(3); OV.h1.textContent = h[2]; OV.h2.textContent = h[3]; const k = easeOut(clamp((t - h[0]) / 0.5)); hd.style.transform = `translateY(${((1 - k) * 30).toFixed(1)}px) scale(${(0.94 + 0.06 * k).toFixed(3)})`; } else hd.style.opacity = '0';
  const c = CALL.find(([a, b]) => t >= a - 0.05 && t < b + 0.3);
  if (c) {
    const [a, b, v, fmt, unit, sub] = c, k = easeOut(clamp((t - a) / 0.7));
    OV.call.style.opacity = (smooth(a - 0.05, a + 0.15, t) * (1 - smooth(b, b + 0.3, t))).toFixed(3);
    OV.num.textContent = fmt(v * k); OV.unit.textContent = unit; OV.csub.textContent = sub;
    OV.call.style.transform = `translateY(${HEAD.some(([p, q]) => t >= p && t < q + 0.4) ? 360 : 0}px) scale(${(0.9 + 0.1 * easeOut(clamp((t - a) / 0.3))).toFixed(3)})`;
  } else OV.call.style.opacity = '0';
  const L = LABELS.find(([a, b]) => t >= a && t < b + 0.3);
  if (L) { const [a, b] = L; OV.lab.style.opacity = (smooth(a, a + 0.25, t) * (1 - smooth(b, b + 0.3, t))).toFixed(3); OV.l1.textContent = L[2]; OV.l2.textContent = L[3]; OV.lab.style.transform = `translateX(${((1 - easeOut(clamp((t - a) / 0.4))) * -30).toFixed(1)}px)`; } else OV.lab.style.opacity = '0';
  const ca = smooth(T_LETS - 0.1, T_LETS + 0.2, t) * (1 - smooth(SAY.cta - 0.4, SAY.cta - 0.1, t)) * (1 - 0.85 * (smooth(SAY.cost - 0.2, SAY.cost, t) - smooth(SAY.d7 - 0.3, SAY.d7 - 0.1, t)));
  OV.clock.style.opacity = ca.toFixed(3);
  if (ca > 0) { const hrs = clockAt(t); if (hrs < 23.5) { OV.cv.textContent = String(Math.floor(hrs)).padStart(2, '0') + ':' + String(Math.floor((hrs % 1) * 60)).padStart(2, '0'); OV.cu.textContent = 'h'; } else { OV.cv.textContent = 'DAY ' + Math.min(7, Math.floor(hrs / 24) + 1); OV.cu.textContent = ''; } }
}

// ------------------------------------------------------------------ sound: a music bed under everything, a sound for every move
function buildAudio() {
  const cuts = SHOTS.map((s) => s[1]);
  const { A: L, fx, S_, music } = X.audioBase(VO, ORDER, SAY, DURATION, cuts, []);
  music('music/184.mp3', 0, DURATION + 0.5, { offset: 6, level: 0.62, fin: 0.05, fout: 1.0 });
  const sub = (t, level, dur = 1.0) => L.push({ type: 'subdrop', t, dur, level, free: true });
  cuts.forEach((c, i) => { if (i) fx('sample', { file: 'sfx/2625.wav', t: c - 0.3, level: 0.16 }); });
  // the hook: data humming round the planet, then everything cut
  fx('pulse', { t0: 0, t1: T_CUT, bpm: [96, 120], level: 0.08 });
  for (let i = 0; i < 10; i++) fx('beep', { t: 0.3 + i * 0.32, f: 1400 + (i % 3) * 300, n: 1, dur: 0.04, level: 0.03, pan: -0.6 + 0.12 * i });
  fx('riser', { t0: W('hook', 'five'), t1: T_CUT, level: 0.1, curve: 2 });
  fx('powerdown', { t: T_CUT + 0.05, level: 0.35 });
  fx('sample', { file: 'sfx/2915.wav', t: T_CUT + 0.02, level: 0.3, dur: 1.5, fout: 0.5 });
  sub(T_CUT + 0.05, 0.45, 1.2);
  // intro
  fx('beep', { t: W('intro', 'not') + 0.4, f: 440, n: 2, drop: 0.8, dur: 0.12, level: 0.14 });
  fx('sample', { file: 'sfx/2896.wav', t: T_SEVEN + 0.02, level: 0.25, dur: 1.0, fout: 0.4 });
  for (let i = 0; i < 4; i++) fx('knock', { t: T_LETS + 0.2 + i * 0.5, n: 1, level: 0.05 });
  // hour zero: the phone
  fx('buzz', { t: SAY.h0 + 0.1, n: 1, level: 0.16 });
  fx('beep', { t: W('h0', 'nothing') + 0.1, f: 300, n: 2, drop: 0.85, level: 0.14 });
  // hour two: the card, the cash
  fx('beep', { t: W('h2', 'declined') - 0.3, f: 1500, n: 1, dur: 0.08, level: 0.14 });
  fx('beep', { t: W('h2', 'declined') + 0.02, f: 280, n: 2, drop: 0.8, dur: 0.16, level: 0.24 });
  fx('rustle', { t0: W('h2', 'cash') + 0.2, t1: W('h2', 'cash') + 1.6, level: 0.14 });
  fx('kaching', { t: W('h2', 'king') + 0.05, level: 0.22 });
  // hour six: the airport
  L.push(S_('sfx/1578.wav', SAY.h6, { dur: SAY.d2 - SAY.h6, level: 0.16, fin: 0.3, fout: 0.4, fx: true }));
  for (let i = 0; i < 8; i++) fx('sample', { file: 'sfx/1117.wav', t: W('h6', 'cancel') + 0.15 * i, level: 0.16, pan: -0.4 + 0.1 * i });
  fx('count', { t0: W('h6', 'five'), t1: W('h6', 'five') + 0.7, from: 22, to: 40, level: 0.07, seed: 3 });
  // day two: the store hum, things disappearing
  L.push({ type: 'crowd', t0: SAY.d2, t1: SAY.d4 - 0.1, level: 0.06, fx: true, swell: [[SAY.d2, 0.5], [SAY.d4, 0.2]] });
  for (let i = 0; i < 10; i++) fx('pop', { t: W('d2', 'shelves') + i * 0.15, f: 380 + i * 30, level: 0.08 });
  // day four: the satellite
  fx('sparkle', { t: W('d4', 'still') + 0.1, dur: 1.2, count: 10, f: [1800, 5200], level: 0.12, seed: 4 });
  fx('chime', { t: W('d4', 'satellites') + 0.1, level: 0.08, freq: 880 });
  // the cost
  fx('count', { t0: W('cost', 'forty'), t1: W('cost', 'forty') + 0.7, from: 24, to: 46, level: 0.08, seed: 5 });
  fx('kaching', { t: W('cost', 'forty') + 0.7, level: 0.24 });
  // the twist: under the sea
  L.push(S_('sfx/1177.wav', SAY.twist - 0.1, { dur: SAY.d7 - SAY.twist + 0.1, level: 0.25, fin: 0.3, fout: 0.4, fx: true }));
  fx('sample', { file: 'sfx/2915.wav', t: SAY.twist - 0.05, level: 0.25, dur: 1.4, fout: 0.4 });
  fx('clank', { t: W('twist', 'breaks') + 0.02, level: 0.3 }); fx('zap', { t: W('twist', 'breaks') + 0.05, level: 0.2 });
  fx('riser', { t0: W('twist', 'data'), t1: W('twist', 'road') + 0.3, level: 0.1, curve: 2 });
  // day seven: lights back on, every phone at once
  fx('riser', { t0: SAY.d7, t1: W('d7', 'every'), level: 0.12, curve: 2.2 });
  for (let i = 0; i < 22; i++) fx('ding', { t: W('d7', 'every') + Math.pow(i / 22, 1.3) * 2.0, f: 1100 + 400 * ((i * 37) % 10) / 10, level: 0.05 + 0.03 * ((i * 13) % 5) / 5, pan: -0.8 + 1.6 * ((i * 7) % 10) / 10 });
  sub(W('d7', 'same') + 0.2, 0.3);
  // the question
  for (let i = 0; i < 4; i++) fx('pop', { t: SAY.cta + 0.15 + i * 0.12, f: 600 + i * 120, level: 0.14 });
  fx('ding', { t: W('cta', 'comments') + 0.3, level: 0.14 });
  return L;
}

export default {
  id: 'net-cine', title: 'What if the internet went down for a week?', duration: DURATION, fadeOut: FADE, endAt: 1e9,
  captions: X.captions(VO, ORDER, SAY, NUMS, KEYWORDS), captionFade: 0.06, audio: buildAudio(),
  goal: () => null, hud: () => null, labels: () => [],
  async setup(ctx) {
    ctx.grain = 0.035; ctx.vignette = 1; ctx.handheld = 0.6; ctx.camScale = 0.2;
    ctx.grade = { brightness: 1.0, contrast: 1.06, saturate: 1.05, sepia: 0 };
    ctx.post = { bloom: { strength: 1.0, radius: 0.75, threshold: 0.62 } };
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const el = document.createElement('div'); el.id = 'cine';
    el.innerHTML = '<div class="head"><div class="h1"></div><div class="h2"></div></div><div class="call"><div><span class="num"></span><span class="unit"></span></div><div class="csub"></div></div><div class="clock"><span class="cv"></span><span class="cu"></span></div><div class="lab"><div class="l1"></div><div class="l2"></div></div>';
    document.getElementById('ui').appendChild(el);
    OV = { head: el.querySelector('.head'), h1: el.querySelector('.h1'), h2: el.querySelector('.h2'), call: el.querySelector('.call'), num: el.querySelector('.num'), unit: el.querySelector('.unit'), csub: el.querySelector('.csub'), clock: el.querySelector('.clock'), cv: el.querySelector('.cv'), cu: el.querySelector('.cu'), lab: el.querySelector('.lab'), l1: el.querySelector('.l1'), l2: el.querySelector('.l2') };
    await document.fonts.load('800 100px BarlowC'); await document.fonts.load('700 60px BarlowC'); await document.fonts.load('600 40px BarlowC');
    await build(ctx);
  },
  update(ctx, t) { update(ctx, t); },
};
export const _debug = { SAY, DURATION, SHOTS, wordT: W };
