// Stylised ocean: procedural ripples, fresnel sky reflection, sun glints, fog.
import * as THREE from 'three';

export function buildWater(opts = {}) {
  const o = Object.assign({ size: 40000, level: -0.6 }, opts);
  const custom = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color('#1f4a5c') },
    uSky: { value: new THREE.Color('#b9cad8') },
    uSkyTop: { value: new THREE.Color('#6f93bb') },
    uSunDir: { value: new THREE.Vector3(0.3, 0.35, -0.9).normalize() },
    uSunCol: { value: new THREE.Color('#fff4dd') },
    uSpec: { value: 1.0 },
    uChop: { value: 0.35 },
    uRefl: { value: new THREE.Color('#000000') },   // extra reflected light (aurora, fire)
    uReflDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() },
    uFoam: { value: 0 },
    uMurk: { value: new THREE.Color('#000000') },
    uShallow: { value: new THREE.Color('#3fa6a0') },
    uShore: { value: 0 },          // 1 = draw shallow tint + surf line from the terrain function
    uLevel: { value: o.level },
    uSwell: { value: 0 },          // height of rolling swell (m)
    uSpecPow: { value: 420 },      // lower = wider light path (moon glitter path)
    uFreeze: { value: 0 },         // 0 water .. 1 frozen sea ice
    uPathStr: { value: 0 },        // smooth light path (moon/sun glitter) without per-pixel sparkle aliasing
    uPathRough: { value: 0.12 },
    uPathCol: { value: new THREE.Color('#dfe6ff') },
    uChopDist: { value: 350 },
    uFoamCol: { value: new THREE.Color(0.92, 0.94, 0.92) },
    uSurfW: { value: 1.4 },        // width of the surf line, in metres of water depth
    uSwellDir: { value: new THREE.Vector2(0, 1) },
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);
  const mat = new THREE.ShaderMaterial({
    uniforms, fog: true,
    vertexShader: `
      varying vec3 vWorld; varying float vCrest;
      uniform float uSwell, uTime; uniform vec2 uSwellDir;
      #include <common>
      #include <fog_pars_vertex>
      float swellH(vec2 p){
        vec2 d = normalize(uSwellDir);
        float a = dot(p, d);
        float s = sin(a*0.075 - uTime*2.4) * 0.6 + sin(a*0.043 + p.x*0.01 - uTime*1.7) * 0.4 + sin(dot(p, vec2(0.6,0.8))*0.11 - uTime*3.1) * 0.15;
        return s;
      }
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float sh = swellH(wp.xz);
        wp.y += sh * uSwell;
        vCrest = sh;
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime, uSpec, uChop, uFoam;
      uniform vec3 uDeep, uSky, uSkyTop, uSunDir, uSunCol, uRefl, uReflDir, uMurk, uShallow;
      uniform float uShore, uLevel, uSpecPow, uFreeze, uPathStr, uPathRough, uChopDist;
      uniform vec3 uPathCol, uFoamCol; uniform float uSurfW;
      ${o.terrainGLSL || 'float terrain(vec2 p){ return -10.0; }'}
      varying vec3 vWorld; varying float vCrest;
      uniform float uSwell; uniform vec2 uSwellDir;
      #include <common>
      #include <fog_pars_fragment>
      float h12(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }
      vec2 grad(vec2 p){
        vec2 g = vec2(0.0);
        const int N = 6;
        for (int i=0;i<N;i++){
          float fi = float(i);
          float ang = fi*1.71 + 0.4;
          vec2 dir = vec2(cos(ang), sin(ang));
          float wl = 3.0 + fi*fi*2.2;
          float k = 6.2831/wl;
          float ph = dot(dir, p)*k + uTime*sqrt(9.8*k)*0.9 + fi*2.1;
          g += dir * cos(ph) * k * (wl*0.012);
        }
        float e = 0.6;
        float n0 = vn(p*0.35 + uTime*0.25);
        g += vec2(vn(p*0.35 + vec2(e,0.0) + uTime*0.25) - n0, vn(p*0.35 + vec2(0.0,e) + uTime*0.25) - n0) * 0.8;
        return g;
      }
      void main(){
        vec3 V = normalize(cameraPosition - vWorld);
        float dist = length(cameraPosition - vWorld);
        float chop = uChop / (1.0 + dist/uChopDist);
        vec2 g = grad(vWorld.xz);
        // fine ripples that only matter up close
        float nearW = 1.0 - smoothstep(15.0, 140.0, dist);
        if (nearW > 0.0) {
          vec2 q = vWorld.xz;
          g += nearW * (vec2(0.8, 0.6) * cos(dot(q, vec2(0.8, 0.6))*8.0 + uTime*3.1) * 0.9
                      + vec2(-0.5, 0.86) * cos(dot(q, vec2(-0.5, 0.86))*5.3 + uTime*2.4) * 0.8
                      + vec2(0.95, -0.3) * cos(dot(q, vec2(0.95, -0.3))*12.0 + uTime*3.9) * 0.6) * 0.35;
          float e2 = 0.25; float m0 = vn(q*2.2 + uTime*0.7);
          g += nearW * vec2(vn(q*2.2 + vec2(e2,0.0) + uTime*0.7) - m0, vn(q*2.2 + vec2(0.0,e2) + uTime*0.7) - m0) * 2.5;
        }
        vec3 n = normalize(vec3(-g.x*chop, 1.0, -g.y*chop));
        float ndv = max(dot(n, V), 0.0);
        float fres = 0.03 + 0.97*pow(1.0 - ndv, 5.0);
        vec3 R = reflect(-V, n);
        vec3 refl = mix(uSky, uSkyTop, clamp(R.y*2.2, 0.0, 1.0));
        refl += uRefl * (0.35 + 0.65*pow(max(dot(normalize(R*vec3(1.0,0.0,1.0)+vec3(0.0,0.0001,0.0)), normalize(uReflDir*vec3(1.0,0.0,1.0))),0.0), 4.0));
        float depth = uLevel - terrain(vWorld.xz);
        vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 9.0, depth));
        body = mix(uDeep, body, uShore);
        vec3 col = mix(body, refl, fres);
        float spec = pow(max(dot(R, uSunDir), 0.0), uSpecPow) * 4.0 + pow(max(dot(R, uSunDir), 0.0), uSpecPow * 0.1)*0.15;
        col += uSunCol * spec * uSpec;
        col += uMurk;
        if (uPathStr > 0.0) {
          // glitter path: wave-slope lobe around the mirror direction, from the flat surface normal
          vec3 Hh = normalize(V + uSunDir);
          float ct = max(Hh.y, 1e-3);
          float t2 = (1.0 - ct*ct) / (ct*ct);
          float lobe = exp(-t2 / (uPathRough*uPathRough));
          float sc = 260.0 / (dist + 260.0);
          float spark = 0.35 + 1.3 * vn(vWorld.xz * 0.45 * sc + uTime * vec2(0.5, 1.1)) * vn(vWorld.xz * 1.1 * sc - uTime * vec2(0.8, 0.3));
          col += uPathCol * lobe * spark * uPathStr;
        }
        float foam = smoothstep(0.55, 0.8, vn(vWorld.xz*0.12 + uTime*0.1)) * uFoam;
        // surf line where the water meets the land
        float surf = (1.0 - smoothstep(0.0, uSurfW * (1.0 + 0.55*vn(vWorld.xz*0.05 + uTime*0.2)), depth)) * uShore;
        surf *= 0.6 + 0.4*sin(depth*6.0 - uTime*2.5 + vn(vWorld.xz*0.3)*4.0);
        foam = max(foam, clamp(surf, 0.0, 1.0));
        // whitecaps on swell crests
        foam = max(foam, smoothstep(0.55, 0.95, vCrest) * smoothstep(0.2, 1.5, uSwell) * (0.5 + 0.5*vn(vWorld.xz*0.2 + uTime*0.5)));
        col = mix(col, uFoamCol, foam*0.7);
        if (uFreeze > 0.0) {
          // sea ice: white plates with blue cracks, spreading from the shore outwards
          float n1 = vn(vWorld.xz*0.02), n2 = vn(vWorld.xz*0.11);
          float shore = 1.0 - clamp(-vWorld.z/4000.0, 0.0, 1.0);          // 1 at the shore, 0 far out
          float th = 1.0 - uFreeze*1.15;
          float edge = smoothstep(th, th + 0.08, shore + (n1 - 0.5)*0.12);
          float crack = smoothstep(0.03, 0.0, abs(vn(vWorld.xz*0.045) - 0.5)) * 0.6 + smoothstep(0.02, 0.0, abs(n2 - 0.5)) * 0.3;
          vec3 ice = mix(vec3(0.66, 0.77, 0.86), vec3(0.9, 0.93, 0.97), smoothstep(0.25, 0.75, n2 * 0.6 + vn(vWorld.xz*0.006) * 0.6)) - crack * vec3(0.3, 0.18, 0.06);
          ice = mix(ice, refl, fres*0.25);
          col = mix(col, ice, edge);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const seg = o.segments ?? 1;
  const geo = new THREE.PlaneGeometry(o.size, o.size, seg, seg);
  if (o.dense) {
    // squeeze vertices toward the focus so swell has detail near the camera
    const pa = geo.attributes.position, half = o.size / 2, pw = o.dense.power ?? 2.2;
    for (let i = 0; i < pa.count; i++) {
      const u = pa.getX(i) / half, v = pa.getY(i) / half;
      pa.setX(i, Math.sign(u) * Math.pow(Math.abs(u), pw) * half + o.dense.x);
      pa.setY(i, Math.sign(v) * Math.pow(Math.abs(v), pw) * half - o.dense.z);
    }
  }
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = o.level;
  mesh.renderOrder = -1;
  return { mesh, uniforms, set level(v) { mesh.position.y = v; uniforms.uLevel.value = v; }, get level() { return mesh.position.y; } };
}
