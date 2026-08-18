/* ============================ Navigation ============================ */
function go(view){
  curView=view;
  $$('.view').forEach(v=>v.classList.add('hidden'));
  const v=$('#view-'+view);v.classList.remove('hidden');
  v.classList.remove('enter');void v.offsetWidth;v.classList.add('enter');
  $$('.nav button').forEach(b=>{const on=b.dataset.nav===view;b.classList.toggle('on',on);
    if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  window.scrollTo(0,0);
  if(view==='today')renderToday();
  if(view==='food')renderFood();
  if(view==='body')renderBody();
  if(view==='photos')renderPhotos();
  if(view==='train'){renderTrainStart();renderWorkoutHistory();}
  if(view==='plan')renderPlan();
  if(view==='gym')renderGym();
  if(view==='library')renderLibrary();
}

/* ---------- global events ---------- */
document.addEventListener('click',async e=>{
  const t=e.target;
  const nav=t.closest('[data-nav]');if(nav){go(nav.dataset.nav);return;}
  const q=t.closest('[data-quick]');if(q){const k=q.dataset.quick;if(k==='food'){go('food');foodSeg='library';renderFood();}else if(k==='meal'){go('food');foodSeg='meals';renderFood();}else if(k==='weight')addMeasureModal();else if(k==='train')go('train');return;}
  const seg=t.closest('[data-fseg]');if(seg){foodSeg=seg.dataset.fseg;renderFood();return;}
  if(t.closest('#offSearchBtn')){offSearch($('#foodSearch').value.trim());return;}
  if(t.closest('#offBackBtn')){renderFood();return;}
  const oa=t.closest('[data-offadd]');if(oa){addOffFood(+oa.dataset.offadd);return;}
  // inner action buttons first — they live inside clickable [data-logfood]/[data-logmeal] rows
  const df=t.closest('[data-delfood]');if(df){if(confirm('Delete this food?')){await idbDel('foods',df.dataset.delfood);renderFood();}return;}
  const dm=t.closest('[data-delmeal]');if(dm){if(confirm('Delete this meal?')){await idbDel('meals',dm.dataset.delmeal);renderFood();}return;}
  const em=t.closest('[data-editmeal]');if(em){buildMealModal(em.dataset.editmeal);return;}
  const lf=t.closest('[data-logfood]');if(lf){logFoodModal(lf.dataset.logfood);return;}
  const lm=t.closest('[data-logmeal]');if(lm){logMealModal(lm.dataset.logmeal);return;}
  const dl=t.closest('[data-dellog]');if(dl){await idbDel('log',dl.dataset.dellog);renderToday();return;}
  const wa=t.closest('[data-water]');if(wa){
    if(wa.dataset.water==='undo'){const list=(await idbByDate('water',curDate)).sort((a,b)=>b.ts-a.ts);if(list[0])await idbDel('water',list[0].id);}
    else await idbPut('water',{id:uid(),date:curDate,ml:+wa.dataset.water,ts:Date.now()});
    renderToday();return;}
  if(t.closest('[data-dismisshow]')){await idbPut('kv',{k:'howtoDismissed',v:1});$('#todayHow').innerHTML='';return;}
  const di=t.closest('[data-dismissinsight]');if(di){
    const rec=(await idbGet('kv','insightDismissals'))||{k:'insightDismissals',v:{}};
    rec.v[di.dataset.dismissinsight]=todayStr();await idbPut('kv',rec);renderCoach();return;}
  const el2=t.closest('[data-editlog]');if(el2){editLogModal(el2.dataset.editlog);return;}
  const rp=t.closest('[data-repeatday]');if(rp){const d=parseD(curDate);d.setDate(d.getDate()-1);const prevDay=dstr(d);
    const prev=await idbByDate('log',prevDay);
    if(!prev.length){toast('Nothing logged on '+niceDate(prevDay));return;}
    for(const en of prev)await idbPut('log',{...en,id:uid(),date:curDate,ts:Date.now()});
    buzz();toast(`Copied ${prev.length} item${prev.length>1?'s':''} from ${niceDate(prevDay)}`);renderToday();return;}
  const cr=t.closest('[data-crange]');if(cr){chartRange=+cr.dataset.crange;
    $$('[data-crange]').forEach(b=>b.classList.toggle('on',b===cr));renderBody();return;}
  const eme=t.closest('[data-editmeas]');if(eme){addMeasureModal(eme.dataset.editmeas);return;}
  const dme=t.closest('[data-delmeas]');if(dme){if(confirm('Delete measurement?')){await idbDel('measurements',dme.dataset.delmeas);renderBody();}return;}
  const ph=t.closest('[data-photo]');if(ph){viewPhotoModal(ph.dataset.photo);return;}
  const dp=t.closest('[data-delphoto]');if(dp){await idbDel('photos',dp.dataset.delphoto);closeModal();renderPhotos();return;}
  const edd=t.closest('[data-editday]');if(edd){editDayModal(edd.dataset.editday);return;}
  if(t.closest('[data-addday]')){editDayModal(null);return;}
  if(t.closest('[data-planlib]')){planLibraryModal();return;}
  if(t.closest('#gymBtn')){go('gym');return;}
  if(t.closest('#gymBack')){go('train');return;}
  if(t.closest('#libBtn')){go('library');return;}
  if(t.closest('#libBack')){go('train');return;}
  const lp=t.closest('[data-libpat]');if(lp){libPattern=lp.dataset.libpat;renderLibrary();return;}
  const lg=t.closest('[data-libgo]');if(lg){libOpen=lg.dataset.libgo;libQ='';libPattern='';renderLibrary();const el=document.querySelector(`[data-libex="${CSS.escape(libOpen)}"]`);if(el)el.scrollIntoView({block:'center'});return;}
  const lx=t.closest('[data-libex]');if(lx){libOpen=libOpen===lx.dataset.libex?null:lx.dataset.libex;renderLibrary();return;}
  const gyr=t.closest('[data-gyrm]');if(gyr){
    const[cat,i]=gyr.dataset.gyrm.split(':');EQUIP[cat].splice(+i,1);await saveEquip();toast('Removed');return;}
  const gya=t.closest('[data-gyadd]');if(gya){
    const cat=gya.dataset.gyadd;
    if(cat==='bars'){const name=$('#gyBarName').value.trim(),kg=+$('#gyBarKg').value;
      if(!name||!(kg>0))return toast('Bar name + weight needed');
      EQUIP.bars.push({name,kg});EQUIP.bars.sort((a,b)=>a.kg-b.kg);}
    else if(cat==='plates'){const kg=+$('#gyPlKg').value,n=+$('#gyPlN').value||2;
      if(!(kg>0))return toast('Enter the plate weight');
      const ex=EQUIP.plates.find(p=>p.kg===kg);
      if(ex)ex.n+=n;else EQUIP.plates.push({kg,n});
      EQUIP.plates.sort((a,b)=>a.kg-b.kg);}
    else if(cat==='dumbbells'||cat==='kettlebells'){
      const v=+$(cat==='dumbbells'?'#gyDbNew':'#gyKbNew').value;
      if(!(v>0))return toast('Enter a weight');
      if(EQUIP[cat].includes(v))return toast('Already in your gym');
      EQUIP[cat].push(v);EQUIP[cat].sort((a,b)=>a-b);}
    else{const v=$(cat==='bands'?'#gyBdNew':'#gyGrNew').value.trim();
      if(!v)return toast('Type a name');
      EQUIP[cat].push(v);}
    await saveEquip();toast('Added ✓');return;}
  if(t.closest('[data-discarddraft]')){
    if(confirm('Discard the unfinished session? Nothing you logged in it is kept.')){await idbDel('kv','woDraft');renderTrainStart();toast('Discarded');}return;}
  const sd=t.closest('[data-startday]');if(sd){startSession(sd.dataset.startday);return;}
  const ow=t.closest('[data-openwo]');if(ow){openWorkout(ow.dataset.openwo);return;}
  if(t.closest('#helpBtn')){go('plan');return;}
  if(t.closest('#aiAsk')){askPlan();return;}
  if(t.closest('#gearBtn')){settingsModal();return;}
  if(t.closest('#addFoodBtn')){addFoodModal();return;}
  if(t.closest('#addMealBtn')){buildMealModal();return;}
  if(t.closest('#addMeasureBtn')){addMeasureModal();return;}
  if(t.closest('#addPhotoBtn')){addPhotoModal();return;}
});
$('#foodSearch').addEventListener('input',()=>renderFood());
$('#aiQ').addEventListener('keydown',e=>{if(e.key==='Enter')askPlan();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('#modalRoot').children.length){closeModal();return;}
  // activate clickable rows (role="button" divs) with Enter/Space
  if((e.key==='Enter'||e.key===' ')&&e.target instanceof Element&&e.target.matches('div[role="button"]')){e.preventDefault();e.target.click();}
});
$('#weightChart').addEventListener('click',e=>{
  const r=e.target.getBoundingClientRect();const cx=e.clientX-r.left,cy=e.clientY-r.top;
  const tip=$('#chartTip');let best=null,bd=28;
  for(const p of chartPts){const d=Math.abs(p.cssX-cx);if(d<bd){bd=d;best=p;}}
  if(!best){tip.classList.add('hidden');return;}
  tip.textContent=`${niceDate(best.date)} · ${best.weight} kg`;
  tip.style.left=Math.min(Math.max(best.cssX-50,4),r.width-110)+'px';
  tip.style.top=Math.max(best.cssY-38,2)+'px';
  tip.classList.remove('hidden');
  clearTimeout(tip._t);tip._t=setTimeout(()=>tip.classList.add('hidden'),2500);
});
$('#prevDay').onclick=()=>{const d=parseD(curDate);d.setDate(d.getDate()-1);curDate=dstr(d);renderToday();};
$('#nextDay').onclick=()=>{const d=parseD(curDate);d.setDate(d.getDate()+1);curDate=dstr(d);renderToday();};
window.closeModal=closeModal;

