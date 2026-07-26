const encoder = new TextEncoder();

export function base64UrlEncode(value: ArrayBuffer | Uint8Array | string) {
  const bytes =
    typeof value === "string"
      ? encoder.encode(value)
      : value instanceof Uint8Array
        ? value
        : new Uint8Array(value);
  let binary = "";

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function basicAuth(clientId: string, clientSecret: string) {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

export async function hmacSha256Hex(secret: string, message: string) {
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
    encoder.encode(message),
  );

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Base64Url(secret: string, message: string) {
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
    encoder.encode(message),
  );

  return base64UrlEncode(signature);
}

export async function sha256Hex(message: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(message));

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function constantTimeEquals(left: string, right: string) {
  const leftDigest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(left)),
  );
  const rightDigest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(right)),
  );
  let diff = leftDigest.length ^ rightDigest.length;

  for (let index = 0; index < leftDigest.length; index += 1) {
    diff |= leftDigest[index] ^ (rightDigest[index] ?? 0);
  }

  return diff === 0 && left === right;
}

export function randomOpaqueKey(prefix = "tes_zoom") {
  const bytes = crypto.getRandomValues(new Uint8Array(18));

  return `${prefix}_${base64UrlEncode(bytes)}`;
}
