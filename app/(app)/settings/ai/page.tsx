import { requireHousehold } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiSettings, envAutoFetchAllowed } from "@/lib/ai/settings";
import { monthlySpendUsd } from "@/lib/ai/usage";
import { AiSettingsClient } from "./ai-settings-client";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const { householdId, role } = await requireHousehold();

  // The stored values, not the resolved ones — the toggles must show what the
  // household chose, so turning a switch back on isn't silently a no-op when
  // the deployment is the thing holding it off. getAiSettings() is read
  // alongside purely to report that deployment state.
  const admin = createAdminClient();
  const { data: stored } = await admin
    .from("households")
    .select("ai_enabled, manual_autofetch_enabled, ai_monthly_budget_usd")
    .eq("id", householdId)
    .maybeSingle();

  const resolved = await getAiSettings(householdId);
  const spendUsd = await monthlySpendUsd(householdId);

  return (
    <div style={{ display: "grid", gap: "24px", paddingBlock: "24px" }}>
      <div>
        <p className="eyebrow">Settings</p>
        <h1>AI assistant</h1>
      </div>

      <AiSettingsClient
        householdId={householdId}
        isOwner={role === "owner"}
        initialAiEnabled={stored?.ai_enabled ?? true}
        initialAutoFetchEnabled={stored?.manual_autofetch_enabled ?? true}
        initialBudgetUsd={stored?.ai_monthly_budget_usd == null ? null : Number(stored.ai_monthly_budget_usd)}
        effectiveBudgetUsd={resolved.budgetCapUsd}
        spendUsd={spendUsd}
        blockedByDeployment={resolved.blockedByDeployment}
        autoFetchBlockedByDeployment={!envAutoFetchAllowed()}
      />
    </div>
  );
}
