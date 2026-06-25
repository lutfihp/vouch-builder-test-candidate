const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

// Hotel TZ offset like "+08:00". We do not pull in a TZ library for a 2-hour build.
const applyOffset = (iso: string, offset: string): Date => {
  const d = new Date(iso);
  const sign = offset.startsWith("-") ? -1 : 1;
  const [oh, om] = offset.slice(1).split(":").map(Number);
  return new Date(d.getTime() + sign * ((oh ?? 0) * 60 + (om ?? 0)) * 60_000);
};

export const shiftIdForTimestamp = (iso: string, hotelOffset: string): string => {
  // Convert to a "local wall-clock" Date in the hotel's TZ via the offset.
  const local = applyOffset(iso, hotelOffset);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const d = local.getUTCDate();
  const hour = local.getUTCHours();

  // Shift bucket rule: hour < 12 → today's morning. hour >= 12 → tomorrow's morning.
  if (hour < 12) {
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  const next = new Date(Date.UTC(y, m - 1, d) + 24 * 60 * 60_000);
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
};

export const shiftIdFromHeading = (heading: string, year: number): string => {
  // Match "morning <Weekday> <D> <Mon>" — the morning-of date is what we want.
  const m = heading.match(/morning\s+\w+\s+(\d{1,2})\s+([A-Za-z]{3})/i);
  if (!m) throw new Error(`Cannot parse shift heading: ${heading}`);
  const day = Number(m[1]);
  const mon = MONTHS[m[2]!.toLowerCase()];
  if (!mon) throw new Error(`Unknown month in heading: ${m[2]}`);
  return `${year}-${pad(mon)}-${pad(day)}`;
};
