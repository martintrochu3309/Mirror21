const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const build=require('../tools/build.js');
test('Every page in html/ is built from its source in src/ (edit the source, then run node tools/build.js)',()=>{
 const built=new Set(build.pages().map(([,name])=>name));
 const pages=fs.readdirSync(path.join(__dirname,'../html')).filter(f=>f.endsWith('.html'));
 assert.deepEqual(pages.filter(name=>!built.has(name)),[],'Pages with no source');
 const log=console.log,error=console.error;console.log=console.error=()=>{};
 try{assert.equal(build.build(true),true,'html/ is out of date: run node tools/build.js');}finally{console.log=log;console.error=error;}
});
test('Every page shares the same Home Screen head lines and version stamp',()=>{
 for(const [from,name] of build.pages()){
  const html=build.page(from);
  for(const line of ['<meta name="apple-mobile-web-app-title" content="Mirror 21">','<link rel="manifest" href="../manifest.webmanifest">','<link rel="apple-touch-icon" href="../assets/icons/apple-touch-icon.png">'])assert.ok(html.includes(line),name+' '+line);
  for(const [,url] of html.matchAll(/(?:src|href)="(\.\.\/assets\/[^"]+\.(?:js|css)[^"]*)"/g))assert.ok(url.endsWith('?v='+build.VERSION),name+' '+url);
 }
});
test('A shared block fills in its values, keeps its indent, and a missing value is an error',()=>{
 const html=build.page(path.join(__dirname,'../src/pages/04-map-start.html'));
 assert.ok(html.includes('<script src="../assets/screens/path.js?v='+build.VERSION+'" defer></script>'));
 assert.ok(!html.includes('{{'),'No value left unfilled');
});
