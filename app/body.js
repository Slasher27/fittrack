/* ============================ BODY ============================ */
async function renderBody(){
  const list=(await idbGetAll('measurements')).sort((a,b)=>a.date<b.date?1:-1);
  const withW=list.filter(m=>m.weight!=null);
  const latest=withW[0];
  // weekly average (last 7 days)
  const now=new Date();const wk=withW.filter(m=>(now-parseD(m.date))/864e5<=7);
  const avg=wk.length?wk.reduce((s,m)=>s+m.weight,0)/wk.length:null;
  const goal=SET.goalWeight;
  let stat='';
  if(latest){
    const start=SET.startWeight;const change=latest.weight-start;
    stat=`<div class="row between" style="text-align:center">
      <div style="flex:1"><div class="xs muted b">LATEST</div><div style="font-size:24px;font-weight:800">${latest.weight}<span class="sm muted"> kg</span></div></div>
      <div style="flex:1"><div class="xs muted b">7-DAY AVG</div><div style="font-size:24px;font-weight:800;color:var(--brand)">${avg?avg.toFixed(1):'–'}<span class="sm muted"> kg</span></div></div>
      <div style="flex:1"><div class="xs muted b">TO GOAL</div><div style="font-size:24px;font-weight:800">${(latest.weight-goal).toFixed(1)}<span class="sm muted"> kg</span></div></div>
    </div><div class="center sm muted" style="margin-top:8px">Since start (${start} kg): <b style="color:${change<=0?'var(--good)':'var(--ink)'}">${change>0?'+':''}${change.toFixed(1)} kg</b> · Goal ${goal} kg</div>`;
  } else stat=`<div class="empty" style="padding:14px"><span class="ic">⚖️</span>No measurements yet.</div>`;
  $('#bodyStats').innerHTML=stat;
  drawWeightChart(withW.slice().reverse());
  // list
  $('#measureList').innerHTML=list.length?list.map(m=>`<div class="card" style="padding:12px 14px"><div class="row between"><div><b>${niceDate(m.date)}</b> <span class="sm muted">${parseD(m.date).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}</span></div><div class="row" style="gap:7px"><button class="pillbtn" data-editmeas="${m.id}" aria-label="Edit measurement">✎</button><button class="pillbtn" data-delmeas="${m.id}" aria-label="Delete measurement">✕</button></div></div><div class="sm" style="margin-top:4px">${[m.weight!=null?`⚖️ ${m.weight} kg`:'',m.waist?`📏 waist ${m.waist} cm`:'',m.chest?`chest ${m.chest}`:'',m.arm?`arm ${m.arm}`:'',m.thigh?`thigh ${m.thigh}`:''].filter(Boolean).join(' · ')}</div>${m.notes?`<div class="sm muted" style="margin-top:3px">“${esc(m.notes)}”</div>`:''}</div>`).join(''):'';
}
let chartPts=[]; // css-pixel positions of drawn weigh-ins, for the tap tooltip
function drawWeightChart(data){
  const cv=$('#weightChart'),ctx=cv.getContext('2d');const W=cv.width=cv.clientWidth*2,H=cv.height=480;
  ctx.clearRect(0,0,W,H);chartPts=[];
  let pts=data.filter(d=>d.weight!=null);
  if(chartRange>0){const cut=new Date();cut.setDate(cut.getDate()-chartRange);const cs=dstr(cut);pts=pts.filter(p=>p.date>=cs);}
  if(pts.length<1){ctx.fillStyle=cssVar('--muted');ctx.font='24px sans-serif';ctx.textAlign='center';ctx.fillText('Log weigh-ins to see your trend',W/2,H/2);return;}
  // rolling 7-day average — the signal that matters for recomp
  const avg=pts.map(p=>{const t=parseD(p.date).getTime();
    const win=pts.filter(q=>{const qt=parseD(q.date).getTime();return qt<=t&&qt>t-7*864e5;});
    return{date:p.date,weight:win.reduce((s,q)=>s+q.weight,0)/win.length};});
  const pad=60;const xs=pts.map(p=>parseD(p.date).getTime());
  const ws=pts.map(p=>p.weight).concat(avg.map(a=>a.weight)).concat([SET.goalWeight]);
  let minW=Math.min(...ws)-0.5,maxW=Math.max(...ws)+0.5;if(maxW-minW<2){maxW+=1;minW-=1;}
  const minX=Math.min(...xs),maxX=Math.max(...xs)||minX+1;
  const X=t=>pad+(maxX===minX?0.5:(t-minX)/(maxX-minX))*(W-pad*1.4);
  const Y=w=>pad*0.5+(1-(w-minW)/(maxW-minW))*(H-pad*1.6);
  // goal line
  ctx.strokeStyle=cssVar('--c');ctx.setLineDash([8,8]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pad,Y(SET.goalWeight));ctx.lineTo(W-pad*0.4,Y(SET.goalWeight));ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=cssVar('--c');ctx.font='bold 20px sans-serif';ctx.textAlign='left';ctx.fillText('Goal '+SET.goalWeight+'kg',pad+4,Y(SET.goalWeight)-8);
  // axis labels
  ctx.fillStyle=cssVar('--muted');ctx.font='20px sans-serif';ctx.textAlign='right';
  ctx.fillText(maxW.toFixed(1),pad-8,Y(maxW)+6);ctx.fillText(minW.toFixed(1),pad-8,Y(minW)+6);
  // raw weigh-ins: quiet line + dots
  ctx.strokeStyle=cssVar('--line2');ctx.lineWidth=2;ctx.beginPath();
  pts.forEach((p,i)=>{const x=X(parseD(p.date).getTime()),y=Y(p.weight);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
  ctx.fillStyle=cssVar('--muted');
  pts.forEach(p=>{const x=X(parseD(p.date).getTime()),y=Y(p.weight);
    ctx.beginPath();ctx.arc(x,y,4.5,0,7);ctx.fill();
    chartPts.push({cssX:x/2,cssY:y/2,date:p.date,weight:p.weight});});
  // 7-day average: the bright volt line
  ctx.strokeStyle=cssVar('--brand');ctx.lineWidth=4;ctx.shadowColor=cssVar('--brand');ctx.shadowBlur=10;ctx.beginPath();
  avg.forEach((p,i)=>{const x=X(parseD(p.date).getTime()),y=Y(p.weight);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
  ctx.shadowBlur=0;
}
async function addMeasureModal(editId){
  const m=editId?await idbGet('measurements',editId):null;
  const v=x=>x==null?'':x;
  openModal(`<div class="mh"><h3>${m?'Edit measurement':'Add measurement'}</h3><button class="x" onclick="closeModal()">✕</button></div>
   <label class="fl">Date</label><input id="msDate" type="date" value="${m?m.date:todayStr()}">
   <div class="in2"><div><label class="fl">Weight (kg)</label><input id="msW" type="number" step="0.1" inputmode="decimal" value="${v(m?.weight)}"></div>
     <div><label class="fl">Waist (cm)</label><input id="msWa" type="number" step="0.1" inputmode="decimal" value="${v(m?.waist)}"></div></div>
   <div class="in3" style="margin-top:0"><div><label class="fl">Chest</label><input id="msCh" type="number" step="0.1" inputmode="decimal" value="${v(m?.chest)}"></div>
     <div><label class="fl">Arm</label><input id="msAr" type="number" step="0.1" inputmode="decimal" value="${v(m?.arm)}"></div>
     <div><label class="fl">Thigh</label><input id="msTh" type="number" step="0.1" inputmode="decimal" value="${v(m?.thigh)}"></div></div>
   <label class="fl">Notes</label><textarea id="msN" placeholder="How you feel, energy, sleep…">${m?esc(m.notes||''):''}</textarea>
   <button class="btn" style="margin-top:14px" id="msSave">${m?'Save changes':'Save'}</button>`);
  $('#msSave').onclick=async()=>{const w=$('#msW').value;
    await idbPut('measurements',{id:m?m.id:uid(),date:$('#msDate').value,weight:w?+w:null,waist:+$('#msWa').value||null,chest:+$('#msCh').value||null,arm:+$('#msAr').value||null,thigh:+$('#msTh').value||null,notes:$('#msN').value.trim()});
    closeModal();buzz();toast(m?'Measurement updated':'Measurement saved');renderBody();renderToday();};
}

/* ============================ PHOTOS ============================ */
async function renderPhotos(){
  const list=(await idbGetAll('photos')).sort((a,b)=>a.date<b.date?1:(a.date>b.date?-1:b.ts-a.ts));
  const grid=$('#photoGrid');
  if(!list.length){grid.innerHTML=`<div class="empty"><span class="ic">📷</span>No photos yet.</div>`;return;}
  grid.className='pgrid';
  grid.innerHTML=list.map(p=>{if(!p.blob)return `<div class="pcell pending" aria-label="Photo syncing"><span class="tag2">${esc(p.category||'')}</span><span class="cap">${niceDate(p.date)} · syncing…</span></div>`;const url=URL.createObjectURL(p.blob);return `<div class="pcell" role="button" tabindex="0" data-photo="${p.id}"><img src="${url}" alt="${esc(p.category||'Progress')} photo, ${niceDate(p.date)}"><span class="tag2">${esc(p.category||'')}</span><span class="cap">${niceDate(p.date)}</span></div>`;}).join('');
}
function addPhotoModal(){
  openModal(`<div class="mh"><h3>Add progress photo</h3><button class="x" onclick="closeModal()">✕</button></div>
   <label class="fl">Photo</label>
   <input id="phFile" type="file" accept="image/*" capture="environment">
   <label class="fl">Date</label><input id="phDate" type="date" value="${todayStr()}">
   <label class="fl">Angle</label><select id="phCat"><option>Front</option><option>Side</option><option>Back</option></select>
   <label class="fl">Note (optional)</label><input id="phNote" placeholder="e.g. morning, fasted">
   <button class="btn" style="margin-top:14px" id="phSave">Save photo</button>`);
  $('#phSave').onclick=async()=>{const file=$('#phFile').files[0];if(!file)return toast('Choose a photo');
    const blob=await compressImage(file);
    await idbPut('photos',{id:uid(),date:$('#phDate').value,category:$('#phCat').value,note:$('#phNote').value.trim(),blob,ts:Date.now()});
    closeModal();buzz();toast('Photo saved');renderPhotos();};
}
function compressImage(file){return new Promise(res=>{const img=new Image();img.onload=()=>{const max=1280;let{width:w,height:h}=img;if(w>h&&w>max){h=h*max/w;w=max;}else if(h>max){w=w*max/h;h=max;}
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(img,0,0,w,h);cv.toBlob(b=>res(b||file),'image/jpeg',0.82);};img.src=URL.createObjectURL(file);});}
function viewPhotoModal(id){idbGet('photos',id).then(p=>{if(!p||!p.blob)return toast('Photo still syncing from your account');
  if(!p){toast('Photo no longer exists');renderPhotos();return;}
  const url=URL.createObjectURL(p.blob);
  openModal(`<div class="mh"><h3>${esc(p.category)} · ${niceDate(p.date)}</h3><button class="x" onclick="closeModal()">✕</button></div>
   <img src="${url}" alt="${esc(p.category||'Progress')} photo, ${niceDate(p.date)}" style="width:100%;border-radius:14px">
   <div class="in2" style="margin-top:12px">
     <div><label class="fl" for="phEcat" style="margin-top:0">Angle</label><select id="phEcat">${['Front','Side','Back'].map(c=>`<option${c===p.category?' selected':''}>${c}</option>`).join('')}</select></div>
     <div><label class="fl" for="phEdate" style="margin-top:0">Date</label><input id="phEdate" type="date" value="${p.date}"></div>
   </div>
   <label class="fl" for="phEnote">Note</label><input id="phEnote" value="${esc(p.note||'')}" placeholder="e.g. morning, fasted">
   <button class="btn" style="margin-top:12px" id="phEsave">Save changes</button>
   <button class="btn danger sm" style="margin-top:8px;width:100%" data-delphoto="${p.id}">Delete photo</button>`);
  $('#phEsave').onclick=async()=>{
    await idbPut('photos',{...p,category:$('#phEcat').value,date:$('#phEdate').value,note:$('#phEnote').value.trim()});
    closeModal();toast('Photo updated');renderPhotos();};
});}

