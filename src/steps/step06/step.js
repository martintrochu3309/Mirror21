// Step 06 · Change Your Surroundings
step(6, {
  title: 'Change Your Surroundings',
  watch: '1:13',
  skill: ['SURROUNDINGS', 'You can change your surroundings to make the right behaviour easier.'],
  examples: { EASY: 'the TV remote lives on my bedside table.', CHANGE: 'put the TV remote in the living room and a book on my pillow.' },
  act: { from: 1, back: 1, promise: ['Today, I will ', 1, '.'] },
  journal: ({ said, proof }) => [said('EASY','The old habit is easy because','EASY'),said('CHANGE','Today I will','CHANGE'),proof]
});
