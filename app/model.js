/* ---------- State ---------- */
let curDate=todayStr();
let foodSeg='meals'; // Meals first — the plan is the primary thing, the library is reference
var curView='today';
let chartRange=90; // weight chart window in days; 0 = all

/* ---------- Food maths ---------- */
function foodMap(list){const m={};for(const f of list)m[f.id]=f;return m;}
function scale(food,servings){return{kcal:food.kcal*servings,protein:food.protein*servings,carbs:food.carbs*servings,fat:food.fat*servings};}
/* Weight/volume servings ("100 g", "250 ml") are shown as a plain amount — "180 g",
   not "1.8 × 100 g". Anchored so "1 scoop (30 g)" stays a count. */
function servingUnit(serving){const m=String(serving||'').match(/^(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
  return m?{base:parseFloat(m[1]),unit:m[2].toLowerCase()}:null;}
function qtyLabel(serving,servings){const u=servingUnit(serving);
  const n=x=>(Math.round(x*10)/10+'').replace(/\.0$/,'');
  return u?`${n(servings*u.base)} ${u.unit}`:`${n(servings)} × ${serving||''}`;}
async function mealMacros(meal,fmap){fmap=fmap||foodMap(await idbGetAll('foods'));let t={kcal:0,protein:0,carbs:0,fat:0};if(!meal||!meal.items)return t;for(const it of meal.items){const f=fmap[it.foodId];if(!f)continue;const s=scale(f,it.servings);for(const k in t)t[k]+=s[k];}return t;}

