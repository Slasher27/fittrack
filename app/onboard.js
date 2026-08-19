/* ============================ PROFILE, ONBOARDING & PLAN GENERATION (v3 stage 5) ============================
   The user's original coaching prompt, as a 6-step conversation the app runs itself:
   you · goal · training · where you train (structured equipment) · food · lifestyle.
   Answers → kv `profile` (synced) + EQUIP + deterministic nutrition targets (Mifflin-St Jeor)
   → the coach generates a structured plan through ONE forced tool call (create_plan) which
   the app VALIDATES against the exercise catalog + equipment before showing a preview the
   user accepts. Offline / no coach: the deterministic targets + the default plan still work. */
let PROFILE=null;   // kv.profile.v
let OB={step:0,data:{},editing:false,gen:null};
const OB_STEPS=[['you','About you'],['goal','Your goal'],['training','Training now'],['gym','Where you train'],['food','Food'],['lifestyle','Lifestyle']];
const GEAR_OPTIONS=['squat rack','adjustable bench','flat bench','pull-up bar','dip station','high-to-low pulley','low pulley','skipping rope','plyo box','rings','TRX','EZ bar','trap bar','landmine','ab wheel','med ball','rower','bike','treadmill'];
const BAND_OPTIONS=['thin','light','medium','medium-large','large','heavy'];

async function loadProfile(){PROFILE=(await idbGet('kv','profile'))?.v||null;}
async function saveProfile(p){PROFILE=p;await idbPut('kv',{k:'profile',v:p});}
function needsOnboarding(hasData){return !PROFILE&&!hasData;}

/* ---------- deterministic nutrition (mirrors the original plan's method) ---------- */
function nutritionTargets(p){
  const w=+p.weightKg||80,h=+p.heightCm||175,a=+p.age||40,male=(p.sex||'male')!=='female';
  const bmr=Math.round(10*w+6.25*h-5*a+(male?5:-161));
  const act={low:1.3,moderate:1.45,active:1.6,very:1.75}[p.lifestyle?.activity||'moderate']||1.45;
  const tdee=Math.round(bmr*act);
  const goal=p.goal?.type||'recomp';
  const delta={fatloss:-500,recomp:-300,health:0,strength:0,muscle:+200}[goal]??-300;
  const kcal=Math.max(1400,Math.round((tdee+delta)/10)*10);
  const protein=Math.round(Math.min(2.4,2.2)*w);
  const fat=Math.round(Math.max(0.7,0.9)*w);
  const carbs=Math.max(80,Math.round((kcal-protein*4-fat*9)/4));
  const kcalTrain=goal==='recomp'||goal==='fatloss'?kcal+150:null;
  let goalWeight=p.goal?.goalWeight?+p.goal.goalWeight:null;
  if(!goalWeight&&p.bodyFat&&p.goal?.goalBodyFat){const lean=w*(1-p.bodyFat/100);goalWeight=Math.round(lean/(1-p.goal.goalBodyFat/100)*2)/2;}
  return{bmr,tdee,kcal,protein,carbs,fat,kcalTrain,goalWeight};
}
function profileSummary(p){ // compact text the coach reads instead of the owner's baseline plan
  if(!p)return '';
  const t=nutritionTargets(p);
  return `PROFILE: ${p.age}y ${p.sex}, ${p.heightCm} cm, ${p.weightKg} kg${p.bodyFat?`, ~${p.bodyFat}% body fat`:''}. Goal: ${p.goal?.type||'recomp'}${p.goal?.target?` — ${p.goal.target}`:''}${p.goal?.goalWeight?` (goal weight ${p.goal.goalWeight} kg)`:''}${p.goal?.timeframe?`, timeframe ${p.goal.timeframe}`:''}. Injuries/limits: ${p.injuries||'none'}.
TRAINING: ${p.training?.daysPerWeek||3} days/week (${(p.training?.days||[]).join('/')||'flexible'}), ~${p.training?.sessionMin||60} min, experience ${p.training?.experience||'intermediate'}. Currently: ${p.training?.current||'—'}. Gym: ${p.gymType||'home'}.
FOOD: protein preference ${p.diet?.protein||'meat'}; restrictions ${p.diet?.restrictions||'none'}; dislikes ${p.diet?.dislikes||'none'}; rules ${p.diet?.rules||'none'}; cooking ${p.diet?.cooking||'—'}; budget ${p.diet?.budget||'—'}.
LIFESTYLE: sleep ${p.lifestyle?.sleep||'?'} h, activity ${p.lifestyle?.activity||'moderate'}, alcohol ${p.lifestyle?.alcohol||'?'}, stress ${p.lifestyle?.stress||'?'}.
NUMBERS: BMR ${t.bmr} kcal, TDEE ~${t.tdee} kcal, target ${t.kcal} kcal (P ${t.protein} g · C ${t.carbs} g · F ${t.fat} g${t.kcalTrain?`, training days ${t.kcalTrain}`:''}). Weekly review day: ${p.reviewDay||'Sun'}.`;
}

/* ---------- onboarding UI ---------- */
/* fresh=true → brand-new person: the kit step starts EMPTY (the seeded default gym is the owner's, not theirs).
   Otherwise (owner setting up a profile later, or editing) the existing gym is kept. */
function startOnboarding(editing,fresh){
  OB={step:0,editing:!!editing,gen:null,data:editing&&PROFILE?JSON.parse(JSON.stringify(PROFILE)):{sex:'male',goal:{type:'recomp'},training:{daysPerWeek:3,days:['Mon','Wed','Fri'],sessionMin:60,experience:'intermediate'},gymType:'home',diet:{protein:'meat'},lifestyle:{activity:'moderate'},reviewDay:'Sun',equip:null}};
  if(!OB.data.equip)OB.data.equip=fresh?{bars:[{name:'Barbell',kg:20}],barKg:20,plates:[],dumbbells:[],kettlebells:[],bands:[],gear:[]}:JSON.parse(JSON.stringify(EQUIP));
  go('onboard');
}
function renderOnboard(){
  const d=OB.data,i=OB.step,[key,title]=OB_STEPS[i]||['done',''];
  const bar=`<div class="obbar">${OB_STEPS.map((s,ix)=>`<i class="${ix<i?'done':ix===i?'on':''}"></i>`).join('')}</div>`;
  const v=x=>x==null?'':esc(String(x));
  const chips=(name,opts,cur,multi)=>`<div class="chips">${opts.map(o=>`<button type="button" class="chip${(multi?(cur||[]).includes(o):cur===o)?' on':''}" data-obchip="${name}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  let body='';
  if(key==='you')body=`
    <div class="in2"><div><label class="fl">Age</label><input id="ob_age" type="number" inputmode="numeric" value="${v(d.age)}"></div><div><label class="fl">Sex</label>${chips('sex',['male','female'],d.sex)}</div></div>
    <div class="in2"><div><label class="fl">Height (cm)</label><input id="ob_h" type="number" inputmode="decimal" value="${v(d.heightCm)}"></div><div><label class="fl">Weight (kg)</label><input id="ob_w" type="number" inputmode="decimal" step="0.1" value="${v(d.weightKg)}"></div></div>
    <label class="fl">Body fat % (optional — leave blank and we track waist + photos)</label><input id="ob_bf" type="number" inputmode="decimal" placeholder="e.g. 22" value="${v(d.bodyFat)}">
    <label class="fl">Injuries or limitations</label><input id="ob_inj" placeholder="e.g. left knee — no deep lunges" value="${v(d.injuries)}">
    <label class="fl">Weekly review day</label>${chips('reviewDay',DAY_ORDER,d.reviewDay||'Sun')}`;
  else if(key==='goal')body=`
    <label class="fl">Main goal</label>${chips('goalType',['fatloss','recomp','strength','muscle','health'],d.goal?.type||'recomp')}
    <p class="xs muted" style="margin:4px 0 0">fatloss = lose fat fast · recomp = drop fat, keep/gain muscle · strength = get stronger · muscle = gain size · health = fitness, mobility, energy</p>
    <div class="in2" style="margin-top:8px"><div><label class="fl">Goal weight (kg, optional)</label><input id="ob_gw" type="number" inputmode="decimal" step="0.5" value="${v(d.goal?.goalWeight)}"></div><div><label class="fl">Goal body fat % (optional)</label><input id="ob_gbf" type="number" inputmode="decimal" value="${v(d.goal?.goalBodyFat)}"></div></div>
    <label class="fl">In your own words</label><input id="ob_target" placeholder="e.g. 15% body fat and a double-bodyweight squat" value="${v(d.goal?.target)}">
    <label class="fl">Timeframe</label><input id="ob_tf" placeholder="e.g. 16 weeks" value="${v(d.goal?.timeframe)}">`;
  else if(key==='training')body=`
    <label class="fl">Days per week</label>${chips('daysPerWeek',['2','3','4','5','6'],String(d.training?.daysPerWeek||3))}
    <label class="fl">Which days</label>${chips('days',DAY_ORDER,d.training?.days||[],true)}
    <label class="fl">Session length (min)</label>${chips('sessionMin',['30','45','60','75','90'],String(d.training?.sessionMin||60))}
    <label class="fl">Experience</label>${chips('experience',['beginner','intermediate','advanced'],d.training?.experience||'intermediate')}
    <label class="fl">What you do now</label><textarea id="ob_cur" rows="3" placeholder="e.g. 3× a week: skipping, kettlebell swings, squats, bench, deadlifts">${v(d.training?.current)}</textarea>`;
  else if(key==='gym'){const e=d.equip||{};body=`
    <label class="fl">Where do you train?</label>${chips('gymType',['home','commercial','both'],d.gymType||'home')}
    ${d.gymType==='commercial'?`<p class="sm muted">We’ll assume a fully equipped gym. You can still list anything you have at home in My gym later.</p>`:`
    <p class="xs muted" style="margin:6px 0 0">Your home kit — numbers separated by commas. Leave blank for none.</p>
    <div class="in2"><div><label class="fl">Barbell weight (kg)</label><input id="ob_bar" type="number" inputmode="decimal" placeholder="20" value="${v((e.bars||[])[0]?.kg??20)}"></div><div><label class="fl">Plates (kg×count)</label><input id="ob_plates" placeholder="1.25×2, 2.5×4, 5×6, 10×4, 20×4" value="${esc((e.plates||[]).map(p=>`${p.kg}×${p.n}`).join(', '))}"></div></div>
    <div class="in2"><div><label class="fl">Dumbbells (kg, pairs)</label><input id="ob_db" placeholder="2, 3, 6, 10" value="${esc((e.dumbbells||[]).join(', '))}"></div><div><label class="fl">Kettlebells (kg)</label><input id="ob_kb" placeholder="12, 16, 20, 24, 32" value="${esc((e.kettlebells||[]).join(', '))}"></div></div>
    <label class="fl">Bands</label>${chips('bands',BAND_OPTIONS,e.bands||[],true)}
    <label class="fl">Stations & gear</label>${chips('gear',GEAR_OPTIONS,e.gear||[],true)}`}`;}
  else if(key==='food')body=`
    <label class="fl">Protein preference</label>${chips('protein',['meat','fish','mixed','vegetarian','vegan'],d.diet?.protein||'meat')}
    <label class="fl">Allergies / restrictions</label><input id="ob_restr" placeholder="e.g. lactose, gluten, halal" value="${v(d.diet?.restrictions)}">
    <label class="fl">Dislikes</label><input id="ob_dis" placeholder="e.g. oats, mushrooms" value="${v(d.diet?.dislikes)}">
    <label class="fl">Rules</label><input id="ob_rules" placeholder="e.g. don't throw away egg yolks; no eating after 20:00" value="${v(d.diet?.rules)}">
    <div class="in2"><div><label class="fl">Cooking</label>${chips('cooking',['minimal','some','love it'],d.diet?.cooking||'some')}</div><div><label class="fl">Budget</label>${chips('budget',['tight','normal','flexible'],d.diet?.budget||'normal')}</div></div>
    <label class="fl">Where you shop</label><input id="ob_shops" placeholder="e.g. Woolworths, Checkers" value="${v(d.diet?.shops)}">`;
  else if(key==='lifestyle')body=`
    <label class="fl">Sleep (hours a night)</label>${chips('sleep',['<6','6','7','8','9+'],d.lifestyle?.sleep||'7')}
    <label class="fl">Daily activity outside training</label>${chips('activity',['low','moderate','active','very'],d.lifestyle?.activity||'moderate')}
    <p class="xs muted" style="margin:4px 0 0">low = desk job, little walking · moderate = some walking · active = on your feet · very = physical job</p>
    <label class="fl">Alcohol</label>${chips('alcohol',['none','occasional','weekly','most days'],d.lifestyle?.alcohol||'occasional')}
    <label class="fl">Stress</label>${chips('stress',['low','normal','high'],d.lifestyle?.stress||'normal')}
    <label class="fl">Anything else the coach should know?</label><textarea id="ob_notes" rows="2">${v(d.notes)}</textarea>`;
  $('#obBody').innerHTML=`${bar}<h2 class="vt" style="margin-bottom:4px">${title}</h2><p class="xs muted" style="margin:0 0 12px">Step ${i+1} of ${OB_STEPS.length}${OB.editing?' · editing your profile':''}</p>${body}
    <div class="btnrow" style="margin-top:18px">${i>0?'<button class="btn ghost" data-obprev>‹ Back</button>':'<button class="btn ghost" data-obcancel>Cancel</button>'}<button class="btn" data-obnext>${i===OB_STEPS.length-1?(OB.editing?'Save profile':'Finish'):'Next ›'}</button></div>`;
  window.scrollTo(0,0);
}
function obCollect(){
  const d=OB.data,g=id=>{const el=$('#'+id);return el?el.value.trim():undefined;};
  const key=OB_STEPS[OB.step][0];
  if(key==='you'){d.age=+g('ob_age')||undefined;d.heightCm=+g('ob_h')||undefined;d.weightKg=+g('ob_w')||undefined;d.bodyFat=+g('ob_bf')||undefined;d.injuries=g('ob_inj');}
  if(key==='goal'){d.goal=d.goal||{};d.goal.goalWeight=+g('ob_gw')||undefined;d.goal.goalBodyFat=+g('ob_gbf')||undefined;d.goal.target=g('ob_target');d.goal.timeframe=g('ob_tf');}
  if(key==='training'){d.training=d.training||{};d.training.current=g('ob_cur');}
  if(key==='gym'&&d.gymType!=='commercial'){const e=d.equip=d.equip||{};const nums=s=>String(s||'').split(/[,\s]+/).map(Number).filter(n=>n>0);
    const bar=+g('ob_bar');e.bars=bar>0?[{name:'Barbell',kg:bar}]:[];e.barKg=bar>0?bar:0;
    e.plates=String(g('ob_plates')||'').split(',').map(x=>x.trim()).filter(Boolean).map(x=>{const m=x.match(/([\d.]+)\s*[×x*]\s*(\d+)/);return m?{kg:+m[1],n:+m[2]}:null;}).filter(Boolean);
    e.dumbbells=nums(g('ob_db'));e.kettlebells=nums(g('ob_kb'));}
  if(key==='food'){d.diet=d.diet||{};d.diet.restrictions=g('ob_restr');d.diet.dislikes=g('ob_dis');d.diet.rules=g('ob_rules');d.diet.shops=g('ob_shops');}
  if(key==='lifestyle'){d.notes=g('ob_notes');}
}
function obChip(name,val){
  const d=OB.data;
  const single={sex:v=>d.sex=v,reviewDay:v=>d.reviewDay=v,goalType:v=>(d.goal=d.goal||{}).type=v,daysPerWeek:v=>(d.training=d.training||{}).daysPerWeek=+v,sessionMin:v=>(d.training=d.training||{}).sessionMin=+v,experience:v=>(d.training=d.training||{}).experience=v,gymType:v=>d.gymType=v,protein:v=>(d.diet=d.diet||{}).protein=v,cooking:v=>(d.diet=d.diet||{}).cooking=v,budget:v=>(d.diet=d.diet||{}).budget=v,sleep:v=>(d.lifestyle=d.lifestyle||{}).sleep=v,activity:v=>(d.lifestyle=d.lifestyle||{}).activity=v,alcohol:v=>(d.lifestyle=d.lifestyle||{}).alcohol=v,stress:v=>(d.lifestyle=d.lifestyle||{}).stress=v};
  const multi={days:()=>(d.training=d.training||{}),bands:()=>(d.equip=d.equip||{}),gear:()=>(d.equip=d.equip||{})};
  obCollect();
  if(single[name])single[name](val);
  else if(multi[name]){const o=multi[name]();const arr=o[name]||[];o[name]=arr.includes(val)?arr.filter(x=>x!==val):[...arr,val];if(name==='days')o.daysPerWeek=o.days.length||o.daysPerWeek;}
  renderOnboard();
}
async function obNext(){
  obCollect();
  const d=OB.data,key=OB_STEPS[OB.step][0];
  if(key==='you'&&(!d.age||!d.heightCm||!d.weightKg))return toast('Age, height and weight are needed for your targets');
  if(OB.step<OB_STEPS.length-1){OB.step++;renderOnboard();return;}
  await finishOnboarding();
}
async function finishOnboarding(){
  const d=OB.data;d.updatedAt=Date.now();if(!d.createdAt)d.createdAt=Date.now();
  // equipment → EQUIP (commercial: everything available)
  const e=d.equip||{};
  Object.assign(EQUIP,{bars:e.bars||EQUIP.bars,barKg:e.barKg??EQUIP.barKg,plates:e.plates||EQUIP.plates,dumbbells:e.dumbbells||EQUIP.dumbbells,kettlebells:e.kettlebells||EQUIP.kettlebells,bands:e.bands||EQUIP.bands,gear:e.gear||EQUIP.gear,commercial:d.gymType==='commercial'});
  delete d.equip; // lives in EQUIP, not the profile
  await idbPut('kv',{k:'equipment',v:EQUIP});
  // targets (deterministic) → settings; the coach may refine them in the generated plan
  const t=nutritionTargets(d);
  SET.targets={kcal:t.kcal,protein:t.protein,carbs:t.carbs,fat:t.fat,kcalTrain:t.kcalTrain||null};
  SET.startWeight=d.weightKg;if(t.goalWeight)SET.goalWeight=t.goalWeight;
  if(!SET.reviewDay||d.reviewDay)SET.reviewDay=d.reviewDay||'Sun';
  await saveSettings();
  await saveProfile(d);
  $('#calTarget').textContent=SET.targets.kcal;
  if(OB.editing){toast('Profile saved');go('coach');
    if(await confirmAsync('Your profile changed. Ask the coach to check whether your plan should change?'))coachOpenWith('My profile just changed — please review whether my plan or targets should change, and propose updates.');
    return;}
  renderGenerate();
}
function confirmAsync(msg){return Promise.resolve(confirm(msg));}

/* ---------- plan generation (one forced tool call, validated) ---------- */
const CREATE_PLAN_TOOL={name:'create_plan',description:'Create the user\'s complete training plan and nutrition targets from their profile. Use ONLY exercise names from the AVAILABLE EXERCISES list.',input_schema:{type:'object',properties:{
  planName:{type:'string'},description:{type:'string',description:'one line'},
  targets:{type:'object',properties:{kcal:{type:'integer'},protein:{type:'integer'},carbs:{type:'integer'},fat:{type:'integer'},kcalTrain:{type:'integer'}},required:['kcal','protein','carbs','fat']},
  goalWeight:{type:'number'},
  schedule:{type:'object',description:'weekday → day key, e.g. {"Mon":"A","Wed":"B","Fri":"C"}',additionalProperties:{type:'string'}},
  days:{type:'array',items:{type:'object',properties:{key:{type:'string',description:'A, B, C…'},title:{type:'string',description:'e.g. "Day A — Lower + Push (Mon)"'},exercises:{type:'array',items:{type:'object',properties:{name:{type:'string'},sets:{type:'integer'},repsMin:{type:'integer'},repsMax:{type:'integer'},amrap:{type:'boolean'},secs:{type:'integer'},rounds:{type:'integer'},items:{type:'array',items:{type:'object',properties:{name:{type:'string'},reps:{type:'integer'},secs:{type:'integer'},perSide:{type:'boolean'}},required:['name']}},perSide:{type:'boolean'},rest:{type:'integer'}},required:['name']}}},required:['key','title','exercises']}},
  rationale:{type:'string',description:'3–6 short sentences the user will read: why this plan, how to progress, what to watch'},
  weeklyFocus:{type:'array',items:{type:'string'},description:'up to 4 one-line habits'}
},required:['planName','targets','schedule','days','rationale']}};
function generateSystem(){
  const avail=Object.values(EXBYID).filter(c=>exAvailable(c)&&c.pattern!=='mobility').map(c=>c.name+(c.unilateral?' (per side)':'')+(c.metric==='time'?' (timed)':''));
  return `You are an evidence-based strength & nutrition coach building a plan inside FitTrack. Produce it with the create_plan tool — nothing else. Rules:
- Use ONLY names from AVAILABLE EXERCISES (they match the user's equipment). If commercial gym, the list is the full catalog.
- Days per week and weekdays exactly as the profile says; session length respected (roughly 5–7 exercises for 60 min).
- Full-body or upper/lower splits for ≤3 days; 4+ days may split further. Compound first, then accessories, a core/conditioning finisher where sensible.
- Structured targets: sets + repsMin/repsMax (strength 4–6, hypertrophy 8–12, accessories 12–15), or sets + secs for intervals, or rounds + items for circuits. Set rest (heavy compounds 150–180 s, presses/rows 90–120 s, isolation 60 s, intervals 20–30 s). Unilateral exercises: perSide true.
- Respect injuries/limitations and experience. Beginners: fewer exercises, more reps in reserve.
- Aim for ~10–15 hard sets per major muscle per week across the plan.
- Nutrition targets: start from the deterministic numbers in the profile (Mifflin-St Jeor) and adjust only with a reason; protein ≥ 2 g/kg for fat loss / recomp.
- Rationale in plain, direct language addressed to the user; no fluff.
AVAILABLE EXERCISES: ${avail.join('; ')}`;
}
function renderGenerate(){
  const t=nutritionTargets(OB.data);
  $('#obBody').innerHTML=`<h2 class="vt" style="margin-bottom:4px">Your plan</h2>
    <div class="card"><b>Your numbers</b><div class="sm" style="margin-top:4px">Maintenance ~${t.tdee} kcal · target <b>${t.kcal} kcal</b> · protein <b>${t.protein} g</b> · carbs ${t.carbs} g · fat ${t.fat} g${t.kcalTrain?` · training days ${t.kcalTrain} kcal`:''}${t.goalWeight?` · goal weight ~${t.goalWeight} kg`:''}</div><div class="xs muted" style="margin-top:4px">Mifflin-St Jeor with your activity level; the coach may fine-tune.</div></div>
    <div class="card"><b>Build my training plan</b><p class="sm" style="margin:4px 0 8px">${coachAvailable()?'The coach writes a plan for your days, kit, goal and limits — you review it before anything is saved.':'The coach needs a connection'+(authSignedIn()||SET.aiKey?'':' and a sign-in (or API key)')+'. You can start with the default 3-day plan and ask the coach later.'}</p>
      <label class="fl">Anything to add? (optional)</label><input id="obNote" placeholder="e.g. keep sessions under 45 min; I love kettlebells">
      <div class="btnrow" style="margin-top:12px"><button class="btn" id="obGen" ${coachAvailable()?'':'disabled'}>Generate with the coach</button><button class="btn ghost" id="obDefault">Use the default plan</button></div>
      <div id="obGenOut" style="margin-top:10px"></div></div>`;
  $('#obGen').onclick=()=>generatePlan($('#obNote').value.trim());
  $('#obDefault').onclick=async()=>{await adoptDefaultPlan();};
}
async function adoptDefaultPlan(){
  // keep whatever plan is active (fresh devices already have plan-default); make sure it exists
  if(!PLANS.length){await loadProgram();}
  toast('Using the default plan — ask the coach to tailor it any time');finishToApp();
}
function finishToApp(){OB.gen=null;go('coach');renderCoachTab();setTimeout(()=>{if(typeof checkPlanShares==='function')checkPlanShares();},600);}
async function generatePlan(note){
  const out=$('#obGenOut');out.innerHTML='<div class="msg ai thinking">Building your plan… this takes 20–60 seconds.</div>';$('#obGen').disabled=true;
  try{
    const prof=profileSummary(PROFILE||OB.data);
    const res=await coachRequest({kind:'onboard',effort:'high',max_tokens:8000,system:[{type:'text',text:generateSystem()}],
      messages:[{role:'user',content:`${prof}\n${note?`EXTRA FROM THE USER: ${note}\n`:''}Create my plan now with create_plan.`}],
      tools:[CREATE_PLAN_TOOL],tool_choice:{type:'tool',name:'create_plan'}});
    const use=(res.content||[]).find(b=>b.type==='tool_use');
    if(!use)throw new Error('The coach did not return a plan — try again.');
    const v=validateGeneratedPlan(use.input);
    OB.gen=v;renderPlanPreview(v);
  }catch(e){out.innerHTML=`<div class="msg ai err">⚠️ ${esc(e.message)}</div>`;$('#obGen').disabled=false;}
}
/* Resolve names to the catalog, fix per-side, flag anything the gym can't do. Never trust the model blindly. */
function validateGeneratedPlan(inp){
  const warnings=[];const days={};const order=[];
  for(const d of inp.days||[]){const key=String(d.key||'').trim().toUpperCase()||nextFreeKey(days);order.push(key);
    const ex=(d.exercises||[]).map(x=>{const e=toolExToProgEx(x);const c=exFind(e.name);
      if(!c)warnings.push(`"${e.name}" is not in the catalog — kept as a custom exercise`);
      else if(!exAvailable(c))warnings.push(`${c.name} needs ${exMissing(c).join(', ')} you don't have`);
      return e;});
    days[key]={title:d.title||`Day ${key}`,ex};}
  const schedule={};for(const[wd,k]of Object.entries(inp.schedule||{})){const K=String(k).toUpperCase();if(DAY_ORDER.includes(wd)&&days[K])schedule[wd]=K;}
  if(!Object.keys(schedule).length){const want=(OB.data.training?.days||['Mon','Wed','Fri']);order.forEach((k,i)=>{if(want[i])schedule[want[i]]=k;});}
  const t=inp.targets||{};const base=nutritionTargets(PROFILE||OB.data);
  const targets={kcal:+t.kcal||base.kcal,protein:+t.protein||base.protein,carbs:+t.carbs||base.carbs,fat:+t.fat||base.fat,kcalTrain:t.kcalTrain?+t.kcalTrain:base.kcalTrain||null};
  if(Math.abs(targets.kcal-base.kcal)>400)warnings.push(`Coach set ${targets.kcal} kcal vs ${base.kcal} from the formula — check the reasoning`);
  return{name:inp.planName||'My plan',description:inp.description||'',days,schedule,targets,goalWeight:inp.goalWeight?+inp.goalWeight:base.goalWeight,rationale:inp.rationale||'',weeklyFocus:inp.weeklyFocus||[],warnings};
}
function nextFreeKey(days){for(const c of 'ABCDEFGH')if(!days[c])return c;return 'X';}
function renderPlanPreview(v){
  $('#obBody').innerHTML=`<h2 class="vt" style="margin-bottom:4px">${esc(v.name)}</h2><p class="sm muted" style="margin:0 0 10px">${esc(v.description)}</p>
    <div class="card"><b>Why this plan</b><div class="sm" style="margin-top:4px">${mdLite(v.rationale)}</div>${v.weeklyFocus.length?`<ul class="sm" style="margin:6px 0 0 16px">${v.weeklyFocus.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:''}</div>
    <div class="card"><b>Targets</b><div class="sm" style="margin-top:4px">${v.targets.kcal} kcal · P ${v.targets.protein} g · C ${v.targets.carbs} g · F ${v.targets.fat} g${v.targets.kcalTrain?` · training days ${v.targets.kcalTrain}`:''}${v.goalWeight?` · goal ${v.goalWeight} kg`:''}</div></div>
    ${Object.entries(v.days).map(([k,d])=>`<div class="card"><b>${esc(d.title)}</b> <span class="xs muted">${Object.entries(v.schedule).filter(([,x])=>x===k).map(([wd])=>wd).join('/')}</span><ul class="sm" style="margin:6px 0 0 16px">${d.ex.map(e=>`<li><b>${esc(e.name)}</b> ${esc(exTargetText(e))} · rest ${restLabel(e.rest)}${e.items?`<br><span class="xs muted">${esc(itemsLabel(e.items))}</span>`:''}</li>`).join('')}</ul></div>`).join('')}
    ${v.warnings.length?`<div class="card" style="border-color:var(--danger)"><b>Check these</b><ul class="sm" style="margin:6px 0 0 16px">${v.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}
    <div class="btnrow" style="margin-top:8px"><button class="btn" id="obAccept">Use this plan</button><button class="btn ghost" id="obRedo">Change something</button></div>
    <div id="obRedoBox" class="hidden" style="margin-top:8px"><input id="obRedoNote" placeholder="e.g. no deadlifts, and move Day B to Thursday"><button class="btn sec" id="obRedoGo" style="margin-top:6px;width:100%">Regenerate</button></div>`;
  window.scrollTo(0,0);
  $('#obAccept').onclick=()=>acceptGeneratedPlan(v);
  $('#obRedo').onclick=()=>$('#obRedoBox').classList.toggle('hidden');
  $('#obRedoGo').onclick=()=>{const n=$('#obRedoNote').value.trim();renderGenerate();$('#obNote').value=n;generatePlan(n);};
}
async function acceptGeneratedPlan(v){
  const plan={id:'plan-'+uid(),name:v.name,description:v.description,days:v.days,schedule:v.schedule,source:'ai',createdAt:Date.now(),rationale:v.rationale,weeklyFocus:v.weeklyFocus};
  await idbPut('plans',plan);await setActivePlan(plan.id);
  SET.targets={...v.targets};if(v.goalWeight)SET.goalWeight=v.goalWeight;await saveSettings();$('#calTarget').textContent=SET.targets.kcal;
  toast('Plan saved — it’s your active plan');finishToApp();
}
function coachOpenWith(text){go('coach');setTimeout(()=>coachSend(text),50);}
