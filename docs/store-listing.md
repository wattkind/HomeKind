# HomeKind — App Store listing (draft)

Draft copy for the App Store Connect listing. Founder review required before
submission — nothing here has been checked against the current App Store
Connect form fields or character limits enforced at submission time beyond
the counts noted below.

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

- Support URL: to be confirmed by founder.
- Privacy policy URL: `https://wattkind.ai/homekind/privacy` — draft content
  is in [`docs/privacy-statement.md`](privacy-statement.md), also marked for
  founder review.

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

Required device sizes (generate from the built app; not produced by this
work package):

- 6.9" display: 1320×2868 or 1290×2796
- 6.5" display: 1284×2778 or 1242×2688

No iPad screenshots are required. HomeKind targets iPhone only — confirm the
Xcode target's device family is set to iPhone only (`TARGETED_DEVICE_FAMILY
= "1"` in `ios/App/App.xcodeproj/project.pbxproj`) before submission; see the
"Mark the app iPhone-only" step in [`docs/release.md`](release.md).
