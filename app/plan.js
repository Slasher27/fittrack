/* ---------- The plan (from the original coaching document, 27 Jul 2026) ---------- */
const PLAN_SECTIONS=[
{id:'strategy',title:'01 · The strategy & why it works',html:`
<p>You already train the big lifts and you're consistent — the usual reason a setup like this stalls is that <b>nothing is progressively driven or measured</b>. Muscle adapts only when load, reps or quality climb over time, and fat only comes off when intake is consistently below what you burn. Without tracking either, you plateau at "maintenance".</p>
<p>The goal — leaner <i>and</i> stronger — is <b>body recomposition</b>. It's realistic here because (1) at ~20–25% body fat there's ample fat to fuel muscle repair, and (2) training that hasn't been progressively overloaded leaves room to respond as if relatively "untrained".</p>
<div class="callout"><b>The plan in one sentence:</b> eat at a <i>small</i> calorie deficit with <i>high protein</i>, lift with <i>progressive overload</i> 3 days a week, keep daily movement and conditioning up, sleep well — and track it all so you adjust with data, not guesswork.</div>
<p>The deficit is deliberately small: aggressive cuts strip muscle and tank training. Slower on the scale, far better in the mirror.</p>`},
{id:'numbers',title:'02 · Your numbers: calories & macros',html:`
<p><b>Maintenance (TDEE):</b> ~2,450 kcal · <b>Daily target:</b> ~2,150 kcal (−300, ~12%) · <b>Protein:</b> 180 g/day (~2.2 g/kg)</p>
<p><b>Split at ~2,150 kcal:</b> Protein 180 g (720 kcal · 33%) · Carbs 190 g (760 kcal · 35%) · Fat 75 g (675 kcal · 32%)</p>
<h4>How these were worked out</h4>
<div class="tw"><table>
<tr><th>Step</th><th>Calculation</th><th>Result</th></tr>
<tr><td>Resting metabolism (BMR)</td><td>Mifflin-St Jeor: (10×83)+(6.25×172)−(5×45)+5</td><td>1,685 kcal</td></tr>
<tr><td>Maintenance (TDEE)</td><td>BMR × ~1.45 (lightly active + 3 hard sessions/wk)</td><td>~2,450 kcal</td></tr>
<tr><td>Deficit for recomp</td><td>−300 kcal (~12%) — small, to protect muscle</td><td><b>~2,150 kcal</b></td></tr>
<tr><td>Protein</td><td>2.2 g × 83 kg (high end, preserves muscle in a deficit)</td><td>180 g</td></tr>
<tr><td>Fat</td><td>~0.9 g × 83 kg (above the hormone-health minimum)</td><td>75 g</td></tr>
<tr><td>Carbs</td><td>Remaining calories ÷ 4 — fuel for training</td><td>190 g</td></tr>
</table></div>
<div class="callout"><b>Expected pace:</b> ~0.3–0.5 kg of fat loss per week (~0.5% of bodyweight — the rate research links to keeping muscle). Reaching ~15% body fat means losing roughly 6–7 kg of fat, landing near 76–77 kg: a 12–16 week horizon. Marathon pace on purpose.</div>`},
{id:'nutrition',title:'03 · Nutrition rules, swaps & supplements',html:`
<h4>The four rules that matter most</h4>
<ul>
<li><b>Protein at every meal</b> — ~40–45 g per meal across four meals. Muscle-building is maximised at ~0.4 g/kg per meal, so spreading beats loading it all at dinner.</li>
<li><b>Protein is non-negotiable; carbs & fat flex.</b> On a busy day hit protein first. If you overshoot calories, trim carbs or fat — never protein.</li>
<li><b>Volume eating.</b> Lean meat, eggs, potatoes, rice, fruit and plenty of veg keep you full at 2,150. Vegetables at lunch and dinner are "free" — fill half the plate.</li>
<li><b>Time carbs around training.</b> On Mon/Wed/Fri put the bigger carb meals before and after the session.</li>
</ul>
<div class="callout"><b>Weigh your food for the first 2–3 weeks.</b> A kitchen scale turns "eating healthy" into "eating exactly 2,150". After a few weeks you'll eyeball portions accurately.</div>
<p>The full 7-day set menu lives in this app under <b>Food → Meals</b>, and each day's meals appear on the Today screen.</p>
<h4>Swap list — keep it flexible (roughly equal portions)</h4>
<div class="tw"><table>
<tr><th>Category</th><th>Interchangeable options</th></tr>
<tr><td>Lean protein</td><td>Chicken breast · turkey · lean beef/game mince (5%) · steak · pork loin · hake/tuna/salmon · eggs · biltong</td></tr>
<tr><td>Starchy carbs</td><td>Rice · potato · sweet potato · oats · wholewheat pasta · quinoa · seed bread · pita</td></tr>
<tr><td>Dairy protein</td><td>Greek yoghurt · cottage cheese · milk · whey (full-fat yoghurt only if you cut fat elsewhere)</td></tr>
<tr><td>Healthy fats</td><td>Olive oil · avocado · nuts · seeds · oily fish · whole eggs (watch totals — fat is calorie-dense)</td></tr>
<tr><td>Free veg</td><td>Broccoli · spinach · green beans · peppers · courgette · salad greens · tomato · cauliflower — eat freely</td></tr>
</table></div>
<h4>Supplements — only what earns its place</h4>
<ul>
<li><b>Whey protein</b> — convenience, not magic. Makes 180 g/day easy. 1–2 scoops daily.</li>
<li><b>Creatine monohydrate, 5 g/day</b> — the most evidence-backed supplement for strength and lean mass. Any time, every day.</li>
<li><b>Vitamin D3</b> (~1,000–2,000 IU) — worth it for most adults, especially in winter.</li>
<li><b>Optional:</b> caffeine pre-workout (coffee works), fish oil if you rarely eat oily fish, magnesium if sleep is poor.</li>
</ul>
<div class="callout"><b>Hydration:</b> ~3 litres of water a day. Thirst is often mistaken for hunger on a deficit, and even mild dehydration hurts strength.</div>`},
{id:'training',title:'04 · The 3-day training program',html:`
<div class="callout"><b>The one rule that changes everything — progressive overload.</b> Log every set (weight × reps). Use <b>double progression</b>: start each lift where the <i>bottom</i> of the rep range feels like 2–3 reps left in the tank (RPE 7–8). When you hit the <i>top</i> of the range on all sets, add weight next time — <b>+2.5–5 kg</b> lower body, <b>+1.25–2.5 kg</b> upper body — and start again at the bottom.</div>
<h4>Day A — Monday · Lower focus + push</h4>
<div class="tw"><table>
<tr><th>Exercise</th><th>Sets × reps</th><th>Rest</th><th>Notes</th></tr>
<tr><td>Back Squat</td><td>4 × 5</td><td>2–3 min</td><td>Main lift. Heavy, controlled, RPE 7–8.</td></tr>
<tr><td>Bench Press</td><td>3 × 6–8</td><td>2 min</td><td>Full range, elbows ~45°.</td></tr>
<tr><td>Romanian Deadlift</td><td>3 × 8–10</td><td>90 s</td><td>Hamstring stretch, flat back.</td></tr>
<tr><td>Pull-ups</td><td>3 × 6–10</td><td>90 s</td><td>Add weight via dip belt when easy.</td></tr>
<tr><td>KB Goblet Reverse Lunge</td><td>3 × 10/leg</td><td>75 s</td><td>16–24 kg. Balance + single-leg strength.</td></tr>
<tr><td>Hanging Leg Raise</td><td>3 × 10–15</td><td>60 s</td><td>Slow, no swing.</td></tr>
<tr><td>Finisher — KB Swings</td><td>5 × 20</td><td>—</td><td>24–32 kg, every 60 s. Conditioning.</td></tr>
</table></div>
<h4>Day B — Wednesday · Upper focus + pull</h4>
<div class="tw"><table>
<tr><th>Exercise</th><th>Sets × reps</th><th>Rest</th><th>Notes</th></tr>
<tr><td>Deadlift</td><td>4 × 4–5</td><td>2–3 min</td><td>Main lift. Reset each rep, brace hard.</td></tr>
<tr><td>Overhead Press</td><td>3 × 6–8</td><td>2 min</td><td>Strict, squeeze glutes, no leg drive.</td></tr>
<tr><td>Barbell Bent-Over Row</td><td>3 × 8–10</td><td>90 s</td><td>Torso ~45°, pull to lower ribs.</td></tr>
<tr><td>Weighted Dips</td><td>3 × 8–10</td><td>90 s</td><td>Slight forward lean for chest.</td></tr>
<tr><td>Lat Pulldown / Straight-arm</td><td>3 × 12</td><td>75 s</td><td>Use the high-to-low pulley.</td></tr>
<tr><td>Superset: Lateral Raise + Band Face Pull</td><td>3 × 15 each</td><td>60 s</td><td>Shoulder health &amp; width.</td></tr>
<tr><td>Finisher — Skipping intervals</td><td>8 × 40 s</td><td>20 s</td><td>Fast rope.</td></tr>
</table></div>
<h4>Day C — Friday · Full body + conditioning</h4>
<div class="tw"><table>
<tr><th>Exercise</th><th>Sets × reps</th><th>Rest</th><th>Notes</th></tr>
<tr><td>Front Squat (or Back Squat 3×8)</td><td>3 × 6–8</td><td>2 min</td><td>Upright torso, elbows high.</td></tr>
<tr><td>Incline Bench Press</td><td>3 × 8–10</td><td>2 min</td><td>Upper chest emphasis.</td></tr>
<tr><td>Chin-ups</td><td>3 × AMRAP</td><td>90 s</td><td>As many quality reps as possible.</td></tr>
<tr><td>KB Single-leg RDL / Hip Thrust</td><td>3 × 10–12</td><td>75 s</td><td>Glutes &amp; posterior chain.</td></tr>
<tr><td>Superset: DB Curl + Triceps Pushdown</td><td>3 × 12–15</td><td>60 s</td><td>Arms &amp; pump work.</td></tr>
<tr><td>Core: Leg raises + Plank + Band Pallof</td><td>3 rounds</td><td>45 s</td><td>Anti-rotation &amp; bracing.</td></tr>
<tr><td>Finisher — Swing + Skip complex</td><td>10–12 min</td><td>—</td><td>Alternate 20 swings / 40 s skip. Zone 4.</td></tr>
</table></div>
<div class="callout"><b>Deload every 6th week.</b> Cut sets ~40% and load ~10% for one week. It will feel like under-doing it — that's the point. Recovery is when you adapt, and at 45 it protects joints and keeps progress climbing.</div>
<p>This lands each major muscle at roughly <b>10–15 hard sets per week</b> — the range meta-analyses associate with strong hypertrophy — while the low-rep work on squat, bench, deadlift and press drives strength.</p>`},
{id:'mobility',title:'05 · Mobility, cardio & conditioning',html:`
<h4>Warm-up before every session (8–10 min)</h4>
<ul>
<li>5 min easy skipping or brisk walk to raise temperature.</li>
<li><b>Dynamic flow:</b> leg swings ×10 each, hip 90/90 switches ×8, world's greatest stretch ×5/side, band shoulder dislocates ×10, cat-cow ×8, deep bodyweight squats ×10, ankle rocks ×10/side.</li>
<li><b>Ramp-up sets:</b> 2–3 light sets of the day's first lift.</li>
</ul>
<h4>Dedicated mobility (2× per week, ~10 min — Tue &amp; Thu or evenings)</h4>
<ul>
<li><b>Hips:</b> couch stretch, 90/90, deep squat hold — seated days mean hips need daily attention.</li>
<li><b>T-spine &amp; shoulders:</b> open-book rotations, band dislocates, thread-the-needle.</li>
<li><b>Ankles:</b> knee-to-wall drills — better ankle range = deeper, safer squats.</li>
</ul>
<h4>Cardio for health &amp; fat loss</h4>
<ul>
<li>Lifting finishers already cover high-intensity conditioning.</li>
<li><b>Zone 2:</b> 2–3 × 30–40 min brisk walk, cycle or easy row (Tue/Thu/Sat) at conversational pace.</li>
<li><b>Daily steps: 8,000–10,000.</b> Nudging steps up is the easiest way to widen the deficit without eating less or training more.</li>
</ul>
<div class="callout"><b>Beyond fat loss:</b> cardiorespiratory fitness has one of the steepest dose-response relationships with all-cause mortality in the literature. At 45, this is a longevity investment, not just a physique one.</div>`},
{id:'lifestyle',title:'06 · Lifestyle: sleep, recovery & multipliers',html:`
<ul>
<li><b>😴 Sleep 7–9 h</b> — the single biggest recovery lever. Short sleep raises hunger hormones, saps performance, and shifts weight loss toward muscle instead of fat. Fixed wake time, cool dark room, no screens 30 min before bed, no caffeine after ~2 pm.</li>
<li><b>🍺 Alcohol — minimise.</b> The quiet plan-killer: empty calories, blunted muscle repair, worse sleep, lowered food inhibition. Doesn't need to be zero — keep it occasional and count it.</li>
<li><b>🧘 Stress management</b> — chronic cortisol encourages fat storage (especially central) and hampers recovery. Training and walks help; add 5–10 min of daily breathing or anything that reliably down-shifts you.</li>
<li><b>🚶 Daily movement (NEAT)</b> — stairs, walks after meals (great for blood sugar), stand and move hourly. Often burns more per day than the workout.</li>
</ul>
<div class="callout"><b>Consistency beats perfection.</b> A "B+" plan followed 90% of the time crushes an "A+" plan followed 60%. Miss a workout or a meal? Don't compensate or spiral — return to plan at the next opportunity.</div>`},
{id:'tracking',title:'07 · Tracking & how to adjust',html:`
<p>Measure a few things weekly and the plan becomes self-correcting. This app covers all four:</p>
<div class="tw"><table>
<tr><th>Metric</th><th>How often</th><th>How</th></tr>
<tr><td>Bodyweight</td><td>Daily, judge by weekly average</td><td>Same time each morning, after toilet, before food. Daily weight swings 1–2 kg from water and food — never judge a single day.</td></tr>
<tr><td>Waist</td><td>Weekly</td><td>Around the navel, relaxed. Often the clearest recomp signal when the scale stalls.</td></tr>
<tr><td>Progress photos</td><td>Every 2 weeks</td><td>Same light, pose &amp; time of day. Front/side/back.</td></tr>
<tr><td>Strength log</td><td>Every session</td><td>Weight × reps on each lift. Numbers going up = muscle kept/built even in a deficit.</td></tr>
</table></div>
<h4>The adjustment rule (check every 2–3 weeks)</h4>
<ul>
<li><b>Losing 0.3–0.6 kg/week &amp; lifts holding or rising?</b> Perfect. Change nothing.</li>
<li><b>No change in weight or waist for 2–3 weeks?</b> Drop ~150 kcal/day (trim carbs/fat) <i>or</i> add ~1,500 steps/day. One lever, then reassess.</li>
<li><b>Losing faster than ~0.7 kg/week, or strength dropping and energy tanking?</b> Cutting too hard — add ~150 kcal back. Faster isn't better; that's muscle leaving.</li>
<li><b>Near 15% and want to lock it in?</b> Slowly raise calories toward maintenance (~+100/week) and shift the goal to building strength.</li>
</ul>
<div class="callout"><b>Reality check on body-fat numbers:</b> home scales and calipers are imprecise — don't chase a decimal. Trust the trend across waist, photos, strength and how clothes fit.</div>`},
{id:'evidence',title:'08 · The evidence & disclaimer',html:`
<p>The key principles are drawn from position stands and meta-analyses, not gym folklore:</p>
<ul>
<li>ISSN Position Stand: Protein and Exercise (Jäger et al., 2017) — basis for 1.4–2.0 g/kg/day, higher when dieting; ~0.4 g/kg per meal.</li>
<li>ISSN Position Stand: Diets and Body Composition (Aragon et al., 2017) — energy balance and deficit sizing.</li>
<li>Schoenfeld &amp; Aragon (2018) — per-meal protein distribution.</li>
<li>Resistance-training dose-response meta-regressions (2024/25) — ~10+ hard sets per muscle per week, higher frequency.</li>
<li>Midlife cardiorespiratory fitness &amp; long-term mortality (JACC 2018; 2025 review) — the case for cardio at midlife.</li>
</ul>
<p class="xs muted"><b>Disclaimer:</b> general fitness and nutrition guidance based on the information provided, not medical advice. It assumes good health with no injuries or conditions. Before a new heavy-lifting program or calorie deficit, a quick doctor check-in is worthwhile. Stop and seek advice for chest pain, dizziness, joint pain, or anything that doesn't feel right.</p>`},
];

const PLAN_CONTEXT=`PROFILE: 45-year-old male, 1.72 m, 83 kg start weight, est. 20-25% body fat. Goal: body recomposition to ~15% body fat (~76-77 kg) over 12-16 weeks. Garage gym (barbell, dumbbells, kettlebells 16-32 kg, dip station, high/low pulley, bands, skipping rope). Trains Mon/Wed/Fri.
NUMBERS: BMR 1,685 kcal (Mifflin-St Jeor). TDEE ~2,450 kcal (x1.45 activity). Daily target ~2,150 kcal (-300, ~12% deficit, small to protect muscle). Protein 180 g (2.2 g/kg, 720 kcal, 33%). Carbs 190 g (760 kcal, 35%). Fat 75 g (675 kcal, 32%, ~0.9 g/kg, above hormone-health minimum). Expected fat loss 0.3-0.5 kg/week (~0.5% BW). Weigh food first 2-3 weeks.
NUTRITION RULES: ~40-45 g protein per meal across 4 meals (max muscle synthesis ~0.4 g/kg/meal). Protein non-negotiable, carbs/fat flex. Volume eating; veg at lunch+dinner free. Time carbs around training on Mon/Wed/Fri. 7-day set menu is in the app (Food > Meals): ~2,100-2,200 kcal and ~180 g protein daily, meat-forward, home-cooked, SA staples; Sunday is prep day (cook rice, boil eggs, portion meat for Mon-Wed). Swaps: proteins interchangeable (chicken/turkey/lean mince/steak/pork loin/fish/eggs/biltong), carbs (rice/potato/sweet potato/oats/wholewheat pasta/quinoa/seed bread/pita), dairy (greek yoghurt/cottage cheese/milk/whey), fats (olive oil/avo/nuts/seeds/oily fish), free veg unlimited. Supplements: whey 1-2 scoops, creatine monohydrate 5 g/day any time, vitamin D3 1000-2000 IU; optional caffeine, fish oil, magnesium. Water ~3 L/day.
TRAINING: 3 full-body sessions, 60-75 min. Progressive overload via double progression: start at bottom of rep range at RPE 7-8; when all sets hit the top of the range, add +2.5-5 kg lower body / +1.25-2.5 kg upper body and restart at bottom. Log every set.
Day A (Mon, lower+push): Back Squat 4x5 rest 2-3min; Bench Press 3x6-8 rest 2min; Romanian Deadlift 3x8-10 rest 90s; Pull-ups 3x6-10 (weight via dip belt when easy); KB Goblet Reverse Lunge 3x10/leg; Hanging Leg Raise 3x10-15; finisher KB Swings 5x20 every 60s (24-32 kg).
Day B (Wed, upper+pull): Deadlift 4x4-5 rest 2-3min; Overhead Press 3x6-8 strict; Barbell Row 3x8-10 (torso ~45deg); Weighted Dips 3x8-10; Lat Pulldown/straight-arm 3x12; superset Lateral Raise + Band Face Pull 3x15; finisher skipping 8x40s/20s rest.
Day C (Fri, full body): Front Squat 3x6-8 (or Back Squat 3x8); Incline Bench 3x8-10; Chin-ups 3xAMRAP; KB Single-leg RDL or Hip Thrust 3x10-12; superset DB Curl + Triceps Pushdown 3x12-15; core circuit (leg raises, plank, band Pallof) 3 rounds; finisher 10-12 min swing+skip complex.
Deload every 6th week: cut sets ~40%, load ~10%. Weekly volume ~10-15 hard sets per muscle.
MOBILITY/CARDIO: warm-up 8-10 min (easy skip/walk, dynamic flow, 2-3 ramp-up sets). Mobility 2x/week ~10 min: hips (couch stretch, 90/90, deep squat hold), t-spine/shoulders (open-book, dislocates, thread-the-needle), ankles (knee-to-wall). Zone 2 cardio 2-3x 30-40 min (Tue/Thu/Sat) conversational pace. Steps 8,000-10,000/day.
LIFESTYLE: sleep 7-9 h (fixed wake time, cool dark room, no screens 30 min before bed, no caffeine after 2 pm). Minimise alcohol. Manage stress (5-10 min daily breathing/walking). NEAT: stairs, post-meal walks, move hourly. Consistency beats perfection: B+ plan at 90% adherence beats A+ at 60%.
TRACKING: weigh daily, judge weekly average only (same time, morning). Waist weekly at navel. Photos every 2 weeks (same light/pose, front/side/back). Log every set. Adjust every 2-3 weeks: losing 0.3-0.6 kg/wk with lifts holding = change nothing; stalled 2-3 weeks = -150 kcal OR +1,500 steps (one lever); losing >0.7 kg/wk or strength/energy dropping = +150 kcal back; near 15% = reverse toward maintenance +100 kcal/week and shift goal to strength. Don't trust home body-fat gadgets; trust waist+photos+strength+clothes.
EVIDENCE: ISSN protein position stand (Jager 2017: 1.4-2.0 g/kg, ~0.4 g/kg/meal), ISSN diets & body composition (Aragon 2017), Schoenfeld & Aragon 2018 per-meal protein, volume meta-regressions (10+ sets/muscle/week), midlife cardiorespiratory fitness & mortality (JACC 2018).`;

const AI_SYSTEM=`You are the built-in assistant of FitTrack, a personal fitness-tracking app. The user is the person the plan below was written for. Answer their questions using the plan as your primary source; quote its specific numbers where relevant. If a question goes beyond the plan, give brief, evidence-based general guidance and say it's general. Keep answers short and practical: a few sentences, or a short list if genuinely needed. No greetings or sign-offs. You are not a doctor; for pain, injury or medical concerns, briefly advise seeing a professional.

THE PLAN:
${PLAN_CONTEXT}`;

function renderPlan(){
  const root=$('#planSecs');
  if(!root.children.length)
    root.innerHTML=PLAN_SECTIONS.map(s=>`<details class="plansec" data-psec="${s.id}"><summary>${s.title}</summary><div class="psb">${s.html}</div></details>`).join('');
  $('#aiHint').textContent=SET.aiKey
    ?'Answered by Claude using your plan. Works offline too (falls back to plan search). Not medical advice.'
    :'Offline mode: Ask searches the plan below. Add an Anthropic API key in ⚙️ Settings for AI answers.';
}

function mdLite(s){return esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
  .split(/\n{2,}/).map(p=>`<p>${p.replace(/^[-•] /gm,'· ').replace(/\n/g,'<br>')}</p>`).join('');}

async function askClaude(q){
  const res=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-api-key':SET.aiKey,
      'anthropic-version':'2023-06-01',
      'anthropic-dangerous-direct-browser-access':'true'
    },
    body:JSON.stringify({
      model:'claude-opus-5',
      max_tokens:1500,
      output_config:{effort:'low'},
      system:[{type:'text',text:AI_SYSTEM,cache_control:{type:'ephemeral'}}],
      messages:[{role:'user',content:q}]
    })
  });
  if(!res.ok){
    const err=await res.json().catch(()=>null);
    throw new Error(err?.error?.message||('request failed ('+res.status+')'));
  }
  const data=await res.json();
  if(data.stop_reason==='refusal')throw new Error('the assistant declined this question');
  return data.content.filter(b=>b.type==='text').map(b=>b.text).join('\n')||'(no answer)';
}

function localPlanSearch(q,out){
  const words=q.toLowerCase().split(/[^a-z0-9%]+/).filter(w=>w.length>2);
  const scored=PLAN_SECTIONS.map(s=>{
    const txt=(s.title+' '+s.html).toLowerCase();
    return{s,n:words.reduce((n,w)=>n+(txt.split(w).length-1),0)};
  }).filter(x=>x.n>0).sort((a,b)=>b.n-a.n).slice(0,2);
  $$('#planSecs details').forEach(d=>d.open=false);
  if(!scored.length){out.innerHTML=`<div class="aians">No matching section found — try different words, or browse the sections below.</div>`;return;}
  out.innerHTML=`<div class="aians">Opened the most relevant section${scored.length>1?'s':''}: ${scored.map(x=>`<b>${esc(x.s.title)}</b>`).join(' and ')} ↓</div>`;
  for(const x of scored)$(`#planSecs [data-psec="${x.s.id}"]`).open=true;
  $(`#planSecs [data-psec="${scored[0].s.id}"]`).scrollIntoView({behavior:reducedMotion()?'auto':'smooth',block:'start'});
}

async function askPlan(){
  const q=$('#aiQ').value.trim();if(!q)return;
  const out=$('#aiA');
  if(SET.aiKey&&navigator.onLine){
    const btn=$('#aiAsk');btn.disabled=true;btn.textContent='…';
    out.innerHTML=`<div class="sm muted" style="margin-top:10px">Thinking…</div>`;
    try{
      out.innerHTML=`<div class="aians">${mdLite(await askClaude(q))}</div>`;
    }catch(err){
      out.innerHTML=`<div class="aians" style="border-left:3px solid var(--danger)">Couldn't get an AI answer (${esc(err.message)}). Showing plan search instead:</div>`;
      const fb=document.createElement('div');out.appendChild(fb);localPlanSearch(q,fb);
    }
    btn.disabled=false;btn.textContent='Ask';
  }else{
    localPlanSearch(q,out);
  }
}

