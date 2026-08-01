import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isExpiringWithin, daysUntil } from "@/lib/warranty";
import { sendPush } from "@/lib/push/send";

// Vercel Cron (see vercel.json, "0 21 * * *") hits this route once daily.
// Not behind normal user auth — protected instead by a shared secret so only
// the scheduler (or an operator with the secret) can trigger it, mirroring
// StudyKind's server/src/cron.ts requireCronSecret pattern.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Constant-time comparison of the Authorization header against the expected
 * bearer value. Both sides are hashed first so the buffers compared by
 * timingSafeEqual are always equal length (a raw length mismatch would
 * otherwise throw, or — if guarded with a plain `!==` short-circuit — leak a
 * timing signal on the very first byte).
 */
function safeEqual(provided: string, expected: string): boolean {
  const providedHash = crypto.createHash("sha256").update(provided).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

type Candidate = {
  deviceId: string;
  householdId: string;
  userId: string;
  deviceName: string;
  warrantyEnd: string;
  days: number;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Inert, not open: with no secret configured the endpoint can never be
    // triggered, rather than falling back to an unauthenticated state.
    return NextResponse.json({ error: "cron_disabled" }, { status: 503 });
  }

  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!safeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [{ data: members, error: membersError }, { data: devices, error: devicesError }] =
    await Promise.all([
      admin
        .from("household_members")
        .select("household_id, user_id, warranty_threshold_days"),
      admin
        .from("devices")
        .select("id, household_id, name, warranty_end")
        .is("deleted_at", null)
        .not("warranty_end", "is", null),
    ]);

  if (membersError || devicesError) {
    console.error(
      "warranty-check: failed to load members/devices",
      membersError?.code ?? devicesError?.code ?? "unknown",
    );
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const devicesByHousehold = new Map<string, typeof devices>();
  for (const device of devices ?? []) {
    const list = devicesByHousehold.get(device.household_id) ?? [];
    list.push(device);
    devicesByHousehold.set(device.household_id, list);
  }

  const candidates: Candidate[] = [];
  for (const member of members ?? []) {
    const householdDevices = devicesByHousehold.get(member.household_id) ?? [];
    for (const device of householdDevices) {
      if (!device.warranty_end) continue;
      if (!isExpiringWithin(device.warranty_end, member.warranty_threshold_days)) continue;
      candidates.push({
        deviceId: device.id,
        householdId: member.household_id,
        userId: member.user_id,
        deviceName: device.name,
        warrantyEnd: device.warranty_end,
        days: daysUntil(device.warranty_end),
      });
    }
  }

  const checked = candidates.length;

  if (checked === 0) {
    return NextResponse.json({ checked: 0, sent: 0, deduped: 0, pruned: 0 });
  }

  const deviceIds = [...new Set(candidates.map((c) => c.deviceId))];
  const { data: existingNotifications, error: notificationsError } = await admin
    .from("warranty_notifications")
    .select("device_id, user_id, warranty_end")
    .eq("channel", "push")
    .in("device_id", deviceIds);

  if (notificationsError) {
    console.error("warranty-check: failed to load existing notifications", notificationsError.code);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const alreadyNotified = new Set(
    (existingNotifications ?? []).map((n) => `${n.device_id}|${n.user_id}|${n.warranty_end}`),
  );

  const toNotify = candidates.filter(
    (c) => !alreadyNotified.has(`${c.deviceId}|${c.userId}|${c.warrantyEnd}`),
  );
  const deduped = checked - toNotify.length;

  if (toNotify.length === 0) {
    return NextResponse.json({ checked, sent: 0, deduped, pruned: 0 });
  }

  const userIds = [...new Set(toNotify.map((c) => c.userId))];
  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (subscriptionsError) {
    console.error("warranty-check: failed to load push subscriptions", subscriptionsError.code);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const subsByUser = new Map<string, typeof subscriptions>();
  for (const sub of subscriptions ?? []) {
    const list = subsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subsByUser.set(sub.user_id, list);
  }

  let sent = 0;
  let pruned = 0;
  const notificationInserts: {
    device_id: string;
    household_id: string;
    user_id: string;
    channel: "push";
    warranty_end: string;
  }[] = [];

  for (const candidate of toNotify) {
    const subs = subsByUser.get(candidate.userId) ?? [];
    if (subs.length === 0) continue;

    const body =
      candidate.days === 0
        ? `${candidate.deviceName} warranty ends today`
        : `${candidate.deviceName} warranty ends in ${candidate.days} days`;

    let anySent = false;
    for (const sub of subs) {
      const result = await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        { title: "Warranty reminder", body, url: `/devices/${candidate.deviceId}` },
      );

      if (result === "sent") {
        sent += 1;
        anySent = true;
      } else if (result === "gone") {
        pruned += 1;
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }

    if (anySent) {
      notificationInserts.push({
        device_id: candidate.deviceId,
        household_id: candidate.householdId,
        user_id: candidate.userId,
        channel: "push",
        warranty_end: candidate.warrantyEnd,
      });
    }
  }

  if (notificationInserts.length > 0) {
    const { error: insertError } = await admin
      .from("warranty_notifications")
      .insert(notificationInserts);
    if (insertError) {
      console.error("warranty-check: failed to insert notification markers", insertError.code);
    }
  }

  return NextResponse.json({ checked, sent, deduped, pruned });
}
