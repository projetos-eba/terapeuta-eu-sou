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
  | "professional.publish"
  | "professional.reactivate"
  | "professional.suspend"
  | "review.hide"
  | "review.restore"
  | "support.reopen"
  | "support.resolve"
  | "verification.approve"
  | "verification.pause_review"
  | "verification.reject"
  | "verification.reopen_review"
  | "verification.request_changes";

type CommandOption = {
  action: CommandAction;
  entityId?: string;
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
    () => getCommandOptions(data),
    [data],
  );

  if (options.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold leading-6 text-tesText-secondary">
        {getEmptyActionMessage(data.module, data.statusLabel)}
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
          entityId: option.entityId ?? data.id,
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
      setSuccess(getCommandSuccessMessage(option.action, payload));
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
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
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

export function getCommandOptions(
  data: Pick<
    AdminOperationDetailPageData,
    "canPublish" | "module" | "relatedProfessionalId" | "statusLabel"
  >,
): CommandOption[] {
  const { canPublish, module, relatedProfessionalId, statusLabel } = data;
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

    if (statusLabel === "approved") {
      return [
        ...(canPublish
          ? [
              {
                action: "professional.publish" as const,
                label: "Tornar publicado e elegível",
                tone: "success" as const,
              },
            ]
          : []),
          {
            action: "professional.suspend",
            label: "Suspender profissional",
            tone: "danger",
          },
        ];
    }

    return [];
  }

  if (module === "verifications") {
    if (statusLabel === "submitted") {
      return [
        {
          action: "verification.reopen_review",
          label: "Iniciar análise",
          tone: "neutral",
        },
      ];
    }

    if (statusLabel === "in_review") {
      return [
        {
          action: "verification.approve",
          label: "Aprovar verificação",
          tone: "success",
        },
        {
          action: "verification.pause_review",
          label: "Solicitar ajustes",
          tone: "warning",
        },
        {
          action: "verification.reject",
          label: "Reprovar verificação",
          tone: "danger",
        },
      ];
    }

    if (statusLabel === "changes_requested" || statusLabel === "rejected") {
      return [
        {
          action: "verification.reopen_review",
          label: "Reabrir análise",
          tone: "neutral",
        },
      ];
    }

    if (
      statusLabel === "approved" &&
      canPublish &&
      relatedProfessionalId
    ) {
      return [
        {
          action: "professional.publish",
          entityId: relatedProfessionalId,
          label: "Tornar publicado e elegível",
          tone: "success",
        },
      ];
    }

    return [];
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

function getEmptyActionMessage(
  module: AdminOperationModuleKey,
  statusLabel?: string,
) {
  if (module === "verifications" && statusLabel === "approved") {
    return "Esta análise foi concluída. A publicação só fica disponível quando o perfil atende a todos os critérios.";
  }

  if (module === "professionals" && statusLabel !== "approved") {
    return "A aprovação deste cadastro é conduzida pela fila de verificações.";
  }

  return "Nenhuma ação administrativa está disponível para este estado.";
}

function getCommandSuccessMessage(action: CommandAction, payload?: ApiEnvelope) {
  const eligibility =
    payload && payload.ok && isRecord(payload.data)
      ? publicationEligibility(payload.data)
      : null;
  if (action === "verification.approve" && eligibility?.eligible === false) {
    const blockers = publicationBlockers(eligibility.blockers);
    return blockers
      ? `Verificação aprovada. A publicação está pendente: ${blockers}.`
      : "Verificação aprovada. A publicação ainda está pendente.";
  }
  const messages: Record<CommandAction, string> = {
    "professional.publish": "Perfil publicado e disponível para reservas.",
    "professional.reactivate": "Profissional reativado com sucesso.",
    "professional.suspend": "Profissional suspenso com sucesso.",
    "review.hide": "Avaliação ocultada com sucesso.",
    "review.restore": "Avaliação restaurada com sucesso.",
    "support.reopen": "Atendimento reaberto com sucesso.",
    "support.resolve": "Atendimento concluído com sucesso.",
    "verification.approve": "Profissional aprovado com sucesso.",
    "verification.pause_review": "Ajustes solicitados ao profissional.",
    "verification.reject": "Cadastro não aprovado.",
    "verification.reopen_review": "Análise iniciada ou reaberta.",
    "verification.request_changes": "Ajustes solicitados ao profissional.",
  };

  return messages[action];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function publicationEligibility(value: Record<string, unknown>) {
  const nextState = isRecord(value.nextState) ? value.nextState : null;
  const eligibility = nextState?.publicationEligibility;
  return isRecord(eligibility) ? eligibility : null;
}

function publicationBlockers(value: unknown) {
  if (!Array.isArray(value)) return "";
  const labels: Record<string, string> = {
    no_active_bookable_online_service: "nenhum serviço publicável",
    not_accepting_bookings: "não aceita novos agendamentos",
    profile_not_public: "perfil público desativado",
    profile_not_published: "perfil ainda não publicado",
    therapy_not_public: "terapia não publicada ou não visível",
  };
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => labels[item] ?? item)
    .join(" · ");
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
