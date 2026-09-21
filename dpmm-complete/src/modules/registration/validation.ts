import { clean, normalizeIc, normalizePhone } from "@/lib/normalize";

export type EntityKind = "individual" | "company" | "cooperative";

export interface RegistrationContext {
  types: readonly { id: number; entityType: EntityKind }[];
  validSectorIds: readonly number[];
  validBusinessTypeIds: readonly number[];
}

export interface RegistrationData {
  membershipTypeId: number;
  fullName: string;
  companyName: string | null;
  email: string;
  phone: string;
  icNo: string;
  ssmNo: string | null;
  mailingAddress: string | null;
  registeredAddress: string;
  businessSectorId: number | null;
  businessTypeId: number | null;
  /** Free text, because the list of introducers is not shown to the public. */
  introducedBy: string | null;
}

export type RegistrationResult =
  | { ok: true; data: RegistrationData }
  | { ok: false; fieldErrors: Record<string, string> };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateRegistration(raw: Record<string, string>, ctx: RegistrationContext): RegistrationResult {
  const errors: Record<string, string> = {};

  const typeId = Number(clean(raw.membershipTypeId));
  const type = ctx.types.find((t) => t.id === typeId);
  if (!type) errors.membershipTypeId = "Choose the type of membership you are applying for.";
  const needsCompany = type?.entityType === "company" || type?.entityType === "cooperative";

  const fullName = clean(raw.fullName);
  if (!fullName) errors.fullName = "Enter your full name, as on your IC.";
  else if (fullName.length > 200) errors.fullName = "Keep your name under 200 characters.";

  const companyName = clean(raw.companyName);
  if (needsCompany && !companyName) errors.companyName = "Enter your company or cooperative name.";
  else if (companyName && companyName.length > 200) errors.companyName = "Keep this under 200 characters.";

  const email = clean(raw.email)?.toLowerCase() ?? "";
  if (!email) errors.email = "Enter your email address.";
  else if (email.length > 254 || !EMAIL.test(email)) errors.email = "Enter a valid email address, like name@example.com.";

  const phoneRaw = clean(raw.phone);
  let phone = "";
  if (!phoneRaw) errors.phone = "Enter a phone number we can reach you on.";
  else {
    const normalized = normalizePhone(phoneRaw);
    if (!normalized) errors.phone = "Enter a Malaysian phone number, for example 012-3456789.";
    else phone = normalized;
  }

  const icRaw = clean(raw.icNo);
  let icNo = "";
  if (!icRaw) errors.icNo = "Enter your IC number.";
  else {
    const normalized = normalizeIc(icRaw);
    if (!normalized) errors.icNo = "Enter 12 digits, like 800101-01-5555.";
    else icNo = normalized;
  }

  const ssmNo = clean(raw.ssmNo);
  if (needsCompany && !ssmNo) errors.ssmNo = "Enter your SSM registration number.";
  else if (ssmNo && ssmNo.length > 100) errors.ssmNo = "Keep this under 100 characters.";

  const registeredAddress = clean(raw.registeredAddress);
  if (!registeredAddress) errors.registeredAddress = needsCompany ? "Enter your registered business address." : "Enter your address.";
  else if (registeredAddress.length > 500) errors.registeredAddress = "Keep the address under 500 characters.";

  const mailingAddress = clean(raw.mailingAddress);
  if (mailingAddress && mailingAddress.length > 500) errors.mailingAddress = "Keep the address under 500 characters.";

  const pickId = (value: string | undefined, valid: readonly number[], field: string): number | null => {
    const text = clean(value);
    if (!text) return null;
    const id = Number(text);
    if (!Number.isInteger(id) || !valid.includes(id)) {
      errors[field] = "Choose one of the listed options.";
      return null;
    }
    return id;
  };
  const businessSectorId = pickId(raw.businessSectorId, ctx.validSectorIds, "businessSectorId");
  const businessTypeId = pickId(raw.businessTypeId, ctx.validBusinessTypeIds, "businessTypeId");

  const introducedBy = clean(raw.introducedBy);
  if (introducedBy && introducedBy.length > 200) errors.introducedBy = "Keep this under 200 characters.";

  if (raw.consent !== "on") errors.consent = "Please confirm that you agree, so we can process your application.";

  if (Object.keys(errors).length > 0 || !type || !fullName || !registeredAddress) {
    return { ok: false, fieldErrors: errors };
  }

  return {
    ok: true,
    data: {
      membershipTypeId: type.id,
      fullName,
      companyName,
      email,
      phone,
      icNo,
      ssmNo,
      mailingAddress,
      registeredAddress,
      businessSectorId,
      businessTypeId,
      introducedBy,
    },
  };
}

/** Reduces an SSM / registration number to lowercase letters and digits for comparing. */
export function compactRegistrationNo(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The note staff see on an application: where it came from and anything worth checking. */
export function buildApplicationNote(input: { introducedBy: string | null; sameIcMembers: string[] }): string {
  const lines = ["Applied online."];
  if (input.introducedBy) lines.push(`Introduced by: ${input.introducedBy}`);
  if (input.sameIcMembers.length > 0) {
    lines.push(`Check: the IC number matches existing member(s) ${input.sameIcMembers.join(", ")}.`);
  }
  return lines.join("\n");
}
