# Decisions

Short ADR-style records of the choices particular to HomeKind. Each entry is
a decision, the reasoning, and what it rules out — not a running log of every
change.

## Local-only, no accounts

**Decision:** HomeKind has no account system, no sign-in and no server of any
kind. Every record lives in the local database on the phone it was entered
on.

**Why:** the product is a household's own record of its own devices. An
account adds a login flow, a password-reset flow, a server to run and secure,
and a reason to worry about what happens to the data if that server ever
goes away. None of that is needed for a household to keep its own manuals and
warranty dates.

**Rules out:** sync between a household's own devices in v1 (the backup zip
is the manual equivalent), any server-side feature, and any future feature
that needs to identify a person rather than a device.

## No notifications in v1

**Decision:** HomeKind does not send local or push notifications, including
for warranties about to expire.

**Why:** local notifications for warranty dates are a reasonable future
feature, but they add scheduling logic, permission prompts and edge cases
(rescheduling on date edits, time zone changes, notification limits) that are
not needed to ship a useful v1. The ending-soon and expired list on open
already surfaces the same information the moment someone opens the app.

**Rules out:** any `UNUserNotificationCenter` usage, any permission prompt
for notifications, and any "we'll remind you" copy in v1.

## Capacitor Filesystem over OPFS/IndexedDB blobs on native

**Decision:** attachment bytes (receipt and manual files) are written to disk
with `@capacitor/filesystem` in `Directory.Data` on iOS, not stored as blobs
inside the Dexie/IndexedDB database. The web development fallback does use
IndexedDB blobs, because there is no native filesystem in a browser.

**Why:** large binary blobs inside IndexedDB are a known source of iOS
WebKit eviction and performance problems, and a backup is just a file copy
when attachments already live as files on disk. Keeping the database to
metadata only also keeps `data.json` in the backup zip small and easy to
read.

**Rules out:** storing photo or PDF bytes directly in Dexie on native; any
backup format that would need to serialise large blobs into JSON.

## Codemagic over a local Mac

**Decision:** iOS builds, code signing, archiving and TestFlight upload all
happen on Codemagic, not on a local machine.

**Why:** the founder develops on Windows and has no Mac. Codemagic provides
Apple-silicon build machines, App Store Connect API integration and
TestFlight publishing without needing to own or maintain Mac hardware.

**Rules out:** any release step that assumes a local Xcode install, and any
manual `xcodebuild`/`altool` step as the primary release path (Codemagic
automates all of it — see `codemagic.yaml` and `docs/release.md`).

## The dormant `isPremium()` hook

**Decision:** `src/entitlements.ts` exports `isPremium()`, which always
returns `false` in v1, and nothing else in the app reads it yet.

**Why:** a future paid tier (for example, asking questions of an attached
manual) is plausible, and it is cheaper to reserve the single call site now
than to hunt down every place a premium check would need to go later.
Nothing about v1's behaviour, copy or UI depends on this function returning
anything other than `false`.

**Rules out:** any premium UI, paywall, purchase flow or premium-gated
feature in v1.

## Hash routing

**Decision:** the app uses hash-based routing (`react-router-dom`'s
`HashRouter` equivalent), not path-based routing.

**Why:** the app is served from a bundled `dist/` inside the native app (via
Capacitor's local web server) rather than from a real HTTP host with
server-side routing support. Hash routing needs no server configuration and
behaves identically in the Capacitor WebView and in a plain browser during
local development.

**Rules out:** any reliance on server rewrite rules or a catch-all route,
since there is no server.

## fflate for zip

**Decision:** backup export and import use `fflate` to read and write zip
files, rather than a heavier zip library or a hand-rolled format.

**Why:** `fflate` is small, has no native dependencies, and covers exactly
what a backup needs (deflate, store a `data.json` plus a folder of
attachment files, and read them back). A zip is also a format any person can
open and inspect without HomeKind, which matters for a file they are trusted
to keep themselves.

**Rules out:** a proprietary or undocumented backup format, and any backup
library that pulls in a native build step.

## No dark mode design in v1

**Decision:** HomeKind ships one visual theme in v1; there is no dark-mode
palette, and `resources/splash-dark.png` is identical to `resources/splash.png`.

**Why:** the WattKind AI brand guide sets dark-mode direction for products
that already have one, but does not ship a HomeKind-specific dark palette,
and getting the Cream-based brand right in a second theme is real design
work that does not need to block v1's release.

**Rules out:** any `prefers-color-scheme: dark` styling in v1; the app
follows its single light theme regardless of system appearance.
