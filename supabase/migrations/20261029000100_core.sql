-- Glowbite pre-order: core schema.
-- Leads are written and read only by the service role (server route + admin server code).
-- Settings content is public (select only); ops settings, admins and rate limits are private.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- leads
create table public.leads (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  full_name            text not null check (char_length(btrim(full_name)) between 2 and 80),
  phone                text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  email                text check (email is null or (char_length(email) <= 120 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$')),
  pin_code             text not null check (pin_code ~ '^[1-9][0-9]{5}$'),
  -- the per-offer cap (settings.max_qty) is enforced by the server; this is a hard ceiling
  quantity             int  not null default 1 check (quantity between 1 and 20),
  marketing_opt_in     boolean not null default false,
  consent_text_version text not null,
  price_shown          int check (price_shown is null or price_shown >= 0),
  status               text not null default 'new' check (status in ('new', 'contacted', 'converted', 'dropped')),
  notes                text check (notes is null or char_length(notes) <= 5000),
  source               text check (source is null or char_length(source) <= 200),
  utm                  jsonb not null default '{}'::jsonb,
  referrer             text check (referrer is null or char_length(referrer) <= 1000),
  user_agent           text check (user_agent is null or char_length(user_agent) <= 500),
  ip_hash              text
);

-- one lead per mobile number; duplicate submits are reported as "already on the list"
create unique index leads_phone_key on public.leads (phone);
create index leads_created_at_idx on public.leads (created_at desc);
create index leads_status_idx on public.leads (status);
create index leads_pin_code_idx on public.leads (pin_code);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;
-- deliberately no policies: anon and authenticated can do nothing
revoke all on public.leads from anon, authenticated;

-- ---------------------------------------------------------------- settings (public content)
create table public.settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;
grant select on public.settings to anon, authenticated;
create policy "settings are public content"
  on public.settings for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------- settings_ops (private)
create table public.settings_ops (
  id                 int primary key default 1 check (id = 1),
  team_notify_emails text[] not null default '{}',
  updated_by         text,
  updated_at         timestamptz not null default now()
);

alter table public.settings_ops enable row level security;
revoke all on public.settings_ops from anon, authenticated;

-- ---------------------------------------------------------------- admins (private allowlist)
create table public.admins (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- ---------------------------------------------------------------- rate limits (private)
create table public.rate_limits (
  ip_hash      text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (ip_hash, window_start)
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Atomically counts a submission for this IP hash in a fixed window.
-- Returns true when the request is allowed, false once the limit is exceeded.
create or replace function public.check_rate_limit(p_ip_hash text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into public.rate_limits as r (ip_hash, window_start, count)
  values (p_ip_hash, w, 1)
  on conflict (ip_hash, window_start) do update set count = r.count + 1
  returning r.count into n;

  -- opportunistic cleanup of old windows
  delete from public.rate_limits where window_start < now() - interval '1 day';

  return n <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
