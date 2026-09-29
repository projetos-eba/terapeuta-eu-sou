import type { AdminFinancePeriod } from "./admin-finance.types";

export type AdminFinanceDateRange = {
  end?: string;
  period: AdminFinancePeriod;
  start?: string;
};

export function resolveAdminFinanceDateRange(
  periodValue: string | undefined,
  startValue?: string,
  endValue?: string,
  today = todayInSaoPaulo(),
): AdminFinanceDateRange {
  if (
    periodValue === "custom" &&
    isIsoDate(startValue) &&
    isIsoDate(endValue) &&
    startValue <= endValue &&
    endValue <= today &&
    isWithinOneCalendarYear(startValue, endValue)
  ) {
    return { end: endValue, period: "custom", start: startValue };
  }

  return {
    period:
      periodValue === "7d" || periodValue === "90d" ? periodValue : "30d",
  };
}

export function todayInSaoPaulo() {
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

function isIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return (
    new Date(`${value}T12:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

function isWithinOneCalendarYear(start: string, end: string) {
  return end <= shiftIsoDateByCalendarYears(start, 1);
}

export function shiftIsoDateByCalendarYears(value: string, years: number) {
  const [year, month, day] = value.split("-").map(Number);
  const targetYear = year + years;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, month, 0),
  ).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);

  return `${targetYear.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${targetDay.toString().padStart(2, "0")}`;
}
