// What if the internet went down for a week? — the illustrated version.
// Every sentence (often every phrase) has its own flat vector illustration, timed to the word it shows (scenarios/ill2d.js).
// Voice: audio/narrate_cb.py (expressive voice model cloned from the channel voice), word timings from Whisper.
// Facts: ITU 2024 (5.5 billion people online); CrowdStrike outage, 19 July 2024 (~5,000 flights cancelled that day, Cirium);
// NetBlocks/COST estimates of a global outage (~$43 billion a day); TeleGeography (hundreds of undersea cable systems).
import VO from './internet-down-2d.vo.js';
import * as I from './ill2d.js';

const { C, ease, clamp, lerp, hash } = I;

// ------------------------------------------------------------------ the story, timed by the narration
const ORDER = ['hook', 'intro', 'relate', 'day1', 'cash', 'day2', 'day3', 'twist', 'day5', 'cost', 'real', 'day7', 'cta'];
const GAP = { hook: 0.1, intro: 0.25, relate: 0.35, day1: 1.0, cash: 0.3, day2: 0.45, day3: 0.4, twist: 0.4, day5: 0.45, cost: 0.3, real: 0.35, day7: 0.45, cta: 0.35 };
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
const NUMS = [['forty-three billion dollars', '$43B (€40B)'], ['43 billion dollars', '$43B (€40B)'], ['43 billion', '$43B (€40B)'], ['2024', '2024'], ['ten seconds', '10 SECONDS'], ['seven days', '7 DAYS']];
const KEYWORDS = /^(died|entire|wifi|phone|everywhere|week|panic|seconds|days|nothing|messages|maps|spinning|coffee|declined|cash|offices|home|grounded|thousands|flights|shelves|fresh|crazy|gps|satellites|radio|works|call|wild|knock|talk|billion|impossible|cables|ocean|cut|around|back|notification|once|last|comments)$/i;
function buildCaptions() {
  const out = [];
  for (const key of ORDER) {
    const at = SAY[key];
    let ws = [];
    for (const [w, s, e] of VO[key].words) { if (ws.length && /^[-']/.test(w)) { const p = ws[ws.length - 1]; p[0] += w; p[2] = e; } else ws.push([w, s, e, false]); }
    for (const [sayd, show] of NUMS) {
      const k = sayd.replace(/-/g, ' ').split(' ');
      for (let i = 0; i + k.length <= ws.length; i++) {
        if (k.every((x, j) => ws[i + j][0].toLowerCase().replace(/[^a-z0-9]/g, '') === x.replace(/[^a-z0-9]/g, ''))) {
          const p = ws[i + k.length - 1][0].match(/[,.?!…]+$/)?.[0] ?? '';
          ws.splice(i, k.length, [show + p, ws[i][1], ws[i + k.length - 1][2], true]);
        }
      }
      // "forty-three" may come as one word
      for (let i = 0; i + 2 < ws.length; i++) if (sayd.startsWith('forty') && /^forty.?three$/i.test(ws[i][0].replace(/[^a-z-]/gi, '')) && /^billion/i.test(ws[i + 1][0])) {
        const p = ws[i + 2][0].match(/[,.?!…]+$/)?.[0] ?? ''; ws.splice(i, 3, [show + p, ws[i][1], ws[i + 2][2], true]);
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
#goal .fill { background: linear-gradient(90deg, #ff6b6b, #ffb347); } #goal .dot { box-shadow: 0 0 16px rgba(255,120,90,0.95), 0 0 0 4px #ff6b6b; }
#goal .tick.on { background: #ff8a6b; box-shadow: 0 0 10px rgba(255,120,90,0.9), 0 0 0 2px rgba(0,0,0,0.25); }`;

// the week on the day bar
const DAYS = [[SAY.day1 - 0.9, 0], [SAY.day2 - 0.2, 1], [SAY.day3 - 0.2, 2], [SAY.twist, 3.2], [SAY.day5 - 0.2, 4], [SAY.cost, 5], [SAY.day7 - 0.2, 6], [W('day7', 'it') + 0.3, 7]];
function daysAt(t) {
  if (t <= DAYS[0][0]) return 0;
  for (let i = 0; i < DAYS.length - 1; i++) { const [t0, a] = DAYS[i], [t1, b] = DAYS[i + 1]; if (t <= t1) return lerp(a, b, (t - t0) / (t1 - t0)); }
  return 7;
}

// ------------------------------------------------------------------ the pictures: one per phrase, [start, draw(t, u), sound cues]
const S = [];
const at = (t0, draw) => S.push([t0, draw]);
const night = (glow, gy) => I.bg('#0e1530', '#1d2a55', glow, gy);
const room = () => `${I.bg('#1d1b45', '#3b2d5c')}
  <rect x="120" y="420" width="420" height="520" rx="18" fill="url(#dawnSky)"/><circle cx="330" cy="840" r="90" fill="#ffd27a" opacity="0.9"/>
  ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="120" y="${440 + i * 80}" width="420" height="10" fill="#1d1b45" opacity="0.35"/>`).join('')}
  <rect x="104" y="404" width="452" height="552" rx="24" fill="none" stroke="#2b2858" stroke-width="22"/>
  <rect x="0" y="1060" width="1080" height="860" fill="#2a2148"/>
  <rect x="560" y="1000" width="440" height="40" rx="12" fill="url(#woodTop)"/><rect x="590" y="1040" width="380" height="300" fill="${C.woodD}"/>`;
const cafe = () => `${I.bg('#2b1c18', '#4a2d22', '#ff9a52', 760)}
  <g opacity="0.9"><rect x="140" y="420" width="800" height="200" rx="24" fill="#1d1411"/>
  <text x="540" y="490" font-family="MontB" font-weight="900" font-size="50" fill="#f4efe8" text-anchor="middle">MENU</text>
  <text x="250" y="570" font-family="InterW" font-weight="700" font-size="34" fill="#d8cbb8">COFFEE</text><text x="830" y="570" font-family="InterW" font-weight="700" font-size="34" fill="#d8cbb8" text-anchor="end">$4.90</text></g>
  <rect x="0" y="1090" width="1080" height="830" fill="#3a2419"/><rect x="0" y="1060" width="1080" height="56" fill="url(#woodTop)"/>`;
const street = (t) => `${I.bg('#7cc7ff', '#cfeaff')}<circle cx="860" cy="560" r="80" fill="#fff3b0"/>
  <rect y="1130" width="1080" height="790" fill="#8bc77b"/><rect y="1180" width="1080" height="120" fill="#9aa3b8"/>
  ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${i * 200 + ((t * 20) % 200) - 200}" y="1234" width="100" height="12" rx="6" fill="#fff"/>`).join('')}`;
const PHONE = { x: 540, y: 815, s: 1.05 };

// ---------- the hook
at(0, (t, u) => `${I.bg('#3e4fa8', '#f08a6a', '#ffd27a', 1000)}<circle cx="540" cy="1020" r="${150 + 10 * Math.sin(t * 2)}" fill="#ffe09a"/>
  <g>${I.cityline(1240, t, 1, '#1b2550', 3)}</g><rect y="1240" width="1080" height="680" fill="#141d40"/>
  ${I.wifi(540, 560, 3.2 + 0.15 * Math.sin(t * 3), '#ffffff', false, 1 + Math.floor((t * 3) % 3))}`);
at(W('hook', 'entire'), (t, u) => `${night('#2f7bff', 800)}${I.globe(540, 800, 330, t, { lines: ease.out(u / 0.5), spin: t * 0.15 })}`);
at(W('hook', 'died'), (t, u) => { const d = ease.out(u / 0.6), sh = 22 * Math.exp(-u * 5);
  return `${night('#ff3b3b', 800)}<g transform="translate(${I.wobble(t, 30, sh)} ${I.wobble(t, 30, sh, 2)})">${I.globe(540, 800, 330, t, { dark: d * 1.2, lines: 1 - d, spin: t * 0.15 })}</g>
  <rect width="1080" height="1920" fill="#fff" opacity="${0.7 * Math.exp(-u * 9)}"/>`; });
// ---------- what the video is about
at(W('intro', 'not'), (t, u) => `${night('#7fe8ff', 800)}${I.router(540, 900, 1.3, t, u > 0.35)}${I.xmark(780, 640, 0.9, u - 0.35)}`);
at(W('intro', 'not', 1), (t, u) => `${night('#2f7bff', 800)}${I.phone({ x: 540, y: 820, s: 0.9, rot: -6 + 3 * Math.sin(t * 2), id: 'np', screen: I.screenNoInternet(t) })}${I.xmark(770, 560, 0.9, u - 0.25)}`);
at(W('intro', 'all'), (t, u) => `${night('#4aa8ff', 800)}${I.globe(540, 800, 340, t, { dark: ease.inOut(u / 1.4) * 1.15, spin: t * 0.15 })}`);
at(W('intro', 'for'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ff5e5b', 820)}${I.calendar(540, 820, 1, t, Math.floor(u * 7), -1)}`);
at(W('intro', 'heres'), (t, u) => {
  const kinds = ['phone', 'plane', 'cart', 'radio', 'door', 'bell'], pts = [[250, 520], [780, 620], [300, 780], [780, 900], [280, 1060], [760, 1180]];
  let path = `M 540 420`; pts.forEach(([x, y]) => (path += ` L ${x} ${y}`));
  const shown = Math.floor(u / 0.3);
  return `${night('#ffd84a', 820)}<path d="${path}" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round" opacity="0.5"/>
  ${pts.map(([x, y], i) => i <= shown ? `${I.icon(kinds[i], x, y, ease.back((u - i * 0.3) / 0.3))}<text x="${x + (x < 540 ? 90 : -90)}" y="${y + 14}" font-family="MontB" font-weight="900" font-size="40" fill="#fff" text-anchor="${x < 540 ? 'start' : 'end'}" opacity="${clamp((u - i * 0.3) * 4)}">DAY ${[1, 2, 3, 4, 5, 7][i]}</text>` : '').join('')}`;
});
// ---------- the shared feeling
at(W('relate', 'you'), (t, u) => { const lvl = Math.max(0, 3 - Math.floor(u * 1.6)), panic = u > 1.5;
  return `${I.bg('#2b2260', '#463a8c', '#ffd84a', 760)}
  ${I.person(540, 1278, 1.3, { shirt: C.teal, pose: panic ? 'panic' : 'stand', face: panic ? 'panic' : 'neutral', t })}${I.couch(540, 1160, 1.2)}
  <g transform="translate(540 420)">${I.wifi(0, 0, 1.6, lvl ? '#fff' : C.red, !lvl, lvl)}</g>
  <g transform="translate(540 560)"><rect x="-200" y="-18" width="400" height="36" rx="18" fill="#000" opacity="0.35"/><rect x="-200" y="-18" width="${400 * ((u * 0.7) % 1)}" height="36" rx="18" fill="${C.yellow}"/></g>`; });
at(W('relate', 'yeah'), (t, u) => `${I.bg('#3a1430', '#7a2a4a', '#ff5e5b', 820)}${I.person(540, 1500, 2.1, { shirt: C.teal, pose: 'panic', face: 'panic', t })}
  <text x="540" y="560" font-family="MontB" font-weight="900" font-size="150" fill="#fff" text-anchor="middle" stroke="#000" stroke-width="10" paint-order="stroke">0:${String(Math.max(0, 10 - Math.floor(u * 6))).padStart(2, '0')}</text>`);
at(W('relate', 'now'), (t, u) => { const k = ease.back((u - 0.35) / 0.3);
  return `${night('#ff5e5b', 820)}<g opacity="${1 - clamp((u - 0.3) * 5)}"><text x="540" y="840" font-family="MontB" font-weight="900" font-size="130" fill="#fff" text-anchor="middle">10 SEC</text>
  <line x1="200" y1="800" x2="880" y2="800" stroke="${C.red}" stroke-width="22" stroke-linecap="round" stroke-dasharray="700" stroke-dashoffset="${700 * (1 - clamp(u / 0.25))}"/></g>
  <g transform="translate(540 860) scale(${k})" opacity="${clamp((u - 0.35) * 6)}"><text font-family="MontB" font-weight="900" font-size="220" fill="${C.yellow}" text-anchor="middle" stroke="#000" stroke-width="12" paint-order="stroke">7 DAYS</text></g>`; });
// ---------- day one
at(SAY.day1 - 0.95, (t, u) => `${room()}${I.alarmClock(800, 930, 1, t)}${I.phone({ x: 700, y: 990, s: 0.36, rot: -90, id: 'nite', screen: I.screenLock(t) })}${I.stamp('DAY 1', u, 600)}`);
at(W('day1', 'you'), (t, u) => { const k = ease.out(u / 0.75);
  return `${room()}${I.alarmClock(800, 930, 1, t)}${I.heldPhone({ x: lerp(820, PHONE.x, k), y: lerp(1700, PHONE.y, k), s: lerp(0.8, PHONE.s, k), rot: lerp(28, -3, k), id: 'wake', screen: I.screenLock(t), light: 0.25 * (1 - clamp(u * 3)) })}`; });
at(W('day1', 'nothing'), (t, u) => { const sh = 14 * Math.exp(-u * 7);
  return `${night('#ff5e5b', 800)}${I.heldPhone({ ...PHONE, x: PHONE.x + I.wobble(t, 40, sh), rot: -2, id: 'none', screen: I.screenNoInternet(t) })}`; });
at(W('day1', 'messages'), (t, u) => `${night('#2f7bff', 800)}${I.heldPhone({ ...PHONE, rot: 2 + Math.sin(t * 1.5), id: 'msg', screen: I.screenMessages(t, u) })}`);
at(W('day1', 'maps'), (t, u) => `${night('#2fd3c4', 800)}${I.heldPhone({ ...PHONE, rot: -2 + Math.sin(t * 1.5), id: 'map', screen: I.screenMaps(t, u) })}`);
at(W('day1', 'your', 1), (t, u) => `${night('#34c759', 800)}${I.heldPhone({ ...PHONE, rot: 2 + Math.sin(t * 1.5), id: 'bank', screen: I.screenBank(t, u) })}`);
// ---------- the coffee
at(SAY.cash, (t, u) => `${cafe()}${I.cup(330, 960, 1.15, t)}${I.terminal(720, 830, 1, { t })}`);
at(W('cash', 'card'), (t, u) => { const k = ease.out(u / 0.45);
  return `${cafe()}${I.cup(330, 960, 1.15, t)}${I.terminal(720, 830, 1, { t })}${I.handCard(lerp(1300, 880, k), 880 + 8 * Math.sin(t * 6) * (1 - k), 1, -6)}`; });
at(W('cash', 'declined'), (t, u) => { const sh = 18 * Math.exp(-u * 6);
  return `${cafe()}<rect width="1080" height="1920" fill="${C.red}" opacity="${0.35 * Math.exp(-u * 5)}"/>${I.terminal(540 + I.wobble(t, 40, sh), 820, 1.45, { state: 'declined', t })}`; });
at(W('cash', 'cash'), (t, u) => { const drop = ease.back(u / 0.4), sw = 12 * Math.exp(-u * 2.5) * Math.cos(u * 9);
  return `${cafe()}${I.cup(330, 960, 1.15, t)}${I.sign(540, lerp(-200, 840, drop), 1, sw)}`; });
at(W('cash', 'and'), (t, u) => `${night('#ffd84a', 820)}${I.wallet(540, 860, 1.05 + 0.04 * ease.out(u / 2), t, clamp((u - 0.5) / 2))}`);
// ---------- day two
at(SAY.day2 - 0.15, (t, u) => `${I.bg('#2a2a5c', '#e07a5f')}${I.cityline(1260, t, 0.3, '#232a55', 7)}<rect y="1260" width="1080" height="660" fill="#141a38"/>${I.officeBuilding(540, 1260, 0.95, t, 0.3)}${I.stamp('DAY 2', u, 560)}`);
at(W('day2', 'offices'), (t, u) => `${I.bg('#2a2a5c', '#e07a5f')}<rect y="1260" width="1080" height="660" fill="#141a38"/>${I.officeBuilding(540, 1260, 0.95, t, clamp(u / 2))}
  ${[0, 1, 2].map((i) => { const p = clamp((u - i * 0.3) / 2.2); return p > 0 ? I.person(540 + (i % 2 ? 1 : -1) * (120 + p * 420), 1360, 0.8, { shirt: [C.coral, C.teal, C.yellow][i], pose: 'walk', t, seed: i, flip: i % 2 ? 1 : -1 }) : ''; }).join('')}`);
at(W('day2', 'flights'), (t, u) => `${night('#ff5e5b', 800)}${I.board(540, 820, 1.05, t, u)}`);
at(W('day2', 'grounded'), (t, u) => `${I.bg('#7cc7ff', '#d6efff')}<rect y="1050" width="1080" height="870" fill="#5c6478"/>${[0, 1, 2, 3].map((i) => `<rect x="${i * 300 + 40}" y="1180" width="160" height="16" rx="8" fill="#fff"/>`).join('')}
  ${I.plane(540, 980, 1.35, 0)}<g transform="translate(540 600) rotate(-8) scale(${ease.back((u - 0.15) / 0.3)})" opacity="${clamp((u - 0.15) * 6)}">
  <rect x="-300" y="-80" width="600" height="160" rx="20" fill="none" stroke="${C.red}" stroke-width="16"/><text y="34" font-family="MontB" font-weight="900" font-size="104" fill="${C.red}" text-anchor="middle">GROUNDED</text></g>`);
at(W('day2', 'this'), (t, u) => { const k = ease.out(u / 0.6);
  return `${night('#ffd84a', 820)}${I.newspaper(540, 860, lerp(0.2, 1.0, k), lerp(-540, -4, k))}`; });
at(W('day2', 'one'), (t, u) => `${I.bg('#0b2a5a', '#1665c0', '#7fb8ff', 820)}${I.laptopBSOD(540, 860, 1.1, t, u)}`);
at(W('day2', 'thousands'), (t, u) => { const n = Math.floor(u * 24);
  let g = ''; for (let i = 0; i < 24; i++) { const x = 220 + (i % 4) * 213, y = 560 + Math.floor(i / 4) * 105; g += `<g transform="translate(${x} ${y}) scale(0.24)">${I.plane(0, 0, 1, 0, i < n ? C.red : '#e9ecf3')}</g>`; }
  return `${night('#ff5e5b', 820)}${g}<text x="540" y="1290" font-family="MontB" font-weight="900" font-size="88" fill="#fff" text-anchor="middle" stroke="#000" stroke-width="8" paint-order="stroke">${(Math.min(5000, Math.round(ease.out(u / 1.6) * 5000))).toLocaleString('en-US')}+ FLIGHTS</text>`; });
// ---------- day three
at(SAY.day3 - 0.15, (t, u) => `${I.bg('#e8f0ff', '#c9d6f0')}${I.shelves(540, 900, 0.95, t, 1, 1)}${I.stamp('DAY 3', u, 560)}`);
at(W('day3', 'shelves'), (t, u) => `${I.bg('#e8f0ff', '#c9d6f0')}${I.shelves(540, 900, 0.95, t, 1 - ease.inOut(u / 1.6) * 0.8, 1 - ease.inOut(u / 1.6) * 0.6)}`);
at(W('day3', 'fresh'), (t, u) => `${I.bg('#e8f0ff', '#c9d6f0')}<g transform="translate(540 900) scale(${1 + 0.35 * ease.inOut(u / 0.6)}) translate(-540 ${-900 - 260 * ease.inOut(u / 0.6)})">${I.shelves(540, 900, 0.95, t, 0.2, 0.4 - ease.out(u / 1.2) * 0.4)}</g>`);
// ---------- the twist
at(SAY.twist - 0.1, (t, u) => `${I.bg('#120a2e', '#3a1a6b', '#c77dff', 820)}${[...Array(40)].map((_, i) => `<circle cx="${hash(i, 1) * 1080}" cy="${hash(i, 2) * 1300 + 300}" r="${2 + hash(i, 3) * 3}" fill="#fff" opacity="${0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))}"/>`).join('')}
  <g transform="translate(540 820) rotate(${u * 40})" opacity="0.5">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M 0 0 L ${Math.cos(i) * 600} ${Math.sin(i) * 600}" stroke="#c77dff" stroke-width="40" opacity="0.3"/>`).join('')}</g>${I.stamp('THE TWIST', u, 860)}`);
at(W('twist', 'your'), (t, u) => `${night('#2f7bff', 800)}${I.heldPhone({ ...PHONE, rot: -2 + Math.sin(t * 1.5), id: 'gps', screen: I.screenGPS(t, u) })}${I.check(820, 520, 0.8, u - 0.6)}`);
at(W('twist', 'because'), (t, u) => { const b = ease.out((u - 0.3) / 0.5);
  return `${I.bg('#050a1e', '#0b1a44')}${[...Array(50)].map((_, i) => `<circle cx="${hash(i, 4) * 1080}" cy="${hash(i, 5) * 1920}" r="${1.5 + hash(i, 6) * 2.5}" fill="#fff" opacity="0.7"/>`).join('')}
  ${I.globe(540, 1700, 700, t, { spin: t * 0.05 })}<path d="M ${540 - 40} 640 L ${380} ${640 + 600 * b} L ${700} ${640 + 600 * b} L ${540 + 40} 640 Z" fill="${C.teal}" opacity="${0.35 * b}"/>
  ${I.satellite(540 + 30 * Math.sin(t * 0.8), 560, 0.85, t)}${I.phone({ x: 540, y: 1180, s: 0.32, id: 'mini', screen: I.screenGPS(t, u) })}`; });
at(W('twist', 'old'), (t, u) => `${I.bg('#3b1d10', '#7a3f1d', '#ffb347', 860)}${I.radio(500, 880, 1.15, t)}`);
at(W('twist', 'normal'), (t, u) => `${night('#34c759', 800)}${I.heldPhone({ ...PHONE, rot: 2 + Math.sin(t * 1.5), id: 'call', screen: I.screenCall(t, u) })}`);
// ---------- day five
at(SAY.day5 - 0.15, (t, u) => `${street(t)}${I.house(260, 1140, 1)}${I.house(800, 1140, 1, '#9ad1ff', '#2f5fbf')}${I.stamp('DAY 5', u, 560)}`);
at(W('day5', 'people'), (t, u) => { const o = ease.out(u / 0.5);
  return `${street(t)}${I.house(260, 1140, 1, '#ffb27a', '#c0392b', o)}${I.house(800, 1140, 1, '#9ad1ff', '#2f5fbf', o)}
  ${I.person(lerp(345, 420, ease.out((u - 0.3) / 0.8)), 1170, 0.55, { shirt: C.yellow, pose: u > 1.1 ? 'stand' : 'walk', t, seed: 1 })}${I.person(lerp(885, 700, ease.out((u - 0.4) / 0.8)), 1170, 0.55, { shirt: C.coral, pose: u > 1.2 ? 'stand' : 'walk', t, seed: 2, flip: -1 })}
  ${I.bubbleSay(540, 640, 1, u - 0.5, '?!', C.yellow)}`; });
at(W('day5', 'they'), (t, u) => { const knock = Math.max(0, Math.sin(t * 18)) * (u < 1.6 ? 1 : 0);
  return `${I.bg('#ffb27a', '#e07a5f')}<g filter="url(#drop)"><rect x="240" y="380" width="600" height="1000" rx="20" fill="#5a3a26"/></g>
  <rect x="290" y="440" width="230" height="380" rx="14" fill="#6b4630"/><rect x="560" y="440" width="230" height="380" rx="14" fill="#6b4630"/><rect x="290" y="880" width="230" height="440" rx="14" fill="#6b4630"/><rect x="560" y="880" width="230" height="440" rx="14" fill="#6b4630"/>
  <circle cx="770" cy="880" r="22" fill="${C.yellow}"/>
  <g transform="translate(${620 - knock * 40} 760)"><rect x="-40" y="-70" width="180" height="140" rx="60" fill="${C.skin}"/>${[0, 1, 2, 3].map((i) => `<rect x="-58" y="${-62 + i * 34}" width="60" height="30" rx="15" fill="${C.skinS}"/>`).join('')}<rect x="120" y="-40" width="260" height="90" fill="${C.sleeve}"/></g>
  ${['KNOCK', 'KNOCK'].map((k, i) => `<text x="${330 + i * 120}" y="${600 + i * 90}" font-family="MontB" font-weight="900" font-size="76" fill="#fff" stroke="#000" stroke-width="8" paint-order="stroke" opacity="${clamp((u - 0.15 - i * 0.3) * 6)}" transform="rotate(-10 ${330 + i * 120} ${600 + i * 90})">${k}!</text>`).join('')}`; });
at(W('day5', 'and'), (t, u) => `${street(t)}${I.house(260, 1140, 1, '#ffb27a', '#c0392b', 1)}${I.house(800, 1140, 1, '#9ad1ff', '#2f5fbf', 1)}
  ${I.person(400, 1240, 0.75, { shirt: C.yellow, pose: 'talk', t, seed: 1 })}${I.person(680, 1240, 0.75, { shirt: C.coral, pose: 'talk', t, seed: 4, flip: -1 })}
  ${I.bubbleSay(330, 700, 0.95, u - 0.2, 'Hi! 👋')}${I.bubbleSay(760, 610, 0.95, u - 0.7, 'Wifi out too?')}`);
at(W('day5', 'like'), (t, u) => `${street(t)}${I.house(260, 1140, 1, '#ffb27a', '#c0392b', 1)}${I.house(800, 1140, 1, '#9ad1ff', '#2f5fbf', 1)}
  ${[[230, C.teal], [400, C.yellow], [560, '#c77dff'], [700, C.coral], [860, C.green]].map(([x, col], i) => I.person(x, 1260, 0.62, { shirt: col, pose: i % 2 ? 'cheer' : 'talk', face: 'happy', t, seed: i, flip: i > 2 ? -1 : 1 })).join('')}
  ${[0, 1, 2, 3].map((i) => { const p = (t * 0.6 + i / 4) % 1; return `<text x="${200 + i * 220}" y="${900 - p * 300}" font-size="70" opacity="${1 - p}">${['❤️', '😂', '💬', '❤️'][i]}</text>`; }).join('')}`);
// ---------- the cost
at(SAY.cost, (t, u) => `${night('#34c759', 820)}${I.globe(540, 860, 300, t, { dark: 1, spin: t * 0.1 })}
  ${[...Array(10)].map((_, i) => { const p = (u * 0.8 + i / 10) % 1, a = i * 0.63; return I.cash(540 + Math.cos(a) * (200 + p * 360), 860 + Math.sin(a) * (200 + p * 360) - p * 200, 0.5, i * 37 + t * 60); }).join('')}`);
at(W('cost', 'forty'), (t, u) => { const v = Math.round(ease.out(u / 1.1) * 43);
  return `${night('#34c759', 820)}${[...Array(12)].map((_, i) => I.cash(540 + (i % 3 - 1) * 60, 1300 - i * 22 * clamp(u * 2), 1, (i % 2 ? 4 : -4))).join('')}
  <text x="540" y="760" font-family="MontB" font-weight="900" font-size="230" fill="#7dffa6" text-anchor="middle" stroke="#000" stroke-width="12" paint-order="stroke">$${v}B</text>
  <text x="540" y="860" font-family="MontB" font-weight="900" font-size="64" fill="#fff" text-anchor="middle" opacity="${clamp((u - 0.6) * 4)}">(€40B) EVERY DAY</text>`; });
// ---------- could it happen?
at(SAY.real, (t, u) => `${night('#2f7bff', 820)}${I.globe(540, 880, 320, t, { lines: 1, spin: t * 0.12 })}
  <text x="540" y="${560 + 10 * Math.sin(t * 4)}" font-family="MontB" font-weight="900" font-size="300" fill="${C.yellow}" text-anchor="middle" stroke="#000" stroke-width="12" paint-order="stroke" transform="rotate(${6 * Math.sin(t * 3)} 540 460)">?</text>`);
at(W('real', 'honestly'), (t, u) => { const a = W('real', 'almost') - W('real', 'honestly'), v = u < a ? 0.5 + 0.35 * Math.sin(u * 9) : lerp(0.85, 0.08, ease.elastic((u - a) / 0.9));
  return `${night('#34c759', 880)}${I.gauge(540, 1000, 1.25, v, u > a ? 'ALMOST IMPOSSIBLE' : 'CHANCE')}`; });
at(W('real', 'internet'), (t, u) => `${I.ocean(t, u)}<text x="540" y="380" font-family="MontB" font-weight="900" font-size="60" fill="#fff" text-anchor="middle" stroke="#000" stroke-width="8" paint-order="stroke" opacity="${clamp((u - 0.4) * 4)}">~600 CABLES</text>`);
at(W('real', 'cut'), (t, u) => `${I.ocean(t, u, { cut: clamp(u / 0.3) })}<rect width="1080" height="1920" fill="#fff" opacity="${0.5 * Math.exp(-u * 10)}"/>`);
at(W('real', 'and'), (t, u) => `${I.ocean(t, u, { cut: 1, reroute: 1 })}${I.check(860, 360, 0.7, u - 0.5)}`);
// ---------- day seven
at(SAY.day7 - 0.15, (t, u) => `${I.bg('#05081a', '#0e1530')}${I.cityline(1300, t, 0, '#141b3a', 11)}<rect y="1300" width="1080" height="620" fill="#0b1026"/>${I.stamp('DAY 7', u, 600)}`);
at(W('day7', 'it'), (t, u) => { const on = ease.out(u / 1.0);
  return `${I.bg('#0b1533', '#25356b', '#ffd27a', 1000)}${I.cityline(1300, t, on, '#1b2550', 11)}<rect y="1300" width="1080" height="620" fill="#141d40"/>
  ${I.wifi(540, 620, 3, '#7fe8ff', false, Math.min(3, Math.floor(u * 4)))}`; });
at(W('day7', 'every'), (t, u) => { const tSingle = W('day7', 'single') - W('day7', 'every'), tNote = W('day7', 'notification') - W('day7', 'every');
  const z = u > tNote ? 1.25 : u > tSingle ? 1.12 : 1, n = Math.floor(u * 8);
  return `${I.bg('#3a1a6b', '#ff5e5b', '#ffd84a', 820)}<g transform="translate(540 815) scale(${z}) translate(-540 -815)">${I.heldPhone({ ...PHONE, rot: I.wobble(t, 24, 2 + u * 2), id: 'notif', screen: I.notifStorm(t, u * 1.3) })}</g>
  ${[...Array(Math.min(16, n))].map((_, i) => I.badge(120 + hash(i, 7) * 840, 420 + hash(i, 8) * 860, 0.7 + 0.4 * hash(i, 9), ['3', '12', '47', '99+', '128', '999+'][i % 6])).join('')}`; });
// ---------- the question
at(SAY.cta, (t, u) => `${night('#ffd84a', 860)}${I.commentBox(540, 860, 1, t, u)}`);
at(W('cta', 'tell'), (t, u) => `${night('#ffd84a', 860)}${I.commentBox(540, 800, 0.9, t, 2)}
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
function buildAudio() {
  const A = [], fx = (type, o) => A.push(Object.assign({ type, fx: true }, o));
  const keysEvery = (f, step = 0.05) => { const ks = []; for (let t = 0; t <= DURATION; t += step) ks.push([+t.toFixed(2), +f(t).toFixed(3)]); return ks; };
  for (const key of ORDER) A.push(S_(VO[key].file, SAY[key], { level: 1.35, free: true, verb: 0.02, fin: 0.005, fout: 0.03 }));
  const talking = (t) => { let q = 0; for (const key of ORDER) { const a = SAY[key]; q = Math.max(q, smooth(a - 0.3, a - 0.05, t) * (1 - smooth(a + VO[key].dur, a + VO[key].dur + 0.35, t))); } return q; };
  A.push({ type: 'fxduck', keys: keysEvery((t) => 1 - 0.45 * talking(t), 0.04) });
  // music: tension until the twist, then warmer
  A.push(S_('music/464.mp3', 0, { offset: 4, level: 0.5, fin: 0.2, fout: 1.2, dur: SAY.twist + 0.6, keys: keysEvery((t) => 1 - 0.68 * talking(t)) }));
  A.push(S_('music/606.mp3', SAY.twist - 0.3, { offset: 14, level: 0.5, fin: 0.8, fout: 1.2, dur: DURATION - SAY.twist + 0.3, keys: keysEvery((t) => 1 - 0.66 * talking(t)) }));
  // a whoosh into every new picture
  CUTS.forEach((c, i) => { if (i) fx('sample', { file: i % 2 ? 'sfx/2605.wav' : 'sfx/1490.wav', t: c - 0.12, level: 0.11, pan: -0.3 + 0.6 * hash(i, 3) }); });
  // hook
  A.push(S_('sfx/2678.wav', 0, { dur: W('hook', 'died'), level: 0.25, fin: 0.1, fout: 0.2 }));
  fx('sample', { file: 'sfx/1022.wav', t: W('hook', 'died') + 0.05, level: 0.45 });
  A.push({ type: 'subdrop', t: W('hook', 'died') + 0.05, dur: 1.0, level: 0.4, free: true });
  // intro: two red X's, the world going dark, the calendar, the road map
  fx('beep', { t: W('intro', 'not') + 0.35, f: 330, n: 2, drop: 0.8, level: 0.25 });
  fx('beep', { t: W('intro', 'not', 1) + 0.25, f: 330, n: 2, drop: 0.8, level: 0.25 });
  A.push({ type: 'powerdown', t: W('intro', 'all') + 0.1, level: 0.2, fx: true });
  for (let i = 0; i < 7; i++) fx('pop', { t: W('intro', 'for') + i / 7 + 0.05, f: 500 + i * 60, level: 0.2 });
  for (let i = 0; i < 6; i++) fx('pop', { t: W('intro', 'heres') + i * 0.3, f: 700 + i * 90, level: 0.2 });
  // the shared panic: the wifi dropping, a heartbeat, the 7 DAYS slam
  fx('beep', { t: W('relate', 'you') + 0.6, f: 900, n: 3, drop: 0.75, dur: 0.1, level: 0.16 });
  A.push(S_('sfx/493.wav', W('relate', 'panic'), { dur: W('relate', 'now') - W('relate', 'panic'), level: 0.35, fin: 0.2, fout: 0.3 }));
  A.push(S_('sfx/2896.wav', W('relate', 'now') + 0.35, { level: 0.35, free: true, dur: 1.4, fout: 0.5 }));
  // day one: alarm, the phone, the errors
  STAMP_T.forEach(([t0], i) => { fx('sample', { file: 'sfx/2604.wav', t: t0 - 0.2, level: i ? 0.14 : 0.25 }); A.push({ type: 'subdrop', t: t0 + 0.04, dur: 0.7, level: i ? 0.25 : 0.38, free: true }); });
  fx('beep', { t: SAY.day1 - 0.3, f: 1250, n: 4, dur: 0.08, gap: 0.08, level: 0.12 });
  fx('sample', { file: 'sfx/2380.wav', t: W('day1', 'you'), level: 0.3 });
  fx('buzz', { t: W('day1', 'grab'), n: 1, level: 0.25 });
  fx('beep', { t: W('day1', 'nothing') + 0.02, f: 260, n: 2, drop: 0.85, level: 0.22 });
  fx('pop', { t: W('day1', 'messages') + 0.3, f: 900, level: 0.18 });
  fx('beep', { t: W('day1', 'messages') + 0.6, f: 300, n: 1, dur: 0.18, level: 0.18 });
  fx('pop', { t: W('day1', 'maps') + 0.1, f: 700, level: 0.18 });
  // the coffee
  A.push({ type: 'crowd', t0: SAY.cash, t1: SAY.day2 - 0.4, level: 0.08, fx: true, swell: [[SAY.cash, 0.5], [SAY.day2 - 0.4, 0.5]] });
  fx('beep', { t: W('cash', 'card') + 0.5, f: 1500, n: 1, dur: 0.09, level: 0.2 });
  fx('beep', { t: W('cash', 'declined') + 0.03, f: 300, n: 2, drop: 0.8, dur: 0.16, level: 0.3 });
  fx('clank', { t: W('cash', 'cash') + 0.3, level: 0.3 });
  fx('rustle', { t0: W('cash', 'and') + 0.6, t1: W('cash', 'and') + 1.6, level: 0.12 });
  // day two
  fx('clank', { t: W('day2', 'offices') + 0.3, level: 0.25 });
  for (let i = 0; i < 6; i++) fx('sample', { file: 'sfx/1117.wav', t: W('day2', 'flights') + 0.12 * i + 0.1, level: 0.2, pan: -0.3 + i * 0.12 });
  A.push({ type: 'powerdown', t: W('day2', 'grounded'), level: 0.25, fx: true });
  fx('sample', { file: 'sfx/1105.wav', t: W('day2', 'this') + 0.05, level: 0.4 });
  fx('beep', { t: W('day2', 'one') + 0.4, f: 520, n: 2, drop: 0.9, level: 0.18 });
  fx('count', { t0: W('day2', 'thousands'), t1: W('day2', 'thousands') + 1.6, from: 18, to: 34, level: 0.08, seed: 3 });
  // day three: things vanishing off the shelves
  for (let i = 0; i < 14; i++) fx('pop', { t: W('day3', 'shelves') + i * 0.12, f: 400 + hash(i, 1) * 500, level: 0.1, pan: -0.5 + hash(i, 2) });
  // the twist
  fx('sample', { file: 'sfx/546.wav', t: SAY.twist - 0.1, level: 0.4 });
  fx('chime', { t: W('twist', 'works') + 0.2, level: 0.08, freq: 880 });
  fx('sparkle', { t: W('twist', 'satellites') + 0.5, dur: 1.2, count: 8, f: [1600, 4200], level: 0.12, seed: 8 });
  A.push(S_('sfx/2563.wav', W('twist', 'old') + 0.1, { dur: 1.3, level: 0.25, fin: 0.05, fout: 0.3, fx: true }));
  fx('beep', { t: W('twist', 'normal') + 0.1, f: 440, n: 2, dur: 0.35, gap: 0.25, level: 0.12 });
  fx('ding', { t: W('twist', 'through') + 0.1, f: 1046.5, level: 0.15 });
  // day five: the neighbours
  A.push(S_('sfx/367.wav', SAY.day5, { offset: 2, dur: SAY.cost - SAY.day5, level: 0.25, fin: 0.3, fout: 0.4, fx: true }));
  fx('knock', { t: W('day5', 'knock') + 0.05, n: 3, gap: 0.17, level: 0.55 });
  A.push({ type: 'crowd', t0: W('day5', 'and'), t1: SAY.cost, level: 0.1, fx: true, swell: [[W('day5', 'and'), 0.3], [SAY.cost, 0.8]] });
  // the cost
  fx('kaching', { t: W('cost', 'forty') + 0.15, level: 0.4 });
  fx('count', { t0: W('cost', 'forty'), t1: W('cost', 'forty') + 1.1, from: 20, to: 36, level: 0.08, seed: 9 });
  // could it happen
  fx('creak', { t0: W('real', 'honestly') + 0.1, t1: W('real', 'honestly') + 0.8, level: 0.15 });
  A.push(S_('sfx/1195.wav', W('real', 'internet'), { dur: SAY.day7 - W('real', 'internet'), level: 0.22, fin: 0.3, fout: 0.4, fx: true }));
  fx('sample', { file: 'sfx/1022.wav', t: W('real', 'and') - 0.05, level: 0.3 });
  fx('sparkle', { t: W('real', 'data') + 0.2, dur: 1.2, count: 10, f: [1800, 5200], level: 0.12, seed: 10 });
  // day seven: lights back, then every notification at once
  fx('riser', { t0: W('day7', 'it'), t1: W('day7', 'every'), level: 0.16, curve: 2.2 });
  for (let i = 0; i < 22; i++) fx('ding', { t: W('day7', 'every') + Math.pow(i / 22, 1.3) * 2.2, f: 1100 + 400 * hash(i, 4), level: 0.06 + 0.04 * hash(i, 5), pan: -0.8 + 1.6 * hash(i, 6) });
  A.push(S_('sfx/2896.wav', W('day7', 'once'), { level: 0.35, free: true, dur: Math.max(0.6, SAY.cta - W('day7', 'once') - 0.25), fout: 0.4 }));
  // the question
  for (let i = 0; i < 4; i++) fx('pop', { t: SAY.cta + 0.2 + i * 0.15, f: 600 + i * 120, level: 0.18 });
  fx('ding', { t: W('cta', 'comments') + 0.3, level: 0.15 });
  return A;
}
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const STAMP_T = [[SAY.day1 - 0.95], [SAY.day2 - 0.15], [SAY.day3 - 0.15], [SAY.twist - 0.1], [SAY.day5 - 0.15], [SAY.day7 - 0.15]];

export default {
  id: 'internet-down-2d',
  title: 'What if the internet went down for a week?',
  duration: DURATION,
  css: CSS,
  fadeOut: FADE, endAt: 1e9,
  captions: buildCaptions(),
  captionFade: 0.08,
  audio: buildAudio(),
  goal(t) {
    const a = smooth(SAY.day1 - 1.0, SAY.day1 - 0.6, t) * (1 - smooth(SAY.cost - 0.3, SAY.cost, t)) + smooth(SAY.day7 - 0.3, SAY.day7, t) * (1 - smooth(SAY.cta - 0.3, SAY.cta, t));
    if (a <= 0) return null;
    const d = daysAt(t), day = Math.min(7, Math.floor(d) + 1);
    const ticks = [1, 2, 3, 4, 5, 6].map((n) => ({ k: n / 7, on: d >= n, pop: Math.exp(-Math.pow((d - n) * 3, 2)) }));
    if (d >= 6.99) return { label: 'BACK ONLINE ✓', pct: 'DAY 7', k: 1, from: 'DAY 1', to: 'DAY 7', alpha: a, ticks };
    return { label: 'OFFLINE · WORLDWIDE', pct: `DAY ${day}`, k: d / 7, from: 'DAY 1', to: 'DAY 7', alpha: a, ticks };
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
