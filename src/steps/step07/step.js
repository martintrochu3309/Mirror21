// Step 07 · Link It to Your Day
step(7, {
  title: 'Link It to Your Day',
  watch: '1:20',
  skill: ['ROUTINE', 'You can link an action to something you already do each day.'],
  examples: { ANCHOR: 'brush my teeth at night.', ACTION: 'put my phone on charge in the kitchen and read my book in bed.' },
  act: { from: 1, promise: ['Today, after I ', 0, ', I will ', 1, '.'] },
  journal: ({ said }) => [said('ANCHOR','Every day, I','ANCHOR'),said('ACTION','Straight after, I will','ACTION')]
});
