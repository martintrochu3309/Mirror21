const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../assets/prototype.js'),'utf8');
const setup=source.slice(source.indexOf('  // Netlify Pretty URLs'),source.indexOf('  const model = MirrorProgress;'));
function route(pathname,hrefs=[]){
 const links=hrefs.map(href=>({href,getAttribute(){return this.href;},setAttribute(_key,value){this.href=value;}}));
 const context={URL,location:{pathname,origin:'https://mirror21.netlify.app',href:'https://mirror21.netlify.app'+pathname},document:{querySelectorAll:()=>links}};
 vm.createContext(context);vm.runInContext(setup+';globalThis.page=filename;',context);
 return {page:context.page,links:links.map(link=>link.href)};
}
test('Netlify clean URLs identify all map, step, Check and Mirror pages correctly',()=>{
 for(const name of fs.readdirSync(require('node:path').join(__dirname,'../html'))){
  if(!name.endsWith('.html'))continue;
  assert.equal(route('/html/'+name).page,name);
  assert.equal(route('/html/'+name.slice(0,-5)).page,name);
 }
});
test('Netlify rewritten anchors retain step and map links',()=>{
 const input=['/html/step-checkin?step=2','/html/19-my-journey','/html/18-my-mirror','#reminder','https://other.example/html/step-learn'];
 assert.deepEqual(route('/html/04-map-start',input).links,['step-checkin.html?step=2','19-my-journey.html','18-my-mirror.html','#reminder','https://other.example/html/step-learn']);
});
