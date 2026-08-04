#!/usr/bin/env node
'use strict';
/**
 * Build the buyer ZIP, then verify the ZIP itself — not the folder it came from.
 *
 *   npm run package
 *
 * The distinction matters. Every previous check runs against the working
 * directory, where `.claude/`, `node_modules/` and build inputs legitimately
 * live. The only artefact a customer ever sees is the archive, so the archive
 * is what has to be proven clean: it is extracted to a temporary directory and
 * the hygiene and offline checks are re-run there, against the exact bytes
 * that will be uploaded.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION = require(path.join(ROOT, 'package.json')).version;
const NAME = `SolarPro-Global-v${VERSION}`;
const OUT = path.join(ROOT, `${NAME}.zip`);

// Everything the buyer package must not contain.
const EXCLUDES = [
  '*.DS_Store', '*/.DS_Store',
  '.git/*', '*/.git/*',
  '.claude/*', '*/.claude/*',
  'node_modules/*', '*/node_modules/*',
  'guardrails/*', 'scripts/*',
  'preview-info.md', 'shots.js',
  'tailwind.config.js', 'css/tailwind.src.css',
  'package.json', 'package-lock.json',
  'proof-*.png', '*.zip',
  'dist/*', '*/dist/*',
  '*CLAUDE*', '*AGENTIC*',
];

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

(async () => {
  if (fs.existsSync(OUT)) fs.rmSync(OUT);

  // Zip from the parent so the archive contains a single top-level folder.
  const parent = path.dirname(ROOT);
  const folder = path.basename(ROOT);
  const args = ['-r', '-q', OUT, folder];
  for (const pattern of EXCLUDES) args.push('--exclude', `${folder}/${pattern}`);
  run('zip', args, parent);

  const size = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
  console.log(`\nbuilt ${path.basename(OUT)} (${size} MB)`);

  // Extract and verify the archive itself.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'solarpro-pkg-'));
  run('unzip', ['-q', OUT, '-d', tmp]);
  const extracted = path.join(tmp, folder);

  console.log(`verifying the extracted archive at ${extracted}\n`);

  let failed = false;
  try {
    run('node', [path.join(__dirname, 'run.js'), 'package-hygiene', 'content-integrity'],
        ROOT);
  } catch (err) {
    failed = true;
  }

  // package-hygiene escalates warnings to errors when pointed at a real package.
  try {
    execFileSync('node', [path.join(__dirname, 'run.js'), 'package-hygiene'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'inherit',
      env: { ...process.env, SOLARPRO_PACKAGE_DIR: extracted },
    });
  } catch (err) {
    failed = true;
  }

  if (failed) {
    console.error(`\nThe archive did not pass. It is still at ${OUT} — do not upload it.`);
    process.exit(1);
  }

  console.log(`\n${path.basename(OUT)} passed verification and is ready to upload.`);
  fs.rmSync(tmp, { recursive: true, force: true });
})();
