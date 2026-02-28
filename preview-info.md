# SolarPro Global v1 — Marketplace Preview & Packaging Guide

Instructions for creating screenshots, preview images, and the final ZIP for submission to Gumroad, Selar, and ThemeForest.

---

## 1. Browser Screenshots (Live Preview Images)

### Setup

Open `index.html` in Google Chrome. Set the browser window to **1440 px wide** before taking screenshots (use Chrome DevTools → Responsive mode → set to 1440 × 900, or drag the window to full width on a 1440p+ monitor).

### Required Screenshots

Take the following screenshots in order. For each, press **Ctrl+Shift+P** (Mac: **Cmd+Shift+P**) in Chrome DevTools → type "screenshot" → select **Capture full size screenshot** to capture the full page without scrolling.

| # | Page | File Name | Notes |
|---|------|-----------|-------|
| 1 | Home — full page | `preview-01-home.jpg` | Hero visible at top, scroll to capture all sections |
| 2 | Home — hero close-up | `preview-02-hero.jpg` | Crop to just the hero section (1440 × 900 px) |
| 3 | Calculator — results visible | `preview-03-calculator.jpg` | Enter ₦80,000 bill for Nigeria and click Calculate before screenshotting |
| 4 | Portfolio — lightbox open | `preview-04-portfolio-lightbox.jpg` | Click any project card to open the lightbox, then screenshot |
| 5 | About page — full | `preview-05-about.jpg` | Full page capture |
| 6 | Services page — top half | `preview-06-services.jpg` | 1440 × 900 px, hero visible |
| 7 | Contact page — form visible | `preview-07-contact.jpg` | 1440 × 900 px |
| 8 | Dark mode — home hero | `preview-08-dark-mode.jpg` | Toggle dark mode (moon icon), screenshot home hero |
| 9 | Mobile — home (375 px wide) | `preview-09-mobile.jpg` | Set DevTools to iPhone 14 (390 × 844), full page capture |
| 10 | Mobile — calculator | `preview-10-mobile-calculator.jpg` | Calculator page at 390 px width, results displayed |

### Screenshot Format

- Export as **JPEG at 85–90% quality** to keep file size under 500 KB per image
- Minimum resolution: 1440 × 900 px for desktop, 390 × 800 px for mobile
- No watermarks or browser chrome in final previews

---

## 2. ThemeForest Thumbnail (Required)

ThemeForest requires a **590 × 300 px** thumbnail called `thumbnail.jpg` for the item listing.

### Recommended Layout

Use Canva, Figma, or Adobe XD to compose the thumbnail:

```
Background: dark gradient (#0f172a → #1e3a5f)

Left half:
  - SolarPro Global logo (sun icon + wordmark)
  - Tagline: "Premium Solar Website Template"
  - 3 feature bullets in small text:
      ✓ 6 Pages · Solar Calculator · Dark Mode

Right half:
  - Cropped screenshot of the home hero section
    (show the solar panel background image + heading)
  - Slight drop shadow or subtle border
```

- Font: Inter Bold or similar sans-serif
- Accent color: #f97316 (orange) for checkmarks and highlights
- Keep text large enough to read at 295 × 150 px (thumbnail shown at 50% on mobile)

---

## 3. Gumroad / Selar Cover Image

For Gumroad and Selar, create a **1280 × 720 px** cover image (16:9 landscape).

Recommended layout: Same composition as the ThemeForest thumbnail but wider — show two or three stacked screenshots on the right side (home hero, calculator results, portfolio lightbox) with the product name and key features on the left.

Export as JPEG, max 1 MB.

---

## 4. Product Hunt Gallery (Optional)

If submitting to Product Hunt, prepare 4–5 gallery images at **1270 × 760 px**:

1. Homepage hero + dark/light toggle side by side
2. Calculator with results displayed
3. Portfolio filter + lightbox
4. Mobile view (two phones side by side — home + calculator)
5. Feature summary card (text-based: list all 6 pages + key features on a dark background)

---

## 5. Creating the Delivery ZIP

### Files to Include

```
SolarPro-Global-v1/
├── index.html
├── pages/
│   ├── services.html
│   ├── calculator.html
│   ├── portfolio.html
│   ├── about.html
│   └── contact.html
├── js/
│   ├── main.js
│   ├── calculator.js
│   └── theme.js
├── css/
│   └── custom.css
├── assets/
│   ├── images/           ← include a .gitkeep or placeholder README inside
│   └── icons/            ← include a .gitkeep or placeholder README inside
├── docs/
│   └── documentation.html
├── README.md
└── preview-info.md       ← optional: exclude from buyer delivery ZIP
```

### Files to Exclude from the Buyer ZIP

- `.claude/` directory (internal build notes)
- `.DS_Store`, `Thumbs.db`, or any OS-generated files
- Any local test files or drafts not part of the template

### Creating the ZIP on macOS

```bash
cd ~/Downloads
zip -r SolarPro-Global-v1.zip SolarPro-Global-v1 \
  --exclude "*.DS_Store" \
  --exclude "*/.claude/*" \
  --exclude "*/preview-info.md"
```

### Creating the ZIP on Windows

Right-click the `SolarPro-Global-v1` folder → Send to → Compressed (zipped) folder.
Then open the ZIP, navigate into the folder, and delete any `.DS_Store` or `.claude` folders if present.

### Verify the ZIP

Before uploading to any marketplace, unzip the file to a new temporary folder and open `index.html` in a browser to confirm everything works correctly from the unzipped location.

---

## 6. ThemeForest Submission Checklist

- [ ] Item title: "SolarPro Global — Solar Installation Website Template"
- [ ] Category: Site Templates → Business → Business
- [ ] Tags: solar, energy, renewable, installation, calculator, dark mode, responsive, html5, tailwind
- [ ] Item description: Use the README.md feature list as the base, expand into buyer-focused bullet points
- [ ] Preview images: Main preview (590 × 300), screenshots uploaded as additional previews
- [ ] Demo URL: Set up on Netlify/Vercel, point to live URL
- [ ] Price tier: $19 (Regular License) — consistent with comparable HTML templates on ThemeForest
- [ ] Include: `thumbnail.jpg` at 590 × 300 px in the submission package root

---

## 7. Gumroad Listing Checklist

- [ ] Product name: "SolarPro Global v1 — Premium Solar Website Template"
- [ ] Price: $49 (single use)
- [ ] Cover image: 1280 × 720 px
- [ ] Description: Feature list from README + "No install required — open in browser"
- [ ] Tags: solar, website template, html, dark mode, calculator
- [ ] File: Upload `SolarPro-Global-v1.zip`
- [ ] Enable: "I want buyers to pay what they want" = OFF (fixed price)
- [ ] Thank-you note: "Open index.html in any browser to get started. Documentation at docs/documentation.html."

---

## 8. Selar Listing Checklist

- [ ] Product type: Digital Download
- [ ] Price: Set in NGN equivalent of $49 (approx ₦75,000 at time of listing — adjust to current rate)
- [ ] Product image: 1280 × 720 px (same as Gumroad cover)
- [ ] File: Same ZIP as Gumroad
- [ ] Category: Website Templates
- [ ] Description: Same as Gumroad listing

---

*SolarPro Global v1 — Elite Product Architecture. Built to sell.*
