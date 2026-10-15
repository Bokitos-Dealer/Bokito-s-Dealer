// Shared plumbing for the illustrated explainer episodes (ai-smarter.js and later):
// narration timeline, word lookup, captions, CSS, the scene stack with push-in camera, and the scenario object.
import * as I from './ill2d.js';

const { ease, clamp, lerp } = I;
export const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };

// lines in ORDER with GAP seconds of silence before each; W(key, word, nth) = time of a word (proportional fallback)
export function timeline(VO, ORDER, GAP) {
  const SAY = {};
  { let t = 0; for (const k of ORDER) { SAY[k] = t + (GAP[k] ?? 0.3); t = SAY[k] + VO[k].dur; } }
  const toks = (s) => s.toLowerCase().replace(/-/g, ' ').replace(/[^a-z0-9' ]/g, '').split(/\s+/).filter(Boolean).map((w) => w.replace(/'/g, ''));
  const W = (key, word, nth = 0) => {
    let n = 0;
    for (const [w, s] of VO[key].words) if (w.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(word) && n++ === nth) return SAY[key] + s;
    const tk = toks(VO[key].text); let m = 0;
    for (let i = 0; i < tk.length; i++) if (tk[i].startsWith(word) && m++ === nth) return SAY[key] + VO[key].dur * i / tk.length;
    throw new Error(`no "${word}" in ${key}`);
  };
  const endOf = (k) => SAY[k] + VO[k].dur;
  const last = ORDER[ORDER.length - 1], FADE = [endOf(last) + 0.6, endOf(last) + 1.2];
  return { SAY, W, endOf, FADE, DURATION: FADE[1] + 0.2 };
}

// two or three words per caption, keywords in yellow, spoken numbers shown as figures (NUMS: [said, shown])
export function captions(VO, ORDER, SAY, NUMS, KEYWORDS) {
  const out = [];
  for (const key of ORDER) {
    const at = SAY[key];
    const ws = [];
    for (const [w, s, e] of VO[key].words) { if (/^[–—-]+$/.test(w)) continue; if (ws.length && /^([-'%]|[.,]\d)/.test(w)) { const p = ws[ws.length - 1]; p[0] += w; p[2] = e; } else ws.push([w, s, e, false]); }
    for (const [sayd, show] of NUMS) {
      const k = sayd.replace(/-/g, ' ').split(' ');
      for (let i = 0; i + k.length <= ws.length; i++) {
        if (k.every((x, j) => ws[i + j][0].toLowerCase().replace(/[^a-z0-9]/g, '') === x.replace(/[^a-z0-9]/g, ''))) {
          const p = ws[i + k.length - 1][0].match(/[,.?!…]+$/)?.[0] ?? '';
          ws.splice(i, k.length, [show + p, ws[i][1], ws[i + k.length - 1][2], true]);
        }
      }
    }
    for (const w of ws) if (!w[3] && KEYWORDS.test(w[0].replace(/[^A-Za-z]/g, ''))) w[3] = true;
    const clauses = [[]];
    ws.forEach((w, i) => { clauses[clauses.length - 1].push(w); if (/[,.?!…:]$/.test(w[0]) && i < ws.length - 1) clauses.push([]); });
    const chunks = [];
    for (const c of clauses) { if (!c.length) continue; const n = Math.ceil(c.length / 3), per = Math.ceil(c.length / n); for (let i = 0; i < c.length; i += per) chunks.push(c.slice(i, i + per)); }
    chunks.forEach((c, i) => {
      const next = chunks[i + 1];
      out.push([at + c[0][1] - 0.04, at + (next ? Math.min(next[0][1], c[c.length - 1][2] + 0.45) : c[c.length - 1][2] + 0.35), c.map((x) => x[0]).join(' '), c.map((x) => [x[0].replace(/\.\.\.$/, '…'), at + x[1], x[3]])]);
    });
  }
  out.sort((x, y) => x[0] - y[0]);
  for (let i = 0; i < out.length - 1; i++) out[i][1] = Math.min(out[i][1], out[i + 1][0] - 0.01);
  return out;
}

const OUTLINE = [[6, 0], [-6, 0], [0, 6], [0, -6], [4.5, 4.5], [-4.5, 4.5], [4.5, -4.5], [-4.5, -4.5]].map(([x, y]) => `${x}px ${y}px 0 #000`).join(', ');
export const css = (a = '#ff6b6b', b = '#ffb347') => `@font-face { font-family: 'MontB'; font-weight: 900; src: url(/node_modules/@fontsource/montserrat/files/montserrat-latin-900-normal.woff2) format('woff2'); }
#title, #hud { display: none !important; }
#ill { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }
#caption { top: 1390px; left: 30px; right: 30px; }
#caption::before { display: none; }
#caption span { font-family: 'MontB', sans-serif; font-style: normal; font-weight: 900; font-size: 96px; line-height: 1.04; letter-spacing: -1px; text-transform: uppercase; color: #fff; text-shadow: ${OUTLINE}, 0 12px 26px rgba(0,0,0,0.55); }
#caption .cw { color: #ffffff; } #caption .cw.hl { color: #ffd84a; font-style: normal; }
#goal .fill { background: linear-gradient(90deg, ${a}, ${b}); } #goal .dot { box-shadow: 0 0 16px ${b}, 0 0 0 4px ${a}; }
#goal .tick.on { background: ${b}; box-shadow: 0 0 10px ${b}, 0 0 0 2px rgba(0,0,0,0.25); }`;

// piecewise-linear value over time from [[t, v], ...]
export const keyed = (keys) => (t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) { const [t0, a] = keys[i], [t1, b] = keys[i + 1]; if (t <= t1) return lerp(a, b, (t - t0) / (t1 - t0)); }
  return keys[keys.length - 1][1];
};

// the scene stack: every new picture lands with a push-in and keeps drifting
export function stack() {
  const S = [];
  const at = (t0, draw) => S.push([t0, draw]);
  const frame = (t) => {
    S.sort((a, b) => a[0] - b[0]);
    let i = 0; for (let j = 0; j < S.length; j++) if (t >= S[j][0]) i = j;
    const [t0, draw] = S[i], u = Math.max(0, t - t0);
    const z = (1 + 0.06 * (1 - ease.out(u / 0.3))) * (1 + 0.012 * u), px = (i % 2 ? 1 : -1) * 5 * u;
    return `<g transform="translate(${540 + px} 960) scale(${z}) translate(-540 -960)">${draw(t, u)}</g>${I.vignette()}`;
  };
  const svgAt = (t) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">${I.DEFS}${frame(t)}</svg>`;
  return { S, at, frame, svgAt, cuts: () => S.slice().sort((a, b) => a[0] - b[0]).map((s) => s[0]) };
}

// the sound skeleton every episode shares: voice lines, ducking keys, whooshes into each picture, chapter stamps
export function audioBase(VO, ORDER, SAY, DURATION, cuts, stamps) {
  const A = [], fx = (type, o) => A.push(Object.assign({ type, fx: true }, o));
  const S_ = (file, t, o = {}) => Object.assign({ type: 'sample', file, t }, o);
  const keysEvery = (f, step = 0.05) => { const ks = []; for (let t = 0; t <= DURATION; t += step) ks.push([+t.toFixed(2), +f(t).toFixed(3)]); return ks; };
  for (const key of ORDER) A.push(S_(VO[key].file, SAY[key], { level: 1.35, free: true, verb: 0.02, fin: 0.005, fout: 0.03 }));
  const talking = (t) => { let q = 0; for (const key of ORDER) { const a = SAY[key]; q = Math.max(q, smooth(a - 0.3, a - 0.05, t) * (1 - smooth(a + VO[key].dur, a + VO[key].dur + 0.35, t))); } return q; };
  A.push({ type: 'fxduck', keys: keysEvery((t) => 1 - 0.45 * talking(t), 0.04) });
  const music = (file, t, dur, o = {}) => A.push(S_(file, t, Object.assign({ level: 0.5, fin: 0.3, fout: 1.2, dur, keys: keysEvery((x) => 1 - 0.67 * talking(x)) }, o)));
  cuts.forEach((c, i) => { if (i) fx('sample', { file: i % 2 ? 'sfx/2605.wav' : 'sfx/1490.wav', t: c - 0.12, level: 0.11, pan: -0.3 + 0.6 * I.hash(i, 3) }); });
  stamps.forEach((t0, i) => { fx('sample', { file: 'sfx/2604.wav', t: t0 - 0.2, level: i ? 0.14 : 0.25 }); A.push({ type: 'subdrop', t: t0 + 0.04, dur: 0.7, level: i ? 0.25 : 0.38, free: true }); });
  return { A, fx, S_, music };
}

export function scenario({ id, title, DURATION, FADE, CSS, caps, audio, goal, svgFrame }) {
  return {
    id, title, duration: DURATION, css: CSS, fadeOut: FADE, endAt: 1e9, captions: caps, captionFade: 0.08, audio, goal,
    hud: () => null,
    labels: () => [],
    async setup(ctx) {
      ctx.grain = 0.025; ctx.vignette = 0; ctx.handheld = 0;
      ctx.grade = { brightness: 1.0, contrast: 1.0, saturate: 1.0, sepia: 0 };
      const s = document.createElement('style'); s.textContent = this.css; document.head.appendChild(s);
      const ui = document.getElementById('ui');
      this.el = document.createElement('div'); this.el.id = 'ill';
      ui.insertBefore(this.el, ui.firstChild);
    },
    update(ctx, t) {
      this.el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">${I.DEFS}${svgFrame(t)}</svg>`;
    },
  };
}
