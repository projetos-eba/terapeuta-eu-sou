import Link from "next/link";
import { AlertCircle, Info } from "lucide-react";

import { AppPageContainer, AppPageSection } from "@/components/app-page";
import { routes } from "@/lib/routes";

import type {
  TherapistFinanceDateRange,
  TherapistFinanceFilters,
  TherapistFinancePageData,
  TherapistFinanceTab,
} from "../therapist-finance.types";
import { FinancialConnectAccountTab } from "./financial-connect-account-tab";
import { FinancialHeader } from "./financial-header";
import { FinancialPayoutsTab } from "./financial-payouts-tab";
import { FinancialReceiptsTab } from "./financial-receipts-tab";
import { FinancialSummaryTab } from "./financial-summary-tab";

export function TherapistFinancePage({
  connectNotice,
  data,
  dateRange,
  filters,
  tab,
}: {
  connectNotice?: "refresh" | "return";
  data: TherapistFinancePageData;
  dateRange: TherapistFinanceDateRange;
  filters: TherapistFinanceFilters;
  tab: TherapistFinanceTab;
}) {
  return (
    <AppPageContainer className="gap-5">
      <FinancialHeader dateRange={dateRange} filters={filters} tab={tab} />

      {connectNotice ? <ConnectReturnNotice notice={connectNotice} /> : null}

      {tab === "receipts" ? (
        <FinancialReceiptsTab
          dateRange={dateRange}
          filters={filters}
          overview={data.overview}
          receipts={data.receipts}
        />
      ) : null}

      {tab === "payouts" ? (
        <FinancialPayoutsTab
          dateRange={dateRange}
          filters={filters}
          payouts={data.payouts}
        />
      ) : null}

      {tab === "account" ? (
        <FinancialConnectAccountTab account={data.account} />
      ) : null}

      {tab === "summary" ? (
        <FinancialSummaryTab
          advanced={data.advanced}
          analytics={data.analytics}
          overview={data.overview}
        />
      ) : null}
    </AppPageContainer>
  );
}

export function TherapistFinanceErrorState({ message }: { message: string }) {
  return (
    <AppPageContainer>
      <AppPageSection className="grid gap-5">
        <span className="grid size-12 place-items-center rounded-full bg-status-dangerBg text-status-danger">
          <AlertCircle aria-hidden="true" size={24} />
        </span>
        <div>
          <h1 className="font-display text-[34px] font-light italic leading-tight text-brand-deep sm:text-[46px]">
            Financeiro indisponível
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            {message}
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.therapist.finance}
        >
          Tentar novamente
        </Link>
      </AppPageSection>
    </AppPageContainer>
  );
}

function ConnectReturnNotice({ notice }: { notice: "refresh" | "return" }) {
  return (
    <AppPageSection className="flex items-start gap-3 bg-brand-lavenderSoft/60">
      <Info
        aria-hidden="true"
        className="mt-1 shrink-0 text-brand-primary"
        size={20}
      />
      <div>
        <h2 className="text-base font-extrabold text-brand-deep">
          {notice === "refresh"
            ? "Link de recebimento expirado"
            : "Retorno da conta recebido"}
        </h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          {notice === "refresh"
            ? "Gere um novo link para continuar o cadastro da conta de recebimento."
            : "O retorno não confirma a conta automaticamente. Sincronize o status para buscar a atualização mais recente."}
        </p>
      </div>
    </AppPageSection>
  );
}
