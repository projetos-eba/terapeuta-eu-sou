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
                    {params?.checkout === "success"
                      ? "Pagamento em confirmacao"
                      : "Pagamento online seguro"}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                    {params?.checkout === "success"
                      ? "Recebemos seu retorno do Stripe. O plano pago sera liberado somente apos o webhook confirmar a assinatura."
                      : "Voce seguira para o Stripe para concluir a assinatura. O plano pago sera ativado somente apos a confirmacao do webhook."}
                  </p>
                </div>
              </div>
            </div>

            <form action={startSubscriptionCheckoutAction}>
              <input type="hidden" name="plan" value={requestedPlan} />
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
      body: { plan: requestedPlan },
    });

    if (response.ok && response.data?.url) {
      redirect(response.data.url);
    }
  } catch {
    redirect(
      `${routes.public.therapistCheckout}?plan=${requestedPlan}&checkout=unavailable`,
    );
  }

  redirect(
    `${routes.public.therapistCheckout}?plan=${requestedPlan}&checkout=unavailable`,
  );
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
  } catch {
    redirect(getTherapistDashboardHref(session.plan));
  }

  redirect(getTherapistDashboardHref(session.plan));
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
