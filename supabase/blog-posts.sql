-- Run once in the NODELKX Supabase project. Posts are private and accessed only
-- through the NODELKX server's service-role client, never from browsers.
create table if not exists public.nodelx_blog_posts (
  site_id text not null,
  slug text not null,
  source text,
  revision integer not null default 1,
  post jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (site_id, slug),
  unique (site_id, source)
);
alter table public.nodelx_blog_posts enable row level security;
revoke all on public.nodelx_blog_posts from anon, authenticated;
-- Service-role access bypasses RLS. No public policies are created.
