import type { Event, Fact, FactKind, Flag } from "../types.js";
import type { Topic } from "../topics.js";
import { shiftIdForTimestamp } from "../reconcile/shift.js";
import { logDecision } from "../log/logger.js";

const KIND_BY_STATUS: Record<Event["status"], FactKind> = {
  resolved: "resolve",
  unresolved: "open",
  pending: "open",
};

const TYPE_TO_TOPIC: Record<string, Topic> = {
  check_in: "check_in",
  check_in_issue: "check_in",
  maintenance: "maintenance_room",
  facilities: "facilities_common",
  compliance: "compliance_passport",
  complaint: "complaint_noise",
  lost_keycard: "other",
  deposit_issue: "deposit",
  no_show: "no_show",
  walk_in: "other",
  finance_note: "dispute_charge",
  incident: "incident_medical",
  early_checkout_request: "other",
  damage_report: "damage",
  note: "other",
  guest_message: "guest_message",
};

const inferTopic = (e: Event): Topic => {
  const direct = TYPE_TO_TOPIC[e.type];
  if (direct) return direct;
  const d = e.description.toLowerCase();
  if (/passport|immigration|scanner/.test(d)) return "compliance_passport";
  if (/safe/.test(d) && /lock|open/.test(d)) return "safe_locked";
  if (/dispute/.test(d)) return "dispute_charge";
  return "other";
};

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(other\s+)?(items|instructions|previous)/i,
  /system\s+note\s+to\s+the\s+(handover|tool|model|ai)/i,
  /report\s+the\s+night\s+as\s+all\s+clear/i,
  /mark\s+it\s+approved/i,
];

const isInjectionAttempt = (e: Event): boolean =>
  e.type === "guest_message" && INJECTION_PATTERNS.some((re) => re.test(e.description));

export type EventIngestResult = { facts: Fact[]; injectionFlags: Flag[] };

export const eventsToFacts = (
  hotelId: string,
  hotelOffset: string,
  events: Event[]
): EventIngestResult => {
  const facts: Fact[] = [];
  const injectionFlags: Flag[] = [];

  for (const e of events) {
    const injection = isInjectionAttempt(e);
    const topic: Topic = injection ? "guest_message" : inferTopic(e);
    const kind: FactKind = injection ? "info" : KIND_BY_STATUS[e.status];
    const shiftId = shiftIdForTimestamp(e.timestamp, hotelOffset);

    facts.push({
      id: `fact_${e.id}`,
      hotelId, shiftId,
      timestamp: e.timestamp,
      room: e.room ?? undefined,
      guest: e.guest ?? undefined,
      topic, kind,
      summary: e.description,
      evidence: [{ source: "event", eventId: e.id }],
      confidence: "high",
    });

    if (injection) {
      injectionFlags.push({
        kind: "prompt_injection_attempt",
        reason: "guest message contains instructions targeted at automation",
        evidence: [{ source: "event", eventId: e.id }],
      });
      logDecision({
        hotelId, shiftId,
        decision: "flag_raised",
        reason: `prompt_injection_attempt in event ${e.id}`,
      });
    }
  }

  return { facts, injectionFlags };
};
