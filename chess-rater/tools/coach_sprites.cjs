// Renders the coach character (a cocky pawn in sunglasses) to transparent PNG sprites:
// assets/coach/{hype,shook}_{0,1,2}.png, where 0-2 is how far the mouth is open.
// Usage: node tools/coach_sprites.cjs   (needs Playwright with Chromium)
const path = require("path");
const { chromium } = require("playwright");

const INK = "#141414";
const MOUTH = "#4a1010";
const TONGUE = "#e2575c";

function svg(expr, open) {
  const brows = expr === "hype"
    ? `<path d="M52 57 Q70 50 88 55"/><path d="M112 51 Q131 40 150 48"/>`   // one brow up: smug
    : `<path d="M54 55 Q70 46 88 42"/><path d="M112 42 Q130 46 146 55"/>`;  // both up in the middle: shook
  const mouths = {
    hype: [
      `<path d="M80 116 Q104 128 126 107" fill="none"/>`,
      `<path d="M80 112 Q104 134 126 106 Q104 118 80 112 Z" fill="${MOUTH}"/>`,
      `<path d="M78 108 Q104 150 128 104 Q104 114 78 108 Z" fill="${MOUTH}"/>
       <path d="M93 127 Q104 121 116 126 Q110 136 99 135 Z" fill="${TONGUE}" stroke="none"/>`,
    ],
    shook: [
      `<path d="M84 119 Q92 112 100 119 Q108 126 116 119" fill="none"/>`,
      `<ellipse cx="100" cy="120" rx="9" ry="9" fill="${MOUTH}"/>`,
      `<ellipse cx="100" cy="122" rx="13" ry="16" fill="${MOUTH}"/>
       <ellipse cx="100" cy="132" rx="8" ry="5" fill="${TONGUE}" stroke="none"/>`,
    ],
  };
  const sweat = expr === "shook"
    ? `<path d="M160 36 Q168 50 160 58 Q152 50 160 36 Z" fill="#8fd0ff" stroke="${INK}" stroke-width="3"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="400" height="480">
  <defs>
    <linearGradient id="ivory" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ddd5c4"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe17a"/><stop offset="1" stop-color="#d49b12"/>
    </linearGradient>
  </defs>
  <g stroke="${INK}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" fill="url(#ivory)">
    <rect x="30" y="204" width="140" height="28" rx="12"/>
    <path d="M70 150 C70 176 52 192 46 206 L154 206 C148 192 130 176 130 150 Z"/>
    <ellipse cx="100" cy="150" rx="50" ry="13"/>
    <circle cx="100" cy="82" r="62"/>
  </g>
  <ellipse cx="78" cy="48" rx="16" ry="9" fill="#ffffff" opacity="0.8" transform="rotate(-25 78 48)"/>
  <path d="M68 164 Q100 192 132 164" fill="none" stroke="url(#gold)" stroke-width="6" stroke-dasharray="1 8" stroke-linecap="round"/>
  <circle cx="100" cy="184" r="8" fill="url(#gold)" stroke="${INK}" stroke-width="3"/>
  <g fill="#15171f" stroke="${INK}" stroke-width="3">
    <rect x="47" y="65" width="47" height="31" rx="11"/>
    <rect x="106" y="65" width="47" height="31" rx="11"/>
  </g>
  <g stroke="${INK}" stroke-width="6" stroke-linecap="round" fill="none">
    <path d="M94 74 L106 74"/><path d="M47 72 L39 66"/><path d="M153 72 L161 66"/>
  </g>
  <g stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.85">
    <path d="M57 76 L66 70"/><path d="M116 76 L125 70"/>
  </g>
  <g stroke="${INK}" stroke-width="6" stroke-linecap="round" fill="none">${brows}</g>
  <g stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${mouths[expr][open]}</g>
  ${sweat}
</svg>`;
}

(async () => {
  const out = path.join(__dirname, "..", "assets", "coach");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 480 } });
  for (const expr of ["hype", "shook"]) {
    for (const open of [0, 1, 2]) {
      await page.setContent(`<html><body style="margin:0;background:transparent">${svg(expr, open)}</body></html>`);
      await page.locator("svg").screenshot({ path: path.join(out, `${expr}_${open}.png`), omitBackground: true });
    }
  }
  await browser.close();
  console.log("wrote sprites to", out);
})();
