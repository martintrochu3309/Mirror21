// Step 09 · Break the Habit
step(9, {
  title: 'Break the Habit',
  watch: '1:30',
  skill: ['REPLACEMENT', 'You can swap an old habit for something that gives you the same thing.'],
  examples: { SWAP: 'pick up my book.' },
  act: { from: 1, promise: ['Today, when ', { from: 8, key: 'WHEN' }, ', I will pause and ', 0, '. If the moment doesn’t come, I will run through it once in my head.'] },
  journal: ({ said }) => [said('SWAP','Instead, I will','SWAP')]
});
