import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import { bytesToBase64, bytesToBlob } from './bytes';
import { isNative } from './runtime';

function isCancel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel/i.test(message);
}

/**
 * Hand a file to the user. Resolves `true` when the file was handed over and `false`
 * when the user dismissed the share sheet without choosing anywhere to put it.
 * Native: write it to the cache directory, then open the share sheet.
 * Web: trigger a download.
 */
export async function shareFile(
  filename: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<boolean> {
  if (isNative) {
    const written = await Filesystem.writeFile({
      path: filename,
      data: bytesToBase64(bytes),
      directory: Directory.Cache,
    });
    return shareUri(filename, written.uri);
  }

  const url = URL.createObjectURL(bytesToBlob(bytes, mimeType));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** Open the share sheet for a file already on disk. See `shareFile` for the result. */
export async function shareUri(filename: string, uri: string): Promise<boolean> {
  try {
    await Share.share({ title: filename, files: [uri] });
    return true;
  } catch (error) {
    if (isCancel(error)) return false;
    throw error;
  }
}
