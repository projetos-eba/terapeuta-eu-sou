"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

type CheckoutStatus =
  | "active"
  | "canceled"
  | "expired"
  | "failed"
  | "pending"
  | "requires_action";

type StatusPayload = {
  checkout?: {
    plan?: "free" | "premium" | "premium_plus" | null;
    status?: CheckoutStatus;
    subscriptionStatus?: string | null;
  };
  ok?: boolean;
};

const maxAttempts = 8;
const delays = [1000, 2000, 3000, 5000, 8000, 13000, 21000, 34000];
const terminalStatuses = new Set<CheckoutStatus>([
  "active",
  "canceled",
  "expired",
  "failed",
  "requires_action",
]);

export function SubscriptionCheckoutReturnStatus({
  sessionId,
}: {
  plan: "premium" | "premium_plus";
  sessionId: string;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [status, setStatus] = useState<CheckoutStatus>("pending");
  const abortRef = useRef<AbortController | null>(null);

  const copy = useMemo(() => getStatusCopy(status, error), [error, status]);

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll(nextAttempt: number) {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setError(null);
        const response = await fetch(
          "/api/therapist/subscription-checkout/status",
          {
            body: JSON.stringify({ sessionId }),
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            method: "POST",
            signal: controller.signal,
          },
        );
        const text = await response.text();
        const payload = parseStatusPayload(text);

        if (!response.ok || payload?.ok === false) {
          throw new Error(
            payload?.checkout?.status ?? "subscription_status_unavailable",
          );
        }

        const nextStatus = payload?.checkout?.status ?? "pending";

        if (!isMounted) return;
        setStatus(nextStatus);
        setAttempt(nextAttempt + 1);

        if (nextStatus === "active") {
          router.replace(routes.therapist.home);
          router.refresh();
          return;
        }

        if (
          terminalStatuses.has(nextStatus) ||
          nextAttempt + 1 >= maxAttempts
        ) {
          return;
        }

        timer = setTimeout(() => poll(nextAttempt + 1), delays[nextAttempt]);
      } catch (pollError) {
        if (!isMounted || controller.signal.aborted) return;
        setError("status_unavailable");
        setAttempt(nextAttempt + 1);

        if (nextAttempt + 1 < maxAttempts) {
          timer = setTimeout(() => poll(nextAttempt + 1), delays[nextAttempt]);
        }
      }
    }

    poll(0);

    return () => {
      isMounted = false;
      abortRef.current?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [router, sessionId, isRetrying]);

  return (
    <section
      aria-live="polite"
      className="rounded-card border border-brand-lavender bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          {status === "active" ? (
            <CheckCircle2 className="size-5" aria-hidden="true" />
          ) : error || status === "failed" || status === "expired" ? (
            <AlertTriangle className="size-5" aria-hidden="true" />
          ) : (
            <Clock3 className="size-5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-brand-deep">{copy.title}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {copy.description}
          </p>
          {status === "pending" && !error ? (
            <p className="mt-3 text-xs font-bold text-tesText-muted">
              Tentativa {Math.min(attempt + 1, maxAttempts)} de {maxAttempts}
            </p>
          ) : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setAttempt(0);
                setError(null);
                setStatus("pending");
                setIsRetrying((value) => !value);
              }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-brand-primary/30 bg-white px-6 py-3 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
            >
              <RotateCw className="size-4" aria-hidden="true" />
              Verificar novamente
            </button>
            <TESButton
              href={routes.therapist.home}
              size="lg"
              variant="secondary"
              className="min-h-12 w-full rounded-2xl text-sm"
            >
              Ir para minha area
            </TESButton>
          </div>
        </div>
      </div>
    </section>
  );
}

function parseStatusPayload(text: string): StatusPayload | null {
  if (!text) return null;

  try {
    return JSON.parse(text) as StatusPayload;
  } catch {
    return null;
  }
}

function getStatusCopy(status: CheckoutStatus, error: string | null) {
  if (error) {
    return {
      title: "Confirmacao temporariamente indisponivel",
      description:
        "Não conseguimos consultar a confirmação neste instante. Seu plano continua protegido e você pode verificar novamente.",
    };
  }

  switch (status) {
    case "active":
      return {
        title: "Pagamento confirmado",
        description:
          "Sua assinatura foi confirmada e estamos atualizando sua área profissional.",
      };
    case "failed":
      return {
        title: "Pagamento nao confirmado",
        description:
          "Esta assinatura não foi confirmada. Seu plano continua Free e você pode iniciar uma nova tentativa.",
      };
    case "canceled":
      return {
        title: "Checkout cancelado",
        description:
          "Esta tentativa foi cancelada. Nenhum plano pago foi liberado por este retorno.",
      };
    case "expired":
      return {
        title: "Sessao expirada",
        description:
          "Esta sessao de checkout expirou. Seu plano continua Free e uma nova tentativa pode ser iniciada.",
      };
    case "requires_action":
      return {
        title: "Pagamento exige acao",
        description:
          "A assinatura ainda precisa de uma ação antes de liberar o plano.",
      };
    default:
      return {
        title: "Confirmando seu pagamento",
        description:
          "Estamos confirmando o pagamento. O plano pago será liberado assim que essa etapa for concluída.",
      };
  }
}
