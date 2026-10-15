// What if AI became smarter than us? — illustrated explainer (format of internet-down-2d.js, plumbing in explainer.js).
// Facts: AI Impacts 2023 survey (2,778 AI researchers; aggregate forecast 50% chance machines outperform humans at every task
// by 2047; Grace et al., JAIR 2025); Deep Blue beat Garry Kasparov, May 1997; AlphaGo beat Lee Sedol 4-1 in March 2016
// (game 2, "move 37"). The rest is framed as a what-if, not a prediction.
import VO from './ai-smarter.vo.js';
import * as I from './ill2d.js';
import * as G from './ill2d-grid.js';
import * as A from './ill2d-ai.js';
import * as X from './explainer.js';

const { C, ease, clamp, lerp, hash } = I;
const { PURPLE, CYAN } = A;

const ORDER = ['hook', 'intro', 'relate', 'week1', 'work', 'month3', 'twist', 'real', 'history', 'year1', 'cta'];
const GAP = { hook: 0.1, intro: 0.25, relate: 0.35, week1: 1.0, work: 0.35, month3: 0.55, twist: 0.45, real: 0.4, history: 0.35, year1: 0.55, cta: 0.35 };
const { SAY, W, FADE, DURATION } = X.timeline(VO, ORDER, GAP);

const NUMS = [['week one', 'WEEK 1'], ['week 1', 'WEEK 1'], ['two seconds', '2 SECONDS'], ['2 seconds', '2 SECONDS'], ['month three', 'MONTH 3'], ['month 3', 'MONTH 3'],
  ['three thousand', '3,000'], ['3000', '3,000'], ['fifty percent', '50%'], ['50 percent', '50%'], ['50%', '50%'], ['2047', '2047'], ['1997', '1997'], ['2016', '2016'], ['one year', '1 YEAR']];
const KEYWORDS = /^(smarter|human|earth|robot|program|everything|smartest|plans|code|taxes|minutes|panic|scientists|thousands|medicines|materials|faster|crazy|controls|wants|alignment|survey|researchers|chance|chess|champion|go|move|expected|normal|sports|love|matters|trust|comments)$/i;

// ------------------------------------------------------------------ backgrounds
const { S, at, frame, svgAt, cuts } = X.stack();
const tech = (glow = PURPLE, gy = 820) => I.bg('#0d0b26', '#251a5c', glow, gy);
const grid = (t, op = 0.25) => `<g opacity="${op}">${[...Array(14)].map((_, i) => `<line x1="${i * 80}" y1="0" x2="${i * 80}" y2="1920" stroke="${CYAN}" stroke-width="2"/>`).join('')}${[...Array(24)].map((_, i) => `<line x1="0" y1="${i * 80 + (t * 20) % 80}" x2="1080" y2="${i * 80 + (t * 20) % 80}" stroke="${CYAN}" stroke-width="2"/>`).join('')}</g>`;
const office = () => `${I.bg('#d9e4f5', '#b8c8e4')}<rect y="1180" width="1080" height="740" fill="#8a93a8"/>${[0, 1, 2].map((i) => `<rect x="${80 + i * 330}" y="420" width="260" height="300" rx="12" fill="#9fd2ff" opacity="0.5"/>`).join('')}`;
const desk = (y = 1180) => `<rect x="60" y="${y}" width="960" height="36" rx="10" fill="url(#woodTop)"/><rect x="100" y="${y + 36}" width="30" height="200" fill="${C.woodD}"/><rect x="950" y="${y + 36}" width="30" height="200" fill="${C.woodD}"/>`;
const lab = () => `${I.bg('#e8f0ff', '#c9d6f0')}<rect y="1180" width="1080" height="740" fill="#9aa8c2"/><rect y="1160" width="1080" height="40" fill="#eef1f8"/>`;
const park = (t) => `${I.bg('#7cc7ff', '#d6efff')}<circle cx="860" cy="520" r="80" fill="#fff3b0"/>
  ${[0, 1, 2].map((i) => `<g transform="translate(${((t * 18 + i * 420) % 1400) - 200} ${470 + i * 70})"><ellipse rx="90" ry="34" fill="#fff" opacity="0.9"/><ellipse cx="50" cy="-20" rx="60" ry="30" fill="#fff" opacity="0.9"/></g>`).join('')}
  <rect y="1100" width="1080" height="820" fill="#8bc77b"/>${A.tree(140, 1130, 0.9)}${A.tree(960, 1120, 0.8)}`;
const PHONE = { x: 540, y: 815, s: 1.05 };

// ---------- the hook
at(0, (t, u) => { const r = ease.out(u / 1.5);
  return `${I.bg('#3e4fa8', '#f08a6a', '#ffd27a', 1000)}<circle cx="540" cy="${1150 - 160 * r}" r="150" fill="#ffe09a"/>${I.cityline(1240, t, 0.4, '#1b2550', 3)}<rect y="1240" width="1080" height="680" fill="#141d40"/>
  ${G.outlined(540, 560, 90, '#fff', 'TOMORROW', 9)}`; });
at(W('hook', 'ai'), (t, u) => `${tech()}${grid(t, 0.15)}${A.chip(540, 820, 1.2, t, ease.out(u / 0.8))}`);
at(W('hook', 'smarter'), (t, u) => { const h = ease.out(u / 0.4) * 0.45, a = ease.inOut((u - 0.2) / 1.0);
  const bar = (x, v, col, label, icon) => `<rect x="${x - 110}" y="${1250 - 700 * v}" width="220" height="${700 * v}" rx="20" fill="${col}"/>${G.outlined(x, 1330, 54, '#fff', label, 7)}<g transform="translate(${x} ${1190 - 700 * v})">${icon}</g>`;
  return `${tech()}${grid(t, 0.12)}<rect x="160" y="1250" width="760" height="10" rx="5" fill="#fff" opacity="0.5"/>
  ${bar(340, h, C.coral, 'HUMANS', I.person(0, 60, 0.32, { shirt: C.coral, t }))}${bar(740, Math.max(h, 0.2 + 0.85 * a), CYAN, 'AI', A.chip(0, -20, 0.22, t, 1))}`; });
at(W('hook', 'every'), (t, u) => `${I.bg('#05081a', '#141d40', '#4aa8ff', 900)}${G.stars(t, 40, 2)}${I.globe(540, 950, 300, t, { spin: t * 0.12, lines: 0.6 })}
  ${[...Array(18)].map((_, i) => { const a = i / 18 * Math.PI * 2 + t * 0.3; return I.person(540 + Math.cos(a) * 390, 950 + Math.sin(a) * 390 + 40, 0.18, { shirt: [C.coral, C.yellow, C.teal][i % 3], t, seed: i }); }).join('')}
  <g opacity="${clamp((u - 0.4) * 3)}">${A.chip(540, 470, 0.45, t, 1)}</g>`);
// ---------- what the video is about
at(W('intro', 'not'), (t, u) => `${I.bg('#2b0d1a', '#5c1a2e', C.red, 820)}${A.robot(540, 1080, 1.05, t)}${I.xmark(800, 520, 0.85, u - 0.6)}`);
at(W('intro', 'program'), (t, u) => `${tech(CYAN)}${A.laptop(540, 1060, 1.3, `<g transform="translate(0 -170)">${A.aiFace(0, 0, 0.9, t)}</g>`)}`);
at(W('intro', 'every'), (t, u) => {
  const tasks = [['♟', 'CHESS'], ['✍', 'WRITING'], ['∑', 'MATH'], ['🎨', 'ART'], ['</>', 'CODE'], ['💊', 'MEDICINE']];
  return `${tech()}${grid(t, 0.1)}${tasks.map(([ic, l], i) => { const x = 300 + (i % 2) * 480, y = 520 + Math.floor(i / 2) * 270, k = ease.back((u - i * 0.18) / 0.3);
    return `<g transform="translate(${x} ${y}) scale(${k})"><rect x="-200" y="-100" width="400" height="200" rx="30" fill="#1b1f3a" stroke="${CYAN}" stroke-width="4"/>
      <text y="-6" font-size="70" text-anchor="middle" fill="#fff" font-family="InterW" font-weight="800">${ic.replace('<', '&lt;').replace('>', '&gt;')}</text>${G.txt(0, 66, 36, '#fff', l)}
      ${u > i * 0.18 + 0.3 ? I.check(160, -80, 0.4, u - i * 0.18 - 0.3) : ''}</g>`; }).join('')}`; });
at(W('intro', 'heres'), (t, u) => {
  const pts = [[250, 520], [780, 640], [300, 800], [780, 940], [280, 1100]];
  const labels = ['WEEK 1', 'JOBS', 'MONTH 3', 'THE TWIST', 'YEAR 1'], kinds = ['phone', 'door', 'bell', 'radio', 'people'];
  let path = `M 540 420`; pts.forEach(([x, y]) => (path += ` L ${x} ${y}`));
  return `${tech('#ffd84a')}<path d="${path}" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round" opacity="0.5"/>
  ${pts.map(([x, y], i) => u >= i * 0.3 ? `${G.icon(kinds[i], x, y, ease.back((u - i * 0.3) / 0.3), t)}<text x="${x + (x < 540 ? 90 : -90)}" y="${y + 14}" font-family="MontB" font-weight="900" font-size="42" fill="#fff" text-anchor="${x < 540 ? 'start' : 'end'}" opacity="${clamp((u - i * 0.3) * 4)}">${labels[i]}</text>` : '').join('')}`; });
// ---------- the shared feeling
at(W('relate', 'you'), (t, u) => `${tech(CYAN)}${I.heldPhone({ ...PHONE, rot: -2 + Math.sin(t * 1.5), id: 'chat', screen: A.screenChat(t, u * 1.3) })}`);
at(W('relate', 'answers'), (t, u) => `${tech(CYAN)}${I.heldPhone({ ...PHONE, x: 600, rot: 2 + Math.sin(t * 1.5), id: 'chat2', screen: A.screenChat(t, 2, { answer: u * 1.6 }) })}
  ${A.stopwatch(220, 560, 0.6, u * 0.5, u < 1.1 ? `${(Math.min(2, u * 1.8)).toFixed(1)}s` : '2.0s')}`);
at(W('relate', 'better'), (t, u) => `${tech(CYAN)}${I.person(300, 1300, 1.0, { shirt: C.coral, pose: 'stand', face: 'neutral', t })}${I.bubbleSay(330, 600, 0.9, u - 0.1, 'Hmm…?')}
  ${I.phone({ x: 760, y: 900, s: 0.62, rot: 6, id: 'chat3', screen: A.screenChat(t, 2, { answer: 2 }) })}${I.check(860, 560, 0.7, u - 0.4)}`);
at(W('relate', 'now'), (t, u) => { const n = Math.floor(clamp((W('relate', 'everything') - W('relate', 'now') - 0.2) > u ? 0 : (u - (W('relate', 'everything') - W('relate', 'now') - 0.2)) / 0.8) * 12);
  const kinds = ['phone', 'plane', 'cart', 'radio', 'door', 'bell', 'candle', 'fridge', 'tap', 'hospital', 'people', 'bulb'];
  return `${tech()}${grid(t, 0.12)}${A.chip(540, 860, 0.7, t, 1)}
  ${kinds.map((k, i) => { const a = i / 12 * Math.PI * 2 - Math.PI / 2, x = 540 + Math.cos(a) * 380, y = 860 + Math.sin(a) * 380, on = i < n;
    return `<line x1="540" y1="860" x2="${x}" y2="${y}" stroke="${CYAN}" stroke-width="5" opacity="${on ? 0.8 : 0.1}"/>${G.icon(k, x, y, 0.8 * (on ? 1 + 0.06 * Math.sin(t * 6 + i) : 0.8), t)}`; }).join('')}`; });
// ---------- week one
at(SAY.week1 - 0.95, (t, u) => `${tech(CYAN)}${I.phone({ x: 540, y: 1000, s: 0.75, id: 'w1', screen: `<rect x="-176" y="-376" width="352" height="752" fill="#1b1f3a"/>${A.aiFace(0, 0, 1, t)}` })}${I.stamp('WEEK 1', u, 560)}`);
at(W('week1', 'your'), (t, u) => { const c = ease.back((u - 0.5) / 0.4);
  return `${tech(CYAN)}${[[180, C.coral], [900, C.yellow]].map(([x, col], i) => I.person(x, 1320, 0.7, { shirt: col, pose: 'cheer', face: 'happy', t, seed: i, flip: i ? -1 : 1 })).join('')}
  ${I.heldPhone({ ...PHONE, rot: -2 + Math.sin(t * 1.5), id: 'smart', screen: `<rect x="-176" y="-376" width="352" height="752" fill="#1b1f3a"/>${A.aiFace(0, -20, 1.1, t)}` })}
  <g opacity="${clamp((u - 0.5) * 5)}">${A.gradCap(540, 360 + 40 * (1 - c), 1)}</g>`; });
at(W('week1', 'plans'), (t, u) => `${tech('#ffd84a')}${I.heldPhone({ ...PHONE, rot: 2 + Math.sin(t * 1.5), id: 'plan', screen: A.screenPlan(t, u) })}`);
at(W('week1', 'fixes'), (t, u) => `${tech(C.green)}${I.heldPhone({ ...PHONE, rot: -2 + Math.sin(t * 1.5), id: 'code', screen: A.screenCode(t, u) })}`);
at(W('week1', 'explains'), (t, u) => `${tech(C.green)}${I.heldPhone({ ...PHONE, rot: 2 + Math.sin(t * 1.5), id: 'tax', screen: A.screenTax(t, u * 1.2) })}`);
// ---------- work
at(SAY.work, (t, u) => `${office()}${desk()}${[[260, C.coral, 0], [540, C.teal, 1], [820, C.yellow, 2]].map(([x, col, i]) => `${I.person(x, 1290, 0.75, { shirt: col, pose: 'talk', t, seed: i })}${A.laptop(x, 1180, 0.4, `<rect x="-236" y="-316" width="472" height="292" fill="#2f7bff" opacity="0.6"/>`)}`).join('')}`);
at(W('work', 'jobs'), (t, u) => { const tm = W('work', 'minutes') - W('work', 'jobs'), n = Math.round(lerp(14, 1, ease.inOut((u - tm) / 1.0)));
  return `${office()}${desk()}${A.paperStack(300, 1170, 1, n, t)}${A.laptop(720, 1180, 0.85, `<g transform="translate(0 -170)">${A.aiFace(0, 0, 0.7, t)}</g>`)}
  ${u > tm ? A.stopwatch(540, 560, 0.75, u * 2, 'MINUTES') : ''}`; });
at(W('work', 'some'), (t, u) => `${I.bg('#3a1430', '#7a2a4a', '#ff5e5b', 820)}${I.person(540, 1420, 1.8, { shirt: C.teal, pose: 'panic', face: 'panic', t })}${I.bubbleSay(820, 520, 1, u - 0.2, '?!', C.yellow)}`);
at(W('work', 'others'), (t, u) => `${I.bg('#14532d', '#22a35a', '#ffd84a', 820)}${I.person(340, 1360, 1.3, { shirt: C.yellow, pose: 'cheer', face: 'happy', t })}${A.checklist(780, 860, 0.9, u * 1.4)}
  ${A.rocket(910, 500 - 60 * ease.out(u / 1.5), 0.35, t, 35)}`);
// ---------- month three
at(SAY.month3 - 0.15, (t, u) => `${lab()}${A.flask(300, 1150, 1, t, C.green)}${A.flask(540, 1150, 1.15, t, PURPLE, 1)}${A.flask(780, 1150, 1, t, CYAN, 2)}${I.stamp('MONTH 3', u, 560)}`);
at(W('month3', 'scientists'), (t, u) => `${lab()}${I.person(300, 1290, 1.0, { shirt: '#f6f7fb', pose: 'talk', t })}<rect x="${300 - 64}" y="${1290 - 400 + 18}" width="128" height="26" rx="12" fill="#2a2e3b" opacity="0.8"/>
  ${A.laptop(760, 1160, 0.7, `<g transform="translate(0 -170)">${A.aiFace(0, 0, 0.6, t)}</g>`)}${A.flask(540, 1150, 0.7, t, PURPLE, 3)}`);
at(W('month3', 'thousands'), (t, u) => { const n = Math.floor(ease.out(u / 1.6) * 40), v = Math.round(ease.out(u / 1.6) * 1000);
  return `${lab()}${[...Array(40)].map((_, i) => i < n ? A.flask(160 + (i % 8) * 108, 560 + Math.floor(i / 8) * 150, 0.42, t, [C.green, PURPLE, CYAN, C.coral][i % 4], i) : '').join('')}
  ${G.outlined(540, 1330, 96, C.yellow, `${v.toLocaleString('en-US')}+ A DAY`, 10)}`; });
at(W('month3', 'new'), (t, u) => `${I.bg('#0b2a3a', '#145a6b', CYAN, 820)}${A.molecule(540, 760, 1.1, t)}
  ${[[260, 1150, -20, C.coral], [540, 1200, 10, C.yellow], [820, 1140, 30, C.green]].map(([x, y, r, col], i) => `<g transform="translate(0 ${-40 * ease.back((u - 0.2 - i * 0.1) / 0.4) + 40})" opacity="${clamp((u - 0.2 - i * 0.1) * 5)}">${A.pill(x, y, 1.3, r + t * 20, col)}</g>`).join('')}`);
at(W('month3', 'materials'), (t, u) => `${tech(CYAN)}${A.lattice(540, 860, 1.15, t)}`);
at(W('month3', 'faster'), (t, u) => `${tech('#ffd84a')}${[...Array(14)].map((_, i) => { const p = (t * 2 + hash(i, 1)) % 1; return `<line x1="${hash(i, 2) * 1080}" y1="${1900 - p * 1700}" x2="${hash(i, 2) * 1080 - 60}" y2="${1900 - p * 1700 + 160}" stroke="#fff" stroke-width="6" opacity="${0.6 * (1 - p)}"/>`; }).join('')}
  ${A.rocket(540 + I.wobble(t, 30, 4), 900 - 80 * ease.out(u / 1.5), 1.6, t, 20)}`);
// ---------- the twist
at(SAY.twist - 0.1, (t, u) => `${I.bg('#120a2e', '#3a1a6b', '#c77dff', 820)}${G.stars(t, 40, 12)}
  <g transform="translate(540 820) rotate(${u * 40})" opacity="0.5">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M 0 0 L ${Math.cos(i) * 600} ${Math.sin(i) * 600}" stroke="#c77dff" stroke-width="40" opacity="0.3"/>`).join('')}</g>${I.stamp('THE TWIST', u, 860)}`);
at(W('twist', 'hard'), (t, u) => { const s = clamp((u - 1.0) / 0.3);
  return `${tech()}${A.chip(540, 1020, 0.8, t, 1)}${G.outlined(540, 560, 110, '#fff', 'HOW SMART?', 10)}<line x1="150" y1="525" x2="${150 + 780 * s}" y2="525" stroke="${C.red}" stroke-width="22" stroke-linecap="round"/>`; });
at(W('twist', 'who'), (t, u) => { const k = (i) => ease.back((u - 0.15 - i * 0.15) / 0.3);
  return `${tech()}${A.chip(540, 720, 0.6, t, 1)}${[[200, 1240, 'COMPANIES', false, '#5b6378'], [540, 1300, 'GOVERNMENTS', true, '#8e94a6'], [880, 1240, 'EVERYONE?', false, null]].map(([x, y, l, dome, col], i) =>
    `<line x1="540" y1="720" x2="${x}" y2="${y - 200}" stroke="${CYAN}" stroke-width="5" stroke-dasharray="12 10" opacity="${clamp((u - 0.15 - i * 0.15) * 4)}"/>
    <g transform="translate(${x} ${y}) scale(${k(i)})">${col ? A.building(0, 0, 0.7, col, '', dome) : [[-50, C.coral], [0, C.yellow], [50, C.teal]].map(([dx, c2], j) => I.person(dx, 0, 0.42, { shirt: c2, t, seed: j })).join('')}${G.outlined(0, 70, 40, '#fff', l, 6)}</g>`).join('')}
  ${G.outlined(540, 430, 80, C.yellow, 'WHO CONTROLS IT?', 9)}`; });
at(W('twist', 'whether'), (t, u) => `${tech()}${A.target(300, 700, 1, C.green, 'WHAT WE WANT')}${A.target(800, 1120, 1, C.red, 'WHAT IT WANTS?')}
  ${A.arrowFly(540, 1400, u < 1.2 ? 300 : 800, u < 1.2 ? 700 : 1120, 300, (u % 1.2) / 0.9)}${A.robot(540, 1520, 0.32, t, { eye: CYAN })}`);
at(W('twist', 'researchers'), (t, u) => { const a = lerp(70, 0, ease.inOut((W('twist', 'alignment') - W('twist', 'researchers') + 0.3 > u ? 0 : (u - (W('twist', 'alignment') - W('twist', 'researchers') + 0.3)) / 0.8)));
  return `${I.bg('#2a3352', '#4a5a88')}${A.chalkboard(540, 780, 1, `${G.txt(0, -160, 64, '#f6f3ea', 'ALIGNMENT')}
    <g transform="translate(-200 60)"><line x1="-120" y1="0" x2="120" y2="0" stroke="#f6f3ea" stroke-width="14"/><path d="M 120 -24 L 160 0 L 120 24 Z" fill="#f6f3ea"/>${G.txt(0, 70, 34, '#f6f3ea', 'US')}</g>
    <g transform="translate(200 60) rotate(${-a})"><line x1="-120" y1="0" x2="120" y2="0" stroke="${CYAN}" stroke-width="14"/><path d="M 120 -24 L 160 0 L 120 24 Z" fill="${CYAN}"/></g>${G.txt(200, 130, 34, CYAN, 'AI')}
    ${a < 2 ? I.check(0, 180, 0.5, 1) : ''}`)}
  <rect y="1220" width="1080" height="700" fill="#2a2148"/>${I.person(880, 1330, 0.75, { shirt: '#f6f7fb', pose: 'wave', t })}`; });
// ---------- could it happen?
at(SAY.real, (t, u) => `${tech()}${A.chip(540, 1000, 0.75, t, 1)}
  <text x="540" y="${600 + 10 * Math.sin(t * 4)}" font-family="MontB" font-weight="900" font-size="300" fill="${C.yellow}" text-anchor="middle" stroke="#000" stroke-width="12" paint-order="stroke" transform="rotate(${6 * Math.sin(t * 3)} 540 500)">?</text>`);
at(W('real', 'in'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ffd84a', 820)}${A.clipboard(540, 860, 1.1, u)}`);
at(W('real', 'almost'), (t, u) => { const k = ease.out(u / 0.65), n = Math.floor(k * 120);
  return `${tech(CYAN)}${A.crowdGrid(540, 900, 1, n)}${G.outlined(540, 450, 96, C.yellow, k > 0.98 ? 'ALMOST 3,000' : Math.round(k * 2778).toLocaleString('en-US'), 10)}${G.outlined(540, 1330, 64, '#fff', 'AI RESEARCHERS', 8)}`; });
at(W('real', 'average'), (t, u) => { const tt = W('real', 'fifty') - W('real', 'average'), p = 0.5 * ease.out((u - tt) / 0.6);
  return `${tech(CYAN)}${A.pie(540, 860, 1, p)}${u > tt ? G.outlined(540, 900, 150, '#fff', `${Math.round(p * 100)}%`, 12) : G.outlined(540, 900, 220, '#fff', '?', 12)}${G.outlined(540, 1280, 70, C.yellow, 'CHANCE', 8)}`; });
at(W('real', 'machines'), (t, u) => `${tech()}${A.robot(320, 1250, 0.6, t, { eye: CYAN })}${I.person(780, 1250, 0.95, { shirt: C.coral, pose: 'stand', face: 'neutral', t })}
  ${G.outlined(540, 520, 90, '#fff', 'EVERY TASK', 9)}${I.check(320, 780, 0.7, u - 0.3)}`);
at(W('real', 'by'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ff5e5b', 820)}<g transform="translate(540 860) scale(${ease.back(u / 0.35)})"><g filter="url(#drop)"><rect x="-300" y="-320" width="600" height="600" rx="44" fill="#eef1f8"/></g>
  <rect x="-300" y="-320" width="600" height="150" rx="44" fill="${C.coral}"/><rect x="-300" y="-220" width="600" height="50" fill="${C.coral}"/>${G.txt(0, -220, 60, '#fff', 'THE YEAR')}${G.txt(0, 110, 220, C.ink, '2047')}</g>`);
// ---------- previews from the past
const chessF = (t) => `<g transform="scale(0.4)">${A.chess(0, 0, 1, t, 1)}</g>`, goF = (t) => `<g transform="scale(0.4)">${A.goBoard(0, 0, 1, t, 1)}</g>`;
at(W('history', 'and'), (t, u) => `${I.bg('#1a1426', '#2a1f3a', '#ffd84a', 820)}${A.filmStrip(t, [chessF(t), goF(t), `<g transform="scale(0.5)">${A.chip(0, 0, 0.7, t, 1)}</g>`])}${G.outlined(540, 470, 90, C.yellow, 'PREVIEWS', 9)}`);
at(W('history', 'in'), (t, u) => { const tf = W('history', 'champion') - W('history', 'in');
  return `${I.bg('#2b1c18', '#4a2d22', '#ff9a52', 820)}${A.chess(540, 1000, 0.95, t, clamp((u - tf) / 0.5))}${A.crt(540, 520, 0.7, t, 'IBM DEEP BLUE')}
  ${G.outlined(880, 1360, 90, C.yellow, '1997', 9)}`; });
at(W('history', 'in', 1), (t, u) => { const tm = W('history', 'move') - W('history', 'in', 1);
  return `${I.bg('#2b2410', '#5a4a22', '#ffd84a', 820)}${A.goBoard(540, 900, 1.15, t, u > tm ? u - tm : 0)}${G.outlined(540, 1330, 90, C.yellow, '2016', 9)}
  ${u > tm + 0.4 ? G.outlined(780, 520, 60, CYAN, 'MOVE 37', 7) : ''}`; });
at(W('history', 'expected'), (t, u) => `${I.bg('#3a1430', '#7a2a4a', '#ffd84a', 820)}${[[300, C.teal], [540, C.coral], [780, C.yellow]].map(([x, col], i) => I.person(x, 1350, 0.95, { shirt: col, pose: 'panic', face: 'panic', t, seed: i })).join('')}
  ${G.outlined(540, 620, 200, C.yellow, '?!', 12)}`);
// ---------- one year in
at(SAY.year1 - 0.15, (t, u) => `${park(t)}${I.stamp('YEAR 1', u, 620)}`);
at(W('year1', 'life'), (t, u) => `${park(t)}${[[240, C.teal, 1], [520, C.coral, -1], [800, C.yellow, 1]].map(([x, col, d], i) => I.person(x + d * ((t * 40) % 120), 1240, 0.62, { shirt: col, pose: 'walk', t, seed: i, flip: d })).join('')}
  ${I.bubbleSay(540, 640, 1, u - 0.6, 'Normal?')}`);
at(W('year1', 'people'), (t, u) => `${park(t)}<ellipse cx="540" cy="1250" rx="360" ry="60" fill="#ff8fa3"/>${[[340, C.teal, 'talk'], [540, C.yellow, 'cheer'], [740, '#c77dff', 'talk']].map(([x, col, pose], i) => I.person(x, 1240, 0.75, { shirt: col, pose, face: 'happy', t, seed: i, flip: i === 2 ? -1 : 1 })).join('')}`);
at(W('year1', 'play'), (t, u) => { const p = (t * 0.9) % 1, bx = lerp(330, 750, p < 0.5 ? p * 2 : 2 - p * 2), by = 1180 - 260 * Math.sin(Math.PI * ((p * 2) % 1));
  return `${park(t)}${I.person(260, 1300, 0.85, { shirt: C.coral, pose: 'walk', t })}${I.person(820, 1300, 0.85, { shirt: C.blue, pose: 'walk', t, seed: 2, flip: -1 })}${A.ball(bx, by, 1, t * 400)}`; });
at(W('year1', 'fall'), (t, u) => `${I.bg('#ff9a62', '#ffd27a', '#ff5e5b', 900)}<rect y="1150" width="1080" height="770" fill="#7ab86b"/>${I.person(420, 1320, 1.1, { shirt: C.teal, pose: 'stand', face: 'happy', t })}${I.person(660, 1320, 1.1, { shirt: C.coral, pose: 'stand', face: 'happy', t, flip: -1, hair: '#7a3a18' })}
  ${[0, 1, 2, 3].map((i) => { const p = (t * 0.5 + i / 4) % 1; return A.heart(440 + i * 70 + 30 * Math.sin(p * 9), 820 - p * 360, 0.8 + 0.4 * p, i % 2 ? C.coral : '#ff8fa3').replace('<path', `<path opacity="${1 - p}"`); }).join('')}`);
at(W('year1', 'being'), (t, u) => `${I.bg('#3e1f5c', '#a04a8f', '#ffd27a', 860)}<g transform="translate(540 860) scale(${(1 + 0.05 * Math.sin(t * 5)) * ease.back(u / 0.4)})">${A.heart(0, 40, 6, C.coral)}</g>
  ${G.outlined(540, 900, 96, '#fff', 'HUMAN', 10)}`);
// ---------- the question
at(SAY.cta, (t, u) => `${tech('#ffd84a')}${A.commentBox(540, 860, 1, t, u, ['WOULD YOU TRUST', 'A SUPER AI?'], ['Yes', 'No', 'Maybe', 'A little'])}`);
at(W('cta', 'tell'), (t, u) => `${tech('#ffd84a')}${A.commentBox(540, 800, 0.9, t, 2, ['WOULD YOU TRUST', 'A SUPER AI?'], ['Yes', 'No', 'Maybe', 'A little'])}
  <g transform="translate(540 1220) scale(${1 + 0.08 * Math.sin(t * 10)})"><rect x="-120" y="-80" width="240" height="160" rx="40" fill="#fff"/><path d="M -40 70 L -70 130 L 10 70 Z" fill="#fff"/>
  ${[-50, 0, 50].map((x, i) => `<circle cx="${x}" cy="0" r="16" fill="${C.ink}" opacity="${0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i))}"/>`).join('')}</g>`);

// ------------------------------------------------------------------ the year on the progress bar (months)
const STAMPS = [SAY.week1 - 0.95, SAY.month3 - 0.15, SAY.twist - 0.1, SAY.year1 - 0.15];
const months = X.keyed([[SAY.week1 - 0.9, 0], [SAY.work, 0.3], [SAY.month3 - 0.2, 3], [SAY.twist, 6], [SAY.real - 0.3, 7], [SAY.year1 - 0.2, 11.5], [W('year1', 'life'), 12]]);
function goal(t) {
  const a = X.smooth(SAY.week1 - 1.0, SAY.week1 - 0.6, t) * (1 - X.smooth(SAY.real - 0.3, SAY.real, t)) + X.smooth(SAY.year1 - 0.3, SAY.year1, t) * (1 - X.smooth(SAY.cta - 0.3, SAY.cta, t));
  if (a <= 0) return null;
  const m = months(t), ticks = [3, 6, 9].map((n) => ({ k: n / 12, on: m >= n, pop: Math.exp(-Math.pow((m - n) * 2, 2)) }));
  const pct = m >= 11.99 ? 'YEAR 1' : m < 1 ? `WEEK ${Math.min(4, Math.floor(m * 4.3) + 1)}` : `MONTH ${Math.floor(m)}`;
  return { label: 'SINCE AI GOT SMARTER', pct, k: m / 12, from: 'WEEK 1', to: 'YEAR 1', alpha: a, ticks };
}

// ------------------------------------------------------------------ sound
function buildAudio() {
  const { A: L, fx, S_, music } = X.audioBase(VO, ORDER, SAY, DURATION, cuts(), STAMPS);
  music('music/464.mp3', 0, SAY.year1 + 0.6, { offset: 4 });
  music('music/606.mp3', SAY.year1 - 0.3, DURATION - SAY.year1 + 0.3, { offset: 14, level: 0.55, fin: 0.8 });
  // hook
  fx('riser', { t0: 0.2, t1: W('hook', 'ai'), level: 0.12, curve: 2 });
  fx('sample', { file: 'sfx/2350.wav', t: W('hook', 'ai') - 0.1, level: 0.3 });
  A_sub(L, W('hook', 'ai') + 0.05, 0.35);
  fx('count', { t0: W('hook', 'smarter'), t1: W('hook', 'smarter') + 1.2, from: 20, to: 44, level: 0.07, seed: 2 });
  fx('sparkle', { t: W('hook', 'every') + 0.4, dur: 1.0, count: 8, f: [1600, 4200], level: 0.1, seed: 3 });
  // intro
  fx('clank', { t: W('intro', 'not') + 0.05, level: 0.3 });
  fx('beep', { t: W('intro', 'not') + 0.2, f: 600, n: 3, dur: 0.07, gap: 0.06, level: 0.12 });
  fx('beep', { t: W('intro', 'not') + 0.62, f: 330, n: 2, drop: 0.8, level: 0.22 });
  for (let i = 0; i < 6; i++) fx('sample', { file: 'sfx/1124.wav', t: W('intro', 'program') + 0.1 + i * 0.09, level: 0.1 });
  for (let i = 0; i < 6; i++) fx('pop', { t: W('intro', 'every') + i * 0.18 + 0.05, f: 600 + i * 80, level: 0.18 });
  for (let i = 0; i < 5; i++) fx('pop', { t: W('intro', 'heres') + i * 0.3, f: 700 + i * 90, level: 0.2 });
  // relate: typing, the instant answer, everything lighting up
  for (let i = 0; i < 10; i++) fx('sample', { file: 'sfx/1124.wav', t: W('relate', 'you') + 0.05 + i * 0.08, level: 0.08 });
  fx('ding', { t: W('relate', 'answers') + 0.1, f: 1046.5, level: 0.14 });
  fx('knock', { t: W('relate', 'answers') + 0.2, n: 4, gap: 0.25, level: 0.06 });
  fx('riser', { t0: W('relate', 'now'), t1: W('relate', 'everything') + 0.2, level: 0.12, curve: 2 });
  fx('sparkle', { t: W('relate', 'everything'), dur: 1.0, count: 12, f: [1600, 5200], level: 0.13, seed: 5 });
  // week one
  fx('chime', { t: W('week1', 'your') + 0.5, level: 0.08, freq: 784 });
  for (let i = 0; i < 5; i++) fx('pop', { t: W('week1', 'plans') + i * 0.18 + 0.05, f: 700 + i * 70, level: 0.15 });
  fx('beep', { t: W('week1', 'fixes') + 0.1, f: 300, n: 2, drop: 0.85, dur: 0.12, level: 0.15 });
  fx('ding', { t: W('week1', 'fixes') + (W('week1', 'explains') - W('week1', 'fixes')) * 0.8, f: 1318.5, level: 0.14 });
  fx('kaching', { t: W('week1', 'explains') + 1.05, level: 0.32 });
  // work
  A_crowd(L, SAY.work, W('work', 'some') - 0.1);
  fx('rustle', { t0: W('work', 'minutes'), t1: W('work', 'minutes') + 0.9, level: 0.14 });
  L.push(S_('sfx/493.wav', W('work', 'some'), { dur: W('work', 'others') - W('work', 'some'), level: 0.3, fin: 0.1, fout: 0.2, fx: true }));
  fx('ding', { t: W('work', 'others') + 0.1, f: 1046.5, level: 0.12 });
  for (let i = 0; i < 5; i++) fx('pop', { t: W('work', 'others') + i * 0.18 + 0.05, f: 800 + i * 60, level: 0.13 });
  // month three
  fx('water', { t0: SAY.month3 - 0.15, t1: W('month3', 'new'), level: 0.08, rush: 0 });
  fx('count', { t0: W('month3', 'thousands'), t1: W('month3', 'thousands') + 1.6, from: 22, to: 46, level: 0.07, seed: 6 });
  for (let i = 0; i < 3; i++) fx('pop', { t: W('month3', 'new') + 0.25 + i * 0.1, f: 500 + i * 100, level: 0.18 });
  fx('sparkle', { t: W('month3', 'materials'), dur: 1.0, count: 8, f: [1600, 4400], level: 0.11, seed: 7 });
  fx('sample', { file: 'sfx/2625.wav', t: W('month3', 'faster') - 0.05, level: 0.3 });
  // the twist
  fx('sample', { file: 'sfx/2915.wav', t: SAY.twist - 0.1, level: 0.35, dur: 1.6, fout: 0.4 });
  fx('sample', { file: 'sfx/1117.wav', t: W('twist', 'hard') + 1.0, level: 0.3 });
  fx('pulse', { t0: W('twist', 'who'), t1: W('twist', 'whether'), bpm: [70, 100], level: 0.14 });
  fx('sample', { file: 'sfx/1461.wav', t: W('twist', 'whether') + 0.05, level: 0.3 });
  fx('knock', { t: W('twist', 'whether') + 0.95, n: 1, level: 0.3 });
  fx('chime', { t: W('twist', 'alignment') + 1.0, level: 0.1, freq: 659.25 });
  // could it happen
  fx('creak', { t0: SAY.real + 0.1, t1: SAY.real + 0.7, level: 0.12 });
  fx('sample', { file: 'sfx/2380.wav', t: W('real', 'in') + 0.05, level: 0.3 });
  fx('count', { t0: W('real', 'almost'), t1: W('real', 'almost') + 0.7, from: 26, to: 50, level: 0.07, seed: 8 });
  fx('pop', { t: W('real', 'fifty') + 0.05, f: 660, level: 0.2 });
  fx('ding', { t: W('real', 'machines') + 0.35, f: 1046.5, level: 0.12 });
  fx('sample', { file: 'sfx/1105.wav', t: W('real', 'by') + 0.02, level: 0.35 });
  // previews: film flicker, a chess king falling, a gasp at move 37
  fx('flicker', { t0: W('history', 'and'), t1: W('history', 'in'), level: 0.12 });
  fx('knock', { t: W('history', 'champion') + 0.35, n: 2, gap: 0.12, level: 0.25 });
  fx('sample', { file: 'sfx/965.wav', t: W('history', 'champion') + 0.6, level: 0.18 });
  fx('knock', { t: W('history', 'move') + 0.05, n: 1, level: 0.3 });
  fx('sample', { file: 'sfx/964.wav', t: W('history', 'expected') + 0.1, level: 0.2 });
  fx('sample', { file: 'sfx/966.wav', t: W('history', 'expected') + 0.18, level: 0.18, pan: 0.3 });
  // one year in: a calm park
  L.push(S_('sfx/367.wav', SAY.year1 - 0.2, { offset: 2, dur: SAY.cta - SAY.year1, level: 0.22, fin: 0.4, fout: 0.5, fx: true }));
  fx('knock', { t: W('year1', 'play') + 0.25, n: 2, gap: 0.55, level: 0.2 });
  fx('sparkle', { t: W('year1', 'fall') + 0.2, dur: 1.0, count: 8, f: [1500, 3600], level: 0.1, seed: 9 });
  fx('chime', { t: W('year1', 'being') + 0.1, level: 0.1, freq: 523.25 });
  // the question
  for (let i = 0; i < 4; i++) fx('pop', { t: SAY.cta + 0.2 + i * 0.15, f: 600 + i * 120, level: 0.18 });
  fx('ding', { t: W('cta', 'comments') + 0.3, level: 0.15 });
  return L;
}
const A_sub = (L, t, level) => L.push({ type: 'subdrop', t, dur: 0.9, level, free: true });
const A_crowd = (L, t0, t1) => L.push({ type: 'crowd', t0, t1, level: 0.07, fx: true, swell: [[t0, 0.5], [t1, 0.5]] });

export default X.scenario({ id: 'ai-smarter', title: 'What if AI became smarter than us?', DURATION, FADE, CSS: X.css(CYAN, PURPLE),
  caps: X.captions(VO, ORDER, SAY, NUMS, KEYWORDS), audio: buildAudio(), goal, svgFrame: frame });
export const _debug = { SAY, DURATION, S, wordT: W };
export { svgAt };
