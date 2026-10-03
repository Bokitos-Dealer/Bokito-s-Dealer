# Bokito's Dealer

A storefront and quote builder for Chubby Gorilla bottles. It is plain HTML, CSS and JavaScript, with no build step and no backend, so it runs on GitHub Pages or any static host. You can also open `index.html` directly in a browser.

## What it does

- **Live bottle configurator.** Pick a bottle body and cap colour and the SVG preview redraws instantly. Bottles are drawn in code at believable relative sizes, so there are no product photos to manage.
- **Volume-tier pricing.** Unit prices drop at 500, 1,000, 5,000 and 10,000 units. A product's tier is set by its *combined* quantity across all colour combinations, so customers can mix colours without losing their discount.
- **Smart nudges.** The configurator and the quote show how many more units unlock the next tier. They also flag the case where ordering *more* costs *less* in total.
- **Quote builder.** The selection is saved in the browser and syncs across tabs. Quantities round to whole cases, and removals can be undone.
- **Quote document.** Each quote gets a number and can be emailed (pre-filled `mailto:`), printed or saved as a PDF (print stylesheet), or copied as plain text.
- **Light and dark themes**, responsive down to 320px, keyboard accessible, and respects reduced-motion settings.

## Making it yours

All shop data lives in [`js/catalog.js`](js/catalog.js):

| Setting | What to change |
| --- | --- |
| `CONFIG.quoteEmail` | **Set this first.** It's where "Email this quote" sends to (currently a placeholder). |
| `PRODUCTS[].base` | Unit price excl. VAT at the lowest tier. **The current prices are placeholders.** |
| `PRODUCTS[].caseSize` | Units per case; also the minimum order. |
| `BODY_COLORS`, `CAP_COLORS` | The colour options offered. |
| `CONFIG.vatRate`, `CONFIG.quoteValidityDays` | VAT rate shown on quotes, and how long a quote stays valid. |

Tier thresholds and discounts are in [`js/pricing.js`](js/pricing.js) (`TIERS`).

## Project layout

```
index.html         page structure
css/styles.css     design tokens, layout, dark mode, print styles
js/catalog.js      products, colours and shop settings
js/pricing.js      tier pricing (integer money maths, no float drift)
js/bottle.js       SVG bottle renderer
js/app.js          UI: catalog, configurator, calculator, quote
tests/             unit tests for pricing and catalog data
```

## Development

```sh
npm start   # serve on http://localhost:8080
npm test    # run the unit tests (Node 18+)
```

## Publishing on GitHub Pages

Settings → Pages → Deploy from a branch → `main` / root.
