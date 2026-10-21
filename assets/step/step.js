/* Mirror 21 · Step screens (Watch → Learn → Act). Behaviour follows the Step 01 and Step 02 design handoffs;
   answers and progress live in the shared mirror21-progress store, one record per step. */
(() => {
  const model = MirrorProgress, steps = MirrorSteps;
  const screenName = document.body.dataset.screen;
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const map = '04-map-start.html';
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // One-time note from the map's step card (the step number) or the check-in ('light:' + step): Watch
  // plays its arrival sequence, from black or from white. Used up on any step page.
  let arrival = null;
  try { arrival = sessionStorage.getItem('mirror21-intro'); sessionStorage.removeItem('mirror21-intro'); } catch {}

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

  // Step bar: Watch · Learn · Act, with Check in first from Step 02. Each part fills gold as it is done.
  // Labels under it: gold once that part is done, black (white on Watch) for this screen, grey to come.
  const bar = document.getElementById('stepBar');
  const barKey = 'mirror21-bar-' + step;
  const names = step >= 2 ? ['checkin', 'watch', 'learn', 'act'] : ['watch', 'learn', 'act'];
  const parts = names.map(name => {
    const part = bar.appendChild(document.createElement('div'));
    part.className = 'bar-part';
    const fill = part.appendChild(document.createElement('span')).appendChild(document.createElement('i'));
    const label = part.appendChild(document.createElement('b'));
    label.className = 'bar-label';
    label.textContent = name === 'checkin' ? 'CHECK IN' : name.toUpperCase();
    return { fill, label, current: name === screenName };
  });
  function draw(values) {
    values.forEach((value, i) => {
      const { fill, label, current } = parts[i];
      fill.style.setProperty('--fill', value * 100 + '%');
      label.classList.toggle('is-done', value === 1);
      label.classList.toggle('is-current', current && value < 1);
    });
  }
  function paint(values) {
    const pct = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100);
    bar.setAttribute('aria-valuenow', String(pct));
    bar.setAttribute('aria-valuetext', pct + ' percent complete');
    draw(values);
    write(barKey, JSON.stringify(values));
  }
  const refreshBar = () => { if (!welcome) paint(model.segments(state, step)); };
  if (welcome) bar.hidden = true;
  else {
    // Start from where the bar was on the previous screen, then advance.
    const values = model.segments(state, step);
    let previous; try { previous = JSON.parse(read(barKey)); } catch {}
    bar.classList.add('is-instant');
    draw(values.map((value, i) => Math.min(Array.isArray(previous) && Number.isFinite(previous[i]) ? previous[i] : 0, value)));
    void bar.offsetWidth;
    bar.classList.remove('is-instant');
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
  if (screenName === 'act') (steps.lesson(step) === 2 ? act02Screen : steps.lesson(step) >= 3 ? twoBoxActScreen : actScreen)();

  fitTitles();
  document.fonts.ready.then(fitTitles);
  let lastWidth = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lastWidth) { lastWidth = innerWidth; fitTitles(); } });
  addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  document.documentElement.dataset.stepScreen = screenName;
  document.documentElement.dataset.mirrorReady = 'true';

  // Watch: Start → Mid (playing / paused) → Finish, from the Watch screen handoff.
  // Learn appears only at Finish, once 90% of the video has actually been watched (no scrubbing).
  function watchScreen() {
    const screen = document.getElementById('watch');
    const player = document.getElementById('player');
    const still = document.getElementById('still');
    const line = document.getElementById('line');
    const hint = document.getElementById('hint');
    const next = document.getElementById('next');
    const media = steps.media(step);
    // Without a video, playback is simulated for this long and shows VIDEO COMING SOON.
    const DEMO_SECONDS = 8;
    const fake = !media.video;
    const watchedKey = 'mirror21-watched-0';
    const sep = '  ·  ';
    const clock = seconds => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
    const [mins, secs] = media.duration.split(':').map(Number);
    // Length shown before the file loads; the file's own length replaces it.
    let total = mins * 60 + secs || 0;
    let watched = welcome ? read(watchedKey) === 'true' : committed || record.watched;
    // Where playback stands, as a share of the video; an unfinished first watch resumes from here.
    let at = watched || welcome ? 0 : record.watch;
    let current, immerse, raf, t0 = 0, lastSaved = 0, savedWatch = at, arriving = false;

    label.textContent = 'STEP ' + pad(step) + ' OF 21';
    document.getElementById('stepTitle').textContent = steps.headline(step);
    document.getElementById('nextLabel').textContent = media.next;
    if (fake) screen.classList.add('placeholder'); else player.src = media.video;
    // Load the finish image (the video's last frame) now, so the end fades straight into it.
    if (media.finish) new Image().src = media.finish;

    function set(mode) {
      current = screen.dataset.state = mode;
      clearTimeout(immerse); screen.classList.remove('immersed');
      // Title, meta line and step bar fade out after 2 seconds of playback.
      if (mode === 'playing') immerse = setTimeout(() => screen.classList.add('immersed'), 2000);
      const src = mode === 'finish' && media.finish ? media.finish : media.image;
      if (still.getAttribute('src') !== src) still.src = src;
    }
    function showHint() {
      const resume = at > 0 && !watched;
      hint.classList.toggle('is-resume', resume);
      document.getElementById('hintText').textContent = resume ? 'RESUME' + (total ? sep + clock(at * total) : '')
        : 'BEST WITH SOUND' + (total ? sep + clock(total) : '');
    }
    // Saves how far the first watch got, only when it moved since the last save.
    function keep() {
      if (welcome || committed || watched || record.watch === savedWatch) return;
      savedWatch = record.watch; lastSaved = Date.now(); save();
    }
    function markWatched() {
      watched = true; screen.classList.add('is-watched');
      if (welcome) write(watchedKey, 'true');
      else if (!committed) { record.watched = true; record.watch = 1; save(); }
    }
    function progress(p) {
      at = p; line.style.width = p * 100 + '%';
      if (watched) return;
      if (p >= 0.9) markWatched();
      else if (!welcome && !committed && p > record.watch) {
        record.watch = p;
        if (Date.now() - lastSaved > 1000) keep();
      }
    }
    // The end: Finish once watched (the Watch part of the bar fills), otherwise back to paused.
    function finish() {
      at = 0;
      if (!watched) { set('paused'); return; }
      set('finish'); refreshBar();
    }

    function play() {
      if (current === 'finish') { progress(0); if (!fake) player.currentTime = 0; }
      set('playing');
      if (fake) {
        t0 = performance.now() - at * DEMO_SECONDS * 1000;
        const tick = now => {
          const p = Math.min((now - t0) / 1000 / DEMO_SECONDS, 1); progress(p);
          if (p < 1) raf = requestAnimationFrame(tick); else finish();
        };
        raf = requestAnimationFrame(tick);
      } else player.play().catch(() => set(at ? 'paused' : 'start'));
    }
    function pause() {
      if (fake) cancelAnimationFrame(raf); else player.pause();
      set('paused'); keep();
    }

    player.addEventListener('loadedmetadata', () => {
      if (!Number.isFinite(player.duration)) return;
      total = player.duration;
      if (at) player.currentTime = at * player.duration;
      showHint();
    });
    player.addEventListener('timeupdate', () => { if (current === 'playing' && player.duration) progress(player.currentTime / player.duration); });
    player.addEventListener('ended', () => { progress(1); finish(); });
    // Paused by the phone (a call, headphones unplugged, leaving the app): show the paused state.
    player.addEventListener('pause', () => { if (current === 'playing' && !player.ended) { set('paused'); keep(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden && fake && current === 'playing') pause(); });
    addEventListener('pagehide', keep);

    // Nothing but the X can be tapped until the arrival sequence has shown the controls.
    screen.addEventListener('click', event => {
      if (arriving && !event.target.closest('.close')) { event.preventDefault(); event.stopPropagation(); }
    }, true);
    // Tap anywhere to play / pause; Finish only reacts to its buttons. Swiping does nothing.
    screen.addEventListener('click', event => {
      if (event.target.closest('.close, .end')) return;
      if (current === 'playing') pause(); else if (current !== 'finish') play();
    });
    document.getElementById('again').addEventListener('click', play);

    if (welcome) {
      next.href = map;
      // Leaving Welcome with its button counts as done: the map's START moves on to Step 01.
      next.addEventListener('click', () => write('mirror21-seen-0', 'true'));
    }
    else next.href = href('learn');
    // Dark to white: a quick fade into the next screen rather than a hard cut.
    next.addEventListener('click', event => {
      if (reduceMotion()) return;
      event.preventDefault(); screen.classList.add('is-leaving');
      setTimeout(() => { location.href = next.href; }, 250);
    });

    // A step already watched (or left after 90%) opens at Finish, with its button ready.
    progress(at);
    if (watched) screen.classList.add('is-watched');
    set(watched ? 'finish' : 'start');
    showHint();
    arrive();

    // From the map: on black, the title (0.2s), then Kevin once his image has loaded (0.6s), then the
    // controls (0.2s). From the check-in: on white, Kevin first (0.5s), then the title and controls
    // together (0.2s); Safari's bar turns black once he covers the white. With reduce motion, one 0.3s
    // fade. Only when the map's card or the check-in opened this screen.
    function arrive() {
      const root = document.documentElement;
      const light = arrival === 'light:' + step;
      const tint = color => document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
      if (!light && arrival !== String(step)) { root.classList.remove('intro', 'intro-light'); tint('#000000'); return; }
      arriving = true;
      const done = () => { arriving = false; tint('#000000'); root.classList.remove('intro', 'intro-light', 'show-text', 'show-image', 'show-controls'); };
      if (reduceMotion()) {
        root.classList.remove('intro');
        screen.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' }).finished.then(done, done);
        return;
      }
      const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
      root.classList.add('intro');
      requestAnimationFrame(() => requestAnimationFrame(async () => {
        if (light) {
          await still.decode().catch(() => {});
          root.classList.add('show-image');
          await pause(500);
          tint('#000000');
          root.classList.add('show-text', 'show-controls');
          await pause(200);
          done();
          return;
        }
        root.classList.add('show-text');
        await Promise.all([pause(200), still.decode().catch(() => {})]);
        root.classList.add('show-image');
        await pause(600);
        root.classList.add('show-controls');
        await pause(200);
        done();
      }));
    }
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
      save(); render(); refreshBar();
      if (navigator.vibrate) navigator.vibrate(15);
    });
    // WATCH locks the answer in and opens the step.
    next.addEventListener('click', () => {
      if (!state.answers[previous] || committed) return;
      record.checkedIn = true; record.screen = 'watch'; save();
    });
    // White to dark: the check-in fades to white, and the note tells Watch to arrive from that white.
    let leaving = false;
    next.addEventListener('click', event => {
      if (leaving) { event.preventDefault(); return; }
      leaving = true;
      try { sessionStorage.setItem('mirror21-intro', 'light:' + step); } catch {}
      if (reduceMotion()) return;
      event.preventDefault(); document.querySelector('.screen').classList.add('is-leaving');
      setTimeout(() => { location.href = next.href; }, 200);
    });
    render();
  }

  function learnScreen() {
    document.getElementById('next').href = href('act');
    // Step 02: your own THERE from the step before, read-only.
    if (steps.lesson(step) === 2) showEarlier();
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

  // Answers brought forward from an earlier step (the step before unless given) are shown read-only,
  // marked "FROM STEP NN": data-from names the answer (there, move…), in the user's own words.
  function showEarlier(from = step - 1) {
    document.querySelectorAll('[data-from]').forEach(el => {
      const words = (state.responses[from]?.[el.dataset.from.toUpperCase()] || '').trim();
      el.textContent = words.charAt(0).toUpperCase() + words.slice(1);
    });
    document.querySelectorAll('[data-from-step]').forEach(el => { el.textContent = 'FROM STEP ' + pad(from); });
  }

  // Answer boxes open with a fixed sentence starter in grey, set in front of the box: the user only
  // finishes the sentence. The first line of typing starts right after it.
  // A long starter ("The move that matters most is") leaves no room for a word after it, and the box
  // would split that word: then the answer starts on the line below the starter instead.
  function fitStarter(box) {
    const starter = box.parentElement.querySelector('.starter');
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

  // Steps 03–06 · One answer read-only from an earlier step, two boxes, a YES / NOT SURE check, then MY PROMISE.
  // Stages: 0 first box · 1 second box · 2 check · 3 promise · 4 committed. Each box saves the user's typed words
  // under its data-answer key. Per lesson: the step the read-only answer comes from, the box NOT SURE sends you
  // back to (its hint sits in that row), and the promise, built from the boxes (numbers are box indexes).
  function twoBoxActScreen() {
    const lessonSetup = {
      3: { from: 1, back: 1, promise: ['Today, I will ', 1, '.'] },
      4: { from: 3, back: 1, promise: ['Today, I will ', 1, '.'] },
      5: { from: 1, back: 0, promise: ['Today, when ', 0, ', I will pause and ', 1, '. If it doesn’t come, I’ll run through it once in my head.'] },
      6: { from: 1, back: 1, promise: ['Today, I will ', 1, '.'] }
    }[steps.lesson(step)];
    const PROGRESS = [0.1, 0.35, 0.6, 0.85, 1];
    const answers = state.responses[step] ||= {};
    const isCommitted = () => Boolean(state.lessons[step]);
    const $ = id => document.getElementById(id);
    const boxes = [$('boxOne'), $('boxTwo')];
    const keys = boxes.map(box => box.dataset.answer);
    const rows = [$('rowOne'), $('rowTwo')], rowPromise = $('rowPromise'), hold = $('hold');
    const written = i => (answers[keys[i]] || '').trim();
    // The user's words inside the promise, without a closing full stop (the sentence carries its own).
    const inPromise = i => written(i).replace(/[\s.,;:!?]+$/, '');
    const promiseText = () => lessonSetup.promise.map(part => typeof part === 'number' ? inPromise(part) : part).join('');
    showEarlier(lessonSetup.from);
    $('lockedText').textContent = 'Your promise is locked. Step ' + pad(step + 1) + ' starts by asking how it went.';
    if (committed) record.stage = 4;
    if (!committed) { record.act = PROGRESS[record.stage] ?? PROGRESS[0]; save(); }
    boxes.forEach(fitStarter);

    function mark(row, active, done) {
      row.classList.toggle('is-active', active); row.classList.toggle('is-done', done);
      row.classList.toggle('is-locked', !active && !done);
      row.setAttribute('aria-disabled', !active && !done ? 'true' : 'false');
    }
    // MY PROMISE forms live: the user's words in place, "…" in grey until written.
    function renderPromise() {
      $('promise').replaceChildren(...lessonSetup.promise.map(part => {
        if (typeof part !== 'number') return document.createTextNode(part);
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
      });
      boxes[1].disabled = s < 1;
      mark(rows[0], s === 0, s >= 1);
      mark(rows[1], s === 1 || s === 2, s >= 3);
      mark(rowPromise, s === 3, s === 4);
      $('oneNextRow').hidden = s !== 0;
      $('oneNext').disabled = !written(0);
      $('twoNextRow').hidden = s !== 1;
      $('twoNext').disabled = !written(1);
      $('proofQ').hidden = s !== 2;
      $('proofYes').disabled = $('proofNotSure').disabled = s !== 2;
      $('proved').hidden = s < 3;
      $('proved').disabled = s === 4;
      $('proofHint').hidden = !(record.notSure && s === lessonSetup.back);
      renderPromise();
      hold.disabled = s !== 3 || !written(0) || !written(1);
      $('commitBlock').hidden = s === 4;
      $('lockedBlock').hidden = s !== 4;
      if (scroll) scrollToRow(s >= 3 ? rowPromise : rows[Math.min(s, 1)], s <= 1);
    }

    function go(stage, extra) {
      if (isCommitted()) return;
      record.stage = stage;
      record.act = PROGRESS[stage];
      Object.assign(record, extra || {});
      if (stage === 4) commitPromise(promiseText());
      save(); refreshBar(); render(true);
      if (stage === 4) returnToMap();
    }

    // Typing autosaves; Return (or the arrow) moves on.
    const advance = [() => { if (written(0) && record.stage === 0) go(1); },
      () => { if (written(1) && record.stage === 1) go(2, { notSure: false }); }];
    boxes.forEach((box, i) => {
      box.addEventListener('input', () => { if (isCommitted()) return; answers[keys[i]] = box.value; save(); render(false); });
      box.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); advance[i](); } });
    });
    $('oneNext').addEventListener('click', advance[0]);
    $('twoNext').addEventListener('click', advance[1]);
    $('proofYes').addEventListener('click', () => go(3));
    // NOT SURE goes back to the box the check is about, with its hint.
    $('proofNotSure').addEventListener('click', () => { go(lessonSetup.back, { notSure: true }); boxes[lessonSetup.back].focus(); });
    // Tapping the check's answer redoes the check before committing.
    $('proved').addEventListener('click', () => { if (record.stage === 3) go(2); });
    holdToCommit(hold, $('holdFill'), () => go(4));
    render(false);
  }
})();
