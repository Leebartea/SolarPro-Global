# SolarPro Global v1

**The premium solar energy website template for certified installers targeting a global audience.**

![Version](https://img.shields.io/badge/Version-1.0.0-f97316?style=flat-square)
![License](https://img.shields.io/badge/License-Single%20Use-1e3a5f?style=flat-square)
![Built With](https://img.shields.io/badge/Built%20With-Tailwind%20CSS-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla%20ES6%2B-eab308?style=flat-square&logo=javascript&logoColor=black)
![No Build Step](https://img.shields.io/badge/Build%20Step-None%20Required-22c55e?style=flat-square)
![Pages](https://img.shields.io/badge/Pages-6-94a3b8?style=flat-square)

---

A complete, production-ready website template for solar PV installation businesses. 6 fully built HTML pages, an interactive savings calculator with real irradiance data for 10 countries, a filterable portfolio with lightbox, dark/light mode, currency switcher, contact form validation, and zero build-step dependency.

Open the folder in any browser. It works.

---

## Live Demo

**Demo:** [your-demo-url] — *(Replace with your Netlify or Vercel URL after deployment)*

---

## What's Included

### 6 Pages

| Page | File | Description |
|------|------|-------------|
| Home | `index.html` | Hero with real solar image, services overview, testimonial slider, portfolio preview, CTA |
| Services | `pages/services.html` | 4 detailed service sections with photography, process steps, payment options |
| Calculator | `pages/calculator.html` | Interactive 7-output solar savings calculator, formula methodology, FAQ accordion |
| Portfolio | `pages/portfolio.html` | 9 project cards with category filter and vanilla JS lightbox |
| About | `pages/about.html` | Company timeline, team profiles, certifications, differentiators |
| Contact | `pages/contact.html` | Validated 6-field form, WhatsApp CTA, map placeholder, FAQ |

---

## Features

### Global (All Pages)
- [x] Dark / light mode toggle with `localStorage` persistence — zero flash on reload
- [x] Currency switcher: USD, EUR, GBP, NGN — persists across all page navigations
- [x] Mobile-first responsive design — hamburger nav on mobile and tablet
- [x] Cookie consent banner — appears on first visit, stored in `localStorage`
- [x] Back-to-top button — appears after 400 px scroll
- [x] AOS Animate On Scroll entrance animations across all sections
- [x] Sticky navbar with scroll shadow transition
- [x] SEO meta tags + Open Graph + robots + canonical links on every page
- [x] WCAG AA accessibility — ARIA labels, roles, `aria-expanded`, keyboard nav throughout
- [x] Consistent footer with social links, WhatsApp, quick nav on all pages

### Solar Savings Calculator
- [x] 10-country irradiance database: Nigeria, USA, Germany, India, Ghana, UAE, UK, South Africa, Kenya, Brazil
- [x] Real Peak Sun Hours (PSH) and electricity tariff pre-filled per selected country
- [x] 7 calculated outputs: system size (kWp), daily yield, annual production, annual savings, payback period, CO₂ offset, 25-year savings
- [x] Animated result cards with staggered 80 ms entrance delay per card
- [x] Input validation with inline error messages for all fields
- [x] Formula methodology section explaining the engineering behind each calculation
- [x] FAQ accordion with 5 technical questions
- [x] All logic in `js/calculator.js` — heavily commented for buyer customisation

### Portfolio
- [x] Filter by: All / Residential / Commercial / Off-Grid — animated show/hide
- [x] 9 project cards with bundled demo photography
- [x] Vanilla JS lightbox (no jQuery) — click any card for detailed project modal
- [x] Keyboard accessible — Enter/Space to open, Escape to close lightbox
- [x] Lightbox populated from `data-*` attributes — no JS changes needed to add projects

### Testimonial Slider
- [x] 5 testimonials with 5-second auto-play
- [x] Manual dot navigation + previous/next arrow buttons
- [x] Touch/swipe support for mobile (50 px threshold)
- [x] Pause on hover

### Contact Form
- [x] 6-field validated form: name, email, phone, country, service interest, message
- [x] Client-side validation with real-time error feedback
- [x] Simulated success state with WhatsApp follow-up link
- [x] WhatsApp direct link with URL-encoded pre-filled message

---

## Quick Start

No installation required. No Node.js. No npm.

1. Download and unzip `SolarPro-Global-v1.zip`
2. Open `index.html` in Chrome, Firefox, Safari, or Edge
3. All pages are linked internally and work from the `file://` protocol

> **Note:** Tailwind CSS and AOS load from CDN — an internet connection is required for first load. For offline/production use, see the [Tech Stack](#tech-stack) section for self-hosting instructions.

---

## How to Customise

### 1. Brand Name & Logo
Edit the logo text in the `<nav>` of every HTML file. Replace the inline SVG icon with your logo image:
```html
<img src="assets/images/logo.svg" alt="Your Company Name" width="32" height="32" />
```

### 2. Color Scheme
All colors are CSS custom properties in `css/custom.css`. Three lines control the entire palette:
```css
:root {
  --primary:   #f97316;  /* orange — change to your brand color */
  --secondary: #1e3a5f;  /* navy blue */
  --accent:    #eab308;  /* yellow */
}
```

### 3. Contact Details
Find and replace across all 6 HTML files:

| Find | Replace With |
|------|-------------|
| `hello@example.com` | Your email address |
| `+234 800 0000 000` | Your phone number |
| `2348000000000` | Your WhatsApp number (no `+`, no spaces) |
| `14 Solar Drive, Victoria Island, Lagos` | Your address |
| `www.example.com` | Your live domain (for canonical URLs) |

### 4. Calculator Country Data
Edit `COUNTRY_DATA` in `js/calculator.js` to update tariffs or add countries:
```javascript
const COUNTRY_DATA = {
  nigeria: {
    psh: 5.5,         // Peak Sun Hours — annual average
    tariff: 68,       // NGN per kWh — update when rates change
    currencySymbol: '₦',
    usdRate: 0.00063,
    tariffInUSD: 0.043
  },
  // ... 9 more countries
};
```

### 5. Portfolio Projects
Each project card uses `data-*` attributes — the JS lightbox reads these on click:
```html
<div class="card project-card"
     data-type="commercial"
     data-title="Your Project Title"
     data-size="50 kWp"
     data-location="City, Country"
     data-description="Full project description here..."
     data-installed="March 2024"
     data-panels="120 × 415Wp panels"
     data-savings="$12,000/yr">
```
Edit the attributes to add your real projects. No JavaScript changes needed.

### 6. Images
Every image is already a local file in `assets/images/` — nothing is fetched
from a CDN, which is what lets the template render offline. Point the `src` at
your own file, or overwrite the demo file keeping its name and dimensions and
change no markup at all:

```html
<!-- Before: -->
<img src="../assets/images/solar-farm-clouds.jpg" ... />

<!-- After: -->
<img src="../assets/images/your-photo.jpg" ... />
```

### 7. Google Maps
In `pages/contact.html`, replace the `.map-placeholder` div with your Google Maps iframe:
```html
<iframe src="https://www.google.com/maps/embed?pb=..."
        width="100%" height="380"
        style="border:0;border-radius:0.75rem;"
        allowfullscreen loading="lazy"
        title="Office location"></iframe>
```

### 8. Payment Gateways
In `pages/services.html`, activate the payment buttons:
```html
<!-- Remove 'disabled' class and add href: -->
<a href="https://paystack.com/pay/your-plan" class="payment-btn" target="_blank" rel="noopener noreferrer">
  Pay with Paystack
</a>
```

---

## Folder Structure

```
SolarPro-Global-v1/
├── index.html               ← Home page
├── pages/
│   ├── services.html        ← Services page
│   ├── calculator.html      ← Solar savings calculator
│   ├── portfolio.html       ← Project portfolio with lightbox
│   ├── about.html           ← Company story, team, certifications
│   └── contact.html         ← Contact form + WhatsApp
├── js/
│   ├── main.js              ← Currency, slider, lightbox, form, cookies
│   ├── calculator.js        ← Solar calculation engine
│   └── theme.js             ← Dark/light mode manager
├── css/
│   └── custom.css           ← CSS variables, components, animations, dark mode
├── assets/
│   ├── images/              ← Place your images here
│   └── icons/               ← Place custom SVG icons here
├── docs/
│   └── documentation.html  ← Full buyer documentation
└── README.md
```

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| HTML5 | — | Semantic markup, accessibility |
| Tailwind CSS | v3 (CDN) | Utility-first layout and spacing |
| Custom CSS | — | CSS variables, components, animations, dark mode |
| Vanilla JavaScript | ES6+ | All interactivity — no frameworks required |
| AOS | 2.3.4 (CDN) | Scroll entrance animations |

**No Node.js. No npm. No build step.**

---

## Deployment

### Netlify (Recommended — free, 30 seconds)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag and drop the `SolarPro-Global-v1` folder
3. Your site goes live instantly

### Vercel
1. Push to GitHub, then go to [vercel.com/new](https://vercel.com/new)
2. Import repo → Framework: Other → Build command: blank → Output: blank
3. Deploy

### GitHub Pages
1. Push to a GitHub repository
2. Settings → Pages → Source: `main` branch, root folder
3. Live at `https://[username].github.io/[repo-name]/`

### cPanel / Web Hosting
1. Upload the entire folder to `public_html` via File Manager or FTP
2. Ensure `index.html` is at the domain root

---

## Browser Support

| Browser | Minimum Version |
|---------|----------------|
| Chrome | 100+ |
| Firefox | 100+ |
| Safari | 15+ |
| Edge | 100+ |
| Mobile Safari (iOS) | 15+ |
| Chrome for Android | Current |

---

## Documentation

Full buyer documentation is at `docs/documentation.html` — open it in your browser for a styled guide covering all customisation options, deployment methods, image credits, and FAQ.

---

## Credits

- **Tailwind CSS** — [tailwindcss.com](https://tailwindcss.com) — MIT License
- **AOS (Animate On Scroll)** — [michalsnik.github.io/aos](https://michalsnik.github.io/aos) — MIT License
- **Photography** — [pexels.com](https://www.pexels.com) — Pexels License (free commercial use)
- **Solar Irradiance Data** — [NASA POWER Project](https://power.larc.nasa.gov) — Public domain

---

## Demo Content Is Sample Content

Every company detail, testimonial, client name, case study, project figure,
certification badge and contact detail in this template is **fictional sample
content**, written to show how the layout behaves with realistic copy. The
bundled photographs are stock images that illustrate the design.

Replace all of it with your own truthful information before you publish. See
`LICENSE.txt` section 4.

## License

**Single Use License** — This template is licensed for use in one (1) project by the purchasing individual or company.

**Permitted:**
- Customise all code and design elements for your own business or one client
- Deploy to a live public-facing domain
- Modify any component, layout, or color

**Not permitted:**
- Reselling or redistributing this template
- Using on more than one end-client project without purchasing additional licenses
- Sharing template files with third parties

For multi-use or extended licenses, contact the template author via the marketplace.

---

## Support

For customisation questions and bug reports, contact the template author via the marketplace where you purchased this template (Gumroad / Selar / ThemeForest). Include your order number. Response within 48 business hours.

---

*SolarPro Global v1.0.0 — Built with certified solar industry knowledge and premium front-end engineering.*
