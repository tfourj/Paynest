-- Paynest Supabase schema
-- Run this in the Supabase SQL editor after enabling Supabase Auth.

create extension if not exists pgcrypto;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null default gen_random_uuid()::text,
  name text not null,
  category text not null default 'None',
  price numeric(12, 2) not null check (price > 0),
  currency text not null default 'EUR',
  billing_period text not null check (billing_period in ('Weekly', 'Monthly', '3 months', '6 months', 'Yearly')),
  pay_day integer check (pay_day between 1 and 31),
  next_renewal_date date not null,
  icon_name text,
  icon_label text,
  icon_color text,
  background_color text,
  simple_icon_slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  reminders_enabled boolean not null default true,
  reminder_days integer not null default 3 check (reminder_days >= 0),
  currency text not null default 'EUR',
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
before update on public.settings
for each row
execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
alter table public.settings enable row level security;

grant select, insert, update, delete on table public.subscriptions to authenticated;
grant select, insert, update on table public.settings to authenticated;

drop policy if exists "Users can read their subscriptions" on public.subscriptions;
create policy "Users can read their subscriptions"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their subscriptions" on public.subscriptions;
create policy "Users can insert their subscriptions"
on public.subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their subscriptions" on public.subscriptions;
create policy "Users can update their subscriptions"
on public.subscriptions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their subscriptions" on public.subscriptions;
create policy "Users can delete their subscriptions"
on public.subscriptions
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their settings" on public.settings;
create policy "Users can read their settings"
on public.settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their settings" on public.settings;
create policy "Users can insert their settings"
on public.settings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their settings" on public.settings;
create policy "Users can update their settings"
on public.settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists subscriptions_user_id_next_renewal_date_idx
on public.subscriptions (user_id, next_renewal_date);

create unique index if not exists subscriptions_user_id_local_id_idx
on public.subscriptions (user_id, local_id);
