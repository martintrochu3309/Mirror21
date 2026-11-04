const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {steps}=require('../assets/core/content.js');
const dir=path.join(__dirname,'../src/steps');
test('Every step has its folder: step.js, and from Step 01 its Learn and Act pages',()=>{
 for(let n=0;n<=21;n++){
  const folder=path.join(dir,'step'+String(n).padStart(2,'0'));
  assert.ok(fs.existsSync(path.join(folder,'step.js')),'step.js for '+n);
  for(const page of ['learn.html','act.html'])assert.equal(fs.existsSync(path.join(folder,page)),n>0,page+' for '+n);
 }
});
test('Each step’s content has what the app reads from it',()=>{
 assert.deepEqual(Object.keys(steps).map(Number),Array.from({length:22},(_,n)=>n));
 for(let n=0;n<=21;n++){
  const s=steps[n];
  assert.equal(typeof s.title,'string',n+' title');assert.ok(s.title);
  assert.ok(typeof s.watch==='string'?/^\d+:\d\d$/.test(s.watch):s.watch&&typeof s.watch==='object',n+' watch');
  if(n===0)continue;
  assert.ok(Array.isArray(s.skill)&&s.skill.length===2,n+' skill');
  assert.equal(typeof s.journal,'function',n+' journal');
  // Steps 03–21 share one Act screen, set by their act field; Steps 01 and 02 have their own.
  assert.equal(Boolean(s.act),n>=3,n+' act');
  if(s.act)assert.ok(Array.isArray(s.act.promise)||typeof s.act.promise==='function',n+' promise');
 }
});
test('Journal rows read the step’s own answers and leave out nothing written',()=>{
 const said=r=>(label,starter,key)=>[label,r[key]?.trim()?starter+' '+r[key].trim():''];
 const r={WORKING:'using my minimum',NOTYET:'late nights'};
 assert.deepEqual(steps[16].journal({r,said:said(r)}),[['WORKING','One thing that’s working is using my minimum'],['NOT YET','One thing that isn’t working yet is late nights']]);
 const r13={DATE:'2026-11-06',TOOL:'swap'};
 assert.equal(steps[13].journal({r:r13,said:said(r13),plainDate:()=>'Friday 6 November'})[0][1],'My hard day is Friday 6 November.');
});
