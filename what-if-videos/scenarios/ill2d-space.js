// More of the flat illustration kit, for "What if an asteroid was heading for Earth?" (scenarios/asteroid.js).
import * as I from './ill2d.js';
import { txt, outlined, stars } from './ill2d-grid.js';

const { C, ease, clamp, lerp, hash } = I;
const T = (x, y, s = 1, rot = 0) => `translate(${x} ${y}) rotate(${rot}) scale(${s})`;

export const space = (t, glow = null, gy = 860) => `${I.bg('#03040e', '#0b0f2a', glow, gy)}${stars(t, 110, 21, 1, 1900)}`;
// a cratered rock; `heat` 0..1 adds an entry glow and a tail pointing away from `dir` (degrees)
export function asteroid(x, y, s = 1, t = 0, { rot = 0, tail = 0, dir = 135 } = {}) {
  const pts = [...Array(14)].map((_, i) => { const a = i / 14 * Math.PI * 2, r = 100 * (0.82 + 0.25 * hash(i, 4)); return [Math.cos(a) * r, Math.sin(a) * r]; });
  const tl = tail ? `<g transform="rotate(${dir})"><path d="M 0 -90 L ${700 * tail} -30 L ${700 * tail} 30 L 0 90 Z" fill="url(#tailG)" opacity="0.85"/></g>` : '';
  return `<g transform="${T(x, y, s)}"><linearGradient id="tailG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></linearGradient>${tl}
    <g transform="rotate(${rot + t * 12})"><path d="M ${pts.map((p) => p.join(' ')).join(' L ')} Z" fill="#8a7a6a" stroke="#5a4a3e" stroke-width="8" stroke-linejoin="round" filter="url(#drop)"/>
    ${[[-30, -20, 22], [30, 30, 16], [20, -40, 12], [-40, 40, 10], [50, -5, 9]].map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#6a5a4c"/><circle cx="${cx - 4}" cy="${cy - 4}" r="${r * 0.6}" fill="#5a4a3e"/>`).join('')}
    <path d="M ${pts.slice(0, 6).map((p) => p.join(' ')).join(' L ')}" fill="none" stroke="#b8a898" stroke-width="6" opacity="0.6"/></g></g>`;
}
export function earth(x, y, r = 200, t = 0) {
  return I.globe(x, y, r, t, { spin: t * 0.08 });
}
export function observatory(x, y, s = 1, t = 0) {
  return `<g transform="${T(x, y, s)}"><rect x="-200" y="-160" width="400" height="160" fill="#e9ecf3" filter="url(#drop)"/><path d="M -210 -160 A 210 210 0 0 1 210 -160 Z" fill="#cfd5e2"/>
    <g transform="rotate(-35 0 -230)"><rect x="-40" y="-430" width="80" height="220" rx="10" fill="#5b6378"/><rect x="-48" y="-440" width="96" height="30" rx="8" fill="#2a2e3b"/></g>
    <rect x="-60" y="-80" width="120" height="80" rx="8" fill="#2a3352"/></g>`;
}
export function stadium(x, y, s = 1) {
  return `<g transform="${T(x, y, s)}"><ellipse cy="0" rx="300" ry="90" fill="#9aa3b8"/><ellipse cy="-30" rx="300" ry="90" fill="#c3c9d6"/><ellipse cy="-30" rx="230" ry="62" fill="#3fbf7f"/>
    <rect x="-140" y="-48" width="280" height="36" fill="none" stroke="#fff" stroke-width="4"/><line x1="0" y1="-48" x2="0" y2="-12" stroke="#fff" stroke-width="4"/>
    ${[-260, 260].map((lx) => `<rect x="${lx - 6}" y="-200" width="12" height="160" fill="#5b6378"/><rect x="${lx - 30}" y="-210" width="60" height="26" rx="4" fill="#fff8d6"/>`).join('')}</g>`;
}
// orbit diagram: Earth at the centre-left, the asteroid's path curving in; `miss` bends the path away from Earth
export function trajectory(x, y, s = 1, t = 0, { p = 0, miss = 0, ex = -200, ey = 160 } = {}) {
  const P = (k) => { const a = lerp(-2.4, -0.15, k); return [ex + Math.cos(a) * 640 * (1 + 0.15 * miss * k * k), ey + Math.sin(a) * 640 * (1 - 0.12 * miss * k * k)]; };
  let d = ''; for (let i = 0; i <= 40; i++) { const [px, py] = P(i / 40); d += (i ? ' L ' : 'M ') + `${px} ${py}`; }
  const [ax, ay] = P(clamp(p));
  const [hx, hy] = P(1);
  return `<g transform="${T(x, y, s)}"><circle cx="${ex}" cy="${ey}" r="640" fill="none" stroke="#2a3a6a" stroke-width="3" stroke-dasharray="10 12"/>
    <path d="${d}" fill="none" stroke="${miss > 0.5 ? C.green : C.red}" stroke-width="8" stroke-dasharray="20 14" opacity="0.8"/>${earth(ex + 600, ey - 20, 90, t)}
    ${miss < 0.5 ? `<circle cx="${hx}" cy="${hy}" r="${40 + 10 * Math.sin(t * 6)}" fill="none" stroke="${C.red}" stroke-width="8"/>` : ''}
    <g transform="translate(${ax} ${ay}) scale(0.35)">${asteroid(0, 0, 1, t)}</g></g>`;
}
export function crackedWindow(x, y, s = 1, crack = 0, t = 0) {
  const lines = [[0, 0, -120, -90], [0, 0, 110, -120], [0, 0, 140, 60], [0, 0, -90, 130], [0, 0, 20, 160], [-60, -45, -130, -10], [55, -60, 120, -40]];
  return `<g transform="${T(x, y, s)}"><rect x="-200" y="-220" width="400" height="440" rx="10" fill="#5a3a26" filter="url(#drop)"/><rect x="-180" y="-200" width="360" height="400" fill="#bfe3ff"/>
    <path d="M -180 140 L -100 60 L 0 120 L 90 40 L 180 100 L 180 200 L -180 200 Z" fill="#9aa8c2"/>
    ${crack > 0 ? lines.map(([a, b, c, d2], i) => `<line x1="${a}" y1="${b}" x2="${lerp(a, c, clamp(crack * 2 - i * 0.1))}" y2="${lerp(b, d2, clamp(crack * 2 - i * 0.1))}" stroke="#fff" stroke-width="5"/>`).join('') : ''}
    <line x1="0" y1="-200" x2="0" y2="200" stroke="#5a3a26" stroke-width="16"/><line x1="-180" y1="0" x2="180" y2="0" stroke="#5a3a26" stroke-width="16"/></g>`;
}
export function dart(x, y, s = 1, rot = 0) {
  return `<g transform="${T(x, y, s, rot)}"><rect x="-300" y="-30" width="220" height="60" fill="#2f5fbf"/><rect x="80" y="-30" width="220" height="60" fill="#2f5fbf"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="${-292 + i * 52}" y="-24" width="44" height="48" fill="#4a86f0"/><rect x="${88 + i * 52}" y="-24" width="44" height="48" fill="#4a86f0"/>`).join('')}
    <rect x="-80" y="-60" width="160" height="120" rx="12" fill="#e9c46a" filter="url(#soft)"/><circle cx="0" cy="-80" r="34" fill="#c9cfdc"/>${txt(0, 18, 34, C.ink, 'DART')}</g>`;
}
// Didymos with its moonlet Dimorphos; `k` 0..1 shrinks the orbit after the hit
export function binary(x, y, s = 1, t = 0, k = 0, hit = -1) {
  const r = lerp(300, 270, k), a = t * lerp(0.9, 0.95, k);
  const mx = Math.cos(a) * r, my = Math.sin(a) * r * 0.4;
  return `<g transform="${T(x, y, s)}"><ellipse rx="300" ry="120" fill="none" stroke="#5a6a9a" stroke-width="4" stroke-dasharray="10 12" opacity="${1 - k}"/>
    ${k > 0 ? `<ellipse rx="${r}" ry="${r * 0.4}" fill="none" stroke="${C.green}" stroke-width="5" stroke-dasharray="10 12"/>` : ''}
    ${asteroid(0, 0, 1.3, t * 0.4)}<g transform="translate(${mx} ${my})">${asteroid(0, 0, 0.42, t, { rot: 60 })}${hit >= 0 && hit < 0.6 ? `<circle r="${80 + 300 * hit}" fill="#fff" opacity="${0.9 * (1 - hit / 0.6)}"/>` : ''}</g></g>`;
}
export function clockText(x, y, s = 1, a = '11h 55m', b = '') {
  return `<g transform="${T(x, y, s)}"><rect x="-260" y="-80" width="520" height="160" rx="24" fill="#0b0d14" filter="url(#drop)"/>
    <text y="30" font-family="monospace" font-weight="700" font-size="86" fill="${b ? C.green : '#fff'}" text-anchor="middle">${b || a}</text></g>`;
}
// two paths from the same start: the nudged one opens a small angle that becomes a big gap at Earth
export function nudge(x, y, s = 1, t = 0, u = 0) {
  const ang = 3 * ease.out(clamp((u - 0.3) / 0.6)), L = 820 * clamp(u / 1.2), rad = ang * Math.PI / 180;
  return `<g transform="${T(x, y, s)}"><line x1="-420" y1="0" x2="${-420 + 820}" y2="0" stroke="${C.red}" stroke-width="6" stroke-dasharray="18 14" opacity="0.6"/>${earth(400, 0, 70, t)}
    <line x1="-420" y1="0" x2="${-420 + Math.cos(-rad * 6) * L}" y2="${Math.sin(-rad * 6) * L}" stroke="${C.green}" stroke-width="10" stroke-linecap="round"/>
    <g transform="translate(-420 0) scale(0.32)">${asteroid(0, 0, 1, t)}</g>
    ${u > 1.2 ? `<line x1="400" y1="-80" x2="400" y2="${-Math.sin(rad * 6) * 820 + 20}" stroke="#fff" stroke-width="4"/>${outlined(560, -150, 54, C.yellow, 'HUGE MISS', 7)}` : ''}
    ${outlined(-300, 120, 44, '#fff', 'TINY NUDGE', 6)}</g>`;
}
export function telescope(x, y, s = 1, t = 0) {
  return `<g transform="${T(x, y, s, -18)}"><rect x="-300" y="-70" width="420" height="140" rx="20" fill="#e9ecf3" filter="url(#drop)"/><rect x="120" y="-90" width="70" height="180" rx="12" fill="#2a2e3b"/>
    <rect x="-380" y="-130" width="90" height="260" rx="10" fill="#c9a66b"/>${[0, 1, 2].map((i) => `<rect x="${-370}" y="${-110 + i * 80}" width="70" height="60" fill="#e9c46a"/>`).join('')}
    <path d="M -260 70 L -320 200 M -200 70 L -170 200" stroke="#9aa3b8" stroke-width="10"/><circle cx="190" cy="0" r="${12 + 4 * Math.sin(t * 5)}" fill="#7fe8ff" filter="url(#glow)"/></g>`;
}
