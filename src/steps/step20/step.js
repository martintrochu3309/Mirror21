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
