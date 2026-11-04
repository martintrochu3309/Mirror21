// The step catalogue: titles, each step's Watch content, where its lesson comes from, its examples and the blocks.
// Each step's own content lives in src/steps/stepNN/step.js (gathered into assets/core/content.js, loaded first).
(function (root) {
  const content = typeof module !== 'undefined' && module.exports ? require('./content.js').steps : root.MirrorContent.steps;
  const titles = Array.from({ length: 22 }, (_, n) => content[n].title);
  // Watch screen, per step: portrait video, start image (its first frame), finish image (its last frame,
  // so nothing jumps when it ends; empty = start image, dimmed), length shown before the video loads,
  // and the button label. An empty video shows "VIDEO COMING SOON" with simulated playback.
  // A filmed step: Audio-Video/StepNN-Watch.mp4, with its first and last frames as stepNN-start/-finish.jpg.
  const filmed = (step, duration) => {
    const nn = String(step).padStart(2, '0');
    return { video: '../Audio-Video/Step' + nn + '-Watch.mp4', image: '../assets/images/step' + nn + '-start.jpg', finish: '../assets/images/step' + nn + '-finish.jpg', duration };
  };
  // A step's watch: '1:24' (filmed), { filmed: '1:24', cover: 24 } (filmed, its own fade), or its own settings.
  const watchOf = (step, watch) => typeof watch === 'string' ? filmed(step, watch)
    : watch.filmed ? (({ filmed: duration, ...own }) => ({ ...filmed(step, duration), ...own }))(watch) : watch;
  const watch = Object.fromEntries(Object.keys(content).map(n => [n, watchOf(Number(n), content[n].watch)]));
  // cover: how much of the screen's height the black fade at the bottom covers (in %), so it can be tuned per
  // video in its step.js, e.g. watch: { filmed: '1:25', cover: 24 }.
  const defaults = { video: '', image: '../assets/images/step01-start.jpg', finish: '', duration: '', next: 'LEARN', cover: 30 };
  const available = step => Number.isInteger(step) && step >= 0 && step <= 21;
  // Lesson (Learn + Act) this step shows: each available step has its own (Step 01's is the generic page).
  const lesson = step => available(step) && step > 0 ? step : null;
  // Page for a screen of a step: Check in and Watch are shared, Learn and Act follow the lesson.
  const page = (step, screen) => (screen === 'learn' || screen === 'act') && lesson(step) > 1 ? 'step' + String(lesson(step)).padStart(2, '0') + '-' + screen + '.html' : 'step-' + screen + '.html';
  // "See an example" on Act, per lesson and answer box (its data-answer, data-field or id, in capitals): the words
  // that finish the box's sentence starter, from the Learn pages' story of someone who wants to wake up rested.
  // A box without one (Step 11's date, and Step 20's blank card, on purpose) shows no link.
  const example = (step, key) => content[lesson(step)]?.examples?.[key] || '';
  // The three blocks of seven steps. Each ends with a summary page (html/block.html?block=N), reached from a tile
  // beside its last step: one skill per step (its step.js), then the closing lines. A block without skills has no page yet.
  const blocks = [
    // description: what the block is for (not shown anywhere yet).
    { name: 'MAKE THE MOVE', description: 'Build the actions.', first: 1, last: 7, closing: ['You’ve made the move.', 'Next, you make it stick.'] },
    { name: 'MAKE IT STICK', description: 'Learn how to sustain and progress them.', first: 8, last: 14, closing: ['You’ve learned how to make it stick.', 'Next, you make it yours.'] },
    // Block 3's summary opens after the final check, just before the result page (see assets/screens/block.js).
    { name: 'MAKE IT YOURS', description: 'Use the Mirror Method on any change, for the rest of your life.', first: 15, last: 21, closing: ['You’ve learned the method.', 'What you do with it starts with you.'] }
  ].map(block => ({ ...block, skills: Array.from({ length: block.last - block.first + 1 }, (_, i) => content[block.first + i].skill).filter(Boolean) }));
  const block = n => blocks[n - 1] ? { number: n, ...blocks[n - 1], ready: blocks[n - 1].skills.length > 0 } : null;
  // A saved date (YYYY-MM-DD) in plain words: within the coming week just the weekday ("Sunday"),
  // otherwise weekday, day and month ("Sunday 9 November"). Without `from`, always the full form.
  const plainDate = (iso, from) => {
    const [y, m, d] = String(iso || '').split('-').map(Number);
    if (!y || !m || !d) return '';
    const date = new Date(y, m - 1, d);
    const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
    const full = weekday + ' ' + d + ' ' + date.toLocaleDateString('en-GB', { month: 'long' });
    if (!from) return full;
    const days = Math.round((date - new Date(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000);
    return days >= 1 && days <= 6 ? weekday : full;
  };
  // The two Mirror Method cards, as Step 21 and the result page show them: Step 19's (guided, the original change)
  // and Step 20's (on their own, a new change), each answer as its whole sentence, with that step's evening result.
  // Read-only: the saved answers are never changed.
  const toolNames = { anchor: 'My anchor.', swap: 'My swap and my line.', minimum: 'My minimum.', restart: 'My restart rule.' };
  const said = (starter, words) => (words || '').trim() ? (starter ? starter + ' ' : '') + words.trim() : '';
  function cards(state) {
    const r19 = state.responses[19] || {}, r20 = state.responses[20] || {};
    // MY MOVE on the card: the update made there, otherwise the move as it was (Step 14's new bar if raised).
    const raised = state.responses[14]?.DECISION === 'raise' && state.responses[14].NEWBAR;
    const move = r19.MOVECHOICE === 'update' ? r19.MOVE : raised || state.responses[3]?.MOVE;
    return [
      { step: 19, title: 'MY MIRROR METHOD', result: state.answers[19] || null, rows: [
        ['SEE IT', said('What’s happening now is', r19.SEE)], ['OWN IT', said('The part that’s mine is', r19.OWN)],
        ['MY MOVE', said('My move is', move)], ['MY TOOL', toolNames[r19.TOOL] || ''], ['TODAY’S ACTION', said('Today, I’ll', r19.ACTION)]] },
      { step: 20, title: 'MY MIRROR METHOD: NEW CHANGE', result: state.answers[20] || null, rows: [
        ['MY NEW CHANGE', said('', r20.NEWCHANGE)], ['SEE IT', said('', r20.SEE)], ['OWN IT', said('', r20.OWN)],
        ['CHANGE IT', said('', r20.CHANGEIT)], ['MY FIRST MOVE TODAY', said('', r20.FIRST)]] }
    ];
  }
  // An evening result in the map's marks (YES full gold, PARTLY half, NO a ring), or — before it's answered.
  function resultMark(answer) {
    const mark = document.createElement('span');
    mark.className = 'record-mark ' + (answer || 'none');
    mark.textContent = { yes: 'YES', partly: 'PARTLY', no: 'NO' }[answer] || '—';
    return mark;
  }
  // The cards as closed panels, as Step 21 and the result page show them: 19 · My Mirror Method · its result · an
  // arrow. Opened: each part's name (SEE IT, OWN IT…) with the answer under it.
  const cardNames = { 19: 'My Mirror Method', 20: 'My Mirror Method “New Change”' };
  function cardList(state) {
    const el = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text != null) node.textContent = text; return node; };
    const chevron = '<svg class="method-card-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    return cards(state).map(card => {
      const panel = el('details', 'method-card');
      const head = el('summary', 'method-card-head');
      head.append(el('span', 'method-card-num', String(card.step)), el('span', 'method-card-title', cardNames[card.step]), resultMark(card.result));
      head.insertAdjacentHTML('beforeend', chevron);
      const rows = el('dl', 'method-card-rows');
      card.rows.filter(([, text]) => text).forEach(([label, text]) => { const row = el('div', 'method-card-row'); row.append(el('dt', '', label), el('dd', '', text)); rows.append(row); });
      panel.append(head, rows);
      return panel;
    });
  }
  const api = {
    titles, available, lesson, page, plainDate, block, example, cards, cardList, resultMark,
    title: step => titles[step] || '',
    // Screen headline: caps with a closing full stop, as in the handoff.
    headline: step => titles[step] ? titles[step].toUpperCase() + '.' : '',
    media: step => available(step) ? { ...defaults, ...watch[step] } : null,
    pad: step => String(step).padStart(2, '0')
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MirrorSteps = api;
})(globalThis);
