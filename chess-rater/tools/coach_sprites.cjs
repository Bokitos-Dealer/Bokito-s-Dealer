// Renders the coach character (an owl in big round glasses) to transparent PNG sprites:
// assets/coach/{hype,shook}_{0,1,2}.png, where 0-2 is how far the beak is open.
// Usage: node tools/coach_sprites.cjs   (needs Playwright with Chromium)
const path = require("path");
const { chromium } = require("playwright");

const INK = "#1a1410";
const FEATHER = "#8a5a3c";
const FEATHER_DARK = "#6b4229";
const BELLY = "#f1dfbf";
const BEAK = "#f2a33a";
const MOUTH = "#3a0d0d";

function svg(expr, open) {
  const hype = expr === "hype";
  // eyes: smug = half-closed lids over the pupils; shook = wide open with tiny pupils
  const eye = (cx) => hype
    ? `<circle cx="${cx}" cy="102" r="23" fill="#fff"/>
       <circle cx="${cx + 3}" cy="108" r="9" fill="${INK}"/>
       <circle cx="${cx + 6}" cy="105" r="3" fill="#fff"/>
       <g clip-path="url(#lid${cx})"><rect x="${cx - 26}" y="74" width="52" height="28" fill="${FEATHER}"/></g>
       <path d="M${cx - 23} 102 L${cx + 23} 102" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
    : `<circle cx="${cx}" cy="102" r="23" fill="#fff"/>
       <circle cx="${cx}" cy="102" r="5" fill="${INK}"/>`;
  const brows = hype
    ? `<path d="M48 70 Q68 66 90 72" /><path d="M110 66 Q132 52 154 62"/>`   // one brow up: smug
    : `<path d="M48 66 Q66 58 90 52"/><path d="M110 52 Q134 58 152 66"/>`;  // both up in the middle: shook
  const beaks = [
    `<path d="M85 120 L115 120 L100 150 Z" fill="${BEAK}"/>`,
    `<path d="M89 126 L111 126 L108 146 L92 146 Z" fill="${MOUTH}" stroke="none"/>
     <path d="M84 118 L116 118 L100 138 Z" fill="${BEAK}"/>
     <path d="M89 145 L111 145 L100 158 Z" fill="${BEAK}"/>`,
    `<path d="M88 124 L112 124 L110 154 L90 154 Z" fill="${MOUTH}" stroke="none"/>
     <ellipse cx="100" cy="149" rx="8" ry="4" fill="#e2575c" stroke="none"/>
     <path d="M83 115 L117 115 L100 135 Z" fill="${BEAK}"/>
     <path d="M88 153 L112 153 L100 168 Z" fill="${BEAK}"/>`,
  ];
  const sweat = hype ? "" :
    `<path d="M168 52 Q177 67 168 75 Q159 67 168 52 Z" fill="#8fd0ff" stroke="${INK}" stroke-width="3"/>`;
  const tuftLift = hype ? 0 : -8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250" width="400" height="500">
  <defs>
    <radialGradient id="body" cx="0.4" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#a87352"/><stop offset="1" stop-color="${FEATHER_DARK}"/>
    </radialGradient>
    <clipPath id="lid70"><circle cx="70" cy="102" r="23"/></clipPath>
    <clipPath id="lid130"><circle cx="130" cy="102" r="23"/></clipPath>
  </defs>
  <g stroke="${INK}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M46 ${70 + tuftLift / 2} L34 ${22 + tuftLift} L84 48 Z" fill="${FEATHER_DARK}"/>
    <path d="M154 ${70 + tuftLift / 2} L166 ${22 + tuftLift} L116 48 Z" fill="${FEATHER_DARK}"/>
    <path d="M100 36 C152 36 176 84 176 146 C176 204 144 238 100 238 C56 238 24 204 24 146 C24 84 48 36 100 36 Z" fill="url(#body)"/>
    <ellipse cx="100" cy="182" rx="50" ry="52" fill="${BELLY}" stroke-width="0"/>
    <path d="M30 140 C16 168 22 204 50 218 C44 190 44 162 52 138 Z" fill="${FEATHER_DARK}"/>
    <path d="M170 140 C184 168 178 204 150 218 C156 190 156 162 148 138 Z" fill="${FEATHER_DARK}"/>
    <ellipse cx="84" cy="240" rx="11" ry="6" fill="${BEAK}"/>
    <ellipse cx="116" cy="240" rx="11" ry="6" fill="${BEAK}"/>
  </g>
  <g fill="none" stroke="${FEATHER}" stroke-width="4" stroke-linecap="round">
    <path d="M80 172 L86 178 L92 172"/><path d="M108 172 L114 178 L120 172"/>
    <path d="M94 192 L100 198 L106 192"/><path d="M78 208 L84 214 L90 208"/><path d="M110 208 L116 214 L122 208"/>
  </g>
  <ellipse cx="74" cy="58" rx="16" ry="8" fill="#ffffff" opacity="0.25" transform="rotate(-25 74 58)"/>
  ${eye(70)}${eye(130)}
  <g fill="none" stroke="${INK}" stroke-width="7">
    <circle cx="70" cy="102" r="26"/><circle cx="130" cy="102" r="26"/>
    <path d="M96 100 Q100 93 104 100"/><path d="M44 98 L32 92"/><path d="M156 98 L168 92"/>
  </g>
  <g stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" opacity="0.8">
    <path d="M55 92 L62 85"/><path d="M115 92 L122 85"/>
  </g>
  <g stroke="${INK}" stroke-width="6" stroke-linecap="round" fill="none">${brows}</g>
  <g stroke="${INK}" stroke-width="4" stroke-linejoin="round">${beaks[open]}</g>
  ${sweat}
</svg>`;
}

(async () => {
  const out = path.join(__dirname, "..", "assets", "coach");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 500 } });
  for (const expr of ["hype", "shook"]) {
    for (const open of [0, 1, 2]) {
      await page.setContent(`<html><body style="margin:0;background:transparent">${svg(expr, open)}</body></html>`);
      await page.locator("svg").screenshot({ path: path.join(out, `${expr}_${open}.png`), omitBackground: true });
    }
  }
  await browser.close();
  console.log("wrote sprites to", out);
})();
