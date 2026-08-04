'use strict';
/**
 * The template renders and behaves correctly in all three engines.
 *
 * Every other browser check in this suite runs on Chromium, which shares an
 * engine with Chrome, Edge, Brave and Opera — a large share of traffic, but
 * not Safari and not Firefox. Safari matters disproportionately here: it is the
 * default on every iPhone, and a large fraction of this template's buyers and
 * their customers browse on one.
 *
 * The failures this catches are the ones Chromium hides — `backdrop-filter`
 * behaving differently in WebKit, `aspect-ratio` and grid edge cases, the
 * `-webkit-background-clip: text` used for the gradient headings, and older
 * `matchMedia` listener APIs that Safari only recently caught up on.
 *
 * Kept deliberately light: load each page, assert the stylesheet applied, the
 * JavaScript initialised, and nothing errored. Depth of behaviour is covered by
 * `behaviour` on Chromium.
 */

const path = require('path');
const { Report } = require('../lib/report');
const { ROOT, PAGES } = require('../lib/project');

const ENGINES = ['webkit', 'firefox'];

module.exports = async function crossBrowser() {
  const report = new Report('Cross-browser — renders and runs in WebKit and Firefox');

  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    return report.warn('playwright is not installed — run `npm install` to enable this check');
  }

  for (const engine of ENGINES) {
    let browser;
    try {
      browser = await playwright[engine].launch();
    } catch (err) {
      // A missing engine binary is a warning, not a release blocker: the check
      // is only meaningful if the browser is actually installed locally.
      report.warn(
        `${engine} is not installed — run \`npx playwright install ${engine}\``,
        engine);
      continue;
    }

    try {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await ctx.addInitScript(() => {
        try {
          localStorage.setItem('solarproTheme', 'dark');
          localStorage.setItem('cookieOk', '1');
        } catch (e) {}
      });

      for (const rel of PAGES) {
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

        await page.goto('file://' + path.join(ROOT, rel), { waitUntil: 'load' });
        await page.waitForTimeout(400);
        report.counted(1);

        const where = `${rel} [${engine}]`;

        for (const e of errors.slice(0, 2)) {
          report.error(`console error: ${e.slice(0, 110)}`, where);
        }

        const probe = await page.evaluate(() => {
          const nav = document.querySelector('.navbar');
          const btn = document.querySelector('.btn-primary');
          const navCs = nav ? getComputedStyle(nav) : null;
          const btnCs = btn ? getComputedStyle(btn) : null;
          return {
            navFixed: navCs ? navCs.position === 'fixed' : false,
            btnRadius: btnCs ? parseFloat(btnCs.borderRadius) : 0,
            btnFlex: btnCs ? btnCs.display.includes('flex') : false,
            themeClass: document.documentElement.className,
            themePref: document.documentElement.dataset.themePref || '',
            brokenImgs: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
            // Proves main.js ran to completion: it fills these in.
            yearFilled: /^\d{4}$/.test(
              (document.querySelector('.footer-year') || {}).textContent || ''),
            overflow: document.documentElement.clientWidth > 0 &&
              [...document.querySelectorAll('body > *')].some((el) => {
                const cs = getComputedStyle(el);
                if (cs.position === 'fixed' || cs.display === 'none') return false;
                return el.getBoundingClientRect().right > document.documentElement.clientWidth + 2;
              }),
          };
        });

        if (!probe.navFixed) report.error('navbar is not position:fixed — stylesheet did not apply', where);
        if (probe.btnRadius < 4) report.error(`.btn-primary border-radius is ${probe.btnRadius}px`, where);
        if (!probe.btnFlex) report.error('.btn-primary is not laid out as a flex button', where);
        if (!probe.themeClass.includes('dark')) {
          report.error(`<html> resolved to "${probe.themeClass}", expected dark`, where);
        }
        if (probe.themePref !== 'dark') {
          report.error(`theme preference attribute is "${probe.themePref}", expected dark`, where);
        }
        if (probe.brokenImgs > 0) report.error(`${probe.brokenImgs} image(s) failed to load`, where);
        if (!probe.yearFilled) report.error('footer year not filled — main.js did not finish', where);
        if (probe.overflow) report.error('a top-level section overflows the viewport', where);

        await page.close();
      }
      await ctx.close();
    } finally {
      await browser.close();
    }
  }

  return report;
};
