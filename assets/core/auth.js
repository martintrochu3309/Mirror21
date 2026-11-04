/* Who may open the course: someone signed in on this device. Only buyers have an account (the stripe-webhook Edge
   Function makes one when they pay); Sign in (02-sign-in.html, assets/screens/sign-in.js) emails them a 6-digit code.
   - Every page but the first page, Sign in and the Offer loads this file first in its head (tools/build.js adds it): with no one
     signed in, it sends them to Sign in, which brings them back here afterwards (?next=).
   - It only reads the sign-in supabase-js saved on this device, so it works offline and needs no library. Being
     signed in lasts until Sign out (Settings › Account).
   - Loaded with data-gate="off" (the first page, Sign in, index.html), it only gives the settings below.
   The Supabase URL and publishable key are meant to be public; the secret keys live only in Supabase secrets. */
(function (root) {
  const config = {
    url: 'https://xcabmwcfvzgavhsjsmxu.supabase.co',
    key: 'sb_publishable_cnebBpuPfYBtYScwpwvZww_jV4lNGkE',
    // Where supabase-js keeps the sign-in. Not "mirror21-…", so Start over and Delete my data never sign anyone out.
    storageKey: 'sb-mirror21-auth',
    paymentLink: 'https://buy.stripe.com/test_14A9AT4EIanw91b5cK8EM01',
    // The first page (MIRROR 21, BUY MIRROR 21): where the app opens for anyone not signed in.
    start: '00-start.html',
    signIn: '02-sign-in.html',
    home: '04-map-start.html'
  };

  function signedIn() {
    try { return Boolean(JSON.parse(localStorage.getItem(config.storageKey))?.refresh_token); } catch { return false; }
  }
  // Only a page of the app (no other site, no path): anything else gives My Path.
  const safeNext = next => typeof next === 'string' && /^[\w-]+\.html(?:[?#]\S*)?$/.test(next) ? next : config.home;
  // This page as a ?next= value. Netlify serves pages without ".html".
  function here(where) {
    let page = where.pathname.split('/').pop() || config.home;
    if (!/\.html$/.test(page)) page += '.html';
    return page + where.search + where.hash;
  }
  function gate() {
    if (signedIn()) return true;
    root.location.replace(config.signIn + '?next=' + encodeURIComponent(here(root.location)));
    return false;
  }

  const api = { ...config, signedIn, safeNext, here, gate };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.MirrorAuth = api;
  if (document.currentScript?.dataset.gate !== 'off') gate();
})(globalThis);
