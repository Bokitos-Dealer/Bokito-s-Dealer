// What if a giant asteroid was heading for Earth? — illustrated explainer (plumbing in explainer.js).
// Facts: Chelyabinsk, 15 Feb 2013: <20 m object, ~1,600 people sought medical help, mostly from broken glass; Chicxulub
// impactor ~10 km; NASA's DART hit Dimorphos on 26 Sep 2022 and shortened its orbit by 32 minutes (11h55m → 11h23m);
// NASA: no known asteroid larger than 140 m has a significant chance of hitting Earth in the next 100 years; NEO Surveyor.
import VO from './asteroid.vo.js';
import * as I from './ill2d.js';
import * as G from './ill2d-grid.js';
import * as A from './ill2d-ai.js';
import * as Sp from './ill2d-space.js';
import * as X from './explainer.js';

const { C, ease, clamp, lerp, hash } = I;

const ORDER = ['hook', 'intro', 'relate', 'found', 'size', 'plan', 'twist', 'real', 'end', 'cta'];
const GAP = { hook: 0.1, intro: 0.3, relate: 0.35, found: 1.0, size: 0.45, plan: 0.45, twist: 0.5, real: 0.4, end: 0.55, cta: 0.35 };
const { SAY, W, FADE, DURATION } = X.timeline(VO, ORDER, GAP);

const NUMS = [['day one', 'DAY 1'], ['ten years', '10 YEARS'], ['2013', '2013'], ['twenty meters', '20 M (65 FT)'], ['20 meters', '20 M (65 FT)'], ['a thousand', '1,000'],
  ['ten kilometers', '10 KM (6 MILES)'], ['10 kilometers', '10 KM (6 MILES)'], ['2022', '2022'], ['thirty two minutes', '32 MINUTES'], ['32 minutes', '32 MINUTES'],
  ['hundred years', '100 YEARS'], ['year ten', 'YEAR 10'], ['year 10', 'YEAR 10']];
const KEYWORDS = /^(giant|asteroid|earth|drilling|real|science|wish|sand|stadium|telescopes|impact|size|russia|glass|dinosaurs|crash|spacecraft|tested|dart|orbit|crazy|nudge|early|miss|rare|threat|telescope|safe|show|comments)$/i;

// ------------------------------------------------------------------ backgrounds
const { S, at, frame, svgAt, cuts } = X.stack();
const night = (glow = null, gy = 820) => I.bg('#0e1530', '#1d2a55', glow, gy);
const sky = (t, glow = null) => `${I.bg('#05081a', '#18224a', glow, 1000)}${G.stars(t, 70, 6)}${G.milkyWay(0.6)}<rect y="1250" width="1080" height="670" fill="#151b33"/>`;

// ---------- the hook
at(0, (t, u) => `${Sp.space(t, '#ff8a3d', 900)}${Sp.earth(760, 1200, 260, t)}${Sp.asteroid(lerp(220, 330, u / 3), lerp(560, 650, u / 3), 1.6, t, { tail: 0.6, dir: 220 })}`);
at(W('hook', 'heading'), (t, u) => { const k = ease.inOut(u / 1.4);
  return `${Sp.space(t, '#ff3b3b', 900)}${Sp.earth(540, 1150, lerp(200, 330, k), t)}${Sp.asteroid(540, lerp(420, 640, k), lerp(0.9, 1.4, k), t, { tail: 0.5, dir: 270 })}
  <g opacity="${clamp((u - 0.4) * 4)}">${G.outlined(540, 1440, 70, C.red, 'IMPACT COURSE', 8)}</g>`; });
// ---------- what the video is about
at(W('intro', 'not'), (t, u) => `${Sp.space(t, '#ffb347')}${Sp.asteroid(540, 860, 2.2, t)}${[[380, 700], [700, 760], [520, 1040]].map(([x, y], i) => `<g transform="translate(${x} ${y})"><rect x="-26" y="-60" width="52" height="60" rx="10" fill="${C.yellow}"/>${I.person(0, 60, 0.22, { shirt: '#ff8a1e', t, seed: i })}<rect x="-6" y="0" width="12" height="80" fill="#9aa3b8" transform="rotate(${20 * Math.sin(t * 8 + i)})"/></g>`).join('')}
  ${I.xmark(830, 520, 0.85, u - 0.6)}`);
at(W('intro', 'real'), (t, u) => `${I.bg('#0b1a2a', '#14365a', '#7fe8ff', 820)}${A.chalkboard(540, 820, 0.95, `${G.txt(0, -150, 56, '#f6f3ea', 'THE PLAN')}
  <path d="M -300 100 Q -40 -160 260 60" stroke="#f6f3ea" stroke-width="8" fill="none" stroke-dasharray="16 12"/><circle cx="260" cy="60" r="40" fill="none" stroke="#7fe8ff" stroke-width="8"/>
  <text x="-300" y="190" font-family="monospace" font-size="40" fill="#f6f3ea">F = m · a</text><text x="40" y="200" font-family="monospace" font-size="40" fill="#f6f3ea">Δv = 1 cm/s</text>`)}`);
at(W('intro', 'heres'), (t, u) => {
  const pts = [[250, 520], [780, 640], [300, 800], [780, 940], [280, 1100]], labels = ['DAY 1', 'HOW BIG?', 'THE PLAN', 'THE TWIST', 'YEAR 10'];
  let path = `M 540 420`; pts.forEach(([x, y]) => (path += ` L ${x} ${y}`));
  const ic = (i, x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})"><circle r="62" fill="#fff" filter="url(#soft)"/><g transform="scale(${i === 2 ? 0.16 : 0.35})">${i === 2 ? Sp.dart(0, 0, 1) : i === 4 ? Sp.earth(0, 0, 110, t) : Sp.asteroid(0, 0, 1, t)}</g></g>`;
  return `${Sp.space(t, '#ffd84a')}<path d="${path}" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round" opacity="0.5"/>
  ${pts.map(([x, y], i) => u >= i * 0.25 ? `${ic(i, x, y, ease.back((u - i * 0.25) / 0.3))}<text x="${x + (x < 540 ? 90 : -90)}" y="${y + 14}" font-family="MontB" font-weight="900" font-size="42" fill="#fff" text-anchor="${x < 540 ? 'start' : 'end'}" opacity="${clamp((u - i * 0.25) * 4)}">${labels[i]}</text>` : '').join('')}`; });
// ---------- the shooting star
at(W('relate', 'you'), (t, u) => `${sky(t)}${I.person(400, 1380, 1.0, { shirt: C.coral, pose: 'stand', face: 'happy', t })}${I.person(660, 1380, 0.95, { shirt: C.teal, pose: 'wave', face: 'happy', t, flip: -1 })}
  ${G.shootingStar(0.2, u, 420)}${u > 1 ? I.bubbleSay(780, 760, 0.9, u - 1, 'Make a wish!') : ''}`);
at(W('relate', 'most'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#7fe8ff', 820)}<circle cx="540" cy="860" r="300" fill="#eef1f8" filter="url(#drop)"/><circle cx="540" cy="860" r="270" fill="#dff1ff"/>
  ${[...Array(9)].map((_, i) => `<circle cx="${440 + hash(i, 1) * 200}" cy="${760 + hash(i, 2) * 200}" r="${8 + hash(i, 3) * 10}" fill="#c9a66b"/>`).join('')}<circle cx="560" cy="870" r="14" fill="#8a7a6a"/>
  <circle cx="540" cy="860" r="290" fill="none" stroke="#9aa3b8" stroke-width="20"/>${G.outlined(540, 1290, 76, '#fff', 'GRAIN OF SAND', 8)}`);
at(W('relate', 'this'), (t, u) => { const k = ease.out((u - 0.3) / 0.9);
  return `${I.bg('#0e1530', '#1d2a55', '#ffb347', 1000)}<rect y="1200" width="1080" height="720" fill="#2a3352"/>${Sp.stadium(540, 1240, 1.2)}
  <g opacity="${clamp(u * 3)}">${Sp.asteroid(540, lerp(700, 860, k), lerp(0.5, 3.0, k), t)}</g>${G.outlined(540, 460, 84, C.yellow, 'STADIUM-SIZED', 9)}`; });
// ---------- day one: spotted
at(SAY.found - 0.95, (t, u) => `${sky(t)}${Sp.observatory(540, 1260, 1.2, t)}${I.stamp('DAY 1', u, 560)}`);
at(W('found', 'telescopes'), (t, u) => `${Sp.space(t)}<circle cx="540" cy="860" r="380" fill="#000" stroke="#c3c9d6" stroke-width="26" filter="url(#drop)"/><clipPath id="eye"><circle cx="540" cy="860" r="370"/></clipPath>
  <g clip-path="url(#eye)">${G.stars(t, 40, 9, 1, 1300)}${Sp.asteroid(540 + 80 * Math.sin(u), 860, 0.6, t)}<circle cx="${540 + 80 * Math.sin(u)}" cy="860" r="${110 + 10 * Math.sin(t * 6)}" fill="none" stroke="${C.red}" stroke-width="8"/></g>
  <line x1="540" y1="490" x2="540" y2="1230" stroke="#fff" stroke-width="2" opacity="0.4"/><line x1="170" y1="860" x2="910" y2="860" stroke="#fff" stroke-width="2" opacity="0.4"/>`);
at(W('found', 'astronomers'), (t, u) => `${night('#7fe8ff')}${Sp.trajectory(540, 860, 1, t, { p: clamp(u / 2.5) })}${I.person(180, 1360, 0.6, { shirt: '#f6f7fb', pose: 'talk', t })}`);
at(W('found', 'impact'), (t, u) => `${Sp.space(t, '#ff3b3b')}<g transform="translate(540 860) scale(${ease.back(u / 0.35)})">${G.outlined(0, -60, 110, '#fff', 'IMPACT IN', 10)}${G.outlined(0, 120, 170, C.red, '10 YEARS', 13)}</g>`);
// ---------- size
at(W('size', 'the'), (t, u) => { const tm = W('size', 'mostly') - W('size', 'the');
  return u < tm - 0.2 ? `${I.bg('#7cc7ff', '#ffd9a8')}${I.cityline(1250, t, 0, '#5b6b9a', 8)}<rect y="1250" width="1080" height="670" fill="#8a93a8"/>
    <line x1="${900 - 900 * clamp(u / 2)}" y1="${380 + 500 * clamp(u / 2)}" x2="${1100 - 900 * clamp(u / 2)}" y2="${300 + 500 * clamp(u / 2)}" stroke="#fff" stroke-width="20" stroke-linecap="round"/>
    <circle cx="${900 - 900 * clamp(u / 2)}" cy="${380 + 500 * clamp(u / 2)}" r="34" fill="#fff8d6" filter="url(#glow)"/>${G.outlined(540, 520, 76, '#fff', 'RUSSIA, 2013', 8)}${G.outlined(540, 1400, 60, C.yellow, 'UNDER 20 M (65 FT)', 7)}`
    : `${I.bg('#2a3352', '#4a5a88', '#ffd27a', 820)}${Sp.crackedWindow(540, 860, 1.4, (u - tm + 0.2) / 0.5, t)}${G.outlined(540, 1300, 70, C.yellow, 'BROKEN GLASS', 8)}`; });
at(W('size', 'the', 1), (t, u) => { const k = ease.inOut((u - 0.6) / 1.2);
  return `${I.bg('#7cc7ff', '#d6efff')}<rect y="1300" width="1080" height="620" fill="#8bc77b"/>
  <g transform="translate(540 1300) scale(${lerp(1, 0.25, k)}) translate(-540 -1300)">${I.house(300, 1300, 0.6)}${G.outlined(300, 1360, 46, '#fff', '20 M', 6)}
  <path d="M 380 1300 L 900 ${1300 - 2200} L 1500 1300 Z" fill="#7a8296" opacity="${k}"/></g>
  <g opacity="${clamp((u - 0.8) * 3)}">${G.outlined(540, 560, 110, C.red, '10 KM', 11)}${G.outlined(540, 660, 60, '#fff', '(6 MILES) WIDE', 7)}</g>
  ${u < 0.8 ? `<g transform="translate(820 800) scale(0.8)">${I.person(0, 0, 0.6, { shirt: C.green, t })}<path d="M -60 -20 C -80 -120 40 -160 90 -100 L 120 -60 L 60 -40 Z" fill="#3fbf7f"/></g>` : ''}`; });
// ---------- the plan
at(SAY.plan, (t, u) => `${night('#ffd84a')}<text x="540" y="${980 + 10 * Math.sin(t * 4)}" font-family="MontB" font-weight="900" font-size="380" fill="${C.yellow}" text-anchor="middle" stroke="#000" stroke-width="14" paint-order="stroke">?</text>${G.outlined(540, 500, 90, '#fff', 'THE PLAN', 9)}`);
at(W('plan', 'we'), (t, u) => { const p = clamp(u / 1.3);
  return `${Sp.space(t)}${Sp.asteroid(760, 820, 1.6, t)}${Sp.dart(lerp(-200, 560, p * p), lerp(1300, 900, p * p), 0.7, -30)}${p >= 1 ? `<circle cx="640" cy="880" r="${60 + 300 * clamp(u - 1.3)}" fill="#fff" opacity="${0.9 * (1 - clamp((u - 1.3) / 0.5))}"/>` : ''}`; });
at(W('plan', 'and'), (t, u) => `${I.bg('#0b1a2a', '#14365a', '#7fe8ff', 820)}${I.check(540, 820, 1.5, u)}${G.outlined(540, 1130, 90, '#fff', 'ALREADY TESTED', 9)}`);
at(W('plan', 'in'), (t, u) => { const tc = W('plan', 'changed') - W('plan', 'in'), hit = u - tc + 0.3, k = clamp(hit / 1.5);
  return `${Sp.space(t)}${Sp.binary(540, 760, 1.05, t, k, hit)}${hit < 0 ? Sp.dart(lerp(-100, 540 + Math.cos(t * 0.9) * 300, clamp(u / tc)), lerp(1300, 760, clamp(u / tc)), 0.25, -40) : ''}
  ${Sp.clockText(540, 1230, 1, '11h 55m', k > 0.5 ? '11h 23m' : '')}${G.outlined(540, 460, 70, '#fff', 'DART · 2022', 8)}${k > 0.6 ? G.outlined(540, 1360, 64, C.yellow, '−32 MINUTES', 7) : ''}`; });
// ---------- the twist
at(SAY.twist - 0.1, (t, u) => `${I.bg('#120a2e', '#3a1a6b', '#c77dff', 820)}${G.stars(t, 40, 12)}
  <g transform="translate(540 820) rotate(${u * 40})" opacity="0.5">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M 0 0 L ${Math.cos(i) * 600} ${Math.sin(i) * 600}" stroke="#c77dff" stroke-width="40" opacity="0.3"/>`).join('')}</g>${I.stamp('THE TWIST', u, 860)}`);
at(W('twist', 'you'), (t, u) => `${Sp.space(t, '#ff5e5b')}${Sp.asteroid(540, 860, 2.2, t)}<g transform="translate(540 860) scale(${1 + 0.1 * Math.sin(t * 10)})"><text y="40" font-size="200" text-anchor="middle">💥</text></g>${I.xmark(830, 520, 0.85, u - 0.5)}`);
at(W('twist', 'if'), (t, u) => `${Sp.space(t, C.green)}${Sp.nudge(540, 900, 1.05, t, u / 1.3)}`);
at(W('twist', 'because'), (t, u) => `${night(C.green)}${Sp.trajectory(540, 860, 1, t, { p: clamp(u / 2.4), miss: 1 })}${u > 1.6 ? I.check(840, 480, 0.8, u - 1.6) : ''}`);
// ---------- could it happen?
at(SAY.real, (t, u) => `${Sp.space(t, '#2f7bff')}${Sp.earth(540, 980, 300, t)}<text x="540" y="${560 + 10 * Math.sin(t * 4)}" font-family="MontB" font-weight="900" font-size="300" fill="${C.yellow}" text-anchor="middle" stroke="#000" stroke-width="12" paint-order="stroke" transform="rotate(${6 * Math.sin(t * 3)} 540 460)">?</text>`);
at(W('real', 'big'), (t, u) => `${night(C.green)}${A.pie(540, 860, 0.9, 0.04)}${G.outlined(540, 1260, 90, C.yellow, 'VERY RARE', 9)}`);
at(W('real', 'nasa'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#34c759', 820)}<g transform="translate(540 820) scale(${ease.back(u / 0.35)})"><g filter="url(#drop)"><rect x="-300" y="-320" width="600" height="600" rx="44" fill="#eef1f8"/></g>
  <rect x="-300" y="-320" width="600" height="150" rx="44" fill="${C.green}"/><rect x="-300" y="-220" width="600" height="50" fill="${C.green}"/>${G.txt(0, -222, 52, '#fff', 'NO KNOWN THREAT')}${G.txt(0, 90, 200, C.ink, '100')}${G.txt(0, 200, 60, C.ink, 'YEARS')}</g>`);
at(W('real', 'and'), (t, u) => `${Sp.space(t, '#7fe8ff')}${Sp.telescope(560 + 20 * Math.sin(t * 0.6), 820, 1.1, t)}
  ${[...Array(6)].map((_, i) => { const on = u > 0.6 + i * 0.2; return on ? `<g transform="translate(${180 + hash(i, 1) * 720} ${460 + hash(i, 2) * 300})"><circle r="40" fill="none" stroke="${C.yellow}" stroke-width="5"/><circle r="8" fill="#c9a66b"/></g>` : ''; }).join('')}
  ${G.outlined(540, 1300, 70, '#fff', 'NEO SURVEYOR', 8)}`);
// ---------- year ten
at(SAY.end - 0.15, (t, u) => `${sky(t)}${I.stamp('YEAR 10', u, 600)}`);
at(W('end', 'the'), (t, u) => { const p = clamp(u / 3.2);
  return `${Sp.space(t)}${Sp.earth(540, 1150, 320, t)}<path d="M -100 400 Q 540 650 1180 520" stroke="${C.green}" stroke-width="6" stroke-dasharray="16 14" fill="none"/>
  ${Sp.asteroid(lerp(-100, 1180, p), 400 + 2 * (1 - p) * p * 250 + p * p * 120, 0.5, t, { tail: 0.4, dir: 190 })}${G.outlined(540, 1580, 60, C.green, 'SAFE DISTANCE ✓', 7)}`; });
at(W('end', 'everyone'), (t, u) => `${sky(t, '#7fe8ff')}${G.shootingStar(0.1, (u % 1.8), 420)}${[[200, C.teal, 'wave'], [380, C.coral, 'cheer'], [560, C.yellow, 'stand'], [740, '#c77dff', 'cheer'], [900, C.blue, 'wave']].map(([x, col, pose], i) => I.person(x, 1380, 0.8, { shirt: col, pose, face: 'happy', t, seed: i, flip: i > 2 ? -1 : 1 })).join('')}
  ${Sp.asteroid(lerp(900, 200, clamp(u / 3)), 520, 0.25, t, { tail: 0.5, dir: 10 })}`);
// ---------- the question
const ASK = ['WOULD YOU WANT', 'TO KNOW?'], OPTS = ['Yes', 'No', 'Maybe', 'Only if…'];
at(SAY.cta, (t, u) => `${night('#ffd84a')}${A.commentBox(540, 860, 1, t, u, ASK, OPTS)}`);
at(W('cta', 'tell'), (t, u) => `${night('#ffd84a')}${A.commentBox(540, 800, 0.9, t, 2, ASK, OPTS)}
  <g transform="translate(540 1220) scale(${1 + 0.08 * Math.sin(t * 10)})"><rect x="-120" y="-80" width="240" height="160" rx="40" fill="#fff"/><path d="M -40 70 L -70 130 L 10 70 Z" fill="#fff"/>
  ${[-50, 0, 50].map((x, i) => `<circle cx="${x}" cy="0" r="16" fill="${C.ink}" opacity="${0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i))}"/>`).join('')}</g>`);

// ------------------------------------------------------------------ the countdown bar
const STAMPS = [SAY.found - 0.95, SAY.twist - 0.1, SAY.end - 0.15];
const years = X.keyed([[W('found', 'impact'), 10], [SAY.plan, 9.5], [SAY.twist, 9], [SAY.real, 8], [SAY.end - 0.2, 0.5], [W('end', 'the'), 0]]);
function goal(t) {
  const a = X.smooth(W('found', 'impact') - 0.3, W('found', 'impact'), t) * (1 - X.smooth(SAY.real - 0.3, SAY.real, t)) + X.smooth(SAY.end - 0.3, SAY.end, t) * (1 - X.smooth(SAY.cta - 0.3, SAY.cta, t));
  if (a <= 0) return null;
  const y = years(t), miss = t > W('twist', 'because') + 1.6;
  const ticks = [2, 4, 6, 8].map((n) => ({ k: 1 - n / 10, on: y <= n, pop: Math.exp(-Math.pow((y - n) * 3, 2)) }));
  if (t > SAY.end) return { label: 'SAFE MISS ✓', pct: 'YEAR 10', k: 1, from: '10 YRS', to: 'NOW', alpha: a, ticks };
  return { label: miss ? 'ON COURSE TO MISS ✓' : 'IMPACT IN', pct: `${Math.ceil(y)} YEARS`, k: 1 - y / 10, from: '10 YRS', to: 'IMPACT', alpha: a, ticks };
}

// ------------------------------------------------------------------ sound
function buildAudio() {
  const { A: L, fx, S_, music } = X.audioBase(VO, ORDER, SAY, DURATION, cuts(), STAMPS);
  music('music/184.mp3', 0, SAY.twist + 0.6, { offset: 2 });
  music('music/606.mp3', SAY.twist - 0.3, DURATION - SAY.twist + 0.3, { offset: 14, level: 0.55, fin: 0.8 });
  const sub = (t, level) => L.push({ type: 'subdrop', t, dur: 0.9, level, free: true });
  // hook
  fx('sample', { file: 'sfx/1718.wav', t: 0, dur: W('hook', 'earth') + 0.6, level: 0.3, fin: 0.3, fout: 0.3 });
  fx('riser', { t0: W('hook', 'heading'), t1: W('hook', 'earth') + 0.3, level: 0.14, curve: 2 });
  sub(W('hook', 'earth') + 0.3, 0.35);
  // intro
  for (let i = 0; i < 3; i++) fx('clank', { t: W('intro', 'not') + 0.1 + i * 0.18, level: 0.12 });
  fx('beep', { t: W('intro', 'not') + 0.62, f: 330, n: 2, drop: 0.8, level: 0.22 });
  fx('sample', { file: 'sfx/2385.wav', t: W('intro', 'real') + 0.1, level: 0.2 });
  for (let i = 0; i < 5; i++) fx('pop', { t: W('intro', 'heres') + i * 0.25, f: 700 + i * 90, level: 0.2 });
  // the shooting star
  L.push(S_('sfx/1789.wav', W('relate', 'you') - 0.2, { dur: W('relate', 'most') - W('relate', 'you') + 0.4, level: 0.22, fin: 0.3, fout: 0.3, fx: true }));
  fx('sparkle', { t: W('relate', 'you') + 0.2, dur: 0.8, count: 8, f: [1800, 4800], level: 0.12, seed: 3 });
  fx('pop', { t: W('relate', 'most') + 0.2, f: 1200, level: 0.12 });
  fx('sample', { file: 'sfx/2918.wav', t: W('relate', 'this') + 0.25, level: 0.3 });
  // day one
  fx('creak', { t0: SAY.found - 0.6, t1: SAY.found + 0.2, level: 0.12 });
  fx('beep', { t: W('found', 'telescopes') + 0.3, f: 1200, n: 3, dur: 0.06, gap: 0.1, level: 0.12 });
  for (let i = 0; i < 8; i++) fx('sample', { file: 'sfx/1124.wav', t: W('found', 'astronomers') + 0.2 + i * 0.1, level: 0.07 });
  fx('sample', { file: 'sfx/2915.wav', t: W('found', 'impact') + 0.05, level: 0.3, dur: 1.4, fout: 0.4 });
  // size
  fx('sample', { file: 'sfx/1578.wav', t: W('size', 'the'), dur: 1.6, level: 0.25, fin: 0.2, fout: 0.4 });
  sub(W('size', 'the') + 1.5, 0.35);
  fx('sample', { file: 'sfx/759.wav', t: W('size', 'mostly') - 0.15, level: 0.22 });
  fx('riser', { t0: W('size', 'the', 1) + 0.4, t1: W('size', 'about'), level: 0.12, curve: 2 });
  sub(W('size', 'about') + 0.05, 0.4);
  // the plan
  fx('creak', { t0: SAY.plan + 0.1, t1: SAY.plan + 0.6, level: 0.1 });
  fx('sample', { file: 'sfx/2625.wav', t: W('plan', 'we') + 0.6, level: 0.25 });
  fx('sample', { file: 'sfx/2896.wav', t: W('plan', 'we') + 1.3, level: 0.3, dur: 1.0, fout: 0.4 });
  fx('ding', { t: W('plan', 'and') + 0.1, f: 1046.5, level: 0.13 });
  fx('sample', { file: 'sfx/563.wav', t: W('plan', 'changed') - 0.3, level: 0.25 });
  fx('count', { t0: W('plan', 'changed'), t1: W('plan', 'changed') + 1.2, from: 30, to: 14, level: 0.07, seed: 4 });
  // the twist
  fx('sample', { file: 'sfx/2915.wav', t: SAY.twist - 0.1, level: 0.35, dur: 1.6, fout: 0.4 });
  fx('beep', { t: W('twist', 'you') + 0.52, f: 330, n: 2, drop: 0.8, level: 0.2 });
  fx('knock', { t: W('twist', 'if') + 0.35, n: 1, level: 0.3 });
  fx('sample', { file: 'sfx/1490.wav', t: W('twist', 'if') + 0.5, level: 0.2 });
  fx('chime', { t: W('twist', 'because') + 1.6, level: 0.1, freq: 784 });
  // could it happen
  fx('creak', { t0: SAY.real + 0.1, t1: SAY.real + 0.7, level: 0.12 });
  fx('ding', { t: W('real', 'nasa') + 0.2, f: 880, level: 0.12 });
  for (let i = 0; i < 6; i++) fx('pop', { t: W('real', 'and') + 0.6 + i * 0.2, f: 900 + i * 60, level: 0.1 });
  // year ten
  fx('sample', { file: 'sfx/1579.wav', t: W('end', 'the') + 0.4, dur: 2.6, level: 0.2, fin: 0.6, fout: 0.8 });
  L.push(S_('sfx/1789.wav', W('end', 'everyone') - 0.2, { dur: SAY.cta - W('end', 'everyone') + 0.2, level: 0.2, fin: 0.3, fout: 0.3, fx: true }));
  L.push({ type: 'crowd', t0: W('end', 'everyone'), t1: SAY.cta, level: 0.07, fx: true, swell: [[W('end', 'everyone'), 0.4], [SAY.cta, 0.8]] });
  // the question
  for (let i = 0; i < 4; i++) fx('pop', { t: SAY.cta + 0.2 + i * 0.15, f: 600 + i * 120, level: 0.18 });
  fx('ding', { t: W('cta', 'comments') + 0.3, level: 0.15 });
  return L;
}

export default X.scenario({ id: 'asteroid', title: 'What if an asteroid was heading for Earth?', DURATION, FADE, CSS: X.css('#ff8a3d', '#ffd84a'),
  caps: X.captions(VO, ORDER, SAY, NUMS, KEYWORDS), audio: buildAudio(), goal, svgFrame: frame });
export const _debug = { SAY, DURATION, S, wordT: W };
export { svgAt };
