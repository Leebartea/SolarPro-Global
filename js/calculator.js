/**
 * SolarPro Global — calculator.js
 * ─────────────────────────────────────────────────────────────
 * Interactive Solar Savings Calculator.
 *
 * The arithmetic lives in `computeSolar()`, a pure function with no DOM
 * access, so it can be unit-tested directly. Everything below it is wiring.
 * Run the tests with `npm run check` (see guardrails/checks/calculator-math.js).
 *
 * MODEL
 *   The system is sized to offset the customer's consumption exactly, so the
 *   annual saving equals the annual bill. Everything else follows from that.
 *
 *   monthly_kWh    = monthly_bill ÷ tariff
 *   daily_demand   = monthly_kWh × 12 ÷ 365
 *   system_kWp     = daily_demand ÷ (PSH × performance_ratio)
 *   daily_yield    = system_kWp × PSH × performance_ratio
 *   annual_kWh     = daily_yield × 365
 *   annual_saving  = annual_kWh × tariff
 *   installed_cost = system_kWp × $800 × system_multiplier × fx_rate
 *   payback_years  = installed_cost ÷ annual_saving
 *   co2_kg_yr      = annual_kWh × country_grid_intensity
 *   savings_25yr   = annual_saving × 25
 *
 *   Note `12 ÷ 365`, not `÷ 30`. Treating every month as 30 days inflates the
 *   annual figure by 1.4% (365/360), which then propagates into the payback
 *   period and the 25-year total.
 *
 * ESTIMATES ONLY. Not an engineering tool — see LICENSE.txt §5.
 *
 * DATA SOURCES
 *   Irradiance → NASA POWER / PVGIS / Solargis
 *   Tariffs    → IEA, NERC Nigeria, Eurostat, EIA USA (2024–2025)
 *   Grid CO₂   → IEA national grid emission factors
 */

/* ── Country data — keys match the HTML <select> option values ── */
var COUNTRY_DATA = {
  nigeria: {
    name:       'Nigeria',
    flag:       '🇳🇬',
    psh:        5.5,       // Peak Sun Hours/day (PVGIS, tropical avg)
    tariff:     68,        // ₦/kWh — NERC Band A–D blended avg
    currSymbol: '₦',
    currName:   'NGN',
    usdRate:    1550,      // 1 USD ≈ ₦1,550 (2025 CBN rate)
    co2:        0.43,      // kg CO₂/kWh — predominantly gas grid
    pr:         0.78       // Performance Ratio (heat de-rating in tropics)
  },
  usa: {
    name: 'United States', flag: '🇺🇸',
    psh: 5.0, tariff: 0.13, currSymbol: '$', currName: 'USD',
    usdRate: 1, co2: 0.37, pr: 0.80
  },
  germany: {
    name: 'Germany', flag: '🇩🇪',
    psh: 3.5, tariff: 0.30, currSymbol: '€', currName: 'EUR',
    usdRate: 0.93, co2: 0.23, pr: 0.81
  },
  india: {
    name: 'India', flag: '🇮🇳',
    psh: 5.2, tariff: 8, currSymbol: '₹', currName: 'INR',
    usdRate: 83, co2: 0.70, pr: 0.79            // high coal grid
  },
  ghana: {
    name: 'Ghana', flag: '🇬🇭',
    psh: 5.3, tariff: 1.50, currSymbol: 'GH₵', currName: 'GHS',
    usdRate: 15.5, co2: 0.40, pr: 0.78
  },
  uae: {
    name: 'UAE', flag: '🇦🇪',
    psh: 5.8, tariff: 0.23, currSymbol: 'AED', currName: 'AED',
    usdRate: 3.67, co2: 0.38, pr: 0.77          // desert heat de-rating
  },
  uk: {
    name: 'United Kingdom', flag: '🇬🇧',
    psh: 3.2, tariff: 0.28, currSymbol: '£', currName: 'GBP',
    usdRate: 0.79, co2: 0.19, pr: 0.80          // low-carbon grid
  },
  south_africa: {
    name: 'South Africa', flag: '🇿🇦',
    psh: 5.5, tariff: 2.50, currSymbol: 'R', currName: 'ZAR',
    usdRate: 18.5, co2: 0.90, pr: 0.80          // high coal dependency
  },
  kenya: {
    name: 'Kenya', flag: '🇰🇪',
    psh: 5.4, tariff: 25, currSymbol: 'KSh', currName: 'KES',
    usdRate: 130, co2: 0.35, pr: 0.79
  },
  brazil: {
    name: 'Brazil', flag: '🇧🇷',
    psh: 5.0, tariff: 0.80, currSymbol: 'R$', currName: 'BRL',
    usdRate: 5.0, co2: 0.08, pr: 0.80           // hydro-dominant — very low CO₂
  }
};

/* System type cost multipliers ($800/kWp base for grid-tied) */
var SYS_MULTIPLIERS = {
  'grid-tied': { mult: 1.00, label: 'Grid-Tied',         note: 'Grid-tied system: lowest upfront cost. Exports excess power to grid. No battery backup — power cuts during grid outages.' },
  'hybrid':    { mult: 1.45, label: 'Hybrid (Battery)',  note: 'Hybrid system: battery backup for outages + grid connection. Best of both worlds. Ideal for areas with intermittent grid supply.' },
  'off-grid':  { mult: 1.85, label: 'Off-Grid (Battery)', note: 'Off-grid system: full energy independence. Larger battery bank. Higher upfront cost, no grid bills. Perfect for remote locations.' }
};

var BASE_COST_PER_KWP_USD = 800;   // industry benchmark, grid-tied
var DEFAULT_PERF_RATIO    = 0.80;  // used only if a country omits its own
var DEFAULT_CO2_FACTOR    = 0.43;  // used only if a country omits its own
var M2_PER_KWP            = 6;     // roof area rule of thumb
var MONTHS_PER_YEAR       = 12;
var DAYS_PER_YEAR         = 365;

/**
 * Pure calculation. No DOM, no globals mutated, no side effects.
 *
 * @param {object} input
 *   {number} bill      monthly electricity bill, local currency
 *   {number} tariff    price per kWh, local currency
 *   {string} country   key into COUNTRY_DATA
 *   {string} systemType key into SYS_MULTIPLIERS
 *   {number} [areaM2]  available roof area, optional
 * @returns {{ok: true, ...results} | {ok: false, error: string, field: string}}
 */
function computeSolar(input) {
  var bill       = Number(input.bill);
  var tariff     = Number(input.tariff);
  var country    = COUNTRY_DATA[input.country];
  var sys        = SYS_MULTIPLIERS[input.systemType] || SYS_MULTIPLIERS['grid-tied'];
  var areaM2     = Number(input.areaM2) || 0;

  if (!country) {
    return { ok: false, field: 'country', error: 'Please choose a country.' };
  }
  if (!isFinite(bill) || bill <= 0) {
    return { ok: false, field: 'bill', error: 'Please enter your monthly electricity bill.' };
  }
  if (!isFinite(tariff) || tariff <= 0) {
    return { ok: false, field: 'tariff', error: 'Please enter your electricity tariff per kWh.' };
  }

  var monthlyKwh = bill / tariff;
  if (monthlyKwh < 1) {
    return {
      ok: false, field: 'bill',
      error: 'That bill is less than the cost of 1 kWh. Check the bill and tariff are in the same currency.'
    };
  }

  var pr  = country.pr  || DEFAULT_PERF_RATIO;
  var co2 = country.co2 || DEFAULT_CO2_FACTOR;

  var dailyDemandKwh = monthlyKwh * MONTHS_PER_YEAR / DAYS_PER_YEAR;
  var systemKwp      = dailyDemandKwh / (country.psh * pr);
  var dailyYieldKwh  = systemKwp * country.psh * pr;
  var annualKwh      = dailyYieldKwh * DAYS_PER_YEAR;

  var annualSavings  = annualKwh * tariff;
  var costUsd        = systemKwp * BASE_COST_PER_KWP_USD * sys.mult;
  var costLocal      = costUsd * country.usdRate;
  var paybackYrs     = costLocal / annualSavings;
  var savings25yr    = annualSavings * 25;
  var co2KgYr        = annualKwh * co2;

  var areaNeededM2   = systemKwp * M2_PER_KWP;
  var areaShortfall  = areaM2 > 0 && areaM2 < areaNeededM2;

  return {
    ok: true,
    country: country,
    system: sys,
    monthlyKwh: monthlyKwh,
    systemKwp: systemKwp,
    dailyYieldKwh: dailyYieldKwh,
    annualKwh: annualKwh,
    annualSavings: annualSavings,
    costLocal: costLocal,
    paybackYrs: paybackYrs,
    savings25yr: savings25yr,
    co2KgYr: co2KgYr,
    areaNeededM2: areaNeededM2,
    areaShortfall: areaShortfall,
    maxKwpForArea: areaM2 > 0 ? areaM2 / M2_PER_KWP : null
  };
}

/* ── DOM helpers ─────────────────────────────────────────────── */
function $(id) { return document.getElementById(id); }

function setText(id, val) {
  var el = $(id);
  if (el) el.textContent = val;
}

function fmtNum(n, decimals) {
  decimals = decimals || 0;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/* ── Update currency symbols and tariff when country changes ─── */
function updateCountryDefaults() {
  var countryEl = $('calc-country');
  if (!countryEl) return;

  var c = COUNTRY_DATA[countryEl.value];
  if (!c) return;

  var tariffEl = $('calc-tariff');
  if (tariffEl) tariffEl.value = c.tariff;

  var billCurr   = $('calc-bill-currency');
  var tariffCurr = $('calc-tariff-currency');
  var tariffUnit = $('calc-tariff-unit');

  if (billCurr)   billCurr.textContent   = c.currSymbol;
  if (tariffCurr) tariffCurr.textContent = c.currSymbol;
  if (tariffUnit) tariffUnit.textContent = c.currName + ' per kWh';
}

/** Clear any field error and hide a stale results panel. */
function clearResults(message, field) {
  ['bill-error', 'tariff-error'].forEach(function (id) {
    var el = $(id);
    if (!el) return;
    var mine = message && id === field + '-error';
    el.textContent = mine ? message : '';
    el.classList.toggle('show', Boolean(mine));
  });

  // Results that no longer match the inputs are worse than no results.
  var results = $('calc-results');
  var intro   = $('calc-intro');
  if (results) results.style.display = 'none';
  if (intro)   intro.style.display   = '';
}

/* ── Read the form, compute, render ──────────────────────────── */
function calculate() {
  var countryEl = $('calc-country');
  var billEl    = $('calc-bill');
  var tariffEl  = $('calc-tariff');
  var areaEl    = $('calc-area');
  var sysEl     = $('calc-system-type');

  var result = computeSolar({
    country:    countryEl ? countryEl.value : 'nigeria',
    bill:       billEl    ? billEl.value    : '',
    tariff:     tariffEl  ? tariffEl.value  : '',
    areaM2:     areaEl    ? areaEl.value    : 0,
    systemType: sysEl     ? sysEl.value     : 'grid-tied'
  });

  if (!result.ok) {
    clearResults(result.error, result.field);
    return result;
  }

  clearResults();
  displayResults(result);
  return result;
}

function displayResults(r) {
  var sym = r.country.currSymbol;

  setText('res-system-size',    r.systemKwp.toFixed(1) + ' kWp');
  setText('res-daily-yield',    fmtNum(r.dailyYieldKwh, 1) + ' kWh/day');
  setText('res-annual-prod',    fmtNum(Math.round(r.annualKwh)) + ' kWh/yr');
  setText('res-annual-savings', sym + fmtNum(Math.round(r.annualSavings)) + '/yr');
  setText('res-installed-cost', sym + fmtNum(Math.round(r.costLocal)));
  setText('res-payback',        r.paybackYrs >= 99 ? 'Over 99 years' : r.paybackYrs.toFixed(1) + ' years');
  setText('res-co2',            fmtNum(Math.round(r.co2KgYr)) + ' kg/yr');
  setText('res-25year',         sym + fmtNum(Math.round(r.savings25yr)));

  var noteEl = $('res-system-note');
  if (noteEl) noteEl.textContent = r.country.flag + '  ' + r.system.note;

  var areaWarning = $('res-area-warning');
  if (areaWarning) {
    if (r.areaShortfall) {
      areaWarning.textContent =
        '⚠️ Your available area fits about ' + r.maxKwpForArea.toFixed(1) + ' kWp. ' +
        'The optimal system size of ' + r.systemKwp.toFixed(1) + ' kWp needs around ' +
        Math.ceil(r.areaNeededM2) + ' m². Consider a partial-offset system.';
      areaWarning.style.display = 'block';
    } else {
      areaWarning.style.display = 'none';
    }
  }

  var intro   = $('calc-intro');
  var results = $('calc-results');
  if (intro)   intro.style.display = 'none';
  if (results) {
    results.style.display = 'block';
    results.style.opacity = '1';
  }
}

/* ── Init ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  if (!$('calc-country')) return;   // not the calculator page

  updateCountryDefaults();

  var countryEl = $('calc-country');
  if (countryEl) {
    countryEl.addEventListener('change', function () {
      updateCountryDefaults();
      calculate();
    });
  }

  var btn = $('calc-btn');
  if (btn) {
    btn.addEventListener('click', function () {
      var orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Calculating…';
      setTimeout(function () {
        calculate();
        btn.disabled = false;
        btn.textContent = orig;
      }, 350);
    });
  }

  ['calc-bill', 'calc-tariff', 'calc-area', 'calc-system-type'].forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('input',  calculate);
    el.addEventListener('change', calculate);
  });
});

/* Exposed for the unit tests in guardrails/checks/calculator-math.js.
   Also lets a buyer call the maths from their own code. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeSolar: computeSolar, COUNTRY_DATA: COUNTRY_DATA, SYS_MULTIPLIERS: SYS_MULTIPLIERS };
} else if (typeof window !== 'undefined') {
  window.SolarProCalc = { computeSolar: computeSolar, COUNTRY_DATA: COUNTRY_DATA, SYS_MULTIPLIERS: SYS_MULTIPLIERS };
}
