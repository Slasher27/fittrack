/* ============================ TRAIN ============================ */
async function renderTrainStart(){
  const draft=(await idbGet('kv','woDraft'))?.v;
  const resume=draft&&PROG.days[draft.dayKey]?`<div class="row" style="gap:8px;margin-bottom:8px"><button class="btn" style="flex:1;text-align:left" data-startday="${draft.dayKey}">⏵ Resume ${esc(draft.title.split('—')[0].trim())} — unfinished session</button><button class="pillbtn" data-discarddraft aria-label="Discard unfinished session" style="align-self:stretch">✕</button></div>`:'';
  const nd=Object.keys(PROG.days).length;
  $('#dayBtns').innerHTML=resume+`<button class="entry planpick" data-planlib style="width:100%;text-align:left;margin-bottom:8px"><div><div class="xs muted" style="letter-spacing:.06em;text-transform:uppercase">Active plan</div><div class="n">${esc(PROG.name||'My program')}</div></div><span class="pillbtn">${PLANS.length>1?PLANS.length+' plans ›':'Plans ›'}</span></button>`
    +(nd?'':`<p class="sm muted">This plan has no training days yet — add one below.</p>`)
    +Object.entries(PROG.days).map(([k,v])=>
    `<div class="row" style="gap:8px"><button class="btn sec" style="flex:1;text-align:left" data-startday="${k}">▶︎ ${esc(v.title)}</button><button class="pillbtn" data-editday="${k}" aria-label="Edit ${esc(v.title)}" style="align-self:stretch">✎</button></div>`).join('')
    +`<div class="btnrow" style="margin-top:6px"><button class="btn ghost sm" data-addday style="width:100%">+ Add day</button><button class="btn ghost sm" id="gymBtn" style="width:100%">🎒 My gym</button><button class="btn ghost sm" id="libBtn" style="width:100%">📚 Exercises</button></div>`;
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
  $('#workoutHistory').innerHTML=list.length?list.map(w=>{const sets=w.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.reps||s.secs||s.done).length,0);const vol=w.exercises.reduce((v,e)=>v+e.sets.reduce((x,s)=>x+((+s.weight||0)*(+s.reps||0)),0),0);
    return `<div class="card sessioncard" role="button" tabindex="0" data-openwo="${w.id}"><div class="row between"><div><b>${esc(w.title.split('—')[0].trim())}</b><div class="sm muted">${niceDate(w.date)} · ${sets} sets · ${rnd(vol)} kg volume</div></div><span class="pillbtn">View ›</span></div></div>`;}).join(''):`<div class="empty"><span class="ic">🏋️</span>No sessions logged yet.</div>`;
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
function drawSession(session,lastMap,drafting){wakeOn();
  // sessions saved before modes existed: pull mode/rest from today's program
  session.exercises.forEach(ex=>{const pe=progEx(ex.name);if(!ex.mode)ex.mode=pe?.mode||'reps';if(ex.rest==null&&pe)ex.rest=pe.rest;
    if(ex.perSide==null)ex.perSide=pe?pe.perSide:isUnilateral(ex.name);
    if(!ex.items&&pe&&pe.items)ex.items=pe.items;if(pe&&pe.mode==='rounds'&&ex.mode!=='rounds'&&!ex.sets.some(s=>s.weight||s.reps))ex.mode='rounds';});
  const phFor=(ex,si)=>{const prev=(lastMap&&lastMap[ex.name]||[])[si]||{};
    if(ex.mode==='rounds')return{secs:prev.secs||''};
    return ex.mode==='time'
      ?{secs:prev.secs||+((String(ex.target).match(/(\d+)\s*s/)||[])[1])||'',rest:prev.rest||ex.rest||''}
      :{reps:prev.reps||''};};
  const bodyHtml=()=>session.exercises.map((ex,ei)=>{
    const timed=ex.mode==='time',rounds=ex.mode==='rounds';
    const last=lastMap&&lastMap[ex.name];
    let lastTxt='';
    if(last&&last.some(s=>s.weight||s.reps||s.secs)){
      if(rounds){const done=last.filter(s=>s.secs||s.done);lastTxt=`Last: ${done.length} round${done.length===1?'':'s'}${done.some(s=>s.secs)?` (${done.map(s=>s.secs?s.secs+'s':'–').join(', ')})`:''}`;}
      else if(timed){const w=[...new Set(last.map(s=>s.secs||'–'))],r=[...new Set(last.map(s=>s.rest||''))].filter(Boolean);
        lastTxt=w.length===1&&r.length<=1?`Last: ${last.length} × ${w[0]}s work${r.length?` / ${r[0]}s rest`:''}`:`Last: ${last.map(s=>`${s.secs||'–'}s${s.rest?`/${s.rest}r`:''}`).join(', ')}`;}
      else lastTxt=`Last: ${last.map(s=>`${s.weight||'–'}×${s.reps||'–'}`).join(', ')}`;
    }
    const adv=last&&!rounds?(timed?timedAdvice(ex,last):progressionAdvice(ex.name,ex.target,last)):null;
    return `<div data-ex="${ei}"><div class="exhead"><span class="en">${esc(ex.name)}</span><span class="et">${ex.target?`target ${esc(exTargetText(ex))}`:''}${ex.rest?` · rest ${restLabel(ex.rest)}`:''}</span></div>
      ${rounds&&ex.items&&ex.items.length?`<div class="lasthint">Each round: ${esc(itemsLabel(ex.items))}</div>`:''}
      ${lastTxt?`<div class="lasthint">${esc(lastTxt)}${adv?` — <b>↑ ${esc(adv)}</b>`:''}</div>`:''}
      <div class="setrow${timed?' time':rounds?' rounds':''}" style="color:var(--muted);font-size:11px;font-weight:700"><span class="si">#</span>${timed?'<span>WORK S</span><span>REST S</span>':rounds?'<span>ROUND TIME S (optional)</span>':`<span>KG</span><span>REPS${ex.perSide?' / '+sideWord(ex.name).toUpperCase():''}</span>`}<span></span></div>
      <div class="sets">${ex.sets.map((s,si)=>setRow(ei,si,s,ex,phFor(ex,si))).join('')}</div>
      <button class="addset" data-addset="${ei}">+ ${timed?'interval':rounds?'round':'set'}</button></div>`;
  }).join('');
  openModal(`<div class="mh"><h3>${esc(session.title.split('—')[0].trim())}</h3><button class="x" onclick="closeModal()">✕</button></div>
    <div class="sm muted" style="margin-bottom:4px">${esc(session.title)} · tick a set when done — it fills in "same as last time", starts the rest, and lights up when you beat last session${drafting?' · progress auto-saves':''}</div>
    <div id="restTimer" class="resttimer hidden" role="timer"></div>
    <label class="fl">Date</label><input id="woDate" type="date" value="${session.date}">
    <div id="woBody">${bodyHtml()}</div>
    <div class="row" style="gap:6px;margin-top:10px"><input id="woNewEx" placeholder="Add an exercise (swap / extra)" style="flex:1"><button class="btn sm sec" id="woAddEx" style="flex:none">Add</button></div>
    <label class="fl">Session notes</label><textarea id="woNotes" placeholder="Energy, niggles, PBs…">${esc(session.notes||'')}</textarea>
    <button class="btn" style="margin-top:14px" id="woSave">${drafting?'Finish session':'Save changes'}</button>`);
  const root=$('#woBody');
  const collect=()=>{ // DOM → session (single source of truth for save, draft, and redraws)
    session.date=$('#woDate').value;session.notes=$('#woNotes').value.trim();
    session.exercises.forEach((ex,ei)=>{const rows=$$(`[data-ex="${ei}"] .sets .setrow`,root);
      ex.sets=rows.map(r=>{const ins=r.querySelectorAll('input');const done=r.querySelector('[data-tickset]').classList.contains('on');
        return ex.mode==='time'?{secs:ins[0].value,rest:ins[1].value,done}:ex.mode==='rounds'?{secs:ins[0].value,done}:{weight:ins[0].value,reps:ins[1].value,done};});});
  };
  let draftT=null;
  const saveDraft=async()=>{if(!drafting||!document.body.contains(root))return;collect();await idbPut('kv',{k:'woDraft',v:session});}; // the sheet may already be closed (Finish/tap-outside) when the debounce fires
  const saveDraftSoon=()=>{if(!drafting)return;clearTimeout(draftT);draftT=setTimeout(saveDraft,400);};
  root.addEventListener('click',e=>{
    const a=e.target.closest('[data-addset]');
    if(a){const ei=+a.dataset.addset;const ex=session.exercises[ei];const setsDiv=root.querySelector(`[data-ex="${ei}"] .sets`);
      const si=setsDiv.children.length;
      setsDiv.insertAdjacentHTML('beforeend',setRow(ei,si,ex.mode==='time'?{secs:'',rest:''}:ex.mode==='rounds'?{secs:''}:{weight:'',reps:''},ex,phFor(ex,si)));
      saveDraftSoon();return;}
    const tk=e.target.closest('[data-tickset]');
    if(tk){const on=tk.classList.toggle('on');
      if(on){ // tick = "done as planned": materialize the greyed-in suggestion, then rest
        const row=tk.closest('.setrow');
        row.querySelectorAll('input').forEach(inp=>{if(!inp.value&&+inp.placeholder)inp.value=inp.placeholder;});
        const ex=session.exercises[+tk.closest('[data-ex]').dataset.ex];
        // timed exercises rest for THIS interval's rest value (so cutting 20 → 15 s takes effect immediately)
        const rsec=ex.mode==='time'?(+row.querySelectorAll('input')[1].value||ex.rest||30):ex.mode==='rounds'?(ex.rest||45):(ex.rest||90);
        buzz();startRest(rsec);}
      saveDraftSoon();return;}
    const d=e.target.closest('[data-delset]');if(d){d.closest('.setrow').remove();saveDraftSoon();}});
  // beat-last-session highlight: volt row when this set beats last time's same set
  root.addEventListener('input',e=>{
    if(!e.target.matches('.setrow input'))return;
    saveDraftSoon();
    const exEl=e.target.closest('[data-ex]');if(!exEl)return;
    const row=e.target.closest('.setrow');const sets=row.parentElement;if(!sets.classList.contains('sets'))return;
    const si=[...sets.children].indexOf(row);
    const ex=session.exercises[+exEl.dataset.ex];
    const prev=(lastMap&&lastMap[ex.name]||[])[si];
    const ins=row.querySelectorAll('input');
    if(ex.mode==='time'){const sv=+ins[0].value||0,rv=+ins[1].value||0;
      // beat = more work, or same work on less rest
      row.classList.toggle('beat',!!(prev&&sv&&(sv>+(prev.secs||0)||(sv===+(prev.secs||0)&&rv&&+(prev.rest||0)&&rv<+prev.rest))));return;}
    const w=+ins[0].value||0,r=+ins[1].value||0;
    row.classList.toggle('beat',!!(prev&&w&&r&&(w>+prev.weight||(w===+prev.weight&&r>+prev.reps))));
  });
  $('#woDate').addEventListener('change',saveDraftSoon);
  $('#woNotes').addEventListener('input',saveDraftSoon);
  $('#woAddEx').onclick=()=>{
    const name=$('#woNewEx').value.trim();if(!name)return;
    collect();
    const pe=progEx(name); // known exercise (e.g. from another day) brings its target/mode/rest along
    session.exercises.push({name,target:pe?.target||'',tgt:pe?.tgt,items:pe?.items,mode:pe?.mode||'reps',rest:pe?.rest,perSide:pe?pe.perSide:isUnilateral(name),
      sets:[pe?.mode==='time'?{secs:'',rest:''}:pe?.mode==='rounds'?{secs:''}:{weight:'',reps:''}]});
    root.innerHTML=bodyHtml();
    saveDraftSoon();toast(`${name} added to this session`);};
  $('#woSave').onclick=async()=>{
    collect();
    await idbPut('workouts',session);
    if(drafting)await idbDel('kv','woDraft');
    closeModal();buzz();toast('Session saved 💪');curDate=session.date;go('train');renderToday();};
  // NOTE: deliberately no saveDraft() here. Merely *opening* a day used to write a
  // draft, so an accidental tap left a phantom "unfinished session" that nagged you
  // and blocked starting another day. The draft is now created by the first real
  // input (keystroke, tick, added set) — see saveDraftSoon.
}
function setRow(ei,si,s,ex,ph){
  const tick=`<button type="button" class="si${s.done?' on':''}" data-tickset aria-label="Mark set ${si+1} done (starts rest timer)">${si+1}</button>`;
  if(ex&&ex.mode==='rounds')return `<div class="setrow rounds">${tick}<input type="number" inputmode="numeric" placeholder="${ph&&ph.secs?ph.secs:'time s'}" aria-label="Round ${si+1} time, seconds (optional)" value="${s.secs??''}"><button class="del" data-delset aria-label="Remove round ${si+1}">✕</button></div>`;
  if(ex&&ex.mode==='time')return `<div class="setrow time">${tick}<input type="number" inputmode="numeric" placeholder="${ph&&ph.secs?ph.secs:'0'}" aria-label="Interval ${si+1}, work seconds" value="${s.secs??''}"><input type="number" inputmode="numeric" placeholder="${ph&&ph.rest?ph.rest:'0'}" aria-label="Interval ${si+1}, rest seconds" value="${s.rest??''}"><button class="del" data-delset aria-label="Remove interval ${si+1}">✕</button></div>`;
  return `<div class="setrow">${tick}<input type="number" inputmode="decimal" placeholder="0" aria-label="Set ${si+1} weight, kg" value="${s.weight??''}"><input type="number" inputmode="numeric" placeholder="${ph&&ph.reps?ph.reps:'0'}" aria-label="Set ${si+1} reps${ex&&ex.perSide?' per side':''}" value="${s.reps??''}"><button class="del" data-delset aria-label="Remove set ${si+1}">✕</button></div>`;
}
// Screen wake lock: keep the phone awake while a session is open in the logger.
// The OS releases the lock whenever the tab is hidden, so re-acquire on return.
let wakeLock=null,wantWake=false;
async function wakeOn(){wantWake=true;if(!('wakeLock'in navigator)||wakeLock)return;try{wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null;});}catch(e){wakeLock=null;}}
function wakeOff(){wantWake=false;try{if(wakeLock)wakeLock.release();}catch(e){}wakeLock=null;}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&wantWake)wakeOn();});
function restLabel(sec){return sec>=90?`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')} min`:`${sec}s`;}

let restInt=null;
function startRest(sec){
  clearInterval(restInt);const el=$('#restTimer');if(!el)return;
  const end=Date.now()+sec*1000; // timestamp-based: survives the phone freezing timers while locked
  const paint=()=>{
    const t=Math.max(0,Math.round((end-Date.now())/1000));
    if(t<=0){clearInterval(restInt);el.classList.add('hidden');buzz();toast('Rest done — next set 💪');return;}
    el.textContent=`⏱ Rest ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')} — tap to skip`;
  };
  el.classList.remove('hidden');paint();
  restInt=setInterval(paint,500);
  el.onclick=()=>{clearInterval(restInt);el.classList.add('hidden');};
}
async function openWorkout(id){const w=await idbGet('workouts',id);const all=(await idbGetAll('workouts')).filter(x=>x.dayKey===w.dayKey&&x.date<w.date).sort((a,b)=>a.date<b.date?1:-1);const lastMap={};if(all[0])all[0].exercises.forEach(e=>lastMap[e.name]=e.sets);drawSession(w,lastMap);}

