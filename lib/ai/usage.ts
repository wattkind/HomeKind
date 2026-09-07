import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { CHAT_MODEL } from "@/lib/ai/anthropic";

export interface RecordUsageOpts {
  householdId: string;
  userId: string | null;
  purpose: "device_chat" | "manual_fetch";
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Inserts one ai_usage row via the service-role client (RLS on ai_usage has
 * no insert policy — see the initial-schema migration comment — so this is
 * the only path that can write it). Usage recording must never break the
 * feature it's measuring: any failure is swallowed and logged, never thrown.
 */
export async function recordUsage(opts: RecordUsageOpts): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("ai_usage").insert({
      household_id: opts.householdId,
      user_id: opts.userId,
      purpose: opts.purpose,
      model: opts.model,
      input_tokens: opts.inputTokens,
      output_tokens: opts.outputTokens,
    });
    if (error) {
      console.error("recordUsage: insert failed", error.code, error.message);
    }
  } catch (err) {
    console.error("recordUsage: unexpected failure", err instanceof Error ? err.message : err);
  }
}

// Single-model pricing table (USD per token). Extend this when additional
// models are added to the product. Deliberately keyed by exact model string
// rather than a prefix match, so a typo'd/unknown model name is caught by
// the fail-closed default below rather than silently matching the wrong row.
const PRICING_USD_PER_TOKEN: Record<string, { input: number; output: number }> = {
  [CHAT_MODEL]: { input: 3 / 1_000_000, output: 15 / 1_000_000 },
};

// Fail-closed default: an unpriced/unknown model is costed at the sonnet
// rate rather than treated as free, so a new model showing up in ai_usage
// before this table is updated can't silently defeat the budget cap.
const DEFAULT_PRICING = PRICING_USD_PER_TOKEN[CHAT_MODEL];

function rowCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_USD_PER_TOKEN[model] ?? DEFAULT_PRICING;
  return inputTokens * pricing.input + outputTokens * pricing.output;
}

/**
 * Start of the current calendar month in UTC, as an ISO string. Shared by
 * the cap check and the spend readout so the two can never disagree about
 * which rows count as "this month".
 */
function startOfMonthUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * This calendar month's (UTC) AI spend in USD. Pass a householdId to scope it
 * to one household, or omit it for the deployment-wide total that the cap
 * check uses.
 *
 * Returns null on a read error so the caller can tell "no spend" from "we
 * don't know" — the settings page shows that difference rather than a
 * confident $0.00 it hasn't actually verified.
 */
export async function monthlySpendUsd(householdId?: string): Promise<number | null> {
  const admin = createAdminClient();
  let query = admin.from("ai_usage").select("model, input_tokens, output_tokens").gte("ts", startOfMonthUtc());
  if (householdId) {
    query = query.eq("household_id", householdId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("monthlySpendUsd: query failed", error.code, error.message);
    return null;
  }

  return (data ?? []).reduce((sum, row) => sum + rowCostUsd(row.model, row.input_tokens, row.output_tokens), 0);
}

/**
 * True once this calendar month's (UTC) total AI spend reaches `capUsd`.
 * Returns false (not blocked) when the cap is null — that's "no cap
 * configured", not "cap is zero".
 *
 * The cap is now passed in by the caller (resolved from the household row,
 * falling back to GLOBAL_BUDGET_CAP_USD, in lib/ai/settings.ts) instead of
 * being read from the environment here, so a household can set its own.
 * The spend side stays deployment-wide on purpose: this keeps the cap a true
 * ceiling on the API key's total spend rather than a per-tenant allowance
 * that several households could each exhaust independently.
 */
export async function budgetExhausted(capUsd: number | null): Promise<boolean> {
  if (capUsd === null || !Number.isFinite(capUsd) || capUsd < 0) return false;

  const spendUsd = await monthlySpendUsd();

  // Fail closed on a read error: treat as exhausted so a transient DB
  // problem can't silently blow through the cap.
  if (spendUsd === null) return true;

  return spendUsd >= capUsd;
}
