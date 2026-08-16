import { Fragment } from "react";
import {
  BookOpen,
  CalendarCheck,
  Check,
  Gem,
  LineChart,
  Minus,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";

import {
  TherapistPlan,
  getPlanFeatureDefinition,
  planIncludesFeature,
  therapistPlanDefinitions,
  therapistPlanFeatureDefinitions,
  type PlanDefinition,
  type PlanFeatureCategory,
  type PlanFeatureCode,
} from "@/domain/tes";
import { cn } from "@/lib/utils";
import { TESButton } from "@/components/tes";

import { planCategoryLabels } from "./content";

const categoryOrder: PlanFeatureCategory[] = [
  "base",
  "premium",
  "premium_plus",
  "academy",
];

const categoryIcons = {
  academy: BookOpen,
  base: CalendarCheck,
  premium: Sparkles,
  premium_plus: LineChart,
} satisfies Record<PlanFeatureCategory, typeof CalendarCheck>;

type FeatureCellState =
  | { type: "included" }
  | { type: "excluded" }
  | { type: "badge"; label: string }
  | { type: "text"; label: string };

function getFeatureCellState(
  plan: TherapistPlan,
  featureCode: PlanFeatureCode,
): FeatureCellState {
  if (featureCode === "search_visibility") {
    if (plan === TherapistPlan.Premium) {
      return { type: "text", label: "destaque" };
    }

    if (plan === TherapistPlan.PremiumPlus) {
      return { type: "text", label: "máxima" };
    }

    return { type: "excluded" };
  }

  if (featureCode === "seasonal_campaigns") {
    return plan === TherapistPlan.PremiumPlus
      ? { type: "badge", label: "EM BREVE" }
      : { type: "excluded" };
  }

  if (featureCode === "tes_academy") {
    if (plan === TherapistPlan.Premium) {
      return { type: "text", label: "Opcional (Em breve)" };
    }

    if (plan === TherapistPlan.PremiumPlus) {
      return { type: "text", label: "Incluso (Em breve)" };
    }

    return { type: "excluded" };
  }

  return planIncludesFeature(plan, featureCode)
    ? { type: "included" }
    : { type: "excluded" };
}

function FeatureState({
  state,
  label,
}: {
  state: FeatureCellState;
  label: string;
}) {
  if (state.type === "text") {
    return (
      <span className="text-[11px] font-extrabold leading-4 text-brand-primary">
        {state.label}
      </span>
    );
  }

  if (state.type === "badge") {
    return (
      <span className="mx-auto inline-flex min-h-6 items-center rounded-full bg-brand-lavenderSoft px-3 text-[10px] font-extrabold uppercase text-brand-primary">
        {state.label}
      </span>
    );
  }

  const included = state.type === "included";

  return (
    <span
      aria-label={included ? `${label}: incluído` : `${label}: não incluído`}
      className={cn(
        "mx-auto grid size-5 place-items-center",
        included ? "text-status-success" : "text-tesText-muted",
      )}
    >
      {included ? <Check className="size-4" /> : <Minus className="size-4" />}
    </span>
  );
}

function PlanHeaderIcon({ plan }: { plan: TherapistPlan }) {
  const Icon =
    plan === TherapistPlan.PremiumPlus
      ? Gem
      : plan === TherapistPlan.Premium
        ? Star
        : UserRound;

  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-[12px]",
        plan === TherapistPlan.PremiumPlus
          ? "bg-brand-primary text-white"
          : "bg-brand-lavenderSoft text-brand-primary",
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

function getMobilePlanIntro(plan: PlanDefinition) {
  if (plan.code === TherapistPlan.Premium) {
    return "Tudo do plano Free, mais:";
  }

  if (plan.code === TherapistPlan.PremiumPlus) {
    return "Tudo do plano Premium, mais:";
  }

  return "Benefícios do plano:";
}

function getMobilePrimaryFeatures(plan: PlanDefinition) {
  const featureMinimumPlan =
    plan.code === TherapistPlan.Free
      ? TherapistPlan.Free
      : plan.code === TherapistPlan.Premium
        ? TherapistPlan.Premium
        : TherapistPlan.PremiumPlus;

  return therapistPlanFeatureDefinitions
    .filter((feature) => feature.minimumPlan === featureMinimumPlan)
    .map((feature) => getPlanFeatureDefinition(feature.code))
    .filter((feature): feature is NonNullable<typeof feature> =>
      Boolean(feature),
    )
    .slice(0, 5);
}

function PlanCard({ plan }: { plan: PlanDefinition }) {
  const primaryFeatures = getMobilePrimaryFeatures(plan);

  return (
    <article
      className={cn(
        "flex h-full min-w-0 max-w-full flex-col rounded-[22px] border bg-white p-6 shadow-card",
        plan.highlight
          ? "border-brand-primary shadow-float"
          : "border-[rgba(222,213,242,0.9)]",
      )}
    >
      {plan.highlight ? (
        <span className="mb-4 w-fit rounded-full bg-brand-lavenderSoft px-3 py-1 text-xs font-extrabold text-brand-primary">
          Recomendado
        </span>
      ) : null}
      <h3 className="text-2xl font-extrabold text-brand-deep">{plan.name}</h3>
      <p className="mt-2 min-h-[48px] text-sm font-semibold leading-6 text-tesText-secondary">
        {plan.subtitle}
      </p>
      <p className="mt-5 text-sm font-extrabold text-brand-primary">
        {getMobilePlanIntro(plan)}
      </p>
      <ul className="mt-4 space-y-3">
        {primaryFeatures.map((feature) => (
          <li
            key={feature.code}
            className="flex items-start gap-3 text-sm font-semibold leading-5 text-tesText-secondary"
          >
            <Check className="mt-0.5 size-4 shrink-0 text-status-success" />
            {feature.label}
          </li>
        ))}
      </ul>
      <details className="mt-5 rounded-[14px] border border-border bg-surface-soft p-4 md:hidden">
        <summary className="cursor-pointer text-sm font-extrabold text-brand-primary">
          Ver todos os recursos
        </summary>
        <div className="mt-4 space-y-4">
          {categoryOrder.map((category) => {
            const categoryFeatures = therapistPlanFeatureDefinitions.filter(
              (feature) => feature.category === category,
            );

            return (
              <div key={category}>
                <h4 className="text-xs font-extrabold uppercase tracking-[0.18em] text-tesText-muted">
                  {planCategoryLabels[category]}
                </h4>
                <ul className="mt-3 space-y-2">
                  {categoryFeatures.map((feature) => {
                    const included = planIncludesFeature(
                      plan.code,
                      feature.code,
                    );
                    const cellState = getFeatureCellState(
                      plan.code,
                      feature.code,
                    );
                    const hasFeature =
                      included ||
                      cellState.type === "text" ||
                      cellState.type === "badge";

                    return (
                      <li
                        key={feature.code}
                        className="flex items-start gap-2 text-xs font-semibold leading-5 text-tesText-secondary"
                      >
                        {hasFeature ? (
                          <Check className="mt-0.5 size-4 shrink-0 text-status-success" />
                        ) : (
                          <Minus className="mt-0.5 size-4 shrink-0 text-tesText-muted" />
                        )}
                        <span>{feature.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </details>
      <div className="mt-6 border-t border-border pt-6">
        <p className="font-display text-3xl font-semibold italic text-brand-deep">
          {plan.priceLabel}
        </p>
        <p className="mt-2 text-xs font-bold leading-5 text-tesText-muted">
          {plan.priceNote}
        </p>
        <TESButton
          href={plan.signupHref}
          variant={plan.highlight ? "gradient" : "secondary"}
          className="mt-5 min-h-[46px] w-full"
        >
          {plan.ctaLabel}
        </TESButton>
      </div>
    </article>
  );
}

export function PlansPreviewSection() {
  return (
    <section
      id="planos"
      className="bg-brand-primary px-5 py-16 text-white sm:px-8 lg:px-12"
    >
      <div className="mx-auto max-w-[1320px]">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-light italic leading-tight md:text-5xl">
            Escolha o plano ideal para você
          </h2>
          <p className="mt-4 text-sm font-semibold leading-6 text-white/82">
            Recursos pensados para facilitar sua rotina e cuidar do que importa:
            suas conexões.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3 xl:hidden">
          {therapistPlanDefinitions.map((plan) => (
            <PlanCard key={plan.code} plan={plan} />
          ))}
        </div>

        <div className="mt-10 hidden overflow-hidden rounded-[18px] border border-border bg-white text-brand-deep shadow-float xl:block">
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[950px] table-fixed border-collapse">
              <caption className="sr-only">
                Comparativo de recursos dos planos para terapeutas
              </caption>
              <thead>
                <tr>
                  <th className="w-[38%] bg-white px-5 py-4 text-left">
                    <span className="sr-only">Recursos</span>
                  </th>
                  {therapistPlanDefinitions.map((plan) => (
                    <th
                      key={plan.code}
                      className="border-l border-border bg-white px-5 py-4 text-left"
                    >
                      <span className="flex items-center gap-3">
                        <PlanHeaderIcon plan={plan.code} />
                        <span>
                          <span className="block font-display text-lg font-semibold italic leading-5 text-brand-deep">
                            {plan.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] font-extrabold leading-4 text-tesText-secondary">
                            {plan.subtitle}
                          </span>
                        </span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categoryOrder.map((category) => (
                  <Fragment key={category}>
                    <tr>
                      <th
                        colSpan={4}
                        scope="colgroup"
                        className="border-t border-brand-lavender/70 bg-brand-lavenderSoft px-5 py-4 text-left text-xs font-extrabold uppercase leading-4 tracking-[0.02em] text-brand-deep"
                      >
                        <span className="flex items-center gap-3">
                          {(() => {
                            const Icon = categoryIcons[category];

                            return (
                              <span className="grid size-8 place-items-center rounded-full bg-white text-brand-primary shadow-card">
                                <Icon className="size-4" aria-hidden="true" />
                              </span>
                            );
                          })()}
                          <span>{planCategoryLabels[category]}</span>
                        </span>
                      </th>
                    </tr>
                    {therapistPlanFeatureDefinitions
                      .filter((feature) => feature.category === category)
                      .map((feature) => (
                        <tr
                          key={feature.code}
                          className="border-t border-border/80"
                        >
                          <th className="bg-white px-5 py-2.5 text-left align-middle">
                            <span className="block text-xs font-extrabold leading-4 text-brand-deep">
                              {feature.label}
                            </span>
                          </th>
                          {therapistPlanDefinitions.map((plan) => (
                            <td
                              key={`${plan.code}-${feature.code}`}
                              className="border-l border-border px-5 py-2.5 text-center align-middle"
                            >
                              <FeatureState
                                state={getFeatureCellState(
                                  plan.code,
                                  feature.code,
                                )}
                                label={`${plan.name} ${feature.label}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-white">
                  <th className="px-5 py-6 text-left align-top">
                    <span className="block text-xs font-extrabold uppercase tracking-[0.14em] text-brand-primary">
                      Assinatura
                    </span>
                    <span className="mt-2 block max-w-xs text-xs font-bold leading-5 text-tesText-secondary">
                      O cadastro envia apenas o código do plano. Preço e
                      liberação futura são confirmados pelo backend.
                    </span>
                  </th>
                  {therapistPlanDefinitions.map((plan) => (
                    <td
                      key={`${plan.code}-signup`}
                      className="border-l border-border px-5 py-6 text-center align-top"
                    >
                      <p className="font-display text-3xl font-semibold italic text-brand-deep">
                        {plan.priceLabel}
                      </p>
                      <p className="mx-auto mt-2 min-h-10 max-w-[180px] text-[11px] font-bold leading-5 text-tesText-muted">
                        {plan.priceNote}
                      </p>
                      <TESButton
                        href={plan.signupHref}
                        variant={plan.highlight ? "gradient" : "secondary"}
                        className="mt-4 min-h-[44px] w-full"
                      >
                        {plan.ctaLabel}
                      </TESButton>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
