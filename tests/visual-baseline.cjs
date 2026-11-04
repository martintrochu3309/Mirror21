// The no-visual-change guard for restructuring work. Chrome must be installed.
//   node tests/visual-baseline.cjs capture <dir>      every screen and state, on phone, iPad and desktop
//   node tests/visual-baseline.cjs capture <dir> ipad one size only (run the three side by side to go faster)
//   node tests/visual-baseline.cjs compare <dirA> <dirB>
// Each capture saves a screenshot (plus the whole page when it scrolls), the page as rendered (every element,
// attribute and text, comments left out) and what the app saved. Compare reports any pixel, element or saved
// value that differs. The clock is fixed (4 November 2026, 9:30) so dates read the same on every run;
// animations are stopped at a fixed point before each screenshot.
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const fsSync=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const zlib=require('node:zlib');
const root=path.resolve(__dirname,'..');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const SIZES=[['phone',390,844,2,true],['ipad',820,1180,1,true],['desktop',1440,900,1,false]];
const BASE=new Date(2026,10,4,9,30,0);
const pad=n=>String(n).padStart(2,'0');
const day=(offset,hour=21)=>{const d=new Date(BASE);d.setDate(d.getDate()+offset);d.setHours(hour,0,0,0);return d;};
const iso=offset=>{const d=day(offset);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};

// ---------- Saved progress for each state ----------
// Every step's answers, in the words of the Learn pages' example (Step 01 saves whole sentences).
const ANSWERS={
 1:{HERE:'Right now, I spend most nights on my phone in bed and wake up tired.',THERE:'I want to be able to wake up properly rested and ready for the day.',STEP:'Today I will put my phone on charge across the room.'},
 2:{ACTION:'put my phone outside the bedroom by 10pm.'},
 3:{MOVE:'getting up at the same time every day.',ACTION:'set a 6:30am alarm for every day this week, weekends included.'},
 4:{WAY:'hitting snooze.',ACTION:'put my alarm across the room so I have to get up to turn it off.'},
 5:{MOMENT:'I’m about to start another episode.',RESPONSE:'switch the TV off.'},
 6:{EASY:'the TV remote lives on my bedside table.',CHANGE:'put the TV remote in the living room and a book on my pillow.'},
 7:{ANCHOR:'brush my teeth at night.',ACTION:'put my phone on charge in the kitchen and read my book in bed.'},
 8:{WHEN:'I’m on the sofa at about 10pm and the day’s done.',WHAT:'scroll for 45 minutes, which is why getting up at 6:30 is a fight.',PAYOFF:'a way to switch off from the day.'},
 9:{SWAP:'pick up my book.'},
 10:{WHY:'I’m tired of only being half there.',LINE:'“Be all there tomorrow.”'},
 11:{PERSON:'Sam, a friend I trust.',DATE:iso(3)},
 12:{MINIMUM:'get my feet on the floor at 6:30, even if I’m slow after that.'},
 13:{DATE:iso(-2),SLIP:'Friday at 6:30, when the alarm goes after a late night.',TOOL:'swap',READY:'put “Friday 6:30, feet on the floor” in my calendar and set Friday’s alarm now.'},
 14:{DECISION:'raise',NEWBAR:'being dressed and ready to start my morning by 6:40.'},
 15:{STORY:'“I’ve blown it this week, I’ll start again on Monday.”',RULE:'the next morning with feet on the floor at 6:30.'},
 16:{WORKING:'using my minimum when I need it.',NOTYET:'doing my full move after late nights.'},
 17:{AROUND:'the night ran late at my friend’s birthday.',DID:'stay for another hour after saying I’d leave at 11.',ACTION:'set a 10:45 “time to go” alarm for Saturday’s dinner.'},
 18:{KEEP:'Using my minimum on hard mornings.',STOP:'Staying out past the time I said I’d leave.',START:'telling Sam my leaving time before a late night.',FIRST:'message Sam my leaving time for Saturday’s dinner.'},
 19:{SEE:'weekday mornings are holding, and mornings after late nights still slip.',OWN:'getting up on weekdays, which is working, and staying out past my leaving time.',MOVECHOICE:'update',MOVE:'getting up at 6:30 every day.',TOOL:'anchor',ACTION:'put my phone on charge in the kitchen tonight, straight after I brush my teeth.'},
 20:{NEWCHANGE:'Walking more during the week.',SEE:'I walk about once a fortnight.',OWN:'I let the car win on short trips.',CHANGEIT:'A Tuesday and Thursday walk to work.',FIRST:'Lay out my walking shoes tonight.'},
 21:{HERENOW:'get up at 6:30 most weekdays and wake up rested. Late nights still knock me back.',NEXT:'again',ACTION:'put my leaving time for Friday’s dinner in my calendar.'}
};
const GRADES=d=>d%5===0?'no':d%3===0?'partly':'yes';
// How many answer boxes each Act page asks (its MY PROMISE stage comes right after them).
const BOXES={1:5,2:2,3:2,4:2,5:2,6:2,7:2,8:3,9:1,10:2,11:2,12:1,13:4,14:2,15:2,16:2,17:3,18:4,19:6,20:5,21:3};
const promiseOf=d=>d===1?'Today, I will put my phone on charge across the room.':'Today, I will keep the promise I wrote for Step '+pad(d)+', one small move at a time.';
// steps 1..done committed; graded ones checked in. `current`: the open step and where it stands.
function course({done=0,graded=done,current=null,finished=false,runs=null,extra}={}){
 const now=BASE.getTime(),s={version:1,startedAt:day(-30).getTime(),updatedAt:now,answers:{},lessons:{},steps:{},dayChanges:{},responses:{},change:''};
 for(let d=1;d<=done;d++){
  s.lessons[d]=true;s.dayChanges[d]=promiseOf(d);s.change=s.dayChanges[d];s.responses[d]={...ANSWERS[d]};
  s.steps[d]={screen:'act',reached:2,watch:1,watched:true,learn:1,stage:BOXES[d]+2,notSure:false,checkedIn:d>=2,act:1,committedAt:day(d-done-1).toISOString()};
  if(d<=graded)s.answers[d]=GRADES(d);
 }
 if(current){
  const {step,screen='act',stage=0,fill=false,watch=0}=current;
  const checked=screen!=='checkin';
  s.steps[step]={screen,reached:screen==='act'?2:screen==='learn'?1:0,watch:checked&&screen!=='watch'?1:watch,watched:checked&&screen!=='watch',learn:screen==='act'?1:0,stage,notSure:false,checkedIn:step>=2&&checked};
  if(screen==='act'&&step>=2)s.steps[step].act=stage===0?0.1:0.85;
  if(fill)s.responses[step]={...ANSWERS[step]};
 }
 if(finished){s.answers[21]=GRADES(21);s.finishedAt=now;}
 if(extra)extra(s);
 const local={'mirror21-progress':JSON.stringify(s),'mirror21-seen-0':'true'};
 if(runs)local['mirror21-runs']=JSON.stringify(runs);
 return local;
}
const finishedCourse=(next='again')=>course({done:21,finished:true,extra:s=>{s.responses[21].NEXT=next;}});

// ---------- Every screen and state ----------
const S=[];
const add=(name,url,local,opts={})=>S.push({name,url,local,...opts});
// Opening pages and an empty course.
add('start','00-start.html',{});
add('sign-in','02-sign-in.html',{});
add('offer','01-offer.html',{});
add('map-fresh','04-map-start.html',{});
add('map-welcome-seen','04-map-start.html',{'mirror21-seen-0':'true'});
add('welcome-watch','step-watch.html?step=0',{});
add('mirror-fresh','18-my-mirror.html',{});
add('journey-fresh','19-my-journey.html',{});
add('restart-session','restart-session.html',course({done:4}),{expect:'step-watch.html'});
// Step 01, from the start.
add('step01-watch-start','step-watch.html?step=1',{'mirror21-seen-0':'true'});
add('step01-learn','step-learn.html?step=1',course({current:{step:1,screen:'learn'}}));
add('step01-act-start','step-act.html?step=1',course({current:{step:1,screen:'act',stage:0}}));
add('step01-act-promise','step-act.html?step=1',course({current:{step:1,screen:'act',stage:5,fill:true}}));
add('step01-act-committed','step-act.html?step=1',course({done:1,graded:0,current:{step:2,screen:'checkin'}}));
// Steps 02–21: the check-in, Learn, Act at the start, Act ready to commit, Act committed.
for(let n=2;n<=21;n++){
 const nn=pad(n);
 add('step'+nn+'-checkin','step-checkin.html?step='+n,course({done:n-1,graded:n-2,current:{step:n,screen:'checkin'}}));
 add('step'+nn+'-learn','step'+nn+'-learn.html?step='+n,course({done:n-1,current:{step:n,screen:'learn'}}));
 add('step'+nn+'-act-start','step'+nn+'-act.html?step='+n,course({done:n-1,current:{step:n,screen:'act',stage:0}}));
 add('step'+nn+'-act-promise','step'+nn+'-act.html?step='+n,course({done:n-1,current:{step:n,screen:'act',stage:BOXES[n]+1,fill:true}}));
 add('step'+nn+'-act-committed','step'+nn+'-act.html?step='+n,course({done:n,graded:n-1,current:n<21?{step:n+1,screen:'checkin'}:null}));
}
// Variants of the steps whose screens change with a choice.
add('step13-act-minimum','step13-act.html?step=13',course({done:12,current:{step:13,screen:'act',stage:5,fill:true},extra:s=>{s.responses[13].TOOL='minimum';}}));
add('step14-act-hold','step14-act.html?step=14',course({done:13,current:{step:14,screen:'act',stage:3,fill:true},extra:s=>{s.responses[14].DECISION='hold';delete s.responses[14].NEWBAR;}}));
add('step19-act-keep','step19-act.html?step=19',course({done:18,current:{step:19,screen:'act',stage:7,fill:true},extra:s=>{s.responses[19].MOVECHOICE='keep';delete s.responses[19].MOVE;}}));
add('step21-act-keep','step21-act.html?step=21',course({done:20,current:{step:21,screen:'act',stage:4,fill:true},extra:s=>{s.responses[21].NEXT='keep';}}));
add('step16-act-due-today','step16-act.html?step=16',course({done:15,current:{step:16,screen:'act',stage:0},extra:s=>{s.responses[11].DATE=iso(0);s.responses[13].DATE=iso(5);s.responses[13].TOOL='minimum';}}));
// Watch: a step to resume, a step already watched (opens at Finish).
add('step09-watch-resume','step-watch.html?step=9',course({done:8,current:{step:9,screen:'watch',watch:0.4},extra:s=>{s.steps[9].checkedIn=true;}}));
add('step05-watch-finish','step-watch.html?step=5',course({done:9,current:{step:10,screen:'checkin'}}));
add('step21-watch-start','step-watch.html?step=21',course({done:20,current:{step:21,screen:'watch'},extra:s=>{s.steps[21].checkedIn=true;}}));
// My Path, My Mirror, My Journey and Settings, part way through.
const mid=course({done:9,graded:8,current:{step:10,screen:'checkin'}});
add('map-mid','04-map-start.html',mid);
add('map-mid-card-current','04-map-start.html',mid,{act:'click .progress-row[data-day="10"] .progress-step'});
add('map-mid-card-done','04-map-start.html',mid,{act:'click .progress-row[data-day="3"] .progress-step'});
add('map-mid-card-welcome','04-map-start.html',mid,{act:'click .welcome-step'});
add('map-mid-locked-note','04-map-start.html',mid,{act:'click .progress-row[data-day="15"] .progress-step'});
add('map-mid-block-note','04-map-start.html',mid,{act:'click .block-spot[data-after="14"] .block-tile'});
add('map-block1-seen','04-map-start.html',{...mid,'mirror21-block-1':'true'});
add('mirror-mid','18-my-mirror.html',mid);
add('journey-mid','19-my-journey.html',mid);
add('settings-mid','04-map-start.html',mid,{act:'click .settings-gear'});
add('reminder-mid','04-map-start.html',{...mid,'mirror21-reminder':'07:15'},{act:'click a[href="#reminder"]'});
add('mirror-settings','18-my-mirror.html',mid,{act:'click .settings-gear'});
add('journey-open-entry','19-my-journey.html',mid,{act:'click .entry[data-step="2"] .entry-head'});
// Blocks, the final check, the result.
add('block1','block.html?block=1',course({done:7,graded:6,current:{step:8,screen:'checkin'}}));
add('block2','block.html?block=2',course({done:14,graded:13,current:{step:15,screen:'checkin'}}));
add('block3','block.html?block=3',finishedCourse());
add('block3-too-early','block.html?block=3',course({done:21,graded:20}),{expect:'final-check.html'});
add('map-step21-committed','04-map-start.html',course({done:21,graded:20}));
add('map-step21-card','04-map-start.html',course({done:21,graded:20}),{act:'click .progress-row[data-day="21"] .progress-step'});
add('final-check','final-check.html',course({done:21,graded:20}));
add('final-check-answered','final-check.html',course({done:21,graded:20,extra:s=>{s.answers[21]='partly';}}));
add('map-finished','04-map-start.html',finishedCourse());
add('map-finished-card','04-map-start.html',finishedCourse(),{act:'click .progress-row[data-day="21"] .progress-step'});
// My Results, below Step 21: locked, then the final check, then the result.
add('map-results-locked','04-map-start.html',mid,{act:'click .results-tile'});
add('map-results-card','04-map-start.html',course({done:21,graded:20}),{act:'click .results-tile'});
add('map-results-done-card','04-map-start.html',finishedCourse(),{act:'click .results-tile'});
add('mirror-finished','18-my-mirror.html',finishedCourse());
add('journey-finished','19-my-journey.html',finishedCourse());
add('result-again','result.html',finishedCourse('again'));
add('result-keep','result.html',finishedCourse('keep'));
add('result-new','result.html',finishedCourse('new'),{act:'click .result-journey-toggle'});
add('result-cards-open','result.html',finishedCourse(),{act:'click .method-card-head'});
const past={endedAt:day(-40).getTime(),progress:JSON.parse(finishedCourse()['mirror21-progress'])};
add('result-run1','result.html?run=1',{...finishedCourse(),'mirror21-runs':JSON.stringify([past])});
add('result-runs-list','result.html',{...finishedCourse('keep'),'mirror21-runs':JSON.stringify([past])});
add('settings-past-runs','04-map-start.html',{...course({current:{step:1,screen:'watch'}}),'mirror21-runs':JSON.stringify([past])},{act:'click .settings-gear'});
// Guard rails: a step that isn't open yet goes back to My Path.
add('locked-step-redirect','step05-act.html?step=5',course({done:2,current:{step:3,screen:'checkin'}}),{expect:'04-map-start.html'});

// ---------- Interactions: what each one saves ----------
const flows=[
 {name:'flow-checkin',url:'step-checkin.html?step=10',local:mid,steps:[['click','[data-choice="partly"]'],['shot','checkin-picked'],['click','#next'],['await','step-watch.html']]},
 {name:'flow-act03',url:'step03-act.html?step=3',local:course({done:2,current:{step:3,screen:'act',stage:0}}),steps:[
  ['type','#boxOne','getting up at the same time every day'],['click','#oneNext'],['shot','box-two'],['type','#boxTwo','set a 6:30 alarm'],['click','#twoNext'],['shot','proof'],['click','#proofYes'],['shot','promise'],['enter','#hold'],['await','04-map-start.html']]},
 {name:'flow-act01',url:'step-act.html?step=1',local:course({current:{step:1,screen:'act',stage:0}}),steps:[
  ['click','[data-action="here"]'],['type','#a-here','spend my nights on my phone'],['enter','#a-here'],['type','#a-there','wake up rested'],['enter','#a-there'],['click','[data-action="notsure"]'],['shot','not-sure'],['enter','#a-there'],['click','[data-action="yes"]'],['type','#a-step','charge my phone in the kitchen'],['enter','#a-step'],['shot','ready'],['enter','#hold'],['await','04-map-start.html']]},
 {name:'flow-act02',url:'step02-act.html?step=2',local:course({done:1,current:{step:2,screen:'act',stage:0}}),steps:[
  ['type','#action','leave my phone in the kitchen'],['click','#next'],['click','#proofNotSure'],['shot','not-sure'],['click','#next'],['click','#proofYes'],['enter','#hold'],['await','04-map-start.html']]},
 {name:'flow-act14',url:'step14-act.html?step=14',local:course({done:13,current:{step:14,screen:'act',stage:0}}),steps:[
  ['click','[data-choice="raise"]'],['click','#rowOne .next'],['type','[data-answer="NEWBAR"]','dressed by 6:40'],['shot','newbar'],['click','[data-choice="hold"]'],['shot','back-to-choice'],['click','[data-choice="raise"]'],['click','#rowOne .next'],['enter','[data-answer="NEWBAR"]'],['shot','promise']]},
 {name:'flow-learn04',url:'step04-learn.html?step=4',local:course({done:3,current:{step:4,screen:'learn'}}),steps:[['scroll'],['shot','bottom'],['click','#next'],['await','step04-act.html']]},
 {name:'flow-welcome',url:'step-watch.html?step=0',local:{},steps:[['click','#next'],['await','04-map-start.html']]},
 {name:'flow-map-start',url:'04-map-start.html',local:mid,steps:[['click','.progress-row[data-day="10"] .progress-step'],['click','.day-popover-start'],['await','step-checkin.html']]},
 {name:'flow-map-watch',url:'04-map-start.html',local:mid,steps:[['click','.progress-row[data-day="4"] .progress-step'],['click','.day-popover-start'],['await','step-watch.html']]},
 {name:'flow-final',url:'final-check.html',local:course({done:21,graded:20}),steps:[['click','[data-choice="yes"]'],['click','#next'],['await','block.html'],['click','#blockButton'],['await','result.html']]},
 {name:'flow-new-run',url:'result.html',local:finishedCourse('again'),steps:[['scroll'],['click','#newRun'],['await','04-map-start.html']]},
 {name:'flow-settings',url:'04-map-start.html',local:{...mid,'mirror21-reminder':'07:15','mirror21-runs':JSON.stringify([past])},steps:[
  ['click','.settings-gear'],['shot','list'],['clickText','.settings-row','Help'],['shot','help'],['click','.help-q[aria-controls="help-a-3"]'],['shot','help-other-question'],['click','.settings-back'],
  ['clickText','.settings-row','Account'],['shot','account'],['click','.settings-back'],['clickText','.settings-row','Daily reminder'],['shot','reminder'],['clickText','.sheet-link','Turn reminders off'],['shot','reminder-off'],
  ['clickText','.settings-row','Start over'],['shot','start-over'],['clickText','.sheet .settings-btn','CANCEL'],['shot','cancelled']]},
 {name:'flow-start-over',url:'04-map-start.html',local:{...mid,'mirror21-reminder':'07:15','mirror21-block-1':'true'},steps:[['click','.settings-gear'],['clickText','.settings-row','Start over'],['clickText','.sheet .settings-btn','START OVER'],['await','04-map-start.html']]},
 {name:'flow-reminder',url:'04-map-start.html',local:mid,steps:[['click','a[href="#reminder"]'],['shot','sheet'],['clickText','.sheet .settings-btn','SAVE'],['shot','saved']]}
];

// ---------- Browser ----------
function serve(){
 // Like Netlify: .html is dropped from paths and from anchors in served HTML.
 const server=http.createServer(async(req,res)=>{try{
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/__blank'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>blank</title>');return;}
  if(pathname.endsWith('/'))pathname+='index.html';else if(!path.extname(pathname))pathname+='.html';
  const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.webmanifest':'application/manifest+json'};
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  let contents=await fs.readFile(file);
  if(path.extname(file)==='.html')contents=Buffer.from(contents.toString().replace(/href="([^"]+)\.html([^"]*)"/g,'href="$1$2"'));
  if(/\.mp4$/.test(file)&&req.headers.range){const m=/bytes=(\d+)-(\d*)/.exec(req.headers.range);if(m){const first=Number(m[1]),last=m[2]?Math.min(Number(m[2]),contents.length-1):contents.length-1;res.writeHead(206,{'Content-Range':'bytes '+first+'-'+last+'/'+contents.length,'Accept-Ranges':'bytes','Content-Length':last-first+1});res.end(contents.subarray(first,last+1));return;}}
  res.setHeader('Accept-Ranges','bytes');res.end(contents);
 }catch{res.writeHead(404).end();}});
 return new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server)));
}
// The fixed clock: 4 November 2026, 9:30, moving on from there as the page runs.
const CLOCK=`(()=>{const Real=Date,base=new Real(2026,10,4,9,30,0).getTime(),t0=performance.now();const now=()=>base+Math.floor(performance.now()-t0);
class Fixed extends Real{constructor(...a){a.length?super(...a):super(now());}static now(){return now();}}Fixed.parse=Real.parse;Fixed.UTC=Real.UTC;globalThis.Date=Fixed;})();`;
// The page as rendered: every element with its attributes in order, text with runs of spaces made one,
// form values; comments left out. Script and stylesheet tags are listed apart, since the restructuring moves them.
const SNAPSHOT=`(()=>{const out=[];const esc=s=>s.replace(/\\s+/g,' ');
function walk(n,depth){if(n.nodeType===3){const t=esc(n.data);if(t.trim())out.push('  '.repeat(depth)+JSON.stringify(t.trim()));return;}
 if(n.nodeType!==1)return;const tag=n.tagName.toLowerCase();if(tag==='script'||(tag==='link'&&n.rel==='stylesheet'))return;
 const attrs=Array.from(n.attributes).map(a=>a.name+'='+JSON.stringify(a.value)).sort();
 if(tag==='textarea'||tag==='input')attrs.push('@value='+JSON.stringify(n.value));if(tag==='details')attrs.push('@open='+n.open);if(tag==='dialog')attrs.push('@open='+n.open);
 out.push('  '.repeat(depth)+'<'+tag+(attrs.length?' '+attrs.join(' '):'')+'>');
 for(const c of n.childNodes)walk(c,depth+1);if(n.shadowRoot)for(const c of n.shadowRoot.childNodes)walk(c,depth+1);}
walk(document.documentElement,0);
const styles=Array.from(document.querySelectorAll('link[rel=stylesheet]'),l=>new URL(l.href).pathname);
const scripts=Array.from(document.querySelectorAll('script'),s=>s.src?new URL(s.src).pathname:'inline:'+s.textContent.length);
return {page:location.pathname+location.search,title:document.title,styles,scripts,dom:out.join('\\n'),scroll:[scrollX,scrollY,...Array.from(document.querySelectorAll('.map-scroll,.mirror-scroll'),e=>e.scrollTop)]};})()`;
// Every screen but the first page, Sign in and the Offer needs someone signed in (assets/core/auth.js); left out of the saved data.
const SIGNED_IN=JSON.stringify({access_token:'test',refresh_token:'test',expires_at:4102444800,user:{email:'buyer@example.com'}});
const STORAGE=`(()=>{const dump=s=>Object.fromEntries(Array.from({length:s.length},(_,i)=>s.key(i)).filter(k=>k!=='sb-mirror21-auth').sort().map(k=>[k,s.getItem(k)]));return {local:dump(localStorage),session:dump(sessionStorage)};})()`;
// Stops every animation at a fixed point: running ones finished, endless ones at their start.
const FREEZE=`(async()=>{for(const a of document.getAnimations()){try{const t=a.effect&&a.effect.getComputedTiming();if(t&&t.iterations===Infinity){a.pause();a.currentTime=0;}else a.finish();}catch{}}
 const s=document.createElement('style');s.id='__visual';s.textContent='*,*::before,*::after{caret-color:transparent!important}';document.head.append(s);
 await Promise.all(Array.from(document.images,i=>i.complete?0:i.decode().catch(()=>0)));
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true;})()`;

async function browser(){
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror21-visual-'));
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--in-process-gpu','--no-first-run','--hide-scrollbars','--font-render-hinting=none','--force-color-profile=srgb','--autoplay-policy=user-gesture-required','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let port;for(let i=0;i<100;i++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{}await wait(100);}
 if(!port)throw Error('Chrome did not start');
 const targets=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
 const socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
 let id=0;const pending=new Map(),errors=[];
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);
  if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
  else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
  else if(m.method==='Page.javascriptDialogOpening')command('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});});
 const command=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>reject(Error('CDP timeout '+method)),20000);pending.set(n,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await command('Page.enable');await command('Runtime.enable');
 await command('Page.addScriptToEvaluateOnNewDocument',{source:CLOCK});
 return {command,evaluate,errors,close:()=>{try{socket.close();}catch{}chrome.kill();}};
}

async function capture(dir,only){
 if(only&&!SIZES.some(([label])=>label===only))throw Error('No size called '+only);
 const server=await serve(),base='http://127.0.0.1:'+server.address().port;
 const b=await browser();const {command,evaluate}=b;
 const at=name=>evaluate('location.pathname').then(p=>p.replace(/\.html$/,'')==='/html/'+name.replace('.html','')).catch(()=>false);
 const settled=async(expected)=>{
  for(let i=0;i<200;i++){const ok=await evaluate('document.readyState==="complete"&&document.documentElement.dataset.mirrorReady==="true"').catch(()=>false);if(ok&&(!expected||await at(expected)))break;await wait(50);}
  await evaluate('document.fonts.ready.then(()=>true)').catch(()=>{});
  // On My Path, the unlock moment skips to its end (a tap), so every capture shows the settled path.
  await evaluate('(()=>{const u=document.documentElement.dataset.unlock;if(u==="waiting"||u==="playing")(document.body.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true})),document.body.dispatchEvent(new MouseEvent("click",{bubbles:true})));return true})()').catch(()=>{});
  await wait(900);
 };
 const open=async(url,local,expected)=>{
  await command('Page.navigate',{url:base+'/__blank'});await wait(150);
  if(!/^0[012]-/.test(url))local={'sb-mirror21-auth':SIGNED_IN,...local};
  await evaluate('localStorage.clear();sessionStorage.clear();'+Object.entries(local).map(([k,v])=>'localStorage.setItem('+JSON.stringify(k)+','+JSON.stringify(v)+');').join(''));
  await command('Page.navigate',{url:base+'/html/'+url.replace('.html','')});
  await settled(expected||url.split('?')[0]);
 };
 const snap=async(file,full)=>{
  await evaluate(FREEZE);
  const shot=await command('Page.captureScreenshot',{format:'png'});await fs.writeFile(file+'.png',Buffer.from(shot.data,'base64'));
  if(full){const h=await evaluate('document.documentElement.scrollHeight'),w=await evaluate('innerWidth'),vh=await evaluate('innerHeight');
   if(h>vh+1){const s=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:w,height:h,scale:1}});await fs.writeFile(file+'.full.png',Buffer.from(s.data,'base64'));}}
  await fs.writeFile(file+'.page.json',JSON.stringify(await evaluate(SNAPSHOT),null,1));
  await fs.writeFile(file+'.storage.json',JSON.stringify(await evaluate(STORAGE),null,1));
  await evaluate('document.getElementById("__visual")?.remove()');
 };
 const sel=s=>JSON.stringify(s);
 const doStep=async([kind,a,c])=>{
  if(kind==='click')await evaluate('document.querySelector('+sel(a)+').click()');
  if(kind==='clickText')await evaluate('Array.from(document.querySelectorAll('+sel(a)+')).find(e=>e.textContent.includes('+sel(c)+')).click()');
  if(kind==='type')await evaluate('(()=>{const b=document.querySelector('+sel(a)+');b.focus();b.value='+sel(c)+';b.dispatchEvent(new Event("input",{bubbles:true}));b.dispatchEvent(new Event("change",{bubbles:true}));})()');
  if(kind==='enter'){await evaluate('document.querySelector('+sel(a)+').focus()');await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});}
  if(kind==='scroll')await evaluate('scrollTo(0,document.documentElement.scrollHeight)');
  await wait(kind==='await'?0:450);
 };
 const failures=[];let count=0;
 for(const [label,width,height,scale,mobile] of SIZES.filter(([label])=>!only||label===only)){
  await fs.mkdir(path.join(dir,label),{recursive:true});
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:scale,mobile});
  for(const s of S){
   b.errors.length=0;
   try{
    await open(s.url,s.local,s.expect);
    if(s.act){await doStep(s.act.split(/ (.+)/).slice(0,2));await wait(500);}
    await snap(path.join(dir,label,s.name),true);count++;
    if(b.errors.length)failures.push(label+' '+s.name+': '+b.errors.join(' | '));
   }catch(e){failures.push(label+' '+s.name+': '+e.message);}
  }
  for(const f of flows){
   b.errors.length=0;
   try{
    await open(f.url,f.local);let n=0;
    for(const step of f.steps){
     if(step[0]==='shot'){await snap(path.join(dir,label,f.name+'-'+(++n)+'-'+step[1]),false);continue;}
     if(step[0]==='await'){await settled(step[1]);continue;}
     await doStep(step);
    }
    await snap(path.join(dir,label,f.name+'-end'),false);count++;
    if(b.errors.length)failures.push(label+' '+f.name+': '+b.errors.join(' | '));
   }catch(e){failures.push(label+' '+f.name+': '+e.message);}
  }
  console.log(label+': captured');
 }
 b.close();server.close();
 await fs.writeFile(path.join(dir,'failures'+(only?'-'+only:'')+'.txt'),failures.join('\n'));
 console.log(count+' captures in '+dir+(failures.length?'\nPROBLEMS:\n  '+failures.join('\n  '):''));
}

// ---------- Compare ----------
// Minimal PNG reader (8-bit RGB/RGBA, as Chrome writes them).
function readPng(buf){
 let i=8,w,h,type,idat=[];
 while(i<buf.length){const len=buf.readUInt32BE(i),kind=buf.toString('ascii',i+4,i+8),data=buf.subarray(i+8,i+8+len);
  if(kind==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);type=data[9];}if(kind==='IDAT')idat.push(data);if(kind==='IEND')break;i+=12+len;}
 const ch=type===6?4:3,raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*ch,px=Buffer.alloc(w*h*4);let prev=Buffer.alloc(stride);
 for(let y=0;y<h;y++){const f=raw[y*(stride+1)],line=Buffer.from(raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)));
  for(let x=0;x<stride;x++){const a=x>=ch?line[x-ch]:0,b=prev[x],c=x>=ch?prev[x-ch]:0;
   line[x]=(line[x]+(f===1?a:f===2?b:f===3?(a+b)>>1:f===4?(()=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;})():0))&255;}
  for(let x=0;x<w;x++){px[(y*w+x)*4]=line[x*ch];px[(y*w+x)*4+1]=line[x*ch+1];px[(y*w+x)*4+2]=line[x*ch+2];px[(y*w+x)*4+3]=ch===4?line[x*ch+3]:255;}
  prev=line;}
 return {w,h,px};
}
function writePng(w,h,px){
 const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 const crc=b=>{let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
 const chunk=(kind,data)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const body=Buffer.concat([Buffer.from(kind),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(body));return Buffer.concat([len,body,c]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
 const raw=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)px.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
// Times change from run to run (the clock moves on while a page runs): compared as placeholders.
// So are the test server's port (in full link addresses) and an empty style="" (left by measuring a title before
// or after the fonts load: nothing on screen).
const steady=text=>text.replace(/\b1[789]\d{11}\b/g,'<ms>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<iso>')
 .replace(/127\.0\.0\.1:\d+/g,'<server>').replace(/ style=\\?"\\?"/g,'');
async function compare(a,b){
 const out=path.join(b,'_diff');await fs.mkdir(out,{recursive:true});
 const problems=[],notes=[];let checked=0;
 for(const [label] of SIZES){
  const files=(await fs.readdir(path.join(a,label))).sort();
  for(const file of files){
   const fa=path.join(a,label,file),fb=path.join(b,label,file);
   if(!fsSync.existsSync(fb)){problems.push(label+'/'+file+': missing in the new capture');continue;}
   checked++;
   if(file.endsWith('.png')){
    const [x,y]=[await fs.readFile(fa),await fs.readFile(fb)];if(x.equals(y))continue;
    const pa=readPng(x),pb=readPng(y);
    if(pa.w!==pb.w||pa.h!==pb.h){problems.push(label+'/'+file+': size '+pa.w+'×'+pa.h+' → '+pb.w+'×'+pb.h);continue;}
    let diff=0;const img=Buffer.from(pb.px);
    for(let p=0;p<pa.px.length;p+=4){if(pa.px[p]!==pb.px[p]||pa.px[p+1]!==pb.px[p+1]||pa.px[p+2]!==pb.px[p+2]){diff++;img[p]=255;img[p+1]=0;img[p+2]=0;img[p+3]=255;}else img[p+3]=60;}
    if(diff){problems.push(label+'/'+file+': '+diff+' pixels differ');await fs.writeFile(path.join(out,label+'-'+file),writePng(pb.w,pb.h,img));}
   } else if(file.endsWith('.page.json')){
    const [x,y]=[JSON.parse(await fs.readFile(fa,'utf8')),JSON.parse(await fs.readFile(fb,'utf8'))];
    for(const key of ['page','title','dom','styles','scroll']){
     const [vx,vy]=[steady(JSON.stringify(x[key])),steady(JSON.stringify(y[key]))];
     if(vx!==vy){
      if(key==='dom'){const lx=x.dom.split('\n'),ly=y.dom.split('\n');const k=lx.findIndex((l,i)=>steady(l)!==steady(ly[i]||''));problems.push(label+'/'+file+': page differs at line '+(k+1)+'\n      was: '+(lx[k]||'').trim().slice(0,220)+'\n      now: '+(ly[k]||'').trim().slice(0,220));}
      else problems.push(label+'/'+file+': '+key+' '+vx.slice(0,200)+' → '+vy.slice(0,200));
     }
    }
    if(JSON.stringify(x.scripts)!==JSON.stringify(y.scripts))notes.push(label+'/'+file);
   } else if(file.endsWith('.storage.json')){
    const [x,y]=[steady(await fs.readFile(fa,'utf8')),steady(await fs.readFile(fb,'utf8'))];
    if(x!==y)problems.push(label+'/'+file+': saved data differs');
   }
  }
 }
 console.log(checked+' files compared.'+(notes.length?' Script tags changed on '+notes.length+' pages (expected while restructuring).':''));
 if(problems.length){console.log('DIFFERENCES ('+problems.length+'):\n  '+problems.join('\n  ')+'\nDiff images: '+out);process.exitCode=1;}
 else console.log('No differences: every screenshot, page and saved value matches.');
}

const [mode,a,b]=process.argv.slice(2);
if(mode==='capture'&&a)capture(path.resolve(a),b).catch(e=>{console.error(e);process.exit(1);});
else if(mode==='compare'&&a&&b)compare(path.resolve(a),path.resolve(b)).catch(e=>{console.error(e);process.exit(1);});
else console.log('Usage: node tests/visual-baseline.cjs capture <dir> | compare <dirA> <dirB>');
