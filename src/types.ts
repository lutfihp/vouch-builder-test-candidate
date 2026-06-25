import type { Topic } from "./topics.js";

export type Event = {
  id: string;
  timestamp: string;
  type: string;
  room: string | null;
  guest: string | null;
  description: string;
  status: "resolved" | "unresolved" | "pending";
};

export type Evidence =
  | { source: "event"; eventId: string }
  | { source: "log"; paragraphId: string; excerpt: string };

export type FactKind = "open" | "update" | "resolve" | "info";

export type Fact = {
  id: string;
  hotelId: string;
  shiftId: string;
  timestamp?: string;
  room?: string;
  guest?: string;
  topic: Topic;
  kind: FactKind;
  summary: string;
  evidence: Evidence[];
  confidence: "high" | "low";
};

export type FlagKind =
  | "contradiction"
  | "missing_info"
  | "prompt_injection_attempt"
  | "low_confidence";

export type Flag = {
  kind: FlagKind;
  reason: string;
  evidence: Evidence[];
};

export type IssueStatus = "open" | "resolved" | "reopened";

export type Issue = {
  id: string;
  hotelId: string;
  room?: string;
  guest?: string;
  topic: Topic;
  status: IssueStatus;
  urgency: "urgent" | "normal";
  urgencyRuleId?: string;
  firstSeenShift: string;
  lastUpdatedShift: string;
  timeline: Fact[];
  flags: Flag[];
};

export type HandoverSection = "urgent" | "stillOpen" | "newlyResolved" | "newTonight" | "flags";

export type HandoverItem = {
  issueId: string;
  room?: string;
  guest?: string;
  topic: Topic;
  summary: string;
  status: IssueStatus;
  urgencyRuleId?: string;
  evidence: Evidence[];
  flags: Flag[];
};

export type Handover = {
  hotelId: string;
  asOfShift: string;
  generatedAt: string;
  urgent: HandoverItem[];
  stillOpen: HandoverItem[];
  newlyResolved: HandoverItem[];
  newTonight: HandoverItem[];
  flags: Flag[];
  counts: { urgent: number; stillOpen: number; newlyResolved: number; newTonight: number; flags: number };
};
