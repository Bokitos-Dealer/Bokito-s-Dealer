// From cruising altitude to the edge of the observable universe. Each shot has its own scene in
// units that suit it (metres, km, thousands of km, millions of km, thousands of light-years,
// billions of light-years), so depth precision is always good. The paper is a white line with a
// soft point of light at its tip; it never shrinks below a few pixels.
import * as THREE from 'three';
import { Rng, clamp, lerp, smooth, easeInOut } from './rng.js';
import { buildDaySky, makeCloudTexture, regionTexture, buildPlane, radialGround } from './town.js';
import { makePaperMaterial, buildStack } from './paper.js';

const W = 1080, H = 1920;
let PX = 1;   // point sizes are given for a 1080-wide frame; scaled to the render resolution
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ctex = (cv, srgb = true) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t; };
const logLerp = (a, b, k) => a * Math.pow(b / a, k);

function softDot(size = 128, inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)') {
  const cv = canvas(size, size), c = cv.getContext('2d');
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(0.2, mid); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  return ctex(cv);
}

// ---------------------------------------------------------------- shared pieces
// the paper as a line: base point, direction, length; width is a few pixels for the given camera
function makeLine(scene, o = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: o.color ?? '#f6f4ee', toneMapped: false }));
  mesh.frustumCulled = false;
  const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: '#dfe9ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  tip.frustumCulled = false;
  scene.add(mesh, tip);
  const UP = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), v = new THREE.Vector3();
  return {
    mesh, tip,
    set(base, dir, len, cam, px = 7, tipPx = 46) {
      mesh.position.copy(base); q.setFromUnitVectors(UP, dir); mesh.quaternion.copy(q);
      const mid = v.copy(dir).multiplyScalar(len * 0.5).add(base);
      const d = Math.max(cam.position.distanceTo(mid) - len * 0.35, cam.near * 4);
      const wpp = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / H;
      mesh.scale.set(px * wpp, len, px * wpp);
      const end = v.copy(dir).multiplyScalar(len).add(base);
      tip.position.copy(end);
      const dt = Math.max(cam.position.distanceTo(end), cam.near * 4);
      tip.scale.setScalar(tipPx * 2 * dt * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / H);
    },
    tipPoint(base, dir, len) { return dir.clone().multiplyScalar(len).add(base); },
  };
}

function project(p, cam) {
  const v = p.clone().project(cam);
  return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, ok: v.z < 1 && v.z > -1 };
}

function setCam(cam, c) {
  cam.fov = c.fov; cam.near = c.near; cam.far = c.far; cam.aspect = W / H;
  cam.position.copy(c.pos); if (c.up) cam.up.copy(c.up); else cam.up.set(0, 1, 0); cam.lookAt(c.look);
  if (c.roll) cam.rotateZ(c.roll);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
}

// procedural Earth (equirectangular colour map) and a soft cloud layer
let EARTH = null;
function earthTextures() {
  if (EARTH) return EARTH;
  const hash = (i, j, k) => { let h = (i * 374761393 + j * 668265263 + k * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const vn = (x, y, z) => {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
    const L = (a, b, t) => a + (b - a) * t;
    return L(L(L(hash(i, j, k), hash(i + 1, j, k), sx), L(hash(i, j + 1, k), hash(i + 1, j + 1, k), sx), sy),
      L(L(hash(i, j, k + 1), hash(i + 1, j, k + 1), sx), L(hash(i, j + 1, k + 1), hash(i + 1, j + 1, k + 1), sx), sy), sz);
  };
  const fbm = (x, y, z, o = 5) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { v += a * vn(x * f + 17, y * f + 3, z * f + 9); f *= 2.03; a *= 0.5; } return v; };
  const Wd = 2048, Hd = 1024;
  const cv = canvas(Wd, Hd), c = cv.getContext('2d'), img = c.createImageData(Wd, Hd);
  const cc = canvas(Wd, Hd), c2 = cc.getContext('2d'), img2 = c2.createImageData(Wd, Hd);
  for (let j = 0; j < Hd; j++) for (let i = 0; i < Wd; i++) {
    const lon = i / Wd * Math.PI * 2, lat = (0.5 - j / Hd) * Math.PI;
    const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
    const h = fbm(x * 1.7, y * 1.7, z * 1.7) - 0.52;
    let col;
    if (Math.abs(lat) > 1.25 + 0.06 * Math.sin(lon * 5)) col = [232, 238, 244];
    else if (h > 0) {
      const g = clamp(h * 7), dry = Math.abs(lat) < 0.55 && fbm(x * 3, y * 3 + 7, z * 3, 4) > 0.52;
      col = dry ? [lerp(214, 186, g), lerp(190, 156, g), lerp(136, 106, g)] : [lerp(98, 128, g), lerp(146, 130, g), lerp(70, 78, g)];
    } else { const d = clamp(-h * 6); col = [lerp(40, 14, d), lerp(102, 46, d), lerp(150, 104, d)]; }
    const k = (j * Wd + i) * 4;
    img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    const cl = fbm(x * 3.2 + 40, y * 4.5, z * 3.2, 5);
    const a = smooth(0.5, 0.7, cl) * 0.92;
    img2.data[k] = 255; img2.data[k + 1] = 255; img2.data[k + 2] = 255; img2.data[k + 3] = Math.round(a * 255);
  }
  c.putImageData(img, 0, 0); c2.putImageData(img2, 0, 0);
  EARTH = { map: ctex(cv), clouds: ctex(cc) };
  return EARTH;
}

// find a mid-latitude coastline in the colour map and return the rotation that puts it on top (+y)
let COAST_Q = null;
function coastQuat() {
  if (COAST_Q) return COAST_Q;
  const cv = earthTextures().map.image, c = cv.getContext('2d'), Wd = cv.width, Hd = cv.height;
  const px = c.getImageData(0, 0, Wd, Hd).data;
  const land = (i, j) => { const k = ((j * Wd) + ((i + Wd) % Wd)) * 4; return px[k + 1] > px[k + 2] + 8; };
  let best = null, bestScore = -1;
  for (let j = Math.round(Hd * 0.25); j < Math.round(Hd * 0.36); j += 4) for (let i = 0; i < Wd; i += 6) {
    let n = 0, l = 0;
    for (let dj = -24; dj <= 24; dj += 4) for (let di = -24; di <= 24; di += 4) { n++; if (land(i + di, j + dj)) l++; }
    const f = l / n, score = 1 - Math.abs(f - 0.55) * 2 + (land(i, j) ? 0.2 : 0);
    if (score > bestScore) { bestScore = score; best = [i, j]; }
  }
  const phi = best[0] / Wd * Math.PI * 2, lat = (0.5 - best[1] / Hd) * Math.PI;
  const d = new THREE.Vector3(-Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat));
  COAST_Q = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(0, 1, 0));
  return COAST_Q;
}

// an Earth with clouds and an atmosphere you can see from inside or outside (ray-marched shell)
function buildEarth(R, atmH, sunDir) {
  const g = new THREE.Group();
  const T = earthTextures();
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), new THREE.MeshStandardMaterial({ map: T.map, roughness: 0.9 }));
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.0012, 128, 64), new THREE.MeshStandardMaterial({ map: T.clouds, transparent: true, depthWrite: false, roughness: 1 }));
  const atm = new THREE.Mesh(new THREE.SphereGeometry(R + atmH, 128, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { uR: { value: R }, uH: { value: atmH }, uSun: { value: sunDir }, uCenter: { value: new THREE.Vector3() } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform float uR, uH; uniform vec3 uSun, uCenter; varying vec3 vW;
      vec2 hit(vec3 o, vec3 d, float r){ vec3 oc = o - uCenter; float b = dot(oc, d), c = dot(oc, oc) - r*r, h = b*b - c; if (h < 0.0) return vec2(1e30, -1e30); h = sqrt(h); return vec2(-b - h, -b + h); }
      void main(){
        vec3 o = cameraPosition, d = normalize(vW - cameraPosition);
        vec2 a = hit(o, d, uR + uH), e = hit(o, d, uR);
        float t0 = max(a.x, 0.0), t1 = a.y;
        if (e.x > 0.0 && e.x < 1e29) t1 = min(t1, e.x);
        if (t1 <= t0) discard;
        float sh = uH * 0.16, dens = 0.0, lit = 0.0;
        for (int i = 0; i < 24; i++) {
          float t = mix(t0, t1, (float(i) + 0.5) / 24.0);
          vec3 p = o + d * t; float alt = length(p - uCenter) - uR;
          float rho = exp(-max(alt, 0.0) / sh);
          dens += rho; lit += rho * clamp(dot(normalize(p - uCenter), uSun) * 1.6 + 0.35, 0.0, 1.0);
        }
        float seg = (t1 - t0) / 24.0;
        float od = dens * seg / (uH * 2.2);
        float l = lit / max(dens, 1e-5);
        vec3 col = mix(vec3(0.25, 0.5, 1.0), vec3(0.6, 0.8, 1.0), clamp(od * 0.4, 0.0, 1.0));
        gl_FragColor = vec4(col * (1.0 - exp(-od)) * l * 1.25, 1.0);
      }`,
  }));
  earth.receiveShadow = true;
  g.add(earth, clouds, atm);
  return { group: g, earth, clouds, atm };
}

// ---------------------------------------------------------------- P9: cruising altitude (metres)
function buildAltitude(o) {
  const scene = new THREE.Scene();
  const SUN = new THREE.Vector3(-0.45, 0.6, 0.66).normalize();
  const sky = buildDaySky({ sun: SUN, zenith: '#2c5fb6', horizon: '#b9d2ea', ground: '#9fb0bb' });
  scene.add(sky.mesh);
  scene.fog = new THREE.Fog('#b9d2ea', 25000, 140000);
  scene.add(new THREE.HemisphereLight('#cfe2ff', '#6f7a60', 1.15));
  const sun = new THREE.DirectionalLight('#fff4e2', 2.4); sun.position.copy(SUN).multiplyScalar(1000); scene.add(sun);
  // the land far below, the city at the centre
  const geo = new THREE.PlaneGeometry(240000, 240000, 120, 120).rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 90000 + 0.5, -pos.getZ(i) / 90000 + 0.5);
  const rt = regionTexture(21); rt.wrapS = rt.wrapT = THREE.MirroredRepeatWrapping;
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: rt, roughness: 1 }));
  scene.add(ground);
  // two layers of cumulus well below
  const cl = new THREE.Group(), r = new Rng(31), tx = [0, 1, 2, 3].map((k) => makeCloudTexture(60 + k));
  for (let i = 0; i < 160; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx[i % 4], transparent: true, depthWrite: false, opacity: 0.95 }));
    const a = r.float(0, Math.PI * 2), d = Math.sqrt(r.next()) * 70000;
    s.position.set(Math.cos(a) * d, r.float(1800, 3200), Math.sin(a) * d);
    const sc = r.float(2500, 5500); s.scale.set(sc, sc * 0.42, 1);
    cl.add(s);
  }
  scene.add(cl);
  // the airliner
  const plane = buildPlane(); plane.scale.setScalar(1); scene.add(plane);
  // the paper
  const mat = makePaperMaterial();
  const stack = buildStack(mat, 2); scene.add(stack.group);
  return { scene, sky, stack, plane, SUN };
}

// ---------------------------------------------------------------- P10: the edge of space (km)
function buildOrbit() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#010205');
  const SUN = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
  const R = 6371;
  const E = buildEarth(R, 120, SUN);
  scene.add(E.group);
  scene.add(new THREE.AmbientLight('#26324a', 0.5));
  const sun = new THREE.DirectionalLight('#fff6ea', 2.6); sun.position.copy(SUN).multiplyScalar(20000); scene.add(sun);
  addStars(scene, 1e5, 3000, 5);
  const mat = makePaperMaterial();
  const stack = buildStack(mat, 2); scene.add(stack.group);
  // turn the planet so the column stands on a mid-latitude coast rather than the polar ice
  E.earth.quaternion.copy(coastQuat()); E.clouds.quaternion.copy(coastQuat());
  return { scene, E, stack, R, SUN };
}

function addStars(scene, radius, n, seed, size = 1.6) {
  const r = new Rng(seed), p = [], c = [];
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(r.gauss(), r.gauss(), r.gauss()).normalize().multiplyScalar(radius);
    p.push(v.x, v.y, v.z);
    const b = 0.35 + Math.pow(r.next(), 3) * 0.65, tint = r.next();
    c.push(b * (0.85 + 0.15 * tint), b * 0.9, b * (1.0 - 0.1 * tint));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  const m = new THREE.PointsMaterial({ size: size * PX, sizeAttenuation: false, vertexColors: true, map: softDot(32), transparent: true, depthWrite: false, toneMapped: false });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = -5;
  scene.add(pts);
  return pts;
}

function moonTexture() {
  const r = new Rng(4), S = 1024, cv = canvas(S, S / 2), c = cv.getContext('2d');
  c.fillStyle = '#a9a6a0'; c.fillRect(0, 0, S, S / 2);
  for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(88,88,92,${r.float(0.2, 0.45)})`; c.beginPath(); c.ellipse(r.float(0, S), r.float(60, S / 2 - 60), r.float(30, 120), r.float(20, 70), 0, 0, 7); c.fill(); }
  for (let i = 0; i < 420; i++) {
    const x = r.float(0, S), y = r.float(0, S / 2), rad = Math.pow(r.next(), 3) * 22 + 2;
    c.strokeStyle = 'rgba(70,70,70,0.35)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, rad, 0, 7); c.stroke();
    c.fillStyle = 'rgba(210,208,200,0.25)'; c.beginPath(); c.arc(x - rad * 0.2, y - rad * 0.2, rad * 0.7, 0, 7); c.fill();
  }
  return ctex(cv);
}

// ---------------------------------------------------------------- P11: Earth and Moon (thousands of km)
function buildMoonScene() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#010205');
  const SUN = new THREE.Vector3(1, 0.25, 0.6).normalize();
  const E = buildEarth(6.371, 0.12, SUN); scene.add(E.group);
  E.earth.quaternion.copy(coastQuat()); E.clouds.quaternion.copy(coastQuat());
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.737, 64, 32), new THREE.MeshStandardMaterial({ map: moonTexture(), roughness: 1 }));
  moon.position.set(-14, 384.4, 0); scene.add(moon);
  const orbit = ring(scene, 384.4, '#7f8fb8', 0.35, new THREE.Euler(0, 0, 0), 'xy', new THREE.Vector3(0, 0, 0));
  scene.add(new THREE.AmbientLight('#2a3550', 0.35));
  const sun = new THREE.DirectionalLight('#fff6ea', 2.8); sun.position.copy(SUN).multiplyScalar(1000); scene.add(sun);
  addStars(scene, 9000, 3500, 6);
  const line = makeLine(scene);
  return { scene, E, moon, line, SUN };
}

function ring(scene, rad, color, opacity, rot, plane = 'xz', center = new THREE.Vector3()) {
  const pts = [];
  for (let i = 0; i <= 512; i++) { const a = i / 512 * Math.PI * 2; pts.push(plane === 'xz' ? new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad) : new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, 0)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity, toneMapped: false }));
  l.position.copy(center); l.rotation.copy(rot); scene.add(l);
  return l;
}

// ---------------------------------------------------------------- P12: the Sun (millions of km)
function buildSunScene() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#010205');
  const sunCore = new THREE.Mesh(new THREE.SphereGeometry(0.696, 32, 16), new THREE.MeshBasicMaterial({ color: '#fff3d0', toneMapped: false }));
  scene.add(sunCore);
  const glow = (size, col, op) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(256, 'rgba(255,255,255,1)', 'rgba(255,255,255,0.25)'), color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); s.userData.px = size; scene.add(s); return s; };
  const g1 = glow(150, '#ffd98a', 0.9), g2 = glow(520, '#ff9e40', 0.35);
  const EARTH_POS = new THREE.Vector3(149.6, 0, 0);
  const earthDot = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshBasicMaterial({ color: '#6fa8ff', toneMapped: false }));
  scene.add(earthDot);
  const orbit = ring(scene, 149.6, '#8fa2d8', 0.45, new THREE.Euler(0, 0, 0), 'xz');
  addStars(scene, 30000, 3000, 7);
  const line = makeLine(scene);
  return { scene, sunCore, glows: [g1, g2], earthDot, EARTH_POS, line };
}

// ---------------------------------------------------------------- P13: the Milky Way (thousands of light-years)
function galaxyTexture() {
  const r = new Rng(13), S = 2048, cv = canvas(S, S), c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, S, S);
  c.globalCompositeOperation = 'lighter';
  const ctr = S / 2, scale = S / 2 / 60;   // 60 kly to the edge of the texture
  // diffuse disc
  let g = c.createRadialGradient(ctr, ctr, 0, ctr, ctr, 50 * scale);
  g.addColorStop(0, 'rgba(255,224,170,0.55)'); g.addColorStop(0.18, 'rgba(240,210,170,0.22)'); g.addColorStop(0.6, 'rgba(150,170,220,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  // stars along two log-spiral arms (plus spurs)
  for (let i = 0; i < 90000; i++) {
    const arm = r.int(0, 3), t = Math.pow(r.next(), 0.75) * 4.2;
    const rad = 4 + t * 11 + r.gauss() * 2.2;
    const ang = arm * Math.PI / 2 + t * 1.25 + r.gauss() * 0.22;
    const x = ctr + Math.cos(ang) * rad * scale, y = ctr + Math.sin(ang) * rad * scale;
    const b = r.float(0.08, 0.5), s = r.float(0.8, 2.6);
    c.fillStyle = r.chance(0.7) ? `rgba(190,210,255,${b})` : `rgba(255,230,190,${b})`;
    c.fillRect(x, y, s, s);
  }
  // a few pink star-forming knots on the arms
  for (let i = 0; i < 260; i++) {
    const arm = r.int(0, 3), t = r.float(0.4, 4), rad = 4 + t * 11, ang = arm * Math.PI / 2 + t * 1.25 + r.gauss() * 0.1;
    const x = ctr + Math.cos(ang) * rad * scale, y = ctr + Math.sin(ang) * rad * scale;
    g = c.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, 'rgba(255,150,190,0.5)'); g.addColorStop(1, 'rgba(255,150,190,0)');
    c.fillStyle = g; c.fillRect(x - 9, y - 9, 18, 18);
  }
  // the bright bar/bulge
  g = c.createRadialGradient(ctr, ctr, 0, ctr, ctr, 9 * scale);
  g.addColorStop(0, 'rgba(255,240,210,0.95)'); g.addColorStop(0.5, 'rgba(255,215,160,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(ctr, ctr, 9 * scale, 5.5 * scale, 0.5, 0, 7); c.fill();
  return ctex(cv);
}
function buildGalaxy() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#010104');
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: galaxyTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  disc.material.opacity = 0; scene.add(disc);
  // a thin 3D sprinkle of nearby stars around the Sun for the start of the zoom
  const r = new Rng(17), p = [];
  const SUNPOS = new THREE.Vector3(26 * Math.cos(2.2), 0, 26 * Math.sin(2.2));
  for (let i = 0; i < 30000; i++) { const d = Math.pow(r.next(), 0.5) * 14; const v = new THREE.Vector3(r.gauss(), r.gauss() * 0.12, r.gauss()).normalize().multiplyScalar(d).add(SUNPOS); p.push(v.x, v.y, v.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const near = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.8 * PX, sizeAttenuation: false, color: '#dde6ff', map: softDot(32), transparent: true, depthWrite: false, toneMapped: false }));
  near.frustumCulled = false; scene.add(near);
  addStars(scene, 3000, 1500, 9, 1.4);
  const line = makeLine(scene);
  return { scene, line, SUNPOS, near, disc };
}

// ---------------------------------------------------------------- P14: the observable universe (billions of light-years)
function buildUniverse() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#000002');
  const R = 46.5;
  // cosmic web: galaxies gathered on the walls between noise cells
  const r = new Rng(23), p = [], c = [];
  const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  const cellD = (x, y, z) => {   // distance to the nearest two cell points (Worley): small (F2 - F1) = on a wall
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let f1 = 9, f2 = 9;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const cx = xi + i + hash(xi + i, yi + j, zi + k), cy = yi + j + hash(yi + j, zi + k, xi + i), cz = zi + k + hash(zi + k, xi + i, yi + j);
      const d = Math.hypot(x - cx, y - cy, z - cz);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return f2 - f1;
  };
  let tries = 0;
  while (p.length < 3 * 110000 && tries < 1600000) {
    tries++;
    const v = new THREE.Vector3(r.float(-1, 1), r.float(-1, 1), r.float(-1, 1));
    if (v.lengthSq() > 1) continue;
    v.multiplyScalar(R);
    const w = cellD(v.x / 7, v.y / 7, v.z / 7);
    if (r.next() > Math.exp(-w * 9)) continue;
    p.push(v.x, v.y, v.z);
    const b = r.float(0.45, 1.0), warm = r.next();
    c.push(b * lerp(0.7, 1.0, warm), b * lerp(0.75, 0.85, warm), b * lerp(1.0, 0.75, warm));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  const web = new THREE.Points(g, new THREE.PointsMaterial({ size: 3.8 * PX, sizeAttenuation: false, vertexColors: true, map: softDot(32), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  web.frustumCulled = false; scene.add(web);
  // the edge of what we can see: a faint glowing shell
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(vec3(0.45,0.6,1.0) * f * 0.55, 1.0); }',
  }));
  scene.add(shell);
  // our galaxy at the centre, where the previous shot left off; it shrinks to a speck as we pull out
  const mw = new THREE.Sprite(new THREE.SpriteMaterial({ map: galaxyTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  mw.scale.setScalar(1.2); scene.add(mw);
  const line = makeLine(scene);
  return { scene, line, R, mw };
}

// ---------------------------------------------------------------- the director
export function buildCosmos(o) {
  const { thick, foldsSmooth, shotStart, shotEnd, foldAt, flipYawFor } = o;
  PX = o.SCALE ?? 1;
  const camera = new THREE.PerspectiveCamera(46, W / H, 0.1, 1000);
  const S = { P9: buildAltitude(o), P10: buildOrbit(), P11: buildMoonScene(), P12: buildSunScene(), P13: buildGalaxy(), P14: buildUniverse() };
  const KM = 1000, MM = 1e6, GM = 1e9, KLY = 9.4607e18, GLY = 9.4607e24;
  const len = (t, unit) => thick(foldsSmooth(t)) / unit;
  const U = (t, id) => { const a = shotStart(id), b = shotEnd(id); return clamp((t - a) / (b - a)); };

  // the folded column (P9, P10): same flips as in the park, in this scene's units
  function column(stack, t, base, unit, cam, yaw) {
    const { n, act } = foldAt(t);
    const k = act ? act.k : n;
    const Hc = thick(k) / unit;
    const mid = base.clone().add(new THREE.Vector3(0, Hc / 2, 0));
    const d = Math.max(cam.position.distanceTo(mid) - Hc * 0.25, cam.near * 4);
    const wv = 22 * 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / H;
    const Uv = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    if (act) {
      const T = thick(act.k - 1) / unit, O = base.clone().add(new THREE.Vector3(0, T, 0));
      const th = Math.PI * easeInOut(act.p);
      stack.set([
        { origin: O.clone(), yaw: yaw + Math.PI, L: wv / 2, W: wv, T, theta: 0, layers: 1 },
        { origin: O.clone(), yaw, L: wv / 2, W: wv, T, theta: th, r: 0, layers: 1 },
      ]);
    } else {
      const since = act ? 0 : o.sinceLanding(t);
      const L = wv * lerp(0.5, 1, smooth(0, 0.18, since));
      const far = base.clone().addScaledVector(Uv, -wv / 2);
      stack.set([{ origin: new THREE.Vector3(far.x, base.y + Hc, far.z), yaw, L, W: wv, T: Hc, theta: 0, layers: 1 }]);
    }
  }

  const CAM = {
    // level with the airliner at 11 km, looking across at the column
    P9: (t) => { const e = easeInOut(U(t, 'P9')); return { pos: new THREE.Vector3(lerp(-17600, -17000, e), 11050, lerp(11800, 11400, e)), look: new THREE.Vector3(0, lerp(7600, 8200, e), 0), fov: 46, near: 5, far: 260000 }; },
    P10: (t) => { const e = easeInOut(U(t, 'P10')); return { pos: new THREE.Vector3(lerp(-860, -800, e), 6371 + lerp(150, 190, e), lerp(260, 240, e)), look: new THREE.Vector3(0, 6371 + lerp(40, 62, e), 0), fov: 44, near: 1, far: 60000 }; },
    // the camera backs away just fast enough to keep the tip in frame (log zoom)
    P11: (t) => {
      const L = len(t, MM);
      const span = clamp(Math.max(L * 1.15, 22), 22, 460);
      const d = span / (2 * Math.tan(THREE.MathUtils.degToRad(22))) * 1.05;
      const look = new THREE.Vector3(-3, 6.371 + span * 0.42 - 4, 0);
      return { pos: look.clone().add(new THREE.Vector3(d * 0.94, d * 0.1, d * 0.33)), look, fov: 44, near: d * 0.002, far: d * 30 };
    },
    // seen from above the plane of the orbit, Earth at the bottom, the line running up past the Sun
    P12: (t) => {
      const L = len(t, GM);
      const span = clamp(L * 1.2, 3, 300);
      const d = span / (2 * Math.tan(THREE.MathUtils.degToRad(23)));
      const look = new THREE.Vector3(149.6 - span * 0.4, 0, 0);
      return { pos: look.clone().add(new THREE.Vector3(-d * 0.2, d * 0.97, d * 0.1)), look, fov: 46, near: d * 0.001, far: d * 50, up: new THREE.Vector3(-1, 0, 0) };
    },
    P13: (t) => {
      const dir = P13dir(), k = smooth(0, 0.78, U(t, 'P13'));
      const span = logLerp(26, 140, k);
      const d = span / (2 * Math.tan(THREE.MathUtils.degToRad(23)));
      const look = S.P13.SUNPOS.clone().addScaledVector(dir, span * 0.38);
      return { pos: look.clone().add(new THREE.Vector3(0, d * 0.88, 0)).addScaledVector(dir, -d * 0.45), look, fov: 46, near: d * 0.001, far: d * 60, up: dir.clone() };
    },
    P14: (t) => {
      const k = smooth(shotStart('P14'), o.HERE + 0.1, t);
      const span = logLerp(40, 200, k) * (1 + 0.04 * smooth(o.HERE, o.HERE + 2.5, t));
      const d = span / (2 * Math.tan(THREE.MathUtils.degToRad(23)));
      const look = new THREE.Vector3(0, lerp(0, 34, k), 0);
      return { pos: look.clone().add(new THREE.Vector3(d * 0.35, d * 0.12, d * 0.93)), look, fov: 46, near: d * 0.001, far: d * 60 };
    },
  };
  // where the line points in each cosmic shot
  const DIR = {
    P11: new THREE.Vector3(0, 1, 0),
    P12: new THREE.Vector3(-1, 0, 0.012).normalize(),
    P13: null,
    P14: new THREE.Vector3(0.12, 1, 0).normalize(),
  };
  const P13dir = () => new THREE.Vector3(0, 0, 0).sub(S.P13.SUNPOS).normalize().add(new THREE.Vector3(0, 0, 0.12)).normalize();

  function update(t, shot) {
    const c = CAM[shot](t); setCam(camera, c);
    const sc = S[shot];
    if (shot === 'P9') {
      const p = sc.plane, pu = U(t, 'P9');
      // the plane crosses in front of the camera at cruising altitude (11 km), heading right to left
      const fwd = new THREE.Vector3().subVectors(c.look, c.pos).setY(0).normalize(), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const at = c.pos.clone().addScaledVector(fwd, 950).addScaledVector(right, lerp(300, -300, smooth(0.05, 0.95, pu)));
      p.position.set(at.x, 10990, at.z);
      p.rotation.set(0, Math.atan2(right.z, -right.x) + Math.PI, 0.04);
      column(sc.stack, t, new THREE.Vector3(0, 0, 0), 1, camera, flipYawFor('P9', camera));
    } else if (shot === 'P10') {
      column(sc.stack, t, new THREE.Vector3(0, sc.R, 0), KM, camera, flipYawFor('P10', camera));
    } else if (shot === 'P11') {
      sc.line.set(new THREE.Vector3(0, 6.371, 0), DIR.P11, len(t, MM), camera, 6, 40);
      sc.E.group.rotation.y = 0;
    } else if (shot === 'P12') {
      const e = sc.EARTH_POS;
      sc.earthDot.position.copy(e);
      const dE = Math.max(camera.position.distanceTo(e), 1e-3), wpp = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / H;
      sc.earthDot.scale.setScalar(Math.max(0.0064, 7 * wpp * dE));
      sc.sunCore.scale.setScalar(Math.max(1, 4 * wpp * camera.position.length() / 0.696));
      for (const g of sc.glows) g.scale.setScalar(g.userData.px * wpp * camera.position.length());
      sc.line.set(e, DIR.P12, len(t, GM), camera, 5, 36);
    } else if (shot === 'P13') {
      const dd = camera.position.distanceTo(c.look);
      sc.disc.material.opacity = lerp(0.45, 1, smooth(30, 120, dd));
      sc.near.material.opacity = 1 - smooth(30, 90, dd);
      sc.line.set(sc.SUNPOS, P13dir(), len(t, KLY), camera, 5, 36);
    } else if (shot === 'P14') {
      const dd = camera.position.length(), wpp = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / H;
      sc.mw.scale.setScalar(Math.max(1.2, 150 * wpp * dd) * (1 - smooth(0.25, 0.6, U(t, 'P14'))) + 1e-6);
      sc.line.set(new THREE.Vector3(0, 0, 0), DIR.P14, len(t, GLY), camera, 5, 54);
    }
    return { scene: sc.scene, camera };
  }

  const cam2 = new THREE.PerspectiveCamera(46, W / H, 0.1, 1000);
  function labels(t, shot) {
    if (!CAM[shot]) return [];
    setCam(cam2, CAM[shot](t));
    const out = [];
    const put = (p, text, a, extra = {}) => { const q = project(p, cam2); if (q.ok && a > 0.001) out.push(Object.assign({ x: q.x, y: q.y, text, alpha: a }, extra)); };
    const u = U(t, shot);
    if (shot === 'P10') put(new THREE.Vector3(0, 6371 + 100, 0), 'EDGE OF SPACE · 100 KM', smooth(0.62, 0.75, u), { side: 'left' });
    if (shot === 'P9') put(S.P9.plane.position.clone(), 'PLANES · 11 KM', smooth(0.2, 0.32, u) * (1 - smooth(0.8, 0.9, u)), { side: 'left' });
    if (shot === 'P11') put(S.P11.moon.position, 'THE MOON', smooth(0.45, 0.6, u));
    if (shot === 'P12') { put(new THREE.Vector3(0, 0, 0), 'THE SUN', smooth(0.45, 0.6, u)); put(S.P12.EARTH_POS, 'EARTH', smooth(0.1, 0.25, u) * (1 - smooth(0.85, 0.95, u)), { side: 'left' }); }
    if (shot === 'P13') put(new THREE.Vector3(0, 0, 0), 'THE MILKY WAY', smooth(0.55, 0.7, u));
    if (shot === 'P14') {
      put(new THREE.Vector3(0, -46.5, 0), 'THE OBSERVABLE UNIVERSE', smooth(0.25, 0.4, u));
      const tipLen = len(Math.min(t, o.HERE + 0.3), GLY);
      put(DIR.P14.clone().multiplyScalar(tipLen), 'HERE', smooth(o.HERE, o.HERE + 0.25, t), { big: true });
    }
    return out;
  }

  return { has: (shot) => !!CAM[shot], update, labels, scenes: S, CAM };
}
