/* ============================ FitTrack app ============================ */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rnd=n=>Math.round(n);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1800);}
const cssVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function buzz(){try{if(navigator.vibrate&&!reducedMotion())navigator.vibrate(10);}catch(e){}}
function countUp(el,to){const from=el.dataset.v!==undefined?+el.dataset.v:to;el.dataset.v=to;
  if(reducedMotion()||from===to){el.textContent=to;return;}
  const t0=performance.now(),dur=400;
  const step=t=>{const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=Math.round(from+(to-from)*e);if(p<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);}
function pad(n){return n<10?'0'+n:''+n;}
function dstr(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function todayStr(){return dstr(new Date());}
function parseD(s){const[y,m,dd]=s.split('-').map(Number);return new Date(y,m-1,dd);}
function niceDate(s){const d=parseD(s),t=todayStr();if(s===t)return 'Today';const y=new Date();y.setDate(y.getDate()-1);if(s===dstr(y))return 'Yesterday';return d.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});}

