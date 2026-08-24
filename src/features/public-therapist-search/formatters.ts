import type { TherapistSearchAvailability } from "./types";

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

export function formatPriceLabel(cents: number) {
  return `${formatCurrency(cents)} / sessão`;
}

export function formatRatingLabel(rating: number) {
  return rating.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

export function formatReviewsLabel(count: number) {
  return `${count} ${count === 1 ? "avaliação" : "avaliações"}`;
}

export function formatDurationLabel(minutes: number) {
  return `${minutes} min`;
}

export function getAvailabilityBucket(
  nextSlotAt: string | null,
  timeZone?: string | null,
): TherapistSearchAvailability | "later" {
  if (!nextSlotAt) {
    return "later";
  }

  const now = new Date();
  const slot = new Date(nextSlotAt);

  if (timeZone) {
    const todayKey = formatDateKey(now, timeZone);
    const slotKey = formatDateKey(slot, timeZone);
    const days = differenceInCalendarDays(todayKey, slotKey);

    if (days <= 0) return "today";
    if (days === 1) return "tomorrow";
    if (days <= 7) return "week";
    return "later";
  }

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfSlot = new Date(slot);
  startOfSlot.setHours(0, 0, 0, 0);

  const days = Math.round(
    (startOfSlot.getTime() - startOfToday.getTime()) / 86_400_000,
  );

  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return "week";
  return "later";
}

export function formatNextSlotLabel(
  nextSlotAt: string | null,
  timeZone?: string | null,
) {
  if (!nextSlotAt) {
    return "Horários em breve";
  }

  const slot = new Date(nextSlotAt);
  const bucket = getAvailabilityBucket(nextSlotAt, timeZone);
  const time = slot.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });

  if (bucket === "today") return `Hoje, ${time}`;
  if (bucket === "tomorrow") return `Amanhã, ${time}`;

  const weekday = slot.toLocaleDateString("pt-BR", {
    ...(timeZone ? { timeZone } : {}),
    weekday: "short",
  });
  return `${weekday.replace(".", "")}, ${time}`;
}

function formatDateKey(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${read("year")}-${read("month")}-${read("day")}`;
}

function differenceInCalendarDays(first: string, second: string) {
  const firstDate = new Date(`${first}T12:00:00.000Z`);
  const secondDate = new Date(`${second}T12:00:00.000Z`);
  return Math.round(
    (secondDate.getTime() - firstDate.getTime()) / 86_400_000,
  );
}
