import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function errorResponse(code: string, status: number) {
  return NextResponse.json({ code }, { status });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("not_authenticated", 401);
  }

  let token: unknown;
  try {
    const body = (await request.json()) as { token?: unknown };
    token = body.token;
  } catch {
    return errorResponse("invalid_token", 400);
  }

  if (typeof token !== "string" || token.length === 0) {
    return errorResponse("invalid_token", 400);
  }

  const tokenHash = await sha256Hex(token);
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("invites")
    .select("id, household_id, expires_at, accepted_by, accepted_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invite) {
    return errorResponse("invalid_token", 400);
  }

  if (invite.accepted_at) {
    if (invite.accepted_by === user.id) {
      return NextResponse.json({ ok: true });
    }
    return errorResponse("already_accepted", 409);
  }

  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return errorResponse("invite_expired", 410);
  }

  const { data: existingMembership } = await admin
    .from("household_members")
    .select("household_id")
    .eq("household_id", invite.household_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingMembership) {
    const { error: insertError } = await admin.from("household_members").insert({
      household_id: invite.household_id,
      user_id: user.id,
      role: "member",
    });

    // Ignore a unique-violation race (user accepted twice concurrently) —
    // any other insert failure is a genuine problem.
    if (insertError && insertError.code !== "23505") {
      return errorResponse("invalid_token", 400);
    }
  }

  await admin
    .from("invites")
    .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ ok: true });
}
