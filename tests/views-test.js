const {chromium}=require('playwright');const SB='https://mock.supabase.co';
(async()=>{
 const b=await chromium.launch();let fails=0;
 for(const vp of [{width:320,height:700},{width:390,height:844},{width:1280,height:900}]){
  const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];
  p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text());});
  await p.route('**/app/config.js',r=>r.fulfill({contentType:'application/javascript',body:`export const CONFIG={supabaseUrl:'${SB}',supabaseKey:'k'};`}));
  await p.route(SB+'/**',route=>{const req=route.request();const path=new URL(req.url()).pathname;const json=(s,b)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
   if(path.startsWith('/auth/v1/token'))return json(200,{access_token:'a',refresh_token:'r',expires_in:3600,user:{id:'u',email:'a@x.com'}});
   if(path.startsWith('/rest/v1/records'))return json(req.method()==='POST'?201:200,[]);return json(404,{});});
  await p.goto('http://localhost:8099/index.html');await p.waitForSelector('#view-auth:not(.hidden)');
  await p.screenshot({path:`gate-${vp.width}.png`});
  await p.fill('#authEmail','a@x.com');await p.fill('#authPass','password123');await p.click('#authSubmit');await p.waitForSelector('body[data-ready="1"]');
  for(const v of ['coach','today','food','body','photos','train','gym','plan','library']){await p.evaluate(v=>go(v),v);await p.waitForTimeout(250);}
  await p.evaluate(()=>settingsModal());await p.waitForTimeout(200);await p.screenshot({path:`settings-${vp.width}.png`,fullPage:true});await p.evaluate(()=>closeModal());
  const hscroll=await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  console.log(vp.width+'px:',errs.length?'ERRORS '+JSON.stringify(errs):'no errors',hscroll?'| HORIZONTAL SCROLL':'| no h-scroll');
  if(errs.length||hscroll)fails++;await ctx.close();
 }
 await b.close();process.exit(fails?1:0);
})();
