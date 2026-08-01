import Link from "next/link";
import { createClient, requireHousehold } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { householdId } = await requireHousehold();
  const supabase = await createClient();

  const { data: household } = await supabase
    .from("households")
    .select("name")
    .eq("id", householdId)
    .maybeSingle();

  return (
    <div style={{ display: "grid", gap: "20px", paddingBlock: "24px" }}>
      <div>
        <p className="eyebrow">Settings</p>
        <h1>{household?.name ?? "Your household"}</h1>
      </div>

      <nav style={{ display: "grid", gap: "14px" }} aria-label="Settings">
        <Link href="/settings/members" className="card">
          <h3>Members &amp; invites</h3>
          <p>See who&apos;s in your household, invite someone new, or leave.</p>
        </Link>
        <Link href="/settings/rooms" className="card">
          <h3>Rooms</h3>
          <p>Manage the rooms devices are grouped into.</p>
        </Link>
        <Link href="/settings/notifications" className="card">
          <h3>Notifications</h3>
          <p>Choose when you&apos;re reminded about warranties running out.</p>
        </Link>
      </nav>

      <form action="/auth/signout" method="post">
        <button type="submit" className="button secondary">
          Sign out
        </button>
      </form>
    </div>
  );
}
