// What if a pandemic worse than COVID hit? — illustrated explainer (plumbing in explainer.js).
// Facts: Moderna's mRNA-1273 sequence was finalised on 13 Jan 2020, two days after the SARS-CoV-2 genome was published;
// CEPI's 100 Days Mission (vaccines within 100 days of a new threat); 1918 influenza infected ~500 million people, about a
// third of the world's population (CDC). The R≈3 spread and 3^10 = 59,049 are a worked example, not a forecast.
import VO from './pandemic.vo.js';
import * as I from './ill2d.js';
import * as G from './ill2d-grid.js';
import * as A from './ill2d-ai.js';
import * as P from './ill2d-pandemic.js';
import * as X from './explainer.js';

const { C, ease, clamp, lerp, hash } = I;
const { VIR, GREEN } = P;

const ORDER = ['hook', 'intro', 'relate', 'day1', 'week1', 'math', 'week3', 'twist', 'real', 'end', 'cta'];
const GAP = { hook: 0.1, intro: 0.3, relate: 0.35, day1: 1.0, week1: 0.55, math: 0.35, week3: 0.55, twist: 0.5, real: 0.4, end: 0.4, cta: 0.35 };
const { SAY, W, FADE, DURATION } = X.timeline(VO, ORDER, GAP);

const NUMS = [['march 2020', 'MARCH 2020'], ['day one', 'DAY 1'], ['ten cities', '10 CITIES'], ['three continents', '3 CONTINENTS'], ['three more', '3 MORE'],
  ['twenty seven', '27'], ['ten rounds', '10 ROUNDS'], ['fifty thousand', '50,000'], ['week three', 'WEEK 3'], ['2020', '2020'], ['two days', '2 DAYS'],
  ['one hundred days', '100 DAYS'], ['1918', '1918'], ['five hundred million', '500 MILLION'], ['50,000', '50,000'], ['500 million', '500 MILLION'], ['100 days', '100 DAYS']];
const KEYWORDS = /^(covid|tomorrow|zombie|real|shelves|toilet|bread|faster|sick|cold|work|planes|cities|continents|three|small|fast|nine|hospitals|schools|home|masks|crazy|vaccine|code|flu|world|vaccines|internet|sooner|comments)$/i;

// ------------------------------------------------------------------ backgrounds
const { S, at, frame, svgAt, cuts } = X.stack();
const night = (glow = null, gy = 820) => I.bg('#0e1530', '#1d2a55', glow, gy);
const lab = (glow = VIR) => I.bg('#1a0d2a', '#3a1a4a', glow, 820);
const floaters = (t, n = 8, op = 0.5) => [...Array(n)].map((_, i) => P.virus(hash(i, 1) * 1080, 450 + ((hash(i, 2) * 900 + t * 30) % 900), 0.18 + 0.1 * hash(i, 3), t, VIR, i).replace('<g ', `<g opacity="${op}" `)).join('');
const street = (t) => `${I.bg('#7cc7ff', '#cfeaff')}${I.cityline(1150, t, 0.2, '#5b6b9a', 4)}<rect y="1150" width="1080" height="770" fill="#9aa3b8"/><rect y="1260" width="1080" height="80" fill="#c9cfdc"/>`;
const home = () => `${I.bg('#2b2260', '#463a8c', '#ffd27a', 760)}<rect y="1180" width="1080" height="740" fill="#2a2148"/>`;
const PHONE = { x: 540, y: 815, s: 1.05 };

// ---------- the hook
at(0, (t, u) => `${lab()}${floaters(t, 10, 0.35)}${P.virus(540, 860, 2.2 + 0.1 * Math.sin(t * 3), t)}`);
at(W('hook', 'worse'), (t, u) => { const k = ease.out((u - 0.2) / 0.8);
  return `${lab()}${P.virus(300, 860, 0.9, t, '#9aa3b8')}${G.outlined(300, 1120, 64, '#fff', 'COVID', 8)}${P.virus(760, 860, lerp(0.9, 1.6, k), t, VIR, 2)}${G.outlined(760, 1180, 70, C.yellow, 'NEW?', 8)}`; });
at(W('hook', 'tomorrow'), (t, u) => `${street(t)}${floaters(t, 8, 0.8)}<g transform="translate(540 600) scale(${ease.back(u / 0.3)})">${G.outlined(0, 0, 120, C.yellow, 'TOMORROW', 11)}</g>`);
// ---------- what the video is about
at(W('intro', 'not'), (t, u) => `${I.bg('#0b1a0f', '#1a3a1f', GREEN, 820)}${P.moviePoster(540, 860, 1.05, t)}${I.xmark(820, 520, 0.85, u - 0.6)}`);
at(W('intro', 'real'), (t, u) => `${lab('#7fe8ff')}<circle cx="540" cy="860" r="380" fill="#e8f7ff" filter="url(#drop)"/><clipPath id="dish"><circle cx="540" cy="860" r="360"/></clipPath>
  <g clip-path="url(#dish)"><circle cx="540" cy="860" r="360" fill="#dff3ff"/>${[...Array(9)].map((_, i) => P.virus(540 + Math.cos(t * 0.7 + i) * (100 + i * 25), 860 + Math.sin(t * 0.9 + i * 2) * (80 + i * 22), 0.42, t, VIR, i)).join('')}</g>
  <circle cx="540" cy="860" r="372" fill="none" stroke="#9aa3b8" stroke-width="22"/>`);
at(W('intro', 'heres'), (t, u) => {
  const pts = [[250, 520], [780, 640], [300, 800], [780, 940], [280, 1100]], labels = ['DAY 1', 'WEEK 1', 'WEEK 3', 'VACCINES', '1918'], kinds = ['virus', 'plane', 'hospital', 'vial', 'paper'];
  let path = `M 540 420`; pts.forEach(([x, y]) => (path += ` L ${x} ${y}`));
  return `${night('#ffd84a')}<path d="${path}" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round" opacity="0.5"/>
  ${pts.map(([x, y], i) => u >= i * 0.25 ? `${P.icon(kinds[i], x, y, ease.back((u - i * 0.25) / 0.3), t)}<text x="${x + (x < 540 ? 90 : -90)}" y="${y + 14}" font-family="MontB" font-weight="900" font-size="42" fill="#fff" text-anchor="${x < 540 ? 'start' : 'end'}" opacity="${clamp((u - i * 0.25) * 4)}">${labels[i]}</text>` : '').join('')}`; });
// ---------- remember 2020?
at(W('relate', 'remember'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ff5e5b', 820)}<g transform="translate(540 860) scale(${ease.back(u / 0.35)})"><g filter="url(#drop)"><rect x="-300" y="-320" width="600" height="600" rx="44" fill="#eef1f8"/></g>
  <rect x="-300" y="-320" width="600" height="150" rx="44" fill="${C.coral}"/><rect x="-300" y="-220" width="600" height="50" fill="${C.coral}"/>${G.txt(0, -222, 66, '#fff', 'MARCH')}${G.txt(0, 110, 210, C.ink, '2020')}</g>`);
at(W('relate', 'empty'), (t, u) => `${I.bg('#e8f0ff', '#c9d6f0')}<rect y="1220" width="1080" height="700" fill="#9aa8c2"/>${P.emptyShelves(540, 820, 0.95, 0.12)}`);
at(W('relate', 'toilet'), (t, u) => `${I.bg('#e8f0ff', '#c9d6f0')}<rect y="1220" width="1080" height="700" fill="#9aa8c2"/>${P.toiletRoll(540, 820 + 10 * Math.sin(t * 8), 2.2, 4 * Math.sin(t * 6))}
  ${[[-1, 160], [1, 920]].map(([d, x]) => `<g transform="translate(${x + d * -60 * ease.out(u / 0.6)} 860) scale(${d} 1)"><rect x="-300" y="-40" width="300" height="90" rx="40" fill="${d < 0 ? C.sleeve : '#5b4bb8'}"/><circle cx="20" cy="4" r="56" fill="${C.skin}"/></g>`).join('')}
  ${G.outlined(540, 1300, 80, C.red, 'LAST ONE!', 9)}`);
at(W('relate', 'everyone'), (t, u) => `${home()}${I.person(320, 1300, 1.0, { shirt: C.yellow, pose: 'cheer', face: 'happy', t })}<rect x="560" y="1000" width="420" height="40" rx="10" fill="url(#woodTop)"/><rect x="590" y="1040" width="360" height="260" fill="${C.woodD}"/>
  ${P.bread(770, 940, 1.1)}${[0, 1, 2].map((i) => { const p = (t * 0.6 + i / 3) % 1; return `<path d="M ${720 + i * 50} ${860 - p * 120} q 14 -20 0 -40" stroke="#fff" stroke-width="8" fill="none" opacity="${0.6 * (1 - p)}"/>`; }).join('')}`);
at(W('relate', 'now'), (t, u) => `${lab()}${[...Array(14)].map((_, i) => { const p = (t * 2 + hash(i, 1)) % 1; return `<line x1="${1080 - p * 1300}" y1="${450 + hash(i, 2) * 900}" x2="${1080 - p * 1300 + 180}" y2="${450 + hash(i, 2) * 900}" stroke="#fff" stroke-width="6" opacity="${0.5 * (1 - p)}"/>`; }).join('')}
  ${P.virus(540 + I.wobble(t, 30, 6), 860, 1.6, t * 3)}${G.outlined(540, 1270, 100, C.yellow, 'EVEN FASTER', 10)}`);
// ---------- day one
at(SAY.day1 - 0.95, (t, u) => `${street(t)}${I.stamp('DAY 1', u, 600)}`);
at(W('day1', 'person'), (t, u) => { const sn = u > 0.9 && u < 1.4;
  return `${street(t)}${[[150, C.teal, 1], [930, C.yellow, -1]].map(([x, col, d], i) => I.person(x + d * ((t * 40) % 80), 1320, 0.6, { shirt: col, pose: 'walk', t, seed: i, flip: d })).join('')}
  ${I.person(540, 1360, 1.15, { shirt: C.coral, pose: 'stand', face: sn ? 'panic' : 'neutral', t })}${P.tissue(600, 880, 1)}${sn ? G.outlined(720, 760, 70, '#fff', 'ACHOO!', 8) : ''}
  ${u > 1 ? [0, 1, 2].map((i) => P.virus(640 + (u - 1) * 200 + i * 40, 860 - i * 50, 0.14, t, VIR, i)).join('') : ''}`; });
at(W('day1', 'it'), (t, u) => `${home()}${I.person(400, 1300, 1.1, { shirt: C.coral, pose: 'stand', t })}${G.thermometer(820, 1100, 0.8, 0.35)}${I.bubbleSay(520, 600, 1.1, u - 0.2, 'Just a cold…')}`);
at(W('day1', 'so'), (t, u) => `${I.bg('#d9e4f5', '#b8c8e4')}<rect y="1180" width="1080" height="740" fill="#8a93a8"/>${I.officeBuilding(760, 1180, 0.8, t, 0)}
  ${I.person(lerp(120, 560, ease.inOut(u / 1.6)), 1320, 0.9, { shirt: C.coral, pose: 'walk', t })}${[0, 1, 2, 3].map((i) => P.virus(lerp(120, 560, ease.inOut(u / 1.6)) - 80 - i * 70, 1000 + 30 * Math.sin(t * 3 + i), 0.14, t, VIR, i)).join('')}`);
// ---------- week one
at(SAY.week1 - 0.15, (t, u) => `${night()}${I.plane(540, 900, 1.3, -8)}${I.stamp('WEEK 1', u, 560)}`);
at(W('week1', 'planes'), (t, u) => `${I.bg('#7cc7ff', '#d6efff')}${[0, 1, 2].map((i) => `<g transform="translate(${((t * 18 + i * 420) % 1400) - 200} ${500 + i * 90})"><ellipse rx="90" ry="34" fill="#fff" opacity="0.9"/></g>`).join('')}
  ${I.plane(540 + 30 * Math.sin(t), 860, 1.4, -6)}${[0, 1, 2, 3, 4].map((i) => P.virus(380 + i * 70, 838 - i * 8, 0.12, t, VIR, i)).join('')}`);
at(W('week1', 'ten'), (t, u) => `${night('#ff6b9a')}${P.flightMap(540, 860, 1, t, ease.inOut(u / 1.4) * 10)}${G.outlined(540, 400, 64, C.yellow, '10 CITIES · 3 CONTINENTS', 8)}`);
at(W('week1', 'and'), (t, u) => `${lab()}${I.person(540, 900, 0.8, { shirt: C.red, face: 'panic', t })}
  ${[-1, 0, 1].map((d, i) => { const k = ease.back((u - 0.3 - i * 0.15) / 0.3); return `<line x1="540" y1="920" x2="${540 + d * 300}" y2="1100" stroke="${VIR}" stroke-width="10" opacity="${clamp(k)}"/><g transform="translate(${540 + d * 300} 1340) scale(${k})">${I.person(0, 0, 0.6, { shirt: VIR, t, seed: i })}</g>`; }).join('')}
  ${G.outlined(540, 420, 90, C.yellow, '1 → 3', 9)}`);
// ---------- the maths
at(SAY.math, (t, u) => `${lab()}${G.outlined(540, 860, 360, '#fff', '3', 16)}${G.outlined(540, 1200, 90, C.yellow, 'SMALL?', 9)}`);
at(W('math', 'three'), (t, u) => `${lab()}${P.spreadTree(540, 900, 1.05, u, t)}`);
at(W('math', 'after'), (t, u) => { const v = Math.round(Math.pow(3, Math.min(10, ease.out(u / 1.6) * 10)));
  return `${lab()}${A.crowdGrid(540, 1060, 0.75, Math.floor(ease.out(u / 1.6) * 120))}${G.outlined(540, 560, 170, C.yellow, v.toLocaleString('en-US'), 13)}${G.outlined(540, 660, 56, '#fff', 'AFTER 10 ROUNDS', 7)}`; });
// ---------- week three
at(SAY.week3 - 0.15, (t, u) => `${night()}${G.hospital(540, 1300, 0.95, t, 0.8)}${I.stamp('WEEK 3', u, 520)}`);
at(W('week3', 'hospitals'), (t, u) => `${I.bg('#e8f0ff', '#c9d6f0')}<rect y="1200" width="1080" height="720" fill="#b8c4dc"/>${[...Array(6)].map((_, i) => P.bed(260 + (i % 2) * 520, 640 + Math.floor(i / 2) * 260, 1.05, u > i * 0.2 ? 1 : 0, t)).join('')}
  ${G.outlined(540, 1380, 70, C.red, `BEDS ${Math.round(clamp(u / 1.2) * 100)}% FULL`, 8)}`);
at(W('week3', 'schools'), (t, u) => `${I.bg('#ffd27a', '#ffb347')}<rect y="1200" width="1080" height="720" fill="#8bc77b"/>${A.building(540, 1220, 1.6, '#c0392b')}
  <g transform="translate(540 ${lerp(-200, 760, ease.back(u / 0.5))}) rotate(${6 * Math.exp(-u * 2) * Math.cos(u * 9)})">${P.closedSign(0, 0, 1)}</g>`);
at(W('week3', 'people'), (t, u) => `${home()}${I.person(400, 1300, 1, { shirt: C.teal, pose: 'talk', t })}<rect x="420" y="1100" width="560" height="36" rx="10" fill="url(#woodTop)"/>
  ${A.laptop(720, 1100, 0.7, `<rect x="-236" y="-316" width="472" height="292" fill="#2f7bff" opacity="0.5"/>${[0, 1, 2, 3].map((i) => `<rect x="${-220 + (i % 2) * 230}" y="${-300 + Math.floor(i / 2) * 140}" width="210" height="125" rx="8" fill="#1a1d27"/><circle cx="${-115 + (i % 2) * 230}" cy="${-250 + Math.floor(i / 2) * 140}" r="26" fill="${[C.coral, C.yellow, C.green, '#c77dff'][i]}"/>`).join('')}`)}
  ${G.outlined(540, 560, 80, '#fff', 'WORK FROM HOME', 8)}`);
at(W('week3', 'masks'), (t, u) => `${street(t)}${[[180, C.teal], [400, C.coral], [620, C.yellow], [840, '#c77dff']].map(([x, col], i) => I.person(x, 1360, 0.8, { shirt: col, pose: i % 2 ? 'walk' : 'stand', t, seed: i }) + (u > 0.2 + i * 0.12 ? P.mask(x, 1360, 0.8) : '')).join('')}`);
// ---------- the twist
at(SAY.twist - 0.1, (t, u) => `${I.bg('#120a2e', '#3a1a6b', '#c77dff', 820)}${G.stars(t, 40, 12)}
  <g transform="translate(540 820) rotate(${u * 40})" opacity="0.5">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M 0 0 L ${Math.cos(i) * 600} ${Math.sin(i) * 600}" stroke="#c77dff" stroke-width="40" opacity="0.3"/>`).join('')}</g>${I.stamp('THE TWIST', u, 860)}`);
at(W('twist', 'were'), (t, u) => `${I.bg('#14532d', '#22a35a', '#ffd84a', 820)}${A.rocket(540, 900 - 80 * ease.out(u / 1.5), 1.5, t, 20)}${G.outlined(540, 1330, 90, '#fff', 'FASTER NOW', 9)}`);
at(W('twist', 'in'), (t, u) => { const tc = W('twist', 'code') - W('twist', 'in');
  return `${I.bg('#0b1a2a', '#14365a', '#7fe8ff', 820)}${P.codeScroll(540, 760, 1, t)}${u > tc - 0.6 ? `<g transform="translate(540 1220) scale(${ease.back((u - tc + 0.6) / 0.3)})">${G.outlined(0, 0, 130, C.yellow, '2 DAYS', 12)}</g>` : `${G.outlined(540, 1220, 80, '#fff', '2020', 9)}`}`; });
at(W('twist', 'today'), (t, u) => `${I.bg('#14532d', '#22a35a', '#ffd84a', 820)}${P.vial(360, 980, 1.2, t, 0.3 + 0.7 * ease.out(u / 1.5))}
  <g transform="translate(760 880) scale(${ease.back((u - 0.4) / 0.4)})"><g filter="url(#drop)"><rect x="-200" y="-220" width="400" height="420" rx="34" fill="#eef1f8"/></g><rect x="-200" y="-220" width="400" height="110" rx="34" fill="${C.coral}"/><rect x="-200" y="-150" width="400" height="40" fill="${C.coral}"/>
  ${G.txt(0, -148, 48, '#fff', 'GOAL')}${G.txt(0, 60, 150, C.ink, '100')}${G.txt(0, 150, 54, C.ink, 'DAYS')}</g>`);
// ---------- could it happen?
at(SAY.real, (t, u) => `${lab()}${P.virus(540, 1000, 1.1, t)}<text x="540" y="${600 + 10 * Math.sin(t * 4)}" font-family="MontB" font-weight="900" font-size="300" fill="${C.yellow}" text-anchor="middle" stroke="#000" stroke-width="12" paint-order="stroke" transform="rotate(${6 * Math.sin(t * 3)} 540 500)">?</text>`);
at(W('real', 'it'), (t, u) => `${night(C.green)}${I.check(540, 820, 1.5, u)}${G.outlined(540, 1130, 84, '#fff', 'IT HAS BEFORE', 9)}`);
at(W('real', 'in'), (t, u) => { const k = ease.out(u / 0.6);
  return `${I.bg('#3a2a1a', '#5a4026', '#ffd27a', 820)}${G.paper(540, 860, lerp(0.2, 1, k), lerp(-540, -4, k), { date: 'OCTOBER, 1918', h1: 'FLU EPIDEMIC', h2: 'SWEEPS WORLD',
    art: `<rect x="-300" y="-20" width="300" height="220" fill="#d9c9a8"/>${[0, 1, 2].map((i) => `<g transform="translate(${-240 + i * 90} 180) scale(0.3)">${I.person(0, 0, 1, { shirt: '#5a4a3a', t: 0, seed: i }) + P.mask(0, 0, 1, '#fff')}</g>`).join('')}` })}
  <rect width="1080" height="1920" fill="#704214" opacity="0.15"/>`; });
at(W('real', 'thats'), (t, u) => `${night(VIR)}${P.pieThird(540, 900, 1.1, ease.out(u / 0.8) / 3)}${G.outlined(540, 460, 110, C.yellow, '500 MILLION', 11)}${G.outlined(540, 1330, 80, '#fff', '1 IN 3 PEOPLE', 8)}`);
// ---------- this time
at(W('end', 'but'), (t, u) => { const items = [['VACCINES', W('end', 'no')], ['INTERNET', W('end', 'no', 1)], ['ICU BEDS', W('end', 'no', 2)]];
  return `${I.bg('#3a2a1a', '#5a4026')}<rect width="1080" height="1920" fill="#704214" opacity="0.2"/>${G.outlined(540, 470, 90, '#f3efe4', 'BACK IN 1918', 9)}
  ${items.map(([l, tt], i) => { const k = t - tt; return k > 0 ? `<g transform="translate(540 ${700 + i * 240}) scale(${ease.back(k / 0.3)})"><rect x="-380" y="-90" width="760" height="180" rx="30" fill="#f3efe4" filter="url(#drop)"/>
    ${G.txt(-60, 30, 80, C.ink, l)}<g transform="translate(270 0)">${I.xmark(0, 0, 0.6, 1)}</g></g>` : ''; }).join('')}`; });
at(W('end', 'this'), (t, u) => `${night(C.green)}${P.radar(540, 860, 1.1, t, u - 0.3)}${u > 1.2 ? I.check(840, 520, 0.9, u - 1.2) : ''}${G.outlined(540, 1330, 84, C.yellow, 'SPOT IT SOONER', 9)}`);
// ---------- the question
const ASK = ['WHAT WOULD YOU', 'STOCK UP ON?'], OPTS = ['Food', 'Water', 'Snacks', 'Masks'];
at(SAY.cta, (t, u) => `${night('#ffd84a')}${A.commentBox(540, 860, 1, t, u, ASK, OPTS)}`);
at(W('cta', 'tell'), (t, u) => `${night('#ffd84a')}${A.commentBox(540, 800, 0.9, t, 2, ASK, OPTS)}
  <g transform="translate(540 1220) scale(${1 + 0.08 * Math.sin(t * 10)})"><rect x="-120" y="-80" width="240" height="160" rx="40" fill="#fff"/><path d="M -40 70 L -70 130 L 10 70 Z" fill="#fff"/>
  ${[-50, 0, 50].map((x, i) => `<circle cx="${x}" cy="0" r="16" fill="${C.ink}" opacity="${0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i))}"/>`).join('')}</g>`);

// ------------------------------------------------------------------ days since patient zero
const STAMPS = [SAY.day1 - 0.95, SAY.week1 - 0.15, SAY.week3 - 0.15, SAY.twist - 0.1];
const days = X.keyed([[SAY.day1 - 0.9, 0], [SAY.week1 - 0.2, 1], [W('week1', 'ten'), 7], [SAY.math, 9], [SAY.week3 - 0.2, 14], [SAY.twist - 0.3, 21]]);
function goal(t) {
  const a = X.smooth(SAY.day1 - 1.0, SAY.day1 - 0.6, t) * (1 - X.smooth(SAY.twist - 0.4, SAY.twist - 0.1, t));
  if (a <= 0) return null;
  const d = days(t), ticks = [7, 14, 21].map((n) => ({ k: n / 28, on: d >= n, pop: Math.exp(-Math.pow((d - n) * 1.5, 2)) }));
  return { label: 'SINCE PATIENT ZERO', pct: `DAY ${Math.floor(d) + 1}`, k: d / 28, from: 'DAY 1', to: 'DAY 28', alpha: a, ticks };
}

// ------------------------------------------------------------------ sound
function buildAudio() {
  const { A: L, fx, S_, music } = X.audioBase(VO, ORDER, SAY, DURATION, cuts(), STAMPS);
  music('music/464.mp3', 0, SAY.twist + 0.6, { offset: 4 });
  music('music/606.mp3', SAY.twist - 0.3, DURATION - SAY.twist + 0.3, { offset: 14, level: 0.55, fin: 0.8 });
  const sub = (t, level) => L.push({ type: 'subdrop', t, dur: 0.9, level, free: true });
  // hook
  fx('pulse', { t0: 0, t1: W('hook', 'tomorrow'), bpm: [80, 120], level: 0.12 });
  sub(W('hook', 'worse') + 0.2, 0.3);
  L.push(S_('sfx/2678.wav', W('hook', 'tomorrow'), { dur: SAY.intro - W('hook', 'tomorrow') + 0.2, level: 0.2, fin: 0.1, fout: 0.2 }));
  // intro
  fx('sample', { file: 'sfx/469.wav', t: W('intro', 'not') + 0.05, level: 0.1, dur: 0.6, fout: 0.3 });
  fx('beep', { t: W('intro', 'not') + 0.62, f: 330, n: 2, drop: 0.8, level: 0.22 });
  fx('water', { t0: W('intro', 'real'), t1: W('intro', 'heres'), level: 0.05, rush: 0 });
  for (let i = 0; i < 5; i++) fx('pop', { t: W('intro', 'heres') + i * 0.25, f: 700 + i * 90, level: 0.2 });
  // 2020
  fx('sample', { file: 'sfx/1105.wav', t: W('relate', 'remember') + 0.02, level: 0.35 });
  fx('creak', { t0: W('relate', 'empty') + 0.1, t1: W('relate', 'empty') + 0.6, level: 0.1 });
  fx('rustle', { t0: W('relate', 'toilet') + 0.1, t1: W('relate', 'toilet') + 0.7, level: 0.14 });
  fx('ding', { t: W('relate', 'everyone') + 0.4, f: 1318.5, level: 0.12 });
  fx('sample', { file: 'sfx/2625.wav', t: W('relate', 'now') + 0.05, level: 0.3 });
  // day one
  L.push(S_('sfx/361.wav', SAY.day1 - 0.8, { dur: SAY.week1 - SAY.day1 + 0.6, level: 0.18, fin: 0.3, fout: 0.4, fx: true }));
  fx('sample', { file: 'sfx/964.wav', t: W('day1', 'person') + 0.9, level: 0.2 });
  // week one: planes and spreading
  L.push(S_('sfx/1579.wav', W('week1', 'planes') - 0.1, { dur: 2.2, level: 0.22, fin: 0.3, fout: 0.6, fx: true }));
  for (let i = 0; i < 10; i++) fx('pop', { t: W('week1', 'ten') + (i + 1) * 0.14, f: 500 + i * 60, level: 0.13, pan: -0.5 + i * 0.1 });
  for (let i = 0; i < 3; i++) fx('pop', { t: W('week1', 'and') + 0.35 + i * 0.15, f: 700, level: 0.18 });
  // the maths
  fx('knock', { t: SAY.math + 0.05, n: 1, level: 0.25 });
  for (let r = 1; r < 4; r++) fx('pop', { t: W('math', 'three') + r * 0.5 + 0.1, f: 500 + r * 150, level: 0.2 });
  fx('count', { t0: W('math', 'after'), t1: W('math', 'after') + 1.6, from: 22, to: 48, level: 0.08, seed: 5 });
  sub(W('math', 'after') + 1.6, 0.25);
  // week three
  for (let i = 0; i < 4; i++) fx('beep', { t: W('week3', 'hospitals') + 0.2 + i * 0.55, f: 1000, n: 1, dur: 0.1, level: 0.1 });
  fx('clank', { t: W('week3', 'schools') + 0.4, level: 0.3 });
  fx('pop', { t: W('week3', 'people') + 0.2, f: 900, level: 0.15 });
  for (let i = 0; i < 4; i++) fx('pop', { t: W('week3', 'masks') + 0.2 + i * 0.12, f: 800 + i * 50, level: 0.12 });
  // the twist
  fx('sample', { file: 'sfx/2915.wav', t: SAY.twist - 0.1, level: 0.35, dur: 1.6, fout: 0.4 });
  fx('sample', { file: 'sfx/2625.wav', t: W('twist', 'were') + 0.05, level: 0.25 });
  for (let i = 0; i < 10; i++) fx('sample', { file: 'sfx/1124.wav', t: W('twist', 'in') + 0.2 + i * 0.08, level: 0.07 });
  fx('ding', { t: W('twist', 'code') - 0.5, f: 1046.5, level: 0.13 });
  fx('sparkle', { t: W('twist', 'today') + 0.4, dur: 1.0, count: 8, f: [1600, 4200], level: 0.11, seed: 6 });
  // could it happen
  fx('creak', { t0: SAY.real + 0.1, t1: SAY.real + 0.7, level: 0.12 });
  fx('ding', { t: W('real', 'it') + 0.1, f: 880, level: 0.12 });
  fx('sample', { file: 'sfx/1105.wav', t: W('real', 'in') + 0.05, level: 0.4 });
  sub(W('real', 'thats') + 0.1, 0.28);
  // this time
  for (let i = 0; i < 3; i++) fx('beep', { t: W('end', 'no', i) + 0.15, f: 330, n: 1, dur: 0.12, level: 0.16 });
  fx('pulse', { t0: W('end', 'this'), t1: W('end', 'this') + 1.2, bpm: [90, 90], level: 0.1 });
  fx('chime', { t: W('end', 'this') + 1.25, level: 0.1, freq: 784 });
  // the question
  for (let i = 0; i < 4; i++) fx('pop', { t: SAY.cta + 0.2 + i * 0.15, f: 600 + i * 120, level: 0.18 });
  fx('ding', { t: W('cta', 'comments') + 0.3, level: 0.15 });
  return L;
}

export default X.scenario({ id: 'pandemic', title: 'What if a pandemic worse than COVID hit?', DURATION, FADE, CSS: X.css(VIR, '#ffb347'),
  caps: X.captions(VO, ORDER, SAY, NUMS, KEYWORDS), audio: buildAudio(), goal, svgFrame: frame });
export const _debug = { SAY, DURATION, S, wordT: W };
export { svgAt };
