-- Run this if you already created the initial Paynest schema.
-- It allows the app's expanded subscription billing periods.

alter table public.subscriptions
alter column category set default 'None';

alter table public.subscriptions
drop constraint if exists subscriptions_billing_period_check;

alter table public.subscriptions
add constraint subscriptions_billing_period_check
check (billing_period in ('Weekly', 'Monthly', '3 months', '6 months', 'Yearly'));
