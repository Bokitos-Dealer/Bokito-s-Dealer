// Usage:
//   node render.mjs <scenario> --preview 2,10,30      still frames + contact sheet
//   node render.mjs <scenario> [--from 0] [--to 80]   render frames to output/<id>/frames
//   node render.mjs <scenario> --encode               synth audio + encode output/<id>.mp4
// Options: --scale 0.75 (3D resolution vs 1080x1920), --workers 2
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawnSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const id = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
if (!id) { console.log('usage: node render.mjs <scenario> [--preview t,t] [--from s] [--to s] [--encode]'); process.exit(1); }
const OUT = path.join(ROOT, 'output', id);
fs.mkdirSync(OUT, { recursive: true });
const scale = opt('scale', '0.75');
const layer = opt('layer', 'all');                    // all | scene | text
const FRAMES = layer === 'text' ? 'frames-text' : 'frames';
const EXT = layer === 'text' ? 'png' : 'jpg';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((q, r) => {
      const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
      if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
      fs.readFile(p, (e, d) => {
        if (e) { r.writeHead(404); r.end(); return; }
        r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d);
      });
    }).listen(0, () => res(srv));
  });
}

async function openPage(srv) {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { const t = m.text(); if (!t.includes('GL Driver') && !t.includes('GPU stall')) console.log('[page]', t); });
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  await page.goto(`http://localhost:${srv.address().port}/engine/index.html?scale=${scale}&layer=${layer}`);
  await page.waitForFunction('window.WI_READY === true');
  const info = await page.evaluate((id) => window.WI.init(id), id);
  return { browser, page, info };
}

const shot = (page, file) => file.endsWith('.png')
  ? page.screenshot({ path: file, type: 'png', omitBackground: true, timeout: 300000, clip: { x: 0, y: 0, width: 1080, height: 1920 } })
  : page.screenshot({ path: file, type: 'jpeg', quality: 94, timeout: 300000, clip: { x: 0, y: 0, width: 1080, height: 1920 } });

async function preview(times) {
  const srv = await serve();
  const { browser, page, info } = await openPage(srv);
  const dir = path.join(OUT, 'preview');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const frames = times.map((t) => Math.round(t * info.fps)).sort((a, b) => a - b);
  const files = [];
  for (const f of frames) {
    const t0 = Date.now();
    await page.evaluate((f) => window.WI.goto(f), f);
    const file = path.join(dir, `f${String(f).padStart(5, '0')}.jpg`);
    await shot(page, file);
    files.push(file);
    console.log(`frame ${f} (${(f / info.fps).toFixed(1)}s) ${Date.now() - t0}ms`);
  }
  await browser.close(); srv.close();
  // contact sheet
  const cols = Math.min(files.length, 5);
  const inputs = files.flatMap((f) => ['-i', f]);
  const pad = Array.from({ length: (cols - (files.length % cols)) % cols }, () => files[files.length - 1]);
  const all = [...inputs, ...pad.flatMap((f) => ['-i', f])];
  const n = files.length + pad.length;
  const scaleF = Array.from({ length: n }, (_, i) => `[${i}:v]scale=324:576[s${i}]`).join(';');
  const rows = n / cols;
  let fc = scaleF + ';';
  for (let r = 0; r < rows; r++) fc += Array.from({ length: cols }, (_, c) => `[s${r * cols + c}]`).join('') + (cols > 1 ? `hstack=${cols}` : 'null') + `[r${r}];`;
  fc += Array.from({ length: rows }, (_, r) => `[r${r}]`).join('') + (rows > 1 ? `vstack=${rows}` : 'null') + '[out]';
  spawnSync('ffmpeg', ['-v', 'error', '-y', ...all, '-filter_complex', fc, '-map', '[out]', '-frames:v', '1', path.join(dir, 'sheet.jpg')], { stdio: 'inherit' });
  console.log('sheet:', path.join(dir, 'sheet.jpg'));
}

async function renderRange(from, to) {
  const srv = await serve();
  const { browser, page, info } = await openPage(srv);
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(info, null, 2));
  const dir = path.join(OUT, FRAMES);
  fs.mkdirSync(dir, { recursive: true });
  const f0 = Math.round(from * info.fps), f1 = Math.min(info.frames - 1, Math.round(to * info.fps));
  if (f0 > 0) await page.evaluate((f) => window.WI.goto(f, false), f0 - 1);
  const t0 = Date.now();
  const resume = !!opt('resume');
  for (let f = f0; f <= f1; f++) {
    const file = path.join(dir, `${String(f).padStart(5, '0')}.${EXT}`);
    if (resume && fs.existsSync(file) && fs.statSync(file).size > (EXT === 'png' ? 1000 : 10000)) { await page.evaluate((f) => window.WI.goto(f, false), f); continue; }
    await page.evaluate((f) => window.WI.goto(f), f);
    await shot(page, file);
    if ((f - f0) % 60 === 0 || f === f1) {
      const done = f - f0 + 1, el = (Date.now() - t0) / 1000;
      console.log(`[${id} ${from}-${to}] frame ${f}/${f1}  ${(el / done).toFixed(2)}s/frame  eta ${((f1 - f) * el / done / 60).toFixed(1)} min`);
    }
  }
  await browser.close(); srv.close();
}

async function meta() {
  const srv = await serve();
  const { browser, info } = await openPage(srv);
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(info, null, 2));
  await browser.close(); srv.close();
  return info;
}

function encode(info) {
  const wav = path.join(OUT, 'audio.wav');
  const r = spawnSync('python3', ['-I', path.join(ROOT, 'audio', 'synth.py'), path.join(OUT, 'meta.json'), wav], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('audio synth failed');
  const mp4 = path.join(ROOT, 'output', `${id}.mp4`);
  const textDir = path.join(OUT, 'frames-text');
  const withText = fs.existsSync(textDir) && fs.readdirSync(textDir).length >= info.frames;
  const vin = ['-framerate', String(info.fps), '-i', path.join(OUT, 'frames', '%05d.jpg')];
  if (withText) vin.push('-framerate', String(info.fps), '-i', path.join(textDir, '%05d.png'));
  const vfx = withText ? ['-filter_complex', '[0:v][1:v]overlay=format=auto[v]', '-map', '[v]', '-map', '2:a'] : [];
  console.log(withText ? 'compositing the text layer' : 'single layer');
  const e = spawnSync('ffmpeg', ['-v', 'error', '-y', ...vin, '-i', wav, ...vfx,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(info.fps),
    '-af', 'loudnorm=I=-14:TP=-1.2:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', mp4], { stdio: 'inherit' });
  if (e.status !== 0) throw new Error('ffmpeg failed');
  console.log('wrote', mp4);
  // small 720p copy (under ~30 MB) for previewing and sharing in chat
  const share = path.join(ROOT, 'output', 'share');
  fs.mkdirSync(share, { recursive: true });
  const log = path.join(share, `${id}-pass`);
  const vf = ['-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-b:v', '2500k', '-passlogfile', log];
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, ...vf, '-pass', '1', '-an', '-f', 'null', '/dev/null'], { stdio: 'inherit' });
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, ...vf, '-pass', '2', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', path.join(share, `${id}-preview.mp4`)], { stdio: 'inherit' });
  for (const f of fs.readdirSync(share)) if (f.startsWith(`${id}-pass`)) fs.rmSync(path.join(share, f));
  console.log('wrote', path.join(share, `${id}-preview.mp4`));
}

if (opt('meta')) {
  await meta();
} else if (opt('preview')) {
  await preview(String(opt('preview')).split(',').map(Number));
} else if (opt('encode')) {
  const info = await meta();
  encode(info);
} else {
  const workers = parseInt(opt('workers', '1'), 10);
  const info = await meta();
  const from = parseFloat(opt('from', '0')), to = parseFloat(opt('to', String(info.duration)));
  if (workers > 1 && !opt('child')) {
    const span = (to - from) / workers;
    const kids = [];
    for (let w = 0; w < workers; w++) {
      const a = from + span * w, b = w === workers - 1 ? to : from + span * (w + 1) - 1 / info.fps;
      kids.push(new Promise((res) => {
        const k = spawn(process.execPath, [fileURLToPath(import.meta.url), id, '--from', a.toFixed(4), '--to', b.toFixed(4), '--scale', scale, '--layer', layer, '--child', ...(opt('resume') ? ['--resume'] : [])], { stdio: 'inherit' });
        k.on('exit', res);
      }));
    }
    await Promise.all(kids);
  } else {
    await renderRange(from, to);
  }
  if (opt('then-encode')) encode(info);
}
