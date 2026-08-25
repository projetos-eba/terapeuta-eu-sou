const encoder = new TextEncoder();

export function parseStripeEventId(value: unknown) {
  if (typeof value !== "string" || !/^evt_[A-Za-z0-9]+$/.test(value)) {
    return null;
  }

  return value;
}

export async function fingerprintStripeIdentifier(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `sha256:${hex.slice(0, 16)}`;
}
