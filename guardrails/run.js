#!/usr/bin/env node
'use strict';
/**
 * Guardrail runner.
 *
 *   node guardrails/run.js            # run every check
 *   node guardrails/run.js css-contract external-deps
 *
 * Exit code 0 only when no check reported an error. Warnings never fail the
 * run, so the gate stays trustworthy: a red result always means something is
 * genuinely wrong, which is the only way a gate survives contact with a
 * deadline.
 */

const path = require('path');
const fs = require('fs');
const { colours } = require('./lib/report');

const { BOLD, DIM, OFF, RED, GRN, YEL } = colours;
const CHECK_DIR = path.join(__dirname, 'checks');

/**
 * Marketplace-specific suites live in their own directory and are opt-in:
 *
 *   node guardrails/run.js --suite=themeforest
 *
 * They are NOT part of the default run, and that is the whole point. The
 * product sold on Selar must never be blocked by a requirement that exists
 * only because Envato asks for it — an Envato reviewer wanting a differently
 * formatted help file is not a reason to stop shipping a fix to paying buyers.
 * Requirements flow one way: everything in `checks/` applies to every
 * deliverable; everything in `checks-<suite>/` applies to that one only.
 *
 * This replaces the earlier plan of a `release/themeforest` branch. A branch
 * would need merging every time main moves, and an unmerged branch is how a
 * marketplace ends up serving an older build than the one you fixed. One tree,
 * one source of truth, an extra gate on top.
 */
const suites = process.argv
  .filter((a) => a.startsWith('--suite='))
  .map((a) => a.slice('--suite='.length));

const dirs = [CHECK_DIR, ...suites.map((s) => path.join(__dirname, `checks-${s}`))];
for (const d of dirs) {
  if (!fs.existsSync(d)) {
    console.error(`Unknown suite directory: ${path.basename(d)}`);
    process.exit(2);
  }
}

/** check name -> absolute file, later dirs never shadowing earlier ones. */
const registry = new Map();
for (const dir of dirs) {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
    const name = f.replace(/\.js$/, '');
    if (registry.has(name)) {
      console.error(`Duplicate check name "${name}" in ${dir} — names must be unique across suites`);
      process.exit(2);
    }
    registry.set(name, path.join(dir, f));
  }
}
const available = [...registry.keys()].sort();

async function main() {
  const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const selected = requested.length ? requested : available;

  const unknown = selected.filter((s) => !available.includes(s));
  if (unknown.length) {
    console.error(`Unknown check(s): ${unknown.join(', ')}`);
    console.error(`Available: ${available.join(', ')}`);
    process.exit(2);
  }

  console.log(`\n${BOLD}SolarPro Global — release guardrails${OFF}`);
  console.log(`${DIM}${selected.length} check(s)${OFF}\n`);

  const reports = [];
  for (const name of selected) {
    const check = require(registry.get(name));
    let report;
    try {
      report = await check();
    } catch (err) {
      // A check that throws is itself a failure — never a silent skip.
      const { Report } = require('./lib/report');
      report = new Report(name).error(`check crashed: ${err.message}`);
    }
    report.print();
    reports.push(report);
  }

  const errors = reports.reduce((n, r) => n + r.errors.length, 0);
  const warns = reports.reduce((n, r) => n + r.warnings.length, 0);
  const failed = reports.filter((r) => !r.passed).length;

  console.log(`\n${DIM}${'─'.repeat(64)}${OFF}`);
  if (errors === 0) {
    console.log(`${GRN}${BOLD}RELEASE OK${OFF} — ${reports.length} checks passed` +
      (warns ? `, ${YEL}${warns} warning(s)${OFF}` : ''));
  } else {
    console.log(`${RED}${BOLD}RELEASE BLOCKED${OFF} — ${errors} error(s) across ` +
      `${failed} check(s)` + (warns ? `, ${warns} warning(s)` : ''));
  }
  console.log('');

  process.exit(errors === 0 ? 0 : 1);
}

main();
