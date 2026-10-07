// Effects: additive glow points, billboard particles (smoke, fire, dust),
// a point-light pool, and the cracked-screen SVG.
import * as THREE from 'three';
import { Rng } from './rng.js';

// ---------- additive glows (street lamps, flashes, fires, stars of light)
export class GlowLayer {
  constructor(capacity, opts = {}) {
    this.cap = capacity;
    this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 4); // rgb + size
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uFocal: { value: 1000 }, uFadeNear: { value: opts.fadeNear ?? 1500 }, uFadeFar: { value: opts.fadeFar ?? 6000 }, uCore: { value: opts.core ?? 0.35 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: opts.depthTest ?? true, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 aCol; uniform float uFocal, uFadeNear, uFadeFar; varying vec3 vC;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
          float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, -mv.z);
          vC = aCol.rgb * fade; gl_PointSize = min(aCol.a * uFocal / max(-mv.z, 0.1), 1400.0); }`,
      fragmentShader: `uniform float uCore; varying vec3 vC; void main(){ float d = length(gl_PointCoord-0.5)*2.0; if(d>1.0) discard;
          float a = pow(1.0-d, 2.2)*0.7 + smoothstep(uCore, 0.0, d)*0.8; gl_FragColor = vec4(vC*a, 1.0); }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.geo = g;
  }
  begin() { this.n = 0; }
  add(x, y, z, r, gg, b, size) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 4] = r; this.col[i * 4 + 1] = gg; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = size;
  }
  end(camera, H) {
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aCol.needsUpdate = true;
    this.uniforms.uFocal.value = (H / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  }
}

// ---------- billboard particles
export function makeSmokeTexture(seed = 1, opts = {}) {
  const r = new Rng(seed);
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  for (let i = 0; i < 22; i++) {
    const x = S / 2 + r.gauss() * S * 0.12, y = S / 2 + r.gauss() * S * 0.12, rad = S * r.float(0.12, 0.3);
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    const v = Math.round(r.float(200, 255));
    g.addColorStop(0, `rgba(${v},${v},${v},${opts.alpha ?? 0.35})`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeSoftTexture() {
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv); return t;
}

export class Particles {
  constructor(capacity, opts = {}) {
    this.cap = capacity;
    this.list = [];
    this.additive = !!opts.additive;
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    this.iPos = new Float32Array(capacity * 4); // xyz + size
    this.iCol = new Float32Array(capacity * 4); // rgb + alpha
    this.iRot = new Float32Array(capacity);
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.iPos, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(this.iCol, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iRot', new THREE.InstancedBufferAttribute(this.iRot, 1).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0;
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, uLight: { value: new THREE.Color(1, 1, 1) } }]);
    uniforms.map.value = opts.map;
    this.uniforms = uniforms;
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: !this.additive,
      blending: this.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `
        attribute vec4 iPos; attribute vec4 iCol; attribute float iRot;
        varying vec2 vUv; varying vec4 vCol;
        #include <common>
        #include <fog_pars_vertex>
        void main(){
          vUv = uv; vCol = iCol;
          vec4 mvPosition = modelViewMatrix * vec4(iPos.xyz, 1.0);
          float c = cos(iRot), s = sin(iRot);
          vec2 p = position.xy;
          mvPosition.xy += vec2(p.x*c - p.y*s, p.x*s + p.y*c) * iPos.w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform sampler2D map; uniform vec3 uLight;
        varying vec2 vUv; varying vec4 vCol;
        #include <common>
        #include <fog_pars_fragment>
        void main(){
          vec4 tx = texture2D(map, vUv);
          gl_FragColor = vec4(vCol.rgb * tx.rgb * uLight, tx.a * vCol.a);
          ${this.additive ? 'gl_FragColor.rgb *= gl_FragColor.a;' : ''}
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opts.renderOrder ?? 4;
    this.geo = g;
  }
  // p: {pos, vel, life, size:[a,b], color, alpha:[peak, fadeIn frac], rot, rotV, drag, grav, grow}
  spawn(p) {
    if (this.list.length >= this.cap) return;
    this.list.push(Object.assign({ age: 0, rot: 0, rotV: 0, drag: 0.4, grav: 0, alpha: 0.8, fadeIn: 0.12, size: [4, 14], color: new THREE.Color(1, 1, 1), vel: new THREE.Vector3() }, p));
  }
  step(dt, wind) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) { L[i] = L[L.length - 1]; L.pop(); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vel.multiplyScalar(k);
      if (wind) p.vel.addScaledVector(wind, (1 - k));
      p.vel.y -= p.grav * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.rot += p.rotV * dt;
    }
  }
  flush(camera) {
    const L = this.list;
    if (!this.additive) {
      const cp = camera.position;
      for (const p of L) p._d = p.pos.distanceToSquared(cp);
      L.sort((a, b) => b._d - a._d);
    }
    const n = Math.min(L.length, this.cap);
    for (let i = 0; i < n; i++) {
      const p = L[i], u = p.age / p.life;
      const a = p.alpha * Math.min(1, u / p.fadeIn) * Math.pow(1 - u, p.fadePow ?? 1.2);
      const size = p.size[0] + (p.size[1] - p.size[0]) * Math.pow(u, 0.6);
      this.iPos[i * 4] = p.pos.x; this.iPos[i * 4 + 1] = p.pos.y; this.iPos[i * 4 + 2] = p.pos.z; this.iPos[i * 4 + 3] = size;
      const c = p.colorAt ? p.colorAt(u) : p.color;
      this.iCol[i * 4] = c.r; this.iCol[i * 4 + 1] = c.g; this.iCol[i * 4 + 2] = c.b; this.iCol[i * 4 + 3] = a;
      this.iRot[i] = p.rot;
    }
    this.geo.instanceCount = n;
    this.geo.attributes.iPos.needsUpdate = true; this.geo.attributes.iCol.needsUpdate = true; this.geo.attributes.iRot.needsUpdate = true;
  }
}

// ---------- a fixed pool of point lights (constant count keeps shaders from recompiling)
export class LightPool {
  constructor(scene, n = 4, distance = 400) {
    this.lights = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, distance, 1.6);
      l.position.set(0, -1000, 0);
      scene.add(l); this.lights.push(l);
    }
  }
  reset() { for (const l of this.lights) l.intensity = 0; }
}

// ---------- cracked screen SVG
export function crackSVG(seed, cx = 540, cy = 760) {
  const r = new Rng(seed);
  const paths = [];
  const rays = 17;
  const rayPts = [];
  for (let i = 0; i < rays; i++) {
    const ang = (i / rays) * Math.PI * 2 + r.float(-0.15, 0.15);
    let x = cx, y = cy, a = ang;
    const pts = [[x, y]];
    const len = r.float(700, 1700);
    let d = 0;
    while (d < len) {
      const st = r.float(30, 90);
      a += r.float(-0.22, 0.22);
      x += Math.cos(a) * st; y += Math.sin(a) * st; d += st;
      pts.push([x, y]);
      if (r.chance(0.18)) {
        // branch
        let bx = x, by = y, ba = a + r.float(-0.9, 0.9);
        const bp = [[bx, by]];
        const bl = r.float(80, 320);
        for (let bd = 0; bd < bl;) { const s = r.float(25, 60); ba += r.float(-0.3, 0.3); bx += Math.cos(ba) * s; by += Math.sin(ba) * s; bd += s; bp.push([bx, by]); }
        paths.push({ d: toPath(bp), w: r.float(1, 2), len: bl });
      }
    }
    rayPts.push(pts);
    paths.push({ d: toPath(pts), w: r.float(1.6, 3.2), len });
  }
  // spider-web rings near the impact
  for (let ring = 1; ring <= 3; ring++) {
    for (let i = 0; i < rays; i++) {
      if (r.chance(0.35)) continue;
      const A = rayPts[i][Math.min(ring, rayPts[i].length - 1)], B = rayPts[(i + 1) % rays][Math.min(ring, rayPts[(i + 1) % rays].length - 1)];
      const mx = (A[0] + B[0]) / 2 + r.float(-8, 8), my = (A[1] + B[1]) / 2 + r.float(-8, 8);
      paths.push({ d: `M${A[0].toFixed(1)},${A[1].toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${B[0].toFixed(1)},${B[1].toFixed(1)}`, w: r.float(1, 2), len: 120, ring: true });
    }
  }
  // crushed glass at the impact point
  let dots = '';
  for (let i = 0; i < 70; i++) {
    const rad = Math.abs(r.gauss()) * 26, a = r.float(0, 6.28);
    dots += `<circle cx="${(cx + Math.cos(a) * rad).toFixed(1)}" cy="${(cy + Math.sin(a) * rad).toFixed(1)}" r="${r.float(0.8, 2.6).toFixed(1)}" fill="rgba(235,250,255,${r.float(0.4, 0.9).toFixed(2)})"/>`;
  }
  const glow = paths.map((p) => `<path d="${p.d}" stroke="rgba(200,240,255,0.35)" stroke-width="${(p.w * 3.5).toFixed(1)}" />`).join('');
  const lines = paths.map((p) => `<path d="${p.d}" stroke="rgba(240,252,255,0.92)" stroke-width="${p.w.toFixed(2)}" />`).join('');
  return `<defs><filter id="cb" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3"/></filter></defs><g filter="url(#cb)">${glow}</g><g>${lines}</g>${dots}`;
}
function toPath(pts) { return 'M' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L'); }
