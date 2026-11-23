/* preview.html's phones. Each phone runs the real app with its own pretend saved data, handed over in the frame's name
   ("mirror21-preview:" + JSON: local, session, screen, act). Here it stands in for the browser's storage, and is kept
   in the frame's name, so it follows the phone from page to page while you tap around. Nothing reaches this browser's
   real storage, and no two phones share anything.
   - act: what to tap once the page is ready, on its first page only (["click .settings-gear",
     "clickText .settings-row|Help"]).
   - screen: a Sign in screen to show straight away (codeScreen, noPurchase), read by assets/screens/sign-in.js.
   Only on a computer (the folder or a local server), never on mirror21.app. Every page loads this file first
   (tools/build.js adds it), so it is in place before anything reads storage. Elsewhere it does nothing. */
(function (root) {
  const TAG = 'mirror21-preview:';
  let data;
  try {
    if (!root.name.startsWith(TAG) || !/^(file:|https?:\/\/(localhost|127\.0\.0\.1)[:/])/.test(root.location.href)) return;
    data = JSON.parse(root.name.slice(TAG.length));
  } catch { return; }
  const keep = () => { root.name = TAG + JSON.stringify(data); };
  function storage(kind) {
    const values = data[kind] ||= {};
    return {
      get length() { return Object.keys(values).length; },
      key: i => Object.keys(values)[i] ?? null,
      getItem: key => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null,
      setItem: (key, value) => { values[key] = String(value); keep(); },
      removeItem: key => { delete values[key]; keep(); },
      clear: () => { Object.keys(values).forEach(key => delete values[key]); keep(); }
    };
  }
  for (const [kind, name] of [['local', 'localStorage'], ['session', 'sessionStorage']]) Object.defineProperty(root, name, { value: storage(kind), configurable: true });
  root.MirrorPreview = { screen: data.screen || null };
  document.documentElement.dataset.preview = 'true';

  // The first page's taps, once it is ready; then forgotten, so they don't repeat on the next page.
  const act = data.act || [];
  delete data.act; delete data.screen; keep();
  if (!act.length) return;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  root.addEventListener('load', async () => {
    for (let i = 0; i < 100 && document.documentElement.dataset.mirrorReady !== 'true'; i++) await wait(50);
    await wait(400);
    for (const step of act) {
      const verb = step.slice(0, step.indexOf(' ')), [selector, text] = step.slice(step.indexOf(' ') + 1).split('|');
      if (verb === 'click') document.querySelector(selector)?.click();
      if (verb === 'clickText') Array.from(document.querySelectorAll(selector)).find(node => node.textContent.includes(text))?.click();
      await wait(450);
    }
  });
})(window);
