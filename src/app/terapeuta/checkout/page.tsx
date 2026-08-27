import type { Metadata } from "next";
import {
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AuthBackButton, PublicLogo, TESButton } from "@/components/tes";
import { getTherapistPlanDefinition, TherapistPlan } from "@/domain/tes";
import {
  getTherapistDashboardHref,
  getTherapistLoginHref,
  isPaidTherapistPlan,
  normalizeTherapistPlan,
} from "@/features/therapist-auth";
import {
  EmbeddedSubscriptionCheckout,
  SubscriptionCheckoutReturnStatus,
} from "@/features/therapist-subscription";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";
import {
  getSupabasePublicConfig,
  invokeSupabaseFunction,
} from "@/lib/supabase/edge-functions";

export const metadata: Metadata = {
  description:
    "Revisão do plano escolhido antes do pagamento da assinatura profissional TES.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Pagamento do plano | Terapeuta Eu Sou",
};

export default async function TherapistCheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<{
    checkout?: string;
    created?: string;
    plan?: string;
    session_id?: string;
  }>;
}) {
  const params = await searchParams;
  const requestedPlan = normalizeTherapistPlan(params?.plan);

  if (!isPaidTherapistPlan(requestedPlan)) {
    redirect(routes.public.forTherapists);
  }

  const checkoutContinuation = buildCheckoutContinuation(requestedPlan, params);
  const cookieStore = await cookies();
  const hasTherapistCookie = Boolean(
    cookieStore.get("tes_therapist_access_token")?.value,
  );
  const isCheckoutReturn = isCheckoutReturnStatus(params?.checkout);

  if (isCheckoutReturn && !hasTherapistCookie) {
    return (
      <CheckoutReturnWithoutSession
        checkoutContinuation={checkoutContinuation}
        checkoutStatus={params?.checkout}
        plan={requestedPlan}
      />
    );
  }

  const session = await requireTherapistSession({
    loginContinuation: checkoutContinuation,
  });
  const plan = getTherapistPlanDefinition(requestedPlan);
  const hasActivePaidPlan = session.plan !== TherapistPlan.Free;
  const isSuccessfulCheckoutReturn =
    params?.checkout === "success" && Boolean(params.session_id);

  return (
    <TherapistCheckoutFrame>
      <div className="grid items-start gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10 lg:p-10">
        <div className="min-w-0 space-y-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
              {params?.created === "1" ? "Conta criada" : "Plano profissional"}
            </p>
            <h1 className="mt-3 font-display text-4xl font-light italic leading-[1.02] text-brand-deep sm:text-[3.25rem]">
              {hasActivePaidPlan
                ? "Seu plano já está ativo"
                : "Finalize sua assinatura"}
            </h1>
            <p className="mt-3 text-base font-semibold leading-7 text-tesText-secondary">
              {hasActivePaidPlan
                ? `Você está no plano ${getTherapistPlanDefinition(session.plan).name}.`
                : `Sua conta está pronta. Falta confirmar o plano ${plan.name}.`}
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

          {!hasActivePaidPlan ? (
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
          ) : null}
        </div>

        <div className="min-w-0">
          {hasActivePaidPlan ? (
            <div className="grid gap-3 rounded-card border border-border bg-white p-5 shadow-soft sm:grid-cols-2 sm:p-6">
              <TESButton
                href={getTherapistDashboardHref(session.plan)}
                size="lg"
                variant="gradient"
                className="min-h-12 w-full rounded-2xl text-base"
              >
                Acessar minha área
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
          ) : isSuccessfulCheckoutReturn && params?.session_id ? (
            <SubscriptionCheckoutReturnStatus
              plan={requestedPlan}
              sessionId={params.session_id}
            />
          ) : params?.checkout === "success" ? (
            <CheckoutReturnMissingSessionId plan={requestedPlan} />
          ) : (
            <EmbeddedSubscriptionCheckout
              key={requestedPlan}
              plan={requestedPlan}
            />
          )}
        </div>
      </div>

      {!hasActivePaidPlan ? (
        <div className="border-t border-border px-6 py-6 sm:px-8 lg:px-10">
          <TESButton
            href={routes.therapist.home}
            size="lg"
            variant="secondary"
            className="min-h-12 w-full rounded-2xl text-base"
          >
            Acessar o plano Free
          </TESButton>
        </div>
      ) : null}

      <p className="flex items-center justify-center gap-2 border-t border-border px-6 py-5 text-center text-xs font-bold text-tesText-muted sm:px-8 lg:px-10">
        <ShieldCheck className="size-4" aria-hidden="true" />O pagamento da
        assinatura será processado em ambiente seguro de pagamento.
      </p>
    </TherapistCheckoutFrame>
  );
}

function CheckoutReturnWithoutSession({
  checkoutContinuation,
  checkoutStatus,
  plan,
}: {
  checkoutContinuation: string;
  checkoutStatus?: string;
  plan: "premium" | "premium_plus";
}) {
  const planDefinition = getTherapistPlanDefinition(plan);
  const copy = getCheckoutStatusCopy(checkoutStatus);

  return (
    <TherapistCheckoutFrame>
      <div className="grid items-start gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-10 lg:p-10">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
            Retorno do pagamento
          </p>
          <h1 className="mt-3 font-display text-4xl font-light italic leading-tight text-brand-deep sm:text-5xl">
            {copy.title}
          </h1>
          <p className="mt-3 text-base font-semibold leading-7 text-tesText-secondary">
            {copy.description}
          </p>

          <section className="mt-6 rounded-card border border-brand-lavender bg-brand-lavenderSoft p-5 sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
              Plano escolhido
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-brand-deep">
              TES {planDefinition.name}
            </h2>
            <p className="mt-2 text-sm font-extrabold text-brand-primary">
              {planDefinition.priceLabel}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              Entre novamente para acompanhar a confirmação e acessar sua área
              profissional. Nenhum plano pago é liberado apenas por esta página.
            </p>
          </section>
        </div>

        <div className="grid gap-3 self-center">
          <TESButton
            href={getTherapistLoginHref(checkoutContinuation)}
            size="lg"
            variant="gradient"
            className="min-h-12 w-full rounded-2xl text-base"
          >
            Entrar para acompanhar
          </TESButton>
          <TESButton
            href={routes.public.forTherapists}
            size="lg"
            variant="secondary"
            className="min-h-12 w-full rounded-2xl text-base"
          >
            Ver planos
          </TESButton>
        </div>
      </div>
    </TherapistCheckoutFrame>
  );
}

function TherapistCheckoutFrame({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen bg-surface-soft px-5 py-8 text-brand-deep sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center gap-8">
        <div className="relative flex w-full justify-center">
          <AuthBackButton fallbackHref={routes.public.home} />
          <PublicLogo />
        </div>
        <section className="w-full overflow-hidden rounded-hero border border-border bg-surface-default shadow-float">
          {children}
        </section>
      </div>
    </main>
  );
}

function CheckoutReturnMissingSessionId({
  plan,
}: {
  plan: "premium" | "premium_plus";
}) {
  return (
    <section className="rounded-card border border-border bg-white p-5 sm:p-6">
      <p className="text-sm font-extrabold text-brand-deep">
        Retorno incompleto do pagamento
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Não foi possível consultar esta tentativa de pagamento. Seu plano
        continua Free e você pode iniciar uma nova tentativa.
      </p>
      <div className="mt-5">
        <EmbeddedSubscriptionCheckout plan={plan} />
      </div>
    </section>
  );
}

function isCheckoutReturnStatus(status?: string) {
  return (
    status === "success" ||
    status === "canceled" ||
    status === "catalog" ||
    status === "configuration" ||
    status === "unauthorized" ||
    status === "unavailable"
  );
}

function buildCheckoutContinuation(
  plan: "premium" | "premium_plus",
  params:
    | {
        checkout?: string;
        created?: string;
        session_id?: string;
      }
    | undefined,
) {
  const searchParams = new URLSearchParams({ plan });

  if (isCheckoutReturnStatus(params?.checkout)) {
    searchParams.set("checkout", params?.checkout ?? "");
  }

  if (
    typeof params?.session_id === "string" &&
    /^cs_(test|live)_[A-Za-z0-9_]+$/.test(params.session_id)
  ) {
    searchParams.set("session_id", params.session_id);
  }

  if (params?.created === "1") {
    searchParams.set("created", "1");
  }

  return `${routes.public.therapistCheckout}?${searchParams.toString()}`;
}

function getCheckoutStatusCopy(status?: string) {
  switch (status) {
    case "success":
      return {
        title: "Pagamento em confirmação",
        description:
          "Recebemos seu retorno do pagamento. O plano pago será liberado somente após a confirmação segura.",
      };
    case "canceled":
      return {
        title: "Pagamento cancelado",
        description:
          "Seu plano continua Free. Você pode retomar o pagamento quando quiser.",
      };
    case "catalog":
      return {
        title: "Plano temporariamente indisponível",
        description:
          "Não conseguimos carregar o preço deste plano agora. Tente novamente em instantes.",
      };
    case "configuration":
      return {
        title: "Pagamento indisponível",
        description:
          "Não foi possível iniciar o pagamento agora. Tente novamente em alguns instantes.",
      };
    case "unauthorized":
      return {
        title: "Sessão expirada",
        description:
          "Entre novamente como terapeuta para continuar com a assinatura escolhida.",
      };
    case "unavailable":
      return {
        title: "Pagamento indisponível",
        description:
          "Não conseguimos iniciar o pagamento agora. Seu plano continua Free e nenhuma cobrança foi criada.",
      };
    default:
      return {
        title: "Pagamento online seguro",
        description:
          "Conclua o pagamento abaixo, sem sair do TES. O plano pago será ativado somente após a confirmação segura.",
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
