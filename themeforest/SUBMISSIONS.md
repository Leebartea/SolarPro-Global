# ThemeForest submission log

One row per thing sent to Envato. This is the "future update distinction" — the
record of which template version each Envato submission corresponds to, kept
separate from `CHANGELOG.md` because the two deliverables do not have to move
together and usually should not.

**Why there is no separate version number.** The Envato archive is named after
the template version it was cut from (`SolarPro-Global-ThemeForest-v1.6.0.zip`),
so a second version line would be one more thing to keep in sync and one more
way for the two to disagree. Envato's own item version field takes whatever you
type — put the template version in it. This log is what tells you what you
actually sent, and when.

**The two deliverables are deliberately not in lockstep.** Selar gets every
release, because there the ZIP is the product and a buyer is waiting on the fix.
Envato updates go back through review, so batch them: send a submission when
there is a reason to, not on every patch.

---

## Log

| Date | Template version | Action | Envato status | Notes |
|---|---|---|---|---|
| — | 1.6.0 | *not yet submitted* | — | Package builds and passes all 12 + 1 checks. Three manual checks outstanding — see the guide §4.2. |

<!-- Add a row for every submission, update, and review outcome. A soft
     rejection with its reasons belongs here too: the reasons are the spec, and
     each one should become a check in
     guardrails/checks-themeforest/themeforest.js. -->

---

## What differs between the two packages

Everything comes from one source tree. The differences are produced at package
time, not maintained by hand:

| | Selar (`npm run package`) | ThemeForest (`npm run package:themeforest`) |
|---|---|---|
| Layout | flat template folder | `Main Files/`, `Documentation/`, `Licensing/` |
| Photographs | the six real Pexels photos | **generated placeholders**, same names and dimensions |
| Licensing manifest | `LICENSE.txt` at the root | `LICENSE.txt` **and** `CREDITS.txt` in `Licensing/` |
| Help file | `docs/documentation.html` | the same file as `Documentation/index.html` |
| Gate | 12 checks | those 12 **plus** `themeforest` |
| Size | ~2.0 MB | ~0.5 MB |

The photograph swap is the one that matters, and it is a licensing decision, not
a packaging preference — see `licensing/CREDITS.txt` §1b.

## Item description — Envato wording

The Selar description does not transfer. Two things must be true and are easy
for a developer buyer to check in seconds:

- **10 country datasets**, not "15+". Verify against `COUNTRY_DATA` in
  `js/calculator.js`. ("15+ countries" in the page copy is the fictional demo
  company's marketing, which is fine and is clearly demo content.)
- **AOS for scroll animation. There is no GSAP** anywhere in this template.

And one thing Envato requires you to state explicitly:

> **Images are for preview purposes only and are not included in the download.**
> The template ships with placeholder images at the same dimensions, so you can
> drop your own photography straight in without touching any layout.

Lead with the line that works on both platforms and works better here, because
almost nobody selling a niche template has worked in the niche:

> The solar website template built by a solar installer, for solar installers.
