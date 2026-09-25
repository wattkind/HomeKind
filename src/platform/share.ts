import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import { bytesToBase64, bytesToBlob } from './bytes';
import { isNative } from './runtime';

function isCancel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel/i.test(message);
}

/**
 * Hand a file to the user.
 * Native: write it to the cache directory, then open the iOS share sheet.
 * Web: trigger a download.
 */
export async function shareFile(
  filename: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<void> {
  if (isNative) {
    const written = await Filesystem.writeFile({
      path: filename,
      data: bytesToBase64(bytes),
      directory: Directory.Cache,
    });
    try {
      await Share.share({ title: filename, files: [written.uri] });
    } catch (error) {
      if (!isCancel(error)) throw error;
    }
    return;
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
}
