# Bokito's Dealer homepage redesign

A static prototype of a redesigned homepage for bokitosdealer.com. Open `index.html` in a browser; it needs no build step.

The product names, prices, MOQs, colour counts, stock status and volume tiers are real. They come from the live catalogue as of 3 October 2026. All imagery is the site's own. Forms are not connected to anything.

- `index.html`: the prototype (one file, inline CSS and JS)
- `assets/`: logo, section photos and 20 product images
- `screenshots/`: before/after comparisons and full-page captures

## Fix these on the live site first (no redesign needed)

1. **`www.bokitosdealer.com` is broken.** It shows Lovable's "Project not found / DNS not properly configured" page. DNS resolves to Lovable correctly, but the `www` domain isn't connected to the project. The site's canonical URL, `og:url` and all structured data point to `www`, so Google is being sent to the broken page. Fix: in Lovable, go to Project → Settings → Domains, add `www.bokitosdealer.com` and make one of the two hosts redirect to the other.
2. **The "Save up to X%" badges and struck-through prices are made up.** `fakeDiscount.ts` derives the percentage from a hash of the SKU (always 18–52%) and back-calculates a "was" price. No real previous price exists. Misleading-pricing rules apply to B2B advertising too, and a buyer who notices will stop trusting your other numbers. The real volume tiers often show a *bigger* saving (10 ml Unicorn V3: €0.12 → €0.07, −42%), so the redesign uses those.
3. **Three of the twelve homepage "bestsellers" are out of stock** (the Spiral shot bottles, 30/60/100 ml). The redesign only features in-stock products.

## What the redesign changes

| Area | Live site | Redesign |
|---|---|---|
| Hero | "Packaging your e-liquid brand can trust?": a question, aimed at vape only, grey text over a busy photo | States what you sell, for whom and why it's better: *Child-resistant packaging, in stock in Europe*. Covers all industries |
| Proof | Strong claims (EU stock, EN ISO 8317, no import duty) only on inner pages | Trust strip right under the hero, plus an "EU stock vs. importing yourself" comparison |
| Navigation | Product grids repeated by format | Shop by product type (with sizes and sub-ranges), then a tabbed bestseller grid |
| Product cards | ALL-CAPS names, fake discounts, no MOQ | Readable names, honest "up to −X% at volume", MOQ, and the best tier price on every card |
| Pricing | Tiers only on product pages | Interactive volume calculator: unit price, total, saving, and "add N units to reach the next tier" |
| Samples | Hidden in a pop-up | A full section with an inline request form; this is your best lead magnet |
| Industries | Footer links only | Six industry entry points linking to your existing landing pages |
| Compliance | Footer link | PPWR (in force since 12 Aug 2026), EN ISO 8317 and documents-on-request cards |
| FAQ | Separate page | The seven questions B2B buyers ask first, answered on the homepage |
| Mobile | Cookie bar covers half the hero | Compact cookie card, search in the hero, sticky "Free samples / Get a quote" bar after the hero |
| Accessibility | Low-contrast subtitle, letter-spaced caps | Higher contrast, skip link, visible focus, keyboard tabs, reduced-motion support |

All copy claims come from the site's own pages: same or next business day dispatch, tracked and insured shipping, Dutch VAT invoice, direct manufacturer sourcing, documents on request, and a reply within one business day for samples.

## Porting it to the live (Lovable) site

The live site is React, Tailwind and Supabase, built in Lovable. This repo only had a placeholder `index.html`. Each section here maps to a component, and all the data already exists in the `products`, `product_variants` and `v_product_tiers` tables. The calculator only needs `v_product_tiers`.
