import { readFile } from "node:fs/promises";
import { buildFacts } from "../src/facts/build.js";
import { reconcile } from "../src/reconcile/issues.js";
import { applyUrgency } from "../src/reconcile/urgency.js";
import { buildHandover } from "../src/render/handover.js";

const argShift = process.argv.find((a) => a.startsWith("--asOfShift="))?.split("=")[1] ?? "2026-05-30";

const main = async () => {
  const raw = JSON.parse(await readFile("data/events.json", "utf8")) as {
    hotel: { id: string; timezone: string };
    events: any[];
  };
  const hotelId = raw.hotel.id;
  const offset = raw.hotel.timezone;
  const nightLogs = await readFile("data/night-logs.md", "utf8").catch(() => undefined);
  const { facts, topLevelFlags } = await buildFacts(hotelId, offset, raw.events, nightLogs, 2026);
  const issues = applyUrgency(reconcile(hotelId, facts), argShift);
  const handover = buildHandover(hotelId, argShift, issues, topLevelFlags);
  process.stdout.write(JSON.stringify(handover, null, 2) + "\n");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
