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
