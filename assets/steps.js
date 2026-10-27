// The 21 step titles, plus each step's Watch content and where its lesson comes from.
// Steps 01–12 have their own lessons; Steps 13–18 reuse Step 01's as placeholders,
// and Steps 19–21 stay unavailable until content arrives. Steps 01–12 have their portrait videos so far.
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
    10: filmed(10, '1:27'), 11: filmed(11, '1:35'), 12: filmed(12, '1:29')
  };
  const defaults = { video: '', image: '../assets/images/step01-start.jpg', finish: '', duration: '', next: 'LEARN' };
  const available = step => Number.isInteger(step) && step >= 0 && step <= 18;
  // Lesson (Learn + Act) this step shows: Steps 02–12 have their own; Steps 01 and 13–18 use Step 01's.
  const lesson = step => step >= 2 && step <= 12 ? step : available(step) && step > 0 ? 1 : null;
  // Page for a screen of a step: Check in and Watch are shared, Learn and Act follow the lesson.
  const page = (step, screen) => (screen === 'learn' || screen === 'act') && lesson(step) > 1 ? 'step' + String(lesson(step)).padStart(2, '0') + '-' + screen + '.html' : 'step-' + screen + '.html';
  // "See an example" on Act, per lesson and answer box (its data-answer, data-field or id, in capitals): the words
  // that finish the box's sentence starter, from the Learn pages' story of someone who wants to wake up rested.
  // A box without one (Step 11's date) shows no link.
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
    12: { MINIMUM: 'get my feet on the floor at 6:30, even if I’m slow after that.' }
  };
  const example = (step, key) => examples[lesson(step)]?.[key] || '';
  // The three blocks of seven steps. Each ends with a summary page (html/block.html?block=N), reached from a tile
  // beside its last step: one skill per step, then the closing lines. A block without skills has no page yet.
  const blocks = [
    { name: 'MAKE THE MOVE', first: 1, last: 7, closing: ['You’ve made the move.', 'Next, you make it stick.'], skills: [
      ['DIRECTION', 'You know where you’re going.'],
      ['ACTION', 'You can turn an intention into something you can prove you did.'],
      ['PRIORITY', 'You can identify the move that matters most.'],
      ['CONTROL', 'You can focus your effort on what you can control.'],
      ['RESPONSE', 'You can pause and choose your response instead of reacting automatically.'],
      ['SURROUNDINGS', 'You can change your surroundings to make the right behaviour easier.'],
      ['ROUTINE', 'You can link an action to something you already do each day.']
    ] },
    { name: 'MAKE IT STICK', first: 8, last: 14, skills: [] },
    { name: 'MAKE IT YOURS', first: 15, last: 21, skills: [] }
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
  const api = {
    titles, available, lesson, page, plainDate, block, example,
    title: step => titles[step] || '',
    // Screen headline: caps with a closing full stop, as in the handoff.
    headline: step => titles[step] ? titles[step].toUpperCase() + '.' : '',
    media: step => available(step) ? { ...defaults, ...watch[step] } : null,
    pad: step => String(step).padStart(2, '0')
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MirrorSteps = api;
})(globalThis);
