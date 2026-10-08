// Dev scene: one of each vehicle type, parked in a column, for checking the models.
import * as THREE from 'three';
import { buildVehicles } from '../engine/lib/vehicles.js';
import { buildPeople } from '../engine/lib/people.js';

export default {
  id: 'test-cars', title: 'test', endFact: '', duration: 4, titleIn: [0, 0], titleOut: [0, 0.01], fadeOut: [99, 100], endAt: 101,
  captions: [], hud: () => null, audio: [],
  async setup(ctx) {
    const { scene, renderer } = ctx;
    ctx.grain = 0; ctx.vignette = 0.3; ctx.handheld = 0;
    scene.background = new THREE.Color('#9cc3e6');
    scene.add(new THREE.HemisphereLight('#dfefff', '#6b6152', 1.1));
    const sun = new THREE.DirectionalLight('#fff1dc', 2.4);
    sun.position.set(25, 35, 30); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 150 });
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3a3b3e', roughness: 0.9 }));
    ground.receiveShadow = true; scene.add(ground);
    const veh = buildVehicles({ max: 20 });
    scene.add(veh.group);
    ['sedan', 'taxi', 'hatch', 'suv', 'van', 'bus'].forEach((type, i) => veh.add({ type, at: () => ({ x: (i % 2) * 6 - 3, z: -Math.floor(i / 2) * 9 - (type === 'bus' ? 4 : 0), h: 0.6, dist: 0 }), paint: ['#c0392b', '#f2c230', '#2b4f8a', '#e8e8e4', '#5b6168', '#2f6b4a'][i] }));
    const ppl = buildPeople({ max: 4 }); scene.add(ppl.group);
    ppl.add({ x: 0, z: 3, h: 2.5 });
    this.veh = veh; this.ppl = ppl;
  },
  update(ctx, t) {
    this.veh.update(t); this.ppl.update(t);
    ctx.cam.pos.set(14, 9, 14); ctx.cam.look.set(0, 0.5, -7); ctx.cam.fov = 48;
  },
};
