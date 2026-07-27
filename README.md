# FitTrack — your personal training & nutrition app

A Progressive Web App (PWA) built around your plan. It runs on your phone, works
offline, and stores everything **only on your device** (nothing is uploaded
anywhere). It tracks:

- **Today** — calories & macros logged against your targets (2,150 kcal · 180 P · 190 C · 75 F), with a live "calories left" ring.
- **Food** — a built-in library seeded with all your meal-plan foods + common SA staples, your own custom foods, and one-tap **saved meals** (your Monday breakfast, chicken & rice, etc.). Log by servings; it shows the gram equivalent.
- **Body** — weigh-ins, waist and other measurements, a 7-day average, and a weight trend chart with your goal line.
- **Photos** — progress photos by date and angle, stored locally.
- **Train** — your 3-day program (A/B/C) pre-loaded. Log weight × reps per set; last session's numbers are pre-filled so you can chase progressive overload. Full session history + volume.

Your calorie/macro targets, start and goal weight are all editable in **⚙️ Settings**, which also has **Backup** (download a file) and **Restore**.

---

## Fastest way to install it (≈5 minutes) — Netlify Drop

This gives you a real installable app with its own web address, no account setup, free.

1. Go to **https://app.netlify.com/drop** on your computer.
2. **Drag the whole `fittrack` folder** (the one containing `index.html`) onto that page.
3. Wait a few seconds — Netlify gives you a link like `https://random-name-123.netlify.app`.
4. Open that link **on your phone**.
5. Install it to your home screen:
   - **iPhone (Safari):** tap the **Share** button → **Add to Home Screen** → **Add**.
   - **Android (Chrome):** tap the **⋮** menu → **Install app** (or **Add to Home Screen**).
6. Open it from the new home-screen icon. It now runs full-screen and works offline.

> Optional: in Netlify, click **Site settings → Change site name** to get a tidier address like `duwayne-fittrack.netlify.app`. If you make an account (free), your site stays permanent and you can drag the folder again anytime to update it.

---

## Alternative: GitHub Pages (free, permanent)

1. Create a free account at **github.com** and make a new **public** repository, e.g. `fittrack`.
2. Upload all the files from the `fittrack` folder into the repo (drag them into the "Add file → Upload files" screen).
3. Go to **Settings → Pages**, set **Source: Deploy from a branch**, branch **main**, folder **/(root)**, **Save**.
4. After a minute your app is live at `https://<your-username>.github.io/fittrack/`.
5. Open it on your phone and **Add to Home Screen** as above.

---

## Important notes

- **It must be opened from a web address (https), not a file**, for offline install and photo storage to work. That's why we host it — a plain double-click of `index.html` won't install as an app.
- **Your data lives on the one device/browser you use.** It is private and offline, but it is *not* synced between devices and is *not* in the cloud. If you clear your browser data or lose the phone, the data goes with it.
- **Back up regularly.** In ⚙️ Settings tap **Backup data** to download a file (includes your photos). Keep it somewhere safe. **Restore** re-imports it — handy when moving to a new phone.
- Use the **same browser** each time (e.g. always Safari on iPhone). Data is per-browser.

## Files in this package

| File | What it is |
|---|---|
| `index.html` | The entire app (all logic + UI). |
| `manifest.json` | Makes it installable as an app. |
| `service-worker.js` | Enables offline use. |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | App icons. |
| `apple-touch-icon.png`, `favicon.png` | iOS / tab icons. |

## Tweaking it later

Open `index.html` in any text editor:
- **Change targets** — easiest in the app (⚙️ Settings), or edit the `SET` defaults near the top of the script.
- **Add foods permanently** — add lines to `SEED_FOODS`, or just use "+ Custom food" in the app.
- **Change the workout program** — edit the `PROGRAM` object (Day A / B / C, exercises and target sets/reps).

Enjoy — and remember the golden rule from your plan: **log every session and weigh in daily (judge the weekly average).** That's what turns this from an app into results.
