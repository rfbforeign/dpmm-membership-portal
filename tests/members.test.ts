import { maskIc } from "@/lib/mask";
import { clean, normalizePhone, normalizeIc, isValidIsoDate, escapeLike } from "@/lib/normalize";
import { validateMemberForm, diffMember, type RawMemberForm, type ValidationContext } from "@/modules/members/validation";
import { canEditMembers, canViewFullIc } from "@/modules/members/permissions";

let fail = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? "ok  " : "FAIL", n, ok ? "" : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };

// masking
eq("mask IC", maskIc("800101-01-5555"), "******-**-5555");
eq("mask odd IC", maskIc("9007020-02-6357"), "******-**-6357");
eq("mask null", maskIc(null), null);
eq("mask short", maskIc("12"), "**");
// normalisers
eq("phone", normalizePhone("012-3456789"), "+60123456789");
eq("phone bad", normalizePhone("123"), null);
eq("ic 12 digits", normalizeIc("800101015555"), "800101-01-5555");
eq("ic odd rejected", normalizeIc("9007020-02-6357"), null);
eq("date ok", isValidIsoDate("2026-09-20"), true);
eq("date impossible", isValidIsoDate("2026-02-31"), false);
eq("date wrong format", isValidIsoDate("20/09/2026"), false);
eq("escapeLike", escapeLike("50%_off\\"), "50\\%\\_off\\\\");
eq("clean", clean("  a   b "), "a b");
// permissions
eq("secretariat edits", canEditMembers("secretariat"), true);
eq("treasurer read-only", canEditMembers("treasurer"), false);
eq("treasurer masked IC", canViewFullIc("treasurer"), false);
eq("admin sees IC", canViewFullIc("admin"), true);

// validation
const ctx = (over: Partial<ValidationContext["existing"]> = {}): ValidationContext => ({
  today: "2026-09-20", existing: { icNo: "800101-01-5555", joinedDate: "2020-01-01", ...over },
  validTypeIds: [1, 2, 3, 4, 5, 6], validSectorIds: [1, 2, 3], validBusinessTypeIds: [1, 2, 3], validIntroducerIds: [1, 2],
});
const good: RawMemberForm = { fullName: "  Test  Person ", companyName: "Test Sdn Bhd", email: " Test@Example.COM ", phone: "012-3456789", officeTel: "", icNo: "800101015555",
  ssmNo: "202001000001", mailingAddress: "A", registeredAddress: "B", joinedDate: "2020-01-01", status: "active", membershipTypeId: "5", businessSectorId: "2", businessTypeId: "", introducerId: "1", adminNotes: "" };
const r = validateMemberForm(good, ctx());
eq("valid form ok", r.ok, true);
if (r.ok) {
  eq("name cleaned", r.data.fullName, "Test Person");
  eq("email lowercased", r.data.email, "test@example.com");
  eq("phone normalised", r.data.phone, "+60123456789");
  eq("ic dashed", r.data.icNo, "800101-01-5555");
  eq("empty optional -> null", [r.data.officeTel, r.data.businessTypeId, r.data.adminNotes], [null, null, null]);
  eq("ids numeric", [r.data.membershipTypeId, r.data.businessSectorId, r.data.introducerId], [5, 2, 1]);
}
const bad = validateMemberForm({ ...good, fullName: "", email: "nope", phone: "12", icNo: "123", joinedDate: "2099-01-01", status: "weird", membershipTypeId: "99", businessSectorId: "42" }, ctx());
eq("bad form fails", bad.ok, false);
if (!bad.ok) eq("every problem reported", Object.keys(bad.fieldErrors).sort(), ["businessSectorId","email","fullName","icNo","joinedDate","membershipTypeId","phone","status"]);
// legacy values must not block editing OTHER fields
const legacyIc = validateMemberForm({ ...good, icNo: "9007020-02-6357" }, ctx({ icNo: "9007020-02-6357" }));
eq("unchanged odd IC accepted", legacyIc.ok, true);
const changedOdd = validateMemberForm({ ...good, icNo: "9007020-02-6358" }, ctx({ icNo: "9007020-02-6357" }));
eq("changed odd IC rejected", changedOdd.ok, false);
const futureKept = validateMemberForm({ ...good, joinedDate: "2026-12-06" }, ctx({ joinedDate: "2026-12-06" }));
eq("unchanged future date accepted", futureKept.ok, true);
const futureNew = validateMemberForm({ ...good, joinedDate: "2026-12-07" }, ctx({ joinedDate: "2026-12-06" }));
eq("newly future date rejected", futureNew.ok, false);
const fixDate = validateMemberForm({ ...good, joinedDate: "2025-12-06" }, ctx({ joinedDate: "2026-12-06" }));
eq("correcting a future date works", fixDate.ok, true);
eq("empty IC clears it", (validateMemberForm({ ...good, icNo: "" }, ctx()) as any).data.icNo, null);

// diff
eq("diff only changes", diffMember({ a: "x", b: 1, icNo: "1" }, { a: "x", b: 2, icNo: "2" }), { b: { from: 1, to: 2 }, icNo: "changed" });
eq("diff null vs undefined equal", diffMember({ a: null }, { a: undefined }), {});
console.log(fail ? `\n${fail} FAILED` : "\nall checks passed"); process.exit(fail ? 1 : 0);
