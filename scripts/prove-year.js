const { chromium } = require('playwright');
const path = require('path');
const BASE = 'file://' + path.resolve(__dirname, '..') + '/index.html';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Use domcontentloaded — no need to wait for external images
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(600);

  const yearText   = await page.$eval('.footer-year', el => el.textContent).catch(() => 'NOT FOUND');
  const currentYear = new Date().getFullYear().toString();
  const allPages   = ['index.html', 'pages/services.html', 'pages/calculator.html',
                      'pages/portfolio.html', 'pages/about.html', 'pages/contact.html'];

  console.log(`Home footer year: "${yearText}"  (expected: ${currentYear})  match: ${yearText === currentYear}`);

  // Spot-check two more pages
  for (const pg of ['pages/services.html', 'pages/contact.html']) {
    const p = await ctx.newPage();
    await p.goto('file://' + path.resolve(__dirname, '..') + '/' + pg, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await p.waitForTimeout(400);
    const y = await p.$eval('.footer-year', el => el.textContent).catch(() => 'NOT FOUND');
    console.log(`${pg}: "${y}"  match: ${y === currentYear}`);
    await p.close();
  }

  await browser.close();
  console.log('\n✓ Copyright year proof complete.');
})();
