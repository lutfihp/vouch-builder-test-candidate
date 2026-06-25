import type { Issue, Handover, HandoverItem, Flag } from "../types.js";
import { logDecision } from "../log/logger.js";

const toItem = (i: Issue): HandoverItem => ({
  issueId: i.id,
  room: i.room,
  guest: i.guest,
  topic: i.topic,
  summary: i.timeline.at(-1)?.summary ?? "",
  status: i.status,
  urgencyRuleId: i.urgencyRuleId,
  evidence: i.timeline.flatMap((f) => f.evidence),
  flags: i.flags,
});

export const buildHandover = (
  hotelId: string,
  asOfShift: string,
  issues: Issue[],
  topLevelFlags: Flag[] = []
): Handover => {
  const inShift = (i: Issue) => i.lastUpdatedShift === asOfShift;
  const firstThisShift = (i: Issue) => i.firstSeenShift === asOfShift;

  const urgent: HandoverItem[] = [];
  const stillOpen: HandoverItem[] = [];
  const newlyResolved: HandoverItem[] = [];
  const newTonight: HandoverItem[] = [];

  for (const i of issues) {
    if (i.status !== "resolved" && i.urgency === "urgent") {
      urgent.push(toItem(i));
      continue;
    }
    if (i.status === "resolved" && inShift(i)) {
      newlyResolved.push(toItem(i));
      continue;
    }
    if (firstThisShift(i) && i.status !== "resolved") {
      newTonight.push(toItem(i));
      continue;
    }
    if (i.status !== "resolved" && !firstThisShift(i)) {
      stillOpen.push(toItem(i));
    }
  }

  const flags: Flag[] = [
    ...topLevelFlags,
    ...issues.flatMap((i) => i.flags),
  ];

  const handover: Handover = {
    hotelId, asOfShift,
    generatedAt: new Date().toISOString(),
    urgent, stillOpen, newlyResolved, newTonight, flags,
    counts: {
      urgent: urgent.length,
      stillOpen: stillOpen.length,
      newlyResolved: newlyResolved.length,
      newTonight: newTonight.length,
      flags: flags.length,
    },
  };

  logDecision({
    hotelId, shiftId: asOfShift,
    decision: "handover_rendered",
    reason: "buckets computed",
    counts: handover.counts,
  });

  return handover;
};
