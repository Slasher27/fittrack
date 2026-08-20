const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 await p.addInitScript(()=>{window.__wl=[];const rel=[];Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async t=>{window.__wl.push('req:'+t);return{release:async()=>{window.__wl.push('rel');},addEventListener(){}};}}});});
 await p.goto('http://localhost:8099/index.html');await p.waitForSelector('#view-auth:not(.hidden)');await p.click('#authSkip');await p.waitForSelector('body[data-ready="1"]');
 await p.evaluate(()=>go('train'));await p.waitForTimeout(300);
 await p.click('#view-train [data-startday]',{force:true});await p.waitForTimeout(500);
 const a=await p.evaluate(()=>window.__wl.slice());
 await p.evaluate(()=>go('train'));await p.waitForTimeout(200);
 const c=await p.evaluate(()=>window.__wl.slice());
 console.log('after open:',a,'after close:',c,'errors:',errs);
 const ok=a.includes('req:screen')&&c.includes('rel')&&!errs.length;console.log(ok?'PASS':'FAIL');await b.close();process.exit(ok?0:1);
})();
