import "server-only";

import type {
  AvailabilityDay,
  AvailabilitySlot,
} from "@/features/therapist-profile/types";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

type AvailableSlotsContract = {
  slots?: Array<{ endsAt?: unknown; startsAt?: unknown }>;
  timezone?: unknown;
};

export type PublicServiceAvailabilityResult =
  | {
      data: { days: AvailabilityDay[]; timezone: string };
      status: "success";
    }
  | { data: null; status: "error" };

export async function getPublicServiceAvailability(
  serviceId: string,
): Promise<PublicServiceAvailabilityResult> {
  const config = getSupabasePublicConfig();
  if (!config) return { data: null, status: "error" };

  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/get_service_available_slots_v1`,
      {
        body: JSON.stringify({ p_limit: 500, p_service_id: serviceId }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          apikey: config.apiKey,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    if (!response.ok) return { data: null, status: "error" };

    const contract = (await response.json()) as AvailableSlotsContract | null;
    const timezone =
      typeof contract?.timezone === "string" && contract.timezone
        ? contract.timezone
        : null;
    if (!timezone || !Array.isArray(contract?.slots)) {
      return { data: null, status: "error" };
    }

    return {
      data: {
        days: mapAvailableSlots(contract.slots, serviceId, timezone),
        timezone,
      },
      status: "success",
    };
  } catch {
    return { data: null, status: "error" };
  }
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
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
      continue;
    }

    const dateKey = formatDateKey(startsAt, timezone);
    const slot: AvailabilitySlot = {
      dateLabel: formatDateLabel(startsAt, timezone),
      dayLabel: formatDayLabel(startsAt, timezone, dateKey, todayKey, tomorrowKey),
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
