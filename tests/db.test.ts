import { beforeEach, describe, expect, it } from 'vitest';
import {
  addAttachment,
  deleteAttachment,
  listAttachments,
  readAttachmentBytes,
} from '../src/data/attachments';
import { db } from '../src/data/db';
import {
  createDevice,
  deleteDevice,
  getDevice,
  listDevices,
  listRooms,
  updateDevice,
} from '../src/data/devices';
import { createMemoryStorage, setStorageForTesting } from '../src/storage';
import type { AttachmentStorage } from '../src/types';

let files: AttachmentStorage;

beforeEach(async () => {
  await db.delete();
  await db.open();
  files = createMemoryStorage();
  setStorageForTesting(files);
});

const bytes = (...values: number[]) => new Uint8Array(values);

describe('schema', () => {
  it('has the agreed tables and indexes', () => {
    expect(db.verno).toBe(1);
    const devices = db.table('devices').schema;
    const attachments = db.table('attachments').schema;
    expect(devices.primKey.name).toBe('id');
    expect(devices.indexes.map((i) => i.name).sort()).toEqual([
      'name',
      'room',
      'updatedAt',
      'warrantyEndDate',
    ]);
    expect(attachments.primKey.name).toBe('id');
    expect(attachments.indexes.map((i) => i.name).sort()).toEqual(['deviceId', 'updatedAt']);
  });
});

describe('devices', () => {
  it('creates with a uuid, timestamps and trimmed text', async () => {
    const d = await createDevice({ name: '  Dishwasher ', room: ' Kitchen  ', brand: ' ' });
    expect(d.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(d.name).toBe('Dishwasher');
    expect(d.room).toBe('Kitchen');
    expect(d).not.toHaveProperty('brand');
    expect(d.createdAt).toBe(d.updatedAt);
    expect(await getDevice(d.id)).toEqual(d);
  });

  it('updates, keeping id and createdAt', async () => {
    const d = await createDevice({ name: 'TV', room: 'Lounge', brand: 'Acme' });
    await new Promise((r) => setTimeout(r, 5));
    const u = await updateDevice(d.id, { room: ' Den ', brand: '', warrantyEndDate: '2027-01-01' });
    expect(u).toMatchObject({ id: d.id, name: 'TV', room: 'Den', warrantyEndDate: '2027-01-01' });
    expect(u).not.toHaveProperty('brand');
    expect(u.createdAt).toBe(d.createdAt);
    expect(u.updatedAt > d.updatedAt).toBe(true);
    expect(await getDevice(d.id)).toEqual(u);
  });

  it('rejects updating a missing device', async () => {
    await expect(updateDevice('nope', { name: 'x' })).rejects.toThrow(/not found/);
  });

  it('deletes a device with its attachment records and files', async () => {
    const keep = await createDevice({ name: 'Keep', room: '' });
    const gone = await createDevice({ name: 'Gone', room: '' });
    const base = { kind: 'photo', label: 'x', mimeType: 'image/jpeg', ext: 'jpg' } as const;
    const a1 = await addAttachment({ ...base, deviceId: gone.id, data: bytes(1) });
    const a2 = await addAttachment({ ...base, deviceId: gone.id, data: bytes(2) });
    const k1 = await addAttachment({ ...base, deviceId: keep.id, data: bytes(3) });

    await deleteDevice(gone.id);

    expect(await listDevices()).toEqual([keep]);
    expect(await db.attachments.count()).toBe(1);
    await expect(readAttachmentBytes(a1)).rejects.toThrow();
    await expect(readAttachmentBytes(a2)).rejects.toThrow();
    expect(await readAttachmentBytes(k1)).toEqual(bytes(3));
  });

  it('lists distinct, non-empty rooms sorted', async () => {
    for (const room of ['Kitchen', 'attic', '', 'Kitchen', ' Bedroom ']) {
      await createDevice({ name: 'd', room });
    }
    expect(await listRooms()).toEqual(['attic', 'Bedroom', 'Kitchen']);
  });
});

describe('attachments', () => {
  it('adds, lists, reads and deletes', async () => {
    const d = await createDevice({ name: 'Oven', room: '' });
    const a = await addAttachment({
      deviceId: d.id,
      kind: 'pdf',
      label: 'Manual',
      mimeType: 'application/pdf',
      ext: 'PDF',
      data: bytes(37, 80, 68, 70),
    });
    expect(a).toMatchObject({ byteSize: 4, ext: 'pdf', label: 'Manual' });
    expect(await listAttachments(d.id)).toEqual([a]);
    expect(await readAttachmentBytes(a)).toEqual(bytes(37, 80, 68, 70));

    await deleteAttachment(a.id);
    expect(await listAttachments(d.id)).toEqual([]);
    await expect(readAttachmentBytes(a)).rejects.toThrow();
  });

  it('leaves no record when the file write fails', async () => {
    const d = await createDevice({ name: 'Oven', room: '' });
    setStorageForTesting({
      ...files,
      write: () => Promise.reject(new Error('disk full')),
    });
    await expect(
      addAttachment({
        deviceId: d.id,
        kind: 'photo',
        label: 'Receipt',
        mimeType: 'image/png',
        ext: 'png',
        data: bytes(1),
      }),
    ).rejects.toThrow('disk full');
    expect(await db.attachments.count()).toBe(0);
  });
});
