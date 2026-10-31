import type { AttachmentStorage, AttachmentWriter } from '../types';
import { attachmentPath, deviceDir } from './paths';

/** Joins chunks into one buffer. Shared by the adapters that buffer a writer in memory. */
export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** In-memory adapter for tests. Copies bytes in and out so callers cannot mutate stored data. */
export function createMemoryStorage(): AttachmentStorage {
  const files = new Map<string, Uint8Array>();

  return {
    async write(deviceId, attachmentId, ext, data) {
      files.set(attachmentPath(deviceId, attachmentId, ext), new Uint8Array(data));
    },
    openWriter(deviceId, attachmentId, ext): AttachmentWriter {
      const path = attachmentPath(deviceId, attachmentId, ext);
      const parts: Uint8Array[] = [];
      return {
        async append(chunk) {
          parts.push(new Uint8Array(chunk));
        },
        async close() {
          files.set(path, concat(parts));
        },
      };
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
