import { shiftIdFromHeading } from "../reconcile/shift.js";

export type ParsedNightLog = {
  shiftId: string;
  paragraphs: Array<{ paragraphId: string; text: string }>;
};

const SHIFT_HEADING_RE = /^## (Night of .*morning .*)$/m;

export const parseNightLog = (markdown: string, year: number): ParsedNightLog | null => {
  const heading = markdown.match(SHIFT_HEADING_RE);
  if (!heading) return null;
  const shiftId = shiftIdFromHeading(heading[1]!, year);

  // Split on blank lines and bullet markers; keep each paragraph as its own unit.
  const body = markdown.slice(markdown.indexOf(heading[0]) + heading[0].length);
  const chunks = body
    .split(/\n\s*\n/)
    .map((c) => c.replace(/^[-*]\s+/, "").trim())
    .filter((c) => c.length > 0 && !c.startsWith(">") && !c.startsWith("#"));

  const paragraphs = chunks.map((text, idx) => ({
    paragraphId: `p${idx + 1}`,
    text,
  }));

  return { shiftId, paragraphs };
};
