// What if World War 3 started tomorrow? — illustrated explainer, grounded and non-graphic (plumbing in explainer.js).
// Facts: Brent crude touched ~$139/barrel on 7 March 2022 after the invasion of Ukraine; SIPRI: world military spending a
// record ~$2.72 trillion in 2024; FAS: ~12,200 nuclear warheads (2025); no two nuclear-armed states have fought a full-scale
// war against each other since 1945 (deterrence). Everything else is framed as a what-if for an ordinary person.
import VO from './ww3.vo.js';
import * as I from './ill2d.js';
import * as G from './ill2d-grid.js';
import * as A from './ill2d-ai.js';
import * as K from './ill2d-ww3.js';
import * as X from './explainer.js';

const { C, ease, clamp, lerp, hash } = I;

const ORDER = ['hook', 'intro', 'relate', 'day1', 'markets', 'day3', 'cyber', 'twist', 'real', 'end', 'cta'];
const GAP = { hook: 0.1, intro: 0.3, relate: 0.35, day1: 1.0, markets: 0.35, day3: 0.55, cyber: 0.45, twist: 0.5, real: 0.4, end: 0.45, cta: 0.35 };
const { SAY, W, FADE, DURATION } = X.timeline(VO, ORDER, GAP);

const NUMS = [['world war three', 'WORLD WAR 3'], ['day one', 'DAY 1'], ['day three', 'DAY 3'], ['a hundred and forty dollars', '$140 (€128)'], ['2022', '2022'], ['1945', '1945'], ['2024', '2024'],
  ['two point seven trillion dollars', '$2.7 TRILLION (€2.5T)'], ['twelve thousand', '12,000'], ['$2.7 trillion', '$2.7 TRILLION (€2.5T)'], ['12,000', '12,000'], ['$140', '$140 (€128)'], ['day 3', 'DAY 3']];
const KEYWORDS = /^(tomorrow|explosions|normal|breaking|stomach|channel|alerts|water|batteries|news|crash|minutes|savings|fuel|oil|barrel|food|cyberattacks|banks|airports|cancelled|dark|crazy|nuclear|everyone|deterrence|record|militaries|warheads|battle|table|talking|diplomacy|works|comments)$/i;

// ------------------------------------------------------------------ backgrounds
const { S, at, frame, svgAt, cuts } = X.stack();
const night = (glow = null, gy = 820) => I.bg('#0e1530', '#1d2a55', glow, gy);
const tense = (glow = C.red) => I.bg('#1a0d14', '#3a1426', glow, 820);
const room = (t) => `${I.bg('#1d1b45', '#3b2d5c')}<rect x="120" y="420" width="420" height="520" rx="18" fill="url(#dawnSky)"/><circle cx="330" cy="840" r="90" fill="#ffd27a" opacity="0.9"/>
  <rect x="104" y="404" width="452" height="552" rx="24" fill="none" stroke="#2b2858" stroke-width="22"/><rect x="0" y="1060" width="1080" height="860" fill="#2a2148"/>`;
const store = () => `${I.bg('#e8f0ff', '#c9d6f0')}<rect y="1220" width="1080" height="700" fill="#9aa8c2"/>`;
const PHONE = { x: 540, y: 815, s: 1.05 };

// ---------- the hook
at(0, (t, u) => `${I.bg('#3e4fa8', '#f08a6a', '#ffd27a', 1000)}<circle cx="540" cy="1020" r="150" fill="#ffe09a"/>${I.cityline(1240, t, 0.5, '#1b2550', 3)}<rect y="1240" width="1080" height="680" fill="#141d40"/>`);
at(W('hook', 'world'), (t, u) => { const arcs = [[-0.5, -0.3, 0.3, -0.25], [-0.15, 0.3, 0.35, 0.25], [-0.6, 0.1, 0.6, 0.45]];
  return `${tense()}${I.globe(540, 860, 330, t, { spin: t * 0.1 })}${arcs.map(([a, b, c, d], i) => { const r = 330, mx = (a + c) / 2 * r + 540, my = (b + d) / 2 * r + 860 - 140;
    return `<path d="M ${540 + a * r} ${860 + b * r} Q ${mx} ${my} ${540 + c * r} ${860 + d * r}" fill="none" stroke="${C.red}" stroke-width="8" stroke-dasharray="${900 * clamp((u - i * 0.15) / 0.5)} 900" filter="url(#glow)"/>`; }).join('')}
  <g transform="translate(540 440) scale(${ease.back((u - 0.2) / 0.3)})">${G.outlined(0, 0, 130, '#fff', 'WORLD WAR 3', 12)}</g>`; });
at(W('hook', 'tomorrow'), (t, u) => `${room(t)}${I.alarmClock(800, 990, 1.1, t)}<g transform="translate(540 1330) scale(${ease.back(u / 0.3)})">${G.outlined(0, 0, 110, C.yellow, 'TOMORROW', 10)}</g>`);
// ---------- what the video is about
at(W('intro', 'no'), (t, u) => `${I.bg('#2b1c18', '#4a2d22', '#ffb347', 820)}${K.movieScreen(540, 820, 1.05, t)}${I.xmark(830, 540, 0.85, u - 0.55)}`);
at(W('intro', 'just'), (t, u) => `${I.bg('#2b2260', '#463a8c', '#ffd84a', 820)}${I.person(540, 1360, 1.5, { shirt: C.teal, pose: 'stand', t })}
  <g transform="translate(${540 + 6 * Math.sin(t * 6)} 520)">${G.outlined(0, 0, 110, C.yellow, 'YOU', 10)}<path d="M -20 30 L 0 80 L 20 30 Z" fill="${C.yellow}"/></g>`);
at(W('intro', 'step'), (t, u) => {
  const pts = [[250, 520], [780, 640], [300, 800], [780, 940], [280, 1100]], labels = ['DAY 1', 'MARKETS', 'DAY 3', 'CYBER', 'THE END'], kinds = ['alert', 'chart', 'fuel', 'shield', 'hands'];
  let path = `M 540 420`; pts.forEach(([x, y]) => (path += ` L ${x} ${y}`));
  return `${night('#ffd84a')}<path d="${path}" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round" opacity="0.5"/>
  ${pts.map(([x, y], i) => u >= i * 0.22 ? `${K.icon(kinds[i], x, y, ease.back((u - i * 0.22) / 0.3))}<text x="${x + (x < 540 ? 90 : -90)}" y="${y + 14}" font-family="MontB" font-weight="900" font-size="42" fill="#fff" text-anchor="${x < 540 ? 'start' : 'end'}" opacity="${clamp((u - i * 0.22) * 4)}">${labels[i]}</text>` : '').join('')}`; });
// ---------- the shared feeling
at(W('relate', 'you'), (t, u) => { const bz = u < 1.2 ? I.wobble(t, 40, 6) : 0;
  return `${night(C.red)}${I.heldPhone({ ...PHONE, x: PHONE.x + bz, rot: -2 + Math.sin(t * 1.5), id: 'news', screen: K.screenNews(t) })}`; });
at(W('relate', 'stomach'), (t, u) => `${tense()}${I.person(540, 1460, 1.7, { shirt: C.teal, pose: 'stand', face: 'panic', t })}
  <g transform="translate(540 ${1020 + 60 * ((t * 1.2) % 1)})" opacity="${1 - (t * 1.2) % 1}"><path d="M -40 -60 L 40 -60 L 40 0 L 80 0 L 0 80 L -80 0 L -40 0 Z" fill="${C.yellow}"/></g>`);
at(W('relate', 'imagine'), (t, u) => { const te = W('relate', 'every') - W('relate', 'imagine');
  return `${I.bg('#0b0d14', '#1a1d27', C.red, 820)}${[...Array(9)].map((_, i) => { const on = u > te + i * 0.08; const x = 220 + (i % 3) * 320, y = 560 + Math.floor(i / 3) * 290;
    return `<g transform="translate(${x} ${y}) scale(0.5)">${K.tv(0, 0, 1, on ? K.newsScreen(t + i) : '', 'tv' + i)}</g>`; }).join('')}`; });
// ---------- day one
at(SAY.day1 - 0.95, (t, u) => `${room(t)}${I.phone({ x: 700, y: 1000, s: 0.36, rot: -90, id: 'nite', screen: I.screenLock(t) })}${I.stamp('DAY 1', u, 600)}`);
at(W('day1', 'every'), (t, u) => `${tense()}${[...Array(6)].map((_, i) => { const x = 220 + (i % 3) * 320, y = 640 + Math.floor(i / 3) * 520, k = ease.back((u - i * 0.07) / 0.3);
  return `<g transform="translate(${x + I.wobble(t, 40, 5, i)} ${y}) scale(${0.62 * k})">${I.phone({ x: 0, y: 0, s: 1, rot: (i % 2 ? 4 : -4), id: 'al' + i, screen: K.screenAlert(t, 1) })}</g>`; }).join('')}`);
at(W('day1', 'people'), (t, u) => { const left = 1 - ease.inOut(u / 2.2) * 0.85;
  return `${store()}${I.shelves(540, 700, 0.8, t, left, left)}${[0, 1, 2, 3, 4].map((i) => I.person(160 + i * 190 + 20 * Math.sin(t * 2 + i), 1330, 0.5, { shirt: [C.coral, C.teal, C.yellow, '#c77dff', C.blue][i], pose: 'walk', t, seed: i, flip: i % 2 ? -1 : 1 })).join('')}
  ${G.outlined(300, 1050, 50, C.blue, 'WATER', 7)}${G.outlined(780, 1050, 50, C.green, 'BATTERIES', 7)}`; });
at(W('day1', 'everyone'), (t, u) => `${I.bg('#1d1b45', '#2a2148', '#2f7bff', 760)}<rect y="1180" width="1080" height="740" fill="#1a1530"/>${K.tv(540, 640, 1, K.newsScreen(t), 'tvmain')}
  ${[[330, C.teal, 0], [540, C.coral, 1], [740, C.yellow, 2]].map(([x, col, i]) => I.person(x, 1330, 0.95, { shirt: col, face: 'panic', t, seed: i })).join('')}${I.couch(540, 1300, 1.25)}
  <rect width="1080" height="1920" fill="#2f7bff" opacity="${0.06 + 0.04 * Math.sin(t * 9)}"/>`);
// ---------- the markets
at(SAY.markets, (t, u) => `${night(C.red)}${K.stockChart(540, 860, 1.05, u / 1.6, t)}`);
at(W('markets', 'stock'), (t, u) => `${night(C.red)}${K.tickerBoard(540, 900, 1.05, t, u)}${A.stopwatch(860, 470, 0.45, u * 2)}`);
at(W('markets', 'savings'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ff5e5b', 820)}<g transform="translate(540 900) scale(${1 - 0.35 * ease.inOut(u / 1.4)})">${K.piggy(0, 0, 1, 1 - ease.inOut(u / 1.4) * 0.75, t)}</g>`);
// ---------- day three
const station = () => `${I.bg('#ff9a62', '#ffd27a')}<rect y="1250" width="1080" height="670" fill="#5c6478"/>`;
at(SAY.day3 - 0.15, (t, u) => `${station()}${K.priceSign(540, 1160, 1.0, 0, t)}${I.stamp('DAY 3', u, 520)}`);
at(W('day3', 'fuel'), (t, u) => `${station()}${K.priceSign(540, 1160, 1.05, ease.out((u - 0.2) / 0.8), t)}`);
at(W('day3', 'when'), (t, u) => { const k = ease.out(u / 0.6);
  return `${night('#ffd84a')}${G.paper(540, 860, lerp(0.2, 1, k), lerp(-540, -4, k), { date: 'TUESDAY, MARCH 8, 2022', h1: 'OIL PRICES', h2: 'SOAR',
    art: `<g transform="translate(-150 90) scale(0.42)">${K.barrel(0, 0, 1)}</g>` })}`; });
at(W('day3', 'oil'), (t, u) => { const v = Math.round(lerp(90, 139, ease.out(u / 1.6)));
  return `${I.bg('#1a1426', '#3a2a1a', '#ffb347', 820)}${K.barrel(320, 1000, 1.1, -4 + 3 * Math.sin(t * 2))}
  ${G.outlined(740, 820, 150, C.yellow, `$${v}`, 12)}${G.outlined(740, 920, 60, '#fff', `(€${Math.round(v / 1.09)}) / BARREL`, 8)}
  <g transform="translate(740 620)"><path d="M 0 -60 L 50 0 L 20 0 L 20 60 L -20 60 L -20 0 L -50 0 Z" fill="${C.red}" transform="translate(0 ${-20 * ((t * 1.5) % 1)})"/></g>`; });
at(W('day3', 'food'), (t, u) => `${store()}${K.groceryBag(540, 980, 1.25, t, u)}`);
// ---------- cyber
at(W('cyber', 'next'), (t, u) => `${I.bg('#03140a', '#0b2a1a', '#5dff8a', 820)}${K.hacker(540, 800, 1.1, t)}`);
at(W('cyber', 'banks'), (t, u) => { const tp = W('cyber', 'power') - W('cyber', 'banks'), ta = W('cyber', 'airports') - W('cyber', 'banks');
  const tile = (x, y, inner, k, hit) => `<g transform="translate(${x} ${y}) scale(${ease.back(k / 0.3)})">${inner}${hit > 0 ? `<g transform="translate(110 -170)">${K.lockShield(0, 0, 0.42, 1)}</g>` : ''}</g>`;
  return `${I.bg('#0b0d14', '#1a1d27', '#5dff8a', 860)}${tile(300, 860, A.building(0, 0, 0.9, '#8e94a6', 'BANK', true), u, u - 0.4)}
  ${u > tp ? tile(780, 860, `<g transform="scale(0.5) translate(0 300)">${G.pylon(0, 0, 1, { on: hash(Math.floor(t * 10), 1) > 0.5 ? 1 : 0 })}</g>${G.outlined(0, 80, 46, '#fff', 'POWER', 6)}`, u - tp, u - tp - 0.3) : ''}
  ${u > ta ? tile(540, 1330, `${I.plane(0, -60, 0.6, -6)}${G.outlined(0, 80, 46, '#fff', 'AIRPORTS', 6)}`, u - ta, u - ta - 0.3) : ''}`; });
at(W('cyber', 'flights'), (t, u) => `${night(C.red)}${I.board(540, 820, 1.05, t, u)}`);
at(W('cyber', 'websites'), (t, u) => `${night(C.red)}${K.browser(540, 860, 1.05, t, ease.inOut((u - 0.4) / 0.6))}`);
// ---------- the twist
at(SAY.twist - 0.1, (t, u) => `${I.bg('#120a2e', '#3a1a6b', '#c77dff', 820)}${G.stars(t, 40, 12)}
  <g transform="translate(540 820) rotate(${u * 40})" opacity="0.5">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M 0 0 L ${Math.cos(i) * 600} ${Math.sin(i) * 600}" stroke="#c77dff" stroke-width="40" opacity="0.3"/>`).join('')}</g>${I.stamp('THE TWIST', u, 860)}`);
at(W('twist', 'since'), (t, u) => `${night(C.green)}${K.timeline(540, 860, 1, u / 1.4)}${G.outlined(540, 560, 96, '#fff', '80+ YEARS', 10)}`);
at(W('twist', 'no'), (t, u) => `${night('#c77dff')}${K.standoff(540, 860, 1.25, t)}${G.outlined(540, 1240, 66, C.yellow, 'NO DIRECT WAR', 8)}`);
at(W('twist', 'why'), (t, u) => `${night('#ffd84a')}<text x="540" y="${980 + 10 * Math.sin(t * 4)}" font-family="MontB" font-weight="900" font-size="420" fill="${C.yellow}" text-anchor="middle" stroke="#000" stroke-width="14" paint-order="stroke" transform="rotate(${6 * Math.sin(t * 3)} 540 860)">?</text>`);
at(W('twist', 'because'), (t, u) => `${tense()}${K.scoreboard(540, 860, 1.05, u)}${G.outlined(540, 1240, 70, '#fff', 'EVERYONE LOSES', 8)}`);
at(W('twist', 'called'), (t, u) => `${night('#2f7bff')}${K.standoff(540, 1000, 0.85, t)}<g transform="translate(540 560) scale(${ease.back(u / 0.3)})">${G.outlined(0, 0, 120, C.yellow, 'DETERRENCE', 11)}</g>`);
// ---------- could it happen?
at(SAY.real, (t, u) => `${night('#2f7bff')}${I.globe(540, 920, 320, t, { spin: t * 0.12 })}
  <text x="540" y="${560 + 10 * Math.sin(t * 4)}" font-family="MontB" font-weight="900" font-size="300" fill="${C.yellow}" text-anchor="middle" stroke="#000" stroke-width="12" paint-order="stroke" transform="rotate(${6 * Math.sin(t * 3)} 540 460)">?</text>`);
at(W('real', 'in'), (t, u) => { const v = (2.72 * ease.out(u / 1.8)).toFixed(1);
  return `${night('#34c759')}${[...Array(14)].map((_, i) => I.cash(540 + (i % 3 - 1) * 70, 1330 - i * 26 * clamp(u * 1.5), 1, (i % 2 ? 4 : -4))).join('')}
  ${G.outlined(540, 720, 200, '#7dffa6', `$${v}T`, 12)}${G.outlined(540, 820, 60, '#fff', '(€2.5T) IN ONE YEAR', 8)}${G.outlined(540, 500, 60, C.yellow, 'RECORD', 8)}`; });
at(W('real', 'and'), (t, u) => { const n = Math.floor(ease.out(u / 1.6) * 240);
  return `${tense(C.yellow)}${K.warheadDots(540, 900, 1, n)}${G.outlined(540, 520, 110, C.yellow, `${Math.round(n / 240 * 12000).toLocaleString('en-US')}`, 11)}
  ${G.outlined(540, 1290, 60, '#fff', 'NUCLEAR WARHEADS', 8)}${G.outlined(540, 1360, 40, '#c9d0ff', '1 DOT = 50', 6)}`; });
// ---------- how wars end
at(W('end', 'but'), (t, u) => `${night('#ff5e5b')}${K.crossedSwords(540, 860, 1.1)}${G.outlined(540, 1260, 70, '#fff', 'ONE FINAL BATTLE?', 8)}${I.xmark(820, 560, 0.85, u - 0.9)}`);
at(W('end', 'they'), (t, u) => `${I.bg('#2a3352', '#4a5a88', '#ffd27a', 760)}<rect y="1150" width="1080" height="770" fill="#3a2a22"/>${K.roundTable(540, 1250, 1, t)}
  ${I.bubbleSay(300, 600, 0.9, u - 0.5, '…', '#fff')}${I.bubbleSay(780, 560, 0.9, u - 0.9, '…', '#fff')}`);
at(W('end', 'diplomacy'), (t, u) => { const tw = W('end', 'works') - W('end', 'diplomacy');
  return `${I.bg('#14532d', '#22a35a', '#ffd84a', 820)}${u < tw - 0.1 ? K.snail(400, 1000, 1.2, t) + G.outlined(540, 560, 90, '#fff', 'SLOW…', 9) : `${K.handshake(540, 880, 1.05, t)}${I.check(540, 520, 1, u - tw)}`}`; });
// ---------- the question
const ASK = ['WHAT WOULD YOU', 'DO FIRST?'], OPTS = ['Call family', 'Buy food', 'Get fuel', 'Stay calm'];
at(SAY.cta, (t, u) => `${night('#ffd84a')}${A.commentBox(540, 860, 1, t, u, ASK, OPTS)}`);
at(W('cta', 'tell'), (t, u) => `${night('#ffd84a')}${A.commentBox(540, 800, 0.9, t, 2, ASK, OPTS)}
  <g transform="translate(540 1220) scale(${1 + 0.08 * Math.sin(t * 10)})"><rect x="-120" y="-80" width="240" height="160" rx="40" fill="#fff"/><path d="M -40 70 L -70 130 L 10 70 Z" fill="#fff"/>
  ${[-50, 0, 50].map((x, i) => `<circle cx="${x}" cy="0" r="16" fill="${C.ink}" opacity="${0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i))}"/>`).join('')}</g>`);

// ------------------------------------------------------------------ the days on the bar
const STAMPS = [SAY.day1 - 0.95, SAY.day3 - 0.15, SAY.twist - 0.1];
const days = X.keyed([[SAY.day1 - 0.9, 0], [SAY.markets, 0.6], [SAY.day3 - 0.2, 2], [SAY.cyber, 3], [SAY.twist - 0.3, 5]]);
function goal(t) {
  const a = X.smooth(SAY.day1 - 1.0, SAY.day1 - 0.6, t) * (1 - X.smooth(SAY.twist - 0.4, SAY.twist - 0.1, t));
  if (a <= 0) return null;
  const d = days(t), ticks = [1, 2, 3, 4, 5, 6].map((n) => ({ k: n / 7, on: d >= n, pop: Math.exp(-Math.pow((d - n) * 3, 2)) }));
  return { label: 'SINCE IT STARTED', pct: `DAY ${Math.min(7, Math.floor(d) + 1)}`, k: d / 7, from: 'DAY 1', to: 'DAY 7', alpha: a, ticks };
}

// ------------------------------------------------------------------ sound
function buildAudio() {
  const { A: L, fx, S_, music } = X.audioBase(VO, ORDER, SAY, DURATION, cuts(), STAMPS);
  music('music/464.mp3', 0, SAY.end + 0.6, { offset: 4 });
  music('music/606.mp3', SAY.end - 0.3, DURATION - SAY.end + 0.3, { offset: 14, level: 0.55, fin: 0.8 });
  // hook
  L.push(S_('sfx/2678.wav', 0, { dur: W('hook', 'world') + 0.3, level: 0.2, fin: 0.1, fout: 0.2 }));
  fx('sample', { file: 'sfx/2915.wav', t: W('hook', 'world') + 0.1, level: 0.32, dur: 1.4, fout: 0.4 });
  fx('beep', { t: W('hook', 'tomorrow') + 0.1, f: 1250, n: 4, dur: 0.08, gap: 0.08, level: 0.12 });
  // intro
  fx('sample', { file: 'sfx/1703.wav', t: W('intro', 'no') + 0.05, level: 0.1, dur: 0.8, fout: 0.4 });
  fx('beep', { t: W('intro', 'no') + 0.58, f: 330, n: 2, drop: 0.8, level: 0.22 });
  fx('pop', { t: W('intro', 'just') + 0.1, f: 700, level: 0.18 });
  for (let i = 0; i < 5; i++) fx('pop', { t: W('intro', 'step') + i * 0.22, f: 700 + i * 90, level: 0.2 });
  // relate: the buzz, the drop, every channel
  fx('buzz', { t: W('relate', 'you') + 0.05, n: 2, level: 0.25 });
  A_sub(L, W('relate', 'stomach') + 0.1, 0.32);
  for (let i = 0; i < 9; i++) fx('beep', { t: W('relate', 'every') + i * 0.08, f: 900 + i * 40, n: 1, dur: 0.05, level: 0.06 });
  // day one: alerts, the rush, the news
  fx('beep', { t: SAY.day1 - 0.3, f: 1250, n: 4, dur: 0.08, gap: 0.08, level: 0.12 });
  for (let i = 0; i < 3; i++) fx('beep', { t: W('day1', 'every') + 0.1 + i * 0.5, f: 853, n: 2, dur: 0.18, gap: 0.04, level: 0.14 });
  L.push({ type: 'crowd', t0: W('day1', 'people'), t1: W('day1', 'everyone'), level: 0.09, fx: true, swell: [[W('day1', 'people'), 0.6], [W('day1', 'everyone'), 0.9]] });
  fx('flicker', { t0: W('day1', 'everyone'), t1: SAY.markets - 0.2, level: 0.06 });
  // markets
  fx('count', { t0: SAY.markets + 0.5, t1: W('markets', 'stock'), from: 40, to: 18, level: 0.07, seed: 3 });
  for (let i = 0; i < 6; i++) fx('beep', { t: W('markets', 'stock') + i * 0.12 + 0.05, f: 500 - i * 30, n: 1, dur: 0.06, level: 0.08 });
  fx('creak', { t0: W('markets', 'savings') + 0.1, t1: W('markets', 'savings') + 1.2, level: 0.12 });
  // day three: prices, the paper, the barrel, the receipt
  fx('count', { t0: W('day3', 'fuel') + 0.2, t1: W('day3', 'fuel') + 1.0, from: 20, to: 40, level: 0.08, seed: 4 });
  fx('sample', { file: 'sfx/1105.wav', t: W('day3', 'when') + 0.05, level: 0.4 });
  fx('kaching', { t: W('day3', 'oil') + 1.3, level: 0.3 });
  for (let i = 0; i < 3; i++) fx('pop', { t: W('day3', 'food') + 0.2 + i * 0.15, f: 600 + i * 80, level: 0.16 });
  // cyber
  fx('sample', { file: 'sfx/1022.wav', t: W('cyber', 'next') + 0.05, level: 0.28 });
  for (let i = 0; i < 12; i++) fx('sample', { file: 'sfx/1124.wav', t: W('cyber', 'next') + 0.3 + i * 0.07, level: 0.07 });
  fx('beep', { t: W('cyber', 'banks') + 0.45, f: 300, n: 2, drop: 0.85, level: 0.18 });
  fx('zap', { t: W('cyber', 'power') + 0.35, level: 0.15 });
  for (let i = 0; i < 6; i++) fx('sample', { file: 'sfx/1117.wav', t: W('cyber', 'flights') + 0.12 * i + 0.1, level: 0.18, pan: -0.3 + i * 0.12 });
  L.push({ type: 'powerdown', t: W('cyber', 'websites') + 0.45, level: 0.22, fx: true });
  // the twist
  fx('sample', { file: 'sfx/2915.wav', t: SAY.twist - 0.1, level: 0.35, dur: 1.6, fout: 0.4 });
  fx('riser', { t0: W('twist', 'since'), t1: W('twist', 'since') + 1.4, level: 0.1, curve: 2 });
  fx('pulse', { t0: W('twist', 'no'), t1: W('twist', 'why') - 0.1, bpm: [60, 80], level: 0.12 });
  fx('creak', { t0: W('twist', 'why') + 0.05, t1: W('twist', 'why') + 0.5, level: 0.1 });
  A_sub(L, W('twist', 'called') + 0.05, 0.3);
  // could it happen
  fx('kaching', { t: W('real', 'in') + 0.3, level: 0.28 });
  fx('count', { t0: W('real', 'in') + 0.3, t1: W('real', 'in') + 1.8, from: 22, to: 44, level: 0.07, seed: 8 });
  fx('count', { t0: W('real', 'and') + 0.2, t1: W('real', 'and') + 1.6, from: 20, to: 40, level: 0.06, seed: 9 });
  // how wars end
  fx('clank', { t: W('end', 'but') + 0.2, level: 0.25 });
  fx('beep', { t: W('end', 'but') + 0.92, f: 330, n: 2, drop: 0.8, level: 0.2 });
  L.push({ type: 'crowd', t0: W('end', 'they'), t1: W('end', 'diplomacy'), level: 0.06, fx: true, swell: [[W('end', 'they'), 0.4], [W('end', 'diplomacy'), 0.4]] });
  fx('chime', { t: W('end', 'works') + 0.05, level: 0.1, freq: 659.25 });
  fx('sparkle', { t: W('end', 'works') + 0.1, dur: 0.9, count: 8, f: [1600, 4200], level: 0.1, seed: 10 });
  // the question
  for (let i = 0; i < 4; i++) fx('pop', { t: SAY.cta + 0.2 + i * 0.15, f: 600 + i * 120, level: 0.18 });
  fx('ding', { t: W('cta', 'comments') + 0.3, level: 0.15 });
  return L;
}
const A_sub = (L, t, level) => L.push({ type: 'subdrop', t, dur: 0.9, level, free: true });

export default X.scenario({ id: 'ww3', title: 'What if World War 3 started tomorrow?', DURATION, FADE, CSS: X.css('#ff5e5b', '#ffb347'),
  caps: X.captions(VO, ORDER, SAY, NUMS, KEYWORDS), audio: buildAudio(), goal, svgFrame: frame });
export const _debug = { SAY, DURATION, S, wordT: W };
export { svgAt };
