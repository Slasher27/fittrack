# FitTrack cloud sync — one-time setup (~5 minutes)

Sync keeps your food log, meals, measurements and workouts identical across
all your devices (phone, desktop). The app stays offline-first — IndexedDB
remains the instant local store and syncing happens in the background
whenever you're online. Photos stay on-device in v1.

## 1. Create the (free) Supabase project

1. Go to <https://supabase.com> → **Start your project** → sign up.
2. **New project** → name it `fittrack`, pick a strong database password
   (you won't need it day-to-day), choose a region near you (e.g. West EU).

## 2. Create the database table

1. In the project, open **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase-schema.sql` (in this folder) → **Run**.
   You should see "Success. No rows returned".

## 3. Create your user account

1. **Authentication → Users → Add user → Create new user.**
2. Enter your email + a password (this is what the app signs in with).
   Tick **Auto confirm user**.

## 4. Get the two values the app needs

1. **Project Settings (gear) → API Keys**:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **Publishable key** — starts with `sb_publishable_…`. (Older projects
     call this the "anon public" key, a long `eyJ…` string — either works.
     This key is designed to be public; your data is protected by your
     sign-in, not by hiding this key.)

## 5. Configure the app (on every device you use)

1. FitTrack → ⚙️ **Settings → Cloud sync**.
2. Fill in: Project URL, your email, your password, the anon key.
3. Tap **Sync now** — the status line should show "Synced ✓".

That's it. From then on the app syncs automatically a few seconds after any
change and on every launch. The second device you set up will pull
everything the first one pushed.

## Notes

- **Conflicts:** last write wins per record — fine for one person; just
  avoid editing the same meal on two offline devices at once.
- **Backups:** the ⚙️ backup file never contains your sync password or API
  keys; restoring a backup keeps the device's existing credentials.
- **Erase all data** (Settings) only clears the device, not the cloud. To
  reset the cloud too, run `delete from records;` in the SQL Editor.
