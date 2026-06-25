# Vouch Night-Shift Handover

A backend service that generates an action-first morning handover from a hotel's overnight events — built as the Vouch Builder take-home.

- **Brief:** [BRIEF.md](BRIEF.md)
- **Spec:** [docs/superpowers/specs/2026-06-25-night-shift-handover-design.md](docs/superpowers/specs/2026-06-25-night-shift-handover-design.md)
- **Plan:** [docs/superpowers/plans/2026-06-25-night-shift-handover.md](docs/superpowers/plans/2026-06-25-night-shift-handover.md)
- **Decisions:** [DECISIONS.md](DECISIONS.md)
- **Agent rules:** [AGENTS.md](AGENTS.md)

## Local

```bash
cp .env.example .env   # add your GROQ_API_KEY
npm install
npm test               # 25 tests across reconciliation, urgency, gate, injection, e2e
npm run dev            # starts Fastify on :3000
```

## Sample curl

```bash
curl -s -X POST <DEPLOYED_URL>/handover \
  -H 'content-type: application/json' \
  -d "$(jq -nc --slurpfile e <(jq '.events' data/events.json) \
    --rawfile n data/night-logs.md \
    '{ hotelId: "lumen-sg", hotelOffset: "+08:00", asOfShift: "2026-05-30", events: $e[0], nightLogs: $n }')" \
  | jq
```

HTML view: `<DEPLOYED_URL>/handover.html?asOfShift=2026-05-30`

Healthcheck: `<DEPLOYED_URL>/healthz`

## How it works

Five-stage pipeline: **Events/Logs → Facts → Issues → Issue Timeline → Handover**.

- Reconciliation, status transitions, urgency, contradiction detection, and rendering are **deterministic** and run without any model.
- An LLM (Groq, `llama-3.3-70b-versatile`) extracts facts from free-text night-log paragraphs only, behind a hard Zod schema gate that requires a verbatim `excerpt` substring for every fact. A fact the model cannot quote is dropped and logged.
- The structured event `evt_0026` (an attempted prompt-injection guest note) is detected at ingest by regex, surfaced as a `prompt_injection_attempt` flag with the verbatim excerpt, and **never** executed.

See the [spec](docs/superpowers/specs/2026-06-25-night-shift-handover-design.md) for the full design rationale and [DECISIONS.md](DECISIONS.md) for tradeoffs, what was skipped, and what hours 3–6 would add.

## Repo data

- `data/events.json` — structured front-desk events for the week.
- `data/night-logs.md` — relief-shift free-text log (one night, multilingual).
