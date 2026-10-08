// What if the Moon suddenly disappeared?
// One city seafront, seen from a few angles as time runs on: a crowd watching
// the full Moon when it vanishes, the dark, a weak tide, lost turtle hatchlings,
// Earth's wandering tilt, a frozen sea and the ice sheet arriving.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCity } from '../engine/lib/city.js';
import { buildSky } from '../engine/lib/sky.js';
import { buildWater } from '../engine/lib/water.js';
import { buildPeople } from '../engine/lib/people.js';
import { buildVehicles } from '../engine/lib/vehicles.js';
import { buildSeafront, beachY, SF, TERRAIN_GLSL } from '../engine/lib/seafront.js';
import { GlowLayer, makeSoftTexture, Particles, makeSmokeTexture } from '../engine/lib/fx.js';
import { Rng, smooth, clamp, lerp, easeInOut, easeOut, fbm1 } from '../engine/lib/rng.js';

// ---------------------------------------------------------------- timeline
const VANISH = 2.2;
// the Moon stutters twice before it goes
const flick = (t) => (t > 1.42 && t < 1.52) ? 0.22 : (t > 1.78 && t < 1.85) ? 0.3 : (t > 1.93 && t < 1.97) ? 0.6 : 1;
// HUD digits scramble while it stutters
const glitch = (txt, t) => {
  const f = Math.floor(t * 30);
  return [...txt].map((ch, i) => {
    if (!/[0-9]/.test(ch)) return ch;
    const h = Math.sin((f + 1) * 12.9898 + i * 78.233) * 43758.5453, v = h - Math.floor(h);
    return v < 0.4 ? ch : String(Math.floor(v * 10));
  }).join('');
};
// shots: [start, id]
const SHOTS = [
  [0.0, 'A'],    // over the crowd's shoulders: the full Moon over the sea
  [3.4, 'B1'],   // from the sea side: the crowd at the railing filming it
  [7.0, 'B2'],   // closer: a family reacts
  [10.4, 'C'],   // high and wide: the dark seafront
  [17.4, 'T'],   // next day: the tide comes in (time-lapse)
  [24.6, 'E'],   // space: the tidal bulge shrinks to the Sun's share
  [28.0, 'D'],   // sand level: hatchlings emerge and head for the lights
  [35.2, 'R'],   // volunteers with torches collect lost hatchlings
  [38.8, 'X1'],  // space: Earth and its axis
  [45.9, 'X2'],  // space, closer: the axis wanders
  [49.6, 'W'],   // the same beach, colder winters: snow, the sea freezes
  [56.8, 'G'],   // from the ice: the ice sheet behind the skyline
  [60.4, 'F'],   // on the frozen beach: people run, the ice swallows the hotels
  [64.0, 'H'],   // the ice wall fills the frame: HERE
  [67.6, 'END'],
];
const shotAt = (t) => { let s = SHOTS[0]; for (const sh of SHOTS) if (t >= sh[0]) s = sh; return s; };
const shotStart = (id) => SHOTS.find((s) => s[1] === id)[0];
const shotEnd = (id) => { const i = SHOTS.findIndex((s) => s[1] === id); return SHOTS[i + 1][0]; };
const FADE = [67.6, 69.2], END = 69.6;
const HERE = 64.6;

const MOON_DIR = new THREE.Vector3(0.12, 0.165, -1).normalize();
const SUN_DAY = new THREE.Vector3(-0.35, 0.62, -0.7).normalize();
const NEST = { x: 42, z: -24 };
// torch holders [x, z] and where their beams land
const TORCH = [[NEST.x - 1.2, NEST.z + 4.5, NEST.x - 0.4, NEST.z + 6.5], [NEST.x - 2.8, NEST.z + 7.5, NEST.x - 1.6, NEST.z + 9.4]];
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// tide (metres relative to mean sea level) during the time-lapse shot
const T0 = shotStart('T'), T1 = shotEnd('T');
const tideNow = (t) => lerp(-0.8, 0.8, easeInOut(clamp((t - T0 - 0.6) / (T1 - T0 - 1.6))));
// ice wall position (z of its front face) from the moment it appears
const wallZ = (t) => {
  if (t < shotStart('G')) return 9000;
  if (t < shotStart('F')) return lerp(2300, 1000, (t - shotStart('G')) / (shotStart('F') - shotStart('G')));
  if (t < shotStart('H')) return lerp(650, 70, easeInOut((t - shotStart('F')) / (shotStart('H') - shotStart('F'))));
  return lerp(70, -38, easeOut(clamp((t - shotStart('H')) / 2.6)));
};
// Earth's obliquity shown in the space shots
const TILT = [[38.8, 23.4], [42.0, 23.4], [44.5, 25.9], [46.5, 21.8], [49.0, 27.3], [80, 27.3]];
const tiltAt = (t) => { for (let i = 0; i < TILT.length - 1; i++) { const [a, va] = TILT[i], [b, vb] = TILT[i + 1]; if (t <= b) return lerp(va, vb, easeInOut(clamp((t - a) / (b - a)))); } return 27.3; };

export default {
  id: 'moon-gone',
  title: 'What if the Moon suddenly disappeared?',
  endFact: 'The Moon is slowly drifting away from Earth,<br>about 3.8 cm every year.',
  duration: 80,
  titleIn: [-1, -0.5],
  titleOut: [3.0, 3.6],
  fadeOut: FADE,
  endAt: END,
  crackAt: [540, 820],
  captions: [
    [3.6, 6.9, 'The Moon is simply gone.'],
    [7.1, 10.3, 'No explosion. No sound.'],
    [10.6, 13.8, 'The first thing you notice is the dark.'],
    [14.0, 17.2, 'Every night is now a moonless night.'],
    [17.6, 20.9, 'The next day, the tide comes in.'],
    [21.1, 24.4, 'It stops at less than half the height.'],
    [24.8, 27.9, 'Only the Sun is pulling on the ocean now.'],
    [28.2, 31.5, 'Weeks later, sea turtles hatch.'],
    [31.7, 35.0, 'They crawl toward the brightest horizon.'],
    [35.4, 38.6, 'Without moonlight on the sea, more get lost.'],
    [39.0, 42.3, 'But the biggest change is slower.'],
    [42.5, 45.8, "The Moon kept Earth's tilt steady."],
    [46.0, 49.4, 'Without it, the tilt starts to wander.'],
    [49.8, 53.1, 'How far, scientists still debate.'],
    [53.3, 56.6, 'But tilt changes help trigger ice ages.'],
    [57.0, 60.2, 'Bigger swings could mean colder ones.'],
    [60.6, 63.9, 'In the last ice age, the ice reached New York.'],
  ],
  hud(t) {
    if (t < VANISH) {
      const g = (t > 1.42 && t < 1.56) || t > 1.78;
      return { label: 'The Moon', value: g ? glitch('384,400 km', t) : '384,400 km', sub: t > 1.78 ? 'signal lost' : 'distance from earth' };
    }
    if (t < shotStart('C')) { const s = Math.floor(t - VANISH); return { label: 'The Moon', value: 'GONE', sub: `00:00:${String(s).padStart(2, '0')} · midnight` }; }
    if (t < shotStart('T')) {
      const k = smooth(shotStart('C') + 0.3, shotStart('C') + 2.2, t);
      const lux = Math.exp(lerp(Math.log(0.25), Math.log(0.0025), k));
      return { label: 'Moonlight', value: `${lux < 0.01 ? lux.toFixed(4) : lux.toFixed(2)} lux`, sub: k > 0.99 ? 'nights about 100× darker' : 'full moon' };
    }
    if (t < shotStart('E')) {
      const lv = tideNow(t);
      const hrs = clamp((t - T0) / (T1 - T0)) * 6.2;
      return { label: 'High tide', value: `${lv >= 0 ? '+' : '−'}${Math.abs(lv).toFixed(1)} m`, sub: `normally +1.9 m · ${hrs.toFixed(1)} h` };
    }
    if (t < shotStart('D')) {
      const k = smooth(shotStart('E') + 0.6, shotStart('E') + 2.4, t);
      return { label: 'Tide-raising force', value: `${Math.round(lerp(100, 31, k))}%`, sub: k > 0.99 ? 'the sun alone' : 'sun + moon' };
    }
    if (t < shotStart('X1')) return { label: 'Since the Moon vanished', value: '6 weeks', sub: 'sea turtles hatching' };
    if (t < shotStart('G')) {
      const yrs = t < 42 ? 0 : Math.pow(10, lerp(3, 7.3, clamp((t - 42) / (shotStart('G') - 42))));
      return { label: "Earth's tilt", value: `${tiltAt(t).toFixed(1)}°`, sub: yrs < 1 ? 'steady' : `+${fmt(yrs)} years` };
    }
    if (t < HERE) return { label: 'Ice sheet', value: `${Math.max(0, (wallZ(t) + 38) / 1000).toFixed(1)} km`, sub: 'advancing' };
    return { label: 'The ice', value: 'HERE', sub: '' };
  },
  audio: [
    // ---- the hook: build, stutter, the Moon goes, everything drops out
    { type: 'ambience', t0: 0, t1: shotStart('C') + 0.5, kind: 'night-city', level: 0.5, fin: 0.03 },
    { type: 'water', t0: 0, t1: shotStart('T'), level: 0.5 },
    { type: 'pulse', t0: shotStart('C') + 0.3, t1: shotStart('T') - 0.3, bpm: [58, 64], level: 0.32 },
    { type: 'crowd', t0: 0, t1: shotStart('C') + 0.8, level: 0.6, voices: 22, fin: 0.03, swell: [[0, 1], [1.42, 1], [1.6, 0.5], [VANISH, 0.45], [VANISH + 2.6, 0.85], [shotStart('C'), 0.7]] },
    { type: 'drone', t0: 0, t1: shotStart('T'), root: 50, chord: [0, 3, 7, 12], level: 0.32, fin: 0.05, swell: [[0, 0.45], [VANISH, 0.95], [VANISH + 0.1, 0.2], [7, 0.45], [16, 0.3]] },
    { type: 'pulse', t0: 0.05, t1: VANISH - 0.12, bpm: [78, 124], level: 0.55 },
    { type: 'riser', t0: 0.25, t1: VANISH, level: 0.3 },
    { type: 'duck', keys: [[0, 1], [VANISH - 0.02, 1], [VANISH + 0.03, 0.05], [VANISH + 0.9, 0.08], [VANISH + 1.7, 0.75], [VANISH + 2.5, 1], [80, 1]] },
    { type: 'boom', t: VANISH, level: 0.75, low: true, free: true },
    { type: 'braam', t: VANISH, level: 0.6, root: 31, decay: 1.5, free: true },
    { type: 'ring', t: VANISH + 0.08, level: 0.1, free: true },
    { type: 'gasp', t: VANISH + 0.8, level: 0.6, free: true },
    // ---- the days after
    { type: 'whoosh', t: shotStart('T') - 0.4, level: 0.4 },
    { type: 'ambience', t0: shotStart('T'), t1: shotStart('E'), kind: 'coast', gulls: 1, level: 0.85 },
    { type: 'crowd', t0: shotStart('T'), t1: shotStart('E'), level: 0.45, voices: 14, seed: 4 },
    { type: 'riser', t0: shotStart('E') - 1.4, t1: shotStart('E'), level: 0.22 },
    { type: 'drone', t0: shotStart('E'), t1: shotStart('D'), root: 43, chord: [0, 7, 12], level: 0.45, fin: 0.3 },
    { type: 'water', t0: shotStart('D'), t1: shotStart('X1'), level: 0.5 },
    { type: 'ambience', t0: shotStart('D'), t1: shotStart('X1'), kind: 'night-quiet', level: 0.6 },
    { type: 'pulse', t0: shotStart('D') + 3.5, t1: shotStart('X1') - 0.2, bpm: [60, 72], level: 0.36 },
    // ---- the slow change, then the ice
    { type: 'braam', t: shotStart('X1'), level: 0.45, root: 29 },
    { type: 'drone', t0: shotStart('X1'), t1: shotStart('W'), root: 41, chord: [0, 5, 12, 15], level: 0.34, swell: [[38.8, 0.2], [46, 0.5], [49.6, 0.35]] },
    { type: 'pulse', t0: 42.3, t1: shotStart('W'), bpm: [56, 74], level: 0.3 },
    { type: 'ambience', t0: shotStart('W'), t1: HERE, kind: 'wind', level: 0.55 },
    { type: 'creak', t0: shotStart('W') + 2, t1: HERE, level: 0.5 },
    { type: 'riser', t0: shotStart('G') - 1.6, t1: shotStart('G'), level: 0.3 },
    { type: 'braam', t: shotStart('G'), level: 0.6, root: 28 },
    { type: 'pulse', t0: shotStart('G'), t1: HERE - 0.05, bpm: [72, 156], level: 0.55 },
    { type: 'rumble', t0: shotStart('G'), t1: HERE + 0.6, level: 0.6 },
    { type: 'siren', t0: shotStart('G'), t1: HERE + 0.4, level: 0.28, period: 5.5 },
    { type: 'crowd', t0: shotStart('F') - 0.5, t1: HERE, level: 0.5, voices: 26, seed: 9 },
    { type: 'drone', t0: shotStart('G'), t1: FADE[1], root: 36, chord: [0, 1, 7, 12], level: 0.42, swell: [[56.8, 0.3], [64, 1.0], [67, 0.5]] },
    { type: 'riser', t0: HERE - 2.4, t1: HERE, level: 0.42 },
    { type: 'glass', t: HERE, level: 0.8, free: true },
    { type: 'boom', t: HERE, level: 0.8, low: true, free: true },
    { type: 'braam', t: HERE, level: 0.5, root: 26, free: true },
    { type: 'ring', t: HERE + 0.1, level: 0.08, free: true },
    { type: 'duck', keys: [[0, 1], [HERE - 0.02, 1], [HERE + 0.05, 0.25], [FADE[1], 0.15], [END, 1], [80, 1]] },
    { type: 'chime', t: END, level: 0.5, free: true },
  ],

  async setup(ctx) {
    const { scene, renderer } = ctx;
    const st = this.st = {};
    const r = new Rng(384400);
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    ctx.grain = 0;
    ctx.handheld = 0.3;
    ctx.vignette = 0.7;
    scene.fog = new THREE.Fog('#141c33', 400, 5000);

    // ---- city: grid starts at the coast road (z = 22) and runs inland (+z)
    const city = buildCity({
      seed: 44, x0: -1300, x1: 1300, z0: 22, z1: 1900,
      height: (x, z, rr) => {
        const d = z - 22;
        const core = Math.exp(-((x - 150) ** 2 + (z - 950) ** 2) / (2 * 380 * 380));
        return 12 + rr.float(0, 16) + smooth(220, 40, d) * rr.float(8, 34) + core * rr.float(30, 210) * (rr.chance(0.75) ? 1 : 0.35);
      },
      isPark: (i, j) => (i === 9 && j === 3),
      texSize: 4096,
    });
    scene.add(city.group);
    city.ground.material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, 1), -14)];   // keep the ground inland of the promenade
    const fac = st.fac = city.facade.userData.uniforms;
    fac.uLodLo.value = 0.2 / ctx.SCALE; fac.uLodHi.value = 0.45 / ctx.SCALE;
    st.city = city;

    // ---- seafront set
    const sf = st.sf = buildSeafront({ x0: -700, x1: 700, city });
    scene.add(sf.group);

    // ---- sky, Moon, stars
    const sky = st.sky = buildSky({ seed: 12, clouds: 20, cloudAlt: [900, 1600], stars: 3500 });
    scene.add(sky.group);
    const moonTex = await new THREE.TextureLoader().loadAsync('/assets/moon.png'); moonTex.colorSpace = THREE.SRGBColorSpace;
    st.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, color: '#fff7ea' }));
    st.moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeSoftTexture(), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, color: '#8796c4' }));
    st.moon.renderOrder = -6; st.moonGlow.renderOrder = -7;
    scene.add(st.moonGlow, st.moon);

    // ---- sea
    const water = st.water = buildWater({ level: SF.MSL, terrainGLSL: TERRAIN_GLSL });
    const wu = water.uniforms;
    wu.uShore.value = 1; wu.uChop.value = 0.45; wu.uChopDist.value = 700; wu.uSurfW.value = 0.5;
    scene.add(water.mesh);

    // ---- lights
    st.hemi = new THREE.HemisphereLight('#2b3a63', '#0d0d12', 0.6);
    st.key = new THREE.DirectionalLight('#a9bce8', 0.5);
    st.key.castShadow = true;
    st.key.shadow.mapSize.set(2048, 2048);
    st.key.shadow.bias = -0.0005; st.key.shadow.normalBias = 0.03; st.key.shadow.radius = 2.5;
    scene.add(st.hemi, st.key, st.key.target);
    st.cityGlow = new THREE.DirectionalLight('#ffb878', 0);      // warm light from the seafront, for the beach at night
    scene.add(st.cityGlow, st.cityGlow.target);
    st.torches = [0, 1].map(() => { const L = new THREE.SpotLight('#fff1cf', 0, 14, 0.42, 0.6, 1.2); scene.add(L, L.target); return L; });
    // warm pools from the promenade lamps nearest the camera
    st.lampLights = [];
    for (let i = 0; i < 4; i++) { const L = new THREE.PointLight('#ffc98a', 0, 28, 1.6); scene.add(L); st.lampLights.push(L); }
    st.glows = new GlowLayer(4000, { fadeNear: 900, fadeFar: 5000 });
    scene.add(st.glows.points);

    // ---- people and traffic
    st.ppl = buildPeople({ max: 700, seed: 3 });
    scene.add(st.ppl.group);
    st.veh = buildVehicles({ max: 80, seed: 4 });
    scene.add(st.veh.group);
    castPeople.call(this, r);
    castTraffic.call(this, r);

    // ---- beach props for the day scene: umbrellas and towels
    st.umbrellas = buildUmbrellas(new Rng(8));
    scene.add(st.umbrellas.group);

    // ---- hatchlings
    st.turtles = buildHatchlings(new Rng(31), 60);
    scene.add(st.turtles.group);

    // ---- the ice sheet (faces the sea, ice behind it toward +z)
    st.glacier = buildGlacier();
    st.glacier.rotation.y = Math.PI;
    scene.add(st.glacier);
    st.dust = new Particles(260, { map: makeSmokeTexture(9) });
    scene.add(st.dust.mesh);

    // ---- space cutaways (their own scene)
    st.space = buildSpace(new Rng(77));
  },

  update(ctx, t, dt) {
    const st = this.st, [s0, shot] = shotAt(t);
    const u = (t - s0) / (shotEnd(shot === 'END' ? 'H' : shot) - s0);
    const { sky, water, fac, sf } = st;
    const wu = water.uniforms;
    ctx.view = null;
    ctx.snow = 0; ctx.shake = 0; ctx.tint = null; ctx.crack = 0; ctx.flash = 0;
    ctx.cam.near = 0.3; ctx.cam.roll = 0; ctx.handheld = 0.3;

    // ------------------------------------------------ environment by shot
    const night = ['A', 'B1', 'B2', 'C', 'D', 'R'].includes(shot);
    const winter = ['W', 'G', 'F', 'H'].includes(shot);
    const moonUp = t < VANISH;
    if (night) {
      const m = moonUp ? flick(t) : 0;
      sky.uniforms.uZenith.value.set(moonUp ? '#0d1a3a' : '#060a16');
      sky.uniforms.uHorizon.value.set(moonUp ? '#2a3d68' : '#121b30');
      sky.uniforms.uBelow.value.set('#05070c');
      sky.uniforms.uSunDisk.value = 0; sky.uniforms.uSunGlow.value = 0;
      sky.starU.uStars.value = m ? 0.45 : 1.0;
      sky.cloudTint(new THREE.Color('#1a2238'), m ? 0.25 : 0.0);
      scene(ctx).fog.color.set(m ? '#18233f' : '#070a13');
      st.hemi.color.set(m ? '#3a4d80' : '#141c33'); st.hemi.groundColor.set('#0a0a0e'); st.hemi.intensity = m ? 0.7 : 0.45;
      st.key.color.set('#a9bce8'); st.key.intensity = m ? 0.9 : 0.16;   // after: only sky glow and the city
      st.key.position.copy(MOON_DIR).multiplyScalar(300);
      fac.uNight.value = 1; fac.uLit.value = 0.45; fac.uWallMul.value = 0.35;
      wu.uDeep.value.set('#050a16'); wu.uSky.value.set(m ? '#2c3d66' : '#0b1222'); wu.uSkyTop.value.set(m ? '#1a2850' : '#070b16');
      wu.uSunDir.value.copy(MOON_DIR); wu.uSpec.value = 0; wu.uShallow.value.set('#0d2430');
      wu.uPathStr.value = m * 0.75; wu.uPathRough.value = 0.07; wu.uPathCol.value.set('#dfe7ff');
      wu.uFoamCol.value.set('#5d6878');
      st.veh.lampU.k = 1.6; sf.lensMat.color.setScalar(1.4);
      sf.beachU.uDark.value = m ? 0.25 : (shot === 'D' || shot === 'R') ? 0.2 : 0.45;
      for (const s of sf.shops) s.material.emissiveIntensity = 0.55;
    } else if (winter) {
      sky.uniforms.uZenith.value.set('#8e9aa6'); sky.uniforms.uHorizon.value.set('#d5dbe0'); sky.uniforms.uBelow.value.set('#c6ccd2');
      sky.uniforms.uSunDisk.value = 0; sky.uniforms.uSunGlow.value = 0.15; sky.uniforms.uSunDir.value.copy(SUN_DAY);
      sky.starU.uStars.value = 0;
      sky.cloudTint(new THREE.Color('#e4e8ec'), 0.85);
      scene(ctx).fog.color.set('#cfd5db');
      st.hemi.color.set('#e4ecf4'); st.hemi.groundColor.set('#8c939a'); st.hemi.intensity = 1.35;
      st.key.color.set('#f0f4ff'); st.key.intensity = 1.0; st.key.position.copy(SUN_DAY).multiplyScalar(300);
      fac.uNight.value = 0.15; fac.uWallMul.value = 0.85;
      wu.uDeep.value.set('#2d4652'); wu.uSky.value.set('#cfd6dd'); wu.uSkyTop.value.set('#9aa6b2');
      wu.uSunDir.value.copy(SUN_DAY); wu.uSpec.value = 0.2; wu.uPathStr.value = 0; wu.uShallow.value.set('#4f7f86');
      wu.uFoamCol.value.set('#e6ebee');
      st.veh.lampU.k = 0.6; sf.lensMat.color.setScalar(0.5);
      sf.beachU.uDark.value = 0;
      for (const s of sf.shops) s.material.emissiveIntensity = 0;
    } else {
      // clear summer day
      sky.uniforms.uZenith.value.set('#3f78c0'); sky.uniforms.uHorizon.value.set('#cfe1ee'); sky.uniforms.uBelow.value.set('#a9b8c4');
      sky.uniforms.uSunDisk.value = 1; sky.uniforms.uSunGlow.value = 0.6; sky.uniforms.uSunDir.value.copy(SUN_DAY);
      sky.starU.uStars.value = 0;
      sky.cloudTint(new THREE.Color('#ffffff'), 0.9);
      scene(ctx).fog.color.set('#c9dbe8');
      st.hemi.color.set('#d9e9ff'); st.hemi.groundColor.set('#9a8b72'); st.hemi.intensity = 1.15;
      st.key.color.set('#fff1dc'); st.key.intensity = 2.6; st.key.position.copy(SUN_DAY).multiplyScalar(300);
      fac.uNight.value = 0; fac.uWallMul.value = 1;
      wu.uDeep.value.set('#1d5468'); wu.uSky.value.set('#c4d8e6'); wu.uSkyTop.value.set('#6d9cc8');
      wu.uSunDir.value.copy(SUN_DAY); wu.uSpec.value = 0.9; wu.uPathStr.value = 0.35; wu.uPathRough.value = 0.12; wu.uPathCol.value.set('#fff6e0');
      wu.uShallow.value.set('#3fb0a8'); wu.uFoamCol.value.set('#f4f6f2');
      st.veh.lampU.k = 0.35; sf.lensMat.color.setScalar(0.45);
      sf.beachU.uDark.value = 0;
      for (const s of sf.shops) s.material.emissiveIntensity = 0;
    }
    scene(ctx).fog.near = winter ? 350 : 500; scene(ctx).fog.far = winter ? 4200 : 6000;

    // the Moon
    const moonVis = moonUp && night;
    st.moon.visible = st.moonGlow.visible = moonVis;
    if (moonVis) {
      const camP = ctx.camera.position;
      st.moon.position.copy(camP).addScaledVector(MOON_DIR, 9000); st.moon.scale.setScalar(1100);
      st.moonGlow.position.copy(st.moon.position); st.moonGlow.scale.setScalar(5200); st.moonGlow.material.opacity = 0.55 * flick(t);
      st.moon.material.opacity = flick(t);
    }

    // ------------------------------------------------ sea level, beach, snow, ice
    let level = SF.MSL - 0.3;
    if (shot === 'T') level = SF.MSL + tideNow(t);
    if (['D', 'R'].includes(shot)) level = SF.MSL - 0.6;
    water.level = level;
    sf.beachU.uWetY.value = level + (shot === 'T' ? 0.15 : 0.35);
    sf.beachU.uWrackY.value = SF.MSL + 1.9;
    sf.beachU.uWrack.value = ['T', 'D', 'R'].includes(shot) ? 1 : 0.5;
    const snow = shot === 'W' ? smooth(shotStart('W') + 0.5, shotStart('W') + 4.5, t) : winter ? 1 : 0;
    sf.snowU.uSnow.value = snow; fac.uSnow.value = snow; st.city.ground.material.userData.uniforms && (st.city.ground.material.userData.uniforms.uSnow.value = snow);
    wu.uFreeze.value = shot === 'W' ? 0.75 * smooth(shotStart('W') + 2.5, shotStart('W') + 6.5, t) : winter ? 0.75 : 0;
    ctx.snow = shot === 'W' ? 0.6 * smooth(shotStart('W'), shotStart('W') + 1.5, t) : winter ? 0.45 : 0;
    wu.uTime.value = t; fac.uTime.value = t;

    // ------------------------------------------------ actors
    st.ppl.update(t);
    st.veh.update(t);
    st.umbrellas.group.visible = shot === 'T';
    st.turtles.group.visible = shot === 'D' || shot === 'R';
    if (st.turtles.group.visible) st.turtles.update(t - shotStart('D'));
    st.glacier.visible = ['G', 'F', 'H'].includes(shot);
    st.glacier.position.set(0, -6, wallZ(t));

    // glows: lamps, car lights, phone screens
    const camera = ctx.camera;
    st.glows.begin();
    if (night) {
      for (const p of sf.lamps) st.glows.add(p.x, p.y - 0.15, p.z - 0.9, 1.0, 0.78, 0.48, 3.2);
      st.veh.lamps(t, (x, y, z, kind) => kind === 'head' ? st.glows.add(x, y, z, 1.0, 0.92, 0.75, 1.6) : st.glows.add(x, y, z, 0.9, 0.08, 0.05, 1.0));
      for (const p of st.ppl.phoneGlows) st.glows.add(p.x, p.y, p.z, 0.55, 0.65, 0.85, 0.5);
    }
    st.glows.end(camera, 1920 * ctx.SCALE);
    // light pools from the lamps nearest the camera
    const lampNear = sf.lamps.map((p) => [p, p.distanceToSquared(ctx.cam.pos)]).sort((a, b) => a[1] - b[1]).slice(0, st.lampLights.length);
    st.lampLights.forEach((L, i) => { const p = lampNear[i][0]; L.position.set(p.x, p.y - 0.4, p.z - 0.9); L.intensity = 60; L.visible = night; });

    // warm rim light from the promenade on the beach at night
    st.cityGlow.intensity = shot === 'D' ? 2.4 : 1.4; st.cityGlow.visible = shot === 'D' || shot === 'R';
    st.cityGlow.target.position.set(NEST.x, beachY(NEST.x, NEST.z), NEST.z);
    st.cityGlow.position.set(NEST.x, beachY(NEST.x, NEST.z) + 9, NEST.z + 30);
    // the two volunteers' torches light the sand in front of them
    TORCH.forEach(([x, z, tx, tz], i) => {
      const L = st.torches[i];
      L.intensity = 40; L.visible = shot === 'R';
      L.position.set(x, beachY(x, z) + 1.05, z); L.target.position.set(tx, beachY(tx, tz), tz);
    });

    // snow dust thrown up where the ice sheet bulldozes the city
    if (shot === 'F' || shot === 'H') {
      const rr = new Rng(Math.round(t * 30) + 999), wz = wallZ(t);
      for (let k = 0; k < 7; k++) st.dust.spawn({ pos: new THREE.Vector3(rr.float(-160, 160), rr.float(0, 40), wz - rr.float(0, 15)), vel: new THREE.Vector3(rr.float(-3, 3), rr.float(1, 7), -rr.float(5, 14)), life: rr.float(2.5, 4.5), size: [rr.float(10, 18), rr.float(40, 80)], color: new THREE.Color('#eef2f6'), alpha: 0.6, drag: 0.5 });
    }
    st.dust.step(dt || 0); st.dust.flush(ctx.camera);
    st.dust.mesh.visible = shot === 'F' || shot === 'H';

    // ------------------------------------------------ cameras
    const c = ctx.cam;
    camShot.call(this, ctx, shot, u, t);
    // keep the shadow box around what the camera looks at
    const focus = c.look.clone(); if (focus.distanceTo(c.pos) > 60) focus.copy(c.pos).addScaledVector(focus.sub(c.pos).normalize(), 40);
    st.key.target.position.copy(focus);
    st.key.position.copy(focus).addScaledVector(night ? MOON_DIR : SUN_DAY, 200);
    const sb = ['C', 'T', 'W', 'G'].includes(shot) ? 120 : 45;
    Object.assign(st.key.shadow.camera, { left: -sb, right: sb, top: sb, bottom: -sb, near: 10, far: 500 });
    st.key.shadow.camera.updateProjectionMatrix();

    sky.update(t, camera);

    // space cutaways
    if (shot === 'E' || shot === 'X1' || shot === 'X2') {
      st.space.update(t, shot, u);
      ctx.view = { scene: st.space.scene, camera: st.space.camera };
    }
  },
};

const scene = (ctx) => ctx.scene;

// ---------------------------------------------------------------- cameras
function camShot(ctx, shot, u, t) {
  const c = ctx.cam;
  const e = easeInOut(u);
  switch (shot) {
    case 'A': {      // over the shoulders of the crowd at the railing, the Moon high over the sea
      const k = easeOut(clamp(t / 2.3));
      c.pos.set(1.9 + 0.3 * k, lerp(1.62, 2.6, k), lerp(6.6, 5.0, k) - 0.25 * Math.max(0, t - 2.3));
      c.look.set(1.9 + 12, lerp(1.62 + 15, 2.6 + 22, k), -260);
      c.fov = 50; ctx.handheld = 0.25;
      ctx.shake = t > VANISH ? 0.55 * Math.exp(-(t - VANISH) * 3.5) : 0;
      break;
    }
    case 'B1': {     // from the beach side, low, looking up at the crowd along the railing
      c.pos.set(lerp(-7, 1, e), 1.75, -4.6);
      c.look.set(lerp(-5, 3, e), 1.45, 4);
      c.fov = 46; ctx.handheld = 0.35;
      break;
    }
    case 'B2': {     // closer on the family
      c.pos.set(lerp(10.4, 9.2, e), 1.5, -4.3);
      c.look.set(8.7, 1.4, 2.0);
      c.fov = 40; ctx.handheld = 0.4;
      break;
    }
    case 'C': {      // crane up and back over the road: the dark seafront and sea
      c.pos.set(lerp(-4, -14, e), lerp(-1.2, 22, e), lerp(-34, -95, e));
      c.look.set(lerp(2, 6, e), lerp(3, 14, e), 40);
      c.fov = 52; ctx.handheld = 0.15;
      break;
    }
    case 'T':
    case 'W': {      // over the road, looking across the promenade and down the beach to the sea (same frame both seasons)
      c.pos.set(lerp(-24, -18, e), lerp(15, 14, e), lerp(19, 18, e));
      c.look.set(lerp(6, 10, e), -6.5, -55);
      c.fov = 50; ctx.handheld = 0.15;
      break;
    }
    case 'D': {      // on the sand behind the nest, looking at the lights
      c.pos.set(NEST.x - 1.1 + u * 0.5, beachY(NEST.x, NEST.z - 1.4) + 0.75 - u * 0.1, NEST.z - 1.3 + u * 0.9);
      c.look.set(NEST.x + 1.2, beachY(NEST.x, NEST.z + 2) + 0.25, NEST.z + 2.6);
      c.fov = 46; c.near = 0.03; ctx.handheld = 0.1;
      break;
    }
    case 'R': {      // volunteers with torches
      c.pos.set(lerp(NEST.x - 9, NEST.x - 6, e), beachY(NEST.x - 8, NEST.z - 6) + 1.5, NEST.z - 6);
      c.look.set(NEST.x + 1, beachY(NEST.x, NEST.z + 4) + 0.4, NEST.z + 5);
      c.fov = 46; c.near = 0.1; ctx.handheld = 0.3;
      break;
    }
    case 'G': {      // standing on the frozen sea, looking back at the city: the ice sheet rises behind it
      c.pos.set(lerp(-30, -18, e), lerp(34, 40, e), -280);
      c.look.set(30, 150, 900);
      c.fov = 50; ctx.handheld = 0.3;
      break;
    }
    case 'F': {      // low on the frozen beach, people running toward us
      c.pos.set(4, beachY(4, -48) + 1.7, lerp(-46, -52, e));
      c.look.set(2, lerp(30, 70, e), 160);
      c.fov = 56; ctx.handheld = 0.6;
      ctx.shake = 0.15 + 0.35 * u;
      break;
    }
    case 'H': {      // the wall arrives
      c.pos.set(4, beachY(4, -52) + 1.7, -52);
      c.look.set(2, lerp(70, 140, e), 160);
      c.fov = 58; ctx.handheld = 0.6;
      ctx.shake = (t < HERE ? 0.6 : 0.2 + Math.exp(-(t - HERE) * 2.5) * 1.2);
      ctx.crack = t > HERE ? clamp((t - HERE) / 0.25) : 0;
      ctx.tint = { color: 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(220,235,255,0) 35%, rgba(225,238,255,0.5) 75%, rgba(240,248,255,0.92) 100%)', opacity: smooth(HERE - 1.4, HERE + 0.3, t), blend: 'normal' };
      break;
    }
    default: {
      c.pos.set(0, 30, 40); c.look.set(0, 0, -100); c.fov = 50;
    }
  }
}

// ---------------------------------------------------------------- the cast
function castPeople(r) {
  const P = this.st.ppl;
  const on = (...ids) => (t) => ids.includes(shotAt(t)[1]);
  const nightCrowd = on('A', 'B1', 'B2', 'C');
  const react = (rr) => VANISH + rr.float(0.15, 1.1);

  // the railing crowd: watching, many filming with phones
  for (let i = 0; i < 70; i++) {
    const x = -26 + i * 0.75 + r.float(-0.25, 0.25), z = 0.95 + r.float(0, 0.9) + (i % 3 === 0 ? 0.7 : 0);
    if (x > 6.4 && x < 10.8) continue;     // room for the family
    const filming = r.chance(0.55), kid = r.chance(0.08);
    const tr = react(r);
    const after = r.pick(['point', 'handsHead', 'phoneLow', 'shrug', 'lookUp', 'point', 'phoneLow']);
    const turn = r.float(-0.9, 0.9);
    P.add({
      x, z, h: Math.PI + r.float(-0.25, 0.25), kid,
      poses: [[0, filming ? 'phone' : 'lookUp'], [tr, after, 0.35], [tr + r.float(2.5, 4.5), r.pick(['phoneLow', 'lookUp', 'shrug', 'idle']), 0.6]],
      phone: filming ? () => true : null,
      turn: (t) => turn * smooth(tr + 0.6, tr + 1.6, t),
      visible: nightCrowd,
    });
  }
  // the family in close-up (B2): parent with a phone, a kid pointing, another adult with hands on head
  const fam = [
    { x: 7.9, z: 1.3, h: Math.PI - 0.15, poses: [[0, 'phone'], [VANISH + 0.3, 'phoneLow', 0.4], [8.6, 'shrug', 0.5]], phone: () => true, shirt: '#2e86c1' },
    { x: 8.65, z: 1.15, h: Math.PI + 0.1, kid: true, poses: [[0, 'point'], [VANISH + 0.4, 'lookUp', 0.3], [7.6, 'point', 0.4]], shirt: '#f4d03f' },
    { x: 9.35, z: 1.4, h: Math.PI + 0.25, poses: [[0, 'lookUp'], [VANISH + 0.5, 'handsHead', 0.35], [9.4, 'idle', 0.6]], shirt: '#c0392b', hair: 'long', turn: (t) => -0.7 * smooth(8.0, 8.8, t) },
  ];
  for (const f of fam) P.add(Object.assign({ visible: nightCrowd }, f));
  // walkers on the promenade who stop and look up
  for (let i = 0; i < 70; i++) {
    const dir = r.chance(0.5) ? 1 : -1, z = r.float(4.5, 11.5), v = r.float(1.1, 1.5);
    const x0 = r.float(-140, 140) - dir * v * 4;
    const stop = r.chance(0.8) ? react(r) + r.float(0, 0.8) : 99;
    const xAt = (t) => x0 + dir * v * (t < stop ? t : stop + 0.5 * (1 - Math.exp(-(t - stop) * 2)));
    P.add({
      at: (t) => {
        const tt = t < stop ? t : stop + 0.5 * (1 - Math.exp(-(t - stop) * 2));
        return { x: x0 + dir * v * tt, z, h: dir > 0 ? Math.PI / 2 : -Math.PI / 2, moving: t < stop + 0.4 ? 1 : 0, dist: v * tt };
      },
      hide: (t) => shotAt(t)[1] === 'A' && Math.abs(xAt(t) - 0.6) < 5 && z > 3.2,
      poses: [[0, 'auto'], [stop + 0.3, 'lookUp', 0.5], [stop + 3, r.pick(['point', 'phone', 'lookUp']), 0.6]],
      phone: (t) => t > stop + 2.5,
      turn: (t) => -dir * (Math.PI / 2) * smooth(stop, stop + 0.8, t) * 0.8,
      visible: nightCrowd,
    });
  }
  // sitting on benches
  for (const b of this.st.sf.benches.slice(25, 46)) {
    if (r.chance(0.4)) continue;
    for (const dx of [-0.45, 0.45]) if (r.chance(0.7)) P.add({ hide: (t) => shotAt(t)[1] === 'A' && Math.abs(b.x - 0.8) < 12, x: b.x + dx, z: b.z - 0.05, h: Math.PI, poses: [[0, 'sit'], [react(r), 'sit'], [react(r) + 1, 'sit']], visible: nightCrowd, headYaw: () => 0, extra: (t, po) => { po.head += -0.4 * smooth(VANISH, VANISH + 0.6, t); } });
  }

  // ---- the day at the beach (tide shot): sunbathers, umbrellas, walkers along the water
  const dayBeach = on('T');
  const yb = (x, z) => beachY(x, z);
  for (let i = 0; i < 70; i++) {
    const x = r.float(-60, 70), z = r.float(-15, -4);
    P.add({ x, z, h: r.float(-1, 1) + Math.PI, yAt: yb, poses: [[0, r.pick(['sit', 'sit', 'idle', 'lookUp', 'phoneLow'])]], phone: (t) => false, visible: dayBeach, shirt: r.pick(['#ffffff', '#e74c3c', '#f1c40f', '#3498db', '#1abc9c', '#ff7aa2']), longSleeve: false });
  }
  for (let i = 0; i < 40; i++) {
    // people walking along the water's edge, which moves up the beach with the tide
    const dir = r.chance(0.5) ? 1 : -1, v = r.float(1.0, 1.4), x0 = r.float(-80, 80), off = r.float(1, 7);
    P.add({
      at: (t) => { const lv = SF.MSL + tideNow(t); const zw = (lv - SF.wallY) / SF.slope; return { x: x0 + dir * v * (t - T0), z: zw + off, h: dir > 0 ? Math.PI / 2 : -Math.PI / 2, moving: 1, dist: v * t }; },
      yAt: yb, poses: [[0, 'auto']], visible: dayBeach, longSleeve: false,
    });
  }
  for (let i = 0; i < 30; i++) {
    // on the promenade above
    const dir = r.chance(0.5) ? 1 : -1, v = r.float(1.1, 1.5), x0 = r.float(-90, 90), z = r.float(3, 12);
    P.add({ path: [[x0 - dir * 200, z], [x0 + dir * 200, z]], v, t0: T0 - 120, poses: [[0, 'auto']], visible: dayBeach, longSleeve: false });
  }

  // ---- volunteers with torches (R)
  const vol = on('R', 'D');
  const VX = NEST.x, VZ = NEST.z;
  [[VX - 1.2, VZ + 4.5, 0.3, 'torch'], [VX + 1.6, VZ + 6.2, -0.5, 'crouch'], [VX - 2.8, VZ + 7.5, 0.6, 'torch'], [VX + 0.4, VZ + 9.5, Math.PI, 'crouch']].forEach(([x, z, h, pose], k) => {
    P.add({ x, z, h, yAt: yb, poses: [[0, pose]], torch: pose === 'torch' ? (t) => shotAt(t)[1] === 'R' : null, visible: on('R'), longSleeve: true, shirt: ['#1f3a5f', '#2c3e50', '#7b241c', '#145a32'][k] });
  });
  // silhouettes on the promenade above the turtles
  for (let i = 0; i < 26; i++) {
    const dir = r.chance(0.5) ? 1 : -1, v = r.float(1.1, 1.5), x0 = NEST.x + r.float(-60, 60), z = r.float(2, 10);
    P.add({ path: [[x0 - dir * 120, z], [x0 + dir * 120, z]], v, t0: 0, poses: [[0, 'auto']], visible: vol });
  }

  // ---- winter: people in coats on the frozen beach and skaters on the sea ice
  const coats = ['#1b2631', '#4a235a', '#7b241c', '#1f3a5f', '#212f3c', '#6e2c00', '#0e6251'];
  const iceY = SF.MSL - 0.3 + 0.02;
  for (let i = 0; i < 40; i++) {
    const cx = r.float(-50, 60), cz = r.float(-130, -70), rad = r.float(4, 14), w = r.float(0.25, 0.45) * (r.chance(0.5) ? 1 : -1), ph = r.float(0, 6.28);
    P.add({
      at: (t) => { const a = ph + w * t; return { x: cx + Math.cos(a) * rad, z: cz + Math.sin(a) * rad, h: Math.atan2(-Math.sin(a) * Math.sign(w), Math.cos(a) * Math.sign(w)), moving: 1, dist: Math.abs(w) * rad * t }; },
      y: iceY, poses: [[0, 'skate']], stride: 2.4, visible: (t) => shotAt(t)[1] === 'W' && t > shotStart('W') + 4.0, shirt: r.pick(coats), longSleeve: true,
    });
  }
  for (let i = 0; i < 40; i++) {
    const dir = r.chance(0.5) ? 1 : -1, v = r.float(0.9, 1.3), x0 = r.float(-70, 70), z = r.float(-40, -8);
    P.add({ path: [[x0 - dir * 100, z], [x0 + dir * 100, z]], v, t0: shotStart('W') - 50, yAt: yb, poses: [[0, 'auto']], visible: on('W', 'G'), shirt: r.pick(coats), longSleeve: true });
  }
  // fleeing: from the stairs and the beach toward the camera, across the ice
  for (let i = 0; i < 90; i++) {
    const x0 = r.float(-40, 50), z0 = r.float(-30, 2), v = r.float(3.2, 4.6), t0 = shotStart('F') - r.float(0, 2.5);
    const tx = 4 + r.float(-14, 14);
    P.add({
      at: (t) => { const d = Math.max(0, t - t0) * v; const dz = -1; const z = z0 - d; const x = lerp(x0, tx, clamp(d / 60)); return { x, z, h: Math.atan2(tx - x0, -60) , moving: 1, dist: d }; },
      yAt: (x, z) => Math.max(beachY(x, z), iceY), poses: [[0, 'run']], stride: 2.2, visible: on('F', 'H'), shirt: r.pick(coats), longSleeve: true,
    });
  }
}

function castTraffic(r) {
  const V = this.st.veh;
  const lanes = SF.lanes;
  for (let i = 0; i < 44; i++) {
    const li = i % 4, dir = li < 2 ? 1 : -1;
    const z = lanes[li];
    const path = dir > 0 ? [[-700, z], [700, z]] : [[700, z], [-700, z]];
    const v = r.float(9, 13);
    const s0 = (i / 44) * 1400 + r.float(-10, 10);
    const type = r.chance(0.06) ? 'bus' : undefined;
    // during the climax the traffic is gone (abandoned)
    V.add({ type, path, v, s0, loop: true, visible: (t) => !['W', 'G', 'F', 'H'].includes(shotAt(t)[1]) });
  }
}

// ---------------------------------------------------------------- props
function buildUmbrellas(r) {
  const group = new THREE.Group();
  const cols = ['#e74c3c', '#f1c40f', '#3498db', '#ffffff', '#1abc9c', '#e67e22', '#9b59b6'];
  const canopy = new THREE.ConeGeometry(1.25, 0.55, 8).translate(0, 2.2, 0);
  const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5).translate(0, 1.1, 0);
  const towel = new THREE.BoxGeometry(0.9, 0.02, 1.8);
  const n = 34;
  const um = new THREE.InstancedMesh(canopy, new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }), n);
  const pm = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: '#dddddd' }), n);
  const tm = new THREE.InstancedMesh(towel, new THREE.MeshStandardMaterial({ roughness: 0.9 }), n * 2);
  const M = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const x = r.float(-60, 70), z = r.float(-14, -4), y = beachY(x, z);
    M.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.float(-0.12, 0.12), r.float(0, 6), r.float(-0.12, 0.12))), new THREE.Vector3(1, 1, 1));
    um.setMatrixAt(i, M); pm.setMatrixAt(i, M); um.setColorAt(i, new THREE.Color(r.pick(cols)));
    for (let k = 0; k < 2; k++) {
      M.compose(new THREE.Vector3(x + r.float(-1.5, 1.5), beachY(x, z) + 0.02, z + r.float(-1.2, 1.2)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r.float(-0.5, 0.5), 0)), new THREE.Vector3(1, 1, 1));
      tm.setMatrixAt(i * 2 + k, M); tm.setColorAt(i * 2 + k, new THREE.Color(r.pick(cols)));
    }
  }
  um.castShadow = pm.castShadow = true; tm.receiveShadow = true;
  group.add(um, pm, tm);
  return { group };
}

function buildHatchlings(r, n) {
  const group = new THREE.Group();
  const shellG = new THREE.SphereGeometry(1, 14, 8); shellG.scale(0.045, 0.02, 0.055); shellG.translate(0, 0.018, 0);
  const headG = new THREE.SphereGeometry(0.015, 8, 6); headG.translate(0, 0.018, 0.064);
  const body = mergeGeometries([shellG, headG]);
  const flipG = new THREE.BoxGeometry(0.06, 0.006, 0.026); flipG.translate(0.03, 0, 0);
  { const fp = flipG.attributes.position; for (let i = 0; i < fp.count; i++) if (fp.getX(i) > 0.02) fp.setZ(i, fp.getZ(i) * 0.45 - 0.008); }
  const shellM = new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.3, metalness: 0.05 });
  const bodies = new THREE.InstancedMesh(body, shellM, n);
  const flips = new THREE.InstancedMesh(flipG, shellM, n * 4);
  bodies.frustumCulled = flips.frustumCulled = false;
  bodies.castShadow = true;
  group.add(bodies, flips);
  // the nest: a shallow pit with a rim of disturbed sand
  const pit = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8a7656', roughness: 1 }));
  pit.position.set(NEST.x, beachY(NEST.x, NEST.z) + 0.01, NEST.z);
  group.add(pit);
  const list = [];
  for (let i = 0; i < n; i++) {
    const seaward = r.chance(0.15);
    const ang = seaward ? Math.PI + r.float(-0.5, 0.5) : r.float(-0.5, 0.5);
    list.push({ x: NEST.x + r.gauss() * 0.22, z: NEST.z + r.gauss() * 0.2, ang, v: r.float(0.08, 0.14), start: r.float(-2, 6), ph: r.float(0, 6), wob: r.float(0.1, 0.35), s: r.float(1.5, 1.9) });
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), Sc = new THREE.Vector3(), F = new THREE.Matrix4();
  return {
    group,
    update(t) {
      list.forEach((h, i) => {
        const age = Math.max(0, t - h.start);
        const heading = h.ang + Math.sin(age * 1.3 + h.ph) * h.wob;
        const dist = h.v * age;
        const x = h.x + Math.sin(h.ang) * dist + Math.sin(age * 0.9 + h.ph) * 0.05;
        const z = h.z + Math.cos(h.ang) * dist;
        const emerge = clamp((t - h.start + 0.8) / 0.8);
        const gy = beachY(x, z) + 0.01 - 0.07 * (1 - emerge);
        E.set(Math.sin(age * 9 + h.ph) * 0.06 - 0.3 * (1 - emerge), heading, Math.sin(age * 9 + h.ph) * 0.08);
        Q.setFromEuler(E); P.set(x, gy, z); Sc.setScalar(h.s);
        M.compose(P, Q, Sc); bodies.setMatrixAt(i, M);
        const stroke = Math.sin(age * 9 + h.ph) * (t > h.start ? 1 : 0.3);
        [[0.03, 0.03, 1], [-0.03, 0.03, -1], [0.025, -0.035, 1], [-0.025, -0.035, -1]].forEach(([fx, fz, side], k) => {
          const swing = (k < 2 ? 0.7 : 0.4) * stroke * (k % 2 ? -1 : 1);
          F.makeRotationY((side > 0 ? -0.3 : Math.PI + 0.3) + swing);
          F.setPosition(fx, 0.012, fz);
          flips.setMatrixAt(i * 4 + k, new THREE.Matrix4().multiplyMatrices(M, F));
        });
      });
      bodies.instanceMatrix.needsUpdate = true; flips.instanceMatrix.needsUpdate = true;
    },
  };
}

function buildGlacier() {
  const g = new THREE.Group();
  const W = 6000, Hh = 640;
  const top = (x) => Hh * (0.8 + 0.1 * fbm1(x * 0.004, 3) + 0.07 * fbm1(x * 0.025, 2));
  let front = new THREE.PlaneGeometry(W, Hh, 400, 16);
  const pa = front.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y0 = pa.getY(i) + Hh / 2;
    const y = Math.min(y0, top(x));
    const jag = fbm1(x * 0.05 + y * 0.004, 2) * 12 + fbm1(x * 0.17 + y * 0.02, 2) * 5;
    pa.setXYZ(i, x + fbm1(y * 0.05 + x * 0.01, 2) * 6, y - 8, jag - (y / Hh) * 25);
  }
  front = front.toNonIndexed();
  const fp = front.attributes.position, cols = [];
  for (let i = 0; i < fp.count; i += 3) {
    const cx = (fp.getX(i) + fp.getX(i + 1) + fp.getX(i + 2)) / 3, cy = (fp.getY(i) + fp.getY(i + 1) + fp.getY(i + 2)) / 3;
    const k = clamp(cy / Hh);
    const crev = fbm1(cx * 0.06, 2);
    const c = new THREE.Color('#5d8fbd').lerp(new THREE.Color('#f2f7fb'), clamp(k * 0.9 + 0.25 + crev * 0.25)).lerp(new THREE.Color('#2c5a85'), clamp(-crev * 1.2) * 0.6);
    for (let v = 0; v < 3; v++) cols.push(c.r, c.g, c.b);
  }
  front.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  front.computeVertexNormals();
  const topG = new THREE.PlaneGeometry(W, 4000, 120, 20);
  topG.rotateX(-Math.PI / 2);
  const tp = topG.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i) - 2000;
    tp.setY(i, top(x) - 10 + Math.max(0, -z) * 0.06 + fbm1(x * 0.01 + z * 0.01, 2) * 8);
    tp.setZ(i, z - 20);
  }
  topG.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.0, flatShading: true, side: THREE.DoubleSide, emissive: '#7f9fbd', emissiveIntensity: 0.18, fog: false });
  const topMat = new THREE.MeshStandardMaterial({ color: '#eef4f8', roughness: 0.8, emissive: '#c8d6e0', emissiveIntensity: 0.25, fog: false });
  g.add(new THREE.Mesh(front, mat), new THREE.Mesh(topG, topMat));
  g.traverse((m) => { if (m.isMesh) m.frustumCulled = false; });
  return g;
}

// ---------------------------------------------------------------- space
function buildSpace(r) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#020308');
  const camera = new THREE.PerspectiveCamera(36, 1080 / 1920, 0.1, 5000);
  // stars
  const sp = [];
  for (let i = 0; i < 2500; i++) { const v = new THREE.Vector3(r.gauss(), r.gauss(), r.gauss()).normalize().multiplyScalar(1500); sp.push(v.x, v.y, v.z); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#cfd8ff', size: 1.6, sizeAttenuation: false })));
  // Earth: procedural continents
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const c = cv.getContext('2d');
  const img = c.createImageData(1024, 512);
  const hash = (i, j, k) => { let h = (i * 374761393 + j * 668265263 + k * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const vnoise = (x, y, z) => {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
    const L = (a, b, t) => a + (b - a) * t;
    return L(L(L(hash(i, j, k), hash(i + 1, j, k), sx), L(hash(i, j + 1, k), hash(i + 1, j + 1, k), sx), sy),
             L(L(hash(i, j, k + 1), hash(i + 1, j, k + 1), sx), L(hash(i, j + 1, k + 1), hash(i + 1, j + 1, k + 1), sx), sy), sz);
  };
  const fbm3 = (x, y, z) => { let v = 0, a = 0.5, f = 1; for (let o = 0; o < 6; o++) { v += a * vnoise(x * f + 17, y * f + 3, z * f + 9); f *= 2.03; a *= 0.5; } return v; };
  for (let j = 0; j < 512; j++) for (let i = 0; i < 1024; i++) {
    const lon = i / 1024 * Math.PI * 2, lat = (0.5 - j / 512) * Math.PI;
    const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
    const h = fbm3(x * 1.8, y * 1.8, z * 1.8) - 0.53;
    const cl = fbm3(x * 4 + 40, y * 6, z * 4);
    let col;
    if (Math.abs(lat) > 1.2 + 0.08 * Math.sin(lon * 5)) col = [236, 242, 248];
    else if (h > 0) { const g = clamp(h * 6); const dry = Math.abs(lat) < 0.5 && fbm3(x * 3, y * 3 + 7, z * 3) > 0.52; col = dry ? [lerp(196, 170, g), lerp(172, 140, g), lerp(118, 96, g)] : [lerp(78, 112, g), lerp(126, 116, g), lerp(60, 70, g)]; }
    else { const d = clamp(-h * 5); col = [lerp(36, 16, d), lerp(104, 52, d), lerp(160, 118, d)]; }
    const cw = smooth(0.56, 0.72, cl) * 0.85;
    col = col.map((v) => lerp(v, 245, cw));
    const k = (j * 1024 + i) * 4; img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const earthTilt = new THREE.Group(); scene.add(earthTilt);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  earthTilt.add(earth);
  // clouds + atmosphere rim
  const atm = new THREE.Mesh(new THREE.SphereGeometry(10.5, 48, 24), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(vec3(0.35,0.6,1.0)*f*1.4, 1.0); }',
  }));
  scene.add(atm);
  // the axis: a thin bright line through the poles
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 30, 8), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }));
  earthTilt.add(axis);
  // a faint ring showing where the axis used to point
  const ghostAxis = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 30, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, toneMapped: false }));
  scene.add(ghostAxis);
  // tidal bulge: an exaggerated translucent ocean shell
  const bulge = new THREE.Mesh(new THREE.SphereGeometry(10.15, 64, 32), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - abs(dot(vN, vV)); gl_FragColor = vec4(mix(vec3(0.2,0.55,1.0), vec3(0.7,0.9,1.0), f), 0.18 + 0.7*pow(f, 2.0)); }',
  }));
  scene.add(bulge);
  // the Moon (fades away) and the Sun's light
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.7, 32, 16), new THREE.MeshStandardMaterial({ color: '#b9b5ad', roughness: 1, transparent: true }));
  moon.position.set(-17, 25, -14);
  scene.add(moon);
  const sunDir = new THREE.Vector3(1, 0.15, 0.35).normalize();
  const sun = new THREE.DirectionalLight('#fff4e0', 3.0); sun.position.copy(sunDir).multiplyScalar(100);
  scene.add(sun, new THREE.AmbientLight('#2a3550', 0.35));
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeSoftTexture(), color: '#fff2c8', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sunSprite.position.copy(sunDir).multiplyScalar(900); sunSprite.scale.setScalar(420);
  scene.add(sunSprite);

  return {
    scene, camera,
    update(t, shot, u) {
      const e = easeInOut(u);
      earth.rotation.y = t * 0.25;
      if (shot === 'E') {
        axis.visible = ghostAxis.visible = false;
        earthTilt.rotation.set(0, 0, 0);
        // the bulge pointed at the Moon; it shrinks and swings to face the Sun
        const k = smooth(0.15, 0.7, u);
        const toMoon = new THREE.Vector3().subVectors(moon.position, bulge.position).normalize();
        const dir = toMoon.clone().lerp(sunDir, k).normalize();
        const amp = lerp(0.42, 0.13, k);
        bulge.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
        bulge.scale.set(1 + amp, 1 - amp * 0.35, 1 - amp * 0.35);
        bulge.visible = true;
        moon.visible = true; moon.material.opacity = 1 - smooth(0.0, 0.25, u);
        camera.position.set(lerp(-3, 2, e), lerp(5, 3, e), lerp(66, 60, e));
        camera.lookAt(-2, 7, 0);
        camera.fov = 42;
      } else {
        bulge.visible = false; moon.visible = false;
        axis.visible = true; ghostAxis.visible = shot === 'X2';
        const tilt = THREE.MathUtils.degToRad(tiltAt(t));
        // the axis also precesses slowly so the wobble reads in 3D
        const prec = (t - 38.8) * 0.35;
        earthTilt.rotation.set(0, prec, tilt);
        ghostAxis.rotation.set(0, 0, THREE.MathUtils.degToRad(23.4));
        if (shot === 'X1') { camera.position.set(lerp(16, 8, e), lerp(4, 2, e), lerp(70, 64, e)); camera.lookAt(0, 0, 0); camera.fov = 40; }
        else { camera.position.set(lerp(-10, -16, e), lerp(8, 11, e), lerp(70, 66, e)); camera.lookAt(0, 0, 0); camera.fov = 40; }
      }
      camera.updateProjectionMatrix();
    },
  };
}
