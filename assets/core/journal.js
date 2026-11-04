/* The journal: each committed step's own answers as full sentences, its commit date and its result in words.
   Shared by My Journey and Save my journal as PDF. MirrorJournal(state) gives the helpers for one course. */
globalThis.MirrorJournal = state => {
  const pad = day => String(day).padStart(2,'0');
  const committedSteps=()=>Array.from({length:21},(_,i)=>i+1).filter(d=>state.lessons[d]);
  const dateOf=d=>{
    const at=state.steps[d]?.committedAt;if(!at)return '';
    const when=new Date(at);
    return when.toLocaleDateString('en-GB',{weekday:'short'}).toUpperCase()+' '+when.getDate()+' '+when.toLocaleDateString('en-GB',{month:'short'}).toUpperCase();
  };
  // Only the step's own answers, full sentences, as Act wrote them.
  const answersOf=d=>{
    const r=state.responses[d]||{};
    // Steps 02–19 save typed words only (Step 20: no starters): put each back after its sentence starter (Step 11's date in plain words).
    const said=(label,starter,key)=>[label,r[key]?.trim()?starter+' '+r[key].trim():''];
    const proof=['PROOF','Yes, I could prove it.'];
    const rows={
      2:[said('ACTION','Today I will','ACTION'),proof],
      3:[said('MOVE','The move that matters most is','MOVE'),said('ACTION','Today I will','ACTION'),proof],
      4:[said('IN THE WAY','The thing that could stop me is','WAY'),said('ACTION','Today I will','ACTION'),['CONTROL','Yes, it’s in my control.']],
      5:[said('MOMENT','When','MOMENT'),said('RESPONSE','I will pause and','RESPONSE'),['READY','Yes, I’ll know the moment when it comes.']],
      6:[said('EASY','The old habit is easy because','EASY'),said('CHANGE','Today I will','CHANGE'),proof],
      7:[said('ANCHOR','Every day, I','ANCHOR'),said('ACTION','Straight after, I will','ACTION')],
      8:[said('WHEN','It usually happens when','WHEN'),said('WHAT','What I actually do is','WHAT'),said('PAYOFF','It gives me','PAYOFF')],
      9:[said('SWAP','Instead, I will','SWAP')],
      10:[said('WHY','This really matters to me because','WHY'),said('LINE','My line is','LINE')],
      11:[said('PERSON','I will tell','PERSON'),['REPORT BACK',r.DATE?'I will report back on '+MirrorSteps.plainDate(r.DATE)+'.':'']],
      12:[said('MINIMUM','On a bad day, the least I will do is','MINIMUM')],
      13:[['HARD DAY',r.DATE?'My hard day is '+MirrorSteps.plainDate(r.DATE)+'.':''],said('SLIP POINT','The point it’s most likely to slip is','SLIP'),
        ['TOOL',{minimum:'My minimum.',swap:'My swap and my line.'}[r.TOOL]||''],said('GETTING READY','Today, to get ready, I will','READY')],
      14:[['DECISION',{raise:'Raise the bar.',hold:'Make it hold.'}[r.DECISION]||''],r.DECISION==='raise'?said('NEW BAR','My one small increase is','NEWBAR'):['','']],
      15:[said('STORY','If I miss, the story I’d tell myself is','STORY'),said('RESTART RULE','If I miss, I will restart','RULE')],
      16:[said('WORKING','One thing that’s working is','WORKING'),said('NOT YET','One thing that isn’t working yet is','NOTYET')],
      17:[said('AROUND ME','What happened around me was','AROUND'),said('WHAT I DID','What I did was','DID'),said('MY ACTION','Because that part is mine, today I’ll','ACTION')],
      // MY KEEP and MY STOP were asked as questions: their answers stand alone ("Nothing yet").
      18:[['KEEP',r.KEEP],['STOP',r.STOP],said('START','I’ll start','START'),said('FIRST STEP','Today, to begin, I’ll','FIRST')],
      // The Mirror Method card. The move row only when updated; the tool by name.
      19:[said('SEE IT','What’s happening now is','SEE'),said('OWN IT','The part that’s mine is','OWN'),
        r.MOVECHOICE==='update'?said('NEW MOVE','My move is','MOVE'):['MY MOVE','Kept my move.'],
        ['TOOL',{anchor:'My anchor.',swap:'My swap and my line.',minimum:'My minimum.',restart:'My restart rule.'}[r.TOOL]||''],
        said('ACTION','Today, I’ll','ACTION')],
      // The blank card for a new change: no starters, so the answers stand alone.
      20:[['NEW CHANGE',r.NEWCHANGE],['SEE IT',r.SEE],['OWN IT',r.OWN],['CHANGE IT',r.CHANGEIT],['FIRST MOVE',r.FIRST]],
      21:[said('HERE NOW','Right now, I','HERENOW'),['WHAT’S NEXT',{keep:'Keep working on this change.',again:'Run the steps again.',new:'Use the method on something new.'}[r.NEXT]||''],said('NEXT ACTION','Today, I’ll','ACTION')]
    }[MirrorSteps.lesson(d)]||[['HERE',r.HERE],['THERE',r.THERE],['TEST','Yes, that’s what I actually want.'],['STEP',r.STEP]];
    return rows.filter(([,text])=>text&&text.trim());
  };
  const results={yes:'kept',partly:'partly kept',no:'not kept'};
  return { committedSteps, dateOf, answersOf, results };
};
