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
