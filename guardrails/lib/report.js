'use strict';
/**
 * Shared result-reporting primitives for every guardrail check.
 *
 * A check returns a Report. The runner aggregates Reports and decides the
 * process exit code: any `error` fails the build, `warn` never does.
 */

const RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m';
const DIM = '\x1b[2m', BOLD = '\x1b[1m', OFF = '\x1b[0m';

class Report {
  /** @param {string} name  Human-readable check name, shown in output. */
  constructor(name) {
    this.name = name;
    this.findings = [];
    this.checked = 0;
  }

  /** A release-blocking defect. */
  error(message, where) {
    this.findings.push({ level: 'error', message, where });
    return this;
  }

  /** Worth knowing, never blocks. */
  warn(message, where) {
    this.findings.push({ level: 'warn', message, where });
    return this;
  }

  /** Record how many units (files, links, pages) this check inspected. */
  counted(n) {
    this.checked += n;
    return this;
  }

  get errors() {
    return this.findings.filter((f) => f.level === 'error');
  }

  get warnings() {
    return this.findings.filter((f) => f.level === 'warn');
  }

  get passed() {
    return this.errors.length === 0;
  }

  print() {
    const mark = this.passed ? `${GRN}PASS${OFF}` : `${RED}FAIL${OFF}`;
    const scope = this.checked ? ` ${DIM}(${this.checked} checked)${OFF}` : '';
    console.log(`${mark}  ${BOLD}${this.name}${OFF}${scope}`);

    const show = (list, colour, label) => {
      for (const f of list) {
        const where = f.where ? ` ${DIM}${f.where}${OFF}` : '';
        console.log(`        ${colour}${label}${OFF} ${f.message}${where}`);
      }
    };
    show(this.errors, RED, '✗');
    show(this.warnings, YEL, '!');
  }
}

module.exports = { Report, colours: { RED, YEL, GRN, DIM, BOLD, OFF } };
