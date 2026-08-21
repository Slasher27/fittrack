# FitTrack — UI/UX Enhancement Plan

> ## 📌 Current status (2026-08-21)
>
> **The v3 rebuild is COMPLETE** — all 7 stages of [`V3-BRIEF.md`](V3-BRIEF.md)
> plus meal-plan generation and voice input are shipped, tested and committed.
> The app is: accounts + per-user sync (invite-only sign-up), AI coach with 11
> preview/accept tools, onboarding → generated plans, 318-exercise library,
> full-screen logger with PBs/history/volume, describe-to-log food + recipes,
> weekly review, photo cloud sync, usage metering. Nav: Coach · Home · Train.
> SW cache `fittrack-v24`. Supabase is fully configured (schema through stage 7,
> `coach` Edge Function live with `ANTHROPIC_API_KEY` secret, photos bucket).
>
> **The user is now living with the app for a week (until ~2026-08-27) and will
> return with a feedback list — that list is the next session's agenda.** Their
> girlfriend may run the invite + onboarding flow for real; treat her
> experience as first-class feedback.
>
> Backlog, in rough order, when feedback is quiet: bundled offline food DB;
> barcode scanning; "shared plan was updated" prompt; **MuscleWiki exercise
> videos at commercialisation** (decision + open questions in the 2026-08-20
> log entry; prototype on their $10/mo dev tier via the edge-function pattern).
>
> Regression battery: **`tests/`** (13 Playwright suites, ~300 checks — see
> `tests/README.md` for setup + mocking conventions). Serve with
> `python -m http.server 8099`; bump the SW `CACHE` on every shipped change.

Working plan for the UI/UX improvement effort. **Update this file at the end of
every session:** tick off completed items, add notes/decisions to the Session
log, and adjust priorities if they change.

Ground rules for all work (see CLAUDE.md for detail):

- Stay vanilla HTML/CSS/JS, single-file (`index.html`), no build step, no
  dependencies. The app must remain an offline-first installable PWA.
- Bump `CACHE` in `service-worker.js` with **every** shipped change to cached
  assets.
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

## Batch 2 — feel & polish (Tier 2) — [x] SHIPPED (2026-07-29)

### 2.1 Workout logger upgrades — [x] DONE

- Set-number buttons tick "done" (volt) and start a 90 s rest timer
  (sticky volt bar, tap to skip, buzz+toast at zero, cleared on close).
- Rows glow volt live when weight×reps beats last session's same set.
- Prescription hints already in the "Last:" lines from Phase A.

### 2.2 Weight chart interactivity — [x] DONE

- 30/90/All range seg; raw weigh-ins as quiet dots+line; **7-day rolling
  average as the bright volt line** (the recomp signal); tap a point →
  tooltip with date + weight (auto-hides).

### Also shipped in this batch (2026-07-29, "finish the list" session)

- **Log-entry editing**: tap any logged food → servings/slot/date editor,
  macros recomputed from per-serving units, delete inside. ("If displayed,
  manageable" — food-log gap closed.)
- **Weekly summary card** on Today: avg kcal + protein vs targets, sessions
  vs scheduled, weight Δ vs last week.
- **Training-day calorie target** (roadmap #2): optional
  `SET.targets.kcalTrain` used on scheduled/logged training days, "(training
  day)" note next to the target.
- **My Gym is a page** (`#view-gym`, resumed the paused rework): summary
  KPIs (max bar load / plate total / micro plate), six chip sections incl.
  **Bars** ({name, kg} — the EZ bar has a home), auto-save on every change.
- **Photo editing**: angle/date/note editable in the photo viewer.
- **A11y**: modal focus trap (Tab cycles inside), `.xs` bumped to 12px,
  Safari `-webkit-backdrop-filter`/`appearance` fixes.
- **App icons regenerated**: volt dumbbell on Athletic Dark (all five PNGs).
- SW cache → `fittrack-v7`. New 12-check daily-loop suite + full battery
  (audit/coach/water/meas/prog/sync2) all green; prog-test made
  date-agnostic (it had hard-coded Tuesday).

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

### Phase C — notifications — [x] SHIPPED (2026-07-28)

- Settings → Notifications: Enable/Disable with permission flow and status
  (Off / On ✓ / Blocked / Not supported); iOS limitation stated in the UI.
- **On-launch Coach alert** (all platforms): one notification per day
  summarising up to 3 undismissed warn-level insights (`notifyCoach()`,
  gated by `SET.lastNotify`).
- **Android installed-PWA background nudges** (best-effort): Periodic
  Background Sync (`fittrack-daily`, 12 h min) — the SW reads IndexedDB
  directly: training-day reminder after 15:00 if no session logged; "nothing
  logged today" after 19:00. `notificationclick` focuses/opens the app.
- No push server, by design — iOS gets alerts only while the app is open.
- 7 headless checks passing (enable/disable, launch alert content,
  once-per-day gate). Background sync path is guard-wrapped; verify on a
  real Android install.

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
| 2026-08-21 (cont.) | **Coach: ＋ New chat + Past chats archive** (user asked how to avoid the "big sausage"; agreed recommendation: cheap new-chat over heavy history management — the coach regenerates its context every turn, so a fresh chat costs nothing). Header "Clear" replaced by **＋ New** (files the conversation — visible bubbles only, no API replay state — into device-local kv `coachArchive`, capped at 15, auto-titled from the first user message, then starts clean; no confirm needed since nothing is destroyed) and **Past chats** (list modal → read-only viewer via new `chatBubble(m, readOnly)` — tool cards render without Accept/Discard; delete with confirm lives in the list). `coachClear` removed. Deliberately NOT built: multiple concurrent threads (one coach relationship; v3 flat/minimal), resuming archived chats (stale context, doubles complexity). Archives are frozen, so they're safe to sync cross-device later if wanted (live chat stays device-local by design). coach-test section I (9 checks: archive on new, fresh API transcript, list, read-only view, no Accept buttons, confirmed delete, empty state) — 48/48; views suite green at 3 widths. SW → `fittrack-v24`. Uncommitted. |
| 2026-08-21 | **Bugfix: coach chat could wedge itself permanently (user hit it on the phone).** The saved transcript (kv `coachChat`) had an assistant `tool_use` message with no matching `tool_result` — `coachLoop` pushes the assistant turn into `CHAT_API` *before* running the tools, so any throw in between (tool/preview error, interruption while a preview waited) persisted the orphan, and every later request — even "Hello" — replayed it and 400'd (`tool_use ids were found without tool_result blocks`), with no way out short of Clear conversation. Fix in `coachai.js`: new `sanitizeApi()` (a) drops a trimmed/sliced head to the first plain user turn (the `slice(-CHAT_MAX_TURNS)` persist could keep tool_results whose tool_use was cut), and (b) inserts a synthetic `tool_result` ("Interrupted before this ran — NOT applied") after any orphaned `tool_use`; runs at the start of every `coachLoop` and before every persist, so existing broken devices self-heal on their next send. coach-test section H (3 new checks: seeded broken transcript → healed request shape → chat works again) — 39/39 green. SW → `fittrack-v23`. Uncommitted. |
| 2026-08-20 | **Meal-plan generation + voice input.** The original complaint — "the meal plan is not for me and I don't know where to ask to change it" — is closed: new coach tool **`update_meal_plan`** replaces whole days (Mon–Sun × slots) with preview → accept; known foods are reused by exact name at the stated grams (Chicken breast 180 g → 1.8 servings), unknown items become custom per-100 g foods, replaced meals are written `custom:true` (reseed-proof), only the slots sent are touched, Today re-renders. `coachContext()` now carries the current meal plan with per-meal macros; system prompt: stay within ~5% of kcal target, protein ≥ target, honour dislikes/restrictions/rules, reuse saved foods/recipes; "Rework my meal plan" quick prompt. **Voice input**: 🎙 on the coach chat bar and the Home food box (Web Speech API — Chrome/Android + Safari 17+; hidden elsewhere), interim results into the input, tap to stop. mealplan suite 14 checks (context, preview totals, accept semantics, food reuse/creation maths, recompute ≈ stated kcal, mic visibility); coach-test updated to 11 tools; full regression green. SW → `fittrack-v22`. Uncommitted. Remaining ideas: bundled offline food DB + barcode, "shared plan updated" prompt. **Investigated (2026-08-20, user request): YMove Exercise API** (ymove.app/exercise-api — Your Move B.V., NL): 1,021+ pro exercise demo videos (HLS, male/female models), $19–299/mo. Verdict: adopt **videos only** at commercialisation time (Pro $29/mo = 350 unique exercises/mo ≥ our 318 catalog), behind an edge-function proxy (key server-side), mapped to our catalog by name/alias, online-only (their ToS forbids caching; URLs expire 48 h). Their AI workout/meal/food features duplicate what our coach already does better per-user — skip. Demo tier (10 exercises) is enough to prototype the mapping. **Also investigated (2026-08-20): MuscleWiki API** (api.musclewiki.com): 1,900+ exercises, male/female + front/side videos, rich metadata (~1:1 with our catalog: muscles×3, equipment, compound/isolation, force, difficulty, steps), 14 languages, 15-min **media tokens** minted server-side (perfect for our edge-function pattern), metadata cacheable 30 days (mapping can be built once + synced; only playback needs to be online). Free 500-call playground; $10/mo dev tier (English, non-commercial); commercial floor GROWTH $39.99/mo 30k calls (streams count as multiple calls); PROFESSIONAL $99.99 adds routines + bodymaps. **Preferred over YMove** (better client auth, cacheable metadata, richer taxonomy, cheap prototyping); open questions before paying: are "branded" videos watermarked at every tier, and how many quota units one stream consumes. |
| 2026-08-19 (cont. 2) | **v3 stage 7 shipped — the brief's build order is complete.** **Nav collapsed to Coach · Home · Train**: Food / Weight / Photos are full-screen views reached from Home (pills under the describe box), Coach → Progress, or each other, each with ‹ back. **Weekly review**: `reviewDue()` (profile review day, default Sun; kv `lastReview`) → Coach card *Run review* → `runWeeklyReview()` sends `REVIEW_PROMPT` through the normal loop with `kind:'review'`, effort high, last-week sets-by-muscle + PRs in context; proposed changes arrive as preview/accept tool cards; review archived in kv `reviews`. Coach **Progress** card (weight + trend, sessions/sets/PBs this week, kcal avg, links). **Metering**: Settings → Account shows coach requests / tokens / ≈ $ this month from `ai_usage`. **Photos to Storage**: `photos` joins `SYNC_STORES` (record pushed without the blob), `syncPhotoBlobs()` uploads to `photos/{uid}/{id}.jpg` and marks `remote`, other devices download missing images (placeholder tile meanwhile, `ft:photo` re-render), delete removes the object; bucket + per-user policy appended to the schema. stage7 suite 22 checks (nav, review flow incl. tool accept + archive + card clears, usage line, upload/flag/re-push, second device download, delete) + all suites green. SW → `fittrack-v21`. **User to do:** re-run `supabase-schema.sql` (photos bucket). Uncommitted. Remaining ideas not in the brief: bundled offline food DB + barcode, "shared plan was updated" prompt, voice input, meal-plan generation. |
| 2026-08-19 (cont.) | **v3 stage 6 shipped — food.** `app/foodai.js`: **describe-to-log** as the first card on Home ("What did you eat or drink?") — one forced `parse_food` call (system prompt includes the user's own foods/recipes per 100 g so their numbers are reused; SA portions; meal slot guessed from time), editable preview (per-line kcal/protein inputs, remove, meal select, low-confidence "rough" badge, assumption note, "save as a food" → stored per 100 g when grams known) → **Log it** writes `estimated:true` log rows; offline/no coach → local library search with the text. **Recipes**: + Recipe in Food → weight-based ingredients + cooked weight → per-100 g cooked custom food (`kind:'recipe'`) logged by grams like any weight food, listed under *Recipes* with ✎ edit. `foodPer100()` helper; food groups outside the fixed order now render (bug: new groups were silently dropped); tab label Today → **Home**. food suite 18 checks; all suites green. SW → `fittrack-v20`. Uncommitted. Deferred from stage 6: bundled offline food DB + barcode. Next: stage 7 (weekly review; Home + Coach → Progress polish; photos to Storage; metering) and the nav collapse to Coach · Home · Train. |
| 2026-08-19 | **v3 stage 5 shipped — onboarding, generated plans, adaptation, invites, sharing.** `app/onboard.js`: kv `profile` (synced) + 6-step full-screen onboarding (you · goal · training · where you train with a structured kit editor — fresh accounts start with an EMPTY kit, not the owner's garage · food · lifestyle); deterministic targets via Mifflin-St Jeor (activity factor, goal delta, 2.2 g/kg protein, 0.9 g/kg fat, +150 kcal training days, goal weight from body-fat goal); **plan generation** = one forced `create_plan` tool call to the coach with the profile + only-available exercise names, **validated** (names → catalog, unknown / missing-kit flagged, kcal sanity) → preview (rationale, targets, days, warnings) → accept creates a `source:'ai'` plan + applies targets; "Use the default plan" fallback; "Change something" regenerates with a note. New people (no profile, no logs) land in onboarding after sign-in/skip; existing devices are never forced (Coach card + Settings offer Set up / Edit profile; saving an edit offers a coach review). `coachSystem()` uses the profile instead of the owner baseline. **Adaptation** (`library.js`): `planAffected()` + cards on Train/My gym → *Apply swaps* (first available catalog alternative, targets kept) or *Ask the coach* (prefilled). **Invites** (`share.js` + schema): `invites` table + `check_invite()` trigger on `auth.users` (invite-only sign-up, first user exempt), anon RPC `invite_valid` for a pre-check, Settings → *Invite someone* → code + QR (`drawQR`) + `?invite=CODE` link that prefills sign-up; sign-up sends `{invite_code}` metadata. **Sharing**: `plan_shares` snapshot rows by email (RLS: sender all, recipient read/claim by `auth.jwt()->>'email'`), ⇪ in the plan library, recipient offered on launch (deferred during onboarding/sessions), imports a `source:'shared'` copy with kit issues flagged. Suites: onboard 33, share 21 (owner invite → link prefill → metadata → onboarding → shared plan offer → import → deterministic swaps), coach 36, auth 49, plus all earlier — green. SW → `fittrack-v19`. **User to do:** re-run `supabase-schema.sql` (after that, sign-ups need an invite code you create in Settings). Uncommitted. Next: stage 6 (food: per-100 g model, describe-to-log, recipes; bundled DB + barcode later). |
| 2026-08-18 (cont. 4) | **v3 stage 4 shipped — the AI Coach.** Server: `supabase/functions/coach/index.ts` (Deno; the only server code) — verifies the Supabase JWT, per-user daily quota via new `ai_usage` table (schema appended), forwards one Messages request to `claude-opus-5` (adaptive thinking, effort medium, `fallbacks:'default'`, `max_tokens ≤ 8000`) with the key held as a Supabase secret; CORS handled; usage logged. Client `app/coachai.js`: **Coach tab** (first in the nav; Photos moved under Weight) — daily note (scheduled day + fired rules-engine insights, no API call), chat with flat bubbles, quick prompts, fixed input bar; `coachContext()` snapshot (targets, weight trend, food averages/today, this-week volume by muscle, recent sessions + PRs, active plan with derived targets, gym, insights) prepended to each user turn; frozen cached system prompt (reference plan as baseline); **10 tools** — reads (`get_exercise_history`, `search_exercises`) run automatically, writes (`update_training_day`, `swap_exercise`, `update_schedule`, `log_food`, `log_water`, `log_weight`, `update_targets`, `update_equipment`) render **preview cards → Accept / Discard**, the loop pauses on a promise, and the decision goes back as a `tool_result`; tool exercises resolve to the catalog with structured targets + per-side labels; transcript persisted (kv `coachChat`); transport = Edge Function when signed in, own API key direct otherwise (the old Ask path), clear message if neither. coach suite **36 checks** (payload shape incl. cached system + 10 tools + CONTEXT JSON, swap → preview → accept → plan stamped → tool_result → follow-up, discard path, auto read tool, full day replacement with structured targets, food logged as estimate, 429 surfaced, persistence across reload, own-key direct path). All suites green. SW → `fittrack-v18`. **User to do (SETUP-SYNC.md §6):** deploy the `coach` function (dashboard editor or CLI, JWT verify off), add `ANTHROPIC_API_KEY` secret, re-run the schema. Uncommitted. Next: stage 5 (onboarding conversation → generated plan; equipment/profile-change adaptation; plan sharing; invite codes). |
| 2026-08-18 (cont. 3) | **v3 stage 3 shipped — Train rebuilt.** `app/analytics.js` (derived from `workouts`, no new store): `exerciseHistory()` keyed by catalog id so renames/aliases share history, `exerciseBests()` (heaviest set, e1RM via Epley, best volume set, longest hold), `setPR()`/`sessionPRs()`, `sessionSummary()` (hard sets, tonnage, by region, by primary muscle — a circuit round counts each item), `weeklyVolume()`. `app/session.js`: **the logger is a full-screen view** (`#view-session`; nav hidden via `body.session-mode`; sticky bar ‹ Train · title · Finish; sticky rest timer; wake lock; draft auto-save; back keeps the draft) — every exercise block shows target (per leg/arm) · rest, "Last: 60×5, 60×5 · Best: 60 × 5 · e1RM 70 kg", the catalog cue the first time you meet an exercise, rows per metric, live beat-last + **PB detection** (`.setrow.pr`, "🏆 PB — heaviest ever: 65 kg × 5"), exercise name → **history screen** (`#view-exhist`: heaviest / e1RM / best-volume / sessions KPIs, e1RM-over-time canvas line, session list; back returns to the session without killing the timer). Finish stores `session.prs`, toasts "Session saved · 1 PB 🏆" + the details. **Train tab**: today's hero (Start the scheduled day / trained ✓ / rest day), resume draft, active-plan row, days, **This week** card (sessions vs plan, hard sets by region bars, tonnage, PBs; by-muscle × last-4-weeks table vs the 10–15 sets target), history cards with 🏆 badges. **Flat visual rules applied app-wide**: `--shadow`/`--glow` → none, header/nav blur removed and made solid, focus rings → outlines, modal/toast shadows gone. Explainer copy removed from Train. train3 suite 32 checks (analytics, full-screen session, wake lock req/release, draft resume, Last/Best line, PB live + stored + badge, week card, exhist, flat CSS); all other suites green (auth 49, plans 18, targets 24, library 29, views, wake). SW → `fittrack-v17`. Uncommitted. **Next: stage 4** — Edge Function AI proxy + Coach tab (chat, previews, tools). |
| 2026-08-18 (cont. 2) | **Sign-in made optional; v3 stage 2 shipped.** User: "leave authentication till last — I first want the app to work as I intend" → the gate gained *Not now — use offline on this device* (kv `localOnly`), the app boots without an account, Settings → Account offers *Sign in* (signing in later pushes everything logged offline). auth suite → 49 checks. **Stage 2a — plans as entities:** DB v4 `plans` store (synced), kv `activePlan` (synced), `PROG` = active plan record; legacy kv `program` / default seed migrate into `plan-legacy` / `plan-default` written *unstamped* with deterministic ids (converge under LWW, nothing pushed until edited); Train shows the active plan + a plan library modal (switch / new / duplicate / rename / delete); sessions carry `planId`; SW reminder reads the active plan. 18 checks. **Stage 2b — structured targets** (`app/targets.js`): `tgt` `{sets,reps:{min,max}|'amrap'}` / `{sets,secs}` / `{rounds}` is the source of truth, `target` is a derived label; `parseTarget()` migrates free text in memory; the day editor builds targets from sets/min/max/AMRAP fields; **circuits are `mode:'rounds'` with `items`** — "Core circuit" now reads "3 rounds · Each round: Plank 40 s · Dead Bug 10/side · Hanging Knee Raise 10" and logs rounds, not kg × reps. 24 checks. **Stage 2c — exercise library:** `app/exercises.js` adds 231 entries → **318 structured exercises** with one-line cues and a new `mobility` pattern (`EXERCISE_SEED_VERSION` → 2); **per-side is in the label** — `"3 × 10 per leg"` / `"per arm"` via `sideWord()` (user: "single-arm or leg exercises must specify reps per side"), the logger column reads `REPS / LEG`, the editor auto-ticks per side for unilateral catalog names; full-screen **Exercise library view** (`#view-library`, not a modal): search, pattern chips, "only what my gym can do" (`hasEquip()` maps catalog tokens onto `EQUIP`), detail with cue / muscles / kit (missing kit flagged) / your history / equipment-aware **alternatives** (`exAlternatives()`) — the deterministic half of the coach's future swap logic. 29 checks. Also: pre-existing race in the logger's debounced draft-save fixed. All suites green (auth 49, plans 18, targets 24, library 29, views 3 widths, wake). SW → `fittrack-v16`. CLAUDE.md §2/§4.2/§4.3/§4.4 updated. Uncommitted. **Next: stage 3** — Train rebuilt: full-screen logger, per-metric rows, in-set last/best/PB, per-exercise history, volume rollups. |
| 2026-08-18 (cont.) | **v3 stage 1 shipped: module split + accounts.** `index.html`'s 2,050-line `<script>` is now `app/` (13 classic view scripts cut along the section markers, unchanged; plus ES-module foundation `config.js`, `db.js`, `auth.js`, `sync.js`, `main.js` — modules bridge onto `window` for the legacy views; `SET`/`curView` became `var` so modules can read them). **Accounts:** Supabase Auth via fetch (sign up / sign in / refresh / sign out), session in kv `session` (device-local, no password stored), full-screen flat **sign-in gate** (`#view-auth`) shown whenever there is no session — the QR "Link another device" flow, `checkSyncLink`, hashchange handler and the Settings credential fields are deleted; Settings gains an Account block (email · Sync now · Sign out). **Per-user sync:** `records` keyed `(user_id, store, id)` + RLS (`supabase-schema.sql` v2 upgrades the v1 table in place, handing existing rows to the first account); client never sends `user_id`; upsert `on_conflict=user_id,store,id`; sync engine unchanged otherwise but now dispatches `ft:synced` instead of touching views; sync state in kv `syncState`. **Boot order:** openDB → settings → `authInit` (migrates v1 `SET.sync` creds → session + kv `sbproject`, strips secrets; existing devices stay signed in) → gate → **empty device pulls first, then seeds only what's missing** (`seedIfEmpty` adopts `mealSeedVersion` when meals already exist — reseeding would have pushed tombstones over every device). Sign-out / Erase = `wipeLocal()` (no tombstones) + reload to gate; dead refresh token → gate with message. Backups strip session/sbproject/syncState. Also fixed a pre-existing race: the logger's debounced draft-save fired after Finish closed the sheet (null `.value`). **Verified headless, 39/39** (not-configured gate; sign-up → seed → smoke log/measure/workout → push; restore on a fresh device with no reseed/tombstones; sign-out wipe; v1 legacy-credential migration; wrong password + expired refresh) + every view at 320/390/1280 px with no errors or horizontal scroll. Test-harness lesson: SW install fetches bypass `page.route` → use `serviceWorkers:'block'`. SW → `fittrack-v15` with all `app/*` in `ASSETS`. Docs: CLAUDE.md §1/§2/§3/§4.2/§6, SETUP-SYNC.md rewritten, README, schema. **User to do:** run `supabase-schema.sql` in the SQL editor, turn off "Confirm email" (Auth → Providers → Email), paste Project URL + publishable key into `app/config.js`. Uncommitted. Next: stage 2 (exercise library + structured targets + `plans` entity). |
| 2026-08-18 | **v3 pivot — "rip it apart".** User: the flow is "messy and complicated", the AI coach is static/read-only, the meal plan can't be changed in-app, the exercise library is thin and badly presented ("Core circuit" asks kg × reps; no per-side info), no lift history/PBs, phone locks mid-workout, everything is a modal, and QR-based device linking isn't scalable/shareable. Diagnosis: v1 is a notebook for a plan written outside the app; v3 puts the coach inside it. Screenshotted every tab headless to ground the review. **Decisions** (recorded in new `V3-BRIEF.md`, which supersedes the UI half of `V2-SPEC.md`): invite-only accounts (Supabase Auth + RLS, email+password only, sign-in = sync, QR link-device flow to be removed), AI behind an Edge Function proxy with tool use + preview/accept, onboarding = the user's original prompt as a 6-step conversation → schema-validated structured plan, equipment/profile changes adapt the plan, **plans as shareable templates** (plan library, one active, share by username=email, follower keeps own logs/meals — owner + partner train on the same plan), weekly review (Sunday default, user-selectable in onboarding), tabs → **Coach · Home · Train**, no modals for primary flows, full-screen wake-locked logger with in-set history/PBs, describe-what-you-ate food logging, per-100 g foods. Defaults taken: voice later, fresh plan per invitee, body fat via waist+photos, no re-share by default. **Stage 0 shipped:** screen wake lock while a session is open (`wakeOn`/`wakeOff`, re-acquired on visibilitychange, released in `closeModal`) — verified headless with a stubbed `navigator.wakeLock` (request on open, release on close, no errors). SW → `fittrack-v14`. Uncommitted. **Next: stage 1** — ES-module split + Supabase Auth/RLS/`user_id` scoping + sign-in restore (needs the user to run SQL in Supabase and confirm which auth user becomes their account). |
| 2026-08-03 (cont.) | **Today rebuilt · secrets bug · exercise catalog (v2 step 1a).** User on seeing the dashboard: "it's a complete mess." Diagnosed four competing calls to action (quick buttons + plan card + "Log next" + Coach) with nothing prioritised. **Today rebuilt around one question — "what do I do now?"**: a single `Next up` hero (next unlogged plan meal as primary, pending workout as a second row, remaining meals behind a disclosure, "✓ All done" when finished), the four quick buttons deleted, Coach collapsed to a one-line `<details>` summary, the triplicate kcal readout reduced to one line, empty (0-set) session cards suppressed, desktop columns rebalanced. **Secrets bug found and fixed** (user: "my API key is missing on my phone" — it was there before): every secret was rendered pre-filled into `type="password"` inputs and `stSave` wrote them back unconditionally, and `#stAI` had no `autocomplete` attribute — so a password manager blanking/stuffing the field plus any unrelated Settings save silently destroyed the stored key. Secrets are no longer pre-filled; blank now means "keep what's stored", with an explicit Remove button. Same treatment for the sync password/anon key. **v2 step 1a shipped: the exercise catalog** — 87 exercises as real entities (`pattern`, `primary`/`secondary` muscles, `equipment`, `unilateral`, `metric`, `loadType`, `defaultRest`, `region`, `aliases`), DB → **v3** with an `exercises` store, versioned seed written with `fromSync=true` so the built-ins carry no `up` stamp (only user-added/edited exercises sync), `exFind()` resolving by id/name/alias case- and punctuation-insensitively, and `perSide`/`defaultRest`/`isUnilateral` rewired to consult the catalog with the old name-regex heuristics kept only as fallback. `region` (lower/upper-push/upper-pull/core/conditioning) is the foundation for the volume dashboard. Also fixed: **`renderFood()` async re-entrancy race** — a slower earlier render could clobber a newer one (search results replaced by the unfiltered list while typing); every paint is now sequence-guarded. Added `body[data-ready="1"]` at the end of `init()` as a deterministic readiness signal for automated checks. SW → `fittrack-v13`. **64 checks green** across four suites (smoke 24 ×3 runs, migrate 11, secret 11, catalog 18) incl. a real v2→v3 upgrade test with pre-existing workout history. **Also this session: a data-loss incident** — Claude advised "Clear site data" to defeat a stale service-worker cache, which wiped the desktop IndexedDB; recovered in full via the phone's QR link (cloud copy intact — an empty local DB writes no tombstones, so it pulls rather than deletes). Root flaw captured in V2-SPEC §9a: sync credentials live in the store that gets wiped, so a cleared device can't recover itself and silently re-seeds a blank app. **Everything uncommitted at session end** — user to review the working tree. Next: structured set targets, then the volume/PB dashboard on `region`. Still blocked on the user's real food/shopping list before any food work. |
| 2026-08-03 | **v2 decision + four daily-friction fixes.** User: "the app in its current form doesn't work well for me, there are so many flaws I can't remember them." Diagnosed the common root cause — v1 *records* what you already know instead of *knowing* anything: exercises are name strings, targets are free text, foods are per-serving multipliers, the meal plan is frozen seed data, and the AI has read-only access. Asked whether Phase D fixes this: **no** — it layers an AI narrator on a foundation that doesn't fit. Decisions: v2 is **single-user, modelled so multi-user can be added later** (user's "invite users" idea deferred — needs per-user auth + an API proxy so keys aren't in the browser = a backend), and we **keep the foundation (IndexedDB layer, sync engine, SW) and rebuild the model + UI**. Spec written to `V2-SPEC.md` (exercise entities with muscle groups/pattern/unilateral, structured set targets, per-100 g foods + recipe builder + bundled offline food DB + AI estimation, profile/onboarding, volume & PB analytics, AI write-access via confirmed diffs, migration plan, 8-step build order). Shipped alongside: (1) **phantom draft fixed** — opening a day no longer writes `kv.woDraft`, so an accidental tap can't leave a nagging "unfinished session"; the draft is created by the first real input, and Train gains a ✕ to discard it; (2) **real rest periods restored** from the original plan doc (Back Squat/Deadlift 150 s, presses 120 s, isolation 60 s) into `DEFAULT_PROGRAM` + a `defaultRest()` in-memory fallback for stored programs — the logger was hardcoding 90 s for everything; (3) **`perSide`** on exercises → "per side" in the header and `REPS / SIDE` on the column, with a checkbox in the day editor and `UNILATERAL_RE` inference for existing programs (answers the user's "is it 10 per leg or 5?"); (4) **weight foods log in grams** — type `180`, not `1.8` servings; `servingUnit()`/`qtyLabel()` added, applied to the log modal, edit modal, Today entries and meal breakdowns, with countable foods ("1 egg") untouched. SW → `fittrack-v11`. Verified headless: 24-check smoke suite + 11-check migration suite (incl. the load-bearing assertion that a page load does **not** re-stamp a stored program — LWW safety), no console errors. **Next per user:** they send what they actually buy/eat so the bundled food DB is curated around real usage; then build step 1 (data model + migration + ES module split), reviewing each step. |
| 2026-07-28 | Scanned codebase, agreed enhancement plan (this document). Batch 1 scope confirmed: Today's-plan card, recent foods + repeat-yesterday, dark mode, motion pass. No code changes yet. |
| 2026-07-29 | **"Finish the list" session — Batch 2 + backlog cleared.** Workout logger (set ticks → rest timer, beat-last volt highlight), log-entry editing, weekly summary card, training-day kcal target, chart (7-day avg line / range toggle / tap tooltip), My Gym page with Bars (EZ bar home, auto-save), photo editing, focus trap + 12px xs + Safari prefixes, volt app icons. SW → `fittrack-v7`. Full battery green (loop 12, prog 17, audit, coach, water, meas, sync2). Remaining open items: Phase D (AI command box + weekly coach report — the agreed next big thing), Movemate palette fine-tune (needs user screenshot), label `for`/`id` sweep, forced-colors pass, on-device Android/iOS checks, exercise edit still remove+re-add. |
| 2026-07-29 | **First production sync bug — postmortem.** User deployed the full batch; Wednesday's seed breakfast+lunch vanished on the live site with repeated `mealMacros` crashes. Cause: stale sync **tombstones** were applied unconditionally on pull (deletes ignored last-write-wins), and tapping rows for just-deleted meals hit unguarded `idbGet→undefined`. Fixes: (1) missing-meal guards in `logMealModal`/`buildMealModal`/`mealMacros` (toast + re-render, never throw); (2) pull applies a tombstone only if newer than the local record; (3) push payload deduped by `(store,id)` newest-wins (also prevents Postgres duplicate-key upsert failure on reseed's delete+re-put); (4) `MEAL_SEED_VERSION → 3` restores the lost meals on every device on next launch. Also: `mobile-web-app-capable` meta added (deprecation warning), SW cache → `fittrack-v6`, "Meals" is now the default Food segment (user request). 7 new sync-semantics checks + sync/coach/water regressions all passing. Console noise triage: `reload.js`/WebSocket + "message channel closed" errors = user's browser extensions (Live Server companion, Gemini), not the app. |
| 2026-07-29 | **Second sync postmortem — phone workout never reached desktop.** Three causes: (1) push runs on a 4 s debounce, but phones freeze timers when the app is backgrounded → workout logged then phone locked = never pushed; (2) desktop only synced on load/own-writes → an idle tab never pulls; (3) **design bug**: pull used `up > lastPull` with *device-stamped* times, so a record uploaded late (old stamp) after the marker advanced was skipped forever. Fixes: pull is now a **full pull** (idempotent LWW apply, `lastPull` dropped), `syncFlush()` pushes immediately on `visibilitychange:hidden`/`pagehide`, `syncRefresh()` pulls on tab re-focus + every 5 min while visible, debounce 4 s → 2 s. SW → `fittrack-v8`. sync2-test extended to 10 checks incl. the late-arriving-phone-workout scenario; sync + loop suites re-run green. |
| 2026-07-29 | **"Link another device" — QR onboarding for sync.** User found per-device credential typing impractical (phone/tablet/future devices). Shipped: hand-written vanilla QR encoder (byte mode, ECC L, versions 1–10, Reed-Solomon; zero-dependency rule intact), Settings → 📱 Link another device modal (QR + copy/share link; link = `#sync=` base64url of [projectRef, key, email, pass]), boot + `hashchange` handler that strips the hash from the address bar immediately and shows a confirm dialog before saving credentials and running first sync. QR output verified by decoding the actual canvas pixels with jsQR in link-test.js (12 checks incl. v10 multi-block decode, clean-device end-to-end, garbage-link guard); sync/sync2/audit regressions green. SW → `fittrack-v9`. SETUP-SYNC.md §6 documents the flow. Caveat: the link contains the sync password — share only with yourself, delete after use. |
| 2026-07-29 | **Gym-proof workout diary.** User focus: "the workout diary and how data is added" + couldn't log skipping (8 × 40s) truthfully — the logger forced kg × reps on interval work. Shipped: (1) **timed mode** per exercise (`mode:'time'`, per-exercise `rest` s) — SECONDS rows, secs prefilled from last session/target, tick starts *that exercise's* rest (skipping = 20 s), timed progression advice, editor gains "logged as" + rest fields, seed + in-memory migration (never idbPut from loadProgram — LWW hazard); (2) **draft auto-save**: session persists to `kv.woDraft` on every keystroke/tick — tap-outside/phone-lock/tab-eviction can no longer lose a session; Train tab shows "⏵ Resume … unfinished session", Finish clears the draft; (3) **tick-to-confirm**: reps prefilled as grey placeholder from last session, tick materializes them — one tap logs a done-as-planned set; (4) timestamp-based rest timer (survives phone lock); (5) **add exercise mid-session** (swap/extra; known names bring their target/mode/rest). History/Today set counts include interval sets. diary-test.js 20 checks + loop/prog/coach/audit/sync2 regressions all green. SW → `fittrack-v10`. **Follow-up (same session):** user pointed out rest is *interval data*, not a fixed exercise property — timed rows are now `# \| WORK s \| REST s` (both prefilled from last session, both stored per set), the tick's rest timer uses **that row's** rest value, beat = more work or same work on less rest, advice suggests "go to 45 s work, or cut rest to 15 s", and the last-session hint reads "8 × 40s work / 20s rest". The exercise-level `rest` remains as the prefill default for fresh starts. diary-test → 22 checks; loop/prog/audit re-run green. |
| 2026-07-29 | **Online food search (Open Food Facts).** User: food library too limited. Chose online search (declined barcode + bigger seed for now). Typing a query in the Food tab now offers "🌐 Search online for …" — fetches OFF's free API (no key; only the search term is sent, and only on explicit tap), lists products with per-100 g macros (kJ-only products converted to kcal; entries without usable nutrition filtered out), ＋ imports the product as a `custom` food (group "Online", serving "100 g" — syncs via the normal `idbPut` stamp, survives seed migrations, offline forever after) and opens the log sheet. Failure path: toast + library restored. offsearch-test.js 10 checks + audit/sync regressions green. Third optional network integration documented in CLAUDE.md §1. Declined-for-now options logged: barcode scanning (BarcodeDetector, Android-only), ~120-food seed expansion (needs `foodSeedVersion` migration). |
| 2026-07-28 | **PIVOT — user: "I'll spend more time figuring out how to add things than benefiting."** Stopped mid-build on the My-Gym page rework (bars data model + migration landed and are harmless; page/editor rework PAUSED — do not resume without user request). Conclusion: stop growing management UI. The daily loop (log plan meal / water / weigh-in / prefilled workout + Coach) is the product; setup surfaces are once-off. Agreed direction: Phase D becomes the **front door** — a natural-language command box (Claude parses "I bought an EZ bar", "swap barbell row for X", "log a chicken wrap ~600 kcal" into confirmed app actions), so nobody has to learn UI affordances. Next step per user choice: deploy + live with it, then build the command layer. |
| 2026-07-28 | **Full gym inventory** (user: "where is the rest? / why so limited?"): My gym now manages every category — barbell weight, plates (kg × count chips, live plate-total + max-bar-load + auto-derived micro-plate), dumbbells, kettlebells, bands, stations & gear — all add/remove chips, seeded from the owner's real inventory. **New product rule adopted: "if the app displays it, the user can manage it"** — audit remaining read-only surfaces against this (known gaps: exercise edit is remove+re-add; food-log entries delete-only; photo category fixed after save). Verified: totals recompute, persistence, 15/15 prog checks. |
| 2026-07-28 | **Full visual redesign: "Athletic Dark".** User called the old look amateur/AI-slop and picked Athletic Dark from 4 proposed directions (reference: Movemate on Dribbble — palette fine-tune pending a screenshot, Dribbble blocks fetching). Styles extracted to `styles.css` (still zero-dependency vanilla CSS after evaluating Tailwind/DaisyUI/shadcn — user agreed vanilla is fine if quality matches): dark-first graphite + volt `#D6F62F`, self-hosted Barlow Condensed numerals, SVG icon sprite replacing emoji chrome, glass header/nav, glowing calorie ring, desktop app-frame (sidebar nav + two-column Today dashboard), restyled every component on the stable class contract. **My gym rebuilt** as visual chip inventory (dumbbells + kettlebells add/remove, `EQUIP.dumbbells` model + migration, per-size progression advice). Dark is default theme; dynamic meta theme-color; manifest colors updated (icon PNGs still old teal — regenerate later). All suites re-run green (audit + coach + water + meas + prog); fixed 320px water-bar overflow; time-fragile coach test made hour-aware. |
| 2026-07-28 | **Phase C shipped: notifications.** Opt-in toggle in Settings, once-daily launch alert with warn-level Coach insights, Android background nudges via Periodic Background Sync (SW reads IndexedDB: training-day + evening-log reminders), tap-to-open. iOS in-app-only, documented. 7 checks passing. Uncommitted batch grows: measurement edit + water + program/equipment + notifications, under `fittrack-v5`. Remaining from smart-coach plan: Phase D (AI weekly report + data-aware Ask + AI program revision). |
| 2026-07-28 | **Phase E shipped: editable program + equipment registry.** Program → kv data with per-day editor (rename, weekday schedule, add/remove/reorder typed exercises, add/delete days); 🎒 My gym editor; progression advice now type+equipment driven (new dumbbells/bells re-tune ceilings instantly); program & equipment sync across devices via `SYNCED_KV`. 13 checks passing. No workout/equipment change ever needs code again. Uncommitted batch: water + measurement edit + program/equipment, under `fittrack-v5`. |
| 2026-07-28 | **Phase B shipped: water tracking.** 💧 card on Today (+250/+500/undo, 3 L bar, ✓ badge), `water` store → IndexedDB v2 migration, synced/backed-up/erasable, `water-low` Coach rule (after 15:00, <1 L). 10 checks passing. Uncommitted with measurement editing — both preview on the local dev server; SW cache `fittrack-v5` covers the batch. |
| 2026-07-28 | **Measurement editing** (user request after testing a weight-only entry): ✎ on measurement cards, prefilled edit modal, same-id update so sync propagates edits. Fixed a modal focus-steal bug (60 ms focus grab could swallow first keystrokes). SW cache → `fittrack-v5` (v4 is now the deployed baseline). 7 checks passing. Uncommitted — user previewing on local dev server first. |
| 2026-07-28 | **Supabase cloud sync shipped** (user chose Supabase after SQLite/Netlify explanation). Local-first sync engine: `up` stamps + tombstones in the data layer, generic `records` table, email/password auth + refresh, debounced auto-push, pull on launch/online/manual, Settings UI, secrets stripped from backups. `supabase-schema.sql` + `SETUP-SYNC.md` added; CLAUDE.md principle updated to "local-first". **Critical SW bug fixed**: cross-origin GETs were served cache-first (broke any API GET) — now same-origin only. 11 mocked-API checks passing. User's project probed live (`ahsgvjugkmzuascvaclm.supabase.co`) — table + auth user still to be created by user, then enter creds in ⚙️ Settings. |
| 2026-07-28 | **Smart Coach Phase A shipped.** 🧠 Coach card on Today: 13-rule insights engine over local data (weight adjustment rules, calorie/protein drift, double-progression prompts, plateau watch, equipment ceilings, deload, consistency nudges, goal-reached adaptation) with dismissals + cooldowns; ↑ progression prescriptions inside the workout logger. 13 seeded-scenario checks passing. Next: Phase B (water), C (notifications), D (AI coach + evidence refresh). Architecture question raised (Svelte/shadcn/SQLite) — decision: stay vanilla; revisit only if cloud sync (roadmap #6) or file size becomes unmanageable. |
| 2026-07-28 | **Meal editing + mobile/a11y audit.** ✎ edit for all meals (plan meals convert to custom copies in-slot), hover/cursor/chevron affordance on clickable rows, fixed latent delete-✕-opens-modal bug. Full audit applied: pinch-zoom re-enabled, dialog semantics + Escape + focus + scroll-lock on modals, keyboard-activatable rows, aria labels/landmarks/alt text/live toasts, contrast + tap-target bumps. 27 automated checks passing at 320px & 390px. Backlog captured under "Mobile responsiveness & accessibility audit". Still within the pending `fittrack-v4` bump. |
| 2026-07-28 | **Desktop modal polish** (user-reported on the deployed Netlify site): thin themed scrollbar on `.modal` (light+dark, rounded thumb, track inset from the rounded corners), desktop modals narrowed to 520px max-width / 86vh, number-input spinners hidden. Also security fix: backup export strips `aiKey`; restore preserves the on-device key. Covered by the pending `fittrack-v4` bump. |
| 2026-07-28 | **Plan reference + AI assistant shipped** (user request, outside original batches — see "Shipped outside the original batches"). Original coaching doc dissected into a 📖 Plan view (8 accordion sections) with an Ask box: Claude API answers when a key is set (Settings) + online, local plan search otherwise. SW cache → `fittrack-v4`. 16 mocked-API headless checks passing. Real-API call still to be verified by the user with their own key. |
| 2026-07-28 | **Batch 1 shipped.** Today's-plan card (weekday meals + Day A/B/C chip, respects date nav), ⭐ Frequent foods group, repeat-yesterday, full dark mode (Auto/Light/Dark in Settings, new CSS vars for all previously hardcoded colors, theme-aware canvas chart), motion pass (view/modal/ring animations, kcal count-up, reduced-motion support, vibrate on save). SW cache → `fittrack-v3`. Smoke tested headless (18/18 passing, no console errors). Next: Batch 2 (workout logger upgrades, weight-chart interactivity); on-device PWA status-bar check still pending. |
