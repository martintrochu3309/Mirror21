// Builds every page in html/ from its source in src/. Plain Node, nothing to install.
//   node tools/build.js           write html/ (and assets/core/content.js) from src/
//   node tools/build.js --check   only check that html/ matches src/ (the unit tests run this)
//
// A page's source holds only what is its own: everything after the head lines every page shares (charset,
// viewport, Home Screen icon and tags). Inside a source:
//   <!--@theme-color #000000-->   this page's browser-bar colour (default white)
//   <!--#name key="value"-->      the shared block src/partials/name.html, with {{key}} filled in
// Local scripts and stylesheets get the version stamp below, so every device fetches the new files after a change.
// Step pages come from src/steps/stepNN/learn.html and act.html; each step's step.js (its title, video, examples,
// promise and journal rows) is gathered into assets/core/content.js for the app to read.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const VERSION = '20261021-signin';
const src = (...parts) => path.join(root, 'src', ...parts);
const read = file => fs.readFileSync(file, 'utf8');

const COMMON = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<link rel="manifest" href="../manifest.webmanifest">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<meta name="apple-mobile-web-app-title" content="Mirror 21">',
  '<meta name="theme-color" content="{{theme}}">',
  '<link rel="apple-touch-icon" href="../assets/icons/apple-touch-icon.png">'
];

function partial(name, params, seen = []) {
  if (seen.includes(name)) throw Error('Partial includes itself: ' + [...seen, name].join(' → '));
  const file = src('partials', name + '.html');
  if (!fs.existsSync(file)) throw Error('No partial src/partials/' + name + '.html');
  const text = read(file).replace(/\r\n/g, '\n').replace(/\n$/, '');
  return expand(text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in params)) throw Error('Partial ' + name + ' needs ' + key + '="…"');
    return params[key];
  }), [...seen, name]);
}
// A partial on a line of its own takes that line's indent on every line.
function expand(text, seen = []) {
  return text.replace(/^([ \t]*)<!--#([\w-]+)((?:\s+\w+="[^"]*")*)\s*-->/gm, (_, indent, name, args) => {
    const params = Object.fromEntries(Array.from(args.matchAll(/(\w+)="([^"]*)"/g), ([, key, value]) => [key, value]));
    return partial(name, params, seen).split('\n').map(line => line ? indent + line : line).join('\n');
  });
}
const stamp = text => text
  .replace(/(<script\b[^>]*\bsrc=")(\.\.\/assets\/[^"?]+\.js)(")/g, '$1$2?v=' + VERSION + '$3')
  .replace(/(<link\b[^>]*\brel="stylesheet"[^>]*\bhref=")(\.\.\/assets\/[^"?]+\.css)(")/g, '$1$2?v=' + VERSION + '$3');

function page(sourceFile) {
  let text = read(sourceFile).replace(/\r\n/g, '\n');
  let theme = '#ffffff';
  text = text.replace(/^<!--@theme-color (#[0-9a-f]{6})-->\n/i, (_, color) => { theme = color; return ''; });
  const relative = path.relative(root, sourceFile).split(path.sep).join('/');
  const head = COMMON.map(line => line.replace('{{theme}}', theme));
  head.splice(3, 0, '<!-- Built from ' + relative + ' by tools/build.js: edit that file, then run node tools/build.js. -->');
  return stamp(head.join('\n') + '\n' + expand(text));
}

// Every page: its source and where it is written.
function pages() {
  const list = [];
  for (const name of fs.readdirSync(src('pages')).filter(f => f.endsWith('.html')).sort()) list.push([src('pages', name), name]);
  if (fs.existsSync(src('steps'))) for (const dir of fs.readdirSync(src('steps')).filter(d => /^step\d\d$/.test(d)).sort()) {
    const n = Number(dir.slice(4));
    for (const screen of ['learn', 'act']) {
      const file = src('steps', dir, screen + '.html');
      if (fs.existsSync(file)) list.push([file, n === 1 ? 'step-' + screen + '.html' : dir + '-' + screen + '.html']);
    }
  }
  return list;
}
// assets/core/content.js: every step's step.js, in order, as one file the pages load.
function content() {
  if (!fs.existsSync(src('steps'))) return null;
  const parts = fs.readdirSync(src('steps')).filter(d => /^step\d\d$/.test(d) && fs.existsSync(src('steps', d, 'step.js'))).sort()
    .map(dir => '// ---- src/steps/' + dir + '/step.js\n' + read(src('steps', dir, 'step.js')).replace(/\r\n/g, '\n').trim() + '\n');
  if (!parts.length) return null;
  return read(src('content-head.js')).replace(/\r\n/g, '\n').replace('/* STEPS */\n', parts.join('\n')) ;
}

function build(check) {
  const outputs = pages().map(([from, name]) => [path.join(root, 'html', name), page(from)]);
  const bundle = content();
  if (bundle) outputs.push([path.join(root, 'assets', 'core', 'content.js'), bundle]);
  const stale = outputs.filter(([file, text]) => !fs.existsSync(file) || read(file).replace(/\r\n/g, '\n') !== text);
  if (check) {
    if (stale.length) { console.error('Out of date (run node tools/build.js):\n  ' + stale.map(([file]) => path.relative(root, file)).join('\n  ')); process.exitCode = 1; }
    else console.log(outputs.length + ' files match their sources.');
    return stale.length === 0;
  }
  for (const [file, text] of stale) fs.writeFileSync(file, text);
  console.log(stale.length ? 'Wrote ' + stale.map(([file]) => path.relative(root, file)).join(', ') : 'Nothing to change: ' + outputs.length + ' files match their sources.');
  return true;
}

if (require.main === module) build(process.argv.includes('--check'));
module.exports = { build, page, pages, VERSION };
