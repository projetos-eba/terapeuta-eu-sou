"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { TESButton } from "@/components/tes/tes-button";
import { TESDialog } from "@/components/tes/tes-dialog";

import type { AdminSessionAttendance } from "../admin-operations.types";

type Resolution =
  | "performed"
  | "platform_refund"
  | "platform_reschedule"
  | "refund"
  | "reschedule"
  | "retain";

export function AdminSessionAttendanceResolution({
  attendance,
}: {
  attendance: AdminSessionAttendance;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Resolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestId = useRef<string | null>(null);
  const options = useMemo(() => getOptions(attendance), [attendance]);

  if (!attendance.incidentId || attendance.resolution || options.length === 0) {
    return null;
  }

  async function submit() {
    const trimmedReason = reason.trim();
    if (!selected || trimmedReason.length < 20) {
      setError("Escolha um desfecho e informe uma justificativa com pelo menos 20 caracteres.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/sessions/attendance-resolution",
        {
          body: JSON.stringify({
            incidentId: attendance.incidentId,
            reason: trimmedReason,
            requestId: (requestId.current ??= crypto.randomUUID()),
            resolution: selected,
          }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; ok?: boolean; providerStatus?: string }
        | null;
      if (!response.ok || payload?.ok !== true) {
        setError(payload?.message ?? "Não foi possível registrar a decisão.");
        return;
      }

      setOpen(false);
      setReason("");
      setSelected(null);
      requestId.current = null;
      router.refresh();
    } catch {
      setError("Não foi possível conectar agora. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <TESButton onClick={() => setOpen(true)} size="sm" type="button">
        Definir desfecho
      </TESButton>
      {open ? (
        <TESDialog
          description="Qualquer decisão financeira exige sua autorização explícita e justificativa. A classificação de ausência não executa reembolso automaticamente."
          onClose={() => !submitting && setOpen(false)}
          title="Resolver sessão não realizada"
        >
          <div className="grid gap-5">
            <div className="grid gap-2">
              {options.map((option) => (
                <button
                  className={`rounded-card border px-4 py-3 text-left text-sm font-extrabold transition ${
                    selected === option.value
                      ? "border-brand-primary bg-brand-lavenderSoft text-brand-deep"
                      : "border-border bg-white text-tesText-secondary hover:border-brand-lavender"
                  }`}
                  key={option.value}
                  onClick={() => setSelected(option.value)}
                  type="button"
                >
                  <span className="block">{option.label}</span>
                  <span className="mt-1 block font-semibold leading-5">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>

            <label className="grid gap-2 text-sm font-extrabold text-brand-deep">
              Justificativa administrativa
              <textarea
                className="min-h-28 resize-y rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold leading-6 outline-none focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
                maxLength={1000}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Registre as evidências consideradas e o motivo da decisão."
                value={reason}
              />
            </label>

            {error ? (
              <p className="rounded-md bg-status-dangerBg p-3 text-sm font-bold leading-6 text-status-danger">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <TESButton
                disabled={submitting}
                onClick={() => setOpen(false)}
                type="button"
                variant="ghost"
              >
                Voltar
              </TESButton>
              <TESButton disabled={submitting} onClick={submit} type="button">
                {submitting ? "Registrando…" : "Confirmar decisão"}
              </TESButton>
            </div>
          </div>
        </TESDialog>
      ) : null}
    </>
  );
}

function getOptions(attendance: AdminSessionAttendance) {
  const options: Array<{
    description: string;
    label: string;
    value: Resolution;
  }> = [
    {
      description: "Mantém a cobrança vinculada e abre a escolha de um novo horário, sem nova cobrança.",
      label: "Autorizar reagendamento",
      value: "reschedule",
    },
    {
      description: "Solicita reembolso integral; a recuperação do repasse é tratada separadamente.",
      label: "Autorizar reembolso integral",
      value: "refund",
    },
    {
      description: "Mantém a cobrança e abre novo horário sem atribuir dívida ou penalidade ao terapeuta.",
      label: "Falha do TES — reagendar",
      value: "platform_reschedule",
    },
    {
      description: "Reembolsa integralmente e registra que o custo é do TES, sem penalidade ao terapeuta.",
      label: "Falha do TES — reembolsar",
      value: "platform_refund",
    },
  ];

  if (attendance.classification === "requires_review" && attendance.bothJoined) {
    options.unshift({
      description: "Use somente quando a evidência confirmar que a sessão efetivamente ocorreu.",
      label: "Confirmar sessão realizada",
      value: "performed",
    });
  }
  if (
    attendance.classification === "no_show_both" &&
    attendance.retentionAuthorized
  ) {
    options.push({
      description: "Encerra sem reembolso e sem remuneração do terapeuta, somente quando a política da reserva autoriza.",
      label: "Reter valor da reserva",
      value: "retain",
    });
  }

  if (attendance.classification === "no_show_therapist" || attendance.classification === "no_show_both") {
    return options.filter((option) => option.value === "refund");
  }
  if (attendance.classification === "no_show_patient") return [];
  return options;
}
