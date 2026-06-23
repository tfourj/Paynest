-- Stores a custom background color for the subscription icon badge.

alter table public.subscriptions
add column if not exists icon_background_color text;
