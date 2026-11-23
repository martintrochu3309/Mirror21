// The account copy of the course (assets/core/store.js, cloud): saved in the browser first, then in Supabase, newest wins.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const model=require('../assets/core/progress.js');
const URL_='https://example.supabase.co',KEY='sb_publishable_test',AUTH='sb-mirror21-auth';
const plain=value=>JSON.parse(JSON.stringify(value));
function storage(entries=[]){const values=new Map(entries);return {values,get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
const signIn=(id='user-a',expires=Math.floor(Date.now()/1000)+3600)=>JSON.stringify({access_token:'token-'+id,refresh_token:'refresh-'+id,expires_at:expires,user:{id,email:id+'@example.com'}});
// A pretend Supabase: one course row per user, save_course keeping the newer copy, as the SQL does.
function supabase(rows={}){
 const calls=[];
 const fetch=async(url,init={})=>{
  const method=init.method||'GET',body=init.body?JSON.parse(init.body):null,user=(init.headers?.Authorization||'').replace('Bearer token-','');
  calls.push({method,url,body,keepalive:Boolean(init.keepalive)});
  const reply=(status,data)=>({ok:status<300,status,json:async()=>data});
  if(url.includes('/auth/v1/token')){const id=body.refresh_token.replace('refresh-','');return reply(200,{access_token:'token-'+id,refresh_token:'refresh-'+id+'-2',expires_in:3600,user:{id,email:id+'@example.com'}});}
  if(url.endsWith('/rest/v1/rpc/save_course')){const row=rows[user];if(!row||row.saved_at<=body.p_saved_at)rows[user]={snapshot:body.p_snapshot,saved_at:body.p_saved_at};return reply(200,[rows[user]]);}
  if(url.includes('/rest/v1/courses')&&method==='GET')return reply(200,rows[user]?[rows[user]]:[]);
  if(url.includes('/rest/v1/courses')&&method==='DELETE'){delete rows[user];return reply(204,null);}
  return reply(404,null);
 };
 return {rows,calls,fetch};
}
function load({local=storage(),href='https://mirror21.app/html/04-map-start',server=supabase(),offline=false}={}){
 const listeners=[],timers=[];let reloads=0;
 const context=vm.createContext({
  MirrorProgress:model,localStorage:local,sessionStorage:storage(),
  MirrorAuth:{url:URL_,key:KEY,storageKey:AUTH,signedIn:()=>Boolean(local.getItem(AUTH))},
  location:Object.assign(new URL(href),{reload:()=>reloads++}),
  fetch:offline?async()=>{throw Error('offline');}:server.fetch,
  setTimeout:(fn,ms,...args)=>{if(ms>=6000)return 0;timers.push(()=>fn(...args));return timers.length;},clearTimeout:()=>{},
  addEventListener:(name,fn)=>listeners.push([name,fn]),Promise,URL,JSON,Date,Math,Number,String,Boolean,Array,Object,encodeURIComponent
 });
 vm.runInContext(fs.readFileSync(require.resolve('../assets/core/store.js'),'utf8'),context);
 return {store:context.MirrorStore,local,server,listeners,timers,get reloads(){return reloads;},runTimers:async()=>{while(timers.length)await timers.shift()();}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const ready=async app=>{let ran=0;app.store.ready(()=>ran++);for(let i=0;i<20&&!ran;i++)await settle();await settle();return ran;};
const course=(steps,at)=>{const s=model.fresh(1000);for(let d=1;d<=steps;d++)s.lessons[d]=true;s.updatedAt=at;return s;};

test('A saved change is sent to the account a moment later, with the time it was saved',async()=>{
 const app=load({local:storage([[AUTH,signIn()]])});
 assert.equal(await ready(app),1);
 const state=app.store.course.load();state.lessons[1]=true;app.store.course.save(state);
 assert.ok(Number(app.local.getItem('mirror21-saved-at'))>0,'Stamped on this device');
 await app.runTimers();
 const row=app.server.rows['user-a'];
 assert.deepEqual(plain(row.snapshot.progress.lessons),{1:true});
 assert.equal(row.saved_at,Number(app.local.getItem('mirror21-saved-at')));
});

test('A new phone waits for the account, then shows the course saved on the other phone',async()=>{
 const server=supabase({'user-a':{snapshot:{progress:course(4,5000),runs:[],reminder:'07:15',flags:{'mirror21-watched-0':'true','mirror21-block-1':'true'}},saved_at:5000}});
 const app=load({local:storage([[AUTH,signIn()]]),server});
 let seen=null;app.store.ready(()=>{seen=Object.keys(app.store.course.load().lessons).length;});
 assert.equal(seen,null,'Nothing is shown before the account answers');
 for(let i=0;i<20&&seen===null;i++)await settle();
 assert.equal(seen,4);
 assert.deepEqual([app.store.course.reminder(),app.store.device.welcomeWatched(),app.store.device.blockSeen(1),app.local.getItem('mirror21-saved-at')],['07:15',true,true,'5000']);
 assert.equal(app.reloads,0,'No reload when it waited');
});

test('A phone with an older copy shows it at once, then takes the newer one and reloads',async()=>{
 const server=supabase({'user-a':{snapshot:{progress:course(6,9000),runs:[],reminder:null,flags:{}},saved_at:9000}});
 const app=load({local:storage([[AUTH,signIn()],['mirror21-owner','user-a'],['mirror21-saved-at','4000'],['mirror21-progress',JSON.stringify(course(3,4000))],['mirror21-reminder','06:00']]),server});
 assert.equal(await ready(app),1,'Shown straight away');
 assert.equal(app.reloads,1);
 assert.equal(Object.keys(app.store.course.load().lessons).length,6);
 assert.equal(app.store.course.reminder(),null,'The account’s copy replaces it whole');
});

test('A phone with a newer copy (saved offline) sends it; the older account copy never replaces it',async()=>{
 const server=supabase({'user-a':{snapshot:{progress:course(2,2000),runs:[],flags:{}},saved_at:2000}});
 const app=load({local:storage([[AUTH,signIn()],['mirror21-owner','user-a'],['mirror21-saved-at','7000'],['mirror21-progress',JSON.stringify(course(5,7000))]]),server});
 await ready(app);
 assert.equal(app.reloads,0);
 assert.equal(server.rows['user-a'].saved_at,7000);
 assert.equal(Object.keys(server.rows['user-a'].snapshot.progress.lessons).length,5);
});

test('A course saved before the account copy existed is sent up on the first sign-in',async()=>{
 const app=load({local:storage([[AUTH,signIn()],['mirror21-progress',JSON.stringify(course(3,3000))]])});
 await ready(app);
 assert.equal(app.local.getItem('mirror21-owner'),'user-a');
 assert.equal(app.server.rows['user-a'].saved_at,3000);
 assert.equal(Object.keys(app.server.rows['user-a'].snapshot.progress.lessons).length,3);
});

test('Someone else signing in on this phone never sees the last person’s course',async()=>{
 const server=supabase({'user-b':{snapshot:{progress:course(1,8000),runs:[],flags:{}},saved_at:8000}});
 const app=load({local:storage([[AUTH,signIn('user-b')],['mirror21-owner','user-a'],['mirror21-saved-at','9999'],['mirror21-progress',JSON.stringify(course(7,9999))],['mirror21-block-1','true'],['mirror21-captions','false']]),server});
 let seen=null;app.store.ready(()=>{seen=Object.keys(app.store.course.load().lessons).length;});
 for(let i=0;i<20&&seen===null;i++)await settle();
 assert.equal(seen,1,'user-b’s own course');
 assert.deepEqual([app.local.getItem('mirror21-owner'),app.store.device.blockSeen(1),app.local.getItem('mirror21-captions')],['user-b',false,'false']);
 assert.equal(server.rows['user-a'],undefined,'Nothing of user-a’s was sent to user-b’s account');
});

test('Start over reaches the account too, so the old course doesn’t come back',async()=>{
 const server=supabase({'user-a':{snapshot:{progress:course(5,5000),runs:[],flags:{}},saved_at:5000}});
 const app=load({local:storage([[AUTH,signIn()],['mirror21-owner','user-a'],['mirror21-saved-at','5000'],['mirror21-progress',JSON.stringify(course(5,5000))]]),server});
 await ready(app);
 app.store.course.clear();await app.runTimers();
 assert.equal(server.rows['user-a'].snapshot.progress,null);
 const again=load({local:storage([[AUTH,signIn()],['mirror21-owner','user-a'],['mirror21-saved-at',app.local.getItem('mirror21-saved-at')]]),server});
 await ready(again);
 assert.deepEqual([again.reloads,again.store.course.exists()],[0,false]);
});

test('Leaving the page sends a waiting change straight away',async()=>{
 const app=load({local:storage([[AUTH,signIn()],['mirror21-owner','user-a'],['mirror21-saved-at','1']])});
 await ready(app);
 app.store.device.markBlockSeen(2);
 const [,leave]=app.listeners.find(([name])=>name==='pagehide');
 leave();await settle();await settle();
 const sent=app.server.calls.find(call=>call.url.endsWith('save_course')&&call.keepalive);
 assert.ok(sent,'Sent with keepalive');
 assert.equal(sent.body.p_snapshot.flags['mirror21-block-2'],'true');
});

test('An expired sign-in is renewed and saved back where supabase-js keeps it',async()=>{
 const app=load({local:storage([[AUTH,signIn('user-a',Math.floor(Date.now()/1000)-10)],['mirror21-owner','user-a'],['mirror21-saved-at','1']])});
 await ready(app);
 const renewed=JSON.parse(app.local.getItem(AUTH));
 assert.equal(renewed.refresh_token,'refresh-user-a-2');
 assert.ok(renewed.expires_at*1000>Date.now());
 assert.equal(renewed.user.email,'user-a@example.com','The rest of the sign-in is kept');
});

test('Offline: the screen still opens with this device’s course, and nothing is lost',async()=>{
 const app=load({local:storage([[AUTH,signIn()],['mirror21-owner','user-a'],['mirror21-saved-at','4000'],['mirror21-progress',JSON.stringify(course(2,4000))]]),offline:true});
 assert.equal(await ready(app),1);
 assert.equal(Object.keys(app.store.course.load().lessons).length,2);
});

test('On a computer (file:, localhost) nothing is sent anywhere',async()=>{
 for(const href of ['file:///C:/Mirror21/html/04-map-start.html','http://127.0.0.1:5000/html/04-map-start.html','http://localhost:8080/html/x.html']){
  const app=load({local:storage([[AUTH,signIn()]]),href});
  assert.equal(await ready(app),1);
  app.store.course.save(app.store.course.load());await app.runTimers();
  assert.equal(app.server.calls.length,0,href);
 }
});

test('Delete my data removes the account copy as well',async()=>{
 const server=supabase({'user-a':{snapshot:{progress:course(2,2000),runs:[],flags:{}},saved_at:2000}});
 const app=load({local:storage([[AUTH,signIn()],['mirror21-owner','user-a'],['mirror21-saved-at','2000']]),server});
 await ready(app);
 app.store.deleteAll();await settle();await settle();
 assert.equal(server.rows['user-a'],undefined);
});
