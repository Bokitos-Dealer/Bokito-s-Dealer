// What if you could never afford a home? — illustrated explainer (plumbing in explainer.js).
// Facts: Harvard JCHS — US median single-family home price ≈ 5× median household income in 2024 (record), ≈ 3.2× through the
// 1990s; 2019–2024 prices +48% vs incomes +22%; Vienna — roughly half or more of residents live in municipal or subsidised
// housing; Tokyo's permissive zoning kept new supply high and real prices broadly flat for decades.
import VO from './housing.vo.js';
import * as I from './ill2d.js';
import * as G from './ill2d-grid.js';
import * as A from './ill2d-ai.js';
import * as K from './ill2d-ww3.js';
import * as H from './ill2d-housing.js';
import * as X from './explainer.js';

const { C, ease, clamp, lerp, hash } = I;

const ORDER = ['hook', 'intro', 'relate', 'past', 'now', 'rent', 'parents', 'twist', 'real', 'end', 'cta'];
const GAP = { hook: 0.1, intro: 0.3, relate: 0.35, past: 0.9, now: 0.45, rent: 0.45, parents: 0.4, twist: 0.5, real: 0.4, end: 0.45, cta: 0.35 };
const { SAY, W, FADE, DURATION } = X.timeline(VO, ORDER, GAP);

const NUMS = [['1990s', '1990s'], ['three times', '3× INCOME'], ['five times', '5× INCOME'], ['a third', '1/3']];
const KEYWORDS = /^(never|afford|home|worked|lazy|math|listings|price|app|mortgage|done|today|worse|rent|paycheck|deposit|harder|parents|thirties|numbers|crazy|fixed|vienna|half|tokyo|fast|calm|millions|faster|paychecks|nature|build|reach|own|comments)$/i;

// ------------------------------------------------------------------ backgrounds
const { S, at, frame, svgAt, cuts } = X.stack();
const night = (glow = null, gy = 820) => I.bg('#0e1530', '#1d2a55', glow, gy);
const street = (t) => `${I.bg('#7cc7ff', '#d6efff')}<circle cx="860" cy="520" r="80" fill="#fff3b0"/><rect y="1130" width="1080" height="790" fill="#8bc77b"/><rect y="1200" width="1080" height="120" fill="#9aa3b8"/>`;
const PHONE = { x: 540, y: 815, s: 1.05 };

// ---------- the hook
at(0, (t, u) => `${street(t)}${I.house(540, 1140, 1.6, '#ffb27a', '#c0392b')}<g transform="translate(540 600) rotate(${4 * Math.sin(t * 3)})"><rect x="-200" y="-60" width="400" height="120" rx="12" fill="#fff" filter="url(#soft)"/>${G.txt(0, 22, 64, C.red, 'FOR SALE')}</g>`);
at(W('hook', 'never'), (t, u) => `${street(t)}${I.house(540, 1140, 1.6, '#ffb27a', '#c0392b')}${I.person(200, 1380, 0.9, { shirt: C.teal, face: 'panic', t })}<g opacity="${clamp(u * 3)}">${G.outlined(540, 560, 100, C.red, 'OUT OF REACH', 10)}</g>
  <rect x="${540 - 300}" y="760" width="600" height="440" fill="none" stroke="${C.red}" stroke-width="14" stroke-dasharray="30 20" opacity="${clamp((u - 0.3) * 3)}"/>`);
at(W('hook', 'no'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ffd84a', 820)}${I.person(540, 1360, 1.4, { shirt: C.coral, pose: 'walk', face: 'panic', t })}${A.stopwatch(820, 560, 0.6, u * 4, 'WORK, WORK…')}`);
// ---------- what the video is about
at(W('intro', 'not'), (t, u) => `${I.bg('#2b2260', '#463a8c')}${I.person(540, 1250, 1, { shirt: C.teal, t })}${I.couch(540, 1180, 1.3)}${G.outlined(540, 560, 90, '#fff', 'LAZY?', 9)}${I.xmark(800, 560, 0.85, u - 0.4)}`);
at(W('intro', 'because', 1), (t, u) => `${I.bg('#0b1a2a', '#14365a', '#7fe8ff', 820)}${A.chalkboard(540, 820, 0.95, `${G.txt(0, -100, 80, '#f6f3ea', 'PRICE ÷ PAY')}${G.txt(0, 60, 120, C.red, '= ???')}`)}`);
at(W('intro', 'heres'), (t, u) => {
  const pts = [[250, 520], [780, 640], [300, 800], [780, 940], [280, 1100]], labels = ['THEN', 'NOW', 'RENT', 'THE TWIST', 'THE FIX'], kinds = ['door', 'cart', 'bell', 'bulb', 'people'];
  let path = `M 540 420`; pts.forEach(([x, y]) => (path += ` L ${x} ${y}`));
  return `${night('#ffd84a')}<path d="${path}" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round" opacity="0.5"/>
  ${pts.map(([x, y], i) => u >= i * 0.25 ? `${G.icon(kinds[i], x, y, ease.back((u - i * 0.25) / 0.3), t)}<text x="${x + (x < 540 ? 90 : -90)}" y="${y + 14}" font-family="MontB" font-weight="900" font-size="42" fill="#fff" text-anchor="${x < 540 ? 'start' : 'end'}" opacity="${clamp((u - i * 0.25) * 4)}">${labels[i]}</text>` : '').join('')}`; });
// ---------- the scroll
at(W('relate', 'you'), (t, u) => { const tt = W('relate', 'then') - W('relate', 'you');
  return `${I.bg('#2b2260', '#463a8c', '#7fe8ff', 820)}${I.heldPhone({ ...PHONE, rot: -2 + Math.sin(t * 1.5), id: 'list', screen: H.screenListing(t, u > tt ? 1 : 0.2) })}`; });
at(W('relate', 'then'), (t, u) => `${I.bg('#3a1430', '#7a2a4a', C.red, 820)}${I.heldPhone({ ...PHONE, x: PHONE.x + I.wobble(t, 30, 8 * Math.exp(-u * 4)), rot: 2, id: 'list2', screen: H.screenListing(t, 1) })}`);
at(W('relate', 'yeah'), (t, u) => `${I.bg('#2b2260', '#463a8c')}${I.person(540, 1420, 1.7, { shirt: C.teal, face: 'neutral', t })}${I.phone({ x: 820, y: 1000, s: 0.4, rot: 10, id: 'off', screen: '<rect x="-176" y="-376" width="352" height="752" fill="#05060a"/>' })}${G.outlined(540, 560, 100, '#fff', 'YEAH…', 10)}`);
// ---------- the 1990s
at(SAY.past - 0.15, (t, u) => `${I.bg('#ffd27a', '#ffb347')}<rect y="1150" width="1080" height="770" fill="#8bc77b"/>${I.house(540, 1150, 1.3, '#9ad1ff', '#2f5fbf')}${I.stamp('1990s', u, 560)}`);
at(W('past', 'back'), (t, u) => `${I.bg('#ffd27a', '#ffe9b0', '#ffffff', 900)}${H.ratioBars(380, 1200, 1, 3.2, u / 2.4, 'THE 1990s')}`);
at(W('past', 'save'), (t, u) => { const tm = W('past', 'done') - W('past', 'save');
  return `${I.bg('#ffd27a', '#ffe9b0')}${K.piggy(540, 860, 1, clamp(u / 1.4), t)}${u > tm - 0.3 ? `<g transform="translate(540 1260) scale(${ease.back((u - tm + 0.3) / 0.3)})">${H.key(0, 0, 1.2, -10)}</g>${G.outlined(540, 520, 90, C.green, 'DONE ✓', 9)}` : ''}`; });
// ---------- today
at(SAY.now, (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ff5e5b', 1000)}${H.ratioBars(380, 1330, 0.92, 5, u / 1.6, 'TODAY')}`);
at(W('now', 'and'), (t, u) => `${night(C.red)}${['LONDON', 'SYDNEY', 'TORONTO'].map((c, i) => { const k = ease.back((u - i * 0.3) / 0.3); return `<g transform="translate(540 ${640 + i * 240}) scale(${k})"><rect x="-380" y="-90" width="760" height="180" rx="30" fill="#fff" filter="url(#drop)"/>${G.txt(-80, 26, 76, C.ink, c)}<g transform="translate(260 0)"><path d="M 0 -50 L 40 0 L 15 0 L 15 50 L -15 50 L -15 0 L -40 0 Z" fill="${C.red}"/></g></g>`; }).join('')}`);
// ---------- rent
at(SAY.rent, (t, u) => `${street(t)}${I.house(540, 1140, 1.4, '#c9cfdc', '#5b6378')}<g transform="translate(540 620) rotate(${4 * Math.sin(t * 3)})"><rect x="-200" y="-60" width="400" height="120" rx="12" fill="#fff" filter="url(#soft)"/>${G.txt(0, 22, 64, C.blue, 'FOR RENT')}</g>`);
at(W('rent', 'rent', 1), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ff5e5b', 820)}${H.rentPie(540, 860, 1.05, ease.out(u / 1.2) / 3)}${G.outlined(540, 1270, 70, '#fff', '1/3 OR MORE', 8)}`);
at(W('rent', 'which'), (t, u) => `${I.bg('#2a1f5c', '#4b3a8c', '#ffd84a', 820)}${K.piggy(540, 900, 1, 0.15 + 0.05 * Math.sin(t * 2), t)}${G.outlined(540, 520, 80, '#fff', 'DEPOSIT FUND', 8)}${G.outlined(540, 1270, 70, C.red, 'SO SLOW…', 8)}`);
// ---------- back with the parents
at(SAY.parents, (t, u) => `${H.childRoom(t)}${I.person(700, 1320, 1.1, { shirt: C.teal, pose: 'stand', t })}${G.outlined(700, 760, 70, '#7a2a4a', 'AGE 31', 8)}`);
at(W('parents', 'not'), (t, u) => `${H.childRoom(t)}${I.person(340, 1320, 1, { shirt: '#c77dff', pose: 'talk', t, hair: '#9aa3b8' })}${I.person(760, 1320, 1.05, { shirt: C.teal, pose: 'stand', face: 'panic', t, flip: -1 })}${I.bubbleSay(340, 640, 0.9, u - 0.3, 'Dinner!')}`);
// ---------- the twist
at(SAY.twist - 0.1, (t, u) => `${I.bg('#120a2e', '#3a1a6b', '#c77dff', 820)}${G.stars(t, 40, 12)}
  <g transform="translate(540 820) rotate(${u * 40})" opacity="0.5">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M 0 0 L ${Math.cos(i) * 600} ${Math.sin(i) * 600}" stroke="#c77dff" stroke-width="40" opacity="0.3"/>`).join('')}</g>${I.stamp('THE TWIST', u, 860)}`);
at(W('twist', 'some'), (t, u) => `${night(C.green)}${I.check(540, 820, 1.5, u)}${G.outlined(540, 1130, 84, '#fff', 'SOME CITIES FIXED IT', 9)}`);
at(W('twist', 'in'), (t, u) => `${I.bg('#7cc7ff', '#d6efff')}<rect y="1240" width="1080" height="680" fill="#8bc77b"/>${H.viennaBlock(540, 1240, 1.0, t)}${G.outlined(540, 470, 80, '#fff', 'VIENNA', 9)}
  ${u > 1 ? G.outlined(540, 1380, 60, C.yellow, '~HALF IN SOCIAL HOMES', 7) : ''}`);
at(W('twist', 'and'), (t, u) => `${I.bg('#ffd1dc', '#ffe9f0')}<rect y="1250" width="1080" height="670" fill="#9aa3b8"/>${H.crane(160, 1250, 0.9, t)}${H.tokyo(t, ease.out(u / 1.6))}${G.outlined(540, 470, 80, '#fff', 'TOKYO', 9)}`);
// ---------- could it happen?
at(SAY.real, (t, u) => `${street(t)}${I.house(540, 1140, 1.3)}<text x="540" y="${600 + 10 * Math.sin(t * 4)}" font-family="MontB" font-weight="900" font-size="300" fill="${C.yellow}" text-anchor="middle" stroke="#000" stroke-width="12" paint-order="stroke" transform="rotate(${6 * Math.sin(t * 3)} 540 500)">?</text>`);
at(W('real', 'for'), (t, u) => `${night(C.red)}${A.crowdGrid(540, 900, 0.85, Math.floor(ease.out(u / 1.2) * 120))}${G.outlined(540, 470, 84, C.yellow, 'MILLIONS ALREADY', 9)}`);
at(W('real', 'home'), (t, u) => `${night(C.red)}${H.lines(540, 860, 1.05, u / 1.6)}`);
// ---------- the fix
at(W('end', 'the'), (t, u) => `${I.bg('#14532d', '#22a35a', '#ffd84a', 820)}${G.outlined(540, 760, 120, '#fff', 'GOOD NEWS', 11)}${G.outlined(540, 900, 64, C.yellow, 'NOT A LAW OF NATURE', 7)}`);
at(W('end', 'build'), (t, u) => `${street(t)}${H.crane(180, 1140, 0.8, t)}${[0, 1, 2, 3].map((i) => { const k = ease.back((u - 0.2 - i * 0.25) / 0.4); return `<g transform="translate(${360 + i * 180} 1140) scale(${0.62 * k})">${I.house(0, 0, 1, ['#ffb27a', '#9ad1ff', '#c9e07a', '#ffd1dc'][i], ['#c0392b', '#2f5fbf', '#4caf50', '#c2577a'][i])}</g>`; }).join('')}
  ${u > 1.4 ? `<g transform="translate(540 560) scale(${ease.back((u - 1.4) / 0.3)})">${H.key(0, 0, 1, -10)}</g>` : ''}`);
// ---------- the question
const ASK = ['WILL YOU EVER', 'OWN A HOME?'], OPTS = ['Yes', 'No', 'Already do', 'Hope so'];
at(SAY.cta, (t, u) => `${night('#ffd84a')}${A.commentBox(540, 860, 1, t, u, ASK, OPTS)}`);
at(W('cta', 'tell'), (t, u) => `${night('#ffd84a')}${A.commentBox(540, 800, 0.9, t, 2, ASK, OPTS)}
  <g transform="translate(540 1220) scale(${1 + 0.08 * Math.sin(t * 10)})"><rect x="-120" y="-80" width="240" height="160" rx="40" fill="#fff"/><path d="M -40 70 L -70 130 L 10 70 Z" fill="#fff"/>
  ${[-50, 0, 50].map((x, i) => `<circle cx="${x}" cy="0" r="16" fill="${C.ink}" opacity="${0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i))}"/>`).join('')}</g>`);

// ------------------------------------------------------------------ years of pay on the bar
const STAMPS = [SAY.past - 0.15, SAY.twist - 0.1];
const years = X.keyed([[SAY.past, 3.2], [SAY.now - 0.2, 3.2], [SAY.now + 1.6, 5], [SAY.twist - 0.3, 5]]);
function goal(t) {
  const a = X.smooth(SAY.past - 0.4, SAY.past, t) * (1 - X.smooth(SAY.twist - 0.4, SAY.twist - 0.1, t));
  if (a <= 0) return null;
  const y = years(t), ticks = [4].map((n) => ({ k: (n - 2) / 4, on: y >= n, pop: Math.exp(-Math.pow((y - n) * 3, 2)) }));
  return { label: 'YEARS OF PAY FOR A HOME', pct: `${y.toFixed(1)} YEARS`, k: (y - 2) / 4, from: '2', to: '6', alpha: a, ticks };
}

// ------------------------------------------------------------------ sound
function buildAudio() {
  const { A: L, fx, S_, music } = X.audioBase(VO, ORDER, SAY, DURATION, cuts(), STAMPS);
  music('music/322.mp3', 0, SAY.twist + 0.6, { offset: 2, level: 0.45 });
  music('music/606.mp3', SAY.twist - 0.3, DURATION - SAY.twist + 0.3, { offset: 14, level: 0.55, fin: 0.8 });
  // hook
  L.push(S_('sfx/367.wav', 0, { offset: 2, dur: W('hook', 'no'), level: 0.18, fin: 0.1, fout: 0.3, fx: true }));
  fx('beep', { t: W('hook', 'never') + 0.4, f: 300, n: 2, drop: 0.85, level: 0.2 });
  for (let i = 0; i < 6; i++) fx('knock', { t: W('hook', 'no') + 0.1 + i * 0.25, n: 1, level: 0.06 });
  // intro
  fx('beep', { t: W('intro', 'not') + 0.52, f: 330, n: 2, drop: 0.8, level: 0.22 });
  fx('sample', { file: 'sfx/2385.wav', t: W('intro', 'because', 1) + 0.1, level: 0.18 });
  for (let i = 0; i < 5; i++) fx('pop', { t: W('intro', 'heres') + i * 0.25, f: 700 + i * 90, level: 0.2 });
  // scroll
  for (let i = 0; i < 4; i++) fx('sample', { file: 'sfx/1124.wav', t: W('relate', 'you') + 0.2 + i * 0.25, level: 0.08 });
  fx('sample', { file: 'sfx/2918.wav', t: W('relate', 'then') + 0.05, level: 0.22 });
  fx('pop', { t: W('relate', 'yeah') - 0.2, f: 400, level: 0.15 });
  // the 1990s
  for (let i = 0; i < 3; i++) fx('pop', { t: W('past', 'back') + 0.4 + i * 0.7, f: 600 + i * 100, level: 0.16 });
  fx('kaching', { t: W('past', 'done') + 0.05, level: 0.25 });
  // today
  for (let i = 0; i < 5; i++) fx('pop', { t: SAY.now + 0.2 + i * 0.3, f: 500 + i * 60, level: 0.15 });
  for (let i = 0; i < 3; i++) fx('beep', { t: W('now', 'and') + 0.15 + i * 0.3, f: 400, n: 1, dur: 0.1, level: 0.12 });
  // rent
  fx('count', { t0: W('rent', 'rent', 1), t1: W('rent', 'rent', 1) + 1.2, from: 30, to: 20, level: 0.06, seed: 4 });
  fx('creak', { t0: W('rent', 'which') + 0.2, t1: W('rent', 'which') + 1.0, level: 0.1 });
  // parents
  fx('ding', { t: W('parents', 'not') + 0.3, f: 1046.5, level: 0.1 });
  // the twist
  fx('sample', { file: 'sfx/2915.wav', t: SAY.twist - 0.1, level: 0.35, dur: 1.6, fout: 0.4 });
  fx('ding', { t: W('twist', 'some') + 0.1, f: 880, level: 0.12 });
  fx('chime', { t: W('twist', 'in') + 0.2, level: 0.08, freq: 659.25 });
  for (let i = 0; i < 9; i++) fx('knock', { t: W('twist', 'and') + 0.2 + i * 0.15, n: 1, level: 0.08 });
  // could it happen
  fx('creak', { t0: SAY.real + 0.1, t1: SAY.real + 0.7, level: 0.12 });
  fx('count', { t0: W('real', 'for'), t1: W('real', 'for') + 1.2, from: 24, to: 46, level: 0.06, seed: 5 });
  // the fix
  fx('sparkle', { t: W('end', 'the') + 0.2, dur: 0.9, count: 8, f: [1600, 4200], level: 0.1, seed: 6 });
  for (let i = 0; i < 4; i++) fx('knock', { t: W('end', 'build') + 0.3 + i * 0.25, n: 1, level: 0.15 });
  fx('chime', { t: W('end', 'build') + 1.45, level: 0.1, freq: 784 });
  // the question
  for (let i = 0; i < 4; i++) fx('pop', { t: SAY.cta + 0.2 + i * 0.15, f: 600 + i * 120, level: 0.18 });
  fx('ding', { t: W('cta', 'comments') + 0.3, level: 0.15 });
  return L;
}

export default X.scenario({ id: 'housing', title: 'What if you could never afford a home?', DURATION, FADE, CSS: X.css('#2f7bff', '#7fe8ff'),
  caps: X.captions(VO, ORDER, SAY, NUMS, KEYWORDS), audio: buildAudio(), goal, svgFrame: frame });
export const _debug = { SAY, DURATION, S, wordT: W };
export { svgAt };
