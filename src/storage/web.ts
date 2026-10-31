import Dexie, { type Table } from 'dexie';
import type { AttachmentStorage, AttachmentWriter } from '../types';
import { concat } from './memory';
import { attachmentPath, deviceDir } from './paths';

interface StoredFile {
  path: string;
  data: Uint8Array;
}

/** Browser fallback. A separate IndexedDB database from the records in `homekind`. */
class FilesDB extends Dexie {
  files!: Table<StoredFile, string>;

  constructor() {
    super('homekind-files');
    this.version(1).stores({ files: 'path' });
  }
}

export function createWebStorage(): AttachmentStorage {
  const fdb = new FilesDB();

  return {
    async write(deviceId, attachmentId, ext, data) {
      await fdb.files.put({ path: attachmentPath(deviceId, attachmentId, ext), data });
    },
    openWriter(deviceId, attachmentId, ext): AttachmentWriter {
      // The browser build keeps blobs in IndexedDB, which has no append; buffer in memory.
      const path = attachmentPath(deviceId, attachmentId, ext);
      const parts: Uint8Array[] = [];
      return {
        async append(chunk) {
          parts.push(new Uint8Array(chunk));
        },
        async close() {
          await fdb.files.put({ path, data: concat(parts) });
        },
      };
    },
    async read(deviceId, attachmentId, ext) {
      const path = attachmentPath(deviceId, attachmentId, ext);
      const file = await fdb.files.get(path);
      if (!file) throw new Error(`File not found: ${path}`);
      return new Uint8Array(file.data);
    },
    async delete(deviceId, attachmentId, ext) {
      await fdb.files.delete(attachmentPath(deviceId, attachmentId, ext));
    },
    async deleteAllForDevice(deviceId) {
      await fdb.files
        .where('path')
        .startsWith(`${deviceDir(deviceId)}/`)
        .delete();
    },
    async clear() {
      await fdb.files.clear();
    },
  };
}
