import { buildPublicReservationUrl } from "@/features/booking/services/public-booking";
import { getTherapistAvatarUrl } from "@/lib/therapist-avatars";

import type {
  AvailabilityDay,
  PublicTherapistProfile,
  TherapistProfileContent,
  TherapistProfileReview,
  TherapistProfileService,
} from "../types";

export type ProfileRow = {
  accepts_online_sessions: boolean;
  average_rating: number | null;
  badges: string[] | null;
  bio: string | null;
  city: string | null;
  id: string;
  is_accepting_bookings: boolean;
  is_verified: boolean | null;
  photo_url: string | null;
  plan: "free" | "premium" | "premium_plus";
  public_name: string;
  published_headline: string | null;
  review_count: number | null;
  sessions_completed: number | null;
  short_intro: string | null;
  slug: string;
  state: string | null;
  tags: string[] | null;
  video_provider: "youtube" | "vimeo" | "upload" | "external" | null;
  video_thumbnail_url: string | null;
  video_title: string | null;
  video_url: string | null;
};

const supportedVideoProviders = new Set([
  "external",
  "upload",
  "vimeo",
  "youtube",
]);

function isSafeVideoUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeVideo(input: {
  provider: ProfileRow["video_provider"];
  thumbnailUrl: string | null;
  title: string | null;
  url: string | null;
}): PublicTherapistProfile["video"] {
  if (!input.url || !isSafeVideoUrl(input.url)) return null;
  if (input.provider && !supportedVideoProviders.has(input.provider)) {
    return null;
  }

  return {
    provider: input.provider ?? "external",
    thumbnailUrl: input.thumbnailUrl ?? "/home/tablet-video-session.png",
    title: input.title ?? "Um convite para você",
    url: input.url,
  };
}

export type ContentRow = {
  essence_body: string | null;
  experience_years: number | null;
  guide_items: Array<{
    icon: string;
    label: string;
  }> | null;
  invitation_body: string | null;
  reflections: Array<{
    href: string;
    imageUrl: string;
    minutesToRead: number;
    title: string;
  }> | null;
  short_intro: string | null;
  therapist_profile_id: string;
};

export type ServiceRow = {
  availability_exceptions: Array<{
    endsAt: string;
    isAvailable: boolean;
    serviceId: string | null;
    startsAt: string;
  }> | null;
  availability_rules: Array<{
    dayOfWeek: number;
    endTime: string;
    isActive: boolean;
    serviceId: string | null;
    startTime: string;
    timezone: string;
  }> | null;
  booking_conflicts: Array<{
    endsAt: string;
    serviceId: string;
    startsAt: string;
    status: string;
  }> | null;
  buffer_after_minutes: number | null;
  buffer_before_minutes: number | null;
  currency: string;
  description: string | null;
  duration_minutes: number;
  interval_minutes: number | null;
  max_days_ahead: number | null;
  min_notice_minutes: number | null;
  price_cents: number;
  service_id: string;
  service_title: string;
  therapist_slug: string;
  therapy_id: string;
  therapy_name: string;
  therapy_slug: string;
};

export type ReviewRow = {
  author_label: string | null;
  body: string;
  created_label: string | null;
  id: string;
  patient_context: string | null;
  rating: number;
  reply_body?: string | null;
  reply_published_at?: string | null;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

export function mapContentRow(row: ContentRow | null): TherapistProfileContent {
  return {
    essenceBody:
      row?.essence_body ??
      "Acolhimento, escuta e presença para apoiar sua jornada com responsabilidade.",
    experienceYears: row?.experience_years ?? null,
    guideItems: row?.guide_items ?? [],
    invitationBody:
      row?.invitation_body ??
      "Assista ao vídeo para conhecer melhor a abordagem deste perfil.",
    reflections: row?.reflections ?? [],
    shortIntro: row?.short_intro ?? "",
  };
}

export function mapServiceRow(
  row: ServiceRow,
  availability: AvailabilityDay[] = [],
): TherapistProfileService {
  return {
    availability,
    bookingUrl: buildPublicReservationUrl({
      durationMinutes: row.duration_minutes,
      priceCents: row.price_cents,
      serviceId: row.service_id,
      therapistSlug: row.therapist_slug,
    }),
    currency: row.currency,
    description:
      row.description ?? "Sessão online com cuidado e escuta responsável.",
    durationMinutes: row.duration_minutes,
    id: row.service_id,
    priceCents: row.price_cents,
    priceLabel: formatCurrency(row.price_cents),
    title: row.service_title,
    therapyId: row.therapy_id,
    therapyName: row.therapy_name,
    therapySlug: row.therapy_slug,
  };
}

export function mapReviewRow(row: ReviewRow): TherapistProfileReview {
  return {
    authorLabel: row.author_label ?? "Paciente TES",
    body: row.body,
    createdLabel: row.created_label ?? "Sessão concluída",
    id: row.id,
    patientContext: row.patient_context ?? "Sessão concluída pela plataforma",
    rating: row.rating,
    reply: row.reply_body
      ? {
          body: row.reply_body,
          publishedAt: row.reply_published_at ?? null,
        }
      : null,
  };
}

export function mapProfileRow(
  row: ProfileRow,
  content: TherapistProfileContent,
  services: TherapistProfileService[],
): PublicTherapistProfile {
  return {
    acceptsOnlineSessions: row.accepts_online_sessions,
    badges: row.badges ?? [],
    bio: row.bio ?? content.essenceBody,
    cityState: [row.city, row.state].filter(Boolean).join(", "),
    content,
    headline: row.published_headline ?? row.short_intro ?? content.shortIntro,
    heroImage:
      getTherapistAvatarUrl(row.photo_url, {
        name: row.public_name,
        slug: row.slug,
      }) ?? "/therapists/ana-oliveira.png",
    id: row.id,
    isAcceptingBookings: row.is_accepting_bookings,
    isVerified: Boolean(row.is_verified),
    name: row.public_name,
    plan: row.plan,
    profileUrl: `/terapeutas/${row.slug}`,
    rating: {
      average: row.average_rating,
      count: row.review_count ?? 0,
      sessionsCompleted: row.sessions_completed ?? 0,
    },
    services,
    slug: row.slug,
    tags: row.tags ?? [],
    video: normalizeVideo({
      provider: row.video_provider,
      thumbnailUrl: row.video_thumbnail_url,
      title: row.video_title,
      url: row.video_url,
    }),
  };
}
