/* Settings (the gear on My Path, My Mirror and My Journey) and the daily reminder on My Path. Run by the app
   shell after the page's own screen. */
(globalThis.MirrorScreens ||= {}).settings = app => {
  const { store, state, pad, currentMap, el } = app;
  const { committedSteps, dateOf, answersOf, results } = MirrorJournal(state);
  // The small gear at the top right opens Settings.
  function addSettingsGear() {
    const gear=document.createElement('button');gear.type='button';gear.className='settings-gear';gear.setAttribute('aria-label','Settings');gear.setAttribute('aria-haspopup','dialog');
    gear.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>';
    gear.addEventListener('click',()=>openSettings(gear));
    document.querySelector('.app-frame').append(gear);
  }
  // Start over clears the course (steps, journal, bar and video positions) and keeps the settings;
  // Delete my data clears everything Mirror 21 saved in this browser. Both open My Path at Step 01.
  function startOver() {
    if(!confirm('Start over? This clears your steps and journal on this phone.'))return;
    store.course.clear();
    location.href=currentMap;
  }
  function deleteData() {
    if(!confirm('Delete your data? This removes your steps, journal and settings from this phone.'))return;
    store.deleteAll();
    location.href=currentMap;
  }
  // Finished runs kept by START A NEW RUN on the result page.
  const pastRuns=()=>store.course.runs().length;
  // Settings: a scrolling sheet over the page. Rows without an action are placeholders for parts still to build.
  function openSettings(gear) {
    if(document.querySelector('.settings'))return;
    const sections=[
      ['YOUR COURSE',[{title:'How Mirror 21 works',sub:'Replay the welcome with Kevin'},{title:'Save my journal as PDF',sub:'Every promise and answer, in one file',action:printJournal},
        // After a new run: the finished runs' results stay one tap away.
        pastRuns()&&{title:'My past results',sub:pastRuns()===1?'Your finished run':'Your '+pastRuns()+' finished runs',action:()=>{location.href='result.html?run='+pastRuns();}}]],
      ['HELP',[{title:'Questions and answers'},{title:'Contact us',sub:'We usually reply within a day'}]],
      ['ABOUT',[{title:'Daily Xcellence'},{title:'The Pocket Mirror',sub:'Free reflections from Kevin'},{title:'Privacy policy'},{title:'Terms and refund policy'}]],
      ['YOUR DATA',[{title:'Start over',sub:'Clears your steps and journal on this phone',action:startOver},{title:'Delete my data',sub:'Removes everything Mirror 21 saved on this phone',action:deleteData}]]
    ];
    const chevron='<svg class="settings-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
    const row=item=>{
      const line=el(item.action?'button':'div','settings-row');
      if(item.action){line.type='button';line.addEventListener('click',item.action);}
      const text=el('span','settings-text');text.append(el('span','settings-title',item.title));
      if(item.sub)text.append(el('span','settings-sub',item.sub));
      line.append(text);line.insertAdjacentHTML('beforeend',chevron);
      const li=el('li');li.append(line);return li;
    };
    const sheet=el('section','settings');
    sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','settings-title');
    const close=el('button','settings-close');close.type='button';close.setAttribute('aria-label','Close settings');
    close.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    const title=el('h2',null,'SETTINGS');title.id='settings-title';
    sheet.append(close,title);
    sections.forEach(([name,items])=>{
      const list=el('ul','settings-group');items.filter(Boolean).forEach(item=>list.append(row(item)));
      sheet.append(el('h3',null,name),list);
    });
    const shut=()=>{
      removeEventListener('keydown',onKey);
      const done=()=>{sheet.remove();gear.focus();};
      if(matchMedia('(prefers-reduced-motion: reduce)').matches)return done();
      sheet.classList.add('is-closing');sheet.addEventListener('animationend',done,{once:true});
    };
    const onKey=event=>{if(event.key==='Escape')shut();};
    close.addEventListener('click',shut);addEventListener('keydown',onKey);
    document.querySelector('.app-frame').append(sheet);
    close.focus({preventScroll:true});
  }
  // Save my journal as PDF: a print-only copy of every written step; the phone's print sheet saves it as a PDF.
  function printJournal() {
    document.querySelector('.journal-print')?.remove();
    const doc=el('article','journal-print');
    doc.append(el('p','journal-print-brand','MIRROR 21'),el('h1',null,'MY JOURNAL'),
      el('p','journal-print-date',new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})));
    const written=committedSteps();
    if(!written.length)doc.append(el('p','journal-print-empty','No steps written yet.'));
    written.forEach(d=>{
      const entry=el('section'),date=dateOf(d),answer=state.answers[d];
      entry.append(el('p','journal-print-meta','STEP '+pad(d)+(date?' · '+date:'')),el('h2',null,MirrorSteps.title(d)));
      const rows=answersOf(d);
      if(rows.length){const dl=el('dl');rows.forEach(([label,text])=>dl.append(el('dt',null,label),el('dd',null,text.trim())));entry.append(dl);}
      entry.append(el('p','journal-print-label','MY PROMISE'),el('p','journal-print-promise',state.dayChanges[d]||''));
      if(answer)entry.append(el('p','journal-print-result','Promise '+results[answer]+'.'));
      doc.append(entry);
    });
    document.body.append(doc);
    // The title names the saved file.
    const pageTitle=document.title;document.title='Mirror 21 Journal';
    addEventListener('afterprint',()=>{document.title=pageTitle;doc.remove();},{once:true});
    print();
  }
  addSettingsGear();
  document.querySelectorAll('a[href="#reminder"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      let dialog = document.querySelector('#reminder');
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'reminder';
        dialog.setAttribute('aria-labelledby', 'reminder-title');
        dialog.innerHTML = '<form method="dialog"><h2 id="reminder-title">Daily reminder</h2><label for="reminder-time">Your preferred time</label><input id="reminder-time" type="time" required value="09:00"><p>This preview remembers your time for this session. Notifications are not sent.</p><button value="cancel" formnovalidate>Cancel</button> <button value="save">Save</button></form>';
        dialog.querySelector('input').value = store.course.reminder() || '09:00';
        dialog.addEventListener('close', () => {
          if (dialog.returnValue === 'save') store.course.saveReminder(dialog.querySelector('input').value);
        });
        document.querySelector('.app-frame').append(dialog);
      }
      dialog.showModal();
    });
  });
};
