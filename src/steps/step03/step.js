// Step 03 · Pick One Move
step(3, {
  title: 'Pick One Move',
  watch: '1:18',
  skill: ['PRIORITY', 'You can identify the move that matters most.'],
  examples: { MOVE: 'getting up at the same time every day.', ACTION: 'set a 6:30am alarm for every day this week, weekends included.' },
  act: { from: 1, back: 1, promise: ['Today, I will ', 1, '.'] },
  journal: ({ said, proof }) => [said('MOVE','The move that matters most is','MOVE'),said('ACTION','Today I will','ACTION'),proof]
});
