// Step 16 · Look Back
step(16, {
  title: 'Look Back',
  watch: '1:23',
  skill: ['HINDSIGHT', 'You can look back over your record and see what’s working and what isn’t yet.'],
  examples: { WORKING: 'using my minimum when I need it.', NOTYET: 'doing my full move after late nights.' },
  // Step 16: the boxes hold what's working and what isn't yet (Step 17 starts from it); the promise names
  // the person from Step 11.
  act: { from: 1, promise: ['Today, I’ll send ', { from: 11, key: 'PERSON' }, ' what I found.'] },
  journal: ({ said }) => [said('WORKING','One thing that’s working is','WORKING'),said('NOT YET','One thing that isn’t working yet is','NOTYET')]
});
