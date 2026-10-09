// prints a scenario's timeline: shot starts, narration lines, fold events, with sanity checks (overlaps, short gaps)
// usage: node qa/timeline.mjs paper-fold
import path from 'path';
import { fileURLToPath } from 'url';
const dir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const m = await import(`${dir}/scenarios/${process.argv[2]}.js`);
const D = m._debug, S = m.default;
const f = (x) => x.toFixed(2).padStart(6);
console.log('duration', S.duration.toFixed(2), 'END', S.endAt.toFixed(2), 'HERE', D.HERE.toFixed(2));
console.log('shots:', D.SHOTS.map(([t, id]) => `${id}@${t.toFixed(2)}`).join(' '));
console.log('say  :', Object.entries(D.SAY).map(([k, t]) => `${k}@${t.toFixed(2)}`).join(' '));
let warn = 0;
const ev = D.EV.slice().sort((a, b) => a.t0 - b.t0);
for (let i = 0; i < ev.length; i++) {
  const e = ev[i], land = e.t0 + e.d * (e.kind === 'hand' ? 0.8 : 1);
  const prev = ev[i - 1];
  const gap = prev ? e.t0 - (prev.t0 + prev.d) : 9;
  const flag = gap < 0 ? '  <-- OVERLAPS previous' : '';
  if (gap < 0) warn++;
  console.log(`fold ${String(e.k).padStart(3)} ${e.kind.padEnd(4)} t0 ${f(e.t0)} d ${f(e.d)} lands ${f(land)}  shot ${D.shotAt(e.t0)[1]}${e.strain ? ' strain' : ''}${flag}`);
}
console.log('FAIL', D.FAIL);
console.log('GROW', D.GROW.map((g) => `${g.from}->${g.to} ${g.t0.toFixed(2)}..${g.t1.toFixed(2)}`).join(' | '));
console.log(warn ? `${warn} overlap warning(s)` : 'no overlaps');
