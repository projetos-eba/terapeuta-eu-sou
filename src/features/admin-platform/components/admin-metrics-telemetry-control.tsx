"use client";

import { CircleOff, Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { TESDialog } from "@/components/tes/tes-dialog";

import type { AdminSecurityPageData } from "../admin-platform.types";

type Telemetry = NonNullable<AdminSecurityPageData["telemetry"]>;

export function AdminMetricsTelemetryControl({
  canManage,
  telemetry,
}: {
  canManage: boolean;
  telemetry: AdminSecurityPageData["telemetry"];
}) {
  if (!telemetry) {
    return (
      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h2 className="text-xl font-extrabold text-brand-deep">
          Coleta de métricas de descoberta
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          Não foi possível carregar a configuração desta coleta agora. Nenhuma
          alteração foi feita.
        </p>
      </section>
    );
  }

  return <TelemetryControlCard canManage={canManage} telemetry={telemetry} />;
}

function TelemetryControlCard({
  canManage,
  telemetry,
}: {
  canManage: boolean;
  telemetry: Telemetry;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const requestId = useRef<string | null>(null);
  const nextEnabled = !telemetry.enabled;
  const actionLabel = nextEnabled ? "Ativar coleta" : "Desligar coleta";

  async function submit() {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 8 || normalizedReason.length > 500) {
      setMessage("Informe uma justificativa entre 8 e 500 caracteres.");
      return;
    }

    if (!requestId.current) requestId.current = crypto.randomUUID();
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/metricas/telemetria", {
        body: JSON.stringify({
          enabled: nextEnabled,
          reason: normalizedReason,
          requestId: requestId.current,
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        ok?: boolean;
      } | null;

      if (!response.ok || !payload?.ok) {
        setMessage(
          payload?.message ??
            "Não foi possível atualizar a coleta agora. Confira a situação antes de tentar novamente.",
        );
        router.refresh();
        return;
      }

      setOpen(false);
      setMessage(
        nextEnabled
          ? "Coleta ativada e registrada na Auditoria."
          : "Coleta desligada e registrada na Auditoria.",
      );
      router.refresh();
    } catch {
      setMessage(
        "Não foi possível atualizar a coleta agora. Tente novamente mais tarde.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-white p-5 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span
            aria-hidden="true"
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${
              telemetry.enabled
                ? "bg-status-successBg text-status-success"
                : "bg-surface-muted text-brand-primary"
            }`}
          >
            {telemetry.enabled ? (
              <Radio className="size-5" />
            ) : (
              <CircleOff className="size-5" />
            )}
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-brand-deep">
              Coleta de métricas de descoberta
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              Acompanha, de forma agregada, como as pessoas chegam aos perfis e
              iniciam um agendamento.
            </p>
          </div>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-extrabold ${
            telemetry.enabled
              ? "bg-status-successBg text-status-success"
              : "bg-surface-muted text-tesText-secondary"
          }`}
        >
          {telemetry.enabled ? "Ativa" : "Desligada"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 border-y border-border py-4 text-sm font-semibold text-tesText-secondary sm:grid-cols-2">
        <p>
          Retenção máxima: <strong className="text-brand-deep">{telemetry.retentionDays} dias</strong>
        </p>
        <p>
          Última alteração: <strong className="text-brand-deep">{formatDateTime(telemetry.updatedAt)}</strong>
        </p>
      </div>

      {canManage ? (
        <div className="mt-4">
          <button
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-extrabold text-white outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20 ${
              nextEnabled
                ? "bg-brand-primary hover:brightness-110"
                : "bg-status-danger hover:brightness-95"
            }`}
            onClick={() => {
              requestId.current = crypto.randomUUID();
              setReason("");
              setMessage("");
              setOpen(true);
            }}
            type="button"
          >
            {actionLabel}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm font-semibold text-tesText-secondary">
          Você pode consultar esta configuração, mas não possui acesso para alterá-la.
        </p>
      )}
      <p aria-live="polite" className="mt-3 text-sm font-semibold text-tesText-secondary">
        {message}
      </p>

      {open ? (
        <TESDialog
          description={
            nextEnabled
              ? "A coleta começará a registrar novos dados agregados. A decisão e sua justificativa ficarão na Auditoria."
              : "Novos registros deixarão de ser coletados. Os dados existentes permanecem somente pelo período de retenção aplicável."
          }
          onClose={() => {
            if (!pending) setOpen(false);
          }}
          title={`Confirmar: ${actionLabel.toLowerCase()}`}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label className="block">
              <span className="text-sm font-extrabold text-brand-deep">
                Justificativa da decisão
              </span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border border-brand-lavender bg-white p-3 text-sm font-semibold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
                disabled={pending}
                maxLength={500}
                minLength={8}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explique por que esta alteração está sendo realizada."
                required
                value={reason}
              />
              <span className="mt-2 block text-xs font-semibold text-tesText-muted">
                Entre 8 e 500 caracteres.
              </span>
            </label>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
                disabled={pending}
                onClick={() => setOpen(false)}
                type="button"
              >
                Voltar
              </button>
              <button
                className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-extrabold text-white outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 ${
                  nextEnabled
                    ? "bg-brand-primary hover:brightness-110"
                    : "bg-status-danger hover:brightness-95"
                }`}
                disabled={pending || reason.trim().length < 8}
                type="submit"
              >
                {pending ? "Atualizando…" : `Confirmar: ${actionLabel.toLowerCase()}`}
              </button>
            </div>
          </form>
        </TESDialog>
      ) : null}
    </section>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Ainda não alterada";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
