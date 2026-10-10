// A sunny city park and the skyline around it, built for steady, clean frames: no time-varying
// lights, crisp mip-mapped window grids (no per-pixel noise), flat-shaded trees.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng, clamp, lerp } from './rng.js';

const tex = (cv, o = {}) => {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
};
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// a flat disc made of rings whose radii grow geometrically from r0 to r1 (y up, facing +y)
export function radialGround(r0, r1, rings, segs) {
  const pos = [0, 0, 0], idx = [];
  const radii = []; for (let i = 0; i < rings; i++) radii.push(r0 * Math.pow(r1 / r0, i / (rings - 1)));
  for (const r of radii) for (let j = 0; j < segs; j++) { const a = j / segs * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + (j + 1) % segs, 1 + j);
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < segs; j++) {
    const a = 1 + i * segs + j, b = 1 + i * segs + (j + 1) % segs, c = 1 + (i + 1) * segs + j, d = 1 + (i + 1) * segs + (j + 1) % segs;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(0).flatMap(() => [0, 1, 0]), 3));
  const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / 400, -pos[i + 2] / 400);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// city ground seen from above: a 400 m tile of blocks, streets and a few green squares
function cityGroundTexture(seed) {
  const r = new Rng(seed), S = 1024, cv = canvas(S, S), c = cv.getContext('2d');
  c.fillStyle = '#7a7c7e'; c.fillRect(0, 0, S, S);              // streets
  const n = 5, cell = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * cell + 12, y = j * cell + 12, w = cell - 24, h = cell - 24;
    c.fillStyle = r.chance(0.12) ? '#6f8f52' : r.pick(['#a39d92', '#9a968e', '#b0a99c', '#8f8b84', '#a8a39a']);
    c.fillRect(x, y, w, h);
    // lots inside the block
    c.strokeStyle = 'rgba(60,60,60,0.25)'; c.lineWidth = 2;
    for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x + w * k / 4, y); c.lineTo(x + w * k / 4, y + h); c.stroke(); }
    c.beginPath(); c.moveTo(x, y + h / 2); c.lineTo(x + w, y + h / 2); c.stroke();
  }
  c.strokeStyle = 'rgba(230,226,215,0.5)'; c.lineWidth = 2; c.setLineDash([10, 12]);
  for (let i = 0; i < n; i++) { c.beginPath(); c.moveTo(i * cell, 0); c.lineTo(i * cell, S); c.stroke(); c.beginPath(); c.moveTo(0, i * cell); c.lineTo(S, i * cell); c.stroke(); }
  return tex(cv);
}

// ---------------------------------------------------------------- sky
export function buildDaySky(o = {}) {
  const U = {
    uZenith: { value: new THREE.Color(o.zenith ?? '#3f7fd1') }, uHorizon: { value: new THREE.Color(o.horizon ?? '#bcd8f0') },
    uGround: { value: new THREE.Color(o.ground ?? '#a7b4ba') }, uSun: { value: (o.sun ?? new THREE.Vector3(0, 1, 0)).clone() },
    uSunAmt: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uZenith, uHorizon, uGround, uSun; uniform float uSunAmt; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 c = h > 0.0 ? mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5)) : mix(uHorizon, uGround, clamp(-h * 8.0, 0.0, 1.0));
        float s = max(dot(d, uSun), 0.0);
        c += vec3(1.0, 0.95, 0.85) * (pow(s, 12.0) * 0.25 + pow(s, 200.0) * 0.6) * uSunAmt;
        c = mix(c, vec3(1.0, 0.98, 0.93) * 3.0, smoothstep(0.99955, 0.9997, s) * uSunAmt);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  dome.frustumCulled = false; dome.renderOrder = -10;
  dome.onBeforeRender = (r, s, cam) => { dome.position.copy(cam.position); dome.scale.setScalar(cam.far * 0.9); dome.updateMatrixWorld(); };
  return { mesh: dome, U };
}

// soft cumulus billboards (always face the camera, never flicker)
export function makeCloudTexture(seed) {
  const r = new Rng(seed);
  const W = 512, H = 256, cv = canvas(W, H), c = cv.getContext('2d');
  for (let pass = 0; pass < 2; pass++) {
    const r2 = new Rng(seed);
    for (let i = 0; i < 46; i++) {
      const x = W * (0.12 + 0.76 * r2.next()), y = H * (0.42 + 0.3 * r2.next()), rad = W * (0.05 + 0.09 * r2.next());
      const yy = y - (pass ? rad * 0.35 : 0) - rad * 0.4 * Math.sin(Math.PI * (x / W));
      const g = c.createRadialGradient(x, yy, 0, x, yy, rad);
      if (!pass) { g.addColorStop(0, 'rgba(190,198,212,0.5)'); g.addColorStop(1, 'rgba(190,198,212,0)'); }
      else { g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(0.55, 'rgba(252,252,254,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
      c.fillStyle = g; c.beginPath(); c.arc(x, yy, rad, 0, Math.PI * 2); c.fill();
    }
  }
  return tex(cv);
}

// ---------------------------------------------------------------- materials
function grassTexture(seed) {
  const r = new Rng(seed), S = 512, cv = canvas(S, S), c = cv.getContext('2d');
  c.fillStyle = '#6f9a45'; c.fillRect(0, 0, S, S);
  // soft patches, then fine blades (low contrast so it stays calm at any distance)
  for (let i = 0; i < 90; i++) {
    const x = r.float(0, S), y = r.float(0, S), rad = r.float(20, 70);
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    const col = r.pick(['rgba(96,140,58,0.35)', 'rgba(128,160,74,0.3)', 'rgba(88,128,52,0.3)']);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { c.save(); c.translate(dx, dy); c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill(); c.restore(); }
  }
  for (let i = 0; i < 9000; i++) {
    const x = r.float(0, S), y = r.float(0, S), l = r.float(2, 6);
    c.strokeStyle = r.pick(['rgba(70,110,40,0.35)', 'rgba(140,175,90,0.3)', 'rgba(100,140,60,0.3)']);
    c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + r.float(-1, 1), y - l); c.stroke();
  }
  return tex(cv);
}

function blanketTexture() {
  const S = 512, cv = canvas(S, S), c = cv.getContext('2d');
  c.fillStyle = '#f4efe6'; c.fillRect(0, 0, S, S);
  const n = 8, w = S / n;
  for (let i = 0; i < n; i++) {
    c.fillStyle = 'rgba(196,48,52,0.55)'; c.fillRect(i * w, 0, w / 2, S); c.fillRect(0, i * w, S, w / 2);
  }
  // fine weave
  c.globalAlpha = 0.08;
  for (let i = 0; i < S; i += 2) { c.fillStyle = i % 4 ? '#000' : '#fff'; c.fillRect(i, 0, 1, S); c.fillRect(0, i, S, 1); }
  return tex(cv);
}

// a facade: floors x bays of windows; the texture covers 4 floors x 4 bays and is repeated
function facadeTexture(o) {
  const W = 512, H = 512, cv = canvas(W, H), c = cv.getContext('2d');
  c.fillStyle = o.wall; c.fillRect(0, 0, W, H);
  const fw = W / 4, fh = H / 4;
  for (let fy = 0; fy < 4; fy++) for (let bx = 0; bx < 4; bx++) {
    const x = bx * fw + fw * o.mx, y = fy * fh + fh * o.my, w = fw * (1 - 2 * o.mx), h = fh * (1 - o.my - o.mb);
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.glassTop); g.addColorStop(1, o.glassBot);
    c.fillStyle = g; c.fillRect(x, y, w, h);
    c.strokeStyle = o.frame; c.lineWidth = 4; c.strokeRect(x + 2, y + 2, w - 4, h - 4);
    if (o.mullion) { c.fillStyle = o.frame; c.fillRect(x + w / 2 - 2, y, 4, h); }
    if (o.sill) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x - 4, y + h, w + 8, 6); }
  }
  // floor lines
  if (o.bands) { c.fillStyle = o.bands; for (let fy = 0; fy < 4; fy++) c.fillRect(0, fy * fh, W, 6); }
  return tex(cv);
}

const FACADES = [
  { wall: '#d8cdb8', glassTop: '#5d7fa3', glassBot: '#2f4a68', frame: '#efe9dd', mx: 0.16, my: 0.22, mb: 0.18, sill: true },
  { wall: '#b9785c', glassTop: '#6a88a8', glassBot: '#33475f', frame: '#e8dccb', mx: 0.18, my: 0.2, mb: 0.2, sill: true, mullion: true },
  { wall: '#e9e6df', glassTop: '#7a9cbc', glassBot: '#3d5878', frame: '#cfcac0', mx: 0.12, my: 0.18, mb: 0.12, bands: 'rgba(0,0,0,0.06)' },
  { wall: '#8aa0b4', glassTop: '#9cc0dd', glassBot: '#4d6d8e', frame: '#7d92a6', mx: 0.04, my: 0.08, mb: 0.06, mullion: true },
  { wall: '#c9c3b6', glassTop: '#6f8fae', glassBot: '#38506b', frame: '#a9a296', mx: 0.08, my: 0.12, mb: 0.1, bands: 'rgba(0,0,0,0.08)' },
  { wall: '#4f6478', glassTop: '#a4c6e2', glassBot: '#58779a', frame: '#3d4f60', mx: 0.03, my: 0.05, mb: 0.05, mullion: true },
];

// ---------------------------------------------------------------- buildings
// box building with a window grid on four sides, a flat roof with a little equipment
function building(o, mats) {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const floorH = o.floorH ?? 3.3, bay = o.bay ?? 3.4;
  const geo = new THREE.BoxGeometry(w, h, d);
  // UVs in "4-floor x 4-bay" units so the window grid keeps its real size on every face
  const uv = geo.attributes.uv, pos = geo.attributes.position, nrm = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    const x = pos.getX(i), y = pos.getY(i) + h / 2, z = pos.getZ(i);
    if (ny > 0.5) { uv.setXY(i, 0.02, 0.02); continue; }   // roof: a plain wall-coloured corner of the texture
    const across = nx > 0.5 ? z : x;
    uv.setXY(i, across / (bay * 4), y / (floorH * 4));
  }
  const m = new THREE.Mesh(geo, mats.facade[o.style]);
  m.position.y = h / 2; m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  // ground floor band and a parapet
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, Math.min(4.2, h * 0.3), d + 0.3), mats.base[o.style % mats.base.length]);
  base.position.y = Math.min(4.2, h * 0.3) / 2; base.castShadow = base.receiveShadow = true; g.add(base);
  const par = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.9, d + 0.4), mats.roof);
  par.position.y = h + 0.45; par.castShadow = true; g.add(par);
  const roofIn = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.2, d - 0.6), mats.roofTop);
  roofIn.position.y = h + 0.85; g.add(roofIn);
  if (o.box) { const b = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 3, d * 0.3), mats.roof); b.position.set(w * 0.15, h + 1.5, -d * 0.1); b.castShadow = true; g.add(b); }
  g.position.set(o.x, 0, o.z);
  g.rotation.y = o.rot ?? 0;
  return g;
}

// a stepped supertall: a Y-ish plan of three wings that step back as it rises, then a spire
function supertall(mats) {
  const g = new THREE.Group();
  const H = 828;
  const tiers = [[0, 160, 70], [160, 300, 60], [300, 420, 50], [420, 520, 40], [520, 590, 30], [590, 640, 22]];
  const mat = mats.tall;
  for (const [y0, y1, rad] of tiers) {
    for (let k = 0; k < 3; k++) {
      const a = k * Math.PI * 2 / 3;
      const len = rad * (1 - 0.08 * k);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(len, y1 - y0, 26), mat);
      wing.position.set(Math.cos(a) * len / 2, (y0 + y1) / 2, Math.sin(a) * len / 2);
      wing.rotation.y = -a;
      wing.castShadow = true; wing.receiveShadow = true;
      g.add(wing);
    }
    const core = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, y1 - y0, 12), mat);
    core.position.y = (y0 + y1) / 2; core.castShadow = true; g.add(core);
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(10, 18, 70, 10), mat); top.position.y = 675; top.castShadow = true; g.add(top);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 9, H - 710, 8), mats.spire); spire.position.y = 710 + (H - 710) / 2; spire.castShadow = true; g.add(spire);
  // UVs for the glass curtain wall: 4 m bays, 4.2 m floors
  g.traverse((o) => {
    if (!o.isMesh || o.material !== mat) return;
    const geo = o.geometry, uv = geo.attributes.uv, pos = geo.attributes.position, nrm = geo.attributes.normal;
    const s = new THREE.Vector3(); o.updateMatrix();
    for (let i = 0; i < uv.count; i++) {
      s.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrix);
      const across = Math.abs(nrm.getX(i)) > 0.5 ? pos.getZ(i) : pos.getX(i);
      uv.setXY(i, across / 16, s.y / 16.8);
    }
  });
  return g;
}

// ---------------------------------------------------------------- trees, benches, props
function buildTrees(list, mats) {
  const crowns = [new THREE.IcosahedronGeometry(1, 1), new THREE.IcosahedronGeometry(1, 0)];
  const trunkG = new THREE.CylinderGeometry(0.16, 0.24, 1, 7).translate(0, 0.5, 0);
  const n = list.length;
  const trunks = new THREE.InstancedMesh(trunkG, mats.trunk, n);
  const crownM = [new THREE.InstancedMesh(crowns[0], mats.leaf, n * 3), new THREE.InstancedMesh(crowns[1], mats.leaf, n * 3)];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), r = new Rng(77);
  const cnt = [0, 0];
  list.forEach((t, i) => {
    M.compose(new THREE.Vector3(t.x, 0, t.z), Q.identity(), new THREE.Vector3(t.s, t.h * 0.55 * t.s, t.s)); trunks.setMatrixAt(i, M);
    for (let k = 0; k < 3; k++) {
      const kind = r.chance(0.5) ? 0 : 1;
      const rad = t.s * r.float(1.6, 2.4) * (k ? 0.8 : 1);
      M.compose(new THREE.Vector3(t.x + r.float(-1, 1) * t.s, t.h * t.s * (0.62 + 0.15 * k), t.z + r.float(-1, 1) * t.s),
        Q.setFromEuler(E.set(r.float(0, 3), r.float(0, 3), r.float(0, 3))), new THREE.Vector3(rad, rad * r.float(0.8, 1), rad));
      crownM[kind].setMatrixAt(cnt[kind], M);
      crownM[kind].setColorAt(cnt[kind], new THREE.Color().setHSL(r.float(0.24, 0.31), r.float(0.42, 0.55), r.float(0.27, 0.36)));
      cnt[kind]++;
    }
  });
  crownM.forEach((m, k) => { m.count = cnt[k]; m.castShadow = true; m.receiveShadow = true; });
  trunks.castShadow = true; trunks.receiveShadow = true;
  const g = new THREE.Group(); g.add(trunks, ...crownM);
  return g;
}

export function buildMug() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f2efe9', roughness: 0.35 });
  const prof = [];
  const R = 0.041, H = 0.095;
  prof.push(new THREE.Vector2(0.0, 0), new THREE.Vector2(R - 0.004, 0), new THREE.Vector2(R, 0.004), new THREE.Vector2(R, H), new THREE.Vector2(R - 0.004, H), new THREE.Vector2(R - 0.004, 0.012), new THREE.Vector2(0, 0.012));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), white);
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(R - 0.004, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3b2416', roughness: 0.25 }));
  coffee.position.y = H - 0.014; g.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0065, 10, 20, Math.PI * 1.15), white);
  handle.rotation.z = -Math.PI * 0.575; handle.position.set(R + 0.004, H * 0.52, 0); handle.castShadow = true; g.add(handle);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.0006, R + 0.0006, 0.012, 40, 1, true), new THREE.MeshStandardMaterial({ color: '#c43a34', roughness: 0.4 }));
  band.position.y = H * 0.72; g.add(band);
  return g;
}

// ---------------------------------------------------------------- the whole park + city
// The picnic blanket is at the origin; the park lawn runs toward +z; a 4-storey building stands just
// left of the blanket; a 30-storey tower across the street; the skyline beyond; a supertall ~1 km away.
export const TOWN = {
  BUILDING4: { x: 12.5, z: -3, w: 12, d: 14, h: 13.2 },
  TOWER30: { x: -40, z: -78, w: 30, d: 30, h: 100 },
  SUPERTALL: { x: -260, z: -420 },
};

export function buildTown(o = {}) {
  const r = new Rng(o.seed ?? 5);
  const group = new THREE.Group();
  const mats = {
    facade: FACADES.map((f) => new THREE.MeshStandardMaterial({ map: facadeTexture(f), roughness: 0.62, metalness: 0.0 })),
    base: [new THREE.MeshStandardMaterial({ color: '#8d877d', roughness: 0.85 }), new THREE.MeshStandardMaterial({ color: '#5d5a55', roughness: 0.8 })],
    roof: new THREE.MeshStandardMaterial({ color: '#9a958c', roughness: 0.9 }),
    roofTop: new THREE.MeshStandardMaterial({ color: '#77736c', roughness: 0.95 }),
    tall: new THREE.MeshStandardMaterial({ map: facadeTexture({ wall: '#9fb4c6', glassTop: '#c7dcec', glassBot: '#6f8fae', frame: '#a9bccc', mx: 0.03, my: 0.05, mb: 0.05, mullion: true }), roughness: 0.35, metalness: 0.2 }),
    spire: new THREE.MeshStandardMaterial({ color: '#c9d3dc', roughness: 0.3, metalness: 0.5 }),
    trunk: new THREE.MeshStandardMaterial({ color: '#6b4f36', roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }),
    asphalt: new THREE.MeshStandardMaterial({ color: '#55585c', roughness: 0.92 }),
    walk: new THREE.MeshStandardMaterial({ color: '#c9c2b4', roughness: 0.9 }),
    path: new THREE.MeshStandardMaterial({ color: '#d8ccb0', roughness: 0.95 }),
  };
  mats.tall.map.repeat.set(1, 1);

  // ---- ground: the lawn (fine grass), streets and sidewalks around it, a plain far ground
  // the far ground: a radial grid that is dense near the blanket, so no triangle is ever huge next to the camera
  // (giant triangles lose depth precision with a near plane of a few millimetres)
  const far = new THREE.Mesh(radialGround(0.5, 30000, 72, 64), new THREE.MeshStandardMaterial({ map: cityGroundTexture(8), roughness: 1 }));
  far.position.y = -0.05; far.receiveShadow = true; group.add(far);
  const PARK = { x0: -60, x1: 90, z0: -34, z1: 180 };
  const gtex = grassTexture(3); gtex.repeat.set((PARK.x1 - PARK.x0) / 3, (PARK.z1 - PARK.z0) / 3);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(PARK.x1 - PARK.x0, PARK.z1 - PARK.z0, 60, 86).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.95 }));
  lawn.position.set((PARK.x0 + PARK.x1) / 2, 0, (PARK.z0 + PARK.z1) / 2); lawn.receiveShadow = true; group.add(lawn);
  // a winding gravel path
  const pathPts = [];
  for (let i = 0; i <= 40; i++) { const z = lerp(PARK.z1, PARK.z0 + 6, i / 40); pathPts.push(new THREE.Vector3(18 + 14 * Math.sin(z * 0.03), 0.01, z)); }
  const pathCurve = new THREE.CatmullRomCurve3(pathPts);
  const pts = pathCurve.getPoints(160), pathGeo = new THREE.BufferGeometry(), pp = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), nx = -dz / L * 1.6, nz = dx / L * 1.6;
    pp.push(a.x + nx, 0.012, a.z + nz, a.x - nx, 0.012, a.z - nz, b.x + nx, 0.012, b.z + nz, a.x - nx, 0.012, a.z - nz, b.x - nx, 0.012, b.z - nz, b.x + nx, 0.012, b.z + nz);
  }
  pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); pathGeo.computeVertexNormals();
  const path = new THREE.Mesh(pathGeo, mats.path); path.receiveShadow = true; group.add(path);

  // streets: a ring of 18 m roads around the park, then a grid
  const roads = new THREE.Group();
  const road = (x0, z0, x1, z1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) / 25), Math.ceil((z1 - z0) / 25)).rotateX(-Math.PI / 2), mats.asphalt); m.position.set((x0 + x1) / 2, 0.005, (z0 + z1) / 2); m.receiveShadow = true; roads.add(m); };
  const walk = (x0, z0, x1, z1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.15, z1 - z0, Math.ceil((x1 - x0) / 25), 1, Math.ceil((z1 - z0) / 25)), mats.walk); m.position.set((x0 + x1) / 2, 0.075, (z0 + z1) / 2); m.receiveShadow = true; roads.add(m); };
  road(-3000, PARK.z0 - 20, 3000, PARK.z0 - 2); walk(-3000, PARK.z0 - 2, 3000, PARK.z0); walk(-3000, PARK.z0 - 24, 3000, PARK.z0 - 20);
  road(PARK.x1 + 2, -3000, PARK.x1 + 20, 3000); walk(PARK.x1, PARK.z0, PARK.x1 + 2, 3000);
  road(PARK.x0 - 20, PARK.z0, PARK.x0 - 2, 3000); walk(PARK.x0 - 2, PARK.z0, PARK.x0, 3000);
  // lane lines
  const lineM = new THREE.MeshStandardMaterial({ color: '#e9e4d6', roughness: 0.8 });
  for (let x = -600; x < 600; x += 12) { const l = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.25).rotateX(-Math.PI / 2), lineM); l.position.set(x, 0.012, PARK.z0 - 11); roads.add(l); }
  group.add(roads);

  // ---- the 4-storey building beside the picnic (a park café with flats above)
  const B4 = TOWN.BUILDING4;
  const b4 = building({ x: B4.x, z: B4.z, w: B4.w, d: B4.d, h: B4.h, style: 1, floorH: 3.3, bay: 3.0, box: false }, mats);
  group.add(b4);
  // awning on the café floor
  const awn = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 10), new THREE.MeshStandardMaterial({ color: '#2f6b4a', roughness: 0.8 }));
  awn.position.set(B4.x - B4.w / 2 - 1.0, 3.1, B4.z); awn.rotation.z = 0.35; awn.scale.set(12, 1, 1); awn.castShadow = true; group.add(awn);

  // ---- city blocks: north of the street (behind the blanket), east and west of the park
  const blocks = [];
  const T30 = TOWN.TOWER30;
  blocks.push({ x: T30.x, z: T30.z, w: T30.w, d: T30.d, h: T30.h, style: 2, floorH: 3.3, bay: 3.2, box: true });
  const segDist = (x, z, [a, b]) => {
    const abx = b.x - a.x, abz = b.z - a.z, L2 = abx * abx + abz * abz;
    const k = clamp(((x - a.x) * abx + (z - a.z) * abz) / L2);
    return Math.hypot(x - (a.x + abx * k), z - (a.z + abz * k));
  };
  const clearLines = o.clear || [];
  const occupied = (x, z, w, d) => {
    if (x + w / 2 > PARK.x0 - 22 && x - w / 2 < PARK.x1 + 22 && z + d / 2 > PARK.z0 - 26 && z - d / 2 < PARK.z1 + 30) return true;   // park + streets
    if (Math.abs(x - T30.x) < (w + T30.w) / 2 + 8 && Math.abs(z - T30.z) < (d + T30.d) / 2 + 8) return true;
    if (Math.hypot(x - TOWN.SUPERTALL.x, z - TOWN.SUPERTALL.z) < 140 + Math.max(w, d)) return true;
    return blocks.some((b) => Math.abs(x - b.x) < (w + b.w) / 2 + 6 && Math.abs(z - b.z) < (d + b.d) / 2 + 6);
  };
  // a grid of city blocks (streets every 100 m), each block holding one to four buildings
  for (let bx = -32; bx <= 32; bx++) for (let bz = -32; bz <= 24; bz++) {
    const cx = bx * 100 + 50, cz = bz * 100 + 50 - 300, dist = Math.hypot(cx, cz + 300);
    if (dist > 3200 || r.chance(dist / 5200)) continue;
    const nb = r.int(1, 4);
    for (let q = 0; q < nb; q++) {
      const w = r.float(22, 40), d = r.float(22, 40);
      const x = cx + (nb > 1 ? (q % 2 ? 22 : -22) : 0) + r.float(-4, 4), z = cz + (nb > 2 ? (q < 2 ? -22 : 22) : 0) + r.float(-4, 4);
      if (occupied(x, z, w, d)) continue;
      const near = Math.hypot(x, z) < 400, mid = dist < 1600;
      let h = near ? r.float(14, 50) : mid ? (r.chance(0.22) ? r.float(90, 230) : r.float(24, 80)) : r.float(15, 60);
      // under a camera's line of sight only low-rise buildings, so nothing blocks the view
      if (clearLines.some((ln) => segDist(x, z, ln) < 30 + Math.max(w, d) * 0.6)) h = Math.min(h, r.float(10, 18));
      blocks.push({ x, z, w, d, h, style: h > 110 ? r.pick([3, 5, 2]) : r.pick([0, 1, 2, 4]), floorH: 3.3, bay: r.float(3, 3.8), box: r.chance(0.5) });
    }
  }
  // a row of 4-storey town houses along the street behind the blanket
  for (let x = -200; x < 220; x += 16) {
    if (Math.abs(x - T30.x) < 30) continue;
    blocks.push({ x, z: PARK.z0 - 34, w: 15, d: 18, h: r.pick([13.2, 16.5, 13.2, 19.8]), style: r.pick([0, 1, 4]), floorH: 3.3, bay: 3.0 });
  }
  // merge per material within 300 m tiles: few draw calls, and tiles off-screen (or outside the
  // sun's shadow box) are culled; only the buildings near the park cast shadows
  const TILE = 300, tiles = new Map();
  for (const b of blocks) {
    const key = Math.floor(b.x / TILE) + ',' + Math.floor(b.z / TILE);
    const g = building(b, mats); g.updateMatrixWorld(true);
    if (!tiles.has(key)) tiles.set(key, new Map());
    const byMat = tiles.get(key);
    g.traverse((m) => {
      if (!m.isMesh) return;
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      if (!byMat.has(m.material)) byMat.set(m.material, []);
      byMat.get(m.material).push(geo.index ? geo.toNonIndexed() : geo);
    });
  }
  for (const [key, byMat] of tiles) {
    const [tx, tz] = key.split(',').map(Number);
    const near = Math.hypot((tx + 0.5) * TILE, (tz + 0.5) * TILE) < 900;
    for (const [mat, geos] of byMat) {
      const merged = new THREE.Mesh(mergeGeometries(geos), mat);
      merged.geometry.computeBoundingSphere();
      merged.castShadow = near; merged.receiveShadow = true;
      group.add(merged);
    }
  }

  // ---- the supertall
  const st = supertall(mats);
  st.position.set(TOWN.SUPERTALL.x, 0, TOWN.SUPERTALL.z);
  group.add(st);

  // ---- trees in the park and along the streets (kept clear of the blanket and the camera paths)
  const trees = [];
  for (let i = 0; i < 160; i++) {
    const x = r.float(PARK.x0 + 4, PARK.x1 - 4), z = r.float(PARK.z0 + 6, PARK.z1 - 4);
    if (Math.hypot(x, z) < 16 || Math.hypot(x - 18 - 14 * Math.sin(z * 0.03), 0) < 4) continue;
    if (x > -26 && x < 30 && z > -4 && z < 60) continue;   // open lawn in front of the blanket
    trees.push({ x, z, s: r.float(0.9, 1.25), h: r.float(7, 10) });
  }
  for (let x = -300; x < 300; x += 14) if (!clearLines.some((ln) => segDist(x, PARK.z0 - 1.2, ln) < 12)) trees.push({ x: x + r.float(-2, 2), z: PARK.z0 - 1.2, s: 0.8, h: 8 });
  group.add(buildTrees(trees, mats));

  // ---- benches along the path
  const benchM = new THREE.MeshStandardMaterial({ color: '#7a5634', roughness: 0.8 }), legM = new THREE.MeshStandardMaterial({ color: '#2b2d30', roughness: 0.6 });
  for (let i = 0; i < 10; i++) {
    const z = 20 + i * 15, x = 18 + 14 * Math.sin(z * 0.03) + 2.6;
    const b = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.45), benchM); seat.position.y = 0.45; b.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.05), benchM); back.position.set(0, 0.75, -0.22); b.add(back);
    for (const sx of [-0.8, 0.8]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.45), legM); l.position.set(sx, 0.225, 0); b.add(l); }
    b.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    b.position.set(x, 0, z); b.rotation.y = -Math.PI / 2; group.add(b);
  }

  // ---- the picnic: blanket, mug, apple, a closed book
  const picnic = new THREE.Group();
  const bt = blanketTexture(); bt.repeat.set(2, 2);
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.004, 1.45), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.95 }));
  blanket.position.set(-0.05, 0.002, 0.1); blanket.receiveShadow = true; picnic.add(blanket);
  const mug = buildMug(); mug.position.set(-0.19, 0.004, -0.235); mug.rotation.y = 2.4; picnic.add(mug);
  const apple = new THREE.Mesh(new THREE.IcosahedronGeometry(0.038, 2), new THREE.MeshStandardMaterial({ color: '#b5282a', roughness: 0.45 }));
  apple.scale.set(1, 0.9, 1); apple.position.set(0.3, 0.038, -0.28); apple.castShadow = true; picnic.add(apple);
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.24), new THREE.MeshStandardMaterial({ color: '#23395d', roughness: 0.7 }));
  book.position.set(-0.5, 0.019, 0.3); book.rotation.y = 0.3; book.castShadow = true; book.receiveShadow = true; picnic.add(book);
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, 0.232), new THREE.MeshStandardMaterial({ color: '#efe9da', roughness: 0.9 }));
  pages.position.set(0.005, 0, 0); book.add(pages); pages.scale.set(1.0, 1, 1); pages.position.x = 0.006;
  group.add(picnic);

  return { group, mats, picnic, mug, blocks, PARK };
}

// ---------------------------------------------------------------- the view from cruising altitude
export function regionTexture(seed) {
  const r = new Rng(seed), S = 2048, cv = canvas(S, S), c = cv.getContext('2d');
  c.fillStyle = '#7e8c62'; c.fillRect(0, 0, S, S);
  // fields
  for (let i = 0; i < 2600; i++) {
    const x = r.float(0, S), y = r.float(0, S), w = r.float(10, 50), h = r.float(10, 50);
    c.fillStyle = r.pick(['#8a9a63', '#a3a56c', '#6f8550', '#b3ab78', '#93a06a', '#7c8f58', '#c2b98a']);
    c.save(); c.translate(x, y); c.rotate(r.float(-0.3, 0.3)); c.fillRect(-w / 2, -h / 2, w, h); c.restore();
  }
  // forests
  for (let i = 0; i < 160; i++) { const x = r.float(0, S), y = r.float(0, S), rad = r.float(10, 60); c.fillStyle = 'rgba(52,78,44,0.55)'; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill(); }
  // the city: grey sprawl around the centre
  for (let i = 0; i < 9000; i++) {
    const a = r.float(0, 6.283), d = Math.pow(r.next(), 0.7) * S * 0.12;
    const x = S / 2 + Math.cos(a) * d * 1.3, y = S / 2 + Math.sin(a) * d, s = r.float(2, 6);
    c.fillStyle = r.pick(['#9c9c98', '#8d8e8c', '#b1aea6', '#7f8285', '#a8a59c']); c.fillRect(x, y, s, s);
  }
  // river
  c.strokeStyle = '#4f6f86'; c.lineWidth = 9; c.beginPath();
  for (let i = 0; i <= 60; i++) { const y = i / 60 * S, x = S * 0.43 + Math.sin(i * 0.37) * 90 + Math.sin(i * 0.11) * 160; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke();
  // highways
  c.strokeStyle = 'rgba(96,98,100,0.32)'; c.lineWidth = 1.6;
  for (let k = 0; k < 5; k++) {
    const a = r.float(0, 6.28), x0 = S / 2 + Math.cos(a) * S * 0.1, y0 = S / 2 + Math.sin(a) * S * 0.1;
    c.beginPath(); c.moveTo(x0, y0);
    for (let i = 1; i <= 12; i++) { const d = S * 0.1 + i * S * 0.04; c.lineTo(S / 2 + Math.cos(a + Math.sin(i * 0.7 + k) * 0.08) * d, S / 2 + Math.sin(a + Math.sin(i * 0.7 + k) * 0.08) * d); }
    c.stroke();
  }
  const t = tex(cv); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// low-poly airliner, nose along +x, ~38 m long
export function buildPlane() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f3f4f6', roughness: 0.45, metalness: 0.1 });
  const blue = new THREE.MeshStandardMaterial({ color: '#1f4f8f', roughness: 0.5 });
  const grey = new THREE.MeshStandardMaterial({ color: '#9aa2aa', roughness: 0.5, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1d2733', roughness: 0.2 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 30, 16).rotateZ(Math.PI / 2), white); g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.95, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2).scale(2.0, 1, 1), white); nose.position.x = 15; g.add(nose);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.95, 7, 16).rotateZ(Math.PI / 2), white); tail.position.x = -18.5; tail.scale.set(1, 1, 1); g.add(tail);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.4), glass); cockpit.position.set(17.2, 0.9, 0); g.add(cockpit);
  const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0); wingShape.lineTo(-6, 17); wingShape.lineTo(-9, 17); wingShape.lineTo(-7, 0); wingShape.closePath();
  const wingG = new THREE.ExtrudeGeometry(wingShape, { depth: 0.35, bevelEnabled: false }).rotateX(Math.PI / 2);
  const wR = new THREE.Mesh(wingG, white); wR.position.set(3, -0.6, 0.5); g.add(wR);
  const wL = new THREE.Mesh(wingG.clone().scale(1, 1, -1), white); wL.position.set(3, -0.6, -0.5); g.add(wL);
  for (const z of [-6.5, 6.5]) { const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.0, 4.2, 14).rotateZ(Math.PI / 2), grey); eng.position.set(1.5, -1.9, z); g.add(eng); }
  const finShape = new THREE.Shape(); finShape.moveTo(0, 0); finShape.lineTo(-4.5, 7.5); finShape.lineTo(-7, 7.5); finShape.lineTo(-6, 0); finShape.closePath();
  const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.3, bevelEnabled: false }), blue); fin.position.set(-14, 1.2, -0.15); g.add(fin);
  const hsShape = new THREE.Shape(); hsShape.moveTo(0, 0); hsShape.lineTo(-2.5, 6); hsShape.lineTo(-4.2, 6); hsShape.lineTo(-3.8, 0); hsShape.closePath();
  const hsG = new THREE.ExtrudeGeometry(hsShape, { depth: 0.25, bevelEnabled: false }).rotateX(Math.PI / 2);
  const hR = new THREE.Mesh(hsG, white); hR.position.set(-15, 0.6, 0.2); g.add(hR);
  const hL = new THREE.Mesh(hsG.clone().scale(1, 1, -1), white); hL.position.set(-15, 0.6, -0.2); g.add(hL);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.97, 1.97, 26, 16, 1, true, -0.25, 0.5).rotateZ(Math.PI / 2), blue); stripe.position.x = -1; stripe.rotation.x = Math.PI / 2; g.add(stripe);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// the town's buildings and trees for other sets: kit.building({ x, z, w, d, h, style, rot, box }), kit.trees([...])
export function townKit() {
  const mats = {
    facade: FACADES.map((f) => new THREE.MeshStandardMaterial({ map: facadeTexture(f), roughness: 0.62, metalness: 0.0 })),
    base: [new THREE.MeshStandardMaterial({ color: '#8d877d', roughness: 0.85 }), new THREE.MeshStandardMaterial({ color: '#5d5a55', roughness: 0.8 })],
    roof: new THREE.MeshStandardMaterial({ color: '#9a958c', roughness: 0.9 }),
    roofTop: new THREE.MeshStandardMaterial({ color: '#77736c', roughness: 0.95 }),
    trunk: new THREE.MeshStandardMaterial({ color: '#6b4f36', roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }),
  };
  return { mats, building: (o) => building(o, mats), trees: (list) => buildTrees(list, mats) };
}
