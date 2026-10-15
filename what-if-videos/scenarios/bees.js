// What if all the bees disappeared? — illustrated explainer (plumbing in explainer.js).
// Facts: IPBES 2016 — more than three-quarters of the leading types of global food crops rely to some extent on animal
// pollination; pollination-attributable crop value US$235–577 billion a year; wheat, rice and maize are wind-pollinated;
// apple and pear farmers in Sichuan (Maoxian, Hanyuan) have pollinated by hand.
import VO from './bees.vo.js';
import * as I from './ill2d.js';
import * as G from './ill2d-grid.js';
import * as A from './ill2d-ai.js';
import * as B from './ill2d-bees.js';
import * as X from './explainer.js';

const { C, ease, clamp, lerp, hash } = I;
const { HONEY } = B;

const ORDER = ['hook', 'intro', 'relate', 'day1', 'store', 'prices', 'twist', 'real', 'end', 'cta'];
const GAP = { hook: 0.1, intro: 0.3, relate: 0.35, day1: 1.0, store: 0.55, prices: 0.4, twist: 0.5, real: 0.4, end: 0.45, cta: 0.35 };
const { SAY, W, FADE, DURATION } = X.timeline(VO, ORDER, GAP);

const NUMS = [['day one', 'DAY 1'], ['day 1', 'DAY 1'], ['month one', 'MONTH 1'], ['month 1', 'MONTH 1'], ['three quarters', '3/4'],
  ['five hundred seventy seven billion dollars', '$577 BILLION (€530B)'], ['$577 billion', '$577 BILLION (€530B)']];
const KEYWORDS = /^(bee|disappeared|buzzing|stings|picnic|screaming|miss|honey|pollen|flower|fruit|supermarket|apples|almonds|blueberries|cherries|vanishing|crops|pollinators|prices|coffee|avocados|cows|milk|crazy|starve|wind|boring|expensive|china|hand|brushes|tough|flowers|pesticides|difference|comments)$/i;

// ------------------------------------------------------------------ backgrounds
const { S, at, frame, svgAt, cuts } = X.stack();
const night = (glow = null, gy = 820) => I.bg('#0e1530', '#1d2a55', glow, gy);
const meadow = (t, glow = null) => `${I.bg('#7cc7ff', '#d6efff', glow, 900)}<circle cx="860" cy="520" r="80" fill="#fff3b0"/><rect y="1100" width="1080" height="820" fill="#8bc77b"/>`;
const store = () => `${I.bg('#e8f0ff', '#c9d6f0')}<rect y="1260" width="1080" height="660" fill="#9aa8c2"/>`;
const swarm = (t, n, cx = 540, cy = 860, r = 300, fade = 1) => [...Array(n)].map((_, i) => B.bee(cx + Math.cos(t * (0.8 + hash(i, 1)) + i) * r * (0.4 + 0.6 * hash(i, 2)), cy + Math.sin(t * (1 + hash(i, 3)) + i * 2) * r * 0.6, 0.35 + 0.2 * hash(i, 4), t + i, { fade, rot: 10 * Math.sin(t * 3 + i) })).join('');

// ---------- the hook
at(0, (t, u) => `${meadow(t, HONEY)}${[[200, '#ff7eb6'], [420, '#ffd84a'], [660, '#c77dff'], [880, '#ff9f43']].map(([x, col], i) => B.flower(x, 1120 - (i % 2) * 60, 0.9, t, col)).join('')}${swarm(t, 8)}`);
at(W('hook', 'suddenly'), (t, u) => { const f = 1 - ease.inOut(u / 0.8);
  return `${meadow(t)}${[[200, '#ff7eb6'], [420, '#ffd84a'], [660, '#c77dff'], [880, '#ff9f43']].map(([x, col], i) => B.flower(x, 1120 - (i % 2) * 60, 0.9, t, col)).join('')}${swarm(t, 8, 540, 860, 300, f)}
  ${[...Array(8)].map((_, i) => u > 0.2 && u < 1.1 ? `<circle cx="${540 + Math.cos(i) * 300 * hash(i, 2)}" cy="${860 + Math.sin(i * 2) * 180}" r="${40 * (u - 0.2)}" fill="#fff" opacity="${0.6 * (1.1 - u)}"/>` : '').join('')}
  ${u > 0.8 ? `<g transform="translate(540 560) scale(${ease.back((u - 0.8) / 0.3)})">${G.outlined(0, 0, 100, '#fff', 'GONE.', 10)}</g>` : ''}`; });
// ---------- what the video is about
at(W('intro', 'no'), (t, u) => `${meadow(t)}${B.bee(540, 860, 2.4, t)}${[...Array(3)].map((_, i) => `<path d="M ${760 + i * 30} ${760 + i * 60} q 30 -20 60 0" stroke="#2a1d10" stroke-width="8" fill="none" opacity="${0.5 + 0.5 * Math.sin(t * 20 + i)}"/>`).join('')}${G.outlined(540, 520, 90, '#fff', 'BZZZZ', 9)}${I.xmark(830, 560, 0.8, u - 0.5)}`);
at(W('intro', 'no', 1), (t, u) => `${meadow(t)}<g transform="translate(540 860) scale(3)"><path d="M -40 0 L 40 0 L 0 120 Z" fill="#2a1d10"/></g>${G.outlined(540, 520, 90, '#fff', 'OUCH!', 9)}${I.xmark(830, 560, 0.8, u - 0.4)}`);
at(W('intro', 'sounds'), (t, u) => `${meadow(t, '#ffd84a')}${I.person(540, 1360, 1.5, { shirt: C.teal, pose: 'cheer', face: 'happy', t })}${I.bubbleSay(800, 560, 1, u - 0.2, 'Nice…?')}`);
at(W('intro', 'heres'), (t, u) => {
  const pts = [[250, 520], [780, 640], [300, 800], [780, 940], [280, 1100]], labels = ['DAY 1', 'MONTH 1', 'PRICES', 'THE TWIST', 'THE FIX'], kinds = ['bee', 'cart', 'tag', 'q', 'flower'];
  const ic = (k, x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})"><circle r="62" fill="#fff" filter="url(#soft)"/>${k === 'bee' ? B.bee(0, 0, 0.5, t) : k === 'flower' ? B.flower(0, 0, 0.45, t) : k === 'q' ? G.txt(0, 22, 64, '#8b5cf6', '?') : k === 'tag' ? G.txt(0, 18, 50, C.red, '$↑') : ''}</g>${k === 'cart' ? I.icon('cart', x, y, sc) : ''}`;
  let path = `M 540 420`; pts.forEach(([x, y]) => (path += ` L ${x} ${y}`));
  return `${night('#ffd84a')}<path d="${path}" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round" opacity="0.5"/>
  ${pts.map(([x, y], i) => u >= i * 0.25 ? `${ic(kinds[i], x, y, ease.back((u - i * 0.25) / 0.3))}<text x="${x + (x < 540 ? 90 : -90)}" y="${y + 14}" font-family="MontB" font-weight="900" font-size="42" fill="#fff" text-anchor="${x < 540 ? 'start' : 'end'}" opacity="${clamp((u - i * 0.25) * 4)}">${labels[i]}</text>` : '').join('')}`; });
// ---------- the picnic
at(W('relate', 'you'), (t, u) => `${B.picnic(t)}${[[300, C.coral], [540, C.teal], [780, C.yellow]].map(([x, col], i) => I.person(x + I.wobble(t, 12, u > 0.8 ? 10 : 0, i), 1300, 0.9, { shirt: col, pose: u > 0.8 ? 'panic' : 'stand', face: u > 0.8 ? 'panic' : 'happy', t, seed: i })).join('')}
  ${B.bee(540 + 200 * Math.sin(t * 3), 700 + 80 * Math.cos(t * 4), 0.8, t)}${u > 0.8 ? G.outlined(540, 520, 90, '#fff', 'AAAH!', 9) : ''}`);
at(W('relate', 'weirdly'), (t, u) => `${meadow(t, HONEY)}${B.bee(540, 860, 2.2, t)}${A.heart(820, 600, 1.4, C.coral)}${A.heart(260, 640, 1, '#ff8fa3')}`);
// ---------- day one
at(SAY.day1 - 0.95, (t, u) => `${meadow(t)}${[[200, '#ff7eb6'], [540, '#ffd84a'], [880, '#c77dff']].map(([x, col]) => B.flower(x, 1110, 0.9, t, col)).join('')}${I.stamp('DAY 1', u, 600)}`);
at(W('day1', 'nobody'), (t, u) => `${I.bg('#7cc7ff', '#cfeaff')}${I.cityline(1150, t, 0.2, '#5b6b9a', 4)}<rect y="1150" width="1080" height="770" fill="#9aa3b8"/>
  ${[[200, C.teal], [540, C.coral], [880, C.yellow]].map(([x, col], i) => I.person(x + ((t * 40 * (i % 2 ? 1 : -1)) % 80), 1360, 0.8, { shirt: col, pose: 'walk', t, seed: i, flip: i % 2 ? 1 : -1 })).join('')}${G.outlined(540, 560, 80, '#fff', 'NOBODY NOTICES', 8)}`);
at(W('day1', 'but'), (t, u) => `${I.bg('#ffd27a', '#ffb347', '#fff3b0', 820)}<path d="M 340 740 L 740 740 L 700 1160 Q 540 1220 380 1160 Z" fill="${HONEY}" opacity="0.95" filter="url(#drop)"/><rect x="330" y="700" width="420" height="60" rx="20" fill="#c98f4a"/>
  ${G.txt(540, 990, 90, '#7a4a00', 'HONEY')}${B.bee(840, 640, 0.9, t)}${G.outlined(540, 520, 70, '#fff', 'NOT JUST HONEY', 8)}`);
at(W('day1', 'they'), (t, u) => { const p = (u % 1.6) / 1.6, bx = lerp(260, 820, ease.inOut(p)), by = 760 - 160 * Math.sin(Math.PI * p);
  return `${meadow(t)}${B.flower(260, 900, 1.3, t, '#ff7eb6', 1)}${B.flower(820, 900, 1.3, t, '#c77dff', p > 0.9 ? 1 : 0.5)}
  ${B.bee(bx, by, 0.8, t, { rot: p < 0.5 ? -10 : 10 })}${[0, 1, 2].map((i) => `<circle cx="${bx - 20 + i * 14}" cy="${by + 40}" r="7" fill="#f0a500"/>`).join('')}<path d="M 260 760 Q 540 520 820 760" stroke="#fff" stroke-width="6" stroke-dasharray="12 12" fill="none" opacity="0.6"/>`; });
at(W('day1', 'thats'), (t, u) => { const k = ease.out(u / 1.2);
  return `${meadow(t)}<rect x="500" y="900" width="80" height="400" fill="#8a5a3c"/><circle cx="540" cy="800" r="300" fill="#6ab04c"/>${[...Array(9)].map((_, i) => { const fx = 380 + (i % 3) * 160 + (hash(i, 1) - 0.5) * 40, fy = 680 + Math.floor(i / 3) * 120;
    return `<circle cx="${fx}" cy="${fy}" r="${lerp(12, 44, k)}" fill="${k > 0.5 ? C.red : '#fff'}"/>${k > 0.5 ? `<rect x="${fx - 3}" y="${fy - 54}" width="6" height="16" fill="#5a3a26"/>` : ''}`; }).join('')}`; });
// ---------- month one: the supermarket
at(SAY.store - 0.15, (t, u) => `${store()}${B.produce(540, 860, 0.95, t, 1)}${I.stamp('MONTH 1', u, 520)}`);
at(W('store', 'you'), (t, u) => `${store()}${B.produce(540, 820, 0.9, t, 1)}${I.person(lerp(-100, 300, ease.out(u / 1.2)), 1450, 0.85, { shirt: C.coral, pose: u < 1.2 ? 'walk' : 'stand', t })}`);
at(W('store', 'apples'), (t, u) => `${store()}${B.produce(540, 820, 0.9, t, 1 - ease.inOut(u / 2.4))}`);
at(W('store', 'more'), (t, u) => { const p = 0.75 * ease.out(u / 1.2);
  return `${night(HONEY)}${A.pie(540, 860, 1, p, HONEY)}${G.outlined(540, 900, 150, '#fff', `${Math.round(p * 100)}%`, 12)}${G.outlined(540, 470, 64, C.yellow, 'OF MAIN FOOD CROPS', 8)}${G.outlined(540, 1270, 60, '#fff', 'GET HELP FROM BEES', 7)}`; });
// ---------- prices
at(SAY.prices, (t, u) => `${store()}<g transform="translate(540 860)"><path d="M 0 -200 L 160 0 L 60 0 L 60 220 L -60 220 L -60 0 L -160 0 Z" fill="${C.red}" filter="url(#drop)" transform="translate(0 ${-30 * ease.out(u / 0.6)})"/></g>${G.outlined(540, 1300, 90, C.red, 'PRICES UP', 9)}`);
at(W('prices', 'coffee'), (t, u) => `${I.bg('#2b1c18', '#4a2d22', '#ff9a52', 760)}<rect x="0" y="1090" width="1080" height="830" fill="#3a2419"/><rect x="0" y="1060" width="1080" height="56" fill="url(#woodTop)"/>
  ${I.cup(300, 960, 1.15, t)}${B.avocado(760, 920, 1.3)}${B.tag(300, 1260, 0.9, 'COFFEE', 4.9, 6.9, u / 1.2)}${B.tag(760, 1260, 0.9, 'AVOCADO', 1.5, 2.9, (u - 0.4) / 1.2)}`);
at(W('prices', 'cows'), (t, u) => `${meadow(t)}${B.cow(480, 1150, 1.25, t)}<g transform="translate(880 1180)">${[0, 1, 2, 3].map((i) => `<path d="M ${-60 + i * 40} 0 q 10 -80 ${i % 2 ? 20 : -20} -140" stroke="#4c7a2a" stroke-width="10" fill="none"/><circle cx="${-60 + i * 40 + (i % 2 ? 20 : -20)}" cy="-140" r="16" fill="#9b6bd6"/>`).join('')}</g>
  ${G.outlined(540, 560, 64, '#fff', 'CLOVER & ALFALFA', 7)}`);
at(W('prices', 'so'), (t, u) => `${store()}${B.milk(380, 860, 1.6)}${B.tag(720, 860, 1.2, 'MILK', 3.2, 4.4, u / 1.0)}`);
// ---------- the twist
at(SAY.twist - 0.1, (t, u) => `${I.bg('#120a2e', '#3a1a6b', '#c77dff', 820)}${G.stars(t, 40, 12)}
  <g transform="translate(540 820) rotate(${u * 40})" opacity="0.5">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M 0 0 L ${Math.cos(i) * 600} ${Math.sin(i) * 600}" stroke="#c77dff" stroke-width="40" opacity="0.3"/>`).join('')}</g>${I.stamp('THE TWIST', u, 860)}`);
at(W('twist', 'we'), (t, u) => `${I.bg('#14532d', '#22a35a', '#ffd84a', 820)}${I.person(540, 1360, 1.5, { shirt: C.yellow, pose: 'stand', face: 'happy', t })}${I.check(800, 560, 1, u - 0.3)}${G.outlined(540, 520, 80, '#fff', "WE'D BE OK", 8)}`);
at(W('twist', 'wheat'), (t, u) => `${I.bg('#ffd27a', '#ffe9b0')}<rect y="1200" width="1080" height="720" fill="#c9a66b"/>${B.wind(t)}${B.grains(540, 1200, 1.3, t)}${G.outlined(540, 500, 70, '#fff', 'POLLINATED BY WIND', 8)}`);
at(W('twist', 'our'), (t, u) => {
  return `${I.bg('#2a1f5c', '#4b3a8c', '#ff5e5b', 820)}${B.plate(540, 960, 1.4)}${G.outlined(540, 620, 100, '#fff', 'BORING…', 10)}${u > 1.2 ? `${B.tag(540, 1300, 1.0, 'DINNER', 8, 14, (u - 1.2) / 0.8)}` : ''}`; });
// ---------- could it happen?
at(SAY.real, (t, u) => `${meadow(t)}${B.bee(540, 1000, 1.5, t)}<text x="540" y="${600 + 10 * Math.sin(t * 4)}" font-family="MontB" font-weight="900" font-size="300" fill="${C.yellow}" text-anchor="middle" stroke="#000" stroke-width="12" paint-order="stroke" transform="rotate(${6 * Math.sin(t * 3)} 540 500)">?</text>`);
at(W('real', 'in'), (t, u) => `${I.bg('#ffe0ea', '#cfeaff')}<rect y="1220" width="1080" height="700" fill="#8bc77b"/>${B.handPollinate(420, 1200, 1.0, t)}${G.outlined(540, 470, 70, C.red, 'CHINA · BY HAND', 8)}`);
at(W('real', 'and'), (t, u) => { const v = Math.round(577 * ease.out(u / 1.6));
  return `${night('#34c759')}${[...Array(14)].map((_, i) => I.cash(540 + (i % 3 - 1) * 70, 1330 - i * 26 * clamp(u * 1.5), 1, (i % 2 ? 4 : -4))).join('')}
  ${G.outlined(540, 720, 180, '#7dffa6', `$${v}B`, 12)}${G.outlined(540, 820, 60, '#fff', '(€530B) EVERY YEAR', 8)}`; });
// ---------- the fix
at(W('end', 'the'), (t, u) => `${meadow(t, HONEY)}${B.bee(540, 860, 2.0, t)}${G.outlined(540, 520, 90, '#fff', 'GOOD NEWS', 9)}`);
at(W('end', 'planting'), (t, u) => `${meadow(t)}${[...Array(9)].map((_, i) => { const k = ease.back((u - i * 0.1) / 0.4); return `<g transform="translate(${130 + i * 102} ${1160 - (i % 2) * 50}) scale(${0.75 * k})">${B.flower(0, 0, 1, t, ['#ff7eb6', '#ffd84a', '#c77dff', '#ff9f43'][i % 4])}</g>`; }).join('')}${swarm(t, Math.floor(clamp(u / 1.2) * 6), 540, 820, 380)}`);
at(W('end', 'using'), (t, u) => `${meadow(t, C.green)}${B.sprayX(300, 860, 1.4)}${[[700, '#ff7eb6'], [860, '#ffd84a']].map(([x, col]) => B.flower(x, 1050, 1, t, col)).join('')}${swarm(t, 5, 780, 760, 220)}${I.check(780, 520, 0.8, u - 0.6)}`);
// ---------- the question
const ASK = ['WHICH FOOD WOULD', 'YOU MISS?'], OPTS = ['Apples', 'Coffee', 'Almonds', 'Avocado'];
at(SAY.cta, (t, u) => `${night('#ffd84a')}${A.commentBox(540, 860, 1, t, u, ASK, OPTS)}`);
at(W('cta', 'tell'), (t, u) => `${night('#ffd84a')}${A.commentBox(540, 800, 0.9, t, 2, ASK, OPTS)}
  <g transform="translate(540 1220) scale(${1 + 0.08 * Math.sin(t * 10)})"><rect x="-120" y="-80" width="240" height="160" rx="40" fill="#fff"/><path d="M -40 70 L -70 130 L 10 70 Z" fill="#fff"/>
  ${[-50, 0, 50].map((x, i) => `<circle cx="${x}" cy="0" r="16" fill="${C.ink}" opacity="${0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i))}"/>`).join('')}</g>`);

// ------------------------------------------------------------------ time since the bees vanished
const STAMPS = [SAY.day1 - 0.95, SAY.store - 0.15, SAY.twist - 0.1];
const months = X.keyed([[SAY.day1 - 0.9, 0], [SAY.store - 0.2, 1], [SAY.prices, 2], [SAY.twist - 0.3, 3]]);
function goal(t) {
  const a = X.smooth(SAY.day1 - 1.0, SAY.day1 - 0.6, t) * (1 - X.smooth(SAY.twist - 0.4, SAY.twist - 0.1, t));
  if (a <= 0) return null;
  const m = months(t), ticks = [1, 2].map((n) => ({ k: n / 3, on: m >= n, pop: Math.exp(-Math.pow((m - n) * 3, 2)) }));
  return { label: 'BEES LEFT: 0', pct: m < 1 ? 'DAY 1' : `MONTH ${Math.floor(m)}`, k: m / 3, from: 'DAY 1', to: 'MONTH 3', alpha: a, ticks };
}

// ------------------------------------------------------------------ sound
function buildAudio() {
  const { A: L, fx, S_, music } = X.audioBase(VO, ORDER, SAY, DURATION, cuts(), STAMPS);
  music('music/322.mp3', 0, SAY.twist + 0.6, { offset: 2, level: 0.45 });
  music('music/606.mp3', SAY.twist - 0.3, DURATION - SAY.twist + 0.3, { offset: 14, level: 0.55, fin: 0.8 });
  const buzz = (t0, t1, level = 0.12) => { for (let t = t0; t < t1; t += 0.5) fx('buzz', { t, n: 1, level }); };
  // hook: buzzing meadow, then silence
  L.push(S_('sfx/1238.wav', 0, { dur: W('hook', 'suddenly') + 0.6, level: 0.22, fin: 0.1, fout: 0.4, fx: true }));
  buzz(0, W('hook', 'suddenly') + 0.3, 0.1);
  fx('sample', { file: 'sfx/2350.wav', t: W('hook', 'suddenly') + 0.1, level: 0.25 });
  L.push({ type: 'subdrop', t: W('hook', 'suddenly') + 0.8, dur: 0.9, level: 0.3, free: true });
  // intro
  buzz(W('intro', 'no'), W('intro', 'no') + 0.6, 0.14);
  fx('beep', { t: W('intro', 'no') + 0.52, f: 330, n: 1, dur: 0.12, level: 0.2 });
  fx('beep', { t: W('intro', 'no', 1) + 0.42, f: 330, n: 1, dur: 0.12, level: 0.2 });
  fx('ding', { t: W('intro', 'sounds') + 0.2, f: 880, level: 0.12 });
  for (let i = 0; i < 5; i++) fx('pop', { t: W('intro', 'heres') + i * 0.25, f: 700 + i * 90, level: 0.2 });
  // picnic
  L.push(S_('sfx/367.wav', W('relate', 'you') - 0.2, { offset: 2, dur: W('relate', 'weirdly') - W('relate', 'you') + 0.3, level: 0.2, fin: 0.2, fout: 0.3, fx: true }));
  buzz(W('relate', 'you'), W('relate', 'weirdly'), 0.12);
  fx('sample', { file: 'sfx/351.wav', t: W('relate', 'you') + 0.8, level: 0.08, dur: 0.8, fout: 0.3 });
  fx('chime', { t: W('relate', 'weirdly') + 0.3, level: 0.08, freq: 784 });
  // day one
  L.push(S_('sfx/361.wav', W('day1', 'nobody'), { dur: W('day1', 'but') - W('day1', 'nobody'), level: 0.15, fin: 0.2, fout: 0.3, fx: true }));
  fx('pop', { t: W('day1', 'but') + 0.2, f: 600, level: 0.15 });
  buzz(W('day1', 'they'), W('day1', 'thats'), 0.12);
  for (let i = 0; i < 9; i++) fx('pop', { t: W('day1', 'thats') + 0.5 + i * 0.07, f: 900 + i * 40, level: 0.1 });
  // the supermarket
  L.push(S_('sfx/361.wav', SAY.store - 0.2, { dur: SAY.prices - SAY.store, level: 0.12, fin: 0.3, fout: 0.3, fx: true }));
  for (let i = 0; i < 12; i++) fx('pop', { t: W('store', 'apples') + 0.1 + i * 0.2, f: 400 + hash(i, 1) * 400, level: 0.1, pan: -0.5 + hash(i, 2) });
  fx('count', { t0: W('store', 'more'), t1: W('store', 'more') + 1.2, from: 22, to: 40, level: 0.07, seed: 3 });
  // prices
  fx('kaching', { t: SAY.prices + 0.2, level: 0.3 });
  fx('count', { t0: W('prices', 'coffee') + 0.1, t1: W('prices', 'coffee') + 1.4, from: 26, to: 44, level: 0.06, seed: 4 });
  fx('sample', { file: 'sfx/1117.wav', t: W('prices', 'cows') + 0.3, level: 0.2 });
  fx('kaching', { t: W('prices', 'so') + 0.8, level: 0.25 });
  // the twist
  fx('sample', { file: 'sfx/2915.wav', t: SAY.twist - 0.1, level: 0.35, dur: 1.6, fout: 0.4 });
  fx('ding', { t: W('twist', 'we') + 0.35, f: 1046.5, level: 0.13 });
  L.push(S_('sfx/1267.wav', W('twist', 'wheat'), { dur: W('twist', 'our') - W('twist', 'wheat') + 0.2, level: 0.22, fin: 0.3, fout: 0.3, fx: true }));
  fx('beep', { t: W('twist', 'our') + 0.3, f: 220, n: 1, dur: 0.3, level: 0.1 });
  // could it happen
  fx('creak', { t0: SAY.real + 0.1, t1: SAY.real + 0.7, level: 0.12 });
  fx('rustle', { t0: W('real', 'in') + 0.3, t1: W('real', 'in') + 1.6, level: 0.12 });
  fx('kaching', { t: W('real', 'and') + 0.3, level: 0.28 });
  fx('count', { t0: W('real', 'and') + 0.3, t1: W('real', 'and') + 1.8, from: 22, to: 44, level: 0.07, seed: 8 });
  // the fix
  L.push(S_('sfx/1238.wav', W('end', 'the'), { dur: SAY.cta - W('end', 'the'), level: 0.2, fin: 0.3, fout: 0.4, fx: true }));
  buzz(W('end', 'planting') + 0.4, SAY.cta - 0.2, 0.1);
  for (let i = 0; i < 9; i++) fx('pop', { t: W('end', 'planting') + 0.1 + i * 0.1, f: 600 + i * 60, level: 0.12 });
  fx('chime', { t: W('end', 'using') + 0.65, level: 0.1, freq: 659.25 });
  // the question
  for (let i = 0; i < 4; i++) fx('pop', { t: SAY.cta + 0.2 + i * 0.15, f: 600 + i * 120, level: 0.18 });
  fx('ding', { t: W('cta', 'comments') + 0.3, level: 0.15 });
  return L;
}

export default X.scenario({ id: 'bees', title: 'What if all the bees disappeared?', DURATION, FADE, CSS: X.css(HONEY, '#ffd84a'),
  caps: X.captions(VO, ORDER, SAY, NUMS, KEYWORDS), audio: buildAudio(), goal, svgFrame: frame });
export const _debug = { SAY, DURATION, S, wordT: W };
export { svgAt };
