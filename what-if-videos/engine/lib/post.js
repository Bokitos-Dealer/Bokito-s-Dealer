// Post-processing for layered scenes, rendered offline (cost per frame matters less than look).
//
// LayeredPass  draws ctx.view.layers far to near (a real-scale planet behind, a metre-scale set in front),
//              optionally averaging N sub-frames across a shutter for true motion blur, and keeps the set
//              layer's depth for depth of field.
// DOFPass      a gathered bokeh blur (golden-angle disc) driven by the set's depth: focus distance, aperture,
//              and how soft the far layer (sky, planet) goes.
// GradePass    the finishing look in display space: contrast curve, split-tone (cool shadows, warm highlights),
//              saturation, chromatic aberration at the edges, vignette and animated film grain.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const quadVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export class LayeredPass extends Pass {
  constructor(ctx, w, h) {
    super();
    this.ctx = ctx; this.needsSwap = false; this.clear = true;
    const opt = { type: THREE.HalfFloatType };
    this.layerRT = new THREE.WebGLRenderTarget(w, h, Object.assign({ depthTexture: new THREE.DepthTexture(w, h) }, opt));
    this.accRT = new THREE.WebGLRenderTarget(w, h, opt);
    this.farRT = new THREE.WebGLRenderTarget(w, h, opt);
    this.blend = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uW: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: quadVS,
      fragmentShader: 'uniform sampler2D tSrc; uniform float uW; varying vec2 vUv; void main(){ vec3 c = texture2D(tSrc, vUv).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); gl_FragColor = vec4(min(c, vec3(64.0)), uW); }',
    }));
    this.copy = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null } }, depthTest: false, depthWrite: false, vertexShader: quadVS,
      fragmentShader: 'uniform sampler2D tSrc; varying vec2 vUv; void main(){ vec3 c = texture2D(tSrc, vUv).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); gl_FragColor = vec4(min(c, vec3(64.0)), 1.0); }',
    }));
    this.depthTexture = this.layerRT.depthTexture;
    this.nearCamera = null;
  }
  setSize(w, h) { this.layerRT.setSize(w, h); this.accRT.setSize(w, h); this.farRT.setSize(w, h); }
  // the far layer once into farRT (it is the costly one and barely moves within a frame)
  drawFar(renderer) {
    const v = this.ctx.view, F = v.layers[0];
    if (v.beforeDraw) v.beforeDraw(renderer);
    renderer.setRenderTarget(this.farRT); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
    renderer.render(F.scene, F.camera);
  }
  // the near layers over a copy of it, optionally jittered
  drawNear(renderer, target, jitter = null) {
    const v = this.ctx.view, layers = v.layers.slice(1), W = target.width, H = target.height;
    if (jitter) for (const L of layers) L.camera.setViewOffset(W, H, jitter[0], jitter[1], W, H);
    renderer.setRenderTarget(target); renderer.clear(true, true, true);
    this.copy.material.uniforms.tSrc.value = this.farRT.texture; this.copy.render(renderer);
    renderer.autoClear = false; renderer.clearDepth();
    for (const L of layers) { renderer.render(L.scene, L.camera); renderer.clearDepth(); }
    renderer.autoClear = true;
    if (jitter) for (const L of layers) L.camera.clearViewOffset();
    this.nearCamera = layers[layers.length - 1].camera;
  }
  drawLayers(renderer, target, jitter = null) {
    const v = this.ctx.view, layers = v.layers ?? [{ scene: v.scene, camera: v.camera }];
    if (v.beforeDraw) v.beforeDraw(renderer);              // e.g. a low-res sky that must be drawn first
    const W = target.width, H = target.height;
    // sub-pixel jitter (anti-aliasing when sub-frames are averaged)
    if (jitter) for (const L of layers) { L.camera.setViewOffset(W, H, jitter[0], jitter[1], W, H); }
    renderer.setRenderTarget(target);
    renderer.autoClear = false; renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
    layers.forEach((L, i) => { if (i) renderer.clearDepth(); renderer.render(L.scene, L.camera); });
    renderer.autoClear = true;
    if (jitter) for (const L of layers) L.camera.clearViewOffset();
    this.nearCamera = layers[layers.length - 1].camera;
  }
  render(renderer, writeBuffer, readBuffer) {
    const ctx = this.ctx, mb = ctx.motionBlur;
    if (mb && mb.samples > 1 && ctx.poseAt && ctx.view.layers?.length > 1 && mb.farOnce) {
      const n = mb.samples, t = ctx.t, sh = (mb.shutter ?? 0.5) / ctx.FPS;
      ctx.poseAt(t); this.drawFar(renderer);
      for (let k = 0; k < n; k++) {
        ctx.poseAt(t - sh / 2 + sh * (k + 0.5) / n, k);
        this.drawNear(renderer, this.layerRT, [halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5]);
        renderer.setRenderTarget(this.accRT);
        if (k === 0) { this.copy.material.uniforms.tSrc.value = this.layerRT.texture; this.copy.render(renderer); }
        else { this.blend.material.uniforms.tSrc.value = this.layerRT.texture; this.blend.material.uniforms.uW.value = 1 / (k + 1); renderer.autoClear = false; this.blend.render(renderer); renderer.autoClear = true; }   // blend over what's there: no clear
      }
      ctx.poseAt(t);
      this.drawNear(renderer, this.layerRT);                     // depth and the final pose for the passes after
      renderer.setRenderTarget(readBuffer);
      this.copy.material.uniforms.tSrc.value = this.accRT.texture; this.copy.render(renderer);
      return;
    }
    if (mb && mb.samples > 1 && ctx.poseAt) {
      // average sub-frames spread over the shutter (centred on the frame time), then the frame itself on top
      const n = mb.samples, t = ctx.t, sh = (mb.shutter ?? 0.5) / ctx.FPS;
      for (let k = 0; k < n; k++) {
        ctx.poseAt(t - sh / 2 + sh * (k + 0.5) / n, k);
        this.drawLayers(renderer, this.layerRT, mb.noJitter ? null : [halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5]);
        renderer.setRenderTarget(this.accRT);
        if (k === 0 || mb.only === k) { this.copy.material.uniforms.tSrc.value = this.layerRT.texture; this.copy.render(renderer); }
        else if (mb.only == null) { this.blend.material.uniforms.tSrc.value = this.layerRT.texture; this.blend.material.uniforms.uW.value = 1 / (k + 1); renderer.autoClear = false; this.blend.render(renderer); renderer.autoClear = true; }   // blend over what's there: no clear
      }
      ctx.poseAt(t);
      if (!mb.reuseDepth) this.drawLayers(renderer, this.layerRT);   // depth (and the final pose) for the passes after; else the last sub-frame's depth serves
      renderer.setRenderTarget(readBuffer);
      this.copy.material.uniforms.tSrc.value = this.accRT.texture; this.copy.render(renderer);
    } else {
      this.drawLayers(renderer, this.layerRT);
      renderer.setRenderTarget(readBuffer);
      this.copy.material.uniforms.tSrc.value = this.layerRT.texture; this.copy.render(renderer);
    }
  }
}

export class DOFPass extends Pass {
  constructor(layered) {
    super();
    this.layered = layered;
    this.params = { focus: 5, aperture: 0.0, maxBlur: 0.012, farBlur: 0.6, enabled: true };
    this.q = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 1000 }, uFocus: { value: 5 }, uAperture: { value: 0 },
        uMaxBlur: { value: 0.01 }, uFarBlur: { value: 0.6 }, uAspect: { value: 9 / 16 } },
      depthTest: false, depthWrite: false, vertexShader: quadVS,
      fragmentShader: `
        uniform sampler2D tColor, tDepth; uniform float uNear, uFar, uFocus, uAperture, uMaxBlur, uFarBlur, uAspect; varying vec2 vUv;
        float viewZ(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
        float coc(vec2 uv){
          float d = texture2D(tDepth, uv).x;
          if (d >= 0.99999) return uMaxBlur * uFarBlur;                 // the far layer: sky and planet, softly out of focus
          float z = viewZ(d);
          return clamp(uAperture * abs(z - uFocus) / max(z, 0.001), 0.0, uMaxBlur);
        }
        void main(){
          float c0 = coc(vUv);
          vec3 acc = texture2D(tColor, vUv).rgb; float wsum = 1.0;
          if (c0 > 0.0004) {
            const int N = 26;
            for (int i = 1; i < N; i++) {
              float r = sqrt(float(i) / float(N)), a = float(i) * 2.39996323;
              vec2 o = vec2(cos(a) * uAspect, sin(a)) * r * c0;
              vec2 uv = vUv + o;
              float cs = coc(uv);
              float w = smoothstep(0.0, 1.0, cs / max(r * c0, 1e-5) + 0.3);     // a sharp thing in front doesn't smear over the background
              acc += texture2D(tColor, uv).rgb * w; wsum += w;
            }
          }
          gl_FragColor = vec4(acc / wsum, 1.0);
        }`,
    }));
  }
  render(renderer, writeBuffer, readBuffer) {
    const P = this.params, U = this.q.material.uniforms, cam = this.layered.nearCamera;
    if (!P.enabled || !cam || P.aperture <= 0 && P.farBlur <= 0) { this.needsSwap = false; return; }
    this.needsSwap = true;
    U.tColor.value = readBuffer.texture; U.tDepth.value = this.layered.depthTexture;
    U.uNear.value = cam.near; U.uFar.value = cam.far; U.uFocus.value = P.focus; U.uAperture.value = P.aperture;
    U.uMaxBlur.value = P.maxBlur; U.uFarBlur.value = P.farBlur; U.uAspect.value = readBuffer.height / readBuffer.width;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.q.render(renderer);
  }
}

export class GradePass extends Pass {
  constructor() {
    super();
    this.params = { contrast: 1.08, saturation: 1.06, lift: [0.0, 0.01, 0.025], gain: [1.03, 1.0, 0.96], split: 0.08, vignette: 0.35, grain: 0.035, ca: 0.0015, exposure: 1.0, frame: 0 };
    this.q = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, uContrast: { value: 1 }, uSat: { value: 1 }, uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) },
        uSplit: { value: 0 }, uVig: { value: 0 }, uGrain: { value: 0 }, uCA: { value: 0 }, uExp: { value: 1 }, uSeed: { value: 0 }, uAspect: { value: 9 / 16 } },
      depthTest: false, depthWrite: false, vertexShader: quadVS,
      fragmentShader: `
        uniform sampler2D tColor; uniform float uContrast, uSat, uSplit, uVig, uGrain, uCA, uExp, uSeed, uAspect; uniform vec3 uLift, uGain; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
        void main(){
          vec2 d = vUv - 0.5;
          // chromatic aberration grows toward the edges
          vec2 off = d * uCA * dot(d, d) * 4.0;
          vec3 c = vec3(texture2D(tColor, vUv + off).r, texture2D(tColor, vUv).g, texture2D(tColor, vUv - off).b) * uExp;
          // contrast around mid-grey on a soft S curve
          c = clamp(c, 0.0, 1.0);
          c = mix(c, c * c * (3.0 - 2.0 * c), uContrast - 1.0);
          // lift/gain, then split-tone: cool shadows, warm highlights
          c = c * uGain + uLift * (1.0 - c);
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c += uSplit * (mix(vec3(-0.02, 0.0, 0.05), vec3(0.05, 0.02, -0.04), smoothstep(0.15, 0.75, l)));
          c = mix(vec3(l), c, uSat);
          // vignette
          vec2 vd = d * vec2(1.0, uAspect);
          c *= 1.0 - uVig * smoothstep(0.25, 0.85, length(d * vec2(1.0, 1.25)) * 1.25);
          // grain, stronger in the mids
          float g = h(vUv * 1000.0) - 0.5;
          c += g * uGrain * (0.6 + 0.8 * l * (1.0 - l) * 4.0) * 0.5;
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }`,
    }));
  }
  render(renderer, writeBuffer, readBuffer) {
    const P = this.params, U = this.q.material.uniforms;
    U.tColor.value = readBuffer.texture; U.uContrast.value = P.contrast; U.uSat.value = P.saturation;
    U.uLift.value.set(...P.lift); U.uGain.value.set(...P.gain); U.uSplit.value = P.split; U.uVig.value = P.vignette;
    U.uGrain.value = P.grain; U.uCA.value = P.ca; U.uExp.value = P.exposure; U.uSeed.value = (P.frame % 97) * 1.37;
    U.uAspect.value = readBuffer.height / readBuffer.width;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.q.render(renderer);
  }
}
