// More of the flat illustration kit, for "What if AI became smarter than us?" (scenarios/ai-smarter.js).
// Same rules as ill2d.js: pure SVG strings from functions of time, canvas 1080 x 1920, subjects between y 400 and 1300.
import * as I from './ill2d.js';
import { txt, outlined } from './ill2d-grid.js';

const { C, ease, clamp, lerp, hash } = I;
const T = (x, y, s = 1, rot = 0) => `translate(${x} ${y}) rotate(${rot}) scale(${s})`;
export const PURPLE = '#8b5cf6', CYAN = '#22d3ee';

// ---------------------------------------------------------------- the AI itself
// a glowing chip with circuit traces; `on` 0..1 lights the traces from the centre out
export function chip(x, y, s = 1, t = 0, on = 1) {
  let traces = '';
  for (let i = 0; i < 16; i++) {
    const side = i % 4, k = Math.floor(i / 4), off = -90 + k * 60, len = 120 + hash(i, 2) * 160;
    const [x0, y0, dx, dy] = side === 0 ? [off, -150, 0, -1] : side === 1 ? [150, off, 1, 0] : side === 2 ? [off, 150, 0, 1] : [-150, off, -1, 0];
    const L = len * clamp(on * 1.4 - hash(i, 3) * 0.4), bend = hash(i, 4) > 0.5 ? 40 : -40;
    const x1 = x0 + dx * L * 0.6, y1 = y0 + dy * L * 0.6, x2 = x1 + dx * L * 0.4 + (dy ? bend : 0) * (L / len), y2 = y1 + dy * L * 0.4 + (dx ? bend : 0) * (L / len);
    traces += `<path d="M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2}" stroke="${CYAN}" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.85"/>`;
    if (L > 20) {
      traces += `<circle cx="${x2}" cy="${y2}" r="12" fill="${CYAN}" filter="url(#glow)"/>`;
      const p = (t * 0.9 + hash(i, 5)) % 1;
      traces += `<circle cx="${lerp(x0, x1, p)}" cy="${lerp(y0, y1, p)}" r="7" fill="#fff" opacity="${on}"/>`;
    }
  }
  const pins = [...Array(5)].map((_, i) => { const o = -100 + i * 50; return `<rect x="${o - 9}" y="-178" width="18" height="30" rx="4" fill="#b9c0d0"/><rect x="${o - 9}" y="148" width="18" height="30" rx="4" fill="#b9c0d0"/><rect x="-178" y="${o - 9}" width="30" height="18" rx="4" fill="#b9c0d0"/><rect x="148" y="${o - 9}" width="30" height="18" rx="4" fill="#b9c0d0"/>`; }).join('');
  return `<g transform="${T(x, y, s)}"><circle r="${330 + 12 * Math.sin(t * 3)}" fill="${PURPLE}" opacity="${0.22 * on}" filter="url(#blur8)"/>${traces}${pins}
    <g filter="url(#drop)"><rect x="-150" y="-150" width="300" height="300" rx="40" fill="#1b1f3a"/></g>
    <rect x="-120" y="-120" width="240" height="240" rx="28" fill="none" stroke="${PURPLE}" stroke-width="8" opacity="${0.5 + 0.5 * on}"/>
    ${txt(0, 40, 120, on > 0.3 ? '#fff' : '#5b6378', 'AI', `filter="${on > 0.3 ? 'url(#glow)' : ''}"`)}</g>`;
}
// the classic movie robot (red eyes, antenna)
export function robot(x, y, s = 1, t = 0, { eye = C.red } = {}) {
  const arm = 10 * Math.sin(t * 3);
  return `<g transform="${T(x, y, s)}"><line x1="0" y1="-560" x2="0" y2="-500" stroke="#9aa3b8" stroke-width="10"/><circle cx="0" cy="-570" r="18" fill="${eye}" filter="url(#glow)"/>
    <g filter="url(#drop)"><rect x="-150" y="-500" width="300" height="220" rx="36" fill="#9aa3b8"/></g><rect x="-120" y="-470" width="240" height="120" rx="24" fill="#1b1f3a"/>
    <circle cx="-55" cy="-410" r="${26}" fill="${eye}" filter="url(#glow)"/><circle cx="55" cy="-410" r="26" fill="${eye}" filter="url(#glow)"/>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="${-70 + i * 30}" y="-330" width="18" height="26" rx="4" fill="#5b6378"/>`).join('')}
    <rect x="-40" y="-280" width="80" height="40" fill="#7a8296"/><g filter="url(#drop)"><rect x="-190" y="-245" width="380" height="300" rx="40" fill="#b9c0d0"/></g>
    <rect x="-90" y="-190" width="180" height="120" rx="16" fill="#1b1f3a"/>${[0, 1, 2].map((i) => `<circle cx="${-50 + i * 50}" cy="-130" r="16" fill="${[C.red, C.yellow, C.green][i]}" opacity="${0.4 + 0.6 * (Math.floor(t * 4 + i) % 3 === 0 ? 1 : 0)}"/>`).join('')}
    <g transform="rotate(${20 + arm} -190 -200)"><rect x="-250" y="-220" width="60" height="260" rx="30" fill="#9aa3b8"/></g><g transform="rotate(${-20 - arm} 190 -200)"><rect x="190" y="-220" width="60" height="260" rx="30" fill="#9aa3b8"/></g>
    <rect x="-150" y="55" width="100" height="200" rx="26" fill="#7a8296"/><rect x="50" y="55" width="100" height="200" rx="26" fill="#7a8296"/></g>`;
}
// a smiling AI face for phone screens
export function aiFace(x, y, s = 1, t = 0) {
  const bl = (t * 0.8) % 1 < 0.06 ? 0.15 : 1;
  return `<g transform="${T(x, y, s)}"><circle r="110" fill="${PURPLE}" filter="url(#glow)"/><circle r="96" fill="#2a1f5c"/>
    <ellipse cx="-36" cy="-14" rx="16" ry="${22 * bl}" fill="${CYAN}"/><ellipse cx="36" cy="-14" rx="16" ry="${22 * bl}" fill="${CYAN}"/>
    <path d="M -40 34 Q 0 66 40 34" stroke="${CYAN}" stroke-width="10" fill="none" stroke-linecap="round"/></g>`;
}
export function gradCap(x, y, s = 1, rot = 0) {
  return `<g transform="${T(x, y, s, rot)}"><path d="M -150 0 L 0 -60 L 150 0 L 0 60 Z" fill="#1a1d27"/><path d="M -90 30 L -90 90 Q 0 130 90 90 L 90 30 L 0 60 Z" fill="#2a2e3b"/>
    <path d="M 120 10 L 130 120" stroke="${C.yellow}" stroke-width="8"/><circle cx="130" cy="126" r="14" fill="${C.yellow}"/></g>`;
}

// ---------------------------------------------------------------- phone screens (x -176..176, y -376..376)
const bub = (x, y, w, h, s, mine, op = 1, size = 19) => `<g opacity="${op}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${mine ? I.C.blue : '#2a2e3b'}"/>
  ${s.split('\n').map((l, i) => `<text x="${x + 18}" y="${y + 34 + i * 26}" font-family="InterW" font-weight="600" font-size="${size}" fill="#fff">${l}</text>`).join('')}</g>`;
export function screenChat(t, u, { answer = 0 } = {}) {
  const q = 'Why is the sky blue?', typed = q.slice(0, Math.floor(clamp(u / 0.9) * q.length));
  const lines = ['Sunlight hits air molecules.', 'Blue light scatters the most,', 'so the whole sky looks blue.', 'Sunsets are red because…'];
  const n = Math.floor(clamp(answer / 1.2) * 4.99);
  return `<rect x="-176" y="-376" width="352" height="752" fill="#0b0d14"/>${I.statusBar({})}
    <g transform="translate(0 -250)">${aiFace(-120, 0, 0.28, t)}<text x="-84" y="8" font-family="InterW" font-weight="800" font-size="24" fill="#fff">AI Chat</text></g>
    ${u > 0.95 ? bub(-40, -170, 200, 52, q, true) : ''}
    ${answer > 0 ? `<g>${bub(-160, -96, 300, 40 + Math.max(1, n) * 26, lines.slice(0, Math.max(1, n)).join('\n'), false, 1, 17)}</g>` : ''}
    <rect x="-160" y="300" width="320" height="56" rx="28" fill="#1d2130"/><text x="-140" y="336" font-family="InterW" font-weight="600" font-size="18" fill="${u < 0.95 ? '#fff' : '#6b7285'}">${u < 0.95 ? typed + (Math.floor(t * 3) % 2 ? '|' : '') : 'Message…'}</text>`;
}
export function screenPlan(t, u) {
  const items = [['7:00', 'Gym', C.coral], ['9:00', 'Deep work', C.blue], ['12:30', 'Lunch w/ Sam', C.green], ['15:00', 'Dentist', C.yellow], ['18:00', 'Groceries', PURPLE]];
  return `<rect x="-176" y="-376" width="352" height="752" fill="#f5f6fa"/>${I.statusBar({ dark: false })}
    <text x="-150" y="-262" font-family="InterW" font-weight="800" font-size="32" fill="${C.ink}">Today</text><text x="-150" y="-228" font-family="InterW" font-weight="600" font-size="17" fill="#6b7285">Planned by AI ✨</text>
    ${items.map(([h, s, col], i) => { const k = ease.back((u - i * 0.18) / 0.3); return `<g transform="translate(0 ${-170 + i * 96}) scale(${k})"><rect x="-160" y="-38" width="320" height="76" rx="18" fill="#fff" filter="url(#soft)"/><rect x="-160" y="-38" width="10" height="76" rx="5" fill="${col}"/>
      <text x="-134" y="-4" font-family="InterW" font-weight="700" font-size="16" fill="#6b7285">${h}</text><text x="-134" y="22" font-family="InterW" font-weight="800" font-size="21" fill="${C.ink}">${s}</text>
      <circle cx="128" cy="0" r="16" fill="${C.green}"/><path d="M 120 0 L 126 7 L 137 -6" stroke="#fff" stroke-width="4" fill="none"/></g>`; }).join('')}`;
}
export function screenCode(t, u) {
  const fixed = u > 0.8, ln = ['function total(items) {', '  let sum = 0', '  for (const i of items)', '    sum += i.price', '  return sum', '}'];
  return `<rect x="-176" y="-376" width="352" height="752" fill="#151826"/>${I.statusBar({})}
    <text x="-150" y="-262" font-family="InterW" font-weight="800" font-size="26" fill="#fff">app.js</text>
    ${ln.map((l, i) => `<text x="-150" y="${-190 + i * 40}" font-family="monospace" font-weight="700" font-size="17" fill="${i === 3 && !fixed ? '#ff8a8a' : ['#c792ea', '#82aaff', '#c792ea', '#c3e88d', '#c792ea', '#fff'][i]}">${l.replace(/</g, '&lt;')}</text>
      ${i === 3 && !fixed ? `<path d="M -110 ${-182 + i * 40} q 8 6 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0" stroke="${C.red}" stroke-width="3" fill="none"/>` : ''}`).join('')}
    <g transform="translate(0 130)"><rect x="-150" y="-40" width="300" height="80" rx="18" fill="${fixed ? '#123d2a' : '#4a1520'}"/>
    <text y="10" font-family="InterW" font-weight="800" font-size="24" fill="${fixed ? '#7dffa6' : '#ff8a8a'}" text-anchor="middle">${fixed ? '✓ Bug fixed' : '✗ 1 error'}</text></g>
    ${fixed ? '' : I.spinner(0, 260, 26, u * 1.5, PURPLE, 8)}`;
}
export function screenTax(t, u) {
  const rows = ['Income', 'Deductions', 'Credits', 'Tax owed'];
  return `<rect x="-176" y="-376" width="352" height="752" fill="#f5f6fa"/>${I.statusBar({ dark: false })}
    <text x="-150" y="-262" font-family="InterW" font-weight="800" font-size="30" fill="${C.ink}">Your taxes</text>
    ${rows.map((r, i) => `<g transform="translate(0 ${-190 + i * 70})"><rect x="-160" y="-28" width="320" height="56" rx="14" fill="#fff" filter="url(#soft)"/>
      <text x="-140" y="8" font-family="InterW" font-weight="700" font-size="19" fill="${C.ink}">${r}</text>${u > 0.2 + i * 0.25 ? `<circle cx="130" cy="0" r="14" fill="${C.green}"/><path d="M 123 0 L 128 6 L 138 -6" stroke="#fff" stroke-width="4" fill="none"/>` : ''}</g>`).join('')}
    <g transform="translate(0 170) scale(${ease.back((u - 1.2) / 0.3)})"><rect x="-150" y="-70" width="300" height="140" rx="22" fill="${C.green}"/>
    <text y="-18" font-family="InterW" font-weight="700" font-size="20" fill="#fff" text-anchor="middle">Refund</text><text y="24" font-family="MontB" font-weight="900" font-size="40" fill="#fff" text-anchor="middle">$1,240</text>
    <text y="54" font-family="InterW" font-weight="700" font-size="18" fill="#fff" opacity="0.85" text-anchor="middle">(€1,140)</text></g>`;
}

// ---------------------------------------------------------------- work
export function laptop(x, y, s = 1, screen = '', rot = 0) {
  return `<g transform="${T(x, y, s, rot)}"><g filter="url(#drop)"><rect x="-260" y="-340" width="520" height="340" rx="22" fill="#2a2e38"/></g>
    <rect x="-236" y="-316" width="472" height="292" rx="8" fill="#0f1220"/><g>${screen}</g>
    <path d="M -320 0 L 320 0 L 290 40 L -290 40 Z" fill="#3a3f4b"/><rect x="-60" y="0" width="120" height="10" rx="5" fill="#22252e"/></g>`;
}
export function paperStack(x, y, s = 1, n = 10, t = 0) {
  let p = '';
  for (let i = 0; i < n; i++) p += `<g transform="translate(${(hash(i, 1) - 0.5) * 30} ${-i * 22}) rotate(${(hash(i, 2) - 0.5) * 6})"><rect x="-140" y="-16" width="280" height="22" rx="3" fill="${i % 2 ? '#f6f3ea' : '#ebe6d8'}" stroke="#cfc7b2" stroke-width="2"/></g>`;
  return `<g transform="${T(x, y, s)}">${p}</g>`;
}
export function stopwatch(x, y, s = 1, t = 0, label = '') {
  const a = (t * 360) % 360;
  return `<g transform="${T(x, y, s)}"><rect x="-26" y="-176" width="52" height="40" rx="10" fill="#9aa3b8"/><circle r="150" fill="#fff" filter="url(#drop)"/><circle r="128" fill="#eef1f8"/>
    ${[...Array(12)].map((_, i) => `<rect x="-5" y="-124" width="10" height="20" rx="5" fill="${C.ink}" transform="rotate(${i * 30})"/>`).join('')}
    <g transform="rotate(${a})"><rect x="-5" y="-110" width="10" height="120" rx="5" fill="${C.red}"/></g><circle r="14" fill="${C.ink}"/>
    ${label ? outlined(0, 230, 70, C.yellow, label, 8) : ''}</g>`;
}
export function checklist(x, y, s = 1, u = 0) {
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-200" y="-260" width="400" height="520" rx="26" fill="#fff"/></g><rect x="-60" y="-280" width="120" height="44" rx="12" fill="#9aa3b8"/>
    ${[0, 1, 2, 3, 4].map((i) => { const on = u > i * 0.25; return `<g transform="translate(0 ${-170 + i * 90})"><rect x="-160" y="-24" width="48" height="48" rx="10" fill="${on ? C.green : '#e3e7ef'}"/>
      ${on ? `<path d="M -148 0 L -138 12 L -122 -10" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/>` : ''}<rect x="-90" y="-10" width="${200 - (i % 2) * 50}" height="20" rx="10" fill="${on ? '#cfd5e2' : '#e3e7ef'}"/></g>`; }).join('')}</g>`;
}

// ---------------------------------------------------------------- the lab
export function flask(x, y, s = 1, t = 0, col = C.green, seed = 0) {
  const bub = [0, 1, 2].map((i) => { const p = (t * 1.2 + i / 3 + seed * 0.37) % 1; return `<circle cx="${(hash(i, seed) - 0.5) * 50}" cy="${-30 - p * 140}" r="${8 + 6 * p}" fill="#fff" opacity="${0.7 * (1 - p)}"/>`; }).join('');
  return `<g transform="${T(x, y, s)}"><path d="M -30 -200 L -30 -110 L -110 40 Q -120 60 -96 60 L 96 60 Q 120 60 110 40 L 30 -110 L 30 -200 Z" fill="#dff1ff" opacity="0.55" stroke="#fff" stroke-width="6"/>
    <path d="M -64 -40 L 64 -40 L 110 40 Q 120 60 96 60 L -96 60 Q -120 60 -110 40 Z" fill="${col}" opacity="0.9"/>${bub}<rect x="-42" y="-214" width="84" height="22" rx="8" fill="#cfd5e2"/></g>`;
}
export function molecule(x, y, s = 1, t = 0) {
  const pts = [[0, 0], [110, -60], [110, 70], [-110, -60], [-110, 70], [0, -140], [210, 0]], a = t * 30;
  return `<g transform="${T(x, y, s, a)}">${[[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 6]].map(([i, j]) => `<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${pts[j][0]}" y2="${pts[j][1]}" stroke="#cfd5e2" stroke-width="16"/>`).join('')}
    ${pts.map(([px, py], i) => `<circle cx="${px}" cy="${py}" r="${i ? 34 : 48}" fill="${[C.red, CYAN, CYAN, C.yellow, C.yellow, '#fff', PURPLE][i]}" filter="url(#soft)"/>`).join('')}</g>`;
}
export function pill(x, y, s = 1, rot = 0, a = C.coral, b = '#fff') {
  return `<g transform="${T(x, y, s, rot)}" filter="url(#soft)"><path d="M 0 -40 L -60 -40 A 40 40 0 0 0 -60 40 L 0 40 Z" fill="${a}"/><path d="M 0 -40 L 60 -40 A 40 40 0 0 1 60 40 L 0 40 Z" fill="${b}"/></g>`;
}
export function lattice(x, y, s = 1, t = 0) {
  const a = t * 0.6, pts = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const X = i * 120, Y = j * 120, Z = k * 120, x2 = X * Math.cos(a) - Z * Math.sin(a), z2 = X * Math.sin(a) + Z * Math.cos(a), y2 = Y * Math.cos(0.5) - z2 * Math.sin(0.5), z3 = Y * Math.sin(0.5) + z2 * Math.cos(0.5);
    pts.push([x2, y2, z3, i, j, k]);
  }
  let lines = '';
  pts.forEach((p, m) => pts.forEach((q, n) => { if (n <= m) return; const d = Math.abs(p[3] - q[3]) + Math.abs(p[4] - q[4]) + Math.abs(p[5] - q[5]); if (d === 1) lines += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${CYAN}" stroke-width="6" opacity="0.6"/>`; }));
  const dots = pts.slice().sort((p, q) => p[2] - q[2]).map(([px, py, pz]) => `<circle cx="${px}" cy="${py}" r="${22 + pz / 20}" fill="${PURPLE}" stroke="#fff" stroke-width="4"/>`).join('');
  return `<g transform="${T(x, y, s)}"><circle r="320" fill="${CYAN}" opacity="0.12" filter="url(#blur8)"/>${lines}${dots}</g>`;
}
export function rocket(x, y, s = 1, t = 0, rot = 35) {
  const fl = 1 + 0.2 * Math.sin(t * 30);
  return `<g transform="${T(x, y, s, rot)}"><path d="M -30 150 Q 0 ${150 + 160 * fl} 30 150 Z" fill="${C.yellow}"/><path d="M -18 150 Q 0 ${150 + 100 * fl} 18 150 Z" fill="#fff"/>
    <path d="M -60 60 L -110 160 L -50 140 Z M 60 60 L 110 160 L 50 140 Z" fill="${C.red}"/><path d="M 0 -200 C 80 -120 70 60 50 150 L -50 150 C -70 60 -80 -120 0 -200 Z" fill="#eef1f8"/>
    <circle cy="-40" r="32" fill="${CYAN}" stroke="#9aa3b8" stroke-width="10"/></g>`;
}

// ---------------------------------------------------------------- the twist
export function target(x, y, s = 1, col = C.red, label = '') {
  return `<g transform="${T(x, y, s)}"><circle r="130" fill="#fff" filter="url(#soft)"/><circle r="100" fill="${col}"/><circle r="70" fill="#fff"/><circle r="40" fill="${col}"/>
    ${label ? outlined(0, 210, 54, '#fff', label, 7) : ''}</g>`;
}
export function arrowFly(x0, y0, x1, y1, bend, p) {
  const q = clamp(p), mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - bend;
  const bx = (1 - q) ** 2 * x0 + 2 * (1 - q) * q * mx + q * q * x1, by = (1 - q) ** 2 * y0 + 2 * (1 - q) * q * my + q * q * y1;
  const dx = 2 * (1 - q) * (mx - x0) + 2 * q * (x1 - mx), dy = 2 * (1 - q) * (my - y0) + 2 * q * (y1 - my), a = Math.atan2(dy, dx) * 180 / Math.PI;
  return `<path d="M ${x0} ${y0} Q ${mx} ${my} ${x1} ${y1}" stroke="#fff" stroke-width="5" stroke-dasharray="10 14" fill="none" opacity="0.4"/>
    <g transform="translate(${bx} ${by}) rotate(${a})"><rect x="-120" y="-6" width="120" height="12" rx="6" fill="#c9a66b"/><path d="M 0 -18 L 36 0 L 0 18 Z" fill="#9aa3b8"/><path d="M -120 -6 L -150 -26 L -130 0 L -150 26 L -120 6 Z" fill="${C.coral}"/></g>`;
}
export function chalkboard(x, y, s = 1, inner = '') {
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-420" y="-280" width="840" height="560" rx="16" fill="#8a5a3c"/></g><rect x="-390" y="-250" width="780" height="500" rx="8" fill="#22403a"/>${inner}
    <rect x="-200" y="250" width="120" height="16" rx="6" fill="#f6f3ea"/></g>`;
}
export function building(x, y, s = 1, col = '#5b6378', label = '', dome = false) {
  return `<g transform="${T(x, y, s)}">${dome ? `<path d="M -110 -300 A 110 110 0 0 1 110 -300 Z" fill="${col}"/><rect x="-8" y="-450" width="16" height="50" fill="${col}"/>` : ''}
    <g filter="url(#soft)"><rect x="-150" y="-300" width="300" height="300" rx="10" fill="${col}"/></g>
    ${dome ? [0, 1, 2, 3, 4].map((i) => `<rect x="${-120 + i * 54}" y="-250" width="26" height="230" fill="#fff" opacity="0.5"/>`).join('') : [0, 1, 2].map((r) => [0, 1, 2].map((c) => `<rect x="${-110 + c * 80}" y="${-260 + r * 80}" width="50" height="50" rx="6" fill="#ffe7a6" opacity="0.8"/>`).join('')).join('')}
    ${label ? outlined(0, 70, 46, '#fff', label, 6) : ''}</g>`;
}

// ---------------------------------------------------------------- the survey and the past
export function clipboard(x, y, s = 1, u = 0) {
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-230" y="-300" width="460" height="600" rx="26" fill="#c98f4a"/></g><rect x="-200" y="-260" width="400" height="530" rx="12" fill="#fff"/>
    <rect x="-80" y="-320" width="160" height="70" rx="16" fill="#9aa3b8"/>${txt(0, -190, 44, C.ink, 'AI SURVEY')}
    ${[0, 1, 2, 3].map((i) => { const on = u > 0.3 + i * 0.2; return `<g transform="translate(0 ${-110 + i * 90})"><rect x="-170" y="-24" width="48" height="48" rx="10" fill="none" stroke="${C.ink}" stroke-width="6"/>
      ${on ? `<path d="M -160 0 L -148 14 L -128 -14" stroke="${C.blue}" stroke-width="8" fill="none" stroke-linecap="round"/>` : ''}<rect x="-100" y="-10" width="${240 - (i % 2) * 70}" height="20" rx="10" fill="#cfd5e2"/></g>`; }).join('')}</g>`;
}
// a crowd of tiny people icons, `n` shown
export function crowdGrid(x, y, s = 1, n = 0, cols = 12, rows = 10) {
  // icons fill in a scattered order, like people arriving
  const ord = [...Array(cols * rows).keys()].sort((p, q) => hash(p, 7) - hash(q, 7));
  let g = '';
  for (let m = 0; m < Math.min(n, cols * rows); m++) {
    const i = ord[m], cx = (i % cols - (cols - 1) / 2) * 72, cy = (Math.floor(i / cols) - (rows - 1) / 2) * 78, col = [CYAN, PURPLE, C.yellow, C.coral][i % 4];
    g += `<circle cx="${cx}" cy="${cy - 16}" r="15" fill="${col}"/><rect x="${cx - 19}" y="${cy + 2}" width="38" height="30" rx="15" fill="${col}"/>`;
  }
  return `<g transform="${T(x, y, s)}">${g}</g>`;
}
export function pie(x, y, s = 1, p = 0.5, col = CYAN) {
  const a = p * 2 * Math.PI, x1 = Math.sin(a) * 260, y1 = -Math.cos(a) * 260;
  return `<g transform="${T(x, y, s)}"><circle r="280" fill="#fff" filter="url(#drop)"/><circle r="260" fill="#2a2e3b"/>
    ${p > 0 ? `<path d="M 0 0 L 0 -260 A 260 260 0 ${p > 0.5 ? 1 : 0} 1 ${x1} ${y1} Z" fill="${col}"/>` : ''}</g>`;
}
export function chess(x, y, s = 1, t = 0, fall = 0) {
  let sq = '';
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) sq += `<rect x="${-240 + c * 60}" y="${-240 + r * 60}" width="60" height="60" fill="${(r + c) % 2 ? '#8a5a3c' : '#f0d9b5'}"/>`;
  const piece = (px, py, col, kind) => kind === 'K' ? `<g transform="translate(${px} ${py})"><rect x="-22" y="-10" width="44" height="14" rx="5" fill="${col}"/><path d="M -16 -10 L -10 -60 L 10 -60 L 16 -10 Z" fill="${col}"/><circle cy="-66" r="14" fill="${col}"/><rect x="-4" y="-100" width="8" height="26" fill="${col}"/><rect x="-12" y="-92" width="24" height="8" fill="${col}"/></g>`
    : `<g transform="translate(${px} ${py})"><rect x="-18" y="-8" width="36" height="12" rx="5" fill="${col}"/><path d="M -12 -8 L -6 -36 L 6 -36 L 12 -8 Z" fill="${col}"/><circle cy="-44" r="13" fill="${col}"/></g>`;
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-260" y="-260" width="520" height="520" rx="12" fill="#5a3a26"/></g>${sq}
    ${piece(-150, -150, '#fff', 'P')}${piece(90, 30, '#1a1d27', 'P')}${piece(-30, 90, '#fff', 'P')}
    <g transform="translate(150 -90) rotate(${90 * ease.out(fall)} 0 0)">${piece(0, 0, '#1a1d27', 'K')}</g>${piece(-90, 150, '#fff', 'K')}</g>`;
}
export function crt(x, y, s = 1, t = 0, label = '') {
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-200" y="-180" width="400" height="320" rx="30" fill="#d9d2bf"/></g><rect x="-160" y="-145" width="320" height="230" rx="30" fill="#0b2a1a"/>
    <text x="-130" y="-90" font-family="monospace" font-weight="700" font-size="26" fill="#7dffa6">${label}</text><text x="-130" y="-50" font-family="monospace" font-weight="700" font-size="22" fill="#7dffa6">&gt; CHECKMATE${Math.floor(t * 2) % 2 ? '_' : ''}</text>
    <rect x="-120" y="140" width="240" height="40" fill="#bfb7a2"/><rect x="-220" y="180" width="440" height="40" rx="10" fill="#cfc7b2"/></g>`;
}
export function goBoard(x, y, s = 1, t = 0, mv = 0) {
  let g = '', st = '';
  for (let i = 0; i < 13; i++) g += `<line x1="${-240 + i * 40}" y1="-240" x2="${-240 + i * 40}" y2="240" stroke="#5a3a1a" stroke-width="3"/><line x1="-240" y1="${-240 + i * 40}" x2="240" y2="${-240 + i * 40}" stroke="#5a3a1a" stroke-width="3"/>`;
  for (let i = 0; i < 46; i++) { const cx = -240 + Math.floor(hash(i, 1) * 13) * 40, cy = -240 + Math.floor(hash(i, 2) * 13) * 40; st += `<circle cx="${cx}" cy="${cy}" r="17" fill="${i % 2 ? '#fff' : '#1a1d27'}" stroke="#000" stroke-width="2" opacity="0.95"/>`; }
  const k = ease.back(mv / 0.3);
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-280" y="-280" width="560" height="560" rx="16" fill="#e0b46a"/></g>${g}${st}
    ${mv > 0 ? `<circle cx="80" cy="-120" r="${40 + 14 * Math.sin(t * 6)}" fill="${CYAN}" opacity="0.4" filter="url(#glow)"/><circle cx="80" cy="-120" r="${18 * k}" fill="#1a1d27" stroke="${CYAN}" stroke-width="5"/>` : ''}</g>`;
}
export function filmStrip(t, frames = []) {
  const off = (t * 60) % 300;
  let s = `<rect x="-20" y="560" width="1120" height="520" fill="#111"/>`;
  for (let i = -1; i < 5; i++) {
    const x = i * 300 - off + 40;
    s += `<rect x="${x}" y="620" width="260" height="400" rx="10" fill="#2a2e3b"/>${frames[(i + 6) % frames.length] ? `<g transform="translate(${x + 130} 820)">${frames[(i + 6) % frames.length]}</g>` : ''}`;
  }
  for (let i = 0; i < 30; i++) { const x = i * 50 - (off % 50); s += `<rect x="${x}" y="576" width="26" height="28" rx="4" fill="#fff" opacity="0.8"/><rect x="${x}" y="1036" width="26" height="28" rx="4" fill="#fff" opacity="0.8"/>`; }
  return s;
}

// ---------------------------------------------------------------- normal life
export function ball(x, y, s = 1, rot = 0) {
  return `<g transform="${T(x, y, s, rot)}"><circle r="40" fill="#fff" stroke="#1a1d27" stroke-width="4"/><path d="M 0 -14 L 13 -4 L 8 12 L -8 12 L -13 -4 Z" fill="#1a1d27"/>
    ${[0, 72, 144, 216, 288].map((a) => `<line x1="0" y1="-14" x2="0" y2="-40" stroke="#1a1d27" stroke-width="3" transform="rotate(${a})"/>`).join('')}</g>`;
}
export function heart(x, y, s = 1, col = C.coral) {
  return `<path transform="${T(x, y, s)}" d="M 0 30 C -60 -10 -50 -60 -20 -60 C -5 -60 0 -45 0 -40 C 0 -45 5 -60 20 -60 C 50 -60 60 -10 0 30 Z" fill="${col}"/>`;
}
export function tree(x, y, s = 1) {
  return `<g transform="${T(x, y, s)}"><rect x="-16" y="-160" width="32" height="160" rx="8" fill="${C.woodD}"/><circle cy="-220" r="100" fill="#3fbf7f"/><circle cx="-60" cy="-170" r="70" fill="#35a86f"/><circle cx="60" cy="-170" r="70" fill="#35a86f"/></g>`;
}
export function commentBox(x, y, s = 1, t = 0, u = 0, title = ['', ''], opts = []) {
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-400" y="-300" width="800" height="600" rx="50" fill="#fff"/></g>
    ${txt(0, -200, 58, C.ink, title[0])}${txt(0, -130, 58, C.ink, title[1])}
    ${opts.map((o, i) => { const k = ease.back((u - 0.2 - i * 0.15) / 0.3); return `<g transform="translate(${-180 + (i % 2) * 360} ${-10 + Math.floor(i / 2) * 140}) scale(${k})"><rect x="-160" y="-50" width="320" height="100" rx="50" fill="${[C.coral, C.yellow, C.teal, C.blue][i]}"/>
      ${txt(0, 14, 40, '#fff', o)}</g>`; }).join('')}</g>`;
}
