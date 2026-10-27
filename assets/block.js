/* Block summary (html/block.html?block=N): the block's skills, one per step, each with that step's locked
   promise word for word. Opens only once the block's last step is committed; otherwise back to My Path.
   Opening it marks the block seen, so its map tile turns from black to white. */
(() => {
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  let raw;
  try { raw = JSON.parse(read('mirror21-progress')); } catch {}
  const state = MirrorProgress.normalize(raw);
  const n = Number(new URLSearchParams(location.search).get('block'));
  const info = MirrorSteps.block(n);
  if (!info || !info.ready || !state.lessons[info.last]) { location.replace('04-map-start.html'); return; }
  write('mirror21-block-' + n, 'true');

  const pad = step => String(step).padStart(2, '0');
  const el = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text != null) node.textContent = text; return node; };
  const $ = id => document.getElementById(id);
  document.title = 'Mirror 21 · Block ' + n + ' complete';
  $('blockEyebrow').textContent = 'BLOCK ' + n + ' COMPLETE';
  $('blockTitle').textContent = info.name;
  $('blockSub').textContent = 'The ' + info.skills.length + ' skills you’ve learned.';

  // BLOCK 1 · BLOCK 2 · BLOCK 3: gold up to this block, this block's name in black.
  $('blockBar').replaceChildren(...[1, 2, 3].map(k => {
    const part = el('div', 'block-bar-part' + (k <= n ? ' is-done' : '') + (k === n ? ' is-here' : ''));
    part.append(el('span', 'block-bar-fill'), el('span', 'block-bar-label', 'BLOCK ' + k));
    return part;
  }));

  $('blockSkills').replaceChildren(...info.skills.map(([skill, line], i) => {
    const step = info.first + i, promise = (state.dayChanges[step] || '').trim();
    const item = el('li', 'block-skill');
    const body = el('div', 'block-skill-body');
    const card = el('div', 'block-promise');
    card.append(el('p', 'block-promise-label', 'YOUR PROMISE · STEP ' + pad(step)),
      el('p', 'block-promise-text' + (promise ? '' : ' is-empty'), promise || 'Not written yet'));
    body.append(el('h2', 'block-skill-name', skill), el('p', 'block-skill-line', line), card);
    item.append(el('span', 'block-skill-num', pad(i + 1)), body);
    return item;
  }));

  $('blockClosing').textContent = info.closing[0];
  $('blockNext').textContent = info.closing[1];
  document.documentElement.dataset.mirrorReady = 'true';
})();
