'use strict';
/** Shared project layout + small parsing helpers used by several checks. */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * Every shippable page: the six nav pages first, then the pages reachable only
 * from the footer or from a server's 404 handler.
 *
 * Six of the eleven checks iterate this list rather than globbing, so a page
 * missing from it is not checked at all — it renders, it ships, and nothing
 * says otherwise. That is exactly what happened when privacy, terms and 404
 * were added: `local-assets` and `package-hygiene` picked them up because they
 * walk the tree, while contrast, responsive, cross-browser, offline-render,
 * css-contract and content-integrity silently skipped them.
 *
 * `assertPagesComplete()` below is why it cannot happen twice.
 */
const PAGES = [
  'index.html',
  'pages/services.html',
  'pages/calculator.html',
  'pages/portfolio.html',
  'pages/about.html',
  'pages/contact.html',
  'pages/privacy.html',
  'pages/terms.html',
  '404.html',
];

/**
 * Fail if any shippable HTML file is absent from PAGES.
 *
 * A hardcoded list is the right structure here — it fixes the order checks run
 * in and lets a page be deliberately excluded — but it silently under-reports
 * the moment someone adds a file and forgets. Called by css-contract, which
 * every run executes.
 */
function assertPagesComplete(report) {
  const found = ['404.html', 'index.html']
    .filter((f) => fs.existsSync(path.join(ROOT, f)))
    .concat(
      fs
        .readdirSync(path.join(ROOT, 'pages'))
        .filter((f) => f.endsWith('.html'))
        .map((f) => `pages/${f}`),
    );
  for (const f of found) {
    if (!PAGES.includes(f)) {
      report.error(
        `${f} exists but is not in PAGES — six checks would skip it entirely`,
        'guardrails/lib/project.js',
      );
    }
  }
  return found.length;
}

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

module.exports = { ROOT, PAGES, ALL_HTML, assertPagesComplete, read, exists, abs, classesUsed, classesDefined, externalUrls, host };
