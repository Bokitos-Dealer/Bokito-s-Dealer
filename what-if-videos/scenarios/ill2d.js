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
