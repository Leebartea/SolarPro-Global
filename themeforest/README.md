# `themeforest/` — Envato-only artefacts

Everything in this folder exists **only** because ThemeForest asks for it. None
of it ships to a Selar buyer, and none of it is required for the template to
work.

```
themeforest/
└── licensing/
    └── CREDITS.txt      every bundled third-party asset, its licence and source
```

## Why this is a folder and not a branch

The original plan (`Revenue Plan/OPEN-ITEMS.md`) was a `release/themeforest`
branch off `main`. That was changed on 7 Aug 2026, deliberately.

A branch has to be merged every time `main` moves. An unmerged branch is exactly
how a marketplace ends up serving a build older than the one you already fixed —
the same failure that put v1.2.0 on the Selar listing while v1.4.0 sat beside it
on disk. It also costs you a `git switch` before you can touch either version,
in a workflow where you do not otherwise use branches.

One tree instead. The extras live here; `npm run package:themeforest` composes
them into Envato's folder layout at package time. **There is nothing to keep in
sync because there is no second copy of the template.**

The separation the branch was meant to give is preserved by the gate, not by
version control:

| | Runs | Blocks |
|---|---|---|
| `npm run check` | 11 core checks | the Selar release |
| `npm run check:themeforest` | those 11 **plus** `themeforest` | the Envato submission only |

The `themeforest` check lives in `guardrails/checks-themeforest/`, which
`run.js` only loads when passed `--suite=themeforest`. So an Envato requirement
can never hold back a fix for someone who has already paid you.

And in the other direction: `guardrails/package.js` excludes `themeforest/` from
the buyer ZIP, and `package-hygiene` fails if it ever appears in one.

## What is not here

The three pages Envato requires — `404.html`, `pages/privacy.html`,
`pages/terms.html` — are **not** in this folder. They are in the template
proper, because a direct buyer benefits from them just as much. They are linked
from every footer and covered by all 11 core checks.

The rule for deciding: if a Selar buyer would want it, it goes in the template.
Only packaging convention lives here.

## Full submission walkthrough

`~/Solar Advert/Revenue Plan/09-themeforest/THEMEFOREST-GUIDE.md`
