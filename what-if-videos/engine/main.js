// Engine core. Loads a scenario, steps it at a fixed frame rate and draws
// the 3D scene plus the text overlay. render.mjs drives it frame by frame.
import * as THREE from 'three';
import { fbm1, clamp, smooth, mulberry32 } from './lib/rng.js';
import { crackSVG } from './lib/fx.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const params = new URLSearchParams(location.search);
const W = 1080, H = 1920;
const SCALE = parseFloat(params.get('scale') || '0.75');
// 'all' draws everything; 'scene' leaves out the text (title, HUD, captions, end card);
// 'text' draws only the text on a transparent page, to be composited over the scene later.
const LAYER = params.get('layer') || 'all';
const FPS = 30;

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(Math.round(W * SCALE), Math.round(H * SCALE), false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, W / H, 1, 40000);

const $ = (s) => document.querySelector(s);
const ui = {
  title: $('#title'), titleT: $('#title .t'),
  hud: $('#hud'), hudLabel: $('#hud .label'), hudValue: $('#hud .value'), hudSub: $('#hud .sub'),
  caption: $('#caption'), captionT: $('#caption span'),
  crack: $('#crack'), fade: $('#fade'), flash: $('#flash'), tint: $('#tint'), grain: $('#grain'), labels: $('#labels'),
  end: $('#end'),
};

const ctx = {
  THREE, scene, camera, renderer, W, H, FPS, SCALE,
  cam: { pos: new THREE.Vector3(0, 50, 100), look: new THREE.Vector3(0, 40, 0), fov: 56, roll: 0 },
  handheld: 1.0,      // gentle drift amount
  camScale: 1,        // world size of the drift/shake (1 = metres at street scale; 0.01 for a tabletop close-up)
  shake: 0,           // violent shake amount (0..1+)
  flash: 0, flashColor: '#ffffff',
  tint: null,         // { color, opacity, blend }
  vignette: 1,        // 0..1 strength of the edge darkening
  rain: null,         // { amount, angle, glass, tint } rain streaks + drops on the glass
  snow: 0,            // falling snow overlay amount
  grain: 0.075,       // film grain opacity
  grade: { brightness: 1, contrast: 1.04, saturate: 0.95, sepia: 0 },
  crack: 0,           // 0..1 crack progress
  view: null,         // { scene, camera } to draw instead of the main scene (cutaways)
  post: null,         // set by a scenario in setup: { ao: { radius, intensity }, bloom: { strength, radius, threshold } }
  bloom: null,        // per-frame bloom override { strength, radius, threshold }
  ao: null,           // per-frame AO blend 0..1
  onFrame: [],
  t: 0,
};
window.ctx = ctx;

if (LAYER === 'scene') { ui.title.parentElement.style.display = 'none'; ui.end.style.display = 'none'; }
if (LAYER === 'text') {
  for (const el of [canvas, ui.tint, ui.grain, ui.flash, ui.crack, ui.fade, document.getElementById('vignette'), document.getElementById('rain')]) el.style.display = 'none';
  for (const el of [document.documentElement, document.body, document.getElementById('stage')]) el.style.background = 'transparent';
}

let S = null, cur = -1, crackBuilt = false;
let brand = { handle: '@yourhandle', name: '' };

const vig = document.getElementById('vignette');
function setText(el, txt) { if (el.textContent !== txt) el.textContent = txt; }

function overlay(t) {
  // ---- title
  const tIn = S.titleIn ?? [0, 0.01], tOut = S.titleOut ?? [2.6, 3.5];
  const ta = smooth(tIn[0], tIn[1], t) * (1 - smooth(tOut[0], tOut[1], t));
  ui.title.style.opacity = ta.toFixed(3);
  setText(ui.titleT, S.title);

  // ---- HUD
  const h = S.hud ? S.hud(t, ctx) : null;
  if (h) {
    setText(ui.hudLabel, h.label || ''); setText(ui.hudValue, h.value || ''); setText(ui.hudSub, h.sub || '');
    ui.hud.style.opacity = (h.alpha ?? 1).toFixed(3);
  } else ui.hud.style.opacity = '0';

  // ---- captions
  let ca = 0, ct = '';
  for (const [a, b, txt] of S.captions) {
    if (t >= a - 0.01 && t <= b + 0.01) {
      ct = txt;
      ca = smooth(a, a + 0.4, t) * (1 - smooth(b - 0.4, b, t));
      break;
    }
  }
  setText(ui.captionT, ct);
  ui.caption.style.opacity = ca.toFixed(3);

  // ---- labels pinned to points on screen: [{ x, y, text, alpha, big, side }]
  const L = S.labels ? S.labels(t) : [];
  while (ui.labels.children.length < L.length) {
    const d = document.createElement('div'); d.className = 'lab';
    d.innerHTML = '<i class="dot"></i><i class="line"></i><span></span>';
    ui.labels.appendChild(d);
  }
  [...ui.labels.children].forEach((d, i) => {
    const l = L[i];
    if (!l || (l.alpha ?? 1) <= 0.001) { d.style.opacity = '0'; return; }
    d.style.opacity = (l.alpha ?? 1).toFixed(3);
    d.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px)`;
    d.className = 'lab' + (l.big ? ' big' : '') + (l.side === 'left' ? ' left' : '');
    setText(d.querySelector('span'), l.text);
  });

  // ---- cracked glass
  if (ctx.crack > 0) {
    if (!crackBuilt) { ui.crack.innerHTML = crackSVG(S.crackSeed ?? 5, S.crackAt?.[0] ?? 560, S.crackAt?.[1] ?? 760); crackBuilt = true; }
    ui.crack.style.opacity = Math.min(1, ctx.crack * 3).toFixed(3);
    const k = clamp(ctx.crack);
    ui.crack.style.clipPath = `circle(${(k * 2400).toFixed(0)}px at ${S.crackAt?.[0] ?? 560}px ${S.crackAt?.[1] ?? 760}px)`;
  } else ui.crack.style.opacity = '0';

  // ---- flash / tint / grading
  ui.flash.style.opacity = clamp(ctx.flash).toFixed(3);
  ui.flash.style.background = ctx.flashColor;
  if (ctx.tint) { ui.tint.style.background = ctx.tint.color; ui.tint.style.opacity = ctx.tint.opacity.toFixed(3); ui.tint.style.mixBlendMode = ctx.tint.blend || 'normal'; }
  else ui.tint.style.opacity = '0';
  vig.style.opacity = ctx.vignette.toFixed(3);
  const g = ctx.grade;
  canvas.style.filter = `brightness(${g.brightness}) contrast(${g.contrast}) saturate(${g.saturate}) sepia(${g.sepia || 0})`;

  // ---- fade to black + end card
  const fo = S.fadeOut ?? [S.duration - 12, S.duration - 10];
  ui.fade.style.opacity = smooth(fo[0], fo[1], t).toFixed(3);
  const e0 = S.endAt ?? fo[1] + 0.5;
  const ea = smooth(e0, e0 + 0.8, t);
  ui.end.style.opacity = ea.toFixed(3);
  if (ea > 0) {
    setText(ui.end.querySelector('.e-title'), S.title);
    ui.end.querySelector('.e-fact').innerHTML = S.endFact;
    setText(ui.end.querySelector('.e-brand'), brand.name || '');
    setText(ui.end.querySelector('.e-handle'), brand.handle || '');
    ui.end.querySelector('.e-fact').style.opacity = smooth(e0 + 0.9, e0 + 1.8, t).toFixed(3);
    for (const sel of ['.e-div', '.e-brand', '.orbit']) ui.end.querySelector(sel).style.opacity = smooth(e0 + 1.8, e0 + 2.6, t).toFixed(3);
    for (const sel of ['.e-handle', '.e-follow', '.e-ask']) ui.end.querySelector(sel).style.opacity = smooth(e0 + 2.6, e0 + 3.4, t).toFixed(3);
  }
  return { black: smooth(fo[0], fo[1], t) >= 0.999 || ea >= 0.999 };
}

const rainCv = document.getElementById('rain');
let rainWasOn = false;
function drawRain(frame, t) {
  const R = ctx.rain;
  const c = rainCv.getContext('2d');
  const SN = ctx.snow || 0;
  if ((!R || (R.amount <= 0.001 && (R.glass ?? 0) <= 0.001)) && SN <= 0.001) { if (rainWasOn) { c.clearRect(0, 0, W, H); rainWasOn = false; } return; }
  rainWasOn = true;
  c.clearRect(0, 0, W, H);
  if (SN > 0.001) {
    // snow: three depth layers drifting down, positions are a pure function of time
    const sr = mulberry32(4242);
    const n = Math.round(700 * SN);
    for (let i = 0; i < n; i++) {
      const layer = i % 3, z = [0.45, 0.75, 1.0][layer];
      const x0 = sr() * W, y0 = sr() * H, sp = (60 + sr() * 70) * z * 1.6, sway = sr() * 6.28;
      const y = (y0 + t * sp) % (H + 40) - 20;
      const x = (x0 + Math.sin(t * 0.7 + sway) * 26 * z + t * 18 * z) % W;
      const rad = (1.2 + sr() * 2.6) * z * (layer === 2 ? 1.6 : 1);
      c.fillStyle = `rgba(245,248,255,${(0.35 + 0.5 * z).toFixed(2)})`;
      c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
    }
  }
  if (!R || R.amount <= 0.001 && (R.glass ?? 0) <= 0.001) return;
  const rnd = mulberry32(frame * 104729 + 17);
  const ang = R.angle ?? 0.2, sx = Math.sin(ang), sy = Math.cos(ang);
  const tint = R.tint ?? '210,220,230';
  c.lineCap = 'round';
  // far streaks
  const nFar = Math.round(1100 * R.amount);
  c.lineWidth = 1.3;
  for (let i = 0; i < nFar; i++) {
    const x = rnd() * (W + 400) - 200, y = rnd() * (H + 200) - 100, L = 25 + rnd() * 70;
    c.strokeStyle = `rgba(${tint},${(0.08 + rnd() * 0.16).toFixed(3)})`;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + sx * L, y + sy * L); c.stroke();
  }
  // near, soft streaks
  const nNear = Math.round(90 * R.amount);
  for (let i = 0; i < nNear; i++) {
    const x = rnd() * (W + 600) - 300, y = rnd() * (H + 400) - 200, L = 160 + rnd() * 300;
    c.lineWidth = 2 + rnd() * 3;
    c.strokeStyle = `rgba(${tint},${(0.05 + rnd() * 0.09).toFixed(3)})`;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + sx * L, y + sy * L); c.stroke();
  }
  // drops on the glass: fixed seeds so they persist, some slide down
  const nDrops = Math.round(320 * (R.glass ?? 0));
  const dr = mulberry32(991);
  for (let i = 0; i < nDrops; i++) {
    const bx = dr() * W, by = dr() * H, rad = 2 + Math.pow(dr(), 3) * 11, slide = dr() < 0.25 ? 40 + dr() * 160 : 0, born = dr() * 30;
    const y = (by + slide * Math.max(0, t - born)) % (H + 40);
    const x = bx + Math.sin(y * 0.02 + i) * 3;
    const g = c.createRadialGradient(x - rad * 0.3, y - rad * 0.35, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.35, 'rgba(200,210,220,0.18)'); g.addColorStop(0.8, 'rgba(20,25,30,0.25)'); g.addColorStop(1, 'rgba(20,25,30,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rad * 0.85, rad, 0, 0, Math.PI * 2); c.fill();
    if (slide) { c.strokeStyle = 'rgba(210,220,230,0.10)'; c.lineWidth = rad * 0.6; c.beginPath(); c.moveTo(x, y - rad); c.lineTo(x - 2, y - rad - Math.min(260, slide * 0.8)); c.stroke(); }
  }
}

function grain(frame) {
  const c = ui.grain.getContext('2d');
  const img = c.createImageData(270, 480);
  const rnd = mulberry32(frame * 7919 + 1);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rnd() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
}

function applyCamera(t) {
  const c = ctx.cam;
  camera.fov = c.fov; camera.near = c.near ?? 1; camera.far = c.far ?? 40000; camera.updateProjectionMatrix();
  camera.position.copy(c.pos);
  const hh = ctx.handheld, sh = ctx.shake, k = ctx.camScale ?? 1;
  camera.position.x += (fbm1(t * 0.31 + 3.1) * 0.25 * hh + fbm1(t * 9.0 + 1.3) * 0.9 * sh) * k;
  camera.position.y += (fbm1(t * 0.27 + 7.7) * 0.18 * hh + fbm1(t * 10.0 + 4.1) * 0.7 * sh) * k;
  camera.position.z += fbm1(t * 8.0 + 9.4) * 0.5 * sh * k;
  camera.lookAt(c.look);
  camera.rotateZ((c.roll || 0) + fbm1(t * 0.2 + 2.2) * 0.004 * hh + fbm1(t * 11.0 + 6.6) * 0.02 * sh);
  camera.rotateX(fbm1(t * 0.23 + 5.5) * 0.004 * hh + fbm1(t * 12.0 + 8.8) * 0.015 * sh);
  camera.rotateY(fbm1(t * 0.19 + 4.4) * 0.005 * hh + fbm1(t * 10.5 + 2.9) * 0.015 * sh);
  camera.updateMatrixWorld();
}

// ---- post-processing: ambient occlusion + bloom, then tone mapping in the output pass
// AO's depth/normal pre-pass must skip sky domes, sprites, water and particles (anything marked noAO),
// so the sky keeps depth 1 and gets no occlusion.
GTAOPass.prototype.overrideVisibility = function () {
  const cache = this._visibilityCache;
  this.scene.traverse((o) => {
    cache.set(o, o.visible);
    if (o.isPoints || o.isLine || o.isSprite || o.userData.noAO) o.visible = false;
  });
};
let composer = null;
const passes = {};
function setupPost(cfg) {
  const w = canvas.width, h = canvas.height;
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: cfg.msaa ?? 0 });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1); composer.setSize(w, h);
  passes.render = new RenderPass(scene, camera);
  composer.addPass(passes.render);
  if (cfg.ao) {
    passes.ao = new GTAOPass(scene, camera, w, h, { samples: cfg.ao.samples ?? 12 });
    passes.ao.updateGtaoMaterial({ radius: cfg.ao.radius ?? 0.6, distanceExponent: 1, thickness: 1, scale: 1, samples: cfg.ao.samples ?? 12 });
    passes.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    passes.ao.blendIntensity = cfg.ao.intensity ?? 1;
    composer.addPass(passes.ao);
  }
  if (cfg.bloom) {
    passes.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), cfg.bloom.strength ?? 0.6, cfg.bloom.radius ?? 0.5, cfg.bloom.threshold ?? 0.85);
    composer.addPass(passes.bloom);
  }
  passes.out = new OutputPass();
  composer.addPass(passes.out);
  if (cfg.env) {
    // soft sky-gradient environment: ambient fill and gentle reflections, no hard light panels
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0.0 ? mix(vec3(0.72,0.78,0.85), vec3(0.88,0.92,0.98), pow(h, 0.6)) : mix(vec3(0.72,0.78,0.85), vec3(0.42,0.40,0.37), pow(-h, 0.5)); gl_FragColor = vec4(c, 1.0); }',
    })));
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, 0).texture;
    scene.environmentIntensity = cfg.env;
  }
}
function drawScene() {
  const sc = ctx.view?.scene ?? scene, cam = ctx.view?.camera ?? camera;
  if (!composer) { renderer.render(sc, cam); return; }
  passes.render.scene = sc; passes.render.camera = cam;
  if (passes.ao) {
    passes.ao.scene = sc; passes.ao.camera = cam;
    passes.ao.enabled = !ctx.view && (ctx.ao ?? 1) > 0;
    passes.ao.blendIntensity = ctx.ao ?? (ctx.post.ao.intensity ?? 1);
  }
  if (passes.bloom) {
    const b = Object.assign({}, ctx.post.bloom, ctx.bloom || {});
    passes.bloom.strength = b.strength; passes.bloom.radius = b.radius; passes.bloom.threshold = b.threshold;
  }
  composer.render();
}

function step(frame) {
  const t = frame / FPS;
  ctx.t = t;
  S.update(ctx, t, frame === 0 ? 0 : 1 / FPS);
}

window.WI = {
  async init(id) {
    try { brand = Object.assign(brand, await (await fetch('/brand.json')).json()); } catch (e) { /* defaults */ }
    S = (await import(`/scenarios/${id}.js`)).default;
    await document.fonts.load('400 64px Garamond'); await document.fonts.load('italic 400 49px Garamond');
    await document.fonts.load('500 62px Garamond'); await document.fonts.load('600 21px InterW'); await document.fonts.load('700 38px InterW');
    // end-card star dust
    const st = document.querySelector('#end .stars'), rr = mulberry32(42);
    for (let i = 0; i < 140; i++) { const s = document.createElement('i'); s.style.left = (rr() * 1080).toFixed(0) + 'px'; s.style.top = (rr() * 1920).toFixed(0) + 'px'; s.style.opacity = (0.15 + rr() * 0.6).toFixed(2); const z = 1 + rr() * 2.5; s.style.width = s.style.height = z.toFixed(1) + 'px'; st.appendChild(s); }
    await S.setup(ctx);
    if (ctx.post && LAYER !== 'text') setupPost(ctx.post);
    cur = -1;
    return { frames: Math.round(S.duration * FPS), fps: FPS, duration: S.duration, id: S.id, title: S.title, audio: S.audio || [] };
  },
  // Advance the simulation to `frame` (must not go backwards), then draw it.
  goto(frame, draw = true) {
    if (LAYER === 'text') {
      // text depends only on time: no simulation, no 3D
      if (!draw) return null;
      const t = frame / FPS;
      overlay(t);
      return { t };
    }
    if (frame < cur) throw new Error('cannot rewind');
    while (cur < frame) { cur++; step(cur); }
    if (!draw) return null;
    const t = frame / FPS;
    applyCamera(t);
    for (const f of ctx.onFrame) f(t);
    const o = overlay(t);
    ui.grain.style.opacity = ctx.grain.toFixed(3);
    if (ctx.grain > 0) grain(frame);
    drawRain(frame, t);
    if (!o.black) drawScene();
    return { t };
  },
};
window.dispatchEvent(new Event('wi-ready'));
window.WI_READY = true;
