// What if money stopped working? — illustrated explainer (plumbing in explainer.js).
// Facts: Weimar Germany, Oct 1923 — prices doubled roughly every 3.7 days; Hungary, July 1946 — every ~15 hours (Hanke &
// Krus hyperinflation table); Zimbabwe issued a Z$100 trillion note in Jan 2009 and suspended its currency in April 2009;
// hyperinflations typically end with a new currency and a central bank barred from financing the government.
import VO from './money.vo.js';
import * as I from './ill2d.js';
import * as G from './ill2d-grid.js';
import * as A from './ill2d-ai.js';
import * as P from './ill2d-pandemic.js';
import * as B from './ill2d-bees.js';
import * as M from './ill2d-money.js';
import * as X from './explainer.js';

const { C, ease, clamp, lerp, hash } = I;
const { CASH } = M;

const ORDER = ['hook', 'intro', 'relate', 'week1', 'rush', 'barter', 'twist', 'real', 'end', 'cta'];
const GAP = { hook: 0.1, intro: 0.3, relate: 0.35, week1: 1.0, rush: 0.4, barter: 0.55, twist: 0.5, real: 0.4, end: 0.45, cta: 0.35 };
const { SAY, W, FADE, DURATION } = X.timeline(VO, ORDER, GAP);

const NUMS = [['week one', 'WEEK 1'], ['week 1', 'WEEK 1'], ['three dollars', '$3 (€2.80)'], ['$3', '$3 (€2.80)'], ['six', '$6 (€5.50)'], ['month two', 'MONTH 2'], ['month 2', 'MONTH 2'],
  ['1923', '1923'], ['1946', '1946'], ['four days', '4 DAYS'], ['fifteen hours', '15 HOURS'], ['15 hours', '15 HOURS'], ['2009', '2009'],
  ['one hundred trillion dollar', '100 TRILLION DOLLAR'], ['100 trillion dollar', '100 TRILLION DOLLAR']];
const KEYWORDS = /^(money|worthless|cash|value|snack|expensive|hours|bread|paycheck|same|rush|tomorrow|less|twice|paper|trading|eggs|fuel|haircuts|vegetables|crazy|germany|hungary|doubled|zimbabwe|trillion|fix|currency|print|trust|trade|comments)$/i;

// ------------------------------------------------------------------ backgrounds
const { S, at, frame, svgAt, cuts } = X.stack();
const night = (glow = null, gy = 820) => I.bg('#0e1530', '#1d2a55', glow, gy);
const green = (glow = '#7dffa6') => I.bg('#0b2a1a', '#145a34', glow, 820);
const shop = () => `${I.bg('#2b1c18', '#4a2d22', '#ff9a52', 760)}<rect x="0" y="1090" width="1080" height="830" fill="#3a2419"/><rect x="0" y="1060" width="1080" height="56" fill="url(#woodTop)"/>`;
const market = (t) => `${I.bg('#7cc7ff', '#cfeaff')}<rect y="1150" width="1080" height="770" fill="#c9a66b"/>${[0, 1].map((i) => `<path d="M ${60 + i * 540} 520 L ${480 + i * 540} 520 L ${450 + i * 540} 620 L ${90 + i * 540} 620 Z" fill="${i ? C.blue : C.coral}"/>${[...Array(6)].map((_, k) => `<rect x="${90 + i * 540 + k * 60}" y="520" width="30" height="100" fill="#fff" opacity="0.6"/>`).join('')}`).join('')}`;
const bread = (x, y, s, v, cur) => P.bread(x, y, s) + B.tag(x + 40, y + 200, s * 0.9, 'BREAD', 3, 6, v, cur);

// ---------- the hook
at(0, (t, u) => `${green()}${M.note(540, 860, 1.4, -6 + 3 * Math.sin(t * 2), '100')}`);
at(W('hook', 'money'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#7dffa6', 820)}<path d="M 340 760 Q 300 1100 400 1240 L 700 1240 Q 800 1100 740 760 Z" fill="#3a5a8c" filter="url(#drop)"/>
  <g transform="translate(540 ${lerp(1000, 780, ease.out(u / 0.6))}) rotate(-8)">${M.note(0, 0, 0.6, 0, '100')}</g><path d="M 330 760 L 750 760 L 740 840 L 340 840 Z" fill="#2f4a7a"/>`);
at(W('hook', 'suddenly'), (t, u) => { const f = ease.inOut(u / 1.4);
  return `${I.bg('#2a2a2a', '#4a4a4a')}<g opacity="${1 - 0.5 * f}" filter="url(#soft)">${M.note(540, 860, 1.4, -6, '100', `rgb(${Math.round(lerp(123, 150, f))},${Math.round(lerp(179, 150, f))},${Math.round(lerp(138, 150, f))})`)}</g>
  ${f > 0.6 ? `<g transform="translate(540 860) rotate(-12) scale(${ease.back((u - 0.9) / 0.3)})"><rect x="-360" y="-90" width="720" height="180" rx="16" fill="none" stroke="${C.red}" stroke-width="18"/>${G.txt(0, 36, 110, C.red, 'WORTHLESS')}</g>` : ''}`; });
// ---------- what the video is about
at(W('intro', 'not'), (t, u) => `${night(C.red)}${A.laptop(540, 1060, 1.2, `<g transform="translate(0 -170) scale(0.6)"><path d="M -300 0 L -150 -40 L 0 20 L 150 -60 L 300 40" stroke="${C.red}" stroke-width="16" fill="none"/></g>`)}${G.outlined(540, 520, 80, '#fff', 'STOCK MARKET DIP?', 8)}${I.xmark(840, 700, 0.8, u - 0.6)}`);
at(W('intro', 'your'), (t, u) => `${green()}${I.wallet(540, 860, 1.1, t, 0)}${[0, 1, 2].map((i) => `<g transform="translate(${360 + i * 180} ${560 - 30 * Math.sin(t * 3 + i)}) rotate(${-10 + i * 10})" opacity="${1 - clamp((u - 0.4 - i * 0.2) / 0.6)}">${M.note(0, 0, 0.35, 0, '20')}</g>`).join('')}
  <g transform="translate(540 1300)">${G.outlined(0, 0, 80, C.red, `VALUE ▼ ${Math.round(clamp(u / 2) * 100)}%`.replace('100%', '99%'), 8)}</g>`);
at(W('intro', 'heres'), (t, u) => {
  const pts = [[250, 520], [780, 640], [300, 800], [780, 940], [280, 1100]], labels = ['WEEK 1', 'THE RUSH', 'MONTH 2', 'THE TWIST', 'THE FIX'], kinds = ['cart', 'door', 'bell', 'bulb', 'people'];
  let path = `M 540 420`; pts.forEach(([x, y]) => (path += ` L ${x} ${y}`));
  return `${night('#ffd84a')}<path d="${path}" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round" opacity="0.5"/>
  ${pts.map(([x, y], i) => u >= i * 0.25 ? `${G.icon(kinds[i], x, y, ease.back((u - i * 0.25) / 0.3), t)}<text x="${x + (x < 540 ? 90 : -90)}" y="${y + 14}" font-family="MontB" font-weight="900" font-size="42" fill="#fff" text-anchor="${x < 540 ? 'start' : 'end'}" opacity="${clamp((u - i * 0.25) * 4)}">${labels[i]}</text>` : '').join('')}`; });
// ---------- the snack
at(W('relate', 'you'), (t, u) => `${shop()}${M.snack(400, 880, 1.2, ease.inOut(u / 2))}${B.tag(780, 860, 1, 'CHIPS', 2.99, 3.49, (u - 0.6) / 1.2)}`);
at(W('relate', 'now'), (t, u) => `${night(C.red)}${M.clockFast(540, 820, 1.2, t, 30, 'EVERY FEW HOURS')}`);
// ---------- week one
at(SAY.week1 - 0.95, (t, u) => `${shop()}${P.bread(540, 950, 1.5)}${I.stamp('WEEK 1', u, 560)}`);
at(W('week1', 'loaf'), (t, u) => `${shop()}${bread(540, 900, 1.3, 0, '$')}${G.outlined(540, 520, 70, '#fff', '(€2.80)', 7)}`);
at(W('week1', 'by'), (t, u) => `${shop()}${bread(540, 900, 1.3, ease.out(u / 1.2), '$')}${u > 1 ? G.outlined(540, 520, 90, C.red, '×2 IN A WEEK', 9) : ''}`);
at(W('week1', 'but'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ffd84a', 820)}${M.paycheck(540, 860, 1.25, '$2,000')}${G.outlined(540, 1180, 70, '#fff', 'SAME NUMBER', 8)}`);
// ---------- the rush
at(SAY.rush, (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#7dffa6', 820)}${M.paycheck(540, 700, 0.8, '$2,000')}${I.person(lerp(200, 900, ease.inOut(u / 2.4)), 1360, 1.0, { shirt: C.coral, pose: 'walk', face: 'panic', t })}
  ${[0, 1, 2, 3].map((i) => `<line x1="${lerp(200, 900, ease.inOut(u / 2.4)) - 120 - i * 40}" y1="${1100 + i * 50}" x2="${lerp(200, 900, ease.inOut(u / 2.4)) - 200 - i * 40}" y2="${1100 + i * 50}" stroke="#fff" stroke-width="8" opacity="0.6"/>`).join('')}`);
at(W('rush', 'because'), (t, u) => `${shop()}${bread(320, 900, 1.0, 1, '$')}<g transform="translate(760 900)">${G.outlined(0, -120, 64, '#fff', 'TOMORROW', 7)}${B.tag(0, 60, 1.0, 'BREAD', 6, 12, u / 1.2, '$')}</g>`);
at(W('rush', 'shops'), (t, u) => `${shop()}${M.priceBoard(540, 860, 1.05, t, Math.pow(2, 1 + Math.floor(u * 1.6) * 0.5))}${A.stopwatch(860, 480, 0.4, u * 3)}`);
// ---------- month two: barter
at(SAY.barter - 0.15, (t, u) => `${market(t)}${M.wheelbarrow(540, 1150, 1.2, t, 15)}${I.stamp('MONTH 2', u, 520)}`);
at(W('barter', 'cash'), (t, u) => `${I.bg('#4a4a4a', '#6a6a6a')}${M.wheelbarrow(540, 1000, 1.3, t, 15)}${G.outlined(540, 520, 80, '#fff', 'JUST PAPER', 8)}${[...Array(6)].map((_, i) => { const p = (t * 0.4 + i / 6) % 1; return `<g transform="translate(${hash(i, 2) * 1080} ${400 + p * 1100}) rotate(${p * 360})" opacity="${1 - p}">${M.note(0, 0, 0.18, 0, '1M', '#9a9a9a')}</g>`; }).join('')}`);
at(W('barter', 'people'), (t, u) => `${market(t)}${I.person(300, 1360, 1, { shirt: C.teal, pose: 'talk', t })}${I.person(780, 1360, 1, { shirt: C.yellow, pose: 'talk', t, flip: -1 })}${M.swapArrows(540, 800, 1.3, t)}`);
at(W('barter', 'eggs'), (t, u) => `${market(t)}${M.eggs(300, 900, 1.3)}${M.swapArrows(540, 880, 1, t)}${M.fuelCan(800, 900, 1.1)}`);
at(W('barter', 'haircuts'), (t, u) => `${market(t)}${M.scissors(300, 900, 1.3, t)}${M.swapArrows(540, 880, 1, t)}${M.veggies(800, 980, 1.4)}`);
// ---------- the twist
at(SAY.twist - 0.1, (t, u) => `${I.bg('#120a2e', '#3a1a6b', '#c77dff', 820)}${G.stars(t, 40, 12)}
  <g transform="translate(540 820) rotate(${u * 40})" opacity="0.5">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M 0 0 L ${Math.cos(i) * 600} ${Math.sin(i) * 600}" stroke="#c77dff" stroke-width="40" opacity="0.3"/>`).join('')}</g>${I.stamp('THE TWIST', u, 860)}`);
at(W('twist', 'this'), (t, u) => `${I.bg('#3a2a1a', '#5a4026', '#ffd27a', 820)}${I.check(540, 820, 1.5, u)}${G.outlined(540, 1130, 84, '#fff', 'ALREADY HAPPENED', 9)}`);
at(W('twist', 'in'), (t, u) => { const k = ease.out(u / 0.6);
  return `${I.bg('#3a2a1a', '#5a4026', '#ffd27a', 820)}${G.paper(540, 820, lerp(0.2, 0.9, k), lerp(-540, -4, k), { date: 'BERLIN, OCTOBER 1923', h1: 'PRICES DOUBLE', h2: 'EVERY 4 DAYS',
    art: `<rect x="-300" y="-20" width="300" height="220" fill="#d9c9a8"/><g transform="translate(-150 120) scale(0.32)">${M.wheelbarrow(0, 0, 1, t, 15)}</g>` })}<rect width="1080" height="1920" fill="#704214" opacity="0.15"/>`; });
at(W('twist', 'and'), (t, u) => `${I.bg('#3a2a1a', '#5a4026', '#ff5e5b', 820)}${M.clockFast(540, 820, 1.2, t, 60, 'EVERY 15 HOURS')}${G.outlined(540, 460, 80, '#fff', 'HUNGARY · 1946', 8)}`);
// ---------- could it happen?
at(SAY.real, (t, u) => `${green()}${M.note(540, 980, 1.1, -4, '100')}<text x="540" y="${600 + 10 * Math.sin(t * 4)}" font-family="MontB" font-weight="900" font-size="300" fill="${C.yellow}" text-anchor="middle" stroke="#000" stroke-width="12" paint-order="stroke" transform="rotate(${6 * Math.sin(t * 3)} 540 500)">?</text>`);
at(W('real', 'in'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ffd84a', 820)}<g transform="translate(540 860) scale(${ease.back(u / 0.4) * 1.5}) rotate(-4)">${M.note(0, 0, 1, 0, '100', '#a8b8c8', 'ONE HUNDRED TRILLION DOLLARS')}</g>
  ${G.outlined(540, 1180, 70, '#fff', 'ZIMBABWE · 2009', 8)}`);
at(W('real', 'few'), (t, u) => `${I.bg('#4a4a4a', '#6a6a6a')}<g opacity="${1 - 0.6 * ease.out(u / 1.5)}">${M.note(540, 860, 1.3, -4, '100', '#a8b8c8', 'ONE HUNDRED TRILLION DOLLARS')}</g>${I.xmark(540, 860, 1.2, u - 0.6)}${G.outlined(540, 1240, 70, '#fff', 'GAVE UP ON IT', 8)}`);
// ---------- the fix
at(W('end', 'the'), (t, u) => `${green(C.yellow)}${G.outlined(540, 860, 160, '#fff', 'THE FIX', 12)}`);
at(W('end', 'countries'), (t, u) => `${green()}<g transform="translate(540 860) scale(${ease.back(u / 0.4)})">${M.note(0, 0, 1.3, -3, 'NEW', '#4a8ad8', 'NEW CURRENCY')}</g>`);
at(W('end', 'central'), (t, u) => `${I.bg('#2a3352', '#4a5a88', '#ffd84a', 860)}<rect y="1200" width="1080" height="720" fill="#3a4260"/>${M.centralBank(540, 1150, 1.1, t, u - 0.8)}`);
at(W('end', 'slowly'), (t, u) => `${market(t)}${I.person(330, 1360, 1, { shirt: C.teal, pose: 'talk', face: 'happy', t })}${I.person(750, 1360, 1, { shirt: C.yellow, pose: 'talk', face: 'happy', t, flip: -1 })}
  <g transform="translate(540 820) rotate(${-6 + 3 * Math.sin(t * 2)})">${M.note(0, 0, 0.5, 0, 'NEW', '#4a8ad8', 'NEW CURRENCY')}</g>${A.heart(540, 600, 1.2, C.coral)}`);
// ---------- the question
const ASK = ['WHAT WOULD', 'YOU TRADE?'], OPTS = ['Skills', 'Food', 'Gold', 'Snacks'];
at(SAY.cta, (t, u) => `${night('#ffd84a')}${A.commentBox(540, 860, 1, t, u, ASK, OPTS)}`);
at(W('cta', 'tell'), (t, u) => `${night('#ffd84a')}${A.commentBox(540, 800, 0.9, t, 2, ASK, OPTS)}
  <g transform="translate(540 1220) scale(${1 + 0.08 * Math.sin(t * 10)})"><rect x="-120" y="-80" width="240" height="160" rx="40" fill="#fff"/><path d="M -40 70 L -70 130 L 10 70 Z" fill="#fff"/>
  ${[-50, 0, 50].map((x, i) => `<circle cx="${x}" cy="0" r="16" fill="${C.ink}" opacity="${0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i))}"/>`).join('')}</g>`);

// ------------------------------------------------------------------ the price of bread on the bar
const STAMPS = [SAY.week1 - 0.95, SAY.barter - 0.15, SAY.twist - 0.1];
const price = X.keyed([[W('week1', 'loaf'), 3], [W('week1', 'by'), 3], [W('week1', 'but'), 6], [W('rush', 'shops'), 12], [SAY.barter, 48], [SAY.twist - 0.3, 400]]);
function goal(t) {
  const a = X.smooth(W('week1', 'loaf') - 0.3, W('week1', 'loaf'), t) * (1 - X.smooth(SAY.twist - 0.4, SAY.twist - 0.1, t));
  if (a <= 0) return null;
  const p = price(t), k = Math.log(p / 3) / Math.log(400 / 3), ticks = [6, 12, 48].map((n) => ({ k: Math.log(n / 3) / Math.log(400 / 3), on: p >= n, pop: Math.exp(-Math.pow((p - n) / n * 4, 2)) }));
  const f = (v) => (v >= 100 ? Math.round(v) : v.toFixed(2));
  return { label: 'PRICE OF BREAD', pct: `$${f(p)} (€${f(p * 0.92)})`, k, from: '$3', to: '$400', alpha: a, ticks };
}

// ------------------------------------------------------------------ sound
function buildAudio() {
  const { A: L, fx, S_, music } = X.audioBase(VO, ORDER, SAY, DURATION, cuts(), STAMPS);
  music('music/464.mp3', 0, SAY.twist + 0.6, { offset: 4 });
  music('music/606.mp3', SAY.twist - 0.3, DURATION - SAY.twist + 0.3, { offset: 14, level: 0.55, fin: 0.8 });
  // hook
  fx('rustle', { t0: 0.1, t1: 0.7, level: 0.12 });
  fx('rustle', { t0: W('hook', 'money') + 0.1, t1: W('hook', 'money') + 0.6, level: 0.12 });
  fx('powerdown', { t: W('hook', 'suddenly') + 0.3, level: 0.2 });
  fx('clank', { t: W('hook', 'suddenly') + 0.95, level: 0.3 });
  // intro
  fx('beep', { t: W('intro', 'not') + 0.62, f: 330, n: 2, drop: 0.8, level: 0.22 });
  fx('count', { t0: W('intro', 'your') + 0.2, t1: W('intro', 'your') + 1.6, from: 40, to: 20, level: 0.06, seed: 2 });
  for (let i = 0; i < 5; i++) fx('pop', { t: W('intro', 'heres') + i * 0.25, f: 700 + i * 90, level: 0.2 });
  // snack
  fx('rustle', { t0: W('relate', 'you') + 0.2, t1: W('relate', 'you') + 1.2, level: 0.1 });
  fx('ding', { t: W('relate', 'you') + 0.9, f: 1046.5, level: 0.1 });
  for (let i = 0; i < 8; i++) fx('knock', { t: W('relate', 'now') + 0.2 + i * 0.15, n: 1, level: 0.05 });
  // week one
  fx('kaching', { t: W('week1', 'by') + 0.6, level: 0.28 });
  fx('sample', { file: 'sfx/2380.wav', t: W('week1', 'but') + 0.05, level: 0.3 });
  // rush
  L.push({ type: 'crowd', t0: SAY.rush, t1: SAY.barter - 0.2, level: 0.08, fx: true, swell: [[SAY.rush, 0.4], [SAY.barter - 0.2, 0.8]] });
  fx('kaching', { t: W('rush', 'because') + 0.6, level: 0.22 });
  for (let i = 0; i < 4; i++) fx('sample', { file: 'sfx/1117.wav', t: W('rush', 'shops') + 0.3 + i * 0.32, level: 0.16 });
  // barter
  L.push(S_('sfx/361.wav', SAY.barter - 0.3, { dur: SAY.twist - SAY.barter, level: 0.14, fin: 0.3, fout: 0.3, fx: true }));
  fx('rustle', { t0: W('barter', 'cash') + 0.1, t1: W('barter', 'cash') + 1.0, level: 0.12 });
  fx('pop', { t: W('barter', 'eggs') + 0.2, f: 700, level: 0.16 });
  fx('pop', { t: W('barter', 'haircuts') + 0.2, f: 800, level: 0.16 });
  // the twist
  fx('sample', { file: 'sfx/2915.wav', t: SAY.twist - 0.1, level: 0.35, dur: 1.6, fout: 0.4 });
  fx('ding', { t: W('twist', 'this') + 0.1, f: 880, level: 0.12 });
  fx('sample', { file: 'sfx/1105.wav', t: W('twist', 'in') + 0.05, level: 0.4 });
  for (let i = 0; i < 10; i++) fx('knock', { t: W('twist', 'and') + 0.2 + i * 0.1, n: 1, level: 0.05 });
  // could it happen
  fx('creak', { t0: SAY.real + 0.1, t1: SAY.real + 0.7, level: 0.12 });
  fx('sample', { file: 'sfx/2918.wav', t: W('real', 'in') + 0.1, level: 0.25 });
  fx('beep', { t: W('real', 'few') + 0.62, f: 300, n: 2, drop: 0.8, level: 0.2 });
  // the fix
  fx('chime', { t: W('end', 'countries') + 0.2, level: 0.1, freq: 659.25 });
  fx('clank', { t: W('end', 'central') + 0.85, level: 0.25 });
  fx('sparkle', { t: W('end', 'slowly') + 0.2, dur: 1.0, count: 8, f: [1600, 4200], level: 0.1, seed: 9 });
  // the question
  for (let i = 0; i < 4; i++) fx('pop', { t: SAY.cta + 0.2 + i * 0.15, f: 600 + i * 120, level: 0.18 });
  fx('ding', { t: W('cta', 'comments') + 0.3, level: 0.15 });
  return L;
}

export default X.scenario({ id: 'money', title: 'What if money stopped working?', DURATION, FADE, CSS: X.css(CASH, '#ffd84a'),
  caps: X.captions(VO, ORDER, SAY, NUMS, KEYWORDS), audio: buildAudio(), goal, svgFrame: frame });
export const _debug = { SAY, DURATION, S, wordT: W };
export { svgAt };
