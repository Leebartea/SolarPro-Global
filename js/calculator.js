/**
 * SolarPro Global — calculator.js
 * ─────────────────────────────────────────────────────────────
 * Interactive Solar Savings Calculator
 *
 * FORMULAS (industry-standard, IEC 61724):
 *   System Size (kWp)  = (monthly_bill ÷ tariff) ÷ 30 ÷ PSH ÷ 0.80
 *   Daily Yield (kWh)  = system_size × PSH × 0.80
 *   Annual Prod (kWh)  = daily_yield × 365
 *   Annual Savings     = annual_production × local_tariff
 *   Payback (years)    = installed_cost_local ÷ annual_savings
 *   CO₂ Offset (kg/yr) = annual_production × 0.43
 *   25-Year Savings    = annual_savings × 25
 *
 * DATA SOURCES:
 *   Irradiance → NASA POWER / PVGIS / Solargis
 *   Tariffs    → IEA, NERC Nigeria, Eurostat, EIA USA (2024–2025)
 */

/* ── Country data — keys match the HTML <select> option values ── */
const COUNTRY_DATA = {
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
    name:       'United States',
    flag:       '🇺🇸',
    psh:        5.0,
    tariff:     0.13,
    currSymbol: '$',
    currName:   'USD',
    usdRate:    1,
    co2:        0.37,
    pr:         0.80
  },
  germany: {
    name:       'Germany',
    flag:       '🇩🇪',
    psh:        3.5,
    tariff:     0.30,
    currSymbol: '€',
    currName:   'EUR',
    usdRate:    0.93,
    co2:        0.23,
    pr:         0.81
  },
  india: {
    name:       'India',
    flag:       '🇮🇳',
    psh:        5.2,
    tariff:     8,
    currSymbol: '₹',
    currName:   'INR',
    usdRate:    83,
    co2:        0.70,      // high coal grid
    pr:         0.79
  },
  ghana: {
    name:       'Ghana',
    flag:       '🇬🇭',
    psh:        5.3,
    tariff:     1.50,      // GH₵/kWh — PURC 2024 lifeline rate
    currSymbol: 'GH₵',
    currName:   'GHS',
    usdRate:    15.5,
    co2:        0.40,
    pr:         0.78
  },
  uae: {
    name:       'UAE',
    flag:       '🇦🇪',
    psh:        5.8,
    tariff:     0.23,
    currSymbol: 'AED',
    currName:   'AED',
    usdRate:    3.67,
    co2:        0.38,
    pr:         0.77       // desert heat de-rating
  },
  uk: {
    name:       'United Kingdom',
    flag:       '🇬🇧',
    psh:        3.2,
    tariff:     0.28,
    currSymbol: '£',
    currName:   'GBP',
    usdRate:    0.79,
    co2:        0.19,      // low-carbon grid
    pr:         0.80
  },
  south_africa: {
    name:       'South Africa',
    flag:       '🇿🇦',
    psh:        5.5,
    tariff:     2.50,
    currSymbol: 'R',
    currName:   'ZAR',
    usdRate:    18.5,
    co2:        0.90,      // high coal dependency
    pr:         0.80
  },
  kenya: {
    name:       'Kenya',
    flag:       '🇰🇪',
    psh:        5.4,
    tariff:     25,
    currSymbol: 'KSh',
    currName:   'KES',
    usdRate:    130,
    co2:        0.35,
    pr:         0.79
  },
  brazil: {
    name:       'Brazil',
    flag:       '🇧🇷',
    psh:        5.0,
    tariff:     0.80,
    currSymbol: 'R$',
    currName:   'BRL',
    usdRate:    5.0,
    co2:        0.08,      // hydro-dominant grid — very low CO₂
    pr:         0.80
  }
};

/* System type cost multipliers ($800/kWp base for grid-tied) */
const SYS_MULTIPLIERS = {
  'grid-tied': { mult: 1.00, label: 'Grid-Tied',           note: 'Grid-tied system: lowest upfront cost. Exports excess power to grid. No battery backup — power cuts during grid outages.' },
  'hybrid':    { mult: 1.45, label: 'Hybrid (Battery)',     note: 'Hybrid system: battery backup for outages + grid connection. Best of both worlds. Ideal for areas with intermittent grid supply.' },
  'off-grid':  { mult: 1.85, label: 'Off-Grid (Battery)',   note: 'Off-grid system: full energy independence. Larger battery bank. Higher upfront cost, no grid bills. Perfect for remote locations.' }
};

const BASE_COST_PER_KWP_USD = 800;  // industry benchmark, grid-tied
const PERF_RATIO             = 0.80; // default system performance ratio
const CO2_FACTOR             = 0.43; // kg CO₂/kWh (IEA global grid avg)

/* ── Helpers ─────────────────────────────────────────────────── */
function $(id) { return document.getElementById(id); }

function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

function fmtNum(n, decimals = 0) {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/* ── Update currency symbols when country changes ────────────── */
function updateCountryDefaults() {
  const countryEl = $('calc-country');
  const tariffEl  = $('calc-tariff');
  if (!countryEl) return;

  const key = countryEl.value;
  const c   = COUNTRY_DATA[key];
  if (!c) return;

  /* Pre-fill tariff field */
  if (tariffEl) tariffEl.value = c.tariff;

  /* Update currency symbol prefixes on inputs */
  const billCurr   = $('calc-bill-currency');
  const tariffCurr = $('calc-tariff-currency');
  const tariffUnit = $('calc-tariff-unit');

  if (billCurr)   billCurr.textContent   = c.currSymbol;
  if (tariffCurr) tariffCurr.textContent = c.currSymbol;
  if (tariffUnit) tariffUnit.textContent = c.currName + ' per kWh';
}

/* ── Core calculation ─────────────────────────────────────────── */
function calculate() {
  /* Read inputs */
  const countryKey = ($('calc-country') || {}).value || 'nigeria';
  const bill       = parseFloat(($('calc-bill')   || {}).value) || 0;
  const tariff     = parseFloat(($('calc-tariff') || {}).value) || 0;
  const areaM2     = parseFloat(($('calc-area')   || {}).value) || 0;
  const sysType    = ($('calc-system-type') || {}).value || 'grid-tied';

  /* Validate */
  const billErr = $('bill-error');
  if (!bill || bill <= 0) {
    if (billErr) billErr.textContent = 'Please enter your monthly electricity bill.';
    return;
  }
  if (billErr) billErr.textContent = '';

  if (!tariff || tariff <= 0) return;

  const c   = COUNTRY_DATA[countryKey];
  const sys = SYS_MULTIPLIERS[sysType] || SYS_MULTIPLIERS['grid-tied'];
  if (!c) return;

  /* Use country-specific PR if available, else default */
  const pr = c.pr || PERF_RATIO;

  /* ── Step 1: System size ──────────────────────────────────── */
  // Daily energy demand (kWh/day) from monthly bill
  const dailyDemandKwh = (bill / tariff) / 30;
  // Required kWp to meet that demand
  const systemKwp = dailyDemandKwh / (c.psh * pr);

  /* ── Step 2: Energy production ───────────────────────────── */
  const dailyYieldKwh  = systemKwp * c.psh * pr;
  const annualKwh      = dailyYieldKwh * 365;

  /* ── Step 3: Financial ───────────────────────────────────── */
  const annualSavingsLocal = annualKwh * tariff;

  // Convert installed cost to local currency
  const costUsd   = systemKwp * BASE_COST_PER_KWP_USD * sys.mult;
  const costLocal = costUsd * c.usdRate;

  const paybackYrs   = annualSavingsLocal > 0 ? costLocal / annualSavingsLocal : 99;
  const savings25yr  = annualSavingsLocal * 25;

  /* ── Step 4: Environmental ───────────────────────────────── */
  const co2KgYr = annualKwh * CO2_FACTOR;

  /* ── Step 5: Area feasibility (optional) ─────────────────── */
  const areaNeededM2 = systemKwp * 6;  // ~6 m² per kWp
  const areaWarning  = $('res-area-warning');
  if (areaWarning) {
    if (areaM2 > 0 && areaM2 < areaNeededM2) {
      const maxKwp = (areaM2 / 6).toFixed(1);
      areaWarning.textContent = `⚠️ Your available area (${areaM2} m²) can fit approximately ${maxKwp} kWp. The optimal system size of ${systemKwp.toFixed(1)} kWp needs ~${Math.ceil(areaNeededM2)} m². Consider a partial offset system.`;
      areaWarning.style.display = 'block';
    } else {
      areaWarning.style.display = 'none';
    }
  }

  /* ── Display results ─────────────────────────────────────── */
  displayResults({
    c,
    sys,
    systemKwp,
    dailyYieldKwh,
    annualKwh,
    annualSavingsLocal,
    costLocal,
    paybackYrs,
    co2KgYr,
    savings25yr
  });
}

function displayResults(r) {
  const { c, sys, systemKwp, dailyYieldKwh, annualKwh,
          annualSavingsLocal, paybackYrs, co2KgYr, savings25yr } = r;

  const sym = c.currSymbol;

  /* Fill result cards */
  setText('res-system-size',    systemKwp.toFixed(1) + ' kWp');
  setText('res-daily-yield',    fmtNum(dailyYieldKwh, 1) + ' kWh/day');
  setText('res-annual-prod',    fmtNum(Math.round(annualKwh)) + ' kWh/yr');
  setText('res-annual-savings', sym + fmtNum(Math.round(annualSavingsLocal)) + '/yr');
  setText('res-payback',        paybackYrs.toFixed(1) + ' years');
  setText('res-co2',            fmtNum(co2KgYr, 0) + ' kg/yr');
  setText('res-25year',         sym + fmtNum(Math.round(savings25yr)));

  /* System type note */
  const noteEl = $('res-system-note');
  if (noteEl) noteEl.textContent = c.flag + '  ' + sys.note;

  /* Show results panel, hide intro */
  const intro   = $('calc-intro');
  const results = $('calc-results');

  if (intro)   intro.style.display   = 'none';
  if (results) {
    results.style.display  = 'block';
    results.style.opacity  = '0';
    results.style.transition = 'opacity 0.4s ease';
    requestAnimationFrame(() => { results.style.opacity = '1'; });
  }
}

/* ── Init ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  /* Set defaults for initially selected country */
  updateCountryDefaults();

  /* Re-fill defaults when country changes */
  const countryEl = $('calc-country');
  if (countryEl) countryEl.addEventListener('change', updateCountryDefaults);

  /* Trigger calculation on button click */
  const btn = $('calc-btn');
  if (btn) btn.addEventListener('click', calculate);

  /* Also recalculate live as user types */
  ['calc-bill', 'calc-tariff', 'calc-area', 'calc-system-type'].forEach(function (id) {
    const el = $(id);
    if (el) {
      el.addEventListener('input',  calculate);
      el.addEventListener('change', calculate);
    }
  });
});
