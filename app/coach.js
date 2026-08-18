/* ============================ COACH (insights engine) ============================ */
/* Deterministic personal-trainer rules over local data. Offline, private, free. */
const DEFAULT_EQUIPMENT={
  dumbbells:[2,3,6,10],dbMaxKg:10,
  kettlebells:[12,16,20,24,32],
  bars:[{name:'Olympic barbell',kg:20}],barKg:20,
  plates:[{kg:1.25,n:2},{kg:2.5,n:4},{kg:5,n:6},{kg:10,n:4},{kg:20,n:4}],
  plateKg:162.5,microPlateKg:1.25,
  bands:['thin','thin','medium','medium-large','large'],
  gear:['squat rack','adjustable bench','pull-up bar','dip station','high-to-low pulley'],
  pulley:'high-to-low only',
};
let EQUIP=DEFAULT_EQUIPMENT; // replaced by the stored 'equipment' kv record at init (editable via Train → 🎒 My gym)
const WATER_TARGET_ML=3000; // plan: ~3 L/day
const LOWER_LIFTS=new Set(['Back Squat','Front Squat','Deadlift','Romanian Deadlift','Hip Thrust']); // heuristic fallback only
const DB_LIFTS=new Set(['DB Curl','Lateral Raise']);
function exType(name){ // stored program first, then name heuristics (for historical/renamed lifts)
  for(const d of Object.values(PROG.days))for(const e of d.ex)if(e.name===name)return e.type||'other';
  if(DB_LIFTS.has(name))return 'dumbbell';
  if(/^KB\b|Swings/.test(name))return 'kettlebell';
  if(LOWER_LIFTS.has(name))return 'barbell-lower';
  if(/press|row|bench/i.test(name))return 'barbell-upper';
  if(/pull-?up|chin-?up|dip|raise$/i.test(name))return 'bodyweight';
  return 'other';
}

function repTop(t){ // top of the rep range from a target like '3 × 6–8'; null for AMRAP/time/rounds
  if(!t||/amrap|round|min/i.test(t))return null;
  const r=t.match(/(\d+)\s*[–-]\s*(\d+)/);if(r)return +r[2];
  const m=t.match(/×\s*(\d+)\b(?!\s*s)/);return m?+m[1]:null;
}
function progressionAdvice(name,target,sets){ // double progression: all sets at top of range → load up
  const top=repTop(target);if(!top)return null;
  const done=(sets||[]).filter(s=>+s.reps>0);if(!done.length)return null;
  if(!done.every(s=>+s.reps>=top))return null;
  const w=Math.max(...done.map(s=>+s.weight||0));
  switch(exType(name)){
    case 'dumbbell':{
      const next=(EQUIP.dumbbells||[]).find(k=>k>w);
      if(next)return `all sets at the top — move up to the ${next} kg dumbbells`;
      return `you've maxed your ${EQUIP.dbMaxKg} kg dumbbells — switch to the barbell or bands to keep progressing`;}
    case 'kettlebell':{
      const next=EQUIP.kettlebells.find(k=>k>w);
      return next?`all sets at the top — move up to the ${next} kg bell`:`you've maxed the ${Math.max(...EQUIP.kettlebells)} kg bell — add reps or slow the tempo`;}
    case 'barbell-lower':return `all sets hit ${top} reps — add 2.5–5 kg and restart at the bottom of the range`;
    case 'barbell-upper':return `all sets hit ${top} reps — add 1.25–2.5 kg and restart at the bottom of the range`;
    case 'bodyweight':return `all sets hit ${top} reps — push past the target reps or add weight (dip belt)`;
    default:return `all sets hit ${top} reps — progress reps, slow the tempo, or move to a harder variation`;
  }
}
function progEx(name){for(const d of Object.values(PROG.days))for(const e of d.ex)if(e.name===name)return e;return null;}
function timedAdvice(ex,last){ // interval progression: hit every interval → more work or less rest
  const done=(last||[]).filter(s=>+s.secs>0);if(!done.length)return null;
  const tgt=Math.max(+((String(ex.target).match(/(\d+)\s*s/)||[])[1])||0,...done.map(s=>+s.secs));
  if(!done.every(s=>+s.secs>=tgt))return null;
  const r=Math.max(0,...done.map(s=>+s.rest||0))||ex.rest||0;
  return `all intervals hit ${tgt} s — add an interval, go to ${tgt+5} s work${r>=10?`, or cut rest to ${r-5} s`:''}`;
}

async function computeStats(){
  const[logs,meas,wos,photos,waterToday]=await Promise.all([idbGetAll('log'),idbGetAll('measurements'),idbGetAll('workouts'),idbGetAll('photos'),idbByDate('water',todayStr())]);
  const dayTotals={};logs.forEach(e=>{const d=dayTotals[e.date]=dayTotals[e.date]||{kcal:0,protein:0};d.kcal+=e.kcal;d.protein+=e.protein;});
  const dayOff=n=>{const d=new Date();d.setDate(d.getDate()-n);return dstr(d);};
  const days7=[];for(let i=1;i<=7;i++){const ds=dayOff(i);if(dayTotals[ds])days7.push(ds);} // logged days only; today excluded (incomplete)
  const kcal7=days7.length?days7.reduce((s,d)=>s+dayTotals[d].kcal,0)/days7.length:null;
  const protLow=days7.filter(d=>dayTotals[d].protein<SET.targets.protein*0.85).length;
  const w=meas.filter(m=>m.weight!=null).sort((a,b)=>a.date<b.date?-1:1);
  const mean=a=>a.length?a.reduce((s,m)=>s+m.weight,0)/a.length:null;
  const wk1=w.filter(m=>m.date>=dayOff(7)),wk2=w.filter(m=>m.date>=dayOff(14)&&m.date<dayOff(7));
  const trend=wk1.length>=2&&wk2.length>=2?mean(wk1)-mean(wk2):null; // kg/week; negative = losing
  const lastWeigh=w[w.length-1]||null;
  const since=ds=>ds?Math.round((parseD(todayStr())-parseD(ds))/864e5):null;
  const lastPhoto=photos.map(p=>p.date).sort().pop()||null;
  const sorted=wos.slice().sort((a,b)=>a.date<b.date?-1:1);
  const perLift={};
  sorted.forEach(wo=>wo.exercises.forEach(ex=>{const done=ex.sets.filter(s=>+s.reps>0);if(!done.length)return;
    (perLift[ex.name]=perLift[ex.name]||[]).push({date:wo.date,target:ex.target,sets:done,max:Math.max(...done.map(s=>+s.weight||0))});}));
  const weekKey=d=>{const x=parseD(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return dstr(x);};
  const trainingWeeks=new Set(sorted.map(wo=>weekKey(wo.date))).size;
  const today=parseD(todayStr());const monOff=(today.getDay()+6)%7;
  const doneDates=new Set(sorted.map(wo=>wo.date));
  const offs={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6};
  const missed=[];
  for(const[abbr,dk]of Object.entries(PROG.schedule||{})){
    const off=offs[abbr];if(off==null||!PROG.days[dk])continue;
    if(off<monOff){const d=new Date(today);d.setDate(d.getDate()-monOff+off);if(!doneDates.has(dstr(d)))missed.push(DAY_FULL[abbr]);}
  }
  return{days7,kcal7,protLow,trend,lastWeigh,sinceWeigh:since(lastWeigh&&lastWeigh.date),lastPhoto,sincePhoto:since(lastPhoto),
    perLift,trainingWeeks,missed,hasWorkouts:sorted.length>0,hasLogs:logs.length>0,
    waterMl:waterToday.reduce((s,w)=>s+w.ml,0)};
}

/* Each rule: check(stats) → false | {t: title, b: body(html-safe)} */
const INSIGHT_RULES=[
 {id:'goal-reached',sev:'good',cd:30,check:s=>!!(s.lastWeigh&&SET.startWeight>SET.goalWeight&&s.lastWeigh.weight<=SET.goalWeight)&&
   {t:'🎉 Goal weight reached — time to adapt the plan',b:`You weighed in at ${s.lastWeigh.weight} kg — at your ${SET.goalWeight} kg goal. Per your plan: raise calories ~100 kcal/week back toward maintenance (~2,450) and shift the goal to building strength. Update your targets in ⚙️ Settings when ready.`}},
 {id:'weight-fast',sev:'warn',cd:10,check:s=>s.trend!=null&&s.trend<=-0.7&&
   {t:'Losing faster than ~0.7 kg/week',b:`Your weekly average dropped ${(-s.trend).toFixed(1)} kg. That pace costs muscle — add ~150 kcal back (carbs or fat) and keep protein at ${SET.targets.protein} g.`}},
 {id:'weight-stall',sev:'warn',cd:14,check:s=>s.trend!=null&&Math.abs(s.trend)<0.15&&s.lastWeigh&&s.lastWeigh.weight>SET.goalWeight+0.5&&
   {t:'Weight has stalled for ~2 weeks',b:'Your plan’s adjustment rule: drop ~150 kcal/day (trim carbs or fat — never protein) <i>or</i> add ~1,500 daily steps. Change one lever, then reassess in 2 weeks.'}},
 {id:'weight-pace',sev:'good',cd:7,check:s=>s.trend!=null&&s.trend<=-0.25&&s.trend>=-0.65&&
   {t:'Fat loss is on pace 👌',b:`Weekly average down ${(-s.trend).toFixed(1)} kg — right in the 0.3–0.5 kg sweet spot that preserves muscle. Change nothing.`}},
 {id:'kcal-over',sev:'warn',cd:5,check:s=>s.days7.length>=4&&s.kcal7>SET.targets.kcal*1.08&&
   {t:'Calories are drifting over target',b:`You've averaged ${rnd(s.kcal7)} kcal over your last ${s.days7.length} logged days vs the ${SET.targets.kcal} target. Trim carbs or fats first — protein stays untouched.`}},
 {id:'kcal-under',sev:'warn',cd:5,check:s=>s.days7.length>=4&&s.kcal7<SET.targets.kcal*0.8&&
   {t:'Eating well under target',b:`Averaging ${rnd(s.kcal7)} kcal — a much bigger deficit than planned strips muscle and tanks training. Eat closer to ${SET.targets.kcal}; faster isn't better.`}},
 {id:'protein-low',sev:'warn',cd:5,check:s=>s.protLow>=3&&
   {t:'Protein is falling short',b:`${s.protLow} of your last ${s.days7.length} logged days were under ~${rnd(SET.targets.protein*0.85)} g. Protein is the non-negotiable — anchor every meal at 40–45 g (whey, biltong and eggs are the quick fixes).`}},
 {id:'progress',sev:'good',cd:3,check:s=>{const hits=[];for(const[n,h]of Object.entries(s.perLift)){const last=h[h.length-1];const a=progressionAdvice(n,last.target,last.sets);if(a)hits.push(`<b>${esc(n)}</b> — ${esc(a)}`);}
   return hits.length>0&&{t:'⬆️ Progression due next session',b:hits.slice(0,3).join('<br>')};}},
 {id:'plateau',sev:'warn',cd:10,check:s=>{const st=[];for(const[n,h]of Object.entries(s.perLift)){if(h.length<3)continue;const l3=h.slice(-3);
   if(l3.every(x=>x.max===l3[0].max&&x.max>0)&&!progressionAdvice(n,l3[2].target,l3[2].sets))st.push(n);}
   return st.length>0&&{t:'Plateau watch',b:`${st.map(esc).join(', ')}: three sessions at the same weight without reaching the top of the range. Try micro-loading (2×${EQUIP.microPlateKg} kg plates), a 3-second lowering phase, or swap in a variation for 2–3 weeks.`};}},
 {id:'deload',sev:'info',cd:7,check:s=>s.trainingWeeks>=6&&s.trainingWeeks%6===0&&
   {t:'Deload week',b:`This is training week ${s.trainingWeeks} — your plan calls for a deload every 6th week: cut sets ~40% and load ~10%. It should feel too easy; that's the point. Progress resumes next week.`}},
 {id:'missed',sev:'info',cd:2,check:s=>s.hasWorkouts&&s.missed.length>0&&
   {t:'Missed session this week',b:`No workout logged for ${s.missed.join(' or ')}. Slot it in today or tomorrow — consistency beats perfection, just don't let one miss become two.`}},
 {id:'water-low',sev:'info',cd:1,check:s=>new Date().getHours()>=15&&s.days7.length>=1&&s.waterMl<1000&&
   {t:'💧 Water is behind today',b:`Only ${s.waterMl} ml logged and it's already afternoon — the plan targets ~3 L/day. Thirst often masquerades as hunger on a deficit; get a glass in now and use the +250/+500 buttons as you go.`}},
 {id:'weigh-gap',sev:'info',cd:3,check:s=>s.days7.length>=1&&(s.sinceWeigh==null||s.sinceWeigh>=4)&&
   {t:'Time for a weigh-in',b:s.sinceWeigh==null?'No weigh-ins yet — daily morning weigh-ins (judged only by the weekly average) are how this plan self-corrects.':`Last weigh-in was ${s.sinceWeigh} days ago. Daily morning weigh-ins keep your weekly average honest.`}},
 {id:'photo-gap',sev:'info',cd:7,check:s=>!!s.lastPhoto&&s.sincePhoto>=16&&
   {t:'Progress photo due',b:'It’s been over two weeks — same light, same pose, front/side/back. Photos catch the recomposition the scale hides.'}},
];

async function renderCoach(){
  const s=await computeStats();
  const dis=(await idbGet('kv','insightDismissals'))?.v||{};
  const fired=[];
  for(const r of INSIGHT_RULES){
    let res;try{res=r.check(s);}catch(err){continue;}
    if(!res)continue;
    const d=dis[r.id];
    if(d&&(parseD(todayStr())-parseD(d))/864e5<r.cd)continue;
    fired.push({id:r.id,sev:r.sev,...res});
  }
  const order={warn:0,good:1,info:2};fired.sort((a,b)=>order[a.sev]-order[b.sev]);
  // Collapsed by default: the Coach is advice, not a task. Three paragraphs of prose
  // on the dashboard drowned out the one thing you actually came here to do.
  const worst=fired[0];
  $('#todayCoach').innerHTML=fired.length?`<details class="card coachcard"><summary class="coach-sum"><span class="cs-dot ${worst.sev}" aria-hidden="true"></span><span class="cs-t">${worst.t}</span>${fired.length>1?`<span class="badge">+${fired.length-1}</span>`:''}<span class="cs-chev" aria-hidden="true">›</span></summary>${
    fired.slice(0,4).map(i=>`<div class="insight ${i.sev}"><div><div class="n">${i.t}</div><div class="s">${i.b}</div></div><button class="pillbtn" data-dismissinsight="${i.id}" aria-label="Dismiss insight">✕</button></div>`).join('')
  }${fired.length>4?`<div class="xs muted center" style="margin-top:6px">+${fired.length-4} more after these are handled</div>`:''}</details>`:'';
}

/* ---------- Notifications (opt-in; local only — no push server) ---------- */
function notifySupported(){return 'Notification' in window&&'serviceWorker' in navigator;}
async function registerPeriodic(){ // Android/Chrome installed-PWA background nudges; silently unavailable elsewhere
  try{
    const reg=await navigator.serviceWorker.ready;
    if(!('periodicSync' in reg))return;
    const st=await navigator.permissions.query({name:'periodic-background-sync'}).catch(()=>null);
    if(st&&st.state!=='granted')return;
    await reg.periodicSync.register('fittrack-daily',{minInterval:12*60*60*1000});
  }catch(e){}
}
async function notifyCoach(){ // on launch: one notification per day for warn-level insights
  if(!SET.notify||!notifySupported()||Notification.permission!=='granted')return;
  const today=todayStr();if(SET.lastNotify===today)return;
  const s=await computeStats();
  const dis=(await idbGet('kv','insightDismissals'))?.v||{};
  const warns=[];
  for(const r of INSIGHT_RULES){
    if(r.sev!=='warn')continue;
    let res;try{res=r.check(s);}catch(e){continue;}
    if(!res)continue;
    const d=dis[r.id];if(d&&(parseD(today)-parseD(d))/864e5<r.cd)continue;
    warns.push(res.t);
  }
  if(!warns.length)return;
  SET.lastNotify=today;await saveSettings();
  const reg=await navigator.serviceWorker.ready;
  reg.showNotification('🧠 FitTrack Coach',{body:warns.slice(0,3).join(' · '),tag:'fittrack-coach',icon:'./icon-192.png',badge:'./icon-192.png'});
}

