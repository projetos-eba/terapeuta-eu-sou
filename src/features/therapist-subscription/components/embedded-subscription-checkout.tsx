"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";

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
  const [isOpeningHostedCheckout, setIsOpeningHostedCheckout] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
        setError("Configuração pública da Stripe ausente neste ambiente.");
        setIsLoading(false);
        return;
      }

      try {
        await loadStripeScript();
        if (cancelled) return;

        const stripe = window.Stripe?.(publishableKey);
        if (!stripe) {
          throw new Error("Não conseguimos carregar a Stripe agora.");
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
              const data = (await response.json()) as CheckoutResponse;

              if (!data.ok) {
                throw new Error(data.message);
              }

              if (!data.checkout.clientSecret) {
                throw new Error(
                  "Não conseguimos carregar o checkout incorporado agora.",
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
  }, [plan]);

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
      const data = (await response.json()) as CheckoutResponse;

      if (!data.ok) {
        throw new Error(data.message);
      }

      if (!data.checkout.url) {
        throw new Error("Não conseguimos abrir o checkout em nova etapa.");
      }

      window.location.assign(data.checkout.url);
    } catch (error) {
      setFallbackError(
        error instanceof Error
          ? error.message
          : "Não conseguimos abrir o checkout em nova etapa.",
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
            Checkout seguro no TES
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            O formulário abaixo é carregado pela Stripe. O TES não recebe número
            de cartão, CVC ou dados de autenticação bancária.
          </p>
        </div>
      </div>

      <div className="rounded-[18px] bg-surface-muted p-4">
        <p className="flex gap-2 text-sm font-semibold leading-6 text-tesText-secondary">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-brand-primary"
            aria-hidden="true"
          />
          O redirect de retorno não ativa o plano. Premium e Premium Plus só são
          liberados após confirmação do webhook Stripe.
        </p>
      </div>

      {isLoading ? (
        <div
          aria-live="polite"
          className="flex min-h-[260px] items-center justify-center rounded-[18px] border border-dashed border-brand-lavender bg-brand-lavenderSoft/40 p-6 text-sm font-bold text-tesText-muted"
        >
          <Loader2 className="mr-3 size-5 animate-spin text-brand-primary" />
          Carregando checkout seguro...
        </div>
      ) : null}

      {error ? (
        <div className="space-y-3 rounded-[18px] border border-status-danger/20 bg-status-danger/10 p-4">
          <p
            role="alert"
            className="text-sm font-bold leading-6 text-status-danger"
          >
            {error}
          </p>
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
            Continuar para pagamento em nova etapa
          </button>
          {fallbackError ? (
            <p className="text-xs font-bold text-status-danger">
              {fallbackError}
            </p>
          ) : null}
        </div>
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
        () => reject(new Error("Não conseguimos carregar a Stripe agora.")),
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
      () => reject(new Error("Não conseguimos carregar a Stripe agora.")),
      { once: true },
    );
    document.head.appendChild(script);
  });
}
