/* ---------- Seed data ---------- */
const SEED_FOODS=[
 // Protein  [id,name,group,serving,kcal,p,c,f]
 ['chicken-breast','Chicken breast','Protein','100 g',165,31,0,3.6],
 ['chicken-thigh','Chicken thigh (skinless)','Protein','100 g',209,26,0,11],
 ['beef-mince-5','Lean beef mince 5%','Protein','100 g',170,26,0,8],
 ['steak-lean','Lean steak','Protein','100 g',210,30,0,10],
 ['pork-loin','Pork loin','Protein','100 g',190,28,0,8],
 ['hake','Hake / white fish','Protein','100 g',90,20,0,1.5],
 ['tuna','Tuna, tinned in water','Protein','100 g',116,26,0,1],
 ['salmon','Salmon','Protein','100 g',208,22,0,13],
 ['egg','Egg, whole','Protein','1 egg',72,6.3,0.4,4.8],
 ['egg-white','Egg white','Protein','1 white',17,3.6,0.2,0.1],
 ['biltong','Lean biltong','Protein','30 g',75,16.5,0.6,1],
 ['bacon','Lean bacon','Protein','1 rasher',45,6,0,2.5],
 ['whey','Whey protein','Protein','1 scoop (30 g)',120,24,3,1.5],
 // Dairy
 ['greek-yog','Greek yoghurt, low-fat','Dairy','100 g',60,10,4,1],
 ['cottage','Cottage cheese, low-fat','Dairy','100 g',98,11,3.4,4.3],
 ['milk','Milk (2%)','Dairy','100 ml',50,3.3,4.8,1.9],
 ['cheddar','Cheddar cheese','Dairy','30 g',120,7,0.4,10],
 // Carbs
 ['rice','White rice, cooked','Carbs','100 g',130,2.7,28,0.3],
 ['potato','Potato, boiled','Carbs','100 g',87,2,20,0.1],
 ['sweet-potato','Sweet potato, cooked','Carbs','100 g',90,2,21,0.1],
 ['oats','Oats, dry','Carbs','40 g',150,5,27,3],
 ['pasta-ww','Wholewheat pasta, cooked','Carbs','100 g',130,5,27,1],
 ['quinoa','Quinoa, cooked','Carbs','100 g',120,4.4,21,1.9],
 ['bread','Seed / brown bread','Carbs','1 slice',90,4,15,1.5],
 ['granola','Granola','Carbs','40 g',180,4,27,6],
 ['pita','Pita bread','Carbs','1 pita',165,5,33,1],
 ['corn','Corn on the cob','Carbs','1 cob',100,3,22,1.5],
 // Fruit
 ['banana','Banana','Fruit','1 medium',105,1.3,27,0.4],
 ['apple','Apple','Fruit','1 medium',95,0.5,25,0.3],
 ['berries','Mixed berries','Fruit','100 g',50,1,12,0.3],
 ['honey','Honey','Fruit','1 tsp (10 g)',30,0,8,0],
 // Fats
 ['olive-oil-tsp','Olive oil','Fats','1 tsp',40,0,0,4.5],
 ['olive-oil-tbsp','Olive oil','Fats','1 tbsp',120,0,0,14],
 ['avocado','Avocado','Fats','½ medium',160,2,9,15],
 ['peanut-butter','Peanut butter','Fats','1 tbsp',95,4,3,8],
 ['nuts','Mixed nuts','Fats','30 g',180,5,6,15],
 ['mayo-light','Light mayo','Fats','1 tbsp',35,0,1,3],
 // Veg
 ['salad','Mixed salad / veg','Veg','100 g',30,2,5,0.3],
 ['broccoli','Broccoli','Veg','100 g',34,2.8,7,0.4],
 ['green-beans','Green beans','Veg','100 g',31,1.8,7,0.1],
 ['spinach','Spinach','Veg','100 g',23,2.9,3.6,0.4],
].map(a=>({id:a[0],name:a[1],group:a[2],serving:a[3],kcal:a[4],protein:a[5],carbs:a[6],fat:a[7],custom:false}));

const SEED_MEALS=[
 // [id, day, slot, name, items]   — full 7-day plan from your HTML document
 // MONDAY (training)
 ['mon-b','Mon','Breakfast','Eggs & oats',[['egg',3],['egg-white',4],['oats',1.5],['banana',1]]],
 ['mon-l','Mon','Lunch','Chicken, rice & salad',[['chicken-breast',1.8],['rice',1.8],['salad',1],['olive-oil-tsp',1]]],
 ['mon-s','Mon','Snack','Post-workout yoghurt & whey',[['greek-yog',2],['whey',1],['berries',0.5]]],
 ['mon-d','Mon','Dinner','Beef mince, potato & avo',[['beef-mince-5',1.5],['potato',2],['salad',1],['avocado',1]]],
 // TUESDAY (rest)
 ['tue-b','Tue','Breakfast','Yoghurt, oats & whey',[['greek-yog',2],['oats',1],['whey',1],['berries',1],['honey',1]]],
 ['tue-l','Tue','Lunch','Tuna sandwich & salad',[['tuna',1.6],['bread',2],['salad',1],['mayo-light',1]]],
 ['tue-s','Tue','Snack','Biltong & apple',[['biltong',1.7],['apple',1]]],
 ['tue-d','Tue','Dinner','Chicken thigh & sweet potato',[['chicken-thigh',1.8],['sweet-potato',1.5],['green-beans',1],['broccoli',1]]],
 // WEDNESDAY (training)
 ['wed-b','Wed','Breakfast','Cheese omelette & toast',[['egg',4],['cheddar',1],['bread',1],['spinach',0.5]]],
 ['wed-l','Wed','Lunch','Steak stir-fry & rice',[['steak-lean',1.8],['rice',1.8],['salad',1]]],
 ['wed-s','Wed','Snack','Post-workout shake',[['whey',1],['banana',1],['greek-yog',2]]],
 ['wed-d','Wed','Dinner','Chicken, mash & salad',[['chicken-breast',1.8],['potato',2],['salad',1],['olive-oil-tsp',1]]],
 // THURSDAY (rest)
 ['thu-b','Thu','Breakfast','Eggs, oats & peanut butter',[['egg',3],['egg-white',3],['oats',1.5],['peanut-butter',1],['banana',0.5]]],
 ['thu-l','Thu','Lunch','Beef bolognese & pasta',[['beef-mince-5',1.5],['pasta-ww',1.5],['salad',1]]],
 ['thu-s','Thu','Snack','Cottage cheese & nuts',[['cottage',2],['nuts',1]]],
 ['thu-d','Thu','Dinner','Salmon & baby potatoes',[['salmon',1.8],['potato',1.5],['salad',1]]],
 // FRIDAY (training)
 ['fri-b','Fri','Breakfast','Protein oats',[['oats',1.5],['whey',1],['banana',1],['peanut-butter',0.6]]],
 ['fri-l','Fri','Lunch','Chicken, rice & veg',[['chicken-breast',1.8],['rice',1.8],['salad',1],['olive-oil-tsp',1]]],
 ['fri-s','Fri','Snack','Post-workout yoghurt & whey',[['greek-yog',2],['whey',1],['berries',0.5]]],
 ['fri-d','Fri','Dinner','Beef burgers & potato wedges',[['beef-mince-5',1.5],['potato',2],['salad',1]]],
 // SATURDAY (rest, flex)
 ['sat-b','Sat','Breakfast','Cooked breakfast',[['egg',3],['bacon',2],['salad',0.5],['bread',1]]],
 ['sat-l','Sat','Lunch','Chicken salad bowl & rice',[['chicken-breast',1.8],['salad',1.5],['rice',1]]],
 ['sat-s','Sat','Snack','Biltong',[['biltong',1.7]]],
 ['sat-d','Sat','Dinner','Braai: steak, salad & corn',[['steak-lean',2],['salad',1.5],['corn',1]]],
 // SUNDAY (rest / prep)
 ['sun-b','Sun','Breakfast','Greek yoghurt bowl',[['greek-yog',2.5],['granola',1],['berries',1],['whey',1]]],
 ['sun-l','Sun','Lunch','Roast chicken & potatoes',[['chicken-breast',1.8],['potato',2],['salad',1]]],
 ['sun-s','Sun','Snack','Boiled eggs & apple',[['egg',2],['apple',1]]],
 ['sun-d','Sun','Dinner','Grilled fish, salad & quinoa',[['hake',1.8],['salad',1.5],['quinoa',1]]],
].map(a=>({id:a[0],day:a[1],slot:a[2],name:a[3],items:a[4].map(i=>({foodId:i[0],servings:i[1]})),custom:false}));

const DAY_FULL={Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday',Sun:'Sunday'};
const DAY_ORDER=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const SLOT_ORDER={Breakfast:0,Lunch:1,Snack:2,Dinner:3};
const SLOT_KEY={Breakfast:'breakfast',Lunch:'lunch',Snack:'snack',Dinner:'dinner'};

/* The training program is DATA (kv key 'program'), seeded once from this default and
   editable in-app (Train → ✎). `type` drives the Coach's progression advice. */
const EX_TYPES=['barbell-lower','barbell-upper','dumbbell','kettlebell','bodyweight','band','other'];

/* ---------- Exercise catalog (v2 foundation — see V2-SPEC.md §2) ----------
   Exercises are entities, not name strings. Each one knows its movement
   pattern, the muscles it trains, the kit it needs, whether its reps are
   PER SIDE, and how long to rest. That single change is what lets the app
   answer "10 per leg or 5?", roll volume up by muscle group, and give
   equipment-correct progression advice — instead of guessing from the name.
   Terse arrays → objects, same style as SEED_FOODS.
   [id, name, pattern, primary, secondary, equipment, opts?]
   opts: {u:1 unilateral · t:1 timed · rest:n override · load:'bw'|'bw+'|'band'|'none' · alias:'a,b'} */
const MUSCLE_REGION={chest:'upper-push',triceps:'upper-push','front-delts':'upper-push','side-delts':'upper-push',
  lats:'upper-pull','upper-back':'upper-pull','rear-delts':'upper-pull',biceps:'upper-pull',forearms:'upper-pull',
  quads:'lower',hamstrings:'lower',glutes:'lower',calves:'lower',core:'core','full-body':'conditioning'};
const PATTERN_REST={squat:150,hinge:150,'horizontal-push':120,'vertical-push':120,'horizontal-pull':90,
  'vertical-pull':90,lunge:75,carry:75,core:60,isolation:60,conditioning:60,mobility:30};
const EX_PATTERNS=['squat','hinge','lunge','horizontal-push','vertical-push','horizontal-pull','vertical-pull','carry','core','isolation','conditioning','mobility'];
const EX_REGIONS=['lower','upper-push','upper-pull','core','conditioning','mobility'];
const ARM_MUSCLES=new Set(['biceps','triceps','forearms','front-delts','side-delts','rear-delts','chest','lats','upper-back']);
const LEG_MUSCLES=new Set(['quads','hamstrings','glutes','calves']);
const EX_SEED=[
 // ---- squat ----
 ['back-squat','Back Squat','squat','quads,glutes','hamstrings,core','barbell,rack',{alias:'squat,barbell squat'}],
 ['front-squat','Front Squat','squat','quads','glutes,core','barbell,rack',{rest:120}],
 ['goblet-squat','Goblet Squat','squat','quads,glutes','core','kettlebell',{rest:90}],
 ['box-squat','Box Squat','squat','quads,glutes','hamstrings','barbell,rack'],
 ['split-squat','Bulgarian Split Squat','lunge','quads,glutes','hamstrings','dumbbell',{u:1,alias:'bulgarian split squat'}],
 ['pistol-squat','Pistol Squat','lunge','quads,glutes','core','none',{u:1,load:'bw+'}],
 ['air-squat','Bodyweight Squat','squat','quads,glutes','core','none',{load:'bw',rest:45}],
 ['leg-press','Leg Press','squat','quads,glutes','hamstrings','machine',{rest:90}],
 ['hack-squat','Hack Squat','squat','quads','glutes','machine',{rest:90}],
 // ---- hinge ----
 ['deadlift','Deadlift','hinge','hamstrings,glutes','upper-back,core','barbell',{alias:'conventional deadlift'}],
 ['rdl','Romanian Deadlift','hinge','hamstrings,glutes','upper-back','barbell',{rest:90,alias:'rdl'}],
 ['sldl','Stiff-leg Deadlift','hinge','hamstrings','glutes','barbell',{rest:90}],
 ['sumo-dl','Sumo Deadlift','hinge','glutes,hamstrings','quads,upper-back','barbell'],
 ['trap-bar-dl','Trap-bar Deadlift','hinge','quads,glutes','hamstrings','barbell'],
 ['sl-rdl','Single-leg RDL','hinge','hamstrings,glutes','core','kettlebell',{u:1,rest:75,alias:'kb single-leg rdl,single leg rdl'}],
 ['hip-thrust','Hip Thrust','hinge','glutes','hamstrings','barbell',{rest:90}],
 ['good-morning','Good Morning','hinge','hamstrings','glutes,core','barbell',{rest:90}],
 ['back-ext','Back Extension','hinge','glutes,hamstrings','core','none',{load:'bw+',rest:60}],
 ['kb-swing','KB Swing','conditioning','glutes,hamstrings','core,full-body','kettlebell',{rest:60,alias:'kb swings,kettlebell swing,swings'}],
 // ---- lunge / single leg ----
 ['reverse-lunge','Reverse Lunge','lunge','quads,glutes','hamstrings','kettlebell',{u:1,alias:'kb goblet reverse lunge,goblet reverse lunge'}],
 ['fwd-lunge','Forward Lunge','lunge','quads,glutes','hamstrings','dumbbell',{u:1}],
 ['walking-lunge','Walking Lunge','lunge','quads,glutes','hamstrings','dumbbell',{u:1}],
 ['step-up','Step-up','lunge','quads,glutes','calves','dumbbell,box',{u:1}],
 ['cossack','Cossack Squat','lunge','quads,glutes','hamstrings','none',{u:1,load:'bw+',rest:60}],
 // ---- horizontal push ----
 ['bench','Bench Press','horizontal-push','chest','triceps,front-delts','barbell,bench',{alias:'bench press,flat bench'}],
 ['incline-bench','Incline Bench Press','horizontal-push','chest,front-delts','triceps','barbell,bench'],
 ['db-bench','DB Bench Press','horizontal-push','chest','triceps,front-delts','dumbbell,bench'],
 ['db-incline','Incline DB Press','horizontal-push','chest,front-delts','triceps','dumbbell,bench'],
 ['pushup','Push-up','horizontal-push','chest','triceps,core','none',{load:'bw+',rest:60,alias:'push-ups,pushups'}],
 ['dip','Weighted Dips','horizontal-push','chest,triceps','front-delts','dip-station',{load:'bw+',rest:90,alias:'dips,dip'}],
 ['db-fly','DB Fly','isolation','chest','front-delts','dumbbell,bench'],
 ['cable-fly','Cable Fly','isolation','chest','front-delts','pulley'],
 ['floor-press','Floor Press','horizontal-push','chest','triceps','dumbbell'],
 // ---- vertical push ----
 ['ohp','Overhead Press','vertical-push','front-delts','triceps,core','barbell',{alias:'overhead press,military press,strict press'}],
 ['db-ohp','DB Shoulder Press','vertical-push','front-delts','triceps','dumbbell'],
 ['push-press','Push Press','vertical-push','front-delts','triceps,quads','barbell'],
 ['kb-press','KB Overhead Press','vertical-push','front-delts','triceps,core','kettlebell',{u:1,rest:90}],
 ['pike-pushup','Pike Push-up','vertical-push','front-delts','triceps','none',{load:'bw',rest:60}],
 ['handstand-pushup','Handstand Push-up','vertical-push','front-delts','triceps','none',{load:'bw'}],
 // ---- vertical pull ----
 ['pullup','Pull-ups','vertical-pull','lats','biceps,upper-back','pull-up-bar',{load:'bw+',rest:90,alias:'pull-up,pullups,weighted pull-ups'}],
 ['chinup','Chin-ups','vertical-pull','lats,biceps','upper-back','pull-up-bar',{load:'bw+',rest:90,alias:'chin-up,chinups'}],
 ['lat-pulldown','Lat Pulldown','vertical-pull','lats','biceps,upper-back','pulley',{rest:75,alias:'pulldown'}],
 ['straight-arm-pd','Straight-arm Pulldown','isolation','lats','core','pulley',{rest:60}],
 ['band-pullup','Band-assisted Pull-up','vertical-pull','lats','biceps','pull-up-bar,band',{load:'band',rest:90}],
 // ---- horizontal pull ----
 ['bb-row','Barbell Row','horizontal-pull','upper-back,lats','biceps,rear-delts','barbell',{rest:90,alias:'barbell bent-over row,bent-over row,bent over row'}],
 ['pendlay-row','Pendlay Row','horizontal-pull','upper-back','lats,biceps','barbell',{rest:90}],
 ['db-row','DB Row','horizontal-pull','lats,upper-back','biceps','dumbbell',{u:1,rest:75,alias:'one-arm row,single-arm row'}],
 ['seated-row','Seated Cable Row','horizontal-pull','upper-back','lats,biceps','pulley',{rest:75}],
 ['inverted-row','Inverted Row','horizontal-pull','upper-back','lats,biceps','barbell,rack',{load:'bw+',rest:60}],
 ['kb-row','KB Row','horizontal-pull','lats,upper-back','biceps','kettlebell',{u:1,rest:75}],
 ['face-pull','Band Face Pull','isolation','rear-delts','upper-back','band',{load:'band',rest:60,alias:'face pull,face pulls'}],
 // ---- shoulders / arms ----
 ['lat-raise','Lateral Raise','isolation','side-delts','front-delts','dumbbell',{alias:'lateral raises,side raise'}],
 ['rear-fly','Rear Delt Fly','isolation','rear-delts','upper-back','dumbbell'],
 ['front-raise','Front Raise','isolation','front-delts','chest','dumbbell'],
 ['shrug','Shrug','isolation','upper-back','forearms','barbell'],
 ['db-curl','DB Curl','isolation','biceps','forearms','dumbbell',{alias:'dumbbell curl,bicep curl,biceps curl'}],
 ['bb-curl','Barbell Curl','isolation','biceps','forearms','barbell'],
 ['hammer-curl','Hammer Curl','isolation','biceps,forearms','','dumbbell'],
 ['preacher-curl','Preacher Curl','isolation','biceps','','dumbbell,bench'],
 ['pushdown','Triceps Pushdown','isolation','triceps','','pulley',{alias:'tricep pushdown,high-pulley triceps pushdown'}],
 ['skullcrusher','Skullcrusher','isolation','triceps','','barbell,bench'],
 ['oh-ext','Overhead Triceps Extension','isolation','triceps','','dumbbell'],
 ['close-grip-bench','Close-grip Bench','horizontal-push','triceps','chest','barbell,bench',{rest:90}],
 // ---- core ----
 ['hanging-leg-raise','Hanging Leg Raise','core','core','forearms','pull-up-bar',{load:'bw+',alias:'leg raises,hanging leg raises'}],
 ['plank','Plank','core','core','','none',{t:1,load:'bw',rest:45}],
 ['side-plank','Side Plank','core','core','','none',{t:1,u:1,load:'bw',rest:45}],
 ['pallof','Band Pallof Press','core','core','','band',{load:'band',rest:45,alias:'pallof press'}],
 ['ab-wheel','Ab Wheel Rollout','core','core','lats','ab-wheel',{load:'bw'}],
 ['hollow-hold','Hollow Hold','core','core','','none',{t:1,load:'bw',rest:45}],
 ['russian-twist','Russian Twist','core','core','','kettlebell'],
 ['dead-bug','Dead Bug','core','core','','none',{load:'bw',rest:45}],
 ['sit-up','Sit-up','core','core','','none',{load:'bw+',rest:45}],
 ['crunch','Crunch','core','core','','none',{load:'bw',rest:45}],
 // ---- carry / conditioning ----
 ['farmers-carry','Farmer’s Carry','carry','forearms,core','upper-back','dumbbell',{t:1}],
 ['suitcase-carry','Suitcase Carry','carry','core,forearms','','kettlebell',{u:1,t:1}],
 ['skipping','Skipping intervals','conditioning','full-body','calves','rope',{t:1,rest:20,alias:'skipping,jump rope,skip'}],
 ['rowing','Rowing Machine','conditioning','full-body','lats','rower',{t:1}],
 ['assault-bike','Air Bike','conditioning','full-body','quads','bike',{t:1}],
 ['burpee','Burpee','conditioning','full-body','chest,quads','none',{load:'bw'}],
 ['mountain-climber','Mountain Climber','conditioning','core','full-body','none',{t:1,load:'bw',rest:45}],
 ['kb-clean','KB Clean','conditioning','full-body','glutes,upper-back','kettlebell',{u:1,rest:90}],
 ['kb-snatch','KB Snatch','conditioning','full-body','glutes,front-delts','kettlebell',{u:1,rest:90}],
 ['turkish-getup','Turkish Get-up','conditioning','full-body','core','kettlebell',{u:1,rest:90}],
 ['thruster','Thruster','conditioning','full-body','quads,front-delts','barbell',{rest:90}],
 ['clean-and-press','Clean & Press','conditioning','full-body','front-delts,quads','barbell',{rest:120}],
 ['calf-raise','Calf Raise','isolation','calves','','none',{load:'bw+',rest:45}],
 ['walk','Zone 2 Walk','conditioning','full-body','','none',{t:1,load:'none',rest:0}],
];
const EXERCISE_SEED_VERSION=2; // v2 (2026-08-18): +~190 entries (app/exercises.js), cues, mobility pattern
const EX_CATALOG=[...EX_SEED,...(typeof EX_SEED_MORE!=='undefined'?EX_SEED_MORE:[])].map(([id,name,pattern,pri,sec,equip,o])=>{
  o=o||{};
  const primary=pri?pri.split(','):[],secondary=sec?sec.split(','):[];
  return{id,name,pattern,primary,secondary,
    equipment:equip?equip.split(','):[],
    unilateral:!!o.u,
    metric:o.t?'time':'reps',
    loadType:o.load||'external',
    defaultRest:o.rest!=null?o.rest:(PATTERN_REST[pattern]||75),
    region:pattern==='mobility'?'mobility':(o.t||pattern==='conditioning')?'conditioning':(MUSCLE_REGION[primary[0]]||'other'),
    aliases:o.alias?o.alias.split(','):[],
    cues:o.c||'',
    custom:false};
});
/* "per leg" / "per arm" / "per side" — the word a unilateral exercise's reps are counted in */
function sideWord(exOrName){
  const c=typeof exOrName==='string'?(typeof exFind==='function'?exFind(exOrName):null):exOrName;
  const m=c&&c.primary&&c.primary[0];
  if(m&&LEG_MUSCLES.has(m))return 'leg';
  if(m&&ARM_MUSCLES.has(m))return 'arm';
  if(!c&&/leg|lunge|squat|rdl|step/i.test(String(exOrName)))return 'leg';
  if(!c&&/curl|press|row|raise|extension|arm/i.test(String(exOrName)))return 'arm';
  return 'side';
}
const DEFAULT_PROGRAM={
 days:{
  A:{title:'Day A — Lower + Push (Mon)',ex:[
    {name:'Back Squat',target:'4 × 5',type:'barbell-lower',rest:150},{name:'Bench Press',target:'3 × 6–8',type:'barbell-upper',rest:120},
    {name:'Romanian Deadlift',target:'3 × 8–10',type:'barbell-lower',rest:90},{name:'Pull-ups',target:'3 × 6–10',type:'bodyweight',rest:90},
    {name:'KB Goblet Reverse Lunge',target:'3 × 10',type:'kettlebell',rest:75,perSide:true},{name:'Hanging Leg Raise',target:'3 × 10–15',type:'bodyweight',rest:60},
    {name:'KB Swings',target:'5 × 20',type:'kettlebell',rest:60}]},
  B:{title:'Day B — Upper + Pull (Wed)',ex:[
    {name:'Deadlift',target:'4 × 4–5',type:'barbell-lower',rest:150},{name:'Overhead Press',target:'3 × 6–8',type:'barbell-upper',rest:120},
    {name:'Barbell Row',target:'3 × 8–10',type:'barbell-upper',rest:90},{name:'Weighted Dips',target:'3 × 8–10',type:'bodyweight',rest:90},
    {name:'Lat Pulldown',target:'3 × 12',type:'other',rest:75},{name:'Lateral Raise',target:'3 × 15',type:'dumbbell',rest:60},
    {name:'Skipping intervals',target:'8 × 40s',type:'other',mode:'time',rest:20}]},
  C:{title:'Day C — Full body (Fri)',ex:[
    {name:'Front Squat',target:'3 × 6–8',type:'barbell-lower',rest:120},{name:'Incline Bench Press',target:'3 × 8–10',type:'barbell-upper',rest:120},
    {name:'Chin-ups',target:'3 × AMRAP',type:'bodyweight',rest:90},{name:'KB Single-leg RDL',target:'3 × 10–12',type:'kettlebell',rest:75,perSide:true},
    {name:'DB Curl',target:'3 × 12–15',type:'dumbbell',rest:60},{name:'Triceps Pushdown',target:'3 × 12–15',type:'other',rest:60},
    {name:'Core circuit',target:'3 rounds',type:'other',rest:45,mode:'rounds',items:[{name:'Plank',secs:40},{name:'Dead Bug',reps:10,perSide:true},{name:'Hanging Knee Raise',reps:10}]}]},
 },
 schedule:{Mon:'A',Wed:'B',Fri:'C'}, // weekday → dayKey
};
for(const d of Object.values(DEFAULT_PROGRAM.days))d.ex.forEach(normalizeTarget); // seed carries structured `tgt` + derived labels
let PROG=DEFAULT_PROGRAM; // the ACTIVE plan record (has .days/.schedule + id/name/source) — set by loadProgram
let PLANS=[];             // every plan in the library (plans store), oldest first


/* ---------- Seeding & migrations (runs on every launch, after restore) ---------- */
/* ---------- init ---------- */
const MEAL_SEED_VERSION=3; // v3: restore seed meals wrongly deleted by pre-LWW sync tombstones (2026-07-29)
async function seedIfEmpty(){
  const f=await idbGetAll('foods');if(!f.length)for(const x of SEED_FOODS)await idbPut('foods',x);
  // Exercise catalog: versioned like meals, and seeded with fromSync=true so the
  // built-ins carry no `up` stamp — only exercises YOU add or edit ever sync.
  const exVer=(await idbGet('kv','exerciseSeedVersion'))?.v||0;
  if(exVer<EXERCISE_SEED_VERSION){
    for(const x of EX_CATALOG){
      const cur=await idbGet('exercises',x.id);
      if(!cur||!cur.custom)await idbPut('exercises',x,true); // never clobber a user's edits
    }
    await idbPut('kv',{k:'exerciseSeedVersion',v:EXERCISE_SEED_VERSION});
  }
  // program & equipment: seed once, then they're user data (edited in-app, synced)
  if(!await idbGet('kv','equipment'))await idbPut('kv',{k:'equipment',v:DEFAULT_EQUIPMENT});
  // Versioned meal seed: refresh the built-in plan meals while keeping your own custom meals.
  const ver=(await idbGet('kv','mealSeedVersion'))?.v||0;
  if(ver<MEAL_SEED_VERSION){
    const existing=await idbGetAll('meals');
    // A device that has never seeded (ver 0) but already holds meals was just restored
    // from the account — adopt the version, don't reseed (that would push tombstones + fresh
    // stamps over every other device's copy).
    if(ver===0&&existing.length){await idbPut('kv',{k:'mealSeedVersion',v:MEAL_SEED_VERSION});}
    else{
      for(const m of existing)if(!m.custom)await idbDel('meals',m.id);
      for(const x of SEED_MEALS)await idbPut('meals',x);
      await idbPut('kv',{k:'mealSeedVersion',v:MEAL_SEED_VERSION});
    }
  }
}
