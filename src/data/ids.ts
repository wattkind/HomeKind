/** A new UUID v4 record id. */
export function newId(): string {
  return crypto.randomUUID();
}

/** The current time as an ISO 8601 timestamp. */
export function nowIso(): string {
  return new Date().toISOString();
}
