# FitTrack v2 — data model & build spec

Status: **draft for review** (2026-08-03). Nothing built yet.
Read this and tell me where it doesn't match how you actually train and eat.

Decisions already made:
- **Audience:** single user (you), modelled so multi-user can be added later
  without a rewrite. Not building accounts/signup now.
- **Strategy:** keep the foundation (IndexedDB layer, sync engine, service
  worker), rebuild the data model and the UI. Your logged data migrates.

---

## 1. Why v2 exists

Every complaint traces to one thing: **v1 records what you already know; it
doesn't know anything itself.**

| Symptom | Root cause |
|---|---|
| "Is that 10 reps per leg or 5?" | `target` is a free-text string. The app has no concept of a unilateral exercise. |
| Rest times are wrong / missing | The plan's per-exercise rest (2–3 min, 90 s, 75 s) was dropped; the logger hardcodes 90 s. |
| "I have crumbed calamari / a stew / a curry" | 44-food library, no dish composition, no estimation path. |
| "180 g chicken = 1.8 servings" | Macros stored per-serving; logging is a decimal multiplier. |
| "I can't tell it I don't like oats" | Meal plan is frozen seed data. AI has read access to a document, zero write access to data. |
| Phantom "unfinished session" | Opening a session writes a draft immediately and closing doesn't clear it. Plain bug. |

**v2 principle: the app holds the knowledge — the exercise catalog, the food
database, the structure of your program — and asks you only for what it
genuinely cannot know.**

Unchanged from v1: no build step, offline-first, IndexedDB, static hosting,
optional network layers only.

**One amendment proposed:** split `index.html` into native ES modules. Still
no bundler, no transpile, still drag-the-folder-to-any-host — but 2,000 dense
lines won't hold an exercise catalog, a food database and analytics.

---

## 2. Exercises become entities

The keystone change. Everything else depends on it.

```js
// store: exercises  (seeded catalog + user-created)
{
  id, name, aliases: [],              // aliases let old logs match on migration
  pattern: 'squat' | 'hinge' | 'lunge' | 'horizontal-push' | 'vertical-push'
         | 'horizontal-pull' | 'vertical-pull' | 'carry' | 'core'
         | 'isolation' | 'conditioning',
  primary:   ['quads','glutes'],      // fixed muscle vocabulary
  secondary: ['hamstrings','core'],
  equipment: ['barbell','rack'],      // refs the equipment catalog
  unilateral: true,                   // → reps are PER SIDE, volume ×2
  loadType: 'external'|'bodyweight'|'bodyweight+'|'band'|'none',
  metric:   'reps'|'time'|'distance'|'rounds',
  defaultRest: 90,
  cues: '', custom: false
}
```

Muscle vocabulary (fixed, so rollups are reliable): chest, lats, upper-back,
front-delts, side-delts, rear-delts, biceps, triceps, forearms, quads,
hamstrings, glutes, calves, core, full-body.

Region rollup for the dashboard: **lower / upper-push / upper-pull / core /
conditioning**. This is what makes "40 sets of lower body last month → 10
squats, 10 lunges, 10 RDLs…" possible.

Seeded catalog: barbell, dumbbell, kettlebell, machine/cable, bodyweight,
calisthenics, band, and conditioning movements — target ~300 to start, growing.
Your program's exercises map into it on migration.

## 3. Targets become structured

`'3 × 10–12'` is a label, not data. Replace with:

```js
{ sets: 3, reps: {min: 10, max: 12}, perSide: true, rest: 75,
  intensity: {type: 'rpe', value: 8}, tempo: null, note: 'Glutes & posterior chain' }

{ sets: 8, work: 40, rest: 20 }                      // timed intervals (skipping)
{ sets: 3, reps: 'amrap' }                           // chin-ups
{ rounds: 3, items: [...], rest: 45 }                // core circuit
supersetId: 'sB6'                                    // lateral raise + face pull render together
```

The display string is **derived**: `3 × 10–12 per leg · rest 75 s · RPE 8`.
That permanently answers "per leg or total?" — and it round-trips your original
plan document faithfully instead of flattening it.

## 4. Set logging

```js
{ exerciseId, weight, reps, secs, rest, rpe?, side: 'both'|'l'|'r', done, ts }
```

Unilateral exercises: reps entered are **per side**, volume maths doubles them.
Optional L/R split for tracking imbalances — off by default, not another field
to fill in every set.

## 5. Food: per-100 g, always

```js
// store: foods
{ id, name, brand?, source: 'seed'|'off'|'usda'|'custom'|'ai', barcode?,
  per100: {kcal, protein, carbs, fat, fibre?},
  portions: [{label: '1 medium', g: 120}, {label: '1 cup cooked', g: 158}],
  estimated: false,      // AI-guessed macros are flagged, never silently trusted
  custom: false }
```

**Everything is per 100 g internally. Portions are named gram amounts.** You
type `180` for 180 g of chicken, or tap "1 medium banana". No more `1.8`.

```js
// store: recipes — the answer to "what if I have a stew or a curry?"
{ id, name, ingredients: [{foodId, g}], totalCookedG, // weighed after cooking
  per100: {…},          // computed
  custom: true }
```

Cook the curry once, enter the ingredients and the finished pot weight, and
from then on you log "220 g of my beef curry" in two taps. Cooked weight is
asked for separately because water loss is exactly what makes eyeballing wrong.

**Four layers cover everything you eat:**

1. **Bundled offline database** — ~1,000–2,000 generic foods (raw + cooked
   staples, SA-relevant) shipped as static JSON. No API, no key, works offline.
   Kills "the library is too limited" permanently.
2. **Recipe builder** — home-cooked dishes, as above.
3. **Barcode + online lookup** — Open Food Facts (already wired in) for
   packaged goods. Barcode scanning where the browser supports it (Android
   Chrome yes, iOS Safari no → degrades to manual search).
4. **AI estimation** — "supermarket crumbed calamari, about a cup" → estimated
   macros, clearly flagged as an estimate, saveable as a food. Nothing else
   handles deli counters and restaurant meals, and a logged estimate beats
   perfect data you skipped.

Meal plans become **editable templates** (named sets of food/recipe portions)
rather than frozen seed data — so the AI can rewrite them.

## 6. Profile & onboarding

```js
kv.profile = {
  sex, age, height, units: 'metric',
  gymType: 'home' | 'commercial' | 'both',
  equipment: {…},                  // from the equipment catalog; commercial = assume full
  track: {workouts, food, water, photos, measurements},   // drives which tabs exist
  diet: {dislikes: ['oats'], avoid: [], noWaste: true, notes: ''},
  goals: {
    type: 'recomp'|'fatloss'|'strength'|'physique',
    startWeight, currentBf, goalWeight, goalBf, targetDate,
    strength: [{exerciseId, target: '2× bodyweight squat'}]
  }
}
```

Asked once in a first-run wizard instead of scattered across Settings. `track`
flags mean a food-only or workout-only user never sees tabs they don't want.
`diet` is what the AI reads when you say "rework this, I don't like oats."

## 7. Training analytics (your #8)

Derived from the logs — no separate store, so it's always consistent.

- **Per session:** tonnage (kg × reps), total sets, sets per region.
- **Per week / month / year:** sets per muscle group, tonnage, session count,
  reps at load (e.g. "100 reps @ 24 kg kettlebell"), all timestamped.
- **Drill-down:** region → exercise → full history chart. "40 sets lower body"
  opens to the per-exercise breakdown.
- **Personal bests:** auto-detected on save, per exercise — best weight×reps,
  best estimated 1RM (Epley), best set volume, longest hold/interval. Surfaced
  in the session and on the dashboard when you hit one.
- **Volume vs. the plan's 10–15 hard sets per muscle per week** — so you can
  see when you're under- or over-shooting the target the plan actually sets.

This is also what makes the AI coach worth having: it can analyse real volume,
frequency and progression data instead of narrating a summary you already read.

## 8. AI gets write access

The reason you can't renegotiate your plan today is that the AI can only read.
v2 gives it a fixed set of tools, and **every one produces a preview you
confirm** — it never writes silently:

`proposeProgramChange` · `proposeMealPlanChange` · `createFood` ·
`estimateFood` · `createRecipe` · `logEntry` · `adjustTargets`

So "I don't like oats and I won't throw away egg yolks — rework my breakfasts
to still hit 180 g protein" produces a diff of your meal templates that you
accept or reject. Same for "my goal changed to a double-bodyweight squat."

Offline: the app works fully; only these AI actions are unavailable.

## 9. Migration — nothing is lost

- **Workouts:** exercise names matched to catalog IDs via the alias table;
  anything unmatched becomes a custom exercise. All history preserved.
- **Foods:** per-serving → per-100 g, using the serving label (`"100 g"` maps
  directly; `"1 egg"` becomes a named portion with an estimated gram weight).
- **Log, measurements, photos, water:** carried over as-is.
- **Sync:** `up` stamps and tombstone semantics preserved exactly. The LWW
  rules and full-pull behaviour are load-bearing — see CLAUDE.md §4.2.

---

## 10. Build order

| # | Step | Fixes |
|---|---|---|
| 0 | **Quick fixes now** — phantom draft, real rest times, per-side notation, log in grams | Today's daily annoyances |
| 1 | Data model + migration + ES module split | Invisible; everything depends on it |
| 2 | Exercise catalog + structured program | Your #1, complaint #2 |
| 3 | Workout logger rebuild + analytics dashboard | Your #8 |
| 4 | Food: per-100 g, bundled DB, recipe builder, barcode | Complaint #3 — the daily pain |
| 5 | Profile, onboarding, goals | Your #3, #4, #5 |
| 6 | AI write layer | Your #6, "rework my meal plan" |
| 7 | *(separate decision)* multi-user | Your #7 |

Steps 2–6 each ship independently and leave the app usable.

---

## 11. Open questions for you

1. **Food:** what do you actually buy and eat in a typical week, and which
   supermarkets? The bundled database is only as good as its curation — I'd
   rather cover 500 things you really eat than 2,000 you don't.
2. **Unilateral logging:** is "10 per leg" enough, or do you want to log left
   and right separately to catch imbalances?
3. **Gym:** home only for now, or do you also use a commercial gym?
4. **Diet:** beyond oats and not discarding yolks — anything else you won't
   eat, or won't cook?
5. **The plan document:** keep it in the app as a reference tab, or let the
   structured program and targets replace it entirely?
6. **Body fat:** do you have a way to measure it (calipers, smart scale), or
   should the app stop asking and track waist + photos instead?
