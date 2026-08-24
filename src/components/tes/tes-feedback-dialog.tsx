"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";

import { TESButton } from "./tes-button";
import { TESDialog } from "./tes-dialog";

export function TESFeedbackDialog({
  message,
  onClose,
  title,
  tone = "error",
}: {
  message: string;
  onClose: () => void;
  title?: string;
  tone?: "error" | "warning";
}) {
  const Icon = tone === "warning" ? AlertTriangle : AlertCircle;
  const resolvedTitle = title ?? (tone === "warning" ? "Atenção" : "Não foi possível continuar");

  return (
    <TESDialog onClose={onClose} title={resolvedTitle}>
      <div className="grid gap-5">
        <div
          aria-live="assertive"
          className={
            tone === "warning"
              ? "flex items-start gap-3 rounded-xl border border-status-warning/30 bg-status-warningBg p-4 text-status-warning"
              : "flex items-start gap-3 rounded-xl border border-status-danger/30 bg-status-dangerBg p-4 text-status-danger"
          }
          role="alert"
        >
          <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm font-bold leading-6">{message}</p>
        </div>
        <TESButton className="min-h-11 rounded-lg" onClick={onClose} type="button">
          Entendi
        </TESButton>
      </div>
    </TESDialog>
  );
}
