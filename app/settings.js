/* ---------- Settings ---------- */
var SET={k:'settings',targets:{kcal:2150,protein:180,carbs:190,fat:75},goalWeight:76.5,startWeight:83,theme:'dark'}; // Athletic Dark is the default identity
async function loadSettings(){const s=await idbGet('kv','settings');if(s)SET=Object.assign(SET,s);}
/* Exercise catalog: name/alias → entity. Replaces the name-guessing heuristics
   (UNILATERAL_RE, rest-by-regex) with real data, and keys volume rollups. */
let EXBYID={},EXBYNAME={};
const exKey=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
async function loadExercises(){
  const all=await idbGetAll('exercises');
  EXBYID={};EXBYNAME={};
  for(const e of all){
    EXBYID[e.id]=e;
    EXBYNAME[exKey(e.name)]=e;
    for(const a of e.aliases||[])if(!EXBYNAME[exKey(a)])EXBYNAME[exKey(a)]=e;
  }
}
function exFind(name){ // by id first (v2 records), then name, then alias
  if(!name)return null;
  return EXBYID[name]||EXBYNAME[exKey(name)]||null;
}
/* Plans are entities (store `plans`, synced): the coach's plan, plans shared with you,
   plans you built. Exactly one is active (kv `activePlan`, synced). PROG points at the
   active plan record, so everything that reads PROG.days / PROG.schedule keeps working.
   First run on a device migrates the legacy kv `program` (or seeds the default) into a
   plan with a DETERMINISTIC id, written UNSTAMPED (fromSync=true): every device derives
   the same record from the same synced source, nothing is pushed until the user actually
   edits (saveProgram stamps it), and a stamped copy from another device always wins on
   pull. Two devices migrating independently therefore converge instead of duplicating
   or out-stamping each other. */
async function loadProgram(){
  PLANS=(await idbGetAll('plans')).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  if(!PLANS.length){
    const legacy=(await idbGet('kv','program'))?.v;
    const src=legacy||DEFAULT_PROGRAM;
    const plan={id:legacy?'plan-legacy':'plan-default',name:legacy?'My program':'Default plan — 3-day full body',
      description:legacy?'Migrated from your v1 program':'Strength + conditioning, Mon/Wed/Fri',
      days:src.days,schedule:src.schedule,source:legacy?'custom':'seed',createdAt:Date.now()};
    await idbPut('plans',plan,true);PLANS=[plan];
  }
  let activeId=(await idbGet('kv','activePlan'))?.v;
  if(!activeId||!PLANS.some(p=>p.id===activeId)){activeId=PLANS[0].id;await idbPut('kv',{k:'activePlan',v:activeId},true);} // default choice, unstamped; an explicit choice (setActivePlan) is stamped and syncs
  PROG=PLANS.find(p=>p.id===activeId);
  EQUIP=(await idbGet('kv','equipment'))?.v||EQUIP;
  // migrate pre-inventory records
  if(!EQUIP.dumbbells)EQUIP.dumbbells=EQUIP.dbMaxKg===10?[2,3,6,10]:[EQUIP.dbMaxKg];
  if(!EQUIP.bars)EQUIP.bars=[{name:'Olympic barbell',kg:EQUIP.barKg||20}];
  if(!EQUIP.plates)EQUIP.plates=DEFAULT_EQUIPMENT.plates.map(p=>({...p}));
  if(!EQUIP.bands)EQUIP.bands=DEFAULT_EQUIPMENT.bands.slice();
  if(!EQUIP.gear)EQUIP.gear=DEFAULT_EQUIPMENT.gear.slice();
  if(!EQUIP.barKg)EQUIP.barKg=20;
  // migrate pre-mode programs: interval-style exercises log seconds, not kg × reps.
  // In-memory only — never idbPut here, or a mere page load would out-stamp a
  // genuinely newer program from another device (LWW).
  for(const d of Object.values(PROG.days))for(const e of d.ex){
    // unilateral work: reps are PER SIDE. Without this the app can't tell you
    // whether "3 × 10" means 10 per leg or 5 — the #1 logging ambiguity.
    if(e.perSide==null)e.perSide=isUnilateral(e.name)||/\/\s*(leg|side|arm)|per (leg|side|arm)/i.test(e.target||'');
    normalizeTarget(e); // structured tgt from legacy strings; label derived (with "per leg/arm"); circuits get items (in memory)
    if(!e.mode)e.mode=/\d\s*s\b/i.test(e.target)||/skip|interval|plank|hold/i.test(e.name)?'time':'reps';
    if(e.mode==='time'&&e.rest==null)e.rest=/skip/i.test(e.name)?20:30;
    // programs stored before per-exercise rest existed fell back to a flat 90 s;
    // restore the plan's real rest periods (main lifts breathe, isolation doesn't)
    if(e.rest==null)e.rest=defaultRest(e);
  }
}
const UNILATERAL_RE=/single[- ]?(leg|arm)|one[- ]?(leg|arm)|lunge|split squat|step[- ]?up|bulgarian|pistol|suitcase|turkish/i;
function isUnilateral(name){const c=exFind(name);return c?c.unilateral:UNILATERAL_RE.test(name||'');}
function defaultRest(e){ // catalog is authoritative; name-guessing only for exercises it doesn't know
  const c=exFind(e.name);
  if(c)return c.defaultRest;
  if(e.mode==='time')return 30;
  const top=repTop(e.target);
  if(/squat|deadlift|bench|press|row|pull-?up|chin-?up|dip/i.test(e.name)&&(top==null||top<=8))
    return /squat|deadlift/i.test(e.name)?150:120;
  if(e.type==='barbell-lower'||e.type==='barbell-upper')return 90;
  if(e.type==='bodyweight')return 90;
  if(top!=null&&top>=12)return 60;
  return 75;
}
async function saveSettings(){await idbPut('kv',SET);}

/* ---------- Theme ---------- */
const darkMQ=matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){
  const t=SET.theme||'dark';
  const dark=t==='dark'||(t==='auto'&&darkMQ.matches);
  document.documentElement.dataset.theme=dark?'dark':'light';
  const meta=document.querySelector('meta[name=theme-color]');
  if(meta)meta.setAttribute('content',dark?'#0B0D0C':'#F3F5F1');
  if(curView==='body')renderBody(); // canvas chart samples CSS vars at draw time
}
darkMQ.addEventListener('change',()=>{if((SET.theme||'auto')==='auto')applyTheme();});

