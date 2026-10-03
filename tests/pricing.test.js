const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/pricing.js');
const { PRODUCTS, CAP_COLORS, BODY_COLORS } = require('../js/catalog.js');

const products = { a: { base: 0.34 }, b: { base: 0.46 } };

test('tier boundaries are inclusive of the minimum', () => {
  assert.equal(P.tierIndex(0), 0);
  assert.equal(P.tierIndex(499), 0);
  assert.equal(P.tierIndex(500), 1);
  assert.equal(P.tierIndex(999), 1);
  assert.equal(P.tierIndex(1000), 2);
  assert.equal(P.tierIndex(5000), 3);
  assert.equal(P.tierIndex(10000), 4);
  assert.equal(P.tierIndex(999999), 4);
});

test('unit prices are discounted and rounded to milli-euros', () => {
  assert.equal(P.unitMilli(0.34, 300), 340);
  assert.equal(P.unitMilli(0.34, 600), 299); // 340 * 0.88 = 299.2
  assert.equal(P.unitMilli(0.34, 1000), 272);
  assert.equal(P.unitMilli(0.34, 10000), 211); // 340 * 0.62 = 210.8
});

test('line totals are exact in cents', () => {
  assert.equal(P.lineCents(299, 600), 17940);
  assert.equal(P.lineCents(211, 10000), 211000);
  assert.equal(P.lineCents(1, 5), 1); // 0.5 cent rounds up
});

test('normalizeQty rounds up to whole cases with a one-case minimum', () => {
  assert.equal(P.normalizeQty(0, 300), 300);
  assert.equal(P.normalizeQty(-5, 300), 300);
  assert.equal(P.normalizeQty('abc', 300), 300);
  assert.equal(P.normalizeQty(301, 300), 600);
  assert.equal(P.normalizeQty(900, 300), 900);
  assert.equal(P.normalizeQty(Infinity, 300), 300);
  assert.equal(P.normalizeQty(5e9, 300) <= P.MAX_QTY + 300, true);
});

test('qtyForMin finds the smallest case multiple reaching a tier', () => {
  assert.equal(P.qtyForMin(500, 300), 600);
  assert.equal(P.qtyForMin(1000, 200), 1000);
  assert.equal(P.qtyForMin(0, 400), 400);
});

test('nextTier reports the gap, and null at the top', () => {
  assert.deepEqual(
    { index: P.nextTier(300).index, needed: P.nextTier(300).needed },
    { index: 1, needed: 200 },
  );
  assert.equal(P.nextTier(10000), null);
});

test('colours of the same product pool towards one tier', () => {
  const cart = P.priceCart(
    [
      { key: 'a|natural|red', productId: 'a', qty: 300 },
      { key: 'a|black|blue', productId: 'a', qty: 300 },
    ],
    products,
    { vatRate: 0.21 },
  );
  assert.equal(cart.pooled.a, 600);
  for (const line of cart.lines) {
    assert.equal(line.tier, 1);
    assert.equal(line.unit, 299);
    assert.equal(line.total, 8970);
  }
  assert.equal(cart.subtotal, 17940);
  assert.equal(cart.savings, 20400 - 17940);
  assert.equal(cart.vat, 3767); // 17940 * 0.21 = 3767.4
  assert.equal(cart.total, 21707);
  assert.equal(cart.units, 600);
});

test('different products do not pool', () => {
  const cart = P.priceCart(
    [
      { key: 'a', productId: 'a', qty: 300 },
      { key: 'b', productId: 'b', qty: 400 },
    ],
    products,
    {},
  );
  assert.deepEqual(cart.lines.map((l) => l.tier), [0, 0]);
  assert.equal(cart.savings, 0);
  assert.equal(cart.vat, 0);
});

test('lines for unknown products are dropped, not priced', () => {
  const cart = P.priceCart(
    [
      { key: 'gone', productId: 'zzz', qty: 100 },
      { key: 'a', productId: 'a', qty: 300 },
    ],
    products,
    {},
  );
  assert.equal(cart.lines.length, 1);
  assert.equal(cart.dropped.length, 1);
  assert.equal(cart.subtotal, 10200);
});

test('catalog data is internally consistent', () => {
  const ids = new Set();
  const caps = new Set(CAP_COLORS.map((c) => c.id));
  const bodies = new Set(BODY_COLORS.map((c) => c.id));
  for (const p of PRODUCTS) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.ok(p.base > 0 && p.caseSize > 0, p.id);
    assert.ok(caps.has(p.cap), `${p.id} default cap`);
    assert.ok(bodies.has(p.body), `${p.id} default body`);
  }
});
