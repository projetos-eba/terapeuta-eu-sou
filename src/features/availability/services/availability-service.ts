import type {
  AvailabilityDay,
  AvailabilitySlot,
} from "@/features/therapist-profile/types";
import { DomainErrorCode, TesDomainError } from "@/domain/tes";

export type AvailabilityRuleInput = {
  dayOfWeek: number;
  endTime: string;
  isActive: boolean;
  serviceId: string;
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

const blockedStatuses = new Set(["draft", "pending_payment", "confirmed"]);
const DEFAULT_TIMEZONE = "America/Sao_Paulo";

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

type DateParts = {
  day: number;
  month: number;
  year: number;
};

function getDateParts(value: Date, timezone: string): DateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return { day: read("day"), month: read("month"), year: read("year") };
}

function zonedDateTimeToInstant(
  dateKey: string,
  time: string,
  timezone: string,
) {
  const wallClock = new Date(`${dateKey}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(wallClock);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const offset =
    Date.UTC(
      read("year"),
      read("month") - 1,
      read("day"),
      read("hour") % 24,
      read("minute"),
      read("second"),
    ) - wallClock.getTime();

  return new Date(wallClock.getTime() - offset);
}

function addCalendarDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function calendarDayDifference(targetKey: string, baseKey: string) {
  const toUtc = (key: string) => Date.parse(`${key}T00:00:00Z`);
  return Math.round((toUtc(targetKey) - toUtc(baseKey)) / 86_400_000);
}

function getDayOfWeek(date: Date, timezone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  })
    .format(date)
    .slice(0, 3)
    .toLowerCase();
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(weekday);
}

function formatDateKey(date: Date, timezone: string) {
  const parts = getDateParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function parseClock(date: Date, time: string, timezone: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  const dateKey = formatDateKey(date, timezone);
  return zonedDateTimeToInstant(
    dateKey,
    `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`,
    timezone,
  );
}

function isValidClock(value: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return false;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function overlaps(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function formatDayLabel(date: Date, now: Date, timezone: string) {
  const todayKey = formatDateKey(now, timezone);
  const targetKey = formatDateKey(date, timezone);
  const days = calendarDayDifference(targetKey, todayKey);

  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";

  return date
    .toLocaleDateString("pt-BR", {
      timeZone: timezone,
      weekday: "short",
    })
    .replace(".", "");
}

function formatDateLabel(date: Date, timezone: string) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
  });
}

function formatTimeLabel(date: Date, timezone: string) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function matchesExceptionService(
  serviceId: string | null,
  selectedServiceId: string,
) {
  return !serviceId || serviceId === selectedServiceId;
}

function getDayBounds(now: Date, dayOffset: number, timezone: string) {
  const dateKey = addCalendarDays(formatDateKey(now, timezone), dayOffset);
  const nextDateKey = addCalendarDays(dateKey, 1);

  return {
    end: zonedDateTimeToInstant(nextDateKey, "00:00", timezone),
    start: zonedDateTimeToInstant(dateKey, "00:00", timezone),
  };
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
  earliestStart,
  exceptions,
  now,
  selectedServiceId,
  serviceDurationMinutes,
  settings,
  timezone,
  window,
}: {
  bookings: BookingConflictInput[];
  date: Date;
  earliestStart: Date;
  exceptions: AvailabilityExceptionInput[];
  now: Date;
  selectedServiceId: string;
  serviceDurationMinutes: number;
  settings: BookingSettingsInput;
  window: AvailabilityWindow;
  timezone: string;
}) {
  const slots: AvailabilitySlot[] = [];

  for (
    let cursor = new Date(window.start);
    cursor.getTime() +
      (serviceDurationMinutes + settings.bufferAfterMinutes) * 60_000 <=
    window.end.getTime();
    cursor = new Date(cursor.getTime() + settings.intervalMinutes * 60_000)
  ) {
    const startsAt = new Date(cursor);
    const endsAt = new Date(
      startsAt.getTime() + serviceDurationMinutes * 60_000,
    );
    const occupiedStartsAt = new Date(
      startsAt.getTime() - settings.bufferBeforeMinutes * 60_000,
    );
    const occupiedEndsAt = new Date(
      endsAt.getTime() + settings.bufferAfterMinutes * 60_000,
    );

    if (startsAt < earliestStart) continue;

    const blockedByException = exceptions.some((exception) => {
      if (exception.isAvailable) return false;
      if (!matchesExceptionService(exception.serviceId, selectedServiceId)) {
        return false;
      }

      return overlaps(
        occupiedStartsAt,
        occupiedEndsAt,
        new Date(exception.startsAt),
        new Date(exception.endsAt),
      );
    });

    if (blockedByException) continue;

    const blockedByBooking = bookings.some((booking) => {
      if (!blockedStatuses.has(booking.status)) return false;

      return overlaps(
        occupiedStartsAt,
        occupiedEndsAt,
        new Date(booking.startsAt),
        new Date(booking.endsAt),
      );
    });

    if (blockedByBooking) continue;

    slots.push({
      dateLabel: formatDateLabel(date, timezone),
      dayLabel: formatDayLabel(date, now, timezone),
      endsAt: endsAt.toISOString(),
      serviceId: selectedServiceId,
      startsAt: startsAt.toISOString(),
      timeLabel: formatTimeLabel(startsAt, timezone),
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
  validateAvailabilityInput({
    bookings,
    exceptions,
    rules,
    serviceDurationMinutes,
    settings: resolvedSettings,
  });
  const horizonDays = Math.max(1, resolvedSettings.maxDaysAhead);
  const earliestStart = new Date(
    now.getTime() + resolvedSettings.minNoticeMinutes * 60_000,
  );
  const timezone =
    rules.find((rule) => rule.serviceId === selectedServiceId)?.timezone ??
    DEFAULT_TIMEZONE;
  const days: AvailabilityDay[] = [];

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
    const { end: nextDay, start: date } = getDayBounds(
      now,
      dayOffset,
      timezone,
    );

    const matchingRules = rules.filter(
      (rule) =>
        rule.isActive &&
        rule.dayOfWeek === getDayOfWeek(date, rule.timezone) &&
        rule.serviceId === selectedServiceId,
    );
    const ruleWindows = matchingRules.map((rule) => ({
      end: parseClock(date, rule.endTime, rule.timezone),
      start: parseClock(date, rule.startTime, rule.timezone),
    }));
    const exceptionWindows = exceptions
      .filter(
        (exception) =>
          exception.isAvailable &&
          matchesExceptionService(exception.serviceId, selectedServiceId),
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
            earliestStart,
            exceptions,
            now,
            selectedServiceId,
            serviceDurationMinutes,
            settings: resolvedSettings,
            timezone,
            window,
          }),
        )
        .sort(
          (left, right) =>
            new Date(left.startsAt).getTime() -
            new Date(right.startsAt).getTime(),
        ),
    );

    if (slots.length === 0) continue;

    days.push({
      date: formatDateKey(date, timezone),
      dateLabel: formatDateLabel(date, timezone),
      dayLabel: formatDayLabel(date, now, timezone),
      slots,
    });
  }

  return days;
}

function validateAvailabilityInput({
  bookings,
  exceptions,
  rules,
  serviceDurationMinutes,
  settings,
}: {
  bookings: BookingConflictInput[];
  exceptions: AvailabilityExceptionInput[];
  rules: AvailabilityRuleInput[];
  serviceDurationMinutes: number;
  settings: BookingSettingsInput;
}) {
  const hasInvalidSettings =
    !Number.isFinite(serviceDurationMinutes) ||
    serviceDurationMinutes <= 0 ||
    !Number.isFinite(settings.intervalMinutes) ||
    settings.intervalMinutes <= 0 ||
    !Number.isFinite(settings.maxDaysAhead) ||
    settings.maxDaysAhead < 1 ||
    !Number.isFinite(settings.minNoticeMinutes) ||
    settings.minNoticeMinutes < 0 ||
    !Number.isFinite(settings.bufferBeforeMinutes) ||
    settings.bufferBeforeMinutes < 0 ||
    !Number.isFinite(settings.bufferAfterMinutes) ||
    settings.bufferAfterMinutes < 0;

  const hasInvalidRule = rules.some((rule) => {
    if (
      rule.dayOfWeek < 0 ||
      rule.dayOfWeek > 6 ||
      !isValidClock(rule.startTime) ||
      !isValidClock(rule.endTime)
    ) {
      return true;
    }

    const anchor = new Date(2026, 0, 4);
    return (
      parseClock(anchor, rule.startTime, rule.timezone) >=
      parseClock(anchor, rule.endTime, rule.timezone)
    );
  });
  const hasInvalidException = exceptions.some(
    (exception) =>
      !Number.isFinite(new Date(exception.startsAt).getTime()) ||
      !Number.isFinite(new Date(exception.endsAt).getTime()) ||
      new Date(exception.startsAt) >= new Date(exception.endsAt),
  );
  const hasInvalidBooking = bookings.some(
    (booking) =>
      !Number.isFinite(new Date(booking.startsAt).getTime()) ||
      !Number.isFinite(new Date(booking.endsAt).getTime()) ||
      new Date(booking.startsAt) >= new Date(booking.endsAt),
  );

  if (
    hasInvalidSettings ||
    hasInvalidRule ||
    hasInvalidException ||
    hasInvalidBooking
  ) {
    throw new TesDomainError(
      DomainErrorCode.InvalidAvailabilityRange,
      "Availability preview received an invalid range or numeric setting.",
    );
  }

  const relevantRules = rules.filter(
    (rule) => rule.isActive && rule.serviceId === settings.serviceId,
  );
  const hasOverlappingRule = relevantRules.some((rule, index) => {
    const anchor = new Date(2026, 0, 4);
    const start = parseClock(anchor, rule.startTime, rule.timezone);
    const end = parseClock(anchor, rule.endTime, rule.timezone);

    return relevantRules.slice(index + 1).some((candidate) => {
      if (candidate.dayOfWeek !== rule.dayOfWeek) return false;

      return overlaps(
        start,
        end,
        parseClock(anchor, candidate.startTime, candidate.timezone),
        parseClock(anchor, candidate.endTime, candidate.timezone),
      );
    });
  });

  if (hasOverlappingRule) {
    throw new TesDomainError(
      DomainErrorCode.OverlappingAvailabilityRule,
      "Availability preview received overlapping active rules.",
    );
  }
}
