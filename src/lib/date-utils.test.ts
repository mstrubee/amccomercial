import { describe, it, expect } from "vitest";
import { safeFormatDate } from "./date-utils";

describe("safeFormatDate", () => {
  it("formats a valid ISO date string", () => {
    expect(safeFormatDate("2026-01-15", "yyyy")).toBe("2026");
  });

  it("formats a valid Date instance", () => {
    expect(safeFormatDate(new Date("2026-01-15T00:00:00Z"), "yyyy")).toBe("2026");
  });

  it("returns the fallback for an empty string", () => {
    expect(safeFormatDate("", "dd MMM yyyy")).toBe("—");
  });

  it("returns the fallback for null / undefined", () => {
    expect(safeFormatDate(null, "dd MMM yyyy")).toBe("—");
    expect(safeFormatDate(undefined, "dd MMM yyyy")).toBe("—");
  });

  it("returns the fallback for a malformed date instead of throwing", () => {
    expect(safeFormatDate("basura", "dd MMM yyyy")).toBe("—");
    expect(safeFormatDate(new Date("nope"), "dd MMM yyyy")).toBe("—");
  });

  it("honors a custom fallback", () => {
    expect(safeFormatDate("", "HH:mm", undefined, "")).toBe("");
  });
});
