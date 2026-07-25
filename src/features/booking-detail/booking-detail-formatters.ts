const fullDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  weekday: "long",
});

const monthYearFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatSessionDate(value: string) {
  return capitalize(fullDateFormatter.format(new Date(value)).replace(".", ""));
}

export function formatSessionTimeRange(startsAt: string, endsAt: string) {
  return `${timeFormatter.format(new Date(startsAt))} - ${timeFormatter.format(
    new Date(endsAt),
  )}`;
}

export function formatSessionDuration(startsAt: string, endsAt: string) {
  const minutes = Math.max(
    0,
    Math.round(
      (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000,
    ),
  );

  if (minutes === 60) return "1h de duração";
  if (minutes < 60) return `${minutes} min de duração`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes
    ? `${hours}h${remainingMinutes} de duração`
    : `${hours}h de duração`;
}

export function formatJourneyStartedAt(value: string | null) {
  if (!value) return "Em andamento";

  const formatted = monthYearFormatter.format(new Date(value));

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function getMinutesUntilStart(startsAt: string) {
  const diff = Math.ceil((new Date(startsAt).getTime() - Date.now()) / 60_000);

  return diff > 0 ? diff : null;
}

export function formatCurrencyFromCents(
  amountCents: number | null,
  currency: string,
) {
  if (amountCents === null) return null;

  return new Intl.NumberFormat("pt-BR", {
    currency,
    style: "currency",
  }).format(amountCents / 100);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
