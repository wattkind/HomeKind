# HomeKind architecture

HomeKind v1 is a local-only React app wrapped in Capacitor for iOS and Android. There is no server,
no account and no network call anywhere in the app.

```
src/
  main.tsx              entry; imports styles/tokens.css and styles/base.css
  App.tsx               router + app shell (first-run gate, bottom nav)
  types.ts              the data model and adapter interfaces (read this first)
  entitlements.ts       dormant isPremium() hook, always false in v1
  version.ts            APP_VERSION from package.json
  styles/               tokens.css (brand custom properties), base.css (reset, fonts, focus)
  data/                 Dexie database and all record logic (no React)
  storage/              AttachmentStorage adapters: native filesystem, web IndexedDB, memory
  platform/             thin wrappers over Capacitor plugins with browser fallbacks; backButton.ts
                        gives Android's back gesture the same router and dialogs
  screens/              one file per screen
  components/           shared UI pieces; PdfPages.tsx renders PDFs with pdf.js (legacy build,
                        lazy-loaded, worker bundled locally) because WKWebView cannot scroll a PDF in an iframe
tests/                  Vitest, data layer only (no UI snapshots)
public/fonts            Nunito and Inter variable TTFs, bundled (no CDN)
public/brand            approved HomeKind PNG artwork (never redrawn)
resources/              source mark for @capacitor/assets icon and splash generation
ios/                    Capacitor iOS project (generated, committed without Pods); App/BackupZipPlugin.swift
                        and App/BridgeViewController.swift are hand-written and registered on Main.storyboard
android/                Capacitor Android project (generated, committed without build output);
                        BackupZipPlugin.java is hand-written and registered in MainActivity
```

## Module contracts

These are the public surfaces the layers agree on. Keep them stable.

### `src/data/db.ts`

```ts
export class HomeKindDB extends Dexie {
  devices: Table<Device, string>;
  attachments: Table<Attachment, string>;
}
export const db: HomeKindDB;
```

Indexes: `devices` by `id, name, room, warrantyEndDate, updatedAt`;
`attachments` by `id, deviceId, updatedAt`.

### `src/data/devices.ts`

```ts
export type DeviceInput = Omit<Device, 'id' | 'createdAt' | 'updatedAt'>;
export function createDevice(input: DeviceInput): Promise<Device>;
export function updateDevice(id: string, patch: Partial<DeviceInput>): Promise<Device>;
export function getDevice(id: string): Promise<Device | undefined>;
export function listDevices(): Promise<Device[]>; // unsorted; sort with warranty.ts
export function deleteDevice(id: string): Promise<void>; // removes attachments + files too
export function listRooms(): Promise<string[]>; // distinct, non-empty, sorted, for suggestions
```

### `src/data/attachments.ts`

```ts
export interface NewAttachment {
  deviceId: string;
  kind: AttachmentKind;
  label: string;
  mimeType: string;
  ext: string;
  data: Uint8Array;
}
export function addAttachment(input: NewAttachment): Promise<Attachment>;
export function listAttachments(deviceId: string): Promise<Attachment[]>;
export function readAttachmentBytes(attachment: Attachment): Promise<Uint8Array>;
export function deleteAttachment(id: string): Promise<void>;
```

### `src/data/warranty.ts` (pure functions, fully unit-tested)

```ts
export function warrantyStatus(
  device: Pick<Device, 'warrantyEndDate'>,
  today: Date,
): WarrantyStatus;
export function daysUntilWarrantyEnd(
  device: Pick<Device, 'warrantyEndDate'>,
  today: Date,
): number | null;
export function sortDevices(devices: Device[], today: Date): Device[];
// ending-soon first (soonest first), then expired, then everything else alphabetically
export function endingSoonOrExpired(devices: Device[], today: Date): Device[];
export function addYearsToIsoDate(date: IsoDate, years: number): IsoDate;
export function todayIsoDate(now?: Date): IsoDate; // local calendar date
```

Definitions: `expired` when `warrantyEndDate < today`; `ending-soon` when
`today <= warrantyEndDate <= today + 90 days`; `active` otherwise; `none` when unset.

### `src/data/backup.ts`

```ts
export const BACKUP_FILENAME_PREFIX = 'homekind-backup-'; // + YYYY-MM-DD + .zip
export function backupFilename(now?: Date): string;
export function exportBackup(): Promise<{ filename: string; bytes: Uint8Array }>; // browser and tests
export function exportBackupToCache(): Promise<{ filename: string; uri: string }>; // native
export function planImport(source: Blob | Uint8Array): Promise<ImportPlan>; // throws on invalid zip
export function applyImport(
  plan: ImportPlan,
  options: { overwriteConflicts: boolean },
): Promise<{
  devicesAdded: number;
  devicesOverwritten: number;
  devicesSkipped: number;
  attachmentsWritten: number;
}>;
export function deleteAllData(): Promise<void>;
```

Zip layout: `data.json` (a `BackupManifest`) plus `attachments/<deviceId>/<attachmentId>.<ext>`,
all stored uncompressed. Import merges by device id. Conflicts are surfaced in the plan; the UI
asks before overwriting. Overwriting a device replaces its record and its attachments.

Nothing in this module may hold a whole library in memory. On a phone the web view is killed,
silently, once an export or restore needs more than roughly a gigabyte, which a library of a
couple of hundred megabytes reaches when every file is loaded, zipped and base64-encoded at
once. So on native the zip is built by the `BackupZip` plugin (`src/platform/backupZip.ts`)
straight from the files on disk, and `planImport`/`applyImport` stream the picked zip through
fflate's `Unzip`, writing each attachment in pieces through `AttachmentStorage.openWriter`.
`exportBackup` keeps the in-memory path for the browser build and the tests, and both paths
produce the same archive.

### `src/storage/index.ts`

```ts
export const storage: AttachmentStorage; // native on iOS, IndexedDB blobs in a browser
export function createMemoryStorage(): AttachmentStorage; // for tests
export function setStorageForTesting(s: AttachmentStorage): void;
```

Data modules must call `storage` via this module so tests can swap in memory storage.

### `src/platform/`

```ts
// share.ts
export function shareFile(filename: string, bytes: Uint8Array, mimeType: string): Promise<boolean>;
// native: write to Directory.Cache then Share.share({ files }); web: trigger a download
export function shareUri(filename: string, uri: string): Promise<boolean>;
// native: Share.share({ files }) for a file already on disk. Both resolve false when the share
// sheet was dismissed, so the UI never reports a backup that went nowhere.
// backupZip.ts
export const BackupZip: { create(options: BackupZipCreateOptions): Promise<{ skipped: string[] }> };
// native plugin: streams `files` from disk into a store-only zip at `output`, `data.json` first
// camera.ts
export function takeOrPickPhoto(
  source: 'camera' | 'library',
): Promise<{ bytes: Uint8Array; mimeType: string; ext: string } | null>;
// native: @capacitor/camera; web: <input type="file" accept="image/*">
// files.ts
export function pickFile(accept: string): Promise<File | null>; // <input type="file">
// browser.ts
export function openExternal(url: string): Promise<void>; // @capacitor/browser; web: window.open
// runtime.ts
export const isNative: boolean; // Capacitor.isNativePlatform()
export const platform: 'ios' | 'android' | 'web';
export const isAndroid: boolean; // only for platform-specific wording
// backButton.ts
export function decideBackAction(input: { hasOpenDialog: boolean; atRoot: boolean }): BackAction;
export function installBackButtonHandler(goBack: () => void): void; // Android only; no-op elsewhere
```

## Scrolling

The document never scrolls. `html`, `body` and `#root` are fixed at viewport
height; the shell is a column flexbox and `<main>` is the scroll container.
On iOS `scrollEnabled: false` in `capacitor.config.ts` turns off the web view's
own scroll view (no rubber-banding); inner overflow containers still scroll.
Android's Chromium web view has no equivalent setting and needs none: the same
`<main>` container scrolls and the page itself never does.
See `docs/decisions.md`.

## Rules

- No network calls. No CDN fonts, analytics, crash reporting, update checks or remote config.
- No blobs in Dexie on native; attachment bytes go through `storage`.
- No computed fields stored on records.
- Nothing references premium except `entitlements.ts`.
- Nothing references StudyKind, Supabase, Vercel or Anthropic.
