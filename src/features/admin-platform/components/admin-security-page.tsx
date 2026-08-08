import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileSearch,
  ShieldAlert,
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
  AdminOperationalSignal,
  AdminOperationalStatus,
  AdminSecurityPageData,
  AdminSecurityReviewItem,
} from "../admin-platform.types";

export function AdminSecurityPage({ data }: { data: AdminSecurityPageData }) {
  return (
    <AppPageContainer className="max-w-[1440px] py-5 lg:py-6">
      <AppPageHeader eyebrow="Admin" title="Segurança">
        Controle inicial da superfície administrativa, auditoria recente e
        pendências de hardening identificadas na Fase 1.
      </AppPageHeader>

      <AppPageGrid className="xl:grid-cols-[minmax(0,1fr)_380px]">
        <AppPageMain>
          <AppPageSection>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-brand-deep">
                  Superfície admin
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  Módulos ocultos continuam fora da navegação para evitar links
                  mortos e operações sem contrato.
                </p>
              </div>
              <p className="rounded-md bg-surface-muted px-3 py-2 text-xs font-bold text-tesText-secondary">
                {formatDateTime(data.generatedAt)}
              </p>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {data.moduleSignals.map((signal) => (
                <SignalCard key={signal.key} signal={signal} />
              ))}
            </div>
          </AppPageSection>

          <AppPageSection>
            <h2 className="text-xl font-extrabold text-brand-deep">
              Revisões obrigatórias
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              Estes itens dependem de validação Supabase Advisor e revisão de
              contrato antes de liberar o admin como 100%.
            </p>
            <div className="mt-5 grid gap-3">
              {data.reviewItems.map((item) => (
                <ReviewItem item={item} key={item.key} />
              ))}
            </div>
          </AppPageSection>
        </AppPageMain>

        <AppPageAside>
          <AppPageSection>
            <h2 className="text-lg font-extrabold text-brand-deep">
              Auditoria recente
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              Eventos administrativos acessíveis pelo contrato atual.
            </p>
            <div className="mt-4 space-y-3">
              {data.auditEvents.length === 0 ? (
                <p className="rounded-md bg-surface-muted p-3 text-sm font-bold text-tesText-secondary">
                  Sem eventos administrativos recentes acessíveis.
                </p>
              ) : (
                data.auditEvents.map((event) => (
                  <div
                    className="rounded-md border border-border bg-surface-muted p-3"
                    key={event.id}
                  >
                    <p className="text-sm font-extrabold text-brand-deep">
                      {event.eventType}
                    </p>
                    <p className="mt-1 text-xs font-bold text-tesText-secondary">
                      {event.entityType} · {event.actorRole} ·{" "}
                      {formatDateTime(event.createdAt)}
                    </p>
                    {event.reason ? (
                      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                        {event.reason}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </AppPageSection>
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
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

function ReviewItem({ item }: { item: AdminSecurityReviewItem }) {
  const Icon = item.severity === "info" ? FileSearch : ShieldAlert;

  return (
    <article className="rounded-md border border-border bg-surface-muted p-4">
      <div className="flex items-start gap-3">
        <span className={severityIconClass(item.severity)}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-extrabold text-brand-deep">
              {item.label}
            </h3>
            <StatusBadge status={item.status} />
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {item.description}
          </p>
          <p className="mt-2 text-xs font-bold text-tesText-secondary">
            Fonte: {item.source}
          </p>
        </div>
      </div>
    </article>
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

function severityIconClass(severity: AdminSecurityReviewItem["severity"]) {
  if (severity === "critical") {
    return "grid size-10 shrink-0 place-items-center rounded-md bg-status-dangerBg text-status-danger";
  }
  if (severity === "warning") {
    return "grid size-10 shrink-0 place-items-center rounded-md bg-status-warningBg text-status-warning";
  }

  return "grid size-10 shrink-0 place-items-center rounded-md bg-surface-soft text-status-info";
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
