export const RESERVATION_WINDOW_DAYS = 5;

export function addAvailabilityDateKeyDays(dateKey: string, days: number) {
  const date = parseAvailabilityDateKey(dateKey);
  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function availabilityDateKeyStart(dateKey: string, timezone: string) {
  const calendarDate = parseAvailabilityDateKey(dateKey);
  if (!calendarDate) return null;

  const targetTimestamp = Date.UTC(
    calendarDate.getUTCFullYear(),
    calendarDate.getUTCMonth(),
    calendarDate.getUTCDate(),
  );
  let instant = new Date(targetTimestamp + 12 * 60 * 60 * 1_000);

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: timezone,
      year: "numeric",
    }).formatToParts(instant);
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);
    const representedTimestamp = Date.UTC(
      read("year"),
      read("month") - 1,
      read("day"),
      read("hour"),
      read("minute"),
      read("second"),
    );
    if (!Number.isFinite(representedTimestamp)) return null;

    const correction = targetTimestamp - representedTimestamp;
    instant = new Date(instant.getTime() + correction);
    if (correction === 0) break;
  }

  return instant;
}

export function formatAvailabilityDateKey(value: Date, timezone: string) {
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

export function getReservationWindowDateKeys(startDate: string) {
  if (!isAvailabilityDateKey(startDate)) return [];

  return Array.from({ length: RESERVATION_WINDOW_DAYS }, (_, index) =>
    addAvailabilityDateKeyDays(startDate, index),
  ).filter((date): date is string => Boolean(date));
}

export function isAvailabilityDateKey(value: string) {
  return parseAvailabilityDateKey(value) !== null;
}

export function parseAvailabilityDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : null;
}
