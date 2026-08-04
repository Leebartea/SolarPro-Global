'use strict';
/**
 * No runtime dependency on a third-party host.
 *
 * Anything the browser must fetch from someone else's domain is a way for the
 * template to break in a buyer's hands for reasons neither of you control. It
 * is not hypothetical: this project's own demo is unreachable on one Nigerian
 * ISP because GitHub Pages' anycast addresses are null-routed there, and two
 * of the template's hotlinked Unsplash photos were deleted upstream and had
 * been rendering as broken images.
 *
 * Marketplaces care too — ThemeForest rejects the Tailwind Play CDN outright.
 */

const { Report } = require('../lib/report');
const { ALL_HTML, exists, read, externalUrls, host } = require('../lib/project');

// Hosts allowed to appear as a link *destination* — never as a fetched asset.
const LINK_ONLY_HOSTS = new Set([
  'wa.me', 'maps.google.com', 'www.google.com', 'unsplash.com',
  'tailwindcss.com', 'michalsnik.github.io', 'vercel.com', 'netlify.com',
  'paystack.com', 'flutterwave.com', 'buy.stripe.com', 'formspree.io',
  'web3forms.com', 'www.urlencoder.org', 'power.larc.nasa.gov',
  'fonts.googleapis.com', 'fonts.gstatic.com', 'github.com',
]);

// Hosts that must never be fetched at runtime, with the reason.
const BANNED_ASSET_HOSTS = new Map([
  ['cdn.tailwindcss.com', 'the Tailwind Play CDN is a browser-side compiler, not for production — run `npm run build:css` and link css/tailwind.min.css'],
  ['unpkg.com', 'vendor the file under vendor/ and reference it locally'],
  ['cdn.jsdelivr.net', 'vendor the file under vendor/ and reference it locally'],
  ['images.unsplash.com', 'bundle the photo under assets/images/ — upstream photos get deleted'],
  ['loremflickr.com', 'bundle the photo under assets/images/'],
  ['via.placeholder.com', 'bundle the image under assets/images/'],
]);

module.exports = function externalDeps() {
  const report = new Report('External deps — template must not fetch from third-party hosts');
  let inspected = 0;

  for (const rel of ALL_HTML) {
    if (!exists(rel)) continue;
    const text = read(rel);

    for (const { url, where } of externalUrls(rel)) {
      inspected++;
      const h = host(url);
      if (!h) continue;

      if (BANNED_ASSET_HOSTS.has(h)) {
        report.error(`fetches from ${h} — ${BANNED_ASSET_HOSTS.get(h)}`, where);
        continue;
      }
      // An <a href> to an external site is fine; an asset reference is not.
      const isAsset = new RegExp(`src\\s*=\\s*"${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(text);
      if (isAsset && !LINK_ONLY_HOSTS.has(h)) {
        report.error(`loads an asset from ${h} at runtime`, where);
      }
    }

    // @import inside a stylesheet is invisible to the href/src scan above.
    for (const m of text.matchAll(/@import\s+url\(['"]?(https?:\/\/[^'")]+)/g)) {
      report.warn(`@import pulls ${host(m[1])} at render time — self-host for offline use`, rel);
    }
  }

  for (const sheet of ['css/custom.css']) {
    if (!exists(sheet)) continue;
    for (const m of read(sheet).matchAll(/@import\s+url\(['"]?(https?:\/\/[^'")]+)/g)) {
      report.warn(
        `@import pulls ${host(m[1])} — the page renders in a fallback font until it loads, ` +
        `and in a system font on a network that blocks it`, sheet);
    }
    for (const m of read(sheet).matchAll(/url\(\s*['"]?(https?:\/\/[^'")]+)/g)) {
      if (!/@import/.test(m[0])) {
        report.error(`stylesheet fetches ${host(m[1])} at runtime`, sheet);
      }
    }
  }

  return report.counted(inspected);
};
