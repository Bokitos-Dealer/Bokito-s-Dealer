// More of the flat illustration kit, for "What if all the bees disappeared?" (scenarios/bees.js).
import * as I from './ill2d.js';
import { txt, outlined } from './ill2d-grid.js';

const { C, ease, clamp, lerp, hash } = I;
const T = (x, y, s = 1, rot = 0) => `translate(${x} ${y}) rotate(${rot}) scale(${s})`;
export const HONEY = '#ffb627';

export function bee(x, y, s = 1, t = 0, { rot = 0, fade = 1 } = {}) {
  const w = 0.5 + 0.5 * Math.abs(Math.sin(t * 40));
  return `<g transform="${T(x, y, s, rot)}" opacity="${fade}"><ellipse cx="-10" cy="-50" rx="${46 * w}" ry="30" fill="#e8f6ff" opacity="0.85" transform="rotate(-20 -10 -50)"/><ellipse cx="22" cy="-50" rx="${40 * w}" ry="26" fill="#e8f6ff" opacity="0.85" transform="rotate(20 22 -50)"/>
    <ellipse rx="70" ry="48" fill="${HONEY}"/><path d="M -24 -46 Q -14 0 -24 46 M 6 -48 Q 16 0 6 48" stroke="#2a1d10" stroke-width="16" fill="none"/>
    <path d="M -70 0 L -96 0" stroke="#2a1d10" stroke-width="10" stroke-linecap="round"/><circle cx="62" cy="-6" r="34" fill="#2a1d10"/><circle cx="74" cy="-14" r="9" fill="#fff"/>
    <path d="M 70 -36 Q 80 -70 100 -74 M 56 -38 Q 54 -74 70 -84" stroke="#2a1d10" stroke-width="5" fill="none"/></g>`;
}
export function flower(x, y, s = 1, t = 0, col = '#ff7eb6', pollen = 1) {
  const sw = 4 * Math.sin(t * 1.5 + x);
  return `<g transform="${T(x, y, s, sw)}"><path d="M 0 0 Q 10 120 0 260" stroke="#3fa34d" stroke-width="12" fill="none"/><path d="M 4 150 q 50 -30 70 0 q -40 20 -70 0" fill="#3fa34d"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<ellipse cx="0" cy="-50" rx="30" ry="50" fill="${col}" transform="rotate(${i * 60})"/>`).join('')}<circle r="34" fill="${pollen ? '#ffd84a' : '#c9a66b'}"/>
    ${pollen ? [0, 1, 2, 3, 4].map((i) => `<circle cx="${(hash(i, 1) - 0.5) * 36}" cy="${(hash(i, 2) - 0.5) * 36}" r="5" fill="#f0a500"/>`).join('') : ''}</g>`;
}
export function picnic(t) {
  return `${I.bg('#7cc7ff', '#d6efff')}<circle cx="880" cy="520" r="80" fill="#fff3b0"/><rect y="1050" width="1080" height="870" fill="#8bc77b"/>
    <path d="M 160 1260 L 920 1260 L 1020 1440 L 60 1440 Z" fill="#ff5e5b"/>${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M ${160 + i * 152} 1260 L ${60 + i * 192} 1440" stroke="#fff" stroke-width="18"/>`).join('')}
    <rect x="460" y="1200" width="160" height="90" rx="14" fill="#c98f4a"/><circle cx="380" cy="1290" r="40" fill="${C.red}"/><circle cx="720" cy="1300" r="34" fill="#7bd389"/>`;
}
// a produce shelf with crates; `left` 0..1 how much is left of the pollinator crops
export function produce(x, y, s = 1, t = 0, left = 1) {
  const items = [['APPLES', C.red, 'circle'], ['ALMONDS', '#c98f4a', 'oval'], ['BLUEBERRIES', '#4a5ad8', 'small'], ['CHERRIES', '#c0123a', 'circle'], ['AVOCADOS', '#4c7a2a', 'oval'], ['WHEAT', '#e8c27a', 'bread']];
  return `<g transform="${T(x, y, s)}"><g filter="url(#drop)"><rect x="-440" y="-460" width="880" height="880" rx="24" fill="#d9dde8"/></g>
    ${items.map(([name, col, kind], i) => { const cx = -220 + (i % 2) * 440, cy = -300 + Math.floor(i / 2) * 290, poll = name !== 'WHEAT', n = poll ? Math.round(12 * left) : 12;
      let fruit = '';
      for (let k = 0; k < n; k++) { const fx = -150 + (k % 6) * 60, fy = -60 + Math.floor(k / 6) * 50; fruit += kind === 'oval' ? `<ellipse cx="${fx}" cy="${fy}" rx="24" ry="32" fill="${col}"/>` : kind === 'small' ? `<circle cx="${fx}" cy="${fy}" r="16" fill="${col}"/><circle cx="${fx + 14}" cy="${fy + 8}" r="14" fill="${col}"/>` : kind === 'bread' ? `<rect x="${fx - 26}" y="${fy - 20}" width="52" height="36" rx="16" fill="${col}"/>` : `<circle cx="${fx}" cy="${fy}" r="26" fill="${col}"/>`; }
      return `<g transform="translate(${cx} ${cy})"><rect x="-190" y="-20" width="380" height="110" rx="10" fill="#b98a5a"/>${fruit}<rect x="-190" y="90" width="380" height="40" fill="#fff"/>${txt(0, 122, 32, C.ink, name)}
        ${poll && left < 0.5 ? `<rect x="-120" y="-30" width="240" height="56" rx="8" fill="#fff8d6" transform="rotate(-6)"/>${txt(0, 10, 32, C.red, 'SOLD OUT').replace('<text', '<text transform="rotate(-6)"')}` : ''}</g>`; }).join('')}</g>`;
}
export function tag(x, y, s = 1, name = '', a = 1, b = 2, v = 0, cur = '$') {
  const p = lerp(a, b, clamp(v));
  return `<g transform="${T(x, y, s)}"><path d="M -160 -70 L 120 -70 L 180 0 L 120 70 L -160 70 Z" fill="#fff8d6" filter="url(#soft)"/><circle cx="130" cy="0" r="12" fill="#c9cfdc"/>
    <text x="-140" y="-14" font-family="InterW" font-weight="800" font-size="30" fill="${C.ink}">${name}</text><text x="-140" y="44" font-family="MontB" font-weight="900" font-size="48" fill="${v > 0.1 ? C.red : C.ink}">${cur}${p.toFixed(2)}</text></g>`;
}
export function avocado(x, y, s = 1) {
  return `<g transform="${T(x, y, s)}" filter="url(#soft)"><path d="M 0 -120 C 60 -120 90 -10 90 50 C 90 110 50 140 0 140 C -50 140 -90 110 -90 50 C -90 -10 -60 -120 0 -120 Z" fill="#4c7a2a"/>
    <path d="M 0 -96 C 46 -96 70 -10 70 50 C 70 100 40 120 0 120 C -40 120 -70 100 -70 50 C -70 -10 -46 -96 0 -96 Z" fill="#cde58a"/><circle cy="50" r="40" fill="#8a5a3c"/></g>`;
}
export function cow(x, y, s = 1, t = 0) {
  const chew = 4 * Math.sin(t * 8);
  return `<g transform="${T(x, y, s)}"><rect x="-200" y="-120" width="360" height="200" rx="80" fill="#fff" filter="url(#soft)"/><ellipse cx="-60" cy="-60" rx="60" ry="40" fill="#1a1d27"/><ellipse cx="80" cy="10" rx="50" ry="36" fill="#1a1d27"/>
    ${[-160, -80, 60, 130].map((lx) => `<rect x="${lx - 18}" y="40" width="36" height="120" rx="14" fill="#fff"/><rect x="${lx - 18}" y="140" width="36" height="24" rx="8" fill="#5a4a3e"/>`).join('')}
    <g transform="translate(220 ${-80 + chew})"><rect x="-70" y="-70" width="140" height="160" rx="60" fill="#fff"/><ellipse cy="60" rx="66" ry="44" fill="#ffb3c6"/><circle cx="-24" cy="60" r="8" fill="#c2577a"/><circle cx="24" cy="60" r="8" fill="#c2577a"/>
    <circle cx="-30" cy="-10" r="10" fill="#1a1d27"/><circle cx="30" cy="-10" r="10" fill="#1a1d27"/><path d="M -60 -60 L -100 -90 M 60 -60 L 100 -90" stroke="#c9a66b" stroke-width="14" stroke-linecap="round"/>
    <path d="M -70 90 q 20 20 0 30 M -50 92 q 10 30 -10 40" stroke="#4c7a2a" stroke-width="6" fill="none"/></g></g>`;
}
export function milk(x, y, s = 1) {
  return `<g transform="${T(x, y, s)}" filter="url(#soft)"><path d="M -70 -120 L 70 -120 L 70 140 L -70 140 Z" fill="#fff"/><path d="M -70 -120 L 0 -190 L 70 -120 Z" fill="#e3e7ef"/><rect x="-70" y="-40" width="140" height="90" fill="${C.blue}"/>${txt(0, 20, 40, '#fff', 'MILK')}</g>`;
}
export function grains(x, y, s = 1, t = 0) {
  const stalk = (sx, col, kind) => { const sw = 10 * Math.sin(t * 2 + sx / 80); return `<g transform="translate(${sx} 0) rotate(${sw})"><path d="M 0 0 L 0 -300" stroke="#a0b85a" stroke-width="8"/>
    ${kind === 'corn' ? `<ellipse cx="14" cy="-180" rx="22" ry="60" fill="#ffd84a"/><path d="M 0 -120 q 40 -60 30 -120" stroke="#6aa86b" stroke-width="10" fill="none"/>` : [...Array(8)].map((_, i) => `<ellipse cx="${i % 2 ? 10 : -10}" cy="${-300 + i * 18}" rx="9" ry="14" fill="${col}"/>`).join('')}</g>`; };
  return `<g transform="${T(x, y, s)}">${[-300, -220, -140].map((sx) => stalk(sx, '#e8c27a', 'wheat')).join('')}${[-40, 40].map((sx) => stalk(sx, '#f3efe4', 'rice')).join('')}${[140, 240, 330].map((sx) => stalk(sx, '', 'corn')).join('')}
    ${outlined(-220, 70, 40, '#fff', 'WHEAT', 5)}${outlined(0, 70, 40, '#fff', 'RICE', 5)}${outlined(240, 70, 40, '#fff', 'CORN', 5)}</g>`;
}
export function wind(t, op = 0.7) {
  return [...Array(8)].map((_, i) => { const p = (t * 0.6 + i / 8) % 1, y = 480 + i * 90; return `<path d="M ${-200 + p * 1500} ${y} q 60 -30 120 0 t 120 0" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" opacity="${op * (1 - Math.abs(p - 0.5) * 2)}"/>`; }).join('');
}
export function plate(x, y, s = 1, kind = 'boring') {
  return `<g transform="${T(x, y, s)}"><ellipse rx="300" ry="90" fill="#eef1f8" filter="url(#drop)"/><ellipse rx="230" ry="62" fill="#fff"/>
    ${kind === 'boring' ? `<ellipse cx="-60" cy="-20" rx="110" ry="40" fill="#f6f3ea"/><rect x="30" y="-50" width="160" height="60" rx="20" fill="#e8c27a"/>` : ''}</g>`;
}
export function handPollinate(x, y, s = 1, t = 0) {
  const br = 20 * Math.sin(t * 6);
  return `<g transform="${T(x, y, s)}"><rect x="-30" y="-200" width="60" height="420" fill="#8a5a3c"/>${[[-160, -320, 150], [140, -300, 160], [0, -430, 170]].map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#9ccf7a"/>`).join('')}
    ${[...Array(16)].map((_, i) => `<g transform="translate(${-260 + hash(i, 1) * 520} ${-520 + hash(i, 2) * 320})">${[0, 1, 2, 3, 4].map((k) => `<circle cx="${Math.cos(k * 1.26) * 12}" cy="${Math.sin(k * 1.26) * 12}" r="10" fill="#fff"/>`).join('')}<circle r="6" fill="#ffd84a"/></g>`).join('')}
    <g transform="translate(240 120)"><path d="M -60 -200 L -20 200 M 60 -200 L 100 200 M -50 -100 L 70 -100 M -40 0 L 80 0 M -30 100 L 90 100" stroke="#c9a66b" stroke-width="12"/></g>
    ${I.person(260, 40, 0.8, { shirt: C.blue, pose: 'wave', t })}<g transform="translate(${200 + br} -290) rotate(-30)"><rect x="-4" y="0" width="8" height="90" fill="#8a5a3c"/><ellipse cy="-6" rx="12" ry="22" fill="#ffd84a"/></g></g>`;
}
export function sprayX(x, y, s = 1) {
  return `<g transform="${T(x, y, s)}"><rect x="-60" y="-100" width="120" height="220" rx="20" fill="#9aa3b8" filter="url(#soft)"/><rect x="-30" y="-150" width="60" height="50" fill="#5b6378"/><rect x="30" y="-150" width="70" height="20" fill="#5b6378"/>
    ${txt(0, 30, 32, C.red, '☠')}${I.xmark(0, 0, 0.8, 1)}</g>`;
}
