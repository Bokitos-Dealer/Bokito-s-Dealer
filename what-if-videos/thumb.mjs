// Render a 1080x1920 cover image from an HTML page in thumbs/.
//   node thumb.mjs ai-jobs [variant]   ->  output/share/<id>-cover[-variant].jpg
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const [id, variant] = process.argv.slice(2);
if (!id) { console.log('usage: node thumb.mjs <id> [variant]'); process.exit(1); }
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
}).listen(0);
await new Promise((res) => srv.on('listening', res));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:${srv.address().port}/thumbs/${id}.html${variant ? `?v=${variant}` : ''}`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const out = path.join(ROOT, 'output', 'share', `${id}-cover${variant ? '-' + variant : ''}.jpg`);
await page.screenshot({ path: out, type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
await browser.close(); srv.close();
console.log('wrote', out);
