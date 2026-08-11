import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page";
import { routes } from "@/lib/routes";

import type { AdminOperationDetailPageData } from "../admin-operations.types";
import { AdminOperationCommandPanel } from "./admin-operation-command-panel";
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

export function AdminVerificationDetailPage({
  data,
}: {
  data: AdminOperationDetailPageData;
}) {
  const verification = findSection(data, "Verificação");
  const traceability = findSection(data, "Rastreabilidade");

  const verificationFields = fieldMap(verification?.fields ?? []);
  const status = formatStatusLabel(verificationFields.get("Status"));
  const therapistName = verificationFields.get("Terapeuta") || data.title;
  const adjustment = verificationFields.get("Ajuste solicitado");
  const rejection = verificationFields.get("Reprovação registrada");

  const identityFields = [
    {
      label: "Profissional",
      value: therapistName,
    },
    {
      label: "Situação da análise",
      value: status,
    },
    {
      label: "Cadastro vinculado",
      value: verificationFields.get("Perfil terapeuta") ?? "",
    },
    {
      label: "Revisado por",
      value: verificationFields.get("Revisado por") ?? "",
    },
  ].filter((field) => field.value);

  const indicatorFields = [
    {
      label: "Ajuste solicitado",
      value: adjustment ?? "",
    },
    {
      label: "Reprovação registrada",
      value: rejection ?? "",
    },
    {
      label: "Enviado em",
      value: verificationFields.get("Enviado em") ?? "",
    },
    {
      label: "Revisado em",
      value: verificationFields.get("Revisado em") ?? "",
    },
  ].filter((field) => field.value);

  const stats = [
    statItem("Status", status),
    statItem("Ajuste solicitado", adjustment),
    statItem("Reprovação", rejection),
    statItem("Última revisão", verificationFields.get("Revisado em")),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <AppPageContainer className="max-w-[1320px] py-5 lg:py-6">
      <div className="space-y-6">
        <ProductBackLink href={data.backHref} />
        <div className="space-y-4">
          <ProductBreadcrumbs
            items={[
              { href: routes.admin.professionals, label: "Profissionais" },
              { href: routes.admin.verifications, label: "Verificações" },
              { label: therapistName },
            ]}
          />
          <EditorialHeader
            subtitle="Acompanhe o estado atual da revisão e siga com a próxima decisão disponível para este cadastro."
            title="Detalhe da verificação"
          />
        </div>

        <IdentityHero
          badges={
            status
              ? [
                  {
                    label: status,
                    tone: statusTone(status),
                  },
                ]
              : []
          }
          details={[
            {
              label: "Cadastro vinculado",
              value: verificationFields.get("Perfil terapeuta") ?? "",
            },
            {
              label: "Revisado por",
              value: verificationFields.get("Revisado por") ?? "",
            },
          ].filter((detail) => detail.value)}
          meta={
            [
              verificationFields.get("Enviado em")
                ? {
                    label: "Envio",
                    value: verificationFields.get("Enviado em") as string,
                  }
                : null,
              verificationFields.get("Revisado em")
                ? {
                    label: "Última revisão",
                    value: verificationFields.get("Revisado em") as string,
                  }
                : null,
            ].filter(Boolean) as Array<{ label: string; value: string }>
          }
          name={therapistName}
          title="Verificação"
        />

        <StatsGrid items={stats} />

        <AppPageGrid className="gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AppPageMain className="space-y-5">
            <DetailSectionCard
              description="Identificação da análise disponível nesta etapa."
              fields={identityFields}
              title="Identidade da análise"
            />
            <DetailSectionCard
              description="Indicadores reais sobre ajustes e encerramento da revisão."
              fields={indicatorFields}
              title="Indicadores"
            />
            <DetailSectionCard
              description="Registro de criação e atualização da análise."
              fields={traceability?.fields ?? []}
              title="Rastreabilidade"
            />
          </AppPageMain>

          <AppPageAside className="space-y-5">
            <AsideCard title="Ações disponíveis">
              <AdminOperationCommandPanel data={data} />
            </AsideCard>

            <AsideCard title="Leitura desta visão">
              <div className="space-y-3">
                <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                  Esta página mostra o andamento da revisão e os sinais que já
                  foram registrados para o cadastro.
                </p>
                <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                  Documentos privados, observações persistidas e anexos não
                  fazem parte desta superfície.
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
  if (status === "Aprovado") return "success" as const;
  if (status === "Não aprovado") return "danger" as const;
  if (status === "Em análise" || status === "Ajustes solicitados") {
    return "warning" as const;
  }
  return "primary" as const;
}
