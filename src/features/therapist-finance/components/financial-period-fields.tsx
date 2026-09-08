"use client";

import { useEffect, useState } from "react";

import type {
  TherapistFinanceDateRange,
  TherapistFinancePeriodKey,
} from "../therapist-finance.types";

const fieldClassName =
  "min-h-11 w-full min-w-0 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary";

export function FinancialPeriodFields({
  dateRange,
  label = "Período",
  labelClassName = "text-sm",
}: {
  dateRange: TherapistFinanceDateRange;
  label?: string;
  labelClassName?: string;
}) {
  const [period, setPeriod] = useState<TherapistFinancePeriodKey>(
    dateRange.key,
  );
  const [start, setStart] = useState(dateRange.start);
  const [end, setEnd] = useState(dateRange.end);

  useEffect(() => {
    setPeriod(dateRange.key);
    setStart(dateRange.start);
    setEnd(dateRange.end);
  }, [dateRange.end, dateRange.key, dateRange.start]);

  return (
    <>
      <label
        className={`grid min-w-0 gap-1 font-extrabold text-brand-deep ${labelClassName}`}
      >
        {label}
        <select
          className={fieldClassName}
          name="period"
          onChange={(event) =>
            setPeriod(event.target.value as TherapistFinancePeriodKey)
          }
          value={period}
        >
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="month">Mês atual</option>
          <option value="custom">Período personalizado</option>
        </select>
      </label>
      {period === "custom" ? (
        <>
          <label
            className={`grid min-w-0 gap-1 font-extrabold text-brand-deep ${labelClassName}`}
          >
            De
            <input
              className={fieldClassName}
              name="start"
              onChange={(event) => setStart(event.target.value)}
              required
              type="date"
              value={start}
            />
          </label>
          <label
            className={`grid min-w-0 gap-1 font-extrabold text-brand-deep ${labelClassName}`}
          >
            Até
            <input
              className={fieldClassName}
              name="end"
              onChange={(event) => setEnd(event.target.value)}
              required
              type="date"
              value={end}
            />
          </label>
        </>
      ) : null}
    </>
  );
}
