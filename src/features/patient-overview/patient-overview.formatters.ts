import { normalizeTimeZone } from "@/features/bookings/session-formatters";

export function formatAppointmentDate(value: string, timezone: string) {
  const date = new Date(value);
  const timeZone = normalizeTimeZone(timezone);
  const difference = calendarDayDiff(
    formatDateKey(date, timeZone),
    formatDateKey(new Date(), timeZone),
  );

  if (difference === 0) return "Hoje";
  if (difference === 1) return "Amanhã";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    weekday: "long",
    timeZone,
  }).format(date);
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export function formatTimeRange(
  startsAt: string,
  endsAt: string,
  timezone: string,
) {
  const timeZone = normalizeTimeZone(timezone);
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });

  return `${formatter.format(new Date(startsAt))} - ${formatter.format(new Date(endsAt))}`;
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

function calendarDayDiff(targetKey: string, baseKey: string) {
  const toUtc = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0);
  };

  return Math.round((toUtc(targetKey) - toUtc(baseKey)) / 86_400_000);
}
