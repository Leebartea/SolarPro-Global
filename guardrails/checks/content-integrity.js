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
//
// The first version of this list matched only "replace the placeholder", and
// an outside reviewer found two live instructions it sailed past: "Replace
// this placeholder with your Google Maps embed code" and "Replace avatar
// initials with actual team photos in the assets/images folder". Both were
// visible on the deployed demo. The lesson is that an enumerated blocklist
// fails on the phrasing nobody thought of, so these patterns key on the
// *shape* of an instruction — an imperative verb aimed at the reader — rather
// than on remembered wordings.
const BUILD_NOTES = [
  /\b(replace|swap|change|update|edit|paste|upload|insert)\b[^.!?]{0,60}\b(placeholder|dummy|sample image|your own|actual (?:photos?|logos?|images?|details?))/i,
  /\b(replace|change|update)\s+(this|these|the|each|any)\b[^.!?]{0,40}\b(with|for)\b/i,
  /\b(in|to|from)\s+the\s+assets\/images\s+folder/i,
  /\bfor\s+your\s+(live\s+site|own\s+site|website)\b/i,
  /\bTODO\b/,
  /\bFIXME\b/,
  /lorem\s+ipsum/i,
  /\byour-(?:domain|photo|link|plan|project)\b/i,
  /\bcoming\s+soon\b/i,
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

/**
 * Stock-photo sources other than the one actually used. Naming the wrong
 * licensor is a licensing claim the seller cannot support, and it is exactly
 * what a marketplace reviewer cross-checks against the credits file.
 *
 * This fires for real: the photographs moved to Pexels in v1.6.0, and
 * LICENSE.txt, README.md and the help file all still named Unsplash — three
 * documents shipping to buyers, each asserting a licence that no longer
 * governed anything in the package. Nothing rendered wrong, so nothing caught
 * it. The buyer-facing documents are checked here rather than the page markup,
 * because that is where a licence gets asserted.
 */
const STOCK_SOURCES = ['pexels', 'unsplash', 'pixabay', 'shutterstock', 'freepik', 'istock', 'getty images', 'adobe stock'];
const LICENCE_DOCS = ['LICENSE.txt', 'README.md', 'docs/documentation.html'];
const CREDITS = 'themeforest/licensing/CREDITS.txt';

/** Which stock sources the credits file actually declares. */
function declaredSources() {
  if (!exists(CREDITS)) return null;
  const credits = read(CREDITS).toLowerCase();
  return STOCK_SOURCES.filter((s) => credits.includes(s));
}

module.exports = function contentIntegrity() {
  const report = new Report('Content integrity — no build notes, no borrowed credibility');
  let inspected = 0;

  const declared = declaredSources();
  if (declared === null) {
    report.warn(`${CREDITS} is missing — cannot verify licence claims agree`, CREDITS);
  } else {
    for (const doc of LICENCE_DOCS) {
      if (!exists(doc)) continue;
      inspected++;
      const text = read(doc).toLowerCase();
      for (const source of STOCK_SOURCES) {
        if (declared.includes(source)) continue;
        if (text.includes(source)) {
          report.error(
            `names "${source}" as a photography source, but ${CREDITS} declares ` +
            `${declared.length ? declared.join(', ') : 'none'} — a buyer-facing ` +
            `licence claim must match the credits file`, doc);
        }
      }
    }
  }

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
