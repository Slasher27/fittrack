# FitTrack headless test suites

Playwright (Chromium) suites that drive the real app against mocked backends.
They are the regression battery — run them after any change, and add checks
alongside new features.

## Setup (once)

```bash
npm init -y && npm i playwright && npx playwright install chromium   # in any scratch dir
python -m http.server 8099                                          # from the repo root, keep running
```

Then run any suite with `node tests/<name>.js` (exit code 0 = green).

## Suites

| File | Covers | Checks |
|---|---|---|
| auth-test.js | sign-up/in gate, restore-before-seed, sign-out wipe, v1 credential migration, offline-only mode | 49 |
| plans-test.js | plans store, migration, plan library | 18 |
| targets-test.js | structured targets, circuits, editor | 24 |
| library-test.js | exercise catalog integrity, per-side labels, library view | 29 |
| train3-test.js | full-screen logger, PBs, exercise history, week card, flat CSS | 32 |
| coach-test.js | coach chat, tools, preview/accept/discard, transports, orphan-tool_use healing, new chat + archive | 48 |
| onboard-test.js | onboarding, deterministic targets, AI plan generation + validation | 33 |
| share-test.js | invites, sign-up gate, plan sharing, kit adaptation | 21 |
| food-test.js | describe-to-log, recipes, offline fallback | 18 |
| stage7-test.js | nav collapse, weekly review, metering, photo cloud sync | 22 |
| mealplan-test.js | update_meal_plan tool, food reuse/creation, mic buttons | 14 |
| wake.js | screen wake lock acquire/release | pass/fail |
| views-test.js | every view at 320/390/1280 px, no console errors, no h-scroll | pass/fail |

## Conventions (learned the hard way)

- Create contexts with `serviceWorkers:'block'` — SW install fetches bypass
  `page.route` and would cache the real `app/config.js`.
- Mock Supabase by routing `**/app/config.js` to a stub `CONFIG` pointing at
  `https://mock.supabase.co`, then `page.route` that host's `/auth/v1/*`,
  `/rest/v1/*`, `/storage/v1/*` and `/functions/v1/coach`.
- Wait for `body[data-ready="1"]` before asserting; fresh contexts land on the
  sign-in gate (`#view-auth`) — sign in or click `#authSkip` first.
- The occasional `data-ready` timeout on a first run is a boot-timing flake;
  rerun before investigating.
