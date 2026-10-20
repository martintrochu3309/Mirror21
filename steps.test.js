const {test}=require('node:test');
const assert=require('node:assert/strict');
const steps=require('../assets/steps.js');
test('all 21 step titles plus Welcome are listed in order',()=>{
 assert.equal(steps.titles.length,22);
 assert.equal(steps.title(0),'Welcome to Mirror 21');
 assert.equal(steps.title(1),'Know Where You’re Going');
 assert.equal(steps.title(7),'Link It to Your Day');
 assert.equal(steps.title(14),'Raise the Bar');
 assert.equal(steps.title(21),'See What Changed');
 assert.equal(steps.headline(1),'KNOW WHERE YOU’RE GOING.');
 assert.equal(steps.headline(18),'KEEP, STOP, START.');
});
test('Step 02 has its own Learn and Act; Steps 01 and 03–18 use Step 01’s; Check in and Watch are shared',()=>{
 assert.equal(steps.lesson(1),1);assert.equal(steps.lesson(2),2);
 for(let step=3;step<=18;step++)assert.equal(steps.lesson(step),1);
 assert.equal(steps.lesson(19),null);assert.equal(steps.lesson(0),null);
 assert.equal(steps.page(2,'learn'),'step02-learn.html');assert.equal(steps.page(2,'act'),'step02-act.html');
 assert.equal(steps.page(2,'watch'),'step-watch.html');assert.equal(steps.page(2,'checkin'),'step-checkin.html');
 assert.equal(steps.page(3,'act'),'step-act.html');assert.equal(steps.page(8,'learn'),'step-learn.html');
});
test('Steps 01–18 use the Step 01 video; 19–21 wait for content; Step 00 has its own video',()=>{
 for(let step=1;step<=18;step++){assert.equal(steps.available(step),true);assert.equal(steps.media(step).video,'../Audio-Video/Step01-Mirror21.mp4');}
 for(const step of [19,20,21]){assert.equal(steps.available(step),false);assert.equal(steps.media(step),null);}
 assert.equal(steps.media(0).video,'../Audio-Video/Step00-Mirror21.mp4');
 assert.equal(steps.pad(3),'03');
});
