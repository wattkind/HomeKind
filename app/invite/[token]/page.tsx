import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteAcceptCard } from "./invite-accept-card";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return (
    <div className="column" style={{ paddingBlock: "48px" }}>
      <p className="eyebrow">Invite</p>
      <h1>Join this household?</h1>
      <div className="card" style={{ marginTop: "24px" }}>
        <InviteAcceptCard token={token} />
      </div>
    </div>
  );
}
