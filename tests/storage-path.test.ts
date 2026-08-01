import { describe, expect, it } from "vitest";
import { documentPath } from "../lib/storage";

const HOUSEHOLD_ID = "11111111-1111-1111-1111-111111111111";
const DEVICE_ID = "22222222-2222-2222-2222-222222222222";

describe("documentPath", () => {
  it("has the shape households/<household>/devices/<device>/<uuid>.<ext>", () => {
    const path = documentPath(HOUSEHOLD_ID, DEVICE_ID, "manual.pdf");
    const parts = path.split("/");

    expect(parts[0]).toBe("households");
    expect(parts[1]).toBe(HOUSEHOLD_ID);
    expect(parts[2]).toBe("devices");
    expect(parts[3]).toBe(DEVICE_ID);
    expect(parts[4]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/,
    );
  });

  it("matches storage.foldername(name)[2] === householdId (split('/')[1])", () => {
    // supabase's storage.foldername() is 1-indexed in SQL; the JS equivalent
    // of (storage.foldername(name))[2] is path.split("/")[1] in a 0-indexed
    // array, since foldername strips the filename and 1-indexes the rest.
    const path = documentPath(HOUSEHOLD_ID, DEVICE_ID, "receipt.png");
    expect(path.split("/")[1]).toBe(HOUSEHOLD_ID);
  });

  it("lowercases an uppercase/mixed-case extension", () => {
    const path = documentPath(HOUSEHOLD_ID, DEVICE_ID, "Manual.PDF");
    expect(path.endsWith(".pdf")).toBe(true);
  });

  for (const ext of ["pdf", "jpg", "jpeg", "png", "webp", "heic"]) {
    it(`keeps the allow-listed extension .${ext}`, () => {
      const path = documentPath(HOUSEHOLD_ID, DEVICE_ID, `file.${ext}`);
      expect(path.endsWith(`.${ext}`)).toBe(true);
    });
  }

  it("falls back to .bin for an extension outside the allow-list (locked-in current behaviour)", () => {
    const path = documentPath(HOUSEHOLD_ID, DEVICE_ID, "invoice.exe");
    expect(path.endsWith(".bin")).toBe(true);
  });

  it("falls back to .bin when there is no extension at all", () => {
    const path = documentPath(HOUSEHOLD_ID, DEVICE_ID, "README");
    expect(path.endsWith(".bin")).toBe(true);
  });

  it("falls back to .bin for a dotfile with no extension after the dot", () => {
    // lastIndexOf(".") finds the leading dot; the slice after it is empty,
    // which is not in the allow-list.
    const path = documentPath(HOUSEHOLD_ID, DEVICE_ID, ".env");
    expect(path.endsWith(".bin")).toBe(true);
  });

  it("produces a unique path on every call, even for the same inputs", () => {
    const paths = new Set(
      Array.from({ length: 50 }, () => documentPath(HOUSEHOLD_ID, DEVICE_ID, "manual.pdf")),
    );
    expect(paths.size).toBe(50);
  });
});
