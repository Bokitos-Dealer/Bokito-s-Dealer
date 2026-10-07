// Street furniture and life: trees, palms, cars, pedestrians, street lights, balcony.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from './rng.js';

const v3 = new THREE.Vector3(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), M = new THREE.Matrix4(), E = new THREE.Euler();

function colorGeo(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// ---------- trees
export function buildTrees(city, opts = {}) {
  const o = Object.assign({ seed: 11, street: 0.85, spacing: 11, parkDensity: 1, palms: 0, extra: [] }, opts);
  const r = new Rng(o.seed);
  const spots = []; // {x,z,s,palm}
  const sw = city.opts.sidewalk;
  for (const b of city.blocks) {
    if (b.kind !== 'city' && b.kind !== 'park') continue;
    if (b.kind === 'park') {
      const n = Math.floor((b.bx1 - b.bx0) * (b.bz1 - b.bz0) / 160 * o.parkDensity);
      for (let i = 0; i < n; i++) {
        const x = r.float(b.bx0 + 7, b.bx1 - 7), z = r.float(b.bz0 + 7, b.bz1 - 7);
        if (Math.hypot(x - b.cx, z - b.cz) < 16) continue;
        spots.push({ x, z, s: r.float(0.8, 1.35), palm: r.chance(o.palms) });
      }
      // ring of trees around the edge
      for (let x = b.bx0 + 4; x < b.bx1 - 2; x += 9) { spots.push({ x, z: b.bz0 + 3, s: r.float(0.8, 1.1), palm: r.chance(o.palms) }); spots.push({ x, z: b.bz1 - 3, s: r.float(0.8, 1.1), palm: r.chance(o.palms) }); }
      continue;
    }
    if (!r.chance(o.street)) continue;
    // street trees along the sidewalk, 1.4 m in from the curb
    for (let x = b.bx0 + 5; x < b.bx1 - 4; x += o.spacing + r.float(-1, 1)) {
      spots.push({ x, z: b.bz0 + 1.4, s: r.float(0.65, 0.95), palm: r.chance(o.palms) });
      spots.push({ x, z: b.bz1 - 1.4, s: r.float(0.65, 0.95), palm: r.chance(o.palms) });
    }
    for (let z = b.bz0 + 5; z < b.bz1 - 4; z += o.spacing + r.float(-1, 1)) {
      spots.push({ x: b.bx0 + 1.4, z, s: r.float(0.65, 0.95), palm: r.chance(o.palms) });
      spots.push({ x: b.bx1 - 1.4, z, s: r.float(0.65, 0.95), palm: r.chance(o.palms) });
    }
  }
  for (const e of o.extra) spots.push(e);
  for (const p of spots) if (p.y === undefined) p.y = city.elevAt ? city.elevAt(p.x, p.z) : 0;

  const group = new THREE.Group();
  const round = spots.filter((p) => !p.palm), palm = spots.filter((p) => p.palm);

  const canopyG = mergeGeometries([
    colorGeo(new THREE.IcosahedronGeometry(2.7, 0).translate(0, 5.6, 0), '#ffffff'),
    colorGeo(new THREE.IcosahedronGeometry(2.0, 0).translate(1.1, 6.9, 0.5), '#f2f2f2'),
    colorGeo(new THREE.IcosahedronGeometry(1.9, 0).translate(-1.0, 6.6, -0.6), '#e6e6e6'),
  ]);
  const trunkG = colorGeo(new THREE.CylinderGeometry(0.22, 0.32, 4.2, 5).translate(0, 2.1, 0), '#6b4c35');
  const roundMesh = instanced(mergeGeometries([trunkG.toNonIndexed(), canopyG.toNonIndexed()]), round, r, ['#4f7a3a', '#5d8a3f', '#3f6b33', '#6b9447', '#557f3c']);
  if (roundMesh) group.add(roundMesh);

  if (palm.length) {
    const parts = [colorGeo(new THREE.CylinderGeometry(0.16, 0.28, 9, 6).translate(0, 4.5, 0), '#7a6248').toNonIndexed()];
    for (let k = 0; k < 7; k++) {
      const f = new THREE.BoxGeometry(4.2, 0.08, 0.9).translate(2.1, 0, 0);
      f.rotateZ(-0.38); f.rotateY(k * Math.PI * 2 / 7);
      f.translate(0, 9, 0);
      parts.push(colorGeo(f, '#ffffff').toNonIndexed());
    }
    const pm = instanced(mergeGeometries(parts), palm, r, ['#4e7d3a', '#5b8a3c', '#3f6e30']);
    group.add(pm);
  }
  return { group, spots };
}

export const WIND = { uWind: { value: 0 }, uWindDir: { value: new THREE.Vector2(1, 0) }, uTime: { value: 0 }, uGust: { value: 0.3 } };

function instanced(geo, spots, r, palette) {
  if (!spots.length) return null;
  // trunk vertices carry a brown vertex colour; instance colour tints canopy only via vertex colour = white
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const im = new THREE.InstancedMesh(geo, mat, spots.length);
  const col = new THREE.Color();
  spots.forEach((p, i) => {
    q.setFromAxisAngle(v3.set(0, 1, 0), r.float(0, 6.28));
    M.compose(v3.set(p.x, p.y ?? 0, p.z), q, s3.setScalar(p.s));
    im.setMatrixAt(i, M);
    col.set(r.pick(palette)).multiplyScalar(r.float(0.85, 1.15));
    im.setColorAt(i, col);
  });
  // vertex colour * instance colour would tint trunks green; keep trunks brown by
  // using instance colour only where vertex colour is near white.
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WIND);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uWind, uTime, uGust; uniform vec2 uWindDir;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // bend with the wind: more at the top, gusting per tree
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float ph = dot(ip.xz, vec2(0.13, 0.071));
          float hgt = max(position.y, 0.0) / 8.0;
          float bend = uWind * hgt * hgt * (1.0 + uGust * sin(uTime * 2.3 + ph) + 0.15 * sin(uTime * 7.1 + ph * 3.0));
          vec3 wd = vec3(uWindDir.x, 0.0, uWindDir.y);
          // instance rotation is random: move the wind into the instance's local frame
          mat3 im3 = mat3(instanceMatrix);
          vec3 local = transpose(im3) * wd;
          transformed += local * bend * 3.0;
          transformed.y -= bend * bend * hgt * 1.2;
        }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `
      #if defined( USE_COLOR_ALPHA )
        diffuseColor *= vColor;
      #elif defined( USE_COLOR )
        diffuseColor.rgb *= vColor;
      #endif`);
    sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `
      vColor = vec3(1.0);
      #ifdef USE_COLOR
        vColor *= color;
      #endif
      #ifdef USE_INSTANCING_COLOR
        float isLeaf = step(0.5, min(color.r, min(color.g, color.b)));
        vColor = mix(color, color * instanceColor, isLeaf);
      #endif`);
  };
  mat.customProgramCacheKey = () => 'tree-v2';
  im.castShadow = true; im.receiveShadow = true;
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false; // instances move: bounds computed at start would be wrong
  im.userData.spots = spots;
  return im;
}

// ---------- roads → lanes
export function laneList(city, opts = {}) {
  const o = city.opts, lanes = [];
  const onLand = (x, z) => o.land(x, z) !== 'water';
  const span = (fixed, axis, lo, hi) => {
    // longest run of land along the road
    let best = null, cur = null;
    for (let s = lo; s <= hi; s += 4) {
      const ok = axis === 'z' ? onLand(fixed, s) : onLand(s, fixed);
      if (ok) { if (!cur) cur = [s, s]; else cur[1] = s; } else if (cur) { if (!best || cur[1] - cur[0] > best[1] - best[0]) best = cur; cur = null; }
    }
    if (cur && (!best || cur[1] - cur[0] > best[1] - best[0])) best = cur;
    return best;
  };
  for (const x of city.roadsX) {
    const sp = span(x, 'z', o.z0, o.z1); if (!sp || sp[1] - sp[0] < 60) continue;
    lanes.push({ axis: 'z', fixed: x + 3.2, a: sp[0], b: sp[1], dir: 1 });
    lanes.push({ axis: 'z', fixed: x - 3.2, a: sp[0], b: sp[1], dir: -1 });
  }
  for (const z of city.roadsZ) {
    const sp = span(z, 'x', o.x0, o.x1); if (!sp || sp[1] - sp[0] < 60) continue;
    lanes.push({ axis: 'x', fixed: z - 3.2, a: sp[0], b: sp[1], dir: 1 });
    lanes.push({ axis: 'x', fixed: z + 3.2, a: sp[0], b: sp[1], dir: -1 });
  }
  return lanes;
}

// ---------- cars
export function buildCars(city, opts = {}) {
  const o = Object.assign({ seed: 21, count: 420, lanes: null, speed: [7, 14], filter: null }, opts);
  const r = new Rng(o.seed);
  const lanes = o.lanes || laneList(city);
  const body = new THREE.BoxGeometry(4.4, 1.0, 1.9).translate(0, 0.75, 0);
  const cabin = new THREE.BoxGeometry(2.3, 0.75, 1.7).translate(-0.2, 1.6, 0);
  const geo = mergeGeometries([colorGeo(body, '#ffffff'), colorGeo(cabin, '#2a3138')]);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.2 });
  const im = new THREE.InstancedMesh(geo, mat, o.count);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false; // instances move: bounds computed at start would be wrong
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `
      vColor = vec3(1.0);
      #ifdef USE_COLOR
        vColor *= color;
      #endif
      #ifdef USE_INSTANCING_COLOR
        float isBody = step(0.8, color.r);
        vColor = mix(color, color * instanceColor, isBody);
      #endif`);
  };
  mat.customProgramCacheKey = () => 'car-v1';
  const palette = ['#d8d8d8', '#1d1f22', '#8a1c1c', '#f2c230', '#2b4f8a', '#e8e8e4', '#5b6168', '#2f6b4a', '#b8b8b8', '#f2c230', '#c75b1f'];
  const cars = [];
  for (let i = 0; i < o.count; i++) {
    const lane = r.pick(lanes);
    const L = lane.b - lane.a;
    const car = { lane, s: r.float(0, L), v: r.float(...o.speed), speedMul: 1, L, color: new THREE.Color(r.pick(palette)), pos: new THREE.Vector3(), rot: 0, free: false, vel: new THREE.Vector3(), spin: new THREE.Vector3(), euler: new THREE.Euler() };
    im.setColorAt(i, car.color);
    cars.push(car);
  }
  im.castShadow = true; im.receiveShadow = true;

  // head / tail lights for night scenes
  const lg = mergeGeometries([
    colorGeo(new THREE.PlaneGeometry(0.35, 0.22).rotateY(Math.PI / 2).translate(2.21, 0.85, 0.6), '#fff2d0'),
    colorGeo(new THREE.PlaneGeometry(0.35, 0.22).rotateY(Math.PI / 2).translate(2.21, 0.85, -0.6), '#fff2d0'),
    colorGeo(new THREE.PlaneGeometry(0.3, 0.2).rotateY(-Math.PI / 2).translate(-2.21, 0.85, 0.6), '#ff2a1a'),
    colorGeo(new THREE.PlaneGeometry(0.3, 0.2).rotateY(-Math.PI / 2).translate(-2.21, 0.85, -0.6), '#ff2a1a'),
  ]);
  const lm = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const lights = new THREE.InstancedMesh(lg, lm, o.count);
  lights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  lights.frustumCulled = false;
  lights.visible = false;

  const api = {
    mesh: im, lights, cars, lanes,
    update(t, dt) {
      cars.forEach((c, i) => {
        if (!c.free) {
          c.s += c.v * c.speedMul * dt;
          const s = ((c.s % c.L) + c.L) % c.L;
          const along = c.lane.dir > 0 ? c.lane.a + s : c.lane.b - s;
          if (c.lane.axis === 'z') { c.pos.set(c.lane.fixed, 0, along); c.rot = c.lane.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
          else { c.pos.set(along, 0, c.lane.fixed); c.rot = c.lane.dir > 0 ? 0 : Math.PI; }
          if (city.elevAt) c.pos.y = city.elevAt(c.pos.x, c.pos.z);
          c.euler.set(0, c.rot, 0);
        }
        q.setFromEuler(c.euler);
        M.compose(c.pos, q, s3.set(1, 1, 1));
        im.setMatrixAt(i, M); lights.setMatrixAt(i, M);
      });
      im.instanceMatrix.needsUpdate = true; lights.instanceMatrix.needsUpdate = true;
    },
  };
  return api;
}

// ---------- pedestrians walking loops around blocks
export function buildPeople(city, opts = {}) {
  const o = Object.assign({ seed: 31, count: 1400, extraAreas: [] }, opts);
  const r = new Rng(o.seed);
  const blocks = city.blocks.filter((b) => b.kind === 'city' || b.kind === 'park');
  const geo = mergeGeometries([
    colorGeo(new THREE.BoxGeometry(0.34, 0.85, 0.24).translate(0, 0.42, 0), '#2d3240'),
    colorGeo(new THREE.BoxGeometry(0.46, 0.7, 0.3).translate(0, 1.2, 0), '#ffffff'),
    colorGeo(new THREE.BoxGeometry(0.24, 0.26, 0.24).translate(0, 1.7, 0), '#d9a37e'),
  ]);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `
      vColor = vec3(1.0);
      #ifdef USE_COLOR
        vColor *= color;
      #endif
      #ifdef USE_INSTANCING_COLOR
        float isShirt = step(0.95, color.b);
        vColor = mix(color, instanceColor, isShirt);
      #endif`);
  };
  mat.customProgramCacheKey = () => 'ppl-v1';
  const im = new THREE.InstancedMesh(geo, mat, o.count);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false; // instances move: bounds computed at start would be wrong
  const shirts = ['#c0392b', '#2e86c1', '#f4d03f', '#ecf0f1', '#27ae60', '#8e44ad', '#e67e22', '#34495e', '#d35400', '#16a085', '#f1948a'];
  const people = [];
  for (let i = 0; i < o.count; i++) {
    let p;
    if (o.extraAreas.length && r.chance(o.extraShare ?? 0.3)) {
      const a = r.pick(o.extraAreas);
      p = { kind: 'area', x: r.float(a.x0, a.x1), z: r.float(a.z0, a.z1), ang: r.float(0, 6.28), v: r.float(0, 0.6) };
      p.y = a.y ?? (city.elevAt ? city.elevAt(p.x, p.z) : 0);
    } else {
      const b = r.pick(blocks);
      const inset = b.kind === 'park' ? r.float(6, 12) : r.float(1.2, 3.4);
      const x0 = b.bx0 + inset, x1 = b.bx1 - inset, z0 = b.bz0 + inset, z1 = b.bz1 - inset;
      const per = 2 * (x1 - x0 + z1 - z0);
      p = { kind: 'loop', x0, x1, z0, z1, per, s0: r.float(0, per), v: r.float(0.9, 1.6) * (r.chance(0.5) ? 1 : -1), y: 0 };
    }
    p.pos = new THREE.Vector3(); p.euler = new THREE.Euler(); p.free = false; p.vel = new THREE.Vector3(); p.spin = new THREE.Vector3();
    people.push(p);
    im.setColorAt(i, new THREE.Color(r.pick(shirts)));
  }
  im.castShadow = false; im.receiveShadow = true;
  const api = {
    mesh: im, people,
    update(t) {
      people.forEach((p, i) => {
        if (!p.free) {
          if (p.kind === 'loop') {
            let s = ((p.s0 + p.v * t) % p.per + p.per) % p.per;
            const w = p.x1 - p.x0, d = p.z1 - p.z0;
            let x, z, a;
            if (s < w) { x = p.x0 + s; z = p.z0; a = 0; }
            else if ((s -= w) < d) { x = p.x1; z = p.z0 + s; a = -Math.PI / 2; }
            else if ((s -= d) < w) { x = p.x1 - s; z = p.z1; a = Math.PI; }
            else { s -= w; x = p.x0; z = p.z1 - s; a = Math.PI / 2; }
            if (p.v < 0) a += Math.PI;
            p.pos.set(x, city.elevAt ? city.elevAt(x, z) : p.y, z); p.euler.set(0, a, 0);
          } else {
            p.pos.set(p.x + Math.cos(p.ang) * p.v * t, p.y, p.z + Math.sin(p.ang) * p.v * t); p.euler.set(0, -p.ang, 0);
          }
        }
        q.setFromEuler(p.euler);
        M.compose(p.pos, q, s3.set(1, 1, 1));
        im.setMatrixAt(i, M);
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
  return api;
}

// ---------- street lights: poles + glow points (glow handled by a GlowLayer)
export function streetLightSpots(city, opts = {}) {
  const o = Object.assign({ spacing: 34 }, opts);
  const spots = [];
  const land = city.opts.land, half = city.opts.road / 2 + 1.0;
  for (const x of city.roadsX) for (let z = city.opts.z0; z < city.opts.z1; z += o.spacing) {
    if (land(x, z) === 'water') continue;
    spots.push({ x: x - half, z, y: city.elevAt(x - half, z) }); spots.push({ x: x + half, z: z + o.spacing / 2, y: city.elevAt(x + half, z + o.spacing / 2) });
  }
  for (const z of city.roadsZ) for (let x = city.opts.x0; x < city.opts.x1; x += o.spacing) {
    if (land(x, z) === 'water') continue;
    spots.push({ x, z: z - half, y: city.elevAt(x, z - half) }); spots.push({ x: x + o.spacing / 2, z: z + half, y: city.elevAt(x + o.spacing / 2, z + half) });
  }
  return spots;
}

export function buildPoles(spots) {
  const g = mergeGeometries([
    new THREE.CylinderGeometry(0.09, 0.13, 7.5, 5).translate(0, 3.75, 0),
    new THREE.BoxGeometry(1.4, 0.15, 0.25).translate(0.6, 7.45, 0),
  ]);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.6, metalness: 0.4 });
  const im = new THREE.InstancedMesh(g, mat, spots.length);
  spots.forEach((p, i) => { M.compose(v3.set(p.x, p.y ?? 0, p.z), q.identity(), s3.set(1, 1, 1)); im.setMatrixAt(i, M); });
  return im;
}

// ---------- balcony in front of the camera
export function buildBalcony(opts = {}) {
  const o = Object.assign({ width: 9, depth: 2.6, railH: 1.08, slab: 0.32, floor: '#9b968c', glass: true, rail: '#2c2f33' }, opts);
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(o.width, o.slab, o.depth), new THREE.MeshStandardMaterial({ color: o.floor, roughness: 0.9 }));
  slab.position.set(0, -o.slab / 2, -o.depth / 2);
  slab.receiveShadow = true; slab.castShadow = true;
  g.add(slab);
  // floor tiles
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(o.width, o.depth, 1, 1), new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.75 }));
  tiles.rotation.x = -Math.PI / 2; tiles.position.set(0, 0.005, -o.depth / 2); tiles.receiveShadow = true;
  g.add(tiles);
  const railMat = new THREE.MeshStandardMaterial({ color: o.rail, roughness: 0.5, metalness: o.railMetal ?? 0.6 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(o.width, o.barH ?? 0.06, o.barD ?? 0.09), railMat);
  top.position.set(0, o.railH, -o.depth + 0.05); g.add(top);
  for (let x = -o.width / 2 + 0.05; x <= o.width / 2; x += 1.5) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(o.postW ?? 0.05, o.railH, o.postW ?? 0.05), railMat);
    post.position.set(x, o.railH / 2, -o.depth + 0.05); g.add(post);
  }
  if (o.glass) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(o.width, o.railH - 0.1), new THREE.MeshBasicMaterial({ color: o.glassColor ?? 0x6f8590, transparent: true, opacity: o.glassOpacity ?? 0.1, depthWrite: false }));
    gl.position.set(0, (o.railH - 0.1) / 2, -o.depth + 0.06); g.add(gl);
  } else {
    for (let x = -o.width / 2; x <= o.width / 2; x += 0.13) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, o.railH, 0.02), railMat);
      bar.position.set(x, o.railH / 2, -o.depth + 0.05); g.add(bar);
    }
  }
  // edge lip
  const lip = new THREE.Mesh(new THREE.BoxGeometry(o.width, 0.12, 0.18), new THREE.MeshStandardMaterial({ color: '#8a857c', roughness: 0.9 }));
  lip.position.set(0, 0.06, -o.depth + 0.09); g.add(lip);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}

function tileTexture() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d');
  const r = new Rng(5);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
    const v = 150 + r.float(-12, 12);
    c.fillStyle = `rgb(${v + 8},${v + 2},${v - 8})`; c.fillRect(x * 64, y * 64, 64, 64);
  }
  c.strokeStyle = 'rgba(60,55,50,0.6)'; c.lineWidth = 2;
  for (let x = 0; x <= 512; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 256); c.stroke(); }
  for (let y = 0; y <= 256; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- boats: small cabin cruisers plus an optional big ship
export function buildBoats(list) {
  const hull = new THREE.BoxGeometry(9, 1.6, 3.2);
  const hp = hull.attributes.position;
  for (let i = 0; i < hp.count; i++) { // taper the bow and the keel
    const x = hp.getX(i), y = hp.getY(i);
    if (x > 2) hp.setZ(i, hp.getZ(i) * (1 - (x - 2) / 7 * 0.85));
    if (y < 0) hp.setZ(i, hp.getZ(i) * 0.55);
  }
  hull.computeVertexNormals();
  const geo = mergeGeometries([
    colorGeo(hull.translate(0, 0.5, 0), '#f2f2ee'),
    colorGeo(new THREE.BoxGeometry(3.4, 1.5, 2.4).translate(-1.0, 2.0, 0), '#e8e8e4'),
    colorGeo(new THREE.BoxGeometry(3.45, 0.45, 2.45).translate(-1.0, 2.35, 0), '#2a3540'),
    colorGeo(new THREE.BoxGeometry(9.05, 0.25, 3.25).translate(0, -0.15, 0), '#1f4f7a'),
  ].map((g) => g.toNonIndexed()));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false; // instances move: bounds computed at start would be wrong
  im.castShadow = true;
  return {
    mesh: im, list,
    update(t, level) {
      list.forEach((b, i) => {
        const bob = Math.sin(t * 1.3 + i * 1.7) * 0.25 * (b.s ?? 1);
        const x = b.x + (b.vx ?? 0) * t, z = b.z + (b.vz ?? 0) * t;
        E.set(Math.sin(t * 0.9 + i) * 0.04, b.rot ?? 0, Math.sin(t * 1.1 + i * 2) * 0.05);
        q.setFromEuler(E);
        M.compose(v3.set(x, (b.y ?? level) + bob, z), q, s3.setScalar(b.s ?? 1));
        im.setMatrixAt(i, M);
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
}
