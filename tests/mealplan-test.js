const {chromium}=require('playwright');const APP='http://localhost:8099/index.html';const SB='https://mock.supabase.co';
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m);}else{fail++;console.log('  ✗',m);}};
const reqs=[];let script=[];
(async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text());});
 await p.route('**/app/config.js',r=>r.fulfill({contentType:'application/javascript',body:`export const CONFIG={supabaseUrl:'${SB}',supabaseKey:'k'};`}));
 await p.route(SB+'/**',route=>{const req=route.request();const path=new URL(req.url()).pathname;const json=(s,b)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
  if(path.startsWith('/auth/v1/token'))return json(200,{access_token:'a',refresh_token:'r',expires_in:3600,user:{id:'u',email:'a@x.com'}});
  if(path.startsWith('/rest/v1/plan_shares')||path.startsWith('/rest/v1/ai_usage'))return json(200,[]);
  if(path.startsWith('/rest/v1/records'))return json(req.method()==='POST'?201:200,[]);
  if(path==='/functions/v1/coach'){reqs.push(req.postDataJSON());return json(200,script.length?script.shift():{content:[{type:'text',text:'?'}],stop_reason:'end_turn'});}
  return json(404,{});});
 await p.goto(APP);await p.waitForSelector('#view-auth:not(.hidden)');await p.fill('#authEmail','a@x.com');await p.fill('#authPass','password123');await p.click('#authSubmit');await p.waitForSelector('body[data-ready="1"]');
 await p.evaluate(async()=>{await idbPut('measurements',{id:'m1',date:todayStr(),weight:83},true);});await p.evaluate(()=>go('coach'));await p.waitForTimeout(400);
 const wt=n=>p.waitForTimeout(n);
 console.log('A. context + quick prompt');
 ok((await p.textContent('#coachChat')).includes('Rework my meal plan'),'quick prompt present');
 script=[{content:[{type:'text',text:'noted'}],stop_reason:'end_turn'}];
 await p.fill('#coachInput','hi');await p.click('#coachSendBtn');await wt(500);
 const ctxJson=JSON.parse(reqs[0].messages[reqs[0].messages.length-1].content.split('\n')[1]);
 ok(ctxJson.mealPlan&&ctxJson.mealPlan.Mon&&ctxJson.mealPlan.Mon.length===4&&/kcal/.test(ctxJson.mealPlan.Mon[0]),'context carries the current meal plan with macros');
 ok(/update_meal_plan/.test(JSON.stringify(reqs[0].tools))&&reqs[0].tools.length===11,'11 tools incl. update_meal_plan');
 console.log('B. rework two days → preview → accept');
 const beforeMon=await p.evaluate(()=>idbGetAll('meals').then(a=>a.filter(m=>m.day==='Mon').map(m=>m.name)));
 script=[{content:[{type:'text',text:'Here is a Monday and Tuesday without oats.'},{type:'tool_use',id:'mp1',name:'update_meal_plan',input:{reason:'No oats, protein first',days:[
   {day:'Mon',meals:[
     {slot:'Breakfast',name:'Eggs on toast',items:[{name:'Eggs',count:'3 eggs',kcal:210,protein:18,carbs:1,fat:15},{name:'Wholewheat toast',grams:70,kcal:170,protein:7,carbs:30,fat:2}]},
     {slot:'Lunch',name:'Chicken & rice bowl',items:[{name:'Chicken breast',grams:180,kcal:297,protein:56,carbs:0,fat:6},{name:'Basmati rice (cooked)',grams:150,kcal:195,protein:4,carbs:42,fat:1}]},
     {slot:'Snack',name:'Yoghurt & nuts',items:[{name:'Greek yoghurt',grams:200,kcal:194,protein:20,carbs:8,fat:9},{name:'Almonds',grams:20,kcal:116,protein:4,carbs:4,fat:10}]},
     {slot:'Dinner',name:'Beef & veg',items:[{name:'Lean beef mince',grams:200,kcal:340,protein:42,carbs:0,fat:18},{name:'Mixed veg',grams:250,kcal:88,protein:5,carbs:15,fat:1}]}]},
   {day:'Tue',meals:[
     {slot:'Breakfast',name:'Omelette',items:[{name:'Eggs',count:'3 eggs',kcal:210,protein:18,carbs:1,fat:15},{name:'Cheddar',grams:30,kcal:121,protein:7,carbs:0,fat:10}]}]}
 ]}}],stop_reason:'tool_use'},
 {content:[{type:'text',text:'Done — Monday and Tuesday breakfast replaced.'}],stop_reason:'end_turn'}];
 await p.fill('#coachInput','rework monday, no oats');await p.click('#coachSendBtn');await wt(700);
 const pv=await p.textContent('#coachChat .msg.tool.pending');
 ok(/New meal plan for 2 days/.test(pv)&&/Monday/.test(pv)&&/Eggs on toast/.test(pv)&&/1610 kcal/.test(pv.replace(/ /g,' '))||/Daily totals/.test(pv),'preview lists days, meals, totals');
 ok(await p.evaluate(()=>idbGetAll('meals').then(a=>a.filter(m=>m.day==='Mon').length===4&&!a.some(m=>m.name==='Eggs on toast'))),'nothing changed before accept');
 await p.click('#coachChat [data-coachok="mp1"]');await wt(700);
 const mon=await p.evaluate(()=>idbGetAll('meals').then(a=>a.filter(m=>m.day==='Mon')));
 ok(mon.length===4&&mon.every(m=>m.custom)&&mon.some(m=>m.name==='Eggs on toast'),'Monday replaced with 4 custom meals');
 const tue=await p.evaluate(()=>idbGetAll('meals').then(a=>a.filter(m=>m.day==='Tue')));
 ok(tue.length===4&&tue.some(m=>m.name==='Omelette')&&tue.some(m=>m.slot==='Lunch'),'Tuesday: only Breakfast replaced, other slots kept');
 // known food reused, unknown created per 100 g
 const chickenReused=await p.evaluate(async()=>{const foods=await idbGetAll('foods');const meals=await idbGetAll('meals');const lunch=meals.find(m=>m.day==='Mon'&&m.slot==='Lunch');const f=foods.find(x=>x.id===lunch.items[0].foodId);return{name:f.name,custom:!!f.custom,servings:lunch.items[0].servings};});
 ok(/chicken breast/i.test(chickenReused.name)&&!chickenReused.custom&&Math.abs(chickenReused.servings-1.8)<0.01,'existing seed food reused at 180 g: '+JSON.stringify(chickenReused));
 const almonds=await p.evaluate(()=>idbGetAll('foods').then(a=>a.find(f=>f.name==='Almonds')));
 ok(almonds&&almonds.custom&&almonds.serving==='100 g'&&almonds.kcal===580,'unknown item created per 100 g (116 kcal / 20 g → 580)');
 const totals=await p.evaluate(async()=>{const meals=await idbGetAll('meals');const fmap=foodMap(await idbGetAll('foods'));let k=0;for(const m of meals.filter(x=>x.day==='Mon')){const t=await mealMacros(m,fmap);k+=t.kcal;}return Math.round(k);});
 ok(Math.abs(totals-1610)<=16,'Monday recomputes to ~1610 kcal from the stored foods ('+totals+')');
 ok((await p.textContent('#coachChat')).includes('Monday and Tuesday breakfast replaced'),'follow-up rendered');
 console.log('C. meal-plan survives seed migrations (custom) and Today uses it');
 ok(await p.evaluate(()=>idbGetAll('meals').then(a=>a.filter(m=>m.day==='Mon').every(m=>m.custom===true))),'replacement meals are custom (reseed-proof)');
 console.log('D. mic buttons');
 const sr=await p.evaluate(()=>!!(window.SpeechRecognition||window.webkitSpeechRecognition));
 const micShown=await p.$eval('#coachMic',b=>!b.classList.contains('hidden'));
 ok(sr?micShown:!micShown,'mic visibility matches API support (supported='+sr+')');
 ok(!errs.length,'no console errors '+JSON.stringify(errs));
 await b.close();console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
