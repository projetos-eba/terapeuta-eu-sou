import { normalizeTimeZone } from "./session-formatters";

export function formatBookingMetricDate(value: string, timezone: string) {
  const date = new Date(value);
  const formatOptions = { timeZone: normalizeTimeZone(timezone) };
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    ...formatOptions,
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replace(".", "")
    .replace(" de ", " ");
  const timeLabel = new Intl.DateTimeFormat("pt-BR", {
    ...formatOptions,
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(":00", "h");

  return `${dateLabel} · ${timeLabel}`;
}

export function formatBookingDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: normalizeTimeZone(timezone),
  })
    .format(new Date(value))
    .replace(".", "");
}

export function formatBookingSchedule(value: string, timezone: string) {
  const date = new Date(value);
  const timeZone = normalizeTimeZone(timezone);
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "short",
  })
    .format(date)
    .replace(".", "");
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);

  return `${capitalize(weekday)}, ${time}`;
}

export function formatRelativeBookingDay(value: string, timezone: string) {
  const timeZone = normalizeTimeZone(timezone);
  const targetKey = formatDateKey(value, timeZone);
  const todayKey = formatDateKey(new Date().toISOString(), timeZone);
  const diffInDays = calendarDayDiff(targetKey, todayKey);

  if (diffInDays === 0) return "Hoje";
  if (diffInDays === 1) return "Amanhã";

  return capitalize(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      weekday: "short",
    })
      .format(new Date(value))
      .replace(".", ""),
  );
}

function formatDateKey(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(new Date(value));
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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
