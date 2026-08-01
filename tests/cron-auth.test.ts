import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route (and lib/supabase/admin, lib/push/send) import "server-only",
// which throws unconditionally unless Next's webpack config aliases it away
// for a real server bundle. Under plain Node/vitest there is no such alias,
// so stub it to a no-op — this only guards against accidental client-bundle
// imports and has no bearing on the auth-gate logic under test.
vi.mock("server-only", () => ({}));

// Unit-tests only the auth gate at the top of app/api/cron/warranty-check/route.ts
// (CRON_SECRET presence + constant-time Bearer comparison) without touching a
// real database. lib/supabase/admin's createAdminClient() throws synchronously
// if Supabase env vars are missing (see lib/supabase/admin.ts), so once a
// request clears the gate we mock it out to prove the gate itself passed,
// rather than asserting on whatever happens next.
//
// vi.resetModules() + a fresh dynamic import per test is required because the
// route reads process.env.CRON_SECRET once, inline, at request time (not at
// module load), but we still reset modules between cases for isolation from
// the vi.mock registrations below.

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://homekind.wattkind.ai/api/cron/warranty-check", { headers });
}

describe("GET /api/cron/warranty-check (auth gate)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/supabase/admin");
  });

  it("returns 503 cron_disabled when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    delete process.env.CRON_SECRET;

    const { GET } = await import("../app/api/cron/warranty-check/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "cron_disabled" });
  });

  it("returns 401 when no Authorization header is provided", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");

    const { GET } = await import("../app/api/cron/warranty-check/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("returns 401 for a wrong secret of the same length", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret-value");

    const { GET } = await import("../app/api/cron/warranty-check/route");
    const res = await GET(makeRequest({ authorization: "Bearer test-secret-VALUE" }));

    expect(res.status).toBe(401);
  });

  it("returns 401 for a wrong-length secret, without crashing timingSafeEqual", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");

    const { GET } = await import("../app/api/cron/warranty-check/route");
    // Deliberately much shorter/longer than "Bearer test-secret" so a naive
    // timingSafeEqual(providedBuffer, expectedBuffer) would throw on a raw
    // length mismatch; the route hashes both sides first so this must not
    // throw and must simply deny access.
    const res = await GET(makeRequest({ authorization: "Bearer x" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("clears the gate on the correct secret (does not return 401/503)", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");
    // No Supabase env configured: createAdminClient() throws synchronously,
    // which is enough to prove the gate let the request past auth (a route
    // that failed the gate would have already returned before reaching
    // createAdminClient at all). We only assert it did not return the gate's
    // own failure statuses.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { GET } = await import("../app/api/cron/warranty-check/route");

    let res: Response | undefined;
    let threw = false;
    try {
      res = await GET(makeRequest({ authorization: "Bearer correct-secret" }));
    } catch {
      // createAdminClient() throwing past the gate is expected here; the
      // assertion below is about what does NOT happen (the gate itself).
      threw = true;
    }

    if (!threw) {
      expect(res!.status).not.toBe(401);
      expect(res!.status).not.toBe(503);
    }
  });

  it("with the gate mocked open, an empty database yields 200 {checked:0,...}", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");

    // Chainable "thenable" stand-in for the Supabase query builder: every
    // filter method (.is/.not/.eq/.in/.select) returns itself so any chain
    // length works, and it resolves like a promise to an empty result set.
    function emptyQuery(): PromiseLike<{ data: unknown[]; error: null }> & Record<string, unknown> {
      const result = { data: [] as unknown[], error: null };
      const chain: Record<string, unknown> = {
        select: () => chain,
        is: () => chain,
        not: () => chain,
        eq: () => chain,
        in: () => chain,
        then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain as PromiseLike<{ data: unknown[]; error: null }> & Record<string, unknown>;
    }

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from: () => emptyQuery(),
      }),
    }));

    const { GET } = await import("../app/api/cron/warranty-check/route");
    const res = await GET(makeRequest({ authorization: "Bearer correct-secret" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checked: 0, sent: 0, deduped: 0, pruned: 0 });
  });
});
