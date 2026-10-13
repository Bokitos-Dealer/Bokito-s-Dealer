// The world of "What if AI took every job?": one city block at the size of a model railway, built in metres.
//   the tower:      a fourteen-storey office cut open at the front like a doll's house; a department on each
//                   floor, a person at every desk, a screen in front of each of them
//   the street:     a four-lane avenue, pavements, street lamps, cars, robots
//   across it:      a supermarket with a glass front, and a block of flats cut open like the tower
//   the city:       blocks of towers all round, their windows turning from warm to cyan as AI spreads
//   the stage:      a dark studio floor for the hundred people of the history beat
// Interiors are lit by a shader term rather than by hundreds of lamps: every material inside a building gets
// the light of its own floor, room or shop section, plus the glow of the nearest screen (warm white while a
// person works at it, cyan once AI has taken over), from uniforms the scenario drives with time.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng, clamp, lerp, smooth } from '../engine/lib/rng.js';

export const FH = 4, HX = 15, HZ = 8, NFL = 14;                 // floor height, tower half-width and half-depth, floors 0..13
export const COLS = [-11.5, -6.5, -1.5, 3.5, 8.5], ROWS = [3.0, -1.5, -6.0];
export const DEPTS = [null, 'CALL CENTER', 'DATA ENTRY', 'TRANSLATION', 'MARKETING', 'DESIGN', 'SOFTWARE', 'LEGAL', 'ACCOUNTING', 'FINANCE', 'HUMAN RESOURCES', 'MANAGEMENT', 'AI RESEARCH'];
export const deskDelay = (ci, ri) => 0.16 * ci + 0.1 * ri;      // the wave runs across a floor, left to right
export const screenPos = (f, ci, ri) => new THREE.Vector3(COLS[ci], f * FH + 1.13, ROWS[ri] - 0.22);
export const seatPos = (f, ci, ri) => new THREE.Vector3(COLS[ci], f * FH, ROWS[ri] + 0.78);
export const STORE = { x0: -22, x1: 2, z0: 28, z1: 44, h: 8 };
export const APT = { x0: 6, x1: 24, z0: 28, z1: 40, fh: 3.2, nf: 4, rw: 6 };
export const ROAD = { z0: 14, z1: 24 };
export const POLE_DX = 20, POLE_Z = [11.6, 26.4];
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ the shared light uniforms
export function makeIU() {
  return {
    uTime: { value: 0 }, uHeroT: { value: 1e4 },
    uWarm: { value: new Array(NFL).fill(1) }, uFlipT: { value: new Array(NFL).fill(1e4) },
    uStore: { value: [1, 1, 1] }, uApt: { value: new Array(12).fill(1) }, uAptCol: { value: new THREE.Color(1, 0.78, 0.5) },
    uStreet: { value: 1 }, uDayIn: { value: 0 }, uLobby: { value: 1 }, uPent: { value: 1 },
  };
}
const INTERIOR_GLSL = `
  uniform float uTime, uHeroT, uStreet, uDayIn, uLobby, uPent;
  uniform float uWarm[${NFL}]; uniform float uFlipT[${NFL}]; uniform float uStore[3]; uniform float uApt[12]; uniform vec3 uAptCol;
  float deskK(int f, float ci, float ri){
    float t0 = (f == 2 && ci == 2.0 && ri == 0.0) ? uHeroT : uFlipT[f] + 0.16 * ci + 0.1 * ri;
    return smoothstep(t0, t0 + 0.35, uTime);
  }
  vec3 interiorLight(vec3 p, vec3 n){
    vec3 L = vec3(0.0);
    float up = max(n.y, 0.0);
    if (abs(p.x) < 15.25 && p.z > -8.3 && p.z < 8.6 && p.y > -0.1 && p.y < 56.2) {
      int f = clamp(int(floor(p.y / 4.0)), 0, ${NFL - 1}); float yl = p.y - float(f) * 4.0;
      float w = uWarm[f];
      vec3 warm = vec3(1.0, 0.86, 0.68);
      if (f == 0) { w = uLobby; warm = vec3(1.0, 0.82, 0.6); }
      if (f == 13) { w = uPent; warm = vec3(1.0, 0.62, 0.26) * 1.3; }
      L += warm * w * (0.16 + 0.62 * up + 0.12 * yl / 4.0);
      if (f >= 1 && f <= 12) {
        float ci = clamp(floor((p.x + 11.5) / 5.0 + 0.5), 0.0, 4.0), ri = clamp(floor((3.0 - p.z) / 4.5 + 0.5), 0.0, 2.0);
        vec3 sp = vec3(-11.5 + ci * 5.0, float(f) * 4.0 + 1.13, 3.0 - ri * 4.5 - 0.22);
        vec3 d = sp - p; float dd = dot(d, d);
        float k = deskK(f, ci, ri);
        vec3 sc = mix(vec3(0.75, 0.85, 1.0) * 0.8, vec3(0.15, 0.85, 1.35) * 1.5, k);
        float face = (0.25 + 0.75 * max(dot(n, normalize(d)), 0.0)) * smoothstep(-0.05, 0.25, p.z - sp.z);
        L += sc * exp(-dd / 0.9) * face * 1.3;
        float fl = smoothstep(uFlipT[f], uFlipT[f] + 1.2, uTime);
        L += vec3(0.04, 0.32, 0.46) * fl * (0.3 + 0.2 * up);
      }
    } else if (p.x > -22.2 && p.x < 2.2 && p.z > 27.8 && p.z < 44.2 && p.y < 8.2) {
      int s = clamp(int(floor((p.x + 22.0) / 8.0)), 0, 2);
      L += vec3(1.0, 0.96, 0.88) * uStore[s] * (0.2 + 0.6 * up) + vec3(0.85, 0.92, 1.0) * uDayIn * (0.35 + 0.35 * up);
    } else if (p.x > 5.8 && p.x < 24.2 && p.z > 27.8 && p.z < 40.2 && p.y < 12.9) {
      int r = clamp(int(floor((p.x - 6.0) / 6.0)), 0, 2) + 3 * clamp(int(floor(p.y / 3.2)), 0, 3);
      L += uAptCol * uApt[r] * (0.2 + 0.5 * up + 0.15 * fract(p.y / 3.2));
    } else if (p.y < 7.5) {
      // street lamps: a warm pool under the nearest lamp on each pavement
      float px = ${POLE_DX.toFixed(1)} * floor(p.x / ${POLE_DX.toFixed(1)} + 0.5);
      for (int i = 0; i < 2; i++) {
        float pz = i == 0 ? ${POLE_Z[0].toFixed(2)} : ${POLE_Z[1].toFixed(2)};
        vec3 d = vec3(px, 6.4, pz + (i == 0 ? 1.4 : -1.4)) - p;
        float dd = dot(d, d);
        L += vec3(1.0, 0.7, 0.4) * uStreet * 5.0 / (5.0 + dd) * (0.35 + 0.65 * max(dot(n, normalize(d)), 0.0));
      }
    }
    return L;
  }`;
export function patchInterior(mat, IU, key) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    Object.assign(sh.uniforms, IU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vIW; varying vec3 vIN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        { vec4 q = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          q = instanceMatrix * q;
          #endif
          vIW = (modelMatrix * q).xyz;
          vec3 nn = objectNormal;
          #ifdef USE_INSTANCING
          nn = mat3(instanceMatrix) * nn;
          #endif
          vIN = normalize(mat3(modelMatrix) * nn); }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vIW; varying vec3 vIN;\n' + INTERIOR_GLSL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * interiorLight(vIW, normalize(vIN));');
  };
  const pk = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null;
  mat.customProgramCacheKey = () => (pk ? pk() : '') + '|interior|' + key;
  return mat;
}

// ------------------------------------------------------------------ helpers
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function ctex(cv) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
export function textTexture(lines, o = {}) {
  const w = o.w ?? 1024, h = o.h ?? 256, cv = canvas(w, h), c = cv.getContext('2d');
  if (o.bg) { c.fillStyle = o.bg; c.fillRect(0, 0, w, h); }
  if (o.border) { c.strokeStyle = o.fg ?? '#fff'; c.lineWidth = o.border; c.strokeRect(o.border, o.border, w - 2 * o.border, h - 2 * o.border); }
  c.fillStyle = o.fg ?? '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  lines.forEach(([txt, size, weight = 800, col], i) => { c.font = `${weight} ${size}px InterW, Inter, Helvetica, Arial, sans-serif`; if (col) c.fillStyle = col; c.fillText(txt, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15); c.fillStyle = o.fg ?? '#ffffff'; });
  return ctex(cv);
}
export const softDot = (inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)') => { const cv = canvas(64, 64), c = cv.getContext('2d'); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(0.25, mid); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return ctex(cv); };
// a batch of boxes in one instanced mesh, each with its own colour and transform
function boxBatch(mat, opt = {}) {
  const list = [];
  return {
    add(w, h, d, x, y, z, color = '#ffffff', ry = 0) { list.push({ w, h, d, x, y, z, color, ry }); },
    // one merged mesh with vertex colours (static, so no need for instancing; instanced batches drew stray shards in SwiftShader)
    build(parent) {
      const unit = (opt.round ? new RoundedBoxGeometry(1, 1, 1, 2, opt.round) : new THREE.BoxGeometry(1, 1, 1)).toNonIndexed();
      unit.deleteAttribute('uv');
      const M = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
      const parts = list.map((b) => {
        q.setFromAxisAngle(V(0, 1, 0), b.ry); M.compose(V(b.x, b.y, b.z), q, V(b.w, b.h, b.d));
        const g = unit.clone().applyMatrix4(M); c.set(b.color);
        const n = g.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
        g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
      });
      mat.vertexColors = true;
      const mesh = new THREE.Mesh(parts.length ? mergeGeometries(parts) : unit, mat);
      mesh.castShadow = opt.cast ?? true; mesh.receiveShadow = true;
      parent.add(mesh); return mesh;
    },
  };
}

// ------------------------------------------------------------------ screen textures: a person's work, and the AI's
function humanScreen() {
  const cv = canvas(512, 320), c = cv.getContext('2d');
  c.fillStyle = '#eef2f7'; c.fillRect(0, 0, 512, 320);
  c.fillStyle = '#2f6fd6'; c.fillRect(0, 0, 512, 34);
  c.fillStyle = '#ffffff'; c.font = '700 18px InterW, Arial'; c.fillText('Q3_report.xlsx', 14, 23);
  c.strokeStyle = '#c3ccd8'; c.lineWidth = 1.5;
  for (let y = 58; y < 320; y += 22) { c.beginPath(); c.moveTo(14, y); c.lineTo(498, y); c.stroke(); }
  for (let x = 14; x < 500; x += 80) { c.beginPath(); c.moveTo(x, 46); c.lineTo(x, 310); c.stroke(); }
  const r = new Rng(3); c.fillStyle = '#4a5568';
  for (let y = 52; y < 300; y += 22) for (let x = 20; x < 480; x += 80) if (r.chance(0.8)) c.fillRect(x, y - 2, r.float(20, 60), 8);
  c.fillStyle = '#2f6fd6'; c.fillRect(176, 140, 72, 20);
  return ctex(cv);
}
function aiScreen() {
  const cv = canvas(512, 320), c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, '#04121f'); g.addColorStop(1, '#020812'); c.fillStyle = g; c.fillRect(0, 0, 512, 320);
  const rg = c.createRadialGradient(256, 118, 0, 256, 118, 70); rg.addColorStop(0, 'rgba(160,250,255,1)'); rg.addColorStop(0.35, 'rgba(40,210,255,0.85)'); rg.addColorStop(1, 'rgba(0,120,255,0)');
  c.fillStyle = rg; c.beginPath(); c.arc(256, 118, 70, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(120,240,255,0.9)'; c.lineWidth = 3; c.beginPath(); c.arc(256, 118, 46, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#9ff4ff'; c.textAlign = 'center'; c.font = '800 30px InterW, Arial'; c.fillText("I'LL TAKE IT FROM HERE.", 256, 232);
  c.fillStyle = 'rgba(120,230,255,0.55)'; c.font = '700 15px InterW, Arial'; c.fillText('AI AGENT · RUNNING · 24/7', 256, 262);
  c.fillStyle = 'rgba(60,200,255,0.35)'; c.fillRect(106, 284, 300, 8); c.fillStyle = 'rgba(120,240,255,0.95)'; c.fillRect(106, 284, 236, 8);
  return ctex(cv);
}
function screenMaterial(IU, aTex = null) {
  return new THREE.ShaderMaterial({
    uniforms: { tH: { value: humanScreen() }, tA: { value: aTex ?? aiScreen() }, uTime: IU.uTime, uBright: { value: 1.6 } },
    vertexShader: `attribute float aT0; attribute float aSeed; uniform float uTime; varying vec2 vUv; varying float vK, vS;
      void main(){ vUv = uv; vK = clamp((uTime - aT0) / 0.35, 0.0, 1.0); vS = aSeed; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tH, tA; uniform float uTime, uBright; varying vec2 vUv; varying float vK, vS;
      void main(){
        vec3 h = texture2D(tH, vUv).rgb * 0.85, a = texture2D(tA, vUv).rgb;
        a *= 0.85 + 0.15 * sin(uTime * 3.0 + vS * 6.28);
        float isA = vK > 0.0 ? step(1.0 - vK, vUv.y) : 0.0;
        float line = (vK > 0.0 && vK < 1.0) ? exp(-pow((vUv.y - (1.0 - vK)) * 30.0, 2.0)) : 0.0;
        vec3 c = mix(h, a * 1.25, isA) * uBright + vec3(0.6, 1.0, 1.0) * line * 3.0;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ------------------------------------------------------------------ the tower
export function buildTower(st, IU, env, opts = {}) {
  const depts = opts.depts ?? DEPTS;
  const g = new THREE.Group(); st.tower = g;
  const std = (c, o = {}, key = c) => patchInterior(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o)), IU, key);
  const white = std('#8f8b84', {}, 'slab'), carpet = std('#3e444c', { roughness: 0.95 }, 'carpet'), wall = std('#a29e95', {}, 'wall');
  // slabs (the carpet on top), the back wall, the core with the lifts
  for (let f = 0; f <= NFL; f++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(HX * 2 + 0.5, 0.36, HZ * 2 + 0.4), white); s.position.set(0, f * FH - 0.18, 0); s.castShadow = s.receiveShadow = true; g.add(s);
    if (f >= 1 && f <= 12) { const c = new THREE.Mesh(new THREE.BoxGeometry(HX * 2 - 0.4, 0.02, HZ * 2 - 0.4), carpet); c.position.set(0, f * FH + 0.011, 0); c.receiveShadow = true; g.add(c); }
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(HX * 2 + 0.4, NFL * FH, 0.3), wall); back.position.set(0, NFL * FH / 2, -HZ - 0.15); back.receiveShadow = true; g.add(back);
  const core = new THREE.Mesh(new THREE.BoxGeometry(4, NFL * FH, 5.5), std('#b9b6ae', {}, 'core')); core.position.set(13, NFL * FH / 2, -5.25); core.castShadow = core.receiveShadow = true; g.add(core);
  // the side walls: glass, mullions, each floor's windows lit by its state (warm, cyan, dark)
  const facade = new THREE.MeshStandardMaterial({ color: '#27313c', roughness: 0.18, metalness: 0.6, envMap: env, envMapIntensity: 0.7 });
  facade.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, IU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vFW;\nuniform float uTime, uPent, uLobby; uniform float uWarm[${NFL}]; uniform float uFlipT[${NFL}];`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { int f = clamp(int(floor(vFW.y / 4.0)), 0, ${NFL - 1}); float yl = fract(vFW.y / 4.0);
          float u = abs(vFW.x) > 14.9 ? vFW.z : vFW.x;
          float mull = step(0.06, fract(u / 1.6)) * step(0.12, yl) * step(yl, 0.94);
          float fl = smoothstep(uFlipT[f], uFlipT[f] + 1.2, uTime);
          vec3 c = vec3(1.0, 0.8, 0.55) * uWarm[f] * 0.9 + vec3(0.1, 0.75, 1.1) * fl * 0.55;
          if (f == 13) c = vec3(1.0, 0.6, 0.22) * uPent * 1.4;
          if (f == 0) c = vec3(1.0, 0.8, 0.55) * uLobby;
          totalEmissiveRadiance += c * mull * 0.6; }`);
  };
  facade.customProgramCacheKey = () => 'tower-facade';
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.25, NFL * FH, HZ * 2 + 0.3), facade); w.position.set(sx * (HX + 0.12), NFL * FH / 2, 0); g.add(w); }
  const backOut = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2 + 0.5, NFL * FH), facade); backOut.position.set(0, NFL * FH / 2, -HZ - 0.31); backOut.rotation.y = Math.PI; g.add(backOut);
  // ceiling lights: one material per floor so each floor can switch off
  st.ceil = [];
  for (let f = 0; f < NFL; f++) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.45, 1.2), toneMapped: false });
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.05, 0.45), m, 24); let n = 0;
    const M = new THREE.Matrix4();
    for (const x of [-11, -5.5, 0, 5.5]) for (const z of [5, 1, -3, -6.5]) { if (n >= 24) break; M.makeTranslation(x, (f + 1) * FH - 0.4, z); im.setMatrixAt(n++, M); }
    im.count = n; g.add(im); st.ceil.push(m);
  }
  // furniture: desks, chairs, monitors, keyboards, plants (instanced, all lit by the floor they stand on)
  const furn = std('#ffffff', { roughness: 0.6 }, 'furn');
  const desks = boxBatch(furn), chairs = boxBatch(furn, { round: 0.04 }), mons = boxBatch(std('#1b1e23', { roughness: 0.4 }, 'mon'));
  const screens = [];
  for (let f = 1; f <= 12; f++) for (let ri = 0; ri < 3; ri++) for (let ci = 0; ci < 5; ci++) {
    const x = COLS[ci], z = ROWS[ri], y = f * FH;
    desks.add(1.5, 0.05, 0.85, x, y + 0.74, z, '#d8cbb4');
    desks.add(0.05, 0.72, 0.8, x - 0.7, y + 0.37, z, '#9a9a9a'); desks.add(0.05, 0.72, 0.8, x + 0.7, y + 0.37, z, '#9a9a9a');
    desks.add(1.5, 0.42, 0.04, x, y + 0.98, z - 0.43, '#5f6f7d');           // a low screen behind the desk
    desks.add(0.42, 0.02, 0.15, x + 0.05, y + 0.775, z + 0.12, '#2a2c30');   // keyboard
    chairs.add(0.5, 0.08, 0.48, x, y + 0.46, z + 0.8, '#2b2f36'); chairs.add(0.48, 0.55, 0.07, x, y + 0.78, z + 1.06, '#2b2f36'); chairs.add(0.06, 0.4, 0.06, x, y + 0.22, z + 0.8, '#777');
    mons.add(0.64, 0.4, 0.035, x, y + 1.13, z - 0.24); mons.add(0.06, 0.2, 0.06, x, y + 0.86, z - 0.26); mons.add(0.24, 0.02, 0.16, x, y + 0.76, z - 0.26);
    screens.push({ f, ci, ri, p: screenPos(f, ci, ri) });
  }
  // plants and printers by the windows, a water cooler
  const r = new Rng(31);
  for (let f = 1; f <= 12; f++) for (const x of [-14.2, 14.2 - 4.6]) { if (r.chance(0.7)) { desks.add(0.5, 0.45, 0.5, x, f * FH + 0.22, 6.6, '#7a5a3a'); chairs.add(0.7, 0.9, 0.7, x, f * FH + 0.9, 6.6, '#3f7a3f'); } }
  desks.build(g); chairs.build(g); mons.build(g);
  // the screens themselves
  const sm = screenMaterial(IU, opts.screenA ? opts.screenA() : null); st.screenMat = sm;
  const sIm = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.6, 0.36), sm, screens.length);
  const aT0 = new Float32Array(screens.length), aSeed = new Float32Array(screens.length);
  screens.forEach((s, i) => { const M = new THREE.Matrix4().makeTranslation(s.p.x, s.p.y, s.p.z - 0.0); sIm.setMatrixAt(i, M); aT0[i] = 1e4; aSeed[i] = r.next(); });
  sIm.geometry.setAttribute('aT0', new THREE.InstancedBufferAttribute(aT0, 1)); sIm.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  sIm.frustumCulled = false; g.add(sIm); st.screens = { im: sIm, list: screens, aT0 };
  // a department name on the back wall of each floor; lift doors and a green exit sign on the core
  st.signs = [];
  for (let f = 1; f <= 12; f++) {
    const tx = textTexture([[depts[f], 150, 800]], { w: 2048, h: 256, fg: '#2b3440' });
    const m = patchInterior(new THREE.MeshStandardMaterial({ map: tx, transparent: true, roughness: 0.7 }), IU, 'sign');
    const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.125), m); p.position.set(-3, f * FH + 2.75, -HZ + 0.02); g.add(p); st.signs.push(p);
  }
  const doorM = std('#8d949c', { metalness: 0.7, roughness: 0.35, envMap: env }, 'door');
  for (let f = 0; f < NFL; f++) for (const x of [12.1, 13.9]) { const d = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.05), doorM); d.position.set(x, f * FH + 1.25, -2.47); g.add(d); }
  const exitM = new THREE.MeshBasicMaterial({ map: textTexture([['EXIT', 160, 900]], { w: 512, h: 256, bg: '#0f8a3c', fg: '#e8ffe8' }), color: new THREE.Color(1.3, 1.3, 1.3), toneMapped: false });
  for (let f = 1; f <= 12; f++) { const e = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), exitM); e.position.set(13, f * FH + 3.1, -2.44); g.add(e); }
  // ---- the lobby: a glass front, a door, a reception desk and the sign on the glass
  const glassM = new THREE.MeshStandardMaterial({ color: '#9fb4c4', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.18, envMap: env, envMapIntensity: 1.0, depthWrite: false });
  const lob = new THREE.Mesh(new THREE.BoxGeometry(HX * 2, FH - 0.2, 0.06), glassM); lob.position.set(0, FH / 2 - 0.1, HZ + 0.05); g.add(lob);
  const mullM = std('#30353c', { metalness: 0.6, roughness: 0.4 }, 'mull');
  for (let x = -HX; x <= HX + 0.01; x += 2.5) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, FH, 0.12), mullM); m.position.set(x, FH / 2, HZ + 0.06); g.add(m); }
  const lb = boxBatch(furn);
  lb.add(5, 1.1, 1.0, 3, 0.55, 1, '#e9e2d4'); lb.add(5.2, 0.06, 1.2, 3, 1.13, 1, '#a88a62');
  for (const x of [-10, -7, 8, 11]) { lb.add(0.6, 0.5, 0.6, x, 0.25, 6.6, '#7a5a3a'); lb.add(0.9, 1.4, 0.9, x, 1.2, 6.6, '#3f7a3f'); }
  lb.add(3.2, 0.45, 1.0, -9, 0.22, 2, '#5a6470'); lb.add(3.2, 0.5, 0.25, -9, 0.6, 1.5, '#5a6470');
  lb.build(g);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.0), new THREE.MeshBasicMaterial({ map: textTexture([['OMNI CORP', 170, 800]], { w: 2048, h: 320, fg: '#e8edf5' }), transparent: true, color: new THREE.Color(1.4, 1.4, 1.4), toneMapped: false }));
  logo.position.set(3, 2.6, -HZ + 0.03); g.add(logo);
  // the hiring sign: a card on the glass that flips
  const hire = new THREE.Group(); hire.position.set(-3.2, 1.55, HZ + 0.12); g.add(hire); st.hire = hire;
  const hireA = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.05), new THREE.MeshStandardMaterial({ map: textTexture([['NOW', 170, 900, '#1a1a1a'], ['HIRING', 200, 900, '#1a1a1a'], ['APPLY INSIDE', 70, 800, '#1a1a1a']], { w: 1024, h: 720, bg: '#ffd23c', border: 18, fg: '#1a1a1a' }), emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.6 }));
  hireA.material.emissiveMap = hireA.material.map;
  const hireB = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.05), new THREE.MeshStandardMaterial({ map: textTexture([['NOT', 170, 900], ['HIRING', 200, 900], ['POSITIONS FILLED BY AI', 56, 800, '#7fe9ff']], { w: 1024, h: 720, bg: '#151a22', border: 18, fg: '#ffffff' }), emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 0.6 }));
  hireB.material.emissiveMap = hireB.material.map; hireB.rotation.y = Math.PI; hireB.position.z = -0.002;
  hire.add(hireA, hireB);
  // ---- the penthouse: gold light, a long desk, a sofa, a sculpture, glass at the edge
  const pb = boxBatch(std('#ffffff', { roughness: 0.45, metalness: 0.1 }, 'pent'));
  const PY = 13 * FH;
  pb.add(4.5, 0.08, 1.5, -6, PY + 0.76, -2, '#1d1a17'); pb.add(0.1, 0.74, 1.4, -8.1, PY + 0.37, -2, '#c9a14a'); pb.add(0.1, 0.74, 1.4, -3.9, PY + 0.37, -2, '#c9a14a');
  pb.add(5, 0.45, 1.3, 6, PY + 0.25, 0, '#e8e1d2'); pb.add(5, 0.6, 0.35, 6, PY + 0.65, -0.55, '#e8e1d2'); pb.add(1.2, 0.35, 1.2, 6, PY + 0.2, 2.2, '#c9a14a');
  pb.add(0.8, 2.2, 0.8, -12, PY + 1.1, -5, '#c9a14a'); pb.add(9, 0.02, 6, 0, PY + 0.015, 1, '#6b1f2a');
  pb.build(g);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(HX * 2, 1.1, 0.04), glassM); rail.position.set(0, PY + 0.55, HZ + 0.1); g.add(rail);
  // ---- the roof: parapet, a crown with the company's name, an aerial with a red light
  const roofM = std('#d9d6cf', {}, 'roof');
  const par = new THREE.Mesh(new THREE.BoxGeometry(HX * 2 + 0.6, 1.2, HZ * 2 + 0.6), roofM); par.position.set(0, NFL * FH + 0.6, 0); g.add(par);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 6), roofM); crown.position.set(-3, NFL * FH + 2.8, -3); g.add(crown);
  st.crownTx = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.4), new THREE.MeshBasicMaterial({ map: textTexture([['OMNI', 210, 900]], { w: 1024, h: 256, fg: '#ffffff' }), transparent: true, color: new THREE.Color(2.2, 2.2, 2.2), toneMapped: false }));
  st.crownTx.position.set(-3, NFL * FH + 2.8, 0.03); g.add(st.crownTx);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 14, 8), roofM); mast.position.set(9, NFL * FH + 7, -4); g.add(mast);
  st.beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: new THREE.Color(6, 0.4, 0.3), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  st.beacon.position.set(9, NFL * FH + 14.2, -4); st.beacon.scale.setScalar(2.2); g.add(st.beacon);
  return g;
}

// ------------------------------------------------------------------ the supermarket across the street
export function buildStore(st, IU, env, opts = {}) {
  const g = new THREE.Group(); st.store = g;
  const S = STORE, cx = (S.x0 + S.x1) / 2, cz = (S.z0 + S.z1) / 2, W = S.x1 - S.x0, D = S.z1 - S.z0;
  const std = (c, o = {}, key = c) => patchInterior(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o)), IU, key);
  const shell = std('#a8a59e', {}, 'storeshell');
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(W, 0.2, D), std('#cfcac0', {}, 'storefloor'), cx, 0.1, cz);
  add(new THREE.BoxGeometry(W + 0.4, 0.5, D + 0.4), shell, cx, S.h + 0.25, cz);
  add(new THREE.BoxGeometry(0.3, S.h, D), shell, S.x0, S.h / 2, cz); add(new THREE.BoxGeometry(0.3, S.h, D), shell, S.x1, S.h / 2, cz);
  add(new THREE.BoxGeometry(W, S.h, 0.3), shell, cx, S.h / 2, S.z1);
  add(new THREE.BoxGeometry(W + 0.4, 1.6, 0.4), std('#c8102e', {}, 'storeband'), cx, S.h - 0.6, S.z0);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.3), new THREE.MeshBasicMaterial({ map: textTexture([['MEGAMART', 200, 900]], { w: 2048, h: 256, fg: '#ffffff' }), transparent: true, color: new THREE.Color(1.8, 1.8, 1.8), toneMapped: false }));
  sign.position.set(cx, S.h - 0.6, S.z0 - 0.21); sign.rotation.y = Math.PI; g.add(sign);
  // the glass front, mullions
  const glassM = new THREE.MeshStandardMaterial({ color: '#9fb4c4', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.16, envMap: env, envMapIntensity: 1.0, depthWrite: false });
  const gl = new THREE.Mesh(new THREE.BoxGeometry(W, S.h - 1.4, 0.05), glassM); gl.position.set(cx, (S.h - 1.4) / 2, S.z0); g.add(gl);
  for (let x = S.x0; x <= S.x1 + 0.01; x += 3) add(new THREE.BoxGeometry(0.12, S.h - 1.4, 0.14), std('#30353c', { metalness: 0.6 }, 'mull2'), x, (S.h - 1.4) / 2, S.z0);
  // shelves running back from the window, stocked; robots work the aisles
  const sb = boxBatch(std('#ffffff', { roughness: 0.7 }, 'shelf'));
  const prods = [];
  const pr = new Rng(8), PC = ['#e63946', '#f1c40f', '#2a9d8f', '#e76f51', '#457b9d', '#8ecae6', '#ffb703', '#6a4c93', '#f4a261', '#90be6d'];
  for (const x of [-19, -14, -9, -4]) {
    sb.add(0.9, 2.2, 9, x, 1.1 + 0.2, 37.5, '#c8ccd2');
    for (let lvl = 0; lvl < 4; lvl++) for (let k = 0; k < 18; k++) for (const sx of [-1, 1]) {
      const h = pr.float(0.22, 0.36), b = [0.3, h, 0.42, x + sx * 0.6, 0.45 + lvl * 0.52 + h / 2, 33.4 + k * 0.48, pr.pick(PC)];
      if (opts.dynamicProducts) prods.push(b); else sb.add(...b);
    }
  }
  sb.add(2.4, 1.0, 0.9, -1.5, 0.7, 31.5, '#3b3f46'); sb.add(2.4, 1.0, 0.9, -1.5, 0.7, 33.8, '#3b3f46');     // tills
  sb.build(g);
  // products that can sell out one by one: an instanced mesh sized to the stock (never drawn past its buffer)
  if (opts.dynamicProducts) {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std('#ffffff', { roughness: 0.7 }, 'prod'), prods.length);
    const M = new THREE.Matrix4(), c = new THREE.Color();
    prods.forEach((b, i) => { M.compose(V(b[3], b[4], b[5]), new THREE.Quaternion(), V(b[0], b[1], b[2])); im.setMatrixAt(i, M); im.setColorAt(i, c.set(b[6])); });
    im.count = prods.length; im.castShadow = im.receiveShadow = true; im.frustumCulled = false; g.add(im);
    st.products = { im, list: prods };
  }
  // stacks of cartons by the window: they grow while nobody buys
  const cart = new THREE.InstancedMesh(new RoundedBoxGeometry(0.62, 0.46, 0.5, 2, 0.03), std('#b88a57', { roughness: 0.9 }, 'carton'), 256);   // = 8 levels x 8 stacks x 4: never draw past the buffer
  cart.castShadow = cart.receiveShadow = true; cart.frustumCulled = false; g.add(cart);
  st.cartons = { im: cart, slots: [] };
  const STACKS = [[-12.55, 29.6], [-10.45, 29.6], [-12.55, 30.8], [-10.45, 30.8], [-12.55, 32.0], [-10.45, 32.0], [-14.6, 29.6], [-8.4, 29.6]];
  for (let lvl = 0; lvl < 8; lvl++) for (const [bx, bz] of STACKS) for (let k = 0; k < 4; k++) st.cartons.slots.push({ x: bx + (k % 2) * 0.66 - 0.33, z: bz + Math.floor(k / 2) * 0.54 - 0.27, y: 0.2 + 0.23 + lvl * 0.47, r: (pr.next() - 0.5) * 0.12 });
  // sale posters on the glass: 50%, 70%, 90% off
  const posters = opts.posters ?? [[['SALE', 150], ['50% OFF', 190]], [['SALE', 150], ['70% OFF', 190]], [['EVERYTHING', 150], ['90% OFF', 190], '#ffd23c', '#141414']];
  st.sale = posters.map((P, i) => {
    const lines = P.filter((x) => Array.isArray(x)).map(([t, sz]) => [t, sz, 900]), bg = P.find((x) => typeof x === 'string') ?? '#e01e37', fg = P.filter((x) => typeof x === 'string')[1] ?? '#ffffff';
    const m = new THREE.MeshBasicMaterial({ map: textTexture(lines, { w: 1024, h: 768, bg, border: 20, fg }), color: new THREE.Color(1.15, 1.15, 1.15), toneMapped: false, side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.82), m); p.position.set(-11.5, 2.75, S.z0 - 0.06 - i * 0.01); p.rotation.y = Math.PI; p.visible = false; g.add(p); return p;
  });
  return g;
}

// ------------------------------------------------------------------ the block of flats, cut open
export const ROOMS = [];
export function buildFlats(st, IU, env) {
  const g = new THREE.Group(); st.flats = g;
  const A = APT, W = A.x1 - A.x0, D = A.z1 - A.z0, H = A.nf * A.fh;
  const std = (c, o = {}, key = c) => patchInterior(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o)), IU, key);
  const bb = boxBatch(std('#ffffff', { roughness: 0.75 }, 'flat'));
  const WALLS = ['#e8c9a0', '#a8c5d8', '#d9a5a5', '#b9d4a8', '#e3d5b8', '#c7b8e0', '#f0d78c', '#9fc9c0', '#e0b49a', '#b5c2d6', '#d4c4a8', '#c9d9b0'];
  for (let fl = 0; fl <= A.nf; fl++) bb.add(W + 0.4, 0.3, D + 0.4, (A.x0 + A.x1) / 2, fl * A.fh - 0.15, (A.z0 + A.z1) / 2, '#e9e6df');
  for (let fl = 0; fl < A.nf; fl++) for (let c = 0; c < 3; c++) {
    const r = fl * 3 + c, x0 = A.x0 + c * A.rw, xc = x0 + A.rw / 2, y = fl * A.fh;
    ROOMS[r] = { r, fl, c, x: xc, y, z: 31.5 };
    bb.add(A.rw, A.fh, 0.2, xc, y + A.fh / 2, A.z1 - 0.1, WALLS[r]);                 // back wall
    if (c < 2) bb.add(0.2, A.fh, D, x0 + A.rw, y + A.fh / 2, (A.z0 + A.z1) / 2, '#efeae0');
    bb.add(A.rw - 0.3, 0.02, D - 0.4, xc, y + 0.01, (A.z0 + A.z1) / 2, r % 2 ? '#a4784e' : '#8a6142');   // wooden floor
    // a window in the back wall: a pale pane
    bb.add(1.8, 1.2, 0.05, xc + 1.2, y + 1.7, A.z1 - 0.22, '#cfe3f2');
    // a lamp, a rug, a picture
    bb.add(1.0, 0.02, 0.8, xc + 1.1, y + 1.7 + 0.0, A.z1 - 0.23, '#cfe3f2');
    bb.add(2.6, 0.02, 1.8, xc, y + 0.03, 32, ['#c0392b', '#2e86c1', '#f4d03f', '#27ae60'][r % 4]);
    bb.add(0.9, 0.7, 0.05, xc - 1.6, y + 1.9, A.z1 - 0.22, ['#334', '#a63', '#357', '#6a4'][r % 4]);
  }
  bb.add(0.3, H, D, A.x0, H / 2, (A.z0 + A.z1) / 2, '#dcd6c8'); bb.add(0.3, H, D, A.x1, H / 2, (A.z0 + A.z1) / 2, '#dcd6c8');
  // furniture per room, matched to what each occupant does
  const P = {
    sofa: (x, y, z) => { bb.add(2.2, 0.45, 0.9, x, y + 0.25, z, '#5b6b8c'); bb.add(2.2, 0.55, 0.25, x, y + 0.65, z + 0.4, '#5b6b8c'); },
    easel: (x, y, z) => { bb.add(0.06, 1.7, 0.06, x - 0.35, y + 0.85, z, '#7a5a3a'); bb.add(0.06, 1.7, 0.06, x + 0.35, y + 0.85, z, '#7a5a3a'); bb.add(1.0, 0.8, 0.04, x, y + 1.3, z - 0.04, '#f6f1e6'); bb.add(0.6, 0.4, 0.045, x - 0.1, y + 1.35, z - 0.07, '#e07a5f'); bb.add(0.3, 0.3, 0.046, x + 0.2, y + 1.25, z - 0.075, '#3d85c6'); },
    counter: (x, y, z) => { bb.add(2.6, 0.9, 0.7, x, y + 0.45, z + 0.6, '#d8d2c4'); bb.add(0.4, 0.15, 0.4, x - 0.5, y + 0.98, z + 0.55, '#555'); bb.add(0.3, 0.25, 0.3, x + 0.4, y + 1.0, z + 0.55, '#c0392b'); },
    table: (x, y, z) => { bb.add(1.3, 0.05, 0.8, x, y + 0.74, z, '#a77a4a'); bb.add(0.08, 0.72, 0.7, x - 0.55, y + 0.36, z, '#7a5a3a'); bb.add(0.08, 0.72, 0.7, x + 0.55, y + 0.36, z, '#7a5a3a'); bb.add(0.42, 0.28, 0.02, x, y + 0.92, z - 0.15, '#20242a'); },
    piano: (x, y, z) => { bb.add(1.5, 1.2, 0.5, x, y + 0.6, z + 0.45, '#1b1b1d'); bb.add(1.3, 0.04, 0.25, x, y + 0.76, z + 0.1, '#f2f2f2'); },
    tv: (x, y, z) => { bb.add(1.6, 0.9, 0.05, x, y + 1.3, z, '#111'); bb.add(1.6, 0.5, 0.4, x, y + 0.25, z, '#6b4f36'); },
    plants: (x, y, z) => { for (let k = 0; k < 3; k++) { bb.add(0.4, 0.35, 0.4, x + k * 0.6 - 0.6, y + 0.18, z, '#a0522d'); bb.add(0.5, 0.7, 0.5, x + k * 0.6 - 0.6, y + 0.7, z, '#3f8a3f'); } },
  };
  const LAYOUT = [['easel', 0.6, 33.2], ['sofa', -1.0, 34.6], ['counter', 0.4, 34.2], ['sofa', 1.0, 35.4], ['table', 0.6, 33.0], ['tv', -0.8, 37.6],
    ['piano', 0.7, 34.0], ['plants', -0.2, 35.5], ['table', -0.6, 33.2], ['sofa', 0.2, 35.6], ['easel', -0.8, 33.4], ['counter', 0.0, 34.6]];
  ROOMS.forEach((R, i) => { const [k, dx, z] = LAYOUT[i]; P[k](R.x + dx, R.y, z); R.prop = k; R.px = R.x + dx; R.pz = z; });
  bb.build(g);
  // the roof edge, a water tank
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8, 0.8, D + 0.8), std('#d0cabd', {}, 'flatroof')); roof.position.set((A.x0 + A.x1) / 2, H + 0.4, (A.z0 + A.z1) / 2); g.add(roof);
  return g;
}

// ------------------------------------------------------------------ the street: ground, kerbs, lamps
export function buildStreet(st, IU) {
  const g = new THREE.Group(); st.street = g;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 160, 160).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({      // small tiles: one huge quad clips badly near the camera
    uniforms: { uStreet: IU.uStreet, uDay: { value: 0 }, uAmb: { value: new THREE.Color(0.05, 0.06, 0.09) }, uSun: { value: new THREE.Color(0, 0, 0) }, uFogC: { value: new THREE.Color() }, uFogD: { value: 0.004 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uStreet, uDay, uFogD; uniform vec3 uAmb, uSun, uFogC; varying vec3 vW;
      float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h1(i), h1(i+vec2(1,0)), f.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 p = vW.xz;
        // the city grid: avenues every 90 m along x, cross streets every 70 m; the main avenue at z 14..24
        float zr = p.y - 19.0, onMain = step(abs(zr), 5.0);
        float side = step(abs(zr), 9.4) * (1.0 - onMain);                                    // pavements
        vec2 gq = vec2(mod(p.x + 45.0, 90.0) - 45.0, mod(p.y - 19.0 + 35.0, 70.0) - 35.0);
        float road = max(onMain, max(step(abs(gq.x), 5.0), step(abs(gq.y), 5.0)) * (1.0 - step(abs(zr), 30.0) * step(abs(p.x), 46.0)));
        float walk = max(side, max(step(abs(gq.x), 9.0), step(abs(gq.y), 9.0)) * (1.0 - road) * (1.0 - step(abs(zr), 30.0) * step(abs(p.x), 46.0)));
        vec3 asph = vec3(0.13, 0.135, 0.145) * (0.85 + 0.3 * n2(p * 1.7));
        vec3 pave = vec3(0.42, 0.41, 0.39) * (0.88 + 0.12 * step(0.06, fract(p.x / 1.5)) * step(0.06, fract(p.y / 1.5)));
        vec3 lot = vec3(0.28, 0.3, 0.26) * (0.8 + 0.3 * n2(p * 0.2));
        vec3 c = mix(lot, pave, walk); c = mix(c, asph, road);
        // lane markings on the main avenue: a double yellow line, dashes, a kerb line
        float dash = step(0.5, fract(p.x / 6.0));
        c = mix(c, vec3(0.85, 0.7, 0.2), onMain * step(abs(abs(zr) - 0.18), 0.07));
        c = mix(c, vec3(0.85), onMain * dash * step(abs(abs(zr) - 2.5), 0.07));
        c = mix(c, vec3(0.6), step(abs(abs(zr) - 5.0), 0.12));
        // a zebra crossing in front of the tower
        c = mix(c, vec3(0.85), onMain * step(abs(p.x - 20.0), 2.0) * step(0.5, fract(p.y / 1.0)));
        // the lawn in front of the tower
        float lawn = step(abs(p.x), 14.0) * step(8.6, p.y) * step(p.y, 12.4);
        c = mix(c, vec3(0.16, 0.32, 0.12) * (0.8 + 0.4 * n2(p * 3.0)), lawn);
        vec3 col = c * (uAmb + uSun);
        // pools of lamplight
        float px = ${POLE_DX.toFixed(1)} * floor(p.x / ${POLE_DX.toFixed(1)} + 0.5);
        float l1 = 1.0 / (1.0 + dot(p - vec2(px, 13.0), p - vec2(px, 13.0)) * 0.08), l2 = 1.0 / (1.0 + dot(p - vec2(px, 25.0), p - vec2(px, 25.0)) * 0.08);
        col += c * vec3(1.0, 0.68, 0.38) * (l1 + l2) * 0.9 * uStreet;
        float fd = length(vW - cameraPosition) * uFogD; col = mix(col, uFogC, 1.0 - exp(-fd * fd));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  ground.receiveShadow = false; g.add(ground); st.groundU = ground.material.uniforms;
  // kerbs along the avenue
  const kerb = patchInterior(new THREE.MeshStandardMaterial({ color: '#8b8a86', roughness: 0.9 }), IU, 'kerb');
  for (const z of [14, 24]) { const k = new THREE.Mesh(new THREE.BoxGeometry(600, 0.15, 0.3, 60, 1, 1), kerb); k.position.set(0, 0.075, z); g.add(k); }
  // street lamps: poles with a warm head
  const poleM = patchInterior(new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.5, metalness: 0.6 }), IU, 'pole');
  const headM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.3), toneMapped: false }); st.lampHeadM = headM;
  const poleG = new THREE.CylinderGeometry(0.08, 0.12, 6.5, 8).translate(0, 3.25, 0);
  const armG = new THREE.BoxGeometry(0.08, 0.08, 1.6);
  const n = 30, pIm = new THREE.InstancedMesh(poleG, poleM, n * 2), aIm = new THREE.InstancedMesh(armG, poleM, n * 2), hIm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), headM, n * 2);
  const M = new THREE.Matrix4(); let k = 0;
  for (let i = -14; i < 16; i++) for (const [z, dz] of [[POLE_Z[0], 1], [POLE_Z[1], -1]]) {
    const x = i * POLE_DX; if (i === 0 && dz > 0) continue; M.makeTranslation(x, 0, z); pIm.setMatrixAt(k, M); M.makeTranslation(x, 6.45, z + dz * 0.75); aIm.setMatrixAt(k, M); M.makeTranslation(x, 6.38, z + dz * 1.4); hIm.setMatrixAt(k, M); k++;
  }
  for (const im of [pIm, aIm, hIm]) { im.count = k; im.castShadow = true; g.add(im); }
  const glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softDot('rgba(255,220,170,1)', 'rgba(255,170,90,0.35)'), color: new THREE.Color(1.6, 1.1, 0.6), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), n * 2);
  st.lampGlow = { im: glow, pts: [] };
  for (let i = -14; i < 16; i++) for (const [z, dz] of [[POLE_Z[0], 1], [POLE_Z[1], -1]]) if (!(i === 0 && dz > 0)) st.lampGlow.pts.push(V(i * POLE_DX, 6.25, z + dz * 1.4));
  glow.count = st.lampGlow.pts.length; glow.frustumCulled = false; g.add(glow);
  // trees in pits along the far pavement, benches on the lawn
  const tb = boxBatch(patchInterior(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), IU, 'trees'), { round: 0.3 });
  for (let i = -12; i < 14; i++) { const x = i * POLE_DX + 10; if (x > -40 && x < 40) continue; tb.add(0.3, 3, 0.3, x, 1.5, 26.8, '#5a4030'); tb.add(3.2, 2.8, 3.2, x, 4.2, 26.8, i % 3 ? '#3d6b35' : '#4f7a3a'); }
  for (const x of [-30, -50, 30, 50]) { tb.add(0.3, 3, 0.3, x, 1.5, 11.0, '#5a4030'); tb.add(3.2, 2.8, 3.2, x, 4.2, 11.0, '#3d6b35'); }
  tb.add(2.2, 0.1, 0.6, -8, 0.5, 12.0, '#8a6a48'); tb.add(2.2, 0.1, 0.6, 8, 0.5, 12.0, '#8a6a48');
  tb.build(g);
  return g;
}

// ------------------------------------------------------------------ the city round the block: towers whose windows turn cyan
export function buildCity(st, env) {
  const U = { uTime: { value: 0 }, uDay: { value: 0 }, uSpread: { value: new THREE.Vector2(9, 34) }, uAll: { value: 0 } };
  st.cityU = U;
  const m = new THREE.MeshStandardMaterial({ color: '#566577', roughness: 0.3, metalness: 0.5, envMap: env, envMapIntensity: 0.6 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; varying vec3 vC;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec4 wpp = instanceMatrix * vec4(transformed, 1.0); vWP = (modelMatrix * wpp).xyz; vWN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal); vC = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime, uDay, uAll; uniform vec2 uSpread; varying vec3 vWP; varying vec3 vWN; varying vec3 vC;\nfloat wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec2 q = abs(vWN.x) > 0.5 ? vWP.zy : vWP.xy; vec2 cell = floor(q / vec2(2.4, 3.4)); vec2 f = fract(q / vec2(2.4, 3.4));
          float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.2, f.y) * step(f.y, 0.8) * (1.0 - step(0.9, abs(vWN.y)));
          float hb = wh(floor(vC.xz));
          float tc = mix(uSpread.x, uSpread.y, clamp(length(vC.xz) / 900.0, 0.0, 1.0)) + hb * 4.0 - 2.0;
          float k = max(step(tc, uTime), uAll);
          float r = wh(cell + floor(vC.xz) * 3.1);
          vec3 warm = vec3(1.0, 0.72, 0.42) * step(0.62, r) * 1.4;
          vec3 cyan = vec3(0.12, 0.8, 1.25) * step(0.5, r) * 1.2;
          totalEmissiveRadiance += mix(warm, cyan, k) * win * (1.0 - 0.8 * uDay); }`);
  };
  m.customProgramCacheKey = () => 'city-windows';
  const r = new Rng(21), geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.02).translate(0, 0.5, 0);
  const im = new THREE.InstancedMesh(geo, m, 900); const M = new THREE.Matrix4(), c = new THREE.Color(); let n = 0;
  for (let bx = -14; bx <= 14; bx++) for (let bz = -10; bz <= 12; bz++) {
    const x0 = bx * 90, z0 = 19 + bz * 70;                       // block centred between streets
    for (const [ox, oz] of [[-22, -18], [22, -18], [-22, 18], [22, 18]]) {
      const x = x0 + ox, z = z0 + 35 + oz;
      if (Math.abs(x) < 52 && z > -30 && z < 68) continue;       // our block
      const d = Math.hypot(x, z - 19); if (d > 1100) continue;
      if (n >= 900) break;
      const near = Math.exp(-d / 350);
      const h = r.float(14, 40) + (r.chance(0.3) ? r.float(10, 70) : 0) * (0.5 + near) + (d > 250 && r.chance(0.08) ? r.float(40, 110) : 0);
      M.compose(V(x + r.float(-3, 3), 0, z + r.float(-3, 3)), new THREE.Quaternion(), V(r.float(22, 34), h, r.float(18, 30))); im.setMatrixAt(n, M);
      im.setColorAt(n, c.set(r.pick(['#5a6a7d', '#6e7f90', '#8a8f96', '#4c5866', '#9aa3ab', '#b9b2a3', '#7d7468']))); n++;
    }
  }
  im.count = n; im.receiveShadow = true; im.castShadow = false; st.city = im;
  return im;
}

// ------------------------------------------------------------------ the sky: a gradient dome with a sun glow and stars, driven per frame
export function buildSky(st) {
  const U = { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uSun: { value: V(0, 0.2, -1).normalize() }, uStars: { value: 1 }, uDisc: { value: 0 } };
  st.skyU = U;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 64, 32), new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',      // a plain sphere inside the far plane (xyww sat on it and got clipped at random)
    fragmentShader: `uniform vec3 uZen, uHor, uGlow, uSun; uniform float uStars, uDisc; varying vec3 vD;
      float h1(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vD); float h = max(d.y, 0.0);
        vec3 c = mix(uHor, uZen, pow(h, 0.45));
        float s = max(dot(d, normalize(uSun)), 0.0);
        c += uGlow * (pow(s, 6.0) * 0.8 + pow(s, 40.0) * 1.2) * (1.0 - 0.6 * h);
        c += uGlow * 30.0 * smoothstep(0.9993, 0.9997, s) * uDisc;
        vec3 q = floor(d * 420.0); float st = step(0.9975, h1(q)) * smoothstep(0.05, 0.3, d.y);
        c += vec3(0.9, 0.95, 1.0) * st * uStars * (0.4 + 0.6 * h1(q + 3.0));
        if (d.y < 0.0) c = uHor * 0.6;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -10;
  return sky;
}

// ------------------------------------------------------------------ small robots: delivery boxes on six wheels, lidar pucks, visors
export function buildRobotBits(st, IU) {
  const g = new THREE.Group();
  const body = patchInterior(new THREE.MeshStandardMaterial({ color: '#eef0f2', roughness: 0.45 }), IU, 'bot');
  const dark = patchInterior(new THREE.MeshStandardMaterial({ color: '#202327', roughness: 0.6 }), IU, 'botdark');
  const cyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.6, 3.4), toneMapped: false });
  const mk = (geo, mat, n) => { const im = new THREE.InstancedMesh(geo, mat, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; im.castShadow = mat !== cyan; g.add(im); return im; };
  st.bots = {
    body: mk(new RoundedBoxGeometry(0.62, 0.48, 0.78, 2, 0.08).translate(0, 0.42, 0), body, 12),
    wheels: mk(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12).rotateZ(Math.PI / 2), dark, 72),
    strip: mk(new THREE.BoxGeometry(0.5, 0.05, 0.02).translate(0, 0.52, 0.4), cyan, 12),
    flag: mk(new THREE.CylinderGeometry(0.01, 0.01, 1.0).translate(0.22, 1.1, -0.3), dark, 12),
    lidar: mk(new THREE.CylinderGeometry(0.22, 0.26, 0.22, 16).translate(0, 0.11, 0), dark, 30),
    ring: mk(new THREE.CylinderGeometry(0.265, 0.265, 0.05, 16, 1, true).translate(0, 0.12, 0), cyan, 30),
    visor: mk(new THREE.BoxGeometry(0.24, 0.06, 0.03), cyan, 60),
    carry: mk(new RoundedBoxGeometry(0.5, 0.36, 0.4, 2, 0.03), patchInterior(new THREE.MeshStandardMaterial({ color: '#b88a57', roughness: 0.9 }), IU, 'carry'), 200),
    tool: mk(new THREE.BoxGeometry(0.45, 0.22, 0.18), patchInterior(new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.5 }), IU, 'tool'), 4),
  };
  return g;
}

// ------------------------------------------------------------------ gold coins: the robot tax, flying from the tower to every flat
export function buildCoins(st, n = 360) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffcf4a', metalness: 0.9, roughness: 0.25, emissive: '#ffb020', emissiveIntensity: 1.6 });
  const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 18).rotateX(Math.PI / 2), m, n);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; st.coins = { im, n };
  return im;
}

// ------------------------------------------------------------------ the history stage: a dark floor and a spotlight
export function buildStage(st) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#06080c');
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 96).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uGlow: { value: new THREE.Color(0.1, 0.13, 0.2) } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uGlow; varying vec3 vW;
      void main(){ float r = length(vW.xz); vec2 g = abs(fract(vW.xz / 1.0) - 0.5);
        float line = smoothstep(0.47, 0.5, max(g.x, g.y)) * 0.25;
        vec3 c = uGlow * exp(-r * r / 90.0) * (1.0 + line * 2.0) + vec3(0.012, 0.014, 0.02);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  scene.add(floor);
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.55 }));
  shadowCatcher.position.y = 0.005; shadowCatcher.receiveShadow = true; scene.add(shadowCatcher);
  scene.add(new THREE.HemisphereLight('#9fb0d0', '#1a1612', 0.55));
  const key = new THREE.SpotLight('#fff1dc', 520, 80, 0.5, 0.6, 1.6); key.position.set(4, 26, 10); key.target.position.set(0, 0, -0.5);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.camera.near = 10; key.shadow.camera.far = 50;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#7fb7ff', 1.2); rim.position.set(-6, 8, -12); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.1, 300);
  return { scene, cam, key };
}
