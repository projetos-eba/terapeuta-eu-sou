"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";

import { TESButton } from "@/components/tes";
import type { PromotionCheckoutAmounts } from "@/features/payments";
import { HoldCountdown } from "./hold-countdown";
import { ExpiredCheckoutRecovery } from "./expired-checkout-recovery";

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => {
      initEmbeddedCheckout: (options: {
        fetchClientSecret: () => Promise<string>;
        onComplete?: () => void;
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
        holdExpiresAt?: string;
        holdId?: string;
        mode: "initial_hold" | "payment_retry";
        originalAmountCents: number;
        paymentFlowVersion: string;
        paymentTiming: "immediate" | "scheduled";
        promotion: PromotionCheckoutAmounts["promotion"];
        sessionPaymentId: string;
        totalAmountCents: number;
        reservationExpiresAt: string | null;
        serverNow: string;
        snapshot?: BookingSnapshot;
      };
    }
  | {
      code: string;
      ok: false;
      message: string;
    };

type BookingSnapshot = {
  bookingId: string;
  currency: string;
  durationMinutes: number;
  endsAt: string;
  priceCents: number;
  serviceId: string;
  serviceLabel: string;
  startsAt: string;
  therapist: { name: string; slug: string };
};

export function CheckoutButton({
  acceptedTerms,
  checkoutAttemptId,
  disabled,
  isPatientAuthenticated,
  loginHref,
  onCheckoutChange,
  onPatientScheduleConflict,
  onPromotionSettled,
  promotionRequest,
  retryBookingId,
  reviewHref,
  serviceId,
  sharedNote,
  startsAt,
  therapistSlug,
  expectedDurationMinutes,
  expectedPriceCents,
}: {
  acceptedTerms: boolean;
  checkoutAttemptId?: string | null;
  disabled?: boolean;
  isPatientAuthenticated: boolean;
  loginHref: string;
  onCheckoutChange?: (input: {
    amounts: PromotionCheckoutAmounts;
    ready: boolean;
  }) => void;
  onPatientScheduleConflict?: () => void;
  onPromotionSettled?: (input: {
    error: string | null;
    promotion?: PromotionCheckoutAmounts["promotion"];
    requestId: string;
  }) => void;
  promotionRequest?: { code: string | null; requestId: string } | null;
  retryBookingId?: string | null;
  reviewHref: string;
  serviceId: string | null;
  sharedNote: string;
  startsAt: string | null;
  therapistSlug: string | null;
  expectedDurationMinutes: number | null;
  expectedPriceCents: number | null;
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
  const abandonmentStartedRef = useRef(false);
  const checkoutAmountsRef = useRef<PromotionCheckoutAmounts | null>(null);
  const [expiredCheckout, setExpiredCheckout] = useState<{
    bookingId: string;
    checkoutSessionId: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [reservationLease, setReservationLease] = useState<{
    expiresAt: string;
    serverNow: string;
  } | null>(null);
  const [paymentTiming, setPaymentTiming] = useState<
    "immediate" | "scheduled" | null
  >(null);
  const [snapshotReview, setSnapshotReview] = useState<BookingSnapshot | null>(
    null,
  );
  const [acknowledgedSnapshotKey, setAcknowledgedSnapshotKey] = useState<
    string | null
  >(null);
  const [isCancellingReview, setIsCancellingReview] = useState(false);

  const expireReservation = useCallback(() => {
    const currentCheckout = currentCheckoutRef.current;
    if (!currentCheckout || abandonmentStartedRef.current) return;
    abandonmentStartedRef.current = true;
    checkoutRef.current?.destroy();
    checkoutRef.current = null;
    setCheckoutReady(false);
    setIsSubmitting(false);
    setReservationLease(null);
    setError(null);
    setExpiredCheckout({
      bookingId: currentCheckout.bookingId,
      checkoutSessionId: currentCheckout.checkoutSessionId,
    });
    if (checkoutAmountsRef.current) {
      onCheckoutChange?.({ amounts: checkoutAmountsRef.current, ready: false });
    }
  }, [onCheckoutChange]);

  useEffect(
    () => () => {
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const replacementRequest =
      promotionRequest &&
      promotionRequest.requestId !== handledPromotionRequestRef.current &&
      currentCheckoutRef.current
        ? promotionRequest
        : null;

    async function initializeCheckout() {
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
      setCheckoutReady(false);

      if (
        !isPatientAuthenticated ||
        !acceptedTerms ||
        (!retryBookingId && (!serviceId || !startsAt)) ||
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
      const checkoutInputKey = `${retryBookingId ?? serviceId}:${startsAt ?? "retry"}:${checkoutAttemptId ?? "new"}`;
      if (checkoutInputKeyRef.current !== checkoutInputKey) {
        checkoutInputKeyRef.current = checkoutInputKey;
        requestIdRef.current = checkoutAttemptId ?? crypto.randomUUID();
        currentCheckoutRef.current = null;
        handledPromotionRequestRef.current = null;
        abandonmentStartedRef.current = false;
        setExpiredCheckout(null);
        setPaymentTiming(null);
      }
      if (abandonmentStartedRef.current) {
        setIsSubmitting(false);
        return;
      }
      setError(null);

      try {
        await loadStripeScript();
        if (cancelled) return;

        const stripe = window.Stripe?.(publishableKey);
        if (!stripe) {
          throw new Error("stripe_not_loaded");
        }

        const isPromotionReplacement = Boolean(replacementRequest);
        const previousCheckout = currentCheckoutRef.current;
        const response = await fetch("/api/public/reservation/checkout", {
          body: JSON.stringify(
            isPromotionReplacement
              ? {
                  action: "replace",
                  bookingId: previousCheckout?.bookingId,
                  checkoutAttemptId: replacementRequest!.requestId,
                  promotionCode: replacementRequest!.code,
                  replaceCheckoutSessionId: previousCheckout?.checkoutSessionId,
                }
              : retryBookingId
                ? {
                    action: "retry",
                    bookingId: retryBookingId,
                    checkoutAttemptId: requestIdRef.current,
                  }
                : {
                    action: "create",
                    checkoutAttemptId: requestIdRef.current,
                    serviceId,
                    sharedNote,
                    startsAt,
                    therapistSlug,
                    termsAccepted: true,
                  },
          ),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await response.json()) as CheckoutResponse;
        if (cancelled || abandonmentStartedRef.current) return;
        if (!data.ok) {
          if (data.code === "PATIENT_SCHEDULE_CONFLICT") {
            onPatientScheduleConflict?.();
          }
          throw new Error(data.message);
        }
        if (!data.checkout.clientSecret) {
          throw new Error("Não conseguimos carregar o pagamento seguro agora.");
        }

        currentCheckoutRef.current = {
          bookingId:
            data.checkout.bookingId ?? previousCheckout?.bookingId ?? "",
          checkoutSessionId: data.checkout.checkoutSessionId,
          clientSecret: data.checkout.clientSecret,
        };
        const responseSnapshot = data.checkout.snapshot;
        const responseSnapshotKey = responseSnapshot
          ? bookingSnapshotKey(responseSnapshot)
          : null;
        if (
          !retryBookingId &&
          responseSnapshot &&
          bookingSnapshotDiffers(responseSnapshot, {
            durationMinutes: expectedDurationMinutes,
            priceCents: expectedPriceCents,
            serviceId,
            startsAt,
            therapistSlug,
          }) &&
          acknowledgedSnapshotKey !== responseSnapshotKey
        ) {
          setSnapshotReview(responseSnapshot);
          setIsSubmitting(false);
          return;
        }
        setSnapshotReview(null);
        setPaymentTiming(data.checkout.paymentTiming);
        setReservationLease(
          data.checkout.mode === "initial_hold" &&
            data.checkout.reservationExpiresAt
            ? {
                expiresAt: data.checkout.reservationExpiresAt,
                serverNow: data.checkout.serverNow,
              }
            : null,
        );
        if (promotionRequest) {
          handledPromotionRequestRef.current = promotionRequest.requestId;
        }
        checkoutAmountsRef.current = {
          currency: data.checkout.currency,
          discountAmountCents: data.checkout.discountAmountCents,
          originalAmountCents: data.checkout.originalAmountCents,
          promotion: data.checkout.promotion,
          totalAmountCents: data.checkout.totalAmountCents,
        };
        onCheckoutChange?.({
          amounts: checkoutAmountsRef.current,
          ready: false,
        });
        const fetchClientSecret = () =>
          Promise.resolve(data.checkout.clientSecret!);
        if (cancelled) return;

        const checkout = await stripe.initEmbeddedCheckout({
          fetchClientSecret,
        });

        if (cancelled || abandonmentStartedRef.current) {
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
        if (cancelled || abandonmentStartedRef.current) return;
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
              if (!cancelled && !abandonmentStartedRef.current) {
                checkoutRef.current = checkout;
                checkout.mount("#reservation-embedded-checkout");
                setCheckoutReady(true);
              } else {
                checkout.destroy();
              }
            } catch {
              if (!cancelled && !abandonmentStartedRef.current) {
                setError("Atualize a página para retomar o pagamento seguro.");
              }
            }
          }
          if (cancelled || abandonmentStartedRef.current) return;
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
    acknowledgedSnapshotKey,
    checkoutAttemptId,
    disabled,
    expectedDurationMinutes,
    expectedPriceCents,
    isPatientAuthenticated,
    onCheckoutChange,
    onPatientScheduleConflict,
    onPromotionSettled,
    promotionRequest,
    retryBookingId,
    serviceId,
    sharedNote,
    startsAt,
    therapistSlug,
  ]);

  const cancelSnapshotReview = useCallback(async () => {
    const currentCheckout = currentCheckoutRef.current;
    if (!currentCheckout || isCancellingReview) return;
    setIsCancellingReview(true);
    abandonmentStartedRef.current = true;
    try {
      await fetch("/api/public/reservation/abandon", {
        body: JSON.stringify({
          bookingId: currentCheckout.bookingId,
          checkoutSessionId: currentCheckout.checkoutSessionId,
          reason: "reservation_details_changed",
          requestId: crypto.randomUUID(),
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        method: "POST",
      });
    } finally {
      window.location.assign(reviewHref);
    }
  }, [isCancellingReview, reviewHref]);

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
      {snapshotReview ? (
        <div className="space-y-4 rounded-[18px] border border-status-warning/30 bg-status-warningBg p-5">
          <p className="text-base font-extrabold text-brand-deep">
            Os detalhes desta terapia mudaram
          </p>
          <p className="text-sm font-semibold leading-6 text-tesText-secondary">
            Confira antes de carregar o pagamento: {snapshotReview.serviceLabel}
            , {snapshotReview.durationMinutes} min,{" "}
            {formatSnapshotPrice(snapshotReview)}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TESButton
              onClick={() =>
                setAcknowledgedSnapshotKey(bookingSnapshotKey(snapshotReview))
              }
              type="button"
            >
              Revisei os detalhes
            </TESButton>
            <TESButton
              disabled={isCancellingReview}
              onClick={() => void cancelSnapshotReview()}
              type="button"
              variant="secondary"
            >
              Escolher outro horário
            </TESButton>
          </div>
        </div>
      ) : null}
      {reservationLease ? (
        <div className="rounded-[18px] border border-brand-lavender bg-brand-lavenderSoft p-4 text-sm font-extrabold text-brand-primary">
          Horário reservado por até{" "}
          <HoldCountdown
            expiresAt={reservationLease.expiresAt}
            onExpire={expireReservation}
            serverNow={reservationLease.serverNow}
          />
        </div>
      ) : null}
      {expiredCheckout ? (
        <ExpiredCheckoutRecovery
          bookingId={expiredCheckout.bookingId}
          checkoutSessionId={expiredCheckout.checkoutSessionId}
        />
      ) : null}
      <div className="rounded-[18px] bg-surface-muted p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 size-5 shrink-0 text-brand-primary" />
          <p className="text-sm font-semibold leading-6 text-tesText-secondary">
            O formulário abaixo é carregado pela Stripe. O TES não recebe número
            de cartão, CVC ou dados de autenticação bancária.
            {paymentTiming === "scheduled" ? (
              <span className="mt-2 block">
                Seu cartão será salvo com segurança e a cobrança será realizada
                24 horas antes do encontro. O banco poderá pedir uma confirmação
                adicional.
              </span>
            ) : null}
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

function bookingSnapshotKey(snapshot: BookingSnapshot) {
  return [
    snapshot.bookingId,
    snapshot.serviceId,
    snapshot.startsAt,
    snapshot.endsAt,
    snapshot.durationMinutes,
    snapshot.priceCents,
    snapshot.therapist.slug,
  ].join(":");
}

function bookingSnapshotDiffers(
  snapshot: BookingSnapshot,
  expected: {
    durationMinutes: number | null;
    priceCents: number | null;
    serviceId: string | null;
    startsAt: string | null;
    therapistSlug: string | null;
  },
) {
  return (
    snapshot.durationMinutes !== expected.durationMinutes ||
    snapshot.priceCents !== expected.priceCents ||
    snapshot.serviceId !== expected.serviceId ||
    new Date(snapshot.startsAt).getTime() !==
      new Date(expected.startsAt ?? "").getTime() ||
    snapshot.therapist.slug !== expected.therapistSlug
  );
}

function formatSnapshotPrice(snapshot: BookingSnapshot) {
  return new Intl.NumberFormat("pt-BR", {
    currency: snapshot.currency.toUpperCase(),
    style: "currency",
  }).format(snapshot.priceCents / 100);
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
