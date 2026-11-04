/* Sign in (02-sign-in.html): email → a 6-digit code emailed by Supabase → the page asked for (?next=), else My Path.
   - Only buyers have an account (the stripe-webhook Edge Function makes one when they pay), so a code is only ever
     asked for (shouldCreateUser: false). An email with no account gets "We couldn't find a purchase" and BUY MIRROR 21.
   - After paying, Stripe sends buyers to /signin?session_id=cs_…: the checkout-email Edge Function gives back the
     email they paid with, filled in so they only tap SEND MY CODE.
   - ?signout (Settings › Account › Sign out) signs this device out first. Someone already signed in goes straight on.
   Needs auth.js (data-gate="off") and the supabase-js library loaded first. */
(() => {
  const auth = MirrorAuth;
  const params = new URLSearchParams(location.search);
  const next = auth.safeNext(params.get('next'));
  const $ = id => document.getElementById(id);
  // Supabase lets a new code be sent once a minute; a code lasts an hour.
  const COOLDOWN = 60, LIFETIME = 60 * 60 * 1000;
  let client = null, email = '', sentAt = 0, timer = null, busy = false;
  const supabase = () => client ||= globalThis.supabase.createClient(auth.url, auth.key, {
    auth: { storageKey: auth.storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  function show(id) {
    for (const screen of ['emailScreen', 'codeScreen', 'noPurchase']) $(screen).hidden = screen !== id;
    document.documentElement.dataset.screen = id;
  }
  function say(id, text, info = false) {
    const line = $(id);
    line.hidden = !text;
    line.textContent = text || '';
    line.classList.toggle('is-info', info);
  }
  // What went wrong, in words, from Supabase's error.
  function problem(error) {
    const code = error.code || '', status = error.status || 0;
    if (code === 'otp_disabled' || /signups not allowed/i.test(error.message)) return 'no-account';
    if (status === 429 || /rate_limit/.test(code)) return 'Too many codes asked for. Wait a minute, then try again.';
    if (code === 'email_address_invalid' || code === 'validation_failed') return 'Check your email address and try again.';
    if (!status || error.name === 'AuthRetryableFetchError') return 'We couldn’t reach Mirror 21. Check your connection and try again.';
    console.error('Sign in:', error);
    return 'Something went wrong. Try again in a minute.';
  }

  async function sendCode() {
    const { error } = await supabase().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (!error) { sentAt = Date.now(); startCooldown(); }
    return error ? problem(error) : null;
  }

  // 1 · Email
  $('emailScreen').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const typed = $('email').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed)) { say('emailMessage', 'Enter the email you used to buy Mirror 21.'); $('email').focus(); return; }
    busy = true; $('send').disabled = true; $('send').textContent = 'SENDING…'; say('emailMessage', '');
    email = typed;
    const result = await sendCode();
    busy = false; $('send').disabled = false; $('send').textContent = 'SEND MY CODE';
    if (result === 'no-account') { $('unknownEmail').textContent = email; show('noPurchase'); return; }
    if (result) { say('emailMessage', result); return; }
    openCode();
  });

  // 2 · The code
  const input = $('codeInput'), digits = Array.from(document.querySelectorAll('.digit'));
  function draw() {
    const value = input.value;
    digits.forEach((box, i) => {
      box.textContent = value[i] || '';
      box.classList.toggle('is-active', i === Math.min(value.length, 5));
    });
  }
  function openCode() {
    $('sentTo').textContent = email;
    input.value = ''; draw(); say('codeMessage', '');
    $('code').classList.remove('is-wrong');
    show('codeScreen');
    input.focus();
  }
  // Keep the caret at the end, so the boxes fill left to right.
  input.addEventListener('select', () => { const end = input.value.length; if (input.selectionStart !== end) input.setSelectionRange(end, end); });
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 6);
    $('code').classList.remove('is-wrong');
    if (input.value.length) say('codeMessage', '');
    draw();
    if (input.value.length === 6) verify(input.value);
  });
  async function verify(token) {
    if (busy) return;
    busy = true; input.readOnly = true; $('code').classList.add('is-busy');
    const { error } = await supabase().auth.verifyOtp({ email, token, type: 'email' });
    if (!error) { location.replace(next); return; }
    busy = false; input.readOnly = false; $('code').classList.remove('is-busy');
    const failed = problem(error);
    // Supabase answers the same for a wrong code and an old one: a code over an hour old has expired.
    const wrong = error.code === 'otp_expired' || error.status === 403;
    say('codeMessage', !wrong ? failed : Date.now() - sentAt > LIFETIME
      ? 'This code has expired. Tap Resend code for a new one.'
      : 'That code isn’t right. Check it and try again.');
    $('code').classList.toggle('is-wrong', wrong);
    input.value = ''; draw(); input.focus();
  }

  function startCooldown() {
    clearInterval(timer);
    const ends = Date.now() + COOLDOWN * 1000, button = $('resend');
    const tick = () => {
      const left = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
      button.disabled = left > 0;
      button.textContent = left > 0 ? 'Resend code in ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') : 'Resend code';
      if (!left) clearInterval(timer);
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  $('resend').addEventListener('click', async () => {
    if (busy) return;
    busy = true; $('resend').disabled = true;
    const result = await sendCode();
    busy = false;
    if (result === 'no-account') { $('unknownEmail').textContent = email; show('noPurchase'); return; }
    if (result) { say('codeMessage', result); $('resend').disabled = false; return; }
    input.value = ''; draw(); $('code').classList.remove('is-wrong');
    say('codeMessage', 'We sent a new code to ' + email + '.', true);
    input.focus();
  });

  // Wrong email? Change it: back to the email, as typed.
  document.querySelectorAll('[data-change-email]').forEach(button => button.addEventListener('click', () => {
    clearInterval(timer);
    show('emailScreen');
    say('emailMessage', '');
    $('email').focus();
    $('email').select();
  }));

  // 3 · No purchase
  $('buy').href = auth.paymentLink;

  // Arriving
  show('emailScreen');
  if (params.has('signout')) {
    // Signs out this device only. Offline, the sign-in saved here is still forgotten.
    supabase().auth.signOut({ scope: 'local' }).catch(() => {}).finally(() => { try { localStorage.removeItem(auth.storageKey); } catch {} });
    params.delete('signout');
    try { history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); } catch {}
  } else if (auth.signedIn()) {
    location.replace(next);
    return;
  }
  const sessionId = params.get('session_id');
  if (sessionId && /^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    fetch(auth.url + '/functions/v1/checkout-email?session_id=' + encodeURIComponent(sessionId))
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data?.email && !$('email').value) { $('email').value = data.email; $('send').focus(); } })
      .catch(() => {});
  }
  document.documentElement.dataset.mirrorReady = 'true';
})();
