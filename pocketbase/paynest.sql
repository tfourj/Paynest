-- Paynest PocketBase schema
-- Paste this into PocketBase Admin -> Settings -> Database -> New query.
-- It creates the app collections used by Paynest.

create table if not exists subscriptions (
  id text primary key not null,
  created text not null default (strftime('%Y-%m-%d %H:%M:%fZ')),
  updated text not null default (strftime('%Y-%m-%d %H:%M:%fZ')),
  user text not null,
  local_id text not null,
  name text not null,
  category text not null,
  price real not null,
  currency text not null,
  billing_period text not null,
  pay_day real,
  next_renewal_date text not null,
  reminder_enabled boolean not null default false,
  reminder_days real not null default 0,
  reminder_time text,
  icon_name text,
  icon_label text,
  icon_color text,
  background_color text,
  icon_background_color text,
  simple_icon_slug text,
  icon_provider text,
  icon_url text,
  icon_source_title text,
  created_at text not null,
  updated_at text not null
);

create table if not exists settings (
  id text primary key not null,
  created text not null default (strftime('%Y-%m-%d %H:%M:%fZ')),
  updated text not null default (strftime('%Y-%m-%d %H:%M:%fZ')),
  user text not null,
  reminders_enabled boolean not null default false,
  reminder_days real not null default 0,
  currency text not null,
  payday_enabled boolean not null default false,
  payday real not null default 1,
  updated_at text not null
);

create unique index if not exists idx_subscriptions_user_local_id
on subscriptions (user, local_id);

create unique index if not exists idx_settings_user
on settings (user);

delete from _collections
where name in ('subscriptions', 'settings');

insert into _collections (
  id,
  name,
  type,
  system,
  fields,
  indexes,
  listRule,
  viewRule,
  createRule,
  updateRule,
  deleteRule
) values (
  'pbc_paynestsub',
  'subscriptions',
  'base',
  false,
  json('[
    {
      "autogeneratePattern": "[a-z0-9]{15}",
      "hidden": false,
      "id": "text3208210256",
      "max": 15,
      "min": 15,
      "name": "id",
      "pattern": "^[a-z0-9]+$",
      "presentable": false,
      "primaryKey": true,
      "required": true,
      "system": true,
      "type": "text"
    },
    {
      "hidden": false,
      "id": "autodate2990389176",
      "name": "created",
      "onCreate": true,
      "onUpdate": false,
      "presentable": false,
      "system": true,
      "type": "autodate"
    },
    {
      "hidden": false,
      "id": "autodate3332085495",
      "name": "updated",
      "onCreate": true,
      "onUpdate": true,
      "presentable": false,
      "system": true,
      "type": "autodate"
    },
    {
      "cascadeDelete": true,
      "collectionId": "_pb_users_auth_",
      "hidden": false,
      "id": "relation_paynest_user",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "user",
      "presentable": false,
      "required": true,
      "system": false,
      "type": "relation"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_local_id",
      "max": 0,
      "min": 0,
      "name": "local_id",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_name",
      "max": 0,
      "min": 0,
      "name": "name",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_category",
      "max": 0,
      "min": 0,
      "name": "category",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    },
    {
      "hidden": false,
      "id": "number_subscription_price",
      "max": null,
      "min": 0,
      "name": "price",
      "onlyInt": false,
      "presentable": false,
      "required": true,
      "system": false,
      "type": "number"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_currency",
      "max": 0,
      "min": 0,
      "name": "currency",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    },
    {
      "hidden": false,
      "id": "select_subscription_period",
      "maxSelect": 1,
      "name": "billing_period",
      "presentable": false,
      "required": true,
      "system": false,
      "type": "select",
      "values": ["Weekly", "Monthly", "3 months", "6 months", "Yearly"]
    },
    {
      "hidden": false,
      "id": "number_subscription_pay_day",
      "max": 31,
      "min": 1,
      "name": "pay_day",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    },
    {
      "hidden": false,
      "id": "date_subscription_next_renewal",
      "max": "",
      "min": "",
      "name": "next_renewal_date",
      "presentable": false,
      "required": true,
      "system": false,
      "type": "date"
    },
    {
      "hidden": false,
      "id": "bool_subscription_reminder_enabled",
      "name": "reminder_enabled",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "bool"
    },
    {
      "hidden": false,
      "id": "number_subscription_reminder_days",
      "max": null,
      "min": 0,
      "name": "reminder_days",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_reminder_time",
      "max": 0,
      "min": 0,
      "name": "reminder_time",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_icon_name",
      "max": 0,
      "min": 0,
      "name": "icon_name",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_icon_label",
      "max": 0,
      "min": 0,
      "name": "icon_label",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_icon_color",
      "max": 0,
      "min": 0,
      "name": "icon_color",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_background_color",
      "max": 0,
      "min": 0,
      "name": "background_color",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_icon_bg_color",
      "max": 0,
      "min": 0,
      "name": "icon_background_color",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_simple_icon_slug",
      "max": 0,
      "min": 0,
      "name": "simple_icon_slug",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_icon_provider",
      "max": 0,
      "min": 0,
      "name": "icon_provider",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "exceptDomains": null,
      "hidden": false,
      "id": "url_subscription_icon_url",
      "name": "icon_url",
      "onlyDomains": null,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "url"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_icon_source_title",
      "max": 0,
      "min": 0,
      "name": "icon_source_title",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_created_at",
      "max": 0,
      "min": 0,
      "name": "created_at",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_subscription_updated_at",
      "max": 0,
      "min": 0,
      "name": "updated_at",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    }
  ]'),
  json('[
    "CREATE UNIQUE INDEX `idx_subscriptions_user_local_id` ON `subscriptions` (`user`, `local_id`)"
  ]'),
  'user = @request.auth.id',
  'user = @request.auth.id',
  'user = @request.auth.id',
  'user = @request.auth.id',
  'user = @request.auth.id'
);

insert into _collections (
  id,
  name,
  type,
  system,
  fields,
  indexes,
  listRule,
  viewRule,
  createRule,
  updateRule,
  deleteRule
) values (
  'pbc_paynestset',
  'settings',
  'base',
  false,
  json('[
    {
      "autogeneratePattern": "[a-z0-9]{15}",
      "hidden": false,
      "id": "text3208210256",
      "max": 15,
      "min": 15,
      "name": "id",
      "pattern": "^[a-z0-9]+$",
      "presentable": false,
      "primaryKey": true,
      "required": true,
      "system": true,
      "type": "text"
    },
    {
      "hidden": false,
      "id": "autodate2990389176",
      "name": "created",
      "onCreate": true,
      "onUpdate": false,
      "presentable": false,
      "system": true,
      "type": "autodate"
    },
    {
      "hidden": false,
      "id": "autodate3332085495",
      "name": "updated",
      "onCreate": true,
      "onUpdate": true,
      "presentable": false,
      "system": true,
      "type": "autodate"
    },
    {
      "cascadeDelete": true,
      "collectionId": "_pb_users_auth_",
      "hidden": false,
      "id": "relation_paynest_settings_user",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "user",
      "presentable": false,
      "required": true,
      "system": false,
      "type": "relation"
    },
    {
      "hidden": false,
      "id": "bool_settings_reminders_enabled",
      "name": "reminders_enabled",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "bool"
    },
    {
      "hidden": false,
      "id": "number_settings_reminder_days",
      "max": null,
      "min": 0,
      "name": "reminder_days",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_settings_currency",
      "max": 0,
      "min": 0,
      "name": "currency",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    },
    {
      "hidden": false,
      "id": "bool_settings_payday_enabled",
      "name": "payday_enabled",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "bool"
    },
    {
      "hidden": false,
      "id": "number_settings_payday",
      "max": 31,
      "min": 1,
      "name": "payday",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    },
    {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text_settings_updated_at",
      "max": 0,
      "min": 0,
      "name": "updated_at",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": true,
      "system": false,
      "type": "text"
    }
  ]'),
  json('[
    "CREATE UNIQUE INDEX `idx_settings_user` ON `settings` (`user`)"
  ]'),
  'user = @request.auth.id',
  'user = @request.auth.id',
  'user = @request.auth.id',
  'user = @request.auth.id',
  'user = @request.auth.id'
);
