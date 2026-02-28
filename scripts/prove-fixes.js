/**
 * prove-fixes.js
 * Targeted proof that cookie banner + theme toggle are working correctly.
 * Takes annotated screenshots of the specific fixes.
 */
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'file://' + path.resolve(__dirname, '..') + '/index.html';
const OUT  = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  /* ── PROOF 1: Cookie banner fully styled on home page ─────── */
  console.log('Proof 1 — Cookie banner on home page...');
  {
    const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    // Clear localStorage so cookie banner definitely shows
    await page.addInitScript(() => localStorage.removeItem('cookieOk'));
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    // Wait for the 1800ms delay + a bit more
    await page.waitForTimeout(2400);

    // Check banner is visible and positioned correctly
    const banner = await page.$('#cookie-banner');
    const isVisible = await banner?.isVisible();
    const box = await banner?.boundingBox();
    console.log(`  Banner found:   ${!!banner}`);
    console.log(`  Banner visible: ${isVisible}`);
    console.log(`  Position:       x=${box?.x?.toFixed(0)}, y=${box?.y?.toFixed(0)}, w=${box?.width?.toFixed(0)}, h=${box?.height?.toFixed(0)}`);

    // Screenshot showing the cookie banner
    await page.screenshot({
      path: path.join(OUT, 'proof-cookie-banner.png'),
      clip: { x: 0, y: box ? Math.max(0, box.y - 20) : 820, width: 1440, height: 120 }
    });
    console.log('  Screenshot: proof-cookie-banner.png ✓');
    await ctx.close();
  }

  /* ── PROOF 2: Theme toggle has icon (dark mode) ────────────── */
  console.log('\nProof 2 — Theme toggle icon (dark mode)...');
  {
    const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    // Force dark mode
    await page.addInitScript(() => localStorage.setItem('solarproTheme', 'dark'));
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);

    const btn = await page.$('#theme-toggle');
    const btnHTML   = await btn?.innerHTML();
    const btnBox    = await btn?.boundingBox();
    const hasSVG    = (btnHTML || '').includes('<svg');
    const htmlClass = await page.$eval('html', el => el.className);

    console.log(`  Button found:   ${!!btn}`);
    console.log(`  Has SVG icon:   ${hasSVG}`);
    console.log(`  HTML class:     "${htmlClass}"`);
    console.log(`  Button HTML:    ${(btnHTML || '').substring(0, 80)}...`);

    // Screenshot of just the navbar area showing the toggle button
    await page.screenshot({
      path: path.join(OUT, 'proof-theme-toggle-dark.png'),
      clip: { x: 0, y: 0, width: 1440, height: 72 }
    });
    console.log('  Screenshot: proof-theme-toggle-dark.png ✓');
    await ctx.close();
  }

  /* ── PROOF 3: Theme toggle icon (light mode) ───────────────── */
  console.log('\nProof 3 — Theme toggle icon (light mode)...');
  {
    const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    // Force light mode
    await page.addInitScript(() => localStorage.setItem('solarproTheme', 'light'));
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);

    const htmlClass = await page.$eval('html', el => el.className);
    const btnHTML   = await page.$eval('#theme-toggle', el => el.innerHTML);
    console.log(`  HTML class:     "${htmlClass}"`);
    console.log(`  Has SVG icon:   ${btnHTML.includes('<svg')}`);

    await page.screenshot({
      path: path.join(OUT, 'proof-theme-toggle-light.png'),
      clip: { x: 0, y: 0, width: 1440, height: 72 }
    });
    console.log('  Screenshot: proof-theme-toggle-light.png ✓');
    await ctx.close();
  }

  /* ── PROOF 4: Calculator results display ──────────────────── */
  console.log('\nProof 4 — Calculator results...');
  {
    const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('solarproTheme', 'dark'));
    await page.goto('file://' + path.resolve(__dirname, '..') + '/pages/calculator.html',
      { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);

    await page.selectOption('#calc-country', 'nigeria');
    await page.fill('#calc-bill', '80000');
    await page.click('#calc-btn');
    await page.waitForTimeout(700);

    const resultsVisible = await page.$eval('#calc-results', el => el.style.display !== 'none' && el.style.opacity !== '0');
    const sysSize = await page.$eval('#res-system-size', el => el.textContent);
    const savings = await page.$eval('#res-annual-savings', el => el.textContent);
    const yr25    = await page.$eval('#res-25year', el => el.textContent);

    console.log(`  Results visible: ${resultsVisible}`);
    console.log(`  System size:     ${sysSize}`);
    console.log(`  Annual savings:  ${savings}`);
    console.log(`  25-yr savings:   ${yr25}`);

    // Screenshot the result section
    const resultsBox = await page.$eval('#calc-results', el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 700) };
    });
    await page.screenshot({
      path: path.join(OUT, 'proof-calculator-results.png'),
      clip: resultsBox
    });
    console.log('  Screenshot: proof-calculator-results.png ✓');
    await ctx.close();
  }

  /* ── PROOF 5: Copyright year is dynamic ──────────────────── */
  console.log('\nProof 5 — Dynamic copyright year...');
  {
    const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    const yearText = await page.$eval('.footer-year', el => el.textContent).catch(() => 'NOT FOUND');
    const currentYear = new Date().getFullYear().toString();
    console.log(`  Year shown:   "${yearText}"`);
    console.log(`  Current year: "${currentYear}"`);
    console.log(`  Matches:      ${yearText === currentYear}`);
    await ctx.close();
  }

  await browser.close();
  console.log('\n✓ All proofs completed. Check the proof-*.png files in the project root.');
})();
