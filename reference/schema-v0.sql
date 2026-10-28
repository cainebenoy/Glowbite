-- GlowBite pre-order leads
-- Visitors can INSERT only. Nobody can read leads with the public key;
-- the GlowBite team reads them in the Supabase dashboard (or with the service role).

create table if not exists public.preorder_leads (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  full_name        text not null check (char_length(full_name) between 2 and 80),
  phone            text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  email            text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  pin_code         text not null check (pin_code ~ '^[1-9][0-9]{5}$'),
  quantity         int  not null default 1 check (quantity between 1 and 5),
  marketing_opt_in boolean not null default false,
  price_shown      int,
  source           text,
  utm              jsonb default '{}'::jsonb,
  status           text not null default 'new'   -- new / contacted / converted / dropped
);

-- One lead per mobile number (duplicate submits return 409, the page shows "already on the list")
create unique index if not exists preorder_leads_phone_key on public.preorder_leads (phone);

alter table public.preorder_leads enable row level security;

-- Anonymous visitors may insert, nothing else
drop policy if exists "public can submit leads" on public.preorder_leads;
create policy "public can submit leads"
  on public.preorder_leads for insert
  to anon
  with check (status = 'new');

revoke select, update, delete on public.preorder_leads from anon;
