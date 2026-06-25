import type { Event, Fact, Flag } from "../types.js";
import { eventsToFacts } from "../ingest/events.js";
import { parseNightLog } from "../ingest/prose.js";
import { extractProseFacts } from "../extract/llm.js";

export type BuildResult = { facts: Fact[]; topLevelFlags: Flag[] };

export const buildFacts = async (
  hotelId: string,
  hotelOffset: string,
  events: Event[],
  nightLogs?: string,
  yearForHeading: number = new Date().getUTCFullYear()
): Promise<BuildResult> => {
  const { facts, injectionFlags } = eventsToFacts(hotelId, hotelOffset, events);
  const allFacts: Fact[] = [...facts];
  const allFlags: Flag[] = [...injectionFlags];

  if (nightLogs) {
    const parsed = parseNightLog(nightLogs, yearForHeading);
    if (parsed) {
      const { facts: proseFacts, flags: proseFlags } =
        await extractProseFacts(hotelId, parsed.shiftId, parsed.paragraphs);
      allFacts.push(...proseFacts);
      allFlags.push(...proseFlags);
    }
  }
  return { facts: allFacts, topLevelFlags: allFlags };
};
