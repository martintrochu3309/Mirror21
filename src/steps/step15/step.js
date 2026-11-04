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
