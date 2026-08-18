/* ---------- Structured targets (v3 stage 2 — V2-SPEC §3) ----------
   `'3 × 10–12'` is a label, not data. A program exercise now carries `tgt`:
     {sets:4, reps:{min:5,max:5}}          kg × reps        → "4 × 5"
     {sets:3, reps:{min:6,max:8}}                            → "3 × 6–8"
     {sets:3, reps:'amrap'}                                  → "3 × AMRAP"
     {sets:8, secs:40}                     timed intervals  → "8 × 40 s"
     {rounds:3}                            circuit (rounds of `items`) → "3 rounds"
   The display string (`target`) is DERIVED by targetLabel() and kept on the
   record so every v1 consumer (logger header, coach's repTop, history) keeps
   working unchanged. parseTarget() migrates the free-text targets of stored
   programs (in memory — never idbPut from a migration, see loadProgram). */
const AMRAP_RE=/amrap|max|failure/i;
function parseTarget(str,mode){
  const s=String(str||'').trim();if(!s)return null;
  let m;
  if((m=s.match(/^(\d+)\s*rounds?/i)))return{rounds:+m[1]};
  if((m=s.match(/^(\d+)\s*[×x*]\s*(\d+)\s*(?:s|sec|secs|seconds)\b/i)))return{sets:+m[1],secs:+m[2]};
  if((m=s.match(/^(\d+)\s*[×x*]\s*(amrap|max|failure)/i)))return{sets:+m[1],reps:'amrap'};
  if((m=s.match(/^(\d+)\s*[×x*]\s*(\d+)\s*[–—-]\s*(\d+)/)))return{sets:+m[1],reps:{min:+m[2],max:+m[3]}};
  if((m=s.match(/^(\d+)\s*[×x*]\s*(\d+)/)))return mode==='time'?{sets:+m[1],secs:+m[2]}:{sets:+m[1],reps:{min:+m[2],max:+m[2]}};
  if((m=s.match(/^(\d+)\s*(?:s|sec|secs)\b/i)))return{sets:1,secs:+m[1]};
  if(AMRAP_RE.test(s))return{sets:1,reps:'amrap'};
  return null;
}
/* perSide: false | true | 'leg' | 'arm' | 'side' — unilateral work says so IN the label
   ("3 × 10 per leg"), so nobody has to wonder whether it's 10 per leg or 5. */
function targetLabel(t,perSide){
  if(!t)return '';
  const side=perSide?` per ${typeof perSide==='string'?perSide:'side'}`:'';
  if(t.rounds!=null)return `${t.rounds} round${t.rounds===1?'':'s'}`;
  if(t.secs!=null)return `${t.sets||1} × ${t.secs}s${side}`;
  if(t.reps==='amrap')return `${t.sets||1} × AMRAP${side}`;
  if(t.reps&&t.reps.min!=null){const{min,max}=t.reps;return `${t.sets||1} × ${max&&max!==min?`${min}–${max}`:min}${side}`;}
  return t.sets?`${t.sets} sets${side}`:'';
}
/* label for a program/session exercise, whatever generation of record it is */
function exTargetText(e){
  if(!e)return '';
  if(e.tgt)return targetLabel(e.tgt,e.perSide?sideWord(e.name):false);
  const t=String(e.target||'');
  return e.perSide&&!/per (side|leg|arm)/i.test(t)?`${t} per ${sideWord(e.name)}`:t;
}
function targetMode(t,fallback){ // which logger layout a target implies
  if(!t)return fallback||'reps';
  if(t.rounds!=null)return 'rounds';
  if(t.secs!=null)return 'time';
  return 'reps';
}
/* Circuit items: [{name, reps?, secs?, perSide?}] → "Plank 40 s · Dead Bug 10/side · Hanging Knee Raise 10" */
function itemsLabel(items){
  return (items||[]).map(i=>`${i.name}${i.secs?` ${i.secs} s`:i.reps?` ${i.reps}${i.perSide?'/side':''}`:''}`).join(' · ');
}
/* One item per line: "Plank 40s" · "Dead bug 10 per side" · "Hanging knee raise 10" */
function parseItems(text){
  return String(text||'').split(/\n|,|·/).map(l=>l.trim()).filter(Boolean).map(l=>{
    let m;const it={name:l};
    if((m=l.match(/^(.*?)\s+(\d+)\s*(?:s|sec|secs)\b(.*)$/i))){it.name=m[1].trim();it.secs=+m[2];}
    else if((m=l.match(/^(.*?)\s+(\d+)(?:\s*(?:reps?))?\s*(\/\s*side|per\s*(?:side|leg|arm)|each\s*side)?\s*$/i))){it.name=m[1].trim();it.reps=+m[2];if(m[3])it.perSide=true;}
    if(/per\s*(side|leg|arm)|\/\s*side/i.test(l))it.perSide=true;
    return it;});
}
/* Bring a program exercise up to date IN MEMORY: derive tgt from the legacy string,
   keep the label in sync, and give known circuits their items. */
const DEFAULT_CIRCUIT_ITEMS=[{name:'Plank',secs:40},{name:'Dead Bug',reps:10,perSide:true},{name:'Hanging Knee Raise',reps:10}];
function normalizeTarget(e){
  if(!e.tgt){const t=parseTarget(e.target,e.mode);if(t)e.tgt=t;}
  if(e.perSide==null&&/per (side|leg|arm)|\/\s*(side|leg|arm)/i.test(e.target||''))e.perSide=true;
  if(e.perSide==null&&e.mode!=='rounds'&&typeof isUnilateral==='function')e.perSide=isUnilateral(e.name);
  if(/circuit/i.test(e.name||'')&&!e.items){e.items=/core/i.test(e.name)?DEFAULT_CIRCUIT_ITEMS.map(i=>({...i})):[];if(!e.tgt)e.tgt={rounds:3};}
  if(e.tgt){
    if(e.tgt.rounds!=null)e.mode='rounds';
    else if(e.tgt.secs!=null)e.mode='time';
    else if(!e.mode||e.mode==='rounds')e.mode='reps';
    e.target=targetLabel(e.tgt,e.perSide?sideWord(e.name):false);
  }
  return e;
}
