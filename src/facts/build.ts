import type { Event, Fact } from "../types.js";
import { eventsToFacts } from "../ingest/events.js";

export const buildFacts = (
  hotelId: string,
  hotelOffset: string,
  events: Event[]
): Fact[] => eventsToFacts(hotelId, hotelOffset, events);
