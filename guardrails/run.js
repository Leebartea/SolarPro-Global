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

const available = fs
  .readdirSync(CHECK_DIR)
  .filter((f) => f.endsWith('.js'))
  .map((f) => f.replace(/\.js$/, ''))
  .sort();

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
    const check = require(path.join(CHECK_DIR, `${name}.js`));
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
