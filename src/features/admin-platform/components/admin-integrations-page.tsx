import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Mail,
  Route,
  Video,
  WalletCards,
} from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageHeader,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";

import type {
  AdminIntegrationHealth,
  AdminIntegrationsPageData,
  AdminOperationalSignal,
  AdminOperationalStatus,
} from "../admin-platform.types";

export function AdminIntegrationsPage({
  data,
}: {
  data: AdminIntegrationsPageData;
}) {
  return (
    <AppPageContainer className="max-w-[1440px] py-5 lg:py-6">
      <AppPageHeader eyebrow="Admin" title="Integrações">
        Acompanhe provedores externos e sinais técnicos sem expor secrets,
        payloads sensíveis ou credenciais.
      </AppPageHeader>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.integrations.map((integration) => (
          <IntegrationCard integration={integration} key={integration.key} />
        ))}
      </section>

      <AppPageGrid className="xl:grid-cols-[minmax(0,1fr)_380px]">
        <AppPageMain>
          <AppPageSection>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-brand-deep">
                  Sinais operacionais
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  Leituras bloqueadas por RLS ou grants aparecem como
                  indisponíveis, nunca como zero.
                </p>
              </div>
              <p className="rounded-md bg-surface-muted px-3 py-2 text-xs font-bold text-tesText-secondary">
                {formatDateTime(data.generatedAt)}
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {data.summary.map((signal) => (
                <SignalCard key={signal.key} signal={signal} />
              ))}
            </div>
          </AppPageSection>
        </AppPageMain>

        <AppPageAside>
          <AppPageSection>
            <h2 className="text-lg font-extrabold text-brand-deep">
              Regras de segurança
            </h2>
            <div className="mt-4 space-y-3 text-sm font-semibold leading-6 text-tesText-secondary">
              <p>Secrets permanecem fora do browser e fora dos payloads.</p>
              <p>Webhooks dependem de assinatura, replay protection e idempotência.</p>
              <p>Falha técnica mantém estado degradado até validação real.</p>
            </div>
          </AppPageSection>
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
  );
}

function IntegrationCard({
  integration,
}: {
  integration: AdminIntegrationHealth;
}) {
  const Icon = integrationIcon(integration.key);

  return (
    <article className="rounded-card border border-brand-lavender bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-brand-lavenderSoft text-brand-primary">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <StatusBadge status={integration.status} />
      </div>
      <h2 className="mt-4 text-lg font-extrabold text-brand-deep">
        {integration.label}
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {integration.description}
      </p>
    </article>
  );
}

function SignalCard({ signal }: { signal: AdminOperationalSignal }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-brand-deep">
            {signal.label}
          </p>
          <p className="mt-1 text-xs font-bold text-tesText-secondary">
            {signal.source}
          </p>
        </div>
        <span className={toneClass(signal)} />
      </div>
      <strong className="mt-3 block text-2xl font-extrabold text-brand-deep">
        {signal.status === "available" ? signal.value : "Indisponível"}
      </strong>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {signal.description}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: AdminOperationalStatus }) {
  const Icon =
    status === "healthy"
      ? CheckCircle2
      : status === "manual_review"
        ? Clock3
        : AlertTriangle;
  const label = {
    configuration_missing: "Configuração ausente",
    degraded: "Degradado",
    healthy: "Operacional",
    manual_review: "Revisão manual",
    unavailable: "Indisponível",
  }[status];

  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-md border border-border bg-white px-2 py-1 text-xs font-extrabold text-tesText-secondary">
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </span>
  );
}

function integrationIcon(key: AdminIntegrationHealth["key"]) {
  if (key === "stripe") return WalletCards;
  if (key === "zoom") return Video;
  if (key === "email") return Mail;
  return Route;
}

function toneClass(signal: AdminOperationalSignal) {
  const base = "mt-1 block size-2.5 shrink-0 rounded-full";

  if (signal.status !== "available") return `${base} bg-border`;
  if (signal.tone === "success") return `${base} bg-status-success`;
  if (signal.tone === "warning") return `${base} bg-status-warning`;
  if (signal.tone === "danger") return `${base} bg-status-danger`;
  if (signal.tone === "info") return `${base} bg-status-info`;

  return `${base} bg-border`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
