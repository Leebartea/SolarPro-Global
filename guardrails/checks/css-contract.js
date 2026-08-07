'use strict';
/**
 * CSS contract: every class the markup uses must actually be defined
 * somewhere — in custom.css, or in the compiled Tailwind stylesheet.
 *
 * This is the check that would have caught the v1.0 defect where all 33
 * primary buttons carried `btn-primary` without the base `.btn` layout, and
 * all 23 section labels used `.section-tag` while the stylesheet defined
 * `.stag`. Neither produced an error anywhere: the elements simply rendered
 * as unstyled blocks, and the template shipped that way.
 */

const { Report } = require('../lib/report');
const { PAGES, assertPagesComplete, exists, classesUsed, classesDefined } = require('../lib/project');

// Classes applied only by JavaScript at runtime, so they legitimately appear
// in a stylesheet or script without ever being in static markup, or vice versa.
const RUNTIME_CLASSES = new Set([
  'aos-animate', 'aos-init', 'active', 'open', 'show', 'hidden-item',
  'dark', 'light', 'is-visible', 'filtered-out',
]);

module.exports = function cssContract() {
  const report = new Report('CSS contract — no class used without a definition');

  const stylesheets = ['css/custom.css', 'css/tailwind.min.css'].filter(exists);
  if (!stylesheets.includes('css/tailwind.min.css')) {
    report.error(
      'css/tailwind.min.css is missing — run `npm run build:css` before releasing',
      'css/');
    return report;
  }

  const defined = new Set();
  for (const sheet of stylesheets) {
    for (const cls of classesDefined(sheet)) defined.add(cls);
  }

  // Before checking classes, check that we are looking at every page at all.
  // An unlisted page is a check that reports PASS over work it never read.
  assertPagesComplete(report);

  let inspected = 0;
  const undefinedClasses = new Map(); // class -> sites

  for (const page of PAGES) {
    if (!exists(page)) {
      report.error('page missing from the package', page);
      continue;
    }
    for (const [cls, sites] of classesUsed(page)) {
      inspected++;
      if (defined.has(cls) || RUNTIME_CLASSES.has(cls)) continue;
      if (!undefinedClasses.has(cls)) undefinedClasses.set(cls, new Set());
      for (const s of sites) undefinedClasses.get(cls).add(s);
    }
  }

  report.counted(inspected);

  // Sort by blast radius: the class used in the most places matters most.
  const ranked = [...undefinedClasses.entries()]
    .sort((a, b) => b[1].size - a[1].size);

  for (const [cls, sites] of ranked) {
    const list = [...sites];
    const shown = list.slice(0, 3).join(', ');
    const more = list.length > 3 ? ` +${list.length - 3} more` : '';
    report.error(
      `class "${cls}" is used ${list.length}× but defined in no stylesheet`,
      `${shown}${more}`);
  }

  return report;
};
