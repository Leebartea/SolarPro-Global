/**
 * theme.js — reconciles the stored theme preference with the document.
 *
 * WHAT ACTUALLY PREVENTS THE FLASH OF WRONG THEME is the small inline script in
 * the <head> of every page, not this file. This one loads at the end of <body>,
 * which is far too late to affect first paint. It exists as a safety net: if a
 * page is assembled without the inline block, or the preference is changed in
 * another tab, this re-applies the correct classes.
 *
 * Three bugs were fixed here in v1.6.0, all of them silent:
 *
 *  1. It did not know about the 'system' preference added in v1.4.0, so a
 *     visitor whose stored value was "system" got `class="system"` on <html> —
 *     neither `light` nor `dark`, which are the only two the stylesheet styles.
 *     Every theme token fell back to its initial value until main.js loaded and
 *     repaired it. On a slow connection that is a visibly unstyled page.
 *  2. It applied the stored string unvalidated, so any junk value in
 *     localStorage produced the same result.
 *  3. `localStorage.getItem` was called with no try/catch. Safari in private
 *     mode and any browser with site data blocked throw on access, and because
 *     this file is an IIFE that exception was uncaught — a console error on
 *     every page load, which is a standard marketplace review rejection.
 *
 * Kept deliberately dependency-free and in the same shape as the inline block,
 * so the two cannot disagree about what a preference means.
 */
(function () {
  var VALID = ['system', 'light', 'dark'];

  var pref = null;
  try {
    pref = localStorage.getItem('solarproTheme');
  } catch (e) {
    /* Site data blocked or unavailable. Not an error worth surfacing — the
       visitor simply gets the system preference for this session. */
  }
  if (VALID.indexOf(pref) === -1) pref = 'system';

  var resolved = pref;
  if (pref === 'system') {
    resolved = window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  var root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(resolved);
  root.setAttribute('data-theme-pref', pref);
})();
