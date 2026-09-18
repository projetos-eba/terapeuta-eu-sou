"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CreditCard, ShieldCheck } from "lucide-react";

import { TESButton } from "@/components/tes/tes-button";

type RecoveryElements = {
  create(
    type: "payment",
    options?: { layout?: "tabs" },
  ): {
    destroy(): void;
    mount(target: HTMLElement): void;
  };
  submit(): Promise<{ error?: { message?: string } }>;
};

type RecoveryStripe = {
  confirmPayment(options: {
    clientSecret: string;
    confirmParams: { return_url: string };
    elements: RecoveryElements;
    redirect: "if_required";
  }): Promise<{
    error?: { message?: string };
    paymentIntent?: { status?: string };
  }>;
  elements(options: { clientSecret: string }): RecoveryElements;
};

type RecoveryStripeFactory = (publishableKey: string) => RecoveryStripe | null;

export function SessionChargeRecoveryCard({
  bookingId,
  stripePublishableKey,
}: {
  bookingId: string;
  stripePublishableKey: string;
}) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<RecoveryStripe | null>(null);
  const elementsRef = useRef<RecoveryElements | null>(null);
  const submittingRef = useRef(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "loading" | "ready" | "submitting"
  >("idle");

  useEffect(() => {
    if (!clientSecret || !mountRef.current || !stripePublishableKey) return;
    let active = true;
    let paymentElement: ReturnType<RecoveryElements["create"]> | null = null;

    void loadStripeScript()
      .then(() => {
        if (!active || !mountRef.current) return;
        const factory = window.Stripe as unknown as
          | RecoveryStripeFactory
          | undefined;
        const stripe = factory?.(stripePublishableKey) ?? null;
        if (!stripe) throw new Error("stripe_unavailable");
        const elements = stripe.elements({ clientSecret });
        paymentElement = elements.create("payment", { layout: "tabs" });
        paymentElement.mount(mountRef.current);
        stripeRef.current = stripe;
        elementsRef.current = elements;
        setPhase("ready");
      })
      .catch(() => {
        if (!active) return;
        setMessage(
          "Não foi possível abrir a confirmação agora. Tente novamente.",
        );
        setPhase("idle");
      });

    return () => {
      active = false;
      paymentElement?.destroy();
      stripeRef.current = null;
      elementsRef.current = null;
    };
  }, [clientSecret, stripePublishableKey]);

  async function prepare() {
    setMessage(null);
    setPhase("loading");
    try {
      const response = await fetch("/api/patient/session-charge-recovery", {
        body: JSON.stringify({ bookingId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { clientSecret?: unknown };
        error?: { message?: unknown };
      } | null;
      if (!response.ok || typeof payload?.data?.clientSecret !== "string") {
        throw new Error(
          typeof payload?.error?.message === "string"
            ? payload.error.message
            : "Não foi possível abrir a confirmação agora.",
        );
      }
      setClientSecret(payload.data.clientSecret);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a confirmação agora.",
      );
      setPhase("idle");
    }
  }

  async function confirm() {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements || !clientSecret || submittingRef.current) return;
    submittingRef.current = true;
    setMessage(null);
    setPhase("submitting");
    try {
      const validation = await elements.submit();
      if (validation.error) {
        setMessage(
          validation.error.message ??
            "Confira os dados do pagamento e tente novamente.",
        );
        return;
      }

      const result = await stripe.confirmPayment({
        clientSecret,
        confirmParams: { return_url: window.location.href },
        elements,
        redirect: "if_required",
      });
      if (result.error) {
        setMessage(
          result.error.message ??
            "Não foi possível confirmar o pagamento. Revise os dados e tente novamente.",
        );
        return;
      }

      setMessage("Pagamento enviado para confirmação.");
      router.refresh();
    } catch {
      setMessage(
        "Não foi possível concluir o pagamento agora. Tente novamente em instantes.",
      );
    } finally {
      submittingRef.current = false;
      setPhase("ready");
    }
  }

  return (
    <section className="grid gap-4 rounded-card border border-status-warning bg-status-warningBg p-5 shadow-card sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-status-warning">
          <AlertCircle aria-hidden="true" size={21} />
        </span>
        <div className="grid gap-1">
          <h2 className="text-lg font-extrabold text-brand-deep">
            Confirme o pagamento para manter o encontro
          </h2>
          <p className="text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            Seu banco precisa de uma confirmação ou de outro cartão. Conclua
            esta etapa antes do horário agendado.
          </p>
        </div>
      </div>

      {!clientSecret ? (
        <TESButton
          className="w-full sm:w-fit"
          disabled={phase === "loading" || !stripePublishableKey}
          onClick={() => void prepare()}
          type="button"
        >
          <CreditCard aria-hidden="true" size={19} />
          {phase === "loading" ? "Abrindo…" : "Concluir pagamento"}
        </TESButton>
      ) : (
        <div className="grid gap-4 rounded-[22px] bg-white p-4 sm:p-5">
          <div ref={mountRef} />
          <TESButton
            className="w-full sm:w-fit"
            disabled={phase !== "ready"}
            onClick={() => void confirm()}
            type="button"
          >
            <ShieldCheck aria-hidden="true" size={19} />
            {phase === "submitting" ? "Confirmando…" : "Confirmar pagamento"}
          </TESButton>
        </div>
      )}

      <p
        aria-live="polite"
        className="text-sm font-semibold text-tesText-secondary"
      >
        {message}
      </p>
    </section>
  );
}

const stripeScriptUrl = "https://js.stripe.com/v3/";

function loadStripeScript() {
  if (window.Stripe) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${stripeScriptUrl}"]`,
  );
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("stripe_script_failed")),
        {
          once: true,
        },
      );
    });
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = stripeScriptUrl;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("stripe_script_failed")),
      {
        once: true,
      },
    );
    document.head.appendChild(script);
  });
}
