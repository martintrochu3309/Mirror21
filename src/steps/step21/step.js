// Step 21 · See What Changed
step(21, {
  title: 'See What Changed',
  watch: '1:24',
  skill: ['CLARITY', 'You can compare where you started with where you are now, and choose what comes next.'],
  examples: { HERENOW: 'get up at 6:30 most weekdays and wake up rested. Late nights still knock me back.', ACTION: 'put my leaving time for Friday’s dinner in my calendar.' },
  // Step 21: MY HERE NOW, WHAT'S NEXT (keep / again / new) and MY NEXT ACTION; the promise is the next action.
  act: { from: 1, promise: ['Today, I’ll ', 2, '.'] },
  journal: ({ r, said }) => [said('HERE NOW','Right now, I','HERENOW'),['WHAT’S NEXT',{keep:'Keep working on this change.',again:'Run the steps again.',new:'Use the method on something new.'}[r.NEXT]||''],said('NEXT ACTION','Today, I’ll','ACTION')]
});
