alter table public.settings
alter column theme set default 'light';

update public.settings
set theme = 'light'
where theme = 'system';
