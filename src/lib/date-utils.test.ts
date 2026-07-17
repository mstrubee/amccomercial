import { describe, it, expect } from "vitest";
import { safeFormatDate, parseLocalDate, todayLocalISO } from "./date-utils";

describe("safeFormatDate", () => {
  it("formats a valid ISO date string", () => {
    expect(safeFormatDate("2026-01-15", "yyyy")).toBe("2026");
  });

  it("keeps the calendar day for a date-only string (no UTC off-by-one)", () => {
    // Regardless of the runner's timezone, a date-only value must render the
    // same day it names — not the day before.
    expect(safeFormatDate("2026-07-16", "yyyy-MM-dd")).toBe("2026-07-16");
    expect(safeFormatDate("2026-01-01", "dd")).toBe("01");
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

describe("parseLocalDate", () => {
  it("parses a date-only string at local noon, preserving the calendar day", () => {
    const d = parseLocalDate("2026-07-16");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July (0-indexed)
    expect(d.getDate()).toBe(16);
  });
});

describe("todayLocalISO", () => {
  it("returns a YYYY-MM-DD string matching the local date", () => {
    const s = todayLocalISO();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(s).toBe(expected);
  });
});
