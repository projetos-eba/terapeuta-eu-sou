"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Info,
  MoreHorizontal,
  Plus,
  Repeat2,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import { TESDialog } from "@/components/tes";
import {
  TherapistBlockReason,
  TherapistBlockRecurrence,
  type TherapistBlock,
  type TherapistBlockImpact,
  type TherapistPaidBlockConflict,
  type TherapistBlocksReadModel,
  type TherapistScheduleService,
} from "@/domain/tes";
import { TherapistAgendaHeader } from "@/features/therapist-agenda/components/therapist-agenda-chrome";
import { routes } from "@/lib/routes";

type CommandState =
  | { message: string; status: "error" | "success" }
  | { status: "idle" | "saving" };

type ViewType = "all" | "all-day" | "partial" | "recurring";

const reasonOptions = [
  { label: "Compromisso pessoal", value: TherapistBlockReason.Personal },
  { label: "Férias ou descanso", value: TherapistBlockReason.Vacation },
  {
    label: "Atividade administrativa",
    value: TherapistBlockReason.Administrative,
  },
  { label: "Curso ou formação", value: TherapistBlockReason.Training },
  { label: "Saúde e autocuidado", value: TherapistBlockReason.Health },
  { label: "Outro motivo", value: TherapistBlockReason.Other },
] as const;

const typeFilters: Array<{ label: string; value: ViewType }> = [
  { label: "Todos", value: "all" },
  { label: "Dia inteiro", value: "all-day" },
  { label: "Faixa de horário", value: "partial" },
  { label: "Recorrente", value: "recurring" },
];

export function TherapistBlocksPanel({
  initialData,
  services,
}: {
  initialData: TherapistBlocksReadModel;
  services: TherapistScheduleService[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<TherapistBlock | null>(null);
  const [command, setCommand] = useState<CommandState>({ status: "idle" });
  const [paidConflicts, setPaidConflicts] = useState<
    TherapistPaidBlockConflict[]
  >([]);
  const [search, setSearch] = useState(searchParams.get("busca") ?? "");
  const [viewType, setViewType] = useState<ViewType>("all");

  const activeServices = useMemo(
    () => services.filter((service) => service.status === "active"),
    [services],
  );
  const visibleBlocks = useMemo(
    () =>
      initialData.blocks.filter((block) => {
        if (viewType === "all-day") return block.allDay;
        if (viewType === "partial") return !block.allDay;
        if (viewType === "recurring") {
          return block.recurrenceFrequency !== "none";
        }
        return true;
      }),
    [initialData.blocks, viewType],
  );
  const pendingImpacts = useMemo(
    () =>
      initialData.blocks.flatMap((block) =>
        block.impactedBookings
          .filter((impact) => impact.status === "pending")
          .map((impact) => ({ block, impact })),
      ),
    [initialData.blocks],
  );
  const affectedPatients = new Set(
    pendingImpacts.map(({ impact }) => impact.patientName),
  ).size;
  const allDayCount = initialData.blocks.filter(
    (block) => block.status === "active" && block.allDay,
  ).length;
  const partialCount = initialData.blocks.filter(
    (block) => block.status === "active" && !block.allDay,
  ).length;

  function applyFilters(next: {
    period?: string;
    reason?: string;
    search?: string;
    status?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("aba", "bloqueios");
    setOrDelete(params, "busca", next.search);
    setOrDelete(params, "motivo", next.reason);
    setOrDelete(params, "periodo", next.period);
    setOrDelete(params, "status", next.status);
    router.replace(`${routes.therapist.agenda}?${params.toString()}`);
  }

  async function runCommand(body: Record<string, unknown>) {
    setCommand({ status: "saving" });

    try {
      const response = await fetch("/api/therapist/blocks", {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: {
          impactedBookingCount?: number;
          paidImpactedBookings?: TherapistPaidBlockConflict[];
        };
        error?: { message?: string };
        ok?: boolean;
      } | null;

      if (!response.ok || !payload?.ok) {
        setCommand({
          message:
            payload?.error?.message ??
            "Não foi possível atualizar o bloqueio agora.",
          status: "error",
        });
        return false;
      }

      const impacted = payload.data?.impactedBookingCount ?? 0;
      if (body.action === "create") {
        setPaidConflicts(payload.data?.paidImpactedBookings ?? []);
      }
      setCommand({
        message:
          impacted > 0
            ? `Bloqueio criado. ${impacted} sessão(ões) precisam de revisão.`
            : "Bloqueio salvo com sucesso.",
        status: "success",
      });
      router.refresh();
      return true;
    } catch {
      setCommand({
        message: "Não foi possível atualizar seus bloqueios agora.",
        status: "error",
      });
      return false;
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1210px] pb-14 text-tesText-primary">
      <TherapistAgendaHeader
        activeTab="bloqueios"
        actions={
          <button
            aria-label="Novo bloqueio"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 text-sm font-extrabold text-white shadow-float transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            onClick={() => {
            setCommand({ status: "idle" });
              setPaidConflicts([]);
              setCreateOpen(true);
            }}
            type="button"
          >
            <Plus aria-hidden="true" size={18} />
            Criar bloqueio
          </button>
        }
      />

      {command.status === "error" || command.status === "success" ? (
        <FeedbackMessage command={command} />
      ) : null}

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-5">
          <section className="overflow-hidden rounded-[16px] border border-brand-lavender/80 bg-white shadow-card">
            <header className="px-5 pb-4 pt-5 sm:px-6">
              <h2 className="text-lg font-extrabold text-brand-deep">
                Bloqueios e indisponibilidades
              </h2>
              <p className="mt-1 text-sm font-semibold text-tesText-secondary">
                Gerencie os períodos em que você não estará disponível para
                atendimentos.
              </p>
            </header>

            <BlockFilters
              onApply={applyFilters}
              onSearchChange={setSearch}
              period={searchParams.get("periodo") ?? "30"}
              reason={searchParams.get("motivo") ?? ""}
              search={search}
              status={searchParams.get("status") ?? "active"}
            />

            <div
              aria-label="Tipo de bloqueio"
              className="flex gap-2 overflow-x-auto px-5 pb-4 sm:px-6"
            >
              {typeFilters.map((filter) => (
                <button
                  aria-pressed={viewType === filter.value}
                  className={`min-h-10 shrink-0 rounded-lg border px-4 text-xs font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
                    viewType === filter.value
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-lavender bg-white text-brand-deep hover:border-brand-primary"
                  }`}
                  key={filter.value}
                  onClick={() => setViewType(filter.value)}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div aria-label="Lista de bloqueios">
              {visibleBlocks.length === 0 ? (
                <EmptyBlocks onCreate={() => setCreateOpen(true)} />
              ) : (
                visibleBlocks.map((block) => (
                  <CompactBlockRow
                    block={block}
                    busy={command.status === "saving"}
                    key={block.id}
                    onCancel={() => setCancelTarget(block)}
                  />
                ))
              )}
            </div>
          </section>

          <MonthOverview
            blocks={initialData.blocks}
            timezone={initialData.timezone}
          />
          <BlockingRules timezone={initialData.timezone} />
        </div>

        <aside className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <BlocksSummary
            allDay={allDayCount}
            partial={partialCount}
            recurring={initialData.summary.recurringSeries}
            total={initialData.summary.activeBlocks}
          />
          <ImpactsCard
            affectedPatients={affectedPatients}
            busy={command.status === "saving"}
            impacts={pendingImpacts}
            onResolve={async (impactId) => {
              await runCommand({
                action: "resolve_impact",
                impactId,
                requestId: crypto.randomUUID(),
                resolution: "keep_booking",
              });
            }}
          />
          <TesTip />
        </aside>
      </div>

      {createOpen ? (
        <CreateBlockDialog
          busy={command.status === "saving"}
          onClose={() => setCreateOpen(false)}
          onSave={async (body) => {
            const saved = await runCommand(body);
            if (saved) setCreateOpen(false);
          }}
          services={activeServices}
          timezone={initialData.timezone}
        />
      ) : null}

      {paidConflicts.length > 0 ? (
        <PaidBlockConflictDialog
          conflicts={paidConflicts}
          onClose={() => setPaidConflicts([])}
        />
      ) : null}

      {cancelTarget ? (
        <CancelBlockDialog
          block={cancelTarget}
          busy={command.status === "saving"}
          onClose={() => setCancelTarget(null)}
          onConfirm={async (scope) => {
            const saved = await runCommand({
              action: "cancel",
              blockId: cancelTarget.id,
              expectedScheduleVersion: initialData.scheduleVersion,
              requestId: crypto.randomUUID(),
              scope,
            });
            if (saved) setCancelTarget(null);
          }}
        />
      ) : null}
    </main>
  );
}

function FeedbackMessage({
  command,
}: {
  command: Extract<CommandState, { status: "error" | "success" }>;
}) {
  return (
    <div
      className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${
        command.status === "error"
          ? "border-status-danger/30 bg-status-dangerBg text-status-danger"
          : "border-status-success/30 bg-status-successBg text-status-success"
      }`}
      role={command.status === "error" ? "alert" : "status"}
    >
      {command.status === "success" ? (
        <Check aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
      ) : (
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 shrink-0"
          size={17}
        />
      )}
      {command.message}
    </div>
  );
}

function PaidBlockConflictDialog({
  conflicts,
  onClose,
}: {
  conflicts: TherapistPaidBlockConflict[];
  onClose: () => void;
}) {
  return (
    <TESDialog
      className="max-w-xl"
      description="O bloqueio foi salvo, mas estas sessões confirmadas e pagas continuam na agenda. Revise cada horário antes de manter o bloqueio."
      onClose={onClose}
      title="Atenção: há sessões pagas neste horário"
    >
      <div className="grid gap-5">
        <div className="flex items-start gap-3 rounded-xl border-2 border-status-warning bg-status-warningBg p-4" role="alert">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-status-warning"
            size={22}
          />
          <p className="text-sm font-extrabold leading-6 text-brand-deep">
            {conflicts.length === 1
              ? "Existe uma sessão confirmada e paga dentro do bloqueio."
              : `Existem ${conflicts.length} sessões confirmadas e pagas dentro do bloqueio.`}
          </p>
        </div>
        <ul className="grid gap-3">
          {conflicts.map((conflict) => (
            <li
              className="rounded-xl border border-brand-lavender bg-surface-soft p-4"
              key={conflict.bookingId}
            >
              <p className="text-sm font-extrabold text-brand-deep">
                {conflict.patientName}
              </p>
              <p className="mt-1 text-sm font-semibold text-tesText-secondary">
                {conflict.serviceTitle}
              </p>
              <time className="mt-2 block text-sm font-extrabold text-brand-primary">
                {formatBlockDate(conflict.startsAt, conflict.timezone)} · {formatBlockTime(conflict.startsAt, conflict.endsAt, conflict.timezone)}
              </time>
            </li>
          ))}
        </ul>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            onClick={onClose}
            type="button"
          >
            Fechar aviso
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={`${routes.therapist.agenda}?aba=calendario` as Route}
            onClick={onClose}
          >
            Ver agenda
          </Link>
        </div>
      </div>
    </TESDialog>
  );
}

function BlockFilters({
  onApply,
  onSearchChange,
  period,
  reason,
  search,
  status,
}: {
  onApply: (next: {
    period?: string;
    reason?: string;
    search?: string;
    status?: string;
  }) => void;
  onSearchChange: (value: string) => void;
  period: string;
  reason: string;
  search: string;
  status: string;
}) {
  return (
    <div className="grid gap-3 px-5 pb-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-[190px_190px_minmax(0,1fr)]">
      <Field label="Tipo">
        <select
          className={filterClass}
          onChange={(event) => onApply({ reason: event.target.value })}
          value={reason}
        >
          <option value="">Todos os tipos</option>
          {reasonOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Período">
        <select
          className={filterClass}
          onChange={(event) => onApply({ period: event.target.value })}
          value={period}
        >
          <option value="30">Próximos 30 dias</option>
          <option value="60">Próximos 60 dias</option>
          <option value="90">Próximos 90 dias</option>
        </select>
      </Field>
      <div className="grid gap-2">
        <span className="text-xs font-extrabold text-brand-deep">Buscar</span>
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            onApply({ search });
          }}
        >
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tesText-muted"
            size={17}
          />
          <input
            aria-label="Buscar bloqueio"
            className={`${filterClass} pr-10`}
            onBlur={() => onApply({ search })}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar bloqueios"
            value={search}
          />
        </form>
        <label className="sr-only">
          Situação
          <select
            onChange={(event) => onApply({ status: event.target.value })}
            value={status}
          >
            <option value="active">Ativos</option>
            <option value="cancelled">Removidos</option>
            <option value="all">Todos</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function CompactBlockRow({
  block,
  busy,
  onCancel,
}: {
  block: TherapistBlock;
  busy: boolean;
  onCancel: () => void;
}) {
  const date = blockDateParts(block.startsAt, block.timezone);
  return (
    <article
      className={`grid grid-cols-[56px_minmax(0,1fr)_44px] items-start gap-3 border-t border-brand-lavender/70 px-5 py-4 sm:grid-cols-[64px_minmax(0,1fr)_auto_auto] sm:items-center sm:px-6 ${
        block.status === "cancelled" ? "opacity-55" : ""
      }`}
    >
      <div className="grid h-[60px] w-14 place-content-center rounded-[10px] bg-surface-soft text-center sm:h-[66px] sm:w-16">
        <strong className="text-xl leading-5 text-brand-deep">
          {date.day}
        </strong>
        <span className="mt-1 text-[10px] font-extrabold uppercase text-brand-deep">
          {date.month}
        </span>
        <span className="text-[10px] font-bold text-tesText-secondary">
          {date.weekday}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-extrabold text-brand-deep">
            {reasonLabel(block.reasonCode)}
          </h3>
          {block.reason ? (
            <span className="sr-only">{block.reason}</span>
          ) : null}
          {block.status === "cancelled" ? (
            <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-extrabold text-tesText-muted">
              Removido
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs font-semibold text-tesText-secondary">
          {block.recurrenceFrequency === "none"
            ? block.allDay
              ? "Bloqueio de dia inteiro"
              : "Horário parcial"
            : `Recorrente ${recurrenceLabel(block.recurrenceFrequency).toLowerCase()}`}
        </p>
        {block.serviceTitle ? (
          <p className="mt-1 truncate text-[11px] font-semibold text-tesText-muted">
            Somente {block.serviceTitle}
          </p>
        ) : null}
      </div>
      <div className="col-span-2 col-start-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:col-start-auto sm:justify-end">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
            block.allDay
              ? "bg-brand-lavenderSoft text-brand-primary"
              : block.recurrenceFrequency !== "none"
                ? "bg-status-successBg text-status-success"
                : "bg-status-infoBg text-status-info"
          }`}
        >
          {block.allDay
            ? "Dia inteiro"
            : formatBlockTime(block.startsAt, block.endsAt, block.timezone)}
        </span>
        <span className="w-full text-xs font-bold text-tesText-secondary sm:w-auto">
          {formatCompactDate(block.startsAt, block.timezone)}
        </span>
      </div>
      {block.status === "active" ? (
        <button
          aria-label={`Remover bloqueio de ${formatBlockDate(
            block.startsAt,
            block.timezone,
          )}`}
          className="col-start-3 row-start-1 grid size-11 place-items-center rounded-lg border border-brand-lavender text-brand-primary transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:opacity-50 sm:col-start-auto sm:row-start-auto"
          disabled={busy}
          onClick={onCancel}
          title="Remover bloqueio"
          type="button"
        >
          <MoreHorizontal aria-hidden="true" size={20} />
        </button>
      ) : (
        <span className="size-11" />
      )}
    </article>
  );
}

function BlocksSummary({
  allDay,
  partial,
  recurring,
  total,
}: {
  allDay: number;
  partial: number;
  recurring: number;
  total: number;
}) {
  const rows = [
    { color: "bg-brand-primary", label: "Dia inteiro", value: allDay },
    { color: "bg-status-info", label: "Horário parcial", value: partial },
    {
      color: "bg-status-success",
      label: "Séries recorrentes",
      value: recurring,
    },
  ];
  return (
    <article className="rounded-[16px] border border-brand-lavender/80 bg-white p-5 shadow-card">
      <h2 className="font-display text-[22px] font-light text-brand-deep">
        Resumo dos bloqueios
      </h2>
      <p className="mt-1 text-xs font-semibold text-tesText-secondary">
        No período selecionado
      </p>
      <strong className="mt-6 block text-4xl font-extrabold text-brand-deep">
        {total}
      </strong>
      <span className="text-xs font-semibold text-tesText-secondary">
        bloqueios ativos
      </span>
      <div className="mt-6 grid gap-4">
        {rows.map((row) => (
          <div
            className="grid grid-cols-[14px_1fr_auto] items-center gap-3 text-xs"
            key={row.label}
          >
            <span className={`size-3 rounded-sm ${row.color}`} />
            <span className="font-bold text-tesText-secondary">
              {row.label}
            </span>
            <strong className="text-brand-deep">{row.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function ImpactsCard({
  affectedPatients,
  busy,
  impacts,
  onResolve,
}: {
  affectedPatients: number;
  busy: boolean;
  impacts: Array<{ block: TherapistBlock; impact: TherapistBlockImpact }>;
  onResolve: (impactId: string) => Promise<void>;
}) {
  return (
    <article className="rounded-[16px] border border-brand-lavender/80 bg-white p-5 shadow-card">
      <h2 className="font-display text-[22px] font-light text-brand-deep">
        Próximos impactos
      </h2>
      <p className="mt-1 text-xs font-semibold text-tesText-secondary">
        Sessões preservadas para sua revisão
      </p>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <ImpactMetric label="Pacientes afetados" value={affectedPatients} />
        <ImpactMetric label="Sessões para revisar" value={impacts.length} />
      </div>
      {impacts.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {impacts.slice(0, 3).map(({ block, impact }) => (
            <div
              className="rounded-xl bg-status-warningBg p-3"
              key={impact.impactId}
            >
              <div className="flex gap-2">
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-status-warning"
                  size={16}
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-extrabold text-brand-deep">
                    {impact.patientName} · {impact.serviceTitle}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-tesText-secondary">
                    {formatBlockDate(impact.startsAt, block.timezone)}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-brand-lavender bg-white px-2 text-[11px] font-extrabold text-brand-primary"
                  href={
                    routes.therapist.sessionDetail(impact.bookingId) as Route
                  }
                >
                  Abrir sessão
                </Link>
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-brand-primary px-2 text-[11px] font-extrabold text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void onResolve(impact.impactId)}
                  type="button"
                >
                  <Check aria-hidden="true" size={13} />
                  Manter sessão
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-status-successBg p-4 text-xs font-bold leading-5 text-status-success">
          Nenhuma sessão precisa de revisão neste período.
        </p>
      )}
    </article>
  );
}

function ImpactMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong className="block text-3xl font-extrabold text-brand-deep">
        {value}
      </strong>
      <span className="mt-1 block text-[11px] font-bold leading-4 text-tesText-secondary">
        {label}
      </span>
    </div>
  );
}

function TesTip() {
  return (
    <article className="rounded-[16px] border border-brand-lavender/80 bg-white p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-primary text-white">
          <Sparkles aria-hidden="true" size={19} />
        </span>
        <h2 className="font-display text-[22px] font-light text-brand-deep">
          Dica TES
        </h2>
      </div>
      <p className="mt-5 text-sm font-semibold leading-6 text-tesText-secondary">
        Use bloqueios recorrentes para intervalos fixos como estudos, pausas ou
        autocuidado. Isso ajuda a prevenir conflitos futuros.
      </p>
    </article>
  );
}

function MonthOverview({
  blocks,
  timezone,
}: {
  blocks: TherapistBlock[];
  timezone: string;
}) {
  const activeBlocks = blocks.filter((block) => block.status === "active");
  const reference = activeBlocks[0]?.startsAt ?? new Date().toISOString();
  const referenceParts = numericDateParts(reference, timezone);
  const daysInMonth = new Date(
    Date.UTC(referenceParts.year, referenceParts.month, 0),
  ).getUTCDate();
  const firstWeekday = new Date(
    Date.UTC(referenceParts.year, referenceParts.month - 1, 1),
  ).getUTCDay();
  const blockKinds = new Map<
    number,
    { allDay: boolean; partial: boolean; recurring: boolean }
  >();

  for (const block of activeBlocks) {
    const parts = numericDateParts(block.startsAt, timezone);
    if (
      parts.year !== referenceParts.year ||
      parts.month !== referenceParts.month
    ) {
      continue;
    }
    const current = blockKinds.get(parts.day) ?? {
      allDay: false,
      partial: false,
      recurring: false,
    };
    current.allDay ||= block.allDay;
    current.partial ||= !block.allDay;
    current.recurring ||= block.recurrenceFrequency !== "none";
    blockKinds.set(parts.day, current);
  }

  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(
    new Date(Date.UTC(referenceParts.year, referenceParts.month - 1, 1)),
  );

  return (
    <section className="rounded-[16px] border border-brand-lavender/80 bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-brand-deep">
            Visão geral de bloqueios
          </h2>
          <p className="mt-1 text-xs font-semibold capitalize text-tesText-secondary">
            {monthLabel}
          </p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center gap-1 text-xs font-extrabold text-brand-primary"
          href="?aba=calendario"
        >
          Ver calendário
          <ChevronRight aria-hidden="true" size={16} />
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-7 text-center text-[10px] font-extrabold uppercase text-tesText-muted">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <span className="py-2" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: firstWeekday }).map((_, index) => (
          <span aria-hidden="true" key={`empty-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const kind = blockKinds.get(day);
          return (
            <span
              className={`relative grid min-h-10 place-items-center rounded-lg text-xs font-bold ${
                kind?.allDay
                  ? "bg-brand-primary text-white"
                  : kind?.partial
                    ? "bg-status-infoBg text-brand-deep"
                    : "text-brand-deep"
              }`}
              key={day}
            >
              {day}
              {kind?.recurring ? (
                <span className="absolute bottom-1 size-1.5 rounded-full bg-status-success" />
              ) : null}
            </span>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-[10px] font-bold text-tesText-secondary">
        <Legend color="bg-brand-primary" label="Dia inteiro" />
        <Legend color="bg-status-info" label="Horário parcial" />
        <Legend color="bg-status-success" label="Recorrente" />
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`size-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

function BlockingRules({ timezone }: { timezone: string }) {
  const rules = [
    {
      description: "Reservas já confirmadas são preservadas para revisão.",
      icon: Users,
      label: "Sessões existentes não mudam automaticamente",
    },
    {
      description: `Datas e horários são interpretados em ${timezone}.`,
      icon: Clock3,
      label: "Fuso horário protegido",
    },
    {
      description: "Cada alteração fica versionada e registrada.",
      icon: Repeat2,
      label: "Histórico e recorrência rastreáveis",
    },
  ];
  return (
    <section className="rounded-[16px] border border-brand-lavender/80 bg-white shadow-card">
      <header className="border-b border-brand-lavender/70 px-5 py-4 sm:px-6">
        <h2 className="text-base font-extrabold text-brand-deep">
          Como os bloqueios funcionam
        </h2>
        <p className="mt-1 text-xs font-semibold text-tesText-secondary">
          Regras reais aplicadas à sua agenda.
        </p>
      </header>
      <div className="divide-y divide-brand-lavender/70">
        {rules.map(({ description, icon: Icon, label }) => (
          <div className="flex items-start gap-3 px-5 py-4 sm:px-6" key={label}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-lavenderSoft text-brand-primary">
              <Icon aria-hidden="true" size={17} />
            </span>
            <div>
              <h3 className="text-xs font-extrabold text-brand-deep">
                {label}
              </h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-tesText-secondary">
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="m-5 rounded-lg bg-status-warningBg p-3 text-xs font-bold leading-5 text-tesText-secondary sm:mx-6">
        Cancelamentos e reagendamentos continuam nos fluxos próprios da sessão.
      </p>
    </section>
  );
}

function EmptyBlocks({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="border-t border-brand-lavender px-5 py-12 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-brand-lavenderSoft text-brand-primary">
        <Ban aria-hidden="true" size={23} />
      </span>
      <h3 className="mt-4 font-display text-2xl font-light text-brand-deep">
        Nenhum bloqueio encontrado
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-tesText-secondary">
        Ajuste os filtros ou reserve um período em que você não estará
        disponível para novos agendamentos.
      </p>
      <button
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white"
        onClick={onCreate}
        type="button"
      >
        <Plus aria-hidden="true" size={17} />
        Criar bloqueio
      </button>
    </div>
  );
}

function CreateBlockDialog({
  busy,
  onClose,
  onSave,
  services,
  timezone,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  services: TherapistScheduleService[];
  timezone: string;
}) {
  const today = localDateKey(new Date(), timezone);
  const [allDay, setAllDay] = useState(true);
  const [startsOn, setStartsOn] = useState(today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [recurrence, setRecurrence] =
    useState<TherapistBlockRecurrence>("none");
  const [recurrenceEndsOn, setRecurrenceEndsOn] = useState(today);
  const [serviceId, setServiceId] = useState("");
  const [reasonCode, setReasonCode] =
    useState<TherapistBlockReason>("personal");
  const [reason, setReason] = useState("");
  const invalid =
    !startsOn ||
    recurrenceEndsOn < startsOn ||
    (!allDay && (!startTime || !endTime || startTime >= endTime));

  return (
    <TESDialog
      description="Escolha um dia inteiro ou uma faixa. Sessões existentes serão preservadas e sinalizadas para revisão."
      onClose={onClose}
      title="Novo bloqueio"
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (invalid) return;
          void onSave({
            action: "create",
            allDay,
            endTime: allDay ? null : endTime,
            reason: reason.trim() || null,
            reasonCode,
            recurrenceEndsOn:
              recurrence === "none" ? startsOn : recurrenceEndsOn,
            recurrenceFrequency: recurrence,
            requestId: crypto.randomUUID(),
            serviceId: serviceId || null,
            startTime: allDay ? null : startTime,
            startsOn,
            timezone,
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data inicial">
            <input
              className={inputClass}
              min={today}
              onChange={(event) => {
                setStartsOn(event.target.value);
                if (
                  recurrence === "none" ||
                  recurrenceEndsOn < event.target.value
                ) {
                  setRecurrenceEndsOn(event.target.value);
                }
              }}
              required
              type="date"
              value={startsOn}
            />
          </Field>
          <Field label="Aplicar a">
            <select
              className={inputClass}
              onChange={(event) => setServiceId(event.target.value)}
              value={serviceId}
            >
              <option value="">Todas as terapias</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.title}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-brand-lavender bg-surface-soft px-4 text-sm font-extrabold text-brand-deep">
          <input
            checked={allDay}
            className="size-4 accent-brand-primary"
            onChange={(event) => setAllDay(event.target.checked)}
            type="checkbox"
          />
          Bloquear o dia inteiro
        </label>

        {!allDay ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Início">
              <input
                className={inputClass}
                onChange={(event) => setStartTime(event.target.value)}
                required
                type="time"
                value={startTime}
              />
            </Field>
            <Field label="Término">
              <input
                className={inputClass}
                onChange={(event) => setEndTime(event.target.value)}
                required
                type="time"
                value={endTime}
              />
            </Field>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Repetição">
            <select
              className={inputClass}
              onChange={(event) =>
                setRecurrence(event.target.value as TherapistBlockRecurrence)
              }
              value={recurrence}
            >
              <option value="none">Não repetir</option>
              <option value="daily">Todos os dias</option>
              <option value="weekly">Toda semana</option>
            </select>
          </Field>
          {recurrence !== "none" ? (
            <Field label="Repetir até">
              <input
                className={inputClass}
                max={addDays(startsOn, 366)}
                min={startsOn}
                onChange={(event) => setRecurrenceEndsOn(event.target.value)}
                required
                type="date"
                value={recurrenceEndsOn}
              />
            </Field>
          ) : (
            <div className="rounded-lg border border-brand-lavender bg-surface-soft px-4 py-3 text-xs font-semibold leading-5 text-tesText-secondary">
              O bloqueio será aplicado apenas nesta data.
            </div>
          )}
        </div>

        <Field label="Motivo">
          <select
            aria-label="Motivo do bloqueio"
            className={inputClass}
            onChange={(event) =>
              setReasonCode(event.target.value as TherapistBlockReason)
            }
            value={reasonCode}
          >
            {reasonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Observação opcional">
          <textarea
            className={`${inputClass} min-h-[92px] resize-y py-3`}
            maxLength={240}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Uma nota curta para você identificar este período"
            value={reason}
          />
          <span className="mt-1 block text-right text-[11px] font-semibold text-tesText-muted">
            {reason.length}/240
          </span>
        </Field>

        <p className="rounded-lg bg-brand-cyanSoft px-4 py-3 text-xs font-semibold leading-5 text-brand-deep">
          Horários interpretados em {timezone}. Reservas existentes não serão
          canceladas ou reagendadas automaticamente.
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="min-h-11 rounded-lg border border-brand-lavender px-5 text-sm font-extrabold text-brand-primary"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || invalid}
            type="submit"
          >
            <Ban aria-hidden="true" size={17} />
            {busy ? "Salvando..." : "Criar bloqueio"}
          </button>
        </div>
      </form>
    </TESDialog>
  );
}

function CancelBlockDialog({
  block,
  busy,
  onClose,
  onConfirm,
}: {
  block: TherapistBlock;
  busy: boolean;
  onClose: () => void;
  onConfirm: (scope: "occurrence" | "series") => Promise<void>;
}) {
  const recurring = block.recurrenceFrequency !== "none";
  const [scope, setScope] = useState<"occurrence" | "series">("occurrence");

  return (
    <TESDialog
      className="max-w-[520px]"
      description="O período volta a participar do cálculo de horários. Sessões existentes permanecem inalteradas."
      onClose={onClose}
      title="Remover bloqueio?"
    >
      {recurring ? (
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-extrabold text-brand-deep">
            O que deseja remover?
          </legend>
          <RadioOption
            checked={scope === "occurrence"}
            label="Somente esta ocorrência"
            onChange={() => setScope("occurrence")}
          />
          <RadioOption
            checked={scope === "series"}
            label="Toda a série recorrente"
            onChange={() => setScope("series")}
          />
        </fieldset>
      ) : (
        <p className="rounded-lg bg-surface-soft p-4 text-sm font-semibold text-tesText-secondary">
          {formatBlockDate(block.startsAt, block.timezone)} ·{" "}
          {block.allDay
            ? "Dia inteiro"
            : formatBlockTime(block.startsAt, block.endsAt, block.timezone)}
        </p>
      )}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          className="min-h-11 rounded-lg border border-brand-lavender px-5 text-sm font-extrabold text-brand-primary"
          disabled={busy}
          onClick={onClose}
          type="button"
        >
          Voltar
        </button>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-status-danger px-5 text-sm font-extrabold text-white disabled:opacity-50"
          disabled={busy}
          onClick={() => void onConfirm(scope)}
          type="button"
        >
          <Trash2 aria-hidden="true" size={16} />
          {busy ? "Removendo..." : "Remover bloqueio"}
        </button>
      </div>
    </TESDialog>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block text-sm font-extrabold text-brand-deep">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function RadioOption({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-brand-lavender px-4 text-sm font-bold text-brand-deep">
      <input
        checked={checked}
        className="size-4 accent-brand-primary"
        name="cancel-scope"
        onChange={onChange}
        type="radio"
      />
      {label}
    </label>
  );
}

const inputClass =
  "min-h-11 w-full rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";
const filterClass =
  "min-h-11 w-full rounded-xl border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

function reasonLabel(reason: TherapistBlockReason) {
  return (
    reasonOptions.find((option) => option.value === reason)?.label ??
    "Outro motivo"
  );
}

function recurrenceLabel(recurrence: TherapistBlockRecurrence) {
  if (recurrence === "daily") return "Diário";
  if (recurrence === "weekly") return "Semanal";
  return "Único";
}

function formatBlockDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
  })
    .format(new Date(value))
    .replace(".", "");
}

function formatCompactDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: timezone,
    year: "numeric",
  }).format(new Date(value));
}

function formatBlockTime(startsAt: string, endsAt: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
  return `${formatter.format(new Date(startsAt))}–${formatter.format(
    new Date(endsAt),
  )}`;
}

function blockDateParts(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: timezone,
    weekday: "short",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value.replace(".", "")]),
  );
  return {
    day: values.day,
    month: values.month,
    weekday: values.weekday,
  };
}

function numericDateParts(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "numeric",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, Number(part.value)]),
  );
  return {
    day: values.day,
    month: values.month,
    year: values.year,
  };
}

function localDateKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function setOrDelete(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  if (value) params.set(key, value);
  else params.delete(key);
}
