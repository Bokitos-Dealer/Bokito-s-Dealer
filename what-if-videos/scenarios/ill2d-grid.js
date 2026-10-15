// More of the flat illustration kit, for "What if the power grid failed for a month?" (scenarios/power-grid.js).
// Same rules as ill2d.js: pure SVG strings from functions of time, canvas 1080 x 1920, subjects between y 400 and 1300.
import * as I from './ill2d.js';

const { C, ease, clamp, lerp, hash } = I;
const T = (x, y, s = 1, rot = 0) => `translate(${x} ${y}) rotate(${rot}) scale(${s})`;
const txt = (x, y, size, fill, s, o = '') => `<text x="${x}" y="${y}" font-family="MontB" font-weight="900" font-size="${size}" fill="${fill}" text-anchor="middle" ${o}>${s}</text>`;
const outlined = (x, y, size, fill, s, w = 10) => txt(x, y, size, fill, s, `stroke="#000" stroke-width="${w}" paint-order="stroke"`);
export { txt, outlined };

// ---------------------------------------------------------------- sky
export function stars(t, n = 70, seed = 1, op = 1, ymax = 1250) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = hash(i, seed) * 1080, y = 120 + hash(i, seed + 1) * (ymax - 120), r = 1.6 + hash(i, seed + 2) * 3.4;
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${op * (0.35 + 0.65 * Math.abs(Math.sin(t * (1 + hash(i, 4)) + i)))}"/>`;
    if (r > 4.4) s += `<path d="M ${x - 12} ${y} L ${x + 12} ${y} M ${x} ${y - 12} L ${x} ${y + 12}" stroke="#fff" stroke-width="2" opacity="${0.6 * op}"/>`;
  }
  return s;
}
export function milkyWay(op = 1) {
  return `<g opacity="${op}" transform="rotate(-28 540 700)"><ellipse cx="540" cy="700" rx="900" ry="120" fill="#b9a7ff" opacity="0.18" filter="url(#blur8)"/>
    <ellipse cx="540" cy="700" rx="700" ry="60" fill="#e4dcff" opacity="0.16" filter="url(#blur8)"/></g>`;
}
export function moon(x, y, r = 70) {
  return `<circle cx="${x}" cy="${y}" r="${r * 1.8}" fill="#fff6d0" opacity="0.12"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fff3c4"/>
    <circle cx="${x - r * 0.3}" cy="${y - r * 0.2}" r="${r * 0.18}" fill="#e8d9a0"/><circle cx="${x + r * 0.3}" cy="${y + r * 0.3}" r="${r * 0.12}" fill="#e8d9a0"/>`;
}
export function shootingStar(t0, t, y = 420) {
  const p = clamp((t - t0) / 0.7);
  if (p <= 0 || p >= 1) return '';
  const x = 980 - p * 700, yy = y + p * 260;
  return `<line x1="${x}" y1="${yy}" x2="${x + 200}" y2="${yy - 75}" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="${1 - p}"/><circle cx="${x}" cy="${yy}" r="8" fill="#fff" filter="url(#glow)"/>`;
}
export function stormCloud(x, y, s = 1, t = 0) {
  const flash = Math.max(0, Math.sin(t * 3.1) - 0.85) * 6.6;
  const rain = [...Array(16)].map((_, i) => { const p = (t * 1.6 + hash(i, 3)) % 1, rx = -250 + i * 33; return `<line x1="${rx}" y1="${70 + p * 380}" x2="${rx - 14}" y2="${110 + p * 380}" stroke="#9ec7ff" stroke-width="6" stroke-linecap="round" opacity="${0.7 * (1 - p)}"/>`; }).join('');
  return `<g transform="${T(x, y, s)}">${rain}
    <path d="M -40 60 L -90 200 L -30 190 L -70 330 L 50 150 L -10 160 L 30 60 Z" fill="${C.yellow}" opacity="${clamp(flash)}" filter="url(#glow)"/>
    <g filter="url(#drop)"><circle cx="-150" cy="0" r="110" fill="#5b6378"/><circle cx="0" cy="-60" r="150" fill="#6b7389"/><circle cx="160" cy="0" r="120" fill="#5b6378"/>
    <rect x="-260" y="0" width="530" height="110" rx="55" fill="#4d5468"/></g></g>`;
}

// ---------------------------------------------------------------- light
export function bulb(x, y, s = 1, on = 1, t = 0) {
  return `<g transform="${T(x, y, s)}">${on > 0 ? `<circle r="260" fill="#ffd27a" opacity="${0.25 * on}" filter="url(#blur8)"/><circle r="160" fill="#ffe8a8" opacity="${0.3 * on}"/>` : ''}
    <path d="M -90 40 C -150 -20 -130 -170 0 -180 C 130 -170 150 -20 90 40 C 70 60 60 80 60 110 L -60 110 C -60 80 -70 60 -90 40 Z" fill="${on > 0.5 ? '#fff4c2' : '#59607a'}" opacity="0.95"/>
    <path d="M -30 100 L -30 20 L -10 -30 L 10 20 L 30 -30 L 30 100" fill="none" stroke="${on > 0.5 ? '#ff9a2e' : '#2a2e3b'}" stroke-width="8" stroke-linejoin="round"/>
    <rect x="-66" y="110" width="132" height="34" rx="8" fill="#b9bfcc"/><rect x="-60" y="148" width="120" height="30" rx="8" fill="#9aa1b2"/><rect x="-36" y="182" width="72" height="26" rx="10" fill="#6b7285"/></g>`;
}
export function floorLamp(x, y, s = 1, on = 1) {
  return `<g transform="${T(x, y, s)}">${on > 0 ? `<path d="M -90 -520 L 90 -520 L 300 0 L -300 0 Z" fill="#ffe2a0" opacity="${0.18 * on}"/>` : ''}
    <rect x="-8" y="-560" width="16" height="560" fill="#2a2e3b"/><ellipse cx="0" cy="0" rx="90" ry="20" fill="#2a2e3b"/>
    <path d="M -110 -540 L 110 -540 L 70 -680 L -70 -680 Z" fill="${on > 0.5 ? '#ffe8b0' : '#6b6480'}"/>
    ${on > 0.5 ? `<ellipse cx="0" cy="-540" rx="110" ry="18" fill="#fff6d8"/>` : ''}</g>`;
}
export function candle(x, y, s = 1, t = 0, lit = 1, seed = 0) {
  const fl = 1 + 0.12 * Math.sin(t * 13 + seed * 3) + 0.08 * Math.sin(t * 29 + seed), sway = 4 * Math.sin(t * 7 + seed);
  return `<g transform="${T(x, y, s)}">
    ${lit ? `<circle cx="0" cy="-210" r="${150 * fl}" fill="#ffb347" opacity="${0.2 * lit}" filter="url(#blur8)"/>` : ''}
    <rect x="-36" y="-160" width="72" height="160" rx="10" fill="#f4ecd8"/><path d="M -36 -150 q 18 30 0 60" stroke="#e5d9bd" stroke-width="10" fill="none"/>
    <ellipse cx="0" cy="-160" rx="36" ry="10" fill="#fff8e6"/><rect x="-3" y="-182" width="6" height="24" fill="#3a2a1a"/>
    ${lit ? `<g transform="translate(0 -184) scale(${lit} ${fl * lit})"><path d="M 0 -70 C ${22 + sway} -30 22 0 0 6 C -22 0 ${-22 + sway} -30 0 -70 Z" fill="#ffb02e"/>
    <path d="M 0 -44 C 10 -22 10 -4 0 2 C -10 -4 -10 -22 0 -44 Z" fill="#fff3b0"/></g>` : ''}
    <ellipse cx="0" cy="2" rx="60" ry="14" fill="#c9b48a"/></g>`;
}
export function boardGame(x, y, s = 1, t = 0) {
  let sq = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    const x0 = -240 + c * 80 + r * 20, y0 = -100 + r * 26;
    sq += `<path d="M ${x0} ${y0} L ${x0 + 80} ${y0} L ${x0 + 100} ${y0 + 26} L ${x0 + 20} ${y0 + 26} Z" fill="${(r + c) % 2 ? '#e94f4f' : '#fff3dc'}"/>`;
  }
  const hop = Math.abs(Math.sin(t * 4)) * 24;
  return `<g transform="${T(x, y, s)}"><rect x="-420" y="0" width="840" height="34" rx="10" fill="url(#woodTop)"/><rect x="-380" y="34" width="760" height="230" fill="${C.woodD}"/>
    <path d="M -260 -110 L 240 -110 L 300 4 L -200 4 Z" fill="#2a63c9"/>${sq}
    <g transform="translate(-60 ${-70 - hop})"><circle r="16" fill="${C.yellow}"/><rect x="-12" y="10" width="24" height="26" rx="6" fill="${C.yellow}"/></g>
    <g transform="translate(110 -40)"><circle r="16" fill="${C.teal}"/><rect x="-12" y="10" width="24" height="26" rx="6" fill="${C.teal}"/></g>
    <g transform="translate(330 -26) rotate(${t * 40})"><rect x="-26" y="-26" width="52" height="52" rx="10" fill="#fff"/><circle cx="-10" cy="-10" r="6" fill="${C.ink}"/><circle cx="10" cy="10" r="6" fill="${C.ink}"/><circle r="6" fill="${C.ink}"/></g></g>`;
}

// ---------------------------------------------------------------- the grid
export function pylon(x, y, s = 1, { on = 1 } = {}) {
  const st = '#c3c9d6', w = 9;
  let br = '';
  for (let i = 0; i < 7; i++) {
    const y0 = -i * 80, y1 = -(i + 1) * 80, a0 = lerp(120, 34, i / 7), a1 = lerp(120, 34, (i + 1) / 7);
    br += `<path d="M ${-a0} ${y0} L ${a1} ${y1} M ${a0} ${y0} L ${-a1} ${y1} M ${-a1} ${y1} L ${a1} ${y1}" stroke="${st}" stroke-width="${w - 3}"/>`;
  }
  const ins = (ix, iy) => `<rect x="${ix - 7}" y="${iy}" width="14" height="44" rx="5" fill="#8a6a4a"/>${on > 0.5 ? `<circle cx="${ix}" cy="${iy + 44}" r="7" fill="#7fe8ff" filter="url(#glow)"/>` : ''}`;
  return `<g transform="${T(x, y, s)}">
    <path d="M -120 0 L -34 -560 L 0 -680 L 34 -560 L 120 0" fill="none" stroke="${st}" stroke-width="${w}" stroke-linejoin="round"/>${br}
    <path d="M -230 -560 L 230 -560 M -190 -460 L 190 -460 M -230 -560 L -34 -620 M 230 -560 L 34 -620" stroke="${st}" stroke-width="${w}"/>
    ${ins(-220, -560)}${ins(220, -560)}${ins(-180, -460)}${ins(180, -460)}</g>`;
}
// the wires between two pylons drawn with pylon(x, y, s): attach points are at the insulator tips
export function pylonWires(xa, xb, y, s = 1, t = 0, on = 1) {
  const pts = [[-220, -516], [220, -516], [-180, -416], [180, -416]];
  return pts.map(([dx, dy], i) => {
    const x0 = xa + dx * s, x1 = xb + dx * s, yy = y + dy * s, sag = 60 * s;
    const p = (t * 0.8 + i * 0.27) % 1, bx = lerp(x0, x1, p), by = yy + 4 * sag * p * (1 - p);
    return `<path d="M ${x0} ${yy} Q ${(x0 + x1) / 2} ${yy + 2 * sag} ${x1} ${yy}" fill="none" stroke="${on > 0.5 ? '#7fe8ff' : '#3a4060'}" stroke-width="4" opacity="0.9"/>
      ${on > 0.5 ? `<circle cx="${bx}" cy="${by}" r="9" fill="#fff" filter="url(#glow)"/>` : ''}`;
  }).join('');
}
// a patchwork map of 9 regions joined by power lines. lit: array of 9 values 0..1
const GV = (r, c) => [-380 + c * 253 + (r % 3 && c % 3 ? (hash(r, c) - 0.5) * 110 : 0), -320 + r * 213 + (r % 3 && c % 3 ? (hash(c, r + 5) - 0.5) * 90 : 0)];
export function gridMap(x, y, s = 1, t = 0, lit = []) {
  let cells = '', lines = '', dots = '';
  const ctr = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const i = r * 3 + c, L = clamp(lit[i] ?? 0), v = [GV(r, c), GV(r, c + 1), GV(r + 1, c + 1), GV(r + 1, c)];
    const cx = v.reduce((a, p) => a + p[0], 0) / 4, cy = v.reduce((a, p) => a + p[1], 0) / 4;
    ctr.push([cx, cy, L]);
    cells += `<path d="M ${v.map((p) => p.join(' ')).join(' L ')} Z" fill="${L > 0.5 ? '#2f4a8c' : '#1a2140'}" stroke="#0b1026" stroke-width="12" stroke-linejoin="round"/>
      ${L > 0 ? `<path d="M ${v.map((p) => p.join(' ')).join(' L ')} Z" fill="#ffd27a" opacity="${0.22 * L}"/>` : ''}`;
    for (let k = 0; k < 4; k++) {
      const dx = cx + (hash(i, k) - 0.5) * 150, dy = cy + (hash(k, i + 3) - 0.5) * 120;
      dots += L > 0.3 ? `<circle cx="${dx}" cy="${dy}" r="${9 + 4 * Math.sin(t * 4 + i + k)}" fill="#ffe38a" opacity="${L}" filter="url(#glow)"/>` : `<circle cx="${dx}" cy="${dy}" r="7" fill="#39406a"/>`;
    }
  }
  const links = [[0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8], [0, 3], [3, 6], [1, 4], [4, 7], [2, 5], [5, 8]];
  links.forEach(([a, b], j) => {
    const A = ctr[a], B = ctr[b], on = Math.min(A[2], B[2]) > 0.5;
    lines += `<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${on ? '#7fe8ff' : '#3a4060'}" stroke-width="6" stroke-dasharray="${on ? '0' : '14 12'}"/>`;
    if (on) { const p = (t * 0.9 + j * 0.19) % 1; lines += `<circle cx="${lerp(A[0], B[0], p)}" cy="${lerp(A[1], B[1], p)}" r="9" fill="#fff" filter="url(#glow)"/>`; }
  });
  const towers = ctr.map(([cx, cy, L]) => `<g transform="translate(${cx} ${cy}) scale(0.11)">${pylon(0, 300, 1, { on: L })}</g>`).join('');
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-420" y="-360" width="840" height="720" rx="40" fill="#0b1026"/></g>${cells}${lines}${dots}${towers}</g>`;
}
export function calendar30(x, y, s = 1, t = 0, crossed = 0, title = '30 DAYS') {
  let cells = '';
  for (let i = 0; i < 30; i++) {
    const cx = -280 + (i % 6) * 112, cy = -110 + Math.floor(i / 6) * 100, on = i < crossed, last = i === Math.ceil(crossed) - 1;
    cells += `<g transform="translate(${cx} ${cy}) scale(${last ? 1.12 : 1})"><rect x="-48" y="-42" width="96" height="84" rx="16" fill="${on ? '#ffe1dc' : '#fff'}"/>
      <text y="16" font-family="MontB" font-weight="900" font-size="40" fill="${C.ink}" text-anchor="middle">${i + 1}</text>
      ${on ? `<path d="M -30 -26 L 30 26 M 30 -26 L -30 26" stroke="${C.red}" stroke-width="11" stroke-linecap="round"/>` : ''}</g>`;
  }
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-380" y="-300" width="760" height="680" rx="44" fill="#eef1f8"/></g>
    <rect x="-380" y="-300" width="760" height="130" rx="44" fill="${C.coral}"/><rect x="-380" y="-220" width="760" height="50" fill="${C.coral}"/>
    ${txt(0, -212, 62, '#fff', title)}
    <rect x="-250" y="-330" width="22" height="70" rx="11" fill="#5b6170"/><rect x="228" y="-330" width="22" height="70" rx="11" fill="#5b6170"/>${cells}</g>`;
}
// round icons for the "step by step" road map
export function icon(kind, x, y, s = 1, t = 0) {
  const g = (inner) => `<g transform="${T(x, y, s)}"><circle r="62" fill="#fff" filter="url(#soft)"/>${inner}</g>`;
  if (kind === 'candle') return g(`<rect x="-14" y="-10" width="28" height="44" rx="5" fill="#e5d9bd"/><path d="M 0 -44 C 14 -26 12 -14 0 -12 C -12 -14 -14 -26 0 -44 Z" fill="#ffb02e"/>`);
  if (kind === 'battery') return g(`<rect x="-38" y="-20" width="70" height="40" rx="8" fill="none" stroke="${C.ink}" stroke-width="7"/><rect x="34" y="-9" width="8" height="18" rx="3" fill="${C.ink}"/><rect x="-30" y="-12" width="14" height="24" rx="3" fill="${C.red}"/>`);
  if (kind === 'fridge') return g(`<rect x="-26" y="-42" width="52" height="84" rx="10" fill="#9aa8c2"/><line x1="-26" y1="-8" x2="26" y2="-8" stroke="#fff" stroke-width="5"/><rect x="14" y="-34" width="5" height="18" rx="2" fill="#fff"/><rect x="14" y="2" width="5" height="24" rx="2" fill="#fff"/>`);
  if (kind === 'tap') return g(`<path d="M -34 -20 L 10 -20 Q 30 -20 30 0 L 30 8" stroke="#8e94a6" stroke-width="14" fill="none" stroke-linecap="round"/><rect x="-10" y="-38" width="12" height="20" fill="#8e94a6"/><path d="M 30 24 q 7 12 0 18 q -7 -6 0 -18 Z" fill="${C.blue}"/>`);
  if (kind === 'hospital') return g(`<rect x="-14" y="-40" width="28" height="80" rx="6" fill="${C.red}"/><rect x="-40" y="-14" width="80" height="28" rx="6" fill="${C.red}"/>`);
  if (kind === 'people') return g(`<circle cx="-20" cy="-16" r="14" fill="${C.coral}"/><rect x="-36" y="2" width="32" height="34" rx="12" fill="${C.coral}"/><circle cx="20" cy="-16" r="14" fill="${C.teal}"/><rect x="4" y="2" width="32" height="34" rx="12" fill="${C.teal}"/>`);
  if (kind === 'bulb') return g(`<path d="M -24 8 C -42 -8 -36 -44 0 -46 C 36 -44 42 -8 24 8 L 22 20 L -22 20 Z" fill="${C.yellow}"/><rect x="-18" y="24" width="36" height="16" rx="5" fill="#8e94a6"/>`);
  return I.icon(kind, x, y, s);
}

// ---------------------------------------------------------------- the phone and the towers
export function screenBattery(t, u, pct = 10) {
  const k = ease.back((u - 0.15) / 0.3), blink = Math.floor(t * 3) % 2;
  return `<rect x="-176" y="-376" width="352" height="752" fill="url(#lockWall)"/><rect x="-176" y="-376" width="352" height="752" fill="#000" opacity="0.35"/>
    ${I.statusBar({})}<rect x="113" y="-339" width="5" height="12" fill="${C.red}"/>
    <text x="0" y="-170" font-family="InterW" font-weight="800" font-size="96" fill="#fff" text-anchor="middle" letter-spacing="-3">9:14</text>
    <g transform="translate(0 -10)"><rect x="-110" y="-56" width="200" height="112" rx="22" fill="none" stroke="#fff" stroke-width="10"/><rect x="96" y="-22" width="18" height="44" rx="6" fill="#fff"/>
    <rect x="-96" y="-42" width="${172 * pct / 100}" height="84" rx="12" fill="${C.red}" opacity="${blink ? 1 : 0.5}"/></g>
    <text x="0" y="110" font-family="MontB" font-weight="900" font-size="64" fill="${C.red}" text-anchor="middle">${pct}%</text>
    <g transform="translate(0 250) scale(${k})" opacity="${clamp((u - 0.15) * 6)}"><rect x="-160" y="-80" width="320" height="160" rx="26" fill="#f2f3f7"/>
    <text y="-30" font-family="InterW" font-weight="800" font-size="24" fill="${C.ink}" text-anchor="middle">Low Battery</text>
    <text y="4" font-family="InterW" font-weight="600" font-size="18" fill="#555" text-anchor="middle">${pct}% battery remaining</text>
    <line x1="-160" y1="30" x2="160" y2="30" stroke="#d0d3dc" stroke-width="2"/><text x="-80" y="64" font-family="InterW" font-weight="700" font-size="19" fill="${C.blue}" text-anchor="middle">Close</text>
    <text x="80" y="64" font-family="InterW" font-weight="700" font-size="19" fill="${C.blue}" text-anchor="middle">Low Power</text></g>`;
}
export function cellTower(x, y, s = 1, t = 0, { batt = 1, signal = 1 } = {}) {
  const st = '#c3c9d6';
  let br = '';
  for (let i = 0; i < 8; i++) { const y0 = -i * 90, y1 = y0 - 90, a0 = lerp(80, 22, i / 8), a1 = lerp(80, 22, (i + 1) / 8); br += `<path d="M ${-a0} ${y0} L ${a1} ${y1} M ${a0} ${y0} L ${-a1} ${y1}" stroke="${st}" stroke-width="6"/>`; }
  const waves = signal > 0.05 ? [0, 1, 2].map((i) => { const p = (t * 0.9 + i / 3) % 1, r = 60 + p * 260; return `<path d="M ${-r} ${-760 - r * 0.6} A ${r} ${r} 0 0 1 ${r} ${-760 - r * 0.6}" fill="none" stroke="#7fe8ff" stroke-width="10" stroke-linecap="round" opacity="${signal * (1 - p)}" transform="translate(0 ${r * 0.6})"/>`; }).join('') : '';
  const bc = batt > 0.5 ? C.green : batt > 0.2 ? C.yellow : C.red;
  return `<g transform="${T(x, y, s)}">${waves}
    <path d="M -80 0 L -22 -720 L 22 -720 L 80 0" fill="none" stroke="${st}" stroke-width="10" stroke-linejoin="round"/>${br}
    ${[-1, 1].map((d) => `<rect x="${d * 40 - 18}" y="-800" width="36" height="110" rx="8" fill="#e9ecf3"/>`).join('')}<rect x="-18" y="-830" width="36" height="120" rx="8" fill="#f6f7fb"/>
    <circle cx="0" cy="-850" r="10" fill="${C.red}" opacity="${0.4 + 0.6 * (Math.floor(t * 2) % 2)}"/>
    <g transform="translate(250 -10)"><g filter="url(#drop)"><rect x="-130" y="-260" width="260" height="260" rx="20" fill="#d9dde8"/></g>
      <rect x="-90" y="-210" width="160" height="90" rx="14" fill="none" stroke="${C.ink}" stroke-width="10"/><rect x="72" y="-182" width="14" height="34" rx="5" fill="${C.ink}"/>
      <rect x="-78" y="-198" width="${136 * clamp(batt)}" height="66" rx="8" fill="${bc}"/>
      <text y="-60" font-family="MontB" font-weight="900" font-size="34" fill="${C.ink}" text-anchor="middle">BACKUP</text></g></g>`;
}

// ---------------------------------------------------------------- the kitchen
export function fridge(x, y, s = 1, t = 0, { open = 0, spoil = 0 } = {}) {
  const food = (gc, fc) => spoil > 0.3 ? gc : fc;
  const flies = spoil > 0.4 ? [0, 1, 2, 3].map((i) => { const a = t * (3 + i) + i * 2; return `<circle cx="${Math.cos(a) * (80 + i * 20)}" cy="${-260 + Math.sin(a * 1.3) * 60}" r="7" fill="#111"/>`; }).join('') : '';
  const stink = spoil > 0.2 ? [0, 1, 2].map((i) => { const p = (t * 0.7 + i / 3) % 1; return `<path d="M ${-120 + i * 110} ${-80 - p * 220} q 20 -25 0 -50 q -20 -25 0 -50" fill="none" stroke="#9be564" stroke-width="10" stroke-linecap="round" opacity="${spoil * (1 - p)}"/>`; }).join('') : '';
  const inside = `<rect x="-200" y="-460" width="400" height="760" rx="20" fill="#2a3352"/>
    ${[-260, -60, 140].map((yy) => `<rect x="-190" y="${yy}" width="380" height="12" rx="5" fill="#8fa0c4"/>`).join('')}
    <rect x="-160" y="-420" width="70" height="150" rx="8" fill="${food('#d8e8b0', '#fff')}"/><rect x="-160" y="-420" width="70" height="40" fill="${C.blue}"/>
    <path d="M -40 -270 L 90 -270 L 90 -340 Z" fill="${food('#b8c96a', C.yellow)}"/>
    <circle cx="140" cy="-300" r="34" fill="${food('#8a6a3a', C.red)}"/>
    <ellipse cx="-90" cy="-100" rx="90" ry="38" fill="${food('#9a9a5a', '#e8a462')}"/><ellipse cx="80" cy="-100" rx="70" ry="40" fill="${food('#6a8a3a', '#5fbf4f')}"/>
    <rect x="-150" y="70" width="110" height="70" rx="12" fill="${food('#7a8a6a', '#ff8fa3')}"/><rect x="20" y="40" width="120" height="100" rx="14" fill="${food('#8a9a6a', '#ffcf6b')}"/>
    ${spoil > 0.3 ? [0, 1, 2, 3, 4].map((i) => `<circle cx="${-140 + i * 70}" cy="${-110 + (i % 2) * 180}" r="${10 + 8 * spoil}" fill="#7bbf3a" opacity="0.8"/>`).join('') : ''}`;
  const doorW = 400 * (1 - 0.82 * ease.inOut(open));
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-220" y="-480" width="440" height="800" rx="34" fill="#e9edf5"/></g>${inside}${stink}${flies}
    <g><rect x="${200 - doorW + (open ? 30 : 0)}" y="-480" width="${doorW + 20}" height="800" rx="30" fill="#f6f8fc" stroke="#cfd5e2" stroke-width="4"/>
    ${open < 0.5 ? `<line x1="-210" y1="-180" x2="210" y2="-180" stroke="#cfd5e2" stroke-width="6"/><rect x="${160}" y="-420" width="16" height="140" rx="8" fill="#b9c0d0"/><rect x="160" y="-130" width="16" height="200" rx="8" fill="#b9c0d0"/>` : ''}</g>
    <rect x="-180" y="320" width="40" height="24" fill="#8a93a8"/><rect x="140" y="320" width="40" height="24" fill="#8a93a8"/></g>`;
}
// thermometer with °C and °F; v 0..1 maps 4°C → 25°C
export function thermometer(x, y, s = 1, v = 0) {
  const c = Math.round(lerp(4, 25, v)), f = Math.round(c * 9 / 5 + 32), h = 380 * (0.12 + 0.88 * v);
  return `<g transform="${T(x, y, s)}"><rect x="-40" y="-430" width="80" height="460" rx="40" fill="#fff" filter="url(#soft)"/><circle cy="40" r="66" fill="#fff"/>
    <rect x="-18" y="${-10 - h}" width="36" height="${h + 20}" rx="18" fill="${v > 0.5 ? C.red : C.blue}"/><circle cy="40" r="46" fill="${v > 0.5 ? C.red : C.blue}"/>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="22" y="${-60 - i * 80}" width="16" height="6" fill="#9aa1b2"/>`).join('')}
    <g transform="translate(150 ${-10 - h})"><rect x="-90" y="-50" width="200" height="100" rx="24" fill="${v > 0.5 ? C.red : C.blue}"/>
    <text x="10" y="-4" font-family="MontB" font-weight="900" font-size="44" fill="#fff" text-anchor="middle">${c}°C</text><text x="10" y="34" font-family="MontB" font-weight="900" font-size="30" fill="#fff" opacity="0.85" text-anchor="middle">${f}°F</text></g></g>`;
}
export function gasPump(x, y, s = 1, t = 0, { sign = 1, plug = 0 } = {}) {
  const k = ease.back(sign / 1);
  return `<g transform="${T(x, y, s)}"><rect x="-260" y="0" width="520" height="40" rx="10" fill="#9aa3b8"/>
    <g filter="url(#drop)"><rect x="-170" y="-640" width="340" height="640" rx="30" fill="${C.red}"/></g><rect x="-170" y="-640" width="340" height="90" rx="30" fill="#c0392b"/>
    ${txt(0, -578, 50, '#fff', 'GAS')}
    <rect x="-120" y="-510" width="240" height="150" rx="16" fill="#0b0d14"/><text x="0" y="-420" font-family="InterW" font-weight="800" font-size="40" fill="#2a2e3b" text-anchor="middle">- - - -</text>
    ${[0, 1, 2].map((i) => `<rect x="${-110 + i * 80}" y="-330" width="60" height="44" rx="10" fill="#fff" opacity="0.85"/>`).join('')}
    <rect x="170" y="-470" width="50" height="160" rx="14" fill="#2a2e3b"/><path d="M 195 -320 C 260 -200 250 -60 160 -30" stroke="#2a2e3b" stroke-width="22" fill="none"/>
    <g transform="translate(0 -360) rotate(-12) scale(${k})" opacity="${clamp(sign * 5)}"><rect x="-230" y="-70" width="460" height="140" rx="10" fill="#fff8d6" filter="url(#soft)"/>
    <rect x="-200" y="-90" width="70" height="30" fill="#e8dcae" opacity="0.8" transform="rotate(-20 -165 -75)"/><rect x="130" y="-90" width="70" height="30" fill="#e8dcae" opacity="0.8" transform="rotate(20 165 -75)"/>
    ${txt(0, -8, 54, C.ink, 'OUT OF')}${txt(0, 50, 54, C.red, 'ORDER')}</g>
    ${plug ? `<g transform="translate(-300 -120)" opacity="${clamp(plug * 4)}"><path d="M 130 120 C 60 120 40 60 0 40" stroke="#1a1d27" stroke-width="16" fill="none"/>
      <rect x="-50" y="10" width="70" height="60" rx="12" fill="#1a1d27"/><rect x="-68" y="20" width="22" height="10" rx="3" fill="#c3c9d6"/><rect x="-68" y="50" width="22" height="10" rx="3" fill="#c3c9d6"/>
      <path d="M -120 -60 L -150 0 L -125 0 L -140 60 L -95 -10 L -120 -10 L -100 -60 Z" fill="${C.yellow}" opacity="${0.5 + 0.5 * Math.abs(Math.sin(t * 9))}"/></g>` : ''}</g>`;
}
export function tap(x, y, s = 1, t = 0, flow = 1) {
  const w = 34 * flow;
  let water = '';
  if (flow > 0.12) water = `<path d="M ${172 - w / 2} 26 L ${172 + w / 2} 26 L ${172 + w / 2 + 4} 330 L ${172 - w / 2 - 4} 330 Z" fill="#7fc6ff" opacity="0.9"/>
    ${[0, 1, 2, 3].map((i) => { const p = (t * 3 + i / 4) % 1; return `<rect x="${172 - w / 4}" y="${40 + p * 280}" width="${w / 2}" height="30" rx="${w / 4}" fill="#fff" opacity="0.5"/>`; }).join('')}
    <ellipse cx="172" cy="330" rx="${40 + 50 * flow}" ry="14" fill="#7fc6ff" opacity="0.8"/>`;
  else water = [0, 1].map((i) => { const p = ((t * 0.9 + i * 0.5) % 1); return `<path d="M 172 ${40 + p * p * 300} q 12 20 0 30 q -12 -10 0 -30 Z" fill="#7fc6ff" opacity="${p < 0.95 ? 1 : 0}"/>`; }).join('');
  return `<g transform="${T(x, y, s)}"><rect x="-420" y="330" width="840" height="60" rx="14" fill="#dfe4ee"/><path d="M -340 360 L 340 360 L 300 560 L -300 560 Z" fill="#c3cad8"/>
    <ellipse cx="0" cy="360" rx="330" ry="34" fill="#9aa3b8"/>${water}
    <g filter="url(#soft)"><rect x="-120" y="250" width="120" height="90" rx="14" fill="#b9c0d0"/><path d="M -60 260 L -60 -40 Q -60 -120 40 -120 L 120 -120 Q 172 -120 172 -60 L 172 20" stroke="#c9d0de" stroke-width="56" fill="none" stroke-linecap="round"/>
    <rect x="-150" y="150" width="180" height="40" rx="20" fill="#9aa3b8"/></g></g>`;
}
export function pumpStation(x, y, s = 1, t = 0, { spin = 0, off = 0 } = {}) {
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-190" y="-320" width="380" height="320" rx="16" fill="#6b7aa8"/></g><path d="M -220 -310 L 0 -420 L 220 -310 Z" fill="#4a5a88"/>
    ${txt(0, -260, 40, '#fff', 'WATER PUMP')}
    <g transform="translate(0 -120) rotate(${spin})"><circle r="96" fill="#2a3352"/>${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M 0 0 L ${Math.cos(i) * 80} ${Math.sin(i) * 80}" stroke="#9fd2ff" stroke-width="22" stroke-linecap="round" transform="rotate(${i * 60 - Math.cos(i) * 0})"/>`).join('')}<circle r="22" fill="#c3c9d6"/></g>
    ${off ? `<g transform="translate(150 -380)" opacity="${clamp(off * 4)}"><circle r="62" fill="${C.red}" filter="url(#soft)"/><path d="M 6 -40 L -24 6 L 0 6 L -10 40 L 24 -8 L 0 -8 Z" fill="#fff"/></g>` : ''}</g>`;
}

// ---------------------------------------------------------------- hospital and generators
export function hospital(x, y, s = 1, t = 0, lit = 1) {
  let win = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { if (r === 3 && (c === 2 || c === 3)) continue; const on = hash(r * 6 + c, 5) < lit; win += `<rect x="${-300 + c * 104}" y="${-560 + r * 120}" width="70" height="80" rx="8" fill="${on ? '#ffe7a6' : '#2a3352'}"/>`; }
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-340" y="-620" width="680" height="620" rx="14" fill="#eef1f8"/></g>
    <rect x="-130" y="-770" width="260" height="170" rx="20" fill="#eef1f8"/><rect x="-26" y="-750" width="52" height="130" rx="8" fill="${C.red}"/><rect x="-65" y="-711" width="130" height="52" rx="8" fill="${C.red}"/>
    ${win}<rect x="-110" y="-170" width="220" height="170" rx="10" fill="#9fd2ff"/><line x1="0" y1="-170" x2="0" y2="0" stroke="#6b8ab8" stroke-width="6"/>
    <rect x="-200" y="-230" width="400" height="44" rx="10" fill="${C.blue}"/>${txt(0, -195, 34, '#fff', 'HOSPITAL')}</g>`;
}
export function generator(x, y, s = 1, t = 0, run = 1) {
  const sh = run ? I.wobble(t, 30, 3) : 0;
  const puffs = run ? [0, 1, 2, 3].map((i) => { const p = (t * 0.8 + i / 4) % 1; return `<circle cx="${190 + p * 80}" cy="${-260 - p * 260}" r="${20 + p * 50}" fill="#9aa1b2" opacity="${0.55 * (1 - p)}"/>`; }).join('') : '';
  return `<g transform="${T(x + sh, y, s)}">${puffs}<rect x="170" y="-280" width="36" height="110" rx="8" fill="#5b6170"/>
    <g filter="url(#drop)"><rect x="-260" y="-200" width="520" height="200" rx="26" fill="${C.yellow}"/></g><rect x="-260" y="-200" width="520" height="50" rx="20" fill="#e8b92e"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${-220 + i * 40}" y="-120" width="22" height="90" rx="8" fill="#c99a1e"/>`).join('')}
    <rect x="50" y="-130" width="170" height="90" rx="12" fill="#2a2e3b"/><circle cx="90" cy="-85" r="16" fill="${run ? C.green : C.red}"/>${txt(160, -72, 30, '#fff', run ? 'ON' : 'OFF')}
    <circle cx="-180" cy="10" r="40" fill="#2a2e3b"/><circle cx="180" cy="10" r="40" fill="#2a2e3b"/></g>`;
}
export function fuelTank(x, y, s = 1, v = 1, label = '') {
  const h = 480 * clamp(v), col = v > 0.5 ? C.green : v > 0.2 ? C.yellow : C.red;
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-120" y="-540" width="240" height="560" rx="40" fill="#2a2e3b"/></g>
    <rect x="-90" y="${-10 - h}" width="180" height="${h}" rx="22" fill="${col}"/>
    ${[1, 2, 3].map((i) => `<rect x="-120" y="${-10 - i * 120}" width="40" height="8" fill="#fff" opacity="0.6"/>`).join('')}
    ${txt(0, -570, 50, '#fff', 'FUEL')}${label ? outlined(0, 130, 90, '#fff', label) : ''}</g>`;
}

// ---------------------------------------------------------------- restarting it
export function hardHat(x, y, s = 1) {
  // put on a person() drawn at the same x, y, s in a standing pose
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M -58 -410 C -58 -470 58 -470 58 -410 Z" fill="${C.yellow}"/><rect x="-72" y="-418" width="144" height="16" rx="8" fill="#e8b92e"/><rect x="-8" y="-462" width="16" height="50" rx="6" fill="#e8b92e"/></g>`;
}
export function vest(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-62" y="-320" width="124" height="150" rx="40" fill="#ff8a1e"/><rect x="-62" y="-240" width="124" height="16" fill="#e9ecf3"/><rect x="-62" y="-200" width="124" height="16" fill="#e9ecf3"/></g>`;
}
export function bigSwitch(x, y, s = 1, pull = 0, t = 0) {
  const a = lerp(-40, 40, ease.inOut(pull));
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-260" y="-360" width="520" height="640" rx="30" fill="#5b6378"/></g><rect x="-230" y="-330" width="460" height="580" rx="20" fill="#47506a"/>
    ${txt(0, -260, 44, '#fff', 'MAIN POWER')}<rect x="-40" y="-120" width="80" height="240" rx="20" fill="#2a2e3b"/>
    <g transform="rotate(${a} 0 0)"><rect x="-18" y="-280" width="36" height="290" rx="18" fill="#c3c9d6"/><rect x="-80" y="-320" width="160" height="70" rx="35" fill="${C.red}"/></g>
    <circle r="40" fill="#8e94a6"/>${txt(-150, 200, 40, C.green, 'ON')}${txt(150, 200, 40, C.red, 'OFF')}
    <g fill="${C.yellow}">${[0, 1, 2].map((i) => `<path d="M ${-180 + i * 180} 260 l 30 -20 l 0 40 Z" opacity="0.4"/>`).join('')}</g></g>`;
}
export function transformer(x, y, s = 1, t = 0) {
  const fins = [...Array(9)].map((_, i) => `<rect x="${-330 + i * 10}" y="-420" width="6" height="360" fill="#7a8296"/><rect x="${244 + i * 10}" y="-420" width="6" height="360" fill="#7a8296"/>`).join('');
  const bushing = (bx, h) => `<g transform="translate(${bx} -520)">${[...Array(6)].map((_, i) => `<ellipse cy="${-i * (h / 6)}" rx="34" ry="12" fill="#a0583a"/>`).join('')}<rect x="-14" y="${-h - 20}" width="28" height="${h}" fill="#8a4a30"/><circle cy="${-h - 26}" r="14" fill="#c3c9d6"/></g>`;
  return `<g transform="${T(x, y, s)}"><rect x="-380" y="-20" width="760" height="40" rx="10" fill="#5b6170"/>
    ${fins}<g filter="url(#drop)"><rect x="-240" y="-520" width="480" height="500" rx="20" fill="#9aa3b8"/></g>
    <rect x="-200" y="-470" width="400" height="60" rx="10" fill="#7a8296"/>${bushing(-140, 150)}${bushing(0, 190)}${bushing(140, 150)}
    <rect x="-140" y="-330" width="280" height="140" rx="12" fill="${C.yellow}"/>${txt(0, -268, 34, C.ink, '⚡ HIGH')}${txt(0, -222, 34, C.ink, 'VOLTAGE')}</g>`;
}
export function hourglass(x, y, s = 1, t = 0) {
  const p = (t * 0.35) % 1, rot = p > 0.9 ? (p - 0.9) * 10 * 180 : 0;
  return `<g transform="${T(x, y, s, rot)}"><rect x="-120" y="-200" width="240" height="30" rx="12" fill="${C.wood}"/><rect x="-120" y="170" width="240" height="30" rx="12" fill="${C.wood}"/>
    <path d="M -90 -170 L 90 -170 Q 90 -60 12 0 Q 90 60 90 170 L -90 170 Q -90 60 -12 0 Q -90 -60 -90 -170 Z" fill="#dff1ff" opacity="0.6" stroke="#fff" stroke-width="6"/>
    <path d="M ${-70 * (1 - p)} ${-150 + 140 * p} L ${70 * (1 - p)} ${-150 + 140 * p} L 0 -10 Z" fill="${C.yellow}"/>
    <path d="M -80 165 L 80 165 L ${70 * (1 - p) + 10} ${165 - 120 * p} L ${-70 * (1 - p) - 10} ${165 - 120 * p} Z" fill="${C.yellow}"/>
    <rect x="-3" y="-10" width="6" height="${175 - 120 * p}" fill="${C.yellow}"/></g>`;
}

// ---------------------------------------------------------------- it happened before
export function paper(x, y, s = 1, rot = 0, { date = '', h1 = '', h2 = '', art = '' } = {}) {
  return `<g transform="${T(x, y, s, rot)}"><g filter="url(#drop)"><rect x="-340" y="-420" width="680" height="840" rx="12" fill="#f3efe4"/></g>
    <text y="-330" font-family="Garamond" font-weight="600" font-size="72" fill="#222" text-anchor="middle">THE DAILY NEWS</text>
    <rect x="-300" y="-305" width="600" height="6" fill="#222"/><text x="-300" y="-260" font-family="InterW" font-weight="700" font-size="24" fill="#555">${date}</text>
    ${txt(0, -150, 74, '#111', h1)}${txt(0, -70, 62, C.red, h2)}
    <g><rect x="-300" y="-20" width="300" height="220" fill="#1a2140"/>${art}</g>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="30" y="${-10 + i * 32}" width="${270 - (i % 3) * 30}" height="14" rx="7" fill="#bdb6a6"/>`).join('')}
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="-300" y="${240 + i * 32}" width="${600 - (i % 2) * 80}" height="14" rx="7" fill="#bdb6a6"/>`).join('')}</g>`;
}
const NA = [[-290, -170], [-230, -230], [-120, -250], [-20, -270], [60, -250], [120, -280], [200, -250], [230, -190], [262, -120], [190, -80], [172, -30], [142, 10], [120, 60], [112, 110], [132, 172], [92, 142], [40, 122], [-20, 132], [-40, 190], [-8, 246], [-40, 282], [-92, 232], [-142, 150], [-182, 80], [-212, 0], [-232, -80], [-272, -110]];
const IB = [[-262, -160], [-100, -192], [60, -172], [182, -128], [204, -60], [142, 0], [122, 70], [62, 142], [-40, 170], [-122, 150], [-202, 112], [-232, 40], [-252, -60], [-272, -120]];
const poly = (pts) => `M ${pts.map((p) => p.join(' ')).join(' L ')} Z`;
// a map with city lights; the lights inside the circle (dx, dy, r) go out as `dark` goes 0 → 1
function lightsMap(x, y, s, t, pts, land, { dark = 0, zone = [0, 0, 1e4], seed = 1, n = 40, extra = '' } = {}) {
  let lights = '';
  for (let i = 0; i < n; i++) {
    const lx = (hash(i, seed) - 0.5) * 560, ly = (hash(i, seed + 1) - 0.5) * 480;
    if (!inside(lx, ly, pts)) continue;
    const d = Math.hypot(lx - zone[0], ly - zone[1]), out = d < zone[2] && hash(i, seed + 2) < dark * 1.15;
    lights += `<circle cx="${lx}" cy="${ly}" r="${out ? 5 : 8 + 3 * Math.sin(t * 4 + i)}" fill="${out ? '#2a2e3b' : '#ffe38a'}" ${out ? '' : 'filter="url(#glow)"'}/>`;
  }
  return `<g transform="${T(x, y, s)}"><path d="${poly(pts)}" fill="${land}" stroke="#9fd2ff" stroke-width="5" stroke-linejoin="round" filter="url(#soft)"/>${extra}${lights}
    ${dark > 0 ? `<circle cx="${zone[0]}" cy="${zone[1]}" r="${zone[2]}" fill="#000" opacity="${0.35 * dark}"/><circle cx="${zone[0]}" cy="${zone[1]}" r="${zone[2]}" fill="none" stroke="${C.red}" stroke-width="8" stroke-dasharray="18 12" opacity="${dark}"/>` : ''}</g>`;
}
function inside(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export const mapNA = (x, y, s, t, dark) => lightsMap(x, y, s, t, NA, '#3f8f6a', { dark, zone: [130, -50, 95], seed: 3, n: 140, extra: `<ellipse cx="60" cy="-170" rx="52" ry="40" fill="#1f5fae"/>` });
export const mapIberia = (x, y, s, t, dark) => lightsMap(x, y, s, t, IB, '#c98f4a', { dark, zone: [-30, -10, 1e4], seed: 7, n: 110,
  extra: `<path d="M -172 -168 C -160 -100 -190 -20 -176 40 C -170 80 -190 110 -196 116" fill="none" stroke="#8a5a2a" stroke-width="6" stroke-dasharray="14 10"/>` });

// ---------------------------------------------------------------- lights coming back
// a skyline lit neighbourhood by neighbourhood: four groups of three buildings, k 0..1
export function cityBlocks(y, t = 0, k = 0, seed = 11) {
  const order = [1, 3, 0, 2];
  let s = '';
  for (let i = 0; i < 12; i++) {
    const w = 70 + (hash(i, seed) * 60) | 0, h = 180 + (hash(i, seed + 1) * 340) | 0, x = i * 92 - 20, g = Math.floor(i / 3);
    const L = clamp((k * 4 - order[g]) * 3);
    s += `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${L > 0.5 ? '#26336a' : '#141b3a'}"/>`;
    for (let r = 0; r < h / 46 - 1; r++) for (let c2 = 0; c2 < w / 30 - 1; c2++) {
      if (hash(i * 31 + r * 7 + c2, seed + 2) < 0.6 * L) s += `<rect x="${x + 10 + c2 * 30}" y="${y - h + 16 + r * 46}" width="16" height="22" rx="3" fill="#ffd27a" opacity="${0.75 + 0.25 * Math.sin(t * 2 + i + r)}"/>`;
    }
    if (L > 0 && L < 1) s += `<rect x="${x - 10}" y="${y - h - 10}" width="${w + 20}" height="${h + 10}" fill="#ffe8a8" opacity="${0.5 * (1 - L)}"/>`;
  }
  return s;
}
export function commentBox(x, y, s = 1, t = 0, u = 0, opts = ['1 day', '3 days', '1 week', 'A month']) {
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-400" y="-300" width="800" height="600" rx="50" fill="#fff"/></g>
    ${txt(0, -200, 58, C.ink, 'HOW LONG WOULD')}${txt(0, -130, 58, C.ink, 'YOU LAST?')}
    ${opts.map((o, i) => { const k = ease.back((u - 0.2 - i * 0.15) / 0.3); return `<g transform="translate(${-180 + (i % 2) * 360} ${-10 + Math.floor(i / 2) * 140}) scale(${k})"><rect x="-160" y="-50" width="320" height="100" rx="50" fill="${[C.coral, C.yellow, C.teal, C.blue][i]}"/>
      ${txt(0, 14, 40, '#fff', o)}</g>`; }).join('')}</g>`;
}
