import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

import { buildAdminListHref } from "@/features/admin-shared/admin-list-query";

import type {
  AdminOperationAuditEvent,
  AdminOperationDetailPageData,
  AdminOperationField,
  AdminOperationPageData,
  AdminOperationRow,
} from "../admin-operations.types";

type ProductTone =
  | "danger"
  | "info"
  | "muted"
  | "primary"
  | "success"
  | "warning";

export function ProductBackLink({
  href,
  label = "Voltar",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-lavender/70 bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
      href={href as Route<string>}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}

export function ProductBreadcrumbs({
  items,
}: {
  items: Array<{ href?: string; label: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span
            className="flex items-center gap-2"
            key={`${item.label}-${index}`}
          >
            {item.href && !isLast ? (
              <Link
                className="text-sm font-extrabold text-brand-primary outline-none transition hover:text-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
                href={item.href as Route<string>}
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-sm font-extrabold text-tesText-secondary">
                {item.label}
              </span>
            )}
            {!isLast ? (
              <span aria-hidden="true" className="text-tesText-muted">
                ›
              </span>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}

export function EditorialHeader({
  eyebrow = "Admin",
  subtitle,
  title,
}: {
  eyebrow?: string;
  subtitle: string;
  title: string;
}) {
  return (
    <header>
      <p className="text-xs font-extrabold uppercase tracking-[0.42em] text-brand-primary">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-display text-[3.15rem] font-normal italic leading-[0.95] text-brand-deep sm:text-[4.4rem]">
        {title}
      </h1>
      <p className="mt-4 max-w-[860px] text-base font-semibold leading-7 text-tesText-secondary sm:text-lg">
        {subtitle}
      </p>
    </header>
  );
}

export function IdentityHero({
  badges,
  details,
  meta,
  name,
  title,
}: {
  badges: Array<{ label: string; tone?: ProductTone }>;
  details: Array<{ label: string; value: string }>;
  meta?: Array<{ label: string; value: string }>;
  name: string;
  title: string;
}) {
  return (
    <section className="rounded-[32px] border border-brand-lavender/70 bg-white p-6 shadow-[0_24px_70px_rgba(20,16,90,0.11)] sm:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <MonogramAvatar name={name} />
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-primary">
              {title}
            </p>
            <h2 className="mt-2 text-3xl font-extrabold text-brand-deep sm:text-[2.35rem]">
              {name}
            </h2>
            {badges.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <ProductBadge
                    key={`${badge.label}-${badge.tone ?? "primary"}`}
                    label={badge.label}
                    tone={badge.tone}
                  />
                ))}
              </div>
            ) : null}
            {details.length > 0 ? (
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {details.map((detail) => (
                  <div key={detail.label}>
                    <dt className="text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">
                      {detail.label}
                    </dt>
                    <dd className="mt-1 text-sm font-extrabold text-brand-deep">
                      {detail.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>

        {meta && meta.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:min-w-[300px] xl:grid-cols-1">
            {meta.map((item) => (
              <article
                className="rounded-[24px] border border-brand-lavender/60 bg-surface-soft p-4"
                key={item.label}
              >
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-tesText-muted">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-extrabold leading-6 text-brand-deep">
                  {item.value}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function StatsGrid({
  items,
}: {
  items: Array<{ description?: string; label: string; value: string }>;
}) {
  if (items.length === 0) return null;

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article
          className="rounded-[24px] border border-brand-lavender/70 bg-white p-5 shadow-[0_20px_55px_rgba(20,16,90,0.08)]"
          key={item.label}
        >
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-12 place-items-center rounded-[18px] bg-brand-lavenderSoft text-brand-primary">
              <CalendarDays aria-hidden="true" className="size-5" />
            </span>
            <span className="rounded-full bg-surface-soft px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-tesText-secondary">
              Atual
            </span>
          </div>
          <p className="mt-5 text-sm font-extrabold text-tesText-secondary">
            {item.label}
          </p>
          <p className="mt-2 text-[2.2rem] font-extrabold leading-none text-brand-deep">
            {item.value}
          </p>
          {item.description ? (
            <p className="mt-3 text-sm font-semibold leading-6 text-tesText-muted">
              {item.description}
            </p>
          ) : null}
        </article>
      ))}
    </section>
  );
}

export function DetailSectionCard({
  description,
  fields,
  title,
}: {
  description?: string;
  fields: AdminOperationField[];
  title: string;
}) {
  if (fields.length === 0) return null;

  return (
    <section className="rounded-[28px] border border-brand-lavender/70 bg-white p-6 shadow-[0_22px_60px_rgba(20,16,90,0.09)]">
      <h2 className="text-2xl font-extrabold text-brand-deep">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {description}
        </p>
      ) : null}
      <dl className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => (
          <div
            className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4"
            key={`${title}-${field.label}`}
          >
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">
              {field.label}
            </dt>
            <dd className="mt-2 break-words text-sm font-extrabold leading-6 text-brand-deep">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function AsideCard({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-[28px] border border-brand-lavender/70 bg-white p-5 shadow-[0_22px_60px_rgba(20,16,90,0.09)]">
      <h2 className="text-lg font-extrabold text-brand-deep">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ProductHistory({
  events,
}: {
  events: AdminOperationAuditEvent[];
}) {
  if (events.length === 0) {
    return (
      <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
        Ainda não há movimentações administrativas recentes para este registro.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li
          className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4"
          key={event.id}
        >
          <p className="text-sm font-extrabold text-brand-deep">
            {formatAuditActionLabel(event.action)}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">
            {formatDateTime(event.createdAt)}
          </p>
          {event.reason ? (
            <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
              {event.reason}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function ProductPagination({ data }: { data: AdminOperationPageData }) {
  const start =
    data.page.total === 0 ? 0 : (data.page.page - 1) * data.page.pageSize + 1;
  const end = Math.min(data.page.page * data.page.pageSize, data.page.total);
  const previousHref = buildAdminListHref(data.listHref, data.query, {
    page: Math.max(data.page.page - 1, 1),
  });
  const nextHref = buildAdminListHref(data.listHref, data.query, {
    page: data.page.page + 1,
  });

  return (
    <div className="flex flex-col gap-3 border-t border-brand-lavender/60 px-5 py-4 text-sm font-bold text-tesText-secondary sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <p>
        Mostrando {start}-{end} de {data.page.total} registros
      </p>
      <div className="flex gap-2">
        <Link
          aria-disabled={data.page.page <= 1}
          className={paginationLinkClass(data.page.page <= 1)}
          href={previousHref as Route<string>}
          tabIndex={data.page.page <= 1 ? -1 : undefined}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Anterior
        </Link>
        <Link
          aria-disabled={!data.page.hasNext}
          className={paginationLinkClass(!data.page.hasNext)}
          href={nextHref as Route<string>}
          tabIndex={!data.page.hasNext ? -1 : undefined}
        >
          Próxima
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </div>
  );
}

export function HonestState({
  message,
  title,
  tone = "muted",
}: {
  message: string;
  title: string;
  tone?: "muted" | "warning";
}) {
  return (
    <div className="grid min-h-[220px] place-items-center px-6 py-10 text-center">
      <div className="max-w-md">
        <span
          className={`mx-auto grid size-14 place-items-center rounded-full ${
            tone === "warning"
              ? "bg-status-warningBg text-status-warning"
              : "bg-brand-lavenderSoft text-brand-primary"
          }`}
        >
          <ShieldCheck aria-hidden="true" className="size-6" />
        </span>
        <h3 className="mt-4 text-xl font-extrabold text-brand-deep">{title}</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {message}
        </p>
      </div>
    </div>
  );
}

export function ProductBadge({
  label,
  tone = "primary",
}: {
  label: string;
  tone?: ProductTone;
}) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-extrabold ${badgeToneClass(
        tone,
      )}`}
    >
      {label}
    </span>
  );
}

export function fieldMap(fields: AdminOperationField[]) {
  return new Map(fields.map((field) => [field.label, field.value]));
}

export function findSection(data: AdminOperationDetailPageData, title: string) {
  return data.sections.find((section) => section.title === title);
}

export function formatStatusLabel(value?: string) {
  const key = (value ?? "").trim().toLowerCase();

  if (!key) return "";

  const labels: Record<string, string> = {
    active: "Ativo",
    approved: "Aprovado",
    anonymized: "Anonimizado",
    changes_requested: "Ajustes solicitados",
    completed: "Concluída",
    confirmed: "Confirmada",
    deleted: "Excluído",
    draft: "Perfil em construção",
    hidden: "Oculta",
    in_progress: "Em andamento",
    in_review: "Em análise",
    open: "Aberto",
    pending: "Pendente",
    pending_payment: "Pagamento pendente",
    published: "Publicada",
    refunded: "Reembolsada",
    rejected: "Não aprovado",
    reported: "Sinalizada",
    resolved: "Resolvido",
    submitted: "Aguardando análise",
    success: "Disponível",
    suspended: "Suspenso",
  };

  return labels[key] ?? sentenceCase(value ?? "");
}

export function formatPlanLabel(value?: string) {
  const key = (value ?? "").trim().toLowerCase();

  if (!key) return "";

  if (key === "premium_plus") return "Premium Plus";
  if (key === "premium") return "Premium";
  if (key === "free") return "Free";

  return sentenceCase(value ?? "");
}

export function formatAuditActionLabel(value?: string) {
  const key = (value ?? "").trim().toLowerCase();

  if (!key) return "Atualização administrativa";

  const labels: Record<string, string> = {
    "professional.reactivate": "Profissional reativado",
    "professional.suspend": "Profissional suspenso",
    "review.hide": "Avaliação ocultada",
    "review.restore": "Avaliação restaurada",
    "support.reopen": "Atendimento reaberto",
    "support.resolve": "Atendimento concluído",
    "verification.approve": "Verificação aprovada",
    "verification.pause_review": "Ajustes solicitados",
    "verification.reject": "Verificação não aprovada",
    "verification.reopen_review": "Análise iniciada ou reaberta",
    "verification.request_changes": "Ajustes solicitados",
  };

  return labels[key] ?? sentenceCase(value ?? "");
}

export function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Data indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function buildMonogram(name: string) {
  const clean = name.trim();

  if (!clean) return "AD";

  const parts = clean.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function compactValue(value?: string) {
  if (!value) return "";
  if (value === "Sim" || value === "Não") return value;
  if (value === "Indisponível" || value === "Acesso restrito") return value;
  return value;
}

export function isTruthyProductValue(value?: string) {
  return Boolean(value && value !== "Não" && value !== "Indisponível");
}

export function getRowField(row: AdminOperationRow, label: string) {
  return row.fields.find((field) => field.label === label)?.value ?? "";
}

function sentenceCase(value: string) {
  const normalized = value.replaceAll("_", " ").trim();
  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "";
}

function MonogramAvatar({ name }: { name: string }) {
  return (
    <div className="grid size-24 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_top,_rgba(174,148,195,0.55),_rgba(129,186,224,0.18)_60%,_rgba(255,255,255,1)_100%)] text-[1.7rem] font-extrabold text-brand-deep shadow-[0_22px_44px_rgba(20,16,90,0.14)] sm:size-28">
      {buildMonogram(name)}
    </div>
  );
}

function badgeToneClass(tone: ProductTone) {
  if (tone === "success") {
    return "bg-status-successBg text-status-success";
  }

  if (tone === "warning") {
    return "bg-status-warningBg text-status-warning";
  }

  if (tone === "danger") {
    return "bg-status-dangerBg text-status-danger";
  }

  if (tone === "info") {
    return "bg-status-infoBg text-status-info";
  }

  if (tone === "muted") {
    return "bg-surface-soft text-tesText-secondary";
  }

  return "bg-brand-lavenderSoft text-brand-primary";
}

function paginationLinkClass(disabled: boolean) {
  const base =
    "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-extrabold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20";

  return disabled
    ? `${base} pointer-events-none border-brand-lavender/60 bg-surface-soft text-tesText-muted`
    : `${base} border-brand-lavender/70 bg-white text-brand-primary hover:border-brand-primary hover:bg-brand-lavenderSoft`;
}
