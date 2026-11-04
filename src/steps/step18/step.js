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
