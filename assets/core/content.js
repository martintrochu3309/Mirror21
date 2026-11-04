/* Every step's own content, gathered by tools/build.js from src/steps/stepNN/step.js: edit those files, then run
   node tools/build.js. Never edit this file by hand.
   Each step's fields:
   - title     the step's name (the Watch screen and the map card show it, My Journey too).
   - watch     the video's length, shown before it loads: '1:24' for Audio-Video/StepNN-Watch.mp4 with its first and
               last frames as assets/images/stepNN-start.jpg / -finish.jpg; or { filmed: '1:24', cover: 24 } to set
               how much of the screen the black fade at the bottom covers (30% unless set); Welcome sets its own.
   - skill     the skill the block summary lists for this step: [NAME, line].
   - examples  "See an example" on Act, per answer box (its data-answer, data-field or id, in capitals): the words that
               finish the box's sentence starter. A box without one shows no link.
   - act       Steps 03–21 (assets/screens/act.js): from, the step the read-only answers come from; back, the box NOT
               SURE sends you back to; promise, built from the boxes (numbers are answer boxes, in page order) and
               earlier answers ({ from: step, key }); a function of the answers when it depends on a choice.
   - journal   My Journey and Save my journal as PDF: the step's own answers as [label, sentence] rows. r is the step's
               saved answers; said(label, starter, key) puts a typed answer back after its sentence starter; proof is
               the PROOF row; plainDate reads a saved date in words. Empty rows are left out. */
(function (root) {
  const steps = {};
  const step = (n, content) => { steps[n] = content; };

  // ---- src/steps/step00/step.js
  // Step 00 · Welcome to Mirror 21
  step(0, {
    title: 'Welcome to Mirror 21',
    watch: { duration: '0:37', next: 'MY PATH' }
  });

  // ---- src/steps/step01/step.js
  // Step 01 · Know Where You Are Going
  step(1, {
    title: 'Know Where You Are Going',
    watch: '1:45',
    skill: ['DIRECTION', 'You know where you’re going.'],
    examples: { HERE: 'spend most nights on my phone in bed and wake up tired.', THERE: 'wake up properly rested and ready for the day.', STEP: 'put my phone on charge across the room.' },
    journal: ({ r }) => [['HERE',r.HERE],['THERE',r.THERE],['TEST','Yes, that’s what I actually want.'],['STEP',r.STEP]]
  });

  // ---- src/steps/step02/step.js
  // Step 02 · Make It Something You Do
  step(2, {
    title: 'Make It Something You Do',
    watch: '1:18',
    skill: ['ACTION', 'You can turn an intention into something you can prove you did.'],
    examples: { ACTION: 'put my phone outside the bedroom by 10pm.' },
    journal: ({ said, proof }) => [said('ACTION','Today I will','ACTION'),proof]
  });

  // ---- src/steps/step03/step.js
  // Step 03 · Pick One Move
  step(3, {
    title: 'Pick One Move',
    watch: '1:18',
    skill: ['PRIORITY', 'You can identify the move that matters most.'],
    examples: { MOVE: 'getting up at the same time every day.', ACTION: 'set a 6:30am alarm for every day this week, weekends included.' },
    act: { from: 1, back: 1, promise: ['Today, I will ', 1, '.'] },
    journal: ({ said, proof }) => [said('MOVE','The move that matters most is','MOVE'),said('ACTION','Today I will','ACTION'),proof]
  });

  // ---- src/steps/step04/step.js
  // Step 04 · Focus on What You Control
  step(4, {
    title: 'Focus on What You Control',
    watch: '1:25',
    skill: ['CONTROL', 'You can focus your effort on what you can control.'],
    examples: { WAY: 'hitting snooze.', ACTION: 'put my alarm across the room so I have to get up to turn it off.' },
    act: { from: 3, back: 1, promise: ['Today, I will ', 1, '.'] },
    journal: ({ said }) => [said('IN THE WAY','The thing that could stop me is','WAY'),said('ACTION','Today I will','ACTION'),['CONTROL','Yes, it’s in my control.']]
  });

  // ---- src/steps/step05/step.js
  // Step 05 · Pause Before You React
  step(5, {
    title: 'Pause Before You React',
    watch: '1:38',
    skill: ['RESPONSE', 'You can pause and choose your response instead of reacting automatically.'],
    examples: { MOMENT: 'I’m about to start another episode.', RESPONSE: 'switch the TV off.' },
    act: { from: 1, back: 0, promise: ['Today, when ', 0, ', I will pause and ', 1, '. If it doesn’t come, I’ll run through it once in my head.'] },
    journal: ({ said }) => [said('MOMENT','When','MOMENT'),said('RESPONSE','I will pause and','RESPONSE'),['READY','Yes, I’ll know the moment when it comes.']]
  });

  // ---- src/steps/step06/step.js
  // Step 06 · Change Your Surroundings
  step(6, {
    title: 'Change Your Surroundings',
    watch: '1:13',
    skill: ['SURROUNDINGS', 'You can change your surroundings to make the right behaviour easier.'],
    examples: { EASY: 'the TV remote lives on my bedside table.', CHANGE: 'put the TV remote in the living room and a book on my pillow.' },
    act: { from: 1, back: 1, promise: ['Today, I will ', 1, '.'] },
    journal: ({ said, proof }) => [said('EASY','The old habit is easy because','EASY'),said('CHANGE','Today I will','CHANGE'),proof]
  });

  // ---- src/steps/step07/step.js
  // Step 07 · Link It to Your Day
  step(7, {
    title: 'Link It to Your Day',
    watch: '1:20',
    skill: ['ROUTINE', 'You can link an action to something you already do each day.'],
    examples: { ANCHOR: 'brush my teeth at night.', ACTION: 'put my phone on charge in the kitchen and read my book in bed.' },
    act: { from: 1, promise: ['Today, after I ', 0, ', I will ', 1, '.'] },
    journal: ({ said }) => [said('ANCHOR','Every day, I','ANCHOR'),said('ACTION','Straight after, I will','ACTION')]
  });

  // ---- src/steps/step08/step.js
  // Step 08 · Spot Your Old Habit
  step(8, {
    title: 'Spot Your Old Habit',
    watch: '1:27',
    skill: ['PATTERN', 'You can spot your old habit: when it shows up, what you do, and what it gives you.'],
    examples: { WHEN: 'I’m on the sofa at about 10pm and the day’s done.', WHAT: 'scroll for 45 minutes, which is why getting up at 6:30 is a fight.', PAYOFF: 'a way to switch off from the day.' },
    act: { from: 3, promise: ['Today, when ', 0, ', I will catch my old habit as it starts and name it. If it doesn’t show up, I will look back at the last time it did.'] },
    journal: ({ said }) => [said('WHEN','It usually happens when','WHEN'),said('WHAT','What I actually do is','WHAT'),said('PAYOFF','It gives me','PAYOFF')]
  });

  // ---- src/steps/step09/step.js
  // Step 09 · Break the Habit
  step(9, {
    title: 'Break the Habit',
    watch: '1:30',
    skill: ['REPLACEMENT', 'You can swap an old habit for something that gives you the same thing.'],
    examples: { SWAP: 'pick up my book.' },
    act: { from: 1, promise: ['Today, when ', { from: 8, key: 'WHEN' }, ', I will pause and ', 0, '. If the moment doesn’t come, I will run through it once in my head.'] },
    journal: ({ said }) => [said('SWAP','Instead, I will','SWAP')]
  });

  // ---- src/steps/step10/step.js
  // Step 10 · Know Why It Matters
  step(10, {
    title: 'Know Why It Matters',
    watch: '1:27',
    skill: ['REASON', 'You can use your own line at the moment the old habit pulls.'],
    examples: { WHY: 'I’m tired of only being half there.', LINE: '“Be all there tomorrow.”' },
    act: { from: 1, promise: ['Today, when ', { from: 8, key: 'WHEN' }, ', I will pause, say “', 1, '”, and ', { from: 9, key: 'SWAP' }, '. If the moment doesn’t come, I will run through it once in my head.'] },
    journal: ({ said }) => [said('WHY','This really matters to me because','WHY'),said('LINE','My line is','LINE')]
  });

  // ---- src/steps/step11/step.js
  // Step 11 · Tell Someone
  step(11, {
    title: 'Tell Someone',
    watch: '1:35',
    skill: ['ACCOUNTABILITY', 'You can put your promise where someone else can see it.'],
    examples: { PERSON: 'Sam, a friend I trust.' },
    act: { from: 1, promise: ['Today, I will tell ', 0, ' what I’m changing, and that I will report back on ', 1, '.'] },
    journal: ({ r, said, plainDate }) => [said('PERSON','I will tell','PERSON'),['REPORT BACK',r.DATE?'I will report back on '+plainDate(r.DATE)+'.':'']]
  });

  // ---- src/steps/step12/step.js
  // Step 12 · Set a Minimum
  step(12, {
    title: 'Set a Minimum',
    watch: '1:29',
    skill: ['MINIMUM', 'You can keep your move going on the days you can’t do it all.'],
    examples: { MINIMUM: 'get my feet on the floor at 6:30, even if I’m slow after that.' },
    act: { from: 1, promise: ['Today, I will do my move, or at least ', 0, '.'] },
    journal: ({ said }) => [said('MINIMUM','On a bad day, the least I will do is','MINIMUM')]
  });

  // ---- src/steps/step13/step.js
  // Step 13 · Plan for Hard Days
  step(13, {
    title: 'Plan for Hard Days',
    watch: '1:27',
    skill: ['PREPARATION', 'You can plan which tool you’ll use on a hard day, before it arrives.'],
    examples: { SLIP: 'Friday at 6:30, when the alarm goes after a late night.', READY: 'put “Friday 6:30, feet on the floor” in my calendar and set Friday’s alarm now.' },
    // Step 13: the promise follows the chosen tool, in the user's own words from Steps 12, or 9 and 10.
    act: { from: 1, promise: answers => [
      'On ', 0, ', I will ',
      ...answers.TOOL === 'minimum' ? ['do at least my minimum: ', { from: 12, key: 'MINIMUM' }]
        : answers.TOOL === 'swap' ? ['pause, say “', { from: 10, key: 'LINE' }, '”, and ', { from: 9, key: 'SWAP' }]
        : [{ empty: true }],
      '. Today, I will ', 3, '.'] },
    journal: ({ r, said, plainDate }) => [['HARD DAY',r.DATE?'My hard day is '+plainDate(r.DATE)+'.':''],said('SLIP POINT','The point it’s most likely to slip is','SLIP'),
      ['TOOL',{minimum:'My minimum.',swap:'My swap and my line.'}[r.TOOL]||''],said('GETTING READY','Today, to get ready, I will','READY')]
  });

  // ---- src/steps/step14/step.js
  // Step 14 · Raise the Bar
  step(14, {
    title: 'Raise the Bar',
    watch: '1:31',
    skill: ['PROGRESSION', 'You can let the evidence decide when to raise the bar.'],
    examples: { NEWBAR: 'being dressed and ready to start my morning by 6:40.' },
    // Step 14: raise the bar (MY NEW BAR) or make it hold (the Step 03 move).
    act: { from: 1, promise: answers =>
      answers.DECISION === 'raise' ? ['Today, I will start my new bar: ', 1, '.']
      : answers.DECISION === 'hold' ? ['Today, I will do my full move: ', { from: 3, key: 'MOVE' }, '.']
      : ['Today, I will ', { empty: true }, '.'] },
    journal: ({ r, said }) => [['DECISION',{raise:'Raise the bar.',hold:'Make it hold.'}[r.DECISION]||''],r.DECISION==='raise'?said('NEW BAR','My one small increase is','NEWBAR'):['','']]
  });

  // ---- src/steps/step15/step.js
  // Step 15 · Know How to Restart
  step(15, {
    title: 'Know How to Restart',
    watch: '1:20',
    skill: ['RESTART', 'You can set a rule to come back after a miss, at your next chance, with your minimum.'],
    examples: { STORY: '“I’ve blown it this week, I’ll start again on Monday.”', RULE: 'the next morning with feet on the floor at 6:30.' },
    // Step 15: the same words for everyone; the boxes hold the story and the restart rule.
    act: { from: 1, promise: ['My restart rule is set. Today, I will do my move, or at least my minimum, if it’s due.'] },
    journal: ({ said }) => [said('STORY','If I miss, the story I’d tell myself is','STORY'),said('RESTART RULE','If I miss, I will restart','RULE')]
  });

  // ---- src/steps/step16/step.js
  // Step 16 · Look Back
  step(16, {
    title: 'Look Back',
    watch: '1:23',
    skill: ['HINDSIGHT', 'You can look back over your record and see what’s working and what isn’t yet.'],
    examples: { WORKING: 'using my minimum when I need it.', NOTYET: 'doing my full move after late nights.' },
    // Step 16: the boxes hold what's working and what isn't yet (Step 17 starts from it); the promise names
    // the person from Step 11.
    act: { from: 1, promise: ['Today, I’ll send ', { from: 11, key: 'PERSON' }, ' what I found.'] },
    journal: ({ said }) => [said('WORKING','One thing that’s working is','WORKING'),said('NOT YET','One thing that isn’t working yet is','NOTYET')]
  });

  // ---- src/steps/step17/step.js
  // Step 17 · Own Your Part
  step(17, {
    title: 'Own Your Part',
    watch: '1:26',
    skill: ['INSIGHT', 'You can separate what happened from what you did, and own your part without blame.'],
    examples: { AROUND: 'the night ran late at my friend’s birthday.', DID: 'stay for another hour after saying I’d leave at 11.', ACTION: 'set a 10:45 “time to go” alarm for Saturday’s dinner.' },
    // Step 17: from MY ACTION TODAY only (Step 18 brings WHAT I DID and the action forward).
    act: { from: 1, promise: ['Today, I’ll ', 2, '.'] },
    journal: ({ said }) => [said('AROUND ME','What happened around me was','AROUND'),said('WHAT I DID','What I did was','DID'),said('MY ACTION','Because that part is mine, today I’ll','ACTION')]
  });

  // ---- src/steps/step18/step.js
  // Step 18 · Keep, Stop, Start
  step(18, {
    title: 'Keep, Stop, Start',
    watch: '1:28',
    skill: ['FORESIGHT', 'You can decide what to keep, what to stop and what to start.'],
    // MY KEEP and MY STOP are asked as questions (no starter), so their examples are whole answers.
    examples: { KEEP: 'Using my minimum on hard mornings.', STOP: 'Staying out past the time I said I’d leave.', START: 'telling Sam my leaving time before a late night.', FIRST: 'message Sam my leaving time for Saturday’s dinner.' },
    // Step 18: from MY FIRST STEP; MY KEEP, MY STOP and MY START are kept for Step 19 and Step 21.
    act: { from: 1, promise: ['Today, I’ll ', 3, '.'] },
    // MY KEEP and MY STOP were asked as questions: their answers stand alone ("Nothing yet").
    journal: ({ r, said }) => [['KEEP',r.KEEP],['STOP',r.STOP],said('START','I’ll start','START'),said('FIRST STEP','Today, to begin, I’ll','FIRST')]
  });

  // ---- src/steps/step19/step.js
  // Step 19 · Put It All Together
  step(19, {
    title: 'Put It All Together',
    watch: '1:28',
    skill: ['METHOD', 'You can run See It, Own It, Change It as one method.'],
    examples: { SEE: 'weekday mornings are holding, and mornings after late nights still slip.', OWN: 'getting up on weekdays, which is working, and staying out past my leaving time.', MOVE: 'getting up at 6:30 every day.', ACTION: 'put my phone on charge in the kitchen tonight, straight after I brush my teeth.' },
    // Step 19: the Mirror Method card (SEE, OWN, MOVECHOICE and MOVE, TOOL, ACTION); the promise is TODAY'S
    // ACTION only. The tool stays on the card.
    act: { from: 1, promise: ['Today, I’ll ', 5, '.'] },
    // The Mirror Method card. The move row only when updated; the tool by name.
    journal: ({ r, said }) => [said('SEE IT','What’s happening now is','SEE'),said('OWN IT','The part that’s mine is','OWN'),
      r.MOVECHOICE==='update'?said('NEW MOVE','My move is','MOVE'):['MY MOVE','Kept my move.'],
      ['TOOL',{anchor:'My anchor.',swap:'My swap and my line.',minimum:'My minimum.',restart:'My restart rule.'}[r.TOOL]||''],
      said('ACTION','Today, I’ll','ACTION')]
  });

  // ---- src/steps/step20/step.js
  // Step 20 · Use It on Something New
  step(20, {
    title: 'Use It on Something New',
    watch: '1:22',
    skill: ['INDEPENDENCE', 'You can use the method on something new, without prompts.'],
    // Step 20: a blank card for a new change (NEWCHANGE, SEE, OWN, CHANGEIT, FIRST), kept apart from Step 19's;
    // the promise is MY FIRST MOVE TODAY only.
    act: { from: 1, promise: ['Today, I’ll ', 4, '.'] },
    // The blank card for a new change: no starters, so the answers stand alone.
    journal: ({ r }) => [['NEW CHANGE',r.NEWCHANGE],['SEE IT',r.SEE],['OWN IT',r.OWN],['CHANGE IT',r.CHANGEIT],['FIRST MOVE',r.FIRST]]
  });

  // ---- src/steps/step21/step.js
  // Step 21 · See What Changed
  step(21, {
    title: 'See What Changed',
    watch: '1:24',
    skill: ['CLARITY', 'You can compare where you started with where you are now, and choose what comes next.'],
    examples: { HERENOW: 'get up at 6:30 most weekdays and wake up rested. Late nights still knock me back.', ACTION: 'put my leaving time for Friday’s dinner in my calendar.' },
    // Step 21: MY HERE NOW, WHAT'S NEXT (keep / again / new) and MY NEXT ACTION; the promise is the next action.
    act: { from: 1, promise: ['Today, I’ll ', 2, '.'] },
    journal: ({ r, said }) => [said('HERE NOW','Right now, I','HERENOW'),['WHAT’S NEXT',{keep:'Keep working on this change.',again:'Run the steps again.',new:'Use the method on something new.'}[r.NEXT]||''],said('NEXT ACTION','Today, I’ll','ACTION')]
  });
  const api = { steps };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MirrorContent = api;
})(globalThis);
