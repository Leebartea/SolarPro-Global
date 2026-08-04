'use strict';
/** Shared project layout + small parsing helpers used by several checks. */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

/** Every shippable page, in nav order. */
const PAGES = [
  'index.html',
  'pages/services.html',
  'pages/calculator.html',
  'pages/portfolio.html',
  'pages/about.html',
  'pages/contact.html',
];

/** Pages plus the buyer documentation, which also has to be defect-free. */
const ALL_HTML = [...PAGES, 'docs/documentation.html'];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const abs = (rel) => path.join(ROOT, rel);

/**
 * Every class token referenced by `class="..."` in a document.
 * Returns a Map of class -> Set of "file:line" sites, so a failure can point
 * at the exact place to fix rather than just naming the class.
 */
function classesUsed(rel) {
  const out = new Map();
  const lines = read(rel).split('\n');
  lines.forEach((line, i) => {
    // Skip escaped markup inside the documentation's code samples.
    const re = /\bclass="([^"]*)"/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      for (const cls of m[1].split(/\s+/)) {
        if (!cls) continue;
        if (!out.has(cls)) out.set(cls, new Set());
        out.get(cls).add(`${rel}:${i + 1}`);
      }
    }
  });
  return out;
}

/**
 * Every class selector defined in a stylesheet.
 *
 * Tailwind escapes characters that are illegal in a CSS identifier, so the
 * class `sm:px-6` is emitted as `.sm\:px-6` and `mt-0.5` as `.mt-0\.5`. The
 * selector pattern therefore has to accept backslash escapes and unescape
 * them, otherwise every responsive and fractional utility reads as undefined.
 */
function classesDefined(rel) {
  const css = read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')      // strip comments
    .replace(/\{[^{}]*\}/g, '{}');          // strip declaration bodies
  const out = new Set();
  const re = /\.((?:\\.|[-\w])+)/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    out.add(m[1].replace(/\\(.)/g, '$1'));
  }
  return out;
}

/** Absolute http(s) URLs referenced from a document, with their line numbers. */
function externalUrls(rel) {
  const out = [];
  read(rel).split('\n').forEach((line, i) => {
    const re = /\b(?:src|href)\s*=\s*"(https?:\/\/[^"]+)"/gi;
    let m;
    while ((m = re.exec(line)) !== null) {
      out.push({ url: m[1], where: `${rel}:${i + 1}` });
    }
  });
  return out;
}

const host = (url) => {
  try { return new URL(url).host; } catch { return null; }
};

module.exports = { ROOT, PAGES, ALL_HTML, read, exists, abs, classesUsed, classesDefined, externalUrls, host };
