# Paynest

Paynest is a local-first subscription and recurring-payment tracker for iOS, Android, and web.

## Run locally

```sh
npm install
npm run web
```

Use `npm run ios` or `npm run android` to open the native app through Expo.

## Current MVP

- Dashboard with monthly and yearly spending
- Upcoming renewal and subscription lists
- Add subscriptions with billing period and category
- Spending insight breakdown
- Adaptive light and dark appearance

The current app stores data in memory. SQLite sync, authentication, and notifications are planned next as described in `nc_PLAN.md`.
