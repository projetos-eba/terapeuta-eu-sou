import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Send,
  type LucideIcon,
} from "lucide-react";

import { AppPageSection } from "@/components/app-page";
import { PendingNavigationLink } from "@/components/tes/pending-navigation-link";

import type {
  TherapistFinanceDateRange,
  TherapistFinanceFilters,
  TherapistPayoutAgendaGroup,
  TherapistPayoutCompositionItem,
  TherapistPayoutHistoryItem,
  TherapistPayoutsContract,
} from "../therapist-finance.types";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from "./financial-formatters";
import { buildFinanceHref } from "./financial-route";
import { FinancialPeriodFields } from "./financial-period-fields";

export function FinancialPayoutsTab({
  dateRange,
  filters,
  payouts,
}: {
  dateRange: TherapistFinanceDateRange;
  filters: TherapistFinanceFilters;
  payouts: TherapistPayoutsContract;
}) {
  const futurePayouts = [
    ...payouts.agenda.predicted,
    ...payouts.agenda.balanceAvailable,
    ...payouts.agenda.awaitingBankDate,
  ].sort(compareAgendaDates);
  const hasUpcomingPayouts =
    payouts.agenda.inTransit.length > 0 || futurePayouts.length > 0;

  return (
    <div className="grid min-w-0 gap-5 [&>*]:min-w-0">
      <section
        aria-label="Resumo dos repasses"
        className="grid gap-3 md:grid-cols-3"
      >
        <PayoutMetricCard
          description="Valores previstos para os próximos dias."
          icon={CalendarDays}
          label="A receber"
          value={payouts.summary.expectedCents}
        />
        <PayoutMetricCard
          description="Valor em processo de chegada à sua conta."
          icon={Send}
          label="A caminho da sua conta"
          value={payouts.summary.inTransitCents}
        />
        <PayoutMetricCard
          description="Valores que já chegaram à sua conta."
          icon={CheckCircle2}
          label="Recebido no período"
          value={payouts.summary.receivedCents}
        />
      </section>

      <AppPageSection className="grid gap-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[34px]">
              Próximos repasses
            </h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
              Veja o que está mais perto de chegar à sua conta.
            </p>
          </div>
          <nav
            aria-label="Período dos próximos repasses"
            className="grid w-full grid-cols-3 overflow-hidden rounded-lg border border-brand-lavender sm:w-auto"
          >
            {([7, 15, 30] as const).map((days) => (
              <Link
                aria-current={payouts.agenda.days === days ? "page" : undefined}
                className={`inline-flex min-h-11 items-center justify-center px-3 text-sm font-extrabold transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary ${
                  payouts.agenda.days === days
                    ? "bg-brand-primary text-white"
                    : "bg-white text-brand-primary hover:bg-brand-lavenderSoft"
                }`}
                href={agendaHref(days, dateRange)}
                key={days}
              >
                {days} dias
              </Link>
            ))}
          </nav>
        </div>

        {hasUpcomingPayouts ? (
          <div className="grid gap-6">
            <AgendaGroup
              items={payouts.agenda.inTransit}
              label="A caminho da sua conta"
              timezone={payouts.filters.timezone}
              tone="in_transit"
            />
            <AgendaGroup
              items={futurePayouts}
              label="Próximos previstos"
              timezone={payouts.filters.timezone}
              tone="predicted"
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-brand-lavender bg-brand-lavenderSoft/50 p-5">
            <h3 className="text-lg font-extrabold text-brand-deep">
              Ainda não há repasses previstos
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              Quando houver valores para acompanhar, eles aparecerão aqui.
            </p>
          </div>
        )}

        <p className="border-t border-brand-lavender pt-4 text-sm font-semibold text-tesText-secondary">
          As datas previstas podem mudar.
        </p>
      </AppPageSection>

      <AppPageSection className="grid gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-[28px] font-light italic leading-tight text-brand-deep sm:text-[32px]">
              Histórico de repasses
            </h2>
            <p className="mt-1 text-sm font-semibold text-tesText-secondary">
              Valores que já chegaram à sua conta no período selecionado.
            </p>
          </div>
          <p className="text-sm font-bold text-tesText-secondary">
            {payouts.pagination.totalCount} registro(s)
          </p>
        </div>

        <form className="grid min-w-0 gap-3 border-y border-brand-lavender py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" method="get">
          <input name="tab" type="hidden" value="repasses" />
          <input name="agendaDays" type="hidden" value={filters.agendaDays} />
          <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:max-w-[720px]">
            <FinancialPeriodFields
              dateRange={dateRange}
              label="Período do histórico"
            />
          </div>
          <button
            className="inline-flex min-h-11 w-full items-center justify-center justify-self-start rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto"
            type="submit"
          >
            Consultar período
          </button>
        </form>

        {payouts.historyItems.length ? (
          <div className="divide-y divide-brand-lavender">
            {payouts.historyItems.map((item) => (
              <HistoryRow
                item={item}
                key={item.id}
                timezone={payouts.filters.timezone}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-brand-lavender bg-brand-lavenderSoft/50 p-5">
            <h3 className="text-lg font-extrabold text-brand-deep">
              Nenhum valor recebido neste período
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              Tente outro período para consultar chegadas anteriores.
            </p>
          </div>
        )}

        <PayoutPagination
          dateRange={dateRange}
          filters={filters}
          hasNextPage={payouts.pagination.hasNextPage}
          page={filters.page}
        />
      </AppPageSection>
    </div>
  );
}

function AgendaGroup({
  items,
  label,
  timezone,
  tone,
}: {
  items: TherapistPayoutAgendaGroup[];
  label: string;
  timezone: string;
  tone: TherapistPayoutAgendaGroup["status"];
}) {
  return (
    <section aria-label={label} className="grid gap-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`size-2.5 rounded-full ${
            tone === "in_transit" ? "bg-brand-primary" : "bg-brand-cyan"
          }`}
        />
        <h3 className="text-base font-extrabold text-brand-deep">{label}</h3>
      </div>
      {items.length ? (
        <div
          className={
            tone === "in_transit"
              ? "overflow-hidden divide-y divide-brand-lavender/70 rounded-lg bg-brand-lavenderSoft/70 px-3 sm:px-4"
              : "divide-y divide-brand-lavender"
          }
        >
          {items.map((item) => (
            <AgendaRow item={item} key={item.id} timezone={timezone} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-surface-soft px-4 py-3 text-sm font-semibold text-tesText-secondary">
          {tone === "in_transit"
            ? "Nenhum valor está a caminho neste momento."
            : "Nenhum valor previsto para este intervalo."}
        </p>
      )}
    </section>
  );
}

function AgendaRow({
  item,
  timezone,
}: {
  item: TherapistPayoutAgendaGroup;
  timezone: string;
}) {
  const statusLabel = item.status === "in_transit"
    ? "A caminho da sua conta"
    : item.status === "balance_schedule"
      ? "Saldo previsto"
      : item.status === "awaiting_bank_date"
        ? "Aguardando data bancária"
        : "Chegada prevista";

  return (
    <PayoutRowDetails
      amountCents={item.amountCents}
      composition={item.composition}
      date={item.date}
      dateLabel={
        item.status === "balance_schedule"
          ? "Saldo disponível em"
          : item.status === "awaiting_bank_date"
            ? "Chegada à conta"
            : "Chegada prevista em"
      }
      sessionCount={item.sessionCount}
      statusLabel={statusLabel}
      timezone={timezone}
    />
  );
}

function HistoryRow({
  item,
  timezone,
}: {
  item: TherapistPayoutHistoryItem;
  timezone: string;
}) {
  const received = item.status === "received";
  return (
    <PayoutRowDetails
      amountCents={item.amountCents}
      composition={item.composition}
      date={item.date}
      dateLabel={received ? "Recebido em" : "Atualizado em"}
      sessionCount={item.sessionCount}
      statusLabel={received ? "Recebido" : "Em análise"}
      statusTone={received ? "received" : "under_review"}
      timezone={timezone}
    />
  );
}

function PayoutRowDetails({
  amountCents,
  composition,
  date,
  dateLabel,
  sessionCount,
  statusLabel,
  statusTone = "default",
  timezone,
}: {
  amountCents: number;
  composition: TherapistPayoutCompositionItem[];
  date: string | null;
  dateLabel: string;
  sessionCount: number;
  statusLabel: string;
  statusTone?: "default" | "received" | "under_review";
  timezone: string;
}) {
  return (
    <details className="group">
      <summary className="grid cursor-pointer list-none gap-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:grid-cols-[minmax(145px,0.85fr)_minmax(120px,0.7fr)_minmax(130px,0.7fr)_auto] sm:items-center sm:gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-tesText-muted">
            {dateLabel}
          </p>
          <p className="mt-1 text-base font-extrabold text-brand-deep">
            {date ? formatDate(date, timezone) : "Ainda sem data"}
          </p>
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-tesText-muted">
            Valor
          </p>
          <p className="mt-1 text-lg font-extrabold text-brand-deep">
            {formatCurrency(amountCents)}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-tesText-secondary">
            {sessionCountLabel(sessionCount)}
          </p>
          <span
            className={`mt-1 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${
              statusTone === "received"
                ? "bg-status-successBg text-status-success"
                : statusTone === "under_review"
                  ? "bg-status-warningBg text-status-warning"
                  : "bg-surface-soft text-tesText-secondary"
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <span className="inline-flex min-h-11 items-center justify-start gap-2 text-sm font-extrabold text-brand-primary sm:justify-end">
          Ver composição
          <ChevronDown
            aria-hidden="true"
            className="transition group-open:rotate-180"
            size={17}
          />
        </span>
      </summary>
      <div className="mb-3 rounded-lg bg-surface-soft p-4 text-left">
        <ul className="grid gap-3">
          {composition.map((session) => (
            <li
              className="grid gap-1 border-b border-brand-lavender/70 pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
              key={session.sessionPaymentId}
            >
              <div>
                <p className="text-sm font-extrabold text-brand-deep">
                  {session.patientDisplayName} · {session.therapyNameSnapshot}
                </p>
                <p className="mt-1 text-xs font-bold text-tesText-secondary">
                  Sessão em {formatDateTime(session.sessionDate, timezone)}
                </p>
              </div>
              <strong className="text-sm text-brand-deep">
                {formatCurrency(session.amountCents)}
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function PayoutMetricCard({
  description,
  icon: Icon,
  label,
  value,
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <article className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 rounded-card border border-brand-lavender bg-white p-4 shadow-card">
      <span className="grid size-10 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Icon aria-hidden="true" size={19} />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold text-brand-deep">{label}</h2>
        <p className="mt-1 text-[22px] font-extrabold leading-tight text-brand-deep">
          {formatCurrency(value)}
        </p>
      </div>
      <p className="col-span-2 mt-3 text-sm font-semibold leading-5 text-tesText-secondary">
        {description}
      </p>
    </article>
  );
}

function compareAgendaDates(
  left: TherapistPayoutAgendaGroup,
  right: TherapistPayoutAgendaGroup,
) {
  if (!left.date) return right.date ? 1 : 0;
  if (!right.date) return -1;
  return left.date.localeCompare(right.date);
}

function agendaHref(days: 7 | 15 | 30, dateRange: TherapistFinanceDateRange) {
  return buildFinanceHref({
    end: dateRange.end,
    filters: { agendaDays: days },
    period: dateRange.key,
    start: dateRange.start,
    tab: "payouts",
  });
}

function sessionCountLabel(count: number) {
  return `${count} ${count === 1 ? "sessão" : "sessões"}`;
}

function PayoutPagination({
  dateRange,
  filters,
  hasNextPage,
  page,
}: {
  dateRange: TherapistFinanceDateRange;
  filters: TherapistFinanceFilters;
  hasNextPage: boolean;
  page: number;
}) {
  if (page <= 1 && !hasNextPage) return null;
  const previousHref =
    page > 1
      ? buildFinanceHref({
          end: dateRange.end,
          filters,
          page: page - 1,
          period: dateRange.key,
          start: dateRange.start,
          tab: "payouts",
        })
      : null;
  const nextHref = hasNextPage
    ? buildFinanceHref({
        end: dateRange.end,
        filters,
        page: page + 1,
        period: dateRange.key,
        start: dateRange.start,
        tab: "payouts",
      })
    : null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {previousHref ? (
        <PendingNavigationLink
          className="inline-flex min-h-11 items-center rounded-lg border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={previousHref}
          key={previousHref}
        >
          Mostrar menos
        </PendingNavigationLink>
      ) : null}
      {nextHref ? (
        <PendingNavigationLink
          className="inline-flex min-h-11 items-center rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={nextHref}
          key={nextHref}
        >
          Carregar mais
        </PendingNavigationLink>
      ) : null}
    </div>
  );
}
