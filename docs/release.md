# Releasing HomeKind

There is no Mac in this project's toolchain (the founder develops on Windows).
Codemagic builds, signs, archives and uploads every TestFlight build from the
`codemagic.yaml` workflow `ios-testflight` at the repository root, and builds,
signs and uploads every Android app bundle from the `android-play` workflow in
the same file. One pushed `v*` tag runs both.

The iOS sections come first; [Android and Google Play](#android-and-google-play)
is further down.

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
   from [`docs/store-listing.md`](store-listing.md), which records what was
   submitted for 1.0 (including the App Review notes Apple asked for).

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

Two things that look like failures and are not:

- **"Another build is in review"** on the publishing step. Apple allows one
  build per version in TestFlight beta review at a time, so every build
  uploaded while an earlier one is still being reviewed fails the final
  submit step with a 422. The build has still uploaded, processed, and is
  already available to the internal TestFlight group. Nothing to fix.
- **"No matching profiles found"** from Codemagic's own automatic signing
  pre-step. That is why `codemagic.yaml` does signing in its explicit
  "Fetch or create signing files" script instead: Apple's actual answer
  (an unregistered bundle id, an unaccepted agreement, a key without App
  Manager access) then shows in the log.

## Submitting a version to the App Store

TestFlight builds never reach the public. To ship a version:

1. In App Store Connect open the version page (for example **1.0 Prepare for
   Submission**), choose the processed build, and check the listing against
   [`docs/store-listing.md`](store-listing.md).
2. Set Version Release to manual if you want to check the live listing
   before it appears, then **Add for Review** and **Submit to App Review**.
3. Review usually takes a day or two. If Apple asks for more information,
   reply in App Store Connect and also paste the answers into the App Review
   Information notes field, so later submissions carry them.
4. After approval, release the version, then tag the released commit:
   `git tag v1.0.0 && git push origin v1.0.0`. The tag records what shipped;
   it also triggers one more Codemagic build, which uploads a new build
   number but changes nothing in the store.

HomeKind 1.0 went live on 3 October 2026 at
<https://apps.apple.com/au/app/homekind/id6816028407>.

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

## Android and Google Play

### Prerequisites

- A Google Play developer account. HomeKind publishes from the **WattKind AI**
  organisation account (Play Console account id `4630259934178381173`). An
  organisation account is not subject to the closed-testing rule that applies
  to personal accounts created since late 2023 (12 testers for 14 days before
  production access), so the path is internal testing, then production review.
- The app's package name is `ai.wattkind.homekind`, the same string as the iOS
  bundle id, set as `appId` in `capacitor.config.ts` and `applicationId` in
  `android/app/build.gradle`. Play fixes it permanently on first upload.

### One-time: the upload keystore

Google Play App Signing holds the key that actually signs what phones install;
we only hold an _upload_ key, used to sign bundles sent to Play. Make it once:

1. On Windows, open a terminal where `keytool` is available (it ships with any
   JDK; Android Studio bundles one under `jbr\bin`). Run:

   ```
   keytool -genkeypair -v -keystore homekind-upload.jks -alias homekind -keyalg RSA -keysize 2048 -validity 10000
   ```

   Use one strong password for both the keystore and the key, and answer the
   name prompts with `WattKind AI`.

2. In Codemagic open **Team settings > Code signing identities > Android
   keystores**, upload `homekind-upload.jks`, enter the password and alias, and
   set the **reference name** to exactly `homekind_upload` — `codemagic.yaml`
   names it under `android_signing`. Codemagic then exports
   `CM_KEYSTORE_PATH`, `CM_KEYSTORE_PASSWORD`, `CM_KEY_ALIAS` and
   `CM_KEY_PASSWORD` to the build, which `android/app/build.gradle` reads.
3. Keep the `.jks` file and its password in the password manager next to the
   iOS certificate key. The repository's `.gitignore` refuses `*.jks` and
   `*.keystore`. If the upload key is ever lost, Play Console has a
   **Request upload key reset** flow under App integrity; it takes a few days
   but the app and its signing key are unaffected.

### One-time: Play Console app record

1. **Create app** in Play Console: name `HomeKind`, default language English
   (Australia), type App, free. A free app cannot later be made paid.
2. Work through the **Dashboard > Set up your app** tasks using
   [`docs/store-listing.md`](store-listing.md) ("Google Play listing" section)
   for every answer: privacy policy URL, app access, ads, content rating,
   target audience, data safety, government apps, financial features, health,
   store listing copy and graphics, and the app category.
3. **App integrity**: accept Play App Signing when the first bundle is
   uploaded (it is the default for new apps). The upload key certificate shown
   there must match `homekind-upload.jks`.

### One-time: let Codemagic upload to Play

Codemagic publishes with a Google Cloud service account that Play Console has
been told to trust.

1. In Google Cloud console, create (or reuse) a project, enable the **Google
   Play Android Developer API**, create a service account named something like
   `codemagic-homekind`, and create a **JSON key** for it. Download it once.
2. In Play Console, **Users and permissions > Invite new users**, enter the
   service account's email address and grant it, for the HomeKind app only,
   **Release to testing tracks** (and **Manage testing tracks** if you want it
   to create the internal release the first time). Admin is not needed.
3. In Codemagic, HomeKind app → **Environment variables**: name
   `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`, value the whole JSON file's contents,
   group `google_play`, tick **Secure**. Delete the downloaded JSON.
4. That is all. Codemagic's publishing step creates the internal-testing
   release itself, including the very first one: HomeKind's first bundle
   (version code 2, 6 October 2026) was published this way with the app
   record already created in Play Console. If a build ever fails at the
   publishing step with "package not found", the app record does not exist
   yet or the service account has not been granted access; fix that rather
   than uploading by hand, and re-run the build.

### Cutting an Android release

The same tag that builds iOS builds Android: `git tag v1.1.0 && git push
origin v1.1.0`, or **Start new build** in Codemagic with the `android-play`
workflow. The workflow runs `npm ci`, lint, typecheck, test, `npm run build`,
`npx cap sync android`, checks the keystore was injected, runs
`./gradlew bundleRelease` with the Codemagic build number as `versionCode`,
prints the permissions in the merged manifest (expect `INTERNET` only), and
uploads the signed `.aab` to the **internal** track, where it is live for
the internal testers list immediately (`submit_as_draft: false`), without
release notes. Nothing reaches the public from Codemagic.

To ship a version to the public:

1. Install the internal-track build on a real Android phone from the Play
   Store (via the internal testers link) and check the release notes'
   features, plus the Android-specific items: the back gesture closes dialogs
   and steps back through screens, the camera and photo picker work, the
   file picker takes a PDF, Back up opens the share sheet and lands in Google
   Drive or Files, Restore reads that zip back, and the keyboard does not
   cover the add-device form.
2. In Play Console, **Production > Create new release**, pick the build from
   the internal track (**Add from library**), paste the release notes, review,
   and **Start rollout to production**. Google's review of a new app can take
   up to about a week; later updates are usually hours. Set the rollout to
   **Managed publishing** under Publishing overview if you want to check the
   listing before it goes live.
3. After it is live, add the Play badge beside the App Store badge on
   <https://wattkind.ai/homekind/> and update the privacy page's backup
   sentence (see [`docs/privacy-statement.md`](privacy-statement.md)); the
   store URL is
   `https://play.google.com/store/apps/details?id=ai.wattkind.homekind`.

### Android versions and build numbers

- `versionName` (user-visible, e.g. `1.0.0`) is read by Gradle from
  `package.json`'s `version`, so it never drifts from Settings > About. iOS
  still takes `MARKETING_VERSION` from the Xcode project; bump both together.
- `versionCode` must strictly increase per Play upload. Codemagic passes its
  build number as `-PHOMEKIND_VERSION_CODE`; it is the same counter the iOS
  workflow writes into `CFBundleVersion`, so the two platforms' build numbers
  match. A local build without the property gets `1`.

### Running the Android app locally (Windows)

Unlike iOS, Android can be built and run on the development machine:
install Android Studio, then `npm run build && npx cap sync android && npx
cap open android` and run on an emulator or a USB-connected phone. The
project in `android/` is committed; only build output, `local.properties`
and the copied web assets are ignored.

### Android permissions and backup

The merged manifest declares `INTERNET` only (the web view needs it to serve
the bundled app from its local origin; HomeKind makes no network calls). The
camera and photo picker go through system intents, so no `CAMERA` or media
permission is requested and Android shows no permission prompts. Attachments
live in the app's private files directory (`Directory.Data`) and the backup
zip is written to the app's cache directory and handed to the share sheet
through the FileProvider Capacitor configures.

`android:allowBackup` is left on, so a phone's Google backup may include
HomeKind's data in the same way iCloud backup does on iPhone; the privacy
statement says so.

## Regenerating the icon and splash screen

The approved source mark is `resources/homekind-mark-original.png` — it is
never redrawn. To regenerate everything derived from it (for example after a
new approved mark is supplied):

```
node scripts/make-icon-sources.mjs
npx capacitor-assets generate --ios --iconBackgroundColor '#FFF6EB' --splashBackgroundColor '#FFF6EB'
npx capacitor-assets generate --android --iconBackgroundColor '#FFF6EB' --splashBackgroundColor '#FFF6EB'
```

The first command writes flat-Cream composites to `resources/` (`icon.png`,
`icon-foreground.png`, `icon-background.png`, `splash.png`,
`splash-dark.png`). The second reads those and writes the actual iOS asset
catalog entries into `ios/App/App/Assets.xcassets`; the third writes the
Android launcher icons (adaptive foreground and background layers plus legacy
PNGs) and splash drawables into `android/app/src/main/res`. Commit the
regenerated files in all three places. The adaptive icon XML insets the
foreground by 16.7%, so the mark at ~78% of the source lands inside Android's
66dp safe circle without a separate, smaller source.

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
