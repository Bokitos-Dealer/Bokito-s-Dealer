// Folding paper. A stack of paper is drawn as "slabs": a box of length L (along u, the fold
// direction), width W (along the hinge) and thickness T, hanging below a hinge line that sits on
// its top face. The vertex shader bends a slab over its hinge like a page being turned: the
// first part wraps around a cylinder of radius r, the rest continues straight, the whole thing
// rotated by theta (0 = lying flat, PI = folded over on top). Theta 0 also draws the half that
// stays put, so both halves of a fold use the same geometry and shading.
//
// Edges show the individual sheets as fine lines (one per layer); when the lines get finer than
// a pixel they fade to an even tone instead of shimmering.
import * as THREE from 'three';

const SEG = 64;   // segments along the fold direction (enough for a smooth bend)

// One unit slab: position.x = s in [0,1] (along u), position.y = d in [0,1] (depth below the top face),
// position.z = w in [-0.5, 0.5] (along the hinge). aF = face id.
function slabGeometry() {
  const pos = [], face = [], idx = [];
  const quad = (a, b, c, d) => { idx.push(a, b, c, a, c, d); };
  const v = (s, d, w, f) => { pos.push(s, d, w); face.push(f); return face.length - 1; };
  // top (0) and bottom (1): strips along s
  for (const [f, d] of [[0, 0], [1, 1]]) {
    const row = [];
    for (let i = 0; i <= SEG; i++) row.push([v(i / SEG, d, -0.5, f), v(i / SEG, d, 0.5, f)]);
    for (let i = 0; i < SEG; i++) {
      const [a0, a1] = row[i], [b0, b1] = row[i + 1];
      if (f === 0) quad(a0, a1, b1, b0); else quad(a0, b0, b1, a1);
    }
  }
  // sides along the hinge direction: w = +0.5 (2) and w = -0.5 (3)
  for (const [f, w] of [[2, 0.5], [3, -0.5]]) {
    const row = [];
    for (let i = 0; i <= SEG; i++) row.push([v(i / SEG, 0, w, f), v(i / SEG, 1, w, f)]);
    for (let i = 0; i < SEG; i++) {
      const [a0, a1] = row[i], [b0, b1] = row[i + 1];
      if (f === 2) quad(a0, a1, b1, b0); else quad(a0, b0, b1, a1);
    }
  }
  // ends: s = 1 (4) and s = 0 (5)
  for (const [f, s] of [[4, 1], [5, 0]]) {
    const a = v(s, 0, -0.5, f), b = v(s, 0, 0.5, f), c = v(s, 1, 0.5, f), d = v(s, 1, -0.5, f);
    if (f === 4) quad(a, b, c, d); else quad(a, d, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aF', new THREE.Float32BufferAttribute(face, 1));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);   // shape changes in the shader: never cull
  return g;
}

const DEFORM = /* glsl */`
  attribute float aF;
  uniform float uL, uT, uW, uTheta, uR;
  varying float vD; varying float vEdge;
  void paperBend(in vec3 p, out vec3 P, out vec3 N) {
    float S = p.x * uL, D = p.y * uT;
    float r = max(uR, 1e-7);
    float arc = r * uTheta;
    float phi; vec2 base;
    if (uR > 1e-6 && S < arc) { phi = S / r; base = vec2(r * sin(phi), r - r * cos(phi)); }   // uR = 0: turns over as one stiff block
    else { phi = uTheta; base = vec2(r * sin(uTheta), r - r * cos(uTheta)) + (S - arc) * vec2(cos(uTheta), sin(uTheta)); }
    vec2 n = vec2(sin(phi), -cos(phi));     // toward the outer (bottom) face
    vec2 tg = vec2(cos(phi), sin(phi));     // along the sheet, toward its free end
    vec2 q = base + D * n;
    P = vec3(q.x, q.y, p.z * uW);
    if (aF < 0.5) N = vec3(-n, 0.0);
    else if (aF < 1.5) N = vec3(n, 0.0);
    else if (aF < 2.5) N = vec3(0.0, 0.0, 1.0);
    else if (aF < 3.5) N = vec3(0.0, 0.0, -1.0);
    else if (aF < 4.5) N = vec3(tg, 0.0);
    else N = vec3(-tg, 0.0);
  }
`;

function patch(shader, U, withNormals) {
  Object.assign(shader.uniforms, U);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + DEFORM)
    .replace('#include <beginnormal_vertex>', withNormals
      ? 'vec3 bentP; vec3 objectNormal; paperBend(position, bentP, objectNormal);\nvD = position.y; vEdge = step(1.5, aF);'
      : '#include <beginnormal_vertex>')
    .replace('#include <begin_vertex>', withNormals ? 'vec3 transformed = bentP;' : 'vec3 bentP; vec3 bentN; paperBend(position, bentP, bentN); vec3 transformed = bentP;');
}

// shared look: warm white sheets, edges show the layers
export function makePaperMaterial(opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: opts.color ?? '#f3f1ea', roughness: 0.86, metalness: 0 });
  mat.userData.edgeTone = opts.edgeTone ?? 0.8;
  return mat;
}

export function buildSlab(baseMat) {
  const U = {
    uL: { value: 1 }, uT: { value: 0.01 }, uW: { value: 1 }, uTheta: { value: 0 }, uR: { value: 0.01 },
    uLayers: { value: 1 }, uEdgeTone: { value: baseMat.userData.edgeTone ?? 0.8 },
  };
  const mat = baseMat.clone();
  mat.onBeforeCompile = (sh) => {
    patch(sh, U, true);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLayers, uEdgeTone; varying float vD; varying float vEdge;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vEdge > 0.5) {
          // one thin line between neighbouring sheets; fade to the average tone when finer than a pixel
          float x = vD * uLayers;
          float fw = fwidth(x);
          float dd = abs(fract(x + 0.5) - 0.5);
          float lw = 0.16;
          float lines = 1.0 - smoothstep(lw - fw, lw + fw, dd);
          lines = mix(lines, lw * 2.0, smoothstep(0.25, 0.7, fw));
          float layer = floor(x);
          float jit = fract(sin(layer * 12.9898) * 43758.5453) - 0.5;
          jit *= 1.0 - smoothstep(0.15, 0.5, fw);
          diffuseColor.rgb *= uEdgeTone * (1.0 - 0.28 * lines) * (1.0 + 0.05 * jit);
        }`);
  };
  mat.customProgramCacheKey = () => 'paper-slab-v1';
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => patch(sh, U, false);
  depth.customProgramCacheKey = () => 'paper-slab-depth-v1';
  const mesh = new THREE.Mesh(slabGeometry(), mat);
  mesh.customDepthMaterial = depth;
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.U = U;
  return mesh;
}

// Place a slab: hinge at `origin` (on the slab's top face), u axis pointing along `yaw`
// (yaw 0 = +x, PI/2 = +z), lying on its top face at that height.
const Y = new THREE.Vector3(0, 1, 0);
export function setSlab(mesh, s) {
  const U = mesh.userData.U;
  U.uL.value = s.L; U.uT.value = s.T; U.uW.value = s.W; U.uTheta.value = s.theta ?? 0; U.uR.value = s.r ?? s.T * 0.02;
  U.uLayers.value = s.layers ?? 1;
  mesh.position.copy(s.origin);
  // local x = u, y = up, z = along the hinge; yaw turns +x toward +z with negative rotation about y
  mesh.quaternion.setFromAxisAngle(Y, -(s.yaw ?? 0));
  mesh.visible = s.visible ?? true;
}

// A small pool of slabs, enough for "the half that stays + the half that moves".
export function buildStack(mat, n = 2) {
  const group = new THREE.Group();
  const slabs = [];
  for (let i = 0; i < n; i++) { const m = buildSlab(mat); slabs.push(m); group.add(m); }
  return {
    group, slabs,
    // list = [{ origin, yaw, L, W, T, theta, r, layers }]
    set(list) { slabs.forEach((m, i) => { if (list[i]) setSlab(m, list[i]); else m.visible = false; }); },
  };
}

// where a point of a bent slab ends up (same maths as the shader), in the slab's local frame
export function bendPoint(S, D, theta, r0) {
  const r = Math.max(r0, 1e-7);
  const arc = r * theta;
  let phi, bx, by;
  if (r0 > 1e-6 && S < arc) { phi = S / r; bx = r * Math.sin(phi); by = r - r * Math.cos(phi); }
  else { phi = theta; bx = r * Math.sin(theta) + (S - arc) * Math.cos(theta); by = r - r * Math.cos(theta) + (S - arc) * Math.sin(theta); }
  const nx = Math.sin(phi), ny = -Math.cos(phi);
  return { x: bx + D * nx, y: by + D * ny, phi, tx: Math.cos(phi), ty: Math.sin(phi), nx, ny };
}
