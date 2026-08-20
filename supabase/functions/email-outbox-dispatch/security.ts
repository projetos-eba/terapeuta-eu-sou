export const HML_PROJECT_REF = "emzwqkmrryuqvqiohqnu";

export function toDispatchLimit(value: unknown) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 50
    ? value
    : 10;
}

export function isHmlProject(supabaseUrl: string) {
  try {
    return new URL(supabaseUrl).hostname === `${HML_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}

export function safeEqual(value: string | null, expected: string) {
  if (!value || value.length !== expected.length) return false;
  let different = 0;
  for (let index = 0; index < value.length; index += 1) {
    different |= value.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return different === 0;
}
