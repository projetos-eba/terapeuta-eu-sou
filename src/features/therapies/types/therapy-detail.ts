export type PublicTherapyDetail = {
  approachIconKey: string;
  approachLabel: string;
  benefits: Array<{
    description?: string;
    iconKey: string;
    title: string;
  }>;
  category: {
    name: string;
    slug: string;
  };
  complementaryDescription: string | null;
  description: string;
  heroImageUrl: string | null;
  heroFocalPoint: "left" | "center" | "right";
  highlights: Array<{
    iconKey: string;
    title: string;
  }>;
  id: string;
  introduction: string;
  name: string;
  faqs: Array<{
    answer: string;
    question: string;
  }>;
  safetyNote: string | null;
  seoDescription: string | null;
  seoTitle: string | null;
  shortDescription: string;
  slug: string;
  subtitle: string;
  therapistCount: number;
  visualThemeKey: "energy" | "oracle" | "systemic";
};

export type RelatedTherapist = {
  averageRating: number | null;
  completedSessionCount: number;
  headline: string;
  isAcceptingBookings: boolean;
  isPremium: boolean;
  matchingInterestCount: number;
  matchingServiceThemeCount: number;
  name: string;
  nextSlotAt: string | null;
  photoUrl: string | null;
  reviewCount: number;
  serviceDescription: string;
  slug: string;
  tags: string[];
};

export type RelatedTherapistSort = "relevance" | "rating" | "next_slot";

export type PublicTherapyDetailRow = {
  approach_icon_key: string | null;
  approach_label: string | null;
  benefits: unknown;
  category_name: string;
  category_slug: string;
  complementary_description: string | null;
  description: string | null;
  faqs: unknown;
  hero_focal_point: string | null;
  hero_image_url: string | null;
  highlights: unknown;
  id: string;
  introduction: string | null;
  name: string;
  safety_note: string | null;
  seo_description: string | null;
  seo_title: string | null;
  short_description: string | null;
  slug: string;
  subtitle: string | null;
  therapist_count: number | null;
  visual_theme_key: string | null;
};

export type RelatedTherapistRow = {
  average_rating: number | null;
  completed_session_count: number | null;
  matching_interest_count: number | null;
  matching_service_theme_count: number | null;
  next_slot_at: string | null;
  photo_url: string | null;
  public_name: string;
  review_count: number | null;
  service_description: string | null;
  slug: string;
  tags: string[] | null;
  therapist_headline: string | null;
};
