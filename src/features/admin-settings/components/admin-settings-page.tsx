import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Settings,
  ShieldCheck,
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
  AdminReleaseCheck,
  AdminSettingsGroup,
  AdminSettingsPageData,
  AdminSettingsSignal,
} from "../admin-settings.types";

export function AdminSettingsPage({ data }: { data: AdminSettingsPageData }) {
  return (
    <AppPageContainer className="max-w-[1440px] py-5 lg:py-6">
      <AppPageHeader eyebrow="Admin" title="Configurações">
        Governança de produto, operação, flags e integrações sem expor secrets
        nem permitir edição direta de estados críticos.
      </AppPageHeader>

      <AppPageGrid className="xl:grid-cols-[minmax(0,1fr)_380px]">
        <AppPageMain>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.groups.map((group) => (
              <SettingsGroup group={group} key={group.key} />
            ))}
          </div>
        </AppPageMain>

        <AppPageAside>
          <AppPageSection>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-lavenderSoft text-brand-primary">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-brand-deep">
                  Política de secrets
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  Atualizado em {formatDateTime(data.generatedAt)}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {data.secretPolicy.map((policy) => (
                <p
                  className="rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold leading-6 text-tesText-secondary"
                  key={policy}
                >
                  {policy}
                </p>
              ))}
            </div>
          </AppPageSection>

          <AppPageSection>
            <h2 className="text-lg font-extrabold text-brand-deep">
              Checklist de release
            </h2>
            <div className="mt-4 space-y-3">
              {data.releaseChecks.map((check) => (
                <ReleaseCheck check={check} key={check.key} />
              ))}
            </div>
          </AppPageSection>
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
  );
}

function SettingsGroup({ group }: { group: AdminSettingsGroup }) {
  return (
    <AppPageSection>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-lavenderSoft text-brand-primary">
          <Settings aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep">
            {group.title}
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            {group.description}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {group.items.map((item) => (
          <SettingsSignal item={item} key={item.key} />
        ))}
      </div>
    </AppPageSection>
  );
}

function SettingsSignal({ item }: { item: AdminSettingsSignal }) {
  return (
    <article className="rounded-md border border-border bg-surface-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-brand-deep">
            {item.label}
          </h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            {item.description}
          </p>
          <p className="mt-2 break-words text-xs font-bold text-tesText-secondary">
            Fonte: {item.source}
          </p>
        </div>
        <StatusBadge status={item.status} tone={item.tone} />
      </div>
    </article>
  );
}

function ReleaseCheck({ check }: { check: AdminReleaseCheck }) {
  return (
    <article className="rounded-md border border-border bg-surface-muted p-3">
      <div className="flex items-start gap-3">
        <StatusIcon status={check.status} />
        <div>
          <h3 className="text-sm font-extrabold text-brand-deep">
            {check.label}
          </h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            {check.description}
          </p>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({
  status,
  tone,
}: {
  status: AdminSettingsSignal["status"];
  tone: AdminSettingsSignal["tone"];
}) {
  const label = {
    configuration_missing: "Ausente",
    degraded: "Degradado",
    healthy: "Operacional",
    manual_review: "Revisão manual",
    unavailable: "Indisponível",
  }[status];

  return (
    <span className="inline-flex min-h-8 shrink-0 items-center rounded-md border border-border bg-white px-2 py-1 text-xs font-extrabold text-tesText-secondary">
      <span className={toneClass(tone)} />
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: AdminReleaseCheck["status"] }) {
  const Icon =
    status === "healthy"
      ? CheckCircle2
      : status === "manual_review"
        ? Clock3
        : AlertTriangle;

  return (
    <span className={statusIconClass(status)}>
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}

function toneClass(tone: AdminSettingsSignal["tone"]) {
  const base = "mr-2 block size-2.5 rounded-full";
  if (tone === "danger") return `${base} bg-status-danger`;
  if (tone === "warning") return `${base} bg-status-warning`;
  if (tone === "success") return `${base} bg-status-success`;
  if (tone === "info") return `${base} bg-status-info`;

  return `${base} bg-border`;
}

function statusIconClass(status: AdminReleaseCheck["status"]) {
  if (status === "healthy") {
    return "grid size-9 shrink-0 place-items-center rounded-md bg-status-successBg text-status-success";
  }
  if (status === "configuration_missing" || status === "degraded") {
    return "grid size-9 shrink-0 place-items-center rounded-md bg-status-warningBg text-status-warning";
  }

  return "grid size-9 shrink-0 place-items-center rounded-md bg-surface-soft text-tesText-secondary";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
