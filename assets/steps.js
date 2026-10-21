// The 21 step titles, plus each step's Watch content and where its lesson comes from.
// Steps 01–06 have their own lessons; Steps 07–18 reuse Step 01's as placeholders,
// and Steps 19–21 stay unavailable until content arrives. Steps 01–06 have their portrait videos so far.
(function (root) {
  const titles = [
    'Welcome to Mirror 21',
    // Block 1 · Make the Move
    'Know Where You Are Going', 'Make It Something You Do', 'Pick One Move', 'Focus on What You Control',
    'Pause Before You React', 'Change Your Surroundings', 'Link It to Your Day',
    // Block 2 · Make It Stick
    'Spot Your Old Habit', 'Break the Habit', 'Know Why It Matters', 'Tell Someone',
    'Set a Minimum', 'Plan for Hard Days', 'Raise the Bar',
    // Block 3 · Make It Yours
    'Know How to Restart', 'Look Back', 'Own Your Part', 'Keep, Stop, Start',
    'Put It All Together', 'Use It on Something New', 'See What Changed'
  ];
  // Watch screen, per step: portrait video, start image (its first frame), finish image (its last frame,
  // so nothing jumps when it ends; empty = start image, dimmed), length shown before the video loads,
  // and the button label. An empty video shows "VIDEO COMING SOON" with simulated playback.
  // Steps not listed here use the defaults.
  // A filmed step: Audio-Video/StepNN-Watch.mp4, with its first and last frames as stepNN-start/-finish.jpg.
  const filmed = (step, duration) => {
    const nn = String(step).padStart(2, '0');
    return { video: '../Audio-Video/Step' + nn + '-Watch.mp4', image: '../assets/images/step' + nn + '-start.jpg', finish: '../assets/images/step' + nn + '-finish.jpg', duration };
  };
  const watch = {
    0: { duration: '0:37', next: 'MY PATH' },
    1: filmed(1, '1:45'), 2: filmed(2, '1:18'), 3: filmed(3, '1:18'),
    4: filmed(4, '1:25'), 5: filmed(5, '1:38'), 6: filmed(6, '1:13')
  };
  const defaults = { video: '', image: '../assets/images/step01-start.jpg', finish: '', duration: '', next: 'LEARN' };
  const available = step => Number.isInteger(step) && step >= 0 && step <= 18;
  // Lesson (Learn + Act) this step shows: Steps 02–06 have their own; Steps 01 and 07–18 use Step 01's.
  const lesson = step => step >= 2 && step <= 6 ? step : available(step) && step > 0 ? 1 : null;
  // Page for a screen of a step: Check in and Watch are shared, Learn and Act follow the lesson.
  const page = (step, screen) => (screen === 'learn' || screen === 'act') && lesson(step) > 1 ? 'step0' + lesson(step) + '-' + screen + '.html' : 'step-' + screen + '.html';
  const api = {
    titles, available, lesson, page,
    title: step => titles[step] || '',
    // Screen headline: caps with a closing full stop, as in the handoff.
    headline: step => titles[step] ? titles[step].toUpperCase() + '.' : '',
    media: step => available(step) ? { ...defaults, ...watch[step] } : null,
    pad: step => String(step).padStart(2, '0')
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MirrorSteps = api;
})(globalThis);
