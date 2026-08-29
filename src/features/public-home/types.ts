export type PublicHomeTherapy = {
  themeName: string;
  href: string;
  imageUrl?: string | null;
  isFeatured: boolean;
  name: string;
  shortDescription: string;
  slug: string;
};

export type PublicHomeTherapist = {
  guideItems?: string[];
  headline: string;
  href: string;
  isPremium: boolean;
  name: string;
  photoUrl: string;
  priceLabel: string;
  ratingLabel: string;
  reviewCountLabel: string;
  serviceTitle: string;
  slug: string;
  therapies?: Array<{
    id: string;
    label: string;
    slug: string;
  }>;
  therapyNames?: string[];
};

export type PublicHomeFeaturedTherapistsPage = {
  hasMore: boolean;
  nextCursor: {
    freeOffset: number;
    paidOffset: number;
  } | null;
  therapists: PublicHomeTherapist[];
};

export type PublicHomeTestimonial = {
  author: string;
  body: string;
  context: string;
  ratingLabel: string;
};

export type PublicHomeStep = {
  body: string;
  image: string;
  title: string;
};

export type PublicHomeReason = {
  body: string;
  tone: "green" | "purple" | "blue" | "pink" | "orange";
  title: string;
};

export type PublicHomeFaq = {
  answer: string;
  question: string;
};

export type PublicHomeData = {
  correlationId?: string;
  reason?: "configuration_missing" | "query_failed";
  source: "demo" | "supabase";
  status: "degraded" | "demo" | "empty" | "success";
  featuredTherapistsPage?: PublicHomeFeaturedTherapistsPage;
  testimonials: PublicHomeTestimonial[];
  therapies: PublicHomeTherapy[];
  therapists: PublicHomeTherapist[];
};
