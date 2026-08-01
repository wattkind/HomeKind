import { describe, expect, it } from "vitest";
import { matchesQuery } from "../lib/search";

const device = { name: "Dishwasher", brand: "Bosch", model_number: "SMS46KI01A" };

describe("matchesQuery", () => {
  it("matches on name, case-insensitively", () => {
    expect(matchesQuery(device, "dish")).toBe(true);
    expect(matchesQuery(device, "DISH")).toBe(true);
    expect(matchesQuery(device, "DiSh")).toBe(true);
  });

  it("matches a substring of the brand", () => {
    expect(matchesQuery(device, "bos")).toBe(true);
    expect(matchesQuery(device, "BOSCH")).toBe(true);
  });

  it("matches a substring of the model number", () => {
    expect(matchesQuery(device, "sms46")).toBe(true);
    expect(matchesQuery(device, "ki01a")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(matchesQuery(device, "fridge")).toBe(false);
  });

  it("treats a null brand as an empty haystack, not a match/throw", () => {
    const noBrand = { name: "Dishwasher", brand: null, model_number: "SMS46KI01A" };
    expect(matchesQuery(noBrand, "bosch")).toBe(false);
    expect(matchesQuery(noBrand, "dish")).toBe(true);
  });

  it("treats a null model_number as an empty haystack, not a match/throw", () => {
    const noModel = { name: "Dishwasher", brand: "Bosch", model_number: null };
    expect(matchesQuery(noModel, "sms46")).toBe(false);
    expect(matchesQuery(noModel, "bosch")).toBe(true);
  });

  it("treats both brand and model_number as null without throwing", () => {
    const bare = { name: "Dishwasher", brand: null, model_number: null };
    expect(matchesQuery(bare, "dish")).toBe(true);
    expect(matchesQuery(bare, "anything")).toBe(false);
  });

  it("an empty query matches everything", () => {
    expect(matchesQuery(device, "")).toBe(true);
  });

  it("a whitespace-only query matches everything", () => {
    expect(matchesQuery(device, "   ")).toBe(true);
    expect(matchesQuery(device, "\t\n")).toBe(true);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(matchesQuery(device, "  dish  ")).toBe(true);
  });
});
