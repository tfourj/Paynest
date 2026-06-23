<p align="center">
  <img src="./assets/paynest.png" alt="Paynest logo" width="120" height="120" />
</p>

<h1 align="center">Paynest</h1>

<p align="center">
  A local-first subscription and recurring-payment tracker built with Expo.
</p>

## Features

- Track subscriptions with price, category, billing period, renewal date, and reminder settings.
- View monthly and yearly spending from a focused dashboard.
- Review upcoming renewals and spending insights.
- Save data locally on device with optional PocketBase account sync.
- Merge local and cloud subscriptions when signing in.
- Use local iOS and Android renewal notifications.
- Customize currency, payday settings, subscription icons, colors, and app appearance.
- Keep dark mode preference local to each device.
- Run on iOS, Android, and web from the same Expo codebase.

## Tech Stack

- Expo 53
- React 19
- React Native 0.79
- TypeScript
- PocketBase
- AsyncStorage
- Expo Notifications

## Development

Build and local development instructions live in [docs/BUILD.md](./docs/BUILD.md).

## Project Structure

```text
App.tsx                 App shell, navigation, local state, and sync orchestration
assets/                 App icon and logo source assets
docs/                   Development and build documentation
src/components/         Shared UI components and subscription rows
src/screens/            Dashboard, subscriptions, insights, settings, and editor screens
src/storage.ts          Local AsyncStorage persistence
src/pocketbase.ts       PocketBase REST client and auth persistence
src/sync.ts             PocketBase sync mapping and merge logic
src/types.ts            Shared app types and defaults
pocketbase/             PocketBase setup notes
```

## Credits

- Built with [Expo](https://expo.dev/) and [React Native](https://reactnative.dev/).
- Authentication and cloud sync powered by [PocketBase](https://pocketbase.io/).
- Subscription icon search supports [Simple Icons](https://simpleicons.org/),
  [SVGL](https://svgl.app/), and
  [Dashboard Icons](https://github.com/homarr-labs/dashboard-icons).
- Interface icons use [Ionicons](https://ionic.io/ionicons).

## License

Paynest is licensed under the GNU General Public License v3.0. See [LICENSE](./LICENSE).
