// Run with node tests/browser-smoke.cjs (Chrome must be installed).
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const steps=require('../assets/steps.js');
const root=path.resolve(__dirname,'..');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await fs.mkdir(path.join(root,'screens'),{recursive:true});
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
  const errors=[];socket.addEventListener('message',event=>{const r=JSON.parse(event.data);if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails);});
  const ready=async expected=>{for(let i=0;i<100;i++){if(await evaluate('location.pathname.replace(/\\.html$/, "") === '+JSON.stringify('/html/'+expected.replace('.html',''))+' && document.documentElement?.dataset.mirrorReady === "true"')){await evaluate('document.fonts.ready.then(()=>true)');await wait(700);return;}await wait(50);}throw Error('Page not ready: '+expected+' (at '+await evaluate('location.href')+') '+JSON.stringify(errors.map(e=>e.exception?.description||e.text)));};
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
   const s=await command('Page.captureScreenshot',options);await fs.writeFile(path.join(root,'screens',name),Buffer.from(s.data,'base64'));
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
   await command('Page.navigate',{url:base+'/'});await ready('02-sign-in.html');await evaluate('localStorage.clear()');
   assert.equal(await evaluate('document.fonts.check("italic 700 22px Magistral")'),true);
   // Opens as a full-screen app from the Home Screen: manifest, Apple tags and icon on every page.
   const app=await evaluate('(async()=>{const m=document.querySelector("link[rel=manifest]"),i=document.querySelector("link[rel=apple-touch-icon]");const manifest=await (await fetch(m.href)).json();const icon=await fetch(i.href);return {display:manifest.display,name:manifest.name,capable:document.querySelector("meta[name=apple-mobile-web-app-capable]")?.content,bar:document.querySelector("meta[name=apple-mobile-web-app-status-bar-style]")?.content,title:document.querySelector("meta[name=apple-mobile-web-app-title]")?.content,icon:icon.ok}})()');
   assert.deepEqual(app,{display:'standalone',name:'Mirror 21',capable:'yes',bar:'default',title:'Mirror 21',icon:true});
   // The app opens on Sign in (the Offer is hidden), MIRROR 21 at the top left. Blank fields still sign in › My Path.
   assert.equal(await evaluate('document.querySelector(".wordmark").textContent'),'MIRROR 21');
   assert.equal(await evaluate('document.querySelector("h1").textContent'),'SIGN IN.');
   await click('[data-mode="email"]');
   assert.deepEqual(await evaluate('[document.querySelector("[data-for=phone]").hidden,document.querySelector("[data-for=email]").hidden]'),[true,false]);
   if(phone)await shot('sign-in-mobile.png');
   await click('.go');await ready('04-map-start.html');
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
   assert.equal(await evaluate('document.querySelectorAll(".progress-row .progress-step").length'),21);
   assert.equal(await evaluate('document.querySelectorAll(".block-spot .block-tile").length'),3,'One block tile per block');
   assert.equal(await evaluate('document.querySelectorAll(".journey-segment").length'),23,'20 between steps, 3 out to the block tiles');
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
   assert.equal(await text('#next'),'LEARN','Just LEARN, no arrow');
   assert.equal(await evaluate('getComputedStyle(document.querySelector("#next")).backgroundImage.includes("gradient")'),true,'The app’s gold, as I’M COMMITTED');
   assert.equal(await evaluate('getComputedStyle(document.querySelector("#next")).color'),'rgb(16, 16, 16)');
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
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".settings h3"),h=>h.textContent)'),['YOUR COURSE','HELP','ABOUT','YOUR DATA'],'No reminders or video sections');
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".settings")).overflowY'),'auto','Settings scrolls when it needs to');
   if(phone)await shot('settings-mobile.png');
   const settingRow=text=>'Array.from(document.querySelectorAll(".settings-row")).find(r=>r.textContent.includes('+JSON.stringify(text)+'))';
   await evaluate('window.confirm=()=>false');await evaluate(settingRow('Start over')+'.click()');await wait(300);
   assert.ok(await evaluate('localStorage.getItem("mirror21-progress")!==null'),'Cancel keeps everything');
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
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".learn-ex-fixed")).color'),'rgb(138, 138, 134)','Fixed promise words in light grey');
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".learn-ex-text")).color'),'rgb(100, 100, 97)','Each move’s example words in the moves’ grey');
   const exPanel=await evaluate('(()=>{const p=document.querySelector(".learn-ex").getBoundingClientRect();return {left:Math.round(p.left),right:Math.round(innerWidth-p.right),bg:getComputedStyle(document.querySelector(".learn-ex")).backgroundColor}})()');
   if(phone)assert.deepEqual(exPanel,{left:0,right:0,bg:'rgb(247, 247, 245)'},'A full-width grey panel');
   assert.equal(await evaluate('getComputedStyle(document.querySelector("#next")).backgroundColor'),'rgb(17, 17, 17)','YOUR TURN is black');
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
   await twoBoxStep(4,{from:'Saying no to extra evening work',first:'I scroll my phone when I get home',second:'leave my phone in the car until 7pm',promise:'Today, I will leave my phone in the car until 7pm.',keys:['WAY','ACTION'],notSureBack:1});
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
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','Saying no to extra evening work'],'Step 07 shows THERE and MY MOVE');
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
    assert.equal(await evaluate('document.querySelector("[data-from]").textContent'),'Saying no to extra evening work');
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
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','Saying no to extra evening work','My line is “Be all there tomorrow.”']);
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
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','Saying no to extra evening work']);
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
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','Saying no to extra evening work']);
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
    const promiseLook=await evaluate('(()=>{const p=getComputedStyle(document.querySelector("#promise")),w=getComputedStyle(document.querySelector("#promise .promise-rest"));return {font:p.fontFamily.includes("Neue Haas"),size:p.fontSize,style:p.fontStyle,fixed:p.color,words:w.color}})()');
    assert.deepEqual(promiseLook,{font:true,size:'20px',style:'normal',fixed:'rgb(138, 138, 134)',words:'rgb(17, 17, 17)'},'MY PROMISE in the body font: fixed words grey, the user’s words black');
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
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','Saying no to extra evening work','On a bad day, the least I will do is leave the office by 7pm.']);
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
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-from]"),e=>e.textContent)'),['I want to be able to have two evenings a week that are truly mine.','Leaving the office by 6:30pm','On a bad day, the least I will do is leave the office by 7pm.'],'MY MOVE is the current move: the new bar');
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

   // Settings › Start over: clears answers, check-ins and the Welcome video, keeps settings, then opens My Path at Step 01.
   await go('18-my-mirror.html');await evaluate('localStorage.setItem("mirror21-watched-0","true");localStorage.setItem("mirror21-captions","false");window.confirm=()=>true');
   await click('.settings-gear');await wait(400);
   await evaluate('Array.from(document.querySelectorAll(".settings-row")).find(r=>r.textContent.includes("Start over")).click()');await ready('04-map-start.html');
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
   console.log(label+': Welcome, Watch, Learn, Act, commit, Step 02 unlock, check-in colour and restart passed');
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
 }finally{socket?.close();browser.kill();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
