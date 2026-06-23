alter table public.settings
add column if not exists payday_enabled boolean not null default false;

alter table public.settings
add column if not exists payday integer not null default 1 check (payday between 1 and 31);
