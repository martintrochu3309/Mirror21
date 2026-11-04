/* My Mirror (html/18-my-mirror.html): steps so far, the three rings and the step worth a second look.
   Run by the app shell. */
(globalThis.MirrorScreens ||= {}).mirror = app => {
  const { state, summary, pad, labels, weekThemes, stepsToGo, el } = app;
  function renderMirror() {
    const stats=summary(),container=document.querySelector('.mirror-scroll');
    container.querySelector(':scope > p')?.remove();
    const days=container.querySelector('[aria-label="Steps so far"]');
    days.classList.add('days-so-far');
    // Dots match the check-in icons: full, half or ring-only gold; committed is plain white.
    const dotLook={yes:['#e0b84c','2px solid #e0b84c'],partly:['linear-gradient(90deg,#e0b84c 50%,#ffffff 50%)','2px solid #e0b84c'],no:['#ffffff','2px solid #e0b84c']};
    days.querySelectorAll('span[title]').forEach((dot,i)=> { const d=i+1,answer=state.answers[d],committed=state.lessons[d]&&!answer;const [background,border]=answer?dotLook[answer]:committed?['#ffffff','1px solid #c9c9c5']:d===stats.today?['#ffffff','2px solid #111111']:['#e4e4e0','0'];dot.style.background=background;dot.style.border=border;dot.title='Step '+d+(answer?': '+labels[answer]:committed?': committed, not checked in yet':d===stats.today?': today':''); });
    const rings=container.querySelectorAll('[aria-label="Where I stand"] svg');
    // Follow-through \u00b7 steps to go (fills as steps are committed) \u00b7 missed: NO answers out of check-ins so far.
    const graded=Object.keys(state.answers).map(Number).filter(d=>d>=1&&d<=21).sort((a,b)=>a-b);
    const missed=graded.filter(d=>state.answers[d]==='no');
    [[stats.checkIns?stats.points/stats.checkIns:0,stats.percent+'%','Follow-through so far, '+stats.percent+' percent'],[stats.committed/21,String(stats.stepsToGo),stepsToGo(stats)],[stats.checkIns?missed.length/stats.checkIns:0,String(missed.length),missed.length+' missed of '+stats.checkIns+' check-ins','OF '+stats.checkIns]].forEach(([ratio,value,aria,sub],i)=> { rings[i].querySelector('text').textContent=value;if(sub)rings[i].querySelectorAll('text')[1].textContent=sub;rings[i].setAttribute('aria-label',aria);rings[i].querySelectorAll('circle')[1].setAttribute('stroke-dashoffset',(314.16*(1-ratio)).toFixed(2)); });
    // Worth a second look: the latest NO, otherwise the latest PARTLY, with its locked promise (two lines at
    // most) and REVISIT STEP NN, which reopens it from Watch like a done step on the map. Nothing to look at:
    // a short line instead.
    const look=missed.at(-1)??graded.filter(d=>state.answers[d]==='partly').at(-1);
    const tag=document.querySelector('#secondLookTag'),body=document.querySelector('#secondLookBody');
    if(tag&&body){
      tag.textContent=look?(state.answers[look]==='no'?'MISSED':'PARTLY'):'';
      if(!look) body.replaceChildren(el('p','second-look-none','Nothing missed so far. Keep going.'));
      else {
        const step=el('div','second-look-step'),text=el('div','second-look-text');
        text.append(el('p','second-look-name',MirrorSteps.title(look)),el('p','second-look-promise',(state.dayChanges[look]||'').trim()));
        step.append(el('span','second-look-num',pad(look)),text);
        const revisit=el('a','second-look-revisit','REVISIT STEP '+pad(look)+' ');revisit.href='step-watch.html?step='+look;
        revisit.insertAdjacentHTML('beforeend','<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>');
        body.replaceChildren(step,revisit);
      }
    }
    // The current block and its theme, e.g. BLOCK 1 \u00b7 SEE IT.
    const week=container.querySelector('[aria-label="Where I stand"] > div:last-child');
    week.children[0].textContent='BLOCK '+stats.week;week.children[1].textContent=weekThemes[stats.week-1];
    week.setAttribute('aria-label','Block '+stats.week+', '+weekThemes[stats.week-1].toLowerCase());
  }
  renderMirror();
};
