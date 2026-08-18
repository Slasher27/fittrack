/* FitTrack — IndexedDB data layer (ES module).
   Exports the promise wrapper used by every store, plus the sync stamping rules.
   Also exposed on `window` for the legacy classic-script views during the v3
   transition; new code should `import` from here. */
import { syncSoon } from './sync.js';

export let DB;
export const DB_NAME = 'fittrack';
export const DB_VERSION = 4; // v2: + water · v3: + exercises · v4: + plans

export function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'k' });
      if (!db.objectStoreNames.contains('foods')) db.createObjectStore('foods', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meals')) db.createObjectStore('meals', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('exercises')) db.createObjectStore('exercises', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('plans')) db.createObjectStore('plans', { keyPath: 'id' });
      for (const s of ['log', 'measurements', 'photos', 'workouts', 'water']) {
        if (!db.objectStoreNames.contains(s)) { const os = db.createObjectStore(s, { keyPath: 'id' }); os.createIndex('date', 'date'); }
      }
    };
    r.onsuccess = e => { DB = e.target.result; res(); };
    r.onerror = e => rej(e);
  });
}
export const ALL_STORES = ['kv', 'foods', 'meals', 'exercises', 'plans', 'log', 'measurements', 'photos', 'workouts', 'water'];
export function tx(store, mode = 'readonly') { return DB.transaction(store, mode).objectStore(store); }
export function idbGetAll(store) { return new Promise((res, rej) => { const r = tx(store).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = rej; }); }
export function idbGet(store, k) { return new Promise((res, rej) => { const r = tx(store).get(k); r.onsuccess = () => res(r.result); r.onerror = rej; }); }
export function idbClear(store) { return new Promise((res, rej) => { const r = tx(store, 'readwrite').clear(); r.onsuccess = () => res(); r.onerror = rej; }); }

/* Cloud sync: stores below sync; writes stamp `up` (ms), deletes leave tombstones.
   `fromSync=true` bypasses stamping so pulled records don't re-trigger a push loop. */
export const SYNC_STORES = new Set(['foods', 'meals', 'log', 'measurements', 'workouts', 'water', 'exercises', 'plans']);
export const SYNCED_KV = new Set(['program', 'equipment', 'activePlan']); // kv keys that sync (never settings/secrets/session). 'program' is legacy (pre-plans) — kept so old rows still merge.
export function idbPut(store, v, fromSync) {
  if (!fromSync && (SYNC_STORES.has(store) || (store === 'kv' && SYNCED_KV.has(v.k)))) { v.up = Date.now(); syncSoon(); }
  return new Promise((res, rej) => { const r = tx(store, 'readwrite').put(v); r.onsuccess = () => res(v); r.onerror = rej; });
}
export function idbDel(store, k, fromSync) {
  if (!fromSync && SYNC_STORES.has(store)) { recordTombstone(store, k); syncSoon(); }
  return new Promise((res, rej) => { const r = tx(store, 'readwrite').delete(k); r.onsuccess = () => res(); r.onerror = rej; });
}
export async function recordTombstone(store, id) {
  const rec = (await idbGet('kv', 'tombstones')) || { k: 'tombstones', v: [] };
  rec.v.push({ store, id, up: Date.now() }); await idbPut('kv', rec);
}
export function idbByDate(store, date) { return new Promise((res, rej) => { const r = tx(store).index('date').getAll(date); r.onsuccess = () => res(r.result || []); r.onerror = rej; }); }

/* Wipe every store on this device (sign-out / erase). Writes no tombstones, so it
   never cascades a delete to other devices — keep that property. */
export async function wipeLocal() { for (const s of ALL_STORES) await idbClear(s); }

// legacy bridge (classic scripts) — remove when the last view is a module
Object.assign(window, { openDB, tx, idbGetAll, idbGet, idbPut, idbDel, idbByDate, idbClear, recordTombstone, SYNC_STORES, SYNCED_KV, wipeLocal });
Object.defineProperty(window, 'DB', { get: () => DB });
