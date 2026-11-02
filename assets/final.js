/* The end of the course. The final check (html/final-check.html) is the evening check on Step 21's promise: Step 21
   has no next step to hold it. The answer can change until SEE YOUR RESULT, which locks it (finishedAt) and opens
   the Block 3 summary; its SEE MY RESULTS leads here.
   The result page (html/result.html) opens only after that; result.html?run=N shows an earlier run, kept in
   mirror21-runs when the learner starts a new one. */
(() => {
  const model = MirrorProgress, steps = MirrorSteps;
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const map = '04-map-start.html';
  const $ = id => document.getElementById(id);
  const el = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text != null) node.textContent = text; return node; };
  let raw; try { raw = JSON.parse(read('mirror21-progress')); } catch {}
  const state = model.normalize(raw);
  const save = () => { state.updatedAt = Date.now(); write('mirror21-progress', JSON.stringify(state)); };
  // Finished runs, oldest first: { endedAt, progress }.
  let runs; try { runs = JSON.parse(read('mirror21-runs')); } catch {}
  if (!Array.isArray(runs)) runs = [];

  if (document.body.dataset.page === 'final-check') finalCheck(); else result();

  function finalCheck() {
    if (!state.lessons[21]) { location.replace(map); return; }
    const choices = $('choices'), next = $('next');
    $('commitText').textContent = (state.dayChanges[21] || '').trim();
    // "Yesterday" must stay true; without a commit time, "Last time" always is.
    const committedAt = state.steps[21]?.committedAt;
    if (committedAt) {
      const then = new Date(committedAt), now = new Date();
      const days = Math.round((new Date(now.toDateString()) - new Date(then.toDateString())) / 86400000);
      $('when').textContent = days <= 0 ? 'Earlier today' : days === 1 ? 'Yesterday'
        : days < 7 ? 'On ' + then.toLocaleDateString('en-US', { weekday: 'long' }) : 'Last time';
    }
    const locked = () => model.checkInLocked(state, 21);
    function render() {
      const choice = state.answers[21];
      choices.classList.toggle('has-pick', Boolean(choice));
      choices.querySelectorAll('.choice').forEach(button => {
        button.setAttribute('aria-checked', button.dataset.choice === choice ? 'true' : 'false');
        button.disabled = locked() && button.dataset.choice !== choice;
      });
      next.hidden = !choice;
    }
    choices.addEventListener('click', event => {
      const button = event.target.closest('.choice');
      if (!button || locked() || !model.record(state, 21, button.dataset.choice)) return;
      save(); render();
      if (navigator.vibrate) navigator.vibrate(15);
    });
    next.addEventListener('click', event => {
      if (!state.answers[21]) { event.preventDefault(); return; }
      if (!state.finishedAt) { state.finishedAt = Date.now(); save(); }
    });
    render();
    document.documentElement.dataset.mirrorReady = 'true';
  }

  function result() {
    const asked = Number(new URLSearchParams(location.search).get('run'));
    const run = Number.isInteger(asked) && asked >= 1 ? runs[asked - 1] : null;
    if (asked && !run) { location.replace('result.html'); return; }
    const s = run ? model.normalize(run.progress) : state;
    if (!run && !state.finishedAt) { location.replace(state.lessons[21] ? 'final-check.html' : map); return; }
    const r1 = s.responses[1] || {}, r21 = s.responses[21] || {};
    // Step 01 saved its answers as whole sentences; Step 21 saved typed words only.
    const sentence = (starter, words) => {
      const text = (words || '').trim();
      return !text ? '' : text.toLowerCase().startsWith(starter.toLowerCase()) ? text : starter + ' ' + text;
    };

    $('runLabel').textContent = run ? 'RUN ' + asked + ' · YOUR RESULT' : 'YOUR RESULT';
    // FOLLOW-THROUGH: all 21 checks, and the tier.
    const { percent } = model.score(s, 21);
    const tiers = {
      own: ['YOU OWN THIS', 'You followed through on almost every step commitment.'],
      renting: ['YOU’RE RENTING THIS', 'You followed through on many commitments. Greater consistency is your next opportunity.'],
      again: ['RUN IT AGAIN', 'Your follow-through needs more work. You have the tools to practise again.']
    };
    const [name, line] = tiers[model.tier(percent)];
    $('score').textContent = percent + '%';
    $('tierName').textContent = name; $('tierLine').textContent = line;
    // EVIDENCE OF CHANGE: Step 01's HERE and THERE, Step 21's HERE NOW, in their words.
    $('hereThen').textContent = sentence('Right now, I', r1.HERE);
    $('hereNow').textContent = sentence('Right now, I', r21.HERENOW);
    $('there').textContent = sentence('I want to be able to', r1.THERE);
    // INDEPENDENT APPLICATION: the two cards with their evening results.
    $('cards').replaceChildren(...steps.cardList(s));
    // The 21 steps: title, the promise word for word, the evening result.
    $('journey').replaceChildren(...Array.from({ length: 21 }, (_, n) => {
      const d = n + 1, item = el('li', 'result-step'), head = el('div', 'result-step-head');
      head.append(el('span', 'result-step-num', steps.pad(d)), el('span', 'result-step-title', steps.title(d)), steps.resultMark(s.answers[d]));
      item.append(head);
      const promise = (s.dayChanges[d] || '').trim();
      if (promise) item.append(el('p', 'result-step-promise', promise));
      return item;
    }));
    // WHAT'S NEXT and MY NEXT ACTION, as chosen in Step 21.
    $('nextChoice').textContent = { keep: 'Keep working on this change.', again: 'Run the steps again.', new: 'Use the method on something new.' }[r21.NEXT] || '';
    $('nextAction').textContent = sentence('Today, I’ll', r21.ACTION);
    // Running the steps again starts a new run; this one is kept, with its result, in mirror21-runs.
    const newRun = $('newRun');
    newRun.hidden = Boolean(run) || r21.NEXT !== 'again';
    newRun.addEventListener('click', () => {
      if (!confirm('Start a new run? This run and its result are kept, and you start again at Step 01.')) return;
      runs.push({ endedAt: Date.now(), progress: state });
      write('mirror21-runs', JSON.stringify(runs));
      // The same keys Start over clears: the course, bar and video positions, which blocks were seen.
      const matches = key => key === 'mirror21-progress' || /^mirror21-(audio|bar|watched|seen|block)-\d+$/.test(key) || /^mirror21-scroll-\d+-\d+$/.test(key);
      for (const storage of [localStorage, sessionStorage]) {
        try { Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(matches).forEach(key => storage.removeItem(key)); } catch {}
      }
      location.href = map;
    });
    // Earlier runs, each with its date and score; the current one too once it is finished.
    const list = [...runs.map((past, i) => ({ href: 'result.html?run=' + (i + 1), label: 'Run ' + (i + 1), at: past.endedAt, state: model.normalize(past.progress), here: run === past })),
      ...(state.finishedAt ? [{ href: 'result.html', label: 'This run', at: state.finishedAt, state, here: !run }] : [])];
    if (list.length > 1) {
      const box = $('runs'); box.hidden = false;
      box.append(el('p', 'result-kicker', 'YOUR RUNS'));
      list.forEach(item => {
        const link = el('a', 'result-run' + (item.here ? ' is-here' : ''));
        link.href = item.href;
        link.append(el('span', '', item.label + ' · ' + new Date(item.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })),
          el('span', 'result-run-score', model.score(item.state, 21).percent + '%'));
        box.append(link);
      });
    }
    document.documentElement.dataset.mirrorReady = 'true';
  }
})();
