"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";

import { TESFeedbackDialog } from "@/components/tes";

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

type PaidPlan = "premium" | "premium_plus";

type CheckoutResponse =
  | {
      ok: true;
      checkout: {
        checkoutSessionId: string;
        clientSecret: string | null;
        mode: string;
        url?: string | null;
      };
    }
  | {
      code: string;
      message: string;
      ok: false;
    };

export function EmbeddedSubscriptionCheckout({ plan }: { plan: PaidPlan }) {
  const checkoutRef = useRef<{
    destroy: () => void;
    mount: (selector: string) => void;
  } | null>(null);
  const clientSecretPromiseRef = useRef<Promise<string> | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isOpeningHostedCheckout, setIsOpeningHostedCheckout] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [resetKey, setResetKey] = useState(0);

  const feedbackMessage = fallbackError ?? error;

  useEffect(() => {
    if (feedbackMessage) setFeedback(feedbackMessage);
  }, [feedbackMessage]);

  useEffect(() => {
    let cancelled = false;

    async function initializeCheckout() {
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
      clientSecretPromiseRef.current = null;
      requestIdRef.current = crypto.randomUUID();
      setCheckoutReady(false);
      setError(null);
      setIsLoading(true);

      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        setError("O pagamento está temporariamente indisponível.");
        setIsLoading(false);
        return;
      }

      try {
        await loadStripeScript();
        if (cancelled) return;

        const stripe = window.Stripe?.(publishableKey);
        if (!stripe) {
          throw new Error("Não conseguimos carregar o pagamento agora.");
        }

        const fetchClientSecret = () => {
          if (!clientSecretPromiseRef.current) {
            clientSecretPromiseRef.current = (async () => {
              const response = await fetch(
                "/api/therapist/subscription-checkout",
                {
                  body: JSON.stringify({
                    checkoutUiMode: "embedded",
                    plan,
                    requestId: requestIdRef.current,
                  }),
                  headers: {
                    "Content-Type": "application/json",
                  },
                  method: "POST",
                },
              );
              const data = await parseCheckoutResponse(response);

              if (!data.ok) {
                throw new Error(data.message);
              }

              if (!data.checkout.clientSecret) {
                throw new Error(
                  "Não conseguimos carregar o pagamento agora.",
                );
              }

              return data.checkout.clientSecret;
            })();
          }

          return clientSecretPromiseRef.current;
        };

        await fetchClientSecret();
        if (cancelled) return;

        const checkout = await stripe.initEmbeddedCheckout({
          fetchClientSecret,
        });

        if (cancelled) {
          checkout.destroy();
          return;
        }

        checkoutRef.current = checkout;
        checkout.mount("#subscription-embedded-checkout");
        setCheckoutReady(true);
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Não conseguimos iniciar o pagamento agora. Tente novamente.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void initializeCheckout();

    return () => {
      cancelled = true;
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
    };
  }, [plan, resetKey]);

  async function openHostedCheckoutFallback() {
    setFallbackError(null);
    setIsOpeningHostedCheckout(true);

    try {
      const response = await fetch("/api/therapist/subscription-checkout", {
        body: JSON.stringify({
          checkoutUiMode: "hosted",
          plan,
          requestId: crypto.randomUUID(),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = await parseCheckoutResponse(response);

      if (!data.ok) {
        throw new Error(data.message);
      }

      if (!data.checkout.url) {
        throw new Error("Não conseguimos abrir o pagamento em uma nova etapa.");
      }

      window.location.assign(data.checkout.url);
    } catch (error) {
      setFallbackError(
        error instanceof Error
          ? error.message
          : "Não conseguimos abrir o pagamento em uma nova etapa.",
      );
      setIsOpeningHostedCheckout(false);
    }
  }

  return (
    <section
      aria-labelledby="subscription-checkout-title"
      className="space-y-4 rounded-card border border-border bg-white p-4 shadow-soft sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <CreditCard className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2
            id="subscription-checkout-title"
            className="text-base font-extrabold text-brand-deep"
          >
            Pagamento seguro no TES
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Seus dados de pagamento são processados em ambiente protegido. O TES
            não recebe número de cartão, CVC ou dados de autenticação bancária.
          </p>
        </div>
      </div>

      <div className="rounded-[18px] bg-surface-muted p-4">
        <p className="flex gap-2 text-sm font-semibold leading-6 text-tesText-secondary">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-brand-primary"
            aria-hidden="true"
          />
          Premium e Premium Plus só são liberados após a confirmação segura do
          pagamento.
        </p>
      </div>

      {isLoading ? (
        <div
          aria-live="polite"
          className="flex min-h-[260px] items-center justify-center rounded-[18px] border border-dashed border-brand-lavender bg-brand-lavenderSoft/40 p-6 text-sm font-bold text-tesText-muted"
        >
          <Loader2 className="mr-3 size-5 animate-spin text-brand-primary" />
          Carregando pagamento seguro...
        </div>
      ) : null}

      {error ? (
        <div className="space-y-3 rounded-[18px] border border-status-danger/20 bg-status-danger/10 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-brand-primary/30 bg-white px-5 py-2.5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
              onClick={() => {
                setFallbackError(null);
                setResetKey((value) => value + 1);
              }}
            >
              Tentar novamente
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-brand-primary/30 bg-white px-5 py-2.5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isOpeningHostedCheckout}
              onClick={() => void openHostedCheckoutFallback()}
            >
              {isOpeningHostedCheckout ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CreditCard className="size-4" aria-hidden="true" />
              )}
              Continuar em nova etapa
            </button>
          </div>
          {fallbackError ? (
            <p className="text-sm font-bold leading-6 text-status-danger">
              A etapa alternativa não pôde ser aberta. Tente novamente.
            </p>
          ) : null}
        </div>
      ) : null}

      {feedback ? (
        <TESFeedbackDialog
          message={feedback}
          onClose={() => setFeedback(null)}
        />
      ) : null}

      <div
        id="subscription-embedded-checkout"
        className={checkoutReady ? "min-h-[520px]" : "min-h-0"}
      />

      {checkoutReady ? (
        <div className="flex justify-center border-t border-border pt-4">
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={`/terapeuta/checkout?plan=${plan}&checkout=canceled`}
          >
            Cancelar e voltar
          </a>
        </div>
      ) : null}
    </section>
  );
}

async function parseCheckoutResponse(response: Response) {
  const text = await response.text();
  let data: CheckoutResponse | null = null;

  try {
    data = text ? (JSON.parse(text) as CheckoutResponse) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    return {
      code: data?.ok === false ? data.code : "checkout_unavailable",
      message:
        data?.ok === false
          ? data.message
          : "Não conseguimos iniciar o pagamento agora. Tente novamente.",
      ok: false,
    } satisfies CheckoutResponse;
  }

  if (!data) {
    return {
      code: "invalid_checkout_response",
      message: "Não conseguimos iniciar o pagamento agora. Tente novamente.",
      ok: false,
    } satisfies CheckoutResponse;
  }

  return data;
}

function loadStripeScript() {
  if (window.Stripe) return Promise.resolve();

  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[src="https://js.stripe.com/v3/"]',
  );

  if (existingScript) {
    return new Promise<void>((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Não conseguimos carregar o pagamento agora.")),
        { once: true },
      );
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Não conseguimos carregar o pagamento agora.")),
      { once: true },
    );
    document.head.appendChild(script);
  });
}
