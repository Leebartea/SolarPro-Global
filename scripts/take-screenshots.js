/**
 * SolarPro Global — Screenshot script
 * Uses Playwright to take desktop + mobile full-page screenshots.
 * Run: node scripts/take-screenshots.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE = 'file://' + path.resolve(__dirname, '..') + '/index.html';
const OUT  = path.resolve(__dirname, '..');

async function shot(page, outFile, label) {
  await page.screenshot({ path: outFile, fullPage: true });
  const stat = fs.statSync(outFile);
  console.log(`✓ ${label}: ${outFile.split('/').pop()} (${(stat.size / 1024).toFixed(0)} KB)`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
  console.log('Browser launched\n');

  /* ── Desktop 1920 × 1080 ──────────────────────────────────── */
  {
    const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    // Wait for AOS animations to settle
    await page.waitForTimeout(2500);
    await shot(page, path.join(OUT, 'preview-desktop-1920x1080.png'), 'Desktop 1920×1080');
    await ctx.close();
  }

  /* ── Mobile 375 × 667 (iPhone SE) ───────────────────────────── */
  {
    const ctx  = await browser.newContext({
      viewport: { width: 375, height: 667 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await shot(page, path.join(OUT, 'preview-mobile-375x667.png'), 'Mobile 375×667');
    await ctx.close();
  }

  /* ── Mobile 414 × 896 (iPhone XR / 11) ─────────────────────── */
  {
    const ctx  = await browser.newContext({
      viewport: { width: 414, height: 896 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await shot(page, path.join(OUT, 'preview-mobile-414x896.png'), 'Mobile 414×896');
    await ctx.close();
  }

  /* ── Tablet 768 × 1024 (iPad portrait) ─────────────────────── */
  {
    const ctx  = await browser.newContext({
      viewport: { width: 768, height: 1024 },
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await shot(page, path.join(OUT, 'preview-mobile-768x1024.png'), 'Tablet 768×1024');
    await ctx.close();
  }

  await browser.close();
  console.log('\nAll screenshots saved to project root.');
})();
