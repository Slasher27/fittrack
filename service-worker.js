/* FitTrack service worker — offline app shell */
const CACHE = 'fittrack-v5';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './fonts/BarlowCondensed-600.woff2',
  './fonts/BarlowCondensed-700.woff2',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Tap a notification → focus the app (or open it). */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return clients.openWindow('./index.html');
  }));
});

/* Android/Chrome installed-PWA background nudges (registered by the app when
   notifications are enabled). Reads IndexedDB directly — no app code needed. */
self.addEventListener('periodicsync', e => {
  if (e.tag === 'fittrack-daily') e.waitUntil(dailyNudge());
});

async function dailyNudge() {
  try {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('fittrack'); r.onsuccess = () => res(r.result); r.onerror = rej; });
    const get = (store, key) => new Promise((res, rej) => { const q = db.transaction(store).objectStore(store).get(key); q.onsuccess = () => res(q.result); q.onerror = rej; });
    const byDate = (store, date) => new Promise((res, rej) => { const q = db.transaction(store).objectStore(store).index('date').getAll(date); q.onsuccess = () => res(q.result || []); q.onerror = rej; });
    const set = await get('kv', 'settings');
    if (!set || !set.notify) return;
    const pad = n => (n < 10 ? '0' + n : '' + n);
    const d = new Date();
    const today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const abbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    const hour = d.getHours();
    const prog = (await get('kv', 'program')) || {};
    const dayKey = prog.v && prog.v.schedule ? prog.v.schedule[abbr] : null;
    if (dayKey && prog.v.days[dayKey] && hour >= 15) {
      const done = await byDate('workouts', today);
      if (!done.length) {
        await self.registration.showNotification('🏋️ Training day', {
          body: (prog.v.days[dayKey].title || 'Workout') + ' is on the plan today — sets are prefilled from last time.',
          tag: 'fittrack-train', icon: './icon-192.png', badge: './icon-192.png',
        });
        return;
      }
    }
    if (hour >= 19) {
      const logs = await byDate('log', today);
      if (!logs.length) {
        await self.registration.showNotification('🍽️ Nothing logged today', {
          body: 'Quick-log your meals so the Coach stays accurate.',
          tag: 'fittrack-log', icon: './icon-192.png', badge: './icon-192.png',
        });
      }
    }
  } catch (e) { /* nudges are best-effort */ }
}

/* Cache-first for app shell; network fallback. App data lives in IndexedDB, not here. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Never intercept cross-origin calls (Supabase sync, Anthropic API) — cache is for the app shell only.
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
