/**
 * Offline verification — opens the extracted ZIP test folder
 * and checks for 404s, JS errors, and basic page health.
 */
const { chromium } = require('playwright');
const path = require('path');

const EXTRACTED = 'file:///tmp/solarpro-test/index.html';
const PAGES = [
  { url: EXTRACTED,                                              label: 'Home' },
  { url: 'file:///tmp/solarpro-test/pages/services.html',       label: 'Services' },
  { url: 'file:///tmp/solarpro-test/pages/calculator.html',     label: 'Calculator' },
  { url: 'file:///tmp/solarpro-test/pages/portfolio.html',      label: 'Portfolio' },
  { url: 'file:///tmp/solarpro-test/pages/about.html',          label: 'About' },
  { url: 'file:///tmp/solarpro-test/pages/contact.html',        label: 'Contact' }
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'chromium' }));
  const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let   allOk   = true;

  for (const { url, label } of PAGES) {
    const page    = ctx.newPage ? await ctx.newPage() : await browser.newPage();
    const errors  = [];
    const missing = [];

    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('response', res => {
      if (!res.ok() && !res.url().startsWith('data:')) missing.push(res.status() + ' ' + res.url().split('/').pop());
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    const title = await page.title();
    const h1    = await page.$eval('h1', el => el.textContent.trim()).catch(() => '(no h1)');

    const ok = errors.length === 0;
    if (!ok) allOk = false;
    const status = ok ? '✓' : '✗';
    console.log(`${status} ${label} — "${title}"`);
    console.log(`   H1: ${h1}`);
    if (errors.length)  console.log(`   JS Errors: ${errors.join('; ')}`);
    if (missing.length) console.log(`   Missing:   ${missing.join(', ')}`);
    console.log('');
  }

  // Calculator smoke test
  console.log('--- Calculator smoke test ---');
  const calcPage = await ctx.newPage();
  await calcPage.goto('file:///tmp/solarpro-test/pages/calculator.html', { waitUntil: 'domcontentloaded' });
  await calcPage.waitForTimeout(800);
  await calcPage.selectOption('#calc-country', 'nigeria');
  await calcPage.fill('#calc-bill', '80000');
  await calcPage.click('#calc-btn');
  await calcPage.waitForTimeout(600);
  const sysSize = await calcPage.$eval('#res-system-size', el => el.textContent).catch(() => 'NOT FOUND');
  const annSav  = await calcPage.$eval('#res-annual-savings', el => el.textContent).catch(() => 'NOT FOUND');
  const yr25    = await calcPage.$eval('#res-25year', el => el.textContent).catch(() => 'NOT FOUND');
  const visible = await calcPage.$eval('#calc-results', el => el.style.display !== 'none').catch(() => false);
  console.log(`System size:     ${sysSize}`);
  console.log(`Annual savings:  ${annSav}`);
  console.log(`25-yr savings:   ${yr25}`);
  console.log(`Results visible: ${visible}`);

  await browser.close();
  console.log('\n' + (allOk ? '✓ All pages passed offline verification.' : '✗ Some pages had errors — see above.'));
})();
