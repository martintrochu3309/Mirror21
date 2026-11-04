/* Everything Mirror 21 saves goes through here: no screen reads or writes localStorage or sessionStorage itself.
   Two kinds of data, kept apart because they will live in different places:
   - The course (account data): progress, finished runs and the reminder time. Supabase will hold these, so the
     learner keeps them on any phone. Today they are saved in this browser.
   - This device only: where the step bar stood, whether the Welcome was watched or left, which block summaries
     were opened, and one-time notes passed between pages (sessionStorage).
   ready(fn) runs a screen once its saved data is available: straight away today; once accounts exist, after the
   account's course has loaded. Needs MirrorProgress (progress.js) loaded first. */
(function (root) {
  const PREFIX = 'mirror21-';
  const COURSE = PREFIX + 'progress', RUNS = PREFIX + 'runs', REMINDER = PREFIX + 'reminder';
  // A browser can refuse storage (private mode, blocked site data): reads then give nothing, writes do nothing.
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const parse = key => { try { return JSON.parse(read(key)); } catch { return undefined; } };
  // Removes the matching keys from both storages; false when a browser refused.
  function forget(matches) {
    let ok = true;
    for (const name of ['localStorage', 'sessionStorage']) {
      try {
        const storage = root[name];
        Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(matches).forEach(key => storage.removeItem(key));
      } catch { ok = false; }
    }
    return ok;
  }
  // The course and what goes with it on this device: bar and video positions, which Welcome and block summaries
  // were seen. Settings (the reminder) and finished runs stay.
  const courseKeys = key => key === COURSE || key === PREFIX + 'unlock' || /^mirror21-(audio|bar|watched|seen|block)-\d+$/.test(key) || /^mirror21-scroll-\d+-\d+$/.test(key);

  const course = {
    // The saved course, made safe to use (a fresh one when nothing valid is saved).
    load: () => root.MirrorProgress.normalize(parse(COURSE)),
    // Whether a valid course is saved at all (My Path saves a fresh one otherwise, which starts its clock).
    exists: () => { const raw = parse(COURSE); return Boolean(raw) && raw.version === 1; },
    save: state => { state.updatedAt = Date.now(); write(COURSE, JSON.stringify(state)); },
    // Another tab saved the course: fn runs (My Path, My Mirror and My Journey reload).
    onChange: fn => root.addEventListener('storage', event => { if (event.key === COURSE) fn(); }),
    // Finished runs, oldest first ({ endedAt, progress }), kept by START A NEW RUN.
    runs: () => { const runs = parse(RUNS); return Array.isArray(runs) ? runs : []; },
    saveRuns: runs => write(RUNS, JSON.stringify(runs)),
    reminder: () => read(REMINDER),
    saveReminder: time => write(REMINDER, time),
    // Start over (and a new run): clears the course on this device; settings and finished runs stay.
    clear: () => forget(courseKeys)
  };

  const device = {
    // Where the step bar stood on the last screen of a step, so the next one animates on from there.
    barPosition: step => parse(PREFIX + 'bar-' + step),
    saveBarPosition: (step, values) => write(PREFIX + 'bar-' + step, JSON.stringify(values)),
    // The Welcome video: watched to the end, or left with its MY PATH button.
    welcomeWatched: () => read(PREFIX + 'watched-0') === 'true',
    markWelcomeWatched: () => write(PREFIX + 'watched-0', 'true'),
    welcomeSeen: () => read(PREFIX + 'seen-0') === 'true',
    markWelcomeSeen: () => write(PREFIX + 'seen-0', 'true'),
    // A block summary opened once: its map tile turns from black to white.
    blockSeen: n => read(PREFIX + 'block-' + n) === 'true',
    markBlockSeen: n => write(PREFIX + 'block-' + n, 'true'),
    // A step just committed ('4'), or 'finish' after the final check, still to be shown opening on My Path. Kept
    // until My Path has shown it, even if the app is closed first.
    setUnlock: what => write(PREFIX + 'unlock', String(what)),
    takeUnlock: () => { const value = read(PREFIX + 'unlock'); try { localStorage.removeItem(PREFIX + 'unlock'); } catch {} return value; },
    // One-time note from My Path or the check-in telling Watch how to arrive (read in step-watch.html's head too).
    setArrival: value => { try { sessionStorage.setItem(PREFIX + 'intro', value); } catch {} },
    takeArrival: () => { let value = null; try { value = sessionStorage.getItem(PREFIX + 'intro'); sessionStorage.removeItem(PREFIX + 'intro'); } catch {} return value; }
  };

  const api = {
    course, device,
    ready: fn => fn(),
    // Delete my data: everything Mirror 21 saved in this browser, settings included.
    deleteAll: () => forget(key => key.startsWith(PREFIX))
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MirrorStore = api;
})(globalThis);
