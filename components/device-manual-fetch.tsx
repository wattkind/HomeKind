"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DOCUMENT_BUCKET, documentPath } from "@/lib/storage";

/**
 * Manual auto-fetch for a device that ALREADY exists.
 *
 * AutoFetchStep does the same lookup inside the add-device flow, but it hands
 * the fetched File back to the parent form to upload on save, and its props
 * contract is frozen. A device added before auto-fetch existed — or saved
 * without a manual — therefore had no route to the feature at all: the only
 * option on the device page was to find the PDF by hand and upload it.
 *
 * This component covers that case. It reuses the same two-step API
 * (POST /api/manuals/fetch, then ?confirm=1) and then does the storage upload
 * and documents insert itself, exactly as UploadDocument would for a manual.
 *
 * Rendered only when the device has no manual yet and has both a brand and a
 * model to search on; the parent decides that, and also whether the household
 * has auto-fetch switched on.
 */
export function DeviceManualFetch({
  deviceId,
  householdId,
  brand,
  model,
}: {
  deviceId: string;
  householdId: string;
  brand: string;
  model: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "searching" | "found" | "saving" | "none">("idle");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setState("searching");
    setError(null);
    setCandidate(null);

    try {
      const response = await fetch("/api/manuals/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, model }),
      });
      const data: unknown = await response.json().catch(() => null);

      if (isFoundResponse(data)) {
        setCandidate({ url: data.url, title: data.title, source: data.source, sizeBytes: data.sizeBytes });
        setState("found");
        return;
      }
      // Unlike the add-device flow this is an explicit, user-initiated action,
      // so "we looked and found nothing" is stated rather than swallowed —
      // silence after tapping a button reads as a broken button.
      setState("none");
    } catch {
      setState("none");
    }
  }

  async function attachManual() {
    if (!candidate) return;
    setState("saving");
    setError(null);

    try {
      const response = await fetch("/api/manuals/fetch?confirm=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: candidate.url, title: candidate.title }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("application/pdf")) {
        throw new Error("confirm failed");
      }

      const blob = await response.blob();
      const fileName = suggestFileName(candidate.title);
      const file = new File([blob], fileName, { type: "application/pdf" });

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const path = documentPath(householdId, deviceId, fileName);

      const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, {
        contentType: "application/pdf",
      });
      if (uploadError) throw new Error("upload failed");

      const { error: docError } = await supabase.from("documents").insert({
        device_id: deviceId,
        household_id: householdId,
        type: "manual",
        storage_path: path,
        file_name: fileName,
        mime_type: "application/pdf",
        size_bytes: file.size,
        created_by: user?.id ?? null,
      });
      if (docError) throw new Error("insert failed");

      setCandidate(null);
      setState("idle");
      router.refresh();
    } catch {
      setError("We found the manual but couldn't save it. Try again, or upload it below.");
      setState("found");
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: "12px" }}>
      <div>
        <h3 style={{ fontSize: "1.05rem" }}>Find the manual automatically</h3>
        <p className="hint">
          We&apos;ll search the web for the official {brand} {model} manual, and show you what we found before
          anything is saved.
        </p>
      </div>

      {error ? (
        <div className="banner error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {state === "idle" || state === "none" ? (
        <>
          {state === "none" ? (
            <p className="hint">
              We couldn&apos;t find an official manual for this one. You can still upload it below.
            </p>
          ) : null}
          <div>
            <button type="button" className="button" onClick={() => void search()}>
              {state === "none" ? "Try again" : "Find manual"}
            </button>
          </div>
        </>
      ) : null}

      {state === "searching" ? (
        <p className="hint">Looking for the official manual… this can take a minute or two.</p>
      ) : null}

      {candidate && (state === "found" || state === "saving") ? (
        <div style={{ display: "grid", gap: "8px" }}>
          <p>
            <strong>{candidate.title}</strong>
          </p>
          <p className="hint">
            {candidate.source} · {(candidate.sizeBytes / (1024 * 1024)).toFixed(1)} MB
          </p>
          <p>
            <a href={candidate.url} target="_blank" rel="noopener noreferrer">
              Preview
            </a>
          </p>
          <div className="form-actions">
            <button type="button" className="button" onClick={() => void attachManual()} disabled={state === "saving"}>
              {state === "saving" ? "Saving…" : "Use this manual"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setCandidate(null);
                setState("idle");
              }}
              disabled={state === "saving"}
            >
              No thanks
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface Candidate {
  url: string;
  title: string;
  source: string;
  sizeBytes: number;
}

function isFoundResponse(data: unknown): data is Candidate & { ok: true } {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.ok === true &&
    typeof obj.url === "string" &&
    typeof obj.title === "string" &&
    typeof obj.source === "string" &&
    typeof obj.sizeBytes === "number"
  );
}

function suggestFileName(title: string): string {
  const base =
    title
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .slice(0, 80) || "manual";
  return `${base}.pdf`;
}
