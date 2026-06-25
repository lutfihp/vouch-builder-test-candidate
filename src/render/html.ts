import type { Handover, HandoverItem, Flag } from "../types.js";

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const evidencePills = (item: HandoverItem): string =>
  item.evidence
    .map((e) =>
      e.source === "event"
        ? `<span class="pill">${esc(e.eventId)}</span>`
        : `<span class="pill">log:${esc(e.paragraphId)} "${esc(e.excerpt.slice(0, 60))}…"</span>`
    )
    .join(" ");

const renderItem = (i: HandoverItem): string => `
  <li>
    <strong>${esc(i.room ?? i.guest ?? "—")}</strong>
    <em>${esc(i.topic)}</em>
    ${i.urgencyRuleId ? `<span class="rule">[${esc(i.urgencyRuleId)}]</span>` : ""}
    <div>${esc(i.summary)}</div>
    <div class="evidence">${evidencePills(i)}</div>
  </li>
`;

const renderFlag = (f: Flag): string => `
  <li>
    <strong>${esc(f.kind)}</strong>: ${esc(f.reason)}
    <div class="evidence">${f.evidence
      .map((e) => (e.source === "event" ? esc(e.eventId) : `log:${esc(e.paragraphId)} "${esc(e.excerpt.slice(0, 80))}…"`))
      .join(" · ")}</div>
  </li>
`;

const section = (title: string, items: string): string =>
  items ? `<h2>${title}</h2><ul>${items}</ul>` : "";

export const renderHandoverHtml = (h: Handover): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Handover · ${esc(h.hotelId)} · ${esc(h.asOfShift)}</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; max-width: 760px; margin: 2em auto; padding: 0 1em; }
  h1 { margin-bottom: 0; } .meta { color: #666; font-size: 12px; }
  h2 { margin-top: 1.5em; }
  li { margin: 0.6em 0; padding: 0.4em 0.6em; border-left: 3px solid #ccc; list-style: none; }
  ul { padding-left: 0; }
  .pill { display: inline-block; padding: 1px 6px; border-radius: 8px; background: #eef; font-size: 11px; margin-right: 4px; }
  .rule { color: #b00; font-size: 11px; margin-left: 4px; }
  .evidence { font-size: 11px; color: #555; margin-top: 4px; }
</style></head><body>
<h1>Handover</h1>
<div class="meta">${esc(h.hotelId)} · shift ${esc(h.asOfShift)} · generated ${esc(h.generatedAt)}</div>
${section("🚨 Urgent",          h.urgent.map(renderItem).join(""))}
${section("🔴 Still open",      h.stillOpen.map(renderItem).join(""))}
${section("🟢 Newly resolved",  h.newlyResolved.map(renderItem).join(""))}
${section("🆕 New tonight",     h.newTonight.map(renderItem).join(""))}
${section("⚠️ Flags",            h.flags.map(renderFlag).join(""))}
</body></html>`;
