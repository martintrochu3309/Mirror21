const {test}=require('node:test');
const assert=require('node:assert/strict');
const steps=require('../assets/steps.js');
test('all 21 step titles plus Welcome are listed in order',()=>{
 assert.equal(steps.titles.length,22);
 assert.equal(steps.title(0),'Welcome to Mirror 21');
 assert.equal(steps.title(1),'Know Where You Are Going');
 assert.equal(steps.title(7),'Link It to Your Day');
 assert.equal(steps.title(14),'Raise the Bar');
 assert.equal(steps.title(21),'See What Changed');
 assert.equal(steps.headline(1),'KNOW WHERE YOU ARE GOING.');
 assert.equal(steps.headline(18),'KEEP, STOP, START.');
});
test('Every Act text box in Steps 01–21 has a "See an example" answer; Step 11’s date and Step 20’s blank card have none',()=>{
 const fs=require('node:fs'),path=require('node:path'),dir=path.join(__dirname,'../html');
 for(const file of fs.readdirSync(dir).filter(f=>/^step(\d\d)?-?act\.html$/.test(f))){
  const step=file==='step-act.html'?1:Number(file.slice(4,6));
  const html=fs.readFileSync(path.join(dir,file),'utf8');
  const keys=Array.from(html.matchAll(/<textarea[^>]*>/g),([tag])=>(tag.match(/data-answer="([^"]+)"/)||tag.match(/data-field="([^"]+)"/)||tag.match(/id="([^"]+)"/))[1].toUpperCase());
  assert.ok(keys.length,file);
  // Step 20's card is blank on purpose: no starters, no examples.
  if(step===20){assert.deepEqual(keys,['NEWCHANGE','SEE','OWN','CHANGEIT','FIRST']);for(const key of keys)assert.equal(steps.example(step,key),'',key);assert.ok(!/class="starter"/.test(html),'No starters on the blank card');continue;}
  for(const key of keys)assert.ok(steps.example(step,key),file+' '+key);
 }
 assert.equal(steps.example(11,'DATE'),'');
 assert.equal(steps.example(7,'ANCHOR'),'brush my teeth at night.');
 assert.equal(steps.example(16,'NOTYET'),'doing my full move after late nights.');
 assert.equal(steps.example(17,'ACTION'),'set a 10:45 “time to go” alarm for Saturday’s dinner.');
 assert.equal(steps.example(18,'KEEP'),'Using my minimum on hard mornings.','A question box’s example is a whole answer');
 assert.equal(steps.example(21,'HERENOW'),'get up at 6:30 most weekdays and wake up rested. Late nights still knock me back.');
 assert.equal(steps.example(22,'HERE'),'','Steps past 21 have no examples');
});
test('Blocks of seven steps: each has its seven skills and closing lines',()=>{
 const b1=steps.block(1);
 assert.deepEqual([b1.number,b1.name,b1.first,b1.last,b1.ready,b1.skills.length],[1,'MAKE THE MOVE',1,7,true,7]);
 assert.deepEqual(b1.skills.map(([name])=>name),['DIRECTION','ACTION','PRIORITY','CONTROL','RESPONSE','SURROUNDINGS','ROUTINE']);
 assert.deepEqual(b1.closing,['You’ve made the move.','Next, you make it stick.']);
 const b2=steps.block(2);
 assert.deepEqual([b2.name,b2.first,b2.last,b2.ready],['MAKE IT STICK',8,14,true]);
 assert.deepEqual(b2.skills.map(([name])=>name),['PATTERN','REPLACEMENT','REASON','ACCOUNTABILITY','MINIMUM','PREPARATION','PROGRESSION']);
 assert.deepEqual(b2.closing,['You’ve learned how to make it stick.','Next, you make it yours.']);
 assert.deepEqual([b1.description,b2.description],['Build the actions.','Learn how to sustain and progress them.']);
 const b3=steps.block(3);
 assert.deepEqual([b3.name,b3.first,b3.last,b3.ready],['MAKE IT YOURS',15,21,true]);
 assert.deepEqual(b3.skills.map(([name])=>name),['RESTART','HINDSIGHT','INSIGHT','FORESIGHT','METHOD','INDEPENDENCE','CLARITY']);
 assert.deepEqual(b3.closing,['You’ve learned the method.','What you do with it starts with you.']);
 assert.equal(b3.description,'Use the Mirror Method on any change, for the rest of your life.');
 assert.equal(steps.block(4),null);assert.equal(steps.block(0),null);
});
test('Step 11’s report-back day in plain words: the weekday within the coming week, otherwise weekday, day and month',()=>{
 const wed=new Date(2026,9,28,21,30);
 assert.equal(steps.plainDate('2026-10-29',wed),'Thursday','tomorrow');
 assert.equal(steps.plainDate('2026-11-01',wed),'Sunday');
 assert.equal(steps.plainDate('2026-11-03',wed),'Tuesday','six days on');
 assert.equal(steps.plainDate('2026-11-04',wed),'Wednesday 4 November','a week on');
 assert.equal(steps.plainDate('2026-11-01'),'Sunday 1 November','no reference day: always in full');
 assert.equal(steps.plainDate(''),'');assert.equal(steps.plainDate(undefined),'');
});
test('Steps 02–21 have their own Learn and Act; Step 01 uses the generic pages; Check in and Watch are shared',()=>{
 assert.equal(steps.lesson(1),1);
 for(let step=2;step<=21;step++){const nn=steps.pad(step);assert.equal(steps.lesson(step),step);assert.equal(steps.page(step,'learn'),'step'+nn+'-learn.html');assert.equal(steps.page(step,'act'),'step'+nn+'-act.html');}
 assert.equal(steps.page(10,'learn'),'step10-learn.html');
 assert.equal(steps.page(3,'watch'),'step-watch.html');
 assert.equal(steps.lesson(22),null);assert.equal(steps.lesson(0),null);
 assert.equal(steps.page(2,'learn'),'step02-learn.html');assert.equal(steps.page(2,'act'),'step02-act.html');
 assert.equal(steps.page(2,'watch'),'step-watch.html');assert.equal(steps.page(2,'checkin'),'step-checkin.html');
 assert.equal(steps.page(1,'act'),'step-act.html');assert.equal(steps.page(1,'learn'),'step-learn.html');
});
test('Watch content: Steps 01–21 have their portrait video with its first and last frames; Welcome waits',()=>{
 for(let step=1;step<=21;step++){const m=steps.media(step),nn=steps.pad(step);
  assert.deepEqual([m.video,m.image,m.finish],['../Audio-Video/Step'+nn+'-Watch.mp4','../assets/images/step'+nn+'-start.jpg','../assets/images/step'+nn+'-finish.jpg']);}
 for(const step of [0]){const m=steps.media(step);assert.equal(m.video,'','VIDEO COMING SOON until the portrait video arrives');assert.equal(m.image,'../assets/images/step01-start.jpg');assert.equal(m.finish,'');}
 for(let step=0;step<=21;step++){assert.equal(steps.available(step),true);assert.equal(steps.media(step).cover,30,'The bottom fade covers 30% unless a step sets its own');}
 assert.deepEqual([steps.media(0).next,steps.media(1).next,steps.media(2).next,steps.media(18).next],['MY PATH','LEARN','LEARN','LEARN']);
 assert.deepEqual([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21].map(s=>steps.media(s).duration),['0:37','1:45','1:18','1:18','1:25','1:38','1:13','1:20','1:27','1:30','1:27','1:35','1:29','1:27','1:31','1:20','1:23','1:26','1:28','1:28','1:22','1:24']);
 for(const step of [22,-1]){assert.equal(steps.available(step),false);assert.equal(steps.media(step),null);}
 assert.equal(steps.pad(3),'03');
});
test('The two Mirror Method cards: whole sentences, the move as it stood, each with its evening result',()=>{
 const state={answers:{19:'yes'},responses:{3:{MOVE:'saying no to extra evening work'},14:{DECISION:'raise',NEWBAR:'leaving by 6:30pm'},
  19:{SEE:'evenings mostly hold',OWN:'saying yes after 6pm',MOVECHOICE:'keep',TOOL:'anchor',ACTION:'block 6pm'},20:{NEWCHANGE:'walking',SEE:'once a fortnight',OWN:'I let it slide',CHANGEIT:'a Tuesday walk',FIRST:'text my sister'}}};
 const [c19,c20]=steps.cards(state);
 assert.deepEqual([c19.step,c19.title,c19.result],[19,'MY MIRROR METHOD','yes']);
 assert.deepEqual(c19.rows,[['SEE IT','What’s happening now is evenings mostly hold'],['OWN IT','The part that’s mine is saying yes after 6pm'],['MY MOVE','My move is leaving by 6:30pm'],['MY TOOL','My anchor.'],['TODAY’S ACTION','Today, I’ll block 6pm']]);
 assert.deepEqual([c20.step,c20.title,c20.result],[20,'MY MIRROR METHOD: NEW CHANGE',null],'Not graded yet');
 assert.deepEqual(c20.rows.map(([,text])=>text),['walking','once a fortnight','I let it slide','a Tuesday walk','text my sister'],'The blank card’s answers stand alone');
 state.responses[19].MOVECHOICE='update';state.responses[19].MOVE='leaving by 6pm';
 assert.equal(steps.cards(state)[0].rows[2][1],'My move is leaving by 6pm','An updated move');
});
