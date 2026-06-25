# Decisions

## What I built

- Five-stage deterministic pipeline (Events/Logs → Facts → Issues → Issue Timeline → Handover).
- Closed Topic vocabulary used as the spine of issue keying.
- LLM (Groq, `llama-3.3-70b-versatile`) for prose-paragraph fact extraction only, behind a Zod schema gate that rejects any fact whose `excerpt` is not a verbatim substring of the wrapped paragraph.
- ruleId-tagged urgency rule table; every firing is logged with its ruleId.
- Action-first handover JSON + a thin server-rendered HTML view.
- Structured logging (pino) on every decision: `{ hotelId, shiftId, issueId?, decision, reason, ruleId? }`.
- Special-case structured handling of `evt_0026`: it never touches the LLM and is always surfaced as a `prompt_injection_attempt` flag with its verbatim excerpt.
- 25 tests covering: shift identification, issue keying / transitions / contradictions, urgency rules, schema gate behaviour (including hallucination rejection), prompt-injection defense, and end-to-end with the bundled sample.

## What I deliberately skipped

- Persistence / database. Each request is pure over its input set; storage adds hours of scope without changing what the brief evaluates.
- Auth, multi-tenant routing beyond `hotelId` as a body field.
- Retries with exponential backoff, LLM cost guards, request queueing.
- HTML template tests. Tests target reconciliation correctness and the schema gate.
- Sophisticated NLP for topic inference. Closed vocabulary + small regex map is enough for the sample and is auditable.
- A real timezone library. The 2-hour build uses an offset-only conversion that suffices for `+08:00`. Replace with Temporal or luxon for multi-TZ production.

## How reconciliation across nights works

- Issue key = `(hotelId, room ?? guest ?? "_", topic)`.
- Facts are sorted by `(shiftId, timestamp)`; status transitions apply in chronological order: first fact → `open`; later `open`/`update` → still `open`; `resolve` → `resolved`; later `open`/`update` after `resolved` → `reopened`.
- Carry-over is implicit: any issue with non-`resolved` status at end of shift N is eligible for "Still open" in shift N+1. The handover renderer enforces this; the reconciler simply records state.
- Contradictions are structural: same-issue facts disagreeing on a hard field (e.g. deposit collected vs not) raise a `contradiction` flag, both facts kept in the timeline. The engine never picks a winner.
- The LLM never decides issue state. It tags paragraphs with `kind`; the engine applies the transition and logs the reason.
- Worked example from the sample: 309 deposit issue is one issue with three timeline entries — `evt_0007` (open, deposit declined), the relief-shift paragraph (update, "still no deposit on file"), and `evt_0014` (update, never collected). It is one issue under key `(309, deposit)`, status `open`, urgent under rule `U005`.

## How I keep statements grounded and handle incomplete/contradictory input

- Every Fact carries Evidence. Events carry `eventId`; prose carries `paragraphId` + a mandatory verbatim `excerpt`.
- The schema gate enforces that `excerpt` is a substring of the wrapped paragraph. A fact the model could not quote is dropped and logged with `decision: "fact_rejected"`.
- Closed Topic vocabulary: any topic outside the list fails Zod validation. The model cannot invent topics.
- Contradictions are flagged, not resolved. The handover surfaces both sides.
- Low-confidence facts (no timestamp, LLM-extracted) inherit `confidence: "low"` so a downstream renderer or human can spot them.
- If `GROQ_API_KEY` is unset, a top-level `missing_info` flag is attached and prose facts are omitted; the operator sees the gap rather than a confidently-empty report.
- `evt_0026`-style structured prompt-injection bait is detected by regex at ingest, surfaced as `prompt_injection_attempt`, and never executed. The injection test asserts the strings `"all clear"` and `"SGD 1000"` appear at most once each in the serialized handover — only inside the verbatim evidence excerpt.

## Where AI helped most, and where it got in the way

- Helped most: drafting the closed Topic vocabulary, drafting the urgency rule table, and writing the schema-gate tests. Going from "messy real data" to "small finite type set" is where a model is most valuable in a 2-hour window.
- Got in the way: the moment I considered letting the LLM decide issue state, the design became un-auditable. Rolling that back to "LLM tags, engine decides" was the most important judgment call in the build, and the rule that the model must produce a verbatim `excerpt` is what makes the trust story believable.

## What I'd do in hours 3–6

- Broaden the Topic vocabulary against more sample data; track `"other"` rate as a quality metric.
- Add Groq retries with exponential backoff + circuit-breaker around the LLM call, plus a fallback to `llama-3.1-8b-instant` on rate limit.
- Expose per-fact / per-issue trace IDs in the HTML view that link back to the structured log line.
- Add a `?diff=<previousShift>` mode so morning managers see what changed since yesterday's handover.
- Move the timezone math to Temporal API or luxon when the hotel set is not single-TZ.
- Add per-hotel rule overlays so a property can extend the urgency table.
- Wire a tiny offline LLM-replay fixture so e2e tests can exercise the prose path without a network call.

## One thing that surprised me

How much trustworthiness comes from the **substring check on `excerpt`** alone. It is a one-line guard, but it eliminates the entire class of "the model made up a fact" failures — the model can hallucinate a summary, but it cannot hallucinate a quote that isn't there. Everything else in the design — the topic vocabulary, the deterministic engine, the structured logs — is supporting evidence around that single invariant.
