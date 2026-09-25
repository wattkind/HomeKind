/**
 * Ids and extensions end up in file paths, so anything read from a backup is
 * checked against these patterns before it can reach the filesystem.
 */
const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;
const SAFE_EXT = /^[A-Za-z0-9]{1,10}$/;

export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value);
}

export function isSafeExt(value: unknown): value is string {
  return typeof value === 'string' && SAFE_EXT.test(value);
}

export function deviceDir(deviceId: string): string {
  if (!isSafeId(deviceId)) throw new Error(`Unsafe device id: ${deviceId}`);
  return `attachments/${deviceId}`;
}

/** `attachments/<deviceId>/<attachmentId>.<ext>`, shared by storage and backups. */
export function attachmentPath(deviceId: string, attachmentId: string, ext: string): string {
  if (!isSafeId(attachmentId)) throw new Error(`Unsafe attachment id: ${attachmentId}`);
  if (!isSafeExt(ext)) throw new Error(`Unsafe file extension: ${ext}`);
  return `${deviceDir(deviceId)}/${attachmentId}.${ext}`;
}
