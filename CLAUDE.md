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
- **Local-first, account-backed (v3, 2026-08-18).** All user data lives in the
  browser's **IndexedDB** and every logging/training feature works fully
  offline. Users **sign in** (Supabase Auth, email + password — see
  `SETUP-SYNC.md`, `app/auth.js`) and their data syncs to their own rows in
  Supabase automatically (§4.2 — always write through `idbPut`/`idbDel` so
  records get sync stamps). Signing in on any device restores everything;
  the sign-in gate is the only screen a device with no session ever shows.
  Two further *optional* network layers degrade gracefully offline: the **AI
  Coach** (Claude via the `coach` Edge Function when signed in — server-held
  key, per-user quota; falls back to the user's own key from Settings when not
  signed in; see §4.8) and **online food search** (Open Food Facts, no key; imports
  become custom per-100 g foods that sync and work offline). Never add a
  network dependency to logging or training. The direction of travel is
  [`V3-BRIEF.md`](V3-BRIEF.md) — read it before any UI work.
- **Installable PWA.** Manifest + service worker make it installable to a phone
  home screen and usable with no connection.
- **Plain files, no bundler.** `index.html` holds the markup; the JS lives in
  `app/` as plain files served as-is (§2). The *foundation* (`config`, `db`,
  `auth`, `sync`, `main`) is native **ES modules**; the v1 *views* are still
  classic scripts sharing global scope and are being rewritten as modules stage
  by stage (V3-BRIEF §6). Nothing is transpiled or bundled — you edit and it runs.

If you're tempted to add React/Vue/a build tool: **don't**, unless the user
explicitly asks and accepts that it introduces a build step and breaks the
"drag-the-folder-to-any-host" simplicity. Prefer improving the vanilla code.
A *thin backend* (Supabase Auth/RLS/Storage + one Edge Function proxying the
AI) **is** in scope as of v3 — the "no backend" rule of v1 is superseded.

---

## 2. File structure

```
fittrack/
├── index.html          ← Markup: SVG icon sprite, all view containers, nav, sign-in gate, script tags.
├── app/
│   ├── config.js       ← (module) Supabase project URL + publishable key for this deployment.
│   ├── db.js           ← (module) IndexedDB wrapper + sync stamping (idbPut/idbDel/tombstones/wipeLocal).
│   ├── auth.js         ← (module) Supabase Auth: sign up/in/out, token refresh, session in kv, legacy migration.
│   ├── sync.js         ← (module) LWW sync engine + triggers; dispatches `ft:synced`.
│   ├── main.js         ← (module, entry) boot order, sign-in gate, restore-before-seed, sign-out/erase.
│   ├── targets.js      ← structured targets: parseTarget / targetLabel / exTargetText / normalizeTarget / circuits.
│   ├── exercises.js    ← EX_SEED_MORE — the bulk of the exercise catalog (318 total with seed.js), with cues.
│   ├── library.js      ← Exercise library view: search/filter, detail, equipment-aware alternatives, history.
│   ├── analytics.js    ← derived training analytics: exerciseHistory/Bests, e1RM (Epley), PR detection, sessionSummary, weeklyVolume.
│   ├── session.js      ← full-screen session logger (#view-session), rest timer, wake lock, exercise-history screen (#view-exhist).
│   ├── coachai.js      ← the AI Coach tab: context snapshot, tools (read auto / write → preview → accept), client-side agent loop, chat UI.
│   ├── onboard.js      ← profile (kv `profile`, synced), 6-step onboarding, Mifflin-St Jeor targets, AI plan generation (forced create_plan tool + validation).
│   ├── share.js        ← invites (codes, QR/link, sign-up pre-check) and plan sharing by email (plan_shares snapshot → import copy).
│   ├── foodai.js       ← describe-to-log on Home (forced parse_food tool → editable preview → log, estimates flagged), recipes (per-100 g cooked), foodPer100().
├── supabase/functions/coach/index.ts ← the ONLY server code: Edge Function proxy to Claude (holds the key, verifies session, daily quota).
│   ├── util.js seed.js plan.js settings.js qr.js model.js coach.js today.js
│   │   food.js body.js train.js settingsView.js events.js
│   │                   ← v1 views (classic scripts, global scope; load order = index.html order).
├── styles.css          ← The entire design system ("Athletic Dark" — see §7).
├── fonts/              ← Self-hosted Barlow Condensed woff2 (display numerals).
├── manifest.json       ← PWA manifest (name, icons, theme, display:standalone).
├── service-worker.js   ← Offline cache of the app shell. Has a CACHE version const.
├── icon-192.png        ← PWA icons (barbell glyph on green gradient).
├── icon-512.png
├── icon-maskable-512.png
├── apple-touch-icon.png
├── favicon.png
├── README.md           ← End-user deploy/install instructions.
├── SETUP-SYNC.md       ← One-time Supabase sync setup steps (user-facing).
├── supabase-schema.sql ← Schema for the sync backend (run in Supabase SQL editor).
├── UI-UX-PLAN.md       ← Session log + older UI plan (see §10).
├── V2-SPEC.md          ← v2 data-model spec (exercises as entities, per-100 g food, analytics) — still valid.
├── V3-BRIEF.md         ← **Current product brief + build order** (Coach · Home · Train, accounts, AI coach).
└── CLAUDE.md           ← This file.
```

Module ↔ legacy bridge: each foundation module also assigns its exports onto
`window` (e.g. `idbPut`, `syncNow`, `authUser`, `appSignOut`) so the classic
view scripts can call them; classic scripts expose the state modules need via
`var` (`SET`, `curView`) or plain function declarations. Classic scripts run
first (they only *define* things at load), modules run after and `main.js`
boots. Remove a bridge entry only when its last classic caller is gone.

---

## 3. Running & testing locally

**You must serve over HTTP** — opening `index.html` as a `file://` URL will
break the service worker and can break IndexedDB. From the repo root:

```bash
python3 -m http.server 8099
# then open http://localhost:8099/index.html
```

There is no automated test suite in the repo. During development the app is
verified by driving it with Playwright (headless Chromium): load the page,
click through flows, and assert on DOM text + capture `pageerror`/`console`
events. Key smoke flows: sign up / sign in at the gate, log a food, log a
meal, add a measurement, log a workout, and confirm `#calRemain` / macro bars
update with **no console errors**. Wait for `body[data-ready="1"]` before
asserting. **Test harness rules learned:** (1) create the context with
`serviceWorkers:'block'` — the SW's install fetch bypasses `page.route`, so
it would cache the real (empty) `app/config.js` and break the second load;
(2) mock Supabase by routing `**/app/config.js` to a stub `CONFIG` pointing at
a fake host and `page.route`-ing that host's `/auth/v1/*` and
`/rest/v1/records` endpoints (see the stage-1 suite in the 2026-08-18 session
log for the shape).

**Common gotcha when testing:** IndexedDB persists per-origin. A fresh
Playwright `chromium.launch()` uses a clean profile so the DB starts empty →
sign-in gate → after sign-in the app pulls the account first and seeds only
what is still missing. If you test in your normal browser, **⚙️ Settings →
Erase all data** wipes the device (no tombstones, cloud untouched) and returns
to the gate. **Never advise "Clear site data"** as a cache fix — see V2-SPEC §9a.

---

## 4. Architecture of `index.html`

### 4.1 Views & navigation
`<div class="view">` containers toggled by CSS `.hidden`: five tabs
(`#view-today`, `#view-food`, `#view-body`, `#view-photos`, `#view-train`)
driven by the fixed bottom `.nav` (`data-nav="<view>"` buttons), plus
non-nav full-screen views: `#view-plan` (📖 Plan/help via `#helpBtn`),
`#view-gym` (My gym), `#view-library` (exercise library), **`#view-session`
(the workout logger — a view, not a modal; `body.session-mode` hides the nav)**,
`#view-exhist` (per-exercise history; `exhistFrom` remembers where to go back
to, and peeking at it mid-session keeps the rest timer/wake lock alive), and
`#view-auth` (sign-in gate). `#view-coach` is the first nav tab (Coach ·
Today · Food · Weight · Train; Photos moved under Weight). **v3 rule: anything
you *do* is a full screen; modals are for confirmations only.**

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
A tiny promise wrapper around IndexedDB (`app/db.js`; db name `fittrack`,
version 4 — v2 added `water`, v3 `exercises`, v4 `plans`; migrations run in
`onupgradeneeded`, whose `contains()` guards make it safe for both fresh
installs and upgrades):

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
| `workouts` | `id` | `date` | `{id, date, dayKey:'A'|'B'|'C', title, notes, ts, exercises:[{name, target, mode:'reps'|'time', rest?, perSide?, sets:[{weight, reps, done?} \| {secs, rest, done?}]}]}` — `mode:'time'` = interval work logged as work/rest seconds per interval (e.g. skipping); the row's `rest` drives the rest timer. `perSide:true` means the logged reps are **per side** (single-leg RDL, lunges) — surfaced as "per side" in the header and `REPS / SIDE` on the column |
| `water` | `id` | `date` | `{id, date, ml, ts}` — one row per +250/+500 tap; daily total is the sum (target `WATER_TARGET_ML` = 3000) |
| `exercises` | `id` | — | the catalog: `{id, name, aliases, pattern, primary, secondary, equipment, unilateral, metric, loadType, defaultRest, region, cues, custom}` — 318 built-ins seeded unstamped (`fromSync=true`, versioned by `EXERCISE_SEED_VERSION`), user-added/edited ones sync |
| `plans` | `id` | — | **workout plans are entities** (v3 stage 2): `{id, name, description, days:{A:{title, ex:[…]}}, schedule:{Mon:'A'}, source:'seed'|'custom'|'ai'|'shared', sharedFrom?, createdAt}` — one is active (kv `activePlan`); `PROG` points at it; sessions store `planId` |

`kv` singletons:
- `{k:'settings', targets:{kcal, protein, carbs, fat}, goalWeight, startWeight}`
- `{k:'mealSeedVersion', v:<int>}` — see §5.
- `{k:'woDraft', v:<session>}` — the in-progress workout, auto-saved on every
  keystroke/tick while logging (deliberately device-local, never synced);
  cleared by "Finish session". Train tab + `startSession` offer to resume it.

**Accounts & sync (`app/auth.js`, `app/sync.js`):** users sign in with
Supabase Auth (email + password; project URL/key in `app/config.js`). The
session `{access, refresh, exp, email, uid}` lives in kv `session` (device-
local, never synced or exported; no password stored). Stores in `SYNC_STORES`
(`foods`, `meals`, `log`, `measurements`, `workouts`, `water`, `exercises`)
sync to a single generic Supabase `records` table keyed `(user_id, store, id)`
with row-level security — the client never sends `user_id`; the server default
`auth.uid()` fills it and RLS scopes every pull (last-write-wins). `idbPut` stamps `up` (ms timestamp) and `idbDel` records a
tombstone in `kv.tombstones`; pulled changes pass `fromSync=true` to bypass
stamping. **Always mutate through these helpers** or records won't sync.
**Deletes are last-write-wins too**: a pulled tombstone only applies if it is
newer than the local record, and the push payload is deduped by `(store,id)`
keeping the newest row — both essential for the seed-reseed flow (delete +
re-put of the same ids), learned the hard way on 2026-07-29 when stale
tombstones deleted seed meals across devices.
**Pull is always a FULL pull** of the `records` table (idempotent LWW apply) —
never reintroduce a "rows since lastPull" filter: `up` is *device*-stamped, so
an offline phone uploading a record late (stamped 08:00, pushed 12:00) would be
skipped forever by any high-water mark. Trivial data volume makes full pull the
right trade. Sync triggers: launch, 2 s after a local write (`syncSoon`),
`syncFlush` on tab hide/pagehide (phones freeze timers, so push before the OS
suspends us), on tab re-focus, every 5 min while visible, on `online`, and the
Settings "Sync now" button. After a pull `sync.js` dispatches `ft:synced`
(`{applied, kvApplied, exApplied}`) and `main.js` reloads the catalog/program
and repaints — the engine never touches views. Push/pull state lives in kv
`syncState` (`lastPush`, `lastSync`).
**Boot order (`main.js`) is load-bearing:** openDB → settings → `authInit`
(migrates v1 `SET.sync` creds into a session + kv `sbproject`, strips them) →
gate if no session → **if the device is empty, pull first, then seed** what
the account didn't have (`seedIfEmpty` adopts `mealSeedVersion` instead of
reseeding when meals already exist — reseeding would push tombstones over every
other device). Sign-out and Erase wipe every store via `wipeLocal()` (no
tombstones → never cascades) and reload to the gate. A dead refresh token
(`e.signedOut`) returns to the gate with a message. Photos and non-`SYNCED_KV`
`kv` are device-local. The QR encoder (`app/qr.js`) is kept for the coming
invite flow; the v1 "Link another device" flow is gone — signing in is the
link. The service worker must never intercept cross-origin requests (see the
origin check in `service-worker.js`).

**Macro model:** each food stores macros **per one serving**. `serving` is a
human label. For weight/volume foods it's `"100 g"`, `"40 g"`, `"100 ml"` etc,
so logging is a decimal multiplier (e.g. 180 g chicken = `1.8` servings of a
`"100 g"` food). For countable foods it's `"1 egg"`, `"1 slice"`, `"1 scoop
(30 g)"`. Helpers:
- `scale(food, servings)` → `{kcal, protein, carbs, fat}`.
- `servingUnit(serving)` → `{base, unit}` for weight/volume labels (`"100 g"` →
  `{base:100, unit:'g'}`), else `null`. The match is **anchored**, so
  `"1 scoop (30 g)"` stays a count. Weight foods are entered and displayed in
  their own unit — you type `180` for 180 g, and the app divides by `base` to
  get servings internally. `qtyLabel(serving, servings)` renders `"180 g"`
  rather than `"1.8 × 100 g"`. Countable foods (`"1 egg"`) are unchanged.
- `foodMap(list)` → `{id: food}` lookup.
- `mealMacros(meal, fmap?)` → summed macros for a meal's items.

### 4.3 Seed data (top of `<script>`)
- **`SEED_FOODS`** — ~44 foods (SA-friendly staples + the user's plan foods),
  authored as terse arrays then `.map`-ped into objects.
- **`SEED_MEALS`** — the full 7-day meal plan, **28 meals** labelled by day &
  slot: `[id, day('Mon'..'Sun'), slot('Breakfast'|'Lunch'|'Snack'|'Dinner'),
  name, items[]]`. Plus lookup consts `DAY_FULL`, `DAY_ORDER`, `SLOT_ORDER`,
  `SLOT_KEY`.
- **`DEFAULT_PROGRAM`** — seed for the first plan. At runtime programs are
  **plans** (store `plans`, §4.2): `loadProgram()` loads them all into `PLANS`,
  points `PROG` at the active one (kv `activePlan`), and on a device with no
  plans yet derives one from the legacy kv `program` (`plan-legacy`) or the
  default (`plan-default`) — written **unstamped** with a deterministic id so
  independently-migrating devices converge under LWW and nothing is pushed
  until the user edits (`saveProgram()` stamps the active plan). Train shows
  the active plan + a plan library (switch / new / duplicate / rename / delete).
  Each program exercise: `{name, tgt, target, mode:'reps'|'time'|'rounds',
  rest, perSide, type, items?}` — **`tgt` is the structured target**
  (`app/targets.js`: `{sets, reps:{min,max}|'amrap'}` · `{sets, secs}` ·
  `{rounds}`), `target` is the *derived* label from `targetLabel()` and carries
  the side for unilateral work (`"3 × 10 per leg"`, via `sideWord()`), `mode`
  picks the logger layout (kg × reps · work/rest seconds · **circuit rounds**
  with `items:[{name, reps|secs, perSide}]`). `normalizeTarget()` in
  `loadProgram()` parses legacy free-text targets and infers `perSide` from the
  catalog **in-memory only** — never idbPut from a migration, or a mere page
  load would out-stamp a newer synced plan (LWW). Missing `rest` falls back to
  `defaultRest(ex)` (catalog first, then heavy compounds 150/120 s → isolation
  60 s). `type` (one of `EX_TYPES`) still drives the Coach's progression advice.
  Always display targets through `exTargetText(e)`, never raw `e.target`. Equipment likewise: kv key `equipment` →
  `EQUIP` global, edited via Train → 🎒 My gym. Both kv keys sync across
  devices (`SYNCED_KV`); seeded only when absent — never overwrite user edits.

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
- `renderTrainStart()` + `renderWorkoutHistory()` — today's hero (scheduled
  day → Start / trained ✓ / rest day), draft resume, active-plan row (→ plan
  library), day buttons, `renderWeekCard()` (sessions vs plan, hard sets by
  region, tonnage, PBs; by-muscle × last-4-weeks table behind `<details>`),
  history cards with 🏆 PB badges. Session logger (`app/session.js`): every
  exercise block shows the target (with per leg/arm), rest, "Last: …" (done
  sets only) and "Best: … · e1RM …" from `exerciseBests()`, the catalog cue on
  first exposure, rows per metric (kg × reps · work/rest s · circuit rounds),
  live beat-last + **PB detection** (`setPR()` against pre-session bests →
  `.setrow.pr` + a PB line), tap-through to `renderExHist(name)` (KPIs, e1RM
  chart via `drawSimpleLine`, session list). Finish stores `session.prs`
  (`sessionPRs()`) and toasts them. A circuit round counts each item as a
  hard set in rollups (`sessionSummary`).
- `renderLibrary()` (`app/library.js`, `#view-library`) — the exercise library:
  search, pattern chips, "only what my gym can do" (`hasEquip()` maps catalog
  equipment tokens onto `EQUIP`), detail with cues/muscles/kit/history and
  `exAlternatives()` (same pattern + shared muscle, available-with-my-gym
  first) — the deterministic half of the coach's future "swap this exercise".

### 4.5 Modals
All modals use **`openModal(html)`** (injects a bottom-sheet into `#modalRoot`,
tap-outside closes) and **`closeModal()`**. Key ones: `logFoodModal(foodId)`,
`logMealModal(mealId)` (shows the itemised ingredient breakdown + logs the whole
meal), `addFoodModal()`, `buildMealModal()`, `addMeasureModal()`,
`addPhotoModal()` / `viewPhotoModal(id)`, `settingsModal()`, `editDayModal()`, `planLibraryModal()`. The workout
logger is **not** a modal any more: `drawSession(session, lastMap, drafting)`
(`app/session.js`) renders into `#view-session` and calls `go('session')`.

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

### 4.8 AI Coach (`app/coachai.js` + `supabase/functions/coach`)
The agent loop runs **in the client** because every write touches IndexedDB
and must be confirmed. Per turn: `coachContext()` (targets, weight trend, food
averages, this-week volume by muscle, recent sessions/PRs, active plan, gym,
fired coach insights) is prepended to the user text; the request carries the
frozen `COACH_SYSTEM` (with `cache_control`) and `COACH_TOOLS`. **Read tools**
(`get_exercise_history`, `search_exercises`) run immediately; **write tools**
(`update_training_day`, `swap_exercise`, `update_schedule`, `log_food`,
`log_water`, `log_weight`, `update_targets`, `update_equipment`) render a
preview card via `previewFor()` and the loop *pauses* on a promise until the
user taps Accept (→ `apply()` → `tool_result` "applied…") or Discard (→
`tool_result` "user declined…"). Tool inputs become structured targets through
`toolExToProgEx()` (catalog-resolved names, per-side inferred). Transcript
persists in kv `coachChat` (device-local). Transport (`coachRequest`): signed
in → `POST {project}/functions/v1/coach` with the session token; else own key
→ direct Anthropic call; else an explanatory error. The Edge Function pins
`claude-opus-5`, adaptive thinking, effort medium, `fallbacks:'default'`,
`max_tokens ≤ 8000`, verifies the Supabase JWT, enforces `COACH_DAILY_LIMIT`
via `ai_usage` and logs usage. Deploy steps: `SETUP-SYNC.md` §6.

### 4.9 Profile, onboarding, invites, sharing (`app/onboard.js`, `app/share.js`)
`kv.profile` (in `SYNCED_KV`) holds the onboarding answers; `PROFILE` global.
A brand-new person (no profile **and** no user-created data — seeds don't
count, see `hasUserData()` in `main.js`) is sent to `#view-onboard` after
sign-in/skip: 6 steps (you · goal · training · where you train with a
structured kit editor · food · lifestyle). `finishOnboarding()` writes EQUIP
(`fresh` onboarding starts with an EMPTY kit; owner/edit keeps the gym),
deterministic targets (`nutritionTargets()`: Mifflin-St Jeor × activity,
goal delta, 2.2 g/kg protein, 0.9 g/kg fat, +150 kcal training days, goal
weight from body-fat goal) into `SET`, then offers **Generate with the coach**
(`kind:'onboard'`, forced `create_plan` tool, `generateSystem()` lists only
exercises the gym can do; `validateGeneratedPlan()` resolves names to the
catalog, flags unknown/missing-kit exercises and out-of-range kcal; preview →
`acceptGeneratedPlan()` creates a `source:'ai'` plan and applies targets) or
**Use the default plan**. `coachSystem()` uses `profileSummary(PROFILE)`
instead of the owner's `PLAN_CONTEXT` when a profile exists. Existing devices
with data are never forced through onboarding; the Coach card and Settings
offer "Set up" / "Edit profile"; saving an edited profile offers to ask the
coach to review the plan.
**Adaptation** (`library.js`): `planAffected()` lists plan exercises the gym
can no longer do with the first available `exAlternatives()`; `renderAdaptCard`
on Train and My gym → *Apply swaps* (deterministic, keeps targets) or *Ask the
coach* (`askCoachAboutKit()` opens the Coach with a prefilled request).
**Invites**: `inviteModal()` creates codes (`invites` table via REST),
shows QR (`drawQR`) + `?invite=CODE` link; `main.js` prefills sign-up from
the URL, pre-checks via anon RPC `invite_valid`, and passes
`{invite_code}` as sign-up metadata; the DB trigger `check_invite()` enforces
it (first user exempt). **Sharing**: `sharePlanModal()` inserts a
`plan_shares` snapshot for an email; `checkPlanShares()` (after boot, not
during onboarding/session) offers unclaimed shares → import as
`source:'shared'` copy with `sharedFrom`, kit issues flagged, row PATCHed
`claimed_at`.

### 4.10 Food v3 (`app/foodai.js`)
**Describe-to-log** (the Home screen's first card): `describeToLog(text)` →
`coachRequest({kind:'food', tool_choice: parse_food})` with a system prompt
that includes the user's own custom foods/recipes (per 100 g) so their
numbers are reused → `dtlState` → `renderDtl()` editable preview (kcal/protein
per line, remove, meal select, "save as a food") → **Log it** writes `log`
rows with `estimated:true` (and, for saved lines, a custom food stored **per
100 g** when grams are known). Offline / no coach → falls back to the Food
library search with the text. **Recipes**: `recipeModal()` — weight-based
ingredients (grams) + cooked weight → a custom food `{kind:'recipe',
serving:'100 g', ingredients, cookedG}` with per-100 g cooked macros, so the
normal grams flow logs "220 g of …"; listed under the *Recipes* group with ✎.
`foodPer100(f)` derives per-100 g macros for any weight/volume food. Food
groups outside the fixed order now render too. Nav label is **Home**.

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

**Every time you change `index.html`, `styles.css` or anything under `app/`
(all listed in `ASSETS`), bump the `CACHE` version** — and add any new file to
`ASSETS` (e.g. `fittrack-v2` → `fittrack-v3`). The version bump is what makes
installed clients fetch the new files instead of serving the stale cached copy;
`activate` deletes old caches. Forgetting this is the #1 "my change didn't show
up" bug. After deploying, the user opens the app once online and it self-updates
on next launch.

---

## 7. Styling / design system

All styling lives in **`styles.css`** (hand-written, zero dependencies, no
build step). The design system is **"Athletic Dark"** (chosen by the user,
2026-07-28): dark-first graphite surfaces with a volt accent, condensed
display numerals, glass header/nav, SVG icon sprite (in `index.html`
`<defs>`), and a desktop app-frame (≥940px: sidebar nav + Today dashboard
grid via `.tgrid`/`.tcol-a`/`.tcol-b`).

- Core tokens: `--bg #0B0D0C`, `--card`, `--line`, `--ink`, `--muted`,
  **`--volt #D6F62F`** (accent; `--brand` aliases it — chart/ring read
  `--brand` via `cssVar()`), macro accents `--p` volt / `--c` amber
  `#FFB224` / `--f` cyan `#4CC3FF`, `--good`, `--danger`, `--glow`.
- Light theme via `:root[data-theme="light"]` overrides (dark is default;
  `SET.theme` defaults to `'dark'`).
- Display font: self-hosted **Barlow Condensed** (`fonts/*.woff2`,
  `--font-display`) for headings/numerals.
- **The class contract is stable**: JS templates and tests depend on class
  *names* (`.card`, `.btn`, `.foodrow`, `.insight`, `.chip`…), never on
  their looks. Restyle in `styles.css`; don't rename classes casually.

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
