/* Mirror 21 · The shell for the step screens (Check in → Watch → Learn → Act). Behaviour follows the Step 01 and
   Step 02 design handoffs; answers and progress live in the saved course (MirrorStore), one record per step.
   It opens the right step (or sends the user to the right page), keeps the step bar, then runs the page's
   screen (assets/screens/checkin.js, watch.js, learn.js or act.js), registered in MirrorScreens. */
MirrorStore.ready(() => {
  const model = MirrorProgress, steps = MirrorSteps, store = MirrorStore;
  const screenName = document.body.dataset.screen;
  const map = '04-map-start.html';
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // One-time note from the map's step card (the step number) or the check-in ('light:' + step): Watch
  // plays its arrival sequence, from black or from white. Used up on any step page.
  const arrival = store.device.takeArrival();

  const state = store.course.load();
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

  const save = () => { if (welcome) return; store.course.save(state); };
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
    store.device.saveBarPosition(step, values);
  }
  const refreshBar = () => { if (!welcome) paint(model.segments(state, step)); };
  if (welcome) bar.hidden = true;
  else {
    // Start from where the bar was on the previous screen, then advance.
    const values = model.segments(state, step);
    const previous = store.device.barPosition(step);
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

  // What every step screen is given.
  const screen = globalThis.MirrorScreens?.[screenName];
  if (screen) screen({ model, steps, store, state, stats, step, welcome, committed, record, save, refreshBar, label, pad, map, href, reduceMotion, arrival, showEarlier });

  fitTitles();
  document.fonts.ready.then(fitTitles);
  let lastWidth = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lastWidth) { lastWidth = innerWidth; fitTitles(); } });
  addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  document.documentElement.dataset.stepScreen = screenName;
  document.documentElement.dataset.mirrorReady = 'true';

  // Answers brought forward from an earlier step (the step before unless given) are shown read-only,
  // marked "FROM STEP NN": data-from names the answer (there, move…), in the user's own words.
  // A row marked data-from-of="N" takes its answer from Step N instead (Step 07 shows two earlier steps).
  // An answer typed after a sentence starter (Step 08's) names it in data-starter: it shows in grey in front.
  // MY MOVE is the current move: from Step 15 on, Step 14's new bar if the user raised the bar there; from Step 20
  // on, Step 19's updated move if they updated it there (the Step 03 move and the new bar are never changed).
  function showEarlier(from = step - 1) {
    const raised = step > 14 && state.responses[14]?.DECISION === 'raise' && (state.responses[14].NEWBAR || '').trim();
    const updated = step > 19 && state.responses[19]?.MOVECHOICE === 'update' && (state.responses[19].MOVE || '').trim();
    // The step a row's answer comes from: Step 19 or 14 for the move once updated or raised.
    const fromOf = el => {
      const of = Number(el.closest('[data-from-of]')?.dataset.fromOf) || from;
      if (of !== 3 || !el.closest('.row')?.querySelector('[data-from="move"]')) return of;
      return updated ? 19 : raised ? 14 : 3;
    };
    document.querySelectorAll('[data-from]').forEach(el => {
      const key = el.dataset.from.toUpperCase();
      const words = (key === 'MOVE' && fromOf(el) === 14 ? raised : state.responses[fromOf(el)]?.[key] || '').trim();
      if (!el.dataset.starter) { el.textContent = words.charAt(0).toUpperCase() + words.slice(1); return; }
      // An answer saved as the whole sentence (Step 01's THERE) already begins with its starter: shown once.
      const own = words.toLowerCase().startsWith(el.dataset.starter.toLowerCase()) ? words.slice(el.dataset.starter.length).trim() : words;
      const starter = document.createElement('span');
      starter.className = 'starter-text';
      starter.textContent = el.dataset.starter;
      el.replaceChildren(starter, ' ' + own);
    });
    document.querySelectorAll('[data-from-step]').forEach(el => { el.textContent = 'FROM STEP ' + pad(fromOf(el)); });
  }
});
