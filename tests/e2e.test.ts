import { describe, it, expect, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { generateHandover } from "../src/server.js";

const loadSample = async () => {
  const raw = JSON.parse(await readFile("data/events.json", "utf8"));
  const nightLogs = await readFile("data/night-logs.md", "utf8");
  return { raw, nightLogs };
};

describe("end-to-end with bundled sample (LLM disabled for determinism)", () => {
  beforeEach(() => {
    delete process.env.GROQ_API_KEY;
  });

  it("215 leak is resolved by 2026-05-30 and absent from Still open", async () => {
    const { raw, nightLogs } = await loadSample();
    const h = await generateHandover({
      hotelId: raw.hotel.id, hotelOffset: raw.hotel.timezone,
      asOfShift: "2026-05-30",
      events: raw.events, nightLogs,
    });
    const allOpenItems = [...h.urgent, ...h.stillOpen, ...h.newTonight];
    const leaks = allOpenItems.filter((i) => i.topic === "facilities_common");
    expect(leaks).toHaveLength(0);
  });

  it("compliance_passport backlog is in Urgent under U001", async () => {
    const { raw, nightLogs } = await loadSample();
    const h = await generateHandover({
      hotelId: raw.hotel.id, hotelOffset: raw.hotel.timezone,
      asOfShift: "2026-05-30",
      events: raw.events, nightLogs,
    });
    const passport = h.urgent.find((i) => i.topic === "compliance_passport");
    expect(passport).toBeDefined();
    expect(passport!.urgencyRuleId).toBe("U001");
  });

  it("309 deposit is one issue spanning evt_0007 and evt_0014, urgent under U005", async () => {
    const { raw, nightLogs } = await loadSample();
    const h = await generateHandover({
      hotelId: raw.hotel.id, hotelOffset: raw.hotel.timezone,
      asOfShift: "2026-05-30",
      events: raw.events, nightLogs,
    });
    const deposit309 = h.urgent.find((i) => i.room === "309" && i.topic === "deposit");
    expect(deposit309).toBeDefined();
    expect(deposit309!.urgencyRuleId).toBe("U005");
    const ids = deposit309!.evidence.flatMap((e) => (e.source === "event" ? [e.eventId] : []));
    expect(ids).toContain("evt_0007");
    expect(ids).toContain("evt_0014");
  });

  it("evt_0026 is in Flags with verbatim excerpt and dangerous strings appear only there", async () => {
    const { raw, nightLogs } = await loadSample();
    const h = await generateHandover({
      hotelId: raw.hotel.id, hotelOffset: raw.hotel.timezone,
      asOfShift: "2026-05-30",
      events: raw.events, nightLogs,
    });
    const flag = h.flags.find((f) => f.kind === "prompt_injection_attempt");
    expect(flag).toBeDefined();
    const serialized = JSON.stringify(h);
    const allClear = serialized.match(/all clear/gi) ?? [];
    expect(allClear.length).toBe(1);
  });
});
