"use client";

/**
 * Props contract for the manual-lookup step of the add-device flow.
 *
 * FROZEN CONTRACT: a later package replaces this component's internals with
 * a real brand/model lookup against a manuals database (auto-fetch). Any
 * replacement MUST keep this exact prop shape:
 *
 *   - brand: string            — current value of the brand field (may be "")
 *   - model: string             — current value of the model_number field (may be "")
 *   - onManualSelected: (file: File | null) => void
 *       Called whenever the user picks (or clears) a manual file to attach.
 *       Passing null means "no manual chosen" (v1 also allows skipping this
 *       step entirely).
 *
 * v1 behaviour (this file): auto-fetch is not implemented yet, so regardless
 * of NEXT_PUBLIC_AUTOFETCH_ENABLED this renders only a manual PDF upload
 * control. The env var is read for forward-compatibility with the real
 * implementation, which will branch on it to show fetch results instead.
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
  const autoFetchEnabled = process.env.NEXT_PUBLIC_AUTOFETCH_ENABLED === "true";

  return (
    <div className="field">
      <label htmlFor="manual-upload">Manual (PDF)</label>
      {autoFetchEnabled ? (
        <p className="hint">
          Automatic manual lookup isn&apos;t available yet — upload one manually for now.
        </p>
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
