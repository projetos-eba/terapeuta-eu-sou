import type {
  AvailabilityDay,
  AvailabilitySlot,
} from "@/features/therapist-profile/types";

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

const defaultBookingSettings = {
  bufferAfterMinutes: 10,
  bufferBeforeMinutes: 10,
  intervalMinutes: 30,
  maxDaysAhead: 30,
  minNoticeMinutes: 120,
};

type AvailabilityWindow = {
  end: Date;
  start: Date;
};

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

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

function matchesService(serviceId: string | null, selectedServiceId: string) {
  return !serviceId || serviceId === selectedServiceId;
}

function getDayBounds(now: Date, dayOffset: number) {
  const start = new Date(now);
  start.setDate(now.getDate() + dayOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return { end, start };
}

function uniqueSlots(slots: AvailabilitySlot[]) {
  const seen = new Set<string>();

  return slots.filter((slot) => {
    if (seen.has(slot.startsAt)) return false;
    seen.add(slot.startsAt);
    return true;
  });
}

function buildSlotsForWindow({
  bookings,
  date,
  durationWithBuffers,
  earliestStart,
  exceptions,
  now,
  selectedServiceId,
  serviceDurationMinutes,
  settings,
  window,
}: {
  bookings: BookingConflictInput[];
  date: Date;
  durationWithBuffers: number;
  earliestStart: Date;
  exceptions: AvailabilityExceptionInput[];
  now: Date;
  selectedServiceId: string;
  serviceDurationMinutes: number;
  settings: BookingSettingsInput;
  window: AvailabilityWindow;
}) {
  const slots: AvailabilitySlot[] = [];

  for (
    let cursor = new Date(window.start);
    cursor.getTime() + durationWithBuffers * 60_000 <= window.end.getTime();
    cursor = new Date(cursor.getTime() + settings.intervalMinutes * 60_000)
  ) {
    const startsAt = new Date(
      cursor.getTime() + settings.bufferBeforeMinutes * 60_000,
    );
    const endsAt = new Date(startsAt.getTime() + serviceDurationMinutes * 60_000);

    if (startsAt < earliestStart) continue;

    const blockedByException = exceptions.some((exception) => {
      if (exception.isAvailable) return false;
      if (!matchesService(exception.serviceId, selectedServiceId)) return false;

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

  return slots;
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
  const resolvedSettings: BookingSettingsInput = {
    ...defaultBookingSettings,
    ...settings,
    serviceId: selectedServiceId,
  };
  const horizonDays = Math.max(1, resolvedSettings.maxDaysAhead);
  const earliestStart = new Date(
    now.getTime() + resolvedSettings.minNoticeMinutes * 60_000,
  );
  const durationWithBuffers =
    serviceDurationMinutes +
    resolvedSettings.bufferBeforeMinutes +
    resolvedSettings.bufferAfterMinutes;
  const days: AvailabilityDay[] = [];

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
    const { end: nextDay, start: date } = getDayBounds(now, dayOffset);

    const matchingRules = rules.filter(
      (rule) =>
        rule.isActive &&
        rule.dayOfWeek === date.getDay() &&
        matchesService(rule.serviceId, selectedServiceId),
    );
    const ruleWindows = matchingRules.map((rule) => ({
      end: parseClock(date, rule.endTime),
      start: parseClock(date, rule.startTime),
    }));
    const exceptionWindows = exceptions
      .filter(
        (exception) =>
          exception.isAvailable &&
          matchesService(exception.serviceId, selectedServiceId),
      )
      .flatMap((exception) => {
        const start = new Date(exception.startsAt);
        const end = new Date(exception.endsAt);

        if (!overlaps(date, nextDay, start, end)) return [];

        return [
          {
            end: end < nextDay ? end : nextDay,
            start: start > date ? start : date,
          },
        ];
      });
    const slots = uniqueSlots(
      [...ruleWindows, ...exceptionWindows]
        .flatMap((window) =>
          buildSlotsForWindow({
            bookings,
            date,
            durationWithBuffers,
            earliestStart,
            exceptions,
            now,
            selectedServiceId,
            serviceDurationMinutes,
            settings: resolvedSettings,
            window,
          }),
        )
        .sort(
          (left, right) =>
            new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
        ),
    );

    if (slots.length === 0) continue;

    days.push({
      date: formatDateKey(date),
      dateLabel: formatDateLabel(date),
      dayLabel: formatDayLabel(date, now),
      slots,
    });
  }

  return days;
}
