'use strict';
/**
 * ThemeForest submission requirements.
 *
 *   node guardrails/run.js --suite=themeforest themeforest
 *   npm run check:themeforest        # the 11 core checks plus this one
 *
 * OPT-IN ON PURPOSE. This check is not in guardrails/checks/, so it never runs
 * during `npm run check` and can never block the Selar release. Envato asks for
 * things a direct buyer does not need — a particular folder layout, a licensing
 * manifest, a help file at a specific path. None of that is a reason to hold
 * back a fix for people who already paid.
 *
 * What this encodes is the gap list that two independent reviews produced:
 * the required pages, an Envato-format help file, an asset licence audit, and
 * no unresolved placeholders in anything that makes a licensing claim.
 *
 * What it deliberately does NOT check, because it cannot do so honestly:
 *
 *   - Lighthouse ≥ 90. Needs a real run against a served build; a check that
 *     guessed would be worse than one that declines.
 *   - W3C validation. Same — needs the validator, offline here.
 *   - Envato's AI-authorship disclosure. A policy question for the author to
 *     answer on the submission form, not a property of the files.
 *
 * Those three are in the submission guide as manual steps with their commands,
 * which is the honest place for them. A gate that pretends to cover them is
 * how you find out at review time that nobody ever ran them.
 */

const fs = require('fs');
const path = require('path');
const { Report } = require('../lib/report');
const { ROOT, PAGES, exists, read } = require('../lib/project');

/** Pages Envato expects a site template to include beyond the core nav. */
const REQUIRED_PAGES = [
  ['404.html', 'a 404 page — reviewers check for one on every site template'],
  ['pages/privacy.html', 'a privacy policy page'],
  ['pages/terms.html', 'a terms of service page'],
];

/** Files that must exist for the package to be assemblable at all. */
const REQUIRED_FILES = [
  ['docs/documentation.html', 'the help file — becomes Documentation/index.html'],
  ['LICENSE.txt', 'the buyer licence'],
  ['themeforest/licensing/CREDITS.txt', 'the third-party asset manifest'],
  ['README.md', 'shipped inside the main files'],
  ['CHANGELOG.md', 'version history — Envato has no release-notes field'],
];

/**
 * Anything that reads as an unfilled blank in a file making a legal or
 * licensing claim. The buyer-facing legal PAGES are exempt: their placeholders
 * are the product (see scripts/new-page.js), and content-integrity already
 * proves they survived.
 */
const PLACEHOLDER = /\[[A-Z][A-Z0-9 _/&.-]{3,}\]/g;

/**
 * Find unfilled placeholders, ignoring ones that are being quoted rather than
 * left blank.
 *
 * The documentation explains the convention — "fill in every [BRACKETED]
 * value" — inside a <code> span. Reading that as an unfilled blank made the
 * check fail on a file that was correct, and a gate that cries wolf is a gate
 * that gets bypassed. Text inside <code> is being shown, not filled in.
 */
function unfilled(text) {
  const quoted = text.replace(/<code>[\s\S]*?<\/code>/g, '');
  return [...new Set(quoted.match(PLACEHOLDER) || [])];
}

/** Bundled asset directories the credits file has to account for. */
const ASSET_DIRS = ['assets/images', 'assets/fonts', 'vendor'];

function walk(rel, out = []) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) walk(child, out);
    else out.push(child);
  }
  return out;
}

module.exports = async function themeforest() {
  const report = new Report('ThemeForest — submission requirements beyond the core gate');
  let checked = 0;

  /* ── 1. Required pages and files ─────────────────────────────────────── */
  for (const [file, why] of [...REQUIRED_PAGES, ...REQUIRED_FILES]) {
    checked++;
    if (!exists(file)) report.error(`missing ${file} — ${why}`, file);
  }

  /* Every required page must also be in PAGES, or the core checks skip it and
   * "all green" says nothing about the page Envato specifically asked for. */
  for (const [file] of REQUIRED_PAGES) {
    checked++;
    if (!PAGES.includes(file)) {
      report.error(`${file} is not in PAGES — the core checks do not cover it`, file);
    }
  }

  /* ── 2. The help file must describe THIS version ─────────────────────── */
  if (exists('docs/documentation.html')) {
    checked++;
    const version = require(path.join(ROOT, 'package.json')).version;
    const doc = read('docs/documentation.html');
    const tag = doc.match(/class="version-tag">v([\d.]+)</);
    if (!tag) {
      report.error('documentation has no version tag to verify', 'docs/documentation.html');
    } else if (tag[1] !== version) {
      report.error(
        `documentation says v${tag[1]} but package.json says v${version} — ` +
        'a reviewer reads the help file as the statement of what they received',
        'docs/documentation.html',
      );
    }

    /* The help file has to actually cover the pages that ship. A documentation
     * set that never mentions the 404 or the legal pages reads as a template
     * whose author added them to pass review. */
    for (const [file] of REQUIRED_PAGES) {
      checked++;
      const name = path.basename(file);
      if (!doc.includes(name)) {
        report.warn(`documentation does not mention ${name}`, 'docs/documentation.html');
      }
    }
  }

  /* ── 3. The credits file must account for every bundled asset ────────── */
  if (exists('themeforest/licensing/CREDITS.txt')) {
    const credits = read('themeforest/licensing/CREDITS.txt');

    const bundled = ASSET_DIRS.flatMap((d) => walk(d));
    for (const file of bundled) {
      checked++;
      if (!credits.includes(file)) {
        report.error(
          `${file} ships but is not listed in CREDITS.txt — every bundled asset ` +
          'needs a recorded licence and source',
          'themeforest/licensing/CREDITS.txt',
        );
      }
    }

    /* And the reverse: a credits file listing an asset that no longer ships is
     * a claim about a file the buyer does not receive. */
    for (const line of credits.split('\n')) {
      const m = line.match(/\b((?:assets|vendor)\/[\w./-]+\.\w+)\b/);
      if (m && !bundled.includes(m[1])) {
        checked++;
        report.error(
          `CREDITS.txt lists ${m[1]}, which is not in the package`,
          'themeforest/licensing/CREDITS.txt',
        );
      }
    }

    /* Unresolved placeholders. This is the one that will be red today: the
     * Unsplash source URLs were never recorded. It stays red until they are
     * filled in or the photographs are replaced — a licensing claim is not
     * something to submit with a blank in it. */
    const holes = unfilled(credits);
    checked++;
    if (holes.length) {
      report.error(
        `CREDITS.txt has ${holes.length} unresolved placeholder(s): ${holes.join(', ')} — ` +
        'see the note in §1 of that file for how to resolve them',
        'themeforest/licensing/CREDITS.txt',
      );
    }
  }

  /* ── 4. Nothing else may carry an unfilled licensing blank ───────────── */
  const LEGAL_PAGES = new Set(['pages/privacy.html', 'pages/terms.html']);
  for (const file of ['LICENSE.txt', 'README.md', 'docs/documentation.html']) {
    if (!exists(file)) continue;
    checked++;
    const holes = unfilled(read(file));
    if (holes.length) {
      report.error(`${file} contains unfilled placeholder(s): ${holes.join(', ')}`, file);
    }
  }
  for (const p of LEGAL_PAGES) {
    checked++; // counted, not enforced — placeholders here are the deliverable
  }

  /* ── 5. Stale provenance in the documentation ────────────────────────── */
  if (exists('docs/documentation.html')) {
    checked++;
    const doc = read('docs/documentation.html');
    const ids = doc.match(/photo-\d{10,}/g) || [];
    const imageCount = walk('assets/images').length;
    if (ids.length && ids.length !== imageCount) {
      report.error(
        `documentation credits ${ids.length} Unsplash photo IDs but ${imageCount} ` +
        'images ship — the table is left over from when photos were hotlinked, and ' +
        'a reviewer comparing it to assets/images/ sees a provenance claim that ' +
        'does not match the package',
        'docs/documentation.html',
      );
    }
  }

  report.counted(checked);
  return report;
};
