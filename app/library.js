/* ============================ EXERCISE LIBRARY (v3 stage 2) ============================
   A full-screen view (not a modal): search + filter the catalog, open an exercise
   for its muscles, kit, cues, per-side rule, equipment-aware alternatives and your
   own history with it. Also the source of the "swap for" logic the coach will use. */
let libQ='',libPattern='',libMine=false,libOpen=null;

/* Which catalog equipment tokens the user's gym satisfies (see DEFAULT_EQUIPMENT / My gym). */
function hasEquip(tok){
  const eq=EQUIP||{};if(eq.commercial)return true;
  const gear=(eq.gear||[]).join(' ').toLowerCase();
  switch(tok){
    case 'none':return true;
    case 'barbell':return (eq.bars||[]).length>0;
    case 'plate':return (eq.plates||[]).length>0;
    case 'dumbbell':return (eq.dumbbells||[]).length>0;
    case 'kettlebell':return (eq.kettlebells||[]).length>0;
    case 'band':return (eq.bands||[]).length>0;
    case 'rack':return /rack/.test(gear);
    case 'bench':return /bench/.test(gear);
    case 'pull-up-bar':return /pull.?up/.test(gear);
    case 'dip-station':return /dip/.test(gear);
    case 'pulley':return /pulley|cable/.test(gear);
    case 'box':return /box|step|plyo/.test(gear);
    case 'rope':return /rope|skip/.test(gear);
    case 'ez-bar':return /ez/.test(gear)||(eq.bars||[]).some(b=>/ez/i.test(b.name||''));
    case 'trap-bar':return /trap|hex/.test(gear)||(eq.bars||[]).some(b=>/trap|hex/i.test(b.name||''));
    default:return new RegExp(tok.replace(/-/g,'[ -]?')).test(gear);
  }
}
function exAvailable(ex){return (ex.equipment||[]).every(hasEquip);}
function exMissing(ex){return (ex.equipment||[]).filter(t=>!hasEquip(t));}
/* Same job, different kit: same pattern (or same primary muscle for isolation/core), shares the
   main muscle; available-with-my-gym first, then same load type, then name. */
function exAlternatives(ex,n=6){
  const all=Object.values(EXBYID).filter(c=>c.id!==ex.id&&c.pattern!=='mobility');
  const p0=(ex.primary||[])[0];
  const cands=all.filter(c=>{
    const shares=(c.primary||[]).some(m=>(ex.primary||[]).includes(m));
    if(!shares)return false;
    if(ex.pattern==='isolation'||ex.pattern==='core'||ex.pattern==='conditioning'||ex.pattern==='carry')return (c.primary||[])[0]===p0||c.pattern===ex.pattern&&shares;
    return c.pattern===ex.pattern;
  });
  cands.sort((a,b)=>(exAvailable(b)-exAvailable(a))||((b.loadType===ex.loadType)-(a.loadType===ex.loadType))||a.name.localeCompare(b.name));
  return cands.slice(0,n);
}
async function exHistory(ex){ // sessions that logged this exercise (by name/alias), best set, last date
  const wos=await idbGetAll('workouts');
  const rows=[];
  for(const w of wos)for(const e of w.exercises||[]){const c=exFind(e.name);if((c&&c.id===ex.id)||exKey(e.name)===exKey(ex.name))rows.push({date:w.date,sets:e.sets||[],mode:e.mode});}
  rows.sort((a,b)=>a.date<b.date?1:-1);
  let best=null;
  for(const r of rows)for(const s of r.sets){const wgt=+s.weight||0,rep=+s.reps||0,sec=+s.secs||0;
    if(rep&&(!best||wgt>best.w||(wgt===best.w&&rep>best.r)))best={w:wgt,r:rep,date:r.date};
    if(!rep&&sec&&(!best||(best.sec||0)<sec))best={sec,date:r.date};}
  return{count:rows.length,last:rows[0]?.date||null,best};
}
function renderLibrary(){
  const all=Object.values(EXBYID).sort((a,b)=>a.name.localeCompare(b.name));
  const q=exKey(libQ);
  const list=all.filter(c=>(!libPattern||c.pattern===libPattern||c.region===libPattern)&&(!libMine||exAvailable(c))&&(!q||exKey(c.name).includes(q)||(c.aliases||[]).some(a=>exKey(a).includes(q))||(c.primary||[]).some(m=>m.includes(q))));
  const groups={};for(const c of list)(groups[c.pattern]=groups[c.pattern]||[]).push(c);
  const patName=p=>({squat:'Squat',hinge:'Hinge',lunge:'Lunge / single-leg','horizontal-push':'Horizontal push','vertical-push':'Vertical push','horizontal-pull':'Horizontal pull','vertical-pull':'Vertical pull',carry:'Carries',core:'Core',isolation:'Isolation',conditioning:'Conditioning',mobility:'Mobility'}[p]||p);
  const chips=['', ...EX_PATTERNS].map(p=>`<button class="chip${libPattern===p?' on':''}" data-libpat="${p}">${p?patName(p):'All'}</button>`).join('');
  $('#libBody').innerHTML=`
   <input id="libQ" type="search" placeholder="Search ${all.length} exercises…" value="${esc(libQ)}" aria-label="Search exercises" autocomplete="off">
   <div class="chips" style="margin:8px 0">${chips}</div>
   <label class="pillbtn" style="display:inline-flex;align-items:center;cursor:pointer;margin-bottom:8px"><input type="checkbox" id="libMine" ${libMine?'checked':''} style="width:auto;margin-right:6px">Only what my gym can do</label>
   <div class="xs muted" style="margin-bottom:6px">${list.length} exercise${list.length===1?'':'s'}</div>
   ${Object.keys(groups).length?Object.entries(groups).map(([p,items])=>`<div class="grp">${patName(p)}</div>${items.map(c=>libRow(c)).join('')}`).join(''):'<div class="empty">Nothing matches — try another word.</div>'}`;
  const qi=$('#libQ');qi.oninput=()=>{libQ=qi.value;const pos=qi.selectionStart;renderLibrary();const n=$('#libQ');n.focus();n.setSelectionRange(pos,pos);};
  $('#libMine').onchange=e=>{libMine=e.target.checked;renderLibrary();};
  if(libOpen&&list.some(c=>c.id===libOpen))paintLibDetail(libOpen);
}
function libRow(c){
  const avail=exAvailable(c);
  return `<div class="foodrow libx${libOpen===c.id?' open':''}" role="button" tabindex="0" data-libex="${esc(c.id)}">
    <div><div class="n">${esc(c.name)}${c.unilateral?` <span class="xs muted">· per ${sideWord(c)}</span>`:''}</div>
    <div class="s">${(c.primary||[]).join(', ')}${c.equipment.filter(t=>t!=='none').length?' · '+c.equipment.join(', '):' · no kit'}${avail?'':' · <span class="warnx">missing kit</span>'}</div></div>
    <span class="pillbtn">${libOpen===c.id?'▾':'›'}</span></div>
    <div class="libdetail${libOpen===c.id?'':' hidden'}" data-libdetail="${esc(c.id)}"></div>`;
}
async function paintLibDetail(id){
  const c=EXBYID[id];const box=$(`[data-libdetail="${CSS.escape(id)}"]`);if(!c||!box)return;
  const h=await exHistory(c);
  const alts=exAlternatives(c);
  const miss=exMissing(c);
  box.innerHTML=`<div class="card" style="margin:6px 0 10px">
    ${c.cues?`<p style="margin:0 0 8px"><b>How:</b> ${esc(c.cues)}</p>`:''}
    <div class="sm"><b>Works:</b> ${(c.primary||[]).join(', ')}${(c.secondary||[]).length?` <span class="muted">(+ ${c.secondary.join(', ')})</span>`:''}</div>
    <div class="sm"><b>Kit:</b> ${c.equipment.filter(t=>t!=='none').length?c.equipment.map(t=>`<span class="${hasEquip(t)?'':'warnx'}">${esc(t)}${hasEquip(t)?'':' ✗'}</span>`).join(', '):'none needed'}</div>
    <div class="sm"><b>Logged as:</b> ${c.metric==='time'?'time':'kg × reps'}${c.unilateral?` — <b>reps are per ${sideWord(c)}</b>`:''}${c.loadType==='bw'?' · bodyweight':c.loadType==='bw+'?' · bodyweight (+ load)':c.loadType==='band'?' · band':''} · rest ${restLabel(c.defaultRest)}</div>
    <div class="sm"><b>Your history:</b> ${h.count?`${h.count} session${h.count===1?'':'s'} · last ${niceDate(h.last)}${h.best?` · best ${h.best.sec?h.best.sec+' s':`${h.best.w||'bw'} × ${h.best.r}`}`:''}`:'not logged yet'}</div>
    ${alts.length?`<div class="sm" style="margin-top:8px"><b>${miss.length?'Swap for:':'Alternatives:'}</b> ${alts.map(a=>`<button class="chip${exAvailable(a)?'':' dim'}" data-libgo="${esc(a.id)}">${esc(a.name)}</button>`).join(' ')}</div>`:''}
  </div>`;
}

/* ---------- Adaptation: kit changed → which plan exercises no longer fit, and what to swap in ----------
   Deterministic (catalog alternatives that fit the remaining kit) so it works offline; the coach
   is one tap away for judgement calls. Shown on My gym and on Train whenever something is off. */
function planAffected(){
  const out=[];
  for(const[k,d]of Object.entries(PROG.days||{}))d.ex.forEach((e,i)=>{const c=exFind(e.name);if(c&&!exAvailable(c)){const alt=exAlternatives(c,6).find(a=>exAvailable(a))||null;out.push({dayKey:k,idx:i,ex:e,cat:c,missing:exMissing(c),alt});}});
  return out;
}
function renderAdaptCard(targetSel){
  const el=$(targetSel);if(!el)return;
  const aff=planAffected();
  if(!aff.length){el.innerHTML='';return;}
  el.innerHTML=`<div class="card" style="border-color:var(--danger)"><b>Your plan needs kit you don’t have</b>
    <ul class="sm" style="margin:6px 0 0 16px">${aff.map(a=>`<li><b>${esc(a.ex.name)}</b> <span class="muted">(Day ${esc(a.dayKey)}, needs ${esc(a.missing.join(', '))})</span>${a.alt?` → <b>${esc(a.alt.name)}</b>`:' → no fitting alternative found'}</li>`).join('')}</ul>
    <div class="btnrow" style="margin-top:10px"><button class="btn sm" data-adaptapply ${aff.some(a=>a.alt)?'':'disabled'}>Apply swaps</button><button class="btn ghost sm" data-adaptcoach>Ask the coach</button></div></div>`;
}
async function applyAdaptSwaps(){
  const aff=planAffected().filter(a=>a.alt);if(!aff.length)return;
  const lines=aff.map(a=>`${a.ex.name} → ${a.alt.name}`);
  if(!confirm(`Swap ${aff.length} exercise${aff.length>1?'s':''} for what your gym can do?\n\n${lines.join('\n')}\n\nSets, reps and rest are kept.`))return;
  for(const a of aff){const e=PROG.days[a.dayKey].ex[a.idx];e.name=a.alt.name;e.perSide=a.alt.unilateral;if(a.alt.metric==='time'&&e.mode==='reps'){e.mode='time';e.tgt={sets:e.tgt?.sets||8,secs:40};}e.target=targetLabel(e.tgt,e.perSide?sideWord(a.alt):false);}
  await saveProgram();toast('Plan adapted to your kit');
  renderAdaptCard('#gymAdapt');renderAdaptCard('#trainAdapt');if(typeof renderTrainStart==='function')renderTrainStart();
}
function askCoachAboutKit(){
  const aff=planAffected();
  coachOpenWith(aff.length?`My gym changed. These exercises need kit I don't have: ${aff.map(a=>`${a.ex.name} (Day ${a.dayKey})`).join(', ')}. Please suggest the best substitutes for my equipment and update the plan.`:'My gym just changed — please look at my equipment and suggest any exercises I should add or upgrade in my plan.');
}
