// More of the flat illustration kit, for "What if a pandemic worse than COVID hit?" (scenarios/pandemic.js).
// Friendly, non-graphic: virus particles as cartoon spiky balls, people sneezing into tissues, masks, vials, beds.
import * as I from './ill2d.js';
import { txt, outlined } from './ill2d-grid.js';

const { C, ease, clamp, lerp, hash } = I;
const T = (x, y, s = 1, rot = 0) => `translate(${x} ${y}) rotate(${rot}) scale(${s})`;
export const GREEN = '#7bd389', VIR = '#ff6b9a';

export function virus(x, y, s = 1, t = 0, col = VIR, seed = 0) {
  const a = t * 20 + seed * 40;
  const spikes = [...Array(12)].map((_, i) => { const r = i * 30; return `<g transform="rotate(${r})"><rect x="-6" y="-112" width="12" height="40" fill="${col}"/><circle cy="-116" r="15" fill="#ffd1e0"/></g>`; }).join('');
  return `<g transform="${T(x, y, s, a)}">${spikes}<circle r="80" fill="${col}"/>${[[-30, -20, 14], [24, -30, 10], [10, 26, 16], [-28, 30, 9]].map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffd1e0" opacity="0.7"/>`).join('')}</g>`;
}
// a person mask on top of a person() drawn at the same x, y, s (standing pose)
export function mask(x, y, s = 1, col = '#9fd2ff') {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M -44 -380 Q 0 -392 44 -380 L 40 -350 Q 0 -330 -40 -350 Z" fill="${col}"/><line x1="-44" y1="-378" x2="-52" y2="-394" stroke="#fff" stroke-width="4"/><line x1="44" y1="-378" x2="52" y2="-394" stroke="#fff" stroke-width="4"/></g>`;
}
export function tissue(x, y, s = 1) {
  return `<g transform="${T(x, y, s)}"><path d="M -40 -30 Q 0 -60 40 -30 L 46 30 Q 0 50 -46 30 Z" fill="#fff" filter="url(#soft)"/></g>`;
}
export function moviePoster(x, y, s = 1, t = 0) {
  const sway = 6 * Math.sin(t * 3);
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-260" y="-380" width="520" height="760" rx="16" fill="#1a3a1f"/></g><rect x="-230" y="-350" width="460" height="700" fill="#2d5a33"/>
    <circle cx="140" cy="-220" r="70" fill="#e8f5c8" opacity="0.8"/><g transform="translate(0 150) rotate(${sway})">
    <rect x="-90" y="-80" width="180" height="230" rx="40" fill="#5a6b4a"/><circle cy="-150" r="80" fill="#9ccf7a"/><circle cx="-28" cy="-160" r="14" fill="#fff"/><circle cx="28" cy="-150" r="14" fill="#fff"/>
    <path d="M -30 -110 L 30 -116" stroke="#2a3a1f" stroke-width="8"/><rect x="-170" y="-40" width="90" height="34" rx="16" fill="#9ccf7a" transform="rotate(-10)"/><rect x="80" y="-40" width="90" height="34" rx="16" fill="#9ccf7a" transform="rotate(10)"/></g>
    ${txt(0, -280, 70, '#e8f5c8', 'ZOMBIES')}${txt(0, -230, 26, '#c9e0b8', 'NOW IN CINEMAS')}</g>`;
}
export function toiletRoll(x, y, s = 1, rot = 0) {
  return `<g transform="${T(x, y, s, rot)}" filter="url(#soft)"><rect x="-70" y="-90" width="140" height="180" rx="20" fill="#fff"/><ellipse cy="-90" rx="70" ry="22" fill="#eef1f8"/><ellipse cy="-90" rx="24" ry="9" fill="#c9cfdc"/>
    <path d="M 70 40 L 70 120 L 20 120" fill="#fff"/></g>`;
}
export function bread(x, y, s = 1, rot = 0) {
  return `<g transform="${T(x, y, s, rot)}" filter="url(#soft)"><path d="M -150 40 Q -170 -80 -40 -90 Q 0 -110 40 -90 Q 170 -80 150 40 Z" fill="#d99a52"/><rect x="-150" y="20" width="300" height="50" rx="16" fill="#c4823d"/>
    ${[-70, 0, 70].map((dx) => `<path d="M ${dx - 20} -60 L ${dx + 20} -30" stroke="#f0c48a" stroke-width="12" stroke-linecap="round"/>`).join('')}</g>`;
}
export function emptyShelves(x, y, s = 1, left = 0) {
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-420" y="-460" width="840" height="820" rx="24" fill="#d9dde8"/></g>
    ${[0, 1, 2, 3].map((r) => `<rect x="-400" y="${-262 + r * 190}" width="800" height="22" rx="6" fill="#9aa3b8"/>`).join('')}
    ${[...Array(12)].map((_, i) => hash(i, 3) < left ? `<g transform="translate(${-330 + (i % 6) * 130} ${-300 + Math.floor(i / 6) * 380})">${toiletRoll(0, 0, 0.45)}</g>` : '').join('')}
    <g transform="translate(0 -60)"><rect x="-220" y="-50" width="440" height="100" rx="12" fill="#fff8d6" filter="url(#soft)"/>${txt(0, 18, 46, C.red, 'SOLD OUT')}</g></g>`;
}
// world map dots: cities lighting up along flight paths
const CITIES = [[-0.62, -0.28], [-0.45, -0.1], [-0.3, 0.32], [-0.05, -0.32], [0.05, -0.18], [0.12, 0.1], [0.3, -0.24], [0.42, -0.05], [0.55, 0.2], [0.62, -0.32], [0.2, 0.36]];
export function flightMap(x, y, s = 1, t = 0, n = 0) {
  let g = '';
  const src = CITIES[4];
  CITIES.forEach(([cx, cy], i) => {
    if (i === 4) return;
    const k = i < 4 ? i : i - 1, on = clamp(n - k);
    const X0 = src[0] * 900, Y0 = src[1] * 900, X1 = cx * 900, Y1 = cy * 900, mx = (X0 + X1) / 2, my = (Y0 + Y1) / 2 - 140;
    if (on > 0) {
      g += `<path d="M ${X0} ${Y0} Q ${mx} ${my} ${X1} ${Y1}" fill="none" stroke="${VIR}" stroke-width="5" stroke-dasharray="${700 * on} 700" opacity="0.8"/>`;
      const p = ease.inOut(on), bx = (1 - p) ** 2 * X0 + 2 * (1 - p) * p * mx + p * p * X1, by = (1 - p) ** 2 * Y0 + 2 * (1 - p) * p * my + p * p * Y1;
      if (on < 1) g += `<g transform="translate(${bx} ${by}) scale(0.14)">${I.plane(0, 0, 1, Math.atan2(Y1 - Y0, X1 - X0) * 57.3)}</g>`;
    }
    g += `<circle cx="${X1}" cy="${Y1}" r="${on >= 1 ? 18 + 4 * Math.sin(t * 6 + i) : 10}" fill="${on >= 1 ? VIR : '#9fd2ff'}" ${on >= 1 ? 'filter="url(#glow)"' : ''}/>`;
  });
  const land = [[-0.5, -0.2, 0.22, 0.17], [-0.32, 0.25, 0.12, 0.18], [0.0, -0.25, 0.14, 0.12], [0.08, 0.15, 0.13, 0.22], [0.45, -0.15, 0.25, 0.17], [0.55, 0.3, 0.1, 0.08]];
  return `<g transform="${T(x, y, s)}"><rect x="-480" y="-380" width="960" height="760" rx="40" fill="#163a6b" filter="url(#drop)"/>
    ${land.map(([a, b, w, h]) => `<ellipse cx="${a * 900}" cy="${b * 900}" rx="${w * 900}" ry="${h * 900}" fill="#2f6f5a"/>`).join('')}${g}
    <circle cx="${src[0] * 900}" cy="${src[1] * 900}" r="${24 + 6 * Math.sin(t * 8)}" fill="${C.red}" filter="url(#glow)"/></g>`;
}
// the spread tree: 1 → 3 → 9 → 27 people
export function spreadTree(x, y, s = 1, u = 0, t = 0) {
  const rows = [1, 3, 9, 27], ys = [-360, -150, 80, 320];
  let g = '';
  rows.forEach((n, r) => {
    const show = clamp((u - r * 0.5) / 0.4); if (show <= 0) return;
    const w = r === 3 ? 34 : r === 2 ? 100 : 260;
    for (let i = 0; i < n; i++) {
      const px = (i - (n - 1) / 2) * w, py = ys[r];
      if (r) { const parent = Math.floor(i / 3), pn = rows[r - 1], pw = r - 1 === 2 ? 100 : r - 1 === 1 ? 260 : 260, ppx = (parent - (pn - 1) / 2) * pw; g += `<line x1="${ppx}" y1="${ys[r - 1] + 30}" x2="${px}" y2="${py - 30}" stroke="${VIR}" stroke-width="${r === 3 ? 2 : 4}" opacity="${0.6 * show}"/>`; }
      const sc = r === 3 ? 0.4 : r === 2 ? 0.6 : 1;
      g += `<g transform="translate(${px} ${py}) scale(${sc * ease.back(show)})"><circle cy="-18" r="18" fill="${r ? VIR : C.red}"/><rect x="-22" y="2" width="44" height="34" rx="16" fill="${r ? VIR : C.red}"/></g>`;
    }
    g += outlined(430, ys[r] + 16, 54, C.yellow, String(n), 7).replace('text-anchor="middle"', 'text-anchor="end"');
  });
  return `<g transform="${T(x, y, s)}">${g}</g>`;
}
export function bed(x, y, s = 1, occ = 0, t = 0) {
  return `<g transform="${T(x, y, s)}"><rect x="-150" y="-20" width="300" height="60" rx="14" fill="#eef1f8"/><rect x="-170" y="-90" width="20" height="160" rx="8" fill="#9aa3b8"/><rect x="150" y="-60" width="20" height="130" rx="8" fill="#9aa3b8"/>
    <rect x="-140" y="-50" width="80" height="34" rx="14" fill="#fff"/>
    ${occ ? `<circle cx="-100" cy="-56" r="28" fill="${C.skin}"/><rect x="-80" y="-50" width="220" height="44" rx="20" fill="#9fd2ff"/>` : ''}
    <rect x="160" y="-160" width="10" height="160" fill="#9aa3b8"/>${occ ? `<rect x="130" y="-210" width="70" height="56" rx="8" fill="#1a1d27"/><path d="M 136 -182 l 12 0 l 6 -14 l 8 26 l 6 -12 l 16 0" stroke="${C.green}" stroke-width="4" fill="none"/>` : ''}</g>`;
}
export function closedSign(x, y, s = 1, rot = 0, a = 'SCHOOL', b = 'CLOSED') {
  return `<g transform="${T(x, y, s, rot)}"><g filter="url(#drop)"><rect x="-230" y="-120" width="460" height="240" rx="24" fill="${C.red}"/></g><rect x="-210" y="-100" width="420" height="200" rx="16" fill="none" stroke="#fff" stroke-width="6"/>
    ${txt(0, -14, 56, '#fff', a)}${txt(0, 62, 64, '#fff', b)}</g>`;
}
export function vial(x, y, s = 1, t = 0, fill = 1) {
  return `<g transform="${T(x, y, s)}"><rect x="-60" y="-240" width="120" height="50" rx="10" fill="${C.blue}"/><rect x="-46" y="-196" width="92" height="30" fill="#c9cfdc"/>
    <g filter="url(#soft)"><rect x="-70" y="-170" width="140" height="300" rx="24" fill="#eaf6ff" opacity="0.8"/></g>
    <rect x="-56" y="${120 - 270 * fill}" width="112" height="${270 * fill}" rx="16" fill="${GREEN}"/><rect x="-70" y="-60" width="140" height="80" fill="#fff"/>${txt(0, -8, 30, C.ink, 'VACCINE')}</g>`;
}
export function codeScroll(x, y, s = 1, t = 0) {
  const L = 'AUGCUUGACAGUCCAUGGCAAUCGGAUCCAUGAC';
  let g = '';
  for (let r = 0; r < 9; r++) { const off = Math.floor(t * 8) + r * 5; g += `<text x="-360" y="${-200 + r * 50}" font-family="monospace" font-weight="700" font-size="40" fill="${['#7fe8ff', VIR, C.yellow, GREEN][r % 4]}" letter-spacing="6">${[...Array(16)].map((_, j) => L[(off + j) % L.length]).join('')}</text>`; }
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-400" y="-280" width="800" height="520" rx="26" fill="#0b0d14"/></g>${g}</g>`;
}
export function pieThird(x, y, s = 1, p = 0) {
  const a = p * 2 * Math.PI, x1 = Math.sin(a) * 260, y1 = -Math.cos(a) * 260;
  return `<g transform="${T(x, y, s)}">${I.globe(0, 0, 280, 0, {})}${p > 0 ? `<path d="M 0 0 L 0 -260 A 260 260 0 ${p > 0.5 ? 1 : 0} 1 ${x1} ${y1} Z" fill="${VIR}" opacity="0.75"/>` : ''}</g>`;
}
export function radar(x, y, s = 1, t = 0, blip = 0) {
  const a = (t * 120) % 360;
  return `<g transform="${T(x, y, s)}"><circle r="300" fill="#04210f" filter="url(#drop)"/>${[100, 200, 290].map((r) => `<circle r="${r}" fill="none" stroke="#2fd36f" stroke-width="4" opacity="0.5"/>`).join('')}
    <line x1="-300" y1="0" x2="300" y2="0" stroke="#2fd36f" stroke-width="3" opacity="0.4"/><line x1="0" y1="-300" x2="0" y2="300" stroke="#2fd36f" stroke-width="3" opacity="0.4"/>
    <g transform="rotate(${a})"><path d="M 0 0 L 0 -290 A 290 290 0 0 1 120 -264 Z" fill="#2fd36f" opacity="0.35"/></g>
    ${blip ? `<g transform="translate(130 -120) scale(${0.35 * ease.back(blip / 0.3)})">${virus(0, 0, 1, t)}</g>` : ''}</g>`;
}
export function icon(kind, x, y, s = 1, t = 0) {
  const g = (inner) => `<g transform="${T(x, y, s)}"><circle r="62" fill="#fff" filter="url(#soft)"/>${inner}</g>`;
  if (kind === 'virus') return g(`<g transform="scale(0.3)">${virus(0, 0, 1, t)}</g>`);
  if (kind === 'vial') return g(`<rect x="-16" y="-40" width="32" height="12" rx="3" fill="${C.blue}"/><rect x="-18" y="-26" width="36" height="64" rx="8" fill="${GREEN}"/>`);
  if (kind === 'paper') return g(`<rect x="-30" y="-38" width="60" height="76" rx="6" fill="#f3efe4" stroke="${C.ink}" stroke-width="4"/>${[0, 1, 2].map((i) => `<rect x="-20" y="${-24 + i * 18}" width="40" height="8" rx="4" fill="#9aa1b2"/>`).join('')}`);
  return I.icon(kind, x, y, s);
}
