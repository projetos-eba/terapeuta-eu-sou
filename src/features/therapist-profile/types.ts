export type PublicProfileThemeId =
  | "ancestral"
  | "aurora"
  | "botanico"
  | "celestial"
  | "cristalino"
  | "energia"
  | "essencial_editorial"
  | "essential"
  | "frequencia"
  | "geometria"
  | "lunar"
  | "natural"
  | "oraculo"
  | "profundo"
  | "sagrado"
  | "sereno_horizonte"
  | "serene"
  | "vinculos"
  | "warm";

export type BioIllustrationId =
  | "essential_lines"
  | "gentle_horizon"
  | "organic_flow"
  | "warm_layers";

export type PublicTherapistProfile = {
  acceptsOnlineSessions: boolean;
  badges: string[];
  bio: string;
  cityState: string;
  content: TherapistProfileContent;
  heroImage: string;
  headline: string;
  id: string;
  isAcceptingBookings: boolean;
  isVerified: boolean;
  name: string;
  plan: "free" | "premium" | "premium_plus";
  profileUrl: string;
  publicProfileTheme: PublicProfileThemeId;
  rating: {
    average: number | null;
    count: number;
    sessionsCompleted: number;
  };
  services: TherapistProfileService[];
  slug: string;
  tags: string[];
  video: {
    provider: "youtube" | "vimeo" | "upload" | "external";
    thumbnailUrl: string;
    title: string;
    url: string;
  } | null;
};

export type TherapistProfileContent = {
  bioIllustrationId: BioIllustrationId | null;
  essenceBody: string;
  experienceYears: number | null;
  guideItems: Array<{
    icon: string;
    label: string;
  }>;
  invitationBody: string;
  reflections: Array<{
    href: string;
    imageUrl: string;
    minutesToRead: number;
    title: string;
  }>;
  shortIntro: string;
  publicProfileTheme: PublicProfileThemeId;
};

export type TherapistProfileService = {
  availability: AvailabilityDay[];
  bookingUrl: string;
  currency: string;
  description: string;
  durationMinutes: number;
  id: string;
  imageUrl: string | null;
  priceCents: number;
  priceLabel: string;
  title: string;
  therapyId: string;
  therapyName: string;
  therapySlug: string;
};

export type TherapistProfileReview = {
  authorLabel: string;
  body: string;
  createdLabel: string;
  id: string;
  patientContext: string;
  rating: number;
  reply: {
    body: string;
    publishedAt: string | null;
  } | null;
};

export type AvailabilitySlot = DomainAvailableSlot & {
  dateLabel: string;
  dayLabel: string;
  timeLabel: string;
};

export type AvailabilityDay = {
  date: string;
  dateLabel: string;
  dayLabel: string;
  slots: AvailabilitySlot[];
};

export type TherapistProfileData = {
  availability: AvailabilityDay[];
  profile: PublicTherapistProfile;
  reviews: TherapistProfileReview[];
  source: "demo" | "live";
};

export type PublicTherapistProfileResult =
  | {
      data: TherapistProfileData;
      source: "live";
      status: "success";
    }
  | {
      correlationId: string;
      reason:
        | "configuration_missing"
        | "invalid_response"
        | "query_failed"
        | "timeout";
      source: "live";
      status: "degraded";
    }
  | {
      source: "live";
      status: "not_found";
    }
  | {
      data: TherapistProfileData;
      source: "demo";
      status: "demo";
    };
import type { AvailableSlot as DomainAvailableSlot } from "@/domain/tes";
