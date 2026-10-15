// More of the flat illustration kit, for "What if World War 3 started tomorrow?" (scenarios/ww3.js).
// Grounded and non-graphic on purpose: news, prices, screens, people, tables. No weapons going off, no damage to people.
import * as I from './ill2d.js';
import { txt, outlined } from './ill2d-grid.js';

const { C, ease, clamp, lerp, hash } = I;
const T = (x, y, s = 1, rot = 0) => `translate(${x} ${y}) rotate(${rot}) scale(${s})`;

// ---------------------------------------------------------------- news
// a TV set; `screen` is drawn in a 520 x 300 box centred on the screen
export function tv(x, y, s = 1, screen = '', id = 'tv') {
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-300" y="-190" width="600" height="360" rx="24" fill="#1a1d27"/></g>
    <clipPath id="${id}"><rect x="-270" y="-160" width="540" height="300" rx="10"/></clipPath><g clip-path="url(#${id})"><rect x="-270" y="-160" width="540" height="300" fill="#0b0d14"/>${screen}</g>
    <rect x="-40" y="170" width="80" height="40" fill="#2a2e3b"/><rect x="-140" y="206" width="280" height="20" rx="10" fill="#2a2e3b"/></g>`;
}
export function newsScreen(t, { head = 'BREAKING NEWS', sub = 'WORLD ON ALERT' } = {}) {
  const tick = (t * 160) % 900;
  return `<rect x="-270" y="-160" width="540" height="300" fill="#1f3c88"/>${I.globe(-130, -20, 110, t, { spin: t * 0.1 })}
    <rect x="-270" y="40" width="540" height="64" fill="${C.red}"/>${txt(-10, 86, 40, '#fff', head)}
    <rect x="-270" y="104" width="540" height="36" fill="#fff"/><text x="${270 - tick}" y="130" font-family="InterW" font-weight="800" font-size="22" fill="${C.ink}">${sub} · MARKETS FALL · FUEL PRICES UP · STAY TUNED ·</text>
    <rect x="150" y="-140" width="100" height="40" rx="6" fill="${C.red}"/>${txt(200, -110, 26, '#fff', 'LIVE')}`;
}
export function screenAlert(t, u) {
  const k = ease.back(u / 0.3), flash = Math.floor(t * 4) % 2;
  return `<rect x="-176" y="-376" width="352" height="752" fill="url(#lockWall)"/><rect x="-176" y="-376" width="352" height="752" fill="#000" opacity="0.4"/>${I.statusBar({})}
    <text x="0" y="-180" font-family="InterW" font-weight="800" font-size="96" fill="#fff" text-anchor="middle" letter-spacing="-3">7:02</text>
    <g transform="translate(0 0) scale(${k})"><rect x="-160" y="-90" width="320" height="200" rx="26" fill="#f2f3f7"/>
    <rect x="-160" y="-90" width="320" height="56" rx="26" fill="${flash ? C.red : '#c0392b'}"/><rect x="-160" y="-60" width="320" height="26" fill="${flash ? C.red : '#c0392b'}"/>
    <text y="-52" font-family="InterW" font-weight="800" font-size="22" fill="#fff" text-anchor="middle">⚠ EMERGENCY ALERT</text>
    <text y="0" font-family="InterW" font-weight="700" font-size="19" fill="${C.ink}" text-anchor="middle">Stay tuned to official</text>
    <text y="28" font-family="InterW" font-weight="700" font-size="19" fill="${C.ink}" text-anchor="middle">news for updates.</text>
    <text y="80" font-family="InterW" font-weight="800" font-size="19" fill="${C.blue}" text-anchor="middle">OK</text></g>`;
}
export function screenNews(t) {
  return `<rect x="-176" y="-376" width="352" height="752" fill="#f5f6fa"/>${I.statusBar({ dark: false })}
    <rect x="-176" y="-300" width="352" height="70" fill="${C.red}"/><text x="0" y="-254" font-family="MontB" font-weight="900" font-size="30" fill="#fff" text-anchor="middle">BREAKING NEWS</text>
    <rect x="-150" y="-200" width="300" height="170" rx="14" fill="#1f3c88"/><g transform="translate(0 -115)">${I.globe(0, 0, 70, t, { spin: t * 0.1 })}</g>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="-150" y="${10 + i * 40}" width="${300 - (i % 2) * 70}" height="18" rx="9" fill="#cfd5e2"/>`).join('')}`;
}
export function movieScreen(x, y, s = 1, t = 0) {
  const p = 1 + 0.06 * Math.sin(t * 8);
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-380" y="-260" width="760" height="460" rx="16" fill="#111"/></g><rect x="-350" y="-230" width="700" height="400" fill="#ffb347"/>
    <g transform="translate(0 -30) scale(${p})"><path d="M 0 -170 L 40 -70 L 150 -110 L 90 -10 L 190 50 L 70 60 L 80 170 L 0 90 L -80 170 L -70 60 L -190 50 L -90 -10 L -150 -110 L -40 -70 Z" fill="${C.yellow}" stroke="#fff" stroke-width="10"/>
    ${txt(0, 20, 80, C.red, 'BOOM!')}</g>${[-1, 1].map((d) => `<path d="M ${d * 380} -260 L ${d * 470} -300 L ${d * 470} 240 L ${d * 380} 200 Z" fill="#8a1c1c"/>`).join('')}
    ${[...Array(9)].map((_, i) => `<circle cx="${-320 + i * 80}" cy="300" r="34" fill="#1a1d27"/>`).join('')}</g>`;
}

// ---------------------------------------------------------------- money
export function stockChart(x, y, s = 1, u = 0, t = 0) {
  const pts = [];
  for (let i = 0; i <= 40; i++) { const k = i / 40, base = k < 0.55 ? 0.62 + 0.1 * k + 0.05 * Math.sin(k * 40) : 0.67 - 1.1 * (k - 0.55) + 0.03 * Math.sin(k * 50); pts.push([-360 + k * 720, 220 - base * 400]); }
  const n = Math.max(2, Math.floor(clamp(u) * pts.length)), shown = pts.slice(0, n), last = shown[shown.length - 1], down = clamp(u) > 0.55;
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-420" y="-300" width="840" height="600" rx="30" fill="#0b0d14"/></g>
    ${[0, 1, 2, 3].map((i) => `<line x1="-380" y1="${-200 + i * 120}" x2="380" y2="${-200 + i * 120}" stroke="#2a2e3b" stroke-width="3"/>`).join('')}
    <path d="M ${shown.map((p) => p.join(' ')).join(' L ')}" fill="none" stroke="${down ? C.red : C.green}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="16" fill="${down ? C.red : C.green}" filter="url(#glow)"/>
    ${txt(-250, -235, 40, '#fff', 'MARKETS')}${down ? txt(240, -235, 44, C.red, `▼ ${Math.round((clamp(u) - 0.55) / 0.45 * 12)}%`) : ''}</g>`;
}
export function tickerBoard(x, y, s = 1, t = 0, u = 0) {
  const names = ['TECH', 'BANKS', 'AIRLINES', 'RETAIL', 'AUTOS', 'ENERGY'];
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-430" y="-330" width="860" height="660" rx="24" fill="#0b0d14"/></g>
    ${names.map((nm, i) => { const v = i === 5 ? 3 + u * 6 : -(2 + hash(i, 3) * 4 + u * 6); const up = v > 0, k = clamp((u - i * 0.12) * 4);
      return `<g transform="translate(0 ${-250 + i * 100})" opacity="${0.3 + 0.7 * k}"><rect x="-400" y="-38" width="800" height="76" rx="10" fill="#151a24"/>
      <text x="-370" y="14" font-family="InterW" font-weight="800" font-size="38" fill="#fff">${nm}</text>
      <text x="370" y="14" font-family="InterW" font-weight="800" font-size="38" fill="${up ? C.green : C.red}" text-anchor="end">${up ? '▲' : '▼'} ${Math.abs(v).toFixed(1)}%</text></g>`; }).join('')}</g>`;
}
export function piggy(x, y, s = 1, fill = 1, t = 0) {
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><ellipse cx="0" cy="0" rx="260" ry="200" fill="#ff9fb8"/></g><circle cx="230" cy="-20" r="80" fill="#ffb3c6"/>
    <ellipse cx="290" cy="-10" rx="36" ry="30" fill="#ff8fab"/><circle cx="280" cy="-14" r="7" fill="#c2577a"/><circle cx="300" cy="-14" r="7" fill="#c2577a"/><circle cx="200" cy="-60" r="12" fill="${C.ink}"/>
    <path d="M 150 -170 L 190 -240 L 220 -150 Z" fill="#ff8fab"/><rect x="-60" y="-200" width="120" height="16" rx="8" fill="#c2577a"/>
    ${[-160, -60, 60, 150].map((lx) => `<rect x="${lx - 30}" y="150" width="60" height="90" rx="20" fill="#ff8fab"/>`).join('')}
    <path d="M -260 -20 q -70 -30 -50 -80" stroke="#ff8fab" stroke-width="14" fill="none" stroke-linecap="round"/>
    <rect x="-140" y="-60" width="200" height="40" rx="20" fill="#fff" opacity="0.7"/><rect x="-140" y="-60" width="${200 * clamp(fill)}" height="40" rx="20" fill="${fill > 0.5 ? C.green : C.red}"/>
    ${txt(-40, 40, 48, '#c2577a', 'SAVINGS')}</g>`;
}
export function priceSign(x, y, s = 1, v = 0, t = 0) {
  const usd = lerp(3.49, 4.99, v), eur = lerp(1.69, 2.19, v), flick = v > 0 && v < 1 ? hash(Math.floor(t * 20), 3) > 0.5 : 0;
  return `<g transform="${T(x, y, s)}"><rect x="-20" y="0" width="40" height="420" fill="#5b6378"/><g filter="url(#drop)"><rect x="-300" y="-420" width="600" height="440" rx="26" fill="#c0392b"/></g>
    ${txt(0, -350, 48, '#fff', 'FUEL PRICES')}
    <rect x="-260" y="-310" width="520" height="140" rx="14" fill="#0b0d14"/><text x="-230" y="-212" font-family="monospace" font-weight="700" font-size="88" fill="${flick ? '#fff' : C.yellow}">$${usd.toFixed(2)}</text>
    <text x="230" y="-212" font-family="InterW" font-weight="800" font-size="32" fill="#fff" text-anchor="end">/gal</text>
    <rect x="-260" y="-150" width="520" height="140" rx="14" fill="#0b0d14"/><text x="-230" y="-52" font-family="monospace" font-weight="700" font-size="88" fill="${flick ? '#fff' : C.yellow}">€${eur.toFixed(2)}</text>
    <text x="230" y="-52" font-family="InterW" font-weight="800" font-size="32" fill="#fff" text-anchor="end">/litre</text>
    ${v > 0.2 ? `<g transform="translate(330 -240) scale(${ease.back((v - 0.2) / 0.3)})"><circle r="70" fill="${C.red}" stroke="#fff" stroke-width="8"/><path d="M 0 -40 L 34 6 L 12 6 L 12 40 L -12 40 L -12 6 L -34 6 Z" fill="#fff"/></g>` : ''}</g>`;
}
export function barrel(x, y, s = 1, rot = 0) {
  return `<g transform="${T(x, y, s, rot)}"><g filter="url(#drop)"><rect x="-150" y="-210" width="300" height="420" rx="40" fill="#1f2a44"/></g>
    ${[-130, 0, 130].map((yy) => `<rect x="-158" y="${yy - 12}" width="316" height="24" rx="10" fill="#2f3d60"/>`).join('')}<ellipse cy="-200" rx="140" ry="30" fill="#2f3d60"/>
    <path d="M 0 -80 C 50 -10 50 40 0 60 C -50 40 -50 -10 0 -80 Z" fill="#0b0d14" stroke="${C.yellow}" stroke-width="6"/>${txt(0, 130, 46, C.yellow, 'OIL')}</g>`;
}
export function groceryBag(x, y, s = 1, t = 0, v = 0) {
  const tags = [['BREAD', 2.5, 3.2], ['MILK', 1.2, 1.6], ['EGGS', 3.0, 4.1]];
  return `<g transform="${T(x, y, s)}"><rect x="-80" y="-300" width="40" height="140" rx="16" fill="#e8c27a"/><circle cx="40" cy="-260" r="60" fill="${C.red}"/><rect x="40" y="-330" width="70" height="120" rx="14" fill="#fff"/>
    <g filter="url(#drop)"><path d="M -200 -200 L 200 -200 L 170 200 L -170 200 Z" fill="#c98f4a"/></g><path d="M -110 -200 Q -110 -280 -40 -280" stroke="#a06a34" stroke-width="12" fill="none"/>
    ${tags.map(([n, a, b], i) => { const p = lerp(a, b, clamp((v - i * 0.15) / 0.5)); return `<g transform="translate(${-60 + i * 150} ${-60 + i * 90}) rotate(${-8 + i * 8})"><rect x="-100" y="-50" width="200" height="100" rx="14" fill="#fff8d6" filter="url(#soft)"/>
      <text y="-12" font-family="InterW" font-weight="800" font-size="24" fill="${C.ink}" text-anchor="middle">${n}</text><text y="32" font-family="MontB" font-weight="900" font-size="36" fill="${p > a + 0.05 ? C.red : C.ink}" text-anchor="middle">$${p.toFixed(2)}</text></g>`; }).join('')}</g>`;
}

// ---------------------------------------------------------------- cyber
export function hacker(x, y, s = 1, t = 0) {
  let code = '';
  for (let i = 0; i < 9; i++) code += `<text x="-220" y="${-250 + i * 32}" font-family="monospace" font-weight="700" font-size="22" fill="#5dff8a" opacity="${0.5 + 0.5 * hash(i, Math.floor(t * 6))}">${[...Array(18)].map((_, j) => (hash(i * 18 + j, Math.floor(t * 8)) > 0.5 ? '1' : '0')).join('')}</text>`;
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-260" y="-300" width="520" height="320" rx="20" fill="#2a2e38"/></g><rect x="-240" y="-280" width="480" height="280" rx="8" fill="#03140a"/>${code}
    <path d="M -300 20 L 300 20 L 270 56 L -270 56 Z" fill="#3a3f4b"/>
    <g transform="translate(0 300)"><path d="M -230 120 C -230 -60 230 -60 230 120 Z" fill="#1a1d27"/><path d="M -120 -40 C -150 -260 150 -260 120 -40 Q 0 20 -120 -40 Z" fill="#1a1d27"/>
    <ellipse cx="0" cy="-110" rx="70" ry="80" fill="#05060a"/></g></g>`;
}
export function lockShield(x, y, s = 1, broken = 0) {
  return `<g transform="${T(x, y, s)}"><path d="M 0 -180 L 150 -120 L 150 20 C 150 110 80 170 0 200 C -80 170 -150 110 -150 20 L -150 -120 Z" fill="${broken > 0.5 ? C.red : C.blue}" filter="url(#drop)"/>
    <rect x="-60" y="-30" width="120" height="100" rx="14" fill="#fff"/><path d="M -40 -30 L -40 -70 A 40 40 0 0 1 40 -70 L 40 ${broken > 0.5 ? -50 : -30}" stroke="#fff" stroke-width="18" fill="none" transform="${broken > 0.5 ? 'rotate(-25 40 -30)' : ''}"/>
    ${broken > 0.5 ? `<path d="M -20 -150 L 10 -60 L -20 0 L 20 90" stroke="#fff" stroke-width="8" fill="none"/>` : ''}</g>`;
}
export function browser(x, y, s = 1, t = 0, dark = 0) {
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-380" y="-280" width="760" height="560" rx="24" fill="#e9ecf3"/></g><rect x="-380" y="-280" width="760" height="70" rx="24" fill="#cfd5e2"/>
    ${[0, 1, 2].map((i) => `<circle cx="${-340 + i * 36}" cy="-245" r="11" fill="${[C.red, C.yellow, C.green][i]}"/>`).join('')}<rect x="-220" y="-264" width="460" height="38" rx="19" fill="#fff"/>
    <rect x="-360" y="-200" width="720" height="460" fill="#fff"/>${txt(0, -40, 120, '#9aa1b2', '503')}${txt(0, 40, 44, '#6b7285', 'SERVICE UNAVAILABLE')}
    <rect x="-360" y="-200" width="720" height="460" fill="#05060a" opacity="${dark}"/></g>`;
}

// ---------------------------------------------------------------- the twist and the end
export function standoff(x, y, s = 1, t = 0) {
  const side = (d, col) => `<g transform="translate(${d * 260} 0) scale(${d} 1)"><path d="M 0 -200 L 130 -150 L 130 -20 C 130 70 70 120 0 150 C -70 120 -130 70 -130 -20 L -130 -150 Z" fill="${col}" filter="url(#drop)"/>
    <path transform="translate(0 -30) scale(1.4)" d="M 0 -40 L 11 -12 L 40 -12 L 17 6 L 26 36 L 0 18 L -26 36 L -17 6 L -40 -12 L -11 -12 Z" fill="#fff" opacity="0.85"/></g>`;
  return `<g transform="${T(x, y, s)}">${side(-1, C.blue)}${side(1, C.red)}
    <rect x="-60" y="-220" width="120" height="400" rx="20" fill="#fff" opacity="${0.1 + 0.05 * Math.sin(t * 4)}"/><line x1="0" y1="-240" x2="0" y2="200" stroke="#fff" stroke-width="8" stroke-dasharray="20 16" opacity="0.7"/></g>`;
}
export function scoreboard(x, y, s = 1, u = 0) {
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-420" y="-200" width="840" height="400" rx="30" fill="#0b0d14"/></g>
    ${[-1, 1].map((d, i) => `<g transform="translate(${d * 210} 0)"><rect x="-170" y="-150" width="340" height="80" rx="12" fill="${i ? C.red : C.blue}"/>${txt(0, -95, 40, '#fff', i ? 'SIDE B' : 'SIDE A')}
      <g transform="translate(0 60) scale(${ease.back((u - 0.3 - i * 0.2) / 0.3)})">${txt(0, 30, 100, C.red, 'LOSE')}</g></g>`).join('')}${txt(0, 90, 90, '#fff', ':')}</g>`;
}
export function timeline(x, y, s = 1, u = 0) {
  const k = ease.inOut(clamp(u)), yr = Math.round(lerp(1945, 2026, k));
  return `<g transform="${T(x, y, s)}"><rect x="-420" y="-14" width="840" height="28" rx="14" fill="#2a2e3b"/><rect x="-420" y="-14" width="${840 * k}" height="28" rx="14" fill="${C.green}"/>
    <circle cx="${-420 + 840 * k}" cy="0" r="34" fill="#fff" stroke="${C.green}" stroke-width="10"/>${txt(-420, 100, 54, '#fff', '1945')}${txt(420, 100, 54, '#fff', '2026')}
    ${outlined(-420 + 840 * k, -70, 70, C.yellow, String(yr), 8)}</g>`;
}
export function warheadDots(x, y, s = 1, n = 0) {
  let g = '';
  for (let i = 0; i < Math.min(n, 240); i++) { const cx = (i % 20 - 9.5) * 40, cy = (Math.floor(i / 20) - 5.5) * 40; g += `<circle cx="${cx}" cy="${cy}" r="13" fill="${C.yellow}" opacity="${0.6 + 0.4 * hash(i, 2)}"/>`; }
  return `<g transform="${T(x, y, s)}">${g}</g>`;
}
export function roundTable(x, y, s = 1, t = 0, talk = 1) {
  const seats = [[-300, C.blue], [-100, C.coral], [100, C.teal], [300, C.yellow]];
  return `<g transform="${T(x, y, s)}">${seats.map(([sx, col], i) => I.person(sx, 40, 0.75, { shirt: '#2a3550', pose: talk && i % 2 === Math.floor(t * 0.8) % 2 ? 'talk' : 'stand', t, seed: i, flip: sx > 0 ? -1 : 1 }) + `<rect x="${sx - 14}" y="-200" width="28" height="80" fill="${col}"/>`).join('')}
    <ellipse cx="0" cy="-40" rx="460" ry="80" fill="#8a5a3c"/><ellipse cx="0" cy="-54" rx="440" ry="66" fill="url(#woodTop)"/>
    ${seats.map(([sx, col]) => `<g transform="translate(${sx} -100)"><rect x="-2" y="0" width="4" height="50" fill="#9aa3b8"/><rect x="0" y="0" width="56" height="34" fill="${col}"/></g>`).join('')}
    ${[[-200, -10], [200, 0]].map(([px, py]) => `<rect x="${px - 50}" y="${py - 66}" width="100" height="22" rx="4" fill="#fff" opacity="0.9"/>`).join('')}</g>`;
}
export function handshake(x, y, s = 1, t = 0) {
  const sh = 6 * Math.sin(t * 10);
  return `<g transform="${T(x, y + sh, s)}"><rect x="-460" y="-60" width="300" height="120" rx="40" fill="#2a3550"/><rect x="160" y="-60" width="300" height="120" rx="40" fill="#5b4bb8"/>
    <path d="M -180 -60 C -100 -90 0 -70 60 -30 L 40 40 C 0 60 -100 70 -180 60 Z" fill="${C.skin}"/>
    <path d="M 180 -50 C 100 -80 -20 -40 -60 0 C -30 50 60 70 180 60 Z" fill="${C.skinS}"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="${-40 + i * 34}" y="${30 + (i % 2) * 6}" width="30" height="44" rx="15" fill="${C.skin}"/>`).join('')}<path d="M -60 -40 C -20 -70 30 -60 50 -40" stroke="${C.skinS}" stroke-width="10" fill="none" stroke-linecap="round"/></g>`;
}
export function snail(x, y, s = 1, t = 0) {
  return `<g transform="${T(x + (t * 15) % 40, y, s)}"><path d="M -160 40 Q -150 0 -60 0 L 140 0 Q 200 0 200 40 Z" fill="#c9e07a"/><circle cx="20" cy="-60" r="110" fill="#c98f4a"/><path d="M 20 -60 m -60 0 a 60 60 0 1 1 60 60 a 36 36 0 1 1 -36 -36" stroke="#8a5a3c" stroke-width="14" fill="none"/>
    <path d="M 170 0 L 200 -90 M 190 0 L 240 -80" stroke="#c9e07a" stroke-width="12" stroke-linecap="round"/><circle cx="200" cy="-96" r="12" fill="${C.ink}"/><circle cx="242" cy="-86" r="12" fill="${C.ink}"/></g>`;
}
export function crossedSwords(x, y, s = 1) {
  const sw = (r) => `<g transform="rotate(${r})"><rect x="-12" y="-260" width="24" height="380" rx="8" fill="#c3c9d6"/><path d="M -12 -260 L 0 -300 L 12 -260 Z" fill="#c3c9d6"/><rect x="-70" y="110" width="140" height="22" rx="8" fill="${C.wood}"/><rect x="-14" y="132" width="28" height="90" rx="10" fill="${C.woodD}"/></g>`;
  return `<g transform="${T(x, y, s)}" filter="url(#drop)">${sw(-35)}${sw(35)}</g>`;
}
export function icon(kind, x, y, s = 1) {
  const g = (inner) => `<g transform="${T(x, y, s)}"><circle r="62" fill="#fff" filter="url(#soft)"/>${inner}</g>`;
  if (kind === 'chart') return g(`<path d="M -40 -30 L -10 0 L 10 -16 L 40 30" stroke="${C.red}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M 40 30 L 40 6 M 40 30 L 16 30" stroke="${C.red}" stroke-width="10" stroke-linecap="round"/>`);
  if (kind === 'fuel') return g(`<rect x="-30" y="-36" width="44" height="72" rx="8" fill="${C.red}"/><rect x="-22" y="-28" width="28" height="18" rx="4" fill="#fff"/><path d="M 14 -16 L 32 -6 L 32 24" stroke="${C.ink}" stroke-width="7" fill="none"/>`);
  if (kind === 'shield') return g(`<path d="M 0 -40 L 34 -26 L 34 4 C 34 24 18 36 0 42 C -18 36 -34 24 -34 4 L -34 -26 Z" fill="${C.blue}"/><rect x="-12" y="-6" width="24" height="20" rx="4" fill="#fff"/>`);
  if (kind === 'hands') return g(`<path d="M -44 0 C -20 -20 10 -16 24 -6 L 16 16 C 0 22 -24 20 -44 14 Z" fill="${C.skin}"/><path d="M 44 -4 C 20 -14 -4 -4 -14 6 C -6 20 16 22 44 16 Z" fill="${C.skinS}"/>`);
  if (kind === 'alert') return g(`<path d="M 0 -42 L 44 34 L -44 34 Z" fill="${C.red}"/><rect x="-5" y="-14" width="10" height="28" rx="4" fill="#fff"/><circle cy="24" r="6" fill="#fff"/>`);
  return I.icon(kind, x, y, s);
}
