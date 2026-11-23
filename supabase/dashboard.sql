-- Mirror 21 · /dashboard's numbers, for admins only (the emails in public.admins; see courses.sql).
-- Applied to the project on 23 Nov 2026 (migration "dashboard_stats"). Kept here as the record of what exists.
-- One entry per buyer, with no email and nothing they wrote: when they paid, whether they have signed in, when they
-- started and last saved, and per step only where they got to, when they committed it and their evening answer.
create function public.dashboard_stats()
returns jsonb
language plpgsql security definer stable set search_path = '' as $$
begin
  if not exists (select 1 from public.admins a where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))) then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'generated_at', (extract(epoch from now()) * 1000)::bigint,
    'learners', coalesce((
      select jsonb_agg(jsonb_build_object(
        'paid_at', (extract(epoch from p.paid_at) * 1000)::bigint,
        'test', not p.livemode,
        'signed_in', u.last_sign_in_at is not null,
        'saved_at', c.saved_at,
        'started_at', case when jsonb_typeof(c.snapshot -> 'progress') = 'object' then c.snapshot -> 'progress' -> 'startedAt' end,
        'finished_at', case when jsonb_typeof(c.snapshot -> 'progress') = 'object' then c.snapshot -> 'progress' -> 'finishedAt' end,
        'steps', (
          select coalesce(jsonb_object_agg(d.n, jsonb_strip_nulls(jsonb_build_object(
            'committed', (c.snapshot -> 'progress' -> 'lessons' ->> d.n::text) = 'true',
            'committed_at', c.snapshot -> 'progress' -> 'steps' -> d.n::text ->> 'committedAt',
            'opened', jsonb_typeof(c.snapshot -> 'progress' -> 'steps' -> d.n::text) = 'object',
            'checked_in', c.snapshot -> 'progress' -> 'steps' -> d.n::text -> 'checkedIn',
            'reached', c.snapshot -> 'progress' -> 'steps' -> d.n::text -> 'reached',
            'answer', case when c.snapshot -> 'progress' -> 'answers' ->> d.n::text in ('yes', 'partly', 'no')
                           then c.snapshot -> 'progress' -> 'answers' ->> d.n::text end
          ))), '{}'::jsonb)
          from generate_series(1, 21) as d(n)
          where jsonb_typeof(c.snapshot -> 'progress') = 'object'
        )
      ) order by p.paid_at)
      from public.paid_users p
      left join auth.users u on lower(u.email) = p.email
      left join public.courses c on c.user_id = u.id
    ), '[]'::jsonb)
  );
end $$;
revoke execute on function public.dashboard_stats() from public, anon;
grant execute on function public.dashboard_stats() to authenticated;
