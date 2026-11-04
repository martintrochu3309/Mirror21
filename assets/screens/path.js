/* My Path (html/04-map-start.html): the steps as a trail, today's step with its card, the block tiles and the
   header card. Run by the app shell. */
(globalThis.MirrorScreens ||= {}).path = app => {
  const { model, store, state, summary, pad, labels, stepsToGo, pageFilename } = app;
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
      // Step 21, once committed, has no next step: its card leads to the final check, then to the result.
      const finale = dayNumber === 21 && done ? (state.finishedAt ? 'YOUR RESULT' : 'FINAL CHECK') : null;
      setActionLabel(start, finale || (done ? 'REDO STEP' : continuing ? 'CONTINUE' : 'START STEP'));
      start.setAttribute('aria-label', finale ? (state.finishedAt ? 'Your result' : 'Final check on Step 21') : (done ? 'Redo' : continuing ? 'Continue' : 'Start')+' Step '+dayNumber+': '+title.textContent);
      start.addEventListener('click', event => {
        if (pageFilename(new URL(start.href).pathname) !== 'step-watch.html') return;
        event.preventDefault();
        expandIntoWatch(card, start.href, dayNumber);
      });
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
    const pointer = bounds.left + bounds.width / 2 - viewport.left - 16;
    card.style.setProperty('--pointer-left', Math.max(24, Math.min(scroll.clientWidth - 56, pointer))+'px');
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    // Step 21 is the last on the path, with nothing below it: its card opens above, pointing down.
    if (dayNumber === 21) {
      card.classList.add('is-above');
      card.style.top = (bounds.top - viewport.top + scroll.scrollTop - 20 - card.offsetHeight)+'px';
      const availableTop = scroll.scrollTop + 16;
      if (card.offsetTop < availableTop) scroll.scrollTo({ top: scroll.scrollTop - (availableTop - card.offsetTop), behavior });
    } else {
      // Include the tile's bottom lip when attaching the pointer below it.
      card.style.top = (bounds.bottom - viewport.top + scroll.scrollTop + 20)+'px';
      const bottom = card.offsetTop + card.offsetHeight;
      const availableBottom = scroll.scrollTop + scroll.clientHeight - 116;
      if (bottom > availableBottom) scroll.scrollTo({ top: scroll.scrollTop + bottom - availableBottom, behavior });
    }
    (card.querySelector('a') || step).focus({ preventScroll: true });
  }
  // Into Watch, the black step card grows to fill the screen (0.35s), then Watch continues from that
  // black with its arrival sequence. The note tells Watch it was opened from here.
  let leaving = false;
  function expandIntoWatch(card, href, dayNumber) {
    if (leaving) return;
    leaving = true;
    store.device.setArrival(String(dayNumber));
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { location.href = href; return; }
    const box = card.getBoundingClientRect();
    const cover = card.cloneNode(true);
    cover.removeAttribute('id'); cover.removeAttribute('role'); cover.removeAttribute('aria-labelledby');
    cover.setAttribute('aria-hidden', 'true');
    cover.classList.add('day-card-cover');
    document.body.append(cover);
    const at = (left, top, width, height) => ({ left: left+'px', top: top+'px', width: width+'px', height: height+'px' });
    cover.animate([
      { ...at(box.left, box.top, box.width, box.height), borderRadius: '14px', backgroundColor: '#111111' },
      { ...at(0, 0, innerWidth, innerHeight), borderRadius: '0px', backgroundColor: '#000000' }
    ], { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    Array.from(cover.children).forEach(child => child.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }));
    setTimeout(() => { location.href = href; }, 350);
  }
  // Coming back to the map with the browser's Back button shows it as it was.
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    leaving = false;
    document.querySelectorAll('.day-card-cover').forEach(cover => cover.remove());
  });
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
    const welcomeDone=store.device.welcomeWatched()||store.device.welcomeSeen();
    const startOnWelcome=!welcomeDone&&stats.today===1&&!state.steps[1];
    welcomeRow.append(welcomeLabel);
    if(startOnWelcome){
      const bubble=document.createElement('span');bubble.className='progress-bubble active-bubble';bubble.textContent='START';
      welcomeRow.append(bubble);welcomeRow.classList.add('has-start');
    }
    welcomeRow.append(welcome);path.append(welcomeRow);
    for(let d=1;d<=21;d++) {
      if(d===1||d===8||d===15) { const divider=document.createElement('div'); divider.className='week-divider'; divider.textContent='BLOCK '+Math.ceil(d/7);path.append(divider); }
      // Committed = HOLD TO COMMIT done, check-in still to come (plain white). The check-in at the start of the
      // next step then shows full (yes), half (partly) or ring-only (no) gold. Done steps open again from
      // Watch to rewatch and redo; that never changes their check-in or the step that is open now.
      const answer=state.answers[d],committed=state.lessons[d]&&!answer,done=Boolean(state.lessons[d]),current=d===stats.today && stats.active;
      const row=document.createElement('div'); row.className='progress-row'+(current?' current':'');row.dataset.day=String(d);row.style.transform='translateX('+offsets[(d-1)%8]+'px)';
      const session = model.session(state,d);
      if(current&&!startOnWelcome) { const bubble=document.createElement('span');bubble.className='progress-bubble active-bubble';bubble.textContent=session.label;row.append(bubble); }
      const step=document.createElement(current||done?'a':'button');step.className='progress-step '+(answer||'')+(committed?' committed':'')+(current?' current':'');
      step.textContent=pad(d);step.setAttribute('aria-label','Step '+d+', '+MirrorSteps.title(d)+', '+(answer?labels[answer]+', open to redo':committed?'committed, open to redo':current?'today, '+session.label.toLowerCase():'locked'));
      // Step 21 committed: the final check, then the result (with a bubble, since no step is open any more).
      if(d===21&&done) { step.href=state.finishedAt?'result.html':'final-check.html'; const bubble=document.createElement('span');bubble.className='progress-bubble active-bubble';bubble.textContent=state.finishedAt?'RESULT':'CHECK IN';row.append(bubble); }
      else if(done) step.href='step-watch.html?step='+d;
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
    // Block tiles: one beside each block's last step (07, 14, 21), on the right, the size of a step tile, with a
    // check mark. Grey and locked until that step is committed (and the block has its summary), then black
    // until its summary has been opened once, then white with a gold check.
    const check='<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    const blockSpots=[1,2,3].map(n=> {
      // Block 3 ends the course: its summary opens once the final check is done.
      const info=MirrorSteps.block(n),open=info.ready&&Boolean(state.lessons[info.last])&&(n<3||Boolean(state.finishedAt)),seen=store.device.blockSeen(n);
      const spot=document.createElement('div');spot.className='block-spot'+(open?' open':'');spot.dataset.after=String(info.last);
      const label=document.createElement('span');label.className='block-label';label.textContent='BLOCK '+n;
      const tile=document.createElement(open?'a':'button');tile.className='progress-step block-tile'+(open?(seen?' committed':' block-new'):'');tile.innerHTML=check;
      tile.setAttribute('aria-label','Block '+n+', '+info.name.toLowerCase()+', '+(open?'summary':'locked'));
      if(open) tile.href='block.html?block='+n;
      else { tile.type='button'; tile.addEventListener('click',()=> { const note=document.createElement('span');note.className='progress-bubble block-note';note.textContent='Opens after Step '+pad(info.last);spot.querySelector('.block-note')?.remove();spot.prepend(note);tile.setAttribute('aria-label',note.textContent); }); }
      spot.append(label,tile);path.append(spot);return spot;
    });
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
      // Footprints from one tile to the next, gold once reached.
      const walk=(a,b,reached)=> {
        const connector=document.createElementNS(ns,'g');
        connector.setAttribute('class','journey-segment'+(reached?' reached':''));
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
      };
      for(let i=0;i<points.length-1;i++) walk(points[i],points[i+1],i+1<stats.today);
      // Each block tile sits 110px right of the centre line, level with its last step, joined to it by footprints.
      blockSpots.forEach(spot=> {
        const from=points[Number(spot.dataset.after)-1],to={x:bounds.width/2+110,y:from.y};
        spot.style.left=to.x+'px';spot.style.top=to.y+'px';
        walk(from,to,spot.classList.contains('open'));
      });
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
    lines[0].textContent='BLOCK '+Math.ceil((stats.today||21)/7);
    lines[1].textContent=stats.complete?'21 STEPS COMPLETE':'STEP '+pad(stats.today||21)+' OF 21';
    lines[2].textContent=stepsToGo(stats);
    document.querySelector('[role="status"]')?.remove();
    // Open centred on today's step, or at the top while START sits on 00 Welcome.
    if(center) requestAnimationFrame(()=> { const current=path.querySelector('.current');if(startOnWelcome)scroll.scrollTop=0;else if(current)scroll.scrollTop=Math.max(0,current.offsetTop-scroll.clientHeight/2+88); });
  }
  renderMap(true);
};
