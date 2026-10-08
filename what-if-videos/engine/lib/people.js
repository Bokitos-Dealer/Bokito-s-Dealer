// Blocky low-poly people with animated limbs. Every person is a pure function
// of time: a script gives position/heading along paths plus a pose timeline,
// and the limbs are posed from that each frame (instanced, one mesh per part).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng, clamp, smooth } from './rng.js';

// Vertex colour codes: white = colour slot A (per person), magenta = slot B, anything else = fixed.
const A = '#ffffff', B = '#ff00ff';
function box(w, h, d, x, y, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed();
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// Body measurements (metres). Joints are the pivots the parts rotate about.
const HIP_Y = 0.84, SH_Y = 1.40, NECK_Y = 1.45;
const PARTS = {
  // legs hang from the hip: pants (A) with dark shoes
  legL: { pivot: [-0.105, HIP_Y, 0], geo: () => mergeGeometries([box(0.19, 0.74, 0.21, 0, -0.37, 0, A), box(0.2, 0.1, 0.29, 0, -0.79, 0.04, '#2a2a2e')]) },
  legR: { pivot: [0.105, HIP_Y, 0], geo: () => mergeGeometries([box(0.19, 0.74, 0.21, 0, -0.37, 0, A), box(0.2, 0.1, 0.29, 0, -0.79, 0.04, '#2a2a2e')]) },
  torso: { pivot: [0, HIP_Y, 0], geo: () => mergeGeometries([box(0.44, 0.08, 0.25, 0, 0.02, 0, '#38363a'), box(0.46, 0.56, 0.27, 0, 0.33, 0, A), box(0.18, 0.05, 0.05, 0, 0.6, 0.12, B)]) },
  // arms hang from the shoulder: sleeve (A) then forearm (B = skin or sleeve)
  armL: { pivot: [-0.315, SH_Y, 0], geo: () => mergeGeometries([box(0.15, 0.3, 0.17, 0, -0.13, 0, A), box(0.14, 0.3, 0.16, 0, -0.43, 0, B), box(0.13, 0.08, 0.14, 0, -0.61, 0, '#c99a78')]) },
  armR: { pivot: [0.315, SH_Y, 0], geo: () => mergeGeometries([box(0.15, 0.3, 0.17, 0, -0.13, 0, A), box(0.14, 0.3, 0.16, 0, -0.43, 0, B), box(0.13, 0.08, 0.14, 0, -0.61, 0, '#c99a78')]) },
  head: { pivot: [0, NECK_Y, 0], geo: () => mergeGeometries([box(0.12, 0.06, 0.12, 0, 0.03, 0, B), box(0.3, 0.3, 0.29, 0, 0.2, 0, B), box(0.045, 0.055, 0.02, -0.065, 0.235, 0.146, '#1a1412'), box(0.045, 0.055, 0.02, 0.065, 0.235, 0.146, '#1a1412')]) },
};
const HAIR = {
  short: () => mergeGeometries([box(0.32, 0.09, 0.31, 0, 0.375, -0.005, A), box(0.32, 0.14, 0.06, 0, 0.29, -0.13, A)]),
  long: () => mergeGeometries([box(0.32, 0.09, 0.31, 0, 0.375, -0.005, A), box(0.33, 0.42, 0.08, 0, 0.17, -0.135, A), box(0.05, 0.22, 0.26, -0.155, 0.26, -0.02, A), box(0.05, 0.22, 0.26, 0.155, 0.26, -0.02, A)]),
  cap: () => mergeGeometries([box(0.33, 0.1, 0.32, 0, 0.38, 0, A), box(0.28, 0.03, 0.14, 0, 0.34, 0.2, A)]),
  bun: () => mergeGeometries([box(0.32, 0.09, 0.31, 0, 0.375, -0.005, A), box(0.14, 0.12, 0.12, 0, 0.42, -0.12, A), box(0.32, 0.12, 0.06, 0, 0.3, -0.13, A)]),
};

const SKIN = ['#f1c9a5', '#e0ac85', '#c68a62', '#a8714f', '#8a5a3c', '#6b4430', '#f5d5b8', '#d79c76'];
const HAIRC = ['#1d1612', '#2e2018', '#4a3020', '#6b4a2b', '#a77a45', '#d9b071', '#3a3a3a', '#888078', '#7a2e1a'];
const SHIRT = ['#c0392b', '#2e86c1', '#f4d03f', '#ecf0f1', '#27ae60', '#8e44ad', '#e67e22', '#34495e', '#d35400', '#16a085', '#f1948a', '#5d6d7e', '#ffffff', '#1f3a5f', '#b03a5b', '#7fb3d5'];
const PANTS = ['#2c3e50', '#1b2631', '#5d4037', '#34495e', '#212121', '#4e5d6c', '#7b6d5a', '#3b4a6b', '#c2b280'];

// ---------- poses: joint angles in radians (positive pitch swings the limb forward)
function zeroPose() { return { legL: 0, legR: 0, armL: 0, armR: 0, armLr: 0.06, armRr: -0.06, armLy: 0, armRy: 0, torso: 0, torsoYaw: 0, head: 0, headYaw: 0, bob: 0, drop: 0, legLr: 0, legRr: 0 }; }
function addPose(out, p, w) { for (const k in p) out[k] += p[k] * w; }

const POSES = {
  idle: (ph, t, s) => ({ armL: 0.04 * Math.sin(t * 1.1 + s), armR: -0.04 * Math.sin(t * 1.1 + s), torso: 0.01 * Math.sin(t * 1.3 + s), head: 0.03 * Math.sin(t * 0.7 + s) }),
  walk: (ph) => { const sn = Math.sin(ph); return { legL: 0.48 * sn, legR: -0.48 * sn, armL: -0.42 * sn, armR: 0.42 * sn, bob: 0.035 * Math.abs(Math.cos(ph)), torso: 0.04 }; },
  run: (ph) => { const sn = Math.sin(ph); return { legL: 0.95 * sn, legR: -0.95 * sn, armL: -0.95 * sn + 0.25, armR: 0.95 * sn + 0.25, bob: 0.09 * Math.abs(Math.cos(ph)), torso: 0.22, head: -0.12 }; },
  lookUp: (ph, t, s) => ({ head: -0.55 + 0.04 * Math.sin(t * 0.8 + s), torso: -0.08 }),
  phone: (ph, t, s) => ({ armR: 2.15 + 0.03 * Math.sin(t * 2 + s), armRr: 0.28, head: -0.42, torso: -0.05 }),            // filming the sky
  phoneLow: (ph, t, s) => ({ armR: 1.15, armRr: 0.3, armL: 0.6, armLr: -0.2, head: 0.45 }),                                // looking at the screen
  point: (ph, t, s) => ({ armR: 2.5, armRr: 0.05, head: -0.5, torso: -0.06 }),
  pointFwd: (ph, t, s) => ({ armR: 1.45 + 0.04 * Math.sin(t * 2 + s), armRr: -0.55, head: 0.05, torsoYaw: -0.15 }),          // pointing at something far ahead
  armsUp: (ph, t, s) => ({ armL: 2.8 + 0.25 * Math.sin(t * 7 + s), armR: 2.8 + 0.25 * Math.sin(t * 7 + s + 2), armLr: 0.25, armRr: -0.25, head: -0.3 }),
  handsHead: (ph, t, s) => ({ armL: 2.3, armR: 2.3, armLr: -0.75, armRr: 0.75, head: -0.2 }),                              // shock
  shrug: (ph, t, s) => ({ armL: 0.55, armR: 0.55, armLr: 0.5, armRr: -0.5, head: 0.08 }),
  sit: () => ({ legL: 1.5, legR: 1.5, drop: 0.38, torso: -0.04 }),
  wave: (ph, t, s) => ({ armR: 2.75, armRr: -0.3 + 0.35 * Math.sin(t * 9 + s), head: -0.1 }),
  crouch: () => ({ legL: 1.2, legR: 1.2, drop: 0.45, torso: 0.6, armL: 0.9, armR: 0.9, head: 0.3 }),
  torch: (ph, t, s) => ({ armR: 0.85, armRr: 0.1, head: 0.35, torso: 0.15 }),                                              // flashlight pointed at the ground
  skate: (ph) => { const sn = Math.sin(ph * 0.5); return { legL: 0.3 * sn, legR: -0.3 * sn, legLr: 0.25 * Math.max(0, sn), legRr: -0.25 * Math.max(0, -sn), armL: -0.5 * sn, armR: 0.5 * sn, armLr: 0.5, armRr: -0.5, torso: 0.3 }; },
};

// ---------- a path walker: polyline [[x,z],...] at speed v starting at t0
export function pathAt(pts, s) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const L = Math.hypot(x1 - x0, z1 - z0);
    if (s <= L || i === pts.length - 2) {
      const k = clamp(s / L);
      return { x: x0 + (x1 - x0) * k, z: z0 + (z1 - z0) * k, h: Math.atan2(x1 - x0, z1 - z0) };
    }
    s -= L;
  }
}
export function pathLen(pts) { let L = 0; for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); return L; }

export function buildPeople(opts = {}) {
  const o = Object.assign({ max: 600, seed: 7, castShadow: true }, opts);
  const r = new Rng(o.seed);
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aColA; attribute vec3 aColB;')
      .replace('#include <color_vertex>', `
        vColor = color;
        float isA = step(2.9, color.r + color.g + color.b);
        float isB = step(1.9, color.r + color.b) * step(color.g, 0.1);
        vColor = mix(vColor, aColA, isA);
        vColor = mix(vColor, aColB, isB);`);
  };
  mat.customProgramCacheKey = () => 'people-v1';

  const meshes = {};
  const mk = (name, geo) => {
    const im = new THREE.InstancedMesh(geo, mat, o.max);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.geometry.setAttribute('aColA', new THREE.InstancedBufferAttribute(new Float32Array(o.max * 3), 3));
    im.geometry.setAttribute('aColB', new THREE.InstancedBufferAttribute(new Float32Array(o.max * 3), 3));
    im.frustumCulled = false; im.castShadow = o.castShadow; im.receiveShadow = true; im.count = 0;
    group.add(im); meshes[name] = im;
  };
  for (const [k, p] of Object.entries(PARTS)) mk(k, p.geo());
  for (const [k, f] of Object.entries(HAIR)) mk('hair_' + k, f());
  // phone: dark body + bright screen facing the owner (screen is emissive, separate mesh so it can glow)
  const phoneGeo = new THREE.BoxGeometry(0.075, 0.15, 0.012);
  const phoneMesh = new THREE.InstancedMesh(phoneGeo, new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.4 }), o.max);
  const screenGeo = new THREE.PlaneGeometry(0.066, 0.135).rotateY(Math.PI).translate(0, 0, -0.0065);   // faces -z: back toward the owner
  const screenMat = new THREE.MeshBasicMaterial({ color: '#cfe2ff', toneMapped: false });
  const screenMesh = new THREE.InstancedMesh(screenGeo, screenMat, o.max);
  for (const m of [phoneMesh, screenMesh]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; group.add(m); }
  // flashlight beams (cones) for night scenes
  const beamGeo = new THREE.ConeGeometry(0.9, 4, 16, 1, true).translate(0, -2, 0);   // apex at the hand, opening along the arm
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff3c8', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const beamMesh = new THREE.InstancedMesh(beamGeo, beamMat, o.max);
  beamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); beamMesh.frustumCulled = false; beamMesh.count = 0; group.add(beamMesh);

  const people = [];
  const phoneGlows = [];
  const tmp = { M: new THREE.Matrix4(), B: new THREE.Matrix4(), P: new THREE.Matrix4(), R: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), c: new THREE.Color() };

  // Add a person. spec: { x, z, h (heading, radians, 0 = +z), path, v, t0, loop, poses: [[t, name, blend]], look: [[t, yaw]], scale, kid, colors... }
  function add(spec = {}) {
    const p = Object.assign({
      x: 0, z: 0, y: 0, h: 0, scale: r.float(0.94, 1.06), seed: r.float(0, 100),
      skin: r.pick(SKIN), hairC: r.pick(HAIRC), shirt: r.pick(SHIRT), pants: r.pick(PANTS),
      hair: r.pick(['short', 'short', 'long', 'bun', 'cap', 'short']), longSleeve: r.chance(0.35),
      path: null, v: 1.35, t0: 0, loop: false, poses: [[0, 'idle']], phone: null, torch: null, visible: null,
      gait: 0, // extra stride phase offset
    }, spec);
    if (p.kid) p.scale *= 0.62;
    p.i = people.length;
    if (p.path) p.L = pathLen(p.path);
    people.push(p);
    return p;
  }

  // where the person is at time t
  function placeOf(p, t) {
    if (p.at) return p.at(t, p);
    if (!p.path) return { x: p.x, z: p.z, h: p.h, moving: 0, dist: 0 };
    let d = Math.max(0, t - p.t0) * p.v;
    if (p.loop) d = ((d % p.L) + p.L) % p.L;
    const moving = (t >= p.t0 && (p.loop || d < p.L)) ? 1 : 0;
    const q = pathAt(p.path, Math.min(d, p.L));
    return { x: q.x, z: q.z, h: q.h, moving, dist: d };
  }

  function poseOf(p, t, pl) {
    // blend the pose timeline: each entry fades in over its blend time
    const out = zeroPose();
    const ph = (pl.dist / (p.stride ?? 1.45)) * Math.PI * 2 / 2 + p.seed + p.gait;
    let weights = [];
    for (let i = 0; i < p.poses.length; i++) {
      const [t0, name, bl = 0.45] = p.poses[i];
      if (t < t0) break;
      const w = smooth(t0, t0 + bl, t);
      weights = weights.map(([n, ww]) => [n, ww * (1 - w)]);
      weights.push([name, w]);
    }
    if (!weights.length) weights = [[p.poses[0][1], 1]];
    for (const [name, w] of weights) {
      if (w < 1e-3) continue;
      let nm = name;
      if (nm === 'auto') nm = pl.moving ? (p.v > 2.6 ? 'run' : 'walk') : 'idle';
      addPose(out, POSES[nm](ph, t, p.seed), w);
    }
    return out;
  }

  const partNames = Object.keys(PARTS);
  function update(t) {
    const { M, B, P, R, q, e, v, s, c } = tmp;
    let n = 0;
    const hairCounts = {}; for (const k of Object.keys(HAIR)) hairCounts[k] = 0;
    let nPhone = 0, nBeam = 0;
    phoneGlows.length = 0;
    for (const p of people) {
      if (p.visible && !p.visible(t)) continue;
      if (p.hide && p.hide(t)) continue;
      const pl = placeOf(p, t);
      const po = poseOf(p, t, pl);
      if (p.extra) p.extra(t, po, pl);
      const yaw = pl.h + (p.turn ? p.turn(t) : 0);
      const y = (p.yAt ? p.yAt(pl.x, pl.z, t) : p.y) + (po.bob - po.drop) * p.scale;
      q.setFromEuler(e.set(0, yaw, 0));
      B.compose(v.set(pl.x, y, pl.z), q, s.set(p.scale, p.scale, p.scale));
      const sk = c.set(p.skin);
      const write = (name, idx, rot, colA, colB, extraRot) => {
        const part = PARTS[name] || { pivot: [0, NECK_Y, 0] };
        const pv = part.pivot;
        R.makeRotationFromEuler(e.set(rot[0], rot[1], rot[2], 'YXZ'));
        P.makeTranslation(pv[0], pv[1], pv[2]).multiply(R);
        M.multiplyMatrices(B, P);
        const im = meshes[name];
        im.setMatrixAt(idx, M);
        im.geometry.attributes.aColA.setXYZ(idx, colA.r, colA.g, colA.b);
        im.geometry.attributes.aColB.setXYZ(idx, colB.r, colB.g, colB.b);
        return M;
      };
      const shirt = new THREE.Color(p.shirt), pants = new THREE.Color(p.pants), skin = sk.clone(), hairC = new THREE.Color(p.hairC);
      // torso pivots at the hip: lean + twist
      write('torso', n, [po.torso, po.torsoYaw, 0], shirt, skin);
      // limbs hang from the leaning torso: build torso frame then offset
      const torsoM = new THREE.Matrix4().makeTranslation(0, HIP_Y, 0).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(po.torso, po.torsoYaw, 0, 'YXZ'))).multiply(new THREE.Matrix4().makeTranslation(0, -HIP_Y, 0));
      const limb = (name, idx, rot, colA, colB, mesh = name) => {
        const pv = PARTS[name].pivot;
        R.makeRotationFromEuler(e.set(rot[0], rot[1], rot[2], 'YXZ'));
        P.makeTranslation(pv[0], pv[1], pv[2]).multiply(R);
        M.multiplyMatrices(B, torsoM).multiply(P);
        const im = meshes[mesh];
        im.setMatrixAt(idx, M);
        im.geometry.attributes.aColA.setXYZ(idx, colA.r, colA.g, colA.b);
        im.geometry.attributes.aColB.setXYZ(idx, colB.r, colB.g, colB.b);
        return M.clone();
      };
      write('legL', n, [-po.legL, 0, po.legLr], pants, pants);
      write('legR', n, [-po.legR, 0, po.legRr], pants, pants);
      limb('armL', n, [-po.armL, po.armLy, -po.armLr], shirt, p.longSleeve ? shirt : skin);
      const armR = limb('armR', n, [-po.armR, po.armRy, -po.armRr], shirt, p.longSleeve ? shirt : skin);
      const headM = limb('head', n, [po.head, po.headYaw + (p.headYaw ? p.headYaw(t) : 0), 0], skin, skin);
      if (p.hair !== 'none') {
        const hk = p.hair, hi = hairCounts[hk]++;
        meshes['hair_' + hk].setMatrixAt(hi, headM);
        meshes['hair_' + hk].geometry.attributes.aColA.setXYZ(hi, hairC.r, hairC.g, hairC.b);
        meshes['hair_' + hk].geometry.attributes.aColB.setXYZ(hi, hairC.r, hairC.g, hairC.b);
      }
      const hasPhone = p.phone && p.phone(t);
      if (hasPhone || (p.torch && p.torch(t))) {
        const hand = new THREE.Vector3(0, -0.66, 0.03).applyMatrix4(armR);
        if (hasPhone) {
          // upright in front of the hand, screen toward the owner, camera toward where they look
          const tilt = p.phoneTilt ?? -0.35;
          const PM = new THREE.Matrix4().compose(hand, new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ')), s.set(p.scale, p.scale, p.scale));
          phoneMesh.setMatrixAt(nPhone, PM); screenMesh.setMatrixAt(nPhone, PM); nPhone++;
          if (!p.noGlow) phoneGlows.push(hand.clone());
        }
        if (p.torch && p.torch(t)) {
          // the beam continues along the arm
          beamMesh.setMatrixAt(nBeam++, armR.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.66, 0)));
        }
      }
      n++;
    }
    for (const k of partNames) { meshes[k].count = n; meshes[k].instanceMatrix.needsUpdate = true; meshes[k].geometry.attributes.aColA.needsUpdate = true; meshes[k].geometry.attributes.aColB.needsUpdate = true; }
    for (const k of Object.keys(HAIR)) { const m = meshes['hair_' + k]; m.count = hairCounts[k]; m.instanceMatrix.needsUpdate = true; m.geometry.attributes.aColA.needsUpdate = true; m.geometry.attributes.aColB.needsUpdate = true; }
    phoneMesh.count = screenMesh.count = nPhone; phoneMesh.instanceMatrix.needsUpdate = screenMesh.instanceMatrix.needsUpdate = true;
    beamMesh.count = nBeam; beamMesh.instanceMatrix.needsUpdate = true;
  }

  return { group, people, add, update, rng: r, screenMat, beamMat, POSES, phoneGlows };
}
