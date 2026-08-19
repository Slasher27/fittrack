/* ============================ SETTINGS ============================ */
function settingsModal(){
  const T=SET.targets;
  openModal(`<div class="mh"><h3>Settings</h3><button class="x" onclick="closeModal()">✕</button></div>
   <label class="fl">Appearance</label>
   <div class="seg" id="stTheme" style="margin-bottom:4px">
     <button data-th="auto">Auto</button><button data-th="light">Light</button><button data-th="dark">Dark</button>
   </div>
   <label class="fl">Daily targets</label>
   <div class="in2"><div><span class="xs muted">Calories</span><input id="stK" type="number" value="${T.kcal}"></div><div><span class="xs muted">Protein g</span><input id="stP" type="number" value="${T.protein}"></div></div>
   <div class="in2" style="margin-top:8px"><div><span class="xs muted">Carbs g</span><input id="stC" type="number" value="${T.carbs}"></div><div><span class="xs muted">Fat g</span><input id="stF" type="number" value="${T.fat}"></div></div>
   <div class="in2" style="margin-top:8px"><div><span class="xs muted">Training-day kcal (optional)</span><input id="stKT" type="number" inputmode="numeric" placeholder="e.g. 2300" value="${T.kcalTrain||''}"></div><div><span class="xs muted">&nbsp;</span><span class="xs muted" style="display:block;padding-top:12px">Used on Mon/Wed/Fri &amp; logged-workout days</span></div></div>
   <div class="in2" style="margin-top:10px"><div><label class="fl">Start weight (kg)</label><input id="stSW" type="number" step="0.1" value="${SET.startWeight}"></div><div><label class="fl">Goal weight (kg)</label><input id="stGW" type="number" step="0.1" value="${SET.goalWeight}"></div></div>
   <label class="fl">Profile</label>
   <div class="row between"><div class="sm">${typeof PROFILE!=='undefined'&&PROFILE?`${esc(String(PROFILE.age))} y · ${esc(String(PROFILE.weightKg))} kg · goal ${esc(PROFILE.goal?.type||'')}`:'Not set up yet'}</div><button class="btn sec sm" id="stProfile">${typeof PROFILE!=='undefined'&&PROFILE?'Edit profile':'Set up'}</button></div>
   <label class="fl">Account</label>
   ${authUser()?`<div class="row between"><div><b>${esc(authUser().email||'')}</b><div class="xs muted" id="sbStatus">Checking…</div></div><button class="btn sec sm" id="sbSyncNow">Sync now</button></div>
   <div class="btnrow" style="margin-top:8px"><button class="btn sec sm" id="sbInvite">Invite someone</button><button class="btn ghost sm" id="sbSignOut">Sign out of this device</button></div>
   <p class="xs muted" style="margin:6px 0 0">Your food, meals, measurements, workouts and program sync to your account automatically — sign in on any device to get them. Photos stay on this device for now.</p>`
   :`<div class="row between"><div><b>Not signed in</b><div class="xs muted">Data stays on this device only</div></div><button class="btn sec sm" id="sbSignIn">Sign in</button></div>
   <p class="xs muted" style="margin:6px 0 0">Sign in (or create an account) to back up this device and use the same data on your phone, tablet and desktop. Everything already logged here comes with you.</p>`}
   <label class="fl">AI assistant key (optional)</label>
   <div class="row" style="gap:8px"><input id="stAI" type="password" autocomplete="off" style="flex:1"
     placeholder="${SET.aiKey?'Key saved — leave blank to keep it':'Anthropic API key (sk-ant-…)'}">${
     SET.aiKey?`<button class="btn ghost sm" id="stAIClear" style="flex:none">Remove</button>`:''}</div>
   <p class="xs muted" style="margin:6px 0 0">Stored only on this device${SET.aiKey?' — never synced, and stripped from backups':''}. Powers “Ask” on the 📖 Plan screen; without it, Ask searches the plan offline.</p>
   <label class="fl">Notifications</label>
   <div class="row between"><span class="sm" id="ntStatus">…</span><button class="btn sec sm" id="ntBtn">Enable</button></div>
   <p class="xs muted" style="margin:6px 0 0">Coach alerts when you open the app, plus training-day &amp; log reminders on Android (installed app). On iPhone, alerts only appear while the app is open — Apple requires a push server for background delivery, which FitTrack deliberately doesn't use.</p>
   <button class="btn" style="margin-top:16px" id="stSave">Save settings</button>
   <div class="btnrow" style="margin-top:10px"><button class="btn ghost" id="stExport">⬇︎ Backup data</button><button class="btn ghost" id="stImport">⬆︎ Restore</button></div>
   <input id="stFile" type="file" accept="application/json" class="hidden">
   <button class="btn danger" style="margin-top:10px" id="stClear">Erase all data</button>
   <p class="xs muted center" style="margin-top:14px">All data is stored only on this device. Back up regularly. · FitTrack v1</p>`);
  const paintTh=()=>$$('#stTheme button').forEach(b=>b.classList.toggle('on',b.dataset.th===(SET.theme||'auto')));
  paintTh();
  $('#stTheme').onclick=async e=>{const b=e.target.closest('[data-th]');if(!b)return;SET.theme=b.dataset.th;await saveSettings();applyTheme();paintTh();};
  const ntPaint=()=>{
    const st=$('#ntStatus'),btn=$('#ntBtn');
    if(!notifySupported()){st.textContent='Not supported in this browser';btn.style.display='none';return;}
    if(Notification.permission==='denied'){st.textContent='Blocked in browser settings';btn.style.display='none';return;}
    if(SET.notify&&Notification.permission==='granted'){st.textContent='On ✓';btn.textContent='Disable';}
    else{st.textContent='Off';btn.textContent='Enable';}
  };
  ntPaint();
  $('#ntBtn').onclick=async()=>{
    if(SET.notify&&Notification.permission==='granted'){SET.notify=false;await saveSettings();ntPaint();return;}
    const p=await Notification.requestPermission();
    if(p==='granted'){SET.notify=true;await saveSettings();registerPeriodic();toast('Notifications on');}
    ntPaint();
  };
  // Secrets are never pre-filled into password inputs (browsers/password managers
  // overwrite or blank them, and Save would then destroy the stored value).
  // A blank secret field means "keep what's stored", never "erase it".
  let clearAI=false;
  const aiClr=$('#stAIClear');if(aiClr)aiClr.onclick=()=>{clearAI=true;$('#stAI').value='';$('#stAI').placeholder='Key will be removed on save';toast('Key removed on save');};
  const si=$('#sbSignIn');if(si)si.onclick=()=>{closeModal();appShowAuth();};
  $('#stProfile').onclick=()=>{closeModal();startOnboarding(!!PROFILE);};
  lastSyncTime().then(t=>{const el=$('#sbStatus');if(el)el.textContent=t?'Last synced '+new Date(t).toLocaleString():'Not synced yet';});
  if($('#sbSyncNow'))$('#sbSyncNow').onclick=async()=>{
    if(!navigator.onLine)return toast('You are offline');
    $('#sbStatus').textContent='Syncing…';
    try{const n=await syncNow();$('#sbStatus').textContent='Synced ✓ '+new Date().toLocaleTimeString();toast(n?`Synced — ${n} update${n>1?'s':''} pulled`:'Synced ✓');go(curView);}
    catch(err){$('#sbStatus').textContent='Sync failed';toast('Sync failed: '+err.message);}
  };
  if($('#sbInvite'))$('#sbInvite').onclick=()=>{closeModal();inviteModal();};
  if($('#sbSignOut'))$('#sbSignOut').onclick=async()=>{if(!confirm('Sign out and remove the copy of your data on this device? Your account keeps everything.'))return;toast('Signing out…');await appSignOut();};
  $('#stSave').onclick=async()=>{SET.targets={kcal:+$('#stK').value||0,protein:+$('#stP').value||0,carbs:+$('#stC').value||0,fat:+$('#stF').value||0,kcalTrain:+$('#stKT').value||null};SET.startWeight=+$('#stSW').value||83;SET.goalWeight=+$('#stGW').value||76.5;
    const aiIn=$('#stAI').value.trim();
    if(clearAI)SET.aiKey='';else if(aiIn)SET.aiKey=aiIn; // blank = keep the stored key
    await saveSettings();closeModal();toast('Settings saved');renderToday();if(curView==='plan')renderPlan();syncSoon();};
  $('#stExport').onclick=exportData;
  $('#stImport').onclick=()=>$('#stFile').click();
  $('#stFile').onchange=importData;
  $('#stClear').onclick=async()=>{if(!confirm('Erase ALL data on this device? This cannot be undone here — but your account keeps a copy, and signing in again restores it.'))return;await appEraseDevice();};
}
async function exportData(){
  const data={version:1,exportedAt:new Date().toISOString(),
    // never export secrets (API key, sync credentials) — backups are plain JSON the user may share
    kv:(await idbGetAll('kv')).filter(r=>!['tombstones','session','sbproject','syncState'].includes(r.k)).map(r=>r.k==='settings'?{...r,aiKey:undefined,sync:undefined}:r),
    foods:(await idbGetAll('foods')).filter(f=>f.custom),
    meals:(await idbGetAll('meals')).filter(m=>m.custom),
    log:await idbGetAll('log'),measurements:await idbGetAll('measurements'),workouts:await idbGetAll('workouts'),water:await idbGetAll('water')};
  // photos as base64
  const photos=await idbGetAll('photos');data.photos=[];
  for(const p of photos){data.photos.push({...p,blob:await blobToB64(p.blob)});}
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='fittrack-backup-'+todayStr()+'.json';a.click();toast('Backup downloaded');
}
function blobToB64(blob){return new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(blob);});}
function b64ToBlob(d){const[meta,b]=d.split(',');const mime=meta.match(/:(.*?);/)[1];const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:mime});}
async function importData(e){const file=e.target.files[0];if(!file)return;try{const d=JSON.parse(await file.text());
  if(!confirm('Restore this backup? It merges into your current data.'))return;
  for(const r of d.kv||[]){
    if(['session','sbproject','syncState','tombstones'].includes(r.k))continue; // device-local, never from a backup
    if(r.k==='settings'){ // keep on-device secrets through a restore
      if(!r.aiKey&&SET.aiKey)r.aiKey=SET.aiKey;
      delete r.sync; // v1 backups may carry legacy sync creds — never restore them
    }
    await idbPut('kv',r);
  }
  for(const r of d.foods||[])await idbPut('foods',r);
  for(const r of d.meals||[])await idbPut('meals',r);
  for(const r of d.log||[])await idbPut('log',r);
  for(const r of d.measurements||[])await idbPut('measurements',r);
  for(const r of d.workouts||[])await idbPut('workouts',r);
  for(const r of d.water||[])await idbPut('water',r);
  for(const p of d.photos||[])await idbPut('photos',{...p,blob:typeof p.blob==='string'?b64ToBlob(p.blob):p.blob});
  await loadSettings();await loadProgram();closeModal();toast('Backup restored');go('today');}catch(err){toast('Could not read file');}}

