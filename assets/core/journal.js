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
    // Each step's rows are the journal field of its src/steps/stepNN/step.js; Step 01's are the fallback.
    const rows=(MirrorContent.steps[MirrorSteps.lesson(d)]||MirrorContent.steps[1]).journal({r,said,proof,plainDate:MirrorSteps.plainDate});
    return rows.filter(([,text])=>text&&text.trim());
  };
  const results={yes:'kept',partly:'partly kept',no:'not kept'};
  return { committedSteps, dateOf, answersOf, results };
};
