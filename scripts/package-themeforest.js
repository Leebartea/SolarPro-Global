#!/usr/bin/env node
'use strict';
/**
 * Assemble a marketplace package.
 *
 *   npm run package:themeforest     → themeforest-build/
 *   npm run package:fiverr          → fiverr-build/
 *
 * Two presets, one script, because the two archives differ only in three
 * strings and a banned-word list. The Fiverr preset exists because a Fiverr
 * delivery is a REDISTRIBUTION of the template to the buyer — the same test
 * Envato applies to an item download — so it ships the same photograph
 * placeholders, and because naming Selar or ThemeForest inside a Fiverr
 * delivery is "directing clients to external platforms" under Fiverr's
 * off-platform policy. Neither existing archive is deliverable on Fiverr
 * as-is: the Selar ZIP says "(Gumroad / Selar / ThemeForest)" and the Envato
 * one says "through your ThemeForest item page".
 *
 * Emits, beside the repo:
 *
 *   <preset>-build/
 *   └── SolarPro-Global-<Preset>-v1.5.0/
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

/* ── 0. Preset ─────────────────────────────────────────────────────────────
 * `banned` is scanned against the bytes that actually ship, not the source
 * they came from, and it hard-fails. It is the safety net under every rewrite
 * below: a mention this script forgets to substitute stops the build rather
 * than reaching a buyer. */
const PRESETS = {
  themeforest: {
    tag: 'ThemeForest',
    build: 'themeforest-build',
    support: 'contact the template author through your ThemeForest item page.',
    banned: [/gumroad/i, /\bselar\b/i],
    creditsFor: 'themeforest',
    tail:
      "  Upload the ZIP as the item's main file. The preview images are uploaded\n" +
      '  separately — see Revenue Plan/09-themeforest/THEMEFOREST-GUIDE.md §4.\n',
  },
  fiverr: {
    tag: 'Fiverr',
    build: 'fiverr-build',
    support:
      'contact the template author by messaging them on your Fiverr order page.',
    banned: [/gumroad/i, /\bselar\b/i, /themeforest/i, /\benvato\b/i],
    creditsFor: 'fiverr',
    tail:
      '  This is the base archive. Per order, apply the buyer\'s brand and content\n' +
      '  to Main Files/ before delivering, and attach the result to the Fiverr\n' +
      '  order — never a cloud link. See Revenue Plan/13-fiverr-template/GUIDE.md.\n',
  },
};

const arg = process.argv.slice(2).find((a) => a.startsWith('--marketplace='));
const PRESET_KEY = arg ? arg.split('=')[1] : 'themeforest';
const PRESET = PRESETS[PRESET_KEY];
if (!PRESET) {
  console.error(
    `unknown --marketplace=${PRESET_KEY}. Known: ${Object.keys(PRESETS).join(', ')}`,
  );
  process.exit(1);
}

const NAME = `SolarPro-Global-${PRESET.tag}-v${VERSION}`;
const BUILD = path.join(ROOT, PRESET.build);
const OUT = path.join(BUILD, NAME);

/** Everything the Main Files folder must not contain. Mirrors the Selar ZIP's
 *  exclusion list, plus themeforest/ itself — the Licensing folder is where
 *  those files belong, not loose inside the template. */
const EXCLUDE = [
  '.git', '.github', '.claude', '.DS_Store',
  'node_modules', 'guardrails', 'scripts', 'themeforest', 'themeforest-build',
  'fiverr-build',
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

/* Strip the competing-marketplace names from the buyer-facing support text.
 * The working tree says "(Gumroad / Selar / ThemeForest)" because that sentence
 * is correct for a Selar or Gumroad buyer — it is not a mistake there. Inside
 * an item someone paid Envato for, it names two other places to buy the same
 * work. Not a hyperlink, so it is the mild form, but it is squarely against the
 * spirit of the policy and one sentence is enough for a soft reject.
 *
 * Substituted at package time rather than edited at source, so the Selar ZIP
 * keeps the accurate wording and there is still only one copy of the file. */
console.log(`rewriting the support text for the ${PRESET.tag} copy…`);

const MARKETPLACE_REWRITES = [
  // README.md and Documentation/index.html word the sentence slightly
  // differently after the parenthetical, so match up to it and no further.
  [/contact the template author via the marketplace where you purchased this template \(Gumroad \/ Selar \/ ThemeForest\)\./g,
   PRESET.support],
];

for (const file of [path.join(mainFiles, 'README.md'), path.join(OUT, 'Documentation', 'index.html')]) {
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  for (const [re, to] of MARKETPLACE_REWRITES) after = after.replace(re, to);
  if (after === before) {
    console.error(
      `  NO SUBSTITUTION MADE in ${path.relative(OUT, file)} — the support sentence\n` +
      '  has been reworded upstream. Update MARKETPLACE_REWRITES to match it.',
    );
    process.exit(1);
  }
  fs.writeFileSync(file, after);
}

/* The support sentence is not the only place a competing marketplace is named.
 * These three were found by the banned-word scan below, not by reading the
 * files — which is the argument for having the scan. The documentation
 * paragraph is the one that matters: it tells the reader that a different
 * package of the same template exists and has better photographs in it. */
const EXTRA_REWRITES = {
  themeforest: [],
  fiverr: [
    [
      ['Documentation', 'index.html'],
      /<p><strong>Which images you received depends on your package\.<\/strong>[\s\S]*?<\/p>/,
      '<p><strong>The photographs in this package are placeholders.</strong> Same filenames, ' +
        'same pixel dimensions, plain grey. Stock photography is licensed for use rather than ' +
        'for resale, so the archive ships no third-party photograph at all and the demo imagery ' +
        'you saw is preview material. Drop your own project photos in over the placeholders, ' +
        'keeping the names and sizes, and no layout changes at all.</p>',
    ],
    [['Main Files', 'CHANGELOG.md'], /a step Envato requires/, 'a step marketplaces require'],
    [
      ['Main Files', 'CHANGELOG.md'],
      /\(`themeforest\/licensing\/CREDITS\.txt`\)/,
      '(`Licensing/CREDITS.txt`)',
    ],
  ],
};

for (const [rel, re, to] of EXTRA_REWRITES[PRESET.creditsFor]) {
  const file = path.join(OUT, ...rel);
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(re, to);
  if (after === before) {
    console.error(
      `  NO SUBSTITUTION MADE in ${rel.join('/')} for ${re}\n` +
      '  — reworded upstream. Update EXTRA_REWRITES to match it.',
    );
    process.exit(1);
  }
  fs.writeFileSync(file, after);
}

fs.mkdirSync(path.join(OUT, 'Licensing'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'LICENSE.txt'), path.join(OUT, 'Licensing', 'LICENSE.txt'));

/* CREDITS.txt is written for Envato — it cites Envato Author Support by name
 * and tells the reader which package the photographs DO ship in. Both are
 * fine on ThemeForest and neither belongs in a Fiverr delivery, so the Fiverr
 * preset replaces those blocks whole rather than word by word. Section
 * headers are the delimiters because they are the stable part of the file;
 * a heading that moves fails the build instead of silently skipping. */
const CREDITS_REWRITES = {
  themeforest: [],
  fiverr: [
    [
      /Envato requires this file; it is also the only complete record of\nwhat is in the package\./,
      'This file is the complete record of what is in the package.',
    ],
    [
      /  NOT INCLUDED IN THE THEMEFOREST DOWNLOAD\.[\s\S]*?(?=\n-{20,}\n1a\.)/,
      '  NOT INCLUDED IN THIS ARCHIVE.\n' +
        '  These six photographs are used on the live demo only. They are replaced\n' +
        '  with placeholders here — see §1b. The listing states that the photographs\n' +
        '  are for preview purposes and are not part of what you receive.\n',
    ],
    [/ThemeForest archive along with the rest/, 'archive along with the rest'],
    [/by the `themeforest` guardrail check/, 'by the packaging guardrail check'],
    [
      /-{20,}\n1b\. WHY THE THEMEFOREST DOWNLOAD SHIPS PLACEHOLDERS\n-{20,}\n[\s\S]*?(?=\n-{20,}\n2\. FONTS)/,
      '--------------------------------------------------------------------\n' +
        '1b. WHY THIS ARCHIVE SHIPS PLACEHOLDERS\n' +
        '--------------------------------------------------------------------\n\n' +
        'The licence a stock photograph needs depends on what is being done with it:\n\n' +
        '  Showing it on a live demo  -> a COMMERCIAL licence is enough.\n' +
        '  Shipping it inside a file  -> a REDISTRIBUTION licence is required,\n' +
        '  the buyer keeps               meaning the right to pass the asset on.\n\n' +
        'The Pexels Licence is permissive and very probably covers the second case\n' +
        'as well. "Very probably" is not a basis for a licensing warranty, so this\n' +
        'archive contains no third-party photograph at all.\n' +
        'The packaging step swaps every photograph for a generated\n' +
        'placeholder of identical filename and dimensions, so the layout still\n' +
        'renders correctly and your own photographs drop straight in.\n\n' +
        'This removes the question rather than answering it.\n\n' +
        'Note the distinction, because it cuts the other way too: putting a\n' +
        'Pexels photograph onto YOUR OWN finished website is ordinary permitted\n' +
        'use, and nothing here restricts it. It is bundling one into a template\n' +
        'archive that someone else then keeps and reuses that is unsettled.\n',
    ],
  ],
};

let credits = fs.readFileSync(
  path.join(ROOT, 'themeforest', 'licensing', 'CREDITS.txt'),
  'utf8',
);
for (const [re, to] of CREDITS_REWRITES[PRESET.creditsFor]) {
  const after = credits.replace(re, to);
  if (after === credits) {
    console.error(
      `  NO SUBSTITUTION MADE in CREDITS.txt for ${re}\n` +
      '  — the section has been reworded upstream. Update CREDITS_REWRITES.',
    );
    process.exit(1);
  }
  credits = after;
}
fs.writeFileSync(path.join(OUT, 'Licensing', 'CREDITS.txt'), credits);

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

/* No competing marketplace may be named anywhere in the archive. The rewrite
 * above handles the two known sentences; this catches the third one someone
 * adds later, and catches it in the bytes that actually ship rather than in the
 * source they came from. */
const BANNED = PRESET.banned;
const TEXTUAL = /\.(html?|md|txt|css|js|json|xml|svg)$/i;

for (const rel of listed.filter((f) => TEXTUAL.test(f))) {
  const abs = path.join(BUILD, rel);
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
  const text = fs.readFileSync(abs, 'utf8');
  for (const re of BANNED) {
    const hit = text.match(re);
    if (hit) {
      const line = text.slice(0, hit.index).split('\n').length;
      console.error(`  NAMES A COMPETING MARKETPLACE: ${rel}:${line} — "${hit[0]}"`);
      bad++;
    }
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

${PRESET.tail}`);
