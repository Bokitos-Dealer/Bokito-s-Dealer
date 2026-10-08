// Dev scene: a plaza of animated people in every pose, for checking the character rig.
import * as THREE from 'three';
import { buildPeople } from '../engine/lib/people.js';
import { buildVehicles } from '../engine/lib/vehicles.js';

export default {
  id: 'test-people', title: 'test', endFact: '', duration: 6, titleIn: [0, 0], titleOut: [0, 0.01], fadeOut: [99, 100], endAt: 101,
  captions: [], hud: () => null, audio: [],
  async setup(ctx) {
    const { scene, renderer } = ctx;
    renderer.toneMappingExposure = 1.0;
    ctx.grain = 0; ctx.vignette = 0.3; ctx.handheld = 0;
    scene.background = new THREE.Color('#9cc3e6');
    scene.fog = new THREE.Fog('#9cc3e6', 60, 220);
    scene.add(new THREE.HemisphereLight('#dfefff', '#6b6152', 1.1));
    const sun = new THREE.DirectionalLight('#fff1dc', 2.4);
    sun.position.set(-15, 40, -30); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 120 });
    sun.shadow.bias = -0.0004; sun.shadow.radius = 3;
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b9b2a6', roughness: 0.95 }));
    ground.receiveShadow = true; scene.add(ground);
    const ppl = buildPeople({ max: 200 });
    scene.add(ppl.group);
    const poses = ['idle', 'walk', 'run', 'lookUp', 'phone', 'phoneLow', 'point', 'armsUp', 'handsHead', 'shrug', 'sit', 'wave', 'crouch', 'torch', 'skate'];
    poses.forEach((name, i) => {
      const x = (i % 5) * 2.2 - 4.4, z = Math.floor(i / 5) * 2.6 - 2.6;
      const moving = name === 'walk' || name === 'run' || name === 'skate';
      ppl.add({ at: (t) => ({ x, z, h: Math.PI, moving: moving ? 1 : 0, dist: t * (name === 'run' ? 4 : 1.4) }), poses: [[0, name]], phone: name.startsWith('phone') ? () => true : null, torch: name === 'torch' ? () => true : null, kid: i === 11 });
    });
    // a crowd walking past behind
    for (let i = 0; i < 40; i++) {
      const z = 9 + (i % 4) * 1.4, dir = i % 2 ? 1 : -1;
      ppl.add({ path: [[-60 * dir, z], [60 * dir, z]], t0: -(i * 1.7) % 40, v: 1.2 + (i % 5) * 0.08, poses: [[0, 'auto']] });
    }
    this.ppl = ppl;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(400, 9).rotateX(-Math.PI / 2).translate(0, 0.01, -9), new THREE.MeshStandardMaterial({ color: '#3a3b3e', roughness: 0.9 }));
    road.receiveShadow = true; scene.add(road);
    const veh = buildVehicles({ max: 40 });
    scene.add(veh.group);
    ['sedan', 'taxi', 'hatch', 'suv', 'van', 'bus'].forEach((type, i) => veh.add({ type, path: [[-80, -11], [80, -11]], s0: 60 + i * 9, v: 0.6, loop: false }));
    for (let i = 0; i < 6; i++) veh.add({ path: [[80, -7], [-80, -7]], s0: i * 25, v: 9 });
    this.veh = veh;
  },
  update(ctx, t) {
    this.ppl.update(t); this.veh.update(t);
    const a = 0.3 + t * 0.05;
    ctx.cam.pos.set(Math.sin(a) * 9, 2.2, -Math.cos(a) * 9);
    ctx.cam.look.set(0, 1.0, 1.5);
    ctx.cam.fov = 40;
  },
};
