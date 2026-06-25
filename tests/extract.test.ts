import { describe, it, expect } from "vitest";
import { gateLlmResponse } from "../src/extract/llm.js";

const paragraph = '309 — the guy with the deposit issue from Tuesday is still not settled, he came in very late and I didnt want to chase him at 2am. Still no deposit on file. Passing it on again.';

describe("gateLlmResponse", () => {
  it("accepts a well-formed response where excerpt is a substring of the paragraph", () => {
    const out = gateLlmResponse(paragraph, JSON.stringify({
      facts: [{
        topic: "deposit", kind: "update", room: "309", guest: null,
        summary: "Deposit still not collected on room 309",
        excerpt: "Still no deposit on file",
      }],
    }));
    expect(out.accepted).toHaveLength(1);
    expect(out.rejected).toHaveLength(0);
  });

  it("rejects a fact whose excerpt does not appear in the paragraph (hallucination)", () => {
    const out = gateLlmResponse(paragraph, JSON.stringify({
      facts: [{
        topic: "deposit", kind: "update", room: "309", guest: null,
        summary: "Deposit collected on arrival",
        excerpt: "Deposit was collected on arrival",
      }],
    }));
    expect(out.accepted).toHaveLength(0);
    expect(out.rejected[0]!.reason).toMatch(/excerpt not in paragraph/);
  });

  it("rejects a fact with a topic outside the closed vocabulary", () => {
    const out = gateLlmResponse(paragraph, JSON.stringify({
      facts: [{
        topic: "free_breakfast", kind: "open", room: "309",
        summary: "x", excerpt: "Still no deposit on file",
      }],
    }));
    expect(out.accepted).toHaveLength(0);
    expect(out.rejected[0]!.reason).toMatch(/invalid|schema/i);
  });

  it("rejects when response is not valid JSON", () => {
    const out = gateLlmResponse(paragraph, "not json");
    expect(out.accepted).toHaveLength(0);
    expect(out.rejected[0]!.reason).toMatch(/parse/i);
  });
});
