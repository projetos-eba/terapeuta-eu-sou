const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatBookingMetricDate(value: string) {
  const date = new Date(value);
  const dateLabel = shortDateFormatter
    .format(date)
    .replace(".", "")
    .replace(" de ", " ");
  const timeLabel = timeFormatter.format(date).replace(":00", "h");

  return `${dateLabel} · ${timeLabel}`;
}

export function formatBookingDate(value: string) {
  return shortDateFormatter.format(new Date(value)).replace(".", "");
}

export function formatBookingSchedule(value: string) {
  const date = new Date(value);
  const weekday = weekdayFormatter.format(date).replace(".", "");

  return `${capitalize(weekday)}, ${timeFormatter.format(date)}`;
}

export function formatRelativeBookingDay(value: string) {
  const target = startOfDay(new Date(value));
  const today = startOfDay(new Date());
  const diffInDays = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  );

  if (diffInDays === 0) return "Hoje";
  if (diffInDays === 1) return "Amanhã";

  return capitalize(weekdayFormatter.format(target).replace(".", ""));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
