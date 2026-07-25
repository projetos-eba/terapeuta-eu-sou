const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value) && !/[\r\n]/.test(value);
}

export function assertSafeEmail(value: string) {
  if (!isValidEmail(value)) {
    throw new Error("invalid_email");
  }
}

export function isValidActionToken(value: string) {
  return TOKEN_PATTERN.test(value);
}

export function sanitizeHeaderText(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}
