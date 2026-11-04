// Step 17 · Own Your Part
step(17, {
  title: 'Own Your Part',
  watch: '1:26',
  skill: ['INSIGHT', 'You can separate what happened from what you did, and own your part without blame.'],
  examples: { AROUND: 'the night ran late at my friend’s birthday.', DID: 'stay for another hour after saying I’d leave at 11.', ACTION: 'set a 10:45 “time to go” alarm for Saturday’s dinner.' },
  // Step 17: from MY ACTION TODAY only (Step 18 brings WHAT I DID and the action forward).
  act: { from: 1, promise: ['Today, I’ll ', 2, '.'] },
  journal: ({ said }) => [said('AROUND ME','What happened around me was','AROUND'),said('WHAT I DID','What I did was','DID'),said('MY ACTION','Because that part is mine, today I’ll','ACTION')]
});
