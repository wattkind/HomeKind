import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AiCodedError, toFailureCode, type AiFailureCode } from "../lib/ai/errors";

// Anthropic.APIError.generate(status, errorResponse, message, headers) is the
// same factory the SDK itself uses internally to pick the right subclass
// (AuthenticationError, RateLimitError, InternalServerError, ...) for a given
// HTTP status, so building fakes through it gives us real instanceof matches
// against exactly what toFailureCode() checks.
function sdkError(status: number): Error {
  return Anthropic.APIError.generate(status, { error: { message: "boom" } }, "boom", new Headers());
}

describe("toFailureCode", () => {
  it("maps 401 (bad/unauthorised key) to no_api_key", () => {
    expect(toFailureCode(sdkError(401))).toBe("no_api_key");
  });

  it("maps 403 (permission denied) to no_api_key", () => {
    expect(toFailureCode(sdkError(403))).toBe("no_api_key");
  });

  it("maps 429 (rate limited) to rate_limited", () => {
    expect(toFailureCode(sdkError(429))).toBe("rate_limited");
  });

  it("maps 500 (internal server error / overloaded) to api_error", () => {
    expect(toFailureCode(sdkError(500))).toBe("api_error");
  });

  it("maps 503 (overloaded, still >= 500) to api_error", () => {
    expect(toFailureCode(sdkError(503))).toBe("api_error");
  });

  it("maps a status the SDK still buckets as a generic APIError (e.g. 404) to api_error", () => {
    expect(toFailureCode(sdkError(404))).toBe("api_error");
  });

  it("maps a connection/network error (no status) to api_error", () => {
    const err = new Anthropic.APIConnectionError({ message: "network down" });
    expect(toFailureCode(err)).toBe("api_error");
  });

  it("maps a user-abort error to api_error", () => {
    const err = new Anthropic.APIUserAbortError();
    expect(toFailureCode(err)).toBe("api_error");
  });

  it("maps random junk (string, plain object, undefined) to api_error, never throwing", () => {
    expect(toFailureCode("just a string")).toBe("api_error");
    expect(toFailureCode({ some: "object" })).toBe("api_error");
    expect(toFailureCode(undefined)).toBe("api_error");
    expect(toFailureCode(null)).toBe("api_error");
    expect(toFailureCode(new Error("plain error, not an SDK type"))).toBe("api_error");
  });

  it("passes through an AiCodedError's own code untouched", () => {
    expect(toFailureCode(new AiCodedError("ai_disabled"))).toBe("ai_disabled");
    expect(toFailureCode(new AiCodedError("manual_missing"))).toBe("manual_missing");
    expect(toFailureCode(new AiCodedError("manual_too_large"))).toBe("manual_too_large");
    expect(toFailureCode(new AiCodedError("budget_exhausted"))).toBe("budget_exhausted");
    expect(toFailureCode(new AiCodedError("refusal"))).toBe("refusal");
    expect(toFailureCode(new AiCodedError("no_api_key"))).toBe("no_api_key");
  });

  it("passes through a plain object carrying a known .code, not just AiCodedError instances", () => {
    expect(toFailureCode({ code: "rate_limited" })).toBe("rate_limited");
  });

  it("does not treat an object with an unrecognised .code as pre-coded (falls through to api_error)", () => {
    expect(toFailureCode({ code: "not_a_real_code" })).toBe("api_error");
  });
});

describe("AiFailureCode union", () => {
  it("matches the documented set of codes exactly", () => {
    const documented: AiFailureCode[] = [
      "no_api_key",
      "ai_disabled",
      "manual_missing",
      "manual_too_large",
      "budget_exhausted",
      "rate_limited",
      "api_error",
      "refusal",
    ];

    // Exercise every member through AiCodedError to prove the type and the
    // runtime pass-through both accept exactly this set.
    for (const code of documented) {
      const err = new AiCodedError(code);
      expect(err.code).toBe(code);
      expect(toFailureCode(err)).toBe(code);
    }
    expect(documented).toHaveLength(8);
  });
});
