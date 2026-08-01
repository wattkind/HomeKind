import { describe, expect, it } from "vitest";
import { daysUntil, isExpiringWithin } from "../lib/warranty";

describe("daysUntil", () => {
  it("is 0 for today", () => {
    const now = new Date(2026, 7, 1); // 2026-08-01 local
    expect(daysUntil("2026-08-01", now)).toBe(0);
  });

  it("is positive for a future date", () => {
    const now = new Date(2026, 7, 1);
    expect(daysUntil("2026-08-31", now)).toBe(30);
  });

  it("is negative for a past date", () => {
    const now = new Date(2026, 7, 1);
    expect(daysUntil("2026-07-01", now)).toBe(-31);
  });

  it("is not affected by time-of-day on `now`", () => {
    const now = new Date(2026, 7, 1, 23, 59, 59);
    expect(daysUntil("2026-08-02", now)).toBe(1);
  });
});

describe("isExpiringWithin", () => {
  const now = new Date(2026, 7, 1);

  it("is true exactly at the threshold", () => {
    expect(isExpiringWithin("2026-08-31", 30, now)).toBe(true);
  });

  it("is false just past the threshold", () => {
    expect(isExpiringWithin("2026-09-01", 30, now)).toBe(false);
  });

  it("is true for today", () => {
    expect(isExpiringWithin("2026-08-01", 30, now)).toBe(true);
  });

  it("is false for a warranty that already ended", () => {
    expect(isExpiringWithin("2026-07-31", 30, now)).toBe(false);
  });
});
