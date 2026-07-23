import { formatShortDate } from "./patient-overview.formatters";
import type { PatientSupportTicket } from "./patient-overview.types";

export function PatientSupportTicketCard({
  ticket,
}: {
  ticket: PatientSupportTicket;
}) {
  const labels = {
    in_review: "Em análise",
    open: "Aberto",
    resolved: "Resolvido",
  } as const;
  const classNames = {
    in_review: "bg-status-warningBg text-status-warning",
    open: "bg-brand-lavenderSoft text-brand-primary",
    resolved: "bg-status-successBg text-status-success",
  } as const;

  return (
    <article className="rounded-md border border-[var(--tes-color-border)] p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xs font-medium text-[var(--tes-color-primary-dark)]">
          {ticket.subject}
        </h3>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-medium ${classNames[ticket.status]}`}
        >
          {labels[ticket.status]}
        </span>
      </div>
      <p className="mt-4 text-[11px] leading-4 text-[var(--tes-color-text-secondary-app)]">
        {ticket.description ??
          ticket.resolutionSummary ??
          "Atualização indisponível."}
      </p>
      <time
        className="mt-3 block text-right text-[10px] text-[var(--tes-color-text-secondary-app)]"
        dateTime={ticket.createdAt}
      >
        {formatShortDate(ticket.createdAt)}
      </time>
    </article>
  );
}
