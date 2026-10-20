/* Mirror 21 · Step screens (Watch → Learn → Act). Behaviour follows the Step 01 and Step 02 design handoffs;
   answers and progress live in the shared mirror21-progress store, one record per step. */
(() => {
  const model = MirrorProgress, steps = MirrorSteps;
  const screenName = document.body.dataset.screen;
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const map = '04-map-start.html';
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  let raw; try { raw = JSON.parse(read('mirror21-progress')); } catch {}
  const state = model.normalize(raw);
  const stats = model.stats(state);
  const param = new URLSearchParams(location.search).get('step');
  const asked = param === null || param === '' ? NaN : Number(param);
  // Step 00 (Welcome) is watch-only and never starts or changes an attempt.
  const welcome = screenName === 'watch' && asked === 0;
  const step = welcome ? 0 : Number.isInteger(asked) && asked >= 1 && asked <= 21 ? asked : (stats.today || 21);
  const committed = Boolean(state.lessons[step]);
  if (!welcome && (!steps.available(step) || (!committed && step !== stats.today))) { location.replace(map); return; }
  const href = name => steps.page(step, name) + '?step=' + step;
  // Learn and Act follow the step's lesson (Step 02 has its own pages).
  const here = (location.pathname.split('/').pop() || '').replace(/\.html$/, '') + '.html';
  if (!welcome && here !== steps.page(step, screenName)) { location.replace(href(screenName)); return; }
  // Step 01 has no check-in; from Step 02, Watch, Learn and Act wait for it.
  if (screenName === 'checkin' && step < 2) { location.replace(href('watch')); return; }
  if (screenName !== 'checkin' && !welcome && model.needsCheckIn(state, step)) { location.replace(href('checkin')); return; }

  const save = () => { if (welcome) return; state.updatedAt = Date.now(); write('mirror21-progress', JSON.stringify(state)); };
  const pad = steps.pad;
  const record = welcome ? null : (state.steps[step] ||= { screen: step >= 2 ? 'checkin' : 'watch', reached: 0, watch: 0, watched: false, learn: 0, stage: 0, notSure: false, checkedIn: false });
  // Revisiting a finished check-in doesn't move where CONTINUE resumes.
  if (record && !committed && !(screenName === 'checkin' && record.checkedIn)) {
    record.screen = screenName;
    record.reached = Math.max(record.reached, { checkin: 0, watch: 0, learn: 1, act: 2 }[screenName]);
  }
  save();

  const label = document.getElementById('stepLabel');
  label.textContent = 'STEP ' + pad(step);
  document.title = 'Mirror 21 · Step ' + pad(step) + ' · ' + { checkin: 'Check in', watch: 'Watch', learn: 'Learn', act: 'Act' }[screenName];

  // Continuous progress bar: Watch, Learn and Act each fill a third.
  const bar = document.querySelector('.course-progress');
  const fill = bar.firstElementChild;
  const barKey = 'mirror21-bar-' + step;
  function paint(ratio) {
    const pct = Math.round(ratio * 100);
    bar.setAttribute('aria-valuenow', String(pct));
    bar.setAttribute('aria-valuetext', pct + ' percent complete');
    fill.style.width = ratio * 100 + '%';
    write(barKey, String(ratio));
  }
  const refreshBar = () => { if (!welcome) paint(model.session(state, step).ratio); };
  if (welcome) bar.hidden = true;
  else {
    // Start from where the bar was on the previous screen, then advance.
    const ratio = model.session(state, step).ratio;
    const previous = Number(read(barKey));
    fill.classList.add('is-instant');
    fill.style.width = Math.min(Number.isFinite(previous) ? previous : 0, ratio) * 100 + '%';
    void fill.offsetWidth;
    fill.classList.remove('is-instant');
    requestAnimationFrame(() => requestAnimationFrame(refreshBar));
  }

  // One-line titles: long ones shrink just enough to fit, never wrap.
  function fitTitles() {
    document.querySelectorAll('.title').forEach(title => {
      title.style.fontSize = '';
      const range = document.createRange(); range.selectNodeContents(title);
      const needed = range.getBoundingClientRect().width, available = title.clientWidth;
      if (needed > available) title.style.fontSize = Math.floor(parseFloat(getComputedStyle(title).fontSize) * available / needed * 0.985 * 10) / 10 + 'px';
    });
  }

  if (screenName === 'checkin') checkinScreen();
  if (screenName === 'watch') watchScreen();
  if (screenName === 'learn') learnScreen();
  if (screenName === 'act') (steps.lesson(step) === 2 ? act02Screen : actScreen)();

  fitTitles();
  document.fonts.ready.then(fitTitles);
  let lastWidth = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lastWidth) { lastWidth = innerWidth; fitTitles(); } });
  addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  document.documentElement.dataset.stepScreen = screenName;
  document.documentElement.dataset.mirrorReady = 'true';

  function watchScreen() {
    const screen = document.getElementById('watch');
    const player = document.getElementById('player');
    const poster = document.getElementById('poster');
    const play = document.getElementById('play');
    const next = document.getElementById('next');
    const media = steps.media(step);
    document.getElementById('stepTitle').textContent = steps.headline(step);
    poster.src = media.poster;
    poster.alt = 'Kevin Craggs, Step ' + pad(step) + ' video';
    player.src = media.video;
    if (welcome) {
      next.href = map; document.getElementById('nextLabel').textContent = 'MY PATH';
      // Leaving Welcome with its button counts as done: the map's START moves on to Step 01.
      next.addEventListener('click', () => write('mirror21-seen-0', 'true'));
    }
    else next.href = href('learn');

    // Length comes from the video file itself.
    player.addEventListener('loadedmetadata', () => {
      if (!Number.isFinite(player.duration)) return;
      const total = Math.floor(player.duration);
      label.textContent = 'STEP ' + pad(step) + ' · ' + Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
    });

    const watchedKey = 'mirror21-watched-0';
    function showWatched() {
      screen.classList.add('is-watched');
      next.classList.remove('btn--outline');
      next.classList.add('btn--gold');
    }
    function setWatched() {
      showWatched();
      if (welcome) write(watchedKey, 'true');
      else if (!committed) { record.watched = true; record.watch = 1; save(); refreshBar(); }
    }
    if (welcome ? read(watchedKey) === 'true' : committed || record.watched) showWatched();

    function showPoster() {
      player.style.opacity = ''; player.style.pointerEvents = ''; player.controls = false;
      play.hidden = false;
    }
    // Watched = the video reached its end (the iPhone full-screen player fires 'ended' too).
    player.addEventListener('ended', () => { setWatched(); showPoster(); });
    player.addEventListener('webkitendfullscreen', () => { if (player.paused) showPoster(); });
    player.addEventListener('play', () => { play.hidden = true; });
    let lastSaved = 0;
    player.addEventListener('timeupdate', () => {
      if (welcome || committed || !player.duration) return;
      const seen = player.currentTime / player.duration;
      if (seen <= record.watch) return;
      record.watch = seen;
      if (Date.now() - lastSaved > 1000) { lastSaved = Date.now(); save(); refreshBar(); }
    });
    play.addEventListener('click', () => {
      player.style.opacity = 1; player.style.pointerEvents = 'auto'; player.controls = true;
      if (player.ended) player.currentTime = 0;
      const started = player.play();
      if (started && started.catch) started.catch(showPoster);
    });
  }

  function checkinScreen() {
    // The check-in is about the previous step: its locked promise and when it was committed.
    // Just YES / PARTLY / NO: no reply line and no note.
    const previous = step - 1;
    const notes = state.responses[previous] ||= {};
    const choices = document.getElementById('choices');
    const next = document.getElementById('next');
    // The exact promise locked at I'M COMMITTED, word for word.
    document.getElementById('commitText').textContent = (state.dayChanges[previous] || notes.STEP || '').trim();
    next.href = href('watch');

    // "Yesterday" must stay true; without a commit time, "Last time" always is.
    const committedAt = state.steps[previous]?.committedAt;
    if (committedAt) {
      const then = new Date(committedAt), now = new Date();
      const days = Math.round((new Date(now.toDateString()) - new Date(then.toDateString())) / 86400000);
      document.getElementById('when').textContent = days <= 0 ? 'Earlier today' : days === 1 ? 'Yesterday'
        : days < 7 ? 'On ' + then.toLocaleDateString('en-US', { weekday: 'long' }) : 'Last time';
    }

    const locked = () => committed || record.checkedIn || model.checkInLocked(state, previous);
    function render() {
      const choice = state.answers[previous];
      choices.classList.toggle('has-pick', Boolean(choice));
      choices.querySelectorAll('.choice').forEach(button => {
        button.setAttribute('aria-checked', button.dataset.choice === choice ? 'true' : 'false');
        button.disabled = locked() && button.dataset.choice !== choice;
      });
      next.hidden = !choice;
    }
    choices.addEventListener('click', event => {
      const button = event.target.closest('.choice');
      if (!button || locked()) return;
      if (!model.record(state, previous, button.dataset.choice)) return;
      save(); render();
      if (navigator.vibrate) navigator.vibrate(15);
    });
    // WATCH locks the answer in and opens the step.
    next.addEventListener('click', () => {
      if (!state.answers[previous] || committed) return;
      record.checkedIn = true; record.screen = 'watch'; save();
    });
    render();
  }

  function learnScreen() {
    document.getElementById('next').href = href('act');
    // Step 02: your own THERE from the step before, read-only.
    if (steps.lesson(step) === 2) showPreviousThere();
    if (committed) return;
    // The Learn third fills as the reader scrolls towards YOUR TURN.
    let queued = false;
    const measure = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      const seen = max <= 0 ? 1 : Math.min(1, scrollY / max);
      if (seen > record.learn + 0.02 || (seen === 1 && record.learn < 1)) { record.learn = seen; save(); refreshBar(); }
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(measure); } }, { passive: true });
    measure();
  }

  // Answers brought forward from the step before are shown read-only, marked "FROM STEP NN".
  function showPreviousThere() {
    const there = (state.responses[step - 1]?.THERE || '').trim();
    document.querySelectorAll('[data-from="there"]').forEach(el => { el.textContent = there; });
    document.querySelectorAll('[data-from-step]').forEach(el => { el.textContent = 'FROM STEP ' + pad(step - 1); });
  }

  // Answer boxes open with a fixed sentence starter in grey, set in front of the box: the user only
  // finishes the sentence. The first line of typing starts right after it.
  function fitStarter(box) {
    const starter = box.parentElement.querySelector('.starter');
    const indent = () => { box.style.textIndent = starter.offsetWidth + 'px'; };
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
  function commitPromise(words) {
    state.lessons[step] = true;
    record.committedAt = new Date().toISOString();
    state.dayChanges[step] = promiseFor(words).slice(0, 240);
    state.change = state.dayChanges[step];
  }
  function returnToMap() { setTimeout(() => { location.href = map; }, 1500); }

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
      promise.textContent = promiseText();
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
      if (stage === 6) commitPromise(written('step'));
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
    showPreviousThere();
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
      if (stage === 3) commitPromise(action());
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
})();
