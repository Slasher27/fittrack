# CLAUDE.md — FitTrack

Guidance for Claude Code (and any developer) working on this repo. Read this
first before making changes.

---

## 1. What this app is

**FitTrack** is a personal fitness tracker built as an **offline-first
Progressive Web App (PWA)**. It tracks daily food intake against calorie/macro
targets, bodyweight & measurements, progress photos, and strength-training
workouts. It was built around one user's specific plan (45yo male, body
recomposition to 15% body fat, 3-day full-body program, ~2,150 kcal / 180 g
protein target).

**Core product principles — do not break these:**

- **Zero dependencies, no build step.** Everything is hand-written vanilla
  HTML/CSS/JS. There is no npm, no bundler, no framework, no transpile step.
  You edit the source files and they run as-is.
- **Fully offline & local.** All user data lives in the browser's **IndexedDB**
  on the user's device. Nothing is uploaded to any server. There is no backend
  and no network calls at runtime (a service worker caches the app shell).
- **Installable PWA.** Manifest + service worker make it installable to a phone
  home screen and usable with no connection.
- **Single-file app logic.** Essentially the entire application (markup, styles,
  and logic) lives in `index.html`. Keep it that way unless there's a strong
  reason not to — it's what keeps the app dependency-free and easy to host.

If you're tempted to add React/Vue/a build tool: **don't**, unless the user
explicitly asks and accepts that it introduces a build step and breaks the
"drag-the-folder-to-any-host" simplicity. Prefer improving the vanilla code.

---

## 2. File structure

```
fittrack/
├── index.html          ← THE APP. All HTML, CSS (<style>), and JS (<script>).
├── manifest.json       ← PWA manifest (name, icons, theme, display:standalone).
├── service-worker.js   ← Offline cache of the app shell. Has a CACHE version const.
├── icon-192.png        ← PWA icons (barbell glyph on green gradient).
├── icon-512.png
├── icon-maskable-512.png
├── apple-touch-icon.png
├── favicon.png
├── README.md           ← End-user deploy/install instructions.
├── UI-UX-PLAN.md       ← Active UI/UX enhancement plan + session log (see §10).
└── CLAUDE.md           ← This file.
```

Nearly all work happens in **`index.html`**. It's organised top-to-bottom as:
`<head>` (meta + manifest link + the entire `<style>` block) → `<body>` (all
five view containers + bottom nav + modal root + toast) → one big `<script>`.

---

## 3. Running & testing locally

**You must serve over HTTP** — opening `index.html` as a `file://` URL will
break the service worker and can break IndexedDB. From the repo root:

```bash
python3 -m http.server 8099
# then open http://localhost:8099/index.html
```

There is no automated test suite in the repo. During development the app was
verified by driving it with Playwright (headless Chromium): load the page,
click through flows, and assert on DOM text + capture `pageerror`/`console`
events. If you add Playwright checks, key smoke flows are: log a food, log a
meal, add a measurement, log a workout, and confirm `#calRemain` / macro bars
update with **no console errors**.

**Common gotcha when testing:** IndexedDB persists per-origin. A fresh
Playwright `chromium.launch()` uses a clean profile so the DB starts empty and
`seedIfEmpty()` reseeds. If you test in your normal browser, use the in-app
**⚙️ Settings → Erase all data** (or devtools → Application → IndexedDB) to
reset.

---

## 4. Architecture of `index.html`

### 4.1 Views & navigation
Six `<div class="view">` containers toggled by CSS `.hidden`: five tabs
(`#view-today`, `#view-food`, `#view-body`, `#view-photos`, `#view-train`)
driven by the fixed bottom `.nav` (`data-nav="<view>"` buttons), plus
`#view-plan` (the 📖 Plan/help screen, opened via the header `#helpBtn`, not
in the nav).

**`#view-plan` / AI assistant:** the user's original coaching document lives
in-app as `PLAN_SECTIONS` (8 `<details>` accordions). The Ask box calls the
Anthropic Messages API directly from the browser (raw `fetch`, model
`claude-opus-5`, plan text as a cached system prompt) **only** when the user
has stored an API key (`SET.aiKey`, Settings) and is online; otherwise it
falls back to a local keyword search over the sections. This is the app's one
optional runtime network call — keep the offline fallback working, and never
send any user data beyond the typed question.

- **`go(view)`** — the router. Hides all views, shows the target, updates the
  active nav button, scrolls to top, and calls that view's render function.
  Every navigation goes through `go()`.

### 4.2 Data layer (IndexedDB)
A tiny promise wrapper around IndexedDB (db name `fittrack`, version 1):

- `openDB()` — opens/creates stores in `onupgradeneeded`.
- `tx(store, mode)` → object store handle.
- `idbGetAll(store)`, `idbGet(store, key)`, `idbPut(store, val)`,
  `idbDel(store, key)`, `idbByDate(store, dateStr)` (uses the `date` index).

**Object stores & record shapes:**

| Store | keyPath | Index | Record shape |
|---|---|---|---|
| `kv` | `k` | — | settings + misc singletons (see below) |
| `foods` | `id` | — | `{id, name, group, serving, kcal, protein, carbs, fat, custom:bool}` |
| `meals` | `id` | — | `{id, day?, slot?, name, items:[{foodId, servings}], custom:bool}` |
| `log` | `id` | `date` | `{id, date:'YYYY-MM-DD', meal:'breakfast'|'lunch'|'snack'|'dinner', foodId, name, serving, servings, kcal, protein, carbs, fat, ts}` |
| `measurements` | `id` | `date` | `{id, date, weight, waist, chest, arm, thigh, notes}` |
| `photos` | `id` | `date` | `{id, date, category:'Front'|'Side'|'Back', note, blob:Blob, ts}` |
| `workouts` | `id` | `date` | `{id, date, dayKey:'A'|'B'|'C', title, notes, ts, exercises:[{name, target, sets:[{weight, reps}]}]}` |

`kv` singletons:
- `{k:'settings', targets:{kcal, protein, carbs, fat}, goalWeight, startWeight}`
- `{k:'mealSeedVersion', v:<int>}` — see §5.

**Macro model:** each food stores macros **per one serving**. `serving` is a
human label. For weight/volume foods it's `"100 g"`, `"40 g"`, `"100 ml"` etc,
so logging is a decimal multiplier (e.g. 180 g chicken = `1.8` servings of a
`"100 g"` food). For countable foods it's `"1 egg"`, `"1 slice"`, `"1 scoop
(30 g)"`. Helpers:
- `scale(food, servings)` → `{kcal, protein, carbs, fat}`.
- `foodMap(list)` → `{id: food}` lookup.
- `mealMacros(meal, fmap?)` → summed macros for a meal's items.

### 4.3 Seed data (top of `<script>`)
- **`SEED_FOODS`** — ~44 foods (SA-friendly staples + the user's plan foods),
  authored as terse arrays then `.map`-ped into objects.
- **`SEED_MEALS`** — the full 7-day meal plan, **28 meals** labelled by day &
  slot: `[id, day('Mon'..'Sun'), slot('Breakfast'|'Lunch'|'Snack'|'Dinner'),
  name, items[]]`. Plus lookup consts `DAY_FULL`, `DAY_ORDER`, `SLOT_ORDER`,
  `SLOT_KEY`.
- **`PROGRAM`** — the 3 workout templates `A`/`B`/`C`, each `{title, ex:[[name,
  targetRepScheme], ...]}`.

### 4.4 Render functions (one per view)
- `renderToday()` — the dashboard. Sums today's `log` entries, updates the
  calorie ring (SVG `stroke-dashoffset`), the P/C/F bars, and lists entries
  grouped by meal slot. Also surfaces the day's weigh-in and workout summary.
  Respects `curDate` (the currently viewed day; `‹ ›` buttons change it).
- `renderFood()` — three segments controlled by `foodSeg`
  (`'library'|'mine'|'meals'`). Library groups foods by `group`; **meals** are
  grouped by day (Mon–Sun) with a slot badge, custom meals under "My meals".
- `renderBody()` — latest/7-day-avg/to-goal stat row, `drawWeightChart()`
  (canvas line chart with a dashed goal line), and the measurement history list.
- `renderPhotos()` — grid of photo thumbnails from stored blobs
  (`URL.createObjectURL`).
- `renderTrainStart()` + `renderWorkoutHistory()` — the Day A/B/C start buttons
  and past-session cards.

### 4.5 Modals
All modals use **`openModal(html)`** (injects a bottom-sheet into `#modalRoot`,
tap-outside closes) and **`closeModal()`**. Key ones: `logFoodModal(foodId)`,
`logMealModal(mealId)` (shows the itemised ingredient breakdown + logs the whole
meal), `addFoodModal()`, `buildMealModal()`, `addMeasureModal()`,
`addPhotoModal()` / `viewPhotoModal(id)`, `drawSession(session, lastMap)` (the
workout logger, with per-set weight×reps inputs pre-filled from the last
session of that day), and `settingsModal()`.

### 4.6 Events
There is **one delegated `document` click handler** near the bottom of the
script that dispatches on `data-*` attributes. Convention: interactive elements
carry a `data-<action>="<id>"` attribute and the handler routes them. Existing
actions include: `data-nav`, `data-quick`, `data-fseg`, `data-logfood`,
`data-logmeal`, `data-delfood`, `data-delmeal`, `data-dellog`, `data-delmeas`,
`data-photo`, `data-delphoto`, `data-startday`, `data-openwo`, plus the
by-`id` buttons (`#gearBtn`, `#addFoodBtn`, etc). **When you add a feature,
follow this pattern** rather than attaching one-off listeners in render code
(render output is innerHTML-replaced, so delegation is the safe choice).

### 4.7 Helpers & utilities
`$`/`$$` (querySelector shorthands), `esc()` (HTML-escape — **always escape
user-entered strings** in templates), `rnd()` (round), `uid()` (id generator),
`toast(msg)`. Dates are handled as local `'YYYY-MM-DD'` strings via `dstr()`,
`todayStr()`, `parseD()`, `niceDate()` — **do not use `new Date(str)` on these**
(timezone bugs); use the helpers. Backup/restore: `exportData()` (serialises all
stores; photos → base64), `importData()`, `blobToB64()`, `b64ToBlob()`.

---

## 5. Seeding & migrations (important)

`seedIfEmpty()` runs on every launch:
- Foods seed only if the `foods` store is empty.
- **Meals use a versioned seed.** The const **`MEAL_SEED_VERSION`** is compared
  to the stored `kv.mealSeedVersion`. If the stored version is lower, all
  **non-custom** meals are deleted and re-seeded from `SEED_MEALS`, **preserving
  the user's custom meals**, and the version is bumped.

**If you change `SEED_MEALS` (or want to push new built-in foods to existing
installs), bump `MEAL_SEED_VERSION`.** Otherwise already-installed users keep
their old seed and won't see your changes. (Foods don't have a version bump yet
— if you need to migrate foods, add a parallel `foodSeedVersion` following the
same pattern, being careful not to clobber `custom` foods.)

---

## 6. Service worker & cache-busting (read before you ship UI changes)

`service-worker.js` cache-first-serves the app shell listed in `ASSETS`. The
cache name is **`const CACHE = 'fittrack-vN'`**.

**Every time you change `index.html` (or any cached asset), bump the `CACHE`
version** (e.g. `fittrack-v2` → `fittrack-v3`). The version bump is what makes
installed clients fetch the new files instead of serving the stale cached copy;
`activate` deletes old caches. Forgetting this is the #1 "my change didn't show
up" bug. After deploying, the user opens the app once online and it self-updates
on next launch.

---

## 7. Styling / design system

All styling is a `<style>` block in `index.html` using **CSS custom properties**
defined in `:root`. The palette is a deep teal-green brand:
- `--brand:#1f7a63`, `--brand-d:#155a49`, `--brand-soft:#e6f2ee`
- macro accents: `--p` (protein, green), `--c` (carbs, ochre `#c0743b`),
  `--f` (fat, blue `#3a6ea5`)
- neutrals: `--bg`, `--card`, `--ink`, `--muted`, `--line`, plus `--shadow`.

Component classes to reuse: `.card`, `.btn` (`.sec`/`.ghost`/`.danger`/`.sm`),
`.seg` (segmented control), `.foodrow`, `.entry`, `.modal`/`.modal-bg`,
`.datenav`, `.kpi`, `.badge`, `.pill`, `.empty`, `.grp` (group header),
`.nav`/`.qbtn`, `.mbar` (macro bar), `.ring` (SVG progress ring). The layout is
mobile-first with a max-width container and a fixed bottom nav; it uses
`env(safe-area-inset-*)` for notch/home-bar safety.

**When enhancing UI/UX:** prefer editing the CSS variables and existing
component classes so the app stays visually coherent. Keep it accessible
(contrast, tap-target size ≥ ~40px). Everything must still work offline and on a
narrow phone screen.

---

## 8. Gotchas / conventions (learned the hard way)

- **Read DOM input values BEFORE calling `closeModal()`.** `closeModal()` wipes
  `#modalRoot`, so reading `$('#someInput').value` after it throws
  "Cannot read properties of null". Capture values into locals first, then close.
- **Escape user input** with `esc()` in any template string that interpolates a
  user-entered name/note.
- **No `localStorage`/`sessionStorage`** — the app deliberately uses IndexedDB
  only (needed for photo blobs and larger data). Keep it that way.
- **Relative asset paths** (`./index.html`, `manifest.json`, `service-worker.js`,
  `icon-*.png`) — this is what lets the app work under a subpath like
  `username.github.io/fittrack/`. Don't switch to absolute `/…` paths.
- **`curDate`** (global) is the day the Today view is showing; food logging
  respects the date picker in the modal and updates `curDate` on save.

---

## 9. Deployment

Static hosting only — no server needed.
- **GitHub Pages:** push to `main`, then Settings → Pages → deploy from `main`
  `/ (root)`. Lives at `https://<user>.github.io/fittrack/`. Works because paths
  are relative.
- **Netlify:** drag the folder to Netlify Drop, or connect the GitHub repo for
  auto-deploy on push.

After any deploy that changed cached files, remember §6 (bump `CACHE`).

---

## 10. Roadmap / good next enhancements

> **Active UI/UX work is tracked in [`UI-UX-PLAN.md`](UI-UX-PLAN.md).** Read it
> at the start of a session and update it (tick items, append to the session
> log) at the end of each session. The list below is the longer-term product
> roadmap.

Ideas discussed with the user, roughly in priority order:

1. **UI/UX polish** (the user's current focus) — refine the dashboard, meal &
   workout screens, transitions, empty states, dark mode (add a `[data-theme]`
   toggle driving the `:root` variables).
2. **Rest-day vs training-day calorie targets** — store two target sets and pick
   based on whether a workout is logged / the weekday.
3. **Reminders** — Mon/Wed/Fri workout nudges (Notifications API; needs
   permission + a periodic trigger — note offline/PWA limitations).
4. **Weekly progress summary** — a screen aggregating weight trend, average
   intake vs target, and training volume.
5. **Barcode / packaged-food lookup** — optional online food search (would add
   a runtime network dependency; keep it graceful offline).
6. **Cloud sync across devices** — the big one. Requires a backend (e.g.
   Firebase/Supabase). This breaks the "no backend" principle, so treat as an
   opt-in mode and keep the local-only path working.

When implementing any of these, respect §1 (no build step, offline-first),
§5 (bump seed version if you touch seed data), and §6 (bump the SW cache).
```
