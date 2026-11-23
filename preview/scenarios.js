// Saved courses for any moment of Mirror 21, in the words of the Learn pages' example (someone who wants to wake up
// rested). Shared by preview.html (each phone's pretend course) and tests/visual-baseline.cjs (every capture).
//   const { course, finishedCourse, signedIn } = MirrorScenarios(new Date())   // dates counted from that moment
// course({ done, graded, current, finished, runs, extra }) gives what the app would have saved, as storage keys.
(function (root) {
  function scenarios(BASE) {
    const pad = n => String(n).padStart(2, '0');
    const day = (offset, hour = 21) => { const d = new Date(BASE); d.setDate(d.getDate() + offset); d.setHours(hour, 0, 0, 0); return d; };
    const iso = offset => { const d = day(offset); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    // Every step's answers (Step 01 saves whole sentences).
    const ANSWERS = {
      1: { HERE: 'Right now, I spend most nights on my phone in bed and wake up tired.', THERE: 'I want to be able to wake up properly rested and ready for the day.', STEP: 'Today I will put my phone on charge across the room.' },
      2: { ACTION: 'put my phone outside the bedroom by 10pm.' },
      3: { MOVE: 'getting up at the same time every day.', ACTION: 'set a 6:30am alarm for every day this week, weekends included.' },
      4: { WAY: 'hitting snooze.', ACTION: 'put my alarm across the room so I have to get up to turn it off.' },
      5: { MOMENT: 'I’m about to start another episode.', RESPONSE: 'switch the TV off.' },
      6: { EASY: 'the TV remote lives on my bedside table.', CHANGE: 'put the TV remote in the living room and a book on my pillow.' },
      7: { ANCHOR: 'brush my teeth at night.', ACTION: 'put my phone on charge in the kitchen and read my book in bed.' },
      8: { WHEN: 'I’m on the sofa at about 10pm and the day’s done.', WHAT: 'scroll for 45 minutes, which is why getting up at 6:30 is a fight.', PAYOFF: 'a way to switch off from the day.' },
      9: { SWAP: 'pick up my book.' },
      10: { WHY: 'I’m tired of only being half there.', LINE: '“Be all there tomorrow.”' },
      11: { PERSON: 'Sam, a friend I trust.', DATE: iso(3) },
      12: { MINIMUM: 'get my feet on the floor at 6:30, even if I’m slow after that.' },
      13: { DATE: iso(-2), SLIP: 'Friday at 6:30, when the alarm goes after a late night.', TOOL: 'swap', READY: 'put “Friday 6:30, feet on the floor” in my calendar and set Friday’s alarm now.' },
      14: { DECISION: 'raise', NEWBAR: 'being dressed and ready to start my morning by 6:40.' },
      15: { STORY: '“I’ve blown it this week, I’ll start again on Monday.”', RULE: 'the next morning with feet on the floor at 6:30.' },
      16: { WORKING: 'using my minimum when I need it.', NOTYET: 'doing my full move after late nights.' },
      17: { AROUND: 'the night ran late at my friend’s birthday.', DID: 'stay for another hour after saying I’d leave at 11.', ACTION: 'set a 10:45 “time to go” alarm for Saturday’s dinner.' },
      18: { KEEP: 'Using my minimum on hard mornings.', STOP: 'Staying out past the time I said I’d leave.', START: 'telling Sam my leaving time before a late night.', FIRST: 'message Sam my leaving time for Saturday’s dinner.' },
      19: { SEE: 'weekday mornings are holding, and mornings after late nights still slip.', OWN: 'getting up on weekdays, which is working, and staying out past my leaving time.', MOVECHOICE: 'update', MOVE: 'getting up at 6:30 every day.', TOOL: 'anchor', ACTION: 'put my phone on charge in the kitchen tonight, straight after I brush my teeth.' },
      20: { NEWCHANGE: 'Walking more during the week.', SEE: 'I walk about once a fortnight.', OWN: 'I let the car win on short trips.', CHANGEIT: 'A Tuesday and Thursday walk to work.', FIRST: 'Lay out my walking shoes tonight.' },
      21: { HERENOW: 'get up at 6:30 most weekdays and wake up rested. Late nights still knock me back.', NEXT: 'again', ACTION: 'put my leaving time for Friday’s dinner in my calendar.' }
    };
    const GRADES = d => d % 5 === 0 ? 'no' : d % 3 === 0 ? 'partly' : 'yes';
    // How many answer boxes each Act page asks (its MY PROMISE stage comes right after them).
    const BOXES = { 1: 5, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 3, 9: 1, 10: 2, 11: 2, 12: 1, 13: 4, 14: 2, 15: 2, 16: 2, 17: 3, 18: 4, 19: 6, 20: 5, 21: 3 };
    const promiseOf = d => d === 1 ? 'Today, I will put my phone on charge across the room.' : 'Today, I will keep the promise I wrote for Step ' + pad(d) + ', one small move at a time.';
    // Steps 1..done committed; graded ones checked in. `current`: the open step and where it stands.
    function course({ done = 0, graded = done, current = null, finished = false, runs = null, extra } = {}) {
      const now = BASE.getTime(), s = { version: 1, startedAt: day(-30).getTime(), updatedAt: now, answers: {}, lessons: {}, steps: {}, dayChanges: {}, responses: {}, change: '' };
      for (let d = 1; d <= done; d++) {
        s.lessons[d] = true; s.dayChanges[d] = promiseOf(d); s.change = s.dayChanges[d]; s.responses[d] = { ...ANSWERS[d] };
        s.steps[d] = { screen: 'act', reached: 2, watch: 1, watched: true, learn: 1, stage: BOXES[d] + 2, notSure: false, checkedIn: d >= 2, act: 1, committedAt: day(d - done - 1).toISOString() };
        if (d <= graded) s.answers[d] = GRADES(d);
      }
      if (current) {
        const { step, screen = 'act', stage = 0, fill = false, watch = 0 } = current;
        const checked = screen !== 'checkin';
        s.steps[step] = { screen, reached: screen === 'act' ? 2 : screen === 'learn' ? 1 : 0, watch: checked && screen !== 'watch' ? 1 : watch, watched: checked && screen !== 'watch', learn: screen === 'act' ? 1 : 0, stage, notSure: false, checkedIn: step >= 2 && checked };
        if (screen === 'act' && step >= 2) s.steps[step].act = stage === 0 ? 0.1 : 0.85;
        if (fill) s.responses[step] = { ...ANSWERS[step] };
      }
      if (finished) { s.answers[21] = GRADES(21); s.finishedAt = now; }
      if (extra) extra(s);
      const local = { 'mirror21-progress': JSON.stringify(s), 'mirror21-seen-0': 'true' };
      if (runs) local['mirror21-runs'] = JSON.stringify(runs);
      return local;
    }
    const finishedCourse = (next = 'again') => course({ done: 21, finished: true, extra: s => { s.responses[21].NEXT = next; } });
    // A sign-in saved on the device, so the course pages open (assets/core/auth.js only checks it's there).
    const signedIn = { 'sb-mirror21-auth': JSON.stringify({ access_token: 'test', refresh_token: 'test', expires_at: 4102444800, user: { email: 'buyer@example.com' } }) };
    return { pad, day, iso, ANSWERS, GRADES, BOXES, promiseOf, course, finishedCourse, signedIn };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = scenarios;
  else root.MirrorScenarios = scenarios;
})(globalThis);
