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
  return (
    <div className="grid min-w-0 gap-5 [&>*]:min-w-0">
      <AppPageSection className="grid gap-2">
        <h2 className="font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[38px]">
          Repasses
        </h2>
        <p className="max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
          Veja quanto deve chegar à sua conta, o que já está a caminho e o que
          foi recebido no período.
        </p>
        <p className="text-sm font-bold text-brand-primary">
          Previsto → A caminho da sua conta → Recebido
        </p>
      </AppPageSection>

      <section
        aria-label="Resumo dos repasses"
        className="grid gap-4 md:grid-cols-3"
      >
        <PayoutMetricCard
          description="Valores com previsão de chegada, antes de iniciarem o depósito."
          icon={CalendarDays}
          label="A receber"
          value={payouts.summary.expectedCents}
        />
        <PayoutMetricCard
          description="Valores que já avançaram e estão chegando ao banco."
          icon={Send}
          label="A caminho da sua conta"
          value={payouts.summary.inTransitCents}
        />
        <PayoutMetricCard
          description="Valores com chegada à conta já confirmada no período."
          icon={CheckCircle2}
          label="Recebido"
          value={payouts.summary.receivedCents}
        />
      </section>

      <AppPageSection className="grid gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-brand-primary">
              Próximas chegadas
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-brand-deep">
              Agenda de repasses
            </h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
              Acompanhe os valores previstos para chegar à sua conta. As datas
              são estimativas e podem mudar.
            </p>
          </div>
          <nav aria-label="Período da agenda" className="flex flex-wrap gap-2">
            {([7, 15, 30] as const).map((days) => (
              <Link
                aria-current={payouts.agenda.days === days ? "page" : undefined}
                className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
                  payouts.agenda.days === days
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-lavender bg-white text-brand-primary hover:bg-brand-lavenderSoft"
                }`}
                href={agendaHref(days, dateRange)}
                key={days}
              >
                {days} dias
              </Link>
            ))}
          </nav>
        </div>

        {payouts.agenda.inTransit.length || payouts.agenda.predicted.length ? (
          <div className="grid gap-7">
            <AgendaGroup
              items={payouts.agenda.inTransit}
              label="A caminho da sua conta"
              timezone={payouts.filters.timezone}
              tone="in_transit"
            />
            <AgendaGroup
              items={payouts.agenda.predicted}
              label="Próximos previstos"
              timezone={payouts.filters.timezone}
              tone="predicted"
            />
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-brand-lavender bg-brand-lavenderSoft/50 p-6">
            <h3 className="text-lg font-extrabold text-brand-deep">
              Ainda não há valores com data de chegada disponível
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              Quando houver uma previsão confiável, ela aparecerá aqui. Nenhuma
              data é estimada sem base financeira disponível.
            </p>
          </div>
        )}
      </AppPageSection>

      <AppPageSection className="grid gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-brand-deep">
              Histórico de repasses
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              Valores que já chegaram à sua conta no período selecionado.
            </p>
          </div>
          <p className="text-sm font-bold text-tesText-secondary">
            {payouts.pagination.totalCount} registro(s)
          </p>
        </div>

        <form className="grid min-w-0 gap-4" method="get">
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
          <div className="grid gap-3">
            {payouts.historyItems.map((item) => (
              <HistoryRow
                item={item}
                key={item.id}
                timezone={payouts.filters.timezone}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-brand-lavender bg-brand-lavenderSoft/50 p-6">
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
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`size-3 rounded-full ${
            tone === "in_transit" ? "bg-brand-primary" : "bg-brand-cyan"
          }`}
        />
        <h3 className="text-lg font-extrabold text-brand-deep">{label}</h3>
      </div>
      {items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <AgendaRow item={item} key={item.id} timezone={timezone} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-surface-soft px-4 py-3 text-sm font-semibold leading-6 text-tesText-secondary">
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
  const statusLabel =
    item.status === "in_transit" ? "A caminho da sua conta" : "Previsto";

  return (
    <article className="rounded-card border border-brand-lavender bg-white p-4 shadow-card sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(120px,0.55fr)_minmax(150px,0.7fr)_minmax(200px,1fr)_auto] sm:items-center">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-tesText-muted">
            Chegada estimada
          </p>
          <p className="mt-1 text-lg font-extrabold text-brand-deep">
            {formatDate(item.date, timezone)}
          </p>
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-tesText-muted">
            Valor
          </p>
          <p className="mt-1 text-xl font-extrabold text-brand-deep">
            {formatCurrency(item.amountCents)}
          </p>
        </div>
        <div className="grid gap-1">
          <span
            className={`inline-flex min-h-7 w-fit items-center rounded-full px-3 py-1 text-xs font-extrabold ${
              item.status === "in_transit"
                ? "bg-brand-lavenderSoft text-brand-primary"
                : "bg-surface-soft text-tesText-secondary"
            }`}
          >
            {statusLabel}
          </span>
          <p className="text-sm font-semibold text-tesText-secondary">
            {sessionCountLabel(item.sessionCount)}
          </p>
        </div>
        <CompositionDetails
          composition={item.composition}
          timezone={timezone}
        />
      </div>
    </article>
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
    <article className="rounded-card border border-brand-lavender bg-white p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(120px,0.55fr)_minmax(150px,0.7fr)_minmax(200px,1fr)_auto] sm:items-center">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-tesText-muted">
            {received ? "Recebido em" : "Atualizado em"}
          </p>
          <p className="mt-1 text-lg font-extrabold text-brand-deep">
            {formatDate(item.date, timezone)}
          </p>
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-tesText-muted">
            Valor
          </p>
          <p className="mt-1 text-xl font-extrabold text-brand-deep">
            {formatCurrency(item.amountCents)}
          </p>
        </div>
        <div className="grid gap-1">
          <span
            className={`inline-flex min-h-7 w-fit items-center rounded-full px-3 py-1 text-xs font-extrabold ${
              received
                ? "bg-status-successBg text-status-success"
                : "bg-status-warningBg text-status-warning"
            }`}
          >
            {received ? "Recebido" : "Em análise"}
          </span>
          <p className="text-sm font-semibold text-tesText-secondary">
            {sessionCountLabel(item.sessionCount)}
          </p>
        </div>
        <CompositionDetails
          composition={item.composition}
          timezone={timezone}
        />
      </div>
    </article>
  );
}

function CompositionDetails({
  composition,
  timezone,
}: {
  composition: TherapistPayoutCompositionItem[];
  timezone: string;
}) {
  return (
    <details className="group sm:col-span-4 sm:text-right">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
        Ver composição
        <ChevronDown
          aria-hidden="true"
          className="transition group-open:rotate-180"
          size={17}
        />
      </summary>
      <div className="mt-4 rounded-lg bg-surface-soft p-4 text-left">
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
    <article className="rounded-card border border-brand-lavender bg-white p-5 shadow-card">
      <span className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Icon aria-hidden="true" size={22} />
      </span>
      <h2 className="mt-4 text-base font-extrabold text-brand-deep">{label}</h2>
      <p className="mt-2 text-[24px] font-extrabold leading-tight text-brand-deep">
        {formatCurrency(value)}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {description}
      </p>
    </article>
  );
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
