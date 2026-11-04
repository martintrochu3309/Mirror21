// User-invoked restart: clear only this browser's Mirror 21 attempt, bar and watch positions, and which
// block summaries have been opened.
(() => {
  if (MirrorStore.course.clear()) location.replace('step-watch.html?step=0');
  else document.querySelector('#restart-status').textContent='Your browser could not clear the saved session. Allow site storage and open this link again.';
})();
