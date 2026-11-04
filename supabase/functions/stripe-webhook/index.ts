// Records Mirror 21 buyers when Stripe reports a completed Checkout: a row in paid_users and a sign-in account
// (see ../_shared/buyers.ts).
//
// Replies to Stripe:
// - 400 when the signature doesn't check out (not from Stripe: nothing is saved)
// - 500 when the secrets are missing or saving fails, so Stripe sends the event again later
// - 200 for everything else: saved, the same event again, events we don't use, unpaid sessions,
//   no email, or an email that's already a buyer (the first purchase is kept)
//
// Resending an event from Stripe (Webhooks → the event → Resend) also creates the account if it's missing.

import Stripe from 'npm:stripe@17.7.0';
import { adminClient, buyerEmail, isPaid, logger, recordBuyer, reply, stripeClient } from '../_shared/buyers.ts';

const cryptoProvider = Stripe.createSubtleCryptoProvider();
const logs = logger('stripe-webhook');
const { log, fail } = logs;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { message: 'Method not allowed' });

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey || !webhookSecret) {
    fail(`missing secret: ${!stripeKey ? 'STRIPE_SECRET_KEY ' : ''}${!webhookSecret ? 'STRIPE_WEBHOOK_SECRET' : ''}`);
    return reply(500, { message: 'Server not configured' });
  }

  const stripe = stripeClient(stripeKey);

  // The signature is checked against the exact text Stripe sent, so the body is read as text.
  const signature = req.headers.get('Stripe-Signature') ?? '';
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    fail(`signature check failed: ${(err as Error).message}`);
    return reply(400, { message: 'Bad signature' });
  }

  if (event.type !== 'checkout.session.completed') {
    log(`ignored ${event.type} (${event.id})`);
    return reply(200, { message: 'Ignored' });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const where = `event ${event.id}, session ${session.id}`;

  if (!isPaid(session)) {
    log(`not paid (payment_status ${session.payment_status}), nothing saved: ${where}`);
    return reply(200, { message: 'Not paid' });
  }

  const email = buyerEmail(session);
  if (!email) {
    fail(`no customer_details.email, nothing saved: ${where}`);
    return reply(200, { message: 'No email' });
  }

  const outcome = await recordBuyer(stripe, adminClient(), session, email, where, logs);
  if (outcome === 'failed') {
    log(`Stripe will retry: ${where}`);
    return reply(500, { message: 'Database error' });
  }
  return reply(200, { message: outcome === 'saved' ? 'Saved' : 'Already a buyer' });
});
