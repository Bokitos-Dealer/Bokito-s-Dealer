// What if the strongest hurricane ever recorded hit your city?
import * as THREE from 'three';
import { buildCity } from '../engine/lib/city.js';
import { buildSky } from '../engine/lib/sky.js';
import { buildWater } from '../engine/lib/water.js';
import { buildTrees, buildCars, buildPeople, streetLightSpots, buildPoles, WIND } from '../engine/lib/props.js';
import { GlowLayer, Particles, makeSmokeTexture } from '../engine/lib/fx.js';
import { Rng, keys, smooth, clamp, lerp, easeInOut, fbm1 } from '../engine/lib/rng.js';

// ---- coastal terrain (same idea as the ice-melt city: beach rising into hills)
const COAST = -380;
const coastZ = (x) => COAST + 35 * Math.sin(x * 0.004) + 15 * Math.sin(x * 0.013 + 2);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const elev = (x, z) => { const d = z - coastZ(x); return d < 0 ? Math.max(-8, d * 0.08) : d * 0.024 + 25 * sstep(900, 1600, d); };
const TERRAIN_GLSL = `
  float coastZ(float x){ return ${COAST.toFixed(1)} + 35.0*sin(x*0.004) + 15.0*sin(x*0.013+2.0); }
  float terrain(vec2 p){ float d = p.y - coastZ(p.x); if (d < 0.0) return max(-8.0, d*0.08); return d*0.024 + 25.0*smoothstep(900.0, 1600.0, d); }`;
const land = (x, z) => { const d = z - coastZ(x); return d < -10 ? 'water' : d < 60 ? 'beach' : 'land'; };

// ---- where we stand: behind a window on the 11th floor
const CAM_X = 30, CAM_Z = -80;
const WIN_Y = 36;
const WIN_Z = CAM_Z;           // window plane
const EYE_D = 1.85;            // distance from the glass

// ---- storm timeline
const WIND_MPH = [[0, 22], [7, 45], [11, 76], [15, 100], [18.5, 128], [22.5, 158], [30, 215], [37.0, 215], [38.6, 14], [48.6, 8], [49.6, 215], [68, 215]];
const mph = (t) => keys(t, WIND_MPH, easeInOut);
const EYE = [37.7, 49.1];
const SURGE = [[0, -0.6], [50, -0.6], [56, 1.6], [61, 5.2], [64.5, 7.6], [68, 7.9]]; // peaks at +8.5 m, Katrina's record
const surge = (t) => keys(t, SURGE, easeInOut);
const BLACKOUT = 33.9;
const IMPACT = 64.55;
const BOLTS = [9.6, 16.3, 21.0, 26.1, 29.2, 31.5, 35.3, 51.6, 55.9, 59.7, 63.0].map((t, i) => {
  const r = new Rng(300 + i);
  return { t, az: r.float(-0.32, 0.32), dist: r.float(1300, 2600), seed: 300 + i };
});

const category = (m) => (m < 39 ? 'outer rain bands' : m < 74 ? 'tropical storm' : m < 96 ? 'category 1' : m < 111 ? 'category 2' : m < 130 ? 'category 3' : m < 157 ? 'category 4' : 'category 5');

export default {
  id: 'hurricane',
  title: 'What if the strongest hurricane ever recorded hit your city?',
  endFact: 'Hurricane Patricia, 2015: 215 mph winds, the strongest ever measured.<br>Warmer oceans are making the most intense storms more common.',
  duration: 80,
  fadeOut: [67.8, 69.6],
  endAt: 70.2,
  crackAt: [490, 700],
  crackSeed: 11,
  titleOut: [2.8, 3.6],

  captions: [
    [3.7, 7.0, 'The evening before landfall.'],
    [7.3, 10.8, 'The wind picks up.'],
    [11.1, 14.6, '74 miles an hour. It is now a hurricane.'],
    [14.9, 18.4, 'It feeds on warm ocean water.'],
    [18.7, 22.2, 'It releases 200 times the energy of every power plant on Earth.'],
    [22.5, 26.0, '157. Category 5. The scale stops here.'],
    [26.3, 29.8, 'Signs, branches and roofs start to fly.'],
    [30.1, 33.6, '215 miles an hour. The strongest ever measured.'],
    [33.9, 37.4, 'The power goes out.'],
    [37.7, 41.2, 'Then it goes quiet.'],
    [41.5, 45.0, 'You are in the eye of the storm.'],
    [45.3, 48.8, 'Birds get trapped inside it.'],
    [49.1, 52.6, 'Then the other side hits.'],
    [52.9, 56.4, 'Now the wind pushes the sea onto the land.'],
    [56.7, 60.2, 'Nine in ten hurricane deaths are caused by water.'],
    [60.5, 64.0, 'The surge is eight metres high.'],
  ],

  hud(t) {
    if (t >= IMPACT) return { label: 'The storm', value: 'HERE', sub: '215 mph · surge 8 m' };
    const m = mph(t);
    let sub = category(m);
    if (t > 30 && t < 37.2) sub = 'strongest ever measured';
    if (t > 37.6 && t < 49.2) sub = 'the eye';
    if (t > 52) { const s = Math.max(0, surge(t) + 0.6); return { label: 'Storm surge', value: `+${s.toFixed(1)} m`, sub: `wind ${Math.round(m)} mph` }; }
    return { label: 'Wind speed', value: `${Math.round(m)} mph`, sub };
  },

  audio: [
    { type: 'ambience', kind: 'coast', t0: 0, t1: 14, level: 0.45, gulls: 0.0 },
    { type: 'ambience', kind: 'wind', t0: 0, t1: 37.9, level: 0.8, swell: [[0, 0.25], [11, 0.5], [22, 0.85], [30, 1.0], [37.9, 1.0]] },
    { type: 'rain', t0: 6, t1: 38.2, level: 0.55, swell: [[6, 0], [12, 0.5], [24, 0.9], [37, 1.0], [38.2, 0.6]] },
    { type: 'rumble', t0: 18, t1: 38.0, level: 0.5, cut: 160, grit: 0.35, swell: [[18, 0], [30, 1], [38, 1]] },
    { type: 'ambience', kind: 'night-quiet', t0: 37.8, t1: 49.3, level: 0.25 },
    { type: 'ambience', kind: 'coast', t0: 38.2, t1: 49.3, level: 0.35, gulls: 0.6 },
    { type: 'drone', t0: 0, t1: 69.5, root: 47, chord: [0, 3, 7, 12], level: 0.32, swell: [[0, 0.2], [20, 0.6], [37, 0.9], [38.5, 0.35], [48.5, 0.4], [49.3, 1.0], [64, 1.0], [69.5, 0]] },
    { type: 'whoosh', t: 48.3, dur: 1.2, level: 0.5 },
    { type: 'ambience', kind: 'wind', t0: 49.1, t1: 69.5, level: 0.85, swell: [[49.1, 1.0], [69.5, 1.0]] },
    { type: 'rain', t0: 49.1, t1: 69.5, level: 0.6, swell: [[49.1, 1.0], [69.5, 1.0]] },
    { type: 'rumble', t0: 49.1, t1: 69.5, level: 0.55, cut: 160, grit: 0.35 },
    { type: 'water', t0: 51, t1: 69.5, level: 0.5, rush: 0.6, swell: [[51, 0.2], [60, 1.0], [69.5, 1.0]] },
    { type: 'powerdown', t: BLACKOUT, level: 0.45 },
    { type: 'glass', t: IMPACT, level: 0.9 },
    { type: 'boom', t: IMPACT, level: 0.6, low: true },
    ...BOLTS.map((b) => ({ type: 'thunder', t: b.t, delay: Math.min(4.5, b.dist / 343 * 0.55), level: 0.55, pan: Math.max(-0.8, Math.min(0.8, b.az * 2.5)) })),
    { type: 'chime', t: 70.4, level: 0.5 },
  ],

  async setup(ctx) {
    const { scene, renderer } = ctx;
    const r = new Rng(2015);
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = false; // overcast: no hard shadows anyway
    scene.fog = new THREE.Fog('#5f686b', 300, 3000);

    const city = buildCity({
      seed: 33, x0: -1000, x1: 1000, z0: -440, z1: 1400, elev, land,
      // blocks in our sightline are parks, so we watch the trees take the wind
      isPark: (i, j, cx, cz) => { const a = CAM_Z - cz; return (a > 20 && a < 340 && Math.abs(cx - CAM_X) < 70 + a * 0.3) || (i === 12 && j === 5); },
      height: (x, z, rr) => {
        const d = z - coastZ(x);
        const core = Math.exp(-((x + 40) ** 2 + (z - 600) ** 2) / (2 * 300 * 300));
        const sides = Math.exp(-((x + 260) ** 2 + (z + 180) ** 2) / (2 * 80 * 80)) + Math.exp(-((x - 300) ** 2 + (z + 240) ** 2) / (2 * 70 * 70));
        const front = Math.exp(-((x - CAM_X) ** 2) / (2 * 170 * 170)) * sstep(CAM_Z + 20, CAM_Z - 200, z);
        let h = 7 + rr.float(0, 12) * sstep(0, 200, d) + rr.float(0, 8);
        h *= 1 - front * 0.4;
        // keep a clear sightline from our window to the sea
        const ahead = CAM_Z - z;
        if (ahead > 10 && ahead < 330 && Math.abs(x - CAM_X) < 40 + ahead * 0.32) return Math.min(h, 6 + ahead * 0.05);
        h += sides * rr.float(20, 70) + core * rr.float(10, 70);
        return h;
      },
      clear: (x, z) => Math.abs(x - CAM_X) < 30 && Math.abs(z - CAM_Z - 14) < 18,
      texSize: 4096,
      groundColor: '#8e8b84',
    });
    scene.add(city.group);
    const fac = city.facade.userData.uniforms;
    fac.uNight.value = 0.75; fac.uLit.value = 0.45; fac.uWallMul.value = 0.75;
    fac.uGlassSky.value.set('#6b7880'); fac.uGlassDark.value.set('#1b2125'); fac.uRoof.value.set('#5d5b57');
    city.setOffTimes((b) => BLACKOUT - 0.6 + r.float(0, 2.4) + Math.hypot(b.cx - CAM_X, b.cz - CAM_Z) / 1500);

    // ---- sky, light, water
    const sky = buildSky({ seed: 6, clouds: 46, cloudAlt: [260, 700], stars: 0 });
    sky.uniforms.uZenith.value.set('#2b3236');
    sky.uniforms.uHorizon.value.set('#5d6669');
    sky.uniforms.uBelow.value.set('#4a5254');
    sky.uniforms.uSunGlow.value = 0; sky.uniforms.uSunDisk.value = 0;
    sky.uniforms.uHorizonPow.value = 0.5;
    sky.cloudTint(new THREE.Color('#3d4447'), 0.85);
    scene.add(sky.group);

    const water = buildWater({ level: -0.6, terrainGLSL: TERRAIN_GLSL, segments: 520, dense: { x: CAM_X, z: COAST - 300, power: 2.3 } });
    const wu = water.uniforms;
    wu.uDeep.value.set('#253538'); wu.uShallow.value.set('#5d6e62'); wu.uShore.value = 1;
    wu.uSky.value.set('#5f686b'); wu.uSkyTop.value.set('#3a4246');
    wu.uSpec.value = 0.0; wu.uChop.value = 0.8; wu.uFoam.value = 0.3;
    wu.uSwellDir.value.set(0.15, 1);
    scene.add(water.mesh);

    const hemi = new THREE.HemisphereLight('#a7b2b6', '#4a463f', 1.6);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight('#c9d2d6', 0.6);
    dir.position.set(-300, 700, -500); dir.target.position.set(0, 0, -200);
    scene.add(dir, dir.target);
    const lamp = new THREE.PointLight('#ffc27a', 9, 7, 1.5);
    lamp.position.set(CAM_X - 1.4, WIN_Y + 0.4, CAM_Z + EYE_D + 2.2);
    scene.add(lamp);
    const boltLight = new THREE.DirectionalLight('#dfe8ff', 0);
    boltLight.position.set(0, 1500, -2500); boltLight.target.position.set(0, 0, 0);
    scene.add(boltLight, boltLight.target);

    // ---- props
    const palms = [];
    for (let x = -980; x < 980; x += 13) { const z = coastZ(x) + 66; palms.push({ x: x + r.float(-2, 2), z: z + r.float(-1.5, 1.5), s: r.float(0.85, 1.2), palm: true }); }
    const trees = buildTrees(city, { seed: 7, street: 0.6, palms: 0.55, parkDensity: 1.6, extra: palms });
    scene.add(trees.group);
    const cars = buildCars(city, { seed: 3, count: 300 });
    scene.add(cars.mesh, cars.lights);
    cars.lights.visible = true;
    const people = buildPeople(city, { seed: 8, count: 260 });
    scene.add(people.mesh);
    const lamps = streetLightSpots(city, { spacing: 40 });
    scene.add(buildPoles(lamps));
    lamps.forEach((l) => { l.off = BLACKOUT - 0.8 + r.float(0, 2.6); });

    // ---- the window we look through
    const win = buildWindow();
    win.position.set(CAM_X, WIN_Y, WIN_Z);
    scene.add(win);

    // ---- fx
    const glows = new GlowLayer(1600, { fadeNear: 2500, fadeFar: 9000 });
    scene.add(glows.points);
    const spray = new Particles(700, { map: makeSmokeTexture(12, { alpha: 0.45 }) });
    spray.uniforms.uLight.value.set('#b9c2c4');
    scene.add(spray.mesh);
    const debris = buildFlyingDebris(220);
    scene.add(debris.mesh);
    const birds = buildBirds(new Rng(4), 22);
    scene.add(birds.mesh);

    ctx.state = { city, fac, sky, water, hemi, dir, lamp, boltLight, trees, cars, people, lamps, win, glows, spray, debris, birds, rng: new Rng(99), cloudX: 0 };
    ctx.vignette = 0.85;
    ctx.grade = { brightness: 1.0, contrast: 1.08, saturate: 0.82, sepia: 0.05 };

    ctx.onFrame.push((t) => {
      const st = ctx.state;
      st.sky.update(t, ctx.camera);
      for (const c of st.sky.clouds) c.position.x = c.userData.base.x + st.cloudX * c.userData.speed;
      st.spray.flush(ctx.camera);
      st.glows.end(ctx.camera, ctx.H * ctx.SCALE);
    });
  },

  update(ctx, t, dt) {
    const st = ctx.state;
    const m = mph(t);
    const w = clamp((m - 15) / 200);                 // 0..1 storm strength
    const inEye = t > EYE[0] - 0.6 && t < EYE[1];
    const back = t >= EYE[1] - 0.4;
    const wdir = back ? new THREE.Vector2(-0.75, 0.66).normalize() : new THREE.Vector2(1, 0.12).normalize();

    // wind on trees, clouds, rain
    WIND.uTime.value = t; WIND.uWind.value = w * 1.25; WIND.uWindDir.value.copy(wdir); WIND.uGust.value = 0.35;
    st.cloudX += wdir.x * (6 + w * 160) * dt;
    st.water.uniforms.uTime.value = t;
    st.fac.uTime.value = t;

    // visibility and light: the eye clears, the walls close in
    const vis = inEye ? 1 : 1 - w;
    const eyeK = smooth(EYE[0] - 0.5, EYE[0] + 2.5, t) * (1 - smooth(EYE[1] - 1.2, EYE[1], t));
    st.ctxFog = st.ctxFog || ctx.scene.fog;
    ctx.scene.fog.near = lerp(25, 300, vis) + eyeK * 900;
    ctx.scene.fog.far = lerp(520, 3000, vis) + eyeK * 4000;
    const fogC = new THREE.Color('#5f686b').lerp(new THREE.Color('#3e4649'), w).lerp(new THREE.Color('#8b9ba3'), eyeK);
    ctx.scene.fog.color.copy(fogC);
    st.sky.uniforms.uHorizon.value.copy(fogC);
    st.sky.uniforms.uZenith.value.set('#2b3236').lerp(new THREE.Color('#1e2427'), w).lerp(new THREE.Color('#6f8fae'), eyeK);
    st.sky.cloudTint(new THREE.Color('#3d4447').lerp(new THREE.Color('#9fa9ad'), eyeK), 0.85 - eyeK * 0.4);
    st.water.uniforms.uSky.value.copy(fogC);
    st.hemi.intensity = lerp(1.6, 1.05, w) + eyeK * 0.9;
    st.dir.intensity = 0.6 + eyeK * 1.6;
    st.dir.color.set('#c9d2d6').lerp(new THREE.Color('#ffe2b8'), eyeK);

    // sea: swell and whitecaps grow, then the surge
    const L = surge(t);
    st.water.level = L;
    st.water.uniforms.uSwell.value = lerp(0.4, 3.2, w) * (inEye ? 0.75 : 1);
    st.water.uniforms.uChop.value = lerp(0.6, 1.3, w);
    st.water.uniforms.uFoam.value = lerp(0.15, 0.8, w);
    st.water.uniforms.uSwellDir.value.set(back ? -0.35 : 0.15, 1);

    // traffic stops, people get inside, cars float in the surge
    st.cars.update(t, dt);
    for (const c of st.cars.cars) {
      c.speedMul = Math.max(0, 1 - t / 14);
      const g = elev(c.pos.x, c.pos.z);
      if (!c.free && L - g > 0.6) { c.free = true; c.drift = new THREE.Vector3(wdir.x * 1.5 + st.rng.float(-1, 1), 0, Math.abs(wdir.y) * 3 + st.rng.float(0, 2)); c.spinR = st.rng.float(-0.4, 0.4); }
      if (c.free) {
        c.pos.addScaledVector(c.drift, dt);
        c.pos.y = L - elev(c.pos.x, c.pos.z) > 6 ? -500 : L - 0.5 + Math.sin(t * 2 + c.s) * 0.15;
        c.euler.set(Math.sin(t * 1.8 + c.s) * 0.12, c.euler.y + c.spinR * dt, Math.sin(t * 1.4 + c.s) * 0.12);
      }
    }
    st.cars.lights.visible = t < 40;
    st.people.update(t);
    if (t > 9) { const M = new THREE.Matrix4(); M.makeTranslation(0, -900, 0); for (let i = 0; i < st.people.people.length; i++) if (i % 9 < Math.min(9, (t - 9) * 2)) st.people.mesh.setMatrixAt(i, M); }

    // room lamp goes out with the city
    const fl = t > BLACKOUT - 0.6 && t < BLACKOUT ? (Math.sin(t * 70) > 0 ? 1 : 0.15) : 1;
    st.lamp.intensity = t < BLACKOUT ? 14 * fl : 0;

    // spindrift off the sea
    if (w > 0.2 && !inEye) {
      const n = Math.floor(w * 3 + (st.rng.next() < (w * 3 % 1) ? 1 : 0));
      for (let i = 0; i < n; i++) {
        const x = CAM_X + st.rng.float(-500, 500), z = COAST - st.rng.float(-40, 300);
        st.spray.spawn({ pos: new THREE.Vector3(x, Math.max(L, 0) + st.rng.float(0, 4), z), vel: new THREE.Vector3(wdir.x * 40 * w, st.rng.float(1, 4), wdir.y * 40 * w), life: st.rng.float(3, 6), size: [12, 70], alpha: 0.35 * w, drag: 0.3, rot: st.rng.float(0, 6), rotV: st.rng.float(-0.3, 0.3), color: new THREE.Color('#d4dcde') });
      }
    }
    st.spray.step(dt);

    // flying debris
    st.debris.update(t, dt, w * (inEye ? 0 : 1), wdir, st.rng);

    // birds circling in the eye
    st.birds.update(t, eyeK);

    // lightning
    st.glows.begin();
    let flash = 0;
    for (const b of BOLTS) {
      const u = t - b.t;
      if (u < 0 || u > 0.6) continue;
      const k = Math.exp(-u * 9) * (u < 0.05 ? 1 : 0.6 + 0.4 * Math.sign(Math.sin(u * 60)));
      flash = Math.max(flash, k);
      const br = new Rng(b.seed);
      let x = CAM_X + Math.sin(b.az) * b.dist, y = 900, z = CAM_Z - Math.cos(b.az) * b.dist;
      while (y > 0) {
        const nx = x + br.float(-60, 60), ny = y - br.float(30, 70);
        for (let s = 0; s < 4; s++) { const f = s / 4; st.glows.add(lerp(x, nx, f), lerp(y, ny, f), lerp(z, z, f), 2.2 * k, 2.3 * k, 2.6 * k, 26); }
        x = nx; y = ny;
      }
    }
    st.boltLight.intensity = flash * 3.0;
    st.sky.uniforms.uGlowTint.value.set('#c7d6ff').multiplyScalar(flash * 0.6);
    ctx.flash = flash * 0.18; ctx.flashColor = '#e6eeff';

    // rain on screen and on the glass
    const rainAmt = inEye ? 0 : smooth(5, 16, t) * (0.35 + 0.65 * w);
    ctx.rain = { amount: rainAmt, angle: (back ? -1 : 1) * (0.12 + w * 0.75), glass: clamp(smooth(5, 12, t) * (inEye ? 0.55 : 1)), tint: '205,214,220' };

    // camera behind the glass
    const c = ctx.cam;
    c.pos.set(CAM_X + Math.sin(t * 0.05) * 0.1, WIN_Y + 0.1, WIN_Z + EYE_D);
    const pan = keys(t, [[0, -0.04], [30, 0.03], [40, -0.02], [49, 0.0], [68, 0.03]], easeInOut);
    const pitch = keys(t, [[0, -0.07], [40, -0.03], [52, -0.09], [68, -0.12]], easeInOut);
    const d = new THREE.Vector3(Math.sin(pan), pitch, -Math.cos(pan)).normalize();
    c.look.copy(c.pos).addScaledVector(d, 100);
    c.fov = 56;
    ctx.handheld = 0.7;
    const hit = t > IMPACT ? Math.exp(-(t - IMPACT) * 5) : 0;
    ctx.shake = hit * 0.6 + w * 0.02 * (inEye ? 0 : 1);
    ctx.crack = t > IMPACT ? clamp((t - IMPACT) / 0.18) : 0;
    st.win.userData.panel.visible = t > IMPACT - 0.5 && t < IMPACT + 0.05;
    if (st.win.userData.panel.visible) {
      const k = clamp((t - (IMPACT - 0.5)) / 0.5);
      st.win.userData.panel.position.set(lerp(-18, -0.1, k), lerp(-6, 0.25, k), lerp(-40, -0.35, k));
      st.win.userData.panel.rotation.set(k * 5, k * 3.5, k * 2);
    }
  },
};

// Window wall with frame, mullion and transom, seen from inside.
function buildWindow() {
  const g = new THREE.Group();
  const wallM = new THREE.MeshStandardMaterial({ color: '#2a2826', roughness: 0.95 });
  const frameM = new THREE.MeshStandardMaterial({ color: '#191a1b', roughness: 0.6, metalness: 0.3 });
  const sillM = new THREE.MeshStandardMaterial({ color: '#8b8579', roughness: 0.8 });
  const W2 = 0.78, BOT = -1.05, TOP = 1.3;
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  // wall around the opening
  box(3, 3, 0.3, -W2 - 1.5, 0, 0.15, wallM); box(3, 3, 0.3, W2 + 1.5, 0, 0.15, wallM);
  box(2 * W2, 2, 0.3, 0, TOP + 1, 0.15, wallM); box(2 * W2, 2, 0.3, 0, BOT - 1, 0.15, wallM);
  // frame
  const f = 0.055;
  box(f, TOP - BOT, 0.12, -W2 + f / 2, (TOP + BOT) / 2, 0.06, frameM); box(f, TOP - BOT, 0.12, W2 - f / 2, (TOP + BOT) / 2, 0.06, frameM);
  box(2 * W2, f, 0.12, 0, TOP - f / 2, 0.06, frameM); box(2 * W2, f, 0.12, 0, BOT + f / 2, 0.06, frameM);
  box(0.035, TOP - BOT, 0.08, 0.27, (TOP + BOT) / 2, 0.04, frameM);  // mullion
  box(2 * W2 + 0.2, 0.05, 0.3, 0, BOT - 0.02, 0.2, sillM);           // sill
  // incoming debris panel (shown only at the impact)
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.05), new THREE.MeshStandardMaterial({ color: '#c9b49a', roughness: 0.8 }));
  panel.visible = false;
  g.add(panel);
  g.userData.panel = panel;
  return g;
}

// Roof panels, signs, branches tumbling across the view with the wind.
function buildFlyingDebris(n) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85 }), n);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  const cols = ['#6b5a48', '#8a7d6a', '#b8b2a6', '#4d5559', '#a34a35', '#3f5f3a', '#d6d2c8'];
  const list = [];
  for (let i = 0; i < n; i++) im.setColorAt(i, new THREE.Color(cols[i % cols.length]));
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), HID = new THREE.Vector3(0, -999, 0);
  return {
    mesh: im,
    update(t, dt, w, wdir, rng) {
      const rate = w > 0.3 ? (w - 0.3) * 40 : 0;
      let k = rate * dt;
      while (k > 0 && list.length < n) {
        if (rng.next() < k) {
          const z = CAM_Z - (rng.next() < 0.6 ? rng.float(12, 90) : rng.float(90, 300));
          const across = 160;
          list.push({ p: new THREE.Vector3(CAM_X - wdir.x * across + rng.float(-60, 60), rng.float(6, 50), z), v: new THREE.Vector3(wdir.x, 0, wdir.y * 0.4).multiplyScalar(rng.float(28, 62) * w).add(new THREE.Vector3(0, rng.float(-2, 4), rng.float(-3, 3))), r: new THREE.Vector3(rng.float(0, 6), rng.float(0, 6), rng.float(0, 6)), sp: new THREE.Vector3(rng.float(-6, 6), rng.float(-6, 6), rng.float(-6, 6)), s: new THREE.Vector3(rng.float(0.5, 3.6), rng.float(0.04, 0.3), rng.float(0.4, 2.4)), age: 0 });
        }
        k -= 1;
      }
      for (let i = list.length - 1; i >= 0; i--) {
        const d = list[i];
        d.age += dt; d.p.addScaledVector(d.v, dt); d.v.y -= 2.5 * dt; d.r.addScaledVector(d.sp, dt);
        if (d.age > 12 || Math.abs(d.p.x - CAM_X) > 420 || d.p.y < -2) { list[i] = list[list.length - 1]; list.pop(); }
      }
      for (let i = 0; i < n; i++) {
        const d = list[i];
        if (d) { E.set(d.r.x, d.r.y, d.r.z); Q.setFromEuler(E); M.compose(d.p, Q, d.s); } else M.compose(HID, Q.identity(), S.set(1, 1, 1));
        im.setMatrixAt(i, M);
      }
      im.instanceMatrix.needsUpdate = true;
    },
  };
}

function buildBirds(r, n) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.9, 0.25, -0.2, -0.9, 0.25, 0.2, 0, 0, 0, 0.9, 0.25, -0.2, 0.9, 0.25, 0.2], 3));
  const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#262b2e', side: THREE.DoubleSide }), n);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  const birds = [];
  for (let i = 0; i < n; i++) birds.push({ cx: CAM_X + r.float(-200, 200), cz: CAM_Z - r.float(150, 600), rad: r.float(25, 90), y: r.float(45, 110), w: r.float(0.2, 0.45) * (r.chance(0.5) ? 1 : -1), ph: r.float(0, 6.28), flap: r.float(6, 9) });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  return {
    mesh: im,
    update(t, k) {
      birds.forEach((b, i) => {
        const a = b.ph + b.w * t;
        P.set(b.cx + Math.cos(a) * b.rad, k > 0.02 ? b.y + Math.sin(t + i) * 3 : -999, b.cz + Math.sin(a) * b.rad);
        E.set(0, -a + (b.w > 0 ? 0 : Math.PI), 0.2 * Math.sin(t * 0.5 + i));
        Q.setFromEuler(E);
        const f = 0.4 + 0.8 * Math.abs(Math.sin(t * b.flap + i));
        M.compose(P, Q, S.set(1.6, f * 1.6, 1.6)); im.setMatrixAt(i, M);
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
}
