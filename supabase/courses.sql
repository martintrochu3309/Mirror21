-- Mirror 21 · the account copy of each learner's course, and who may open /dashboard.
-- Applied to the project on 23 Nov 2026 (migration "courses_and_admins"). Kept here as the record of what exists.
-- The app side is assets/core/store.js (cloud): it saves in the browser first, then calls save_course.

-- Each learner's saved course, one row per account, so it follows them to any device.
create table public.courses (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  snapshot   jsonb       not null,          -- { progress, runs, reminder, flags }: what the app keeps for the account
  saved_at   bigint      not null,          -- when the device saved it (ms since 1970); an older save never replaces a newer one
  updated_at timestamptz not null default now()
);
alter table public.courses enable row level security;
revoke all on public.courses from anon, authenticated;
grant select, delete on public.courses to authenticated;
create policy "Learners read their own course" on public.courses for select to authenticated using ((select auth.uid()) = user_id);
create policy "Learners delete their own course" on public.courses for delete to authenticated using ((select auth.uid()) = user_id);

-- Saves the signed-in learner's course unless the stored one is newer; returns what is stored.
create function public.save_course(p_snapshot jsonb, p_saved_at bigint)
returns table (snapshot jsonb, saved_at bigint)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if jsonb_typeof(p_snapshot) <> 'object' or octet_length(p_snapshot::text) > 1000000 then
    raise exception 'invalid course' using errcode = '22023';
  end if;
  insert into public.courses as c (user_id, snapshot, saved_at, updated_at)
  values (uid, p_snapshot, p_saved_at, now())
  on conflict (user_id) do update set snapshot = excluded.snapshot, saved_at = excluded.saved_at, updated_at = now()
  where c.saved_at <= excluded.saved_at;
  return query select c.snapshot, c.saved_at from public.courses c where c.user_id = uid;
end $$;
revoke execute on function public.save_course(jsonb, bigint) from public, anon;
grant execute on function public.save_course(jsonb, bigint) to authenticated;

-- Who may open /dashboard (their sign-in emails, added by hand in the SQL Editor, never in this repo).
-- Nobody can read this table through the public keys.
create table public.admins (
  email text primary key check (email = lower(email))
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
