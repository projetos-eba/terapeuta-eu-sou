export type TherapySort = "relevance" | "most_searched" | "popular" | "newest" | "az";

export type TherapySearchParams = {
  category?: string;
  page: number;
  pageSize: number;
  q?: string;
  sort: TherapySort;
};

export type PublicTherapyListItem = {
  category: {
    name: string;
    slug: string;
  };
  id: string;
  imageUrl: string | null;
  isNew: boolean;
  isPopular: boolean;
  name: string;
  shortDescription: string;
  slug: string;
  therapistCount: number;
};

export type PublicTherapyCategory = {
  count: number;
  name: string;
  slug: string;
};

export type PublicTherapiesResult = {
  categories: PublicTherapyCategory[];
  errorMessage?: string;
  items: PublicTherapyListItem[];
  page: number;
  pageSize: number;
  source: "empty" | "error" | "supabase" | "unconfigured";
  totalCount: number;
  totalPages: number;
};

export type PublicTherapyRow = {
  category_name: string;
  category_slug: string;
  category_sort_order: number;
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
};
