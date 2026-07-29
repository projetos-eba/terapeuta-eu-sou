"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Loader2 } from "lucide-react";

import { TESButton } from "@/components/tes";

type CheckoutResponse =
  | {
      ok: true;
      redirectTo: string;
    }
  | {
      ok: false;
      message: string;
    };

export function CheckoutButton({
  disabled,
  isPatientAuthenticated,
  loginHref,
  serviceId,
  startsAt,
}: {
  disabled?: boolean;
  isPatientAuthenticated: boolean;
  loginHref: string;
  serviceId: string | null;
  startsAt: string | null;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isPatientAuthenticated) {
    return (
      <TESButton href={loginHref} variant="gradient" size="lg" className="w-full">
        Entrar para continuar
        <ArrowRight className="size-4" aria-hidden="true" />
      </TESButton>
    );
  }

  async function handleCheckout() {
    if (!serviceId || !startsAt || disabled) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/public/reservation/checkout", {
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          serviceId,
          startsAt,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as CheckoutResponse;

      if (!data.ok) {
        setError(data.message);
        return;
      }

      window.location.assign(data.redirectTo);
    } catch {
      setError("Não conseguimos iniciar o pagamento agora. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-brand-primary px-7 py-3 text-base font-extrabold text-white shadow-soft transition hover:bg-brand-primaryHover focus:outline-none focus:ring-4 focus:ring-ring/20 disabled:pointer-events-none disabled:opacity-60"
        disabled={disabled || isSubmitting || !serviceId || !startsAt}
        onClick={handleCheckout}
        type="button"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Iniciando pagamento...
          </>
        ) : (
          <>
            Pagar e confirmar
            <ArrowRight className="size-4" aria-hidden="true" />
          </>
        )}
      </button>
      {error ? (
        <p role="alert" className="text-sm font-bold text-status-danger">
          {error}
        </p>
      ) : null}
      {!serviceId || !startsAt ? (
        <p className="text-sm font-bold text-tesText-muted">
          Escolha um horário disponível antes de seguir para o pagamento.
        </p>
      ) : null}
      <p className="text-center text-xs font-bold text-tesText-muted">
        Checkout seguro via Stripe. O plano do terapeuta não altera sua reserva.
      </p>
    </div>
  );
}

export function ReservationLinkButton({
  children,
  disabled,
  href,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  href: string;
}) {
  if (disabled) {
    return (
      <button
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand-primary px-7 py-3 text-base font-extrabold text-white opacity-50"
        disabled
        type="button"
      >
        {children}
      </button>
    );
  }

  return (
    <Link
      href={href as Route<string>}
      className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-brand-primary px-7 py-3 text-base font-extrabold text-white shadow-soft transition hover:bg-brand-primaryHover focus:outline-none focus:ring-4 focus:ring-ring/20"
    >
      {children}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}
