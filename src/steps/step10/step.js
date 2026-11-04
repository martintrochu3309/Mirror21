// Step 10 · Know Why It Matters
step(10, {
  title: 'Know Why It Matters',
  watch: '1:27',
  skill: ['REASON', 'You can use your own line at the moment the old habit pulls.'],
  examples: { WHY: 'I’m tired of only being half there.', LINE: '“Be all there tomorrow.”' },
  act: { from: 1, promise: ['Today, when ', { from: 8, key: 'WHEN' }, ', I will pause, say “', 1, '”, and ', { from: 9, key: 'SWAP' }, '. If the moment doesn’t come, I will run through it once in my head.'] },
  journal: ({ said }) => [said('WHY','This really matters to me because','WHY'),said('LINE','My line is','LINE')]
});
