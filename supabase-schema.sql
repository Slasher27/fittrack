-- FitTrack sync schema. Run this once in Supabase: SQL Editor → New query → paste → Run.
-- One generic table holds every synced record (foods, meals, log, measurements, workouts).

create table if not exists public.records (
  store   text   not null,
  id      text   not null,
  data    jsonb,
  up      bigint not null,          -- client timestamp (ms); last write wins
  deleted boolean not null default false,
  primary key (store, id)
);

create index if not exists records_up_idx on public.records (up);

-- Only signed-in users can touch the data (this is a single-user project:
-- the only account is yours, created in Authentication → Users).
alter table public.records enable row level security;

drop policy if exists "authenticated full access" on public.records;
create policy "authenticated full access" on public.records
  for all to authenticated using (true) with check (true);
