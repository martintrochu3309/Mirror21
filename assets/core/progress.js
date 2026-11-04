(function (root) {
  const values = { yes: 1, partly: 0.5, no: 0 };
  // From Step 02 every step starts with the check-in on the step before it.
  const SCREENS = ['checkin', 'watch', 'learn', 'act'];
  // Act share of its third of the bar, per stage: present, here, there, test, point & step, commit, done.
  const ACT_PROGRESS = [10, 25, 40, 55, 70, 90, 100];
  function fresh(now = Date.now()) {
    return { version: 1, startedAt: now, updatedAt: now, answers: {}, lessons: {}, steps: {}, dayChanges: {}, responses: {}, change: '' };
  }
  const fraction = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  function normalize(raw, now = Date.now()) {
    const state = fresh(now);
    if (!raw || raw.version !== 1) return state;
    if (Number.isFinite(raw.startedAt) && raw.startedAt <= now) state.startedAt = raw.startedAt;
    if (Number.isFinite(raw.updatedAt)) state.updatedAt = raw.updatedAt;
    for (let day = 1; day <= 21; day++) {
      // NOT YET from the first Step 02 check-in design is now NO.
      const answer = raw.answers?.[day] === 'notyet' ? 'no' : raw.answers?.[day];
      if (Object.hasOwn(values, answer)) state.answers[day] = answer;
      if (raw.lessons?.[day] === true) state.lessons[day] = true;
      const step = raw.steps?.[day];
      if (step && typeof step === 'object') {
        state.steps[day] = {
          screen: SCREENS.includes(step.screen) ? step.screen : day >= 2 ? 'checkin' : 'watch',
          reached: Number.isInteger(step.reached) ? Math.max(0, Math.min(2, step.reached)) : 0,
          watch: fraction(step.watch), watched: step.watched === true, learn: fraction(step.learn),
          // Up to 10: Step 19's card runs to stage 8 (six boxes, promise, committed).
          stage: Number.isInteger(step.stage) ? Math.max(0, Math.min(10, step.stage)) : 0,
          notSure: step.notSure === true,
          checkedIn: step.checkedIn === true
        };
        // Act's own share of its third when the lesson sets it (Step 02: 35 → 60 → 85 → 100%).
        if (Number.isFinite(step.act)) state.steps[day].act = fraction(step.act);
        if (typeof step.committedAt === 'string' && Number.isFinite(Date.parse(step.committedAt))) state.steps[day].committedAt = step.committedAt;
      }
      if (raw.responses?.[day] && typeof raw.responses[day] === 'object') {
        state.responses[day] = {};
        for (const [key,value] of Object.entries(raw.responses[day]).slice(0,20)) {
          if (/^[A-Z_]{1,24}$/.test(key) && typeof value === 'string') state.responses[day][key] = value.slice(0,2000);
        }
      }
      // Promises up to 600 characters: Step 05's carries two answers and a fixed sentence.
      if (typeof raw.dayChanges?.[day] === 'string') state.dayChanges[day] = raw.dayChanges[day].slice(0, 600);
    }
    state.change = typeof raw.change === 'string' ? raw.change.slice(0, 600) : '';
    // When the final check (on Step 21's promise) was locked in with SEE YOUR RESULT.
    if (Number.isFinite(raw.finishedAt)) state.finishedAt = raw.finishedAt;
    return state;
  }
  // The course has no time limit: it runs until all 21 promises are graded.
  function stats(state) {
    const answers = Object.values(state.answers);
    const checkIns = answers.length;
    const points = answers.reduce((sum, answer) => sum + values[answer], 0);
    const committed = Object.keys(state.lessons).length;
    // Today is the first step not yet committed: committing a step opens the next one straight away.
    const today = Array.from({ length: 21 }, (_, i) => i + 1).find(day => !state.lessons[day]) || null;
    return { checkIns, points, committed, today,
      stepsToGo: 21 - committed,
      // Follow-through: YES 100%, PARTLY 50%, NO 0%, averaged over the promises graded so far.
      percent: checkIns ? Math.round(points / checkIns * 100) : 0,
      week: Math.ceil((today || 21) / 7),
      complete: checkIns === 21, active: checkIns < 21 };
  }
  // The check-in on a committed step happens at the start of the next step. The answer can change
  // until WATCH is tapped there, which locks it (steps[day + 1].checkedIn). Step 21 has no next step: its final
  // check locks with SEE YOUR RESULT (finishedAt).
  const checkInLocked = (state, day) => day === 21 ? Boolean(state.finishedAt) : state.steps[day + 1]?.checkedIn === true;
  // Follow-through score over Steps 1–upTo: YES 1, PARTLY 0.5, NO 0, averaged over the checks answered, as a
  // percentage to one decimal (82.5). Step 21 shows it over Steps 1–20; the result page over all 21.
  function score(state, upTo = 21) {
    const graded = Object.keys(state.answers).filter(day => Number(day) <= upTo).map(day => values[state.answers[day]]);
    const percent = graded.length ? Math.round(graded.reduce((sum, value) => sum + value, 0) / graded.length * 1000) / 10 : 0;
    return { checks: graded.length, percent };
  }
  // The final tier, from the score over all 21 checks: 90% and above, 75% to below 90%, below 75%.
  const tier = percent => percent >= 90 ? 'own' : percent >= 75 ? 'renting' : 'again';
  function record(state, day, answer) {
    if (!Object.hasOwn(values, answer) || !state.lessons[day] || checkInLocked(state, day)) return false;
    state.answers[day] = answer;
    if (!Object.hasOwn(state.dayChanges, day)) state.dayChanges[day] = state.change;
    return true;
  }
  function session(state, day) {
    const step = state.steps[day];
    const done = Boolean(state.lessons[day] || state.answers[day]);
    let ratio = 0;
    if (done) ratio = 1;
    else if (step) {
      const watch = step.reached >= 1 ? 1 : step.watch;
      const learn = step.reached >= 2 ? 1 : step.reached >= 1 ? step.learn : 0;
      const act = step.reached >= 2 ? (Number.isFinite(step.act) ? step.act : ACT_PROGRESS[step.stage] / 100) : 0;
      ratio = (watch + learn + act) / 3;
    }
    return {
      ratio,
      label: state.answers[day] ? 'DONE' : state.lessons[day] ? 'CHECK IN' : step ? 'CONTINUE' : 'START',
      screen: step?.screen || (day >= 2 ? 'checkin' : 'watch')
    };
  }
  // Step bar: Watch · Learn · Act, with Check in first from Step 02. Check in and Watch fill once done;
  // Learn and Act fill as the user goes. A committed or graded step is full.
  function segments(state, day) {
    const step = state.steps[day];
    const done = Boolean(state.lessons[day] || state.answers[day]);
    const parts = done ? [1, 1, 1] : !step ? [0, 0, 0] : [
      step.watched || step.reached >= 1 ? 1 : 0,
      step.reached >= 2 ? 1 : step.reached >= 1 ? step.learn : 0,
      step.reached >= 2 ? (Number.isFinite(step.act) ? step.act : ACT_PROGRESS[step.stage] / 100) : 0
    ];
    if (day >= 2) parts.unshift(done || step?.checkedIn || state.answers[day - 1] ? 1 : 0);
    return parts;
  }
  // Watch, Learn and Act open once the check-in on the previous step is done (Step 01 has none).
  const needsCheckIn = (state, day) => day >= 2 && !state.lessons[day] && state.steps[day]?.checkedIn !== true;
  function writtenChange(state, day) {
    return state.dayChanges[day] ?? (state.answers[day] ? state.change : '');
  }
  const api = { fresh, normalize, stats, record, session, segments, writtenChange, checkInLocked, needsCheckIn, score, tier, ACT_PROGRESS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MirrorProgress = api;
})(globalThis);
