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
test('Steps 02–06 have their own Learn and Act; Steps 01 and 07–18 use Step 01’s; Check in and Watch are shared',()=>{
 assert.equal(steps.lesson(1),1);
 for(let step=2;step<=6;step++){assert.equal(steps.lesson(step),step);assert.equal(steps.page(step,'learn'),'step0'+step+'-learn.html');assert.equal(steps.page(step,'act'),'step0'+step+'-act.html');}
 for(let step=7;step<=18;step++)assert.equal(steps.lesson(step),1);
 assert.equal(steps.page(3,'watch'),'step-watch.html');
 assert.equal(steps.lesson(19),null);assert.equal(steps.lesson(0),null);
 assert.equal(steps.page(2,'learn'),'step02-learn.html');assert.equal(steps.page(2,'act'),'step02-act.html');
 assert.equal(steps.page(2,'watch'),'step-watch.html');assert.equal(steps.page(2,'checkin'),'step-checkin.html');
 assert.equal(steps.page(7,'act'),'step-act.html');assert.equal(steps.page(8,'learn'),'step-learn.html');
});
test('Watch content: Steps 01–06 have their portrait video with its first and last frames; the rest wait; 19–21 unavailable',()=>{
 for(let step=1;step<=6;step++){const m=steps.media(step),nn=steps.pad(step);
  assert.deepEqual([m.video,m.image,m.finish],['../Audio-Video/Step'+nn+'-Watch.mp4','../assets/images/step'+nn+'-start.jpg','../assets/images/step'+nn+'-finish.jpg']);}
 for(const step of [0,7,12,18]){const m=steps.media(step);assert.equal(m.video,'','VIDEO COMING SOON until the portrait video arrives');assert.equal(m.image,'../assets/images/step01-start.jpg');assert.equal(m.finish,'');}
 for(let step=0;step<=18;step++)assert.equal(steps.available(step),true);
 assert.deepEqual([steps.media(0).next,steps.media(1).next,steps.media(2).next,steps.media(18).next],['MY PATH','LEARN','LEARN','LEARN']);
 assert.deepEqual([0,1,2,3,4,5,6,7].map(s=>steps.media(s).duration),['0:37','1:45','1:18','1:18','1:25','1:38','1:13','']);
 for(const step of [19,20,21]){assert.equal(steps.available(step),false);assert.equal(steps.media(step),null);}
 assert.equal(steps.pad(3),'03');
});
