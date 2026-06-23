-- Run this if authenticated users get permission denied errors before RLS checks.
-- RLS policies still restrict rows to auth.uid() = user_id.

grant select, insert, update, delete on table public.subscriptions to authenticated;
grant select, insert, update on table public.settings to authenticated;
