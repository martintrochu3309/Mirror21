const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const auth=require('../assets/core/auth.js');
const html=path.join(__dirname,'../html');

// auth.js as a page runs it: a browser with this storage, at this address.
function page(saved,href){
 const replaced=[];const url=new URL(href);
 const context={localStorage:{getItem:key=>saved[key]??null},location:{pathname:url.pathname,search:url.search,hash:url.hash,replace:to=>replaced.push(to)},document:{currentScript:{dataset:{}}}};
 context.globalThis=context;vm.createContext(context);
 vm.runInContext(fs.readFileSync(require.resolve('../assets/core/auth.js'),'utf8'),context);
 return {replaced,auth:context.MirrorAuth};
}
const session=JSON.stringify({access_token:'a',refresh_token:'r',user:{email:'buyer@example.com'}});

test('No one signed in: a course page sends them to Sign in, saying where they were going',()=>{
 assert.deepEqual(page({},'https://mirror21.app/html/step-watch?step=3').replaced,['02-sign-in.html?next='+encodeURIComponent('step-watch.html?step=3')]);
 assert.deepEqual(page({},'file:///C:/Mirror21/html/04-map-start.html#today').replaced,['02-sign-in.html?next='+encodeURIComponent('04-map-start.html#today')]);
 assert.deepEqual(page({'sb-mirror21-auth':'not json'},'https://mirror21.app/html/18-my-mirror').replaced.length,1,'Unreadable sign-in counts as signed out');
});
test('Signed in on this device: the page opens, even offline (nothing is fetched)',()=>{
 const {replaced,auth}=page({'sb-mirror21-auth':session},'https://mirror21.app/html/04-map-start');
 assert.deepEqual(replaced,[]);assert.equal(auth.signedIn(),true);
});
test('After signing in, only a page of the app is opened: anything else gives My Path',()=>{
 assert.equal(auth.safeNext('step-learn.html?step=4'),'step-learn.html?step=4');
 assert.equal(auth.safeNext('19-my-journey.html#top'),'19-my-journey.html#top');
 for(const bad of [null,'','https://evil.example/','//evil.example/x.html','../index.html','javascript:alert(1)','04-map-start'])assert.equal(auth.safeNext(bad),'04-map-start.html',String(bad));
});
test('The first page, Sign in and the Offer are open to anyone; every other page checks first, before anything else runs',()=>{
 for(const name of fs.readdirSync(html).filter(f=>f.endsWith('.html'))){
  const text=fs.readFileSync(path.join(html,name),'utf8');
  const gate=/<script src="\.\.\/assets\/core\/auth\.js\?v=[^"]+"><\/script>/.exec(text);
  if(['00-start.html','01-offer.html','02-sign-in.html'].includes(name)){assert.equal(gate,null,name+' is open');continue;}
  assert.ok(gate,name+' checks for a sign-in');
  assert.ok(gate.index<text.indexOf('</head>')&&!/<script/.test(text.slice(0,gate.index)),name+': the check is the first script in the head');
 }
});
test('While a page is sending someone to Sign in, its screen never runs (nothing is saved)',()=>{
 const store=fs.readFileSync(require.resolve('../assets/core/store.js'),'utf8');
 const run=signedIn=>{let ran=false;const context={MirrorAuth:{signedIn:()=>signedIn}};context.globalThis=context;vm.createContext(context);vm.runInContext(store,context);context.MirrorStore.ready(()=>{ran=true;});return ran;};
 assert.equal(run(false),false);assert.equal(run(true),true);
});
