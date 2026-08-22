import {
  AlertTriangle,
  Banknote,
  CircleDollarSign,
  Clock3,
  CreditCard,
  RotateCcw,
  ShieldAlert,
  type LucideIcon,
  WalletCards,
} from "lucide-react";

import { AppPageSection } from "@/components/app-page";

import type {
  TherapistFinanceAdvancedAccess,
  TherapistFinanceAnalyticsAccess,
  TherapistFinancialOverview,
} from "../therapist-finance.types";
import { FinancialAdvancedDashboard } from "./financial-advanced-dashboard";
import { formatCurrency, formatDateTime } from "./financial-formatters";
import { FinancialSummaryMetrics } from "./financial-summary-metrics";

type SummaryCard = {
  description: string;
  icon: LucideIcon;
  label: string;
  value: number;
};

export function FinancialSummaryTab({
  advanced,
  analytics,
  overview,
}: {
  advanced: TherapistFinanceAdvancedAccess;
  analytics: TherapistFinanceAnalyticsAccess;
  overview: TherapistFinancialOverview;
}) {
  const receivable =
    overview.waitingConfirmationCents +
    overview.waitingSafetyPeriodCents +
    overview.eligibleForPayoutCents +
    overview.payoutProcessingCents;

  const cards: SummaryCard[] = [
    {
      description: "Valor líquido das sessões no período.",
      icon: CircleDollarSign,
      label: "Total líquido no período",
      value: overview.therapistNetCents,
    },
    {
      description: "Valores ainda em confirmação, segurança ou processamento.",
      icon: WalletCards,
      label: "A receber",
      value: receivable,
    },
    {
      description: "Sessões prontas para entrar no próximo repasse.",
      icon: Banknote,
      label: "Disponível para repasse",
      value: overview.eligibleForPayoutCents,
    },
    {
      description: "Valores já separados para repasse ou transferência.",
      icon: Clock3,
      label: "Em processamento",
      value: overview.payoutProcessingCents,
    },
    {
      description: "Transferências concluídas dentro do período.",
      icon: CreditCard,
      label: "Transferido no período",
      value: overview.transferredCents,
    },
  ];

  const conditionalCards: SummaryCard[] = [
    overview.blockedCents > 0
      ? {
          description: "Valores bloqueados por disputa, revisão ou conta.",
          icon: AlertTriangle,
          label: "Bloqueado",
          value: overview.blockedCents,
        }
      : null,
    overview.refundedToCustomersCents > 0
      ? {
          description: "Valores devolvidos ao cliente dentro do período.",
          icon: RotateCcw,
          label: "Reembolsado",
          value: overview.refundedToCustomersCents,
        }
      : null,
    overview.disputedCents > 0
      ? {
          description: "Pagamentos com disputa aberta ou registrada.",
          icon: ShieldAlert,
          label: "Disputado",
          value: overview.disputedCents,
        }
      : null,
  ].filter((card): card is SummaryCard => card !== null);

  return (
    <div className="grid gap-5">
      <section
        aria-label="Indicadores financeiros"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {[...cards, ...conditionalCards].map((card) => {
          const Icon = card.icon;

          return (
            <article
              className="rounded-card border border-brand-lavender bg-white p-5 shadow-card"
              key={card.label}
            >
              <span className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                <Icon aria-hidden="true" size={22} />
              </span>
              <h2 className="mt-4 text-base font-extrabold text-brand-deep">
                {card.label}
              </h2>
              <p className="mt-2 text-[26px] font-extrabold leading-tight text-brand-deep">
                {formatCurrency(card.value)}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                {card.description}
              </p>
            </article>
          );
        })}
      </section>

      <AppPageSection className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep">
            Composição do valor líquido
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            A composição usa os registros financeiros confirmados. As taxas da
            plataforma não aparecem como desconto do terapeuta.
          </p>
          <p className="mt-4 rounded-lg bg-brand-lavenderSoft/60 p-4 text-sm font-semibold leading-6 text-tesText-secondary">
            Dados atualizados em{" "}
            <span className="font-extrabold text-brand-deep">
              {formatDateTime(overview.generatedAt, overview.timezone)}
            </span>
            .
          </p>
        </div>

        <div className="grid gap-3 rounded-card border border-brand-lavender bg-surface-soft p-4">
          <FormulaRow
            label="Valor bruto das sessões"
            value={overview.grossPaidCents}
          />
          <FormulaRow
            label="Comissão TES"
            sign="-"
            value={overview.tesCommissionCents}
          />
          {overview.refundedToCustomersCents > 0 ? (
            <FormulaRow
              label="Reembolsos ao cliente"
              sign="-"
              value={overview.refundedToCustomersCents}
            />
          ) : null}
          <div className="h-px bg-brand-lavender" />
          <FormulaRow
            emphasis
            label="Valor líquido do terapeuta"
            value={overview.therapistNetCents}
          />
        </div>
      </AppPageSection>

      <FinancialSummaryMetrics analytics={analytics} />
      <FinancialAdvancedDashboard advanced={advanced} />
    </div>
  );
}

function FormulaRow({
  emphasis = false,
  label,
  sign,
  value,
}: {
  emphasis?: boolean;
  label: string;
  sign?: "-" | "+";
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={
          emphasis
            ? "text-base font-extrabold text-brand-deep"
            : "text-sm font-bold text-tesText-secondary"
        }
      >
        {label}
      </span>
      <span
        className={
          emphasis
            ? "text-xl font-extrabold text-brand-deep"
            : "text-sm font-extrabold text-brand-deep"
        }
      >
        {sign ? `${sign} ` : ""}
        {formatCurrency(Math.abs(value))}
      </span>
    </div>
  );
}
