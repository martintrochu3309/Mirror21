/* The check-in at the start of each step from Step 02: did you keep the previous step's promise? Run by the step shell. */
(globalThis.MirrorScreens ||= {}).checkin = ({ model, steps, store, state, stats, step, welcome, committed, record, save, refreshBar, label, pad, map, href, reduceMotion, arrival, showEarlier }) => {
  // The check-in is about the previous step: its locked promise and when it was committed.
  // Just YES / PARTLY / NO: no reply line and no note.
  const previous = step - 1;
  const notes = state.responses[previous] ||= {};
  const choices = document.getElementById('choices');
  const next = document.getElementById('next');
  // The exact promise locked at I'M COMMITTED, word for word. Step 13's plans a day ahead, so its check-in
  // grades only today's part: "Today, I will [getting ready]."
  const ready = steps.lesson(previous) === 13 && (state.responses[previous]?.READY || '').trim().replace(/[\s.,;:!?]+$/, '');
  document.getElementById('commitText').textContent = ready ? 'Today, I will ' + ready + '.' : (state.dayChanges[previous] || notes.STEP || '').trim();
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
    store.device.setArrival('light:' + step);
    if (reduceMotion()) return;
    event.preventDefault(); document.querySelector('.screen').classList.add('is-leaving');
    setTimeout(() => { location.href = next.href; }, 200);
  });
  render();
};
