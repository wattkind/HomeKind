# HomeKind — App Store listing

The listing copy, App Privacy answers and screenshots submitted for HomeKind
1.0, which is live at <https://apps.apple.com/au/app/homekind/id6816028407>
(App Store Connect app id 6816028407). Keep this file in step with the
listing when it changes.

## App name

HomeKind

## Subtitle (≤30 characters)

Manuals, receipts, warranties

Character count: 29.

## Promotional text (≤170 characters)

Every device's manual, receipt and warranty date, kept on your phone. No
account, no cloud, nothing to set up.

Character count: 110.

## Description (~150–250 words)

Every home collects manuals, receipts and warranty cards, usually scattered
across drawers, inboxes and old folders. HomeKind gives each device in your
house one place to live: its name, the room it's in, when you bought it, and
when the warranty runs out, alongside a photo of the receipt and a copy of
the manual.

Open the app and you'll see straight away which warranties are ending in the
next ninety days or have already lapsed, so nothing quietly expires
unnoticed. Add a device in a minute or two. Attach a photo you've already
got, or take one on the spot. Everything sits together, searchable by room or
by name.

HomeKind keeps everything on your phone. There's no account to create, no
cloud storage and nothing sent anywhere else. When you want a backup, or
you're moving to a new phone, export a single zip file and save it wherever
you keep important files — iCloud Drive or the Files app both work well.
Bring it back in later and HomeKind shows you what's new before anything is
changed.

It's a small, calm tool for ordinary household admin: the kind of thing that
matters when the dishwasher finally breaks and you're glad you kept the
receipt.

Word count: 206.

## Keywords (≤100 characters, comma-separated)

manuals,receipts,warranty,warranties,appliance,home,household,inventory,expiry,device,documents

Character count: 95.

## Category

- Primary: Utilities
- Secondary: Productivity

## Age rating

4+ — no objectionable content of any kind, no user-generated content, no
web access beyond the device's own share sheet and file pickers.

## Support and privacy URLs

- Support URL: `https://wattkind.ai/homekind/`
- Marketing URL: `https://wattkind.ai/homekind/`
- Privacy policy URL: `https://wattkind.ai/homekind/privacy/` — source
  paragraph in [`docs/privacy-statement.md`](privacy-statement.md).

## App Privacy (nutrition label) answers

Answer **Data Not Collected** for every category. Reasoning to keep on file
alongside the submission:

- HomeKind makes no network calls anywhere in the app. There is no server,
  no backend, no analytics SDK and no crash reporter.
- All device records and attachment files stay in the app's local database
  and local file storage on the phone.
- The only data leaving the app is a backup zip the person explicitly
  exports themselves via the system share sheet, to a destination they
  choose (for example iCloud Drive or Files). That is the person moving
  their own data at their own instruction, not collection by HomeKind or by
  WattKind AI.
- There is no account, sign-in, or any identifier tied to a person across
  sessions or devices.

## Screenshots

The submitted 6.9" set (1320×2868) is in [`docs/store-screenshots/`](store-screenshots/),
in upload order: devices list, device detail with attachments, warranties,
add/edit form, settings, welcome. They are genuine renders of the built app
with fictional sample data, captured in headless Chromium at a 440×956 CSS
viewport at 3× (`isMobile`, fonts loaded, `main.scrollTop = 0`). Apple
scales the 6.9" set for smaller phones, so no 6.5" set was uploaded.

Both sets are produced by `scripts/store-screenshots.mjs` (`npm run build`,
then `node scripts/store-screenshots.mjs ios` or `android`), which seeds the
sample data through the app's own Restore flow and needs Google Chrome or a
Chromium path in `HOMEKIND_CHROMIUM`. The warranty dates in the sample data
are relative to the day it runs, so the pills always read as in the 1.0 set.

Required device sizes if regenerating:

- 6.9" display: 1320×2868 or 1290×2796
- 6.5" display (optional): 1284×2778 or 1242×2688

No iPad screenshots are required. HomeKind targets iPhone only — confirm the
Xcode target's device family is set to iPhone only (`TARGETED_DEVICE_FAMILY
= "1"` in `ios/App/App.xcodeproj/project.pbxproj`) before submission; see the
"Mark the app iPhone-only" step in [`docs/release.md`](release.md).

## App Review notes (kept in App Review Information)

Apple's first review of a new developer account asked for extra information
(Guideline 2.1, "Information Needed"). The answers below live in the App
Review Information notes field in App Store Connect so later submissions do
not trigger the same request; keep them current.

- **Purpose:** a simple record-keeping app for household appliances and
  devices, so the manual, receipt and warranty date for each one is in one
  place when something breaks. For homeowners and renters.
- **Setup:** none. No login, account or sample files; every feature is
  available on first launch after "Get started".
- **External services:** none. No backend, data provider, authentication,
  payment, analytics or AI service. The only outbound link is the privacy
  statement on wattkind.ai, opened in an in-app browser sheet.
- **Regional differences:** none. Identical in every region; English
  (Australia) text.
- **Regulated industry or protected content:** none.
- A screen recording from a physical iPhone showing launch, adding a device,
  attaching a photo and a PDF, the Warranties tab, and Settings > Back up was
  supplied with the first submission.

## Google Play listing

The listing as submitted for the Android release, live since 11 October 2026
at <https://play.google.com/store/apps/details?id=ai.wattkind.homekind>
(organisation account **WattKind AI**, account id `4630259934178381173`,
package `ai.wattkind.homekind`). Keep this in step with the console when it
changes.
Where Play asks the same question as Apple, the answer is the same as above.

### App name (≤30 characters)

HomeKind

### Short description (≤80 characters)

Manuals, receipts and warranty dates, kept on your phone.

Character count: 55.

### Full description (≤4000 characters)

Same text as the App Store description above, with one line changed for the
platform: "iCloud Drive or the Files app both work well" becomes "Google Drive
or your phone's Files app both work well". Play renders plain paragraphs; no
formatting is used.

### Category and tags

- App category: **House & Home**
- Tags: Home improvement, Productivity

### Contact details

- Email: `support@wattkind.ai`
- Website: `https://wattkind.ai/homekind/`
- Privacy policy: `https://wattkind.ai/homekind/privacy/`

### Graphics

- App icon: 512×512 PNG, exported from `resources/icon.png` (mark on flat
  Cream, no transparency). Play applies its own rounded mask.
- Feature graphic (required): 1024×500 PNG,
  `docs/store-screenshots/android/feature-graphic.png` — the approved
  HomeKind lockup on Cream, nothing redrawn.
- Phone screenshots (2 to 8, 16:9 or 9:16, each side 320–3840 px):
  `docs/store-screenshots/android/`, 1080×1920, the same six screens in the
  same order as the iOS set, rendered from the built app with the same
  fictional sample data. No 7" or 10" tablet screenshots: HomeKind targets
  phones only, and the listing declares no tablet support.

### Declarations ("Set up your app")

- **App access:** all functionality is available without special access. No
  login, no demo account.
- **Ads:** no, the app contains no ads.
- **Content rating (IARC questionnaire):** category Utility, Productivity,
  Communication or Other; answer no to every content question. Expected
  rating: Everyone / PEGI 3.
- **Target audience and content:** age group **18 and over** only. HomeKind is
  household admin for the adults in a home, not a product for children, and
  choosing only adults keeps it out of the Families policy. "Appeal to
  children": no.
- **News app:** no. **COVID-19 contact tracing or status:** no.
- **Data safety:** does the app collect or share any user data: **No**. Every
  category stays unchecked. Reasoning is the same as the App Privacy answers
  above: no network calls, no server, no analytics, no crash reporting, no
  identifiers; the backup zip is the person moving their own data through the
  system share sheet to a destination they choose. Data is not transferred,
  so "encrypted in transit" is not applicable. Users can delete all data
  in-app (Settings > Delete everything) without any account.
- **Government apps:** no. **Financial features:** none. **Health:** no
  health features.
- **Advertising ID:** the app does not use it (it links no ads or analytics
  SDK; the merged manifest carries no `AD_ID` permission).

### Review notes

Play rarely asks, but if a reviewer requests information, reuse the App
Review notes above: purpose, no setup, no external services, no regional
differences, nothing regulated.

### Release notes (first Android release)

First release of HomeKind for Android. Keep every device's manual, receipt
and warranty date on your phone, see which warranties are ending soon, and
back everything up to a single zip file. No account, no cloud.
