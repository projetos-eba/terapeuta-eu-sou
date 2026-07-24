import "server-only";

import { cache } from "react";

import {
  mapPatientEncountersPage,
  type BookingRecord,
  type ReviewRecord,
  type ServiceRecord,
  type SessionSummaryRecord,
  type TherapistRecord,
  type TherapyRecord,
} from "./patient-encounters.mappers";
import type {
  PatientEncountersPageData,
  PatientEncountersPatient,
} from "./patient-encounters.types";

const DEMO_PATIENT_PROFILE_ID = "91000000-0000-4000-8000-000000000001";

type SupabaseServerConfig = {
  anonKey: string;
  serviceRoleKey: string;
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

type FavoriteRow = {
  therapist_profile_id: string;
};

type ConversationRow = {
  id: string;
};

type NotificationRow = {
  id: string;
};

export class PatientEncountersDataError extends Error {
  constructor() {
    super("Não foi possível carregar seus encontros.");
  }
}

export const getPatientEncountersPage = cache(
  async function getPatientEncountersPage(
    profileId: string,
  ): Promise<PatientEncountersPageData> {
    const config = getSupabaseServerConfig();

    if (!config) {
      if (process.env.NODE_ENV === "development") {
        return createDemoPatientEncountersPage(profileId);
      }

      throw new PatientEncountersDataError();
    }

    try {
      return await getSupabasePatientEncountersPage(config, profileId);
    } catch {
      throw new PatientEncountersDataError();
    }
  },
);

async function getSupabasePatientEncountersPage(
  config: SupabaseServerConfig,
  profileId: string,
): Promise<PatientEncountersPageData> {
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
  const profile = profiles[0];
  const patientProfile = patientProfiles[0];

  if (!profile || !patientProfile) {
    throw new PatientEncountersDataError();
  }

  const patient: PatientEncountersPatient = {
    avatarUrl: profile.avatar_url,
    id: profile.id,
    name: profile.display_name ?? "Paciente",
    patientProfileId: patientProfile.id,
  };

  const [bookings, favorites, conversations, notifications] =
    await Promise.all([
      supabaseRequest<BookingRecord[]>(
        config,
        `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,service_id,starts_at,ends_at,status,payment_status,meeting_url,cancellation_reason,cancelled_at,completed_at&patient_profile_id=eq.${patientProfile.id}&order=starts_at.asc`,
      ),
      supabaseRequest<FavoriteRow[]>(
        config,
        `/rest/v1/favorite_therapists?select=therapist_profile_id&patient_profile_id=eq.${patientProfile.id}`,
      ),
      supabaseRequest<ConversationRow[]>(
        config,
        `/rest/v1/conversations?select=id&patient_profile_id=eq.${patientProfile.id}`,
      ),
      supabaseRequest<NotificationRow[]>(
        config,
        `/rest/v1/notifications?select=id&profile_id=eq.${encodeURIComponent(profileId)}&read_at=is.null`,
      ),
    ]);
  const conversationIds = conversations.map((conversation) => conversation.id);
  const therapistIds = unique(bookings.map((booking) => booking.therapist_profile_id));
  const serviceIds = unique(bookings.map((booking) => booking.service_id));
  const [therapists, services, reviews, summaries, unreadMessages] =
    await Promise.all([
      getRowsByIds<TherapistRecord>(
        config,
        "therapist_profiles",
        "id,public_name,headline,photo_url",
        therapistIds,
      ),
      getRowsByIds<ServiceRecord>(
        config,
        "therapist_services",
        "id,title,therapy_id",
        serviceIds,
      ),
      supabaseRequest<ReviewRecord[]>(
        config,
        `/rest/v1/reviews?select=booking_id&patient_profile_id=eq.${patientProfile.id}`,
      ),
      supabaseRequest<SessionSummaryRecord[]>(
        config,
        `/rest/v1/booking_session_summaries?select=id,booking_id&patient_profile_id=eq.${patientProfile.id}`,
      ),
      conversationIds.length > 0
        ? supabaseRequest<{ id: string }[]>(
            config,
            `/rest/v1/messages?select=id&conversation_id=in.(${conversationIds.join(",")})&sender_profile_id=neq.${encodeURIComponent(profileId)}&read_at=is.null`,
          )
        : Promise.resolve([]),
    ]);
  const therapyIds = unique(services.map((service) => service.therapy_id));
  const therapies = await getRowsByIds<TherapyRecord>(
    config,
    "therapies",
    "id,name,slug",
    therapyIds,
  );

  const page = mapPatientEncountersPage({
    bookings,
    favoriteTherapistsCount: favorites.length,
    patient,
    reviews,
    serviceById: new Map(services.map((service) => [service.id, service])),
    summaries,
    therapistById: new Map(therapists.map((therapist) => [therapist.id, therapist])),
    therapyById: new Map(therapies.map((therapy) => [therapy.id, therapy])),
    unreadMessagesCount: unreadMessages.length,
    unreadNotificationsCount: notifications.length,
  });

  return { ...page, source: "supabase" };
}

function getSupabaseServerConfig(): SupabaseServerConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) return null;

  return { anonKey, serviceRoleKey, url: url.replace(/\/$/, "") };
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
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) throw new PatientEncountersDataError();

  return (await response.json()) as T;
}

function createDemoPatientEncountersPage(
  profileId: string,
): PatientEncountersPageData {
  const now = new Date();
  const liveStart = new Date(now.getTime() - 15 * 60 * 1000);
  const liveEnd = new Date(now.getTime() + 45 * 60 * 1000);
  const laterToday = new Date(now);
  laterToday.setHours(Math.min(now.getHours() + 2, 23), 0, 0, 0);
  const laterTodayEnd = new Date(laterToday.getTime() + 60 * 60 * 1000);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow.getTime() + 60 * 60 * 1000);
  const completedBase = new Date(now);
  completedBase.setDate(now.getDate() - 3);

  const patient: PatientEncountersPatient = {
    avatarUrl: null,
    id: profileId,
    name: "Carlos",
    patientProfileId: DEMO_PATIENT_PROFILE_ID,
  };
  const therapists = new Map<string, TherapistRecord>([
    [
      "92000000-0000-4000-8000-000000000014",
      {
        headline: "Terapeuta Holístico",
        id: "92000000-0000-4000-8000-000000000014",
        photo_url: "/therapists/andre-lima.png",
        public_name: "André Lima",
      },
    ],
    [
      "92000000-0000-4000-8000-000000000015",
      {
        headline: "Terapeuta Holística",
        id: "92000000-0000-4000-8000-000000000015",
        photo_url: "/therapists/ana-oliveira.png",
        public_name: "Sofia Mendes",
      },
    ],
    [
      "92000000-0000-4000-8000-000000000016",
      {
        headline: "Terapeuta Holístico",
        id: "92000000-0000-4000-8000-000000000016",
        photo_url: "/therapists/marcio-andrade.png",
        public_name: "Roberto Vaz",
      },
    ],
    [
      "c1000000-0000-4000-8000-000000000004",
      {
        headline: "Terapeuta Holística",
        id: "c1000000-0000-4000-8000-000000000004",
        photo_url: "/therapists/juliana-costa.png",
        public_name: "Juliana Costa",
      },
    ],
  ]);
  const services = new Map<string, ServiceRecord>([
    [
      "93000000-0000-4000-8000-000000000014",
      {
        id: "93000000-0000-4000-8000-000000000014",
        therapy_id: "22222222-2222-4222-8222-222222222225",
        title: "Reiki",
      },
    ],
    [
      "93000000-0000-4000-8000-000000000015",
      {
        id: "93000000-0000-4000-8000-000000000015",
        therapy_id: "22222222-2222-4222-8222-222222222228",
        title: "Tarô",
      },
    ],
    [
      "93000000-0000-4000-8000-000000000016",
      {
        id: "93000000-0000-4000-8000-000000000016",
        therapy_id: "22222222-2222-4222-8222-222222222228",
        title: "Tarô",
      },
    ],
    [
      "93000000-0000-4000-8000-000000000017",
      {
        id: "93000000-0000-4000-8000-000000000017",
        therapy_id: "22222222-2222-4222-8222-222222222230",
        title: "Constelação Familiar",
      },
    ],
  ]);
  const therapies = new Map<string, TherapyRecord>([
    [
      "22222222-2222-4222-8222-222222222225",
      { id: "22222222-2222-4222-8222-222222222225", name: "Reiki", slug: "reiki" },
    ],
    [
      "22222222-2222-4222-8222-222222222228",
      {
        id: "22222222-2222-4222-8222-222222222228",
        name: "Tarô",
        slug: "taro",
      },
    ],
    [
      "22222222-2222-4222-8222-222222222230",
      {
        id: "22222222-2222-4222-8222-222222222230",
        name: "Constelação Familiar",
        slug: "constelacao-familiar",
      },
    ],
  ]);
  const bookings: BookingRecord[] = [
    createBooking("94000000-0000-4000-8000-000000000021", "92000000-0000-4000-8000-000000000014", "93000000-0000-4000-8000-000000000014", liveStart, liveEnd, "confirmed", "https://example.test/meeting/andre-live"),
    createBooking("94000000-0000-4000-8000-000000000022", "92000000-0000-4000-8000-000000000015", "93000000-0000-4000-8000-000000000015", laterToday, laterTodayEnd, "confirmed", "https://example.test/meeting/sofia"),
    createBooking("94000000-0000-4000-8000-000000000023", "92000000-0000-4000-8000-000000000016", "93000000-0000-4000-8000-000000000016", tomorrow, tomorrowEnd, "confirmed", "https://example.test/meeting/roberto"),
    ...Array.from({ length: 12 }, (_, index) => {
      const startsAt = new Date(completedBase);
      startsAt.setDate(completedBase.getDate() - index);
      startsAt.setHours(15 + (index % 3), 0, 0, 0);
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

      return createBooking(
        `94000000-0000-4000-8000-0000000000${31 + index}`,
        "c1000000-0000-4000-8000-000000000004",
        "93000000-0000-4000-8000-000000000017",
        startsAt,
        endsAt,
        "completed",
        "https://example.test/meeting/history",
        endsAt.toISOString(),
      );
    }),
  ];

  return mapPatientEncountersPage({
    bookings,
    favoriteTherapistsCount: 3,
    patient,
    reviews: [],
    serviceById: services,
    summaries: bookings
      .filter((booking) => booking.status === "completed")
      .slice(0, 3)
      .map((booking) => ({ booking_id: booking.id, id: booking.id })),
    therapistById: therapists,
    therapyById: therapies,
    unreadMessagesCount: 2,
    unreadNotificationsCount: 1,
  });
}

function createBooking(
  id: string,
  therapistProfileId: string,
  serviceId: string,
  startsAt: Date,
  endsAt: Date,
  status: string,
  meetingUrl: string | null,
  completedAt: string | null = null,
): BookingRecord {
  return {
    cancelled_at: null,
    cancellation_reason: null,
    completed_at: completedAt,
    ends_at: endsAt.toISOString(),
    id,
    meeting_url: meetingUrl,
    payment_status: "paid",
    service_id: serviceId,
    starts_at: startsAt.toISOString(),
    status,
    therapist_profile_id: therapistProfileId,
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}
