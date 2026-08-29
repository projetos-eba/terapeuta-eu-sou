export type TherapySort = "relevance" | "most_searched" | "popular" | "newest" | "az";

export type TherapySearchParams = {
  theme?: string;
  page: number;
  pageSize: number;
  q?: string;
  sort: TherapySort;
};

export type PublicTherapyListItem = {
  id: string;
  imageUrl: string | null;
  isNew: boolean;
  isPopular: boolean;
  name: string;
  shortDescription: string;
  slug: string;
  therapistCount: number;
  themes: Array<{ name: string; slug: string }>;
};

export type PublicTherapyTheme = {
  count: number;
  name: string;
  slug: string;
};

export type PublicTherapiesResult = {
  themes: PublicTherapyTheme[];
  errorMessage?: string;
  items: PublicTherapyListItem[];
  page: number;
  pageSize: number;
  source: "empty" | "error" | "supabase" | "unconfigured";
  totalCount: number;
  totalPages: number;
};

export type PublicTherapyRow = {
  id: string;
  image_url: string | null;
  is_new: boolean;
  is_popular: boolean;
  name: string;
  published_at: string | null;
  search_text: string | null;
  short_description: string;
  slug: string;
  therapist_count: number | null;
  theme_names: string[] | null;
  theme_slugs: string[] | null;
};
