// prints a scenario's shot start times (and HERE) as JSON, for qa/spikes.py
// usage: node qa/cuts.mjs paper-fold > cuts.json   (scenarios with a narration-driven timeline block)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const dir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const id = process.argv[2];
const VO = (await import(`${dir}/scenarios/${id}.vo.js`)).default;
const rng = await import(`${dir}/engine/lib/rng.js`);
const src = fs.readFileSync(`${dir}/scenarios/${id}.js`, 'utf8');
const body = src.slice(src.indexOf('const wordT'), src.indexOf('const shotAt')) + '\nreturn { SHOTS, HERE, END };';
const { SHOTS, HERE, END } = new Function('VO', 'Math', ...Object.keys(rng), body)(VO, Math, ...Object.values(rng));
console.log(JSON.stringify({ cuts: SHOTS.map((s) => +s[0].toFixed(3)), ids: SHOTS.map((s) => s[1]), HERE, END }));
