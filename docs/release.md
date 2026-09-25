# Releasing HomeKind

There is no Mac in this project's toolchain (the founder develops on Windows).
Codemagic builds, signs, archives and uploads every TestFlight build from the
`codemagic.yaml` workflow `ios-testflight` at the repository root.

## Prerequisites

- An Apple Developer Program account (individual or organisation), enrolled
  and current. This is required before any of the App Store Connect steps
  below can be done, and before Codemagic can create signing certificates and
  provisioning profiles for `ai.wattkind.homekind`.

## One-time Codemagic setup

1. Add the app: in the Codemagic dashboard, add a new application from this
   GitHub repository.
2. Connect App Store Connect: **Team settings > Integrations > App Store
   Connect**, add a new integration using an App Store Connect API key (a
   `.p8` file, its Key ID and the account's Issuer ID, generated in App Store
   Connect under **Users and Access > Integrations > App Store Connect API**).
   Name the integration **exactly** `HomeKind` — `codemagic.yaml` references
   it by that name under `integrations.app_store_connect`. Codemagic stores
   the key; it never lives in this repository.
3. iOS code signing: the workflow's "Fetch or create signing files" step
   asks App Store Connect for the distribution certificate and App Store
   provisioning profile for `ai.wattkind.homekind`, creating them if they do
   not exist. Creating a certificate needs a private key that Codemagic
   keeps, never the repository. Make one once:
   - On Windows, open Git Bash (installed with Git) and run
     `openssl genrsa 2048`. Copy the whole output, from the `-----BEGIN`
     line to the `-----END` line inclusive.
   - In Codemagic open the HomeKind app → **Environment variables**. Name
     `CERTIFICATE_PRIVATE_KEY`, paste the key as the value, group
     `ios_signing`, tick **Secure**. Add.
   - Keep a copy of the key somewhere safe (a password manager). If it is
     lost, revoke the certificate in the Apple Developer portal and make a
     new key; the step will create a fresh certificate.
     Apple allows only a few distribution certificates per team, so use the
     same key every build rather than generating a new one each time.
4. Apple agreements: the App Store Connect API refuses to create
   certificates or profiles until the Account Holder has accepted the
   current Program License Agreement (developer.apple.com → Account) and the
   free-apps agreement is Active (App Store Connect → Business, or
   Agreements, Tax, and Banking). An unaccepted agreement shows up in
   Codemagic as "No matching profiles found".

## One-time App Store Connect setup

1. Create the app record: **Apps > +** in App Store Connect.
   - Bundle ID: `ai.wattkind.homekind` (register this bundle identifier
     first under **Certificates, Identifiers & Profiles** if it does not
     already exist).
   - Name: `HomeKind`.
   - Primary language: English (Australia).
2. Mark the app iPhone-only: in App Store Connect this follows from the
   binary itself — `TARGETED_DEVICE_FAMILY` is already set to `"1"`
   (iPhone only) in `ios/App/App.xcodeproj/project.pbxproj`, so no iPad
   screenshots or iPad support are requested. Confirm this stayed set to `1`
   for both Debug and Release if the Xcode project is ever regenerated
   (`npx cap add ios` again would reset it).
3. Fill in the App Privacy questionnaire and the rest of the store listing
   using [`docs/store-listing.md`](store-listing.md) as the draft source —
   it is marked for founder review before anything is submitted.

## Cutting a release

Either:

- Push a tag matching `v*`: `git tag v1.0.0 && git push --tags`. The
  `ios-testflight` workflow triggers automatically on any pushed tag matching
  `v*` (see `triggering` in `codemagic.yaml`).
- Or start a build manually from the Codemagic dashboard: **Start new
  build**, select the `ios-testflight` workflow.

Either way the workflow runs `npm ci`, lint, typecheck, test, `npm run
build`, `npx cap sync ios`, resolves signing profiles, sets the build number,
builds and archives the `.ipa`, and uploads it to TestFlight
(`submit_to_testflight: true`, `submit_to_app_store: false` — nothing goes to
public review automatically).

## Versions and build numbers

- `CFBundleShortVersionString` (the user-visible version, e.g. `1.0.0`) comes
  from `MARKETING_VERSION` in `ios/App/App.xcodeproj/project.pbxproj`. Bump
  this by hand for a version change (and update `package.json`'s `version`,
  which `src/version.ts` shows in Settings > About).
- `CFBundleVersion` (the build number, which must be unique per TestFlight
  upload) is set automatically on every Codemagic build. The `Set build
number from Codemagic build number` script runs `agvtool new-version -all
"$BUILD_NUMBER"` inside `ios/App`, where `$BUILD_NUMBER` is Codemagic's own
  monotonically increasing build counter for the workflow. Nobody needs to
  bump this by hand.

## Regenerating the icon and splash screen

The approved source mark is `resources/homekind-mark-original.png` — it is
never redrawn. To regenerate everything derived from it (for example after a
new approved mark is supplied):

```
node scripts/make-icon-sources.mjs
npx capacitor-assets generate --ios --iconBackgroundColor '#FFF6EB' --splashBackgroundColor '#FFF6EB'
```

The first command writes flat-Cream composites to `resources/` (`icon.png`,
`icon-foreground.png`, `icon-background.png`, `splash.png`,
`splash-dark.png`). The second reads those and writes the actual iOS asset
catalog entries into `ios/App/App/Assets.xcassets`. Commit the regenerated
files in both `resources/` and `ios/App/App/Assets.xcassets`.

## What `PrivacyInfo.xcprivacy` declares, and why

`ios/App/App/PrivacyInfo.xcprivacy` is Apple's required privacy manifest. It
declares:

- `NSPrivacyTracking`: `false` — HomeKind does not track users or devices
  across apps or websites.
- `NSPrivacyTrackingDomains`: empty — there is nothing to list.
- `NSPrivacyCollectedDataTypes`: empty — HomeKind collects no data from the
  person, because nothing it stores ever leaves the device.
- `NSPrivacyAccessedAPITypes`: three entries, one for each "required reason"
  API category the bundled Capacitor plugins actually touch, each with the
  narrowest reason code that fits:
  - File timestamp APIs (`C617.1`) — `@capacitor/filesystem` reads file
    modification/creation dates as an ordinary part of reading and writing
    attachment files on the device; this is app-functionality use, not
    analytics.
  - `UserDefaults` (`CA92.1`) — Capacitor's runtime reads a small amount of
    its own configuration from `UserDefaults` on launch; this is
    app-functionality use of data the app itself wrote.
  - Disk space APIs (`E174.1`) — the filesystem plugin checks available disk
    space before writing an attachment or a backup file, to fail cleanly
    rather than write a truncated file.

This file is wired into the Xcode project as a resource of the `App` target
in `ios/App/App.xcodeproj/project.pbxproj` (a `PBXFileReference`, a
`PBXBuildFile` and an entry in the target's Resources build phase), so it is
bundled into every build automatically. If the Xcode project is ever
regenerated from scratch with `npx cap add ios`, re-add this file the same
way and re-verify its entries are still present.

## App Privacy answers to submit

In App Store Connect's App Privacy section, answer **Data Not Collected** —
HomeKind does not collect any data from users. See
[`docs/store-listing.md`](store-listing.md) for the full reasoning to record
alongside that answer.
