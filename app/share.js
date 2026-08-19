/* ============================ INVITES & PLAN SHARING (v3 stage 5) ============================
   Invites: any signed-in user creates a code → QR / link (?invite=CODE) → the invitee's sign-up
   carries it as metadata → the DB trigger consumes it (see supabase-schema.sql). Sign-up form
   pre-checks the code through the anon RPC invite_valid().
   Sharing: a plan is shared BY EMAIL as a snapshot row in plan_shares; the recipient sees it on
   their next launch/sync, previews it, and imports a COPY (source 'shared') into their library —
   their logs, targets and meals stay their own. Kit mismatches are flagged for adaptation. */
function inviteCode(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';const r=crypto.getRandomValues(new Uint8Array(8));for(const b of r)s+=A[b%A.length];return s;}
function inviteLink(code){return location.origin+location.pathname+'?invite='+encodeURIComponent(code);}
async function inviteModal(){
  if(!authSignedIn())return toast('Sign in first — invites are tied to your account');
  openModal(`<div class="mh"><h3>Invite someone</h3><button class="x" onclick="closeModal()">✕</button></div>
   <p class="sm" style="margin:0 0 10px">They scan the code (or open the link), create an account, answer the setup questions, and the coach builds their own plan. Each code works once.</p>
   <div class="row" style="gap:8px"><input id="invNote" placeholder="Who is it for? (optional)" style="flex:1"><button class="btn sm" id="invNew">New invite</button></div>
   <div id="invOut" style="margin-top:12px"></div>
   <div id="invList" style="margin-top:12px"></div>`);
  const paintList=async()=>{try{const res=await sb('/rest/v1/invites?select=code,note,created_at,used_at&order=created_at.desc&limit=20');const rows=res.ok?await res.json():[];
    $('#invList').innerHTML=rows.length?`<label class="fl">Your invites</label>${rows.map(r=>`<div class="entry"><div><div class="n" style="font-family:var(--font-display);letter-spacing:.08em">${esc(r.code)}</div><div class="s">${esc(r.note||'')}${r.used_at?' · used '+niceDate(r.used_at.slice(0,10)):' · unused'}</div></div>${r.used_at?'':`<button class="pillbtn" data-invshow="${esc(r.code)}">Show</button>`}</div>`).join('')}`:'';}catch{}};
  const show=code=>{const link=inviteLink(code);$('#invOut').innerHTML=`<div class="card" style="text-align:center"><div style="font-family:var(--font-display);font-size:26px;letter-spacing:.12em">${esc(code)}</div><canvas id="invQr" style="width:min(240px,70vw);margin:10px auto;display:block"></canvas><input id="invLink" readonly value="${esc(link)}" style="text-align:center"><div class="btnrow" style="margin-top:8px"><button class="btn sec sm" id="invCopy">Copy link</button>${navigator.share?'<button class="btn sec sm" id="invShare">Share…</button>':''}</div></div>`;
    try{drawQR($('#invQr'),link);}catch{}
    $('#invCopy').onclick=async()=>{try{await navigator.clipboard.writeText(link);}catch{$('#invLink').select();document.execCommand('copy');}toast('Link copied');};
    const sh=$('#invShare');if(sh)sh.onclick=()=>navigator.share({title:'Join me on FitTrack',text:'Your invite code: '+code,url:link}).catch(()=>{});};
  $('#invNew').onclick=async()=>{const code=inviteCode();const note=$('#invNote').value.trim();
    const res=await sb('/rest/v1/invites',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({code,note})});
    if(!res.ok)return toast('Could not create invite ('+res.status+') — is the schema up to date?');
    show(code);paintList();};
  $('#invList').onclick=e=>{const b=e.target.closest('[data-invshow]');if(b)show(b.dataset.invshow);};
  paintList();
}
/* Called by the sign-up form before submitting. */
async function inviteValid(code){
  try{const res=await sb('/rest/v1/rpc/invite_valid',{method:'POST',body:JSON.stringify({p_code:code})},false);if(!res.ok)return null;return await res.json()===true;}catch{return null;}
}

/* ---------- sharing ---------- */
async function sharePlanModal(planId){
  const plan=PLANS.find(p=>p.id===planId);if(!plan)return;
  if(!authSignedIn())return toast('Sign in to share plans');
  openModal(`<div class="mh"><h3>Share “${esc(plan.name)}”</h3><button class="x" onclick="closeModal()">✕</button></div>
   <p class="sm" style="margin:0 0 10px">Enter the FitTrack email of the person. They get a copy in their plan library — with their own logs, targets and meals. Your copy stays yours.</p>
   <label class="fl" for="shEmail">Their email</label><input id="shEmail" type="email" inputmode="email" autocapitalize="off" placeholder="name@example.com">
   <button class="btn" id="shSend" style="margin-top:12px;width:100%">Share plan</button>`);
  $('#shSend').onclick=async()=>{const to=$('#shEmail').value.trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to))return toast('Enter a valid email');
    const snap={name:plan.name,description:plan.description||'',days:plan.days,schedule:plan.schedule,weeks:plan.weeks||null,sourcePlanId:plan.id};
    const res=await sb('/rest/v1/plan_shares',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({to_email:to,from_email:(authUser()||{}).email||'',plan:snap})});
    if(!res.ok)return toast('Share failed ('+res.status+')');
    closeModal();toast(`Shared with ${to} — they’ll see it next time they open FitTrack`);};
}
/* On launch/sync: anything shared with me that I haven't handled yet? */
let sharesChecked=false;
async function checkPlanShares(force){
  if(!authSignedIn()||!navigator.onLine||(sharesChecked&&!force))return;
  if(curView==='onboard'||curView==='session'){sharesChecked=false;return;} // never interrupt setup or a workout — finishToApp() re-checks
  sharesChecked=true;
  let rows=[];try{const res=await sb('/rest/v1/plan_shares?select=id,from_email,plan,created_at&claimed_at=is.null&order=created_at.asc');if(res.ok)rows=await res.json();}catch{return;}
  const me=((authUser()||{}).email||'').toLowerCase();
  for(const r of rows.filter(r=>true))await offerSharedPlan(r);
}
function planKitIssues(plan){
  const out=[];for(const[k,d]of Object.entries(plan.days||{}))for(const e of d.ex||[]){const c=exFind(e.name);if(c&&!exAvailable(c))out.push(`${e.name} (Day ${k}: ${exMissing(c).join(', ')})`);}return out;
}
function offerSharedPlan(r){
  return new Promise(resolve=>{
    const p=r.plan||{};const days=Object.entries(p.days||{});const issues=planKitIssues(p);
    openModal(`<div class="mh"><h3>Plan shared with you</h3><button class="x" id="shLater">✕</button></div>
      <p class="sm" style="margin:0 0 6px"><b>${esc(r.from_email||'Someone')}</b> shared <b>${esc(p.name||'a plan')}</b>${p.description?` — ${esc(p.description)}`:''}.</p>
      ${days.map(([k,d])=>`<div class="sm"><b>${esc(d.title||('Day '+k))}</b>: ${(d.ex||[]).map(e=>esc(e.name)).join(' · ')}</div>`).join('')}
      ${issues.length?`<div class="sm" style="margin-top:8px;color:var(--danger)">Needs kit you don’t have: ${esc(issues.join('; '))} — you can adapt it after importing.</div>`:''}
      <div class="btnrow" style="margin-top:12px"><button class="btn" id="shAdd">Add to my plans</button><button class="btn ghost" id="shNo">No thanks</button></div>
      <p class="xs muted" style="margin:8px 0 0">You get your own copy; your logs, targets and meals stay yours.</p>`);
    const done=async(status)=>{try{await sb('/rest/v1/plan_shares?id=eq.'+encodeURIComponent(r.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({claimed_at:new Date().toISOString(),status})});}catch{}closeModal();resolve();};
    $('#shAdd').onclick=async()=>{const plan={id:'plan-'+uid(),name:p.name||'Shared plan',description:p.description||'',days:p.days||{},schedule:p.schedule||{},source:'shared',sharedFrom:{email:r.from_email,shareId:r.id,planId:p.sourcePlanId,at:Date.now()},createdAt:Date.now()};
      for(const d of Object.values(plan.days))for(const e of d.ex||[])normalizeTarget(e);
      await idbPut('plans',plan);await loadProgram();
      const makeActive=confirm(`Added “${plan.name}” to your plans. Make it your active plan now?`);
      if(makeActive)await setActivePlan(plan.id);
      await done('accepted');toast(makeActive?'Now following '+plan.name:'Saved to your plan library');if(typeof renderTrainStart==='function')renderTrainStart();};
    $('#shNo').onclick=()=>done('declined');
    $('#shLater').onclick=()=>{closeModal();resolve();};
  });
}
