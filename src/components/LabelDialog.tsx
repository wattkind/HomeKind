import { useEffect, useId, useState } from 'react';

import { Modal } from './Modal';

const QUICK_LABELS = ['Manual', 'Receipt', 'Photo', 'Other'] as const;

/** Ask for a label before saving a new attachment. */
export function LabelDialog({
  open,
  defaultLabel,
  busy,
  error,
  onSave,
  onCancel,
}: {
  open: boolean;
  defaultLabel: string;
  busy: boolean;
  error: string | null;
  onSave: (label: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(defaultLabel);
  const inputId = useId();
  const hintId = useId();
  const formId = useId();

  useEffect(() => {
    if (open) setLabel(defaultLabel);
  }, [open, defaultLabel]);

  const trimmed = label.trim();

  return (
    <Modal
      open={open}
      title="Name this file"
      onClose={onCancel}
      actions={
        <>
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" form={formId} className="btn btn--primary" disabled={busy}>
            Save
          </button>
        </>
      }
    >
      <form
        id={formId}
        className="field"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onSave(trimmed || defaultLabel);
        }}
      >
        <label htmlFor={inputId} className="field__label">
          Label
        </label>
        <input
          id={inputId}
          className="input"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-describedby={hintId}
          autoComplete="off"
        />
        <div className="chips" role="group" aria-label="Quick labels">
          {QUICK_LABELS.map((quick) => (
            <button
              key={quick}
              type="button"
              className="chip"
              aria-pressed={trimmed === quick}
              onClick={() => setLabel(quick)}
            >
              {quick}
            </button>
          ))}
        </div>
        <p id={hintId} className="field__hint">
          Pick a label or type your own.
        </p>
      </form>
      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
