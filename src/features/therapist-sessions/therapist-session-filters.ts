import { BookingStatus } from "@/domain/tes";
import type {
  SessionModality,
  TherapistSessionFilters,
  TherapistSessionPeriodPreset,
} from "@/features/bookings";

type SearchParams = Record<string, string | string[] | undefined>;

export type ParsedTherapistSessionFilters =
  | { filters: TherapistSessionFilters; valid: true }
  | { message: string; valid: false };

export function parseTherapistSessionFilters(
  searchParams: SearchParams,
): ParsedTherapistSessionFilters {
  const limitValue = first(searchParams.limit);
  const limit = limitValue ? Number(limitValue) : 20;
  const bookingStatus = first(searchParams.status);
  const modalityValue = first(searchParams.modality);
  const requestedPeriod = first(searchParams.period);
  const explicitPeriodStart = first(searchParams.periodStart);
  const explicitPeriodEnd = first(searchParams.periodEnd);
  const patientProfileId = first(searchParams.patient);
  const serviceId = first(searchParams.service);
  const cursorStartsAt = first(searchParams.cursorStartsAt);
  const cursorBookingId = first(searchParams.cursorBookingId);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return invalidFilters();
  }
  if (bookingStatus && !isBookingStatus(bookingStatus)) {
    return invalidFilters();
  }
  if (modalityValue && !isModality(modalityValue)) {
    return invalidFilters();
  }
  if (requestedPeriod && !isPeriodPreset(requestedPeriod)) {
    return invalidFilters();
  }
  if (explicitPeriodStart && !isIsoDate(explicitPeriodStart)) {
    return invalidFilters();
  }
  if (explicitPeriodEnd && !isIsoDate(explicitPeriodEnd)) {
    return invalidFilters();
  }
  const periodPreset = isPeriodPreset(requestedPeriod)
    ? requestedPeriod
    : explicitPeriodStart || explicitPeriodEnd
      ? undefined
      : "30";
  const { periodEnd, periodStart } = resolvePeriodWindow(
    periodPreset,
    explicitPeriodStart,
    explicitPeriodEnd,
  );
  if (
    periodStart &&
    periodEnd &&
    new Date(periodStart).getTime() >= new Date(periodEnd).getTime()
  ) {
    return invalidFilters();
  }
  if (patientProfileId && !isUuid(patientProfileId)) return invalidFilters();
  if (serviceId && !isUuid(serviceId)) return invalidFilters();
  if (Boolean(cursorStartsAt) !== Boolean(cursorBookingId)) {
    return invalidFilters();
  }
  if (cursorStartsAt && !isIsoDate(cursorStartsAt)) return invalidFilters();
  if (cursorBookingId && !isUuid(cursorBookingId)) return invalidFilters();

  return {
    filters: {
      bookingStatus:
        bookingStatus && isBookingStatus(bookingStatus)
          ? bookingStatus
          : undefined,
      cursor:
        cursorStartsAt && cursorBookingId
          ? { bookingId: cursorBookingId, startsAt: cursorStartsAt }
          : undefined,
      limit,
      modality:
        modalityValue && isModality(modalityValue) ? modalityValue : undefined,
      patientProfileId,
      periodEnd,
      periodPreset,
      periodStart,
      serviceId,
    },
    valid: true,
  };
}

export function buildNextSessionsHref(
  filters: TherapistSessionFilters,
  cursor: { bookingId: string; startsAt: string },
) {
  const params = new URLSearchParams();
  if (filters.bookingStatus) params.set("status", filters.bookingStatus);
  if (filters.modality) params.set("modality", filters.modality);
  if (filters.periodPreset) params.set("period", filters.periodPreset);
  if (filters.patientProfileId) params.set("patient", filters.patientProfileId);
  if (filters.periodEnd) params.set("periodEnd", filters.periodEnd);
  if (filters.periodStart) params.set("periodStart", filters.periodStart);
  if (filters.serviceId) params.set("service", filters.serviceId);
  params.set("limit", String(filters.limit));
  params.set("cursorStartsAt", cursor.startsAt);
  params.set("cursorBookingId", cursor.bookingId);

  return `/terapeuta/sessoes?${params.toString()}`;
}

function invalidFilters(): ParsedTherapistSessionFilters {
  return {
    message: "Revise os filtros informados e tente novamente.",
    valid: false,
  };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isIsoDate(value: string) {
  return Number.isFinite(new Date(value).getTime());
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isBookingStatus(value: string): value is BookingStatus {
  return Object.values(BookingStatus).some((candidate) => candidate === value);
}

function isModality(value: string): value is SessionModality {
  return value === "online";
}

function isPeriodPreset(
  value: string | undefined,
): value is TherapistSessionPeriodPreset {
  return (
    value === "7" ||
    value === "30" ||
    value === "60" ||
    value === "90" ||
    value === "all"
  );
}

function resolvePeriodWindow(
  preset: TherapistSessionPeriodPreset | undefined,
  explicitStart: string | undefined,
  explicitEnd: string | undefined,
) {
  if (explicitStart || explicitEnd) {
    return { periodEnd: explicitEnd, periodStart: explicitStart };
  }
  if (!preset || preset === "all") {
    return { periodEnd: undefined, periodStart: undefined };
  }

  const end = new Date();
  const start = new Date(end.getTime() - Number(preset) * 86_400_000);
  return {
    periodEnd: end.toISOString(),
    periodStart: start.toISOString(),
  };
}
