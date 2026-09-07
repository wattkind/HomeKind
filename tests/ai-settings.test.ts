import { beforeEach, describe, expect, it, vi } from "vitest";

// lib/ai/settings imports "server-only" (and lib/supabase/admin, transitively),
// which throws unconditionally under plain Node/vitest because there is no
// Next webpack alias to strip it. Same stub as tests/cron-auth.test.ts.
vi.mock("server-only", () => ({}));

// The admin client is only reached by getAiSettings(); the env-layer helpers
// and the budget resolution under test here never touch it. Stubbed so
// importing the module can't throw on missing Supabase env vars.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("not used in these tests");
  },
}));

async function loadSettings() {
  return import("../lib/ai/settings");
}

describe("envAiAllowed (deployment ceiling for any AI call)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("is true when a key is present and the flag is unset (default-on)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("AI_ENABLED", "");
    const { envAiAllowed } = await loadSettings();
    expect(envAiAllowed()).toBe(true);
  });

  it("is false without a key, however the flag is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("AI_ENABLED", "true");
    const { envAiAllowed } = await loadSettings();
    expect(envAiAllowed()).toBe(false);
  });

  it("treats every documented disabled spelling as off", async () => {
    for (const value of ["false", "0", "off", "no", "FALSE", " Off "]) {
      vi.resetModules();
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
      vi.stubEnv("AI_ENABLED", value);
      const { envAiAllowed } = await loadSettings();
      expect(envAiAllowed(), `AI_ENABLED=${JSON.stringify(value)}`).toBe(false);
    }
  });
});

describe("envAutoFetchAllowed", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("defaults to on when unset, preserving the historical behaviour", async () => {
    const { envAutoFetchAllowed } = await loadSettings();
    expect(envAutoFetchAllowed()).toBe(true);
  });

  it("is off only for an explicitly disabled value", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTOFETCH_ENABLED", "false");
    const { envAutoFetchAllowed } = await loadSettings();
    expect(envAutoFetchAllowed()).toBe(false);
  });

  it("stays on for an unrelated value rather than failing closed", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTOFETCH_ENABLED", "true");
    const { envAutoFetchAllowed } = await loadSettings();
    expect(envAutoFetchAllowed()).toBe(true);
  });
});

describe("envBudgetCapUsd", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns null when unset or empty (no cap configured, not a cap of zero)", async () => {
    const { envBudgetCapUsd } = await loadSettings();
    expect(envBudgetCapUsd()).toBeNull();

    vi.resetModules();
    vi.stubEnv("GLOBAL_BUDGET_CAP_USD", "   ");
    const again = await loadSettings();
    expect(again.envBudgetCapUsd()).toBeNull();
  });

  it("parses a normal cap", async () => {
    vi.stubEnv("GLOBAL_BUDGET_CAP_USD", "50");
    const { envBudgetCapUsd } = await loadSettings();
    expect(envBudgetCapUsd()).toBe(50);
  });

  it("keeps an explicit zero as a real cap of zero", async () => {
    vi.stubEnv("GLOBAL_BUDGET_CAP_USD", "0");
    const { envBudgetCapUsd } = await loadSettings();
    expect(envBudgetCapUsd()).toBe(0);
  });

  it("returns null (no cap) for junk or a negative, never a zero cap that blocks everything", async () => {
    for (const value of ["abc", "-5", "NaN"]) {
      vi.resetModules();
      vi.stubEnv("GLOBAL_BUDGET_CAP_USD", value);
      const { envBudgetCapUsd } = await loadSettings();
      expect(envBudgetCapUsd(), `GLOBAL_BUDGET_CAP_USD=${value}`).toBeNull();
    }
  });
});

describe("budgetExhausted (cap now supplied by the caller)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("never blocks when there is no cap, without even reading spend", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => {
        throw new Error("must not query spend when no cap is set");
      },
    }));
    const { budgetExhausted } = await import("../lib/ai/usage");
    await expect(budgetExhausted(null)).resolves.toBe(false);
  });

  it("blocks once spend reaches the cap, and not before", async () => {
    // 100_000 input tokens at $3/M = $0.30 exactly.
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            gte: () =>
              Promise.resolve({
                data: [{ model: "claude-sonnet-5", input_tokens: 100_000, output_tokens: 0 }],
                error: null,
              }),
          }),
        }),
      }),
    }));
    const { budgetExhausted } = await import("../lib/ai/usage");
    await expect(budgetExhausted(0.31)).resolves.toBe(false);
    await expect(budgetExhausted(0.3)).resolves.toBe(true);
    await expect(budgetExhausted(0)).resolves.toBe(true);
  });

  it("fails CLOSED on a read error, so a database blip can't blow the cap", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            gte: () => Promise.resolve({ data: null, error: { code: "500", message: "boom" } }),
          }),
        }),
      }),
    }));
    const { budgetExhausted } = await import("../lib/ai/usage");
    await expect(budgetExhausted(50)).resolves.toBe(true);
  });
});
