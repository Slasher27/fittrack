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

### Mobile responsiveness & accessibility audit — [x] DONE (2026-07-28)

Requested by the user ("professional app-like feel, correct mobile
responsiveness, correct accessibility for mobile"). Verified by an automated
27-check audit (headless Edge at 320px and 390px): zero horizontal overflow on
every view at both widths, all buttons named, no small tap targets, keyboard
flows working, no console errors.

**Fixed in this audit:**

- **Pinch-zoom unblocked** — removed `maximum-scale=1.0, user-scalable=no`
  from the viewport meta (WCAG 1.4.4 failure; inputs are already 16px so iOS
  won't auto-zoom on focus).
- **Modals are real dialogs** — `role="dialog"`, `aria-modal`, focus moves
  into the sheet on open, **Escape closes**, backdrop click still closes,
  and the background page scroll is locked while a sheet is open.
- **Keyboard access for clickable rows** — food/meal rows, photo cells, and
  workout-history cards get `role="button"` + `tabindex="0"`, activated by
  Enter/Space via a global handler; `:focus-visible` outline added.
- **Screen-reader labels** — aria-labels on every icon-only control (date
  ‹ ›, all delete/close ✕s, set weight/reps inputs); photos get alt text;
  the weight chart canvas gets `role="img"` + label; the nav is a labelled
  `navigation` landmark with `aria-current="page"`; toasts announce via
  `role="status"` / `aria-live="polite"`.
- **Contrast** — light-mode `--muted` darkened `#69766f` → `#5c6b64`
  (≥4.5:1 on bg/card for the small secondary text it's used on).
- **Tap targets** — `.pillbtn` grown to ≥30px height; audit confirms no
  visible interactive element under 28px.
- **Discoverability** — pointer cursor + hover highlight + `›` chevron on all
  clickable rows (the user reported rows gave no indication of being tappable).
- **Meal editing** (same session): ✎ on every meal row and inside the meal
  modal. Custom meals edit in place; plan meals convert to a custom copy in
  the same day/slot (survives `MEAL_SEED_VERSION` reseeds by design).
- **Bug fix** — delete ✕ on custom foods/meals used to open the log modal
  instead of deleting (row-level `data-logfood`/`data-logmeal` matched before
  the inner button in the delegated handler). Handler order now checks inner
  buttons first.

**Backlog (found, not yet fixed — future sessions):**

- [ ] Associate `label.fl` with inputs (`for`/`id`) across modals — labels
      are currently proximity-only for screen readers.
- [ ] Full focus **trap** in modals (Tab can still reach background content;
      Escape/backdrop already work).
- [ ] `.xs` text (11.5px) is small for mobile; consider a global bump to
      ~12.5px minimum.
- [ ] `forced-colors` / high-contrast-mode pass.
- [ ] On-device iOS/Android standalone check (safe areas, status bar) —
      still outstanding from Batch 1.

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

## Smart coach plan — insights, nudges & adaptation (agreed 2026-07-28, not started)

Goal: the app should notice things and guide, not just record — e.g. "your
dumbbell curls are at the 10 kg ceiling, switch to bar/bands", "you're
averaging +180 kcal over target this week", "no water logged today",
"weight stalled 2 weeks → apply the plan's adjustment rule".

**Architecture principle:** a *local, deterministic rules engine* is the
brain (works fully offline, free, private — all the data already lives in
IndexedDB). The AI is an optional narrator/advisor layered on top via the
existing API-key infrastructure. True push notifications need a backend, so
notification scope is limited to what a PWA can honestly do (see Phase C).

### Phase A — insights engine + feed — [x] SHIPPED (2026-07-28)

Implemented as designed, plus the user's additions (goal-triggered
adaptation, in-workout prescriptions, plateau handling):

- `computeStats()` aggregates all stores; `INSIGHT_RULES` (13 rules) +
  `renderCoach()` render a dismissible 🧠 Coach card at the top of Today
  (severity-sorted, per-rule cooldowns, dismissals in `kv`).
- **Personal-trainer moments:** progression prescriptions also appear
  *inside the workout logger* next to each exercise's "Last:" line
  (`progressionAdvice()` — double progression automated, with equipment-
  aware advice from the new `EQUIPMENT` const: DB 10 kg ceiling → bar/bands,
  KB ladder 12→16→20→24→32, micro-plate suggestions on plateaus).
- **Goal-reached adaptation:** at goal weight the Coach prescribes the
  plan's reverse-diet + strength-focus shift.
- Verified by 13 seeded-scenario headless checks (stall, kcal/protein
  drift, plateau vs progression, DB ceiling, dismissal persistence,
  in-modal ↑ hints). Covered by pending `fittrack-v4` bump.
- **"Self-learning" note:** true self-learning isn't possible in a static
  offline app; the honest equivalents are (a) this rules engine encoding
  the plan's evidence base, and (b) Phase D's AI layer, which can bring
  current science via the API. A future "evidence refresh" prompt (ask
  Claude to critique the program against the user's logged results) is the
  practical form of "informing of better methods" — added to Phase D scope.

Original Phase A design (for reference):

- `computeStats()`: one aggregator over existing stores → rolling 7/14-day
  kcal & protein averages, weekly weight averages & trend, days since last
  weigh-in/photo/workout, per-exercise history (weight × reps per session),
  current training week number.
- `INSIGHT_RULES`: array of pure rules `{id, check(stats), message, severity,
  cooldownDays}`. Initial catalog:
  - **Adjustment rule** (plan §7 automated): stalled 2–3 wks → suggest
    −150 kcal *or* +1,500 steps; losing >0.7 kg/wk → +150 kcal back;
    on-pace → affirmation.
  - **Calorie drift**: 7-day avg >~10% over/under target.
  - **Protein shortfall**: multiple days materially under 180 g.
  - **Double progression prompt**: all sets at top of rep range last session
    → "add +2.5–5 kg (lower) / +1.25–2.5 kg (upper) next time".
  - **Plateau**: same weight ≥3 sessions on a main lift.
  - **Equipment ceiling** (uses new `EQUIPMENT` const from the owner's
    inventory): e.g. DB work capped at 10 kg → suggest band/barbell swap;
    pulley is high-to-low only.
  - **Deload**: every 6th training week.
  - **Consistency**: missed Mon/Wed/Fri session, no weigh-in ≥4 days,
    no progress photo ≥16 days.
- **Insights card on Today** (top, below plan card): severity-tinted rows,
  dismissible; dismissals stored in `kv` with per-rule cooldowns so nothing
  nags. Highlight count on the 🏠 tab badge (optional).

### Phase B — water tracking — [x] SHIPPED (2026-07-28)

- 💧 card on Today: +250/+500 quick-add, ↺ undo, progress bar vs 3 L target
  (`WATER_TARGET_ML`), ✓ badge on target, per-day via the date nav.
- `water` store added → **IndexedDB v2** (first migration; `contains()`
  guards keep it safe for existing v1 installs). Covered by sync
  (`SYNC_STORES`), backup/restore, and erase-all.
- Coach rule `water-low`: under 1 L after 15:00 → nudge (24 h cooldown).
- 10 headless checks passing (accumulate/undo/per-day/migration/sync
  stamps/target badge/rule gating/persistence).

### Phase C — notifications (honest PWA limits)

- Settings toggle → Notifications API permission.
- On-launch local notifications for high-severity insights (works everywhere
  once the app is opened).
- Android/Chrome installed-PWA extras (best-effort): Periodic Background
  Sync to surface reminders (Mon/Wed/Fri workout nudge, evening log
  reminder) without the app open. **iOS cannot do background notifications
  without a push server** — document in-app; a push backend stays an
  explicit opt-in future decision (roadmap #6 territory).

### Phase D — AI coach (optional layer, existing key infra)

- **Weekly coach report**: one tap (or auto on Sundays) sends the computed
  stats + fired insights to Claude → personalized narrative: what worked,
  what to adapt, next week's focus. Cached locally; graceful offline.
- **Data-aware Ask box** (opt-in toggle): include a compact recent-stats
  summary with plan questions so answers reference *actual* progress, not
  just the plan. Clearly labelled since it sends logged data to the API.

### Phase E — data-driven program & equipment — [x] SHIPPED (2026-07-28)

Implemented as designed (13 headless checks passing): program lives in kv
(`PROG`, seeded once from `DEFAULT_PROGRAM`), per-day editor (title, weekday
schedule checkboxes, add/remove/reorder exercises with equipment `type`,
add/delete days), 🎒 My gym equipment editor (`EQUIP`), typed
`progressionAdvice()` re-tunes live on equipment changes, and both kv keys
sync across devices (`SYNCED_KV`). Remaining from this phase's scope: AI
program revision → folded into Phase D. Original design below:

User need: change/dislike a workout, or buy new equipment, **without code
changes**. Same seed-vs-custom pattern already proven with meals.

- **Program becomes data**: move `PROGRAM` into the `kv` store with a
  versioned seed (`programSeedVersion`, mirrors `MEAL_SEED_VERSION`).
  Program editor in the Train tab: rename days, add/remove/reorder
  exercises, edit target rep schemes, add extra days, change which weekdays
  map to which day. `startSession`/`renderTrainStart`/Today's training chip
  read stored program. History (`workouts` store) untouched — prefill still
  matches by exercise name.
- **Exercise typing for Coach smarts**: each exercise gets an equipment
  `type` (barbell-lower / barbell-upper / dumbbell / kettlebell /
  bodyweight+belt / band / time) — seeded for the stock program, pickable
  for custom exercises — so `progressionAdvice()` keeps prescribing correct
  increments for exercises the user invents.
- **Equipment registry**: `EQUIPMENT` const → editable "My gym" record
  (dumbbell max, kettlebell sizes, plate inventory, micro-plates, bands,
  pulley capability). Editing it immediately re-tunes ceiling/progression
  advice — buy 12.5 kg dumbbells, log them, DB ceiling warnings move.
- **AI program revision (extends Phase D)**: "I don't like Day B" → Claude
  gets goals + equipment registry + training history, returns a revised
  program as structured JSON the app previews and applies on confirmation.
  The app updates itself; no code changes.

Order: A ✅ → E and B next (either order) → C → D. A alone delivers most of
the perceived intelligence. Ship rules: SW cache bump per deploy; DB version
bump in Phase B only. Phase E is backend-independent (works in vanilla,
unaffected by the Path A/B sync decision).

## Cloud sync backend — decision in progress (2026-07-28)

User wants multi-device data (the real limitation behind "it only works
offline"). **Supabase was proposed and rejected — the user wants SQLite
specifically.** Key fact: SQLite cannot live on Netlify (static hosting +
ephemeral functions; no persistent writable disk). SQLite-honouring options
presented:

1. **Own shared hosting (cPanel/PHP) + SQLite file** — a tiny PHP REST API
   in front of an SQLite file on hosting the user already pays for. True
   SQLite, full ownership, no new vendor. Needs HTTPS + a bearer token.
2. **Turso (libSQL)** — hosted SQLite-compatible DB with HTTP API; managed,
   free tier, but a third-party account (may fail the same test as Supabase).
3. **Cloudflare D1** — SQLite at the edge, but requires moving off Netlify.

**RESOLVED: user chose Supabase after the SQLite/Netlify explanation.
Sync layer SHIPPED 2026-07-28** (mock-verified, 11 checks): sync-aware
`idbPut`/`idbDel` (`up` stamps + tombstones), generic `records` table
(`supabase-schema.sql`), email/password auth with token refresh, debounced
auto-push (4 s) + pull on launch/online/manual, last-write-wins, Settings UI,
credentials stripped from backups, `SETUP-SYNC.md` guide. Photos + `kv`
device-local in v1. **Bug fixed en route:** service worker was intercepting
cross-origin GETs cache-first (would have corrupted any API call) — now
same-origin only. **User still to do:** run `supabase-schema.sql` in the SQL
editor, create the auth user, enter credentials in ⚙️ Settings (probe on
2026-07-28 confirmed project live, table not yet created).

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
| 2026-07-28 | **Phase E shipped: editable program + equipment registry.** Program → kv data with per-day editor (rename, weekday schedule, add/remove/reorder typed exercises, add/delete days); 🎒 My gym editor; progression advice now type+equipment driven (new dumbbells/bells re-tune ceilings instantly); program & equipment sync across devices via `SYNCED_KV`. 13 checks passing. No workout/equipment change ever needs code again. Uncommitted batch: water + measurement edit + program/equipment, under `fittrack-v5`. |
| 2026-07-28 | **Phase B shipped: water tracking.** 💧 card on Today (+250/+500/undo, 3 L bar, ✓ badge), `water` store → IndexedDB v2 migration, synced/backed-up/erasable, `water-low` Coach rule (after 15:00, <1 L). 10 checks passing. Uncommitted with measurement editing — both preview on the local dev server; SW cache `fittrack-v5` covers the batch. |
| 2026-07-28 | **Measurement editing** (user request after testing a weight-only entry): ✎ on measurement cards, prefilled edit modal, same-id update so sync propagates edits. Fixed a modal focus-steal bug (60 ms focus grab could swallow first keystrokes). SW cache → `fittrack-v5` (v4 is now the deployed baseline). 7 checks passing. Uncommitted — user previewing on local dev server first. |
| 2026-07-28 | **Supabase cloud sync shipped** (user chose Supabase after SQLite/Netlify explanation). Local-first sync engine: `up` stamps + tombstones in the data layer, generic `records` table, email/password auth + refresh, debounced auto-push, pull on launch/online/manual, Settings UI, secrets stripped from backups. `supabase-schema.sql` + `SETUP-SYNC.md` added; CLAUDE.md principle updated to "local-first". **Critical SW bug fixed**: cross-origin GETs were served cache-first (broke any API GET) — now same-origin only. 11 mocked-API checks passing. User's project probed live (`ahsgvjugkmzuascvaclm.supabase.co`) — table + auth user still to be created by user, then enter creds in ⚙️ Settings. |
| 2026-07-28 | **Smart Coach Phase A shipped.** 🧠 Coach card on Today: 13-rule insights engine over local data (weight adjustment rules, calorie/protein drift, double-progression prompts, plateau watch, equipment ceilings, deload, consistency nudges, goal-reached adaptation) with dismissals + cooldowns; ↑ progression prescriptions inside the workout logger. 13 seeded-scenario checks passing. Next: Phase B (water), C (notifications), D (AI coach + evidence refresh). Architecture question raised (Svelte/shadcn/SQLite) — decision: stay vanilla; revisit only if cloud sync (roadmap #6) or file size becomes unmanageable. |
| 2026-07-28 | **Meal editing + mobile/a11y audit.** ✎ edit for all meals (plan meals convert to custom copies in-slot), hover/cursor/chevron affordance on clickable rows, fixed latent delete-✕-opens-modal bug. Full audit applied: pinch-zoom re-enabled, dialog semantics + Escape + focus + scroll-lock on modals, keyboard-activatable rows, aria labels/landmarks/alt text/live toasts, contrast + tap-target bumps. 27 automated checks passing at 320px & 390px. Backlog captured under "Mobile responsiveness & accessibility audit". Still within the pending `fittrack-v4` bump. |
| 2026-07-28 | **Desktop modal polish** (user-reported on the deployed Netlify site): thin themed scrollbar on `.modal` (light+dark, rounded thumb, track inset from the rounded corners), desktop modals narrowed to 520px max-width / 86vh, number-input spinners hidden. Also security fix: backup export strips `aiKey`; restore preserves the on-device key. Covered by the pending `fittrack-v4` bump. |
| 2026-07-28 | **Plan reference + AI assistant shipped** (user request, outside original batches — see "Shipped outside the original batches"). Original coaching doc dissected into a 📖 Plan view (8 accordion sections) with an Ask box: Claude API answers when a key is set (Settings) + online, local plan search otherwise. SW cache → `fittrack-v4`. 16 mocked-API headless checks passing. Real-API call still to be verified by the user with their own key. |
| 2026-07-28 | **Batch 1 shipped.** Today's-plan card (weekday meals + Day A/B/C chip, respects date nav), ⭐ Frequent foods group, repeat-yesterday, full dark mode (Auto/Light/Dark in Settings, new CSS vars for all previously hardcoded colors, theme-aware canvas chart), motion pass (view/modal/ring animations, kcal count-up, reduced-motion support, vibrate on save). SW cache → `fittrack-v3`. Smoke tested headless (18/18 passing, no console errors). Next: Batch 2 (workout logger upgrades, weight-chart interactivity); on-device PWA status-bar check still pending. |
