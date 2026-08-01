import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * Storage bucket for device manuals/receipts/other documents. Objects live
 * under households/<household_id>/devices/<device_id>/<uuid>.<ext> — see
 * supabase/migrations/20260801000100_storage.sql for the RLS policy that
 * enforces this path shape.
 */
export const DOCUMENT_BUCKET = "device-documents";

const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp", "heic"]);

/**
 * Builds the storage path for a new document upload. The file name's
 * extension is lowercased and checked against the bucket's allowed types;
 * an unrecognised extension falls back to "bin" rather than throwing, so a
 * misnamed file doesn't break the upload flow (the bucket's own
 * allowed_mime_types check is the real gate).
 */
export function documentPath(householdId: string, deviceId: string, fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const rawExt = dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : "";
  const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : "bin";

  return `households/${householdId}/devices/${deviceId}/${crypto.randomUUID()}.${ext}`;
}

/**
 * Returns a time-limited signed URL for a document's storage path, or null
 * if the request fails (missing object, no access, etc).
 */
export async function createSignedUrl(
  sb: SupabaseClient<Database>,
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await sb.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, expiresIn);

  if (error || !data) {
    return null;
  }

  return data.signedUrl;
}
