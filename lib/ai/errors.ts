import Anthropic from "@anthropic-ai/sdk";

/**
 * Contract: AI failures are never thrown to the user as a bare 500. Every
 * route that calls into lib/ai/anthropic.ts catches SDK/network errors,
 * converts them with toFailureCode(), and emits either a JSON body
 * `{ ok: false, error: code }` (pre-stream) or an SSE `event: error` /
 * `data: {"code": code}` frame (mid-stream). Nothing here should ever
 * propagate as an unhandled exception into a Next.js route handler.
 */
export type AiFailureCode =
  | "no_api_key"
  | "ai_disabled"
  | "manual_missing"
  | "manual_too_large"
  | "budget_exhausted"
  | "rate_limited"
  | "api_error"
  | "refusal";

/**
 * Maps an error thrown by the Anthropic SDK (or a network/transport failure)
 * to a stable, user-facing failure code. Never throws.
 *
 * - 401/403 (bad or unauthorised key) -> no_api_key
 * - 429 (rate limited)                -> rate_limited
 * - 5xx / overloaded / network error  -> api_error
 * - anything else                     -> api_error (fail closed to a generic,
 *   non-leaky code rather than surfacing raw provider detail to the client)
 */
const FAILURE_CODES = new Set<AiFailureCode>([
  "no_api_key",
  "ai_disabled",
  "manual_missing",
  "manual_too_large",
  "budget_exhausted",
  "rate_limited",
  "api_error",
  "refusal",
]);

/** True if err was raised by this package with an already-known failure code
 * attached (see AiCodedError below), rather than a raw SDK/network error. */
function hasKnownCode(err: unknown): err is { code: AiFailureCode } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    FAILURE_CODES.has((err as { code: unknown }).code as AiFailureCode)
  );
}

/**
 * Error class for failures raised directly by this package (missing key,
 * AI disabled, budget exhausted, etc.) rather than by the Anthropic SDK.
 * toFailureCode() recognises these before falling back to SDK error mapping.
 */
export class AiCodedError extends Error {
  readonly code: AiFailureCode;
  constructor(code: AiFailureCode, message?: string) {
    super(message ?? code);
    this.name = "AiCodedError";
    this.code = code;
  }
}

export function toFailureCode(err: unknown): AiFailureCode {
  if (hasKnownCode(err)) {
    return err.code;
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return "no_api_key";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "rate_limited";
  }
  if (err instanceof Anthropic.APIError) {
    // Covers InternalServerError (5xx) and any other non-2xx status
    // (400/404/409/422/etc.) — none of these should ever become a 500 for
    // the end user, so they all fail closed to the generic api_error code.
    return "api_error";
  }
  // APIConnectionError, APIUserAbortError, or any non-SDK error (thrown
  // string, plain object, etc.) — treat as a generic provider/network issue.
  return "api_error";
}
