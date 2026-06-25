import type { Issue } from "../types.js";
import { logDecision } from "../log/logger.js";

const daysBetween = (fromShift: string, toShift: string): number => {
  const a = new Date(fromShift + "T00:00:00Z").getTime();
  const b = new Date(toShift + "T00:00:00Z").getTime();
  return Math.round((b - a) / (24 * 60 * 60_000));
};

type Rule = { id: string; test: (i: Issue, asOf: string) => boolean };

export const URGENCY_RULES: Rule[] = [
  {
    id: "U001",
    test: (i, asOf) =>
      i.topic === "compliance_passport" && i.status !== "resolved" &&
      daysBetween(i.firstSeenShift, asOf) >= 1,
  },
  {
    id: "U002",
    test: (i) =>
      i.topic === "safe_locked" && i.status !== "resolved" &&
      i.timeline.some((f) => /check[- ]?out|退房|leaving/i.test(f.summary)),
  },
  {
    id: "U003",
    test: (i) =>
      i.topic === "facilities_common" && i.status !== "resolved" &&
      i.timeline.some((f) => /leak|flood|fire|wet/i.test(f.summary)),
  },
  {
    id: "U004",
    test: (i) =>
      i.topic === "damage" && i.status !== "resolved" &&
      i.timeline.some((f) => /no photos|no manager approval|no approval/i.test(f.summary)),
  },
  {
    id: "U005",
    test: (i, asOf) =>
      i.topic === "deposit" && i.status !== "resolved" &&
      daysBetween(i.firstSeenShift, asOf) >= 2,
  },
  {
    id: "U006",
    test: (i) => i.topic === "dispute_charge" && i.status === "open",
  },
];

export const applyUrgency = (issues: Issue[], asOfShift: string): Issue[] =>
  issues.map((i) => {
    for (const rule of URGENCY_RULES) {
      if (rule.test(i, asOfShift)) {
        logDecision({
          hotelId: i.hotelId, shiftId: asOfShift, issueId: i.id,
          decision: "urgency_applied", ruleId: rule.id,
          reason: `rule ${rule.id} matched topic=${i.topic} status=${i.status}`,
        });
        return { ...i, urgency: "urgent", urgencyRuleId: rule.id };
      }
    }
    return i;
  });
