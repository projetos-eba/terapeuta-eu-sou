import type { TherapySearchParams, TherapySort } from "../types";

const DEFAULT_PAGE_SIZE = 16;
const MAX_PAGE_SIZE = 24;
const sortValues = new Set<TherapySort>([
  "relevance",
  "most_searched",
  "popular",
  "newest",
  "az",
]);

export const therapySortOptions: Array<{ label: string; value: TherapySort }> = [
  { label: "Mais relevantes", value: "relevance" },
  { label: "Mais procuradas", value: "most_searched" },
  { label: "Mais populares", value: "popular" },
  { label: "Novas terapias", value: "newest" },
  { label: "A-Z Nome", value: "az" },
];

export function parseTherapySearchParams(
  searchParams?: Record<string, string | string[] | undefined>,
): TherapySearchParams {
  const q = firstValue(searchParams?.q)?.trim();
  const category = firstValue(searchParams?.category)?.trim();
  const sortParam = firstValue(searchParams?.sort) as TherapySort | undefined;
  const page = parsePositiveInt(firstValue(searchParams?.page), 1);
  const pageSize = Math.min(
    parsePositiveInt(firstValue(searchParams?.pageSize), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  return {
    category: category || undefined,
    page,
    pageSize,
    q: q || undefined,
    sort: sortParam && sortValues.has(sortParam) ? sortParam : "relevance",
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
