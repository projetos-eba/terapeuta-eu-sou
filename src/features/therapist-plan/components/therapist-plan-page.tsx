import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleCheck,
  Crown,
  Diamond,
  Info,
  LockKeyhole,
  Sparkles,
  UserRound,
  WandSparkles,
} from "lucide-react";

import {
  AppPageActions,
  AppPageContainer,
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

const comparisonGroups: Array<{
  codes: PlanFeatureCode[];
  label: string;
}> = [
  {
    label: "Operação — base de todos",
    codes: [
      "agenda_days_blocks",
      "profile_focus_cover_bio",
      "shareable_public_profile",
      "automatic_consultation_confirmation",
      "closed_portal_sessions",
    ],
  },
  {
    label: "Identidade e presença — a partir do Premium",
    codes: [
      "username_url",
      "visual_identity_customization",
      "reviews_testimonials",
      "verification_badge",
      "automatic_reminders_partial",
      "search_visibility",
      "profile_metrics",
    ],
  },
  {
    label: "Gestão e inteligência — exclusivo Premium Plus",
    codes: [
      "short_videos_presentation_video",
      "aura",
      "complete_financial_dashboard",
      "complete_message_automation",
      "journey_history_crm",
      "advanced_badge_system",
      "seasonal_campaigns",
      "tes_academy",
    ],
  },
];

export function TherapistPlanPage({ data }: { data: TherapistPlanPageData }) {
  return (
    <AppPageContainer className="max-w-[1280px] gap-6 lg:gap-8">
      <PlanHero />
      <CurrentPlanSection data={data} />
      <UpgradeOptions data={data} />
      <ComparisonTable data={data} />
      <PaymentProtection />
    </AppPageContainer>
  );
}

export function TherapistPlanErrorState({ message }: { message: string }) {
  return (
    <AppPageContainer className="max-w-[1280px] gap-6">
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

function PlanHero() {
  return (
    <section className="relative isolate min-h-[270px] overflow-hidden rounded-panel border border-brand-lavender/70 bg-surface-soft px-5 py-8 shadow-card sm:px-8 sm:py-10 lg:min-h-[320px] lg:px-12">
      <Image
        alt=""
        className="absolute inset-y-0 right-0 -z-10 hidden h-full w-[58%] object-cover object-center lg:block"
        height={468}
        priority
        sizes="(min-width: 1024px) 680px, 0px"
        src="/therapist/dashboard/therapist-hero.png"
        width={624}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-surface-soft via-surface-soft to-transparent lg:w-[72%]" />
      <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-primary">
        Assinatura TES
      </p>
      <h1 className="mt-3 font-display text-[44px] font-light italic leading-none text-brand-deep sm:text-[58px]">
        Meu plano
      </h1>
      <p className="mt-4 max-w-md text-base font-semibold leading-7 text-tesText-secondary sm:text-lg">
        Gerencie sua assinatura e aproveite ao máximo sua experiência.
      </p>
    </section>
  );
}

function CurrentPlanSection({ data }: { data: TherapistPlanPageData }) {
  const plan = getTherapistPlanDefinition(data.effectivePlan);
  const item = getCatalogItem(data, data.effectivePlan);
  const status = getSubscriptionSummary(data);
  const allFeatures = plan.features
    .map(getPlanFeatureDefinition)
    .filter((feature): feature is NonNullable<typeof feature> =>
      Boolean(feature),
    );
  const features = allFeatures.slice(0, 12);
  const hasMoreFeatures = allFeatures.length > features.length;

  return (
    <AppPageSection className="p-0 sm:p-0" aria-labelledby="current-plan-title">
      <div className="flex flex-col gap-3 border-b border-brand-lavender/80 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <Crown aria-hidden="true" size={20} />
          </span>
          <div>
            <h2
              className="text-2xl font-extrabold text-brand-deep"
              id="current-plan-title"
            >
              Plano atual
            </h2>
            <p className="mt-0.5 text-sm font-medium text-tesText-secondary">
              Consulte os recursos que acompanham sua assinatura.
            </p>
          </div>
        </div>
        <PlanStatusBadge status={status} />
      </div>

      <div className="grid lg:grid-cols-[minmax(250px,0.78fr)_minmax(300px,1.1fr)_minmax(260px,0.82fr)]">
        <section
          className="border-b border-brand-lavender/80 p-5 sm:p-7 lg:border-b-0 lg:border-r"
          aria-label="Resumo do plano atual"
        >
          <PlanIcon plan={data.effectivePlan} />
          <p className="mt-5 text-2xl font-extrabold text-brand-deep">
            {plan.name}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {plan.description}
          </p>
          <div className="mt-7 border-t border-brand-lavender/80 pt-5">
            <Price item={item} />
            <p className="mt-2 text-sm font-medium text-tesText-secondary">
              {status.detail}
            </p>
          </div>
          <TESButton
            className="mt-6 w-full rounded-lg"
            href="#comparativo-de-recursos"
            variant="secondary"
          >
            Ver detalhes do plano
          </TESButton>
        </section>

        <section
          className="border-b border-brand-lavender/80 p-5 sm:p-7 lg:border-b-0 lg:border-r"
          aria-labelledby="plan-includes-title"
        >
          <h3
            className="text-xl font-extrabold text-brand-deep"
            id="plan-includes-title"
          >
            Seu plano inclui
          </h3>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {features.map((feature) => (
              <li
                className="flex items-start gap-3 text-sm font-semibold leading-5 text-brand-deep"
                key={feature.code}
              >
                <CircleCheck
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-brand-primary"
                />
                <span>{feature.label}</span>
              </li>
            ))}
          </ul>
          {hasMoreFeatures ? (
            <a
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-brand-primary transition-colors hover:text-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
              href="#comparativo-de-recursos"
            >
              Ver todos os recursos
              <ArrowRight aria-hidden="true" size={16} />
            </a>
          ) : null}
        </section>

        <UpgradeRecommendation data={data} />
      </div>
    </AppPageSection>
  );
}

function UpgradeRecommendation({ data }: { data: TherapistPlanPageData }) {
  const recommendedPlan = getRecommendedUpgrade(data.effectivePlan);
  if (!recommendedPlan) {
    return (
      <section
        className="bg-brand-lavenderSoft/45 p-5 sm:p-7"
        aria-label="Plano mais completo"
      >
        <span className="grid size-11 place-items-center rounded-full bg-white text-brand-primary shadow-card">
          <BadgeCheck aria-hidden="true" size={21} />
        </span>
        <p className="mt-5 text-sm font-extrabold uppercase tracking-[0.12em] text-brand-primary">
          Seu plano mais completo
        </p>
        <h3 className="mt-2 text-2xl font-extrabold text-brand-deep">
          Você já conta com todos os recursos disponíveis.
        </h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
          Continue usando os recursos do Premium Plus conforme eles estiverem
          disponíveis para sua conta.
        </p>
        <TESButton
          className="mt-6 w-full rounded-lg"
          href={`${routes.therapist.settings}#plano-assinatura`}
          variant="secondary"
        >
          Gerenciar assinatura
        </TESButton>
      </section>
    );
  }

  const item = getCatalogItem(data, recommendedPlan);
  const definition = getTherapistPlanDefinition(recommendedPlan);
  const highlightedFeatures = definition.features
    .filter(
      (feature) =>
        getPlanFeatureDefinition(feature)?.minimumPlan === recommendedPlan,
    )
    .slice(0, 5);

  return (
    <section
      className="bg-brand-lavenderSoft/45 p-5 sm:p-7"
      aria-label={`Evolua para ${definition.name}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-white text-brand-primary shadow-card">
          <Sparkles aria-hidden="true" size={21} />
        </span>
        <span className="rounded-full bg-brand-cyanSoft px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-brand-deep">
          Recomendado
        </span>
      </div>
      <h3 className="mt-5 text-2xl font-extrabold leading-tight text-brand-deep">
        Evolua para o {definition.name}
      </h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        Tudo do {data.effectivePlan === TherapistPlan.Free ? "Free" : "Premium"}
        , mais:
      </p>
      <ul className="mt-4 grid gap-2.5">
        {highlightedFeatures.map((code) => (
          <li
            className="flex items-start gap-2 text-sm font-semibold leading-5 text-brand-deep"
            key={code}
          >
            <Check
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-brand-primary"
              strokeWidth={3}
            />
            <span>{getPlanFeatureDefinition(code)?.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <PlanAction
          currentPlan={data.effectivePlan}
          item={item}
          subscription={data.subscription}
        />
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-tesText-secondary">
        {item.unitAmountCents > 0
          ? `A partir de ${formatMoney(item.unitAmountCents, item.currency)} por mês`
          : ""}
      </p>
    </section>
  );
}

function UpgradeOptions({ data }: { data: TherapistPlanPageData }) {
  const options = data.catalog.filter(
    (item) =>
      isTherapistPlanAtLeast(item.code, data.effectivePlan) &&
      item.code !== data.effectivePlan,
  );

  if (data.effectivePlan !== TherapistPlan.Free || options.length < 2)
    return null;

  return (
    <section aria-labelledby="upgrade-options-title">
      <header className="px-1">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-primary">
          Escolha como evoluir
        </p>
        <h2
          className="mt-2 font-display text-[34px] font-light italic leading-tight text-brand-deep sm:text-[44px]"
          id="upgrade-options-title"
        >
          Mais possibilidades para sua prática
        </h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
          Compare os recursos de cada plano e escolha a opção que faz sentido
          para este momento.
        </p>
      </header>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {options.map((item) => (
          <UpgradeOptionCard data={data} item={item} key={item.code} />
        ))}
      </div>
    </section>
  );
}

function UpgradeOptionCard({
  data,
  item,
}: {
  data: TherapistPlanPageData;
  item: TherapistPlanCatalogItem;
}) {
  const definition = getTherapistPlanDefinition(item.code);
  const featureCodes = definition.features
    .filter((code) => getPlanFeatureDefinition(code)?.minimumPlan === item.code)
    .slice(0, 5);

  return (
    <article
      className={cn(
        "flex min-h-[332px] flex-col rounded-panel border bg-white p-5 shadow-card sm:p-6",
        item.code === TherapistPlan.PremiumPlus
          ? "border-brand-primary"
          : "border-brand-lavender",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <PlanIcon plan={item.code} size="sm" />
        {item.code === TherapistPlan.PremiumPlus ? (
          <span className="rounded-full bg-brand-lavenderSoft px-3 py-1 text-xs font-extrabold text-brand-primary">
            Mais completo
          </span>
        ) : null}
      </div>
      <h3 className="mt-5 text-2xl font-extrabold text-brand-deep">
        {definition.name}
      </h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {definition.description}
      </p>
      <ul className="mt-5 grid gap-2.5 text-sm font-semibold text-brand-deep">
        {featureCodes.map((code) => (
          <li className="flex gap-2" key={code}>
            <Check
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-brand-primary"
              strokeWidth={3}
            />
            <span>{getPlanFeatureDefinition(code)?.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto border-t border-brand-lavender/80 pt-5">
        <Price item={item} />
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
  if (
    currentPlan === item.code ||
    !isTherapistPlanAtLeast(item.code, currentPlan)
  )
    return null;

  if (currentPlan === TherapistPlan.Free) {
    return (
      <TESButton
        className="mt-5 w-full rounded-lg"
        href={`${routes.public.therapistCheckout}?plan=${item.code}`}
        variant="gradient"
      >
        Fazer upgrade <ArrowRight aria-hidden="true" size={18} />
      </TESButton>
    );
  }
  if (!subscription) {
    return (
      <TESButton
        className="mt-5 w-full rounded-lg"
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
        className="mt-5 w-full rounded-lg"
        href={`${routes.therapist.settings}#plano-assinatura`}
        variant="secondary"
      >
        Gerenciar mudança agendada
      </TESButton>
    );
  }
  if (["past_due", "unpaid", "incomplete"].includes(subscription.status)) {
    return (
      <TESButton
        className="mt-5 w-full rounded-lg"
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
      className="mt-5 w-full"
      description="A mudança é imediata e a diferença do período atual será calculada antes da confirmação. Se o pagamento não for confirmado, seu plano atual será preservado."
      targetPlan={item.code}
      title={`Mudar para TES ${getTherapistPlanDefinition(item.code).name}`}
    >
      Fazer upgrade para Premium Plus
    </SubscriptionCommandButton>
  );
}

function ComparisonTable({ data }: { data: TherapistPlanPageData }) {
  return (
    <section
      className="overflow-hidden rounded-panel border border-brand-lavender bg-white shadow-card"
      id="comparativo-de-recursos"
      aria-labelledby="comparison-title"
    >
      <div className="border-b border-brand-lavender/80 px-5 py-5 sm:px-7">
        <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand-primary">
          Comparativo de recursos
        </p>
        <h2
          className="mt-2 text-2xl font-extrabold text-brand-deep"
          id="comparison-title"
        >
          Tudo o que cada plano oferece
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-tesText-secondary">
          Compare os recursos disponíveis no Free, no Premium e no Premium Plus.
        </p>
      </div>
      <div
        className="overflow-x-auto"
        role="region"
        aria-label="Tabela comparativa de recursos dos planos"
        tabIndex={0}
      >
        <table className="min-w-[860px] w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-brand-lavender/80">
              <th className="min-w-[360px] p-5 text-sm font-extrabold text-brand-deep sm:px-7">
                Recursos
              </th>
              {data.catalog.map((plan) => (
                <th className="min-w-[160px] p-5 text-center" key={plan.code}>
                  <PlanTableHeading plan={plan.code} name={plan.name} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonGroups.map((group) => (
              <ComparisonGroup
                catalog={data.catalog}
                group={group}
                key={group.label}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ComparisonGroup({
  catalog,
  group,
}: {
  catalog: TherapistPlanCatalogItem[];
  group: (typeof comparisonGroups)[number];
}) {
  return (
    <>
      <tr className="bg-brand-lavenderSoft/55">
        <th
          className="px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-deep sm:px-7"
          colSpan={catalog.length + 1}
        >
          {group.label}
        </th>
      </tr>
      {group.codes.map((code) => {
        const feature = getPlanFeatureDefinition(code);
        if (!feature) return null;
        return (
          <tr
            className="border-b border-brand-lavender/70 last:border-0"
            key={code}
          >
            <th className="px-5 py-4 sm:px-7">
              <span className="block text-sm font-extrabold text-brand-deep">
                {feature.label}
              </span>
              <span className="mt-1 block text-xs font-medium leading-5 text-tesText-secondary">
                {feature.description}
              </span>
            </th>
            {catalog.map((plan) => {
              const included = isTherapistPlanAtLeast(
                plan.code,
                feature.minimumPlan,
              );
              return (
                <td className="px-5 py-4 text-center" key={plan.code}>
                  <span
                    className={cn(
                      "inline-flex min-h-8 min-w-8 items-center justify-center rounded-full px-3 text-xs font-extrabold",
                      included
                        ? "bg-status-successBg text-status-success"
                        : "bg-surface-soft text-tesText-muted",
                    )}
                  >
                    {included ? (
                      <Check aria-hidden="true" size={15} strokeWidth={3} />
                    ) : (
                      "—"
                    )}
                    <span className="sr-only">
                      {included ? "Incluído" : "Não incluído"}
                    </span>
                  </span>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

function PaymentProtection() {
  return (
    <AppPageSection className="flex flex-col gap-5 border-brand-lavender bg-brand-lavenderSoft/35 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-brand-primary shadow-card">
          <LockKeyhole aria-hidden="true" size={20} />
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep">
            Assinatura com segurança
          </h2>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-tesText-secondary">
            Qualquer mudança só é aplicada depois da confirmação necessária.
            Downgrades e cancelamentos são gerenciados em Configurações.
          </p>
        </div>
      </div>
      <AppPageActions className="shrink-0">
        <TESButton
          className="w-full rounded-lg sm:w-auto"
          href={`${routes.therapist.settings}#plano-assinatura`}
          variant="secondary"
        >
          Gerenciar assinatura
        </TESButton>
      </AppPageActions>
    </AppPageSection>
  );
}

function PlanIcon({
  plan,
  size = "md",
}: {
  plan: TherapistPlanValue;
  size?: "sm" | "md";
}) {
  const Icon =
    plan === TherapistPlan.Free
      ? UserRound
      : plan === TherapistPlan.Premium
        ? Diamond
        : WandSparkles;
  const colors =
    plan === TherapistPlan.Free
      ? "bg-brand-lavenderSoft text-brand-primary"
      : plan === TherapistPlan.Premium
        ? "bg-brand-cyanSoft text-brand-cyan"
        : "bg-status-successBg text-status-success";
  return (
    <span
      className={cn(
        "grid place-items-center rounded-full",
        size === "md" ? "size-14" : "size-11",
        colors,
      )}
    >
      <Icon aria-hidden="true" size={size === "md" ? 26 : 21} />
    </span>
  );
}

function PlanTableHeading({
  name,
  plan,
}: {
  name: string;
  plan: TherapistPlanValue;
}) {
  return (
    <span className="inline-flex flex-col items-center gap-2 text-center">
      <PlanIcon plan={plan} size="sm" />
      <span className="text-sm font-extrabold text-brand-deep">{name}</span>
    </span>
  );
}

function PlanStatusBadge({
  status,
}: {
  status: ReturnType<typeof getSubscriptionSummary>;
}) {
  const tone =
    status.badge === "Assinatura ativa"
      ? "bg-status-successBg text-status-success"
      : status.badge === "Pagamento pendente" ||
          status.badge === "Assinatura indisponível"
        ? "bg-status-dangerBg text-status-danger"
        : "bg-status-warningBg text-brand-deep";
  return (
    <span
      className={cn(
        "inline-flex min-h-8 w-fit items-center rounded-full px-3 text-xs font-extrabold",
        tone,
      )}
    >
      {status.badge}
    </span>
  );
}

function Price({ item }: { item: TherapistPlanCatalogItem }) {
  if (item.unitAmountCents === 0)
    return <p className="text-3xl font-extrabold text-brand-deep">Gratuito</p>;
  return (
    <p className="text-lg font-semibold text-brand-deep">
      <strong className="text-3xl">
        {formatMoney(item.unitAmountCents, item.currency)}
      </strong>{" "}
      <span className="text-base">/mês</span>
    </p>
  );
}

function getCatalogItem(data: TherapistPlanPageData, plan: TherapistPlanValue) {
  const item = data.catalog.find((catalogItem) => catalogItem.code === plan);
  if (!item) throw new Error("Catálogo de planos incompleto.");
  return item;
}

function getRecommendedUpgrade(plan: TherapistPlanValue) {
  if (plan === TherapistPlan.Free) return TherapistPlan.Premium;
  if (plan === TherapistPlan.Premium) return TherapistPlan.PremiumPlus;
  return null;
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
      badge: "Plano Free",
      detail: "Você pode conhecer os recursos dos planos pagos quando quiser.",
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
