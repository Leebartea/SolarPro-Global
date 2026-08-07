#!/usr/bin/env node
'use strict';
/**
 * Assemble the ThemeForest submission folder.
 *
 *   npm run package:themeforest
 *
 * Emits, beside the repo:
 *
 *   themeforest-build/
 *   └── SolarPro-Global-ThemeForest-v1.5.0/
 *       ├── Main Files/            ← the template a buyer unzips
 *       ├── Documentation/
 *       │   └── index.html         ← docs/documentation.html, renamed
 *       └── Licensing/
 *           ├── LICENSE.txt        ← the buyer licence
 *           └── CREDITS.txt        ← every third-party asset and its source
 *
 *   …and the same tree zipped, which is what you upload.
 *
 * WHY A FOLDER AND NOT A BRANCH.
 * The earlier plan was a `release/themeforest` branch off main. A branch has to
 * be merged every time main moves, and an unmerged branch is exactly how a
 * marketplace ends up serving a build older than the one you already fixed —
 * the same failure mode as the Selar listing sitting on v1.2.0 while v1.4.0
 * existed. So: one tree, one source of truth. Everything Envato-specific lives
 * in themeforest/ and is composed at package time. There is nothing to keep in
 * sync because there is no second copy.
 *
 * The Envato-only extras never reach the Selar ZIP: guardrails/package.js
 * excludes themeforest/ and scripts/ explicitly.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION = require(path.join(ROOT, 'package.json')).version;
const NAME = `SolarPro-Global-ThemeForest-v${VERSION}`;
const BUILD = path.join(ROOT, 'themeforest-build');
const OUT = path.join(BUILD, NAME);

/** Everything the Main Files folder must not contain. Mirrors the Selar ZIP's
 *  exclusion list, plus themeforest/ itself — the Licensing folder is where
 *  those files belong, not loose inside the template. */
const EXCLUDE = [
  '.git', '.github', '.claude', '.DS_Store',
  'node_modules', 'guardrails', 'scripts', 'themeforest', 'themeforest-build',
  'dist', 'docs',
  'package.json', 'package-lock.json', 'tailwind.config.js',
  'preview-info.md', 'preview-desktop-1920x1080.jpg',
];

const isExcluded = (name) =>
  EXCLUDE.includes(name) ||
  // Dotfiles are repository plumbing. .gitkeep exists only to make git track an
  // empty directory; shipping it tells a buyer nothing and looks like a leak.
  name.startsWith('.') ||
  /^SolarPro-Global-v.*\.zip$/i.test(name) ||
  /^proof-.*\.png$/i.test(name) ||
  /^preview-.*\.(jpg|jpeg|png)$/i.test(name) ||
  name === 'css/tailwind.src.css';

function copyTree(from, to, rel = '') {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (isExcluded(entry.name) || isExcluded(childRel)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst, childRel);
    else fs.copyFileSync(src, dst);
  }
}

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/* ── 1. Gate first. Never assemble a package that has not passed. ───────── */
console.log('running the core gate plus the themeforest suite…\n');
try {
  execFileSync(
    process.execPath,
    [path.join(ROOT, 'guardrails', 'run.js'), '--suite=themeforest'],
    { cwd: ROOT, stdio: 'inherit' },
  );
} catch {
  console.error(
    '\nNot packaging. Fix the errors above first.\n' +
    'If the only failure is the CREDITS.txt placeholders, that is the real\n' +
    'blocker on this submission — see themeforest/licensing/CREDITS.txt §1.\n',
  );
  process.exit(1);
}

/* ── 2. Assemble ───────────────────────────────────────────────────────── */
fs.rmSync(BUILD, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const mainFiles = path.join(OUT, 'Main Files');
copyTree(ROOT, mainFiles);

/* Swap every photograph for a placeholder of the same name and dimensions.
 * Envato requires a REDISTRIBUTION licence for anything in the download, not
 * merely a commercial one — see themeforest/licensing/CREDITS.txt §1b. This
 * removes the question instead of answering it. Runs against the copy, never
 * the working tree. */
console.log('\nreplacing photographs with placeholders…');
execFileSync(
  process.execPath,
  [path.join(ROOT, 'scripts', 'make-placeholders.js'), path.join(mainFiles, 'assets', 'images')],
  { cwd: ROOT, stdio: 'inherit' },
);

fs.mkdirSync(path.join(OUT, 'Documentation'), { recursive: true });
fs.copyFileSync(
  path.join(ROOT, 'docs', 'documentation.html'),
  path.join(OUT, 'Documentation', 'index.html'),
);

fs.mkdirSync(path.join(OUT, 'Licensing'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'LICENSE.txt'), path.join(OUT, 'Licensing', 'LICENSE.txt'));
fs.copyFileSync(
  path.join(ROOT, 'themeforest', 'licensing', 'CREDITS.txt'),
  path.join(OUT, 'Licensing', 'CREDITS.txt'),
);

/* ── 3. Zip, then verify the ZIP — not the folder it came from ──────────── */
const zip = path.join(BUILD, `${NAME}.zip`);
run('zip', ['-r', '-q', '-X', zip, NAME], BUILD);

const listed = run('unzip', ['-Z1', zip], BUILD).split('\n').filter(Boolean);

const MUST_CONTAIN = [
  `${NAME}/Main Files/index.html`,
  `${NAME}/Main Files/404.html`,
  `${NAME}/Main Files/pages/privacy.html`,
  `${NAME}/Main Files/pages/terms.html`,
  `${NAME}/Main Files/css/tailwind.min.css`,
  `${NAME}/Main Files/LICENSE.txt`,
  `${NAME}/Main Files/CHANGELOG.md`,
  `${NAME}/Documentation/index.html`,
  `${NAME}/Licensing/LICENSE.txt`,
  `${NAME}/Licensing/CREDITS.txt`,
];
const MUST_NOT_MATCH = [
  /node_modules\//, /\.git\//, /\.claude\//, /guardrails\//, /scripts\//,
  /themeforest\//, /\.DS_Store$/, /tailwind\.src\.css$/, /package\.json$/,
];

let bad = 0;

/* Prove the placeholder swap actually happened, by comparing bytes against the
 * working tree. A silently skipped swap would ship third-party photographs
 * inside the download — the exact licensing exposure this is here to avoid —
 * and the archive would still look perfectly normal. */
const srcImages = path.join(ROOT, 'assets', 'images');
for (const f of fs.readdirSync(srcImages).filter((x) => /\.(jpe?g|png)$/i.test(x))) {
  const original = fs.readFileSync(path.join(srcImages, f));
  const shipped = fs.readFileSync(path.join(mainFiles, 'assets', 'images', f));
  if (original.equals(shipped)) {
    console.error(`  NOT REPLACED: assets/images/${f} is the original photograph, not a placeholder`);
    bad++;
  }
}

for (const f of MUST_CONTAIN) {
  if (!listed.includes(f)) {
    console.error(`  MISSING from the archive: ${f}`);
    bad++;
  }
}
for (const f of listed) {
  for (const re of MUST_NOT_MATCH) {
    if (re.test(f)) {
      console.error(`  MUST NOT SHIP: ${f}`);
      bad++;
    }
  }
}
if (bad) {
  console.error(`\n${bad} problem(s) in the assembled archive.`);
  process.exit(1);
}

const mb = (fs.statSync(zip).size / 1024 / 1024).toFixed(2);
console.log(`\n  ${OUT}`);
console.log(`  ${zip}  (${mb} MB, ${listed.length} entries)`);
console.log(`
  Verified: required files present, excluded files absent.

  Upload the ZIP as the item's main file. The preview images are uploaded
  separately — see Revenue Plan/09-themeforest/THEMEFOREST-GUIDE.md §4.
`);
