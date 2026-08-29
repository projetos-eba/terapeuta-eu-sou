import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  AppPageContainer,
  AppPageHeader,
  AppPageSection,
} from "@/components/app-page";

import { getAdminAuditEventLabel } from "../admin-audit-catalog";
import type { AdminSecurityPageData } from "../admin-platform.types";

export function AdminSecurityPage({ data }: { data: AdminSecurityPageData }) {
  return (
    <AppPageContainer className="max-w-[1440px] py-5 lg:py-6">
      <AppPageHeader eyebrow="Admin" title="Segurança">
        Consulte os registros recentes das ações administrativas.
      </AppPageHeader>

      <AppPageSection className="mx-auto w-full max-w-4xl">
        <h2 className="text-xl font-extrabold text-brand-deep">
          Auditoria recente
        </h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Registros recentes das ações administrativas.
        </p>

        <div className="mt-5 space-y-3">
          {data.auditEventsStatus === "unavailable" ? (
            <p className="rounded-md border border-status-warning bg-status-warningBg p-3 text-sm font-bold text-status-warning">
              Os registros de auditoria estão indisponíveis no momento. Tente
              novamente mais tarde.
            </p>
          ) : data.auditEvents.length === 0 ? (
            <p className="rounded-md bg-surface-muted p-3 text-sm font-bold text-tesText-secondary">
              Sem eventos administrativos recentes acessíveis.
            </p>
          ) : (
            <>
              {data.auditEvents.map((event) => (
                <AuditEvent event={event} key={event.id} />
              ))}
              <AuditPagination page={data.auditPage} />
            </>
          )}
        </div>
      </AppPageSection>
    </AppPageContainer>
  );
}

function AuditPagination({
  page,
}: {
  page: AdminSecurityPageData["auditPage"];
}) {
  const start = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const end = Math.min(page.page * page.pageSize, page.total);
  const previousHref = page.page <= 2
    ? "/admin/seguranca"
    : `/admin/seguranca?page=${page.page - 1}`;
  const nextHref = `/admin/seguranca?page=${page.page + 1}`;

  return (
    <nav
      aria-label="Paginação da auditoria"
      className="flex flex-col gap-3 border-t border-border pt-4 text-sm font-bold text-tesText-secondary sm:flex-row sm:items-center sm:justify-between"
    >
      <p>
        Mostrando {start}-{end} de {page.total} registros
      </p>
      <div className="flex gap-2">
        <Link
          aria-disabled={page.page <= 1}
          className={paginationLinkClass(page.page <= 1)}
          href={previousHref as Route<string>}
          tabIndex={page.page <= 1 ? -1 : undefined}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Anterior
        </Link>
        <Link
          aria-disabled={!page.hasNext}
          className={paginationLinkClass(!page.hasNext)}
          href={nextHref as Route<string>}
          tabIndex={!page.hasNext ? -1 : undefined}
        >
          Próxima
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </nav>
  );
}

function paginationLinkClass(disabled: boolean) {
  const base =
    "inline-flex min-h-10 items-center gap-2 rounded-md border px-4 text-sm font-extrabold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20";

  return disabled
    ? `${base} pointer-events-none border-border bg-surface-muted text-tesText-muted`
    : `${base} border-brand-primary/40 bg-white text-brand-deep hover:bg-brand-lavender/20`;
}

function AuditEvent({
  event,
}: {
  event: AdminSecurityPageData["auditEvents"][number];
}) {
  const label = getAdminAuditEventLabel(event);

  return (
    <article className="rounded-md border border-border bg-surface-muted p-3">
      <p className="text-sm font-extrabold text-brand-deep">{label.action}</p>
      <p className="mt-1 text-xs font-bold text-tesText-secondary">
        {label.entityType} · {label.actorRole} ·{" "}
        {formatDateTime(event.createdAt)}
      </p>
      {event.reason ? (
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {event.reason}
        </p>
      ) : null}
    </article>
  );
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
