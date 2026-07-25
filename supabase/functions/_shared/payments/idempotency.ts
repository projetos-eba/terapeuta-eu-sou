export function createIdempotencyKey(
  parts: Array<string | number | null | undefined>,
) {
  return parts
    .filter(
      (part): part is string | number => part !== null && part !== undefined,
    )
    .map((part) => String(part).replace(/[^a-zA-Z0-9_.:-]/g, "_"))
    .join(":")
    .slice(0, 255);
}
