import Link from "next/link";
import { CalendarDays, CreditCard, Landmark, ReceiptText } from "lucide-react";

import type {
  TherapistFinanceDateRange,
  TherapistFinanceFilters,
  TherapistFinanceTab,
} from "../therapist-finance.types";
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
    <header className="grid gap-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-[40px] font-light italic leading-tight text-brand-deep sm:text-[52px]">
            Financeiro completo
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            Mais clareza para acompanhar o crescimento do seu cuidado.
          </p>
        </div>

        <form className="flex flex-col gap-2 sm:flex-row" method="get">
          <input name="tab" type="hidden" value={toFinanceTabQueryValue(tab)} />
          <label className="sr-only" htmlFor="finance-period">
            Período financeiro
          </label>
          <select
            className="min-h-11 min-w-[190px] rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
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

      <div className="border-b border-brand-lavender">
        <nav
          aria-label="Abas do financeiro"
          className="flex gap-1 overflow-x-auto pb-0"
        >
          {financeTabs.map((item) => {
            const active = item.value === tab;
            const Icon = tabIcons[item.value];

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex min-h-12 shrink-0 items-center justify-center gap-2 px-4 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
                  active
                    ? "text-brand-deep after:absolute after:inset-x-4 after:bottom-0 after:h-1 after:rounded-t-full after:bg-brand-primary"
                    : "text-tesText-secondary hover:text-brand-deep"
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
      </div>

    </header>
  );
}
