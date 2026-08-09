"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

import type {
  AdminOperationDetailPageData,
  AdminOperationModuleKey,
} from "../admin-operations.types";

type CommandAction =
  | "professional.reactivate"
  | "professional.suspend"
  | "review.hide"
  | "review.restore"
  | "support.reopen"
  | "support.resolve"
  | "verification.approve"
  | "verification.reject"
  | "verification.request_changes";

type CommandOption = {
  action: CommandAction;
  label: string;
  tone: "danger" | "neutral" | "success" | "warning";
};

type ApiEnvelope =
  | { data: unknown; ok: true }
  | { error?: { message?: string }; ok: false };

export function AdminOperationCommandPanel({
  data,
}: {
  data: AdminOperationDetailPageData;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const options = useMemo(
    () => getCommandOptions(data.module, data.statusLabel),
    [data.module, data.statusLabel],
  );

  if (options.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold leading-6 text-tesText-secondary">
        Nenhuma ação administrativa direta está habilitada para este estado.
      </div>
    );
  }

  async function submitCommand(option: CommandOption) {
    const trimmedReason = reason.trim();

    setError(null);
    setSuccess(null);

    if (trimmedReason.length < 8) {
      setError("Informe um motivo com pelo menos 8 caracteres.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/operations", {
        body: JSON.stringify({
          action: option.action,
          entityId: data.id,
          reason: trimmedReason,
          requestId: crypto.randomUUID(),
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as ApiEnvelope;

      if (!response.ok || !payload?.ok) {
        setError(
          payload && !payload.ok
            ? (payload.error?.message ?? "Não foi possível executar a ação.")
            : "Não foi possível executar a ação.",
        );
        return;
      }

      setReason("");
      setSuccess("Ação registrada com auditoria.");
      router.refresh();
    } catch {
      setError("Não foi possível conectar agora. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-status-warningBg text-status-warning">
          <ShieldAlert aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-brand-deep">
            Ações administrativas
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Toda ação exige motivo e gera evento de auditoria.
          </p>
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-extrabold text-brand-deep">Motivo</span>
        <textarea
          className="mt-2 min-h-28 w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold leading-6 text-brand-deep outline-none transition placeholder:text-tesText-muted focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Descreva o motivo operacional da ação."
          value={reason}
        />
      </label>

      {error ? (
        <p className="flex items-start gap-2 rounded-md border border-status-danger/20 bg-status-dangerBg p-3 text-sm font-bold leading-6 text-status-danger">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="flex items-start gap-2 rounded-md border border-status-success/20 bg-status-successBg p-3 text-sm font-bold leading-6 text-status-success">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {success}
        </p>
      ) : null}

      <div className="grid gap-2">
        {options.map((option) => (
          <button
            className={commandButtonClass(option.tone)}
            disabled={isSubmitting}
            key={option.action}
            onClick={() => void submitCommand(option)}
            type="button"
          >
            {option.tone === "success" ? (
              <CheckCircle2 aria-hidden="true" className="size-4" />
            ) : option.tone === "neutral" ? (
              <RotateCcw aria-hidden="true" className="size-4" />
            ) : (
              <AlertTriangle aria-hidden="true" className="size-4" />
            )}
            {isSubmitting ? "Registrando..." : option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function getCommandOptions(
  module: AdminOperationModuleKey,
  statusLabel?: string,
): CommandOption[] {
  if (module === "professionals") {
    if (statusLabel === "suspended") {
      return [
        {
          action: "professional.reactivate",
          label: "Reativar profissional",
          tone: "neutral",
        },
      ];
    }

    return [
      {
        action: "professional.suspend",
        label: "Suspender profissional",
        tone: "danger",
      },
    ];
  }

  if (module === "verifications") {
    return [
      {
        action: "verification.approve",
        label: "Aprovar verificação",
        tone: "success",
      },
      {
        action: "verification.request_changes",
        label: "Solicitar ajuste",
        tone: "warning",
      },
      {
        action: "verification.reject",
        label: "Reprovar verificação",
        tone: "danger",
      },
    ];
  }

  if (module === "support") {
    if (statusLabel === "resolved") {
      return [
        {
          action: "support.reopen",
          label: "Reabrir ticket",
          tone: "neutral",
        },
      ];
    }

    return [
      {
        action: "support.resolve",
        label: "Resolver ticket",
        tone: "success",
      },
    ];
  }

  if (module === "reviews") {
    if (statusLabel === "hidden") {
      return [
        {
          action: "review.restore",
          label: "Restaurar avaliação",
          tone: "neutral",
        },
      ];
    }

    return [
      {
        action: "review.hide",
        label: "Ocultar avaliação",
        tone: "warning",
      },
    ];
  }

  return [];
}

function commandButtonClass(tone: CommandOption["tone"]) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-extrabold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60";

  if (tone === "danger") {
    return `${base} bg-status-danger text-white hover:bg-status-danger/90`;
  }

  if (tone === "success") {
    return `${base} bg-status-success text-white hover:bg-status-success/90`;
  }

  if (tone === "warning") {
    return `${base} bg-status-warning text-brand-deep hover:bg-status-warning/90`;
  }

  return `${base} border border-border bg-white text-brand-primary hover:bg-brand-lavenderSoft`;
}
