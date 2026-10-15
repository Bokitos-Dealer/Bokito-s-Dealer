// What if Yellowstone erupted? — illustrated explainer (plumbing in explainer.js).
// Facts: USGS — yearly chance of another caldera-forming eruption ≈ 1 in 730,000, and Yellowstone is not "overdue"; last
// caldera-forming eruption ~631,000 years ago (Lava Creek Tuff); Mastin et al. 2014 (USGS Ash3d): metres of ash near the
// park, cm–dm in the northern Midwest, mm–cm on the coasts; Tambora 1815 → 1816 "Year Without a Summer"; the most likely
// future events are hydrothermal explosions and lava flows.
import VO from './yellowstone.vo.js';
import * as I from './ill2d.js';
import * as G from './ill2d-grid.js';
import * as A from './ill2d-ai.js';
import * as V from './ill2d-volcano.js';
import * as X from './explainer.js';

const { C, ease, clamp, lerp, hash } = I;
const { LAVA, ASH } = V;

const ORDER = ['hook', 'intro', 'relate', 'signs', 'blast', 'ash', 'summer', 'twist', 'real', 'end', 'cta'];
const GAP = { hook: 0.1, intro: 0.3, relate: 0.35, signs: 1.0, blast: 0.4, ash: 0.55, summer: 0.4, twist: 0.5, real: 0.4, end: 0.45, cta: 0.35 };
const { SAY, W, FADE, DURATION } = X.timeline(VO, ORDER, GAP);

const NUMS = [['week one', 'WEEK 1'], ['week 1', 'WEEK 1'], ['twenty kilometers', '20 KM (12 MILES)'], ['20 kilometers', '20 KM (12 MILES)'], ['week two', 'WEEK 2'], ['week 2', 'WEEK 2'],
  ['a few centimeters', 'A FEW CM (~1 IN)'], ['one in seven hundred thirty thousand', '1 IN 730,000'], ['1 in 730,000', '1 IN 730,000'],
  ['six hundred thirty thousand years', '630,000 YEARS'], ['630,000 years', '630,000 YEARS'], ['1815', '1815'], ['eighteen fifteen', '1815']];
const KEYWORDS = /^(yellowstone|today|supervolcano|park|soda|rock|wyoming|earthquakes|swell|alarm|blows|ash|sky|evacuated|america|roofs|roads|planes|farms|sunlight|colder|crops|crazy|overdue|chance|indonesia|summer|steam|lava|movies|visit|comments)$/i;

// ------------------------------------------------------------------ backgrounds
const { S, at, frame, svgAt, cuts } = X.stack();
const night = (glow = null, gy = 820) => I.bg('#0e1530', '#1d2a55', glow, gy);
const hot = (glow = LAVA) => I.bg('#1a0a06', '#3a160c', glow, 860);

// ---------- the hook
at(0, (t, u) => `${V.park(t, { geyser: 0.7 })}${G.outlined(540, 520, 100, '#fff', 'YELLOWSTONE', 10)}`);
at(W('hook', 'erupted'), (t, u) => { const sh = 14 * Math.exp(-u * 3);
  return `<g transform="translate(${I.wobble(t, 30, sh)} ${I.wobble(t, 30, sh, 2)})">${hot()}${V.column(540, 1250, 1, t, ease.out(u / 1.2))}<rect y="1250" width="1080" height="670" fill="#2a1a12"/></g>`; });
at(W('hook', 'today'), (t, u) => `${V.park(t, { geyser: 0, ash: 1 })}${V.ashFall(t, 70)}<g transform="translate(540 600) scale(${ease.back(u / 0.3)})">${G.outlined(0, 0, 120, C.yellow, 'TODAY', 11)}</g>`);
// ---------- what the video is about
at(W('intro', 'not'), (t, u) => `${I.bg('#7cc7ff', '#d6efff')}<path d="M 240 1260 L 540 760 L 840 1260 Z" fill="#8a7a6a"/><path d="M 470 880 L 540 760 L 610 880 Q 540 900 470 880 Z" fill="#fff"/>
  <rect y="1260" width="1080" height="660" fill="#8bc77b"/>${G.outlined(540, 560, 80, '#fff', 'A NORMAL VOLCANO', 8)}${I.xmark(840, 760, 0.85, u - 0.6)}`);
at(W('intro', 'supervolcano'), (t, u) => `${V.crossSection(t, { glow: 0.6 + 0.4 * ease.out(u / 1.2) })}${G.outlined(540, 520, 90, LAVA, 'SUPERVOLCANO', 10)}${u > 1 ? G.outlined(540, 640, 52, '#fff', 'UNDER A NATIONAL PARK', 6) : ''}`);
at(W('intro', 'heres'), (t, u) => {
  const pts = [[250, 520], [780, 640], [300, 800], [780, 940], [280, 1100]], labels = ['WEEK 1', 'ERUPTION', 'WEEK 2', 'THE TWIST', 'THE ODDS'];
  const kinds = ['bell', 'radio', 'cart', 'bulb', 'people'];
  let path = `M 540 420`; pts.forEach(([x, y]) => (path += ` L ${x} ${y}`));
  return `${night('#ffd84a')}<path d="${path}" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round" opacity="0.5"/>
  ${pts.map(([x, y], i) => u >= i * 0.25 ? `<g transform="translate(${x} ${y}) scale(${ease.back((u - i * 0.25) / 0.3)})"><circle r="62" fill="#fff" filter="url(#soft)"/>${['<path d="M -40 10 L -20 -10 L 0 20 L 20 -30 L 40 10" stroke="#ff3b3b" stroke-width="10" fill="none" stroke-linejoin="round"/>', `<path d="M -40 40 L 0 -36 L 40 40 Z" fill="#8a7a6a"/><circle cy="-40" r="16" fill="${LAVA}"/>`, `<circle r="40" fill="${ASH}"/>`, '<text y="22" font-size="64" text-anchor="middle" font-family="MontB" font-weight="900" fill="#8b5cf6">?</text>', '<text y="16" font-size="40" text-anchor="middle" font-family="MontB" font-weight="900" fill="#0e1220">1:730K</text>'][i]}</g>
    <text x="${x + (x < 540 ? 90 : -90)}" y="${y + 14}" font-family="MontB" font-weight="900" font-size="42" fill="#fff" text-anchor="${x < 540 ? 'start' : 'end'}" opacity="${clamp((u - i * 0.25) * 4)}">${labels[i]}</text>` : '').join('')}`; });
// ---------- the soda
at(W('relate', 'you'), (t, u) => { const to = W('relate', 'open') - W('relate', 'you');
  return `${I.bg('#2b2260', '#463a8c', '#ffd84a', 820)}${V.soda(540, 900, 1.5, t, u > to ? clamp((u - to) / 0.4) : 0)}${u > to ? G.outlined(540, 460, 100, '#fff', 'PSSSHHH!', 10) : ''}`; });
at(W('relate', 'but'), (t, u) => `${V.crossSection(t, { glow: 1 })}${G.outlined(540, 520, 70, '#fff', 'MELTED ROCK', 8)}${G.outlined(540, 1420, 60, C.yellow, 'UNDER WYOMING', 7)}`);
// ---------- week one: the warning signs
at(SAY.signs - 0.95, (t, u) => `${V.park(t, { geyser: 0.6 })}${I.stamp('WEEK 1', u, 560)}`);
at(W('signs', 'small'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ff5e5b', 820)}<g transform="translate(${I.wobble(t, 20, 4)} 0)">${V.seismo(540, 860, 1.05, t, 0.6 + 0.4 * Math.sin(t))}</g>`);
at(W('signs', 'ground'), (t, u) => `${V.crossSection(t, { glow: 0.8, swell: ease.inOut(u / 1.6) })}<g transform="translate(540 ${560 - 50 * ease.inOut(u / 1.6)})"><path d="M 0 -60 L 50 0 L 20 0 L 20 60 L -20 60 L -20 0 L -50 0 Z" fill="${C.yellow}"/></g>`);
at(W('signs', 'scientists'), (t, u) => `${I.bg('#0e1530', '#1d2a55')}<rect x="140" y="420" width="800" height="440" rx="24" fill="#05070f"/>
  <g transform="translate(340 640) scale(0.45)">${V.seismo(0, 0, 1, t, 1)}</g><g transform="translate(740 640) scale(0.45)"><rect x="-420" y="-220" width="840" height="440" rx="24" fill="${Math.floor(t * 3) % 2 ? C.red : '#8a1c1c'}"/>${G.txt(0, 40, 130, '#fff', 'ALERT')}</g>
  <rect y="1190" width="1080" height="730" fill="#141b33"/>${[[360, 0], [720, 1]].map(([x, i]) => `${I.person(x, 1300, 0.9, { shirt: '#f6f7fb', pose: i ? 'talk' : 'wave', t, seed: i, flip: i ? -1 : 1, face: 'panic' })}`).join('')}`);
// ---------- it blows
at(SAY.blast, (t, u) => { const sh = 18 * Math.exp(-u * 2.5);
  return `<g transform="translate(${I.wobble(t, 30, sh)} ${I.wobble(t, 30, sh, 2)})">${hot()}${V.column(540, 1250, 1, t, ease.out(u / 1.6))}<rect y="1250" width="1080" height="670" fill="#2a1a12"/></g>
  <rect width="1080" height="1920" fill="#fff" opacity="${0.6 * Math.exp(-u * 8)}"/>`; });
at(W('blast', 'column'), (t, u) => `${I.bg('#4a3a5c', '#9a7a7a', LAVA, 1100)}${V.column(540, 1350, 0.85, t, 1)}<rect y="1350" width="1080" height="570" fill="#3a2a22"/>
  <line x1="140" y1="1350" x2="140" y2="${1350 - 900 * ease.out(u / 1.2)}" stroke="#fff" stroke-width="8"/>${[0, 1, 2, 3, 4].map((i) => `<line x1="120" y1="${1350 - i * 225}" x2="160" y2="${1350 - i * 225}" stroke="#fff" stroke-width="6"/>`).join('')}
  ${u > 1 ? G.outlined(300, 470, 64, C.yellow, '20+ KM', 8) : ''}`);
at(W('blast', 'everyone'), (t, u) => `${I.bg('#6f6a66', '#9a948e')}${V.ashFall(t, 40, 0.6)}<rect y="1150" width="1080" height="770" fill="#7a7670"/><rect y="1240" width="1080" height="130" fill="#4a4a52"/>
  ${[0, 1, 2, 3].map((i) => V.car(((t * 220 + i * 300) % 1400) - 200, 1310, 0.8, [C.coral, C.blue, C.yellow, C.teal][i], t)).join('')}
  <g transform="translate(860 1100)"><rect x="-6" y="0" width="12" height="140" fill="#5b6378"/><rect x="-150" y="-80" width="300" height="100" rx="12" fill="${C.green}"/>${G.txt(0, -15, 40, '#fff', 'EVACUATE →')}</g>`);
// ---------- week two: ash
at(SAY.ash - 0.15, (t, u) => `${V.park(t, { geyser: 0, ash: 1 })}${V.ashFall(t, 60)}${I.stamp('WEEK 2', u, 560)}`);
at(W('ash', 'ash'), (t, u) => `${night('#9a948e')}${V.ashMap(540, 860, 1.1, t, ease.inOut(u / 2), [[95, -100, 'CHICAGO', 'CM'], [305, -80, 'NEW YORK', 'MM']])}${G.outlined(540, 480, 64, '#fff', 'ASH ACROSS THE US', 8)}`);
at(W('ash', 'near'), (t, u) => `${I.bg('#6f6a66', '#9a948e')}${V.ashFall(t, 80)}<rect y="1240" width="1080" height="680" fill="${ASH}"/>${V.ashRoof(540, 1250, 1, ease.inOut(u / 1.6))}
  ${u > 1.2 ? `<g transform="translate(540 600) scale(${ease.back((u - 1.2) / 0.3)})">${G.outlined(0, 0, 80, C.red, 'ROOFS CRUSHED', 9)}</g>` : ''}`);
at(W('ash', 'far'), (t, u) => { const tiles = [['ROADS', (x, y) => V.car(x, y, 0.8, C.coral, t)], ['PLANES', (x, y) => I.plane(x, y, 0.45, 0)], ['FARMS', (x, y) => V.crops(x, y + 40, 0.3, t, 1)]];
  return `${I.bg('#8a8680', '#b9b4ae')}${V.ashFall(t, 40, 0.5)}${G.outlined(540, 460, 70, '#fff', 'A FEW CM (~1 IN)', 8)}
  ${tiles.map(([l, d], i) => { const k = clamp((u - 0.6 - i * 0.3) / 0.3), y = 720 + i * 230; return k > 0 ? `<g transform="translate(540 ${y}) scale(${ease.back(k)})"><rect x="-400" y="-100" width="800" height="200" rx="30" fill="#fff" opacity="0.9" filter="url(#drop)"/>
    ${d(-220, 20)}${G.txt(150, 22, 64, C.ink, l)}${I.xmark(330, 0, 0.45, 1)}</g>` : ''; }).join('')}`; });
// ---------- the weather
at(SAY.summer, (t, u) => { const dim = ease.inOut(u / 1.5);
  return `${I.bg(lerp(0, 1, dim) > 0.5 ? '#8a9aaa' : '#7cc7ff', '#d6efff')}<circle cx="540" cy="700" r="140" fill="#ffe09a" opacity="${1 - 0.6 * dim}"/>
  <rect width="1080" height="1300" fill="#7a7670" opacity="${0.55 * dim}"/><rect y="1150" width="1080" height="770" fill="#8bc77b"/>`; });
at(W('summer', 'ash'), (t, u) => `${I.bg('#8a9aaa', '#c9d6f0')}<circle cx="540" cy="620" r="140" fill="#ffe09a" opacity="0.5"/>${[...Array(8)].map((_, i) => `<ellipse cx="${((t * 30 + i * 180) % 1400) - 160}" cy="${560 + (i % 3) * 60}" rx="160" ry="50" fill="#7a7670" opacity="0.7"/>`).join('')}
  ${[0, 1, 2, 3].map((i) => { const p = clamp((u - i * 0.15) / 0.6); return `<line x1="${380 + i * 110}" y1="760" x2="${380 + i * 110}" y2="${760 + 300 * p}" stroke="#ffe09a" stroke-width="10" stroke-dasharray="20 14" opacity="${0.6 * (1 - p)}"/>`; }).join('')}
  <rect y="1150" width="1080" height="770" fill="#8bc77b"/>${G.outlined(540, 1320, 64, '#fff', 'LESS SUNLIGHT', 7)}`);
at(W('summer', 'summers'), (t, u) => `${I.bg('#8a9aaa', '#c9d6f0')}<rect y="1150" width="1080" height="770" fill="#a8c4a0"/>${G.thermometer(740, 1180, 1.05, lerp(0.6, 0.2, ease.inOut(u / 1.4)))}
  ${I.person(340, 1300, 1.1, { shirt: C.teal, face: 'panic', t })}${G.outlined(340, 560, 70, '#fff', 'COLD JULY?', 8)}`);
at(W('summer', 'crops'), (t, u) => `${I.bg('#8a9aaa', '#c9d6f0')}<rect y="1150" width="1080" height="770" fill="#8a7a5a"/>${V.crops(540, 1150, 1.2, t, ease.inOut(u / 1.4))}`);
// ---------- the twist
at(SAY.twist - 0.1, (t, u) => `${I.bg('#120a2e', '#3a1a6b', '#c77dff', 820)}${G.stars(t, 40, 12)}
  <g transform="translate(540 820) rotate(${u * 40})" opacity="0.5">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M 0 0 L ${Math.cos(i) * 600} ${Math.sin(i) * 600}" stroke="#c77dff" stroke-width="40" opacity="0.3"/>`).join('')}</g>${I.stamp('THE TWIST', u, 860)}`);
at(W('twist', 'yellowstone'), (t, u) => `${V.park(t, { geyser: 0.5 })}<g transform="translate(540 600) scale(${ease.back(u / 0.3)})">${G.outlined(0, 0, 110, '#fff', 'OVERDUE?', 11)}</g>${I.xmark(540, 830, 0.9, u - 0.7)}`);
at(W('twist', 'scientists'), (t, u) => { const n = Math.floor(ease.out(u / 1.6) * 600);
  let g = ''; for (let i = 0; i < n; i++) g += `<circle cx="${160 + (i % 30) * 26}" cy="${560 + Math.floor(i / 30) * 30}" r="9" fill="${i === 377 ? LAVA : '#5b6b9a'}"/>`;
  return `${night('#ffd84a')}${g}${n > 377 ? `<circle cx="${160 + (377 % 30) * 26}" cy="${560 + Math.floor(377 / 30) * 30}" r="${24 + 6 * Math.sin(t * 6)}" fill="none" stroke="${C.yellow}" stroke-width="5"/>` : ''}
  ${G.outlined(540, 470, 100, C.yellow, '1 IN 730,000', 10)}${G.outlined(540, 1260, 56, '#fff', 'CHANCE EACH YEAR', 7)}`; });
// ---------- could it happen?
at(SAY.real, (t, u) => `${V.crossSection(t, { glow: 0.4 })}<text x="540" y="${560 + 10 * Math.sin(t * 4)}" font-family="MontB" font-weight="900" font-size="300" fill="${C.yellow}" text-anchor="middle" stroke="#000" stroke-width="12" paint-order="stroke" transform="rotate(${6 * Math.sin(t * 3)} 540 460)">?</text>`);
at(W('real', 'the'), (t, u) => `${I.bg('#3a2a1a', '#5a4026', '#ffd27a', 820)}${G.outlined(540, 760, 150, C.yellow, Math.round(ease.out(u / 1.6) * 631000).toLocaleString('en-US'), 13)}${G.outlined(540, 880, 70, '#fff', 'YEARS AGO', 8)}
  ${[0, 1, 2].map((i) => `<g transform="translate(${300 + i * 240} 1250) scale(0.5)">${I.person(0, 0, 1, { shirt: '#7a5a3a', hair: '#2a1a10', t, seed: i })}</g>`).join('')}`);
at(W('real', 'and'), (t, u) => `${I.bg('#1a0a06', '#3a160c', LAVA, 860)}<path d="M 200 1280 L 540 820 L 880 1280 Z" fill="#5a4a3e"/>${V.column(540, 830, 0.6, t, ease.out(u / 1))}<rect y="1280" width="1080" height="640" fill="#2a3a5a"/>
  ${G.outlined(540, 1420, 70, '#fff', 'INDONESIA · 1815', 8)}`);
at(W('real', 'next'), (t, u) => { const k = ease.out(u / 0.6);
  return `${I.bg('#c9d6f0', '#eef1f8')}${[...Array(40)].map((_, i) => { const p = (t * 0.2 + hash(i, 1)) % 1; return `<circle cx="${hash(i, 2) * 1080}" cy="${300 + p * 1500}" r="6" fill="#fff"/>`; }).join('')}
  ${G.paper(540, 860, lerp(0.2, 1, k), lerp(-540, -4, k), { date: 'JULY, 1816', h1: 'SNOW IN JULY!', h2: 'NO SUMMER',
    art: `<rect x="-300" y="-20" width="300" height="220" fill="#dfe8f5"/>${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${-270 + i * 50}" cy="${20 + (i % 3) * 50}" r="6" fill="#9aa8c2"/>`).join('')}<rect x="-300" y="150" width="300" height="50" fill="#fff"/>` })}`; });
// ---------- the likely future
at(W('end', 'the'), (t, u) => `${V.park(t, { geyser: 0.4 })}${G.outlined(540, 520, 84, '#fff', 'MUCH MORE LIKELY', 9)}`);
at(W('end', 'small'), (t, u) => `${V.park(t, { geyser: 0 })}${V.steamBlast(540, 1200, 1.2, t, u)}${u > 1.2 ? `<g transform="translate(800 1150) scale(0.7)"><path d="M -200 0 Q -100 -40 0 -20 Q 100 0 200 -30 L 200 30 L -200 30 Z" fill="${LAVA}" filter="url(#glow)"/></g>` : ''}`);
at(W('end', 'scary'), (t, u) => `${V.park(t, { geyser: 0.8 })}${[[200, C.teal], [360, C.coral], [820, C.yellow]].map(([x, col], i) => I.person(x, 1340, 0.7, { shirt: col, pose: 'panic', face: 'panic', t, seed: i })).join('')}
  ${u > 0.9 ? `<g transform="translate(540 600)">${G.outlined(0, 0, 70, '#fff', 'NOT LIKE THE MOVIES', 8)}</g>` : ''}`);
// ---------- the question
const ASK = ['WOULD YOU STILL', 'VISIT?'], OPTS = ['Yes!', 'No way', 'Maybe', 'Already did'];
at(SAY.cta, (t, u) => `${night('#ffd84a')}${A.commentBox(540, 860, 1, t, u, ASK, OPTS)}`);
at(W('cta', 'tell'), (t, u) => `${night('#ffd84a')}${A.commentBox(540, 800, 0.9, t, 2, ASK, OPTS)}
  <g transform="translate(540 1220) scale(${1 + 0.08 * Math.sin(t * 10)})"><rect x="-120" y="-80" width="240" height="160" rx="40" fill="#fff"/><path d="M -40 70 L -70 130 L 10 70 Z" fill="#fff"/>
  ${[-50, 0, 50].map((x, i) => `<circle cx="${x}" cy="0" r="16" fill="${C.ink}" opacity="${0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i))}"/>`).join('')}</g>`);

// ------------------------------------------------------------------ the stages on the bar
const STAMPS = [SAY.signs - 0.95, SAY.ash - 0.15, SAY.twist - 0.1];
const stage = X.keyed([[SAY.signs - 0.9, 0], [SAY.blast, 1], [SAY.ash - 0.2, 2], [SAY.summer, 3], [SAY.twist - 0.3, 4]]);
function goal(t) {
  const a = X.smooth(SAY.signs - 1.0, SAY.signs - 0.6, t) * (1 - X.smooth(SAY.twist - 0.4, SAY.twist - 0.1, t));
  if (a <= 0) return null;
  const s = stage(t), names = ['WEEK 1', 'ERUPTION', 'WEEK 2', 'YEARS AFTER', 'YEARS AFTER'];
  const ticks = [1, 2, 3].map((n) => ({ k: n / 4, on: s >= n, pop: Math.exp(-Math.pow((s - n) * 3, 2)) }));
  return { label: 'YELLOWSTONE', pct: names[Math.min(4, Math.floor(s))], k: s / 4, from: 'QUAKES', to: 'AFTER', alpha: a, ticks };
}

// ------------------------------------------------------------------ sound
function buildAudio() {
  const { A: L, fx, S_, music } = X.audioBase(VO, ORDER, SAY, DURATION, cuts(), STAMPS);
  music('music/464.mp3', 0, SAY.twist + 0.6, { offset: 4 });
  music('music/606.mp3', SAY.twist - 0.3, DURATION - SAY.twist + 0.3, { offset: 14, level: 0.55, fin: 0.8 });
  const sub = (t, level, dur = 0.9) => L.push({ type: 'subdrop', t, dur, level, free: true });
  // hook
  L.push(S_('sfx/1238.wav', 0, { dur: W('hook', 'erupted') + 0.2, level: 0.22, fin: 0.1, fout: 0.2, fx: true }));
  fx('sample', { file: 'sfx/1686.wav', t: W('hook', 'erupted') + 0.05, level: 0.35, dur: 1.6, fout: 0.5 });
  sub(W('hook', 'erupted') + 0.05, 0.4);
  // intro
  fx('beep', { t: W('intro', 'not') + 0.62, f: 330, n: 2, drop: 0.8, level: 0.22 });
  fx('rumble', { t0: W('intro', 'supervolcano'), t1: W('intro', 'heres'), level: 0.2 });
  for (let i = 0; i < 5; i++) fx('pop', { t: W('intro', 'heres') + i * 0.25, f: 700 + i * 90, level: 0.2 });
  // soda
  fx('rustle', { t0: W('relate', 'you') + 0.1, t1: W('relate', 'open'), level: 0.1 });
  fx('sample', { file: 'sfx/2384.wav', t: W('relate', 'open') + 0.05, level: 0.3 });
  fx('water', { t0: W('relate', 'open') + 0.05, t1: W('relate', 'now'), level: 0.18, rush: 1 });
  fx('rumble', { t0: W('relate', 'but'), t1: SAY.signs - 1, level: 0.2 });
  // week one
  fx('rumble', { t0: W('signs', 'small'), t1: W('signs', 'scientists'), level: 0.22, grit: 1 });
  for (let i = 0; i < 4; i++) fx('knock', { t: W('signs', 'small') + 0.2 + i * 0.45, n: 1, level: 0.1 });
  fx('creak', { t0: W('signs', 'ground') + 0.1, t1: W('signs', 'ground') + 1.4, level: 0.14 });
  L.push(S_('sfx/1651.wav', W('signs', 'scientists') + 0.6, { dur: SAY.blast - W('signs', 'scientists') - 0.4, level: 0.14, fin: 0.3, fout: 0.3, fx: true }));
  // it blows
  fx('sample', { file: 'sfx/1703.wav', t: SAY.blast - 0.05, level: 0.28, dur: 1.4, fout: 0.6 });
  sub(SAY.blast, 0.45, 1.4);
  fx('rumble', { t0: W('blast', 'column') + 0.9, t1: W('blast', 'everyone'), level: 0.2, grit: 1 });
  L.push(S_('sfx/1644.wav', W('blast', 'everyone'), { dur: SAY.ash - W('blast', 'everyone') - 0.2, level: 0.12, fin: 0.3, fout: 0.4, fx: true }));
  // week two: ash
  L.push(S_('sfx/1153.wav', SAY.ash - 0.4, { dur: SAY.summer - SAY.ash + 0.4, level: 0.18, fin: 0.4, fout: 0.5, fx: true }));
  fx('creak', { t0: W('ash', 'near') + 0.4, t1: W('ash', 'near') + 1.5, level: 0.18 });
  fx('clank', { t: W('ash', 'near') + 1.25, level: 0.3 });
  for (let i = 0; i < 3; i++) fx('beep', { t: W('ash', 'far') + 0.7 + i * 0.3, f: 330, n: 1, dur: 0.12, level: 0.15 });
  // the weather
  L.push(S_('sfx/1177.wav', SAY.summer, { dur: SAY.twist - SAY.summer, level: 0.2, fin: 0.5, fout: 0.5, fx: true }));
  fx('creak', { t0: W('summer', 'crops') + 0.1, t1: W('summer', 'crops') + 1.2, level: 0.1 });
  // the twist
  fx('sample', { file: 'sfx/2915.wav', t: SAY.twist - 0.1, level: 0.35, dur: 1.6, fout: 0.4 });
  fx('beep', { t: W('twist', 'yellowstone') + 0.72, f: 330, n: 2, drop: 0.8, level: 0.2 });
  fx('count', { t0: W('twist', 'scientists'), t1: W('twist', 'scientists') + 1.6, from: 24, to: 50, level: 0.06, seed: 6 });
  fx('ding', { t: W('twist', 'scientists') + 1.1, f: 1318.5, level: 0.12 });
  // could it happen
  fx('creak', { t0: SAY.real + 0.1, t1: SAY.real + 0.7, level: 0.12 });
  fx('count', { t0: W('real', 'the'), t1: W('real', 'the') + 1.6, from: 22, to: 44, level: 0.06, seed: 7 });
  fx('rumble', { t0: W('real', 'and'), t1: W('real', 'next'), level: 0.18 });
  fx('sample', { file: 'sfx/1105.wav', t: W('real', 'next') + 0.05, level: 0.4 });
  // the likely future
  L.push(S_('sfx/1238.wav', W('end', 'the'), { dur: SAY.cta - W('end', 'the'), level: 0.18, fin: 0.3, fout: 0.4, fx: true }));
  fx('sample', { file: 'sfx/2408.wav', t: W('end', 'small') + 0.05, level: 0.25 });
  fx('sample', { file: 'sfx/965.wav', t: W('end', 'scary') + 0.15, level: 0.16 });
  // the question
  for (let i = 0; i < 4; i++) fx('pop', { t: SAY.cta + 0.2 + i * 0.15, f: 600 + i * 120, level: 0.18 });
  fx('ding', { t: W('cta', 'comments') + 0.3, level: 0.15 });
  return L;
}

export default X.scenario({ id: 'yellowstone', title: 'What if Yellowstone erupted?', DURATION, FADE, CSS: X.css(LAVA, '#ffd84a'),
  caps: X.captions(VO, ORDER, SAY, NUMS, KEYWORDS), audio: buildAudio(), goal, svgFrame: frame });
export const _debug = { SAY, DURATION, S, wordT: W };
export { svgAt };
