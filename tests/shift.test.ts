import { describe, it, expect } from "vitest";
import { shiftIdForTimestamp, shiftIdFromHeading } from "../src/reconcile/shift.js";

describe("shiftIdForTimestamp", () => {
  it("treats an early-morning event as the morning-of date", () => {
    expect(shiftIdForTimestamp("2026-05-26T00:20:00+08:00", "+08:00")).toBe("2026-05-26");
  });

  it("treats a late-evening event as the next morning's shift", () => {
    expect(shiftIdForTimestamp("2026-05-25T23:14:00+08:00", "+08:00")).toBe("2026-05-26");
  });

  it("handles a 07:00 boundary event as same morning shift", () => {
    expect(shiftIdForTimestamp("2026-05-26T06:55:00+08:00", "+08:00")).toBe("2026-05-26");
  });

  it("treats a 12:00 noon event as belonging to the next morning shift", () => {
    expect(shiftIdForTimestamp("2026-05-26T19:00:00+08:00", "+08:00")).toBe("2026-05-27");
  });
});

describe("shiftIdFromHeading", () => {
  it("extracts morning-of date from a Night→Morning heading", () => {
    expect(
      shiftIdFromHeading("Night of Wed 27 May → morning Thu 28 May (relief cover — system was down)", 2026)
    ).toBe("2026-05-28");
  });
});
