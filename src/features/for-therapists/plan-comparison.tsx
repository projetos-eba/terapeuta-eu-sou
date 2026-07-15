import { Fragment } from "react";
import { Check, Minus } from "lucide-react";

import {
  TherapistPlan,
  getPlanFeatureDefinition,
  planIncludesFeature,
  therapistPlanDefinitions,
  therapistPlanFeatureDefinitions,
  type PlanDefinition,
  type PlanFeatureCategory,
} from "@/domain/tes";
import { cn } from "@/lib/utils";
import { TESButton } from "@/components/tes";

import { planCategoryLabels } from "./content";

const categoryOrder: PlanFeatureCategory[] = ["base", "premium", "premium_plus"];

function getLimitLabel(plan: PlanDefinition) {
  if (plan.code === TherapistPlan.PremiumPlus) {
    return "Recursos completos sujeitos a politica de uso";
  }

  const services = plan.limits.services
    ? `${plan.limits.services} servico${plan.limits.services > 1 ? "s" : ""}`
    : "Servicos conforme politica";
  const messages = plan.limits.messages
    ? `${plan.limits.messages} mensagens/mes`
    : "Mensagens conforme politica";

  return `${services} · ${messages}`;
}

function FeatureState({
  included,
  label,
}: {
  included: boolean;
  label: string;
}) {
  return (
    <span
      aria-label={included ? `${label}: incluido` : `${label}: nao incluido`}
      className={cn(
        "mx-auto grid size-7 place-items-center rounded-full",
        included
          ? "bg-status-successBg text-status-success"
          : "bg-brand-lavenderSoft text-tesText-muted",
      )}
    >
      {included ? <Check className="size-4" /> : <Minus className="size-4" />}
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

  return "Beneficios do plano:";
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
    .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature))
    .slice(0, 5);
}

function PlanCard({ plan }: { plan: PlanDefinition }) {
  const primaryFeatures = getMobilePrimaryFeatures(plan);

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-[22px] border bg-white p-6 shadow-card",
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
                    const included = planIncludesFeature(plan.code, feature.code);

                    return (
                      <li
                        key={feature.code}
                        className="flex items-start gap-2 text-xs font-semibold leading-5 text-tesText-secondary"
                      >
                        {included ? (
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
            Escolha o plano ideal para voce
          </h2>
          <p className="mt-4 text-sm font-semibold leading-6 text-white/82">
            Recursos pensados para facilitar sua rotina e cuidar do que importa:
            suas conexoes.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3 xl:hidden">
          {therapistPlanDefinitions.map((plan) => (
            <PlanCard key={plan.code} plan={plan} />
          ))}
        </div>

        <div className="mt-10 hidden overflow-x-auto rounded-[18px] border border-white/30 bg-white text-brand-deep shadow-float md:block">
          <table className="min-w-[980px] table-fixed border-collapse">
            <caption className="sr-only">
              Comparativo de recursos dos planos para terapeutas
            </caption>
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-[34%] bg-white px-6 py-6 text-left text-sm font-extrabold text-tesText-muted">
                  Recursos
                </th>
                {therapistPlanDefinitions.map((plan) => (
                  <th
                    key={plan.code}
                    className="border-l border-[#ded5f2] px-6 py-6 text-center"
                  >
                    <span className="block text-lg font-extrabold text-brand-deep">
                      {plan.name}
                    </span>
                    <span className="mt-1 block text-xs font-bold text-tesText-muted">
                      {plan.subtitle}
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
                      className="sticky left-0 bg-brand-lavenderSoft px-6 py-4 text-left text-xs font-extrabold uppercase tracking-[0.2em] text-brand-primary"
                    >
                      {planCategoryLabels[category]}
                    </th>
                  </tr>
                  {therapistPlanFeatureDefinitions
                    .filter((feature) => feature.category === category)
                    .map((feature) => (
                      <tr key={feature.code} className="border-t border-[#ede7f6]">
                        <th className="sticky left-0 z-10 bg-white px-6 py-4 text-left align-top">
                          <span className="block text-sm font-extrabold text-brand-deep">
                            {feature.label}
                          </span>
                          <span className="mt-1 block text-xs font-semibold leading-5 text-tesText-muted">
                            {feature.description}
                          </span>
                        </th>
                        {therapistPlanDefinitions.map((plan) => (
                          <td
                            key={`${plan.code}-${feature.code}`}
                            className="border-l border-[#ede7f6] px-6 py-4 text-center align-middle"
                          >
                            <FeatureState
                              included={planIncludesFeature(plan.code, feature.code)}
                              label={`${plan.name} ${feature.label}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                </Fragment>
              ))}
              <tr className="border-t border-[#ded5f2]">
                <th className="sticky left-0 z-10 bg-white px-6 py-5 text-left text-sm font-extrabold text-brand-deep">
                  Limites de uso
                </th>
                {therapistPlanDefinitions.map((plan) => (
                  <td
                    key={`${plan.code}-limits`}
                    className="border-l border-[#ede7f6] px-6 py-5 text-center text-xs font-bold leading-5 text-tesText-secondary"
                  >
                    {getLimitLabel(plan)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-[#ded5f2]">
                <th className="sticky left-0 z-10 bg-white px-6 py-6 text-left text-sm font-extrabold text-brand-deep">
                  Investimento
                </th>
                {therapistPlanDefinitions.map((plan) => (
                  <td
                    key={`${plan.code}-price`}
                    className="border-l border-[#ede7f6] px-6 py-6 text-center"
                  >
                    <p className="font-display text-3xl font-semibold italic text-brand-deep">
                      {plan.priceLabel}
                    </p>
                    <p className="mt-2 text-xs font-bold leading-5 text-tesText-muted">
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
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
