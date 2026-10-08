// Dev helper: render one frame after running a JS snippet in the page.
// node probe.mjs <scenario> <seconds> "<js>" out.jpg
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const [id, sec, js, out] = process.argv.slice(2);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', (e) => console.log('[page error]', e.message));
page.on('console', (m) => { const t = m.text(); if (!t.includes('GL Driver') && !t.includes('toNonIndexed')) console.log('[page]', t); });
await page.goto(`http://localhost:${srv.address().port}/engine/index.html?scale=${process.env.SCALE || 0.75}`);
await page.waitForFunction('window.WI_READY === true');
await page.evaluate((id) => window.WI.init(id), id);
const f = Math.round(parseFloat(sec) * 30);
await page.evaluate((f) => window.WI.goto(f, false), f - 1);
await page.evaluate((js) => { window.__probe = new Function('ctx', js); }, js || '');
await page.evaluate((f) => { window.ctx.onFrame.push(() => window.__probe(window.ctx)); window.WI.goto(f); }, f);
await page.screenshot({ path: out || 'probe.jpg', type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
await b.close(); srv.close();
