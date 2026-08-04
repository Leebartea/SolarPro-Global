'use strict';
/**
 * Content integrity — nothing ships that reads as unfinished or as a claim
 * the seller cannot stand behind.
 *
 * Three distinct risks:
 *
 *  1. Build notes rendered as live page copy. v1.0 shipped a paragraph on the
 *     homepage reading "Replace placeholder boxes with actual partner logos in
 *     the assets/images folder." A buyer evaluating the demo reads that as an
 *     unfinished product.
 *
 *  2. Third-party trademarks used as implied endorsements. The demo listed
 *     real inverter and module manufacturers as "Trusted Brands", and asserted
 *     certifications from real bodies. Marketplace review teams flag it, and
 *     it is a claim neither you nor the buyer can support. Public standards
 *     numbers (IEC 60364, IEC 62446) are fine — citing a standard is not
 *     claiming a relationship.
 *
 *  3. Sample testimonials and case studies that are not labelled as samples.
 */

const { Report } = require('../lib/report');
const { PAGES, exists, read } = require('../lib/project');

// Instructional copy that must never appear in rendered text.
const BUILD_NOTES = [
  /replace\s+(?:the\s+)?placeholder/i,
  /\bTODO\b/,
  /\bFIXME\b/,
  /lorem\s+ipsum/i,
  /change\s+this\s+(?:value|text)/i,
  /\byour-(?:domain|photo|link|plan|project)\b/i,
];

// Vendor and certification-body marks that imply a relationship.
const VENDOR_MARKS = [
  'Huawei', 'JA Solar', 'Victron', 'Growatt', 'Fronius', 'Pylontech',
  'SolarEdge', 'Enphase', 'LONGi', 'Jinko', 'Trina', 'EcoStruxure',
  'NABCEP', 'COREN',
];

/** Text content only — strip tags, scripts, styles and HTML comments. */
function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

module.exports = function contentIntegrity() {
  const report = new Report('Content integrity — no build notes, no borrowed credibility');
  let inspected = 0;

  for (const rel of PAGES) {
    if (!exists(rel)) continue;
    inspected++;
    const html = read(rel);
    const text = visibleText(html);

    for (const pattern of BUILD_NOTES) {
      const m = text.match(pattern);
      if (m) {
        report.error(`build note is rendered as page copy: "${m[0].trim()}"`, rel);
      }
    }

    for (const mark of VENDOR_MARKS) {
      // Word-boundary match so "SMA" does not fire inside "smaller".
      const re = new RegExp(`\\b${mark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(text)) {
        report.error(
          `"${mark}" appears in page copy — implies a partnership or credential ` +
          `that cannot be evidenced`, rel);
      }
    }
  }

  // The demo's testimonials and case studies must be declared as samples
  // somewhere a buyer will see, so nobody mistakes them for real references.
  const home = exists('index.html') ? read('index.html') : '';
  if (/testimonial/i.test(home)) {
    const declared = ['README.md', 'docs/documentation.html']
      .filter(exists)
      .some((f) => /sample|illustrativ|fictional|placeholder content|replace .{0,30}testimonial/i.test(read(f)));
    if (!declared) {
      report.warn(
        'testimonials and case studies are not declared as sample content in ' +
        'README.md or the documentation', 'index.html');
    }
  }

  return report.counted(inspected);
};
