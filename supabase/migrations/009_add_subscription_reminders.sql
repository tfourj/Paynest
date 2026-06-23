-- Stores per-subscription renewal reminder settings.

alter table public.subscriptions
add column if not exists reminder_enabled boolean not null default false,
add column if not exists reminder_days integer not null default 0,
add column if not exists reminder_time text not null default '09:00';

alter table public.subscriptions
drop constraint if exists subscriptions_reminder_days_check;

alter table public.subscriptions
add constraint subscriptions_reminder_days_check
check (reminder_days in (0, 1, 3));

alter table public.subscriptions
drop constraint if exists subscriptions_reminder_time_check;

alter table public.subscriptions
add constraint subscriptions_reminder_time_check
check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
