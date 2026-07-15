import type { AvailabilityDay, AvailabilitySlot } from "@/features/therapist-profile/types";

export type AvailabilityRuleInput = {
  dayOfWeek: number;
  endTime: string;
  isActive: boolean;
  serviceId: string | null;
  startTime: string;
  timezone: string;
};

export type AvailabilityExceptionInput = {
  endsAt: string;
  isAvailable: boolean;
  serviceId: string | null;
  startsAt: string;
};

export type BookingConflictInput = {
  endsAt: string;
  serviceId: string;
  startsAt: string;
  status: string;
};

export type BookingSettingsInput = {
  bufferAfterMinutes: number;
  bufferBeforeMinutes: number;
  intervalMinutes: number;
  maxDaysAhead: number;
  minNoticeMinutes: number;
  serviceId: string;
};

export type AvailabilityServiceInput = {
  bookings: BookingConflictInput[];
  exceptions: AvailabilityExceptionInput[];
  now?: Date;
  rules: AvailabilityRuleInput[];
  selectedServiceId: string;
  serviceDurationMinutes: number;
  settings?: BookingSettingsInput;
};

const blockedStatuses = new Set([
  "confirmed",
  "pending_payment",
  "completed",
]);

function parseClock(date: Date, time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  const next = new Date(date);
  next.setHours(Number(hours), Number(minutes), 0, 0);
  return next;
}

function overlaps(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function formatDayLabel(date: Date, now: Date) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";

  return date
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "");
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatTimeLabel(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildAvailabilityDays({
  bookings,
  exceptions,
  now = new Date(),
  rules,
  selectedServiceId,
  serviceDurationMinutes,
  settings,
}: AvailabilityServiceInput): AvailabilityDay[] {
  const resolvedSettings = settings ?? {
    bufferAfterMinutes: 10,
    bufferBeforeMinutes: 10,
    intervalMinutes: 30,
    maxDaysAhead: 7,
    minNoticeMinutes: 120,
    serviceId: selectedServiceId,
  };
  const visibleDays = 7;
  const earliestStart = new Date(
    now.getTime() + resolvedSettings.minNoticeMinutes * 60_000,
  );
  const durationWithBuffers =
    serviceDurationMinutes +
    resolvedSettings.bufferBeforeMinutes +
    resolvedSettings.bufferAfterMinutes;
  const days: AvailabilityDay[] = [];

  for (let dayOffset = 0; dayOffset < visibleDays; dayOffset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + dayOffset);
    date.setHours(0, 0, 0, 0);

    const matchingRules = rules.filter(
      (rule) =>
        rule.isActive &&
        rule.dayOfWeek === date.getDay() &&
        (!rule.serviceId || rule.serviceId === selectedServiceId),
    );
    const slots: AvailabilitySlot[] = [];

    matchingRules.forEach((rule) => {
      const windowStart = parseClock(date, rule.startTime);
      const windowEnd = parseClock(date, rule.endTime);

      for (
        let cursor = new Date(windowStart);
        cursor.getTime() + durationWithBuffers * 60_000 <= windowEnd.getTime();
        cursor = new Date(
          cursor.getTime() + resolvedSettings.intervalMinutes * 60_000,
        )
      ) {
        const startsAt = new Date(
          cursor.getTime() + resolvedSettings.bufferBeforeMinutes * 60_000,
        );
        const endsAt = new Date(startsAt.getTime() + serviceDurationMinutes * 60_000);

        if (startsAt < earliestStart) continue;

        const blockedByException = exceptions.some((exception) => {
          if (exception.isAvailable) return false;
          if (exception.serviceId && exception.serviceId !== selectedServiceId) {
            return false;
          }

          return overlaps(
            startsAt,
            endsAt,
            new Date(exception.startsAt),
            new Date(exception.endsAt),
          );
        });

        if (blockedByException) continue;

        const blockedByBooking = bookings.some((booking) => {
          if (booking.serviceId !== selectedServiceId) return false;
          if (!blockedStatuses.has(booking.status)) return false;

          return overlaps(
            startsAt,
            endsAt,
            new Date(booking.startsAt),
            new Date(booking.endsAt),
          );
        });

        if (blockedByBooking) continue;

        slots.push({
          dateLabel: formatDateLabel(date),
          dayLabel: formatDayLabel(date, now),
          endsAt: endsAt.toISOString(),
          serviceId: selectedServiceId,
          startsAt: startsAt.toISOString(),
          timeLabel: formatTimeLabel(startsAt),
        });
      }
    });

    days.push({
      dateLabel: formatDateLabel(date),
      dayLabel: formatDayLabel(date, now),
      slots: slots.slice(0, 5),
    });
  }

  return days;
}
