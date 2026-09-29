"use client";

import { useEffect, useState } from "react";

import {
  shiftIsoDateByCalendarYears,
  todayInSaoPaulo,
} from "../admin-finance-date-range";
import type {
  AdminFinanceListQuery,
  AdminFinancePeriod,
} from "../admin-finance.types";

const fieldClassName =
  "min-h-12 w-full rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20";

export function AdminFinancePeriodFields({
  options,
  query,
}: {
  options: Array<{ label: string; value: string }>;
  query: AdminFinanceListQuery;
}) {
  const [period, setPeriod] = useState(query.period ?? "30d");
  const [start, setStart] = useState(query.start ?? defaultStart());
  const [end, setEnd] = useState(query.end ?? todayInSaoPaulo());

  useEffect(() => {
    setPeriod(query.period ?? "30d");
    setStart(query.start ?? defaultStart());
    setEnd(query.end ?? todayInSaoPaulo());
  }, [query.end, query.period, query.start]);

  return (
    <>
      <label className="relative block">
        <span className="sr-only">Filtrar por período</span>
        <select
          className={fieldClassName}
          name="period"
          onChange={(event) =>
            setPeriod(event.target.value as AdminFinancePeriod)
          }
          value={period}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {period === "custom" ? (
        <>
          <label className="grid gap-1 text-sm font-extrabold text-brand-deep">
            De
            <input
              className={fieldClassName}
              max={end || todayInSaoPaulo()}
              min={earliestAllowedStart(end)}
              name="start"
              onChange={(event) => setStart(event.target.value)}
              required
              type="date"
              value={start}
            />
          </label>
          <label className="grid gap-1 text-sm font-extrabold text-brand-deep">
            Até
            <input
              className={fieldClassName}
              max={latestAllowedEnd(start)}
              min={start}
              name="end"
              onChange={(event) => setEnd(event.target.value)}
              required
              type="date"
              value={end}
            />
          </label>
          <p className="text-xs font-semibold leading-5 text-tesText-secondary sm:col-span-2">
            Escolha até um ano de histórico, encerrado hoje.
          </p>
        </>
      ) : null}
    </>
  );
}

function defaultStart() {
  const today = todayInSaoPaulo();
  const date = new Date(`${today}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 29);
  return date.toISOString().slice(0, 10);
}

function earliestAllowedStart(end: string) {
  return shiftIsoDateByCalendarYears(end || todayInSaoPaulo(), -1);
}

function latestAllowedEnd(start: string) {
  const today = todayInSaoPaulo();
  const latest = shiftIsoDateByCalendarYears(start || today, 1);

  return latest < today ? latest : today;
}
