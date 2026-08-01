import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership) {
    redirect("/home");
  }

  return (
    <div className="column" style={{ paddingBlock: "48px" }}>
      <p className="eyebrow">Get started</p>
      <h1>Set up your household</h1>
      <p>
        Give your household a name to get going. If someone's already invited you to
        join theirs, you don't need this — just open the invite link they sent you and
        you'll be added straight in.
      </p>

      <div className="card" style={{ marginTop: "24px" }}>
        <OnboardingForm />
      </div>
    </div>
  );
}
