import imageCompression from "browser-image-compression";

/**
 * Client-side image compression for receipt/manual photos before upload.
 * Non-image files (e.g. PDFs) pass through untouched. If compression fails
 * for any reason, the original file is returned unchanged — a compressor bug
 * must never block an upload.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  try {
    return await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 2000,
      useWebWorker: true,
    });
  } catch {
    return file;
  }
}
