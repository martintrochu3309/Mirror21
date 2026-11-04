// Shared by stripe-webhook and checkout-email: turning a completed Stripe Checkout into a Mirror 21 buyer.
// A buyer is a row in paid_users plus a Supabase Auth account for the same email (confirmed, no password), so the
// sign-in page can email them a code. Everything here is safe to run twice for the same payment.
//
// Secrets (Supabase → Edge Functions → Secrets): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (the webhook only).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import Stripe from 'npm:stripe@17.7.0';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';

export type Logger = { log: (message: string) => void; fail: (message: string) => void };

export const logger = (tag: string): Logger => ({
  log: (message) => console.log(`[${tag}] ${message}`),
  fail: (message) => console.error(`[${tag}] ERROR ${message}`),
});

export const reply = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export function stripeClient(key: string) {
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Paid by card, or nothing to pay (a 100% coupon such as MIRRORTEST).
export const isPaid = (session: Stripe.Checkout.Session) =>
  session.payment_status === 'paid' || session.payment_status === 'no_payment_required';

export const buyerEmail = (session: Stripe.Checkout.Session) =>
  session.customer_details?.email?.trim().toLowerCase() || null;

// The code the buyer typed (e.g. MIRRORTEST). Stripe's event only carries its ID, so it's looked up.
// A failed lookup never blocks saving the buyer: the row is saved with no promo code.
async function promoCode(stripe: Stripe, sessionId: string, { fail }: Logger): Promise<string | null> {
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

// The sign-in account: created confirmed, with no password. One that already exists is left as it is.
async function ensureAccount(supabase: SupabaseClient, email: string, where: string, { log, fail }: Logger) {
  const { error } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  if (!error) { log(`account created for ${email}: ${where}`); return true; }
  if (error.code === 'email_exists' || /already (been )?registered|already exists/i.test(error.message)) return true;
  fail(`could not create the account for ${email}: ${error.message} | ${where}`);
  return false;
}

// Saves the buyer (one row per email: a later purchase keeps the first) and makes sure they have an account.
// 'failed' means something should be tried again later; the reason is already logged.
export async function recordBuyer(
  stripe: Stripe, supabase: SupabaseClient, session: Stripe.Checkout.Session, email: string, where: string, logs: Logger,
): Promise<'saved' | 'already' | 'failed'> {
  const { log, fail } = logs;
  const { data: existing, error: findError } = await supabase
    .from('paid_users')
    .select('stripe_session_id')
    .eq('email', email)
    .maybeSingle();
  if (findError) {
    fail(`could not read paid_users: ${findError.message} | ${where}`);
    return 'failed';
  }

  let outcome: 'saved' | 'already' = 'saved';
  if (existing && existing.stripe_session_id !== session.id) {
    log(`already a buyer (${email}, first session ${existing.stripe_session_id}), kept the first: ${where}`);
    outcome = 'already';
  } else {
    const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
    const row = {
      email,
      stripe_session_id: session.id,
      stripe_customer_id: customer,
      amount_total: session.amount_total ?? 0,
      currency: session.currency ?? '',
      promo_code: await promoCode(stripe, session.id, logs),
      livemode: session.livemode,
    };
    // Keyed on the session, so the same payment seen twice updates the same row.
    const { error: saveError } = await supabase.from('paid_users').upsert(row, { onConflict: 'stripe_session_id' });
    if (saveError) {
      fail(`could not save ${email}: ${saveError.message} | ${where}`);
      return 'failed';
    }
    log(`saved ${email}, ${row.amount_total} ${row.currency}, promo ${row.promo_code ?? 'none'}: ${where}`);
  }

  return (await ensureAccount(supabase, email, where, logs)) ? outcome : 'failed';
}
