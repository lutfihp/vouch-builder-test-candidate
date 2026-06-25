import { describe, it, expect } from "vitest";
import { applyUrgency } from "../src/reconcile/urgency.js";
import type { Issue, Fact } from "../src/types.js";

const baseFact = (over: Partial<Fact>): Fact => ({
  id: "f", hotelId: "h", shiftId: "2026-05-30",
  topic: "deposit", kind: "open", summary: "",
  evidence: [{ source: "event", eventId: "e" }], confidence: "high",
  ...over,
});

const issue = (over: Partial<Issue>): Issue => ({
  id: "iss", hotelId: "h", topic: "deposit",
  status: "open", urgency: "normal",
  firstSeenShift: "2026-05-30", lastUpdatedShift: "2026-05-30",
  timeline: [baseFact({})], flags: [],
  ...over,
});

describe("applyUrgency", () => {
  it("U001 marks compliance_passport urgent when older than 24h", () => {
    const i = applyUrgency([
      issue({ topic: "compliance_passport", firstSeenShift: "2026-05-27", lastUpdatedShift: "2026-05-30" }),
    ], "2026-05-30");
    expect(i[0]!.urgency).toBe("urgent");
    expect(i[0]!.urgencyRuleId).toBe("U001");
  });

  it("U003 marks a corridor leak urgent on keyword match", () => {
    const i = applyUrgency([
      issue({ topic: "facilities_common", timeline: [baseFact({ summary: "Water leak in 2nd floor corridor" })] }),
    ], "2026-05-30");
    expect(i[0]!.urgencyRuleId).toBe("U003");
  });

  it("U004 marks damage urgent when no photos or approval", () => {
    const i = applyUrgency([
      issue({ topic: "damage", timeline: [baseFact({ summary: "Housekeeping found a cracked basin. No photos were taken and there is no manager approval on record yet." })] }),
    ], "2026-05-30");
    expect(i[0]!.urgencyRuleId).toBe("U004");
  });

  it("U005 marks deposit urgent after >= 2 nights unresolved", () => {
    const i = applyUrgency([
      issue({ topic: "deposit", firstSeenShift: "2026-05-27", lastUpdatedShift: "2026-05-30", status: "open" }),
    ], "2026-05-30");
    expect(i[0]!.urgencyRuleId).toBe("U005");
  });

  it("U006 marks dispute_charge urgent whenever open", () => {
    const i = applyUrgency([
      issue({ topic: "dispute_charge", status: "open" }),
    ], "2026-05-30");
    expect(i[0]!.urgencyRuleId).toBe("U006");
  });

  it("does not mark resolved issues urgent", () => {
    const i = applyUrgency([
      issue({ topic: "dispute_charge", status: "resolved" }),
    ], "2026-05-30");
    expect(i[0]!.urgency).toBe("normal");
  });
});
