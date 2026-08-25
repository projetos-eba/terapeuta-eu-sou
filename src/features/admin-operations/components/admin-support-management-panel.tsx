"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, UserCheck } from "lucide-react";

import { TESFeedbackDialog } from "@/components/tes";

type Management = {
  assignedAdminId: string | null;
  assignedAdminName: string | null;
  booking: {
    id: string;
    patientName: string | null;
    paymentStatus: string;
    startsAt: string;
    status: string;
    therapistName: string | null;
  } | null;
  priority: "low" | "normal" | "high" | "urgent";
  requesterEmail: string | null;
  status:
    | "open"
    | "in_progress"
    | "waiting_requester"
    | "waiting_support"
    | "resolved";
};
type Action =
  | "assign_self"
  | "unassign"
  | "set_priority"
  | "start"
  | "resolve"
  | "reopen";

export function AdminSupportManagementPanel({
  ticketId,
}: {
  ticketId: string;
}) {
  const [data, setData] = useState<Management | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const requestId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch(
      `/api/admin/support/tickets/${ticketId}/management`,
      { cache: "no-store" },
    );
    const payload = (await response.json().catch(() => null)) as {
      data?: Management;
      error?: { message?: string };
      ok?: boolean;
    } | null;
    if (!response.ok || !payload?.ok || !payload.data) {
      setError(
        payload?.error?.message ??
          "Não foi possível carregar a gestão do chamado agora.",
      );
      return;
    }
    setData(payload.data);
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(action: Action, priority?: Management["priority"]) {
    setError(null);
    setIsSaving(true);
    requestId.current ??= crypto.randomUUID();
    const response = await fetch(
      `/api/admin/support/tickets/${ticketId}/management`,
      {
        body: JSON.stringify({
          action,
          priority,
          requestId: requestId.current,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    const payload = (await response.json().catch(() => null)) as {
      data?: { ticket?: Management };
      error?: { message?: string };
      ok?: boolean;
    } | null;
    setIsSaving(false);
    if (!response.ok || !payload?.ok || !payload.data?.ticket) {
      setError(
        payload?.error?.message ??
          "Não foi possível atualizar o chamado agora.",
      );
      return;
    }
    requestId.current = null;
    setData(payload.data.ticket);
    await load();
  }

  if (!data && !error)
    return (
      <p className="rounded-xl bg-surface-soft p-4 text-sm font-semibold text-tesText-secondary">
        Carregando gestão do chamado…
      </p>
    );
  if (!data)
    return (
      <p className="rounded-xl bg-status-dangerBg p-4 text-sm font-bold text-status-danger">
        {error}
      </p>
    );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-brand-deep">
          Triagem do chamado
        </h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Atribuição, prioridade e estado ficam registrados no histórico
          administrativo.
        </p>
      </div>
      <div className="rounded-xl bg-surface-soft p-3">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-tesText-secondary">
          Responsável
        </p>
        <p className="mt-1 text-sm font-bold text-brand-deep">
          {data.assignedAdminName ?? "Não atribuído"}
        </p>
        <button
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-lavender bg-white px-3 text-sm font-extrabold text-brand-primary disabled:opacity-60"
          disabled={isSaving}
          onClick={() =>
            void mutate(data.assignedAdminId ? "unassign" : "assign_self")
          }
          type="button"
        >
          <UserCheck aria-hidden="true" className="size-4" />
          {isSaving
            ? "Salvando…"
            : data.assignedAdminId
              ? "Remover atribuição"
              : "Atribuir a mim"}
        </button>
      </div>
      <label className="grid gap-2">
        <span className="text-sm font-extrabold text-brand-deep">
          Prioridade
        </span>
        <select
          className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
          disabled={isSaving}
          onChange={(event) => {
            const next = event.target.value as Management["priority"];
            if (next !== data.priority) void mutate("set_priority", next);
          }}
          value={data.priority}
        >
          <option value="low">Baixa</option>
          <option value="normal">Normal</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </label>
      <div className="grid gap-2">
        {data.status === "resolved" ? (
          <ActionButton
            disabled={isSaving}
            isSaving={isSaving}
            label="Reabrir chamado"
            onClick={() => void mutate("reopen")}
          />
        ) : (
          <>
            <ActionButton
              disabled={
                isSaving || !["open", "waiting_support"].includes(data.status)
              }
              isSaving={isSaving}
              label="Iniciar atendimento"
              onClick={() => void mutate("start")}
            />
            <ActionButton
              disabled={isSaving}
              isSaving={isSaving}
              label="Resolver chamado"
              onClick={() => void mutate("resolve")}
            />
          </>
        )}
      </div>
      {error ? (
        <TESFeedbackDialog message={error} onClose={() => setError(null)} />
      ) : null}
      {data.requesterEmail ? (
        <div className="rounded-xl bg-surface-soft p-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-tesText-secondary">
            Contato do solicitante
          </p>
          <p className="mt-1 break-all text-sm font-bold text-brand-deep">
            {data.requesterEmail}
          </p>
        </div>
      ) : null}
      {data.booking ? (
        <div className="rounded-xl border border-brand-lavender/70 bg-white p-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-tesText-secondary">
            Sessão relacionada
          </p>
          <p className="mt-1 text-sm font-bold text-brand-deep">
            {formatBookingDate(data.booking.startsAt)}
          </p>
          <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
            {data.booking.therapistName ?? "Terapeuta"} ·{" "}
            {data.booking.patientName ?? "Paciente"}
          </p>
          <p className="mt-1 text-xs font-bold text-tesText-secondary">
            {statusLabel(data.booking.status)} · Pagamento{" "}
            {data.booking.paymentStatus}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function formatBookingDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sessão relacionada"
    : date.toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}
function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function ActionButton({
  disabled,
  isSaving,
  label,
  onClick,
}: {
  disabled: boolean;
  isSaving: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <CheckCircle2 aria-hidden="true" className="size-4" />
      {isSaving ? (
        <>
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Salvando…
        </>
      ) : (
        label
      )}
    </button>
  );
}
