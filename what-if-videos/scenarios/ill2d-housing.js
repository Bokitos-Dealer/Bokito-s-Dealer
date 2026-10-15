// More of the flat illustration kit, for "What if you could never afford a home?" (scenarios/housing.js).
import * as I from './ill2d.js';
import { txt, outlined } from './ill2d-grid.js';

const { C, ease, clamp, lerp, hash } = I;
const T = (x, y, s = 1, rot = 0) => `translate(${x} ${y}) rotate(${rot}) scale(${s})`;

export function screenListing(t, u, price = '$412,000') {
  const shock = u > 0.9;
  return `<rect x="-176" y="-376" width="352" height="752" fill="#f5f6fa"/>${I.statusBar({ dark: false })}
    <rect x="-176" y="-320" width="352" height="60" fill="#fff"/><text x="-150" y="-280" font-family="InterW" font-weight="800" font-size="24" fill="${C.ink}">HomeFinder</text>
    <rect x="-160" y="-240" width="320" height="230" rx="16" fill="#bfe3ff"/><g transform="translate(0 -60) scale(0.55)">${I.house(0, 0, 1, '#ffb27a', '#c0392b')}</g><rect x="-160" y="-60" width="320" height="50" fill="#8bc77b"/>
    <text x="-150" y="40" font-family="InterW" font-weight="700" font-size="20" fill="#555">3 bed · 2 bath · cozy</text>
    <g transform="translate(-150 100) scale(${shock ? 1 + 0.08 * Math.sin(t * 20) : 1})"><text font-family="MontB" font-weight="900" font-size="46" fill="${shock ? C.red : C.ink}">${price}</text></g>
    <rect x="-160" y="150" width="320" height="64" rx="32" fill="${C.blue}"/><text y="192" font-family="InterW" font-weight="800" font-size="22" fill="#fff" text-anchor="middle">Contact agent</text>
    ${u < 0.9 ? [0, 1, 2].map((i) => `<rect x="-160" y="${250 + i * 40}" width="${320 - i * 60}" height="20" rx="10" fill="#e3e7ef"/>`).join('') : ''}`;
}
// salary bars stacked against the house price
export function ratioBars(x, y, s = 1, n = 3, u = 1, year = '1990s') {
  const shown = Math.min(n, u * (n + 0.5));
  let bars = '';
  for (let i = 0; i < Math.ceil(n); i++) {
    const k = clamp(shown - i), h = 130 * Math.min(1, n - i);
    bars += `<g opacity="${clamp(k * 3)}"><rect x="-150" y="${-i * 140 - h}" width="300" height="${h}" rx="14" fill="${C.green}"/>${k >= 1 && n - i >= 1 ? txt(0, -i * 140 - 46, 34, '#fff', `1 YEAR OF PAY`) : ''}</g>`;
  }
  return `<g transform="${T(x, y, s)}">${bars}<g transform="translate(400 0)">${I.house(0, 0, 1.0, '#ffb27a', '#c0392b')}</g>
    ${outlined(0, 100, 64, '#fff', year, 7)}${outlined(0, -n * 140 - 70, 110, C.yellow, `${Math.min(n, Math.round(shown * 10) / 10).toFixed(shown % 1 ? 1 : 0)}×`, 10)}</g>`;
}
export function rentPie(x, y, s = 1, p = 0) {
  const a = p * 2 * Math.PI, x1 = Math.sin(a) * 260, y1 = -Math.cos(a) * 260;
  return `<g transform="${T(x, y, s)}"><circle r="280" fill="#fff" filter="url(#drop)"/><circle r="260" fill="${C.green}"/>
    ${p > 0 ? `<path d="M 0 0 L 0 -260 A 260 260 0 ${p > 0.5 ? 1 : 0} 1 ${x1} ${y1} Z" fill="${C.red}"/>` : ''}${p > 0.2 ? txt(100, -60, 56, '#fff', 'RENT') : ''}${txt(-60, 120, 48, '#fff', 'PAYCHECK')}</g>`;
}
export function childRoom(t) {
  return `${I.bg('#ffd1dc', '#ffe9f0')}<rect y="1200" width="1080" height="720" fill="#c98f4a"/>
    ${[[160, 470, '#4a86f0', '★'], [380, 520, C.yellow, '♪'], [800, 470, C.green, '⚽']].map(([px, py, col, ic]) => `<g transform="translate(${px} ${py}) rotate(${-4 + hash(px, 1) * 8})"><rect x="-90" y="-120" width="180" height="240" rx="6" fill="${col}"/><text y="30" font-size="90" text-anchor="middle" fill="#fff">${ic}</text></g>`).join('')}
    <rect x="80" y="1060" width="420" height="140" rx="20" fill="#4a86f0"/><rect x="80" y="1000" width="120" height="90" rx="20" fill="#fff"/><rect x="60" y="960" width="40" height="260" fill="#8a5a3c"/>
    <g transform="translate(300 1050)"><rect x="-90" y="-30" width="180" height="40" rx="12" fill="#7bd389"/></g>`;
}
export function viennaBlock(x, y, s = 1, t = 0) {
  let win = '';
  for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) win += `<rect x="${-400 + c * 90}" y="${-500 + r * 90}" width="50" height="60" rx="4" fill="${hash(r * 9 + c, 2) > 0.3 ? '#ffe7a6' : '#3a4a6a'}"/>`;
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-440" y="-560" width="880" height="560" fill="#e8c9a0"/></g><rect x="-440" y="-600" width="880" height="50" fill="#c0392b"/>${win}
    <path d="M -110 0 L -110 -120 A 110 110 0 0 1 110 -120 L 110 0 Z" fill="#5a3a26"/><path d="M -80 0 L -80 -110 A 80 80 0 0 1 80 -110 L 80 0 Z" fill="#8bc77b"/>${I.person(0, 0, 0.35, { shirt: C.teal, t })}
    <rect x="-200" y="-590" width="400" height="32" fill="#fff"/>${txt(0, -566, 26, C.ink, 'GEMEINDEBAU')}</g>`;
}
export function crane(x, y, s = 1, t = 0) {
  const sw = 8 * Math.sin(t * 0.8);
  return `<g transform="${T(x, y, s)}"><rect x="-14" y="-700" width="28" height="700" fill="${C.yellow}"/>${[...Array(14)].map((_, i) => `<path d="M -14 ${-i * 50} L 14 ${-i * 50 - 50}" stroke="#c99a1e" stroke-width="5"/>`).join('')}
    <g transform="rotate(${sw} 0 -700)"><rect x="-120" y="-720" width="520" height="24" fill="${C.yellow}"/><rect x="-140" y="-730" width="60" height="50" fill="#5b6378"/>
    <line x1="320" y1="-696" x2="320" y2="-420" stroke="#2a2e3b" stroke-width="4"/><rect x="290" y="-420" width="60" height="40" fill="#9aa3b8"/></g></g>`;
}
export function tokyo(t, k = 1) {
  let s = '';
  for (let i = 0; i < 9; i++) {
    const h = (220 + hash(i, 4) * 420) * clamp(k * 1.3 - i * 0.05), x = 40 + i * 115;
    s += `<rect x="${x}" y="${1250 - h}" width="100" height="${h}" fill="${['#e9ecf3', '#d9dde8', '#c9cfdc'][i % 3]}" stroke="#9aa3b8" stroke-width="3"/>`;
    for (let r = 0; r < h / 50 - 1; r++) s += `<rect x="${x + 12}" y="${1250 - h + 18 + r * 50}" width="76" height="22" rx="3" fill="${hash(i * 20 + r, 5) > 0.4 ? '#9fd2ff' : '#ffe7a6'}"/>`;
  }
  return s;
}
export function lines(x, y, s = 1, u = 0) {
  const n = Math.max(2, Math.floor(clamp(u) * 30)), P = (k, a) => [-380 + k * 760, 200 - a * 400];
  const price = [], pay = [];
  for (let i = 0; i <= n; i++) { const k = i / 30; price.push(P(k, 0.1 + 0.85 * Math.pow(k, 1.6) + 0.03 * Math.sin(k * 30))); pay.push(P(k, 0.1 + 0.3 * k)); }
  const pth = (a) => 'M ' + a.map((p) => p.join(' ')).join(' L ');
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-420" y="-280" width="840" height="560" rx="30" fill="#0b0d14"/></g>
    <path d="${pth(price)}" stroke="${C.red}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="${pth(pay)}" stroke="${C.green}" stroke-width="12" fill="none" stroke-linecap="round"/>
    ${txt(-240, -220, 36, C.red, 'HOME PRICES')}${txt(220, 240, 36, C.green, 'PAYCHECKS')}</g>`;
}
export function key(x, y, s = 1, rot = 0) {
  return `<g transform="${T(x, y, s, rot)}" filter="url(#soft)"><circle cx="-100" r="70" fill="${C.yellow}"/><circle cx="-100" r="30" fill="#0e1530"/><rect x="-40" y="-18" width="220" height="36" rx="10" fill="${C.yellow}"/>
    <rect x="120" y="18" width="24" height="44" fill="${C.yellow}"/><rect x="160" y="18" width="20" height="30" fill="${C.yellow}"/></g>`;
}
