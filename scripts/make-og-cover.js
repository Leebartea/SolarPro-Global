#!/usr/bin/env node
'use strict';
/**
 * Generate assets/images/og-cover.jpg — the 1200 × 630 Open Graph card.
 *
 *   node scripts/make-og-cover.js
 *
 * WHY THIS IS A SCRIPT AND NOT A HAND-DRAWN JPEG.
 * All nine pages carry <meta property="og:image" content=".../og-cover.jpg">
 * and the file had never existed, so every share of the demo rendered a
 * bare link. Committing a one-off binary would fix today and leave nobody
 * able to regenerate it after a brand change; the card is drawn from the
 * same tokens and the same self-hosted fonts as the site, so it can be
 * rebuilt whenever those move.
 *
 * FIRST-PARTY ONLY. No photograph appears on the card — it is type, the
 * brand orange and a CSS-drawn panel grid. That keeps it clear of the
 * preview/download licence split that governs assets/images/*.jpg: this is
 * artwork we own outright. It is still swapped for a placeholder in the
 * Envato archive along with everything else in that folder, because the
 * buyer is meant to put their own cover there and package-themeforest.js
 * proves the swap by comparing bytes against the working tree.
 *
 * Rendered with the Playwright the guardrail suite already depends on,
 * exactly like scripts/make-placeholders.js.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'images', 'og-cover.jpg');
const W = 1200;
const H = 630;

/* Facebook, LinkedIn and X all fetch the image from a bare HTTP client with
 * no access to the site's stylesheet, so the card has to be self-contained.
 * The fonts are inlined as data: URIs for the same reason — a file:// render
 * with a relative @font-face path silently falls back to Helvetica, and the
 * card would ship in the wrong typeface without anything failing. */
const fontData = (file) =>
  'data:font/woff2;base64,' +
  fs.readFileSync(path.join(ROOT, 'assets', 'fonts', file)).toString('base64');

/* Brand tokens, copied from css/custom.css :root. The card is a static
 * artefact with no theme switch, so it uses the dark palette — white type on
 * #0a0f1e reads on both light and dark social timelines. */
const html = `<!doctype html><meta charset="utf-8"><style>
  @font-face{font-family:'Outfit';font-weight:400;src:url('${fontData('outfit-400.woff2')}') format('woff2')}
  @font-face{font-family:'Outfit';font-weight:600;src:url('${fontData('outfit-600.woff2')}') format('woff2')}
  @font-face{font-family:'Space Grotesk';font-weight:700;src:url('${fontData('space-grotesk-700.woff2')}') format('woff2')}
  html,body{margin:0}
  body{width:${W}px;height:${H}px;overflow:hidden;position:relative;
    background:#0a0f1e;color:#fff;
    font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased}

  /* Panel grid: the site's own visual motif, drawn rather than photographed. */
  .grid{position:absolute;inset:0;
    background:
      repeating-linear-gradient(0deg,rgba(255,255,255,.055) 0 1px,transparent 1px 42px),
      repeating-linear-gradient(90deg,rgba(255,255,255,.055) 0 1px,transparent 1px 42px);
    -webkit-mask-image:linear-gradient(115deg,transparent 42%,#000 100%);
    mask-image:linear-gradient(115deg,transparent 42%,#000 100%)}
  .glow{position:absolute;right:-140px;top:-160px;width:720px;height:720px;border-radius:50%;
    background:radial-gradient(circle,rgba(249,115,22,.34) 0%,rgba(249,115,22,0) 68%)}

  .b{position:relative;z-index:1;padding:76px 88px;height:100%;box-sizing:border-box;
    display:flex;flex-direction:column;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:14px;
    font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:30px;letter-spacing:-.01em}
  .mark{width:38px;height:38px;border-radius:9px;
    background:linear-gradient(135deg,#fb923c,#f97316);
    box-shadow:0 6px 22px rgba(249,115,22,.42)}
  h1{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:74px;line-height:1.06;
    letter-spacing:-.028em;margin:0 0 22px;max-width:14ch}
  h1 em{font-style:normal;color:#fb923c}
  p{font-size:27px;line-height:1.45;color:#cbd5e1;margin:0;max-width:30ch;font-weight:400}
  .rule{width:104px;height:5px;border-radius:3px;
    background:linear-gradient(90deg,#fb923c,#f97316);margin-bottom:34px}
  .foot{display:flex;align-items:center;gap:16px;font-size:22px;color:#94a3b8}
  .foot span{color:#334155}
</style>
<div class="grid"></div><div class="glow"></div>
<div class="b">
  <div class="brand"><div class="mark"></div>SolarPro Global</div>
  <div>
    <div class="rule"></div>
    <h1>Professional <em>solar</em> websites</h1>
    <p>A nine-page HTML template with a working savings calculator.</p>
  </div>
  <div class="foot">Responsive <span>&bull;</span> Dark mode <span>&bull;</span> No build step</div>
</div>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'og-'));
const pagePath = path.join(tmp, 'og.html');
fs.writeFileSync(pagePath, html);

const driver = `
const { chromium } = require(${JSON.stringify(require.resolve('playwright'))});
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: ${W}, height: ${H} }, deviceScaleFactor: 1 });
  await p.goto('file://' + ${JSON.stringify(pagePath)});
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: ${JSON.stringify(OUT)}, type: 'jpeg', quality: 88 });
  await b.close();
})();`;
const driverPath = path.join(tmp, '_driver.cjs');
fs.writeFileSync(driverPath, driver);
execFileSync('node', [driverPath], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`  og-cover.jpg  ${W}×${H}  ${kb} KB`);
