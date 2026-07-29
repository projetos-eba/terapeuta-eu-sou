import Link from "next/link";
import { CalendarDays, CreditCard, Landmark, ReceiptText } from "lucide-react";

import { AppPageSection } from "@/components/app-page";

import type {
  TherapistFinanceDateRange,
  TherapistFinanceFilters,
  TherapistFinanceTab,
} from "../therapist-finance.types";
import { formatPeriodLabel } from "./financial-formatters";
import {
  buildFinanceHref,
  financeTabs,
  toFinanceTabQueryValue,
} from "./financial-route";

const tabIcons = {
  account: Landmark,
  payouts: CreditCard,
  receipts: ReceiptText,
  summary: CalendarDays,
};

export function FinancialHeader({
  dateRange,
  filters,
  tab,
}: {
  dateRange: TherapistFinanceDateRange;
  filters: TherapistFinanceFilters;
  tab: TherapistFinanceTab;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-brand-lavender bg-white shadow-card">
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:p-8">
        <div>
          <h1 className="font-display text-[38px] font-light italic leading-tight text-brand-deep sm:text-[52px]">
            Financeiro completo
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            Acompanhe recebimentos, repasses e a conexão da sua conta de
            recebimento com clareza operacional.
          </p>
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row lg:items-start"
          method="get"
        >
          <input name="tab" type="hidden" value={toFinanceTabQueryValue(tab)} />
          <label className="sr-only" htmlFor="finance-period">
            Período financeiro
          </label>
          <select
            className="min-h-11 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            defaultValue={dateRange.key}
            id="finance-period"
            name="period"
          >
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="month">Mês atual</option>
          </select>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            type="submit"
          >
            Atualizar
          </button>
        </form>
      </div>

      <AppPageSection className="rounded-none border-x-0 border-b-0 shadow-none">
        <div className="flex flex-col gap-4">
          <nav
            aria-label="Abas do financeiro"
            className="flex gap-1 overflow-x-auto pb-1"
          >
            {financeTabs.map((item) => {
              const active = item.value === tab;
              const Icon = tabIcons[item.value];

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
                    active
                      ? "bg-brand-lavenderSoft text-brand-deep after:absolute after:inset-x-4 after:bottom-0 after:h-1 after:rounded-full after:bg-brand-primary"
                      : "text-tesText-secondary hover:bg-brand-lavenderSoft"
                  }`}
                  href={buildFinanceHref({
                    filters,
                    period: dateRange.key,
                    tab: item.value,
                  })}
                  key={item.value}
                >
                  <Icon aria-hidden="true" size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="rounded-lg bg-brand-lavenderSoft/60 px-4 py-3 text-sm font-semibold leading-6 text-tesText-secondary">
            Período consultado:{" "}
            <span className="font-extrabold text-brand-deep">
              {formatPeriodLabel(dateRange.start, dateRange.end)}
            </span>
          </div>
        </div>
      </AppPageSection>
    </section>
  );
}
