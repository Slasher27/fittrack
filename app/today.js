/* ============================ TODAY ============================ */
async function renderToday(){
  $('#dayLabel').textContent=niceDate(curDate);
  const entries=(await idbByDate('log',curDate)).sort((a,b)=>a.ts-b.ts);
  let tot={kcal:0,protein:0,carbs:0,fat:0};
  entries.forEach(e=>{tot.kcal+=e.kcal;tot.protein+=e.protein;tot.carbs+=e.carbs;tot.fat+=e.fat;});
  // training days can carry their own calorie target (Settings → "Training-day kcal")
  const dayAbbrT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][parseD(curDate).getDay()];
  const wos=await idbByDate('workouts',curDate);
  const isTrainDay=!!PROG.days[PROG.schedule[dayAbbrT]]||wos.length>0;
  const T={...SET.targets};
  if(isTrainDay&&SET.targets.kcalTrain)T.kcal=SET.targets.kcalTrain;
  $('#tgtMode').textContent=(isTrainDay&&SET.targets.kcalTrain)?'(training day)':'';
  const remain=Math.round(T.kcal-tot.kcal);
  countUp($('#calRemain'),remain);
  $('#calRemain').style.color=remain<0?'var(--danger)':'var(--ink)';
  $('#calEaten').textContent=rnd(tot.kcal);
  $('#calTarget').textContent=T.kcal;
  const C=326.7, pct=Math.min(1,tot.kcal/T.kcal);
  $('#calRing').style.strokeDashoffset=C*(1-pct);
  $('#calRing').style.stroke=tot.kcal>T.kcal?'var(--danger)':'var(--brand)';
  const mb=(id,val,tg)=>{$('#'+id+'Txt').textContent=rnd(val)+' / '+tg+' g';$('#'+id+'Fill').style.width=Math.min(100,val/tg*100)+'%';};
  mb('p',tot.protein,T.protein);mb('c',tot.carbs,T.carbs);mb('f',tot.fat,T.fat);

  // summary: measurement + workout for the day
  const meas=(await idbByDate('measurements',curDate))[0];
  let sum='';
  if(meas){sum+=`<div class="card"><div class="row between"><div><span class="badge">⚖️ Weigh-in</span> <b style="margin-left:6px">${meas.weight??'–'} kg</b>${meas.waist?` · waist ${meas.waist} cm`:''}</div></div></div>`;}
  // an empty session (accidental tap → "Finish") is noise, not history — don't give it a card
  if(wos.length){wos.forEach(w=>{const done=w.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.reps||s.secs).length,0);
    if(!done)return;
    sum+=`<div class="card sessioncard"><div class="row between"><div><span class="badge">🏋️ ${esc(w.title.split('—')[0].trim())}</span> <span class="sm muted">${done} sets logged</span></div><button class="pillbtn" data-openwo="${w.id}">View</button></div></div>`;});}
  $('#todaySummary').innerHTML=sum;

  // food entries by meal
  const slots=[['breakfast','Breakfast'],['lunch','Lunch'],['snack','Snack'],['dinner','Dinner'],['',''.trim()]];
  let html='';
  const grouped={};entries.forEach(e=>{(grouped[e.meal||'other']=grouped[e.meal||'other']||[]).push(e);});
  const order=['breakfast','lunch','snack','dinner','other'];
  const labels={breakfast:'Breakfast',lunch:'Lunch',snack:'Snack',dinner:'Dinner',other:'Other'};
  let any=false;
  for(const slot of order){const es=grouped[slot];if(!es||!es.length)continue;any=true;let sk=es.reduce((n,e)=>n+e.kcal,0);
    html+=`<div class="meal-h"><span>${labels[slot]}</span><span>${rnd(sk)} kcal</span></div>`;
    es.forEach(e=>{html+=`<div class="entry planrow" role="button" tabindex="0" data-editlog="${e.id}"><div><div class="n">${esc(e.name)}</div><div class="s">${esc(qtyLabel(e.serving,+e.servings))} · ${rnd(e.protein)}P ${rnd(e.carbs)}C ${rnd(e.fat)}F · tap to edit</div></div><div class="row" style="gap:8px"><div class="k">${rnd(e.kcal)}</div><button class="pillbtn" data-dellog="${e.id}" aria-label="Remove logged item">✕</button></div></div>`;});
  }
  $('#todayFood').innerHTML=any?`<div class="card">${html}</div>`:`<div class="empty"><span class="ic">🍽️</span>No food logged yet.<br>Tap “Log food” or “Log meal” above.<br><button class="btn sec sm" data-repeatday style="margin-top:12px">↻ Repeat yesterday’s log</button></div>`;

  /* NEXT UP — the dashboard answers one question: what do I do now?
     Replaces the old four quick-action buttons + full plan card + separate
     "Log next", which between them gave four competing calls to action. */
  const dayAbbr=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][parseD(curDate).getDay()];
  const planMeals=(await idbGetAll('meals')).filter(m=>!m.custom&&m.day===dayAbbr)
    .sort((a,b)=>(SLOT_ORDER[a.slot]??9)-(SLOT_ORDER[b.slot]??9));
  const woKey=PROG.days[PROG.schedule[dayAbbr]]?PROG.schedule[dayAbbr]:null;
  const woPending=woKey&&!wos.length;
  const fmap=foodMap(await idbGetAll('foods'));
  const mealState=[];
  for(const m of planMeals)
    mealState.push({m,done:!!(grouped[SLOT_KEY[m.slot]]||[]).length,t:await mealMacros(m,fmap)});
  const next=mealState.find(x=>!x.done);
  const left=mealState.filter(x=>!x.done).length;

  let hero='';
  if(next){
    hero=`<div class="card nextup">
      <div class="nu-h"><span>Next up</span><span class="nu-day">${DAY_FULL[dayAbbr]}${woKey?` · 🏋️ Day ${woKey}`:' · rest day'}</span></div>
      <div class="nu-main" role="button" tabindex="0" data-logmeal="${next.m.id}">
        <div class="nu-txt"><div class="nu-n">${esc(next.m.name)}</div>
          <div class="nu-s">${esc(next.m.slot)} · ${rnd(next.t.kcal)} kcal · ${rnd(next.t.protein)} g protein</div></div>
        <button class="btn" data-logmeal="${next.m.id}">Log it</button>
      </div>
      ${woPending?`<div class="nu-alt" role="button" tabindex="0" data-startday="${woKey}">
        <div><div class="nu-n2">🏋️ ${esc(PROG.days[woKey].title.split('—')[1]?.trim()||PROG.days[woKey].title)}</div>
          <div class="nu-s">Training day — sets pre-filled from last time</div></div>
        <button class="btn sec sm" data-startday="${woKey}">Start</button></div>`:''}
      ${left>1?`<details class="nu-rest"><summary>${left-1} more meal${left>2?'s':''} today</summary>${
        mealState.filter(x=>x!==next).map(x=>`<div class="entry planrow${x.done?' done':''}" role="button" tabindex="0" data-logmeal="${x.m.id}"><div><div class="n">${x.done?'✓ ':''}${esc(x.m.name)}</div><div class="s">${esc(x.m.slot)} · ${rnd(x.t.kcal)} kcal · ${rnd(x.t.protein)}P</div></div>${x.done?'':`<button class="pillbtn" data-logmeal="${x.m.id}">Log</button>`}</div>`).join('')
      }</details>`:''}
      <div class="nu-more"><button class="btn ghost sm" data-quick="food">+ Something else</button><button class="btn ghost sm" data-quick="weight">⚖️ Weigh in</button></div>
    </div>`;
  }else if(woPending){
    hero=`<div class="card nextup">
      <div class="nu-h"><span>Next up</span><span class="nu-day">${DAY_FULL[dayAbbr]} · 🏋️ Day ${woKey}</span></div>
      <div class="nu-main" role="button" tabindex="0" data-startday="${woKey}">
        <div class="nu-txt"><div class="nu-n">${esc(PROG.days[woKey].title.split('—')[1]?.trim()||PROG.days[woKey].title)}</div>
          <div class="nu-s">Food's all logged — sets pre-filled from last time</div></div>
        <button class="btn" data-startday="${woKey}">Start</button>
      </div>
      <div class="nu-more"><button class="btn ghost sm" data-quick="food">+ Something else</button><button class="btn ghost sm" data-quick="weight">⚖️ Weigh in</button></div>
    </div>`;
  }else if(mealState.length||wos.length){
    hero=`<div class="card nextup done">
      <div class="nu-h"><span>Today</span><span class="nu-day">${DAY_FULL[dayAbbr]}</span></div>
      <div class="nu-main"><div class="nu-txt"><div class="nu-n">✓ All done</div>
        <div class="nu-s">${rnd(tot.kcal)} kcal · ${rnd(tot.protein)} g protein${wos.length?' · session logged':''}</div></div></div>
      <div class="nu-more"><button class="btn ghost sm" data-quick="food">+ Something else</button><button class="btn ghost sm" data-quick="weight">⚖️ Weigh in</button></div>
    </div>`;
  }
  $('#todayNext').innerHTML=hero;

  // this week at a glance (Mon-based): intake vs target, sessions, weight trend
  {
    const [allLogs,allMeas,allWos]=await Promise.all([idbGetAll('log'),idbGetAll('measurements'),idbGetAll('workouts')]);
    const now=parseD(todayStr());const monOff=(now.getDay()+6)%7;
    const dOff=n=>{const d=new Date(now);d.setDate(d.getDate()-n);return dstr(d);};
    const weekDates=[];for(let i=monOff;i>=0;i--)weekDates.push(dOff(i));
    const byDay={};allLogs.forEach(e=>{if(weekDates.includes(e.date)){const d=byDay[e.date]=byDay[e.date]||{kcal:0,protein:0};d.kcal+=e.kcal;d.protein+=e.protein;}});
    const anyData=Object.keys(byDay).length>0;
    const loggedDays=Object.keys(byDay).filter(d=>d!==todayStr()||byDay[d].kcal>800); // averages skip a barely-started today
    const avgK=loggedDays.length?loggedDays.reduce((s,d)=>s+byDay[d].kcal,0)/loggedDays.length:null;
    const avgP=loggedDays.length?loggedDays.reduce((s,d)=>s+byDay[d].protein,0)/loggedDays.length:null;
    const sessions=allWos.filter(w=>weekDates.includes(w.date)).length;
    const scheduled=Object.keys(PROG.schedule||{}).length;
    const wWeek=allMeas.filter(m=>m.weight!=null&&weekDates.includes(m.date));
    const prevDates=[];for(let i=monOff+7;i>monOff;i--)prevDates.push(dOff(i));
    const wPrev=allMeas.filter(m=>m.weight!=null&&prevDates.includes(m.date));
    const mean=a=>a.length?a.reduce((s,m)=>s+m.weight,0)/a.length:null;
    const delta=(mean(wWeek)!=null&&mean(wPrev)!=null)?mean(wWeek)-mean(wPrev):null;
    const stat=(v,lab)=>`<div style="flex:1;text-align:center"><div style="font-family:var(--font-display);font-size:24px;font-weight:700">${v}</div><div class="xs muted" style="text-transform:uppercase;letter-spacing:.08em">${lab}</div></div>`;
    $('#todayWeek').innerHTML=(anyData||sessions)?`<div class="card">
      <div class="meal-h" style="margin-top:0"><span>This week</span><span class="badge">${weekDates.length} day${weekDates.length>1?'s':''} in</span></div>
      <div class="row" style="gap:6px">
        ${stat(avgK!=null?rnd(avgK):'–','avg kcal / '+SET.targets.kcal)}
        ${stat(avgP!=null?rnd(avgP)+'g':'–','avg protein / '+SET.targets.protein+'g')}
        ${stat(sessions+'/'+scheduled,'sessions')}
        ${stat(delta!=null?(delta>0?'+':'')+delta.toFixed(1)+'kg':'–','vs last week')}
      </div>
    </div>`:'';
  }

  // first-run guide: the app finally explains its own daily loop (dismiss once, gone forever)
  const howDone=await idbGet('kv','howtoDismissed');
  $('#todayHow').innerHTML=howDone?'':`<div class="card" style="border-color:color-mix(in srgb,var(--volt) 35%,transparent)">
    <div class="meal-h" style="margin-top:0"><span>How FitTrack works</span></div>
    <div class="sm" style="line-height:1.7">
      <b>1.</b> Eat what's on today's plan below — tap <b>Log next</b> as you go.<br>
      <b>2.</b> Weigh in each morning (<b>Weigh-in</b> button). One number, done.<br>
      <b>3.</b> Tap <b>+250</b> when you drink water.<br>
      <b>4.</b> Mon / Wed / Fri: <b>Start</b> your workout — sets are pre-filled, and it tells you when to add weight.<br>
      That's the whole job (~60 seconds a day). The 🧠 Coach watches your data and tells you what to change — you never have to analyse anything.
    </div>
    <button class="btn sec sm" data-dismisshow style="margin-top:10px">Got it — don't show again</button>
  </div>`;

  // water tracker for the viewed day
  const waterMl=(await idbByDate('water',curDate)).reduce((s,w)=>s+w.ml,0);
  const wPct=Math.min(100,waterMl/WATER_TARGET_ML*100);
  const litres=(waterMl/1000).toFixed(2).replace(/\.?0+$/,'')||'0';
  $('#todayWater').innerHTML=`<div class="card" style="padding:12px 16px;margin-bottom:14px"><div class="row between">
    <div><div class="row" style="gap:7px"><svg class="ic-s" style="color:var(--f)" aria-hidden="true"><use href="#i-drop"/></svg><b style="font-family:var(--font-display);font-size:17px;letter-spacing:.03em">${litres} L</b><span class="sm muted">/ ${WATER_TARGET_ML/1000} L</span>${waterMl>=WATER_TARGET_ML?'<span class="badge">✓ done</span>':''}</div>
      <div style="width:min(150px,30vw);height:7px;background:var(--track);border-radius:6px;overflow:hidden;margin-top:6px"><div style="height:100%;width:${wPct}%;background:var(--f);border-radius:6px;transition:width .3s"></div></div></div>
    <div class="row" style="gap:6px"><button class="pillbtn" data-water="250">+250</button><button class="pillbtn" data-water="500">+500</button><button class="pillbtn" data-water="undo" aria-label="Undo last water entry">↺</button></div>
  </div></div>`;
  renderCoach();
}

