// What if all the ice on Earth melted?
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCity } from '../engine/lib/city.js';
import { buildSky } from '../engine/lib/sky.js';
import { buildWater } from '../engine/lib/water.js';
import { buildTrees, buildCars, buildPeople, streetLightSpots, buildPoles, buildBalcony, buildBoats } from '../engine/lib/props.js';
import { Particles, makeSmokeTexture } from '../engine/lib/fx.js';
import { Rng, keys, smooth, clamp, lerp, easeInOut } from '../engine/lib/rng.js';

// ---- terrain: a beach that rises gently into hills (JS and GLSL must match)
const COAST = -450;
const coastZ = (x) => COAST + 40 * Math.sin(x * 0.0035) + 18 * Math.sin(x * 0.012 + 1);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const elev = (x, z) => { const d = z - coastZ(x); return d < 0 ? Math.max(-8, d * 0.08) : d * 0.028 + 30 * sstep(900, 1600, d); };
const TERRAIN_GLSL = `
  float coastZ(float x){ return ${COAST.toFixed(1)} + 40.0*sin(x*0.0035) + 18.0*sin(x*0.012+1.0); }
  float terrain(vec2 p){ float d = p.y - coastZ(p.x); if (d < 0.0) return max(-8.0, d*0.08); return d*0.028 + 30.0*smoothstep(900.0, 1600.0, d); }`;
const land = (x, z) => { const d = z - coastZ(x); return d < -10 ? 'water' : d < 70 ? 'beach' : 'land'; };

// ---- where we stand
const CAM_X = 0, CAM_Z = 0;
const BASE = elev(CAM_X, CAM_Z);           // ~12.6 m
const BAL_Y = 74;                         // balcony floor
const FLOOR = Math.round((BAL_Y - BASE) / 3.07);

// ---- sea level over time (water plane height; starts just below the beach)
const LEVEL = [[0, -0.6], [14, -0.6], [18.4, -0.3], [19.5, 0.2], [25, 7.1], [30, 7.8], [34.2, 11.0], [38, 12.6], [41.7, 20], [45.5, 30], [49.3, 40], [53.1, 50], [56.9, 60], [61, 69.4], [68, 70.2]];
const level = (t) => keys(t, LEVEL, easeInOut);

export default {
  id: 'ice-melt',
  title: 'What if all the ice on Earth melted?',
  endFact: 'It would take thousands of years.<br>But the sea has already risen about 23 cm since 1880, and it is speeding up.',
  duration: 80,
  fadeOut: [67.8, 69.6],
  endAt: 70.2,

  captions: [
    [3.6, 7.0, 'A sunny afternoon on the coast.'],
    [7.3, 10.8, 'There are 30 million cubic kilometres of ice on land.'],
    [11.1, 14.6, 'Now imagine all of it melts.'],
    [14.9, 18.4, 'The mountain glaciers go first.'],
    [18.7, 22.2, 'Then Greenland. Seven metres.'],
    [22.5, 26.0, 'The beach is gone. Then the streets.'],
    [26.3, 29.8, 'Venice, Miami and Shanghai are underwater.'],
    [30.1, 33.6, 'West Antarctica adds three more metres.'],
    [33.9, 37.4, 'But most of the ice is in East Antarctica.'],
    [37.7, 41.2, 'Enough to raise the sea 53 metres.'],
    [41.5, 45.0, 'Twenty metres. The first floors are gone.'],
    [45.3, 48.8, 'Thirty. Whole neighbourhoods disappear.'],
    [49.1, 52.6, 'Forty. Only the towers are left.'],
    [52.9, 56.4, 'London and Bangkok are gone.'],
    [56.7, 60.2, 'Sixty. The sea reaches the hills.'],
    [60.5, 64.0, 'Seventy. All of the ice is gone.'],
    [64.3, 67.8, `This is the ${FLOOR}th floor.`],
  ],

  hud(t) {
    if (t >= 64.3) return { label: 'The sea', value: 'HERE', sub: '70 metres above today' };
    const rise = Math.max(0, level(t) + 0.6);
    const v = rise < 10 ? rise.toFixed(1) : Math.round(rise).toString();
    const src = t < 14 ? 'today' : t < 18.6 ? 'melting: mountain glaciers' : t < 30 ? 'melting: greenland' : t < 33.8 ? 'melting: west antarctica' : 'melting: east antarctica';
    return { label: 'Sea level', value: `+${v} m`, sub: src };
  },

  audio: [
    { type: 'ambience', kind: 'coast', t0: 0, t1: 30, level: 0.6, gulls: 0.25 },
    { type: 'ambience', kind: 'day-city', t0: 0, t1: 22, level: 0.25 },
    { type: 'ambience', kind: 'wind', t0: 26, t1: 69.5, level: 0.4, swell: [[26, 0.3], [45, 0.7], [64, 1.0], [69.5, 0.6]] },
    { type: 'water', t0: 17, t1: 69.5, level: 0.45, rush: 0.4, swell: [[17, 0.2], [24, 0.8], [30, 0.5], [42, 0.9], [61, 1.0], [69.5, 0.8]] },
    { type: 'drone', t0: 9, t1: 69.5, root: 50, chord: [0, 3, 7, 10, 12], level: 0.38, swell: [[9, 0], [14, 0.35], [24, 0.55], [34, 0.5], [42, 0.75], [61, 1.0], [66, 0.8], [69.5, 0]] },
    { type: 'boom', t: 14.6, level: 0.35, low: true },
    { type: 'rumble', t0: 40, t1: 69.5, level: 0.35, cut: 110, swell: [[40, 0], [50, 0.6], [61, 1], [69.5, 0.4]] },
    { type: 'whoosh', t: 64.0, dur: 1.4, level: 0.45 },
    { type: 'chime', t: 70.4, level: 0.5 },
  ],

  async setup(ctx) {
    const { scene, renderer } = ctx;
    const r = new Rng(2026);
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    scene.fog = new THREE.Fog('#cfd6da', 1400, 11000);

    const city = buildCity({
      seed: 70, x0: -1100, x1: 1100, z0: -520, z1: 1500, elev, land,
      isPark: (i, j) => (i === 8 && j === 4) || (i === 13 && j === 2) || (i === 4 && j === 7),
      height: (x, z, rr) => {
        const d = z - coastZ(x);
        const towerL = Math.exp(-((x + 75) ** 2 + (z + 300) ** 2) / (2 * 42 * 42));
        const towerR = Math.exp(-((x - 60) ** 2 + (z + 400) ** 2) / (2 * 42 * 42));
        const core = Math.exp(-((x - 60) ** 2 + (z - 700) ** 2) / (2 * 380 * 380));
        const front = Math.exp(-(x * x) / (2 * 230 * 230)) * sstep(-40, -300, z); // keep the view to the sea open
        let h = 8 + rr.float(0, 14) * sstep(0, 250, d) + rr.float(0, 8);
        h *= 1 - front * 0.35;
        h += Math.max(towerL, towerR) * rr.float(70, 135) + core * rr.float(10, 80);
        return h;
      },
      clear: (x, z) => Math.abs(x - CAM_X) < 34 && Math.abs(z - CAM_Z) < 30,
      texSize: 4096,
      groundColor: '#9b978d',
    });
    scene.add(city.group);
    const fac = city.facade.userData.uniforms;
    fac.uNight.value = 0; fac.uGlassSky.value.set('#a9c4da'); fac.uGlassDark.value.set('#24303b'); fac.uRoof.value.set('#77746e');

    // our tower
    const tower = new THREE.Mesh(new THREE.BoxGeometry(30, BAL_Y - BASE + 30, 26), new THREE.MeshStandardMaterial({ color: '#cfc8bb', roughness: 0.9 }));
    tower.position.set(CAM_X, BASE - 15 + (BAL_Y - BASE + 30) / 2, CAM_Z + 13 + 3);
    tower.castShadow = tower.receiveShadow = true;
    scene.add(tower);
    const balcony = buildBalcony({ width: 11, depth: 2.4, railH: 1.0, barH: 0.035, barD: 0.045, postW: 0.03, glassOpacity: 0.06, railMetal: 0.5, rail: '#3a3f44' });
    balcony.position.set(CAM_X, BAL_Y, CAM_Z + 3);
    scene.add(balcony);

    // ---- sky, sun, water
    const sky = buildSky({ seed: 4, clouds: 16, cloudAlt: [900, 1700], stars: 0 });
    sky.uniforms.uZenith.value.set('#2a5fa8');
    sky.uniforms.uHorizon.value.set('#c4d2dc');
    sky.uniforms.uBelow.value.set('#c9cfd2');
    sky.uniforms.uHorizonPow.value = 0.22;
    const sunDir = new THREE.Vector3(0.16, 0.15, -0.975).normalize();
    sky.uniforms.uSunDir.value.copy(sunDir);
    sky.uniforms.uSunColor.value.set('#ffc98a');
    sky.uniforms.uSunGlow.value = 1.7;
    sky.uniforms.uGlowExp.value = 22;
    sky.uniforms.uSunSize.value = 0.99965;
    sky.cloudTint(new THREE.Color('#fff8ee'), 0.8);
    scene.add(sky.group);

    const water = buildWater({ level: -0.6, terrainGLSL: TERRAIN_GLSL });
    const wu = water.uniforms;
    wu.uDeep.value.set('#1d5f78'); wu.uShallow.value.set('#56b5b0'); wu.uShore.value = 1;
    wu.uSky.value.set('#c9d3d9'); wu.uSkyTop.value.set('#3f73b5');
    wu.uSunDir.value.copy(sunDir); wu.uSunCol.value.set('#ffe2b0'); wu.uSpec.value = 1.6; wu.uChop.value = 0.5;
    scene.add(water.mesh);

    const hemi = new THREE.HemisphereLight('#b9d2ee', '#8a7a60', 1.25);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#ffd9a8', 2.9);
    sun.position.copy(sunDir).multiplyScalar(1500).add(new THREE.Vector3(0, 0, -300));
    sun.target.position.set(0, 0, -300);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
    Object.assign(sun.shadow.camera, { left: -800, right: 800, top: 800, bottom: -800, near: 100, far: 3500 });
    scene.add(sun, sun.target);

    // ---- props
    const palmsAlongBeach = [];
    for (let x = -1080; x < 1080; x += 14) { const z = coastZ(x) + 76; palmsAlongBeach.push({ x: x + r.float(-2, 2), z: z + r.float(-1.5, 1.5), s: r.float(0.85, 1.15), palm: true }); }
    const trees = buildTrees(city, { seed: 5, street: 0.45, palms: 0.45, extra: palmsAlongBeach });
    scene.add(trees.group);
    const cars = buildCars(city, { seed: 9, count: 380 });
    scene.add(cars.mesh);
    const beach = { x0: -1050, x1: 1050, z0: COAST - 4, z1: COAST + 55 };
    const people = buildPeople(city, { seed: 4, count: 1300, extraAreas: [beach], extraShare: 0.45 });
    // beach people: keep them on the sand
    for (const p of people.people) if (p.kind === 'area') { p.z = coastZ(p.x) + r.float(-2, 60); p.y = elev(p.x, p.z); }
    scene.add(people.mesh);
    const lamps = streetLightSpots(city, { spacing: 40 });
    scene.add(buildPoles(lamps));

    const umbrellas = buildUmbrellas(r, 170);
    scene.add(umbrellas);

    // pier with a Ferris wheel at the end
    const pier = buildPier(r);
    scene.add(pier.group);

    // boats and a ship on the horizon
    const boatList = [];
    for (let i = 0; i < 11; i++) boatList.push({ x: r.float(-700, 700), z: COAST - r.float(180, 1100), rot: r.float(0, 6.28), vx: r.float(-0.6, 0.6), vz: r.float(-0.2, 0.3), s: r.float(0.9, 1.3) });
    const boats = buildBoats(boatList);
    scene.add(boats.mesh);
    const ship = buildShip();
    ship.position.set(-900, 0, -3400); ship.rotation.y = 0.12;
    scene.add(ship);

    const gulls = buildGulls(r, 26);
    scene.add(gulls.mesh);

    const debris = buildDebris(new Rng(44), 140);
    scene.add(debris.mesh);

    const spray = new Particles(500, { map: makeSmokeTexture(8, { alpha: 0.5 }) });
    spray.uniforms.uLight.value.set('#e8eef0');
    scene.add(spray.mesh);

    ctx.state = { city, fac, sky, water, sun, hemi, cars, people, trees, umbrellas, pier, boats, ship, gulls, spray, debris, rng: new Rng(5) };
    ctx.grade = { brightness: 1.03, contrast: 1.06, saturate: 1.08, sepia: 0 };
    ctx.vignette = 0.55;

    ctx.onFrame.push((t) => {
      const st = ctx.state;
      st.sky.update(t, ctx.camera);
      st.spray.flush(ctx.camera);
    });
  },

  update(ctx, t, dt) {
    const st = ctx.state;
    const L = level(t);
    st.water.level = L;
    st.water.uniforms.uTime.value = t;
    st.fac.uTime.value = t;

    // clouds race as centuries pass
    const speed = keys(t, [[0, 1], [14, 1], [24, 12], [40, 30], [61, 45], [66, 4]]);
    st.sky.windScale = 1;
    st.cloudX = (st.cloudX ?? 0) + speed * dt * 6;
    for (const c of st.sky.clouds) c.position.x = c.userData.base.x + st.cloudX * c.userData.speed;

    st.cars.update(t, dt);
    // cars: float while the water is shallow over them, then they are gone
    for (const c of st.cars.cars) {
      const g = elev(c.pos.x, c.pos.z);
      const depth = L - g;
      if (!c.free && depth > 0.7) { c.free = true; c.float0 = t; c.drift = new THREE.Vector3(st.rng.float(-1, 1), 0, st.rng.float(0.2, 1.4)); c.spinR = st.rng.float(-0.3, 0.3); }
      if (c.free) {
        const g2 = elev(c.pos.x, c.pos.z);
        const d2 = L - g2;
        c.pos.addScaledVector(c.drift, dt);
        c.pos.y = d2 > 9 ? -500 : L - 0.55 + Math.sin(t * 1.7 + c.s) * 0.08;
        c.euler.set(Math.sin(t * 1.3 + c.s) * 0.05, c.euler.y + c.spinR * dt, Math.sin(t * 1.1 + c.s) * 0.05);
      }
    }
    st.people.update(t);
    for (const p of st.people.people) if (L > (p.pos.y ?? 0) - 1.2) p.pos.y = -800;
    st.people.mesh.instanceMatrix.needsUpdate = true;
    // re-apply hidden people (update() wrote their matrices before we moved them)
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1);
    st.people.people.forEach((p, i) => { if (p.pos.y < -100) { M.compose(p.pos, Q, S); st.people.mesh.setMatrixAt(i, M); } });

    st.umbrellas.visible = L < 1.2;
    st.pier.update(t);
    st.boats.update(t, L);
    st.ship.position.y = L + Math.sin(t * 0.4) * 0.3;
    st.ship.position.x = -900 + t * 2.2;
    st.gulls.update(t, L);
    st.debris.update(t, L);

    // camera
    const c = ctx.cam;
    const pitch = keys(t, [[0, -0.27], [12, -0.25], [40, -0.15], [58, -0.13], [61.5, -0.16], [67.8, -0.62]], easeInOut);
    const pan = keys(t, [[0, -0.06], [20, 0.05], [44, -0.03], [62, 0.0], [68, 0.02]], easeInOut);
    const push = keys(t, [[0, 0], [68, 1]]);
    const lean = smooth(61.5, 67.8, t);
    c.pos.set(CAM_X + lerp(-0.6, 0.6, push), BAL_Y + 1.7 - lean * 0.15, CAM_Z + 3 - 2.4 + 0.05 + 1.0 + lean * 0.25);
    const dir = new THREE.Vector3(Math.sin(pan), pitch, -Math.cos(pan)).normalize();
    c.look.copy(c.pos).addScaledVector(dir, 100);
    c.fov = 55;

    // the last metres: waves slap the tower and spray drifts past the balcony
    if (t > 61) {
      const k = smooth(61, 66, t);
      st.water.uniforms.uChop.value = 0.5 + k * 0.25;
      if (st.rng.chance(dt * 18 * k)) {
        const x = CAM_X + st.rng.float(-14, 14);
        for (let i = 0; i < 6; i++) st.spray.spawn({ pos: new THREE.Vector3(x + st.rng.float(-2, 2), L + 0.5, CAM_Z - 1 + st.rng.float(-3, 1)), vel: new THREE.Vector3(st.rng.float(-1, 1), st.rng.float(3, 7), st.rng.float(0, 2)), life: st.rng.float(1.2, 2.2), size: [1.5, 6], alpha: 0.55, grav: 4, drag: 0.6, color: new THREE.Color('#f4f8f8') });
      }
    }
    st.spray.step(dt);
    ctx.handheld = 1 + smooth(60, 66, t) * 0.8;
  },
};

// ---------------------------------------------------------------- props
function buildUmbrellas(r, n) {
  const cone = new THREE.ConeGeometry(1.5, 0.55, 8).translate(0, 2.35, 0);
  const pole = new THREE.CylinderGeometry(0.04, 0.04, 2.3, 4).translate(0, 1.15, 0);
  const cols = ['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1', '#e67e22', '#1abc9c', '#9b59b6', '#ff6f91'];
  const g = mergeGeometries([cone.toNonIndexed(), pole.toNonIndexed()]);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const im = new THREE.InstancedMesh(g, mat, n);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const x = r.float(-1000, 1000), z = coastZ(x) + r.float(8, 55);
    M.compose(new THREE.Vector3(x, elev(x, z), z), Q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), r.float(-0.12, 0.12)), new THREE.Vector3(1, 1, 1));
    im.setMatrixAt(i, M);
    im.setColorAt(i, new THREE.Color(r.pick(cols)));
  }
  im.castShadow = true;
  return im;
}

function buildPier() {
  const group = new THREE.Group();
  const px = 230, z0 = coastZ(230) + 40, z1 = COAST - 260;
  const len = z0 - z1;
  const wood = new THREE.MeshStandardMaterial({ color: '#8a6d52', roughness: 0.9 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 0.6, len), wood);
  deck.position.set(px, 5.2, (z0 + z1) / 2); deck.castShadow = deck.receiveShadow = true; group.add(deck);
  const pil = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.3, 14, 6), wood, Math.ceil(len / 8) * 2);
  let k = 0; const M = new THREE.Matrix4();
  for (let z = z1; z < z0; z += 8) for (const dx of [-5.2, 5.2]) { M.makeTranslation(px + dx, -2, z); pil.setMatrixAt(k++, M); }
  pil.count = k; group.add(pil);
  // Ferris wheel
  const wheel = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.5, metalness: 0.3 });
  const R = 21;
  for (const dz of [-1.6, 1.6]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.35, 5, 48), steel); ring.position.z = dz; wheel.add(ring); }
  const spokes = [];
  for (let i = 0; i < 16; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, R * 2, 4), steel); wheel.add(s); spokes.push(s); }
  const gondolas = [];
  const gcols = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#e67e22', '#9b59b6'];
  for (let i = 0; i < 16; i++) {
    const gm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 2.4), new THREE.MeshStandardMaterial({ color: gcols[i % gcols.length], roughness: 0.6 }));
    gm.castShadow = true; wheel.add(gm); gondolas.push(gm);
  }
  const wheelY = 5.5 + R + 3;
  wheel.position.set(px, wheelY, z1 + 40);
  wheel.rotation.y = 0.35;
  group.add(wheel);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, wheelY - 5, 6), steel);
    leg.position.set(px + sz * 3.2, (wheelY + 5.5) / 2, z1 + 40 + sx * 7);
    leg.rotation.x = -sx * Math.atan(7 / (wheelY - 5));
    leg.castShadow = true; group.add(leg);
  }
  wheel.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return {
    group,
    update(t) {
      const a = t * 0.06;
      gondolas.forEach((g, i) => {
        const th = a + (i / 16) * Math.PI * 2;
        g.position.set(Math.cos(th) * (R + 0.2), Math.sin(th) * (R + 0.2) - 1.3, 0);
      });
      spokes.forEach((s, i) => { s.rotation.z = (i / 16) * Math.PI + a; });
    },
  };
}

function buildShip() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: '#28323c', roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: '#b3362f', roughness: 0.6 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(260, 16, 34), dark); hull.position.y = 4; g.add(hull);
  const band = new THREE.Mesh(new THREE.BoxGeometry(260.5, 3, 34.5), red); band.position.y = -2.5; g.add(band);
  for (let k = 0; k < 6; k++) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(220 - k * 18, 4.2, 30 - k * 1.5), white);
    deck.position.set(-8 - k * 4, 14 + k * 4.2, 0); g.add(deck);
    const win = new THREE.Mesh(new THREE.BoxGeometry(221 - k * 18, 1.0, 30.6 - k * 1.5), dark);
    win.position.set(-8 - k * 4, 14 + k * 4.2, 0); g.add(win);
  }
  const funnel = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 10), red); funnel.position.set(-60, 46, 0); g.add(funnel);
  return g;
}

function buildGulls(r, n) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.9, 0.25, -0.2, -0.9, 0.25, 0.2, 0, 0, 0, 0.9, 0.25, -0.2, 0.9, 0.25, 0.2], 3));
  geo.computeVertexNormals();
  const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#2b2f33', side: THREE.DoubleSide }), n);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  const birds = [];
  for (let i = 0; i < n; i++) birds.push({ cx: r.float(-260, 260), cz: COAST + r.float(-260, 120), rad: r.float(20, 70), y: r.float(25, 70), w: r.float(0.15, 0.35) * (r.chance(0.5) ? 1 : -1), ph: r.float(0, 6.28), flap: r.float(6, 9) });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  return {
    mesh: im,
    update(t, L) {
      birds.forEach((b, i) => {
        const a = b.ph + b.w * t;
        P.set(b.cx + Math.cos(a) * b.rad, Math.max(b.y, L + 8) + Math.sin(t * 0.7 + i) * 2, b.cz + Math.sin(a) * b.rad);
        E.set(0, -a + (b.w > 0 ? 0 : Math.PI), Math.sin(t * 0.5 + i) * 0.2);
        Q.setFromEuler(E);
        const f = 0.4 + 0.8 * Math.abs(Math.sin(t * b.flap + i));
        S.set(1.4, f * 1.4, 1.4);
        M.compose(P, Q, S); im.setMatrixAt(i, M);
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
}

// Flotsam: crates, planks and roof panels that ride the rising water.
function buildDebris(r, n) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85 }), n);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  const cols = ['#7a5a3c', '#a88b64', '#d9d4c7', '#5e6a72', '#b5452f', '#2f5d8a'];
  const items = [];
  for (let i = 0; i < n; i++) {
    items.push({ x: r.float(-320, 320), z: r.float(-560, -40), t0: r.float(19, 58), vx: r.float(-0.8, 0.8), vz: r.float(-0.3, 0.9), ry: r.float(0, 6.28), sx: r.float(0.6, 4), sz: r.float(0.5, 2.5), sy: r.float(0.15, 0.6) });
    im.setColorAt(i, new THREE.Color(r.pick(cols)));
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  return {
    mesh: im,
    update(t, L) {
      items.forEach((d, i) => {
        const age = t - d.t0;
        const x = d.x + d.vx * Math.max(0, age), z = d.z + d.vz * Math.max(0, age);
        const show = age > 0 && L - elev(x, z) > 0.4;
        E.set(Math.sin(t * 1.2 + i) * 0.08, d.ry + age * 0.02, Math.sin(t * 0.9 + i * 2) * 0.08);
        Q.setFromEuler(E);
        P.set(x, show ? L + d.sy * 0.2 + Math.sin(t * 1.4 + i) * 0.06 : -900, z);
        S.set(d.sx, d.sy, d.sz);
        M.compose(P, Q, S); im.setMatrixAt(i, M);
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
}
