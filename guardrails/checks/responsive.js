'use strict';
/**
 * Layout holds at real device widths.
 *
 * The bug this exists for: a component rule of equal specificity loading after
 * Tailwind beat `.hidden`, so the desktop-only currency switcher and CTA button
 * stayed in the DOM at phone widths. The navbar row overflowed and pushed the
 * hamburger to x=477 in a 390px viewport — off-screen, making the mobile menu
 * unreachable. `body { overflow-x: hidden }` hid the sideways scrollbar, so the
 * page looked fine in a screenshot while being unusable.
 *
 * Three assertions per width:
 *   - nothing extends past the viewport
 *   - the mobile menu control is on-screen and tappable where it should be
 *   - tap targets meet the 44px minimum
 */

const path = require('path');
const { Report } = require('../lib/report');
const { ROOT, PAGES } = require('../lib/project');

// Real devices, not round numbers: iPhone SE, iPhone 14, iPad portrait, laptop.
const WIDTHS = [
  { name: 'iPhone SE',  width: 375, height: 667, mobile: true },
  { name: 'iPhone 14',  width: 390, height: 844, mobile: true },
  { name: 'iPad',       width: 768, height: 1024, mobile: false },
  { name: 'laptop',     width: 1280, height: 800, mobile: false },
];

const MIN_TAP_PX = 44;

module.exports = async function responsive() {
  const report = new Report('Responsive — layout holds at real device widths');

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    return report.warn('playwright is not installed — run `npm install` to enable this check');
  }

  const browser = await chromium.launch();
  try {
    for (const vp of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        reducedMotion: 'reduce',
      });
      await ctx.addInitScript(() => {
        try { localStorage.setItem('cookieOk', '1'); } catch (e) {}
      });

      for (const rel of PAGES) {
        const page = await ctx.newPage();
        await page.goto('file://' + path.join(ROOT, rel), { waitUntil: 'load' });
        // Settle the scroll-reveal animations before measuring. Until an
        // element is revealed AOS parks it 100px to the right, which is a
        // transient state clipped by `overflow-x: hidden` — measuring it would
        // report every below-the-fold section as overflowing. What matters is
        // the layout the reader actually sees.
        await page.evaluate(() => {
          document.querySelectorAll('[data-aos]').forEach((el) => {
            el.classList.add('aos-animate', 'anim');
            el.style.transform = 'none';
            el.style.opacity = '1';
          });
        });
        await page.waitForTimeout(250);
        report.counted(1);

        const where = `${rel} @${vp.width}px (${vp.name})`;

        // Overlays are hidden until opened, so a closed-state sweep never sees
        // them. The mobile currency menu was 49px off the left edge of a 390px
        // screen for exactly this reason: measured shut, it looked fine.
        if (vp.mobile) {
          const burger = await page.$('#hamburger-btn');
          if (burger) {
            await burger.click().catch(() => {});
            await page.waitForTimeout(200);
          }
          for (const trigger of await page.$$('.currency-trigger')) {
            if (!(await trigger.isVisible().catch(() => false))) continue;
            await trigger.click().catch(() => {});
            await page.waitForTimeout(200);
          }

          const stray = await page.evaluate(() => {
            const vw = document.documentElement.clientWidth;
            const out = [];
            for (const el of document.querySelectorAll(
              '.currency-dropdown-menu, #mobile-menu, .lightbox-content')) {
              const cs = getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.1) continue;
              const r = el.getBoundingClientRect();
              if (r.width === 0) continue;
              if (r.left < -1 || r.right > vw + 1) {
                out.push({
                  cls: (el.className || el.id || '').toString().slice(0, 40),
                  left: Math.round(r.left), right: Math.round(r.right), vw,
                });
              }
            }
            return out;
          });

          for (const s of stray) {
            report.error(
              `open overlay "${s.cls}" spans ${s.left}..${s.right}px, outside the ` +
              `${s.vw}px viewport — part of it cannot be seen or tapped`, where);
          }
        }

        const probe = await page.evaluate((minTap) => {
          const vw = document.documentElement.clientWidth;
          const out = { vw, overflow: [], hamburger: null, smallTaps: [] };

          // Content deliberately parked outside a scroller does not count: a
          // carousel track holds every slide side by side and translates them
          // into view, so its off-screen slides are correct, not broken. Only
          // an ancestor that actually clips makes that true.
          const isClipped = (el) => {
            let cur = el.parentElement;
            while (cur && cur !== document.body) {
              const cs = getComputedStyle(cur);
              if (/hidden|clip|auto|scroll/.test(cs.overflowX)) return true;
              cur = cur.parentElement;
            }
            return false;
          };

          // Elements sticking out past the right edge. `overflow-x: hidden` on
          // body suppresses the scrollbar but not the broken layout, so measure
          // rectangles rather than trusting scrollWidth alone.
          for (const el of document.querySelectorAll('body *')) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            if (cs.position === 'fixed') continue;         // off-canvas by design
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (isClipped(el)) continue;
            if (r.right > vw + 1) {
              out.overflow.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className || '').toString().trim().slice(0, 44),
                right: Math.round(r.right),
              });
            }
          }

          const burger = document.getElementById('hamburger-btn');
          if (burger) {
            const cs = getComputedStyle(burger);
            const r = burger.getBoundingClientRect();
            out.hamburger = {
              displayed: cs.display !== 'none',
              onScreen: r.left >= 0 && r.right <= vw + 1,
              right: Math.round(r.right),
              width: Math.round(r.width),
              height: Math.round(r.height),
            };
          }

          // Interactive controls that are too small to tap reliably.
          for (const el of document.querySelectorAll('a, button, [role="button"]')) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            // Inline links inside prose are exempt — the guidance is about
            // standalone controls.
            const inProse = el.tagName === 'A' && ['P', 'LI', 'SPAN'].includes(
              (el.parentElement || {}).tagName);
            if (inProse) continue;
            if (r.height < minTap && r.width < minTap) {
              out.smallTaps.push({
                text: (el.textContent || '').trim().slice(0, 24) || el.getAttribute('aria-label') || el.tagName,
                w: Math.round(r.width),
                h: Math.round(r.height),
              });
            }
          }

          return out;
        }, MIN_TAP_PX);

        // De-duplicate repeated components before reporting.
        const seen = new Set();
        const uniqueOverflow = probe.overflow.filter((o) => {
          const k = o.tag + o.cls;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        for (const o of uniqueOverflow.slice(0, 4)) {
          report.error(
            `<${o.tag}${o.cls ? ' class="' + o.cls + '"' : ''}> extends to ${o.right}px, past the ${probe.vw}px viewport`,
            where);
        }
        if (uniqueOverflow.length > 4) {
          report.error(`+${uniqueOverflow.length - 4} more overflowing element(s)`, where);
        }

        if (probe.hamburger) {
          if (vp.mobile && !probe.hamburger.displayed) {
            report.error('the mobile menu button is hidden at a phone width', where);
          }
          if (probe.hamburger.displayed && !probe.hamburger.onScreen) {
            report.error(
              `the mobile menu button sits at ${probe.hamburger.right}px, outside the ` +
              `${probe.vw}px viewport — it cannot be tapped`, where);
          }
        }

        if (vp.mobile) {
          const tapSeen = new Set();
          const uniqueTaps = probe.smallTaps.filter((t) => {
            if (tapSeen.has(t.text)) return false;
            tapSeen.add(t.text);
            return true;
          });
          for (const t of uniqueTaps.slice(0, 3)) {
            report.warn(`tap target "${t.text}" is ${t.w}×${t.h}px, below ${MIN_TAP_PX}px`, where);
          }
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
