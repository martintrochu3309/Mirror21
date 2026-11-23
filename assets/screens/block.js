/* Block summary (html/block.html?block=N): the block's skills, one per step, each with that step's locked
   promise word for word. Opens only once the block's last step is committed; otherwise back to My Path.
   Opening it marks the block seen, so its map tile turns from black to white. Block 3 ends the course: it opens
   after the final check (finishedAt), and its one button, SEE MY RESULTS, leads to the result page. */
MirrorStore.ready(() => {
  const state = MirrorStore.course.load();
  const n = Number(new URLSearchParams(location.search).get('block'));
  const info = MirrorSteps.block(n);
  const last = n === 3;
  if (!info || !info.ready || !state.lessons[info.last] || (last && !state.finishedAt)) { location.replace(last && state.lessons[21] ? 'final-check.html' : '04-map-start.html'); return; }
  MirrorStore.device.markBlockSeen(n);

  const pad = step => String(step).padStart(2, '0');
  const el = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text != null) node.textContent = text; return node; };
  const $ = id => document.getElementById(id);
  document.title = 'Mirror 21 · Block ' + n + ' complete';
  $('blockEyebrow').textContent = 'BLOCK ' + n + ' COMPLETE';
  $('blockTitle').textContent = info.name;
  $('blockSub').textContent = 'The ' + info.skills.length + ' skills you’ve learned.';

  // Each skill: its gold number and name, the line under it, then YOUR PROMISE · STEP NN just above a grey tile
  // holding that step's promise.
  $('blockSkills').replaceChildren(...info.skills.map(([skill, line], i) => {
    const step = info.first + i, promise = (state.dayChanges[step] || '').trim();
    const item = el('li', 'block-skill');
    const head = el('div', 'block-skill-head');
    head.append(el('span', 'block-skill-num', pad(i + 1)), el('h2', 'block-skill-name', skill));
    const card = el('div', 'block-promise');
    card.append(el('p', 'block-promise-label', 'YOUR PROMISE · STEP ' + pad(step)),
      el('p', 'block-promise-text' + (promise ? '' : ' is-empty'), promise || 'Not written yet'));
    item.append(head, el('p', 'block-skill-line', line), card);
    return item;
  }));

  $('blockClosing').textContent = info.closing[0];
  $('blockNext').textContent = info.closing[1];
  if (last) {
    const button = $('blockButton');
    button.href = 'result.html';
    button.textContent = 'SEE MY RESULTS';
  }
  document.documentElement.dataset.mirrorReady = 'true';
});
