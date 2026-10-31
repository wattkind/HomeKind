import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import { base64ToBytes } from './bytes';
import { fileToBytes, pickFile } from './files';
import { isNative } from './runtime';

export interface PickedPhoto {
  bytes: Uint8Array;
  mimeType: string;
  ext: string;
}

/** Longest side, in pixels, of a photo taken or picked in the app. */
export const MAX_PHOTO_SIDE = 2048;

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
};

function extFromMime(mimeType: string, fallbackName: string): string {
  const fromName = fallbackName.includes('.') ? fallbackName.split('.').pop() : undefined;
  if (fromName) return fromName.toLowerCase();
  const sub = mimeType.split('/')[1] ?? 'jpg';
  return sub === 'jpeg' ? 'jpg' : sub;
}

function isCancel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel/i.test(message);
}

/**
 * Take a photo or choose one from the library.
 * Native: @capacitor/camera (iOS asks for permission the first time it is used).
 * Web: an image file input. Resolves with null when the user cancels.
 */
export async function takeOrPickPhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  if (isNative) {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Base64,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        quality: 85,
        // Cap the longer side. Full-resolution camera photos run to several megabytes
        // each, which bloats backups for no gain: receipts and manual pages stay
        // readable at this size.
        width: MAX_PHOTO_SIDE,
        height: MAX_PHOTO_SIDE,
      });
      if (!photo.base64String) return null;
      const format = (photo.format || 'jpeg').toLowerCase();
      const ext = format === 'jpeg' ? 'jpg' : format;
      return {
        bytes: base64ToBytes(photo.base64String),
        mimeType: MIME_BY_EXT[ext] ?? 'image/jpeg',
        ext,
      };
    } catch (error) {
      if (isCancel(error)) return null;
      throw error;
    }
  }

  const file = await pickFile('image/*');
  if (!file) return null;
  const ext = extFromMime(file.type, file.name);
  return {
    bytes: await fileToBytes(file),
    mimeType: file.type || MIME_BY_EXT[ext] || 'image/jpeg',
    ext,
  };
}
