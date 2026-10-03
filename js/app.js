(function () {
  'use strict';

  const { CONFIG, LINES, BODY_COLORS, CAP_COLORS, PRODUCTS } = window.BD_CATALOG;
  const P = window.BD_PRICING;
  const Bottle = window.BD_BOTTLE;

  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const bodyById = Object.fromEntries(BODY_COLORS.map((c) => [c.id, c]));
  const capById = Object.fromEntries(CAP_COLORS.map((c) => [c.id, c]));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  const money = new Intl.NumberFormat(CONFIG.locale, { style: 'currency', currency: CONFIG.currency });
  const unitMoney = new Intl.NumberFormat(CONFIG.locale, {
    style: 'currency',
    currency: CONFIG.currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  const num = new Intl.NumberFormat(CONFIG.locale);
  const dateFmt = new Intl.DateTimeFormat(CONFIG.locale, { day: 'numeric', month: 'long', year: 'numeric' });

  const cents = (c) => money.format(c / 100);
  const milli = (m) => unitMoney.format(m / 1000);
  const pct = (d) => `${Math.round(d * 100)}%`;

  function productTitle(p) {
    return `${p.name} ${p.volume}ml`;
  }

  function bottleOpts(product, bodyId, capId, label) {
    return {
      shape: product.shape,
      volume: product.volume,
      body: bodyById[bodyId] || bodyById[product.body],
      cap: capById[capId] || capById[product.cap],
      label,
    };
  }

  function lineKey(productId, body, cap) {
    return `${productId}|${body}|${cap}`;
  }

  /* ---------- Storage ---------- */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* storage unavailable: the cart simply won't persist */
      }
    },
  };

  function loadCart() {
    const raw = store.get('bd-cart', []);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l) => l && byId[l.productId] && bodyById[l.body] && capById[l.cap])
      .map((l) => ({
        key: lineKey(l.productId, l.body, l.cap),
        productId: l.productId,
        body: l.body,
        cap: l.cap,
        qty: P.normalizeQty(l.qty, byId[l.productId].caseSize),
      }));
  }

  const state = {
    cart: loadCart(),
    line: 'all',
    query: '',
    sort: 'featured',
  };

  function saveCart() {
    store.set('bd-cart', state.cart);
  }

  function pooledQty(productId) {
    return state.cart.filter((l) => l.productId === productId).reduce((s, l) => s + l.qty, 0);
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(html) {
    const el = $('#toast');
    el.innerHTML = html;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 4200);
  }

  /* ---------- Theme ---------- */
  function initTheme() {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    $('#theme-toggle').addEventListener('click', () => {
      const current = root.getAttribute('data-theme') || (media.matches ? 'dark' : 'light');
      const next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('bd-theme', next);
      } catch (e) {
        /* ignore */
      }
    });
  }

  function initTopbar() {
    const bar = $('.topbar');
    const onScroll = () => bar.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Hero ---------- */
  function initHero() {
    const picks = [
      { id: 'unicorn-30', body: 'clear', caps: ['red', 'yellow', 'blue', 'pink'] },
      { id: 'unicorn-120', body: 'natural', caps: ['black', 'purple', 'green', 'orange'] },
      { id: 'aviator-60', body: 'frosted', caps: ['blue', 'red', 'white', 'green'] },
    ];
    const el = $('#hero-bottles');
    el.innerHTML = Bottle.lineup(
      picks.map((p) => bottleOpts(byId[p.id], p.body, p.caps[0], true)),
      16,
    );

    const featured = byId['aviator-60'];
    const best = P.unitMilli(featured.base, P.TIERS[P.TIERS.length - 1].min);
    $('#hero-tag').innerHTML =
      `${esc(productTitle(featured))}<strong>${milli(best)}</strong>per unit at ${num.format(P.TIERS[P.TIERS.length - 1].min)}+ · ` +
      `<em>save ${pct(P.TIERS[P.TIERS.length - 1].discount)}</em>`;

    if (reducedMotion) return;
    let step = 0;
    setInterval(() => {
      step++;
      picks.forEach((p, i) => {
        const hex = capById[p.caps[step % p.caps.length]].hex;
        el.querySelectorAll(`[data-bottle="${i}"] .cap-paint`).forEach((node) => {
          node.style.fill = hex;
        });
      });
    }, 2400);
  }

  /* ---------- Catalog ---------- */
  function searchText(p) {
    return `${p.name} ${p.volume}ml ${p.volume} ml ${p.material} ${LINES[p.line].name} ${p.blurb}`.toLowerCase();
  }

  function filteredProducts() {
    const terms = state.query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = PRODUCTS.filter(
      (p) =>
        (state.line === 'all' || p.line === state.line) &&
        terms.every((t) => searchText(p).includes(t)),
    );
    const sorters = {
      'size-asc': (a, b) => a.volume - b.volume,
      'size-desc': (a, b) => b.volume - a.volume,
      'price-asc': (a, b) => a.base - b.base,
      'price-desc': (a, b) => b.base - a.base,
    };
    return sorters[state.sort] ? list.slice().sort(sorters[state.sort]) : list;
  }

  function renderLineFilter() {
    const options = [['all', 'All', PRODUCTS.length]].concat(
      Object.keys(LINES).map((id) => [id, LINES[id].name, PRODUCTS.filter((p) => p.line === id).length]),
    );
    $('#line-filter').innerHTML = options
      .map(
        ([id, name, count]) =>
          `<button type="button" role="radio" data-line="${id}" aria-checked="${state.line === id}">${esc(name)} <span class="muted">${count}</span></button>`,
      )
      .join('');
  }

  function renderCatalog() {
    const list = filteredProducts();
    const top = P.TIERS[P.TIERS.length - 1];
    $('#result-count').textContent =
      list.length === PRODUCTS.length ? `${list.length} bottles` : `${list.length} of ${PRODUCTS.length} bottles`;

    if (!list.length) {
      $('#product-grid').innerHTML =
        '<li class="empty">No bottles match that search. <button class="btn btn--ghost btn--sm" type="button" data-reset>Clear filters</button></li>';
      return;
    }

    $('#product-grid').innerHTML = list
      .map((p) => {
        const caps = CAP_COLORS.slice(0, 7)
          .map((c) => `<span style="background:${c.hex}" title="${esc(c.name)}"></span>`)
          .join('');
        return `
        <li>
          <article class="product card">
            <div class="product__stage">
              <span class="product__tag">${esc(LINES[p.line].name)}</span>
              ${Bottle.render(bottleOpts(p, p.body, p.cap, true))}
            </div>
            <div class="product__body">
              <h3 class="product__name">${esc(productTitle(p))}</h3>
              <p class="product__specs">${esc(p.material)} · ${num.format(p.caseSize)} per case</p>
              <div class="product__caps" aria-label="${CAP_COLORS.length} cap colours">${caps}<span class="muted" style="border:0;width:auto;height:auto;font-size:.75rem;line-height:14px">+${CAP_COLORS.length - 7}</span></div>
              <div class="product__foot">
                <div class="product__price">
                  from<strong>${milli(P.unitMilli(p.base, top.min))}</strong>${milli(P.baseMilli(p.base))} at 1 case
                </div>
                <button class="btn btn--brand btn--sm" type="button" data-configure="${p.id}" aria-label="Configure ${esc(productTitle(p))}">Configure</button>
              </div>
            </div>
          </article>
        </li>`;
      })
      .join('');
  }

  function initCatalog() {
    renderLineFilter();
    renderCatalog();

    $('#line-filter').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-line]');
      if (!btn) return;
      state.line = btn.dataset.line;
      renderLineFilter();
      renderCatalog();
    });
    $('#line-filter').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const ids = ['all'].concat(Object.keys(LINES));
      const i = ids.indexOf(state.line) + (e.key === 'ArrowRight' ? 1 : -1);
      state.line = ids[(i + ids.length) % ids.length];
      renderLineFilter();
      renderCatalog();
      $(`[data-line="${state.line}"]`).focus();
    });
    $('#search').addEventListener('input', (e) => {
      state.query = e.target.value;
      renderCatalog();
    });
    $('#sort').addEventListener('change', (e) => {
      state.sort = e.target.value;
      renderCatalog();
    });
    $('#product-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-configure]');
      if (btn) openConfigurator(btn.dataset.configure);
      if (e.target.closest('[data-reset]')) {
        state.query = '';
        state.line = 'all';
        $('#search').value = '';
        renderLineFilter();
        renderCatalog();
      }
    });
  }

  /* ---------- Configurator ---------- */
  const cfg = { product: null, body: null, cap: null, qty: 0, added: false };

  function swatchHtml(name, colors, selected) {
    return colors
      .map(
        (c) => `
        <label class="swatch${c.id === 'clear' ? ' swatch--clear' : ''}" title="${esc(c.name)}">
          <input type="radio" name="${name}" value="${c.id}" ${c.id === selected ? 'checked' : ''} aria-label="${esc(c.name)}">
          <span style="background-color:${c.hex}"></span>
        </label>`,
      )
      .join('');
  }

  function openConfigurator(productId, preset) {
    const p = byId[productId];
    if (!p) return;
    cfg.product = p;
    cfg.body = (preset && preset.body) || p.body;
    cfg.cap = (preset && preset.cap) || p.cap;
    cfg.qty = P.normalizeQty((preset && preset.qty) || p.caseSize, p.caseSize);
    cfg.added = false;

    $('#cfg-line').textContent = `${LINES[p.line].name} · ${LINES[p.line].tagline}`;
    $('#cfg-title').textContent = productTitle(p);
    $('#cfg-blurb').textContent = p.blurb;
    $('#cfg-case').textContent = `· sold in cases of ${num.format(p.caseSize)}`;
    $('#cfg-bodies').innerHTML = swatchHtml('cfg-body', BODY_COLORS, cfg.body);
    $('#cfg-caps').innerHTML = swatchHtml('cfg-cap', CAP_COLORS, cfg.cap);
    $('#cfg-qty').step = p.caseSize;
    $('#cfg-qty').min = p.caseSize;

    updateConfigurator(true);
    const dialog = $('#configurator');
    if (!dialog.open) dialog.showModal();
  }

  function updateConfigurator(redraw) {
    const p = cfg.product;
    const body = bodyById[cfg.body];
    const cap = capById[cfg.cap];
    $('#cfg-body-name').textContent = body.name;
    $('#cfg-cap-name').textContent = cap.name;
    $('#cfg-meta').textContent = `${p.volume}ml · ${p.material} · ${body.name} body · ${cap.name} cap`;

    if (redraw) {
      $('#cfg-preview').innerHTML = Bottle.render(bottleOpts(p, cfg.body, cfg.cap, true));
    }
    $('#cfg-qty').value = cfg.qty;

    const already = pooledQty(p.id);
    const pooled = already + cfg.qty;
    const tierIdx = P.tierIndex(pooled);
    const unit = P.unitMilli(p.base, pooled);
    const list = P.baseMilli(p.base);
    const total = P.lineCents(unit, cfg.qty);

    $('#cfg-unit').textContent = milli(unit);
    $('#cfg-list').textContent = unit < list ? milli(list) : '';
    $('#cfg-tier').textContent =
      P.TIERS[tierIdx].discount > 0 ? `${P.TIERS[tierIdx].name} · −${pct(P.TIERS[tierIdx].discount)}` : P.TIERS[tierIdx].name;
    $('#cfg-tierbar').innerHTML = P.TIERS.map((t, i) => `<span class="${i <= tierIdx ? 'is-on' : ''}"></span>`).join('');
    $('#cfg-pool').textContent = already
      ? `Includes ${num.format(already)} ${productTitle(p)} already in your quote — tiers count every colour combined.`
      : '';

    const next = P.nextTier(pooled);
    const nextEl = $('#cfg-next');
    if (next) {
      const target = P.normalizeQty(next.tier.min - already, p.caseSize);
      const nextUnit = P.unitMilli(p.base, already + target);
      const nextTotal = P.lineCents(nextUnit, target);
      const cheaper = nextTotal <= total;
      nextEl.innerHTML =
        `<span>${
          cheaper
            ? `<strong>Tip:</strong> ${num.format(target)} units costs ${cents(nextTotal)} — less than ${num.format(cfg.qty)}.`
            : `${num.format(target - cfg.qty)} more unlocks <strong>${esc(next.tier.name)}</strong> at ${milli(nextUnit)}/unit.`
        }</span>` +
        `<button class="btn btn--ghost btn--sm" type="button" data-set-qty="${target}">Make it ${num.format(target)}</button>`;
    } else {
      nextEl.innerHTML = '<span>Top tier unlocked — the best price we offer.</span>';
    }

    $('#cfg-add').textContent = `Add ${num.format(cfg.qty)} to quote · ${cents(total)}`;
  }

  function initConfigurator() {
    const dialog = $('#configurator');

    dialog.addEventListener('change', (e) => {
      if (e.target.name === 'cfg-body') cfg.body = e.target.value;
      else if (e.target.name === 'cfg-cap') cfg.cap = e.target.value;
      else return;
      updateConfigurator(true);
    });

    const setQty = (q) => {
      cfg.qty = P.normalizeQty(q, cfg.product.caseSize);
      updateConfigurator(false);
    };
    $('#cfg-minus').addEventListener('click', () => setQty(cfg.qty - cfg.product.caseSize));
    $('#cfg-plus').addEventListener('click', () => setQty(cfg.qty + cfg.product.caseSize));
    $('#cfg-qty').addEventListener('change', (e) => setQty(e.target.value));
    $('#cfg-next').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-set-qty]');
      if (btn) setQty(Number(btn.dataset.setQty));
    });

    $('#cfg-add').addEventListener('click', () => {
      addToCart(cfg.product.id, cfg.body, cfg.cap, cfg.qty);
      cfg.added = true;
      dialog.close();
      toast(
        `Added ${num.format(cfg.qty)} × ${esc(productTitle(cfg.product))} (${esc(bodyById[cfg.body].name)} / ${esc(capById[cfg.cap].name)} cap). <a href="#quote">View quote</a>`,
      );
    });

    // Click on the backdrop closes the dialog.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }

  /* ---------- Cart ---------- */
  function addToCart(productId, body, cap, qty) {
    const key = lineKey(productId, body, cap);
    const existing = state.cart.find((l) => l.key === key);
    if (existing) existing.qty = P.normalizeQty(existing.qty + qty, byId[productId].caseSize);
    else state.cart.push({ key, productId, body, cap, qty });
    saveCart();
    renderCart();
    const count = $('#cart-count');
    count.classList.remove('bump');
    void count.offsetWidth;
    count.classList.add('bump');
  }

  function priced() {
    return P.priceCart(state.cart, byId, { vatRate: CONFIG.vatRate });
  }

  function emptyCartHtml() {
    const art = Bottle.lineup(
      [bottleOpts(byId['unicorn-10'], 'clear', 'pink', false), bottleOpts(byId['unicorn-60'], 'frosted', 'yellow', false)],
      10,
    );
    return `<div class="cart-empty">${art}<h3>Your quote is empty</h3><p>Configure a bottle to start building your quote.</p><a class="btn btn--brand" href="#catalog">Browse the range</a></div>`;
  }

  function poolNotes(cart) {
    const notes = [];
    for (const productId of Object.keys(cart.pooled)) {
      const p = byId[productId];
      const qty = cart.pooled[productId];
      const next = P.nextTier(qty);
      if (!next) continue;
      const add = P.normalizeQty(next.tier.min - qty, p.caseSize);
      const nowTotal = P.lineCents(P.unitMilli(p.base, qty), qty);
      const newTotal = P.lineCents(P.unitMilli(p.base, qty + add), qty + add);
      const lines = cart.lines.filter((l) => l.productId === productId);
      const target = lines[lines.length - 1].key;
      const msg =
        newTotal <= nowTotal
          ? `<strong>${esc(productTitle(p))}:</strong> adding ${num.format(add)} units lowers your total by ${cents(nowTotal - newTotal)}.`
          : `<strong>${esc(productTitle(p))}:</strong> ${num.format(add)} more units unlocks ${esc(next.tier.name)} (−${pct(next.tier.discount)}).`;
      notes.push(
        `<p class="pool-note">${msg} <button type="button" data-bump="${esc(target)}" data-add="${add}">Add ${num.format(add)}</button></p>`,
      );
    }
    return notes.length ? `<div class="pool-notes">${notes.join('')}</div>` : '';
  }

  function renderCart() {
    const cart = priced();
    $('#cart-count').textContent = num.format(state.cart.length);
    const el = $('#cart');
    const submit = $('#quote-form [type="submit"]');
    submit.disabled = !cart.lines.length;

    if (!cart.lines.length) {
      el.innerHTML = emptyCartHtml();
      return;
    }

    const lines = cart.lines
      .map((l) => {
        const p = byId[l.productId];
        const tier = P.TIERS[l.tier];
        return `
        <div class="cart-line">
          <div class="cart-line__thumb">${Bottle.render(bottleOpts(p, l.body, l.cap, false))}</div>
          <div>
            <div class="cart-line__name">${esc(productTitle(p))}</div>
            <div class="cart-line__opts">${esc(bodyById[l.body].name)} body · ${esc(capById[l.cap].name)} cap</div>
          </div>
          <div>
            <div class="cart-line__total">${cents(l.total)}</div>
            <div class="cart-line__unit">${milli(l.unit)}/unit${tier.discount ? ` · ${esc(tier.name)}` : ''}</div>
          </div>
          <div class="cart-line__controls">
            <div class="stepper stepper--sm">
              <button type="button" class="stepper__btn" data-step="-1" data-key="${esc(l.key)}" aria-label="One case fewer">−</button>
              <input type="number" inputmode="numeric" value="${l.qty}" step="${p.caseSize}" min="${p.caseSize}" data-qty="${esc(l.key)}" aria-label="Quantity of ${esc(productTitle(p))}, ${esc(bodyById[l.body].name)} body, ${esc(capById[l.cap].name)} cap">
              <button type="button" class="stepper__btn" data-step="1" data-key="${esc(l.key)}" aria-label="One case more">+</button>
            </div>
            <span class="muted" style="font-size:.8rem">${num.format(l.qty / p.caseSize)} × ${num.format(p.caseSize)}</span>
            <button type="button" class="cart-line__remove" data-edit="${esc(l.key)}">Edit</button>
            <button type="button" class="cart-line__remove" style="margin-left:0" data-remove="${esc(l.key)}">Remove</button>
          </div>
        </div>`;
      })
      .join('');

    el.innerHTML = `
      ${lines}
      ${poolNotes(cart)}
      <dl class="totals">
        <dt>${num.format(cart.units)} units · subtotal excl. VAT</dt><dd>${cents(cart.subtotal)}</dd>
        ${cart.savings > 0 ? `<dt class="is-good">Volume savings</dt><dd class="is-good">−${cents(cart.savings)}</dd>` : ''}
        <dt>VAT ${pct(CONFIG.vatRate)}</dt><dd>${cents(cart.vat)}</dd>
        <dt class="is-total">Total</dt><dd class="is-total">${cents(cart.total)}</dd>
      </dl>
      <div class="cart-actions">
        <a class="btn btn--quiet btn--sm" href="#catalog">+ Add another bottle</a>
        <button class="btn btn--quiet btn--sm" type="button" data-clear>Clear quote</button>
      </div>`;
  }

  function initCart() {
    renderCart();
    const el = $('#cart');
    let lastRemoved = null;
    const find = (key) => state.cart.find((l) => l.key === key);
    const commit = () => {
      saveCart();
      renderCart();
    };

    el.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.step) {
        const line = find(t.dataset.key);
        const size = byId[line.productId].caseSize;
        const next = line.qty + Number(t.dataset.step) * size;
        if (next < size) return;
        line.qty = P.normalizeQty(next, size);
        commit();
        $(`[data-key="${CSS.escape(line.key)}"][data-step="${t.dataset.step}"]`).focus();
      } else if (t.dataset.remove) {
        const line = find(t.dataset.remove);
        state.cart = state.cart.filter((l) => l !== line);
        commit();
        toast(`Removed ${esc(productTitle(byId[line.productId]))}. <a href="#" data-undo>Undo</a>`);
        lastRemoved = line;
      } else if (t.dataset.edit) {
        const line = find(t.dataset.edit);
        state.cart = state.cart.filter((l) => l !== line);
        commit();
        openConfigurator(line.productId, line);
        // Put the line back if the dialog is dismissed without adding.
        $('#configurator').addEventListener(
          'close',
          () => {
            if (!cfg.added && !find(line.key)) {
              state.cart.push(line);
              commit();
            }
          },
          { once: true },
        );
      } else if (t.dataset.bump) {
        const line = find(t.dataset.bump);
        line.qty = P.normalizeQty(line.qty + Number(t.dataset.add), byId[line.productId].caseSize);
        commit();
      } else if (t.hasAttribute('data-clear')) {
        if (window.confirm('Remove everything from your quote?')) {
          state.cart = [];
          commit();
        }
      }
    });

    el.addEventListener('change', (e) => {
      const key = e.target.dataset.qty;
      if (!key) return;
      const line = find(key);
      line.qty = P.normalizeQty(e.target.value, byId[line.productId].caseSize);
      commit();
    });

    // Undo link inside the toast.
    $('#toast').addEventListener('click', (e) => {
      if (!e.target.closest('[data-undo]')) return;
      e.preventDefault();
      if (lastRemoved && !find(lastRemoved.key)) {
        state.cart.push(lastRemoved);
        lastRemoved = null;
        commit();
        $('#toast').classList.remove('is-visible');
      }
    });

    // Keep tabs in sync.
    window.addEventListener('storage', (e) => {
      if (e.key !== 'bd-cart') return;
      state.cart = loadCart();
      renderCart();
    });
  }

  /* ---------- Volume calculator ---------- */
  const RANGE_MIN = 100;
  const RANGE_MAX = 20000;
  const toQty = (v) => RANGE_MIN * Math.pow(RANGE_MAX / RANGE_MIN, v / 1000);
  const toRange = (q) => Math.round((1000 * Math.log(q / RANGE_MIN)) / Math.log(RANGE_MAX / RANGE_MIN));

  function initCalculator() {
    const select = $('#calc-product');
    const range = $('#calc-range');
    select.innerHTML = PRODUCTS.map((p) => `<option value="${p.id}">${esc(productTitle(p))}</option>`).join('');
    select.value = 'unicorn-60';
    range.value = toRange(450);

    function update() {
      const p = byId[select.value];
      const qty = P.normalizeQty(toQty(Number(range.value)), p.caseSize);
      const tierIdx = P.tierIndex(qty);
      const unit = P.unitMilli(p.base, qty);
      const total = P.lineCents(unit, qty);
      const saved = P.lineCents(P.baseMilli(p.base), qty) - total;

      $('#calc-qty').textContent = num.format(qty);
      range.setAttribute('aria-valuetext', `${num.format(qty)} units`);
      $('#calc-unit').textContent = milli(unit);
      $('#calc-total').textContent = cents(total);
      $('#calc-save').textContent = saved > 0 ? cents(saved) : '—';

      const next = P.nextTier(qty);
      if (next) {
        const target = P.qtyForMin(next.tier.min, p.caseSize);
        const nextTotal = P.lineCents(P.unitMilli(p.base, target), target);
        $('#calc-hint').innerHTML =
          nextTotal <= total
            ? `<strong>Price break:</strong> ${num.format(target)} units costs ${cents(nextTotal)} — ${cents(total - nextTotal)} less than ${num.format(qty)}.`
            : `${num.format(target - qty)} more units reaches <strong>${esc(next.tier.name)}</strong> at ${milli(P.unitMilli(p.base, target))} per unit.`;
      } else {
        $('#calc-hint').innerHTML = `You're at the <strong>${esc(P.TIERS[tierIdx].name)}</strong> tier — the lowest unit price.`;
      }

      const list = P.baseMilli(p.base);
      $('#calc-chart').innerHTML = P.TIERS.map((t, i) => {
        const u = P.unitMilli(p.base, t.min);
        const at = P.qtyForMin(t.min, p.caseSize);
        return `
          <button type="button" role="listitem" class="bar${i === tierIdx ? ' is-active' : ''}" data-qty="${at}" aria-label="${esc(t.name)}: ${milli(u)} per unit from ${num.format(at)} units">
            <span class="bar__price">${milli(u)}</span>
            <span class="bar__track"><span class="bar__fill" style="height:${((u / list) * 100).toFixed(1)}%">${t.discount ? `<span class="bar__off">−${pct(t.discount)}</span>` : ''}</span></span>
            <span class="bar__name">${esc(t.name)}</span>
            <span class="bar__min">${num.format(at)}+</span>
          </button>`;
      }).join('');
    }

    select.addEventListener('change', update);
    range.addEventListener('input', update);
    $('#calc-chart').addEventListener('click', (e) => {
      const bar = e.target.closest('[data-qty]');
      if (!bar) return;
      range.value = toRange(Math.max(RANGE_MIN, Number(bar.dataset.qty)));
      update();
    });
    update();
  }

  /* ---------- Quote document ---------- */
  function quoteRef(now) {
    const ymd = now.toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
    return `BD-${ymd}-${rand}`;
  }

  function quoteData(form) {
    const f = new FormData(form);
    const get = (k) => String(f.get(k) || '').trim();
    const now = new Date();
    const valid = new Date(now.getTime() + CONFIG.quoteValidityDays * 864e5);
    return {
      ref: quoteRef(now),
      date: dateFmt.format(now),
      valid: dateFmt.format(valid),
      name: get('name'),
      company: get('company'),
      email: get('email'),
      phone: get('phone'),
      country: get('country'),
      vat: get('vat'),
      notes: get('notes'),
      labels: f.get('labels') === 'on',
      cart: priced(),
    };
  }

  function quoteHtml(q) {
    const rows = q.cart.lines
      .map((l) => {
        const p = byId[l.productId];
        return `<tr>
          <td><strong>${esc(productTitle(p))}</strong><br><span class="muted">${esc(bodyById[l.body].name)} body · ${esc(capById[l.cap].name)} cap · ${esc(P.TIERS[l.tier].name)} tier</span></td>
          <td class="num">${num.format(l.qty)}</td>
          <td class="num">${milli(l.unit)}</td>
          <td class="num">${cents(l.total)}</td>
        </tr>`;
      })
      .join('');
    const contact = [q.company, q.email, q.phone, q.country, q.vat && `VAT ${q.vat}`].filter(Boolean).map(esc).join('<br>');
    return `
      <div class="doc__head">
        <div>
          <p class="eyebrow">Quote request</p>
          <h2 id="doc-title">${esc(CONFIG.businessName)}</h2>
        </div>
        <p class="doc__meta"><strong>${esc(q.ref)}</strong><br>${esc(q.date)}<br>Valid until ${esc(q.valid)}</p>
      </div>
      <div class="doc__parties">
        <div><h3>Prepared for</h3><p><strong>${esc(q.name)}</strong><br>${contact}</p></div>
        <div><h3>Supplier</h3><p><strong>${esc(CONFIG.businessName)}</strong><br>${esc(CONFIG.quoteEmail)}</p></div>
      </div>
      <table>
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="3">Subtotal excl. VAT</td><td class="num">${cents(q.cart.subtotal)}</td></tr>
          ${q.cart.savings > 0 ? `<tr><td colspan="3">Includes volume savings of</td><td class="num">${cents(q.cart.savings)}</td></tr>` : ''}
          <tr><td colspan="3">VAT ${pct(CONFIG.vatRate)}</td><td class="num">${cents(q.cart.vat)}</td></tr>
          <tr class="is-total"><td colspan="3">Total</td><td class="num">${cents(q.cart.total)}</td></tr>
        </tfoot>
      </table>
      <div class="doc__notes">
        ${q.labels ? '<p><strong>Interested in custom printed labels.</strong></p>' : ''}
        ${q.notes ? `<p><strong>Notes:</strong> ${esc(q.notes).replace(/\n/g, '<br>')}</p>` : ''}
        <p class="fineprint">Prices exclude shipping. Colour availability, shipping and delivery timing are confirmed in our reply.</p>
      </div>`;
  }

  function quoteText(q) {
    const out = [
      `Quote request ${q.ref}`,
      `Date: ${q.date} · Valid until: ${q.valid}`,
      '',
      `From: ${q.name}${q.company ? `, ${q.company}` : ''}`,
      `Email: ${q.email}`,
    ];
    if (q.phone) out.push(`Phone: ${q.phone}`);
    out.push(`Country: ${q.country}`);
    if (q.vat) out.push(`VAT number: ${q.vat}`);
    out.push('', 'Items:');
    for (const l of q.cart.lines) {
      const p = byId[l.productId];
      out.push(
        `- ${num.format(l.qty)} × ${productTitle(p)}, ${bodyById[l.body].name} body / ${capById[l.cap].name} cap @ ${milli(l.unit)} = ${cents(l.total)} (${P.TIERS[l.tier].name} tier)`,
      );
    }
    out.push('', `Subtotal excl. VAT: ${cents(q.cart.subtotal)}`);
    if (q.cart.savings > 0) out.push(`Volume savings: ${cents(q.cart.savings)}`);
    out.push(`VAT ${pct(CONFIG.vatRate)}: ${cents(q.cart.vat)}`, `Total: ${cents(q.cart.total)}`);
    if (q.labels) out.push('', 'Interested in custom printed labels.');
    if (q.notes) out.push('', `Notes: ${q.notes}`);
    return out.join('\n');
  }

  function validate(form) {
    let firstBad = null;
    const rules = {
      name: (v) => (v.trim() ? '' : 'Please tell us your name.'),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Please enter a valid email address.'),
      country: (v) => (v ? '' : 'Please choose a country.'),
    };
    for (const name of Object.keys(rules)) {
      const input = form.elements[name];
      const msg = rules[name](input.value);
      const field = input.closest('.field');
      field.classList.toggle('is-invalid', Boolean(msg));
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      field.querySelector('.field__error').textContent = msg;
      if (msg && !firstBad) firstBad = input;
    }
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  function initQuote() {
    const form = $('#quote-form');
    const dialog = $('#quote-dialog');
    let current = null;

    const saved = store.get('bd-contact', null);
    if (saved && typeof saved === 'object') {
      for (const k of ['name', 'company', 'email', 'phone', 'country', 'vat']) {
        if (typeof saved[k] === 'string' && form.elements[k]) form.elements[k].value = saved[k];
      }
    }

    form.addEventListener('input', (e) => {
      const field = e.target.closest('.field.is-invalid');
      if (field) {
        field.classList.remove('is-invalid');
        field.querySelector('.field__error').textContent = '';
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!state.cart.length || !validate(form)) return;
      current = quoteData(form);
      store.set('bd-contact', {
        name: current.name,
        company: current.company,
        email: current.email,
        phone: current.phone,
        country: current.country,
        vat: current.vat,
      });
      $('#quote-doc').innerHTML = quoteHtml(current);
      $('#doc-email').href =
        `mailto:${CONFIG.quoteEmail}?subject=${encodeURIComponent(`Quote request ${current.ref}`)}&body=${encodeURIComponent(quoteText(current))}`;
      dialog.showModal();
    });

    $('#doc-print').addEventListener('click', () => {
      const root = document.documentElement;
      $('#print-area').innerHTML = `<div class="doc">${$('#quote-doc').innerHTML}</div>`;
      root.classList.add('is-printing');
      window.addEventListener('afterprint', () => root.classList.remove('is-printing'), { once: true });
      window.print();
    });

    $('#doc-copy').addEventListener('click', async () => {
      const text = quoteText(current);
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = text;
        dialog.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      toast('Quote copied to your clipboard.');
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }

  /* ---------- Boot ---------- */
  initTheme();
  initTopbar();
  initHero();
  initCatalog();
  initConfigurator();
  initCart();
  initCalculator();
  initQuote();
})();
