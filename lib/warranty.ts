// Pure warranty-date helpers. No imports beyond std — safe to use from both
// client components (warranty-banner) and server code (cron route) without
// pulling in any framework or Supabase types.
//
// warranty_end is a Postgres DATE column (e.g. "2026-09-15"), which carries no
// time-of-day or timezone. The one thing that must never happen here is
// `new Date("2026-09-15")` / `Date.parse(...)`: that string form is parsed as
// UTC midnight, so in any timezone west of UTC it prints as the *previous*
// local day — a warranty ending "today" would look like it ended yesterday.
// Instead we split the y/m/d parts ourselves and construct a local Date, and
// compare against a local "today" built the same way, so both sides of the
// subtraction live in the same (local, midnight-aligned) frame.

function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days from `now` (default: real current time) until `warrantyEnd`.
 * Date-only semantics: today -> 0, tomorrow -> 1, yesterday -> -1.
 */
export function daysUntil(warrantyEnd: string, now: Date = new Date()): number {
  const end = parseDateOnly(warrantyEnd);
  const today = startOfLocalDay(now);
  return Math.round((end.getTime() - today.getTime()) / MS_PER_DAY);
}

/**
 * True when the warranty ends within [0, thresholdDays] days from now,
 * inclusive of both ends (today counts as expiring; a warranty that ended
 * in the past does not).
 */
export function isExpiringWithin(
  warrantyEnd: string,
  thresholdDays: number,
  now: Date = new Date(),
): boolean {
  const days = daysUntil(warrantyEnd, now);
  return days >= 0 && days <= thresholdDays;
}
