import Link from "next/link";
import type { Route } from "next";

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
  formatPlanLabel,
  formatStatusLabel,
} from "./admin-operation-display";

export function AdminProfessionalDetailPage({
  data,
}: {
  data: AdminOperationDetailPageData;
}) {
  const identity = findSection(data, "Identidade operacional");
  const profile = findSection(data, "Estado do perfil");
  const operation = findSection(data, "Operação");
  const traceability = findSection(data, "Rastreabilidade");

  const identityFields = fieldMap(identity?.fields ?? []);
  const profileFields = fieldMap(profile?.fields ?? []);
  const operationFields = fieldMap(operation?.fields ?? []);
  const traceabilityFields = fieldMap(traceability?.fields ?? []);

  const name = data.title;
  const status = formatStatusLabel(data.statusLabel);
  const plan = formatPlanLabel(profileFields.get("Plano"));
  const badges = [
    status ? { label: status, tone: statusTone(status) } : null,
    plan ? { label: plan, tone: "primary" as const } : null,
    profileFields.get("Perfil público")
      ? {
          label: formatStatusLabel(profileFields.get("Perfil público")),
          tone: "muted" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    tone?: "danger" | "muted" | "primary" | "success" | "warning";
  }>;

  const details = [
    {
      label: "Cidade",
      value: identityFields.get("Cidade") ?? "",
    },
    {
      label: "Idiomas",
      value: identityFields.get("Idiomas") ?? "",
    },
    {
      label: "Publicação",
      value: describePublication(profileFields),
    },
    {
      label: "Reservas",
      value: describeBookings(profileFields),
    },
  ].filter((item) => item.value);

  const stats = [
    statItem("Serviços totais", operationFields.get("Serviços totais")),
    statItem("Serviços ativos", operationFields.get("Serviços ativos")),
    statItem("Sessões totais", operationFields.get("Sessões totais")),
    statItem("Sessões futuras", operationFields.get("Sessões futuras")),
    statItem("Próxima sessão", operationFields.get("Próxima sessão")),
  ].filter(Boolean) as Array<{
    description?: string;
    label: string;
    value: string;
  }>;

  const productIdentityFields = [
    {
      label: "Cadastro da plataforma",
      value: identityFields.get("ID do perfil") ?? "",
    },
    {
      label: "Conta vinculada",
      value: identityFields.get("Usuário") ?? "",
    },
    {
      label: "Endereço público",
      value: identityFields.get("Slug público") ?? "",
    },
    {
      label: "Base de atuação",
      value: identityFields.get("Cidade") ?? "",
    },
    {
      label: "Idiomas",
      value: identityFields.get("Idiomas") ?? "",
    },
  ].filter((field) => field.value);

  const productProfileFields = [
    {
      label: "Plano",
      value: plan,
    },
    {
      label: "Situação do cadastro",
      value: status,
    },
    {
      label: "Perfil público",
      value: formatStatusLabel(profileFields.get("Perfil público")),
    },
    {
      label: "Publicado",
      value: profileFields.get("Publicado") ?? "",
    },
    {
      label: "Recebendo reservas",
      value: profileFields.get("Recebe reservas") ?? "",
    },
    {
      label: "Atendimento online",
      value: profileFields.get("Atendimento online") ?? "",
    },
  ].filter((field) => field.value);

  const productOperationFields = [
    {
      label: "Serviços totais",
      value: operationFields.get("Serviços totais") ?? "",
    },
    {
      label: "Serviços ativos",
      value: operationFields.get("Serviços ativos") ?? "",
    },
    {
      label: "Sessões totais",
      value: operationFields.get("Sessões totais") ?? "",
    },
    {
      label: "Sessões futuras",
      value: operationFields.get("Sessões futuras") ?? "",
    },
    {
      label: "Conta de recebimento",
      value: formatStatusLabel(operationFields.get("Stripe Connect")),
    },
    {
      label: "Próxima sessão",
      value: operationFields.get("Próxima sessão") ?? "",
    },
  ].filter((field) => field.value);

  const meta = [
    operationFields.get("Stripe Connect")
      ? {
          label: "Conta de recebimento",
          value: formatStatusLabel(operationFields.get("Stripe Connect")),
        }
      : null,
    traceabilityFields.get("Atualizado em")
      ? {
          label: "Última atualização",
          value: traceabilityFields.get("Atualizado em") as string,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <AppPageContainer className="max-w-[1320px] py-5 lg:py-6">
      <div className="space-y-6">
        <ProductBackLink href={data.backHref} />
        <div className="space-y-4">
          <ProductBreadcrumbs
            items={[
              { href: routes.admin.professionals, label: "Profissionais" },
              { label: name },
            ]}
          />
          <EditorialHeader
            subtitle="Acompanhe a presença operacional do profissional com dados reais da plataforma."
            title="Detalhe do profissional"
          />
        </div>

        <IdentityHero
          badges={badges}
          details={details}
          meta={meta}
          name={name}
          title="Profissional"
        />

        <StatsGrid items={stats} />

        <AppPageGrid className="gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AppPageMain className="space-y-5">
            <DetailSectionCard
              description="Dados cadastrais disponíveis para acompanhamento administrativo."
              fields={productIdentityFields}
              title="Cadastro"
            />
            <DetailSectionCard
              description="Visibilidade e disponibilidade atuais do perfil."
              fields={productProfileFields}
              title="Situação do perfil"
            />
            <DetailSectionCard
              description="Resumo de serviços e sessões acessível nesta etapa."
              fields={productOperationFields}
              title="Atividade"
            />
            <DetailSectionCard
              description="Registro de criação e atualização do cadastro."
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
                  Esta tela resume presença pública, disponibilidade para
                  reservas e sinais operacionais do cadastro.
                </p>
                <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                  Esta visão apresenta somente informações confirmadas e
                  disponíveis para o acompanhamento administrativo.
                </p>
              </div>
            </AsideCard>

            <AsideCard title="Histórico administrativo">
              <ProductHistory events={data.auditEvents} />
            </AsideCard>

            <AsideCard title="Navegação">
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-brand-lavender/70 bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
                href={routes.admin.professionals as Route<string>}
              >
                Voltar para profissionais
              </Link>
            </AsideCard>
          </AppPageAside>
        </AppPageGrid>
      </div>
    </AppPageContainer>
  );
}

function describePublication(fields: Map<string, string>) {
  const published = fields.get("Publicado");
  const publicStatus = formatStatusLabel(fields.get("Perfil público"));

  if (published && publicStatus) return `${published} · ${publicStatus}`;
  return published || publicStatus || "";
}

function describeBookings(fields: Map<string, string>) {
  const bookings = fields.get("Recebe reservas");
  const online = fields.get("Atendimento online");

  if (bookings && online) return `${bookings} · ${online}`;
  return bookings || online || "";
}

function statusTone(status: string) {
  if (status === "Aprovado" || status === "Ativo") return "success" as const;
  if (status === "Suspenso" || status === "Não aprovado")
    return "danger" as const;
  if (status === "Em análise" || status === "Ajustes solicitados") {
    return "warning" as const;
  }
  return "primary" as const;
}

function statItem(label: string, value?: string) {
  if (!value) return null;
  return { label, value };
}
