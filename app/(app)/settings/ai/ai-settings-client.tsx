"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_BUDGET_USD = 10000;

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function AiSettingsClient({
  householdId,
  isOwner,
  initialAiEnabled,
  initialAutoFetchEnabled,
  initialBudgetUsd,
  effectiveBudgetUsd,
  spendUsd,
  blockedByDeployment,
  autoFetchBlockedByDeployment,
}: {
  householdId: string;
  isOwner: boolean;
  initialAiEnabled: boolean;
  initialAutoFetchEnabled: boolean;
  initialBudgetUsd: number | null;
  effectiveBudgetUsd: number | null;
  spendUsd: number | null;
  blockedByDeployment: boolean;
  autoFetchBlockedByDeployment: boolean;
}) {
  const [aiEnabled, setAiEnabled] = useState(initialAiEnabled);
  const [autoFetchEnabled, setAutoFetchEnabled] = useState(initialAutoFetchEnabled);
  const [budgetInput, setBudgetInput] = useState(initialBudgetUsd == null ? "" : String(initialBudgetUsd));
  const [savedBudget, setSavedBudget] = useState<number | null>(initialBudgetUsd);
  const [error, setError] = useState<string | null>(null);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetSaved, setBudgetSaved] = useState(false);

  // Narrow on purpose: this helper is only for the two boolean switches, so
  // it can't be handed an arbitrary column to write to households.
  async function persist(
    patch: { ai_enabled?: boolean; manual_autofetch_enabled?: boolean },
    revert: () => void,
  ) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("households").update(patch).eq("id", householdId);

    if (updateError) {
      revert();
      setError(
        isOwner
          ? "We couldn't save that. Try again."
          : "Only the household owner can change these settings.",
      );
    }
  }

  async function toggleAi() {
    const next = !aiEnabled;
    setAiEnabled(next);
    await persist({ ai_enabled: next }, () => setAiEnabled(!next));
  }

  async function toggleAutoFetch() {
    const next = !autoFetchEnabled;
    setAutoFetchEnabled(next);
    await persist({ manual_autofetch_enabled: next }, () => setAutoFetchEnabled(!next));
  }

  async function saveBudget() {
    setBudgetError(null);
    setBudgetSaved(false);

    const trimmed = budgetInput.trim();
    // Empty means "no household cap" — fall back to whatever the deployment
    // sets. That is a real, distinct choice from a cap of 0, which blocks
    // everything, so the two must not collapse into each other.
    const value = trimmed === "" ? null : Number(trimmed);

    if (value !== null && (!Number.isFinite(value) || value < 0 || value > MAX_BUDGET_USD)) {
      setBudgetError(`Enter an amount between $0 and $${MAX_BUDGET_USD.toLocaleString()}, or leave it blank.`);
      return;
    }

    setSavingBudget(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("households")
      .update({ ai_monthly_budget_usd: value })
      .eq("id", householdId);
    setSavingBudget(false);

    if (updateError) {
      setBudgetError(
        isOwner ? "We couldn't save that. Try again." : "Only the household owner can change the budget.",
      );
      return;
    }

    setSavedBudget(value);
    setBudgetSaved(true);
  }

  const capForBar = savedBudget ?? effectiveBudgetUsd;
  const pct =
    spendUsd !== null && capForBar !== null && capForBar > 0
      ? Math.min(100, (spendUsd / capForBar) * 100)
      : null;

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      {blockedByDeployment ? (
        <div className="banner" role="status">
          <p>
            AI is switched off for this installation, so these settings won&apos;t take effect until it&apos;s
            switched back on. Your choices here are still saved.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="banner error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      <div className="card" style={{ display: "grid", gap: "10px" }}>
        <label style={{ display: "flex", gap: "12px", alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={aiEnabled} onChange={() => void toggleAi()} disabled={!isOwner} />
          <span>
            <strong>Chat about your devices</strong>
            <span className="hint" style={{ display: "block" }}>
              Ask questions about a device and get answers from its manual. Turning this off also stops manual
              look-ups.
            </span>
          </span>
        </label>
      </div>

      <div className="card" style={{ display: "grid", gap: "10px" }}>
        <label style={{ display: "flex", gap: "12px", alignItems: "flex-start", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={autoFetchEnabled}
            onChange={() => void toggleAutoFetch()}
            disabled={!isOwner || !aiEnabled}
          />
          <span>
            <strong>Find manuals automatically</strong>
            <span className="hint" style={{ display: "block" }}>
              When you add a device, search the web for its official manual and offer it to you. Nothing is ever
              saved without you tapping &ldquo;Use this manual&rdquo;.
            </span>
          </span>
        </label>
        {autoFetchBlockedByDeployment ? (
          <p className="hint">Manual look-ups are switched off for this installation.</p>
        ) : null}
      </div>

      <div className="card" style={{ display: "grid", gap: "12px" }}>
        <div>
          <h3 style={{ fontSize: "1.05rem" }}>Monthly budget</h3>
          <p className="hint">
            AI stops for the rest of the month once this month&apos;s spend reaches the cap. Leave it blank to use
            the default for this installation.
          </p>
        </div>

        {budgetError ? (
          <div className="banner error" role="alert">
            <p>{budgetError}</p>
          </div>
        ) : null}

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="ai-budget">Cap (USD per month)</label>
          <input
            id="ai-budget"
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_BUDGET_USD}
            step="0.01"
            placeholder={effectiveBudgetUsd == null ? "No cap" : String(effectiveBudgetUsd)}
            value={budgetInput}
            disabled={!isOwner}
            onChange={(event) => {
              setBudgetInput(event.target.value);
              setBudgetSaved(false);
            }}
          />
        </div>

        <div className="form-actions">
          <button type="button" className="button" onClick={() => void saveBudget()} disabled={!isOwner || savingBudget}>
            {savingBudget ? "Saving…" : "Save budget"}
          </button>
          {budgetSaved ? <span className="hint">Saved.</span> : null}
        </div>

        <div style={{ display: "grid", gap: "6px" }}>
          <p className="hint">
            {spendUsd === null ? (
              <>We couldn&apos;t read this month&apos;s spend just now.</>
            ) : capForBar === null ? (
              <>
                {formatUsd(spendUsd)} used this month · no cap set
              </>
            ) : (
              <>
                {formatUsd(spendUsd)} of {formatUsd(capForBar)} used this month
              </>
            )}
          </p>
          {pct !== null ? (
            <div
              aria-hidden="true"
              style={{ height: "8px", borderRadius: "999px", background: "var(--line)", overflow: "hidden" }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: pct >= 100 ? "var(--coral-text, #b3261e)" : "var(--sage, #6b8f71)",
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {!isOwner ? (
        <p className="hint">Only the household owner can change these settings.</p>
      ) : null}
    </div>
  );
}
