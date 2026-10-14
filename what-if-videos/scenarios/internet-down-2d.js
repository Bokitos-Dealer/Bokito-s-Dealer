// What if the internet went down for a week? — illustrated (2D) version.
// Same narration, captions, day bar and sound as internet-down.js; the picture is a flat vector illustration for every
// sentence, timed to the words (scenarios/ill2d.js), instead of the 3D city.
import base, { _debug } from './internet-down.js';
import VO from './internet-down.vo.js';
import * as I from './ill2d.js';

const { SAY } = _debug;
const { C, ease, clamp, lerp, wobble } = I;
const wordT = (key, word, nth = 0) => { let n = 0; for (const [w, s] of VO[key].words) if (w.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(word.replace(/'/g, '')) && n++ === nth) return SAY[key] + s; throw new Error(`no "${word}" in ${key}`); };

// ------------------------------------------------------------------ one illustration per sentence: [start, draw(t, u)]
const S = [];
const at = (t0, draw) => S.push([t0, draw]);
const room = () => `${I.bg('#1d1b45', '#3b2d5c')}
  <rect x="120" y="360" width="420" height="560" rx="18" fill="url(#dawnSky)"/><circle cx="330" cy="820" r="90" fill="#ffd27a" opacity="0.9"/>
  ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="120" y="${380 + i * 76}" width="420" height="10" fill="#1d1b45" opacity="0.35"/>`).join('')}
  <rect x="104" y="344" width="452" height="592" rx="24" fill="none" stroke="#2b2858" stroke-width="22"/>
  <rect x="0" y="1060" width="1080" height="860" fill="#2a2148"/>
  <rect x="560" y="1000" width="440" height="40" rx="12" fill="url(#woodTop)"/><rect x="590" y="1040" width="380" height="300" fill="${C.woodD}"/>`;
const cafe = () => `${I.bg('#2b1c18', '#4a2d22', '#ff9a52', 700)}
  <g opacity="0.9"><rect x="140" y="300" width="800" height="230" rx="24" fill="#1d1411"/>
  <text x="540" y="380" font-family="MontB" font-weight="900" font-size="54" fill="#f4efe8" text-anchor="middle">MENU</text>
  <text x="250" y="460" font-family="InterW" font-weight="700" font-size="34" fill="#d8cbb8">COFFEE</text><text x="830" y="460" font-family="InterW" font-weight="700" font-size="34" fill="#d8cbb8" text-anchor="end">$4.90</text></g>
  <rect x="0" y="1030" width="1080" height="900" fill="#3a2419"/><rect x="0" y="1000" width="1080" height="56" fill="url(#woodTop)"/>`;

// day one: the bedroom, the alarm, DAY 1
at(SAY.day1 - 0.9, (t, u) => `${room()}${I.alarmClock(800, 930, 1, t)}
  ${I.phone({ x: 700, y: 990, s: 0.36, rot: -90, id: 'nite', screen: I.screenLock(t) })}
  ${I.stamp('DAY 1', u, 560)}`);
// "You wake up, grab your phone…": the hand brings it up out of bed
at(wordT('day1', 'you') - 0.05, (t, u) => {
  const k = ease.out(u / 0.75);
  return `${room()}${I.alarmClock(800, 930, 1, t)}
  ${I.heldPhone({ x: lerp(820, 540, k), y: lerp(1700, 815, k), s: lerp(0.8, 1.0, k), rot: lerp(28, -3, k), id: 'wake', screen: I.screenLock(t), light: 0.25 * (1 - clamp(u * 3)) })}`;
});
// "…nothing."
at(wordT('day1', 'nothing'), (t, u) => {
  const sh = 14 * Math.exp(-u * 7);
  return `${I.bg('#0e1530', '#1d2a55', '#ff5e5b', 760)}${I.heldPhone({ x: 540 + I.wobble(t, 40, sh), y: 815, s: 1.05, rot: -2, id: 'none', screen: I.screenNoInternet(t) })}`;
});
// "No messages."
at(wordT('day1', 'messages'), (t, u) => `${I.bg('#0e1530', '#1d2a55', '#2f7bff', 760)}${I.heldPhone({ x: 540, y: 815, s: 1.05, rot: 2, id: 'msg', screen: I.screenMessages(t, u) })}`);
// "No maps."
at(wordT('day1', 'maps'), (t, u) => `${I.bg('#0e1530', '#1d2a55', '#2fd3c4', 760)}${I.heldPhone({ x: 540, y: 815, s: 1.05, rot: -2, id: 'map', screen: I.screenMaps(t, u) })}`);
// "Your bank app? Just spinning."
at(wordT('day1', 'your', 1), (t, u) => `${I.bg('#0e1530', '#1d2a55', '#34c759', 760)}${I.heldPhone({ x: 540, y: 815, s: 1.05, rot: 2, id: 'bank', screen: I.screenBank(t, u) })}`);
// "You go to pay for coffee."
at(SAY.cash, (t, u) => {
  const k = ease.out((u - 0.3) / 0.6);
  return `${cafe()}${I.cup(300, 900, 1.1, t)}${I.terminal(700, 760, 1, { t })}${I.handCard(lerp(1300, 900, k), 820, 1, -6)}`;
});
// "Declined."
at(wordT('cash', 'declined'), (t, u) => {
  const sh = 18 * Math.exp(-u * 6);
  return `${cafe()}<rect width="1080" height="1920" fill="${C.red}" opacity="${0.35 * Math.exp(-u * 5)}"/>${I.terminal(540 + I.wobble(t, 40, sh), 760, 1.45, { state: 'declined', t })}`;
});
// "Cash only."
at(wordT('cash', 'cash'), (t, u) => {
  const drop = ease.back(u / 0.4), sw = 12 * Math.exp(-u * 2.5) * Math.cos(u * 9);
  return `${cafe()}${I.cup(300, 900, 1.1, t)}${I.sign(540, lerp(-200, 760, drop), 1, sw)}`;
});
// "And be honest, when did you last carry cash?"
at(wordT('cash', 'when'), (t, u) => `${I.bg('#0e1530', '#1d2a55', '#ffd84a', 760)}${I.wallet(540, 860, 1.05 + 0.04 * ease.out(u / 2), t, clamp((u - 0.6) / 2))}`);
// (the rest of the episode follows the same pattern)
at(SAY.day2, (t, u) => `${I.bg('#0e1530', '#1d2a55')}`);
S.sort((a, b) => a[0] - b[0]);

function frameSVG(t) {
  let i = -1; for (let j = 0; j < S.length; j++) if (t >= S[j][0]) i = j;
  if (i < 0) return `${I.bg('#0e1530', '#1d2a55')}`;
  const [t0, draw] = S[i], u = t - t0;
  // every new picture lands with a small push-in
  const z = 1 + 0.05 * (1 - ease.out(u / 0.3));
  return `<g transform="translate(540 960) scale(${z}) translate(-540 -960)">${draw(t, u)}</g>${I.vignette()}`;
}

export default {
  ...base,
  id: 'internet-down-2d',
  hud: () => null,
  labels: () => [],
  css: base.css + ' #hud { display: none !important; } #caption { top: 1390px !important; } #ill { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }',
  async setup(ctx) {
    ctx.grain = 0.03; ctx.vignette = 0; ctx.handheld = 0;
    ctx.grade = { brightness: 1.0, contrast: 1.0, saturate: 1.0, sepia: 0 };
    if (this.css && typeof document !== 'undefined') { const s = document.createElement('style'); s.textContent = this.css; document.head.appendChild(s); }
    const ui = document.getElementById('ui');
    this.el = document.createElement('div'); this.el.id = 'ill';
    ui.insertBefore(this.el, ui.firstChild);
  },
  update(ctx, t) {
    this.el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">${I.DEFS}${frameSVG(t)}</svg>`;
  },
};
