import { Directory, Filesystem } from '@capacitor/filesystem';
import { strFromU8, strToU8, Unzip, UnzipInflate, zipSync, type Zippable } from 'fflate';
import { BackupZip } from '../platform/backupZip';
import { getStorage } from '../storage';
import { attachmentPath, isSafeExt, isSafeId } from '../storage/paths';
import type {
  Attachment,
  AttachmentWriter,
  BackupManifest,
  Device,
  ImportConflict,
  ImportPlan,
} from '../types';
import { APP_VERSION } from '../version';
import { db } from './db';
import { nowIso } from './ids';
import { todayIsoDate } from './warranty';

export const BACKUP_FILENAME_PREFIX = 'homekind-backup-';
const MANIFEST_PATH = 'data.json';

/** A backup zip to read: the picked `File`, or bytes (tests and the browser build). */
export type ZipSource = Blob | Uint8Array;

/**
 * The zip each plan was read from, keyed by plan. Kept outside `ImportPlan` so the
 * plan type stays plain data; `applyImport` only accepts plans made here, and reads
 * the zip a second time rather than keeping every file's bytes in memory.
 */
const planSources = new WeakMap<ImportPlan, { source: ZipSource; chunkSize: number }>();

/** How much of the zip is read at a time. Memory use is a small multiple of this. */
const READ_CHUNK = 1024 * 1024;

export function backupFilename(now: Date = new Date()): string {
  return `${BACKUP_FILENAME_PREFIX}${todayIsoDate(now)}.zip`;
}

function pathOf(a: Attachment): string {
  return attachmentPath(a.deviceId, a.id, a.ext);
}

async function buildManifest(): Promise<BackupManifest> {
  const [devices, attachments] = await Promise.all([
    db.devices.toArray(),
    db.attachments.toArray(),
  ]);
  return {
    format: 'homekind-backup',
    formatVersion: 1,
    exportedAt: nowIso(),
    appVersion: APP_VERSION,
    devices,
    attachments,
  };
}

/**
 * Builds the backup zip in memory. Browser build and tests only: on a phone the
 * attachments and the archive would all sit in the web view at once, and a library of
 * a few hundred megabytes is enough for iOS to kill the web view mid-export.
 * The app uses `exportBackupToCache` there.
 */
export async function exportBackup(): Promise<{ filename: string; bytes: Uint8Array }> {
  const manifest = await buildManifest();
  const { attachments } = manifest;

  const zip: Zippable = { [MANIFEST_PATH]: strToU8(JSON.stringify(manifest, null, 2)) };
  for (const attachment of attachments) {
    try {
      const bytes = await getStorage().read(attachment.deviceId, attachment.id, attachment.ext);
      // Photos and PDFs are already compressed; storing them avoids wasted work.
      zip[pathOf(attachment)] = [bytes, { level: 0 }];
    } catch {
      // A single unreadable file must not block every future backup. The record is
      // still exported, and restoring reports it under `missingFiles`.
    }
  }

  return { filename: backupFilename(), bytes: zipSync(zip) };
}

/** Deletes earlier backup zips from the cache directory; they are only ever shared once. */
async function removeOldBackupsFromCache(): Promise<void> {
  let files: { name: string }[];
  try {
    ({ files } = await Filesystem.readdir({ path: '', directory: Directory.Cache }));
  } catch {
    return;
  }
  for (const file of files) {
    if (file.name.startsWith(BACKUP_FILENAME_PREFIX) && file.name.endsWith('.zip')) {
      try {
        await Filesystem.deleteFile({ path: file.name, directory: Directory.Cache });
      } catch {
        // Leaving a stale zip behind is harmless; a failed export is not.
      }
    }
  }
}

/**
 * Native only. Writes the backup zip to the cache directory and returns its `file://`
 * URI for the share sheet. The zip is built by the native `BackupZip` plugin straight
 * from the files on disk, so neither the attachments nor the archive pass through the
 * web view. Attachments whose file cannot be read are skipped, as in `exportBackup`.
 */
export async function exportBackupToCache(): Promise<{ filename: string; uri: string }> {
  const manifest = await buildManifest();
  const filename = backupFilename();

  const files = [];
  for (const attachment of manifest.attachments) {
    const entry = pathOf(attachment);
    const { uri } = await Filesystem.getUri({ path: entry, directory: Directory.Data });
    files.push({ entry, uri });
  }

  await removeOldBackupsFromCache();
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
  await BackupZip.create({
    output: uri,
    manifest: JSON.stringify(manifest, null, 2),
    files,
  });
  return { filename, uri };
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || isString(value);
}

function isDevice(value: unknown): value is Device {
  const d = value as Record<string, unknown>;
  return (
    typeof d === 'object' &&
    d !== null &&
    isSafeId(d.id) &&
    isString(d.name) &&
    isString(d.room) &&
    isString(d.createdAt) &&
    isString(d.updatedAt) &&
    ['brand', 'model', 'purchaseDate', 'warrantyEndDate'].every((k) => isOptionalString(d[k]))
  );
}

function isAttachment(value: unknown): value is Attachment {
  const a = value as Record<string, unknown>;
  return (
    typeof a === 'object' &&
    a !== null &&
    isSafeId(a.id) &&
    isSafeId(a.deviceId) &&
    (a.kind === 'pdf' || a.kind === 'photo') &&
    isString(a.label) &&
    isString(a.mimeType) &&
    isSafeExt(a.ext) &&
    typeof a.byteSize === 'number' &&
    isString(a.createdAt) &&
    isString(a.updatedAt)
  );
}

function parseManifest(json: string): BackupManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('This backup is damaged: data.json is not valid JSON.');
  }
  const m = raw as Partial<BackupManifest> | null;
  if (typeof m !== 'object' || m === null || m.format !== 'homekind-backup') {
    throw new Error('This file is not a HomeKind backup.');
  }
  if (m.formatVersion !== 1) {
    throw new Error(
      `This backup uses format version ${String(m.formatVersion)}, which this version of HomeKind cannot read.`,
    );
  }
  if (!Array.isArray(m.devices) || !m.devices.every(isDevice)) {
    throw new Error('This backup is damaged: the device list is invalid.');
  }
  if (!Array.isArray(m.attachments) || !m.attachments.every(isAttachment)) {
    throw new Error('This backup is damaged: the attachment list is invalid.');
  }
  const deviceIds = new Set(m.devices.map((d) => d.id));
  if (!m.attachments.every((a) => deviceIds.has(a.deviceId))) {
    throw new Error('This backup is damaged: an attachment belongs to no device.');
  }
  return m as BackupManifest;
}

async function* chunksOf(source: ZipSource, chunkSize: number): AsyncGenerator<Uint8Array> {
  if (ArrayBuffer.isView(source)) {
    for (let i = 0; i < source.length; i += chunkSize) yield source.subarray(i, i + chunkSize);
    return;
  }
  if (typeof source.stream === 'function') {
    const reader = source.stream().getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  }
  // Older web views without Blob.stream: read whole, still hand out bounded chunks.
  yield* chunksOf(new Uint8Array(await blobToArrayBuffer(source)), chunkSize);
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsArrayBuffer(blob);
  });
}

interface ZipEntryHandler {
  /** Return a sink for this entry's bytes, or null to discard them. */
  (name: string): ((chunk: Uint8Array) => Promise<void>) | null;
}

/**
 * Streams through a zip, handing each entry's bytes to the sink chosen by `handler`
 * as they are decompressed. Nothing is kept once a sink has taken it, so memory use
 * stays at a few chunks however large the archive. Resolves with every entry name.
 */
async function readZip(
  source: ZipSource,
  chunkSize: number,
  handler: ZipEntryHandler,
): Promise<string[]> {
  const names: string[] = [];
  let pending: Promise<void> = Promise.resolve();
  let failure: Error | null = null;
  const fail = (error: Error) => {
    failure ??= error;
  };

  const unzip = new Unzip((file) => {
    names.push(file.name);
    const sink = handler(file.name);
    file.ondata = (error, chunk, _final) => {
      if (error) {
        fail(new Error('This file is not a valid zip archive.'));
        return;
      }
      if (sink && chunk.length > 0) {
        const bytes = chunk.slice();
        pending = pending.then(() => sink(bytes)).catch(fail);
      }
    };
    // Every entry is started, wanted or not: fflate keeps the bytes of an entry that
    // was never started, which would pull the whole archive into memory.
    file.start();
  });
  unzip.register(UnzipInflate);

  try {
    for await (const chunk of chunksOf(source, chunkSize)) {
      unzip.push(chunk, false);
      await pending;
      if (failure) throw failure;
    }
    unzip.push(new Uint8Array(0), true);
    await pending;
  } catch (error) {
    if (failure) throw failure;
    if (error instanceof Error && /zip|EOF|compression/i.test(error.message)) {
      throw new Error('This file is not a valid zip archive.');
    }
    throw error;
  }
  if (failure) throw failure;
  // fflate skips bytes that are not a zip entry without complaint.
  if (names.length === 0) throw new Error('This file is not a valid zip archive.');
  return names;
}

/** Reads and validates a backup zip without changing anything. Throws on an invalid file. */
export async function planImport(
  source: ZipSource,
  options: { chunkSize?: number } = {},
): Promise<ImportPlan> {
  const chunkSize = options.chunkSize ?? READ_CHUNK;

  const manifestParts: Uint8Array[] = [];
  const names = await readZip(source, chunkSize, (name) =>
    name === MANIFEST_PATH
      ? async (chunk) => {
          manifestParts.push(chunk);
        }
      : null,
  );
  if (!names.includes(MANIFEST_PATH)) {
    throw new Error('This zip is not a HomeKind backup: data.json is missing.');
  }
  const manifestBytes = new Uint8Array(manifestParts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of manifestParts) {
    manifestBytes.set(part, offset);
    offset += part.length;
  }
  const manifest = parseManifest(strFromU8(manifestBytes));

  const newDevices: Device[] = [];
  const conflicts: ImportConflict[] = [];
  for (const incoming of manifest.devices) {
    const existing = await db.devices.get(incoming.id);
    if (existing) conflicts.push({ incoming, existing });
    else newDevices.push(incoming);
  }

  const present = new Set(names);
  const missingFiles = manifest.attachments.map(pathOf).filter((path) => !present.has(path));

  const plan: ImportPlan = { manifest, newDevices, conflicts, missingFiles };
  planSources.set(plan, { source, chunkSize });
  return plan;
}

/**
 * Merges a planned backup by device id. Conflicting devices are skipped, or with
 * `overwriteConflicts` replaced along with all their attachments. Attachments whose
 * bytes are missing from the zip are not imported. New files are written before the
 * records, and replaced files are removed only after the records commit.
 */
export async function applyImport(
  plan: ImportPlan,
  options: { overwriteConflicts: boolean },
): Promise<{
  devicesAdded: number;
  devicesOverwritten: number;
  devicesSkipped: number;
  attachmentsWritten: number;
}> {
  const zip = planSources.get(plan);
  if (!zip) throw new Error('This import plan was not created by planImport.');

  const overwritten = options.overwriteConflicts ? plan.conflicts.map((c) => c.incoming) : [];
  const devices = [...plan.newDevices, ...overwritten];
  const accepted = new Set(devices.map((d) => d.id));
  const missing = new Set(plan.missingFiles);
  const wanted = new Map<string, Attachment>();
  for (const a of plan.manifest.attachments) {
    if (accepted.has(a.deviceId) && !missing.has(pathOf(a))) wanted.set(pathOf(a), a);
  }

  // Stream every wanted file straight to storage. Files are written before the records
  // so a failure here leaves records untouched, as before.
  const storage = getStorage();
  const written = new Set<string>();
  const open = new Map<string, AttachmentWriter>();
  await readZip(zip.source, zip.chunkSize, (name) => {
    const attachment = wanted.get(name);
    if (!attachment || written.has(name)) return null;
    written.add(name);
    const writer = storage.openWriter(attachment.deviceId, attachment.id, attachment.ext);
    open.set(name, writer);
    return (chunk) => writer.append(chunk);
  });
  for (const writer of open.values()) await writer.close();
  const attachments = [...written].map((name) => wanted.get(name) as Attachment);

  const overwrittenIds = overwritten.map((d) => d.id);
  const replaced = await db.transaction('rw', db.devices, db.attachments, async () => {
    const old = await db.attachments.where('deviceId').anyOf(overwrittenIds).toArray();
    await db.attachments.bulkDelete(old.map((a) => a.id));
    await db.devices.bulkPut(devices);
    await db.attachments.bulkPut(attachments);
    return old;
  });

  const kept = new Set(attachments.map(pathOf));
  for (const attachment of replaced) {
    if (!kept.has(pathOf(attachment))) {
      await storage.delete(attachment.deviceId, attachment.id, attachment.ext);
    }
  }

  return {
    devicesAdded: plan.newDevices.length,
    devicesOverwritten: overwritten.length,
    devicesSkipped: plan.conflicts.length - overwritten.length,
    attachmentsWritten: attachments.length,
  };
}

/** Removes every device, attachment record and stored file. */
export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', db.devices, db.attachments, async () => {
    await db.devices.clear();
    await db.attachments.clear();
  });
  await getStorage().clear();
}
