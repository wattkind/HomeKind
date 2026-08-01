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
 * True once this calendar month's (UTC) total AI spend across every
 * household reaches GLOBAL_BUDGET_CAP_USD. Returns false (not blocked) when
 * the cap is unset/empty — that's "no cap configured", not "cap is zero".
 */
export async function budgetExhausted(): Promise<boolean> {
  const rawCap = process.env.GLOBAL_BUDGET_CAP_USD;
  if (rawCap === undefined || rawCap.trim() === "") return false;

  const capUsd = Number(rawCap);
  if (!Number.isFinite(capUsd) || capUsd < 0) return false;

  const now = new Date();
  const startOfMonthUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_usage")
    .select("model, input_tokens, output_tokens")
    .gte("ts", startOfMonthUtc);

  if (error) {
    console.error("budgetExhausted: query failed", error.code, error.message);
    // Fail closed on a read error too: treat as exhausted so a transient DB
    // problem can't silently blow through the cap.
    return true;
  }

  const spendUsd = (data ?? []).reduce(
    (sum, row) => sum + rowCostUsd(row.model, row.input_tokens, row.output_tokens),
    0,
  );

  return spendUsd >= capUsd;
}
