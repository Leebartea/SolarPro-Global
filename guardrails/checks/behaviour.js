'use strict';
/**
 * Drives the real UI in a browser and asserts each feature actually works.
 *
 * `offline-render` proves the pages load without errors. That is not the same
 * as proving they *do* anything: a listener bound to a selector that matches
 * zero elements throws nothing, logs nothing, and looks identical to working
 * code. v1.0 shipped with main.js targeting an older set of names (.tslide,
 * .faq-q, .pitem, .cbtn, .navlink, #t-track, #lightbox), so the testimonial
 * slider, accordion, portfolio filter, lightbox, currency switcher and
 * active-nav highlight were all inert — silently, for six months.
 *
 * Each test here clicks something and asserts the page changed.
 */

const path = require('path');
const { Report } = require('../lib/report');
const { ROOT } = require('../lib/project');

const url = (rel) => 'file://' + path.join(ROOT, rel);

module.exports = async function behaviour() {
  const report = new Report('Behaviour — interactive features actually respond');

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    return report.warn('playwright is not installed — run `npm install` to enable this check');
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // The cookie banner is fixed to the viewport and would intercept clicks on
  // anything beneath it. Answer it up front, as a returning visitor already has.
  await ctx.addInitScript(() => {
    try { localStorage.setItem('cookieOk', '1'); } catch (e) {}
  });
  let ran = 0;

  const test = async (name, page, fn) => {
    ran++;
    try {
      const problem = await fn();
      if (problem) report.error(problem, name);
    } catch (err) {
      report.error(`threw: ${err.message}`.slice(0, 160), name);
    }
  };

  try {
    /* ── Home page ─────────────────────────────────────────── */
    {
      const page = await ctx.newPage();
      await page.goto(url('index.html'), { waitUntil: 'load' });
      await page.waitForTimeout(200);

      await test('theme toggle flips the theme and persists it', page, async () => {
        const before = await page.evaluate(() => document.documentElement.className);
        await page.click('#theme-toggle');
        await page.waitForTimeout(120);
        const after = await page.evaluate(() => document.documentElement.className);
        if (before === after) return `class stayed "${before}"`;
        const stored = await page.evaluate(() => localStorage.getItem('solarproTheme'));
        if (!after.includes(stored)) return `stored "${stored}" but html is "${after}"`;
        await page.click('#theme-toggle');
        await page.waitForTimeout(120);
        const back = await page.evaluate(() => document.documentElement.className);
        return back === before ? null : `did not toggle back (${back} vs ${before})`;
      });

      await test('currency switcher re-prices data-usd amounts', page, async () => {
        const count = await page.locator('[data-usd]').count();
        if (count === 0) return null;   // nothing priced on this page
        const before = await page.locator('[data-usd]').first().textContent();
        await page.click('.currency-trigger');
        await page.waitForTimeout(120);
        await page.click('.currency-option[data-currency="NGN"]');
        await page.waitForTimeout(150);
        const after = await page.locator('[data-usd]').first().textContent();
        if (before === after) return `price unchanged after switching to NGN ("${after}")`;
        if (!after.includes('₦')) return `expected a ₦ symbol, got "${after}"`;
        return null;
      });

      await test('currency dropdown opens and closes', page, async () => {
        const isOpen = () => page.evaluate(
          () => document.querySelector('.currency-dropdown').classList.contains('open'));
        await page.click('.currency-trigger');
        await page.waitForTimeout(100);
        if (!(await isOpen())) return 'clicking the trigger did not open the menu';
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        return (await isOpen()) ? 'Escape did not close the menu' : null;
      });

      await test('testimonial slider advances', page, async () => {
        const slides = await page.locator('.testimonial-slide').count();
        if (slides < 2) return null;
        const before = await page.evaluate(
          () => document.getElementById('testimonial-track').style.transform);
        await page.click('#slider-next');
        await page.waitForTimeout(250);
        const after = await page.evaluate(
          () => document.getElementById('testimonial-track').style.transform);
        return before === after
          ? `track transform stayed "${before || '(empty)'}" after clicking next`
          : null;
      });

      await test('slider builds one dot per testimonial', page, async () => {
        const slides = await page.locator('.testimonial-slide').count();
        const dots = await page.locator('#testimonial-dots button').count();
        return dots === slides ? null : `${dots} dots for ${slides} slides`;
      });

      await test('slider wraps from the last slide to the first', page, async () => {
        const total = await page.locator('.testimonial-slide').count();
        if (total < 2) return null;
        // Earlier tests have already advanced the track, so start from wherever
        // it actually is rather than assuming slide 0.
        const indexNow = async () => page.evaluate(() => {
          const m = /translateX\(-(\d+)%\)/.exec(
            document.getElementById('testimonial-track').style.transform || 'translateX(-0%)');
          return m ? Number(m[1]) / 100 : 0;
        });
        const start = await indexNow();
        for (let i = 0; i < total; i++) {
          await page.click('#slider-next');
          await page.waitForTimeout(90);
        }
        const end = await indexNow();
        return end === start
          ? null
          : `a full lap of ${total} slides landed on ${end}, expected to return to ${start}`;
      });

      await test('active nav link is marked on the current page', page, async () => {
        const n = await page.locator('.nav-link.active').count();
        return n > 0 ? null : 'no .nav-link carries the active class';
      });

      await test('copyright year is filled in', page, async () => {
        const txt = await page.locator('.footer-year').first().textContent();
        return /^\d{4}$/.test(txt.trim()) ? null : `footer year reads "${txt}"`;
      });

      await test('mobile menu opens from the hamburger', page, async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(120);
        const hidden = () => page.evaluate(
          () => document.getElementById('mobile-menu').classList.contains('hidden'));
        const before = await hidden();
        await page.click('#hamburger-btn');
        await page.waitForTimeout(150);
        const after = await hidden();
        await page.setViewportSize({ width: 1280, height: 900 });
        return before === after ? 'hamburger did not toggle the mobile menu' : null;
      });

      await page.close();
    }

    /* ── Calculator page ───────────────────────────────────── */
    {
      const page = await ctx.newPage();
      await page.goto(url('pages/calculator.html'), { waitUntil: 'load' });
      await page.waitForTimeout(200);

      await test('calculator produces results from a valid bill', page, async () => {
        await page.selectOption('#calc-country', 'nigeria');
        await page.fill('#calc-bill', '80000');
        await page.waitForTimeout(250);
        const visible = await page.isVisible('#calc-results');
        if (!visible) return 'results panel stayed hidden';
        const size = (await page.locator('#res-system-size').textContent()).trim();
        if (!/^\d+(\.\d+)?\s*kWp$/.test(size)) return `system size reads "${size}"`;
        const savings = (await page.locator('#res-annual-savings').textContent()).trim();
        if (!savings.includes('₦')) return `annual savings "${savings}" is not in naira`;
        return null;
      });

      await test('displayed annual saving equals twelve monthly bills', page, async () => {
        const txt = (await page.locator('#res-annual-savings').textContent()).trim();
        const n = Number(txt.replace(/[^\d]/g, ''));
        return n === 80000 * 12 ? null : `showed ${n}, expected ${80000 * 12}`;
      });

      await test('changing country updates the tariff and currency symbol', page, async () => {
        await page.selectOption('#calc-country', 'germany');
        await page.waitForTimeout(200);
        const tariff = await page.inputValue('#calc-tariff');
        if (Number(tariff) !== 0.30) return `tariff became "${tariff}", expected 0.3`;
        const sym = (await page.locator('#calc-bill-currency').textContent()).trim();
        return sym === '€' ? null : `currency symbol is "${sym}", expected €`;
      });

      await test('an invalid bill hides stale results and shows an error', page, async () => {
        await page.selectOption('#calc-country', 'nigeria');
        await page.fill('#calc-bill', '80000');
        await page.waitForTimeout(220);
        if (!(await page.isVisible('#calc-results'))) return 'setup: results never appeared';
        await page.fill('#calc-bill', '0');
        await page.waitForTimeout(220);
        if (await page.isVisible('#calc-results')) {
          return 'results from the previous input stayed on screen after the bill was cleared';
        }
        const err = (await page.locator('#bill-error').textContent()).trim();
        return err.length ? null : 'no error message shown for a zero bill';
      });

      await test('system type changes the installed cost', page, async () => {
        await page.fill('#calc-bill', '80000');
        await page.selectOption('#calc-system-type', 'grid-tied');
        await page.waitForTimeout(200);
        const grid = (await page.locator('#res-installed-cost').textContent()).trim();
        await page.selectOption('#calc-system-type', 'off-grid');
        await page.waitForTimeout(200);
        const off = (await page.locator('#res-installed-cost').textContent()).trim();
        return grid === off ? `cost stayed "${grid}" when switching to off-grid` : null;
      });

      await test('accordion opens and closes', page, async () => {
        const first = page.locator('.accordion-item').first();
        if (!(await first.count())) return null;
        const open = () => first.evaluate((el) => el.classList.contains('open'));
        if (await open()) return 'first item was already open';
        await first.locator('.accordion-header').click();
        await page.waitForTimeout(180);
        if (!(await open())) return 'clicking the header did not open the item';
        await first.locator('.accordion-header').click();
        await page.waitForTimeout(180);
        return (await open()) ? 'clicking again did not close it' : null;
      });

      await test('accordion body actually expands', page, async () => {
        const first = page.locator('.accordion-item').first();
        await first.locator('.accordion-header').click();
        await page.waitForTimeout(500);
        const h = await first.locator('.accordion-body').evaluate((el) => el.getBoundingClientRect().height);
        await first.locator('.accordion-header').click();
        return h > 10 ? null : `body height is ${h}px when open`;
      });

      await page.close();
    }

    /* ── Portfolio page ────────────────────────────────────── */
    {
      const page = await ctx.newPage();
      await page.goto(url('pages/portfolio.html'), { waitUntil: 'load' });
      await page.waitForTimeout(200);

      await test('portfolio filter hides non-matching projects', page, async () => {
        const total = await page.locator('.project-card').count();
        if (!total) return 'no .project-card elements found';
        await page.click('.filter-btn[data-filter="residential"]');
        await page.waitForTimeout(250);
        const shown = await page.locator('.project-card:visible').count();
        if (shown === 0) return 'the residential filter hid every project';
        if (shown === total) return `all ${total} projects still visible after filtering`;
        return null;
      });

      await test('the "all" filter restores every project', page, async () => {
        await page.click('.filter-btn[data-filter="all"]');
        await page.waitForTimeout(250);
        const total = await page.locator('.project-card').count();
        const shown = await page.locator('.project-card:visible').count();
        return shown === total ? null : `${shown} of ${total} visible`;
      });

      await test('filter button reflects pressed state', page, async () => {
        await page.click('.filter-btn[data-filter="commercial"]');
        await page.waitForTimeout(150);
        const pressed = await page.getAttribute('.filter-btn[data-filter="commercial"]', 'aria-pressed');
        const other = await page.getAttribute('.filter-btn[data-filter="all"]', 'aria-pressed');
        if (pressed !== 'true') return `commercial aria-pressed is "${pressed}"`;
        return other === 'false' ? null : `"all" stayed aria-pressed="${other}"`;
      });

      await test('clicking a project opens the lightbox with content', page, async () => {
        await page.click('.filter-btn[data-filter="all"]');
        await page.waitForTimeout(200);
        await page.locator('.project-card').first().click();
        await page.waitForTimeout(300);
        const open = await page.evaluate(
          () => document.getElementById('lightbox-overlay').classList.contains('open'));
        if (!open) return 'lightbox did not open';
        const inner = (await page.locator('#lightbox-content-inner').innerHTML()).trim();
        return inner.length > 40 ? null : 'lightbox opened but is empty';
      });

      await test('Escape closes the lightbox', page, async () => {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
        const open = await page.evaluate(
          () => document.getElementById('lightbox-overlay').classList.contains('open'));
        if (open) return 'Escape did not close the lightbox';
        const overflow = await page.evaluate(() => document.body.style.overflow);
        return overflow === '' ? null : `body overflow left as "${overflow}" — the page cannot scroll`;
      });

      await page.close();
    }

    /* ── Contact page ──────────────────────────────────────── */
    {
      const page = await ctx.newPage();
      await page.goto(url('pages/contact.html'), { waitUntil: 'load' });
      await page.waitForTimeout(200);

      await test('submitting an empty form is blocked and reports errors', page, async () => {
        await page.click('#contact-form button[type="submit"]');
        await page.waitForTimeout(300);
        const shown = await page.locator('.form-error.show').count();
        if (shown === 0) return 'no validation errors appeared on an empty submit';
        const success = await page.isVisible('#form-success');
        return success ? 'the success message showed despite invalid input' : null;
      });

      await test('a malformed email is rejected', page, async () => {
        await page.fill('#contact-email', 'not-an-email');
        await page.locator('#contact-email').blur();
        await page.waitForTimeout(200);
        const err = (await page.locator('#email-error').textContent()).trim();
        return err.length ? null : 'no error for "not-an-email"';
      });

      await test('a valid email clears the error', page, async () => {
        await page.fill('#contact-email', 'adaeze@example.com');
        await page.locator('#contact-email').blur();
        await page.waitForTimeout(200);
        const visible = await page.locator('#email-error.show').count();
        return visible === 0 ? null : 'error stayed visible for a valid address';
      });

      await test('a complete form submits and confirms', page, async () => {
        await page.fill('#contact-name', 'Adaeze Chukwu');
        await page.fill('#contact-email', 'adaeze@example.com');
        await page.fill('#contact-phone', '+234 800 000 0000');
        await page.selectOption('#contact-country', { index: 1 });
        await page.selectOption('#contact-service', { index: 1 });
        await page.fill('#contact-message', 'I would like a quote for a 10 kWp hybrid system in Lekki.');
        await page.click('#contact-form button[type="submit"]');
        await page.waitForTimeout(1400);
        const ok = await page.isVisible('#form-success');
        if (!ok) return 'no success confirmation after a valid submit';
        const name = await page.inputValue('#contact-name');
        return name === '' ? null : `form was not reset (name still "${name}")`;
      });

      await page.close();
    }
  } finally {
    await ctx.close();
    await browser.close();
  }

  return report.counted(ran);
};
