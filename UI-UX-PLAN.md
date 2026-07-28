# FitTrack — UI/UX Enhancement Plan

Working plan for the UI/UX improvement effort. **Update this file at the end of
every session:** tick off completed items, add notes/decisions to the Session
log, and adjust priorities if they change.

Ground rules for all work (see CLAUDE.md for detail):

- Stay vanilla HTML/CSS/JS, single-file (`index.html`), no build step, no
  dependencies. The app must remain an offline-first installable PWA.
- Bump `CACHE` in `service-worker.js` with **every** shipped change to cached
  assets (currently `fittrack-v2`).
- Bump `MEAL_SEED_VERSION` only if seed meals change.
- New interactive elements use the delegated `data-*` click-handler pattern.
- Keep it coherent with the existing design system (`:root` CSS variables,
  `.card` / `.btn` / `.seg` etc.). No palette redesign — motion and information
  design, not a repaint.

---

## Batch 1 (agreed starting scope)

Tier 1 items + the motion pass. Ship together with a cache bump to
`fittrack-v3`.

### 1.1 Today's plan on the dashboard — [x] DONE (2026-07-28)

The seed data already keys meals by weekday (`SEED_MEALS` day field) and
workouts by Mon/Wed/Fri (A/B/C), but the Today view doesn't surface either.

- [x] "Today's plan" card on `#view-today` (`#todayPlan`, rendered at the end
      of `renderToday()`): the weekday's 4 seeded meals, each with a one-tap
      **Log** button (reuses the `data-logmeal` modal flow).
- [x] Logged slots show a ✓, dim (`.planrow.done`), and lose their Log button.
- [x] Training-day chip: "🏋️ Day A/B/C" badge on Mon/Wed/Fri ("Rest day"
      badge otherwise) + a Start row (`data-startday`) that disappears once a
      workout exists for that date.
- [x] Respects `curDate` (uses `parseD(curDate).getDay()`, not today).

No data-model changes were required.

### 1.2 Lower food-logging friction — [x] DONE (2026-07-28)

- [x] **⭐ Frequent** group at the top of Food → Library: top 6 foods by log
      count over the last 14 days (recency tiebreak), hidden while searching.
      No schema change.
- [x] "↻ Repeat yesterday's log" button on Today's empty state
      (`data-repeatday`): copies the previous day's log entries to `curDate`
      with fresh ids/ts; toasts if the previous day was empty.

### 1.3 Dark mode — [x] DONE (2026-07-28)

- [x] `:root[data-theme="dark"]` overrides. New theme-able variables were
      added for previously hardcoded colors: `--soft`, `--seg-bg`, `--seg-on`,
      `--track`, `--modal-bg`, `--toast-bg/--toast-ink`, `--nav-bg`,
      `--danger-soft`, `--input-bg`; plus `color-scheme` so native form
      controls (date pickers etc.) render dark.
- [x] Settings → Appearance seg: Auto / Light / Dark. Persisted as
      `SET.theme` inside the existing `kv` settings record (not a separate
      key). Applies instantly; Auto follows `prefers-color-scheme` live via a
      matchMedia listener.
- [x] ~~Update `<meta name="theme-color">` dynamically~~ — intentionally not
      done: the header keeps the brand gradient in both themes, so the static
      `#155a49` remains correct. Revisit only if the header ever goes neutral.
- [x] Canvas chart samples CSS vars at draw time (`cssVar()` helper);
      toast is inverted (light-on-dark theme); modal/nav/inputs themed.
- [x] Contrast checked visually via headless-browser screenshots (Today +
      Food views, both themes). On-device check on the phone still worthwhile.

### 1.4 Motion & micro-interactions — [x] DONE (2026-07-28)

- [x] View change: 180ms fade/slide-up (`.view.enter` + `viewIn` keyframes,
      retriggered in `go()` via reflow).
- [x] Calorie ring animates (CSS transition on `#calRing` stroke-dashoffset
      + stroke color).
- [x] Modal sheet slides up (`sheetUp`), backdrop fades (`fadeIn`).
- [x] Count-up on `#calRemain` (`countUp()` helper, 400ms ease-out cubic,
      previous value kept in `dataset.v`).
- [x] `prefers-reduced-motion: reduce` kills all animations/transitions
      (CSS) and skips countUp/vibrate (JS `reducedMotion()`).
- [x] `buzz()` → `navigator.vibrate(10)` on log-food/meal, measurement,
      photo, workout saves and repeat-day (feature-detected, no-ops on iOS).

### Batch 1 ship checklist

- [x] Bumped `CACHE` to `fittrack-v3` in `service-worker.js`.
- [x] Smoke tested over HTTP with headless Edge (puppeteer-core): 18 checks —
      seed, plan card, plan-meal log, food log, macro bars, weigh-in, workout
      save/history, dark toggle + persistence across reload, repeat-yesterday
      — all passing, zero console/page errors.
- [x] Dark + light verified at 390px viewport via screenshots. **Remaining
      (needs the real phone):** installed-PWA status bar / safe-area check.

---

## Shipped outside the original batches

### Plan reference + AI assistant — [x] DONE (2026-07-28)

The original coaching document (`duwayne-fitness-plan.html`, provided by the
user) is now dissected into the app as a **📖 Plan** view (header button next
to ⚙️; view id `#view-plan`, not in the bottom nav):

- 8 collapsible sections (`PLAN_SECTIONS`, native `<details>` accordions):
  strategy, numbers/macros + how they were calculated, nutrition rules +
  swap list + supplements, full A/B/C program tables (rest times, notes,
  double progression, deload), mobility/cardio, lifestyle, tracking &
  adjustment rules, evidence + disclaimer.
- **Ask box** at the top:
  - With an Anthropic API key (Settings → "AI assistant key", stored as
    `SET.aiKey` on-device only) and online: raw-fetch call to the Messages
    API (`claude-opus-5`, low effort, plan embedded in a cached system
    prompt, browser CORS opt-in header). Handles refusal stop_reason and
    API errors; renders lightly-formatted answers.
  - Without a key or offline: **local keyword search** that opens the most
    relevant plan sections — the offline-first principle holds; the AI is
    a graceful, optional online enhancement (per CLAUDE.md roadmap #5
    philosophy).
- Tested headless with a mocked API (16 checks: sections render/toggle,
  offline fallback, no request without key, request shape/model/headers/
  caching verified, answer rendering, key persistence).
- SW cache bumped to `fittrack-v4`.

## Batch 2 — feel & polish (Tier 2)

### 2.1 Workout logger upgrades — [ ] not started

- Tap-to-check "set done" state per set row.
- Highlight beating last session's weight×reps (progressive-overload cue).
- Optional rest timer starting when a set is checked.
- All inside the existing `drawSession()` modal.

### 2.2 Weight chart interactivity — [ ] not started

- Touch scrubber: tap/drag shows date + weight tooltip.
- 7-day moving-average line (the real recomp signal).
- 30 / 90 / all range toggle using the existing `.seg` control.

---

## Batch 3 — later (Tier 3)

- **Weekly summary card** on Today: avg intake vs target, weight trend,
  sessions completed (mini version of roadmap #4).
- **Photo compare view**: two photos side-by-side, same category/angle.
- **Modal ergonomics**: drag-handle + swipe-down to dismiss.
- **Empty-state CTAs**: small copy/button improvements where still bare.

---

## Explicitly rejected (don't revisit without new reasons)

- Swipeable tab gestures — conflicts with scroll and the browser/PWA
  back-swipe.
- Any charting/animation/framework dependency — breaks the no-build,
  drag-anywhere-to-host principle.
- Palette/visual redesign — the teal system stays.

---

## Session log

| Date | Session summary |
|---|---|
| 2026-07-28 | Scanned codebase, agreed enhancement plan (this document). Batch 1 scope confirmed: Today's-plan card, recent foods + repeat-yesterday, dark mode, motion pass. No code changes yet. |
| 2026-07-28 | **Plan reference + AI assistant shipped** (user request, outside original batches — see "Shipped outside the original batches"). Original coaching doc dissected into a 📖 Plan view (8 accordion sections) with an Ask box: Claude API answers when a key is set (Settings) + online, local plan search otherwise. SW cache → `fittrack-v4`. 16 mocked-API headless checks passing. Real-API call still to be verified by the user with their own key. |
| 2026-07-28 | **Batch 1 shipped.** Today's-plan card (weekday meals + Day A/B/C chip, respects date nav), ⭐ Frequent foods group, repeat-yesterday, full dark mode (Auto/Light/Dark in Settings, new CSS vars for all previously hardcoded colors, theme-aware canvas chart), motion pass (view/modal/ring animations, kcal count-up, reduced-motion support, vibrate on save). SW cache → `fittrack-v3`. Smoke tested headless (18/18 passing, no console errors). Next: Batch 2 (workout logger upgrades, weight-chart interactivity); on-device PWA status-bar check still pending. |
