import { clean, isValidIsoDate, normalizeIc, normalizePhone } from "@/lib/normalize";

export const MEMBER_STATUSES = ["pending", "active", "expired", "suspended"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/** What the form submits: every field arrives as text. */
export type RawMemberForm = Record<string, string>;

export interface ValidatedMember {
  fullName: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  officeTel: string | null;
  icNo: string | null;
  ssmNo: string | null;
  mailingAddress: string | null;
  registeredAddress: string | null;
  joinedDate: string;
  status: MemberStatus;
  membershipTypeId: number;
  businessSectorId: number | null;
  businessTypeId: number | null;
  introducerId: number | null;
  adminNotes: string | null;
}

export interface ValidationContext {
  /** Today as YYYY-MM-DD, passed in so the rule is testable. */
  today: string;
  /** Values already saved. Unchanged legacy values are accepted so other fields can still be edited. */
  existing: { icNo: string | null; joinedDate: string };
  validTypeIds: readonly number[];
  validSectorIds: readonly number[];
  validBusinessTypeIds: readonly number[];
  validIntroducerIds: readonly number[];
}

export type ValidationResult =
  | { ok: true; data: ValidatedMember }
  | { ok: false; fieldErrors: Record<string, string> };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function optionalId(raw: string | undefined, valid: readonly number[], errors: Record<string, string>, field: string): number | null {
  const text = clean(raw);
  if (!text) return null;
  const id = Number(text);
  if (!Number.isInteger(id) || !valid.includes(id)) {
    errors[field] = "Choose one of the listed options.";
    return null;
  }
  return id;
}

export function validateMemberForm(raw: RawMemberForm, ctx: ValidationContext): ValidationResult {
  const errors: Record<string, string> = {};

  const fullName = clean(raw.fullName);
  if (!fullName) errors.fullName = "Enter the member's name.";
  else if (fullName.length > 200) errors.fullName = "Keep the name under 200 characters.";

  const companyName = clean(raw.companyName);
  if (companyName && companyName.length > 200) errors.companyName = "Keep this under 200 characters.";

  const email = clean(raw.email)?.toLowerCase() ?? "";
  if (!email) errors.email = "Enter an email address.";
  else if (email.length > 254 || !EMAIL.test(email)) errors.email = "Enter a valid email address, like name@example.com.";

  const phoneRaw = clean(raw.phone);
  let phone: string | null = null;
  if (phoneRaw) {
    phone = normalizePhone(phoneRaw);
    if (!phone) errors.phone = "Enter a Malaysian phone number, for example 012-3456789.";
  }

  const officeRaw = clean(raw.officeTel);
  let officeTel: string | null = null;
  if (officeRaw) {
    officeTel = normalizePhone(officeRaw);
    if (!officeTel) errors.officeTel = "Enter a Malaysian phone number, for example 03-12345678.";
  }

  const icRaw = clean(raw.icNo);
  let icNo: string | null = null;
  if (icRaw) {
    if (icRaw === ctx.existing.icNo) icNo = icRaw; // unchanged, even if it is in an old odd format
    else {
      icNo = normalizeIc(icRaw);
      if (!icNo) errors.icNo = "Enter 12 digits, like 800101-01-5555.";
    }
  }

  const ssmNo = clean(raw.ssmNo);
  if (ssmNo && ssmNo.length > 100) errors.ssmNo = "Keep this under 100 characters.";

  const mailingAddress = clean(raw.mailingAddress);
  const registeredAddress = clean(raw.registeredAddress);
  if (mailingAddress && mailingAddress.length > 500) errors.mailingAddress = "Keep the address under 500 characters.";
  if (registeredAddress && registeredAddress.length > 500) errors.registeredAddress = "Keep the address under 500 characters.";

  const joinedDate = clean(raw.joinedDate) ?? "";
  if (!isValidIsoDate(joinedDate)) errors.joinedDate = "Enter a valid date.";
  else if (joinedDate > ctx.today && joinedDate !== ctx.existing.joinedDate) errors.joinedDate = "The joined date cannot be in the future.";

  const status = clean(raw.status) as MemberStatus | null;
  if (!status || !MEMBER_STATUSES.includes(status)) errors.status = "Choose a status.";

  const membershipTypeId = Number(clean(raw.membershipTypeId));
  if (!Number.isInteger(membershipTypeId) || !ctx.validTypeIds.includes(membershipTypeId)) {
    errors.membershipTypeId = "Choose a membership type.";
  }

  const businessSectorId = optionalId(raw.businessSectorId, ctx.validSectorIds, errors, "businessSectorId");
  const businessTypeId = optionalId(raw.businessTypeId, ctx.validBusinessTypeIds, errors, "businessTypeId");
  const introducerId = optionalId(raw.introducerId, ctx.validIntroducerIds, errors, "introducerId");

  const adminNotes = clean(raw.adminNotes);
  if (adminNotes && adminNotes.length > 2000) errors.adminNotes = "Keep notes under 2000 characters.";

  if (Object.keys(errors).length > 0 || !fullName || !status) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    data: {
      fullName,
      companyName,
      email,
      phone,
      officeTel,
      icNo,
      ssmNo,
      mailingAddress,
      registeredAddress,
      joinedDate,
      status,
      membershipTypeId,
      businessSectorId,
      businessTypeId,
      introducerId,
      adminNotes,
    },
  };
}

/** Fields that changed, as { field: { from, to } }. IC numbers are recorded as "changed" only. */
export function diffMember(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if ((before[key] ?? null) === (after[key] ?? null)) continue;
    changes[key] = key === "icNo" ? "changed" : { from: before[key] ?? null, to: after[key] ?? null };
  }
  return changes;
}
