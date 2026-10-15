// What if the power grid failed for a month? — illustrated explainer (same format as internet-down-2d.js).
// Every phrase has its own flat vector illustration (scenarios/ill2d.js + scenarios/ill2d-grid.js), timed to the word it shows.
// Facts: 2003 Northeast blackout (~50 million people, US-Canada Task Force report); Iberian blackout, 28 April 2025
// (Spain + Portugal, restored within about a day, ENTSO-E); hospital generators: NFPA 110 / Joint Commission 96-hour fuel
// planning; cell sites: battery backup of a few hours (FCC); large power transformers: 2-4 year lead times (US DOE, 2024).
import VO from './power-grid.vo.js';
import * as I from './ill2d.js';
import * as G from './ill2d-grid.js';

const { C, ease, clamp, lerp, hash } = I;

// ------------------------------------------------------------------ the story, timed by the narration
const ORDER = ['hook', 'intro', 'relate', 'day1', 'phone', 'day2', 'day3', 'day4', 'week2', 'twist', 'real', 'day30', 'cta'];
const GAP = { hook: 0.1, intro: 0.25, relate: 0.35, day1: 1.0, phone: 0.3, day2: 0.55, day3: 0.5, day4: 0.5, week2: 0.5, twist: 0.45, real: 0.35, day30: 0.55, cta: 0.35 };
const SAY = {};
{ let t = 0; for (const k of ORDER) { SAY[k] = t + (GAP[k] ?? 0.3); t = SAY[k] + VO[k].dur; } }
const toks = (s) => s.toLowerCase().replace(/-/g, ' ').replace(/[^a-z0-9' ]/g, '').split(/\s+/).filter(Boolean).map((w) => w.replace(/'/g, ''));
// time of the n-th word starting with `word` in a line; falls back to the word's share of the line if the timings disagree
function wordT(key, word, nth = 0) {
  let n = 0;
  for (const [w, s] of VO[key].words) if (w.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(word) && n++ === nth) return SAY[key] + s;
  const tk = toks(VO[key].text); let m = 0;
  for (let i = 0; i < tk.length; i++) if (tk[i].startsWith(word) && m++ === nth) return SAY[key] + VO[key].dur * i / tk.length;
  throw new Error(`no "${word}" in ${key}`);
}
const W = wordT;
const endOf = (k) => SAY[k] + VO[k].dur;
const FADE = [endOf('cta') + 0.6, endOf('cta') + 1.2], DURATION = FADE[1] + 0.2;

// ------------------------------------------------------------------ captions: two or three words, bold, keywords in yellow
const NUMS = [['ten percent', '10%'], ['10 percent', '10%'], ['10%', '10%'], ['thirty days', '30 DAYS'], ['30 days', '30 DAYS'], ['four days', '4 DAYS'], ['4 days', '4 DAYS'],
  ['fifty million', '50 MILLION'], ['50 million', '50 MILLION'], ['2003', '2003'], ['2025', '2025'], ['day thirty', 'DAY 30'], ['day 30', 'DAY 30'], ['oh', 'OOOOH']];
const KEYWORDS = /^(power|month|storm|street|entire|grid|flicker|never|fun|candles|stars|phone|towers|hours|fridge|bad|cards|gas|electricity|water|pumps|hospitals|generators|fuel|dark|quiet|share|crazy|hardest|switch|engineers|piece|transformers|years|already|america|spain|portugal|lights|neighborhood|miss|comments)$/i;
function buildCaptions() {
  const out = [];
  for (const key of ORDER) {
    const at = SAY[key];
    let ws = [];
    for (const [w, s, e] of VO[key].words) { if (ws.length && /^[-'%]/.test(w)) { const p = ws[ws.length - 1]; p[0] += w; p[2] = e; } else ws.push([w, s, e, false]); }
    for (const [sayd, show] of NUMS) {
      const k = sayd.replace(/-/g, ' ').split(' ');
      for (let i = 0; i + k.length <= ws.length; i++) {
        if (k.every((x, j) => ws[i + j][0].toLowerCase().replace(/[^a-z0-9]/g, '') === x.replace(/[^a-z0-9]/g, ''))) {
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
const OUTLINE = [[6, 0], [-6, 0], [0, 6], [0, -6], [4.5, 4.5], [-4.5, 4.5], [4.5, -4.5], [-4.5, -4.5]].map(([x, y]) => `${x}px ${y}px 0 #000`).join(', ');
const CSS = `@font-face { font-family: 'MontB'; font-weight: 900; src: url(/node_modules/@fontsource/montserrat/files/montserrat-latin-900-normal.woff2) format('woff2'); }
#title, #hud { display: none !important; }
#ill { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }
#caption { top: 1390px; left: 30px; right: 30px; }
#caption::before { display: none; }
#caption span { font-family: 'MontB', sans-serif; font-style: normal; font-weight: 900; font-size: 96px; line-height: 1.04; letter-spacing: -1px; text-transform: uppercase; color: #fff; text-shadow: ${OUTLINE}, 0 12px 26px rgba(0,0,0,0.55); }
#caption .cw { color: #ffffff; } #caption .cw.hl { color: #ffd84a; font-style: normal; }
#goal .fill { background: linear-gradient(90deg, #ffd84a, #ff8a3d); } #goal .dot { box-shadow: 0 0 16px rgba(255,200,90,0.95), 0 0 0 4px #ffb347; }
#goal .tick.on { background: #ffc35a; box-shadow: 0 0 10px rgba(255,200,90,0.9), 0 0 0 2px rgba(0,0,0,0.25); }`;

// the month on the day bar
const DAYS = () => [[SAY.day1 - 0.9, 0], [SAY.day2 - 0.2, 1], [SAY.day3 - 0.2, 2], [SAY.day4 - 0.2, 3], [SAY.week2 - 0.2, 7], [SAY.twist, 13], [SAY.real - 0.3, 20], [SAY.day30 - 0.2, 29], [W('day30', 'lights') + 0.3, 30]];
let DAYS_;
function daysAt(t) {
  DAYS_ ??= DAYS();
  if (t <= DAYS_[0][0]) return 0;
  for (let i = 0; i < DAYS_.length - 1; i++) { const [t0, a] = DAYS_[i], [t1, b] = DAYS_[i + 1]; if (t <= t1) return lerp(a, b, (t - t0) / (t1 - t0)); }
  return 30;
}

// ------------------------------------------------------------------ backgrounds
const S = [];
const at = (t0, draw) => S.push([t0, draw]);
const night = (glow, gy) => I.bg('#0e1530', '#1d2a55', glow, gy);
const darkCity = (t, on = 0, glow = null) => `${I.bg('#060a1c', '#141d40', glow, 900)}${G.stars(t, 70, 3)}${G.moon(860, 800, 56)}${I.cityline(1300, t, on, '#141b3a', 11)}<rect y="1300" width="1080" height="620" fill="#0b1026"/>`;
const litCity = (t) => `${I.bg('#0b1533', '#25356b', '#ffd27a', 1000)}${G.stars(t, 35, 5)}${G.moon(820, 520, 64)}${I.cityline(1300, t, 1, '#1b2550', 3)}<rect y="1300" width="1080" height="620" fill="#141d40"/>`;
const pylons = (t, on = 1) => `${G.pylon(150, 1340, 0.75, { on })}${G.pylon(930, 1340, 0.75, { on })}${G.pylonWires(150, 930, 1340, 0.75, t, on)}`;
const living = (t, on) => `${I.bg('#2b2260', '#463a8c', on ? '#ffd27a' : null, 760)}
  <rect x="110" y="430" width="360" height="400" rx="16" fill="#0b1026"/>${`<g clip-path="url(#win)"><clipPath id="win"><rect x="110" y="430" width="360" height="400" rx="16"/></clipPath>${G.stars(t, 12, 9, 1, 820).replace(/cx="(\d+(\.\d+)?)"/g, (m, x) => `cx="${110 + (+x) / 3}"`)}${G.moon(380, 520, 34)}</g>`}
  <rect x="96" y="416" width="388" height="428" rx="22" fill="none" stroke="#1d1845" stroke-width="20"/><line x1="290" y1="430" x2="290" y2="830" stroke="#1d1845" stroke-width="12"/>
  <rect y="1180" width="1080" height="740" fill="#2a2148"/>${G.floorLamp(900, 1190, 1.05, on)}`;
const sofaFamily = (t, face, pose = 'stand') => `${[[330, C.teal, 0], [540, C.coral, 1], [740, C.yellow, 2]].map(([x, col, i]) => I.person(x, 1210, 0.95, { shirt: col, pose, face, t, seed: i, flip: i === 2 ? -1 : 1 })).join('')}${I.couch(540, 1180, 1.25)}`;
const kitchen = (t) => `${I.bg('#26304f', '#3b4a74')}${[...Array(9)].map((_, i) => `<rect x="${i * 130 - 20}" y="420" width="120" height="760" fill="#2f3b60" opacity="0.5"/>`).join('')}
  <rect y="1180" width="1080" height="740" fill="#1a2140"/><rect y="1160" width="1080" height="40" fill="#5b6378"/>`;
const nightStreet = (t, warm = 0) => `${I.bg('#060a1c', '#18224a', warm ? '#ffb347' : null, 1050)}${G.stars(t, 60, 6)}${G.milkyWay(0.8)}
  <rect y="1150" width="1080" height="770" fill="#151b33"/><rect y="1220" width="1080" height="110" fill="#22293f"/>
  ${I.house(200, 1160, 0.9, '#3a3352', '#2a2240')}${I.house(880, 1160, 0.9, '#33405a', '#232c48')}`;
const PHONE = { x: 540, y: 815, s: 1.05 };
const ROLE = [[330, C.teal], [540, C.coral], [750, C.yellow]];

// ---------- the hook
at(0, (t, u) => `${litCity(t)}${pylons(t, 1)}`);
at(W('hook', 'the'), (t, u) => `${I.bg('#3a2a5c', '#6b4a7a', '#ffd27a', 800)}<line x1="540" y1="0" x2="540" y2="600" stroke="#1a1d27" stroke-width="10"/>
  <g transform="rotate(${4 * Math.sin(t * 2)} 540 0)">${G.bulb(540, 790, 1.5, 1, t)}</g>`);
at(W('hook', 'went'), (t, u) => { const on = u < 0.12 ? 1 : u < 0.45 ? (hash(Math.floor(u * 30), 4) > 0.45 ? 1 : 0) : 0;
  return `${on ? I.bg('#3a2a5c', '#6b4a7a', '#ffd27a', 800) : I.bg('#07091a', '#141a33')}<line x1="540" y1="0" x2="540" y2="600" stroke="#1a1d27" stroke-width="10"/>
  <g transform="rotate(${4 * Math.sin(t * 2)} 540 0)">${G.bulb(540, 790, 1.5, on, t)}</g><rect width="1080" height="1920" fill="#fff" opacity="${u > 0.45 ? 0.4 * Math.exp(-(u - 0.45) * 10) : 0}"/>`; });
at(W('hook', 'didnt'), (t, u) => `${darkCity(t, 0)}${pylons(t, 0)}${G.outlined(540, 620, 96, '#fff', '. . .', 8)}`);
at(W('hook', 'whole'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ff5e5b', 820)}${G.calendar30(540, 820, 1, t, Math.min(30, ease.inOut(u / 1.2) * 30), 'ONE MONTH')}`);
// ---------- what the video is about
at(W('intro', 'not'), (t, u) => `${I.bg('#1c2238', '#39415c')}${G.stormCloud(540, 720, 1.1, t + 0.3)}${I.xmark(820, 560, 0.85, u - 0.45)}`);
at(W('intro', 'not', 1), (t, u) => `${nightStreet(t)}${I.house(540, 1160, 1.1, '#4a3d63', '#33284a')}${I.xmark(820, 560, 0.85, u - 0.4)}`);
at(W('intro', 'entire'), (t, u) => { const lit = [...Array(9)].map((_, i) => 1 - clamp((u * 2.2 - (i % 3) * 0.35 - Math.floor(i / 3) * 0.2) * 3));
  return `${night('#2f7bff', 800)}${G.gridMap(540, 820, 1.05, t, lit)}`; });
at(W('intro', 'for'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ff5e5b', 820)}${G.calendar30(540, 820, 1, t, Math.min(30, ease.inOut(u / 1.1) * 30))}`);
at(W('intro', 'heres'), (t, u) => {
  const kinds = ['candle', 'fridge', 'tap', 'hospital', 'people', 'bulb'], labels = ['DAY 1', 'DAY 2', 'DAY 3', 'DAY 4', 'WEEK 2', 'DAY 30'];
  const pts = [[250, 520], [780, 620], [300, 780], [780, 900], [280, 1060], [760, 1180]];
  let path = `M 540 420`; pts.forEach(([x, y]) => (path += ` L ${x} ${y}`));
  return `${night('#ffd84a', 820)}<path d="${path}" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round" opacity="0.5"/>
  ${pts.map(([x, y], i) => u >= i * 0.28 ? `${G.icon(kinds[i], x, y, ease.back((u - i * 0.28) / 0.3), t)}<text x="${x + (x < 540 ? 90 : -90)}" y="${y + 14}" font-family="MontB" font-weight="900" font-size="40" fill="#fff" text-anchor="${x < 540 ? 'start' : 'end'}" opacity="${clamp((u - i * 0.28) * 4)}">${labels[i]}</text>` : '').join('')}`;
});
// ---------- the shared feeling
at(W('relate', 'you'), (t, u) => `${living(t, 1)}${sofaFamily(t, 'happy')}`);
at(W('relate', 'lights'), (t, u) => { const on = hash(Math.floor(t * 12), 2) > 0.35 ? 1 : 0;
  return `${living(t, on)}${sofaFamily(t, 'neutral')}${on ? '' : `<rect width="1080" height="1920" fill="#000" opacity="0.45"/>`}`; });
at(W('relate', 'everyone'), (t, u) => `${living(t, 0)}${sofaFamily(t, 'panic')}<rect width="1080" height="1920" fill="#000" opacity="0.4"/>
  ${G.outlined(540 + 6 * Math.sin(t * 20), 600, 150, C.yellow, 'OOOOH!', 12)}`);
at(W('relate', 'yeah'), (t, u) => `${living(t, 1)}${sofaFamily(t, 'happy', 'cheer')}${I.check(540, 560, 0.8, u - 0.1)}`);
at(W('relate', 'now'), (t, u) => { const d = ease.out(u / 0.4);
  return `${living(t, u < 0.25 ? 1 : 0)}${sofaFamily(t, 'neutral')}<rect width="1080" height="1920" fill="#03040c" opacity="${0.86 * d}"/>
  ${ROLE.map(([x], i) => { const bl = (Math.floor(t * 1.3 + i) % 4 === 0 && (t * 1.3 + i) % 1 < 0.15) ? 0.15 : 1; return `<g opacity="${d}"><ellipse cx="${x - 13}" cy="818" rx="9" ry="${9 * bl}" fill="#fff"/><ellipse cx="${x + 13}" cy="818" rx="9" ry="${9 * bl}" fill="#fff"/></g>`; }).join('')}`; });
// ---------- day one
const candleRoom = (t) => `${I.bg('#120c22', '#2a1a33', '#ff9a3d', 900)}<rect y="1180" width="1080" height="740" fill="#1d1426"/>`;
at(SAY.day1 - 0.95, (t, u) => `${candleRoom(t)}${G.candle(540, 1180, 1.6, t)}${I.stamp('DAY 1', u, 600)}`);
at(W('day1', 'honestly'), (t, u) => `${candleRoom(t)}${I.person(540, 1280, 1.25, { shirt: C.teal, pose: 'cheer', face: 'happy', t })}${G.candle(250, 1240, 1.1, t, 1, 1)}${G.candle(830, 1240, 1.1, t, 1, 2)}
  ${I.bubbleSay(780, 560, 1, u - 0.5, 'Kinda fun!')}`);
at(W('day1', 'candles'), (t, u) => `${candleRoom(t)}${[0, 1, 2, 3, 4].map((i) => G.candle(180 + i * 180, 1150 - (i % 2) * 40, 1.1 - (i % 2) * 0.15, t, ease.out((u - i * 0.1) / 0.15), i)).join('')}`);
at(W('day1', 'board'), (t, u) => `${candleRoom(t)}${ROLE.map(([x, col], i) => I.person(x, 1180, 0.95, { shirt: col, pose: i === 1 ? 'cheer' : 'talk', face: 'happy', t, seed: i, flip: i === 2 ? -1 : 1 })).join('')}
  ${G.boardGame(540, 1060, 1, t)}${G.candle(170, 1060, 0.8, t, 1, 3)}${G.candle(910, 1060, 0.8, t, 1, 4)}`);
at(W('day1', 'everyone'), (t, u) => `${nightStreet(t)}${[[240, C.teal, 'wave'], [440, C.coral, 'stand'], [640, C.yellow, 'cheer'], [840, '#c77dff', 'stand']].map(([x, col, pose], i) => I.person(x, 1330, 0.85, { shirt: col, pose, face: 'happy', t, seed: i, flip: i > 1 ? -1 : 1 })).join('')}
  ${G.shootingStar(W('day1', 'stars') - W('day1', 'everyone'), u)}`);
// ---------- the phone and the towers
at(SAY.phone, (t, u) => `${I.bg('#120c22', '#2a1a33', '#ff5e5b', 820)}${I.heldPhone({ ...PHONE, rot: -2 + Math.sin(t * 1.5), id: 'bat', screen: G.screenBattery(t, u, Math.max(10, Math.round(16 - u * 4))) })}`);
at(W('phone', 'and'), (t, u) => `${darkCity(t, 0)}${G.cellTower(460, 1320, 0.95, t, { batt: 1, signal: 1 })}`);
at(W('phone', 'batteries'), (t, u) => { const b = 1 - ease.inOut(u / 2.6), dead = b < 0.04;
  return `${darkCity(t, 0)}${G.cellTower(460, 1320, 0.95, t, { batt: b, signal: dead ? 0 : 1 })}
  <g transform="translate(540 470)">${G.outlined(0, 0, 76, dead ? C.red : '#fff', dead ? 'NO SIGNAL' : 'A FEW HOURS', 9)}</g>`; });
// ---------- day two
at(SAY.day2 - 0.15, (t, u) => `${kitchen(t)}${G.fridge(540, 900, 0.95, t)}${I.stamp('DAY 2', u, 560)}`);
at(W('day2', 'your'), (t, u) => `${kitchen(t)}${G.fridge(430, 900, 0.95, t, { open: u / 0.5 })}${G.thermometer(820, 1020, 0.95, ease.inOut(u / 2.2) * 0.75)}`);
at(W('day2', 'food'), (t, u) => `${kitchen(t)}<g transform="translate(540 820) scale(${1.15 + 0.08 * ease.out(u / 2)}) translate(-540 -820)">${G.fridge(540, 900, 0.95, t, { open: 1, spoil: clamp(0.25 + u / 1.2) })}</g>`);
const shop = () => `${I.bg('#2b1c18', '#4a2d22', '#ff9a52', 760)}<rect x="0" y="1090" width="1080" height="830" fill="#3a2419"/><rect x="0" y="1060" width="1080" height="56" fill="url(#woodTop)"/>`;
at(W('day2', 'shops'), (t, u) => { const k = ease.out(u / 0.4), dec = u > 0.55, sh = dec ? 16 * Math.exp(-(u - 0.55) * 6) : 0;
  return `${shop()}${dec ? `<rect width="1080" height="1920" fill="${C.red}" opacity="${0.3 * Math.exp(-(u - 0.55) * 5)}"/>` : ''}${I.terminal(560 + I.wobble(t, 40, sh), 820, 1.25, { state: dec ? 'declined' : 'tap', t })}
  ${dec ? '' : I.handCard(lerp(1300, 900, k), 900, 1, -6)}`; });
const station = () => `${I.bg('#ff9a62', '#ffd27a')}<rect y="1250" width="1080" height="670" fill="#5c6478"/><rect x="40" y="380" width="1000" height="90" fill="#c0392b"/><rect x="100" y="470" width="40" height="800" fill="#9aa3b8"/><rect x="940" y="470" width="40" height="800" fill="#9aa3b8"/>`;
at(W('day2', 'gas'), (t, u) => `${station()}${G.gasPump(540, 1260, 1.05, t, { sign: clamp((u - 0.2) / 0.4) })}`);
at(W('day2', 'they'), (t, u) => `${station()}${G.gasPump(620, 1260, 1.05, t, { sign: 1, plug: clamp(u / 0.3) })}`);
// ---------- day three
at(SAY.day3 - 0.15, (t, u) => `${kitchen(t)}${G.tap(540, 760, 1.1, t, 1)}${I.stamp('DAY 3', u, 520)}`);
at(W('day3', 'water'), (t, u) => `${kitchen(t)}<g transform="translate(540 900) scale(${1 + 0.15 * ease.out(u / 1.5)}) translate(-540 -900)">${G.tap(540, 760, 1.1, t, 1 - ease.inOut((u - 0.2) / 1.3) * 0.95)}</g>`);
at(W('day3', 'because'), (t, u) => { const f = 1 - ease.inOut((u - 0.6) / 1.4), spin = 260 * u - 140 * Math.max(0, u - 0.6) * Math.max(0, u - 0.6);
  const dots = [...Array(10)].map((_, i) => { const p = (i / 10 + (u - 0.5 * Math.max(0, u - 0.6) ** 2) * 0.5) % 1; return `<circle cx="${lerp(480, 800, p)}" cy="${1112}" r="13" fill="#7fc6ff" opacity="${0.4 + 0.6 * f}"/>`; }).join('');
  return `${night('#4aa8ff', 860)}<rect y="1250" width="1080" height="670" fill="#1a2140"/>${G.pumpStation(270, 1250, 1.15, t, { spin, off: clamp((W('day3', 'power') - W('day3', 'because') - u) * -3) })}
  <rect x="470" y="1090" width="330" height="44" rx="10" fill="#5b6378"/>${dots}${I.house(880, 1250, 1.0, '#4a3d63', '#33284a')}`; });
// ---------- day four
at(SAY.day4 - 0.15, (t, u) => `${darkCity(t, 0)}${G.hospital(540, 1300, 0.95, t, 0.5)}${I.stamp('DAY 4', u, 520)}`);
at(W('day4', 'hospitals'), (t, u) => `${darkCity(t, 0, '#ffd27a')}${G.hospital(540, 1300, 1.05, t, 0.75)}
  <circle cx="540" cy="580" r="${26 + 8 * Math.sin(t * 8)}" fill="${C.red}" opacity="${0.5 + 0.5 * Math.sin(t * 8)}" filter="url(#glow)"/>`);
at(W('day4', 'running'), (t, u) => `${darkCity(t, 0, '#ffd27a')}${G.hospital(700, 1300, 0.75, t, 0.75)}<path d="M 470 1250 C 420 1290 400 1300 300 1300" stroke="#1a1d27" stroke-width="16" fill="none"/>
  ${G.generator(270, 1310, 0.9, t, 1)}`);
at(W('day4', 'many'), (t, u) => { const v = 1 - ease.inOut(u / 2.4) * 0.85, hrs = Math.round(96 * v);
  return `${night('#ff5e5b', 860)}${G.fuelTank(230, 1180, 1.0, v)}
  ${G.outlined(700, 820, 150, C.yellow, '4 DAYS', 12)}${G.outlined(700, 915, 60, '#fff', `(${hrs} HOURS)`, 8)}`; });
// ---------- week two
at(SAY.week2 - 0.15, (t, u) => `${darkCity(t, 0)}${I.stamp('WEEK 2', u, 600)}`);
at(W('week2', 'the'), (t, u) => `<g transform="translate(540 900) scale(${1 + 0.05 * ease.out(u / 3)}) translate(-540 -900)">${darkCity(t, 0)}</g>${G.outlined(540, 620, 90, '#c9d0ff', 'shhh…', 8)}`);
const neighbours = (t, u, food, water, gen) => `${nightStreet(t, gen)}
  ${gen ? `<path d="M 60 820 Q 540 940 1020 820" stroke="#2a2e3b" stroke-width="5" fill="none"/>${[...Array(11)].map((_, i) => { const x = 60 + i * 96, y = 820 + 4 * 120 * (i / 10) * (1 - i / 10); return `<circle cx="${x}" cy="${y + 14}" r="14" fill="#ffe28a" opacity="${clamp((gen - i * 0.05) * 5)}" filter="url(#glow)"/>`; }).join('')}` : ''}
  ${[[260, C.teal, 'talk'], [440, C.coral, 'stand'], [640, C.yellow, 'talk'], [820, '#c77dff', 'wave']].map(([x, col, pose], i) => I.person(x, 1270, 0.62, { shirt: col, pose, face: 'happy', t, seed: i, flip: i > 1 ? -1 : 1 })).join('')}
  <rect x="300" y="1180" width="480" height="24" rx="8" fill="url(#woodTop)"/><rect x="320" y="1204" width="16" height="110" fill="${C.woodD}"/><rect x="744" y="1204" width="16" height="110" fill="${C.woodD}"/>
  ${food ? `<g transform="translate(400 1180) scale(${ease.back(food / 0.3)})"><rect x="-60" y="-80" width="120" height="80" rx="8" fill="#c98f4a"/><circle cx="-24" cy="-92" r="20" fill="${C.red}"/><circle cx="18" cy="-96" r="22" fill="#ffd84a"/></g>` : ''}
  ${water ? [0, 1].map((i) => `<g transform="translate(${560 + i * 80} 1180) scale(${ease.back((water - i * 0.1) / 0.3)})"><rect x="-30" y="-110" width="60" height="110" rx="14" fill="#7fc6ff" opacity="0.9"/><rect x="-14" y="-128" width="28" height="22" rx="6" fill="#2f7bff"/></g>`).join('') : ''}
  ${gen ? `<g transform="scale(${ease.back(gen / 0.3)})" transform-origin="900 1330">${G.generator(900, 1340, 0.42, t, 1)}</g>` : ''}`;
at(W('week2', 'neighb'), (t, u) => neighbours(t, u, u, 0, 0));
at(W('week2', 'water'), (t, u) => neighbours(t, u, 1, u, 0));
at(W('week2', 'whatever'), (t, u) => neighbours(t, u, 1, 1, u));
// ---------- the twist
at(SAY.twist - 0.1, (t, u) => `${I.bg('#120a2e', '#3a1a6b', '#c77dff', 820)}${G.stars(t, 40, 12)}
  <g transform="translate(540 820) rotate(${u * 40})" opacity="0.5">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M 0 0 L ${Math.cos(i) * 600} ${Math.sin(i) * 600}" stroke="#c77dff" stroke-width="40" opacity="0.3"/>`).join('')}</g>${I.stamp('THE TWIST', u, 860)}`);
at(W('twist', 'hardest'), (t, u) => { const s = clamp((u - 0.7) / 0.3);
  return `${darkCity(t, 0)}${G.outlined(540, 760, 150, '#fff', 'BLACKOUT', 12)}<line x1="160" y1="712" x2="${160 + 760 * s}" y2="712" stroke="${C.red}" stroke-width="24" stroke-linecap="round"/>`; });
at(W('twist', 'turning'), (t, u) => { const p = 1 + 0.05 * Math.sin(t * 6);
  return `${night('#34c759', 820)}<g transform="translate(540 820) scale(${p})"><circle r="250" fill="#1a1d27" filter="url(#drop)"/><circle r="250" fill="none" stroke="${C.green}" stroke-width="16" opacity="${0.5 + 0.5 * Math.sin(t * 6)}" filter="url(#glow)"/>
  <path d="M -90 -70 A 120 120 0 1 0 90 -70" stroke="${C.green}" stroke-width="34" fill="none" stroke-linecap="round"/><line x1="0" y1="-140" x2="0" y2="0" stroke="${C.green}" stroke-width="34" stroke-linecap="round"/></g>`; });
at(W('twist', 'you'), (t, u) => `${night('#ff5e5b', 820)}${G.bigSwitch(540, 860, 1.05, clamp((u - 0.2) / 0.3), t)}${I.xmark(800, 520, 0.85, u - 0.75)}`);
at(W('twist', 'engineers'), (t, u) => { const lit = [...Array(9)].fill(0);
  return `${I.bg('#0e1530', '#1d2a55')}<rect x="140" y="420" width="800" height="560" rx="24" fill="#05070f"/><g transform="translate(540 700) scale(0.6) translate(-540 -820)">${G.gridMap(540, 820, 1, t, lit)}</g>
  <rect y="1190" width="1080" height="730" fill="#141b33"/>${[[360, 0], [720, 1]].map(([x, i]) => `${I.person(x, 1300, 0.9, { shirt: '#ff8a1e', pose: i ? 'talk' : 'wave', t, seed: i, flip: i ? -1 : 1 })}${G.vest(x, 1300, 0.9)}${G.hardHat(x, 1300, 0.9)}`).join('')}`; });
const RANK = [4, 1, 3, 2, 0, 5, 7, 6, 8];
at(W('twist', 'piece'), (t, u) => { const lit = RANK.map((r) => clamp((u * 2.6 - r * 0.32) * 4));
  return `${night('#ffd27a', 820)}${G.gridMap(540, 820, 1.08, t, lit)}`; });
at(W('twist', 'some'), (t, u) => `${I.bg('#2a3352', '#4a5a88')}<rect y="1250" width="1080" height="670" fill="#3a4260"/>${G.transformer(480, 1260, 1.05, t)}
  ${I.person(900, 1270, 0.5, { shirt: '#ff8a1e', pose: 'stand', t })}${G.vest(900, 1270, 0.5)}${G.hardHat(900, 1270, 0.5)}`);
at(W('twist', 'years'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ffd84a', 820)}<g opacity="0.35">${G.transformer(540, 1300, 0.9, t)}</g>${G.hourglass(540, 760, 1.1, t)}
  <g transform="translate(540 1110) scale(${ease.back(u / 0.3)})">${G.outlined(0, 0, 130, C.yellow, '2–4 YEARS', 12)}</g>`);
// ---------- could it happen?
at(SAY.real, (t, u) => `${darkCity(t, 0)}${pylons(t, 0)}
  <text x="540" y="${720 + 10 * Math.sin(t * 4)}" font-family="MontB" font-weight="900" font-size="320" fill="${C.yellow}" text-anchor="middle" stroke="#000" stroke-width="12" paint-order="stroke" transform="rotate(${6 * Math.sin(t * 3)} 540 620)">?</text>`);
at(W('real', 'it'), (t, u) => `${night('#34c759', 820)}${I.check(540, 760, 1.5, u)}${G.outlined(540, 1080, 84, '#fff', 'IT HAPPENED', 9)}`);
at(W('real', 'in'), (t, u) => { const k = ease.out(u / 0.6);
  return `${night('#ffd84a', 820)}${G.paper(540, 860, lerp(0.2, 1.0, k), lerp(-540, -4, k), { date: 'FRIDAY, AUGUST 15, 2003', h1: 'BLACKOUT!', h2: '50 MILLION IN DARK',
    art: `<rect x="-300" y="60" width="300" height="140" fill="#0b1026"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="${-290 + i * 58}" y="${80 - (i % 3) * 30}" width="46" height="${120 + (i % 3) * 30}" fill="#232c48"/>`).join('')}` })}`; });
at(W('real', 'people'), (t, u) => `${night('#2f7bff', 860)}${G.mapNA(540, 860, 1.5, t, ease.out(u / 0.8))}
  <g opacity="${clamp((u - 0.3) * 4)}">${G.outlined(540, 470, 100, C.yellow, '50 MILLION', 10)}</g>`);
at(W('real', 'and'), (t, u) => `${night('#ff9a52', 860)}${G.mapIberia(540, 880, 1.6, t, ease.inOut((u - 0.5) / 1.2))}${G.outlined(330, 860, 40, '#fff', 'PORTUGAL', 6)}${G.outlined(600, 900, 64, '#fff', 'SPAIN', 7)}
  ${G.outlined(540, 470, 64, '#fff', 'APRIL 28, 2025', 8)}`);
at(W('real', 'almost'), (t, u) => { const p = 0.9 * ease.out(u / 1.1), a = p * 2 * Math.PI, x1 = Math.sin(a) * 250, y1 = -Math.cos(a) * 250;
  return `${night('#ff9a52', 860)}<g transform="translate(540 840)"><circle r="290" fill="#fff" filter="url(#drop)"/><circle r="250" fill="#eef1f8"/>
  <path d="M 0 0 L 0 -250 A 250 250 0 ${p > 0.5 ? 1 : 0} 1 ${x1} ${y1} Z" fill="#1a2140" opacity="0.85"/>
  ${[...Array(12)].map((_, i) => `<rect x="-6" y="-280" width="12" height="26" rx="6" fill="${C.ink}" transform="rotate(${i * 30})"/>`).join('')}<circle r="22" fill="${C.ink}"/></g>
  ${G.outlined(540, 1260, 96, C.yellow, 'ALMOST 1 DAY', 10)}`; });
// ---------- day thirty
at(SAY.day30 - 0.15, (t, u) => `${darkCity(t, 0)}${I.stamp('DAY 30', u, 600)}`);
at(W('day30', 'the'), (t, u) => { const k = ease.inOut(u / 3.4);
  return `${I.bg('#060a1c', '#1d2a55', k > 0.2 ? '#ffd27a' : null, 1050)}${G.stars(t, 70, 3, 1 - 0.6 * k)}${G.moon(820, 520, 64)}${G.cityBlocks(1300, t, k)}<rect y="1300" width="1080" height="620" fill="#0b1026"/>`; });
at(W('day30', 'and'), (t, u) => { const tm = W('day30', 'miss') - W('day30', 'and');
  return `${I.bg('#0b1533', '#25356b', '#ffd27a', 1100)}${G.stars(t, 18, 3, 0.5)}${G.cityBlocks(1300, t, 1)}<rect y="1300" width="1080" height="620" fill="#0b1026"/>
  <rect x="200" y="1300" width="680" height="40" fill="#2a3352"/>${I.person(540, 1310, 0.95, { shirt: C.teal, pose: 'stand', t })}
  <g opacity="${clamp((u - tm) * 4)}">${[0, 1, 2].map((i) => `<circle cx="${620 + i * 40}" cy="${780 - i * 50}" r="${10 + i * 6}" fill="#fff"/>`).join('')}
  <g transform="translate(790 520) scale(${ease.back((u - tm - 0.1) / 0.3)})"><ellipse rx="210" ry="140" fill="#fff" filter="url(#soft)"/>${G.stars(t, 0)}
  ${[[-90, -30, 1], [0, 30, 1.4], [90, -40, 1]].map(([x, y, k]) => `<path transform="translate(${x} ${y}) scale(${k})" d="M 0 -40 L 11 -12 L 40 -12 L 17 6 L 26 36 L 0 18 L -26 36 L -17 6 L -40 -12 L -11 -12 Z" fill="${C.yellow}"/>`).join('')}</g></g>`; });
// ---------- the question
at(SAY.cta, (t, u) => `${night('#ffd84a', 860)}${G.commentBox(540, 860, 1, t, u)}`);
at(W('cta', 'tell'), (t, u) => `${night('#ffd84a', 860)}${G.commentBox(540, 800, 0.9, t, 2)}
  <g transform="translate(540 1220) scale(${1 + 0.08 * Math.sin(t * 10)})"><rect x="-120" y="-80" width="240" height="160" rx="40" fill="#fff"/><path d="M -40 70 L -70 130 L 10 70 Z" fill="#fff"/>
  ${[-50, 0, 50].map((x, i) => `<circle cx="${x}" cy="0" r="16" fill="${C.ink}" opacity="${0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i))}"/>`).join('')}</g>`);
S.sort((a, b) => a[0] - b[0]);

function frameSVG(t) {
  let i = -1; for (let j = 0; j < S.length; j++) if (t >= S[j][0]) i = j;
  if (i < 0) i = 0;
  const [t0, draw] = S[i], u = Math.max(0, t - t0);
  // every new picture lands with a push-in, then keeps drifting slowly (a living frame, never a still)
  const z = (1 + 0.06 * (1 - ease.out(u / 0.3))) * (1 + 0.012 * u), px = (i % 2 ? 1 : -1) * 5 * u;
  return `<g transform="translate(${540 + px} 960) scale(${z}) translate(-540 -960)">${draw(t, u)}</g>${I.vignette()}`;
}
const CUTS = S.map((s) => s[0]);

// ------------------------------------------------------------------ sound
const S_ = (file, t, o = {}) => Object.assign({ type: 'sample', file, t }, o);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const STAMP_T = () => [SAY.day1 - 0.95, SAY.day2 - 0.15, SAY.day3 - 0.15, SAY.day4 - 0.15, SAY.week2 - 0.15, SAY.twist - 0.1, SAY.day30 - 0.15];
function buildAudio() {
  const A = [], fx = (type, o) => A.push(Object.assign({ type, fx: true }, o));
  const keysEvery = (f, step = 0.05) => { const ks = []; for (let t = 0; t <= DURATION; t += step) ks.push([+t.toFixed(2), +f(t).toFixed(3)]); return ks; };
  for (const key of ORDER) A.push(S_(VO[key].file, SAY[key], { level: 1.35, free: true, verb: 0.02, fin: 0.005, fout: 0.03 }));
  const talking = (t) => { let q = 0; for (const key of ORDER) { const a = SAY[key]; q = Math.max(q, smooth(a - 0.3, a - 0.05, t) * (1 - smooth(a + VO[key].dur, a + VO[key].dur + 0.35, t))); } return q; };
  A.push({ type: 'fxduck', keys: keysEvery((t) => 1 - 0.45 * talking(t), 0.04) });
  // music: tension for the month, warmer when the lights come back
  A.push(S_('music/464.mp3', 0, { offset: 4, level: 0.5, fin: 0.2, fout: 1.2, dur: SAY.day30 + 0.6, keys: keysEvery((t) => 1 - 0.68 * talking(t)) }));
  A.push(S_('music/606.mp3', SAY.day30 - 0.3, { offset: 14, level: 0.55, fin: 0.8, fout: 1.2, dur: DURATION - SAY.day30 + 0.3, keys: keysEvery((t) => 1 - 0.66 * talking(t)) }));
  // a whoosh into every new picture
  CUTS.forEach((c, i) => { if (i) fx('sample', { file: i % 2 ? 'sfx/2605.wav' : 'sfx/1490.wav', t: c - 0.12, level: 0.11, pan: -0.3 + 0.6 * hash(i, 3) }); });
  STAMP_T().forEach((t0, i) => { fx('sample', { file: 'sfx/2604.wav', t: t0 - 0.2, level: i ? 0.14 : 0.25 }); A.push({ type: 'subdrop', t: t0 + 0.04, dur: 0.7, level: i ? 0.25 : 0.38, free: true }); });
  // hook: the city at night, the bulb dying, the month
  A.push(S_('sfx/2678.wav', 0, { dur: W('hook', 'went') + 0.4, level: 0.25, fin: 0.1, fout: 0.3 }));
  fx('flicker', { t0: W('hook', 'went') + 0.12, t1: W('hook', 'went') + 0.45, level: 0.3 });
  A.push({ type: 'powerdown', t: W('hook', 'went') + 0.42, level: 0.35, fx: true });
  A.push({ type: 'subdrop', t: W('hook', 'went') + 0.45, dur: 1.0, level: 0.4, free: true });
  A.push(S_('sfx/1789.wav', W('hook', 'didnt'), { dur: W('hook', 'whole') - W('hook', 'didnt') + 0.2, level: 0.22, fin: 0.2, fout: 0.2, fx: true }));
  fx('count', { t0: W('hook', 'whole'), t1: W('hook', 'whole') + 1.2, from: 20, to: 40, level: 0.08, seed: 2 });
  // intro: storm, street, the whole grid, thirty days, the road map
  A.push(S_('sfx/1296.wav', W('intro', 'not'), { dur: 1.6, level: 0.35, fin: 0.02, fout: 0.5, fx: true }));
  fx('beep', { t: W('intro', 'not') + 0.5, f: 330, n: 2, drop: 0.8, level: 0.22 });
  fx('beep', { t: W('intro', 'not', 1) + 0.45, f: 330, n: 2, drop: 0.8, level: 0.22 });
  A.push({ type: 'powerdown', t: W('intro', 'entire') + 0.1, level: 0.22, fx: true });
  fx('count', { t0: W('intro', 'for'), t1: W('intro', 'for') + 1.1, from: 24, to: 44, level: 0.08, seed: 5 });
  for (let i = 0; i < 6; i++) fx('pop', { t: W('intro', 'heres') + i * 0.28, f: 700 + i * 90, level: 0.2 });
  // the flicker everyone knows
  fx('flicker', { t0: W('relate', 'lights'), t1: W('relate', 'everyone'), level: 0.25 });
  fx('sample', { file: 'sfx/964.wav', t: W('relate', 'everyone') + 0.05, level: 0.22 });
  fx('sample', { file: 'sfx/966.wav', t: W('relate', 'everyone') + 0.12, level: 0.2, pan: 0.3 });
  fx('ding', { t: W('relate', 'yeah') + 0.1, f: 880, level: 0.12 });
  A.push({ type: 'powerdown', t: W('relate', 'now') + 0.2, level: 0.3, fx: true });
  A.push(S_('sfx/2896.wav', W('relate', 'never') + 0.1, { level: 0.3, free: true, dur: 1.2, fout: 0.5 }));
  // day one: candles, a board game, crickets under the stars
  for (let i = 0; i < 5; i++) fx('pop', { t: W('day1', 'candles') + i * 0.1 + 0.03, f: 260 + i * 40, level: 0.18 });
  fx('knock', { t: W('day1', 'board') + 0.3, n: 3, gap: 0.09, level: 0.2 });
  A.push(S_('sfx/1789.wav', W('day1', 'everyone') - 0.2, { dur: SAY.phone - W('day1', 'everyone') + 0.4, level: 0.3, fin: 0.3, fout: 0.4, fx: true }));
  fx('sparkle', { t: W('day1', 'stars'), dur: 0.9, count: 8, f: [1800, 4800], level: 0.12, seed: 4 });
  // the phone dying, the towers
  fx('buzz', { t: SAY.phone + 0.1, n: 1, level: 0.22 });
  fx('beep', { t: W('phone', 'ten') + 0.3, f: 880, n: 2, dur: 0.12, gap: 0.12, level: 0.18 });
  A.push({ type: 'pulse', t0: W('phone', 'and'), t1: W('phone', 'batteries') + 2.4, bpm: [60, 110], level: 0.14, fx: true });
  fx('beep', { t: W('phone', 'batteries') + 2.5, f: 520, n: 3, drop: 0.8, dur: 0.12, level: 0.2 });
  // day two: the fridge, the card, the pump
  fx('creak', { t0: W('day2', 'your') + 0.05, t1: W('day2', 'your') + 0.5, level: 0.15 });
  fx('buzz', { t: W('day2', 'food') + 0.4, n: 2, level: 0.08 });
  fx('beep', { t: W('day2', 'shops') + 0.35, f: 1500, n: 1, dur: 0.09, level: 0.2 });
  fx('beep', { t: W('day2', 'shops') + 0.57, f: 300, n: 2, drop: 0.8, dur: 0.16, level: 0.3 });
  fx('clank', { t: W('day2', 'gas') + 0.45, level: 0.3 });
  fx('zap', { t: W('day2', 'they') + 0.15, level: 0.25 });
  // day three: water slowing to a drip, the pump stopping
  fx('water', { t0: SAY.day3 - 0.15, t1: W('day3', 'water') + 1.4, level: 0.3, swell: [[SAY.day3 - 0.15, 1], [W('day3', 'water') + 0.2, 1], [W('day3', 'water') + 1.4, 0.05]] });
  for (let i = 0; i < 4; i++) fx('pop', { t: W('day3', 'water') + 1.5 + i * 0.55, f: 1300, level: 0.12 });
  A.push({ type: 'powerdown', t: W('day3', 'power') + 0.1, level: 0.22, fx: true });
  // day four: the hospital, the generator, the fuel running down
  A.push(S_('sfx/1644.wav', SAY.day4 - 0.2, { dur: 2.2, level: 0.12, fin: 0.3, fout: 0.8, fx: true }));
  for (let i = 0; i < 4; i++) fx('beep', { t: W('day4', 'hospitals') + 0.2 + i * 0.6, f: 1000, n: 1, dur: 0.1, level: 0.1 });
  fx('rumble', { t0: W('day4', 'running'), t1: SAY.week2 - 0.3, level: 0.25, swell: [[W('day4', 'running'), 0.8], [W('day4', 'many'), 0.6], [SAY.week2 - 0.3, 0.2]] });
  fx('count', { t0: W('day4', 'many'), t1: W('day4', 'many') + 2.4, from: 30, to: 14, level: 0.06, seed: 7 });
  // week two: crickets, the neighbours, string lights on the generator
  A.push(S_('sfx/1789.wav', SAY.week2 - 0.2, { dur: SAY.twist - SAY.week2, level: 0.28, fin: 0.3, fout: 0.4, fx: true }));
  A.push({ type: 'crowd', t0: W('week2', 'neighb'), t1: SAY.twist - 0.2, level: 0.08, fx: true, swell: [[W('week2', 'neighb'), 0.4], [SAY.twist - 0.2, 0.8]] });
  fx('pop', { t: W('week2', 'neighb') + 0.05, f: 500, level: 0.18 });
  fx('pop', { t: W('week2', 'water') + 0.05, f: 620, level: 0.18 });
  fx('rumble', { t0: W('week2', 'whatever'), t1: SAY.twist - 0.2, level: 0.15 });
  for (let i = 0; i < 11; i++) fx('ding', { t: W('week2', 'whatever') + 0.1 + i * 0.05, f: 1200 + i * 60, level: 0.05 });
  // the twist
  fx('sample', { file: 'sfx/2915.wav', t: SAY.twist - 0.1, level: 0.35, dur: 1.6, fout: 0.4 });
  fx('sample', { file: 'sfx/1117.wav', t: W('twist', 'hardest') + 0.75, level: 0.3 });
  fx('chime', { t: W('twist', 'turning') + 0.1, level: 0.08, freq: 660 });
  fx('clank', { t: W('twist', 'you') + 0.45, level: 0.4 });
  fx('beep', { t: W('twist', 'you') + 0.8, f: 260, n: 2, drop: 0.85, level: 0.22 });
  for (let i = 0; i < 8; i++) fx('sample', { file: 'sfx/1124.wav', t: W('twist', 'engineers') + 0.2 + i * 0.11, level: 0.12, pan: -0.3 + 0.08 * i });
  RANK.forEach((r) => fx('ding', { t: W('twist', 'piece') + (r * 0.32 + 0.125) / 2.6, f: 700 + r * 90, level: 0.08 }));
  A.push({ type: 'subdrop', t: W('twist', 'some') + 0.1, dur: 0.9, level: 0.3, free: true });
  fx('knock', { t: W('twist', 'years') + 0.1, n: 4, gap: 0.45, level: 0.12 });
  // could it happen
  fx('creak', { t0: SAY.real + 0.1, t1: SAY.real + 0.7, level: 0.12 });
  fx('ding', { t: W('real', 'it') + 0.1, f: 1046.5, level: 0.15 });
  fx('sample', { file: 'sfx/1105.wav', t: W('real', 'in') + 0.05, level: 0.4 });
  A.push({ type: 'powerdown', t: W('real', 'people') + 0.1, level: 0.2, fx: true });
  A.push({ type: 'powerdown', t: W('real', 'and') + 0.6, level: 0.2, fx: true });
  fx('count', { t0: W('real', 'almost'), t1: W('real', 'almost') + 1.1, from: 22, to: 38, level: 0.07, seed: 11 });
  // day thirty: neighbourhood by neighbourhood
  fx('riser', { t0: W('day30', 'the'), t1: W('day30', 'and'), level: 0.14, curve: 2.2 });
  [1, 3, 0, 2].forEach((g) => fx('chime', { t: W('day30', 'the') + 3.4 * (g + 0.2) / 4, level: 0.07, freq: 523.25 * Math.pow(2, g / 6) }));
  A.push(S_('sfx/1789.wav', W('day30', 'and'), { dur: SAY.cta - W('day30', 'and'), level: 0.18, fin: 0.3, fout: 0.4, fx: true }));
  fx('sparkle', { t: W('day30', 'miss') + 0.1, dur: 1.0, count: 8, f: [1600, 4400], level: 0.12, seed: 12 });
  // the question
  for (let i = 0; i < 4; i++) fx('pop', { t: SAY.cta + 0.2 + i * 0.15, f: 600 + i * 120, level: 0.18 });
  fx('ding', { t: W('cta', 'comments') + 0.3, level: 0.15 });
  return A;
}

export default {
  id: 'power-grid',
  title: 'What if the power grid failed for a month?',
  duration: DURATION,
  css: CSS,
  fadeOut: FADE, endAt: 1e9,
  captions: buildCaptions(),
  captionFade: 0.08,
  audio: buildAudio(),
  goal(t) {
    const a = smooth(SAY.day1 - 1.0, SAY.day1 - 0.6, t) * (1 - smooth(SAY.real - 0.3, SAY.real, t)) + smooth(SAY.day30 - 0.3, SAY.day30, t) * (1 - smooth(SAY.cta - 0.3, SAY.cta, t));
    if (a <= 0) return null;
    const d = daysAt(t), day = Math.min(30, Math.floor(d) + 1);
    const ticks = [7, 14, 21, 28].map((n) => ({ k: n / 30, on: d >= n, pop: Math.exp(-Math.pow((d - n) * 1.5, 2)) }));
    if (d >= 29.99) return { label: 'POWER BACK ✓', pct: 'DAY 30', k: 1, from: 'DAY 1', to: 'DAY 30', alpha: a, ticks };
    return { label: 'POWER OUT · NATIONWIDE', pct: `DAY ${day}`, k: d / 30, from: 'DAY 1', to: 'DAY 30', alpha: a, ticks };
  },
  hud: () => null,
  labels: () => [],
  async setup(ctx) {
    ctx.grain = 0.025; ctx.vignette = 0; ctx.handheld = 0;
    ctx.grade = { brightness: 1.0, contrast: 1.0, saturate: 1.0, sepia: 0 };
    const s = document.createElement('style'); s.textContent = this.css; document.head.appendChild(s);
    const ui = document.getElementById('ui');
    this.el = document.createElement('div'); this.el.id = 'ill';
    ui.insertBefore(this.el, ui.firstChild);
  },
  update(ctx, t) {
    this.el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">${I.DEFS}${frameSVG(t)}</svg>`;
  },
};
export const _debug = { SAY, DURATION, S, wordT };
// the illustration at time t, for the cover page (thumbs/power-grid.html)
export const svgAt = (t) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">${I.DEFS}${frameSVG(t)}</svg>`;
