'use strict';
/**
 * Markup validity — the subset of W3C conformance that can be enforced offline.
 *
 * WHY THIS EXISTS.
 * Envato requires that "your code is validated". Running every page through
 * https://validator.w3.org/nu/ found 26 errors in four classes across the nine
 * pages, and every one of them was invisible: the pages rendered correctly, the
 * eleven other checks were green, and nothing errored in a console. That is the
 * signature of a defect that reaches a marketplace reviewer instead of you.
 *
 * This check is NOT a validator. A real one is a 20 MB Java binary or a network
 * round trip, and neither belongs in a release gate that has to run offline in
 * seconds. It encodes the four classes that were actually found, so they cannot
 * return, and says so plainly rather than implying full conformance:
 *
 *   1. Unencoded `<`, `>` and non-ASCII in a `data:` URI. The favicon's inline
 *      SVG was pasted raw into href on all nine pages.
 *   2. `aria-label` on a <div> with no role. ARIA forbids a name on a generic
 *      element — the label is silently dropped by assistive technology, so the
 *      markup was both invalid AND doing nothing.
 *   3. A heading inside role="button". That role takes presentational children,
 *      so the nine portfolio cards' <h3> titles were erased from the a11y tree.
 *   4. A skipped heading level (h1 -> h3).
 *
 * The rule for adding to this file: only add a pattern the Nu validator has
 * actually rejected on this template. A guessed rule that fires on valid markup
 * costs more than the error it imagines it is preventing.
 *
 * Re-run the real validator before any marketplace submission — this check
 * narrows what that run can find; it does not replace it. The command is in
 * `Revenue Plan/09-themeforest/THEMEFOREST-GUIDE.md` §4.2.
 */

const { Report } = require('../lib/report');
const { PAGES, exists, read } = require('../lib/project');

/** Attribute values that are URLs, and so must be percent-encoded. */
const URL_ATTR = /\b(?:href|src|content)\s*=\s*"(data:[^"]*)"/gi;

/** Every opening tag, with its attribute text. */
const OPEN_TAG = /<([a-z][a-z0-9-]*)((?:\s+[^<>]*?)?)\/?>/gi;

/** Characters that are never legal raw in a URI. */
const ILLEGAL_IN_URI = /[<>"\s`{}|\\^]|[^\x00-\x7F]/;

/**
 * Roles whose children are presentational — ARIA erases anything inside them,
 * so a heading (or any other structure) there is both invalid and invisible.
 */
const PRESENTATIONAL_CHILD_ROLES = ['button', 'checkbox', 'radio', 'switch', 'tab', 'option'];

/** Strip comments, scripts and styles so their contents are never matched. */
function markup(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
}

/** 1-based line number of an index into a string. */
function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

/**
 * The content of an element, from `start` to its MATCHING close tag.
 *
 * Depth-counted on purpose. The first version took the next `</div>`, which for
 * a portfolio card — a div of nested divs — closes 787 characters in, two levels
 * early and well before the <h3> being looked for. Measured, not assumed: put
 * role="button" back on a card and the naive slice reports no heading. A check
 * that scans the wrong region returns PASS with total confidence, which is the
 * failure mode this whole gate exists to prevent.
 */
function innerHtml(src, tag, start) {
  const scan = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'gi');
  scan.lastIndex = start;
  let depth = 1;
  let m;
  while ((m = scan.exec(src)) !== null) {
    if (m[2] === '/') continue;          // self-closing: no depth change
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) return src.slice(start, m.index);
  }
  return src.slice(start);               // unclosed — inspect to end of file
}

module.exports = async function markupValidity() {
  const report = new Report('Markup validity — the W3C errors that have bitten, cannot return');
  let inspected = 0;

  for (const rel of PAGES) {
    if (!exists(rel)) continue;
    const raw = read(rel);
    const src = markup(raw);

    // ---- 1. data: URIs must be percent-encoded ----------------------------
    for (const m of src.matchAll(URL_ATTR)) {
      inspected++;
      if (ILLEGAL_IN_URI.test(m[1])) {
        report.error(
          `data: URI is not percent-encoded — "<", ">" and non-ASCII must be ` +
          `escaped (line ${lineOf(src, m.index)})`, rel);
      }
    }

    // ---- 2 & 3. ARIA on the wrong element ---------------------------------
    for (const m of src.matchAll(OPEN_TAG)) {
      const [, tag, attrs = ''] = m;
      inspected++;

      const roleMatch = attrs.match(/\brole\s*=\s*"([^"]*)"/i);
      const role = roleMatch ? roleMatch[1].trim().toLowerCase() : null;
      const named = /\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs);

      // A generic element cannot carry an accessible name.
      if (named && !role && /^(div|span)$/i.test(tag)) {
        report.error(
          `<${tag}> has aria-label but no role — ARIA drops the name on a ` +
          `generic element (line ${lineOf(src, m.index)})`, rel);
      }

      // A role with presentational children must not wrap structure.
      if (role && PRESENTATIONAL_CHILD_ROLES.includes(role)) {
        const inner = innerHtml(src, tag, m.index + m[0].length);
        const heading = inner.match(/<h[1-6]\b/i);
        if (heading) {
          report.error(
            `role="${role}" contains ${heading[0]}> — that role takes ` +
            `presentational children, so the heading is erased from the ` +
            `accessibility tree (line ${lineOf(src, m.index)})`, rel);
        }
      }
    }

    // ---- 4. Heading levels must not skip ----------------------------------
    // Footers and navs repeat a level legitimately; only a jump DOWN the
    // document by more than one is an error.
    let previous = 0;
    for (const m of src.matchAll(/<h([1-6])\b/gi)) {
      const level = Number(m[1]);
      inspected++;
      if (previous && level > previous + 1) {
        report.error(
          `heading level jumps h${previous} -> h${level}, skipping a level ` +
          `(line ${lineOf(src, m.index)})`, rel);
      }
      previous = level;
    }
  }

  return report.counted(inspected);
};
