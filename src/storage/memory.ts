import type { AttachmentStorage } from '../types';
import { attachmentPath, deviceDir } from './paths';

/** In-memory adapter for tests. Copies bytes in and out so callers cannot mutate stored data. */
export function createMemoryStorage(): AttachmentStorage {
  const files = new Map<string, Uint8Array>();

  return {
    async write(deviceId, attachmentId, ext, data) {
      files.set(attachmentPath(deviceId, attachmentId, ext), new Uint8Array(data));
    },
    async read(deviceId, attachmentId, ext) {
      const path = attachmentPath(deviceId, attachmentId, ext);
      const data = files.get(path);
      if (!data) throw new Error(`File not found: ${path}`);
      return new Uint8Array(data);
    },
    async delete(deviceId, attachmentId, ext) {
      files.delete(attachmentPath(deviceId, attachmentId, ext));
    },
    async deleteAllForDevice(deviceId) {
      const prefix = `${deviceDir(deviceId)}/`;
      for (const path of [...files.keys()]) {
        if (path.startsWith(prefix)) files.delete(path);
      }
    },
    async clear() {
      files.clear();
    },
  };
}
