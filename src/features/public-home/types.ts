export type PublicHomeTherapy = {
  categoryName: string;
  href: string;
  isFeatured: boolean;
  name: string;
  shortDescription: string;
  slug: string;
};

export type PublicHomeTherapist = {
  headline: string;
  href: string;
  name: string;
  photoUrl: string;
  priceLabel: string;
  ratingLabel: string;
  reviewCountLabel: string;
  serviceTitle: string;
  slug: string;
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
  source: "supabase" | "fallback";
  testimonials: PublicHomeTestimonial[];
  therapies: PublicHomeTherapy[];
  therapists: PublicHomeTherapist[];
};
