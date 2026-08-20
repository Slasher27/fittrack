const {chromium}=require('playwright');const APP='http://localhost:8099/index.html';const SB='https://mock.supabase.co';
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m);}else{fail++;console.log('  ✗',m);}};
const invites=[];const shares=[];const patches=[];let signups=[];
function mockFor(email){return route=>{const req=route.request();const u=new URL(req.url());const path=u.pathname;const json=(s,b)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
  if(path==='/auth/v1/signup'){signups.push(req.postDataJSON());return json(200,{access_token:'acc-'+email,refresh_token:'r-'+email,expires_in:3600,user:{id:'uid-'+email,email}});}
  if(path.startsWith('/auth/v1/token'))return json(200,{access_token:'acc-'+email,refresh_token:'r-'+email,expires_in:3600,user:{id:'uid-'+email,email}});
  if(path==='/rest/v1/rpc/invite_valid'){const c=req.postDataJSON().p_code;return json(200,invites.some(i=>i.code===c&&!i.used));}
  if(path==='/rest/v1/invites'){if(req.method()==='POST'){invites.push({...req.postDataJSON(),created_at:new Date().toISOString()});return json(201,[]);}return json(200,invites);}
  if(path==='/rest/v1/plan_shares'){if(req.method()==='POST'){shares.push({id:'sh'+shares.length,...req.postDataJSON(),created_at:new Date().toISOString(),claimed_at:null});return json(201,[]);}
    if(req.method()==='PATCH'){const id=(u.searchParams.get('id')||'').replace('eq.','');patches.push({id,...req.postDataJSON()});const s=shares.find(x=>x.id===id);if(s)s.claimed_at='x';return json(204,{});}
    return json(200,shares.filter(s=>!s.claimed_at&&s.to_email===email));}
  if(path.startsWith('/rest/v1/records'))return json(req.method()==='POST'?201:200,[]);
  if(path==='/functions/v1/coach')return json(200,{content:[{type:'text',text:'ok'}],stop_reason:'end_turn'});
  return json(404,{});};}
async function fresh(b,email){const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];
  p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text());});
  await p.route('**/app/config.js',r=>r.fulfill({contentType:'application/javascript',body:`export const CONFIG={supabaseUrl:'${SB}',supabaseKey:'k'};`}));
  await p.route(SB+'/**',mockFor(email));return{p,errs,ctx};}
(async()=>{
 const b=await chromium.launch();
 console.log('A. owner: sign in, create an invite');
 const A=await fresh(b,'owner@x.com');const p=A.p;
 await p.goto(APP);await p.waitForSelector('#view-auth:not(.hidden)');await p.fill('#authEmail','owner@x.com');await p.fill('#authPass','password123');await p.click('#authSubmit');await p.waitForSelector('body[data-ready="1"]');
 await p.evaluate(async()=>{await idbPut('measurements',{id:'m1',date:todayStr(),weight:83},true);}); // has data → not onboarding
 await p.evaluate(()=>go('today'));
 await p.evaluate(()=>settingsModal());await p.waitForSelector('#sbInvite');await p.click('#sbInvite');await p.waitForSelector('#invNew');
 await p.fill('#invNote','girlfriend');await p.click('#invNew');await p.waitForTimeout(400);
 ok(invites.length===1&&/^[A-Z2-9]{8}$/.test(invites[0].code)&&invites[0].note==='girlfriend','invite code created (8 chars, no ambiguous letters)');
 const code=invites[0].code;
 ok((await p.textContent('#invOut')).includes(code)&&await p.$('#invQr'),'code + QR shown');
 ok((await p.$eval('#invLink',i=>i.value)).endsWith('?invite='+code),'link carries the code');
 ok(await p.$eval('#invQr',c=>c.width>0),'QR drawn on the canvas');
 await p.evaluate(()=>closeModal());
 console.log('B. owner shares the active plan by email');
 await p.evaluate(()=>go('train'));await p.waitForTimeout(300);await p.click('[data-planlib]',{force:true});await p.waitForSelector('#plList');
 await p.click('[data-planshare="plan-default"]',{force:true});await p.waitForSelector('#shSend');
 await p.fill('#shEmail','Her@X.com');await p.click('#shSend');await p.waitForTimeout(300);
 ok(shares.length===1&&shares[0].to_email==='her@x.com'&&shares[0].from_email==='owner@x.com'&&shares[0].plan.days.A&&shares[0].plan.sourcePlanId==='plan-default','share row posted with snapshot (email lower-cased)');
 console.log('C. invitee: link prefills sign-up, code passed as metadata, onboarding starts');
 const B=await fresh(b,'her@x.com');const q=B.p;
 await q.goto(APP+'?invite='+code.toLowerCase());await q.waitForSelector('#view-auth:not(.hidden)');
 ok((await q.$eval('#authInvite',i=>i.value))===code,'invite code prefilled + upper-cased from the link');
 ok((await q.textContent('#authTitle')).includes('Create'),'form is in sign-up mode');
 ok(await q.evaluate(()=>location.search===''),'code stripped from the address bar');
 await q.fill('#authEmail','her@x.com');await q.fill('#authPass','password123');await q.click('#authSubmit');await q.waitForSelector('body[data-ready="1"]');
 ok(signups.length===1&&signups[0].data.invite_code===code,'sign-up carried invite_code metadata');
 ok(await q.evaluate(()=>curView==='onboard'),'new person lands in onboarding');
 // an invalid code is refused before submitting
 const C=await fresh(b,'nobody@x.com');const r=C.p;await r.goto(APP);await r.waitForSelector('#view-auth:not(.hidden)');await r.click('#authToggle');await r.fill('#authEmail','nobody@x.com');await r.fill('#authPass','password123');await r.fill('#authInvite','ZZZZ9999');await r.click('#authSubmit');await r.waitForTimeout(300);
 ok((await r.textContent('#authErr')).includes('not valid'),'invalid code refused client-side (RPC pre-check)');
 await r.fill('#authInvite','');await r.click('#authSubmit');await r.waitForTimeout(100);ok((await r.textContent('#authErr')).includes('invite code'),'missing code refused');
 await C.ctx.close();
 console.log('D. invitee sees the shared plan after setup and imports it');
 // finish onboarding quickly with the default plan
 await q.fill('#ob_age','40');await q.fill('#ob_h','165');await q.fill('#ob_w','65');await q.click('[data-obchip="sex"][data-val="female"]');
 for(let i=0;i<6;i++){await q.click('[data-obnext]');await q.waitForTimeout(120);}
 await q.waitForSelector('#obDefault');
 // she has no barbell/rack: clear kit so the shared plan flags issues
 await q.evaluate(async()=>{EQUIP.bars=[];EQUIP.plates=[];EQUIP.gear=['pull-up bar'];await idbPut('kv',{k:'equipment',v:EQUIP});});
 await q.click('#obDefault');await q.waitForSelector('#shAdd',{timeout:8000});
 const offer=await q.textContent('#modalRoot');
 ok(/owner@x\.com/.test(offer)&&/Default plan/.test(offer),'offer names the sender and the plan');
 ok(/Needs kit you don’t have/.test(offer)&&/Back Squat/.test(offer),'kit mismatch flagged in the offer');
 q.once('dialog',d=>d.accept()); // make active
 await q.click('#shAdd');await q.waitForTimeout(500);
 ok(await q.evaluate(()=>PLANS.some(x=>x.source==='shared'&&x.sharedFrom.email==='owner@x.com')&&PROG.source==='shared'),'imported as a shared copy and made active');
 ok(patches.length===1&&patches[0].status==='accepted','share marked claimed');
 ok(await q.evaluate(()=>PROG.days.A.ex.every(e=>e.tgt)),'imported exercises normalised to structured targets');
 console.log('E. deterministic adaptation to her kit');
 await q.evaluate(()=>go('train'));await q.waitForTimeout(400);
 const adapt=await q.textContent('#trainAdapt');
 ok(/needs kit you don’t have/i.test(adapt)&&/Back Squat/.test(adapt)&&/→/.test(adapt),'Train shows affected exercises with proposed swaps: '+adapt.slice(0,80));
 q.once('dialog',d=>d.accept());await q.click('[data-adaptapply]');await q.waitForTimeout(400);
 ok(await q.evaluate(()=>!PROG.days.A.ex.some(e=>e.name==='Back Squat')&&PROG.days.A.ex[0].tgt.sets===4),'swaps applied, targets kept');
 ok(await q.evaluate(()=>planAffected().every(a=>!a.alt)),'everything that had a fitting alternative was swapped (rest listed as unresolved)');
 ok(!A.errs.length&&!B.errs.length,'no console errors '+JSON.stringify([...A.errs,...B.errs]));
 await b.close();console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
