/**
 * final-screenshots.js
 * Single browser, sequential pages — verifies About/Contact + takes final preview shots.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');
const OUT  = path.resolve(__dirname, '..');

async function shot(page, file, fullPage = true) {
  const p = path.join(OUT, file);
  await page.screenshot({ path: p, fullPage });
  const kb = (fs.statSync(p).size / 1024).toFixed(0);
  console.log(`  ✓ ${file} (${kb} KB)`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  // Reuse a SINGLE context — avoids resource exhaustion
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const pages = [
    ['pages/about.html',   'About'],
    ['pages/contact.html', 'Contact'],
  ];

  console.log('[1] Theme toggle check — About & Contact');
  for (const [pg, label] of pages) {
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('solarproTheme', 'dark'));
    try {
      await page.goto('file://' + OUT + '/' + pg, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(600);
      const hasSVG  = await page.$eval('#theme-toggle', el => el.innerHTML.includes('<svg')).catch(() => false);
      const htmlCls = await page.$eval('html', el => el.className).catch(() => '?');
      const yr      = await page.$eval('.footer-year', el => el.textContent).catch(() => '?');
      console.log(`  ${label.padEnd(10)} SVG: ${hasSVG}  html: "${htmlCls}"  year: ${yr}`);
    } catch (e) {
      console.log(`  ${label}: timeout/error — ${e.message.split('\n')[0]}`);
    }
    await page.close();
  }

  await ctx.close();

  // Final preview screenshots — fresh context each time
  console.log('\n[2] Final preview screenshots');

  {
    const ctx2 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx2.newPage();
    await page.addInitScript(() => {
      localStorage.removeItem('cookieOk');
      localStorage.setItem('solarproTheme', 'dark');
    });
    await page.goto('file://' + OUT + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000); // let animations settle + cookie banner appear
    await shot(page, 'preview-desktop-1920x1080.png');
    await ctx2.close();
  }

  {
    const ctx3 = await browser.newContext({
      viewport: { width: 375, height: 667 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    });
    const page = await ctx3.newPage();
    await page.addInitScript(() => localStorage.setItem('solarproTheme', 'dark'));
    await page.goto('file://' + OUT + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);
    await shot(page, 'preview-mobile-375x667.png');
    await ctx3.close();
  }

  {
    // Calculator in dark mode
    const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx4.newPage();
    await page.addInitScript(() => localStorage.setItem('solarproTheme', 'dark'));
    await page.goto('file://' + OUT + '/pages/calculator.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(600);
    await page.selectOption('#calc-country', 'nigeria');
    await page.fill('#calc-bill', '80000');
    await page.click('#calc-btn');
    await page.waitForTimeout(800);
    await shot(page, 'preview-calculator-results.png');
    await ctx4.close();
  }

  await browser.close();
  console.log('\n✓ All done.');
})();
