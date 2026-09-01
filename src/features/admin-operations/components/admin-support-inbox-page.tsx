import Link from "next/link";
import { ArrowRight, CircleDot, Search, SlidersHorizontal } from "lucide-react";

import {
  AppPageContainer,
  AppPageHeader,
  AppPageSection,
} from "@/components/app-page";
import { TESButton } from "@/components/tes/tes-button";
import { supportTicketCategories } from "@/features/support/support-contracts";
import {
  formatSupportTicketProtocol,
  getSupportTicketCategoryLabel,
  getSupportTicketStatusPresentation,
} from "@/features/support/support-ticket-presentation";
import { SupportTicketStatusBadge } from "@/features/support/components/support-ticket-status-badge";
import { routes } from "@/lib/routes";

import {
  adminSupportAssignments,
  adminSupportPersonas,
  adminSupportPriorities,
  adminSupportStatuses,
  buildAdminSupportInboxHref,
  type AdminSupportInboxData,
} from "../admin-support-inbox";

export function AdminSupportInboxPage({
  data,
}: {
  data: AdminSupportInboxData;
}) {
  const { query } = data;
  const hasFilters = Boolean(
    query.search ||
    query.status ||
    query.priority ||
    query.category ||
    query.persona ||
    query.assignment,
  );
  const attentionHref = buildAdminSupportInboxHref(query, {
    page: 1,
    status: query.status === "waiting_support" ? "" : "waiting_support",
  });

  return (
    <AppPageContainer className="max-w-[1320px] py-5 lg:py-6">
      <div className="space-y-5">
        <AppPageHeader eyebrow="Administração" title="Suporte">
          Acompanhe solicitações de pacientes e terapeutas e priorize o que
          precisa de atenção.
        </AppPageHeader>

        <AppPageSection className="space-y-5">
          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-brand-deep">
                Inbox de atendimento
              </h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                Chamados que aguardam a equipe aparecem primeiro; os mais
                antigos em atendimento não ficam escondidos.
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-brand-lavender bg-brand-lavenderSoft px-4 text-sm font-extrabold text-brand-deep outline-none transition hover:bg-white focus-visible:ring-4 focus-visible:ring-ring/20"
              href={attentionHref}
            >
              <CircleDot
                aria-hidden="true"
                className="size-4 text-brand-primary"
              />
              Precisa de atenção{" "}
              <span
                aria-label={`${data.attentionCount} chamados aguardando a equipe`}
              >
                {data.attentionCount}
              </span>
            </Link>
          </div>

          <form
            action={routes.admin.support}
            className="grid gap-3 rounded-2xl bg-surface-soft p-3 lg:grid-cols-[minmax(0,1fr)_repeat(5,minmax(130px,0.45fr))_auto]"
            method="get"
          >
            <label className="relative block lg:col-span-2">
              <span className="sr-only">Buscar chamados</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-primary"
              />
              <input
                className="min-h-11 w-full rounded-xl border border-border bg-white py-2 pl-10 pr-3 text-sm font-semibold text-brand-deep outline-none placeholder:text-tesText-muted focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
                defaultValue={query.search}
                name="q"
                placeholder="Protocolo, assunto ou solicitante"
                type="search"
              />
            </label>
            <FilterSelect
              label="Status"
              name="status"
              options={statusOptions()}
              value={query.status}
            />
            <FilterSelect
              label="Prioridade"
              name="priority"
              options={priorityOptions()}
              value={query.priority}
            />
            <FilterSelect
              label="Categoria"
              name="category"
              options={supportTicketCategories.map((value) => ({
                label: getSupportTicketCategoryLabel(value),
                value,
              }))}
              value={query.category}
            />
            <FilterSelect
              label="Perfil"
              name="persona"
              options={adminSupportPersonas.map((value) => ({
                label: personaLabel(value),
                value,
              }))}
              value={query.persona}
            />
            <FilterSelect
              label="Responsável"
              name="assignment"
              options={adminSupportAssignments.map((value) => ({
                label: value === "me" ? "Atribuído a mim" : "Não atribuído",
                value,
              }))}
              value={query.assignment}
            />
            <input name="pageSize" type="hidden" value={query.pageSize} />
            <div className="flex gap-2 lg:col-start-7">
              <TESButton className="flex-1" size="sm" type="submit">
                <SlidersHorizontal aria-hidden="true" className="size-4" />{" "}
                Filtrar
              </TESButton>
              {hasFilters ? (
                <TESButton
                  href={routes.admin.support}
                  size="sm"
                  variant="secondary"
                >
                  Limpar
                </TESButton>
              ) : null}
            </div>
          </form>

          {data.rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-lavender bg-white px-5 py-10 text-center">
              <h3 className="text-lg font-extrabold text-brand-deep">
                {hasFilters
                  ? "Nenhum chamado corresponde aos filtros"
                  : "Nenhum chamado por aqui"}
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-tesText-secondary">
                {hasFilters
                  ? "Ajuste ou limpe os filtros para voltar à Inbox completa."
                  : "Quando uma solicitação chegar, ela aparecerá aqui com o contexto necessário para o atendimento."}
              </p>
              {hasFilters ? (
                <TESButton
                  className="mt-5"
                  href={routes.admin.support}
                  size="sm"
                  variant="secondary"
                >
                  Limpar filtros
                </TESButton>
              ) : null}
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
              {data.rows.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} />
              ))}
            </div>
          )}

          {data.page.total > data.page.pageSize ? (
            <nav
              aria-label="Paginação dos chamados"
              className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
            >
              <p className="text-sm font-semibold text-tesText-secondary">
                Página {data.page.page} · {data.page.total} chamados
              </p>
              <div className="flex gap-2">
                {data.page.page > 1 ? (
                  <TESButton
                    href={buildAdminSupportInboxHref(query, {
                      page: data.page.page - 1,
                    })}
                    size="sm"
                    variant="secondary"
                  >
                    Anterior
                  </TESButton>
                ) : null}
                {data.page.hasNext ? (
                  <TESButton
                    href={buildAdminSupportInboxHref(query, {
                      page: data.page.page + 1,
                    })}
                    size="sm"
                    variant="secondary"
                  >
                    Próxima
                  </TESButton>
                ) : null}
              </div>
            </nav>
          ) : null}
        </AppPageSection>
      </div>
    </AppPageContainer>
  );
}

function TicketRow({
  ticket,
}: {
  ticket: AdminSupportInboxData["rows"][number];
}) {
  const needsAttention = ticket.status === "waiting_support";
  return (
    <Link
      className={`group block px-4 py-4 outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/20 sm:px-5 ${needsAttention ? "border-l-4 border-brand-primary pl-3 sm:pl-4" : ""}`}
      href={routes.admin.supportDetail(ticket.id)}
    >
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(200px,0.9fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-extrabold text-brand-deep">
              {ticket.subject}
            </h3>
            <SupportTicketStatusBadge status={ticket.status} viewer="admin" />
          </div>
          <p className="mt-1 text-sm font-semibold text-tesText-secondary">
            {formatSupportTicketProtocol(ticket.protocol)} ·{" "}
            {ticket.requesterName ?? "Solicitante"} ·{" "}
            {personaLabel(ticket.requesterRole)}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-tesText-secondary">
          <span>{getSupportTicketCategoryLabel(ticket.category)}</span>
          <span>Prioridade {priorityLabel(ticket.priority)}</span>
          {ticket.assignedAdminName ? (
            <span>Com {ticket.assignedAdminName}</span>
          ) : (
            <span>Sem responsável</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 text-sm font-semibold text-tesText-secondary lg:justify-end">
          <span>{relativeDate(ticket.lastActivityAt)}</span>
          <ArrowRight
            aria-hidden="true"
            className="size-4 text-brand-primary transition group-hover:translate-x-0.5"
          />
        </div>
      </div>
    </Link>
  );
}

function FilterSelect({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
        defaultValue={value}
        name={name}
      >
        <option value="">{label}: todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function statusOptions() {
  return adminSupportStatuses.map((value) => ({
    label: getSupportTicketStatusPresentation(value, "admin").label,
    value,
  }));
}
function priorityOptions() {
  return adminSupportPriorities.map((value) => ({
    label: priorityLabel(value),
    value,
  }));
}
function priorityLabel(value: string) {
  return (
    (
      {
        low: "Baixa",
        normal: "Normal",
        high: "Alta",
        urgent: "Urgente",
      } as Record<string, string>
    )[value] ?? value
  );
}
function personaLabel(value: string | null) {
  return value === "patient"
    ? "Paciente"
    : value === "therapist"
      ? "Terapeuta"
      : "Perfil não identificado";
}
function relativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Atividade recente";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60_000),
  );
  if (minutes < 2) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours} h`;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
}
