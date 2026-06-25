import { createHash } from "node:crypto";
import type { Fact, Issue, IssueStatus, Flag } from "../types.js";
import { logDecision } from "../log/logger.js";

const issueKey = (hotelId: string, f: Fact): string =>
  `${hotelId}|${f.room ?? f.guest ?? "_"}|${f.topic}`;

const issueId = (key: string): string =>
  "iss_" + createHash("sha1").update(key).digest("hex").slice(0, 10);

const transition = (current: IssueStatus, kind: Fact["kind"]): IssueStatus => {
  if (kind === "resolve") return "resolved";
  if (kind === "info") return current;
  // open or update
  if (current === "resolved") return "reopened";
  return "open";
};

const CONTRADICTION_RULES: Array<{ name: string; matchA: RegExp; matchB: RegExp }> = [
  {
    name: "deposit_collected_vs_not",
    matchA: /deposit (was )?collected|deposit taken|deposit on (card|file)/i,
    matchB: /deposit (was )?(not|never) (collected|taken)|no deposit|deposit was never/i,
  },
];

const detectContradictions = (timeline: Fact[]): Flag[] => {
  const flags: Flag[] = [];
  for (const rule of CONTRADICTION_RULES) {
    const a = timeline.find((f) => rule.matchA.test(f.summary));
    const b = timeline.find((f) => rule.matchB.test(f.summary));
    if (a && b) {
      flags.push({
        kind: "contradiction",
        reason: `Conflicting facts under ${rule.name}`,
        evidence: [...a.evidence, ...b.evidence],
      });
    }
  }
  return flags;
};

export const reconcile = (hotelId: string, facts: Fact[]): Issue[] => {
  // Sort by (shiftId, timestamp) so transitions apply in chronological order.
  const sorted = [...facts].sort((a, b) => {
    if (a.shiftId !== b.shiftId) return a.shiftId.localeCompare(b.shiftId);
    return (a.timestamp ?? "").localeCompare(b.timestamp ?? "");
  });

  const map = new Map<string, Issue>();
  for (const f of sorted) {
    const key = issueKey(hotelId, f);
    const id = issueId(key);
    const existing = map.get(key);
    if (!existing) {
      const issue: Issue = {
        id, hotelId,
        room: f.room, guest: f.guest, topic: f.topic,
        status: transition("open", f.kind),
        urgency: "normal",
        firstSeenShift: f.shiftId, lastUpdatedShift: f.shiftId,
        timeline: [f], flags: [],
      };
      map.set(key, issue);
      logDecision({
        hotelId, shiftId: f.shiftId, issueId: id,
        decision: "issue_opened",
        reason: `first fact id=${f.id} key=${key}`,
      });
      continue;
    }
    const newStatus = transition(existing.status, f.kind);
    if (newStatus !== existing.status) {
      logDecision({
        hotelId, shiftId: f.shiftId, issueId: id,
        decision: "status_change",
        from: existing.status, to: newStatus,
        reason: `triggered by fact id=${f.id} kind=${f.kind}`,
      });
    }
    existing.status = newStatus;
    existing.lastUpdatedShift = f.shiftId;
    existing.timeline.push(f);
  }

  for (const issue of map.values()) {
    const contradictions = detectContradictions(issue.timeline);
    if (contradictions.length) {
      issue.flags.push(...contradictions);
      for (const c of contradictions) {
        logDecision({
          hotelId, issueId: issue.id,
          decision: "flag_raised",
          reason: c.reason,
        });
      }
    }
  }

  return [...map.values()];
};
