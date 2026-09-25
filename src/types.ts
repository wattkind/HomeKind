/**
 * HomeKind data model.
 *
 * Every record has a stable UUID v4 `id` plus ISO 8601 `createdAt` / `updatedAt`
 * strings. Nothing here is derived or denormalised: warranty status, sort order
 * and the like are computed at read time (see `src/data/warranty.ts`) so that a
 * future sync layer can be added without touching the stored shape.
 */

/** An ISO 8601 calendar date, `YYYY-MM-DD`, with no time component. */
export type IsoDate = string;

/** An ISO 8601 timestamp, e.g. `2026-09-25T02:14:00.000Z`. */
export type IsoTimestamp = string;

export interface Device {
  id: string;
  name: string;
  /** Free text. Suggested from rooms already in use. Empty string when unset. */
  room: string;
  brand?: string;
  model?: string;
  purchaseDate?: IsoDate;
  warrantyEndDate?: IsoDate;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export type AttachmentKind = 'pdf' | 'photo';

export interface Attachment {
  id: string;
  deviceId: string;
  kind: AttachmentKind;
  /** User-facing label, e.g. "Manual", "Receipt", or the original file name. */
  label: string;
  /** MIME type, e.g. `application/pdf` or `image/jpeg`. */
  mimeType: string;
  /** File extension without the dot, e.g. `pdf`, `jpg`. */
  ext: string;
  /** Size in bytes at the time it was stored. */
  byteSize: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export type WarrantyStatus = 'none' | 'active' | 'ending-soon' | 'expired';

/** Days ahead that count as "ending soon". */
export const ENDING_SOON_DAYS = 90;

/**
 * Storage adapter for attachment bytes.
 *
 * Native: `@capacitor/filesystem` in `Directory.Data` at
 * `attachments/<deviceId>/<attachmentId>.<ext>`.
 * Web (development fallback): blobs in a separate IndexedDB store.
 * Tests: an in-memory fake.
 *
 * The adapter deals only in bytes and paths; record metadata lives in Dexie.
 */
export interface AttachmentStorage {
  write(deviceId: string, attachmentId: string, ext: string, data: Uint8Array): Promise<void>;
  read(deviceId: string, attachmentId: string, ext: string): Promise<Uint8Array>;
  delete(deviceId: string, attachmentId: string, ext: string): Promise<void>;
  /** Remove every file for a device (used when the device is deleted). */
  deleteAllForDevice(deviceId: string): Promise<void>;
  /** Remove every stored file (used by "delete all data" and by restore-with-replace). */
  clear(): Promise<void>;
}

/** Shape of `data.json` inside a backup zip. */
export interface BackupManifest {
  format: 'homekind-backup';
  formatVersion: 1;
  exportedAt: IsoTimestamp;
  appVersion: string;
  devices: Device[];
  attachments: Attachment[];
}

/** One device from a backup that would overwrite an existing device with the same id. */
export interface ImportConflict {
  incoming: Device;
  existing: Device;
}

export interface ImportPlan {
  manifest: BackupManifest;
  newDevices: Device[];
  conflicts: ImportConflict[];
  /** Attachments in the zip whose file bytes are missing or unreadable. */
  missingFiles: string[];
}
