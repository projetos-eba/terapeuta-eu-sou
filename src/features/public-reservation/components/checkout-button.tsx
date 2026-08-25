"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";

import { TESButton } from "@/components/tes";
import type { PromotionCheckoutAmounts } from "@/features/payments";

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => {
      initEmbeddedCheckout: (options: {
        fetchClientSecret: () => Promise<string>;
      }) => Promise<{
        destroy: () => void;
        mount: (selector: string) => void;
      }>;
    };
  }
}

type CheckoutResponse =
  | {
      ok: true;
      checkout: {
        bookingId: string;
        checkoutSessionId: string;
        clientSecret: string | null;
        currency: string;
        discountAmountCents: number;
        holdExpiresAt: string;
        holdId: string;
        originalAmountCents: number;
        promotion: PromotionCheckoutAmounts["promotion"];
        sessionPaymentId: string;
        totalAmountCents: number;
      };
    }
  | {
      code: string;
      ok: false;
      message: string;
    };

export function CheckoutButton({
  acceptedTerms,
  disabled,
  isPatientAuthenticated,
  loginHref,
  onCheckoutChange,
  onPromotionSettled,
  promotionRequest,
  serviceId,
  startsAt,
}: {
  acceptedTerms: boolean;
  disabled?: boolean;
  isPatientAuthenticated: boolean;
  loginHref: string;
  onCheckoutChange?: (input: {
    amounts: PromotionCheckoutAmounts;
    ready: boolean;
  }) => void;
  onPromotionSettled?: (input: {
    error: string | null;
    promotion?: PromotionCheckoutAmounts["promotion"];
    requestId: string;
  }) => void;
  promotionRequest?: { code: string | null; requestId: string } | null;
  serviceId: string | null;
  startsAt: string | null;
}) {
  const checkoutRef = useRef<{
    destroy: () => void;
    mount: (selector: string) => void;
  } | null>(null);
  const checkoutInputKeyRef = useRef<string | null>(null);
  const currentCheckoutRef = useRef<{
    bookingId: string;
    checkoutSessionId: string;
    clientSecret: string;
  } | null>(null);
  const handledPromotionRequestRef = useRef<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutReady, setCheckoutReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initializeCheckout() {
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
      setCheckoutReady(false);

      if (
        !isPatientAuthenticated ||
        !acceptedTerms ||
        !serviceId ||
        !startsAt ||
        disabled
      ) {
        setIsSubmitting(false);
        return;
      }

      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        setIsSubmitting(false);
        setError("Não foi possível carregar o pagamento seguro agora.");
        return;
      }

      setIsSubmitting(true);
      setError(null);
      const checkoutInputKey = `${serviceId}:${startsAt}`;
      if (checkoutInputKeyRef.current !== checkoutInputKey) {
        checkoutInputKeyRef.current = checkoutInputKey;
        requestIdRef.current = crypto.randomUUID();
        currentCheckoutRef.current = null;
        handledPromotionRequestRef.current = null;
      }

      try {
        await loadStripeScript();
        if (cancelled) return;

        const stripe = window.Stripe?.(publishableKey);
        if (!stripe) {
          throw new Error("stripe_not_loaded");
        }

        const isPromotionReplacement =
          promotionRequest &&
          promotionRequest.requestId !== handledPromotionRequestRef.current &&
          currentCheckoutRef.current;
        const previousCheckout = currentCheckoutRef.current;
        const response = await fetch("/api/public/reservation/checkout", {
          body: JSON.stringify(
            isPromotionReplacement
              ? {
                  action: "replace",
                  bookingId: previousCheckout?.bookingId,
                  checkoutAttemptId: promotionRequest.requestId,
                  promotionCode: promotionRequest.code,
                  replaceCheckoutSessionId: previousCheckout?.checkoutSessionId,
                }
              : {
                  action: "create",
                  checkoutAttemptId: requestIdRef.current,
                  serviceId,
                  startsAt,
                  termsAccepted: true,
                },
          ),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await response.json()) as CheckoutResponse;
        if (!data.ok) throw new Error(data.message);
        if (!data.checkout.clientSecret) {
          throw new Error("Não conseguimos carregar o pagamento seguro agora.");
        }

        currentCheckoutRef.current = {
          bookingId:
            data.checkout.bookingId ?? previousCheckout?.bookingId ?? "",
          checkoutSessionId: data.checkout.checkoutSessionId,
          clientSecret: data.checkout.clientSecret,
        };
        if (promotionRequest) {
          handledPromotionRequestRef.current = promotionRequest.requestId;
        }
        onCheckoutChange?.({
          amounts: {
            currency: data.checkout.currency,
            discountAmountCents: data.checkout.discountAmountCents,
            originalAmountCents: data.checkout.originalAmountCents,
            promotion: data.checkout.promotion,
            totalAmountCents: data.checkout.totalAmountCents,
          },
          ready: false,
        });
        const fetchClientSecret = () =>
          Promise.resolve(data.checkout.clientSecret!);
        if (cancelled) return;

        const checkout = await stripe.initEmbeddedCheckout({
          fetchClientSecret,
        });

        if (cancelled) {
          checkout.destroy();
          return;
        }

        checkoutRef.current = checkout;
        checkout.mount("#reservation-embedded-checkout");
        setCheckoutReady(true);
        onCheckoutChange?.({
          amounts: {
            currency: data.checkout.currency,
            discountAmountCents: data.checkout.discountAmountCents,
            originalAmountCents: data.checkout.originalAmountCents,
            promotion: data.checkout.promotion,
            totalAmountCents: data.checkout.totalAmountCents,
          },
          ready: true,
        });
        if (promotionRequest) {
          onPromotionSettled?.({
            error: null,
            promotion: data.checkout.promotion,
            requestId: promotionRequest.requestId,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Não conseguimos iniciar o pagamento agora. Tente novamente.";
        if (promotionRequest) {
          handledPromotionRequestRef.current = promotionRequest.requestId;
          const previousCheckout = currentCheckoutRef.current;
          const stripe = window.Stripe?.(publishableKey);
          if (stripe && previousCheckout?.clientSecret && !cancelled) {
            try {
              const checkout = await stripe.initEmbeddedCheckout({
                fetchClientSecret: () =>
                  Promise.resolve(previousCheckout.clientSecret),
              });
              if (!cancelled) {
                checkoutRef.current = checkout;
                checkout.mount("#reservation-embedded-checkout");
                setCheckoutReady(true);
              } else {
                checkout.destroy();
              }
            } catch {
              setError("Atualize a página para retomar o pagamento seguro.");
            }
          }
          onPromotionSettled?.({
            error: message,
            requestId: promotionRequest.requestId,
          });
        } else {
          setError(message);
        }
      } finally {
        if (!cancelled) setIsSubmitting(false);
      }
    }

    void initializeCheckout();

    return () => {
      cancelled = true;
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
    };
  }, [
    acceptedTerms,
    disabled,
    isPatientAuthenticated,
    onCheckoutChange,
    onPromotionSettled,
    promotionRequest,
    serviceId,
    startsAt,
  ]);

  if (!isPatientAuthenticated) {
    return (
      <TESButton
        href={loginHref}
        variant="gradient"
        size="lg"
        className="mt-6 w-full"
      >
        Entrar para continuar
        <ArrowRight className="size-4" aria-hidden="true" />
      </TESButton>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-[18px] bg-surface-muted p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 size-5 shrink-0 text-brand-primary" />
          <p className="text-sm font-semibold leading-6 text-tesText-secondary">
            O formulário abaixo é carregado pela Stripe. O TES não recebe número
            de cartão, CVC ou dados de autenticação bancária.
          </p>
        </div>
      </div>
      {isSubmitting ? (
        <div
          aria-live="polite"
          className="flex min-h-[240px] items-center justify-center rounded-[18px] border border-dashed border-brand-lavender bg-white p-6 text-sm font-bold text-tesText-muted"
        >
          <Loader2 className="mr-3 size-5 animate-spin text-brand-primary" />
          Carregando checkout seguro...
        </div>
      ) : null}
      {!acceptedTerms ? (
        <p role="alert" className="text-sm font-bold text-status-danger">
          Aceite os termos na etapa anterior antes de iniciar o pagamento.
        </p>
      ) : null}
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
      <div
        id="reservation-embedded-checkout"
        className={checkoutReady ? "min-h-[420px]" : "min-h-0"}
      />
      <p className="text-center text-xs font-bold text-tesText-muted">
        Checkout seguro via Stripe. O retorno visual não confirma o pagamento;
        aguarde a confirmação final antes de considerar sua reserva concluída.
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

let stripeScriptPromise: Promise<void> | null = null;
const stripeScriptUrl = "https://js.stripe.com/v3/";

function loadStripeScript() {
  stripeScriptPromise =
    stripeScriptPromise ??
    new Promise<void>((resolve, reject) => {
      if (window.Stripe) {
        resolve();
        return;
      }

      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${stripeScriptUrl}"]`,
      );
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("stripe_js_failed")),
          {
            once: true,
          },
        );
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.src = stripeScriptUrl;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Não foi possível carregar a Stripe."));
      document.head.appendChild(script);
    });

  return stripeScriptPromise;
}
