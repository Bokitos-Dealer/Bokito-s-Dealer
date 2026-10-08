// What if the Moon suddenly disappeared?
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCity } from '../engine/lib/city.js';
import { buildSky } from '../engine/lib/sky.js';
import { buildWater } from '../engine/lib/water.js';
import { buildTrees, buildCars, streetLightSpots, buildPoles, WIND } from '../engine/lib/props.js';
import { GlowLayer, makeSoftTexture } from '../engine/lib/fx.js';
import { Rng, keys, smooth, clamp, lerp, easeInOut, fbm1 } from '../engine/lib/rng.js';

// ---- a bay: our beach on the south shore, the city skyline across the water (JS and GLSL must match)
const zN = (x) => 150 + 25 * Math.sin(x * 0.0045);           // our shoreline
const zF = (x) => -1250 + 60 * Math.sin(x * 0.0028 + 1);     // far shoreline
const coastZ = zN;
const elev = (x, z) => {
  const dn = z - zN(x), df = zF(x) - z;
  if (dn >= 0) return Math.min(2.4, dn * 0.03);
  if (df >= 0) return Math.min(3.0, df * 0.03);
  return Math.max(-9, -Math.min(-dn, -df) * 0.06);
};
const TERRAIN_GLSL = `
  float zN(float x){ return 150.0 + 25.0*sin(x*0.0045); }
  float zF(float x){ return -1250.0 + 60.0*sin(x*0.0028+1.0); }
  float terrain(vec2 p){
    float dn = p.y - zN(p.x), df = zF(p.x) - p.y;
    if (dn >= 0.0) return min(2.4, dn*0.03);
    if (df >= 0.0) return min(3.0, df*0.03);
    return max(-9.0, -min(-dn, -df)*0.06);
  }`;
const land = (x, z) => {
  const dn = z - zN(x), df = zF(x) - z;
  if (dn < -12 && df < -12) return 'water';
  if ((dn >= -12 && dn < 75) || (df >= -12 && df < 40)) return 'beach';
  return 'land';
};

// ---- story timing (seconds)
const VANISH = 1.45;
const S = { tide: 17.4, turtles: 31.6, tilt: 42.8, ice: 57.4, iceWall: 60.6, here: 67.4, fade: [68.3, 70.0], end: 70.4 };
const MOON_DIR = new THREE.Vector3(0.06, 0.165, -1).normalize();
const BAL = { x: 0, y: 44, z: zN(0) + 95 };   // seafront hotel balcony looking across the bay
const POLE = { x: 30, z: zN(30) - 26 };
const NEST = { x: -260, z: zN(-260) + 46 };
const TIDECAM = { x: 6, z: zN(6) + 36 };      // on the sand, looking at the gauge with the bay behind it
const TIDE = [[0, -0.8], [S.tide, -0.8], [S.tide + 2.2, -0.65], [S.tide + 8.8, 0.78], [S.turtles - 0.02, 0.8], [S.turtles, -0.6], [S.here, -0.6]];
const TILT = [[S.tilt, 23.4], [S.tilt + 7.5, 23.4], [S.tilt + 10.5, 25.9], [S.tilt + 13, 21.8], [S.ice + 1.5, 27.3], [S.here, 27.3]];

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const WALL_END = BAL.z - 70;
const wallZ = (t) => lerp(-9000, WALL_END, easeInOut(clamp((t - S.iceWall) / (S.here - S.iceWall))));

export default {
  id: 'moon-gone-v1',
  title: 'What if the Moon suddenly disappeared?',
  endFact: 'The Moon is slowly drifting away from Earth,<br>about 3.8 cm every year.',
  duration: 80,
  titleIn: [0, 0.01],
  titleOut: [3.0, 3.8],
  fadeOut: S.fade,
  endAt: S.end,
  crackAt: [540, 820],
  crackSeed: 21,

  captions: [
    [3.9, 6.9, 'The Moon is simply gone.'],
    [7.2, 10.5, 'No explosion. No sound.'],
    [10.8, 14.1, 'The first thing you notice is the dark.'],
    [14.4, 17.1, 'Every night is now a moonless night.'],
    [17.6, 20.9, 'Six hours later, the tide comes in.'],
    [21.2, 24.5, 'It stops at less than half the height.'],
    [24.8, 28.1, 'Only the Sun is pulling on the ocean now.'],
    [28.4, 31.3, 'The shore it floods each day shrinks.'],
    [31.8, 35.1, 'Weeks later, sea turtles hatch.'],
    [35.4, 38.7, 'They crawl toward the brightest horizon.'],
    [39.0, 42.5, 'Without moonlight on the sea, more head for the city.'],
    [43.0, 46.3, 'But the biggest change is slower.'],
    [46.6, 49.9, 'The Moon kept Earth’s tilt steady.'],
    [50.2, 53.5, 'Without it, the tilt starts to wander.'],
    [53.8, 57.1, 'How far, scientists still debate.'],
    [57.4, 60.7, 'But small changes in tilt help trigger ice ages.'],
    [61.0, 64.3, 'Bigger swings could mean colder ones.'],
    [64.6, 67.9, 'In the last ice age, the ice reached New York.'],
  ],

  hud(t) {
    if (t < VANISH) return { label: 'The Moon', value: '384,400 km', sub: 'distance from earth' };
    if (t < 3.9) return { label: 'The Moon', value: 'GONE', sub: '00:00 · midnight' };
    if (t < S.tide) {
      const lux = Math.exp(lerp(Math.log(0.25), Math.log(0.0025), smooth(9.5, 13.5, t)));
      return { label: 'Moonlight', value: `${lux < 0.01 ? lux.toFixed(4) : lux.toFixed(2)} lux`, sub: lux < 0.01 ? 'nights about 100× darker' : 'full moon' };
    }
    if (t < S.turtles) {
      const lv = keys(t, TIDE, easeInOut);
      return { label: 'High tide', value: `${lv >= 0 ? '+' : '−'}${Math.abs(lv).toFixed(1)} m`, sub: 'normally +1.9 m' };
    }
    if (t < S.tilt) return { label: 'Since the Moon vanished', value: '6 weeks', sub: 'sea turtles hatching' };
    if (t < S.iceWall) {
      const tilt = keys(t, TILT, easeInOut);
      const yrs = Math.round(Math.pow(10, lerp(3, 7, smooth(S.tilt, S.ice + 2, t))) / 1000) * 1000;
      return { label: 'Earth’s tilt', value: `${tilt.toFixed(1)}°`, sub: `+${fmt(yrs)} years` };
    }
    if (t < S.here) {
      const km = Math.max(0, (WALL_END - wallZ(t)) / 1000);
      return { label: 'Ice sheet', value: `${km.toFixed(km < 10 ? 1 : 0)} km`, sub: 'advancing' };
    }
    return { label: 'The ice', value: 'HERE', sub: '' };
  },

  audio: [
    { type: 'ambience', kind: 'coast', t0: 0, t1: S.tide + 0.3, level: 0.5, gulls: 0.0 },
    { type: 'ambience', kind: 'night-city', t0: 0, t1: S.tide + 0.3, level: 0.22 },
    { type: 'boom', t: VANISH, level: 0.55, low: true },
    { type: 'drone', t0: 0.2, t1: S.tide + 0.4, root: 50, chord: [0, 3, 7, 12], level: 0.32, swell: [[0.2, 0.25], [VANISH, 0.6], [6, 0.45], [S.tide, 0.35]] },
    { type: 'ambience', kind: 'coast', t0: S.tide - 0.2, t1: S.turtles + 0.3, level: 0.5, gulls: 0.35 },
    { type: 'water', t0: S.tide, t1: S.turtles + 0.2, level: 0.32, rush: 0.15 },
    { type: 'drone', t0: S.tide, t1: S.turtles + 0.4, root: 53, chord: [0, 4, 7, 12], level: 0.22, swell: [[S.tide, 0.3], [S.turtles, 0.4]] },
    { type: 'ambience', kind: 'coast', t0: S.turtles - 0.2, t1: S.tilt + 0.3, level: 0.6, gulls: 0.0 },
    { type: 'ambience', kind: 'night-quiet', t0: S.turtles - 0.2, t1: S.tilt + 0.3, level: 0.3 },
    { type: 'drone', t0: S.turtles, t1: S.tilt + 0.4, root: 48, chord: [0, 3, 7, 10], level: 0.24, swell: [[S.turtles, 0.3], [S.tilt, 0.45]] },
    { type: 'ambience', kind: 'wind', t0: S.tilt - 0.2, t1: S.here + 1.0, level: 0.45, swell: [[S.tilt, 0.25], [S.ice, 0.5], [S.here, 1.0]] },
    { type: 'drone', t0: S.tilt, t1: S.fade[1], root: 45, chord: [0, 3, 7, 12, 15], level: 0.38, swell: [[S.tilt, 0.3], [S.ice, 0.6], [S.here, 1.0], [S.fade[1], 0]] },
    { type: 'whoosh', t: S.tilt - 0.4, dur: 1.2, level: 0.35 },
    { type: 'rumble', t0: S.iceWall, t1: S.fade[1], level: 0.6, cut: 120, grit: 0.25, swell: [[S.iceWall, 0], [S.here - 1, 0.9], [S.here, 1.0], [S.fade[1], 0.3]] },
    { type: 'creak', t0: S.ice + 1.5, t1: S.here, level: 0.45 },
    { type: 'glass', t: S.here, level: 0.8 },
    { type: 'boom', t: S.here, level: 0.7, low: true },
    { type: 'chime', t: S.end, level: 0.5 },
  ],

  async setup(ctx) {
    const { scene, renderer } = ctx;
    const r = new Rng(384400);
    const st0 = {};
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = false;
    scene.fog = new THREE.Fog('#141c33', 500, 6000);
    ctx.grain = 0.0;
    ctx.handheld = 0.35;
    ctx.vignette = 0.75;

    // ---- city
    const city = buildCity({
      seed: 44, x0: -1700, x1: 1700, z0: -2700, z1: 700, elev, land,
      isPark: (i, j) => (i === 6 && j === 6) || (i === 15 && j === 4),
      height: (x, z, rr) => {
        if (z < 0) {                                       // the skyline across the bay
          const core = Math.exp(-((x - 120) ** 2 + (z + 1750) ** 2) / (2 * 420 * 420));
          const front = smooth(zF(x) - 260, zF(x) - 60, z);
          return 14 + rr.float(0, 22) + front * rr.float(5, 40) + core * rr.float(30, 230) * (rr.chance(0.75) ? 1 : 0.4);
        }
        const d = z - zN(x);                               // our side: hotels along the beach
        return 10 + rr.float(0, 14) + smooth(260, 90, d) * rr.float(15, 50);
      },
      clear: (x, z) => Math.abs(x - BAL.x) < 34 && Math.abs(z - BAL.z - 14) < 26,
      texSize: 4096,
    });
    scene.add(city.group);
    const fac = city.facade.userData.uniforms;
    fac.uNight.value = 1.0; fac.uLit.value = 0.42; fac.uWallMul.value = 0.32; fac.uLodLo.value = 0.2 / ctx.SCALE; fac.uLodHi.value = 0.45 / ctx.SCALE;  // same filtering per output pixel at any render scale
    fac.uGlassSky.value.set('#2a3552'); fac.uGlassDark.value.set('#0b0f17'); fac.uRoof.value.set('#3c3c3e');
    const groundU = city.ground.material.userData.uniforms;

    // our hotel
    const hotelTex = hotelFacade(new Rng(5));
    const hotel = new THREE.Mesh(new THREE.BoxGeometry(40, BAL.y + 30, 26), new THREE.MeshStandardMaterial({ map: hotelTex.map, emissiveMap: hotelTex.lit, emissive: '#ffffff', emissiveIntensity: 1.0, roughness: 0.85 }));
    st0.hotel = hotel;
    hotel.position.set(BAL.x, (BAL.y + 30) / 2 - 2, BAL.z + 15);
    scene.add(hotel);

    // ---- sky
    const sky = buildSky({ seed: 12, clouds: 22, cloudAlt: [900, 1600], stars: 3000 });
    sky.uniforms.uSunDisk.value = 0; sky.uniforms.uSunGlow.value = 0;
    sky.uniforms.uHorizonPow.value = 0.42;
    scene.add(sky.group);
    // the Moon: photo texture + soft glow
    const moonTex = await new THREE.TextureLoader().loadAsync('/assets/moon.png'); moonTex.colorSpace = THREE.SRGBColorSpace;
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, color: '#fff7ea' }));
    const glowTex = makeSoftTexture();
    const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, color: '#7d8fbd' }));
    moon.renderOrder = -6; moonGlow.renderOrder = -7;
    scene.add(moonGlow, moon);

    // ---- water
    const water = buildWater({ level: -0.9, terrainGLSL: TERRAIN_GLSL });
    const wu = water.uniforms;
    wu.uShore.value = 1; wu.uChop.value = 0.5; wu.uSpec.value = 0; wu.uChopDist.value = 900; wu.uSurfW.value = 0.45;
    scene.add(water.mesh);

    // ---- light
    const hemi = new THREE.HemisphereLight('#2b3a63', '#0d0d12', 0.6);
    const key = new THREE.DirectionalLight('#9fb4e8', 0.45);
    key.position.copy(MOON_DIR).multiplyScalar(2000); key.target.position.set(0, 0, -300);
    const cityGlow = new THREE.DirectionalLight('#ffb070', 0);   // warm light from the hotels, for the beach scene
    cityGlow.position.set(0, 120, 900); cityGlow.target.position.set(0, 0, coastZ(0));
    scene.add(hemi, key, key.target, cityGlow, cityGlow.target);

    // ---- props
    const palms = [];
    for (let x = -1080; x < 1080; x += 15) palms.push({ x: x + r.float(-2, 2), z: coastZ(x) + 80 + r.float(-1, 1), s: r.float(0.9, 1.2), palm: true });
    const trees = buildTrees(city, { seed: 3, street: 0.4, palms: 0.5, extra: palms });
    scene.add(trees.group);
    const cars = buildCars(city, { seed: 6, count: 300 });
    cars.lights.visible = true;
    scene.add(cars.mesh, cars.lights);
    const lamps = streetLightSpots(city, { spacing: 36 });
    const glows = new GlowLayer(3000, { fadeNear: 1500, fadeFar: 5000 });
    scene.add(glows.points);

    // ---- the skyline's lights reflected on the bay: shimmering streaks under the far-shore buildings
    const refl = buildReflections(city);
    scene.add(refl.mesh);
    st0.refl = refl;

    // ---- tide gauge
    const pole = buildTidePole();
    pole.position.set(POLE.x, 0, POLE.z);
    scene.add(pole);

    // ---- beach close-up: fine sand + hatchlings
    const sand = buildSandPatch(NEST.x, NEST.z);
    scene.add(sand.mesh);
    const turtles = buildHatchlings(new Rng(7), 46);
    scene.add(turtles.group);

    // ---- the ice sheet
    const glacier = buildGlacier();
    glacier.visible = false;
    scene.add(glacier);

    ctx.state = { ...st0, city, fac, groundU, sky, moon, moonGlow, water, hemi, key, cityGlow, trees, cars, lamps, glows, pole, sand, turtles, glacier, cloudX: 0 };
    ctx.grade = { brightness: 1.0, contrast: 1.04, saturate: 1.0, sepia: 0 };

    ctx.onFrame.push((t) => {
      const st = ctx.state;
      st.sky.update(t, ctx.camera);
      for (const c of st.sky.clouds) c.position.x = c.userData.base.x + st.cloudX * c.userData.speed;
      const p = ctx.camera.position;
      st.moon.position.copy(MOON_DIR).multiplyScalar(9000).add(p);
      st.moonGlow.position.copy(st.moon.position);
      st.glows.end(ctx.camera, ctx.H * ctx.SCALE);
    });
  },

  update(ctx, t, dt) {
    const st = ctx.state;
    const { fac, sky, water, hemi, key } = st;
    fac.uTime.value = t; water.uniforms.uTime.value = t; WIND.uTime.value = t;
    st.cars.update(t, dt);

    // ------------------------------------------------ phases
    const moonA = 1 - smooth(VANISH, VANISH + 0.3, t);                // the Moon itself
    const moonLight = 1 - smooth(VANISH, VANISH + 1.4, t);            // light it was throwing
    const dawn = smooth(S.tide - 0.1, S.tide + 0.4, t) * (1 - smooth(S.turtles - 0.1, S.turtles, t));
    const day = smooth(S.tilt - 0.1, S.tilt + 0.3, t);
    const winter = smooth(S.ice, S.ice + 4, t);
    const beach = t >= S.turtles && t < S.tilt;

    // the Moon
    const ms = 1050 * (1 + (1 - moonA) * 0.04);
    st.moon.scale.set(ms, ms, 1); st.moonGlow.scale.set(ms * 3.4, ms * 3.4, 1);
    st.moon.material.opacity = moonA; st.moonGlow.material.opacity = moonA * 0.55;
    st.moon.visible = st.moonGlow.visible = moonA > 0.001;

    // sky colours
    const night = new THREE.Color('#03060f'), nightH = new THREE.Color('#0d1528');
    const moonlitZ = new THREE.Color('#071027'), moonlitH = new THREE.Color('#1d2a4a');
    const dawnZ = new THREE.Color('#2f4f86'), dawnH = new THREE.Color('#f0b080');
    const dayZ = new THREE.Color('#4b80c2'), dayH = new THREE.Color('#d4dee8');
    const winZ = new THREE.Color('#8e98a3'), winH = new THREE.Color('#c9ced4');
    const zen = night.clone().lerp(moonlitZ, moonLight).lerp(dawnZ, dawn).lerp(dayZ, day).lerp(winZ, winter);
    const hor = nightH.clone().lerp(moonlitH, moonLight).lerp(dawnH, dawn).lerp(dayH, day).lerp(winH, winter);
    if (beach) hor.lerp(new THREE.Color('#3a2a26'), 0.6);         // orange city glow on the horizon behind the beach
    sky.uniforms.uZenith.value.copy(zen); sky.uniforms.uHorizon.value.copy(hor);
    sky.uniforms.uGlowDir.value.copy(MOON_DIR);
    sky.uniforms.uGlowTint.value.set('#5d72a8').multiplyScalar(0.22 * moonLight);
    sky.starU.uStars.value = lerp(0.35, 1.2, 1 - moonLight) * (1 - Math.max(dawn, day));
    const sunDir = new THREE.Vector3(-0.55, lerp(0.06, 0.22, smooth(S.tide, S.turtles, t)), -0.83).normalize();
    if (day > 0) {
      const tilt = keys(t, TILT, easeInOut);
      sunDir.set(-0.5, Math.sin(THREE.MathUtils.degToRad(30 + (tilt - 23.4) * 2.2)), 0.7).normalize();
    }
    sky.uniforms.uSunDir.value.copy(sunDir);
    sky.uniforms.uSunColor.value.set(dawn > day ? '#ffb27a' : '#fff1dc');
    sky.uniforms.uSunGlow.value = Math.max(dawn * 1.2, day * 0.8) * (1 - winter);
    sky.uniforms.uSunDisk.value = Math.max(dawn, day) * (1 - winter);
    sky.cloudTint(new THREE.Color('#1a2238').lerp(new THREE.Color('#ffd9c0'), dawn).lerp(new THREE.Color('#ffffff'), day).lerp(new THREE.Color('#b9c0c8'), winter), 0.85 * Math.max(dawn, day));
    st.cloudX += (6 + day * 140 * (1 - winter * 0.5)) * dt;

    // fog
    const fogC = new THREE.Color('#141c33').lerp(new THREE.Color('#0a0f1d'), 1 - moonLight).lerp(new THREE.Color('#d9b49a'), dawn).lerp(new THREE.Color('#c9d6e1'), day).lerp(new THREE.Color('#c4cad0'), winter);
    ctx.scene.fog.color.copy(fogC);
    ctx.scene.fog.near = lerp(500, 900, Math.max(dawn, day)) * (1 - winter * 0.4);
    ctx.scene.fog.far = lerp(6000, 9000, Math.max(dawn, day)) * (1 - winter * 0.2);

    // lights
    hemi.intensity = lerp(0.55, 0.32, 1 - moonLight) + dawn * 0.7 + day * 0.95 - winter * 0.2;
    hemi.color.set('#2b3a63').lerp(new THREE.Color('#c9a99a'), dawn).lerp(new THREE.Color('#b9d0ea'), day).lerp(new THREE.Color('#d0d6dc'), winter);
    hemi.groundColor.set('#0d0d12').lerp(new THREE.Color('#5a4a40'), Math.max(dawn, day));
    if (dawn > 0 || day > 0) {
      key.position.copy(sunDir).multiplyScalar(2000);
      key.color.set(dawn > day ? '#ffb48a' : '#fff1dc');
      key.intensity = dawn * 1.3 + day * 2.2 * (1 - winter * 0.75);
    } else {
      key.position.copy(MOON_DIR).multiplyScalar(2000);
      key.color.set('#9fb4e8'); key.intensity = 0.5 * moonLight;
    }
    st.cityGlow.intensity = beach ? 0.75 : 0;
    fac.uNight.value = (1 - Math.max(dawn * 0.75, day)) * (1 - winter * 0.6);
    st.hotel.material.emissiveIntensity = fac.uNight.value;
    st.refl.uniforms.uTime.value = t;
    st.refl.uniforms.uStr.value = fac.uNight.value * (1 - water.uniforms.uFreeze.value) * (t < S.tide || t >= S.tilt ? 1 : 0);
    st.refl.mesh.position.y = water.level + 0.8;   // clear of the water surface at depth-buffer precision 1.5 km away

    // water: moon path, tide, freezing
    water.level = keys(t, TIDE, easeInOut);
    water.uniforms.uSunDir.value.copy(day > 0 || dawn > 0 ? sunDir : MOON_DIR);
    water.uniforms.uSunCol.value.set(dawn > 0 ? '#ffc79a' : day > 0 ? '#fff4e0' : '#cbd6f0');
    water.uniforms.uSpec.value = 0;
    water.uniforms.uPathStr.value = moonLight * 0.55 + dawn * 0.9 + day * 0.6 * (1 - winter);
    water.uniforms.uPathRough.value = day > 0 || dawn > 0 ? 0.09 : 0.075;
    water.uniforms.uPathCol.value.set(dawn > 0 ? '#ffc08a' : day > 0 ? '#fff1dc' : '#d6defa');
    water.uniforms.uSky.value.copy(hor); water.uniforms.uSkyTop.value.copy(zen);
    water.uniforms.uDeep.value.set('#050a12').lerp(new THREE.Color('#203a4c'), Math.max(dawn, day));
    water.uniforms.uShallow.value.set('#0b141c').lerp(new THREE.Color('#3f6f74'), Math.max(dawn, day));
    water.uniforms.uFoamCol.value.set('#3a4458').lerp(new THREE.Color('#e8ecee'), Math.max(dawn, day));
    water.uniforms.uFreeze.value = smooth(S.ice + 0.8, S.ice + 6.5, t);

    // snow
    const snow = smooth(S.ice, S.ice + 4.5, t);
    fac.uSnow.value = snow; st.groundU.uSnow.value = snow; WIND.uSnow.value = snow;
    ctx.snow = smooth(S.ice - 0.5, S.ice + 2, t) * (0.7 + 0.5 * smooth(S.iceWall, S.here, t));

    // street lamps (night only)
    st.glows.begin();
    if (fac.uNight.value > 0.05) {
      const k = fac.uNight.value;
      for (const l of st.lamps) st.glows.add(l.x, (l.y ?? 0) + 7.6, l.z, 1.0 * k, 0.6 * k, 0.28 * k, 6);
    }

    // hatchlings
    st.turtles.group.visible = st.sand.mesh.visible = beach;
    if (beach) st.turtles.update(t - S.turtles);

    // the ice sheet
    const wallK = clamp((t - S.iceWall) / (S.here - S.iceWall));
    st.glacier.visible = t > S.iceWall - 0.2;
    st.glacier.position.z = wallZ(t);

    // ------------------------------------------------ camera
    const c = ctx.cam;
    c.near = 1;
    ctx.shake = 0;
    if (t < S.tide) {                                   // balcony, Moon over the bay
      const u = t / S.tide;
      c.pos.set(BAL.x - 2 + u * 3, BAL.y + 1.7, BAL.z - 1);
      const look = new THREE.Vector3(Math.sin(lerp(0.05, 0.0, u)), lerp(0.08, -0.025, easeInOut(smooth(3.5, 13, t))), -1).normalize();
      c.look.copy(c.pos).addScaledVector(look, 100); c.fov = 52;
    } else if (t < S.turtles) {                          // on the sand: the gauge, the bay, the skyline
      const u = (t - S.tide) / (S.turtles - S.tide);
      const gy = elev(TIDECAM.x, TIDECAM.z);
      c.pos.set(TIDECAM.x - 1 + u * 2, gy + 1.7, TIDECAM.z - u * 3);
      c.look.set(POLE.x - 2, 1.4, POLE.z);
      c.fov = 30;
      ctx.handheld = 0.2;
    } else if (beach) {                                  // sand level behind the hatchlings
      const u = (t - S.turtles) / (S.tilt - S.turtles);
      const gy = elev(NEST.x, NEST.z - 1.6);
      c.pos.set(NEST.x - 0.3 + u * 0.6, gy + 0.55 + u * 0.1, NEST.z - 2.2 + u * 0.6);
      c.look.set(NEST.x + 0.2, gy + 0.6, NEST.z + 9);
      c.fov = 46; c.near = 0.05; ctx.handheld = 0.15;
    } else {                                             // balcony again: years, tilt, ice
      const u = (t - S.tilt) / (S.here - S.tilt);
      c.pos.set(BAL.x + lerp(1.5, -1.5, u), BAL.y + 1.7, BAL.z - 1 - u * 1.5);
      const look = new THREE.Vector3(lerp(0.08, -0.04, easeInOut(u)), lerp(-0.07, -0.03, u), -1).normalize();
      c.look.copy(c.pos).addScaledVector(look, 100); c.fov = 54;
      ctx.handheld = 0.35;
      ctx.shake = smooth(S.iceWall + 2, S.here, t) * 0.35 + (t > S.here ? Math.exp(-(t - S.here) * 3) * 0.8 : 0);
    }
    c.roll = 0;

    // frost and crack when the ice arrives
    const frost = smooth(S.here - 1.2, S.here + 0.3, t);
    ctx.tint = frost > 0 ? { color: 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(220,235,255,0) 35%, rgba(225,238,255,0.55) 75%, rgba(240,248,255,0.95) 100%)', opacity: frost, blend: 'normal' } : null;
    ctx.crack = t > S.here ? clamp((t - S.here) / 0.2) : 0;
  },
};

// ---------------------------------------------------------------- props
function buildTidePole() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 2048;
  const c = cv.getContext('2d');
  const H = 2048, mPer = H / 8;                       // 8 m pole: -4 .. +4
  for (let i = 0; i < 32; i++) { c.fillStyle = i % 2 ? '#f2f0ea' : '#d9412e'; c.fillRect(0, i * mPer / 4, 128, mPer / 4); }
  c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let m = -3; m <= 3; m++) {
    const y = H / 2 - m * mPer;
    c.fillStyle = '#111'; c.fillRect(0, y - 3, 128, 6);
    c.fillStyle = '#fff'; c.fillRect(20, y - 40, 88, 34);
    c.fillStyle = '#111'; c.fillText(`${m > 0 ? '+' : ''}${m}`, 64, y - 23);
  }
  // normal high-tide mark at +1.9 m
  const yh = H / 2 - 1.9 * mPer;
  c.fillStyle = '#ffd23a'; c.fillRect(0, yh - 7, 128, 14);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 8, 16, 1, true), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.12 }));
  pole.position.y = 0;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 16), new THREE.MeshStandardMaterial({ color: '#333' }));
  cap.position.y = 4.06;
  g.add(pole, cap);
  return g;
}

function buildSandPatch(cx, cz) {
  const geo = new THREE.PlaneGeometry(60, 60, 120, 120);
  geo.rotateX(-Math.PI / 2);
  const pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i) + cx, z = pa.getZ(i) + cz + 12;
    pa.setXYZ(i, x, elev(x, z) + 0.02, z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: '#c9b48c', roughness: 1 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW;
      float h12(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float rip = 0.5 + 0.5*sin(vW.x*9.0 + vn(vW.xz*1.3)*6.0);
        float grain = vn(vW.xz*60.0)*0.5 + vn(vW.xz*170.0)*0.5;
        diffuseColor.rgb *= 0.82 + 0.1*rip + 0.16*grain;
        // fade into the big ground texture at the patch edges
        float edge = smoothstep(29.0, 22.0, max(abs(vW.x - ${cx.toFixed(1)}), abs(vW.z - ${(cz + 12).toFixed(1)})));
        diffuseColor.a = edge;`);
  };
  mat.transparent = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  return { mesh };
}

function buildHatchlings(r, n) {
  const group = new THREE.Group();
  const shellG = new THREE.SphereGeometry(1, 14, 8); shellG.scale(0.045, 0.018, 0.055); shellG.translate(0, 0.016, 0);
  const headG = new THREE.SphereGeometry(0.014, 8, 6); headG.translate(0, 0.016, 0.062);
  const body = mergeGeometries([shellG, headG]);
  const flipG = new THREE.BoxGeometry(0.04, 0.005, 0.022); flipG.translate(0.02, 0, 0);
  { const fp = flipG.attributes.position; for (let i = 0; i < fp.count; i++) if (fp.getX(i) > 0.02) fp.setZ(i, fp.getZ(i) * 0.45 - 0.008); }
  const shellM = new THREE.MeshStandardMaterial({ color: '#1d1a18', roughness: 0.4, metalness: 0.0 });
  const bodies = new THREE.InstancedMesh(body, shellM, n);
  const flips = new THREE.InstancedMesh(flipG, shellM, n * 4);
  bodies.frustumCulled = flips.frustumCulled = false;
  group.add(bodies, flips);
  const list = [];
  for (let i = 0; i < n; i++) {
    // most head inland toward the hotel lights; a few find the sea
    const seaward = r.chance(0.18);
    const ang = seaward ? Math.PI + r.float(-0.5, 0.5) : r.float(-0.45, 0.45);
    list.push({ x: NEST.x + r.gauss() * 0.3, z: NEST.z + 0.6 + r.gauss() * 0.25, ang, v: r.float(0.06, 0.12), start: r.float(-6, 8), ph: r.float(0, 6), wob: r.float(0.1, 0.35), s: r.float(1.0, 1.25) });
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
        const gy = elev(x, z) + 0.02 + (t < h.start ? -0.06 + 0.06 * clamp((t - h.start + 1) / 1) : 0);
        E.set(Math.sin(age * 9 + h.ph) * 0.06, heading, Math.sin(age * 9 + h.ph) * 0.08);
        Q.setFromEuler(E); P.set(x, gy, z); Sc.setScalar(h.s);
        M.compose(P, Q, Sc); bodies.setMatrixAt(i, M);
        const stroke = Math.sin(age * 9 + h.ph);
        [[0.03, 0.03, 1], [-0.03, 0.03, -1], [0.025, -0.035, 1], [-0.025, -0.035, -1]].forEach(([fx, fz, side], k) => {
          const swing = (k < 2 ? 0.7 : 0.4) * stroke * (k % 2 ? -1 : 1);
          F.makeRotationY((side > 0 ? -0.3 : Math.PI + 0.3) + swing);
          F.setPosition(fx, 0.012, fz);
          const W = new THREE.Matrix4().multiplyMatrices(M, F);
          flips.setMatrixAt(i * 4 + k, W);
        });
      });
      bodies.instanceMatrix.needsUpdate = true; flips.instanceMatrix.needsUpdate = true;
    },
  };
}

function buildGlacier() {
  const g = new THREE.Group();
  const W = 14000, Hh = 460;
  const top = (x) => Hh * (0.8 + 0.1 * fbm1(x * 0.004, 3) + 0.07 * fbm1(x * 0.025, 2));
  let front = new THREE.PlaneGeometry(W, Hh, 700, 14);
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
  const topG = new THREE.PlaneGeometry(W, 4000, 160, 20);
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

// Window grid for our own hotel (seen from the beach), lit windows in a separate emissive map.
function hotelFacade(r) {
  const W = 512, H = 1024;
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const lit = document.createElement('canvas'); lit.width = W; lit.height = H;
  const b = base.getContext('2d'), l = lit.getContext('2d');
  b.fillStyle = '#6f6a63'; b.fillRect(0, 0, W, H);
  l.fillStyle = '#000'; l.fillRect(0, 0, W, H);
  const cols = 12, rows = 24, cw = W / cols, rh = H / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = i * cw + cw * 0.2, y = j * rh + rh * 0.22, w = cw * 0.6, h = rh * 0.56;
    b.fillStyle = '#1d2229'; b.fillRect(x, y, w, h);
    if (r.chance(0.45)) { l.fillStyle = r.chance(0.8) ? `rgb(255,${Math.round(r.float(150, 200))},${Math.round(r.float(80, 120))})` : '#bcd0ff'; l.globalAlpha = r.float(0.35, 0.9); l.fillRect(x, y, w, h); l.globalAlpha = 1; }
  }
  const map = new THREE.CanvasTexture(base); map.colorSpace = THREE.SRGBColorSpace;
  const litT = new THREE.CanvasTexture(lit); litT.colorSpace = THREE.SRGBColorSpace;
  return { map, lit: litT };
}

// Light streaks on the water under the lit far-shore buildings.
function buildReflections(city) {
  const pos = [], uv = [], col = [], idx = [];
  const r = new Rng(31);
  let n = 0;
  for (const b of city.buildings) {
    if (b.cz > 0 || zF(b.cx) - b.cz > 420 || b.h < 20) continue;   // only the waterfront of the far side
    // mirror geometry: the reflection reaches as far below the horizon as the building rises above it
    const camH = BAL.y + 2.6, D = BAL.z - b.cz;
    const phi = Math.atan2(b.h, D) + Math.atan2(camH, D);
    const zNear = BAL.z - camH / Math.tan(phi);
    const w = (b.x1 - b.x0) * 0.6;
    const z0 = zF(b.cx) + 8, z1 = Math.max(z0 + 60, zNear);
    // run each streak along the line from the building toward the viewer, so it reads vertical on screen
    let dx = BAL.x - b.cx, dz = BAL.z - b.cz; const dl = Math.hypot(dx, dz); dx /= dl; dz /= dl;
    const sx = b.cx + dx * (z0 - b.cz) / dz, ex = b.cx + dx * (z1 - b.cz) / dz;
    const px = dz * w / 2, pz = -dx * w / 2;
    pos.push(sx - px, 0, z0 - pz, sx + px, 0, z0 + pz, ex + px, 0, z1 + pz, ex - px, 0, z1 - pz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    const warm = r.chance(0.8);
    const k = r.float(0.4, 1.0);
    for (let i = 0; i < 4; i++) col.push(warm ? 1.0 * k : 0.7 * k, warm ? 0.66 * k : 0.8 * k, warm ? 0.36 * k : 1.0 * k);
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const uniforms = { uTime: { value: 0 }, uStr: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vC; varying vec3 vW;
      void main(){ vUv = uv; vC = color; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime, uStr; varying vec2 vUv; varying vec3 vC; varying vec3 vW;
      float h12(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }
      void main(){
        float across = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 1.5);
        float along = pow(1.0 - vUv.y, 0.7) * smoothstep(0.0, 0.03, vUv.y);
        float wob = vn(vec2(vW.x*0.25 + sin(vW.z*0.06 + uTime*1.4)*1.2, vW.z*0.05 - uTime*0.6));
        float bands = smoothstep(0.35, 0.8, vn(vec2(vW.x*0.12, vW.z*0.35 + uTime*0.8)));
        float a = across * along * (0.35 + 0.65*wob) * (0.4 + 0.6*bands) * uStr;
        gl_FragColor = vec4(vC * a * 0.95, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 1; mesh.frustumCulled = false;
  return { mesh, uniforms };
}
