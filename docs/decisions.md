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

## The page never scrolls; `<main>` does

**Decision:** `capacitor.config.ts` sets `scrollEnabled: false`, so the
WKWebView's own scroll view is off, and the app shell fills the viewport
with `<main>` as the scroll container (`overflow-y: auto`).

**Why:** turning off the web view's scrolling is what removes iOS
rubber-banding and makes the app feel native rather than like a web page.
But with that off, anything that relied on document scrolling freezes
entirely, which is exactly what the first TestFlight build did. Inner overflow
containers still scroll normally, so moving the scrolling inside the page
gives both.

**Rules out:** any screen that depends on `window` or `document` scrolling;
dialogs and the welcome screen scroll themselves the same way.

## pdf.js for viewing PDFs

**Decision:** PDF attachments are rendered page by page to `<canvas>` with
pdf.js (`pdfjs-dist`, legacy build), lazy-loaded, with the worker bundled
from the app itself.

**Why:** WKWebView will render a PDF inside an `<iframe>` but will not scroll
it, even inside a scrollable wrapper, so only the first page was reachable on
a real iPhone. pdf.js draws every page as an ordinary element the page can
scroll. The legacy build is used because the modern build calls
`Map.prototype.getOrInsertComputed`, which current iOS WebKit lacks.

**Rules out:** the iframe viewer; any PDF rendering that fetches fonts or
decoders from a CDN (nothing is fetched; unembedded fonts fall back to system
fonts). Known limit: pdf.js 5 likely needs iOS 16.4 or later; the rest of
the app is unaffected on older phones.

## Explicit signing step and `.xcodeproj` in Codemagic

**Decision:** `codemagic.yaml` fetches or creates the distribution
certificate and App Store profile in a named script step using
`app-store-connect fetch-signing-files` and a private key stored once in
Codemagic as `CERTIFICATE_PRIVATE_KEY`, instead of Codemagic's automatic
`ios_signing` block. `build-ipa` targets `ios/App/App.xcodeproj`, not a
workspace.

**Why:** the automatic signing pre-step aborts the build before any script
runs and reports only "No matching profiles found", hiding Apple's real
answer. The explicit step prints it. Capacitor 8 resolves plugins with Swift
Package Manager, so there is no CocoaPods workspace to build.

**Rules out:** `ios_signing` in `environment`; any `.xcworkspace` path.

## Android from the same Capacitor project

**Decision:** the Android app is the same web bundle in a Capacitor Android
shell, committed under `android/`, with no Android-only code beyond the
platform wrappers in `src/platform/`.

**Why:** everything HomeKind does on iOS (local database, attachment files,
camera, file picker, share sheet, in-app browser) has a Capacitor plugin with
an Android implementation already in the dependency list. Chromium's web view
renders the same CSS, pdf.js and fonts. A second codebase would double the
release work for a single-founder product with nothing platform-specific to
show for it.

**Rules out:** a native Android rewrite, a Compose or Kotlin UI layer, and
any feature that only one platform can have; platform differences stay in
`src/platform/` and in wording (`isAndroid`), never in screens.

## Android back button drives the router

**Decision:** `src/platform/backButton.ts` registers a Capacitor
`backButton` listener on Android that closes an open `<dialog>` first, then
steps the router back, and at the start of history minimises the app.

**Why:** Capacitor's default walks the web view's own history and then exits
the activity. With hash routing that mostly works, but it ignores open
dialogs (back would navigate underneath a confirmation sheet) and it kills
the app at the root where Android users expect it to go to the background.
The decision rule is a pure function with a unit test; the wiring is a few
lines.

**Rules out:** per-screen back handling, and any screen that depends on
`window.history` directly rather than the router.

## Play App Signing with an upload key held in Codemagic

**Decision:** Google holds the app signing key (Play App Signing, the default
for new apps). We hold only an upload keystore, stored once in Codemagic as
the `homekind_upload` signing identity and read by `android/app/build.gradle`
from the `CM_KEYSTORE_*` variables. `versionName` comes from `package.json`;
`versionCode` is Codemagic's build number, the same counter as iOS.

**Why:** it mirrors the iOS arrangement (signing material lives in Codemagic,
never in the repository), a lost upload key is recoverable through Play
Console where a lost app signing key is not, and a single version source
keeps Settings > About, the App Store and Play in agreement.

**Rules out:** a keystore in Git, local signing on the development machine
as the release path, and hand-edited version codes.

## Phones only, portrait only, on Android too

**Decision:** the Android manifest locks `MainActivity` to portrait, and the
Play listing declares no tablet support or tablet screenshots.

**Why:** the same reasoning as iPhone-only on iOS: v1 has one layout, and
landscape or tablet widths would need design work that is not needed to ship
a useful app.

**Rules out:** landscape, tablet screenshots, and Chromebook or foldable
layouts in v1.
