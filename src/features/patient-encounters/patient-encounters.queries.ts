import "server-only";

import { cache } from "react";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import {
  mapPatientEncountersPage,
  type BookingRecord,
  type RescheduleRecord,
  type ReviewRecord,
  type ServiceRecord,
  type SessionPaymentRecord,
  type SessionSummaryRecord,
  type TherapistRecord,
  type TherapyRecord,
} from "./patient-encounters.mappers";
import type {
  PatientEncountersPageData,
  PatientEncountersPatient,
  PatientPendingFeedbackSession,
} from "./patient-encounters.types";

const DEMO_PATIENT_PROFILE_ID = "91000000-0000-4000-8000-000000000001";

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

type FavoriteRow = {
  therapist_profile_id: string;
};

type ConversationRow = {
  id: string;
};

type NotificationRow = {
  id: string;
};

type VideoParticipationRow = {
  booking_id: string;
};

type WaitingRoomArrivalRow = {
  booking_id: string;
  payload: unknown;
};

export class PatientEncountersDataError extends Error {
  constructor() {
    super("Não foi possível carregar seus encontros.");
  }
}

export const getPatientEncountersPage = cache(
  async function getPatientEncountersPage(
    profileId: string,
    accessToken: string | null = null,
    options: { historyPage?: number } = {},
  ): Promise<PatientEncountersPageData> {
    const config = getSupabaseServerConfig(accessToken);

    if (!config) {
      if (process.env.NODE_ENV === "development") {
        return createDemoPatientEncountersPage(profileId, options.historyPage);
      }

      throw new PatientEncountersDataError();
    }

    try {
      return await getSupabasePatientEncountersPage(
        config,
        profileId,
        options.historyPage,
      );
    } catch {
      throw new PatientEncountersDataError();
    }
  },
);

async function getSupabasePatientEncountersPage(
  config: SupabaseServerConfig,
  profileId: string,
  historyPage?: number,
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

  const [bookings, favorites, conversations, notifications, feedbackQueue] =
    await Promise.all([
      supabaseRequest<BookingRecord[]>(
        config,
        `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,service_id,starts_at,ends_at,timezone,status,cancellation_reason,cancelled_at,completed_at,version&patient_profile_id=eq.${patientProfile.id}&order=starts_at.asc`,
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
      supabaseRequest<PatientPendingFeedbackSession[]>(
        config,
        "/rest/v1/rpc/get_patient_session_feedback_queue_v1",
        { body: {}, method: "POST" },
      ),
    ]);
  const conversationIds = conversations.map((conversation) => conversation.id);
  const therapistIds = unique(
    bookings.map((booking) => booking.therapist_profile_id),
  );
  const serviceIds = unique(bookings.map((booking) => booking.service_id));
  const bookingIds = bookings.map((booking) => booking.id);
  const [
    therapists,
    services,
    reviews,
    summaries,
    sessionPayments,
    reschedules,
    unreadMessages,
    patientParticipations,
    patientWaitingRoomArrivals,
  ] = await Promise.all([
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
    getRowsByIds<SessionPaymentRecord>(
      config,
      "session_payments",
      "booking_id,financial_status",
      bookingIds,
      "booking_id",
    ),
    bookingIds.length > 0
      ? supabaseRequest<RescheduleRecord[]>(
          config,
          `/rest/v1/booking_reschedule_requests?select=booking_id,status&booking_id=in.(${bookingIds.join(",")})&status=eq.pending`,
        )
      : Promise.resolve([]),
    conversationIds.length > 0
      ? supabaseRequest<{ id: string }[]>(
          config,
          `/rest/v1/messages?select=id&conversation_id=in.(${conversationIds.join(",")})&sender_profile_id=neq.${encodeURIComponent(profileId)}&read_at=is.null`,
        )
      : Promise.resolve([]),
    bookingIds.length > 0
      ? supabaseRequest<VideoParticipationRow[]>(
          config,
          `/rest/v1/video_session_participations?select=booking_id&booking_id=in.(${bookingIds.join(",")})&participant_role=eq.patient&event_type=eq.session.user_joined`,
        )
      : Promise.resolve([]),
    bookingIds.length > 0
      ? supabaseRequest<WaitingRoomArrivalRow[]>(
          config,
          `/rest/v1/booking_events?select=booking_id,payload&booking_id=in.(${bookingIds.join(",")})&event_type=eq.zoom_waiting_room_entered`,
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
    historyPage,
    patient,
    pendingFeedbackBookingIds: new Set(
      feedbackQueue.map((session) => session.bookingId),
    ),
    patientEntryEntitlementByBookingId: buildPatientEntryEntitlements(
      bookings,
      patientParticipations,
      patientWaitingRoomArrivals,
    ),
    reviews,
    serviceById: new Map(services.map((service) => [service.id, service])),
    rescheduleByBookingId: new Map(
      reschedules.map((reschedule) => [reschedule.booking_id, reschedule]),
    ),
    sessionPaymentByBookingId: new Map(
      sessionPayments.map((payment) => [payment.booking_id, payment]),
    ),
    summaries,
    therapistById: new Map(
      therapists.map((therapist) => [therapist.id, therapist]),
    ),
    therapyById: new Map(therapies.map((therapy) => [therapy.id, therapy])),
    unreadMessagesCount: unreadMessages.length,
    unreadNotificationsCount: notifications.length,
  });

  return {
    ...page,
    pendingFeedbackSessions: feedbackQueue,
    source: "supabase",
  };
}

function buildPatientEntryEntitlements(
  bookings: BookingRecord[],
  participations: VideoParticipationRow[],
  arrivals: WaitingRoomArrivalRow[],
) {
  const joinedBookingIds = new Set(
    participations.map((participation) => participation.booking_id),
  );
  const arrivalsByBookingId = new Map<string, WaitingRoomArrivalRow[]>();

  for (const arrival of arrivals) {
    const current = arrivalsByBookingId.get(arrival.booking_id) ?? [];
    current.push(arrival);
    arrivalsByBookingId.set(arrival.booking_id, current);
  }

  return new Map(
    bookings.map((booking) => [
      booking.id,
      joinedBookingIds.has(booking.id) ||
        (arrivalsByBookingId.get(booking.id) ?? []).some((arrival) =>
          isCurrentBookingArrival(
            arrival.payload,
            booking.version,
            booking.starts_at,
          ),
        ),
    ]),
  );
}

function isCurrentBookingArrival(
  value: unknown,
  bookingVersion: number,
  startsAt: string,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;

  return (
    Number(payload.bookingVersion) === bookingVersion &&
    typeof payload.scheduledStartsAt === "string" &&
    Date.parse(payload.scheduledStartsAt) === Date.parse(startsAt)
  );
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
  idColumn = "id",
): Promise<T[]> {
  if (ids.length === 0) return [];

  return supabaseRequest<T[]>(
    config,
    `/rest/v1/${table}?select=${select}&${idColumn}=in.(${ids.join(",")})`,
  );
}

async function supabaseRequest<T>(
  config: SupabaseServerConfig,
  path: string,
  options: { body?: unknown; method?: "GET" | "POST" } = {},
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    method: options.method ?? "GET",
  });

  if (!response.ok) throw new PatientEncountersDataError();

  return (await response.json()) as T;
}

function createDemoPatientEncountersPage(
  profileId: string,
  historyPage?: number,
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
      {
        id: "22222222-2222-4222-8222-222222222225",
        name: "Reiki",
        slug: "reiki",
      },
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
    createBooking(
      "94000000-0000-4000-8000-000000000021",
      "92000000-0000-4000-8000-000000000014",
      "93000000-0000-4000-8000-000000000014",
      liveStart,
      liveEnd,
      "confirmed",
    ),
    createBooking(
      "94000000-0000-4000-8000-000000000022",
      "92000000-0000-4000-8000-000000000015",
      "93000000-0000-4000-8000-000000000015",
      laterToday,
      laterTodayEnd,
      "confirmed",
    ),
    createBooking(
      "94000000-0000-4000-8000-000000000023",
      "92000000-0000-4000-8000-000000000016",
      "93000000-0000-4000-8000-000000000016",
      tomorrow,
      tomorrowEnd,
      "confirmed",
    ),
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
        endsAt.toISOString(),
      );
    }),
  ];

  return mapPatientEncountersPage({
    bookings,
    favoriteTherapistsCount: 3,
    historyPage,
    patient,
    reviews: [],
    rescheduleByBookingId: new Map(),
    serviceById: services,
    sessionPaymentByBookingId: new Map(
      bookings.map((booking) => [
        booking.id,
        { booking_id: booking.id, financial_status: "paid" },
      ]),
    ),
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
  completedAt: string | null = null,
): BookingRecord {
  return {
    cancelled_at: null,
    cancellation_reason: null,
    completed_at: completedAt,
    ends_at: endsAt.toISOString(),
    id,
    service_id: serviceId,
    starts_at: startsAt.toISOString(),
    status,
    therapist_profile_id: therapistProfileId,
    timezone: "America/Sao_Paulo",
    version: 1,
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}
