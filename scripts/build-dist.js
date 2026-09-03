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
  // v1.6.0 added 404.html and this list was not updated, so the page existed in
  // the repo, passed every check that reads the source tree, and was absent
  // from the only build anyone visits. Cloudflare served its own generic 404
  // instead. A missing file cannot fail a test that never looks for it, which
  // is why `assertDeployedPages` below now compares this list against the pages
  // on disk rather than trusting it.
  '404.html',
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

/**
 * Strip `.html` from internal links in the deployed copy only.
 *
 * Cloudflare Pages serves `pages/calculator.html` at `/pages/calculator` and
 * answers the `.html` form with a 308 redirect. Every link in this template
 * points at the `.html` form, so every navigation on the live demo paid for an
 * extra round trip — measured at 4.47s against 0.52s direct on a Nigerian
 * mobile connection, which is the audience the demo exists to convince.
 *
 * The source keeps `.html` deliberately: a buyer must be able to unzip the
 * template and open index.html from a folder with no server, and extensionless
 * links break that. So this is a deploy-time transform, exactly like SITE_URL
 * stamping — same source, two correct outputs.
 */
function stripHtmlExtensions(dir) {
  const rewritten = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.html')) continue;

      const before = fs.readFileSync(full, 'utf8');
      const after = before.replace(
        /(\s(?:href)\s*=\s*")([^"#?:]*?)\.html((?:[#?][^"]*)?")/gi,
        (whole, lead, target, tail) => {
          // `index.html` is served at the directory root, so it becomes `./`
          // or `../` rather than a bare `index`.
          if (target === 'index') return `${lead}./${tail}`;
          if (target.endsWith('/index')) return `${lead}${target.slice(0, -5)}${tail}`;
          return `${lead}${target}${tail}`;
        });
      if (after !== before) {
        fs.writeFileSync(full, after);
        rewritten.push(path.relative(dir, full));
      }
    }
  };
  walk(dir);
  return rewritten;
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
      // The absolute URLs in canonical and og:url are skipped by the link
      // rewriter above (it deliberately leaves anything with a scheme alone),
      // so normalise their paths here. A canonical that points at a 308 is
      // telling search engines the wrong address for the page.
      const after = before
        .replace(/https:\/\/www\.example\.com/g, origin)
        .replace(new RegExp(`(${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*?)\\/index\\.html`, 'g'), '$1/')
        .replace(new RegExp(`(${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*?)\\.html`, 'g'), '$1');
      if (after !== before) { fs.writeFileSync(full, after); touched++; }
    }
  };
  walk(dir);
  return touched;
}

/**
 * Every page in the repo must be in INCLUDE.
 *
 * The reverse direction — INCLUDE naming something absent — was already
 * guarded. This is the direction that actually bit: 404.html was added to the
 * repo and not to INCLUDE, so it shipped in the buyer ZIP, passed all fourteen
 * checks (they read the source tree), and simply did not exist on the deployed
 * site. Nothing failed, because nothing was looking.
 */
function assertDeployedPages() {
  const pages = fs.readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => !INCLUDE.includes(f));
  if (pages.length) {
    console.error(`Cannot build: ${pages.join(', ')} exist(s) in the repo but ` +
                  `is not in INCLUDE, so it would be missing from the deployed site.`);
    console.error('Add it to INCLUDE in scripts/build-dist.js.');
    process.exit(1);
  }
}

function main() {
  assertDeployedPages();
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
    '  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), interest-cohort=()',
    // Added 3 Sep 2026. Both siblings (seunscope-furniture, leebartea) sent
    // HSTS and this one did not, so a first visit over http:// on a hostile
    // network was strippable. A year, and no preload — preload is a one-way
    // door and this is a *.pages.dev demo, not the buyer's own domain.
    '  Strict-Transport-Security: max-age=31536000',
    // Content Security Policy.
    //
    // The template loads nothing from a third-party host — that is enforced by
    // the `external-deps` check — so `default-src 'self'` costs nothing and
    // shuts the door on injected remote scripts.
    //
    // 'unsafe-inline' is present for both script and style, honestly rather
    // than decoratively: every page carries an inline theme block in <head>
    // (removing it reintroduces the flash of wrong theme) and several hundred
    // inline style attributes. Hashing them would break on every edit. The
    // directives that still carry real weight without it are object-src,
    // base-uri and frame-ancestors, which block the injection techniques that
    // do not need inline execution.
    //
    // NOTE FOR BUYERS WIRING THE CONTACT FORM: connect-src is 'self', so a
    // fetch() to Web3Forms, Formspree or your own API will be BLOCKED until you
    // add that origin here. This is called out in the documentation because a
    // CSP violation fails silently in the UI — the form would simply never
    // send, which is the worst possible failure for a lead-capture page.
    "  Content-Security-Policy: default-src 'self'; img-src 'self' data:; " +
      "style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; " +
      "font-src 'self'; connect-src 'self'; object-src 'none'; " +
      "base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
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

  // Order matters: strip extensions first so the canonical URLs stamped below
  // point at the final address rather than at one that redirects.
  const rewritten = stripHtmlExtensions(DIST);

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
  console.log(`clean URLs: .html stripped from links in ${rewritten.length} page(s)`);
  if (siteUrl) console.log(`canonical origin stamped as ${siteUrl} in ${stamped} page(s)`);
  else console.log('canonical origin left as www.example.com (set SITE_URL to override)');

  // The failure that started all this was uploading node_modules by accident.
  for (const forbidden of ['node_modules', '.git', '.claude', 'guardrails', 'scripts']) {
    if (fs.existsSync(path.join(DIST, forbidden))) {
      console.error(`\nBUILD REJECTED: dist/ contains ${forbidden}/`);
      process.exit(1);
    }
  }

  // Stripping extensions is only safe if every shortened link still points at
  // a real page. A fast demo with dead navigation is worse than a slow one, so
  // this refuses to emit a build it cannot prove.
  const broken = [];
  const verify = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { verify(full); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const html = fs.readFileSync(full, 'utf8');
      for (const m of html.matchAll(/\shref\s*=\s*"([^"]+)"/gi)) {
        const ref = m[1];
        if (/^(?:https?:|data:|mailto:|tel:|javascript:|#)/i.test(ref)) continue;
        const clean = ref.split('#')[0].split('?')[0];
        if (!clean) continue;
        const base = path.dirname(full);
        const target = path.resolve(base, clean);
        const servable =
          fs.existsSync(target) ||                       // a real file or dir
          fs.existsSync(`${target}.html`) ||             // clean URL -> page
          fs.existsSync(path.join(target, 'index.html')); // directory -> index
        if (!servable) broken.push(`${path.relative(DIST, full)} -> ${ref}`);
      }
    }
  };
  verify(DIST);
  if (broken.length) {
    console.error(`\nBUILD REJECTED: ${broken.length} link(s) in dist/ resolve to nothing:`);
    for (const b of broken.slice(0, 10)) console.error(`  ${b}`);
    process.exit(1);
  }
  console.log(`link check: every internal link in dist/ resolves`);
}

main();
