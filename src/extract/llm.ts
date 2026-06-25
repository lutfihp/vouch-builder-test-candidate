import Groq from "groq-sdk";
import type { Fact, Flag } from "../types.js";
import { llmResponseSchema, type LlmFact } from "./schema.js";
import { SYSTEM_PROMPT, wrapParagraph } from "./prompts.js";
import { logDecision } from "../log/logger.js";

export type GateResult = {
  accepted: LlmFact[];
  rejected: Array<{ raw: unknown; reason: string }>;
};

export const gateLlmResponse = (paragraph: string, rawJson: string): GateResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    return { accepted: [], rejected: [{ raw: rawJson, reason: `parse error: ${(e as Error).message}` }] };
  }

  const validated = llmResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return { accepted: [], rejected: [{ raw: parsed, reason: `invalid schema: ${validated.error.message}` }] };
  }

  const accepted: LlmFact[] = [];
  const rejected: GateResult["rejected"] = [];
  for (const f of validated.data.facts) {
    if (!paragraph.includes(f.excerpt)) {
      rejected.push({ raw: f, reason: "excerpt not in paragraph (possible hallucination)" });
      continue;
    }
    accepted.push(f);
  }
  return { accepted, rejected };
};

export type ProseExtractionResult = { facts: Fact[]; flags: Flag[] };

const factFromLlm = (
  hotelId: string, shiftId: string,
  paragraphId: string, llm: LlmFact
): Fact => ({
  id: `fact_${paragraphId}_${Math.random().toString(36).slice(2, 8)}`,
  hotelId, shiftId,
  timestamp: undefined,
  room: llm.room ?? undefined,
  guest: llm.guest ?? undefined,
  topic: llm.topic,
  kind: llm.kind,
  summary: llm.summary,
  evidence: [{ source: "log", paragraphId, excerpt: llm.excerpt }],
  confidence: "low",
});

const callGroq = async (paragraph: string): Promise<string> => {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: wrapParagraph(paragraph) },
    ],
    temperature: 0,
  });
  return completion.choices[0]?.message?.content ?? "";
};

export const extractProseFacts = async (
  hotelId: string, shiftId: string,
  paragraphs: Array<{ paragraphId: string; text: string }>
): Promise<ProseExtractionResult> => {
  if (!process.env.GROQ_API_KEY) {
    return {
      facts: [],
      flags: [{
        kind: "missing_info",
        reason: "GROQ_API_KEY not set; prose facts were not extracted",
        evidence: paragraphs.map((p) => ({ source: "log", paragraphId: p.paragraphId, excerpt: p.text.slice(0, 80) })),
      }],
    };
  }

  const facts: Fact[] = [];
  let llmFailed = false;
  for (const p of paragraphs) {
    try {
      const raw = await callGroq(p.text);
      const { accepted, rejected } = gateLlmResponse(p.text, raw);
      for (const a of accepted) facts.push(factFromLlm(hotelId, shiftId, p.paragraphId, a));
      for (const r of rejected) {
        logDecision({
          hotelId, shiftId,
          decision: "fact_rejected",
          reason: r.reason,
          paragraphId: p.paragraphId,
        });
      }
    } catch (e) {
      llmFailed = true;
      logDecision({
        hotelId, shiftId,
        decision: "fact_rejected",
        reason: `LLM call failed: ${(e as Error).message}`,
        paragraphId: p.paragraphId,
      });
    }
  }

  const flags: Flag[] = llmFailed
    ? [{ kind: "missing_info", reason: "One or more LLM calls failed; prose may be under-reported", evidence: [] }]
    : [];

  return { facts, flags };
};
