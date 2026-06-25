export const TOPICS = [
  "compliance_passport",
  "deposit",
  "maintenance_room",
  "facilities_common",
  "complaint_noise",
  "complaint_service",
  "no_show",
  "dispute_charge",
  "damage",
  "safe_locked",
  "occupancy_mismatch",
  "incident_medical",
  "check_in",
  "guest_message",
  "other",
] as const;

export type Topic = (typeof TOPICS)[number];

export const isTopic = (s: string): s is Topic =>
  (TOPICS as readonly string[]).includes(s);
