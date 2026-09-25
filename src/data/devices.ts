import { getStorage } from '../storage';
import type { Device } from '../types';
import { db } from './db';
import { newId, nowIso } from './ids';

export type DeviceInput = Omit<Device, 'id' | 'createdAt' | 'updatedAt'>;

const OPTIONAL_FIELDS = ['brand', 'model', 'purchaseDate', 'warrantyEndDate'] as const;

/** Trims text fields and drops empty optional fields so an empty input clears the value. */
function normalise(input: DeviceInput): DeviceInput {
  const out: DeviceInput = { name: input.name.trim(), room: (input.room ?? '').trim() };
  for (const key of OPTIONAL_FIELDS) {
    const value = input[key]?.trim();
    if (value) out[key] = value;
  }
  return out;
}

export async function createDevice(input: DeviceInput): Promise<Device> {
  const now = nowIso();
  const device: Device = { ...normalise(input), id: newId(), createdAt: now, updatedAt: now };
  await db.devices.add(device);
  return device;
}

export async function updateDevice(id: string, patch: Partial<DeviceInput>): Promise<Device> {
  return db.transaction('rw', db.devices, async () => {
    const existing = await db.devices.get(id);
    if (!existing) throw new Error(`Device not found: ${id}`);
    // normalise() copies only input fields, so id and timestamps are set explicitly.
    const device: Device = {
      ...normalise({ ...existing, ...patch }),
      id,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    };
    await db.devices.put(device);
    return device;
  });
}

export function getDevice(id: string): Promise<Device | undefined> {
  return db.devices.get(id);
}

/** Unsorted; order for display with `sortDevices` from warranty.ts. */
export function listDevices(): Promise<Device[]> {
  return db.devices.toArray();
}

/** Removes the device, its attachment records, then its files. */
export async function deleteDevice(id: string): Promise<void> {
  await db.transaction('rw', db.devices, db.attachments, async () => {
    await db.attachments.where('deviceId').equals(id).delete();
    await db.devices.delete(id);
  });
  await getStorage().deleteAllForDevice(id);
}

/** Distinct, non-empty rooms already in use, sorted for suggestions. */
export async function listRooms(): Promise<string[]> {
  const rooms = (await db.devices.orderBy('room').uniqueKeys()) as string[];
  return rooms
    .filter((room) => room !== '')
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
