import {
  BookingStatus,
  SessionFinancialStatus,
  type SessionFinancialStatus as SessionFinancialStatusValue,
} from "@/domain/tes";
import type {
  SessionModality,
  TherapistSessionFilters,
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
  const financialStatus = first(searchParams.payment);
  const modalityValue = first(searchParams.modality);
  const periodStart = first(searchParams.periodStart);
  const periodEnd = first(searchParams.periodEnd);
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
  if (financialStatus && !isFinancialStatus(financialStatus)) {
    return invalidFilters();
  }
  if (modalityValue && !isModality(modalityValue)) {
    return invalidFilters();
  }
  if (periodStart && !isIsoDate(periodStart)) return invalidFilters();
  if (periodEnd && !isIsoDate(periodEnd)) return invalidFilters();
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
      financialStatus:
        financialStatus && isFinancialStatus(financialStatus)
          ? financialStatus
          : undefined,
      limit,
      modality:
        modalityValue && isModality(modalityValue)
          ? modalityValue
          : undefined,
      patientProfileId,
      periodEnd,
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
  if (filters.financialStatus) params.set("payment", filters.financialStatus);
  if (filters.modality) params.set("modality", filters.modality);
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

function isFinancialStatus(
  value: string,
): value is SessionFinancialStatusValue {
  return Object.values(SessionFinancialStatus).some(
    (candidate) => candidate === value,
  );
}

function isModality(value: string): value is SessionModality {
  return value === "online" || value === "in_person";
}
