// Step 14 · Raise the Bar
step(14, {
  title: 'Raise the Bar',
  watch: '1:31',
  skill: ['PROGRESSION', 'You can let the evidence decide when to raise the bar.'],
  examples: { NEWBAR: 'being dressed and ready to start my morning by 6:40.' },
  // Step 14: raise the bar (MY NEW BAR) or make it hold (the Step 03 move).
  act: { from: 1, promise: answers =>
    answers.DECISION === 'raise' ? ['Today, I will start my new bar: ', 1, '.']
    : answers.DECISION === 'hold' ? ['Today, I will do my full move: ', { from: 3, key: 'MOVE' }, '.']
    : ['Today, I will ', { empty: true }, '.'] },
  journal: ({ r, said }) => [['DECISION',{raise:'Raise the bar.',hold:'Make it hold.'}[r.DECISION]||''],r.DECISION==='raise'?said('NEW BAR','My one small increase is','NEWBAR'):['','']]
});
