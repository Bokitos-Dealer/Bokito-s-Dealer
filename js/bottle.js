/*
 * Draws bottle previews as inline SVG strings.
 *
 * Bottles are sized from their volume, so a 10ml and a 120ml bottle have
 * believable relative proportions when drawn side by side.
 * Cap shapes carry the `cap-paint` class so their colour can be animated.
 */
(function (root) {
  'use strict';

  let uid = 0;
  const LIQUID = '#e7a43b';
  const FONT = "'Space Grotesk', system-ui, sans-serif";

  function n(v) {
    return Math.round(v * 100) / 100;
  }

  function geometry(shape, volume) {
    if (shape === 'aviator') {
      const t = Math.log2(volume / 30);
      return { bw: 66 + 10 * t, bh: 92 + 26 * t, nw: 22, sh: 9, cw: 32, ch: 26, r: 16 };
    }
    const t = Math.log2(volume / 10);
    const nw = 18 + 0.8 * t;
    return { bw: 40 + 5 * t, bh: 60 + 24 * t, nw, sh: 14 + 1.5 * t, cw: nw + 9, ch: 34 + 2 * t, r: 9 };
  }

  function defs(id) {
    return (
      `<linearGradient id="${id}-shade" x1="0" x2="1" y1="0" y2="0">` +
      '<stop offset="0" stop-color="#fff" stop-opacity=".38"/>' +
      '<stop offset=".2" stop-color="#fff" stop-opacity=".06"/>' +
      '<stop offset=".62" stop-color="#000" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="#000" stop-opacity=".24"/>' +
      '</linearGradient>'
    );
  }

  /*
   * Returns { markup, minX, maxX, minY, maxY } for one bottle whose base
   * centre sits at (cx, base). `gid` names the shared gradient defs.
   */
  function bottle(opts, cx, base, gid) {
    const g = geometry(opts.shape, opts.volume);
    const body = opts.body;
    const capHex = opts.cap.hex;
    const id = `${gid}-b${++uid}`;

    const L = cx - g.bw / 2;
    const R = cx + g.bw / 2;
    const top = base - g.bh;
    const neck = top - g.sh;
    const capBottom = neck + 6;
    const capTop = capBottom - g.ch;

    const d =
      `M${n(L)},${n(top + g.r)} L${n(L)},${n(base - g.r)} Q${n(L)},${n(base)} ${n(L + g.r)},${n(base)} ` +
      `L${n(R - g.r)},${n(base)} Q${n(R)},${n(base)} ${n(R)},${n(base - g.r)} L${n(R)},${n(top + g.r)} ` +
      `C${n(R)},${n(top - g.sh * 0.35)} ${n(cx + g.nw / 2)},${n(neck + g.sh * 0.35)} ${n(cx + g.nw / 2)},${n(neck)} ` +
      `L${n(cx - g.nw / 2)},${n(neck)} ` +
      `C${n(cx - g.nw / 2)},${n(neck + g.sh * 0.35)} ${n(L)},${n(top - g.sh * 0.35)} ${n(L)},${n(top + g.r)} Z`;

    const parts = [];
    parts.push(`<clipPath id="${id}-clip"><path d="${d}"/></clipPath>`);
    parts.push(
      `<ellipse cx="${n(cx)}" cy="${n(base + 2)}" rx="${n(g.bw * 0.6)}" ry="3.5" fill="#000" opacity=".13"/>`,
    );
    parts.push(`<path d="${d}" fill="${body.hex}" fill-opacity="${body.opacity}"/>`);

    parts.push(`<g clip-path="url(#${id}-clip)">`);
    if (body.translucent) {
      const level = top + g.bh * 0.22;
      parts.push(
        `<rect x="${n(L)}" y="${n(level)}" width="${n(g.bw)}" height="${n(base - level)}" fill="${LIQUID}" opacity=".5"/>`,
        `<rect x="${n(L)}" y="${n(level)}" width="${n(g.bw)}" height="1.4" fill="#fff" opacity=".55"/>`,
      );
    }
    if (opts.label !== false) {
      const lh = Math.min(g.bh * 0.42, 54);
      const ly = top + (g.bh - lh) * 0.56;
      const text = `${opts.volume}ML`;
      const big = Math.min((g.bw * 0.78) / (text.length * 0.7), lh * 0.42);
      const small = Math.min(big * 0.42, (g.bw * 0.78) / (8 * 0.72));
      parts.push(
        `<rect x="${n(L)}" y="${n(ly)}" width="${n(g.bw)}" height="${n(lh)}" fill="#fbf7ee"/>`,
        `<rect x="${n(L)}" y="${n(ly + lh - 3)}" width="${n(g.bw)}" height="3" fill="#c8f53a"/>`,
        `<text x="${n(cx)}" y="${n(ly + lh * 0.34)}" text-anchor="middle" font-family="${FONT}" font-size="${n(small)}" font-weight="700" letter-spacing=".08em" fill="#1f3fae">BOKITO'S</text>`,
        `<text x="${n(cx)}" y="${n(ly + lh * 0.34 + big * 1.08)}" text-anchor="middle" font-family="${FONT}" font-size="${n(big)}" font-weight="700" fill="#14161a">${text}</text>`,
      );
    }
    parts.push(`<rect x="${n(L)}" y="${n(neck)}" width="${n(g.bw)}" height="${n(base - neck)}" fill="url(#${gid}-shade)"/>`);
    parts.push('</g>');

    const hl = body.translucent ? 0.55 : 0.2;
    parts.push(
      `<rect x="${n(L + g.bw * 0.12)}" y="${n(top + 4)}" width="${n(Math.max(3, g.bw * 0.07))}" height="${n(g.bh - 14)}" rx="2" fill="#fff" opacity="${hl}"/>`,
    );
    parts.push(`<path d="${d}" fill="none" stroke="#000" stroke-opacity=".2" stroke-width=".8"/>`);

    // Cap: body, tamper ring, grip ribs, shading.
    const cL = cx - g.cw / 2;
    parts.push(
      `<rect class="cap-paint" x="${n(cL)}" y="${n(capTop)}" width="${n(g.cw)}" height="${n(g.ch - 5)}" rx="4" fill="${capHex}"/>`,
      `<rect class="cap-paint" x="${n(cL - 1.5)}" y="${n(capBottom - 7)}" width="${n(g.cw + 3)}" height="7" rx="2" fill="${capHex}"/>`,
    );
    let ribs = '';
    for (let x = cL + 3.2; x < cL + g.cw - 2; x += 3.2) {
      ribs += `M${n(x)},${n(capTop + 5)}V${n(capBottom - 9)}`;
    }
    parts.push(
      `<path d="${ribs}" stroke="#000" stroke-opacity=".18" stroke-width="1"/>`,
      `<rect x="${n(cL - 1.5)}" y="${n(capTop)}" width="${n(g.cw + 3)}" height="${n(g.ch - 1)}" rx="3" fill="url(#${gid}-shade)"/>`,
      `<rect x="${n(cL + 2)}" y="${n(capTop + 1)}" width="${n(g.cw - 4)}" height="2.5" rx="1.2" fill="#fff" opacity=".35"/>`,
      `<rect x="${n(cL)}" y="${n(capTop)}" width="${n(g.cw)}" height="${n(g.ch - 5)}" rx="4" fill="none" stroke="#000" stroke-opacity=".22" stroke-width=".8"/>`,
    );

    const half = Math.max(g.bw * 0.6, g.cw / 2 + 2);
    return {
      markup: parts.join(''),
      minX: cx - half,
      maxX: cx + half,
      minY: capTop,
      maxY: base + 6,
    };
  }

  function svg(content, box, label, pad, cls) {
    const x = box.minX - pad;
    const y = box.minY - pad;
    const w = box.maxX - box.minX + pad * 2;
    const h = box.maxY - box.minY + pad * 2;
    return (
      `<svg class="${cls || 'bottle-svg'}" viewBox="${n(x)} ${n(y)} ${n(w)} ${n(h)}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">` +
      content +
      '</svg>'
    );
  }

  function describe(o) {
    return `${o.volume}ml ${o.shape} bottle, ${o.body.name.toLowerCase()} body, ${o.cap.name.toLowerCase()} cap`;
  }

  // One bottle, cropped to fit.
  function render(opts) {
    const gid = `bd${++uid}`;
    const b = bottle(opts, 60, 240, gid);
    return svg(`<defs>${defs(gid)}</defs><g>${b.markup}</g>`, b, describe(opts), 6);
  }

  // Several bottles side by side at true relative scale.
  function lineup(items, gap) {
    const gid = `bd${++uid}`;
    let x = 0;
    let box = null;
    const groups = items.map((opts, i) => {
      const g = geometry(opts.shape, opts.volume);
      const half = Math.max(g.bw * 0.6, g.cw / 2 + 2);
      if (i > 0) x += half;
      const b = bottle(opts, x, 240, gid);
      x += half + gap;
      box = box
        ? {
            minX: Math.min(box.minX, b.minX),
            maxX: Math.max(box.maxX, b.maxX),
            minY: Math.min(box.minY, b.minY),
            maxY: Math.max(box.maxY, b.maxY),
          }
        : b;
      return `<g data-bottle="${i}">${b.markup}</g>`;
    });
    const label = 'Bottles: ' + items.map(describe).join('; ');
    return svg(`<defs>${defs(gid)}</defs>${groups.join('')}`, box, label, 8, 'bottle-svg lineup');
  }

  const api = { render, lineup, geometry };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BD_BOTTLE = api;
})(typeof self !== 'undefined' ? self : this);
