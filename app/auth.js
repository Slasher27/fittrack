/* FitTrack — accounts (ES module).
   Supabase Auth via plain fetch: sign up / sign in / refresh / sign out.
   The session (access + refresh token, email, uid) lives in kv `session` on
   this device only — it is never synced or exported. No password is stored.

   Legacy migration: v1 kept {url, anonKey, email, pass, token, refresh} in
   SET.sync. On first run we lift the refresh token into a session, keep the
   project url/key as a device-local fallback for CONFIG, and strip every
   secret from settings. Existing devices therefore stay signed in. */
import { CONFIG } from './config.js';
import { idbGet, idbPut, idbDel } from './db.js';

let session = null;   // {k:'session', access, refresh, exp, email, uid}
let project = null;   // {url, key}

export function signedIn() { return !!(session && session.refresh); }
export function currentUser() { return session ? { email: session.email, uid: session.uid } : null; }
export function configured() { return !!(project && project.url && project.key); }
export function projectInfo() { return project; }

function jwtSub(token) {
  try { const p = token.split('.')[1]; return JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/'))).sub || null; } catch { return null; }
}

/* Load session + project config; migrate legacy SET.sync if present. */
export async function authInit(legacySettings, saveLegacy) {
  session = (await idbGet('kv', 'session')) || null;
  const stored = await idbGet('kv', 'sbproject');
  project = (CONFIG.supabaseUrl && CONFIG.supabaseKey)
    ? { url: CONFIG.supabaseUrl, key: CONFIG.supabaseKey }
    : (stored ? { url: stored.url, key: stored.key } : null);
  const ls = legacySettings && legacySettings.sync;
  if (ls) {
    if (!project && ls.url && ls.anonKey) { project = { url: ls.url, key: ls.anonKey }; await idbPut('kv', { k: 'sbproject', url: ls.url, key: ls.anonKey }); }
    if (!session && ls.refresh) {
      session = { k: 'session', access: ls.token || null, refresh: ls.refresh, exp: ls.tokenExp || 0, email: ls.email || '', uid: ls.token ? jwtSub(ls.token) : null };
      await idbPut('kv', session);
    }
    // legacy sync state moves too, so the first push after upgrade isn't a full re-push
    if (ls.lastPush && !(await idbGet('kv', 'syncState'))) await idbPut('kv', { k: 'syncState', lastPush: ls.lastPush, lastSync: ls.lastSync || 0 });
    delete legacySettings.sync;                 // secrets out of settings for good
    if (saveLegacy) await saveLegacy();
  }
}

function base() { if (!configured()) throw new Error('App is not configured (missing Supabase project)'); return project.url.replace(/\/+$/, ''); }
export function sb(path, opts = {}, withAuth = true) {
  return fetch(base() + path, { ...opts, headers: {
    apikey: project.key,
    ...(withAuth && session && session.access ? { Authorization: 'Bearer ' + session.access } : {}),
    'content-type': 'application/json', ...(opts.headers || {}) } });
}

async function readErr(res, fallback) {
  try { const d = await res.json(); return d.msg || d.error_description || d.message || d.error || fallback; } catch { return fallback; }
}
async function adopt(d, email) {
  session = { k: 'session', access: d.access_token, refresh: d.refresh_token, exp: Date.now() + ((d.expires_in || 3600) - 60) * 1000,
    email: (d.user && d.user.email) || email || (session && session.email) || '', uid: (d.user && d.user.id) || jwtSub(d.access_token) };
  await idbPut('kv', session);
}
async function grant(body) {
  const kind = body.refresh_token ? 'refresh_token' : 'password';
  const res = await sb('/auth/v1/token?grant_type=' + kind, { method: 'POST', body: JSON.stringify(body) }, false);
  if (!res.ok) { const msg = await readErr(res, 'sign-in failed'); const e = new Error(msg); e.status = res.status; throw e; }
  await adopt(await res.json(), body.email);
}

export async function signIn(email, password) { await grant({ email, password }); return currentUser(); }
/* Returns {needsConfirm:true} when the project requires email confirmation
   (Supabase then returns a user without tokens). */
export async function signUp(email, password, meta) {
  const res = await sb('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password, data: meta || {} }) }, false);
  if (!res.ok) {
    const msg = await readErr(res, 'sign-up failed');
    // the invite gate is a DB trigger; Supabase wraps its exception as a generic database error
    if (/INVITE_REQUIRED|Database error/i.test(msg)) throw new Error('A valid invite code is needed to create an account. Ask the person who invited you for one.');
    throw new Error(msg);
  }
  const d = await res.json();
  if (d.access_token) { await adopt(d, email); return { needsConfirm: false }; }
  return { needsConfirm: true };
}
export async function ensureToken() {
  if (!session) throw new Error('not signed in');
  if (session.access && Date.now() < (session.exp || 0)) return;
  try { await grant({ refresh_token: session.refresh }); }
  catch (e) {
    // a rejected refresh token means the session is dead (revoked / expired) — the caller shows the sign-in gate
    if (e.status === 400 || e.status === 401 || e.status === 403) { await clearSession(); const err = new Error('signed out'); err.signedOut = true; throw err; }
    throw e; // network error: keep the session, try again later
  }
}
export async function clearSession() { session = null; try { await idbDel('kv', 'session'); } catch {} }
export async function signOut() {
  try { if (session && session.access) await sb('/auth/v1/logout', { method: 'POST' }); } catch {}
  await clearSession();
}

// legacy bridge for classic scripts
Object.assign(window, { authSignedIn: signedIn, authUser: currentUser, authConfigured: configured, authProject: projectInfo, sb, ensureToken });
