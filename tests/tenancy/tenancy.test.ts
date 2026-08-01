// Two-layer cross-household isolation suite, styled after StudyKind's
// server/src/rls.test.ts (read there for the technique this is adapted from —
// that file is a StudyKind-repo reference, read-only, never mirrored here
// verbatim). HomeKind's tenancy model differs (household_members grants
// direct table access to `authenticated`, gated by Row Level Security using
// public.current_household_ids(), rather than StudyKind's "no grant at all"
// pattern) so this suite exercises RLS itself, not a table-grant denial.
//
// *** WARNING: LOCAL SUPABASE STACK ONLY ***
// TENANCY_TEST_URL / TENANCY_TEST_SERVICE_ROLE_KEY / TENANCY_TEST_ANON_KEY
// must point at a disposable `supabase start` instance on your machine, never
// at a hosted/staging/production Supabase project. This suite creates and
// deletes real auth users and inserts real household data. There is no
// tenant-prefixing or cleanup guarantee strong enough to make this safe to
// run against a shared project.
//
// Env-gated: with any of the three vars unset, the whole suite is skipped
// (describe.skipIf), so CI (which has no Supabase) runs green with zero
// Supabase calls.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TENANCY_TEST_URL = process.env.TENANCY_TEST_URL;
const TENANCY_TEST_SERVICE_ROLE_KEY = process.env.TENANCY_TEST_SERVICE_ROLE_KEY;
const TENANCY_TEST_ANON_KEY = process.env.TENANCY_TEST_ANON_KEY;

const RUN = Boolean(TENANCY_TEST_URL && TENANCY_TEST_SERVICE_ROLE_KEY && TENANCY_TEST_ANON_KEY);

describe.skipIf(!RUN)("tenancy: cross-household isolation (local Supabase only)", () => {
  // --- fixtures, created in beforeAll and torn down in afterAll -------------
  let admin: SupabaseClient;
  let anonKey: string;
  let url: string;

  let userAId: string;
  let userBId: string;
  let clientA: SupabaseClient; // signed in as user A (anon key + user JWT)
  let clientB: SupabaseClient; // signed in as user B

  let householdA: string;
  let householdB: string;
  let roomA: string;
  let deviceA: string;
  let deviceB: string;

  const emailA = `tenancy-a-${Date.now()}@example.test`;
  const emailB = `tenancy-b-${Date.now()}@example.test`;
  const password = "correct horse battery staple 1!";

  function userClient(): SupabaseClient {
    // A fresh client per sign-in, exactly like the app: anon key only, no
    // service-role, RLS fully in effect.
    return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  beforeAll(async () => {
    url = TENANCY_TEST_URL!;
    anonKey = TENANCY_TEST_ANON_KEY!;
    admin = createClient(url, TENANCY_TEST_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: createdA, error: errA } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    if (errA || !createdA.user) throw new Error(`failed to create user A: ${errA?.message}`);
    userAId = createdA.user.id;

    const { data: createdB, error: errB } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (errB || !createdB.user) throw new Error(`failed to create user B: ${errB?.message}`);
    userBId = createdB.user.id;

    clientA = userClient();
    const { error: signInAErr } = await clientA.auth.signInWithPassword({ email: emailA, password });
    if (signInAErr) throw new Error(`failed to sign in user A: ${signInAErr.message}`);

    clientB = userClient();
    const { error: signInBErr } = await clientB.auth.signInWithPassword({ email: emailB, password });
    if (signInBErr) throw new Error(`failed to sign in user B: ${signInBErr.message}`);

    const { data: hhA, error: hhAErr } = await clientA.rpc("create_household_with_defaults", {
      p_name: "Household A",
    });
    if (hhAErr || !hhA) throw new Error(`failed to create household A: ${hhAErr?.message}`);
    householdA = hhA as unknown as string;

    const { data: hhB, error: hhBErr } = await clientB.rpc("create_household_with_defaults", {
      p_name: "Household B",
    });
    if (hhBErr || !hhB) throw new Error(`failed to create household B: ${hhBErr?.message}`);
    householdB = hhB as unknown as string;

    const { data: roomsA } = await clientA.from("rooms").select("id").eq("household_id", householdA).limit(1);
    roomA = roomsA?.[0]?.id;
  });

  afterAll(async () => {
    // Best-effort cleanup: deleting the auth users cascades to their
    // households/devices/etc via the ON DELETE CASCADE foreign keys in the
    // initial migration. Storage objects are removed explicitly since Storage
    // isn't part of that cascade.
    try {
      await admin.storage.from("device-documents").remove([
        `households/${householdA}/devices/${deviceA}/x.pdf`,
      ]);
    } catch {
      // best-effort
    }
    if (userAId) await admin.auth.admin.deleteUser(userAId).catch(() => {});
    if (userBId) await admin.auth.admin.deleteUser(userBId).catch(() => {});
  });

  it("user A sees their own household after onboarding", async () => {
    const { data } = await clientA.from("households").select("id").eq("id", householdA);
    expect(data).toHaveLength(1);
  });

  it("user A sees their own default rooms", async () => {
    const { data } = await clientA.from("rooms").select("id").eq("household_id", householdA);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("user A can insert and then see their own device", async () => {
    const { data, error } = await clientA
      .from("devices")
      .insert({ household_id: householdA, room_id: roomA, name: "Fridge" })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    deviceA = data!.id;

    const { data: seen } = await clientA.from("devices").select("id").eq("id", deviceA);
    expect(seen).toHaveLength(1);
  });

  it("user B can insert their own device (needed as a cross-household target below)", async () => {
    const { data: roomsB } = await clientB.from("rooms").select("id").eq("household_id", householdB).limit(1);
    const { data, error } = await clientB
      .from("devices")
      .insert({ household_id: householdB, room_id: roomsB?.[0]?.id, name: "Dishwasher" })
      .select("id")
      .single();
    expect(error).toBeNull();
    deviceB = data!.id;
  });

  it("user A cannot select household B's household row", async () => {
    const { data } = await clientA.from("households").select("id").eq("id", householdB);
    expect(data ?? []).toEqual([]);
  });

  it("user A cannot select household B's rooms", async () => {
    const { data } = await clientA.from("rooms").select("id").eq("household_id", householdB);
    expect(data ?? []).toEqual([]);
  });

  it("user A cannot select household B's devices", async () => {
    const { data } = await clientA.from("devices").select("id").eq("id", deviceB);
    expect(data ?? []).toEqual([]);
  });

  it("user A cannot insert a device into household B", async () => {
    const { data, error } = await clientA
      .from("devices")
      .insert({ household_id: householdB, name: "Sneaky microwave" })
      .select("id");
    // RLS with-check failure: either an explicit error, or (depending on
    // Postgres/PostgREST version) zero rows returned -- never a successful
    // insert into someone else's household.
    expect(error !== null || (data ?? []).length === 0).toBe(true);

    const { data: check } = await admin.from("devices").select("id").eq("household_id", householdB).eq(
      "name",
      "Sneaky microwave",
    );
    expect(check ?? []).toEqual([]);
  });

  it("user A cannot update household B's device", async () => {
    await clientA.from("devices").update({ name: "hacked" }).eq("id", deviceB);

    const { data } = await admin.from("devices").select("name").eq("id", deviceB).single();
    expect(data?.name).toBe("Dishwasher");
  });

  describe("storage: device-documents bucket", () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"

    it("user A can upload into their own household's folder", async () => {
      const path = `households/${householdA}/devices/${deviceA}/x.pdf`;
      const { error } = await clientA.storage
        .from("device-documents")
        .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
      expect(error).toBeNull();
    });

    it("user B cannot download user A's document", async () => {
      const path = `households/${householdA}/devices/${deviceA}/x.pdf`;
      const { data, error } = await clientB.storage.from("device-documents").download(path);
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    it("user B cannot upload into user A's household folder", async () => {
      const path = `households/${householdA}/devices/${deviceA}/evil.pdf`;
      const { error } = await clientB.storage
        .from("device-documents")
        .upload(path, pdfBytes, { contentType: "application/pdf" });
      expect(error).not.toBeNull();
    });
  });

  describe("invites", () => {
    let inviteAId: string;

    it("user A can create an invite for their own household", async () => {
      const tokenHash = await sha256Hex(`invite-token-${Date.now()}`);
      const { data, error } = await clientA
        .from("invites")
        .insert({
          household_id: householdA,
          token_hash: tokenHash,
          created_by: userAId,
          expires_at: new Date(Date.now() + 86400_000).toISOString(),
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      inviteAId = data!.id;
    });

    it("user B cannot see user A's invites", async () => {
      const { data } = await clientB.from("invites").select("id").eq("id", inviteAId);
      expect(data ?? []).toEqual([]);
    });
  });

  describe("simulated invite acceptance", () => {
    it("after admin adds user B as a member of household A, user B can see household A's devices", async () => {
      const { error } = await admin
        .from("household_members")
        .insert({ household_id: householdA, user_id: userBId, role: "member" });
      expect(error).toBeNull();

      const { data } = await clientB.from("devices").select("id").eq("id", deviceA);
      expect(data).toHaveLength(1);
    });

    it("after that membership row is deleted, user B's access is revoked again", async () => {
      const { error } = await admin
        .from("household_members")
        .delete()
        .eq("household_id", householdA)
        .eq("user_id", userBId);
      expect(error).toBeNull();

      const { data } = await clientB.from("devices").select("id").eq("id", deviceA);
      expect(data ?? []).toEqual([]);
    });
  });
});

// sha256 hex digest via Web Crypto (available in the Node test runtime),
// matching how the app hashes invite tokens before storing token_hash.
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
