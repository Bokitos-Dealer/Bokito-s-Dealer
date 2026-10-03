/*
 * Catalog data and shop settings.
 *
 * Everything a shop owner is likely to change lives in this file:
 * contact details, prices, case sizes and the available colours.
 * Prices are per unit, excluding VAT, at the lowest volume tier.
 * The values below are PLACEHOLDERS — replace them with real figures.
 */
(function (root) {
  'use strict';

  const CONFIG = {
    businessName: "Bokito's Dealer",
    quoteEmail: 'sales@example.com', // TODO: replace with the real inbox
    currency: 'EUR',
    locale: 'en-IE',
    vatRate: 0.21,
    quoteValidityDays: 14,
  };

  const LINES = {
    unicorn: {
      name: 'Unicorn',
      tagline: 'Squeezable bottles with a long, thin tip',
    },
    aviator: {
      name: 'Aviator',
      tagline: 'Flat-profile flasks that pack tight',
    },
  };

  // `translucent` bodies show the liquid inside the preview.
  const BODY_COLORS = [
    { id: 'natural', name: 'Natural', hex: '#ece6d6', opacity: 0.82, translucent: true },
    { id: 'clear', name: 'Clear', hex: '#d7e7f1', opacity: 0.4, translucent: true },
    { id: 'frosted', name: 'Frosted', hex: '#e3e8ed', opacity: 0.74, translucent: true },
    { id: 'black', name: 'Black', hex: '#1c1d20', opacity: 1, translucent: false },
  ];

  const CAP_COLORS = [
    { id: 'black', name: 'Black', hex: '#17181b' },
    { id: 'white', name: 'White', hex: '#f4f4f2' },
    { id: 'red', name: 'Red', hex: '#d62a2a' },
    { id: 'orange', name: 'Orange', hex: '#f07f1a' },
    { id: 'yellow', name: 'Yellow', hex: '#f2c919' },
    { id: 'green', name: 'Green', hex: '#2f9e44' },
    { id: 'blue', name: 'Blue', hex: '#2459d6' },
    { id: 'purple', name: 'Purple', hex: '#7b3fd1' },
    { id: 'pink', name: 'Pink', hex: '#ec4f9a' },
  ];

  const UNICORN_BLURB =
    'Squeezable LDPE bottle with a child-resistant, tamper-evident cap and a long, thin tip for clean, controlled filling.';
  const AVIATOR_BLURB =
    'Flat-sided PET flask with a child-resistant cap. The slim profile stands out on the shelf and packs efficiently.';

  const PRODUCTS = [
    { id: 'unicorn-10', line: 'unicorn', shape: 'unicorn', name: 'Unicorn Bottle', volume: 10, material: 'LDPE', caseSize: 500, base: 0.24, body: 'natural', cap: 'black', blurb: UNICORN_BLURB },
    { id: 'unicorn-15', line: 'unicorn', shape: 'unicorn', name: 'Unicorn Bottle', volume: 15, material: 'LDPE', caseSize: 500, base: 0.26, body: 'natural', cap: 'blue', blurb: UNICORN_BLURB },
    { id: 'unicorn-30', line: 'unicorn', shape: 'unicorn', name: 'Unicorn Bottle', volume: 30, material: 'LDPE', caseSize: 400, base: 0.29, body: 'clear', cap: 'red', blurb: UNICORN_BLURB },
    { id: 'unicorn-60', line: 'unicorn', shape: 'unicorn', name: 'Unicorn Bottle', volume: 60, material: 'LDPE', caseSize: 300, base: 0.34, body: 'natural', cap: 'black', blurb: UNICORN_BLURB },
    { id: 'unicorn-100', line: 'unicorn', shape: 'unicorn', name: 'Unicorn Bottle', volume: 100, material: 'LDPE', caseSize: 200, base: 0.42, body: 'frosted', cap: 'purple', blurb: UNICORN_BLURB },
    { id: 'unicorn-120', line: 'unicorn', shape: 'unicorn', name: 'Unicorn Bottle', volume: 120, material: 'LDPE', caseSize: 200, base: 0.46, body: 'black', cap: 'green', blurb: UNICORN_BLURB },
    { id: 'aviator-30', line: 'aviator', shape: 'aviator', name: 'Aviator Bottle', volume: 30, material: 'PET', caseSize: 300, base: 0.39, body: 'clear', cap: 'orange', blurb: AVIATOR_BLURB },
    { id: 'aviator-60', line: 'aviator', shape: 'aviator', name: 'Aviator Bottle', volume: 60, material: 'PET', caseSize: 200, base: 0.45, body: 'clear', cap: 'black', blurb: AVIATOR_BLURB },
  ];

  const api = { CONFIG, LINES, BODY_COLORS, CAP_COLORS, PRODUCTS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BD_CATALOG = api;
})(typeof self !== 'undefined' ? self : this);
