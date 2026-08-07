'use strict';
/**
 * Application-security checks for a static template.
 *
 * The threat model is small but real, and it is not "someone attacks the demo".
 * It is: this template is copied onto a few hundred small installers' domains,
 * where it collects names, phone numbers and site addresses through a contact
 * form, and nobody in that chain will ever run a security review. Anything
 * unsafe here is unsafe in every one of those deployments, and the buyer has no
 * way to find out.
 *
 * So this checks the handful of things that actually bite a static site:
 * DOM-XSS sinks, reverse tabnabbing, inline handlers, unguarded storage access,
 * and the response headers that mitigate what is left.
 *
 * What it does NOT do is pretend to be a scanner. There is no server, no
 * database, no authentication and no dependency tree to audit — claiming a
 * broader guarantee than that would be the same failure as a contrast check
 * guessing at text over a photograph.
 */

const { Report } = require('../lib/report');
const { PAGES, read, exists } = require('../lib/project');

const JS = ['js/main.js', 'js/theme.js', 'js/calculator.js'];

/** Sinks that turn a string into markup or code. */
const SINKS = [
  [/\beval\s*\(/, 'eval() executes arbitrary strings as code'],
  [/\bnew\s+Function\s*\(/, 'new Function() is eval by another name'],
  [/\bdocument\.write\s*\(/, 'document.write() injects unparsed markup'],
  [/\binsertAdjacentHTML\s*\(/, 'insertAdjacentHTML() parses its argument as HTML'],
  [/\bouterHTML\s*=/, 'outerHTML assignment parses its argument as HTML'],
  [/setTimeout\s*\(\s*['"`]/, 'setTimeout with a string argument is eval'],
  [/setInterval\s*\(\s*['"`]/, 'setInterval with a string argument is eval'],
];

/**
 * `innerHTML =` is allowed only where the assigned value cannot carry input:
 * the empty string, or a lookup in a frozen literal table. Anything else has
 * to be justified in code review, so it fails here.
 */
const INNER_HTML_SAFE = [
  /innerHTML\s*=\s*['"`]{2}\s*;/,          // clearing
  /innerHTML\s*=\s*THEME_ICONS\[[\w.]+\]/, // fixed icon table, validated key
];

/** Header directives the deploy must set. */
const REQUIRED_HEADERS = [
  ['X-Content-Type-Options: nosniff', 'stops MIME sniffing turning an upload into script'],
  ['X-Frame-Options', 'clickjacking'],
  ['Referrer-Policy', 'leaks the visitor’s page to third parties'],
  ['Content-Security-Policy', 'the main mitigation for injected remote script'],
  ['Permissions-Policy', 'denies camera/microphone/geolocation by default'],
];

const REQUIRED_CSP = [
  ["default-src 'self'", 'the deny-by-default base'],
  ["object-src 'none'", 'blocks plugin-based injection, which needs no inline execution'],
  ["base-uri 'self'", 'stops an injected <base> rewriting every relative URL'],
  ['frame-ancestors', 'clickjacking, the modern form'],
];

module.exports = async function security() {
  const report = new Report('Security — DOM sinks, tabnabbing, storage and headers');
  let checked = 0;

  /* ── 1. Dangerous sinks in the shipped JavaScript ─────────────────────── */
  for (const file of JS) {
    if (!exists(file)) continue;
    const src = read(file);
    src.split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments describe, not execute
      for (const [re, why] of SINKS) {
        checked++;
        if (re.test(line)) report.error(`${why}`, `${file}:${i + 1}`);
      }
      if (/innerHTML\s*=/.test(line)) {
        checked++;
        if (!INNER_HTML_SAFE.some((ok) => ok.test(line))) {
          report.error(
            'innerHTML assigned something other than a constant — use textContent, ' +
            'or createElement, so a value can never be parsed as markup',
            `${file}:${i + 1}`,
          );
        }
      }
    });
  }

  /* ── 2. Storage access must be guarded ────────────────────────────────────
   * Safari in private mode and any browser with site data blocked THROW on
   * localStorage access. Unguarded, that is an uncaught exception on every
   * page load — which is both a console error a marketplace reviewer will
   * flag, and a script that stops executing partway through. Shipped broken
   * in js/theme.js until v1.6.0. */
  for (const file of JS) {
    if (!exists(file)) continue;
    const lines = read(file).split('\n');
    lines.forEach((line, i) => {
      if (!/localStorage\.(get|set|remove)Item/.test(line)) return;
      // A comment explaining the rule is not a violation of it. theme.js
      // documents the exact bug this catches, and matched itself.
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      checked++;
      const window_ = lines.slice(Math.max(0, i - 6), i + 1).join('\n');
      if (!/\btry\s*\{/.test(window_)) {
        report.error(
          'localStorage accessed outside try/catch — throws when site data is ' +
          'blocked, and the surrounding script then stops running',
          `${file}:${i + 1}`,
        );
      }
    });
  }

  /* ── 3. Reverse tabnabbing and inline handlers ────────────────────────── */
  for (const page of PAGES) {
    if (!exists(page)) continue;
    const lines = read(page).split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)) {
        checked++;
        if (!/rel=["'][^"']*noopener/i.test(m[0])) {
          report.error(
            'target="_blank" without rel="noopener" — the opened page gets a ' +
            'handle on window.opener and can navigate this tab to a phishing page',
            `${page}:${i + 1}`,
          );
        }
      }
      /* Inline handlers are not a vulnerability on their own, but every one of
       * them is a reason the CSP can never drop 'unsafe-inline' for scripts. */
      for (const m of line.matchAll(/\son(click|error|load|submit|mouseover|focus)\s*=/gi)) {
        checked++;
        report.error(
          `inline on${m[1]} handler — move it to js/main.js so no behaviour ` +
          "depends on 'unsafe-inline' in the CSP",
          `${page}:${i + 1}`,
        );
      }
    });
  }

  /* ── 4. Non-HTTPS absolute URLs ───────────────────────────────────────── */
  for (const page of [...PAGES, 'docs/documentation.html']) {
    if (!exists(page)) continue;
    read(page).split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/["'](http:\/\/[^"']+)["']/g)) {
        checked++;
        // XML namespaces are identifiers, not URLs that get fetched.
        if (/w3\.org\/(2000\/svg|1999\/xhtml|1999\/xlink)/.test(m[1])) continue;
        report.error(`plain-HTTP URL ${m[1]} — mixed content, and downgradeable`, `${page}:${i + 1}`);
      }
    });
  }

  /* ── 5. Response headers on the deployed build ────────────────────────── */
  const headersFile = ['dist/_headers', '_headers'].find((f) => exists(f));
  checked++;
  if (!headersFile) {
    report.warn(
      'no _headers file — run `npm run build` first; headers are emitted into dist/',
      'scripts/build-dist.js',
    );
  } else {
    const h = read(headersFile);
    for (const [directive, why] of REQUIRED_HEADERS) {
      checked++;
      if (!h.includes(directive)) report.error(`missing header ${directive} — ${why}`, headersFile);
    }
    if (h.includes('Content-Security-Policy')) {
      for (const [directive, why] of REQUIRED_CSP) {
        checked++;
        if (!h.includes(directive)) {
          report.error(`CSP is missing ${directive} — ${why}`, headersFile);
        }
      }
    }
  }

  report.counted(checked);
  return report;
};
