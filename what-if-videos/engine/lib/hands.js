// Blocky hands for close-ups (same style as the characters): palm, four two-segment fingers,
// a two-segment thumb and a forearm in a sleeve that runs back to a fixed elbow point.
// Local frame of a hand: +Y along the fingers, +Z out of the back of the hand (the palm faces -Z),
// the thumb on -X for a right hand and +X for a left hand.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { lerp } from './rng.js';

const FINGERS = [   // [offset across the palm from the thumb side, segment lengths]
  [-0.0285, [0.045, 0.034]],   // index
  [-0.0095, [0.049, 0.037]],   // middle
  [0.0095, [0.046, 0.035]],    // ring
  [0.0285, [0.037, 0.028]],    // pinky
];

export const HAND_POSES = {
  flat: { curl: [[0.08, 0.06], [0.08, 0.06], [0.1, 0.07], [0.12, 0.08]], spread: 0.3, opp: 0.15, tcurl: 0.12 },
  relax: { curl: [[0.32, 0.3], [0.38, 0.32], [0.42, 0.35], [0.46, 0.38]], spread: 0.3, opp: 0.3, tcurl: 0.25 },
  pinch: { curl: [[0.5, 0.42], [0.72, 0.62], [0.82, 0.7], [0.88, 0.74]], spread: 0.18, opp: 0.85, tcurl: 0.3 },
  press: { curl: [[0.16, 0.08], [0.16, 0.08], [0.2, 0.1], [0.24, 0.12]], spread: 0.18, opp: 0.25, tcurl: 0.15 },
  grip: { curl: [[0.28, 0.3], [0.32, 0.32], [0.36, 0.34], [0.4, 0.36]], spread: 0.25, opp: 0.6, tcurl: 0.25 },
  point: { curl: [[0.05, 0.02], [0.85, 0.7], [0.9, 0.72], [0.92, 0.75]], spread: 0.15, opp: 0.6, tcurl: 0.4 },
};

export function blendPose(a, b, k) {
  const A = typeof a === 'string' ? HAND_POSES[a] : a, B = typeof b === 'string' ? HAND_POSES[b] : b;
  return {
    curl: A.curl.map((c, i) => [lerp(c[0], B.curl[i][0], k), lerp(c[1], B.curl[i][1], k)]),
    spread: lerp(A.spread, B.spread, k), opp: lerp(A.opp, B.opp, k), tcurl: lerp(A.tcurl, B.tcurl, k),
  };
}

export function buildHand(o = {}) {
  const side = o.side === 'L' ? 1 : -1;     // thumb side along local X
  const skin = new THREE.MeshStandardMaterial({ color: o.skin ?? '#e0ac85', roughness: 0.72 });
  const sleeveM = new THREE.MeshStandardMaterial({ color: o.sleeve ?? '#d9a23a', roughness: 0.9 });
  const cuffM = new THREE.MeshStandardMaterial({ color: o.cuff ?? o.sleeve ?? '#d9a23a', roughness: 0.92 });
  const shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  // softly rounded blocks: still the blocky style, without razor edges in close-up
  const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  const box = (w, h, d, mat) => shadow(new THREE.Mesh(rbox(w, h, d, 0.0055).translate(0, h / 2, 0), mat));

  const root = new THREE.Group();
  const palm = shadow(new THREE.Mesh(rbox(0.082, 0.092, 0.027, 0.009), skin));
  root.add(palm);
  const fingers = FINGERS.map(([x, lens]) => {
    const j1 = new THREE.Group(); j1.position.set(x * -side, 0.044, -0.001);
    const s1 = box(0.0185, lens[0], 0.019, skin); j1.add(s1);
    const j2 = new THREE.Group(); j2.position.set(0, lens[0], 0); j1.add(j2);
    const s2 = box(0.0175, lens[1], 0.0175, skin); j2.add(s2);
    const tip = new THREE.Object3D(); tip.position.set(0, lens[1], -0.006); j2.add(tip);
    root.add(j1);
    return { j1, j2, tip };
  });
  const tBase = new THREE.Group(); tBase.position.set(side * 0.034, -0.022, -0.008); root.add(tBase);
  const t1 = box(0.022, 0.042, 0.02, skin); tBase.add(t1);
  const tJ = new THREE.Group(); tJ.position.set(0, 0.042, 0); tBase.add(tJ);
  const t2 = box(0.02, 0.032, 0.019, skin); tJ.add(t2);
  const tTip = new THREE.Object3D(); tTip.position.set(0, 0.032, -0.005); tJ.add(tTip);

  // forearm + sleeve live in world space (they run from the wrist to the elbow)
  const arm = new THREE.Group();
  const fore = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 1, 12).translate(0, 0.5, 0).scale(1.1, 1, 0.9), skin));
  const sleeve = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 1, 14).translate(0, 0.5, 0), sleeveM));
  const cuff = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.009, 8, 18).rotateX(Math.PI / 2), cuffM));
  arm.add(fore, sleeve, cuff);

  const group = new THREE.Group();
  group.add(root, arm);

  function applyPose(p) {
    p = typeof p === 'string' ? HAND_POSES[p] : p;
    fingers.forEach((f, i) => { f.j1.rotation.set(-p.curl[i][0] * 1.45, 0, 0); f.j2.rotation.set(-p.curl[i][1] * 1.5, 0, 0); });
    const a = lerp(0.35, 1.05, p.spread);
    tBase.rotation.set(-p.opp * 1.05, 0, -side * a, 'ZXY');
    tJ.rotation.set(-p.tcurl * 1.2, 0, 0);
  }

  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), WRIST = new THREE.Vector3(0, -0.046, 0.002), UP = new THREE.Vector3(0, 1, 0);
  // point on the hand, in palm space, for the current pose: 'thumb', 'index', 'middle', 'pinch' (between thumb and index tips)
  function local(which) {
    root.position.set(0, 0, 0); root.quaternion.identity(); root.updateMatrixWorld(true);
    const g = (o) => o.getWorldPosition(new THREE.Vector3());
    if (which === 'thumb') return g(tTip);
    if (which === 'index') return g(fingers[0].tip);
    if (which === 'middle') return g(fingers[1].tip);
    return g(tTip).add(g(fingers[0].tip)).multiplyScalar(0.5);
  }

  return {
    group, root, side,
    // s = { pose, pos (palm centre) | anchor: [which, worldPoint], quat, elbow, sleeveAt (0..1 along the forearm), visible }
    set(s) {
      group.visible = s.visible ?? true;
      if (!group.visible) return;
      applyPose(s.pose);
      if (s.anchor) {
        const lp = local(s.anchor[0]).applyQuaternion(s.quat);
        root.position.copy(s.anchor[1]).sub(lp);
      } else root.position.copy(s.pos);
      root.quaternion.copy(s.quat);
      root.updateMatrixWorld(true);
      // forearm from the wrist to the elbow
      const wrist = WRIST.clone().applyQuaternion(root.quaternion).add(root.position);
      const dir = tmpV.copy(s.elbow).sub(wrist);
      const len = dir.length(); dir.normalize();
      tmpQ.setFromUnitVectors(UP, dir);
      // keep the forearm's flat side turned like the back of the hand
      const handZ = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
      const q0 = tmpQ.clone(), z0 = new THREE.Vector3(0, 0, 1).applyQuaternion(q0);
      const zp = handZ.clone().sub(dir.clone().multiplyScalar(handZ.dot(dir))).normalize();
      const ang = Math.atan2(new THREE.Vector3().crossVectors(z0, zp).dot(dir), z0.dot(zp));
      const q = new THREE.Quaternion().setFromAxisAngle(dir, ang).multiply(q0);
      const sa = s.sleeveAt ?? 0.3;
      fore.position.copy(wrist); fore.quaternion.copy(q); fore.scale.set(1, len, 1);
      sleeve.position.copy(wrist).addScaledVector(dir, len * sa); sleeve.quaternion.copy(q); sleeve.scale.set(1, len * (1 - sa) + 0.2, 1);
      cuff.position.copy(wrist).addScaledVector(dir, len * sa - 0.005); cuff.quaternion.copy(q);
    },
    local,
  };
}

// orientation from "fingers point along f" and "back of the hand faces b"
export function handQuat(f, b) {
  const Yv = f.clone().normalize();
  const Zv = b.clone().sub(Yv.clone().multiplyScalar(b.dot(Yv))).normalize();
  const Xv = new THREE.Vector3().crossVectors(Yv, Zv);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Xv, Yv, Zv));
}
