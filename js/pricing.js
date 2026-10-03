/*
 * Volume-tier pricing.
 *
 * Money is kept in integers to avoid floating-point drift:
 *   - unit prices in milli-euros (1/1000 €), shown with 3 decimals
 *   - line and order totals in cents
 *
 * Tiers are decided by the combined quantity of a product across all of
 * its colour combinations, so customers can mix and match colours without
 * losing their volume discount.
 */
(function (root) {
  'use strict';

  const TIERS = [
    { min: 0, discount: 0, name: 'Starter' },
    { min: 500, discount: 0.12, name: 'Shop' },
    { min: 1000, discount: 0.2, name: 'Wholesale' },
    { min: 5000, discount: 0.3, name: 'Distributor' },
    { min: 10000, discount: 0.38, name: 'Bulk' },
  ];

  const MAX_QTY = 1000000;

  function tierIndex(qty) {
    let index = 0;
    for (let i = 0; i < TIERS.length; i++) {
      if (qty >= TIERS[i].min) index = i;
    }
    return index;
  }

  function baseMilli(baseEur) {
    return Math.round(baseEur * 1000);
  }

  function unitMilli(baseEur, qty) {
    return Math.round(baseMilli(baseEur) * (1 - TIERS[tierIndex(qty)].discount));
  }

  function lineCents(unit, qty) {
    return Math.round((unit * qty) / 10);
  }

  // Next tier above `qty`, or null when already at the top.
  function nextTier(qty) {
    const index = tierIndex(qty);
    if (index === TIERS.length - 1) return null;
    const tier = TIERS[index + 1];
    return { index: index + 1, tier, needed: tier.min - qty };
  }

  // Round up to whole cases, never below one case.
  function normalizeQty(qty, caseSize) {
    const n = Math.floor(Number(qty));
    if (!Number.isFinite(n) || n <= caseSize) return caseSize;
    const capped = Math.min(n, MAX_QTY);
    return Math.ceil(capped / caseSize) * caseSize;
  }

  // Smallest whole-case quantity that reaches `minQty`.
  function qtyForMin(minQty, caseSize) {
    return normalizeQty(Math.max(minQty, caseSize), caseSize);
  }

  /*
   * lines:    [{ key, productId, qty, ... }]
   * products: { [id]: { base, ... } }
   * Returns priced lines plus order totals. Lines whose product is
   * unknown (e.g. removed from the catalog) are reported in `dropped`.
   */
  function priceCart(lines, products, options) {
    const vatRate = (options && options.vatRate) || 0;
    const known = lines.filter((line) => products[line.productId]);
    const dropped = lines.filter((line) => !products[line.productId]);

    const pooled = {};
    for (const line of known) {
      pooled[line.productId] = (pooled[line.productId] || 0) + line.qty;
    }

    let subtotal = 0;
    let listTotal = 0;
    const priced = known.map((line) => {
      const product = products[line.productId];
      const groupQty = pooled[line.productId];
      const tier = tierIndex(groupQty);
      const unit = unitMilli(product.base, groupQty);
      const total = lineCents(unit, line.qty);
      const list = lineCents(baseMilli(product.base), line.qty);
      subtotal += total;
      listTotal += list;
      return Object.assign({}, line, { groupQty, tier, unit, total, list });
    });

    const vat = Math.round(subtotal * vatRate);
    return {
      lines: priced,
      dropped,
      pooled,
      subtotal,
      savings: listTotal - subtotal,
      vat,
      total: subtotal + vat,
      units: known.reduce((sum, line) => sum + line.qty, 0),
    };
  }

  const api = {
    TIERS,
    MAX_QTY,
    tierIndex,
    baseMilli,
    unitMilli,
    lineCents,
    nextTier,
    normalizeQty,
    qtyForMin,
    priceCart,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BD_PRICING = api;
})(typeof self !== 'undefined' ? self : this);
