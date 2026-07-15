import type {
  TherapistSearchAvailability,
  TherapistSearchFilters,
  TherapistSearchPrice,
  TherapistSearchRating,
  TherapistSearchSort,
} from "./types";

const availabilityValues = new Set<TherapistSearchAvailability>([
  "today",
  "tomorrow",
  "week",
]);
const priceValues = new Set<TherapistSearchPrice>([
  "up-to-100",
  "100-150",
  "150-plus",
]);
const ratingValues = new Set<TherapistSearchRating>(["4-plus", "4-5-plus"]);
const sortValues = new Set<TherapistSearchSort>([
  "relevance",
  "rating",
  "price_asc",
  "next_slot",
]);

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function cleanText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 80) : undefined;
}

function cleanSlug(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[a-z0-9-]+$/.test(normalized)
    ? normalized
    : undefined;
}

export function parseTherapistSearchParams(
  searchParams: RawSearchParams = {},
): TherapistSearchFilters {
  const page = Number.parseInt(firstValue(searchParams.page) ?? "1", 10);
  const sort = firstValue(searchParams.sort);
  const availability = firstValue(searchParams.availability);
  const price = firstValue(searchParams.price);
  const rating = firstValue(searchParams.rating);

  return {
    availability:
      availability && availabilityValues.has(availability as TherapistSearchAvailability)
        ? (availability as TherapistSearchAvailability)
        : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    price:
      price && priceValues.has(price as TherapistSearchPrice)
        ? (price as TherapistSearchPrice)
        : undefined,
    q: cleanText(firstValue(searchParams.q)),
    rating:
      rating && ratingValues.has(rating as TherapistSearchRating)
        ? (rating as TherapistSearchRating)
        : undefined,
    sort:
      sort && sortValues.has(sort as TherapistSearchSort)
        ? (sort as TherapistSearchSort)
        : "relevance",
    theme: cleanSlug(firstValue(searchParams.theme)),
    therapy: cleanSlug(firstValue(searchParams.therapy)),
  };
}

export function getActiveFilterCount(filters: TherapistSearchFilters) {
  return [
    filters.availability,
    filters.price,
    filters.q,
    filters.rating,
    filters.theme,
    filters.therapy,
  ].filter(Boolean).length;
}

export function toSearchParams(
  filters: TherapistSearchFilters,
  overrides: Partial<TherapistSearchFilters> = {},
) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.therapy) params.set("therapy", next.therapy);
  if (next.theme) params.set("theme", next.theme);
  if (next.availability) params.set("availability", next.availability);
  if (next.price) params.set("price", next.price);
  if (next.rating) params.set("rating", next.rating);
  if (next.sort && next.sort !== "relevance") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));

  return params.toString();
}
