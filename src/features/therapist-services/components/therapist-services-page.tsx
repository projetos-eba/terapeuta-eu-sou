"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  AlertCircle,
  ArrowDownAZ,
  Filter,
  RefreshCw,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

import { TESButton, TESCard, TESDialog, TESInput } from "@/components/tes";
import { routes } from "@/lib/routes";

import {
  createStableRequestId,
  sendTherapistServicesCommand,
} from "../therapist-services.commands";
import type {
  TherapistServiceStatus,
  TherapistServiceSummary,
  TherapistServicesContract,
  TherapyCatalogContract,
} from "../therapist-services.types";
import { TherapistServiceCard } from "./therapist-service-card";
import { TherapistServiceForm } from "./therapist-service-form";
import type { TherapistServiceMenuAction } from "./therapist-service-menu";
import { getTherapistServiceStatusLabel } from "./therapist-service-status";
import { TherapistServicesEmptyState } from "./therapist-services-empty-state";
import { TherapistServicesHero } from "./therapist-services-hero";
import { TherapistServicesRanking } from "./therapist-services-ranking";
import { TherapistServicesTips } from "./therapist-services-tips";

type DialogState =
  | { type: "create" }
  | { service: TherapistServiceSummary; type: "edit" }
  | {
      action: "activate" | "archive" | "pause";
      service: TherapistServiceSummary;
      type: "confirm";
    }
  | null;

type SortMode = "bookings" | "created" | "position" | "title";

const statusOptions: Array<{
  label: string;
  value: "all" | TherapistServiceStatus;
}> = [
  { label: "Todos", value: "all" },
  { label: "Ativos", value: "active" },
  { label: "Rascunhos", value: "draft" },
  { label: "Pausados", value: "paused" },
  { label: "Em revisão", value: "requires_review" },
  { label: "Arquivados", value: "archived" },
];

export function TherapistServicesPage({
  catalog,
  services: initialServices,
}: {
  catalog: TherapyCatalogContract;
  services: TherapistServicesContract;
}) {
  const [services, setServices] = useState(initialServices.items);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | TherapistServiceStatus
  >("all");
  const [sortMode, setSortMode] = useState<SortMode>("position");
  const [visibleCount, setVisibleCount] = useState(6);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  const usedServices = services.filter(
    (service) => service.status !== "archived",
  ).length;
  const limit = initialServices.serviceLimit;
  const canCreate = limit === null || usedServices < limit;

  const filteredServices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return [...services]
      .filter((service) => {
        if (statusFilter === "all" && service.status === "archived") {
          return false;
        }
        if (statusFilter !== "all" && service.status !== statusFilter) {
          return false;
        }
        if (!normalized) return true;
        return [
          service.title,
          service.therapy.name,
          service.category.name,
          service.description ?? "",
        ].some((value) =>
          value.toLocaleLowerCase("pt-BR").includes(normalized),
        );
      })
      .sort((a, b) => {
        if (sortMode === "title")
          return a.title.localeCompare(b.title, "pt-BR");
        if (sortMode === "created") {
          return Date.parse(b.createdAt) - Date.parse(a.createdAt);
        }
        if (sortMode === "bookings") {
          return b.metrics.bookingCount - a.metrics.bookingCount;
        }
        return a.position - b.position;
      });
  }, [query, services, sortMode, statusFilter]);

  const visibleServices = filteredServices.slice(0, visibleCount);

  function upsertService(
    nextService: TherapistServiceSummary,
    message: string,
  ) {
    setServices((current) => {
      const exists = current.some(
        (service) => service.serviceId === nextService.serviceId,
      );
      if (!exists) return [...current, nextService].sort(byPosition);
      return current
        .map((service) =>
          service.serviceId === nextService.serviceId ? nextService : service,
        )
        .sort(byPosition);
    });
    setDialog(null);
    setLiveMessage(message);
  }

  async function handleReorder(
    service: TherapistServiceSummary,
    direction: "down" | "up",
  ) {
    const ordered = [...services].sort(byPosition);
    const index = ordered.findIndex(
      (item) => item.serviceId === service.serviceId,
    );
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;

    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setPendingServiceId(service.serviceId);

    const result = await sendTherapistServicesCommand({
      action: "reorder",
      requestId: createStableRequestId(),
      serviceIds: next.map((item) => item.serviceId),
    });
    setPendingServiceId(null);

    if (result.status === "error") {
      setLiveMessage(result.error.message);
      return;
    }

    if ("items" in result.data) {
      const nextServices = result.data as TherapistServicesContract;
      setServices(nextServices.items);
      setLiveMessage("Ordem das terapias atualizada.");
    }
  }

  function handleCardAction(
    service: TherapistServiceSummary,
    action: TherapistServiceMenuAction,
  ) {
    if (action === "edit") {
      setDialog({ service, type: "edit" });
      return;
    }
    if (action === "move_up" || action === "move_down") {
      void handleReorder(service, action === "move_up" ? "up" : "down");
      return;
    }
    setDialog({ action, service, type: "confirm" });
  }

  return (
    <main className="mx-auto grid w-full max-w-[1210px] gap-5 pb-10 text-tesText-primary">
      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <TherapistServicesHero
        canCreate={canCreate}
        onCreate={() => setDialog({ type: "create" })}
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <TESCard as="section" className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-brand-lavender pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="font-display text-3xl font-light italic text-brand-deep">
                Terapias cadastradas
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                Organize o que você oferece e mostre como você trabalha.
              </p>
            </div>
            <PlanLimitNotice limit={limit} used={usedServices} />
          </div>

          {!canCreate ? (
            <div className="mt-5 rounded-lg border border-status-warning/30 bg-status-warningBg p-4">
              <p className="text-sm font-extrabold text-status-warning">
                Limite de terapias atingido no plano atual.
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                Para adicionar outra terapia, revise terapias arquivadas ou veja
                as opções de plano.
              </p>
              <TESButton
                className="mt-4 min-h-11 rounded-lg"
                href={routes.therapist.plan}
                variant="secondary"
              >
                Ver plano
              </TESButton>
            </div>
          ) : null}

          <Toolbar
            query={query}
            setQuery={setQuery}
            setSortMode={setSortMode}
            setStatusFilter={setStatusFilter}
            sortMode={sortMode}
            statusFilter={statusFilter}
          />

          {services.length === 0 ? (
            <div className="mt-6">
              <TherapistServicesEmptyState
                canCreate={canCreate}
                onCreate={() => setDialog({ type: "create" })}
              />
            </div>
          ) : visibleServices.length > 0 ? (
            <div className="mt-6 grid gap-4">
              {visibleServices.map((service) => {
                const ordered = [...services].sort(byPosition);
                const index = ordered.findIndex(
                  (item) => item.serviceId === service.serviceId,
                );

                return (
                  <TherapistServiceCard
                    canMoveDown={index >= 0 && index < ordered.length - 1}
                    canMoveUp={index > 0}
                    disabled={pendingServiceId === service.serviceId}
                    key={service.serviceId}
                    onAction={(action) => handleCardAction(service, action)}
                    service={service}
                  />
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-brand-lavender bg-brand-lavenderSoft/50 p-6 text-center">
              <p className="text-sm font-extrabold text-brand-deep">
                Nenhuma terapia encontrada
              </p>
              <p className="mt-2 text-sm font-semibold text-tesText-secondary">
                Ajuste a busca, o filtro ou a ordenação para encontrar outra
                terapia.
              </p>
            </div>
          )}

          {filteredServices.length > visibleServices.length ? (
            <button
              className="mt-6 min-h-11 w-full rounded-lg border border-brand-lavender text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
              onClick={() => setVisibleCount((current) => current + 6)}
              type="button"
            >
              Ver todas as terapias
            </button>
          ) : null}
        </TESCard>

        <aside className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <TherapistServicesTips />
          <TherapistServicesRanking services={services} />
        </aside>
      </section>

      {dialog?.type === "create" ? (
        <TherapistServiceForm
          catalog={catalog.items}
          mode="create"
          onClose={() => setDialog(null)}
          onSaved={upsertService}
        />
      ) : null}

      {dialog?.type === "edit" ? (
        <TherapistServiceForm
          catalog={catalog.items}
          mode="edit"
          onClose={() => setDialog(null)}
          onSaved={upsertService}
          service={dialog.service}
        />
      ) : null}

      {dialog?.type === "confirm" ? (
        <ConfirmServiceActionDialog
          action={dialog.action}
          onClose={() => setDialog(null)}
          onSaved={upsertService}
          service={dialog.service}
          setPendingServiceId={setPendingServiceId}
        />
      ) : null}
    </main>
  );
}

export function TherapistServicesErrorState({
  message,
  requestId,
}: {
  message: string;
  requestId?: string;
}) {
  return (
    <main className="mx-auto w-full max-w-[920px] pb-10 text-tesText-primary">
      <section
        className="rounded-card border border-status-danger/30 bg-white p-8 text-center shadow-card"
        role="alert"
      >
        <AlertCircle
          aria-hidden="true"
          className="mx-auto text-status-danger"
          size={30}
        />
        <h1 className="mt-4 font-display text-4xl font-light italic text-brand-deep">
          Terapias temporariamente indisponíveis
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-tesText-secondary">
          {message}
        </p>
        {requestId ? (
          <p className="mt-2 text-xs font-semibold text-tesText-muted">
            Referência: {requestId.slice(0, 8)}
          </p>
        ) : null}
        <button
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
          onClick={() => window.location.reload()}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={16} />
          Tentar novamente
        </button>
      </section>
    </main>
  );
}

function Toolbar({
  query,
  setQuery,
  setSortMode,
  setStatusFilter,
  sortMode,
  statusFilter,
}: {
  query: string;
  setQuery: (value: string) => void;
  setSortMode: (value: SortMode) => void;
  setStatusFilter: (value: "all" | TherapistServiceStatus) => void;
  sortMode: SortMode;
  statusFilter: "all" | TherapistServiceStatus;
}) {
  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px]">
      <label className="block">
        <span className="sr-only">Buscar terapia</span>
        <TESInput
          leftIcon={
            <Search
              aria-hidden="true"
              className="text-brand-primary"
              size={18}
            />
          }
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por terapia ou categoria"
          value={query}
          wrapperClassName="h-12 rounded-lg shadow-none"
        />
      </label>
      <label className="relative block">
        <span className="sr-only">Filtrar por status</span>
        <Filter
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-3.5 text-brand-primary"
          size={17}
        />
        <select
          className="h-12 w-full rounded-lg border border-border bg-white pl-11 pr-4 text-sm font-extrabold text-brand-deep outline-none focus:border-brand-primary"
          onChange={(event) =>
            setStatusFilter(
              event.target.value as "all" | TherapistServiceStatus,
            )
          }
          value={statusFilter}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="relative block">
        <span className="sr-only">Ordenar terapias</span>
        <ArrowDownAZ
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-3.5 text-brand-primary"
          size={17}
        />
        <select
          className="h-12 w-full rounded-lg border border-border bg-white pl-11 pr-4 text-sm font-extrabold text-brand-deep outline-none focus:border-brand-primary"
          onChange={(event) => setSortMode(event.target.value as SortMode)}
          value={sortMode}
        >
          <option value="position">Ordem manual</option>
          <option value="title">Nome</option>
          <option value="created">Mais recentes</option>
          <option value="bookings">Agendamentos</option>
        </select>
      </label>
    </div>
  );
}

function PlanLimitNotice({
  limit,
  used,
}: {
  limit: number | null;
  used: number;
}) {
  return (
    <div className="rounded-lg bg-brand-lavenderSoft px-4 py-3 text-sm font-bold text-brand-primary">
      {limit === null ? (
        "Você pode cadastrar quantas terapias precisar"
      ) : (
        <>
          {used}/{limit} terapias usadas ·{" "}
          <Link
            className="underline-offset-4 hover:underline"
            href={routes.therapist.plan as Route}
          >
            ver plano
          </Link>
        </>
      )}
    </div>
  );
}

function ConfirmServiceActionDialog({
  action,
  onClose,
  onSaved,
  service,
  setPendingServiceId,
}: {
  action: "activate" | "archive" | "pause";
  onClose: () => void;
  onSaved: (service: TherapistServiceSummary, message: string) => void;
  service: TherapistServiceSummary;
  setPendingServiceId: (serviceId: string | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const actionCopy = {
    activate: {
      body: "Vamos conferir esta terapia antes de deixá-la disponível para novos agendamentos.",
      button: "Ativar terapia",
      success: "Terapia ativada.",
      title: "Ativar terapia?",
    },
    archive: {
      body: "Terapias arquivadas deixam de aparecer para novos agendamentos. O histórico continua guardado.",
      button: "Arquivar terapia",
      success: "Terapia arquivada.",
      title: "Arquivar terapia?",
    },
    pause: {
      body: "A terapia deixará de aparecer para novos agendamentos até ser reativada.",
      button: "Pausar terapia",
      success: "Terapia pausada.",
      title: "Pausar terapia?",
    },
  }[action];

  async function submit() {
    setSubmitting(true);
    setPendingServiceId(service.serviceId);
    setError(null);

    const result = await sendTherapistServicesCommand({
      action,
      expectedVersion: service.version,
      requestId: createStableRequestId(),
      serviceId: service.serviceId,
    });

    setSubmitting(false);
    setPendingServiceId(null);

    if (result.status === "error") {
      setError(result.error.message);
      return;
    }

    if ("service" in result.data) {
      onSaved(result.data.service, actionCopy.success);
    }
  }

  return (
    <TESDialog
      className="max-w-[460px]"
      description={actionCopy.body}
      onClose={onClose}
      title={actionCopy.title}
    >
      <div aria-live="polite" className="sr-only">
        {submitting ? "Atualizando terapia." : (error ?? "")}
      </div>
      <p className="text-sm font-semibold leading-6 text-tesText-secondary">
        Terapia:{" "}
        <strong className="font-extrabold text-brand-deep">
          {service.title}
        </strong>
      </p>
      <p className="mt-2 text-xs font-bold text-tesText-muted">
        Estado atual: {getTherapistServiceStatusLabel(service.status)}
      </p>
      {error ? (
        <p className="mt-4 rounded-lg bg-status-dangerBg p-3 text-sm font-bold text-status-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <TESButton
          disabled={submitting}
          onClick={onClose}
          type="button"
          variant="secondary"
        >
          Cancelar
        </TESButton>
        <TESButton
          disabled={submitting}
          onClick={() => void submit()}
          type="button"
        >
          {submitting ? "Atualizando..." : actionCopy.button}
        </TESButton>
      </div>
    </TESDialog>
  );
}

function byPosition(a: TherapistServiceSummary, b: TherapistServiceSummary) {
  return a.position - b.position;
}
