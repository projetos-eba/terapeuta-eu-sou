import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page";
import { routes } from "@/lib/routes";

import type { AdminOperationDetailPageData } from "../admin-operations.types";
import { AdminOperationCommandPanel } from "./admin-operation-command-panel";
import { AdminSupportReplyPanel } from "./admin-support-reply-panel";
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

export function AdminSupportDetailPage({
  data,
}: {
  data: AdminOperationDetailPageData;
}) {
  const ticket =
    findSection(data, "Solicitação") ?? findSection(data, "Ticket");
  const relationships = findSection(data, "Relacionamentos");
  const traceability = findSection(data, "Rastreabilidade");
  const ticketFields = fieldMap(ticket?.fields ?? []);
  const relationshipFields = fieldMap(relationships?.fields ?? []);
  const traceFields = fieldMap(traceability?.fields ?? []);
  const status = formatStatusLabel(data.statusLabel);

  const stats = [
    statItem("Prioridade", formatPriority(ticketFields.get("Prioridade"))),
    statItem("Urgência", formatPriority(ticketFields.get("Urgência"))),
    statItem("Categoria", formatStatusLabel(ticketFields.get("Categoria"))),
    statItem("Última atualização", traceFields.get("Atualizado em")),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const requestSummary = [
    productField("Solicitante", relationshipFields.get("Solicitante")),
    productField(
      "Perfil",
      formatStatusLabel(relationshipFields.get("Perfil solicitante")),
    ),
    productField("Categoria", formatStatusLabel(ticketFields.get("Categoria"))),
    productField("Origem", formatStatusLabel(ticketFields.get("Origem"))),
    productField("Prioridade", formatPriority(ticketFields.get("Prioridade"))),
    productField("Urgência", formatPriority(ticketFields.get("Urgência"))),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const relationshipSummary = [
    productField(
      "Reserva relacionada",
      relationshipFields.get("Booking relacionado"),
    ),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <AppPageContainer className="max-w-[1320px] py-5 lg:py-6">
      <div className="space-y-6">
        <ProductBackLink href={data.backHref} label="Voltar para suporte" />
        <div className="space-y-4">
          <ProductBreadcrumbs
            items={[
              { href: routes.admin.support, label: "Suporte" },
              { label: data.title },
            ]}
          />
          <EditorialHeader
            subtitle="Acompanhe a solicitação, o contexto disponível e as ações administrativas registradas."
            title="Detalhes do suporte"
          />
        </div>

        <IdentityHero
          badges={[
            ...(status ? [{ label: status, tone: statusTone(status) }] : []),
            ...(ticketFields.get("Prioridade")
              ? [
                  {
                    label: `Prioridade ${formatPriority(ticketFields.get("Prioridade"))}`,
                    tone: priorityTone(ticketFields.get("Prioridade")),
                  },
                ]
              : []),
          ]}
          details={
            [
              productField(
                "Solicitante",
                relationshipFields.get("Solicitante"),
              ),
              productField(
                "Perfil",
                formatStatusLabel(relationshipFields.get("Perfil solicitante")),
              ),
              productField(
                "Categoria",
                formatStatusLabel(ticketFields.get("Categoria")),
              ),
            ].filter(Boolean) as Array<{ label: string; value: string }>
          }
          meta={
            traceFields.get("Criado em")
              ? [
                  {
                    label: "Solicitação recebida",
                    value: traceFields.get("Criado em") as string,
                  },
                ]
              : undefined
          }
          name={data.title}
          title="Atendimento de suporte"
        />

        <StatsGrid items={stats} />

        <AppPageGrid className="gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AppPageMain className="space-y-5">
            <DetailSectionCard
              description="Informações disponíveis para orientar o atendimento."
              fields={requestSummary}
              title="Resumo da solicitação"
            />
            <DetailSectionCard
              description="Vínculos operacionais confirmados para esta solicitação."
              fields={relationshipSummary}
              title="Contexto relacionado"
            />
            <DetailSectionCard
              description="Registro de abertura e atualização do atendimento."
              fields={traceability?.fields ?? []}
              title="Rastreabilidade"
            />
            <section className="rounded-[28px] border border-brand-lavender/70 bg-white p-6 shadow-[0_22px_60px_rgba(20,16,90,0.09)]">
              <h2 className="text-2xl font-extrabold text-brand-deep">
                Responder ao solicitante
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                A resposta é visível ao solicitante e atualiza o chamado para
                aguardar retorno.
              </p>
              <div className="mt-5">
                <AdminSupportReplyPanel ticketId={data.id} />
              </div>
            </section>
          </AppPageMain>

          <AppPageAside className="space-y-5">
            <AsideCard title="Ações disponíveis">
              <AdminOperationCommandPanel data={data} />
            </AsideCard>
            <AsideCard title="Histórico administrativo">
              <ProductHistory events={data.auditEvents} />
            </AsideCard>
            <AsideCard title="Privacidade do atendimento">
              <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                Esta visão apresenta somente o contexto necessário para a
                operação de suporte.
              </p>
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

function statusTone(status: string) {
  if (status === "Resolvido") return "success" as const;
  if (status === "Aberto" || status === "Em andamento")
    return "warning" as const;
  return "primary" as const;
}

function priorityTone(value?: string) {
  const normalized = value?.toLowerCase();
  if (
    normalized === "high" ||
    normalized === "critical" ||
    normalized === "alta"
  ) {
    return "danger" as const;
  }
  if (normalized === "medium" || normalized === "média")
    return "warning" as const;
  return "muted" as const;
}

function formatPriority(value?: string) {
  if (!value) return "";
  const labels: Record<string, string> = {
    critical: "Crítica",
    high: "Alta",
    low: "Baixa",
    medium: "Média",
    normal: "Normal",
  };
  return labels[value.toLowerCase()] ?? formatStatusLabel(value);
}
