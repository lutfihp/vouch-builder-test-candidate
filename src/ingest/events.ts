import type { Event, Fact, FactKind } from "../types.js";
import type { Topic } from "../topics.js";
import { shiftIdForTimestamp } from "../reconcile/shift.js";

const KIND_BY_STATUS: Record<Event["status"], FactKind> = {
  resolved: "resolve",
  unresolved: "open",
  pending: "open",
};

// Maps the heterogenous event.type strings to our closed Topic vocab.
// Anything not matched falls through to keyword inference, then "other".
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

export const eventsToFacts = (
  hotelId: string,
  hotelOffset: string,
  events: Event[]
): Fact[] =>
  events.map((e) => {
    const topic = inferTopic(e);
    const shiftId = shiftIdForTimestamp(e.timestamp, hotelOffset);
    return {
      id: `fact_${e.id}`,
      hotelId,
      shiftId,
      timestamp: e.timestamp,
      room: e.room ?? undefined,
      guest: e.guest ?? undefined,
      topic,
      kind: KIND_BY_STATUS[e.status],
      summary: e.description,
      evidence: [{ source: "event", eventId: e.id }],
      confidence: "high",
    };
  });
