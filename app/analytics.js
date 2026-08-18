/* ============================ TRAINING ANALYTICS (v3 stage 3) ============================
   Derived from the `workouts` store — no separate store, so it is always consistent.
   Per exercise: history, bests (heaviest set, e1RM, best volume set, longest hold), PR checks.
   Per session: sets, tonnage, sets by region / by primary muscle. Per week: rollups. */
function epley(w,r){w=+w||0;r=+r||0;return r>0?Math.round(w*(1+r/30)):0;}
/* Stable identity for an exercise across renames/aliases: catalog id when known, else its normalised name. */
function exIdOf(name){const c=exFind(name);return c?c.id:'name:'+exKey(name);}
function doneSets(sets){return (sets||[]).filter(s=>+s.reps||+s.secs||s.done);}
function sortedWorkouts(list){return list.slice().sort((a,b)=>a.date<b.date?-1:(a.date>b.date?1:(a.ts||0)-(b.ts||0)));}
/* Every logged occurrence of an exercise, oldest first. Optionally only strictly before a date / excluding a session id. */
function exerciseHistory(workouts,name,opts={}){
  const id=exIdOf(name),out=[];
  for(const w of sortedWorkouts(workouts)){
    if(opts.excludeId&&w.id===opts.excludeId)continue;
    if(opts.before){if(w.date>opts.before)continue;if(w.date===opts.before&&(w.ts||0)>=(opts.ts||Infinity))continue;}
    for(const e of w.exercises||[]){
      if(exIdOf(e.name)!==id)continue;
      const sets=doneSets(e.sets);if(!sets.length)continue;
      const mode=e.mode||(sets.some(s=>+s.reps)?'reps':'time');
      out.push({date:w.date,woId:w.id,mode,sets,top:topSet(sets),tonnage:tonnageOf(sets)});
    }
  }
  return out;
}
function tonnageOf(sets){return sets.reduce((t,s)=>t+(+s.weight||0)*(+s.reps||0),0);}
/* The set that best represents the session for this exercise: highest e1RM (reps), else longest work (time/rounds). */
function topSet(sets){
  let best=null;
  for(const s of sets){const w=+s.weight||0,r=+s.reps||0,sec=+s.secs||0;
    if(r){const e=epley(w,r);if(!best||best.secs!=null||e>best.e1rm||(e===best.e1rm&&w>best.w))best={w,r,e1rm:e};}
    else if(sec){if(!best||(best.secs!=null&&sec>best.secs))best={secs:sec};}
    else if(s.done&&!best)best={done:true};}
  return best;
}
/* Overall bests over a history list. */
function exerciseBests(hist){
  let bestW=null,bestE=null,bestVol=null,bestSec=null,sessions=hist.length;
  for(const h of hist)for(const s of h.sets){const w=+s.weight||0,r=+s.reps||0,sec=+s.secs||0;
    if(r){const e=epley(w,r),v=w*r;
      if(!bestW||w>bestW.w||(w===bestW.w&&r>bestW.r))bestW={w,r,date:h.date};
      if(!bestE||e>bestE.e1rm)bestE={e1rm:e,w,r,date:h.date};
      if(v&&(!bestVol||v>bestVol.v))bestVol={v,w,r,date:h.date};}
    else if(sec&&(!bestSec||sec>bestSec.secs))bestSec={secs:sec,date:h.date};}
  return{bestW,bestE,bestVol,bestSec,sessions,last:hist[hist.length-1]||null};
}
/* Is this single set a PR against `bests`? Returns a short kind or null. */
function setPR(s,bests,mode){
  if(!bests)return null;
  const w=+s.weight||0,r=+s.reps||0,sec=+s.secs||0;
  if(mode==='reps'||r){
    if(!r||!(w||r))return null;
    if(!bests.bestW)return w||r?'first':null;
    if(w>bests.bestW.w)return 'weight';
    if(w===bests.bestW.w&&r>bests.bestW.r)return 'reps';
    const e=epley(w,r);if(bests.bestE&&e>bests.bestE.e1rm)return 'e1rm';
    return null;}
  if(sec){if(!bests.bestSec)return 'first';if(sec>bests.bestSec.secs)return 'time';}
  return null;
}
function prLabel(kind,s){
  const w=+s.weight||0,r=+s.reps||0,sec=+s.secs||0;
  if(kind==='weight')return `heaviest ever: ${w} kg × ${r}`;
  if(kind==='reps')return `most reps at ${w} kg: ${r}`;
  if(kind==='e1rm')return `best e1RM: ${epley(w,r)} kg (${w} × ${r})`;
  if(kind==='time')return `longest: ${sec} s`;
  if(kind==='first')return 'first time logged';
  return '';
}
/* PRs achieved in `session` versus everything logged before it. */
function sessionPRs(session,workouts){
  const out=[];
  for(const ex of session.exercises||[]){
    const hist=exerciseHistory(workouts,ex.name,{before:session.date,excludeId:session.id,ts:session.ts});
    const bests=exerciseBests(hist);
    if(!hist.length)continue; // "first time" isn't a PR worth shouting about
    let top=null;
    for(const s of doneSets(ex.sets)){const k=setPR(s,bests,ex.mode||'reps');if(!k)continue;
      const rank={weight:3,e1rm:2,time:2,reps:1}[k]||0;if(!top||rank>top.rank)top={rank,kind:k,set:s};}
    if(top)out.push({name:ex.name,kind:top.kind,text:prLabel(top.kind,top.set)});
  }
  return out;
}
/* Session-level rollup: hard sets, tonnage, sets by region and by primary muscle. */
function sessionSummary(w){
  const byRegion={},byMuscle={};let sets=0,tonnage=0;
  for(const e of w.exercises||[]){
    const done=doneSets(e.sets);if(!done.length)continue;
    const c=exFind(e.name);const region=c?c.region:'other';
    const n=done.length*(e.mode==='rounds'?(e.items||[]).length||1:1);
    sets+=n;tonnage+=tonnageOf(done);
    byRegion[region]=(byRegion[region]||0)+n;
    for(const m of (c?c.primary:[]).slice(0,2))byMuscle[m]=(byMuscle[m]||0)+n;
  }
  return{sets,tonnage,byRegion,byMuscle};
}
function weekStart(dateStr){const d=parseD(dateStr);const dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow);return dstr(d);} // Monday
function addDays(dateStr,n){const d=parseD(dateStr);d.setDate(d.getDate()+n);return dstr(d);}
/* Weekly rollups for the last `weeks` weeks (oldest first), including the current week. */
function weeklyVolume(workouts,weeks=4,today){
  today=today||todayStr();
  const thisMon=weekStart(today);const out=[];
  for(let i=weeks-1;i>=0;i--){
    const start=addDays(thisMon,-7*i),end=addDays(start,6);
    const ws=workouts.filter(w=>w.date>=start&&w.date<=end);
    const agg={start,end,sessions:0,sets:0,tonnage:0,byRegion:{},byMuscle:{},prs:0};
    for(const w of ws){const s=sessionSummary(w);if(!s.sets)continue;agg.sessions++;agg.sets+=s.sets;agg.tonnage+=s.tonnage;agg.prs+=(w.prs||[]).length;
      for(const[k,v]of Object.entries(s.byRegion))agg.byRegion[k]=(agg.byRegion[k]||0)+v;
      for(const[k,v]of Object.entries(s.byMuscle))agg.byMuscle[k]=(agg.byMuscle[k]||0)+v;}
    out.push(agg);
  }
  return out;
}
/* Sessions the active plan schedules per week (for "2 of 3 done"). */
function plannedPerWeek(){return Object.values((PROG&&PROG.schedule)||{}).filter(Boolean).length;}
function fmtSet(s){const w=+s.weight||0,r=+s.reps||0,sec=+s.secs||0;if(r)return `${w||'bw'}×${r}`;if(sec)return `${sec}s`;return s.done?'✓':'–';}
function fmtKg(n){n=+n||0;return n>=1000?(n/1000).toFixed(1).replace(/\.0$/,'')+' t':rnd(n)+' kg';}
