# FitTrack v3 — product brief & screen concept

Status: **agreed direction** (2026-08-18; open questions resolved or defaulted — see §7). Build starting at stage 0. Supersedes the UI half
of `V2-SPEC.md`; the v2 *data model* sections (exercises as entities,
structured targets, per-100 g food, analytics, migration) still stand and are
referenced below rather than repeated.

Read this and tear it apart. Every heading is a decision you can overturn.

---

## 0. The one-sentence change

**v1 is a notebook for a plan Claude wrote outside the app. v3 puts the coach
inside the app.** The coach runs onboarding, writes the program and meal plan,
watches the data, and changes things when you tell it to. Everything below
follows from that.

What stays: offline-first logging, IndexedDB + the LWW sync engine, the
service worker/PWA, the exercise catalog work, vanilla JS (no bundler).
What changes: accounts, a thin backend, the screens, and who owns the plan.

---

## 1. Users & access

- **Invite-only for now.** The owner taps *Invite* → QR / link with an invite
  code. Invitee scans → **Sign up** (email + password; no Google for now) → Supabase
  Auth account tagged with the invite code. Signing in on any device restores
  everything (replaces the "Link another device" QR — that flow goes away).
- **Multi-user from day one**: every synced row carries `user_id`; row-level
  security means users only ever read/write their own rows. Sync engine keeps
  its LWW/full-pull semantics, scoped per user.
- **AI behind the server**: one Supabase Edge Function proxies Anthropic with
  tool use. Users never see or enter an API key. Usage metered per user.
- Photos move to Supabase Storage (per-user), so they sync too.

Empty local DB on launch → "Sign in" / "Sign up", never a silently seeded
blank app (V2 §9a).

Users can **share workout plans** with each other (§4a); logged data is
always private to the user who logged it.

---

## 2. Onboarding — the original prompt as a conversation

Runs once after sign-up (and can be re-run from the Coach: "redo my setup").
Mix of taps for facts and free text for the human parts. Six steps, each one
screen or one chat turn:

| # | Step | Captures | Input |
|---|---|---|---|
| 1 | You | age, sex, height, weight, body-fat (or "don't know" → track waist + photos), injuries / limitations, weekly-review day (default Sunday) | taps + number fields |
| 2 | Goal | fat loss / recomp / strength / general health & mobility; target (BF %, weight, a lift); timeframe | taps + one text line |
| 3 | Training now | days per week & which days, session length, experience, what you currently do | taps + text |
| 4 | Where you train | **home / commercial / both**. Commercial ⇒ full kit assumed. Home ⇒ structured equipment picker: barbell (kg), plates (kg × count), rack, bench (flat/adjustable), dumbbells, kettlebells, bands (light→heavy), pull-up bar, dip station, pulley (high / low / both), cardio kit | chips (the existing My-gym inventory, moved here) |
| 5 | Food | protein preference (meat / fish / veg / vegan), allergies & restrictions, dislikes, rules ("don't discard yolks"), cooking time & skill, budget, where you shop | chips + text |
| 6 | Lifestyle | sleep, daily activity / job, alcohol, stress | chips |

Then **one generation call** → Claude returns *structured* output (not prose,
not HTML):

- **Targets** — kcal + macros, training-day vs rest-day, water.
- **Program** — days → exercises **by catalog id**, sets / reps / per-side /
  rest / RPE, supersets and circuits as entities, using only their equipment.
- **Meal plan** — week of meals from per-100 g foods, honouring diet answers.
- **Rationale** — the "why", in plain language, shown to the user.

The user reads the rationale, pushes back in chat ("can't do Fridays", "less
rice"), the plan updates, they accept. **The app validates every generation**:
every exercise resolves to a catalog id, every barbell load is makeable from
their plates, every food exists per-100 g; invalid output is sent back to
Claude automatically. This is what makes "Core circuit — kg × reps" impossible.

Stored profile = `V2 §6 kv.profile`, extended with `gymType`, `restrictions`,
`lifestyle`.

---

## 3. Screens — three surfaces, no modals for primary flows

Bottom nav: **Coach · Home · Train** (Home = the daily dashboard where you log everything; renamed from v1's "Today"). Body/weight, photos and settings fold
into these (weight & photos are logged from Home, viewed from Coach's
progress section; setup lives behind a single ⚙ that you rarely open).
Modals are reserved for confirmations. Anything you *do* is a full screen.

### 3.0 Visual rules (user requirement, 2026-08-18)

- **Clean, minimalist, flat.** No drop shadows, no blurs (no `box-shadow`,
  `backdrop-filter`, glow effects), no glass surfaces. Depth comes from
  background tone and 1 px lines, not from shadows.
- **Clean lines**: consistent radii, consistent spacing scale, one accent
  colour used sparingly for the primary action, generous whitespace.
- **Mobile accessibility first**: tap targets ≥ 44 px, WCAG AA contrast in
  light and dark, visible focus states, labels tied to inputs, `aria-*` on
  custom controls, reduced-motion respected, safe-area insets, readable at
  320 px, no horizontal scroll, works one-handed (primary actions reachable
  at the bottom).
- Keep the Athletic Dark palette tokens (`--bg`, `--volt`, macro accents,
  Barlow Condensed numerals) but strip the current glass header/nav
  (`backdrop-filter`), card/button shadows and ring glow (`styles.css` today
  has 19 `box-shadow`, 3 `backdrop-filter`, 5 `--glow` uses — all go).

### 3.1 Coach — the front door
- A chat. Opens with the coach talking first: today's focus, anything it
  noticed (missed session, protein short, weight stalled, PB yesterday).
- You type or dictate anything: "swap barbell row", "I don't like oats — redo
  breakfasts", "20 minutes only today", "I ate a chicken wrap", "how's my
  squat going?", "I bought a 24 kg dumbbell pair".
- **Every write goes through a preview card** (diff of program / meal plan /
  targets / a log entry) with **Accept / Edit / Discard**. Never silent.
- **Progress** section (scroll or tab inside Coach): weight trend, adherence,
  weekly volume per muscle group vs the plan's target, PBs. The coach reads
  the same numbers, so its answers reference real data.
- Offline: chat is disabled with a clear line; everything else works.

### 3.2 Home — log with the fewest taps, straight from the dashboard
- One screen: date, **Next up** (plan meal → one tap "ate this"), kcal / macro
  bar, water, weigh-in. No explainer cards, no duplicate readouts.
- **"What did you eat or drink?" box** — the #1 friction fix. Free text ("2 eggs,
  toast with butter, flat white", "glass of red wine", "Woolies chicken wrap
  ~600 kcal") or a
  photo → Claude parses to line items with grams and macros → you tap Log or
  fix a line. Estimates are flagged as estimates and can be saved as foods.
- Recent / frequent foods and "same as yesterday" per slot; recipes ("my
  beef curry", 220 g) per V2 §5; barcode + bundled DB later.
- The plan is the default path; the description box is the exception path.
- The coach closes the loop: "40 g protein short, 500 kcal left — the plan's
  shake gets you there."

### 3.3 Train — full-screen logger + real history
- Start today's session → **full-screen view** (not a sheet), **screen wake
  lock** on (`navigator.wakeLock`), timestamp-based rest timer, draft
  auto-save (keep).
- Each exercise renders **by its metric**: kg × reps, reps per side (optional
  L/R), bodyweight(+load), time (work/rest), distance, **circuits as rounds
  of N exercises**. Header shows name · target · rest · "per side" and a ⓘ
  that opens the exercise's library page (cues, muscles, alternatives).
- **In-the-moment history**: above the sets — "last: 60 × 5,5,5,4 · best:
  65 × 5 · e1RM 76" — and a PB flash when a set beats it.
- **Exercise library**: hundreds of entries, structured (pattern, muscles,
  equipment, unilateral, metric, load type, cues, alternatives). Tap any
  exercise anywhere → history chart, best sets, e1RM, last 5 sessions.
- **Plan library** lives here: the coach's plan, plans shared with you,
  plans you built. One is *active*; switching is one tap (§4a).
- **My gym** (inventory chips) lives here. Any add/remove triggers the coach
  (§4). Program editing by hand still exists but is secondary to asking.
- History list stays; rollups (sets & tonnage per muscle group per week /
  month / year) live in Coach → Progress.

---

## 4. Equipment changes → the coach adapts

- **Remove** kit → every program exercise needing it is flagged → app proposes
  substitutes with the same pattern & primary muscles that fit remaining kit
  (deterministic catalog lookup, works offline) → coach picks + explains →
  preview → accept → program updated, history preserved.
- **Add** kit → coach suggests upgrades ("DB curls at the 10 kg ceiling → EZ
  bar curls").
- **Temporary override** — "hotel gym this week" — same engine, time-boxed.

## 4a. Workout plans are templates; following one is separate

A **plan** is its own entity — `plans: {id, owner_id, name, description,
weeks?, days:{...exercises by catalog id + structured targets},
progression?, source:'ai'|'custom'|'shared', sharedFrom?}`. What a user
*logs* (sets, weights, reps, sessions, PBs) is always their own data, keyed to
them, never to the plan.

- **Plan library** per user: the coach-generated plan, plans shared with them,
  plans they built by hand or asked the coach for ("make me a 4-day
  upper/lower"). Exactly one is **active**; switching is one tap. History
  records which plan each session belonged to.
- **Sharing**: share by username (= email address). The recipient gets a *copy* with
  a link back to the source (not a live pointer — nobody's mid-week gets
  silently rewritten). If the owner updates the source, the follower sees
  "the plan you follow was updated — apply / keep mine".
- **Import check**: on adding a shared plan the app validates it against the
  follower's *own* equipment and offers substitutions (same engine as §4).
- Example: owner and partner train together — same plan active for both, each
  with their own prefills, PBs, targets and meals. Meal plans stay per-user
  (different bodies, different kcal); sharing meal plans could reuse the same
  template model later.

## 4b. Weekly review — the coach's heartbeat

Every week (**Sunday by default**; the user picks another day in onboarding
step 1 and can change it later) the coach produces a
**Weekly review** in the Coach tab, unprompted (with an optional notification):
adherence (sessions / meals / water), weight trend vs goal pace, kcal &
protein drift, volume per muscle group vs target, PBs — and **specific changes
for next week** (progression, deload, target tweak, plan adjustment), each as a
preview card the user accepts. The existing rules-engine insights become inputs
to it. Purpose: keep the user on track for the goals in their profile.

## 4c. Profile edits change the plan

Profile is editable any time — via chat ("I've lost access to the gym") or ⚙
→ Profile. Any change that affects the plan (gym type, equipment, available
days, injury, goal, diet restrictions) triggers the same adapt-and-preview
flow as §4; cosmetic changes don't. Weight updates come from weigh-ins.

---

## 5. Architecture (what changes under the hood)

| Layer | v1 | v3 |
|---|---|---|
| Client | single `index.html`, no build | still vanilla, **native ES modules** (no bundler): `app/db.js`, `sync.js`, `coach.js`, `views/*.js`, `catalog/exercises.js`, `catalog/foods.js` |
| Auth | none / shared credentials via QR | Supabase Auth, invite codes, RLS |
| Sync | generic `records` table, LWW | same engine, `user_id` scoped; photos → Storage |
| AI | browser → Anthropic with user's key, read-only | Edge Function proxy, **tool use** with preview/confirm; server-held key; per-user metering |
| Data model | V2 §2–§5 | as V2, plus `profile`, `invites`, `plans` (templates, shareable, one active per user), `chat` (per-user coach transcript, synced), `reviews` (weekly) |
| Offline | everything | everything except coach chat & generation |

CLAUDE.md §1 ("never add a backend") is superseded by this brief once the
architecture lands; update it then.

---

## 6. Build order (each step ships, app stays usable)

| # | Step | Delivers |
|---|---|---|
| 0 | ~~Wake lock in the current logger~~ **shipped 2026-08-18** | today's gym annoyance, ~15 lines |
| 1 | ~~ES-module split + Supabase Auth + RLS + `user_id` scoping + sign-in restore~~ **shipped 2026-08-18** (invite QR itself comes with stage 5; sign-up is open until then) | foundation; sign-in replaces link-device QR |
| 2 | ~~Exercise library (structured, hundreds) + circuits + structured targets + `plans` entity / plan library (active plan)~~ **shipped 2026-08-18** (318 exercises with cues, mobility pattern, per-leg/arm labels, circuits as rounds, plan library) | the base for everything training |
| 3 | ~~Train rebuilt: full-screen logger, per-metric rows, in-set history, PBs, per-exercise history, rollups~~ **shipped 2026-08-18** (+ flat visual rules applied app-wide: shadows/blur/glow removed) | "no stats / PBs" fixed |
| 4 | Edge Function AI proxy + Coach tab (chat, previews, tools: program / meal plan / targets / log / food) | "where do I ask?" fixed |
| 5 | Onboarding conversation + generation + validation; equipment / profile-change adaptation; **plan sharing** (share, import + equipment check, update prompt) | your original prompt, in-app; invite flow complete; train together |
| 6 | Food: per-100 g model, describe-to-log, recipes; then bundled DB + barcode | food friction fixed |
| 7 | **Weekly review**; Home + Coach → Progress polish; photos to Storage; metering | coach keeps users on track; ready for more invitees |

Steps 1–3 are mostly deterministic and can be verified headless; 4–6 need
your real use to tune.

---

## 7. Open questions

1. ~~Google sign-in~~ — **decided 2026-08-18: email + password only for now.**
2. ~~Coach voice input~~ — default taken 2026-08-18: later (once chat exists).
3. ~~Owner's plan as template?~~ — default taken: every invitee gets a freshly
   generated plan; owner can share theirs afterwards (§4a).
4. ~~Body fat~~ — default taken: waist + photos, coach estimates; a number can
   still be entered if the user has one.
5. ~~Tab structure~~ — **decided 2026-08-18: Coach · Home · Train.**
6. Plan sharing — **decided 2026-08-18: share by username (= the user's
   email address).** Still open: may a recipient re-share a plan they were
   given? Default taken: no, unless the owner marks it shareable.
7. ~~Weekly review timing~~ — **decided 2026-08-18: Sunday by default, user
   can choose another day in onboarding step 1.**
