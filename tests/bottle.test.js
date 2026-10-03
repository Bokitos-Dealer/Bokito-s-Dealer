const test = require('node:test');
const assert = require('node:assert/strict');
const Bottle = require('../js/bottle.js');
const { PRODUCTS, BODY_COLORS, CAP_COLORS } = require('../js/catalog.js');

test('every product renders in every body colour without NaN geometry', () => {
  for (const p of PRODUCTS) {
    for (const body of BODY_COLORS) {
      const svg = Bottle.render({ shape: p.shape, volume: p.volume, body, cap: CAP_COLORS[0] });
      assert.match(svg, /^<svg [^>]*viewBox="[-\d. ]+"/, p.id);
      assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${p.id}/${body.id}`);
      assert.ok(svg.includes(`${p.volume}ML`), `${p.id} label`);
    }
  }
});

test('larger volumes draw taller bottles', () => {
  const h = (v) => Bottle.geometry('unicorn', v).bh;
  assert.ok(h(10) < h(30) && h(30) < h(60) && h(60) < h(120));
});

test('lineup gives each bottle its own group and unique clip ids', () => {
  const body = BODY_COLORS[0];
  const cap = CAP_COLORS[0];
  const svg = Bottle.lineup(
    [{ shape: 'unicorn', volume: 30, body, cap }, { shape: 'aviator', volume: 60, body, cap }],
    12,
  );
  assert.equal((svg.match(/data-bottle=/g) || []).length, 2);
  const ids = svg.match(/id="[^"]+-clip"/g);
  assert.equal(new Set(ids).size, ids.length);
});
