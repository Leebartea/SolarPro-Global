/**
 * final-proof.js — Final visual verification of all reported fixes.
 */
const { chromium } = require('playwright');
const path = require('path');
const OUT  = path.resolve(__dirname, '..');

async function shot(page, file, clip) {
  const opts = { path: path.join(OUT, file), fullPage: !clip };
  if (clip) opts.clip = clip;
  await page.screenshot(opts);
  const fs = require('fs');
  const kb = (fs.statSync(opts.path).size / 1024).toFixed(0);
  console.log(`  Saved: ${file} (${kb} KB)`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  /* ── Test 1: Cookie banner in light mode ─────────────────── */
  console.log('\n[1] Cookie banner — light mode');
  {
    const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      localStorage.removeItem('cookieOk');
      localStorage.setItem('solarproTheme', 'light');
    });
    await page.goto('file://' + OUT + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500); // wait for 1800ms delay + render

    const banner  = await page.$('#cookie-banner');
    const visible = await banner?.isVisible();
    const box     = await banner?.boundingBox();
    console.log(`  Visible: ${visible}, at y=${box?.y?.toFixed(0)}`);

    // Get computed colors
    const pColor  = await page.$eval('#cookie-banner p', el =>
      getComputedStyle(el).color).catch(() => 'n/a');
    const btnBg   = await page.$eval('#cookie-decline', el =>
      getComputedStyle(el).backgroundColor).catch(() => 'n/a');
    console.log(`  <p> color:     ${pColor}`);
    console.log(`  Decline bg:    ${btnBg}`);

    if (box) {
      await shot(page, 'proof-cookie-light.png',
        { x: 0, y: Math.max(0, box.y - 10), width: 1440, height: box.height + 20 });
    }
    await ctx.close();
  }

  /* ── Test 2: Cookie banner in dark mode ─────────────────── */
  console.log('\n[2] Cookie banner — dark mode');
  {
    const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      localStorage.removeItem('cookieOk');
      localStorage.setItem('solarproTheme', 'dark');
    });
    await page.goto('file://' + OUT + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);

    const box = await page.$eval('#cookie-banner', el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }).catch(() => null);
    console.log(`  Banner at: y=${box?.y?.toFixed(0)}`);
    if (box) {
      await shot(page, 'proof-cookie-dark.png',
        { x: 0, y: Math.max(0, box.y - 10), width: 1440, height: box.height + 20 });
    }
    await ctx.close();
  }

  /* ── Test 3: Theme toggle on every page ─────────────────── */
  console.log('\n[3] Theme toggle across all pages');
  const pages = [
    ['index.html',              'Home'],
    ['pages/services.html',     'Services'],
    ['pages/calculator.html',   'Calculator'],
    ['pages/portfolio.html',    'Portfolio'],
    ['pages/about.html',        'About'],
    ['pages/contact.html',      'Contact'],
  ];
  for (const [pg, label] of pages) {
    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('solarproTheme', 'dark'));
    await page.goto('file://' + OUT + '/' + pg, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(700);
    const hasSVG = await page.$eval('#theme-toggle', el =>
      el.innerHTML.includes('<svg')).catch(() => false);
    const htmlCls = await page.$eval('html', el => el.className).catch(() => '?');
    console.log(`  ${label.padEnd(12)} theme-toggle has SVG: ${hasSVG}  html class: "${htmlCls}"`);
    await ctx.close();
  }

  /* ── Test 4: Final full-page desktop screenshot ──────────── */
  console.log('\n[4] Final desktop screenshot (1920×1080, dark mode)');
  {
    const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      localStorage.removeItem('cookieOk');
      localStorage.setItem('solarproTheme', 'dark');
    });
    await page.goto('file://' + OUT + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await shot(page, 'preview-desktop-1920x1080.png'); // overwrite with final version
    await ctx.close();
  }

  /* ── Test 5: Final mobile screenshot (375×667) ───────────── */
  console.log('\n[5] Final mobile screenshot (375×667, dark mode)');
  {
    const ctx  = await browser.newContext({
      viewport: { width: 375, height: 667 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('solarproTheme', 'dark'));
    await page.goto('file://' + OUT + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);
    await shot(page, 'preview-mobile-375x667.png');
    await ctx.close();
  }

  await browser.close();
  console.log('\n✓ All final proofs completed successfully.');
})();
