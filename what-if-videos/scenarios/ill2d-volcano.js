// More of the flat illustration kit, for "What if Yellowstone erupted?" (scenarios/yellowstone.js).
import * as I from './ill2d.js';
import { txt, outlined } from './ill2d-grid.js';

const { C, ease, clamp, lerp, hash } = I;
const T = (x, y, s = 1, rot = 0) => `translate(${x} ${y}) rotate(${rot}) scale(${s})`;
export const LAVA = '#ff6a2b', ASH = '#8e8a86';

// the park: hills, pines, a geyser; `geyser` 0..1 height
export function park(t, { geyser = 0.6, ash = 0 } = {}) {
  const pine = (x, y, s) => `<g transform="${T(x, y, s)}"><rect x="-8" y="-20" width="16" height="30" fill="#5a3a26"/><path d="M 0 -150 L 50 -60 L 30 -60 L 60 -10 L -60 -10 L -30 -60 L -50 -60 Z" fill="${ash > 0.5 ? '#7a7a72' : '#2f7a4f'}"/></g>`;
  const gh = 300 * geyser * (0.85 + 0.15 * Math.sin(t * 9));
  return `${I.bg(ash > 0.5 ? '#6f6a66' : '#7cc7ff', ash > 0.5 ? '#9a948e' : '#d6efff')}<path d="M 0 1000 Q 200 820 420 960 Q 640 760 860 930 Q 980 860 1080 900 L 1080 1920 L 0 1920 Z" fill="${ash > 0.5 ? '#7a7670' : '#6aa86b'}"/>
    <rect y="1150" width="1080" height="770" fill="${ash > 0.5 ? '#8a8680' : '#8bc77b'}"/>${[[120, 1160, 1], [220, 1180, 0.8], [860, 1170, 1.1], [960, 1150, 0.8], [760, 1190, 0.7]].map(([x, y, s]) => pine(x, y, s)).join('')}
    <ellipse cx="540" cy="1200" rx="140" ry="30" fill="#e8d9b0"/>${geyser > 0 ? `<path d="M ${520} 1200 Q ${500 + 10 * Math.sin(t * 7)} ${1200 - gh / 2} ${530} ${1200 - gh} Q ${560} ${1200 - gh - 30} ${570} ${1200 - gh} Q ${590 + 10 * Math.sin(t * 6)} ${1200 - gh / 2} 560 1200 Z" fill="#eaf6ff" opacity="0.9"/>
    ${[0, 1, 2].map((i) => `<circle cx="${545 + (i - 1) * 40}" cy="${1200 - gh - 20 - i * 20}" r="${50 + 10 * i}" fill="#fff" opacity="0.6"/>`).join('')}` : ''}`;
}
export function soda(x, y, s = 1, t = 0, spray = 0) {
  const sh = spray ? 0 : 12 * Math.sin(t * 30);
  return `<g transform="${T(x + sh, y, s, sh / 2)}">${spray ? [...Array(18)].map((_, i) => { const a = -Math.PI / 2 + (hash(i, 2) - 0.5) * 0.9, d = ((t * 2 + hash(i, 1)) % 1) * 420 * spray; return `<circle cx="${Math.cos(a) * d}" cy="${-260 + Math.sin(a) * d}" r="${10 + 8 * hash(i, 3)}" fill="#c98f4a" opacity="${0.9 - d / 500}"/>`; }).join('') : ''}
    <rect x="-34" y="-260" width="68" height="40" rx="8" fill="${spray ? '#c3c9d6' : C.red}"/><path d="M -34 -220 Q -90 -140 -90 -60 L -90 220 Q -90 250 -60 250 L 60 250 Q 90 250 90 220 L 90 -60 Q 90 -140 34 -220 Z" fill="#6b3a1a" opacity="0.92"/>
    <rect x="-90" y="-20" width="180" height="120" fill="${C.red}"/>${txt(0, 60, 44, '#fff', 'SODA')}${[0, 1, 2, 3].map((i) => `<circle cx="${-40 + i * 26}" cy="${150 - ((t * 1.5 + i * 0.3) % 1) * 300}" r="7" fill="#fff" opacity="0.6"/>`).join('')}</g>`;
}
// cross-section: ground, the park on top, the magma chamber below; `glow` 0..1, `swell` lifts the surface
export function crossSection(t, { glow = 0.6, swell = 0 } = {}) {
  const sw = 50 * swell;
  return `${I.bg('#7cc7ff', '#d6efff')}<path d="M 0 700 Q 270 ${700 - sw * 0.3} 540 ${690 - sw} Q 810 ${700 - sw * 0.3} 1080 700 L 1080 1920 L 0 1920 Z" fill="#8a5a3c"/>
    <path d="M 0 700 Q 270 ${700 - sw * 0.3} 540 ${690 - sw} Q 810 ${700 - sw * 0.3} 1080 700 L 1080 740 Q 540 ${730 - sw} 0 740 Z" fill="#6aa86b"/>
    ${[0, 1, 2, 3].map((i) => `<path d="M 0 ${820 + i * 110} Q 540 ${800 + i * 110 - sw * (1 - i * 0.2)} 1080 ${820 + i * 110}" stroke="#7a4a2e" stroke-width="10" fill="none" opacity="0.5"/>`).join('')}
    <ellipse cx="540" cy="1180" rx="${360 + 10 * Math.sin(t * 2)}" ry="${150 + 6 * Math.sin(t * 2.4)}" fill="${LAVA}" opacity="${0.6 + 0.4 * glow}" filter="url(#glow)"/>
    <ellipse cx="540" cy="1180" rx="260" ry="90" fill="#ffd84a" opacity="${0.5 * glow}"/>
    ${[...Array(8)].map((_, i) => { const p = (t * 0.5 + i / 8) % 1; return `<circle cx="${380 + i * 45}" cy="${1240 - p * 140}" r="${8 + 8 * (1 - p)}" fill="#ffd84a" opacity="${(1 - p) * glow}"/>`; }).join('')}
    <path d="M 540 ${1030} L 540 ${745 - sw}" stroke="${LAVA}" stroke-width="10" stroke-dasharray="14 12" opacity="${0.3 + 0.5 * glow}"/>`;
}
export function seismo(x, y, s = 1, t = 0, amp = 1) {
  let d = 'M -380 0';
  for (let i = 0; i <= 120; i++) { const xx = -380 + i * 6.4, k = (i + Math.floor(t * 40)) % 120; d += ` L ${xx} ${(hash(k, 7) - 0.5) * 2 * 120 * amp * (k % 30 < 8 ? 1 : 0.15)}`; }
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-420" y="-220" width="840" height="440" rx="24" fill="#f6f3ea"/></g>
    ${[-120, -60, 0, 60, 120].map((yy) => `<line x1="-400" y1="${yy}" x2="400" y2="${yy}" stroke="#e0d8c6" stroke-width="3"/>`).join('')}<path d="${d}" fill="none" stroke="${C.red}" stroke-width="5"/>
    ${txt(-260, -170, 36, C.ink, 'SEISMOGRAPH')}</g>`;
}
export function column(x, y, s = 1, t = 0, h = 1) {
  const H = 1100 * h;
  const puffs = [...Array(18)].map((_, i) => { const k = i / 17, yy = -k * H, w = 70 + k * 260, ph = t * 1.2 + i; return `<circle cx="${Math.sin(ph) * w * 0.3}" cy="${yy}" r="${w * (0.55 + 0.1 * Math.sin(ph * 1.3))}" fill="${i % 2 ? '#7a7670' : '#9a948e'}"/>`; }).join('');
  const top = h > 0.85 ? [...Array(7)].map((_, i) => `<ellipse cx="${(i - 3) * 160}" cy="${-H - 40 + 20 * Math.sin(t + i)}" rx="${200}" ry="90" fill="#8a8680"/>`).join('') : '';
  return `<g transform="${T(x, y, s)}"><ellipse cy="0" rx="180" ry="50" fill="${LAVA}" filter="url(#glow)"/>${puffs}${top}
    ${[...Array(6)].map((_, i) => `<path d="M ${(hash(i, 3) - 0.5) * 200} ${-H * (0.2 + 0.5 * hash(i, 4))} l ${18} ${50} l -12 0 l 20 60" stroke="#ffd84a" stroke-width="6" fill="none" opacity="${Math.floor(t * 6 + i) % 4 === 0 ? 1 : 0}"/>`).join('')}</g>`;
}
export function car(x, y, s = 1, col = C.coral, t = 0) {
  return `<g transform="${T(x, y, s)}"><rect x="-90" y="-40" width="180" height="50" rx="16" fill="${col}"/><path d="M -50 -40 L -30 -80 L 40 -80 L 60 -40 Z" fill="${col}"/><path d="M -38 -44 L -24 -72 L 6 -72 L 6 -44 Z M 14 -44 L 14 -72 L 34 -72 L 48 -44 Z" fill="#bfe3ff"/>
    <circle cx="-50" cy="12" r="22" fill="#1a1d27"/><circle cx="50" cy="12" r="22" fill="#1a1d27"/></g>`;
}
const US = [[-430, -200], [-250, -210], [40, -205], [90, -170], [160, -140], [230, -150], [300, -170], [390, -230], [420, -170], [330, -110], [300, -60], [270, 0], [250, 60], [200, 130], [235, 230], [180, 240], [160, 140], [60, 140], [-20, 150], [-80, 180], [-110, 250], [-170, 170], [-230, 120], [-330, 110], [-390, 60], [-440, -40], [-450, -140]];
export const YS = [-230, -120];
// the US with ash zones spreading from Yellowstone; `k` 0..1
export function ashMap(x, y, s = 1, t = 0, k = 0, cities = []) {
  const clip = `M ${US.map((p) => p.join(' ')).join(' L ')} Z`;
  return `<g transform="${T(x, y, s)}"><clipPath id="us"><path d="${clip}"/></clipPath><path d="${clip}" fill="#6aa86b" stroke="#fff" stroke-width="6" stroke-linejoin="round" filter="url(#drop)"/>
    <g clip-path="url(#us)">${[[900, '#b9b4ae', 0.55], [560, '#9a948e', 0.7], [300, '#7a7670', 0.85], [130, '#4a4744', 0.95]].map(([r, col, op], i) => `<ellipse cx="${YS[0] + 60}" cy="${YS[1] + 20}" rx="${r * clamp(k * 1.3 - i * 0.1)}" ry="${r * 0.8 * clamp(k * 1.3 - i * 0.1)}" fill="${col}" opacity="${op}"/>`).join('')}</g>
    <circle cx="${YS[0]}" cy="${YS[1]}" r="${16 + 4 * Math.sin(t * 6)}" fill="${LAVA}" filter="url(#glow)"/>
    ${cities.map(([cx, cy, name, depth], i) => `<g opacity="${clamp((k - 0.4 - i * 0.12) * 5)}"><circle cx="${cx}" cy="${cy}" r="10" fill="#fff"/>${outlined(cx, cy - 22, 30, '#fff', name, 5)}${outlined(cx, cy + 46, 28, C.yellow, depth, 5)}</g>`).join('')}</g>`;
}
export function ashRoof(x, y, s = 1, ash = 0) {
  return `<g transform="${T(x, y, s)}">${I.house(0, 0, 1.4, '#ffb27a', '#c0392b')}<path d="M ${-260} ${-290} L 0 ${-510 - 30 * ash} L 260 ${-290} Z" fill="${ASH}" opacity="${clamp(ash * 2)}"/>
    <rect x="-220" y="-6" width="440" height="${40 * ash}" fill="${ASH}" transform="translate(0 ${-40 * ash})"/></g>`;
}
export function ashFall(t, n = 60, op = 1) {
  return [...Array(n)].map((_, i) => { const p = (t * (0.3 + 0.2 * hash(i, 2)) + hash(i, 1)) % 1; return `<circle cx="${hash(i, 3) * 1080 + 30 * Math.sin(t + i)}" cy="${300 + p * 1500}" r="${3 + 4 * hash(i, 4)}" fill="#d9d4ce" opacity="${op * 0.8}"/>`; }).join('');
}
export function crops(x, y, s = 1, t = 0, wilt = 0) {
  return `<g transform="${T(x, y, s)}">${[...Array(7)].map((_, i) => { const cx = -330 + i * 110, bend = 40 * wilt; return `<path d="M ${cx} 0 Q ${cx + 10} -120 ${cx + bend} -${220 - 80 * wilt}" stroke="${wilt > 0.5 ? '#a09a5a' : '#4caf50'}" stroke-width="10" fill="none"/>
    <ellipse cx="${cx + bend}" cy="${-230 + 80 * wilt}" rx="22" ry="40" fill="${wilt > 0.5 ? '#c9b46a' : '#ffd84a'}" transform="rotate(${30 * wilt} ${cx + bend} ${-230 + 80 * wilt})"/>
    <path d="M ${cx + 4} -80 q 40 -20 60 10 M ${cx + 4} -130 q -40 -20 -60 10" stroke="${wilt > 0.5 ? '#a09a5a' : '#4caf50'}" stroke-width="8" fill="none"/>`; }).join('')}<rect x="-420" y="0" width="840" height="60" fill="#6b4a2e"/></g>`;
}
export function steamBlast(x, y, s = 1, t = 0, u = 0) {
  const k = ease.out(u / 0.6);
  return `<g transform="${T(x, y, s)}"><ellipse rx="160" ry="34" fill="#c9b48a"/>${[...Array(10)].map((_, i) => { const a = -Math.PI / 2 + (i - 4.5) * 0.18, d = 260 * k * (0.6 + 0.4 * hash(i, 1)); return `<circle cx="${Math.cos(a) * d}" cy="${Math.sin(a) * d}" r="${40 + 30 * hash(i, 2)}" fill="#fff" opacity="${0.85 - 0.3 * k}"/>`; }).join('')}
    ${[...Array(6)].map((_, i) => { const a = -Math.PI / 2 + (i - 2.5) * 0.4, d = 200 * k; return `<rect x="${Math.cos(a) * d - 10}" y="${Math.sin(a) * d - 10 + 120 * k * k}" width="20" height="20" rx="4" fill="#8a7a6a"/>`; }).join('')}</g>`;
}
