#!/usr/bin/env node
'use strict';
/**
 * Compose a new page from an existing page's shell.
 *
 *   node scripts/new-page.js
 *
 * Every page in this template carries its own copy of the navbar, footer and
 * head block. That is the established convention here — there is no build step
 * assembling partials, and a buyer editing the template edits real HTML rather
 * than a template language they would have to learn. The cost of that choice is
 * that a new page hand-written from scratch drifts from the others in ways the
 * css-contract check can only partly catch: a stale nav link, a missing
 * skip-link, a theme script that runs after first paint.
 *
 * So new pages are composed FROM an existing page rather than written beside
 * it. The shell is lifted verbatim; only the <title>, the meta block and the
 * body content differ. Re-running this overwrites the generated pages, which is
 * what you want after a nav change — and is why it stays in the repo instead of
 * being a one-off.
 *
 * Generated pages are normal source files afterwards. Edit them directly for
 * content; re-run this only to re-sync the shell.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'pages', 'about.html');
const src = fs.readFileSync(SOURCE, 'utf8');

/* The shell boundaries. Anything between </nav> and the footer comment is page
 * content; everything outside it is shared. */
const navEnd = src.indexOf('</nav>') + '</nav>'.length;
const footerStart = src.indexOf('<!-- FOOTER -->');
if (navEnd < 10 || footerStart < 0) {
  throw new Error('could not locate the shell boundaries in ' + SOURCE);
}

const HEAD_OPEN = src.slice(0, src.indexOf('  <title>'));
const FOOTER = src.slice(footerStart);

/* The donor page marks its own nav link `active`. None of these pages is in the
 * nav, so carrying that class over would highlight "About" while the visitor is
 * reading the privacy policy — a wrong current-page indicator, and one no check
 * would flag because the class is real and defined. */
const HEAD_TAIL = src
  .slice(src.indexOf('  <meta property="og:image"'), navEnd)
  .replace(/ class="nav-link active"/g, ' class="nav-link"');

/** Head + nav, with this page's title and description swapped in. */
function shell({ title, description, canonical, robots }) {
  return (
    HEAD_OPEN +
    `  <title>${title}</title>\n` +
    `  <meta name="description" content="${description}" />\n` +
    `  <meta name="robots" content="${robots}" />\n` +
    `  <!-- Canonical URL — replace with your live domain -->\n` +
    `  <link rel="canonical" href="https://www.example.com/${canonical}" />\n` +
    `  <meta property="og:title" content="${title}" />\n` +
    `  <meta property="og:description" content="${description}" />\n` +
    HEAD_TAIL
  );
}

/** A page hero matching the other interior pages, without the photo. */
const hero = (tag, heading, standfirst) => `
<!-- PAGE HERO -->
<section class="page-hero" aria-label="Page hero">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
    <div class="max-w-2xl" data-aos="fade-up">
      <div class="section-tag" style="background:rgba(249,115,22,0.15);color:var(--primary);">${tag}</div>
      <h1 class="text-white font-black mt-3 mb-4" style="font-size:clamp(2rem,4vw,3rem);">${heading}</h1>
      <p style="color:rgba(255,255,255,0.72);font-size:1.05rem;line-height:1.65;">${standfirst}</p>
    </div>
  </div>
</section>
`;

/**
 * A legal-copy section. `blocks` is [heading, ...paragraphs][].
 *
 * The copy is deliberately written as a WORKING DRAFT the buyer completes, with
 * every business-specific fact left as a bracketed placeholder. Shipping a
 * finished-looking privacy policy would be worse than shipping none: a buyer
 * publishes it unread, and it then describes data handling their site does not
 * do. The `content-integrity` check enforces that the placeholders survive.
 */
const legal = (blocks) => `
<section class="py-20" style="background-color:var(--bg);">
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="card p-6 mb-10" style="border-left:3px solid var(--primary);">
      <p style="color:var(--text);font-weight:700;margin-bottom:0.5rem;">This is a template, not legal advice.</p>
      <p style="color:var(--text-muted);line-height:1.7;">Every <code>[BRACKETED]</code> value below must be replaced with your own
      details, and the whole document reviewed against the law that applies where you
      and your customers are. Publishing it unchanged would describe a business that
      is not yours.</p>
    </div>
${blocks.map(([h, ...ps]) => `    <h2 class="section-title mt-10 mb-3" style="font-size:1.4rem;">${h}</h2>
${ps.map((p) => `    <p style="color:var(--text-muted);line-height:1.75;margin-bottom:1rem;">${p}</p>`).join('\n')}`).join('\n')}
    <p style="color:var(--text-muted);line-height:1.75;margin-top:2.5rem;font-size:0.9rem;">
      Last updated: <strong>[DATE]</strong>
    </p>
  </div>
</section>
`;

const pages = {};

/* ── Privacy ──────────────────────────────────────────────────────────── */
pages['pages/privacy.html'] =
  shell({
    title: 'Privacy Policy | SolarPro Global',
    description: 'How SolarPro Global collects, uses and protects the personal information you provide through this website.',
    canonical: 'pages/privacy.html',
    robots: 'index, follow',
  }) +
  hero('Legal', 'Privacy Policy', 'How we handle the information you give us, and what you can ask us to do with it.') +
  legal([
    ['Who we are', 'This website is operated by <strong>[YOUR COMPANY NAME]</strong>, [YOUR REGISTERED ADDRESS]. For any question about this policy, or to exercise any right described below, contact us at <strong>[YOUR EMAIL]</strong>.'],
    ['What we collect', 'When you submit the contact form or request a solar estimate we collect the details you type into it — typically your name, email address, phone number and a description of your requirements.', 'The solar calculator on this site runs entirely in your browser. The figures you enter are not transmitted to us unless you separately submit them through the contact form.', 'Like most websites, our hosting provider records standard server logs (IP address, browser type, pages requested, timestamp) for security and diagnostics.'],
    ['Why we use it', 'To answer your enquiry, prepare a quotation, and carry out any work you engage us for. If you have asked to hear from us, we may also send occasional updates — every such message includes a way to stop them.', 'We rely on your consent where you have given it, and on the legitimate interest of responding to an enquiry you initiated.'],
    ['Who we share it with', 'We do not sell your information. We share it only with service providers that make this site and our business work — for example our email provider and our hosting company — and only to the extent they need it.', '[LIST ANY THIRD-PARTY SERVICES YOU ACTUALLY USE: form handler, analytics, CRM, email marketing. If you use none, say so.]'],
    ['How long we keep it', 'Enquiries that do not become projects: <strong>[e.g. 24 months]</strong>. Records relating to work we carried out: for as long as required by tax and warranty obligations in <strong>[YOUR COUNTRY]</strong>.'],
    ['Your rights', 'You can ask us for a copy of the information we hold about you, ask us to correct it, or ask us to delete it. Write to <strong>[YOUR EMAIL]</strong> and we will respond within <strong>[e.g. 30 days]</strong>.', 'If you are unsatisfied with our response you may complain to your national data protection authority.'],
    ['Cookies', 'This template stores one item in your browser to remember your light/dark theme preference. It is not a tracking cookie and it never leaves your device.', '[IF YOU ADD ANALYTICS OR ADVERTISING, DESCRIBE IT HERE AND OBTAIN CONSENT BEFORE LOADING IT.]'],
    ['Changes to this policy', 'We will post any change on this page and update the date below.'],
  ]) +
  FOOTER;

/* ── Terms ────────────────────────────────────────────────────────────── */
pages['pages/terms.html'] =
  shell({
    title: 'Terms of Service | SolarPro Global',
    description: 'The terms on which SolarPro Global provides this website, its solar calculator, and any quotation issued through it.',
    canonical: 'pages/terms.html',
    robots: 'index, follow',
  }) +
  hero('Legal', 'Terms of Service', 'The terms on which we provide this website and anything you obtain through it.') +
  legal([
    ['Agreement', 'By using this website you accept these terms. They are between you and <strong>[YOUR COMPANY NAME]</strong>, [YOUR REGISTERED ADDRESS].'],
    ['The solar calculator is an estimate, not a design', 'The calculator on this site produces <strong>indicative figures only</strong>. It uses typical peak-sun-hour values and generic performance assumptions, and it does not account for your roof orientation, shading, structural condition, local electrical code, or the actual equipment available to you.', 'It is not an engineering tool and its output must not be relied on as a system design. Any installation must be specified and validated by a qualified solar engineer or licensed electrician against the codes that apply where the work is done.'],
    ['Quotations', 'Nothing on this website is a binding offer. A quotation is binding only when we issue it in writing, referencing a site survey, and only for the period stated on it.', 'Prices for solar equipment move with exchange rates and supply. An expired quotation will be re-priced.'],
    ['Your obligations', 'You agree to give us accurate information about your site and your energy use, to provide safe access for a survey and installation, and to hold any permission required from a landlord, body corporate or utility.'],
    ['Intellectual property', 'The content, layout and code of this website belong to <strong>[YOUR COMPANY NAME]</strong> or its licensors. You may not copy or redistribute it, except as permitted by the licence under which the template was supplied.'],
    ['Limitation of liability', 'To the extent the law allows, we are not liable for indirect or consequential loss arising from your use of this website or reliance on the calculator. Nothing here limits liability for death or personal injury caused by negligence, or for anything else that cannot lawfully be limited.'],
    ['Links to other sites', 'Where we link to a third-party site we do so for convenience. We do not control it and are not responsible for its content.'],
    ['Governing law', 'These terms are governed by the law of <strong>[YOUR COUNTRY / STATE]</strong>, and the courts of <strong>[YOUR JURISDICTION]</strong> have exclusive jurisdiction.'],
    ['Contact', 'Questions about these terms: <strong>[YOUR EMAIL]</strong>.'],
  ]) +
  FOOTER;

/* ── 404 ──────────────────────────────────────────────────────────────────
 * At the repo ROOT, not in pages/, because a server serves it for a miss at
 * any depth and a root-relative asset path is the only one that survives that.
 * Its links are therefore written root-relative too. */
pages['404.html'] = (() => {
  const page =
    shell({
      title: 'Page Not Found | SolarPro Global',
      description: 'The page you were looking for does not exist. Find your way back to SolarPro Global.',
      canonical: '404.html',
      robots: 'noindex, follow',
    }) +
    `
<!-- 404 -->
<section class="py-20" style="background-color:var(--bg);min-height:60vh;display:flex;align-items:center;">
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
    <div class="section-tag" style="margin:0 auto;">Error 404</div>
    <h1 class="section-title mt-4 mb-4" style="font-size:clamp(2rem,5vw,3.25rem);">This page isn't here</h1>
    <p style="color:var(--text-muted);font-size:1.05rem;line-height:1.7;max-width:34rem;margin:0 auto 2rem;">
      The link may be out of date, or the address mistyped. Everything below still works.
    </p>
    <div class="flex flex-wrap gap-4 justify-center">
      <a href="index.html" class="btn-primary px-7 py-3 text-base">Back to Home</a>
      <a href="pages/contact.html" class="btn-outline px-7 py-3 text-base">Contact Us</a>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-14 text-left">
      <a href="pages/services.html" class="card p-6" style="text-decoration:none;display:block;">
        <h3 style="font-weight:800;font-size:1.05rem;color:var(--text);margin-bottom:.4rem;">Services</h3>
        <p style="color:var(--text-muted);font-size:.92rem;line-height:1.6;">Residential, commercial and off-grid solar installation.</p>
      </a>
      <a href="pages/calculator.html" class="card p-6" style="text-decoration:none;display:block;">
        <h3 style="font-weight:800;font-size:1.05rem;color:var(--text);margin-bottom:.4rem;">Solar Calculator</h3>
        <p style="color:var(--text-muted);font-size:.92rem;line-height:1.6;">Estimate system size, cost and payback in your currency.</p>
      </a>
      <a href="pages/portfolio.html" class="card p-6" style="text-decoration:none;display:block;">
        <h3 style="font-weight:800;font-size:1.05rem;color:var(--text);margin-bottom:.4rem;">Portfolio</h3>
        <p style="color:var(--text-muted);font-size:.92rem;line-height:1.6;">Completed installations and the numbers behind them.</p>
      </a>
    </div>
  </div>
</section>
` +
    FOOTER;

  /* Rewrite the shell's relative paths for a file that lives one level up. A
   * 404 served from the root with ../ asset paths renders unstyled, which is
   * exactly the failure this template already had once. */
  return page
    .replace(/\.\.\/assets\//g, 'assets/')
    .replace(/\.\.\/vendor\//g, 'vendor/')
    .replace(/\.\.\/css\//g, 'css/')
    .replace(/\.\.\/js\//g, 'js/')
    .replace(/href="\.\.\/index\.html"/g, 'href="index.html"')
    .replace(/href="(about|services|calculator|portfolio|contact|privacy|terms)\.html(#[\w-]+)?"/g, 'href="pages/$1.html$2"')
    .replace(/href="\.\.\/pages\//g, 'href="pages/');
})();

for (const [rel, html] of Object.entries(pages)) {
  const out = path.join(ROOT, rel);
  fs.writeFileSync(out, html);
  console.log('wrote', rel, `(${html.split('\n').length} lines)`);
}
