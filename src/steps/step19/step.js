// Step 19 · Put It All Together
step(19, {
  title: 'Put It All Together',
  watch: '1:28',
  skill: ['METHOD', 'You can run See It, Own It, Change It as one method.'],
  examples: { SEE: 'weekday mornings are holding, and mornings after late nights still slip.', OWN: 'getting up on weekdays, which is working, and staying out past my leaving time.', MOVE: 'getting up at 6:30 every day.', ACTION: 'put my phone on charge in the kitchen tonight, straight after I brush my teeth.' },
  // Step 19: the Mirror Method card (SEE, OWN, MOVECHOICE and MOVE, TOOL, ACTION); the promise is TODAY'S
  // ACTION only. The tool stays on the card.
  act: { from: 1, promise: ['Today, I’ll ', 5, '.'] },
  // The Mirror Method card. The move row only when updated; the tool by name.
  journal: ({ r, said }) => [said('SEE IT','What’s happening now is','SEE'),said('OWN IT','The part that’s mine is','OWN'),
    r.MOVECHOICE==='update'?said('NEW MOVE','My move is','MOVE'):['MY MOVE','Kept my move.'],
    ['TOOL',{anchor:'My anchor.',swap:'My swap and my line.',minimum:'My minimum.',restart:'My restart rule.'}[r.TOOL]||''],
    said('ACTION','Today, I’ll','ACTION')]
});
