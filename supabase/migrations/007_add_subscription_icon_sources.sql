-- Stores manually selected external subscription icon sources.

alter table public.subscriptions
add column if not exists icon_provider text,
add column if not exists icon_url text,
add column if not exists icon_source_title text;
