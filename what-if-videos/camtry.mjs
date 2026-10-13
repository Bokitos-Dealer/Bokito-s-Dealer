// Dev helper: try camera candidates in one browser session.
//   node camtry.mjs <scenario> cands.json outdir      cands: [{name, t, pos, look, fov}]  (pos omitted = scripted camera)
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const [id, cf, out] = process.argv.slice(2);
const cands = JSON.parse(fs.readFileSync(cf, 'utf8')).sort((a, b) => a.t - b.t);   // the page can't rewind fs.mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
await new Promise((res) => srv.on('listening', res));
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', (e) => console.log('[page error]', e.message));
await page.goto(`http://localhost:${srv.address().port}/engine/index.html?scale=${process.env.SCALE || 0.4}`);
await page.waitForFunction('window.WI_READY === true');
await page.evaluate((id) => window.WI.init(id), id);
for (const c of cands) {
  await page.evaluate((c) => { window.__cam = c.pos ? c : null; return window.WI.goto(Math.round(c.t * 30)); }, c);
  await page.screenshot({ path: path.join(out, c.name + '.jpg'), type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  console.log('ok', c.name);
}
await b.close(); srv.close();
