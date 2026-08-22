"use client";

import { CalendarClock, CheckCircle2, CreditCard, Crown } from "lucide-react";

import { AppPageActions, AppPageSection } from "@/components/app-page";
import { TESButton } from "@/components/tes";
import {
  getTherapistPlanDefinition,
  isPaidTherapistPlan,
  TherapistPlan,
} from "@/domain/tes";
import { routes } from "@/lib/routes";

import { formatDate, formatMoney } from "../therapist-plan.formatters";
import type { TherapistPlanPageData } from "../therapist-plan.types";
import { SubscriptionCommandButton } from "./subscription-command-button";

export function SubscriptionManagementPanel({
  data,
}: {
  data: TherapistPlanPageData;
}) {
  const definition = getTherapistPlanDefinition(data.effectivePlan);
  const subscription = data.subscription;
  const catalogItem = data.catalog.find(
    (item) => item.code === data.effectivePlan,
  );

  return (
    <AppPageSection className="grid gap-6" id="plano-assinatura">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-status-warningBg text-status-warning">
          <Crown aria-hidden="true" size={22} />
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep">
            Plano e assinatura
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Veja seu plano atual e cuide das próximas mudanças com clareza.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SubscriptionFact
          icon={CheckCircle2}
          label="Plano atual"
          value={definition.name}
        />
        <SubscriptionFact
          icon={CreditCard}
          label="Valor"
          value={
            catalogItem && catalogItem.unitAmountCents > 0
              ? `${formatMoney(catalogItem.unitAmountCents, catalogItem.currency)} por mês`
              : "Sem cobrança"
          }
        />
        <SubscriptionFact
          icon={CalendarClock}
          label={
            subscription?.cancelAtPeriodEnd
              ? "Benefícios disponíveis até"
              : "Próxima renovação"
          }
          value={
            subscription?.currentPeriodEnd
              ? formatDate(subscription.currentPeriodEnd)
              : "Não se aplica"
          }
        />
      </div>

      <SubscriptionNotice data={data} />

      <AppPageActions>
        {!isPaidTherapistPlan(data.effectivePlan) ? (
          <TESButton
            className="rounded-lg"
            href={routes.therapist.plan}
            variant="gradient"
          >
            Conhecer planos
          </TESButton>
        ) : null}

        {data.effectivePlan === TherapistPlan.Premium ? (
          <TESButton
            className="rounded-lg"
            href={routes.therapist.plan}
            variant="gradient"
          >
            Ver Premium Plus
          </TESButton>
        ) : null}

        {data.effectivePlan === TherapistPlan.PremiumPlus &&
        !subscription?.cancelAtPeriodEnd &&
        !subscription?.scheduledPlan ? (
          <SubscriptionCommandButton
            action="change_plan"
            description={`Seu plano será alterado para Premium em ${formatDate(subscription?.currentPeriodEnd ?? null)}. Até essa data, você continuará com todos os benefícios do Premium Plus.`}
            targetPlan={TherapistPlan.Premium}
            title="Mudar para Premium"
            variant="secondary"
          >
            Mudar para Premium
          </SubscriptionCommandButton>
        ) : null}

        {isPaidTherapistPlan(data.effectivePlan) &&
        subscription?.cancelAtPeriodEnd ? (
          <SubscriptionCommandButton
            action="resume"
            description="O cancelamento agendado será desfeito e sua assinatura continuará ativa nas próximas renovações."
            title="Manter minha assinatura"
          >
            Manter minha assinatura
          </SubscriptionCommandButton>
        ) : null}

        {isPaidTherapistPlan(data.effectivePlan) &&
        subscription &&
        !subscription.cancelAtPeriodEnd ? (
          <SubscriptionCommandButton
            action="cancel"
            description={`Você continuará com todos os benefícios do ${definition.name} até ${formatDate(subscription.currentPeriodEnd)}. Depois dessa data, seu plano será Free.`}
            title="Cancelar assinatura"
            variant="ghost"
          >
            Cancelar assinatura
          </SubscriptionCommandButton>
        ) : null}
      </AppPageActions>
    </AppPageSection>
  );
}

function SubscriptionNotice({ data }: { data: TherapistPlanPageData }) {
  const subscription = data.subscription;
  if (!subscription) {
    if (isPaidTherapistPlan(data.effectivePlan)) {
      return (
        <p
          className="rounded-lg border border-status-danger/30 bg-status-dangerBg p-4 text-sm font-bold leading-6 text-status-danger"
          role="alert"
        >
          Não foi possível confirmar os dados da assinatura. As ações ficam
          indisponíveis até a atualização dessas informações.
        </p>
      );
    }
    return (
      <p className="rounded-lg border border-brand-lavender bg-brand-lavenderSoft/50 p-4 text-sm font-semibold leading-6 text-tesText-secondary">
        O plano Free não tem cobrança mensal.
      </p>
    );
  }

  if (subscription.cancelAtPeriodEnd) {
    return (
      <p className="rounded-lg border border-status-warning/30 bg-status-warningBg p-4 text-sm font-bold leading-6 text-brand-deep">
        Cancelamento agendado para {formatDate(subscription.currentPeriodEnd)}.
        Seu plano e seus benefícios continuam ativos até essa data.
      </p>
    );
  }

  if (subscription.scheduledPlan) {
    return (
      <p className="rounded-lg border border-brand-lavender bg-brand-lavenderSoft/50 p-4 text-sm font-bold leading-6 text-brand-deep">
        Seu plano mudará para{" "}
        {getTherapistPlanDefinition(subscription.scheduledPlan).name} em{" "}
        {formatDate(subscription.scheduledChangeAt)}. Até lá, seu plano atual
        permanece ativo.
      </p>
    );
  }

  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    return (
      <p
        className="rounded-lg border border-status-danger/30 bg-status-dangerBg p-4 text-sm font-bold leading-6 text-status-danger"
        role="alert"
      >
        Há uma pendência na assinatura. Revise a forma de pagamento para manter
        seu plano ativo.
      </p>
    );
  }

  return (
    <p className="rounded-lg border border-status-success/30 bg-status-successBg p-4 text-sm font-bold leading-6 text-status-success">
      Assinatura ativa. Qualquer mudança será confirmada antes de afetar seus
      benefícios.
    </p>
  );
}

function SubscriptionFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-brand-lavender bg-white p-4">
      <Icon aria-hidden="true" className="text-brand-primary" size={19} />
      <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.12em] text-tesText-subtle">
        {label}
      </p>
      <p className="mt-2 text-sm font-extrabold leading-6 text-brand-deep">
        {value}
      </p>
    </div>
  );
}
