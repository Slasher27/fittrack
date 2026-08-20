const {chromium}=require('playwright');const APP='http://localhost:8099/index.html';const SB='https://mock.supabase.co';
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m);}else{fail++;console.log('  ✗',m);}};
const records=new Map();const storage=new Map();const storeLog=[];const coachReqs=[];let coachScript=[];
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
function mock(email){return async route=>{const req=route.request();const u=new URL(req.url());const path=u.pathname;const json=(s,b)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
  if(path.startsWith('/auth/v1/token'))return json(200,{access_token:'acc',refresh_token:'r',expires_in:3600,user:{id:'uid1',email}});
  if(path.startsWith('/rest/v1/plan_shares'))return json(200,[]);
  if(path.startsWith('/rest/v1/ai_usage'))return json(200,[{input_tokens:4000,output_tokens:800,cache_read:20000},{input_tokens:3000,output_tokens:500,cache_read:0}]);
  if(path.startsWith('/rest/v1/records')){if(req.method()==='POST'){for(const r of req.postDataJSON())records.set(r.store+'|'+r.id,r);return json(201,[]);}return json(200,[...records.values()]);}
  if(path.startsWith('/storage/v1/object/photos/')){const key=path.replace('/storage/v1/object/photos/','');storeLog.push(req.method()+' '+key);
    if(req.method()==='POST'){storage.set(key,req.postDataBuffer());return json(200,{Key:key});}
    if(req.method()==='GET'){const b=storage.get(key);if(!b)return json(404,{error:'not found'});return route.fulfill({status:200,contentType:'image/png',body:b});}
    if(req.method()==='DELETE'){storage.delete(key);return json(200,[]);}}
  if(path==='/functions/v1/coach'){coachReqs.push(req.postDataJSON());return json(200,coachScript.length?coachScript.shift():{content:[{type:'text',text:'ok'}],stop_reason:'end_turn'});}
  return json(404,{});};}
async function fresh(b){const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];
  p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text());});
  await p.route('**/app/config.js',r=>r.fulfill({contentType:'application/javascript',body:`export const CONFIG={supabaseUrl:'${SB}',supabaseKey:'k'};`}));
  await p.route(SB+'/**',mock('a@x.com'));
  await p.goto(APP);await p.waitForSelector('#view-auth:not(.hidden)');await p.fill('#authEmail','a@x.com');await p.fill('#authPass','password123');await p.click('#authSubmit');await p.waitForSelector('body[data-ready="1"]');return{p,errs,ctx};}
(async()=>{
 const b=await chromium.launch();
 const A=await fresh(b);const p=A.p;const wt=n=>p.waitForTimeout(n);
 await p.evaluate(async()=>{await idbPut('measurements',{id:'m1',date:todayStr(),weight:83},true);const mk=(date,w)=>({id:'w'+date,date,dayKey:'A',title:'Day A — Lower',ts:Date.now(),planId:'plan-default',prs:[],exercises:[{name:'Back Squat',mode:'reps',sets:[{weight:w,reps:5,done:true}]}]});await idbPut('workouts',mk(addDays(todayStr(),-3),60),true);});
 console.log('A. nav collapse');
 await p.evaluate(()=>go('today'));await wt(200);
 ok(await p.$$eval('.nav [data-nav]',b=>b.map(x=>x.dataset.nav).join(','))==='coach,today,train','nav = Coach · Home · Train');
 await p.click('#view-today [data-nav="food"]');await wt(200);ok(await p.evaluate(()=>curView==='food'),'Home → Food library');
 await p.click('#view-food [data-nav="today"]');await wt(200);ok(await p.evaluate(()=>curView==='today'),'Food → ‹ Home');
 await p.click('#view-today [data-nav="body"]');await wt(200);ok(await p.evaluate(()=>curView==='body'),'Home → Weight');
 await p.click('#view-body [data-nav="photos"]');await wt(200);ok(await p.evaluate(()=>curView==='photos'),'Weight → Photos');
 console.log('B. weekly review');
 await p.click('.nav [data-nav="coach"]');await wt(500);
 ok((await p.textContent('#coachTop')).includes('Progress')&&(await p.textContent('#coachTop')).includes('83 kg'),'Progress card with weight');
 ok(await p.$('#coachTop [data-review]'),'review due → Run review offered');
 coachScript=[{content:[{type:'text',text:'**Adherence:** 1 of 3 sessions. Change: add 5 kg to squats.'},{type:'tool_use',id:'r1',name:'update_targets',input:{protein:185,reason:'protein a touch low'}}],stop_reason:'tool_use'},{content:[{type:'text',text:'Focus: hit all three sessions.'}],stop_reason:'end_turn'}];
 await p.click('#coachTop [data-review]');await wt(700);
 const rq=coachReqs[coachReqs.length-1];ok(rq.kind==='review'&&rq.effort==='high'&&/weekly review time/.test(rq.messages[rq.messages.length-1].content)&&/lastWeek.*setsByMuscle/.test(rq.messages[rq.messages.length-1].content),'review request: kind review, high effort, prompt + last-week context');
 ok(await p.$('#coachChat .msg.tool.pending [data-coachok="r1"]'),'review proposes a change as a preview');
 await p.click('[data-coachok="r1"]');await wt(600);
 ok(await p.evaluate(()=>SET.targets.protein===185),'accepted target change applied');
 ok(await p.evaluate(()=>idbGet('kv','lastReview').then(v=>!!v&&!!v.v)),'review recorded for this week');
 ok(await p.evaluate(()=>idbGet('kv','reviews').then(v=>v.v.length===1&&/Focus/.test(v.v[0].text))),'review text archived');
 await p.evaluate(()=>renderCoachTab());await wt(300);ok(!(await p.$('#coachTop [data-review]')),'review card gone until next week');
 console.log('C. usage metering');
 await p.evaluate(()=>settingsModal());await p.waitForSelector('#sbUsage');await wt(300);
 const ut=await p.textContent('#sbUsage');ok(/2 requests/.test(ut)&&/28k tokens/.test(ut)&&/\$0\.\d\d/.test(ut),'usage line: '+ut);
 await p.evaluate(()=>closeModal());
 console.log('D. photos: meta syncs, image uploads to Storage');
 await p.evaluate(async(png)=>{const blob=new Blob([Uint8Array.from(atob(png),c=>c.charCodeAt(0))],{type:'image/png'});await idbPut('photos',{id:'ph1',date:todayStr(),category:'Front',note:'test',blob,ts:Date.now()});},PNG.toString('base64'));
 await p.evaluate(()=>syncNow());await wt(500);
 const row=records.get('photos|ph1');
 ok(row&&row.data.category==='Front'&&row.data.blob===undefined,'photo metadata pushed without the image');
 ok(storage.has('uid1/ph1.jpg')&&storeLog.includes('POST uid1/ph1.jpg'),'image uploaded to photos/{uid}/{id}.jpg');
 await p.evaluate(()=>syncNow());await wt(300);
 ok(await p.evaluate(()=>idbGet('photos','ph1').then(x=>x.remote===true)),'record marked remote');
 ok(records.get('photos|ph1').data.remote===true,'remote flag re-pushed so other devices know to fetch');
 console.log('E. second device: pulls meta, fetches the image');
 const B=await fresh(b);const q=B.p;
 await q.evaluate(()=>syncNow());await q.waitForTimeout(600);
 ok(await q.evaluate(()=>idbGet('photos','ph1').then(x=>!!x&&!!x.blob&&x.blob.size>0)),'image downloaded into the photo record');
 await q.evaluate(()=>go('photos'));await q.waitForTimeout(300);
 ok(await q.$('#photoGrid .pcell img')&&!(await q.$('#photoGrid .pcell.pending')),'photo renders (no pending placeholder)');
 q.once('dialog',d=>d.accept());
 await q.evaluate(()=>{viewPhotoModal('ph1');});await q.waitForSelector('[data-delphoto]');await q.click('[data-delphoto]');await q.waitForTimeout(300);
 ok(storeLog.some(l=>l==='DELETE uid1/ph1.jpg'),'delete removes the Storage object too');
 ok(!A.errs.length&&!B.errs.length,'no console errors '+JSON.stringify([...A.errs,...B.errs]));
 await b.close();console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
