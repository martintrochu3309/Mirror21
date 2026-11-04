/* Watch: Start → Mid (playing / paused) → Finish, from the Watch screen handoff.
   Learn appears at Finish once 90% of the video is reached. The timeline can be dragged freely either way,
   so dragging past 90% counts as watched (for now).
   Run by the step shell. */
(globalThis.MirrorScreens ||= {}).watch = ({ model, steps, store, state, stats, step, welcome, committed, record, save, refreshBar, label, pad, map, href, reduceMotion, arrival, showEarlier }) => {
  const screen = document.getElementById('watch');
  const player = document.getElementById('player');
  const still = document.getElementById('still');
  const line = document.getElementById('line');
  const hint = document.getElementById('hint');
  const next = document.getElementById('next');
  const media = steps.media(step);
  // Without a video, playback is simulated for this long and shows VIDEO COMING SOON.
  const DEMO_SECONDS = 8;
  const fake = !media.video;
  const sep = '  ·  ';
  const clock = seconds => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
  const [mins, secs] = media.duration.split(':').map(Number);
  // Length shown before the file loads; the file's own length replaces it.
  let total = mins * 60 + secs || 0;
  let watched = welcome ? store.device.welcomeWatched() : committed || record.watched;
  // Where playback stands, as a share of the video; an unfinished first watch resumes from here.
  let at = watched || welcome ? 0 : record.watch;
  let current, immerse, raf, t0 = 0, lastSaved = 0, savedWatch = at, arriving = false;

  label.textContent = 'STEP ' + pad(step) + ' OF 21';
  document.getElementById('stepTitle').textContent = steps.headline(step);
  document.getElementById('nextLabel').textContent = media.next;
  if (fake) screen.classList.add('placeholder'); else player.src = media.video;
  screen.style.setProperty('--cover', media.cover + '%');
  // Load the finish image (the video's last frame) now, so the end fades straight into it.
  if (media.finish) new Image().src = media.finish;

  function set(mode) {
    current = screen.dataset.state = mode;
    clearTimeout(immerse); screen.classList.remove('immersed');
    // Title, meta line and step bar fade out after 2 seconds of playback.
    if (mode === 'playing') immerse = setTimeout(() => screen.classList.add('immersed'), 2000);
    const src = mode === 'finish' && media.finish ? media.finish : media.image;
    if (still.getAttribute('src') !== src) still.src = src;
  }
  function showHint() {
    const resume = at > 0 && !watched;
    hint.classList.toggle('is-resume', resume);
    document.getElementById('hintText').textContent = resume ? 'RESUME' + (total ? sep + clock(at * total) : '')
      : 'BEST WITH SOUND' + (total ? sep + clock(total) : '');
  }
  // Saves how far the first watch got, only when it moved since the last save.
  function keep() {
    if (welcome || committed || watched || record.watch === savedWatch) return;
    savedWatch = record.watch; lastSaved = Date.now(); save();
  }
  function markWatched() {
    watched = true; screen.classList.add('is-watched');
    if (welcome) store.device.markWelcomeWatched();
    else if (!committed) { record.watched = true; record.watch = 1; save(); }
  }
  const scrub = document.getElementById('scrub'), knob = document.getElementById('knob');
  function showTimes() {
    document.getElementById('scrubAt').textContent = clock(at * total);
    document.getElementById('scrubTotal').textContent = total ? clock(total) : '';
    scrub.setAttribute('aria-valuenow', String(Math.round(at * 100)));
    scrub.setAttribute('aria-valuetext', clock(at * total) + (total ? ' of ' + clock(total) : ''));
  }
  function progress(p) {
    at = p; line.style.width = p * 100 + '%'; knob.style.left = p * 100 + '%';
    showTimes();
    if (watched) return;
    if (p >= 0.9) markWatched();
    else if (!welcome && !committed && p > record.watch) {
      record.watch = p;
      if (Date.now() - lastSaved > 1000) keep();
    }
  }
  // The end: Finish once watched (the Watch part of the bar fills), otherwise back to paused.
  function finish() {
    at = 0;
    if (!watched) { set('paused'); return; }
    set('finish'); refreshBar();
  }

  function play() {
    if (current === 'finish') { progress(0); if (!fake) player.currentTime = 0; }
    set('playing');
    if (fake) {
      t0 = performance.now() - at * DEMO_SECONDS * 1000;
      const tick = now => {
        const p = Math.min((now - t0) / 1000 / DEMO_SECONDS, 1); progress(p);
        if (p < 1) raf = requestAnimationFrame(tick); else finish();
      };
      raf = requestAnimationFrame(tick);
    } else player.play().catch(() => set(at ? 'paused' : 'start'));
  }
  function pause() {
    if (fake) cancelAnimationFrame(raf); else player.pause();
    set('paused'); keep();
  }

  // Dragging the timeline: playback holds while the finger is down (the picture follows it), then carries
  // on from there if it was playing. Arrow keys move 5 seconds.
  let dragging = false, wasPlaying = false;
  function seek(p) {
    p = Math.min(Math.max(p, 0), 1);
    progress(p);
    if (!fake && player.duration) player.currentTime = p * player.duration;
  }
  const pointAt = event => { const r = line.parentElement.getBoundingClientRect(); return (event.clientX - r.left) / r.width; };
  scrub.addEventListener('pointerdown', event => {
    if (current !== 'playing' && current !== 'paused') return;
    event.preventDefault();
    dragging = true; wasPlaying = current === 'playing';
    scrub.setPointerCapture(event.pointerId);
    screen.classList.add('scrubbing'); clearTimeout(immerse);
    if (fake) cancelAnimationFrame(raf); else player.pause();
    seek(pointAt(event));
  });
  scrub.addEventListener('pointermove', event => { if (dragging) seek(pointAt(event)); });
  const release = () => {
    if (!dragging) return;
    dragging = false; screen.classList.remove('scrubbing');
    if (at >= 1) { finish(); return; }
    if (wasPlaying) play(); else keep();
  };
  scrub.addEventListener('pointerup', release);
  scrub.addEventListener('pointercancel', release);
  scrub.addEventListener('keydown', event => {
    const jump = event.key === 'ArrowRight' ? 5 : event.key === 'ArrowLeft' ? -5 : 0;
    if (!jump || !total) return;
    event.preventDefault(); seek(at + jump / total);
  });

  player.addEventListener('loadedmetadata', () => {
    if (!Number.isFinite(player.duration)) return;
    total = player.duration;
    if (at) player.currentTime = at * player.duration;
    showHint(); showTimes();
  });
  player.addEventListener('timeupdate', () => { if (current === 'playing' && !dragging && player.duration) progress(player.currentTime / player.duration); });
  player.addEventListener('ended', () => { if (dragging) return; progress(1); finish(); });
  // Paused by the phone (a call, headphones unplugged, leaving the app): show the paused state.
  player.addEventListener('pause', () => { if (current === 'playing' && !player.ended && !dragging) { set('paused'); keep(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && fake && current === 'playing') pause(); });
  addEventListener('pagehide', keep);

  // Nothing but the X can be tapped until the arrival sequence has shown the controls.
  screen.addEventListener('click', event => {
    if (arriving && !event.target.closest('.close')) { event.preventDefault(); event.stopPropagation(); }
  }, true);
  // Tap anywhere to play / pause; Finish only reacts to its buttons. Swiping does nothing; the timeline drags.
  screen.addEventListener('click', event => {
    if (event.target.closest('.close, .end, .scrub')) return;
    if (current === 'playing') pause(); else if (current !== 'finish') play();
  });
  document.getElementById('again').addEventListener('click', play);

  if (welcome) {
    next.href = map;
    // Leaving Welcome with its button counts as done: the map's START moves on to Step 01.
    next.addEventListener('click', () => store.device.markWelcomeSeen());
  }
  else next.href = href('learn');
  // Dark to white: a quick fade into the next screen rather than a hard cut.
  next.addEventListener('click', event => {
    if (reduceMotion()) return;
    event.preventDefault(); screen.classList.add('is-leaving');
    setTimeout(() => { location.href = next.href; }, 250);
  });

  // A step already watched (or left after 90%) opens at Finish, with its button ready.
  progress(at);
  if (watched) screen.classList.add('is-watched');
  set(watched ? 'finish' : 'start');
  showHint();
  arrive();

  // From the map: on black, the title (0.2s), then Kevin once his image has loaded (0.6s), then the
  // controls (0.2s). From the check-in: on white, Kevin first (0.5s), then the title and controls
  // together (0.2s); Safari's bar turns black once he covers the white. With reduce motion, one 0.3s
  // fade. Only when the map's card or the check-in opened this screen.
  function arrive() {
    const root = document.documentElement;
    const light = arrival === 'light:' + step;
    const tint = color => document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
    if (!light && arrival !== String(step)) { root.classList.remove('intro', 'intro-light'); tint('#000000'); return; }
    arriving = true;
    const done = () => { arriving = false; tint('#000000'); root.classList.remove('intro', 'intro-light', 'show-text', 'show-image', 'show-controls'); };
    if (reduceMotion()) {
      root.classList.remove('intro');
      screen.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' }).finished.then(done, done);
      return;
    }
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    root.classList.add('intro');
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      if (light) {
        await still.decode().catch(() => {});
        root.classList.add('show-image');
        await pause(500);
        tint('#000000');
        root.classList.add('show-text', 'show-controls');
        await pause(200);
        done();
        return;
      }
      root.classList.add('show-text');
      await Promise.all([pause(200), still.decode().catch(() => {})]);
      root.classList.add('show-image');
      await pause(600);
      root.classList.add('show-controls');
      await pause(200);
      done();
    }));
  }
};
