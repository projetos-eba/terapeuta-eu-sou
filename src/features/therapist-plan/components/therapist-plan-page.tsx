import {
  CheckCircle2,
  Crown,
  Diamond,
  Info,
  LockKeyhole,
  Send,
} from "lucide-react";

import {
  AppPageContainer,
  AppPageHeader,
  AppPageSection,
} from "@/components/app-page";
import { TESButton } from "@/components/tes";
import {
  getPlanFeatureDefinition,
  getTherapistPlanDefinition,
  isTherapistPlanAtLeast,
  TherapistPlan,
  type PlanFeatureCode,
  type TherapistPlan as TherapistPlanValue,
} from "@/domain/tes";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type {
  TherapistPlanCatalogItem,
  TherapistPlanPageData,
  TherapistSubscriptionSummary,
} from "../therapist-plan.types";
import { formatDate, formatMoney } from "../therapist-plan.formatters";
import { SubscriptionCommandButton } from "./subscription-command-button";

const comparisonFeatures: PlanFeatureCode[] = [
  "profile_focus_cover_bio",
  "agenda_days_blocks",
  "reviews_testimonials",
  "profile_metrics",
  "aura",
  "complete_financial_dashboard",
  "journey_history_crm",
];

export function TherapistPlanPage({ data }: { data: TherapistPlanPageData }) {
  return (
    <AppPageContainer className="max-w-[1240px] gap-6">
      <AppPageHeader
        className="border-transparent bg-transparent px-1 shadow-none sm:px-1"
        title="Planos e assinatura"
      >
        Encontre o plano ideal para sua prática. Compare os recursos e escolha
        como quer evoluir no TES.
      </AppPageHeader>

      <CurrentPlanSummary data={data} />

      <section className="grid gap-5 lg:grid-cols-3" aria-label="Planos TES">
        {data.catalog.map((item) => (
          <PlanCard data={data} item={item} key={item.code} />
        ))}
      </section>

      <ComparisonTable data={data} />

      <AppPageSection className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <LockKeyhole aria-hidden="true" size={20} />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-brand-deep">
              Pagamento protegido
            </h2>
            <p className="mt-1 text-sm font-semibold text-tesText-secondary">
              A assinatura só muda depois da confirmação do pagamento.
            </p>
          </div>
        </div>
        <TESButton
          className="rounded-lg"
          href={`${routes.therapist.settings}#plano-assinatura`}
          variant="secondary"
        >
          Gerenciar assinatura
        </TESButton>
      </AppPageSection>
    </AppPageContainer>
  );
}

export function TherapistPlanErrorState({ message }: { message: string }) {
  return (
    <AppPageContainer className="max-w-[1240px] gap-6">
      <AppPageSection className="grid gap-5">
        <span className="grid size-12 place-items-center rounded-full bg-status-dangerBg text-status-danger">
          <Info aria-hidden="true" size={24} />
        </span>
        <div>
          <h1 className="font-display text-[34px] font-light italic leading-tight text-brand-deep sm:text-[46px]">
            Planos indisponíveis
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            {message}
          </p>
        </div>
        <TESButton className="w-fit rounded-lg" href={routes.therapist.plan}>
          Tentar novamente
        </TESButton>
      </AppPageSection>
    </AppPageContainer>
  );
}

function CurrentPlanSummary({ data }: { data: TherapistPlanPageData }) {
  const plan = getTherapistPlanDefinition(data.effectivePlan);
  const status = getSubscriptionSummary(data);

  return (
    <section className="flex flex-col gap-4 rounded-card border border-brand-lavender bg-brand-lavenderSoft/45 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-brand-primary shadow-card">
          <Info aria-hidden="true" size={20} />
        </span>
        <div>
          <p className="text-base font-semibold text-tesText-secondary">
            Seu plano atual:{" "}
            <strong className="text-brand-deep">TES {plan.name}</strong>
          </p>
          <p className="mt-1 text-sm font-semibold text-tesText-secondary">
            {status.detail}
          </p>
        </div>
      </div>
      <span className="inline-flex min-h-9 w-fit items-center rounded-full border border-brand-lavender bg-white px-4 text-xs font-extrabold text-brand-deep">
        {status.badge}
      </span>
    </section>
  );
}

function PlanCard({
  data,
  item,
}: {
  data: TherapistPlanPageData;
  item: TherapistPlanCatalogItem;
}) {
  const current = item.code === data.effectivePlan;
  const definition = getTherapistPlanDefinition(item.code);
  const Icon =
    item.code === "free" ? Send : item.code === "premium" ? Diamond : Crown;
  const featureCodes = definition.features.filter((code) => {
    const feature = getPlanFeatureDefinition(code);
    return feature && !feature.label.includes("Em breve");
  });
  const primaryFeatures =
    item.code === "free"
      ? featureCodes.slice(0, 5)
      : featureCodes
          .filter(
            (code) => getPlanFeatureDefinition(code)?.minimumPlan === item.code,
          )
          .slice(0, 5);

  return (
    <article
      className={cn(
        "relative flex min-h-[510px] flex-col rounded-[24px] border bg-white p-6 shadow-card sm:p-7",
        current || item.code === "premium_plus"
          ? "border-brand-primary"
          : "border-brand-lavender",
        item.code === "premium_plus" && "shadow-float",
      )}
    >
      {item.code === "premium_plus" ? (
        <span className="absolute right-5 top-4 rounded-full bg-status-warningBg px-3 py-1 text-xs font-extrabold text-brand-deep">
          Mais completo
        </span>
      ) : null}
      <span
        className={cn(
          "grid size-14 place-items-center rounded-full",
          item.code === "free"
            ? "bg-brand-lavenderSoft text-brand-primary"
            : item.code === "premium"
              ? "bg-brand-cyanSoft text-brand-cyan"
              : "bg-status-successBg text-status-success",
        )}
      >
        <Icon aria-hidden="true" size={26} />
      </span>
      <h2 className="mt-6 text-xl font-extrabold text-brand-deep">
        TES {item.name}
      </h2>
      {current ? (
        <span className="mt-3 inline-flex min-h-7 w-fit items-center gap-1 rounded-full border border-brand-lavender px-3 text-xs font-bold text-brand-primary">
          Seu plano atual
        </span>
      ) : null}
      <div className="mt-5 border-b border-brand-lavender pb-5">
        <Price item={item} />
      </div>
      <ul className="mt-5 grid gap-3 text-sm font-semibold text-brand-deep">
        {item.code !== "free" ? (
          <Benefit
            label={`Tudo do ${item.code === "premium" ? "Free" : "Premium"}`}
          />
        ) : null}
        {primaryFeatures.map((code) => (
          <Benefit
            key={code}
            label={getPlanFeatureDefinition(code)?.label ?? code}
          />
        ))}
      </ul>
      <div className="mt-auto pt-7">
        <PlanAction
          currentPlan={data.effectivePlan}
          item={item}
          subscription={data.subscription}
        />
      </div>
    </article>
  );
}

function PlanAction({
  currentPlan,
  item,
  subscription,
}: {
  currentPlan: TherapistPlanValue;
  item: TherapistPlanCatalogItem;
  subscription: TherapistSubscriptionSummary | null;
}) {
  if (currentPlan === item.code) {
    return (
      <TESButton
        className="w-full rounded-lg"
        disabled
        type="button"
        variant="secondary"
      >
        Plano atual
      </TESButton>
    );
  }
  if (!isTherapistPlanAtLeast(item.code, currentPlan)) return null;
  if (currentPlan === TherapistPlan.Free) {
    return (
      <TESButton
        className="w-full rounded-lg"
        href={`${routes.public.therapistCheckout}?plan=${item.code}`}
        variant="gradient"
      >
        Fazer upgrade
      </TESButton>
    );
  }
  if (!subscription) {
    return (
      <TESButton
        className="w-full rounded-lg"
        disabled
        type="button"
        variant="secondary"
      >
        Assinatura indisponível
      </TESButton>
    );
  }
  if (subscription.cancelAtPeriodEnd || subscription.scheduledPlan) {
    return (
      <TESButton
        className="w-full rounded-lg"
        href={`${routes.therapist.settings}#plano-assinatura`}
        variant="secondary"
      >
        Gerenciar mudança agendada
      </TESButton>
    );
  }
  if (
    subscription.status === "past_due" ||
    subscription.status === "unpaid" ||
    subscription.status === "incomplete"
  ) {
    return (
      <TESButton
        className="w-full rounded-lg"
        disabled
        type="button"
        variant="secondary"
      >
        Assinatura requer atenção
      </TESButton>
    );
  }
  return (
    <SubscriptionCommandButton
      action="change_plan"
      className="w-full"
      description="A mudança é imediata e a diferença do período atual será calculada antes da confirmação. Se o pagamento não for confirmado, seu plano atual será preservado."
      targetPlan={item.code}
      title="Mudar para TES Premium Plus"
    >
      Fazer upgrade para Premium Plus
    </SubscriptionCommandButton>
  );
}

function Price({ item }: { item: TherapistPlanCatalogItem }) {
  if (item.unitAmountCents === 0)
    return <p className="text-2xl font-extrabold text-brand-deep">Gratuito</p>;
  return (
    <p className="text-lg font-semibold text-brand-deep">
      <strong className="text-3xl">
        {formatMoney(item.unitAmountCents, item.currency)}
      </strong>{" "}
      /mês
    </p>
  );
}

function Benefit({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-brand-primary"
        size={17}
      />
      <span>{label}</span>
    </li>
  );
}

function ComparisonTable({ data }: { data: TherapistPlanPageData }) {
  return (
    <section className="overflow-hidden rounded-card border border-brand-lavender bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-brand-lavender">
              <th className="p-5 text-base font-extrabold text-brand-deep">
                Compare os benefícios
              </th>
              {data.catalog.map((plan) => (
                <th
                  className="p-5 text-center text-sm font-extrabold text-brand-deep"
                  key={plan.code}
                >
                  TES {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonFeatures.map((code) => {
              const feature = getPlanFeatureDefinition(code);
              if (!feature) return null;
              return (
                <tr
                  className="border-b border-brand-lavender/70 last:border-0"
                  key={code}
                >
                  <th className="p-5">
                    <span className="block text-sm font-extrabold text-brand-deep">
                      {feature.label}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-tesText-secondary">
                      {feature.description}
                    </span>
                  </th>
                  {data.catalog.map((plan) => {
                    const included = isTherapistPlanAtLeast(
                      plan.code,
                      feature.minimumPlan,
                    );
                    return (
                      <td className="p-5 text-center" key={plan.code}>
                        <span
                          className={cn(
                            "inline-flex min-h-7 items-center rounded-full px-3 text-xs font-extrabold",
                            included
                              ? "bg-status-successBg text-status-success"
                              : "bg-surface-soft text-tesText-muted",
                          )}
                        >
                          {included ? "Incluído" : "Não incluído"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function getSubscriptionSummary(data: TherapistPlanPageData) {
  const subscription = data.subscription;
  if (!subscription && data.effectivePlan !== TherapistPlan.Free)
    return {
      badge: "Assinatura indisponível",
      detail:
        "Não foi possível confirmar os dados de cobrança. Tente novamente em instantes.",
    };
  if (!subscription)
    return {
      badge: "Sem cobrança ativa",
      detail: "Gerencie mudanças e cancelamentos em Configurações.",
    };
  if (subscription.cancelAtPeriodEnd)
    return {
      badge: "Cancelamento agendado",
      detail: `Sua assinatura ficará ativa até ${formatDate(subscription.currentPeriodEnd)}.`,
    };
  if (subscription.scheduledPlan)
    return {
      badge: "Mudança agendada",
      detail: `Seu plano mudará para TES ${getTherapistPlanDefinition(subscription.scheduledPlan).name} em ${formatDate(subscription.scheduledChangeAt)}.`,
    };
  if (subscription.status === "past_due" || subscription.status === "unpaid")
    return {
      badge: "Pagamento pendente",
      detail: "Revise os dados de cobrança para manter a assinatura em dia.",
    };
  return {
    badge: "Assinatura ativa",
    detail: subscription.currentPeriodEnd
      ? `Próxima renovação em ${formatDate(subscription.currentPeriodEnd)}.`
      : "Assinatura ativa.",
  };
}
