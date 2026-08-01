"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Props contract for the manual-lookup step of the add-device flow.
 *
 * FROZEN CONTRACT — kept exactly as documented previously:
 *
 *   - brand: string            — current value of the brand field (may be "")
 *   - model: string             — current value of the model_number field (may be "")
 *   - onManualSelected: (file: File | null) => void
 *       Called whenever the user picks (or clears) a manual file to attach.
 *       Passing null means "no manual chosen" (v1 also allows skipping this
 *       step entirely).
 *
 * Behaviour (P7 auto-fetch): once brand and model are both filled in (and
 * NEXT_PUBLIC_AUTOFETCH_ENABLED isn't explicitly "false"), this looks up the
 * official manual once per distinct brand+model pair via
 * POST /api/manuals/fetch. That call is entirely best-effort and silent —
 * any failure (network error, { ok: false }) just removes the "searching"
 * line and leaves the upload control, which is ALWAYS rendered, as the
 * fallback path. A found candidate is never auto-attached: the person must
 * explicitly tap "Use this manual".
 */
export function AutoFetchStep({
  brand,
  model,
  onManualSelected,
}: {
  brand: string;
  model: string;
  onManualSelected: (file: File | null) => void;
}) {
  const autoFetchEnabled = process.env.NEXT_PUBLIC_AUTOFETCH_ENABLED !== "false";
  const trimmedBrand = brand?.trim() ?? "";
  const trimmedModel = model?.trim() ?? "";
  const active = autoFetchEnabled && trimmedBrand.length > 0 && trimmedModel.length > 0;

  const [searching, setSearching] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [fetchedName, setFetchedName] = useState<string | null>(null);
  const attemptedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) {
      attemptedKeyRef.current = null;
      setSearching(false);
      setCandidate(null);
      return;
    }

    const key = `${trimmedBrand}::${trimmedModel}`;
    if (attemptedKeyRef.current === key) return;
    attemptedKeyRef.current = key;

    let cancelled = false;
    setSearching(true);
    setCandidate(null);
    setFetchedName(null);

    (async () => {
      try {
        const response = await fetch("/api/manuals/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand: trimmedBrand, model: trimmedModel }),
        });
        const data: unknown = await response.json().catch(() => null);
        if (cancelled) return;

        if (isFoundResponse(data)) {
          setCandidate({ url: data.url, title: data.title, source: data.source, sizeBytes: data.sizeBytes });
        }
      } catch {
        // Network error — silent fallthrough, the upload control remains.
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, trimmedBrand, trimmedModel]);

  async function confirmManual() {
    if (!candidate) return;
    setConfirming(true);
    try {
      const response = await fetch("/api/manuals/fetch?confirm=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: candidate.url, title: candidate.title }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("application/pdf")) {
        throw new Error("manual confirm failed");
      }
      const blob = await response.blob();
      const suggestedName = suggestFileName(candidate.title);
      const file = new File([blob], suggestedName, { type: "application/pdf" });
      onManualSelected(file);
      setFetchedName(suggestedName);
      setCandidate(null);
    } catch {
      // Silent fallthrough — dismiss the card quietly, upload remains.
      setCandidate(null);
    } finally {
      setConfirming(false);
    }
  }

  function noThanks() {
    setCandidate(null);
  }

  return (
    <div className="field">
      <label htmlFor="manual-upload">Manual (PDF)</label>

      {searching ? <p className="hint">Looking for the official manual…</p> : null}

      {fetchedName ? <p className="hint">Fetched {fetchedName} — it will be attached when you save.</p> : null}

      {candidate ? (
        <div className="card">
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
            <button type="button" className="button" onClick={() => void confirmManual()} disabled={confirming}>
              {confirming ? "Fetching…" : "Use this manual"}
            </button>
            <button type="button" className="button secondary" onClick={noThanks} disabled={confirming}>
              No thanks
            </button>
          </div>
        </div>
      ) : null}

      {brand || model ? (
        <p className="hint">
          {[brand, model].filter(Boolean).join(" ")} — upload its manual if you have it handy.
        </p>
      ) : (
        <p className="hint">Upload the device&apos;s manual if you have it handy. You can add it later too.</p>
      )}
      <input
        id="manual-upload"
        type="file"
        accept="application/pdf"
        onChange={(event) => onManualSelected(event.target.files?.[0] ?? null)}
      />
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
