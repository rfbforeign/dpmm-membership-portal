import { safeNext } from "@/lib/safe-redirect";
import { validateNewPassword } from "@/modules/auth/password-policy";
import { generateToken, hashToken } from "@/modules/auth/token";
import { roleHome, isStaff, STAFF_ROLES } from "@/modules/auth/roles";
let fail = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? "ok  " : "FAIL", n, ok ? "" : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };

// safeNext: open-redirect protection
eq("relative path ok",            safeNext("/admin/members?page=2"), "/admin/members?page=2");
eq("null/empty",                  [safeNext(null), safeNext(""), safeNext(undefined)], [null, null, null]);
eq("absolute URL blocked",        safeNext("https://evil.com/x"), null);
eq("protocol-relative blocked",   safeNext("//evil.com"), null);
eq("backslash trick blocked",     safeNext("/\\evil.com"), null);
eq("no leading slash blocked",    safeNext("admin"), null);
eq("javascript: blocked",         safeNext("javascript:alert(1)"), null);
eq("control chars blocked",       safeNext("/admin\r\nSet-Cookie: x=1"), null);

// password policy
const ctx = { email: "admin@example.com", current: "oldpass" };
eq("too short",                   validateNewPassword("Short1!", ctx)?.startsWith("Use at least 12"), true);
eq("old weak password rejected",  validateNewPassword("oldpass", ctx) !== null, true);
eq("contains current",            validateNewPassword("oldpass-oldpass-oldpass", ctx)?.includes("different"), true);
eq("contains email name",         validateNewPassword("admin-secret-2026", ctx)?.includes("email name"), true);
eq("repetitive",                  validateNewPassword("aaaaaaaaaaaaaa", ctx)?.includes("repetitive"), true);
eq("common",                      validateNewPassword("Password12345", ctx)?.includes("common"), true);
eq("over 72 bytes",               validateNewPassword("x".repeat(40) + "y".repeat(40), ctx) !== null, true);
eq("good passphrase accepted",    validateNewPassword("blue tiger walks past 7 lanterns", ctx), null);
eq("12 chars boundary accepted",  validateNewPassword("kopi-o-kosong", { email: "a@b.com" }), null);

// tokens
const t1 = generateToken(), t2 = generateToken();
eq("token length (43 base64url chars)", t1.length, 43);
eq("tokens are unique",           t1 !== t2, true);
eq("token is URL/cookie safe",    /^[A-Za-z0-9_-]+$/.test(t1), true);
eq("hash is sha256 hex",          /^[0-9a-f]{64}$/.test(hashToken(t1)), true);
eq("hash is deterministic",       hashToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
eq("hash differs from token",     hashToken(t1) !== t1, true);

// roles
eq("admin home",                  roleHome("admin"), "/admin");
eq("treasurer home",              roleHome("treasurer"), "/admin");
eq("secretariat home",            roleHome("secretariat"), "/admin");
eq("member home",                 roleHome("member"), "/portal");
eq("member is not staff",         isStaff("member"), false);
eq("staff roles",                 [...STAFF_ROLES], ["admin", "secretariat", "treasurer"]);
console.log(fail ? `\n${fail} FAILED` : "\nall checks passed"); process.exit(fail ? 1 : 0);
