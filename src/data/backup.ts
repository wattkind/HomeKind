import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { getStorage } from '../storage';
import { attachmentPath, isSafeExt, isSafeId } from '../storage/paths';
import type { Attachment, BackupManifest, Device, ImportConflict, ImportPlan } from '../types';
import { APP_VERSION } from '../version';
import { db } from './db';
import { nowIso } from './ids';
import { todayIsoDate } from './warranty';

export const BACKUP_FILENAME_PREFIX = 'homekind-backup-';
const MANIFEST_PATH = 'data.json';

/**
 * File bytes unzipped by `planImport`, keyed by plan. Kept outside `ImportPlan` so
 * the plan type stays plain data; `applyImport` only accepts plans made here.
 */
const planFiles = new WeakMap<ImportPlan, Map<string, Uint8Array>>();

export function backupFilename(now: Date = new Date()): string {
  return `${BACKUP_FILENAME_PREFIX}${todayIsoDate(now)}.zip`;
}

function pathOf(a: Attachment): string {
  return attachmentPath(a.deviceId, a.id, a.ext);
}

export async function exportBackup(): Promise<{ filename: string; bytes: Uint8Array }> {
  const [devices, attachments] = await Promise.all([
    db.devices.toArray(),
    db.attachments.toArray(),
  ]);
  const manifest: BackupManifest = {
    format: 'homekind-backup',
    formatVersion: 1,
    exportedAt: nowIso(),
    appVersion: APP_VERSION,
    devices,
    attachments,
  };

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

/** Reads and validates a backup zip without changing anything. Throws on an invalid file. */
export async function planImport(zipBytes: Uint8Array): Promise<ImportPlan> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch {
    throw new Error('This file is not a valid zip archive.');
  }
  const manifestBytes = entries[MANIFEST_PATH];
  if (!manifestBytes) {
    throw new Error('This zip is not a HomeKind backup: data.json is missing.');
  }
  const manifest = parseManifest(strFromU8(manifestBytes));

  const newDevices: Device[] = [];
  const conflicts: ImportConflict[] = [];
  for (const incoming of manifest.devices) {
    const existing = await db.devices.get(incoming.id);
    if (existing) conflicts.push({ incoming, existing });
    else newDevices.push(incoming);
  }

  const files = new Map<string, Uint8Array>();
  const missingFiles: string[] = [];
  for (const attachment of manifest.attachments) {
    const path = pathOf(attachment);
    const bytes = entries[path];
    if (bytes) files.set(path, bytes);
    else missingFiles.push(path);
  }

  const plan: ImportPlan = { manifest, newDevices, conflicts, missingFiles };
  planFiles.set(plan, files);
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
  const files = planFiles.get(plan);
  if (!files) throw new Error('This import plan was not created by planImport.');

  const overwritten = options.overwriteConflicts ? plan.conflicts.map((c) => c.incoming) : [];
  const devices = [...plan.newDevices, ...overwritten];
  const accepted = new Set(devices.map((d) => d.id));
  const attachments = plan.manifest.attachments.filter(
    (a) => accepted.has(a.deviceId) && files.has(pathOf(a)),
  );

  const storage = getStorage();
  for (const attachment of attachments) {
    const bytes = files.get(pathOf(attachment)) as Uint8Array;
    await storage.write(attachment.deviceId, attachment.id, attachment.ext, bytes);
  }

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
