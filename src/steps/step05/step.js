// Step 05 · Pause Before You React
step(5, {
  title: 'Pause Before You React',
  watch: '1:38',
  skill: ['RESPONSE', 'You can pause and choose your response instead of reacting automatically.'],
  examples: { MOMENT: 'I’m about to start another episode.', RESPONSE: 'switch the TV off.' },
  act: { from: 1, back: 0, promise: ['Today, when ', 0, ', I will pause and ', 1, '. If it doesn’t come, I’ll run through it once in my head.'] },
  journal: ({ said }) => [said('MOMENT','When','MOMENT'),said('RESPONSE','I will pause and','RESPONSE'),['READY','Yes, I’ll know the moment when it comes.']]
});
