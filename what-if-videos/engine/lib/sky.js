// Sky dome with sun glow, star field, procedural clouds and a moon.
import * as THREE from 'three';
import { Rng } from './rng.js';

export function buildSky(opts = {}) {
  const o = Object.assign({ radius: 16000, seed: 3, clouds: 26, cloudAlt: [700, 1500], stars: 2200 }, opts);
  const group = new THREE.Group();
  const uniforms = {
    uZenith: { value: new THREE.Color('#5d86b8') },
    uHorizon: { value: new THREE.Color('#c9d6e2') },
    uBelow: { value: new THREE.Color('#9aa7b2') },
    uSunDir: { value: new THREE.Vector3(0.3, 0.35, -0.9).normalize() },
    uSunColor: { value: new THREE.Color('#fff2d8') },
    uSunGlow: { value: 0.6 },
    uSunSize: { value: 0.9994 },
    uSunDisk: { value: 1.0 },
    uHorizonPow: { value: 0.55 },
    uGlowExp: { value: 8.0 },
    uGlowTint: { value: new THREE.Color('#000000') }, // extra additive tint (aurora wash, fire glow)
    uGlowDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uZenith, uHorizon, uBelow, uSunColor, uGlowTint, uSunDir, uGlowDir;
      uniform float uSunGlow, uSunSize, uSunDisk, uHorizonPow, uGlowExp;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(uHorizon, uZenith, pow(clamp(h,0.0,1.0), uHorizonPow)) : mix(uHorizon, uBelow, clamp(-h*6.0,0.0,1.0));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(s, uGlowExp)*0.35 + pow(s, 64.0)*0.6) * uSunGlow;
        col += uSunColor * smoothstep(uSunSize, uSunSize + 0.0003, s) * 6.0 * uSunDisk;
        float g = max(dot(d, uGlowDir), 0.0);
        col += uGlowTint * (pow(g, 3.0) * 0.8 + 0.2) * smoothstep(-0.05, 0.25, h + 0.05);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(o.radius, 48, 24), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  // stars
  const r = new Rng(o.seed);
  const sp = [], sb = [];
  for (let i = 0; i < o.stars; i++) {
    const u = r.float(0.02, 1), th = r.float(0, Math.PI * 2);
    const y = Math.pow(u, 0.8), rr = Math.sqrt(1 - y * y);
    sp.push(Math.cos(th) * rr * o.radius * 0.95, y * o.radius * 0.95, Math.sin(th) * rr * o.radius * 0.95);
    sb.push(Math.pow(r.next(), 3) * 0.9 + 0.1, r.float(0, 100));
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sg.setAttribute('aB', new THREE.Float32BufferAttribute(sb, 2));
  const starU = { uStars: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 } };
  const starMat = new THREE.ShaderMaterial({
    uniforms: starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `attribute vec2 aB; uniform float uTime, uPx; varying float vB; void main(){ vB = aB.x*(0.75+0.25*sin(uTime*2.3+aB.y)); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; gl_PointSize = (1.6 + aB.x*3.0)*uPx; }`,
    fragmentShader: `uniform float uStars; varying float vB; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(vec3(0.85,0.9,1.0)*vB*a*uStars, 1.0); }`,
  });
  const stars = new THREE.Points(sg, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  group.add(stars);

  // clouds: billboards with painted textures
  const cloudTex = [0, 1, 2, 3].map((k) => makeCloudTexture(o.seed * 10 + k));
  const clouds = [];
  const cloudGroup = new THREE.Group();
  for (let i = 0; i < o.clouds; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTex[i % 4], transparent: true, depthWrite: false, fog: false, color: 0xffffff, opacity: 0.9 });
    const s = new THREE.Sprite(m);
    const ang = r.float(-1.2, 1.2) - Math.PI / 2, dist = r.float(2500, 9000);
    const alt = r.float(o.cloudAlt[0], o.cloudAlt[1]) * (dist / 4000);
    s.position.set(Math.cos(ang) * dist, alt, Math.sin(ang) * dist);
    const sc = r.float(900, 2200) * (dist / 4000);
    s.scale.set(sc, sc * r.float(0.35, 0.5), 1);
    s.userData = { base: s.position.clone(), speed: r.float(0.6, 1.4) };
    s.renderOrder = -8;
    clouds.push(s); cloudGroup.add(s);
  }
  group.add(cloudGroup);

  // moon
  const moonMat = new THREE.SpriteMaterial({ map: makeMoonTexture(o.seed), transparent: true, depthWrite: false, fog: false });
  const moon = new THREE.Sprite(moonMat);
  moon.visible = false;
  moon.renderOrder = -8;
  group.add(moon);

  const sky = {
    group, uniforms, stars, starU, clouds, cloudGroup, moon,
    setMoon(dir, size = 260, dist = 12000) { moon.visible = true; moon.position.copy(dir).normalize().multiplyScalar(dist); moon.scale.set(size, size, 1); },
    update(t, camera) {
      group.position.copy(camera.position);
      starU.uTime.value = t;
      for (const c of clouds) c.position.x = c.userData.base.x + t * 6 * c.userData.speed * (sky.windScale ?? 1);
    },
    cloudTint(color, opacity = 0.9) { for (const c of clouds) { c.material.color.copy(color); c.material.opacity = opacity; } },
  };
  return sky;
}

export function makeCloudTexture(seed) {
  const r = new Rng(seed);
  const S = 256, cv = document.createElement('canvas'); cv.width = S; cv.height = S / 2;
  const c = cv.getContext('2d');
  const blobs = 34;
  for (let pass = 0; pass < 2; pass++) {
    const r2 = new Rng(seed);
    for (let i = 0; i < blobs; i++) {
      const x = S * (0.15 + 0.7 * r2.next()), y = S / 2 * (0.35 + 0.35 * r2.next()), rad = S * (0.06 + 0.1 * r2.next());
      const g = c.createRadialGradient(x, y - (pass ? rad * 0.25 : 0), 0, x, y, rad);
      if (pass === 0) { g.addColorStop(0, 'rgba(170,176,190,0.55)'); g.addColorStop(1, 'rgba(170,176,190,0)'); }
      else { g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(250,250,252,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
      c.fillStyle = g; c.beginPath(); c.arc(x, y - (pass ? rad * 0.3 : 0), rad, 0, Math.PI * 2); c.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makeMoonTexture(seed) {
  const r = new Rng(seed + 99);
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(220,225,235,0.25)'); g.addColorStop(1, 'rgba(220,225,235,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  c.save(); c.beginPath(); c.arc(S / 2, S / 2, S * 0.3, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#e9e7df'; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) {
    c.fillStyle = `rgba(150,150,145,${r.float(0.15, 0.45)})`;
    c.beginPath(); c.arc(r.float(S * 0.2, S * 0.8), r.float(S * 0.2, S * 0.8), r.float(3, 22), 0, Math.PI * 2); c.fill();
  }
  c.restore();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
