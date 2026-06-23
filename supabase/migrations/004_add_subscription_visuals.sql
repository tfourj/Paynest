-- Run this if you already created the initial Paynest schema.
-- It stores subscription pay-day and visual customization choices.

alter table public.subscriptions
add column if not exists pay_day integer check (pay_day between 1 and 31),
add column if not exists icon_name text,
add column if not exists icon_label text,
add column if not exists icon_color text,
add column if not exists background_color text,
add column if not exists simple_icon_slug text;
