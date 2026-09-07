import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolved AI settings for one household: the deployment environment ANDed
 * with the household's own row.
 *
 * The layering rule is deliberately one-directional -- the environment is a
 * hard ceiling and the database can only narrow it:
 *
 *   effective = env allows it AND household row allows it
 *
 * so the dev instance (AI_ENABLED=false, no ANTHROPIC_API_KEY) can never be
 * switched on by editing a row, and a household can still opt out of a
 * feature the deployment permits. Anything that gates spend must read this,
 * never process.env directly.
 */
export interface ResolvedAiSettings {
  /** Device chat + manual fetch may run at all. */
  aiEnabled: boolean;
  /** The web-search manual lookup specifically may run. Implies aiEnabled. */
  autoFetchEnabled: boolean;
  /** Effective monthly cap in USD, or null for "no cap configured". */
  budgetCapUsd: number | null;
  /** True when the deployment itself forbids AI, so the UI can explain that
   * the household toggle is present but cannot take effect here. */
  blockedByDeployment: boolean;
}

const DISABLED_VALUES = new Set(["false", "0", "off", "no"]);

function envFlagEnabled(raw: string | undefined, fallback = true): boolean {
  if (raw === undefined) return fallback;
  const flag = raw.trim().toLowerCase();
  if (flag === "") return fallback;
  return !DISABLED_VALUES.has(flag);
}

/** Deployment-level permission for any AI call: the flag is not explicitly
 * disabled AND a key is configured. Mirrors the historical aiEnabled() in
 * lib/ai/anthropic.ts, which remains the low-level env-only check. */
export function envAiAllowed(): boolean {
  return envFlagEnabled(process.env.AI_ENABLED) && Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Deployment-level permission for the manual lookup. Historically this was
 * only ever compared against the literal string "false"; that behaviour is
 * preserved via envFlagEnabled's default-true. */
export function envAutoFetchAllowed(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_AUTOFETCH_ENABLED);
}

/** Parses GLOBAL_BUDGET_CAP_USD. Returns null for unset/empty ("no cap
 * configured") and for a malformed or negative value -- a typo must not
 * silently become a cap of zero that blocks every request. */
export function envBudgetCapUsd(): number | null {
  const raw = process.env.GLOBAL_BUDGET_CAP_USD;
  if (raw === undefined || raw.trim() === "") return null;
  const cap = Number(raw);
  if (!Number.isFinite(cap) || cap < 0) return null;
  return cap;
}

interface HouseholdAiRow {
  ai_enabled: boolean | null;
  manual_autofetch_enabled: boolean | null;
  ai_monthly_budget_usd: number | string | null;
}

/**
 * Reads the household's stored AI settings and folds them together with the
 * environment. Uses the admin client because callers are route handlers and
 * server components that need a consistent answer regardless of whose
 * session is in play; the householdId is always one the caller has already
 * been authorised for (via requireHousehold() or an RLS-scoped lookup).
 *
 * Fails SAFE, not open: if the row can't be read, AI is reported off rather
 * than assumed on, so a database problem can't authorise spend.
 */
export async function getAiSettings(householdId: string): Promise<ResolvedAiSettings> {
  const envAi = envAiAllowed();
  const envFetch = envAutoFetchAllowed();
  const blockedByDeployment = !envAi;

  let row: HouseholdAiRow | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("households")
      .select("ai_enabled, manual_autofetch_enabled, ai_monthly_budget_usd")
      .eq("id", householdId)
      .maybeSingle<HouseholdAiRow>();

    if (error) {
      console.error("getAiSettings: query failed", error.code, error.message);
      return { aiEnabled: false, autoFetchEnabled: false, budgetCapUsd: envBudgetCapUsd(), blockedByDeployment };
    }
    row = data;
  } catch (err) {
    console.error("getAiSettings: unexpected failure", err instanceof Error ? err.message : err);
    return { aiEnabled: false, autoFetchEnabled: false, budgetCapUsd: envBudgetCapUsd(), blockedByDeployment };
  }

  // A missing row is treated as defaults-on; the columns are NOT NULL with
  // defaults, so this only happens for a household id that no longer exists,
  // in which case the caller's own lookup will fail anyway.
  const dbAi = row?.ai_enabled ?? true;
  const dbFetch = row?.manual_autofetch_enabled ?? true;

  const aiEnabled = envAi && dbAi;

  return {
    aiEnabled,
    // Auto-fetch is a strict subset of AI: turning the assistant off must
    // also stop paying for lookups, regardless of the fetch flag.
    autoFetchEnabled: aiEnabled && envFetch && dbFetch,
    budgetCapUsd: resolveBudgetCap(row?.ai_monthly_budget_usd),
    blockedByDeployment,
  };
}

/** Household value wins when set (including 0, a deliberate hard stop);
 * otherwise fall back to the deployment-wide cap. numeric comes back from
 * PostgREST as a string, so it is normalised here. */
function resolveBudgetCap(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined) return envBudgetCapUsd();
  const cap = typeof raw === "string" ? Number(raw) : raw;
  if (!Number.isFinite(cap) || cap < 0) return envBudgetCapUsd();
  return cap;
}
