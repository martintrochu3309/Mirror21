// /dashboard's numbers (assets/core/dashboard-stats.js), from what dashboard_stats() gives.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {summarize,stopTable,dayOf}=require('../assets/core/dashboard-stats.js');
const DAY=86400000,start=new Date(2026,10,1,9,0).getTime(),now=new Date(2026,10,23,12,0).getTime();
const at=day=>new Date(start+(day-1)*DAY+3600000).toISOString();
// Steps 1..n committed on Day d(step); then the next step at a part.
function learner({n=0,day=s=>s,answers={},next=null,saved=now,test=true,signed=true,finished=false}={}){
 const steps={};
 for(let s=1;s<=n;s++)steps[s]={committed:true,committed_at:at(day(s)),opened:true,checked_in:s>=2,reached:2,...(answers[s]?{answer:answers[s]}:{})};
 if(next)steps[n+1]={committed:false,opened:next!=='Not opened',...(next==='Check in'?{checked_in:false}:{checked_in:true}),reached:{Watch:0,Learn:1,Act:2}[next]??0};
 return {paid_at:start-DAY,test,signed_in:signed,saved_at:saved,started_at:n||next?start:null,finished_at:finished?now:null,steps};
}
test('Day 1 is the day they started, counted in calendar days',()=>{
 assert.equal(dayOf(start,start+3600000),1);
 assert.equal(dayOf(start,new Date(2026,10,2,0,30).getTime()),2,'Just after midnight is the next day');
});
test('Totals, steps completed, and the evening answers per step',()=>{
 const r=summarize([
  learner({n:21,answers:{1:'yes',2:'partly'},finished:true}),
  learner({n:5,next:'Learn',answers:{1:'no'}}),
  learner({n:0,next:'Watch',saved:now-10*DAY,test:false}),
  {paid_at:start,test:false,signed_in:false,saved_at:null,started_at:null,finished_at:null,steps:null}
 ],now);
 assert.deepEqual(r.totals,{buyers:4,test:2,signedIn:3,started:3,active7:2,finished:1,finalCheck:1});
 assert.deepEqual([r.completed[1],r.completed[5],r.completed[6],r.completed[21]],[2,2,1,1]);
 assert.deepEqual(r.answers[1],{yes:1,partly:0,no:1});assert.deepEqual(r.answers[2],{yes:0,partly:1,no:0});
 assert.deepEqual(r.people.map(p=>p.where),['Finished','Step 06 · Learn','Step 01 · Watch','Not started']);
});
test('Where people stop: the step they are on and the part, optionally only those idle for days',()=>{
 const r=summarize([learner({n:3,next:'Check in'}),learner({n:3,next:'Act',saved:now-5*DAY}),learner({n:3,next:'Not opened'}),learner({n:0,next:'Watch'})],now);
 assert.deepEqual(stopTable(r.stops),[{step:1,'Not opened':0,'Check in':0,Watch:1,Learn:0,Act:0,total:1},{step:4,'Not opened':1,'Check in':1,Watch:0,Learn:0,Act:1,total:3}]);
 assert.deepEqual(stopTable(r.stops,3),[{step:4,'Not opened':0,'Check in':0,Watch:0,Learn:0,Act:1,total:1}],'Only the one idle for 5 days');
});
test('Days: the average day each step is committed, and how long the finishers took',()=>{
 const r=summarize([learner({n:21,finished:true}),learner({n:21,day:s=>s*2,finished:true}),learner({n:2,day:s=>s+1})],now);
 assert.equal(r.averageDay[1],1.7,'(1 + 2 + 2) / 3');
 assert.equal(r.averageDay[21],31.5,'(21 + 42) / 2');
 assert.deepEqual(r.finishDays.sort(),[21,42]);
 assert.deepEqual(r.finish.map(b=>b.count),[1,0,0,1,0]);
 assert.equal(r.finishAverage,31.5);
});
test('Nothing yet, or odd data, gives zeros rather than errors',()=>{
 for(const data of [[],null,[{}],[{steps:'x'}]]){
  const r=summarize(data,now);
  assert.equal(r.completed[1],0);assert.deepEqual(stopTable(r.stops),[]);assert.equal(r.averageDay[1],null);
 }
});
