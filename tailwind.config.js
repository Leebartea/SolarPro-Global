/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan every page so the compiled stylesheet contains exactly the utilities
  // this template actually uses — and nothing else.
  content: [
    './index.html',
    './404.html',            // root-level, so ./pages/** does not reach it
    './pages/**/*.html',
    './js/**/*.js',
  ],
  // Theming is driven by CSS custom properties on `html.dark` / `html.light`
  // in css/custom.css, not by Tailwind's `dark:` variant. Setting this to
  // 'class' keeps the two systems consistent if `dark:` is ever introduced.
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};
