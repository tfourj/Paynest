-- Run this once if you already created the initial Paynest schema.
-- It lets existing device-local subscription IDs map to Supabase rows.

alter table public.subscriptions
add column if not exists local_id text;

update public.subscriptions
set local_id = id::text
where local_id is null;

alter table public.subscriptions
alter column local_id set default gen_random_uuid()::text;

alter table public.subscriptions
alter column local_id set not null;

create unique index if not exists subscriptions_user_id_local_id_idx
on public.subscriptions (user_id, local_id);
