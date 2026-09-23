import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import { AppPageSection } from "@/components/app-page";
import { PendingNavigationLink } from "@/components/tes/pending-navigation-link";
import { routes } from "@/lib/routes";

import type {
  TherapistChargeStatus,
  TherapistFinanceDateRange,
  TherapistFinanceFilters,
  TherapistReceiptsContract,
} from "../therapist-finance.types";
import { formatCurrency, formatDateTime } from "./financial-formatters";
import { FinancialStatusBadge } from "./financial-status-badge";
import { buildFinanceHref } from "./financial-route";
import { FinancialPeriodFields } from "./financial-period-fields";

const chargeStatusContent: Record<
  TherapistChargeStatus,
  { label: string; tone: string }
> = {
  approved: {
    label: "Pagamento aprovado",
    tone: "bg-status-successBg text-status-success",
  },
  canceled: {
    label: "Cancelado",
    tone: "bg-surface-soft text-tesText-secondary",
  },
  failed: {
    label: "Falhou",
    tone: "bg-status-dangerBg text-status-danger",
  },
  processing: {
    label: "Processando",
    tone: "bg-status-warningBg text-status-warning",
  },
  refunded: {
    label: "Reembolsado",
    tone: "bg-status-dangerBg text-status-danger",
  },
  scheduled: {
    label: "Cobrança agendada",
    tone: "bg-brand-lavenderSoft text-brand-primary",
  },
  under_review: {
    label: "Em análise",
    tone: "bg-status-warningBg text-status-warning",
  },
};

type ReceiptListCopy = {
  ariaLabel: string;
  emptyDescription: string;
  emptyTitle: string;
  subtitle: string;
  title: string;
};

const defaultReceiptListCopy: ReceiptListCopy = {
  ariaLabel: "Movimentações das cobranças por sessão",
  emptyDescription:
    "Tente outro período ou ajuste os filtros para consultar suas sessões.",
  emptyTitle: "Ainda não há cobranças neste período",
  subtitle:
    "Confira o valor da sessão, a Comissão TES, seu valor e a próxima etapa da cobrança.",
  title: "Movimentações por sessão",
};

const receiptListCopyByStatus: Record<TherapistChargeStatus, ReceiptListCopy> =
  {
    approved: receiptListCopy(
      "Sessões com pagamento aprovado",
      "Confira as sessões cuja cobrança foi concluída e acompanhe o valor antes da chegada à sua conta.",
      "Não há sessões com pagamento aprovado neste período.",
    ),
    canceled: receiptListCopy(
      "Sessões canceladas",
      "Confira as sessões canceladas. Nenhuma cobrança será feita.",
      "Não há sessões canceladas neste período.",
    ),
    failed: receiptListCopy(
      "Sessões com cobrança não concluída",
      "Confira as sessões cuja cobrança não foi concluída.",
      "Não há sessões com cobrança não concluída neste período.",
    ),
    processing: receiptListCopy(
      "Sessões com cobrança em processamento",
      "Confira as sessões cuja cobrança foi iniciada e ainda aguarda conclusão.",
      "Não há sessões com cobrança em processamento neste período.",
    ),
    refunded: receiptListCopy(
      "Sessões reembolsadas",
      "Confira as sessões cujo valor foi devolvido ao paciente.",
      "Não há sessões reembolsadas neste período.",
    ),
    scheduled: receiptListCopy(
      "Sessões com cobrança agendada",
      "Confira as sessões com cobrança prevista antes do atendimento.",
      "Não há sessões com cobrança agendada neste período.",
    ),
    under_review: receiptListCopy(
      "Sessões com cobrança em análise",
      "Confira as sessões cuja cobrança está sendo analisada.",
      "Não há sessões com cobrança em análise neste período.",
    ),
  };

export function FinancialReceiptsTab({
  dateRange,
  filters,
  receipts,
}: {
  dateRange: TherapistFinanceDateRange;
  filters: TherapistFinanceFilters;
  receipts: TherapistReceiptsContract;
}) {
  const listCopy = filters.status
    ? receiptListCopyByStatus[filters.status]
    : defaultReceiptListCopy;

  return (
    <div className="grid min-w-0 gap-5 [&>*]:min-w-0">
      <AppPageSection className="grid gap-2">
        <h2 className="font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[38px]">
          Cobranças das suas sessões
        </h2>
        <p className="max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
          Entenda o valor de cada sessão e o que aconteceu com o pagamento. A
          chegada do dinheiro à sua conta fica em Repasses.
        </p>
        <Link
          className="mt-1 inline-flex min-h-11 w-fit items-center text-sm font-extrabold text-brand-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={buildFinanceHref({
            end: dateRange.end,
            filters: { agendaDays: filters.agendaDays },
            period: dateRange.key,
            start: dateRange.start,
            tab: "payouts",
          })}
        >
          Veja quando os valores devem chegar à sua conta
        </Link>
      </AppPageSection>

      <section
        aria-label="Resumo das cobranças"
        className="grid gap-4 md:grid-cols-3"
      >
        <ReceiptMetricCard
          description="Seu valor nas sessões cuja cobrança foi concluída."
          href={statusHref("approved", dateRange, filters)}
          icon={CheckCircle2}
          label="Pagamentos aprovados"
          value={receipts.summary.approvedCents}
        />
        <ReceiptMetricCard
          description="Seu valor previsto em sessões cuja cobrança ainda ocorrerá."
          href={statusHref("scheduled", dateRange, filters)}
          icon={CalendarClock}
          label="Cobranças agendadas"
          value={receipts.summary.scheduledCents}
        />
        <ReceiptMetricCard
          description="Valores devolvidos aos pacientes no período."
          href={statusHref("refunded", dateRange, filters)}
          icon={RotateCcw}
          label="Reembolsos"
          value={receipts.summary.refundedCents}
        />
      </section>

      <AppPageSection className="grid gap-4">
        <form className="grid min-w-0 gap-4" method="get">
          <input name="tab" type="hidden" value="recebimentos" />
          <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:max-w-[720px]">
            <FinancialPeriodFields dateRange={dateRange} />
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,280px)_minmax(180px,240px)_minmax(320px,1fr)]">
            <label className="grid min-w-0 gap-1 text-sm font-extrabold text-brand-deep">
              Situação da cobrança
              <select
                className="min-h-11 w-full min-w-0 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                defaultValue={filters.status ?? ""}
                name="status"
              >
                <option value="">Todas</option>
                {(
                  Object.entries(chargeStatusContent) as Array<
                    [TherapistChargeStatus, { label: string }]
                  >
                ).map(([status, content]) => (
                  <option key={status} value={status}>
                    {content.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-sm font-extrabold text-brand-deep">
              Terapia
              <select
                className="min-h-11 w-full min-w-0 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                defaultValue={filters.therapyId ?? ""}
                name="therapyId"
              >
                <option value="">Todas</option>
                {receipts.therapyOptions.map((option) => (
                  <option key={option.therapyId} value={option.therapyId}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-sm font-extrabold text-brand-deep sm:col-span-2 lg:col-span-1">
              Paciente
              <input
                className="min-h-11 w-full rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none placeholder:text-tesText-muted focus-visible:ring-2 focus-visible:ring-brand-primary"
                defaultValue={filters.search ?? ""}
                name="q"
                placeholder="Buscar por nome"
                type="search"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto"
              type="submit"
            >
              Filtrar
            </button>
            {hasActiveFilters(filters) ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center text-sm font-extrabold text-brand-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                href={buildFinanceHref({
                  end: dateRange.end,
                  period: dateRange.key,
                  start: dateRange.start,
                  tab: "receipts",
                })}
              >
                Limpar filtros
              </Link>
            ) : null}
          </div>
        </form>
      </AppPageSection>

      <AppPageSection className="grid gap-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-brand-deep">
              {listCopy.title}
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              {listCopy.subtitle}
            </p>
          </div>
          <p className="text-sm font-bold text-tesText-secondary">
            {receipts.pagination.totalCount} registro(s)
          </p>
        </div>

        {receipts.items.length ? (
          <>
            <div
              aria-label={listCopy.ariaLabel}
              className="hidden max-h-[560px] overflow-auto lg:block"
              tabIndex={0}
            >
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-xs font-extrabold uppercase text-tesText-muted">
                    <TableHead>Paciente</TableHead>
                    <TableHead>Terapia</TableHead>
                    <TableHead>Sessão</TableHead>
                    <TableHead>Valor da sessão</TableHead>
                    <TableHead>Comissão TES</TableHead>
                    <TableHead>Seu valor</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Próxima etapa</TableHead>
                    <th className="border-b border-brand-lavender py-3">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.items.map((item) => (
                    <tr
                      className="align-top text-sm font-bold text-brand-deep"
                      key={item.sessionPaymentId}
                    >
                      <TableCell>{item.patientDisplayName}</TableCell>
                      <TableCell muted>{item.therapyNameSnapshot}</TableCell>
                      <TableCell>
                        {formatDateTime(
                          item.sessionDate,
                          receipts.filters.timezone,
                        )}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(item.grossAmountCents)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(item.tesCommissionCents)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(item.therapistNetAmountCents)}
                      </TableCell>
                      <TableCell>
                        <ReceiptSituation item={item} />
                      </TableCell>
                      <TableCell muted>
                        {nextStep(item, receipts.filters.timezone)}
                      </TableCell>
                      <td className="border-b border-brand-lavender/70 py-4">
                        <ReceiptActions item={item} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 lg:hidden">
              {receipts.items.map((item) => (
                <article
                  className="rounded-card border border-brand-lavender bg-white p-4"
                  key={item.sessionPaymentId}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-brand-deep">
                        {item.patientDisplayName}
                      </h3>
                      <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                        {item.therapyNameSnapshot} ·{" "}
                        {formatDateTime(
                          item.sessionDate,
                          receipts.filters.timezone,
                        )}
                      </p>
                    </div>
                    <ReceiptSituation item={item} />
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                    <ReceiptDetail
                      label="Valor da sessão"
                      value={formatCurrency(item.grossAmountCents)}
                    />
                    <ReceiptDetail
                      label="Comissão TES"
                      value={formatCurrency(item.tesCommissionCents)}
                    />
                    <ReceiptDetail
                      label="Seu valor"
                      value={formatCurrency(item.therapistNetAmountCents)}
                    />
                  </dl>
                  <div className="mt-4 rounded-lg bg-surface-soft p-3">
                    <p className="text-xs font-extrabold uppercase text-tesText-muted">
                      Próxima etapa
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                      {nextStep(item, receipts.filters.timezone)}
                    </p>
                  </div>
                  <div className="mt-4">
                    <ReceiptActions item={item} />
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-card border border-dashed border-brand-lavender bg-brand-lavenderSoft/50 p-6">
            <h3 className="text-lg font-extrabold text-brand-deep">
              {listCopy.emptyTitle}
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              {listCopy.emptyDescription}
            </p>
          </div>
        )}

        <Pagination
          dateRange={dateRange}
          filters={filters}
          hasNextPage={receipts.pagination.hasNextPage}
          page={filters.page}
        />
      </AppPageSection>
    </div>
  );
}

function receiptListCopy(
  title: string,
  subtitle: string,
  emptyTitle: string,
): ReceiptListCopy {
  return {
    ariaLabel: title,
    emptyDescription:
      "Tente outro período ou ajuste os filtros para consultar suas sessões.",
    emptyTitle,
    subtitle,
    title,
  };
}

function ReceiptMetricCard({
  description,
  href,
  icon: Icon,
  label,
  value,
}: {
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <Link
      className="rounded-card border border-brand-lavender bg-white p-5 shadow-card transition hover:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      href={href}
    >
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
    </Link>
  );
}

function ChargeStatusBadge({ status }: { status: TherapistChargeStatus }) {
  const content = chargeStatusContent[status];
  return (
    <span
      className={`inline-flex min-h-7 w-fit items-center rounded-full px-3 py-1 text-xs font-extrabold ${content.tone}`}
    >
      {content.label}
    </span>
  );
}

function ReceiptSituation({
  item,
}: {
  item: TherapistReceiptsContract["items"][number];
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <ChargeStatusBadge status={item.chargeStatus} />
      {item.receiptStatus === "compensated" ? (
        <FinancialStatusBadge status="compensated" type="receipt" />
      ) : null}
    </div>
  );
}

function nextStep(
  item: TherapistReceiptsContract["items"][number],
  timezone: string,
) {
  if (item.receiptStatus === "compensated") {
    return "Seu valor foi usado para compensar um saldo pendente. Não haverá depósito bancário para esta sessão.";
  }

  switch (item.chargeStatus) {
    case "scheduled":
      return item.scheduledChargeAt
        ? `Cobrança programada para ${formatDateTime(item.scheduledChargeAt, timezone)}.`
        : "A cobrança será feita antes da sessão.";
    case "processing":
      return "Aguarde a conclusão da cobrança.";
    case "approved":
      return "Acompanhe a previsão de chegada em Repasses.";
    case "failed":
      return "A cobrança não foi concluída.";
    case "refunded":
      return "O valor foi devolvido ao paciente.";
    case "under_review":
      return "A movimentação está em análise.";
    case "canceled":
      return "Nenhuma cobrança será feita.";
  }
}

function ReceiptActions({
  item,
}: {
  item: TherapistReceiptsContract["items"][number];
}) {
  const canShowReceipt =
    Boolean(item.receiptUrl) &&
    ["approved", "refunded", "under_review"].includes(item.chargeStatus);

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={routes.therapist.sessionDetail(item.bookingId)}
      >
        Ver detalhes
      </Link>
      {canShowReceipt ? (
        <a
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-lavender px-3 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={item.receiptUrl ?? undefined}
          rel="noreferrer"
          target="_blank"
        >
          Comprovante de pagamento
        </a>
      ) : null}
    </div>
  );
}

function ReceiptDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-extrabold uppercase text-tesText-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-extrabold text-brand-deep">{value}</dd>
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-brand-lavender py-3 pr-3">{children}</th>
  );
}

function TableCell({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <td
      className={`border-b border-brand-lavender/70 py-4 pr-3 ${muted ? "font-semibold leading-6 text-tesText-secondary" : ""}`}
    >
      {children}
    </td>
  );
}

function statusHref(
  status: TherapistChargeStatus,
  dateRange: TherapistFinanceDateRange,
  filters: TherapistFinanceFilters,
) {
  return buildFinanceHref({
    end: dateRange.end,
    filters: {
      agendaDays: filters.agendaDays,
      search: filters.search,
      status,
      therapyId: filters.therapyId,
    },
    period: dateRange.key,
    start: dateRange.start,
    tab: "receipts",
  });
}

function Pagination({
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
          tab: "receipts",
        })
      : null;
  const nextHref = hasNextPage
    ? buildFinanceHref({
        end: dateRange.end,
        filters,
        page: page + 1,
        period: dateRange.key,
        start: dateRange.start,
        tab: "receipts",
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

function hasActiveFilters(filters: TherapistFinanceFilters) {
  return Boolean(filters.search || filters.status || filters.therapyId);
}
