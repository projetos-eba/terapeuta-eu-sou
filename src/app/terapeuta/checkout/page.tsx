import type { Metadata } from "next";
import {
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { redirect } from "next/navigation";

import { TESButton } from "@/components/tes";
import { getTherapistPlanDefinition, TherapistPlan } from "@/domain/tes";
import {
  getTherapistDashboardHref,
  isPaidTherapistPlan,
  normalizeTherapistPlan,
  TherapistAuthShell,
} from "@/features/therapist-auth";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";
import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
  SupabaseFunctionError,
} from "@/lib/supabase/edge-functions";

export const metadata: Metadata = {
  description:
    "Revisao do plano escolhido antes do pagamento da assinatura profissional TES.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Checkout do plano | Terapeuta Eu Sou",
};

export default async function TherapistCheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<{
    checkout?: string;
    created?: string;
    plan?: string;
  }>;
}) {
  const params = await searchParams;
  const requestedPlan = normalizeTherapistPlan(params?.plan);

  if (!isPaidTherapistPlan(requestedPlan)) {
    redirect(routes.public.forTherapists);
  }

  const checkoutContinuation = `${routes.public.therapistCheckout}?plan=${requestedPlan}`;
  const session = await requireTherapistSession({
    loginContinuation: checkoutContinuation,
  });
  const plan = getTherapistPlanDefinition(requestedPlan);
  const hasActivePaidPlan = session.plan !== TherapistPlan.Free;
  const checkoutRequestId = crypto.randomUUID();

  return (
    <TherapistAuthShell
      className="lg:px-14"
      eyebrow="Assinatura TES"
      title="Seu proximo passo, com seguranca."
      description="Revise o plano escolhido antes de seguir para o pagamento."
    >
      <div className="w-full space-y-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
            {params?.created === "1" ? "Conta criada" : "Plano profissional"}
          </p>
          <h1 className="mt-3 font-display text-4xl font-light italic leading-tight text-brand-deep sm:text-5xl">
            {hasActivePaidPlan
              ? "Seu plano ja esta ativo"
              : "Finalize sua assinatura"}
          </h1>
          <p className="mt-3 text-base font-semibold leading-7 text-tesText-secondary">
            {hasActivePaidPlan
              ? `Voce esta no plano ${getTherapistPlanDefinition(session.plan).name}.`
              : `Sua conta esta pronta. Falta confirmar o plano ${plan.name}.`}
          </p>
        </div>

        <section
          aria-labelledby="checkout-plan-title"
          className="rounded-card border border-brand-lavender bg-brand-lavenderSoft p-5 sm:p-6"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
                Plano escolhido
              </p>
              <h2
                id="checkout-plan-title"
                className="mt-2 text-2xl font-extrabold text-brand-deep"
              >
                TES {plan.name}
              </h2>
              <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-tesText-secondary">
                {plan.description}
              </p>
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="text-2xl font-extrabold text-brand-primary">
                {plan.priceLabel}
              </p>
              <p className="mt-1 text-xs font-bold text-tesText-muted">
                {plan.priceNote}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatusItem icon={CheckCircle2} label="Conta" value="Criada" />
          <StatusItem
            icon={CreditCard}
            label="Plano atual"
            value={getTherapistPlanDefinition(session.plan).name}
          />
          <StatusItem
            icon={ShieldCheck}
            label="Plano escolhido"
            value={plan.name}
          />
        </div>

        {hasActivePaidPlan ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <TESButton
              href={getTherapistDashboardHref(session.plan)}
              size="lg"
              variant="gradient"
              className="min-h-12 w-full rounded-2xl text-base"
            >
              Acessar minha area
            </TESButton>
            <form action={openBillingPortalAction}>
              <button
                type="submit"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-brand-primary/30 bg-white px-7 py-3 text-base font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
              >
                <CreditCard className="size-5" aria-hidden="true" />
                Gerenciar assinatura
              </button>
            </form>
          </div>
        ) : (
          <>
            <div
              id="checkout-availability"
              className="rounded-card border border-border bg-surface-soft px-5 py-4"
            >
              <div className="flex gap-3">
                <LockKeyhole
                  className="mt-0.5 size-5 shrink-0 text-brand-primary"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-extrabold text-brand-deep">
                    {getCheckoutStatusCopy(params?.checkout).title}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                    {getCheckoutStatusCopy(params?.checkout).description}
                  </p>
                </div>
              </div>
            </div>

            <form action={startSubscriptionCheckoutAction}>
              <input type="hidden" name="plan" value={requestedPlan} />
              <input type="hidden" name="requestId" value={checkoutRequestId} />
              <button
                type="submit"
                aria-describedby="checkout-availability"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary px-7 py-3 text-base font-extrabold text-white transition hover:bg-brand-primary/90"
              >
                <CreditCard className="size-5" aria-hidden="true" />
                Continuar para pagamento
              </button>
            </form>

            <TESButton
              href={routes.therapist.home}
              size="lg"
              variant="secondary"
              className="min-h-12 w-full rounded-2xl text-base"
            >
              Acessar o plano Free
            </TESButton>
          </>
        )}

        <p className="flex items-center justify-center gap-2 text-center text-xs font-bold text-tesText-muted">
          <ShieldCheck className="size-4" aria-hidden="true" />O pagamento da
          assinatura sera processado com seguranca pelo Stripe.
        </p>
      </div>
    </TherapistAuthShell>
  );
}

async function startSubscriptionCheckoutAction(formData: FormData) {
  "use server";

  const requestedPlan = normalizeTherapistPlan(
    String(formData.get("plan") ?? ""),
  );
  const requestId = String(formData.get("requestId") ?? "");

  if (!isPaidTherapistPlan(requestedPlan)) {
    redirect(routes.public.forTherapists);
  }

  const session = await requireTherapistSession({
    loginContinuation: `${routes.public.therapistCheckout}?plan=${requestedPlan}`,
  });
  const config = getSupabasePublicConfig();

  if (!config) {
    redirect(
      `${routes.public.therapistCheckout}?plan=${requestedPlan}&checkout=unavailable`,
    );
  }

  try {
    const response = await invokeSupabaseFunction<{
      data?: { url?: string | null };
      ok: boolean;
    }>(config, "stripe-create-subscription-checkout", {
      accessToken: session.accessToken,
      body: { plan: requestedPlan, requestId },
    });

    if (response.ok && response.data?.url) {
      redirect(response.data.url);
    }
  } catch (error) {
    if (isNextRedirect(error)) throw error;

    const checkoutStatus = getCheckoutFailureStatus(error);

    redirect(
      `${routes.public.therapistCheckout}?plan=${requestedPlan}&checkout=${checkoutStatus}`,
    );
  }

  redirect(
    `${routes.public.therapistCheckout}?plan=${requestedPlan}&checkout=unavailable`,
  );
}

function getCheckoutFailureStatus(error: unknown) {
  if (error instanceof SupabaseFunctionError) {
    if (
      error.code === "stripe_price_missing" ||
      error.code === "billing_price_not_found" ||
      error.code === "stripe_catalog_mismatch"
    ) {
      return "catalog";
    }

    if (
      error.code === "missing_stripe_env" ||
      error.code === "missing_supabase_env" ||
      error.code === "invalid_stripe_secret_key"
    ) {
      return "configuration";
    }

    if (
      error.code === "unauthorized" ||
      error.code === "role_mismatch" ||
      error.status === 401 ||
      error.status === 403
    ) {
      return "unauthorized";
    }
  }

  return "unavailable";
}

function getCheckoutStatusCopy(status?: string) {
  switch (status) {
    case "success":
      return {
        title: "Pagamento em confirmacao",
        description:
          "Recebemos seu retorno do Stripe. O plano pago sera liberado somente apos o webhook confirmar a assinatura.",
      };
    case "canceled":
      return {
        title: "Checkout cancelado",
        description:
          "Seu plano continua Free. Voce pode retomar o pagamento quando quiser, sem alterar sua conta pelo retorno do Stripe.",
      };
    case "catalog":
      return {
        title: "Catalogo em sincronizacao",
        description:
          "Nao conseguimos carregar o preco deste plano agora. Nossa equipe precisa sincronizar o catalogo Stripe antes de liberar o checkout.",
      };
    case "configuration":
      return {
        title: "Pagamento indisponivel",
        description:
          "A configuracao de pagamentos esta indisponivel neste ambiente. Tente novamente em alguns instantes.",
      };
    case "unauthorized":
      return {
        title: "Sessao expirada",
        description:
          "Entre novamente como terapeuta para continuar com a assinatura escolhida.",
      };
    case "unavailable":
      return {
        title: "Checkout indisponivel",
        description:
          "Nao conseguimos iniciar o checkout agora. Seu plano continua Free e nenhuma cobranca foi criada.",
      };
    default:
      return {
        title: "Pagamento online seguro",
        description:
          "Voce seguira para o Stripe para concluir a assinatura. O plano pago sera ativado somente apos a confirmacao do webhook.",
      };
  }
}

async function openBillingPortalAction() {
  "use server";

  const session = await requireTherapistSession();
  const config = getSupabasePublicConfig();

  if (!config) {
    redirect(getTherapistDashboardHref(session.plan));
  }

  try {
    const response = await invokeSupabaseFunction<{
      data?: { url?: string | null };
      ok: boolean;
    }>(config, "stripe-create-billing-portal", {
      accessToken: session.accessToken,
    });

    if (response.ok && response.data?.url) {
      redirect(response.data.url);
    }
  } catch (error) {
    if (isNextRedirect(error)) throw error;

    redirect(getTherapistDashboardHref(session.plan));
  }

  redirect(getTherapistDashboardHref(session.plan));
}

function isNextRedirect(error: unknown) {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

function StatusItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-card border border-border bg-white px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-tesText-muted">{label}</p>
        <p className="truncate text-sm font-extrabold text-brand-deep">
          {value}
        </p>
      </div>
    </div>
  );
}
