/**
 * Imports the "Members" sheet of the DPMM tracker into Neon.
 *
 *   Dry run (default, touches nothing):
 *     npx tsx scripts/import/import-members.ts --file ./data/DPMM_Membership_Tracker_6.xlsx
 *
 *   Real import:
 *     npx tsx scripts/import/import-members.ts --file ./data/DPMM_Membership_Tracker_6.xlsx --apply
 *
 * Safe to re-run: members already in the database are skipped, never duplicated or overwritten.
 */
import { config } from "dotenv";
import ExcelJS from "exceljs";
import { neon } from "@neondatabase/serverless";
import { transformRows, type RawRow } from "./transform";
import { formatReport } from "./report";

config({ path: ".env.local" });

// ---------------------------------------------------------------------------
// Reading the workbook
// ---------------------------------------------------------------------------

/** Excel cells can hold links, rich text or formulas. Reduce them all to plain values. */
function cellValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text: string }>).map((part) => part.text).join("");
    }
    if ("text" in obj) return obj.text; // hyperlink (for example a mailto: email cell)
    if ("result" in obj) return obj.result ?? null; // formula
    return null;
  }
  return value;
}

async function loadMemberRows(file: string): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.getWorksheet("Members");
  if (!sheet) throw new Error('The workbook has no sheet named "Members".');

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cellValue(cell.value) ?? "").trim();
  });

  const rows: RawRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: RawRow = { __row: rowNumber };
    headers.forEach((header, col) => {
      if (header) record[header] = cellValue(row.getCell(col).value);
    });
    rows.push(record);
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileFlag = args.indexOf("--file");
  const file = fileFlag >= 0 ? args[fileFlag + 1] : undefined;

  if (!file) {
    console.error("Usage: npx tsx scripts/import/import-members.ts --file <path-to-xlsx> [--apply]");
    process.exit(1);
  }

  const rows = await loadMemberRows(file);
  const result = transformRows(rows);

  console.log(apply ? "DPMM member import: APPLY MODE\n" : "DPMM member import: DRY RUN\n");
  console.log(formatReport(result));

  if (!apply) {
    console.log("\nDry run: nothing was written. Re-run with --apply to import.");
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set in .env.local");
  console.log(`\nWriting to database host: ${new URL(url).host}`);
  console.log("(Check this is your DEV branch connection before continuing in the future.)\n");

  const sql = neon(url);

  // 1. Add any lookup values that are new (for example a business type not in the standard list)
  for (const name of result.newSectors) {
    await sql`INSERT INTO business_sectors (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`;
  }
  for (const name of result.newBusinessTypes) {
    await sql`INSERT INTO business_types (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`;
  }
  const introducerNames = [...new Set(result.members.map((m) => m.introducerName).filter((n): n is string => !!n))];
  for (const name of introducerNames) {
    await sql`INSERT INTO introducers (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`;
  }

  // 2. Load lookup ids
  const idMap = (rows: Array<Record<string, unknown>>, key: string) =>
    new Map(rows.map((r) => [String(r[key]), Number(r.id)]));

  const typeIds = idMap(await sql`SELECT id, fasal FROM membership_types`, "fasal");
  const sectorIds = idMap(await sql`SELECT id, name FROM business_sectors`, "name");
  const businessTypeIds = idMap(await sql`SELECT id, name FROM business_types`, "name");
  const introducerIds = idMap(await sql`SELECT id, name FROM introducers`, "name");

  const unknownFasal = [...new Set(result.members.map((m) => m.fasal).filter((f) => !typeIds.has(f)))];
  if (unknownFasal.length > 0) {
    throw new Error(`Membership type(s) not found in the database: ${unknownFasal.join(", ")}. Nothing was imported.`);
  }

  // 3. Insert every member in ONE transaction: all succeed or none do
  const statements = result.members.map((m) => {
    const sectorId = m.sectorName ? sectorIds.get(m.sectorName) ?? null : null;
    const businessTypeId = m.businessTypeName ? businessTypeIds.get(m.businessTypeName) ?? null : null;
    const introducerId = m.introducerName ? introducerIds.get(m.introducerName) ?? null : null;

    return sql`
      INSERT INTO members (
        membership_no, legacy_membership_no, membership_type_id, status,
        full_name, company_name, email, phone, office_tel, ic_no, ssm_no,
        business_sector_id, business_type_id, introducer_id,
        mailing_address, registered_address, joined_date,
        legacy_entity_type, legacy_payment_year, legacy_data
      ) VALUES (
        ${m.membershipNo}, ${m.legacyMembershipNo}, ${typeIds.get(m.fasal)!}, ${m.status}::member_status,
        ${m.fullName}, ${m.companyName}, ${m.email}, ${m.phone}, ${m.officeTel}, ${m.icNo}, ${m.ssmNo},
        ${sectorId}, ${businessTypeId}, ${introducerId},
        ${m.mailingAddress}, ${m.registeredAddress}, ${m.joinedDate}::date,
        ${m.legacyEntityType}, ${m.legacyPaymentYear}, ${JSON.stringify(m.legacyData)}::jsonb
      )
      ON CONFLICT DO NOTHING
      RETURNING id`;
  });

  const results = (await sql.transaction(statements)) as Array<Array<unknown>>;
  const inserted = results.filter((r) => r.length > 0).length;
  console.log(`Imported: ${inserted}`);
  console.log(`Already in the database (skipped): ${result.members.length - inserted}`);

  // 4. Verify
  const byStatus = await sql`SELECT status, count(*)::int AS n FROM members GROUP BY status ORDER BY status`;
  console.log("\nMembers now in the database:");
  for (const row of byStatus) console.log(`  ${row.status}: ${row.n}`);
}

main().catch((error) => {
  console.error("\nImport failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
