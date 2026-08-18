# FitTrack accounts & sync — setup

Every user signs in with an email + password. Their food log, meals,
measurements, workouts, program and gym sync to their account automatically,
so signing in on any device restores everything. The app stays offline-first
— IndexedDB is the instant local store; syncing happens in the background
whenever the device is online. Photos stay on-device for now.

There is nothing for users to configure. The one-time setup below is for
**whoever deploys the app** (the owner).

## 1. Create the (free) Supabase project — once

1. <https://supabase.com> → **Start your project** → sign up.
2. **New project** → name it `fittrack`, strong database password, region
   near you.

## 2. Create / upgrade the database — once, and again after schema changes

1. **SQL Editor → New query**, paste the whole of `supabase-schema.sql`, **Run**.
   You should see "Success. No rows returned".
2. It is safe to re-run. On a project that already has the v1 single-user
   table it upgrades in place: existing rows are handed to the first account
   ever created (the owner) and row-level security is switched on so every
   user only ever sees their own rows.

## 3. Auth settings — once

**Authentication → Providers → Email**: leave **Enable Email provider** on.
For an invite-only app with no email templates yet, turn **Confirm email**
*off* so people can sign in immediately after creating an account. (If you
leave it on, the app shows "check your email to confirm", which also works.)

## 4. Point the app at the project — once per deployment

**Project Settings (gear) → API Keys**: copy the **Project URL**
(`https://xxxx.supabase.co`) and the **Publishable key**
(`sb_publishable_…`; older projects show an "anon public" `eyJ…` key —
either works). Put both in [`app/config.js`](app/config.js):

```js
export const CONFIG = {
  supabaseUrl: 'https://xxxx.supabase.co',
  supabaseKey: 'sb_publishable_…',
};
```

This key is designed to be public: data is protected by each user's sign-in
and row-level security, not by hiding the key. Deploy as usual (bump the
service-worker `CACHE` version — CLAUDE.md §6).

## 5. Users

- **First launch on any device** shows the sign-in screen. New people tap
  *Create an account*; existing users sign in and their data is restored
  before anything else appears.
- **Devices upgraded from v1** (which stored sync credentials in Settings)
  migrate silently: the stored session is reused, the credentials are removed
  from Settings, and the account keeps working — no re-login.
- **Settings → Account** shows who is signed in, *Sync now*, and *Sign out of
  this device* (which removes the local copy; the account keeps everything).
- **Erase all data** (Settings) clears this device only and returns to the
  sign-in screen. The cloud copy is untouched; signing in restores it.

## Notes

- **Conflicts:** last write wins per record. Deletes obey the same rule.
- **Backups:** the ⚙️ backup file never contains sessions, keys or
  credentials.
- **Reset one user's cloud data:** `delete from records where user_id = '<uuid>';`
  (Authentication → Users shows the uuid). Then *Erase all data* on their
  devices.
- The old "Link another device" QR flow is gone — signing in *is* the link.
