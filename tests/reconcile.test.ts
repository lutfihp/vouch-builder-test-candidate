import { describe, it, expect } from "vitest";
import { reconcile } from "../src/reconcile/issues.js";
import type { Fact } from "../src/types.js";

const fact = (over: Partial<Fact>): Fact => ({
  id: "f", hotelId: "h", shiftId: "2026-05-26",
  topic: "deposit", kind: "open", summary: "x",
  evidence: [{ source: "event", eventId: "e" }], confidence: "high",
  ...over,
});

describe("reconcile", () => {
  it("groups facts with the same (room, topic) across shifts into one issue", () => {
    const facts: Fact[] = [
      fact({ id: "f1", room: "309", topic: "deposit", kind: "open", shiftId: "2026-05-27", evidence: [{ source: "event", eventId: "evt_0007" }] }),
      fact({ id: "f2", room: "309", topic: "deposit", kind: "update", shiftId: "2026-05-30", evidence: [{ source: "event", eventId: "evt_0014" }] }),
    ];
    const issues = reconcile("hotel-x", facts);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.timeline).toHaveLength(2);
    expect(issues[0]!.status).toBe("open");
  });

  it("transitions open → resolved on a resolve fact", () => {
    const facts: Fact[] = [
      fact({ id: "f1", room: "215", topic: "facilities_common", kind: "open", shiftId: "2026-05-27" }),
      fact({ id: "f2", room: "215", topic: "facilities_common", kind: "resolve", shiftId: "2026-05-29" }),
    ];
    const issues = reconcile("h", facts);
    expect(issues[0]!.status).toBe("resolved");
    expect(issues[0]!.lastUpdatedShift).toBe("2026-05-29");
  });

  it("transitions resolved → reopened on a later open/update fact", () => {
    const facts: Fact[] = [
      fact({ id: "f1", room: "112", topic: "maintenance_room", kind: "open", shiftId: "2026-05-26" }),
      fact({ id: "f2", room: "112", topic: "maintenance_room", kind: "resolve", shiftId: "2026-05-27" }),
      fact({ id: "f3", room: "112", topic: "maintenance_room", kind: "update", shiftId: "2026-05-30" }),
    ];
    const issues = reconcile("h", facts);
    expect(issues[0]!.status).toBe("reopened");
  });

  it("keeps issues with the same room but different topics separate", () => {
    const facts: Fact[] = [
      fact({ id: "f1", room: "312", topic: "no_show", kind: "open", shiftId: "2026-05-27" }),
      fact({ id: "f2", room: "312", topic: "dispute_charge", kind: "open", shiftId: "2026-05-29" }),
      fact({ id: "f3", room: "312", topic: "no_show", kind: "resolve", shiftId: "2026-05-28" }),
    ];
    const issues = reconcile("h", facts);
    expect(issues).toHaveLength(2);
    const noShow = issues.find((i) => i.topic === "no_show")!;
    const dispute = issues.find((i) => i.topic === "dispute_charge")!;
    expect(noShow.status).toBe("resolved");
    expect(dispute.status).toBe("open");
  });

  it("flags a contradiction when two facts on one issue disagree on a hard field", () => {
    const facts: Fact[] = [
      fact({ id: "f1", room: "309", topic: "deposit", kind: "open", summary: "deposit not collected", shiftId: "2026-05-27" }),
      fact({ id: "f2", room: "309", topic: "deposit", kind: "resolve", summary: "deposit collected on card", shiftId: "2026-05-28" }),
      fact({ id: "f3", room: "309", topic: "deposit", kind: "update", summary: "the SGD 100 deposit was never collected", shiftId: "2026-05-30" }),
    ];
    const issues = reconcile("h", facts);
    const flags = issues[0]!.flags;
    expect(flags.some((f) => f.kind === "contradiction")).toBe(true);
  });
});
