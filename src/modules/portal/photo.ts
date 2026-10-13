export const MAX_PROFILE_PHOTO_BYTES = 3 * 1024 * 1024;

const IMAGE_SIGNATURES = {
  "image/jpeg": (bytes: Uint8Array) =>
    bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes: Uint8Array) =>
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a,
  "image/webp": (bytes: Uint8Array) =>
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50,
} as const;

export type ProfilePhotoType = keyof typeof IMAGE_SIGNATURES;

export function isProfilePhotoType(value: string): value is ProfilePhotoType {
  return Object.hasOwn(IMAGE_SIGNATURES, value);
}

export function hasValidImageSignature(type: ProfilePhotoType, bytes: Uint8Array): boolean {
  return IMAGE_SIGNATURES[type](bytes);
}
