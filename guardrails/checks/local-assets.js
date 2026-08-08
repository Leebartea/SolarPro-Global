'use strict';
/**
 * Every local reference resolves, and every bundled asset is really there.
 *
 * A relative path that is right on macOS and wrong on a case-sensitive host is
 * the classic "works on my machine, 404s on the live demo" defect — and the
 * live demo is the single thing that sells a template.
 */

const fs = require('fs');
const path = require('path');
const { Report } = require('../lib/report');
const { ROOT, ALL_HTML, exists, read, abs } = require('../lib/project');

/** Case-sensitive existence test, so macOS does not hide a broken path. */
function existsExactCase(absPath) {
  if (!fs.existsSync(absPath)) return false;
  let cur = path.resolve(absPath);
  const stop = path.resolve(ROOT);
  while (cur !== stop) {
    const parent = path.dirname(cur);
    if (parent === cur) break;
    let entries;
    try { entries = fs.readdirSync(parent); } catch { return false; }
    if (!entries.includes(path.basename(cur))) return false;
    cur = parent;
  }
  return true;
}

module.exports = function localAssets() {
  const report = new Report('Local assets — every relative path resolves');
  let inspected = 0;

  for (const rel of ALL_HTML) {
    if (!exists(rel)) continue;
    const dir = path.dirname(abs(rel));
    const lines = read(rel).split('\n');

    lines.forEach((line, i) => {
      const re = /\b(?:src|href)\s*=\s*"([^"#][^"]*)"/g;
      let m;
      while ((m = re.exec(line)) !== null) {
        const ref = m[1];
        if (/^(?:https?:|data:|mailto:|tel:|javascript:|#)/i.test(ref)) continue;
        inspected++;
        const target = path.resolve(dir, ref.split('?')[0].split('#')[0]);
        if (!existsExactCase(target)) {
          report.error(`broken reference "${ref}"`, `${rel}:${i + 1}`);
        }
      }
    });
  }

  /**
   * Social-card images, which live in `content=` and so are invisible above.
   *
   * The src/href sweep never reads a <meta> tag, so og:image pointed at a
   * file that had never existed — on all nine pages, through every release,
   * with thirteen checks green. Nothing renders it, so nothing 404s in a
   * browser; the failure only appears in someone else's timeline.
   *
   * These URLs must also be ABSOLUTE. Facebook and LinkedIn fetch the card
   * with a bare client that does not resolve a relative path against the
   * page, so a working relative reference still shares as a bare link. The
   * pages carry the www.example.com placeholder origin that build-dist.js
   * rewrites from SITE_URL; strip it back off to find the repo file.
   */
  const PLACEHOLDER_ORIGIN = 'https://www.example.com';
  const SOCIAL_IMAGE = /<meta\s+(?:property|name)\s*=\s*"(og:image(?::secure_url)?|twitter:image)"\s+content\s*=\s*"([^"]*)"/gi;
  for (const rel of ALL_HTML) {
    if (!exists(rel)) continue;
    const src = read(rel);
    let m;
    SOCIAL_IMAGE.lastIndex = 0;
    while ((m = SOCIAL_IMAGE.exec(src)) !== null) {
      const [, prop, url] = m;
      const at = `${rel}:${src.slice(0, m.index).split('\n').length}`;
      inspected++;
      if (!url.startsWith(PLACEHOLDER_ORIGIN + '/')) {
        report.error(
          `${prop} is "${url}" — it must be an absolute URL under ` +
          `${PLACEHOLDER_ORIGIN}/ so SITE_URL can stamp the live origin. ` +
          `Scrapers do not resolve relative card images.`, at);
        continue;
      }
      const file = url.slice(PLACEHOLDER_ORIGIN.length + 1).split(/[?#]/)[0];
      if (!existsExactCase(path.resolve(ROOT, file))) {
        report.error(`${prop} points at "${file}", which is not in the package`, at);
      }
    }
  }

  // Files a buyer is entitled to find in the package.
  for (const required of ['README.md', 'docs/documentation.html', 'css/custom.css',
                          'css/tailwind.min.css', 'js/main.js', 'js/theme.js']) {
    if (!exists(required)) report.error(`required file missing from the package`, required);
  }

  if (!exists('LICENSE.txt') && !exists('LICENSE')) {
    report.error(
      'no licence file — README states a Single Use License but the package ' +
      'does not contain its text', 'LICENSE.txt');
  }

  // Staleness of the compiled Tailwind is not checked by timestamp — the
  // compiler leaves mtime alone when output is unchanged, which produced a
  // standing false alarm. The css-contract check proves freshness properly:
  // a utility class added to the markup but absent from the compiled sheet
  // fails there, by content rather than by clock.

  return report.counted(inspected);
};
