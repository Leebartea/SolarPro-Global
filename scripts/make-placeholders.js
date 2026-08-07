#!/usr/bin/env node
'use strict';
/**
 * Generate placeholder photographs for the ThemeForest archive.
 *
 *   node scripts/make-placeholders.js <destination-images-dir>
 *
 * Called by scripts/package-themeforest.js. Never run against the working tree
 * — it would overwrite the real photographs.
 *
 * WHY THIS EXISTS.
 * Envato requires different licences either side of the preview/download line:
 *
 *   Item preview (live demo)  -> a commercial licence is sufficient.
 *   Item download (the ZIP)   -> a REDISTRIBUTION licence — the right to
 *                                resell the asset — is required.
 *
 * The Pexels Licence is permissive and very probably clears that bar. "Very
 * probably" is not a basis for a licensing warranty on a marketplace where a
 * hard rejection cannot be resubmitted, so the Envato archive contains no
 * third-party photography at all. The live demo keeps the real photographs,
 * which only needs the commercial licence, and the item description states
 * that photographs are preview-only.
 *
 * Each placeholder keeps the ORIGINAL FILENAME AND PIXEL DIMENSIONS, so every
 * layout, aspect ratio and object-fit rule behaves exactly as it does on the
 * demo. The buyer drops their own photo over the top and nothing shifts.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dest = process.argv[2];
if (!dest || !fs.existsSync(dest)) {
  console.error('usage: make-placeholders.js <destination-images-dir>');
  process.exit(2);
}

/** Width and height out of the PNG/JPEG header, without a dependency. */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    // SOF0..SOF15, excluding the non-frame markers DHT(c4) DAC(cc) RSTn.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('could not read JPEG dimensions');
}

const images = fs.readdirSync(dest).filter((f) => /\.(jpe?g|png)$/i.test(f));
if (!images.length) {
  console.error(`no images found in ${dest}`);
  process.exit(2);
}

const specs = images.map((f) => {
  const { w, h } = jpegSize(fs.readFileSync(path.join(dest, f)));
  return { file: f, w, h };
});

/* Rendered with the Playwright already used by the guardrail suite, rather
 * than adding an image library for six flat rectangles. */
const page = (s) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0}
  body{width:${s.w}px;height:${s.h}px;position:relative;overflow:hidden;
    background:#e8eaee;
    font:600 ${Math.max(13, Math.round(s.w / 42))}px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    color:#8b9099;display:flex;align-items:center;justify-content:center;
    text-align:center}
  /* A faint diagonal weave so the placeholder reads as intentional rather than
     as a failed image load. */
  body::before{content:'';position:absolute;inset:0;
    background:repeating-linear-gradient(45deg,rgba(0,0,0,.035) 0 2px,transparent 2px 14px)}
  .b{position:relative;z-index:1;padding:0 6%}
  .d{font-size:.72em;font-weight:500;color:#a2a7b0;margin-top:.55em}
</style><div class="b">Replace with your own photo
<div class="d">${s.file} &nbsp;·&nbsp; ${s.w} × ${s.h}</div></div>`;

const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ph-'));
for (const s of specs) fs.writeFileSync(path.join(tmp, `${s.file}.html`), page(s));

const driver = `
const { chromium } = require(${JSON.stringify(require.resolve('playwright'))});
const path = require('path');
(async () => {
  const b = await chromium.launch();
  for (const s of ${JSON.stringify(specs)}) {
    const p = await b.newPage({ viewport: { width: s.w, height: s.h } });
    await p.goto('file://' + path.join(${JSON.stringify(tmp)}, s.file + '.html'));
    await p.screenshot({
      path: path.join(${JSON.stringify(dest)}, s.file),
      type: /\\.png$/i.test(s.file) ? 'png' : 'jpeg',
      quality: /\\.png$/i.test(s.file) ? undefined : 82,
    });
    await p.close();
  }
  await b.close();
})();`;
const driverPath = path.join(tmp, '_driver.cjs');
fs.writeFileSync(driverPath, driver);
execFileSync('node', [driverPath], { stdio: 'inherit' });

let total = 0;
for (const s of specs) {
  const n = fs.statSync(path.join(dest, s.file)).size;
  total += n;
  console.log(`  placeholder ${s.file}  ${s.w}×${s.h}  ${(n / 1024).toFixed(1)} KB`);
}
console.log(`  ${specs.length} photographs replaced (${(total / 1024).toFixed(0)} KB total)`);
fs.rmSync(tmp, { recursive: true, force: true });
