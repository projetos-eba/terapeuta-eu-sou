import "server-only";

import { cache } from "react";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { getTherapistAvatarUrl } from "@/lib/therapist-avatars";

import {
  moodKeys,
  type MoodKey,
  type MoodOption,
  type PatientAppointment,
  type PatientFavoriteProfessional,
  type PatientMoodCheckin,
  type PatientOverview,
  type PatientSupportTicket,
  type PendingPatientReview,
} from "./patient-overview.types";

const DEMO_PATIENT_PROFILE_ID = "91000000-0000-4000-8000-000000000001";

const moodOptions: MoodOption[] = [
  { key: "calm", label: "Calmo" },
  { key: "anxious", label: "Ansioso" },
  { key: "sad", label: "Triste" },
  { key: "confused", label: "Confuso" },
  { key: "inspired", label: "Inspirado" },
  { key: "hopeful", label: "Esperançoso" },
];

type SupabaseServerConfig = {
  accessToken: string;
  apiKey: string;
  url: string;
};

type ProfileRow = {
  avatar_url: string | null;
  display_name: string | null;
  id: string;
};

type PatientProfileRow = {
  id: string;
};

type BookingRow = {
  completed_at: string | null;
  ends_at: string;
  id: string;
  meeting_url: string | null;
  service_id: string;
  starts_at: string;
  status: "completed" | "confirmed" | string;
  therapist_profile_id: string;
};

type ProfessionalRow = {
  headline: string | null;
  id: string;
  photo_url: string | null;
  public_name: string;
};

type ServiceRow = {
  id: string;
  therapy_id: string;
  title: string;
};

type TherapyRow = {
  id: string;
  name: string;
};

type FavoriteRow = {
  therapist_profile_id: string;
};

type ConversationRow = {
  id: string;
};

type NotificationRow = {
  id: string;
};

type MoodCheckinRow = {
  checked_on: string;
  mood: string;
};

type SupportTicketRow = {
  created_at: string;
  description: string | null;
  id: string;
  resolution_summary: string | null;
  status: string;
  subject: string;
};

type ReviewRow = {
  booking_id: string;
};

export class PatientOverviewDataError extends Error {
  constructor() {
    super("Não foi possível carregar a visão geral do paciente.");
  }
}

export const getPatientOverview = cache(async function getPatientOverview(
  profileId: string,
  accessToken: string | null = null,
): Promise<PatientOverview> {
  const config = getSupabaseServerConfig(accessToken);

  if (!config) {
    if (process.env.NODE_ENV === "development") {
      return createDemoPatientOverview(profileId);
    }

    throw new PatientOverviewDataError();
  }

  try {
    return await getSupabasePatientOverview(config, profileId);
  } catch {
    throw new PatientOverviewDataError();
  }
});

export async function savePatientMoodCheckin(input: {
  accessToken: string | null;
  mood: MoodKey;
  patientProfileId: string;
}): Promise<PatientMoodCheckin> {
  const config = getSupabaseServerConfig(input.accessToken);
  const checkedOn = new Date().toISOString().slice(0, 10);

  if (!config) {
    if (process.env.NODE_ENV === "development") {
      return { checkedOn, mood: input.mood };
    }

    throw new PatientOverviewDataError();
  }

  const rows = await supabaseRequest<MoodCheckinRow[]>(
    config,
    "/rest/v1/mood_checkins?on_conflict=patient_profile_id,checked_on",
    {
      body: {
        checked_on: checkedOn,
        mood: input.mood,
        patient_profile_id: input.patientProfileId,
      },
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
    },
  );
  const moodCheckin = rows[0];

  if (!moodCheckin || !isMoodKey(moodCheckin.mood)) {
    throw new PatientOverviewDataError();
  }

  return { checkedOn: moodCheckin.checked_on, mood: moodCheckin.mood };
}

async function getSupabasePatientOverview(
  config: SupabaseServerConfig,
  profileId: string,
): Promise<PatientOverview> {
  const [profiles, patientProfiles] = await Promise.all([
    supabaseRequest<ProfileRow[]>(
      config,
      `/rest/v1/profiles?select=id,display_name,avatar_url&id=eq.${encodeURIComponent(profileId)}&limit=1`,
    ),
    supabaseRequest<PatientProfileRow[]>(
      config,
      `/rest/v1/patient_profiles?select=id&user_id=eq.${encodeURIComponent(profileId)}&limit=1`,
    ),
  ]);
  const patient = patientProfiles[0];
  const profile = profiles[0];

  if (!patient || !profile) {
    throw new PatientOverviewDataError();
  }

  const [
    bookings,
    favorites,
    conversations,
    notifications,
    moods,
    supportTickets,
  ] = await Promise.all([
    supabaseRequest<BookingRow[]>(
      config,
      `/rest/v1/bookings?select=id,therapist_profile_id,service_id,starts_at,ends_at,status,meeting_url,completed_at&patient_profile_id=eq.${patient.id}&order=starts_at.asc`,
    ),
    supabaseRequest<FavoriteRow[]>(
      config,
      `/rest/v1/favorite_therapists?select=therapist_profile_id&patient_profile_id=eq.${patient.id}`,
    ),
    supabaseRequest<ConversationRow[]>(
      config,
      `/rest/v1/conversations?select=id&patient_profile_id=eq.${patient.id}`,
    ),
    supabaseRequest<NotificationRow[]>(
      config,
      `/rest/v1/notifications?select=id&profile_id=eq.${encodeURIComponent(profileId)}&read_at=is.null`,
    ),
    supabaseRequest<MoodCheckinRow[]>(
      config,
      `/rest/v1/mood_checkins?select=mood,checked_on&patient_profile_id=eq.${patient.id}&order=checked_on.desc&limit=1`,
    ),
    supabaseRequest<SupportTicketRow[]>(
      config,
      `/rest/v1/support_tickets?select=id,subject,description,status,resolution_summary,created_at&requester_profile_id=eq.${encodeURIComponent(profileId)}&order=created_at.desc&limit=3`,
    ),
  ]);

  const professionalIds = unique([
    ...bookings.map((booking) => booking.therapist_profile_id),
    ...favorites.map((favorite) => favorite.therapist_profile_id),
  ]);
  const serviceIds = unique(bookings.map((booking) => booking.service_id));
  const conversationIds = conversations.map((conversation) => conversation.id);
  const [professionals, services, unreadMessages, reviews] = await Promise.all([
    getRowsByIds<ProfessionalRow>(
      config,
      "therapist_profiles",
      "id,public_name,headline,photo_url",
      professionalIds,
    ),
    getRowsByIds<ServiceRow>(
      config,
      "therapist_services",
      "id,title,therapy_id",
      serviceIds,
    ),
    conversationIds.length > 0
      ? supabaseRequest<{ id: string }[]>(
          config,
          `/rest/v1/messages?select=id&conversation_id=in.(${conversationIds.join(",")})&sender_profile_id=neq.${encodeURIComponent(profileId)}&read_at=is.null`,
        )
      : Promise.resolve([]),
    supabaseRequest<ReviewRow[]>(
      config,
      `/rest/v1/reviews?select=booking_id&patient_profile_id=eq.${patient.id}`,
    ),
  ]);
  const therapyIds = unique(services.map((service) => service.therapy_id));
  const therapies = await getRowsByIds<TherapyRow>(
    config,
    "therapies",
    "id,name",
    therapyIds,
  );
  const professionalById = new Map(
    professionals.map((item) => [item.id, item]),
  );
  const serviceById = new Map(services.map((item) => [item.id, item]));
  const therapyById = new Map(therapies.map((item) => [item.id, item]));
  const reviewedBookingIds = new Set(
    reviews.map((review) => review.booking_id),
  );
  const upcomingAppointments = bookings
    .filter(
      (booking) =>
        booking.status === "confirmed" &&
        new Date(booking.ends_at) >= new Date(),
    )
    .slice(0, 3)
    .flatMap((booking) => {
      const professional = professionalById.get(booking.therapist_profile_id);
      const service = serviceById.get(booking.service_id);
      const therapy = service ? therapyById.get(service.therapy_id) : undefined;

      if (!professional || !service || !therapy) return [];

      return [toAppointment(booking, professional, service, therapy)];
    });
  const latestCompleted = bookings
    .filter((booking) => booking.status === "completed" && booking.completed_at)
    .sort(
      (left, right) =>
        new Date(right.completed_at ?? 0).getTime() -
        new Date(left.completed_at ?? 0).getTime(),
    )[0];

  return {
    activitySummary: {
      favoritesCount: favorites.length,
      lastActivityLabel: latestCompleted
        ? (therapyById.get(
            serviceById.get(latestCompleted.service_id)?.therapy_id ?? "",
          )?.name ?? null)
        : null,
      unreadMessagesCount: unreadMessages.length,
      unreadNotificationsCount: notifications.length,
    },
    favoriteProfessionals: favorites.flatMap((favorite) => {
      const professional = professionalById.get(favorite.therapist_profile_id);
      return professional ? [toFavoriteProfessional(professional)] : [];
    }),
    latestMoodCheckin: toMoodCheckin(moods[0]),
    moodOptions,
    patient: {
      avatarUrl: profile.avatar_url,
      id: profile.id,
      name: profile.display_name ?? "Paciente",
      patientProfileId: patient.id,
    },
    pendingReview: toPendingReview(
      bookings,
      reviewedBookingIds,
      professionalById,
      serviceById,
      therapyById,
    ),
    source: "supabase",
    supportTickets: supportTickets.map(toSupportTicket),
    unreadMessagesCount: unreadMessages.length,
    unreadNotificationsCount: notifications.length,
    upcomingAppointments,
  };
}

function getSupabaseServerConfig(
  accessToken: string | null,
): SupabaseServerConfig | null {
  const config = getSupabasePublicConfig();

  if (!config || !accessToken) return null;

  return { accessToken, apiKey: config.apiKey, url: config.url };
}

async function getRowsByIds<T>(
  config: SupabaseServerConfig,
  table: string,
  select: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];

  return supabaseRequest<T[]>(
    config,
    `/rest/v1/${table}?select=${select}&id=in.(${ids.join(",")})`,
  );
}

async function supabaseRequest<T>(
  config: SupabaseServerConfig,
  path: string,
  options: {
    body?: unknown;
    method?: "GET" | "POST";
    prefer?: string;
  } = {},
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    method: options.method ?? "GET",
  });

  if (!response.ok) throw new PatientOverviewDataError();

  return (await response.json()) as T;
}

function toAppointment(
  booking: BookingRow,
  professional: ProfessionalRow,
  service: ServiceRow,
  therapy: TherapyRow,
): PatientAppointment {
  const now = Date.now();
  const isLive =
    new Date(booking.starts_at).getTime() <= now &&
    new Date(booking.ends_at).getTime() >= now;

  return {
    endsAt: booking.ends_at,
    id: booking.id,
    meetingUrl: booking.meeting_url,
    professional: {
      avatarUrl: getTherapistAvatarUrl(professional.photo_url, {
        name: professional.public_name,
      }),
      id: professional.id,
      name: professional.public_name,
    },
    serviceLabel: service.title,
    startsAt: booking.starts_at,
    status: isLive ? "live" : "confirmed",
    therapyLabel: therapy.name,
  };
}

function toFavoriteProfessional(
  professional: ProfessionalRow,
): PatientFavoriteProfessional {
  return {
    avatarUrl: getTherapistAvatarUrl(professional.photo_url, {
      name: professional.public_name,
    }),
    id: professional.id,
    name: professional.public_name,
    specialty: professional.headline,
  };
}

function toPendingReview(
  bookings: BookingRow[],
  reviewedBookingIds: Set<string>,
  professionalById: Map<string, ProfessionalRow>,
  serviceById: Map<string, ServiceRow>,
  therapyById: Map<string, TherapyRow>,
): PendingPatientReview | null {
  const booking = bookings
    .filter(
      (item) =>
        item.status === "completed" &&
        !reviewedBookingIds.has(item.id) &&
        item.completed_at,
    )
    .sort(
      (left, right) =>
        new Date(right.completed_at ?? 0).getTime() -
        new Date(left.completed_at ?? 0).getTime(),
    )[0];
  if (!booking) return null;

  const professional = professionalById.get(booking.therapist_profile_id);
  const service = serviceById.get(booking.service_id);
  const therapy = service ? therapyById.get(service.therapy_id) : undefined;
  if (!professional || !therapy) return null;

  return {
    appointmentId: booking.id,
    professional: {
      avatarUrl: getTherapistAvatarUrl(professional.photo_url, {
        name: professional.public_name,
      }),
      name: professional.public_name,
    },
    therapyLabel: therapy.name,
  };
}

function toMoodCheckin(
  row: MoodCheckinRow | undefined,
): PatientMoodCheckin | null {
  if (!row || !isMoodKey(row.mood)) return null;
  return { checkedOn: row.checked_on, mood: row.mood };
}

function toSupportTicket(row: SupportTicketRow): PatientSupportTicket {
  const status =
    row.status === "resolved" || row.status === "in_review"
      ? row.status
      : "open";

  return {
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    resolutionSummary: row.resolution_summary,
    status,
    subject: row.subject,
  };
}

function isMoodKey(value: string): value is MoodKey {
  return moodKeys.some((mood) => mood === value);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function createDemoPatientOverview(profileId: string): PatientOverview {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setMinutes(now.getMinutes() - 30, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setMinutes(now.getMinutes() + 30, 0, 0);
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(now.getDate() + 1);
  tomorrowStart.setHours(10, 30, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(11, 30, 0, 0);
  const nextTuesday = new Date(now);
  nextTuesday.setDate(now.getDate() + ((9 - now.getDay()) % 7));
  nextTuesday.setHours(16, 0, 0, 0);
  const nextTuesdayEnd = new Date(nextTuesday);
  nextTuesdayEnd.setHours(17, 0, 0, 0);

  return {
    activitySummary: {
      favoritesCount: 3,
      lastActivityLabel: "Reiki",
      unreadMessagesCount: 2,
      unreadNotificationsCount: 1,
    },
    favoriteProfessionals: [
      {
        avatarUrl: "/therapists/andre-lima.png",
        id: "92000000-0000-4000-8000-000000000014",
        name: "André Lima",
        specialty: "Terapeuta Holístico",
      },
      {
        avatarUrl: "/therapists/ana-oliveira.png",
        id: "92000000-0000-4000-8000-000000000015",
        name: "Sofia Mendes",
        specialty: "Terapeuta Holística",
      },
      {
        avatarUrl: "/therapists/marcio-andrade.png",
        id: "92000000-0000-4000-8000-000000000016",
        name: "Roberto Vaz",
        specialty: "Terapeuta Holístico",
      },
    ],
    latestMoodCheckin: {
      checkedOn: now.toISOString().slice(0, 10),
      mood: "calm",
    },
    moodOptions,
    patient: {
      avatarUrl: null,
      id: profileId,
      name: "Carlos",
      patientProfileId: DEMO_PATIENT_PROFILE_ID,
    },
    pendingReview: {
      appointmentId: "94000000-0000-4000-8000-000000000014",
      professional: {
        avatarUrl: "/therapists/juliana-costa.png",
        name: "Juliane Moore",
      },
      therapyLabel: "Reiki",
    },
    source: "demo",
    supportTickets: [
      {
        createdAt: new Date(now.getTime() - 86400000).toISOString(),
        description: "O valor foi estornado para o seu cartão Visa.",
        id: "a0000000-0000-4000-8000-000000000011",
        resolutionSummary: "O reembolso foi concluído.",
        status: "resolved",
        subject: "Reembolso de sessão",
      },
      {
        createdAt: new Date(now.getTime() - 172800000).toISOString(),
        description: "Nossa equipe técnica está verificando o log...",
        id: "a0000000-0000-4000-8000-000000000012",
        resolutionSummary: null,
        status: "in_review",
        subject: "Problema com áudio",
      },
    ],
    unreadMessagesCount: 2,
    unreadNotificationsCount: 1,
    upcomingAppointments: [
      {
        endsAt: todayEnd.toISOString(),
        id: "94000000-0000-4000-8000-000000000011",
        meetingUrl: "https://example.test/meeting/juliane-live",
        professional: {
          avatarUrl: "/therapists/juliana-costa.png",
          id: "92000000-0000-4000-8000-000000000011",
          name: "Juliane Moore",
        },
        serviceLabel: "Terapia Holística",
        startsAt: todayStart.toISOString(),
        status: "live",
        therapyLabel: "Reiki",
      },
      {
        endsAt: tomorrowEnd.toISOString(),
        id: "94000000-0000-4000-8000-000000000012",
        meetingUrl: null,
        professional: {
          avatarUrl: "/therapists/rafael-santos-avatar.png",
          id: "92000000-0000-4000-8000-000000000012",
          name: "Marcus Silva",
        },
        serviceLabel: "Leitura simbólica de Tarô",
        startsAt: tomorrowStart.toISOString(),
        status: "confirmed",
        therapyLabel: "Tarô",
      },
      {
        endsAt: nextTuesdayEnd.toISOString(),
        id: "94000000-0000-4000-8000-000000000013",
        meetingUrl: null,
        professional: {
          avatarUrl: "/therapists/celia-martins.png",
          id: "92000000-0000-4000-8000-000000000013",
          name: "Beatriz Lima",
        },
        serviceLabel: "Reiki",
        startsAt: nextTuesday.toISOString(),
        status: "confirmed",
        therapyLabel: "Reiki",
      },
    ],
  };
}
