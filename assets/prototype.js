/* One progress state drives My Path, all map variants, My Mirror and My Journey. */
(() => {
  // Netlify Pretty URLs remove .html from paths and exported anchor hrefs.
  function pageFilename(pathname) {
    const segment = pathname.split('/').filter(Boolean).pop() || '';
    return segment && !segment.includes('.') ? segment+'.html' : segment;
  }
  const filename = pageFilename(location.pathname);
  const maps = ['04-map-start.html'];
  const stepPages = ['step-checkin.html','step-watch.html','step-learn.html','step-act.html','step02-learn.html','step02-act.html'];
  const pages = new Set(['01-offer.html','18-my-mirror.html','19-my-journey.html', ...maps, ...stepPages]);
  // Restore known internal links before attaching handlers that match exported hrefs.
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    const url = new URL(href, location.href);
    const name = pageFilename(url.pathname);
    if (url.origin !== location.origin || !pages.has(name)) return;
    link.setAttribute('href', name + url.search + url.hash);
  });
  const model = MirrorProgress;
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key,value) => { try { localStorage.setItem(key,value); } catch {} };
  // Progress belongs to this browser. Shared links must never import another device's attempt.
  let raw;
  try { raw = JSON.parse(read('mirror21-progress')); } catch {}
  const state = model.normalize(raw);
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.has('progress')) {
    fragment.delete('progress');
    history.replaceState(null, '', location.pathname + location.search + (fragment.size ? '#'+fragment : ''));
  }
  const save = () => { state.updatedAt = Date.now(); write('mirror21-progress', JSON.stringify(state)); };
  const summary = () => model.stats(state);
  const pad = day => String(day).padStart(2,'0');
  const labels = {yes:'Yes, I did it',partly:'Partly',no:'No'};
  const weekThemes = ['SEE IT','OWN IT','CHANGE IT'];
  const stepsToGo = stats => stats.stepsToGo === 0 ? 'All 21 steps done' : stats.stepsToGo === 1 ? '1 step to go' : stats.stepsToGo+' steps to go';
  const currentMap = '04-map-start.html';
  if(!raw || raw.version !== 1) save();
  function setActionLabel(link, label) {
    const text = document.createElement('span');
    text.className = 'action-label';
    text.textContent = label;
    const arrow = document.createElement('span');
    arrow.className = 'action-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"></path></svg>';
    link.replaceChildren(text, arrow);
  }
  let openDayCard = null;
  function closeDayCard(restoreFocus = false) {
    if (!openDayCard) return;
    const { card, step, row } = openDayCard;
    card.remove();
    row.classList.remove('is-selected');
    step.setAttribute('aria-expanded', 'false');
    openDayCard = null;
    if (restoreFocus) step.focus();
  }
  function showDayCard(step, row, scroll, dayNumber) {
    if (openDayCard?.step === step) { closeDayCard(); return; }
    closeDayCard();
    const card = document.createElement('section');
    card.id = 'map-day-card';
    card.className = 'day-popover';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-labelledby', 'map-day-card-title');
    const title = document.createElement('h2');
    title.id = 'map-day-card-title';
    title.textContent = MirrorSteps.title(dayNumber);
    if (dayNumber > 0 && !MirrorSteps.available(dayNumber)) {
      const note = document.createElement('p');note.className='welcome-card-stage';note.textContent='COMING SOON';card.append(title,note);
    } else {
      const start = document.createElement('a');
      start.className = 'day-popover-start action-pill';
      start.href = step.href;
      const done = dayNumber > 0 && Boolean(state.lessons[dayNumber]);
      const continuing = dayNumber > 0 && !done && model.session(state,dayNumber).label === 'CONTINUE';
      setActionLabel(start, done ? 'REDO STEP' : continuing ? 'CONTINUE' : 'START STEP');
      start.setAttribute('aria-label', (done ? 'Redo' : continuing ? 'Continue' : 'Start')+' Step '+dayNumber+': '+title.textContent);
      if (dayNumber === 0) {
        const stage = document.createElement('p');stage.className='welcome-card-stage';stage.textContent='WATCH';card.append(title,stage,start);
      } else card.append(title, start);
    }
    for (const [left, top] of [[3, 43], [2, 65], [97, 43], [25, 94], [73, 96]]) {
      const sparkle = document.createElement('span');
      sparkle.className = 'day-popover-sparkle';
      sparkle.setAttribute('aria-hidden', 'true');
      sparkle.style.left = left+'%';
      sparkle.style.top = top+'%';
      sparkle.style.setProperty('--particle-delay', (-card.querySelectorAll('.day-popover-sparkle').length * .37)+'s');
      card.append(sparkle);
    }
    scroll.append(card);
    row.classList.add('is-selected');
    step.setAttribute('aria-expanded', 'true');
    openDayCard = { card, step, row };
    const bounds = step.getBoundingClientRect();
    const viewport = scroll.getBoundingClientRect();
    // Include the tile's bottom lip when attaching the pointer below it.
    card.style.top = (bounds.bottom - viewport.top + scroll.scrollTop + 20)+'px';
    const pointer = bounds.left + bounds.width / 2 - viewport.left - 16;
    card.style.setProperty('--pointer-left', Math.max(24, Math.min(scroll.clientWidth - 56, pointer))+'px');
    const bottom = card.offsetTop + card.offsetHeight;
    const availableBottom = scroll.scrollTop + scroll.clientHeight - 116;
    if (bottom > availableBottom) scroll.scrollTo({
      top: scroll.scrollTop + bottom - availableBottom,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
    (card.querySelector('a') || step).focus({ preventScroll: true });
  }
  document.addEventListener('click', event => {
    if (openDayCard && !openDayCard.card.contains(event.target) && !openDayCard.step.contains(event.target)) closeDayCard();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && openDayCard) { event.preventDefault(); closeDayCard(true); }
  });
  let mapDecorObserver;
  function renderMap(center = false) {
    closeDayCard();
    mapDecorObserver?.disconnect();
    const stats = summary();
    const scroll = document.querySelector('.map-scroll');
    const path = document.createElement('div'); path.className='progress-path';
    const offsets=[0,52,80,52,0,-52,-80,-52];
    const welcomeRow=document.createElement('div');welcomeRow.className='progress-row welcome-row';
    const welcomeLabel=document.createElement('span');welcomeLabel.className='welcome-label';welcomeLabel.textContent='WELCOME';
    const welcome=document.createElement('a');welcome.className='welcome-step day-number';welcome.href='step-watch.html?step=0';welcome.textContent='00';
    welcome.setAttribute('aria-label','Step 00, Welcome to Mirror 21, watch');welcome.setAttribute('aria-haspopup','dialog');welcome.setAttribute('aria-expanded','false');welcome.setAttribute('aria-controls','map-day-card');
    welcome.addEventListener('click',event=>{event.preventDefault();showDayCard(welcome,welcomeRow,scroll,0);});
    // START sits on 00 until Welcome is done (watched to the end, or left with its MY PATH button),
    // unless Step 01 has already been started.
    const welcomeDone=read('mirror21-watched-0')==='true'||read('mirror21-seen-0')==='true';
    const startOnWelcome=!welcomeDone&&stats.today===1&&!state.steps[1];
    welcomeRow.append(welcomeLabel);
    if(startOnWelcome){
      const bubble=document.createElement('span');bubble.className='progress-bubble active-bubble';bubble.textContent='START';
      welcomeRow.append(bubble);welcomeRow.classList.add('has-start');
    }
    welcomeRow.append(welcome);path.append(welcomeRow);
    for(let d=1;d<=21;d++) {
      if(d===1||d===8||d===15) { const divider=document.createElement('div'); divider.className='week-divider'; divider.textContent='WEEK '+Math.ceil(d/7);path.append(divider); }
      // Committed = HOLD TO COMMIT done, check-in still to come (plain white). The check-in at the start of the
      // next step then shows full (yes), half (partly) or ring-only (no) gold. Done steps open again from
      // Watch to rewatch and redo; that never changes their check-in or the step that is open now.
      const answer=state.answers[d],committed=state.lessons[d]&&!answer,done=Boolean(state.lessons[d]),current=d===stats.today && stats.active;
      const row=document.createElement('div'); row.className='progress-row'+(current?' current':'');row.dataset.day=String(d);row.style.transform='translateX('+offsets[(d-1)%8]+'px)';
      const session = model.session(state,d);
      if(current&&!startOnWelcome) { const bubble=document.createElement('span');bubble.className='progress-bubble active-bubble';bubble.textContent=session.label;row.append(bubble); }
      const step=document.createElement(current||done?'a':'button');step.className='progress-step '+(answer||'')+(committed?' committed':'')+(current?' current':'');
      step.textContent=pad(d);step.setAttribute('aria-label','Step '+d+', '+MirrorSteps.title(d)+', '+(answer?labels[answer]+', open to redo':committed?'committed, open to redo':current?'today, '+session.label.toLowerCase():'locked'));
      if(done) step.href='step-watch.html?step='+d;
      else if(current) step.href=MirrorSteps.page(d,session.screen)+'?step='+d;
      else { step.type='button'; step.addEventListener('click',()=> { step.title='Opens after Step '+(d-1);step.setAttribute('aria-label',step.title);const note=document.createElement('span');note.className='progress-bubble';note.textContent=step.title;row.querySelector('.progress-bubble')?.remove();row.prepend(note); }); }
      if(current||done) {
        step.setAttribute('aria-haspopup','dialog');
        step.setAttribute('aria-expanded','false');
        step.setAttribute('aria-controls','map-day-card');
        step.addEventListener('click',event=> {
          event.preventDefault();
          showDayCard(step,row,scroll,d);
        });
      }
      if(current) {
        const frame=document.createElement('div');frame.className='progress-ring-frame';
        const ns='http://www.w3.org/2000/svg';
        const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 112 112');svg.setAttribute('aria-hidden','true');svg.classList.add('progress-ring');
        const circumference=2*Math.PI*52;
        for(const filled of [false,true]) {
          const circle=document.createElementNS(ns,'circle');
          for(const [name,value] of Object.entries({cx:56,cy:56,r:52,fill:'none',stroke:filled?'#e0b84c':'#ececea','stroke-width':6}))circle.setAttribute(name,String(value));
          if(filled) {circle.setAttribute('stroke-linecap','round');circle.setAttribute('stroke-dasharray',String(circumference));circle.setAttribute('stroke-dashoffset',String(circumference*(1-session.ratio)));circle.setAttribute('transform','rotate(-90 56 56)');if(!session.ratio)circle.style.opacity='0';}
          svg.append(circle);
        }
        frame.append(svg,step);row.append(frame);
      } else row.append(step);
      path.append(row);
    }
    scroll.replaceChildren(path);
    const ns='http://www.w3.org/2000/svg';
    const trail=document.createElementNS(ns,'svg');trail.classList.add('journey-trail');trail.setAttribute('aria-hidden','true');
    path.prepend(trail);
    const words=[['SEE IT',3],['OWN IT',10],['CHANGE IT',17]].map(([label,anchor])=> {
      const word=document.createElement('span');word.className='journey-word';
      word.setAttribute('aria-hidden','true');word.dataset.anchor=String(anchor);
      word.innerHTML=label.replace(' ',' <br>');
      path.append(word);return word;
    });
    const drawJourney=()=> {
      const bounds=path.getBoundingClientRect();
      if(!bounds.width||!bounds.height)return;
      trail.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
      trail.replaceChildren();
      const points=Array.from(path.querySelectorAll('.progress-row[data-day]'),row=> {
        const rect=row.querySelector('.progress-step').getBoundingClientRect();
        return {x:rect.left+rect.width/2-bounds.left,y:rect.top+rect.height/2-bounds.top};
      });
      for(let i=0;i<points.length-1;i++) {
        const a=points[i],b=points[i+1],connector=document.createElementNS(ns,'g');
        connector.setAttribute('class','journey-segment'+(i+1<stats.today?' reached':''));
        const dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy);
        const available=Math.max(0,distance-72),count=Math.max(1,Math.floor(available/17));
        const angle=Math.atan2(dy,dx)*180/Math.PI+90;
        for(let j=0;j<count;j++) {
          const side=j%2===0?-1:1,t=(36+(j+.5)*available/count)/distance;
          const x=a.x+dx*t-side*dy/distance*5,y=a.y+dy*t+side*dx/distance*5;
          const foot=document.createElementNS(ns,'g');
          foot.setAttribute('class','journey-footprint');
          foot.setAttribute('transform',`translate(${x} ${y}) rotate(${angle+side*14})`);
          const toe=document.createElementNS(ns,'ellipse');
          for(const [name,value] of Object.entries({cx:0,cy:-5.5,rx:4.5,ry:6.5}))toe.setAttribute(name,String(value));
          const heel=document.createElementNS(ns,'ellipse');
          for(const [name,value] of Object.entries({cx:-1,cy:6,rx:3,ry:3}))heel.setAttribute(name,String(value));
          foot.append(toe,heel);connector.append(foot);
        }
        trail.append(connector);
      }
      words.forEach(word=> {
        const point=points[Number(word.dataset.anchor)-1];
        word.style.top=(point.y-word.offsetHeight/2)+'px';
        word.style.removeProperty('--fit-scale');
        const text=document.createRange();text.selectNodeContents(word.firstChild);
        const width=text.getBoundingClientRect().width;
        word.style.setProperty('--fit-scale',String(Math.min(1,(bounds.width-32)/width)));
      });
    };
    mapDecorObserver=new ResizeObserver(drawJourney);
    mapDecorObserver.observe(path);
    document.fonts.ready.then(drawJourney);
    requestAnimationFrame(drawJourney);
    const header=document.querySelector('.app-frame > div[style*="top: 59px"] > div');
    const lines=header.querySelectorAll('p');
    lines[0].textContent='WEEK '+Math.ceil((stats.today||21)/7);
    lines[1].textContent=stats.complete?'21 STEPS COMPLETE':'STEP '+pad(stats.today||21)+' OF 21';
    lines[2].textContent=stepsToGo(stats);
    document.querySelector('[role="status"]')?.remove();
    // Open centred on today's step, or at the top while START sits on 00 Welcome.
    if(center) requestAnimationFrame(()=> { const current=path.querySelector('.current');if(startOnWelcome)scroll.scrollTop=0;else if(current)scroll.scrollTop=Math.max(0,current.offsetTop-scroll.clientHeight/2+88); });
  }
  function renderMirror() {
    const stats=summary(),container=document.querySelector('.mirror-scroll');
    container.querySelector(':scope > p')?.remove();
    const days=container.querySelector('[aria-label="Steps so far"]');
    days.classList.add('days-so-far');
    days.querySelector('div > p:last-child').textContent=stats.checkIns+' OF 21';
    // Dots match the check-in icons: full, half or ring-only gold; committed is plain white.
    const dotLook={yes:['#e0b84c','2px solid #e0b84c'],partly:['linear-gradient(90deg,#e0b84c 50%,#ffffff 50%)','2px solid #e0b84c'],no:['#ffffff','2px solid #e0b84c']};
    days.querySelectorAll('span[title]').forEach((dot,i)=> { const d=i+1,answer=state.answers[d],committed=state.lessons[d]&&!answer;const [background,border]=answer?dotLook[answer]:committed?['#ffffff','1px solid #c9c9c5']:d===stats.today?['#ffffff','2px solid #111111']:['#e4e4e0','0'];dot.style.background=background;dot.style.border=border;dot.title='Step '+d+(answer?': '+labels[answer]:committed?': committed, not checked in yet':d===stats.today?': today':''); });
    const rings=container.querySelectorAll('[aria-label="Where I stand"] svg');
    // Follow-through \u00b7 check-ins \u00b7 steps to go (the ring fills as steps are committed).
    [[stats.checkIns?stats.points/stats.checkIns:0,stats.percent+'%','Follow-through so far, '+stats.percent+' percent'],[stats.checkIns/21,pad(stats.checkIns),stats.checkIns+' of 21 check-ins'],[stats.committed/21,String(stats.stepsToGo),stepsToGo(stats)]].forEach(([ratio,value,aria],i)=> { rings[i].querySelector('text').textContent=value;rings[i].setAttribute('aria-label',aria);rings[i].querySelectorAll('circle')[1].setAttribute('stroke-dashoffset',(314.16*(1-ratio)).toFixed(2)); });
    // The current week and its theme, e.g. WEEK 1 \u00b7 SEE IT.
    const week=container.querySelector('[aria-label="Where I stand"] > div:last-child');
    week.children[0].textContent='WEEK '+stats.week;week.children[1].textContent=weekThemes[stats.week-1];
    week.setAttribute('aria-label','Week '+stats.week+', '+weekThemes[stats.week-1].toLowerCase());
  }
  // Demo only: a small gear at the top right resets this device's steps.
  function addResetGear() {
    const gear=document.createElement('button');gear.type='button';gear.className='demo-reset';gear.setAttribute('aria-label','Reset all steps (demo)');
    gear.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>';
    gear.addEventListener('click',()=> {
      if(!confirm('Reset all steps? This clears your answers on this device.'))return;
      const matches=key=>key==='mirror21-progress'||/^mirror21-(audio|bar|watched|seen)-\d+$/.test(key)||/^mirror21-scroll-\d+-\d+$/.test(key);
      for(const storage of [localStorage,sessionStorage]) {
        try { Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(matches).forEach(key=>storage.removeItem(key)); } catch {}
      }
      location.href=currentMap;
    });
    document.querySelector('.app-frame').append(gear);
  }
  // My Journey: every committed step in the user's own words, read-only, then today's step.
  function renderJourney() {
    const stats=summary(),list=document.querySelector('#journey'),scroll=document.querySelector('.journey-scroll');
    const committedSteps=Array.from({length:21},(_,i)=>i+1).filter(d=>state.lessons[d]);
    const today=stats.today&&stats.active?stats.today:null;
    const shown=today?[...committedSteps,today]:committedSteps;
    const weeks=['SEE IT','OWN IT','CHANGE IT'];
    const results={yes:'kept',partly:'partly kept',no:'not kept'};
    const lock='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" role="img" aria-label="Locked"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
    const chevron='<svg class="entry-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
    const dateOf=d=>{
      const at=state.steps[d]?.committedAt;if(!at)return '';
      const when=new Date(at);
      return when.toLocaleDateString('en-GB',{weekday:'short'}).toUpperCase()+' '+when.getDate()+' '+when.toLocaleDateString('en-GB',{month:'short'}).toUpperCase();
    };
    // Only the step's own answers, full sentences, as Act wrote them.
    const answersOf=d=>{
      const r=state.responses[d]||{};
      const rows=MirrorSteps.lesson(d)===2
        ? [['ACTION',r.ACTION?.trim()?'Today I will '+r.ACTION.trim():''],['PROOF','Yes, I could prove it.']]
        : [['HERE',r.HERE],['THERE',r.THERE],['TEST','Yes, that’s what I actually want.'],['STEP',r.STEP]];
      return rows.filter(([,text])=>text&&text.trim());
    };
    const latestGraded=committedSteps.filter(d=>state.answers[d]).pop();
    list.replaceChildren();
    let week=0,openEntry=null;
    shown.forEach((d,i)=>{
      if(Math.ceil(d/7)!==week){
        week=Math.ceil(d/7);
        const divider=el('div','journey-week'),name=el('span','journey-week-label','WEEK '+week+' ');
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
    const left=21-committedSteps.length;
    document.querySelector('#journeyFooter').textContent=left===0?'All 21 steps written.':left===1?'1 more step to write.':left+' more steps to write.';
    // Open on the latest graded step.
    if(openEntry)requestAnimationFrame(()=>{scroll.scrollTop=Math.max(0,scroll.scrollTop+openEntry.getBoundingClientRect().top-scroll.getBoundingClientRect().top-24);});
  }
  if(maps.includes(filename))renderMap(true);
  if(filename==='18-my-mirror.html')renderMirror();
  if(filename==='19-my-journey.html')renderJourney();
  if(maps.includes(filename)||filename==='18-my-mirror.html'||filename==='19-my-journey.html')addResetGear();
  document.querySelectorAll('nav a').forEach(link=> { if(link.textContent.includes('MY PATH'))link.href=currentMap; });
  const close=document.querySelector('a[aria-label="Close and go back to the map"]');if(close)close.href=currentMap;
  function carried(href) {
    const url=new URL(href,location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    fragment.delete('progress');
    url.hash = fragment.toString();
    return url.href;
  }
  document.addEventListener('click',event=> {
    const link=event.target.closest('a[href]');if(!link||event.defaultPrevented)return;
    const url=new URL(link.href,location.href);if(!pages.has(pageFilename(url.pathname)))return;
    save();link.href=carried(link.href);
  });
  window.addEventListener('pageshow',event=> { if(event.persisted)location.reload(); });
  window.addEventListener('storage', event => {
    if(event.key === 'mirror21-progress') location.reload();
  });
  document.documentElement?.setAttribute('data-mirror-ready', 'true');
  document.querySelectorAll('a[href="#reminder"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      let dialog = document.querySelector('#reminder');
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'reminder';
        dialog.setAttribute('aria-labelledby', 'reminder-title');
        dialog.innerHTML = '<form method="dialog"><h2 id="reminder-title">Daily reminder</h2><label for="reminder-time">Your preferred time</label><input id="reminder-time" type="time" required value="09:00"><p>This preview remembers your time for this session. Notifications are not sent.</p><button value="cancel" formnovalidate>Cancel</button> <button value="save">Save</button></form>';
        dialog.querySelector('input').value = read('mirror21-reminder') || '09:00';
        dialog.addEventListener('close', () => {
          if (dialog.returnValue === 'save') write('mirror21-reminder', dialog.querySelector('input').value);
        });
        document.querySelector('.app-frame').append(dialog);
      }
      dialog.showModal();
    });
  });
})();
