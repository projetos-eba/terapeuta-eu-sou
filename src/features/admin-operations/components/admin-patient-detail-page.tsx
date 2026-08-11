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

export function AdminPatientDetailPage({
  data,
}: {
  data: AdminOperationDetailPageData;
}) {
  const identity = findSection(data, "Identidade operacional");
  const activity = findSection(data, "Atividade");
  const traceability = findSection(data, "Rastreabilidade");

  const identityFields = fieldMap(identity?.fields ?? []);
  const activityFields = fieldMap(activity?.fields ?? []);

  const status = formatStatusLabel(identityFields.get("Status da conta"));
  const badges = status ? [{ label: status, tone: statusTone(status) }] : [];

  const details = [
    {
      label: "Fuso horário",
      value: identityFields.get("Fuso horário") ?? "",
    },
    {
      label: "Comunicação",
      value: identityFields.get("Marketing") ?? "",
    },
    {
      label: "Última atividade",
      value: activityFields.get("Última atividade") ?? "",
    },
  ].filter((item) => item.value);

  const stats = [
    statItem("Reservas totais", activityFields.get("Reservas totais")),
    statItem("Reservas futuras", activityFields.get("Reservas futuras")),
    statItem("Tickets", activityFields.get("Tickets")),
    statItem("Última atividade", activityFields.get("Última atividade")),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const registrationFields = [
    {
      label: "Cadastro da plataforma",
      value: identityFields.get("ID do perfil") ?? "",
    },
    {
      label: "Conta vinculada",
      value: identityFields.get("Usuário") ?? "",
    },
    {
      label: "Situação da conta",
      value: status,
    },
    {
      label: "Fuso horário",
      value: identityFields.get("Fuso horário") ?? "",
    },
    {
      label: "Permissão de comunicação",
      value: identityFields.get("Marketing") ?? "",
    },
  ].filter((field) => field.value);

  const activitySummaryFields = [
    {
      label: "Reservas totais",
      value: activityFields.get("Reservas totais") ?? "",
    },
    {
      label: "Reservas futuras",
      value: activityFields.get("Reservas futuras") ?? "",
    },
    {
      label: "Tickets",
      value: activityFields.get("Tickets") ?? "",
    },
    {
      label: "Última atividade",
      value: activityFields.get("Última atividade") ?? "",
    },
  ].filter((field) => field.value);

  return (
    <AppPageContainer className="max-w-[1320px] py-5 lg:py-6">
      <div className="space-y-6">
        <ProductBackLink href={data.backHref} />
        <div className="space-y-4">
          <ProductBreadcrumbs
            items={[
              { href: routes.admin.patients, label: "Clientes" },
              { label: data.title },
            ]}
          />
          <EditorialHeader
            subtitle="Acompanhe o cadastro e os sinais operacionais disponíveis para a relação com a plataforma."
            title="Detalhes do cliente"
          />
        </div>

        <IdentityHero
          badges={badges}
          details={details}
          meta={
            activityFields.get("Tickets")
              ? [
                  {
                    label: "Tickets em histórico",
                    value: activityFields.get("Tickets") as string,
                  },
                ]
              : undefined
          }
          name={data.title}
          title="Cliente"
        />

        <StatsGrid items={stats} />

        <AppPageGrid className="gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AppPageMain className="space-y-5">
            <DetailSectionCard
              description="Resumo do cadastro acessível para acompanhamento administrativo."
              fields={registrationFields}
              title="Cadastro"
            />
            <DetailSectionCard
              description="Sinais de uso disponíveis sem expor conteúdo clínico ou histórico detalhado."
              fields={activitySummaryFields}
              title="Atividade"
            />
            <DetailSectionCard
              description="Registro de criação e atualização do perfil."
              fields={traceability?.fields ?? []}
              title="Rastreabilidade"
            />
          </AppPageMain>

          <AppPageAside className="space-y-5">
            <AsideCard title="Leitura desta visão">
              <div className="space-y-3">
                <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                  Esta tela reúne apenas dados cadastrais e sinais operacionais
                  mínimos da relação com a plataforma.
                </p>
                <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                  Informações clínicas, histórico de sessões e anotações
                  privadas permanecem fora desta superfície.
                </p>
              </div>
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

function statItem(label: string, value?: string) {
  if (!value) return null;
  return { label, value };
}

function statusTone(status: string) {
  if (status === "Ativo") return "success" as const;
  if (status === "Excluído" || status === "Anonimizado")
    return "danger" as const;
  return "primary" as const;
}
