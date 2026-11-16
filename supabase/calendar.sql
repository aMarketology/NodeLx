-- Run once in the NODELKX Supabase project. Calendar items (events + social
-- posts) are private and are accessed only through the NODELKX server's
-- service-role client, never from browsers.
--
-- site_id is a plain text site id (e.g. "spindler-construction") and is NOT
-- tied to a foreign key, so this migration works without the `clients` table.
create table if not exists public.nodelx_calendar_items (
  site_id text not null,
  kind text not null check (kind in ('event', 'social')),
  id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (site_id, kind, id)
);
alter table public.nodelx_calendar_items enable row level security;
revoke all on public.nodelx_calendar_items from anon, authenticated;
-- Service-role access bypasses RLS. No public policies are created.
