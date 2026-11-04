// Step 12 · Set a Minimum
step(12, {
  title: 'Set a Minimum',
  watch: '1:29',
  skill: ['MINIMUM', 'You can keep your move going on the days you can’t do it all.'],
  examples: { MINIMUM: 'get my feet on the floor at 6:30, even if I’m slow after that.' },
  act: { from: 1, promise: ['Today, I will do my move, or at least ', 0, '.'] },
  journal: ({ said }) => [said('MINIMUM','On a bad day, the least I will do is','MINIMUM')]
});
