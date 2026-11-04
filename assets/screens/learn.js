/* Learn: the moves, the pull quote and the example. Run by the step shell. */
(globalThis.MirrorScreens ||= {}).learn = ({ steps, step, committed, record, save, refreshBar, href, showEarlier }) => {
  document.getElementById('next').href = href('act');
  // Step 02: your own THERE from the step before, read-only.
  if (steps.lesson(step) === 2) showEarlier();
  if (committed) return;
  // The Learn third fills as the reader scrolls towards YOUR TURN.
  let queued = false;
  const measure = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const seen = max <= 0 ? 1 : Math.min(1, scrollY / max);
    if (seen > record.learn + 0.02 || (seen === 1 && record.learn < 1)) { record.learn = seen; save(); refreshBar(); }
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(measure); } }, { passive: true });
  measure();
};
