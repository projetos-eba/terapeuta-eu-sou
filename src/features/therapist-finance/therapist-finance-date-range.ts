import type { TherapistFinanceDateRange } from "./therapist-finance.types";

export function resolveTherapistFinanceDateRange(
  value: string | undefined,
  customStart?: string,
  customEnd?: string,
  today = todayInSaoPaulo(),
): TherapistFinanceDateRange {
  if (
    value === "custom" &&
    isIsoDate(customStart) &&
    isIsoDate(customEnd) &&
    customStart <= customEnd &&
    daysBetween(customStart, customEnd) <= 366
  ) {
    return { end: customEnd, key: "custom", start: customStart };
  }

  const key = value === "90" || value === "month" ? value : "30";

  if (key === "month") {
    return {
      end: endOfMonth(today),
      key,
      start: `${today.slice(0, 8)}01`,
    };
  }

  return {
    end: today,
    key,
    start: addDays(today, key === "90" ? -89 : -29),
  };
}

function endOfMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return (
    new Date(`${value}T12:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

function daysBetween(start: string, end: string) {
  return Math.floor(
    (Date.parse(`${end}T12:00:00.000Z`) -
      Date.parse(`${start}T12:00:00.000Z`)) /
      86_400_000,
  );
}

function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "01";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
