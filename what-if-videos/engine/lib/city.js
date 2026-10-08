// Procedural low-poly city: street grid, merged building geometry with a
// window shader, a painted ground texture, and the road/sidewalk data that
// props (cars, trees, people, street lights) are placed along.
import * as THREE from 'three';
import { Rng, clamp } from './rng.js';

const STYLES = {
  brick:    { walls: ['#8a4a37', '#7a3f30', '#9b5a43', '#6e3b2e', '#a0644c'], win: [0.42, 0.55], glass: 0, ground: 1, floor: [3.4, 3.8], bay: [3.2, 4.0] },
  stone:    { walls: ['#c9b48f', '#bfa982', '#d4c4a2', '#b59f7c', '#cbbd9f'], win: [0.45, 0.58], glass: 0, ground: 1, floor: [3.5, 4.0], bay: [3.4, 4.2] },
  stucco:   { walls: ['#d9c27a', '#e0b65c', '#c8d0b8', '#e7d9bd', '#b9c7c9', '#d79a6b', '#a9c3a0'], win: [0.42, 0.5], glass: 0, ground: 1, floor: [3.2, 3.6], bay: [3.6, 4.4] },
  concrete: { walls: ['#9a9a96', '#a7a39b', '#8c8d8f', '#b3b1aa', '#7f8186'], win: [0.62, 0.6], glass: 0, ground: 1, floor: [3.6, 4.0], bay: [2.8, 3.4] },
  glass:    { walls: ['#6f8597', '#7d93a4', '#5f7688', '#8aa0ae', '#6b7f86'], win: [0.9, 0.82], glass: 1, ground: 0, floor: [3.8, 4.2], bay: [2.2, 2.8] },
};

const toLin = (hex) => new THREE.Color(hex); // THREE.Color parses sRGB hex into linear working space

export function buildCity(opts) {
  const o = Object.assign({
    seed: 7,
    x0: -900, x1: 900, z0: -1800, z1: 260,
    blockW: 92, blockD: 70, road: 18, sidewalk: 4.5,
    land: () => 'land',                 // (x,z) => 'land' | 'beach' | 'water'
    isPark: () => false,                // (bx, bz, cx, cz) => bool
    height: (x, z, r) => r.float(10, 40),
    style: null,                         // (h, r, x, z) => style name
    clear: () => false,                 // (x,z) => true to keep empty
    texSize: 4096,
    groundColor: '#8f8d88',
  }, opts);
  const r = new Rng(o.seed);
  const group = new THREE.Group();

  const pitchX = o.blockW + o.road, pitchZ = o.blockD + o.road;
  const roadsX = [], roadsZ = []; // x positions of north-south roads, z positions of east-west roads
  for (let x = o.x0; x <= o.x1; x += pitchX) roadsX.push(x);
  for (let z = o.z0; z <= o.z1; z += pitchZ) roadsZ.push(z);

  // ---- blocks and lots
  const blocks = [], buildings = [], parks = [];
  for (let i = 0; i < roadsX.length - 1; i++) for (let j = 0; j < roadsZ.length - 1; j++) {
    const bx0 = roadsX[i] + o.road / 2, bx1 = roadsX[i + 1] - o.road / 2;
    const bz0 = roadsZ[j] + o.road / 2, bz1 = roadsZ[j + 1] - o.road / 2;
    const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
    const corners = [[bx0, bz0], [bx1, bz0], [bx0, bz1], [bx1, bz1]].map(([x, z]) => o.land(x, z));
    if (corners.some((c) => c !== 'land')) { blocks.push({ bx0, bx1, bz0, bz1, cx, cz, kind: corners.every((c) => c === 'water') ? 'water' : 'edge' }); continue; }
    const park = o.isPark(i, j, cx, cz);
    const b = { bx0, bx1, bz0, bz1, cx, cz, kind: park ? 'park' : 'city', i, j };
    blocks.push(b);
    if (park) { parks.push(b); continue; }
    // Subdivide into lots: one or two rows deep, several along the long side.
    const ix0 = bx0 + o.sidewalk, ix1 = bx1 - o.sidewalk, iz0 = bz0 + o.sidewalk, iz1 = bz1 - o.sidewalk;
    const rows = (iz1 - iz0) > 44 && r.chance(0.7) ? 2 : 1;
    for (let row = 0; row < rows; row++) {
      const rz0 = iz0 + (iz1 - iz0) * row / rows, rz1 = iz0 + (iz1 - iz0) * (row + 1) / rows;
      let x = ix0;
      while (x < ix1 - 6) {
        let w = r.float(14, 34);
        if (ix1 - (x + w) < 12) w = ix1 - x;
        const lot = { x0: x, x1: x + w, z0: rz0, z1: rz1 };
        x += w;
        const gap = r.float(0.4, 2.2);
        const lx0 = lot.x0 + gap / 2, lx1 = lot.x1 - gap / 2, lz0 = lot.z0 + gap / 2, lz1 = lot.z1 - gap / 2;
        const lcx = (lx0 + lx1) / 2, lcz = (lz0 + lz1) / 2;
        if (o.clear(lcx, lcz)) continue;
        const h = o.height(lcx, lcz, r);
        if (h <= 0) continue;
        buildings.push({ x0: lx0, x1: lx1, z0: lz0, z1: lz1, cx: lcx, cz: lcz, h, block: b });
      }
    }
  }

  // ---- building geometry
  const pos = [], nor = [], uv = [], wall = [], win = [], seed = [], roof = [], idx = [];
  let vcount = 0;
  const quad = (p0, p1, p2, p3, n, uvs, wc, wn, sd, isRoof) => {
    for (const [k, p] of [p0, p1, p2, p3].entries()) {
      pos.push(...p); nor.push(...n); uv.push(...uvs[k]);
      wall.push(wc.r, wc.g, wc.b); win.push(...wn); seed.push(...sd); roof.push(isRoof);
    }
    idx.push(vcount, vcount + 1, vcount + 2, vcount, vcount + 2, vcount + 3);
    vcount += 4;
  };
  // Box from y0 to y1; windows aligned so each wall has a whole number of bays.
  const box = (x0, x1, z0, z1, y0, y1, bld) => {
    const w = x1 - x0, d = z1 - z0;
    const nx = Math.max(1, Math.round(w / bld.bay)), nz = Math.max(1, Math.round(d / bld.bay));
    const v0 = (y0 - bld.base) / bld.floorH, v1 = (y1 - bld.base) / bld.floorH;
    const wc = bld.color, wn = bld.win, sd = bld.seedv;
    // +z face (south), -z, +x, -x
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[0, v0], [nx, v0], [nx, v1], [0, v1]], wc, wn, sd, 0);
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[0, v0], [nx, v0], [nx, v1], [0, v1]], wc, wn, sd, 0);
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[0, v0], [nz, v0], [nz, v1], [0, v1]], wc, wn, sd, 0);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[0, v0], [nz, v0], [nz, v1], [0, v1]], wc, wn, sd, 0);
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], wc, wn, sd, 1);
  };

  const roofProps = []; // small boxes on roofs
  buildings.forEach((b, i) => {
    const sname = o.style ? o.style(b.h, r, b.cx, b.cz) : (b.h > 70 ? r.pick(['glass', 'glass', 'concrete']) : r.pick(['brick', 'stone', 'stucco', 'concrete', 'brick']));
    const st = STYLES[sname];
    b.style = sname;
    b.floorH = r.float(...st.floor);
    b.h = Math.max(b.floorH * 2, Math.round(b.h / b.floorH) * b.floorH);
    b.bay = r.float(...st.bay);
    b.color = toLin(r.pick(st.walls)).multiplyScalar(r.float(0.88, 1.08));
    b.win = [st.win[0] * r.float(0.9, 1.1), st.win[1] * r.float(0.9, 1.1), st.glass, st.ground];
    b.seed = r.float(0, 1000);
    b.offTime = 1e6;
    b.seedv = [b.seed, b.offTime];
    // sit on the terrain: lowest corner, sunk a little so slopes never show a gap
    const el = o.elev ? [o.elev(b.x0, b.z0), o.elev(b.x1, b.z0), o.elev(b.x0, b.z1), o.elev(b.x1, b.z1)] : [0];
    b.base = Math.min(...el);
    b.sink = o.elev ? Math.max(...el) - b.base + 0.5 : 0;
    b.vStart = vcount;
    const w = b.x1 - b.x0, d = b.z1 - b.z0;
    if (b.h > 60 && r.chance(0.55)) {
      // tower with one or two setbacks
      const h1 = Math.round(b.h * r.float(0.55, 0.75) / b.floorH) * b.floorH;
      box(b.x0, b.x1, b.z0, b.z1, b.base - b.sink, b.base + h1, b);
      const ins = Math.min(w, d) * r.float(0.12, 0.22);
      box(b.x0 + ins, b.x1 - ins, b.z0 + ins, b.z1 - ins, b.base + h1, b.base + b.h, b);
      b.top = { x0: b.x0 + ins, x1: b.x1 - ins, z0: b.z0 + ins, z1: b.z1 - ins };
    } else {
      box(b.x0, b.x1, b.z0, b.z1, b.base - b.sink, b.base + b.h, b);
      b.top = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 };
    }
    b.vEnd = vcount;
    // roof clutter
    const tw = b.top.x1 - b.top.x0, td = b.top.z1 - b.top.z0;
    const nProps = r.int(0, 3);
    for (let k = 0; k < nProps; k++) {
      const pw = r.float(2, Math.min(7, tw * 0.4)), pd = r.float(2, Math.min(7, td * 0.4)), ph = r.float(1.2, 3.5);
      const px = r.float(b.top.x0 + pw / 2 + 1, b.top.x1 - pw / 2 - 1), pz = r.float(b.top.z0 + pd / 2 + 1, b.top.z1 - pd / 2 - 1);
      if (Number.isFinite(px) && Number.isFinite(pz)) roofProps.push({ x: px, z: pz, y: b.base + b.h, w: pw, d: pd, h: ph, b: i });
    }
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aWall', new THREE.Float32BufferAttribute(wall, 3));
  geo.setAttribute('aWin', new THREE.Float32BufferAttribute(win, 4));
  const seedAttr = new THREE.Float32BufferAttribute(seed, 2);
  geo.setAttribute('aSeed', seedAttr);
  geo.setAttribute('aRoof', new THREE.Float32BufferAttribute(roof, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();

  const facade = makeFacadeMaterial();
  const mesh = new THREE.Mesh(geo, facade);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);

  // roof clutter mesh (plain)
  if (roofProps.length) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.MeshStandardMaterial({ color: 0x8d8b86, roughness: 0.9 });
    const im = new THREE.InstancedMesh(g, m, roofProps.length);
    const M = new THREE.Matrix4();
    roofProps.forEach((p, k) => { M.compose(new THREE.Vector3(p.x, p.y + p.h / 2, p.z), new THREE.Quaternion(), new THREE.Vector3(p.w, p.h, p.d)); im.setMatrixAt(k, M); });
    im.castShadow = im.receiveShadow = true;
    group.add(im);
  }

  const city = { group, mesh, facade, buildings, blocks, parks, roadsX, roadsZ, opts: o, roofProps };
  city.elevAt = (x, z) => (o.elev ? o.elev(x, z) : 0);

  // Per-building "lights off" time, used by blackouts. fn(b) => seconds.
  city.setOffTimes = (fn) => {
    for (const b of buildings) {
      b.offTime = fn(b);
      for (let v = b.vStart; v < b.vEnd; v++) seedAttr.setY(v, b.offTime);
    }
    seedAttr.needsUpdate = true;
  };

  city.ground = buildGround(city, o, r);
  group.add(city.ground);
  return city;
}

function makeFacadeMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.0 });
  const uniforms = {
    uTime: { value: 0 },
    uNight: { value: 0 },          // 0 day .. 1 night: strength of lit windows
    uLit: { value: 0.55 },         // fraction of windows lit
    uGlassDark: { value: new THREE.Color('#1c232b') },
    uGlassSky: { value: new THREE.Color('#9fb7cc') },
    uRoof: { value: new THREE.Color('#55534f') },
    uWarm: { value: 1.0 },
    uWallMul: { value: 1.0 },      // darken walls for night scenes
    uSnow: { value: 0.0 },         // snow on roofs and ledges
    uLodLo: { value: 0.11 },       // window filtering: cell size (in cells/pixel) where averaging starts..
    uLodHi: { value: 0.3 },        // ..and where it is complete
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aWall; attribute vec4 aWin; attribute vec2 aSeed; attribute float aRoof;
        varying vec2 vFac; varying vec3 vWall; varying vec4 vWin; varying vec2 vSeed; varying float vRoof;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vFac = uv; vWall = aWall; vWin = aWin; vSeed = aSeed; vRoof = aRoof;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uNight, uLit, uWarm, uWallMul, uSnow, uLodLo, uLodHi; uniform vec3 uGlassDark, uGlassSky, uRoof;
        varying vec2 vFac; varying vec3 vWall; varying vec4 vWin; varying vec2 vSeed; varying float vRoof;
        float h12(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 cell = floor(vFac); vec2 fc = fract(vFac);
        float hA = h12(cell + vSeed.x*0.731);
        float hB = h12(cell.yx*1.37 + vSeed.x*0.177 + 3.1);
        float notRoof = 1.0 - vRoof;
        float aa = 0.03;
        float ground = step(cell.y, 0.5) * vWin.w * notRoof;
        // window size per axis: regular windows, ground-floor shopfronts, curtain-wall glass
        vec2 ws = vWin.xy; float wyc = 0.47;
        if (ground > 0.5) { ws = vec2(0.92, 0.70); wyc = 0.40; }
        if (vWin.z > 0.5) { ws = vec2(0.92, 0.84); wyc = 0.5; }
        // window edges soften over about one pixel, so small windows don't crawl as the camera moves
        vec2 fw = fwidth(vFac);
        vec2 ea = max(vec2(aa), fw * 0.85);
        float wx = smoothstep(ws.x*0.5 + ea.x, ws.x*0.5 - ea.x, abs(fc.x-0.5));
        float wy = smoothstep(ws.y*0.5 + ea.y, ws.y*0.5 - ea.y, abs(fc.y-wyc));
        // filter each axis separately once cells get small on screen: edge-on walls keep their floors
        float lodX = smoothstep(uLodLo, uLodHi, fw.x) * notRoof;
        float lodY = smoothstep(uLodLo, uLodHi, fw.y) * notRoof;
        float lod = max(lodX, lodY);
        wx = mix(wx, ws.x, lodX); wy = mix(wy, ws.y, lodY);
        float win = wx*wy*notRoof;
        vec3 wallC = vWall * (0.93 + 0.12*h12(vec2(cell.y, vSeed.x))) ;
        // cornice line at each floor and darker base
        wallC *= 1.0 - 0.10*smoothstep(0.06, 0.0, fc.y) * notRoof;
        wallC *= mix(0.72, 1.0, smoothstep(0.0, 1.2, vFac.y));
        vec3 glass = mix(uGlassDark, uGlassSky, mix(0.18 + 0.55*hB, 0.45, lod));
        glass *= mix(mix(1.0, 0.55, step(0.72, hA)), 0.88, lod);   // some windows with drawn blinds
        glass = mix(glass, glass*vec3(0.8,0.97,1.12), vWin.z);
        if (ground > 0.5) glass = mix(uGlassDark, uGlassSky, 0.25) * 0.8;
        wallC *= uWallMul;
        vec3 roofC = uRoof * (0.8 + 0.4*h12(vSeed.xx));
        roofC = mix(roofC, vec3(0.93, 0.95, 0.98), uSnow);
        vec3 facadeC = mix(wallC, glass, win);
        facadeC = mix(facadeC, vec3(0.9, 0.92, 0.96), uSnow * 0.5 * smoothstep(0.08, 0.0, fc.y) * notRoof); // snow on ledges
        diffuseColor.rgb = mix(facadeC, roofC, vRoof);
      `)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.22, win);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float lit = step(hA, uLit);
          float toOff = vSeed.y - uTime;
          float flickZone = step(0.0, toOff) * (1.0 - step(0.9, toOff));
          float fl = h12(vec2(floor(uTime*22.0), vSeed.x));
          lit *= step(0.0, toOff) * mix(1.0, step(0.5, fl), flickZone);
          vec3 lc = mix(vec3(1.0,0.55,0.22), vec3(1.0,0.78,0.48), hB);
          lc = mix(lc, vec3(0.62,0.75,1.0), step(0.88, fract(hA*9.17)));
          float k = 0.12 + 0.75*pow(fract(hA*13.7), 1.6);
          if (ground > 0.5) { lit = step(0.0, toOff) * step(0.35, hA); k = 0.9; }
          // far away: average of the pattern instead of per-window noise (floors still vary)
          float rowH = h12(vec2(cell.y*1.13, vSeed.x*0.37));
          float litAvg = mix(uLit * (0.25 + 1.4*rowH*rowH), uLit, lodY) * step(0.0, toOff) * mix(1.0, 0.6, flickZone);
          lit = mix(lit, litAvg, lod); k = mix(k, 0.22, lod); lc = mix(lc, mix(vec3(1.0,0.62,0.32), vec3(1.0,0.8,0.55), rowH), lod);
          totalEmissiveRadiance += win * lit * lc * k * uNight;
        }`);
  };
  mat.customProgramCacheKey = () => 'facade-v4';
  return mat;
}

// Paint streets, sidewalks, parks and sand into one big texture.
function buildGround(city, o, r) {
  const W = o.x1 - o.x0 + 400, D = o.z1 - o.z0 + 400;
  const gx0 = o.x0 - 200, gz0 = o.z0 - 200;
  const S = o.texSize, sx = S / W, sz = S / D;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const X = (x) => (x - gx0) * sx, Z = (z) => (z - gz0) * sz;
  c.fillStyle = o.groundColor; c.fillRect(0, 0, S, S);

  // beach / water classification painted per cell
  const step = 4;
  for (let z = gz0; z < gz0 + D; z += step) for (let x = gx0; x < gx0 + W; x += step) {
    const k = o.land(x, z);
    if (k === 'land') continue;
    c.fillStyle = k === 'beach' ? '#d6c398' : '#6c6550';
    c.fillRect(X(x), Z(z), step * sx + 1, step * sz + 1);
  }
  // wet sand line + foam at the water's edge
  for (let z = gz0; z < gz0 + D; z += 2) for (let x = gx0; x < gx0 + W; x += 2) {
    if (o.land(x, z) === 'beach' && o.land(x, z - 6) === 'water') { c.fillStyle = '#b9a47e'; c.fillRect(X(x), Z(z), 2 * sx + 1, 2 * sz + 1); }
  }

  // blocks: sidewalks + lots / parks
  for (const b of city.blocks) {
    if (b.kind === 'water') continue;
    if (b.kind === 'edge') continue;
    c.fillStyle = '#a9a7a1';
    c.fillRect(X(b.bx0), Z(b.bz0), (b.bx1 - b.bx0) * sx, (b.bz1 - b.bz0) * sz);
    const ix0 = b.bx0 + o.sidewalk, ix1 = b.bx1 - o.sidewalk, iz0 = b.bz0 + o.sidewalk, iz1 = b.bz1 - o.sidewalk;
    if (b.kind === 'park') {
      c.fillStyle = '#5d8a3f'; c.fillRect(X(ix0), Z(iz0), (ix1 - ix0) * sx, (iz1 - iz0) * sz);
      // diagonal and cross paths with a round plaza
      c.strokeStyle = '#cbbf9f'; c.lineWidth = 3.2 * sx;
      c.beginPath();
      c.moveTo(X(ix0), Z(iz0)); c.lineTo(X(ix1), Z(iz1));
      c.moveTo(X(ix1), Z(iz0)); c.lineTo(X(ix0), Z(iz1));
      c.moveTo(X((ix0 + ix1) / 2), Z(iz0)); c.lineTo(X((ix0 + ix1) / 2), Z(iz1));
      c.moveTo(X(ix0), Z((iz0 + iz1) / 2)); c.lineTo(X(ix1), Z((iz0 + iz1) / 2));
      c.stroke();
      c.fillStyle = '#cbbf9f'; c.beginPath(); c.ellipse(X(b.cx), Z(b.cz), 12 * sx, 12 * sz, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#7f98a8'; c.beginPath(); c.ellipse(X(b.cx), Z(b.cz), 5 * sx, 5 * sz, 0, 0, Math.PI * 2); c.fill();
      // grass mottling
      for (let k = 0; k < 160; k++) {
        c.fillStyle = r.chance(0.5) ? 'rgba(70,110,50,0.35)' : 'rgba(120,160,80,0.25)';
        c.beginPath(); c.ellipse(X(r.float(ix0, ix1)), Z(r.float(iz0, iz1)), r.float(1, 4) * sx, r.float(1, 4) * sz, 0, 0, Math.PI * 2); c.fill();
      }
    } else {
      c.fillStyle = '#7b7974'; c.fillRect(X(ix0), Z(iz0), (ix1 - ix0) * sx, (iz1 - iz0) * sz);
    }
    // sidewalk edge (curb)
    c.strokeStyle = 'rgba(60,60,60,0.5)'; c.lineWidth = 0.4 * sx;
    c.strokeRect(X(b.bx0), Z(b.bz0), (b.bx1 - b.bx0) * sx, (b.bz1 - b.bz0) * sz);
  }

  // roads
  const zMin = o.z0, zMax = o.z1, xMin = o.x0, xMax = o.x1;
  const roadOk = (x, z) => o.land(x, z) !== 'water';
  c.fillStyle = '#3c3e41';
  for (const x of city.roadsX) for (let z = zMin; z < zMax; z += 2) if (roadOk(x, z)) c.fillRect(X(x - o.road / 2), Z(z), o.road * sx, 2 * sz + 1);
  for (const z of city.roadsZ) for (let x = xMin; x < xMax; x += 2) if (roadOk(x, z)) c.fillRect(X(x), Z(z - o.road / 2), 2 * sx + 1, o.road * sz);
  // lane markings
  c.fillStyle = '#d8cf9e';
  for (const x of city.roadsX) for (let z = zMin; z < zMax; z += 9) if (roadOk(x, z) && !nearAny(z, city.roadsZ, o.road * 0.8)) c.fillRect(X(x - 0.15), Z(z), 0.3 * sx, 4.5 * sz);
  for (const z of city.roadsZ) for (let x = xMin; x < xMax; x += 9) if (roadOk(x, z) && !nearAny(x, city.roadsX, o.road * 0.8)) c.fillRect(X(x), Z(z - 0.15), 4.5 * sx, 0.3 * sz);
  // crosswalks
  c.fillStyle = 'rgba(235,235,230,0.9)';
  for (const x of city.roadsX) for (const z of city.roadsZ) {
    if (!roadOk(x, z)) continue;
    for (let k = -o.road / 2 + 1.5; k < o.road / 2 - 1; k += 1.6) {
      c.fillRect(X(x + k), Z(z - o.road / 2 - 3.2), 0.8 * sx, 3 * sz);
      c.fillRect(X(x + k), Z(z + o.road / 2 + 0.2), 0.8 * sx, 3 * sz);
      c.fillRect(X(x - o.road / 2 - 3.2), Z(z + k), 3 * sx, 0.8 * sz);
      c.fillRect(X(x + o.road / 2 + 0.2), Z(z + k), 3 * sx, 0.8 * sz);
    }
  }
  // grime / speckle to break up flat color
  const img = c.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r.next() - 0.5) * 14;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  c.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.flipY = false;
  const geo = new THREE.PlaneGeometry(W, D, Math.round(W / 8), Math.round(D / 8));
  geo.rotateX(-Math.PI / 2);
  // PlaneGeometry after rotateX: uv.y=1 is at -z. Remap so v follows +z like the canvas rows.
  const uvA = geo.attributes.uv, posA = geo.attributes.position;
  for (let i = 0; i < uvA.count; i++) uvA.setXY(i, (posA.getX(i) + W / 2) / W, (posA.getZ(i) + D / 2) / D);
  geo.translate(gx0 + W / 2, 0, gz0 + D / 2);
  for (let i = 0; i < posA.count; i++) {
    const x = posA.getX(i), z = posA.getZ(i);
    posA.setY(i, o.elev ? o.elev(x, z) : (o.land(x, z) === 'water' ? -4 : 0));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
  const gu = { uSnow: { value: 0 } };
  mat.userData.uniforms = gu;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, gu);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.92, 0.96), uSnow * (0.85 + 0.15*fract(sin(dot(vMapUv, vec2(91.3, 47.1)))*4375.5)));`);
  };
  mat.customProgramCacheKey = () => 'ground-v1';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.userData.bounds = { gx0, gz0, W, D };
  return mesh;
}

function nearAny(v, arr, d) { for (const a of arr) if (Math.abs(v - a) < d) return true; return false; }

export { STYLES };
