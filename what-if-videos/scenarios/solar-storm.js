// What if a solar superstorm hit tonight?
import * as THREE from 'three';
import { buildCity } from '../engine/lib/city.js';
import { buildSky } from '../engine/lib/sky.js';
import { buildWater } from '../engine/lib/water.js';
import { buildTrees, buildCars, buildPeople, streetLightSpots, buildPoles, buildBalcony } from '../engine/lib/props.js';
import { GlowLayer, Particles, LightPool, makeSmokeTexture, makeSoftTexture } from '../engine/lib/fx.js';
import { Rng, keys, smooth, clamp, fbm1, lerp, easeInOut } from '../engine/lib/rng.js';

const COAST = -1020; // shoreline z (water is further north / more negative)
const coastZ = (x) => COAST + Math.sin(x * 0.004) * 60 + Math.sin(x * 0.011 + 1) * 25;
const land = (x, z) => (z < coastZ(x) - 40 ? 'water' : z < coastZ(x) ? 'beach' : 'land');

// Transformer blowouts: time, position, and the radius of the district that goes dark.
const BLASTS = [
  { t: 39.0, x: -520, z: -760, r: 260, big: 0.7 },
  { t: 41.6, x: 430, z: -620, r: 240, big: 0.7 },
  { t: 43.4, x: -150, z: -900, r: 230, big: 0.8 },
  { t: 44.6, x: 640, z: -260, r: 260, big: 0.8 },
  { t: 46.3, x: -330, z: -420, r: 240, big: 0.9 },
  { t: 47.7, x: 160, z: -480, r: 220, big: 0.9 },
  { t: 49.2, x: -700, z: -200, r: 250, big: 0.9 },
  { t: 50.6, x: 330, z: -140, r: 230, big: 1.0 },
  { t: 51.9, x: -60, z: -620, r: 220, big: 1.0 },
  { t: 57.3, x: 70, z: -40, r: 9999, big: 1.6 },
];
const WAVE = [53.0, 57.0]; // remaining lights go out from far to near
const DARK = 57.5;         // our building goes dark
const OUR_H = 168;        // the balcony we stand on
const BAL_Z = 150;        // balcony back wall z

const fmt = (n) => Math.round(n).toLocaleString('en-US');

export default {
  id: 'solar-storm',
  title: 'What if a solar superstorm hit tonight?',
  endFact: 'In 1859, a storm like this set telegraph paper on fire.<br>In 2012, one just as strong missed Earth by about a week.',
  duration: 80,
  fadeOut: [67.6, 69.6],
  endAt: 70.2,
  crackAt: [560, 760],

  captions: [
    [3.6, 7.0, 'Just a normal night in the city.'],
    [7.3, 11.0, 'But 17 hours ago, the Sun erupted.'],
    [11.3, 15.0, 'A billion tons of plasma is coming.'],
    [15.4, 19.0, 'It slams into Earth’s magnetic field.'],
    [19.4, 22.4, 'You can’t feel it.'],
    [22.7, 25.8, 'But you can see it.'],
    [26.1, 29.6, 'The sky turns green, then red.'],
    [29.9, 33.4, 'Even the tropics can see it.'],
    [33.7, 37.3, 'It is also pushing current into the grid.'],
    [37.6, 41.0, 'The grid was never built for this.'],
    [41.3, 44.8, 'Transformers start to explode.'],
    [45.1, 49.0, 'In 1989, a smaller storm blacked out Quebec in 90 seconds.'],
    [49.3, 52.6, 'Tonight’s storm is far bigger.'],
    [52.9, 56.6, 'One district at a time, the lights go out.'],
    [57.4, 60.4, 'Then all of it.'],
    [60.7, 64.0, 'No phones. No pumps. No internet.'],
    [64.3, 67.6, 'And the sky has never looked so beautiful.'],
  ],

  hud(t, ctx) {
    const st = ctx.state;
    if (t < 17) {
      const d = 2_600_000 * (1 - t / 17);
      return { label: 'Solar storm', value: `${fmt(d)} km`, sub: `2,400 km/s · arrives in ${Math.ceil(18 * (1 - t / 17))} min` };
    }
    if (t < 19.2) return { label: 'Solar storm', value: 'NOW', sub: 'hitting earth’s magnetic field' };
    if (t < 33.5) {
      const lat = keys(t, [[19.2, 67], [24, 52], [30, 24], [33, 18]], easeInOut);
      return { label: 'Aurora reaches', value: `${Math.round(lat)}° N`, sub: lat < 26 ? 'as far south as the caribbean' : 'normally only near the poles' };
    }
    if (t < 38.5) {
      const load = keys(t, [[33.5, 100], [38.5, 240]], (x) => x * x);
      return { label: 'Grid load', value: `${Math.round(load)}%`, sub: 'induced current in the lines' };
    }
    if (t < 61) {
      const lost = st.lost, power = Math.round(st.power * 100);
      return { label: 'City power', value: `${power}%`, sub: `transformers lost: ${lost}` };
    }
    return { label: 'The grid', value: 'OFFLINE', sub: 'repairs: months to years' };
  },

  audio: [
    { type: 'ambience', kind: 'night-city', t0: 0, t1: 57.6, level: 0.55 },
    { type: 'ambience', kind: 'night-quiet', t0: 57.4, t1: 69.5, level: 0.5 },
    { type: 'drone', t0: 0, t1: 69.5, root: 49, level: 0.35, swell: [[0, 0.3], [15, 0.5], [22, 0.7], [33, 0.6], [45, 0.9], [57.5, 1.0], [60, 0.55], [69.5, 0]] },
    { type: 'boom', t: 17.0, level: 0.7, low: true },
    { type: 'shimmer', t0: 21.5, t1: 69.5, level: 0.32, swell: [[21.5, 0], [27, 1], [37, 0.7], [58, 1], [69.5, 0]] },
    { type: 'flicker', t0: 35.5, t1: 38.5, level: 0.25 },
    // sound arrives late: ~3 s per kilometre between the blast and our balcony
    ...BLASTS.map((b) => { const d = Math.hypot(b.x, b.z - BAL_Z, OUR_H); return { type: 'zap', t: b.t, delay: d / 343, pan: Math.max(-0.9, Math.min(0.9, b.x / 700)), level: Math.min(1, 0.35 + b.big * 0.4), dist: d > 400 ? 1 : 0.1 }; }),
    { type: 'powerdown', t: DARK, level: 0.6 },
    { type: 'chime', t: 70.4, level: 0.5 },
  ],

  async setup(ctx) {
    const { scene, renderer } = ctx;
    const r = new Rng(1859);
    scene.fog = new THREE.Fog('#171d30', 300, 3800);
    renderer.toneMappingExposure = 1.15;

    // ---- city
    const city = buildCity({
      seed: 18, x0: -1000, x1: 1000, z0: -1080, z1: 380,
      land,
      isPark: (i, j, cx, cz) => (i === 9 && j === 5) || (i === 3 && j === 9) || (i === 14 && j === 2),
      height: (x, z, rr) => {
        const dc = Math.hypot(x - 60, z + 560);
        const core = Math.exp(-dc * dc / (2 * 300 * 300));
        const shore = smooth(COAST + 260, COAST + 60, z);
        const near = smooth(-260, 120, z);           // keep the foreground low so we can see over it
        let h = 12 + rr.float(0, 20) + core * rr.float(40, 200) * (rr.chance(0.7) ? 1 : 0.3);
        h *= (1 - shore * 0.45) * (1 - near * 0.55);
        return h;
      },
      clear: (x, z) => Math.abs(x) < 30 && z > 40,
      texSize: 4096,
    });
    scene.add(city.group);
    const fac = city.facade.userData.uniforms;
    fac.uNight.value = 1.25; fac.uLit.value = 0.5; fac.uWallMul.value = 0.42;
    fac.uGlassSky.value.set('#2a3550'); fac.uGlassDark.value.set('#0b0f17'); fac.uRoof.value.set('#3a3a3c');

    // the tower we stand on
    const ourH = OUR_H;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(34, ourH, 26), new THREE.MeshStandardMaterial({ color: '#6d6a66', roughness: 0.9 }));
    tower.position.set(0, ourH / 2, 160); scene.add(tower);

    // blackout timing per building
    city.setOffTimes((b) => {
      let off = 1e6;
      for (const bl of BLASTS) {
        const d = Math.hypot(b.cx - bl.x, b.cz - bl.z);
        if (d < bl.r) off = Math.min(off, bl.t + 0.25 + d / bl.r * 0.9 + r.float(0, 0.4));
      }
      const dist = Math.hypot(b.cx, b.cz - 150);
      const wave = WAVE[1] - (WAVE[1] - WAVE[0]) * clamp((dist - 150) / 1100);
      off = Math.min(off, wave + r.float(-0.4, 0.4), DARK + r.float(0, 0.3));
      if (r.chance(0.03)) off = Math.min(off, 36 + r.float(0, 2.5)); // early casualties during the flicker
      return off;
    });

    // ---- sky & water
    const sky = buildSky({ seed: 9, clouds: 0, stars: 3200 });
    sky.uniforms.uZenith.value.set('#03060f');
    sky.uniforms.uHorizon.value.set('#1d2236');
    sky.uniforms.uBelow.value.set('#0d1020');
    sky.uniforms.uSunGlow.value = 0; sky.uniforms.uSunDisk.value = 0;
    sky.uniforms.uHorizonPow.value = 0.42;
    scene.add(sky.group);

    const water = buildWater({ level: -0.6 });
    water.uniforms.uDeep.value.set('#04070d');
    water.uniforms.uSky.value.set('#141a2b');
    water.uniforms.uSkyTop.value.set('#070b16');
    water.uniforms.uSpec.value = 0.0;
    water.uniforms.uChop.value = 0.5;
    scene.add(water.mesh);

    // ---- light
    const hemi = new THREE.HemisphereLight('#3b4c80', '#14141c', 0.5);
    scene.add(hemi);
    const moon = new THREE.DirectionalLight('#9db1e6', 0.22);
    moon.position.set(-400, 600, 300);
    renderer.shadowMap.enabled = false; // moonlight shadows are invisible here and cost a full extra pass
    Object.assign(moon.shadow.camera, { left: -700, right: 700, top: 700, bottom: -700, near: 10, far: 2500 });
    moon.target.position.set(0, 0, -400); scene.add(moon, moon.target);
    // a warm room light behind us lighting the balcony
    const room = new THREE.PointLight('#ffc98a', 30, 18, 1.5);
    room.position.set(0, ourH + 2.6, BAL_Z + 1.5); scene.add(room);
    // aurora light on the city
    const auroraLight = new THREE.DirectionalLight('#4dff9a', 0);
    auroraLight.position.set(0, 800, -3000); auroraLight.target.position.set(0, 0, 0); scene.add(auroraLight, auroraLight.target);

    // ---- props
    const trees = buildTrees(city, { seed: 4, street: 0.35 });
    scene.add(trees.group);
    const cars = buildCars(city, { seed: 8, count: 520 });
    cars.lights.visible = true;
    scene.add(cars.mesh, cars.lights);
    const people = buildPeople(city, { seed: 3, count: 900 });
    scene.add(people.mesh);
    const lamps = streetLightSpots(city, { spacing: 32 });
    scene.add(buildPoles(lamps));
    lamps.forEach((l) => {
      let off = 1e6;
      for (const bl of BLASTS) { const d = Math.hypot(l.x - bl.x, l.z - bl.z); if (d < bl.r) off = Math.min(off, bl.t + 0.3 + d / bl.r * 0.9); }
      const dist = Math.hypot(l.x, l.z - 150);
      off = Math.min(off, WAVE[1] - (WAVE[1] - WAVE[0]) * clamp((dist - 150) / 1100), DARK);
      l.off = off; l.warm = r.chance(0.7);
    });


    // ---- aurora curtains
    const aurora = buildAurora();
    scene.add(aurora.group);

    // ---- fx
    const glows = new GlowLayer(4000, { fadeNear: 1800, fadeFar: 5200 });
    scene.add(glows.points);
    const smoke = new Particles(900, { map: makeSmokeTexture(3) });
    smoke.uniforms.uLight.value.set('#2a2c33');
    scene.add(smoke.mesh);
    const sparks = new Particles(1500, { map: makeSoftTexture(), additive: true });
    scene.add(sparks.mesh);
    const pool = new LightPool(scene, 4, 900);

    // distant far-shore lights across the bay
    const farShore = [];
    for (let i = 0; i < 260; i++) farShore.push({ x: r.float(-5000, 2000), z: -4200 + r.float(-150, 150) + Math.sin(i) * 40, s: r.float(4, 12), c: r.chance(0.7) ? [1.0, 0.7, 0.4] : [0.8, 0.9, 1.0], off: WAVE[0] + r.float(0, 4) });

    // satellites & re-entry streaks
    const sats = [];
    for (let i = 0; i < 9; i++) sats.push({ a0: r.float(-0.6, 0.6), el: r.float(0.18, 0.5), v: r.float(0.015, 0.03) * (r.chance(0.5) ? 1 : -1), burn: i < 4 ? 58 + i * 2.1 + r.float(0, 1) : 1e6 });

    ctx.state = { city, fac, sky, water, hemi, moon, room, auroraLight, cars, people, lamps, aurora, glows, smoke, sparks, pool, farShore, sats, r, lost: 0, power: 1, blasted: new Set(), rng: new Rng(77) };
    ctx.grade = { brightness: 1.0, contrast: 1.06, saturate: 1.0, sepia: 0 };

    ctx.onFrame.push((t) => {
      const st = ctx.state;
      st.sky.update(t, ctx.camera);
      st.smoke.flush(ctx.camera); st.sparks.flush(ctx.camera);
      st.glows.end(ctx.camera, ctx.H * ctx.SCALE);
    });
  },

  update(ctx, t, dt) {
    const st = ctx.state;
    const { fac, sky, water, cars, people, glows, smoke, sparks, pool } = st;
    fac.uTime.value = t;
    water.uniforms.uTime.value = t;
    cars.update(t, dt); people.update(t);

    // ---- aurora strength over time
    const A = keys(t, [[17, 0], [19.5, 0.08], [23, 0.55], [27, 1.0], [33, 1.0], [38, 0.85], [50, 0.9], [57.5, 1.1], [68, 1.25]], easeInOut);
    const red = keys(t, [[22, 0], [27, 0.9], [36, 0.7], [58, 1.0]]);
    st.aurora.update(t, A, red);
    st.auroraLight.intensity = A * 0.35;
    const green = new THREE.Color('#3dff8f'), redC = new THREE.Color('#ff3b6b');
    const skyGlow = green.clone().multiplyScalar(0.05 * A).add(redC.clone().multiplyScalar(0.03 * A * red));
    sky.uniforms.uGlowTint.value.copy(skyGlow);
    sky.uniforms.uGlowDir.value.set(0, 0.25, -1).normalize();
    water.uniforms.uRefl.value.copy(green).multiplyScalar(0.22 * A).add(redC.clone().multiplyScalar(0.06 * A * red));

    // ---- grid: flicker, blasts, blackout
    const flick = t > 35.5 && t < 38.6 ? (0.82 + 0.18 * Math.sign(Math.sin(t * 37.0 + Math.sin(t * 13.0) * 4))) : 1;
    fac.uNight.value = 1.25 * flick;
    // city-glow on the horizon (light pollution), fades with the power
    const live = st.city.buildings.reduce((n, b) => n + (b.offTime > t ? 1 : 0), 0) / st.city.buildings.length;
    st.power = live;
    sky.uniforms.uHorizon.value.set('#1d2236').lerp(new THREE.Color('#0b0f1c'), 1 - live);
    sky.starU.uStars.value = lerp(0.45, 1.25, 1 - live) * (1 - 0.3 * A);
    st.hemi.intensity = 0.45 + 0.35 * A;
    st.hemi.color.set('#3b4c80').lerp(new THREE.Color('#2f8f6a'), 0.45 * A);

    // camera
    const c = ctx.cam;
    const tilt = keys(t, [[0, 0], [21, 0], [29, 1], [34, 1], [39, 0.15], [58, 0.15], [67.6, 0.75]], easeInOut);
    const pan = keys(t, [[0, -0.12], [20, 0.06], [40, -0.05], [60, 0.04], [68, 0.0]], easeInOut);
    const push = keys(t, [[0, 0], [68, 1]]);
    c.pos.set(lerp(-1.5, 1.5, push), OUR_H + 1.72, BAL_Z - 3.0 + 1.05 + push * 0.15);
    const dir = new THREE.Vector3(Math.sin(pan), lerp(-0.2, 0.12, tilt), -Math.cos(pan)).normalize();
    c.look.copy(c.pos).addScaledVector(dir, 100);
    c.fov = 56;
    ctx.shake = 0;

    // ---- glows: street lamps, far shore, blasts, fires, satellites
    glows.begin();
    for (const l of st.lamps) {
      if (t >= l.off) continue;
      const fl = l.off - t < 0.8 ? (Math.sin(t * 60 + l.x) > 0 ? 1 : 0.2) : 1;
      if (l.warm) glows.add(l.x, 7.6, l.z, 1.0 * fl, 0.55 * fl, 0.22 * fl, 7);
      else glows.add(l.x, 7.6, l.z, 0.75 * fl, 0.82 * fl, 0.95 * fl, 6);
    }
    for (const f of st.farShore) if (t < f.off) glows.add(f.x, 6, f.z, f.c[0] * 0.8, f.c[1] * 0.8, f.c[2] * 0.8, f.s * 6);

    pool.reset();
    let shake = 0, flashSky = 0, li = 0;
    for (const [k, b] of BLASTS.entries()) {
      const u = t - b.t;
      if (u < 0) continue;
      if (!st.blasted.has(k)) { st.blasted.add(k); st.lost += k === BLASTS.length - 1 ? 340 : 12 + Math.floor(b.big * 20); spawnSparks(st, b); }
      const bursts = [0, 0.35, 0.8];
      let e = 0;
      for (const bs of bursts) { const v = u - bs; if (v >= 0) e = Math.max(e, Math.exp(-v * 7) * (bs === 0 ? 1 : 0.6)); }
      const size = (b.r > 9000 ? 260 : 380) * b.big;
      if (e > 0.01) {
        glows.add(b.x, 14, b.z, 0.55 * e * 3, 0.85 * e * 3, 1.0 * e * 3, size * (0.6 + e));
        glows.add(b.x, 10, b.z, 1.0 * e * 2, 1.0 * e * 2, 1.0 * e * 2, size * 0.25);
        if (li < pool.lights.length) { const L = pool.lights[li++]; L.color.set('#7cc8ff'); L.position.set(b.x, 40, b.z); L.intensity = e * 1.2e5 * b.big; L.distance = 900; }
        flashSky = Math.max(flashSky, e * b.big * (b.r > 9000 ? 1.2 : 0.55));
        if (b.r > 9000) shake = Math.max(shake, e * 1.4);
      }
      // smouldering fire afterwards
      if (u > 0.6 && b.r < 9000) {
        const fl = 0.75 + 0.25 * fbm1(t * 6 + k * 3);
        glows.add(b.x, 6, b.z, 1.0 * fl, 0.45 * fl, 0.12 * fl, 40 * fl);
        glows.add(b.x, 4, b.z, 1.0 * fl, 0.75 * fl, 0.3 * fl, 14);
        if (li < pool.lights.length && k >= BLASTS.length - 5) { const L = pool.lights[li++]; L.color.set('#ff8a3d'); L.position.set(b.x, 12, b.z); L.intensity = 2.5e4 * fl; L.distance = 300; }
        if (st.rng.chance(dt * 8)) smoke.spawn({ pos: new THREE.Vector3(b.x + st.rng.float(-4, 4), 8, b.z + st.rng.float(-4, 4)), vel: new THREE.Vector3(st.rng.float(-1, 1), st.rng.float(6, 10), st.rng.float(-1, 1)), life: st.rng.float(9, 14), size: [10, 70], alpha: 0.55, rot: st.rng.float(0, 6), rotV: st.rng.float(-0.2, 0.2), drag: 0.15, color: new THREE.Color('#5a5552') });
      }
    }
    sky.uniforms.uGlowTint.value.add(new THREE.Color('#6fc8ff').multiplyScalar(flashSky * 0.35));
    ctx.flash = Math.max(0, flashSky - 0.5) * 0.35; ctx.flashColor = '#cfeeff';
    ctx.shake = shake;

    // cars stop once the traffic lights die
    if (t > 50) for (const car of cars.cars) car.speedMul = Math.max(0, 1 - (t - 50) / 7);

    // satellites: slow dots, some burning up later
    for (const s of st.sats) {
      const a = s.a0 + s.v * t, el = s.el - (t > s.burn ? (t - s.burn) * 0.03 : 0);
      if (el < 0.02) continue;
      const p = new THREE.Vector3(Math.sin(a), el, -Math.cos(a)).normalize().multiplyScalar(9000).add(ctx.cam.pos);
      if (t < s.burn) glows.add(p.x, p.y, p.z, 0.8, 0.8, 0.8, 30);
      else {
        for (let k = 0; k < 18; k++) {
          const a2 = s.a0 + s.v * (t - k * 0.06), el2 = s.el - Math.max(0, t - k * 0.06 - s.burn) * 0.03;
          const p2 = new THREE.Vector3(Math.sin(a2), el2, -Math.cos(a2)).normalize().multiplyScalar(9000).add(ctx.cam.pos);
          const f = 1 - k / 18;
          glows.add(p2.x, p2.y, p2.z, 1.0 * f, 0.6 * f, 0.25 * f, 60 * f + 20);
        }
      }
    }

    smoke.step(dt, new THREE.Vector3(4, 0, 1));
    sparks.step(dt);
  },
};

function spawnSparks(st, b) {
  const n = b.r > 9000 ? 140 : 70;
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(st.rng.gauss(), Math.abs(st.rng.gauss()) * 1.4 + 0.3, st.rng.gauss()).multiplyScalar(st.rng.float(10, 45));
    st.sparks.spawn({ pos: new THREE.Vector3(b.x, 10, b.z), vel: v, life: st.rng.float(0.6, 1.8), size: [3, 1], alpha: 1, fadeIn: 0.01, grav: 25, drag: 0.6, color: new THREE.Color(st.rng.chance(0.5) ? '#bfe6ff' : '#ffd38a') });
  }
}

// Curtains of light: ribbons with vertical ray structure, green low, red high.
function buildAurora() {
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 }, uA: { value: 0 }, uRed: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `
      uniform float uTime; attribute float aSeed; varying vec2 vUv; varying float vSeed;
      void main(){
        vUv = uv; vSeed = aSeed;
        vec3 p = position;
        float w = sin(uv.x*7.0 + uTime*0.21 + aSeed*3.0)*0.6 + sin(uv.x*17.0 - uTime*0.37 + aSeed)*0.25;
        p.z += w * 900.0 * (0.6 + 0.4*uv.y);
        p.x += sin(uv.x*5.0 + uTime*0.13 + aSeed*2.0) * 300.0;
        // the lower edge rises and dips along the curtain
        p.y += (sin(uv.x*4.3 + uTime*0.09 + aSeed*5.0)*0.6 + sin(uv.x*11.0 - uTime*0.17 + aSeed)*0.4) * 520.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime, uA, uRed; varying vec2 vUv; varying float vSeed;
      float h(float x){ return fract(sin(x*127.1)*43758.5453); }
      float n1(float x){ float i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); return mix(h(i), h(i+1.0), f); }
      void main(){
        float x = vUv.x, y = vUv.y;
        float rays = n1(x*220.0 + uTime*1.4 + vSeed*10.0)*0.55 + n1(x*70.0 - uTime*0.6 + vSeed*4.0)*0.6;
        rays = pow(rays, 2.4);
        float curtains = smoothstep(0.25, 0.75, n1(x*11.0 + uTime*0.18 + vSeed*5.0));
        float pulse = 0.55 + 0.45*n1(x*4.0 + uTime*0.45 + vSeed*7.0);
        float bottom = smoothstep(0.0, 0.035, y);
        float edge = exp(-pow((y-0.05)/0.035, 2.0)) * 0.9;           // bright lower border
        float topFade = pow(1.0 - y, 2.2);
        float ends = smoothstep(0.0, 0.15, x) * smoothstep(1.0, 0.85, x);
        float a = bottom * ends * curtains * pulse * uA * (topFade*(0.012 + rays*0.95) + edge*(0.3+rays));
        vec3 green = vec3(0.18, 1.0, 0.52);
        vec3 red = vec3(1.0, 0.16, 0.38);
        vec3 col = mix(green, red, smoothstep(0.25, 0.85, y) * uRed);
        col = mix(col, vec3(0.6,1.0,0.8), smoothstep(0.08, 0.0, y)*0.6);
        gl_FragColor = vec4(col * a * 0.55, 1.0);
      }`,
  });
  const ribbons = [
    { y0: 1100, h: 5200, d: 7500, span: 14000, off: 0, s: 0.3 },
    { y0: 1700, h: 6500, d: 10500, span: 18000, off: 2500, s: 1.7 },
    { y0: 900, h: 4200, d: 5600, span: 10000, off: -3000, s: 2.9 },
    { y0: 2300, h: 6000, d: 6400, span: 12000, off: 3500, s: 4.1 },
  ];
  for (const rb of ribbons) {
    const g = new THREE.PlaneGeometry(rb.span, rb.h, 160, 8);
    const pa = g.attributes.position, seeds = new Float32Array(pa.count).fill(rb.s);
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i);
      // curve the ribbon into an arc around the viewer
      const u = x / rb.span;
      pa.setXYZ(i, x + rb.off, rb.y0 + (y + rb.h / 2), -rb.d + Math.pow(u * 2, 2) * 1800);
    }
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false; m.renderOrder = -7;
    group.add(m);
  }
  return {
    group,
    update(t, A, red) { uniforms.uTime.value = t; uniforms.uA.value = A; uniforms.uRed.value = red; },
  };
}
