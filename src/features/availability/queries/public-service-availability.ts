import "server-only";

import type {
  AvailabilityDay,
  AvailabilitySlot,
} from "@/features/therapist-profile/types";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

type AvailableSlotsContract = {
  horizonEndsAt?: unknown;
  slots?: Array<{ endsAt?: unknown; startsAt?: unknown }>;
  timezone?: unknown;
};

type AvailableDaysContract = {
  days?: Array<{ date?: unknown }>;
  horizonEndsAt?: unknown;
  timezone?: unknown;
};

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

export async function getPublicServiceAvailabilityMonth(
  serviceId: string,
  month: string,
): Promise<
  | { data: PublicAvailabilityMonth; status: "success" }
  | { data: null; status: "error" }
> {
  if (!isMonthKey(month)) return { data: null, status: "error" };

  const contract = await requestPublicAvailability<AvailableDaysContract>(
    "get_service_available_days_v1",
    { p_month: `${month}-01`, p_service_id: serviceId },
  );
  if (!contract) return { data: null, status: "error" };

  const timezone = readTimezone(contract.timezone);
  const horizonEndsAt = readIsoDate(contract.horizonEndsAt);
  const dates = Array.isArray(contract.days)
    ? contract.days
        .map((day) => (typeof day?.date === "string" ? day.date : null))
        .filter((date): date is string => Boolean(date && isDateKey(date)))
    : null;
  if (!timezone || !horizonEndsAt || !dates) {
    return { data: null, status: "error" };
  }

  return { data: { dates, horizonEndsAt, timezone }, status: "success" };
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

export function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isMonthKey(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function formatAvailabilityDateKey(value: Date, timezone: string) {
  return formatDateKey(value, timezone);
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
