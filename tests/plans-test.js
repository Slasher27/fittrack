// Stage-2a: plans as entities (migration, active plan, library UI, sessions carry planId)
const { chromium } = require('playwright');
const APP = 'http://localhost:8099/index.html';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const ready = () => p.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
  await p.goto(APP); await p.waitForSelector('#view-auth:not(.hidden)'); await p.click('#authSkip'); await ready();

  console.log('A. fresh device seeds a default plan');
  ok(await p.evaluate(() => PLANS.length === 1 && PROG.id === 'plan-default' && Object.keys(PROG.days).length === 3), 'plan-default active with 3 days');
  ok(await p.evaluate(() => idbGetAll('plans').then(a => a.length === 1 && a[0].up === undefined)), 'seeded plan is unstamped (never pushed until edited)');
  ok(await p.evaluate(() => idbGet('kv', 'program').then(v => !v)), 'no legacy kv.program written any more');
  await p.evaluate(() => go('train')); await p.waitForTimeout(200);
  ok((await p.textContent('#dayBtns')).includes('Default plan'), 'Train shows the active plan name');

  console.log('B. editing a day writes the plan record (stamped)');
  await p.click('#view-train [data-editday="A"]', { force: true }); await p.waitForSelector('#pdTitle');
  await p.fill('#pdTitle', 'Day A — Legs'); await p.click('#pdSave'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => idbGet('plans', 'plan-default').then(pl => pl.days.A.title === 'Day A — Legs' && pl.up > 0)), 'edit persisted to plans store with an up stamp');

  console.log('C. legacy device: kv.program migrates into plan-legacy');
  await p.evaluate(async () => { await idbClear('plans'); await idbDel('kv', 'activePlan'); await idbPut('kv', { k: 'program', v: { days: { Z: { title: 'Day Z — Legacy', ex: [{ name: 'Back Squat', target: '5 × 5', type: 'barbell-lower', rest: 150 }] } }, schedule: { Tue: 'Z' } } }, true); });
  await p.reload(); await ready();
  ok(await p.evaluate(() => PROG.id === 'plan-legacy' && PROG.days.Z && PROG.schedule.Tue === 'Z'), 'legacy program became the active plan-legacy');
  ok(await p.evaluate(() => idbGet('plans', 'plan-legacy').then(pl => pl.up === undefined)), 'migrated plan unstamped');

  console.log('D. plan library: new / switch / duplicate / rename / delete');
  await p.evaluate(() => go('train')); await p.waitForTimeout(200);
  p.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Beginner plan' : undefined));
  await p.click('[data-planlib]', { force: true }); await p.waitForSelector('#plList');
  ok((await p.textContent('#plList')).includes('Active'), 'library lists the active plan');
  await p.click('#plNew'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => PROG.name === 'Beginner plan' && Object.keys(PROG.days).length === 0 && PLANS.length === 2), 'new empty plan created and active');
  ok(await p.evaluate(() => idbGet('kv', 'activePlan').then(a => a.v === PROG.id && a.up > 0)), 'explicit active choice is stamped (syncs)');
  ok((await p.textContent('#dayBtns')).includes('no training days yet'), 'empty-plan hint shown');
  await p.click('[data-planlib]', { force: true }); await p.waitForSelector('#plList');
  await p.click('[data-plan="plan-legacy"]', { force: true }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => PROG.id === 'plan-legacy'), 'switched back to plan-legacy');
  await p.click('[data-planlib]', { force: true }); await p.waitForSelector('#plList');
  await p.click('[data-plandup="plan-legacy"]', { force: true }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => PLANS.length === 3 && PLANS.some(x => x.name === 'My program (copy)')), 'duplicated');
  const copyId = await p.evaluate(() => PLANS.find(x => x.name === 'My program (copy)').id);
  await p.click(`[data-planren="${copyId}"]`, { force: true }); await p.waitForTimeout(200);
  ok(await p.evaluate(id => PLANS.find(x => x.id === id).name === 'Beginner plan', copyId), 'renamed via prompt');
  await p.click(`[data-plandel="${copyId}"]`, { force: true }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => PLANS.length === 2), 'deleted (non-active) plan');
  ok(await p.evaluate(() => idbGet('kv', 'tombstones').then(t => t && t.v.some(x => x.store === 'plans'))), 'delete left a plans tombstone for sync');
  await p.evaluate(() => closeModal());

  console.log('E. sessions record their plan');
  await p.click('#view-train [data-startday="Z"]', { force: true }); await p.waitForSelector('#view-session:not(.hidden) #woSave');
  await p.fill('#view-session .setrow input[aria-label="Set 1 weight, kg"]', '80'); await p.fill('#view-session .setrow input[aria-label^="Set 1 reps"]', '5');
  await p.click('#woSave', { force: true }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => idbGetAll('workouts').then(a => a.length === 1 && a[0].planId === 'plan-legacy')), 'workout stored with planId');

  ok(!errs.length, 'no console errors ' + JSON.stringify(errs));
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
