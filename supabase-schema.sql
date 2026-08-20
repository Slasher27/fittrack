-- FitTrack sync schema — v2 (2026-08-18): one row set per user, protected by row-level security.
-- Run in Supabase: SQL Editor → New query → paste → Run. Safe to run on a fresh project AND
-- on a project that already has the v1 single-user `records` table (it upgrades in place:
-- existing rows are handed to the first account ever created — the owner).

create table if not exists public.records (
  user_id uuid    not null default auth.uid(),
  store   text    not null,
  id      text    not null,
  data    jsonb,
  up      bigint  not null,          -- client timestamp (ms); last write wins
  deleted boolean not null default false,
  primary key (user_id, store, id)
);

-- v1 → v2 upgrade (only runs when the old table has no user_id column)
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'records' and column_name = 'user_id') then
    alter table public.records add column user_id uuid;
    update public.records
       set user_id = (select id from auth.users order by created_at asc limit 1)
     where user_id is null;
    alter table public.records alter column user_id set not null;
    alter table public.records alter column user_id set default auth.uid();
    alter table public.records drop constraint if exists records_pkey;
    alter table public.records add primary key (user_id, store, id);
  end if;
end $$;

create index if not exists records_user_up_idx on public.records (user_id, up);

-- Every signed-in user sees and writes only their own rows.
alter table public.records enable row level security;
drop policy if exists "authenticated full access" on public.records;   -- v1 policy
drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- v3 stage 4 (2026-08-18): coach usage log — written by the `coach` Edge Function with the
-- service role (per-user daily quota + cost visibility). Users can read their own rows.
create table if not exists public.ai_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid        not null,
  at            timestamptz not null default now(),
  model         text,
  kind          text,
  input_tokens  integer     not null default 0,
  output_tokens integer     not null default 0,
  cache_read    integer     not null default 0
);
create index if not exists ai_usage_user_at_idx on public.ai_usage (user_id, at);
alter table public.ai_usage enable row level security;
drop policy if exists "own usage" on public.ai_usage;
create policy "own usage" on public.ai_usage for select to authenticated using (user_id = auth.uid());

-- v3 stage 5 (2026-08-19): plan sharing by email + invite-only sign-up.

-- A share is a SNAPSHOT of a plan addressed to an email. The recipient sees it on their
-- next launch and imports a copy (source 'shared'); their logs stay their own.
create table if not exists public.plan_shares (
  id         uuid        primary key default gen_random_uuid(),
  from_user  uuid        not null default auth.uid(),
  from_email text,
  to_email   text        not null,
  plan       jsonb       not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  status     text
);
create index if not exists plan_shares_to_idx on public.plan_shares (lower(to_email), claimed_at);
alter table public.plan_shares enable row level security;
drop policy if exists "share sender" on public.plan_shares;
create policy "share sender" on public.plan_shares for all to authenticated
  using (from_user = auth.uid()) with check (from_user = auth.uid());
drop policy if exists "share recipient read" on public.plan_shares;
create policy "share recipient read" on public.plan_shares for select to authenticated
  using (lower(to_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
drop policy if exists "share recipient claim" on public.plan_shares;
create policy "share recipient claim" on public.plan_shares for update to authenticated
  using (lower(to_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (lower(to_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Invites: any signed-in user can create codes; a code is consumed by the sign-up that uses it.
create table if not exists public.invites (
  code       text        primary key,
  created_by uuid        not null default auth.uid(),
  created_at timestamptz not null default now(),
  note       text,
  used_by    uuid,
  used_at    timestamptz
);
alter table public.invites enable row level security;
drop policy if exists "invites owner" on public.invites;
create policy "invites owner" on public.invites for all to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

-- Anonymous pre-check so the sign-up form can say "invalid code" before submitting.
create or replace function public.invite_valid(p_code text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from public.invites where code = upper(trim(p_code)) and used_by is null);
$$;
grant execute on function public.invite_valid(text) to anon, authenticated;

-- The gate: every sign-up after the first account must carry a valid, unused invite code in
-- its metadata (the app sends {invite_code} with the sign-up). The first user (the owner) is exempt.
create or replace function public.check_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if (select count(*) from auth.users) = 0 then return new; end if;
  v_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  if v_code = '' or not exists (select 1 from public.invites i where i.code = v_code and i.used_by is null) then
    raise exception 'INVITE_REQUIRED';
  end if;
  update public.invites set used_by = new.id, used_at = now() where code = v_code;
  return new;
end $$;
drop trigger if exists check_invite_trg on auth.users;
create trigger check_invite_trg before insert on auth.users
  for each row execute function public.check_invite();

-- v3 stage 7 (2026-08-19): progress photos in Storage. Each user's images live under
-- photos/{user_id}/{photo_id}.jpg; the photo's metadata syncs through `records` like everything else.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
drop policy if exists "photos own" on storage.objects;
create policy "photos own" on storage.objects for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
