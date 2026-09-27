-- 노래일기 — database for 계정·동기화 (run once: Supabase > SQL Editor > New query > paste > Run).
-- Safe to run again. Each account can only read and write its own rows and files.

-- one number that grows with every change, so a phone can ask "what changed since N?"
create sequence if not exists public.sd_seq;

-- one row per diary day (data = the day as the app stores it; null = the day was deleted)
create table if not exists public.sd_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  data jsonb,
  rev bigint not null default 1,
  seq bigint not null default nextval('public.sd_seq'),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
create index if not exists sd_days_seq on public.sd_days (user_id, seq);

-- the diary's settings (practice items, tags, song library …)
create table if not exists public.sd_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  rev bigint not null default 1,
  seq bigint not null default nextval('public.sd_seq'),
  updated_at timestamptz not null default now()
);

alter table public.sd_days enable row level security;
alter table public.sd_settings enable row level security;

drop policy if exists "own days" on public.sd_days;
create policy "own days" on public.sd_days for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own settings" on public.sd_settings;
create policy "own settings" on public.sd_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Save a day only if nobody changed it since this phone last saw it (p_base = the rev it saw; 0 = new).
-- Returns ok = true with the new rev, or ok = false with what is on the server now, so the phone can merge.
create or replace function public.sd_push_day(p_date text, p_data jsonb, p_base bigint)
returns table (ok boolean, rev bigint, seq bigint, data jsonb)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare r_rev bigint; r_seq bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_date !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'bad date'; end if;
  if p_base = 0 then
    insert into sd_days (user_id, date, data) values (auth.uid(), p_date, p_data)
      on conflict (user_id, date) do nothing
      returning sd_days.rev, sd_days.seq into r_rev, r_seq;
  else
    update sd_days d set data = p_data, rev = d.rev + 1, seq = nextval('public.sd_seq'), updated_at = now()
      where d.user_id = auth.uid() and d.date = p_date and d.rev = p_base
      returning d.rev, d.seq into r_rev, r_seq;
  end if;
  if r_rev is not null then
    return query select true, r_rev, r_seq, null::jsonb;
  else
    return query select false, coalesce(d.rev, 0::bigint), coalesce(d.seq, 0::bigint), d.data
      from (select 1) one left join sd_days d on d.user_id = auth.uid() and d.date = p_date;
  end if;
end $$;

create or replace function public.sd_push_settings(p_data jsonb, p_base bigint)
returns table (ok boolean, rev bigint, seq bigint, data jsonb)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare r_rev bigint; r_seq bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_base = 0 then
    insert into sd_settings (user_id, data) values (auth.uid(), p_data)
      on conflict (user_id) do nothing
      returning sd_settings.rev, sd_settings.seq into r_rev, r_seq;
  else
    update sd_settings s set data = p_data, rev = s.rev + 1, seq = nextval('public.sd_seq'), updated_at = now()
      where s.user_id = auth.uid() and s.rev = p_base
      returning s.rev, s.seq into r_rev, r_seq;
  end if;
  if r_rev is not null then
    return query select true, r_rev, r_seq, null::jsonb;
  else
    return query select false, coalesce(s.rev, 0::bigint), coalesce(s.seq, 0::bigint), s.data
      from (select 1) one left join sd_settings s on s.user_id = auth.uid();
  end if;
end $$;

revoke all on function public.sd_push_day(text, jsonb, bigint) from public, anon;
revoke all on function public.sd_push_settings(jsonb, bigint) from public, anon;
grant execute on function public.sd_push_day(text, jsonb, bigint) to authenticated;
grant execute on function public.sd_push_settings(jsonb, bigint) to authenticated;
grant select, insert, update, delete on public.sd_days, public.sd_settings to authenticated;
grant usage on sequence public.sd_seq to authenticated;

-- recordings: a private bucket, one folder per account (<user id>/<recording id>)
insert into storage.buckets (id, name, public) values ('sd-audio', 'sd-audio', false)
  on conflict (id) do nothing;

drop policy if exists "sd-audio own read" on storage.objects;
create policy "sd-audio own read" on storage.objects for select to authenticated
  using (bucket_id = 'sd-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "sd-audio own insert" on storage.objects;
create policy "sd-audio own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'sd-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "sd-audio own update" on storage.objects;
create policy "sd-audio own update" on storage.objects for update to authenticated
  using (bucket_id = 'sd-audio' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'sd-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "sd-audio own delete" on storage.objects;
create policy "sd-audio own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'sd-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
