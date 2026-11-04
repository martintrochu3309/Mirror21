const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const model=require('../assets/core/progress.js');
// Values made inside the store's own context, compared as plain data.
const plain=value=>JSON.parse(JSON.stringify(value));
function storage(entries=[]){const values=new Map(entries);return {values,get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
function load(local=storage(),session=storage()){
 const listeners=[];
 const context=vm.createContext({MirrorProgress:model,localStorage:local,sessionStorage:session,addEventListener:(name,fn)=>listeners.push([name,fn])});
 vm.runInContext(fs.readFileSync(require.resolve('../assets/core/store.js'),'utf8'),context);
 return {store:context.MirrorStore,local,session,listeners};
}
test('The course is saved under the same key and format as before, so saved progress keeps working',()=>{
 const saved=model.fresh(1000);saved.lessons[1]=true;saved.responses[1]={HERE:'Right now, I am tired.'};
 const {store,local}=load(storage([['mirror21-progress',JSON.stringify(saved)]]));
 assert.equal(store.course.exists(),true);
 const state=store.course.load();
 assert.deepEqual([state.lessons,state.responses[1].HERE],[{1:true},'Right now, I am tired.']);
 state.lessons[2]=true;store.course.save(state);
 const written=JSON.parse(local.getItem('mirror21-progress'));
 assert.equal(written.lessons[2],true);assert.ok(written.updatedAt>1000,'Saving stamps the time');
});
test('Nothing saved, or something unreadable: a fresh course, and exists() says so',()=>{
 for(const value of [null,'not json','{"version":2}']){
  const {store}=load(storage(value===null?[]:[['mirror21-progress',value]]));
  assert.equal(store.course.exists(),false);assert.equal(model.stats(store.course.load()).today,1);
 }
});
test('Finished runs and the reminder time',()=>{
 const {store,local}=load(storage([['mirror21-runs','not a list'],['mirror21-reminder','07:15']]));
 assert.deepEqual(plain(store.course.runs()),[]);
 store.course.saveRuns([{endedAt:1,progress:{}}]);
 assert.equal(JSON.parse(local.getItem('mirror21-runs')).length,1);
 assert.equal(store.course.reminder(),'07:15');store.course.saveReminder('06:45');assert.equal(local.getItem('mirror21-reminder'),'06:45');
});
test('This device only: bar positions, Welcome, block summaries and the arrival note keep their keys',()=>{
 const {store,local,session}=load();
 store.device.saveBarPosition(4,[1,0.5,0,0]);assert.equal(local.getItem('mirror21-bar-4'),'[1,0.5,0,0]');assert.deepEqual(plain(store.device.barPosition(4)),[1,0.5,0,0]);
 assert.equal(store.device.barPosition(5),null);
 assert.equal(store.device.welcomeWatched(),false);store.device.markWelcomeWatched();assert.equal(local.getItem('mirror21-watched-0'),'true');assert.equal(store.device.welcomeWatched(),true);
 store.device.markWelcomeSeen();assert.equal(local.getItem('mirror21-seen-0'),'true');assert.equal(store.device.welcomeSeen(),true);
 store.device.markBlockSeen(2);assert.equal(local.getItem('mirror21-block-2'),'true');assert.equal(store.device.blockSeen(2),true);assert.equal(store.device.blockSeen(3),false);
 store.device.setArrival('light:5');assert.equal(session.getItem('mirror21-intro'),'light:5');
 assert.equal(store.device.takeArrival(),'light:5');assert.equal(session.getItem('mirror21-intro'),null,'The note is used up');assert.equal(store.device.takeArrival(),null);
});
test('Start over clears the course on this device but keeps settings and finished runs; Delete my data clears it all',()=>{
 const entries=[['mirror21-progress','{}'],['mirror21-bar-3','[1]'],['mirror21-watched-0','true'],['mirror21-seen-0','true'],['mirror21-block-1','true'],['mirror21-reminder','07:15'],['mirror21-runs','[]'],['other-app','keep']];
 const a=load(storage(entries),storage([['mirror21-scroll-2-4','100'],['mirror21-intro','3']]));
 assert.equal(a.store.course.clear(),true);
 assert.deepEqual([...a.local.values.keys()].sort(),['mirror21-reminder','mirror21-runs','other-app']);
 assert.deepEqual([...a.session.values.keys()],['mirror21-intro'],'The one-time arrival note is not part of the course');
 const b=load(storage(entries),storage([['mirror21-intro','3']]));
 assert.equal(b.store.deleteAll(),true);
 assert.deepEqual([...b.local.values.keys()],['other-app']);assert.equal(b.session.length,0);
});
test('A browser that refuses storage: reads give nothing, writes do nothing, clearing reports it',()=>{
 const refusing={get length(){throw Error('SecurityError');},key(){throw Error('SecurityError');},getItem(){throw Error('SecurityError');},setItem(){throw Error('SecurityError');},removeItem(){throw Error('SecurityError');}};
 const {store}=load(refusing,refusing);
 assert.equal(store.course.exists(),false);assert.equal(model.stats(store.course.load()).today,1);
 assert.doesNotThrow(()=>store.course.save(model.fresh()));assert.doesNotThrow(()=>store.device.markBlockSeen(1));
 assert.equal(store.device.takeArrival(),null);assert.equal(store.course.clear(),false);
});
test('Another tab saving the course is reported; other keys are not',()=>{
 const {store,listeners}=load();let changed=0;
 store.course.onChange(()=>changed++);
 const [[name,fn]]=listeners;assert.equal(name,'storage');
 fn({key:'mirror21-reminder'});fn({key:'mirror21-progress'});assert.equal(changed,1);
});
test('ready() runs the screen straight away while the course lives in this browser',()=>{
 const {store}=load();let ran=false;store.ready(()=>{ran=true;});assert.equal(ran,true);
});
