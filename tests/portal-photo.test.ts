import { hasValidImageSignature, isProfilePhotoType, MAX_PROFILE_PHOTO_BYTES } from "@/modules/portal/photo";

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(ok ? "ok  " : "FAIL", name, ok ? "" : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

eq("3 MB upload limit", MAX_PROFILE_PHOTO_BYTES, 3 * 1024 * 1024);
eq("accept JPEG type", isProfilePhotoType("image/jpeg"), true);
eq("accept PNG type", isProfilePhotoType("image/png"), true);
eq("accept WebP type", isProfilePhotoType("image/webp"), true);
eq("reject other image types", isProfilePhotoType("image/gif"), false);
eq("validate JPEG signature", hasValidImageSignature("image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff])), true);
eq("validate PNG signature", hasValidImageSignature("image/png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
eq("validate WebP signature", hasValidImageSignature("image/webp", Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), true);
eq("reject mismatched image signature", hasValidImageSignature("image/png", Uint8Array.from([0xff, 0xd8, 0xff])), false);

if (fail) process.exitCode = 1;
