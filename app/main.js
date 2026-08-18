/* FitTrack — boot (ES module entry).
   Order matters:
     openDB → settings → auth (migrates legacy sync creds) → [sign-in gate]
     → if this device is empty: PULL FIRST (restore), then seed only what is
       still missing → catalog → program → theme → first render.
   A fresh device must never seed a blank plan over data that exists in the
   account (V2-SPEC §9a). */
import { openDB, idbGet, idbGetAll, idbPut, idbDel, wipeLocal } from './db.js';
import * as auth from './auth.js';
import { syncNow, syncFlush, resetPushWatermark } from './sync.js';

const $ = (s, r = document) => r.querySelector(s);
let authMode = 'in'; // 'in' | 'up'
let booted = false;

function showAuth(msg) {
  document.body.classList.add('auth-mode');
  $('#authSkip').textContent = booted ? 'Not now' : 'Not now — use offline on this device';
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $('#view-auth').classList.remove('hidden');
  paintAuth();
  if (msg) $('#authStatus').textContent = msg;
  if (!auth.configured()) { $('#authErr').textContent = 'This install is not configured yet (app/config.js has no Supabase project).'; $('#authSubmit').disabled = true; }
  setTimeout(() => $('#authEmail').focus(), 50);
}
function hideAuth() { document.body.classList.remove('auth-mode'); $('#view-auth').classList.add('hidden'); }
function paintAuth() {
  const up = authMode === 'up';
  $('#authTitle').textContent = up ? 'Create your account' : 'Sign in';
  $('#authSub').textContent = up ? 'One account, every device — your data follows you.' : 'Welcome back. Your data is waiting.';
  $('#authSubmit').textContent = up ? 'Create account' : 'Sign in';
  $('#authToggle').textContent = up ? 'Already have an account? Sign in' : 'New here? Create an account';
  $('#authPass').setAttribute('autocomplete', up ? 'new-password' : 'current-password');
  $('#authErr').textContent = ''; $('#authStatus').textContent = '';
}

async function onAuthSubmit(e) {
  e.preventDefault();
  const email = $('#authEmail').value.trim(), pass = $('#authPass').value;
  const err = $('#authErr'); err.textContent = '';
  if (!email || !pass) { err.textContent = 'Enter your email and password.'; return; }
  if (authMode === 'up' && pass.length < 8) { err.textContent = 'Use at least 8 characters for your password.'; return; }
  if (!navigator.onLine) { err.textContent = 'You are offline — connect to sign in.'; return; }
  const btn = $('#authSubmit'); btn.disabled = true; btn.textContent = authMode === 'up' ? 'Creating…' : 'Signing in…';
  try {
    if (authMode === 'up') {
      const r = await auth.signUp(email, pass);
      if (r.needsConfirm) { authMode = 'in'; paintAuth(); $('#authStatus').textContent = 'Check your email to confirm your account, then sign in.'; return; }
    } else {
      await auth.signIn(email, pass);
    }
    await afterSignIn();
  } catch (ex) {
    err.textContent = ex.message || 'Something went wrong';
  } finally { btn.disabled = false; btn.textContent = authMode === 'up' ? 'Create account' : 'Sign in'; }
}

async function afterSignIn() {
  // a device that already holds data (v1 upgrade, or used offline until now) offers all of it to the account once
  if ((await idbGetAll('foods')).length || (await idbGetAll('workouts')).length) await resetPushWatermark();
  await idbDel('kv', 'localOnly');
  hideAuth();
  await start();
}
// Offline-only mode: the user chose to skip the account for now. Everything works on this
// device; nothing syncs until they sign in from Settings (their local data is pushed then).
async function skipAuth() {
  await idbPut('kv', { k: 'localOnly', v: 1 });
  hideAuth();
  if (booted) { window.go(window.curView); return; }
  await start();
}
window.appShowAuth = function () { authMode = 'in'; showAuth(); };

async function isEmptyDevice() {
  for (const s of ['foods', 'workouts', 'log', 'measurements']) if ((await idbGetAll(s)).length) return false;
  return true;
}

async function start() {
  const empty = await isEmptyDevice();
  if (empty && navigator.onLine && auth.signedIn()) {
    setStatus('Restoring your data…');
    try { await syncNow(); } catch (e) { if (e.signedOut) { showAuth('Your session expired — sign in again.'); return; } }
    setStatus('');
  }
  await window.seedIfEmpty();          // fills only what the account didn't have
  await window.loadExercises();        // must precede loadProgram — its migrations consult the catalog
  await window.loadProgram();
  window.applyTheme();
  $('#calTarget').textContent = window.SET.targets.kcal;
  window.go('today');
  if (!empty && auth.signedIn()) syncNow().then(n => { if (n) window.go(window.curView); }).catch(e => { if (e.signedOut) showAuth('Your session expired — sign in again.'); });
  if (!booted) {
    booted = true;
    if ('serviceWorker' in navigator) { try { await navigator.serviceWorker.register('service-worker.js'); } catch (e) {} }
    window.notifyCoach();
    if (window.SET.notify) window.registerPeriodic();
  }
  document.body.dataset.ready = '1'; // boot finished — automated checks wait on this
}
function setStatus(t) { const el = $('#bootStatus'); if (el) { el.textContent = t; el.classList.toggle('hidden', !t); } }

// pulled changes: rebuild indexes the views read, then repaint the current view
document.addEventListener('ft:synced', async e => {
  const d = e.detail || {};
  if (d.exApplied) await window.loadExercises();
  if (d.kvApplied) await window.loadProgram();
  if (d.applied && document.body.dataset.ready && !document.body.classList.contains('auth-mode')) window.go(window.curView);
});

// Sign out: push what's pending, end the session, wipe this device (no tombstones →
// nothing cascades to other devices), and return to the gate.
window.appSignOut = async function () {
  try { if (navigator.onLine) await syncNow(); } catch {}
  await auth.signOut();
  await wipeLocal();
  location.reload();
};
// Erase all data on this device (Settings): same wipe, keeps nothing — next launch asks to sign in and restores.
window.appEraseDevice = async function () { await wipeLocal(); location.reload(); };

$('#authForm').addEventListener('submit', onAuthSubmit);
$('#authSkip').addEventListener('click', skipAuth);
$('#authToggle').addEventListener('click', () => { authMode = authMode === 'up' ? 'in' : 'up'; paintAuth(); $('#authEmail').focus(); });

(async function boot() {
  await openDB();
  await window.loadSettings();
  await auth.authInit(window.SET, window.saveSettings);
  if (!auth.signedIn() && !(await idbGet('kv', 'localOnly'))) { showAuth(); return; }
  await start();
})();
