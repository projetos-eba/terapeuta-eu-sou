import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Gauge,
  LockKeyhole,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page";
import { TESButton } from "@/components/tes/tes-button";
import {
  AsideCard,
  EditorialHeader,
} from "@/features/admin-operations/components/admin-operation-display";

import type {
  AdminReleaseCheck,
  AdminSettingsGroup,
  AdminSettingsPageData,
  AdminSettingsSignal,
} from "../admin-settings.types";

export function AdminSettingsPage({ data }: { data: AdminSettingsPageData }) {
  const signals = data.groups.flatMap((group) => group.items);
  const healthyCount = signals.filter(
    (item) => item.status === "healthy",
  ).length;
  const reviewCount = signals.filter(
    (item) => item.status === "manual_review",
  ).length;
  const attentionCount = signals.length - healthyCount - reviewCount;

  return (
    <AppPageContainer className="max-w-[1166px] py-5 lg:py-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <EditorialHeader
            subtitle="Acompanhe políticas, recursos e integrações que sustentam a operação da plataforma."
            title="Configurações"
          />
          <span className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-brand-lavender/70 bg-white px-4 text-sm font-extrabold text-brand-primary shadow-[0_12px_30px_rgba(20,16,90,0.07)]">
            <LockKeyhole aria-hidden="true" className="size-4" />
            Visão supervisionada
          </span>
        </div>

        <nav
          aria-label="Seções de configurações"
          className="flex gap-2 overflow-x-auto rounded-[22px] border border-brand-lavender/70 bg-white p-2 shadow-[0_14px_40px_rgba(20,16,90,0.07)]"
        >
          {data.groups.map((group, index) => (
            <a
              className={`inline-flex min-h-11 shrink-0 items-center rounded-[16px] px-4 text-sm font-extrabold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20 ${
                index === 0
                  ? "bg-brand-lavenderSoft text-brand-deep"
                  : "text-tesText-secondary hover:bg-surface-soft hover:text-brand-deep"
              }`}
              href={`#settings-${group.key}`}
              key={group.key}
            >
              {group.title}
            </a>
          ))}
        </nav>

        <section className="grid gap-4 md:grid-cols-3">
          <SummaryMetric
            description="Itens disponíveis sem alerta."
            label="Operacionais"
            tone="success"
            value={healthyCount}
          />
          <SummaryMetric
            description="Itens que pedem conferência humana."
            label="Em acompanhamento"
            tone="warning"
            value={reviewCount}
          />
          <SummaryMetric
            description="Itens que precisam de atenção."
            label="Com atenção"
            tone="danger"
            value={attentionCount}
          />
        </section>

        <AppPageGrid className="gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
          <AppPageMain className="space-y-5">
            {data.groups.map((group) => (
              <SettingsGroup group={group} key={group.key} />
            ))}
          </AppPageMain>

          <AppPageAside className="space-y-5">
            <AsideCard title="Proteção das configurações">
              <div className="space-y-3">
                {data.secretPolicy.map((policy) => (
                  <p
                    className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary"
                    key={policy}
                  >
                    {policy}
                  </p>
                ))}
              </div>
            </AsideCard>

            <AsideCard title="Revisão da operação">
              <div className="space-y-3">
                {data.releaseChecks.map((check) => (
                  <ReleaseCheck check={check} key={check.key} />
                ))}
              </div>
            </AsideCard>

            <AsideCard title="Última leitura">
              <div className="flex items-start gap-3 rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4">
                <Clock3
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-brand-primary"
                />
                <p className="text-sm font-semibold leading-6 text-tesText-secondary">
                  Informações atualizadas em {formatDateTime(data.generatedAt)}.
                </p>
              </div>
            </AsideCard>
          </AppPageAside>
        </AppPageGrid>
      </div>
    </AppPageContainer>
  );
}

function SettingsGroup({ group }: { group: AdminSettingsGroup }) {
  return (
    <section
      className="scroll-mt-6 rounded-[28px] border border-brand-lavender/70 bg-white p-5 shadow-[0_22px_60px_rgba(20,16,90,0.09)] sm:p-6"
      id={`settings-${group.key}`}
    >
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-[18px] bg-brand-lavenderSoft text-brand-primary">
          <Settings2 aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-2xl font-extrabold text-brand-deep">
            {group.title}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {group.description}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {group.items.map((item) => (
          <SettingsSignal item={item} key={item.key} />
        ))}
      </div>
    </section>
  );
}

function SettingsSignal({ item }: { item: AdminSettingsSignal }) {
  return (
    <article className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-brand-deep">
            {item.label}
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {item.description}
          </p>
        </div>
        <StatusBadge status={item.status} tone={item.tone} />
      </div>
      {item.href && item.actionLabel ? (
        <TESButton
          className="mt-4 w-full sm:w-auto"
          href={item.href}
          size="sm"
          variant="secondary"
        >
          {item.actionLabel}
          <ArrowRight aria-hidden="true" className="size-4" />
        </TESButton>
      ) : null}
    </article>
  );
}

function SummaryMetric({
  description,
  label,
  tone,
  value,
}: {
  description: string;
  label: string;
  tone: "danger" | "success" | "warning";
  value: number;
}) {
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "warning"
        ? Gauge
        : AlertTriangle;
  const iconClass =
    tone === "success"
      ? "bg-status-successBg text-status-success"
      : tone === "warning"
        ? "bg-status-warningBg text-status-warning"
        : "bg-status-dangerBg text-status-danger";

  return (
    <article className="rounded-[24px] border border-brand-lavender/70 bg-white p-5 shadow-[0_20px_55px_rgba(20,16,90,0.08)]">
      <span
        className={`grid size-11 place-items-center rounded-[16px] ${iconClass}`}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="mt-4 text-sm font-extrabold text-tesText-secondary">
        {label}
      </p>
      <p className="mt-2 text-[2.35rem] font-extrabold leading-none text-brand-deep">
        {value}
      </p>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-muted">
        {description}
      </p>
    </article>
  );
}

function ReleaseCheck({ check }: { check: AdminReleaseCheck }) {
  return (
    <article className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4">
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
    configuration_missing: "Atenção",
    degraded: "Atenção",
    healthy: "Operacional",
    manual_review: "Acompanhar",
    unavailable: "Indisponível",
  }[status];

  return (
    <span className="inline-flex min-h-8 w-fit shrink-0 items-center rounded-full border border-brand-lavender/60 bg-white px-3 py-1 text-xs font-extrabold text-tesText-secondary">
      <span className={toneClass(tone)} />
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: AdminReleaseCheck["status"] }) {
  const Icon =
    status === "healthy"
      ? ShieldCheck
      : status === "manual_review"
        ? Clock3
        : AlertTriangle;
  return (
    <span className={statusIconClass(status)}>
      <Icon aria-hidden="true" className="size-4" />
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
    return "grid size-9 shrink-0 place-items-center rounded-[14px] bg-status-successBg text-status-success";
  }
  if (status === "configuration_missing" || status === "degraded") {
    return "grid size-9 shrink-0 place-items-center rounded-[14px] bg-status-warningBg text-status-warning";
  }
  return "grid size-9 shrink-0 place-items-center rounded-[14px] bg-brand-lavenderSoft text-brand-primary";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "horário indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
