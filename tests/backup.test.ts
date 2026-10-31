import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { addAttachment, readAttachmentBytes } from '../src/data/attachments';
import {
  applyImport,
  backupFilename,
  deleteAllData,
  exportBackup,
  planImport,
} from '../src/data/backup';
import { db } from '../src/data/db';
import { createDevice, updateDevice } from '../src/data/devices';
import { createMemoryStorage, setStorageForTesting } from '../src/storage';
import type { Attachment, Device } from '../src/types';

beforeEach(async () => {
  await db.delete();
  await db.open();
  setStorageForTesting(createMemoryStorage());
});

const allBytes = Uint8Array.from({ length: 256 }, (_, i) => i);

async function seed() {
  const fridge = await createDevice({
    name: 'Fridge',
    room: 'Kitchen',
    brand: 'Acme',
    model: 'F-1',
    purchaseDate: '2024-02-29',
    warrantyEndDate: '2026-11-01',
  });
  const tv = await createDevice({ name: 'TV', room: 'Lounge' });
  const add = (deviceId: string, label: string, ext: string, data: Uint8Array) =>
    addAttachment({
      deviceId,
      label,
      ext,
      data,
      kind: ext === 'pdf' ? 'pdf' : 'photo',
      mimeType: ext === 'pdf' ? 'application/pdf' : 'image/jpeg',
    });
  await add(fridge.id, 'Manual', 'pdf', allBytes);
  await add(fridge.id, 'Empty', 'jpg', new Uint8Array(0));
  await add(fridge.id, 'Receipt', 'jpg', strToU8('receipt'));
  await add(tv.id, 'Photo', 'jpg', allBytes.slice().reverse());
  return { fridge, tv };
}

async function snapshot() {
  const devices = await db.devices.orderBy('id').toArray();
  const attachments = await db.attachments.orderBy('id').toArray();
  const bytes = new Map<string, Uint8Array>();
  for (const a of attachments) bytes.set(a.id, await readAttachmentBytes(a));
  return { devices, attachments, bytes };
}

describe('backup', () => {
  it('names files by local date', () => {
    expect(backupFilename(new Date(2026, 8, 5, 23, 59))).toBe('homekind-backup-2026-09-05.zip');
  });

  it('round-trips every record and every byte', async () => {
    await seed();
    const before = await snapshot();
    const { bytes, filename } = await exportBackup();
    expect(filename).toMatch(/^homekind-backup-\d{4}-\d{2}-\d{2}\.zip$/);

    await deleteAllData();
    expect(await db.devices.count()).toBe(0);
    expect(await db.attachments.count()).toBe(0);
    for (const a of before.attachments) await expect(readAttachmentBytes(a)).rejects.toThrow();

    const plan = await planImport(bytes);
    expect(plan.manifest.format).toBe('homekind-backup');
    expect(plan.manifest.appVersion).toBe('1.0.0');
    expect(plan.newDevices).toHaveLength(2);
    expect(plan.conflicts).toEqual([]);
    expect(plan.missingFiles).toEqual([]);

    const result = await applyImport(plan, { overwriteConflicts: false });
    expect(result).toEqual({
      devicesAdded: 2,
      devicesOverwritten: 0,
      devicesSkipped: 0,
      attachmentsWritten: 4,
    });

    const after = await snapshot();
    expect(after.devices).toStrictEqual(before.devices);
    expect(after.attachments).toStrictEqual(before.attachments);
    expect(after.bytes.size).toBe(4);
    for (const [id, data] of before.bytes) {
      expect(after.bytes.get(id)).toStrictEqual(data);
    }
    const sizes = [...after.bytes.values()].map((b) => b.length).sort((a, b) => a - b);
    expect(sizes).toEqual([0, 7, 256, 256]);
  });

  describe('conflicts', () => {
    let fridge: Device;
    let zip: Uint8Array;
    let backedUp: Attachment[];

    beforeEach(async () => {
      ({ fridge } = await seed());
      backedUp = await db.attachments.where('deviceId').equals(fridge.id).toArray();
      zip = (await exportBackup()).bytes;
      // Local changes after the backup: rename and replace the attachments.
      await updateDevice(fridge.id, { name: 'Fridge (edited)' });
      await db.attachments.where('deviceId').equals(fridge.id).delete();
      await addAttachment({
        deviceId: fridge.id,
        kind: 'photo',
        label: 'New',
        mimeType: 'image/png',
        ext: 'png',
        data: strToU8('local'),
      });
    });

    it('lists conflicts in the plan', async () => {
      const plan = await planImport(zip);
      expect(plan.newDevices).toEqual([]);
      expect(plan.conflicts.map((c) => c.existing.name).sort()).toEqual(['Fridge (edited)', 'TV']);
      expect(plan.conflicts.find((c) => c.incoming.id === fridge.id)?.incoming.name).toBe('Fridge');
    });

    it('skips conflicting devices and their attachments', async () => {
      const localBefore = await snapshot();
      const result = await applyImport(await planImport(zip), { overwriteConflicts: false });
      expect(result).toEqual({
        devicesAdded: 0,
        devicesOverwritten: 0,
        devicesSkipped: 2,
        attachmentsWritten: 0,
      });
      expect(await snapshot()).toStrictEqual(localBefore);
    });

    it('overwrites conflicting devices and replaces their attachments', async () => {
      const [local] = await db.attachments.where('deviceId').equals(fridge.id).toArray();
      const result = await applyImport(await planImport(zip), { overwriteConflicts: true });
      expect(result).toEqual({
        devicesAdded: 0,
        devicesOverwritten: 2,
        devicesSkipped: 0,
        attachmentsWritten: 4,
      });
      expect(await db.devices.get(fridge.id)).toStrictEqual(fridge);
      const restored = await db.attachments.where('deviceId').equals(fridge.id).toArray();
      const byId = (a: Attachment, b: Attachment) => a.id.localeCompare(b.id);
      expect(restored.sort(byId)).toStrictEqual(backedUp.sort(byId));
      await expect(readAttachmentBytes(local as Attachment)).rejects.toThrow();
      expect(
        await readAttachmentBytes(backedUp.find((a) => a.label === 'Manual') as Attachment),
      ).toStrictEqual(allBytes);
    });
  });

  it('reports attachments whose files are missing and skips them', async () => {
    const { fridge } = await seed();
    const [a] = await db.attachments.where('deviceId').equals(fridge.id).toArray();
    // Keep only data.json, dropping every attachment file.
    const manifest = unzipSync((await exportBackup()).bytes)['data.json'] as Uint8Array;
    const zip = zipSync({ 'data.json': strToU8(strFromU8(manifest)) });
    await deleteAllData();
    const plan = await planImport(zip);
    expect(plan.missingFiles).toHaveLength(4);
    expect(plan.missingFiles).toContain(`attachments/${fridge.id}/${a?.id}.${a?.ext}`);
    const result = await applyImport(plan, { overwriteConflicts: false });
    expect(result.attachmentsWritten).toBe(0);
    expect(await db.attachments.count()).toBe(0);
    expect(await db.devices.count()).toBe(2);
  });

  describe('streaming', () => {
    it('restores identically when the zip arrives in tiny chunks', async () => {
      await seed();
      const before = await snapshot();
      const { bytes } = await exportBackup();
      await deleteAllData();
      // Chunks far smaller than any entry, so every file is written in many appends and
      // entry headers straddle chunk boundaries.
      const plan = await planImport(bytes, { chunkSize: 7 });
      expect(plan.missingFiles).toEqual([]);
      const result = await applyImport(plan, { overwriteConflicts: false });
      expect(result.attachmentsWritten).toBe(4);
      const after = await snapshot();
      expect(after.attachments).toStrictEqual(before.attachments);
      for (const [id, data] of before.bytes) expect(after.bytes.get(id)).toStrictEqual(data);
    });

    it('reads a picked File (Blob) as well as bytes', async () => {
      await seed();
      const { bytes } = await exportBackup();
      await deleteAllData();
      const file = new File(
        [bytes.slice().buffer as ArrayBuffer],
        'homekind-backup-2026-01-01.zip',
        {
          type: 'application/zip',
        },
      );
      const plan = await planImport(file);
      expect(plan.newDevices).toHaveLength(2);
      const result = await applyImport(plan, { overwriteConflicts: false });
      expect(result.attachmentsWritten).toBe(4);
    });

    it('restores a deflate-compressed backup from an older build', async () => {
      await seed();
      const before = await snapshot();
      const entries = unzipSync((await exportBackup()).bytes);
      // Earlier builds compressed data.json; attachments have always been stored.
      const zip = zipSync(entries, { level: 6 });
      await deleteAllData();
      const plan = await planImport(zip, { chunkSize: 64 });
      const result = await applyImport(plan, { overwriteConflicts: false });
      expect(result.attachmentsWritten).toBe(4);
      const after = await snapshot();
      for (const [id, data] of before.bytes) expect(after.bytes.get(id)).toStrictEqual(data);
    });
  });

  describe('invalid input', () => {
    it('rejects a file that is not a zip', async () => {
      await expect(planImport(strToU8('hello'))).rejects.toThrow(/not a valid zip/);
    });

    it('rejects a zip without data.json', async () => {
      await expect(planImport(zipSync({ 'x.txt': strToU8('x') }))).rejects.toThrow(
        /data\.json is missing/,
      );
    });

    it('rejects malformed or foreign data.json', async () => {
      const zipOf = (json: string) => zipSync({ 'data.json': strToU8(json) });
      await expect(planImport(zipOf('{nope'))).rejects.toThrow(/not valid JSON/);
      await expect(planImport(zipOf('{"format":"other"}'))).rejects.toThrow(/not a HomeKind/);
      await expect(
        planImport(zipOf('{"format":"homekind-backup","formatVersion":2}')),
      ).rejects.toThrow(/format version 2/);
      const unsafe = {
        format: 'homekind-backup',
        formatVersion: 1,
        exportedAt: '',
        appVersion: '1.0.0',
        devices: [{ id: '../x', name: 'n', room: '', createdAt: '', updatedAt: '' }],
        attachments: [],
      };
      await expect(planImport(zipOf(JSON.stringify(unsafe)))).rejects.toThrow(/device list/);
    });
  });

  it('deleteAllData clears records and files', async () => {
    await seed();
    const attachments = await db.attachments.toArray();
    await deleteAllData();
    expect(await db.devices.count()).toBe(0);
    expect(await db.attachments.count()).toBe(0);
    for (const a of attachments) await expect(readAttachmentBytes(a)).rejects.toThrow();
  });
});
