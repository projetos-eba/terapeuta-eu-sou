import {
  BOOKING_JOIN_WINDOW_BEFORE_MINUTES,
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

const MAX_HISTORY_ENCOUNTERS = 50;
export const HISTORY_PAGE_SIZE = 10;

export type BookingRecord = {
  cancelled_at: string | null;
  cancellation_reason: string | null;
  completed_at: string | null;
  ends_at: string;
  id: string;
  service_id: string;
  starts_at: string;
  status: string;
  therapist_profile_id: string;
  timezone: string;
  version: number;
};

export type SessionPaymentRecord = {
  booking_id: string;
  financial_status: string;
  payment_flow_version?: string | null;
};

export type RescheduleRecord = {
  booking_id: string;
  status: string;
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
  actorRealizedBookingIds?: Set<string>;
  patientEntryEntitlementByBookingId?: Map<string, boolean>;
  pendingFeedbackBookingIds?: Set<string>;
  historyPage?: number;
  reviews: ReviewRecord[];
  serviceById: Map<string, ServiceRecord>;
  sessionPaymentByBookingId: Map<string, SessionPaymentRecord>;
  summaries: SessionSummaryRecord[];
  rescheduleByBookingId: Map<string, RescheduleRecord>;
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
  const mapped = input.bookings
    .map((booking) => mapPatientEncounter(booking, input, summaryBookingIds))
    .filter((item): item is PatientEncounter => Boolean(item));

  const activeEncounters = mapped
    .filter(
      (encounter) =>
        encounter.status !== "completed" &&
        encounter.status !== "cancelled" &&
        new Date(encounter.endsAt) >= now,
    )
    .sort(sortUpcomingEncounters);
  const upcomingEncounters = activeEncounters;
  const currentJourneyTherapistIds = new Set(
    upcomingEncounters.map((encounter) => encounter.therapist.id),
  );
  const allHistoryEncounters = mapped
    .filter(
      (encounter) =>
        encounter.status === "completed" ||
        encounter.status === "cancelled" ||
        encounter.status === "awaiting_feedback",
    )
    .sort((left, right) => sortByStartsAt(right, left))
    .slice(0, MAX_HISTORY_ENCOUNTERS);
  const historyTotalPages = Math.max(
    1,
    Math.ceil(allHistoryEncounters.length / HISTORY_PAGE_SIZE),
  );
  const historyPage = Math.min(
    normalizeHistoryPage(input.historyPage),
    historyTotalPages,
  );
  const historyStart = (historyPage - 1) * HISTORY_PAGE_SIZE;
  const historyEncounters = allHistoryEncounters.slice(
    historyStart,
    historyStart + HISTORY_PAGE_SIZE,
  );
  const completedCount = input.bookings.filter((booking) =>
    isCompletedBookingStatus(booking.status),
  ).length;
  const activeCount = activeEncounters.filter((encounter) =>
    currentJourneyTherapistIds.has(encounter.therapist.id),
  ).length;

  return {
    favoriteTherapistsCount: input.favoriteTherapistsCount,
    historyEncounters,
    historyPagination: {
      hasNext: historyPage < historyTotalPages,
      page: historyPage,
      pageSize: HISTORY_PAGE_SIZE,
      total: allHistoryEncounters.length,
      totalPages: historyTotalPages,
    },
    metrics: {
      activeCount,
      completedCount,
      favoriteTherapistsCount: input.favoriteTherapistsCount,
    },
    nextEncounter: upcomingEncounters[0] ?? null,
    patient: input.patient,
    pendingFeedbackSessions: [],
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
): PatientEncounter | null {
  const therapist = input.therapistById.get(booking.therapist_profile_id);
  const service = input.serviceById.get(booking.service_id);
  const therapy = service ? input.therapyById.get(service.therapy_id) : null;

  if (!therapist || !service || !therapy) return null;

  const payment = input.sessionPaymentByBookingId.get(booking.id) ?? null;
  const reschedule = input.rescheduleByBookingId.get(booking.id) ?? null;
  const { paymentScheduled, status, statusLabel } =
    getPatientEncounterStatusPresentation({
      booking,
      feedbackPending:
        input.pendingFeedbackBookingIds?.has(booking.id) ?? false,
      actorRealized: input.actorRealizedBookingIds?.has(booking.id) ?? false,
      patientHasEntryEntitlement:
        input.patientEntryEntitlementByBookingId?.get(booking.id) ?? false,
      payment,
      reschedule,
    });
  const summaryId = summaryBookingIds.has(booking.id) ? booking.id : null;
  return {
    actionHint: paymentScheduled
      ? "Seu cartão está salvo. A cobrança será realizada 24 horas antes do encontro."
      : payment?.financial_status === "paid" && status === "confirmed"
        ? `Acesso à sala liberado ${BOOKING_JOIN_WINDOW_BEFORE_MINUTES} minutos antes.`
        : undefined,
    approachLabel: getApproachLabel(therapy.slug),
    dateLabel: formatRelativeBookingDay(booking.starts_at, booking.timezone),
    endsAt: booking.ends_at,
    id: booking.id,
    meetingUrl: null,
    paymentStatus: payment?.financial_status ?? null,
    paymentScheduled,
    primaryAction: getPrimaryAction(booking, status, paymentScheduled),
    rescheduleStatus: reschedule?.status ?? null,
    scheduleLabel:
      status === "completed"
        ? formatBookingSchedule(booking.starts_at, booking.timezone)
        : formatBookingMetricDate(booking.starts_at, booking.timezone),
    serviceLabel: service.title,
    startsAt: booking.starts_at,
    status,
    statusLabel,
    summaryId,
    therapist: {
      avatarUrl: getTherapistAvatarUrl(therapist.photo_url, {
        name: therapist.public_name,
      }),
      id: therapist.id,
      name: therapist.public_name,
    },
    therapyLabel: therapy.name,
    timezone: booking.timezone,
  };
}

export function getPatientEncounterStatusPresentation(input: {
  actorRealized?: boolean;
  booking: Pick<BookingRecord, "ends_at" | "starts_at" | "status">;
  feedbackPending?: boolean;
  patientHasEntryEntitlement?: boolean;
  payment: SessionPaymentRecord | null;
  reschedule: RescheduleRecord | null;
}) {
  const paymentScheduled = isFutureV10ChargeScheduled(
    input.booking,
    input.payment,
  );
  const status = getEncounterStatus(
    input.booking,
    input.payment,
    input.reschedule,
    input.patientHasEntryEntitlement ?? false,
    input.feedbackPending ?? false,
    input.actorRealized ?? false,
  );

  return {
    paymentScheduled,
    status,
    statusLabel: paymentScheduled
      ? "Reservado"
      : getStatusLabel(status, input.booking.status),
  };
}

function getEncounterStatus(
  booking: Pick<BookingRecord, "ends_at" | "starts_at" | "status">,
  payment: SessionPaymentRecord | null,
  reschedule: RescheduleRecord | null,
  patientHasEntryEntitlement: boolean,
  feedbackPending: boolean,
  actorRealized: boolean,
): PatientEncounterStatus {
  if (!isCancelledBookingStatus(booking.status)) {
    if (actorRealized) return "completed";
    if (feedbackPending && new Date(booking.ends_at).getTime() <= Date.now()) {
      return "awaiting_feedback";
    }
  }
  if (isCompletedBookingStatus(booking.status)) return "completed";
  if (
    booking.status === "cancelled_by_payment" &&
    (payment?.financial_status === "failed" ||
      payment?.financial_status === "canceled")
  ) {
    return "payment_incomplete";
  }
  if (isCancelledBookingStatus(booking.status)) return "cancelled";
  if (
    booking.status === "pending_payment" ||
    payment?.financial_status === "pending" ||
    payment?.financial_status === "processing"
  ) {
    return "pending_payment";
  }

  if (reschedule?.status === "pending") return "reschedule_requested";

  if (
    canJoinBooking({
      endsAt: booking.ends_at,
      paymentStatus: payment?.financial_status ?? null,
      patientHasJoined: patientHasEntryEntitlement,
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
  paymentScheduled = false,
): PatientEncounter["primaryAction"] {
  if (status === "live") {
    return {
      href: routes.patient.encounterDetail(booking.id),
      kind: "link",
      label: "Entrar no encontro",
    };
  }

  if (status === "pending_payment") {
    if (paymentScheduled) {
      return {
        href: routes.patient.encounterDetail(booking.id),
        kind: "link",
        label: "Ver detalhes",
      };
    }

    return {
      href: routes.patient.encounterDetail(booking.id),
      kind: "link",
      label: "Acompanhar pagamento",
    };
  }

  if (status === "payment_incomplete") {
    return {
      href: `/reserva?booking=${encodeURIComponent(booking.id)}&etapa=pagamento`,
      kind: "link",
      label: "Tentar pagamento novamente",
    };
  }

  if (status === "reschedule_requested") {
    return {
      href: routes.patient.encounterDetail(booking.id),
      kind: "link",
      label: "Acompanhar reagendamento",
    };
  }

  if (status === "completed") {
    return {
      href: routes.patient.encounterDetail(booking.id),
      kind: "link",
      label: "Ver detalhes do encontro",
    };
  }

  if (status === "awaiting_feedback") {
    return {
      href: `${routes.patient.encounterDetail(booking.id)}?feedback=1`,
      kind: "link",
      label: "Ver detalhes do encontro",
    };
  }

  if (status === "cancelled") {
    return {
      href: routes.patient.encounterDetail(booking.id),
      kind: "link",
      label: "Ver reembolso",
    };
  }

  return {
    href: routes.patient.encounterDetail(booking.id),
    kind: "link",
    label: "Ver detalhes",
  };
}

function isFutureV10ChargeScheduled(
  booking: Pick<BookingRecord, "starts_at" | "status">,
  payment: SessionPaymentRecord | null,
) {
  return (
    booking.status === "confirmed" &&
    payment?.payment_flow_version === "v10" &&
    payment.financial_status === "pending" &&
    new Date(booking.starts_at).getTime() - Date.now() > 24 * 60 * 60_000
  );
}

function getStatusLabel(
  status: PatientEncounterStatus,
  bookingStatus?: string,
) {
  if (bookingStatus === "no_show_patient") {
    return "Não realizado — você não compareceu";
  }
  if (bookingStatus === "no_show_therapist") {
    return "Não realizado — terapeuta ausente";
  }
  if (bookingStatus === "no_show_both") {
    return "Encontro não realizado";
  }

  const labels: Record<PatientEncounterStatus, string> = {
    cancelled: "Encontro cancelado",
    awaiting_feedback: "Avaliação pendente",
    completed: "Já realizada",
    confirmed: "Confirmada",
    live: "Ao vivo agora",
    payment_incomplete: "Pagamento não concluído",
    pending_payment: "Pagamento pendente",
    reschedule_requested: "Reagendamento solicitado",
  };

  return labels[status];
}

function normalizeHistoryPage(value: number | undefined) {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return 1;

  return Math.min(Math.floor(value ?? 1), 10_000);
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
      const therapy = service
        ? input.therapyById.get(service.therapy_id)
        : null;

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
