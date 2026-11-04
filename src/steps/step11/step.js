// Step 11 · Tell Someone
step(11, {
  title: 'Tell Someone',
  watch: '1:35',
  skill: ['ACCOUNTABILITY', 'You can put your promise where someone else can see it.'],
  examples: { PERSON: 'Sam, a friend I trust.' },
  act: { from: 1, promise: ['Today, I will tell ', 0, ' what I’m changing, and that I will report back on ', 1, '.'] },
  journal: ({ r, said, plainDate }) => [said('PERSON','I will tell','PERSON'),['REPORT BACK',r.DATE?'I will report back on '+plainDate(r.DATE)+'.':'']]
});
