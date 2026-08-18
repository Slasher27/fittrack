/* ============================ SESSION LOGGER (v3 stage 3 — full screen) ============================
   Replaces the bottom-sheet logger. A session is a VIEW (#view-session): the bottom nav
   hides, the top bar carries ‹ Train · title · Finish, the rest timer is sticky, the
   screen stays awake, and progress auto-saves to kv.woDraft on every input.
   Each exercise block shows: target (with per leg/arm), rest, "Last" and "Best / e1RM"
   from your history, rows in the exercise's own metric (kg × reps · work/rest s ·
   circuit rounds), live beat-last highlighting and PB detection, and a tap-through to
   the exercise's history screen. Finish computes the session's PRs and stores them. */
let SES=null; // {session,lastMap,drafting,bests:{name→bests},workouts}
let sesFrom='train';

function exitSession(){clearInterval(restInt);wakeOff();document.body.classList.remove('session-mode');}

async function drawSession(session,lastMap,drafting){
  wakeOn();
  const workouts=await idbGetAll('workouts');
  // sessions saved before modes existed: pull mode/rest/items from today's program
  session.exercises.forEach(ex=>{const pe=progEx(ex.name);if(!ex.mode)ex.mode=pe?.mode||'reps';if(ex.rest==null&&pe)ex.rest=pe.rest;
    if(ex.perSide==null)ex.perSide=pe?pe.perSide:isUnilateral(ex.name);
    if(!ex.items&&pe&&pe.items)ex.items=pe.items;if(pe&&pe.mode==='rounds'&&ex.mode!=='rounds'&&!ex.sets.some(s=>s.weight||s.reps))ex.mode='rounds';});
  const bests={};
  const bestsFor=name=>{if(!bests[name])bests[name]=exerciseBests(exerciseHistory(workouts,name,{before:session.date,excludeId:session.id,ts:session.ts}));return bests[name];};
  SES={session,lastMap,drafting,bests,workouts,bestsFor};
  document.body.classList.add('session-mode');
  $('#sesTitle').innerHTML=`<b>${esc(session.title.split('—')[0].trim())}</b><span class="xs muted">${esc((session.title.split('—')[1]||'').trim())}</span>`;
  $('#sesFinish').textContent=drafting?'Finish':'Save';
  $('#sesBody').innerHTML=`
    <div class="row between" style="gap:10px;margin:2px 0 4px">
      <label class="fl" style="margin:0" for="woDate">Date</label><input id="woDate" type="date" value="${session.date}" style="max-width:190px">
    </div>
    <p class="xs muted" style="margin:0 0 4px">Tick a set when done — it fills in "same as last time", starts the rest, and lights up when you beat it${drafting?' · auto-saves':''}.</p>
    <div id="woBody">${sesBodyHtml()}</div>
    <div class="row" style="gap:6px;margin-top:14px"><input id="woNewEx" placeholder="Add an exercise (swap / extra)" style="flex:1" list="exNames2"><button class="btn sm sec" id="woAddEx" style="flex:none">Add</button></div>
    <datalist id="exNames2">${Object.values(EXBYID).sort((x,y)=>x.name.localeCompare(y.name)).map(x=>`<option value="${esc(x.name)}">`).join('')}</datalist>
    <label class="fl" for="woNotes">Session notes</label><textarea id="woNotes" placeholder="Energy, niggles, how it felt…">${esc(session.notes||'')}</textarea>
    <button class="btn" style="margin-top:14px;width:100%" id="woSave">${drafting?'Finish session':'Save changes'}</button>`;
  go('session');
  wireSession();
}
function phFor(ex,si){
  const prev=((SES.lastMap&&SES.lastMap[ex.name])||[])[si]||{};
  if(ex.mode==='rounds')return{secs:prev.secs||''};
  if(ex.mode==='time')return{secs:prev.secs||+((String(ex.target).match(/(\d+)\s*s/)||[])[1])||'',rest:prev.rest||ex.rest||''};
  return{reps:prev.reps||''};
}
function bestText(b,mode){
  if(!b)return '';
  if(mode==='reps'){if(b.bestW)return `Best: ${b.bestW.w||'bw'} × ${b.bestW.r}${b.bestE?` · e1RM ${b.bestE.e1rm} kg`:''}`;return '';}
  return b.bestSec?`Best: ${b.bestSec.secs} s`:'';
}
function sesBodyHtml(){
  const{session,lastMap,bestsFor}=SES;
  return session.exercises.map((ex,ei)=>{
    const timed=ex.mode==='time',rounds=ex.mode==='rounds';
    const lastAll=lastMap&&lastMap[ex.name];
    const last=lastAll&&lastAll.filter(s=>+s.weight||+s.reps||+s.secs||s.done); // only sets actually done
    let lastTxt='';
    if(last&&last.length){
      if(rounds){const done=last.filter(s=>s.secs||s.done);lastTxt=`Last: ${done.length} round${done.length===1?'':'s'}${done.some(s=>s.secs)?` (${done.map(s=>s.secs?s.secs+'s':'–').join(', ')})`:''}`;}
      else if(timed){const w=[...new Set(last.map(s=>s.secs||'–'))],r=[...new Set(last.map(s=>s.rest||''))].filter(Boolean);
        lastTxt=w.length===1&&r.length<=1?`Last: ${last.length} × ${w[0]}s work${r.length?` / ${r[0]}s rest`:''}`:`Last: ${last.map(s=>`${s.secs||'–'}s${s.rest?`/${s.rest}r`:''}`).join(', ')}`;}
      else lastTxt=`Last: ${last.map(s=>`${s.weight||'–'}×${s.reps||'–'}`).join(', ')}`;
    }
    const b=bestsFor(ex.name);const bt=rounds?'':bestText(b,timed?'time':'reps');
    const adv=last&&!rounds?(timed?timedAdvice(ex,last):progressionAdvice(ex.name,ex.target,last)):null;
    const c=exFind(ex.name);
    return `<div class="exblock" data-ex="${ei}">
      <div class="exhead"><button type="button" class="en exlink" data-exhist="${esc(ex.name)}" aria-label="History for ${esc(ex.name)}">${esc(ex.name)} <span class="chev">›</span></button><span class="et">${ex.target?`${esc(exTargetText(ex))}`:''}${ex.rest?` · rest ${restLabel(ex.rest)}`:''}</span></div>
      ${rounds&&ex.items&&ex.items.length?`<div class="lasthint">Each round: ${esc(itemsLabel(ex.items))}</div>`:''}
      ${c&&c.cues&&!(last&&last.length)?`<div class="xs muted" style="margin:0 0 6px 34px">${esc(c.cues)}</div>`:''}
      ${lastTxt||bt?`<div class="lasthint">${esc(lastTxt)}${lastTxt&&bt?' · ':''}${esc(bt)}${adv?` — <b>↑ ${esc(adv)}</b>`:''}</div>`:''}
      <div class="setrow${timed?' time':rounds?' rounds':''} sethead"><span class="si">#</span>${timed?'<span>WORK S</span><span>REST S</span>':rounds?'<span>ROUND TIME S (optional)</span>':`<span>KG</span><span>REPS${ex.perSide?' / '+sideWord(ex.name).toUpperCase():''}</span>`}<span></span></div>
      <div class="sets">${ex.sets.map((s,si)=>setRow(ei,si,s,ex,phFor(ex,si))).join('')}</div>
      <div class="prline hidden" data-prline="${ei}"></div>
      <button class="addset" data-addset="${ei}">+ ${timed?'interval':rounds?'round':'set'}</button></div>`;
  }).join('');
}
function setRow(ei,si,s,ex,ph){
  const tick=`<button type="button" class="si${s.done?' on':''}" data-tickset aria-label="Mark set ${si+1} done (starts rest timer)">${si+1}</button>`;
  if(ex&&ex.mode==='rounds')return `<div class="setrow rounds">${tick}<input type="number" inputmode="numeric" placeholder="${ph&&ph.secs?ph.secs:'time s'}" aria-label="Round ${si+1} time, seconds (optional)" value="${s.secs??''}"><button class="del" data-delset aria-label="Remove round ${si+1}">✕</button></div>`;
  if(ex&&ex.mode==='time')return `<div class="setrow time">${tick}<input type="number" inputmode="numeric" placeholder="${ph&&ph.secs?ph.secs:'0'}" aria-label="Interval ${si+1}, work seconds" value="${s.secs??''}"><input type="number" inputmode="numeric" placeholder="${ph&&ph.rest?ph.rest:'0'}" aria-label="Interval ${si+1}, rest seconds" value="${s.rest??''}"><button class="del" data-delset aria-label="Remove interval ${si+1}">✕</button></div>`;
  return `<div class="setrow">${tick}<input type="number" inputmode="decimal" placeholder="0" aria-label="Set ${si+1} weight, kg" value="${s.weight??''}"><input type="number" inputmode="numeric" placeholder="${ph&&ph.reps?ph.reps:'0'}" aria-label="Set ${si+1} reps${ex&&ex.perSide?' per '+sideWord(ex.name):''}" value="${s.reps??''}"><button class="del" data-delset aria-label="Remove set ${si+1}">✕</button></div>`;
}
/* PR check for one row against the exercise's pre-session bests; paints the row + the PR line. */
function paintPR(row,ex,ei){
  const ins=row.querySelectorAll('input');const mode=ex.mode||'reps';
  const s=mode==='time'?{secs:ins[0].value,rest:ins[1].value}:mode==='rounds'?{secs:ins[0].value}:{weight:ins[0].value,reps:ins[1].value};
  const b=SES.bestsFor(ex.name);
  const k=mode==='rounds'||!b.sessions?null:setPR(s,b,mode==='time'?'time':'reps');
  row.classList.toggle('pr',!!k&&k!=='first');
  const line=$(`[data-prline="${ei}"]`);if(!line)return;
  const prs=[...row.parentElement.querySelectorAll('.setrow.pr')];
  if(prs.length){let best=null;for(const r of prs){const i2=r.querySelectorAll('input');const s2=mode==='time'?{secs:i2[0].value}:{weight:i2[0].value,reps:i2[1].value};const k2=setPR(s2,b,mode==='time'?'time':'reps');const rank={weight:3,e1rm:2,time:2,reps:1}[k2]||0;if(!best||rank>best.rank)best={rank,k:k2,s:s2};}
    line.textContent='🏆 PB — '+prLabel(best.k,best.s);line.classList.remove('hidden');}
  else line.classList.add('hidden');
}
function wireSession(){
  const{session,lastMap,drafting}=SES;
  const root=$('#woBody');
  const collect=()=>{ // DOM → session (single source of truth for save, draft, and redraws)
    session.date=$('#woDate').value;session.notes=$('#woNotes').value.trim();
    session.exercises.forEach((ex,ei)=>{const rows=$$(`[data-ex="${ei}"] .sets .setrow`,root);
      ex.sets=rows.map(r=>{const ins=r.querySelectorAll('input');const done=r.querySelector('[data-tickset]').classList.contains('on');
        return ex.mode==='time'?{secs:ins[0].value,rest:ins[1].value,done}:ex.mode==='rounds'?{secs:ins[0].value,done}:{weight:ins[0].value,reps:ins[1].value,done};});});
  };
  let draftT=null;
  const saveDraft=async()=>{if(!drafting||!document.body.contains(root))return;collect();await idbPut('kv',{k:'woDraft',v:session});};
  const saveDraftSoon=()=>{if(!drafting)return;clearTimeout(draftT);draftT=setTimeout(saveDraft,400);};
  root.addEventListener('click',e=>{
    const a=e.target.closest('[data-addset]');
    if(a){const ei=+a.dataset.addset;const ex=session.exercises[ei];const setsDiv=root.querySelector(`[data-ex="${ei}"] .sets`);
      const si=setsDiv.children.length;
      setsDiv.insertAdjacentHTML('beforeend',setRow(ei,si,ex.mode==='time'?{secs:'',rest:''}:ex.mode==='rounds'?{secs:''}:{weight:'',reps:''},ex,phFor(ex,si)));
      saveDraftSoon();return;}
    const tk=e.target.closest('[data-tickset]');
    if(tk){const on=tk.classList.toggle('on');
      const row=tk.closest('.setrow');const ex=session.exercises[+tk.closest('[data-ex]').dataset.ex];
      if(on){ // tick = "done as planned": materialize the greyed-in suggestion, then rest
        row.querySelectorAll('input').forEach(inp=>{if(!inp.value&&+inp.placeholder)inp.value=inp.placeholder;});
        // timed exercises rest for THIS interval's rest value (so cutting 20 → 15 s takes effect immediately)
        const rsec=ex.mode==='time'?(+row.querySelectorAll('input')[1].value||ex.rest||30):ex.mode==='rounds'?(ex.rest||45):(ex.rest||90);
        buzz();startRest(rsec);
        paintBeat(row,ex);paintPR(row,ex,+tk.closest('[data-ex]').dataset.ex);}
      saveDraftSoon();return;}
    const d=e.target.closest('[data-delset]');if(d){const ei=+d.closest('[data-ex]').dataset.ex;d.closest('.setrow').remove();const line=$(`[data-prline="${ei}"]`);if(line&&!root.querySelector(`[data-ex="${ei}"] .setrow.pr`))line.classList.add('hidden');saveDraftSoon();}});
  const paintBeat=(row,ex)=>{ // beat-last-session highlight: volt row when this set beats last time's same set
    const sets=row.parentElement;if(!sets.classList.contains('sets'))return;
    const si=[...sets.children].indexOf(row);
    const prev=((lastMap&&lastMap[ex.name])||[])[si];
    const ins=row.querySelectorAll('input');
    if(ex.mode==='time'){const sv=+ins[0].value||0,rv=+ins[1].value||0;
      row.classList.toggle('beat',!!(prev&&sv&&(sv>+(prev.secs||0)||(sv===+(prev.secs||0)&&rv&&+(prev.rest||0)&&rv<+prev.rest))));return;}
    if(ex.mode==='rounds')return;
    const w=+ins[0].value||0,r=+ins[1].value||0;
    row.classList.toggle('beat',!!(prev&&w&&r&&(w>+prev.weight||(w===+prev.weight&&r>+prev.reps))));
  };
  root.addEventListener('input',e=>{
    if(!e.target.matches('.setrow input'))return;
    saveDraftSoon();
    const exEl=e.target.closest('[data-ex]');if(!exEl)return;
    const row=e.target.closest('.setrow');const ex=session.exercises[+exEl.dataset.ex];
    paintBeat(row,ex);paintPR(row,ex,+exEl.dataset.ex);
  });
  $('#woDate').addEventListener('change',saveDraftSoon);
  $('#woNotes').addEventListener('input',saveDraftSoon);
  $('#woAddEx').onclick=()=>{
    const name=$('#woNewEx').value.trim();if(!name)return;
    collect();
    const pe=progEx(name),c=exFind(name); // known exercise (from the plan or the catalog) brings its target/mode/rest along
    session.exercises.push({name:c?c.name:name,target:pe?.target||'',tgt:pe?.tgt,items:pe?.items,mode:pe?.mode||(c&&c.metric==='time'?'time':'reps'),rest:pe?.rest||(c?c.defaultRest:undefined),perSide:pe?pe.perSide:isUnilateral(name),
      sets:[pe?.mode==='time'||(!pe&&c&&c.metric==='time')?{secs:'',rest:''}:pe?.mode==='rounds'?{secs:''}:{weight:'',reps:''}]});
    root.innerHTML=sesBodyHtml();$('#woNewEx').value='';
    saveDraftSoon();toast(`${name} added to this session`);};
  const finish=async()=>{
    collect();
    const prs=sessionPRs(session,SES.workouts);session.prs=prs;
    await idbPut('workouts',session);
    if(drafting)await idbDel('kv','woDraft');
    buzz();
    toast(prs.length?`Session saved · ${prs.length} PB${prs.length>1?'s':''} 🏆`:'Session saved 💪');
    curDate=session.date;SES=null;go('train');renderToday();
    if(prs.length)setTimeout(()=>toast(prs.map(p=>`${p.name}: ${p.text}`).join(' · ')),1900);};
  $('#woSave').onclick=finish;$('#sesFinish').onclick=finish;
  // NOTE: deliberately no saveDraft() here. Merely *opening* a day used to write a
  // draft, so an accidental tap left a phantom "unfinished session" that nagged you.
  // The draft is created by the first real input (keystroke, tick, added set).
}
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
async function openWorkout(id){const w=await idbGet('workouts',id);if(!w)return toast('That session no longer exists');const all=(await idbGetAll('workouts')).filter(x=>x.dayKey===w.dayKey&&x.date<w.date).sort((a,b)=>a.date<b.date?1:-1);const lastMap={};if(all[0])all[0].exercises.forEach(e=>lastMap[e.name]=e.sets);drawSession(w,lastMap,false);}
// Screen wake lock: keep the phone awake while a session is open.
// The OS releases the lock whenever the tab is hidden, so re-acquire on return.
let wakeLock=null,wantWake=false;
async function wakeOn(){wantWake=true;if(!('wakeLock'in navigator)||wakeLock)return;try{wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null;});}catch(e){wakeLock=null;}}
function wakeOff(){wantWake=false;try{if(wakeLock)wakeLock.release();}catch(e){}wakeLock=null;}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&wantWake)wakeOn();});

/* ---------- Exercise history screen (#view-exhist) ---------- */
let exhistName=null,exhistFrom='train';
async function renderExHist(name){
  if(name)exhistName=name;name=exhistName;if(!name)return;
  const workouts=await idbGetAll('workouts');
  const hist=exerciseHistory(workouts,name);
  const b=exerciseBests(hist);
  const c=exFind(name);
  const mode=hist.length?hist[hist.length-1].mode:(c&&c.metric==='time'?'time':'reps');
  $('#exhTitle').textContent=c?c.name:name;
  const kpi=(v,l)=>`<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const stats=mode==='reps'
    ?[kpi(b.bestW?`${b.bestW.w||'bw'}×${b.bestW.r}`:'–','heaviest set'),kpi(b.bestE?b.bestE.e1rm+' kg':'–','est. 1RM'),kpi(b.bestVol?`${b.bestVol.w}×${b.bestVol.r}`:'–','best volume set'),kpi(hist.length,'sessions')]
    :[kpi(b.bestSec?b.bestSec.secs+' s':'–','longest'),kpi(hist.length,'sessions'),kpi(hist.length?niceDate(hist[hist.length-1].date):'–','last done')];
  const rows=hist.slice().reverse().slice(0,12).map(h=>`<div class="entry" role="button" tabindex="0" data-openwo="${esc(h.woId)}"><div><div class="n">${niceDate(h.date)}</div><div class="s">${h.sets.map(fmtSet).join(' · ')}${h.tonnage?` · ${fmtKg(h.tonnage)}`:''}</div></div><span class="pillbtn">${h.top?(h.top.e1rm!=null?`e1RM ${h.top.e1rm}`:h.top.secs!=null?`${h.top.secs}s`:'✓'):''}</span></div>`).join('');
  $('#exhBody').innerHTML=`
    ${c?`<p class="sm muted" style="margin:0 0 10px">${(c.primary||[]).join(', ')}${c.equipment.filter(t=>t!=='none').length?' · '+c.equipment.join(', '):''}${c.unilateral?` · reps per ${sideWord(c)}`:''}${c.cues?`<br>${esc(c.cues)}`:''}</p>`:''}
    <div class="kpis" style="grid-template-columns:repeat(${stats.length},1fr)">${stats.join('')}</div>
    ${hist.length>1?`<div class="card" style="margin-top:12px"><div class="row between"><b>${mode==='reps'?'Estimated 1RM':'Longest interval'} over time</b><span class="xs muted">${hist.length} sessions</span></div><canvas id="exhChart" height="150" style="width:100%;margin-top:6px"></canvas></div>`:''}
    <h3 style="font-size:15px;margin:16px 0 6px">Sessions</h3>
    ${rows||'<div class="empty">Not logged yet — it will show up here after your first session.</div>'}`;
  if(hist.length>1)drawSimpleLine($('#exhChart'),hist.map(h=>({x:h.date,y:h.top?(h.top.e1rm!=null?h.top.e1rm:h.top.secs||0):0})),mode==='reps'?' kg':' s');
}
function drawSimpleLine(canvas,pts,unit){
  if(!canvas||!pts.length)return;
  const dpr=window.devicePixelRatio||1,W=canvas.clientWidth||300,H=150;canvas.width=W*dpr;canvas.height=H*dpr;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const cs=getComputedStyle(document.documentElement);const line=cs.getPropertyValue('--line').trim()||'#333',brand=cs.getPropertyValue('--brand').trim()||'#D6F62F',muted=cs.getPropertyValue('--muted').trim()||'#888';
  const ys=pts.map(p=>p.y);let lo=Math.min(...ys),hi=Math.max(...ys);if(hi===lo){hi=lo+1;lo=Math.max(0,lo-1);}
  const pad={l:34,r:8,t:8,b:20};const x=i=>pad.l+(pts.length===1?0:(W-pad.l-pad.r)*i/(pts.length-1));const y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-lo)/(hi-lo));
  ctx.strokeStyle=line;ctx.lineWidth=1;ctx.beginPath();for(const v of [lo,(lo+hi)/2,hi]){ctx.moveTo(pad.l,y(v));ctx.lineTo(W-pad.r,y(v));}ctx.stroke();
  ctx.fillStyle=muted;ctx.font='11px system-ui';ctx.textAlign='right';for(const v of [lo,(lo+hi)/2,hi])ctx.fillText(rnd(v)+unit,pad.l-4,y(v)+4);
  ctx.textAlign='center';ctx.fillText(niceDate(pts[0].x),x(0)+20,H-4);ctx.fillText(niceDate(pts[pts.length-1].x),x(pts.length-1)-20,H-4);
  ctx.strokeStyle=brand;ctx.lineWidth=2;ctx.beginPath();pts.forEach((p,i)=>{i?ctx.lineTo(x(i),y(p.y)):ctx.moveTo(x(i),y(p.y));});ctx.stroke();
  ctx.fillStyle=brand;pts.forEach((p,i)=>{ctx.beginPath();ctx.arc(x(i),y(p.y),3,0,Math.PI*2);ctx.fill();});
}
