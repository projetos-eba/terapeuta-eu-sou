"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TESButton, TESDialog, TESFeedbackDialog } from "@/components/tes";
import type { TherapistPlan } from "@/domain/tes";

export type SubscriptionCommandResult = {
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  scheduledChangeAt?: string | null;
  scheduledPlan?: TherapistPlan | null;
};

export function SubscriptionCommandButton({
  action,
  children,
  className,
  description,
  onSuccess,
  targetPlan,
  title,
  variant = "primary",
}: {
  action: "cancel" | "change_plan" | "resume";
  children: string;
  className?: string;
  description: string;
  onSuccess?: (result: SubscriptionCommandResult) => void;
  targetPlan?: TherapistPlan;
  title: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/therapist/subscription", {
        body: JSON.stringify({ action, targetPlan }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: SubscriptionCommandResult;
        message?: string;
        ok?: boolean;
      } | null;

      if (!response.ok || !payload?.ok) {
        setMessage(
          payload?.message ?? "Não foi possível concluir esta alteração agora.",
        );
        return;
      }

      onSuccess?.(payload.data ?? {});
      setOpen(false);
      router.refresh();

      const projected = await waitForSubscriptionProjection({
        action,
        targetPlan,
      });
      if (!projected) {
        setMessage(
          "Alteração recebida. A confirmação pode levar alguns instantes.",
        );
      }
    } catch {
      setPending(false);
      setMessage("Não foi possível concluir esta alteração agora.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <TESButton
        className={`rounded-lg ${className ?? ""}`}
        onClick={() => setOpen(true)}
        type="button"
        variant={variant}
      >
        {children}
      </TESButton>
      {message ? (
        <TESFeedbackDialog
          message={message}
          onClose={() => setMessage(null)}
          tone={message.startsWith("Alteração recebida") ? "warning" : "error"}
        />
      ) : null}
      {open ? (
        <TESDialog
          description={description}
          onClose={() => !pending && setOpen(false)}
          title={title}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TESButton
              className="rounded-lg"
              disabled={pending}
              onClick={() => void submit()}
              type="button"
            >
              {pending ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin"
                  size={18}
                />
              ) : null}
              Confirmar alteração
            </TESButton>
            <TESButton
              className="rounded-lg"
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
              variant="secondary"
            >
              Voltar
            </TESButton>
          </div>
        </TESDialog>
      ) : null}
    </>
  );
}

async function waitForSubscriptionProjection({
  action,
  targetPlan,
}: {
  action: "cancel" | "change_plan" | "resume";
  targetPlan?: TherapistPlan;
}) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const response = await fetch("/api/therapist/subscription", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        overview?: {
          effectivePlan?: TherapistPlan;
          subscription?: {
            cancelAtPeriodEnd?: boolean;
            scheduledPlan?: TherapistPlan | null;
          } | null;
        };
      } | null;
      const overview = payload?.overview;
      const subscription = overview?.subscription;
      const projected =
        action === "cancel"
          ? subscription?.cancelAtPeriodEnd === true
          : action === "resume"
            ? subscription?.cancelAtPeriodEnd === false
            : overview?.effectivePlan === targetPlan ||
              subscription?.scheduledPlan === targetPlan;

      if (response.ok && projected) return true;
    } catch {
      // The command already succeeded; a later refresh will reconcile the view.
    }
    await new Promise((resolve) => window.setTimeout(resolve, 750));
  }
  return false;
}
