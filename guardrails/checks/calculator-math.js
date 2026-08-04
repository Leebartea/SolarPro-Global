'use strict';
/**
 * Unit tests for the solar calculator's arithmetic.
 *
 * The calculator is the template's main differentiator and the reason a
 * visitor stays on the page. A wrong payback period or CO₂ figure is not a
 * cosmetic bug — it is a number a buyer will repeat to their own customer.
 *
 * Two real defects prompted these tests:
 *
 *  - Every country carried a researched grid CO₂ intensity (Brazil 0.08 for a
 *    hydro grid, South Africa 0.90 for coal) and the code ignored all of them
 *    in favour of one hardcoded 0.43. Brazil's CO₂ saving was overstated more
 *    than fivefold and South Africa's understated by half.
 *  - Annual figures were derived as `monthly ÷ 30 × 365`, treating every month
 *    as 30 days. That inflated annual savings, the 25-year total and the
 *    payback period by 1.4%.
 *
 * These run in plain Node — no browser, no DOM.
 */

const path = require('path');
const { Report } = require('../lib/report');

const CALC = path.join(__dirname, '..', '..', 'js', 'calculator.js');

/** Load calculator.js in a Node context with the DOM calls stubbed out. */
function loadCalculator() {
  const Module = require('module');
  const fs = require('fs');
  const src = fs.readFileSync(CALC, 'utf8');

  // The file registers DOM listeners at the top level; give it just enough
  // of a document to no-op, then read its module.exports.
  const sandboxPrelude = `
    var document = { addEventListener: function () {}, getElementById: function () { return null; } };
    var window = undefined;
  `;
  const m = new Module(CALC, null);
  m.filename = CALC;
  m.paths = Module._nodeModulePaths(path.dirname(CALC));
  m._compile(sandboxPrelude + src, CALC);
  return m.exports;
}

const approx = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

module.exports = function calculatorMath() {
  const report = new Report('Calculator maths — formulas produce correct figures');

  let calc;
  try {
    calc = loadCalculator();
  } catch (err) {
    return report.error(`could not load js/calculator.js: ${err.message}`);
  }

  const { computeSolar, COUNTRY_DATA, SYS_MULTIPLIERS } = calc;
  if (typeof computeSolar !== 'function') {
    return report.error('js/calculator.js does not export computeSolar()');
  }

  let ran = 0;
  const check = (name, fn) => {
    ran++;
    try {
      const problem = fn();
      if (problem) report.error(problem, name);
    } catch (err) {
      report.error(`threw: ${err.message}`, name);
    }
  };

  // ── Rejections ────────────────────────────────────────────────
  check('rejects a zero bill', () => {
    const r = computeSolar({ country: 'nigeria', bill: 0, tariff: 68, systemType: 'grid-tied' });
    if (r.ok) return 'accepted a bill of 0';
    if (r.field !== 'bill') return `reported field "${r.field}", expected "bill"`;
    return null;
  });

  check('rejects a negative bill', () => {
    const r = computeSolar({ country: 'nigeria', bill: -5000, tariff: 68, systemType: 'grid-tied' });
    return r.ok ? 'accepted a negative bill' : null;
  });

  check('rejects a non-numeric bill', () => {
    const r = computeSolar({ country: 'nigeria', bill: 'abc', tariff: 68, systemType: 'grid-tied' });
    return r.ok ? 'accepted a non-numeric bill' : null;
  });

  check('rejects a zero tariff rather than dividing by zero', () => {
    const r = computeSolar({ country: 'nigeria', bill: 80000, tariff: 0, systemType: 'grid-tied' });
    if (r.ok) return 'accepted a tariff of 0';
    if (r.field !== 'tariff') return `reported field "${r.field}", expected "tariff"`;
    return null;
  });

  check('rejects an unknown country', () => {
    const r = computeSolar({ country: 'atlantis', bill: 80000, tariff: 68, systemType: 'grid-tied' });
    return r.ok ? 'accepted an unknown country' : null;
  });

  check('rejects a bill smaller than one kWh', () => {
    const r = computeSolar({ country: 'nigeria', bill: 50, tariff: 68, systemType: 'grid-tied' });
    return r.ok ? 'accepted a bill below the cost of 1 kWh' : null;
  });

  // ── Core identity ─────────────────────────────────────────────
  check('annual saving equals twelve monthly bills', () => {
    const bill = 80000;
    const r = computeSolar({ country: 'nigeria', bill, tariff: 68, systemType: 'grid-tied' });
    if (!r.ok) return 'valid input was rejected';
    const expected = bill * 12;
    if (!approx(r.annualSavings, expected, 1e-9)) {
      return `annual saving ${r.annualSavings.toFixed(2)}, expected ${expected} ` +
             `(a 30-day month would give ${(bill * 365 / 30).toFixed(2)})`;
    }
    return null;
  });

  check('annual production matches annual demand', () => {
    const bill = 80000, tariff = 68;
    const r = computeSolar({ country: 'nigeria', bill, tariff, systemType: 'grid-tied' });
    const expectedKwh = (bill / tariff) * 12;
    return approx(r.annualKwh, expectedKwh, 1e-9)
      ? null
      : `annual kWh ${r.annualKwh.toFixed(2)}, expected ${expectedKwh.toFixed(2)}`;
  });

  check('25-year saving is exactly 25 annual savings', () => {
    const r = computeSolar({ country: 'kenya', bill: 12000, tariff: 25, systemType: 'hybrid' });
    return approx(r.savings25yr, r.annualSavings * 25, 1e-9) ? null : '25-year total is not 25×annual';
  });

  check('daily yield × 365 equals annual production', () => {
    const r = computeSolar({ country: 'ghana', bill: 900, tariff: 1.5, systemType: 'grid-tied' });
    return approx(r.dailyYieldKwh * 365, r.annualKwh, 1e-9) ? null : 'daily yield and annual production disagree';
  });

  // ── System sizing ─────────────────────────────────────────────
  check('system size follows irradiance and performance ratio', () => {
    const bill = 80000, tariff = 68, key = 'nigeria';
    const c = COUNTRY_DATA[key];
    const r = computeSolar({ country: key, bill, tariff, systemType: 'grid-tied' });
    const expected = ((bill / tariff) * 12 / 365) / (c.psh * c.pr);
    return approx(r.systemKwp, expected, 1e-9)
      ? null
      : `system size ${r.systemKwp.toFixed(4)} kWp, expected ${expected.toFixed(4)}`;
  });

  check('a sunnier country needs a smaller system for the same demand', () => {
    const demandKwh = 1000;
    const uk = computeSolar({ country: 'uk', bill: demandKwh * 0.28, tariff: 0.28, systemType: 'grid-tied' });
    const ae = computeSolar({ country: 'uae', bill: demandKwh * 0.23, tariff: 0.23, systemType: 'grid-tied' });
    return ae.systemKwp < uk.systemKwp
      ? null
      : `UAE (${ae.systemKwp.toFixed(2)} kWp) should need less than the UK (${uk.systemKwp.toFixed(2)} kWp)`;
  });

  check('system size scales linearly with the bill', () => {
    const a = computeSolar({ country: 'usa', bill: 100, tariff: 0.13, systemType: 'grid-tied' });
    const b = computeSolar({ country: 'usa', bill: 200, tariff: 0.13, systemType: 'grid-tied' });
    return approx(b.systemKwp, a.systemKwp * 2, 1e-9) ? null : 'doubling the bill did not double the system size';
  });

  // ── Cost and payback ──────────────────────────────────────────
  check('installed cost uses the system-type multiplier', () => {
    const base = { country: 'nigeria', bill: 80000, tariff: 68 };
    const grid = computeSolar({ ...base, systemType: 'grid-tied' });
    const off  = computeSolar({ ...base, systemType: 'off-grid' });
    const ratio = SYS_MULTIPLIERS['off-grid'].mult / SYS_MULTIPLIERS['grid-tied'].mult;
    return approx(off.costLocal, grid.costLocal * ratio, 1e-9)
      ? null
      : `off-grid cost ratio ${(off.costLocal / grid.costLocal).toFixed(4)}, expected ${ratio}`;
  });

  check('an unknown system type falls back to grid-tied', () => {
    const base = { country: 'nigeria', bill: 80000, tariff: 68 };
    const bogus = computeSolar({ ...base, systemType: 'warp-drive' });
    const grid  = computeSolar({ ...base, systemType: 'grid-tied' });
    return approx(bogus.costLocal, grid.costLocal, 1e-9) ? null : 'unknown system type did not fall back to grid-tied';
  });

  check('installed cost is converted to local currency', () => {
    const c = COUNTRY_DATA['nigeria'];
    const r = computeSolar({ country: 'nigeria', bill: 80000, tariff: 68, systemType: 'grid-tied' });
    const expected = r.systemKwp * 800 * 1.0 * c.usdRate;
    return approx(r.costLocal, expected, 1e-9) ? null : 'installed cost is not cost_usd × fx rate';
  });

  check('payback is independent of the bill size', () => {
    const a = computeSolar({ country: 'south_africa', bill: 2000, tariff: 2.5, systemType: 'grid-tied' });
    const b = computeSolar({ country: 'south_africa', bill: 9000, tariff: 2.5, systemType: 'grid-tied' });
    return approx(a.paybackYrs, b.paybackYrs, 1e-9)
      ? null
      : `payback changed with bill size: ${a.paybackYrs.toFixed(3)} vs ${b.paybackYrs.toFixed(3)}`;
  });

  check('payback equals cost divided by annual saving', () => {
    const r = computeSolar({ country: 'india', bill: 4000, tariff: 8, systemType: 'hybrid' });
    return approx(r.paybackYrs, r.costLocal / r.annualSavings, 1e-9) ? null : 'payback is not cost ÷ annual saving';
  });

  check('every country yields a plausible payback (1–40 years)', () => {
    const bad = [];
    for (const key of Object.keys(COUNTRY_DATA)) {
      const c = COUNTRY_DATA[key];
      const r = computeSolar({ country: key, bill: c.tariff * 1000, tariff: c.tariff, systemType: 'grid-tied' });
      if (!r.ok) { bad.push(`${key}: rejected`); continue; }
      if (!(r.paybackYrs > 1 && r.paybackYrs < 40)) {
        bad.push(`${key}: ${r.paybackYrs.toFixed(1)} yrs`);
      }
    }
    return bad.length ? `implausible payback — ${bad.join(', ')}` : null;
  });

  // ── CO₂ ───────────────────────────────────────────────────────
  check('CO₂ uses each country\'s own grid intensity', () => {
    const bad = [];
    for (const key of Object.keys(COUNTRY_DATA)) {
      const c = COUNTRY_DATA[key];
      const r = computeSolar({ country: key, bill: c.tariff * 1000, tariff: c.tariff, systemType: 'grid-tied' });
      const expected = r.annualKwh * c.co2;
      if (!approx(r.co2KgYr, expected, 1e-9)) {
        bad.push(`${key}: got ${r.co2KgYr.toFixed(1)}, expected ${expected.toFixed(1)}`);
      }
    }
    return bad.length ? bad.join('; ') : null;
  });

  check('a coal grid offsets far more CO₂ than a hydro grid', () => {
    const za = computeSolar({ country: 'south_africa', bill: 2500, tariff: 2.5, systemType: 'grid-tied' });
    const br = computeSolar({ country: 'brazil', bill: 800, tariff: 0.8, systemType: 'grid-tied' });
    // Same 1000 kWh/month of demand in both cases.
    if (!approx(za.annualKwh, br.annualKwh, 1e-9)) return 'test setup: demand differs between the two';
    return za.co2KgYr > br.co2KgYr * 5
      ? null
      : `South Africa ${za.co2KgYr.toFixed(0)} kg vs Brazil ${br.co2KgYr.toFixed(0)} kg — ` +
        `grid intensity is not being applied`;
  });

  // ── Roof area ─────────────────────────────────────────────────
  check('flags a roof that is too small', () => {
    const r = computeSolar({ country: 'nigeria', bill: 80000, tariff: 68, systemType: 'grid-tied', areaM2: 5 });
    return r.areaShortfall ? null : 'a 5 m² roof was not flagged as too small';
  });

  check('does not flag an ample roof', () => {
    const r = computeSolar({ country: 'nigeria', bill: 80000, tariff: 68, systemType: 'grid-tied', areaM2: 5000 });
    return r.areaShortfall ? 'a 5000 m² roof was wrongly flagged as too small' : null;
  });

  check('omitting roof area never flags a shortfall', () => {
    const r = computeSolar({ country: 'nigeria', bill: 80000, tariff: 68, systemType: 'grid-tied' });
    return r.areaShortfall ? 'no area supplied but a shortfall was reported' : null;
  });

  // ── Country data sanity ───────────────────────────────────────
  check('country data is complete and within physical bounds', () => {
    const problems = [];
    for (const [key, c] of Object.entries(COUNTRY_DATA)) {
      for (const f of ['name', 'psh', 'tariff', 'currSymbol', 'currName', 'usdRate', 'co2', 'pr']) {
        if (c[f] === undefined || c[f] === null) problems.push(`${key}.${f} missing`);
      }
      if (!(c.psh > 1 && c.psh < 8))    problems.push(`${key}.psh ${c.psh} outside 1–8 h/day`);
      if (!(c.pr > 0.5 && c.pr <= 1))   problems.push(`${key}.pr ${c.pr} outside 0.5–1.0`);
      if (!(c.co2 >= 0 && c.co2 < 1.5)) problems.push(`${key}.co2 ${c.co2} outside 0–1.5 kg/kWh`);
      if (!(c.usdRate > 0))             problems.push(`${key}.usdRate ${c.usdRate} not positive`);
      if (!(c.tariff > 0))              problems.push(`${key}.tariff ${c.tariff} not positive`);
    }
    return problems.length ? problems.join('; ') : null;
  });

  check('every country in the data has a matching option in the markup', () => {
    const fs = require('fs');
    const html = fs.readFileSync(
      path.join(__dirname, '..', '..', 'pages', 'calculator.html'), 'utf8');
    const inMarkup = new Set(
      [...html.matchAll(/<option\s+value="([a-z_]+)"/g)].map((m) => m[1]));
    const missing = Object.keys(COUNTRY_DATA).filter((k) => !inMarkup.has(k));
    const orphan = [...inMarkup].filter(
      (k) => !COUNTRY_DATA[k] && !SYS_MULTIPLIERS[k] && k !== '');
    const out = [];
    if (missing.length) out.push(`in data but not in the <select>: ${missing.join(', ')}`);
    if (orphan.length)  out.push(`in the <select> but not in the data: ${orphan.join(', ')}`);
    return out.length ? out.join('; ') : null;
  });

  return report.counted(ran);
};
