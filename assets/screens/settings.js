/* Settings (the gear on My Path, My Mirror and My Journey) and the daily reminder (also the bell on My Path).
   Run by the app shell after the page's own screen.
   Settings: Account, Daily reminder and Help, then Start over; Privacy, Terms and the version at the foot.
   Account and Help open in Settings' place with a back arrow; the reminder and Start over are bottom sheets. */
(globalThis.MirrorScreens ||= {}).settings = app => {
  const { store, state, pad, currentMap, el } = app;
  const { committedSteps, dateOf, answersOf, results } = MirrorJournal(state);
  const frame = () => document.querySelector('.app-frame');
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svg = (path, size = 14, width = 2) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  const icons = {
    chevron: '<path d="M9 6l6 6-6 6"/>', back: '<path d="M15 6l-6 6 6 6"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    save: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
  };
  // A row of a card: a button when it does something, with an optional value before its chevron.
  const row = ({ title, sub, value, icon, action }) => {
    const line = el(action ? 'button' : 'div', 'settings-row');
    if (action) { line.type = 'button'; line.addEventListener('click', action); }
    if (icon) line.insertAdjacentHTML('beforeend', svg(icons[icon], 18, 1.8));
    const text = el('span', 'settings-text'); text.append(el('span', 'settings-title', title));
    if (sub) text.append(el('span', 'settings-sub', sub));
    line.append(text);
    if (value) line.append(el('span', 'settings-value', value));
    if (action) line.insertAdjacentHTML('beforeend', svg(icons.chevron).replace('<svg', '<svg class="settings-chev"'));
    const item = el('li'); item.append(line); return item;
  };
  const card = rows => { const list = el('ul', 'settings-group'); rows.filter(Boolean).forEach(item => list.append(row(item))); return list; };
  const button = (kind, label, action, arrow) => {
    const b = el('button', 'settings-btn settings-btn--' + kind, label); b.type = 'button';
    if (arrow) b.insertAdjacentHTML('beforeend', svg(icons.arrow, 20));
    if (action) b.addEventListener('click', action);
    return b;
  };

  // The small gear at the top right opens Settings.
  function addSettingsGear() {
    const gear=document.createElement('button');gear.type='button';gear.className='settings-gear';gear.setAttribute('aria-label','Settings');gear.setAttribute('aria-haspopup','dialog');
    gear.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>';
    gear.addEventListener('click',()=>openSettings(gear));
    frame().append(gear);
  }

  // Settings: one screen at a time inside it (the list, Help, Account). Escape goes back, then closes.
  let panel = null, page = null;
  function openSettings(gear) {
    if (panel) return;
    panel = el('section', 'settings');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'settings-title');
    const shut = () => {
      removeEventListener('keydown', onKey);
      const sheetOpen = panel; panel = null;
      const done = () => { sheetOpen.remove(); gear.focus(); };
      if (reduceMotion()) return done();
      sheetOpen.classList.add('is-closing'); sheetOpen.addEventListener('animationend', done, { once: true });
    };
    const onKey = event => { if (event.key !== 'Escape' || document.querySelector('.sheet-back')) return; if (page === 'list') shut(); else showList(); };
    addEventListener('keydown', onKey);
    function show(name, title, top, ...content) {
      page = name;
      const view = el('div', 'settings-page' + (name === 'list' ? '' : ' is-sub'));
      const heading = el('h2', null, title); heading.id = 'settings-title';
      view.append(top, heading, ...content);
      panel.replaceChildren(view);
      panel.scrollTop = 0;
      top.focus({ preventScroll: true });
    }
    const topButton = (kind, label, action) => {
      const b = el('button', 'settings-' + kind); b.type = 'button'; b.setAttribute('aria-label', label);
      b.innerHTML = svg(icons[kind], kind === 'close' ? 20 : 18, kind === 'close' ? 1.6 : 2);
      b.addEventListener('click', action); return b;
    };
    function showList() {
      const foot = el('div', 'settings-foot');
      const links = el('p', 'settings-links');
      links.append(el('span', null, 'Privacy'), el('span', 'settings-dot', '·'), el('span', null, 'Terms'));
      foot.append(links, el('p', 'settings-version', 'Mirror 21 by Daily Xcellence · v1.0'));
      show('list', 'SETTINGS', topButton('close', 'Close settings', shut),
        card([{ title: 'Account', action: showAccount }, { title: 'Daily reminder', value: reminderLabel(), action: () => openReminder(showList) }, { title: 'Help', action: showHelp }]),
        card([{ title: 'Start over', action: openStartOver }]), foot);
    }
    // Account: the finished runs' results, and signing out (back to Sign in; this phone keeps its course).
    function showAccount() {
      const runs = store.course.runs().length;
      show('account', 'ACCOUNT', topButton('back', 'Back to settings', showList), card([
        runs ? { title: 'My past results', sub: runs === 1 ? 'Your finished run' : 'Your ' + runs + ' finished runs', action: () => { location.href = 'result.html?run=' + runs; } }
          : { title: 'My past results', sub: 'None yet' },
        { title: 'Sign out', action: () => { location.href = '02-sign-in.html?signout'; } }
      ]));
    }
    // Help: one question open at a time. Write to us and the email wait for a support address.
    function showHelp() {
      const list = el('ul', 'settings-group');
      const items = HELP.map(([question, answer], i) => {
        const item = el('li', 'help-item'), q = el('button', 'help-q'), a = el('p', 'help-a', answer);
        q.type = 'button'; q.id = 'help-q-' + i; a.id = 'help-a-' + i;
        q.setAttribute('aria-controls', a.id); a.setAttribute('role', 'region'); a.setAttribute('aria-labelledby', q.id);
        q.append(el('span', null, question));
        item.append(q, a); list.append(item);
        return { q, a };
      });
      const open = n => items.forEach(({ q, a }, i) => {
        q.setAttribute('aria-expanded', String(i === n)); a.hidden = i !== n;
        q.querySelector('svg')?.remove(); q.insertAdjacentHTML('beforeend', svg(i === n ? icons.minus : icons.plus, 16));
      });
      let current = 0;
      items.forEach(({ q }, i) => q.addEventListener('click', () => { current = current === i ? -1 : i; open(current); }));
      open(current);
      const foot = el('div', 'help-foot');
      const email = el('p', 'help-email'); email.append(el('span', null, '[support email]'));
      const copy = el('button'); copy.type = 'button'; copy.setAttribute('aria-label', 'Copy the support email'); copy.innerHTML = svg(icons.copy, 14, 1.8);
      email.append(copy);
      foot.append(button('gold', 'WRITE TO US', null, true), el('p', 'help-note', 'We usually reply within a day'), email);
      show('help', 'HELP', topButton('back', 'Back to settings', showList), list, foot);
    }
    frame().append(panel);
    showList();
  }

  // Questions and answers in Help (drafts to approve).
  const HELP = [
    ['How do steps unlock?', 'The next step opens as soon as you commit to this one. Take it when it suits you. Nothing expires.'],
    ['I missed a day. What now?', 'Nothing is lost. Open My Path and carry on where you left off. If a promise is waiting, the step starts by asking how it went: answer honestly, then keep going.'],
    ['My reminder isn’t showing up', 'Check that your daily reminder is on in Settings, and that your phone allows notifications from Mirror 21.'],
    ['How do I add it to my home screen?', 'On iPhone, open Mirror 21 in Safari, tap Share, then Add to Home Screen. On Android, open it in Chrome, tap the menu, then Add to Home screen.'],
    ['Can I use it on another phone?', 'Yes. Sign in with the same email or phone number, and your steps and journal come with you.'],
    ['How do refunds work?', '[Refund policy to come.]']
  ];

  // A bottom sheet over the page: tap outside, Escape or Cancel to close. Returns its close function.
  function openSheet(title, build) {
    const back = el('div', 'sheet-back'), sheet = el('section', 'sheet');
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'sheet-title');
    const heading = el('h2', null, title); heading.id = 'sheet-title';
    const returnTo = document.activeElement;
    let closing = false;
    const close = () => {
      if (closing) return; closing = true;
      removeEventListener('keydown', onKey, true);
      let gone = false;
      const done = () => { if (gone) return; gone = true; back.remove(); returnTo?.focus?.({ preventScroll: true }); };
      if (reduceMotion()) return done();
      back.classList.add('is-closing'); back.addEventListener('animationend', event => { if (event.target === back) done(); });
      // Gone by the end of the fade even if the browser never says it ended.
      setTimeout(done, 260);
    };
    const onKey = event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
    addEventListener('keydown', onKey, true);
    back.addEventListener('click', event => { if (event.target === back) close(); });
    sheet.append(el('span', 'sheet-grip'), heading, ...build(close));
    back.append(sheet); frame().append(back);
    (sheet.querySelector('.wheel-col, button') || sheet).focus({ preventScroll: true });
    return close;
  }

  // Daily reminder: a time, every 15 minutes, or off. Only remembered for now: nothing is sent yet.
  const HOURS = Array.from({ length: 24 }, (_, h) => pad(h)), MINUTES = ['00', '15', '30', '45'];
  const savedReminder = () => store.course.reminder() || '09:00';
  const reminderLabel = () => { const time = savedReminder(); return time === 'off' ? 'Off' : Number(time.slice(0, 2)) + ':' + time.slice(3, 5); };
  function openReminder(after) {
    const saved = savedReminder() === 'off' ? '09:00' : savedReminder();
    const hourAt = Math.max(0, HOURS.indexOf(saved.slice(0, 2))), minuteAt = Math.floor(Number(saved.slice(3, 5)) / 15) || 0;
    openSheet('DAILY REMINDER', close => {
      const wheel = el('div', 'wheel');
      const hours = column(HOURS, hourAt, 'Hour'), minutes = column(MINUTES, minuteAt, 'Minutes');
      wheel.append(hours.node, el('span', 'wheel-colon', ':'), minutes.node);
      const done = time => { store.course.saveReminder(time); close(); after?.(); };
      const off = el('button', 'sheet-link', 'Turn reminders off'); off.type = 'button'; off.addEventListener('click', () => done('off'));
      return [el('p', 'sheet-text', 'When should your next step nudge you?'), wheel, button('gold', 'SAVE', () => done(HOURS[hours.value()] + ':' + MINUTES[minutes.value()])), off];
    });
  }
  // One wheel of the reminder: the values repeat so it turns round; it settles back into the middle copy.
  function column(values, start, label) {
    const ROW = 40, COPIES = 7, middle = Math.floor(COPIES / 2) * values.length;
    const node = el('div', 'wheel-col'); node.tabIndex = 0; node.setAttribute('role', 'listbox'); node.setAttribute('aria-label', label);
    node.append(el('div', 'wheel-pad'));
    const items = Array.from({ length: COPIES * values.length }, (_, i) => { const item = el('div', 'wheel-item', values[i % values.length]); node.append(item); return item; });
    node.append(el('div', 'wheel-pad'));
    let at = middle + start, timer;
    const mark = () => {
      const i = Math.round(node.scrollTop / ROW);
      items.forEach((item, n) => { item.classList.toggle('is-on', n === i); item.setAttribute('aria-selected', String(n === i)); });
      at = i;
    };
    const settle = () => { const i = Math.round(node.scrollTop / ROW), back = middle + ((i % values.length) + values.length) % values.length; if (i !== back) node.scrollTop = back * ROW; mark(); };
    node.addEventListener('scroll', () => { mark(); clearTimeout(timer); timer = setTimeout(settle, 140); }, { passive: true });
    node.addEventListener('keydown', event => {
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      if (!step) return; event.preventDefault();
      node.scrollTo({ top: (at + step) * ROW, behavior: reduceMotion() ? 'auto' : 'smooth' });
    });
    items.forEach((item, n) => item.addEventListener('click', () => node.scrollTo({ top: n * ROW, behavior: reduceMotion() ? 'auto' : 'smooth' })));
    requestAnimationFrame(() => { node.scrollTop = at * ROW; mark(); });
    return { node, value: () => ((at % values.length) + values.length) % values.length };
  }

  // Start over: offers the journal as a PDF first, then clears the course on this phone (settings and finished
  // runs stay) and opens My Path at Step 01.
  function openStartOver() {
    openSheet('START OVER?', close => [
      el('p', 'sheet-text', 'This clears your steps and journal on this phone. It can’t be undone.'),
      card([{ title: 'Save your journal as PDF first', icon: 'save', action: printJournal }]),
      button('ink', 'START OVER', () => { store.course.clear(); location.href = currentMap; }),
      button('plain', 'CANCEL', close)
    ]);
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
  // The bell on My Path opens the same reminder sheet.
  document.querySelectorAll('a[href="#reminder"]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); openReminder(); }));
};
