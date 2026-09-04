import type { TherapistFinanceDateRange } from "../therapist-finance.types";
import { FinancialPeriodFields } from "./financial-period-fields";
import { toFinanceTabQueryValue } from "./financial-route";

export function FinancialPeriodFilter({
  dateRange,
}: {
  dateRange: TherapistFinanceDateRange;
}) {
  return (
    <form
      className="flex w-full min-w-0 flex-wrap items-end gap-2 sm:w-auto sm:[&>label]:w-[150px] sm:[&>label:first-of-type]:w-[190px] lg:shrink-0"
      method="get"
    >
      <input
        name="tab"
        type="hidden"
        value={toFinanceTabQueryValue("summary")}
      />
      <FinancialPeriodFields dateRange={dateRange} labelClassName="text-xs" />
      <button
        className="inline-flex min-h-11 w-full items-center justify-center self-end rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto"
        type="submit"
      >
        Atualizar
      </button>
    </form>
  );
}
