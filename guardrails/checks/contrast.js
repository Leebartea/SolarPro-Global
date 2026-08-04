'use strict';
/**
 * Text must be readable against what is actually behind it, in both themes.
 *
 * The failure this catches is specific and easy to ship: markup that hardcodes
 * `text-white` or an inline white colour sits on a section whose background is
 * themed. Switch to light mode and the heading turns white-on-near-white. It
 * looks perfect in whichever theme the author worked in, and invisible in the
 * other — and nobody reviews every page in both.
 *
 * Contrast is computed per WCAG 2.1 relative luminance, walking up the DOM for
 * the nearest painted background. The threshold is AA: 4.5:1 for body text,
 * 3:1 for large text (>=24px, or >=18.66px bold).
 */

const path = require('path');
const { Report } = require('../lib/report');
const { ROOT, PAGES } = require('../lib/project');

const MIN_NORMAL = 4.5;
const MIN_LARGE = 3.0;

module.exports = async function contrast() {
  const report = new Report('Contrast — text is readable in both light and dark themes');

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

      for (const rel of PAGES) {
        const page = await ctx.newPage();
        await page.goto('file://' + path.join(ROOT, rel), { waitUntil: 'load' });
        await page.waitForTimeout(200);
        report.counted(1);

        const bad = await page.evaluate(({ minNormal, minLarge }) => {
          const parse = (c) => {
            const m = c.match(/rgba?\(([^)]+)\)/);
            if (!m) return null;
            const p = m[1].split(',').map((n) => parseFloat(n));
            return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
          };
          const lum = ({ r, g, b }) => {
            const f = (v) => {
              v /= 255;
              return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          const ratio = (a, b) => {
            const l1 = lum(a), l2 = lum(b);
            return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          };
          // What is actually painted behind this text, by hit-testing the
          // point rather than walking ancestors.
          //
          // Walking the DOM is wrong here: the hero's photograph lives in an
          // absolutely-positioned sibling layer, so an ancestor walk sails
          // past it to the light page background and reports 1.05:1 for white
          // text that is perfectly legible on a dark photo. Hit-testing sees
          // the layer that is really behind the glyphs.
          //
          // Returns null when that layer is an image or gradient: contrast
          // against a photograph cannot be derived from computed styles, and a
          // check that reports confident falsehoods gets switched off. It
          // declines to guess instead.
          const backdrop = (el) => {
            // An element that paints its own background is its own backdrop —
            // white label text on a gradient button sits on the button, not on
            // whatever section happens to be behind it.
            const ownCs = getComputedStyle(el);
            if (ownCs.backgroundImage && ownCs.backgroundImage !== 'none') return null;
            const own = parse(ownCs.backgroundColor);
            if (own && own.a > 0.5) return own;

            const rect = el.getBoundingClientRect();
            const cx = Math.min(Math.max(rect.left + rect.width / 2, 1), window.innerWidth - 1);
            const cy = Math.min(Math.max(rect.top + rect.height / 2, 1), window.innerHeight - 1);
            const stack = document.elementsFromPoint(cx, cy);
            const start = stack.indexOf(el);
            if (start === -1) return null;
            for (const node of stack.slice(start + 1)) {
              const cs = getComputedStyle(node);
              if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
              if (node.tagName === 'IMG' || node.tagName === 'SVG') return null;
              const bg = parse(cs.backgroundColor);
              if (bg && bg.a > 0.5) return bg;
            }
            const rootCs = getComputedStyle(document.documentElement);
            if (rootCs.backgroundImage && rootCs.backgroundImage !== 'none') return null;
            const html = parse(rootCs.backgroundColor);
            return html && html.a > 0.5 ? html : { r: 255, g: 255, b: 255, a: 1 };
          };

          const out = [];
          const nodes = document.querySelectorAll('h1,h2,h3,p,a,span,li,button,label,div');
          for (const el of nodes) {
            // Only elements holding their own visible text.
            const own = [...el.childNodes]
              .filter((n) => n.nodeType === 3)
              .map((n) => n.textContent.trim())
              .join(' ')
              .trim();
            if (own.length < 4) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.15) continue;
            // Decorative content is exempt: it is hidden from assistive tech and
            // its meaning is carried by a labelled ancestor (the star glyphs sit
            // inside an element with aria-label="5 star rating").
            if (el.closest('[aria-hidden="true"]')) continue;
            let rect = el.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2) continue;
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
            rect = el.getBoundingClientRect();
            // Gradient-clipped text has a transparent fill by design.
            if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue;

            const fg = parse(cs.webkitTextFillColor || cs.color);
            if (!fg || fg.a < 0.5) continue;
            const bg = backdrop(el);
            if (!bg) continue;                    // image/gradient backdrop — not measurable
            const size = parseFloat(cs.fontSize);
            const bold = parseInt(cs.fontWeight, 10) >= 700;
            const large = size >= 24 || (size >= 18.66 && bold);
            const r = ratio(fg, bg);
            const need = large ? minLarge : minNormal;
            if (r < need) {
              out.push({
                text: own.slice(0, 48),
                ratio: Math.round(r * 100) / 100,
                need,
                tag: el.tagName.toLowerCase(),
              });
            }
          }
          // De-duplicate repeated components (nav links, cards).
          const seen = new Set();
          return out.filter((o) => {
            const k = o.tag + o.ratio + o.text.slice(0, 12);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        }, { minNormal: MIN_NORMAL, minLarge: MIN_LARGE });

        for (const b of bad.slice(0, 5)) {
          report.error(
            `contrast ${b.ratio}:1 (needs ${b.need}:1) on <${b.tag}> "${b.text}"`,
            `${rel} [${theme}]`);
        }
        if (bad.length > 5) {
          report.error(`+${bad.length - 5} more low-contrast element(s)`, `${rel} [${theme}]`);
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
