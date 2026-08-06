export function parseContentRangeTotal(value: string | null) {
  if (!value) return null;

  const total = value.split("/").at(-1);

  if (!total || total === "*") return null;

  const parsed = Number.parseInt(total, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
