import { normalizeTimeZone } from "@/features/bookings/session-formatters";

export const MESSAGE_CENTER_DEFAULT_TIMEZONE = "America/Sao_Paulo";

export function normalizeMessageTimezone(timezone?: string | null) {
  return normalizeTimeZone(timezone ?? MESSAGE_CENTER_DEFAULT_TIMEZONE);
}

export function formatMessageTimestamp(
  value: string,
  timezone?: string | null,
) {
  const date = parseDate(value);
  if (!date) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: normalizeMessageTimezone(timezone),
  }).format(date);
}

export function formatMessageSessionContext(
  value: string,
  timezone?: string | null,
) {
  const date = parseDate(value);
  if (!date) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: normalizeMessageTimezone(timezone),
  }).format(date);
}

export function formatMessageRelativeTime(
  value: string | null | undefined,
  timezone?: string | null,
  now = new Date(),
) {
  const date = value ? parseDate(value) : null;
  if (!date) return "Sem data";

  const timeZone = normalizeMessageTimezone(timezone);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
  const difference =
    zonedDayNumber(now, timeZone) - zonedDayNumber(date, timeZone);

  if (difference === 0) return `Hoje · ${time}`;
  if (difference === 86_400_000) return `Ontem · ${time}`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone,
  }).format(date);
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function zonedDayNumber(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const dateParts = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return Date.UTC(
    Number(dateParts.year),
    Number(dateParts.month) - 1,
    Number(dateParts.day),
  );
}
