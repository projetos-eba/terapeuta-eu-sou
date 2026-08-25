export type TherapistSearchSort =
  | "relevance"
  | "rating"
  | "price_asc"
  | "next_slot";

export type TherapistSearchAvailability = "today" | "tomorrow" | "week";

export type TherapistSearchPrice = "up-to-100" | "100-150" | "150-plus";

export type TherapistSearchRating = "4-plus" | "4-5-plus";

export type TherapistSearchFilters = {
  availability?: TherapistSearchAvailability;
  page: number;
  price?: TherapistSearchPrice;
  q?: string;
  rating?: TherapistSearchRating;
  sort: TherapistSearchSort;
  theme?: string;
  therapy?: string;
};

export type TherapistSearchOption = {
  label: string;
  value: string;
};

export type TherapistSearchTherapy = {
  id: string;
  label: string;
  slug: string;
};

export type TherapistSearchCard = {
  availabilityBucket: TherapistSearchAvailability | "later";
  cityState: string;
  description: string;
  durationLabel: string;
  hasVideo: boolean;
  highlight: string;
  highlightTone: "featured" | "verified";
  href: string;
  image: string;
  name: string;
  nextSlotAt: string | null;
  nextSlotLabel: string;
  priceCents: number;
  priceLabel: string;
  quote: string;
  rating: number;
  ratingLabel: string;
  reviewsLabel: string;
  reviewCount: number;
  serviceId: string;
  serviceTitle: string;
  slug: string;
  tags: string[];
  therapies: TherapistSearchTherapy[];
  themeSlugs: string[];
  therapyId: string;
  therapyName: string;
  therapySlug: string;
};

export type TherapistSearchResult = {
  activeFilterCount: number;
  correlationId?: string;
  degradedReason?:
    | "configuration_missing"
    | "invalid_response"
    | "query_failed"
    | "timeout";
  currentPage: number;
  filters: TherapistSearchFilters;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  options: {
    themes: TherapistSearchOption[];
    therapies: TherapistSearchOption[];
  };
  pageSize: number;
  source: "demo" | "live";
  status: "degraded" | "demo" | "empty" | "success";
  therapists: TherapistSearchCard[];
  totalCount: number;
  totalPages: number;
};
