// The 21 step titles, plus where each step's video and lesson come from.
// Step 01 and Step 02 have their own lessons; Steps 03–18 reuse Step 01's as placeholders,
// and Steps 19–21 stay unavailable until content arrives. Every step uses Step 01's video for now.
(function (root) {
  const titles = [
    'Welcome to Mirror 21',
    // Block 1 · Make the Move
    'Know Where You’re Going', 'Make It Something You Do', 'Pick One Move', 'Focus on What You Control',
    'Pause Before You React', 'Change Your Surroundings', 'Link It to Your Day',
    // Block 2 · Make It Stick
    'Spot Your Old Habit', 'Break the Habit', 'Know Why It Matters', 'Tell Someone',
    'Set a Minimum', 'Plan for Hard Days', 'Raise the Bar',
    // Block 3 · Make It Yours
    'Know How to Restart', 'Look Back', 'Own Your Part', 'Keep, Stop, Start',
    'Put It All Together', 'Use It on Something New', 'See What Changed'
  ];
  const media = {
    0: { video: '../Audio-Video/Step00-Mirror21.mp4', poster: '../assets/images/step00-poster.jpg' },
    1: { video: '../Audio-Video/Step01-Mirror21.mp4', poster: '../assets/images/step01-poster.jpg' }
  };
  const available = step => Number.isInteger(step) && step >= 0 && step <= 18;
  // Step whose video this step currently shows.
  const source = step => step === 0 ? 0 : available(step) ? 1 : null;
  // Lesson (Learn + Act) this step shows: Step 02 has its own; Steps 01 and 03–18 use Step 01's.
  const lesson = step => step === 2 ? 2 : available(step) && step > 0 ? 1 : null;
  // Page for a screen of a step: Check in and Watch are shared, Learn and Act follow the lesson.
  const page = (step, screen) => (screen === 'learn' || screen === 'act') && lesson(step) === 2 ? 'step02-' + screen + '.html' : 'step-' + screen + '.html';
  const api = {
    titles, available, source, lesson, page,
    title: step => titles[step] || '',
    // Screen headline: caps with a closing full stop, as in the handoff.
    headline: step => titles[step] ? titles[step].toUpperCase() + '.' : '',
    media: step => media[source(step)] || null,
    pad: step => String(step).padStart(2, '0')
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MirrorSteps = api;
})(globalThis);
