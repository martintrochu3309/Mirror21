/* /dashboard's numbers, worked out from what Supabase's dashboard_stats() gives (one entry per buyer, no names and
   nothing anyone wrote). summarize(learners, now) gives everything the page draws:
   - totals: buyers, test purchases, signed in, started, active in the last 7 days, finished the 21 steps, final check
   - completed[1..21]: how many committed each step
   - stops: everyone who started and hasn't finished, at the step they're on and the part of it (Not opened, Check in,
     Watch, Learn, Act), with how long since they last did anything
   - days: on average, which day of their course people commit each step (Day 1 is the day they started), and how
     many days the finishers took
   - answers[1..21]: the evening check on each step's promise: yes, partly, no
   - people: one row per buyer, numbered in the order they bought */
(function (root) {
  const DAY = 86400000;
  const PARTS = ['Not opened', 'Check in', 'Watch', 'Learn', 'Act'];
  const STEPS = Array.from({ length: 21 }, (_, i) => i + 1);
  // Day N of the course, counted in calendar days on this computer's clock: the start day is Day 1.
  const midnight = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const dayOf = (start, at) => Math.round((midnight(at) - midnight(start)) / DAY) + 1;
  const number = value => { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : null; };
  const time = value => typeof value === 'string' ? number(Date.parse(value)) : number(value);
  const mean = list => list.length ? Math.round(list.reduce((sum, n) => sum + n, 0) / list.length * 10) / 10 : null;

  // Where someone is: the first step not committed, and the part of it they're in.
  function position(steps) {
    const step = STEPS.find(d => !steps[d]?.committed);
    if (!step) return null;
    const s = steps[step] || {};
    const part = !s.opened ? 'Not opened' : step >= 2 && !s.checked_in ? 'Check in' : s.reached >= 2 ? 'Act' : s.reached >= 1 ? 'Learn' : 'Watch';
    return { step, part };
  }

  function summarize(learners, now = Date.now()) {
    const list = Array.isArray(learners) ? learners : [];
    const totals = { buyers: list.length, test: 0, signedIn: 0, started: 0, active7: 0, finished: 0, finalCheck: 0 };
    const completed = Object.fromEntries(STEPS.map(d => [d, 0]));
    const answers = Object.fromEntries(STEPS.map(d => [d, { yes: 0, partly: 0, no: 0 }]));
    const reachDays = Object.fromEntries(STEPS.map(d => [d, []]));
    const finishDays = [], stops = [], people = [];

    list.forEach((learner, i) => {
      const steps = learner && typeof learner.steps === 'object' && learner.steps ? learner.steps : {};
      const start = number(learner?.started_at), saved = number(learner?.saved_at);
      const started = Boolean(steps[1]?.opened || steps[1]?.committed);
      const done = STEPS.filter(d => steps[d]?.committed).length;
      const finished = Boolean(steps[21]?.committed);
      if (learner?.test) totals.test++;
      if (learner?.signed_in) totals.signedIn++;
      if (started) totals.started++;
      if (saved && now - saved <= 7 * DAY) totals.active7++;
      if (finished) totals.finished++;
      if (number(learner?.finished_at)) totals.finalCheck++;
      STEPS.forEach(d => {
        const s = steps[d];
        if (!s?.committed) return;
        completed[d]++;
        const at = time(s.committed_at);
        if (start && at && at >= start) reachDays[d].push(dayOf(start, at));
        if (Object.hasOwn(answers[d], s.answer)) answers[d][s.answer]++;
      });
      const finishedAt = time(steps[21]?.committed_at);
      if (finished && start && finishedAt) finishDays.push(dayOf(start, finishedAt));
      const where = started && !finished ? position(steps) : null;
      const idle = saved ? Math.floor((now - saved) / DAY) : null;
      if (where) stops.push({ ...where, idle });
      people.push({
        n: i + 1, test: Boolean(learner?.test), signedIn: Boolean(learner?.signed_in), done,
        day: start ? dayOf(start, now) : null, idle, finished,
        where: finished ? 'Finished' : where ? 'Step ' + String(where.step).padStart(2, '0') + ' · ' + where.part : started ? '' : 'Not started'
      });
    });

    const averageDay = Object.fromEntries(STEPS.map(d => [d, mean(reachDays[d])]));
    // How long the finishers took, in weeks: 21 days is one step a day.
    const buckets = [['21 days or less', n => n <= 21], ['22–28', n => n >= 22 && n <= 28], ['29–35', n => n >= 29 && n <= 35],
      ['36–42', n => n >= 36 && n <= 42], ['43 or more', n => n >= 43]].map(([label, test]) => ({ label, count: finishDays.filter(test).length }));
    return { totals, completed, answers, averageDay, finishDays, finish: buckets, finishAverage: mean(finishDays), stops, people, parts: PARTS };
  }

  // Where people stop: for each step, how many are in each part. idleDays: only those idle at least that long.
  function stopTable(stops, idleDays = 0) {
    const rows = {};
    stops.filter(stop => idleDays <= 0 || (stop.idle ?? 0) >= idleDays).forEach(({ step, part }) => {
      rows[step] ||= Object.fromEntries(PARTS.map(p => [p, 0]));
      rows[step][part]++;
    });
    return Object.keys(rows).map(Number).sort((a, b) => a - b).map(step => ({ step, ...rows[step], total: PARTS.reduce((sum, p) => sum + rows[step][p], 0) }));
  }

  const api = { summarize, stopTable, position, dayOf, PARTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MirrorDashboardStats = api;
})(globalThis);
