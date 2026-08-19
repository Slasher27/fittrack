/* ============================ FOOD v3 (stage 6) — describe-to-log, recipes, per-100 g ============================
   The #1 friction fix: on Home you type (or dictate) what you ate or drank — "2 eggs, toast with
   butter, flat white" / "Woolies chicken wrap ~600 kcal" — Claude parses it into line items with
   grams and macros (one forced tool call), you see the list, fix or drop a line, tap Log. Estimates
   are flagged; any line can be saved as a food for next time. Offline / no coach → the box falls
   back to a local library search. Recipes: weigh the cooked pot once, log "220 g of my beef curry"
   forever — stored as a custom food with serving "100 g" so the existing gram-based logging applies. */

/* per-100 g view of any food whose serving is a weight/volume (null for countables like "1 egg") */
function foodPer100(f){const u=servingUnit(f.serving);if(!u||!u.base)return null;const k=100/u.base;return{kcal:f.kcal*k,protein:f.protein*k,carbs:f.carbs*k,fat:f.fat*k,unit:u.unit};}

/* ---------- describe-to-log ---------- */
const PARSE_FOOD_TOOL={name:'parse_food',description:'Turn a free-text description of food/drink into line items with estimated grams and macros.',input_schema:{type:'object',properties:{
  meal:{type:'string',enum:['breakfast','lunch','snack','dinner'],description:'best guess from the text and time of day'},
  items:{type:'array',items:{type:'object',properties:{name:{type:'string',description:'short, e.g. "Boiled eggs ×2"'},grams:{type:'number'},kcal:{type:'number'},protein:{type:'number'},carbs:{type:'number'},fat:{type:'number'},confidence:{type:'string',enum:['high','medium','low']}},required:['name','kcal','protein','carbs','fat']}},
  note:{type:'string',description:'one short line if an assumption matters (e.g. assumed 2 slices, 15 g butter)'}},required:['meal','items']}};
function parseFoodSystem(){
  const hour=new Date().getHours();const slot=hour<10.5?'breakfast':hour<14.5?'lunch':hour<17.5?'snack':'dinner';
  return `You turn what a person says they ate or drank into line items with realistic grams and macros (kcal, protein, carbs, fat). South Africa: Woolworths/Checkers/Pick n Pay portions; metric. Split composite dishes into sensible items (toast + butter + avocado). If the user states a calorie figure, honour it and distribute macros plausibly. If quantity is vague, assume a typical adult portion and say so in note. Be concise. The user's own saved foods/recipes (use their numbers when the name matches): ${(window.__myFoods||[]).slice(0,60).join('; ')||'none'}. Current time suggests the meal is "${slot}" unless the text says otherwise. Respond ONLY with the parse_food tool.`;
}
let dtlState=null; // {items,meal,note}
async function describeToLog(text){
  text=(text||'').trim();if(!text)return;
  const box=$('#dtlOut');if(!box)return;
  if(!coachAvailable()){ // offline / no coach: local search instead
    foodSeg='library';go('food');setTimeout(()=>{const q=$('#foodSearch');if(q){q.value=text;q.dispatchEvent(new Event('input'));}},60);return;}
  box.innerHTML='<div class="msg ai thinking" style="max-width:none">Working out the macros…</div>';
  try{
    const mine=(await idbGetAll('foods')).filter(f=>f.custom).map(f=>{const p=foodPer100(f);return p?`${f.name} (per 100 g: ${rnd(p.kcal)} kcal, P${rnd(p.protein)} C${rnd(p.carbs)} F${rnd(p.fat)})`:`${f.name} (${f.serving}: ${rnd(f.kcal)} kcal, P${rnd(f.protein)})`;});
    window.__myFoods=mine;
    const res=await coachRequest({kind:'food',max_tokens:2000,system:[{type:'text',text:parseFoodSystem()}],messages:[{role:'user',content:text}],tools:[PARSE_FOOD_TOOL],tool_choice:{type:'tool',name:'parse_food'}});
    const use=(res.content||[]).find(b=>b.type==='tool_use');if(!use||!use.input||!use.input.items||!use.input.items.length)throw new Error('Couldn’t read that — try naming the foods more plainly.');
    dtlState={meal:use.input.meal||'snack',note:use.input.note||'',items:use.input.items.map(i=>({name:i.name,grams:i.grams?+i.grams:null,kcal:rnd(i.kcal),protein:rnd(i.protein),carbs:rnd(i.carbs),fat:rnd(i.fat),confidence:i.confidence||'medium',save:false}))};
    renderDtl();
  }catch(e){box.innerHTML=`<div class="msg ai err" style="max-width:none">⚠️ ${esc(e.message)}</div>`;}
}
function renderDtl(){
  const box=$('#dtlOut');if(!box||!dtlState)return;const s=dtlState;
  const tot=s.items.reduce((t,i)=>({kcal:t.kcal+i.kcal,protein:t.protein+i.protein,carbs:t.carbs+i.carbs,fat:t.fat+i.fat}),{kcal:0,protein:0,carbs:0,fat:0});
  box.innerHTML=`<div class="card dtl"><div class="row between"><b>${rnd(tot.kcal)} kcal · P ${rnd(tot.protein)} · C ${rnd(tot.carbs)} · F ${rnd(tot.fat)}</b>
      <select id="dtlMeal" aria-label="Meal">${['breakfast','lunch','snack','dinner'].map(m=>`<option value="${m}"${m===s.meal?' selected':''}>${m}</option>`).join('')}</select></div>
    ${s.note?`<div class="xs muted" style="margin-top:4px">${esc(s.note)}</div>`:''}
    <div style="margin-top:6px">${s.items.map((i,ix)=>`<div class="entry dtlrow"><div style="flex:1"><div class="n">${esc(i.name)}${i.grams?` <span class="xs muted">${i.grams} g</span>`:''}${i.confidence==='low'?' <span class="badge">rough</span>':''}</div>
      <div class="s"><input type="number" inputmode="numeric" value="${i.kcal}" data-dtlk="${ix}" aria-label="kcal" style="width:64px;padding:4px 6px"> kcal · P <input type="number" inputmode="numeric" value="${i.protein}" data-dtlp="${ix}" aria-label="protein g" style="width:50px;padding:4px 6px"> · C ${i.carbs} · F ${i.fat}</div>
      <label class="xs muted" style="display:inline-flex;align-items:center;gap:4px;margin-top:2px"><input type="checkbox" data-dtlsave="${ix}" ${i.save?'checked':''} style="width:auto">save as a food</label></div>
      <button class="pillbtn" data-dtlrm="${ix}" aria-label="Remove">✕</button></div>`).join('')}</div>
    <div class="btnrow" style="margin-top:10px"><button class="btn" id="dtlLog">Log it</button><button class="btn ghost" id="dtlNo">Discard</button></div>
    <div class="xs muted" style="margin-top:6px">Estimates — good enough beats perfect. Edit a number if you know better.</div></div>`;
  box.querySelectorAll('[data-dtlk]').forEach(el=>el.oninput=()=>{s.items[+el.dataset.dtlk].kcal=+el.value||0;});
  box.querySelectorAll('[data-dtlp]').forEach(el=>el.oninput=()=>{s.items[+el.dataset.dtlp].protein=+el.value||0;});
  box.querySelectorAll('[data-dtlsave]').forEach(el=>el.onchange=()=>{s.items[+el.dataset.dtlsave].save=el.checked;});
  box.querySelectorAll('[data-dtlrm]').forEach(el=>el.onclick=()=>{s.items.splice(+el.dataset.dtlrm,1);if(!s.items.length){dtlState=null;box.innerHTML='';}else renderDtl();});
  $('#dtlMeal').onchange=e=>{s.meal=e.target.value;};
  $('#dtlNo').onclick=()=>{dtlState=null;box.innerHTML='';};
  $('#dtlLog').onclick=async()=>{
    const date=curDate||todayStr();let n=0;
    for(const i of s.items){
      let foodId=null;
      if(i.save){const f={id:uid(),name:i.name,group:'Mine',serving:i.grams?`${i.grams} g`:'1 serving',kcal:i.kcal,protein:i.protein,carbs:i.carbs,fat:i.fat,custom:true,estimated:true};
        // store weight foods per 100 g so grams logging works next time
        if(i.grams){const k=100/i.grams;Object.assign(f,{serving:'100 g',kcal:rnd(i.kcal*k),protein:rnd(i.protein*k),carbs:rnd(i.carbs*k),fat:rnd(i.fat*k)});}
        await idbPut('foods',f);foodId=f.id;}
      await idbPut('log',{id:uid(),date,meal:s.meal,foodId,name:i.name,serving:i.grams?`${i.grams} g`:'1 serving',servings:1,kcal:i.kcal,protein:i.protein,carbs:i.carbs,fat:i.fat,ts:Date.now(),estimated:true});n++;}
    dtlState=null;box.innerHTML='';$('#dtlInput').value='';buzz();toast(`Logged ${n} item${n>1?'s':''} to ${s.meal}`);renderToday();};
}

/* ---------- recipes ---------- */
async function recipeModal(editId){
  const foods=await idbGetAll('foods');const fmap=foodMap(foods);
  const rec=editId?foods.find(f=>f.id===editId):null;
  const st={name:rec?.name||'',ingredients:rec?.ingredients?JSON.parse(JSON.stringify(rec.ingredients)):[],cookedG:rec?.cookedG||''};
  openModal(`<div class="mh"><h3>${rec?'Edit recipe':'New recipe'}</h3><button class="x" onclick="closeModal()">✕</button></div>
   <p class="sm muted" style="margin:0 0 8px">Add the raw ingredients, weigh the finished pot, and from then on you log "220 g of …" like any food. Cooked weight matters — water loss is what makes eyeballing wrong.</p>
   <label class="fl">Recipe name</label><input id="rcName" value="${esc(st.name)}" placeholder="e.g. Beef curry">
   <label class="fl">Ingredients</label><div id="rcList"></div>
   <div class="row" style="gap:6px;margin-top:6px"><input id="rcQ" list="rcFoods" placeholder="Search a food…" style="flex:2" autocomplete="off"><input id="rcG" type="number" inputmode="decimal" placeholder="grams" style="flex:1"><button class="btn sm sec" id="rcAdd" style="flex:none">Add</button></div>
   <datalist id="rcFoods">${foods.filter(f=>foodPer100(f)).sort((a,b)=>a.name.localeCompare(b.name)).map(f=>`<option value="${esc(f.name)}">`).join('')}</datalist>
   <p class="xs muted" style="margin:4px 0 0">Only weight-based foods (per 100 g / ml) can go in a recipe. Countable ones (1 egg) — add them as grams: 1 egg ≈ 50 g.</p>
   <label class="fl">Cooked weight of the whole recipe (g)</label><input id="rcCooked" type="number" inputmode="decimal" value="${esc(String(st.cookedG))}" placeholder="e.g. 1850">
   <div id="rcTotals" class="sm" style="margin-top:8px"></div>
   <button class="btn" style="margin-top:14px" id="rcSave">${rec?'Save changes':'Save recipe'}</button>`);
  const totals=()=>st.ingredients.reduce((t,i)=>{const f=fmap[i.foodId];const p=f?foodPer100(f):null;if(!p)return t;const k=i.g/100;return{kcal:t.kcal+p.kcal*k,protein:t.protein+p.protein*k,carbs:t.carbs+p.carbs*k,fat:t.fat+p.fat*k,raw:t.raw+i.g};},{kcal:0,protein:0,carbs:0,fat:0,raw:0});
  const draw=()=>{$('#rcList').innerHTML=st.ingredients.length?st.ingredients.map((i,ix)=>{const f=fmap[i.foodId];return`<div class="entry"><div><div class="n">${esc(f?f.name:'?')}</div><div class="s">${i.g} g</div></div><button class="pillbtn" data-rcrm="${ix}" aria-label="Remove">✕</button></div>`;}).join(''):'<p class="sm muted">No ingredients yet.</p>';
    const t=totals();const cooked=+$('#rcCooked').value||t.raw;
    $('#rcTotals').innerHTML=st.ingredients.length?`Whole recipe: <b>${rnd(t.kcal)} kcal</b> · P ${rnd(t.protein)} · C ${rnd(t.carbs)} · F ${rnd(t.fat)} · raw ${rnd(t.raw)} g${cooked?` → <b>per 100 g cooked: ${rnd(t.kcal/cooked*100)} kcal · P ${rnd(t.protein/cooked*100)} · C ${rnd(t.carbs/cooked*100)} · F ${rnd(t.fat/cooked*100)}</b>`:''}`:'';
    $('#rcList').querySelectorAll('[data-rcrm]').forEach(b=>b.onclick=()=>{st.ingredients.splice(+b.dataset.rcrm,1);draw();});};
  draw();
  $('#rcCooked').oninput=draw;
  $('#rcAdd').onclick=()=>{const name=$('#rcQ').value.trim();const g=+$('#rcG').value;const f=foods.find(x=>x.name.toLowerCase()===name.toLowerCase()&&foodPer100(x));if(!f)return toast('Pick a weight-based food from the list');if(!(g>0))return toast('Enter grams');st.ingredients.push({foodId:f.id,g});$('#rcQ').value='';$('#rcG').value='';draw();};
  $('#rcSave').onclick=async()=>{const name=$('#rcName').value.trim();if(!name)return toast('Name the recipe');if(!st.ingredients.length)return toast('Add at least one ingredient');
    const cooked=+$('#rcCooked').value;if(!(cooked>0))return toast('Enter the cooked weight');
    const t=totals();const k=100/cooked;
    const food={id:rec?rec.id:uid(),name,group:'Recipes',serving:'100 g',kcal:rnd(t.kcal*k),protein:rnd(t.protein*k*10)/10,carbs:rnd(t.carbs*k*10)/10,fat:rnd(t.fat*k*10)/10,custom:true,kind:'recipe',ingredients:st.ingredients,cookedG:cooked};
    await idbPut('foods',food);closeModal();toast('Recipe saved — log it by grams');foodSeg='mine';renderFood();};
}
