# HomeKind

HomeKind by WattKind AI is a free, local-only iOS app that keeps every household
device's manual, receipt and warranty date on the phone, and tells the household
which warranties are ending soon or have already expired.

**Home support that keeps the paperwork.**

HomeKind 1.0 is on the App Store:
<https://apps.apple.com/au/app/homekind/id6816028407>. The product page is
<https://wattkind.ai/homekind/>.

There is no account, no server and no cloud. Everything a household enters lives
in the app's local database on that phone. Backing up or moving to a new phone is
a plain zip file the person saves themselves, with the share sheet, to iCloud
Drive or Files.

## v1 scope

- Add a device with a name, room, brand, model, purchase date and warranty end
  date.
- Attach a photo or PDF of the receipt and the manual to a device.
- See warranties that are already expired or ending in the next 90 days,
  surfaced first.
- Export a backup zip and import one back in, with a plan shown before anything
  is overwritten.
- Delete a device, an attachment, or everything, with a confirmation.

## Explicitly cut from v1

- No account, sign-in or cloud sync of any kind.
- No push notifications or reminders.
- No AI features — nothing reads, summarises or answers questions about a
  manual.
- No analytics, crash reporting or usage tracking of any kind.
- No iPad-specific layout; the app targets iPhone only.
- No dark mode design.

## What this repository shares with other WattKind AI products

Nothing. HomeKind has its own codebase, its own configuration, its own local
database, its own hosting (none — it ships as an iOS app, not a web service) and
its own secrets. It shares no code, environment variables, database project,
hosting project or credentials with any other WattKind AI product, including
StudyKind. The only thing HomeKind shares with its sibling products is the
WattKind AI brand: the visual identity and tone described in the canonical
brand guide.

## Run locally (Windows or any machine without a Mac)

HomeKind's UI runs as an ordinary Vite web app during development; only the
iOS packaging step needs a Mac (handled by Codemagic — see below).

```
npm ci
npm run dev
```

This opens in your browser (Chrome is the reference target). Native-only
features — the camera, file storage and the system share sheet — fall back to
browser equivalents (a file picker, IndexedDB, a plain download) so the app is
usable end to end without a device or simulator. See `docs/architecture.md`
for how those fallbacks are structured.

## Scripts

| Script               | What it does                                               |
| -------------------- | ---------------------------------------------------------- |
| `npm run dev`        | Start the Vite dev server.                                 |
| `npm run build`      | Type-check and build the production web bundle to `dist/`. |
| `npm run preview`    | Serve the built `dist/` bundle locally.                    |
| `npm run lint`       | ESLint plus a Prettier check.                              |
| `npm run format`     | Apply Prettier formatting.                                 |
| `npm run typecheck`  | `tsc --noEmit`.                                            |
| `npm test`           | Run the Vitest suite once.                                 |
| `npm run test:watch` | Run Vitest in watch mode.                                  |
| `npm run verify`     | Lint, typecheck, test and build, in that order.            |

## Releasing to TestFlight

There is no Mac in this project's toolchain. Codemagic builds, signs and
uploads the iOS app. See [`docs/release.md`](docs/release.md) for the one-time
setup and the steps to cut a release.

## Docs index

- [`docs/architecture.md`](docs/architecture.md) — the data model, module
  contracts and the rules the codebase follows.
- [`docs/release.md`](docs/release.md) — Codemagic and App Store Connect
  setup, and how to cut a release.
- [`docs/store-listing.md`](docs/store-listing.md) — the App Store listing
  copy, App Privacy answers and screenshot set as submitted for 1.0.
- [`docs/privacy-statement.md`](docs/privacy-statement.md) — the public
  privacy statement; the canonical copy is the published page on wattkind.ai.
- [`docs/decisions.md`](docs/decisions.md) — short architecture decision
  records for the choices particular to HomeKind.
