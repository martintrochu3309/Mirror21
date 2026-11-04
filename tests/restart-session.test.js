const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function storage(entries){const values=new Map(entries);return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,removeItem:key=>values.delete(key)};}
function restart(local,session){let destination;const status={textContent:''};
 const context=vm.createContext({localStorage:local,sessionStorage:session,location:{replace:value=>destination=value},document:{querySelector:()=>status}});
 for(const file of ['../assets/core/store.js','../assets/restart-session.js'])vm.runInContext(fs.readFileSync(require.resolve(file),'utf8'),context);
 return {destination,status:status.textContent};}
test('Restart clears this device’s attempt, bar, watch and scroll positions while preserving unrelated data',()=>{
 const local=storage([['mirror21-progress','saved'],['mirror21-audio-1','20'],['mirror21-audio-0','5'],['mirror21-bar-1','.5'],['mirror21-watched-0','true'],['mirror21-block-1','true'],['mirror21-reminder','09:00'],['other-app','keep']]);const session=storage([['mirror21-scroll-1-4','200'],['other-session','keep']]);
 const {destination}=restart(local,session);
 assert.equal(local.getItem('mirror21-progress'),null);assert.equal(local.getItem('mirror21-audio-0'),null);assert.equal(local.getItem('mirror21-audio-1'),null);assert.equal(local.getItem('mirror21-bar-1'),null);assert.equal(local.getItem('mirror21-watched-0'),null);assert.equal(local.getItem('mirror21-block-1'),null,'Block summaries count as unseen again');assert.equal(session.getItem('mirror21-scroll-1-4'),null);assert.equal(local.getItem('mirror21-reminder'),'09:00');assert.equal(local.getItem('other-app'),'keep');assert.equal(session.getItem('other-session'),'keep');assert.equal(destination,'step-watch.html?step=0');
});
test('Restart says so when the browser refuses to clear its storage',()=>{
 const refusing={get length(){throw Error('SecurityError');}};
 const {destination,status}=restart(refusing,refusing);
 assert.equal(destination,undefined);assert.match(status,/could not clear the saved session/);
});
