// A city seafront: sloping beach, seawall, promenade with railing, lamps,
// benches and palms, a four-lane coast road, and shopfronts on the first row
// of buildings. The sea is toward -z, the city toward +z, street level y = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from './rng.js';

export const SF = {
  MSL: -4.6,                 // mean sea level
  wallY: -1.8,               // beach height at the foot of the seawall
  slope: 0.05,               // beach gradient
  prom: [0, 14],             // promenade z range
  road: [15, 29],            // coast road
  walk: [29, 33],            // far sidewalk
  lanes: [16.75, 20.25, 23.75, 27.25],
};
// beach / seabed height (z < 0); street level above
export function beachY(x, z) {
  if (z >= 0) return 0;
  let y = SF.wallY + SF.slope * z + 0.12 * Math.sin(x * 0.021 + z * 0.06) * Math.min(1, -z / 20);
  if (z < -110) y -= 0.07 * (-z - 110);
  return Math.max(-16, y);
}
export const TERRAIN_GLSL = `
  float terrain(vec2 p){
    if (p.y >= 0.0) return 0.0;
    float y = ${SF.wallY.toFixed(2)} + ${SF.slope.toFixed(3)} * p.y + 0.12 * sin(p.x*0.021 + p.y*0.06) * min(1.0, -p.y/20.0);
    if (p.y < -110.0) y -= 0.07 * (-p.y - 110.0);
    return max(-16.0, y);
  }`;

function colorGeo(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// Add snow cover (on up-facing surfaces) to a standard material. U = { uSnow: {value} } shared.
export function withSnow(mat, U, key) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uSnow = U.uSnow;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vSnowUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vSnowUp = normalize(mat3(modelMatrix) * normal).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnow; varying float vSnowUp;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.97), uSnow * smoothstep(0.25, 0.7, vSnowUp));');
  };
  mat.customProgramCacheKey = () => 'snow-' + key;
  return mat;
}

function tileTexture(seed) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const c = cv.getContext('2d'); const r = new Rng(seed);
  c.fillStyle = '#b8b0a2'; c.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = r.float(-14, 14);
    c.fillStyle = `rgb(${190 + v},${182 + v},${168 + v})`;
    c.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
  }
  // a darker border band every few tiles
  c.fillStyle = 'rgba(120,110,100,0.35)'; c.fillRect(0, 0, 512, 6);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function roadTexture() {
  // 14 m across (z), repeating every 12 m along x
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 600;
  const c = cv.getContext('2d');
  const r = new Rng(3);
  c.fillStyle = '#3d3e41'; c.fillRect(0, 0, 512, 600);
  for (let i = 0; i < 2500; i++) { const v = r.float(-10, 10); c.fillStyle = `rgba(${60 + v},${61 + v},${64 + v},0.6)`; c.fillRect(r.float(0, 512), r.float(0, 600), 3, 3); }
  const Z = (m) => m / 14 * 600;
  c.fillStyle = '#e8c547'; c.fillRect(0, Z(7) - 9, 512, 6); c.fillRect(0, Z(7) + 3, 512, 6);   // double yellow
  c.fillStyle = '#ececec';
  for (const zm of [3.5, 10.5]) for (let x = 0; x < 512; x += 256) c.fillRect(x, Z(zm) - 4, 128, 8);  // dashed lanes
  c.fillRect(0, Z(0.25) - 3, 512, 6); c.fillRect(0, Z(13.75) - 3, 512, 6);                         // edge lines
  const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function sandTexture(seed) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const c = cv.getContext('2d'); const r = new Rng(seed);
  c.fillStyle = '#d9c49b'; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const v = r.float(-22, 22); c.fillStyle = `rgba(${217 + v},${196 + v},${155 + v},0.5)`; c.fillRect(r.float(0, 512), r.float(0, 512), r.float(1, 3), r.float(1, 3)); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function signTexture(text, bg, fg) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, 512, 128);
  c.fillStyle = fg; c.font = 'bold 72px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildSeafront(opts = {}) {
  const o = Object.assign({ x0: -700, x1: 700, seed: 5, lampEvery: 20, city: null }, opts);
  const r = new Rng(o.seed);
  const group = new THREE.Group();
  const snowU = { uSnow: { value: 0 } };
  const W = o.x1 - o.x0, cx = (o.x0 + o.x1) / 2;

  // ---- beach: sand with a wet band below the current water line and the old high-tide wrack line
  const beachU = { uWetY: { value: SF.MSL - 1 }, uWrackY: { value: SF.MSL + 1.9 }, uWrack: { value: 0 }, uSnow: snowU.uSnow, uDark: { value: 0 } };
  const bg = new THREE.PlaneGeometry(W + 600, 260, Math.round((W + 600) / 6), 130).rotateX(-Math.PI / 2).translate(cx, 0, -130);
  const bp = bg.attributes.position;
  for (let i = 0; i < bp.count; i++) bp.setY(i, beachY(bp.getX(i), bp.getZ(i)));
  bg.computeVertexNormals();
  const sandTex = sandTexture(o.seed);
  sandTex.repeat.set((W + 600) / 9, 260 / 9);
  const beachMat = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.95 });
  beachMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, beachU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uWetY, uWrackY, uWrack, uSnow, uDark; varying vec3 vWp;
      float bh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float bn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(bh(i),bh(i+vec2(1,0)),u.x), mix(bh(i+vec2(0,1)),bh(i+vec2(1,1)),u.x), u.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wet = 1.0 - smoothstep(uWetY - 0.05, uWetY + 0.12, vWp.y);
        diffuseColor.rgb *= mix(1.0, 0.62, wet);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.9, 0.93, 1.0), wet);
        // seaweed and shells left by the old, higher tides
        float wn = bn(vWp.xz * vec2(0.35, 1.4)) * 0.5 + bn(vWp.xz * 1.3) * 0.5;
        float wd = abs(vWp.y - uWrackY - (wn - 0.5) * 0.14);
        float wr = (1.0 - smoothstep(0.06, 0.2, wd)) * (0.55 + 0.45 * smoothstep(0.2, 0.6, wn)) * uWrack;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.12, 0.07), wr);
        // and the old wet zone below it, darker than the dry sand: where the sea used to reach
        diffuseColor.rgb *= 1.0 - 0.2 * uWrack * (1.0 - smoothstep(uWrackY - 0.25, uWrackY + 0.02, vWp.y)) * (1.0 - wet);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.97), uSnow * (0.85 + 0.15 * bn(vWp.xz * 0.7)));
        diffuseColor.rgb *= 1.0 - uDark;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.35, (1.0 - smoothstep(uWetY - 0.05, uWetY + 0.12, vWp.y)) * (1.0 - uSnow));');
  };
  beachMat.customProgramCacheKey = () => 'beach-v3';
  const beach = new THREE.Mesh(bg, beachMat);
  beach.receiveShadow = true;
  group.add(beach);

  // ---- promenade deck + seawall
  const tiles = tileTexture(o.seed + 1);
  tiles.repeat.set(W / 4, 14 / 4);
  const deckMat = withSnow(new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.85 }), snowU, 'deck');
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 2.4, 14), [deckMat, deckMat, deckMat, deckMat, deckMat, deckMat]);
  deck.position.set(cx, -1.2, 7);
  deck.receiveShadow = true;
  group.add(deck);
  const wallMat = withSnow(new THREE.MeshStandardMaterial({ color: '#9b958a', roughness: 0.92 }), snowU, 'wall');
  const seawall = new THREE.Mesh(new THREE.BoxGeometry(W, 5, 1.2), wallMat);
  seawall.position.set(cx, -2.5, 0.6); seawall.receiveShadow = true; seawall.castShadow = true;
  group.add(seawall);
  // capstone
  const cap = new THREE.Mesh(new THREE.BoxGeometry(W, 0.18, 1.4), withSnow(new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.8 }), snowU, 'cap'));
  cap.position.set(cx, 0.09, 0.6); cap.receiveShadow = true; group.add(cap);

  // ---- railing (posts + two rails)
  const railMat = withSnow(new THREE.MeshStandardMaterial({ color: '#2f3438', roughness: 0.5, metalness: 0.6 }), snowU, 'rail');
  const nPost = Math.floor(W / 2.2);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 1.05, 0.07).translate(0, 0.62, 0), railMat, nPost);
  const M = new THREE.Matrix4();
  for (let i = 0; i < nPost; i++) { M.makeTranslation(o.x0 + i * 2.2, 0, 0.35); posts.setMatrixAt(i, M); }
  posts.castShadow = true;
  const rails = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(W, 0.07, 0.09).translate(cx, 1.15, 0.35), new THREE.BoxGeometry(W, 0.04, 0.05).translate(cx, 0.65, 0.35)]), railMat);
  rails.castShadow = true;
  group.add(posts, rails);

  // ---- stairs down to the beach every 120 m
  const stairs = [];
  const stepMat = withSnow(new THREE.MeshStandardMaterial({ color: '#b3ab9d', roughness: 0.9 }), snowU, 'steps');
  for (let x = o.x0 + 70; x < o.x1 - 40; x += 120) {
    stairs.push(x);
    const steps = [];
    for (let k = 0; k < 10; k++) steps.push(new THREE.BoxGeometry(4, 0.2 + k * 0.18, 0.4).translate(x, -1.8 + (0.2 + k * 0.18) / 2, -3.6 + k * 0.4));
    const m = new THREE.Mesh(mergeGeometries(steps), stepMat); m.receiveShadow = m.castShadow = true; group.add(m);
  }

  // ---- lamp posts (along the railing) + benches between them
  const lamps = [];
  const lampMat = withSnow(new THREE.MeshStandardMaterial({ color: '#25292d', roughness: 0.5, metalness: 0.5 }), snowU, 'lamp');
  const lampGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.07, 0.11, 5.6, 8).translate(0, 2.8, 0),
    new THREE.BoxGeometry(0.08, 0.08, 1.1).translate(0, 5.55, 0.5),
    new THREE.BoxGeometry(0.42, 0.18, 0.5).translate(0, 5.5, 1.0),
  ]);
  const lampHeadGeo = new THREE.BoxGeometry(0.34, 0.04, 0.42).translate(0, 5.39, 1.0);
  const nL = Math.floor(W / o.lampEvery);
  const lampIM = new THREE.InstancedMesh(lampGeo, lampMat, nL);
  const lensMat = new THREE.MeshBasicMaterial({ color: '#fff1cf', toneMapped: false });
  const lensIM = new THREE.InstancedMesh(lampHeadGeo, lensMat, nL);
  for (let i = 0; i < nL; i++) {
    const x = o.x0 + 10 + i * o.lampEvery;
    M.makeTranslation(x, 0, 0.9); lampIM.setMatrixAt(i, M); lensIM.setMatrixAt(i, M);
    lamps.push(new THREE.Vector3(x, 5.3, 1.9));
  }
  lampIM.castShadow = true;
  group.add(lampIM, lensIM);
  const benchMat = withSnow(new THREE.MeshStandardMaterial({ color: '#8a5a3a', roughness: 0.8 }), snowU, 'bench');
  const benchGeo = mergeGeometries([
    new THREE.BoxGeometry(1.9, 0.08, 0.5).translate(0, 0.46, 0),
    new THREE.BoxGeometry(1.9, 0.45, 0.07).translate(0, 0.8, 0.26),
    new THREE.BoxGeometry(0.08, 0.46, 0.45).translate(-0.85, 0.23, 0), new THREE.BoxGeometry(0.08, 0.46, 0.45).translate(0.85, 0.23, 0),
  ]);
  const benches = [];
  const benchIM = new THREE.InstancedMesh(benchGeo, benchMat, nL);
  for (let i = 0; i < nL; i++) { const x = o.x0 + 20 + i * o.lampEvery; M.makeTranslation(x, 0, 2.7); benchIM.setMatrixAt(i, M); benches.push({ x, z: 2.7 }); }
  benchIM.castShadow = benchIM.receiveShadow = true;
  group.add(benchIM);

  // ---- palms along the inland edge of the promenade
  const palmParts = [colorGeo(new THREE.CylinderGeometry(0.17, 0.3, 8.5, 7).translate(0, 4.25, 0), '#7a6248')];
  for (let k = 0; k < 8; k++) {
    const f = new THREE.BoxGeometry(3.6, 0.07, 0.8).translate(1.8, 0, 0);
    { const p = f.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) - 0.09 * x * x); p.setZ(i, p.getZ(i) * (1 - x / 4.2)); } }
    f.rotateZ(0.25); f.rotateY(k * Math.PI * 2 / 8 + 0.3); f.translate(0, 8.5, 0);
    palmParts.push(colorGeo(f, k % 2 ? '#4e7d3a' : '#5d8f42'));
  }
  palmParts.push(colorGeo(new THREE.IcosahedronGeometry(0.45, 0).translate(0, 8.45, 0), '#5b4630'));
  const palmMat = withSnow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), snowU, 'palm');
  const palmIM = new THREE.InstancedMesh(mergeGeometries(palmParts), palmMat, nL);
  const palms = [];
  for (let i = 0; i < nL; i++) {
    const x = o.x0 + 20 + i * o.lampEvery, s = r.float(0.85, 1.15);
    M.compose(new THREE.Vector3(x, 0, 12.3), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.float(-0.05, 0.05), r.float(0, 6.28), r.float(-0.06, 0.06))), new THREE.Vector3(s, s, s));
    palmIM.setMatrixAt(i, M); palms.push({ x, z: 12.3 });
  }
  palmIM.castShadow = true;
  group.add(palmIM);

  // ---- road, curbs, far sidewalk
  const rt = roadTexture(); rt.repeat.set(W / 12, 1);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(W, 14).rotateX(-Math.PI / 2), withSnow(new THREE.MeshStandardMaterial({ map: rt, roughness: 0.88 }), snowU, 'road'));
  // rotate UVs so the texture's vertical axis runs across the road
  road.position.set(cx, 0.02, 22); road.receiveShadow = true;
  group.add(road);
  const curbMat = withSnow(new THREE.MeshStandardMaterial({ color: '#a8a39a', roughness: 0.9 }), snowU, 'curb');
  const walkTiles = tileTexture(o.seed + 7); walkTiles.repeat.set(W / 4, 1);
  const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, 4.4), withSnow(new THREE.MeshStandardMaterial({ map: walkTiles, roughness: 0.88 }), snowU, 'walk'));
  sidewalk.position.set(cx, 0.0, 31.2); sidewalk.receiveShadow = true;
  const curb = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, 1.0), curbMat);
  curb.position.set(cx, 0.0, 14.5); curb.receiveShadow = true;
  group.add(sidewalk, curb);
  // crosswalks
  const zebra = [];
  for (let x = o.x0 + 130; x < o.x1 - 60; x += 240) for (let k = 0; k < 7; k++) zebra.push(new THREE.BoxGeometry(0.6, 0.02, 13.4).translate(x + k * 1.2, 0.035, 22));
  if (zebra.length) { const zm = new THREE.Mesh(mergeGeometries(zebra), withSnow(new THREE.MeshStandardMaterial({ color: '#e9e9e6', roughness: 0.8 }), snowU, 'zebra')); zm.receiveShadow = true; group.add(zm); }

  // ---- shopfronts on the first row of buildings: awnings + signs
  const shops = [];
  if (o.city) {
    const names = [['GELATO', '#f7e7ce', '#c0392b'], ['SURF SHOP', '#1f6f8b', '#ffffff'], ['CAFÉ', '#2d2a26', '#f4d03f'], ['HOTEL', '#1b2631', '#f5f5f5'], ['PIZZA', '#b03a2e', '#ffffff'], ['BAR', '#141414', '#ff6f61'], ['PHARMACY', '#1e8449', '#ffffff'], ['BOOKS', '#5b2c6f', '#ffffff'], ['SEAFOOD', '#154360', '#f8c471'], ['BIKES', '#f39c12', '#1b2631']];
    const awnCols = ['#c0392b', '#1f618d', '#239b56', '#d68910', '#7d3c98', '#2e4053', '#b9770e', '#a93226'];
    const awnGeos = [], awnColsV = [];
    for (const b of o.city.buildings) {
      if (b.z0 > 50 || b.x1 < o.x0 || b.x0 > o.x1) continue;
      const w = b.x1 - b.x0;
      for (let x = b.x0 + 1.5; x + 5 < b.x1 - 1; x += r.float(7, 11)) {
        const aw = r.float(4, 6.5);
        const col = r.pick(awnCols);
        const g = new THREE.BoxGeometry(aw, 0.12, 1.6).rotateX(-0.28).translate(x + aw / 2, 3.25, b.z0 - 0.75);
        awnGeos.push(colorGeo(g, col));
        if (r.chance(0.55)) {
          const [txt, bgc, fg] = r.pick(names);
          const sm = new THREE.Mesh(new THREE.PlaneGeometry(aw * 0.8, aw * 0.8 / 4), new THREE.MeshStandardMaterial({ map: signTexture(txt, bgc, fg), emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.6 }));
          sm.rotation.y = Math.PI; sm.position.set(x + aw / 2, 4.1, b.z0 - 0.06);
          group.add(sm); shops.push(sm);
        }
        x += aw;
      }
    }
    if (awnGeos.length) {
      const am = new THREE.Mesh(mergeGeometries(awnGeos), withSnow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), snowU, 'awning'));
      am.castShadow = am.receiveShadow = true; group.add(am);
    }
  }

  return { group, beach, beachU, snowU, lamps, lensMat, benches, palms, stairs, shops, deckMat };
}
