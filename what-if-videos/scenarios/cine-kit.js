// Cinematic kit for the "explainer 3D" look: dark navy worlds lit by warm gold, everything that matters glows
// (bloom does the rest), soft bokeh behind, slow camera moves. Each builder returns { group, update(t, ...) }.
// Units: the Earth shots use R = 100; the tabletop shots use centimetres; the rooms use metres.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Rng, clamp, lerp, smooth } from '../engine/lib/rng.js';

export const GOLD = new THREE.Color('#ffb547'), GOLD_HOT = new THREE.Color('#ffd27a'), CYAN = new THREE.Color('#5fc8ff'), NAVY = new THREE.Color('#050a1c');
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- shared helpers
export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); if (draw) draw(c, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, cv, c, redraw(fn) { fn(c, w, h); t.needsUpdate = true; } };
}
let GLOW = null;
export function glowTex() {
  if (GLOW) return GLOW;
  GLOW = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,0.75)'); g.addColorStop(0.5, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }).tex;
  GLOW.colorSpace = THREE.NoColorSpace; return GLOW;
}
export function glow(color, size, intensity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
}
export function stars(n, radius, seed = 3, size = 1.6) {
  const r = new Rng(seed), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = r.float(-1, 1), a = r.float(0, Math.PI * 2), s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * radius, u * radius, Math.sin(a) * s * radius], i * 3);
    const b = Math.pow(r.next(), 3) * 1.4 + 0.15; col.set([b * 0.9, b * 0.95, b * 1.1], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
  p.frustumCulled = false; return p;
}
// big soft out-of-focus discs far behind the subject (the "shot on a lens" look)
export function bokeh(n, seed, { x = [-60, 60], y = [-10, 60], z = [-120, -60], size = [6, 22], colors = ['#ffb547', '#5f8cff', '#ffd9a0'], op = 0.35 } = {}) {
  const g = new THREE.Group(), r = new Rng(seed);
  for (let i = 0; i < n; i++) {
    const s = glow(colors[i % colors.length], r.float(size[0], size[1]), op * r.float(0.4, 1));
    s.position.set(r.float(x[0], x[1]), r.float(y[0], y[1]), r.float(z[0], z[1])); g.add(s);
  }
  return g;
}
export function rounded(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
export const latLon = (lat, lon, R) => { const phi = (lon + 180) * DEG, la = lat * DEG; return new THREE.Vector3(-Math.cos(phi) * Math.cos(la) * R, Math.sin(la) * R, Math.sin(phi) * Math.cos(la) * R); };

// ---------------------------------------------------------------- the Earth at night: gold city lights, data arcs
const CITIES = { ny: [40.7, -74], la: [34, -118], ldn: [51.5, -0.1], fra: [50.1, 8.7], tok: [35.7, 139.7], sp: [-23.5, -46.6], lag: [6.5, 3.4], mum: [19, 72.8], syd: [-33.9, 151.2], sgp: [1.3, 103.8], jnb: [-26.2, 28], hk: [22.3, 114.2], mex: [19.4, -99.1], dub: [25.2, 55.3] };
const LINKS = [['ny', 'ldn'], ['ny', 'la'], ['ldn', 'fra'], ['ny', 'sp'], ['ldn', 'lag'], ['fra', 'mum'], ['mum', 'sgp'], ['sgp', 'tok'], ['tok', 'la'], ['sgp', 'syd'], ['hk', 'tok'], ['jnb', 'ldn'], ['dub', 'mum'], ['mex', 'ny'], ['sp', 'lag'], ['hk', 'sgp'], ['la', 'syd'], ['fra', 'dub']];
export async function buildNightEarth({ R = 100, arcs = true } = {}) {
  const ld = new THREE.TextureLoader();
  const [tDay, tNight] = await Promise.all(['/assets/earth/world.topo.bathy.200410.3x5400x2700.jpg', '/assets/earth/BlackMarble_2016_01deg.jpg'].map((u) => ld.loadAsync(u)));
  for (const t of [tDay, tNight]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; }
  const g = new THREE.Group();
  const U = { tDay: { value: tDay }, tNight: { value: tNight }, uOn: { value: 1 }, uSweep: { value: 1 }, uLon0: { value: 0.0 }, uLit: { value: 1 }, uSun: { value: new THREE.Vector3(-1, 0.25, -0.2).normalize() } };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 96), new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vW; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform sampler2D tDay, tNight; uniform float uOn, uSweep, uLon0, uLit; uniform vec3 uSun;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 day = texture2D(tDay, vUv).rgb;
        float lights = pow(texture2D(tNight, vUv).r, 1.6);
        // the blackout sweeps round the planet from uLon0; uSweep 0 = all dark, 1 = all lit
        float d = fract(vUv.x - uLon0);
        float on = mix(smoothstep(d - 0.06, d, uSweep * 1.06), 1.0, uOn);
        float flick = on;
        vec3 V = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(vN, V), 0.0), 3.0);
        float sunl = max(dot(vN, uSun), 0.0);
        vec3 col = day * (0.05 + 0.25 * sunl * uLit) * vec3(0.55, 0.7, 1.2);
        col += vec3(1.0, 0.68, 0.32) * lights * 3.2 * flick;
        col += vec3(0.25, 0.55, 1.0) * fr * 0.9;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  g.add(earth);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 96, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float f = pow(1.0 - abs(dot(vN, V)), 2.2); gl_FragColor = vec4(vec3(0.25, 0.5, 1.0) * f * 1.4, 1.0); }',
  }));
  g.add(atm);
  // data arcs with travelling pulses
  const arcG = new THREE.Group(), pulses = [];
  if (arcs) {
    const r = new Rng(7);
    for (const [a, b] of LINKS) {
      const A = latLon(...CITIES[a], R), B = latLon(...CITIES[b], R), ang = A.angleTo(B);
      const pts = [];
      for (let i = 0; i <= 48; i++) { const k = i / 48; const p = new THREE.Vector3().copy(A).lerp(B, k).normalize().multiplyScalar(R * (1.004 + 0.32 * ang / Math.PI * Math.sin(Math.PI * k) + 0.02 * Math.sin(Math.PI * k))); pts.push(p); }
      const curve = new THREE.CatmullRomCurve3(pts);
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb547').multiplyScalar(1.6), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      arcG.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.22, 6, false), m));
      for (let k = 0; k < 2; k++) { const s = glow('#ffe2a8', 4.2, 2.2); arcG.add(s); pulses.push({ s, curve, ph: r.next(), sp: r.float(0.25, 0.45), m }); }
      for (const P of [A, B]) { const c = glow('#ffd27a', 5, 1.4); c.position.copy(P).multiplyScalar(1.004); arcG.add(c); }
    }
  }
  g.add(arcG);
  return {
    group: g, earth, U, arcG,
    update(t, { on = 1, sweep = 1, arcs: arcOn = 1 } = {}) {
      U.uOn.value = on; U.uSweep.value = sweep;
      arcG.visible = arcOn > 0.01;
      for (const p of pulses) { const k = (p.ph + t * p.sp) % 1; p.s.position.copy(p.curve.getPointAt(k)); p.s.material.opacity = arcOn; p.m.opacity = 0.55 * arcOn; }
      arcG.children.forEach((c) => { if (c.isSprite && !pulses.find((p) => p.s === c)) c.material.opacity = arcOn; });
    },
  };
}

// ---------------------------------------------------------------- a dark desk with a warm key light (centimetres)
export function buildDesk(seed = 5) {
  const g = new THREE.Group();
  const wood = canvasTex(1024, 1024, (c, w, h) => {
    c.fillStyle = '#16120f'; c.fillRect(0, 0, w, h);
    const r = new Rng(seed);
    for (let i = 0; i < 260; i++) { c.strokeStyle = `rgba(${r.int(40, 70)},${r.int(30, 50)},${r.int(24, 38)},${r.float(0.15, 0.5).toFixed(2)})`; c.lineWidth = r.float(1, 4); c.beginPath(); const y = r.float(0, h); c.moveTo(0, y); for (let x = 0; x <= w; x += 64) c.lineTo(x, y + Math.sin(x / 180 + i) * 6); c.stroke(); }
  });
  wood.tex.wrapS = wood.tex.wrapT = THREE.RepeatWrapping; wood.tex.repeat.set(3, 3);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: wood.tex, roughness: 0.55, metalness: 0.0, color: '#8a7a6c' }));
  top.rotation.x = -Math.PI / 2; top.receiveShadow = true; g.add(top);
  const key = new THREE.SpotLight('#ffd7a3', 14000, 300, 0.55, 0.7, 2); key.position.set(-30, 80, 30); key.target.position.set(0, 0, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005;
  g.add(key, key.target);
  const rim = new THREE.DirectionalLight('#6f8cff', 1.6); rim.position.set(40, 30, -60); g.add(rim);
  g.add(new THREE.AmbientLight('#1a2240', 1.2));
  return { group: g, key };
}

// ---------------------------------------------------------------- a phone (cm) with a live canvas screen
export function buildPhone() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(7.4, 0.82, 15.2, 6, 1.0), new THREE.MeshPhysicalMaterial({ color: '#2c3140', metalness: 0.85, roughness: 0.32, clearcoat: 0.6 }));
  body.castShadow = true; g.add(body);
  const scr = canvasTex(600, 1240, null);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 14.8), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false, color: '#9ea3b0' }));
  glass.rotation.x = -Math.PI / 2; glass.position.y = 0.415; g.add(glass);
  const screenGlow = new THREE.PointLight('#8fb0ff', 0, 30, 2); screenGlow.position.set(0, 3, 0); g.add(screenGlow);
  return { group: g, scr, screenGlow };
}
// phone screen UIs (600 x 1240 canvas)
function statusBar(c, w, { dark = true, bars = 4, label = '' } = {}) {
  c.fillStyle = dark ? '#fff' : '#111'; c.font = '600 30px InterW'; c.textAlign = 'left'; c.fillText('9:41', 60, 64);
  for (let i = 0; i < 4; i++) { c.globalAlpha = i < bars ? 1 : 0.3; c.fillRect(430 + i * 14, 58 - 8 - i * 6, 9, 8 + i * 6); } c.globalAlpha = 1;
  if (label) { c.font = '700 22px InterW'; c.fillText(label, 494, 60); }
  c.strokeStyle = dark ? '#fff' : '#111'; c.lineWidth = 3; rounded(c, 494, 40, 44, 22, 6); c.stroke(); c.fillRect(498, 44, 30, 14);
  c.fillStyle = '#000'; rounded(c, w / 2 - 80, 22, 160, 46, 23); c.fill();
}
export function drawLock(c, w, h, { time = '4:02', notif = null, notifs = 0, t = 0 } = {}) {
  const g = c.createLinearGradient(0, 0, w * 0.4, h); g.addColorStop(0, '#0b1230'); g.addColorStop(0.6, '#1d2557'); g.addColorStop(1, '#3a2a5c'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  statusBar(c, w, { label: '5G' });
  c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = '600 30px InterW'; c.textAlign = 'center'; c.fillText('Monday, June 2', w / 2, 210);
  c.fillStyle = '#fff'; c.font = '700 170px InterW'; c.fillText(time, w / 2, 370);
  const list = notif ? [notif] : [];
  const apps = [['Mom', 'Are you okay?? 😭', '#34c759'], ['Bank', 'Payment failed (3)', '#2f7bff'], ['Maps', 'Route updated', '#ff5e5b'], ['News', 'INTERNET IS BACK', '#ff3b3b'], ['Mail', '418 new emails', '#5f8cff'], ['Group chat', '99+ messages', '#af52de'], ['Weather', 'Back online', '#ffb547']];
  for (let i = 0; i < notifs; i++) list.push(apps[i % apps.length]);
  const n = list.length;
  list.forEach(([a, b, col], i) => {
    const y = h - 210 - (n - 1 - i) * 128; if (y < 420) return;
    c.fillStyle = 'rgba(255,255,255,0.18)'; rounded(c, 34, y, w - 68, 112, 30); c.fill();
    c.fillStyle = col; rounded(c, 56, y + 24, 64, 64, 16); c.fill();
    c.textAlign = 'left'; c.fillStyle = '#fff'; c.font = '700 28px InterW'; c.fillText(a, 140, y + 50); c.font = '500 26px InterW'; c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillText(b, 140, y + 88);
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = '500 22px InterW'; c.textAlign = 'right'; c.fillText('now', w - 60, y + 50);
  });
}
export function drawMessages(c, w, h, t) {
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h); statusBar(c, w, { label: '5G' });
  c.fillStyle = '#fff'; c.font = '700 36px InterW'; c.textAlign = 'center'; c.fillText('Mom', w / 2, 200);
  c.fillStyle = '#5f6b8a'; c.beginPath(); c.arc(w / 2, 130, 0, 0, 7); c.fill();
  const bub = (x, y, bw, txt, mine, a = 1) => { c.globalAlpha = a; c.fillStyle = mine ? '#2f7bff' : '#26282e'; rounded(c, x, y, bw, 76, 36); c.fill(); c.fillStyle = '#fff'; c.font = '500 28px InterW'; c.textAlign = 'left'; c.fillText(txt, x + 30, y + 48); c.globalAlpha = 1; };
  bub(40, 300, 360, 'Did you see the news?', false);
  bub(w - 40 - 330, 400, 330, 'My wifi is dead', true);
  bub(w - 40 - 300, 500, 300, 'Are you okay?', true, 0.6);
  // the spinner where "Delivered" should be
  const cx = w - 80, cy = 620, a = t * 6;
  c.lineWidth = 6; c.strokeStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(cx, cy, 20, 0, 7); c.stroke();
  c.strokeStyle = '#fff'; c.beginPath(); c.arc(cx, cy, 20, a, a + 1.6); c.stroke();
  c.fillStyle = '#8e94a6'; c.font = '500 24px InterW'; c.textAlign = 'right'; c.fillText('Sending…', cx - 36, cy + 8);
  c.fillStyle = '#1c1e24'; rounded(c, 30, h - 150, w - 60, 80, 40); c.fill();
}

// ---------------------------------------------------------------- a Wi-Fi router (cm)
export function buildRouter() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(24, 4.2, 15, 5, 1.6), new THREE.MeshPhysicalMaterial({ color: '#e4e7ee', roughness: 0.35, metalness: 0.05, clearcoat: 0.5 }));
  body.position.y = 2.1; body.castShadow = true; g.add(body);
  for (const x of [-9, -3, 3, 9]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 16, 12), new THREE.MeshStandardMaterial({ color: '#1b1f2a', roughness: 0.4 })); a.position.set(x, 10, -6.5); a.rotation.x = -0.12; a.rotation.z = x * 0.012; a.castShadow = true; g.add(a); }
  const leds = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.MeshBasicMaterial({ color: '#4dff9a', toneMapped: false });
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), m); l.position.set(-6 + i * 3, 2.6, 7.52); g.add(l);
    const s = glow('#4dff9a', 4, 1.2); s.position.copy(l.position).add(new THREE.Vector3(0, 0, 0.3)); g.add(s); leds.push({ m, s });
  }
  return {
    group: g,
    update(t, dead = 0) {
      leds.forEach((L, i) => {
        const on = dead > 0.5 ? (i === 0 ? 1 : 0) : (Math.floor(t * 9 + i * 1.7) % 3 ? 1 : 0.35);
        const col = dead > 0.5 ? new THREE.Color('#ff3b30') : new THREE.Color('#4dff9a');
        L.m.color.copy(col).multiplyScalar(on * 2); L.s.material.color.copy(col).multiplyScalar(on * 1.2);
      });
    },
  };
}

// ---------------------------------------------------------------- a card terminal + card + cash (cm)
export function buildTerminal() {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: '#1a1d26', roughness: 0.4, metalness: 0.3, clearcoat: 0.4 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(8.5, 2.2, 17, 5, 1.2), mat); body.position.y = 1.1; body.rotation.x = -0.18; body.castShadow = true; g.add(body);
  const scr = canvasTex(400, 400, null);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false })); screen.position.set(0, 2.25, -3.6); screen.rotation.x = -Math.PI / 2 - 0.18; g.add(screen);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { const key = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.4, 1.2, 2, 0.3), new THREE.MeshStandardMaterial({ color: '#2e3242', roughness: 0.6 })); key.position.set(-2.3 + k * 2.3, 2.1 - (r * 1.6) * Math.sin(0.18), 1.4 + r * 1.6); key.rotation.x = -0.18; g.add(key); }
  const scrGlow = new THREE.PointLight('#9fffb8', 30, 25, 2); scrGlow.position.set(0, 5, -3); g.add(scrGlow);
  const cardT = canvasTex(512, 320, (c, w, h) => { const gg = c.createLinearGradient(0, 0, w, h); gg.addColorStop(0, '#2f7bff'); gg.addColorStop(1, '#14307a'); c.fillStyle = gg; rounded(c, 0, 0, w, h, 30); c.fill(); c.fillStyle = '#ffd27a'; rounded(c, 50, 110, 80, 60, 10); c.fill(); c.fillStyle = 'rgba(255,255,255,0.9)'; c.font = '600 34px InterW'; c.fillText('•••• •••• •••• 4821', 50, 250); });
  const card = new THREE.Mesh(new RoundedBoxGeometry(8.56, 0.08, 5.4, 2, 0.3), [0, 1, 2, 3, 4, 5].map((i) => (i === 2 ? new THREE.MeshPhysicalMaterial({ map: cardT.tex, roughness: 0.3, clearcoat: 1 }) : new THREE.MeshStandardMaterial({ color: '#1846b8' }))));
  card.castShadow = true; g.add(card);
  return {
    group: g, card,
    update(t, { state = 'tap', cardK = 0 } = {}) {
      scr.redraw((c, w, h) => {
        const red = state === 'declined';
        c.fillStyle = red ? '#3a070c' : '#06210f'; c.fillRect(0, 0, w, h);
        c.textAlign = 'center';
        if (red) {
          c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(w / 2, 140, 70, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 14; c.lineCap = 'round';
          c.beginPath(); c.moveTo(w / 2 - 28, 112); c.lineTo(w / 2 + 28, 168); c.moveTo(w / 2 + 28, 112); c.lineTo(w / 2 - 28, 168); c.stroke();
          c.fillStyle = '#fff'; c.font = '800 52px InterW'; c.fillText('DECLINED', w / 2, 290); c.fillStyle = '#ffb3b3'; c.font = '600 26px InterW'; c.fillText('No connection', w / 2, 340);
        } else {
          c.fillStyle = '#9fffb8'; c.font = '800 72px InterW'; c.fillText('$4.90', w / 2, 150); c.font = '600 28px InterW'; c.fillText('(€4.50)', w / 2, 196);
          c.strokeStyle = '#fff'; c.lineWidth = 8; c.lineCap = 'round';
          for (let i = 0; i < 3; i++) { c.globalAlpha = 0.3 + 0.7 * ((Math.floor(t * 3) % 3) >= i ? 1 : 0); c.beginPath(); c.arc(w / 2 - 30, 270, 26 + i * 24, -0.9, 0.9); c.stroke(); } c.globalAlpha = 1;
          c.fillStyle = '#fff'; c.font = '700 28px InterW'; c.fillText('TAP CARD', w / 2, 370);
        }
      });
      scrGlow.color.set(state === 'declined' ? '#ff4040' : '#9fffb8');
      card.position.set(lerp(26, 0.5, cardK), lerp(14, 6.2, cardK), lerp(14, -3.2, cardK)); card.rotation.set(-0.18, lerp(-0.6, 0.08, cardK), lerp(0.25, 0, cardK));
    },
  };
}
export function buildCash(n = 26, seed = 9) {
  const g = new THREE.Group(), r = new Rng(seed);
  const T = canvasTex(512, 220, (c, w, h) => { c.fillStyle = '#3f8f5a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#cfeedd'; c.lineWidth = 6; c.strokeRect(14, 14, w - 28, h - 28); c.fillStyle = '#cfeedd'; c.beginPath(); c.ellipse(w / 2, h / 2, 54, 70, 0, 0, 7); c.fill(); c.fillStyle = '#3f8f5a'; c.font = '800 70px InterW'; c.textAlign = 'center'; c.fillText('$', w / 2, h / 2 + 26); c.fillStyle = '#e6f5ea'; c.font = '800 44px InterW'; c.fillText('100', 70, 66); c.fillText('100', w - 70, h - 34); });
  const bills = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(15.6, 6.6), new THREE.MeshStandardMaterial({ map: T.tex, side: THREE.DoubleSide, roughness: 0.7 }));
    m.castShadow = true; g.add(m);
    bills.push({ m, x: r.float(-26, 26), z: r.float(-30, 10), d: r.float(0, 1.2), sp: r.float(14, 22), rx: r.float(-2, 2), ry: r.float(-2, 2), land: r.float(0.05, 0.6) });
  }
  return {
    group: g,
    update(t, u) {
      for (const b of bills) {
        const k = Math.max(0, u - b.d), y = Math.max(b.land + 0.02 * bills.indexOf(b), 38 - b.sp * k * k * 2.2);
        const landed = y <= b.land + 0.05 * bills.indexOf(b) + 0.001;
        b.m.position.set(b.x + Math.sin(k * 3 + b.rx) * 3 * (landed ? 0 : 1), y, b.z);
        b.m.rotation.set(landed ? -Math.PI / 2 : -Math.PI / 2 + Math.sin(k * 4 + b.rx) * 0.8, 0, landed ? b.ry : b.ry + k * 2);
        b.m.visible = u > b.d;
      }
    },
  };
}

// ---------------------------------------------------------------- a departures board in a dark hall (metres)
export function buildAirport() {
  const g = new THREE.Group();
  const rows = [['08:15', 'LONDON', 'BA 178'], ['08:40', 'TOKYO', 'JL 005'], ['09:05', 'DUBAI', 'EK 202'], ['09:20', 'PARIS', 'AF 023'], ['09:45', 'SYDNEY', 'QF 012'], ['10:10', 'TORONTO', 'AC 761'], ['10:35', 'NEW YORK', 'DL 401'], ['11:00', 'SINGAPORE', 'SQ 317']];
  const B = canvasTex(1600, 1000, null);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 6), new THREE.MeshBasicMaterial({ map: B.tex, toneMapped: false }));
  board.position.set(0, 4.2, 0); g.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(10, 6.4, 0.3), new THREE.MeshStandardMaterial({ color: '#0d0f14', roughness: 0.5 })); frame.position.set(0, 4.2, -0.17); g.add(frame);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshPhysicalMaterial({ color: '#0a0d16', roughness: 0.42, metalness: 0.1, clearcoat: 0.3 }));
  floor.rotation.x = -Math.PI / 2; g.add(floor);
  // the window wall with runway lights and a parked jet beyond
  const win = canvasTex(1024, 512, (c, w, h) => {
    const gg = c.createLinearGradient(0, 0, 0, h); gg.addColorStop(0, '#0a1230'); gg.addColorStop(0.65, '#1a2450'); gg.addColorStop(1, '#05070f'); c.fillStyle = gg; c.fillRect(0, 0, w, h);
    const r = new Rng(4); for (let i = 0; i < 80; i++) { c.fillStyle = r.next() < 0.5 ? '#5f8cff' : '#ffb547'; c.globalAlpha = r.float(0.4, 1); c.beginPath(); c.arc(r.float(0, w), r.float(h * 0.68, h * 0.8), r.float(1.5, 3.5), 0, 7); c.fill(); } c.globalAlpha = 1;
    c.fillStyle = '#05070f'; c.beginPath(); c.moveTo(250, 330); c.lineTo(760, 318); c.quadraticCurveTo(800, 324, 780, 340); c.lineTo(250, 350); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(480, 330); c.lineTo(560, 250); c.lineTo(590, 250); c.lineTo(540, 330); c.fill(); c.beginPath(); c.moveTo(270, 332); c.lineTo(250, 270); c.lineTo(280, 270); c.lineTo(310, 330); c.fill();
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 18), new THREE.MeshBasicMaterial({ map: win.tex, toneMapped: false, color: '#9fb0d8' })); wall.position.set(0, 7, -14); g.add(wall);
  for (let i = -6; i <= 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 18, 0.25), new THREE.MeshStandardMaterial({ color: '#0a0c12' })); m.position.set(i * 4.6, 7, -13.8); g.add(m); }
  g.add(new THREE.AmbientLight('#203060', 0.6));
  const l = new THREE.PointLight('#ffb547', 25, 30, 2); l.position.set(0, 7, 6); g.add(l);
  return {
    group: g, board,
    update(t, u) {
      B.redraw((c, w, h) => {
        c.fillStyle = '#05070c'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#ffd34d'; c.font = '800 64px InterW'; c.textAlign = 'left'; c.fillText('✈  DEPARTURES', 50, 92);
        rows.forEach((row, i) => {
          const y = 150 + i * 104, flip = clamp((u - 0.15 * i) / 0.22), cancelled = flip > 0.5, sq = Math.abs(Math.cos(flip * Math.PI));
          c.fillStyle = '#10141e'; c.fillRect(40, y, w - 80, 88);
          c.fillStyle = '#ffd34d'; c.font = '700 50px InterW'; c.fillText(row[0], 70, y + 62); c.fillText(row[1], 260, y + 62); c.fillText(row[2], 760, y + 62);
          c.save(); c.translate(1300, y + 44); c.scale(1, Math.max(0.05, sq));
          c.fillStyle = cancelled ? '#e0262f' : '#1f6a3a'; c.fillRect(-230, -38, 460, 76); c.fillStyle = '#fff'; c.font = '800 44px InterW'; c.textAlign = 'center'; c.fillText(cancelled ? 'CANCELLED' : 'ON TIME', 0, 16); c.restore(); c.textAlign = 'left';
        });
      });
    },
  };
}

// ---------------------------------------------------------------- a supermarket aisle (metres), products vanish far to near
export function buildAisle(seed = 2) {
  const g = new THREE.Group(), r = new Rng(seed);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 80), new THREE.MeshPhysicalMaterial({ color: '#c9cdd6', roughness: 0.25, clearcoat: 0.8 })); floor.rotation.x = -Math.PI / 2; g.add(floor);
  const shelfM = new THREE.MeshStandardMaterial({ color: '#d9dde6', roughness: 0.6, metalness: 0.2 });
  const cols = ['#ff5e5b', '#ffd84a', '#4cc9f0', '#7bd389', '#c77dff', '#ff9f43', '#f6f7fb', '#2f7bff'];
  const items = [], geo = new THREE.BoxGeometry(0.28, 0.34, 0.24);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.5 }), 2400); inst.castShadow = false;
  let n = 0; const M = new THREE.Matrix4();
  for (const side of [-1, 1]) {
    for (let lvl = 0; lvl < 5; lvl++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 36), shelfM); s.position.set(side * 1.6, 0.25 + lvl * 0.45, -14); g.add(s); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.4, 36), shelfM); back.position.set(side * 1.9, 1.2, -14); g.add(back);
    for (let lvl = 0; lvl < 5; lvl++) for (let k = 0; k < 110; k++) {
      if (n >= 2400) break;
      const z = 3.5 - k * 0.32, x = side * (1.5 + r.float(-0.06, 0.06));
      M.makeTranslation(x, 0.25 + lvl * 0.45 + 0.19, z); inst.setMatrixAt(n, M); inst.setColorAt(n, new THREE.Color(cols[(k + lvl * 3 + (side > 0 ? 2 : 0)) % cols.length]).multiplyScalar(0.85 + r.float(0, 0.3)));
      items.push({ i: n, x, y: 0.25 + lvl * 0.45 + 0.19, z, gone: r.next() * 0.9 + (-z / 36) * 0.0 }); n++;
    }
  }
  inst.count = n; g.add(inst);
  for (let k = 0; k < 8; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 3.2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8f0ff').multiplyScalar(2.2), toneMapped: false })); l.position.set(0, 3.4, 2 - k * 4.4); g.add(l); }
  g.add(new THREE.HemisphereLight('#e8eeff', '#30343f', 1.1));
  const d = new THREE.DirectionalLight('#ffffff', 0.8); d.position.set(0, 10, 4); g.add(d);
  return {
    group: g,
    update(t, empty = 0) {
      for (const it of items) { const s = it.gone < empty ? 0 : 1; M.makeScale(s, s, s).setPosition(it.x, it.y, it.z); inst.setMatrixAt(it.i, M); }
      inst.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- a GPS satellite (metres, ~5 m across)
export function buildSatellite() {
  const g = new THREE.Group();
  const foil = canvasTex(256, 256, (c, w, h) => { const r = new Rng(3); c.fillStyle = '#c99a3a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(255,${r.int(200, 240)},${r.int(120, 170)},${r.float(0.15, 0.4).toFixed(2)})`; c.lineWidth = r.float(1, 3); c.beginPath(); c.moveTo(r.float(0, w), r.float(0, h)); c.lineTo(r.float(0, w), r.float(0, h)); c.stroke(); } });
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.8, 1.8, 2.2, 3, 0.12), new THREE.MeshStandardMaterial({ map: foil.tex, metalness: 0.55, roughness: 0.3, emissive: '#5a3a08', emissiveIntensity: 0.6 })); g.add(body);
  const cell = canvasTex(256, 512, (c, w, h) => { c.fillStyle = '#0d1b4a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#4a6ad8'; c.lineWidth = 3; for (let x = 0; x <= w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y <= h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 1.6), new THREE.MeshStandardMaterial({ map: cell.tex, metalness: 0.6, roughness: 0.25, emissive: '#0b1640', emissiveIntensity: 0.6 })); p.position.x = s * 3.8; g.add(p); const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2), new THREE.MeshStandardMaterial({ color: '#9aa3b8' })); arm.rotation.z = Math.PI / 2; arm.position.x = s * 1.5; g.add(arm); }
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.2, 0.4, 24), new THREE.MeshStandardMaterial({ color: '#e9ecf3', metalness: 0.4, roughness: 0.3 })); dish.position.y = -1.1; g.add(dish);
  const beacon = glow('#ff5e5b', 1.4, 1.5); beacon.position.set(0, 1.1, 0); g.add(beacon);
  return { group: g, beacon };
}

// ---------------------------------------------------------------- a field of glowing digits, curving away (metres)
export function buildDigitField(seed = 4) {
  const T = canvasTex(2048, 2048, (c, w, h) => {
    c.fillStyle = '#060402'; c.fillRect(0, 0, w, h); const r = new Rng(seed);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const b = r.next(); c.fillStyle = `rgba(255,${Math.round(150 + 60 * b)},${Math.round(60 + 40 * b)},${(0.12 + 0.75 * Math.pow(b, 2)).toFixed(2)})`;
      c.fillRect(x * 32 + 2, y * 32 + 2, 28, 28); c.fillStyle = `rgba(20,12,0,0.85)`; c.font = '700 16px InterW'; c.textAlign = 'center'; c.fillText(String(r.int(0, 999)).padStart(2, '0'), x * 32 + 16, y * 32 + 22);
    }
  });
  T.tex.wrapS = T.tex.wrapT = THREE.RepeatWrapping; T.tex.repeat.set(4, 4);
  const geo = new THREE.PlaneGeometry(240, 240, 120, 120), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -0.004 * (x * x) - 0.002 * y * y); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: T.tex, toneMapped: false, color: new THREE.Color('#ffffff').multiplyScalar(1.6) }));
  m.rotation.x = -Math.PI / 2;
  const g = new THREE.Group(); g.add(m);
  return { group: g, tex: T.tex };
}

// ---------------------------------------------------------------- the ocean floor with glowing cables (metres)
export function buildSeafloor(seed = 11) {
  const g = new THREE.Group(), r = new Rng(seed);
  const H = (x, z) => 2.2 * Math.sin(x * 0.05) * Math.cos(-z * 0.04) + 0.6 * Math.sin(x * 0.31 - z * 0.17) + 18 * Math.pow(Math.abs(x) / 300, 2.4);
  const geo = new THREE.PlaneGeometry(600, 600, 200, 200), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, H(x, -y)); }
  geo.computeVertexNormals();
  const sand = canvasTex(1024, 1024, (c, w, h) => { c.fillStyle = '#26324f'; c.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${r.int(20, 70)},${r.int(30, 80)},${r.int(70, 130)},0.35)`; c.fillRect(r.float(0, w), r.float(0, h), 2, 2); } for (let y = 0; y < h; y += 10) { c.strokeStyle = 'rgba(80,100,170,0.12)'; c.beginPath(); c.moveTo(0, y); for (let x = 0; x < w; x += 40) c.lineTo(x, y + Math.sin(x / 50 + y) * 3); c.stroke(); } });
  sand.tex.wrapS = sand.tex.wrapT = THREE.RepeatWrapping; sand.tex.repeat.set(12, 12);
  const floor = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: sand.tex, roughness: 0.95, color: '#9fb4ff' })); floor.rotation.x = -Math.PI / 2; g.add(floor);
  const rockG = new THREE.IcosahedronGeometry(1, 1), rocks = new THREE.InstancedMesh(rockG, new THREE.MeshStandardMaterial({ color: '#1a2036', roughness: 1, flatShading: true }), 500);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
  for (let i = 0; i < 500; i++) { const s = r.float(0.2, 1.4); const rx = r.float(-120, 120), rz = r.float(-260, 40); M.compose(new THREE.Vector3(rx, H(rx, rz) + s * 0.3, rz), Q.setFromEuler(new THREE.Euler(r.next() * 3, r.next() * 3, 0)), new THREE.Vector3(s, s * 0.6, s)); rocks.setMatrixAt(i, M); }
  g.add(rocks);
  // cables: gentle S-curves along -z; cable 0 is the one that snaps
  const cables = [];
  const xs = [0, -14, 15, -30, 32];
  xs.forEach((x0, i) => {
    const pts = []; for (let k = 0; k <= 80; k++) { const z = 40 - k * 4, x = x0 + Math.sin(k * 0.175 + i) * (i ? 6 : 2); pts.push(new THREE.Vector3(x, H(x, z) + 0.3, z)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const mat = new THREE.MeshStandardMaterial({ color: '#0a0d18', roughness: 0.5, metalness: 0.3, emissive: new THREE.Color(i ? '#5f8cff' : '#ffb547'), emissiveIntensity: i ? 0.5 : 0.75 });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 300, i ? 0.2 : 0.22, 8, false), mat); g.add(mesh);
    const pul = []; for (let k = 0; k < 6; k++) { const s = glow(i ? '#9fbaff' : '#ffd27a', i ? 2.0 : 2.4, 2); g.add(s); pul.push({ s, ph: k / 6 }); }
    cables.push({ curve, mesh, mat, pul, i });
  });
  const sparks = []; for (let k = 0; k < 40; k++) { const s = glow('#ffe2a8', 0.8, 2.5); s.visible = false; g.add(s); sparks.push({ s, a: r.float(0, 6.28), v: r.float(2, 8), up: r.float(1, 6) }); }
  const cutGlow = glow('#ffd27a', 18, 2); cutGlow.visible = false; g.add(cutGlow);
  g.add(new THREE.HemisphereLight('#4a6ce0', '#0a0e1c', 2.0));
  const top = new THREE.DirectionalLight('#7fa0ff', 1.0); top.position.set(0, 60, 20); g.add(top);
  const CUT = 0.42;
  return {
    group: g, cables, CUT,
    update(t, { cut = 0, reroute = 0 } = {}) {
      for (const C of cables) {
        for (const P of C.pul) {
          let k = (P.ph + t * 0.18) % 1; const kk = 1 - k;          // pulses travel towards the camera
          if (C.i === 0 && cut > 0 && kk < CUT + 0.02 && kk > CUT - 0.06) { P.s.visible = false; continue; }
          P.s.visible = true; P.s.position.copy(C.curve.getPointAt(kk)).add(new THREE.Vector3(0, 0.3, 0));
          const boost = C.i && reroute ? 1 + 1.4 * reroute : 1; P.s.material.color.set(C.i ? '#9fbaff' : '#ffd27a').multiplyScalar(2 * boost);
        }
        if (C.i) C.mat.emissiveIntensity = 0.5 + 0.9 * reroute;
      }
      const cp = cables[0].curve.getPointAt(1 - CUT);
      cutGlow.visible = cut > 0; cutGlow.position.copy(cp).add(new THREE.Vector3(0, 0.6, 0)); cutGlow.material.opacity = cut > 0 ? clamp(1.4 - cut * 0.8) : 0;
      sparks.forEach((S, i) => { const k = (cut * 1.6 + i / sparks.length) % 1; S.s.visible = cut > 0 && cut < 1.6; S.s.position.set(cp.x + Math.cos(S.a) * S.v * k, cp.y + S.up * k - 4 * k * k, cp.z + Math.sin(S.a) * S.v * k); S.s.material.opacity = 1 - k; });
    },
  };
}

// ---------------------------------------------------------------- a city at night (metres): blocks relight one by one
export function buildCity(seed = 6) {
  const g = new THREE.Group(), r = new Rng(seed), blocks = [];
  const winT = canvasTex(256, 512, (c, w, h) => { c.fillStyle = '#05060c'; c.fillRect(0, 0, w, h); for (let y = 8; y < h; y += 20) for (let x = 8; x < w; x += 18) { if (r.next() < 0.55) { c.fillStyle = r.next() < 0.8 ? '#ffc56b' : '#cfe0ff'; c.globalAlpha = r.float(0.5, 1); c.fillRect(x, y, 10, 12); } } c.globalAlpha = 1; });
  winT.tex.wrapS = winT.tex.wrapT = THREE.RepeatWrapping;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: '#05070d', roughness: 0.9 })); ground.rotation.x = -Math.PI / 2; g.add(ground);
  for (let i = -9; i <= 9; i++) for (let j = 0; j < 22; j++) {
    if (r.next() < 0.12) continue;
    const h = r.float(12, 70) * (1 + 0.8 * Math.exp(-((i * i) / 30 + ((j - 8) * (j - 8)) / 40))), w = r.float(10, 18), d = r.float(10, 18);
    const tex = winT.tex.clone(); tex.needsUpdate = true; tex.repeat.set(w / 18, h / 26); tex.offset.set(r.next(), r.next());
    const m = new THREE.MeshStandardMaterial({ color: '#0b0e18', roughness: 0.8, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(i * 24 + r.float(-3, 3), h / 2, -j * 24 + r.float(-3, 3)); g.add(b);
    blocks.push({ m, k: r.next() * 0.25 + (Math.abs(i) / 9) * 0.4 + (j / 22) * 0.35 });
  }
  g.add(new THREE.AmbientLight('#1a2650', 0.7));
  const moon = new THREE.DirectionalLight('#8fa8ff', 1.4); moon.position.set(-40, 80, 20); g.add(moon);
  return { group: g, update(t, on = 1) { for (const b of blocks) b.m.emissiveIntensity = on > b.k ? 1.6 + 0.2 * Math.sin(t * 2 + b.k * 30) : 0.04; } };
}
