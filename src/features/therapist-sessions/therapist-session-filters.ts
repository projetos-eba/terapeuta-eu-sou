import { BookingStatus } from "@/domain/tes";
import type {
  SessionModality,
  TherapistSessionFilters,
  TherapistSessionsCursor,
  TherapistSessionPeriodPreset,
} from "@/features/bookings";

type SearchParams = Record<string, string | string[] | undefined>;

export type ParsedTherapistSessionFilters =
  | { filters: TherapistSessionFilters; valid: true }
  | { message: string; valid: false };

export type TherapistSessionCursorScope = "past" | "upcoming";

export type ParsedTherapistSessionCursor =
  | { cursor: TherapistSessionsCursor | undefined; valid: true }
  | { message: string; valid: false };

export type TherapistSessionListLimits = {
  past: number;
  upcoming: number;
};

export type ParsedTherapistSessionListLimits =
  | { limits: TherapistSessionListLimits; valid: true }
  | { message: string; valid: false };

export const THERAPIST_SESSION_INITIAL_LOAD_SIZE = 5;
export const THERAPIST_SESSION_LOAD_MORE_SIZE = 10;

export function parseTherapistSessionFilters(
  searchParams: SearchParams,
): ParsedTherapistSessionFilters {
  const limitValue = first(searchParams.limit);
  const limit = limitValue
    ? Number(limitValue)
    : THERAPIST_SESSION_INITIAL_LOAD_SIZE;
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
  cursorScope?: TherapistSessionCursorScope,
) {
  const params = buildSessionsQueryParams(filters);
  const cursorPrefix = cursorScope ? `${cursorScope}Cursor` : "cursor";
  params.set(`${cursorPrefix}StartsAt`, cursor.startsAt);
  params.set(`${cursorPrefix}BookingId`, cursor.bookingId);

  return `/terapeuta/sessoes?${params.toString()}`;
}

function buildSessionsQueryParams(filters: TherapistSessionFilters) {
  const params = new URLSearchParams();
  if (filters.bookingStatus) params.set("status", filters.bookingStatus);
  if (filters.modality) params.set("modality", filters.modality);
  if (filters.periodPreset) params.set("period", filters.periodPreset);
  if (filters.patientProfileId) params.set("patient", filters.patientProfileId);
  if (filters.periodEnd) params.set("periodEnd", filters.periodEnd);
  if (filters.periodStart) params.set("periodStart", filters.periodStart);
  if (filters.serviceId) params.set("service", filters.serviceId);
  params.set("limit", String(filters.limit));
  return params;
}

export function parseTherapistSessionListLimits(
  searchParams: SearchParams,
  fallbackLimit: number,
): ParsedTherapistSessionListLimits {
  const past = parseListLimit(first(searchParams.pastLimit), fallbackLimit);
  const upcoming = parseListLimit(
    first(searchParams.upcomingLimit),
    fallbackLimit,
  );

  if (past === null || upcoming === null) return invalidListLimits();

  return { limits: { past, upcoming }, valid: true };
}

export function buildLoadMoreSessionsHref(
  filters: TherapistSessionFilters,
  scope: TherapistSessionCursorScope,
  limits: TherapistSessionListLimits,
) {
  const nextLimits = {
    ...limits,
    [scope]: Math.min(limits[scope] + THERAPIST_SESSION_LOAD_MORE_SIZE, 100),
  };
  const params = buildSessionsQueryParams(filters);

  params.set("pastLimit", String(nextLimits.past));
  params.set("upcomingLimit", String(nextLimits.upcoming));

  return `/terapeuta/sessoes?${params.toString()}`;
}

export function parseTherapistSessionCursor(
  searchParams: SearchParams,
  scope: TherapistSessionCursorScope,
): ParsedTherapistSessionCursor {
  const prefix = `${scope}Cursor`;
  const cursorStartsAt = first(searchParams[`${prefix}StartsAt`]);
  const cursorBookingId = first(searchParams[`${prefix}BookingId`]);

  if (Boolean(cursorStartsAt) !== Boolean(cursorBookingId)) {
    return invalidCursor();
  }
  if (cursorStartsAt && !isIsoDate(cursorStartsAt)) return invalidCursor();
  if (cursorBookingId && !isUuid(cursorBookingId)) return invalidCursor();

  return {
    cursor:
      cursorStartsAt && cursorBookingId
        ? { bookingId: cursorBookingId, startsAt: cursorStartsAt }
        : undefined,
    valid: true,
  };
}

function invalidFilters(): ParsedTherapistSessionFilters {
  return {
    message: "Revise os filtros informados e tente novamente.",
    valid: false,
  };
}

function invalidCursor(): { message: string; valid: false } {
  return {
    message: "Revise os filtros informados e tente novamente.",
    valid: false,
  };
}

function invalidListLimits(): ParsedTherapistSessionListLimits {
  return {
    message: "Revise os filtros informados e tente novamente.",
    valid: false,
  };
}

function parseListLimit(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const limit = Number(value);
  return Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : null;
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
