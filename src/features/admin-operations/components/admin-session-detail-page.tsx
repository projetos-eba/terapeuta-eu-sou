import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page";
import { routes } from "@/lib/routes";

import type { AdminOperationDetailPageData } from "../admin-operations.types";
import {
  AsideCard,
  DetailSectionCard,
  EditorialHeader,
  IdentityHero,
  ProductBackLink,
  ProductBreadcrumbs,
  ProductHistory,
  StatsGrid,
  fieldMap,
  findSection,
  formatStatusLabel,
} from "./admin-operation-display";

export function AdminSessionDetailPage({
  data,
}: {
  data: AdminOperationDetailPageData;
}) {
  const session = findSection(data, "Sessão");
  const schedule = findSection(data, "Agenda");
  const participants = findSection(data, "Participantes");
  const traceability = findSection(data, "Rastreabilidade");
  const sessionFields = fieldMap(session?.fields ?? []);
  const scheduleFields = fieldMap(schedule?.fields ?? []);
  const participantFields = fieldMap(participants?.fields ?? []);
  const status = formatStatusLabel(data.statusLabel);
  const payment = formatStatusLabel(sessionFields.get("Pagamento"));

  const stats = [
    statItem("Duração", sessionFields.get("Duração")),
    statItem("Início", scheduleFields.get("Início")),
    statItem("Término", scheduleFields.get("Término")),
    statItem("Pagamento", payment),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const scheduleSummary = [
    productField("Início", scheduleFields.get("Início")),
    productField("Término", scheduleFields.get("Término")),
    productField("Duração prevista", sessionFields.get("Duração")),
    productField("Fuso horário", scheduleFields.get("Fuso")),
    productField("Concluída em", scheduleFields.get("Concluída em")),
    productField("Cancelada em", scheduleFields.get("Cancelada em")),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const participantSummary = [
    productField("Profissional", participantFields.get("Terapeuta")),
    productField("Cliente", participantFields.get("Cliente")),
    productField("Formato", describeMeeting()),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <AppPageContainer className="max-w-[1320px] py-5 lg:py-6">
      <div className="space-y-6">
        <ProductBackLink href={data.backHref} label="Voltar para sessões" />
        <div className="space-y-4">
          <ProductBreadcrumbs
            items={[
              { href: routes.admin.sessions, label: "Sessões" },
              { label: data.title },
            ]}
          />
          <EditorialHeader
            subtitle="Acompanhe agenda, participantes e situação financeira da sessão em uma única visão."
            title="Detalhes da sessão"
          />
        </div>

        <IdentityHero
          badges={[
            ...(status ? [{ label: status, tone: statusTone(status) }] : []),
            ...(payment
              ? [{ label: payment, tone: paymentTone(payment) }]
              : []),
          ]}
          details={
            [
              productField("Profissional", participantFields.get("Terapeuta")),
              productField("Cliente", participantFields.get("Cliente")),
              productField("Início", scheduleFields.get("Início")),
              productField("Formato", describeMeeting()),
            ].filter(Boolean) as Array<{ label: string; value: string }>
          }
          meta={
            sessionFields.get("Duração")
              ? [
                  {
                    label: "Duração prevista",
                    value: sessionFields.get("Duração") as string,
                  },
                ]
              : undefined
          }
          name={data.title}
          title="Sessão"
        />

        <StatsGrid items={stats} />

        <AppPageGrid className="gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AppPageMain className="space-y-5">
            <DetailSectionCard
              description="Horários registrados para o atendimento."
              fields={scheduleSummary}
              title="Agenda da sessão"
            />
            <DetailSectionCard
              description="Pessoas vinculadas e formato disponível para o encontro."
              fields={participantSummary}
              title="Participantes"
            />
            <DetailSectionCard
              description="Registro de criação e atualização desta sessão."
              fields={traceability?.fields ?? []}
              title="Rastreabilidade"
            />
          </AppPageMain>

          <AppPageAside className="space-y-5">
            <AsideCard title="Situação atual">
              <dl className="grid gap-3">
                {[
                  productField("Sessão", status),
                  productField("Pagamento", payment),
                  productField("Serviço", sessionFields.get("Serviço")),
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
            <AsideCard title="Histórico administrativo">
              <ProductHistory events={data.auditEvents} />
            </AsideCard>
          </AppPageAside>
        </AppPageGrid>
      </div>
    </AppPageContainer>
  );
}

function productField(label: string, value?: string) {
  if (!value) return null;
  return { label, value };
}

function statItem(label: string, value?: string) {
  if (!value) return null;
  return { label, value };
}

function describeMeeting() {
  return "Online";
}

function statusTone(status: string) {
  if (status === "Concluída" || status === "Confirmada")
    return "success" as const;
  if (status === "Cancelada") return "danger" as const;
  if (status === "Pagamento pendente") return "warning" as const;
  return "primary" as const;
}

function paymentTone(status: string) {
  if (["Pago", "Confirmado", "Concluído"].includes(status))
    return "success" as const;
  if (["Falhou", "Cancelado", "Reembolsado"].includes(status))
    return "danger" as const;
  return "warning" as const;
}
