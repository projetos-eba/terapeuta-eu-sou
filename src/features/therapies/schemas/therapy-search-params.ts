import type { TherapySearchParams, TherapySort } from "../types";

const DEFAULT_PAGE_SIZE = 16;
const MAX_PAGE_SIZE = 24;
const sortValues = new Set<TherapySort>([
  "most_searched",
  "newest",
  "az",
]);

export const therapySortOptions: Array<{ label: string; value: TherapySort }> = [
  { label: "Mais procuradas", value: "most_searched" },
  { label: "Adicionadas recentemente", value: "newest" },
  { label: "A–Z", value: "az" },
];

export function parseTherapySearchParams(
  searchParams?: Record<string, string | string[] | undefined>,
): TherapySearchParams {
  const q = firstValue(searchParams?.q)?.trim();
  const theme = firstValue(searchParams?.theme)?.trim();
  const sortParam = firstValue(searchParams?.sort) as TherapySort | undefined;
  const page = parsePositiveInt(firstValue(searchParams?.page), 1);
  const pageSize = Math.min(
    parsePositiveInt(firstValue(searchParams?.pageSize), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  return {
    theme: theme && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(theme) ? theme : undefined,
    page,
    pageSize,
    q: q || undefined,
    sort:
      sortParam && sortValues.has(sortParam) ? sortParam : "most_searched",
  };
}

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
