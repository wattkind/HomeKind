"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DOCUMENT_BUCKET, documentPath } from "@/lib/storage";
import { compressImage } from "@/lib/compress";
import type { DocumentRow } from "@/lib/types";

/** Add another document (manual/receipt/other) to an existing device. */
export function UploadDocument({ deviceId, householdId }: { deviceId: string; householdId: string }) {
  const router = useRouter();
  const [type, setType] = useState<DocumentRow["type"]>("manual");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const toUpload = file.type.startsWith("image/") ? await compressImage(file) : file;
      const path = documentPath(householdId, deviceId, toUpload.name);

      const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, toUpload, {
        contentType: toUpload.type || undefined,
      });

      if (uploadError) {
        setError("That file didn't upload. Check your connection and try again.");
        return;
      }

      const { error: docError } = await supabase.from("documents").insert({
        device_id: deviceId,
        household_id: householdId,
        type,
        storage_path: path,
        file_name: toUpload.name,
        mime_type: toUpload.type || "application/octet-stream",
        size_bytes: toUpload.size,
        created_by: user?.id ?? null,
      });

      if (docError) {
        setError("The file uploaded, but we couldn't save it against this device. Try again.");
        return;
      }

      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: "12px" }}>
      <h3 style={{ fontSize: "1.05rem" }}>Add a document</h3>

      {error ? (
        <div className="banner error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="doc-type">Type</label>
        <select
          id="doc-type"
          value={type}
          onChange={(event) => setType(event.target.value as DocumentRow["type"])}
          style={{
            width: "100%",
            padding: "13px 15px",
            border: "1px solid var(--line)",
            borderRadius: "12px",
            background: "white",
            fontFamily: "inherit",
            fontSize: "1rem",
          }}
        >
          <option value="manual">Manual</option>
          <option value="receipt">Receipt</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="doc-file">File</label>
        <input
          id="doc-file"
          type="file"
          accept="application/pdf,image/*"
          disabled={uploading}
          onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
        />
      </div>

      {uploading ? <p className="hint">Uploading…</p> : null}
    </div>
  );
}
