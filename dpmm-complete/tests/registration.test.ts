import { validateRegistration, compactRegistrationNo, buildApplicationNote, type RegistrationContext } from "@/modules/registration/validation";
let fail = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? "ok  " : "FAIL", n, ok ? "" : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const ctx: RegistrationContext = { types: [{ id: 1, entityType: "individual" }, { id: 5, entityType: "company" }, { id: 6, entityType: "cooperative" }], validSectorIds: [1, 2], validBusinessTypeIds: [1, 2] };
const person = { membershipTypeId: "1", fullName: " Aisyah  Binti Omar ", companyName: "", email: "Aisyah@Example.com", phone: "012-3456789", icNo: "900101015555", ssmNo: "", registeredAddress: "1 Jalan Satu", mailingAddress: "", businessSectorId: "", businessTypeId: "", introducedBy: "", consent: "on", website: "" };

const r = validateRegistration(person, ctx);
eq("individual application valid", r.ok, true);
if (r.ok) { eq("cleaned + normalised", [r.data.fullName, r.data.email, r.data.phone, r.data.icNo], ["Aisyah Binti Omar", "aisyah@example.com", "+60123456789", "900101-01-5555"]); eq("optional blanks are null", [r.data.companyName, r.data.ssmNo, r.data.mailingAddress, r.data.businessSectorId, r.data.introducedBy], [null, null, null, null, null]); }

const noCompany = validateRegistration({ ...person, membershipTypeId: "5" }, ctx);
eq("company type requires company name + SSM", !noCompany.ok && Object.keys(noCompany.fieldErrors).sort(), ["companyName", "ssmNo"]);
eq("company with both is valid", validateRegistration({ ...person, membershipTypeId: "5", companyName: "Maju Sdn Bhd", ssmNo: "202001000001" }, ctx).ok, true);
eq("cooperative also needs SSM", (validateRegistration({ ...person, membershipTypeId: "6", companyName: "Koperasi Maju" }, ctx) as any).fieldErrors?.ssmNo !== undefined, true);
eq("consent required", (validateRegistration({ ...person, consent: "" }, ctx) as any).fieldErrors?.consent !== undefined, true);
eq("consent must be exactly 'on'", (validateRegistration({ ...person, consent: "yes" }, ctx) as any).fieldErrors?.consent !== undefined, true);
eq("no type chosen", (validateRegistration({ ...person, membershipTypeId: "" }, ctx) as any).fieldErrors?.membershipTypeId !== undefined, true);
eq("unknown type id rejected", (validateRegistration({ ...person, membershipTypeId: "99" }, ctx) as any).fieldErrors?.membershipTypeId !== undefined, true);
eq("bad IC / phone / email all reported", Object.keys((validateRegistration({ ...person, icNo: "123", phone: "1", email: "x" }, ctx) as any).fieldErrors).sort(), ["email", "icNo", "phone"]);
eq("phone required for applicants", (validateRegistration({ ...person, phone: "" }, ctx) as any).fieldErrors?.phone !== undefined, true);
eq("bad sector id rejected", (validateRegistration({ ...person, businessSectorId: "42" }, ctx) as any).fieldErrors?.businessSectorId !== undefined, true);
eq("valid sector accepted", (validateRegistration({ ...person, businessSectorId: "2" }, ctx) as any).data?.businessSectorId, 2);
eq("address required", (validateRegistration({ ...person, registeredAddress: "  " }, ctx) as any).fieldErrors?.registeredAddress, "Enter your address.");
eq("company address wording", (validateRegistration({ ...person, membershipTypeId: "5", companyName: "M", ssmNo: "1", registeredAddress: "" }, ctx) as any).fieldErrors?.registeredAddress, "Enter your registered business address.");
eq("over-long name rejected", (validateRegistration({ ...person, fullName: "x".repeat(201) }, ctx) as any).fieldErrors?.fullName !== undefined, true);

// SSM comparison and staff note
eq("compact SSM", compactRegistrationNo("(001714587-U) / 2007-0317 6642"), "001714587u200703176642");
eq("note: plain", buildApplicationNote({ introducedBy: null, sameIcMembers: [] }), "Applied online.");
eq("note: introducer + duplicate flag", buildApplicationNote({ introducedBy: "Dr Azrul", sameIcMembers: ["PJ-2026-0009", "PJ-2026-0010"] }), "Applied online.\nIntroduced by: Dr Azrul\nCheck: the IC number matches existing member(s) PJ-2026-0009, PJ-2026-0010.");
console.log(fail ? `\n${fail} FAILED` : "\nall checks passed"); process.exit(fail ? 1 : 0);
