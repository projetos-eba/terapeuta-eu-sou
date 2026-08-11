import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page";
import {
  AsideCard,
  DetailSectionCard,
  EditorialHeader,
  IdentityHero,
  ProductBackLink,
  ProductBreadcrumbs,
  StatsGrid,
  fieldMap,
} from "@/features/admin-operations/components/admin-operation-display";
import { routes } from "@/lib/routes";

import type { AdminFinanceDetailPageData } from "../admin-finance.types";

export function AdminPaymentDetailPage({
  data,
}: {
  data: AdminFinanceDetailPageData;
}) {
  const payment = getSection(data, "Pagamento");
  const values = getSection(data, "Valores");
  const people = getSection(data, "Participantes e sessão");
  const reconciliation = getSection(data, "Conciliação segura");
  const risk = getSection(data, "Risco e repasse");
  const traceability = getSection(data, "Rastreabilidade");
  const paymentFields = fieldMap(payment?.fields ?? []);
  const valueFields = fieldMap(values?.fields ?? []);
  const peopleFields = fieldMap(people?.fields ?? []);
  const riskFields = fieldMap(risk?.fields ?? []);
  const status = formatFinanceStatus(data.statusLabel);

  const stats = [
    statItem("Valor bruto", valueFields.get("Valor bruto")),
    statItem("Repasse profissional", valueFields.get("Repasse terapeuta")),
    statItem("Comissão TES", valueFields.get("Comissão TES")),
    statItem("Valor reembolsado", riskFields.get("Valor reembolsado")),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <AppPageContainer className="max-w-[1320px] py-5 lg:py-6">
      <div className="space-y-6">
        <ProductBackLink href={data.backHref} label="Voltar para financeiro" />
        <div className="space-y-4">
          <ProductBreadcrumbs
            items={[
              { href: routes.admin.payments, label: "Financeiro" },
              { label: data.title },
            ]}
          />
          <EditorialHeader
            subtitle="Acompanhe valores, participantes e etapas do repasse com informações financeiras consolidadas."
            title="Detalhes do financeiro"
          />
        </div>

        <IdentityHero
          badges={
            status ? [{ label: status, tone: financeStatusTone(status) }] : []
          }
          details={
            [
              productField("Profissional", peopleFields.get("Terapeuta")),
              productField("Cliente", peopleFields.get("Cliente")),
              productField("Início da sessão", peopleFields.get("Início")),
              productField(
                "Situação da transferência",
                formatFinanceStatus(paymentFields.get("Transferência")),
              ),
            ].filter(Boolean) as Array<{ label: string; value: string }>
          }
          meta={
            valueFields.get("Valor bruto")
              ? [
                  {
                    label: "Valor da transação",
                    value: valueFields.get("Valor bruto") as string,
                  },
                ]
              : undefined
          }
          name={data.title}
          title="Movimentação financeira"
        />

        <StatsGrid items={stats} />

        <AppPageGrid className="gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AppPageMain className="space-y-5">
            <DetailSectionCard
              description="Composição financeira registrada para esta sessão."
              fields={values?.fields ?? []}
              title="Composição dos valores"
            />
            <DetailSectionCard
              description="Pessoas e atendimento vinculados à movimentação."
              fields={cleanPeopleFields(people?.fields ?? [])}
              title="Sessão relacionada"
            />
            <DetailSectionCard
              description="Sinais disponíveis para conferência do processamento."
              fields={cleanReconciliationFields(reconciliation?.fields ?? [])}
              title="Conferência do pagamento"
            />
            <DetailSectionCard
              description="Reembolsos, disputas e situação do repasse."
              fields={cleanRiskFields(risk?.fields ?? [])}
              title="Reembolso e repasse"
            />
            <DetailSectionCard
              description="Datas de processamento disponíveis para acompanhamento."
              fields={traceability?.fields ?? []}
              title="Rastreabilidade"
            />
          </AppPageMain>

          <AppPageAside className="space-y-5">
            <AsideCard title="Situação atual">
              <dl className="grid gap-3">
                {[
                  productField("Pagamento", status),
                  productField(
                    "Atendimento",
                    formatFinanceStatus(
                      paymentFields.get("Status do atendimento"),
                    ),
                  ),
                  productField(
                    "Transferência",
                    formatFinanceStatus(paymentFields.get("Transferência")),
                  ),
                  productField(
                    "Elegível para repasse",
                    riskFields.get("Elegível em"),
                  ),
                ]
                  .filter(Boolean)
                  .map((field) => (
                    <div
                      className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4"
                      key={field?.label}
                    >
                      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">
                        {field?.label}
                      </dt>
                      <dd className="mt-2 text-sm font-extrabold text-brand-deep">
                        {field?.value}
                      </dd>
                    </div>
                  ))}
              </dl>
            </AsideCard>
            <AsideCard title="Movimentações recentes">
              {data.events.length > 0 ? (
                <ol className="space-y-3">
                  {data.events.map((event) => (
                    <li
                      className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4"
                      key={event.id}
                    >
                      <p className="text-sm font-extrabold text-brand-deep">
                        {event.title}
                      </p>
                      {event.amountLabel ? (
                        <p className="mt-1 text-sm font-extrabold text-brand-primary">
                          {event.amountLabel}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs font-bold text-tesText-muted">
                        {formatDateTime(event.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                  Ainda não há movimentações recentes para esta transação.
                </p>
              )}
            </AsideCard>
          </AppPageAside>
        </AppPageGrid>
      </div>
    </AppPageContainer>
  );
}

function getSection(data: AdminFinanceDetailPageData, title: string) {
  return data.sections.find((section) => section.title === title);
}

function cleanPeopleFields(fields: Array<{ label: string; value: string }>) {
  return fields.filter(
    (field) => !field.label.toLowerCase().includes("perfil"),
  );
}

function cleanReconciliationFields(
  fields: Array<{ label: string; value: string }>,
) {
  const labels: Record<string, string> = {
    "Balance transaction recebida": "Conciliação registrada",
    "Charge recebida": "Cobrança registrada",
    "Checkout Stripe recebido": "Pagamento iniciado",
    "Evento Stripe em": "Última confirmação",
    "PaymentIntent recebido": "Pagamento processado",
  };
  return fields
    .filter((field) => field.label !== "Metadados internos presentes")
    .map((field) => ({
      ...field,
      label: labels[field.label] ?? field.label,
    }));
}

function cleanRiskFields(fields: Array<{ label: string; value: string }>) {
  const labels: Record<string, string> = {
    Ledger: "Registros financeiros",
    Transfers: "Transferências",
  };
  return fields.map((field) => ({
    ...field,
    label: labels[field.label] ?? field.label,
  }));
}

function productField(label: string, value?: string) {
  if (!value) return null;
  return { label, value };
}

function statItem(label: string, value?: string) {
  if (!value) return null;
  return { label, value };
}

function formatFinanceStatus(value?: string) {
  if (!value) return "";
  const labels: Record<string, string> = {
    blocked: "Repasse em espera",
    failed: "Falhou",
    not_eligible: "Ainda não elegível",
    paid: "Confirmado",
    pending: "Pendente",
    refunded: "Reembolsado",
    scheduled: "Agendado",
    succeeded: "Confirmado",
  };
  return labels[value.toLowerCase()] ?? value.replaceAll("_", " ");
}

function financeStatusTone(status: string) {
  if (status === "Confirmado") return "success" as const;
  if (status === "Falhou" || status === "Reembolsado") return "danger" as const;
  return "warning" as const;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
