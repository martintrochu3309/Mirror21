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
          stage: Number.isInteger(step.stage) ? Math.max(0, Math.min(6, step.stage)) : 0,
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
      if (typeof raw.dayChanges?.[day] === 'string') state.dayChanges[day] = raw.dayChanges[day].slice(0, 240);
    }
    state.change = typeof raw.change === 'string' ? raw.change.slice(0, 240) : '';
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
  // until WATCH is tapped there, which locks it (steps[day + 1].checkedIn).
  const checkInLocked = (state, day) => state.steps[day + 1]?.checkedIn === true;
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
  const api = { fresh, normalize, stats, record, session, segments, writtenChange, checkInLocked, needsCheckIn, ACT_PROGRESS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MirrorProgress = api;
})(globalThis);
