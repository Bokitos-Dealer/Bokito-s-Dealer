// A physically based atmosphere (single Rayleigh + Mie scattering through a real-scale shell of air,
// Nishita style), the same model in GLSL (sky, aerial perspective on the planet) and in JS (the colour of
// sunlight and skylight reaching a point, to light the set). Coordinates are planet-centred metres.
export const ATMO = { Re: 6371e3, Ra: 6471e3, bR: [5.8e-6, 13.5e-6, 33.1e-6], bM: 21e-6, Hr: 8000, Hm: 1200, g: 0.76, sun: 22, bO: [0.65e-6, 1.881e-6, 0.085e-6] };
const ozone = (h) => Math.max(0, 1 - Math.abs(h - 25000) / 15000);

export const ATMO_GLSL = `
  const float A_PI = 3.14159265;
  const float A_RE = ${ATMO.Re.toFixed(1)}, A_RA = ${ATMO.Ra.toFixed(1)};
  const vec3 A_BR = vec3(${ATMO.bR.map((x) => x.toExponential(3)).join(', ')});
  const float A_BM = ${ATMO.bM.toExponential(3)}, A_HR = ${ATMO.Hr.toFixed(1)}, A_HM = ${ATMO.Hm.toFixed(1)}, A_G = ${ATMO.g};
  const vec3 A_BO = vec3(${ATMO.bO.map((x) => x.toExponential(3)).join(', ')});
  float aOz(float h){ return max(0.0, 1.0 - abs(h - 25000.0) / 15000.0); }
  vec2 aSphere(vec3 o, vec3 d, float r){ float b = dot(o, d), c = dot(o, o) - r * r, h = b * b - c; if (h < 0.0) return vec2(1e30, -1e30); h = sqrt(h); return vec2(-b - h, -b + h); }
  // optical depth (Rayleigh, Mie) from p toward the sun; x = -1 if the planet is in the way
  vec3 aSunDepth(vec3 p, vec3 s){
    { float gx = aSphere(p, s, A_RE * 0.99995).x; if (gx > 0.0 && gx < 1e29) return vec3(-1.0); }
    float L = aSphere(p, s, A_RA).y, ds = L / 6.0; vec3 od = vec3(0.0);
    for (int j = 0; j < 6; j++) { float hh = length(p + s * ds * (float(j) + 0.5)) - A_RE; od += vec3(exp(-hh / A_HR), exp(-hh / A_HM), aOz(hh)) * ds; }
    return od;
  }
  vec3 aExt(vec3 od){ return A_BR * od.x + A_BM * 1.1 * od.y + A_BO * od.z; }
  // light scattered toward the eye along o + d*t for t in [0, maxT]; trans = how much of what lies behind gets through
  vec3 aScatter(vec3 o, vec3 d, float maxT, vec3 s, out vec3 trans){
    trans = vec3(1.0);
    vec2 a = aSphere(o, d, A_RA);
    float t0 = max(a.x, 0.0), t1 = min(a.y, maxT);
    vec2 gnd = aSphere(o, d, A_RE); if (gnd.x > 0.0) t1 = min(t1, gnd.x);
    if (t1 <= t0) return vec3(0.0);
    float mu = dot(d, s), gg = A_G * A_G;
    float pR = 3.0 / (16.0 * A_PI) * (1.0 + mu * mu);
    float pM = 3.0 / (8.0 * A_PI) * ((1.0 - gg) * (mu * mu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * A_G, 1.5) * (2.0 + gg));
    vec3 sR = vec3(0.0), sM = vec3(0.0); vec3 od = vec3(0.0);
    const int N = 14;
    // samples bunched toward the start (where the air is thickest for an eye near the ground)
    float prev = t0;
    for (int i = 0; i < N; i++) {
      float u = (float(i) + 1.0) / float(N), tt = t0 + (t1 - t0) * u * u, ds = tt - prev, tm = 0.5 * (tt + prev); prev = tt;
      vec3 p = o + d * tm; float hh = max(length(p) - A_RE, 0.0);
      vec3 dd = vec3(exp(-hh / A_HR), exp(-hh / A_HM), aOz(hh)) * ds; od += dd;
      vec3 ls = aSunDepth(p, s);
      if (ls.x < 0.0) continue;
      vec3 att = exp(-aExt(od + ls));
      sR += dd.x * att; sM += dd.y * att;
    }
    trans = exp(-aExt(od));
    return ${ATMO.sun.toFixed(1)} * (pR * A_BR * sR + pM * A_BM * sM);
  }
  // sunlight arriving at p (colour and strength), 0 in the planet's shadow
  vec3 aSunlight(vec3 p, vec3 s){ vec3 ls = aSunDepth(p, s); if (ls.x < 0.0) return vec3(0.0); return exp(-aExt(ls)); }
`;

// ---- the same in JS (fewer samples), for lighting the set
const sphere = (o, d, r) => { const b = o[0] * d[0] + o[1] * d[1] + o[2] * d[2], c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - r * r, h = b * b - c; if (h < 0) return [1e30, -1e30]; const s = Math.sqrt(h); return [-b - s, -b + s]; };
export function sunDepth(p, s, steps = 24) {
  { const gx = sphere(p, s, ATMO.Re * 0.99995)[0]; if (gx > 0 && gx < 1e29) return null; }
  const L = sphere(p, s, ATMO.Ra)[1], ds = L / steps; let r = 0, m = 0, o = 0;
  for (let j = 0; j < steps; j++) { const t = ds * (j + 0.5), h = Math.hypot(p[0] + s[0] * t, p[1] + s[1] * t, p[2] + s[2] * t) - ATMO.Re; r += Math.exp(-h / ATMO.Hr) * ds; m += Math.exp(-h / ATMO.Hm) * ds; o += ozone(h) * ds; }
  return [r, m, o];
}
// sunlight colour reaching an altitude (linear RGB, 1 = above the air), with the sun's disc setting smoothly
export function sunlightAt(alt, s) {
  const p = [0, ATMO.Re + alt, 0];
  // the disc is half a degree across: average a few points over it so the light fades as it sets
  let acc = [0, 0, 0];
  const offs = [-0.0035, -0.0012, 0.0012, 0.0035];
  for (const o of offs) {
    const d = [s[0], s[1] + o, s[2]], n = Math.hypot(...d); d[0] /= n; d[1] /= n; d[2] /= n;
    const od = sunDepth(p, d);
    if (!od) continue;
    for (let k = 0; k < 3; k++) acc[k] += Math.exp(-(ATMO.bR[k] * od[0] + ATMO.bM * 1.1 * od[1] + ATMO.bO[k] * od[2])) / offs.length;
  }
  return acc;
}
// skylight: the light scattered toward a point from direction d (linear RGB), coarse
export function skyAt(alt, d, s, steps = 10) {
  const o = [0, ATMO.Re + alt, 0];
  const a = sphere(o, d, ATMO.Ra), g = sphere(o, d, ATMO.Re);
  let t0 = Math.max(a[0], 0), t1 = a[1]; if (g[0] > 0) t1 = Math.min(t1, g[0]);
  if (t1 <= t0) return [0, 0, 0];
  const mu = d[0] * s[0] + d[1] * s[1] + d[2] * s[2], gg = ATMO.g * ATMO.g;
  const pR = 3 / (16 * Math.PI) * (1 + mu * mu), pM = 3 / (8 * Math.PI) * ((1 - gg) * (mu * mu + 1)) / (Math.pow(1 + gg - 2 * mu * ATMO.g, 1.5) * (2 + gg));
  const sR = [0, 0, 0], sM = [0, 0, 0]; let odR = 0, odM = 0, odO = 0, prev = t0;
  for (let i = 0; i < steps; i++) {
    const u = (i + 1) / steps, tt = t0 + (t1 - t0) * u * u, ds = tt - prev, tm = 0.5 * (tt + prev); prev = tt;
    const p = [o[0] + d[0] * tm, o[1] + d[1] * tm, o[2] + d[2] * tm], h = Math.max(Math.hypot(...p) - ATMO.Re, 0);
    const dR = Math.exp(-h / ATMO.Hr) * ds, dM = Math.exp(-h / ATMO.Hm) * ds; odR += dR; odM += dM; odO += ozone(h) * ds;
    const ls = sunDepth(p, s, 8); if (!ls) continue;
    for (let k = 0; k < 3; k++) { const att = Math.exp(-(ATMO.bR[k] * (odR + ls[0]) + ATMO.bM * 1.1 * (odM + ls[1]) + ATMO.bO[k] * (odO + ls[2]))); sR[k] += dR * att; sM[k] += dM * att; }
  }
  return [0, 1, 2].map((k) => ATMO.sun * (pR * ATMO.bR[k] * sR[k] + pM * ATMO.bM * sM[k]));
}
