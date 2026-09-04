"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import type {
  TherapistFinanceDateRange,
  TherapistFinancePeriodKey,
} from "../therapist-finance.types";
import { toFinanceTabQueryValue } from "./financial-route";

export function FinancialPeriodFilter({
  dateRange,
}: {
  dateRange: TherapistFinanceDateRange;
}) {
  const [period, setPeriod] = useState<TherapistFinancePeriodKey>(
    dateRange.key,
  );
  const custom = period === "custom";

  return (
    <form
      className={cn(
        "grid min-w-0 w-full gap-2 sm:w-auto lg:shrink-0",
        custom
          ? "sm:grid-cols-2 lg:grid-cols-[190px_150px_150px_auto]"
          : "sm:grid-cols-[190px_auto]",
      )}
      method="get"
    >
      <input
        name="tab"
        type="hidden"
        value={toFinanceTabQueryValue("summary")}
      />
      <label className="grid gap-1 text-xs font-extrabold text-brand-deep">
        Período
        <select
          className="min-h-11 w-full min-w-0 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary sm:min-w-[190px]"
          name="period"
          onChange={(event) =>
            setPeriod(event.target.value as TherapistFinancePeriodKey)
          }
          value={period}
        >
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="month">Mês atual</option>
          <option value="custom">Personalizado</option>
        </select>
      </label>
      {custom ? (
        <>
          <label className="grid gap-1 text-xs font-extrabold text-brand-deep">
            De
            <input
              className="min-h-11 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              defaultValue={dateRange.start}
              name="start"
              required
              type="date"
            />
          </label>
          <label className="grid gap-1 text-xs font-extrabold text-brand-deep">
            Até
            <input
              className="min-h-11 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              defaultValue={dateRange.end}
              name="end"
              required
              type="date"
            />
          </label>
        </>
      ) : null}
      <button
        className="inline-flex min-h-11 w-full items-center justify-center self-end rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto"
        type="submit"
      >
        Atualizar
      </button>
    </form>
  );
}
