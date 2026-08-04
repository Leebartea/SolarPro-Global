'use strict';
/**
 * Load every page in a real browser with the network cut, and assert it works.
 *
 * This is the check that models the failure the project actually hit: on one
 * Nigerian ISP the demo host is unreachable, and anything the page fetches from
 * elsewhere simply never arrives. A template that depends on a CDN does not
 * degrade gracefully there — it renders as unstyled serif text.
 *
 * Every request to a non-file:// origin is aborted, then each page must still
 * present: a styled navbar, a heading, working theme variables, and no console
 * errors. It also verifies the theme toggle and that the primary buttons have
 * real layout, which is what silently regressed in v1.0.
 */

const path = require('path');
const { Report } = require('../lib/report');
const { ROOT, PAGES } = require('../lib/project');

module.exports = async function offlineRender() {
  const report = new Report('Offline render — every page works with the network cut');

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    return report.warn('playwright is not installed — run `npm install` to enable this check');
  }

  const browser = await chromium.launch();
  try {
    for (const theme of ['dark', 'light']) {
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion: 'reduce',
      });
      await ctx.addInitScript((t) => {
        try { localStorage.setItem('solarproTheme', t); } catch (e) {}
      }, theme);

      // Hard network cut: only local files may load.
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('file://') || url.startsWith('data:')) return route.continue();
        return route.abort();
      });

      for (const rel of PAGES) {
        const page = await ctx.newPage();
        const errors = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('pageerror', (e) => errors.push(e.message));

        await page.goto('file://' + path.join(ROOT, rel), { waitUntil: 'load' });
        await page.waitForTimeout(250);
        report.counted(1);

        const where = `${rel} [${theme}]`;

        for (const e of errors.slice(0, 3)) {
          report.error(`console error offline: ${e.slice(0, 110)}`, where);
        }

        const probe = await page.evaluate(() => {
          const nav = document.querySelector('.navbar');
          const btn = document.querySelector('.btn-primary');
          const h1 = document.querySelector('h1');
          const cs = (el) => (el ? getComputedStyle(el) : null);
          const navStyle = cs(nav);
          const btnStyle = cs(btn);
          const bodyBg = getComputedStyle(document.body).backgroundColor
                      || getComputedStyle(document.documentElement).backgroundColor;
          return {
            hasNav: !!nav,
            navFixed: navStyle ? navStyle.position === 'fixed' : false,
            hasH1: !!h1 && h1.textContent.trim().length > 0,
            hasBtn: !!btn,
            btnInline: btnStyle ? btnStyle.display.includes('flex') : false,
            btnRadius: btnStyle ? parseFloat(btnStyle.borderRadius) : 0,
            rootBg: bodyBg,
            themeClass: document.documentElement.className,
            imgBroken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
          };
        });

        if (!probe.hasNav) report.error('no .navbar element rendered', where);
        else if (!probe.navFixed) report.error('.navbar is not position:fixed — its stylesheet did not apply', where);
        if (!probe.hasH1) report.error('page has no non-empty <h1>', where);
        if (!probe.hasBtn) report.error('no .btn-primary on the page', where);
        else {
          if (!probe.btnInline) {
            report.error('.btn-primary is not laid out as a flex button — base button styles are missing', where);
          }
          if (probe.btnRadius < 4) {
            report.error(`.btn-primary has border-radius ${probe.btnRadius}px — button styling did not apply`, where);
          }
        }
        if (probe.imgBroken > 0) {
          report.error(`${probe.imgBroken} image(s) failed to load from local files`, where);
        }
        if (!probe.themeClass.includes(theme)) {
          report.error(`<html> is missing the "${theme}" class — theme bootstrap did not run`, where);
        }

        await page.close();
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  return report;
};
