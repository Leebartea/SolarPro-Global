# Changelog — SolarPro Global

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
