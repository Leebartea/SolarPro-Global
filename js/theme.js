// theme.js — load in <head> to prevent flash of wrong theme.
// Applies 'dark' or 'light' class to <html> before body renders.
(function () {
  var saved     = localStorage.getItem('solarproTheme');
  var preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  var theme     = saved || preferred;
  var root      = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
})();
