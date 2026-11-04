/* The app shell for My Path, My Mirror and My Journey (and the Offer): the saved course, links that survive
   Netlify's clean URLs, the tabs, and leaving a page. Each page loads its screens (assets/screens/) first: they
   register in MirrorScreens and run here, in the order loaded, with the shared app below. */
MirrorStore.ready(() => {
  // Netlify Pretty URLs remove .html from paths and exported anchor hrefs.
  function pageFilename(pathname) {
    const segment = pathname.split('/').filter(Boolean).pop() || '';
    return segment && !segment.includes('.') ? segment+'.html' : segment;
  }
  // This page's own name, however it was opened (tests/netlify-routing.test.js checks it for every page).
  const filename = pageFilename(location.pathname);
  const maps = ['04-map-start.html'];
  const stepPages = ['step-checkin.html','step-watch.html','step-learn.html','step-act.html','step02-learn.html','step02-act.html','step03-learn.html','step03-act.html','step04-learn.html','step04-act.html','step05-learn.html','step05-act.html','step06-learn.html','step06-act.html'];
  const pages = new Set(['01-offer.html','02-sign-in.html','18-my-mirror.html','19-my-journey.html','final-check.html','result.html', ...maps, ...stepPages]);
  // Restore known internal links before attaching handlers that match exported hrefs.
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    const url = new URL(href, location.href);
    const name = pageFilename(url.pathname);
    if (url.origin !== location.origin || !pages.has(name)) return;
    link.setAttribute('href', name + url.search + url.hash);
  });
  const model = MirrorProgress, store = MirrorStore;
  // Progress belongs to this browser. Shared links must never import another device's attempt.
  const state = store.course.load();
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.has('progress')) {
    fragment.delete('progress');
    history.replaceState(null, '', location.pathname + location.search + (fragment.size ? '#'+fragment : ''));
  }
  const save = () => store.course.save(state);
  const summary = () => model.stats(state);
  const pad = day => String(day).padStart(2,'0');
  const labels = {yes:'Yes, I did it',partly:'Partly',no:'No'};
  const weekThemes = ['SEE IT','OWN IT','CHANGE IT'];
  const stepsToGo = stats => stats.stepsToGo === 0 ? 'All 21 steps done' : stats.stepsToGo === 1 ? '1 step to go' : stats.stepsToGo+' steps to go';
  const currentMap = '04-map-start.html';
  if(!store.course.exists()) save();
  const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  // What every screen is given.
  const app = { model, store, state, save, summary, pad, labels, weekThemes, stepsToGo, currentMap, pageFilename, el };
  for (const screen of Object.values(globalThis.MirrorScreens || {})) screen(app);
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
  store.course.onChange(() => location.reload());
  document.documentElement?.setAttribute('data-mirror-ready', 'true');
});
