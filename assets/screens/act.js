/* Act: the answer boxes, then MY PROMISE, locked with I'M COMMITTED. Three versions: Step 01's, Step 02's, and
   the one Steps 03–21 share. Run by the step shell. */
(globalThis.MirrorScreens ||= {}).act = ({ model, steps, store, state, step, committed, record, save, refreshBar, pad, map, reduceMotion, showEarlier }) => {
  // Step 01 and Step 02 have their own Act; Steps 03–21 share one, set by each step's step.js.
  (steps.lesson(step) === 2 ? act02Screen : steps.lesson(step) >= 3 ? twoBoxActScreen : actScreen)(); seeAnExample();

  // Act · "See an example": a quiet link between a box's helper line and the box. It opens in place to show
  // the box's sentence starter in grey and an example answer in italics. Only the question being answered
  // shows it (its row active and its Next arrow still showing), so there is at most one on screen; it closes
  // again once the user moves on. Answered boxes, read-only rows, checks and the promise never show it.
  function seeAnExample() {
    const chevron = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    const blocks = Array.from(document.querySelectorAll('.starter-wrap')).map(wrap => {
      const box = wrap.querySelector('textarea');
      const key = box && (box.dataset.answer || box.dataset.field || box.id).toUpperCase();
      const words = key && steps.example(step, key);
      if (!words) return null;
      const example = document.createElement('div'); example.className = 'example'; example.hidden = true;
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'example-toggle';
      const text = document.createElement('p'); text.className = 'example-text'; text.id = 'example-' + key.toLowerCase(); text.hidden = true;
      // A box asked as a question (Step 18's MY KEEP) has no starter: just the example answer.
      const lead = wrap.querySelector('.starter');
      const starter = document.createElement('span'); starter.className = 'example-starter'; starter.textContent = lead ? lead.textContent.trim() : '';
      const answer = document.createElement('em'); answer.textContent = words;
      text.append(...lead ? [starter, ' '] : [], answer);
      toggle.setAttribute('aria-controls', text.id);
      const show = open => { text.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); toggle.innerHTML = (open ? 'Hide example' : 'See an example') + ' ' + chevron; toggle.classList.toggle('is-open', open); };
      show(false);
      toggle.addEventListener('click', () => show(text.hidden));
      example.append(toggle, text);
      wrap.before(example);
      return { example, row: wrap.closest('.row'), show };
    }).filter(Boolean);
    const sync = () => blocks.forEach(({ example, row, show }) => {
      const next = row.querySelector('.next-row');
      const answering = row.classList.contains('is-active') && Boolean(next) && !next.hidden;
      // Only touch what changes: the observer below would otherwise wake itself up.
      if (!answering && !example.hidden) show(false);
      if (example.hidden !== !answering) example.hidden = !answering;
    });
    sync();
    const rows = document.querySelector('.rows');
    if (rows) new MutationObserver(sync).observe(rows, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  }

  // Answer boxes open with a fixed sentence starter in grey, set in front of the box: the user only
  // finishes the sentence. The first line of typing starts right after it. A box asked as a question (Step 18's
  // MY KEEP and MY STOP) has no starter, so an honest "Nothing yet" reads naturally.
  // A long starter ("The move that matters most is") leaves no room for a word after it, and the box
  // would split that word: then the answer starts on the line below the starter instead.
  function fitStarter(box) {
    const starter = box.parentElement.querySelector('.starter');
    if (!starter) return;
    const indent = () => {
      const style = getComputedStyle(box);
      const room = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - starter.offsetWidth;
      const ownLine = room < 80;
      box.style.textIndent = ownLine ? '0px' : starter.offsetWidth + 'px';
      box.style.paddingTop = ownLine ? 14 + parseFloat(style.lineHeight) + 'px' : '';
    };
    indent();
    document.fonts.ready.then(indent);
  }

  // MY PROMISE: "Today, I will [their words]." with "Today I will" said once.
  function promiseFor(words) { return 'Today, I will ' + words + (/[.!?]$/.test(words) ? '' : '.'); }

  // I'M COMMITTED: press and hold for a second; releasing early resets. Enter/Space commits for keyboard users.
  function holdToCommit(hold, holdFill, onCommit) {
    const HOLD_MS = 1000;
    let raf = null, t0 = 0;
    function frame(t) {
      const p = Math.min(1, (t - t0) / HOLD_MS);
      holdFill.style.width = p * 100 + '%';
      if (p >= 1) { raf = null; onCommit(); if (navigator.vibrate) navigator.vibrate(30); return; }
      raf = requestAnimationFrame(frame);
    }
    function start(event) { if (hold.disabled || raf) return; event.preventDefault(); t0 = performance.now(); raf = requestAnimationFrame(frame); }
    function stop() { if (!raf) return; cancelAnimationFrame(raf); raf = null; holdFill.style.width = '0%'; }
    hold.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(name => hold.addEventListener(name, stop));
    hold.addEventListener('keydown', event => {
      if (!hold.disabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); holdFill.style.width = '100%'; onCommit(); }
    });
  }

  // Lock the promise for good, word for word as the next check-in will show it, then return to the map.
  function commitPromise(promise) {
    state.lessons[step] = true;
    record.committedAt = new Date().toISOString();
    state.dayChanges[step] = promise.slice(0, 600);
    state.change = state.dayChanges[step];
    // My Path shows the next step opening in front of him (assets/screens/path.js).
    store.device.setUnlock(step);
  }
  // After I'M COMMITTED: COMMITTED shows for a moment, then straight back to My Path.
  function returnToMap() { setTimeout(() => { location.href = map; }, 300); }

  function scrollToRow(target, focusBox) {
    setTimeout(() => {
      const y = target.getBoundingClientRect().top + scrollY - 24;
      scrollTo({ top: Math.max(0, y), behavior: reduceMotion() ? 'auto' : 'smooth' });
      const box = focusBox && target.querySelector('textarea');
      if (box && !box.disabled && !box.readOnly) { box.focus({ preventScroll: true }); box.setSelectionRange(box.value.length, box.value.length); }
    }, 60);
  }

  function actScreen() {
    // Stages: 0 present · 1 here · 2 there · 3 test · 4 my step · 5 commit · 6 done.
    const answers = state.responses[step] ||= {};
    const keys = { here: 'HERE', there: 'THERE', step: 'STEP' };
    const isCommitted = () => Boolean(state.lessons[step]);
    if (committed) record.stage = 6;
    const rows = Array.from(document.querySelectorAll('.row'));
    const boxes = { here: document.getElementById('a-here'), there: document.getElementById('a-there'), step: document.getElementById('a-step') };
    const fieldStage = { here: 1, there: 2, step: 4 };
    const nextStage = { here: 2, there: 3, step: 5 };
    // The saved answer is the whole sentence, starter included; the box holds only the user's words.
    const STARTERS = { here: 'Right now, I', there: 'I want to be able to', step: 'Today I will' };
    const typed = field => {
      const saved = answers[keys[field]] || '';
      return saved.startsWith(STARTERS[field] + ' ') ? saved.slice(STARTERS[field].length + 1) : saved;
    };
    const written = field => typed(field).trim();
    const allWritten = () => Object.keys(boxes).every(written);
    const promiseText = () => written('step') ? promiseFor(written('step')) : 'Today, I will …';
    const promise = document.getElementById('promise');
    const commit = document.getElementById('commit');
    const hold = document.getElementById('hold');
    const done = document.getElementById('done');
    document.getElementById('doneText').textContent = 'Step ' + pad(step + 1) + ' is open. It starts by asking how your step went.';
    Object.values(boxes).forEach(fitStarter);

    function render(scroll) {
      const st = record.stage;
      rows.forEach(row => {
        const k = Number(row.dataset.k);
        const isDone = st > k, active = st === k, locked = st < k;
        row.classList.toggle('is-done', isDone);
        row.classList.toggle('is-active', active);
        row.classList.toggle('is-locked', locked);
        row.setAttribute('aria-disabled', locked ? 'true' : 'false');
        row.querySelectorAll('[data-when]').forEach(el => {
          const when = el.dataset.when;
          el.hidden = !((when === 'active' && active) || (when === 'done' && isDone) || (when === 'not-done' && !isDone));
        });
        row.querySelectorAll('button.pill').forEach(button => { button.disabled = locked; });
        const retest = row.querySelector('[data-action="retest"]');
        if (retest) retest.disabled = isCommitted();
      });
      Object.keys(boxes).forEach(field => {
        const box = boxes[field];
        if (box.value !== typed(field)) box.value = typed(field);
        box.disabled = st < fieldStage[field];
        // Committing locks the promise for good.
        box.readOnly = isCommitted();
        document.querySelector('[data-next="' + field + '"]').disabled = !written(field);
      });
      // "Today, I will" in grey, the user's words in black (as on Learn and the other steps).
      const words = document.createElement('span');
      words.className = 'promise-rest' + (written('step') ? '' : ' is-empty');
      words.textContent = promiseText().slice('Today, I will '.length);
      promise.replaceChildren('Today, I will ', words);
      document.getElementById('notSureHint').hidden = !(record.notSure && st === 2);
      commit.classList.toggle('is-locked', st < 5);
      commit.hidden = st === 6;
      hold.disabled = st !== 5 || !allWritten();
      done.hidden = st !== 6;
      if (scroll) scrollToRow(st === 6 ? done : st === 5 ? commit : rows[st], true);
    }

    function go(stage, extra) {
      record.stage = stage;
      Object.assign(record, extra || {});
      document.getElementById('notYetNote').hidden = true;
      if (stage === 6) commitPromise(promiseFor(written('step')));
      save(); refreshBar(); render(true);
      if (stage === 6) returnToMap();
    }

    // Typing autosaves; Return moves on (no new lines: answers are a sentence or two).
    Object.keys(boxes).forEach(field => {
      const box = boxes[field];
      const advance = () => {
        if (written(field) && record.stage === fieldStage[field]) go(nextStage[field], field === 'there' ? { notSure: false } : null);
      };
      box.addEventListener('input', () => {
        if (isCommitted()) return;
        answers[keys[field]] = STARTERS[field] + ' ' + box.value;
        save(); render(false);
      });
      box.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); advance(); } });
      document.querySelector('[data-next="' + field + '"]').addEventListener('click', advance);
    });

    document.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button || button.disabled || isCommitted()) return;
      const action = button.dataset.action;
      if (action === 'here') go(1);
      if (action === 'notyet') document.getElementById('notYetNote').hidden = false; // the step stays here, nothing lost
      if (action === 'yes') go(4);
      if (action === 'notsure') go(2, { notSure: true });
      if (action === 'retest') go(3);
    });

    holdToCommit(hold, document.getElementById('holdFill'), () => go(6));
    render(false);
  }

  function act02Screen() {
    // Step 02 · Stages: 0 action · 1 proof · 2 promise · 3 committed.
    // 01 THERE is read-only from the step before; 02 PROOF = MY ACTION + "Could you prove you did it?";
    // 03 ONCE = MY PROMISE, built from MY ACTION and locked with I'M COMMITTED.
    const PROGRESS = [0.35, 0.6, 0.85, 1];
    const answers = state.responses[step] ||= {};
    const isCommitted = () => Boolean(state.lessons[step]);
    const $ = id => document.getElementById(id);
    const box = $('action'), rowAction = $('rowAction'), rowPromise = $('rowPromise'), hold = $('hold');
    const action = () => (answers.ACTION || '').trim();
    showEarlier();
    $('lockedText').textContent = 'Your promise is locked. Step ' + pad(step + 1) + ' starts by asking how it went.';
    if (committed) record.stage = 3;
    if (!committed) { record.act = PROGRESS[record.stage] ?? PROGRESS[0]; save(); }
    fitStarter(box);

    function render(scroll) {
      const s = record.stage, has = Boolean(action());
      if (box.value !== (answers.ACTION || '')) box.value = answers.ACTION || '';
      box.readOnly = isCommitted();
      rowAction.classList.toggle('is-active', s <= 1); rowAction.classList.toggle('is-done', s >= 2);
      rowPromise.classList.toggle('is-locked', s < 2); rowPromise.classList.toggle('is-active', s === 2); rowPromise.classList.toggle('is-done', s === 3);
      rowPromise.setAttribute('aria-disabled', s < 2 ? 'true' : 'false');
      $('nextRow').hidden = s !== 0;
      $('next').disabled = !has;
      $('proofQ').hidden = s !== 1;
      $('proofYes').disabled = $('proofNotSure').disabled = s !== 1;
      $('proved').hidden = s < 2;
      $('proved').disabled = s === 3;
      $('proofHint').hidden = !(record.notSure && s === 0);
      const rest = $('promiseRest');
      rest.textContent = has ? action() + (/[.!?]$/.test(action()) ? '' : '.') : '…';
      rest.classList.toggle('is-empty', !has);
      hold.disabled = s !== 2 || !has;
      $('commitBlock').hidden = s === 3;
      $('lockedBlock').hidden = s !== 3;
      if (scroll) scrollToRow(s >= 2 ? rowPromise : rowAction, s === 0);
    }

    function go(stage, extra) {
      if (isCommitted()) return;
      record.stage = stage;
      record.act = PROGRESS[stage];
      Object.assign(record, extra || {});
      if (stage === 3) commitPromise(promiseFor(action()));
      save(); refreshBar(); render(true);
      if (stage === 3) returnToMap();
    }

    box.addEventListener('input', () => {
      if (isCommitted()) return;
      answers.ACTION = box.value;
      save(); render(false);
    });
    box.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); if (action() && record.stage === 0) go(1, { notSure: false }); }
    });
    $('next').addEventListener('click', () => { if (action()) go(1, { notSure: false }); });
    $('proofYes').addEventListener('click', () => go(2));
    $('proofNotSure').addEventListener('click', () => { go(0, { notSure: true }); box.focus(); });
    // Tapping "Yes, I could prove it." redoes the proof check before committing.
    $('proved').addEventListener('click', () => { if (record.stage === 2) go(1); });
    holdToCommit(hold, $('holdFill'), () => go(3));
    render(false);
  }

  // Steps 03–21 · Answers read-only from earlier steps, one or more boxes, perhaps a YES / NOT SURE check, then MY
  // PROMISE. Stages: one per box (0, 1…), then check, promise, committed (two boxes: 2 · 3 · 4). Each box saves the
  // user's typed words under its data-answer key. Per lesson (the act field of its src/steps/stepNN/step.js): the step
  // the read-only answer comes from, the box NOT SURE sends you back to (its hint sits in that row), and the promise,
  // built from the boxes (numbers are box indexes) and earlier answers ({ from: step, key }). A page without the
  // check (Steps 07–21) goes from the last box straight to MY PROMISE.
  function twoBoxActScreen() {
    const lessonSetup = MirrorContent.steps[steps.lesson(step)].act;
    const answers = state.responses[step] ||= {};
    // A choice can start already made (Step 19's KEEP THIS MOVE): data-default.
    document.querySelectorAll('[data-answer][data-default]').forEach(box => { if (!state.lessons[step] && answers[box.dataset.answer] === undefined) answers[box.dataset.answer] = box.dataset.default; });
    const isCommitted = () => Boolean(state.lessons[step]);
    const $ = id => document.getElementById(id);
    // A box is a textarea; a date (Steps 11 and 13): a hidden date input over a box that shows the day in plain
    // words; or a choice (Step 13's tool): a hidden input set by its row's [data-choice] buttons.
    const boxes = Array.from(document.querySelectorAll('[data-answer]'));
    const isDate = i => boxes[i].type === 'date';
    const isChoice = i => boxes[i].type === 'hidden';
    const keys = boxes.map(box => box.dataset.answer);
    const rows = boxes.map(box => box.closest('.row')), rowPromise = $('rowPromise'), hold = $('hold');
    const hasCheck = Boolean($('proofQ'));
    const CHECK = boxes.length, PROMISE = CHECK + 1, DONE = PROMISE + 1;
    // A box marked data-when="KEY=value" is only asked after that choice (Step 14's MY NEW BAR, after RAISE THE
    // BAR); otherwise its row is hidden and skipped.
    const needed = i => { const [key, value] = (boxes[i].dataset.when || '').split('='); return !key || answers[key] === value; };
    const lastNeeded = () => boxes.reduce((found, box, i) => needed(i) ? i : found, 0);
    // Act's share per stage: the boxes spread over 10–60%, then check 60%, promise 85%, committed 100%.
    const PROGRESS = [...boxes.map((box, i) => 0.1 + 0.5 * i / boxes.length), 0.6, 0.85, 1];
    const written = i => (answers[keys[i]] || '').trim();
    // The user's words inside the promise, without a closing full stop or their own quotation marks
    // (the sentence carries its own: Step 10 quotes MY LINE).
    // A date reads in plain words, as seen from today ("Sunday", or "Sunday 9 November" beyond the coming week).
    // { empty: true } stands for words still to come (Step 13 before a tool is chosen).
    const inPromise = part => typeof part === 'number' && isDate(part) ? steps.plainDate(written(part), new Date())
      : part.empty ? ''
      : (typeof part === 'number' ? written(part) : (state.responses[part.from]?.[part.key] || '').trim())
        .replace(/^["“]+\s*/, '').replace(/[\s.,;:!?"”]+$/, '');
    const parts = () => typeof lessonSetup.promise === 'function' ? lessonSetup.promise(answers) : lessonSetup.promise;
    const promiseText = () => parts().map(part => typeof part === 'string' ? part : inPromise(part)).join('');
    showEarlier(lessonSetup.from);
    // MY RECORD (Steps 14 and 16): every earlier step's check-in, one line each with its title, in the map's marks
    // (YES full gold, PARTLY half gold, NO a gold ring). No percentages or score: the user decides.
    if ($('record')) $('record').replaceChildren(...Array.from({ length: step - 1 }, (_, n) => {
      const d = n + 1, answer = state.answers[d];
      const line = document.createElement('li'); line.className = 'record-line';
      const num = document.createElement('span'); num.className = 'record-num'; num.textContent = pad(d);
      const title = document.createElement('span'); title.className = 'record-title'; title.textContent = steps.title(d);
      const mark = document.createElement('span'); mark.className = 'record-mark ' + (answer || 'none');
      mark.textContent = { yes: 'YES', partly: 'PARTLY', no: 'NO' }[answer] || '—';
      line.append(num, title, mark);
      return line;
    }));
    // MY SCORE SO FAR (Step 21): follow-through over the Step 01–20 checks, no tier until the final check.
    if ($('scoreSoFar')) $('scoreSoFar').textContent = model.score(state, 20).percent + '%';
    // MY TWO CARDS (Step 21): the Step 19 and 20 cards with their evening results, read-only.
    if ($('cards')) $('cards').replaceChildren(...steps.cardList(state));
    $('lockedText').textContent = step === 21 ? 'Your promise is locked. Your final check opens on My Path.'
      : 'Your promise is locked. Step ' + pad(step + 1) + ' starts by asking how it went.';
    if (committed) record.stage = DONE;
    if (!committed) { record.act = PROGRESS[record.stage] ?? PROGRESS[0]; save(); }
    boxes.forEach(box => { if (box.tagName === 'TEXTAREA') fitStarter(box); });
    // A day can be tomorrow at the earliest; data-days caps how far ahead (Step 13: seven days).
    const isoDay = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    boxes.forEach((box, i) => { if (isDate(i)) { box.min = isoDay(1); if (box.dataset.days) box.max = isoDay(Number(box.dataset.days)); } });
    // MY COMMITMENTS (Step 16): Step 11's report-back day, and Step 13's hard day with its tool, each with its
    // date. A day still to come is NOT DUE YET, never a miss; the app doesn't know whether a passed one was kept.
    if ($('commitments')) {
      const today = isoDay(0), r11 = state.responses[11] || {}, r13 = state.responses[13] || {};
      const sentence = (starter, words) => {
        const line = document.createElement('p'); line.className = 'mine-text';
        const lead = document.createElement('span'); lead.className = 'starter-text'; lead.textContent = starter;
        line.append(lead, ' ' + words);
        return line;
      };
      const commitment = (name, date, ...lines) => {
        const due = date > today ? 'later' : date === today ? 'today' : 'past';
        const item = document.createElement('li'); item.className = 'commitment';
        const head = document.createElement('div'); head.className = 'commitment-head';
        const label = document.createElement('span'); label.className = 'commitment-name'; label.textContent = name;
        const status = document.createElement('span'); status.className = 'commitment-status ' + due;
        status.textContent = { later: 'NOT DUE YET', today: 'DUE TODAY', past: 'PASSED' }[due];
        head.append(label, status);
        item.append(head, ...lines);
        return item;
      };
      const tool = { minimum: 'my minimum: ' + inPromise({ from: 12, key: 'MINIMUM' }) + '.',
        swap: 'my swap and my line: “' + inPromise({ from: 10, key: 'LINE' }) + '”, and ' + inPromise({ from: 9, key: 'SWAP' }) + '.' }[r13.TOOL];
      const items = [
        r11.DATE && commitment('REPORT BACK', r11.DATE, sentence('I will report back on', steps.plainDate(r11.DATE) + '.')),
        r13.DATE && commitment('MY HARD DAY', r13.DATE, sentence('My hard day is', steps.plainDate(r13.DATE) + '.'), ...tool ? [sentence('My tool is', tool)] : [])
      ].filter(Boolean);
      $('commitments').replaceChildren(...items.length ? items : [Object.assign(document.createElement('li'), { className: 'commitment mine-text', textContent: 'No dated commitments yet.' })]);
    }
    // A choice shows, under its buttons, the earlier words it stands for (data-shows="step:KEY:starter|…").
    function renderChoice(i) {
      const row = rows[i], picked = written(i);
      row.querySelectorAll('[data-choice]').forEach(button => {
        const on = button.dataset.choice === picked;
        button.classList.toggle('pill--ink', on); button.classList.toggle('pill--outline', !on);
        button.setAttribute('aria-pressed', String(on));
        button.disabled = isCommitted() || record.stage < i;
      });
      const shown = row.querySelector('.choice-words'), button = row.querySelector('[data-choice="' + picked + '"]');
      if (!shown) return;
      shown.replaceChildren(...(button?.dataset.shows ? button.dataset.shows.split('|') : []).map(spec => {
        const [from, key, starter] = spec.split(':');
        const line = document.createElement('p'); line.className = 'mine-text';
        const lead = document.createElement('span'); lead.className = 'starter-text'; lead.textContent = starter;
        line.append(lead, ' ' + (state.responses[from]?.[key] || '').trim());
        return line;
      }));
    }

    function mark(row, active, done) {
      row.classList.toggle('is-active', active); row.classList.toggle('is-done', done);
      row.classList.toggle('is-locked', !active && !done);
      row.setAttribute('aria-disabled', !active && !done ? 'true' : 'false');
    }
    // MY PROMISE forms live: the user's words in place, "…" in grey until written.
    function renderPromise() {
      $('promise').replaceChildren(...parts().map(part => {
        if (typeof part === 'string') return document.createTextNode(part);
        const words = document.createElement('span');
        words.className = 'promise-rest' + (inPromise(part) ? '' : ' is-empty');
        words.textContent = inPromise(part) || '…';
        return words;
      }));
    }
    function render(scroll) {
      const s = record.stage;
      boxes.forEach((box, i) => {
        if (box.value !== (answers[keys[i]] || '')) box.value = answers[keys[i]] || '';
        box.readOnly = isCommitted();
        if (isChoice(i)) renderChoice(i);
        if (!isDate(i)) return;
        const shown = box.parentElement.querySelector('.date-shown');
        shown.textContent = written(i) ? steps.plainDate(written(i)) : 'pick a day';
        shown.classList.toggle('is-empty', !written(i));
      });
      const last = lastNeeded();
      // A line shown only after a choice (Step 19's "Does this still fit your move?"): data-show-when="KEY=value".
      document.querySelectorAll('[data-show-when]').forEach(el => { const [key, value] = el.dataset.showWhen.split('='); el.hidden = answers[key] !== value; });
      rows.forEach((row, i) => {
        row.hidden = !needed(i);
        boxes[i].disabled = s < i;
        mark(row, s === i || (i === last && s === CHECK), i === last ? s >= PROMISE : s > i);
        row.querySelector('.next-row').hidden = s !== i;
        row.querySelector('.next').disabled = !written(i);
      });
      mark(rowPromise, s === PROMISE, s === DONE);
      // With a row hidden in the middle (Step 19's MY UPDATED MOVE), the rows after it number on without a gap.
      if (boxes.some(box => box.dataset.when)) document.querySelectorAll('.rows > .row:not([hidden]) .node:not(.node--lock)').forEach((node, n) => { node.textContent = pad(n + 1); });
      if (hasCheck) {
        $('proofQ').hidden = s !== CHECK;
        $('proofYes').disabled = $('proofNotSure').disabled = s !== CHECK;
        $('proved').hidden = s < PROMISE;
        $('proved').disabled = s === DONE;
        $('proofHint').hidden = !(record.notSure && s === lessonSetup.back);
      }
      renderPromise();
      hold.disabled = s !== PROMISE || boxes.some((box, i) => needed(i) && !written(i));
      $('commitBlock').hidden = s === DONE;
      $('lockedBlock').hidden = s !== DONE;
      if (scroll) scrollToRow(s >= PROMISE ? rowPromise : rows[Math.min(s, last)], s <= last);
    }

    function go(stage, extra) {
      if (isCommitted()) return;
      record.stage = stage;
      record.act = PROGRESS[stage];
      Object.assign(record, extra || {});
      if (stage === DONE) commitPromise(promiseText());
      save(); refreshBar(); render(true);
      if (stage === DONE) returnToMap();
    }

    // Typing autosaves; Return (or the arrow) moves on to the next box still to ask. The last box leads to the
    // check, or straight to the promise.
    const advance = i => {
      if (!written(i) || record.stage !== i) return;
      const next = boxes.findIndex((box, j) => j > i && needed(j));
      if (next > -1) go(next);
      else go(hasCheck ? CHECK : PROMISE, { notSure: false });
    };
    boxes.forEach((box, i) => {
      const keep = () => { if (isCommitted()) return; answers[keys[i]] = box.value; save(); render(false); };
      box.addEventListener('input', keep);
      if (isDate(i)) {
        box.addEventListener('change', keep);
        // Tapping anywhere on the box opens the calendar (iPhone does this by itself).
        box.addEventListener('click', () => { if (!isCommitted() && !box.disabled) try { box.showPicker(); } catch {} });
      }
      // Changing a choice after moving on goes back to it, since the questions after it may change (Step 14).
      if (isChoice(i)) rows[i].querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
        if (isCommitted() || record.stage < i) return;
        const changed = answers[keys[i]] !== button.dataset.choice;
        box.value = answers[keys[i]] = button.dataset.choice; save();
        if (changed && record.stage > i) go(i); else render(false);
      }));
      box.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); advance(i); } });
      rows[i].querySelector('.next').addEventListener('click', () => advance(i));
    });
    if (hasCheck) {
      $('proofYes').addEventListener('click', () => go(PROMISE));
      // NOT SURE goes back to the box the check is about, with its hint.
      $('proofNotSure').addEventListener('click', () => { go(lessonSetup.back, { notSure: true }); boxes[lessonSetup.back].focus(); });
      // Tapping the check's answer redoes the check before committing.
      $('proved').addEventListener('click', () => { if (record.stage === PROMISE) go(CHECK); });
    }
    holdToCommit(hold, $('holdFill'), () => go(DONE));
    render(false);
  }
};
