"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";

import { TESFeedbackDialog } from "@/components/tes";

import { sendTherapistFinanceConnectCommand } from "../therapist-finance.commands";
import type { TherapistFinanceConnectAction } from "../therapist-finance.types";

export function FinancialConnectAccountActions({
  primaryAction,
  primaryLabel,
  showSync = true,
}: {
  primaryAction: TherapistFinanceConnectAction;
  primaryLabel: string;
  showSync?: boolean;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] =
    useState<TherapistFinanceConnectAction | null>(null);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");

  async function run(action: TherapistFinanceConnectAction) {
    setMessage("");
    setFeedback("");
    setPendingAction(action);
    const result = await sendTherapistFinanceConnectCommand(action);
    setPendingAction(null);

    if (result.status === "error") {
      setFeedback(result.error.message);
      return;
    }

    if (result.data.url) {
      window.location.assign(result.data.url);
      return;
    }

    setMessage(result.data.message ?? "Dados atualizados.");
    router.refresh();
  }

  return (
    <div className="grid gap-3" aria-live="polite">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pendingAction !== null}
          onClick={() => void run(primaryAction)}
          type="button"
        >
          <ExternalLink aria-hidden="true" size={18} />
          {pendingAction === primaryAction ? "Abrindo..." : primaryLabel}
        </button>
        {showSync ? (
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pendingAction !== null}
            onClick={() => void run("sync")}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={18} />
            {pendingAction === "sync" ? "Atualizando..." : "Verificar situação"}
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="text-sm font-bold leading-6 text-status-success" role="status">
          {message}
        </p>
      ) : null}
      {feedback ? (
        <TESFeedbackDialog message={feedback} onClose={() => setFeedback("")} />
      ) : null}
    </div>
  );
}
