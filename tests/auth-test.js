// Stage-1 verification: modules split + Supabase Auth gate + per-user sync (mocked server).
const { chromium } = require('playwright');
const APP = 'http://localhost:8099/index.html';
const SB = 'https://mock.supabase.co';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };

// ---- mock Supabase ----
const users = new Map();      // email → {id, pass}
const tokens = new Map();     // access → uid
const refreshes = new Map();  // refresh → uid
const records = new Map();    // uid → Map(store|id → row)
let pushed = [];              // every upserted row (for assertions)
let n = 0;
function issue(uid) { const a = 'acc' + (++n), r = 'ref' + (++n); tokens.set(a, uid); refreshes.set(r, uid); return { access_token: a, refresh_token: r, expires_in: 3600, user: { id: uid, email: [...users].find(([, u]) => u.id === uid)?.[0] } }; }
async function mock(route) {
  const req = route.request(); const url = new URL(req.url()); const path = url.pathname + url.search;
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const auth = req.headers()['authorization']; const uid = auth ? tokens.get(auth.replace('Bearer ', '')) : null;
  if (path === '/auth/v1/signup') { const b = req.postDataJSON(); if (users.has(b.email)) return json(422, { msg: 'User already registered' }); const id = 'uid-' + b.email; users.set(b.email, { id, pass: b.password }); return json(200, issue(id)); }
  if (path.startsWith('/auth/v1/token?grant_type=password')) { const b = req.postDataJSON(); const u = users.get(b.email); if (!u || u.pass !== b.password) return json(400, { error_description: 'Invalid login credentials' }); return json(200, issue(u.id)); }
  if (path.startsWith('/auth/v1/token?grant_type=refresh_token')) { const b = req.postDataJSON(); const id = refreshes.get(b.refresh_token); if (!id) return json(400, { error_description: 'Invalid Refresh Token' }); return json(200, issue(id)); }
  if (path === '/auth/v1/logout') return json(204, {});
  if (path === '/rest/v1/rpc/invite_valid') return json(200, true);
  if (path.startsWith('/rest/v1/records')) {
    if (!uid) return json(401, { message: 'JWT required' });
    if (!records.has(uid)) records.set(uid, new Map());
    const mine = records.get(uid);
    if (req.method() === 'POST') { const rows = req.postDataJSON(); for (const r of rows) { mine.set(r.store + '|' + r.id, r); pushed.push({ uid, ...r }); } return json(201, []); }
    return json(200, [...mine.values()].sort((a, b) => a.up - b.up));
  }
  return json(404, { message: 'no route ' + path });
}
async function newPage(browser, { configured = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); // SW install fetches bypass page.route and would cache the real (empty) config.js
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message + ' @ ' + String(e.stack||'').split(String.fromCharCode(10)).slice(0,3).join(' | '))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.route('**/app/config.js', r => r.fulfill({ contentType: 'application/javascript', body: `export const CONFIG={supabaseUrl:${JSON.stringify(configured ? SB : '')},supabaseKey:${JSON.stringify(configured ? 'anon-key' : '')}};` }));
  await page.route(SB + '/**', mock);
  return { ctx, page, errs };
}
const gateVisible = p => p.evaluate(() => !document.querySelector('#view-auth').classList.contains('hidden') && document.body.classList.contains('auth-mode'));
const ready = async p => { try { await p.waitForSelector('body[data-ready="1"]', { timeout: 15000 }); } catch (e) { console.log('   [ready timeout] authErr=', await p.textContent('#authErr'), 'status=', await p.textContent('#authStatus'), 'body=', await p.evaluate(() => document.body.className)); throw e; } };
async function signIn(p, email, pass, up = false) {
  await p.waitForSelector('#view-auth:not(.hidden)');
  if (up) await p.click('#authToggle');
  await p.fill('#authEmail', email); await p.fill('#authPass', pass); await p.click('#authSubmit');
}

(async () => {
  const browser = await chromium.launch();

  console.log('1. Not configured');
  { const { ctx, page, errs } = await newPage(browser, { configured: false });
    await page.goto(APP); await page.waitForSelector('#view-auth:not(.hidden)');
    ok(await gateVisible(page), 'gate shown when no session');
    ok((await page.textContent('#authErr')).includes('not configured'), 'explains missing config');
    ok(await page.$eval('#authSubmit', b => b.disabled), 'submit disabled');
    ok(!errs.length, 'no console errors ' + JSON.stringify(errs)); await ctx.close(); }

  console.log('2. Sign up → boot → seed → smoke');
  let ctxA;
  { const r = await newPage(browser); ctxA = r.ctx; const { page, errs } = r;
    await page.goto(APP); await page.waitForSelector('#view-auth:not(.hidden)');
    ok(await gateVisible(page), 'gate shown on fresh device');
    ok(await page.$eval('.app-header', h => getComputedStyle(h).display === 'none'), 'header hidden behind gate');
    await page.click('#authToggle'); await page.fill('#authEmail', 'a@x.com'); await page.fill('#authPass', 'short'); await page.fill('#authInvite', 'TESTCODE'); await page.click('#authSubmit');
    ok((await page.textContent('#authErr')).includes('8 characters'), 'weak password rejected client-side');
    await page.fill('#authPass', 'password123'); await page.click('#authSubmit');
    await ready(page);
    ok(!(await gateVisible(page)), 'gate gone after sign-up');
    ok(await page.evaluate(() => authUser().email === 'a@x.com'), 'session has email');
    const foods = await page.evaluate(() => idbGetAll('foods').then(a => a.length));
    ok(foods > 40, 'seeded foods on a brand-new account (' + foods + ')');
    ok(await page.evaluate(() => idbGet('kv', 'settings').then(s => !s || !s.sync)), 'settings carry no sync creds');
    // smoke: log a food, measurement, workout
    await page.evaluate(() => go('food')); await page.evaluate(() => { const b = document.querySelector('#view-food [data-fseg="library"]'); b && b.click(); });
    await page.waitForTimeout(300);
    await page.click('#view-food [data-logfood]', { force: true }); await page.waitForSelector('#modalRoot .modal');
    await page.click('#mSave', { force: true }); await page.waitForTimeout(300);
    ok(await page.evaluate(() => idbGetAll('log').then(a => a.length === 1)), 'food logged');
    await page.evaluate(() => addMeasureModal()); await page.fill('#msW', '82.5'); await page.click('#msSave'); await page.waitForTimeout(300);
    ok(await page.evaluate(() => idbGetAll('measurements').then(a => a.length === 1 && a[0].weight === 82.5)), 'measurement saved');
    await page.evaluate(() => go('train')); await page.click('#view-train [data-startday]', { force: true }); await page.waitForSelector('#view-session:not(.hidden)');
    await page.fill('#view-session .setrow input[aria-label="Set 1 weight, kg"]', '60'); await page.fill('#view-session .setrow input[aria-label^="Set 1 reps"]', '5');
    await page.click('#woSave', { force: true }); await page.waitForTimeout(400);
    ok(await page.evaluate(() => idbGetAll('workouts').then(a => a.length === 1)), 'workout saved');
    await page.evaluate(() => syncNow()); await page.waitForTimeout(200);
    const cloudA = records.get('uid-a@x.com');
    ok(cloudA && cloudA.size > 60 && [...cloudA.keys()].some(k => k.startsWith('workouts|')), 'pushed to the account (' + (cloudA && cloudA.size) + ' rows)');
    ok(!pushed.some(r => r.deleted), 'no tombstones pushed by first seed');
    ok(!errs.length, 'no console errors ' + JSON.stringify(errs));
    // keep page for later
    r.page2 = page; ctxA._page = page; ctxA._errs = errs; }

  console.log('3. Restore on a fresh device (pull first, no reseed)');
  { pushed = []; const { ctx, page, errs } = await newPage(browser);
    await page.goto(APP); await signIn(page, 'a@x.com', 'password123'); await ready(page);
    ok(!(await gateVisible(page)), 'signed in');
    ok(await page.evaluate(() => idbGetAll('workouts').then(a => a.length === 1)), 'workout restored');
    ok(await page.evaluate(() => idbGetAll('measurements').then(a => a.length === 1)), 'measurement restored');
    ok(await page.evaluate(() => idbGetAll('log').then(a => a.length === 1)), 'log restored');
    const meals = await page.evaluate(() => idbGetAll('meals').then(a => a.length));
    ok(meals === 28, 'meals restored, not duplicated (' + meals + ')');
    ok(await page.evaluate(() => idbGet('kv', 'mealSeedVersion').then(v => v && v.v === MEAL_SEED_VERSION)), 'meal seed version adopted');
    ok(!pushed.some(r => r.deleted), 'restore pushed no tombstones (would have deleted seed meals everywhere)');
    ok(!pushed.some(r => r.store === 'meals'), 'restore did not re-stamp meals');
    ok(!errs.length, 'no console errors ' + JSON.stringify(errs));
    // sign out wipes
    await page.evaluate(() => settingsModal()); await page.waitForSelector('#sbSignOut');
    ok((await page.textContent('#modalRoot')).includes('a@x.com'), 'settings shows account email');
    page.on('dialog', d => d.accept()); await page.click('#sbSignOut');
    await page.waitForSelector('#view-auth:not(.hidden)', { timeout: 10000 });
    ok(await gateVisible(page), 'gate back after sign-out');
    ok(await page.evaluate(() => idbGetAll('foods').then(a => a.length === 0)), 'local data wiped on sign-out');
    ok(!pushed.some(r => r.deleted), 'sign-out wrote no tombstones');
    await ctx.close(); }

  console.log('4. Legacy v1 device: SET.sync creds migrate to a session, no gate');
  { const { ctx, page, errs } = await newPage(browser);
    await page.goto(APP); await page.waitForSelector('#view-auth:not(.hidden)');
    // simulate a v1 device: settings.sync present, no session, some local data
    const rt = 'ref-legacy'; refreshes.set(rt, 'uid-a@x.com');
    await page.evaluate(async ({ SB, rt }) => {
      await idbPut('kv', { k: 'settings', targets: { kcal: 2000, protein: 150, carbs: 200, fat: 70 }, sync: { url: SB, anonKey: 'anon-key', email: 'a@x.com', pass: 'password123', refresh: rt, token: 'expired', tokenExp: 0, lastPush: 5, lastSync: 6 } });
      await idbPut('foods', { id: 'legacyfood', name: 'Legacy', group: 'x', serving: '100 g', kcal: 1, protein: 0, carbs: 0, fat: 0, custom: true, up: 10 }, true);
    }, { SB, rt });
    await page.reload(); await ready(page);
    ok(!(await gateVisible(page)), 'no gate — legacy device kept signed in');
    ok(await page.evaluate(() => idbGet('kv', 'settings').then(s => !s.sync && s.targets.kcal === 2000)), 'sync creds stripped from settings, targets kept');
    ok(await page.evaluate(() => idbGet('kv', 'session').then(s => s && s.email === 'a@x.com')), 'session record created');
    ok(await page.evaluate(() => idbGet('kv', 'syncState').then(s => s && s.lastPush >= 5)), 'push watermark carried over (then advanced by the first push)');
    await page.evaluate(() => syncNow());
    ok(records.get('uid-a@x.com').has('foods|legacyfood'), 'legacy local data pushed under the account');
    ok(!errs.length, 'no console errors ' + JSON.stringify(errs));
    await ctx.close(); }

  console.log('5. Wrong password + expired refresh');
  { const { ctx, page, errs } = await newPage(browser);
    await page.goto(APP); await signIn(page, 'a@x.com', 'nope'); await page.waitForTimeout(300);
    const et=await page.textContent('#authErr'); ok(et.includes('Invalid login'), 'server error surfaced ['+et+'] errs='+JSON.stringify(errs));
    await page.fill('#authPass', 'password123'); await page.click('#authSubmit'); await ready(page);
    // kill the refresh token server-side, expire access → next sync must return to the gate
    await page.evaluate(async () => { const s = await idbGet('kv', 'session'); s.exp = 0; s.access = 'dead'; await idbPut('kv', s); });
    for (const k of [...refreshes.keys()]) refreshes.delete(k);
    await page.reload(); await page.waitForSelector('#view-auth:not(.hidden)', { timeout: 10000 });
    ok(await gateVisible(page), 'dead session → gate with message');
    ok(!errs.length, 'no console errors ' + JSON.stringify(errs));
    await ctx.close(); }


  console.log('6. Skip sign-in → offline-only → later sign-in pushes local data');
  { pushed = []; const { ctx, page, errs } = await newPage(browser);
    await page.goto(APP); await page.waitForSelector('#view-auth:not(.hidden)');
    await page.click('#authSkip'); await ready(page);
    ok(!(await gateVisible(page)), 'app boots without an account');
    ok(await page.evaluate(() => idbGetAll('foods').then(a => a.length > 40)), 'seeded locally');
    ok(await page.evaluate(() => !authUser()), 'no session');
    await page.evaluate(() => settingsModal()); await page.waitForSelector('#sbSignIn');
    ok((await page.textContent('#modalRoot')).includes('Not signed in'), 'settings shows not signed in');
    await page.reload(); await ready(page);
    ok(!(await gateVisible(page)), 'reload stays offline-only (no nagging gate)');
    await page.evaluate(() => addMeasureModal()); await page.fill('#msW', '81'); await page.click('#msSave'); await page.waitForTimeout(200);
    await page.evaluate(() => settingsModal()); await page.waitForSelector('#sbSignIn'); await page.click('#sbSignIn');
    await page.waitForSelector('#view-auth:not(.hidden)');
    ok((await page.textContent('#authSkip')) === 'Not now', 'gate from settings offers plain Not now');
    await page.click('#authToggle'); await page.fill('#authEmail', 'b@x.com'); await page.fill('#authPass', 'password123'); await page.fill('#authInvite', 'TESTCODE'); await page.click('#authSubmit');
    await page.waitForFunction(() => authUser() && authUser().email === 'b@x.com'); await page.waitForTimeout(600);
    ok(!(await gateVisible(page)), 'signed in from settings');
    ok(await page.evaluate(() => idbGet('kv', 'localOnly').then(v => !v)), 'localOnly flag cleared');
    await page.evaluate(() => syncNow());
    const cloudB = records.get('uid-b@x.com');
    ok(cloudB && [...cloudB.keys()].some(k => k.startsWith('measurements|')), 'offline-era measurement pushed to the new account');
    ok(!errs.length, 'no console errors ' + JSON.stringify(errs));
    await ctx.close(); }

  await ctxA.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
