-- Mirror 21 buyers, written by the stripe-webhook Edge Function after a Stripe Checkout.
-- Paste this once into the Supabase SQL Editor and press Run.

create table public.paid_users (
  id                 uuid        primary key default gen_random_uuid(),
  email              text        not null unique check (email = lower(email)),
  stripe_session_id  text        not null unique,
  stripe_customer_id text,
  amount_total       integer     not null,           -- in cents: 2900 is 29.00, 0 is a 100% coupon order
  currency           text        not null,           -- e.g. eur, usd
  promo_code         text,                           -- the code typed at checkout (e.g. MIRRORTEST), or empty
  livemode           boolean     not null,           -- false for sandbox (test) payments
  paid_at            timestamptz not null default now()
);

-- Row Level Security on with no policies: the public keys can't read or write this table.
-- Only the Edge Function, which runs with the server key, can.
alter table public.paid_users enable row level security;
revoke all on public.paid_users from anon, authenticated;
