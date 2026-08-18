/* ============================ TRAIN ============================ */
async function renderTrainStart(){
  const draft=(await idbGet('kv','woDraft'))?.v;
  const workouts=await idbGetAll('workouts');
  const today=todayStr(),abbr=DAY_ORDER[(parseD(today).getDay()+6)%7];
  const todayKey=PROG.schedule[abbr];
  const doneToday=workouts.some(w=>w.date===today&&doneSets((w.exercises||[]).flatMap(e=>e.sets||[])).length);
  const nd=Object.keys(PROG.days).length;
  const resume=draft&&PROG.days[draft.dayKey]?`<div class="row" style="gap:8px;margin-bottom:10px"><button class="btn" style="flex:1;text-align:left" data-startday="${draft.dayKey}">⏵ Resume ${esc(draft.title.split('—')[0].trim())} — unfinished session</button><button class="pillbtn" data-discarddraft aria-label="Discard unfinished session">✕</button></div>`:'';
  // today's hero: the scheduled day (or "rest day")
  let hero='';
  if(!resume&&nd){
    if(todayKey&&PROG.days[todayKey]&&!doneToday){const d=PROG.days[todayKey];
      hero=`<div class="card hero" style="margin-bottom:12px"><div class="xs muted" style="letter-spacing:.06em;text-transform:uppercase">Today · ${abbr}</div>
        <div class="row between" style="gap:10px;margin-top:2px"><div><div class="hero-t">${esc(d.title.split('—')[0].trim())}</div><div class="sm muted">${esc((d.title.split('—')[1]||'').trim())} · ${d.ex.length} exercises</div></div><button class="btn" data-startday="${todayKey}">Start</button></div>
        <div class="xs muted" style="margin-top:8px">${d.ex.map(e=>esc(e.name)).join(' · ')}</div></div>`;}
    else if(doneToday)hero=`<div class="card" style="margin-bottom:12px"><b>✓ Trained today</b><div class="sm muted">Nice. Rest, eat, hydrate — or start another day below.</div></div>`;
    else hero=`<div class="card" style="margin-bottom:12px"><b>Rest day</b><div class="sm muted">Nothing scheduled for ${abbr}. Start any day below if you want to train.</div></div>`;
  }
  const days=Object.entries(PROG.days).map(([k,v])=>
    `<div class="row" style="gap:8px"><button class="btn sec" style="flex:1;text-align:left" data-startday="${k}">▶︎ ${esc(v.title)}</button><button class="pillbtn" data-editday="${k}" aria-label="Edit ${esc(v.title)}" style="align-self:stretch">✎</button></div>`).join('');
  $('#dayBtns').innerHTML=resume+hero
    +`<button class="entry planpick" data-planlib style="width:100%;text-align:left;margin-bottom:8px"><div><div class="xs muted" style="letter-spacing:.06em;text-transform:uppercase">Active plan</div><div class="n">${esc(PROG.name||'My program')}</div></div><span class="pillbtn">${PLANS.length>1?PLANS.length+' plans ›':'Plans ›'}</span></button>`
    +(nd?'':`<p class="sm muted">This plan has no training days yet — add one below.</p>`)
    +days
    +`<div class="btnrow" style="margin-top:6px;grid-template-columns:1fr 1fr 1fr"><button class="btn ghost sm" data-addday style="width:100%">+ Add day</button><button class="btn ghost sm" id="gymBtn" style="width:100%">🎒 My gym</button><button class="btn ghost sm" id="libBtn" style="width:100%">📚 Exercises</button></div>`;
  renderWeekCard(workouts);
}
/* This week: sessions vs plan, hard sets by region, tonnage; last-4-weeks by muscle behind a disclosure. */
function renderWeekCard(workouts){
  const el=$('#trainWeek');if(!el)return;
  const weeks=weeklyVolume(workouts,4);const wk=weeks[weeks.length-1];
  const planned=plannedPerWeek();
  const REG=[['lower','Lower'],['upper-push','Upper push'],['upper-pull','Upper pull'],['core','Core'],['conditioning','Conditioning'],['mobility','Mobility']];
  const maxR=Math.max(1,...REG.map(([k])=>wk.byRegion[k]||0));
  const bars=REG.filter(([k])=>wk.byRegion[k]||weeks.some(w=>w.byRegion[k])).map(([k,l])=>`<div class="vrow"><span class="vl">${l}</span><span class="vbar"><i style="width:${Math.round(100*(wk.byRegion[k]||0)/maxR)}%"></i></span><span class="vn">${wk.byRegion[k]||0}</span></div>`).join('');
  const muscles=[...new Set(weeks.flatMap(w=>Object.keys(w.byMuscle)))].sort((a,b)=>(weeks[3].byMuscle[b]||0)-(weeks[3].byMuscle[a]||0));
  const table=muscles.length?`<table class="vtable"><thead><tr><th>Sets / week</th>${weeks.map(w=>`<th>${niceDate(w.start).replace('Today','This wk')}</th>`).join('')}</tr></thead><tbody>${muscles.map(m=>`<tr><td>${m}</td>${weeks.map(w=>`<td class="${(w.byMuscle[m]||0)>=10?'good':''}">${w.byMuscle[m]||0}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="xs muted" style="margin:6px 0 0">The plan's target is 10–15 hard sets per muscle per week (highlighted when reached).</p>`:'';
  el.innerHTML=`<div class="card"><div class="row between"><b>This week</b><span class="sm muted">${wk.sessions}${planned?` of ${planned}`:''} session${wk.sessions===1&&!planned?'':'s'} · ${wk.sets} sets · ${fmtKg(wk.tonnage)}${wk.prs?` · ${wk.prs} PB${wk.prs>1?'s':''}`:''}</span></div>
    ${bars?`<div style="margin-top:8px">${bars}</div>`:'<p class="sm muted" style="margin:6px 0 0">No sets logged this week yet.</p>'}
    ${table?`<details style="margin-top:8px"><summary class="sm" style="cursor:pointer">By muscle · last 4 weeks</summary><div style="overflow-x:auto;margin-top:6px">${table}</div></details>`:''}
  </div>`;
}
function nextDayKey(){for(const c of 'ABCDEFGH')if(!PROG.days[c])return c;return 'D'+(Object.keys(PROG.days).length+1);}
async function saveProgram(){await idbPut('plans',PROG);}
async function setActivePlan(id){await idbPut('kv',{k:'activePlan',v:id});await loadProgram();}
function planLibraryModal(){
  const draw=()=>{$('#plList').innerHTML=PLANS.map(p=>{const on=p.id===PROG.id;const nd=Object.keys(p.days||{}).length;
    return `<div class="entry${on?' on':''}" role="button" tabindex="0" data-plan="${esc(p.id)}"><div><div class="n">${esc(p.name)}${on?' <span class="badge">Active</span>':''}</div><div class="s">${nd} day${nd===1?'':'s'} · ${esc(p.source||'custom')}${p.description?' · '+esc(p.description):''}</div></div>
      <div class="row" style="gap:6px"><button class="pillbtn" data-planren="${esc(p.id)}" aria-label="Rename">✎</button><button class="pillbtn" data-plandup="${esc(p.id)}" aria-label="Duplicate">⧉</button>${!on&&PLANS.length>1?`<button class="pillbtn" data-plandel="${esc(p.id)}" aria-label="Delete">✕</button>`:''}</div></div>`;}).join('');};
  openModal(`<div class="mh"><h3>Workout plans</h3><button class="x" onclick="closeModal()">✕</button></div>
   <p class="sm muted" style="margin:0 0 10px">Tap a plan to make it active. Your logged sessions always stay yours, whichever plan they came from.</p>
   <div id="plList"></div>
   <button class="btn sec" id="plNew" style="margin-top:12px;width:100%">+ New empty plan</button>`);
  draw();
  $('#plList').onclick=async e=>{
    const ren=e.target.closest('[data-planren]');if(ren){const p=PLANS.find(x=>x.id===ren.dataset.planren);const n=prompt('Plan name',p.name);if(n&&n.trim()){p.name=n.trim();await idbPut('plans',p);draw();renderTrainStart();}return;}
    const dup=e.target.closest('[data-plandup]');if(dup){const p=PLANS.find(x=>x.id===dup.dataset.plandup);const c=JSON.parse(JSON.stringify(p));c.id='plan-'+uid();c.name=p.name+' (copy)';c.source='custom';c.createdAt=Date.now();delete c.up;delete c.sharedFrom;await idbPut('plans',c);await loadProgram();draw();toast('Plan duplicated');return;}
    const del=e.target.closest('[data-plandel]');if(del){if(!confirm('Delete this plan? Logged sessions are kept.'))return;await idbDel('plans',del.dataset.plandel);await loadProgram();draw();renderTrainStart();return;}
    const row=e.target.closest('[data-plan]');if(row){await setActivePlan(row.dataset.plan);closeModal();renderTrainStart();renderToday();toast('Active plan: '+PROG.name);}
  };
  $('#plNew').onclick=async()=>{const n=prompt('Name your plan','New plan');if(!n)return;
    const p={id:'plan-'+uid(),name:n.trim(),days:{},schedule:{},source:'custom',createdAt:Date.now()};
    await idbPut('plans',p);await setActivePlan(p.id);closeModal();renderTrainStart();toast('Plan created — add a day to start');};
}

function editDayModal(key){
  const isNew=!key;
  const k=isNew?nextDayKey():key;
  const day=isNew?{title:'Day '+k+' — Custom',ex:[]}:JSON.parse(JSON.stringify(PROG.days[k]));
  openModal(`<div class="mh"><h3>${isNew?'New training day':'Edit '+esc(day.title.split('—')[0].trim())}</h3><button class="x" onclick="closeModal()">✕</button></div>
   <label class="fl">Day title</label><input id="pdTitle" value="${esc(day.title)}">
   <label class="fl">Scheduled on</label>
   <div class="row" style="gap:6px;flex-wrap:wrap">${DAY_ORDER.map(a=>`<label class="pillbtn" style="cursor:pointer;display:inline-flex;align-items:center"><input type="checkbox" data-sched="${a}" ${PROG.schedule[a]===k?'checked':''} style="width:auto;margin-right:5px">${a}</label>`).join('')}</div>
   <label class="fl">Exercises</label>
   <div id="pdList"></div>
   <div class="row" style="gap:6px;margin-top:8px">
     <input id="pdName" placeholder="Exercise name" style="flex:2" list="exNames">
     <select id="pdMode" aria-label="Logged as" style="flex:1"><option value="reps">kg × reps</option><option value="time">timed (s)</option><option value="rounds">circuit (rounds)</option></select>
   </div>
   <div class="row tgtrow" style="gap:6px;margin-top:6px;align-items:center">
     <input id="pdSets" type="number" inputmode="numeric" placeholder="sets" aria-label="Sets" min="1" style="flex:.8">
     <span class="tgt-x" aria-hidden="true">×</span>
     <input id="pdMin" type="number" inputmode="numeric" placeholder="reps" aria-label="Reps (min)" min="1" style="flex:.8">
     <span class="tgt-x pd-reps" aria-hidden="true">–</span>
     <input id="pdMax" type="number" inputmode="numeric" placeholder="max" aria-label="Reps (max, optional)" min="1" style="flex:.8" class="pd-reps">
     <label class="pillbtn pd-reps" style="cursor:pointer;display:inline-flex;align-items:center;flex:none"><input type="checkbox" id="pdAmrap" style="width:auto;margin-right:5px">AMRAP</label>
     <label class="pillbtn pd-reps" style="cursor:pointer;display:inline-flex;align-items:center;flex:none"><input type="checkbox" id="pdSide" style="width:auto;margin-right:5px">per side</label>
   </div>
   <datalist id="exNames">${Object.values(EXBYID).sort((x,y)=>x.name.localeCompare(y.name)).map(x=>`<option value="${esc(x.name)}">`).join('')}</datalist>
   <textarea id="pdItems" class="pd-rounds hidden" rows="3" placeholder="One exercise per round, one per line — e.g.&#10;Plank 40s&#10;Dead bug 10 per side&#10;Hanging knee raise 10" style="margin-top:6px"></textarea>
   <div class="row" style="gap:6px;margin-top:6px">
     <select id="pdType" aria-label="Equipment type" style="flex:1.2">${EX_TYPES.map(t=>`<option>${t}</option>`).join('')}</select>
     <input id="pdRest" type="number" inputmode="numeric" placeholder="rest s" aria-label="Rest seconds" style="flex:.7">
     <button class="btn sm sec" id="pdAdd" style="flex:none">Add</button>
   </div>
   ${!isNew&&Object.keys(PROG.days).length>1?`<button class="btn danger sm" id="pdDelete" style="margin-top:12px;width:100%">Delete this day</button>`:''}
   <button class="btn" style="margin-top:10px" id="pdSave">${isNew?'Create day':'Save changes'}</button>`);
  const draw=()=>{$('#pdList').innerHTML=day.ex.length?day.ex.map((e,i)=>
    `<div class="entry"><div><div class="n">${esc(e.name)}</div><div class="s">${esc(exTargetText(e))} · ${esc(e.type||'other')}${e.mode==='time'?' · timed':e.mode==='rounds'?' · circuit':''}${e.rest?` · rest ${restLabel(e.rest)}`:''}${e.items&&e.items.length?`<br>${esc(itemsLabel(e.items))}`:''}</div></div><div class="row" style="gap:6px">${i>0?`<button class="pillbtn" data-up="${i}" aria-label="Move ${esc(e.name)} up">↑</button>`:''}<button class="pillbtn" data-rm="${i}" aria-label="Remove ${esc(e.name)}">✕</button></div></div>`).join('')
    :'<p class="sm muted">No exercises yet — add some below.</p>';};
  draw();
  $('#pdList').onclick=e=>{
    const u=e.target.closest('[data-up]');if(u){const i=+u.dataset.up;[day.ex[i-1],day.ex[i]]=[day.ex[i],day.ex[i-1]];draw();return;}
    const r=e.target.closest('[data-rm]');if(r){day.ex.splice(+r.dataset.rm,1);draw();}};
  const paintMode=()=>{const m=$('#pdMode').value;
    $$('#modalRoot .pd-reps').forEach(el=>el.classList.toggle('hidden',m!=='reps'));
    $('#pdItems').classList.toggle('hidden',m!=='rounds');
    $('#pdMin').placeholder=m==='time'?'secs':m==='rounds'?'—':'reps';$('#pdMin').disabled=m==='rounds';
    $('#pdSets').placeholder=m==='rounds'?'rounds':'sets';};
  $('#pdMode').onchange=paintMode;paintMode();
  // typing a known unilateral exercise pre-ticks "per side" (you can untick it)
  $('#pdName').addEventListener('change',()=>{const c=exFind($('#pdName').value.trim());if(c){$('#pdSide').checked=!!c.unilateral;if(c.metric==='time'&&$('#pdMode').value==='reps'){$('#pdMode').value='time';paintMode();}}});
  $('#pdAdd').onclick=()=>{const n=$('#pdName').value.trim();if(!n)return toast('Enter an exercise name');
    const mode=$('#pdMode').value,sets=+$('#pdSets').value||0,mn=+$('#pdMin').value||0,mx=+$('#pdMax').value||0;
    let tgt;
    if(mode==='rounds')tgt={rounds:sets||3};
    else if(mode==='time')tgt={sets:sets||8,secs:mn||40};
    else if($('#pdAmrap').checked)tgt={sets:sets||3,reps:'amrap'};
    else tgt={sets:sets||3,reps:{min:mn||8,max:Math.max(mx||0,mn||8)||10}};
    if(mode==='reps'&&!mn&&!mx&&!$('#pdAmrap').checked)tgt.reps={min:8,max:10};
    const perSide=mode==='reps'&&$('#pdSide').checked;
    const ne={name:n,tgt,target:targetLabel(tgt,perSide?sideWord(n):false),type:$('#pdType').value,mode,perSide};
    if(mode==='rounds'){ne.items=parseItems($('#pdItems').value);if(!ne.items.length)return toast('List the exercises in the circuit (one per line)');}
    ne.rest=+$('#pdRest').value||(mode==='time'?30:mode==='rounds'?45:defaultRest(ne));
    day.ex.push(ne);
    ['pdName','pdSets','pdMin','pdMax','pdRest','pdItems'].forEach(i=>$('#'+i).value='');$('#pdSide').checked=false;$('#pdAmrap').checked=false;draw();};
  const del=$('#pdDelete');if(del)del.onclick=async()=>{
    if(!confirm('Delete this training day? Past logged sessions are kept.'))return;
    delete PROG.days[k];
    for(const a of Object.keys(PROG.schedule))if(PROG.schedule[a]===k)delete PROG.schedule[a];
    await saveProgram();closeModal();renderTrainStart();renderToday();toast('Day deleted');};
  $('#pdSave').onclick=async()=>{
    if(!day.ex.length)return toast('Add at least one exercise');
    day.title=$('#pdTitle').value.trim()||('Day '+k);
    PROG.days[k]=day;
    $$('#modalRoot [data-sched]').forEach(c=>{const a=c.dataset.sched;
      if(c.checked)PROG.schedule[a]=k;
      else if(PROG.schedule[a]===k)delete PROG.schedule[a];});
    await saveProgram();closeModal();renderTrainStart();renderToday();toast('Program saved');};
}

/* My Gym is a page (not a modal): browse + manage the full inventory, auto-saved & synced. */
function renderGym(){
  const eq=EQUIP;
  const chip=(label,cat,i)=>`<span class="chip">${esc(String(label))}<button data-gyrm="${cat}:${i}" aria-label="Remove ${esc(String(label))}">✕</button></span>`;
  const none='<span class="sm muted">None yet</span>';
  const sec=(title,chipsHtml,addHtml)=>`<div class="card"><div class="meal-h" style="margin-top:0"><span>${title}</span></div><div class="chips">${chipsHtml}</div>${addHtml}</div>`;
  const plateTot=(eq.plates||[]).reduce((s,p)=>s+p.kg*p.n,0);
  const mainBar=(eq.bars||[]).length?Math.max(...eq.bars.map(b=>b.kg)):0;
  const micro=(eq.plates||[]).length?Math.min(...eq.plates.map(p=>p.kg)):0;
  const kpi=(v,lab)=>`<div style="flex:1;text-align:center"><div style="font-family:var(--font-display);font-size:24px;font-weight:700">${v}</div><div class="xs muted" style="text-transform:uppercase;letter-spacing:.08em">${lab}</div></div>`;
  $('#gymBody').innerHTML=`
   <div class="card">
     <div class="row" style="gap:6px">${kpi((plateTot+mainBar)+' kg','max bar load')}${kpi(plateTot+' kg','plate total')}${kpi(micro+' kg','micro plate')}</div>
     <p class="xs muted center" style="margin:10px 0 0">Changes save instantly and sync to your devices. The Coach reads this to know what's maxed and what to suggest next.</p>
   </div>
   ${sec('Bars',(eq.bars||[]).length?eq.bars.map((b,i)=>chip(`${b.name} · ${b.kg} kg`,'bars',i)).join(''):none,
     `<div class="chipadd"><input id="gyBarName" placeholder="e.g. EZ bar" aria-label="Bar name" style="flex:2"><input id="gyBarKg" type="number" step="0.5" min="1" inputmode="decimal" placeholder="kg" aria-label="Bar weight in kg" style="flex:1"><button class="btn sm sec" data-gyadd="bars">+ Add</button></div>`)}
   ${sec('Plates',(eq.plates||[]).length?eq.plates.map((p,i)=>chip(`${p.kg} kg × ${p.n}`,'plates',i)).join(''):none,
     `<div class="chipadd"><input id="gyPlKg" type="number" step="0.25" min="0.25" inputmode="decimal" placeholder="kg (e.g. 15)" aria-label="Plate weight in kg" style="flex:1"><input id="gyPlN" type="number" step="1" min="1" inputmode="numeric" placeholder="how many" aria-label="Number of plates" style="flex:1"><button class="btn sm sec" data-gyadd="plates">+ Add</button></div>`)}
   ${sec('Dumbbells (pairs)',(eq.dumbbells||[]).length?eq.dumbbells.map((v,i)=>chip(v+' kg','dumbbells',i)).join(''):none,
     `<div class="chipadd"><input id="gyDbNew" type="number" step="0.5" min="0.5" inputmode="decimal" placeholder="kg — e.g. 12.5" aria-label="New dumbbell weight in kg"><button class="btn sm sec" data-gyadd="dumbbells">+ Add</button></div>`)}
   ${sec('Kettlebells',eq.kettlebells.length?eq.kettlebells.map((v,i)=>chip(v+' kg','kettlebells',i)).join(''):none,
     `<div class="chipadd"><input id="gyKbNew" type="number" step="1" min="1" inputmode="decimal" placeholder="kg — e.g. 28" aria-label="New kettlebell weight in kg"><button class="btn sm sec" data-gyadd="kettlebells">+ Add</button></div>`)}
   ${sec('Resistance bands',(eq.bands||[]).length?eq.bands.map((v,i)=>chip(v,'bands',i)).join(''):none,
     `<div class="chipadd"><input id="gyBdNew" placeholder="e.g. extra-heavy" aria-label="New band"><button class="btn sm sec" data-gyadd="bands">+ Add</button></div>`)}
   ${sec('Machines &amp; stations',(eq.gear||[]).length?eq.gear.map((v,i)=>chip(v,'gear',i)).join(''):none,
     `<div class="chipadd"><input id="gyGrNew" placeholder="e.g. rowing machine" aria-label="New machine or station"><button class="btn sm sec" data-gyadd="gear">+ Add</button></div>`)}`;
}
async function saveEquip(){
  EQUIP.plateKg=(EQUIP.plates||[]).reduce((s,p)=>s+p.kg*p.n,0);
  if((EQUIP.plates||[]).length)EQUIP.microPlateKg=Math.min(...EQUIP.plates.map(p=>p.kg));
  if((EQUIP.bars||[]).length)EQUIP.barKg=Math.max(...EQUIP.bars.map(b=>b.kg));
  EQUIP.dbMaxKg=(EQUIP.dumbbells||[]).length?Math.max(...EQUIP.dumbbells):0;
  await idbPut('kv',{k:'equipment',v:EQUIP});
  renderGym();renderCoach();
}
async function renderWorkoutHistory(){
  const list=(await idbGetAll('workouts')).sort((a,b)=>a.date<b.date?1:(a.date>b.date?-1:b.ts-a.ts));
  $('#workoutHistory').innerHTML=list.length?list.slice(0,60).map(w=>{const s=sessionSummary(w);const prs=(w.prs||[]).length;
    return `<div class="card sessioncard" role="button" tabindex="0" data-openwo="${w.id}"><div class="row between"><div><b>${esc(w.title.split('—')[0].trim())}</b>${prs?` <span class="badge">🏆 ${prs} PB${prs>1?'s':''}</span>`:''}<div class="sm muted">${niceDate(w.date)} · ${s.sets} sets${s.tonnage?` · ${fmtKg(s.tonnage)}`:''}</div></div><span class="pillbtn">View ›</span></div></div>`;}).join(''):`<div class="empty"><span class="ic">🏋️</span>No sessions logged yet.</div>`;
}
async function startSession(dayKey,existing){
  const prog=PROG.days[dayKey];if(!prog)return toast('That training day no longer exists');
  // in-progress draft? Same day resumes it; different day asks before discarding.
  const draft=existing?null:(await idbGet('kv','woDraft'))?.v;
  if(draft&&draft.dayKey!==dayKey){
    if(confirm(`You have an unfinished "${draft.title.split('—')[0].trim()}" session. Discard it and start ${prog.title.split('—')[0].trim()}?`))await idbDel('kv','woDraft');
    else return startSession(draft.dayKey);
  }
  // find last session of this day for prefill
  const all=(await idbGetAll('workouts')).filter(w=>w.dayKey===dayKey&&(!existing||w.id!==existing.id)).sort((a,b)=>a.date<b.date?1:-1);
  const last=all[0];
  const lastMap={};if(last)last.exercises.forEach(e=>lastMap[e.name]=e.sets);
  let session;
  if(draft&&draft.dayKey===dayKey){session=draft;toast('Resumed your unfinished session');}
  else session=existing||{id:uid(),date:todayStr(),dayKey,title:prog.title,notes:'',ts:Date.now(),
    planId:PROG.id,
    exercises:prog.ex.map(e=>{const prev=lastMap[e.name];const n=prev?prev.length:(e.tgt&&(e.tgt.rounds||e.tgt.sets))||parseInt(e.target)||3;
      return{name:e.name,target:e.target,tgt:e.tgt,items:e.items,mode:e.mode||'reps',rest:e.rest,perSide:!!e.perSide,
        sets:Array.from({length:n},(_,i)=>e.mode==='time'||e.mode==='rounds'?{secs:''}:{weight:prev&&prev[i]?prev[i].weight:'',reps:''})};})};
  drawSession(session,lastMap,!existing);
}
/* The logger, rest timer, wake lock and exercise history live in app/session.js (v3 stage 3). */

