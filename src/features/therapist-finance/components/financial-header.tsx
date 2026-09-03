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
    <header className="grid min-w-0 gap-4 sm:gap-5">
      <div className="grid min-w-0 gap-4 lg:flex lg:items-start lg:justify-between lg:gap-5">
        <div className="min-w-0 max-w-full">
          <h1 className="max-w-full break-words font-display text-[36px] font-light italic leading-[1.05] text-brand-deep sm:text-[52px]">
            Financeiro completo
          </h1>
          <p className="mt-2 max-w-[38rem] text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            Mais clareza para acompanhar o crescimento do seu cuidado.
          </p>
        </div>

        {tab === "summary" ? (
          <form
            className="grid min-w-0 w-full gap-2 sm:flex sm:w-auto lg:shrink-0"
            method="get"
          >
            <input
              name="tab"
              type="hidden"
              value={toFinanceTabQueryValue(tab)}
            />
            <label className="sr-only" htmlFor="finance-period">
              Período financeiro
            </label>
            <select
              className="min-h-11 w-full min-w-0 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary sm:w-auto sm:min-w-[190px]"
              defaultValue={dateRange.key}
              id="finance-period"
              name="period"
            >
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="month">Mês atual</option>
            </select>
            <button
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto"
              type="submit"
            >
              Atualizar
            </button>
          </form>
        ) : null}
      </div>

      <div className="min-w-0 border-b border-brand-lavender">
        <nav
          aria-label="Abas do financeiro"
          className="-mx-1 flex min-w-0 max-w-full gap-1 overflow-x-auto px-1 pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
