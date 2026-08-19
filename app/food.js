/* ============================ FOOD ============================ */
let foodRenderSeq=0;
async function renderFood(){
  // Re-entrant + async (it awaits IndexedDB), so a render started earlier can finish
  // later and clobber a newer one — e.g. the unfiltered list overwriting your search
  // results as you type. Only the most recent call is allowed to paint.
  const seq=++foodRenderSeq;
  const stale=()=>seq!==foodRenderSeq;
  $$('.seg [data-fseg]').forEach(b=>b.classList.toggle('on',b.dataset.fseg===foodSeg));
  const q=$('#foodSearch').value.trim().toLowerCase();
  const root=$('#foodList');
  if(foodSeg==='meals'){
    const meals=await idbGetAll('meals');const fmap=foodMap(await idbGetAll('foods'));
    const filt=meals.filter(m=>(m.name+' '+(m.day?DAY_FULL[m.day]:'')+' '+(m.slot||'')).toLowerCase().includes(q));
    if(stale())return;
    if(!filt.length){root.innerHTML=`<div class="empty"><span class="ic">🍱</span>No meals found. Tap “Build a meal” to add your own.</div>`;return;}
    const mealRow=async m=>{const t=await mealMacros(m,fmap);
      return `<div class="foodrow" role="button" tabindex="0" data-logmeal="${m.id}"><div><div class="fn">${m.slot?`<span class="badge" style="font-size:10px;margin-right:6px">${esc(m.slot)}</span>`:''}${esc(m.name)}</div><div class="fs">${m.items.length} items · ${rnd(t.protein)}P ${rnd(t.carbs)}C ${rnd(t.fat)}F</div></div><div class="row" style="gap:7px"><div class="fk">${rnd(t.kcal)}<br>kcal</div><button class="pillbtn" data-editmeal="${m.id}" title="Edit meal">✎</button>${m.custom?`<button class="pillbtn" data-delmeal="${m.id}" title="Delete meal">✕</button>`:''}<span class="chev">›</span></div></div>`;};
    const plan=filt.filter(m=>m.day).sort((a,b)=>(DAY_ORDER.indexOf(a.day)-DAY_ORDER.indexOf(b.day))||((SLOT_ORDER[a.slot]??9)-(SLOT_ORDER[b.slot]??9)));
    const custom=filt.filter(m=>!m.day);
    let h='';let curDay='';
    for(const m of plan){if(m.day!==curDay){curDay=m.day;h+=`<div class="grp">${DAY_FULL[m.day]}</div>`;}h+=await mealRow(m);}
    if(custom.length){h+=`<div class="grp">My meals</div>`;for(const m of custom)h+=await mealRow(m);}
    if(stale())return;
    root.innerHTML=h;return;
  }
  let foods=await idbGetAll('foods');
  if(foodSeg==='mine')foods=foods.filter(f=>f.custom);
  const foodRow=f=>`<div class="foodrow" role="button" tabindex="0" data-logfood="${f.id}"><div><div class="fn">${esc(f.name)}${f.kind==='recipe'?' <span class="badge">recipe</span>':''}${f.estimated?' <span class="xs muted">· est.</span>':''}</div><div class="fs">${esc(f.serving)} · ${rnd(f.protein)}P ${rnd(f.carbs)}C ${rnd(f.fat)}F</div></div><div class="row" style="gap:7px"><div class="fk">${rnd(f.kcal)}<br>kcal</div>${f.custom?`<button class="pillbtn" data-delfood="${f.id}" title="Delete food">✕</button>`:''}<span class="chev">›</span></div></div>${f.kind==='recipe'?`<button class="pillbtn" data-editrecipe="${f.id}" aria-label="Edit recipe">✎</button>`:''}`;
  // frequent foods (last 14 days of the log), library segment only, hidden while searching
  let recent='';
  if(foodSeg==='library'&&!q){
    const d=new Date();d.setDate(d.getDate()-14);const cut=dstr(d);
    const fm=foodMap(foods);
    const counts={};
    (await idbGetAll('log')).forEach(e=>{if(e.date>=cut&&e.foodId&&fm[e.foodId]){const c=counts[e.foodId]=counts[e.foodId]||{n:0,ts:0};c.n++;c.ts=Math.max(c.ts,e.ts||0);}});
    const top=Object.keys(counts).sort((a,b)=>(counts[b].n-counts[a].n)||(counts[b].ts-counts[a].ts)).slice(0,6);
    if(top.length)recent=`<div class="grp">⭐ Frequent</div>`+top.map(id=>foodRow(fm[id])).join('');
  }
  foods=foods.filter(f=>f.name.toLowerCase().includes(q));
  const offBtn=q?`<button class="btn sec sm" id="offSearchBtn" style="width:100%;margin-top:10px">🌐 Search online for “${esc(q)}”</button>`:'';
  if(stale())return;
  if(!foods.length){root.innerHTML=`<div class="empty"><span class="ic">🍽️</span>${foodSeg==='mine'?'No custom foods yet. Tap “Custom food”.':'No matches in your library.'}</div>`+offBtn;return;}
  const groups={};foods.forEach(f=>{(groups[f.group]=groups[f.group]||[]).push(f);});
  const gorder=['Protein','Dairy','Carbs','Fruit','Veg','Fats','Other','Online'];
  let h=recent;for(const g of [...gorder,...Object.keys(groups).filter(g=>!gorder.includes(g)).sort()]){if(!groups[g])continue;h+=`<div class="grp">${esc(g)}</div>`;
    groups[g].forEach(f=>{h+=foodRow(f);});}
  if(stale())return;
  root.innerHTML=h+offBtn;
}

/* ---------- Online food search (Open Food Facts — free, no key) ----------
   Optional network feature: only runs when the user explicitly taps
   "Search online". Imported products become custom foods (per-100 g macros),
   so they sync, survive seed upgrades, and work offline forever after.
   Only the typed search term is sent. */
let OFF_RESULTS=[];
async function offSearch(q){
  const root=$('#foodList');
  root.innerHTML=`<div class="empty"><span class="ic">🌐</span>Searching Open Food Facts…</div>`;
  let products;
  try{
    const res=await fetch('https://world.openfoodfacts.org/cgi/search.pl?search_terms='+encodeURIComponent(q)+'&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,brands,nutriments');
    if(!res.ok)throw new Error(res.status);
    products=(await res.json()).products||[];
  }catch(e){
    toast('Online search failed — check your connection');renderFood();return;
  }
  const r1=x=>Math.round(x*10)/10;
  OFF_RESULTS=products.map(p=>{
    const n=p.nutriments||{};
    const kcal=n['energy-kcal_100g']??(n.energy_100g?n.energy_100g/4.184:null);
    if(!p.product_name||kcal==null||n.proteins_100g==null)return null;
    return{name:p.product_name.trim()+(p.brands?` (${p.brands.split(',')[0].trim()})`:''),
      kcal:r1(kcal),protein:r1(n.proteins_100g||0),carbs:r1(n.carbohydrates_100g||0),fat:r1(n.fat_100g||0)};
  }).filter(Boolean);
  if(!OFF_RESULTS.length){root.innerHTML=`<div class="empty"><span class="ic">🌐</span>No online matches with usable nutrition data.</div><button class="btn ghost sm" id="offBackBtn" style="width:100%;margin-top:10px">‹ Back to library</button>`;return;}
  root.innerHTML=`<div class="grp">🌐 Online results — per 100 g · tap + to add</div>`+
    OFF_RESULTS.map((f,i)=>`<div class="foodrow"><div><div class="fn">${esc(f.name)}</div><div class="fs">100 g · ${rnd(f.protein)}P ${rnd(f.carbs)}C ${rnd(f.fat)}F</div></div><div class="row" style="gap:7px"><div class="fk">${rnd(f.kcal)}<br>kcal</div><button class="pillbtn" data-offadd="${i}" aria-label="Add ${esc(f.name)} to library">＋</button></div></div>`).join('')+
    `<button class="btn ghost sm" id="offBackBtn" style="width:100%;margin-top:10px">‹ Back to library</button>`;
}
async function addOffFood(i){
  const f=OFF_RESULTS[i];if(!f)return;
  const food={id:uid(),name:f.name,group:'Online',serving:'100 g',kcal:f.kcal,protein:f.protein,carbs:f.carbs,fat:f.fat,custom:true};
  await idbPut('foods',food);
  toast('Added to your library');
  logFoodModal(food.id);
}

/* ---------- Log food modal ---------- */
function openModal(html){const r=$('#modalRoot');
  r.innerHTML=`<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" tabindex="-1">${html}</div></div>`;
  r.querySelector('.modal-bg').addEventListener('click',e=>{if(e.target.classList.contains('modal-bg'))closeModal();});
  r.querySelectorAll('.x').forEach(b=>b.setAttribute('aria-label','Close'));
  document.body.style.overflow='hidden'; // lock background scroll while the sheet is open
  const m=r.querySelector('.modal');
  setTimeout(()=>{if(m&&!m.contains(document.activeElement))m.focus();},60); // don't steal focus if the user is already typing
  m.addEventListener('keydown',e=>{ // keep Tab inside the dialog
    if(e.key!=='Tab')return;
    const f=[...m.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(x=>x.offsetParent!==null);
    if(!f.length)return;
    const first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
}
function closeModal(){clearInterval(restInt);wakeOff();$('#modalRoot').innerHTML='';document.body.style.overflow='';}

async function logFoodModal(foodId){
  const f=await idbGet('foods',foodId);if(!f)return;
  // Weight/volume foods ("100 g", "250 ml") are logged in their own unit — you type
  // 180 for 180 g, not 1.8 servings. Countable foods ("1 egg") stay as counts.
  // NB the anchored match deliberately excludes labels like "1 scoop (30 g)".
  const wt=f.serving.match(/^(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
  const base=wt?parseFloat(wt[1]):0,unit=wt?wt[2].toLowerCase():'';
  openModal(`
    <div class="mh"><h3>${esc(f.name)}</h3><button class="x" onclick="closeModal()">✕</button></div>
    <p class="sm muted" style="margin:0 0 4px">Per ${esc(f.serving)}: ${f.kcal} kcal · ${f.protein}P ${f.carbs}C ${f.fat}F</p>
    <label class="fl">${wt?`Amount (${unit})`:`Servings (${esc(f.serving)})`}</label>
    <input id="mServ" type="number" inputmode="decimal" step="${wt?'1':'0.1'}" value="${wt?base:1}" min="0">
    <div class="sm muted" id="mCalc" style="margin-top:8px"></div>
    <label class="fl">Meal</label>
    <select id="mSlot">
      <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option>
      <option value="snack">Snack</option><option value="dinner">Dinner</option></select>
    <label class="fl">Date</label>
    <input id="mDate" type="date" value="${curDate}">
    <button class="btn" style="margin-top:16px" id="mSave">Add to log</button>`);
  const servings=()=>{const v=parseFloat($('#mServ').value)||0;return wt?v/base:v;};
  const upd=()=>{const s=servings();const m=scale(f,s);
    $('#mCalc').innerHTML=`= <b style="color:var(--ink)">${rnd(m.kcal)} kcal</b> · ${rnd(m.protein)}P ${rnd(m.carbs)}C ${rnd(m.fat)}F`;};
  const slotGuess={breakfast:[0,10],lunch:[11,14],snack:[14,17],dinner:[17,23]};const hr=new Date().getHours();
  for(const[k,[a,b]]of Object.entries(slotGuess))if(hr>=a&&hr<=b)$('#mSlot').value=k;
  $('#mServ').addEventListener('input',upd);upd();
  $('#mSave').onclick=async()=>{const s=servings();if(s<=0)return;const m=scale(f,s);
    const date=$('#mDate').value,slot=$('#mSlot').value;
    await idbPut('log',{id:uid(),date,meal:slot,foodId:f.id,name:f.name,serving:f.serving,servings:s,kcal:m.kcal,protein:m.protein,carbs:m.carbs,fat:m.fat,ts:Date.now()});
    closeModal();buzz();toast('Logged '+f.name);curDate=date;go('today');};
}

async function logMealModal(mealId){
  const meal=await idbGet('meals',mealId);
  if(!meal){toast('That meal no longer exists');renderToday();if(curView==='food')renderFood();return;}
  const fmap=foodMap(await idbGetAll('foods'));const t=await mealMacros(meal,fmap);
  const rows=meal.items.map(it=>{const f=fmap[it.foodId];if(!f)return '';const m=scale(f,it.servings);
    return `<div class="entry"><div><div class="n">${esc(f.name)}</div><div class="s">${esc(qtyLabel(f.serving,it.servings))}</div></div><div class="k">${rnd(m.kcal)}<div class="xs muted" style="font-weight:600">${rnd(m.protein)}P ${rnd(m.carbs)}C ${rnd(m.fat)}F</div></div></div>`;
  }).join('');
  const slotSel=meal.slot?SLOT_KEY[meal.slot]:'lunch';
  openModal(`<div class="mh"><h3>${esc(meal.name)}</h3><div class="row" style="gap:6px"><button class="pillbtn" id="mEdit" aria-label="Edit meal">✎ Edit</button><button class="x" onclick="closeModal()">✕</button></div></div>
    ${meal.day?`<div class="sm muted" style="margin:-2px 0 10px">${DAY_FULL[meal.day]} · ${esc(meal.slot)}</div>`:''}
    <div class="card" style="box-shadow:none;background:var(--brand-soft);border:none;margin-bottom:6px"><b style="font-size:16px">${rnd(t.kcal)} kcal</b> · ${rnd(t.protein)}P ${rnd(t.carbs)}C ${rnd(t.fat)}F</div>
    <div class="grp">Ingredients</div>
    <div class="card" style="padding:2px 14px;margin-bottom:14px">${rows||'<p class="sm muted">No items.</p>'}</div>
    <label class="fl">Log to meal slot</label>
    <select id="mSlot">${['breakfast','lunch','snack','dinner'].map(s=>`<option value="${s}"${s===slotSel?' selected':''}>${s[0].toUpperCase()+s.slice(1)}</option>`).join('')}</select>
    <label class="fl">Date</label><input id="mDate" type="date" value="${curDate}">
    <button class="btn" style="margin-top:16px" id="mSave">Add whole meal to log</button>`);
  $('#mEdit').onclick=()=>{closeModal();buildMealModal(meal.id);};
  $('#mSave').onclick=async()=>{const date=$('#mDate').value,slot=$('#mSlot').value;
    for(const it of meal.items){const f=fmap[it.foodId];if(!f)continue;const m=scale(f,it.servings);
      await idbPut('log',{id:uid(),date,meal:slot,foodId:f.id,name:f.name,serving:f.serving,servings:it.servings,kcal:m.kcal,protein:m.protein,carbs:m.carbs,fat:m.fat,ts:Date.now()});}
    closeModal();buzz();toast('Logged '+meal.name);curDate=date;go('today');};
}

async function editLogModal(id){
  const e=await idbGet('log',id);
  if(!e){toast('Entry no longer exists');renderToday();return;}
  const unit=+e.servings>0?{kcal:e.kcal/e.servings,protein:e.protein/e.servings,carbs:e.carbs/e.servings,fat:e.fat/e.servings}
    :{kcal:e.kcal,protein:e.protein,carbs:e.carbs,fat:e.fat};
  const eu=servingUnit(e.serving); // weight foods edit in g/ml, not servings
  openModal(`<div class="mh"><h3>Edit entry</h3><button class="x" onclick="closeModal()">✕</button></div>
    <p class="sm muted" style="margin:0 0 4px">${esc(e.name)} — per ${esc(e.serving||'serving')}: ${rnd(unit.kcal)} kcal · ${rnd(unit.protein)}P</p>
    <label class="fl" for="elServ">${eu?`Amount (${eu.unit})`:`Servings (${esc(e.serving||'serving')})`}</label>
    <input id="elServ" type="number" inputmode="decimal" step="${eu?'1':'0.1'}" min="0" value="${eu?Math.round(e.servings*eu.base*10)/10:e.servings}">
    <div class="sm muted" id="elCalc" style="margin-top:8px"></div>
    <label class="fl" for="elSlot">Meal</label>
    <select id="elSlot">${['breakfast','lunch','snack','dinner'].map(s=>`<option value="${s}"${s===e.meal?' selected':''}>${s[0].toUpperCase()+s.slice(1)}</option>`).join('')}</select>
    <label class="fl" for="elDate">Date</label><input id="elDate" type="date" value="${e.date}">
    <button class="btn" style="margin-top:16px" id="elSave">Save changes</button>
    <button class="btn danger sm" style="margin-top:8px;width:100%" id="elDel">Delete entry</button>`);
  const elServings=()=>{const v=parseFloat($('#elServ').value)||0;return eu?v/eu.base:v;};
  const upd=()=>{const s=elServings();
    $('#elCalc').innerHTML=`= <b style="color:var(--ink)">${rnd(unit.kcal*s)} kcal</b> · ${rnd(unit.protein*s)}P ${rnd(unit.carbs*s)}C ${rnd(unit.fat*s)}F`;};
  $('#elServ').addEventListener('input',upd);upd();
  $('#elSave').onclick=async()=>{
    const s=elServings();if(s<=0)return toast(eu?'Amount must be above 0':'Servings must be above 0');
    const date=$('#elDate').value,slot=$('#elSlot').value;
    await idbPut('log',{...e,servings:s,meal:slot,date,kcal:unit.kcal*s,protein:unit.protein*s,carbs:unit.carbs*s,fat:unit.fat*s});
    closeModal();buzz();toast('Entry updated');curDate=date;renderToday();};
  $('#elDel').onclick=async()=>{await idbDel('log',e.id);closeModal();toast('Entry removed');renderToday();};
}

function addFoodModal(){
  openModal(`<div class="mh"><h3>New custom food</h3><button class="x" onclick="closeModal()">✕</button></div>
   <label class="fl">Name</label><input id="cfName" placeholder="e.g. Protein bar">
   <label class="fl">Serving label</label><input id="cfServ" placeholder="e.g. 1 bar (60 g) or 100 g" value="1 serving">
   <label class="fl">Group</label><select id="cfGroup">${['Protein','Dairy','Carbs','Fruit','Veg','Fats','Other'].map(g=>`<option>${g}</option>`).join('')}</select>
   <label class="fl">Per serving</label>
   <div class="in2"><input id="cfKcal" type="number" inputmode="numeric" placeholder="kcal"><input id="cfP" type="number" inputmode="decimal" placeholder="Protein g"></div>
   <div class="in2" style="margin-top:8px"><input id="cfC" type="number" inputmode="decimal" placeholder="Carbs g"><input id="cfF" type="number" inputmode="decimal" placeholder="Fat g"></div>
   <button class="btn" style="margin-top:16px" id="cfSave">Save food</button>`);
  $('#cfSave').onclick=async()=>{const name=$('#cfName').value.trim();if(!name)return toast('Enter a name');
    await idbPut('foods',{id:uid(),name,group:$('#cfGroup').value,serving:$('#cfServ').value.trim()||'1 serving',
      kcal:+$('#cfKcal').value||0,protein:+$('#cfP').value||0,carbs:+$('#cfC').value||0,fat:+$('#cfF').value||0,custom:true});
    closeModal();toast('Food saved');foodSeg='mine';renderFood();};
}

async function buildMealModal(editId){
  const foods=await idbGetAll('foods');
  const meal=editId?await idbGet('meals',editId):null;
  if(editId&&!meal){toast('That meal no longer exists');renderFood();return;}
  openModal(`<div class="mh"><h3>${meal?'Edit meal':'Build a meal'}</h3><button class="x" onclick="closeModal()">✕</button></div>
   ${meal&&meal.day?`<div class="sm muted" style="margin:-2px 0 6px">${DAY_FULL[meal.day]} · ${esc(meal.slot)} — from your plan; your edited version replaces it and survives plan updates.</div>`:''}
   <label class="fl">Meal name</label><input id="bmName" placeholder="e.g. My Monday lunch" value="${meal?esc(meal.name):''}">
   <label class="fl">Add items</label>
   <div class="row" style="gap:8px"><select id="bmFood" style="flex:2">${foods.map(f=>`<option value="${f.id}">${esc(f.name)} (${esc(f.serving)})</option>`).join('')}</select>
     <input id="bmServ" type="number" step="0.1" value="1" style="flex:1" inputmode="decimal">
     <button class="btn sm sec" id="bmAdd" style="flex:none">Add</button></div>
   <div id="bmItems" style="margin-top:10px"></div>
   <button class="btn" style="margin-top:14px" id="bmSave">${meal?'Save changes':'Save meal'}</button>`);
  const items=meal?meal.items.map(i=>({...i})):[];const fmap=foodMap(foods);
  const draw=()=>{$('#bmItems').innerHTML=items.length?items.map((it,i)=>{const f=fmap[it.foodId];if(!f)return '';return `<div class="entry"><div class="n">${(it.servings+'').replace(/\.0$/,'')}× ${esc(f.name)}</div><button class="pillbtn" data-rm="${i}" aria-label="Remove item">✕</button></div>`;}).join(''):'<p class="sm muted">No items yet.</p>';};
  draw();
  $('#bmAdd').onclick=()=>{items.push({foodId:$('#bmFood').value,servings:parseFloat($('#bmServ').value)||1});draw();};
  $('#bmItems').onclick=e=>{const b=e.target.closest('[data-rm]');if(b){items.splice(+b.dataset.rm,1);draw();}};
  $('#bmSave').onclick=async()=>{const name=$('#bmName').value.trim();if(!name)return toast('Enter a name');if(!items.length)return toast('Add items');
    if(meal){
      if(meal.custom)await idbPut('meals',{...meal,name,items:items.slice()});
      else{ // plan meal: replace with a custom copy in the same day/slot so seed updates keep it
        await idbDel('meals',meal.id);
        await idbPut('meals',{id:uid(),day:meal.day,slot:meal.slot,name,items:items.slice(),custom:true});
      }
      closeModal();toast('Meal updated');
    }else{
      await idbPut('meals',{id:uid(),name,items:items.slice(),custom:true});closeModal();toast('Meal saved');
    }
    foodSeg='meals';renderFood();};
}

