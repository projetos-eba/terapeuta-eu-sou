import "server-only";

import type {
  AvailabilityDay,
  AvailabilitySlot,
} from "@/features/therapist-profile/types";
import {
  addAvailabilityDateKeyDays,
  availabilityDateKeyStart,
  formatAvailabilityDateKey,
  isAvailabilityDateKey,
  RESERVATION_WINDOW_DAYS,
} from "@/features/availability/reservation-window";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

export { formatAvailabilityDateKey } from "@/features/availability/reservation-window";

type AvailableSlotsContract = {
  horizonEndsAt?: unknown;
  slots?: Array<{ endsAt?: unknown; startsAt?: unknown }>;
  timezone?: unknown;
};

type AvailableDaysContract = {
  days?: Array<{ date?: unknown }>;
  horizonEndsAt?: unknown;
  month?: unknown;
  timezone?: unknown;
};

type PublicAvailabilityMonthContract = PublicAvailabilityMonth & {
  month: string;
};

const PUBLIC_PROFILE_COMPACT_DAY_LIMIT = 3;

export type PublicAvailabilityMonth = {
  dates: string[];
  horizonEndsAt: string;
  timezone: string;
};

export type PublicServiceAvailabilityResult =
  | {
      data: {
        days: AvailabilityDay[];
        horizonEndsAt: string;
        timezone: string;
      };
      status: "success";
    }
  | { data: null; status: "error" };

export async function getPublicServiceAvailability(
  serviceId: string,
  range: { end: Date; start: Date } = defaultInitialRange(),
): Promise<PublicServiceAvailabilityResult> {
  const contract = await requestPublicAvailability<AvailableSlotsContract>(
    "get_service_available_slots_v1",
    {
      p_limit: 500,
      p_range_end: range.end.toISOString(),
      p_range_start: range.start.toISOString(),
      p_service_id: serviceId,
    },
  );
  if (!contract) return { data: null, status: "error" };

  const timezone = readTimezone(contract.timezone);
  const horizonEndsAt = readIsoDate(contract.horizonEndsAt);
  if (!timezone || !horizonEndsAt || !Array.isArray(contract.slots)) {
    return { data: null, status: "error" };
  }

  return {
    data: {
      days: mapAvailableSlots(contract.slots, serviceId, timezone),
      horizonEndsAt,
      timezone,
    },
    status: "success",
  };
}

export async function getPublicServiceAvailabilityForDay(
  serviceId: string,
  date: string,
): Promise<PublicServiceAvailabilityResult> {
  if (!isDateKey(date)) return { data: null, status: "error" };

  const contract = await requestPublicAvailability<AvailableSlotsContract>(
    "get_service_available_day_slots_v1",
    { p_day: date, p_service_id: serviceId },
  );
  if (!contract) return { data: null, status: "error" };

  const timezone = readTimezone(contract.timezone);
  const horizonEndsAt = readIsoDate(contract.horizonEndsAt);
  if (!timezone || !horizonEndsAt || !Array.isArray(contract.slots)) {
    return { data: null, status: "error" };
  }

  return {
    data: {
      days: mapAvailableSlots(contract.slots, serviceId, timezone),
      horizonEndsAt,
      timezone,
    },
    status: "success",
  };
}

export async function getPublicServiceAvailabilityForWindow(
  serviceId: string,
  startDate: string,
  timezone: string,
): Promise<PublicServiceAvailabilityResult> {
  const endDate = addAvailabilityDateKeyDays(
    startDate,
    RESERVATION_WINDOW_DAYS,
  );
  const start = availabilityDateKeyStart(startDate, timezone);
  const end = endDate ? availabilityDateKeyStart(endDate, timezone) : null;
  if (!start || !end) return { data: null, status: "error" };

  const result = await getPublicServiceAvailability(serviceId, { end, start });
  return result.status === "success" && result.data.timezone === timezone
    ? result
    : { data: null, status: "error" };
}

export async function getPublicServiceCompactAvailability(
  serviceId: string,
): Promise<PublicServiceAvailabilityResult> {
  const firstMonth = await requestPublicServiceAvailabilityMonth(
    serviceId,
    null,
  );
  if (!firstMonth) return { data: null, status: "error" };

  const { horizonEndsAt, timezone } = firstMonth;
  const horizon = new Date(horizonEndsAt);
  const days: AvailabilityDay[] = [];
  const visitedDates = new Set<string>();
  let monthAvailability = firstMonth;

  while (days.length < PUBLIC_PROFILE_COMPACT_DAY_LIMIT) {
    const candidates = [...new Set(monthAvailability.dates)]
      .filter((date) => {
        if (visitedDates.has(date)) return false;
        const startsAt = availabilityDateKeyStart(date, timezone);
        return startsAt ? startsAt < horizon : false;
      })
      .sort();
    let offset = 0;

    while (
      offset < candidates.length &&
      days.length < PUBLIC_PROFILE_COMPACT_DAY_LIMIT
    ) {
      const missingDayCount = PUBLIC_PROFILE_COMPACT_DAY_LIMIT - days.length;
      const batch = candidates.slice(offset, offset + missingDayCount);
      batch.forEach((date) => visitedDates.add(date));

      const detailResults = await Promise.all(
        batch.map((date) =>
          getPublicServiceAvailabilityForDay(serviceId, date),
        ),
      );
      if (detailResults.some((result) => result.status === "error")) {
        return { data: null, status: "error" };
      }
      if (
        detailResults.some(
          (result) =>
            result.status === "success" && result.data.timezone !== timezone,
        )
      ) {
        return { data: null, status: "error" };
      }

      detailResults.forEach((result, index) => {
        if (result.status !== "success") return;

        const requestedDate = batch[index];
        const day = result.data.days.find(
          (item) => item.date === requestedDate && item.slots.length > 0,
        );
        if (day) days.push(day);
      });
      days.sort((left, right) => left.date.localeCompare(right.date));
      offset += batch.length;
    }

    if (days.length >= PUBLIC_PROFILE_COMPACT_DAY_LIMIT) break;

    const nextMonth = addMonthKeyMonths(monthAvailability.month, 1);
    const nextMonthStartsAt = nextMonth
      ? availabilityDateKeyStart(`${nextMonth}-01`, timezone)
      : null;
    if (!nextMonth || !nextMonthStartsAt || nextMonthStartsAt >= horizon) {
      break;
    }

    const nextMonthAvailability = await requestPublicServiceAvailabilityMonth(
      serviceId,
      nextMonth,
    );
    if (
      !nextMonthAvailability ||
      nextMonthAvailability.month !== nextMonth ||
      nextMonthAvailability.timezone !== timezone
    ) {
      return { data: null, status: "error" };
    }
    monthAvailability = nextMonthAvailability;
  }

  return {
    data: {
      days: days.slice(0, PUBLIC_PROFILE_COMPACT_DAY_LIMIT),
      horizonEndsAt,
      timezone,
    },
    status: "success",
  };
}

export async function getPublicServiceAvailabilityMonth(
  serviceId: string,
  month: string,
): Promise<
  | { data: PublicAvailabilityMonth; status: "success" }
  | { data: null; status: "error" }
> {
  if (!isMonthKey(month)) return { data: null, status: "error" };

  const result = await requestPublicServiceAvailabilityMonth(serviceId, month);
  if (!result) return { data: null, status: "error" };

  const { dates, horizonEndsAt, timezone } = result;
  return { data: { dates, horizonEndsAt, timezone }, status: "success" };
}

async function requestPublicServiceAvailabilityMonth(
  serviceId: string,
  month: string | null,
): Promise<PublicAvailabilityMonthContract | null> {
  if (month !== null && !isMonthKey(month)) return null;

  const contract = await requestPublicAvailability<AvailableDaysContract>(
    "get_service_available_days_v1",
    month
      ? { p_month: `${month}-01`, p_service_id: serviceId }
      : { p_service_id: serviceId },
  );
  if (!contract) return null;

  const timezone = readTimezone(contract.timezone);
  const horizonEndsAt = readIsoDate(contract.horizonEndsAt);
  const returnedMonth = readMonthKey(contract.month) ?? month;
  const dates = Array.isArray(contract.days)
    ? contract.days
        .map((day) => (typeof day?.date === "string" ? day.date : null))
        .filter((date): date is string => Boolean(date && isDateKey(date)))
    : null;
  if (!timezone || !horizonEndsAt || !returnedMonth || !dates) {
    return null;
  }

  return {
    dates,
    horizonEndsAt,
    month: returnedMonth,
    timezone,
  };
}

async function requestPublicAvailability<T>(operation: string, body: object) {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/${operation}`, {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        apikey: config.apiKey,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    if (!response.ok) return null;
    return (await response.json()) as T | null;
  } catch {
    return null;
  }
}

function defaultInitialRange() {
  const start = new Date();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { end, start };
}

function readTimezone(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function readIsoDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function readMonthKey(value: unknown) {
  return typeof value === "string" && isMonthKey(value) ? value : null;
}

function addMonthKeyMonths(month: string, amount: number) {
  if (!isMonthKey(month)) return null;

  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isDateKey(value: string) {
  return isAvailabilityDateKey(value);
}

export function isMonthKey(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function mapAvailableSlots(
  rows: Array<{ endsAt?: unknown; startsAt?: unknown }>,
  serviceId: string,
  timezone: string,
  now = new Date(),
): AvailabilityDay[] {
  const todayKey = formatDateKey(now, timezone);
  const tomorrow = new Date(`${todayKey}T12:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  const days = new Map<string, AvailabilityDay>();

  for (const row of rows) {
    if (typeof row.startsAt !== "string" || typeof row.endsAt !== "string") {
      continue;
    }
    const startsAt = new Date(row.startsAt);
    const endsAt = new Date(row.endsAt);
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime())
    ) {
      continue;
    }

    const dateKey = formatDateKey(startsAt, timezone);
    const slot: AvailabilitySlot = {
      dateLabel: formatDateLabel(startsAt, timezone),
      dayLabel: formatDayLabel(
        startsAt,
        timezone,
        dateKey,
        todayKey,
        tomorrowKey,
      ),
      endsAt: endsAt.toISOString(),
      serviceId,
      startsAt: startsAt.toISOString(),
      timeLabel: new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }).format(startsAt),
    };
    const existing = days.get(dateKey);
    if (existing) {
      existing.slots.push(slot);
      continue;
    }
    days.set(dateKey, {
      date: dateKey,
      dateLabel: slot.dateLabel,
      dayLabel: slot.dayLabel,
      slots: [slot],
    });
  }

  return Array.from(days.values()).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

function formatDateKey(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function formatDateLabel(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
  }).format(value);
}

function formatDayLabel(
  value: Date,
  timezone: string,
  dateKey: string,
  todayKey: string,
  tomorrowKey: string,
) {
  if (dateKey === todayKey) return "Hoje";
  if (dateKey === tomorrowKey) return "Amanhã";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    weekday: "short",
  })
    .format(value)
    .replace(".", "");
}
