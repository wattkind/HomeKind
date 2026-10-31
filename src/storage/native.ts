import { Directory, Filesystem } from '@capacitor/filesystem';
import type { AttachmentStorage, AttachmentWriter } from '../types';
import { attachmentPath, deviceDir } from './paths';

const ROOT = 'attachments';
const APPEND_CHUNK = 1024 * 1024;

function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not\s*(exist|found)|no such file|does not exist/i.test(message);
}

async function ignoreNotFound(op: Promise<unknown>): Promise<void> {
  try {
    await op;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

/** iOS: files in the app's private Data directory, which the OS includes in device backups. */
export function createNativeStorage(): AttachmentStorage {
  return {
    async write(deviceId, attachmentId, ext, data) {
      await Filesystem.writeFile({
        path: attachmentPath(deviceId, attachmentId, ext),
        directory: Directory.Data,
        data: bytesToBase64(data),
        recursive: true,
      });
    },
    openWriter(deviceId, attachmentId, ext): AttachmentWriter {
      const path = attachmentPath(deviceId, attachmentId, ext);
      // Each append crosses the bridge as its own base64 string, so only one chunk is
      // ever in the web view. Chunks are coalesced to about a megabyte to keep the
      // number of bridge calls down. The first write creates (or truncates) the file.
      const parts: Uint8Array[] = [];
      let buffered = 0;
      let created = false;
      const flush = async () => {
        const data = bytesToBase64(parts.length === 1 ? (parts[0] as Uint8Array) : join(parts));
        parts.length = 0;
        buffered = 0;
        if (created) {
          await Filesystem.appendFile({ path, directory: Directory.Data, data });
        } else {
          await Filesystem.writeFile({ path, directory: Directory.Data, data, recursive: true });
          created = true;
        }
      };
      return {
        async append(chunk) {
          parts.push(chunk);
          buffered += chunk.length;
          if (buffered >= APPEND_CHUNK) await flush();
        },
        async close() {
          if (buffered > 0 || !created) await flush();
        },
      };
    },
    async read(deviceId, attachmentId, ext) {
      const { data } = await Filesystem.readFile({
        path: attachmentPath(deviceId, attachmentId, ext),
        directory: Directory.Data,
      });
      // Native returns base64; Blob only occurs on the plugin's web implementation.
      if (typeof data === 'string') return base64ToBytes(data);
      return new Uint8Array(await data.arrayBuffer());
    },
    async delete(deviceId, attachmentId, ext) {
      await ignoreNotFound(
        Filesystem.deleteFile({
          path: attachmentPath(deviceId, attachmentId, ext),
          directory: Directory.Data,
        }),
      );
    },
    async deleteAllForDevice(deviceId) {
      await ignoreNotFound(
        Filesystem.rmdir({ path: deviceDir(deviceId), directory: Directory.Data, recursive: true }),
      );
    },
    async clear() {
      await ignoreNotFound(
        Filesystem.rmdir({ path: ROOT, directory: Directory.Data, recursive: true }),
      );
    },
  };
}
