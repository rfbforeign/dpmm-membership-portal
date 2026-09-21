/**
 * Turns raw rows from the "Members" sheet into clean, database-ready records.
 * Pure functions only (no file or database access), so the rules are easy to test.
 */

export type RawRow = Record<string, unknown>;

export type MemberStatus = "pending" | "active" | "expired" | "suspended";

export interface MemberInsert {
  membershipNo: string;
  legacyMembershipNo: string | null;
  fasal: string;
  status: MemberStatus;
  fullName: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  officeTel: string | null;
  icNo: string | null;
  ssmNo: string | null;
  sectorName: string | null;
  businessTypeName: string | null;
  introducerName: string | null;
  mailingAddress: string | null;
  registeredAddress: string | null;
  joinedDate: string; // YYYY-MM-DD
  legacyEntityType: string | null;
  legacyPaymentYear: number | null;
  legacyData: Record<string, unknown>;
}

export type Severity = "error" | "warn" | "info";

export type IssueCode =
  | "row_skipped"
  | "email_shared"
  | "phone_invalid"
  | "phone_second_number"
  | "ic_placeholder_removed"
  | "ic_format_review"
  | "joined_date_future"
  | "name_needs_review"
  | "status_unknown"
  | "sector_variant_fixed"
  | "sector_unmapped"
  | "type_variant_fixed"
  | "type_unmapped";

export interface Issue {
  membershipNo: string;
  code: IssueCode;
  severity: Severity;
  detail?: string;
}

export interface TransformResult {
  members: MemberInsert[];
  issues: Issue[];
  rowsRead: number;
  newSectors: string[];
  newBusinessTypes: string[];
}

// ---------------------------------------------------------------------------
// Canonical lookup values (must match the seed data in db/sql/0000_init.sql)
// ---------------------------------------------------------------------------

export const CANONICAL_SECTORS: readonly string[] = [
  "SEKTOR PERKHIDMATAN PROFESIONAL",
  "SEKTOR PERDAGANGAN DAN RUNCIT",
  "SEKTOR INFRASTRUKTUR & PEMBANGUNAN",
  "SEKTOR GAYA HIDUP DAN KREATIF",
  "SEKTOR TEKNOLOGI DAN DIGITAL",
  "SEKTOR LOGISTIK DAN MOBILITY",
  "SEKTOR TENAGA",
  "SEKTOR KOMODITI DAN AGRO",
  "SEKTOR HALAL",
];

export const CANONICAL_BUSINESS_TYPES: readonly string[] = [
  "PROFESSIONAL & BUSINESS SERVICES",
  "CONSTRUCTION, CONTRACTORS & FACILITY MANAGEMENT",
  "TRADING, IMPORT & EXPORT",
  "FASHION, APPARELS & LIFESTYLE",
  "INFORMATION TECHNOLOGY & TELECOMMUNICATIONS (ICT)",
  "FOOD & BEVERAGES (F&B) & AGRICULTURE",
  "AUTOMOTIVE, MOBILITY & ENGINEERING",
  "FINANCE, INVESTMENT & EDUCATION",
  "TOURISM, EVENTS, HOSPITALITY & ENTERTAINMENT",
];

// Spelling variants found in the workbook -> canonical value
const SECTOR_ALIASES: Record<string, string> = {
  "SEKTOR TEKNOLOGI DAN DAN DIGITAL": "SEKTOR TEKNOLOGI DAN DIGITAL",
  "SEKTOR PERDANGANGAN DAN RUNCIT": "SEKTOR PERDAGANGAN DAN RUNCIT",
  "SEKTOR KOMODITI & AGRO": "SEKTOR KOMODITI DAN AGRO",
  "SEKTOR INFRASTRUKTUR DAN PEMBANGUNAN": "SEKTOR INFRASTRUKTUR & PEMBANGUNAN",
};

const BUSINESS_TYPE_ALIASES: Record<string, string> = {
  "FOOD & BAVERAGES & AGRICULTURAL": "FOOD & BEVERAGES (F&B) & AGRICULTURE",
  "CONSTRUCTION,CONTRACTOR AND FACILITIES MANAGEMENT": "CONSTRUCTION, CONTRACTORS & FACILITY MANAGEMENT",
};

// ---------------------------------------------------------------------------
// Field cleaners
// ---------------------------------------------------------------------------

/** Trims, collapses whitespace, and turns empty values into null. */
export function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/**
 * Converts Malaysian phone numbers to +60 format. Takes the first valid number in the
 * cell and returns a second number separately when the cell holds two.
 */
export function normalizePhone(raw: unknown): { value: string | null; extra: string | null; invalid: boolean } {
  const text = clean(raw);
  if (!text) return { value: null, extra: null, invalid: false };

  const toE164 = (part: string): string | null => {
    let digits = part.replace(/\D/g, "");
    if (digits.startsWith("60")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = digits.slice(1);
    return /^\d{8,10}$/.test(digits) ? `+60${digits}` : null;
  };

  const numbers = text
    .split(/[\/;,]/)
    .filter((part) => part.replace(/\D/g, "").length >= 7)
    .map(toE164)
    .filter((n): n is string => n !== null);

  if (numbers.length === 0) return { value: null, extra: null, invalid: true };
  return { value: numbers[0], extra: numbers[1] ?? null, invalid: false };
}

/** Formats an IC number as 000000-00-0000, drops "0" placeholders, and flags anything unusual. */
export function normalizeIc(raw: unknown): { value: string | null; placeholder: boolean; needsReview: boolean } {
  const text = clean(raw);
  if (!text) return { value: null, placeholder: false, needsReview: false };
  if (/^0+$/.test(text)) return { value: null, placeholder: true, needsReview: false };
  if (/^\d{12}$/.test(text)) {
    return { value: `${text.slice(0, 6)}-${text.slice(6, 8)}-${text.slice(8)}`, placeholder: false, needsReview: false };
  }
  if (/^\d{6}-\d{2}-\d{4}$/.test(text)) return { value: text, placeholder: false, needsReview: false };
  return { value: text, placeholder: false, needsReview: true };
}

/** Accepts ISO strings (with or without a time), Date objects, and dd/mm/yyyy. Returns YYYY-MM-DD or null. */
export function parseJoinedDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const text = clean(value);
  if (!text) return null;

  let year: number, month: number, day: number;
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const local = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
    if (!local) return null;
    day = Number(local[1]);
    month = Number(local[2]);
    year = Number(local[3]);
  }

  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function resolveLookup(
  raw: unknown,
  canonical: readonly string[],
  aliases: Record<string, string>
): { name: string | null; outcome: "exact" | "fixed" | "unmapped" | "empty" } {
  const text = clean(raw);
  if (!text) return { name: null, outcome: "empty" };
  const key = text.toUpperCase();
  if (canonical.includes(key)) return { name: key, outcome: "exact" };
  if (aliases[key]) return { name: aliases[key], outcome: "fixed" };
  return { name: key, outcome: "unmapped" };
}

function toStatus(raw: unknown): MemberStatus | null {
  const value = clean(raw)?.toLowerCase();
  return value === "pending" || value === "active" || value === "expired" || value === "suspended" ? value : null;
}

function toYear(raw: unknown): number | null {
  const n = Number(clean(raw));
  return Number.isInteger(n) && n >= 1990 && n <= 2100 ? n : null;
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

export function transformRows(rows: RawRow[], options: { today?: string } = {}): TransformResult {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const members: MemberInsert[] = [];
  const issues: Issue[] = [];
  const newSectors = new Set<string>();
  const newBusinessTypes = new Set<string>();

  rows.forEach((row, index) => {
    const membershipNo = clean(row["Membership No"]);
    if (!membershipNo) return; // blank spreadsheet row

    const flag = (code: IssueCode, severity: Severity, detail?: string) =>
      issues.push({ membershipNo, code, severity, detail });

    const fullName = clean(row["Full Name"]);
    const emailRaw = clean(row["Email"]);
    const email = emailRaw?.toLowerCase() ?? null;
    const fasal = clean(row["Membership Type (Fasal)"]);
    const joinedDate = parseJoinedDate(row["Joined Date"]);

    // Required fields: skip the row (and say so) rather than import bad data
    const missing: string[] = [];
    if (!fullName) missing.push("full name");
    if (!email || !EMAIL_PATTERN.test(email)) missing.push("valid email");
    if (!fasal) missing.push("membership type");
    if (!joinedDate) missing.push("joined date");
    if (missing.length > 0 || !fullName || !email || !fasal || !joinedDate) {
      flag("row_skipped", "error", `missing ${missing.join(", ")}`);
      return;
    }

    let status = toStatus(row["Status"]);
    if (!status) {
      flag("status_unknown", "warn", `"${clean(row["Status"]) ?? ""}" set to pending`);
      status = "pending";
    }

    const phone = normalizePhone(row["Phone No"]);
    if (phone.invalid) flag("phone_invalid", "warn");
    if (phone.extra) flag("phone_second_number", "info");

    const officeRaw = clean(row["Office Tel"]);
    const office = normalizePhone(row["Office Tel"]);
    const officeTel = office.value && office.value !== phone.value ? office.value : null;

    const ic = normalizeIc(row["IC No"]);
    if (ic.placeholder) flag("ic_placeholder_removed", "info");
    if (ic.needsReview) flag("ic_format_review", "warn");

    const sector = resolveLookup(row["Business Sector"], CANONICAL_SECTORS, SECTOR_ALIASES);
    if (sector.outcome === "fixed") flag("sector_variant_fixed", "info");
    if (sector.outcome === "unmapped" && sector.name) {
      newSectors.add(sector.name);
      flag("sector_unmapped", "warn", "added as a new sector");
    }

    const type = resolveLookup(row["Business Type"], CANONICAL_BUSINESS_TYPES, BUSINESS_TYPE_ALIASES);
    if (type.outcome === "fixed") flag("type_variant_fixed", "info");
    if (type.outcome === "unmapped" && type.name) {
      newBusinessTypes.add(type.name);
      flag("type_unmapped", "warn", "added as a new business type");
    }

    if (joinedDate > today) flag("joined_date_future", "warn", joinedDate);
    if (/\b(TBA|PENDING|REFUND)\b/i.test(fullName)) flag("name_needs_review", "warn");

    members.push({
      membershipNo,
      legacyMembershipNo: clean(row["Legacy Membership No"]),
      fasal,
      status,
      fullName,
      companyName: clean(row["Company Name"]),
      email,
      phone: phone.value,
      officeTel,
      icNo: ic.value,
      ssmNo: clean(row["SSM / Registration No"]),
      sectorName: sector.name,
      businessTypeName: type.name,
      introducerName: clean(row["Introducer"]),
      mailingAddress: clean(row["Mailing Address"]),
      registeredAddress: clean(row["Registered Address"]),
      joinedDate,
      legacyEntityType: clean(row["Entity Type (Legacy)"]),
      legacyPaymentYear: toYear(row["Payment Year"]),
      // Raw text kept so nothing from the spreadsheet is lost
      legacyData: {
        sourceRow: typeof row["__row"] === "number" ? row["__row"] : index + 2,
        receiptNo: clean(row["Receipt No"]),
        paymentNotes: clean(row["Payment Notes"]),
        phoneRaw: clean(row["Phone No"]) !== phone.value ? clean(row["Phone No"]) : undefined,
        phoneSecondNumber: phone.extra ?? undefined,
        officeTelRaw: officeRaw !== clean(row["Phone No"]) ? officeRaw : undefined,
        icRaw: clean(row["IC No"]) !== ic.value ? clean(row["IC No"]) : undefined,
        sectorRaw: sector.outcome !== "exact" ? clean(row["Business Sector"]) : undefined,
        businessTypeRaw: type.outcome !== "exact" ? clean(row["Business Type"]) : undefined,
      },
    });
  });

  // Emails used by more than one member (shared mailboxes, one person with two companies)
  const byEmail = new Map<string, string[]>();
  for (const m of members) {
    byEmail.set(m.email, [...(byEmail.get(m.email) ?? []), m.membershipNo]);
  }
  for (const group of byEmail.values()) {
    if (group.length > 1) {
      for (const membershipNo of group) {
        issues.push({ membershipNo, code: "email_shared", severity: "info", detail: `${group.length} members` });
      }
    }
  }

  return {
    members,
    issues,
    rowsRead: rows.filter((r) => clean(r["Membership No"])).length,
    newSectors: [...newSectors],
    newBusinessTypes: [...newBusinessTypes],
  };
}
