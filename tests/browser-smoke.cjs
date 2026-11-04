// Run with node tests/browser-smoke.cjs (Chrome must be installed).
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const steps=require('../assets/core/steps.js');
const root=path.resolve(__dirname,'..');
// Screenshots go to screens/ unless MIRROR21_SCREENS names another folder (so a check run leaves the repo as it was).
const screens=process.env.MIRROR21_SCREENS?path.resolve(process.env.MIRROR21_SCREENS):path.join(root,'screens');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await fs.mkdir(screens,{recursive:true});
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror21-browser-'));
 // Simulates Netlify: .html is dropped from paths and from anchors in served HTML.
 const server=http.createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.endsWith('/'))pathname+='index.html';else if(!path.extname(pathname))pathname+='.html';const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.webmanifest':'application/manifest+json'};res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');let contents=await fs.readFile(file);if(path.extname(file)==='.html')contents=Buffer.from(contents.toString().replace(/href="([^"]+)\.html([^"]*)"/g,'href="$1$2"'));if(/\.mp4$/.test(file)&&req.headers.range){const match=/bytes=(\d+)-(\d*)/.exec(req.headers.range);if(match){const first=Number(match[1]),last=match[2]?Math.min(Number(match[2]),contents.length-1):contents.length-1;res.writeHead(206,{'Content-Range':'bytes '+first+'-'+last+'/'+contents.length,'Accept-Ranges':'bytes','Content-Length':last-first+1});res.end(contents.subarray(first,last+1));return;}}res.setHeader('Accept-Ranges','bytes');res.end(contents);}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--in-process-gpu','--no-first-run','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let socket;
 try{
  let port;for(let i=0;i<100;i++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{}await wait(100);} assert.ok(port,'Browser started');
  const targets=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
  let id=0;const pending=new Map();
  socket.addEventListener('message',event=>{const result=JSON.parse(event.data);if(result.id){const p=pending.get(result.id);pending.delete(result.id);result.error?p.reject(Error(JSON.stringify(result.error))):p.resolve(result.result);}});
  const command=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>reject(Error('CDP timeout '+method)),15000);pending.set(n,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await command('Page.enable');await command('Runtime.enable');
  // What the unlock moment was doing when My Path was last ready (null: nothing to show).
  let lastUnlock=null;
  const errors=[];socket.addEventListener('message',event=>{const r=JSON.parse(event.data);if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails);});
  // Supabase, simulated (no real email is sent): buyer@example.com has an account, anyone else hasn't; the code is
  // 123456; Stripe's session cs_test_paid was paid with buyer@example.com.
  const SIGNED_IN={access_token:'test',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+365*86400,refresh_token:'test',user:{id:'00000000-0000-4000-8000-000000000000',aud:'authenticated',role:'authenticated',email:'buyer@example.com'}};
  const supabaseCalls=[];
  const fakeSupabase=({method,url,postData})=>{
   const {pathname,searchParams}=new URL(url),body=postData?JSON.parse(postData):{};
   if(method==='OPTIONS')return [204,null];
   if(pathname==='/auth/v1/otp')return body.email==='buyer@example.com'&&body.create_user===false?[200,{}]:[422,{code:422,error_code:'otp_disabled',msg:'Signups not allowed for otp'}];
   if(pathname==='/auth/v1/verify')return body.token==='123456'&&body.type==='email'?[200,SIGNED_IN]:[403,{code:403,error_code:'otp_expired',msg:'Token has expired or is invalid'}];
   if(pathname==='/auth/v1/logout')return [204,null];
   if(pathname==='/functions/v1/checkout-email')return searchParams.get('session_id')==='cs_test_paid'?[200,{email:'buyer@example.com'}]:[404,{message:'Not paid'}];
   return [404,{message:'Not simulated'}];
  };
  socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method!=='Fetch.requestPaused')return;
   const [status,body]=fakeSupabase(m.params.request);supabaseCalls.push(m.params.request.method+' '+new URL(m.params.request.url).pathname);
   const headers=[['Content-Type','application/json'],['Access-Control-Allow-Origin','*'],['Access-Control-Allow-Methods','GET, POST, OPTIONS'],['Access-Control-Allow-Headers','apikey, authorization, content-type, x-client-info, x-supabase-api-version']].map(([name,value])=>({name,value}));
   command('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:status,responseHeaders:headers,body:Buffer.from(body?JSON.stringify(body):'').toString('base64')}).catch(()=>{});});
  await command('Fetch.enable',{patterns:[{urlPattern:'https://xcabmwcfvzgavhsjsmxu.supabase.co/*'}]});
  const screenNow=()=>evaluate('document.documentElement.dataset.screen');
  // On My Path the unlock moment may be waiting to play: a tap skips it, as a user in a hurry would.
  const ready=async expected=>{for(let i=0;i<100;i++){if(await evaluate('location.pathname.replace(/\\.html$/, "") === '+JSON.stringify('/html/'+expected.replace('.html',''))+' && document.documentElement?.dataset.mirrorReady === "true"')){await evaluate('document.fonts.ready.then(()=>true)');lastUnlock=await evaluate('(()=>{const u=document.documentElement.dataset.unlock;if(u==="waiting"||u==="playing")(document.body.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true})),document.body.dispatchEvent(new MouseEvent("click",{bubbles:true})));return u||null})()');await wait(700);return;}await wait(50);}throw Error('Page not ready: '+expected+' (at '+await evaluate('location.href')+') '+JSON.stringify(errors.map(e=>e.exception?.description||e.text)));};
  const go=async name=>{console.log('Opening '+name);await command('Page.navigate',{url:base+'/html/'+name.replace('.html','')});await ready(name.split('?')[0]);};
  const click=async selector=>{await evaluate('document.querySelector('+JSON.stringify(selector)+').click()');};
  const stored=()=>evaluate('JSON.parse(localStorage.getItem("mirror21-progress"))');
  const barValue=()=>evaluate('Number(document.querySelector("#stepBar").getAttribute("aria-valuenow"))');
  const barParts=()=>evaluate('document.querySelectorAll("#stepBar > .bar-part").length');
  const barLabels=()=>evaluate('Array.from(document.querySelectorAll("#stepBar .bar-label"),l=>l.textContent+":"+(l.classList.contains("is-done")?"done":l.classList.contains("is-current")?"current":""))');
  const watchState=()=>evaluate('document.querySelector("#watch").dataset.state');
  const text=selector=>evaluate('document.querySelector('+JSON.stringify(selector)+').textContent.replace(/\\u00a0/g," ").replace(/\\s+/g," ").trim()');
  const shows=selector=>evaluate('(()=>{const s=getComputedStyle(document.querySelector('+JSON.stringify(selector)+'));return s.opacity!=="0"&&s.pointerEvents!=="none"})()');
  const arriving=()=>evaluate('document.documentElement.classList.contains("intro")').catch(()=>true);
  // From the map's card into Watch: the card grows, Watch arrives in sequence, play is locked until it ends.
  const openWatchFromCard=async()=>{
   await click('.day-popover-start');
   assert.equal(await evaluate('document.querySelectorAll(".day-card-cover").length'),1,'The card grows to fill the screen');
   await until(()=>evaluate('location.pathname.includes("step-watch")&&document.documentElement.dataset.mirrorReady==="true"').catch(()=>false),'Watch');
   assert.equal(await arriving(),true,'Arrival sequence when opened from the map');
   const before=await watchState();await click('#play');await click('#again');
   assert.equal(await watchState(),before,'Nothing can be tapped during the sequence');
   await until(async()=>!(await arriving()),'the arrival sequence to end');
   await ready('step-watch.html');
  };
  const until=async(check,what)=>{for(let n=0;n<150;n++){if(await check())return;await wait(100);}throw Error('Timed out waiting for '+what);};
  const noOverflow=async()=>assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,'No horizontal page scroll');
  const titleFits=()=>evaluate('(()=>{const t=document.querySelector(".title"),r=document.createRange();r.selectNodeContents(t);const rects=r.getClientRects();return {lines:new Set(Array.from(rects,x=>Math.round(x.top))).size,width:r.getBoundingClientRect().width,available:t.clientWidth,size:parseFloat(getComputedStyle(t).fontSize),text:t.textContent}})()');
  const shot=async(name,full)=>{
   const options={format:'png'};
   if(full){const h=await evaluate('document.documentElement.scrollHeight');options.captureBeyondViewport=true;options.clip={x:0,y:0,width:await evaluate('innerWidth'),height:h,scale:1};}
   const s=await command('Page.captureScreenshot',options);await fs.writeFile(path.join(screens,name),Buffer.from(s.data,'base64'));
  };
  const stage=async()=>(await stored()).steps[1].stage;
  const holdFor=async ms=>{
   // A long promise can push the button below the fold: bring it into view first, as the user would.
   const r=await evaluate('(()=>{document.querySelector("#hold").scrollIntoView({block:"center"});const b=document.querySelector("#hold").getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}})()');
   await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x,y:r.y});
   await command('Input.dispatchMouseEvent',{type:'mousePressed',x:r.x,y:r.y,button:'left',clickCount:1});
   await wait(ms);
   await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x,y:r.y,button:'left',clickCount:1});
  };
  const typeInto=async(selector,text)=>evaluate('(()=>{const b=document.querySelector('+JSON.stringify(selector)+');b.value='+JSON.stringify(text)+';b.dispatchEvent(new Event("input",{bubbles:true}));})()');
  const pressEnter=async selector=>{await evaluate('document.querySelector('+JSON.stringify(selector)+').focus()');await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait(150);};

  for(const [label,width,height] of [['phone',390,844],['iPad',820,1180],['desktop',1440,900]]){
   const phone=label==='phone';
   await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:phone?2:1,mobile:label!=='desktop'});
   await command('Page.navigate',{url:base+'/'});await ready('00-start.html');await evaluate('localStorage.clear()');
   assert.equal(await evaluate('document.fonts.check("italic 700 22px Magistral")'),true);
   // Opens as a full-screen app from the Home Screen: manifest, Apple tags and icon on every page.
   const app=await evaluate('(async()=>{const m=document.querySelector("link[rel=manifest]"),i=document.querySelector("link[rel=apple-touch-icon]");const manifest=await (await fetch(m.href)).json();const icon=await fetch(i.href);return {display:manifest.display,name:manifest.name,capable:document.querySelector("meta[name=apple-mobile-web-app-capable]")?.content,bar:document.querySelector("meta[name=apple-mobile-web-app-status-bar-style]")?.content,title:document.querySelector("meta[name=apple-mobile-web-app-title]")?.content,icon:icon.ok}})()');
   assert.deepEqual(app,{display:'standalone',name:'Mirror 21',capable:'yes',bar:'default',title:'Mirror 21',icon:true});
   // The app opens on the first page (the Offer is hidden): MIRROR 21 in the middle, BUY MIRROR 21 (black) at the
   // bottom, and Already bought? Sign in.
   assert.equal(await text('.start .wordmark'),'MIRROR 21');
   assert.equal(await evaluate('document.querySelector("#buy").href'),'https://buy.stripe.com/test_14A9AT4EIanw91b5cK8EM01');
   assert.deepEqual(await evaluate('[document.querySelector("#buy").textContent,getComputedStyle(document.querySelector("#buy")).backgroundColor,getComputedStyle(document.querySelector("#buy")).color]'),['BUY MIRROR 21','rgb(17, 17, 17)','rgb(255, 255, 255)']);
   const markBox=await evaluate('(()=>{const m=document.querySelector(".start .wordmark").getBoundingClientRect(),b=document.querySelector("#buy").getBoundingClientRect();return {middle:Math.abs((m.left+m.right)/2-innerWidth/2),buyBottom:innerHeight-b.bottom}})()');
   assert.ok(markBox.middle<2&&markBox.buyBottom<40,'MIRROR 21 centred, the button at the bottom: '+JSON.stringify(markBox));
   if(phone)await shot('start-mobile.png');
   await click('.start .link');await ready('02-sign-in.html');
   // Sign in: MIRROR 21 at the top left, the email first.
   assert.equal(await screenNow(),'emailScreen');
   assert.equal(await evaluate('document.querySelector("#emailScreen .wordmark").textContent'),'MIRROR 21');
   assert.equal(await text('#emailScreen h1'),'SIGN IN NOW');
   assert.equal(await text('#send'),'SEND MY CODE');
   if(phone)await shot('sign-in-mobile.png');
   // No one signed in: every course page sends you to Sign in, remembering where you were going, and saves nothing.
   for(const [page,next] of [['04-map-start','04-map-start.html'],['step-watch?step=3','step-watch.html?step=3'],['18-my-mirror','18-my-mirror.html'],['final-check','final-check.html']]){
    await command('Page.navigate',{url:base+'/html/'+page});await ready('02-sign-in.html');
    assert.equal(await evaluate('new URLSearchParams(location.search).get("next")'),next);
   }
   assert.equal(await evaluate('localStorage.getItem("mirror21-progress")'),null,'Nothing is saved before signing in');
   // Not an email: asked again, nothing sent.
   supabaseCalls.length=0;
   await click('#send');
   assert.equal(await text('#emailMessage'),'Enter the email you used to buy Mirror 21.');
   // An email with no purchase: no code is sent; the wordmark, big, and BUY MIRROR 21.
   await typeInto('#email',' Nobody@Example.com ');await click('#send');
   await until(async()=>await screenNow()==='noPurchase','No purchase');
   assert.equal(await text('#unknownEmail'),'nobody@example.com');
   assert.equal(await evaluate('document.querySelector("#buy").href'),'https://buy.stripe.com/test_14A9AT4EIanw91b5cK8EM01');
   assert.deepEqual(await evaluate('[document.querySelector("#buy").textContent,getComputedStyle(document.querySelector("#buy")).backgroundColor]'),['BUY MIRROR 21','rgb(17, 17, 17)'],'The same black button as the first page');
   if(phone)await shot('sign-in-no-purchase-mobile.png');
   await click('#noPurchase [data-change-email]');
   assert.deepEqual([await screenNow(),await evaluate('document.querySelector("#email").value')],['emailScreen','Nobody@Example.com'],'Wrong email? Change it keeps what was typed');
   // After paying: Stripe's session fills in the email, so the buyer only taps SEND MY CODE.
   await command('Page.navigate',{url:base+'/html/02-sign-in?session_id=cs_test_paid&next=18-my-mirror.html'});await ready('02-sign-in.html');
   await until(async()=>await evaluate('document.querySelector("#email").value')==='buyer@example.com','the email from Stripe');
   await click('#send');
   await until(async()=>await screenNow()==='codeScreen','the code screen');
   assert.equal(await text('#sentTo'),'buyer@example.com');
   assert.match(await text('#resend'),/^Resend code in (1:00|0:5\d)$/);
   assert.equal(await evaluate('document.querySelector("#resend").disabled'),true,'Resend waits a minute');
   assert.equal(await evaluate('document.querySelectorAll("#code .digit").length'),6);
   assert.equal(await evaluate('document.activeElement.id'),'codeInput');
   await typeInto('#codeInput','48');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("#code .digit"),d=>d.textContent+(d.classList.contains("is-active")?"|":""))'),['4','8','|','','','']);
   if(phone)await shot('sign-in-code-mobile.png');
   // A wrong code: cleared, with a message; the boxes stay.
   await typeInto('#codeInput','111111');
   await until(async()=>!(await evaluate('document.querySelector("#codeMessage").hidden')),'the wrong-code message');
   assert.equal(await text('#codeMessage'),'That code isn’t right. Check it and try again.');
   assert.equal(await evaluate('document.querySelector("#codeInput").value'),'');
   // Pasting the whole code (letters and spaces dropped) signs in by itself and opens the page you were going to.
   await typeInto('#codeInput','123 456');await ready('18-my-mirror.html');
   assert.equal(await evaluate('MirrorAuth.signedIn()'),true);
   assert.deepEqual(supabaseCalls.filter(c=>!c.startsWith('OPTIONS')),['POST /auth/v1/otp','GET /functions/v1/checkout-email','POST /auth/v1/otp','POST /auth/v1/verify','POST /auth/v1/verify']);
   // Signed in on this device: the app opens on My Path, and the first page and Sign in go straight on.
   await command('Page.navigate',{url:base+'/'});await ready('04-map-start.html');
   for(const page of ['00-start','02-sign-in']){await command('Page.navigate',{url:base+'/html/'+page});await ready('04-map-start.html');}
   // The rest of the test stays signed in, even when it clears storage.
   const keepSignedIn=(await command('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.getItem("sb-mirror21-auth")||localStorage.setItem("sb-mirror21-auth",'+JSON.stringify(JSON.stringify(SIGNED_IN))+')}catch{}'})).identifier;
   await evaluate('localStorage.clear()');

   // Step 00 · Welcome: watch-only, no bar, never starts an attempt.
   await go('step-watch.html?step=0');
   assert.equal(await evaluate('document.querySelector("#stepTitle").textContent'),'WELCOME TO MIRROR 21.');
   assert.equal(await evaluate('document.querySelector("#stepBar").hidden'),true);
   assert.equal(await watchState(),'start');
   assert.equal(await text('#nextLabel'),'MY PATH');
   assert.equal(await evaluate('new URL(document.querySelector("#next").href).pathname.replace(/\\.html$/,"")'),'/html/04-map-start');
   assert.equal(await text('#stepLabel'),'STEP 00 OF 21');
   assert.equal(await text('#hintText'),'BEST WITH SOUND · 0:37');
   assert.equal(await evaluate('localStorage.getItem("mirror21-progress")'),null,'Welcome must not create an attempt or start its clock');
   if(phone){
    await shot('welcome-watch-mobile.png');
    // Report every title that needs to shrink below the base size to stay on one line at this width.
    const shrunk=await evaluate('(()=>{const t=document.querySelector("#stepTitle"),out=[];for(let s=1;s<=21;s++){const probe=t.cloneNode();probe.removeAttribute("id");probe.style.fontSize="";probe.textContent=MirrorSteps.headline(s);t.after(probe);const r=document.createRange();r.selectNodeContents(probe);const w=r.getBoundingClientRect().width,size=parseFloat(getComputedStyle(probe).fontSize);if(w>probe.clientWidth)out.push(String(s).padStart(2,"0")+" "+probe.textContent+" "+(Math.floor(size*probe.clientWidth/w*.985*10)/10)+"px");probe.remove();}return out;})()');
    console.log('phone: titles shrunk to fit one line:\n  '+shrunk.join('\n  '));
   }

   // Map: 21 steps, Step 01 current with its title on the card.
   await go('04-map-start.html');
   assert.equal(await evaluate('document.querySelectorAll(".progress-row[data-day] .progress-step").length'),21);
   assert.deepEqual(await evaluate('[document.querySelector(".results-row .welcome-label"),document.querySelector(".results-tile").tagName,document.querySelector(".results-tile").classList.contains("is-open"),document.querySelectorAll(".results-tile svg").length]'),[null,'BUTTON',false,1],'My Results waits, locked, below Step 21: a flag, no label');
   assert.equal(await evaluate('document.querySelectorAll(".block-spot .block-tile").length'),3,'One block tile per block');
   assert.equal(await evaluate('document.querySelectorAll(".journey-segment").length'),24,'20 between steps, 3 out to the block tiles, 1 down to My Results');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".journey-word"),e=>e.textContent.replace(/\\s+/g," ").trim())'),['SEE IT','OWN IT','CHANGE IT']);
   assert.equal(await evaluate('document.querySelectorAll(".app-frame > div[style*=\\"top: 59px\\"] > div p")[1].textContent'),'STEP 01 OF 21');
   // START sits on 00 until Welcome is done.
   assert.equal(await evaluate('document.querySelector(".welcome-row .active-bubble")?.textContent'),'START');
   assert.equal(await evaluate('document.querySelector(".progress-row[data-day=\\"1\\"] .active-bubble")'),null);
   // 00 keeps its gold number on hover.
   const w=await evaluate('(()=>{const r=document.querySelector(".welcome-step").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()');
   await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:w.x,y:w.y});await wait(150);
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".welcome-step")).color'),'rgb(224, 184, 76)','00 stays gold on hover');
   const bubbleBox=await evaluate('(()=>{const b=document.querySelector(".welcome-row .active-bubble").getBoundingClientRect(),h=document.querySelector(".app-frame > div[style*=\\"top: 59px\\"]").getBoundingClientRect();return {bubbleTop:b.top,headerBottom:h.bottom}})()');
   assert.ok(bubbleBox.bubbleTop>bubbleBox.headerBottom,'START on 00 is visible below the header card: '+JSON.stringify(bubbleBox));
   if(phone)await shot('map-start-on-welcome-mobile.png');
   // Welcome already watched opens at Finish; its MY PATH button returns to the map.
   await evaluate('localStorage.setItem("mirror21-watched-0","true")');
   await go('step-watch.html?step=0');assert.equal(await watchState(),'finish');
   await click('#next');await ready('04-map-start.html');
   assert.equal(await evaluate('document.querySelector(".welcome-row .active-bubble")'),null,'Leaving Welcome moves START on');
   assert.equal(await evaluate('document.querySelector(".progress-row[data-day=\\"1\\"] .active-bubble").textContent'),'START');
   await click('.welcome-step');assert.equal(await evaluate('document.querySelector(".day-popover h2").textContent'),'Welcome to Mirror 21');
   assert.equal(await evaluate('document.querySelector(".welcome-card-stage").textContent'),'WATCH');
   await click('.progress-step.current');
   assert.equal(await evaluate('document.querySelector(".day-popover h2").textContent'),'Know Where You Are Going');
   assert.equal(await evaluate('document.querySelector(".day-popover-start .action-label").textContent'),'START STEP');
   assert.equal(await evaluate('new URL(document.querySelector(".day-popover-start").href).pathname+new URL(document.querySelector(".day-popover-start").href).search'),'/html/step-watch.html?step=1');
   if(phone){await shot('day-card-mobile.png');}

   // Step 01 · Watch.
   await openWatchFromCard();
   assert.equal(await evaluate('document.querySelector("#stepTitle").textContent'),'KNOW WHERE YOU ARE GOING.');
   let fit=await titleFits();assert.equal(fit.lines,1);assert.ok(fit.width<=fit.available+1,JSON.stringify(fit));
   // Start: full-screen still, centred play, BEST WITH SOUND, no Learn button.
   assert.equal(await watchState(),'start');
   assert.equal(await text('#stepLabel'),'STEP 01 OF 21');
   assert.equal(await text('#hintText'),'BEST WITH SOUND · 1:45');
   assert.equal(await barParts(),3,'Step 01: Watch · Learn · Act');
   assert.deepEqual(await barLabels(),['WATCH:current','LEARN:','ACT:'],'Labels under the bar');
   assert.equal(await barValue(),0);
   assert.equal(await shows('.end'),false,'No Learn button before Finish');
   assert.equal(await evaluate('document.querySelector("#player").hasAttribute("playsinline")'),true,'Plays in the page, never Apple’s full-screen player');
   assert.equal(await evaluate('document.querySelector("#watch").classList.contains("placeholder")'),false,'Step 01 has its portrait video');
   assert.equal(await evaluate('new URL(document.querySelector("#player").currentSrc||document.querySelector("#player").src).pathname'),'/Audio-Video/Step01-Watch.mp4');
   const layout=await evaluate('(()=>{const s=document.querySelector("#watch").getBoundingClientRect(),p=document.querySelector("#play").getBoundingClientRect();return {screen:{w:s.width,h:s.height,left:s.left},vw:innerWidth,vh:innerHeight,play:{w:p.width,cx:p.left+p.width/2-s.left,cy:p.top+p.height/2-s.top}}})()');
   assert.equal(layout.play.w,80);
   assert.ok(Math.abs(layout.play.cx-layout.screen.w/2)<1&&Math.abs(layout.play.cy-layout.screen.h/2)<1,'Play is dead centre: '+JSON.stringify(layout));
   if(phone)assert.ok(layout.screen.w===layout.vw&&layout.screen.h===layout.vh,'Full screen on a phone: '+JSON.stringify(layout));
   await noOverflow();
   if(phone)await shot('step-watch-mobile.png');
   // The bottom fade: always on, 30% of the screen, solid black at the bottom, over the video and under the controls.
   const cover=()=>evaluate('(()=>{const c=document.querySelector(".fade.cover"),s=document.querySelector("#watch").getBoundingClientRect(),r=c.getBoundingClientRect(),cs=getComputedStyle(c);return {share:Math.round(r.height/s.height*100),bottom:Math.round(s.bottom-r.bottom),opacity:cs.opacity,belowControls:[".play",".scrub",".end",".hint"].every(q=>c.compareDocumentPosition(document.querySelector(q))&Node.DOCUMENT_POSITION_FOLLOWING),aboveVideo:!!(document.querySelector("#player").compareDocumentPosition(c)&Node.DOCUMENT_POSITION_FOLLOWING)}})()');
   const coverAtStart=await cover();
   assert.deepEqual(coverAtStart,{share:30,bottom:0,opacity:'1',belowControls:true,aboveVideo:true},'Start: '+JSON.stringify(coverAtStart));
   // Mid: the title, meta line and bar fade after 2 seconds; tapping anywhere pauses.
   await click('#play');assert.equal(await watchState(),'playing');
   await wait(2600);
   assert.equal(await evaluate('document.querySelector("#watch").classList.contains("immersed")'),true);
   assert.equal(await evaluate('document.querySelector("#player").paused'),false,'The video plays in the page');
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".soon")).opacity'),'0','No COMING SOON with a real video');assert.equal(await shows('.end'),false,'No Learn button during playback');
   assert.equal((await cover()).opacity,'1','The fade stays on while playing');
   if(phone)await shot('step-watch-playing-mobile.png');
   await click('#watch');assert.equal(await watchState(),'paused');
   assert.equal(await evaluate('document.querySelector("#watch").classList.contains("immersed")'),false,'Pausing brings the title back');
   assert.equal(await shows('.end'),false);
   if(phone)await shot('step-watch-paused-mobile.png');
   // The timeline drags: press on it, move, let go. Paused, it shows its handle and the times.
   const drag=async(from,to,hold)=>{
    const r=await evaluate('(()=>{const b=document.querySelector(".scrub .line").getBoundingClientRect(),s=document.querySelector(".scrub").getBoundingClientRect();return {left:b.left,width:b.width,y:s.top+s.height/2}})()');
    const x=p=>r.left+r.width*p;
    await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:x(from),y:r.y});
    await command('Input.dispatchMouseEvent',{type:'mousePressed',x:x(from),y:r.y,button:'left',clickCount:1});
    for(const p of [from+(to-from)/2,to])await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:x(p),y:r.y,button:'left',buttons:1});
    if(hold)await hold();
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:x(to),y:r.y,button:'left',clickCount:1});await wait(300);
   };
   await wait(300);assert.equal(await evaluate('getComputedStyle(document.querySelector(".knob")).opacity'),'1','Paused: the handle shows');
   await drag(0.1,0.5,async()=>assert.equal(await evaluate('document.querySelector("#watch").classList.contains("scrubbing")'),true));
   const dur=await evaluate('document.querySelector("#player").duration');
   assert.ok(Math.abs(await evaluate('document.querySelector("#player").currentTime')-dur*0.5)<1.5,'Dragging moves the video');
   assert.equal(await watchState(),'paused','Still paused after dragging');
   assert.equal(await text('#scrubAt'),'0:52');assert.equal(await text('#scrubTotal'),'1:45');
   if(phone)await shot('step-watch-scrub-mobile.png');
   await drag(0.5,0.2);
   assert.ok(Math.abs(await evaluate('document.querySelector("#player").currentTime')-dur*0.2)<1.5,'…and back');
   const seen=(await stored()).steps[1].watch;assert.ok(seen>0.01&&seen<0.9,'Watched share saved: '+seen);
   // Leaving mid-video and coming back offers to resume where it stopped.
   await go('step-watch.html?step=1');
   assert.equal(await watchState(),'start');
   assert.equal(await arriving(),false,'The arrival sequence only plays from the map');
   assert.match(await text('#hintText'),/^RESUME · 0:\d\d$/);
   if(phone)await shot('step-watch-resume-mobile.png');
   // Finish at the end (90% watched): WATCHED ✓, Watch fills gold, the Learn button rises.
   await click('#play');await wait(1000);
   assert.ok(await evaluate('document.querySelector("#player").currentTime')>=seen*105-1,'Resumes where it stopped');
   // Dragging while playing: to near the end, which counts as watched; playback carries on and ends.
   await drag(0.3,0.985);
   assert.equal(await watchState(),'playing','Playback carries on after dragging');
   await until(async()=>await watchState()==='finish','Finish');await wait(700);
   assert.equal(await text('.meta'),'STEP 01 OF 21 · WATCHED ✓');
   assert.equal((await cover()).opacity,'1','…and at Finish');
   const scrubGap=await evaluate('(()=>{const s=document.querySelector(".scrub"),w=document.querySelector("#watch");return Math.round(w.getBoundingClientRect().bottom-s.getBoundingClientRect().bottom)-parseFloat(getComputedStyle(w).getPropertyValue("--sb")||0)})()');
   assert.ok(scrubGap>=0,'The timeline sits above the home indicator');
   assert.equal(await text('#next'),'LEARN');
   // Shaped like YOUR TURN on Learn, in reverse: a white pill, black text, the arrow right after the word.
   const learnButton=await evaluate('(()=>{const b=document.querySelector("#next"),s=getComputedStyle(b),w=document.querySelector("#nextLabel").getBoundingClientRect(),a=b.querySelector("svg").getBoundingClientRect();return {bg:s.backgroundColor,image:s.backgroundImage,color:s.color,height:b.getBoundingClientRect().height,size:s.fontSize,arrowGap:Math.round(a.left-w.right)}})()');
   assert.deepEqual(learnButton,{bg:'rgb(255, 255, 255)',image:'none',color:'rgb(17, 17, 17)',height:56,size:'12px',arrowGap:14},JSON.stringify(learnButton));
   assert.equal(await evaluate('new URL(document.querySelector("#still").src).pathname'),'/assets/images/step01-finish.jpg','Finish shows the video’s last frame');
   assert.equal(await shows('.end'),true);
   assert.equal(await barValue(),33);
   assert.deepEqual(await barLabels(),['WATCH:done','LEARN:','ACT:'],'Watch turns gold once watched');
   assert.equal((await stored()).steps[1].watched,true);
   if(phone)await shot('step-watch-finish-mobile.png');
   await go('step-watch.html?step=1');
   assert.equal(await watchState(),'finish','A watched step opens at Finish');

   // Step 01 · Learn: the button sits at the end of the content, not pinned.
   await click('#next');await ready('step-learn.html');
   assert.equal(await evaluate('document.querySelector("#stepLabel").textContent'),'STEP 01');
   assert.equal(await evaluate('getComputedStyle(document.querySelector("#next")).position'),'relative');
   if(phone){
    assert.ok(await evaluate('document.querySelector("#next").getBoundingClientRect().top>innerHeight'),'YOUR TURN is only seen after scrolling');
    await shot('step-learn-mobile.png',true);
   }
   await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(900);
   assert.equal(await barValue(),67);
   await noOverflow();

   // Step 01 · Act.
   await click('#next');await ready('step-act.html');
   assert.equal(await barValue(),70);
   assert.equal(await evaluate('document.querySelectorAll(".row.is-locked").length'),4,'Everything is visible, later rows locked');
   assert.equal(await evaluate('document.querySelector("#a-here").disabled'),true);
   assert.equal(await evaluate('document.querySelector("#hold").disabled'),true);
   if(phone)await shot('step-act-start-mobile.png');
   await click('[data-action="notyet"]');
   assert.equal(await evaluate('document.querySelector("#notYetNote").hidden'),false);assert.equal(await stage(),0,'NOT YET keeps the user here');
   await click('[data-action="here"]');await wait(400);
   assert.equal(await stage(),1);
   assert.equal(await evaluate('document.activeElement.id'),'a-here','The unlocked box gets focus');
   const here=()=>evaluate('document.querySelector("#a-here").value');
   // "See an example": only on the question being answered, closed until tapped, between helper line and box.
   const examples=()=>evaluate('Array.from(document.querySelectorAll(".example:not([hidden])"),e=>({row:e.closest(".row").dataset.k,toggle:e.querySelector(".example-toggle").textContent.trim(),text:e.querySelector(".example-text").hidden?null:e.querySelector(".example-text").textContent,beforeBox:e.nextElementSibling.classList.contains("starter-wrap")}))');
   assert.deepEqual(await examples(),[{row:'1',toggle:'See an example',text:null,beforeBox:true}],'One link, on HERE, closed');
   await click('.row[data-k="1"] .example-toggle');
   assert.deepEqual(await examples(),[{row:'1',toggle:'Hide example',text:'Right now, I spend most nights on my phone in bed and wake up tired.',beforeBox:true}]);
   if(phone)await shot('step-act-example-mobile.png');
   await click('.row[data-k="1"] .example-toggle');
   assert.equal((await examples())[0].text,null,'Tapping again hides it');
   await click('.row[data-k="1"] .example-toggle');await click('#a-here');
   // Grey sentence starters sit in front of each box; the user only finishes the sentence.
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".starter"),s=>s.textContent+"|"+getComputedStyle(s).color)'),['Right now, I |rgb(138, 138, 134)','I want to be able to |rgb(138, 138, 134)','Today I will |rgb(138, 138, 134)']);
   assert.equal(await here(),'','The box holds only what the user types');
   const indent=await evaluate('(()=>{const b=document.querySelector("#a-here"),s=b.parentElement.querySelector(".starter");return {indent:parseFloat(getComputedStyle(b).textIndent),starter:s.getBoundingClientRect().width}})()');
   assert.ok(Math.abs(indent.indent-indent.starter)<1,'Typing starts right after the starter: '+JSON.stringify(indent));
   assert.equal(await evaluate('document.querySelector("[data-next=here]").disabled'),true,'Next stays grey until something follows the starter');
   for(let n=0;n<3;n++){await command('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});}
   assert.equal(await evaluate('document.querySelector(".starter").textContent'),'Right now, I ','The starter can’t be deleted');
   await command('Input.insertText',{text:'say yes to every request and finish each week drained.'});
   assert.equal(await here(),'say yes to every request and finish each week drained.');
   assert.equal((await stored()).responses[1].HERE,'Right now, I say yes to every request and finish each week drained.','Saved as the whole sentence');
   assert.equal(await evaluate('document.querySelector("[data-next=here]").disabled'),false);
   await pressEnter('#a-here');assert.equal(await stage(),2,'Return moves on');
   assert.equal((await here()).includes('\n'),false);
   assert.deepEqual(await examples(),[{row:'2',toggle:'See an example',text:null,beforeBox:true}],'The link moves on with the user, closed; HERE’s closes and goes');
   assert.equal(await evaluate('document.querySelector(".row[data-k=\\"1\\"] .example-text").hidden'),true);
   // Answers persist: leaving and coming back restores the exact state.
   await go('step-act.html?step=1');
   assert.equal(await evaluate('document.querySelector(".row[data-k=\\"2\\"]").classList.contains("is-active")'),true);
   assert.equal(await here(),'say yes to every request and finish each week drained.');
   assert.equal(await evaluate('document.querySelector("#a-there").value'),'');
   if(phone)await shot('step-act-there-mobile.png',true);
   await typeInto('#a-there','have two evenings a week that are truly mine.');
   await click('[data-next="there"]');await wait(300);assert.equal(await stage(),3);
   assert.deepEqual(await examples(),[],'No link on the TEST check');
   await click('[data-action="notsure"]');await wait(300);
   assert.equal(await stage(),2,'NOT SURE goes back to THERE');
   assert.equal(await evaluate('document.querySelector("#notSureHint").hidden'),false);
   await click('[data-next="there"]');await wait(300);await click('[data-action="yes"]');await wait(300);
   assert.equal(await stage(),4);
   assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-action=retest]")).display')!=='none',true,'TEST shows its answer');
   assert.equal(await evaluate('document.querySelector(".row[data-k=\\"4\\"] .eyebrow").textContent.trim()'),'MY STEP');
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".answered--btn svg")).display')!=='none',true,'TEST answer has the gold tick');
   assert.equal(await evaluate('document.querySelector("#a-step").value'),'');
   assert.equal(await evaluate('document.querySelector("#promise").textContent'),'Today, I will …');
   await typeInto('#a-step','say no to one request this week, kindly and clearly');
   assert.equal(await evaluate('document.querySelector("#promise").textContent'),'Today, I will say no to one request this week, kindly and clearly.','MY PROMISE says "Today I will" once and ends with a full stop');
   assert.equal(await evaluate('document.querySelector(".promise-label").textContent'),'MY PROMISE');
   assert.equal(await evaluate('document.querySelector("#hold").disabled'),true,'I’M COMMITTED waits for MY STEP');
   await pressEnter('#a-step');assert.equal(await stage(),5);
   assert.deepEqual(await examples(),[],'No link once every box is answered');
   assert.equal(await evaluate('document.querySelector(".hold-label").textContent'),'I’M COMMITTED');
   assert.equal(await evaluate('document.querySelector("#hold").disabled'),false);
   await typeInto('#a-there','');
   assert.equal(await evaluate('document.querySelector("#hold").disabled'),true,'Greyed out again when a box is emptied');
   await typeInto('#a-there','have two evenings a week that are truly mine.');
   assert.equal(await evaluate('document.querySelector("#hold").disabled'),false);
   assert.equal(await barValue(),97);
   if(phone)await shot('step-act-promise-mobile.png');
   await holdFor(350);assert.equal(await stage(),5,'Releasing early does not commit');
   assert.equal(await evaluate('document.querySelector("#holdFill").style.width'),'0%','Releasing early resets the fill');
   // Committing flashes COMMITTED for 0.3 seconds, then returns to the map by itself.
   const holdAt=Date.now();await holdFor(1250);await ready('04-map-start.html');
   assert.equal(lastUnlock,'waiting','Back on My Path, Step 02 is about to open in front of him');
   assert.deepEqual(await evaluate('[localStorage.getItem("mirror21-unlock"),document.documentElement.dataset.unlock,document.querySelectorAll(".is-was-current,.is-was-locked,.is-waiting").length]'),[null,'done',0],'Shown once; a tap skips to the end');
   assert.ok(Date.now()-holdAt<2600,'Back on the map quickly after committing: '+(Date.now()-holdAt)+'ms');
   assert.equal(await stage(),6,'Holding for a second commits');
   let saved=await stored();
   assert.equal(saved.lessons[1],true);assert.equal(saved.dayChanges[1],'Today, I will say no to one request this week, kindly and clearly.');
   assert.equal(saved.responses[1].HERE,'Right now, I say yes to every request and finish each week drained.');
   assert.deepEqual(Object.keys(saved.answers),[]);
   // The committed step, reopened: locked for good, with its done note.
   await go('step-act.html?step=1');
   assert.equal(await evaluate('document.querySelector("#done").hidden'),false);
   assert.equal(await evaluate('document.querySelector("#doneText").textContent'),'Step 02 is open. It starts by asking how your step went.');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".answer-box"),b=>b.readOnly)'),[true,true,true],'The promise is locked for good');
   assert.equal(await barValue(),100);
   await noOverflow();
   if(phone)await shot('step-act-done-mobile.png');

   // On the map: Step 01 committed (plain white, no ring), Step 02 open straight away.
   await go('04-map-start.html');
   const tile=n=>evaluate('(()=>{const t=document.querySelectorAll(".progress-step")['+(n-1)+'],s=getComputedStyle(t);return {cls:t.className,tag:t.tagName,color:s.color,shadow:s.boxShadow,background:s.backgroundImage+" "+s.backgroundColor}})()');
   assert.equal(await evaluate('document.querySelector(".progress-step.current").textContent'),'02');
   let t1=await tile(1);
   assert.ok(t1.cls.includes('committed'),t1.cls);assert.equal(t1.color,'rgb(137, 106, 0)');assert.ok(!t1.shadow.includes('inset'),'Committed has no ring');
   assert.equal(t1.tag,'A','Done steps open again');
   assert.equal(await evaluate('document.querySelectorAll(".journey-segment.reached").length'),1);
   if(phone){await evaluate('document.querySelector(".map-scroll").scrollTop=0');await wait(200);await shot('journey-map-mobile.png');}

   // Step 02 starts with the check-in on Step 01.
   await click('.progress-step.current');
   assert.equal(await evaluate('new URL(document.querySelector(".day-popover-start").href).pathname.replace(/\\.html$/,"")'),'/html/step-checkin');
   await click('.day-popover-start');await ready('step-checkin.html');
   assert.equal(await evaluate('document.querySelector(".title").textContent'),'DID YOU KEEP YOUR PROMISE?');
   fit=await titleFits();assert.equal(fit.lines,1);assert.ok(fit.width<=fit.available+1,JSON.stringify(fit));if(phone)console.log('phone: check-in title at '+fit.size+'px');
   assert.equal(await evaluate('document.querySelector("#stepLabel").textContent'),'STEP 02');
   assert.equal(await evaluate('document.querySelector(".intro").textContent'),'Earlier today you promised:','Committed minutes ago');
   assert.equal(await evaluate('document.querySelector("#commitText").textContent'),'Today, I will say no to one request this week, kindly and clearly.','The check-in shows the exact promise');
   assert.equal(await evaluate('document.querySelector("#next").hidden'),true,'WATCH waits for an answer');
   assert.equal(await barParts(),4,'From Step 02: Check in · Watch · Learn · Act');
   assert.equal(await barValue(),0,'Check in fills once answered');
   assert.equal(await evaluate('document.querySelectorAll(".choice[role=radio]").length'),3);
   assert.equal(await evaluate('document.querySelector(".choice").getBoundingClientRect().height'),60);
   await noOverflow();
   if(phone)await shot('step-checkin-before-mobile.png');
   // Watch sends you back to the check-in until it is done.
   await command('Page.navigate',{url:base+'/html/step-watch?step=2'});await ready('step-checkin.html');
   const choose=async c=>{await click('.choice[data-choice="'+c+'"]');await wait(450);};
   await choose('yes');
   assert.equal(await evaluate('document.querySelectorAll("#reply, #why, .reply, textarea").length'),0,'Check-in is just YES / PARTLY / NO: no reply line, no note');
   assert.equal(await evaluate('document.querySelector("#next").hidden'),false);
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".choice"),b=>getComputedStyle(b).opacity)'),['1','0.38','0.38']);
   assert.equal(await barValue(),25);
   if(phone)await shot('step-checkin-yes-mobile.png');
   await choose('partly');
   if(phone)await shot('step-checkin-partly-mobile.png');
   await choose('no');
   if(phone)await shot('step-checkin-no-mobile.png');
   await go('04-map-start.html');
   t1=await tile(1);assert.ok(t1.cls.includes(' no'),t1.cls);assert.ok(t1.shadow.includes('inset'),'NO is a gold ring');
   await go('step-checkin.html?step=2');
   assert.equal(await evaluate('document.querySelector(".choice[aria-checked=true]").dataset.choice'),'no','Choice is restored');
   await choose('partly');
   saved=await stored();assert.equal(saved.answers[1],'partly');assert.equal(saved.responses[1].NOTE,undefined);
   await click('#next');await ready('step-watch.html');
   assert.equal(await evaluate('document.querySelector("#stepTitle").textContent'),'MAKE IT SOMETHING YOU DO.');
   fit=await titleFits();assert.equal(fit.lines,1);assert.ok(fit.width<=fit.available+1,JSON.stringify(fit));
   assert.equal(await evaluate('document.querySelector("#yesterday")'),null,'Watch has nothing under the video');
   assert.equal(await evaluate('new URL(document.querySelector("#player").src).pathname'),'/Audio-Video/Step02-Watch.mp4','Step 02 plays its own video');
   assert.equal(await evaluate('new URL(document.querySelector("#still").src).pathname'),'/assets/images/step02-start.jpg');
   assert.equal(await text('#hintText'),'BEST WITH SOUND · 1:18');
   assert.equal(await barParts(),4);
   assert.equal(await barValue(),25,'Check in is already gold on arrival');
   assert.equal(await text('#nextLabel'),'LEARN');
   if(phone)await shot('step02-watch-mobile.png');
   // WATCH locked the answer in.
   await go('step-checkin.html?step=2');await choose('yes');
   assert.equal((await stored()).answers[1],'partly');
   await go('04-map-start.html');
   t1=await tile(1);assert.ok(t1.cls.includes('partly'),t1.cls);
   assert.equal(await evaluate('document.querySelector(".progress-step.current").textContent'),'02');
   assert.equal(await evaluate('document.querySelector(".progress-bubble").textContent'),'CONTINUE');
   assert.equal(await evaluate('new URL(document.querySelector(".progress-step.current").href).pathname.replace(/\\.html$/,"")'),'/html/step-watch');
   if(phone){await evaluate('document.querySelector(".map-scroll").scrollTop=0');await wait(200);await shot('map-after-check-in-mobile.png');}

   // A done step opens again to rewatch and redo, without touching its check-in or the open step.
   const before=JSON.stringify(await stored());
   await click('.progress-step.partly');
   assert.equal(await evaluate('document.querySelector(".day-popover h2").textContent'),'Know Where You Are Going');
   assert.equal(await evaluate('document.querySelector(".day-popover-start .action-label").textContent'),'REDO STEP');
   if(phone)await shot('redo-card-mobile.png');
   await openWatchFromCard();
   assert.equal(await evaluate('document.querySelector("#stepTitle").textContent'),'KNOW WHERE YOU ARE GOING.');
   assert.equal(await watchState(),'finish','A done step opens at Finish');
   await click('#again');assert.equal(await watchState(),'playing','WATCH AGAIN plays from the start');
   await wait(500);await click('#watch');assert.equal(await watchState(),'paused');await wait(600);
   assert.equal(await shows('.end'),true,'Paused while rewatching, the button stays reachable');
   await click('#next');await ready('step-learn.html');
   await click('#next');await ready('step-act.html');
   assert.equal(await evaluate('document.querySelector("#a-step").value'),'say no to one request this week, kindly and clearly');assert.equal(await evaluate('document.querySelector("#a-step").readOnly'),true,'Reopened answers stay locked');
   assert.equal(await evaluate('document.querySelector("#done").hidden'),false);
   await wait(2000);
   assert.equal(await evaluate('location.pathname.replace(/\\.html$/,"")'),'/html/step-act','Reopening a done step does not bounce back to the map');
   const after=await stored();
   assert.equal(after.answers[1],'partly');assert.equal(after.steps[2].checkedIn,true);assert.equal(after.steps[2].screen,'watch');
   assert.equal(JSON.stringify(after.steps[2]),JSON.stringify(JSON.parse(before).steps[2]));
   await go('18-my-mirror.html');
   await go('04-map-start.html');
   assert.equal(await evaluate('document.querySelector(".progress-step.current").textContent'),'02');

   // Step 02 · Learn: its own lesson, with your THERE from Step 01 read-only.
   await command('Page.navigate',{url:base+'/html/step-learn?step=2'});await ready('step02-learn.html');
   assert.equal(await evaluate('document.querySelector(".title").getAttribute("aria-label")'),'There, proof, once.');
   assert.equal(await evaluate('document.querySelectorAll(".title svg").length'),2,'Drawn arrows');
   fit=await titleFits();assert.ok(fit.width<=fit.available+1,JSON.stringify(fit));
   assert.equal(await evaluate('document.querySelector("[data-from=there]").textContent'),'I want to be able to have two evenings a week that are truly mine.');
   assert.equal(await evaluate('document.querySelector("[data-from-step]").textContent'),'FROM STEP 01');
   assert.equal(await evaluate('document.querySelectorAll(".move").length'),3);
   await noOverflow();
   if(phone)await shot('step02-learn-mobile.png',true);
   await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(700);
   assert.equal(await barValue(),75);
   await click('#next');await ready('step02-act.html');

   // Step 02 · Act: THERE (read-only) → PROOF → ONCE.
   const stage2=async()=>(await stored()).steps[2].stage;
   assert.equal(await barValue(),84,'Act starts at 35% of its part');
   assert.equal(await evaluate('document.querySelector("[data-from=there]").textContent'),'I want to be able to have two evenings a week that are truly mine.');
   assert.equal(await evaluate('document.querySelector("#rowPromise").classList.contains("is-locked")'),true);
   assert.equal(await evaluate('document.querySelector("#hold").disabled'),true);
   assert.equal(await evaluate('document.querySelector("#starter").textContent'),'Today I will ');
   assert.equal(await evaluate('document.querySelector("#promiseRest").textContent'),'…');
   if(phone)await shot('step02-act-start-mobile.png');
   await typeInto('#action','leave my laptop at work tonight');
   assert.equal(await evaluate('document.querySelector(".promise").textContent'),'Today, I will leave my laptop at work tonight.','The promise forms as you type');
   await pressEnter('#action');assert.equal(await stage2(),1);
   assert.equal(await evaluate('document.querySelector("#proofQ").hidden'),false);
   assert.equal(await barValue(),90);
   if(phone)await shot('step02-act-proof-mobile.png');
   await click('#proofNotSure');await wait(300);
   assert.equal(await stage2(),0,'NOT SURE goes back to the box');
   assert.equal(await evaluate('document.querySelector("#proofHint").hidden'),false);
   await click('#next');await wait(300);await click('#proofYes');await wait(400);
   assert.equal(await stage2(),2);
   assert.equal(await evaluate('document.querySelector("#proved").hidden'),false);
   assert.equal(await evaluate('document.querySelector("#rowPromise").classList.contains("is-locked")'),false);
   assert.equal(await evaluate('document.querySelector("#hold").disabled'),false);
   assert.equal(await barValue(),96);
   if(phone)await shot('step02-act-ready-mobile.png',true);
   await holdFor(1250);await ready('04-map-start.html');
   assert.equal(await stage2(),3);
   saved=await stored();
   assert.equal(saved.lessons[2],true);assert.equal(saved.responses[2].ACTION,'leave my laptop at work tonight');
   assert.equal(saved.dayChanges[2],'Today, I will leave my laptop at work tonight.');
   await go('step02-act.html?step=2');
   assert.equal(await evaluate('document.querySelector("#lockedBlock").hidden'),false);
   assert.equal(await evaluate('document.querySelector("#lockedText").textContent'),'Your promise is locked. Step 03 starts by asking how it went.');
   assert.equal(await evaluate('document.querySelector("#action").readOnly'),true);
   if(phone)await shot('step02-act-committed-mobile.png');
   await go('04-map-start.html');
   assert.equal(await evaluate('document.querySelector(".progress-step.current").textContent'),'03');
   assert.equal(await evaluate('document.querySelectorAll(".app-frame > div[style*=\\"top: 59px\\"] > div p")[2].textContent'),'19 steps to go','My Path header counts steps, not days');
   // Step 03's check-in grades that exact promise; Step 03 itself uses Step 01's lesson.
   await go('step-checkin.html?step=3');
   assert.equal(await evaluate('document.querySelector("#commitText").textContent'),'Today, I will leave my laptop at work tonight.');

   await go('18-my-mirror.html');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".days-so-far > div:first-child p"),p=>p.textContent)'),['STEPS SO FAR'],'No "OF 21" count');
   assert.equal(await evaluate('document.querySelectorAll(".day-row, h2").length'),0,'No MY STEPS list on My Mirror');
   const ring=n=>evaluate('(()=>{const s=document.querySelectorAll("[aria-label=\\"Where I stand\\"] svg")['+n+'];return {value:s.querySelector("text").textContent,sub:s.querySelectorAll("text")[1].textContent,caption:s.parentElement.querySelector("span").textContent,label:s.getAttribute("aria-label"),stroke:s.querySelectorAll("circle")[1].getAttribute("stroke")}})()');
   assert.deepEqual(await ring(1),{value:'19',sub:'STEPS',caption:'TO GO',label:'19 steps to go',stroke:'#e0b84c'},'TO GO in the middle');
   assert.deepEqual(await ring(2),{value:'0',sub:'OF 1',caption:'MISSED',label:'0 missed of 1 check-ins',stroke:'#646461'},'MISSED on the right, dark grey');
   // Worth a second look: no NO yet, so the latest PARTLY (Step 01).
   const secondLook=()=>evaluate('({tag:document.querySelector("#secondLookTag").textContent,num:document.querySelector(".second-look-num")?.textContent,name:document.querySelector(".second-look-name")?.textContent,promise:document.querySelector(".second-look-promise")?.textContent,href:document.querySelector(".second-look-revisit")?.getAttribute("href"),revisit:document.querySelector(".second-look-revisit")?.textContent.trim(),none:document.querySelector(".second-look-none")?.textContent})');
   assert.deepEqual(await secondLook(),{tag:'PARTLY',num:'01',name:'Know Where You Are Going',promise:'Today, I will say no to one request this week, kindly and clearly.',href:'step-watch.html?step=1',revisit:'REVISIT STEP 01'});
   const clamp=await evaluate('(()=>{const p=document.querySelector(".second-look-promise"),s=getComputedStyle(p);return {lines:Math.round(p.getBoundingClientRect().height/parseFloat(s.lineHeight)),clamp:s.webkitLineClamp}})()');
   assert.ok(clamp.lines<=2&&clamp.clamp==='2','The promise shows two lines at most: '+JSON.stringify(clamp));
   assert.equal(await evaluate('document.querySelector("[aria-label=\\"Where I stand\\"] svg text").textContent'),'50%','One PARTLY = 50%');
   assert.equal(await evaluate('document.querySelector("[aria-label=\\"Where I stand\\"] > div:last-child").textContent.replace(/\\s+/g," ").trim()'),'BLOCK 1 SEE IT');
   if(phone)await shot('my-mirror-mobile.png');
   // Settings gear: top right of My Path, My Mirror and My Journey; opens Settings, the X closes it.
   for(const page of ['04-map-start.html','18-my-mirror.html','19-my-journey.html']){await go(page);assert.equal(await evaluate('document.querySelectorAll(".settings-gear").length'),1,page);}
   const gearBox=await evaluate('(()=>{const r=document.querySelector(".settings-gear").getBoundingClientRect(),f=document.querySelector(".app-frame").getBoundingClientRect();return {right:f.right-r.right,top:r.top-f.top,width:r.width}})()');
   assert.ok(gearBox.top<20&&gearBox.right<20&&gearBox.width<=32,JSON.stringify(gearBox));
   await click('.settings-gear');await wait(400);
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".settings .settings-title"),t=>t.textContent)'),['Account','Daily reminder','Help','Start over']);
   assert.equal(await text('.settings-version'),'Mirror 21 by Daily Xcellence · v1.0');
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".settings")).overflowY'),'auto','Settings scrolls when it needs to');
   if(phone)await shot('settings-mobile.png');
   const settingRow=text=>'Array.from(document.querySelectorAll(".settings-row")).find(r=>r.textContent.includes('+JSON.stringify(text)+'))';
   const sheetButton=text=>'Array.from(document.querySelectorAll(".sheet .settings-btn, .sheet .sheet-link")).find(b=>b.textContent.includes('+JSON.stringify(text)+'))';
   // Start over asks first, in a sheet; Cancel keeps everything.
   await evaluate(settingRow('Start over')+'.click()');await wait(450);
   assert.equal(await text('.sheet h2'),'START OVER?');
   assert.ok(await evaluate(sheetButton('START OVER')+'!=null&&'+settingRow('Save your journal as PDF first')+'!=null'));
   if(phone)await shot('settings-start-over-mobile.png');
   await evaluate(sheetButton('CANCEL')+'.click()');await wait(450);
   assert.equal(await evaluate('document.querySelector(".sheet-back")'),null,'Cancel closes the sheet');
   assert.ok(await evaluate('localStorage.getItem("mirror21-progress")!==null'),'Cancel keeps everything');
   // Daily reminder: a wheel of hours and quarter hours; SAVE shows the time on its row, and Off when turned off.
   await evaluate(settingRow('Daily reminder')+'.click()');await wait(450);
   assert.equal(await text('.sheet h2'),'DAILY REMINDER');
   assert.equal(await evaluate('document.querySelectorAll(".wheel-item.is-on").length'),2);
   await evaluate('(()=>{const [h,m]=document.querySelectorAll(".wheel-col");h.scrollTop=(3*24+7)*40;m.scrollTop=(3*4+0)*40;})()');await wait(500);
   assert.equal(await evaluate('Array.from(document.querySelectorAll(".wheel-item.is-on"),i=>i.textContent).join(":")'),'07:00');
   if(phone)await shot('settings-reminder-mobile.png');
   await evaluate(sheetButton('SAVE')+'.click()');await wait(450);
   assert.equal(await evaluate('localStorage.getItem("mirror21-reminder")'),'07:00');
   assert.equal(await evaluate(settingRow('Daily reminder')+'.querySelector(".settings-value").textContent'),'7:00');
   await evaluate(settingRow('Daily reminder')+'.click()');await wait(450);await evaluate(sheetButton('Turn reminders off')+'.click()');await wait(450);
   assert.equal(await evaluate(settingRow('Daily reminder')+'.querySelector(".settings-value").textContent'),'Off');
   // Help: six questions, the first open, one open at a time; back to Settings.
   await evaluate(settingRow('Help')+'.click()');await wait(350);
   assert.equal(await text('.settings h2'),'HELP');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".help-q"),q=>q.getAttribute("aria-expanded"))'),['true','false','false','false','false','false']);
   assert.equal(await text('.help-a:not([hidden])'),'The next step opens as soon as you commit to this one. Take it when it suits you. Nothing expires.');
   await evaluate('document.querySelectorAll(".help-q")[1].click()');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".help-q"),q=>q.getAttribute("aria-expanded")).slice(0,2)'),['false','true'],'One question open at a time');
   if(phone)await shot('settings-help-mobile.png');
   await click('.settings-back');await wait(350);
   // Account: past results (none yet) and Sign out.
   await evaluate(settingRow('Account')+'.click()');await wait(350);
   assert.equal(await text('.settings h2'),'ACCOUNT');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".settings .settings-row"),r=>r.textContent)'),['My past resultsNone yet','Sign out']);
   await click('.settings-back');await wait(350);
   assert.equal(await text('.settings h2'),'SETTINGS');
   await click('.settings-close');await wait(400);
   assert.equal(await evaluate('document.querySelector(".settings")'),null,'The X closes Settings');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("nav a"),a=>a.textContent.trim())'),['MY PATH','MY MIRROR','MY JOURNEY']);

   // My Journey: committed steps in your own words, read-only, then today's step.
   await click('nav a[href*="my-journey"]');await ready('19-my-journey.html');
   const journey=()=>evaluate('Array.from(document.querySelectorAll(".entry"),e=>({step:e.dataset.step,dot:e.querySelector(".entry-dot").className.replace("entry-dot ",""),label:e.querySelector(".entry-dot").getAttribute("aria-label"),open:e.classList.contains("is-open"),line:e.querySelector(".entry-line")?.className||null}))');
   let entries=await journey();
   assert.deepEqual(entries.map(e=>e.step+':'+e.dot+':'+(e.open?'open':'closed')),['1:partly:open','2:committed:closed','3:today:closed'],JSON.stringify(entries));
   assert.equal(entries[0].label,'Step 01, partly kept');
   assert.equal(await evaluate('document.querySelector(".journey-week").textContent'),'BLOCK 1 · SEE IT');
   assert.equal(await evaluate('document.querySelector("#journeyFooter").textContent'),'19 more steps to write.');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".entry[data-step=\\"1\\"] .entry-answer"),r=>r.querySelector("dt").textContent+": "+r.querySelector("dd").textContent)'),['HERE: Right now, I say yes to every request and finish each week drained.','THERE: I want to be able to have two evenings a week that are truly mine.','TEST: Yes, that’s what I actually want.','STEP: Today I will say no to one request this week, kindly and clearly']);
   assert.equal(await evaluate('document.querySelector(".entry[data-step=\\"1\\"] .entry-locked").textContent'),'Today, I will say no to one request this week, kindly and clearly.');
   assert.equal(await evaluate('document.querySelector(".entry[data-step=\\"2\\"] .entry-promise").textContent'),'Today, I will leave my laptop at work tonight.','Closed entries show just the promise');
   assert.ok(/^STEP 01 · [A-Z]{3} \d{1,2} [A-Z]{3}/.test(await evaluate('document.querySelector(".entry-meta").textContent')),'Commit date in the header');
   assert.equal(await evaluate('document.querySelectorAll("textarea, input, [contenteditable]").length'),0,'Nothing can be edited');
   assert.equal(await evaluate('document.querySelector(".entry.is-today button")'),null,'Today is not clickable');
   await click('.entry[data-step="2"] .entry-head');
   assert.equal(await evaluate('document.querySelector(".entry[data-step=\\"2\\"] .entry-head").getAttribute("aria-expanded")'),'true');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".entry[data-step=\\"2\\"] .entry-answer dt"),d=>d.textContent)'),['ACTION','PROOF']);
   assert.equal(await evaluate('document.querySelector(".entry[data-step=\\"1\\"]").classList.contains("is-open")'),true,'Several entries can be open');
   await click('.entry[data-step="2"] .entry-head');
   assert.equal(await evaluate('document.querySelector(".entry[data-step=\\"2\\"]").classList.contains("is-open")'),false);
   await noOverflow();
   // Grade Step 02 at Step 03's check-in: it becomes the open one, joined to Step 01 by a gold line.
   await go('step-checkin.html?step=3');await click('.choice[data-choice="yes"]');await wait(300);
   await go('19-my-journey.html');
   entries=await journey();
   assert.deepEqual(entries.map(e=>e.step+':'+e.dot+':'+(e.open?'open':'closed')),['1:partly:closed','2:yes:open','3:today:closed']);
   assert.ok(entries[0].line.includes('is-gold'),'Gold between graded steps');assert.ok(!entries[1].line.includes('is-gold'),'Grey after');
   if(phone)await shot('my-journey-mobile.png',true);

   // Step 03 · Pick one move: its own Learn (straight into the moves) and Act (MY MOVE, MY ACTION, proof, promise).
   await go('step-checkin.html?step=3');await click('#next');await ready('step-watch.html');
   assert.deepEqual(await barLabels(),['CHECK IN:done','WATCH:current','LEARN:','ACT:'],'Watch is current, Check in gold');
   await command('Page.navigate',{url:base+'/html/step-learn?step=3'});await ready('step03-learn.html');
   assert.equal(await evaluate('document.querySelector(".title")'),null,'Learn opens straight on the moves');
   assert.equal(await evaluate('document.querySelectorAll(".chip-row").length'),0,'No LEARN chip');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".move-key"),k=>k.textContent)'),['OPTIONS','IMPACT','START']);
   // The example follows the moves above: same names, same numbers, then MY PROMISE; YOUR TURN is black.
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".learn-ex-row"),r=>r.querySelector(".learn-ex-num").textContent+" "+r.querySelector(".learn-ex-key").textContent)'),['01 OPTIONS','02 IMPACT','03 START',' MY PROMISE']);
   assert.equal(await evaluate('document.querySelector(".learn-ex-promise").textContent'),'Today, I will set a 6:30am alarm for every day this week, weekends included.');
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".learn-ex-fixed")).color'),'rgb(100, 100, 97)','Fixed promise words in the moves’ grey');
   assert.deepEqual(await evaluate('[".move-text",".learn-ex-text",".learn-ex-promise"].map(q=>{const s=getComputedStyle(document.querySelector(q));return s.fontFamily.split(",")[0]+" "+s.fontWeight+" "+s.fontStyle+" "+s.fontSize+" "+s.lineHeight})'),Array(3).fill('"Neue Haas Display" 300 normal 17px 26.35px'),'The example and its promise set exactly like the move text above');
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".learn-ex-text")).color'),'rgb(100, 100, 97)','Each move’s example words in the moves’ grey');
   const exPanel=await evaluate('(()=>{const p=document.querySelector(".learn-ex").getBoundingClientRect();return {left:Math.round(p.left),right:Math.round(innerWidth-p.right),bg:getComputedStyle(document.querySelector(".learn-ex")).backgroundColor}})()');
   if(phone)assert.deepEqual(exPanel,{left:0,right:0,bg:'rgb(247, 247, 245)'},'A full-width grey panel');
   assert.equal(await evaluate('getComputedStyle(document.querySelector("#next")).backgroundColor'),'rgb(17, 17, 17)','YOUR TURN is black');
   assert.deepEqual([...new Set(await evaluate('Array.from(document.querySelectorAll(".move-num"),n=>{const s=getComputedStyle(n);return s.backgroundColor+" "+s.color+" "+s.borderTopColor})'))],['rgb(255, 255, 255) rgb(137, 106, 0) rgb(224, 184, 76)'],'Every Learn circle the same: white, gold ring, gold number (the last one too)');
   assert.deepEqual(await barLabels(),['CHECK IN:done','WATCH:done','LEARN:current','ACT:']);
   await noOverflow();
   if(phone)await shot('step03-learn-mobile.png',true);
   await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(700);
   await click('#next');await ready('step03-act.html');
   const stage3=async()=>(await stored()).steps[3].stage;
   assert.deepEqual(await barLabels(),['CHECK IN:done','WATCH:done','LEARN:done','ACT:current']);
   assert.equal(await evaluate('document.querySelector("[data-from=there]").textContent'),'I want to be able to have two evenings a week that are truly mine.','THERE comes from Step 01');
   assert.equal(await evaluate('document.querySelector("#boxTwo").disabled'),true,'MY ACTION waits for MY MOVE');
   assert.equal(await evaluate('document.querySelector("#hold").disabled'),true);
   if(phone)await shot('step03-act-start-mobile.png');
   await typeInto('#boxOne','saying no to extra evening work');
   await pressEnter('#boxOne');assert.equal(await stage3(),1);
   await typeInto('#boxTwo','leave the office at 6pm');
   assert.equal(await evaluate('document.querySelector(".promise").textContent'),'Today, I will leave the office at 6pm.','The promise is built from MY ACTION');
   await pressEnter('#boxTwo');assert.equal(await stage3(),2);
   await click('#proofNotSure');await wait(300);
   assert.equal(await stage3(),1,'NOT SURE goes back to MY ACTION');assert.equal(await evaluate('document.querySelector("#proofHint").hidden'),false);
   await click('#twoNext');await wait(300);await click('#proofYes');await wait(400);
   assert.equal(await stage3(),3);assert.equal(await evaluate('document.querySelector("#hold").disabled'),false);
   assert.equal(await barValue(),96);
   await noOverflow();
   if(phone)await shot('step03-act-ready-mobile.png',true);
   await holdFor(1250);await ready('04-map-start.html');
   assert.equal(await stage3(),4);
   await go('step03-act.html?step=3');
   assert.equal(await evaluate('document.querySelector("#lockedText").textContent'),'Your promise is locked. Step 04 starts by asking how it went.');
   assert.equal(await evaluate('document.querySelector("#rowPromise .node--lock").getBoundingClientRect().width>0'),true);
   saved=await stored();
   assert.deepEqual([saved.lessons[3],saved.responses[3].MOVE,saved.responses[3].ACTION,saved.dayChanges[3]],[true,'saying no to extra evening work','leave the office at 6pm','Today, I will leave the office at 6pm.'],'Both answers saved; the promise is MY ACTION');
   await go('19-my-journey.html');await click('.entry[data-step="3"] .entry-head');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".entry[data-step=\\"3\\"] .entry-answer dt"),d=>d.textContent)'),['MOVE','ACTION','PROOF']);

   // Steps 04–06: check in, then Learn (straight into the moves) and Act (two boxes, the check, the promise).
   const twoBoxStep=async(n,{from,first,second,promise,keys,notSureBack})=>{
    const stageN=async()=>(await stored()).steps[n].stage;
    await go('step-checkin.html?step='+n);await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step='+n});await ready('step0'+n+'-learn.html');
    assert.equal(await evaluate('document.querySelector(".title")'),null,'Step 0'+n+' Learn opens straight on the moves');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),3);
    await noOverflow();
    if(phone)await shot('step0'+n+'-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step0'+n+'-act.html');
    assert.equal(await evaluate('document.querySelector("[data-from]").textContent'),from,'Step 0'+n+' read-only answer');
    await typeInto('#boxOne',first);await pressEnter('#boxOne');assert.equal(await stageN(),1);
    await typeInto('#boxTwo',second);await pressEnter('#boxTwo');assert.equal(await stageN(),2);
    await click('#proofNotSure');await wait(300);
    assert.equal(await stageN(),notSureBack,'NOT SURE goes back to the box the check is about');
    assert.equal(await evaluate('document.querySelector("#proofHint").closest(".row").classList.contains("is-active")'),true,'Its hint shows in that row');
    if(notSureBack===0){await pressEnter('#boxOne');await wait(300);}
    await click('#twoNext');await wait(300);await click('#proofYes');await wait(400);
    assert.equal(await stageN(),3);
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise,'Step 0'+n+' promise');
    await noOverflow();
    if(phone)await shot('step0'+n+'-act-ready-mobile.png',true);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stageN(),4);
    const s=await stored();
    assert.deepEqual([s.responses[n][keys[0]],s.responses[n][keys[1]],s.dayChanges[n]],[first,second,promise],'Step 0'+n+' saves both answers and the promise');
    await ready('04-map-start.html');
   };
   await twoBoxStep(4,{from:'My move is saying no to extra evening work',first:'I scroll my phone when I get home',second:'leave my phone in the car until 7pm',promise:'Today, I will leave my phone in the car until 7pm.',keys:['WAY','ACTION'],notSureBack:1});
   await twoBoxStep(5,{from:'I want to be able to have two evenings a week that are truly mine.',first:'I’m about to open my work email after dinner.',second:'close the laptop',promise:'Today, when I’m about to open my work email after dinner, I will pause and close the laptop. If it doesn’t come, I’ll run through it once in my head.',keys:['MOMENT','RESPONSE'],notSureBack:0});
   await twoBoxStep(6,{from:'I want to be able to have two evenings a week that are truly mine.',first:'my laptop stays on the kitchen table',second:'put my laptop in a drawer when I get home',promise:'Today, I will put my laptop in a drawer when I get home.',keys:['EASY','CHANGE'],notSureBack:1});
   // Step 07: THERE and MY MOVE read-only, two boxes, no check: the second box leads straight to MY PROMISE.
   {
    const stage7=async()=>(await stored()).steps[7].stage;
    // Block tiles sit beside Steps 07, 14 and 21, all locked until Step 07 is committed.
    await go('04-map-start.html');await wait(400);
    const tiles=async()=>evaluate('Array.from(document.querySelectorAll(".block-spot"),s=>({after:s.dataset.after,open:s.classList.contains("open"),tag:s.querySelector(".block-tile").tagName,cls:s.querySelector(".block-tile").className,label:s.querySelector(".block-label").textContent}))');
    assert.deepEqual((await tiles()).map(t=>[t.after,t.open,t.tag,t.label]),[['7',false,'BUTTON','BLOCK 1'],['14',false,'BUTTON','BLOCK 2'],['21',false,'BUTTON','BLOCK 3']]);
    const level=await evaluate('(()=>{const a=document.querySelector(".progress-row[data-day=\\"7\\"] .progress-step").getBoundingClientRect(),b=document.querySelector(".block-spot .block-tile").getBoundingClientRect();return {dy:Math.abs((a.top+a.height/2)-(b.top+b.height/2)),right:b.left>a.right,size:[b.width,b.height],inside:b.right<=innerWidth}})()');
    assert.ok(level.dy<1,'B1 is level with Step 07: '+JSON.stringify(level));assert.ok(level.right&&level.inside,'B1 sits on the right, on screen');assert.deepEqual(level.size,[76,66],'Same size as a step tile');
    await evaluate('document.querySelector(".block-spot .block-tile").scrollIntoView({block:"center"})');await wait(200);
    await click('.block-spot .block-tile');await wait(200);
    assert.equal(await evaluate('document.querySelector(".block-note").textContent'),'Opens after Step 07');
    assert.ok(await evaluate('(()=>{const n=document.querySelector(".block-note").getBoundingClientRect();return n.left>=0&&n.right<=innerWidth})()'),'The locked note stays on screen');
    // Opening a locked summary directly sends you back to My Path.
    await command('Page.navigate',{url:base+'/html/block.html?block=1'});await ready('04-map-start.html');
    await go('step-checkin.html?step=7');await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=7'});await ready('step07-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),3);
    await noOverflow();
    if(phone)await shot('step07-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step07-act.html');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','My move is saying no to extra evening work'],'Step 07 shows THERE and MY MOVE');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from-step]"),e=>e.textContent)'),['FROM STEP 01','FROM STEP 03']);
    await typeInto('#boxOne','get home from work');await pressEnter('#boxOne');assert.equal(await stage7(),1);
    await typeInto('#boxTwo','put my laptop in a drawer.');await pressEnter('#boxTwo');await wait(300);
    assert.equal(await stage7(),3,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),'Today, after I get home from work, I will put my laptop in a drawer.');
    await noOverflow();
    if(phone)await shot('step07-act-ready-mobile.png',true);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage7(),4);
    const s=await stored();
    assert.deepEqual([s.responses[7].ANCHOR,s.responses[7].ACTION,s.dayChanges[7]],['get home from work','put my laptop in a drawer.','Today, after I get home from work, I will put my laptop in a drawer.']);
    await ready('04-map-start.html');await wait(400);
    // Committing Step 07 opens B1: black until its summary is opened once. B2 and B3 stay locked.
    assert.deepEqual((await tiles()).map(t=>[t.open,t.tag,/block-new/.test(t.cls)]),[[true,'A',true],[false,'BUTTON',false],[false,'BUTTON',false]]);
    if(phone){await evaluate('document.querySelector(".block-spot .block-tile").scrollIntoView({block:"center"})');await wait(300);await shot('map-block-tile-mobile.png');}
    await evaluate('document.querySelector(".block-spot .block-tile").click()');await ready('block.html');
    assert.equal(await evaluate('document.querySelector("#blockTitle").textContent'),'MAKE THE MOVE');
    assert.equal(await evaluate('document.querySelector("#blockEyebrow").textContent'),'BLOCK 1 COMPLETE');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".block-skill-name"),e=>e.textContent)'),['DIRECTION','ACTION','PRIORITY','CONTROL','RESPONSE','SURROUNDINGS','ROUTINE']);
    const cards=await evaluate('Array.from(document.querySelectorAll(".block-promise"),c=>[c.children[0].textContent,c.children[1].textContent])');
    const promises=(await stored()).dayChanges;
    assert.deepEqual(cards,[1,2,3,4,5,6,7].map(d=>['YOUR PROMISE · STEP 0'+d,promises[d]]),'Each skill shows that step’s locked promise word for word');
    assert.equal(cards[6][1],'Today, after I get home from work, I will put my laptop in a drawer.');
    await noOverflow();
    if(phone)await shot('block-summary-mobile.png',true);
    await click('.block-end .btn');await ready('04-map-start.html');await wait(400);
    assert.ok(!/block-new/.test((await tiles())[0].cls)&&/committed/.test((await tiles())[0].cls),'Once seen, B1 is white with a gold check');
    await go('step-checkin.html?step=8');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),'Today, after I get home from work, I will put my laptop in a drawer.','Step 08’s check-in grades Step 07’s promise');
   }
   // Step 08: four moves; MY MOVE read-only, three boxes, no check; the promise uses WHEN only.
   {
    const stage8=async()=>(await stored()).steps[8].stage;
    const promise8='Today, when I’m on the sofa after dinner, I will catch my old habit as it starts and name it. If it doesn’t show up, I will look back at the last time it did.';
    await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=8'});await ready('step08-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),4);
    await noOverflow();
    if(phone)await shot('step08-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step08-act.html');
    assert.equal(await evaluate('document.querySelector("[data-from]").textContent'),'My move is saying no to extra evening work');
    const shownExamples=()=>evaluate('Array.from(document.querySelectorAll(".example:not([hidden])"),e=>e.closest(".row").id+": "+e.querySelector(".example-text").textContent)');
    assert.deepEqual(await shownExamples(),['rowOne: It usually happens when I’m on the sofa at about 10pm and the day’s done.'],'One link, on the box being answered');
    await typeInto('#boxOne','I’m on the sofa after dinner.');await pressEnter('#boxOne');assert.equal(await stage8(),1);
    assert.deepEqual(await shownExamples(),['rowTwo: What I actually do is scroll for 45 minutes, which is why getting up at 6:30 is a fight.']);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true);
    await typeInto('#boxTwo','scroll my phone for an hour');await pressEnter('#boxTwo');assert.equal(await stage8(),2);
    await typeInto('#boxThree','a break from thinking');await click('#threeNext');await wait(300);
    assert.equal(await stage8(),4,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise8);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),false);
    await noOverflow();
    if(phone)await shot('step08-act-ready-mobile.png',true);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage8(),5);
    const s=await stored();
    assert.deepEqual([s.responses[8].WHEN,s.responses[8].WHAT,s.responses[8].PAYOFF,s.dayChanges[8]],['I’m on the sofa after dinner.','scroll my phone for an hour','a break from thinking',promise8]);
    await ready('04-map-start.html');
    await go('step-checkin.html?step=9');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),promise8,'Step 09’s check-in grades Step 08’s promise');
    await go('19-my-journey.html');await click('.entry[data-step="8"] .entry-head');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".entry[data-step=\\"8\\"] .entry-answer dt"),d=>d.textContent)'),['WHEN','WHAT','PAYOFF']);
   }
   // Step 09: THERE plus Step 08's WHEN, WHAT and PAYOFF read-only (after their starters), one box, no check;
   // the promise joins Step 08's WHEN and MY SWAP.
   {
    const stage9=async()=>(await stored()).steps[9].stage;
    const promise9='Today, when I’m on the sofa after dinner, I will pause and read ten pages of my book. If the moment doesn’t come, I will run through it once in my head.';
    await go('step-checkin.html?step=9');await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=9'});await ready('step09-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),3);
    await noOverflow();
    if(phone)await shot('step09-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step09-act.html');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','It usually happens when I’m on the sofa after dinner.','What I actually do is scroll my phone for an hour','It gives me a break from thinking'],'Step 09 shows THERE and Step 08’s three answers');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from-step]"),e=>e.textContent)'),['FROM STEP 01','FROM STEP 08','FROM STEP 08']);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true);
    await typeInto('#boxOne','read ten pages of my book');await pressEnter('#boxOne');await wait(300);
    assert.equal(await stage9(),2,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise9);
    await noOverflow();
    if(phone)await shot('step09-act-ready-mobile.png',true);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage9(),3);
    const s=await stored();
    assert.deepEqual([s.responses[9].SWAP,s.dayChanges[9]],['read ten pages of my book',promise9]);
    await ready('04-map-start.html');
    await go('step-checkin.html?step=10');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),promise9,'Step 10’s check-in grades Step 09’s promise');
   }
   // Step 10: THERE, Step 08's WHEN and Step 09's SWAP read-only, two boxes, no check;
   // the promise joins WHEN, MY LINE (in quotation marks, the user's own dropped) and SWAP.
   {
    const stage10=async()=>(await stored()).steps[10].stage;
    const promise10='Today, when I’m on the sofa after dinner, I will pause, say “Be all there tomorrow”, and read ten pages of my book. If the moment doesn’t come, I will run through it once in my head.';
    await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=10'});await ready('step10-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),4);
    await noOverflow();
    if(phone)await shot('step10-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step10-act.html');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','It usually happens when I’m on the sofa after dinner.','Instead, I will read ten pages of my book']);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from-step]"),e=>e.textContent)'),['FROM STEP 01','FROM STEP 08','FROM STEP 09']);
    await typeInto('#boxOne','I’m tired of only being half there');await pressEnter('#boxOne');assert.equal(await stage10(),1);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true);
    await typeInto('#boxTwo','“Be all there tomorrow.”');await pressEnter('#boxTwo');await wait(300);
    assert.equal(await stage10(),3,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise10);
    await noOverflow();
    if(phone)await shot('step10-act-ready-mobile.png',true);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage10(),4);
    const s=await stored();
    assert.deepEqual([s.responses[10].WHY,s.responses[10].LINE,s.dayChanges[10]],['I’m tired of only being half there','“Be all there tomorrow.”',promise10]);
    await ready('04-map-start.html');
    await go('step-checkin.html?step=11');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),promise10,'Step 11’s check-in grades Step 10’s promise');
   }
   // Step 11: THERE, MY MOVE and MY LINE read-only, MY PERSON, then a date for MY REPORT-BACK DAY (saved as
   // YYYY-MM-DD, shown in plain words), no check.
   {
    const stage11=async()=>(await stored()).steps[11].stage;
    const inThree=new Date();inThree.setDate(inThree.getDate()+3);
    const iso=inThree.getFullYear()+'-'+String(inThree.getMonth()+1).padStart(2,'0')+'-'+String(inThree.getDate()).padStart(2,'0');
    const weekday=inThree.toLocaleDateString('en-GB',{weekday:'long'});
    const promise11='Today, I will tell Sam what I’m changing, and that I will report back on '+weekday+'.';
    await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=11'});await ready('step11-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),4);
    await noOverflow();
    if(phone)await shot('step11-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step11-act.html');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','My move is saying no to extra evening work','My line is “Be all there tomorrow.”']);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from-step]"),e=>e.textContent)'),['FROM STEP 01','FROM STEP 03','FROM STEP 10']);
    await typeInto('#boxOne','Sam');await pressEnter('#boxOne');assert.equal(await stage11(),1);
    assert.equal(await evaluate('document.querySelector(".date-shown").textContent'),'pick a day');
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true);
    await evaluate('(()=>{const d=document.querySelector("#boxTwo");d.value="'+iso+'";d.dispatchEvent(new Event("change"));})()');await wait(200);
    assert.equal(await evaluate('document.querySelector(".date-shown").textContent'),steps.plainDate(iso),'The box shows the day in full');
    await click('#twoNext');await wait(300);
    assert.equal(await stage11(),3,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise11);
    await noOverflow();
    if(phone)await shot('step11-act-ready-mobile.png',true);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage11(),4);
    const s=await stored();
    assert.deepEqual([s.responses[11].PERSON,s.responses[11].DATE,s.dayChanges[11]],['Sam',iso,promise11],'The actual calendar date is saved');
    await ready('04-map-start.html');
    await go('step-checkin.html?step=12');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),promise11,'Step 12’s check-in grades Step 11’s promise');
    await go('19-my-journey.html');await click('.entry[data-step="11"] .entry-head');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".entry[data-step=\\"11\\"] .entry-answer dd"),d=>d.textContent)'),['I will tell Sam','I will report back on '+steps.plainDate(iso)+'.']);
   }
   // Step 12: THERE and MY MOVE read-only, MY MINIMUM, no check; the promise is built from MY MINIMUM.
   {
    const stage12=async()=>(await stored()).steps[12].stage;
    const promise12='Today, I will do my move, or at least leave the office by 7pm.';
    await go('step-checkin.html?step=12');await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=12'});await ready('step12-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),4);
    await noOverflow();
    if(phone)await shot('step12-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step12-act.html');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','My move is saying no to extra evening work']);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true);
    await typeInto('#boxOne','leave the office by 7pm.');await pressEnter('#boxOne');await wait(300);
    assert.equal(await stage12(),2,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise12);
    await noOverflow();
    if(phone)await shot('step12-act-ready-mobile.png',true);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage12(),3);
    const s=await stored();
    assert.deepEqual([s.responses[12].MINIMUM,s.dayChanges[12]],['leave the office by 7pm.',promise12]);
    await ready('04-map-start.html');
    await go('step-checkin.html?step=13');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),promise12,'Step 13’s check-in grades Step 12’s promise');
   }
   // Step 13: THERE and MY MOVE read-only; MY HARD DAY (a date, tomorrow to a week ahead), THE SLIP POINT, MY TOOL
   // (minimum, or swap and line, showing the saved words), GETTING READY; no check. Step 14's check-in grades only
   // today's preparation.
   {
    const stage13=async()=>(await stored()).steps[13].stage;
    const day=new Date();day.setDate(day.getDate()+2);
    const iso=day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');
    const weekday=day.toLocaleDateString('en-GB',{weekday:'long'});
    const promise13='On '+weekday+', I will pause, say “Be all there tomorrow”, and read ten pages of my book. Today, I will set two alarms for that morning.';
    await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=13'});await ready('step13-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),4);
    await noOverflow();
    if(phone)await shot('step13-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step13-act.html');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','My move is saying no to extra evening work']);
    // Rows: the title first (level with the number), then the small line; read-only rows say FROM STEP NN.
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".row-body"),b=>Array.from(b.children).slice(0,2).map(c=>c.className.split(" ")[0]).join(">"))'),['question>from','question>from','question>eyebrow','question>eyebrow','question>eyebrow','question>eyebrow','promise-title>promise']);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".row-static .question"),q=>q.textContent)'),['WHERE I’M GOING','MY MOVE'],'First-person titles');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".row-static .from"),f=>f.textContent.trim())'),['FROM STEP 01','FROM STEP 03']);
    // Dots: read-only rows white with a gold number; the row being filled in black with a gold number.
    const dot=q=>evaluate('(()=>{const s=getComputedStyle(document.querySelector("'+q+' .node"));return [s.backgroundColor,s.color]})()');
    assert.deepEqual(await dot('.row-static'),['rgb(255, 255, 255)','rgb(137, 106, 0)'],'Read-only rows: white, gold number');
    assert.deepEqual(await dot('#rowOne'),['rgb(17, 17, 17)','rgb(224, 184, 76)'],'The row being filled in: black, gold number');
    const limits=await evaluate('[document.querySelector("#boxOne").min,document.querySelector("#boxOne").max]');
    const isoIn=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
    assert.deepEqual(limits,[isoIn(1),isoIn(7)],'The hard day: tomorrow to a week ahead');
    await evaluate('(()=>{const d=document.querySelector("#boxOne");d.value="'+iso+'";d.dispatchEvent(new Event("change"));})()');await wait(200);
    await click('#oneNext');await wait(300);assert.equal(await stage13(),1);
    await typeInto('#boxTwo','the morning after the work dinner');await pressEnter('#boxTwo');assert.equal(await stage13(),2);
    assert.equal(await evaluate('document.querySelector("#threeNext").disabled'),true,'A tool must be chosen');
    await click('[data-choice="minimum"]');await wait(200);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".choice-words p"),p=>p.textContent)'),['On a bad day, the least I will do is leave the office by 7pm.'],'The minimum shows its saved words');
    await click('[data-choice="swap"]');await wait(200);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".choice-words p"),p=>p.textContent)'),['Instead, I will read ten pages of my book','My line is “Be all there tomorrow.”'],'The swap shows the swap and the line');
    assert.equal(await evaluate('document.querySelector("[data-choice=swap]").getAttribute("aria-pressed")'),'true');
    await click('#threeNext');await wait(300);assert.equal(await stage13(),3);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true);
    await typeInto('#boxFour','set two alarms for that morning');await pressEnter('#boxFour');await wait(300);
    assert.equal(await stage13(),5,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise13);
    const promiseLook=await evaluate('(()=>{const p=getComputedStyle(document.querySelector("#promise")),w=getComputedStyle(document.querySelector("#promise .promise-rest"));return {font:p.fontFamily.includes("Neue Haas")&&p.fontWeight==="300",size:p.fontSize,style:p.fontStyle,fixed:p.color,words:w.color}})()');
    assert.deepEqual(promiseLook,{font:true,size:'17px',style:'normal',fixed:'rgb(100, 100, 97)',words:'rgb(17, 17, 17)'},'MY PROMISE in the body font: fixed words grey, the user’s words black');
    await noOverflow();
    if(phone)await shot('step13-act-ready-mobile.png',true);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage13(),6);
    const s=await stored();
    assert.deepEqual([s.responses[13].DATE,s.responses[13].SLIP,s.responses[13].TOOL,s.responses[13].READY,s.dayChanges[13]],[iso,'the morning after the work dinner','swap','set two alarms for that morning',promise13]);
    await ready('04-map-start.html');
    await go('step-checkin.html?step=14');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),'Today, I will set two alarms for that morning.','Step 14’s check-in grades only today’s preparation');
    await go('19-my-journey.html');await click('.entry[data-step="13"] .entry-head');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".entry[data-step=\\"13\\"] .entry-answer dt"),d=>d.textContent)'),['HARD DAY','SLIP POINT','TOOL','GETTING READY']);
   }
   // Step 14: THERE, MY MOVE and MY MINIMUM read-only, MY RECORD (every check-in so far), MY DECISION; MY NEW BAR
   // only when raising the bar. The Step 03 move is never changed. Committing completes Block 2.
   {
    const stage14=async()=>(await stored()).steps[14].stage;
    const promise14='Today, I will start my new bar: leaving the office by 6:30pm.';
    await go('step-checkin.html?step=14');await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    // The bottom fade against a video's own text ("RAISE THE BAR / Evidence / 01–04", 30 seconds in).
    if(phone){await click('#play');await wait(500);await evaluate('document.querySelector("#player").currentTime=30');await wait(1200);await click('#watch');await wait(600);await shot('step14-watch-fade-mobile.png');}
    await command('Page.navigate',{url:base+'/html/step-learn?step=14'});await ready('step14-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),4);
    await noOverflow();
    if(phone)await shot('step14-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step14-act.html');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','My move is saying no to extra evening work','On a bad day, the least I will do is leave the office by 7pm.']);
    const answers=(await stored()).answers;
    const record=await evaluate('Array.from(document.querySelectorAll(".record-line"),l=>[l.querySelector(".record-num").textContent,l.querySelector(".record-title").textContent,l.querySelector(".record-mark").className.replace("record-mark ",""),l.querySelector(".record-mark").textContent])');
    assert.equal(record.length,13,'One line per step, 01 to 13');
    assert.deepEqual(record.map(r=>r[2]),[1,2,3,4,5,6,7,8,9,10,11,12,13].map(d=>answers[d]),'Each line shows that step’s check-in');
    assert.deepEqual(record[0].slice(0,2),['01','Know Where You Are Going']);
    assert.equal(await evaluate('document.querySelector("#rowTwo").hidden'),true,'MY NEW BAR waits for RAISE THE BAR');
    // MAKE IT HOLD needs no box: straight to MY PROMISE with the Step 03 move.
    await click('[data-choice="hold"]');await wait(200);await click('#oneNext');await wait(300);
    assert.equal(await stage14(),3,'Holding goes straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),'Today, I will do my full move: saying no to extra evening work.');
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),false);
    // Changing to RAISE THE BAR goes back to the decision and opens MY NEW BAR.
    await click('[data-choice="raise"]');await wait(300);
    assert.equal(await stage14(),0);assert.equal(await evaluate('document.querySelector("#rowTwo").hidden'),false);
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),'Today, I will start my new bar: ….');
    await click('#oneNext');await wait(300);assert.equal(await stage14(),1);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true);
    await typeInto('#boxTwo','leaving the office by 6:30pm');await pressEnter('#boxTwo');await wait(300);
    assert.equal(await stage14(),3);
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise14);
    await noOverflow();
    if(phone)await shot('step14-act-ready-mobile.png',true);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage14(),4);
    const s=await stored();
    assert.deepEqual([s.responses[14].DECISION,s.responses[14].NEWBAR,s.dayChanges[14],s.responses[3].MOVE],['raise','leaving the office by 6:30pm',promise14,'saying no to extra evening work'],'The new bar is kept apart; the Step 03 move is never changed');
    await ready('04-map-start.html');await wait(400);
    // Block 2 is complete: its tile opens, black until its summary is seen.
    const b2=await evaluate('(()=>{const s=document.querySelectorAll(".block-spot")[1];return [s.classList.contains("open"),s.querySelector(".block-tile").className]})()');
    assert.ok(b2[0]&&/block-new/.test(b2[1]),'B2 opens once Step 14 is committed');
    await go('block.html?block=2');
    assert.equal(await evaluate('document.querySelector("#blockTitle").textContent'),'MAKE IT STICK');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".block-skill-name"),e=>e.textContent)'),['PATTERN','REPLACEMENT','REASON','ACCOUNTABILITY','MINIMUM','PREPARATION','PROGRESSION']);
    const promises=(await stored()).dayChanges;
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".block-promise"),c=>[c.children[0].textContent,c.children[1].textContent])'),[8,9,10,11,12,13,14].map(d=>['YOUR PROMISE · STEP '+steps.pad(d),promises[d]]));
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".block-bar-part"),p=>p.className)'),['block-bar-part is-done','block-bar-part is-done is-here','block-bar-part']);
    assert.equal(await text('#blockClosing'),'You’ve learned how to make it stick.');
    await noOverflow();
    if(phone)await shot('block2-summary-mobile.png',true);
    // From Step 15 on, MY MOVE is the current move: the new bar.
    await go('step-checkin.html?step=15');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),promise14,'Step 15’s check-in grades Step 14’s promise');
   }
   // Step 15: THERE, MY MOVE (now the current move: Step 14's new bar) and MY MINIMUM read-only; THE STORY I'D TELL,
   // MY RESTART RULE; no check; the same promise for everyone.
   {
    const stage15=async()=>(await stored()).steps[15].stage;
    const promise15='My restart rule is set. Today, I will do my move, or at least my minimum, if it’s due.';
    await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=15'});await ready('step15-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),4);
    await noOverflow();
    if(phone)await shot('step15-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step15-act.html');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','My move is leaving the office by 6:30pm','On a bad day, the least I will do is leave the office by 7pm.'],'MY MOVE is the current move: the new bar');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from-step]"),e=>e.textContent)'),['FROM STEP 01','FROM STEP 14','FROM STEP 12']);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true);
    await typeInto('#boxOne','“I’ve blown it, I’ll start again next week.”');await pressEnter('#boxOne');assert.equal(await stage15(),1);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true,'Both boxes first');
    await typeInto('#boxTwo','the next working day, leaving by 7pm');await pressEnter('#boxTwo');await wait(300);
    assert.equal(await stage15(),3,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise15);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),false);
    await noOverflow();
    if(phone)await shot('step15-act-ready-mobile.png',true);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage15(),4);
    const s=await stored();
    assert.deepEqual([s.responses[15].STORY,s.responses[15].RULE,s.dayChanges[15]],['“I’ve blown it, I’ll start again next week.”','the next working day, leaving by 7pm',promise15]);
    await ready('04-map-start.html');
    await go('step-checkin.html?step=16');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),promise15,'Step 16’s check-in grades Step 15’s promise');
    // My Journey: every step title on one line, 16px at most; long ones shrink to fit.
    await go('19-my-journey.html');
    const titles=await evaluate('Array.from(document.querySelectorAll(".entry-title"),t=>{const s=getComputedStyle(t),r=document.createRange();r.selectNodeContents(t);return {text:t.textContent,size:parseFloat(s.fontSize),lines:Math.round(t.getBoundingClientRect().height/parseFloat(s.lineHeight)),fits:r.getBoundingClientRect().width<=t.clientWidth+1}})');
    assert.equal(titles.length,16);
    for(const t of titles){assert.equal(t.lines,1,JSON.stringify(t));assert.ok(t.size<=16&&t.fits,JSON.stringify(t));}
    if(phone){console.log('phone: My Journey titles shrunk: '+titles.filter(t=>t.size<16).map(t=>t.text+' '+t.size+'px').join(', '));await evaluate('document.querySelector(".journey-scroll").scrollTop=0');await wait(200);await shot('my-journey-titles-mobile.png');}
    // My Mirror with a NO: MISSED counts it, and WORTH A SECOND LOOK shows the latest NO before any PARTLY.
    const setAnswers=changes=>evaluate('(()=>{const s=JSON.parse(localStorage.getItem("mirror21-progress"));Object.assign(s.answers,'+JSON.stringify(changes)+');localStorage.setItem("mirror21-progress",JSON.stringify(s));})()');
    const kept=(await stored()).answers;
    await setAnswers({6:'no',9:'no',12:'partly'});
    await go('18-my-mirror.html');
    const checkIns=Object.keys((await stored()).answers).length;
    assert.deepEqual(await ring(2),{value:'2',sub:'OF '+checkIns,caption:'MISSED',label:'2 missed of '+checkIns+' check-ins',stroke:'#646461'});
    const look=await secondLook();
    assert.deepEqual([look.tag,look.num,look.name,look.href],['MISSED','09','Break the Habit','step-watch.html?step=9'],'The latest NO comes first, even with a later PARTLY');
    if(phone){await evaluate('document.querySelector(".mirror-scroll").scrollTop=9999');await wait(200);await shot('my-mirror-second-look-mobile.png');}
    await click('.second-look-revisit');await ready('step-watch.html');
    assert.equal(await evaluate('new URLSearchParams(location.search).get("step")'),'9','REVISIT reopens that step from Watch');
    // Nothing missed or partly: a short line, no tag, no link.
    await setAnswers(Object.fromEntries(Object.keys(kept).map(d=>[d,'yes'])));
    await go('18-my-mirror.html');
    const clear=await secondLook();
    assert.deepEqual([clear.tag,clear.none,'href' in clear],['','Nothing missed so far. Keep going.',false]);
    await setAnswers(kept);
   }
   // Step 16: THERE and MY MOVE read-only, MY RECORD (Steps 01–15), MY COMMITMENTS (Steps 11 and 13: a day still to
   // come is NOT DUE YET, never a miss); WHAT'S WORKING, WHAT ISN'T YET; no check; the promise names Step 11's person.
   {
    const stage16=async()=>(await stored()).steps[16].stage;
    const promise16='Today, I’ll send Sam what I found.';
    await go('step-checkin.html?step=16');await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=16'});await ready('step16-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),4);
    await noOverflow();
    if(phone)await shot('step16-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step16-act.html');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from-step]"),e=>e.textContent)'),['FROM STEP 01','FROM STEP 14'],'MY MOVE is the current move');
    const answers=(await stored()).answers;
    const record=await evaluate('Array.from(document.querySelectorAll(".record-line"),l=>l.querySelector(".record-mark").className.replace("record-mark ",""))');
    assert.deepEqual(record,Array.from({length:15},(_,n)=>answers[n+1]||'none'),'One line per step, 01 to 15, with Step 15’s check-in');
    const commitments=()=>evaluate('Array.from(document.querySelectorAll(".commitment"),c=>[c.querySelector(".commitment-name").textContent,c.querySelector(".commitment-status").textContent,...Array.from(c.querySelectorAll(".mine-text"),t=>t.textContent)])');
    const r=(await stored()).responses;
    assert.deepEqual(await commitments(),[
     ['REPORT BACK','NOT DUE YET','I will report back on '+steps.plainDate(r[11].DATE)+'.'],
     ['MY HARD DAY','NOT DUE YET','My hard day is '+steps.plainDate(r[13].DATE)+'.','My tool is my swap and my line: “Be all there tomorrow”, and read ten pages of my book.']
    ]);
    // A day that has passed reads PASSED, with no verdict; today reads DUE TODAY.
    const isoIn=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
    const setDates=(d11,d13)=>evaluate('(()=>{const s=JSON.parse(localStorage.getItem("mirror21-progress"));s.responses[11].DATE="'+d11+'";s.responses[13].DATE="'+d13+'";localStorage.setItem("mirror21-progress",JSON.stringify(s));})()');
    await setDates(isoIn(-2),isoIn(0));await go('step16-act.html?step=16');
    assert.deepEqual((await commitments()).map(c=>c[1]),['PASSED','DUE TODAY']);
    await setDates(r[11].DATE,r[13].DATE);await go('step16-act.html?step=16');
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true);
    // "Nothing clear yet" is a valid answer.
    await typeInto('#boxOne','leaving on time on the days I plan it');await pressEnter('#boxOne');assert.equal(await stage16(),1);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true,'Both boxes first');
    await typeInto('#boxTwo','nothing clear yet');await pressEnter('#boxTwo');await wait(300);
    assert.equal(await stage16(),3,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise16);
    await noOverflow();
    if(phone)await shot('step16-act-ready-mobile.png',true);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage16(),4);
    const s=await stored();
    assert.deepEqual([s.responses[16].WORKING,s.responses[16].NOTYET,s.dayChanges[16]],['leaving on time on the days I plan it','nothing clear yet',promise16]);
    await ready('04-map-start.html');
    await go('step-checkin.html?step=17');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),promise16,'Step 17’s check-in grades Step 16’s promise');
    await go('19-my-journey.html');await click('.entry[data-step="16"] .entry-head');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".entry[data-step=\\"16\\"] .entry-answer dt"),d=>d.textContent)'),['WORKING','NOT YET']);
   }
   // Step 17: THERE, both Step 16 findings and the Step 15 story read-only; WHAT HAPPENED AROUND ME, WHAT I DID,
   // MY ACTION TODAY; no check; the promise is built from MY ACTION TODAY only, and only typed words are saved.
   {
    const stage17=async()=>(await stored()).steps[17].stage;
    const promise17='Today, I’ll leave the office at 6:30pm whatever is left on my desk.';
    await go('step-checkin.html?step=17');await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=17'});await ready('step17-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),4);
    await noOverflow();
    if(phone)await shot('step17-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step17-act.html');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','One thing that’s working is leaving on time on the days I plan it','One thing that isn’t working yet is nothing clear yet','If I miss, the story I’d tell myself is “I’ve blown it, I’ll start again next week.”']);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from-step]"),e=>e.textContent)'),['FROM STEP 01','FROM STEP 16','FROM STEP 15']);
    await typeInto('#boxOne','a late meeting on Tuesday');await pressEnter('#boxOne');assert.equal(await stage17(),1);
    await typeInto('#boxTwo','say yes to one more task at 6pm');await pressEnter('#boxTwo');assert.equal(await stage17(),2);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true,'All three boxes first');
    await typeInto('#boxThree','leave the office at 6:30pm whatever is left on my desk');await pressEnter('#boxThree');await wait(300);
    assert.equal(await stage17(),4,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise17);
    await noOverflow();
    if(phone)await shot('step17-act-ready-mobile.png',true);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage17(),5);
    const s=await stored();
    assert.deepEqual([s.responses[17].AROUND,s.responses[17].DID,s.responses[17].ACTION,s.dayChanges[17]],['a late meeting on Tuesday','say yes to one more task at 6pm','leave the office at 6:30pm whatever is left on my desk',promise17],'Only the typed words, never the starters');
    await ready('04-map-start.html');
    await go('step-checkin.html?step=18');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),promise17,'Step 18’s check-in grades MY ACTION TODAY only');
    await go('19-my-journey.html');await click('.entry[data-step="17"] .entry-head');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".entry[data-step=\\"17\\"] .entry-answer dt"),d=>d.textContent)'),['AROUND ME','WHAT I DID','MY ACTION']);
   }
   // Step 18: THERE, both Step 16 findings and Step 17's WHAT I DID and MY ACTION TODAY read-only; MY KEEP and MY STOP
   // asked as questions (no starter, "Nothing yet" is fine), MY START, MY FIRST STEP; no check; promise from MY FIRST STEP.
   {
    const stage18=async()=>(await stored()).steps[18].stage;
    const promise18='Today, I’ll put my 6:30pm finish in my calendar for every day next week.';
    await go('step-checkin.html?step=18');await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=18'});await ready('step18-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),4);
    await noOverflow();
    if(phone)await shot('step18-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step18-act.html');
    assert.deepEqual((await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)')).slice(1),['One thing that’s working is leaving on time on the days I plan it','One thing that isn’t working yet is nothing clear yet','What I did was say yes to one more task at 6pm','Because that part is mine, today I’ll leave the office at 6:30pm whatever is left on my desk']);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from-step]"),e=>e.textContent)'),['FROM STEP 01','FROM STEP 16','FROM STEP 17']);
    // A question box's example is the answer alone, with no starter in front.
    await click('#rowOne .example-toggle');await wait(200);
    assert.equal(await evaluate('document.querySelector("#rowOne .example-text").textContent'),'Using my minimum on hard mornings.');
    await typeInto('#boxOne','leaving on time on the days I plan it');await pressEnter('#boxOne');assert.equal(await stage18(),1);
    await typeInto('#boxTwo','Nothing yet');await pressEnter('#boxTwo');assert.equal(await stage18(),2,'“Nothing yet” is an honest answer');
    await typeInto('#boxThree','planning my finish time the day before');await pressEnter('#boxThree');assert.equal(await stage18(),3);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true,'MY FIRST STEP is required');
    await typeInto('#boxFour','put my 6:30pm finish in my calendar for every day next week');await pressEnter('#boxFour');await wait(300);
    assert.equal(await stage18(),5,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise18);
    await noOverflow();
    if(phone)await shot('step18-act-ready-mobile.png',true);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage18(),6);
    const s=await stored();
    assert.deepEqual([s.responses[18].KEEP,s.responses[18].STOP,s.responses[18].START,s.responses[18].FIRST,s.dayChanges[18]],['leaving on time on the days I plan it','Nothing yet','planning my finish time the day before','put my 6:30pm finish in my calendar for every day next week',promise18]);
    await go('19-my-journey.html');await click('.entry[data-step="18"] .entry-head');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".entry[data-step=\\"18\\"] .entry-answer"),r=>r.querySelector("dt").textContent+": "+r.querySelector("dd").textContent)'),['KEEP: leaving on time on the days I plan it','STOP: Nothing yet','START: I’ll start planning my finish time the day before','FIRST STEP: Today, to begin, I’ll put my 6:30pm finish in my calendar for every day next week']);
   }
   // Step 19: THERE and MY TOOLS (closed, read-only) above the Mirror Method card: SEE IT, OWN IT, MY MOVE (KEEP THIS
   // MOVE by default; UPDATE IT opens a box), MY TOOL (one of four, showing the saved words), TODAY'S ACTION; no check.
   // The promise is TODAY'S ACTION only; earlier moves are never overwritten.
   {
    const stage19=async()=>(await stored()).steps[19].stage;
    const promise19='Today, I’ll block 6–6:30pm in my calendar to wrap up.';
    const nodes=()=>evaluate('Array.from(document.querySelectorAll(".rows > .row:not([hidden]) .node:not(.node--lock)"),n=>n.textContent)');
    await go('step-checkin.html?step=19');await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=19'});await ready('step19-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),4);
    await noOverflow();
    if(phone)await shot('step19-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step19-act.html');
    assert.equal(await evaluate('document.querySelector("#tools").open'),false,'MY TOOLS starts closed');
    assert.equal(await evaluate('document.querySelectorAll("#tools .tool").length'),8);
    assert.equal(await evaluate('document.querySelector("#tools .tool [data-from=move]").textContent'),'My move is leaving the office by 6:30pm','MY TOOLS shows the current move');
    assert.deepEqual(await nodes(),['01','02','03','04','05','06','07']);
    await typeInto('#boxOne','most evenings I leave on time, but late meetings still pull me back');await pressEnter('#boxOne');assert.equal(await stage19(),1);
    await typeInto('#boxTwo','saying yes to tasks after 6pm');await pressEnter('#boxTwo');assert.equal(await stage19(),2);
    assert.equal(await evaluate('document.querySelector("[data-choice=keep]").getAttribute("aria-pressed")'),'true','KEEP THIS MOVE by default');
    assert.equal(await evaluate('document.querySelector(".tool-check").hidden'),true);
    // UPDATE IT opens a box; the rows after it number on, and MY TOOL asks whether it still fits.
    await click('[data-choice="update"]');await wait(200);
    assert.equal(await evaluate('document.querySelector("#rowFour").hidden'),false);
    assert.deepEqual(await nodes(),['01','02','03','04','05','06','07','08']);
    assert.equal(await evaluate('document.querySelector(".tool-check").hidden'),false,'Does this still fit your move?');
    await click('#threeNext');await wait(300);assert.equal(await stage19(),3);
    await typeInto('#boxFour','leaving the office by 6:30pm, four days a week');await pressEnter('#boxFour');await wait(300);assert.equal(await stage19(),4);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true,'A tool first');
    await click('[data-choice="minimum"]');await wait(200);
    assert.equal(await evaluate('document.querySelector("#rowFive .choice-words").textContent'),'On a bad day, the least I will do is leave the office by 7pm.','The chosen tool shows the saved words');
    await click('#fiveNext');await wait(300);assert.equal(await stage19(),5);
    await typeInto('#boxSix','block 6–6:30pm in my calendar to wrap up');await pressEnter('#boxSix');await wait(300);
    assert.equal(await stage19(),7,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise19,'The tool is on the card, not in the promise');
    await noOverflow();
    if(phone){await evaluate('document.querySelector("#tools").open=true');await wait(200);await shot('step19-act-ready-mobile.png',true);}
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage19(),8);
    const s=await stored(),c=s.responses[19];
    assert.deepEqual([c.SEE,c.OWN,c.MOVECHOICE,c.MOVE,c.TOOL,c.ACTION,s.dayChanges[19]],['most evenings I leave on time, but late meetings still pull me back','saying yes to tasks after 6pm','update','leaving the office by 6:30pm, four days a week','minimum','block 6–6:30pm in my calendar to wrap up',promise19]);
    assert.deepEqual([s.responses[3].MOVE,s.responses[14].NEWBAR],['saying no to extra evening work','leaving the office by 6:30pm'],'The original move and the new bar are never overwritten');
    await go('19-my-journey.html');await click('.entry[data-step="19"] .entry-head');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".entry[data-step=\\"19\\"] .entry-answer dt"),d=>d.textContent)'),['SEE IT','OWN IT','NEW MOVE','TOOL','ACTION']);
   }
   // Step 20: no worked example on Learn. Act: MY TOOLS (closed; MY MOVE is now Step 19's updated move), then a blank
   // card of five boxes: no starters, helper lines, examples or tool buttons. Promise from MY FIRST MOVE TODAY only.
   {
    const stage20=async()=>(await stored()).steps[20].stage;
    const promise20='Today, I’ll text my sister to pick a day for a walk.';
    await go('step-checkin.html?step=20');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),'Today, I’ll block 6–6:30pm in my calendar to wrap up.','Step 20’s check-in grades TODAY’S ACTION');
    await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=20'});await ready('step20-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),4);
    assert.deepEqual(await evaluate('[document.querySelectorAll(".learn-ex-row").length,document.querySelector(".learn-ex-none").textContent]'),[0,'No example this time. You know how this works.']);
    await noOverflow();
    if(phone)await shot('step20-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step20-act.html');
    assert.equal(await evaluate('document.querySelector("#tools").open'),false);
    assert.deepEqual(await evaluate('[document.querySelector("#tools .tool [data-from=move]").textContent,document.querySelector("#tools .tool [data-from-step]").textContent]'),['My move is leaving the office by 6:30pm, four days a week','FROM STEP 19'],'The current move is Step 19’s update');
    assert.deepEqual(await evaluate('[document.querySelectorAll(".starter").length,document.querySelectorAll(".row:not(.row-static) .prompt").length,document.querySelectorAll(".example-toggle").length,document.querySelectorAll("[data-choice]").length]'),[0,0,0,0],'A blank card');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".answer-box"),b=>b.value)'),['','','','',''],'Nothing pre-filled');
    const answers20=['walking twice a week','I walk about once a fortnight and want it twice a week','I let the evenings fill up before I plan a walk','my move is a Tuesday walk, and my tool is an anchor: straight after dinner','text my sister to pick a day for a walk'];
    for(let i=0;i<5;i++){
     assert.equal(await evaluate('document.querySelector("#hold").disabled'),true,'All five boxes first');
     const box=['#boxOne','#boxTwo','#boxThree','#boxFour','#boxFive'][i];
     await typeInto(box,answers20[i]);await pressEnter(box);await wait(300);
    }
    assert.equal(await stage20(),6,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise20);
    await noOverflow();
    if(phone){await evaluate('document.querySelector("#tools").open=true');await wait(200);await shot('step20-act-ready-mobile.png',true);}
    const before19=JSON.stringify((await stored()).responses[19]);
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage20(),7);
    const s=await stored(),c=s.responses[20];
    assert.deepEqual([c.NEWCHANGE,c.SEE,c.OWN,c.CHANGEIT,c.FIRST,s.dayChanges[20]],[...answers20,promise20]);
    assert.equal(JSON.stringify(s.responses[19]),before19,'The Step 19 card is kept apart');
    await go('19-my-journey.html');await click('.entry[data-step="20"] .entry-head');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".entry[data-step=\\"20\\"] .entry-answer dt"),d=>d.textContent)'),['NEW CHANGE','SEE IT','OWN IT','CHANGE IT','FIRST MOVE']);
   }
   // Step 21: THERE, MY SCORE SO FAR (Steps 01–20, no tier), MY HERE THEN read-only; MY HERE NOW; MY TWO CARDS with
   // their evening results; WHAT'S NEXT (nothing chosen for them); MY NEXT ACTION; no check. Then the final check on
   // My Path, and the result page.
   const scoreOf=(answers,upTo)=>{const v=Object.keys(answers).filter(d=>d<=upTo).map(d=>({yes:1,partly:.5,no:0})[answers[d]]);return Math.round(v.reduce((a,b)=>a+b,0)/v.length*1000)/10;};
   {
    const stage21=async()=>(await stored()).steps[21].stage;
    const promise21='Today, I’ll ask my manager to move Thursday’s late meeting.';
    await go('step-checkin.html?step=21');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),'Today, I’ll text my sister to pick a day for a walk.','Step 21’s check-in grades MY FIRST MOVE TODAY');
    await click('.choice[data-choice="yes"]');await wait(300);await click('#next');await ready('step-watch.html');
    await command('Page.navigate',{url:base+'/html/step-learn?step=21'});await ready('step21-learn.html');
    assert.equal(await evaluate('document.querySelectorAll(".move").length'),4);
    await noOverflow();
    if(phone)await shot('step21-learn-mobile.png',true);
    await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await wait(500);
    await click('#next');await ready('step21-act.html');
    const answers=(await stored()).answers;
    assert.equal(await evaluate('document.querySelector("#scoreSoFar").textContent'),scoreOf(answers,20)+'%','Score over Steps 01–20');
    assert.match(await evaluate('document.querySelector("[data-from=here]").textContent'),/^Right now, I /,'MY HERE THEN, from Step 01');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".method-card"),c=>[c.querySelector(".method-card-num").textContent,c.querySelector(".method-card-title").textContent,c.querySelector(".record-mark").className.replace("record-mark ",""),Boolean(c.querySelector(".method-card-chev")),c.open])'),[['19','My Mirror Method',answers[19],true,false],['20','My Mirror Method “New Change”',answers[20],true,false]],'Both cards, closed, as on the result page: number, name, evening result, arrow');
    await typeInto('#boxOne','leave on time most evenings and have two evenings a week to myself');await pressEnter('#boxOne');assert.equal(await stage21(),1);
    assert.equal(await evaluate('document.querySelector("#twoNext").disabled'),true,'WHAT’S NEXT is never chosen for them');
    await click('[data-choice="again"]');await wait(200);await click('#twoNext');await wait(300);assert.equal(await stage21(),2);
    assert.equal(await evaluate('document.querySelector("#hold").disabled'),true);
    await typeInto('#boxThree','ask my manager to move Thursday’s late meeting');await pressEnter('#boxThree');await wait(300);
    assert.equal(await stage21(),4,'No check: straight to MY PROMISE');
    assert.equal(await evaluate('document.querySelector("#promise").textContent'),promise21);
    await noOverflow();
    if(phone){await evaluate('document.querySelectorAll(".method-card").forEach(c=>c.open=true)');await wait(200);await shot('step21-act-ready-mobile.png',true);}
    await holdFor(1250);await ready('04-map-start.html');assert.equal(await stage21(),5);
    let s=await stored();
    assert.deepEqual([s.responses[21].HERENOW,s.responses[21].NEXT,s.responses[21].ACTION,s.dayChanges[21]],['leave on time most evenings and have two evenings a week to myself','again','ask my manager to move Thursday’s late meeting',promise21]);
    // Block 3 complete: its congratulations, with SEE MY RESULT (to the final check); a tap closes it.
    await wait(400);
    assert.deepEqual(await evaluate('[document.querySelector(".congrats-eyebrow")?.textContent,document.querySelector(".congrats-title")?.textContent,document.querySelector(".congrats-tile")?.textContent,new URL(document.querySelector(".congrats-tile").href).pathname.replace(/\\.html$/,"")]'),['BLOCK 3 COMPLETED','CONGRATULATIONS','SEE MY RESULT','/html/final-check']);
    if(phone)await shot('map-block3-congrats-mobile.png');
    await evaluate('document.querySelector(".congrats-back").click()');await wait(400);
    assert.equal(await evaluate('document.querySelector(".congrats-back")'),null,'A tap closes it');
    // My Path: Step 21 is a done step like the others (REDO STEP); My Results, below it, has the CHECK IN bubble
    // and its card leads to the final check.
    assert.equal(await evaluate('document.querySelector(".progress-row[data-day=\\"21\\"] .progress-bubble")'),null,'No bubble on Step 21');
    assert.equal(await evaluate('new URL(document.querySelector(".progress-row[data-day=\\"21\\"] .progress-step").href).pathname.replace(/\\.html$/,"")'),'/html/step-watch');
    await click('.progress-row[data-day="21"] .progress-step');await wait(300);
    assert.equal(await evaluate('document.querySelector(".day-popover-start .action-label").textContent'),'REDO STEP');
    await evaluate('document.body.click()');await wait(200);
    assert.deepEqual(await evaluate('[document.querySelector(".results-row .progress-bubble").textContent,document.querySelector(".results-tile").classList.contains("is-open")]'),['CHECK IN',true]);
    await click('.results-tile');await wait(300);
    assert.deepEqual(await evaluate('[document.querySelector("#map-day-card-title").textContent,document.querySelector(".day-popover-start .action-label").textContent]'),['My Results','FINAL CHECK']);
    // The last tile on the path: its card opens above the tile, not below it.
    assert.equal(await evaluate('(()=>{const c=document.querySelector("#map-day-card");return c.classList.contains("is-above")&&c.getBoundingClientRect().bottom<=document.querySelector(".results-tile").getBoundingClientRect().top})()'),true,'My Results’ card opens above it');
    if(phone)await shot('map-results-card-mobile.png');
    await click('.day-popover-start');await ready('final-check.html');
    assert.equal(await evaluate('document.querySelector("#commitText").textContent'),promise21);
    assert.equal(await evaluate('document.querySelector("#next").hidden'),true);
    await click('.choice[data-choice="partly"]');await wait(200);await click('.choice[data-choice="yes"]');await wait(200);
    assert.equal((await stored()).answers[21],'yes','The answer can change until SEE YOUR RESULT');
    if(phone)await shot('final-check-mobile.png');
    // SEE YOUR RESULT locks the check and opens the Block 3 summary; its one button leads to the result.
    await click('#next');await ready('block.html');
    s=await stored();
    assert.ok(s.finishedAt,'SEE YOUR RESULT locks the final check');
    assert.equal(await evaluate('document.querySelector("#blockTitle").textContent'),'MAKE IT YOURS');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".block-skill-name"),e=>e.textContent)'),['RESTART','HINDSIGHT','INSIGHT','FORESIGHT','METHOD','INDEPENDENCE','CLARITY']);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".block-promise-text"),e=>e.textContent)'),[15,16,17,18,19,20,21].map(d=>s.dayChanges[d]));
    assert.deepEqual(await evaluate('[document.querySelector("#blockClosing").textContent,document.querySelector("#blockNext").textContent,document.querySelectorAll(".btn").length,document.querySelector("#blockButton").textContent.trim()]'),['You’ve learned the method.','What you do with it starts with you.',1,'SEE MY RESULTS']);
    await noOverflow();
    if(phone)await shot('block3-summary-mobile.png',true);
    await click('#blockButton');await ready('result.html');
    const final=scoreOf(s.answers,21),tier=final>=90?'YOU OWN THIS':final>=75?'YOU’RE RENTING THIS':'RUN IT AGAIN';
    assert.deepEqual(await evaluate('[document.querySelector("#score").textContent,document.querySelector("#tierName").textContent]'),[final+'%',tier]);
    assert.equal(await evaluate('document.querySelector("#hereNow").textContent'),'Right now, I leave on time most evenings and have two evenings a week to myself');
    assert.match(await evaluate('document.querySelector("#hereThen").textContent'),/^Right now, I /);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("#cards .method-card"),c=>[c.querySelector(".method-card-num").textContent,c.querySelector(".method-card-title").textContent,c.querySelector(".record-mark").className.replace("record-mark ",""),Boolean(c.querySelector(".method-card-chev")),c.open])'),[['19','My Mirror Method',s.answers[19],true,false],['20','My Mirror Method “New Change”',s.answers[20],true,false]],'Both cards closed: number, name, evening result, arrow');
    assert.deepEqual(await evaluate('[document.querySelector("#runLabel").hidden,document.querySelector("#changeTitle").textContent,document.querySelector("#journeyTitle").textContent]'),[true,'WHERE YOU STARTED','YOUR JOURNEY IN YOUR WORDS']);
    assert.deepEqual(await evaluate('[Array.from(document.querySelectorAll(".result-line-num"),n=>n.textContent),Array.from(document.querySelectorAll(".result-heading"),h=>h.textContent).slice(0,3)]'),[['01','21','01'],['WHERE YOU STARTED','WHERE YOU ARE','WHERE YOU’RE GOING']]);
    assert.deepEqual(await evaluate('[document.querySelectorAll("#journey .result-step").length,document.querySelector(".result-journey").open]'),[21,false],'All 21 steps, closed');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("#journey .record-mark"),m=>m.className.replace("record-mark ",""))'),Array.from({length:21},(_,n)=>s.answers[n+1]));
    assert.deepEqual(await evaluate('[document.querySelector("#nextChoice").textContent,document.querySelector("#nextAction").textContent,document.querySelector("#newRun").hidden]'),['Run the steps again.','Today, I’ll ask my manager to move Thursday’s late meeting',false]);
    await noOverflow();
    if(phone){await evaluate('document.querySelectorAll("details").forEach(d=>d.open=true)');await wait(200);await shot('result-mobile.png',true);}
    // Back on the final check, the answer is locked; My Path shows RESULT and its Block 3 tile opens the summary.
    await go('final-check.html');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".choice"),b=>b.disabled)'),[false,true,true]);
    await go('04-map-start.html');await wait(400);
    // My Results: gold with a black flag (no score on the map), RESULT, and a card leading to the result page.
    assert.deepEqual(await evaluate('[document.querySelector(".results-row .progress-bubble").textContent,document.querySelector(".results-tile").textContent,document.querySelectorAll(".results-tile svg").length,document.querySelector(".results-tile").classList.contains("is-done")]'),['RESULT','',1,true]);
    await click('.results-tile');await wait(300);
    assert.equal(await evaluate('document.querySelector(".day-popover-start .action-label").textContent'),'SEE MY RESULTS');
    assert.equal(await evaluate('new URL(document.querySelector(".day-popover-start").href).pathname.replace(/\\.html$/,"")'),'/html/result');
    if(phone)await shot('map-results-done-mobile.png');
    await evaluate('document.body.click()');await wait(200);
    assert.deepEqual(await evaluate('(()=>{const s=document.querySelectorAll(".block-spot")[2];const t=s.querySelector(".block-tile");return [s.classList.contains("open"),new URL(t.href).pathname.replace(/\\.html$/,"")+new URL(t.href).search,t.classList.contains("committed")]})()'),[true,'/html/block?block=3',true],'Open, and already seen');
   }
   await go('step-checkin.html?step=6');
   assert.equal(await evaluate('document.querySelector("#commitText").textContent'),'Today, when I’m about to open my work email after dinner, I will pause and close the laptop. If it doesn’t come, I’ll run through it once in my head.','Step 06’s check-in grades Step 05’s whole promise');
   await go('19-my-journey.html');await click('.entry[data-step="5"] .entry-head');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".entry[data-step=\\"5\\"] .entry-answer"),r=>r.querySelector("dt").textContent+": "+r.querySelector("dd").textContent)'),['MOMENT: When I’m about to open my work email after dinner.','RESPONSE: I will pause and close the laptop','READY: Yes, I’ll know the moment when it comes.']);

   // Long titles shrink to stay on one line: open each step as the current one.
   if(phone){
    const sizes=[];
    for(const step of [4,6,17,20]){
     await evaluate('(()=>{const s=JSON.parse(localStorage.getItem("mirror21-progress"));for(let d=1;d<'+step+';d++)s.lessons[d]=true;s.steps['+step+']={checkedIn:true};localStorage.setItem("mirror21-progress",JSON.stringify(s));})()');
     if(step>18)break;
     await go('step-watch.html?step='+step);fit=await titleFits();
     assert.equal(fit.lines,1,JSON.stringify(fit));assert.ok(fit.width<=fit.available+1,JSON.stringify(fit));sizes.push(fit.text+' '+fit.size+'px');
    }
    console.log('phone: long titles '+sizes.join(', '));
   }

   // RUN THE STEPS AGAIN: START A NEW RUN keeps the finished run and its result (mirror21-runs) and starts at Step 01;
   // Settings › Account › My past results opens it again.
   {
    await go('result.html');
    const before=await evaluate('document.querySelector("#score").textContent');
    await evaluate('window.confirm=()=>true');await click('#newRun');await ready('04-map-start.html');
    assert.equal(await evaluate('document.querySelector(".progress-step.current").textContent'),'01','A new run starts at Step 01');
    assert.equal(await evaluate('JSON.parse(localStorage.getItem("mirror21-runs")).length'),1,'The finished run is kept');
    await click('.settings-gear');await wait(400);
    await evaluate('Array.from(document.querySelectorAll(".settings-row")).find(r=>r.textContent.includes("Account")).click()');await wait(350);
    assert.equal(await evaluate('Array.from(document.querySelectorAll(".settings-row")).find(r=>r.textContent.includes("My past results")).querySelector(".settings-sub").textContent'),'Your finished run');
    await evaluate('Array.from(document.querySelectorAll(".settings-row")).find(r=>r.textContent.includes("My past results")).click()');await ready('result.html');
    assert.deepEqual(await evaluate('[document.querySelector("#runLabel").textContent,document.querySelector("#score").textContent,document.querySelector("#newRun").hidden]'),['RUN 1',before,true]);
    // A new run has no result yet: the page sends you back to My Path.
    await command('Page.navigate',{url:base+'/html/result.html'});await ready('04-map-start.html');
   }
   // Settings › Start over: clears answers, check-ins and the Welcome video, keeps settings, then opens My Path at Step 01.
   await go('18-my-mirror.html');await evaluate('localStorage.setItem("mirror21-watched-0","true");localStorage.setItem("mirror21-captions","false")');
   await click('.settings-gear');await wait(400);
   await evaluate('Array.from(document.querySelectorAll(".settings-row")).find(r=>r.textContent.includes("Start over")).click()');await wait(450);
   await evaluate('Array.from(document.querySelectorAll(".sheet .settings-btn")).find(b=>b.textContent.includes("START OVER")).click()');await ready('04-map-start.html');
   assert.equal(await evaluate('localStorage.getItem("mirror21-captions")'),'false','Start over keeps settings');
   assert.equal(await evaluate('document.querySelector(".progress-step.current").textContent'),'01');
   assert.equal(await evaluate('Object.keys(JSON.parse(localStorage.getItem("mirror21-progress")).lessons).length'),0);
   assert.equal(await evaluate('localStorage.getItem("mirror21-watched-0")'),null);
   assert.equal(await evaluate('document.querySelectorAll(".app-frame > div[style*=\\"top: 59px\\"] > div p")[2].textContent'),'21 steps to go');
   if(phone)await shot('my-path-gear-mobile.png');   const beforeWelcome=await evaluate('localStorage.getItem("mirror21-progress")');
   await go('step-watch.html?step=0');assert.equal(await evaluate('localStorage.getItem("mirror21-progress")'),beforeWelcome,'Welcome must leave existing course progress untouched');
   await command('Page.navigate',{url:base+'/html/restart-session'});await ready('step-watch.html');
   assert.equal(await evaluate('localStorage.getItem("mirror21-progress")'),null);
   await go('04-map-start.html');assert.equal(await evaluate('document.querySelector(".progress-step.current").textContent'),'01');
   // Settings › Account › Sign out: this device is signed out and back on Sign in; its course stays.
   await command('Page.removeScriptToEvaluateOnNewDocument',{identifier:keepSignedIn});
   const course=await evaluate('localStorage.getItem("mirror21-progress")');
   await click('.settings-gear');await wait(400);
   await evaluate('Array.from(document.querySelectorAll(".settings-row")).find(r=>r.textContent.includes("Account")).click()');await wait(350);
   await evaluate('Array.from(document.querySelectorAll(".settings-row")).find(r=>r.textContent.includes("Sign out")).click()');await ready('02-sign-in.html');
   await until(async()=>!(await evaluate('MirrorAuth.signedIn()')),'signing out');
   assert.deepEqual([await screenNow(),await evaluate('location.search')],['emailScreen',''],'Sign in, with ?signout dropped from the address');
   assert.equal(await evaluate('localStorage.getItem("mirror21-progress")'),course,'Signing out keeps this phone’s course');
   await command('Page.navigate',{url:base+'/html/04-map-start'});await ready('02-sign-in.html');
   await evaluate('localStorage.clear()');
   console.log(label+': Sign in, Welcome, Watch, Learn, Act, commit, Step 02 unlock, check-in colour, restart and sign out passed');
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
 }finally{socket?.close();browser.kill();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
