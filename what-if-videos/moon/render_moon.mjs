// node moon/render_moon.mjs --preview 1,2,5   |   node moon/render_moon.mjs [--from s] [--to s]   |   --encode
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawnSync } from 'child_process'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; } fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise((res) => srv.listen(0, res));
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', (e) => console.log('[page error]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
await page.goto(`http://localhost:${srv.address().port}/moon/compositor.html`);
await page.waitForFunction('window.COMP_READY === true', null, { timeout: 120000 });
const info = await page.evaluate(() => ({ frames: COMP.frames, fps: COMP.fps, duration: COMP.duration, T: COMP.T }));
console.log('frames', info.frames, 'duration', info.duration, JSON.stringify(info.T));
const shot = (file) => page.screenshot({ path: file, type: 'jpeg', quality: 94, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
if (opt('preview')) {
  const dir = path.join(HERE, 'preview'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const ts = String(opt('preview')).split(',').map(Number);
  const files = [];
  for (const t of ts) { const f = Math.round(t * info.fps); await page.evaluate((f) => COMP.frame(f), f); const file = path.join(dir, `t${t.toFixed(2)}.jpg`); await shot(file); files.push(file); }
  const cols = Math.min(5, files.length), rows = Math.ceil(files.length / cols);
  const pad = rows * cols - files.length; for (let i = 0; i < pad; i++) files.push(files[files.length - 1]);
  const fc = files.map((_, i) => `[${i}:v]scale=324:576[s${i}]`).join(';') + ';' + Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => `[s${r * cols + c}]`).join('') + (cols > 1 ? `hstack=${cols}` : 'null') + `[r${r}]`).join(';') + ';' + Array.from({ length: rows }, (_, r) => `[r${r}]`).join('') + (rows > 1 ? `vstack=${rows}` : 'null') + '[o]';
  spawnSync('ffmpeg', ['-v', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex', fc, '-map', '[o]', '-frames:v', '1', path.join(dir, 'sheet.jpg')], { stdio: 'inherit' });
} else if (!opt('encode')) {
  const dir = path.join(HERE, 'frames'); fs.mkdirSync(dir, { recursive: true });
  const f0 = Math.round(parseFloat(opt('from', '0')) * info.fps), f1 = Math.min(info.frames - 1, Math.round(parseFloat(opt('to', String(info.duration))) * info.fps));
  const t0 = Date.now();
  for (let f = f0; f <= f1; f++) {
    await page.evaluate((f) => COMP.frame(f), f);
    await shot(path.join(dir, `${String(f).padStart(5, '0')}.jpg`));
    if (f % 150 === 0) console.log(`frame ${f}/${f1} ${((Date.now() - t0) / (f - f0 + 1)).toFixed(0)}ms/frame`);
  }
}
await browser.close(); srv.close();
if (opt('encode') || opt('then-encode')) {
  const out = path.join(ROOT, 'output', 'what-if-moon-disappeared.mp4');
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(info.fps), '-i', path.join(HERE, 'frames', '%05d.jpg'), '-i', path.join(HERE, 'audio', 'final_mix.wav'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(info.fps),
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('encode failed');
  console.log('wrote', out);
}
