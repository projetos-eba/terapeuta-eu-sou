import {
  CalendarDays,
  CreditCard,
  FileCheck2,
  History,
  ShieldCheck,
  Tag,
} from "lucide-react";

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
import { AdminSubscriptionCancelAction } from "./admin-subscription-cancel-action";

export function AdminSubscriptionDetailPage({
  data,
}: {
  data: AdminFinanceDetailPageData;
}) {
  const subscription = getSection(data, "Assinatura");
  const cycle = getSection(data, "Ciclo e preço");
  const reconciliation = getSection(data, "Conciliação segura");
  const charges = getSection(data, "Últimas cobranças");
  const traceability = getSection(data, "Rastreabilidade");
  const subscriptionFields = fieldMap(subscription?.fields ?? []);
  const cycleFields = fieldMap(cycle?.fields ?? []);
  const status = productStatus(data.statusLabel);

  return (
    <AppPageContainer className="max-w-[1320px] py-5 lg:py-6">
      <div className="space-y-6">
        <ProductBackLink href={data.backHref} label="Voltar para assinaturas" />
        <div className="space-y-4">
          <ProductBreadcrumbs
            items={[
              { href: routes.admin.subscriptions, label: "Assinaturas" },
              { label: subscriptionFields.get("Terapeuta") || "Detalhes" },
            ]}
          />
          <EditorialHeader
            subtitle="Acompanhe o plano, o ciclo e as cobranças registradas para esta assinatura."
            title="Detalhes da assinatura"
          />
        </div>

        <IdentityHero
          badges={status ? [{ label: status, tone: statusTone(status) }] : []}
          details={
            [
              productField(
                "Plano atual",
                subscriptionFields.get("Plano atual"),
              ),
              productField(
                "Data de início",
                cycleFields.get("Início do ciclo"),
              ),
              productField(
                "Próxima cobrança",
                cycleFields.get("Próxima cobrança"),
              ),
            ].filter(Boolean) as Array<{ label: string; value: string }>
          }
          meta={
            cycleFields.get("Valor do ciclo")
              ? [
                  {
                    label: "Valor do ciclo",
                    value: cycleFields.get("Valor do ciclo") as string,
                  },
                ]
              : undefined
          }
          name={subscriptionFields.get("Terapeuta") || data.title}
          title="Assinatura"
        />

        <StatsGrid
          items={
            [
              productField(
                "Plano atual",
                subscriptionFields.get("Plano atual"),
              ),
              productField("Situação", status),
              productField(
                "Data de início",
                cycleFields.get("Início do ciclo"),
              ),
              productField(
                "Próxima cobrança",
                cycleFields.get("Próxima cobrança"),
              ),
            ].filter(Boolean) as Array<{ label: string; value: string }>
          }
        />

        <AppPageGrid className="gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AppPageMain className="space-y-5">
            <DetailSectionCard
              description="Dados principais da assinatura e do profissional vinculado."
              fields={subscription?.fields ?? []}
              icon={Tag}
              title="Assinatura"
            />
            <DetailSectionCard
              description="Período vigente, valor e próxima etapa da cobrança."
              fields={cycle?.fields ?? []}
              icon={CalendarDays}
              title="Ciclo e preço"
            />
            <DetailSectionCard
              description="Sinais disponíveis para conferir se a assinatura está registrada corretamente."
              fields={reconciliation?.fields ?? []}
              icon={ShieldCheck}
              title="Conciliação segura"
            />
            <DetailSectionCard
              description="Resumo das cobranças já registradas nesta assinatura."
              fields={charges?.fields ?? []}
              icon={CreditCard}
              title="Últimas cobranças"
            />
            <DetailSectionCard
              description="Datas registradas para acompanhamento administrativo."
              fields={traceability?.fields ?? []}
              icon={History}
              title="Rastreabilidade"
            />
          </AppPageMain>

          <AppPageAside className="space-y-5">
            <AsideCard title="Cancelar assinatura">
              {data.subscriptionManagement ? (
                <AdminSubscriptionCancelAction
                  status={data.subscriptionManagement}
                  subscriptionId={data.id}
                />
              ) : (
                <p className="text-sm font-semibold leading-6 text-tesText-secondary">
                  A situação de cancelamento não está disponível agora.
                </p>
              )}
            </AsideCard>
            <AsideCard title="Eventos recentes">
              {data.events.length > 0 ? (
                <ol className="space-y-3">
                  {data.events.map((event) => (
                    <li
                      className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4"
                      key={event.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-extrabold text-brand-deep">
                            {event.title}
                          </p>
                          {event.subtitle ? (
                            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                              {event.subtitle}
                            </p>
                          ) : null}
                        </div>
                        {event.amountLabel ? (
                          <strong className="shrink-0 text-sm font-extrabold text-brand-primary">
                            {event.amountLabel}
                          </strong>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs font-bold text-tesText-muted">
                        {formatDateTime(event.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                  Ainda não há eventos recentes para esta assinatura.
                </p>
              )}
            </AsideCard>
            <AsideCard title="Conferência">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[16px] bg-status-successBg text-status-success">
                  <FileCheck2 aria-hidden="true" className="size-5" />
                </span>
                <p className="text-sm font-semibold leading-6 text-tesText-secondary">
                  As informações desta página são usadas para acompanhar a
                  assinatura, sem alterar cobranças automaticamente.
                </p>
              </div>
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

function productField(label: string, value?: string) {
  return value ? { label, value } : null;
}

function productStatus(value?: string) {
  if (!value) return "";
  const labels: Record<string, string> = {
    active: "Ativa",
    canceled: "Cancelada",
    incomplete: "Incompleta",
    incomplete_expired: "Não concluída",
    past_due: "Em atraso",
    paused: "Pausada",
    trialing: "Período de avaliação",
    unpaid: "Inadimplente",
  };
  return labels[value.toLowerCase()] ?? "Situação não identificada";
}

function statusTone(value: string) {
  if (value === "Ativa" || value === "Período de avaliação") return "success";
  if (value === "Em atraso" || value === "Incompleta") return "warning";
  if (value === "Cancelada" || value === "Inadimplente") return "danger";
  return "info";
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
