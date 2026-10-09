// Paper-fold QA: how deep the right hand cuts into the moving flap, and how fast it turns, frame by frame.
// usage: node qa/paper-fold-hands.mjs [from s] [to s]     (prints frames with a cut > 2 mm or a turn > 18 deg/frame)
import path from 'path';
import { fileURLToPath } from 'url';
const dir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const THREE = await import(dir + '/node_modules/three/build/three.module.js');
const scen = (await import(dir + '/scenarios/paper-fold.js')).default;
const { buildHand } = await import(dir + '/engine/lib/hands.js');
const st = { handR: buildHand({ side: 'R' }), ELBOW_R: new THREE.Vector3(0.3, 0.2, 0.42) };
const self = Object.assign(Object.create(scen), { st });
const segs = self.buildRightSegments(); self._segs = segs;
// sample points (with radius) over every skin mesh of the hand
const meshes = []; st.handR.root.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); meshes.push(o); } });
function handPoints() {
  st.handR.root.updateMatrixWorld(true);
  const pts = [];
  for (const m of meshes) {
    const b = m.geometry.boundingBox, sz = b.getSize(new THREE.Vector3());
    const rad = Math.min(sz.x, sz.y, sz.z) / 2;
    const n = [Math.max(1, Math.round(sz.x / rad)), Math.max(1, Math.round(sz.y / rad)), Math.max(1, Math.round(sz.z / rad))];
    for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
      const p = new THREE.Vector3(b.min.x + rad + (sz.x - 2 * rad) * (n[0] > 1 ? i / (n[0] - 1) : 0.5), b.min.y + rad + (sz.y - 2 * rad) * (n[1] > 1 ? j / (n[1] - 1) : 0.5), b.min.z + rad + (sz.z - 2 * rad) * (n[2] > 1 ? k / (n[2] - 1) : 0.5));
      if (sz.x - 2 * rad < 0) p.x = (b.min.x + b.max.x) / 2; if (sz.y - 2 * rad < 0) p.y = (b.min.y + b.max.y) / 2; if (sz.z - 2 * rad < 0) p.z = (b.min.z + b.max.z) / 2;
      pts.push([p.applyMatrix4(m.matrixWorld), rad]);
    }
  }
  return pts;
}
const D = (await import(dir + '/scenarios/paper-fold.js'))._debug;
self._probeFold = (t) => {
  const e = D.EV.find((e) => e.kind === 'hand' && t >= e.t0 && t < e.t0 + e.d);
  let k, theta, r;
  if (e) { const s = D.handFoldShape(e, (t - e.t0) / e.d); k = e.k; theta = s.theta; r = s.r; }
  else if (t >= D.FAIL.t0 && t < D.FAIL.t0 + D.FAIL.d) { const s = D.failShape(t); k = D.FAIL.k; theta = s.theta; r = s.r; }
  else return null;
  const F = D.deskFold(k), wP = (k <= 7 ? k % 2 === 1 : k % 2 === 0) ? -0.22 * F.W : 0.2 * F.W;
  return { k, theta, r, F, pinch: self.foldPoint(k, theta, r, F.L, F.T / 2, wP).P };
};
const t0 = +(process.argv[2] || 0), t1 = +(process.argv[3] || 14.1);
// fold being carried at time t, and its angle: read back from the scenario's own paper state
const out = [];
let prevQ = null;
for (let f = Math.round(t0 * 30); f / 30 < t1; f++) {
  const t = f / 30, h = self.rightHandAt(t);
  st.handR.set({ pose: h.pose, quat: h.quat, pos: h.pos, elbow: st.ELBOW_R });
  const act = self._probeFold ? self._probeFold(t) : null;
  let depth = 0;
  if (act) {
    const { k, theta, r, F } = act;
    const pts = handPoints();
    for (let si = 0; si <= 40; si++) for (let wi = 0; wi <= 16; wi++) {
      const q = self.foldPoint(k, theta, r, F.L * si / 40, F.T / 2, (wi / 16 - 0.5) * F.W);
      for (const [p, rad] of pts) { const d = rad + F.T / 2 - p.distanceTo(q.P); if (d > depth && p.distanceTo(act.pinch) > 0.012) depth = d; }
    }
  }
  const rot = prevQ ? THREE.MathUtils.radToDeg(prevQ.angleTo(h.quat)) : 0; prevQ = h.quat.clone();
  out.push({ f, t, depth, rot, k: act && act.k, th: act && act.theta });
}
for (const o of out) if (o.depth > 0.002 || o.rot > 18) console.log(`f${o.f} t=${o.t.toFixed(2)} fold ${o.k ?? '-'} th ${o.th != null ? (o.th / Math.PI).toFixed(2) + 'π' : '-'} cut ${(o.depth * 1000).toFixed(1)}mm rot ${o.rot.toFixed(1)}°`);
console.log('max cut mm', (Math.max(...out.map((o) => o.depth)) * 1000).toFixed(1), 'max rot', Math.max(...out.map((o) => o.rot)).toFixed(1));
