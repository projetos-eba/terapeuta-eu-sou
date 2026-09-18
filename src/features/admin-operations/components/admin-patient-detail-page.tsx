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
  ContactFact,
  formatPhone,
  formatPostalCode,
} from "./admin-private-contact-details";
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
  const traceFields = fieldMap(traceability?.fields ?? []);
  const contact = data.patientContact;

  const status = formatStatusLabel(identityFields.get("Status da conta"));
  const badges = status ? [{ label: status, tone: statusTone(status) }] : [];

  const details = [
    {
      label: "Na plataforma desde",
      value: traceFields.get("Criado em") ?? "",
    },
    {
      label: "Última atividade",
      value: activityFields.get("Última atividade") ?? "",
    },
  ].filter((item) => item.value);

  const stats = [
    statItem("Reservas totais", activityFields.get("Reservas totais")),
    statItem("Reservas futuras", activityFields.get("Reservas futuras")),
    statItem("Chamados", activityFields.get("Chamados")),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const registrationFields = [
    {
      label: "Data de cadastro",
      value: traceFields.get("Criado em") ?? "",
    },
    {
      label: "Última atualização do cadastro",
      value: traceFields.get("Atualizado em") ?? "",
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

  return (
    <AppPageContainer className="min-w-0 max-w-[1320px] grid-cols-[minmax(0,1fr)] py-5 lg:py-6">
      <div className="min-w-0 space-y-6">
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
          name={data.title}
          title="Cliente"
        />

        <StatsGrid items={stats} />

        {data.statusLabel === "suspended" ? (
          <p className="rounded-md border border-status-warning/30 bg-status-warningBg p-4 text-sm font-semibold leading-6 text-brand-deep">
            Novos agendamentos estão suspensos. Login, suporte e sessões já
            contratadas permanecem disponíveis.
          </p>
        ) : null}

        <AppPageGrid className="gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AppPageMain className="space-y-5">
            <DetailSectionCard
              description="Resumo do cadastro acessível para acompanhamento administrativo."
              fields={registrationFields}
              title="Cadastro"
            />
            <AsideCard title="Dados e contato">
              <p className="mb-5 text-sm font-semibold leading-6 text-tesText-secondary">
                Informações cadastradas pelo cliente, disponíveis apenas para a
                equipe administrativa.
              </p>
              {contact ? (
                <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <ContactFact
                    label="E-mail"
                    value={contact.email || "Não informado"}
                  />
                  <ContactFact
                    label="Celular"
                    value={
                      formatPhone(contact.phoneCountryCode, contact.phone, null) ||
                      "Não informado"
                    }
                  />
                  {contact.phone && !contact.phoneCountryCode ? (
                    <ContactFact label="DDI" value="Não informado" />
                  ) : null}
                  <ContactFact
                    label="CEP"
                    value={
                      formatPostalCode(contact.postalCode) || "Não informado"
                    }
                  />
                  <ContactFact
                    label="Estado"
                    value={contact.state || "Não informado"}
                  />
                  <ContactFact
                    label="Logradouro"
                    value={contact.street || "Não informado"}
                  />
                  <ContactFact
                    label="Número"
                    value={contact.streetNumber || "Não informado"}
                  />
                  <ContactFact
                    label="Complemento"
                    value={contact.complement || "Não informado"}
                  />
                  <ContactFact
                    label="Bairro"
                    value={contact.neighborhood || "Não informado"}
                  />
                  <ContactFact
                    label="Cidade"
                    value={contact.city || "Não informado"}
                  />
                </dl>
              ) : (
                <p className="text-sm font-semibold text-tesText-secondary">
                  Não foi possível carregar os dados de contato agora.
                </p>
              )}
            </AsideCard>
          </AppPageMain>

          <AppPageAside className="space-y-5">
            <AsideCard title="Gestão de agendamentos">
              <p className="mb-4 text-sm font-semibold leading-6 text-tesText-secondary">
                A suspensão impede apenas novos agendamentos. Ela não cancela
                sessões nem bloqueia o acesso à conta.
              </p>
              <AdminOperationCommandPanel data={data} />
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
  if (status === "Suspenso") return "warning" as const;
  if (status === "Excluído" || status === "Anonimizado")
    return "danger" as const;
  return "primary" as const;
}
