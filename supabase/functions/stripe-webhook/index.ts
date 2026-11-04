// Records Mirror 21 buyers in paid_users when Stripe reports a completed Checkout.
//
// Replies to Stripe:
// - 400 when the signature doesn't check out (not from Stripe: nothing is saved)
// - 500 when the secrets are missing or saving fails, so Stripe sends the event again later
// - 200 for everything else: saved, the same event again, events we don't use, unpaid sessions,
//   no email, or an email that's already a buyer (the first purchase is kept)
//
// Secrets (Supabase → Edge Functions → Secrets): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const reply = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json' } });

const log = (message: string) => console.log(`[stripe-webhook] ${message}`);
const fail = (message: string) => console.error(`[stripe-webhook] ERROR ${message}`);

// The code the buyer typed (e.g. MIRRORTEST). Stripe's event only carries its ID, so it's looked up.
// A failed lookup never blocks saving the buyer: the row is saved with no promo code.
async function promoCode(stripe: Stripe, sessionId: string): Promise<string | null> {
  try {
    const full = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['total_details.breakdown'] });
    for (const { discount } of full.total_details?.breakdown?.discounts ?? []) {
      const promo = discount.promotion_code;
      if (!promo) continue;
      if (typeof promo !== 'string') return promo.code;
      return (await stripe.promotionCodes.retrieve(promo)).code;
    }
    return null;
  } catch (err) {
    fail(`promo code lookup failed for session ${sessionId} (saving without it): ${(err as Error).message}`);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, 'Method not allowed');

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey || !webhookSecret) {
    fail(`missing secret: ${!stripeKey ? 'STRIPE_SECRET_KEY ' : ''}${!webhookSecret ? 'STRIPE_WEBHOOK_SECRET' : ''}`);
    return reply(500, 'Server not configured');
  }

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  // The signature is checked against the exact text Stripe sent, so the body is read as text.
  const signature = req.headers.get('Stripe-Signature') ?? '';
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    fail(`signature check failed: ${(err as Error).message}`);
    return reply(400, 'Bad signature');
  }

  if (event.type !== 'checkout.session.completed') {
    log(`ignored ${event.type} (${event.id})`);
    return reply(200, 'Ignored');
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const where = `event ${event.id}, session ${session.id}`;

  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    log(`not paid (payment_status ${session.payment_status}), nothing saved: ${where}`);
    return reply(200, 'Not paid');
  }

  const email = session.customer_details?.email?.trim().toLowerCase();
  if (!email) {
    fail(`no customer_details.email, nothing saved: ${where}`);
    return reply(200, 'No email');
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // One row per buyer: a later purchase with the same email keeps the first one.
  const { data: existing, error: findError } = await supabase
    .from('paid_users')
    .select('stripe_session_id')
    .eq('email', email)
    .maybeSingle();
  if (findError) {
    fail(`could not read paid_users (Stripe will retry): ${findError.message} | ${where}`);
    return reply(500, 'Database error');
  }
  if (existing && existing.stripe_session_id !== session.id) {
    log(`already a buyer (${email}, first session ${existing.stripe_session_id}), kept the first: ${where}`);
    return reply(200, 'Already a buyer');
  }

  const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
  const row = {
    email,
    stripe_session_id: session.id,
    stripe_customer_id: customer,
    amount_total: session.amount_total ?? 0,
    currency: session.currency ?? '',
    promo_code: await promoCode(stripe, session.id),
    livemode: session.livemode,
  };

  // Keyed on the session, so the same event delivered twice updates the same row.
  const { error: saveError } = await supabase.from('paid_users').upsert(row, { onConflict: 'stripe_session_id' });
  if (saveError) {
    fail(`could not save ${email} (Stripe will retry): ${saveError.message} | ${where}`);
    return reply(500, 'Database error');
  }

  log(`saved ${email}, ${row.amount_total} ${row.currency}, promo ${row.promo_code ?? 'none'}: ${where}`);
  return reply(200, 'Saved');
});
