import type { Event, Fact, Flag } from "../types.js";
import { eventsToFacts } from "../ingest/events.js";

export type BuildResult = { facts: Fact[]; topLevelFlags: Flag[] };

export const buildFacts = (
  hotelId: string,
  hotelOffset: string,
  events: Event[]
): BuildResult => {
  const { facts, injectionFlags } = eventsToFacts(hotelId, hotelOffset, events);
  return { facts, topLevelFlags: injectionFlags };
};
