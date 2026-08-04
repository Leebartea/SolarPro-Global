'use strict';
/**
 * What the buyer's ZIP may and may not contain.
 *
 * The working folder holds things that must never reach a customer: the
 * internal `.claude/` agent notes, `node_modules/`, screenshot scripts, and —
 * found during the v1 audit — two stray PDFs sitting in `css/`, one of them
 * named CLAUDE_CODE_AGENTIC_WORKFLOW.md.pdf. The shipped v1.0 ZIP predated
 * those files and was clean, which is precisely the danger: the next re-zip
 * would have swept them in with no one noticing.
 *
 * Run against the working folder by default, or against an extracted ZIP:
 *   SOLARPRO_PACKAGE_DIR=/tmp/zip-test node guardrails/run.js package-hygiene
 */

const fs = require('fs');
const path = require('path');
const { Report } = require('../lib/report');
const { ROOT } = require('../lib/project');

// Never ship. Matched against the path relative to the package root.
const FORBIDDEN = [
  [/(^|\/)\.claude(\/|$)/,        'internal agent notes'],
  [/(^|\/)node_modules(\/|$)/,    'dependency tree — buyers get source, not installs'],
  [/(^|\/)\.git(\/|$)/,           'repository metadata'],
  [/\.DS_Store$/,                 'macOS folder metadata'],
  [/(^|\/)Thumbs\.db$/,           'Windows thumbnail cache'],
  [/(^|\/)scripts(\/|$)/,         'internal screenshot and proof scripts'],
  [/(^|\/)guardrails(\/|$)/,      'internal release checks'],
  [/(^|\/)preview-info\.md$/,     'internal marketplace packaging notes'],
  [/(^|\/)proof-.*\.png$/,        'internal verification screenshots'],
  [/AGENTIC|CLAUDE/i,             'internal build documentation'],
  [/\.zip$/,                      'a nested archive'],
  [/(^|\/)tailwind\.src\.css$/,   'build input — buyers need the compiled file'],
  [/(^|\/)dist(\/|$)/,            'deploy output — the buyer gets the source tree'],
  [/(^|\/)tailwind\.config\.js$/, 'build config'],
  [/(^|\/)package(-lock)?\.json$/, 'build manifest — the template needs no install'],
];

// Must ship.
const REQUIRED = [
  'index.html', 'README.md', 'LICENSE.txt',
  'css/custom.css', 'css/tailwind.min.css', 'css/fonts.css',
  'js/main.js', 'js/theme.js', 'js/calculator.js',
  'docs/documentation.html',
  'pages/services.html', 'pages/calculator.html', 'pages/portfolio.html',
  'pages/about.html', 'pages/contact.html',
  'vendor/aos/aos.css', 'vendor/aos/aos.js',
];

const forbiddenReason = (rel) => {
  for (const [pattern, why] of FORBIDDEN) if (pattern.test(rel)) return why;
  return null;
};

/**
 * List package contents. A directory that is itself forbidden is reported once
 * and not descended into — otherwise a single stray `.git/` produces hundreds
 * of findings and buries everything else.
 */
function walk(dir, base, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);
    out.push(rel);
    if (entry.isDirectory() && !forbiddenReason(rel)) walk(full, base, out);
  }
  return out;
}

module.exports = function packageHygiene() {
  const report = new Report('Package hygiene — the buyer ZIP contains the right files');
  const base = process.env.SOLARPRO_PACKAGE_DIR || ROOT;
  const scanningWorkspace = base === ROOT;

  const entries = walk(base, base);
  report.counted(entries.length);

  for (const rel of entries) {
    const why = forbiddenReason(rel);
    if (!why) continue;
    // In the working folder these files legitimately exist; the packaging step
    // is what must exclude them. Warn there, fail on a real extracted package.
    const msg = `must not ship: ${rel} (${why})`;
    if (scanningWorkspace) report.warn(`${msg} — exclude it when zipping`);
    else report.error(msg);
  }

  for (const required of REQUIRED) {
    if (!fs.existsSync(path.join(base, required))) {
      report.error(`missing from the package: ${required}`);
    }
  }

  // Bundled fonts and images have to be present or the offline promise breaks.
  for (const dir of ['assets/fonts', 'assets/images']) {
    const full = path.join(base, dir);
    if (!fs.existsSync(full) || fs.readdirSync(full).filter((f) => !f.startsWith('.')).length === 0) {
      report.error(`${dir}/ is empty — the template depends on bundled assets`);
    }
  }

  return report;
};
