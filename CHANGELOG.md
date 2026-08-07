# Changelog — SolarPro Global

## 1.6.0 — 7 August 2026

- **Three new pages: 404, Privacy Policy and Terms of Service.** All three are
  linked from the footer of every page. The 404 sits at the top level, because a
  server serves it for a missing address at any depth. The two legal pages are
  working drafts with every business-specific value left as a `[BRACKETED]`
  placeholder — they are a starting point to fill in and have reviewed, not
  finished documents, and publishing them unedited would describe a business
  that is not yours.
- **`.btn-outline` was unreadable in the light theme.** It used the fixed brand
  orange, which measures 2.68:1 against the light background — below WCAG AA for
  any text. It now uses the theme-aware `--primary` token (4.6:1 light, 6.1:1
  dark) and keeps the orange border. The class was defined but used on no
  shipped page, so nothing had ever sampled it; it surfaced the moment the 404
  page used it.
- **Six of the eleven checks were silently skipping any page not in a hardcoded
  list.** They now cover all nine pages, and a new assertion fails the build if a
  page exists that the list does not name — so a future page cannot be added
  without being checked.
- **All six demo photographs replaced**, with their source pages recorded at the
  moment of download (`themeforest/licensing/CREDITS.txt`). The previous set had
  no recorded provenance — the images had been downloaded and renamed during the
  v1.3.0 self-contained pass and their origin lost — which is not a claim that
  can be made on a marketplace submission. The set is also 1.28 MB instead of
  2.8 MB.
- **The home hero no longer depends on the photograph being dark.** Its heading
  and lead paragraph are hardcoded white, and in the light theme they were
  composited over the page's near-white background; the only thing making them
  readable was the background image happening to be dark. Swapping in a brighter
  photo made the hero unreadable. It now carries its own dark backdrop, the same
  way the interior page heroes always have. The contrast check could not have
  caught this: it declines to measure text over photographs rather than guess.
- **`js/theme.js` had three silent bugs and is rewritten.** It did not know
  about the `system` preference added in v1.4.0, so a visitor whose stored value
  was `system` briefly got `class="system"` on `<html>` — neither of the two the
  stylesheet styles. It applied any stored string unvalidated. And it read
  `localStorage` with no `try`/`catch`, so in Safari private mode, or with site
  data blocked, it threw an uncaught error on every page load.
- **Security headers**: added a Content Security Policy, and a Permissions
  Policy denying camera, microphone and geolocation. The one inline `onclick`
  moved into `main.js`, so no behaviour depends on `unsafe-inline`. **If you
  wire the contact form, you must add your form provider's origin to
  `connect-src`** — this is documented beside the form-wiring snippet, because
  a blocked request fails silently.
- **New `security` guardrail check** (12 checks now): DOM-XSS sinks, `innerHTML`
  assigned anything but a constant, unguarded storage access, `target="_blank"`
  without `rel="noopener"`, inline event handlers, plain-HTTP URLs, and the
  required response headers. Mutation-tested against 8 reintroduced faults.
- **The documentation said v1.0.0** through five releases, and credited thirteen
  Unsplash photo IDs from the version that hotlinked its images, while six
  photographs actually ship. Both corrected.

## 1.5.0 — 5 August 2026

- **All touch targets now meet the 44px minimum.** The mobile menu links were
  40×30px and the footer social buttons 34×34px — the two things most often
  tapped on a phone, and the fiddliest. Everything interactive now clears 44px
  at every tested width.

## 1.4.0 — 4 August 2026

- **Mobile currency switcher fixed.** Inside the mobile menu the dropdown was
  anchored to the right like the navbar one, so on a phone it opened 49px off
  the left edge of the screen with the currency names clipped. Reported on a
  Galaxy S23+ and reproduced at 360, 375, 390 and 414px.
- **System theme mode**, and it is now the default. Three settings — System,
  Light, Dark. System follows your device's appearance setting and keeps
  following it, so a phone that switches to dark at sunset takes the site with
  it. An explicit choice pins and ignores the device.
- **Footer divider fixed.** It was rendering as a filled grey slab behind the
  copyright line instead of a hairline above it.
- **Contact form wiring documented.** The form validates and confirms but does
  not send. The documentation now carries the complete Web3Forms setup, the
  Formspree and EmailJS equivalents, and a reminder to send yourself a test
  enquiry before going live. **Do this before you launch** — a live site that
  silently discards enquiries is worse than one with no form.
- **Verified in Safari and Firefox**, not just Chrome.
- Removed two buyer instructions that were rendering as visible page copy, and
  unified the company footprint figure on "15+ countries".
- Assets no longer cached for a day, so a fix reaches returning visitors
  immediately.

## 1.3.0 — 4 August 2026

- Every interactive feature rewired: the testimonial slider, accordion,
  portfolio filter, lightbox, currency switcher and active-nav highlight were
  bound to selectors that did not exist in the markup and silently did nothing.
- Contact form gained real per-field validation with accessible error messages.
- **Calculator corrections.** Each country's own grid CO₂ intensity is now used
  rather than one global figure, and annual totals no longer assume 30-day
  months. Both affected the savings, payback and CO₂ figures shown to clients.
- Mobile navigation fixed — the menu button had been pushed off-screen.
- Navbar switches to the mobile menu at 1024px instead of 768px; it overflowed
  on iPad portrait.

## 1.2.0 — 3 August 2026

- **Complete stylesheet rebuild.** 70 classes used by the pages were defined in
  no stylesheet, so buttons, section labels, cards, accordions, stat blocks and
  form fields rendered unstyled.
- **Now fully self-contained.** Tailwind is compiled to an 11 KB file, AOS is
  bundled, both webfonts are self-hosted and all photography ships with the
  template. It opens correctly with no internet connection.
- Replaced demo photography that did not show solar, and two images that had
  been deleted upstream and were rendering broken.
- Roughly 40 colour-contrast failures fixed across both themes.
- Added `LICENSE.txt` and declared all demo content as samples.

## 1.0.0 — 1 March 2026

- Initial release.
