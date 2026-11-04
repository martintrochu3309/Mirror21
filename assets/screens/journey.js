/* My Journey (html/19-my-journey.html): every committed step in the user's own words. Run by the app shell. */
(globalThis.MirrorScreens ||= {}).journey = app => {
  const { state, summary, pad, el } = app;
  const { committedSteps, dateOf, answersOf, results } = MirrorJournal(state);
  // My Journey: every committed step in the user's own words, read-only, then today's step.
  function renderJourney() {
    const stats=summary(),list=document.querySelector('#journey'),scroll=document.querySelector('.journey-scroll');
    const written=committedSteps();
    const today=stats.today&&stats.active?stats.today:null;
    const shown=today?[...written,today]:written;
    const weeks=['SEE IT','OWN IT','CHANGE IT'];
    const lock='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" role="img" aria-label="Locked"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
    const chevron='<svg class="entry-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    const latestGraded=written.filter(d=>state.answers[d]).pop();
    list.replaceChildren();
    let week=0,openEntry=null;
    shown.forEach((d,i)=>{
      if(Math.ceil(d/7)!==week){
        week=Math.ceil(d/7);
        const divider=el('div','journey-week'),name=el('span','journey-week-label','BLOCK '+week+' ');
        name.append(el('b',null,'· '+weeks[week-1]));divider.append(name);list.append(divider);
      }
      const isToday=d===today,answer=state.answers[d],next=shown[i+1];
      const entry=el('section','entry'+(isToday?' is-today':''));entry.dataset.step=String(d);
      const rail=el('div','entry-rail'),dot=el('div','entry-dot '+(isToday?'today':answer||'committed'),pad(d));
      dot.setAttribute('role','img');
      dot.setAttribute('aria-label','Step '+pad(d)+', '+(isToday?'today':answer?results[answer]:'committed, waiting for its check-in'));
      rail.append(dot);
      // Gold between graded steps, grey after.
      if(next)rail.append(el('div','entry-line'+(answer&&state.answers[next]?' is-gold':'')));
      const body=el('div','entry-body');
      if(isToday){
        const meta=el('div','entry-meta','STEP '+pad(d)+' · TODAY');
        body.append(meta,el('p','entry-title',MirrorSteps.title(d)),el('p','entry-note','Your answers will appear here once you commit.'));
      } else {
        const head=el('button','entry-head');head.type='button';head.setAttribute('aria-expanded','false');head.setAttribute('aria-controls','entry-detail-'+d);
        const meta=el('span','entry-meta');meta.append(el('span',null,'STEP '+pad(d)));
        const date=dateOf(d);if(date)meta.append(el('span','date',' · '+date));
        meta.insertAdjacentHTML('beforeend',chevron);
        head.append(meta,el('span','entry-title',MirrorSteps.title(d)));
        head.querySelector('.entry-title').style.display='block';
        const promise=state.dayChanges[d]||'';
        const detail=el('div','entry-detail');detail.id='entry-detail-'+d;
        const rows=answersOf(d);
        if(rows.length){
          const dl=el('dl','entry-answers');
          rows.forEach(([label,text])=>{const row=el('div','entry-answer');row.append(el('dt',null,label),el('dd',null,text.trim()));dl.append(row);});
          detail.append(dl);
        }
        const label=el('div','entry-promise-label','MY PROMISE');label.insertAdjacentHTML('beforeend',lock);
        detail.append(label,el('p','entry-locked',promise));
        body.append(head,el('p','entry-promise',promise),detail);
        const setOpen=open=>{entry.classList.toggle('is-open',open);head.setAttribute('aria-expanded',String(open));};
        head.addEventListener('click',()=>setOpen(!entry.classList.contains('is-open')));
        if(d===latestGraded){setOpen(true);openEntry=entry;}
      }
      entry.append(rail,body);list.append(entry);
    });
    const left=21-written.length;
    document.querySelector('#journeyFooter').textContent=left===0?'All 21 steps written.':left===1?'1 more step to write.':left+' more steps to write.';
    fitEntryTitles();
    // Open on the latest graded step.
    if(openEntry)requestAnimationFrame(()=>{scroll.scrollTop=Math.max(0,scroll.scrollTop+openEntry.getBoundingClientRect().top-scroll.getBoundingClientRect().top-24);});
  }
  // Step titles stay on one line: a long one shrinks just enough to fit (as on the Watch screen).
  function fitEntryTitles() {
    document.querySelectorAll('.entry-title').forEach(title=> {
      title.style.fontSize='';
      const range=document.createRange();range.selectNodeContents(title);
      const needed=range.getBoundingClientRect().width,available=title.clientWidth;
      if(needed>available)title.style.fontSize=Math.floor(parseFloat(getComputedStyle(title).fontSize)*available/needed*0.985*10)/10+'px';
    });
  }
  // Titles fit again once the fonts have loaded, and when the width changes.
  document.fonts.ready.then(fitEntryTitles);
  let lastWidth=innerWidth;
  addEventListener('resize',()=>{if(innerWidth!==lastWidth){lastWidth=innerWidth;fitEntryTitles();}});
  renderJourney();
};
