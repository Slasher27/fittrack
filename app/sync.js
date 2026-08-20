/* FitTrack — cloud sync engine (ES module).
   One generic Supabase `records` table (per user, RLS-scoped) holds every
   synced record. Last-write-wins on the client `up` stamp; deletes are
   tombstones and obey LWW too. Pull is ALWAYS a full pull (idempotent apply):
   `up` is device-stamped, so a "since last pull" filter would skip records that
   offline devices push late — see CLAUDE.md §4.2. Trivial data volume makes
   full pull the right trade.

   After applying pulled changes it dispatches `ft:synced` on `document` with
   {applied, kvApplied, exApplied} — the app decides what to reload/re-render. */
import { idbGet, idbGetAll, idbPut, idbDel, SYNC_STORES, SYNCED_KV } from './db.js';
import { signedIn, ensureToken, sb, currentUser } from './auth.js';

let syncTimer = null, syncBusy = false;
export function syncReady() { return signedIn() && navigator.onLine; }

async function state() { return (await idbGet('kv', 'syncState')) || { k: 'syncState', lastPush: 0, lastSync: 0 }; }
export async function lastSyncTime() { return (await state()).lastSync || 0; }

export function syncSoon() { if (!syncReady()) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow().catch(() => {}), 2000); }
export function syncFlush() { // push immediately — used when the app is being hidden/closed (phones freeze timers)
  if (!syncReady()) return; clearTimeout(syncTimer); syncNow().catch(() => {});
}
export function syncRefresh() { if (!syncReady()) return; syncNow().catch(() => {}); }

export async function syncNow() {
  if (!signedIn()) throw new Error('not signed in');
  if (syncBusy) return 0; syncBusy = true;
  try {
    await ensureToken();
    const st = await state();
    // PUSH: everything stamped since the last successful push, plus tombstones
    const lastPush = st.lastPush || 0; const payload = []; let maxUp = lastPush;
    for (const store of SYNC_STORES) {
      for (const r of await idbGetAll(store))
        if ((r.up || 0) > lastPush) { payload.push({ store, id: r.id, data: store === 'photos' ? { ...r, blob: undefined } : r, up: r.up, deleted: false }); maxUp = Math.max(maxUp, r.up); } // a photo's image never goes in the row
    }
    for (const r of await idbGetAll('kv'))
      if (SYNCED_KV.has(r.k) && (r.up || 0) > lastPush) { payload.push({ store: 'kv', id: r.k, data: r, up: r.up, deleted: false }); maxUp = Math.max(maxUp, r.up); }
    const tomb = (await idbGet('kv', 'tombstones'))?.v || [];
    for (const t of tomb) { payload.push({ store: t.store, id: t.id, data: null, up: t.up, deleted: true }); maxUp = Math.max(maxUp, t.up); }
    // dedupe by (store,id), newest wins — a delete-then-recreate (e.g. meal reseed) must
    // push the recreation, not the stale tombstone, and Postgres rejects duplicate keys in one upsert
    const newest = new Map();
    for (const r of payload) { const k = r.store + '|' + r.id; const ex = newest.get(k); if (!ex || r.up > ex.up) newest.set(k, r); }
    const rows = [...newest.values()];
    if (rows.length) {
      // user_id is filled server-side (default auth.uid()) and is part of the primary key
      const res = await sb('/rest/v1/records?on_conflict=user_id,store,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows) });
      if (!res.ok) throw new Error('push failed (' + res.status + ')');
      st.lastPush = maxUp; await idbPut('kv', { k: 'tombstones', v: [] });
    }
    // PULL: all of this user's rows (RLS scopes the query), applied idempotently
    const res2 = await sb('/rest/v1/records?select=store,id,data,up,deleted&order=up.asc', {});
    if (!res2.ok) throw new Error('pull failed (' + res2.status + ')');
    const pulled = await res2.json(); let applied = 0, kvApplied = false, exApplied = false;
    for (const row of pulled) {
      const isKv = row.store === 'kv' && SYNCED_KV.has(row.id);
      if (!SYNC_STORES.has(row.store) && !isKv) continue;
      const local = await idbGet(row.store, row.id);
      if (row.deleted) {
        // deletes obey last-write-wins too: a locally newer record (edit or reseed) beats an old tombstone
        if (!isKv && local && (local.up || 0) < row.up) { await idbDel(row.store, row.id, true); applied++; if (row.store === 'exercises') exApplied = true; if (row.store === 'plans') kvApplied = true; }
        continue;
      }
      if (!local || (local.up || 0) < row.up) {
        const data = row.store === 'photos' && local && local.blob ? { ...row.data, blob: local.blob } : row.data; // keep the image we already have
        await idbPut(row.store, data, true); applied++; if (isKv || row.store === 'plans') kvApplied = true; if (row.store === 'exercises') exApplied = true;
      }
    }
    await syncPhotoBlobs(); // upload new images, fetch missing ones (best effort, never blocks the sync result)
    st.lastSync = Date.now(); await idbPut('kv', st);
    document.dispatchEvent(new CustomEvent('ft:synced', { detail: { applied, kvApplied, exApplied } }));
    return applied;
  } finally { syncBusy = false; }
}

/* Photos: the image lives in Storage bucket `photos` at {uid}/{id}.jpg; the record syncs without it.
   `remote:true` on the record tells other devices there is an image to fetch. */
function photoPath(id) { const u = currentUser(); return u && u.uid ? `/storage/v1/object/photos/${u.uid}/${id}.jpg` : null; }
export async function syncPhotoBlobs() {
  try {
    const photos = await idbGetAll('photos'); let n = 0;
    for (const p of photos) {
      const path = photoPath(p.id); if (!path) return;
      if (p.blob && !p.remote) { // upload, then mark remote (stamped → meta re-pushes with remote:true)
        const res = await sb(path, { method: 'POST', headers: { 'content-type': p.blob.type || 'image/jpeg', 'x-upsert': 'true' }, body: p.blob });
        if (res.ok) await idbPut('photos', { ...p, remote: true });
        if (++n >= 6) break;
      } else if (!p.blob && p.remote) { // fetch the image another device uploaded
        const res = await sb(path, { method: 'GET' });
        if (res.ok) { const blob = await res.blob(); await idbPut('photos', { ...p, blob }, true); document.dispatchEvent(new CustomEvent('ft:photo', { detail: { id: p.id } })); }
        if (++n >= 6) break;
      }
    }
  } catch (e) { /* offline / bucket missing: try again next sync */ }
}
export async function deletePhotoRemote(id) { try { const path = photoPath(id); if (path) await sb(path, { method: 'DELETE' }); } catch {} }

/* Reset push watermark — used after signing in on a device that already holds
   local data, so everything local is offered to the account once. */
export async function resetPushWatermark() { const st = await state(); st.lastPush = 0; await idbPut('kv', st); }

// Triggers: online again → push; leaving the app (phone lock / app switch) → flush;
// returning (tab focus) → pull what other devices did meanwhile; long-lived tabs → every 5 min.
window.addEventListener('online', () => syncSoon());
document.addEventListener('visibilitychange', () => { if (document.hidden) syncFlush(); else syncRefresh(); });
window.addEventListener('pagehide', syncFlush);
setInterval(() => { if (!document.hidden) syncRefresh(); }, 5 * 60 * 1000);

// legacy bridge for classic scripts
Object.assign(window, { syncNow, syncSoon, syncFlush, syncRefresh, syncReady, syncConfigured: syncReady, lastSyncTime, syncPhotoBlobs, deletePhotoRemote });
