// More of the flat illustration kit, for "What if money stopped working?" (scenarios/money.js).
import * as I from './ill2d.js';
import { txt, outlined } from './ill2d-grid.js';

const { C, ease, clamp, lerp, hash } = I;
const T = (x, y, s = 1, rot = 0) => `translate(${x} ${y}) rotate(${rot}) scale(${s})`;
export const CASH = '#2f9e57';

export function note(x, y, s = 1, rot = 0, label = '100', col = '#7bb38a', sub = 'DOLLARS') {
  return `<g transform="${T(x, y, s, rot)}"><rect x="-300" y="-140" width="600" height="280" rx="16" fill="${col}" filter="url(#soft)"/><rect x="-276" y="-116" width="552" height="232" rx="10" fill="none" stroke="#e8f5e0" stroke-width="6"/>
    <ellipse cx="0" cy="0" rx="90" ry="100" fill="#e8f5e0" opacity="0.8"/><circle cx="0" cy="-20" r="36" fill="${col}"/><rect x="-46" y="20" width="92" height="50" rx="20" fill="${col}"/>
    ${txt(-180, -60, 48, '#fff', label)}${txt(180, 90, 48, '#fff', label)}${txt(0, 112, 26, '#fff', sub)}</g>`;
}
export function snack(x, y, s = 1, shrink = 0) {
  const h = lerp(1, 0.72, shrink);
  return `<g transform="${T(x, y, s)}"><g transform="scale(1 ${h})"><path d="M -150 -220 L 150 -220 L 170 220 L -170 220 Z" fill="${C.coral}" filter="url(#soft)"/>
    <path d="M -150 -220 l 25 -20 l 25 20 l 25 -20 l 25 20 l 25 -20 l 25 20 l 25 -20 l 25 20 l 25 -20 l 25 20 l 25 -20 l 25 20 Z" fill="${C.coral}"/>${txt(0, -40, 64, '#fff', 'CHIPS')}<circle cy="90" r="70" fill="#ffd84a"/></g></g>`;
}
export function paycheck(x, y, s = 1, amount = '$2,000') {
  return `<g transform="${T(x, y, s)}"><rect x="-340" y="-150" width="680" height="300" rx="14" fill="#e9f3ff" filter="url(#drop)"/><rect x="-340" y="-150" width="680" height="60" rx="14" fill="${C.blue}"/>
    ${txt(-180, -108, 34, '#fff', 'PAYCHECK')}<text x="-300" y="-20" font-family="InterW" font-weight="700" font-size="28" fill="#555">PAY TO: YOU</text>
    <rect x="80" y="-50" width="230" height="70" rx="10" fill="#fff" stroke="#9aa1b2" stroke-width="3"/><text x="195" y="0" font-family="MontB" font-weight="900" font-size="40" fill="${C.ink}" text-anchor="middle">${amount}</text>
    <path d="M -300 90 q 60 -40 120 0 t 120 0" stroke="${C.ink}" stroke-width="4" fill="none"/><line x1="40" y1="100" x2="310" y2="100" stroke="#9aa1b2" stroke-width="3"/></g>`;
}
export function priceBoard(x, y, s = 1, t = 0, mult = 1) {
  const items = [['BREAD', 3], ['MILK', 2.5], ['EGGS', 4], ['RICE', 5]];
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-380" y="-300" width="760" height="600" rx="24" fill="#1a1d27"/></g>${txt(0, -220, 52, C.yellow, 'TODAY\'S PRICES')}
    ${items.map(([n, p], i) => { const v = p * mult, flick = Math.floor(t * 10 + i) % 7 === 0; return `<g transform="translate(0 ${-110 + i * 110})"><text x="-330" y="20" font-family="InterW" font-weight="800" font-size="48" fill="#fff">${n}</text>
      <text x="330" y="20" font-family="monospace" font-weight="700" font-size="56" fill="${flick ? '#fff' : C.red}" text-anchor="end">$${v >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)}</text></g>`; }).join('')}</g>`;
}
export function wheelbarrow(x, y, s = 1, t = 0, n = 10) {
  return `<g transform="${T(x, y, s)}"><path d="M -300 -40 L 220 -40 L 160 120 L -240 120 Z" fill="#5b6378" filter="url(#drop)"/>
    ${[...Array(n)].map((_, i) => `<g transform="translate(${-230 + (i % 5) * 100} ${-70 - Math.floor(i / 5) * 46}) rotate(${(hash(i, 3) - 0.5) * 20})"><rect x="-56" y="-26" width="112" height="52" rx="6" fill="${CASH}"/><rect x="-56" y="-6" width="112" height="12" fill="#e8f5e0"/></g>`).join('')}
    <circle cx="220" cy="150" r="56" fill="#1a1d27"/><circle cx="220" cy="150" r="20" fill="#9aa3b8"/><path d="M -300 -20 L -440 60 M -260 120 L -280 220" stroke="#8a5a3c" stroke-width="16" stroke-linecap="round"/></g>`;
}
export function eggs(x, y, s = 1) {
  return `<g transform="${T(x, y, s)}"><rect x="-160" y="-30" width="320" height="90" rx="16" fill="#c9b48a" filter="url(#soft)"/>${[0, 1, 2, 3].map((i) => `<ellipse cx="${-120 + i * 80}" cy="-40" rx="34" ry="44" fill="#fff7e6"/>`).join('')}</g>`;
}
export function fuelCan(x, y, s = 1) {
  return `<g transform="${T(x, y, s)}"><path d="M -110 -130 L 70 -130 L 110 -90 L 110 150 L -110 150 Z" fill="${C.red}" filter="url(#soft)"/><rect x="-80" y="-180" width="90" height="60" rx="14" fill="none" stroke="${C.red}" stroke-width="18"/>
    <path d="M 70 -130 L 110 -180 L 130 -170" stroke="#5b6378" stroke-width="16" fill="none"/>${txt(0, 40, 40, '#fff', 'FUEL')}</g>`;
}
export function scissors(x, y, s = 1, t = 0) {
  const a = 12 * Math.abs(Math.sin(t * 6));
  return `<g transform="${T(x, y, s)}"><g transform="rotate(${-a})"><rect x="-10" y="-150" width="20" height="150" rx="8" fill="#c3c9d6"/><circle cx="-40" cy="30" r="34" fill="none" stroke="${C.blue}" stroke-width="16"/></g>
    <g transform="rotate(${a})"><rect x="-10" y="-150" width="20" height="150" rx="8" fill="#9aa3b8"/><circle cx="40" cy="30" r="34" fill="none" stroke="${C.blue}" stroke-width="16"/></g><circle r="10" fill="#5b6378"/></g>`;
}
export function veggies(x, y, s = 1) {
  return `<g transform="${T(x, y, s)}"><path d="M -120 -20 L -60 -140 L -20 -20 Z" fill="#ff8a3d"/><path d="M -60 -140 q -20 -40 0 -60 M -60 -140 q 20 -40 40 -50" stroke="#4caf50" stroke-width="10" fill="none"/>
    <circle cx="70" cy="-60" r="70" fill="#4caf50"/><circle cx="40" cy="-90" r="30" fill="#66bb6a"/><circle cx="100" cy="-80" r="34" fill="#66bb6a"/><circle cx="-10" cy="10" r="50" fill="#e53935"/><rect x="-14" y="-46" width="8" height="20" fill="#4caf50"/></g>`;
}
export function swapArrows(x, y, s = 1, t = 0) {
  const p = (t * 1.2) % 1;
  return `<g transform="${T(x, y, s)}"><path d="M -120 -30 L 100 -30" stroke="#fff" stroke-width="14" stroke-linecap="round"/><path d="M 80 -60 L 130 -30 L 80 0 Z" fill="#fff"/>
    <path d="M 120 40 L -100 40" stroke="#fff" stroke-width="14" stroke-linecap="round"/><path d="M -80 10 L -130 40 L -80 70 Z" fill="#fff"/><circle cx="${-120 + 240 * p}" cy="-30" r="12" fill="${C.yellow}"/></g>`;
}
export function clockFast(x, y, s = 1, t = 0, speed = 6, label = '') {
  return `<g transform="${T(x, y, s)}"><circle r="200" fill="#fff" filter="url(#drop)"/><circle r="180" fill="#eef1f8"/>${[...Array(12)].map((_, i) => `<rect x="-6" y="-176" width="12" height="26" rx="6" fill="${C.ink}" transform="rotate(${i * 30})"/>`).join('')}
    <g transform="rotate(${t * 30 * speed})"><rect x="-8" y="-110" width="16" height="120" rx="8" fill="${C.ink}"/></g><g transform="rotate(${t * 360 * speed / 12})"><rect x="-5" y="-150" width="10" height="160" rx="5" fill="${C.red}"/></g><circle r="16" fill="${C.ink}"/>
    ${label ? outlined(0, 280, 64, C.yellow, label, 7) : ''}</g>`;
}
export function centralBank(x, y, s = 1, t = 0, locked = 0) {
  return `<g transform="${T(x, y, s)}"><path d="M -360 -260 L 0 -420 L 360 -260 Z" fill="#c3c9d6"/><rect x="-360" y="-260" width="720" height="40" fill="#9aa3b8"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${-320 + i * 124}" y="-220" width="60" height="300" fill="#e9ecf3"/>`).join('')}<rect x="-380" y="80" width="760" height="50" fill="#9aa3b8"/>${txt(0, -300, 40, C.ink, 'CENTRAL BANK')}
    ${locked ? `<g transform="translate(0 -60) scale(${ease.back(locked / 0.4)})"><rect x="-150" y="-80" width="300" height="160" rx="16" fill="#5b6378"/>${txt(0, 0, 34, '#fff', 'PRINTER')}<g transform="translate(110 40)"><rect x="-40" y="-20" width="80" height="70" rx="10" fill="${C.yellow}"/><path d="M -24 -20 L -24 -50 A 24 24 0 0 1 24 -50 L 24 -20" stroke="${C.yellow}" stroke-width="12" fill="none"/></g></g>` : ''}</g>`;
}
