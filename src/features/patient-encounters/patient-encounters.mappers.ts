import {
  canJoinBooking,
  isCancelledBookingStatus,
  isCompletedBookingStatus,
} from "@/features/bookings/booking-status";
import {
  formatBookingDate,
  formatBookingMetricDate,
  formatBookingSchedule,
  formatRelativeBookingDay,
} from "@/features/bookings/booking-formatters";
import { routes } from "@/lib/routes";
import { getTherapistAvatarUrl } from "@/lib/therapist-avatars";

import type {
  PatientEncounter,
  PatientEncountersPageData,
  PatientEncountersPatient,
  PatientEncounterStatus,
} from "./patient-encounters.types";

export type BookingRecord = {
  cancelled_at: string | null;
  cancellation_reason: string | null;
  completed_at: string | null;
  ends_at: string;
  id: string;
  meeting_url: string | null;
  service_id: string;
  starts_at: string;
  status: string;
  therapist_profile_id: string;
};

export type TherapistRecord = {
  headline: string | null;
  id: string;
  photo_url: string | null;
  public_name: string;
};

export type ServiceRecord = {
  id: string;
  therapy_id: string;
  title: string;
};

export type TherapyRecord = {
  id: string;
  name: string;
  slug: string;
};

export type ReviewRecord = {
  booking_id: string;
};

export type SessionSummaryRecord = {
  booking_id: string;
  id: string;
};

type MapPatientEncountersInput = {
  bookings: BookingRecord[];
  favoriteTherapistsCount: number;
  patient: PatientEncountersPatient;
  reviews: ReviewRecord[];
  serviceById: Map<string, ServiceRecord>;
  summaries: SessionSummaryRecord[];
  therapistById: Map<string, TherapistRecord>;
  therapyById: Map<string, TherapyRecord>;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
};

export function mapPatientEncountersPage(
  input: MapPatientEncountersInput,
): PatientEncountersPageData {
  const now = new Date();
  const summaryBookingIds = new Set(
    input.summaries.map((summary) => summary.booking_id),
  );
  const reviewedBookingIds = new Set(
    input.reviews.map((review) => review.booking_id),
  );
  const mapped = input.bookings
    .map((booking) =>
      mapPatientEncounter(booking, input, summaryBookingIds, reviewedBookingIds),
    )
    .filter((item): item is PatientEncounter => Boolean(item));

  const activeEncounters = mapped
    .filter(
      (encounter) =>
        encounter.status !== "completed" &&
        encounter.status !== "cancelled" &&
        new Date(encounter.endsAt) >= now,
    )
    .sort(sortUpcomingEncounters);
  const upcomingEncounters = activeEncounters.slice(0, 3);
  const currentJourneyTherapistIds = new Set(
    upcomingEncounters.map((encounter) => encounter.therapist.id),
  );
  const historyEncounters = mapped
    .filter((encounter) => encounter.status === "completed")
    .sort((left, right) => sortByStartsAt(right, left))
    .slice(0, 3);
  const completedCount = input.bookings.filter((booking) =>
    isCompletedBookingStatus(booking.status),
  ).length;
  const activeCount = activeEncounters.filter((encounter) =>
    currentJourneyTherapistIds.has(encounter.therapist.id),
  ).length;

  return {
    favoriteTherapistsCount: input.favoriteTherapistsCount,
    historyEncounters,
    metrics: {
      activeCount,
      completedCount,
      favoriteTherapistsCount: input.favoriteTherapistsCount,
    },
    nextEncounter: upcomingEncounters[0] ?? null,
    patient: input.patient,
    recentJourneyTopics: deriveRecentJourneyTopics(input.bookings, input),
    source: "supabase",
    unreadMessagesCount: input.unreadMessagesCount,
    unreadNotificationsCount: input.unreadNotificationsCount,
    upcomingEncounters,
  };
}

function mapPatientEncounter(
  booking: BookingRecord,
  input: MapPatientEncountersInput,
  summaryBookingIds: Set<string>,
  reviewedBookingIds: Set<string>,
): PatientEncounter | null {
  const therapist = input.therapistById.get(booking.therapist_profile_id);
  const service = input.serviceById.get(booking.service_id);
  const therapy = service ? input.therapyById.get(service.therapy_id) : null;

  if (!therapist || !service || !therapy) return null;

  const status = getEncounterStatus(booking);
  const summaryId = summaryBookingIds.has(booking.id) ? booking.id : null;
  const hasReview = reviewedBookingIds.has(booking.id);

  return {
    actionHint:
      booking.meeting_url && status === "confirmed"
        ? "Link liberado 10 min antes"
        : undefined,
    approachLabel: getApproachLabel(therapy.slug),
    dateLabel: formatRelativeBookingDay(booking.starts_at),
    endsAt: booking.ends_at,
    id: booking.id,
    meetingUrl: booking.meeting_url,
    primaryAction: getPrimaryAction(booking, status, summaryId, hasReview),
    scheduleLabel:
      status === "completed"
        ? formatBookingSchedule(booking.starts_at)
        : formatBookingMetricDate(booking.starts_at),
    serviceLabel: service.title,
    startsAt: booking.starts_at,
    status,
    statusLabel: getStatusLabel(status),
    summaryId,
    therapist: {
      avatarUrl: getTherapistAvatarUrl(therapist.photo_url, {
        name: therapist.public_name,
      }),
      id: therapist.id,
      name: therapist.public_name,
    },
    therapyLabel: therapy.name,
  };
}

function getEncounterStatus(booking: BookingRecord): PatientEncounterStatus {
  if (isCompletedBookingStatus(booking.status)) return "completed";
  if (isCancelledBookingStatus(booking.status)) return "cancelled";
  if (booking.status === "pending_payment") return "pending_payment";

  if (
    canJoinBooking({
      endsAt: booking.ends_at,
      meetingUrl: booking.meeting_url,
      startsAt: booking.starts_at,
      status: booking.status,
    })
  ) {
    return "live";
  }

  return "confirmed";
}

function getPrimaryAction(
  booking: BookingRecord,
  status: PatientEncounterStatus,
  summaryId: string | null,
  hasReview: boolean,
): PatientEncounter["primaryAction"] {
  if (status === "live" && booking.meeting_url) {
    return {
      href: routes.patient.encounterDetail(booking.id),
      kind: "link",
      label: "Abrir sessão",
    };
  }

  if (status === "completed") {
    if (summaryId) {
      return {
        href: `${routes.patient.encounterDetail(booking.id)}?resumo=1`,
        kind: "link",
        label: "Ver resumo",
      };
    }

    if (!hasReview) {
      return {
        href: `${routes.patient.sessionHistory}?avaliar=${booking.id}`,
        kind: "link",
        label: "Avaliar sessão",
      };
    }

    return {
      href: routes.patient.help,
      kind: "link",
      label: "Solicitar suporte",
    };
  }

  return {
    href: routes.patient.encounterDetail(booking.id),
    kind: "link",
    label: "Ver detalhes",
  };
}

function getStatusLabel(status: PatientEncounterStatus) {
  const labels: Record<PatientEncounterStatus, string> = {
    cancelled: "Cancelada",
    completed: "Realizada",
    confirmed: "Confirmada",
    live: "Ao vivo agora",
    pending_payment: "Pagamento pendente",
  };

  return labels[status];
}

function getApproachLabel(slug: string) {
  if (slug === "reiki") {
    return "Abordagem energética";
  }

  if (slug === "constelacao-familiar") return "Abordagem sistêmica";

  return "Abordagem intuitiva";
}

function deriveRecentJourneyTopics(
  bookings: BookingRecord[],
  input: MapPatientEncountersInput,
) {
  const topicByTherapySlug: Record<string, string> = {
    "constelacao-familiar": "Relacionamentos",
    reiki: "Autoconhecimento",
    taro: "Propósito",
  };
  const cutoff = Date.now() - 30 * 86_400_000;
  const topics = bookings
    .filter(
      (booking) =>
        isCompletedBookingStatus(booking.status) &&
        new Date(booking.starts_at).getTime() >= cutoff,
    )
    .map((booking) => {
      const service = input.serviceById.get(booking.service_id);
      const therapy = service ? input.therapyById.get(service.therapy_id) : null;

      return therapy ? topicByTherapySlug[therapy.slug] : null;
    })
    .filter((topic): topic is string => Boolean(topic));

  return unique(topics).slice(0, 3);
}

function sortByStartsAt(left: PatientEncounter, right: PatientEncounter) {
  return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
}

function sortUpcomingEncounters(
  left: PatientEncounter,
  right: PatientEncounter,
) {
  if (left.status === "live" && right.status !== "live") return -1;
  if (left.status !== "live" && right.status === "live") return 1;
  if (left.status === "live" && right.status === "live") {
    return (
      new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime()
    );
  }

  return sortByStartsAt(left, right);
}

function unique(values: string[]) {
  return [...new Set(values)];
}
