// Step 08 · Spot Your Old Habit
step(8, {
  title: 'Spot Your Old Habit',
  watch: '1:27',
  skill: ['PATTERN', 'You can spot your old habit: when it shows up, what you do, and what it gives you.'],
  examples: { WHEN: 'I’m on the sofa at about 10pm and the day’s done.', WHAT: 'scroll for 45 minutes, which is why getting up at 6:30 is a fight.', PAYOFF: 'a way to switch off from the day.' },
  act: { from: 3, promise: ['Today, when ', 0, ', I will catch my old habit as it starts and name it. If it doesn’t show up, I will look back at the last time it did.'] },
  journal: ({ said }) => [said('WHEN','It usually happens when','WHEN'),said('WHAT','What I actually do is','WHAT'),said('PAYOFF','It gives me','PAYOFF')]
});
