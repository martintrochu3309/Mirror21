const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const model = require('../assets/progress.js');
const script = fs.readFileSync(require.resolve('../assets/prototype.js'), 'utf8');
function open(stored, hash = '') {
  const storage = new Map(stored ? [['mirror21-progress', JSON.stringify(stored)]] : []);
  const events = {};
  let replaced;
  const context = {
    MirrorProgress: model, URL, URLSearchParams, Date,
    location: { pathname: '/html/00-landing.html', search: '', hash, href: 'file:///preview/html/00-landing.html'+hash, protocol: 'file:' },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    history: { replaceState: (_state, _title, url) => { replaced = url; } },
    document: { querySelector: () => null, querySelectorAll: () => [], addEventListener: (name, fn) => { (events[name] ||= []).push(fn); } },
    window: { addEventListener() {} }, setInterval() {}
  };
  vm.runInNewContext(script, context);
  return { storage, events, replaced };
}
test('a shared progress URL starts fresh on a new device', () => {
  const other = model.fresh();
  other.lessons[1] = true; model.record(other, 1, 'yes');
  const result = open(null, '#'+new URLSearchParams({progress: JSON.stringify(other)}));
  const saved = JSON.parse(result.storage.get('mirror21-progress'));
  assert.equal(model.stats(saved).today, 1);
  assert.equal(model.stats(saved).checkIns, 0);
  assert.equal(result.replaced, '/html/00-landing.html');
});
test('returning devices retain their own history even when a shared URL contains newer progress', () => {
  const own = model.fresh();
  own.lessons[1] = true; model.record(own, 1, 'partly');
  const other = model.fresh(); other.updatedAt = Date.now()+1000;
  other.lessons[1] = other.lessons[2] = true; model.record(other, 1, 'yes'); model.record(other, 2, 'yes');
  const result = open(own, '#'+new URLSearchParams({progress: JSON.stringify(other)}));
  assert.deepEqual(JSON.parse(result.storage.get('mirror21-progress')).answers, {1:'partly'});
});
test('navigation never exports history in a local-file link', () => {
  const result = open(model.fresh());
  const link = {href: 'file:///preview/html/18-my-mirror.html#progress=old'};
  for (const handler of result.events.click) handler({target: {closest: () => link}, defaultPrevented: false});
  assert.equal(new URL(link.href).hash, '');
});
