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
            data.auditEvents.map((event) => (
              <AuditEvent event={event} key={event.id} />
            ))
          )}
        </div>
      </AppPageSection>
    </AppPageContainer>
  );
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
