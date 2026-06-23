# PocketBase

Paynest uses PocketBase for optional email auth and cloud sync.

## App Configuration

Users can enter the PocketBase URL in the app:

```text
Settings -> Account -> Log in/Create account -> PocketBase URL
```

You can also bundle a default URL at build time:

```sh
EXPO_PUBLIC_POCKETBASE_URL=https://your-pocketbase.example.com
```

Paynest stores the selected URL locally on the device.

## Auth Setup

Use PocketBase's built-in `users` auth collection.

Recommended auth settings:

- Enable email/password auth.
- Enable email verification if you want confirmed signup.
- Configure SMTP before using verification or password reset emails.

Paynest calls PocketBase's password auth, request verification, and password reset APIs.

## Collections

Create these collections in PocketBase.

### subscriptions

Type: base collection

Fields:

```text
user                  relation -> users, required, cascade delete
local_id              text, required
name                  text, required
category              text, required
price                 number, required
currency              text, required
billing_period        select, required: Weekly, Monthly, 3 months, 6 months, Yearly
pay_day               number
next_renewal_date     date, required
reminder_enabled      bool
reminder_days         number
reminder_time         text
icon_name             text
icon_label            text
icon_color            text
background_color      text
icon_background_color text
simple_icon_slug      text
icon_provider         text
icon_url              url
icon_source_title     text
created_at            text, required
updated_at            text, required
```

Add a unique index for one subscription per local item per user:

```sql
create unique index idx_subscriptions_user_local_id
on subscriptions (user, local_id);
```

API rules:

```text
List/Search:  user = @request.auth.id
View:         user = @request.auth.id
Create:       user = @request.auth.id
Update:       user = @request.auth.id
Delete:       user = @request.auth.id
```

### settings

Type: base collection

Fields:

```text
user              relation -> users, required, cascade delete
reminders_enabled bool
reminder_days     number
currency          text, required
payday_enabled    bool
payday            number
updated_at        text, required
```

Add a unique index for one settings record per user:

```sql
create unique index idx_settings_user
on settings (user);
```

API rules:

```text
List/Search:  user = @request.auth.id
View:         user = @request.auth.id
Create:       user = @request.auth.id
Update:       user = @request.auth.id
Delete:       user = @request.auth.id
```
