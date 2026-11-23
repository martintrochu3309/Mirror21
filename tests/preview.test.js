const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../assets/core/preview.js'),'utf8');
const real={getItem:()=>'REAL',setItem(){throw Error('real storage written');},removeItem(){},key:()=>null,length:0};

// preview.js as a page runs it: this frame name, at this address.
function frame(name,href){
 const win={name,location:{href},localStorage:real,sessionStorage:real,addEventListener(){}};
 const context={window:win,document:{documentElement:{dataset:{}},querySelector:()=>null,querySelectorAll:()=>[]}};
 vm.createContext(context);vm.runInContext(source,context);
 return win;
}
const named=data=>'mirror21-preview:'+JSON.stringify(data);

test('A preview phone on this computer: its own pretend storage, kept in the frame name, never the real one',()=>{
 for(const href of ['file:///C:/Mirror21/html/04-map-start.html','http://127.0.0.1:5500/html/04-map-start.html','http://localhost:8080/html/step-watch.html']){
  const win=frame(named({local:{'sb-mirror21-auth':'{"refresh_token":"x"}','mirror21-progress':'{}'}}),href);
  assert.equal(win.localStorage.getItem('sb-mirror21-auth'),'{"refresh_token":"x"}',href);
  win.localStorage.setItem('mirror21-unlock','7');
  assert.equal(JSON.parse(win.name.slice('mirror21-preview:'.length)).local['mirror21-unlock'],'7','The next page in this phone sees it');
  win.sessionStorage.setItem('mirror21-intro','3');assert.equal(win.sessionStorage.getItem('mirror21-intro'),'3');
  assert.equal(win.MirrorPreview.screen,null);
 }
});
test('On mirror21.app, or without the preview name, it does nothing: no way to skip sign-in there',()=>{
 for(const [name,href] of [[named({local:{'sb-mirror21-auth':'{"refresh_token":"x"}'}}),'https://mirror21.app/html/04-map-start'],['','file:///C:/Mirror21/html/04-map-start.html'],['mirror21-preview:not json','file:///C:/Mirror21/html/04-map-start.html'],[named({}),'https://evil.localhost.example/html/x.html']]){
  const win=frame(name,href);
  assert.equal(win.localStorage,real,href);assert.equal(win.MirrorPreview,undefined);
 }
});
test('The first page’s taps and Sign in screen are used once, not carried to the next page',()=>{
 const win=frame(named({local:{},screen:'codeScreen',act:['click .settings-gear']}),'file:///C:/Mirror21/html/02-sign-in.html');
 assert.equal(win.MirrorPreview.screen,'codeScreen');
 const kept=JSON.parse(win.name.slice('mirror21-preview:'.length));
 assert.deepEqual([kept.screen,kept.act],[undefined,undefined]);
});
