const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const documentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const videoTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export type SupportedUploadMimeType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "video/mp4"
  | "video/quicktime"
  | "video/webm";

export function isSupportedDocumentType(
  contentType: string,
): contentType is
  | "application/pdf"
  | Extract<SupportedUploadMimeType, `image/${string}`> {
  return documentTypes.has(contentType);
}

export function isSupportedImageType(
  contentType: string,
): contentType is Extract<SupportedUploadMimeType, `image/${string}`> {
  return imageTypes.has(contentType);
}

export function isSupportedVideoType(
  contentType: string,
): contentType is Extract<SupportedUploadMimeType, `video/${string}`> {
  return videoTypes.has(contentType);
}

export async function hasValidUploadSignature(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());

  switch (file.type) {
    case "application/pdf":
      return hasAscii(bytes, 0, "%PDF");
    case "image/jpeg":
      return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return hasAscii(bytes, 0, "RIFF") && hasAscii(bytes, 8, "WEBP");
    case "video/mp4":
    case "video/quicktime":
      return hasAscii(bytes, 4, "ftyp");
    case "video/webm":
      return hasPrefix(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
    default:
      return false;
  }
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((byte, index) => bytes[index] === byte);
}

function hasAscii(bytes: Uint8Array, offset: number, value: string) {
  return Array.from(value).every(
    (character, index) => bytes[offset + index] === character.charCodeAt(0),
  );
}
