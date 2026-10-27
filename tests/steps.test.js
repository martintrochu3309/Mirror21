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
test('Every Act text box in Steps 01–12 has a "See an example" answer; Step 11’s date has none',()=>{
 const fs=require('node:fs'),path=require('node:path'),dir=path.join(__dirname,'../html');
 for(const file of fs.readdirSync(dir).filter(f=>/^step(\d\d)?-?act\.html$/.test(f))){
  const step=file==='step-act.html'?1:Number(file.slice(4,6));
  const html=fs.readFileSync(path.join(dir,file),'utf8');
  const keys=Array.from(html.matchAll(/<textarea[^>]*>/g),([tag])=>(tag.match(/data-answer="([^"]+)"/)||tag.match(/data-field="([^"]+)"/)||tag.match(/id="([^"]+)"/))[1].toUpperCase());
  assert.ok(keys.length,file);
  for(const key of keys)assert.ok(steps.example(step,key),file+' '+key);
 }
 assert.equal(steps.example(11,'DATE'),'');
 assert.equal(steps.example(7,'ANCHOR'),'brush my teeth at night.');
 assert.equal(steps.example(14,'HERE'),steps.example(1,'HERE'),'Placeholder steps use Step 01’s lesson and examples');
});
test('Blocks of seven steps: Block 1 has its seven skills and closing lines; Blocks 2 and 3 have no summary yet',()=>{
 const b1=steps.block(1);
 assert.deepEqual([b1.number,b1.name,b1.first,b1.last,b1.ready,b1.skills.length],[1,'MAKE THE MOVE',1,7,true,7]);
 assert.deepEqual(b1.skills.map(([name])=>name),['DIRECTION','ACTION','PRIORITY','CONTROL','RESPONSE','SURROUNDINGS','ROUTINE']);
 assert.deepEqual(b1.closing,['You’ve made the move.','Next, you make it stick.']);
 assert.deepEqual([steps.block(2).last,steps.block(2).ready,steps.block(3).last,steps.block(3).ready],[14,false,21,false]);
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
test('Steps 02–12 have their own Learn and Act; Steps 01 and 13–18 use Step 01’s; Check in and Watch are shared',()=>{
 assert.equal(steps.lesson(1),1);
 for(let step=2;step<=12;step++){const nn=steps.pad(step);assert.equal(steps.lesson(step),step);assert.equal(steps.page(step,'learn'),'step'+nn+'-learn.html');assert.equal(steps.page(step,'act'),'step'+nn+'-act.html');}
 assert.equal(steps.page(10,'learn'),'step10-learn.html');
 for(let step=13;step<=18;step++)assert.equal(steps.lesson(step),1);
 assert.equal(steps.page(3,'watch'),'step-watch.html');
 assert.equal(steps.lesson(19),null);assert.equal(steps.lesson(0),null);
 assert.equal(steps.page(2,'learn'),'step02-learn.html');assert.equal(steps.page(2,'act'),'step02-act.html');
 assert.equal(steps.page(2,'watch'),'step-watch.html');assert.equal(steps.page(2,'checkin'),'step-checkin.html');
 assert.equal(steps.page(13,'act'),'step-act.html');assert.equal(steps.page(13,'learn'),'step-learn.html');
});
test('Watch content: Steps 01–12 have their portrait video with its first and last frames; the rest wait; 19–21 unavailable',()=>{
 for(let step=1;step<=12;step++){const m=steps.media(step),nn=steps.pad(step);
  assert.deepEqual([m.video,m.image,m.finish],['../Audio-Video/Step'+nn+'-Watch.mp4','../assets/images/step'+nn+'-start.jpg','../assets/images/step'+nn+'-finish.jpg']);}
 for(const step of [0,13,18]){const m=steps.media(step);assert.equal(m.video,'','VIDEO COMING SOON until the portrait video arrives');assert.equal(m.image,'../assets/images/step01-start.jpg');assert.equal(m.finish,'');}
 for(let step=0;step<=18;step++)assert.equal(steps.available(step),true);
 assert.deepEqual([steps.media(0).next,steps.media(1).next,steps.media(2).next,steps.media(18).next],['MY PATH','LEARN','LEARN','LEARN']);
 assert.deepEqual([0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(s=>steps.media(s).duration),['0:37','1:45','1:18','1:18','1:25','1:38','1:13','1:20','1:27','1:30','1:27','1:35','1:29','']);
 for(const step of [19,20,21]){assert.equal(steps.available(step),false);assert.equal(steps.media(step),null);}
 assert.equal(steps.pad(3),'03');
});
