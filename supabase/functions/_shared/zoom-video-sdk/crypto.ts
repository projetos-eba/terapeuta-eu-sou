const encoder = new TextEncoder();

export function base64UrlEncode(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function hmacSha256Bytes(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );

  return new Uint8Array(signature);
}

export async function hmacSha256Hex(secret: string, value: string) {
  return toHex(await hmacSha256Bytes(secret, value));
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toHex(new Uint8Array(digest));
}

export async function constantTimeEquals(expected: string, actual: string) {
  const [expectedHash, actualHash] = await Promise.all([
    sha256Hex(expected),
    sha256Hex(actual),
  ]);

  if (expectedHash.length !== actualHash.length) return false;

  let diff = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    diff |= expectedHash.charCodeAt(index) ^ actualHash.charCodeAt(index);
  }

  return diff === 0;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
