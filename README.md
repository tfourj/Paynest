<p align="center">
  <img src="./assets/paynest.png" alt="Paynest logo" width="120" height="120" />
</p>

<h1 align="center">Paynest</h1>

<p align="center">
  A free, ad-free subscription tracker for your recurring costs.
</p>

## Overview

Paynest helps you track subscriptions, renewals, and monthly spend.

App supports optional login to Pockebase backend (our or selfhosted) for cross-device sync.

## Features

- Track recurring subscriptions and renewal dates.
- See upcoming renewals at a glance.
- Review spending totals and category insights.
- Set a payday to track costs until your next pay date.
- Store data locally without an account.
- Sync across devices with PocketBase.
- Use your own PocketBase server.
- Enable renewal reminders on iOS and Android.
- Search subscription icons from multiple icon sources.

> [!NOTE]
> Paynest started because I wanted a simple tracker with payday-based
> planning and no paid-only basics.
>
> App was mostly vibecoded, so there may still be bugs.
> Issues and fixes are welcome.

## Development

Build and local development instructions live in [docs/BUILD.md](./docs/BUILD.md).
Project structure notes live in [docs/STRUCTURE.md](./docs/STRUCTURE.md).

## Credits

- Built with [Expo](https://expo.dev/) and
  [React Native](https://reactnative.dev/).
- Authentication and cloud sync use
  [PocketBase](https://pocketbase.io/).
- Subscription icon search supports
  [Simple Icons](https://simpleicons.org/),
  [SVGL](https://svgl.app/), and
  [Dashboard Icons](https://github.com/homarr-labs/dashboard-icons).
- Interface icons use [Ionicons](https://ionic.io/ionicons).

## License

Paynest is licensed under the GNU General Public License v3.0.
See [LICENSE](./LICENSE).
