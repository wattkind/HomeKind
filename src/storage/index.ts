import { Capacitor } from '@capacitor/core';
import type { AttachmentStorage } from '../types';
import { createNativeStorage } from './native';
import { createWebStorage } from './web';

export { createMemoryStorage } from './memory';

let current: AttachmentStorage | undefined;

/** The active adapter, created on first use: native on iOS, IndexedDB blobs in a browser. */
export function getStorage(): AttachmentStorage {
  current ??= Capacitor.isNativePlatform() ? createNativeStorage() : createWebStorage();
  return current;
}

export function setStorageForTesting(s: AttachmentStorage): void {
  current = s;
}

/**
 * Stable facade over `getStorage()`. Every call is forwarded to the adapter active
 * at call time, so `setStorageForTesting` takes effect for code that imported
 * `storage` earlier.
 */
export const storage: AttachmentStorage = {
  write: (...args) => getStorage().write(...args),
  openWriter: (...args) => getStorage().openWriter(...args),
  read: (...args) => getStorage().read(...args),
  delete: (...args) => getStorage().delete(...args),
  deleteAllForDevice: (deviceId) => getStorage().deleteAllForDevice(deviceId),
  clear: () => getStorage().clear(),
};
