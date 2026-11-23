/* Everything Mirror 21 saves goes through here: no screen reads or writes localStorage or sessionStorage itself.
   Two kinds of data, kept apart:
   - The account's: the course (progress), finished runs, the reminder time, and a few flags (the Welcome watched
     or left, block summaries opened, block videos due or watched). Saved in this browser first, then copied to the
     account in Supabase (the courses table, through save_course), so the learner keeps them on any phone or computer.
   - This device only: where the step bar stood, the one-time note that a step just opened, and notes passed
     between pages (sessionStorage).
   The account copy: every change stamps mirror21-saved-at and is sent a moment later (straight away when the page
   is left). Whichever copy was saved last wins, here and in Supabase, so an older phone never overwrites a newer one.
   ready(fn) runs a screen once its saved data is there: never while auth.js is sending someone to Sign in (so
   nothing is saved first). On a device that has never held this account's course, it waits for the account's copy
   (a few seconds at most, then carries on with nothing); otherwise it runs straight away and checks the account in
   the background, reloading the page if another device saved since. Only on the live site (https): on a computer,
   in preview.html and in the tests, everything stays in the browser. Needs MirrorProgress (progress.js) loaded
   first, and auth.js for the account. */
(function (root) {
  const PREFIX = 'mirror21-';
  const COURSE = PREFIX + 'progress', RUNS = PREFIX + 'runs', REMINDER = PREFIX + 'reminder';
  // When the account's data on this device last changed (ms), and whose account it is (the Supabase user id).
  const SAVED_AT = PREFIX + 'saved-at', OWNER = PREFIX + 'owner';
  // The flags that follow the account: Welcome watched or left, block summaries opened, block videos due or watched.
  const FLAG = /^mirror21-(watched-0|seen-0|block-[123]|blockvideo|blockvideo-[123])$/;
  // A browser can refuse storage (private mode, blocked site data): reads then give nothing, writes do nothing.
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const remove = key => { try { localStorage.removeItem(key); } catch {} };
  const parse = key => { try { return JSON.parse(read(key)); } catch { return undefined; } };
  const localKeys = () => { try { return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)); } catch { return []; } };
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
  const courseKeys = key => key === COURSE || key === PREFIX + 'unlock' || key === PREFIX + 'blockvideo' || /^mirror21-(audio|bar|watched|seen|block|blockvideo)-\d+$/.test(key) || /^mirror21-scroll-\d+-\d+$/.test(key);

  // ---- The account copy, in Supabase ----
  const cloud = (() => {
    const auth = () => root.MirrorAuth;
    // Only on the live site: never on a computer (file:, localhost), so preview.html and the tests stay offline.
    const on = () => {
      try { return Boolean(auth()) && typeof root.fetch === 'function' && root.location.protocol === 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(root.location.hostname); }
      catch { return false; }
    };
    const session = () => { try { return JSON.parse(localStorage.getItem(auth().storageKey)); } catch { return null; } };
    const live = s => Boolean(s?.access_token) && (Number(s.expires_at) || 0) * 1000 > Date.now() + 60000;
    // The sign-in, renewed when its hour is nearly up (as supabase-js would), and saved back where it keeps it.
    async function signIn() {
      const s = session();
      if (!s?.refresh_token || live(s)) return s?.refresh_token ? s : null;
      const res = await root.fetch(auth().url + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { apikey: auth().key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!res.ok) return null;
      const fresh = await res.json();
      fresh.expires_at ||= Math.floor(Date.now() / 1000) + (Number(fresh.expires_in) || 3600);
      if (!session()?.refresh_token) return null; // signed out meanwhile
      const renewed = { ...s, ...fresh };
      try { localStorage.setItem(auth().storageKey, JSON.stringify(renewed)); } catch {}
      return renewed;
    }
    const headers = s => ({ apikey: auth().key, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' });
    // What the account keeps: the course (null after Start over), finished runs, the reminder, the flags.
    const snapshot = () => ({
      progress: parse(COURSE) ?? null,
      runs: Array.isArray(parse(RUNS)) ? parse(RUNS) : [],
      reminder: read(REMINDER),
      flags: Object.fromEntries(localKeys().filter(key => FLAG.test(key)).map(key => [key, read(key)]))
    });
    // The account's copy replaces this device's.
    function adopt(snap, savedAt) {
      if (snap?.progress) write(COURSE, JSON.stringify(snap.progress)); else remove(COURSE);
      write(RUNS, JSON.stringify(Array.isArray(snap?.runs) ? snap.runs : []));
      if (snap?.reminder) write(REMINDER, String(snap.reminder)); else remove(REMINDER);
      localKeys().filter(key => FLAG.test(key)).forEach(remove);
      Object.entries(snap?.flags || {}).forEach(([key, value]) => { if (FLAG.test(key)) write(key, String(value)); });
      write(SAVED_AT, String(savedAt));
    }
    // This device's last change: its stamp, or for a course saved before the account copy existed, the course's own time.
    const localTime = () => Number(read(SAVED_AT)) || Number(parse(COURSE)?.updatedAt) || 0;

    let timer = 0;
    // Send this device's copy. Leaving the page: straight away, with the sign-in as it is (no time to renew it).
    async function push(leaving = false) {
      clearTimeout(timer); timer = 0;
      try {
        const s = leaving ? session() : await signIn();
        if (!live(s)) return false;
        if (!read(SAVED_AT)) write(SAVED_AT, String(localTime() || Date.now()));
        const res = await root.fetch(auth().url + '/rest/v1/rpc/save_course', {
          method: 'POST', keepalive: leaving, headers: headers(s),
          body: JSON.stringify({ p_snapshot: snapshot(), p_saved_at: Number(read(SAVED_AT)) })
        });
        return res.ok;
      } catch { return false; }
    }
    // The account's copy: { snapshot, saved_at }, null when it has none yet, undefined when it can't be reached.
    async function pull() {
      try {
        const s = await signIn();
        if (!live(s) || !s.user?.id) return undefined;
        const res = await root.fetch(auth().url + '/rest/v1/courses?select=snapshot,saved_at&user_id=eq.' + encodeURIComponent(s.user.id), { headers: headers(s) });
        if (!res.ok) return undefined;
        const rows = await res.json();
        return Array.isArray(rows) && rows[0] ? rows[0] : null;
      } catch { return undefined; }
    }
    // Compare once per page: the newer copy wins. 'adopted' when the account's replaced this device's.
    async function sync() {
      const row = await pull();
      if (row === undefined) return 'offline';
      const here = localTime(), there = Number(row?.saved_at) || 0;
      if (row && there > here) { adopt(row.snapshot, there); return 'adopted'; }
      if (here > there) await push();
      return 'same';
    }
    let checking = null, reloading = false;
    function start(fn) {
      const uid = on() ? session()?.user?.id : null;
      if (!uid) { fn(); return; }
      // Someone else's course on this device (a shared phone): it goes before this account's loads.
      const owner = read(OWNER);
      if (owner !== uid) {
        if (owner) { forget(key => courseKeys(key) || FLAG.test(key) || key === RUNS || key === REMINDER || key === SAVED_AT); }
        write(OWNER, uid);
      }
      const fresh = !read(SAVED_AT) && !parse(COURSE);
      checking ||= Promise.race([sync(), new Promise(resolve => setTimeout(resolve, 6000, 'offline'))]);
      if (fresh) { checking.then(() => fn()); return; }
      fn();
      checking.then(result => { if (result === 'adopted' && !reloading) { reloading = true; root.location.reload(); } });
    }
    // Something of the account's changed on this device: stamp it, and send it a moment later.
    function changed() {
      write(SAVED_AT, String(Math.max(Date.now(), (Number(read(SAVED_AT)) || 0) + 1)));
      if (!on()) return;
      clearTimeout(timer);
      timer = setTimeout(push, 1500);
    }
    // Delete my data: the account's copy goes too.
    async function erase() {
      try {
        const s = await signIn();
        if (!on() || !live(s) || !s.user?.id) return false;
        const res = await root.fetch(auth().url + '/rest/v1/courses?user_id=eq.' + encodeURIComponent(s.user.id), { method: 'DELETE', headers: headers(s) });
        return res.ok;
      } catch { return false; }
    }
    const flush = () => { if (timer) push(true); };
    try {
      root.addEventListener('pagehide', flush);
      root.addEventListener('visibilitychange', () => { if (root.document?.visibilityState === 'hidden') flush(); });
      root.addEventListener('online', () => { if (on() && read(SAVED_AT)) push(); });
    } catch {}
    return { start, changed, erase, push, sync };
  })();
  const changed = cloud.changed;

  const course = {
    // The saved course, made safe to use (a fresh one when nothing valid is saved).
    load: () => root.MirrorProgress.normalize(parse(COURSE)),
    // Whether a valid course is saved at all (My Path saves a fresh one otherwise, which starts its clock).
    exists: () => { const raw = parse(COURSE); return Boolean(raw) && raw.version === 1; },
    save: state => { state.updatedAt = Date.now(); write(COURSE, JSON.stringify(state)); changed(); },
    // Another tab saved the course: fn runs (My Path, My Mirror and My Journey reload).
    onChange: fn => root.addEventListener('storage', event => { if (event.key === COURSE) fn(); }),
    // Finished runs, oldest first ({ endedAt, progress }), from before START A NEW RUN was taken out.
    runs: () => { const runs = parse(RUNS); return Array.isArray(runs) ? runs : []; },
    saveRuns: runs => { write(RUNS, JSON.stringify(runs)); changed(); },
    reminder: () => read(REMINDER),
    saveReminder: time => { write(REMINDER, time); changed(); },
    // Start over: clears the course on this device, and on the account; settings and finished runs stay.
    clear: () => { const ok = forget(courseKeys); changed(); return ok; }
  };

  const device = {
    // Where the step bar stood on the last screen of a step, so the next one animates on from there.
    barPosition: step => parse(PREFIX + 'bar-' + step),
    saveBarPosition: (step, values) => write(PREFIX + 'bar-' + step, JSON.stringify(values)),
    // The Welcome video: watched to the end, or left with its MY PATH button (follows the account).
    welcomeWatched: () => read(PREFIX + 'watched-0') === 'true',
    markWelcomeWatched: () => { write(PREFIX + 'watched-0', 'true'); changed(); },
    welcomeSeen: () => read(PREFIX + 'seen-0') === 'true',
    markWelcomeSeen: () => { write(PREFIX + 'seen-0', 'true'); changed(); },
    // A block summary opened once: its map tile turns from black to white (follows the account).
    blockSeen: n => read(PREFIX + 'block-' + n) === 'true',
    markBlockSeen: n => { write(PREFIX + 'block-' + n, 'true'); changed(); },
    // A step just committed ('4'), or 'finish' after the final check, still to be shown opening on My Path. Kept
    // until My Path has shown it, even if the app is closed first.
    setUnlock: what => write(PREFIX + 'unlock', String(what)),
    takeUnlock: () => { const value = read(PREFIX + 'unlock'); try { localStorage.removeItem(PREFIX + 'unlock'); } catch {} return value; },
    // A block's video, due straight after its last step is committed (1, 2 or 3), and watched to the end only once.
    // It stays due, even if the app is closed, until its MY PATH button is tapped: My Path sends it back first.
    // Follows the account.
    setBlockVideo: n => { write(PREFIX + 'blockvideo', String(n)); changed(); },
    blockVideo: () => Number(read(PREFIX + 'blockvideo')) || 0,
    blockVideoSeen: n => read(PREFIX + 'blockvideo-' + n) === 'true',
    markBlockVideoSeen: n => { write(PREFIX + 'blockvideo-' + n, 'true'); remove(PREFIX + 'blockvideo'); changed(); },
    // One-time note from My Path or the check-in telling Watch how to arrive (read in step-watch.html's head too).
    setArrival: value => { try { sessionStorage.setItem(PREFIX + 'intro', value); } catch {} },
    takeArrival: () => { let value = null; try { value = sessionStorage.getItem(PREFIX + 'intro'); sessionStorage.removeItem(PREFIX + 'intro'); } catch {} return value; }
  };

  const api = {
    course, device,
    ready: fn => { if (!root.MirrorAuth || root.MirrorAuth.signedIn()) cloud.start(fn); },
    // Delete my data: everything Mirror 21 saved in this browser, settings included, and the account's copy.
    deleteAll: () => { cloud.erase(); return forget(key => key.startsWith(PREFIX)); },
    cloud
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MirrorStore = api;
})(globalThis);
