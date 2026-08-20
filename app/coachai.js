/* ============================ AI COACH (v3 stage 4) ============================
   The Coach tab: a chat with Claude that can SEE your data (compact context snapshot) and
   CHANGE things through tools — every write renders a preview card you Accept or Discard
   before it happens. The agent loop runs here in the client because everything it touches
   lives in IndexedDB; the server (supabase/functions/coach) only holds the API key, checks
   your sign-in and quota, and forwards one request at a time.
   Transport: signed in → Edge Function; else your own API key from Settings (direct call,
   like the old Ask box); else the coach asks you to sign in. Offline → coach unavailable,
   everything else works. */
let CHAT=[];            // rendered transcript: {role:'user'|'assistant'|'tool', text?, tool?, status?, ts}
let CHAT_API=[];        // Anthropic messages[] we send back (user / assistant content blocks / tool_results)
let coachBusy=false,coachPending=null; // pending write tool awaiting Accept/Discard: {id,name,input,resolve}
const CHAT_MAX_TURNS=24;

/* ---------- transport ---------- */
function coachAvailable(){return navigator.onLine&&(authSignedIn()||!!SET.aiKey);}
async function coachRequest(payload){
  if(!navigator.onLine)throw new Error('You are offline — the coach needs a connection (logging and training work offline).');
  if(authSignedIn()){
    await ensureToken();
    const p=window.authProject?window.authProject():null;
    const s=await idbGet('kv','session');
    const url=(p?p.url:'').replace(/\/+$/,'')+'/functions/v1/coach';
    const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json',apikey:p?p.key:'',Authorization:'Bearer '+(s&&s.access||'')},body:JSON.stringify(payload)});
    const d=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(d.error||('coach request failed ('+res.status+')'));
    return d;
  }
  if(SET.aiKey){ // fallback: your own key, straight from the browser (no server involved)
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':SET.aiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-opus-5',max_tokens:payload.max_tokens||4000,output_config:{effort:'medium'},system:payload.system,messages:payload.messages,tools:payload.tools})});
    const d=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(d?.error?.message||('request failed ('+res.status+')'));
    return d;
  }
  throw new Error('Sign in (Settings → Account) or add an API key to use the coach.');
}

/* ---------- context the coach sees ---------- */
async function firedInsights(){
  const s=await computeStats();const dis=(await idbGet('kv','insightDismissals'))?.v||{};const fired=[];
  for(const r of INSIGHT_RULES){let res;try{res=r.check(s);}catch(e){continue;}if(!res)continue;const d=dis[r.id];if(d&&(parseD(todayStr())-parseD(d))/864e5<r.cd)continue;fired.push({id:r.id,sev:r.sev,t:res.t,b:res.b.replace(/<br\s*\/?>/gi,' · ').replace(/<[^>]+>/g,'')});}
  return{stats:s,fired};
}
async function coachContext(){
  const{stats:s,fired}=await firedInsights();
  const workouts=await idbGetAll('workouts');
  const wk=weeklyVolume(workouts,2);const thisWk=wk[wk.length-1],lastWk=wk[0];
  const recent=sortedWorkouts(workouts).slice(-3).map(w=>({date:w.date,day:w.title.split('—')[0].trim(),sets:sessionSummary(w).sets,prs:(w.prs||[]).map(p=>p.name+': '+p.text)}));
  const plan={name:PROG.name,schedule:PROG.schedule,days:Object.fromEntries(Object.entries(PROG.days).map(([k,d])=>[k,{title:d.title,exercises:d.ex.map(e=>({name:e.name,target:exTargetText(e),rest:e.rest,mode:e.mode,items:e.items?itemsLabel(e.items):undefined}))}]))};
  const eq={bars:(EQUIP.bars||[]).map(b=>`${b.name} ${b.kg}kg`),plates:(EQUIP.plates||[]).map(p=>`${p.n}×${p.kg}`),dumbbells:EQUIP.dumbbells,kettlebells:EQUIP.kettlebells,bands:EQUIP.bands,gear:EQUIP.gear};
  const mealsAll=await idbGetAll('meals');const fmapAll=foodMap(await idbGetAll('foods'));
  const mealPlan={};for(const m of mealsAll){if(!m.day||!m.slot)continue;const t=await mealMacros(m,fmapAll);(mealPlan[m.day]=mealPlan[m.day]||[]).push(`${m.slot}: ${m.name} (${rnd(t.kcal)} kcal, P${rnd(t.protein)})`);}
  const foodToday=await idbByDate('log',todayStr());
  const tk=foodToday.reduce((t,e)=>({kcal:t.kcal+e.kcal,protein:t.protein+e.protein}),{kcal:0,protein:0});
  return{
    today:todayStr(),weekday:DAY_ORDER[(parseD(todayStr()).getDay()+6)%7],
    targets:SET.targets,startWeight:SET.startWeight,goalWeight:SET.goalWeight,
    weight:{latest:s.lastWeigh?{kg:s.lastWeigh.weight,date:s.lastWeigh.date}:null,trendKgPerWeek:s.trend!=null?+s.trend.toFixed(2):null,daysSinceWeighIn:s.sinceWeigh},
    food:{avgKcalLast7LoggedDays:s.kcal7!=null?rnd(s.kcal7):null,loggedDays:s.days7.length,lowProteinDays:s.protLow,today:{kcal:rnd(tk.kcal),protein:rnd(tk.protein),entries:foodToday.length},waterTodayMl:s.waterMl},
    training:{thisWeek:{sessions:thisWk.sessions,plannedPerWeek:plannedPerWeek(),hardSets:thisWk.sets,setsByMuscle:thisWk.byMuscle,tonnageKg:rnd(thisWk.tonnage),prs:thisWk.prs},lastWeek:{sessions:lastWk.sessions,hardSets:lastWk.sets,setsByMuscle:lastWk.byMuscle,tonnageKg:rnd(lastWk.tonnage),prs:lastWk.prs},missedThisWeek:s.missed,recentSessions:recent},
    reviewDay:reviewDay(),
    plan,equipment:eq,mealPlan,
    coachInsights:fired.map(f=>`[${f.sev}] ${f.t} — ${f.b}`),
  };
}
function coachSystem(){return `You are the coach inside FitTrack, a personal strength & nutrition app. You talk to ONE person: the app's user, whose live data is in the CONTEXT block of each message. Be a real coach: direct, specific, warm, evidence-based, brief. Use their actual numbers. No greetings, no sign-offs, no bullet-point essays — a few sentences, or a short list only when it genuinely helps. Metric units. You are not a doctor: for pain, injury or medical issues, briefly advise a professional.

You can CHANGE things with tools. Every write tool shows the user a preview they must accept — so propose confidently, but call a tool only when the user asked for a change or clearly agreed to one you suggested. Never call a write tool just to demonstrate. Reads (exercise history, exercise search) are free — use them whenever a question is about a specific lift or you need to pick a substitute. Prefer exercises from the catalog (search first) that fit the user's equipment. Unilateral exercises are logged per side. When you replace a training day, send the COMPLETE exercise list for that day (the tool replaces it). Structured targets: sets + repsMin/repsMax (or amrap), or sets + secs for timed work, or rounds + items for circuits.

If the user tells you what they ate, estimate sensible macros per item (state it's an estimate) and log it. When rewriting their meal plan (update_meal_plan), keep each day within ~5% of the calorie target, protein at or above target, respect every dislike/restriction/rule, reuse their saved foods and recipes by exact name, and give grams for weight-based items (macros are for that amount). If they say they bought or lost equipment, update the gym and offer to adapt affected exercises. Keep the reference below in mind as the baseline; their live data in CONTEXT is what is true today.

${PROFILE?`USER PROFILE (from onboarding):
${profileSummary(PROFILE)}`:`REFERENCE PLAN (baseline):
${typeof PLAN_CONTEXT!=='undefined'?PLAN_CONTEXT:''}`}`;}

/* ---------- tools ---------- */
const COACH_TOOLS=[
 {name:'get_exercise_history',description:'Read-only. Your history with one exercise: sessions, best set, estimated 1RM, last 5 sessions.',input_schema:{type:'object',properties:{name:{type:'string',description:'Exercise name as in the plan or catalog'}},required:['name']}},
 {name:'search_exercises',description:'Read-only. Search the exercise catalog (318 entries) by name, muscle, or movement pattern. Returns matches with equipment, whether the user\'s gym can do them, and per-side flag.',input_schema:{type:'object',properties:{query:{type:'string'},onlyMyGym:{type:'boolean',description:'Only exercises the user\'s equipment supports (default true)'}},required:['query']}},
 {name:'update_training_day',description:'Replace one training day of the active plan with a complete new exercise list (or create a new day). Shown to the user as a preview to accept.',input_schema:{type:'object',properties:{dayKey:{type:'string',description:'A, B, C… (existing key to replace, or a new key to add)'},title:{type:'string',description:'e.g. "Day A — Lower + Push (Mon)"'},exercises:{type:'array',items:{type:'object',properties:{name:{type:'string'},sets:{type:'integer'},repsMin:{type:'integer'},repsMax:{type:'integer'},amrap:{type:'boolean'},secs:{type:'integer',description:'work seconds for timed intervals'},rounds:{type:'integer',description:'for circuits'},items:{type:'array',description:'circuit items',items:{type:'object',properties:{name:{type:'string'},reps:{type:'integer'},secs:{type:'integer'},perSide:{type:'boolean'}},required:['name']}},perSide:{type:'boolean'},rest:{type:'integer',description:'rest seconds'}},required:['name']}},reason:{type:'string',description:'One line the user will see explaining the change'}},required:['dayKey','exercises','reason']}},
 {name:'swap_exercise',description:'Swap one exercise in a training day for another, keeping its sets/reps/rest. Preview → accept.',input_schema:{type:'object',properties:{dayKey:{type:'string'},from:{type:'string'},to:{type:'string'},reason:{type:'string'}},required:['dayKey','from','to','reason']}},
 {name:'update_schedule',description:'Change which weekday each training day is on, e.g. {"Mon":"A","Wed":"B","Fri":"C"}. Preview → accept.',input_schema:{type:'object',properties:{schedule:{type:'object',additionalProperties:{type:'string'}},reason:{type:'string'}},required:['schedule','reason']}},
 {name:'log_food',description:'Log what the user ate/drank as one or more items with estimated macros. Preview → accept.',input_schema:{type:'object',properties:{meal:{type:'string',enum:['breakfast','lunch','snack','dinner']},date:{type:'string',description:'YYYY-MM-DD, default today'},items:{type:'array',items:{type:'object',properties:{name:{type:'string'},grams:{type:'number'},kcal:{type:'number'},protein:{type:'number'},carbs:{type:'number'},fat:{type:'number'}},required:['name','kcal','protein','carbs','fat']}}},required:['meal','items']}},
 {name:'log_water',description:'Add water in ml for today. Preview → accept.',input_schema:{type:'object',properties:{ml:{type:'integer'}},required:['ml']}},
 {name:'log_weight',description:'Record a bodyweight (and optionally waist) measurement. Preview → accept.',input_schema:{type:'object',properties:{kg:{type:'number'},waistCm:{type:'number'},date:{type:'string'}},required:['kg']}},
 {name:'update_targets',description:'Change daily calorie/macro targets. Preview → accept.',input_schema:{type:'object',properties:{kcal:{type:'integer'},protein:{type:'integer'},carbs:{type:'integer'},fat:{type:'integer'},kcalTrain:{type:'integer',description:'training-day calories (optional)'},reason:{type:'string'}},required:['reason']}},
 {name:'update_meal_plan',description:'Replace the meal plan for one or more days. Each meal lists items with grams and macros for that amount. The user previews and accepts. Honour their diet profile (dislikes, restrictions, rules) and calorie/protein targets; reuse their saved foods/recipes where the names match.',input_schema:{type:'object',properties:{days:{type:'array',items:{type:'object',properties:{day:{type:'string',enum:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']},meals:{type:'array',items:{type:'object',properties:{slot:{type:'string',enum:['Breakfast','Lunch','Snack','Dinner']},name:{type:'string'},items:{type:'array',items:{type:'object',properties:{name:{type:'string'},grams:{type:'number'},count:{type:'string',description:'for countables, e.g. "3 eggs" — leave grams for weight foods'},kcal:{type:'number'},protein:{type:'number'},carbs:{type:'number'},fat:{type:'number'}},required:['name','kcal','protein','carbs','fat']}}},required:['slot','name','items']}}},required:['day','meals']}},reason:{type:'string'}},required:['days','reason']}},
 {name:'update_equipment',description:'Change the user\'s gym inventory. Provide only the categories that change; each replaces that category. Preview → accept.',input_schema:{type:'object',properties:{dumbbells:{type:'array',items:{type:'number'}},kettlebells:{type:'array',items:{type:'number'}},bands:{type:'array',items:{type:'string'}},gear:{type:'array',items:{type:'string'}},barKg:{type:'number'},plates:{type:'array',items:{type:'object',properties:{kg:{type:'number'},n:{type:'integer'}},required:['kg','n']}},reason:{type:'string'}},required:['reason']}},
];
const READ_TOOLS=new Set(['get_exercise_history','search_exercises']);

/* Read tools run immediately. */
async function runReadTool(name,input){
  if(name==='get_exercise_history'){
    const ws=await idbGetAll('workouts');const h=exerciseHistory(ws,input.name);const b=exerciseBests(h);
    return JSON.stringify({exercise:input.name,catalog:exFind(input.name)?exFind(input.name).id:null,sessions:h.length,bestSet:b.bestW,estimated1RM:b.bestE?b.bestE.e1rm:null,longestSecs:b.bestSec?b.bestSec.secs:null,last5:h.slice(-5).map(x=>({date:x.date,sets:x.sets.map(fmtSet)}))});}
  if(name==='search_exercises'){
    const q=exKey(input.query||'');const only=input.onlyMyGym!==false;
    const hits=Object.values(EXBYID).filter(c=>exKey(c.name).includes(q)||(c.aliases||[]).some(a=>exKey(a).includes(q))||(c.primary||[]).some(m=>m.includes(q))||c.pattern.includes(q)).filter(c=>!only||exAvailable(c)).slice(0,15)
      .map(c=>({name:c.name,pattern:c.pattern,muscles:c.primary,equipment:c.equipment,available:exAvailable(c),perSide:c.unilateral,timed:c.metric==='time',rest:c.defaultRest}));
    return JSON.stringify({query:input.query,matches:hits});}
  return 'unknown tool';
}
/* Write tools: preview text + apply function. */
function toolExToProgEx(x){
  const name=(exFind(x.name)||{}).name||x.name;const c=exFind(name);
  let tgt,mode='reps',items;
  if(x.rounds||x.items){mode='rounds';tgt={rounds:x.rounds||3};items=(x.items||[]).map(i=>({name:(exFind(i.name)||{}).name||i.name,reps:i.reps,secs:i.secs,perSide:!!i.perSide}));}
  else if(x.secs){mode='time';tgt={sets:x.sets||8,secs:x.secs};}
  else if(x.amrap)tgt={sets:x.sets||3,reps:'amrap'};
  else{const mn=x.repsMin||x.repsMax||8,mx=x.repsMax||x.repsMin||mn;tgt={sets:x.sets||3,reps:{min:mn,max:Math.max(mx,mn)}};}
  const perSide=mode==='reps'&&(x.perSide!=null?!!x.perSide:isUnilateral(name));
  const e={name,tgt,mode,perSide,items,type:c?(c.equipment.includes('barbell')?(c.region==='lower'?'barbell-lower':'barbell-upper'):c.equipment.includes('dumbbell')?'dumbbell':c.equipment.includes('kettlebell')?'kettlebell':c.equipment.includes('band')?'band':c.loadType==='bw'||c.loadType==='bw+'?'bodyweight':'other'):'other'};
  e.rest=x.rest||(c?c.defaultRest:defaultRest(e));
  e.target=targetLabel(tgt,perSide?sideWord(name):false);
  return e;
}
function previewFor(name,input){
  const li=a=>a.map(x=>`<li>${x}</li>`).join('');
  if(name==='update_training_day'){const exs=input.exercises.map(toolExToProgEx);const cur=PROG.days[input.dayKey];
    return{title:`${cur?'Replace':'Add'} training day ${input.dayKey}${input.title?` — ${esc(input.title)}`:''}`,html:`<p class="sm">${esc(input.reason||'')}</p>${cur?`<div class="xs muted">Now: ${cur.ex.map(e=>esc(e.name)).join(' · ')}</div>`:''}<ul class="sm" style="margin:6px 0 0 16px">${li(exs.map(e=>`<b>${esc(e.name)}</b> ${esc(exTargetText(e))} · rest ${restLabel(e.rest)}${e.items?`<br><span class="xs muted">${esc(itemsLabel(e.items))}</span>`:''}`))}</ul>`,
      apply:async()=>{PROG.days[input.dayKey]={title:input.title||(cur?cur.title:`Day ${input.dayKey}`),ex:exs};await saveProgram();renderTrainStart();renderToday();return`Training day ${input.dayKey} updated with ${exs.length} exercises`;}};}
  if(name==='swap_exercise'){const d=PROG.days[input.dayKey];const i=d?d.ex.findIndex(e=>exKey(e.name)===exKey(input.from)||exIdOf(e.name)===exIdOf(input.from)):-1;const to=(exFind(input.to)||{}).name||input.to;
    if(i<0)return{title:'Swap exercise',html:`<p class="sm">Couldn’t find <b>${esc(input.from)}</b> in day ${esc(input.dayKey)}.</p>`,apply:async()=>`Nothing changed — ${input.from} not found in day ${input.dayKey}`};
    return{title:`Swap ${esc(d.ex[i].name)} → ${esc(to)}`,html:`<p class="sm">${esc(input.reason||'')}</p><div class="xs muted">Keeps ${esc(exTargetText(d.ex[i]))} · rest ${restLabel(d.ex[i].rest||90)}</div>`,
      apply:async()=>{const e=d.ex[i];e.name=to;e.perSide=isUnilateral(to);const c=exFind(to);if(c&&c.metric==='time'&&e.mode==='reps'){e.mode='time';e.tgt={sets:e.tgt?.sets||8,secs:40};}e.target=targetLabel(e.tgt,e.perSide?sideWord(to):false);await saveProgram();renderTrainStart();renderToday();return`Swapped ${input.from} for ${to} in day ${input.dayKey}`;}};}
  if(name==='update_schedule')return{title:'Change training schedule',html:`<p class="sm">${esc(input.reason||'')}</p><div class="sm">${Object.entries(input.schedule).map(([d,k])=>`${esc(d)} → Day ${esc(k)}`).join(' · ')||'no training days'}</div>`,
      apply:async()=>{PROG.schedule=Object.fromEntries(Object.entries(input.schedule).filter(([d,k])=>DAY_ORDER.includes(d)&&PROG.days[k]));await saveProgram();renderTrainStart();renderToday();return'Schedule updated';}};
  if(name==='log_food'){const date=input.date||curDate||todayStr();const tot=input.items.reduce((t,i)=>({kcal:t.kcal+(+i.kcal||0),protein:t.protein+(+i.protein||0)}),{kcal:0,protein:0});
    return{title:`Log ${input.meal} · ${rnd(tot.kcal)} kcal · ${rnd(tot.protein)} g protein`,html:`<ul class="sm" style="margin:0 0 0 16px">${li(input.items.map(i=>`${esc(i.name)}${i.grams?` (${i.grams} g)`:''} — ${rnd(i.kcal)} kcal · P${rnd(i.protein)} C${rnd(i.carbs)} F${rnd(i.fat)}`))}</ul><div class="xs muted" style="margin-top:4px">${niceDate(date)} · estimates</div>`,
      apply:async()=>{for(const i of input.items)await idbPut('log',{id:uid(),date,meal:input.meal,foodId:null,name:i.name,serving:i.grams?`${i.grams} g`:'1 serving',servings:1,kcal:rnd(i.kcal),protein:rnd(i.protein),carbs:rnd(i.carbs),fat:rnd(i.fat),ts:Date.now(),estimated:true});renderToday();return`Logged ${input.items.length} item(s) to ${input.meal} on ${date}`;}};}
  if(name==='log_water')return{title:`Add ${input.ml} ml water`,html:'',apply:async()=>{await idbPut('water',{id:uid(),date:todayStr(),ml:+input.ml,ts:Date.now()});renderToday();return`Added ${input.ml} ml`;}};
  if(name==='log_weight'){const date=input.date||todayStr();return{title:`Weigh-in ${input.kg} kg${input.waistCm?` · waist ${input.waistCm} cm`:''}`,html:`<div class="xs muted">${niceDate(date)}</div>`,
      apply:async()=>{await idbPut('measurements',{id:uid(),date,weight:+input.kg,waist:input.waistCm?+input.waistCm:undefined});renderToday();return`Recorded ${input.kg} kg on ${date}`;}};}
  if(name==='update_targets'){const T={...SET.targets};['kcal','protein','carbs','fat','kcalTrain'].forEach(k=>{if(input[k]!=null)T[k]=+input[k];});
    return{title:'Update daily targets',html:`<p class="sm">${esc(input.reason||'')}</p><div class="sm">${T.kcal} kcal · P ${T.protein} g · C ${T.carbs} g · F ${T.fat} g${T.kcalTrain?` · training days ${T.kcalTrain} kcal`:''}</div><div class="xs muted">was ${SET.targets.kcal} kcal · P ${SET.targets.protein} · C ${SET.targets.carbs} · F ${SET.targets.fat}</div>`,
      apply:async()=>{SET.targets=T;await saveSettings();$('#calTarget').textContent=SET.targets.kcal;renderToday();return'Targets updated';}};}
  if(name==='update_meal_plan'){
    const days=input.days||[];
    const dayHtml=days.map(d=>{const meals=(d.meals||[]);return `<div style="margin-top:6px"><b>${esc(DAY_FULL[d.day]||d.day)}</b>${meals.map(m=>{const t=m.items.reduce((x,i)=>({k:x.k+(+i.kcal||0),p:x.p+(+i.protein||0)}),{k:0,p:0});
      return `<div class="sm" style="margin-left:8px"><b>${esc(m.slot)}:</b> ${esc(m.name)} <span class="muted">— ${rnd(t.k)} kcal · P ${rnd(t.p)}</span><br><span class="xs muted">${m.items.map(i=>esc(i.name)+(i.grams?` ${i.grams} g`:i.count?` (${esc(i.count)})`:'')).join(' · ')}</span></div>`;}).join('')}</div>`;}).join('');
    const totals=days.map(d=>{const t=(d.meals||[]).flatMap(m=>m.items).reduce((x,i)=>({k:x.k+(+i.kcal||0),p:x.p+(+i.protein||0)}),{k:0,p:0});return `${d.day} ${rnd(t.k)} kcal / P ${rnd(t.p)}`;}).join(' · ');
    return{title:`New meal plan for ${days.length} day${days.length>1?'s':''}`,html:`<p class="sm">${esc(input.reason||'')}</p>${dayHtml}<div class="xs muted" style="margin-top:6px">Daily totals: ${esc(totals)}</div>`,
      apply:async()=>{
        const foods=await idbGetAll('foods');
        const byName=n=>foods.find(f=>f.name.toLowerCase()===String(n).toLowerCase());
        const existing=await idbGetAll('meals');
        for(const d of days){
          const slots=new Set((d.meals||[]).map(m=>m.slot));
          for(const old of existing)if(old.day===d.day&&slots.has(old.slot))await idbDel('meals',old.id);
          for(const m of d.meals||[]){
            const items=[];
            for(const it of m.items){
              let f=byName(it.name);
              if(f&&it.grams&&servingUnit(f.serving)){items.push({foodId:f.id,servings:it.grams/servingUnit(f.serving).base});continue;}
              if(f&&!it.grams){items.push({foodId:f.id,servings:1});continue;}
              // unknown item → create a custom food (per 100 g when grams known, else 1 serving)
              const nf={id:uid(),name:it.name,group:'Mine',serving:'1 serving',kcal:rnd(it.kcal),protein:rnd(it.protein),carbs:rnd(it.carbs),fat:rnd(it.fat),custom:true,estimated:true};
              if(it.grams){const k=100/it.grams;Object.assign(nf,{serving:'100 g',kcal:rnd(it.kcal*k),protein:rnd(it.protein*k),carbs:rnd(it.carbs*k),fat:rnd(it.fat*k)});}
              await idbPut('foods',nf);foods.push(nf);
              items.push({foodId:nf.id,servings:it.grams?it.grams/100:1});
            }
            await idbPut('meals',{id:uid(),day:d.day,slot:m.slot,name:m.name,items,custom:true});
          }
        }
        if(typeof renderToday==='function')renderToday();
        return `Meal plan replaced for ${days.map(d=>d.day).join(', ')} (${days.reduce((n,d)=>n+(d.meals||[]).length,0)} meals). New items were saved as foods.`;}};}
  if(name==='update_equipment'){const ch=[];for(const k of ['dumbbells','kettlebells','bands','gear','plates','barKg'])if(input[k]!=null)ch.push(`<b>${k}</b>: ${Array.isArray(input[k])?input[k].map(x=>typeof x==='object'?`${x.n}×${x.kg}`:x).join(', '):input[k]}`);
    return{title:'Update my gym',html:`<p class="sm">${esc(input.reason||'')}</p><div class="sm">${ch.join('<br>')||'no changes'}</div>`,
      apply:async()=>{for(const k of ['dumbbells','kettlebells','bands','gear','plates'])if(input[k]!=null)EQUIP[k]=input[k];if(input.barKg!=null){EQUIP.barKg=+input.barKg;EQUIP.bars=[{name:'Barbell',kg:+input.barKg}];}await saveEquip();return'Gym updated';}};}
  return{title:name,html:'',apply:async()=>'ok'};
}

/* ---------- the loop ---------- */
async function coachSend(text,opts={}){
  if(coachBusy)return;text=(text||'').trim();if(!text)return;
  const inp=$('#coachInput');if(inp)inp.value='';
  CHAT.push({role:'user',text:opts.label||text,ts:Date.now()});renderChat();
  const ctx=await coachContext();
  CHAT_API.push({role:'user',content:`CONTEXT (live data, JSON):\n${JSON.stringify(ctx)}\n\nUSER: ${text}`});
  await coachLoop(opts);
}
/* ---------- weekly review ---------- */
function reviewDay(){return (PROFILE&&PROFILE.reviewDay)||SET.reviewDay||'Sun';}
function reviewWeekKey(today){ // the most recent review day on/before today → that week's key
  today=today||todayStr();const want=DAY_ORDER.indexOf(reviewDay());const d=parseD(today);
  for(let i=0;i<7;i++){const x=new Date(d);x.setDate(d.getDate()-i);if((x.getDay()+6)%7===want)return dstr(x);}
  return today;
}
async function reviewDue(){
  const key=reviewWeekKey();const last=(await idbGet('kv','lastReview'))?.v;
  if(last===key)return false;
  const ws=await idbGetAll('workouts');const cut=addDays(todayStr(),-14);
  return ws.some(w=>w.date>=cut)||(await idbGetAll('log')).some(e=>e.date>=cut);
}
const REVIEW_PROMPT=`It's weekly review time. Using CONTEXT (and get_exercise_history for my main lifts if it helps), give me my review in this order, tight and specific (about 150 words of text): 1) adherence — sessions vs planned, logged food days, water; 2) weight trend vs the pace my goal needs; 3) calories and protein vs targets; 4) training — hard sets per muscle vs 10–15, PBs, anything stalling; 5) the 2–4 most important changes for next week — and where a change is to my plan, targets or schedule, propose it with a tool so I can accept it. End with one line on what to focus on this week.`;
async function runWeeklyReview(){
  if(coachBusy)return;
  await coachSend(REVIEW_PROMPT,{kind:'review',effort:'high',label:'📋 Weekly review'});
  const key=reviewWeekKey();const last=[...CHAT].reverse().find(m=>m.role==='assistant'&&!m.err);
  await idbPut('kv',{k:'lastReview',v:key});
  const reviews=(await idbGet('kv','reviews'))?.v||[];reviews.push({week:key,at:Date.now(),text:last?last.text:''});
  await idbPut('kv',{k:'reviews',v:reviews.slice(-26)});
  renderCoachTab();
}
async function coachLoop(opts={}){
  coachBusy=true;renderChat();
  try{
    for(let hop=0;hop<6;hop++){
      // keep the transcript bounded; tool_use/result pairs must not be split, so trim on user boundaries
      while(CHAT_API.length>CHAT_MAX_TURNS){const i=CHAT_API.findIndex((m,ix)=>ix>0&&m.role==='user'&&typeof m.content==='string');if(i<1)break;CHAT_API.splice(0,i);}
      const res=await coachRequest({kind:opts.kind||'chat',effort:opts.effort,system:[{type:'text',text:coachSystem(),cache_control:{type:'ephemeral'}}],messages:CHAT_API,tools:COACH_TOOLS,max_tokens:opts.kind==='review'?6000:4000});
      if(res.stop_reason==='refusal'){CHAT.push({role:'assistant',text:'I can’t help with that one.',ts:Date.now()});break;}
      const content=res.content||[];
      CHAT_API.push({role:'assistant',content});
      const texts=content.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
      if(texts)CHAT.push({role:'assistant',text:texts,ts:Date.now()});
      const uses=content.filter(b=>b.type==='tool_use');
      if(!uses.length||res.stop_reason!=='tool_use'){break;}
      const results=[];
      for(const u of uses){
        if(READ_TOOLS.has(u.name)){const out=await runReadTool(u.name,u.input||{});CHAT.push({role:'tool',tool:u.name,status:'read',text:u.name==='get_exercise_history'?`Looked up ${u.input.name}`:`Searched exercises: ${u.input.query}`,ts:Date.now()});results.push({type:'tool_result',tool_use_id:u.id,content:out});continue;}
        // write tool → preview → wait for the user
        const pv=previewFor(u.name,u.input||{});
        const entry={role:'tool',tool:u.name,status:'pending',title:pv.title,html:pv.html,ts:Date.now(),id:u.id};
        let resolveFn;const wait=new Promise(r=>{resolveFn=r;});coachPending={id:u.id,resolve:resolveFn};
        CHAT.push(entry);renderChat();
        const decision=await wait;
        coachPending=null;
        if(decision==='accept'){let msg;try{msg=await pv.apply();entry.status='applied';}catch(e){msg='Failed: '+e.message;entry.status='failed';}results.push({type:'tool_result',tool_use_id:u.id,content:msg});}
        else{entry.status='declined';results.push({type:'tool_result',tool_use_id:u.id,content:'The user declined this change. Do not retry it; ask what they would prefer, briefly.'});}
        renderChat();
      }
      CHAT_API.push({role:'user',content:results});
    }
  }catch(e){CHAT.push({role:'assistant',text:'⚠️ '+e.message,ts:Date.now(),err:true});}
  finally{coachBusy=false;await idbPut('kv',{k:'coachChat',v:{chat:CHAT.slice(-60),api:CHAT_API.slice(-CHAT_MAX_TURNS)}});renderChat();}
}
function coachDecide(id,decision){if(coachPending&&coachPending.id===id)coachPending.resolve(decision);}

/* ---------- UI ---------- */
async function renderCoachTab(){
  if(!CHAT.length){const saved=(await idbGet('kv','coachChat'))?.v;if(saved){CHAT=saved.chat||[];CHAT_API=saved.api||[];}}
  const{fired}=await firedInsights();
  const wd=DAY_ORDER[(parseD(todayStr()).getDay()+6)%7];const dk=PROG.schedule[wd];
  const due=await reviewDue();const{stats:st}=await firedInsights();
  const wk=weeklyVolume(await idbGetAll('workouts'),1)[0];
  const reviewCard=due?`<div class="card" style="margin-bottom:10px;border-color:var(--volt)"><div class="row between" style="gap:10px"><div><b>📋 Your weekly review is ready</b><div class="xs muted">Adherence, weight trend, food, training, and what to change next week. ${coachAvailable()?'':'Needs the coach online.'}</div></div><button class="btn sm" data-review ${coachAvailable()?'':'disabled'}>Run review</button></div></div>`:'';
  const progress=`<div class="card" style="margin-bottom:10px"><div class="row between"><b>Progress</b><span class="xs muted">review day ${reviewDay()}</span></div>
    <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">
      <span class="pill">⚖ ${st.lastWeigh?st.lastWeigh.weight+' kg':'no weigh-in'}${st.trend!=null?` · ${st.trend>0?'+':''}${st.trend.toFixed(1)} kg/wk`:''}</span>
      <span class="pill">🏋️ ${wk.sessions}${plannedPerWeek()?'/'+plannedPerWeek():''} this week · ${wk.sets} sets${wk.prs?` · ${wk.prs} PB`:''}</span>
      <span class="pill">🍽 ${st.kcal7!=null?rnd(st.kcal7)+' kcal avg':'no food logged'}</span></div>
    <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="pillbtn" data-nav="body">Weight &amp; photos ›</button><button class="pillbtn" data-nav="train">Training ›</button><button class="pillbtn" data-nav="food">Food ›</button></div></div>`;
  $('#coachTop').innerHTML=reviewCard+progress+`<div class="card" style="margin-bottom:10px"><div class="xs muted" style="letter-spacing:.06em;text-transform:uppercase">Today · ${wd}</div>
    <div class="sm" style="margin-top:2px">${dk&&PROG.days[dk]?`Training day: <b>${esc(PROG.days[dk].title.split('—')[0].trim())}</b> — ${esc((PROG.days[dk].title.split('—')[1]||'').trim())}`:'Rest day — eat to target, walk, sleep.'}</div>
    ${fired.length?`<div style="margin-top:8px">${fired.slice(0,3).map(f=>`<div class="insight ${f.sev}"><div><div class="n">${f.t}</div><div class="s">${f.b}</div></div></div>`).join('')}</div>`:'<div class="sm muted" style="margin-top:6px">Nothing to flag right now — keep going.</div>'}
    ${PROFILE?'':`<div class="row between" style="margin-top:10px;gap:10px"><div class="sm"><b>Tell the coach about you</b><div class="xs muted">Age, goal, kit, food — 2 minutes; then it can build and adapt your plan.</div></div><button class="btn sm" data-obstart>Set up</button></div>`}
    <div class="xs muted" style="margin-top:8px">${coachAvailable()?'Ask the coach anything below — it sees your data and can change your plan (you approve every change).':navigator.onLine?'Sign in (Settings → Account) or add an API key to chat with the coach.':'Offline — chat unavailable; everything else works.'}</div></div>`;
  renderChat();
}
function renderChat(){
  const el=$('#coachChat');if(!el)return;
  const quick=['How am I doing this week?','What should I focus on today?','I ate something not on the plan','Swap an exercise for me','Rework my meal plan','Bought new equipment'];
  el.innerHTML=(CHAT.length?CHAT.map(m=>{
    if(m.role==='user')return`<div class="msg me">${esc(m.text)}</div>`;
    if(m.role==='assistant')return`<div class="msg ai${m.err?' err':''}">${mdLite(m.text)}</div>`;
    if(m.status==='read')return`<div class="msg sys">${esc(m.text)}</div>`;
    return`<div class="msg card tool ${m.status}"><div class="row between"><b>${m.title}</b><span class="badge">${m.status==='pending'?'Preview':m.status==='applied'?'✓ Applied':m.status==='declined'?'Discarded':'Failed'}</span></div>${m.html||''}${m.status==='pending'?`<div class="btnrow" style="margin-top:10px"><button class="btn" data-coachok="${m.id}">Accept</button><button class="btn ghost" data-coachno="${m.id}">Discard</button></div>`:''}</div>`;
  }).join(''):`<div class="empty" style="margin:8px 0">Try: ${quick.map(q=>`<button class="chip" data-coachq="${esc(q)}">${esc(q)}</button>`).join(' ')}</div>`)
  +(coachBusy&&!coachPending?'<div class="msg ai thinking">Thinking…</div>':'');
  const box=$('#view-coach');if(box&&CHAT.length)requestAnimationFrame(()=>window.scrollTo(0,document.body.scrollHeight));
}
async function coachClear(){if(!confirm('Clear this conversation? Your data and plan are untouched.'))return;CHAT=[];CHAT_API=[];await idbDel('kv','coachChat');renderChat();}
