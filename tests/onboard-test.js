const {chromium}=require('playwright');const APP='http://localhost:8099/index.html';const SB='https://mock.supabase.co';
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m);}else{fail++;console.log('  ✗',m);}};
const reqs=[];let script=[];
const PLAN={planName:'Recomp 3-day',description:'Full body, Mon/Wed/Fri',targets:{kcal:2200,protein:185,carbs:200,fat:75,kcalTrain:2350},goalWeight:77,
 schedule:{Mon:'A',Wed:'B',Fri:'C'},
 days:[{key:'A',title:'Day A — Lower + Push (Mon)',exercises:[{name:'Back Squat',sets:4,repsMin:5,repsMax:5,rest:150},{name:'Bench Press',sets:3,repsMin:6,repsMax:8},{name:'KB Goblet Reverse Lunge',sets:3,repsMin:10},{name:'Plank',sets:3,secs:40}]},
       {key:'B',title:'Day B — Upper + Pull (Wed)',exercises:[{name:'Deadlift',sets:4,repsMin:4,repsMax:5},{name:'Overhead Press',sets:3,repsMin:6,repsMax:8},{name:'Chin-ups',sets:3,amrap:true},{name:'Skipping intervals',sets:8,secs:40}]},
       {key:'C',title:'Day C — Full body (Fri)',exercises:[{name:'Front Squat',sets:3,repsMin:6,repsMax:8},{name:'Leg Press',sets:3,repsMin:12},{name:'Unicorn Press',sets:3,repsMin:8},{name:'Core circuit',rounds:3,items:[{name:'Dead Bug',reps:10,perSide:true},{name:'Plank',secs:40}]}]}],
 rationale:'Three full-body days fit your Mon/Wed/Fri. **Double progression** on the big lifts.',weeklyFocus:['Weigh in daily','3 L water']};
(async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text());});
 await p.route('**/app/config.js',r=>r.fulfill({contentType:'application/javascript',body:`export const CONFIG={supabaseUrl:'${SB}',supabaseKey:'k'};`}));
 await p.route(SB+'/**',route=>{const req=route.request();const path=new URL(req.url()).pathname;const json=(s,b)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
  if(path.startsWith('/auth/v1/token')||path==='/auth/v1/signup')return json(200,{access_token:'acc1',refresh_token:'r1',expires_in:3600,user:{id:'u1',email:'new@x.com'}});
  if(path==='/rest/v1/rpc/invite_valid')return json(200,true);if(path.startsWith('/rest/v1/plan_shares'))return json(200,[]);if(path.startsWith('/rest/v1/records'))return json(req.method()==='POST'?201:200,[]);
  if(path==='/functions/v1/coach'){reqs.push(req.postDataJSON());const r=script.length?script.shift():{content:[{type:'text',text:'?'}],stop_reason:'end_turn'};return json(200,r);}
  return json(404,{});});
 const wt=n=>p.waitForTimeout(n);
 console.log('A. new sign-up lands in onboarding');
 await p.goto(APP);await p.waitForSelector('#view-auth:not(.hidden)');await p.click('#authToggle');await p.fill('#authEmail','new@x.com');await p.fill('#authPass','password123');await p.fill('#authInvite','ABCD2345');await p.click('#authSubmit');await p.waitForSelector('body[data-ready="1"]');
 ok(await p.evaluate(()=>curView==='onboard'&&!document.querySelector('#view-onboard').classList.contains('hidden')),'onboarding view is the front door for a new person');
 ok((await p.textContent('#obBody')).includes('About you'),'step 1: About you');
 await p.fill('#ob_age','45');await p.fill('#ob_h','172');await p.fill('#ob_w','83');await p.fill('#ob_bf','22');await p.fill('#ob_inj','none');
 await p.click('[data-obchip="reviewDay"][data-val="Sun"]');await p.click('[data-obnext]');await wt(150);
 ok((await p.textContent('#obBody')).includes('Your goal'),'step 2');
 await p.click('[data-obchip="goalType"][data-val="recomp"]');await p.fill('#ob_gbf','15');await p.fill('#ob_target','15% body fat');await p.fill('#ob_tf','16 weeks');await p.click('[data-obnext]');await wt(150);
 ok((await p.textContent('#obBody')).includes('Training now'),'step 3');
 await p.click('[data-obchip="days"][data-val="Sat"]');
 ok(await p.evaluate(()=>OB.data.training.days.length===4&&OB.data.training.daysPerWeek===4),'day chips toggle + count');
 await p.click('[data-obchip="days"][data-val="Sat"]');await p.fill('#ob_cur','skipping, swings, squats');await p.click('[data-obnext]');await wt(150);
 ok((await p.textContent('#obBody')).includes('Where you train'),'step 4');
 await p.fill('#ob_db','2, 3, 6, 10');await p.fill('#ob_kb','12,16,20,24,32');await p.click('[data-obchip="gear"][data-val="EZ bar"]');await p.click('[data-obnext]');await wt(150);
 ok((await p.textContent('#obBody')).includes('Food'),'step 5');
 await p.fill('#ob_dis','oats');await p.fill('#ob_rules',"don't throw away egg yolks");await p.click('[data-obnext]');await wt(150);
 ok((await p.textContent('#obBody')).includes('Lifestyle'),'step 6');
 await p.click('[data-obchip="activity"][data-val="moderate"]');await p.click('[data-obnext]');await wt(300);
 console.log('B. profile + deterministic targets saved');
 const prof=await p.evaluate(()=>idbGet('kv','profile').then(r=>r&&r.v));
 ok(prof&&prof.age===45&&prof.goal.type==='recomp'&&prof.diet.dislikes==='oats'&&prof.reviewDay==='Sun','profile stored (synced kv)');
 ok(await p.evaluate(()=>idbGet('kv','profile').then(r=>r.up>0)),'profile record stamped for sync');
 const T=await p.evaluate(()=>SET.targets);
 ok(T.kcal>=1900&&T.kcal<=2400&&T.protein===183&&T.kcalTrain===T.kcal+150,'Mifflin-St Jeor targets: '+JSON.stringify(T));
 ok(await p.evaluate(()=>Math.abs(SET.goalWeight-76)<=1.5&&SET.startWeight===83),'goal weight from body-fat goal ≈ 76 kg: '+await p.evaluate(()=>SET.goalWeight));
 ok(await p.evaluate(()=>EQUIP.dumbbells.length===4&&EQUIP.kettlebells.includes(32)&&EQUIP.gear.includes('EZ bar')&&EQUIP.commercial===false),'equipment written from the gym step');
 ok((await p.textContent('#obBody')).includes('Your numbers')&&await p.$('#obGen:not([disabled])'),'generate screen with coach available');
 console.log('C. generate → validate → preview → accept');
 script=[{content:[{type:'tool_use',id:'g1',name:'create_plan',input:PLAN}],stop_reason:'tool_use'}];
 await p.fill('#obNote','keep it under 60 min');await p.click('#obGen');await wt(800);
 const g=reqs[reqs.length-1];
 ok(g.kind==='onboard'&&g.tool_choice&&g.tool_choice.name==='create_plan'&&g.tools.length===1&&/AVAILABLE EXERCISES:/.test(g.system[0].text)&&/EXTRA FROM THE USER: keep it under 60 min/.test(g.messages[0].content)&&/PROFILE: 45y male/.test(g.messages[0].content),'generation request: forced tool, catalog list, profile + note');
 ok(!/EZ-bar Curl/.test(g.system[0].text)===false,'available list includes EZ-bar exercises now that EZ bar is owned');
 const pv=await p.textContent('#obBody');
 ok(/Recomp 3-day/.test(pv)&&/Double progression/.test(pv)&&/2200 kcal/.test(pv),'preview: name, rationale, targets');
 ok(/3 × 10 per leg/.test(pv),'per-leg label on the lunge');
 ok(/Unicorn Press.*not in the catalog/.test(pv),'unknown exercise flagged');
 ok(/Leg Press needs machine/.test(pv),'missing-kit exercise flagged');
 ok(/Each round|Dead Bug 10\/side/.test(pv),'circuit items shown');
 await p.click('#obAccept');await wt(500);
 ok(await p.evaluate(()=>PROG.source==='ai'&&PROG.name==='Recomp 3-day'&&Object.keys(PROG.days).length===3&&PROG.schedule.Wed==='B'),'AI plan active');
 ok(await p.evaluate(()=>PROG.days.C.ex[3].mode==='rounds'&&PROG.days.C.ex[3].items.length===2&&PROG.days.B.ex[3].mode==='time'&&PROG.days.B.ex[2].tgt.reps==='amrap'),'structured targets built (rounds/time/amrap)');
 ok(await p.evaluate(()=>SET.targets.kcal===2200&&SET.targets.kcalTrain===2350&&SET.goalWeight===77),'targets from the coach applied');
 ok(await p.evaluate(()=>PLANS.length===2&&curView==='coach'),'lands in Coach with 2 plans (default kept)');
 console.log('D. coach system prompt is profile-aware; edit profile from Settings');
 script=[{content:[{type:'text',text:'ok'}],stop_reason:'end_turn'}];
 await p.fill('#coachInput','hi');await p.click('#coachSendBtn');await wt(500);
 const cs=reqs[reqs.length-1].system[0].text;ok(/USER PROFILE/.test(cs)&&/dislikes oats/.test(cs)&&!/REFERENCE PLAN/.test(cs),'coach system uses the profile, not the owner baseline');
 await p.evaluate(()=>settingsModal());await p.waitForSelector('#stProfile');ok((await p.textContent('#modalRoot')).includes('45 y'),'settings shows profile summary');
 p.once('dialog',d=>d.dismiss());
 await p.click('#stProfile');await wt(200);ok(await p.evaluate(()=>curView==='onboard'&&OB.editing&&document.querySelector('#ob_age').value==='45'),'edit mode prefilled');
 for(let i=0;i<6;i++){await p.click('[data-obnext]');await wt(120);}
 await wt(300);ok(await p.evaluate(()=>curView==='coach'),'saving an edited profile returns to Coach');
 console.log('E. existing device with data is not forced through onboarding');
 const ctx2=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const p2=await ctx2.newPage();
 await p2.route('**/app/config.js',r=>r.fulfill({contentType:'application/javascript',body:`export const CONFIG={supabaseUrl:'',supabaseKey:''};`}));
 await p2.goto(APP);await p2.waitForSelector('#view-auth:not(.hidden)');await p2.click('#authSkip');await p2.waitForSelector('body[data-ready="1"]');
 ok(await p2.evaluate(()=>curView==='onboard'),'offline-only fresh device also onboards');
 await p2.evaluate(async()=>{await idbPut('measurements',{id:'m1',date:todayStr(),weight:80},true);});await p2.reload();await p2.waitForSelector('body[data-ready="1"]');
 ok(await p2.evaluate(()=>curView==='today'),'device with logged data → Today, no onboarding');
 await p2.click('.nav [data-nav="coach"]');await p2.waitForTimeout(300);ok(await p2.$('#coachTop [data-obstart]'),'Coach offers "Set up" instead');
 ok(!errs.length,'no console errors '+JSON.stringify(errs));
 await b.close();console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
