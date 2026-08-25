"use client";

import Link from "next/link";
import {
  Archive,
  Eye,
  FileClock,
  Pencil,
  Plus,
  Search,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TESButton, TESDialog, TESFeedbackDialog } from "@/components/tes";
import { routes } from "@/lib/routes";

import {
  createStableRequestId,
  fetchAdminTherapyCatalogRequests,
  getAdminCatalogRequestMaterialUrl,
  sendAdminTherapyCatalogCommand,
} from "../admin-therapy-catalog.commands";
import type {
  AdminTherapy,
  AdminTherapyCatalogContract,
  AdminTherapyCatalogRequestDetail,
  AdminTherapyDraftCommand,
  AdminTherapyTransition,
} from "../admin-therapy-catalog.types";
import { AdminTherapyEditor } from "./admin-therapy-editor";

type FilterState = {
  categoryId: string;
  match: "all" | "hidden" | "visible";
  publicVisibility: "all" | "hidden" | "visible";
  query: string;
  serviceAvailability: "all" | "blocked" | "open";
  status: "all" | AdminTherapy["status"];
};

const initialFilters: FilterState = {
  categoryId: "all",
  match: "all",
  publicVisibility: "all",
  query: "",
  serviceAvailability: "all",
  status: "all",
};

const statusLabels: Record<AdminTherapy["status"], string> = {
  active: "Ativa legada",
  archived: "Arquivada",
  deprecated: "Descontinuada",
  draft: "Rascunho",
  in_review: "Em revisão",
  inactive: "Inativa legada",
  published: "Publicada",
};

export function AdminTherapyCatalogPage({
  initialCatalog,
}: {
  initialCatalog: AdminTherapyCatalogContract;
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [editingTherapy, setEditingTherapy] = useState<
    AdminTherapy | "new" | null
  >(null);
  const [transitionTarget, setTransitionTarget] = useState<{
    action: AdminTherapyTransition;
    therapy: AdminTherapy;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [requestDetails, setRequestDetails] = useState<
    AdminTherapyCatalogRequestDetail[]
  >([]);
  const [inspectedRequest, setInspectedRequest] =
    useState<AdminTherapyCatalogRequestDetail | null>(null);

  useEffect(() => {
    void fetchAdminTherapyCatalogRequests().then(setRequestDetails);
  }, []);

  const filtered = useMemo(() => {
    const query = normalize(filters.query);

    return catalog.items.filter((therapy) => {
      if (
        query &&
        !normalize(
          [
            therapy.name,
            therapy.slug,
            therapy.shortDescription,
            therapy.aliases.join(" "),
            therapy.categoryName,
          ].join(" "),
        ).includes(query)
      ) {
        return false;
      }
      if (
        filters.categoryId !== "all" &&
        therapy.categoryId !== filters.categoryId
      ) {
        return false;
      }
      if (filters.status !== "all" && therapy.status !== filters.status) {
        return false;
      }
      if (
        filters.publicVisibility === "visible" &&
        !therapy.isPubliclyVisible
      ) {
        return false;
      }
      if (filters.publicVisibility === "hidden" && therapy.isPubliclyVisible) {
        return false;
      }
      if (
        filters.serviceAvailability === "open" &&
        !therapy.isAvailableForServices
      ) {
        return false;
      }
      if (
        filters.serviceAvailability === "blocked" &&
        therapy.isAvailableForServices
      ) {
        return false;
      }
      if (filters.match === "visible" && !therapy.isVisibleInMatching) {
        return false;
      }
      if (filters.match === "hidden" && therapy.isVisibleInMatching) {
        return false;
      }
      return true;
    });
  }, [catalog.items, filters]);
  const publishedCount = catalog.items.filter(
    (therapy) => therapy.status === "published",
  ).length;
  const matchingCount = catalog.items.filter(
    (therapy) => therapy.isVisibleInMatching,
  ).length;
  const serviceCount = catalog.items.reduce(
    (total, therapy) => total + therapy.impact.activeServiceCount,
    0,
  );

  async function saveTherapy(command: AdminTherapyDraftCommand) {
    setIsMutating(true);
    setMessage(null);
    setFeedback(null);

    const result = await sendAdminTherapyCatalogCommand({
      action: "save",
      payload: command,
      requestId: createStableRequestId(),
    });

    setIsMutating(false);

    if (result.status === "error") {
      setFeedback("Não foi possível salvar a terapia agora. Tente novamente.");
      return;
    }

    setCatalog(result.catalog);
    setEditingTherapy(null);
    setMessage("Catálogo atualizado.");
  }

  async function applyTransition() {
    if (!transitionTarget) return;
    setIsMutating(true);
    setMessage(null);
    setFeedback(null);

    const result = await sendAdminTherapyCatalogCommand({
      action: "transition",
      payload: {},
      reason,
      requestId: createStableRequestId(),
      therapyId: transitionTarget.therapy.id,
      transition: transitionTarget.action,
    });

    setIsMutating(false);

    if (result.status === "error") {
      setFeedback("Não foi possível concluir esta ação agora. Tente novamente.");
      return;
    }

    setCatalog(result.catalog);
    setTransitionTarget(null);
    setReason("");
    setMessage("Ação administrativa registrada.");
  }

  async function decideRequest(
    request: AdminTherapyCatalogRequestDetail,
    status:
      | "approved"
      | "merged"
      | "needs_information"
      | "rejected"
      | "under_review",
    decision: string,
    relatedTherapyId: string | null,
  ) {
    setIsMutating(true);
    setMessage(null);
    setFeedback(null);
    const result = await sendAdminTherapyCatalogCommand({
      action: "decideRequest",
      catalogRequestId: request.id,
      decision,
      relatedTherapyId,
      requestId: createStableRequestId(),
      status,
    });
    setIsMutating(false);
    if (result.status === "error") {
      setFeedback(
        "Não foi possível registrar a decisão agora. Tente novamente.",
      );
      return;
    }
    setCatalog(result.catalog);
    setRequestDetails((items) =>
      items.map((item) =>
        item.id === request.id
          ? { ...item, decision, relatedTherapyId, status }
          : item,
      ),
    );
    setInspectedRequest((current) =>
      current?.id === request.id
        ? { ...current, decision, relatedTherapyId, status }
        : current,
    );
    setMessage("Decisão registrada e pessoa solicitante avisada.");
  }

  return (
    <div className="mx-auto w-full max-w-[1166px] space-y-6 py-1">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.42em] text-brand-primary">
            Admin
          </p>
          <h1 className="mt-3 font-display text-[3.15rem] font-normal italic leading-[0.95] text-brand-deep sm:text-[4.4rem]">
            Terapias
          </h1>
          <p className="mt-4 text-base font-semibold leading-7 text-tesText-secondary sm:text-lg">
            Organize o catálogo, a presença no Match e a disponibilidade das
            terapias na plataforma.
          </p>
        </div>
        <TESButton
          className="min-h-12 w-full rounded-full px-6 sm:w-auto"
          onClick={() => setEditingTherapy("new")}
          type="button"
          variant="gradient"
        >
          <Plus aria-hidden="true" className="size-4" />
          Criar rascunho
        </TESButton>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CatalogMetric
          label="Terapias cadastradas"
          value={catalog.items.length}
        />
        <CatalogMetric label="Publicadas" value={publishedCount} />
        <CatalogMetric label="Visíveis no Match" value={matchingCount} />
        <CatalogMetric label="Serviços ativos" value={serviceCount} />
      </section>

      {message ? (
        <p
          aria-live="polite"
          className="rounded-xl border border-brand-lavender bg-brand-lavenderSoft px-4 py-3 text-sm font-bold text-brand-deep"
        >
          {message}
        </p>
      ) : null}
      {feedback ? (
        <TESFeedbackDialog
          message={feedback}
          onClose={() => setFeedback(null)}
        />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <main className="space-y-4">
          <Filters
            categories={catalog.categories}
            filters={filters}
            onChange={setFilters}
          />

          <div className="space-y-4">
            {filtered.map((therapy) => (
              <TherapyCard
                key={therapy.id}
                onEdit={() => setEditingTherapy(therapy)}
                onTransition={(action) =>
                  setTransitionTarget({ action, therapy })
                }
                therapy={therapy}
              />
            ))}
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-brand-lavender bg-white p-8 text-center">
                <h2 className="text-lg font-extrabold text-brand-deep">
                  Nenhuma terapia encontrada
                </h2>
                <p className="mt-2 text-sm font-semibold text-tesText-secondary">
                  Ajuste os filtros ou crie um rascunho administrativo.
                </p>
              </div>
            ) : null}
          </div>
        </main>

        <aside className="space-y-4">
          <Panel title="Solicitações de terapeutas">
            {requestDetails.length === 0 && catalog.requests.length === 0 ? (
              <p className="text-sm font-semibold text-tesText-secondary">
                Nenhuma solicitação pendente.
              </p>
            ) : (
              <div className="space-y-3">
                {(requestDetails.length > 0 ? requestDetails : catalog.requests)
                  .slice(0, 6)
                  .map((request) => (
                    <div
                      className="rounded-xl border border-brand-lavender bg-surface-soft p-3"
                      key={request.id}
                    >
                      <p className="text-sm font-extrabold text-brand-deep">
                        {request.informedName}
                      </p>
                      <p className="mt-1 text-xs font-bold text-tesText-secondary">
                        {request.status}
                      </p>
                      {request.justification ? (
                        <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-tesText-secondary">
                          {request.justification}
                        </p>
                      ) : null}
                      {isDetailedRequest(request) ? (
                        <button
                          className="mt-3 text-sm font-extrabold text-brand-primary"
                          onClick={() => setInspectedRequest(request)}
                          type="button"
                        >
                          Abrir análise
                        </button>
                      ) : null}
                    </div>
                  ))}
              </div>
            )}
          </Panel>

          <Panel title="Como o catálogo funciona">
            <ul className="space-y-3 text-sm font-semibold leading-6 text-tesText-secondary">
              <li>Uma terapia só aparece ao público depois de publicada.</li>
              <li>A presença no Match pode ser acompanhada separadamente.</li>
              <li>Serviços ativos mostram o impacto antes de cada mudança.</li>
              <li>Arquivar preserva o histórico administrativo.</li>
            </ul>
          </Panel>
        </aside>
      </div>

      <RequestInspectionDialog
        isMutating={isMutating}
        onClose={() => setInspectedRequest(null)}
        onDecide={decideRequest}
        onOpenMaterial={async (materialId) => {
          const url = await getAdminCatalogRequestMaterialUrl(materialId);
          if (url) window.open(url, "_blank", "noopener,noreferrer");
          else
            setFeedback(
              "Não foi possível abrir o material agora. Tente novamente.",
            );
        }}
        request={inspectedRequest}
        therapies={catalog.items}
      />

      {editingTherapy ? (
        <TESDialog
          className="max-w-5xl"
          description="Edite identidade, conteúdo público, disponibilidade no produto e governança."
          onClose={() => setEditingTherapy(null)}
          title={editingTherapy === "new" ? "Criar rascunho" : "Editar terapia"}
        >
          <AdminTherapyEditor
            categories={catalog.categories}
            isSaving={isMutating}
            matchingThemes={catalog.matchingThemes}
            onCancel={() => setEditingTherapy(null)}
            onSave={saveTherapy}
            therapy={editingTherapy === "new" ? null : editingTherapy}
          />
        </TESDialog>
      ) : null}

      {transitionTarget ? (
        <TESDialog
          description="A ação será registrada com impacto, ator, data e motivo."
          onClose={() => setTransitionTarget(null)}
          title={`Confirmar ${transitionLabel(transitionTarget.action)}`}
        >
          <div className="space-y-4">
            <ImpactSummary therapy={transitionTarget.therapy} />
            <label className="block">
              <span className="text-sm font-extrabold text-brand-deep">
                Motivo administrativo
              </span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border border-brand-lavender bg-white px-3 py-2 text-sm font-semibold text-brand-deep outline-none focus:ring-4 focus:ring-ring/20"
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <TESButton
                disabled={isMutating}
                onClick={() => setTransitionTarget(null)}
                type="button"
                variant="secondary"
              >
                Cancelar
              </TESButton>
              <TESButton
                className={
                  transitionTarget.action === "archive"
                    ? "bg-status-danger text-white hover:bg-status-danger/90"
                    : undefined
                }
                disabled={isMutating || reason.trim().length < 4}
                onClick={applyTransition}
                type="button"
                variant="gradient"
              >
                {isMutating ? "Registrando..." : "Confirmar"}
              </TESButton>
            </div>
          </div>
        </TESDialog>
      ) : null}
    </div>
  );
}

function Filters({
  categories,
  filters,
  onChange,
}: {
  categories: AdminTherapyCatalogContract["categories"];
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}) {
  return (
    <section className="rounded-[28px] border border-brand-lavender/70 bg-white p-5 shadow-[0_22px_60px_rgba(20,16,90,0.09)]">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="md:col-span-2 xl:col-span-1">
          <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-tesText-secondary">
            Busca
          </span>
          <span className="flex min-h-11 items-center gap-2 rounded-xl border border-brand-lavender px-3">
            <Search aria-hidden="true" className="size-4 text-brand-primary" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
              onChange={(event) =>
                onChange({ ...filters, query: event.target.value })
              }
              placeholder="Nome, descrição ou endereço"
              value={filters.query}
            />
          </span>
        </label>
        <Select
          label="Categoria"
          onChange={(value) => onChange({ ...filters, categoryId: value })}
          options={[
            { label: "Todas", value: "all" },
            ...categories.map((category) => ({
              label: category.name,
              value: category.id,
            })),
          ]}
          value={filters.categoryId}
        />
        <Select
          label="Status"
          onChange={(value) =>
            onChange({ ...filters, status: value as FilterState["status"] })
          }
          options={[
            { label: "Todos", value: "all" },
            ...Object.entries(statusLabels).map(([value, label]) => ({
              label,
              value,
            })),
          ]}
          value={filters.status}
        />
        <Select
          label="Público"
          onChange={(value) =>
            onChange({
              ...filters,
              publicVisibility: value as FilterState["publicVisibility"],
            })
          }
          options={[
            { label: "Todas", value: "all" },
            { label: "Visíveis", value: "visible" },
            { label: "Ocultas", value: "hidden" },
          ]}
          value={filters.publicVisibility}
        />
        <Select
          label="Serviços"
          onChange={(value) =>
            onChange({
              ...filters,
              serviceAvailability: value as FilterState["serviceAvailability"],
            })
          }
          options={[
            { label: "Todas", value: "all" },
            { label: "Aceita novos serviços", value: "open" },
            { label: "Bloqueada", value: "blocked" },
          ]}
          value={filters.serviceAvailability}
        />
        <Select
          label="Match"
          onChange={(value) =>
            onChange({ ...filters, match: value as FilterState["match"] })
          }
          options={[
            { label: "Todas", value: "all" },
            { label: "Ativas no Match", value: "visible" },
            { label: "Fora do Match", value: "hidden" },
          ]}
          value={filters.match}
        />
      </div>
    </section>
  );
}

function Select({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label>
      <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-tesText-secondary">
        {label}
      </span>
      <select
        className="min-h-11 w-full rounded-xl border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:ring-4 focus:ring-ring/20"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TherapyCard({
  onEdit,
  onTransition,
  therapy,
}: {
  onEdit: () => void;
  onTransition: (action: AdminTherapyTransition) => void;
  therapy: AdminTherapy;
}) {
  return (
    <article className="rounded-[28px] border border-brand-lavender/70 bg-white p-5 shadow-[0_22px_60px_rgba(20,16,90,0.09)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-lavenderSoft px-3 py-1 text-xs font-extrabold text-brand-primary">
              {statusLabels[therapy.status]}
            </span>
            <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-bold text-tesText-secondary">
              {therapy.categoryName}
            </span>
            {therapy.isVisibleInMatching ? (
              <span className="rounded-full bg-status-successBg px-3 py-1 text-xs font-extrabold text-status-success">
                Match
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-xl font-extrabold text-brand-deep">
            {therapy.name}
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
            {therapy.shortDescription}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {therapy.status === "published" && therapy.isPubliclyVisible ? (
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-lavender px-3 text-sm font-extrabold text-brand-primary"
              href={routes.public.therapyDetail(therapy.slug)}
              target="_blank"
            >
              <Eye aria-hidden="true" className="size-4" />
              Preview
            </Link>
          ) : null}
          <TESButton onClick={onEdit} type="button" variant="secondary">
            <Pencil aria-hidden="true" className="size-4" />
            Editar
          </TESButton>
        </div>
      </div>

      <ImpactSummary therapy={therapy} />

      <div className="mt-4 flex flex-wrap gap-2 border-t border-brand-lavender pt-4">
        <ActionButton
          action="review"
          label="Revisar"
          onTransition={onTransition}
        />
        <ActionButton
          action="publish"
          label="Publicar"
          onTransition={onTransition}
        />
        <ActionButton
          action="unpublish"
          label="Despublicar"
          onTransition={onTransition}
        />
        <ActionButton
          action="deprecate"
          label="Descontinuar"
          onTransition={onTransition}
        />
        <ActionButton
          action="archive"
          icon={<Archive aria-hidden="true" className="size-4" />}
          label="Arquivar"
          onTransition={onTransition}
        />
      </div>

      <details className="mt-4 rounded-xl bg-surface-soft p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-extrabold text-brand-deep">
          <FileClock aria-hidden="true" className="size-4" />
          Histórico recente
        </summary>
        <div className="mt-3 space-y-2">
          {therapy.history.length === 0 ? (
            <p className="text-sm font-semibold text-tesText-secondary">
              Ainda sem eventos administrativos registrados.
            </p>
          ) : (
            therapy.history.map((event) => (
              <p
                className="text-xs font-semibold leading-5 text-tesText-secondary"
                key={event.id}
              >
                <strong className="text-brand-deep">
                  {historyLabel(event.eventType)}
                </strong>{" "}
                em {new Date(event.createdAt).toLocaleString("pt-BR")}
                {event.reason ? ` - ${event.reason}` : ""}
              </p>
            ))
          )}
        </div>
      </details>
    </article>
  );
}

function ActionButton({
  action,
  icon,
  label,
  onTransition,
}: {
  action: AdminTherapyTransition;
  icon?: React.ReactNode;
  label: string;
  onTransition: (action: AdminTherapyTransition) => void;
}) {
  return (
    <button
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-lavender px-3 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
      onClick={() => onTransition(action)}
      type="button"
    >
      {icon ?? <Send aria-hidden="true" className="size-4" />}
      {label}
    </button>
  );
}

function ImpactSummary({ therapy }: { therapy: AdminTherapy }) {
  const metrics = [
    ["Serviços", therapy.impact.serviceCount],
    ["Ativos", therapy.impact.activeServiceCount],
    ["Terapeutas", therapy.impact.therapistCount],
    ["Sessões futuras", therapy.impact.futureBookingCount],
  ];

  return (
    <dl className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
      {metrics.map(([label, value]) => (
        <div className="rounded-xl bg-surface-soft p-3" key={label}>
          <dt className="text-xs font-bold text-tesText-secondary">{label}</dt>
          <dd className="mt-1 text-lg font-extrabold text-brand-deep">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RequestInspectionDialog({
  isMutating,
  onClose,
  onDecide,
  onOpenMaterial,
  request,
  therapies,
}: {
  isMutating: boolean;
  onClose: () => void;
  onDecide: (
    request: AdminTherapyCatalogRequestDetail,
    status:
      | "approved"
      | "merged"
      | "needs_information"
      | "rejected"
      | "under_review",
    decision: string,
    relatedTherapyId: string | null,
  ) => Promise<void>;
  onOpenMaterial: (materialId: string) => Promise<void>;
  request: AdminTherapyCatalogRequestDetail | null;
  therapies: AdminTherapy[];
}) {
  const [decision, setDecision] = useState("");
  const [status, setStatus] = useState<
    "approved" | "merged" | "needs_information" | "rejected" | "under_review"
  >("under_review");
  const [relatedTherapyId, setRelatedTherapyId] = useState("");

  useEffect(() => {
    if (!request) return;
    setDecision(request.decision ?? "");
    setStatus(request.status === "submitted" ? "under_review" : request.status);
    setRelatedTherapyId(request.relatedTherapyId ?? "");
  }, [request]);

  if (!request) return null;
  const selectedThemeNames = Array.isArray(request.submission.themeNames)
    ? request.submission.themeNames.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];
  const rawFields: Array<[string, unknown]> = [
    ["Temas do Match", selectedThemeNames.join(", ")],
    ["Descrição", request.submission.description ?? request.description],
    ["Objetivo", request.submission.objective ?? request.justification],
    ["Situações relatadas", request.submission.useCases],
    ["Como ocorre o atendimento", request.submission.sessionProcess],
    ["Experiência", request.submission.experienceLevel],
    ["Formação", request.submission.trainingDescription],
    ["Cuidados e limites", request.submission.safetyNotes],
    ["Referência", request.submission.referenceUrl],
    ["Informações adicionais", request.submission.additionalInformation],
  ];
  const fields = rawFields.filter(
    ([, value]) => typeof value === "string" && value.trim(),
  );

  return (
    <TESDialog
      className="max-w-4xl"
      description="Revise informações e materiais privados. Toda decisão exige motivo e não publica uma terapia automaticamente."
      onClose={onClose}
      title={`Análise: ${request.informedName}`}
    >
      <div className="space-y-6">
        <div className="grid gap-3 rounded-card bg-surface-soft p-4 sm:grid-cols-3">
          <InfoItem label="Estado" value={requestStatusLabel(request.status)} />
          <InfoItem label="Enviada em" value={formatDate(request.createdAt)} />
          <InfoItem
            label="Atualizada em"
            value={formatDate(request.updatedAt)}
          />
        </div>
        <section>
          <h3 className="text-lg font-extrabold text-brand-deep">
            Informações compartilhadas
          </h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {fields.length ? (
              fields.map(([label, value]) => (
                <div
                  className="rounded-card border border-brand-lavender p-4"
                  key={label}
                >
                  <dt className="text-xs font-extrabold uppercase tracking-[0.12em] text-tesText-secondary">
                    {label}
                  </dt>
                  <dd className="mt-2 whitespace-pre-line text-sm leading-6 text-brand-deep">
                    {String(value)}
                  </dd>
                </div>
              ))
            ) : (
              <p className="text-sm text-tesText-secondary">
                Esta solicitação foi enviada em um formato anterior.
              </p>
            )}
          </dl>
        </section>
        <section>
          <h3 className="text-lg font-extrabold text-brand-deep">
            Materiais privados
          </h3>
          {request.materials.length ? (
            <div className="mt-3 space-y-2">
              {request.materials.map((material) => (
                <button
                  className="flex min-h-11 w-full items-center justify-between rounded-control border border-brand-lavender px-4 text-left text-sm font-semibold text-brand-primary hover:bg-brand-lavenderSoft"
                  key={material.id}
                  onClick={() => void onOpenMaterial(material.id)}
                  type="button"
                >
                  <span className="truncate">{material.fileName}</span>
                  <span className="ml-3 shrink-0 text-tesText-secondary">
                    Abrir
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-tesText-secondary">
              Nenhum material foi anexado.
            </p>
          )}
        </section>
        <section className="rounded-card border border-brand-lavender p-4">
          <h3 className="text-lg font-extrabold text-brand-deep">
            Decisão administrativa
          </h3>
          <p className="mt-1 text-sm leading-6 text-tesText-secondary">
            O motivo será registrado e enviado à pessoa solicitante pela Central
            de Mensagens e por e-mail quando disponível.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-brand-deep">
              <span>Estado</span>
              <select
                className="mt-2 min-h-11 w-full rounded-control border border-brand-lavender bg-white px-3 text-sm"
                onChange={(event) =>
                  setStatus(event.target.value as typeof status)
                }
                value={status}
              >
                <option value="under_review">Em análise</option>
                <option value="needs_information">
                  Precisa de informações
                </option>
                <option value="approved">Aprovar para próxima etapa</option>
                <option value="merged">Mesclar com terapia existente</option>
                <option value="rejected">Rejeitar</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-brand-deep">
              <span>Vincular à terapia existente</span>
              <select
                className="mt-2 min-h-11 w-full rounded-control border border-brand-lavender bg-white px-3 text-sm"
                onChange={(event) => setRelatedTherapyId(event.target.value)}
                value={relatedTherapyId}
              >
                <option value="">Sem vínculo</option>
                {therapies.map((therapy) => (
                  <option key={therapy.id} value={therapy.id}>
                    {therapy.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold text-brand-deep">
            <span>Motivo</span>
            <textarea
              className="mt-2 min-h-28 w-full rounded-control border border-brand-lavender bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-brand-lavenderSoft"
              onChange={(event) => setDecision(event.target.value)}
              value={decision}
            />
          </label>
          <div className="mt-4 flex justify-end">
            <TESButton
              disabled={
                isMutating ||
                decision.trim().length < 4 ||
                (status === "merged" && !relatedTherapyId)
              }
              onClick={() =>
                void onDecide(
                  request,
                  status,
                  decision.trim(),
                  relatedTherapyId || null,
                )
              }
              type="button"
              variant="gradient"
            >
              {isMutating ? "Registrando…" : "Registrar decisão"}
            </TESButton>
          </div>
        </section>
      </div>
    </TESDialog>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-extrabold uppercase tracking-[0.12em] text-tesText-secondary">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-bold text-brand-deep">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}

function requestStatusLabel(status: string) {
  return (
    (
      {
        approved: "Aprovada",
        merged: "Mesclada",
        needs_information: "Precisa de informações",
        rejected: "Rejeitada",
        submitted: "Enviada",
        under_review: "Em análise",
      } as Record<string, string>
    )[status] ?? "Em análise"
  );
}

function isDetailedRequest(
  value:
    | AdminTherapyCatalogContract["requests"][number]
    | AdminTherapyCatalogRequestDetail,
): value is AdminTherapyCatalogRequestDetail {
  return "submission" in value && "materials" in value && "updatedAt" in value;
}

function Panel({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-[28px] border border-brand-lavender/70 bg-white p-5 shadow-[0_22px_60px_rgba(20,16,90,0.09)]">
      <h2 className="text-lg font-extrabold text-brand-deep">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function transitionLabel(action: AdminTherapyTransition) {
  return {
    archive: "arquivamento",
    deprecate: "descontinuação",
    publish: "publicação",
    review: "revisão",
    unpublish: "despublicação",
  }[action];
}

function historyLabel(value: string) {
  const labels: Record<string, string> = {
    archive: "Terapia arquivada",
    create: "Terapia criada",
    deprecate: "Terapia descontinuada",
    publish: "Terapia publicada",
    review: "Revisão iniciada",
    unpublish: "Publicação retirada",
    update: "Terapia atualizada",
  };
  return labels[value.toLowerCase()] ?? "Atualização administrativa";
}

function CatalogMetric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-[24px] border border-brand-lavender/70 bg-white p-5 shadow-[0_20px_55px_rgba(20,16,90,0.08)]">
      <p className="text-sm font-extrabold text-tesText-secondary">{label}</p>
      <p className="mt-4 text-[2.35rem] font-extrabold leading-none text-brand-deep">
        {value}
      </p>
    </article>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
