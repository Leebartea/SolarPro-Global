#!/usr/bin/env node
'use strict';
/**
 * Assemble dist/ — exactly the files a visitor's browser needs, nothing else.
 *
 *   npm run build            # build:css, then this
 *   SITE_URL=https://solarpro-global.pages.dev npm run build
 *
 * WHY THIS EXISTS
 *
 * The first Cloudflare deploy failed with:
 *
 *   ✘ [ERROR] Asset too large.
 *     Cloudflare Workers supports assets with sizes of up to 25 MiB. We found a
 *     file /opt/buildhome/repo/node_modules/workerd/bin/workerd …
 *
 * Two causes stacked up. The deploy was created through the **Workers** flow
 * (`npx wrangler deploy`) rather than **Pages**, and with no output directory
 * configured wrangler defaulted `assets.directory` to `"."` — the whole repo.
 * It read 2,648 files, including the `node_modules/` that `npm install` had
 * just created, and choked on a 25 MiB binary inside it.
 *
 * Pointing a deploy at the repository root is the underlying mistake, and it
 * would have caused trouble on Pages too. A build that produces one directory
 * containing only publishable files removes the whole class of problem: there
 * is nothing else in there to upload.
 *
 * SITE_URL, when set, rewrites the canonical and og:url tags. The template
 * ships with example.com — reserved by RFC 2606, so it can never resolve to
 * anyone — and the buyer replaces it with their own domain. Only the demo
 * deployment needs a real URL stamped in, and that is a deploy-time concern,
 * not something to hardcode into files a customer receives.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

/** Copied verbatim. Directories are copied recursively. */
const INCLUDE = [
  'index.html',
  'pages',
  'css/custom.css',
  'css/tailwind.min.css',
  'css/fonts.css',
  'js',
  'assets',
  'vendor',
  'docs',
  'README.md',
  'LICENSE.txt',
];

/** Never copied, at any depth. */
const EXCLUDE = [
  /(^|\/)\.DS_Store$/,
  /(^|\/)Thumbs\.db$/,
  /(^|\/)\.gitkeep$/,
  /(^|\/)tailwind\.src\.css$/,
];

const excluded = (rel) => EXCLUDE.some((re) => re.test(rel));

function copy(srcAbs, destAbs, rel) {
  if (excluded(rel)) return 0;
  const stat = fs.statSync(srcAbs);
  if (stat.isDirectory()) {
    fs.mkdirSync(destAbs, { recursive: true });
    let n = 0;
    for (const entry of fs.readdirSync(srcAbs)) {
      n += copy(path.join(srcAbs, entry), path.join(destAbs, entry), `${rel}/${entry}`);
    }
    return n;
  }
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.copyFileSync(srcAbs, destAbs);
  return 1;
}

/** Rewrite the placeholder origin in canonical / og:url tags. */
function stampSiteUrl(dir, siteUrl) {
  const origin = siteUrl.replace(/\/+$/, '');
  let touched = 0;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const before = fs.readFileSync(full, 'utf8');
      const after = before.replace(/https:\/\/www\.example\.com/g, origin);
      if (after !== before) { fs.writeFileSync(full, after); touched++; }
    }
  };
  walk(dir);
  return touched;
}

function main() {
  const missing = INCLUDE.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  if (missing.length) {
    console.error(`Cannot build: missing ${missing.join(', ')}`);
    console.error('Run `npm run build:css` first if css/tailwind.min.css is the problem.');
    process.exit(1);
  }

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  let files = 0;
  for (const rel of INCLUDE) {
    files += copy(path.join(ROOT, rel), path.join(DIST, rel), rel);
  }

  // Cloudflare Pages serves these as real response headers.
  fs.writeFileSync(path.join(DIST, '_headers'), [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  X-Frame-Options: SAMEORIGIN',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '',
    '/assets/fonts/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/assets/images/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    // CSS and JS filenames are stable across releases — there is no content
    // hash in them — so a long max-age would leave returning visitors on the
    // previous build for a day after every deploy. must-revalidate makes the
    // browser check the ETag each time, which costs one cheap 304 and
    // guarantees a fix actually reaches people who have been here before.
    '/css/*',
    '  Cache-Control: public, max-age=0, must-revalidate',
    '',
    '/js/*',
    '  Cache-Control: public, max-age=0, must-revalidate',
    '',
    '/*.html',
    '  Cache-Control: public, max-age=0, must-revalidate',
    '',
  ].join('\n'));

  const siteUrl = process.env.SITE_URL;
  let stamped = 0;
  if (siteUrl) stamped = stampSiteUrl(DIST, siteUrl);

  const bytes = (function size(d) {
    return fs.readdirSync(d, { withFileTypes: true }).reduce((sum, e) => {
      const full = path.join(d, e.name);
      return sum + (e.isDirectory() ? size(full) : fs.statSync(full).size);
    }, 0);
  })(DIST);

  console.log(`dist/ built — ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  if (siteUrl) console.log(`canonical origin stamped as ${siteUrl} in ${stamped} page(s)`);
  else console.log('canonical origin left as www.example.com (set SITE_URL to override)');

  // The failure that started all this was uploading node_modules by accident.
  for (const forbidden of ['node_modules', '.git', '.claude', 'guardrails', 'scripts']) {
    if (fs.existsSync(path.join(DIST, forbidden))) {
      console.error(`\nBUILD REJECTED: dist/ contains ${forbidden}/`);
      process.exit(1);
    }
  }
}

main();
