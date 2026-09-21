import type { Issue, IssueCode, TransformResult } from "./transform";

const LABELS: Record<IssueCode, string> = {
  row_skipped: "Rows that cannot be imported (missing required data)",
  status_unknown: "Status not recognised (set to pending)",
  phone_invalid: "Phone number not recognised (raw text kept in legacy data)",
  ic_format_review: "IC number in an unusual format (kept as written)",
  joined_date_future: "Joined date is in the future",
  name_needs_review: "Name looks like a placeholder (TBA / PENDING / REFUND)",
  sector_unmapped: "Business sector not in the standard list (added as new)",
  type_unmapped: "Business type not in the standard list (added as new)",
  ic_placeholder_removed: "IC recorded as 0 (cleared)",
  phone_second_number: "Cell held two phone numbers (second one kept in legacy data)",
  sector_variant_fixed: "Business sector spelling corrected",
  type_variant_fixed: "Business type spelling corrected",
  email_shared: "Email address shared with another member",
};

const ORDER: IssueCode[] = [
  "row_skipped",
  "status_unknown",
  "phone_invalid",
  "ic_format_review",
  "joined_date_future",
  "name_needs_review",
  "sector_unmapped",
  "type_unmapped",
  "ic_placeholder_removed",
  "phone_second_number",
  "sector_variant_fixed",
  "type_variant_fixed",
  "email_shared",
];

function tally(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].map(([k, n]) => `${k}: ${n}`).join(", ");
}

/** Plain-text report. Lists membership numbers only, never names, emails or IC numbers. */
export function formatReport(result: TransformResult): string {
  const { members, issues, rowsRead } = result;
  const lines: string[] = [];

  lines.push(`Rows read: ${rowsRead}`);
  lines.push(`Ready to import: ${members.length}`);
  lines.push(`Skipped: ${rowsRead - members.length}`);
  lines.push("");
  lines.push(`By status: ${tally(members.map((m) => m.status))}`);
  lines.push(`By membership type (Fasal): ${tally(members.map((m) => m.fasal))}`);

  if (result.newSectors.length + result.newBusinessTypes.length > 0) {
    lines.push("");
    lines.push("New lookup values that will be created (review later):");
    for (const s of result.newSectors) lines.push(`  sector: ${s}`);
    for (const t of result.newBusinessTypes) lines.push(`  business type: ${t}`);
  }

  lines.push("");
  lines.push("Findings:");
  const byCode = new Map<IssueCode, Issue[]>();
  for (const issue of issues) byCode.set(issue.code, [...(byCode.get(issue.code) ?? []), issue]);

  for (const code of ORDER) {
    const group = byCode.get(code);
    if (!group) continue;
    const marker = group[0].severity === "error" ? "[error]" : group[0].severity === "warn" ? "[check]" : "[info] ";
    const shown = group.slice(0, 8).map((i) => i.membershipNo).join(", ");
    const more = group.length > 8 ? `, and ${group.length - 8} more` : "";
    lines.push(`  ${marker} ${LABELS[code]}: ${group.length}`);
    if (group[0].severity !== "info") lines.push(`           ${shown}${more}`);
  }

  return lines.join("\n");
}
