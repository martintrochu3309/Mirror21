// User-invoked restart: clear only this browser's Mirror 21 attempt, bar and watch positions.
(() => {
  const matches = key => key === 'mirror21-progress' || /^mirror21-(audio|bar|watched|seen)-\d+$/.test(key) || /^mirror21-scroll-\d+-\d+$/.test(key);
  try {
    for (const storage of [localStorage, sessionStorage]) {
      const keys = Array.from({length:storage.length},(_,i)=>storage.key(i));
      keys.filter(matches).forEach(key=>storage.removeItem(key));
    }
    location.replace('step-watch.html?step=0');
  } catch {
    document.querySelector('#restart-status').textContent='Your browser could not clear the saved session. Allow site storage and open this link again.';
  }
})();
