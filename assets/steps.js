// The 21 step titles, plus each step's Watch content and where its lesson comes from.
// All 21 steps have their own lessons. Steps 01–14 have their portrait videos so far.
(function (root) {
  const titles = [
    'Welcome to Mirror 21',
    // Block 1 · Make the Move
    'Know Where You Are Going', 'Make It Something You Do', 'Pick One Move', 'Focus on What You Control',
    'Pause Before You React', 'Change Your Surroundings', 'Link It to Your Day',
    // Block 2 · Make It Stick
    'Spot Your Old Habit', 'Break the Habit', 'Know Why It Matters', 'Tell Someone',
    'Set a Minimum', 'Plan for Hard Days', 'Raise the Bar',
    // Block 3 · Make It Yours
    'Know How to Restart', 'Look Back', 'Own Your Part', 'Keep, Stop, Start',
    'Put It All Together', 'Use It on Something New', 'See What Changed'
  ];
  // Watch screen, per step: portrait video, start image (its first frame), finish image (its last frame,
  // so nothing jumps when it ends; empty = start image, dimmed), length shown before the video loads,
  // and the button label. An empty video shows "VIDEO COMING SOON" with simulated playback.
  // Steps not listed here use the defaults.
  // A filmed step: Audio-Video/StepNN-Watch.mp4, with its first and last frames as stepNN-start/-finish.jpg.
  const filmed = (step, duration) => {
    const nn = String(step).padStart(2, '0');
    return { video: '../Audio-Video/Step' + nn + '-Watch.mp4', image: '../assets/images/step' + nn + '-start.jpg', finish: '../assets/images/step' + nn + '-finish.jpg', duration };
  };
  const watch = {
    0: { duration: '0:37', next: 'MY PATH' },
    1: filmed(1, '1:45'), 2: filmed(2, '1:18'), 3: filmed(3, '1:18'),
    4: filmed(4, '1:25'), 5: filmed(5, '1:38'), 6: filmed(6, '1:13'),
    7: filmed(7, '1:20'), 8: filmed(8, '1:27'), 9: filmed(9, '1:30'),
    10: filmed(10, '1:27'), 11: filmed(11, '1:35'), 12: filmed(12, '1:29'),
    13: filmed(13, '1:27'), 14: filmed(14, '1:31'), 15: filmed(15, '1:20'),
    16: filmed(16, '1:23'), 17: filmed(17, '1:26'), 18: filmed(18, '1:28'),
    19: filmed(19, '1:28'), 20: filmed(20, '1:22'), 21: filmed(21, '1:24')
  };
  // cover: how much of the screen's height the black fade at the bottom covers (in %), so it can be tuned per
  // video, e.g. 4: { ...filmed(4, '1:25'), cover: 24 }.
  const defaults = { video: '', image: '../assets/images/step01-start.jpg', finish: '', duration: '', next: 'LEARN', cover: 30 };
  const available = step => Number.isInteger(step) && step >= 0 && step <= 21;
  // Lesson (Learn + Act) this step shows: each available step has its own (Step 01's is the generic page).
  const lesson = step => available(step) && step > 0 ? step : null;
  // Page for a screen of a step: Check in and Watch are shared, Learn and Act follow the lesson.
  const page = (step, screen) => (screen === 'learn' || screen === 'act') && lesson(step) > 1 ? 'step' + String(lesson(step)).padStart(2, '0') + '-' + screen + '.html' : 'step-' + screen + '.html';
  // "See an example" on Act, per lesson and answer box (its data-answer, data-field or id, in capitals): the words
  // that finish the box's sentence starter, from the Learn pages' story of someone who wants to wake up rested.
  // A box without one (Step 11's date, and Step 20's blank card, on purpose) shows no link.
  const examples = {
    1: { HERE: 'spend most nights on my phone in bed and wake up tired.', THERE: 'wake up properly rested and ready for the day.', STEP: 'put my phone on charge across the room.' },
    2: { ACTION: 'put my phone outside the bedroom by 10pm.' },
    3: { MOVE: 'getting up at the same time every day.', ACTION: 'set a 6:30am alarm for every day this week, weekends included.' },
    4: { WAY: 'hitting snooze.', ACTION: 'put my alarm across the room so I have to get up to turn it off.' },
    5: { MOMENT: 'I’m about to start another episode.', RESPONSE: 'switch the TV off.' },
    6: { EASY: 'the TV remote lives on my bedside table.', CHANGE: 'put the TV remote in the living room and a book on my pillow.' },
    7: { ANCHOR: 'brush my teeth at night.', ACTION: 'put my phone on charge in the kitchen and read my book in bed.' },
    8: { WHEN: 'I’m on the sofa at about 10pm and the day’s done.', WHAT: 'scroll for 45 minutes, which is why getting up at 6:30 is a fight.', PAYOFF: 'a way to switch off from the day.' },
    9: { SWAP: 'pick up my book.' },
    10: { WHY: 'I’m tired of only being half there.', LINE: '“Be all there tomorrow.”' },
    11: { PERSON: 'Sam, a friend I trust.' },
    12: { MINIMUM: 'get my feet on the floor at 6:30, even if I’m slow after that.' },
    13: { SLIP: 'Friday at 6:30, when the alarm goes after a late night.', READY: 'put “Friday 6:30, feet on the floor” in my calendar and set Friday’s alarm now.' },
    14: { NEWBAR: 'being dressed and ready to start my morning by 6:40.' },
    15: { STORY: '“I’ve blown it this week, I’ll start again on Monday.”', RULE: 'the next morning with feet on the floor at 6:30.' },
    16: { WORKING: 'using my minimum when I need it.', NOTYET: 'doing my full move after late nights.' },
    17: { AROUND: 'the night ran late at my friend’s birthday.', DID: 'stay for another hour after saying I’d leave at 11.', ACTION: 'set a 10:45 “time to go” alarm for Saturday’s dinner.' },
    // MY KEEP and MY STOP are asked as questions (no starter), so their examples are whole answers.
    18: { KEEP: 'Using my minimum on hard mornings.', STOP: 'Staying out past the time I said I’d leave.', START: 'telling Sam my leaving time before a late night.', FIRST: 'message Sam my leaving time for Saturday’s dinner.' },
    19: { SEE: 'weekday mornings are holding, and mornings after late nights still slip.', OWN: 'getting up on weekdays, which is working, and staying out past my leaving time.', MOVE: 'getting up at 6:30 every day.', ACTION: 'put my phone on charge in the kitchen tonight, straight after I brush my teeth.' },
    21: { HERENOW: 'get up at 6:30 most weekdays and wake up rested. Late nights still knock me back.', ACTION: 'put my leaving time for Friday’s dinner in my calendar.' }
  };
  const example = (step, key) => examples[lesson(step)]?.[key] || '';
  // The three blocks of seven steps. Each ends with a summary page (html/block.html?block=N), reached from a tile
  // beside its last step: one skill per step, then the closing lines. A block without skills has no page yet.
  const blocks = [
    // description: what the block is for (not shown anywhere yet).
    { name: 'MAKE THE MOVE', description: 'Build the actions.', first: 1, last: 7, closing: ['You’ve made the move.', 'Next, you make it stick.'], skills: [
      ['DIRECTION', 'You know where you’re going.'],
      ['ACTION', 'You can turn an intention into something you can prove you did.'],
      ['PRIORITY', 'You can identify the move that matters most.'],
      ['CONTROL', 'You can focus your effort on what you can control.'],
      ['RESPONSE', 'You can pause and choose your response instead of reacting automatically.'],
      ['SURROUNDINGS', 'You can change your surroundings to make the right behaviour easier.'],
      ['ROUTINE', 'You can link an action to something you already do each day.']
    ] },
    { name: 'MAKE IT STICK', description: 'Learn how to sustain and progress them.', first: 8, last: 14, closing: ['You’ve learned how to make it stick.', 'Next, you make it yours.'], skills: [
      ['PATTERN', 'You can spot your old habit: when it shows up, what you do, and what it gives you.'],
      ['REPLACEMENT', 'You can swap an old habit for something that gives you the same thing.'],
      ['REASON', 'You can use your own line at the moment the old habit pulls.'],
      ['ACCOUNTABILITY', 'You can put your promise where someone else can see it.'],
      ['MINIMUM', 'You can keep your move going on the days you can’t do it all.'],
      ['PREPARATION', 'You can plan which tool you’ll use on a hard day, before it arrives.'],
      ['PROGRESSION', 'You can let the evidence decide when to raise the bar.']
    ] },
    // Block 3's summary opens after the final check, just before the result page (see block.js).
    { name: 'MAKE IT YOURS', description: 'Use the Mirror Method on any change, for the rest of your life.', first: 15, last: 21, closing: ['You’ve learned the method.', 'What you do with it starts with you.'], skills: [
      ['RESTART', 'You can set a rule to come back after a miss, at your next chance, with your minimum.'],
      ['HINDSIGHT', 'You can look back over your record and see what’s working and what isn’t yet.'],
      ['INSIGHT', 'You can separate what happened from what you did, and own your part without blame.'],
      ['FORESIGHT', 'You can decide what to keep, what to stop and what to start.'],
      ['METHOD', 'You can run See It, Own It, Change It as one method.'],
      ['INDEPENDENCE', 'You can use the method on something new, without prompts.'],
      ['CLARITY', 'You can compare where you started with where you are now, and choose what comes next.']
    ] }
  ];
  const block = n => blocks[n - 1] ? { number: n, ...blocks[n - 1], ready: blocks[n - 1].skills.length > 0 } : null;
  // A saved date (YYYY-MM-DD) in plain words: within the coming week just the weekday ("Sunday"),
  // otherwise weekday, day and month ("Sunday 9 November"). Without `from`, always the full form.
  const plainDate = (iso, from) => {
    const [y, m, d] = String(iso || '').split('-').map(Number);
    if (!y || !m || !d) return '';
    const date = new Date(y, m - 1, d);
    const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
    const full = weekday + ' ' + d + ' ' + date.toLocaleDateString('en-GB', { month: 'long' });
    if (!from) return full;
    const days = Math.round((date - new Date(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000);
    return days >= 1 && days <= 6 ? weekday : full;
  };
  // The two Mirror Method cards, as Step 21 and the result page show them: Step 19's (guided, the original change)
  // and Step 20's (on their own, a new change), each answer as its whole sentence, with that step's evening result.
  // Read-only: the saved answers are never changed.
  const toolNames = { anchor: 'My anchor.', swap: 'My swap and my line.', minimum: 'My minimum.', restart: 'My restart rule.' };
  const said = (starter, words) => (words || '').trim() ? (starter ? starter + ' ' : '') + words.trim() : '';
  function cards(state) {
    const r19 = state.responses[19] || {}, r20 = state.responses[20] || {};
    // MY MOVE on the card: the update made there, otherwise the move as it was (Step 14's new bar if raised).
    const raised = state.responses[14]?.DECISION === 'raise' && state.responses[14].NEWBAR;
    const move = r19.MOVECHOICE === 'update' ? r19.MOVE : raised || state.responses[3]?.MOVE;
    return [
      { step: 19, title: 'MY MIRROR METHOD', result: state.answers[19] || null, rows: [
        ['SEE IT', said('What’s happening now is', r19.SEE)], ['OWN IT', said('The part that’s mine is', r19.OWN)],
        ['MY MOVE', said('My move is', move)], ['MY TOOL', toolNames[r19.TOOL] || ''], ['TODAY’S ACTION', said('Today, I’ll', r19.ACTION)]] },
      { step: 20, title: 'MY MIRROR METHOD: NEW CHANGE', result: state.answers[20] || null, rows: [
        ['MY NEW CHANGE', said('', r20.NEWCHANGE)], ['SEE IT', said('', r20.SEE)], ['OWN IT', said('', r20.OWN)],
        ['CHANGE IT', said('', r20.CHANGEIT)], ['MY FIRST MOVE TODAY', said('', r20.FIRST)]] }
    ];
  }
  // An evening result in the map's marks (YES full gold, PARTLY half, NO a ring), or — before it's answered.
  function resultMark(answer) {
    const mark = document.createElement('span');
    mark.className = 'record-mark ' + (answer || 'none');
    mark.textContent = { yes: 'YES', partly: 'PARTLY', no: 'NO' }[answer] || '—';
    return mark;
  }
  // The cards as closed panels: STEP 19 · MY MIRROR METHOD and its result, opened to show the answers.
  function cardList(state) {
    const el = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text != null) node.textContent = text; return node; };
    return cards(state).map(card => {
      const panel = el('details', 'method-card');
      const head = el('summary', 'method-card-head');
      const name = el('span', 'method-card-name');
      name.append(el('span', 'method-card-step', 'STEP ' + card.step), el('span', 'method-card-title', card.title));
      head.append(name, resultMark(card.result));
      const rows = el('dl', 'method-card-rows');
      card.rows.filter(([, text]) => text).forEach(([label, text]) => { const row = el('div', 'method-card-row'); row.append(el('dt', '', label), el('dd', '', text)); rows.append(row); });
      panel.append(head, rows);
      return panel;
    });
  }
  const api = {
    titles, available, lesson, page, plainDate, block, example, cards, cardList, resultMark,
    title: step => titles[step] || '',
    // Screen headline: caps with a closing full stop, as in the handoff.
    headline: step => titles[step] ? titles[step].toUpperCase() + '.' : '',
    media: step => available(step) ? { ...defaults, ...watch[step] } : null,
    pad: step => String(step).padStart(2, '0')
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MirrorSteps = api;
})(globalThis);
