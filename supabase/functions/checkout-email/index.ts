// After paying, Stripe sends the buyer to /signin?session_id=cs_…; the sign-in page asks this function for the
// email they paid with, to fill in the email field. GET ?session_id=cs_… → { email }.
//
// It also records the buyer (../_shared/buyers.ts), in case Stripe's webhook hasn't arrived yet: by the time the
// buyer taps Send my code, their account exists.
// Only a paid session gives an email; anything else is 404. Uses STRIPE_SECRET_KEY (Checkout Sessions: Read).

import { adminClient, buyerEmail, isPaid, logger, recordBuyer, reply, stripeClient } from '../_shared/buyers.ts';

const logs = logger('checkout-email');
const { fail } = logs;
// The sign-in page may be opened from mirror21.app or from a copy on a computer: any origin may ask.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return reply(405, { message: 'Method not allowed' }, cors);

  const sessionId = new URL(req.url).searchParams.get('session_id') ?? '';
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return reply(400, { message: 'No session_id' }, cors);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    fail('missing secret: STRIPE_SECRET_KEY');
    return reply(500, { message: 'Server not configured' }, cors);
  }
  const stripe = stripeClient(stripeKey);

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    fail(`could not read session ${sessionId}: ${(err as Error).message}`);
    return reply(404, { message: 'Unknown session' }, cors);
  }

  const email = buyerEmail(session);
  if (!isPaid(session) || !email) return reply(404, { message: 'Not paid' }, cors);

  // The email is given back even if recording fails: the webhook (retried by Stripe) records the buyer too.
  await recordBuyer(stripe, adminClient(), session, email, `session ${session.id} (after payment)`, logs);
  return reply(200, { email }, cors);
});
