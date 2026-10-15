// Flat vector illustration kit for the explainer-style episodes.
// Everything is SVG markup built per frame from pure functions of time (deterministic, resumable renders).
// Canvas: 1080 x 1920. Keep subjects between y 400 and y 1120: the goal bar sits above, the captions below.

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const ease = {
  out: (u) => 1 - Math.pow(1 - clamp(u), 3),
  inOut: (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; },
  back: (u) => { u = clamp(u); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
  elastic: (u) => { u = clamp(u); return u === 0 || u === 1 ? u : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * (2 * Math.PI) / 3) + 1; },
};
// tiny deterministic noise for shakes and flicker
export const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
export const wobble = (t, f = 30, a = 1, seed = 0) => (hash(Math.floor(t * f), seed) - 0.5) * 2 * a;

export const C = {
  night: '#0b1533', navy: '#142a5c', ink: '#0e1220', white: '#f6f7fb', coral: '#ff5e5b', red: '#ff3b3b', yellow: '#ffd84a',
  teal: '#2fd3c4', blue: '#2f7bff', green: '#34c759', grey: '#8e94a6', skin: '#f2c4a0', skinS: '#d99c7a', sleeve: '#283a6b', wood: '#9a6440', woodD: '#7a4a2e',
};

// shared <defs>: gradients and soft shadows used by the components
export const DEFS = `<defs>
  <filter id="drop" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#000" flood-opacity="0.38"/></filter>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.28"/></filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="blur8"><feGaussianBlur stdDeviation="8"/></filter>
  <linearGradient id="phoneEdge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b6170"/><stop offset="0.5" stop-color="#2a2e38"/><stop offset="1" stop-color="#4a505e"/></linearGradient>
  <linearGradient id="glare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="lockWall" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#3a2a8c"/><stop offset="0.55" stop-color="#b04a8f"/><stop offset="1" stop-color="#ff9a62"/></linearGradient>
  <linearGradient id="dawnWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1b45"/><stop offset="1" stop-color="#3b2d5c"/></linearGradient>
  <linearGradient id="dawnSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3e4fa8"/><stop offset="0.6" stop-color="#f08a6a"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>
  <linearGradient id="cafeWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1c18"/><stop offset="1" stop-color="#4a2d22"/></linearGradient>
  <linearGradient id="woodTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b57a4c"/><stop offset="1" stop-color="#8d5a36"/></linearGradient>
  <linearGradient id="wallet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a5534"/><stop offset="1" stop-color="#5e3520"/></linearGradient>
  <linearGradient id="cardA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f7bff"/><stop offset="1" stop-color="#1846b8"/></linearGradient>
  <linearGradient id="cardB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#ff6b3d"/></linearGradient>
  <linearGradient id="cardC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34c7a0"/><stop offset="1" stop-color="#16856b"/></linearGradient>
  <radialGradient id="vig" cx="0.5" cy="0.45" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
</defs>`;

// full-frame background: vertical gradient plus a soft glow behind the subject
export function bg(top, bottom, glow = null, gy = 760) {
  return `<linearGradient id="bgG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
  <rect width="1080" height="1920" fill="url(#bgG)"/>
  ${glow ? `<circle cx="540" cy="${gy}" r="520" fill="${glow}" opacity="0.35" filter="url(#blur8)"/><circle cx="540" cy="${gy}" r="300" fill="${glow}" opacity="0.25"/>` : ''}`;
}
export const vignette = () => `<rect width="1080" height="1920" fill="url(#vig)"/>`;

// ---------------------------------------------------------------- icons
export function wifi(x, y, s = 1, col = C.white, slash = false, level = 3) {
  const arcs = [[60, 1], [40, 2], [20, 3]].map(([r, i]) => `<path d="M ${-r} ${-r * 0.2} A ${r} ${r} 0 0 1 ${r} ${-r * 0.2}" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" opacity="${4 - i <= level ? 1 : 0.25}" transform="translate(0 ${r * 0.55})"/>`).join('');
  return `<g transform="translate(${x} ${y}) scale(${s})">${arcs}<circle cx="0" cy="${30}" r="8" fill="${col}"/>${slash ? `<line x1="-62" y1="-52" x2="62" y2="62" stroke="${C.red}" stroke-width="12" stroke-linecap="round"/>` : ''}</g>`;
}
export function bars(x, y, s = 1, col = C.white, n = 4) {
  return `<g transform="translate(${x} ${y}) scale(${s})">${[0, 1, 2, 3].map((i) => `<rect x="${i * 9}" y="${-6 - i * 4}" width="6" height="${6 + i * 4}" rx="1.5" fill="${col}" opacity="${i < n ? 1 : 0.3}"/>`).join('')}</g>`;
}
export function spinner(x, y, r, t, col = C.white, w = 10) {
  const a = (t * 360) % 360;
  return `<g transform="translate(${x} ${y}) rotate(${a})"><circle r="${r}" fill="none" stroke="${col}" stroke-opacity="0.18" stroke-width="${w}"/>
  <path d="M 0 ${-r} A ${r} ${r} 0 0 1 ${r} 0" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/></g>`;
}

// ---------------------------------------------------------------- the phone (380 x 780, centred on x, y)
const PW = 380, PH = 780, PR = 62;
export function phone({ x, y, s = 1, rot = 0, screen = '', id = 'p', light = 0 }) {
  const sw = PW - 28, sh = PH - 28;
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <g filter="url(#drop)">
      <rect x="${-PW / 2 - 5}" y="${-PH / 2 - 5}" width="${PW + 10}" height="${PH + 10}" rx="${PR + 5}" fill="url(#phoneEdge)"/>
      <rect x="${-PW / 2}" y="${-PH / 2}" width="${PW}" height="${PH}" rx="${PR}" fill="#07080c"/>
    </g>
    <rect x="${PW / 2 + 3}" y="-210" width="7" height="96" rx="3" fill="#454b59"/>
    <rect x="${-PW / 2 - 10}" y="-240" width="7" height="52" rx="3" fill="#454b59"/>
    <rect x="${-PW / 2 - 10}" y="-170" width="7" height="84" rx="3" fill="#454b59"/>
    <clipPath id="scr-${id}"><rect x="${-sw / 2}" y="${-sh / 2}" width="${sw}" height="${sh}" rx="${PR - 14}"/></clipPath>
    <g clip-path="url(#scr-${id})"><rect x="${-sw / 2}" y="${-sh / 2}" width="${sw}" height="${sh}" fill="#0f1220"/>${screen}</g>
    <rect x="-58" y="${-sh / 2 + 16}" width="116" height="34" rx="17" fill="#000"/>
    <rect x="${-PW / 2}" y="${-PH / 2}" width="${PW}" height="${PH}" rx="${PR}" fill="url(#glare)"/>
    ${light ? `<rect x="${-sw / 2}" y="${-sh / 2}" width="${sw}" height="${sh}" rx="${PR - 14}" fill="#fff" opacity="${light}"/>` : ''}
  </g>`;
}
// screen coordinates: x -176..176, y -376..376
export function statusBar({ dark = true, offline = false, time = '7:42' }) {
  const c = dark ? C.white : C.ink;
  return `<text x="-128" y="-326" font-family="InterW" font-weight="700" font-size="24" fill="${c}" text-anchor="middle">${time}</text>
  ${offline ? `<text x="78" y="-326" font-family="InterW" font-weight="700" font-size="17" fill="${C.red}" text-anchor="middle">NO SERVICE</text>` : bars(66, -326, 1, c)}
  <g transform="translate(130 -333)"><rect x="-17" y="-9" width="34" height="18" rx="5" fill="none" stroke="${c}" stroke-width="2.4"/><rect x="-14" y="-6" width="20" height="12" rx="2.5" fill="${c}"/><rect x="18" y="-4" width="3" height="8" rx="1.5" fill="${c}"/></g>`;
}
export function screenLock(t, { offline = false } = {}) {
  return `<rect x="-176" y="-376" width="352" height="752" fill="url(#lockWall)"/>
  ${statusBar({ offline })}
  <text x="0" y="-180" font-family="InterW" font-weight="600" font-size="22" fill="#fff" opacity="0.85" text-anchor="middle">Monday, June 2</text>
  <text x="0" y="-80" font-family="InterW" font-weight="800" font-size="118" fill="#fff" text-anchor="middle" letter-spacing="-4">7:42</text>
  <g transform="translate(0 250)"><rect x="-150" y="-46" width="300" height="92" rx="22" fill="#fff" opacity="0.2"/>
  <text x="0" y="-6" font-family="InterW" font-weight="700" font-size="22" fill="#fff" text-anchor="middle">Alarm</text><text x="0" y="24" font-family="InterW" font-weight="600" font-size="18" fill="#fff" opacity="0.8" text-anchor="middle">7:40 AM · Wake up</text></g>`;
}
export function screenNoInternet(t) {
  return `<rect x="-176" y="-376" width="352" height="752" fill="#11131c"/>
  ${statusBar({ offline: true })}
  ${wifi(0, -80, 1.25, '#c8cdd9', true)}
  <text x="0" y="60" font-family="InterW" font-weight="800" font-size="30" fill="#fff" text-anchor="middle">No Internet</text>
  <text x="0" y="98" font-family="InterW" font-weight="800" font-size="30" fill="#fff" text-anchor="middle">Connection</text>
  <text x="0" y="146" font-family="InterW" font-weight="600" font-size="18" fill="${C.grey}" text-anchor="middle">Check your connection</text>
  <text x="0" y="172" font-family="InterW" font-weight="600" font-size="18" fill="${C.grey}" text-anchor="middle">and try again.</text>
  <rect x="-90" y="214" width="180" height="58" rx="29" fill="${C.blue}"/><text x="0" y="252" font-family="InterW" font-weight="800" font-size="22" fill="#fff" text-anchor="middle">Retry</text>`;
}
const bubble = (x, y, w, h, txt, mine, op = 1) => `<g opacity="${op}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${mine ? C.blue : '#2a2e3b'}"/>
  <text x="${x + 18}" y="${y + h / 2 + 7}" font-family="InterW" font-weight="600" font-size="19" fill="#fff">${txt}</text></g>`;
export function screenMessages(t, u) {
  const k = ease.back(u / 0.35), fail = u > 0.55;
  return `<rect x="-176" y="-376" width="352" height="752" fill="#0b0d14"/>
  ${statusBar({ offline: true })}
  <text x="-150" y="-262" font-family="InterW" font-weight="800" font-size="34" fill="#fff">Messages</text>
  <circle cx="0" cy="-190" r="30" fill="#5f6b8a"/><text x="0" y="-180" font-family="InterW" font-weight="800" font-size="26" fill="#fff" text-anchor="middle">M</text>
  <text x="0" y="-138" font-family="InterW" font-weight="700" font-size="17" fill="${C.grey}" text-anchor="middle">Mom</text>
  ${bubble(-160, -96, 236, 52, 'Did you see the news?', false)}
  ${bubble(-60, -30, 220, 52, 'Wifi is dead here', true)}
  <g transform="translate(${160 - 220 * k} ${36}) scale(${k})" transform-origin="160 26">${bubble(0, 0, 220, 52, 'Are you okay?', true, fail ? 0.55 : 1)}</g>
  ${fail ? `<g transform="translate(-140 132)"><circle r="14" fill="${C.red}"/><text y="7" font-family="InterW" font-weight="800" font-size="20" fill="#fff" text-anchor="middle">!</text>
  <text x="24" y="7" font-family="InterW" font-weight="800" font-size="19" fill="${C.red}">Not Delivered</text></g>` : `<text x="150" y="132" font-family="InterW" font-weight="600" font-size="16" fill="${C.grey}" text-anchor="end">Sending…</text>`}`;
}
export function screenMaps(t, u) {
  let streets = '';
  for (let i = -6; i <= 6; i++) streets += `<rect x="${i * 70 - 8}" y="-376" width="16" height="752" fill="#d9dde6"/><rect x="-176" y="${i * 80 - 8}" width="352" height="16" fill="#d9dde6"/>`;
  return `<rect x="-176" y="-376" width="352" height="752" fill="#c7ccd6"/>
  <g opacity="0.55" filter="url(#blur8)">${streets}</g>
  ${statusBar({ dark: false, offline: true })}
  <g transform="translate(0 -250)"><rect x="-150" y="-30" width="300" height="60" rx="30" fill="#fff" filter="url(#soft)"/>
  <circle cx="-118" cy="0" r="13" fill="${C.red}"/><text x="-118" y="6" font-family="InterW" font-weight="800" font-size="16" fill="#fff" text-anchor="middle">!</text>
  <text x="-96" y="7" font-family="InterW" font-weight="700" font-size="19" fill="${C.ink}">Can't load map</text></g>
  <g transform="translate(0 30)"><path d="M 0 40 C -10 20 -36 -4 -36 -30 A 36 36 0 0 1 36 -30 C 36 -4 10 20 0 40 Z" fill="#9aa1b2"/><circle cx="0" cy="-30" r="13" fill="#c7ccd6"/></g>
  ${spinner(0, 220, 30, u * 1.4, '#6b7285', 8)}`;
}
export function screenBank(t, u) {
  const sk = (y, w) => `<rect x="-140" y="${y}" width="${w}" height="20" rx="10" fill="#e3e7ef"/>`;
  return `<rect x="-176" y="-376" width="352" height="752" fill="#f5f6fa"/>
  ${statusBar({ dark: false, offline: true })}
  <circle cx="-120" cy="-262" r="22" fill="${C.green}"/><text x="-120" y="-254" font-family="InterW" font-weight="800" font-size="22" fill="#fff" text-anchor="middle">$</text>
  <text x="-88" y="-254" font-family="InterW" font-weight="800" font-size="26" fill="${C.ink}">MyBank</text>
  <rect x="-150" y="-210" width="300" height="160" rx="22" fill="#1f2a44"/>
  <text x="-126" y="-160" font-family="InterW" font-weight="700" font-size="17" fill="#9fb0d8">Balance</text>
  <rect x="-126" y="-138" width="170" height="34" rx="10" fill="#33415f"/>
  ${spinner(0, 90, 54, u * 1.2, C.green, 12)}
  <text x="0" y="190" font-family="InterW" font-weight="700" font-size="22" fill="#6b7285" text-anchor="middle">Loading…</text>
  ${sk(240, 260)}${sk(280, 200)}${sk(320, 230)}`;
}

// ---------------------------------------------------------------- a right hand holding the phone (drawn around the phone's frame)
export function handBack(x, y, s = 1, rot = 0) {
  // palm and the wrist/sleeve, behind the phone
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <path d="M 60 300 C 150 280 230 330 250 440 L 250 900 L -60 900 L -40 520 C -30 420 -10 330 60 300 Z" fill="${C.sleeve}"/>
    <rect x="-250" y="30" width="130" height="300" rx="56" fill="${C.skinS}"/>
    <path d="M -150 230 C -170 330 -120 420 -20 450 C 90 480 200 430 215 330 C 225 260 200 200 160 190 L -120 190 Z" fill="${C.skinS}"/>
  </g>`;
}
export function handFront(x, y, s = 1, rot = 0) {
  // fingers wrapping the left edge, thumb over the right edge
  const f = (fy, w) => `<rect x="-232" y="${fy}" width="${w}" height="54" rx="27" fill="${C.skin}"/><rect x="-232" y="${fy + 34}" width="${w}" height="20" rx="10" fill="${C.skinS}" opacity="0.6"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    ${f(40, 74)}${f(104, 80)}${f(168, 76)}${f(232, 66)}
    <path d="M 168 170 C 214 150 236 200 220 250 C 204 300 150 320 120 300 C 100 286 110 250 130 230 C 150 210 140 184 168 170 Z" fill="${C.skin}"/>
    <path d="M 214 250 C 200 290 160 312 128 302" fill="none" stroke="${C.skinS}" stroke-width="8" stroke-linecap="round" opacity="0.7"/>
  </g>`;
}
// phone held in a hand: one call draws hand back, phone, hand front
export function heldPhone({ x, y, s = 1, rot = 0, screen = '', id = 'h', light = 0 }) {
  return handBack(x, y, s, rot) + phone({ x, y, s, rot, screen, id, light }) + handFront(x, y, s, rot);
}

// ---------------------------------------------------------------- scenes' props
export function alarmClock(x, y, s = 1, t = 0) {
  const on = Math.floor(t * 2) % 2 === 0;
  return `<g transform="translate(${x} ${y}) scale(${s})" filter="url(#soft)">
    <rect x="-110" y="-60" width="220" height="120" rx="26" fill="#23263a"/>
    <rect x="-90" y="-40" width="180" height="70" rx="12" fill="#0b0c14"/>
    <text x="0" y="16" font-family="InterW" font-weight="800" font-size="52" fill="${C.red}" text-anchor="middle" opacity="${on ? 1 : 0.35}">7:42</text></g>`;
}
export function cup(x, y, s = 1, t = 0) {
  const steam = [0, 1, 2].map((i) => { const ph = t * 1.4 + i * 0.33, up = (ph % 1) * 90; return `<path d="M ${-30 + i * 30} ${-130 - up} q 14 -20 0 -40 q -14 -20 0 -40" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity="${0.5 * (1 - (ph % 1))}"/>`; }).join('');
  return `<g transform="translate(${x} ${y}) scale(${s})">${steam}
    <g filter="url(#soft)"><path d="M -80 -110 L 80 -110 L 66 80 Q 64 100 44 100 L -44 100 Q -64 100 -66 80 Z" fill="#f4efe8"/>
    <rect x="-86" y="-128" width="172" height="26" rx="10" fill="#e6dfd4"/>
    <path d="M -76 -40 L 76 -40 L 70 30 L -70 30 Z" fill="#8a5a3c"/>
    <text x="0" y="6" font-family="InterW" font-weight="800" font-size="24" fill="#f4efe8" text-anchor="middle">COFFEE</text></g></g>`;
}
export function terminal(x, y, s = 1, { state = 'tap', t = 0, rot = 0 } = {}) {
  const red = state === 'declined';
  const keys = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) keys.push(`<rect x="${-78 + c * 56}" y="${86 + r * 40}" width="44" height="30" rx="8" fill="#2e3242"/>`);
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <g filter="url(#drop)"><rect x="-120" y="-200" width="240" height="460" rx="40" fill="#1a1d27"/></g>
    <rect x="-96" y="-176" width="192" height="230" rx="18" fill="${red ? '#5a0f16' : '#0d2a1a'}"/>
    ${red ? `<circle cx="0" cy="-90" r="46" fill="${C.red}"/><path d="M -20 -110 L 20 -70 M 20 -110 L -20 -70" stroke="#fff" stroke-width="12" stroke-linecap="round"/>
      <text x="0" y="0" font-family="InterW" font-weight="800" font-size="34" fill="#fff" text-anchor="middle">DECLINED</text>
      <text x="0" y="32" font-family="InterW" font-weight="700" font-size="16" fill="#ffb3b3" text-anchor="middle">No connection</text>`
    : `<text x="0" y="-110" font-family="InterW" font-weight="800" font-size="46" fill="#9fffb8" text-anchor="middle">$4.90</text>
      <text x="0" y="-78" font-family="InterW" font-weight="700" font-size="20" fill="#9fffb8" text-anchor="middle" opacity="0.8">(€4.50)</text>
      <g transform="translate(0 -12)" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round">${[14, 28, 42].map((r) => `<path d="M ${r * 0.5} ${-r} A ${r} ${r} 0 0 1 ${r * 0.5} ${r}" opacity="${0.4 + 0.6 * (Math.floor(t * 3) % 3 >= r / 14 - 1 ? 1 : 0)}"/>`).join('')}</g>
      <text x="0" y="36" font-family="InterW" font-weight="800" font-size="18" fill="#fff" text-anchor="middle">TAP CARD</text>`}
    ${keys.join('')}
  </g>`;
}
export function card(x, y, s = 1, rot = 0, grad = 'cardA') {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" filter="url(#soft)">
    <rect x="-150" y="-95" width="300" height="190" rx="18" fill="url(#${grad})"/>
    <rect x="-120" y="-40" width="54" height="40" rx="8" fill="#ffd27a"/>
    <text x="-120" y="60" font-family="InterW" font-weight="700" font-size="20" fill="#fff" opacity="0.9" letter-spacing="3">•••• 4821</text></g>`;
}
export function handCard(x, y, s = 1, rot = 0) {
  // a hand pinching a card from the right
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <path d="M 120 -40 C 220 -60 330 -30 420 10 L 420 200 C 330 190 220 160 150 120 Z" fill="${C.sleeve}"/>
    ${card(-20, 0, 1, -8)}
    <path d="M 90 -70 C 150 -90 210 -60 220 0 C 230 60 190 110 130 110 C 90 110 60 70 70 30 Z" fill="${C.skin}"/>
    <rect x="40" y="-40" width="90" height="40" rx="20" fill="${C.skin}"/>
  </g>`;
}
export function sign(x, y, s = 1, rot = 0, txt = 'CASH ONLY') {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <path d="M -120 -260 L 0 -340 L 120 -260" fill="none" stroke="#c9ccd6" stroke-width="6"/><circle cx="0" cy="-340" r="12" fill="#c9ccd6"/>
    <g filter="url(#drop)"><rect x="-300" y="-260" width="600" height="300" rx="34" fill="${C.red}"/></g>
    <rect x="-280" y="-240" width="560" height="260" rx="24" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="18 12"/>
    ${txt.split(' ').map((w, i) => `<text x="0" y="${-138 + i * 104}" font-family="MontB" font-weight="900" font-size="104" fill="#fff" text-anchor="middle">${w}</text>`).join('')}
  </g>`;
}
export function wallet(x, y, s = 1, t = 0, u = 0) {
  // open wallet, cards but no cash; a moth flutters out of the empty bill slot
  const mx = 40 + u * 260, my = -150 - u * 330 + Math.sin(u * 18) * 30, flap = 0.4 + 0.6 * Math.abs(Math.sin(t * 22));
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <g filter="url(#drop)"><rect x="-330" y="-180" width="660" height="400" rx="40" fill="url(#wallet)"/></g>
    <rect x="-310" y="-160" width="300" height="360" rx="26" fill="#6b3d24"/><rect x="10" y="-160" width="300" height="360" rx="26" fill="#6b3d24"/>
    ${card(-160, -70, 0.8, 0, 'cardA')}${card(-160, 20, 0.8, 0, 'cardB')}${card(-160, 110, 0.8, 0, 'cardC')}
    <rect x="30" y="-130" width="260" height="300" rx="20" fill="#4a2817"/>
    <text x="160" y="40" font-family="MontB" font-weight="900" font-size="80" fill="#8a5a3c" text-anchor="middle" opacity="0.8">$0</text>
    <g transform="translate(${mx} ${my})"><ellipse cx="0" cy="0" rx="10" ry="22" fill="#d7cbb4"/>
      <ellipse cx="-22" cy="-6" rx="${26 * flap}" ry="18" fill="#efe6d2" opacity="0.95"/><ellipse cx="22" cy="-6" rx="${26 * flap}" ry="18" fill="#efe6d2" opacity="0.95"/></g>
  </g>`;
}
// the big chapter stamp (DAY 1 …)
export function stamp(txt, u, y = 470) {
  const k = ease.back(u / 0.22), sc = (1.8 - 0.8 * k), size = Math.min(230, 900 / (txt.length * 0.6));
  return `<g transform="translate(540 ${y}) scale(${sc})" opacity="${clamp(u * 5)}">
    <text x="0" y="0" font-family="MontB" font-weight="900" font-size="${size}" fill="#fff" text-anchor="middle" stroke="#000" stroke-width="14" paint-order="stroke" letter-spacing="-4">${txt}</text>
    <rect x="${-260 * clamp((u - 0.1) / 0.3)}" y="40" width="${520 * clamp((u - 0.1) / 0.3)}" height="16" rx="8" fill="${C.coral}"/></g>`;
}

// ================================================================ more of the world (people, places, machines)
// a flat person: head r 46, feet at (x, y). pose: stand | walk | wave | talk | panic | cheer
export function person(x, y, s = 1, { shirt = C.coral, pants = '#2a3550', skin = C.skin, hair = '#3a2418', pose = 'stand', t = 0, face = 'neutral', flip = 1, seed = 0 } = {}) {
  const ph = t * 7 + seed * 2.1, sw = pose === 'walk' ? Math.sin(ph) * 22 : 0;
  const armL = pose === 'wave' ? -150 + Math.sin(t * 10 + seed) * 22 : pose === 'cheer' ? -160 + Math.sin(t * 12 + seed) * 10 : pose === 'panic' ? -140 : pose === 'talk' ? 30 + Math.sin(t * 6 + seed) * 18 : 12 + sw;
  const armR = pose === 'cheer' ? 160 - Math.sin(t * 12 + seed) * 10 : pose === 'panic' ? 140 : -12 - sw;
  const bob = pose === 'walk' ? Math.abs(Math.cos(ph)) * 6 : pose === 'cheer' ? Math.abs(Math.sin(t * 12 + seed)) * 10 : 0;
  const limb = (px, py, ang, len, w, col) => `<g transform="translate(${px} ${py}) rotate(${ang})"><rect x="${-w / 2}" y="0" width="${w}" height="${len}" rx="${w / 2}" fill="${col}"/></g>`;
  const eyes = face === 'panic' ? `<circle cx="-15" cy="-6" r="9" fill="#fff"/><circle cx="15" cy="-6" r="9" fill="#fff"/><circle cx="-15" cy="-6" r="4" fill="#111"/><circle cx="15" cy="-6" r="4" fill="#111"/>`
    : `<circle cx="-14" cy="-6" r="5" fill="#1a1a22"/><circle cx="14" cy="-6" r="5" fill="#1a1a22"/>`;
  const mouth = face === 'panic' ? `<ellipse cx="0" cy="20" rx="11" ry="14" fill="#5a1a1a"/>` : face === 'happy' || pose === 'cheer' ? `<path d="M -16 14 Q 0 32 16 14" fill="#5a1a1a"/>`
    : pose === 'talk' ? `<ellipse cx="0" cy="18" rx="9" ry="${4 + 5 * Math.abs(Math.sin(t * 9 + seed))}" fill="#5a1a1a"/>` : `<path d="M -12 18 Q 0 24 12 18" stroke="#5a1a1a" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  return `<g transform="translate(${x} ${y - bob}) scale(${s * flip} ${s})">
    ${limb(-22, -150, sw, 150, 34, pants)}${limb(22, -150, -sw, 150, 34, pants)}
    ${limb(-58, -300, armL, 120, 30, skin)}${limb(58, -300, armR, 120, 30, skin)}
    <rect x="-62" y="-320" width="124" height="180" rx="44" fill="${shirt}"/>
    <rect x="-14" y="-340" width="28" height="30" fill="${skin}"/>
    <g transform="translate(0 -386)"><circle r="50" fill="${skin}"/><path d="M -52 -6 C -50 -60 50 -64 52 -8 C 40 -30 -36 -34 -52 -6 Z" fill="${hair}"/>${eyes}${mouth}
    ${face === 'panic' ? `<path d="M 48 -30 q 8 14 0 22 q -8 -8 0 -22 Z" fill="#6cc6ff"/>` : ''}</g></g>`;
}
export function cityline(y, t = 0, on = 1, col = '#1b2550', seed = 1) {
  let s = '';
  for (let i = 0; i < 12; i++) {
    const w = 70 + (hash(i, seed) * 60) | 0, h = 180 + (hash(i, seed + 1) * 340) | 0, x = i * 92 - 20;
    s += `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${col}"/>`;
    for (let r = 0; r < h / 46 - 1; r++) for (let c2 = 0; c2 < w / 30 - 1; c2++) {
      const lit = hash(i * 31 + r * 7 + c2, seed + 2) < 0.55 * on;
      if (lit) s += `<rect x="${x + 10 + c2 * 30}" y="${y - h + 16 + r * 46}" width="16" height="22" rx="3" fill="#ffd27a" opacity="${0.75 + 0.25 * Math.sin(t * 2 + i + r)}"/>`;
    }
  }
  return s;
}
// a flat globe with land blobs; `dark` 0..1 switches the city lights off, west to east
export function globe(x, y, r, t = 0, { dark = 0, lines = 0, spin = 0, cut = -1 } = {}) {
  const land = [[-0.35, -0.25, 0.32, 0.22], [-0.2, 0.25, 0.18, 0.3], [0.25, -0.2, 0.36, 0.2], [0.3, 0.2, 0.16, 0.16], [0.55, 0.45, 0.14, 0.1], [-0.6, 0.05, 0.12, 0.2]];
  const dx = ((spin * r) % (2 * r));
  let blobs = '', lights = '', links = '';
  land.forEach(([a, b, w, h], i) => {
    for (const off of [0, -2 * r, 2 * r]) blobs += `<ellipse cx="${a * r + dx + off}" cy="${b * r}" rx="${w * r}" ry="${h * r}" fill="#3fbf7f" opacity="0.95"/>`;
    for (let k = 0; k < 6; k++) {
      const lx = a * r + dx + (hash(i, k) - 0.5) * w * r * 1.4, ly = b * r + (hash(k, i) - 0.5) * h * r * 1.4;
      const off = (lx + r) / (2 * r) < dark;
      if (Math.abs(lx) < r * 0.95 && !off) lights += `<circle cx="${lx}" cy="${ly}" r="${6 + 3 * Math.sin(t * 4 + k + i)}" fill="#ffe38a" filter="url(#glow)"/>`;
    }
  });
  if (lines) {
    const pts = [[-0.5, -0.3], [-0.15, 0.3], [0.3, -0.25], [0.35, 0.25], [0.6, 0.45], [-0.6, 0.1]];
    pts.forEach((p, i) => pts.forEach((q, j) => { if (j <= i || (i + j) % 2) return;
      const mx = (p[0] + q[0]) / 2 * r, my = (p[1] + q[1]) / 2 * r - 0.25 * r;
      const isCut = cut >= 0 && i === 0 && j === 2 + cut * 0;
      links += `<path d="M ${p[0] * r} ${p[1] * r} Q ${mx} ${my} ${q[0] * r} ${q[1] * r}" fill="none" stroke="${isCut ? C.red : '#7fe8ff'}" stroke-width="5" stroke-dasharray="${isCut ? '10 14' : '0'}" opacity="${lines}"/>`;
      const u = (t * 0.6 + i * 0.13 + j * 0.07) % 1, bx = (1 - u) * (1 - u) * p[0] * r + 2 * (1 - u) * u * mx + u * u * q[0] * r, by = (1 - u) * (1 - u) * p[1] * r + 2 * (1 - u) * u * my + u * u * q[1] * r;
      if (!isCut) links += `<circle cx="${bx}" cy="${by}" r="8" fill="#fff" opacity="${lines}" filter="url(#glow)"/>`;
    }));
  }
  return `<g transform="translate(${x} ${y})"><clipPath id="gclip"><circle r="${r}"/></clipPath>
    <circle r="${r * 1.08}" fill="#4aa8ff" opacity="0.18" filter="url(#blur8)"/>
    <circle r="${r}" fill="#1f5fae"/><g clip-path="url(#gclip)">${blobs}<circle cx="${r * 0.35}" cy="${-r * 0.1}" r="${r}" fill="#000" opacity="${0.15 + 0.45 * dark}"/>${lights}</g>
    ${links}<circle r="${r}" fill="none" stroke="#9fd2ff" stroke-width="4" opacity="0.5"/></g>`;
}
export function router(x, y, s = 1, t = 0, dead = false) {
  const led = (i) => dead ? (i === 0 ? C.red : '#333') : (Math.floor(t * 8 + i * 1.7) % 3 ? C.green : '#1d6b33');
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-120" y="-240" width="14" height="150" rx="7" fill="#2a2e3b" transform="rotate(-12 -113 -90)"/><rect x="106" y="-240" width="14" height="150" rx="7" fill="#2a2e3b" transform="rotate(12 113 -90)"/>
    <g filter="url(#drop)"><rect x="-200" y="-100" width="400" height="130" rx="34" fill="#e9ecf3"/></g>
    ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${-120 + i * 60}" cy="-36" r="11" fill="${led(i)}"/>`).join('')}
    ${dead ? '' : wifi(0, -330, 1.3, '#7fe8ff', false, 3)}</g>`;
}
export function xmark(x, y, s = 1, u = 1) {
  const k = ease.back(u / 0.25);
  return `<g transform="translate(${x} ${y}) scale(${s * k})" opacity="${clamp(u * 6)}"><circle r="110" fill="${C.red}" filter="url(#drop)"/>
    <path d="M -45 -45 L 45 45 M 45 -45 L -45 45" stroke="#fff" stroke-width="26" stroke-linecap="round"/></g>`;
}
export function check(x, y, s = 1, u = 1) {
  const k = ease.back(u / 0.25);
  return `<g transform="translate(${x} ${y}) scale(${s * k})" opacity="${clamp(u * 6)}"><circle r="90" fill="${C.green}" filter="url(#drop)"/>
    <path d="M -40 2 L -10 32 L 44 -28" stroke="#fff" stroke-width="24" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}
export function calendar(x, y, s = 1, t = 0, crossed = 0, hi = -1) {
  let cells = '';
  for (let i = 0; i < 7; i++) {
    const cx = -270 + (i % 4) * 180, cy = -60 + Math.floor(i / 4) * 180, on = i < crossed, pop = i === hi ? 1 + 0.12 * Math.sin(t * 8) : 1;
    cells += `<g transform="translate(${cx + (i >= 4 ? 90 : 0)} ${cy}) scale(${pop})"><rect x="-70" y="-70" width="140" height="140" rx="22" fill="${i === hi ? C.yellow : '#fff'}"/>
      <text y="22" font-family="MontB" font-weight="900" font-size="64" fill="${C.ink}" text-anchor="middle">${i + 1}</text>
      ${on ? `<path d="M -50 -50 L 50 50 M 50 -50 L -50 50" stroke="${C.red}" stroke-width="16" stroke-linecap="round"/>` : ''}</g>`;
  }
  return `<g transform="translate(${x} ${y}) scale(${s})"><g filter="url(#drop)"><rect x="-380" y="-260" width="760" height="560" rx="44" fill="#eef1f8"/></g>
    <rect x="-380" y="-260" width="760" height="110" rx="44" fill="${C.coral}"/><rect x="-380" y="-190" width="760" height="40" fill="${C.coral}"/>
    <text y="-188" font-family="MontB" font-weight="900" font-size="54" fill="#fff" text-anchor="middle">ONE WEEK</text>
    <rect x="-250" y="-290" width="22" height="70" rx="11" fill="#5b6170"/><rect x="228" y="-290" width="22" height="70" rx="11" fill="#5b6170"/>${cells}</g>`;
}
export function icon(kind, x, y, s = 1) {
  const g = (inner) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="62" fill="#fff" filter="url(#soft)"/>${inner}</g>`;
  if (kind === 'phone') return g(`<rect x="-20" y="-36" width="40" height="72" rx="9" fill="${C.ink}"/><rect x="-15" y="-28" width="30" height="52" rx="4" fill="${C.blue}"/>`);
  if (kind === 'plane') return g(`<path d="M -40 6 L 40 -6 M 0 -40 L 8 0 L 0 40 M -30 -14 L -36 18" stroke="${C.ink}" stroke-width="12" stroke-linecap="round" fill="none"/>`);
  if (kind === 'cart') return g(`<path d="M -40 -26 L -28 -26 L -16 18 L 30 18 L 38 -12 L -22 -12" stroke="${C.ink}" stroke-width="9" fill="none" stroke-linejoin="round"/><circle cx="-10" cy="32" r="7" fill="${C.ink}"/><circle cx="24" cy="32" r="7" fill="${C.ink}"/>`);
  if (kind === 'radio') return g(`<rect x="-40" y="-22" width="80" height="50" rx="10" fill="${C.coral}"/><circle cx="-14" cy="3" r="13" fill="#fff"/><path d="M 20 -22 L 34 -46" stroke="${C.ink}" stroke-width="6"/>`);
  if (kind === 'door') return g(`<rect x="-26" y="-40" width="52" height="80" rx="6" fill="${C.wood}"/><circle cx="14" cy="4" r="5" fill="${C.yellow}"/>`);
  if (kind === 'bell') return g(`<path d="M -30 18 Q -30 -34 0 -36 Q 30 -34 30 18 Z" fill="${C.yellow}"/><rect x="-36" y="14" width="72" height="10" rx="5" fill="${C.yellow}"/><circle cx="0" cy="32" r="8" fill="${C.yellow}"/>`);
  return g('');
}
export function couch(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-300" y="-150" width="600" height="160" rx="50" fill="#5b4bb8"/>
    <rect x="-340" y="-60" width="100" height="170" rx="40" fill="#4a3c9e"/><rect x="240" y="-60" width="100" height="170" rx="40" fill="#4a3c9e"/>
    <rect x="-280" y="-10" width="560" height="110" rx="30" fill="#6a5ad0"/><rect x="-280" y="100" width="20" height="40" fill="#2a2148"/><rect x="260" y="100" width="20" height="40" fill="#2a2148"/></g>`;
}
export function officeBuilding(x, y, s = 1, t = 0, out = 0) {
  let win = '';
  for (let r = 0; r < 7; r++) for (let c2 = 0; c2 < 5; c2++) { const lit = hash(r * 5 + c2, 3) > out; win += `<rect x="${-200 + c2 * 82}" y="${-760 + r * 92}" width="56" height="64" rx="6" fill="${lit ? '#ffd27a' : '#1e2747'}"/>`; }
  return `<g transform="translate(${x} ${y}) scale(${s})"><g filter="url(#drop)"><rect x="-240" y="-800" width="480" height="800" rx="20" fill="#3a4a7a"/></g>${win}
    <rect x="-70" y="-130" width="140" height="130" rx="10" fill="#1a2240"/>
    <g transform="translate(0 -170) rotate(${4 * Math.sin(t * 3)})"><rect x="-130" y="-34" width="260" height="68" rx="12" fill="${C.red}"/><text y="14" font-family="MontB" font-weight="900" font-size="40" fill="#fff" text-anchor="middle">CLOSED</text></g></g>`;
}
export function board(x, y, s = 1, t = 0, u = 0) {
  const rows = ['LONDON  BA 178', 'TOKYO   JL 005', 'DUBAI   EK 202', 'PARIS   AF 023', 'SYDNEY  QF 012', 'TORONTO AC 761'];
  let r = '';
  rows.forEach((row, i) => {
    const flip = clamp((u - 0.12 * i) / 0.2), cancelled = flip > 0.5, sq = Math.abs(Math.cos(flip * Math.PI));
    r += `<g transform="translate(0 ${-200 + i * 86})"><rect x="-420" y="-34" width="840" height="68" rx="8" fill="#151a24"/>
      <text x="-396" y="14" font-family="InterW" font-weight="800" font-size="38" fill="#ffd34d" letter-spacing="2">${row}</text>
      <g transform="translate(250 0) scale(1 ${Math.max(0.05, sq)})"><rect x="-150" y="-28" width="300" height="56" rx="6" fill="${cancelled ? C.red : '#1f5d34'}"/>
      <text y="13" font-family="InterW" font-weight="800" font-size="30" fill="#fff" text-anchor="middle">${cancelled ? 'CANCELLED' : 'ON TIME'}</text></g></g>`;
  });
  return `<g transform="translate(${x} ${y}) scale(${s})"><g filter="url(#drop)"><rect x="-450" y="-320" width="900" height="640" rx="30" fill="#0a0d14"/></g>
    <text x="-410" y="-260" font-family="MontB" font-weight="900" font-size="44" fill="#fff">DEPARTURES</text>${r}</g>`;
}
export function plane(x, y, s = 1, rot = 0, col = '#f3f5fa') {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" filter="url(#soft)">
    <path d="M -260 0 C -260 -40 200 -46 270 -14 C 300 0 270 14 230 18 L -230 28 C -255 28 -260 20 -260 0 Z" fill="${col}"/>
    <path d="M -40 0 L 60 -170 L 110 -170 L 60 4 Z" fill="#d9dde8"/><path d="M -40 16 L 40 170 L 90 170 L 50 16 Z" fill="#c9cfdc"/>
    <path d="M -230 -6 L -260 -110 L -215 -110 L -170 -10 Z" fill="${C.coral}"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="${-150 + i * 50}" cy="-12" r="9" fill="#5b8bd9"/>`).join('')}</g>`;
}
export function newspaper(x, y, s = 1, rot = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><g filter="url(#drop)"><rect x="-340" y="-420" width="680" height="840" rx="12" fill="#f3efe4"/></g>
    <text y="-330" font-family="Garamond" font-weight="600" font-size="72" fill="#222" text-anchor="middle">THE DAILY NEWS</text>
    <rect x="-300" y="-305" width="600" height="6" fill="#222"/><text x="-300" y="-260" font-family="InterW" font-weight="700" font-size="24" fill="#555">FRIDAY, JULY 19, 2024</text>
    <text y="-150" font-family="MontB" font-weight="900" font-size="70" fill="#111" text-anchor="middle">ONE BAD UPDATE</text>
    <text y="-70" font-family="MontB" font-weight="900" font-size="58" fill="${C.red}" text-anchor="middle">GROUNDS FLIGHTS</text>
    <rect x="-300" y="-20" width="300" height="220" fill="#c9ccd6"/>${plane(-150, 90, 0.42, -8, '#fff')}
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="30" y="${-10 + i * 32}" width="${270 - (i % 3) * 30}" height="14" rx="7" fill="#bdb6a6"/>`).join('')}
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="-300" y="${240 + i * 32}" width="${600 - (i % 2) * 80}" height="14" rx="7" fill="#bdb6a6"/>`).join('')}</g>`;
}
export function laptopBSOD(x, y, s = 1, t = 0, u = 0) {
  const p = Math.min(0.99, ease.out(u / 1.2) * 0.47);
  return `<g transform="translate(${x} ${y}) scale(${s})"><g filter="url(#drop)"><rect x="-380" y="-300" width="760" height="480" rx="28" fill="#2a2e38"/></g>
    <rect x="-350" y="-272" width="700" height="424" rx="10" fill="#1665c0"/>
    <text x="-300" y="-150" font-family="InterW" font-weight="600" font-size="120" fill="#fff">:(</text>
    <text x="-300" y="-50" font-family="InterW" font-weight="700" font-size="34" fill="#fff">Your PC ran into a problem.</text>
    <text x="-300" y="0" font-family="InterW" font-weight="600" font-size="26" fill="#d6e6ff">Applying update…  ${Math.round(p * 100)}% complete</text>
    <rect x="-300" y="40" width="600" height="20" rx="10" fill="#0d4a94"/><rect x="-300" y="40" width="${600 * p}" height="20" rx="10" fill="#fff"/>
    <path d="M -440 180 L 440 180 L 400 230 L -400 230 Z" fill="#3a3f4b"/></g>`;
}
export function shelves(x, y, s = 1, t = 0, left = 1, freshLeft = 1) {
  const cols = ['#ff6b6b', '#ffd84a', '#4cc9f0', '#7bd389', '#c77dff', '#ff9f43'];
  let items = '';
  for (let r = 0; r < 4; r++) for (let i = 0; i < 8; i++) {
    const k = hash(r * 8 + i, 9), fresh = r === 3;
    if ((fresh ? k > freshLeft : k > left)) continue;
    const col = fresh ? ['#ff5a4f', '#7ac74f', '#ffa53b', '#ffd84a'][(r + i) % 4] : cols[(r * 3 + i) % cols.length];
    items += fresh ? `<circle cx="${-340 + i * 96}" cy="${-300 + r * 190}" r="34" fill="${col}"/><circle cx="${-322 + i * 96}" cy="${-312 + r * 190}" r="9" fill="#fff" opacity="0.4"/>`
      : `<rect x="${-372 + i * 96}" y="${-370 + r * 190}" width="64" height="${100 - (k * 40 | 0)}" rx="10" fill="${col}"/><rect x="${-362 + i * 96}" y="${-350 + r * 190}" width="44" height="18" rx="4" fill="#fff" opacity="0.7"/>`;
  }
  return `<g transform="translate(${x} ${y}) scale(${s})"><g filter="url(#drop)"><rect x="-420" y="-460" width="840" height="820" rx="24" fill="#d9dde8"/></g>
    ${[0, 1, 2, 3].map((r) => `<rect x="-400" y="${-262 + r * 190}" width="800" height="22" rx="6" fill="#9aa3b8"/>`).join('')}${items}
    <rect x="-400" y="${-262 + 3 * 190 + 30}" width="250" height="56" rx="10" fill="${C.green}"/><text x="-275" y="${-262 + 3 * 190 + 70}" font-family="MontB" font-weight="900" font-size="30" fill="#fff" text-anchor="middle">FRESH</text></g>`;
}
export function satellite(x, y, s = 1, t = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${-20 + 4 * Math.sin(t)}) scale(${s})">
    <rect x="-300" y="-50" width="200" height="100" rx="8" fill="#2f5fbf"/><rect x="100" y="-50" width="200" height="100" rx="8" fill="#2f5fbf"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="${-290 + i * 48}" y="-42" width="40" height="84" fill="#4a86f0"/><rect x="${110 + i * 48}" y="-42" width="40" height="84" fill="#4a86f0"/>`).join('')}
    <rect x="-100" y="-10" width="200" height="20" fill="#9aa3b8"/><rect x="-70" y="-80" width="140" height="160" rx="22" fill="#e9ecf3" filter="url(#soft)"/>
    <circle cx="0" cy="-110" r="32" fill="#c9ccd6"/><circle cx="0" cy="-110" r="10" fill="${C.red}" opacity="${0.5 + 0.5 * Math.sin(t * 8)}"/></g>`;
}
export function radio(x, y, s = 1, t = 0) {
  const waves = [0, 1, 2].map((i) => { const ph = (t * 1.2 + i / 3) % 1; return `<path d="M ${200 + ph * 160} ${-120 - ph * 60} A ${120 + ph * 200} ${120 + ph * 200} 0 0 1 ${200 + ph * 160} ${120 + ph * 60}" fill="none" stroke="${C.yellow}" stroke-width="12" stroke-linecap="round" opacity="${1 - ph}"/>`; }).join('');
  const notes = [0, 1].map((i) => { const ph = (t * 0.7 + i * 0.5) % 1; return `<text x="${-160 + i * 120 + ph * 40}" y="${-260 - ph * 200}" font-size="70" fill="#fff" opacity="${1 - ph}" font-family="InterW">♪</text>`; }).join('');
  return `<g transform="translate(${x} ${y}) scale(${s})">${waves}${notes}
    <path d="M 140 -150 L 230 -330" stroke="#c9ccd6" stroke-width="12" stroke-linecap="round"/><circle cx="230" cy="-330" r="12" fill="#c9ccd6"/>
    <g filter="url(#drop)"><rect x="-260" y="-160" width="520" height="320" rx="48" fill="#c0392b"/></g>
    <rect x="-230" y="-130" width="460" height="260" rx="34" fill="#e74c3c"/>
    <circle cx="-100" cy="10" r="100" fill="#3a1a14"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="-170" y="${-48 + i * 26}" width="140" height="10" rx="5" fill="#5a2a22"/>`).join('')}
    <rect x="40" y="-90" width="160" height="70" rx="12" fill="#f8e7c2"/><rect x="${60 + 110 * (0.5 + 0.5 * Math.sin(t * 0.8))}" y="-86" width="6" height="62" fill="${C.red}"/>
    <circle cx="80" cy="60" r="34" fill="#f8e7c2"/><circle cx="170" cy="60" r="34" fill="#f8e7c2"/></g>`;
}
export function screenCall(t, u) {
  const on = u > 0.9, secs = Math.max(0, Math.floor(u - 0.9));
  return `<rect x="-176" y="-376" width="352" height="752" fill="${on ? '#0f3d24' : '#14172a'}"/>${statusBar({ offline: true })}
    <circle cx="0" cy="-160" r="70" fill="#5f6b8a"/><text x="0" y="-136" font-family="InterW" font-weight="800" font-size="64" fill="#fff" text-anchor="middle">M</text>
    <text x="0" y="-50" font-family="InterW" font-weight="800" font-size="40" fill="#fff" text-anchor="middle">Mom</text>
    <text x="0" y="-6" font-family="InterW" font-weight="600" font-size="24" fill="${on ? '#9fffb8' : C.grey}" text-anchor="middle">${on ? `Connected · 0:0${secs}` : 'Calling…'}</text>
    ${on ? '' : [0, 1, 2].map((i) => `<circle cx="0" cy="-160" r="${70 + ((u * 1.2 + i / 3) % 1) * 90}" fill="none" stroke="#fff" stroke-width="4" opacity="${1 - ((u * 1.2 + i / 3) % 1)}"/>`).join('')}
    <circle cx="-90" cy="250" r="44" fill="${on ? '#2a2e3b' : C.green}"/><circle cx="90" cy="250" r="44" fill="${C.red}"/>
    <path d="M 70 250 L 110 250" stroke="#fff" stroke-width="10" stroke-linecap="round"/><path d="M -110 240 q 20 30 40 10" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"/>`;
}
export function screenGPS(t, u) {
  let streets = '';
  for (let i = -6; i <= 6; i++) streets += `<rect x="${i * 70 - 7}" y="-376" width="14" height="752" fill="#fff"/><rect x="-176" y="${i * 80 - 7}" width="352" height="14" fill="#fff"/>`;
  const pr = (u * 1.5) % 1;
  return `<rect x="-176" y="-376" width="352" height="752" fill="#e8eef5"/>${streets}<rect x="-60" y="-180" width="120" height="100" fill="#bfe6c4"/><rect x="40" y="120" width="130" height="90" fill="#bfe6c4"/>
    <path d="M -100 300 L -100 120 L 0 120 L 0 0" fill="none" stroke="${C.blue}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    ${statusBar({ dark: false, offline: true })}
    <circle cx="0" cy="0" r="${30 + pr * 60}" fill="${C.blue}" opacity="${0.35 * (1 - pr)}"/><circle cx="0" cy="0" r="24" fill="#fff"/><circle cx="0" cy="0" r="17" fill="${C.blue}"/>
    <g transform="translate(0 -270)"><rect x="-130" y="-30" width="260" height="60" rx="30" fill="#fff" filter="url(#soft)"/>
    <circle cx="-100" cy="0" r="14" fill="${C.green}"/><path d="M -107 0 L -101 6 L -92 -6" stroke="#fff" stroke-width="4" fill="none"/>
    <text x="-78" y="8" font-family="InterW" font-weight="800" font-size="22" fill="${C.ink}">GPS works</text></g>`;
}
export function house(x, y, s = 1, col = '#ffb27a', roof = '#c0392b', open = 0) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><g filter="url(#soft)"><rect x="-150" y="-220" width="300" height="220" fill="${col}"/></g>
    <path d="M -180 -210 L 0 -360 L 180 -210 Z" fill="${roof}"/><rect x="-110" y="-170" width="70" height="60" rx="6" fill="#ffe7a6"/>
    <rect x="20" y="-140" width="80" height="140" rx="8" fill="#5a3a26"/><rect x="${20 + 80 * (1 - open)}" y="-140" width="${80 * open}" height="140" fill="#2a1a12"/><circle cx="85" cy="-70" r="6" fill="${C.yellow}"/></g>`;
}
export function bubbleSay(x, y, s = 1, u = 1, txt = '', col = '#fff', tcol = C.ink) {
  const k = ease.back(u / 0.25);
  return `<g transform="translate(${x} ${y}) scale(${s * k})" opacity="${clamp(u * 6)}"><rect x="-150" y="-70" width="300" height="120" rx="40" fill="${col}" filter="url(#soft)"/>
    <path d="M -40 48 L -60 100 L 0 48 Z" fill="${col}"/><text y="8" font-family="InterW" font-weight="800" font-size="40" fill="${tcol}" text-anchor="middle">${txt}</text></g>`;
}
export function cash(x, y, s = 1, rot = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><rect x="-160" y="-70" width="320" height="140" rx="14" fill="#2f9e57" filter="url(#soft)"/>
    <rect x="-140" y="-50" width="280" height="100" rx="10" fill="none" stroke="#bff0cf" stroke-width="6"/><circle r="38" fill="#bff0cf"/><text y="16" font-family="MontB" font-weight="900" font-size="46" fill="#2f9e57" text-anchor="middle">$</text></g>`;
}
export function gauge(x, y, s = 1, v = 0.5, label = '') {
  const a = -90 + 180 * v, segs = [['#34c759', -90, -30], ['#ffd84a', -30, 30], [C.red, 30, 90]];
  const arc = (a0, a1, col) => { const p = (a) => [Math.sin(a * Math.PI / 180) * 300, -Math.cos(a * Math.PI / 180) * 300]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `<path d="M ${x0} ${y0} A 300 300 0 0 1 ${x1} ${y1}" stroke="${col}" stroke-width="70" fill="none"/>`; };
  return `<g transform="translate(${x} ${y}) scale(${s})">${segs.map(([c2, a0, a1]) => arc(a0, a1, c2)).join('')}
    <g transform="rotate(${a})"><path d="M -18 0 L 0 -270 L 18 0 Z" fill="#fff"/></g><circle r="34" fill="#fff"/>
    <text y="120" font-family="MontB" font-weight="900" font-size="56" fill="#fff" text-anchor="middle">${label}</text></g>`;
}
export function ocean(t, u, { cut = 0, reroute = 0 } = {}) {
  // a cross-section: sky, waves, deep water, the seabed with cables and data pulses
  const wave = (yy, amp, ph, col) => { let d = `M 0 ${yy}`; for (let x = 0; x <= 1080; x += 40) d += ` L ${x} ${yy + Math.sin(x / 90 + t * 2 + ph) * amp}`; return `<path d="${d} L 1080 1920 L 0 1920 Z" fill="${col}"/>`; };
  const cable = (yy, i) => {
    const broken = cut && i === 1, gap = broken ? 60 * ease.out(cut) : 0;
    let s = broken ? `<path d="M 0 ${yy} Q 270 ${yy - 30} ${540 - gap} ${yy}" stroke="#3a3f4b" stroke-width="18" fill="none"/><path d="M ${540 + gap} ${yy} Q 810 ${yy + 30} 1080 ${yy}" stroke="#3a3f4b" stroke-width="18" fill="none"/>
      <circle cx="${540 - gap}" cy="${yy}" r="${14 + 10 * Math.sin(t * 20)}" fill="${C.yellow}" opacity="0.8" filter="url(#glow)"/>`
      : `<path d="M 0 ${yy} Q 540 ${yy + (i % 2 ? 40 : -40)} 1080 ${yy}" stroke="#3a3f4b" stroke-width="18" fill="none"/>`;
    for (let k = 0; k < 5; k++) {
      const p = (t * 0.5 + k / 5 + i * 0.1) % 1, px = p * 1080;
      if (broken && Math.abs(px - 540) < 200) continue;
      s += `<circle cx="${px}" cy="${yy + (i % 2 ? 40 : -40) * 4 * p * (1 - p) * (broken ? 0 : 1)}" r="${broken || !reroute || i === 1 ? 10 : 14}" fill="${reroute && i !== 1 ? C.yellow : '#7fe8ff'}" filter="url(#glow)"/>`;
    }
    return s;
  };
  const fish = [0, 1, 2].map((i) => { const fx = ((t * 60 + i * 380) % 1300) - 110, fy = 760 + i * 120; return `<g transform="translate(${fx} ${fy})"><ellipse rx="40" ry="20" fill="#ffb347"/><path d="M -36 0 L -64 -18 L -64 18 Z" fill="#ffb347"/><circle cx="20" cy="-5" r="5" fill="#222"/></g>`; }).join('');
  return `<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f6fb5"/><stop offset="1" stop-color="#06213f"/></linearGradient>
    <rect width="1080" height="1920" fill="#7cc7ff"/><rect y="440" width="1080" height="1480" fill="url(#sea)"/>${wave(450, 14, 0, '#2a85d0')}<rect y="470" width="1080" height="1450" fill="url(#sea)"/>
    ${fish}<path d="M 0 1180 Q 270 1120 540 1170 Q 810 1220 1080 1150 L 1080 1920 L 0 1920 Z" fill="#c9a66b"/>
    ${[0, 1, 2].map((i) => cable(1150 - i * 70, i)).join('')}`;
}
export function notifStorm(t, u) {
  // banners stacking on the phone screen, faster and faster
  const n = Math.min(14, Math.floor(Math.pow(u * 4, 1.6)));
  const apps = [['Messages', C.green, 'Mom: are you okay??'], ['Bank', '#1f5fae', 'Payment failed (3)'], ['Maps', C.coral, 'Route updated'], ['News', C.red, 'INTERNET IS BACK'], ['Mail', C.blue, '418 new emails'], ['Chat', '#8e44ad', '99+ messages']];
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = apps[i % apps.length], yy = 300 - (n - 1 - i) * 96;
    if (yy < -360) continue;
    s += `<g transform="translate(0 ${yy})"><rect x="-164" y="-42" width="328" height="84" rx="20" fill="#fff" opacity="0.95"/>
      <rect x="-150" y="-26" width="52" height="52" rx="12" fill="${a[1]}"/><text x="-86" y="-6" font-family="InterW" font-weight="800" font-size="19" fill="${C.ink}">${a[0]}</text>
      <text x="-86" y="20" font-family="InterW" font-weight="600" font-size="17" fill="#555">${a[2]}</text></g>`;
  }
  return `<rect x="-176" y="-376" width="352" height="752" fill="url(#lockWall)"/>${statusBar({})}${s}`;
}
export function badge(x, y, s, txt) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><circle r="56" fill="${C.red}" filter="url(#soft)"/><text y="16" font-family="MontB" font-weight="900" font-size="${txt.length > 3 ? 34 : 44}" fill="#fff" text-anchor="middle">${txt}</text></g>`;
}
export function commentBox(x, y, s = 1, t = 0, u = 0) {
  const opts = ['1 day', '3 days', 'A week', 'Forever'];
  return `<g transform="translate(${x} ${y}) scale(${s})"><g filter="url(#drop)"><rect x="-400" y="-300" width="800" height="600" rx="50" fill="#fff"/></g>
    <text y="-200" font-family="MontB" font-weight="900" font-size="58" fill="${C.ink}" text-anchor="middle">HOW LONG WOULD</text><text y="-130" font-family="MontB" font-weight="900" font-size="58" fill="${C.ink}" text-anchor="middle">YOU LAST?</text>
    ${opts.map((o, i) => { const k = ease.back((u - 0.2 - i * 0.15) / 0.3); return `<g transform="translate(${-180 + (i % 2) * 360} ${-10 + Math.floor(i / 2) * 140}) scale(${k})"><rect x="-160" y="-50" width="320" height="100" rx="50" fill="${[C.coral, C.yellow, C.teal, C.blue][i]}"/>
      <text y="14" font-family="MontB" font-weight="900" font-size="40" fill="#fff" text-anchor="middle">${o}</text></g>`; }).join('')}</g>`;
}
