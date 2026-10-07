// Shot compositor for "What if the Moon suddenly disappeared?"
// Each shot is a photoreal plate + depth map, moved with a 2.5D parallax camera,
// graded in a shader, with diagrams/particles on a 2D layer and captions in the DOM.
const W = 1080, H = 1920, FPS = 30;
const $ = (s) => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const voice = await (await fetch('/moon/audio/voice_af_heart.json')).json();
const words = (await (await fetch('/moon/audio/words_af_heart.json')).json()).words;
const line = (id) => voice.lines.find((l) => l.id === id);
const wordAt = (text, after = 0) => words.find((w) => w.s >= after - 0.05 && w.w.toLowerCase().replace(/[^a-z0-9]/g, '') === text);

// ---------------------------------------------------------------- timeline
const T = {
  vanish: wordAt('disappeared').s + 0.05,
  without7: wordAt('without', line('L7').start).s,
  without11: wordAt('without', line('L11').start).s,
  wobble: wordAt('wobble', line('L15').start).s,
  ice: wordAt('small', line('L15').start).s + 0.3,
  end: Math.ceil(voice.duration + 2.4),
};
const EARTH = { x: 525, y: 953, r: 527 };   // Earth disc in the earth_space plate (px)

// cam: zoom, pan [x,y] (fraction of frame), par [x,y] (parallax shift), rot, focus
// look: exp, sat, con, warm, keep (protect bright lights when darkening), alt (mix to alt plate),
//       shimmer, waterY, twinkle, skyY, ice, stars, vig
const shots = [
  { plate: 'moon_city', alt: 'moon_city_nomoon', t0: 0, t1: line('L2').start - 0.05,
    cam: (u) => ({ zoom: lerp(1.03, 1.1, ease(u)), pan: [0, lerp(-0.012, -0.03, u)], par: [lerp(-0.004, 0.004, u), 0], focus: 0.2 }),
    look: (t) => ({ alt: sm(T.vanish, T.vanish + 0.28, t), exp: 1.05 - 0.22 * sm(T.vanish + 0.1, T.vanish + 1.4, t), shimmer: 1, waterY: 0.565, twinkle: 0.6, skyY: 0.5 }) },
  { plate: 'people_lookup', t0: line('L2').start - 0.05, t1: line('L3').start - 0.08,
    cam: (u) => ({ zoom: lerp(1.12, 1.04, ease(u)), pan: [0, lerp(0.015, -0.01, u)], par: [lerp(-0.018, 0.018, u), lerp(0.006, -0.004, u)], focus: 0.35 }),
    look: () => ({ exp: 0.92, sat: 0.92, warm: 0.15 }) },
  { plate: 'moon_city_nomoon', depth: 'moon_city', t0: line('L3').start - 0.08, t1: line('L4').start - 0.06,
    cam: (u) => ({ zoom: lerp(1.0, 1.07, ease(u)), pan: [0, lerp(0.0, -0.02, u)], par: [lerp(0.004, -0.004, u), 0], focus: 0.2 }),
    look: (t, u) => ({ exp: lerp(0.86, 0.6, ease(u)), keep: 0.85, shimmer: 1, waterY: 0.565, twinkle: 0.8, skyY: 0.5 }) },
  { plate: 'moonlit_road', t0: line('L4').start - 0.06, t1: line('L5').start - 0.08,
    cam: (u) => ({ zoom: lerp(1.02, 1.1, ease(u)), pan: [0, lerp(0.01, -0.01, u)], par: [0, lerp(0.012, -0.012, u)], focus: 0.3 }),
    look: (t) => { const k = sm(10.15, 11.0, t); return { exp: lerp(1.0, 0.075, k), keep: 0.9, sat: lerp(1, 0.6, k), twinkle: 0.4 * k, skyY: 0.32 }; } },
  { plate: 'milkyway', t0: line('L5').start - 0.08, t1: line('L6').start - 0.1,
    cam: (u) => ({ zoom: lerp(1.12, 1.04, u), pan: [0, lerp(0.035, -0.035, ease(u))], par: [0, lerp(-0.006, 0.006, u)], focus: 0.4 }),
    look: () => ({ exp: 1.05, twinkle: 1, skyY: 0.75, sat: 1.05 }) },
  { plate: 'ocean_waves', t0: line('L6').start - 0.1, t1: line('L7').start - 0.1,
    cam: (u) => ({ zoom: lerp(1.16, 1.02, ease(u)), pan: [0, 0], par: [lerp(0.012, -0.012, u), lerp(0.02, -0.01, u)], rot: lerp(0.025, -0.005, u), focus: 0.5 }),
    look: () => ({ exp: 0.95, sat: 0.9, con: 1.08 }) },
  { plate: 'earth_space', t0: line('L7').start - 0.1, t1: line('L8').start - 0.08, earth: true,
    cam: (u) => ({ zoom: lerp(0.86, 0.93, ease(u)), pan: [0, -0.01], par: [0, 0], rot: lerp(-0.03, 0.02, u) }),
    look: () => ({ exp: 1.0, sat: 1.05, stars: 1 }), overlay: drawBulge },
  { plate: 'harbor_lowtide', t0: line('L8').start - 0.08, t1: line('L9').start - 0.08,
    cam: (u) => ({ zoom: lerp(1.02, 1.1, ease(u)), pan: [0, lerp(0.0, 0.02, u)], par: [lerp(-0.012, 0.012, u), 0], focus: 0.4 }),
    look: () => ({ exp: 0.98, sat: 0.95, con: 1.05 }) },
  { plate: 'tidepool', t0: line('L9').start - 0.08, t1: line('L10').start - 0.08,
    cam: (u) => ({ zoom: lerp(1.0, 1.18, ease(u)), pan: [lerp(0.0, 0.02, u), lerp(0.0, 0.03, u)], par: [lerp(0.015, -0.015, u), lerp(-0.01, 0.01, u)], focus: 0.5 }),
    look: () => ({ exp: 1.0, sat: 1.05, shimmer: 0.6, waterY: 0.55 }) },
  { plate: 'coral_spawn', t0: line('L10').start - 0.08, t1: line('L12').start - 0.1,
    cam: (u) => ({ zoom: lerp(1.04, 1.14, ease(u)), pan: [0, lerp(0.02, -0.01, u)], par: [lerp(-0.01, 0.01, u), 0], focus: 0.4 }),
    look: (t) => { const k = sm(T.without11, T.without11 + 1.5, t); return { exp: lerp(1.0, 0.62, k), sat: lerp(1.05, 0.55, k) }; }, overlay: drawSpawn },
  { plate: 'turtles', t0: line('L12').start - 0.1, t1: line('L13').start - 0.35,
    cam: (u) => ({ zoom: lerp(1.0, 1.14, ease(u)), pan: [lerp(0.0, 0.03, u), lerp(0.02, 0.0, u)], par: [lerp(0.02, -0.02, u), lerp(-0.008, 0.008, u)], focus: 0.6 }),
    look: () => ({ exp: 1.05, sat: 1.0, warm: 0.1 }) },
  // dip to black, then deep space
  { plate: 'earth_space', t0: line('L13').start - 0.35, t1: line('L14').start - 0.1,
    cam: (u) => ({ zoom: lerp(2.6, 2.3, u), pan: [-0.33, -0.36], par: [0, 0], rot: lerp(0.0, 0.02, u) }),
    look: () => ({ exp: 1.15, stars: 1, twinkle: 1, skyY: 1.0 }) },
  { plate: 'earth_space', t0: line('L14').start - 0.1, t1: line('L15').start - 0.08, earth: true,
    cam: (u) => ({ zoom: lerp(1.0, 0.9, ease(u)), pan: [0, -0.005], par: [0, 0], rot: lerp(0.02, -0.01, u) }),
    look: () => ({ exp: 1.0, sat: 1.05, stars: 1 }), overlay: drawAxis },
  { plate: 'earth_space', t0: line('L15').start - 0.08, t1: line('L16').start - 0.1, earth: true,
    cam: (u, t) => { const k = sm(T.ice - 1.2, T.ice + 2.2, t); return { zoom: lerp(1.55, 0.88, ease(k)), pan: [lerp(0.04, 0, ease(k)), lerp(-0.13, -0.005, ease(k))], par: [0, 0], rot: lerp(-0.02, 0.01, u) }; },
    look: (t) => ({ exp: 1.0, sat: 1.05, stars: 1, ice: sm(T.ice - 0.6, T.ice + 3.0, t) }), overlay: drawAxis },
  { plate: 'tidepool', t0: line('L16').start - 0.1, t1: line('L17').start - 0.12,
    cam: (u) => ({ zoom: lerp(1.42, 1.55, ease(u)), pan: [lerp(0.08, 0.1, u), lerp(0.2, 0.17, u)], par: [lerp(-0.01, 0.01, u), 0], focus: 0.5 }),
    look: () => ({ exp: 0.92, warm: 0.9, sat: 0.9, con: 1.08, shimmer: 0.5, waterY: 0.55 }) },
  { plate: 'moon_city_nomoon', depth: 'moon_city', t0: line('L17').start - 0.12, t1: line('L17b').start - 0.25,
    cam: (u) => ({ zoom: lerp(1.08, 1.0, ease(u)), pan: [0, lerp(-0.02, 0.0, u)], par: [lerp(-0.004, 0.004, u), 0], focus: 0.2 }),
    look: () => ({ exp: 0.62, keep: 0.85, shimmer: 1, waterY: 0.565, twinkle: 0.8, skyY: 0.5 }) },
  { plate: 'earth_space', t0: line('L17b').start - 0.25, t1: T.end, earth: true,
    cam: (u, t) => { const k = clamp((t - (line('L17b').start - 0.25)) / 4.6); return { zoom: lerp(1.05, 0.26, ease(k)), pan: [0, lerp(-0.01, 0.04, k)], par: [0, 0], rot: lerp(0.0, 0.06, k) }; },
    look: () => ({ exp: 1.0, sat: 1.05, stars: 1.2, twinkle: 0.6, skyY: 1.0 }) },
];
const FADES = [
  [line('L13').start - 0.75, line('L13').start - 0.35, line('L13').start - 0.25, line('L13').start + 0.15],  // dip to black
  [T.end - 1.3, T.end - 0.15, 1e9, 1e9],
];
const CALLOUTS = [
  { t0: wordAt('100', line('L4').start)?.s ?? 9.9, t1: line('L5').start - 0.15, big: '100×', lab: 'brighter under a full moon', y: 560 },
  { t0: wordAt('less', line('L8').start).s, t1: line('L9').start - 0.12, big: '&lt;½', lab: 'the tides', y: 560 },
  { t0: wordAt('23', line('L14').start)?.s ?? line('L14').start + 2, t1: line('L15').start - 0.15, big: '23.4°', lab: "earth's tilt", y: 170 },
];
const HOT = new Set(['moon', 'disappeared', 'gone', 'dark', '100', 'hundred', 'brighter', 'night', 'ocean', 'tides', 'half', 'sun', 'crabs', 'mussels', 'stars', 'strip', 'clock', 'timing',
  'turtles', 'city', 'lights', 'strangest', 'tilt', 'seasons', 'wobble', 'ice', 'ages', 'land', 'fish', 'spinning', 'never', 'same', 'planet', 'explosion', 'sound']);

// ---------------------------------------------------------------- captions
const chunks = [];
{
  const ws = words.map((w) => ({ ...w }));
  // the hook question is one caption
  const qEnd = ws.findIndex((w) => w.w.includes('?'));
  chunks.push({ words: ws.slice(0, qEnd + 1), s: 0.0 });
  let cur = [];
  for (let i = qEnd + 1; i < ws.length; i++) {
    const w = ws[i];
    cur.push(w);
    const text = cur.map((x) => x.w).join(' ');
    const punct = /[.,?!…]$/.test(w.w);
    const next = ws[i + 1];
    const gap = next ? next.s - w.e : 9;
    const weak = /^(the|a|an|is|of|to|in|by|than|and|as|on|for|its|their|that|it's|would|could|you'd|about|every|only|first)$/i.test(w.w.replace(/[^a-z']/gi, ''));
    const full = cur.length >= 4 || text.length >= 18;
    if (punct || gap > 0.35 || (full && !weak) || cur.length >= 5) { chunks.push({ words: cur, s: cur[0].s - 0.04 }); cur = []; }
  }
  if (cur.length) chunks.push({ words: cur, s: cur[0].s - 0.04 });
  chunks.forEach((c, i) => {
    const last = c.words[c.words.length - 1];
    const next = chunks[i + 1];
    c.e = next && next.s - last.e < 0.5 ? next.s : last.e + 0.3;
  });
}
const capEl = $('#cap');
let capKey = '';
function captions(t) {
  const c = chunks.find((k) => t >= k.s && t < k.e);
  if (!c) { if (capKey) { capEl.innerHTML = ''; capKey = ''; } return; }
  const key = c.s.toFixed(3);
  if (key !== capKey) {
    capEl.innerHTML = c.words.map((w) => {
      const clean = w.w.toLowerCase().replace(/[^a-z0-9]/g, '');
      const txt = w.w.replace(/[.,!…]+$/, '').replace(/^\.+/, '');
      return `<span class="${HOT.has(clean) ? 'hot' : ''}">${txt}</span>`;
    }).join('');
    capKey = key;
  }
  const spans = capEl.children;
  c.words.forEach((w, i) => {
    const age = t - w.s;
    const pop = age < 0 ? 1.0 : age < 0.08 ? lerp(1.0, 1.08, age / 0.08) : age < 0.2 ? lerp(1.08, 1.0, (age - 0.08) / 0.12) : 1.0;
    spans[i].style.transform = `scale(${pop.toFixed(3)})`;
  });
  const appear = clamp((t - c.s) / 0.08);
  capEl.style.opacity = appear.toFixed(3);
}

const callEl = $('#call'), callBig = $('#call .big'), callLab = $('#call .lab');
function callouts(t) {
  const c = CALLOUTS.find((k) => t >= k.t0 && t < k.t1);
  if (!c) { callEl.style.opacity = 0; return; }
  if (callBig.innerHTML !== c.big) { callBig.innerHTML = c.big; callLab.textContent = c.lab; }
  const a = sm(c.t0, c.t0 + 0.18, t) * (1 - sm(c.t1 - 0.25, c.t1, t));
  const sc = lerp(0.82, 1.0, ease(sm(c.t0, c.t0 + 0.25, t))) + (t - c.t0) * 0.012;
  callEl.style.top = c.y + 'px';
  callEl.style.opacity = a.toFixed(3);
  callEl.style.transform = `scale(${sc.toFixed(3)})`;
}

// ---------------------------------------------------------------- WebGL
const gl = $('#gl').getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
const VS = `#version 300 es
in vec2 aPos; out vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uImg, uDepth, uAlt;
uniform vec2 uRes, uPan, uPar;
uniform float uZoom, uRot, uFocus, uAlt_, uExp, uSat, uCon, uWarm, uKeep, uShimmer, uWaterY, uTwinkle, uSkyY, uTime, uStars, uVig, uGrain, uIce, uFrame, uEarthOnly;
uniform vec3 uEarth;
in vec2 vUv; out vec4 o;
float h12(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }
vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
void main(){
  vec2 s = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 c = s - 0.5*uRes;
  float cr = cos(-uRot), sr = sin(-uRot);
  c = vec2(c.x*cr - c.y*sr, c.x*sr + c.y*cr);
  vec2 p = c / uZoom + 0.5*uRes + uPan*uRes;
  vec2 uv = p / uRes;
  float d = texture(uDepth, clamp(uv, 0.0, 1.0)).r;
  uv += (d - uFocus) * uPar;
  if (uShimmer > 0.0 && uv.y > uWaterY) {
    float k = (uv.y - uWaterY) / (1.0 - uWaterY);
    uv.x += sin(uv.y*1100.0 - uTime*2.4 + sin(uv.x*35.0 + uTime*0.7)*1.8) * 0.0007 * uShimmer * (0.3 + k);
    uv.y += sin(uv.x*260.0 + uTime*1.3) * 0.00025 * uShimmer;
  }
  bool outside = uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0;
  float disc = 1.0;
  if (uEarthOnly > 0.0) {
    float er = length(uv*uRes - uEarth.xy) / uEarth.z;
    disc = smoothstep(1.06, 1.0, er);
    if (er > 1.06) outside = true;
  }
  vec3 src = outside ? vec3(0.0) : texture(uImg, uv).rgb * disc;
  if (!outside && uAlt_ > 0.0) src = mix(src, texture(uAlt, uv).rgb, uAlt_);
  vec3 col = toLin(src);
  // polar ice spreading on the Earth plate
  if (uIce > 0.0 && !outside) {
    vec2 ep = (uv*uRes - uEarth.xy) / uEarth.z;
    float r = length(ep);
    if (r < 1.0) {
      float n = vn(ep*6.0)*0.14 + vn(ep*17.0)*0.07 + vn(ep*45.0)*0.03;
      // ice sheets spread much further in the north (to ~45 deg) than in the south
      float line = 1.0 - uIce * (ep.y < 0.0 ? 0.36 : 0.16);
      float m = smoothstep(line - 0.06, line + 0.08, abs(ep.y) + n - 0.07) * smoothstep(0.985, 0.94, r);
      // keep the planet's own shading and cloud texture under the ice
      float detail = dot(src, vec3(0.299, 0.587, 0.114));
      float lit = clamp(0.3 + 0.8*(sqrt(max(0.0, 1.0 - r*r))*0.8 - ep.x*0.3), 0.0, 1.0);
      vec3 ice = vec3(0.80, 0.88, 0.97) * mix(0.2, 0.9, lit) * (0.82 + 0.35*detail);
      col = mix(col, ice, m*0.78);
    }
  }
  // grading: exposure, keep bright lights when darkening
  float lum0 = dot(src, vec3(0.299, 0.587, 0.114));
  vec3 graded = col * uExp;
  float lights = smoothstep(0.55, 0.85, lum0);
  graded = mix(graded, col * max(uExp, 0.75), lights * uKeep);
  graded *= vec3(1.0 + 0.07*uWarm, 1.0 + 0.01*uWarm, 1.0 - 0.09*uWarm);
  float l = dot(graded, vec3(0.2126, 0.7152, 0.0722));
  graded = mix(vec3(l), graded, uSat);
  vec3 g = toSrgb(graded);
  g = (g - 0.5) * uCon + 0.5;
  // stars: twinkle in the sky, and a star field beyond the plate edges when pulling back
  if (uTwinkle > 0.0 && !outside && uv.y < uSkyY && lum0 > 0.3) g *= 1.0 + uTwinkle*0.3*sin(uTime*5.0 + h12(floor(uv*uRes))*40.0);
  if (uStars > 0.0 && (outside || disc < 0.5)) {
    vec2 gp = floor(s / 3.0);
    float h = h12(gp);
    float st = step(0.9965, h) * (0.35 + 0.65*h12(gp + 7.1));
    st *= 0.8 + 0.2*sin(uTime*3.0 + h*60.0);
    g += vec3(0.85, 0.9, 1.0) * st * uStars;
  }
  float vg = smoothstep(0.42, 0.98, length((vUv - 0.5) * vec2(1.0, 1.25)));
  g *= 1.0 - uVig * vg;
  g += (h12(s + uFrame*17.13) - 0.5) * uGrain;
  o = vec4(clamp(g, 0.0, 1.0), 1.0);
}`;
function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
const U = {}; for (const n of ['uEarthOnly', 'uImg', 'uDepth', 'uAlt', 'uRes', 'uPan', 'uPar', 'uZoom', 'uRot', 'uFocus', 'uAlt_', 'uExp', 'uSat', 'uCon', 'uWarm', 'uKeep', 'uShimmer', 'uWaterY', 'uTwinkle', 'uSkyY', 'uTime', 'uStars', 'uVig', 'uGrain', 'uIce', 'uFrame', 'uEarth']) U[n] = gl.getUniformLocation(prog, n);

async function loadTex(url) {
  const img = new Image(); img.src = url; await img.decode();
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
const tex = {};
for (const s of shots) {
  for (const name of [s.plate, s.alt].filter(Boolean)) if (!tex[name]) tex[name] = await loadTex(`/moon/plates/${name}.jpg`);
  const dn = (s.depth || s.plate) + '_depth';
  if (!tex[dn]) tex[dn] = await loadTex(`/moon/plates/${dn}.png`);
}
await document.fonts.load('800 76px Mont'); await document.fonts.load('900 230px Mont');

// ---------------------------------------------------------------- 2D overlays
const fx = $('#fx').getContext('2d');
function earthToScreen(px, py, cam) {
  const zx = (px - W / 2 - cam.pan[0] * W) * cam.zoom, zy = (py - H / 2 - cam.pan[1] * H) * cam.zoom;
  const r = cam.rot || 0;
  return [zx * Math.cos(r) - zy * Math.sin(r) + W / 2, zx * Math.sin(r) + zy * Math.cos(r) + H / 2];
}
function drawBulge(t, u, cam) {
  const [cx, cy] = earthToScreen(EARTH.x, EARTH.y, cam);
  const R = EARTH.r * cam.zoom;
  const a = sm(line('L7').start + 0.2, line('L7').start + 0.9, t);
  const k = 1 - sm(T.without7, T.without7 + 1.3, t) * 0.54;   // Sun-only tides: ~46% of the Moon's
  const stretch = 0.2 * k;
  fx.save();
  fx.translate(cx, cy); fx.rotate(cam.rot || 0);
  fx.globalAlpha = a;
  fx.beginPath(); fx.ellipse(0, 0, R * (1.02 + stretch), R * (1.02 - stretch * 0.25), 0, 0, Math.PI * 2);
  fx.fillStyle = 'rgba(80,190,255,0.13)'; fx.fill();
  fx.lineWidth = 5; fx.strokeStyle = 'rgba(140,215,255,0.9)'; fx.shadowColor = 'rgba(80,190,255,0.9)'; fx.shadowBlur = 24; fx.stroke();
  // label
  fx.shadowBlur = 0; fx.globalAlpha = a;
  fx.font = '800 38px Mont'; fx.textAlign = 'center'; fx.fillStyle = '#bfe8ff';
  fx.fillText(k > 0.7 ? 'TIDAL BULGE' : 'SUN-ONLY TIDES', 0, -R * (1.02 - stretch * 0.25) - 34);
  fx.restore();
}
function drawAxis(t, u, cam) {
  const [cx, cy] = earthToScreen(EARTH.x, EARTH.y, cam);
  const R = EARTH.r * cam.zoom;
  const a = sm(line('L14').start + 0.1, line('L14').start + 0.8, t);
  const amp = sm(T.wobble - 0.2, T.wobble + 1.2, t) * 9 * (1 - 0.5 * sm(T.ice, T.ice + 2, t));
  const ang = (23.4 + amp * Math.sin((t - T.wobble) * 2.6)) * Math.PI / 180;
  const L = R * 1.32;
  fx.save();
  fx.translate(cx, cy); fx.rotate(cam.rot || 0);
  fx.globalAlpha = a * 0.55;
  fx.setLineDash([18, 16]); fx.lineWidth = 4; fx.strokeStyle = '#ffffff';
  fx.beginPath(); fx.moveTo(0, -L); fx.lineTo(0, L); fx.stroke();
  fx.globalAlpha = a;
  fx.setLineDash([]); fx.lineWidth = 7; fx.strokeStyle = '#ffd84a'; fx.shadowColor = 'rgba(255,200,60,0.8)'; fx.shadowBlur = 18;
  fx.beginPath(); fx.moveTo(-Math.sin(ang) * L, Math.cos(ang) * L); fx.lineTo(Math.sin(ang) * L, -Math.cos(ang) * L); fx.stroke();
  fx.shadowBlur = 0; fx.lineWidth = 5;
  fx.beginPath(); fx.arc(0, 0, R * 1.18, -Math.PI / 2, -Math.PI / 2 + ang); fx.stroke();
  fx.restore();
}
const spawn = (() => {
  const r = mulberry(77), ps = [];
  for (let i = 0; i < 420; i++) ps.push({ x: 120 + r() * 840, y0: r() * 2200, v: 40 + r() * 90, s: 2 + Math.pow(r(), 2) * 7, ph: r() * 6.28, pink: r() < 0.7, z: 0.5 + r() * 0.5 });
  return ps;
})();
function drawSpawn(t, u) {
  const t0 = line('L10').start;
  const stop = sm(T.without11, T.without11 + 1.6, t);
  fx.save();
  for (const p of spawn) {
    // rising bundles; once the timing is lost they hang and fade
    const travel = (Math.min(t, T.without11) - t0) * p.v + Math.max(0, t - T.without11) * p.v * (1 - stop) * 0.5;
    let y = ((p.y0 - travel) % 2200 + 2200) % 2200 - 140;
    const x = p.x + Math.sin(t * 0.8 + p.ph) * 14 * p.z;
    const al = (0.55 + 0.45 * Math.sin(t * 2 + p.ph)) * (1 - stop * 0.85) * sm(t0 - 0.1, t0 + 0.6, t);
    const g = fx.createRadialGradient(x, y, 0, x, y, p.s * 2.2);
    const c = p.pink ? '255,170,195' : '255,240,235';
    g.addColorStop(0, `rgba(${c},${al.toFixed(3)})`); g.addColorStop(1, `rgba(${c},0)`);
    fx.fillStyle = g; fx.beginPath(); fx.arc(x, y, p.s * 2.2, 0, Math.PI * 2); fx.fill();
  }
  fx.restore();
}

// ---------------------------------------------------------------- frame
function frame(f) {
  const t = f / FPS;
  const s = shots.find((k) => t >= k.t0 && t < k.t1) || shots[shots.length - 1];
  const u = clamp((t - s.t0) / (s.t1 - s.t0));
  const cam = Object.assign({ zoom: 1, pan: [0, 0], par: [0, 0], rot: 0, focus: 0.3 }, s.cam(u, t));
  const L = Object.assign({ alt: 0, exp: 1, sat: 1, con: 1.03, warm: 0, keep: 0, shimmer: 0, waterY: 2, twinkle: 0, skyY: 0, stars: 0, vig: 0.38, ice: 0 }, s.look(t, u));
  gl.viewport(0, 0, W, H);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[s.plate]); gl.uniform1i(U.uImg, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex[(s.depth || s.plate) + '_depth']); gl.uniform1i(U.uDepth, 1);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tex[s.alt || s.plate]); gl.uniform1i(U.uAlt, 2);
  gl.uniform2f(U.uRes, W, H); gl.uniform2f(U.uPan, cam.pan[0], cam.pan[1]); gl.uniform2f(U.uPar, cam.par[0], cam.par[1]);
  gl.uniform1f(U.uZoom, cam.zoom); gl.uniform1f(U.uRot, cam.rot || 0); gl.uniform1f(U.uFocus, cam.focus);
  gl.uniform1f(U.uAlt_, L.alt); gl.uniform1f(U.uExp, L.exp); gl.uniform1f(U.uSat, L.sat); gl.uniform1f(U.uCon, L.con); gl.uniform1f(U.uWarm, L.warm);
  gl.uniform1f(U.uKeep, L.keep); gl.uniform1f(U.uShimmer, L.shimmer); gl.uniform1f(U.uWaterY, L.waterY); gl.uniform1f(U.uTwinkle, L.twinkle); gl.uniform1f(U.uSkyY, L.skyY);
  gl.uniform1f(U.uTime, t); gl.uniform1f(U.uStars, L.stars); gl.uniform1f(U.uVig, L.vig); gl.uniform1f(U.uGrain, 0.035); gl.uniform1f(U.uIce, L.ice); gl.uniform1f(U.uFrame, f);
  gl.uniform3f(U.uEarth, EARTH.x, EARTH.y, EARTH.r);
  gl.uniform1f(U.uEarthOnly, s.earth ? 1 : 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  fx.clearRect(0, 0, W, H);
  if (s.overlay) s.overlay(t, u, cam);
  captions(t);
  callouts(t);
  let fade = 0;
  for (const [a, b, c, d] of FADES) fade = Math.max(fade, sm(a, b, t) * (1 - sm(c, d, t)));
  $('#fade').style.opacity = fade.toFixed(3);
  return { t, shot: s.plate };
}
window.COMP = { frame, frames: Math.round(T.end * FPS), fps: FPS, duration: T.end, T, chunks: chunks.length };
window.COMP_READY = true;
