// Low-poly vehicles (sedan, hatchback, taxi, SUV, van, bus) that drive along
// polyline routes with spinning wheels, glass, and head/tail lights.
// Each vehicle's distance along its route is a pure function of time.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng, clamp } from './rng.js';
import { pathAt, pathLen } from './people.js';

const A = '#ffffff';   // paint slot (per vehicle colour)
function part(geo, hex) {
  const g = geo.toNonIndexed();
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const bx = (w, h, d, x, y, z, hex) => part(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
// a cabin with slanted front/back glass: trapezoid prism along x (length), y up, z width
function cabin(lenBot, lenTop, h, w, x, y, hex, front = 0) {
  const s = new THREE.Shape();
  s.moveTo(-lenBot / 2, 0); s.lineTo(lenBot / 2, 0); s.lineTo(lenTop / 2 + front, h); s.lineTo(-lenTop / 2 + front, h); s.lineTo(-lenBot / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }).translate(x, y, -w / 2);
  return part(g, hex);
}
const GLASS = '#1c2733', TRIM = '#26282c', CHROME = '#9aa0a6';

// Vehicles point along +x, wheels on the ground at y = 0.
const TYPES = {
  sedan: { len: 4.5, wheelX: 1.45, wheelR: 0.34, track: 0.82, body: () => mergeGeometries([
    bx(4.5, 0.62, 1.84, 0, 0.62, 0, A), bx(4.3, 0.12, 1.86, 0, 0.36, 0, TRIM),
    cabin(2.6, 1.5, 0.62, 1.66, -0.15, 0.93, GLASS, -0.1), bx(1.5, 0.07, 1.68, -0.25, 1.56, 0, A) ]) },
  hatch: { len: 3.9, wheelX: 1.25, wheelR: 0.32, track: 0.8, body: () => mergeGeometries([
    bx(3.9, 0.62, 1.76, 0, 0.6, 0, A), bx(3.7, 0.12, 1.78, 0, 0.34, 0, TRIM),
    cabin(2.7, 1.9, 0.62, 1.6, -0.35, 0.91, GLASS, -0.25), bx(1.9, 0.07, 1.62, -0.6, 1.54, 0, A) ]) },
  taxi: { len: 4.6, wheelX: 1.5, wheelR: 0.34, track: 0.82, body: () => mergeGeometries([
    bx(4.6, 0.62, 1.84, 0, 0.62, 0, A), bx(4.4, 0.12, 1.86, 0, 0.36, 0, TRIM),
    cabin(2.7, 1.6, 0.62, 1.66, -0.15, 0.93, GLASS, -0.1), bx(1.6, 0.07, 1.68, -0.25, 1.56, 0, A),
    bx(0.32, 0.22, 0.9, -0.25, 1.7, 0, '#f6f0d8'), bx(4.62, 0.06, 1.86, 0, 0.66, 0, '#1b1b1b') ]), paint: '#f2c230' },
  suv: { len: 4.8, wheelX: 1.55, wheelR: 0.4, track: 0.86, body: () => mergeGeometries([
    bx(4.8, 0.85, 1.94, 0, 0.82, 0, A), bx(4.6, 0.14, 1.96, 0, 0.45, 0, TRIM),
    cabin(3.5, 3.0, 0.72, 1.82, -0.25, 1.24, GLASS, -0.05), bx(2.9, 0.08, 1.7, -0.3, 1.98, 0, A) ]) },
  van: { len: 5.2, wheelX: 1.75, wheelR: 0.38, track: 0.86, body: () => mergeGeometries([
    bx(5.2, 1.85, 2.0, 0, 1.33, 0, A), bx(5.0, 0.14, 2.02, 0, 0.42, 0, TRIM),
    bx(0.05, 0.65, 1.8, 2.61, 1.75, 0, GLASS), bx(0.9, 0.55, 2.03, 1.9, 1.75, 0, GLASS) ]) },
  bus: { len: 11.5, wheelX: 3.6, wheelR: 0.5, track: 1.05, body: () => mergeGeometries([
    bx(11.5, 2.6, 2.5, 0, 1.75, 0, A), bx(11.3, 0.2, 2.52, 0, 0.52, 0, TRIM),
    bx(9.6, 0.95, 2.53, -0.5, 2.25, 0, GLASS), bx(0.05, 1.5, 2.2, 5.76, 2.0, 0, GLASS),
    bx(11.52, 0.18, 2.54, 0, 1.55, 0, '#e8e8e8'), bx(1.6, 0.25, 0.05, 5.0, 2.95, 0, '#ffb000') ]) },
};
const PAINT = ['#d8d8d8', '#1d1f22', '#8a1c1c', '#2b4f8a', '#e8e8e4', '#5b6168', '#2f6b4a', '#b8b8b8', '#c75b1f', '#3b3f46', '#7d8f9b', '#6b1f2a'];

export function buildVehicles(opts = {}) {
  const o = Object.assign({ seed: 9, max: 120, shadows: true }, opts);
  const r = new Rng(o.seed);
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.15 });
  bodyMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aPaint;')
      .replace('#include <color_vertex>', `vColor = color; vColor = mix(vColor, aPaint, step(2.9, color.r + color.g + color.b));`);
  };
  bodyMat.customProgramCacheKey = () => 'veh-v1';
  const wheelGeo = mergeGeometries([
    part(new THREE.CylinderGeometry(1, 1, 0.26, 14).rotateX(Math.PI / 2), '#1a1a1c'),
    part(new THREE.CylinderGeometry(0.55, 0.55, 0.28, 8).rotateX(Math.PI / 2), CHROME),
  ]);
  const wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  // lamps: front white, rear red; brightness driven by uniforms (off in daylight, glowing at night)
  const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const lampU = { k: 0.35 };
  const meshes = {};
  for (const [name, T] of Object.entries(TYPES)) {
    const g = T.body();
    const im = new THREE.InstancedMesh(g, bodyMat, o.max);
    im.geometry.setAttribute('aPaint', new THREE.InstancedBufferAttribute(new Float32Array(o.max * 3), 3));
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.castShadow = o.shadows; im.receiveShadow = true; im.count = 0;
    const L = T.len, hy = name === 'bus' ? 0.95 : name === 'van' ? 0.85 : name === 'suv' ? 0.85 : 0.68, hz = name === 'bus' ? 0.95 : 0.66;
    const lg = mergeGeometries([
      bx(0.06, 0.16, 0.34, L / 2 + 0.01, hy, hz, '#fff4dc'), bx(0.06, 0.16, 0.34, L / 2 + 0.01, hy, -hz, '#fff4dc'),
      bx(0.06, 0.15, 0.3, -L / 2 - 0.01, hy, hz, '#ff2a14'), bx(0.06, 0.15, 0.3, -L / 2 - 0.01, hy, -hz, '#ff2a14'),
    ]);
    const lm = new THREE.InstancedMesh(lg, lampMat, o.max);
    lm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); lm.frustumCulled = false; lm.count = 0;
    group.add(im, lm);
    meshes[name] = { im, lm, T, n: 0 };
  }
  const wheels = new THREE.InstancedMesh(wheelGeo, wheelMat, o.max * 4);
  wheels.instanceMatrix.setUsage(THREE.DynamicDrawUsage); wheels.frustumCulled = false; wheels.castShadow = false; wheels.count = 0;
  group.add(wheels);

  const list = [];
  // spec: { type, path, v, t0, loop, s0, sAt(t) -> metres along path, paint, yAt(x,z,t), at(t) -> {x,z,h} }
  function add(spec = {}) {
    const type = spec.type || r.pick(['sedan', 'sedan', 'hatch', 'suv', 'taxi', 'sedan', 'van']);
    const c = Object.assign({ v: r.float(8, 12), t0: 0, s0: 0, loop: true, paint: TYPES[type].paint || r.pick(PAINT) }, spec, { type });
    if (c.path) c.L = pathLen(c.path);
    c.i = list.length; list.push(c);
    return c;
  }
  function placeOf(c, t) {
    if (c.at) return c.at(t, c);
    let s = c.sAt ? c.sAt(t) : c.s0 + Math.max(0, t - c.t0) * c.v;
    const travelled = s;
    if (c.loop) s = ((s % c.L) + c.L) % c.L; else s = clamp(s, 0, c.L);
    const p = pathAt(c.path, s);
    return { x: p.x, z: p.z, h: p.h, dist: travelled };
  }
  const M = new THREE.Matrix4(), W = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  function update(t) {
    for (const k in meshes) meshes[k].n = 0;
    let nw = 0;
    for (const c of list) {
      if (c.visible && !c.visible(t)) continue;
      const p = placeOf(c, t);
      const m = meshes[c.type], T = m.T;
      const y = c.yAt ? c.yAt(p.x, p.z, t) : (c.y ?? 0);
      // heading h is the travel direction (atan2(dx,dz)); vehicles are modelled along +x
      q.setFromEuler(e.set(c.tilt ? c.tilt(t) : 0, p.h - Math.PI / 2, c.roll ? c.roll(t) : 0, 'YXZ'));
      M.compose(v.set(p.x, y, p.z), q, one);
      m.im.setMatrixAt(m.n, M); m.lm.setMatrixAt(m.n, M);
      col.set(c.paint); m.im.geometry.attributes.aPaint.setXYZ(m.n, col.r, col.g, col.b);
      m.n++;
      const spin = -p.dist / T.wheelR;
      for (const sx of [T.wheelX, -T.wheelX]) for (const sz of [T.track, -T.track]) {
        W.makeTranslation(sx, T.wheelR, sz * (T.len > 6 ? 1.15 : 1.08)).multiply(new THREE.Matrix4().makeRotationZ(spin)).multiply(new THREE.Matrix4().makeScale(T.wheelR, T.wheelR, 1));
        wheels.setMatrixAt(nw++, M.clone().multiply(W));
      }
    }
    for (const k in meshes) {
      const m = meshes[k]; m.im.count = m.lm.count = m.n;
      m.im.instanceMatrix.needsUpdate = m.lm.instanceMatrix.needsUpdate = true; m.im.geometry.attributes.aPaint.needsUpdate = true;
    }
    wheels.count = nw; wheels.instanceMatrix.needsUpdate = true;
    lampMat.color.setScalar(lampU.k);
  }
  // world positions of head/tail lamps, for glow sprites at night
  function lamps(t, fn) {
    for (const c of list) {
      if (c.visible && !c.visible(t)) continue;
      const p = placeOf(c, t), T = TYPES[c.type];
      const fx = Math.sin(p.h), fz = Math.cos(p.h), sx = Math.cos(p.h), sz = -Math.sin(p.h);
      const y = (c.yAt ? c.yAt(p.x, p.z, t) : (c.y ?? 0)) + 0.7;
      for (const side of [0.66, -0.66]) {
        fn(p.x + fx * T.len / 2 + sx * side, y, p.z + fz * T.len / 2 + sz * side, 'head', c);
        fn(p.x - fx * T.len / 2 + sx * side, y, p.z - fz * T.len / 2 + sz * side, 'tail', c);
      }
    }
  }
  return { group, list, add, update, lamps, lampU, placeOf };
}
