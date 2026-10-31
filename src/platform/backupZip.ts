import { registerPlugin } from '@capacitor/core';

export interface BackupZipEntry {
  /** Path inside the zip, e.g. `attachments/<deviceId>/<attachmentId>.<ext>`. */
  entry: string;
  /** `file://` URI of the file on disk, from `Filesystem.getUri`. */
  uri: string;
}

export interface BackupZipCreateOptions {
  /** `file://` URI to write the zip to. Replaced if it exists. */
  output: string;
  /** Contents of `data.json`, written as the first entry. */
  manifest: string;
  /** Files to store after the manifest. A file that cannot be read is skipped. */
  files: BackupZipEntry[];
}

export interface BackupZipCreateResult {
  /** Entries that were skipped because their file could not be read. */
  skipped: string[];
}

/**
 * Builds a backup zip natively, streaming each file from disk, so the web view never
 * holds the attachments or the archive in memory. iOS: `ios/App/App/BackupZipPlugin.swift`;
 * Android: `android/.../BackupZipPlugin.java`. Both write store-only (uncompressed)
 * entries, which is what the export did already: photos and PDFs do not compress.
 */
export interface BackupZipPlugin {
  create(options: BackupZipCreateOptions): Promise<BackupZipCreateResult>;
}

export const BackupZip = registerPlugin<BackupZipPlugin>('BackupZip', {
  // The browser build (development only) zips in memory; see `exportBackup`.
  web: () => ({
    create: () => Promise.reject(new Error('Native backups are not available in a browser.')),
  }),
});
