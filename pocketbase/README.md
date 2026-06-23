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

## Collection Import Setup

Use the collection import file in this folder to create the Paynest app collections.

Open PocketBase admin:

```text
Collections -> Import collections
```

Import:

```text
pocketbase/paynest.collections.json
```

You can regenerate the import file from the repo root with:

```sh
npm run pb:collections
```

You can validate the import file with:

```sh
npm run pb:validate
```

To validate your live PocketBase setup, export collections from the PocketBase admin UI, save the
exported JSON locally, then run:

```sh
node pocketbase/validate-collections.mjs /path/to/exported.collections.json
```