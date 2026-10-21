// Run with node tests/browser-smoke.cjs (Chrome must be installed).
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
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
  const barParts=()=>evaluate('document.querySelectorAll("#stepBar > span").length');
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
   const r=await evaluate('(()=>{const b=document.querySelector("#hold").getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}})()');
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
   await command('Page.navigate',{url:base+'/'});await ready('01-offer.html');await evaluate('localStorage.clear()');
   assert.equal(await evaluate('document.fonts.check("italic 700 22px Magistral")'),true);
   // Opens as a full-screen app from the Home Screen: manifest, Apple tags and icon on every page.
   const app=await evaluate('(async()=>{const m=document.querySelector("link[rel=manifest]"),i=document.querySelector("link[rel=apple-touch-icon]");const manifest=await (await fetch(m.href)).json();const icon=await fetch(i.href);return {display:manifest.display,name:manifest.name,capable:document.querySelector("meta[name=apple-mobile-web-app-capable]")?.content,bar:document.querySelector("meta[name=apple-mobile-web-app-status-bar-style]")?.content,title:document.querySelector("meta[name=apple-mobile-web-app-title]")?.content,icon:icon.ok}})()');
   assert.deepEqual(app,{display:'standalone',name:'Mirror 21',capable:'yes',bar:'default',title:'Mirror 21',icon:true});

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
   assert.equal(await evaluate('document.querySelectorAll(".progress-step").length'),21);
   assert.equal(await evaluate('document.querySelectorAll(".journey-segment").length'),20);
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
   // Mid: the title, meta line and bar fade after 2 seconds; tapping anywhere pauses.
   await click('#play');assert.equal(await watchState(),'playing');
   await wait(2600);
   assert.equal(await evaluate('document.querySelector("#watch").classList.contains("immersed")'),true);
   assert.equal(await evaluate('document.querySelector("#player").paused'),false,'The video plays in the page');
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".soon")).opacity'),'0','No COMING SOON with a real video');assert.equal(await shows('.end'),false,'No Learn button during playback');
   if(phone)await shot('step-watch-playing-mobile.png');
   await click('#watch');assert.equal(await watchState(),'paused');
   assert.equal(await evaluate('document.querySelector("#watch").classList.contains("immersed")'),false,'Pausing brings the title back');
   assert.equal(await shows('.end'),false);
   if(phone)await shot('step-watch-paused-mobile.png');
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
   // Jump to the last second (the test only: the screen has no scrubbing) and let it end.
   await evaluate('(()=>{const v=document.querySelector("#player");v.currentTime=v.duration-1;})()');
   await until(async()=>await watchState()==='finish','Finish');await wait(700);
   assert.equal(await text('.meta'),'STEP 01 OF 21 · WATCHED ✓');
   assert.equal(await text('#next'),'LEARN','Just LEARN, no arrow');
   assert.equal(await evaluate('getComputedStyle(document.querySelector("#next")).backgroundImage.includes("gradient")'),true,'Same gold as YOUR TURN');
   assert.equal(await evaluate('getComputedStyle(document.querySelector("#next")).color'),'rgb(16, 16, 16)');
   assert.equal(await evaluate('new URL(document.querySelector("#still").src).pathname'),'/assets/images/step01-finish.jpg','Finish shows the video’s last frame');
   assert.equal(await shows('.end'),true);
   assert.equal(await barValue(),33);
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
   // Answers persist: leaving and coming back restores the exact state.
   await go('step-act.html?step=1');
   assert.equal(await evaluate('document.querySelector(".row[data-k=\\"2\\"]").classList.contains("is-active")'),true);
   assert.equal(await here(),'say yes to every request and finish each week drained.');
   assert.equal(await evaluate('document.querySelector("#a-there").value'),'');
   if(phone)await shot('step-act-there-mobile.png',true);
   await typeInto('#a-there','have two evenings a week that are truly mine.');
   await click('[data-next="there"]');await wait(300);assert.equal(await stage(),3);
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
   await holdFor(1250);await wait(300);
   assert.equal(await stage(),6,'Holding for a second commits');
   assert.equal(await evaluate('document.querySelector("#done").hidden'),false);
   assert.equal(await evaluate('document.querySelector("#doneText").textContent'),'Step 02 is open. It starts by asking how your step went.');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".answer-box"),b=>b.readOnly)'),[true,true,true],'The promise is locked for good');
   assert.equal(await barValue(),100);
   let saved=await stored();
   assert.equal(saved.lessons[1],true);assert.equal(saved.dayChanges[1],'Today, I will say no to one request this week, kindly and clearly.');
   assert.equal(saved.responses[1].HERE,'Right now, I say yes to every request and finish each week drained.');
   assert.deepEqual(Object.keys(saved.answers),[]);
   await noOverflow();
   if(phone)await shot('step-act-done-mobile.png');

   // Committing returns to the map by itself: Step 01 committed (plain white, no ring), Step 02 open straight away.
   await ready('04-map-start.html');
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
   await holdFor(1250);await wait(300);
   assert.equal(await stage2(),3);
   assert.equal(await evaluate('document.querySelector("#lockedBlock").hidden'),false);
   assert.equal(await evaluate('document.querySelector("#lockedText").textContent'),'Your promise is locked. Step 03 starts by asking how it went.');
   assert.equal(await evaluate('document.querySelector("#action").readOnly'),true);
   saved=await stored();
   assert.equal(saved.lessons[2],true);assert.equal(saved.responses[2].ACTION,'leave my laptop at work tonight');
   assert.equal(saved.dayChanges[2],'Today, I will leave my laptop at work tonight.');
   if(phone)await shot('step02-act-committed-mobile.png');
   await ready('04-map-start.html');
   assert.equal(await evaluate('document.querySelector(".progress-step.current").textContent'),'03');
   assert.equal(await evaluate('document.querySelectorAll(".app-frame > div[style*=\\"top: 59px\\"] > div p")[2].textContent'),'19 steps to go','My Path header counts steps, not days');
   // Step 03's check-in grades that exact promise; Step 03 itself uses Step 01's lesson.
   await go('step-checkin.html?step=3');
   assert.equal(await evaluate('document.querySelector("#commitText").textContent'),'Today, I will leave my laptop at work tonight.');

   await go('18-my-mirror.html');
   assert.equal(await evaluate('document.querySelector(".days-so-far > div > p:last-child").textContent'),'1 OF 21');
   assert.equal(await evaluate('document.querySelectorAll(".day-row, h2").length'),0,'No MY STEPS list on My Mirror');
   const ring3=await evaluate('(()=>{const s=document.querySelectorAll("[aria-label=\\"Where I stand\\"] svg")[2];return {value:s.querySelector("text").textContent,sub:s.querySelectorAll("text")[1].textContent,caption:s.parentElement.querySelector("span").textContent,label:s.getAttribute("aria-label")}})()');
   assert.deepEqual(ring3,{value:'19',sub:'STEPS',caption:'TO GO',label:'19 steps to go'});
   assert.equal(await evaluate('document.querySelector("[aria-label=\\"Where I stand\\"] svg text").textContent'),'50%','One PARTLY = 50%');
   assert.equal(await evaluate('document.querySelector("[aria-label=\\"Where I stand\\"] > div:last-child").textContent.replace(/\\s+/g," ").trim()'),'WEEK 1 SEE IT');
   if(phone)await shot('my-mirror-mobile.png');
   // Demo reset gear: top right of My Path, My Mirror and My Journey; confirms, then clears this device's steps.
   for(const page of ['04-map-start.html','18-my-mirror.html','19-my-journey.html']){await go(page);assert.equal(await evaluate('document.querySelectorAll(".demo-reset").length'),1,page);}
   const gearBox=await evaluate('(()=>{const r=document.querySelector(".demo-reset").getBoundingClientRect(),f=document.querySelector(".app-frame").getBoundingClientRect();return {right:f.right-r.right,top:r.top-f.top,width:r.width}})()');
   assert.ok(gearBox.top<20&&gearBox.right<20&&gearBox.width<=32,JSON.stringify(gearBox));
   await evaluate('window.confirm=()=>false');await click('.demo-reset');await wait(300);
   assert.ok(await evaluate('localStorage.getItem("mirror21-progress")!==null'),'Cancel keeps everything');
   assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("nav a"),a=>a.textContent.trim())'),['MY PATH','MY MIRROR','MY JOURNEY']);

   // My Journey: committed steps in your own words, read-only, then today's step.
   await click('nav a[href*="my-journey"]');await ready('19-my-journey.html');
   const journey=()=>evaluate('Array.from(document.querySelectorAll(".entry"),e=>({step:e.dataset.step,dot:e.querySelector(".entry-dot").className.replace("entry-dot ",""),label:e.querySelector(".entry-dot").getAttribute("aria-label"),open:e.classList.contains("is-open"),line:e.querySelector(".entry-line")?.className||null}))');
   let entries=await journey();
   assert.deepEqual(entries.map(e=>e.step+':'+e.dot+':'+(e.open?'open':'closed')),['1:partly:open','2:committed:closed','3:today:closed'],JSON.stringify(entries));
   assert.equal(entries[0].label,'Step 01, partly kept');
   assert.equal(await evaluate('document.querySelector(".journey-week").textContent'),'WEEK 1 · SEE IT');
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

   // The gear's reset: clears answers, check-ins and the Welcome video, then opens My Path at Step 01.
   await go('18-my-mirror.html');await evaluate('localStorage.setItem("mirror21-watched-0","true");window.confirm=()=>true');
   await click('.demo-reset');await ready('04-map-start.html');
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
