-- Run once in the NODELKX Supabase project. Drafts are private and are accessed
-- only through the NODELKX server's service-role client, never from browsers.
--
-- site_id is the NODELKX site id and must match clients.slug (e.g.
-- "spindler-construction"). It is referenced by a foreign key below.
create table if not exists public.nodelx_email_campaigns (
  site_id text not null,
  id uuid not null,
  source text,
  revision integer not null default 1,
  draft jsonb not null,
  design jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (site_id, id),
  unique (site_id, source)
);
alter table public.nodelx_email_campaigns enable row level security;
revoke all on public.nodelx_email_campaigns from anon, authenticated;
-- Ensure the client row exists before adding the foreign key. The slug must
-- match the NODELKX site id (NODELX_SITE_ID). Adjust the name as needed.
insert into public.clients (name, slug)
values ('Spindler Construction', 'spindler-construction')
on conflict (slug) do nothing;
-- Ties each campaign to a registered client. Safe to run more than once.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'nodelx_email_campaigns_site_id_fkey'
  ) then
    alter table public.nodelx_email_campaigns
      add constraint nodelx_email_campaigns_site_id_fkey
      foreign key (site_id) references public.clients(slug) on delete cascade;
  end if;
end $$;
-- Service-role access bypasses RLS. No public policies are created.
